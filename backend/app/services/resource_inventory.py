import hashlib
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import logging

from app.models.cloud import CloudProvider, CloudAccount, CloudRegion
from app.models.resource import Resource, TaggingScope
from app.schemas.resource import NormalizedResource

logger = logging.getLogger(__name__)

class ResourceInventoryService:
    @staticmethod
    def upsert_resources(
        db: Session,
        provider: CloudProvider,
        upload_job_id: Optional[int],
        source_metadata: Dict[str, Any],
        resources: List[NormalizedResource]
    ) -> Dict[str, int]:
        """
        Upserts a batch of normalized resources into the database safely.
        Returns statistics about the operation.
        """
        stats = {
            "rows_valid": len(resources),
            "rows_invalid": 0,
            "stats_new": 0,
            "stats_updated": 0,
            "stats_duplicate": 0
        }
        
        # 1. Resolve/Create Cloud Accounts and Regions to minimize DB roundtrips
        # Extract unique accounts and regions
        account_info = {} # identifier -> name
        for r in resources:
            identifier = r.account_id or r.account_name
            if identifier:
                current_name = account_info.get(identifier)
                new_name = r.account_name
                # Keep the best available name
                if not current_name or (current_name == identifier and new_name and new_name != identifier):
                    account_info[identifier] = new_name or identifier

        account_map = {} # identifier -> id
        region_map = {} # (account_id, region_name) -> id
        
        # Pre-fetch existing accounts
        if account_info:
            identifiers = list(account_info.keys())
            existing_accounts = db.query(CloudAccount).filter(
                CloudAccount.cloud == provider,
                CloudAccount.account_identifier.in_(identifiers)
            ).all()
            
            for acc in existing_accounts:
                account_map[acc.account_identifier] = acc.id
                # Update name if a better one was discovered
                expected_name = account_info.get(acc.account_identifier)
                if expected_name and expected_name != acc.account_identifier and acc.name == acc.account_identifier:
                    acc.name = expected_name
                
            # Create missing accounts
            for identifier, name in account_info.items():
                if identifier not in account_map:
                    new_acc = CloudAccount(cloud=provider, name=name, account_identifier=identifier)
                    db.add(new_acc)
                    db.flush() # Flush to get IDs
                    account_map[identifier] = new_acc.id
                    
            # Extract unique region dependencies
            region_deps = set()
            for r in resources:
                identifier = r.account_id or r.account_name
                if identifier and r.region_name:
                    region_deps.add((account_map[identifier], r.region_name))
            
            # Pre-fetch existing regions for the relevant accounts
            if region_deps:
                account_ids = list(set(aid for aid, _ in region_deps))
                region_names = list(set(rname for _, rname in region_deps))
                
                existing_regions = db.query(CloudRegion).filter(
                    CloudRegion.cloud_account_id.in_(account_ids),
                    CloudRegion.name.in_(region_names)
                ).all()
                for reg in existing_regions:
                    region_map[(reg.cloud_account_id, reg.name)] = reg.id
                    
                # Create missing regions
                for aid, rname in region_deps:
                    if (aid, rname) not in region_map:
                        new_reg = CloudRegion(cloud_account_id=aid, name=rname, display_name=rname)
                        db.add(new_reg)
                        db.flush()
                        region_map[(aid, rname)] = new_reg.id
        
        # 2. Pre-fetch existing resources by hash for fast lookup
        hashes_in_batch = [hashlib.sha256(r.resource_id.encode('utf-8')).hexdigest() for r in resources if r.resource_id]
        existing_resources_dict = {}
        
        if hashes_in_batch:
            # Chunking might be needed for very large batches, but fine for typical uploads
            existing_res_list = db.query(Resource).filter(
                Resource.provider == provider,
                Resource.resource_id_hash.in_(hashes_in_batch)
            ).all()
            for er in existing_res_list:
                existing_resources_dict[er.resource_id_hash] = er
                
        # 3. Upsert resources
        for r in resources:
            if not r.resource_id:
                stats["rows_invalid"] += 1
                stats["rows_valid"] -= 1
                continue
                
            # EC2 Resource Name Fix: Fallback to AWS Name tag if available
            if provider == CloudProvider.AWS and r.resource_type == "ec2/instance":
                if r.cloud_tags and r.cloud_tags.get("Name"):
                    r.resource_name = r.cloud_tags.get("Name")
                
            res_hash = hashlib.sha256(r.resource_id.encode('utf-8')).hexdigest()
            
            identifier = r.account_id or r.account_name
            acc_id = account_map.get(identifier) if identifier else None
            reg_id = region_map.get((acc_id, r.region_name)) if acc_id and r.region_name else None
            
            # Attach source context
            merged_metadata = dict(source_metadata)
            if r.raw_source:
                merged_metadata["raw"] = r.raw_source
            
            existing = existing_resources_dict.get(res_hash)
            if existing:
                # Update inventory fields but PRESERVE workflow states (like tagging_scope)
                existing.resource_name = r.resource_name or existing.resource_name
                existing.resource_type = r.resource_type or existing.resource_type
                existing.resource_group = r.resource_group or existing.resource_group
                existing.location = r.region_name or existing.location
                
                # Only update account/region if provided in the new source
                if acc_id: existing.cloud_account_id = acc_id
                if reg_id: existing.region_id = reg_id
                
                if upload_job_id:
                    existing.upload_job_id = upload_job_id
                    
                existing.source_metadata = merged_metadata
                
                # Merge cloud_tags (source tags) - update/add new tags, don't necessarily delete old ones unless we have a full refresh policy, but dict merge is safer.
                current_tags = existing.cloud_tags or {}
                current_tags.update(r.cloud_tags)
                existing.cloud_tags = current_tags
                
                stats["stats_updated"] += 1
            else:
                # Insert
                new_res = Resource(
                    provider=provider,
                    cloud_account_id=acc_id,
                    region_id=reg_id,
                    upload_job_id=upload_job_id,
                    resource_id=r.resource_id,
                    resource_id_hash=res_hash,
                    resource_name=r.resource_name or f"Unknown-{r.resource_id}",
                    resource_type=r.resource_type or "Unknown",
                    resource_group=r.resource_group,
                    location=r.region_name,
                    tagging_scope=TaggingScope.REQUIRED, # Default
                    cloud_tags=r.cloud_tags,
                    source_metadata=merged_metadata
                )
                db.add(new_res)
                stats["stats_new"] += 1
                # Add to local cache in case of duplicates within the same batch
                existing_resources_dict[res_hash] = new_res
                
        db.flush()
        return stats

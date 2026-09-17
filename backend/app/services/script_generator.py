import json
import hashlib
import uuid
import datetime
import zipfile
import io
import jwt
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, text
from fastapi import HTTPException
from app.models.tagging import TaggingChange, ChangeStatus, ScriptJob, ScriptJobChange, JobStatus, ScriptType
from app.models.resource import Resource
from app.models.cloud import CloudProvider, CloudAccount
from app.config import settings

def generate_ingestion_token(job_id: str, expiration_minutes: int = 120) -> str:
    payload = {
        "job_id": job_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=expiration_minutes)
    }
    return jwt.encode(payload, settings.LOCAL_AUTH_SECRET_KEY, algorithm="HS256")

class ScriptGeneratorService:
    SCRIPT_VERSION = 1
    
    @staticmethod
    def _hash_manifest(manifest_dict: dict) -> str:
        # Canonical JSON serialization:
        # - sort keys alphabetically
        # - remove all optional whitespace around commas and colons
        # - UTF-8 encoded
        manifest_str = json.dumps(manifest_dict, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(manifest_str.encode('utf-8')).hexdigest()

    @staticmethod
    def _build_manifest(
        job_id: str, 
        provider: CloudProvider, 
        changes: List[Tuple[TaggingChange, Resource, CloudAccount]]
    ) -> dict:
        
        resources_map: Dict[int, dict] = {}
        
        # Track which tag keys are being modified per resource
        resource_modified_keys: Dict[int, set] = {}
        
        for change, resource, account in changes:
            if resource.id not in resources_map:
                resources_map[resource.id] = {
                    "resource_id": resource.resource_id,
                    "resource_name": resource.resource_name or resource.resource_id.split('/')[-1],
                    "resource_group": resource.resource_group,
                    "resource_type": resource.resource_type,
                    "account_id": account.account_identifier,
                    "account_name": account.name,
                    "region": resource.location if provider == CloudProvider.AWS else None,
                    "changes": [],
                    "cloud_tags": resource.cloud_tags or {}
                }
                resource_modified_keys[resource.id] = set()
            
            # The expected previous value (at approval time)
            before_val = change.previous_value
            if before_val is None or before_val == "ABSENT":
                before_val = "NOT_SET"
            after_val = change.approved_value or change.proposed_value
            if after_val is None:
                after_val = "NOT_SET"
            
            # Action inference
            if before_val == after_val:
                action = "PRESERVE"
            elif before_val == "NOT_SET" and after_val != "NOT_SET":
                action = "ADD"
            elif before_val != "NOT_SET" and after_val == "NOT_SET":
                action = "REMOVE"
            else:
                action = "CHANGE"
                
            resources_map[resource.id]["changes"].append({
                "change_id": change.id,
                "key": change.tag_key,
                "action": action,
                "before": before_val,
                "after": after_val
            })
            resource_modified_keys[resource.id].add(change.tag_key)

        # Inject PRESERVE changes for existing unrelated tags and sort
        for rid, res_data in resources_map.items():
            current_cloud_tags = res_data.pop("cloud_tags")
            modified_keys = resource_modified_keys[rid]
            
            for k, v in current_cloud_tags.items():
                if k not in modified_keys:
                    res_data["changes"].append({
                        "change_id": None, # Unrelated to a specific TaggingChange ID
                        "key": k,
                        "action": "PRESERVE",
                        "before": v,
                        "after": v
                    })
            
            # Sort changes deterministically by tag key
            res_data["changes"].sort(key=lambda x: x["key"])

        # Sort resources deterministically by resource_id
        resources_list = list(resources_map.values())
        resources_list.sort(key=lambda x: x["resource_id"])

        manifest = {
            "job_id": job_id,
            "provider": provider.value,
            "script_version": ScriptGeneratorService.SCRIPT_VERSION,
            "resources": resources_list
        }
        
        # Append hash to the manifest root
        manifest["manifest_hash"] = ScriptGeneratorService._hash_manifest(manifest)
        return manifest

    @staticmethod
    def generate_apply_job(
        db: Session, 
        user_id: int, 
        batch_ids: List[int]
    ) -> ScriptJob:
        
        if not batch_ids:
            raise HTTPException(status_code=400, detail="No batch IDs provided.")
            
        # Get provider from the first batch
        from app.models.tagging import TaggingBatch
        first_batch = db.query(TaggingBatch).filter(TaggingBatch.id == batch_ids[0]).first()
        if not first_batch:
            raise HTTPException(status_code=400, detail="Batch not found.")
        provider = first_batch.cloud
        
        query = db.query(TaggingChange, Resource, CloudAccount)\
            .join(Resource, TaggingChange.resource_id == Resource.id)\
            .join(CloudAccount, Resource.cloud_account_id == CloudAccount.id)\
            .outerjoin(ScriptJobChange, TaggingChange.id == ScriptJobChange.change_id)\
            .filter(
                TaggingChange.batch_id.in_(batch_ids),
                TaggingChange.status == ChangeStatus.APPROVED,
                ScriptJobChange.id == None
            )
            
        # Ensure consistent order for deterministic JSON hashing
        query = query.order_by(Resource.id, TaggingChange.id)
            
        # Lock rows
        eligible_rows = query.with_for_update(skip_locked=True).all()
        
        if not eligible_rows:
            # Fallback: check if these EXACT batches are already SCRIPT_GENERATED
            fallback_query = db.query(ScriptJob)\
                .join(ScriptJobChange, ScriptJob.id == ScriptJobChange.job_id)\
                .join(TaggingChange, ScriptJobChange.change_id == TaggingChange.id)\
                .filter(
                    TaggingChange.batch_id.in_(batch_ids),
                    TaggingChange.status == ChangeStatus.SCRIPT_GENERATED
                )
                
            existing_job = fallback_query.order_by(ScriptJob.created_at.desc()).first()
            if existing_job:
                # Reconstruct manifest and create a fresh token
                changes_query = db.query(TaggingChange, Resource, CloudAccount)\
                    .join(Resource, TaggingChange.resource_id == Resource.id)\
                    .join(CloudAccount, Resource.cloud_account_id == CloudAccount.id)\
                    .join(ScriptJobChange, TaggingChange.id == ScriptJobChange.change_id)\
                    .filter(ScriptJobChange.job_id == existing_job.id)\
                    .order_by(Resource.id, TaggingChange.id)\
                    .all()
                manifest = ScriptGeneratorService._build_manifest(existing_job.job_id, provider, changes_query)
                token = generate_ingestion_token(existing_job.job_id)
                token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
                existing_job.ingestion_token_hash = token_hash
                db.commit()
                return existing_job, manifest, token
                
            # If no approved changes and no script job found: data inconsistency or nothing to do
            raise HTTPException(status_code=500, detail="Inconsistent state: The approved changes may be SCRIPT_GENERATED but no canonical ScriptJob was found, or no eligible changes exist for these batches.")
            
        # Create Job ID
        job_id_str = f"JOB-{provider.value}-{uuid.uuid4().hex[:8].upper()}"
        
        # Build Manifest
        manifest = ScriptGeneratorService._build_manifest(job_id_str, provider, eligible_rows)
        manifest_hash = manifest["manifest_hash"]
        
        # Ingestion Token
        token = generate_ingestion_token(job_id_str)
        token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
        
        # Create ScriptJob
        new_job = ScriptJob(
            job_id=job_id_str,
            cloud=provider,
            script_type=ScriptType.APPLY,
            status=JobStatus.GENERATED,
            script_version=ScriptGeneratorService.SCRIPT_VERSION,
            manifest_hash=manifest_hash,
            ingestion_token_hash=token_hash,
            created_by=user_id
        )
        db.add(new_job)
        db.flush() # Get new_job.id
        
        # Create ScriptJobChange associations and update TaggingChange status
        for change, _, _ in eligible_rows:
            assoc = ScriptJobChange(job_id=new_job.id, change_id=change.id)
            db.add(assoc)
            change.status = ChangeStatus.SCRIPT_GENERATED
            
        db.commit()
        db.refresh(new_job)
        
        return new_job, manifest, token

    @staticmethod
    def generate_script_package(manifest: dict, token: str) -> io.BytesIO:
        """
        Creates a ZIP in-memory containing the manifest.json and the apply scripts.
        """
        zip_buffer = io.BytesIO()
        
        provider = manifest.get("provider")
        
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            # Add manifest
            zf.writestr("manifest.json", json.dumps(manifest, indent=2))
            
            # Add README with instructions
            readme_content = (
                f"# CloudTag Script Job: {manifest['job_id']}\n\n"
                "## Execution Instructions\n"
                "This script expects you to be authenticated in your terminal against the respective cloud environment.\n\n"
                "Run `apply.sh` or `apply.ps1` to apply the tags.\n"
            )
            zf.writestr("README.md", readme_content)
            
            # Add apply and revert scripts
            from app.services import script_templates
            if provider == CloudProvider.AWS.value:
                zf.writestr("apply.sh", script_templates.get_aws_apply_script(manifest))
                zf.writestr("revert.sh", script_templates.get_aws_revert_script(manifest))
            else:
                zf.writestr("apply.ps1", script_templates.get_azure_apply_script(manifest))
                zf.writestr("revert.ps1", script_templates.get_azure_revert_script(manifest))
        zip_buffer.seek(0)
        return zip_buffer

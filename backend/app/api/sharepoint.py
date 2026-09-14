from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.cloud import CloudProvider
from app.models.sharepoint import SharePointConfig, SharePointSyncJob, SharePointMapping, SharePointSyncStatus
from app.models.audit import AuditLog
from app.api.deps import get_admin_user
from app.schemas.sharepoint import (
    SharePointConfigSchema,
    SharePointConfigUpdate,
    SharePointMappingSchema,
    SharePointConnectionTestResponse
)
from app.schemas.resource import NormalizedResource
from app.services.resource_inventory import ResourceInventoryService
from app.services.mapping_engine import MOCK_AZURE_SOURCE, MOCK_AWS_SOURCE

router = APIRouter()

def get_provider_enum(provider_str: str) -> CloudProvider:
    provider_str = provider_str.upper()
    if provider_str == "AZURE":
        return CloudProvider.AZURE
    elif provider_str == "AWS":
        return CloudProvider.AWS
    else:
        raise HTTPException(status_code=400, detail="Invalid provider. Must be 'azure' or 'aws'.")

@router.get("/{provider}", response_model=SharePointConfigSchema)
def get_sharepoint_config(
    provider: str = Path(...),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    provider_enum = get_provider_enum(provider)
    config = db.query(SharePointConfig).filter(SharePointConfig.provider == provider_enum).first()
    
    if not config:
        # Create a default blank configuration for the provider if it doesn't exist
        config = SharePointConfig(provider=provider_enum)
        db.add(config)
        db.commit()
        db.refresh(config)
        
    # Get latest sync job
    latest_sync = db.query(SharePointSyncJob).filter(
        SharePointSyncJob.config_id == config.id
    ).order_by(SharePointSyncJob.id.desc()).first()
    
    # Attach for the response schema
    config_schema = SharePointConfigSchema.model_validate(config)
    if latest_sync:
        config_schema.latest_sync = latest_sync
        
    return config_schema

@router.put("/{provider}", response_model=SharePointConfigSchema)
def update_sharepoint_config(
    request: SharePointConfigUpdate,
    provider: str = Path(...),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    provider_enum = get_provider_enum(provider)
    config = db.query(SharePointConfig).filter(SharePointConfig.provider == provider_enum).first()
    
    if not config:
        config = SharePointConfig(provider=provider_enum)
        db.add(config)
        
    update_data = request.model_dump(exclude_unset=True)
    old_values = {}
    for key, value in update_data.items():
        old_values[key] = getattr(config, key)
        setattr(config, key, value)
        
    audit_log = AuditLog(
        user_id=current_admin.id,
        action="UPDATE_SHAREPOINT_CONFIG",
        entity_type="SHAREPOINT_CONFIG",
        entity_id=str(config.id) if config.id else "NEW",
        details={"provider": provider_enum.value, "changes": update_data}
    )
    db.add(audit_log)
    db.commit()
    db.refresh(config)
    
    return get_sharepoint_config(provider, current_admin, db)

@router.post("/{provider}/test-connection", response_model=SharePointConnectionTestResponse)
def test_connection(
    provider: str = Path(...),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    provider_enum = get_provider_enum(provider)
    config = db.query(SharePointConfig).filter(SharePointConfig.provider == provider_enum).first()
    
    if not config or not config.site_url:
        raise HTTPException(status_code=400, detail="Configuration is incomplete.")
        
    return SharePointConnectionTestResponse(
        success=False,
        message="Configuration exists. However, genuine Microsoft Graph connection testing requires application environment secrets."
    )

@router.get("/{provider}/mapping", response_model=List[SharePointMappingSchema])
def get_mappings(
    provider: str = Path(...),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    provider_enum = get_provider_enum(provider)
    config = db.query(SharePointConfig).filter(SharePointConfig.provider == provider_enum).first()
    
    if not config:
        return []
        
    return db.query(SharePointMapping).filter(SharePointMapping.config_id == config.id).all()

@router.post("/{provider}/mapping/detect", response_model=List[SharePointMappingSchema])
def detect_mappings_endpoint(
    provider: str = Path(...),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    from app.services.mapping_engine import detect_mappings
    import json
    
    provider_enum = get_provider_enum(provider)
    config = db.query(SharePointConfig).filter(SharePointConfig.provider == provider_enum).first()
    
    if not config:
        raise HTTPException(status_code=400, detail="Configuration not found.")
        
    # Detect mappings dynamically
    results = detect_mappings(provider)
    
    # Get existing mappings to preserve approved ones
    existing_mappings = {m.source_header: m for m in db.query(SharePointMapping).filter(SharePointMapping.config_id == config.id).all()}
    
    saved_mappings = []
    
    for result in results:
        existing = existing_mappings.get(result.source_header)
        samples_json = json.dumps(result.sample_values)
        
        if existing:
            # Update only if not approved
            if not existing.is_approved:
                existing.target_field = result.target_field
                existing.confidence_score = result.confidence
                existing.sample_values = samples_json
            saved_mappings.append(existing)
        else:
            new_mapping = SharePointMapping(
                config_id=config.id,
                source_header=result.source_header,
                target_field=result.target_field,
                confidence_score=result.confidence,
                sample_values=samples_json,
                is_approved=False,
                is_ignored=False
            )
            db.add(new_mapping)
            saved_mappings.append(new_mapping)
            
    db.commit()
    
    # Return fresh list
    return db.query(SharePointMapping).filter(SharePointMapping.config_id == config.id).all()

@router.patch("/{provider}/mapping/{mapping_id}", response_model=SharePointMappingSchema)
def update_mapping(
    mapping_id: int,
    request: dict,
    provider: str = Path(...),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    mapping = db.query(SharePointMapping).filter(SharePointMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
        
    if "target_field" in request:
        mapping.target_field = request["target_field"]
    if "is_approved" in request:
        mapping.is_approved = request["is_approved"]
    if "is_ignored" in request:
        mapping.is_ignored = request["is_ignored"]
        
    db.commit()
    db.refresh(mapping)
    return mapping

@router.post("/{provider}/sync")
def trigger_sync(
    provider: str = Path(...),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    provider_enum = get_provider_enum(provider)
    config = db.query(SharePointConfig).filter(SharePointConfig.provider == provider_enum).first()
    
    if not config:
        raise HTTPException(status_code=400, detail="Configuration not found.")
        
    # Create a stub job
    job = SharePointSyncJob(
        config_id=config.id,
        status=SharePointSyncStatus.PENDING
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    job.status = SharePointSyncStatus.IN_PROGRESS
    db.commit()

    try:
        source = MOCK_AZURE_SOURCE if provider_enum == CloudProvider.AZURE else MOCK_AWS_SOURCE
        headers = source["headers"]
        data = source["data"]
        
        # Load mappings
        mappings = db.query(SharePointMapping).filter(SharePointMapping.config_id == config.id, SharePointMapping.is_ignored == False).all()
        target_map = {}
        for m in mappings:
            try:
                idx = headers.index(m.source_header)
                if m.target_field:
                    target_map[idx] = m.target_field
            except ValueError:
                pass
                
        normalized_resources = []
        for row in data:
            parsed = {}
            cloud_tags = {}
            raw_source = {}
            
            for idx, val in enumerate(row):
                header_name = headers[idx] if idx < len(headers) else f"col_{idx}"
                raw_source[header_name] = val
                
                if idx in target_map:
                    parsed[target_map[idx]] = val
                else:
                    cloud_tags[header_name] = val
                    
            res_id = parsed.get("resource_id")
            if not res_id:
                continue
                
            nr = NormalizedResource(
                resource_id=str(res_id),
                resource_name=str(parsed.get("resource_name", "")),
                resource_type=str(parsed.get("resource_type", "")),
                resource_group=str(parsed.get("resource_group", "")),
                account_name=str(parsed.get("account_name", "")),
                region_name=str(parsed.get("region", "")),
                cloud_tags=cloud_tags,
                raw_source=raw_source
            )
            normalized_resources.append(nr)
            
        source_metadata = {
            "source_type": "SHAREPOINT",
            "sync_job_id": job.id,
            "site_url": config.site_url
        }
        
        stats = ResourceInventoryService.upsert_resources(
            db=db,
            provider=provider_enum,
            upload_job_id=None,
            source_metadata=source_metadata,
            resources=normalized_resources
        )
        
        job.status = SharePointSyncStatus.COMPLETED
        # Here we could record stats on the job if the schema supported it
    except Exception as e:
        db.rollback()
        job.status = SharePointSyncStatus.FAILED
        job.error_message = f"Sync failed: {str(e)}"
        
    db.commit()
    db.refresh(job)
    
    return {"message": "Sync job completed", "job_id": job.id, "status": job.status}

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.cloud import CloudAccount, CloudRegion, CloudProvider
from app.models.audit import AuditLog
from app.api.deps import get_admin_user
from app.schemas.cloud import (
    CloudAccountSchema,
    CloudAccountCreate,
    CloudAccountUpdate,
    RegionSyncRequest,
    ConnectionTestResponse
)

router = APIRouter()

@router.get("", response_model=List[CloudAccountSchema])
def get_cloud_accounts(
    cloud: CloudProvider = Query(None),
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    query = db.query(CloudAccount)
    if cloud:
        query = query.filter(CloudAccount.cloud == cloud)
    return query.order_by(CloudAccount.id.desc()).all()

@router.post("", response_model=CloudAccountSchema)
def create_cloud_account(
    request: CloudAccountCreate,
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    # Check for duplicates
    existing = db.query(CloudAccount).filter(
        CloudAccount.account_identifier == request.account_identifier
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Account identifier already exists")
        
    new_account = CloudAccount(
        name=request.name,
        account_identifier=request.account_identifier,
        cloud=request.cloud,
        status=request.status
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    
    audit_log = AuditLog(
        user_id=current_admin.id,
        action="CREATE_CLOUD_ACCOUNT",
        entity_type="CLOUD_ACCOUNT",
        entity_id=str(new_account.id),
        details={"identifier": new_account.account_identifier, "cloud": new_account.cloud.value}
    )
    db.add(audit_log)
    db.commit()
    
    return new_account

@router.patch("/{account_id}", response_model=CloudAccountSchema)
def update_cloud_account(
    account_id: int,
    request: CloudAccountUpdate,
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    account = db.query(CloudAccount).filter(CloudAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Cloud account not found")
        
    if request.account_identifier and request.account_identifier != account.account_identifier:
        # Check for duplicate
        existing = db.query(CloudAccount).filter(
            CloudAccount.account_identifier == request.account_identifier
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Account identifier already exists")
    
    update_data = request.model_dump(exclude_unset=True)
    old_values = {}
    for key, value in update_data.items():
        old_values[key] = getattr(account, key)
        setattr(account, key, value)
        
    audit_log = AuditLog(
        user_id=current_admin.id,
        action="UPDATE_CLOUD_ACCOUNT",
        entity_type="CLOUD_ACCOUNT",
        entity_id=str(account.id),
        details={"changes": update_data, "old_values": old_values}
    )
    db.add(audit_log)
    db.commit()
    db.refresh(account)
    
    return account

@router.post("/{account_id}/regions", response_model=CloudAccountSchema)
def sync_cloud_regions(
    account_id: int,
    request: RegionSyncRequest,
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    account = db.query(CloudAccount).filter(CloudAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Cloud account not found")
        
    requested_regions = set(request.regions)
    existing_regions = {r.name: r for r in account.regions}
    
    # Enable or Add requested regions
    for r_name in requested_regions:
        if r_name in existing_regions:
            existing_regions[r_name].enabled = True
        else:
            new_region = CloudRegion(
                cloud_account_id=account.id,
                name=r_name,
                display_name=r_name,
                enabled=True
            )
            db.add(new_region)
            
    # Disable unrequested regions
    for r_name, region in existing_regions.items():
        if r_name not in requested_regions:
            region.enabled = False
            
    audit_log = AuditLog(
        user_id=current_admin.id,
        action="SYNC_CLOUD_REGIONS",
        entity_type="CLOUD_ACCOUNT",
        entity_id=str(account.id),
        details={"enabled_regions": list(requested_regions)}
    )
    db.add(audit_log)
    db.commit()
    db.refresh(account)
    
    return account

@router.post("/{account_id}/test-connection", response_model=ConnectionTestResponse)
def test_cloud_connection(
    account_id: int,
    current_admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    account = db.query(CloudAccount).filter(CloudAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Cloud account not found")
        
    # Stub response explicitly reporting requirements as requested
    return ConnectionTestResponse(
        success=False,
        message="Configuration saved successfully. Actual connection testing requires backend cloud environment credentials to be securely configured on the server."
    )

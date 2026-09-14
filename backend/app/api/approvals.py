from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List
from app.database import get_db
from app.models.user import User
from app.api.deps import get_current_user, get_admin_user
from app.models.tagging import TaggingBatch, TaggingChange, BatchStatus, ChangeStatus, Approval, ApprovalStatus
from app.models.resource import Resource
from app.models.cloud import CloudAccount
from app.schemas.tagging import BatchApprovalDetailSchema, ApprovalDecisionRequest, BatchResponseSchema

router = APIRouter()

@router.get("/batches/{batch_id}", response_model=BatchApprovalDetailSchema)
def get_batch_hierarchy(
    batch_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    batch = db.query(TaggingBatch).filter(TaggingBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    changes = db.query(TaggingChange, Resource, CloudAccount).join(
        Resource, TaggingChange.resource_id == Resource.id
    ).join(
        CloudAccount, Resource.cloud_account_id == CloudAccount.id
    ).filter(
        TaggingChange.batch_id == batch.id
    ).all()

    change_list = []
    for change, resource, account in changes:
        # For AWS, use location as the secondary hierarchy (Region), for Azure use resource_group
        rg_val = resource.location if batch.cloud == 'AWS' else resource.resource_group
        
        change_list.append({
            "id": change.id,
            "resource_id": resource.id,
            "account_name": account.name,
            "account_id_str": account.account_identifier,
            "resource_group": rg_val,
            "resource_type": resource.resource_type,
            "resource_name": resource.resource_name,
            "tag_key": change.tag_key,
            "previous_value": change.previous_value,
            "proposed_value": change.proposed_value,
            "status": change.status.value
        })

    submitted_user = db.query(User).filter(User.id == batch.created_by).first()
    submitted_by = submitted_user.email if submitted_user else "Unknown"

    return {
        "id": batch.id,
        "batch_id": batch.batch_id,
        "cloud": batch.cloud,
        "scope": batch.scope,
        "status": batch.status.value,
        "created_at": batch.created_at,
        "submitted_by": submitted_by,
        "changes": change_list
    }

@router.post("/batches/{batch_id}/decide")
def decide_batch_approval(
    batch_id: str,
    request: ApprovalDecisionRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    batch = db.query(TaggingBatch).filter(TaggingBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    if request.action not in ["APPROVE", "REJECT"]:
        raise HTTPException(status_code=400, detail="Invalid action")

    target_status = ChangeStatus.APPROVED if request.action == "APPROVE" else ChangeStatus.REJECTED

    # Build the filter for changes based on scope
    query = db.query(TaggingChange).join(Resource, TaggingChange.resource_id == Resource.id).join(CloudAccount, Resource.cloud_account_id == CloudAccount.id).filter(TaggingChange.batch_id == batch.id)

    if request.scope_type == "BATCH":
        pass # All changes in batch
    elif request.scope_type == "ACCOUNT":
        query = query.filter(CloudAccount.account_identifier == request.scope_value)
    elif request.scope_type == "RESOURCE_GROUP":
        query = query.filter(CloudAccount.account_identifier == request.account_id, Resource.resource_group == request.scope_value)
    elif request.scope_type == "REGION":
        query = query.filter(CloudAccount.account_identifier == request.account_id, Resource.location == request.scope_value)
    elif request.scope_type == "RESOURCE_TYPE":
        filters = [CloudAccount.account_identifier == request.account_id, Resource.resource_type == request.scope_value]
        if request.resource_group:
            filters.append(Resource.resource_group == request.resource_group)
        if request.region:
            filters.append(Resource.location == request.region)
        query = query.filter(and_(*filters))
    elif request.scope_type == "RESOURCE":
        query = query.filter(Resource.id == int(request.scope_value))
    elif request.scope_type == "CHANGE":
        query = query.filter(TaggingChange.id == int(request.scope_value))
    else:
        raise HTTPException(status_code=400, detail="Invalid scope type")

    changes = query.all()
    for change in changes:
        change.status = target_status
        if target_status == ChangeStatus.APPROVED:
            change.approved_value = change.proposed_value

    db.commit()

    # Recalculate parent batch status
    all_changes = db.query(TaggingChange).filter(TaggingChange.batch_id == batch.id).all()
    
    statuses = set([c.status for c in all_changes])
    
    if ChangeStatus.PENDING_APPROVAL in statuses or ChangeStatus.DRAFT in statuses:
        # Still pending items
        batch.status = BatchStatus.PENDING_APPROVAL
    elif len(statuses) == 1 and ChangeStatus.APPROVED in statuses:
        batch.status = BatchStatus.APPROVED
    elif len(statuses) == 1 and ChangeStatus.REJECTED in statuses:
        batch.status = BatchStatus.REJECTED
    else:
        batch.status = BatchStatus.PARTIALLY_APPROVED

    # Create an approval log record
    approval = Approval(
        batch_id=batch.id,
        submitted_by=batch.created_by,
        reviewed_by=admin.id,
        status=ApprovalStatus(batch.status.value),
        comments=f"{request.action} at scope {request.scope_type} = {request.scope_value}"
    )
    db.add(approval)
    db.commit()

    return {"status": batch.status.value, "updated_changes": len(changes)}

@router.get("/queue", response_model=List[BatchResponseSchema])
def get_approval_queue(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    batches = db.query(TaggingBatch, User).join(User, TaggingBatch.created_by == User.id).filter(
        TaggingBatch.status.in_([BatchStatus.PENDING_APPROVAL, BatchStatus.PARTIALLY_APPROVED])
    ).order_by(TaggingBatch.created_at.desc()).all()

    res = []
    for b, user in batches:
        res.append({
            "id": b.id,
            "batch_id": b.batch_id,
            "cloud": b.cloud,
            "scope": b.scope,
            "status": b.status.value,
            "created_at": b.created_at,
            "created_by_name": user.display_name or user.email,
            "resource_count": db.query(TaggingChange.resource_id).filter(TaggingChange.batch_id == b.id).distinct().count()
        })
    return res

@router.get("/approved", response_model=List[BatchResponseSchema])
def get_approved_work(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    batches = db.query(TaggingBatch, User).join(User, TaggingBatch.created_by == User.id).filter(
        TaggingBatch.status.in_([BatchStatus.APPROVED, BatchStatus.PARTIALLY_APPROVED, BatchStatus.ASSIGNED, BatchStatus.SCRIPT_GENERATED, BatchStatus.APPLIED, BatchStatus.VALIDATED])
    ).order_by(TaggingBatch.created_at.desc()).all()

    res = []
    for b, user in batches:
        res.append({
            "id": b.id,
            "batch_id": b.batch_id,
            "cloud": b.cloud,
            "scope": b.scope,
            "status": b.status.value,
            "created_at": b.created_at,
            "created_by_name": user.display_name or user.email,
            "resource_count": db.query(TaggingChange.resource_id).filter(TaggingChange.batch_id == b.id, TaggingChange.status == ChangeStatus.APPROVED).distinct().count()
        })
    return res

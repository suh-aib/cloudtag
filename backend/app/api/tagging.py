from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from uuid import uuid4
from app.models.cloud import CloudProvider, CloudAccount
from app.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.models.master_data import TagDefinition, TagValue, TagProvider
from app.models.assignment import TaskAssignment, TaskAssignmentResource, TaskAssignmentStatus
from app.models.tagging import TaggingBatch, TaggingChange, BatchStatus, ChangeStatus, Approval, ApprovalStatus
from app.models.resource import Resource
from app.schemas.tagging import (
    TagDefinitionSchema, 
    BulkTagRequestSchema, 
    BulkTagResponseSchema,
    BatchResponseSchema,
    PreviewResponseSchema,
    PreviewResourceChange,
    ScopeType
)
from fastapi import Query

router = APIRouter()

@router.get("/definitions", response_model=List[TagDefinitionSchema])
def get_tag_definitions(
    provider: Optional[CloudProvider] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TagDefinition).filter(TagDefinition.enabled == True)
    if provider:
        query = query.filter(
            or_(
                TagDefinition.provider == provider.value,
                TagDefinition.provider == TagProvider.SHARED
            )
        )

    return query.all()

def resolve_resources_for_scope(db: Session, request: BulkTagRequestSchema):
    query = db.query(Resource).filter(Resource.provider == request.provider)
    
    if request.scope_type in [ScopeType.SUBSCRIPTION, ScopeType.AWS_ACCOUNT]:
        if not request.account_id:
            raise HTTPException(status_code=400, detail="Account ID required for this scope")
        accounts = [acc.strip() for acc in request.account_id.split(',')]
        account_ids = db.query(CloudAccount.id).filter(CloudAccount.account_identifier.in_(accounts)).all()
        if not account_ids:
            raise HTTPException(status_code=404, detail="Account not found")
        query = query.filter(Resource.cloud_account_id.in_([a[0] for a in account_ids]))
    
    elif request.scope_type == ScopeType.RESOURCE_GROUP:
        if not request.account_id or not request.resource_group:
            raise HTTPException(status_code=400, detail="Account ID and Resource Group required")
        accounts = [acc.strip() for acc in request.account_id.split(',')]
        account_ids = db.query(CloudAccount.id).filter(CloudAccount.account_identifier.in_(accounts)).all()
        if not account_ids:
            raise HTTPException(status_code=404, detail="Account not found")
        rgs = [rg.strip() for rg in request.resource_group.split(',')]
        query = query.filter(Resource.cloud_account_id.in_([a[0] for a in account_ids]), Resource.resource_group.in_(rgs))
        
    elif request.scope_type == ScopeType.RESOURCE_TYPE:
        if not request.account_id or not request.resource_type:
            raise HTTPException(status_code=400, detail="Account ID and Resource Type required")
        accounts = [acc.strip() for acc in request.account_id.split(',')]
        account_ids = db.query(CloudAccount.id).filter(CloudAccount.account_identifier.in_(accounts)).all()
        if not account_ids:
            raise HTTPException(status_code=404, detail="Account not found")
        rts = [rt.strip() for rt in request.resource_type.split(',')]
        query = query.filter(Resource.cloud_account_id.in_([a[0] for a in account_ids]), Resource.resource_type.in_(rts))
        if request.resource_group:
            rgs = [rg.strip() for rg in request.resource_group.split(',')]
            query = query.filter(Resource.resource_group.in_(rgs))
        if request.region:
            regs = [r.strip() for r in request.region.split(',')]
            query = query.filter(Resource.location.in_(regs))
            
    elif request.scope_type == ScopeType.REGION:
        if not request.account_id or not request.region:
            raise HTTPException(status_code=400, detail="Account ID and Region required")
        accounts = [acc.strip() for acc in request.account_id.split(',')]
        account_ids = db.query(CloudAccount.id).filter(CloudAccount.account_identifier.in_(accounts)).all()
        if not account_ids:
            raise HTTPException(status_code=404, detail="Account not found")
        regs = [r.strip() for r in request.region.split(',')]
        query = query.filter(Resource.cloud_account_id.in_([a[0] for a in account_ids]), Resource.location.in_(regs))
            
    elif request.scope_type == ScopeType.RESOURCE_SELECTION:
        if not request.resource_ids:
            raise HTTPException(status_code=400, detail="Resource IDs required for selection scope")
        query = query.filter(Resource.id.in_(request.resource_ids))
        

    if getattr(request, 'task_id', None):
        query = query.join(
            TaskAssignmentResource,
            TaskAssignmentResource.resource_id == Resource.id
        ).filter(
            TaskAssignmentResource.assignment_id == request.task_id
        )
    return query.all()

def validate_tags(db: Session, provider: CloudProvider, proposed_tags: dict):
    active_defs = db.query(TagDefinition).filter(
        TagDefinition.enabled == True,
        or_(
            TagDefinition.provider == provider.value,
            TagDefinition.provider == TagProvider.SHARED
        )
    ).all()
    
    def_map = {d.name: d for d in active_defs}
    
    for k, v in proposed_tags.items():
        if k in def_map:
            allowed_values = [tv.value for tv in def_map[k].values if tv.enabled]
            if v not in allowed_values:
                raise HTTPException(status_code=400, detail=f"Invalid value '{v}' for tag '{k}'. Allowed values are: {', '.join(allowed_values)}")

@router.post("/preview", response_model=PreviewResponseSchema)
def preview_bulk_tagging(
    request: BulkTagRequestSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    if getattr(request, 'task_id', None):
        task = db.query(TaskAssignment).filter(TaskAssignment.id == request.task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")
        if task.assigned_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Unauthorized access to task resources.")
        if task.status != TaskAssignmentStatus.ACTIVE:
            raise HTTPException(status_code=400, detail="Task is not active.")
        if task.provider != request.provider:
            raise HTTPException(status_code=400, detail="Provider mismatch for this task.")
            
    resources = resolve_resources_for_scope(db, request)
    validate_tags(db, request.provider, request.tags)
    
    changes = []
    for r in resources:
        current_tags = r.cloud_tags or {}
        for k, v in request.tags.items():
            prev_value = current_tags.get(k, "NOT_SET")
            will_change = (prev_value != v)
            changes.append(PreviewResourceChange(
                resource_id=r.id,
                resource_name=r.resource_name,
                tag_key=k,
                current_value=prev_value,
                proposed_value=v,
                will_change=will_change,
                existing_tags=current_tags
            ))
            
    return PreviewResponseSchema(
        resource_count=len(resources),
        changes=changes
    )

@router.post("/bulk", response_model=BulkTagResponseSchema)
def create_bulk_tagging_proposal(
    request: BulkTagRequestSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not request.tags:
        raise HTTPException(status_code=400, detail="No tags proposed")


    if getattr(request, 'task_id', None):
        task = db.query(TaskAssignment).filter(TaskAssignment.id == request.task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")
        if task.assigned_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Unauthorized access to task resources.")
        if task.status != TaskAssignmentStatus.ACTIVE:
            raise HTTPException(status_code=400, detail="Task is not active.")
        if task.provider != request.provider:
            raise HTTPException(status_code=400, detail="Provider mismatch for this task.")
            
    resources = resolve_resources_for_scope(db, request)
    if not resources:
        raise HTTPException(status_code=404, detail="No resources found for the given scope")
        
    validate_tags(db, request.provider, request.tags)

    batch_uuid = str(uuid4())
    
    # Construct scope description
    scope_desc = f"{request.scope_type.value}"
    if request.account_id: scope_desc += f": {request.account_id}"
    if request.resource_group: scope_desc += f" / {request.resource_group}"
    
    requested_status = BatchStatus(request.status) if request.status else BatchStatus.PENDING_APPROVAL

    batch = TaggingBatch(
        batch_id=batch_uuid,
        created_by=current_user.id,
        cloud=request.provider,
        scope=scope_desc,
        status=requested_status,
        task_assignment_id=getattr(request, 'task_id', None)
    )
    db.add(batch)
    db.flush()

    change_status = ChangeStatus.DRAFT if requested_status == BatchStatus.DRAFT else ChangeStatus.PENDING_APPROVAL
    changes_created = 0
    for r in resources:
        current_tags = r.cloud_tags or {}
        for k, v in request.tags.items():
            prev_value = current_tags.get(k, "NOT_SET")
            if prev_value != v:
                change = TaggingChange(
                    batch_id=batch.id,
                    resource_id=r.id,
                    tag_key=k,
                    previous_value=prev_value,
                    proposed_value=v,
                    status=change_status
                )
                db.add(change)
                changes_created += 1
                
    if changes_created == 0:
        raise HTTPException(status_code=400, detail="No actual changes required. Existing tags already match proposed tags.")
                
    if requested_status == BatchStatus.PENDING_APPROVAL:
        approval = Approval(
            batch_id=batch.id,
            submitted_by=current_user.id,
            status=ApprovalStatus.PENDING_APPROVAL
        )
        db.add(approval)
    
    db.commit()
    
    return BulkTagResponseSchema(
        batch_id=batch.batch_id,
        status=batch.status.value
    )

@router.get("/batches", response_model=List[BatchResponseSchema])
def get_batches(
    status: Optional[BatchStatus] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TaggingBatch).filter(TaggingBatch.created_by == current_user.id)
    if status:
        query = query.filter(TaggingBatch.status == status)
    batches = query.order_by(TaggingBatch.created_at.desc()).all()
    res = []
    for b in batches:
        res.append({
            "id": b.id,
            "batch_id": b.batch_id,
            "cloud": b.cloud,
            "scope": b.scope,
            "status": b.status.value,
            "created_at": b.created_at,
            "created_by_name": current_user.display_name or current_user.email,
            "resource_count": db.query(TaggingChange.resource_id).filter(TaggingChange.batch_id == b.id).distinct().count()
        })
    return res

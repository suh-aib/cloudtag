from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List
from sqlalchemy.exc import IntegrityError
import time

from app.database import get_db
from app.api.deps import get_current_user, get_admin_user
from app.models.user import User
from app.models.tagging import TaggingChange, TaggingBatch, ChangeStatus
from sqlalchemy import func
from app.models.assignment import TaskAssignment, TaskAssignmentResource, TaskAssignmentStatus
from app.models.resource import Resource
from app.models.cloud import CloudProvider, CloudAccount, CloudRegion
from app.schemas.assignment import CreateAssignmentPayload, TaskAssignmentResponse, UserTagProgressResponse

router = APIRouter()

def generate_task_number(db: Session) -> str:
    max_id = db.query(func.max(TaskAssignment.id)).scalar() or 0
    return f"CT-{(max_id + 1):03d}"

def resolve_resources_for_payload(db: Session, payload: CreateAssignmentPayload):
    query = db.query(Resource).filter(Resource.provider == payload.provider)
    
    if payload.scope_type == "SUBSCRIPTION" or payload.scope_type == "ACCOUNT":
        if not payload.subscription_id and not payload.account_id:
            raise HTTPException(status_code=400, detail="Subscription/Account ID required for this scope.")
        acc_id = payload.subscription_id or payload.account_id
        acc = db.query(CloudAccount).filter(CloudAccount.account_identifier == acc_id).first()
        if not acc:
            acc = db.query(CloudAccount).filter(CloudAccount.name == acc_id).first()
        if acc:
            query = query.filter(Resource.cloud_account_id == acc.id)
        else:
            try:
                query = query.filter(Resource.cloud_account_id == int(acc_id))
            except ValueError:
                pass
                
    elif payload.scope_type == "REGION":
        if not payload.region_id:
            raise HTTPException(status_code=400, detail="Region ID required.")
        reg = db.query(CloudRegion).filter(or_(CloudRegion.name == payload.region_id, CloudRegion.display_name == payload.region_id)).first()
        if reg:
            query = query.filter(Resource.region_id == reg.id)
            
    elif payload.scope_type == "RESOURCE_GROUP":
        if not payload.resource_group:
            raise HTTPException(status_code=400, detail="Resource Group required.")
        query = query.filter(Resource.resource_group == payload.resource_group)
        
    elif payload.scope_type == "RESOURCE_TYPE":
        if not payload.resource_type:
            raise HTTPException(status_code=400, detail="Resource Type required.")
        query = query.filter(Resource.resource_type == payload.resource_type)
        
    elif payload.scope_type == "RESOURCE_SELECTION":
        if not payload.resource_ids:
            raise HTTPException(status_code=400, detail="Resource IDs required.")
        query = query.filter(Resource.resource_id.in_(payload.resource_ids))
    else:
        raise HTTPException(status_code=400, detail="Unknown scope type.")

    resources = query.all()
    return resources

@router.post("/task-assignments/preview")
def preview_task_assignment(
    payload: CreateAssignmentPayload,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    resources = resolve_resources_for_payload(db, payload)
    
    target_resource_ids = [r.id for r in resources]
    
    overlap_exists = db.query(TaskAssignmentResource).join(TaskAssignment).filter(
        TaskAssignment.assigned_user_id == payload.assigned_user_id,
        TaskAssignment.status == TaskAssignmentStatus.ACTIVE,
        TaskAssignmentResource.resource_id.in_(target_resource_ids)
    ).first()

    return {
        "resource_count": len(resources),
        "is_valid": len(resources) > 0 and not overlap_exists,
        "conflict": overlap_exists is not None,
        "message": "This resource is already included in an active assignment for this user." if overlap_exists else "Preview successful."
    }

@router.post("/task-assignments", response_model=TaskAssignmentResponse)
def create_task_assignment(
    payload: CreateAssignmentPayload,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    resources = resolve_resources_for_payload(db, payload)
    if not resources:
        raise HTTPException(status_code=400, detail="No matching resources found for this scope.")

    target_resource_ids = [r.id for r in resources]

    # Check overlaps with locking (or simply checking first then inserting, rely on constraint)
    # The requirement: "The same resource cannot exist in multiple ACTIVE assignments for the SAME user."
    overlap_exists = db.query(TaskAssignmentResource).join(TaskAssignment).filter(
        TaskAssignment.assigned_user_id == payload.assigned_user_id,
        TaskAssignment.status == TaskAssignmentStatus.ACTIVE,
        TaskAssignmentResource.resource_id.in_(target_resource_ids)
    ).first()

    if overlap_exists:
        raise HTTPException(status_code=400, detail="This resource is already included in an active assignment for this user.")

    # Create task
    for attempt in range(3):
        try:
            task_number = generate_task_number(db)
            # In a highly concurrent env, this could clash, we rely on IntegrityError retry
            
            task = TaskAssignment(
                task_number=task_number,
                provider=payload.provider,
                scope_type=payload.scope_type,
                assigned_user_id=payload.assigned_user_id,
                assigned_by_user_id=current_user.id,
                subscription_id=payload.subscription_id,
                account_id=payload.account_id,
                region_id=payload.region_id,
                resource_group=payload.resource_group,
                resource_type=payload.resource_type,
                status=TaskAssignmentStatus.ACTIVE
            )
            db.add(task)
            db.flush() # get task.id
            
            # Create resources
            for r in resources:
                tar = TaskAssignmentResource(
                    assignment_id=task.id,
                    resource_id=r.id,
                    resource_id_hash=r.resource_id_hash
                )
                db.add(tar)
                
            db.commit()
            db.refresh(task)
            
            # Attach computed fields for response
            resp = TaskAssignmentResponse.model_validate(task)
            resp.resource_count = len(resources)
            resp.completed_resources = 0
            
            return resp
            
        except IntegrityError as e:
            db.rollback()
            if "task_number" in str(e).lower() or "uq_" in str(e).lower():
                time.sleep(0.1)
                continue
            else:
                # E.g. resource assigned concurrently caught by constraint? Wait, we don't have a partial index constraint.
                raise HTTPException(status_code=400, detail="Concurrency conflict creating assignment.")
                
    raise HTTPException(status_code=500, detail="Failed to generate unique task number.")


@router.get("/task-assignments", response_model=List[TaskAssignmentResponse])
def get_task_assignments(
    user_id: int = Query(None),
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    query = db.query(TaskAssignment)
    if user_id:
        query = query.filter(TaskAssignment.assigned_user_id == user_id)
        
    tasks = query.order_by(TaskAssignment.created_at.desc()).all()
    
    
    # Get all users for quick lookup
    users_db = db.query(User).all()
    user_map_cache = {u.id: u.display_name or u.email for u in users_db}
    
    results = []
    for t in tasks:

        r = TaskAssignmentResponse.model_validate(t)
        r.assigned_user_name = user_map_cache.get(t.assigned_user_id, f"User {t.assigned_user_id}")
        # Subquery for count
        res_count = db.query(TaskAssignmentResource).filter(TaskAssignmentResource.assignment_id == t.id).count()
        r.resource_count = res_count
        completed_count = db.query(func.count(func.distinct(TaggingChange.resource_id))).join(
            TaggingBatch, TaggingChange.batch_id == TaggingBatch.id
        ).filter(
            TaggingBatch.task_assignment_id == t.id,
            TaggingChange.status != ChangeStatus.REJECTED
        ).scalar() or 0
        r.completed_resources = completed_count
        
        if completed_count == res_count and res_count > 0 and t.status != TaskAssignmentStatus.COMPLETED:
            t.status = TaskAssignmentStatus.COMPLETED
            db.commit()
        elif completed_count < res_count and t.status == TaskAssignmentStatus.COMPLETED:
            t.status = TaskAssignmentStatus.ACTIVE
            db.commit()

        results.append(r)
    return results

@router.get("/user-tag-progress", response_model=List[UserTagProgressResponse])
def get_user_tag_progress(
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    # Aggregate progress across all users with active/completed tasks
    users = db.query(User).all()
    
    tasks = db.query(TaskAssignment).all()
    
    user_map = {}
    for u in users:
        user_map[u.id] = {
            "user_id": u.id,
            "user_name": u.display_name or u.email,
            "user_email": u.email,
            "task_count": 0,
            "total_resources": 0,
            "completed_resources": 0,
        }
        
    # Get all resources for tasks
    resources_query = db.query(
        TaskAssignmentResource.assignment_id,
        func.count(TaskAssignmentResource.id).label("res_count")
    ).group_by(TaskAssignmentResource.assignment_id).all()
    
    res_map = {r.assignment_id: r.res_count for r in resources_query}
    
    for t in tasks:
        if t.assigned_user_id in user_map:
            u_entry = user_map[t.assigned_user_id]
            u_entry["task_count"] += 1
            res_count = res_map.get(t.id, 0)
            u_entry["total_resources"] += res_count
            
            completed_count = db.query(func.count(func.distinct(TaggingChange.resource_id))).join(
                TaggingBatch, TaggingChange.batch_id == TaggingBatch.id
            ).filter(
                TaggingBatch.task_assignment_id == t.id,
                TaggingChange.status != ChangeStatus.REJECTED
            ).scalar() or 0
            u_entry["completed_resources"] += completed_count
            
            if completed_count == res_count and res_count > 0 and t.status != TaskAssignmentStatus.COMPLETED:
                t.status = TaskAssignmentStatus.COMPLETED
                db.commit()
            elif completed_count < res_count and t.status == TaskAssignmentStatus.COMPLETED:
                t.status = TaskAssignmentStatus.ACTIVE
                db.commit()
            
    # Filter users with > 0 tasks
    active_users = [u for u in user_map.values() if u["task_count"] > 0]
    
    results = []
    for u in active_users:
        pending = u["total_resources"] - u["completed_resources"]
        pct = int(round((u["completed_resources"] / u["total_resources"]) * 100)) if u["total_resources"] > 0 else 0
        results.append(UserTagProgressResponse(
            **u,
            pending_resources=pending,
            progress_percentage=pct
        ))
        
    # Sort by progress desc, then name
    results.sort(key=lambda x: (-x.progress_percentage, x.user_name))
    return results

@router.get("/user-tag-progress/{user_id}")
def get_admin_user_detail(
    user_id: int,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")
        
    tasks = db.query(TaskAssignment).filter(TaskAssignment.assigned_user_id == user_id).all()
    
    total_resources = 0
    completed_resources = 0
    
    task_responses = []
    for t in tasks:
        r = TaskAssignmentResponse.model_validate(t)
        r.assigned_user_name = u.display_name or u.email
        res_count = db.query(TaskAssignmentResource).filter(TaskAssignmentResource.assignment_id == t.id).count()
        r.resource_count = res_count
        completed_count = db.query(func.count(func.distinct(TaggingChange.resource_id))).join(
            TaggingBatch, TaggingChange.batch_id == TaggingBatch.id
        ).filter(
            TaggingBatch.task_assignment_id == t.id,
            TaggingChange.status != ChangeStatus.REJECTED
        ).scalar() or 0
        r.completed_resources = completed_count
        
        if completed_count == res_count and res_count > 0 and t.status != TaskAssignmentStatus.COMPLETED:
            t.status = TaskAssignmentStatus.COMPLETED
            db.commit()
        elif completed_count < res_count and t.status == TaskAssignmentStatus.COMPLETED:
            t.status = TaskAssignmentStatus.ACTIVE
            db.commit()

        task_responses.append(r)
        
        total_resources += res_count
        
    return {
        "user_id": u.id,
        "user_name": u.display_name or u.email,
        "total_tasks": len(tasks),
        "total_assigned_resources": total_resources,
        "completed": 0,
        "pending": total_resources,
        "progress": 0,
        "tasks": task_responses
    }

@router.get("/task-assignments/{task_id}")
def get_admin_task_detail(
    task_id: int,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    t = db.query(TaskAssignment).filter(TaskAssignment.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found.")
        
    
    u = db.query(User).filter(User.id == t.assigned_user_id).first()
    r = TaskAssignmentResponse.model_validate(t)
    r.assigned_user_name = u.display_name or u.email if u else "Unknown"
    
    # Get resources
    resources = db.query(Resource).join(
        TaskAssignmentResource, 
        TaskAssignmentResource.resource_id == Resource.id
    ).filter(
        TaskAssignmentResource.assignment_id == t.id
    ).all()
    
    r.resource_count = len(resources)
    r.completed_resources = 0
    
    res_list = []
    for res in resources:
        res_list.append({
            "id": res.id,
            "canonical_id": res.resource_id,
            "resource_group": res.resource_group,
            "resource_type": res.resource_type,
            "resource_name": res.resource_name,
            "location": res.location,
            "status": "Pending" # Mocking status correctly
        })
        
    # Also fetch user info
    u = db.query(User).filter(User.id == t.assigned_user_id).first()
        
    return {
        "task": r,
        "user_name": u.display_name or u.email if u else "Unknown",
        "resources": res_list
    }

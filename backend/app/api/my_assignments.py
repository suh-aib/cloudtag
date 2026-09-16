from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.tagging import TaggingChange, TaggingBatch, ChangeStatus
from sqlalchemy import func
from app.models.assignment import TaskAssignment, TaskAssignmentResource, TaskAssignmentStatus
from app.models.resource import Resource
from app.schemas.assignment import TaskAssignmentResponse

router = APIRouter()

@router.get("/tasks", response_model=List[TaskAssignmentResponse])
def get_my_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tasks = db.query(TaskAssignment).filter(
        TaskAssignment.assigned_user_id == current_user.id
    ).order_by(TaskAssignment.created_at.desc()).all()
    
    results = []
    for t in tasks:
        r = TaskAssignmentResponse.model_validate(t)
        r.assigned_user_name = current_user.display_name or current_user.email
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

@router.get("/tagging-progress")
def get_my_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tasks = db.query(TaskAssignment).filter(
        TaskAssignment.assigned_user_id == current_user.id
    ).all()
    
    total_resources = 0
    task_responses = []
    
    for t in tasks:
        r = TaskAssignmentResponse.model_validate(t)
        r.assigned_user_name = current_user.display_name or current_user.email
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
        "total_tasks": len(tasks),
        "total_assigned_resources": total_resources,
        "completed": 0,
        "pending": total_resources,
        "progress": 0,
        "tasks": task_responses
    }

@router.get("/tasks/{task_id}")
def get_my_task_detail(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    t = db.query(TaskAssignment).filter(TaskAssignment.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found.")
        
    if t.assigned_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized to view this task.")
        
    r = TaskAssignmentResponse.model_validate(t)
    r.assigned_user_name = current_user.display_name or current_user.email
    
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
            "status": "Pending"
        })
        
    return {
        "task": r,
        "user_name": current_user.display_name or current_user.email,
        "resources": res_list
    }

import re

# 1. Update Schema
with open("app/schemas/tagging.py", "r") as f:
    schema_content = f.read()
if "task_id: Optional[int] = None" not in schema_content:
    schema_content = schema_content.replace(
        "tags: Dict[str, str]",
        "tags: Dict[str, str]\n    task_id: Optional[int] = None"
    )
    with open("app/schemas/tagging.py", "w") as f:
        f.write(schema_content)

# 2. Update API
with open("app/api/tagging.py", "r") as f:
    api_content = f.read()

if "from app.models.assignment import TaskAssignment" not in api_content:
    api_content = api_content.replace(
        "from app.models.tagging import TaggingBatch",
        "from app.models.assignment import TaskAssignment, TaskAssignmentResource, TaskAssignmentStatus\nfrom app.models.tagging import TaggingBatch"
    )

if "if getattr(request, 'task_id', None):" not in api_content:
    # Update resolve_resources_for_scope
    resolve_func_end = "    return query.all()\n"
    resolve_func_patch = """
    if getattr(request, 'task_id', None):
        query = query.join(
            TaskAssignmentResource,
            TaskAssignmentResource.resource_id == Resource.id
        ).filter(
            TaskAssignmentResource.assignment_id == request.task_id
        )
    return query.all()
"""
    api_content = api_content.replace(resolve_func_end, resolve_func_patch)

if "def preview_bulk_tagging(" in api_content and "if request.task_id:" not in api_content:
    task_validation = """
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
            
    resources = resolve_resources_for_scope(db, request)"""
    
    api_content = api_content.replace("    resources = resolve_resources_for_scope(db, request)", task_validation)

if "task_assignment_id=" not in api_content:
    api_content = api_content.replace(
        "status=requested_status\n    )",
        "status=requested_status,\n        task_assignment_id=getattr(request, 'task_id', None)\n    )"
    )

with open("app/api/tagging.py", "w") as f:
    f.write(api_content)
    
print("Patched tagging schema and API")

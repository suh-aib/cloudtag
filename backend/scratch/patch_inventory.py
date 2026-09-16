import re

with open("app/api/inventory.py", "r") as f:
    content = f.read()

# Add imports
if "TaskAssignment" not in content:
    content = content.replace("from app.models.resource import Resource, TaggingScope, Billability",
                              "from app.models.resource import Resource, TaggingScope, Billability\nfrom app.models.assignment import TaskAssignment, TaskAssignmentResource, TaskAssignmentStatus")

# Add apply_task_filter
task_filter_code = """
def apply_task_filter(query, db: Session, task_id: int, current_user: User, provider: CloudProvider):
    task = db.query(TaskAssignment).filter(TaskAssignment.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    if task.assigned_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized access to task resources.")
    if task.status != TaskAssignmentStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Task is not active.")
    if task.provider != provider:
        raise HTTPException(status_code=400, detail="Provider mismatch for this task.")
        
    return query.join(
        TaskAssignmentResource,
        TaskAssignmentResource.resource_id == Resource.id
    ).filter(
        TaskAssignmentResource.assignment_id == task_id
    )
"""

if "def apply_task_filter" not in content:
    content = content.replace("def apply_account_search", task_filter_code + "\ndef apply_account_search")

# Regex to patch each function
def patch_endpoint(content, func_name, provider_str, query_var_name):
    # Add task_id to signature
    sig_pattern = re.compile(r"(def " + func_name + r"\([\s\S]*?)(current_user: User = Depends\(get_current_user\))")
    content = sig_pattern.sub(r"\1task_id: Optional[int] = Query(None),\n    \2", content)
    
    # Add apply_task_filter call
    filter_pattern = re.compile(r"(" + query_var_name + r" = apply_inventory_filters\(" + query_var_name + r"[\s\S]*?\n)")
    replacement = r"\1    if task_id:\n        " + query_var_name + r" = apply_task_filter(" + query_var_name + r", db, task_id, current_user, " + provider_str + r")\n"
    content = filter_pattern.sub(replacement, content)
    return content

content = patch_endpoint(content, "get_provider_accounts", "provider_enum", "base_query")
content = patch_endpoint(content, "get_azure_resource_groups", "CloudProvider.AZURE", "base_query")
content = patch_endpoint(content, "get_azure_resource_types", "CloudProvider.AZURE", "base_query")
content = patch_endpoint(content, "get_azure_resources", "CloudProvider.AZURE", "query")

content = patch_endpoint(content, "get_aws_regions", "CloudProvider.AWS", "base_query")
content = patch_endpoint(content, "get_aws_resource_types", "CloudProvider.AWS", "base_query")
content = patch_endpoint(content, "get_aws_resources", "CloudProvider.AWS", "query")

with open("app/api/inventory.py", "w") as f:
    f.write(content)

print("Patched inventory.py")

import re

files_to_patch = ["app/api/my_assignments.py", "app/api/admin_assignments.py"]

progress_logic = """
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
"""

for file_path in files_to_patch:
    with open(file_path, "r") as f:
        content = f.read()
        
    if "from app.models.tagging import TaggingChange" not in content:
        content = content.replace("from app.models.assignment import", "from app.models.tagging import TaggingChange, TaggingBatch, ChangeStatus\nfrom sqlalchemy import func\nfrom app.models.assignment import")
        
    # Find patterns where r.completed_resources = 0 is set alongside res_count calculation
    # In my_assignments: r.resource_count = res_count \n r.completed_resources = 0
    # or db.query(TaskAssignmentResource).filter(...).count()
    
    # We replace:
    # r.resource_count = db.query(TaskAssignmentResource).filter(TaskAssignmentResource.assignment_id == t.id).count()
    # r.completed_resources = 0
    # With: res_count = ... \n r.resource_count = res_count \n progress_logic
    
    pattern1 = re.compile(r"r\.resource_count = db\.query\(TaskAssignmentResource\)\.filter\(TaskAssignmentResource\.assignment_id == t\.id\)\.count\(\)\n\s+r\.completed_resources = 0")
    replacement1 = r"res_count = db.query(TaskAssignmentResource).filter(TaskAssignmentResource.assignment_id == t.id).count()\n        r.resource_count = res_count" + progress_logic
    content = pattern1.sub(replacement1, content)
    
    # Also find:
    # res_count = db.query(TaskAssignmentResource).filter(TaskAssignmentResource.assignment_id == t.id).count()
    # r.resource_count = res_count
    # r.completed_resources = 0
    pattern2 = re.compile(r"r\.resource_count = res_count\n\s+r\.completed_resources = 0")
    replacement2 = r"r.resource_count = res_count" + progress_logic
    content = pattern2.sub(replacement2, content)
    
    with open(file_path, "w") as f:
        f.write(content)

print("Patched progress logic")

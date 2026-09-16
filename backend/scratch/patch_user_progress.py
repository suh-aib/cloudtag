with open("app/api/admin_assignments.py", "r") as f:
    content = f.read()

# get_user_tag_progress logic patch
old_progress_logic = """
    for t in tasks:
        if t.assigned_user_id in user_map:
            u_entry = user_map[t.assigned_user_id]
            u_entry["task_count"] += 1
            u_entry["total_resources"] += res_map.get(t.id, 0)
            # Progress is 0 as per requirements for now
"""

new_progress_logic = """
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
"""

if "u_entry[\"completed_resources\"] += completed_count" not in content:
    content = content.replace(old_progress_logic, new_progress_logic)
    with open("app/api/admin_assignments.py", "w") as f:
        f.write(content)
        
print("Patched get_user_tag_progress")

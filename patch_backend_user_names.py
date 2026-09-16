import re

# 1. Update admin_assignments.py
with open("backend/app/api/admin_assignments.py", "r") as f:
    admin_content = f.read()

# For get_task_assignments
if "user_map_cache =" not in admin_content:
    replace_str = """
    # Get all users for quick lookup
    users_db = db.query(User).all()
    user_map_cache = {u.id: u.display_name or u.email for u in users_db}
    
    results = []
    for t in tasks:
"""
    admin_content = admin_content.replace(
        "results = []\n    for t in tasks:",
        replace_str
    )
    admin_content = admin_content.replace(
        "r = TaskAssignmentResponse.model_validate(t)",
        "r = TaskAssignmentResponse.model_validate(t)\n        r.assigned_user_name = user_map_cache.get(t.assigned_user_id, f'User {t.assigned_user_id}')"
    )

with open("backend/app/api/admin_assignments.py", "w") as f:
    f.write(admin_content)

# 2. Update my_assignments.py
with open("backend/app/api/my_assignments.py", "r") as f:
    my_content = f.read()

# For get_my_tasks
if "r.assigned_user_name = current_user.display_name" not in my_content:
    my_content = my_content.replace(
        "r = TaskAssignmentResponse.model_validate(t)",
        "r = TaskAssignmentResponse.model_validate(t)\n        r.assigned_user_name = current_user.display_name or current_user.email"
    )

with open("backend/app/api/my_assignments.py", "w") as f:
    f.write(my_content)

print("Backend user names patched")

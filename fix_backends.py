import re

# FIX admin_assignments.py
with open("backend/app/api/admin_assignments.py", "r") as f:
    admin_content = f.read()

# For get_admin_user_detail, user_map_cache is not defined. We can just query it or pass u.display_name
# Wait, let's just restore original first.
admin_content = admin_content.replace(
    "r = TaskAssignmentResponse.model_validate(t)\n        r.assigned_user_name = user_map_cache.get(t.assigned_user_id, f'User {t.assigned_user_id}')",
    "r = TaskAssignmentResponse.model_validate(t)"
)
# Re-apply correctly for get_task_assignments
admin_content = re.sub(
    r'(for t in tasks:\n\s+r = TaskAssignmentResponse.model_validate\(t\))',
    r'\1\n        r.assigned_user_name = user_map_cache.get(t.assigned_user_id, f"User {t.assigned_user_id}")',
    admin_content,
    count=1
)
# For get_admin_user_detail, the user is already `u`
admin_content = re.sub(
    r'(get_admin_user_detail[\s\S]*?for t in tasks:\n\s+r = TaskAssignmentResponse.model_validate\(t\))',
    r'\1\n        r.assigned_user_name = u.display_name or u.email',
    admin_content,
    count=1
)
# For get_admin_task_detail, user is fetched later as `u`, let's just fetch it before.
admin_content = re.sub(
    r'(get_admin_task_detail[\s\S]*?)r = TaskAssignmentResponse.model_validate\(t\)',
    r'\1\n    u = db.query(User).filter(User.id == t.assigned_user_id).first()\n    r = TaskAssignmentResponse.model_validate(t)\n    r.assigned_user_name = u.display_name or u.email if u else "Unknown"',
    admin_content,
    count=1
)

with open("backend/app/api/admin_assignments.py", "w") as f:
    f.write(admin_content)

# FIX my_assignments.py
with open("backend/app/api/my_assignments.py", "r") as f:
    my_content = f.read()

my_content = my_content.replace(
    "r = TaskAssignmentResponse.model_validate(t)\n        r.assigned_user_name = current_user.display_name or current_user.email",
    "r = TaskAssignmentResponse.model_validate(t)"
)
# Fix indentation by using re.sub
my_content = re.sub(
    r'(for t in tasks:\n\s+r = TaskAssignmentResponse.model_validate\(t\))',
    r'\1\n        r.assigned_user_name = current_user.display_name or current_user.email',
    my_content,
    count=2 # get_my_tasks and get_my_progress
)
my_content = re.sub(
    r'(get_my_task_detail[\s\S]*?)r = TaskAssignmentResponse.model_validate\(t\)',
    r'\1r = TaskAssignmentResponse.model_validate(t)\n    r.assigned_user_name = current_user.display_name or current_user.email',
    my_content,
    count=1
)

with open("backend/app/api/my_assignments.py", "w") as f:
    f.write(my_content)

print("Fixed syntax errors")

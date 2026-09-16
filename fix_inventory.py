import re

with open("backend/app/api/inventory.py", "r") as f:
    content = f.read()

# For get_provider_accounts
content = re.sub(
    r'(if task_id:\n\s+base_query = apply_task_filter.*?provider_enum\))',
    r'if task_id:\n        base_query = apply_task_filter(base_query, db, task_id, current_user, provider_enum)',
    content, flags=re.DOTALL
)

# For get_azure_resource_groups
content = re.sub(
    r'(base_query = apply_inventory_filters\(base_query, search=search, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope\)\n)(\s*if task_id:.*?)(    results = base_query\.group_by\()',
    r'\1    if task_id:\n        base_query = apply_task_filter(base_query, db, task_id, current_user, CloudProvider.AZURE)\n\3',
    content, flags=re.DOTALL
)

# For get_azure_resource_types
content = re.sub(
    r'(base_query = apply_inventory_filters\(base_query, search=search, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope\)\n)(\s*if task_id:.*?)(    results = base_query\.group_by\()',
    r'\1    if task_id:\n        base_query = apply_task_filter(base_query, db, task_id, current_user, CloudProvider.AZURE)\n\3',
    content, flags=re.DOTALL
)

# For get_aws_regions
content = re.sub(
    r'(base_query = apply_inventory_filters\(base_query, search=search, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope\)\n)(\s*if task_id:.*?)(    results = base_query\.group_by\()',
    r'\1    if task_id:\n        base_query = apply_task_filter(base_query, db, task_id, current_user, CloudProvider.AWS)\n\3',
    content, flags=re.DOTALL
)

# For get_aws_resource_types
content = re.sub(
    r'(base_query = apply_inventory_filters\(base_query, search=search, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope\)\n)(\s*if task_id:.*?)(    results = base_query\.group_by\()',
    r'\1    if task_id:\n        base_query = apply_task_filter(base_query, db, task_id, current_user, CloudProvider.AWS)\n\3',
    content, flags=re.DOTALL
)

# For get_azure_resources
content = re.sub(
    r'(query = apply_inventory_filters\(query, search=search, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope, resource_type=type\)\n)(\s*if task_id:.*?)(    resources = query\.all\(\))',
    r'\1    if task_id:\n        query = apply_task_filter(query, db, task_id, current_user, CloudProvider.AZURE)\n\3',
    content, flags=re.DOTALL
)

# For get_aws_resources
content = re.sub(
    r'(query = apply_inventory_filters\(query, search=search, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope, resource_type=type\)\n)(\s*if task_id:.*?)(    resources = query\.all\(\))',
    r'\1    if task_id:\n        query = apply_task_filter(query, db, task_id, current_user, CloudProvider.AWS)\n\3',
    content, flags=re.DOTALL
)


# Fix get_provider_accounts manually if the first regex didn't catch it
# It looks like:
#     base_query = apply_inventory_filters(base_query, search=None, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope)
#     if task_id:
#         base_query = apply_task_filter(base_query, db, task_id, current_user, CloudProvider.AWS)
#     if task_id:
#         ...
#     # Apply Account search
content = re.sub(
    r'(base_query = apply_inventory_filters\(base_query, search=None, billable_only=billable_only, billability=billability, tagging_scope=tagging_scope\)\n)(\s*if task_id:.*?)(    # Apply Account search)',
    r'\1    if task_id:\n        base_query = apply_task_filter(base_query, db, task_id, current_user, provider_enum)\n\3',
    content, flags=re.DOTALL
)

with open("backend/app/api/inventory.py", "w") as f:
    f.write(content)

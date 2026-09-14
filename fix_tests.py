import re

with open("backend/tests/test_approvals_api.py", "r") as f:
    content = f.read()

# Add resource_id="res-..." to the Resource instantiations
content = re.sub(r'Resource\(id=(\d+), cloud_account_id', r'Resource(id=\1, resource_id="res-\1", cloud_account_id', content)

with open("backend/tests/test_approvals_api.py", "w") as f:
    f.write(content)

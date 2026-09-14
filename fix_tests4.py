import re
with open("backend/tests/test_approvals_api.py", "r") as f:
    content = f.read()

# Fix CloudAccount kwargs
content = content.replace('provider=CloudProvider', 'cloud=CloudProvider')
content = content.replace(', account_id="sub-1"', '')
content = content.replace(', account_id="acc-1"', '')
content = content.replace(', account_id="acc-2"', '')

with open("backend/tests/test_approvals_api.py", "w") as f:
    f.write(content)

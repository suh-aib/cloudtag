import re

with open("backend/tests/test_approvals_api.py", "r") as f:
    content = f.read()

# Fix CloudAccount kwargs
content = re.sub(r'account_id="[^"]+", ', '', content)

# Fix test_db.refresh issue by querying the object afresh
content = re.sub(r'test_db\.refresh\((tc\d+)\)', r'\1 = test_db.query(TaggingChange).filter(TaggingChange.id == \1.id).first()', content)

with open("backend/tests/test_approvals_api.py", "w") as f:
    f.write(content)

import re
with open("backend/tests/test_approvals_api.py", "r") as f:
    content = f.read()

# Replace query by TaggingChange.id with query by TaggingChange.resource_id
content = re.sub(r'tc(\d+) = test_db\.query\(TaggingChange\)\.filter\(TaggingChange\.id == \d+\)\.first\(\)',
                 r'tc\1 = test_db.query(TaggingChange).filter(TaggingChange.resource_id == res\1.id).first()', content)

with open("backend/tests/test_approvals_api.py", "w") as f:
    f.write(content)

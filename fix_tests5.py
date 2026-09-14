import re
with open("backend/tests/test_approvals_api.py", "r") as f:
    content = f.read()

# Replace all test_db.query with correct retrieval
content = re.sub(r'tc(\d+) = test_db\.query\(TaggingChange\)\.filter\(TaggingChange\.id == tc\1\.id\)\.first\(\)',
                 r'tc\1 = test_db.query(TaggingChange).filter(TaggingChange.id == \1).first()', content)

with open("backend/tests/test_approvals_api.py", "w") as f:
    f.write(content)

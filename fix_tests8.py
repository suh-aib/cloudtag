import re
with open("backend/tests/test_approvals_api.py", "r") as f:
    content = f.read()

# Replace test querying logic with robust retrieval
content = re.sub(r'tc(\d+) = test_db\.query\(TaggingChange\).*', r'tc\1 = test_db.query(TaggingChange).filter(TaggingChange.proposed_value == ("PROD" if \1 in ["1","3","5","6"] else "DEV")).first()', content)

with open("backend/tests/test_approvals_api.py", "w") as f:
    f.write(content)

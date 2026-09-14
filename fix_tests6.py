import re
with open("backend/tests/test_approvals_api.py", "r") as f:
    lines = f.readlines()

out = []
for line in lines:
    if line.strip().startswith("tc") and "test_db.query" in line:
        match = re.search(r'tc(\d+) = test_db\.query.*\.id == tc(\d+)\.id', line)
        if match:
            n = match.group(1)
            line = f"    tc{n} = test_db.query(TaggingChange).filter(TaggingChange.id == {n}).first()\n"
        match2 = re.search(r'tc(\d+) = test_db\.query.*\.id == (\d+)', line)
        if match2:
            n = match2.group(1)
            line = f"    tc{n} = test_db.query(TaggingChange).filter(TaggingChange.id == {n}).first()\n"
            
    out.append(line)

with open("backend/tests/test_approvals_api.py", "w") as f:
    f.writelines(out)

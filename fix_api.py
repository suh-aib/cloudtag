with open("frontend/src/services/api/approvals.ts", "r") as f:
    content = f.read()

import re

# Add API_BASE_URL
content = content.replace('import axios from "axios";\n', 'import axios from "axios";\n\nconst API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";\n')

# Add explicit check function
content = content.replace('export interface ChangeDetail', 'function checkJsonResponse(data: any) {\n  if (typeof data === "string" && data.trim().startsWith("<!DOCTYPE html>")) {\n    throw new Error("API returned HTML instead of expected JSON data. Check routing.");\n  }\n  return data;\n}\n\nexport interface ChangeDetail')

# Prefix URLs
content = re.sub(r'axios\.get\(`(/api/[^`]+)`', r'axios.get(`${API_BASE_URL}\1`', content)
content = re.sub(r'axios\.post\(`(/api/[^`]+)`', r'axios.post(`${API_BASE_URL}\1`', content)

# Wrap res.data
content = content.replace('return res.data;', 'return checkJsonResponse(res.data);')

with open("frontend/src/services/api/approvals.ts", "w") as f:
    f.write(content)

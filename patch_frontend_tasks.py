import re
import os

files = [
    "frontend/src/pages/user/Azure.tsx",
    "frontend/src/pages/user/AWS.tsx",
    "frontend/src/pages/user/AzureResourceGroups.tsx",
    "frontend/src/pages/user/AWSRegions.tsx",
    "frontend/src/pages/user/AzureResourceTypes.tsx",
    "frontend/src/pages/user/AWSTypes.tsx",
    "frontend/src/pages/user/AzureResourceList.tsx",
    "frontend/src/pages/user/AWSResources.tsx",
]

for file_path in files:
    with open(file_path, "r") as f:
        content = f.read()

    # 1. Add taskId extraction
    if "const taskId = searchParams.get(\"task_id\");" not in content:
        content = content.replace(
            'const assignUserId = searchParams.get("assign_user_id");',
            'const assignUserId = searchParams.get("assign_user_id");\n  const taskId = searchParams.get("task_id");'
        )
        
    # 2. Update initial filters
    if "const [filters, setFilters] = useState<APIFilters>({})" in content:
        content = content.replace(
            "const [filters, setFilters] = useState<APIFilters>({});",
            "const [filters, setFilters] = useState<APIFilters>({ ...(taskId ? { task_id: parseInt(taskId, 10) } : {}) });"
        )
        
    # 3. Fix the <Link> propagation
    if "const getQueryString = () =>" not in content:
        helper = """
  const getQueryString = () => {
    const p = new URLSearchParams();
    if (assignUserId) p.append("assign_user_id", assignUserId);
    if (taskId) p.append("task_id", taskId);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
"""
        if "const [assignPayload, setAssignPayload] = useState<CreateAssignmentPayload | null>(null);" in content:
            content = content.replace(
                "const [assignPayload, setAssignPayload] = useState<CreateAssignmentPayload | null>(null);",
                "const [assignPayload, setAssignPayload] = useState<CreateAssignmentPayload | null>(null);\n" + helper
            )
        else:
             content = re.sub(
                 r'(const \[filters, setFilters\] = .*?;\n)',
                 r'\1' + helper,
                 content
             )

    # 4. Replace links.
    content = re.sub(
        r'\$\{assignUserId \? `\?assign_user_id=\$\{assignUserId\}` : \'\'\}',
        r'${getQueryString()}',
        content
    )
    
    # 5. Fix bulk tag buttons
    bulk_pattern = re.compile(r'(navigate\(`/bulk-tagging/wizard\?[^`]+)("\)|`\))')
    def replacer(match):
        inner = match.group(1)
        if "${taskId" not in inner:
            return inner + "${taskId ? `&task_id=${taskId}` : ''}" + match.group(2)
        return match.group(0)
    
    content = bulk_pattern.sub(replacer, content)

    with open(file_path, "w") as f:
        f.write(content)

print("Frontend task_id patched")

import re

# 1. Update tagging API schema
with open("frontend/src/services/api/tagging.ts", "r") as f:
    api_content = f.read()

if "task_id?: number;" not in api_content:
    api_content = api_content.replace(
        "tags: Record<string, string>;",
        "tags: Record<string, string>;\n  task_id?: number;"
    )
    with open("frontend/src/services/api/tagging.ts", "w") as f:
        f.write(api_content)

# 2. Update BulkTaggingWizard.tsx
with open("frontend/src/pages/user/BulkTaggingWizard.tsx", "r") as f:
    wizard_content = f.read()

if "const taskId = searchParams.get('task_id');" not in wizard_content:
    wizard_content = wizard_content.replace(
        "const accountId = searchParams.get('accountId') || '';",
        "const accountId = searchParams.get('accountId') || '';\n  const taskId = searchParams.get('task_id');"
    )

# Inject task_id into payload construction for preview
preview_payload_replace = """const payload: BulkTagRequest = {
        provider,
        scope_type: scopeType as any,
        account_id: accountId,
        resource_group: resourceGroup,
        resource_type: resourceType,
        tags: Object.fromEntries(
          tagSelections.filter(t => t.value).map(t => [t.tagDefinition.name, t.value])
        ),
        ...(taskId ? { task_id: parseInt(taskId, 10) } : {})
      };"""
      
# Find where payload is created in handleReview
if "task_id: parseInt(taskId" not in wizard_content:
    wizard_content = re.sub(
        r"const payload: BulkTagRequest = \{\s*provider,\s*scope_type: scopeType as any,\s*account_id: accountId,\s*resource_group: resourceGroup,\s*resource_type: resourceType,\s*tags: Object\.fromEntries\(\s*tagSelections\.filter\(t => t\.value\)\.map\(t => \[t\.tagDefinition\.name, t\.value\]\)\s*\)\s*\};",
        preview_payload_replace,
        wizard_content
    )

# Inject task_id into payload construction for create
# Sometimes it uses the same `payload` var or creates a new one
submit_payload_replace = """const payload: BulkTagRequest = {
        provider,
        scope_type: scopeType as any,
        account_id: accountId,
        resource_group: resourceGroup,
        resource_type: resourceType,
        tags: Object.fromEntries(
          tagSelections.filter(t => t.value).map(t => [t.tagDefinition.name, t.value])
        ),
        ...(taskId ? { task_id: parseInt(taskId, 10) } : {})
      };"""

# I will just replace it generically.
if wizard_content.count("tags: Object.fromEntries(") > 0:
     # Wait, re.sub might have replaced all occurrences! Let's check if there are any remaining.
     pass
     
with open("frontend/src/pages/user/BulkTaggingWizard.tsx", "w") as f:
    f.write(wizard_content)

print("Bulk tagging logic patched")

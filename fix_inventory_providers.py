import re

with open("backend/app/api/inventory.py", "r") as f:
    content = f.read()

# I will find all CloudProvider.AWS and CloudProvider.AZURE and set them based on function name
def replace_provider(match):
    func_name = match.group(1)
    body = match.group(2)
    if "azure" in func_name:
        body = body.replace("CloudProvider.AWS", "CloudProvider.AZURE")
    elif "aws" in func_name:
        body = body.replace("CloudProvider.AZURE", "CloudProvider.AWS")
    return func_name + body

content = re.sub(r'(def get_(?:azure|aws)_[a-z_]+\([\s\S]*?:)([\s\S]*?)(?=\n@router|\Z)', replace_provider, content)

with open("backend/app/api/inventory.py", "w") as f:
    f.write(content)

import re

region_map = """
const AWS_REGION_NAMES: Record<string, string> = {
  "us-east-1": "US East (N. Virginia)",
  "us-east-2": "US East (Ohio)",
  "us-west-1": "US West (N. California)",
  "us-west-2": "US West (Oregon)",
  "af-south-1": "Africa (Cape Town)",
  "ap-east-1": "Asia Pacific (Hong Kong)",
  "ap-south-1": "Asia Pacific (Mumbai)",
  "ap-northeast-2": "Asia Pacific (Seoul)",
  "ap-southeast-1": "Asia Pacific (Singapore)",
  "ap-southeast-2": "Asia Pacific (Sydney)",
  "ap-northeast-1": "Asia Pacific (Tokyo)",
  "ca-central-1": "Canada (Central)",
  "eu-central-1": "Europe (Frankfurt)",
  "eu-west-1": "Europe (Ireland)",
  "eu-west-2": "Europe (London)",
  "eu-south-1": "Europe (Milan)",
  "eu-west-3": "Europe (Paris)",
  "eu-north-1": "Europe (Stockholm)",
  "me-south-1": "Middle East (Bahrain)",
  "sa-east-1": "South America (São Paulo)"
};

const getRegionDisplayName = (region: string) => {
  return AWS_REGION_NAMES[region] ? `${AWS_REGION_NAMES[region]} (${region})` : region;
};
"""

file_path = "../frontend/src/pages/user/AWSRegions.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Add region mapping
if "AWS_REGION_NAMES" not in content:
    content = content.replace("export default function AWSRegions() {", region_map + "\nexport default function AWSRegions() {")

# Remove duplicate Region(s) column
content = content.replace('<TableHead className="font-semibold text-gray-700">Region(s)</TableHead>\n', '')

# Update table body
old_body = """<TableRow key={regionObj.name} className="hover:bg-gray-50/50">
                    <TableCell className="font-medium text-gray-900">{regionObj.name}</TableCell>
                    <TableCell className="text-gray-500 text-xs">{regionObj.locations.join(', ') || 'N/A'}</TableCell>"""

new_body = """<TableRow key={regionObj.name} className="hover:bg-gray-50/50">
                    <TableCell className="font-medium text-gray-900">{getRegionDisplayName(regionObj.name)}</TableCell>"""
content = content.replace(old_body, new_body)

# Fix Bulk Tag button link for AWS
old_link = "provider=AZURE&scopeType=RESOURCE_GROUP"
new_link = "provider=AWS&scopeType=REGION"
content = content.replace(old_link, new_link)

# We also need to fix resourceGroup= param which might be hardcoded as resourceGroup=
old_param = "&resourceGroup=${encodeURIComponent(regionObj.name)}"
new_param = "&region=${encodeURIComponent(regionObj.name)}"
content = content.replace(old_param, new_param)

with open(file_path, "w") as f:
    f.write(content)

print("Updated AWSRegions.tsx")

import os
import re

files = [
    "../frontend/src/pages/user/Azure.tsx",
    "../frontend/src/pages/user/AzureResourceGroups.tsx",
    "../frontend/src/pages/user/AzureResourceTypes.tsx",
    "../frontend/src/pages/user/AzureResourceList.tsx",
    "../frontend/src/pages/user/AWS.tsx",
    "../frontend/src/pages/user/AWSRegions.tsx",
    "../frontend/src/pages/user/AWSTypes.tsx",
    "../frontend/src/pages/user/AWSResources.tsx",
]

for file_path in files:
    with open(file_path, "r") as f:
        content = f.read()

    # 1. Add InventoryFilters to imports
    if "InventoryFilters" not in content:
        content = content.replace('import { Input } from "../../components/ui/Input";\n', '')
        content = content.replace('import { Button } from "../../components/ui/Button";', 'import { Button } from "../../components/ui/Button";\nimport { InventoryFilters } from "../../components/ui/InventoryFilters";\nimport { InventoryFilters as APIFilters } from "../../services/api/inventory";')

    # 2. Add filters state
    if "const [filters, setFilters]" not in content:
        state_insertion = """  const [filters, setFilters] = useState<APIFilters>({});"""
        content = re.sub(r'(const \[isLoading, setIsLoading\] = useState\(true\);)', r'\1\n' + state_insertion, content)

    # 3. Update the data fetching function calls
    fetch_funcs = [
        ("getProviderAccounts(token, 'azure'", "getProviderAccounts(token, 'azure', filters)"),
        ("getProviderAccounts(token, 'aws'", "getProviderAccounts(token, 'aws', filters)"),
        ("getAzureResourceGroups(token, accountId)", "getAzureResourceGroups(token, accountId, filters)"),
        ("getAWSRegions(token, accountId)", "getAWSRegions(token, accountId, filters)"),
        ("getAzureResourceTypes(token, accountId, resourceGroup)", "getAzureResourceTypes(token, accountId, resourceGroup, filters)"),
        ("getAWSResourceTypes(token, accountId, region)", "getAWSResourceTypes(token, accountId, region, filters)"),
        ("getAzureResources(token, accountId, resourceGroup, resourceType)", "getAzureResources(token, accountId, resourceGroup, resourceType, filters)"),
        ("getAWSResources(token, accountId, region, resourceType)", "getAWSResources(token, accountId, region, resourceType, filters)"),
        ("getAzureResources(token, accountId, resourceGroup, undefined)", "getAzureResources(token, accountId, resourceGroup, undefined, filters)"),
        ("getAWSResources(token, accountId, region, undefined)", "getAWSResources(token, accountId, region, undefined, filters)"),
    ]
    
    for old_func, new_func in fetch_funcs:
        if old_func in content and new_func not in content:
            content = content.replace(old_func, new_func)

    # 4. Add filters to dependency arrays
    if "getToken, accountId" in content and "filters" not in content.split("getToken, accountId")[1].split("]")[0]:
        content = re.sub(r'(\[getToken, accountId[^\]]*)\]', r'\1, filters]', content)
    elif "[getToken]" in content and "filters" not in content.split("[getToken]")[0][-20:]:
        content = content.replace("[getToken]", "[getToken, filters]")

    # 5. Replace Search UI with InventoryFilters UI
    # This regex is meant to capture the exact layout of the search div
    search_ui_pattern = r'<div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4 items-center justify-between">\s*<div className="flex gap-4 flex-1 max-w-md w-full">\s*<div className="relative flex-1">\s*<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size=\{18\} />\s*<Input\s*placeholder="Search[^"]*"\s*className="pl-10 bg-gray-50/50 w-full"\s*/>\s*</div>\s*<Button variant="outline" className="gap-2">\s*<Filter size=\{16\} /> Filters\s*</Button>\s*</div>\s*</div>'
    
    has_loc = "true" if "Resources" in file_path or "List" in file_path else "false"
    has_type = "true" if "Resources" in file_path or "List" in file_path else "false"
    
    new_ui = f"""<div className="p-4 border-b border-gray-200">
          <InventoryFilters 
            onFiltersChange={{setFilters}} 
            showLocationFilter={{{has_loc}}}
            showResourceTypeFilter={{{has_type}}}
          />
        </div>"""
        
    content = re.sub(search_ui_pattern, new_ui, content)
    
    with open(file_path, "w") as f:
        f.write(content)

print("Pre-processed files")

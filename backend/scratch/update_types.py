import re

files = [
    "../frontend/src/pages/user/AWSTypes.tsx",
    "../frontend/src/pages/user/AzureResourceTypes.tsx"
]

for file_path in files:
    with open(file_path, "r") as f:
        content = f.read()

    # 1. Add InventoryFilters to imports if not there
    if "InventoryFilters" not in content:
        content = content.replace('import { Input } from "../../components/ui/Input";\n', '')
        content = content.replace('import { Button } from "../../components/ui/Button";', 'import { Button } from "../../components/ui/Button";\nimport { InventoryFilters } from "../../components/ui/InventoryFilters";\nimport { InventoryFilters as APIFilters } from "../../services/api/inventory";')

    # Add Badge import if not there
    if "import { Badge }" not in content:
        content = content.replace('import { Button } from "../../components/ui/Button";', 'import { Button } from "../../components/ui/Button";\nimport { Badge } from "../../components/ui/Badge";')

    # 2. Add filters state if not there
    if "const [filters, setFilters]" not in content:
        state_insertion = """  const [filters, setFilters] = useState<APIFilters>({});"""
        content = re.sub(r'(const \[isLoading, setIsLoading\] = useState\(true\);)', r'\1\n' + state_insertion, content)

    # 3. Update the data fetching function calls
    old_func = "getAWSResourceTypes(token, accountId, region)" if "AWS" in file_path else "getAzureResourceTypes(token, accountId, resourceGroup)"
    new_func = old_func[:-1] + ", filters)"
    if old_func in content and new_func not in content:
        content = content.replace(old_func, new_func)

    # 4. Add filters to dependency arrays
    if "filters" not in content.split(old_func.split("(")[1].split(")")[0])[1].split("]")[0]:
        content = re.sub(r'(\[getToken,[^\]]*)\]', r'\1, filters]', content)

    # 5. Replace Search UI with InventoryFilters UI
    search_ui_pattern = r'<div className="flex gap-4">\s*<div className="relative flex-1 max-w-md">\s*<Search className="absolute [^>]*>[\s\S]*?<Input[^>]*>[\s\S]*?</div>\s*<Button variant="outline"[^>]*>[\s\S]*?<Filter size=\{16\} />[^<]*</Button>\s*</div>'
    
    new_ui = f"""<div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm mb-6">
        <InventoryFilters 
          onFiltersChange={{setFilters}} 
          showLocationFilter={{false}}
          showResourceTypeFilter={{true}}
        />
      </div>"""
        
    content = re.sub(search_ui_pattern, new_ui, content)

    # 6. Add classification badges to the card
    card_header = """<div>
                    <h3 className="font-bold text-lg text-gray-900 mb-1 truncate">{type.display_name}</h3>
                    <p className="text-xs text-gray-500 font-mono truncate">{type.resource_type}</p>
                  </div>"""
                  
    card_header_with_badges = """<div>
                    <h3 className="font-bold text-lg text-gray-900 mb-1 truncate">{type.display_name}</h3>
                    <p className="text-xs text-gray-500 font-mono truncate mb-2">{type.resource_type}</p>
                    <div className="flex gap-2 mb-2">
                      {type.billability && (
                        <Badge variant={type.billability === 'BILLABLE' ? 'success' : type.billability === 'NON_BILLABLE' ? 'secondary' : 'warning'}>
                          {type.billability}
                        </Badge>
                      )}
                      {type.tagging_scope && (
                        <Badge variant={type.tagging_scope === 'REQUIRED' ? 'destructive' : type.tagging_scope === 'SUPPORTING' ? 'secondary' : 'outline'}>
                          {type.tagging_scope}
                        </Badge>
                      )}
                    </div>
                  </div>"""
    content = content.replace(card_header, card_header_with_badges)

    # 7. Fix Bulk Tag link for AWS
    if "AWS" in file_path:
        old_link = "provider=AZURE&scopeType=RESOURCE_TYPE"
        new_link = "provider=AWS&scopeType=RESOURCE_TYPE"
        content = content.replace(old_link, new_link)

    with open(file_path, "w") as f:
        f.write(content)

print("Updated Types UI")

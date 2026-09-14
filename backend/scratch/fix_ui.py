import re
import glob

files = glob.glob("../frontend/src/pages/user/A*.tsx")

for file_path in files:
    with open(file_path, "r") as f:
        content = f.read()
        
    # Fix the extra parenthesis bug in fetch calls
    content = content.replace("filters))", "filters)")
    
    # Replace the old Search and Filter UI block
    
    # 1. Block with Input and Filter Button (the generic one)
    block_pattern1 = r'<div className="p-4 border-b border-gray-200 flex gap-4">[\s\S]*?<div className="relative flex-1 max-w-md">[\s\S]*?<Search className="absolute [^>]*>[\s\S]*?<Input[^>]*>[\s\S]*?</div>[\s\S]*?<Button variant="outline"[^>]*>[\s\S]*?<Filter size=\{16\} />[^<]*</Button>[\s\S]*?</div>'
    
    # 2. Block used in Resources (flex-col sm:flex-row)
    block_pattern2 = r'<div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4 items-center justify-between">[\s\S]*?<div className="flex gap-4 flex-1 max-w-md w-full">[\s\S]*?<div className="relative flex-1">[\s\S]*?<Search className="absolute [^>]*>[\s\S]*?<Input[^>]*>[\s\S]*?</div>[\s\S]*?<Button variant="outline"[^>]*>[\s\S]*?<Filter size=\{16\} />[^<]*</Button>[\s\S]*?</div>[\s\S]*?</div>'
    
    # Determine if we should show extra filters
    has_loc = "true" if "Resources" in file_path or "List" in file_path else "false"
    has_type = "true" if "Resources" in file_path or "List" in file_path else "false"
    
    new_ui = f"""<div className="p-4 border-b border-gray-200">
          <InventoryFilters 
            onFiltersChange={{setFilters}} 
            showLocationFilter={{{has_loc}}}
            showResourceTypeFilter={{{has_type}}}
          />
        </div>"""
        
    content = re.sub(block_pattern1, new_ui, content)
    content = re.sub(block_pattern2, new_ui, content)
    
    with open(file_path, "w") as f:
        f.write(content)

print("Fixed UI files")

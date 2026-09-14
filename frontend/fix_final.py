import re

# Fix AzureResourceTypes.tsx
with open("src/pages/user/AzureResourceTypes.tsx", "r") as f:
    content = f.read()

content = re.sub(r"(import type \{ InventoryFilters as APIFilters \} from \"\.\./\.\./services/api/inventory\";\n)+", "import type { InventoryFilters as APIFilters } from \"../../services/api/inventory\";\n", content)
content = re.sub(r"(import \{ InventoryFilters \} from \"\.\./\.\./components/ui/InventoryFilters\";\n)+", "import { InventoryFilters } from \"../../components/ui/InventoryFilters\";\n", content)

with open("src/pages/user/AzureResourceTypes.tsx", "w") as f:
    f.write(content)

# Fix InventoryFilters.tsx
with open("src/components/ui/InventoryFilters.tsx", "r") as f:
    content = f.read()

content = content.replace('import {  X } from \'lucide-react\';', 'import { Search, Filter, X } from \'lucide-react\';')
content = content.replace("import React, { useState, useEffect, useRef } from 'react';", "import { useState, useEffect, useRef } from 'react';")
content = content.replace("import { InventoryFilters as APIFilters } from '../../services/api/inventory';", "import type { InventoryFilters as APIFilters } from '../../services/api/inventory';")

with open("src/components/ui/InventoryFilters.tsx", "w") as f:
    f.write(content)


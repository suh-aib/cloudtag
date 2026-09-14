import os
import glob

# Files to update
files = glob.glob("src/pages/**/*.tsx", recursive=True)

for path in files:
    with open(path, "r") as f:
        content = f.read()
    
    # Update max-w layout for consistency
    if 'className="space-y-6"' in content and 'max-w-6xl' not in content:
        content = content.replace('className="space-y-6"', 'className="space-y-6 max-w-6xl mx-auto py-2"')
        
    # Standardize heading
    if 'text-2xl font-bold tracking-tight"' in content:
        content = content.replace('text-2xl font-bold tracking-tight"', 'text-2xl font-bold tracking-tight text-gray-900"')
        
    # Standardize shadow/borders on Card
    if '<Card>' in content:
        content = content.replace('<Card>', '<Card className="shadow-sm border-gray-200">')
        
    with open(path, "w") as f:
        f.write(content)

print("Updated structural pages successfully.")

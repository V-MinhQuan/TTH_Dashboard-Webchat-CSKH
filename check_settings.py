import re

file_path = 'src/app/components/screens/Settings.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove from adminSections
content = content.replace('  { id: "notifications", label: "Thông báo", icon: Bell },\n', '')

# 2. Remove the activeSection === "notifications" rendering block
# We'll use regex to remove the entire `if (activeSection === "notifications") { ... }`
# since we don't know the exact length.
pattern = re.compile(r'    if \(activeSection === "notifications"\) \{.*?    \}', re.DOTALL)
content = pattern.sub('', content)

# But wait, it's an if-else chain. If we remove the if, we must ensure the else if logic still works.
# Let's inspect the code around it first.

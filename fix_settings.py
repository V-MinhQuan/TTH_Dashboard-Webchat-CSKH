import re

file_path = 'src/app/components/screens/Settings.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove '  { id: "notifications", label: "Thông báo", icon: Bell },\n'
content = content.replace('  { id: "notifications", label: "Thông báo", icon: Bell },\n', '')

# Replace activeSection === "notifications" block
pattern = re.compile(r'    if \(activeSection === "notifications"\) \{.*?    \}\n\n', re.DOTALL)
content = pattern.sub('', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

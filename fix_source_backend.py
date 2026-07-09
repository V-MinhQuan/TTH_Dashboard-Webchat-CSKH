import sys

# 1. Update repository.py
repo_path = 'backend/app/sheet_chatbot/repository.py'
with open(repo_path, 'r', encoding='utf-8') as f:
    repo_content = f.read()

repo_content = repo_content.replace('Source NVARCHAR(255) NULL,', '')
repo_content = repo_content.replace('Source AS source,', '')
repo_content = repo_content.replace('                        Source,\n', '')
repo_content = repo_content.replace('                        %(source)s,\n', '')
repo_content = repo_content.replace('                        Source = %(source)s,\n', '')
repo_content = repo_content.replace('source=row.get("Source"),', '')

with open(repo_path, 'w', encoding='utf-8') as f:
    f.write(repo_content)

# 2. Update service.py if it has references to source
service_path = 'backend/app/sheet_chatbot/service.py'
with open(service_path, 'r', encoding='utf-8') as f:
    service_content = f.read()

service_content = service_content.replace('            source=body.get("source"),\n', '')
service_content = service_content.replace('            source=body.source,\n', '')
service_content = service_content.replace('            "source": row.get("source"),\n', '')
service_content = service_content.replace('            source=row_data.get("source"),\n', '')

with open(service_path, 'w', encoding='utf-8') as f:
    f.write(service_content)

# 3. Update legacy.py if it has references
legacy_path = 'backend/app/routers/legacy.py'
with open(legacy_path, 'r', encoding='utf-8') as f:
    legacy_content = f.read()

legacy_content = legacy_content.replace('    source: Optional[str] = None\n', '')

with open(legacy_path, 'w', encoding='utf-8') as f:
    f.write(legacy_content)

print('Backend updated.')

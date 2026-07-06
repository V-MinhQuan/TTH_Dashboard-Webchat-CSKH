import os

filepath = "backend/app/repositories/display_filters.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

import_stmt = "from app.repositories.base_repository import BaseRepository\n"
if "from app.repositories.base_repository import BaseRepository" not in content:
    # insert at top
    content = import_stmt + content

# Replace conversation_status_case implementation
import re
pattern = re.compile(r"def conversation_status_case\(.*?\).*?\"\"\"", re.DOTALL)
content = pattern.sub(
    "def conversation_status_case(conversation_alias: str = \"c\", status_alias: str = \"s\") -> str:\n"
    "    return BaseRepository()._conversation_status_case(conversation_alias, status_alias)",
    content
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

import os
import re

legacy_path = "backend/app/repositories/legacy_conversation_repository.py"
base_path = "backend/app/repositories/base_repository.py"

with open(legacy_path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the start of _escape_pymssql_literal_percent
start_match = re.search(r"    def _escape_pymssql_literal_percent", content)
# Find the start of _analytics_topic_scope_cte
end_match = re.search(r"    def _analytics_topic_scope_cte", content)

if start_match and end_match:
    start_idx = start_match.start()
    end_idx = end_match.start()
    
    helpers_code = content[start_idx:end_idx]
    
    # Create base_repository.py
    base_content = """import os
from datetime import datetime, timedelta
from typing import List, Optional

from app.core.topic_taxonomy import TOPIC_LEGACY_ALIASES, TOPIC_NAME_BY_ID, canonical_topic_id, canonical_topic_label

class BaseRepository:
""" + helpers_code

    with open(base_path, "w", encoding="utf-8") as f:
        f.write(base_content)
        
    # Remove from legacy
    new_legacy_content = content[:start_idx] + content[end_idx:]
    
    # Add import and inheritance
    new_legacy_content = new_legacy_content.replace(
        "class ConversationRepository:",
        "from app.repositories.base_repository import BaseRepository\n\nclass ConversationRepository(BaseRepository):"
    )
    
    with open(legacy_path, "w", encoding="utf-8") as f:
        f.write(new_legacy_content)
        
    print("Successfully extracted helper methods to base_repository.py")
else:
    print("Could not find start or end matches")

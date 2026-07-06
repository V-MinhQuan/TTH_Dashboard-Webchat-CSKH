import os
import re

files_to_check = [
    "backend/app/repositories/legacy_conversation_repository.py",
    "backend/app/repositories/conversation_repository.py",
    "backend/app/repositories/dashboard_repository.py",
    "backend/app/repositories/analytics_repository.py",
    "backend/app/repositories/display_filters.py"
]

pattern_status_case_1 = re.compile(
    r"WHEN\s+([a-zA-Z0-9_]+)\.NoResponseNeeded\s*=\s*1\s+AND\s+\(\1\.MarkedAt\s+IS\s+NULL\s+OR\s+([a-zA-Z0-9_]+)\.LastCustomerMessageAt\s*<=\s*\1\.MarkedAt\)\s+THEN\s+'closed'\s*\n\s*WHEN\s+\2\.LastHostMessageAt\s+IS\s+NULL\s+OR\s+\2\.LastCustomerMessageAt\s*>\s+\2\.LastHostMessageAt\s+THEN\s+'pending'",
    re.MULTILINE
)

pattern_priority_1 = re.compile(
    r"\"([a-zA-Z0-9_]+)\.LastCustomerMessageAt\s+IS\s+NOT\s+NULL\",\s*\n\s*\"\([a-zA-Z0-9_]+\.NoResponseNeeded\s+IS\s+NULL\s+OR\s+[a-zA-Z0-9_]+\.NoResponseNeeded\s*=\s*0\s+OR\s+[a-zA-Z0-9_]+\.LastCustomerMessageAt\s*>\s*[a-zA-Z0-9_]+\.MarkedAt\)\",\s*\n\s*\"\([a-zA-Z0-9_]+\.LastHostMessageAt\s+IS\s+NULL\s+OR\s+[a-zA-Z0-9_]+\.LastCustomerMessageAt\s*>\s*[a-zA-Z0-9_]+\.LastHostMessageAt\)\",?",
    re.MULTILINE
)

pattern_priority_2 = re.compile(
    r"\"([a-zA-Z0-9_]+)\.LastCustomerMessageAt\s+IS\s+NOT\s+NULL\",\s*\n\s*\"\([a-zA-Z0-9_]+\.NoResponseNeeded\s+IS\s+NULL\s+OR\s+[a-zA-Z0-9_]+\.NoResponseNeeded\s*=\s*0\s+OR\s+[a-zA-Z0-9_]+\.LastCustomerMessageAt\s*>\s*[a-zA-Z0-9_]+\.MarkedAt\)\",\s*\n\s*\"([a-zA-Z0-9_]+)\.LastCustomerMessageAt\s*<=\s*GETDATE\(\)\",\s*\n\s*\"\([a-zA-Z0-9_]+\.LastHostMessageAt\s+IS\s+NULL\s+OR\s+[a-zA-Z0-9_]+\.LastCustomerMessageAt\s*>\s*[a-zA-Z0-9_]+\.LastHostMessageAt\)\",?",
    re.MULTILINE
)

for filepath in files_to_check:
    if not os.path.exists(filepath):
        continue
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    orig = content

    def repl_case_1(m):
        status_alias = m.group(1)
        conv_alias = m.group(2)
        # We replace the two WHEN clauses with the single helper call.
        # But wait, the helper returns the full CASE ... END.
        # Often this is inside a CASE WHEN ... ELSE 'open' END block.
        # Let's replace the whole CASE block if we can, or just inject {self._conversation_status_case('c', 's')} 
        # Actually it's better to replace the specific WHEN lines with:
        # {self._conversation_status_case('{conv_alias}', '{status_alias}')}
        # But _conversation_status_case ALREADY has the word CASE at the beginning and END at the end.
        return f"{{self._conversation_status_case('{conv_alias}', '{status_alias}')}} -- Replaced"

    # We need a different regex to replace the WHOLE CASE block
    pattern_full_case = re.compile(
        r"CASE\s*\n\s*WHEN\s+([a-zA-Z0-9_]+)\.NoResponseNeeded\s*=\s*1\s+AND\s+\(\1\.MarkedAt\s+IS\s+NULL\s+OR\s+([a-zA-Z0-9_]+)\.LastCustomerMessageAt\s*<=\s*\1\.MarkedAt\)\s+THEN\s+'closed'\s*\n\s*WHEN\s+\2\.LastHostMessageAt\s+IS\s+NULL\s+OR\s+\2\.LastCustomerMessageAt\s*>\s+\2\.LastHostMessageAt\s+THEN\s+'pending'\s*\n\s*ELSE\s+'open'\s*\n\s*END",
        re.MULTILINE
    )
    
    content = pattern_full_case.sub(lambda m: f"{{self._conversation_status_case('{m.group(2)}', '{m.group(1)}')}}", content)
    
    # Priority condition replacement
    # Replacing the 3 or 4 condition strings with a single condition checking if status is pending
    def repl_priority(m):
        conv_alias = m.group(1)
        # Assuming status alias is 's' because they usually join with ConversationStatus s
        # Let's use generic replacement
        return f"f\"{{self._conversation_status_case('{conv_alias}', 's')}} = 'pending'\""
        
    content = pattern_priority_1.sub(repl_priority, content)
    content = pattern_priority_2.sub(repl_priority, content)
    
    if orig != content:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {filepath}")


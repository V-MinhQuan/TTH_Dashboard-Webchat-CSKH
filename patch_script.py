import sys

file_path = 'backend/app/keywords/repository.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """        select_parts = []
        select_params = []
        all_words = []
        for group_id, words in group_words_map.items():
            if not words:
                continue
            all_words.extend(words)
            group_or = " OR ".join(["m.TextContent LIKE ?" for _ in words])
            select_parts.append(f"SUM(CASE WHEN ({group_or}) THEN 1 ELSE 0 END) AS [{group_id}]")
            select_params.extend([f"%{word}%" for word in words])

        if not select_parts:
            return {}

        unique_words = list(dict.fromkeys(all_words))
        word_filter_sql = " OR ".join(["m.TextContent LIKE ?" for _ in unique_words])
        word_filter_params = [f"%{word}%" for word in unique_words]
        where_extra = (" AND " + " AND ".join(f"({clause})" for clause in filter_clauses)) if filter_clauses else ""
        query = f\"\"\"
            SELECT {', '.join(select_parts)}
            FROM WebChat_MessageLogs m
            {join_sql}
            WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
              AND ({word_filter_sql})
            {where_extra}
        \"\"\"

        try:
            rows = execute_query(query, tuple(select_params + word_filter_params + filter_params))
            row = rows[0] if rows else {}
            return {group_id: row.get(group_id) or 0 for group_id in group_words_map}"""

replacement = """        select_parts = []
        select_params = []
        all_words = []
        has_khac = "khac" in group_words_map

        for group_id, words in group_words_map.items():
            if not words:
                continue
            all_words.extend(words)
            group_or = " OR ".join(["m.TextContent LIKE ?" for _ in words])
            select_parts.append(f"SUM(CASE WHEN ({group_or}) THEN 1 ELSE 0 END) AS [{group_id}]")
            select_params.extend([f"%{word}%" for word in words])

        unique_words = list(dict.fromkeys(all_words))
        word_filter_sql = " OR ".join(["m.TextContent LIKE ?" for _ in unique_words])
        word_filter_params = [f"%{word}%" for word in unique_words]
        where_extra = (" AND " + " AND ".join(f"({clause})" for clause in filter_clauses)) if filter_clauses else ""
        
        if has_khac:
            if word_filter_sql:
                select_parts.append(f"SUM(CASE WHEN NOT ({word_filter_sql}) THEN 1 ELSE 0 END) AS [khac]")
                select_params.extend(word_filter_params)
            else:
                select_parts.append("COUNT(*) AS [khac]")
                
            query = f\"\"\"
                SELECT {', '.join(select_parts)}
                FROM WebChat_MessageLogs m
                {join_sql}
                WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
                {where_extra}
            \"\"\"
            params = tuple(select_params + filter_params)
        elif select_parts and word_filter_sql:
            query = f\"\"\"
                SELECT {', '.join(select_parts)}
                FROM WebChat_MessageLogs m
                {join_sql}
                WHERE m.TextContent IS NOT NULL AND m.TextContent != ''
                  AND ({word_filter_sql})
                {where_extra}
            \"\"\"
            params = tuple(select_params + word_filter_params + filter_params)
        else:
            return {group_id: 0 for group_id in group_words_map}

        try:
            rows = execute_query(query, params)
            row = rows[0] if rows else {}
            return {group_id: row.get(group_id) or 0 for group_id in group_words_map}"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Target not found")

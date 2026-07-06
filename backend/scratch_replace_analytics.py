import os

filepath = "backend/app/repositories/analytics_repository.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the manual closed_sql and reopened_sql blocks
old_block = """                closed_sql = "(s.NoResponseNeeded = 1 AND (s.MarkedAt IS NULL OR c.LastCustomerMessageAt <= s.MarkedAt))"
                reopened_sql = "(s.NoResponseNeeded = 1 AND s.MarkedAt IS NOT NULL AND c.LastCustomerMessageAt > s.MarkedAt)"
                if conversation_status == "Chờ xử lý":
                    extra_conditions.append(f"c.CustomerId IS NOT NULL AND ({reopened_sql} OR c.LastHostMessageAt IS NULL)")
                elif conversation_status in ("Đang xử lý", "Đang tư vấn", "Đang tư vấn / Chờ phản hồi"):
                    extra_conditions.append(f"c.CustomerId IS NOT NULL AND NOT ({closed_sql}) AND NOT ({reopened_sql}) AND c.LastHostMessageAt IS NOT NULL")
                elif conversation_status == "Hoàn thành":
                    extra_conditions.append(f"c.CustomerId IS NOT NULL AND {closed_sql}")"""

new_block = """                status_expr = conversation_status_case('c', 's')
                if conversation_status == "Chờ xử lý":
                    extra_conditions.append(f"c.CustomerId IS NOT NULL AND {status_expr} = 'pending'")
                elif conversation_status in ("Đang xử lý", "Đang tư vấn", "Đang tư vấn / Chờ phản hồi"):
                    extra_conditions.append(f"c.CustomerId IS NOT NULL AND {status_expr} = 'open'")
                elif conversation_status == "Hoàn thành":
                    extra_conditions.append(f"c.CustomerId IS NOT NULL AND {status_expr} = 'closed'")"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Successfully replaced status logic in analytics_repository.py")
else:
    print("Could not find the block in analytics_repository.py")

import os
from datetime import datetime, timedelta
import pymssql
from backend.config.db import get_db_connection

class ConversationRepository:
    def get_conversations(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT 
                  c.Id AS id,
                  c.CustomerId AS customer_id,
                  u.DisplayName AS customer_name,
                  CASE 
                    WHEN s.NoResponseNeeded = 1 AND (s.MarkedAt IS NULL OR c.LastCustomerMessageAt <= s.MarkedAt) THEN 'closed'
                    WHEN c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt THEN 'pending'
                    ELSE 'open'
                  END AS status,
                  c.Source AS source,
                  c.LastCustomerMessageAt AS created_at,
                  c.LastHostMessageAt AS first_response_at,
                  c.LastMessageAt AS updated_at
                FROM WebChat_Conversations c
                LEFT JOIN WebChat_Messagelogs_User_Info u 
                  ON c.CustomerId = u.SenderId AND c.Source = u.Source
                LEFT JOIN WebChat_ConversationStatus s 
                  ON c.CustomerId = s.CustomerId AND c.Source = s.Source
            """
            conditions = []
            params = []
            
            if start_date:
                conditions.append("c.LastCustomerMessageAt >= %s")
                params.append(start_date)
                
            if end_date:
                conditions.append("c.LastCustomerMessageAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            query += " ORDER BY c.LastCustomerMessageAt DESC"
            
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_message_counts(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT 
                  Source AS source, 
                  COUNT(*) AS count,
                  MIN(SentAt) AS min_date,
                  MAX(SentAt) AS max_date
                FROM WebChat_MessageLogs
            """
            conditions = []
            params = []
            
            if start_date:
                conditions.append("SentAt >= %s")
                params.append(start_date)
                
            if end_date:
                conditions.append("SentAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            query += " GROUP BY Source"
            
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_ai_failures_count(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT COUNT(*) AS count 
                FROM WebChat_MessageLogs
                WHERE FromHost = 1 
                  AND HostDisplayName = 'AI Assistant' 
                  AND (
                    TextContent LIKE N'%chưa hiểu%' 
                    OR TextContent LIKE N'%chưa rõ%' 
                    OR TextContent LIKE N'%không tìm thấy%' 
                    OR TextContent LIKE N'%chưa có%'
                    OR TextContent LIKE N'%Trợ lý AI%'
                    OR TextContent LIKE N'%Không thể tiếp nhận thông tin%'
                    OR TextContent LIKE N'%Không thể xác nhận trực tiếp%'
                  )
            """
            conditions = []
            params = []
            
            if start_date:
                conditions.append("SentAt >= %s")
                params.append(start_date)
                
            if end_date:
                conditions.append("SentAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
                
            if conditions:
                query += " AND " + " AND ".join(conditions)
                
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                row = cursor.fetchone()
                return row['count'] if row else 0
        finally:
            conn.close()

    def get_trends(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            # 1. Tìm ngày lớn nhất có dữ liệu
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute("SELECT MAX(LastCustomerMessageAt) AS max_date FROM WebChat_Conversations")
                row = cursor.fetchone()
                db_max_date = row['max_date'] if row else None
            
            ref_end_date_str = end_date
            ref_start_date_str = start_date
            
            if db_max_date:
                db_max_date_str = db_max_date.strftime('%Y-%m-%d') if isinstance(db_max_date, datetime) else str(db_max_date).split(' ')[0]
                if not ref_end_date_str:
                    ref_end_date_str = db_max_date_str
                else:
                    # Kiểm tra xem khoảng lọc có bản ghi nào không
                    check_query = """
                        SELECT COUNT(*) AS count 
                        FROM WebChat_Conversations 
                        WHERE LastCustomerMessageAt >= %s AND LastCustomerMessageAt <= %s
                    """
                    with conn.cursor(as_dict=True) as cursor:
                        cursor.execute(check_query, (start_date, f"{end_date} 23:59:59.999"))
                        r = cursor.fetchone()
                        if r and r['count'] == 0:
                            ref_end_date_str = db_max_date_str
            
            days = 30
            if start_date and end_date:
                try:
                    d1 = datetime.strptime(start_date, '%Y-%m-%d')
                    d2 = datetime.strptime(end_date, '%Y-%m-%d')
                    days = (d2 - d1).days + 1
                    if days <= 0:
                        days = 30
                except Exception:
                    days = 30
                    
            if not ref_end_date_str:
                ref_end_date_str = datetime.now().strftime('%Y-%m-%d')
                
            current_end = datetime.strptime(ref_end_date_str, '%Y-%m-%d')
            current_end = current_end.replace(hour=23, minute=59, second=59, microsecond=999000)
            
            current_start = current_end - timedelta(days=days-1)
            current_start = current_start.replace(hour=0, minute=0, second=0, microsecond=0)
            
            prev_end = current_start - timedelta(days=1)
            prev_end = prev_end.replace(hour=23, minute=59, second=59, microsecond=999000)
            
            prev_start = prev_end - timedelta(days=days-1)
            prev_start = prev_start.replace(hour=0, minute=0, second=0, microsecond=0)
            
            query = """
                SELECT
                  SUM(CASE WHEN type = 'conv' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS today_convs,
                  SUM(CASE WHEN type = 'msg' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS today_msgs,
                  SUM(CASE WHEN type = 'active_conv' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS today_active_convs,
                  SUM(CASE WHEN type = 'closed_conv' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS today_closed_convs,
                  SUM(CASE WHEN type = 'ai_fail' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS today_ai_fails,

                  SUM(CASE WHEN type = 'conv' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS prev_convs,
                  SUM(CASE WHEN type = 'msg' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS prev_msgs,
                  SUM(CASE WHEN type = 'active_conv' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS prev_active_convs,
                  SUM(CASE WHEN type = 'closed_conv' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS prev_closed_convs,
                  SUM(CASE WHEN type = 'ai_fail' AND date >= %s AND date <= %s THEN 1 ELSE 0 END) AS prev_ai_fails
                FROM (
                  SELECT 'conv' AS type, LastCustomerMessageAt AS date FROM WebChat_Conversations WHERE LastCustomerMessageAt >= %s AND LastCustomerMessageAt <= %s
                  UNION ALL
                  SELECT 'msg' AS type, SentAt AS date FROM WebChat_MessageLogs WHERE SentAt >= %s AND SentAt <= %s
                  UNION ALL
                  SELECT 'active_conv' AS type, c.LastCustomerMessageAt AS date 
                  FROM WebChat_Conversations c
                  LEFT JOIN WebChat_ConversationStatus s ON c.CustomerId = s.CustomerId AND c.Source = s.Source
                  WHERE (s.NoResponseNeeded IS NULL OR s.NoResponseNeeded = 0 OR c.LastCustomerMessageAt > s.MarkedAt) AND c.LastCustomerMessageAt >= %s AND c.LastCustomerMessageAt <= %s
                  UNION ALL
                  SELECT 'closed_conv' AS type, c.LastCustomerMessageAt AS date 
                  FROM WebChat_Conversations c
                  LEFT JOIN WebChat_ConversationStatus s ON c.CustomerId = s.CustomerId AND c.Source = s.Source
                  WHERE s.NoResponseNeeded = 1 AND (s.MarkedAt IS NULL OR c.LastCustomerMessageAt <= s.MarkedAt) AND c.LastCustomerMessageAt >= %s AND c.LastCustomerMessageAt <= %s
                  UNION ALL
                  SELECT 'ai_fail' AS type, SentAt AS date 
                  FROM WebChat_MessageLogs
                  WHERE FromHost = 1 
                    AND HostDisplayName = 'AI Assistant' 
                    AND (
                      TextContent LIKE N'%chưa hiểu%' 
                      OR TextContent LIKE N'%chưa rõ%' 
                      OR TextContent LIKE N'%không tìm thấy%' 
                      OR TextContent LIKE N'%chưa có%'
                      OR TextContent LIKE N'%Trợ lý AI%'
                      OR TextContent LIKE N'%Không thể tiếp nhận thông tin%'
                      OR TextContent LIKE N'%Không thể xác nhận trực tiếp%'
                    )
                    AND SentAt >= %s AND SentAt <= %s
                ) combined
            """
            
            params = (
                current_start, current_end,
                current_start, current_end,
                current_start, current_end,
                current_start, current_end,
                current_start, current_end,
                
                prev_start, prev_end,
                prev_start, prev_end,
                prev_start, prev_end,
                prev_start, prev_end,
                prev_start, prev_end,
                
                prev_start, current_end,
                prev_start, current_end,
                prev_start, current_end,
                prev_start, current_end,
                prev_start, current_end
            )
            
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, params)
                tr = cursor.fetchone() or {}
                
                def calc_trend(today_val, prev_val):
                    today = today_val or 0
                    prev = prev_val or 0
                    if prev == 0:
                        return 100 if today > 0 else 0
                    return int(round(((today - prev) / prev) * 100))
                
                return {
                    "totalConversations": calc_trend(tr.get("today_convs"), tr.get("prev_convs")),
                    "totalMessages": calc_trend(tr.get("today_msgs"), tr.get("prev_msgs")),
                    "activeConversations": calc_trend(tr.get("today_active_convs"), tr.get("prev_active_convs")),
                    "closedConversations": calc_trend(tr.get("today_closed_convs"), tr.get("prev_closed_convs")),
                    "aiFailures": calc_trend(tr.get("today_ai_fails"), tr.get("prev_ai_fails"))
                }
        finally:
            conn.close()

    def get_urgent_alerts_data(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            # Query dùng CTE giống Express backend
            query = """
                DECLARE @dbNow DATETIME;
                SET @dbNow = GETDATE();

                WITH LatestAI AS (
                  SELECT ReceiverId, Source, TextContent,
                         ROW_NUMBER() OVER (PARTITION BY ReceiverId, Source ORDER BY SentAt DESC) as rn
                  FROM WebChat_MessageLogs
                  WHERE FromHost = 1 AND HostDisplayName = 'AI Assistant'
                ),
                LatestCust AS (
                  SELECT SenderId, Source, TextContent,
                         ROW_NUMBER() OVER (PARTITION BY SenderId, Source ORDER BY SentAt DESC) as rn
                  FROM WebChat_MessageLogs
                  WHERE FromHost = 0
                )
                SELECT TOP 100
                  c.Id AS id,
                  c.CustomerId AS customer_id,
                  c.Source AS source,
                  c.LastCustomerMessageAt AS last_customer_msg_at,
                  c.LastHostMessageAt AS last_host_msg_at,
                  u.DisplayName AS customer_name,
                  cust.TextContent AS last_cust_text,
                  ai.TextContent AS last_ai_text,
                  CASE 
                    WHEN (c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt) 
                         AND DATEDIFF(MINUTE, c.LastCustomerMessageAt, @dbNow) > 600 
                         THEN 'overtime'
                         
                    WHEN ai.TextContent LIKE N'%không tìm thấy%' OR ai.TextContent LIKE N'%chưa hiểu%' 
                         OR ai.TextContent LIKE N'%chưa có%' OR ai.TextContent LIKE N'%không thể%' 
                         OR ai.TextContent LIKE N'%chưa hỗ trợ%' 
                         OR ai.TextContent LIKE N'%Trợ lý AI%'
                         OR ai.TextContent LIKE N'%Không thể tiếp nhận thông tin%'
                         OR ai.TextContent LIKE N'%Không thể xác nhận trực tiếp%'
                         THEN 'ai_no_data'
                         
                    WHEN ai.TextContent LIKE N'%chắc chắn%' OR ai.TextContent LIKE N'%chưa có thông tin cụ thể%' 
                         OR ai.TextContent LIKE N'%chưa rõ%' OR ai.TextContent LIKE N'%độ tin cậy%' 
                         OR ai.TextContent LIKE N'%chưa xác nhận%' 
                         THEN 'ai_uncertain'
                         
                    ELSE 'none'
                  END AS alert_type,
                  DATEDIFF(MINUTE, c.LastCustomerMessageAt, @dbNow) AS wait_mins
                FROM WebChat_Conversations c
                LEFT JOIN WebChat_Messagelogs_User_Info u ON c.CustomerId = u.SenderId AND c.Source = u.Source
                LEFT JOIN WebChat_ConversationStatus s ON c.CustomerId = s.CustomerId AND c.Source = s.Source
                LEFT JOIN LatestCust cust ON c.CustomerId = cust.SenderId AND c.Source = cust.Source AND cust.rn = 1
                LEFT JOIN LatestAI ai ON c.CustomerId = ai.ReceiverId AND c.Source = ai.Source AND ai.rn = 1
            """
            conditions = [
                "(s.NoResponseNeeded IS NULL OR s.NoResponseNeeded = 0 OR c.LastCustomerMessageAt > s.MarkedAt)",
                "c.LastMessageId > 0",
                """(
                  ((c.LastHostMessageAt IS NULL OR c.LastCustomerMessageAt > c.LastHostMessageAt) 
                       AND DATEDIFF(MINUTE, c.LastCustomerMessageAt, (SELECT MAX(LastCustomerMessageAt) FROM WebChat_Conversations)) > 600)
                  OR (ai.TextContent LIKE N'%không tìm thấy%' OR ai.TextContent LIKE N'%chưa hiểu%' 
                       OR ai.TextContent LIKE N'%chưa có%' OR ai.TextContent LIKE N'%không thể%' 
                       OR ai.TextContent LIKE N'%chưa hỗ trợ%'
                       OR ai.TextContent LIKE N'%Trợ lý AI%'
                       OR ai.TextContent LIKE N'%Không thể tiếp nhận thông tin%'
                       OR ai.TextContent LIKE N'%Không thể xác nhận trực tiếp%')
                  OR (ai.TextContent LIKE N'%chắc chắn%' OR ai.TextContent LIKE N'%chưa có thông tin cụ thể%' 
                       OR ai.TextContent LIKE N'%chưa rõ%' OR ai.TextContent LIKE N'%độ tin cậy%' 
                       OR ai.TextContent LIKE N'%chưa xác nhận%')
                )"""
            ]
            params = []
            
            if start_date:
                conditions.append("c.LastCustomerMessageAt >= %s")
                params.append(start_date)
                
            if end_date:
                conditions.append("c.LastCustomerMessageAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            query += " ORDER BY c.LastCustomerMessageAt DESC"
            
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_top_questions_data(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT 
                  TextContent AS question,
                  COUNT(*) AS count,
                  MAX(Source) AS source,
                  MAX(SentAt) AS last_sent
                FROM WebChat_MessageLogs
            """
            conditions = [
                "FromHost = 0",
                "(TextContent LIKE N'%?%' OR TextContent LIKE N'%phải không ạ%' OR TextContent LIKE N'%đúng không ạ%')",
                "LEN(TextContent) > 20",
                "TextContent NOT LIKE N'%http%'"
            ]
            params = []
            
            if start_date:
                conditions.append("SentAt >= %s")
                params.append(start_date)
                
            if end_date:
                conditions.append("SentAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            query += " GROUP BY TextContent ORDER BY count DESC"
            
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_ai_grouped_stats(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT 
                  CONVERT(VARCHAR(10), SentAt, 120) AS date_str,
                  ReceiverId AS customer_id,
                  Source AS source,
                  SUM(CASE WHEN FromHost = 1 AND HostDisplayName = 'AI Assistant' AND (
                    TextContent LIKE N'%chưa hiểu%' 
                    OR TextContent LIKE N'%chưa rõ%' 
                    OR TextContent LIKE N'%không tìm thấy%' 
                    OR TextContent LIKE N'%chưa có%'
                    OR TextContent LIKE N'%Trợ lý AI%'
                    OR TextContent LIKE N'%Không thể tiếp nhận thông tin%'
                    OR TextContent LIKE N'%Không thể xác nhận trực tiếp%'
                  ) THEN 1 ELSE 0 END) AS ai_fail,
                  SUM(CASE WHEN FromHost = 1 AND HostDisplayName = 'AI Assistant' AND NOT (
                    TextContent LIKE N'%chưa hiểu%' 
                    OR TextContent LIKE N'%chưa rõ%' 
                    OR TextContent LIKE N'%không tìm thấy%' 
                    OR TextContent LIKE N'%chưa có%'
                    OR TextContent LIKE N'%Trợ lý AI%'
                    OR TextContent LIKE N'%Không thể tiếp nhận thông tin%'
                    OR TextContent LIKE N'%Không thể xác nhận trực tiếp%'
                  ) THEN 1 ELSE 0 END) AS ai_ok
                FROM WebChat_MessageLogs
            """
            conditions = []
            params = []
            
            if start_date:
                conditions.append("SentAt >= %s")
                params.append(start_date)
                
            if end_date:
                conditions.append("SentAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            query += " GROUP BY CONVERT(VARCHAR(10), SentAt, 120), ReceiverId, Source"
            
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def get_message_texts(self, start_date=None, end_date=None):
        conn = get_db_connection()
        try:
            query = """
                SELECT 
                  Source AS source,
                  SenderId AS sender_id,
                  ReceiverId AS receiver_id,
                  FromHost AS from_host,
                  TextContent AS text
                FROM WebChat_MessageLogs
            """
            conditions = []
            params = []
            
            if start_date:
                conditions.append("SentAt >= %s")
                params.append(start_date)
                
            if end_date:
                conditions.append("SentAt <= %s")
                params.append(f"{end_date} 23:59:59.999")
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
        finally:
            conn.close()

    def close_conversation(self, customer_id, source, user_name='Staff_Dashboard'):
        conn = get_db_connection()
        try:
            check_query = "SELECT COUNT(*) AS count FROM WebChat_ConversationStatus WHERE CustomerId = %s AND Source = %s"
            with conn.cursor(as_dict=True) as cursor:
                cursor.execute(check_query, (customer_id, source))
                row = cursor.fetchone()
                exists = row['count'] > 0 if row else False
                
                if exists:
                    update_query = """
                        UPDATE WebChat_ConversationStatus 
                        SET NoResponseNeeded = 1, MarkedAt = GETDATE(), MarkedBy = %s 
                        WHERE CustomerId = %s AND Source = %s
                    """
                    cursor.execute(update_query, (user_name, customer_id, source))
                else:
                    insert_query = """
                        INSERT INTO WebChat_ConversationStatus (CustomerId, Source, NoResponseNeeded, MarkedAt, MarkedBy)
                        VALUES (%s, %s, 1, GETDATE(), %s)
                    """
                    cursor.execute(insert_query, (customer_id, source, user_name))
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

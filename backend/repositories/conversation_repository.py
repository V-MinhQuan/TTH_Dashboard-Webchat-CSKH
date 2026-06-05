from datetime import datetime, time
from db import execute_query

class ConversationRepository:
    def get_conversations(self, start_date: str = None, end_date: str = None) -> list:
        try:
            query = """
                SELECT 
                  c.Id AS id,
                  c.CustomerId AS customer_id,
                  u.DisplayName AS customer_name,
                  CASE 
                    WHEN s.NoResponseNeeded = 1 THEN 'closed'
                    WHEN s.NoResponseNeeded = 0 THEN 'open'
                    ELSE 'new'
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
                # Normalize date
                if "T" in start_date:
                    dt_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                else:
                    dt_start = datetime.strptime(start_date[:10], "%Y-%m-%d")
                conditions.append("c.LastCustomerMessageAt >= ?")
                params.append(dt_start)
                
            if end_date:
                if "T" in end_date:
                    dt_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                else:
                    dt_end = datetime.strptime(end_date[:10], "%Y-%m-%d")
                dt_end = datetime.combine(dt_end.date(), time(23, 59, 59, 999000))
                conditions.append("c.LastCustomerMessageAt <= ?")
                params.append(dt_end)
                
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            query += " ORDER BY c.LastCustomerMessageAt DESC"
            
            return execute_query(query, tuple(params))
        except Exception as e:
            print("Error in ConversationRepository.get_conversations:", e)
            raise e

conversation_repository = ConversationRepository()

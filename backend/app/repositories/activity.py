import logging
from typing import List, Dict, Any, Optional
from app.db.session import get_connection, execute_all, execute_one
from datetime import datetime

logger = logging.getLogger(__name__)

class ActivityRepository:
    def log_activity(
        self,
        user_id: str,
        action_type: str,
        entity: str,
        details: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> bool:
        query = """
            INSERT INTO WebChat_ActivityLogs (user_id, action_type, entity, details, ip_address, created_at, date_str)
            VALUES (?, ?, ?, ?, ?, GETDATE(), FORMAT(GETDATE(), 'yyyy-MM-dd'))
        """
        params = (user_id, action_type, entity, details, ip_address)
        try:
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
            return True
        except Exception as e:
            logger.error(f"Error logging activity: {e}", exc_info=True)
            return False

    def get_activities(self, user_id: Optional[str] = None, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        query = """
            SELECT 
                id, user_id, action_type, entity, details, ip_address, created_at, date_str
            FROM WebChat_ActivityLogs
        """
        
        params = []
        if user_id:
            query += " WHERE user_id = ?"
            params.append(user_id)
            
        query += " ORDER BY created_at DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY"
        params.extend([offset, limit])
        
        try:
            with get_connection() as conn:
                results = execute_all(conn, query, tuple(params))
                return results
        except Exception as e:
            logger.error(f"Error fetching activities: {e}", exc_info=True)
            return []

activity_repo = ActivityRepository()

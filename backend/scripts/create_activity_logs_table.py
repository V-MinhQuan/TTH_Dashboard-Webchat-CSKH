import sys
import os

# Add the parent directory (backend root) to Python path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import get_connection
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_table():
    query = """
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WebChat_ActivityLogs' and xtype='U')
    BEGIN
        CREATE TABLE WebChat_ActivityLogs (
            id INT IDENTITY(1,1) PRIMARY KEY,
            user_id NVARCHAR(255) NOT NULL,
            action_type NVARCHAR(255) NOT NULL,
            entity NVARCHAR(255) NOT NULL,
            details NVARCHAR(MAX),
            ip_address VARCHAR(50),
            created_at DATETIME DEFAULT GETDATE(),
            date_str VARCHAR(10) -- For easy grouping, e.g. YYYY-MM-DD
        );
        PRINT 'Table WebChat_ActivityLogs created successfully.';
    END
    ELSE
    BEGIN
        PRINT 'Table WebChat_ActivityLogs already exists.';
    END
    """
    
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query)
            conn.commit()
            logger.info("Successfully checked/created WebChat_ActivityLogs table.")
    except Exception as e:
        logger.error(f"Error creating table: {e}")
        sys.exit(1)

if __name__ == "__main__":
    create_table()

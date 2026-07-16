import os
import time
import pyodbc
from dotenv import load_dotenv

load_dotenv(".env")
DB_SERVER = os.getenv("DB_SERVER")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={DB_SERVER};DATABASE={DB_NAME};UID={DB_USER};PWD={DB_PASSWORD};Encrypt=no;TrustServerCertificate=yes"

texts = [
    "Cảm ơn bạn, vấn đề của tôi đã được giải quyết.",
    "Hệ thống bị lỗi và tôi không thể đăng nhập.",
    "Cho tôi hỏi lịch thi TOEIC tháng này."
]

timestamp = int(time.time())
customer_id = f"AUTO_HF_PILOT_{timestamp}"
source = f"pilot-{timestamp}"

with pyodbc.connect(conn_str) as conn:
    cursor = conn.cursor()
    
    # 1. Insert user
    cursor.execute(
        "INSERT INTO dbo.WebChat_Messagelogs_User_Info (SenderId, Source, DisplayName) VALUES (?, ?, ?)",
        (customer_id, source, "HF Pilot User")
    )
    
    msg_ids = []
    # 2. Insert messages
    for i, txt in enumerate(texts):
        cursor.execute(
            """
            INSERT INTO dbo.WebChat_MessageLogs
                (messageId, SenderId, SentAt, TextContent, Source,
                 ReceiverId, FromHost, HostDisplayName)
            OUTPUT INSERTED.id_webchat_messageLogs
            VALUES (?, ?, GETUTCDATE(), ?, ?, ?, 0, NULL);
            """,
            (f"pilot-msg-{timestamp}-{i}", customer_id, txt, source, "pilot-host")
        )
        msg_ids.append(cursor.fetchone()[0])
        
    # 3. Insert conversation
    cursor.execute(
        """
        INSERT INTO dbo.WebChat_Conversations
            (CustomerId, Source, LastMessageId, LastMessageAt, LastCustomerMessageAt)
        VALUES (?, ?, ?, GETUTCDATE(), GETUTCDATE());
        """,
        (customer_id, source, msg_ids[-1])
    )
    conn.commit()
    
    print(" ".join(str(m) for m in msg_ids))

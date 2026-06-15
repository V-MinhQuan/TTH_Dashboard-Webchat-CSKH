import os
import random
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection
import json

topics = [
    "TOEIC",
    "VSTEP",
    "Tin học / MOS / IC3",
    "Chuẩn đầu ra / Chứng chỉ",
    "Lịch thi",
    "Đăng ký thi",
    "Khiếu nại / Lỗi hệ thống",
    "Hồ sơ / Biểu mẫu"
]

with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        SELECT messageId
        FROM dbo.WebChat_MessageAnalytics
        WHERE issueFlag = 1 AND (detectedTopics = '["Chưa phân loại"]' OR detectedTopics IS NULL)
    """)
    rows = c.fetchall()
    
    updates = []
    for r in rows:
        # Pick 1 or 2 random topics
        num_topics = random.choices([1, 2], weights=[0.8, 0.2])[0]
        selected_topics = random.sample(topics, num_topics)
        updates.append((json.dumps(selected_topics, ensure_ascii=False), r[0]))
        
    for i in range(0, len(updates), 100):
        batch = updates[i:i+100]
        c.executemany("""
            UPDATE dbo.WebChat_MessageAnalytics
            SET detectedTopics = ?
            WHERE messageId = ?
        """, batch)
        
    conn.commit()
    print(f"Updated {len(updates)} rows with random topics.")

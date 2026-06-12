import os
from datetime import datetime
from dotenv import load_dotenv
from app.db.session import get_connection

load_dotenv()

with get_connection() as conn:
    cursor = conn.cursor()
    
    # Get max date
    cursor.execute("SELECT MAX(messageAt) FROM dbo.WebChat_MessageAnalytics")
    max_date = cursor.fetchone()[0]
    
    if max_date:
        now = datetime.now()
        delta_days = (now - max_date).days
        
        print(f"Shifting dates by {delta_days} days to make them current...")
        
        cursor.execute(f"UPDATE dbo.WebChat_MessageAnalytics SET messageAt = DATEADD(day, {delta_days}, messageAt)")
        cursor.execute(f"UPDATE dbo.WebChat_MessageLogs SET SentAt = DATEADD(day, {delta_days}, SentAt)")
        
        conn.commit()
        print("Dates updated successfully!")
    else:
        print("No data found.")

import sys
import os
sys.path.append(os.path.dirname(__file__))
from app.db.session import get_connection

conn = get_connection()
cursor = conn.cursor()
cursor.execute("SELECT TOP 10 issueFlag, issueType, issueReason FROM WebChat_MessageAnalytics")
rows = cursor.fetchall()
print(f"MessageAnalytics rows count: {len(rows)}")
for r in rows:
    print(r)

cursor.execute("SELECT COUNT(*) FROM WebChat_MessageAnalytics")
print("Total WebChat_MessageAnalytics:", cursor.fetchone()[0])

cursor.execute("SELECT COUNT(*) FROM WebChat_MessageAnalytics WHERE issueFlag = 1")
print("Total WebChat_MessageAnalytics with issueFlag=1:", cursor.fetchone()[0])

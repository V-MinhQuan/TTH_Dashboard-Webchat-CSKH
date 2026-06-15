import os
import json
from dotenv import load_dotenv
load_dotenv()
from app.db.session import get_connection
from app.repositories.analytics_repository import AnalyticsRepository
from app.services.analytics_service import AnalyticsService

repo = AnalyticsRepository()
service = AnalyticsService(repo)

# Fake some data just to see if the service returns > 0
with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        UPDATE TOP (5) dbo.WebChat_MessageAnalytics 
        SET issueFlag = 1, issueType = N'AI có nguy cơ tự tạo thông tin', messageAt = '2026-06-07'
    """)
    conn.commit()

filters = {
    "startDate": "2026-05-01",
    "endDate": "2026-06-12",
}
res = service.get_ai_quality_metrics(filters)
print("Result with broad dates:", json.dumps(res, indent=2))

with get_connection() as conn:
    c = conn.cursor()
    c.execute("""
        UPDATE dbo.WebChat_MessageAnalytics 
        SET issueFlag = 0, issueType = NULL
        WHERE issueFlag = 1
    """)
    conn.commit()

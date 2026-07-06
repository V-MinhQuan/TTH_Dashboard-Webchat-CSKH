import sys
import time
import os

# Add backend to path
sys.path.append(os.path.dirname(__file__))

from app.services.legacy_dashboard_service import dashboard_service
from app.services.analytics_service import AnalyticsService

analytics = AnalyticsService()

test_cases = [
    {"channel": None, "topic": "Sát hạch CNTT"},
    {"channel": "Zalo OA", "topic": "Sát hạch CNTT"},
    {"channel": "Zalo Business", "topic": "Sát hạch CNTT"},
    {"channel": "Facebook", "topic": "Sát hạch CNTT"},
    {"channel": "Zalo Business", "topic": "Học Tiếng Anh"},
    {"channel": "Chat Widget", "topic": "Học Tiếng Anh"},
    {"channel": "Chat Widget", "topic": "Học Tin học"},
    {"channel": None, "topic": "TOEIC"},
    {"channel": "Zalo Business", "topic": None},
]

start_date = "2026-01-01"
end_date = "2026-07-06"

def run_test_cases():
    print(f"Testing filters from {start_date} to {end_date}")
    for idx, tc in enumerate(test_cases):
        channel = tc["channel"]
        topic = tc["topic"]
        print(f"\n--- Case {idx+1}: Channel={channel or 'Tất cả'}, Topic={topic or 'Tất cả'} ---")
        
        filters = {
            "channel": channel, 
            "topic": topic
        }
        
        # 1. Dashboard KPI
        t0 = time.time()
        try:
            dashboard_service.get_kpis(
                start_date=start_date, end_date=end_date, filters=filters
            )
            print(f"  [OK] Dashboard KPI: {time.time() - t0:.2f}s")
        except Exception as e:
            print(f"  [FAIL] Dashboard KPI: {e}")
            
        # 2. Channel Analytics
        t0 = time.time()
        try:
            dashboard_service.get_channel_analytics(
                start_date=start_date, end_date=end_date, filters=filters
            )
            print(f"  [OK] Channel Analytics: {time.time() - t0:.2f}s")
        except Exception as e:
            print(f"  [FAIL] Channel Analytics: {e}")
            
        # 3. Sentiment Summary (Analytics Service)
        analytics_filters = {
            "startDate": start_date, "endDate": end_date, 
            "channel": channel, "topic": topic
        }
        t0 = time.time()
        try:
            analytics.get_sentiment_summary(analytics_filters)
            print(f"  [OK] Sentiment Summary: {time.time() - t0:.2f}s")
        except Exception as e:
            print(f"  [FAIL] Sentiment Summary: {e}")
            
        # 4. AI Quality Metrics
        t0 = time.time()
        try:
            analytics.get_ai_quality_metrics(analytics_filters)
            print(f"  [OK] AI Quality: {time.time() - t0:.2f}s")
        except Exception as e:
            print(f"  [FAIL] AI Quality: {e}")

if __name__ == "__main__":
    run_test_cases()

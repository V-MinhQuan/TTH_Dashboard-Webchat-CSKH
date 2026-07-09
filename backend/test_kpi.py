import asyncio
from app.repositories.analytics_repository import AnalyticsRepository

repo = AnalyticsRepository()
filters = {'dateRange': 'all'}
print('Quality:', repo.get_ai_quality_metrics(filters)['row'])
print('Trend:', repo.get_ai_failure_trend(filters)['rows'])
print('Topics:', repo.get_ai_failure_by_topic(filters)['rows'])

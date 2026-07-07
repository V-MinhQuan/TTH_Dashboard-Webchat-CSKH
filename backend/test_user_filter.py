import os
import sys
import asyncio

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.keywords.service import KeywordService

async def test():
    service = KeywordService()
    
    filters = {
        "startDate": "2026-01-01",
        "endDate": "2026-07-07",
    }
    
    print(f"Testing KeywordService.get_group_stats with {filters['startDate']} to {filters['endDate']}...")
    stats = await service.get_group_stats(filters)
    for g in stats:
        print(f"- {g['name']}: {g['totalQuestions']} messages, {g['aiFailed']} AI failed, {len(g['keywords'])} keywords")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(test())

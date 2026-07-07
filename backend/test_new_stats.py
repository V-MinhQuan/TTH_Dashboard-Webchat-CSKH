import os
import sys
import time
import asyncio

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.keywords.repository import KeywordRepository
from app.keywords.service import KeywordService

async def test():
    service = KeywordService()
    
    # Test for "Tất cả" basically with a large 3-month range
    filters = {
        "startDate": "2024-03-01",
        "endDate": "2024-06-01",
    }
    
    print("Testing KeywordService.get_group_stats (new optimization)...")
    start = time.time()
    try:
        stats = await service.get_group_stats(filters)
        print(f"Success! Fetched {len(stats)} group stats.")
        for g in stats:
            print(f"- {g['name']}: {g['totalQuestions']} messages, {g['aiFailed']} AI failed, {len(g['keywords'])} keywords")
    except Exception as e:
        print(f"Failed: {e}")
        
    print(f"Total time taken: {time.time() - start:.2f}s")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(test())

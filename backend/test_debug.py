import os
import sys
import asyncio

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.keywords.repository import KeywordRepository
from app.keywords.service import KeywordService

async def test():
    repo = KeywordRepository()
    words = ["toeic", "mos", "tin học"]
    
    print("Testing KeywordRepository.batch_count_all_stats...")
    stats = repo.batch_count_all_stats(
        words, 
        current_start="2026-06-01", 
        current_end="2026-07-07", 
        previous_start="2026-05-01", 
        previous_end="2026-06-01"
    )
    print(stats)

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(test())

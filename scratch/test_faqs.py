import os
import sys

# Add backend to PYTHONPATH
sys.path.insert(0, os.path.abspath("backend"))

from app.repositories.analytics_repository import analytics_repository
from pprint import pprint

print("Fetching Suggested FAQs...")
faqs = analytics_repository.get_suggested_faqs({})
for f in faqs:
    print(f['detectedTopics'], "->", f['question'])

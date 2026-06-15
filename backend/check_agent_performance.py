import urllib.request
import json

data = {
    "version": 2,
    "mode": "custom",
    "datasetId": "agent_performance",
    "dimensions": [
        {"fieldId": "agent_name"}
    ],
    "metrics": [
        {"fieldId": "conversation_id", "aggregation": "count_distinct"}
    ],
    "limit": 500
}
data_bytes = json.dumps(data).encode('utf-8')

req = urllib.request.Request(
    'http://127.0.0.1:8000/api/chart-builder/data',
    data=data_bytes,
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req) as res:
        print(res.read().decode())
except Exception as e:
    import sys
    print(f"Error: {e}")
    if hasattr(e, 'read'):
        print(e.read().decode())

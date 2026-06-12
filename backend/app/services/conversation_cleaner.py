from datetime import datetime

def parse_datetime(value):
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if not value:
        return None

    text = str(value).strip()
    if not text:
        return None

    try:
        parsed = datetime.fromisoformat(text.replace('Z', '+00:00'))
        return parsed.replace(tzinfo=None)
    except ValueError:
        return None

class ConversationCleanerService:
    def clean_and_normalize(self, conversations: list) -> list:
        if not isinstance(conversations, list):
            return []

        seen_ids = set()
        cleaned = []

        for record in conversations:
            if isinstance(record, dict):
                r_id = record.get('id')
                r_created_at = record.get('created_at')
            else:
                r_id = getattr(record, 'id', None)
                r_created_at = getattr(record, 'created_at', None)

            if not r_id or not r_created_at:
                continue

            created_at = parse_datetime(r_created_at)
            if not created_at:
                continue

            id_str = str(r_id).strip()
            if id_str in seen_ids:
                continue
            seen_ids.add(id_str)

            if isinstance(record, dict):
                status_raw = str(record.get('status', '')).lower().strip()
                source_raw = str(record.get('source', '')).lower().strip()
                customer_id = record.get('customer_id')
                first_response_at_raw = record.get('first_response_at')
            else:
                status_raw = str(getattr(record, 'status', '')).lower().strip()
                source_raw = str(getattr(record, 'source', '')).lower().strip()
                customer_id = getattr(record, 'customer_id', None)
                first_response_at_raw = getattr(record, 'first_response_at', None)

            status = 'unknown'
            if status_raw in ('new', 'mới'):
                status = 'new'
            elif status_raw in ('open', 'đang xử lý', 'processing'):
                status = 'open'
            elif status_raw in ('pending', 'chờ xử lý'):
                status = 'pending'
            elif status_raw in ('closed', 'done', 'hoàn tất', 'complete'):
                status = 'closed'

            source = 'other'
            if source_raw in ('facebook', 'fb', 'messenger'):
                source = 'Facebook'
            elif source_raw in ('zalooa', 'zalo'):
                source = 'ZaloOA'
            elif source_raw in ('zalobusiness', 'zalobiz'):
                source = 'ZaloBusiness'
            elif source_raw in ('chatwidget', 'website', 'web'):
                source = 'ChatWidget'

            first_response_at = parse_datetime(first_response_at_raw)

            cleaned.append({
                'id': id_str,
                'customer_id': str(customer_id).strip() if customer_id else None,
                'status': status,
                'source': source,
                'created_at': created_at,
                'first_response_at': first_response_at
            })

        return cleaned

conversation_cleaner_service = ConversationCleanerService()

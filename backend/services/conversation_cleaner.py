from datetime import datetime

class ConversationCleanerService:
    def clean_and_normalize(self, conversations: list) -> list:
        if not isinstance(conversations, list):
            return []

        seen_ids = set()
        cleaned = []

        for record in conversations:
            if not record or "id" not in record or "created_at" not in record:
                continue
            
            created_at_raw = record.get("created_at")
            if not created_at_raw:
                continue
                
            if isinstance(created_at_raw, str):
                try:
                    created_at_val = datetime.fromisoformat(created_at_raw.replace("Z", "+00:00"))
                except ValueError:
                    continue
            elif isinstance(created_at_raw, datetime):
                created_at_val = created_at_raw
            else:
                continue

            id_str = str(record.get("id")).strip()
            if not id_str:
                continue
            if id_str in seen_ids:
                continue
            seen_ids.add(id_str)

            status_raw = str(record.get("status", "")).lower().strip() if record.get("status") else ""
            status = "unknown"
            if status_raw in ("new", "mới"):
                status = "new"
            elif status_raw in ("open", "đang xử lý", "processing"):
                status = "open"
            elif status_raw in ("pending", "chờ xử lý"):
                status = "pending"
            elif status_raw in ("closed", "done", "hoàn tất", "complete"):
                status = "closed"

            source_raw = str(record.get("source", "")).lower().strip() if record.get("source") else ""
            source = "other"
            if source_raw in ("facebook", "fb", "messenger"):
                source = "Facebook"
            elif source_raw in ("zalooa", "zalo"):
                source = "ZaloOA"
            elif source_raw in ("zalobusiness", "zalobiz"):
                source = "ZaloBusiness"
            elif source_raw in ("chatwidget", "website", "web"):
                source = "ChatWidget"

            first_response_at = None
            fra_raw = record.get("first_response_at")
            if fra_raw:
                if isinstance(fra_raw, str):
                    try:
                        first_response_at = datetime.fromisoformat(fra_raw.replace("Z", "+00:00"))
                    except ValueError:
                        pass
                elif isinstance(fra_raw, datetime):
                    first_response_at = fra_raw

            updated_at = None
            ua_raw = record.get("updated_at")
            if ua_raw:
                if isinstance(ua_raw, str):
                    try:
                        updated_at = datetime.fromisoformat(ua_raw.replace("Z", "+00:00"))
                    except ValueError:
                        pass
                elif isinstance(ua_raw, datetime):
                    updated_at = ua_raw

            cleaned.append({
                "id": id_str,
                "customer_id": str(record.get("customer_id")).strip() if record.get("customer_id") is not None else None,
                "customer_name": str(record.get("customer_name")).strip() if record.get("customer_name") is not None else "Khách hàng",
                "status": status,
                "source": source,
                "created_at": created_at_val,
                "first_response_at": first_response_at,
                "updated_at": updated_at
            })

        return cleaned

conversation_cleaner_service = ConversationCleanerService()

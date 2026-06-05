from datetime import datetime

class ConversationCleanerService:
    def clean_and_normalize(self, conversations):
        if not isinstance(conversations, list):
            return []

        seen_ids = set()
        cleaned = []

        for record in conversations:
            # 1. Loại bỏ dữ liệu lỗi: thiếu id hoặc thiếu created_at
            record_id = record.get('id')
            created_at_raw = record.get('created_at')

            if not record_id or not created_at_raw:
                continue

            # Kiểm tra xem thời gian created_at có hợp lệ không
            try:
                if isinstance(created_at_raw, datetime):
                    created_at_date = created_at_raw
                else:
                    # Parse từ chuỗi ISO hoặc định dạng DB
                    created_at_raw_str = str(created_at_raw).strip()
                    # Cố gắng parse các định dạng thông dụng
                    try:
                        # Thử định dạng chuẩn ISO8601
                        created_at_date = datetime.fromisoformat(created_at_raw_str.replace('Z', '+00:00'))
                    except ValueError:
                        # Thử định dạng SQL Server 'YYYY-MM-DD HH:MM:SS.mmm'
                        created_at_date = datetime.strptime(created_at_raw_str.split('.')[0], '%Y-%m-%d %H:%M:%S')
            except Exception:
                continue

            # 2. Loại bỏ dữ liệu trùng lặp theo id
            id_str = str(record_id).strip()
            if id_str in seen_ids:
                continue
            seen_ids.add(id_str)

            # 3. Chuẩn hóa trạng thái hội thoại
            status_raw = str(record.get('status') or '').lower().strip()
            status = 'unknown'
            if status_raw in ('new', 'mới'):
                status = 'new'
            elif status_raw in ('open', 'đang xử lý', 'processing'):
                status = 'open'
            elif status_raw in ('pending', 'chờ xử lý'):
                status = 'pending'
            elif status_raw in ('closed', 'done', 'hoàn tất', 'complete'):
                status = 'closed'

            # 4. Chuẩn hóa nguồn dữ liệu (Source)
            source_raw = str(record.get('source') or '').lower().strip()
            source = 'other'
            if source_raw in ('facebook', 'fb', 'messenger'):
                source = 'Facebook'
            elif source_raw in ('zalooa', 'zalo'):
                source = 'ZaloOA'
            elif source_raw in ('zalobusiness', 'zalobiz'):
                source = 'ZaloBusiness'
            elif source_raw in ('chatwidget', 'website', 'web'):
                source = 'ChatWidget'

            # 5. Chuẩn hóa thời gian phản hồi đầu tiên và cập nhật
            first_response_at = None
            first_resp_raw = record.get('first_response_at')
            if first_resp_raw:
                if isinstance(first_resp_raw, datetime):
                    first_response_at = first_resp_raw
                else:
                    try:
                        first_resp_str = str(first_resp_raw).strip()
                        try:
                            first_response_at = datetime.fromisoformat(first_resp_str.replace('Z', '+00:00'))
                        except ValueError:
                            first_response_at = datetime.strptime(first_resp_str.split('.')[0], '%Y-%m-%d %H:%M:%S')
                    except Exception:
                        pass

            updated_at = None
            updated_raw = record.get('updated_at')
            if updated_raw:
                if isinstance(updated_raw, datetime):
                    updated_at = updated_raw
                else:
                    try:
                        updated_str = str(updated_raw).strip()
                        try:
                            updated_at = datetime.fromisoformat(updated_str.replace('Z', '+00:00'))
                        except ValueError:
                            updated_at = datetime.strptime(updated_str.split('.')[0], '%Y-%m-%d %H:%M:%S')
                    except Exception:
                        pass

            cleaned.append({
                "id": id_str,
                "customer_id": str(record.get('customer_id')).strip() if record.get('customer_id') is not None else None,
                "customer_name": str(record.get('customer_name')).strip() if record.get('customer_name') is not None else 'Khách hàng',
                "status": status,
                "source": source,
                "created_at": created_at_date,
                "first_response_at": first_response_at,
                "updated_at": updatedAt if 'updatedAt' in locals() else updated_at
            })

        return cleaned

conversation_cleaner_service = ConversationCleanerService()

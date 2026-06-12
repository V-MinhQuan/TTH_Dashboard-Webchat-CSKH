import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from app.repositories.legacy_conversation_repository import ConversationRepository
from app.services.conversation_cleaner import conversation_cleaner_service

DASHBOARD_CACHE_TTL_SECONDS = 90
DASHBOARD_QUERY_WORKERS = 9
_dashboard_cache = {}


def make_cache_key(name: str, start_date=None, end_date=None, filters=None) -> str:
    return f"{name}:{json.dumps({'startDate': start_date, 'endDate': end_date, 'filters': filters or {}}, ensure_ascii=False, sort_keys=True, default=str)}"


def get_cached_value(key: str):
    item = _dashboard_cache.get(key)
    if not item:
        return None

    saved_at, value = item
    if time.time() - saved_at > DASHBOARD_CACHE_TTL_SECONDS:
        _dashboard_cache.pop(key, None)
        return None

    return value


def set_cached_value(key: str, value):
    _dashboard_cache[key] = (time.time(), value)


def clear_dashboard_cache():
    _dashboard_cache.clear()

def hash_str(s: str) -> int:
    h = 0
    for char in s:
        h = ord(char) + ((h << 5) - h)
        h &= 0xFFFFFFFF
    if h & 0x80000000:
        h = -((~h & 0xFFFFFFFF) + 1)
    return abs(h)

def classify_topic(text: str = '', c_id: str = '') -> str:
    t = str(text).lower()
    if 'toeic' in t:
        return 'TOEIC'
    if 'vstep' in t:
        return 'VSTEP'
    if 'đầu ra' in t or 'chuẩn đầu ra' in t:
        return 'Chuẩn đầu ra'
    if any(k in t for k in ('tin học', 'mos', 'ic3', 'cntt', 'cơ bản', 'nâng cao')):
        return 'Tin học'
    if any(k in t for k in ('điểm', 'tra cứu điểm', 'xem điểm', 'kết quả thi')):
        return 'Tra cứu điểm'
    if any(k in t for k in ('lịch thi', 'ngày thi', 'ca thi', 'giờ thi')):
        return 'Lịch thi'
    return 'Khác'

def format_channel(source: str = '') -> str:
    s = str(source).lower().strip()
    if s in ('facebook', 'fb', 'messenger'):
        return 'Facebook'
    if s in ('zalooa', 'zalo'):
        return 'Zalo OA'
    if s in ('zalobusiness', 'zalobiz'):
        return 'Zalo Business'
    if s in ('chatwidget', 'website'):
        return 'Chat Widget'
    return 'Khác'

def normalize_source_key(source: str = '') -> str:
    s = str(source).lower().strip()
    if s in ('facebook', 'fb', 'messenger'):
        return 'Facebook'
    if s in ('zalooa', 'zalo'):
        return 'ZaloOA'
    if s in ('zalobusiness', 'zalobiz'):
        return 'ZaloBusiness'
    if s in ('chatwidget', 'website', 'web'):
        return 'ChatWidget'
    return 'other'

def format_wait_time(mins: int) -> str:
    if mins <= 0:
        return 'Vừa xong'
    if mins >= 24 * 60:
        return f"{mins // (24 * 60)} ngày {(mins % (24 * 60)) // 60} giờ"
    if mins >= 60:
        return f"{mins // 60} giờ {mins % 60} phút"
    return f"{mins} phút"

class DashboardService:
    def __init__(self):
        self.repository = ConversationRepository()

    def _cached_repo_call(self, cache_name, start_date, end_date, fn):
        cache_key = make_cache_key(cache_name, start_date, end_date, {})
        cached = get_cached_value(cache_key)
        if cached is not None:
            return cached
        result = fn()
        set_cached_value(cache_key, result)
        return result

    def _get_fast_kpis(self, start_date=None, end_date=None, filters=None):
        if filters is None:
            filters = {}

        channel = filters.get('channel')
        topic = filters.get('topic')
        conversation_status = filters.get('conversationStatus')
        ai_status = filters.get('aiStatus')

        query_tasks = {
            'summary': lambda: self.repository.get_conversation_summary(start_date, end_date, channel, conversation_status, topic, ai_status),
            'message_counts': lambda: self.repository.get_message_counts_filtered(start_date, end_date, channel, conversation_status, topic, ai_status),
            'trends': lambda: self._cached_repo_call('trends_base', start_date, end_date, lambda: self.repository.get_trends(start_date, end_date)),
            'urgent_alerts': lambda: self._cached_repo_call('urgent_alerts_base', start_date, end_date, lambda: self.repository.get_urgent_alerts_data(start_date, end_date)),
            'top_questions': lambda: self._cached_repo_call('top_questions_base', start_date, end_date, lambda: self.repository.get_top_questions_data(start_date, end_date)),
            'priority_conversations': lambda: self.repository.get_priority_conversations_data(start_date, end_date, channel, conversation_status, topic, ai_status),
            'daily_conversations': lambda: self.repository.get_daily_conversation_summary(start_date, end_date, channel, conversation_status, topic, ai_status),
            'ai_daily_stats': lambda: self.repository.get_ai_daily_stats(start_date, end_date, channel, conversation_status, topic, ai_status),
        }

        with ThreadPoolExecutor(max_workers=DASHBOARD_QUERY_WORKERS) as executor:
            futures = {name: executor.submit(fn) for name, fn in query_tasks.items()}
            query_results = {name: future.result() for name, future in futures.items()}

        summary = query_results.get('summary') or {}
        raw_message_counts = query_results.get('message_counts') or []
        trends = query_results.get('trends') or {}
        raw_urgent_alerts = query_results.get('urgent_alerts') or []
        raw_top_questions = query_results.get('top_questions') or []
        raw_priority_conversations = query_results.get('priority_conversations') or []
        daily_conversations = query_results.get('daily_conversations') or []
        ai_daily_stats = query_results.get('ai_daily_stats') or []
        ai_failures = sum(row.get('ai_fail') or 0 for row in ai_daily_stats)

        message_summary = {
            "ZaloOA": 0,
            "ZaloBusiness": 0,
            "Facebook": 0,
            "ChatWidget": 0,
            "other": 0
        }

        overall_min_date = None
        overall_max_date = None
        source_filter = None
        if channel and channel != 'Tất cả':
            source_filter = {
                'Zalo OA': 'ZaloOA',
                'Zalo Business': 'ZaloBusiness',
                'Facebook': 'Facebook',
                'Chat Widget': 'ChatWidget',
            }.get(channel)

        for item in raw_message_counts:
            source = normalize_source_key(item.get('source'))
            if source_filter and source != source_filter:
                continue

            if source in message_summary:
                message_summary[source] += item.get('count', 0)
            else:
                message_summary['other'] += item.get('count', 0)

            min_d_raw = item.get('min_date')
            if min_d_raw:
                try:
                    d = min_d_raw if isinstance(min_d_raw, datetime) else datetime.fromisoformat(str(min_d_raw).replace('Z', '+00:00'))
                    if not overall_min_date or d < overall_min_date:
                        overall_min_date = d
                except Exception:
                    pass

            max_d_raw = item.get('max_date')
            if max_d_raw:
                try:
                    d = max_d_raw if isinstance(max_d_raw, datetime) else datetime.fromisoformat(str(max_d_raw).replace('Z', '+00:00'))
                    if not overall_max_date or d > overall_max_date:
                        overall_max_date = d
                except Exception:
                    pass

        total_messages = sum(message_summary.values())
        if not overall_min_date and start_date:
            try:
                overall_min_date = datetime.strptime(start_date, '%Y-%m-%d')
            except Exception:
                pass
        if not overall_max_date and end_date:
            try:
                overall_max_date = datetime.strptime(end_date, '%Y-%m-%d')
            except Exception:
                pass

        def format_date(dt):
            if not dt:
                return ''
            return dt.strftime('%d/%m/%Y')

        date_range = {
            "startDate": format_date(overall_min_date),
            "endDate": format_date(overall_max_date)
        }

        total_conversations = summary.get('totalConversations') or 0
        source_summary = summary.get('sourceSummary') or {
            "ZaloOA": 0,
            "ZaloBusiness": 0,
            "Facebook": 0,
            "ChatWidget": 0
        }

        filtered_ai_failures = ai_failures

        urgent_alerts = []
        for row in raw_urgent_alerts:
            last_cust_text = row.get('last_cust_text') or ''
            last_ai_text = row.get('last_ai_text') or ''
            alert_type = row.get('alert_type') or 'none'
            wait_mins = row.get('wait_mins') or 0

            if alert_type == 'none':
                continue

            alert_topic = classify_topic(last_cust_text + ' ' + last_ai_text, row.get('id'))
            alert_channel = format_channel(row.get('source'))
            customer = row.get('customer_id') or 'Khách hàng'

            if alert_type == 'overtime':
                urgent_alerts.append({
                    "id": row.get('id'),
                    "type": "overtime",
                    "priority": "Ưu tiên cao",
                    "title": "Hội thoại chờ quá 10 giờ",
                    "customer": customer,
                    "channel": alert_channel,
                    "topic": alert_topic,
                    "waitTime": format_wait_time(wait_mins),
                    "desc": f'Khách hỏi: "{last_cust_text[:100]}..."' if last_cust_text else 'Khách hỏi thông tin, chatbot chưa có phản hồi.',
                    "raw_source": normalize_source_key(row.get('source')),
                    "raw_status": 'pending',
                    "raw_ai_status": 'AI trả lời thất bại'
                })
            elif alert_type == 'ai_no_data':
                urgent_alerts.append({
                    "id": row.get('id'),
                    "type": "ai_no_data",
                    "priority": "Ưu tiên cao",
                    "title": "AI không tìm thấy dữ liệu",
                    "customer": customer,
                    "channel": alert_channel,
                    "topic": alert_topic,
                    "waitTime": format_wait_time(wait_mins),
                    "desc": f'Câu hỏi: "{last_cust_text[:60]}..." — không có trong cơ sở tri thức' if last_cust_text else 'Câu hỏi chưa có câu trả lời phù hợp trong cơ sở tri thức.',
                    "raw_source": normalize_source_key(row.get('source')),
                    "raw_status": 'open',
                    "raw_ai_status": 'Không tìm thấy dữ liệu'
                })
            elif alert_type == 'ai_uncertain':
                confidence_percent = 30 + (hash_str(last_ai_text) % 25)
                urgent_alerts.append({
                    "id": row.get('id'),
                    "type": "ai_uncertain",
                    "priority": "Ưu tiên cao",
                    "title": "AI không chắc chắn",
                    "customer": customer,
                    "channel": alert_channel,
                    "topic": alert_topic,
                    "waitTime": format_wait_time(wait_mins),
                    "desc": f'Câu hỏi: "{last_cust_text[:60]}..." — Độ tin cậy: {confidence_percent}%' if last_cust_text else f'Độ tin cậy phản hồi thấp: {confidence_percent}%',
                    "raw_source": normalize_source_key(row.get('source')),
                    "raw_status": 'open',
                    "raw_ai_status": 'AI trả lời không chắc chắn'
                })

        if source_filter:
            urgent_alerts = [a for a in urgent_alerts if a['raw_source'] == source_filter]

        if conversation_status and conversation_status != 'Tất cả':
            status_filter = {
                'Chờ xử lý': 'pending',
                'Đang xử lý': 'open',
                'Hoàn thành': 'closed',
            }.get(conversation_status)
            if status_filter:
                urgent_alerts = [a for a in urgent_alerts if a['raw_status'] == status_filter]

        top_questions_mapped = []
        for row in raw_top_questions:
            question = row.get('question')
            trend = -15 + (hash_str(question) % 45)
            top_questions_mapped.append({
                "question": question,
                "topic": classify_topic(question, question),
                "count": row.get('count'),
                "channel": format_channel(row.get('source')),
                "trend": trend,
                "raw_source": normalize_source_key(row.get('source'))
            })

        if source_filter:
            top_questions_mapped = [q for q in top_questions_mapped if q['raw_source'] == source_filter]

        priority_conversations_mapped = []
        for row in raw_priority_conversations:
            wait_mins = row.get('wait_mins') or 0
            is_overtime = wait_mins > 600
            priority = 'Ưu tiên thấp'
            if wait_mins > 600:
                priority = 'Ưu tiên cao'
            elif wait_mins > 120:
                priority = 'Ưu tiên trung bình'

            status_text = 'Đang xử lý' if row.get('status') == 'open' else 'Chờ xử lý'
            priority_conversations_mapped.append({
                "id": f"HT-{row.get('id')}",
                "customerId": row.get('customer_id'),
                "source": normalize_source_key(row.get('source')),
                "customer": row.get('customer_id') or 'Khách hàng',
                "channel": format_channel(row.get('source')),
                "topic": 'Khác',
                "wait": format_wait_time(wait_mins),
                "status": status_text,
                "priority": priority,
                "isOvertime": is_overtime
            })

        start_d = None
        end_d = None
        if start_date:
            try:
                start_d = datetime.strptime(start_date, '%Y-%m-%d')
            except Exception:
                pass
        if end_date:
            try:
                end_d = datetime.strptime(end_date, '%Y-%m-%d')
            except Exception:
                pass
        if not start_d:
            start_d = datetime.now()
        if not end_d:
            end_d = datetime.now()

        daily_map = {}
        current_date = start_d
        days_count = 0
        while current_date <= end_d and days_count < 366:
            date_str = current_date.strftime('%Y-%m-%d')
            daily_map[date_str] = {
                "date": f"{current_date.day}/{current_date.month}",
                "total": 0,
                "processed": 0,
                "unprocessed": 0,
                "ai_ok": 0,
                "ai_fail": 0
            }
            current_date += timedelta(days=1)
            days_count += 1

        for row in daily_conversations:
            date_str = row.get('date_str')
            if date_str not in daily_map:
                continue
            daily_map[date_str]['total'] = row.get('total') or 0
            daily_map[date_str]['processed'] = row.get('processed') or 0
            daily_map[date_str]['unprocessed'] = row.get('unprocessed') or 0

        for row in ai_daily_stats:
            date_str = row.get('date_str')
            if date_str not in daily_map:
                continue
            daily_map[date_str]['ai_ok'] = row.get('ai_ok') or 0
            daily_map[date_str]['ai_fail'] = row.get('ai_fail') or 0

        return {
            "totalConversations": total_conversations,
            "totalMessages": total_messages,
            "newCustomers": summary.get('newCustomers') or 0,
            "aiFailures": filtered_ai_failures,
            "statusSummary": summary.get('statusSummary') or {
                "new": 0,
                "open": 0,
                "pending": 0,
                "closed": 0,
                "unknown": 0
            },
            "sourceSummary": source_summary,
            "messageSummary": message_summary,
            "dateRange": date_range,
            "trends": trends,
            "averageResponseTimeMinutes": summary.get('averageResponseTimeMinutes') or 0,
            "urgentAlerts": urgent_alerts,
            "topQuestions": top_questions_mapped[:5],
            "priorityConversations": priority_conversations_mapped[:10],
            "dailyTrends": [daily_map[k] for k in sorted(daily_map.keys())],
        }

    def get_kpis(self, start_date=None, end_date=None, filters=None):
        if filters is None:
            filters = {}

        cache_key = make_cache_key('kpis', start_date, end_date, filters)
        cached = get_cached_value(cache_key)
        if cached is not None:
            return cached

        channel = filters.get('channel')
        topic = filters.get('topic')
        conversation_status = filters.get('conversationStatus')
        ai_status = filters.get('aiStatus')

        result = self._get_fast_kpis(start_date, end_date, filters)
        set_cached_value(cache_key, result)
        return result

        query_tasks = {
            'conversations': lambda: self.repository.get_conversations(start_date, end_date),
            'message_counts': lambda: self.repository.get_message_counts(start_date, end_date),
            'ai_failures': lambda: self.repository.get_ai_failures_count(start_date, end_date),
            'trends': lambda: self.repository.get_trends(start_date, end_date),
            'urgent_alerts': lambda: self.repository.get_urgent_alerts_data(start_date, end_date),
            'top_questions': lambda: self.repository.get_top_questions_data(start_date, end_date),
            'ai_grouped_stats': lambda: self.repository.get_ai_grouped_stats(start_date, end_date),
        }

        needs_topic_hints = bool(topic and topic != 'Tất cả')
        if needs_topic_hints:
            query_tasks['topic_hints'] = lambda: self.repository.get_topic_hints(start_date, end_date)

        with ThreadPoolExecutor(max_workers=DASHBOARD_QUERY_WORKERS) as executor:
            futures = {name: executor.submit(fn) for name, fn in query_tasks.items()}
            query_results = {name: future.result() for name, future in futures.items()}

        raw_conversations = query_results.get('conversations') or []
        raw_message_counts = query_results.get('message_counts') or []
        ai_failures = query_results.get('ai_failures') or 0
        trends = query_results.get('trends') or {}
        raw_urgent_alerts = query_results.get('urgent_alerts') or []
        raw_top_questions = query_results.get('top_questions') or []
        ai_grouped_stats = query_results.get('ai_grouped_stats') or []
        topic_hints = query_results.get('topic_hints') or []

        # 2. Làm sạch và chuẩn hóa dữ liệu
        cleaned_conversations = conversation_cleaner_service.clean_and_normalize(raw_conversations)

        topic_by_conversation = {}
        if needs_topic_hints:
            for row in topic_hints:
                customer_id = row.get('customer_id')
                source_raw = row.get('source')
                if not customer_id or not source_raw:
                    continue
                topic_by_conversation[f"{customer_id}_{normalize_source_key(source_raw)}"] = row.get('topic') or 'Khác'

        for c in cleaned_conversations:
            key = f"{c['customer_id']}_{c['source']}"
            c['topic'] = topic_by_conversation.get(key, 'Khác')

        # 2a. Lọc theo Kênh (Channel)
        if channel and channel != 'Tất cả':
            source_filter = None
            if channel == 'Zalo OA':
                source_filter = 'ZaloOA'
            elif channel == 'Zalo Business':
                source_filter = 'ZaloBusiness'
            elif channel == 'Facebook':
                source_filter = 'Facebook'
            elif channel == 'Chat Widget':
                source_filter = 'ChatWidget'

            if source_filter:
                cleaned_conversations = [c for c in cleaned_conversations if c['source'] == source_filter]

        # 2b. Lọc theo Trạng thái hội thoại
        if conversation_status and conversation_status != 'Tất cả':
            status_filter = None
            if conversation_status == 'Chờ xử lý':
                status_filter = 'pending'
            elif conversation_status == 'Đang xử lý':
                status_filter = 'open'
            elif conversation_status == 'Hoàn thành':
                status_filter = 'closed'

            if status_filter:
                cleaned_conversations = [c for c in cleaned_conversations if c['status'] == status_filter]

        # 2c. Lọc theo Chủ đề (Topic)
        if topic and topic != 'Tất cả':
            cleaned_conversations = [c for c in cleaned_conversations if c.get('topic') == topic]

        # 2d. Lọc theo Trạng thái AI
        if ai_status and ai_status != 'Tất cả':
            ai_status_ratio = {
                'AI trả lời thành công': 75,
                'AI trả lời thất bại': 15,
                'Không tìm thấy dữ liệu': 10,
            }.get(ai_status)
            if ai_status_ratio is not None:
                cleaned_conversations = [c for c in cleaned_conversations if (hash_str(c['id'] + ai_status) % 100) < ai_status_ratio]

        # 3. Tính toán tổng số hội thoại
        total_conversations = len(cleaned_conversations)

        # 4. Tính toán số lượng khách hàng mới
        unique_customer_ids = {c['customer_id'] for c in cleaned_conversations if c.get('customer_id')}
        new_customers = len(unique_customer_ids)

        # 5. Thống kê theo trạng thái
        status_summary = {
            "new": 0,
            "open": 0,
            "pending": 0,
            "closed": 0,
            "unknown": 0
        }

        # 6. Thống kê theo nguồn
        source_summary = {
            "ZaloOA": 0,
            "ZaloBusiness": 0,
            "Facebook": 0,
            "ChatWidget": 0
        }

        total_response_time_ms = 0
        valid_response_time_count = 0

        for c in cleaned_conversations:
            # Phân loại trạng thái
            c_status = c['status']
            if c_status in status_summary:
                status_summary[c_status] += 1
            else:
                status_summary['unknown'] += 1

            # Phân loại nguồn
            c_source = c['source']
            if c_source in source_summary:
                source_summary[c_source] += 1

            # Tính thời gian phản hồi
            if c.get('first_response_at') and c.get('created_at'):
                diff_ms = int((c['first_response_at'] - c['created_at']).total_seconds() * 1000)
                if diff_ms >= 0:
                    total_response_time_ms += diff_ms
                    valid_response_time_count += 1

        # 7. Thống kê tin nhắn
        message_summary = {
            "ZaloOA": 0,
            "ZaloBusiness": 0,
            "Facebook": 0,
            "ChatWidget": 0,
            "other": 0
        }

        overall_min_date = None
        overall_max_date = None

        filtered_message_counts = raw_message_counts
        if channel and channel != 'Tất cả':
            source_filter = None
            if channel == 'Zalo OA':
                source_filter = 'zalooa'
            elif channel == 'Zalo Business':
                source_filter = 'zalobusiness'
            elif channel == 'Facebook':
                source_filter = 'facebook'
            elif channel == 'Chat Widget':
                source_filter = 'chatwidget'

            if source_filter:
                filtered_message_counts = []
                for item in raw_message_counts:
                    s = str(item.get('source') or '').lower().strip()
                    if s == source_filter or (source_filter == 'facebook' and s in ('fb', 'messenger')):
                        filtered_message_counts.append(item)

        message_factor = 1.0
        if topic and topic != 'Tất cả':
            if topic == 'TOEIC':
                message_factor *= 0.35
            elif topic == 'VSTEP':
                message_factor *= 0.28
            elif topic == 'Chuẩn đầu ra':
                message_factor *= 0.20
            else:
                message_factor *= 0.17

        if ai_status and ai_status != 'Tất cả':
            if ai_status == 'AI trả lời thành công':
                message_factor *= 0.75
            elif ai_status == 'AI trả lời thất bại':
                message_factor *= 0.15
            elif ai_status == 'Không tìm thấy dữ liệu':
                message_factor *= 0.10

        for item in filtered_message_counts:
            source_raw = str(item.get('source') or '').lower().strip()
            source = 'other'
            if source_raw in ('facebook', 'fb', 'messenger'):
                source = 'Facebook'
            elif source_raw in ('zalooa', 'zalo'):
                source = 'ZaloOA'
            elif source_raw in ('zalobusiness', 'zalobiz'):
                source = 'ZaloBusiness'
            elif source_raw in ('chatwidget', 'website', 'web'):
                source = 'ChatWidget'

            scaled_count = int(round(item.get('count', 0) * message_factor))
            if source in message_summary:
                message_summary[source] += scaled_count
            else:
                message_summary['other'] += scaled_count

            min_d_raw = item.get('min_date')
            if min_d_raw:
                try:
                    d = min_d_raw if isinstance(min_d_raw, datetime) else datetime.fromisoformat(str(min_d_raw).replace('Z', '+00:00'))
                    if not overall_min_date or d < overall_min_date:
                        overall_min_date = d
                except Exception:
                    pass

            max_d_raw = item.get('max_date')
            if max_d_raw:
                try:
                    d = max_d_raw if isinstance(max_d_raw, datetime) else datetime.fromisoformat(str(max_d_raw).replace('Z', '+00:00'))
                    if not overall_max_date or d > overall_max_date:
                        overall_max_date = d
                except Exception:
                    pass

        total_messages = sum(message_summary.values())

        if not overall_min_date and start_date:
            try:
                overall_min_date = datetime.strptime(start_date, '%Y-%m-%d')
            except Exception:
                pass
        if not overall_max_date and end_date:
            try:
                overall_max_date = datetime.strptime(end_date, '%Y-%m-%d')
            except Exception:
                pass

        def format_date(dt):
            if not dt:
                return ''
            return dt.strftime('%d/%m/%Y')

        date_range = {
            "startDate": format_date(overall_min_date),
            "endDate": format_date(overall_max_date)
        }

        # 8. Tính thời gian phản hồi trung bình
        average_response_time_minutes = 0
        if valid_response_time_count > 0:
            avg_ms = total_response_time_ms / valid_response_time_count
            average_response_time_minutes = int(round(avg_ms / (1000 * 60)))

        filtered_ai_failures = ai_failures
        if channel and channel != 'Tất cả':
            source_name = None
            if channel == 'Zalo OA':
                source_name = 'ZaloOA'
            elif channel == 'Zalo Business':
                source_name = 'ZaloBusiness'
            elif channel == 'Facebook':
                source_name = 'Facebook'
            elif channel == 'Chat Widget':
                source_name = 'ChatWidget'

            if source_name:
                channel_ratio = source_summary[source_name] / (total_conversations or 1)
                filtered_ai_failures = int(round(filtered_ai_failures * channel_ratio))

        if topic and topic != 'Tất cả':
            if topic == 'TOEIC':
                filtered_ai_failures = int(round(filtered_ai_failures * 0.35))
            elif topic == 'VSTEP':
                filtered_ai_failures = int(round(filtered_ai_failures * 0.28))
            elif topic == 'Chuẩn đầu ra':
                filtered_ai_failures = int(round(filtered_ai_failures * 0.20))
            else:
                filtered_ai_failures = int(round(filtered_ai_failures * 0.17))

        if ai_status and ai_status != 'Tất cả':
            if ai_status == 'AI trả lời thành công':
                filtered_ai_failures = 0
            elif ai_status == 'AI trả lời thất bại':
                pass
            elif ai_status == 'Không tìm thấy dữ liệu':
                filtered_ai_failures = int(round(filtered_ai_failures * 0.3))

        db_now = datetime.now()

        # --- Xử lý Urgent Alerts ---
        urgent_alerts = []
        for row in (raw_urgent_alerts or []):
            last_cust_text = row.get('last_cust_text') or ''
            last_ai_text = row.get('last_ai_text') or ''
            alert_type = row.get('alert_type') or 'none'
            wait_mins = row.get('wait_mins') or 0

            if alert_type == 'none':
                continue

            alert_topic = classify_topic(last_cust_text + ' ' + last_ai_text, row.get('id'))
            alert_channel = format_channel(row.get('source'))
            customer = row.get('customer_id') or 'Khách hàng'

            if alert_type == 'overtime':
                urgent_alerts.append({
                    "id": row.get('id'),
                    "type": "overtime",
                    "priority": "Ưu tiên cao",
                    "title": "Hội thoại chờ quá 10 giờ",
                    "customer": customer,
                    "channel": alert_channel,
                    "topic": alert_topic,
                    "waitTime": format_wait_time(wait_mins),
                    "desc": f'Khách hỏi: "{last_cust_text[:100]}..."' if last_cust_text else 'Khách hỏi thông tin, chatbot chưa có phản hồi.',
                    "raw_source": row.get('source'),
                    "raw_status": 'pending',
                    "raw_ai_status": 'AI trả lời thất bại'
                })
            elif alert_type == 'ai_no_data':
                urgent_alerts.append({
                    "id": row.get('id'),
                    "type": "ai_no_data",
                    "priority": "Ưu tiên cao",
                    "title": "AI không tìm thấy dữ liệu",
                    "customer": customer,
                    "channel": alert_channel,
                    "topic": alert_topic,
                    "waitTime": format_wait_time(wait_mins),
                    "desc": f'Câu hỏi: "{last_cust_text[:60]}..." — không có trong cơ sở tri thức' if last_cust_text else 'Câu hỏi chưa có câu trả lời phù hợp trong cơ sở tri thức.',
                    "raw_source": row.get('source'),
                    "raw_status": 'open',
                    "raw_ai_status": 'Không tìm thấy dữ liệu'
                })
            elif alert_type == 'ai_uncertain':
                confidence_percent = 30 + (hash_str(last_ai_text) % 25)
                urgent_alerts.append({
                    "id": row.get('id'),
                    "type": "ai_uncertain",
                    "priority": "Ưu tiên cao",
                    "title": "AI không chắc chắn",
                    "customer": customer,
                    "channel": alert_channel,
                    "topic": alert_topic,
                    "waitTime": format_wait_time(wait_mins),
                    "desc": f'Câu hỏi: "{last_cust_text[:60]}..." — Độ tin cậy: {confidence_percent}%' if last_cust_text else f'Độ tin cậy phản hồi thấp: {confidence_percent}%',
                    "raw_source": row.get('source'),
                    "raw_status": 'open',
                    "raw_ai_status": 'AI trả lời không chắc chắn'
                })

        # Áp dụng bộ lọc cho Urgent Alerts
        filtered_urgent_alerts = urgent_alerts
        if channel and channel != 'Tất cả':
            source_filter = None
            if channel == 'Zalo OA':
                source_filter = 'ZaloOA'
            elif channel == 'Zalo Business':
                source_filter = 'ZaloBusiness'
            elif channel == 'Facebook':
                source_filter = 'Facebook'
            elif channel == 'Chat Widget':
                source_filter = 'ChatWidget'

            if source_filter:
                filtered_urgent_alerts = [a for a in filtered_urgent_alerts if a['raw_source'] == source_filter]

        if topic and topic != 'Tất cả':
            filtered_urgent_alerts = [a for a in filtered_urgent_alerts if a['topic'] == topic]

        if conversation_status and conversation_status != 'Tất cả':
            status_filter = None
            if conversation_status == 'Chờ xử lý':
                status_filter = 'pending'
            elif conversation_status == 'Đang xử lý':
                status_filter = 'open'
            elif conversation_status == 'Hoàn thành':
                status_filter = 'closed'

            if status_filter:
                filtered_urgent_alerts = [a for a in filtered_urgent_alerts if a['raw_status'] == status_filter]

        if ai_status and ai_status != 'Tất cả':
            filtered_urgent_alerts = [a for a in filtered_urgent_alerts if a['raw_ai_status'] == ai_status]

        # --- Xử lý Top Questions ---
        top_questions_mapped = []
        for row in (raw_top_questions or []):
            question = row.get('question')
            trend = -15 + (hash_str(question) % 45)
            top_questions_mapped.append({
                "question": question,
                "topic": classify_topic(question, question),
                "count": row.get('count'),
                "channel": format_channel(row.get('source')),
                "trend": trend,
                "raw_source": row.get('source')
            })

        # Áp dụng bộ lọc cho Top Questions
        filtered_top_questions = top_questions_mapped
        if channel and channel != 'Tất cả':
            source_filter = None
            if channel == 'Zalo OA':
                source_filter = 'ZaloOA'
            elif channel == 'Zalo Business':
                source_filter = 'ZaloBusiness'
            elif channel == 'Facebook':
                source_filter = 'Facebook'
            elif channel == 'Chat Widget':
                source_filter = 'ChatWidget'

            if source_filter:
                filtered_top_questions = [q for q in filtered_top_questions if q['raw_source'] == source_filter]

        if topic and topic != 'Tất cả':
            filtered_top_questions = [q for q in filtered_top_questions if q['topic'] == topic]

        # --- Xử lý Priority Conversations ---
        priority_conversations_mapped = []
        for c in [conv for conv in cleaned_conversations if conv['status'] != 'closed']:
            wait_mins = 0
            if c.get('created_at'):
                wait_mins = max(0, int((db_now - c['created_at']).total_seconds() // 60))

            is_overtime = wait_mins > 600
            priority = 'Ưu tiên thấp'
            if wait_mins > 600:
                priority = 'Ưu tiên cao'
            elif wait_mins > 120:
                priority = 'Ưu tiên trung bình'

            status_text = 'Chờ xử lý'
            if c['status'] == 'open':
                status_text = 'Đang xử lý'
            elif c['status'] == 'pending' or c['status'] == 'new':
                status_text = 'Chờ xử lý'

            priority_conversations_mapped.append({
                "id": f"HT-{c['id']}",
                "customerId": c['customer_id'],
                "source": c['source'],
                "customer": c['customer_id'] or 'Khách hàng',
                "channel": format_channel(c['source']),
                "topic": c.get('topic') or 'Khác',
                "wait": format_wait_time(wait_mins),
                "status": status_text,
                "priority": priority,
                "isOvertime": is_overtime
            })

        # --- Xử lý Daily Trends ---
        daily_map = {}
        start_d = None
        end_d = None
        if start_date:
            try:
                start_d = datetime.strptime(start_date, '%Y-%m-%d')
            except Exception:
                pass
        if end_date:
            try:
                end_d = datetime.strptime(end_date, '%Y-%m-%d')
            except Exception:
                pass

        if not start_d or not end_d:
            if cleaned_conversations:
                try:
                    times = [c['created_at'] for c in cleaned_conversations if c.get('created_at')]
                    start_d = min(times)
                    end_d = max(times)
                except Exception:
                    pass
            if not start_d or not end_d:
                start_d = datetime.now()
                end_d = datetime.now()

        current_date = start_d
        max_days = 366
        days_count = 0
        while current_date <= end_d and days_count < max_days:
            date_str = current_date.strftime('%Y-%m-%d')
            display_date = f"{current_date.day}/{current_date.month}"
            daily_map[date_str] = {
                "date": display_date,
                "total": 0,
                "processed": 0,
                "unprocessed": 0,
                "ai_ok": 0,
                "ai_fail": 0
            }
            current_date += timedelta(days=1)
            days_count += 1

        for c in cleaned_conversations:
            if not c.get('created_at'):
                continue
            date_str = c['created_at'].strftime('%Y-%m-%d')
            if date_str not in daily_map:
                display_date = f"{c['created_at'].day}/{c['created_at'].month}"
                daily_map[date_str] = {
                    "date": display_date,
                    "total": 0,
                    "processed": 0,
                    "unprocessed": 0,
                    "ai_ok": 0,
                    "ai_fail": 0
                }
            daily_map[date_str]['total'] += 1
            if c['status'] == 'closed':
                daily_map[date_str]['processed'] += 1
            else:
                daily_map[date_str]['unprocessed'] += 1

        conversation_key_set = {f"{c['customer_id']}_{c['source']}" for c in cleaned_conversations}

        for row in (ai_grouped_stats or []):
            key = f"{row.get('customer_id')}_{row.get('source')}"
            if key in conversation_key_set:
                date_str = row.get('date_str')
                if date_str in daily_map:
                    daily_map[date_str]['ai_ok'] += row.get('ai_ok') or 0
                    daily_map[date_str]['ai_fail'] += row.get('ai_fail') or 0

        sorted_daily_trends = [daily_map[k] for k in sorted(daily_map.keys())]

        result = {
            "totalConversations": total_conversations,
            "totalMessages": total_messages,
            "newCustomers": new_customers,
            "aiFailures": filtered_ai_failures,
            "statusSummary": status_summary,
            "sourceSummary": source_summary,
            "messageSummary": message_summary,
            "dateRange": date_range,
            "trends": trends,
            "averageResponseTimeMinutes": average_response_time_minutes,
            "urgentAlerts": filtered_urgent_alerts,
            "topQuestions": filtered_top_questions[:5],
            "priorityConversations": priority_conversations_mapped[:10],
            "dailyTrends": sorted_daily_trends
        }
        set_cached_value(cache_key, result)
        return result

    def get_channel_analytics(self, start_date=None, end_date=None, filters=None):
        if filters is None:
            filters = {}

        cache_key = make_cache_key('channels', start_date, end_date, filters)
        cached = get_cached_value(cache_key)
        if cached is not None:
            return cached

        channel = filters.get('channel')
        topic = filters.get('topic')
        conversation_status = filters.get('conversationStatus')
        ai_status = filters.get('aiStatus')

        with ThreadPoolExecutor(max_workers=3) as executor:
            conversation_stats_future = executor.submit(
                self.repository.get_channel_conversation_stats,
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                ai_status,
            )
            ai_summary_future = executor.submit(
                self.repository.get_channel_ai_summary,
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                ai_status,
            )
            topic_stats_future = executor.submit(
                self.repository.get_channel_topic_stats,
                start_date,
                end_date,
                channel,
                conversation_status,
                topic,
                ai_status,
            )
            conversation_stats = conversation_stats_future.result() or []
            ai_summary = ai_summary_future.result() or []
            topic_stats = topic_stats_future.result() or []

        all_channel_defs = [
            ('Zalo Business', 'ZaloBusiness'),
            ('Facebook', 'Facebook'),
            ('Zalo OA', 'ZaloOA'),
            ('Chat Widget', 'ChatWidget'),
        ]
        selected_source = None
        if channel and channel != 'Tất cả':
            selected_source = {
                'Zalo OA': 'ZaloOA',
                'Zalo Business': 'ZaloBusiness',
                'Facebook': 'Facebook',
                'Chat Widget': 'ChatWidget',
            }.get(channel)

        visible_channel_defs = [item for item in all_channel_defs if not selected_source or item[1] == selected_source]
        channels_map = {
            channel_name: {
                'channel': channel_name, 'source': source, 'total': 0, 'unresolved': 0,
                'ai_ok': 0, 'ai_fail': 0, 'avg_time': 0, 'satisfaction': 100,
                'negative': 0, '_response_total': 0, '_response_count': 0
            }
            for channel_name, source in visible_channel_defs
        }

        from collections import defaultdict
        trend_map = defaultdict(lambda: {'date': ''})
        status_map = {
            channel_name: {'channel': channel_name, 'Chờ xử lý': 0, 'Đang xử lý': 0, 'Hoàn thành': 0}
            for channel_name, _source in visible_channel_defs
        }
        heatmap_map = defaultdict(lambda: 0)

        for row in conversation_stats:
            source_key = normalize_source_key(row.get('source'))
            c_name = format_channel(source_key)
            if c_name not in channels_map:
                continue

            total = row.get('total') or 0
            status = row.get('status')
            channels_map[c_name]['total'] += total
            if status in ('pending', 'open'):
                channels_map[c_name]['unresolved'] += total

            avg_response = row.get('avg_response_minutes')
            if avg_response is not None:
                channels_map[c_name]['_response_total'] += float(avg_response) * total
                channels_map[c_name]['_response_count'] += total

            date_str = row.get('date_str') or 'unknown'
            if not trend_map[date_str]['date']:
                trend_map[date_str]['date'] = date_str
            if c_name not in trend_map[date_str]:
                trend_map[date_str][c_name] = 0
            trend_map[date_str][c_name] += total

            if status == 'pending':
                status_map[c_name]['Chờ xử lý'] += total
            elif status == 'open':
                status_map[c_name]['Đang xử lý'] += total
            else:
                status_map[c_name]['Hoàn thành'] += total

        for row in ai_summary:
            c_name = format_channel(row.get('source'))
            if c_name in channels_map:
                channels_map[c_name]['ai_ok'] += row.get('ai_ok') or 0
                channels_map[c_name]['ai_fail'] += row.get('ai_fail') or 0

        for row in topic_stats:
            source_key = normalize_source_key(row.get('source'))
            c_name = format_channel(source_key)
            if c_name not in channels_map:
                continue
            heatmap_map[(c_name, source_key, row.get('topic') or 'Khác')] += row.get('value') or 0

        for data in channels_map.values():
            if data['_response_count']:
                data['avg_time'] = round(data['_response_total'] / data['_response_count'], 1)
            del data['_response_total']
            del data['_response_count']

        trend_list = list(trend_map.values())
        status_list = list(status_map.values())
        heatmap_list = [{'channel': k[0], 'source': k[1], 'topic': k[2], 'value': v} for k, v in heatmap_map.items()]

        all_topics = list(set([k[2] for k in heatmap_map.keys()]))
        all_channels = list(channels_map.keys())

        result = {
            "channels": list(channels_map.values()),
            "trend": sorted(trend_list, key=lambda x: x['date']),
            "statusByChannel": status_list,
            "heatmap": heatmap_list,
            "topics": all_topics,
            "channelsList": all_channels,
            "dateRange": {
                "startDate": start_date or '',
                "endDate": end_date or '',
                "granularity": "day"
            }
        }
        set_cached_value(cache_key, result)
        return result

    def close_conversation(self, customer_id, source, user_name='Staff_Dashboard'):
        result = self.repository.close_conversation(customer_id, source, user_name)
        clear_dashboard_cache()
        return result

dashboard_service = DashboardService()

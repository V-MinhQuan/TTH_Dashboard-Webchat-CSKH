import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from app.repositories.legacy_conversation_repository import ConversationRepository
from app.services.conversation_cleaner import conversation_cleaner_service
from app.utils.customer_identity import customer_display_name

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

def _as_number(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0

def trim_trailing_zero_rows(rows, metric_keys):
    trimmed = list(rows or [])
    while trimmed and all(_as_number(trimmed[-1].get(key)) == 0 for key in metric_keys):
        trimmed.pop()
    return trimmed

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

def channel_to_source_key(channel: str = ''):
    if not channel or channel == 'Tất cả':
        return None
    key = normalize_source_key(channel)
    return None if key == 'other' else key

def format_wait_time(mins: int) -> str:
    if mins <= 0:
        return 'Vừa xong'
    if mins >= 24 * 60:
        return f"{mins // (24 * 60)} ngày {(mins % (24 * 60)) // 60} giờ"
    if mins >= 60:
        return f"{mins // 60} giờ {mins % 60} phút"
    return f"{mins} phút"

def excerpt_text(value: str = '', limit: int = 100) -> str:
    text = ' '.join(str(value or '').split())
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + '...'

def source_topic(value) -> str:
    if not value:
        return 'Chưa xác định'
    if isinstance(value, (list, tuple)):
        return str(value[0]).strip() if value else 'Chưa xác định'
    text = str(value).strip()
    try:
        parsed = json.loads(text)
    except (TypeError, ValueError, json.JSONDecodeError):
        parsed = None
    if isinstance(parsed, list) and parsed:
        return str(parsed[0]).strip() or 'Chưa xác định'
    return text or 'Chưa xác định'

def build_alert_description(alert_type: str, last_cust_text: str = '', last_ai_text: str = '') -> str:
    customer_text = excerpt_text(last_cust_text, 100)
    ai_text = excerpt_text(last_ai_text, 100)

    if alert_type == 'overtime':
        if customer_text:
            return f'Tin nhắn khách cuối: "{customer_text}"'
        return 'Nội dung tin nhắn khách cuối đang trống trong database.'

    if alert_type == 'ai_no_data':
        if customer_text and ai_text:
            return f'Tin nhắn khách: "{customer_text}" — Phản hồi AI: "{ai_text}"'
        if customer_text:
            return f'Tin nhắn khách: "{customer_text}" — phản hồi AI khớp dấu hiệu không tìm thấy dữ liệu.'
        if ai_text:
            return f'Phản hồi AI khớp dấu hiệu không tìm thấy dữ liệu: "{ai_text}"'
        return 'Nội dung tin nhắn khách và phản hồi AI đang trống trong database.'

    if alert_type == 'ai_uncertain':
        if customer_text and ai_text:
            return f'Tin nhắn khách: "{customer_text}" — Phản hồi AI: "{ai_text}"'
        if customer_text:
            return f'Tin nhắn khách: "{customer_text}" — phản hồi AI khớp dấu hiệu không chắc chắn.'
        if ai_text:
            return f'Phản hồi AI khớp dấu hiệu không chắc chắn: "{ai_text}"'
        return 'Nội dung tin nhắn khách và phản hồi AI đang trống trong database.'

    return 'Không có nội dung cảnh báo trong database.'

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
            'overtime_alerts': lambda: self._cached_repo_call('urgent_overtime_all', None, None, lambda: self.repository.get_urgent_alerts_data(None, None, include_ai=False)),
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
        raw_overtime_alerts = query_results.get('overtime_alerts') or []
        raw_top_questions = query_results.get('top_questions') or []
        raw_priority_conversations = query_results.get('priority_conversations') or []
        daily_conversations = query_results.get('daily_conversations') or []
        ai_daily_stats = query_results.get('ai_daily_stats') or []
        ai_failures = sum(row.get('ai_fail') or 0 for row in ai_daily_stats)

        alert_keys = {(row.get('id'), normalize_source_key(row.get('source'))) for row in raw_urgent_alerts}
        for row in raw_overtime_alerts:
            key = (row.get('id'), normalize_source_key(row.get('source')))
            if row.get('alert_type') == 'overtime' and key not in alert_keys:
                raw_urgent_alerts.append(row)
                alert_keys.add(key)

        message_summary = {
            "ZaloOA": 0,
            "ZaloBusiness": 0,
            "Facebook": 0,
            "ChatWidget": 0,
            "other": 0
        }

        overall_min_date = None
        overall_max_date = None
        source_filter = channel_to_source_key(channel)

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

            alert_topic = source_topic(row.get('detected_topics'))
            alert_channel = format_channel(row.get('source'))
            customer = customer_display_name(row.get('customer_name'), row.get('customer_id'))

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
                    "desc": build_alert_description(alert_type, last_cust_text, last_ai_text),
                    "raw_source": normalize_source_key(row.get('source')),
                    "raw_status": 'pending',
                    "raw_ai_status": 'Chưa có phản hồi'
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
                    "desc": build_alert_description(alert_type, last_cust_text, last_ai_text),
                    "raw_source": normalize_source_key(row.get('source')),
                    "raw_status": 'open',
                    "raw_ai_status": 'Không tìm thấy dữ liệu'
                })
            elif alert_type == 'ai_uncertain':
                urgent_alerts.append({
                    "id": row.get('id'),
                    "type": "ai_uncertain",
                    "priority": "Ưu tiên cao",
                    "title": "AI không chắc chắn",
                    "customer": customer,
                    "channel": alert_channel,
                    "topic": alert_topic,
                    "waitTime": format_wait_time(wait_mins),
                    "desc": build_alert_description(alert_type, last_cust_text, last_ai_text),
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
            top_questions_mapped.append({
                "question": question,
                "topic": source_topic(row.get('detected_topics')),
                "count": row.get('count'),
                "channel": format_channel(row.get('source')),
                "trend": None,
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
                "customerName": row.get('customer_name'),
                "phoneNumber": None,
                "customerDisplayName": customer_display_name(row.get('customer_name'), row.get('customer_id')),
                "customer": customer_display_name(row.get('customer_name'), row.get('customer_id')),
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

        daily_trends = trim_trailing_zero_rows(
            [daily_map[k] for k in sorted(daily_map.keys())],
            ("total", "processed", "unprocessed", "ai_ok", "ai_fail"),
        )

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
            "dailyTrends": daily_trends,
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
        selected_source = channel_to_source_key(channel)

        with ThreadPoolExecutor(max_workers=4 if not selected_source else 3) as executor:
            source_totals_future = None
            if not selected_source:
                source_totals_future = executor.submit(
                    self.repository.get_conversation_summary,
                    start_date,
                    end_date,
                    channel,
                    conversation_status,
                    topic,
                    ai_status,
                )
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
            source_totals = source_totals_future.result() if source_totals_future else {}

        all_channel_defs = [
            ('Zalo Business', 'ZaloBusiness'),
            ('Facebook', 'Facebook'),
            ('Zalo OA', 'ZaloOA'),
            ('Chat Widget', 'ChatWidget'),
        ]
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
            
            # Record average response time properly
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

        source_summary = source_totals.get('sourceSummary', {})
        unresolved_summary = source_totals.get('unresolvedSummary', {})
        for c_name in channels_map:
            source_key_for_map = {
                'Zalo OA': 'ZaloOA',
                'Zalo Business': 'ZaloBusiness',
                'Facebook': 'Facebook',
                'Chat Widget': 'ChatWidget'
            }.get(c_name)
            
            if source_key_for_map and not selected_source:
                # Use accurate de-duplicated totals from conversation summary.
                channels_map[c_name]['total'] = source_summary.get(source_key_for_map) or 0
                channels_map[c_name]['unresolved'] = unresolved_summary.get(source_key_for_map) or 0
                
                # Assign status map accurately based on the unresolved amount
                status_map[c_name]['Chờ xử lý'] = channels_map[c_name]['unresolved']
                status_map[c_name]['Hoàn thành'] = channels_map[c_name]['total'] - channels_map[c_name]['unresolved']

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

from repositories.conversation_repository import conversation_repository
from services.conversation_cleaner import conversation_cleaner_service

class DashboardService:
    def get_kpis(self, start_date: str = None, end_date: str = None) -> dict:
        # 1. Fetch raw conversations
        raw_conversations = conversation_repository.get_conversations(start_date, end_date)

        # 2. Clean and normalize
        cleaned = conversation_cleaner_service.clean_and_normalize(raw_conversations)

        # 3. Calculate total conversations
        total_conversations = len(cleaned)

        # 4. Count unique new customers
        unique_customers = set()
        for c in cleaned:
            if c["customer_id"]:
                unique_customers.add(c["customer_id"])
        new_customers = len(unique_customers)

        # 5. Summarize status
        status_summary = {
            "new": 0,
            "open": 0,
            "pending": 0,
            "closed": 0,
            "unknown": 0
        }

        # 6. Summarize source
        source_summary = {
            "ZaloOA": 0,
            "ZaloBusiness": 0,
            "Facebook": 0,
            "ChatWidget": 0,
            "other": 0
        }

        total_response_time_ms = 0
        valid_response_time_count = 0

        for c in cleaned:
            # Status summary
            status = c["status"]
            if status in status_summary:
                status_summary[status] += 1
            else:
                status_summary["unknown"] += 1

            # Source summary
            source = c["source"]
            if source in source_summary:
                source_summary[source] += 1
            else:
                source_summary["other"] += 1

            # Response time (first_response_at - created_at)
            if c["first_response_at"] and c["created_at"]:
                diff = c["first_response_at"] - c["created_at"]
                diff_ms = diff.total_seconds() * 1000
                if diff_ms >= 0:
                    total_response_time_ms += diff_ms
                    valid_response_time_count += 1

        # 7. Average response time in minutes
        average_response_time_minutes = 0
        if valid_response_time_count > 0:
            avg_ms = total_response_time_ms / valid_response_time_count
            average_response_time_minutes = round(avg_ms / (1000 * 60))

        return {
            "totalConversations": total_conversations,
            "newCustomers": new_customers,
            "statusSummary": status_summary,
            "sourceSummary": source_summary,
            "averageResponseTimeMinutes": average_response_time_minutes
        }

dashboard_service = DashboardService()

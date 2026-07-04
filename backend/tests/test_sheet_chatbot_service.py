import asyncio

from app.sheet_chatbot.service import SheetChatbotService


class InMemorySheetRepository:
    def __init__(self, rows):
        self._rows = rows

    def get_all(self):
        return list(self._rows)


def _load_rows(rows, filters):
    service = SheetChatbotService(repository=InMemorySheetRepository(rows))
    return asyncio.run(service.get_rows({"page": 1, "pageSize": 50, **filters}))


def test_sheet_chatbot_global_filters_apply_date_topic_and_verified_channel():
    rows = [
        {
            "id": "CS-001",
            "addedAt": "2026-07-01T08:00:00Z",
            "topic": "TOEIC",
            "channel": "Facebook",
            "status": "Chờ xử lý",
        },
        {
            "id": "CS-002",
            "addedAt": "2026-07-01T09:00:00Z",
            "topic": "TOEIC",
            "status": "Chờ xử lý",
        },
        {
            "id": "CS-003",
            "addedAt": "2026-07-01T10:00:00Z",
            "topic": "MOS",
            "channel": "Facebook",
            "status": "Đã duyệt",
        },
        {
            "id": "CS-004",
            "addedAt": "2026-06-20T10:00:00Z",
            "topic": "TOEIC",
            "channel": "Facebook",
            "status": "Từ chối",
        },
    ]

    response = _load_rows(rows, {
        "startDate": "2026-07-01",
        "endDate": "2026-07-02",
        "topic": "TOEIC",
        "channel": "Facebook",
    })

    assert [row["id"] for row in response["rows"]] == ["CS-001"]
    assert response["stats"]["total"] == 1
    assert response["stats"]["pending"] == 1


def test_sheet_chatbot_topic_filter_keeps_rows_without_channel_when_channel_is_all():
    rows = [
        {"id": "CS-001", "addedAt": "2026-07-01T08:00:00Z", "topic": "TOEIC", "status": "Chờ xử lý"},
        {"id": "CS-002", "addedAt": "2026-07-01T09:00:00Z", "topic": "MOS", "status": "Đã duyệt"},
    ]

    response = _load_rows(rows, {
        "startDate": "2026-07-01",
        "endDate": "2026-07-02",
        "topic": "TOEIC",
        "channel": "Tất cả",
    })

    assert [row["id"] for row in response["rows"]] == ["CS-001"]
    assert response["stats"]["total"] == 1

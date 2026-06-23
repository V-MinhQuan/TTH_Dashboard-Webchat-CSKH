import sys
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.auth import HMACBearerSessions, get_session_manager
from app.repositories.conversation_repository import ConversationRepository
from app.routers.conversations import get_conversation_service, router
from app.services.conversation_service import ConversationService


class StubConversationService:
    def __init__(self):
        self.bulk_calls = []
        self.single_calls = []

    def close_conversations(self, conversation_ids, actor):
        self.bulk_calls.append((conversation_ids, actor))
        return {
            "requestedCount": len(conversation_ids),
            "matchedCount": len(conversation_ids),
            "affectedCount": len(conversation_ids),
            "alreadyClosedCount": 0,
        }

    def close_conversation(self, *, conversation_id, customer_id, source, actor):
        self.single_calls.append((conversation_id, customer_id, source, actor))
        return {
            "requestedCount": 1,
            "matchedCount": 1,
            "affectedCount": 1,
            "alreadyClosedCount": 0,
        }


def make_client(service: StubConversationService):
    app = FastAPI()
    app.include_router(router)
    sessions = HMACBearerSessions(secret="s" * 32, ttl_seconds=900, clock=lambda: 1_000)
    app.dependency_overrides[get_conversation_service] = lambda: service
    app.dependency_overrides[get_session_manager] = lambda: sessions
    return TestClient(app), sessions


def bearer(sessions: HMACBearerSessions, username: str, role: str):
    return {"Authorization": f"Bearer {sessions.issue(username=username, role=role)}"}


def test_bulk_close_requires_manager_and_uses_only_selected_ids():
    service = StubConversationService()
    client, sessions = make_client(service)

    unauthenticated = client.post(
        "/api/conversations/bulk-close",
        json={"conversationIds": [11, 12]},
    )
    staff = client.post(
        "/api/conversations/bulk-close",
        headers=bearer(sessions, "staff01", "staff"),
        json={"conversationIds": [11, 12]},
    )
    manager = client.post(
        "/api/conversations/bulk-close",
        headers=bearer(sessions, "manager01", "manager"),
        json={"conversationIds": [11, 12]},
    )

    assert unauthenticated.status_code == 401
    assert staff.status_code == 403
    assert manager.status_code == 200
    assert manager.json()["data"]["affected"] == 2
    assert manager.json()["data"]["affectedCount"] == 2
    assert service.bulk_calls == [((11, 12), "manager01")]


def test_bulk_close_rejects_empty_duplicate_or_unscoped_payloads():
    service = StubConversationService()
    client, sessions = make_client(service)
    headers = bearer(sessions, "manager01", "manager")

    empty = client.post(
        "/api/conversations/bulk-close",
        headers=headers,
        json={"conversationIds": []},
    )
    duplicate = client.post(
        "/api/conversations/bulk-close",
        headers=headers,
        json={"conversationIds": [11, 11]},
    )
    filter_scope = client.post(
        "/api/conversations/bulk-close",
        headers=headers,
        json={"status": "pending"},
    )

    assert empty.status_code == 422
    assert duplicate.status_code == 422
    assert filter_scope.status_code == 422
    assert service.bulk_calls == []


def test_single_close_supports_current_customer_source_contract_for_staff():
    service = StubConversationService()
    client, sessions = make_client(service)

    response = client.post(
        "/api/conversations/close",
        headers=bearer(sessions, "staff01", "staff"),
        json={"customerId": " customer-01 ", "source": " Facebook "},
    )

    assert response.status_code == 200
    assert response.json()["data"]["affectedCount"] == 1
    assert service.single_calls == [(None, "customer-01", "Facebook", "staff01")]


def test_conversation_query_validation_rejects_invalid_filters_before_service_call():
    service = StubConversationService()
    service.list_conversations = MagicMock(return_value={"records": [], "pagination": {}})
    client, _ = make_client(service)

    assert client.get("/api/conversations?status=deleted").status_code == 422
    assert client.get("/api/conversations?sentiment=angry").status_code == 422
    assert client.get(f"/api/conversations?topic={'x' * 101}").status_code == 422
    assert client.get("/api/conversations?pageSize=101").status_code == 422
    service.list_conversations.assert_not_called()


def test_valid_conversation_filters_are_normalized_before_service_call():
    service = StubConversationService()
    service.list_conversations = MagicMock(
        return_value={"records": [], "pagination": {"page": 1, "pageSize": 20, "total": 0}}
    )
    client, _ = make_client(service)

    response = client.get(
        "/api/conversations",
        params={
            "conversationStatus": "pending",
            "sentiment": "negative",
            "topic": " TOEIC ",
            "source": " Facebook ",
        },
    )

    assert response.status_code == 200
    filters = service.list_conversations.call_args.args[0]
    assert filters["status"] == "pending"
    assert filters["sentiment"] == "negative"
    assert filters["topic"] == "TOEIC"
    assert filters["source"] == "Facebook"


def test_service_adds_customer_identity_immutably():
    record = {"id": 5, "customer_id": "customer-12345678", "customer_name": "Nguyễn An"}
    repository = MagicMock()
    repository.list_conversations.return_value = {
        "records": [record],
        "pagination": {"page": 1, "pageSize": 20, "total": 1},
    }
    service = ConversationService(repository=repository)

    result = service.list_conversations({})

    assert result["records"][0]["customer_reference"] == "customer-12345678"
    assert result["records"][0]["customerDisplayName"] == "Nguyễn An"
    assert "customer_reference" not in record


def test_list_query_parameterizes_filters_and_avoids_duplicate_customer_join():
    captured = []

    @contextmanager
    def fake_connection():
        yield object()

    def fake_execute_one(conn, query, params):
        captured.append((query, list(params)))
        return {"total": 0}

    def fake_execute_all(conn, query, params):
        captured.append((query, list(params)))
        return []

    repository = ConversationRepository(connection_factory=fake_connection)
    filters = {
        "source": "Facebook",
        "search": "Nguyễn",
        "status": "pending",
        "sentiment": "negative",
        "topic": "TOEIC",
        "page": 1,
        "pageSize": 20,
    }

    with patch(
        "app.repositories.conversation_repository.execute_one",
        side_effect=fake_execute_one,
    ), patch(
        "app.repositories.conversation_repository.execute_all",
        side_effect=fake_execute_all,
    ):
        repository.list_conversations(filters)

    count_query, count_params = captured[0]
    list_query, list_params = captured[1]
    for query in (count_query, list_query):
        assert "OUTER APPLY" in query
        assert "LEFT JOIN dbo.WebChat_Messagelogs_User_Info" not in query
        assert "Facebook" not in query
        assert "Nguyễn" not in query
        assert "negative" not in query
        assert "TOEIC" not in query
    assert count_params == [
        "Facebook",
        "pending",
        "negative",
        "%TOEIC%",
        "%Nguyễn%",
        "%Nguyễn%",
    ]
    assert list_params == [*count_params, 0, 20]


def test_repository_bulk_close_is_transactional_and_idempotent():
    connection = MagicMock()
    cursor = MagicMock()
    connection.cursor.return_value = cursor

    @contextmanager
    def fake_connection():
        yield connection

    repository = ConversationRepository(connection_factory=fake_connection)
    open_rows = [
        {
            "id": 11,
            "customer_id": "customer-11",
            "source": "Facebook",
            "last_customer_message_at": "2026-06-20T08:00:00",
            "status_id": 91,
            "status": "pending",
        },
        {
            "id": 12,
            "customer_id": "customer-12",
            "source": "ZaloOA",
            "last_customer_message_at": "2026-06-20T08:00:00",
            "status_id": None,
            "status": "open",
        },
    ]
    closed_rows = [{**row, "status": "closed"} for row in open_rows]

    with patch(
        "app.repositories.conversation_repository.execute_all",
        side_effect=[open_rows, closed_rows],
    ):
        first = repository.close_conversations((11, 12), "manager01")
        second = repository.close_conversations((11, 12), "manager01")

    assert first == {
        "requestedCount": 2,
        "matchedCount": 2,
        "affectedCount": 2,
        "alreadyClosedCount": 0,
    }
    assert second["affectedCount"] == 0
    assert second["alreadyClosedCount"] == 2
    assert connection.commit.call_count == 2
    connection.rollback.assert_not_called()
    write_queries = [call.args[0] for call in cursor.execute.call_args_list]
    assert sum("UPDATE dbo.WebChat_ConversationStatus" in query for query in write_queries) == 1
    assert sum("INSERT INTO dbo.WebChat_ConversationStatus" in query for query in write_queries) == 1
    assert all("manager01" not in query for query in write_queries)


def test_repository_bulk_close_rolls_back_on_write_failure():
    connection = MagicMock()
    connection.cursor.return_value.execute.side_effect = RuntimeError("write failed")

    @contextmanager
    def fake_connection():
        yield connection

    repository = ConversationRepository(connection_factory=fake_connection)
    selected = [
        {
            "id": 11,
            "customer_id": "customer-11",
            "source": "Facebook",
            "status_id": 91,
            "status": "pending",
        }
    ]

    with patch(
        "app.repositories.conversation_repository.execute_all",
        return_value=selected,
    ), pytest.raises(RuntimeError, match="write failed"):
        repository.close_conversations((11,), "manager01")

    connection.commit.assert_not_called()
    connection.rollback.assert_called_once()


def test_repository_close_latest_matches_display_source_aliases():
    captured = []
    connection = MagicMock()
    connection.cursor.return_value = MagicMock()

    @contextmanager
    def fake_connection():
        yield connection

    def fake_execute_one(conn, query, params):
        captured.append((query, list(params)))
        return {"id": 12}

    selected = [
        {
            "id": 12,
            "customer_id": "customer-12",
            "source": "zalooa",
            "status_id": None,
            "status": "pending",
        }
    ]

    repository = ConversationRepository(connection_factory=fake_connection)
    with patch("app.repositories.conversation_repository.execute_one", side_effect=fake_execute_one), patch(
        "app.repositories.conversation_repository.execute_all",
        return_value=selected,
    ):
        result = repository.close_latest("customer-12", "Zalo OA", "staff01")

    query, params = captured[0]
    assert "LOWER(LTRIM(RTRIM(c.Source))) IN (?, ?)" in query
    assert params == ["customer-12", "zalooa", "zalo"]
    assert result["affectedCount"] == 1


@patch("app.services.conversation_service.clear_dashboard_cache")
def test_service_close_operations_clear_dashboard_cache(mock_clear_cache):
    repository = MagicMock()
    repository.close_latest.return_value = {
        "requestedCount": 1,
        "matchedCount": 1,
        "affectedCount": 1,
        "alreadyClosedCount": 0,
    }
    repository.close_conversations.return_value = {
        "requestedCount": 2,
        "matchedCount": 2,
        "affectedCount": 2,
        "alreadyClosedCount": 0,
    }
    service = ConversationService(repository=repository)

    service.close_conversation(
        conversation_id=None,
        customer_id="customer-12",
        source="Zalo OA",
        actor="staff01",
    )
    service.close_conversations((11, 12), "manager01")

    assert mock_clear_cache.call_count == 2


def test_service_single_close_by_id_reports_missing_conversation():
    repository = MagicMock()
    repository.close_conversations.return_value = {
        "requestedCount": 1,
        "matchedCount": 0,
        "affectedCount": 0,
        "alreadyClosedCount": 0,
    }
    service = ConversationService(repository=repository)

    with pytest.raises(Exception, match="Không tìm thấy hội thoại"):
        service.close_conversation(
            conversation_id=404,
            customer_id=None,
            source=None,
            actor="staff01",
        )

    repository.close_conversations.assert_called_once_with((404,), "staff01")

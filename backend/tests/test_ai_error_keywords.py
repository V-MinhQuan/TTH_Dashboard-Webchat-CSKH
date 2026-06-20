from __future__ import annotations

import sys
import unicodedata
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock
from uuid import UUID

import pytest
import pyodbc
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

# The owned router must import require_role exactly as specified. The concurrent
# auth module currently names the same factory require_roles, so expose a test-only
# alias without editing or replacing that module.
from app.core import auth as auth_module

if not hasattr(auth_module, "require_role"):
    auth_module.require_role = auth_module.require_roles


from app.core.exceptions import register_exception_handlers
from app.repositories.ai_error_keywords import (
    AiErrorKeywordRepository,
    DuplicateAiErrorKeywordRecordError,
)
from app.routers.ai_error_keywords import (
    get_ai_error_keyword_service,
    require_manager,
    router,
)
from app.schemas.ai_error_keywords import (
    AiErrorGroup,
    AiErrorKeywordCreate,
    AiErrorKeywordRead,
    AiErrorKeywordStatus,
    AiErrorKeywordUpdate,
)
from app.services.ai_error_keywords import (
    AiErrorKeywordService,
    DuplicateAiErrorKeywordError,
)


VALID_PAYLOAD = {
    "keyword": "không tìm thấy dữ liệu",
    "error_group": "Không tìm thấy dữ liệu",
    "topic": "Lịch thi",
    "description": "AI không có dữ liệu lịch thi mới nhất.",
    "status": "active",
}


def _row(**overrides):
    row = {
        "id": "fd95ae14-c7b1-42c4-b1ef-73649074283d",
        **VALID_PAYLOAD,
        "care_hub": None,
        "creator": "quản_lý",
        "created_at": datetime(2026, 6, 20, 1, 2, 3),
        "updated_at": datetime(2026, 6, 20, 1, 2, 3),
    }
    row.update(overrides)
    return row


def test_create_schema_normalizes_unicode_and_whitespace():
    decomposed_keyword = unicodedata.normalize("NFD", "  không   tìm thấy dữ liệu  ")

    model = AiErrorKeywordCreate.model_validate(
        {
            **VALID_PAYLOAD,
            "keyword": decomposed_keyword,
            "topic": "  Lịch   thi ",
            "description": "  AI không có   dữ liệu lịch thi mới nhất.  ",
        }
    )

    assert model.keyword == "không tìm thấy dữ liệu"
    assert unicodedata.is_normalized("NFC", model.keyword)
    assert model.topic == "Lịch thi"
    assert model.description == "AI không có dữ liệu lịch thi mới nhất."


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("keyword", "<script>alert(1)</script>"),
        ("keyword", "không\u200btìm thấy dữ liệu"),
        ("topic", "&lt;img src=x onerror=alert(1)&gt;"),
        ("description", "javascript:alert(document.cookie)"),
    ],
)
def test_schema_rejects_dangerous_html_and_xss(field, value):
    payload = {**VALID_PAYLOAD, field: value}

    with pytest.raises(ValidationError, match="HTML|không an toàn"):
        AiErrorKeywordCreate.model_validate(payload)


@pytest.mark.parametrize(
    "payload",
    [
        {**VALID_PAYLOAD, "topic": None, "care_hub": None},
        {**VALID_PAYLOAD, "care_hub": "Ngoại ngữ"},
    ],
)
def test_schema_requires_exactly_one_taxonomy_target(payload):
    with pytest.raises(ValidationError, match="topic|care_hub"):
        AiErrorKeywordCreate.model_validate(payload)


@pytest.mark.parametrize(
    "field,value",
    [
        ("error_group", "Nhóm tự đặt"),
        ("status", "deleted"),
        ("keyword", "x" * 201),
        ("description", "x" * 1001),
    ],
)
def test_schema_rejects_invalid_canonical_values_and_lengths(field, value):
    with pytest.raises(ValidationError):
        AiErrorKeywordCreate.model_validate({**VALID_PAYLOAD, field: value})


def test_update_schema_requires_at_least_one_field():
    with pytest.raises(ValidationError, match="ít nhất một"):
        AiErrorKeywordUpdate()


def test_canonical_taxonomy_uses_correctly_accented_vietnamese():
    assert {item.value for item in AiErrorGroup} == {
        "AI có nguy cơ tự tạo thông tin",
        "AI không chắc chắn",
        "Không tìm thấy dữ liệu",
        "Câu hỏi ngoài phạm vi",
    }
    assert {item.value for item in AiErrorKeywordStatus} == {"active", "inactive"}


class FakeRepository:
    def __init__(self, *, duplicate=None, current=None):
        self.duplicate = duplicate
        self.current = current
        self.created = None
        self.updated = None

    def find_by_normalized_keyword(self, normalized_keyword, *, exclude_id=None):
        self.duplicate_lookup = (normalized_keyword, exclude_id)
        return self.duplicate

    def create(self, payload, *, normalized_keyword, creator):
        self.created = (payload, normalized_keyword, creator)
        return _row(
            keyword=payload.keyword,
            error_group=payload.error_group.value,
            topic=payload.topic,
            care_hub=payload.care_hub,
            description=payload.description,
            status=payload.status.value,
            creator=creator,
        )

    def get_by_id(self, keyword_id):
        self.requested_id = keyword_id
        return self.current

    def update(self, keyword_id, payload, *, normalized_keyword):
        self.updated = (keyword_id, payload, normalized_keyword)
        return {
            **self.current,
            **payload.model_dump(mode="json"),
            "updated_at": datetime(2026, 6, 20, 2, 3, 4),
        }


def test_service_rejects_case_and_unicode_equivalent_duplicate():
    repository = FakeRepository(duplicate=_row())
    service = AiErrorKeywordService(repository=repository)
    payload = AiErrorKeywordCreate.model_validate(
        {
            **VALID_PAYLOAD,
            "keyword": unicodedata.normalize("NFD", "KHÔNG TÌM THẤY DỮ LIỆU"),
        }
    )

    with pytest.raises(DuplicateAiErrorKeywordError, match="đã tồn tại"):
        service.create(payload, creator="manager")

    assert repository.duplicate_lookup == ("không tìm thấy dữ liệu", None)
    assert repository.created is None


def test_service_creates_new_value_without_mutating_payload():
    repository = FakeRepository()
    service = AiErrorKeywordService(repository=repository)
    payload = AiErrorKeywordCreate.model_validate(VALID_PAYLOAD)
    before = payload.model_dump()

    result = service.create(payload, creator="  quản_lý  ")

    assert payload.model_dump() == before
    assert repository.created[1:] == ("không tìm thấy dữ liệu", "quản_lý")
    assert result.creator == "quản_lý"


def test_service_maps_concurrent_duplicate_to_public_conflict():
    class ConcurrentDuplicateRepository(FakeRepository):
        def create(self, payload, *, normalized_keyword, creator):
            raise DuplicateAiErrorKeywordRecordError

    service = AiErrorKeywordService(repository=ConcurrentDuplicateRepository())

    with pytest.raises(DuplicateAiErrorKeywordError, match="đã tồn tại"):
        service.create(
            AiErrorKeywordCreate.model_validate(VALID_PAYLOAD),
            creator="quản_lý",
        )


def test_service_update_builds_an_immutable_merged_copy():
    current = _row()
    repository = FakeRepository(current=current)
    service = AiErrorKeywordService(repository=repository)
    update = AiErrorKeywordUpdate(description="  Mô tả mới. ", status="inactive")

    result = service.update(UUID(current["id"]), update)

    persisted = repository.updated[1]
    assert current["description"] == VALID_PAYLOAD["description"]
    assert persisted is not current
    assert persisted.description == "Mô tả mới."
    assert persisted.status is AiErrorKeywordStatus.inactive
    assert result.status is AiErrorKeywordStatus.inactive


def test_service_maps_concurrent_update_duplicate_to_public_conflict():
    class ConcurrentDuplicateRepository(FakeRepository):
        def update(self, keyword_id, payload, *, normalized_keyword):
            raise DuplicateAiErrorKeywordRecordError

    current = _row()
    service = AiErrorKeywordService(
        repository=ConcurrentDuplicateRepository(current=current)
    )

    with pytest.raises(DuplicateAiErrorKeywordError, match="đã tồn tại"):
        service.update(
            UUID(current["id"]),
            AiErrorKeywordUpdate(keyword="AI không chắc chắn"),
        )


def test_repository_create_uses_parameterized_sql():
    columns = [
        "id",
        "keyword",
        "error_group",
        "topic",
        "care_hub",
        "description",
        "status",
        "creator",
        "created_at",
        "updated_at",
    ]
    cursor = MagicMock()
    cursor.description = [(column,) for column in columns]
    cursor.fetchone.return_value = tuple(_row()[column] for column in columns)
    connection = MagicMock()
    connection.cursor.return_value = cursor

    @contextmanager
    def connection_factory():
        yield connection

    repository = AiErrorKeywordRepository(connection_factory=connection_factory)
    payload = AiErrorKeywordCreate.model_validate(VALID_PAYLOAD)

    repository.create(
        payload,
        normalized_keyword="không tìm thấy dữ liệu",
        creator="quản_lý",
    )

    query, params = cursor.execute.call_args.args
    assert VALID_PAYLOAD["keyword"] not in query
    assert "VALUES (?, ?, ?, ?, ?, ?, ?, ?)" in query
    assert params == (
        "không tìm thấy dữ liệu",
        "không tìm thấy dữ liệu",
        "Không tìm thấy dữ liệu",
        "Lịch thi",
        None,
        "AI không có dữ liệu lịch thi mới nhất.",
        "active",
        "quản_lý",
    )
    connection.commit.assert_called_once_with()


def test_repository_list_parameterizes_all_filters_and_pagination():
    cursor = MagicMock()
    cursor.description = []
    cursor.fetchall.return_value = []
    connection = MagicMock()
    connection.cursor.return_value = cursor

    @contextmanager
    def connection_factory():
        yield connection

    repository = AiErrorKeywordRepository(connection_factory=connection_factory)
    malicious_topic = "Lịch thi' OR 1=1 --"

    repository.list(
        status=AiErrorKeywordStatus.active,
        error_group=AiErrorGroup.DATA_NOT_FOUND,
        topic=malicious_topic,
        limit=25,
        offset=5,
    )

    query, params = cursor.execute.call_args.args
    assert malicious_topic not in query
    assert "Status = ?" in query
    assert "ErrorGroup = ?" in query
    assert "Topic = ?" in query
    assert "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY" in query
    assert params == (
        "active",
        "Không tìm thấy dữ liệu",
        malicious_topic,
        5,
        25,
    )


def test_repository_maps_sql_server_unique_violation_to_domain_error():
    cursor = MagicMock()
    cursor.execute.side_effect = pyodbc.IntegrityError(
        "23000",
        "Cannot insert duplicate key row; index UX_AiErrorKeywords_KeywordNormalized (2601)",
    )
    connection = MagicMock()
    connection.cursor.return_value = cursor

    @contextmanager
    def connection_factory():
        yield connection

    repository = AiErrorKeywordRepository(connection_factory=connection_factory)

    with pytest.raises(DuplicateAiErrorKeywordRecordError):
        repository.create(
            AiErrorKeywordCreate.model_validate(VALID_PAYLOAD),
            normalized_keyword="không tìm thấy dữ liệu",
            creator="quản_lý",
        )

    connection.commit.assert_not_called()


def test_repository_update_maps_sql_server_unique_violation_to_domain_error():
    cursor = MagicMock()
    cursor.execute.side_effect = pyodbc.IntegrityError(
        "23000",
        "Violation of UNIQUE KEY constraint (2627)",
    )
    connection = MagicMock()
    connection.cursor.return_value = cursor

    @contextmanager
    def connection_factory():
        yield connection

    repository = AiErrorKeywordRepository(connection_factory=connection_factory)

    with pytest.raises(DuplicateAiErrorKeywordRecordError):
        repository.update(
            UUID(_row()["id"]),
            AiErrorKeywordCreate.model_validate(VALID_PAYLOAD),
            normalized_keyword="không tìm thấy dữ liệu",
        )

    connection.commit.assert_not_called()


class FakeApiService:
    def __init__(self):
        self.create_call = None

    def create(self, payload, *, creator):
        self.create_call = (payload, creator)
        return AiErrorKeywordRead.model_validate(_row(creator=creator))


def test_create_endpoint_uses_authenticated_creator_and_manager_role():
    service = FakeApiService()
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(router)
    app.dependency_overrides[get_ai_error_keyword_service] = lambda: service
    app.dependency_overrides[require_manager] = lambda: auth_module.SessionClaims(
        username="quản_lý",
        role="manager",
        issued_at=1,
        expires_at=2,
    )

    with TestClient(app) as client:
        response = client.post("/api/ai-error-keywords", json=VALID_PAYLOAD)

    assert response.status_code == 201
    assert response.json()["data"]["creator"] == "quản_lý"
    assert service.create_call[1] == "quản_lý"


def test_create_endpoint_rejects_spoofed_creator():
    service = FakeApiService()
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(router)
    app.dependency_overrides[get_ai_error_keyword_service] = lambda: service
    app.dependency_overrides[require_manager] = lambda: auth_module.SessionClaims(
        username="quản_lý",
        role="manager",
        issued_at=1,
        expires_at=2,
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/ai-error-keywords",
            json={**VALID_PAYLOAD, "creator": "người_khác"},
        )

    assert response.status_code == 422
    assert service.create_call is None


def test_migration_and_rollback_are_idempotent_and_scoped():
    migration_path = BACKEND_ROOT / "database" / "migrations" / "create_ai_error_keywords.sql"
    rollback_path = BACKEND_ROOT / "database" / "migrations" / "rollback_ai_error_keywords.sql"

    migration = migration_path.read_text(encoding="utf-8")
    rollback = rollback_path.read_text(encoding="utf-8")

    assert "IF OBJECT_ID(N'dbo.AiErrorKeywords', N'U') IS NULL" in migration
    assert "IF NOT EXISTS" in migration
    assert "CREATE UNIQUE INDEX UX_AiErrorKeywords_KeywordNormalized" in migration
    assert "CK_AiErrorKeywords_Status" in migration
    assert "CK_AiErrorKeywords_Taxonomy" in migration
    assert "AI có nguy cơ tự tạo thông tin" in migration
    assert "Không tìm thấy dữ liệu" in migration
    assert "IF OBJECT_ID(N'dbo.AiErrorKeywords', N'U') IS NOT NULL" in rollback
    assert "DROP TABLE dbo.AiErrorKeywords" in rollback
    assert "DROP DATABASE" not in rollback.upper()

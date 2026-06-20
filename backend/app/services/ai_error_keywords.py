from __future__ import annotations

from typing import Any
from uuid import UUID

from app.repositories.ai_error_keywords import (
    AiErrorKeywordRepository,
    DuplicateAiErrorKeywordRecordError,
)
from app.schemas.ai_error_keywords import (
    AiErrorGroup,
    AiErrorKeywordCreate,
    AiErrorKeywordList,
    AiErrorKeywordRead,
    AiErrorKeywordStatus,
    AiErrorKeywordUpdate,
    normalize_safe_text,
    normalized_keyword_key,
)


class DuplicateAiErrorKeywordError(ValueError):
    pass


class AiErrorKeywordNotFoundError(LookupError):
    pass


class AiErrorKeywordService:
    def __init__(self, repository: AiErrorKeywordRepository | None = None):
        self.repository = repository or AiErrorKeywordRepository()

    def list(
        self,
        *,
        status: AiErrorKeywordStatus | None = None,
        error_group: AiErrorGroup | None = None,
        topic: str | None = None,
        care_hub: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> AiErrorKeywordList:
        normalized_topic = self._normalize_filter(topic, "topic")
        normalized_care_hub = self._normalize_filter(care_hub, "care_hub")
        if normalized_topic is not None and normalized_care_hub is not None:
            raise ValueError("Chỉ được lọc theo topic hoặc care_hub trong một yêu cầu")
        filters = {
            "status": status,
            "error_group": error_group,
            "topic": normalized_topic,
            "care_hub": normalized_care_hub,
        }
        rows = self.repository.list(**filters, limit=limit, offset=offset)
        total = self.repository.count(**filters)
        return AiErrorKeywordList(
            items=tuple(AiErrorKeywordRead.model_validate(row) for row in rows),
            total=total,
            limit=limit,
            offset=offset,
        )

    def get(self, keyword_id: UUID) -> AiErrorKeywordRead:
        row = self.repository.get_by_id(keyword_id)
        if not row:
            raise AiErrorKeywordNotFoundError("Không tìm thấy từ khóa lỗi AI.")
        return AiErrorKeywordRead.model_validate(row)

    def create(
        self,
        payload: AiErrorKeywordCreate,
        *,
        creator: str,
    ) -> AiErrorKeywordRead:
        normalized_keyword = normalized_keyword_key(payload.keyword)
        if self.repository.find_by_normalized_keyword(normalized_keyword):
            raise DuplicateAiErrorKeywordError("Từ khóa lỗi AI đã tồn tại.")
        normalized_creator = normalize_safe_text(creator, field_name="creator")
        if not normalized_creator or len(normalized_creator) > 100:
            raise ValueError("Người tạo không hợp lệ.")
        try:
            row = self.repository.create(
                payload,
                normalized_keyword=normalized_keyword,
                creator=normalized_creator,
            )
        except DuplicateAiErrorKeywordRecordError as exc:
            raise DuplicateAiErrorKeywordError(
                "Từ khóa lỗi AI đã tồn tại."
            ) from exc
        return AiErrorKeywordRead.model_validate(row)

    def update(
        self,
        keyword_id: UUID,
        payload: AiErrorKeywordUpdate,
    ) -> AiErrorKeywordRead:
        current_row = self.repository.get_by_id(keyword_id)
        if not current_row:
            raise AiErrorKeywordNotFoundError("Không tìm thấy từ khóa lỗi AI.")
        current = AiErrorKeywordRead.model_validate(current_row)
        changes = payload.model_dump(exclude_unset=True)
        merged = AiErrorKeywordCreate.model_validate(
            {
                **current.model_dump(
                    include={
                        "keyword",
                        "error_group",
                        "topic",
                        "care_hub",
                        "description",
                        "status",
                    }
                ),
                **changes,
            }
        )
        normalized_keyword = normalized_keyword_key(merged.keyword)
        if self.repository.find_by_normalized_keyword(
            normalized_keyword,
            exclude_id=keyword_id,
        ):
            raise DuplicateAiErrorKeywordError("Từ khóa lỗi AI đã tồn tại.")
        try:
            row = self.repository.update(
                keyword_id,
                merged,
                normalized_keyword=normalized_keyword,
            )
        except DuplicateAiErrorKeywordRecordError as exc:
            raise DuplicateAiErrorKeywordError(
                "Từ khóa lỗi AI đã tồn tại."
            ) from exc
        if not row:
            raise AiErrorKeywordNotFoundError("Không tìm thấy từ khóa lỗi AI.")
        return AiErrorKeywordRead.model_validate(row)

    @staticmethod
    def _normalize_filter(value: Any, field_name: str) -> str | None:
        if value is None:
            return None
        normalized = normalize_safe_text(value, field_name=field_name)
        if not normalized or len(normalized) > 100:
            raise ValueError(f"{field_name} không hợp lệ")
        return normalized

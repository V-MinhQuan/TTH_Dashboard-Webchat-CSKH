from __future__ import annotations

from typing import Any, Dict

from app.core.exceptions import AppError
from app.repositories.conversation_repository import ConversationRepository


class ConversationService:
    def __init__(self, repository: ConversationRepository | None = None):
        self.repository = repository or ConversationRepository()

    def list_conversations(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        result = self.repository.list_conversations(filters)
        records = [self._with_customer_reference(record) for record in result.get("records", [])]
        return {**result, "records": records}

    def get_conversation(self, conversation_id: int) -> Dict[str, Any]:
        record = self.repository.get_conversation(conversation_id)
        return self._with_customer_reference(record) if record else {}

    def get_by_message(self, message_id: int) -> Dict[str, Any]:
        record = self.repository.get_by_message(message_id)
        return self._with_customer_reference(record) if record else {}

    def close_conversations(
        self,
        conversation_ids: tuple[int, ...],
        actor: str,
    ) -> Dict[str, int]:
        return self.repository.close_conversations(tuple(conversation_ids), actor)

    def close_conversation(
        self,
        *,
        conversation_id: int | None,
        customer_id: str | None,
        source: str | None,
        actor: str,
    ) -> Dict[str, int]:
        if conversation_id is not None:
            result = self.repository.close_conversations((conversation_id,), actor)
        else:
            result = self.repository.close_latest(customer_id or "", source or "", actor)
        if result["matchedCount"] == 0:
            raise AppError("Không tìm thấy hội thoại cần đóng.", status_code=404)
        return result

    @staticmethod
    def _with_customer_reference(record: Dict[str, Any]) -> Dict[str, Any]:
        customer_id = str(record.get("customer_id") or "").strip()
        reference = f"***{customer_id[-4:]}" if customer_id else None
        return {**record, "customer_reference": reference}

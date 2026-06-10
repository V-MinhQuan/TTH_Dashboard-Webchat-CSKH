from __future__ import annotations

from typing import Any, Dict

from app.repositories.conversation_repository import ConversationRepository


class ConversationService:
    def __init__(self, repository: ConversationRepository | None = None):
        self.repository = repository or ConversationRepository()

    def list_conversations(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        return self.repository.list_conversations(filters)

    def get_conversation(self, conversation_id: int) -> Dict[str, Any]:
        return self.repository.get_conversation(conversation_id)

    def get_by_message(self, message_id: int) -> Dict[str, Any]:
        return self.repository.get_by_message(message_id)


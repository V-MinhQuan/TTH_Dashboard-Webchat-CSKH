from pydantic import BaseModel


class ConversationListItem(BaseModel):
    id: int
    customer_id: str | None = None
    customer_name: str | None = None
    status: str | None = None
    source: str | None = None


from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ActivityLogCreate(BaseModel):
    user_id: str
    action_type: str
    entity: str
    details: Optional[str] = None
    ip_address: Optional[str] = None

class ActivityLog(BaseModel):
    id: int
    user_id: str
    action_type: str
    entity: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    date_str: Optional[str] = None

class ActivityLogResponse(BaseModel):
    data: List[ActivityLog]
    total: int

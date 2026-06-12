from pydantic import BaseModel


class DashboardKpi(BaseModel):
    totalConversations: int = 0
    totalMessages: int = 0
    pendingConversations: int = 0
    completedConversations: int = 0
    aiFailedCount: int = 0
    needStaffReviewCount: int = 0


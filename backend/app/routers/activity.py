from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Any, Optional
from datetime import datetime
import logging
from app.repositories.activity import activity_repo
from app.schemas.activity import ActivityLogCreate, ActivityLogResponse
from app.core.auth import SessionClaims, require_roles

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/activity",
    tags=["activity"]
)

@router.get("", response_model=ActivityLogResponse)
def get_user_activity(
    limit: int = 50,
    offset: int = 0,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    session: SessionClaims = Depends(require_roles("manager", "staff"))
) -> Any:
    """
    Lấy danh sách lịch sử hoạt động. Quản lý xem tất cả, nhân viên xem của mình.
    """
    try:
        if session.role == "manager":
            # Manager sees all activities (pass user_id = None)
            target_user_id = None
        else:
            # Staff only sees their own activities
            target_user_id = session.username
        
        activities, total = activity_repo.get_activities(
            target_user_id, limit, offset, start_date, end_date
        )
        return {
            "data": activities,
            "total": total
        }
    except Exception as e:
        logger.error(f"Error fetching activity logs: {e}")
        raise HTTPException(status_code=500, detail="Lỗi máy chủ khi lấy dữ liệu")

@router.post("")
def log_user_activity(
    activity: ActivityLogCreate,
    session: SessionClaims = Depends(require_roles("manager", "staff")),
    request: Request = None
) -> Any:
    """
    Tạo mới một log hoạt động
    """
    try:
        user_id = session.username
        
        ip_address = activity.ip_address
        if not ip_address and request:
            ip_address = request.client.host if request.client else None
            
        success = activity_repo.log_activity(
            user_id=user_id,
            action_type=activity.action_type,
            entity=activity.entity,
            details=activity.details,
            ip_address=ip_address
        )
        if not success:
            raise HTTPException(status_code=500, detail="Không thể lưu lịch sử hoạt động")
            
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error in log_user_activity: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Lỗi khi tạo log hoạt động")

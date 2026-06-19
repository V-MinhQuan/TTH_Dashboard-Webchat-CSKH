import os
import sys
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Thêm thư mục hiện tại vào sys.path để import dễ dàng
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.core.legacy_db import get_db_connection
from app.services.legacy_dashboard_service import dashboard_service
from app.keywords.service import keyword_service
from app.sheet_chatbot.service import sheet_chatbot_service

router = APIRouter()

# Endpoints
@router.get("/api/health")
def health_check():
    return {
        "success": True,
        "message": "Backend is running successfully."
    }

@router.get("/api/test-db")
def test_db():
    conn = get_db_connection()
    try:
        query = "SELECT GETDATE() AS db_time"
        with conn.cursor(as_dict=True) as cursor:
            cursor.execute(query)
            row = cursor.fetchone()
            server_time = row['db_time'] if row else None
            
            if isinstance(server_time, datetime):
                # Format to ISO-8601 with Z suffix
                server_time = server_time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
                
            return {
                "success": True,
                "message": "Database connection test successful",
                "data": {
                    "serverTime": server_time
                }
            }
    finally:
        conn.close()

# ---------------------------------------------------------------------------
# DEPRECATED: /api/auth/login trong legacy.py
# Endpoint này đã được thay thế bởi app/routers/auth.py (modular router).
# Vì modular auth router được mount TRƯỚC legacy router trong main.py,
# FastAPI sẽ dùng phiên bản modular, và code dưới đây không còn được thực thi.
#
# Code được giữ lại cho mục đích tham khảo trong quá trình migration.
# SAI LẦM CŨ: role được hardcode theo username ('test', 'thuynt') trong router.
# ĐÚNG MỚI:   role được quản lý qua biến môi trường MANAGER_USERNAMES trong auth_service.py.
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/api/auth/login", deprecated=True, include_in_schema=False)
def login_legacy(request: LoginRequest):
    """
    [DEPRECATED] Endpoint này đã được thay thế bởi /api/auth/login trong auth.py.
    Sẽ không được thực thi do modular auth router được mount trước.
    """
    # NOTE: role cũ bị hardcode theo username — đã được sửa trong auth_service.py
    # Giữ lại để tham khảo, không nên xóa cho đến khi migration hoàn tất.
    username_val = request.username.strip()
    password_val = request.password
    
    if not username_val or not password_val:
        return JSONResponse(status_code=400, content={
            "success": False,
            "message": "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu."
        })
        
    conn = get_db_connection()
    try:
        query = "SELECT UserName, DangHoatDong, HoTen, ShortName FROM [User] WHERE UserName = %s AND Password = %s"
        with conn.cursor(as_dict=True) as cursor:
            cursor.execute(query, (username_val, password_val))
            row = cursor.fetchone()
            
            if not row:
                return JSONResponse(status_code=401, content={
                    "success": False,
                    "message": "Tên đăng nhập hoặc mật khẩu không đúng."
                })
                
            if not row['DangHoatDong']:
                return JSONResponse(status_code=403, content={
                    "success": False,
                    "message": "Tài khoản của bạn đã bị khóa."
                })
                
            # [OLD — DEPRECATED] Hardcoded role logic — đã chuyển sang auth_service.py
            # role = 'manager' if user_name in ('test', 'thuynt') else 'staff'
            role = 'staff'
            user_name = row['UserName']
            return {
                "success": True,
                "message": "Đăng nhập thành công. (legacy — deprecated)",
                "data": {
                    "username": user_name,
                    "name": row['HoTen'],
                    "email": f"{user_name}@flic.edu.vn",
                    "role": role
                }
            }
    finally:
        conn.close()

@router.get("/api/dashboard/kpi")
def get_kpi(
    startDate: str = None,
    endDate: str = None,
    channel: str = None,
    topic: str = None,
    conversationStatus: str = None,
    aiStatus: str = None
):
    if startDate:
        try:
            datetime.strptime(startDate, '%Y-%m-%d')
        except ValueError:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Định dạng startDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ."
            })
            
    if endDate:
        try:
            datetime.strptime(endDate, '%Y-%m-%d')
        except ValueError:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Định dạng endDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ."
            })
            
    if startDate and endDate:
        if datetime.strptime(startDate, '%Y-%m-%d') > datetime.strptime(endDate, '%Y-%m-%d'):
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Ngày bắt đầu (startDate) không thể lớn hơn ngày kết thúc (endDate)."
            })
            
    filters = {
        "channel": channel,
        "topic": topic,
        "conversationStatus": conversationStatus,
        "aiStatus": aiStatus
    }
    
    kpis = dashboard_service.get_kpis(startDate, endDate, filters)
    return {
        "success": True,
        "message": "Dashboard KPI fetched successfully",
        "data": kpis
    }

@router.get("/api/dashboard/channels")
def get_channel_analytics(
    startDate: str = None,
    endDate: str = None,
    channel: str = None,
    topic: str = None,
    conversationStatus: str = None,
    aiStatus: str = None
):
    if startDate:
        try:
            datetime.strptime(startDate.split("T")[0], '%Y-%m-%d')
        except ValueError:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Định dạng startDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD."
            })

    if endDate:
        try:
            datetime.strptime(endDate.split("T")[0], '%Y-%m-%d')
        except ValueError:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Định dạng endDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD."
            })

    if startDate and endDate:
        start_dt = datetime.strptime(startDate.split("T")[0], '%Y-%m-%d')
        end_dt = datetime.strptime(endDate.split("T")[0], '%Y-%m-%d')
        if start_dt > end_dt:
            return JSONResponse(status_code=400, content={
                "success": False,
                "message": "Ngày bắt đầu (startDate) không thể lớn hơn ngày kết thúc (endDate)."
            })

    filters = {
        "channel": channel,
        "topic": topic,
        "conversationStatus": conversationStatus,
        "aiStatus": aiStatus
    }

    data = dashboard_service.get_channel_analytics(startDate, endDate, filters)
    return {
        "success": True,
        "message": "Channel analytics fetched successfully",
        "data": data
    }

class CloseConversationRequest(BaseModel):
    customerId: str
    source: str

@router.post("/api/conversations/close")
def close_conversation_endpoint(request: CloseConversationRequest):
    cust_id = request.customerId.strip()
    source_val = request.source.strip()
    
    if not cust_id or not source_val:
        return JSONResponse(status_code=400, content={
            "success": False,
            "message": "Thiếu customerId hoặc source."
        })
        
    try:
        dashboard_service.close_conversation(cust_id, source_val)
        return {
            "success": True,
            "message": "Đã đánh dấu cuộc hội thoại là xử lý thành công."
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={
            "success": False,
            "message": f"Lỗi khi đánh dấu xử lý hội thoại: {str(e)}"
        })

# Pydantic models for keywords
class KeywordCreateBody(BaseModel):
    word: str
    groupId: str
    status: str = "active"

class KeywordUpdateBody(BaseModel):
    word: str = None
    groupId: str = None
    status: str = None

class SheetChatbotCreateBody(BaseModel):
    question: str
    correctAnswer: str
    topic: str = None
    source: str = None
    risk: str = None
    status: str = None
    notes: str = None
    addedBy: str = None

class SheetChatbotUpdateBody(BaseModel):
    question: str = None
    correctAnswer: str = None
    topic: str = None
    source: str = None
    risk: str = None
    status: str = None
    notes: str = None
    addedBy: str = None

class SheetChatbotStatusBody(BaseModel):
    status: str
    reviewer: str = None
    notes: str = None

class SheetChatbotMergeBody(BaseModel):
    reviewer: str = None

@router.get("/api/admin/crm-keywords")
async def get_keywords(
    page: int = 1,
    pageSize: int = 10,
    search: str = None,
    status: str = None,
    groupId: str = None,
    startDate: str = None,
    endDate: str = None,
    channel: str = None,
    conversationStatus: str = None,
    aiStatus: str = None
):
    try:
        res = await keyword_service.get_keywords({
            "page": page,
            "pageSize": pageSize,
            "search": search,
            "status": status,
            "groupId": groupId,
            "startDate": startDate,
            "endDate": endDate,
            "channel": channel,
            "conversationStatus": conversationStatus,
            "aiStatus": aiStatus
        })
        return {
            "success": True,
            "message": "Get CRM keywords successfully",
            "data": res["keywords"],
            "total": res["total"],
            "page": res["page"],
            "pageSize": res["pageSize"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/admin/crm-keywords/groups")
async def get_group_stats(
    startDate: str = None,
    endDate: str = None,
    channel: str = None,
    topic: str = None,
    conversationStatus: str = None,
    aiStatus: str = None,
    topN: int = 5
):
    try:
        res = await keyword_service.get_group_stats({
            "startDate": startDate,
            "endDate": endDate,
            "channel": channel,
            "topic": topic,
            "conversationStatus": conversationStatus,
            "aiStatus": aiStatus,
            "topN": topN
        })
        return {
            "success": True,
            "message": "Get group stats successfully",
            "data": res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/admin/crm-keywords/trends")
async def get_trend_data(
    months: int = 8,
    channel: str = None,
    startDate: str = None,
    endDate: str = None,
    topic: str = None,
    conversationStatus: str = None,
    aiStatus: str = None,
    granularity: str = "month"
):
    try:
        res = await keyword_service.get_trend_data(
            months=months,
            channel=channel,
            start_date=startDate,
            end_date=endDate,
            topic=topic,
            conversation_status=conversationStatus,
            ai_status=aiStatus,
            granularity=granularity,
        )
        return {
            "success": True,
            "message": "Get trend data successfully",
            "data": res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/admin/crm-keywords/heatmap")
async def get_heatmap_data(
    startDate: str = None,
    endDate: str = None,
    channel: str = None,
    topic: str = None,
    conversationStatus: str = None,
    aiStatus: str = None
):
    try:
        res = await keyword_service.get_heatmap_data(
            start_date=startDate,
            end_date=endDate,
            channel=channel,
            topic=topic,
            conversation_status=conversationStatus,
            ai_status=aiStatus,
        )
        return {
            "success": True,
            "message": "Get heatmap data successfully",
            "data": res["data"],
            "columns": res["columns"],
            "maxRaw": res["maxRaw"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/admin/crm-keywords/{id}")
async def get_keyword_by_id(id: str):
    try:
        res = await keyword_service.get_keyword_by_id(id)
        return {
            "success": True,
            "message": "Get CRM keyword detail successfully",
            "data": res
        }
    except Exception as e:
        status_code = 404
        if "groupId" in str(e) or "Không tìm thấy" in str(e):
            status_code = 404
        raise HTTPException(status_code=status_code, detail=str(e))

@router.post("/api/admin/crm-keywords", status_code=201)
async def create_keyword(body: KeywordCreateBody):
    try:
        res = await keyword_service.create_keyword(word=body.word, group_id=body.groupId, status=body.status)
        return {
            "success": True,
            "message": "Create CRM keyword successfully",
            "data": res
        }
    except Exception as e:
        status_code = 400
        if "đã tồn tại" in str(e):
            status_code = 409
        raise HTTPException(status_code=status_code, detail=str(e))

@router.put("/api/admin/crm-keywords/{id}")
async def update_keyword(id: str, body: KeywordUpdateBody):
    try:
        res = await keyword_service.update_keyword(keyword_id=id, word=body.word, group_id=body.groupId, status=body.status)
        return {
            "success": True,
            "message": "Update CRM keyword successfully",
            "data": res
        }
    except Exception as e:
        status_code = 400
        if "đã tồn tại" in str(e):
            status_code = 409
        elif "Không tìm thấy" in str(e):
            status_code = 404
        raise HTTPException(status_code=status_code, detail=str(e))

@router.delete("/api/admin/crm-keywords/{id}")
async def delete_keyword(id: str):
    try:
        await keyword_service.delete_keyword(id)
        return {
            "success": True,
            "message": "Delete CRM keyword successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/api/admin/sheet-chatbot")
async def get_sheet_chatbot_rows(
    page: int = 1,
    pageSize: int = 10,
    search: str = None,
    status: str = None,
    risk: str = None,
    addedBy: str = None,
    role: str = None
):
    try:
        res = await sheet_chatbot_service.get_rows({
            "page": page,
            "pageSize": pageSize,
            "search": search,
            "status": status,
            "risk": risk,
            "addedBy": addedBy,
            "role": role
        })
        return {
            "success": True,
            "message": "Get response library rows successfully",
            "data": res["rows"],
            "total": res["total"],
            "page": res["page"],
            "pageSize": res["pageSize"],
            "stats": res["stats"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/admin/sheet-chatbot/stats")
async def get_sheet_chatbot_stats():
    try:
        return {
            "success": True,
            "message": "Get response library stats successfully",
            "data": sheet_chatbot_service.get_stats()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/admin/sheet-chatbot/duplicates")
async def get_sheet_chatbot_duplicates(
    question: str,
    minSimilarity: float = 0.75,
    limit: int = 5
):
    try:
        res = await sheet_chatbot_service.find_duplicates(
            question=question,
            min_similarity=minSimilarity,
            limit=limit
        )
        return {
            "success": True,
            "message": "Find duplicate response library rows successfully",
            "data": res
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/api/admin/sheet-chatbot/{id}")
async def get_sheet_chatbot_row_by_id(id: str):
    try:
        res = await sheet_chatbot_service.get_row_by_id(id)
        return {
            "success": True,
            "message": "Get response library row successfully",
            "data": res
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/api/admin/sheet-chatbot", status_code=201)
async def create_sheet_chatbot_row(body: SheetChatbotCreateBody):
    try:
        res = await sheet_chatbot_service.create_row(body.model_dump(exclude_none=True))
        return {
            "success": True,
            "message": "Create response library row successfully",
            "data": res
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/api/admin/sheet-chatbot/{id}")
async def update_sheet_chatbot_row(id: str, body: SheetChatbotUpdateBody):
    try:
        res = await sheet_chatbot_service.update_row(id, body.model_dump(exclude_none=True))
        return {
            "success": True,
            "message": "Update response library row successfully",
            "data": res
        }
    except Exception as e:
        status_code = 404 if "Khong tim thay" in str(e) or "Không tìm thấy" in str(e) else 400
        raise HTTPException(status_code=status_code, detail=str(e))

@router.patch("/api/admin/sheet-chatbot/{id}/status")
async def update_sheet_chatbot_status(id: str, body: SheetChatbotStatusBody):
    try:
        res = await sheet_chatbot_service.update_status(
            row_id=id,
            status=body.status,
            reviewer=body.reviewer,
            notes=body.notes
        )
        return {
            "success": True,
            "message": "Update response library status successfully",
            "data": res
        }
    except Exception as e:
        status_code = 404 if "Khong tim thay" in str(e) or "Không tìm thấy" in str(e) else 400
        raise HTTPException(status_code=status_code, detail=str(e))

@router.post("/api/admin/sheet-chatbot/{id}/merge-faq")
async def merge_sheet_chatbot_to_faq(id: str, body: SheetChatbotMergeBody = None):
    try:
        reviewer = body.reviewer if body else None
        res = await sheet_chatbot_service.merge_to_faq(id, reviewer=reviewer)
        return {
            "success": True,
            "message": "Merge response library row to FAQ successfully",
            "data": res
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/api/admin/sheet-chatbot/{id}")
async def delete_sheet_chatbot_row(id: str):
    try:
        await sheet_chatbot_service.delete_row(id)
        return {
            "success": True,
            "message": "Delete response library row successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


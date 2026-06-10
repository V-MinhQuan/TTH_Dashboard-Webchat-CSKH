import os
import sys
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Thêm thư mục hiện tại vào sys.path để import dễ dàng
sys.path.append(str(Path(__file__).resolve().parent.parent))

from backend.config.db import get_db_connection
from backend.services.dashboard_service import dashboard_service
from backend.keywords.service import keyword_service

app = FastAPI()

# Cấu hình CORS
cors_origin = os.getenv("CORS_ORIGIN", "*")
origins = ["*"] if cors_origin == "*" else cors_origin.split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True if cors_origin != "*" else False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Exception handlers
@app.exception_handler(404)
async def custom_404_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "success": False,
            "message": f"Đường dẫn {request.url.path} không tồn tại trên hệ thống."
        }
    )

@app.exception_handler(Exception)
async def custom_global_exception_handler(request: Request, exc: Exception):
    print("--- HỆ THỐNG GẶP LỖI ---")
    import traceback
    traceback.print_exc()
    
    message = str(exc)
    lower_msg = message.lower()
    if any(k in lower_msg for k in ('login failed', 'password', 'credentials', 'connection')):
        message = "Không thể kết nối hoặc xác thực với Cơ sở dữ liệu. Vui lòng kiểm tra lại cấu hình file .env."
        
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": message
        }
    )

# Endpoints
@app.get("/api/health")
def health_check():
    return {
        "success": True,
        "message": "Backend is running successfully."
    }

@app.get("/api/test-db")
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

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/auth/login")
def login(request: LoginRequest):
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
                
            role = 'staff'
            user_name = row['UserName']
            if user_name in ('test', 'thuynt'):
                role = 'manager'
                
            return {
                "success": True,
                "message": "Đăng nhập thành công.",
                "data": {
                    "username": user_name,
                    "name": row['HoTen'],
                    "email": f"{user_name}@flic.edu.vn",
                    "role": role
                }
            }
    finally:
        conn.close()

@app.get("/api/dashboard/kpi")
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

@app.get("/api/dashboard/channels")
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

@app.post("/api/conversations/close")
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

@app.get("/api/admin/crm-keywords")
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

@app.get("/api/admin/crm-keywords/groups")
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

@app.get("/api/admin/crm-keywords/trends")
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

@app.get("/api/admin/crm-keywords/heatmap")
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

@app.get("/api/admin/crm-keywords/{id}")
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

@app.post("/api/admin/crm-keywords", status_code=201)
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

@app.put("/api/admin/crm-keywords/{id}")
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

@app.delete("/api/admin/crm-keywords/{id}")
async def delete_keyword(id: str):
    try:
        await keyword_service.delete_keyword(id)
        return {
            "success": True,
            "message": "Delete CRM keyword successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="localhost", port=5000, reload=True)

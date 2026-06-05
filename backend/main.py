import os
import sys
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Thêm thư mục hiện tại vào sys.path để import dễ dàng
sys.path.append(str(Path(__file__).resolve().parent.parent))

from backend.config.db import get_db_connection
from backend.services.dashboard_service import dashboard_service

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="localhost", port=5000, reload=True)

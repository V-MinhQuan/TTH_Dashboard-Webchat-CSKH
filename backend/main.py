import os
import traceback
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import config
from db import execute_query
from services.dashboard_service import dashboard_service
from keywords.service import keyword_service

app = FastAPI(title="TTH Dashboard Webchat CSKH API", version="1.0.0")

# CORS configurations
cors_origin = config.CORS_ORIGIN
origins = ["*"] if cors_origin == "*" else [o.strip() for o in cors_origin.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Global error handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    status_code = 500
    if isinstance(exc, HTTPException):
        status_code = exc.status_code
        message = exc.detail
    elif hasattr(exc, "status"):
        status_code = getattr(exc, "status")
        message = str(exc)
    else:
        message = str(exc)
    
    # Hide DB connection errors for safety
    lower_msg = message.lower()
    if any(k in lower_msg for k in ["login failed", "password", "credentials", "connection"]):
        message = "Không thể kết nối hoặc xác thực với Cơ sở dữ liệu. Vui lòng kiểm tra lại cấu hình file .env."

    print("--- HỆ THỐNG GẶP LỖI ---")
    traceback.print_exc()

    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "message": message,
            "error": traceback.format_exc() if os.getenv("NODE_ENV") == "development" else None
        }
    )

@app.get("/api/health")
async def health():
    return {"success": True, "message": "Backend is running successfully."}

@app.get("/api/test-db")
async def test_db():
    try:
        res = execute_query("SELECT GETDATE() AS db_time")
        server_time = res[0]["db_time"].isoformat() if (res and res[0].get("db_time")) else None
        return {
            "success": True,
            "message": "Database connection test successful",
            "data": {"serverTime": server_time}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard/kpi")
async def get_kpi(startDate: str = None, endDate: str = None):
    # Validate dates
    if startDate:
        try:
            if "T" in startDate:
                datetime.fromisoformat(startDate.replace("Z", "+00:00"))
            else:
                datetime.strptime(startDate[:10], "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Định dạng startDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ.")
                
    if endDate:
        try:
            if "T" in endDate:
                datetime.fromisoformat(endDate.replace("Z", "+00:00"))
            else:
                datetime.strptime(endDate[:10], "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Định dạng endDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ.")

    if startDate and endDate:
        try:
            s_dt = datetime.fromisoformat(startDate.replace("Z", "+00:00")) if "T" in startDate else datetime.strptime(startDate[:10], "%Y-%m-%d")
            e_dt = datetime.fromisoformat(endDate.replace("Z", "+00:00")) if "T" in endDate else datetime.strptime(endDate[:10], "%Y-%m-%d")
            if s_dt > e_dt:
                raise HTTPException(status_code=400, detail="Ngày bắt đầu (startDate) không thể lớn hơn ngày kết thúc (endDate).")
        except ValueError:
            pass

    try:
        res = dashboard_service.get_kpis(startDate, endDate)
        return {
            "success": True,
            "message": "Dashboard KPI fetched successfully",
            "data": res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    channel: str = None
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
            "channel": channel
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
    topN: int = 5
):
    try:
        res = await keyword_service.get_group_stats({
            "startDate": startDate,
            "endDate": endDate,
            "channel": channel,
            "topic": topic,
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
    channel: str = None
):
    try:
        res = await keyword_service.get_trend_data(months=months, channel=channel)
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
    channel: str = None
):
    try:
        res = await keyword_service.get_heatmap_data(start_date=startDate, end_date=endDate, channel=channel)
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

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.core.exceptions import AppError
from app.schemas.chart_builder import (
    ChartRequest,
    CustomChartRequest,
    SavedChartConfigCreate,
)
from app.services.chart_builder_service import ChartBuilderService
from app.core.auth import SessionClaims, require_roles

router = APIRouter(prefix="/api/chart-builder", tags=["chart-builder"])


def get_chart_builder_service() -> ChartBuilderService:
    return ChartBuilderService()


@router.get("/sources")
def get_sources(
    session: SessionClaims = Depends(require_roles("manager", "staff", "admin")),
    service: ChartBuilderService = Depends(get_chart_builder_service),
):
    data = service.get_available_sources()
    return {
        "success": True,
        "message": "Lấy danh sách nguồn dữ liệu thành công.",
        "data": data,
    }


@router.get("/catalog")
def get_catalog(
    session: SessionClaims = Depends(require_roles("manager", "staff", "admin")),
    service: ChartBuilderService = Depends(get_chart_builder_service),
):
    data = service.get_catalog()
    return {
        "success": True,
        "message": "Lấy bộ dữ liệu biểu đồ thành công.",
        "data": data,
    }


@router.get("/staff-names")
def get_staff_names(
    session: SessionClaims = Depends(require_roles("manager", "staff", "admin")),
    service: ChartBuilderService = Depends(get_chart_builder_service),
):
    return {
        "success": True,
        "message": "Lấy danh sách nhân viên thành công.",
        "data": service.get_staff_names(),
    }


@router.post("/preview")
def preview_chart_data(
    request: CustomChartRequest,
    session: SessionClaims = Depends(require_roles("manager", "staff", "admin")),
    service: ChartBuilderService = Depends(get_chart_builder_service),
):
    try:
        data = service.preview_chart_data(request)
    except ValueError as exc:
        raise AppError(
            str(exc),
            status_code=status.HTTP_400_BAD_REQUEST,
        ) from exc
    return {
        "success": True,
        "message": "Tạo bản xem trước biểu đồ thành công.",
        "data": data,
    }


@router.post("/data")
def get_chart_data(
    request: ChartRequest,
    session: SessionClaims = Depends(require_roles("manager", "staff", "admin")),
    service: ChartBuilderService = Depends(get_chart_builder_service),
):
    try:
        data = service.get_chart_data(request)
    except ValueError as exc:
        raise AppError(
            str(exc),
            status_code=status.HTTP_400_BAD_REQUEST,
        ) from exc
    return {
        "success": True,
        "message": "Lấy dữ liệu biểu đồ thành công.",
        "data": data,
    }


@router.get("/configs")
def get_configs(
    limit: int = Query(default=50, ge=1, le=100),
    session: SessionClaims = Depends(require_roles("manager", "staff", "admin")),
    service: ChartBuilderService = Depends(get_chart_builder_service),
):
    data = service.get_saved_configs(
        limit,
        username=session.username,
        role=session.role,
    )
    return {
        "success": True,
        "message": "Lấy cấu hình biểu đồ thành công.",
        "data": data,
    }


@router.post("/configs", status_code=status.HTTP_201_CREATED)
def save_config(
    config: SavedChartConfigCreate,
    session: SessionClaims = Depends(require_roles("manager", "staff", "admin")),
    service: ChartBuilderService = Depends(get_chart_builder_service),
):
    if config.scope == "shared" and session.role != "manager":
        raise AppError(
            "Chỉ quản lý được chia sẻ cấu hình toàn hệ thống.",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    try:
        data = service.save_chart_config(
            config,
            username=session.username,
            role=session.role,
        )
    except ValueError as exc:
        raise AppError(
            str(exc),
            status_code=status.HTTP_400_BAD_REQUEST,
        ) from exc
    return {
        "success": True,
        "message": "Lưu cấu hình biểu đồ thành công.",
        "data": data,
    }


@router.delete("/configs/{config_id}")
def delete_config(
    config_id: UUID,
    session: SessionClaims = Depends(require_roles("manager", "staff", "admin")),
    service: ChartBuilderService = Depends(get_chart_builder_service),
):
    if not service.delete_chart_config(
        config_id,
        username=session.username,
        role=session.role,
    ):
        raise AppError(
            "Không tìm thấy cấu hình biểu đồ.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return {
        "success": True,
        "message": "Đã xóa cấu hình biểu đồ.",
        "data": {"id": str(config_id)},
    }

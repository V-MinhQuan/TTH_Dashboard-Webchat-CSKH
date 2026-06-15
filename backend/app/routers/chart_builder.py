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

router = APIRouter(prefix="/api/chart-builder", tags=["chart-builder"])


def get_chart_builder_service() -> ChartBuilderService:
    return ChartBuilderService()


@router.get("/sources")
def get_sources(
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
    service: ChartBuilderService = Depends(get_chart_builder_service),
):
    data = service.get_catalog()
    return {
        "success": True,
        "message": "Lấy bộ dữ liệu biểu đồ thành công.",
        "data": data,
    }


@router.post("/preview")
def preview_chart_data(
    request: CustomChartRequest,
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
    service: ChartBuilderService = Depends(get_chart_builder_service),
):
    data = service.get_saved_configs(limit)
    return {
        "success": True,
        "message": "Lấy cấu hình biểu đồ thành công.",
        "data": data,
    }


@router.post("/configs", status_code=status.HTTP_201_CREATED)
def save_config(
    config: SavedChartConfigCreate,
    service: ChartBuilderService = Depends(get_chart_builder_service),
):
    try:
        data = service.save_chart_config(config)
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
    service: ChartBuilderService = Depends(get_chart_builder_service),
):
    if not service.delete_chart_config(config_id):
        raise AppError(
            "Không tìm thấy cấu hình biểu đồ.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return {
        "success": True,
        "message": "Đã xóa cấu hình biểu đồ.",
        "data": {"id": str(config_id)},
    }

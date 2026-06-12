from __future__ import annotations

from dataclasses import dataclass

from app.core.exceptions import AppError


@dataclass(frozen=True)
class Pagination:
    page: int
    page_size: int
    offset: int


def normalize_pagination(page: int = 1, page_size: int = 20, max_page_size: int = 100) -> Pagination:
    if page < 1:
        raise AppError("page must be greater than or equal to 1.", status_code=400)
    if page_size < 1 or page_size > max_page_size:
        raise AppError(f"pageSize must be between 1 and {max_page_size}.", status_code=400)
    return Pagination(page=page, page_size=page_size, offset=(page - 1) * page_size)


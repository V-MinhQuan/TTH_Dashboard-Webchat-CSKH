from __future__ import annotations

import logging
from typing import Dict

from app.db.session import get_connection

logger = logging.getLogger(__name__)


def check_database_health() -> Dict[str, str]:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 AS ok")
            cursor.fetchone()
        return {"status": "connected"}
    except Exception as exc:  # pragma: no cover - exact pyodbc errors vary by environment
        logger.warning("database health check failed: %s", exc)
        return {"status": "disconnected", "error": str(exc)}


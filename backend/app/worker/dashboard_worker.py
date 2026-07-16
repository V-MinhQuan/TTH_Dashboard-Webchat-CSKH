import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from app.services.legacy_dashboard_service import dashboard_service as legacy_ds
from app.repositories.ai_question_group_cache import AiQuestionGroupCacheRepository
from app.services.legacy_dashboard_service import (
    build_database_top_question_rows,
)

logger = logging.getLogger(__name__)

_rollup_cache_repo = AiQuestionGroupCacheRepository()

# Các kênh cần tổng hợp trong Nightly Rollup
_ROLLUP_CHANNELS = {
    "rows_all": None,
    "rows_chatwidget": "Chat Widget",
    "rows_facebook": "Facebook",
    "rows_zalooa": "Zalo OA",
    "rows_zalobiz": "Zalo Business",
}


class DashboardPrecomputeWorker:
    """
    Tiến trình chạy nền thay thế Celery:
    1. Mỗi 10 phút: tính toán sẵn KPI mặc định (30 ngày) vào RAM cache.
    2. Mỗi đêm lúc 1:00 AM: chạy Nightly Rollup tổng hợp câu hỏi từng ngày
       và lưu vào bảng WebChat_AiQuestionGroupCache trong SQL Server.
    """

    def __init__(self, interval_seconds: int = 600):
        self.interval_seconds = interval_seconds
        self._task: Optional[asyncio.Task] = None
        self._running = False

    def get_date_range(self, days: int):
        today = datetime.now().date()
        start = today - timedelta(days=days)
        return start.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d")

    def _seconds_until_1am(self) -> float:
        """Tính số giây còn lại đến 1:00 AM ngày hôm sau."""
        now = datetime.now()
        next_1am = now.replace(hour=1, minute=0, second=0, microsecond=0)
        if now.hour >= 1:
            next_1am += timedelta(days=1)
        return (next_1am - now).total_seconds()

    async def run_forever(self):
        self._running = True
        logger.info("DashboardPrecomputeWorker started. Đang chờ 15 giây để nhường đường cho Frontend...")

        # Chờ 15 giây đầu tiên để các API của Frontend chạy xong, tránh tranh chấp DB
        await asyncio.sleep(15)

        # Khởi động Nightly Rollup chạy song song
        asyncio.create_task(self._nightly_rollup_loop(), name="nightly-rollup-loop")

        while self._running:
            try:
                await self._compute_all_scenarios()
            except Exception as e:
                logger.error(f"Error in DashboardPrecomputeWorker: {e}")

            # Chờ đến chu kỳ tiếp theo
            await asyncio.sleep(self.interval_seconds)

    async def _nightly_rollup_loop(self):
        """Vòng lặp chạy Nightly Rollup vào đúng 1:00 AM mỗi ngày."""
        while self._running:
            wait_seconds = self._seconds_until_1am()
            logger.info(
                "NightlyRollup: Lịch chạy tiếp theo lúc 1:00 AM (sau %.0f giây = %.1f tiếng)",
                wait_seconds, wait_seconds / 3600,
            )
            await asyncio.sleep(wait_seconds)

            if not self._running:
                return

            try:
                await self._run_nightly_rollup()
            except Exception as e:
                logger.error(f"NightlyRollup: Lỗi khi chạy rollup: {e}")

            # Chờ 65 phút để tránh chạy 2 lần cùng ngày nếu vòng lặp bị trễ
            await asyncio.sleep(3900)

    async def _run_nightly_rollup(self):
        """Tổng hợp câu hỏi của ngày hôm qua và lưu vào DB."""
        yesterday = (datetime.now().date() - timedelta(days=1)).strftime("%Y-%m-%d")
        logger.info("NightlyRollup: Bắt đầu tổng hợp câu hỏi cho ngày %s...", yesterday)

        loop = asyncio.get_event_loop()
        rows_by_channel = {}

        for rollup_key, channel in _ROLLUP_CHANNELS.items():
            if not self._running:
                return

            try:
                raw_rows = await loop.run_in_executor(
                    None,
                    lambda ch=channel: legacy_ds.repository.get_top_questions_data(yesterday, yesterday, ch),
                )
                grouped = build_database_top_question_rows(raw_rows)
                rows_for_channel = grouped[0] if grouped and grouped[0] else []
                rows_by_channel[rollup_key] = rows_for_channel
                logger.info(
                    "NightlyRollup: Kênh '%s' -> %d nhóm câu hỏi",
                    channel or "Tất cả", len(rows_for_channel),
                )
            except Exception as e:
                logger.warning("NightlyRollup: Lỗi tổng hợp kênh %s: %s", channel, e)
                rows_by_channel[rollup_key] = []

            # Cho DB thở giữa các kênh
            await asyncio.sleep(5)

        if rows_by_channel.get("rows_all"):
            await loop.run_in_executor(
                None,
                lambda: _rollup_cache_repo.upsert_daily_rollup(yesterday, rows_by_channel),
            )
            logger.info("NightlyRollup: Đã lưu dữ liệu ngày %s vào DB thành công.", yesterday)
        else:
            logger.warning("NightlyRollup: Không có dữ liệu cho ngày %s, bỏ qua.", yesterday)

    async def _compute_all_scenarios(self):
        """Tính toán sẵn KPI 30 ngày vào RAM cache mỗi 10 phút."""
        date_scenarios = [self.get_date_range(30)]
        channels = [None]
        total = len(date_scenarios) * len(channels)
        count = 0

        logger.info(f"DashboardPrecomputeWorker: Bắt đầu tính toán {total} kịch bản KPI...")

        for start_date, end_date in date_scenarios:
            for channel in channels:
                if not self._running:
                    return

                count += 1
                logger.info(f"DashboardPrecomputeWorker [{count}/{total}]: {start_date} -> {end_date} | Kênh: {channel or 'Tất cả'}")

                filters = {
                    "channel": channel,
                    "forceRefresh": True,
                }

                loop = asyncio.get_event_loop()

                try:
                    await loop.run_in_executor(None, legacy_ds.get_kpis, start_date, end_date, filters)
                except Exception as e:
                    logger.warning(f"Lỗi khi tính toán KPIs: {e}")

                await asyncio.sleep(3)  # Cho DB thở

                try:
                    await loop.run_in_executor(None, legacy_ds.get_top_questions, start_date, end_date, filters)
                except Exception as e:
                    logger.warning(f"Lỗi khi tính toán Top Questions: {e}")

                await asyncio.sleep(3)  # Cho DB thở

                try:
                    await loop.run_in_executor(None, legacy_ds.get_urgent_alerts, start_date, end_date, filters)
                except Exception as e:
                    logger.warning(f"Lỗi khi tính toán Urgent Alerts: {e}")

                await asyncio.sleep(10)  # Nghỉ giữa kịch bản

        logger.info("DashboardPrecomputeWorker: Đã tính toán xong tất cả các kịch bản.")

    def stop(self):
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()

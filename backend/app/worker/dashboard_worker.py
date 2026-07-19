import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from app.services.legacy_dashboard_service import dashboard_service as legacy_ds
from app.repositories.ai_question_group_cache import AiQuestionGroupCacheRepository
from app.services.legacy_dashboard_service import (
    build_database_top_question_rows,
)

logger = logging.getLogger(__name__)
APP_TIMEZONE = ZoneInfo("Asia/Ho_Chi_Minh")
TOP_QUESTION_DETAIL_PREWARM_LIMIT = 5
TOP_QUESTION_DETAIL_PAGE_SIZE = 10
TOP_QUESTION_BACKGROUND_PAGE_DELAY_SECONDS = 1

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
        today = datetime.now(APP_TIMEZONE).date()
        start = today - timedelta(days=days)
        return start.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d")

    def _seconds_until_1am(self) -> float:
        """Tính số giây còn lại đến 1:00 AM ngày hôm sau."""
        now = datetime.now(APP_TIMEZONE)
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
        yesterday = (datetime.now(APP_TIMEZONE).date() - timedelta(days=1)).strftime("%Y-%m-%d")
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

                top_questions_payload = None
                try:
                    top_questions_payload = await loop.run_in_executor(
                        None,
                        legacy_ds.get_top_questions,
                        start_date,
                        end_date,
                        filters,
                    )
                except Exception as e:
                    logger.warning(f"Lỗi khi tính toán Top Questions: {e}")

                if top_questions_payload:
                    await self._precompute_top_question_details(
                        start_date,
                        end_date,
                        channel,
                        top_questions_payload.get("topQuestions") or [],
                    )

                await asyncio.sleep(3)  # Cho DB thở

                try:
                    await loop.run_in_executor(None, legacy_ds.get_urgent_alerts, start_date, end_date, filters)
                except Exception as e:
                    logger.warning(f"Lỗi khi tính toán Urgent Alerts: {e}")

                await asyncio.sleep(10)  # Nghỉ giữa kịch bản

        logger.info("DashboardPrecomputeWorker: Đã tính toán xong tất cả các kịch bản.")

    async def _precompute_top_question_details(
        self,
        start_date: str,
        end_date: str,
        channel: Optional[str],
        top_questions: list[dict],
    ) -> None:
        """Warm page 1 for every visible group, then remaining pages in background."""
        questions = [
            row.get("question")
            for row in top_questions[:TOP_QUESTION_DETAIL_PREWARM_LIMIT]
            if row.get("question")
        ]
        if not questions:
            return

        loop = asyncio.get_running_loop()
        page_one_results = {}
        filters = {"channel": channel}

        # Page 1 of all visible questions has strict priority. Do not start any
        # later page until every page 1 request has completed or failed.
        for question in questions:
            if not self._running:
                return
            try:
                result = await loop.run_in_executor(
                    None,
                    lambda q=question: legacy_ds.get_top_question_details(
                        q,
                        start_date,
                        end_date,
                        filters,
                        page=1,
                        page_size=TOP_QUESTION_DETAIL_PAGE_SIZE,
                    ),
                )
                page_one_results[question] = result
                logger.info(
                    "TopQuestionPrewarm: page=1 question=%s rows=%d totalPages=%d",
                    question,
                    len(result.get("records") or []),
                    int((result.get("pagination") or {}).get("totalPages") or 0),
                )
            except Exception as exc:
                logger.warning(
                    "TopQuestionPrewarm: không thể tải trang 1 question=%s error_type=%s",
                    question,
                    type(exc).__name__,
                )

        max_pages = max(
            (
                int((result.get("pagination") or {}).get("totalPages") or 0)
                for result in page_one_results.values()
            ),
            default=0,
        )
        for page_number in range(2, max_pages + 1):
            for question in questions:
                if not self._running:
                    return
                result = page_one_results.get(question) or {}
                total_pages = int((result.get("pagination") or {}).get("totalPages") or 0)
                if page_number > total_pages:
                    continue
                try:
                    await loop.run_in_executor(
                        None,
                        lambda q=question, p=page_number: legacy_ds.get_top_question_details(
                            q,
                            start_date,
                            end_date,
                            filters,
                            page=p,
                            page_size=TOP_QUESTION_DETAIL_PAGE_SIZE,
                        ),
                    )
                    logger.info(
                        "TopQuestionPrewarm: background page=%d question=%s",
                        page_number,
                        question,
                    )
                except Exception as exc:
                    logger.warning(
                        "TopQuestionPrewarm: lỗi trang nền page=%d question=%s error_type=%s",
                        page_number,
                        question,
                        type(exc).__name__,
                    )
                await asyncio.sleep(TOP_QUESTION_BACKGROUND_PAGE_DELAY_SECONDS)

    def stop(self):
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()

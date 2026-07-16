import asyncio
import logging
import sys
import os
from datetime import datetime, timedelta

# Cấu hình path để import được app module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.legacy_dashboard_service import dashboard_service as legacy_ds
from app.repositories.ai_question_group_cache import AiQuestionGroupCacheRepository
from app.services.legacy_dashboard_service import build_database_top_question_rows
from app.worker.dashboard_worker import _ROLLUP_CHANNELS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

async def populate_backfill(days_to_backfill: int = 45):
    """
    Chạy hồi tố (backfill) dữ liệu Nightly Rollup cho các ngày trong quá khứ.
    """
    repo = AiQuestionGroupCacheRepository()
    loop = asyncio.get_event_loop()
    
    today = datetime.now().date()
    
    logger.info(f"Bắt đầu chạy Backfill Nightly Rollup cho {days_to_backfill} ngày gần nhất...")
    logger.info(f"Cảnh báo: Tác vụ này sẽ tốn nhiều tài nguyên CPU và DB.")
    
    for i in range(1, days_to_backfill + 1):
        target_date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        
        # Kiểm tra xem ngày này đã có rollup chưa
        existing = repo.get_daily_rollup_range(target_date, target_date)
        if existing and target_date in existing:
            logger.info(f"Ngày {target_date} đã có Rollup trong DB, bỏ qua.")
            continue
            
        logger.info(f"Đang tính toán Rollup cho ngày {target_date}...")
        
        rows_by_channel = {}
        for rollup_key, channel in _ROLLUP_CHANNELS.items():
            try:
                # Query DB cho ngày này
                raw_rows = await loop.run_in_executor(
                    None,
                    lambda ch=channel: legacy_ds.repository.get_top_questions_data(target_date, target_date, ch),
                )
                
                # Chạy thuật toán gom nhóm cực nhanh (do chỉ có 1 ngày)
                grouped = build_database_top_question_rows(raw_rows)
                rows_for_channel = grouped[0] if grouped and grouped[0] else []
                rows_by_channel[rollup_key] = rows_for_channel
                
                logger.info(f" - Kênh {channel or 'Tất cả'}: {len(rows_for_channel)} nhóm câu hỏi.")
                
            except Exception as e:
                logger.error(f" - Lỗi khi tính kênh {channel} ngày {target_date}: {e}")
                rows_by_channel[rollup_key] = []
                
        # Lưu vào DB
        if rows_by_channel.get("rows_all"):
            await loop.run_in_executor(
                None,
                lambda: repo.upsert_daily_rollup(target_date, rows_by_channel),
            )
            logger.info(f"✅ Đã ghi thành công Rollup ngày {target_date} vào Database.\n")
        else:
            logger.warning(f"⚠️ Ngày {target_date} không có dữ liệu tin nhắn nào.\n")
            
        # Nghỉ 1 giây giữa các ngày để DB không bị quá tải
        await asyncio.sleep(1)

    logger.info("Hoàn tất Backfill toàn bộ dữ liệu!")

if __name__ == "__main__":
    # Đã tăng lên 365 ngày (1 năm) để chạy toàn bộ dữ liệu.
    # Nếu hệ thống của bạn có tuổi thọ lâu hơn 1 năm, hãy tăng số này lên (ví dụ 730 cho 2 năm)
    asyncio.run(populate_backfill(days_to_backfill=365))

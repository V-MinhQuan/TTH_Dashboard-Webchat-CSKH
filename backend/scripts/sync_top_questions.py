"""
sync_top_questions.py
---------------------
Script dong bo nhom cau hoi noi bat sau khi thuat toan Fallback duoc nang cap.
Thuc hien:
  1. Xoa cache nhom cau hoi cu trong DB (WebChat_AiQuestionGroupCache)
  2. Xoa cache in-memory cua Dashboard service
  3. Xoa file persistent cache (last_good JSON)
  4. Tai tao nhom cau hoi bang thuat toan moi (Fallback mode)

Cach chay:
  python backend/scripts/sync_top_questions.py
  python backend/scripts/sync_top_questions.py --dry-run
"""

import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def main(dry_run: bool = False):
    from app.repositories.ai_question_group_cache import AiQuestionGroupCacheRepository
    from app.services.legacy_dashboard_service import (
        clear_dashboard_cache,
        AI_QUESTION_LAST_GOOD_CACHE_FILE,
        build_database_top_question_rows,
    )
    from app.repositories.legacy_conversation_repository import ConversationRepository

    mode = "[DRY-RUN]" if dry_run else "[APPLY]"
    logger.info("%s Bat dau dong bo nhom cau hoi noi bat...", mode)

    # Buoc 1: Xoa cache DB
    repo = AiQuestionGroupCacheRepository()
    if not dry_run:
        affected = repo.invalidate_all()
        logger.info("%s Da vo hieu hoa %s hang cache trong DB.", mode, affected)
    else:
        logger.info("%s [Bo qua] Se vo hieu hoa cache DB.", mode)

    # Buoc 2: Xoa in-memory cache
    if not dry_run:
        clear_dashboard_cache(preserve_ai_questions=False)
        logger.info("%s Da xoa in-memory cache.", mode)
    else:
        logger.info("%s [Bo qua] Se xoa in-memory cache.", mode)

    # Buoc 3: Xoa file persistent cache
    if AI_QUESTION_LAST_GOOD_CACHE_FILE.exists():
        if not dry_run:
            AI_QUESTION_LAST_GOOD_CACHE_FILE.unlink()
            logger.info("%s Da xoa file persistent cache: %s", mode, AI_QUESTION_LAST_GOOD_CACHE_FILE)
        else:
            logger.info("%s [Bo qua] Se xoa file: %s", mode, AI_QUESTION_LAST_GOOD_CACHE_FILE)
    else:
        logger.info("%s File persistent cache khong ton tai, bo qua.", mode)

    # Buoc 4: Tai tao nhom cau hoi bang thuat toan moi
    logger.info("%s Dang tai du lieu cau hoi tu DB...", mode)
    conv_repo = ConversationRepository()
    raw_rows = conv_repo.get_top_questions_data(start_date=None, end_date=None, channel=None)
    raw_list = list(raw_rows or [])
    logger.info("%s Da tai %s hang cau hoi tho.", mode, len(raw_list))

    if not dry_run:
        logger.info("%s Dang chay thuat toan Fallback moi de tai tao nhom cau hoi...", mode)
        result_rows, status, message = build_database_top_question_rows(raw_list)
        if result_rows:
            logger.info(
                "%s Hoan tat! Tao duoc %s nhom cau hoi (status=%s).",
                mode, len(result_rows), status,
            )
            for i, row in enumerate(result_rows[:5], 1):
                examples = [q.get("question", "") for q in (row.get("relatedQuestions") or [])[:2]]
                logger.info(
                    "  #%d [%d luot] %s",
                    i, row.get("count", 0), row.get("question", ""),
                )
                if examples:
                    for ex in examples:
                        logger.info("         -> %s", ex)
        else:
            logger.warning(
                "%s Khong co nhom cau hoi nao duoc tao ra (status=%s, msg=%s).",
                mode, status, message,
            )
    else:
        logger.info("%s [Bo qua] Se chay thuat toan tai tao nhom cau hoi.", mode)

    logger.info("%s Dong bo hoan tat.", mode)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Dong bo nhom cau hoi noi bat voi thuat toan moi.")
    parser.add_argument("--dry-run", action="store_true", help="Chi xem truoc, khong thay doi DB.")
    args = parser.parse_args()
    main(dry_run=args.dry_run)

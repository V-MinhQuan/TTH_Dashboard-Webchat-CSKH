-- Compatibility wrapper for the staged Hugging Face analysis migration.
-- Run from the repository root with sqlcmd so :r paths resolve correctly:
--   sqlcmd ... -b -i backend/database/migrations/20260715_huggingface_analysis_state.sql
--
-- This wrapper intentionally excludes 04_requeue_quarantined_batch.sql.
-- Quarantined data must never be requeued automatically during schema apply.

:On Error exit
:r backend/database/migrations/01_add_hf_analysis_schema.sql
GO
:r backend/database/migrations/02_backfill_verified_legacy.sql
GO
:r backend/database/migrations/03_quarantine_unverified_legacy.sql
GO

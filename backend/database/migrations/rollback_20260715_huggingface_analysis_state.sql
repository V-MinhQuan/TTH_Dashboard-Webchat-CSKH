-- Compatibility wrapper for the guarded schema rollback.
-- The target script defaults to preflight-only and refuses rollback while any
-- pending, processing, failed, quarantined, or incomplete rows exist.

:On Error exit
:r backend/database/migrations/rollback_hf_analysis_schema.sql
GO

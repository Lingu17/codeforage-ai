-- =====================================================================
-- CodeForge AI DATABASE SCHEMA MIGRATION (V5)
-- Enables per-stage scan progress tracking.
--
-- The backend works without this column: it mirrors the stage JSON into the
-- existing `current_step` text column as a fallback. Adding `stages` jsonb
-- makes each pipeline stage's live status queryable as structured data.
-- =====================================================================

ALTER TABLE repository_scans ADD COLUMN IF NOT EXISTS stages jsonb DEFAULT '{}'::jsonb;

-- Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
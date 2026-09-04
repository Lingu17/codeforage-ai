-- =====================================================================
-- CODEFORGE AI DATABASE SCHEMA MIGRATION (V4)
-- Run this SQL in your Supabase SQL Editor to support multi-tenant isolation.
-- =====================================================================

-- 1. Drop existing unique constraint on github_id in repositories table
-- The standard name is repositories_github_id_key.
ALTER TABLE repositories DROP CONSTRAINT IF EXISTS repositories_github_id_key CASCADE;

-- 2. Add compound unique constraint on (github_id, user_id)
-- This allows different users to scan the same repository, while preventing 
-- a single user from importing the same repository multiple times.
ALTER TABLE repositories ADD CONSTRAINT repositories_github_id_user_id_key UNIQUE (github_id, user_id);

-- 3. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';

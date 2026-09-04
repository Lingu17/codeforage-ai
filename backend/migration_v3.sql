-- =====================================================================
-- CODEFORGE AI DATABASE SCHEMA MIGRATION (V3)
-- Run this SQL in your Supabase SQL Editor to add display_name & contact form table.
-- =====================================================================

-- 1. Add display_name column to repositories
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS display_name text;

-- 2. Create contact_messages table
CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS on contact_messages
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Allow anyone (unauthenticated/anon) to insert submissions
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON contact_messages;
CREATE POLICY "Anyone can submit contact messages"
  ON contact_messages FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 5. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';

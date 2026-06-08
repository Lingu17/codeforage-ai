-- =====================================================================
-- CODEFORGE AI DATABASE SCHEMA MIGRATION (V2)
-- Apply this SQL in your Supabase SQL Editor to migrate existing tables.
-- =====================================================================

-- 1. Rename scan_jobs to repository_scans if scan_jobs exists
ALTER TABLE IF EXISTS scan_jobs RENAME TO repository_scans;

-- 2. Rename code_files to repository_files if code_files exists
ALTER TABLE IF EXISTS code_files RENAME TO repository_files;

-- 3. Add file_id column to code_chunks referencing repository_files(id) if not exists
ALTER TABLE code_chunks ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES repository_files(id) ON DELETE CASCADE;

-- 4. Upgrade health_scores schema to include testing/performance and drop old debt_score
ALTER TABLE health_scores ADD COLUMN IF NOT EXISTS testing_score integer DEFAULT 80;
ALTER TABLE health_scores ADD COLUMN IF NOT EXISTS performance_score integer DEFAULT 80;
ALTER TABLE health_scores DROP COLUMN IF EXISTS debt_score;

-- 5. Create embeddings table to store RAG vectors separately
CREATE TABLE IF NOT EXISTS embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id uuid REFERENCES code_chunks(id) ON DELETE CASCADE NOT NULL,
  embedding vector(768) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Setup auto-replication database trigger on code_chunks to populate embeddings table
CREATE OR REPLACE FUNCTION replicate_code_chunk_embedding()
RETURNS trigger AS $$
BEGIN
  INSERT INTO embeddings (chunk_id, embedding, created_at)
  VALUES (new.id, new.embedding, new.created_at);
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS replicate_chunk_embedding_trigger ON code_chunks;
CREATE TRIGGER replicate_chunk_embedding_trigger
AFTER INSERT ON code_chunks
FOR EACH ROW
EXECUTE FUNCTION replicate_code_chunk_embedding();

-- 7. Enable Row Level Security (RLS) on all tables (just in case they were not enabled)
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE repository_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE repository_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE architecture_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_debt_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_reviews ENABLE ROW LEVEL SECURITY;

-- 8. Setup RLS Security Policies for the renamed tables and embeddings

-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Authenticated users can manage repositories" ON repositories;
DROP POLICY IF EXISTS "Users can manage repository_scans for their repositories" ON repository_scans;
DROP POLICY IF EXISTS "Users can manage repository_files for their repositories" ON repository_files;
DROP POLICY IF EXISTS "Users can manage code_chunks for their repositories" ON code_chunks;
DROP POLICY IF EXISTS "Users can manage embeddings for their repositories" ON embeddings;

-- Policy for repositories: Allow claiming if user_id is NULL
CREATE POLICY "Authenticated users can manage repositories"
  ON repositories FOR ALL TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy for repository_scans
CREATE POLICY "Users can manage repository_scans for their repositories"
  ON repository_scans FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM repositories WHERE repositories.id = repository_scans.repository_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM repositories WHERE repositories.id = repository_scans.repository_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)));

-- Policy for repository_files
CREATE POLICY "Users can manage repository_files for their repositories"
  ON repository_files FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM repositories WHERE repositories.id = repository_files.repository_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM repositories WHERE repositories.id = repository_files.repository_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)));

-- Policy for code_chunks
CREATE POLICY "Users can manage code_chunks for their repositories"
  ON code_chunks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM repositories WHERE repositories.id = code_chunks.repository_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM repositories WHERE repositories.id = code_chunks.repository_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)));

-- Policy for embeddings
CREATE POLICY "Users can manage embeddings for their repositories"
  ON embeddings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM code_chunks JOIN repositories ON code_chunks.repository_id = repositories.id WHERE code_chunks.id = embeddings.chunk_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM code_chunks JOIN repositories ON code_chunks.repository_id = repositories.id WHERE code_chunks.id = embeddings.chunk_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)));

-- 9. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';



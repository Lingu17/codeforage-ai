-- =====================================================================
-- CODEFORGE AI RLS POLICY UPDATE
-- Run this SQL in your Supabase SQL Editor to update policies.
-- =====================================================================

-- 1. Drop existing policy
DROP POLICY IF EXISTS "Authenticated users can manage repositories" ON repositories;

-- 2. Create updated policy that allows claiming repositories where user_id IS NULL
CREATE POLICY "Authenticated users can manage repositories"
  ON repositories FOR ALL TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Also update policies for code_chunks, repository_scans, repository_files, and embeddings 
-- to allow them to be inserted/managed during scan if the repository is owned by the user.

DROP POLICY IF EXISTS "Users can manage repository_scans for their repositories" ON repository_scans;
CREATE POLICY "Users can manage repository_scans for their repositories"
  ON repository_scans FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM repositories WHERE repositories.id = repository_scans.repository_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM repositories WHERE repositories.id = repository_scans.repository_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)));

DROP POLICY IF EXISTS "Users can manage repository_files for their repositories" ON repository_files;
CREATE POLICY "Users can manage repository_files for their repositories"
  ON repository_files FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM repositories WHERE repositories.id = repository_files.repository_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM repositories WHERE repositories.id = repository_files.repository_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)));

DROP POLICY IF EXISTS "Users can manage code_chunks for their repositories" ON code_chunks;
CREATE POLICY "Users can manage code_chunks for their repositories"
  ON code_chunks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM repositories WHERE repositories.id = code_chunks.repository_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM repositories WHERE repositories.id = code_chunks.repository_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)));

DROP POLICY IF EXISTS "Users can manage embeddings for their repositories" ON embeddings;
CREATE POLICY "Users can manage embeddings for their repositories"
  ON embeddings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM code_chunks JOIN repositories ON code_chunks.repository_id = repositories.id WHERE code_chunks.id = embeddings.chunk_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM code_chunks JOIN repositories ON code_chunks.repository_id = repositories.id WHERE code_chunks.id = embeddings.chunk_id AND (repositories.user_id = auth.uid() OR repositories.user_id IS NULL)));

NOTIFY pgrst, 'reload schema';

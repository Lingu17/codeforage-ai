-- Run after V2–V5 on existing installations, or after supabase_schema.sql.
BEGIN;
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS default_branch text;
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS scan_commit text;
ALTER TABLE repository_scans ADD COLUMN IF NOT EXISTS stages jsonb DEFAULT '{}';
ALTER TABLE repository_scans ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz DEFAULT now();
ALTER TABLE repository_scans ADD COLUMN IF NOT EXISTS cancel_requested boolean NOT NULL DEFAULT false;
ALTER TABLE code_chunks ADD COLUMN IF NOT EXISTS line_start integer;
ALTER TABLE code_chunks ADD COLUMN IF NOT EXISTS line_end integer;
ALTER TABLE code_chunks ADD COLUMN IF NOT EXISTS embedding_model text;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES chat_messages(id) ON DELETE CASCADE;
ALTER TABLE security_reports ADD COLUMN IF NOT EXISTS scope text;
ALTER TABLE health_scores ALTER COLUMN overall_score DROP NOT NULL;
ALTER TABLE health_scores ALTER COLUMN architecture_score DROP NOT NULL;
ALTER TABLE health_scores ALTER COLUMN security_score DROP NOT NULL;
ALTER TABLE health_scores ALTER COLUMN maintainability_score DROP NOT NULL;
ALTER TABLE health_scores ALTER COLUMN testing_score DROP NOT NULL;
ALTER TABLE health_scores ALTER COLUMN performance_score DROP NOT NULL;
ALTER TABLE health_scores ALTER COLUMN testing_score DROP DEFAULT;
ALTER TABLE health_scores ALTER COLUMN performance_score DROP DEFAULT;
ALTER TABLE technical_debt_reports ALTER COLUMN debt_score DROP NOT NULL;

-- NULL-owned legacy repositories remain inaccessible; do not claim user data.
-- Replace every policy, including obsolete permissive policies that otherwise
-- combine with secure policies using OR.
DO $$
DECLARE t text; p record; predicate text;
BEGIN
  FOREACH t IN ARRAY ARRAY['repositories','repository_scans','repository_files',
    'code_chunks','embeddings','architecture_reports','technical_debt_reports',
    'security_reports','health_scores','chat_sessions','chat_messages','pr_reviews']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    IF t='repositories' THEN
      predicate := 'auth.uid() = user_id';
    ELSIF t='chat_messages' THEN
      predicate := 'EXISTS (SELECT 1 FROM public.chat_sessions s JOIN public.repositories r ON r.id=s.repository_id WHERE s.id=chat_messages.session_id AND r.user_id=auth.uid())';
    ELSIF t='embeddings' THEN
      predicate := 'EXISTS (SELECT 1 FROM public.code_chunks c JOIN public.repositories r ON r.id=c.repository_id WHERE c.id=embeddings.chunk_id AND r.user_id=auth.uid())';
    ELSE
      predicate := format('EXISTS (SELECT 1 FROM public.repositories r WHERE r.id=%I.repository_id AND r.user_id=auth.uid())', t);
    END IF;
    EXECUTE format('CREATE POLICY owner_only ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)', t, predicate, predicate);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS repositories_user_idx ON repositories(user_id);
CREATE INDEX IF NOT EXISTS chunks_repo_file_idx ON code_chunks(repository_id, file_path);
-- Refuse historical duplicates; their reconciliation needs a reviewed data plan.
CREATE UNIQUE INDEX IF NOT EXISTS chunks_file_index_key ON code_chunks(repository_id,file_path,chunk_index);
CREATE INDEX IF NOT EXISTS chunks_lexical_idx ON code_chunks USING gin(to_tsvector('simple', chunk_text));
CREATE INDEX IF NOT EXISTS scans_repo_started_idx ON repository_scans(repository_id, started_at DESC);
CREATE INDEX IF NOT EXISTS chat_sessions_repo_idx ON chat_sessions(repository_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages(session_id, created_at);
-- Existing duplicate replies must be inspected before enabling a unique reply index.
CREATE INDEX IF NOT EXISTS chat_reply_idx ON chat_messages(reply_to);

-- Do not rewrite production job history during migration. If duplicate active
-- jobs exist, this index fails safely; inspect them and approve a recovery plan.
CREATE UNIQUE INDEX IF NOT EXISTS scans_one_active_repo ON repository_scans(repository_id)
WHERE status IN ('queued','cloning','scanning','embedding','analyzing');

-- Bind chunks to a file in the same repository (prevents mixed-owner references).
CREATE UNIQUE INDEX IF NOT EXISTS files_id_repo_idx ON repository_files(id, repository_id);
ALTER TABLE code_chunks DROP CONSTRAINT IF EXISTS chunks_file_repository_fk;
ALTER TABLE code_chunks ADD CONSTRAINT chunks_file_repository_fk
  FOREIGN KEY (file_id, repository_id) REFERENCES repository_files(id, repository_id) ON DELETE CASCADE NOT VALID;
-- Refuse legacy mixed-repository links rather than silently repairing/deleting data.
ALTER TABLE code_chunks VALIDATE CONSTRAINT chunks_file_repository_fk;

DROP FUNCTION IF EXISTS match_code_chunks(vector, double precision, integer, uuid);
CREATE FUNCTION match_code_chunks(query_embedding vector(768), match_threshold float, match_count int, repo_id uuid)
RETURNS TABLE(id uuid, file_path text, chunk_index int, chunk_text text,
              line_start int, line_end int, language text, similarity float)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,extensions AS $$
  SELECT c.id,c.file_path,c.chunk_index,c.chunk_text,c.line_start,c.line_end,c.language,
         1-(c.embedding <=> query_embedding)
  FROM code_chunks c
  WHERE c.repository_id=repo_id
    AND EXISTS(SELECT 1 FROM repositories r WHERE r.id=repo_id AND r.user_id=auth.uid())
    AND 1-(c.embedding <=> query_embedding)>match_threshold
  ORDER BY c.embedding <=> query_embedding LIMIT least(greatest(match_count,0),20);
$$;
CREATE OR REPLACE FUNCTION search_code_chunks(search_query text, repo_id uuid, match_count int DEFAULT 10)
RETURNS TABLE(id uuid, file_path text, chunk_index int, chunk_text text,
              line_start int, line_end int, language text, similarity float)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,extensions AS $$
  SELECT c.id,c.file_path,c.chunk_index,c.chunk_text,c.line_start,c.line_end,c.language,
    ts_rank(to_tsvector('simple',c.chunk_text),plainto_tsquery('simple',left(search_query,8000)))::float
  FROM code_chunks c
  WHERE c.repository_id=repo_id
    AND EXISTS(SELECT 1 FROM repositories r WHERE r.id=repo_id AND r.user_id=auth.uid())
    AND to_tsvector('simple',c.chunk_text) @@ plainto_tsquery('simple',left(search_query,8000))
  ORDER BY 8 DESC LIMIT least(greatest(match_count,0),20);
$$;
REVOKE ALL ON FUNCTION match_code_chunks(vector,float,int,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION search_code_chunks(text,uuid,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION match_code_chunks(vector,float,int,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION search_code_chunks(text,uuid,int) TO authenticated;

-- Retain the legacy embeddings table for compatibility; stop redundant writes.
DROP TRIGGER IF EXISTS replicate_chunk_embedding_trigger ON code_chunks;

-- Public inserts bypass HTTP spam controls. Contact submission is server-only.
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON contact_messages;
REVOKE INSERT ON contact_messages FROM anon, authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

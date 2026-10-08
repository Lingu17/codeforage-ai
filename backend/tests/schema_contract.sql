-- Read-only catalog assertions after V7; psql must use ON_ERROR_STOP=1.
BEGIN;
DO $$
DECLARE t text; count_policies int;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') THEN RAISE EXCEPTION 'pgvector missing'; END IF;
  IF (SELECT format_type(atttypid,atttypmod) FROM pg_attribute WHERE attrelid='code_chunks'::regclass AND attname='embedding') NOT LIKE '%vector(768)' THEN
    RAISE EXCEPTION 'Embedding dimension mismatch';
  END IF;
  FOREACH t IN ARRAY ARRAY['repositories','repository_files','code_chunks','embeddings','repository_scans','architecture_reports','technical_debt_reports','security_reports','health_scores','pr_reviews','chat_sessions','chat_messages','chat_requests'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN RAISE EXCEPTION 'RLS disabled: %',t; END IF;
    SELECT count(*) INTO count_policies FROM pg_policies WHERE schemaname='public' AND tablename=t;
    IF count_policies<>1 OR NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='owner_only' AND roles=ARRAY['authenticated']::name[]) THEN
      RAISE EXCEPTION 'Unexpected permissive policies: %',t;
    END IF;
  END LOOP;
  IF to_regclass('public.scans_one_active_repo') IS NULL OR to_regclass('public.chunks_lexical_idx') IS NULL OR to_regclass('public.files_id_repo_idx') IS NULL OR to_regclass('public.chunks_file_index_key') IS NULL THEN RAISE EXCEPTION 'Required index missing'; END IF;
  IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='code_chunks'::regclass AND tgname='replicate_chunk_embedding_trigger') THEN RAISE EXCEPTION 'Duplicate embedding trigger remains'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='code_chunks'::regclass AND conname='chunks_file_repository_fk') THEN RAISE EXCEPTION 'Repository/file FK missing'; END IF;
  IF EXISTS(SELECT 1 FROM code_chunks c JOIN repository_files f ON f.id=c.file_id WHERE c.repository_id<>f.repository_id) THEN RAISE EXCEPTION 'Legacy mismatched file references require manual review'; END IF;
  IF has_function_privilege('anon','match_code_chunks(vector,double precision,integer,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous retrieval allowed'; END IF;
  IF has_function_privilege('anon','begin_chat_request(uuid,text,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous chat claims allowed'; END IF;
  IF EXISTS(SELECT 1 FROM pg_proc WHERE oid IN ('match_code_chunks(vector,double precision,integer,uuid)'::regprocedure,'search_code_chunks(text,uuid,integer)'::regprocedure,'begin_chat_request(uuid,text,text,uuid)'::regprocedure,'complete_chat_request(uuid,text,jsonb)'::regprocedure) AND prosecdef) THEN RAISE EXCEPTION 'Privileged retrieval/chat function'; END IF;
END $$;
ROLLBACK;

-- Run as the database administrator on a staging Supabase project after V7.
-- Requires two existing test auth.users. All fixture changes roll back.
BEGIN;
DO $$ BEGIN
  IF (SELECT count(*) FROM auth.users) < 2 THEN
    RAISE EXCEPTION 'Create two staging test users before running this test';
  END IF;
END $$;
SELECT set_config('test.owner', (SELECT id::text FROM auth.users ORDER BY id LIMIT 1), true);
SELECT set_config('test.other', (SELECT id::text FROM auth.users ORDER BY id OFFSET 1 LIMIT 1), true);
SELECT set_config('test.repo', gen_random_uuid()::text, true);
INSERT INTO repositories(id,github_id,name,full_name,owner_username,user_id)
VALUES(current_setting('test.repo')::uuid,-9223372036854775807,'rls-fixture','fixture/rls-fixture','fixture',current_setting('test.owner')::uuid);
SELECT set_config('test.file',gen_random_uuid()::text,true);
SELECT set_config('test.chunk',gen_random_uuid()::text,true);
SELECT set_config('test.session',gen_random_uuid()::text,true);
INSERT INTO repository_files(id,repository_id,file_path,language) VALUES(current_setting('test.file')::uuid,current_setting('test.repo')::uuid,'auth.py','python');
INSERT INTO code_chunks(id,repository_id,file_id,file_path,chunk_index,chunk_text,embedding,language,line_start,line_end,embedding_model)
VALUES(current_setting('test.chunk')::uuid,current_setting('test.repo')::uuid,current_setting('test.file')::uuid,'auth.py',0,'def authentication(): return True',array_fill(0.1::real,ARRAY[768])::vector,'python',1,1,'test');
INSERT INTO embeddings(chunk_id,embedding) VALUES(current_setting('test.chunk')::uuid,array_fill(0.1::real,ARRAY[768])::vector);
INSERT INTO repository_scans(repository_id,status) VALUES(current_setting('test.repo')::uuid,'completed');
INSERT INTO architecture_reports(repository_id,graph_data) VALUES(current_setting('test.repo')::uuid,'{}');
INSERT INTO technical_debt_reports(repository_id,debt_score) VALUES(current_setting('test.repo')::uuid,NULL);
INSERT INTO security_reports(repository_id,security_score) VALUES(current_setting('test.repo')::uuid,100);
INSERT INTO health_scores(repository_id,overall_score) VALUES(current_setting('test.repo')::uuid,NULL);
INSERT INTO pr_reviews(repository_id,diff_content,summary,risk_level) VALUES(current_setting('test.repo')::uuid,'test','fixture','Low');
INSERT INTO chat_sessions(id,repository_id) VALUES(current_setting('test.session')::uuid,current_setting('test.repo')::uuid);
INSERT INTO chat_messages(session_id,role,content) VALUES(current_setting('test.session')::uuid,'user','fixture');
INSERT INTO chat_requests(user_id,repository_id,request_id,question,session_id,status) VALUES(current_setting('test.owner')::uuid,current_setting('test.repo')::uuid,'rls-fixture','question',current_setting('test.session')::uuid,'completed');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
SELECT set_config('request.jwt.claims',json_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM repositories WHERE id=current_setting('test.repo')::uuid) THEN
    RAISE EXCEPTION 'Owner cannot read fixture';
  END IF;
END $$;
DO $$
DECLARE t text; predicate text; n int;
BEGIN
  FOREACH t IN ARRAY ARRAY['repository_files','code_chunks','embeddings','repository_scans','architecture_reports','technical_debt_reports','security_reports','health_scores','pr_reviews','chat_sessions','chat_messages','chat_requests'] LOOP
    predicate := CASE WHEN t='embeddings' THEN format('chunk_id=%L::uuid',current_setting('test.chunk'))
      WHEN t='chat_messages' THEN format('session_id=%L::uuid',current_setting('test.session'))
      ELSE format('repository_id=%L::uuid',current_setting('test.repo')) END;
    EXECUTE format('SELECT count(*) FROM %I WHERE %s',t,predicate) INTO n;
    IF n<>1 THEN RAISE EXCEPTION 'Owner fixture unavailable: %',t; END IF;
  END LOOP;
END $$;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM match_code_chunks(array_fill(0.1::real,ARRAY[768])::vector,0.0,8,current_setting('test.repo')::uuid)) THEN RAISE EXCEPTION 'Owner vector retrieval broken'; END IF;
  IF NOT EXISTS(SELECT 1 FROM search_code_chunks('authentication',current_setting('test.repo')::uuid,8)) THEN RAISE EXCEPTION 'Owner lexical retrieval broken'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('test.other'),true);
SELECT set_config('request.jwt.claims',json_build_object('sub',current_setting('test.other'),'role','authenticated')::text,true);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM repositories WHERE id=current_setting('test.repo')::uuid) THEN
    RAISE EXCEPTION 'Cross-user repository read allowed';
  END IF;
  IF EXISTS(SELECT 1 FROM search_code_chunks('authentication',current_setting('test.repo')::uuid,8)) THEN RAISE EXCEPTION 'Cross-user lexical retrieval allowed'; END IF;
  IF EXISTS(SELECT 1 FROM match_code_chunks(array_fill(0.1::real,ARRAY[768])::vector,0.0,8,current_setting('test.repo')::uuid)) THEN
    RAISE EXCEPTION 'Cross-user vector retrieval allowed';
  END IF;
  BEGIN
    INSERT INTO repository_files(repository_id,file_path,language)
      VALUES(current_setting('test.repo')::uuid,'forbidden.py','python');
    RAISE EXCEPTION 'Cross-user child insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  DELETE FROM repositories WHERE id=current_setting('test.repo')::uuid;
  IF FOUND THEN RAISE EXCEPTION 'Cross-user delete allowed'; END IF;
END $$;
DO $$
DECLARE t text; predicate text; n int;
BEGIN
  FOREACH t IN ARRAY ARRAY['repository_files','code_chunks','embeddings','repository_scans','architecture_reports','technical_debt_reports','security_reports','health_scores','pr_reviews','chat_sessions','chat_messages','chat_requests'] LOOP
    predicate := CASE WHEN t='embeddings' THEN format('chunk_id=%L::uuid',current_setting('test.chunk'))
      WHEN t='chat_messages' THEN format('session_id=%L::uuid',current_setting('test.session'))
      ELSE format('repository_id=%L::uuid',current_setting('test.repo')) END;
    EXECUTE format('SELECT count(*) FROM %I WHERE %s',t,predicate) INTO n;
    IF n<>0 THEN RAISE EXCEPTION 'Cross-user read allowed: %',t; END IF;
    EXECUTE format('UPDATE %I SET id=id WHERE %s',t,predicate);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n<>0 THEN RAISE EXCEPTION 'Cross-user update allowed: %',t; END IF;
    EXECUTE format('DELETE FROM %I WHERE %s',t,predicate);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n<>0 THEN RAISE EXCEPTION 'Cross-user delete allowed: %',t; END IF;
  END LOOP;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM repositories WHERE id=current_setting('test.repo')::uuid) THEN
    RAISE EXCEPTION 'Fixture was deleted';
  END IF;
END $$;
ROLLBACK;

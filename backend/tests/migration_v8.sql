-- Disposable CI database only: exercise absent and partial chat tables.
DROP TABLE public.chat_requests;
\ir /backend/migration_v8.sql
\ir /backend/migration_v7.sql
DROP TRIGGER chat_requests_question_not_null ON public.chat_requests;
ALTER TABLE public.chat_requests DROP COLUMN question;
INSERT INTO repositories(id,github_id,name,full_name,owner_username,user_id)
VALUES('00000000-0000-0000-0000-000000000008',-8,'v8-fixture','fixture/v8','fixture','00000000-0000-0000-0000-000000000001');
INSERT INTO chat_requests(user_id,repository_id,request_id)
VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000008','legacy');
CREATE POLICY legacy_permissive ON chat_requests FOR ALL TO authenticated USING(true) WITH CHECK(true);
\ir /backend/migration_v8.sql
\ir /backend/migration_v8.sql
BEGIN;
DO $$
BEGIN
  UPDATE chat_requests SET status='failed' WHERE request_id='legacy';
  IF NOT FOUND THEN RAISE EXCEPTION 'Legacy row lost'; END IF;
  IF EXISTS(SELECT 1 FROM pg_policies WHERE tablename='chat_requests' AND policyname='legacy_permissive') THEN
    RAISE EXCEPTION 'Permissive policy survived';
  END IF;
  BEGIN
    INSERT INTO chat_requests(user_id,repository_id,request_id)
    VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000008','missing-question');
    RAISE EXCEPTION 'NULL question accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  IF begin_chat_request('00000000-0000-0000-0000-000000000008','new question','legacy')->>'status'<>'conflict' THEN
    RAISE EXCEPTION 'Unknown legacy question reused';
  END IF;
  UPDATE chat_requests SET question='recovered' WHERE request_id='legacy';
  BEGIN
    UPDATE chat_requests SET question='' WHERE request_id='legacy';
    RAISE EXCEPTION 'Empty question accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
ROLLBACK;
DELETE FROM repositories WHERE id='00000000-0000-0000-0000-000000000008';

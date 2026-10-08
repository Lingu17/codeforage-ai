-- Durable chat idempotency. Apply after V6.
BEGIN;
CREATE TABLE IF NOT EXISTS chat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  request_id text NOT NULL CHECK(length(request_id) BETWEEN 1 AND 100),
  question text NOT NULL CHECK(length(question) BETWEEN 1 AND 8000),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_message_id uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed','cancelled')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,repository_id,request_id)
);
ALTER TABLE chat_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_only ON chat_requests;
CREATE POLICY owner_only ON chat_requests FOR ALL TO authenticated
USING(auth.uid()=user_id AND EXISTS(SELECT 1 FROM repositories r WHERE r.id=chat_requests.repository_id AND r.user_id=auth.uid()))
WITH CHECK(auth.uid()=user_id AND EXISTS(SELECT 1 FROM repositories r WHERE r.id=chat_requests.repository_id AND r.user_id=auth.uid()));

CREATE OR REPLACE FUNCTION begin_chat_request(repo_id uuid, question_text text, client_request_id text, existing_session uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE claim chat_requests; sid uuid; mid uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM repositories WHERE id=repo_id AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Repository unavailable';
  END IF;
  INSERT INTO chat_requests(user_id,repository_id,request_id,question)
    VALUES(auth.uid(),repo_id,client_request_id,question_text)
    ON CONFLICT(user_id,repository_id,request_id) DO NOTHING RETURNING * INTO claim;
  IF claim.id IS NULL THEN
    SELECT * INTO claim FROM chat_requests WHERE user_id=auth.uid()
      AND repository_id=repo_id AND request_id=client_request_id FOR UPDATE;
    IF claim.question<>question_text OR (existing_session IS NOT NULL AND existing_session<>claim.session_id) THEN
      RETURN jsonb_build_object('status','conflict');
    END IF;
    IF claim.status='completed' THEN
      RETURN jsonb_build_object('status','replay','claim_id',claim.id,'session_id',claim.session_id,'user_message_id',claim.user_message_id);
    END IF;
    IF claim.status='running' AND claim.updated_at>now()-interval '3 minutes' THEN
      RETURN jsonb_build_object('status','busy');
    END IF;
    UPDATE chat_requests SET status='running',updated_at=now() WHERE id=claim.id;
    RETURN jsonb_build_object('status','generate','claim_id',claim.id,'session_id',claim.session_id,'user_message_id',claim.user_message_id);
  END IF;
  sid := existing_session;
  IF sid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM chat_sessions WHERE id=sid AND repository_id=repo_id) THEN
    RAISE EXCEPTION 'Session unavailable';
  END IF;
  IF sid IS NULL THEN
    INSERT INTO chat_sessions(repository_id,title) VALUES(repo_id,left(question_text,50)) RETURNING id INTO sid;
  END IF;
  INSERT INTO chat_messages(session_id,role,content) VALUES(sid,'user',question_text) RETURNING id INTO mid;
  UPDATE chat_requests SET session_id=sid,user_message_id=mid WHERE id=claim.id;
  RETURN jsonb_build_object('status','generate','claim_id',claim.id,'session_id',sid,'user_message_id',mid);
END $$;
CREATE OR REPLACE FUNCTION complete_chat_request(claim_id uuid, answer_text text, source_citations jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE claim chat_requests; reply_id uuid;
BEGIN
  SELECT * INTO claim FROM chat_requests WHERE id=claim_id AND user_id=auth.uid() FOR UPDATE;
  IF claim.id IS NULL OR claim.status<>'running' THEN RAISE EXCEPTION 'Chat request unavailable'; END IF;
  IF length(trim(answer_text))=0 OR length(answer_text)>100000 THEN RAISE EXCEPTION 'Invalid answer'; END IF;
  INSERT INTO chat_messages(session_id,role,content,citations,reply_to)
    VALUES(claim.session_id,'assistant',answer_text,source_citations,claim.user_message_id) RETURNING id INTO reply_id;
  UPDATE chat_requests SET status='completed',updated_at=now() WHERE id=claim_id;
  RETURN reply_id;
END $$;
REVOKE ALL ON FUNCTION begin_chat_request(uuid,text,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION complete_chat_request(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION begin_chat_request(uuid,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_chat_request(uuid,text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

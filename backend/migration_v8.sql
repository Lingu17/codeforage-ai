-- migration_v8.sql
-- ----------------------------------------------------------------------
--  Add the canonical `chat_requests` table (if missing) and safely upgrade
--  older databases that may already have a partial version of the table.
--  The migration is completely additive – no data loss, no table drops.
-- ----------------------------------------------------------------------
BEGIN;

--------------------------------------------------------------------
-- 1. Create the table for brand‑new databases.
--------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_requests (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    repository_id     uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    request_id        text NOT NULL CHECK (length(request_id) BETWEEN 1 AND 100),
    question          text,  -- added nullable; validation via trigger (see below)
    session_id        uuid REFERENCES chat_sessions(id)   ON DELETE CASCADE,
    user_message_id   uuid REFERENCES chat_messages(id)   ON DELETE CASCADE,
    status            text NOT NULL DEFAULT 'running'
                               CHECK (status IN ('running','completed','failed','cancelled')),
    created_at        timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at        timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (user_id, repository_id, request_id)
);

--------------------------------------------------------------------
-- 2. Upgrade an existing (partial) table – add missing columns,
--    constraints, defaults, RLS policy, and a trigger that enforces
--    that `question` is NOT NULL on new inserts/updates.
--------------------------------------------------------------------
DO $$
DECLARE
    _trigger_exists boolean;
BEGIN
    ----------------------------------------------------------------
    -- 2a. Add `question` column (may be missing)
    ----------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'chat_requests'
          AND column_name  = 'question'
    ) THEN
        ALTER TABLE public.chat_requests
            ADD COLUMN question text;  -- nullable on existing rows
    END IF;

    ----------------------------------------------------------------
    -- 2b. Add `session_id` column (may be missing)
    ----------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'chat_requests'
          AND column_name  = 'session_id'
    ) THEN
        ALTER TABLE public.chat_requests
            ADD COLUMN session_id uuid
                REFERENCES public.chat_sessions(id) ON DELETE CASCADE;
    END IF;

    ----------------------------------------------------------------
    -- 2c. Add `user_message_id` column (may be missing)
    ----------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'chat_requests'
          AND column_name  = 'user_message_id'
    ) THEN
        ALTER TABLE public.chat_requests
            ADD COLUMN user_message_id uuid
                REFERENCES public.chat_messages(id) ON DELETE CASCADE;
    END IF;

    ----------------------------------------------------------------
    -- 2d. Tighten `status` column defaults / constraints
    ----------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chat_requests_status_check'
    ) THEN
        ALTER TABLE public.chat_requests
            ALTER COLUMN status SET DEFAULT 'running',
            ALTER COLUMN status SET NOT NULL,
            ADD CONSTRAINT chat_requests_status_check
                CHECK (status IN ('running','completed','failed','cancelled'));
    END IF;

    ----------------------------------------------------------------
    -- 2e. Add the idempotency unique constraint (if not already present)
    ----------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chat_requests_user_repository_request_key'
    ) THEN
        ALTER TABLE public.chat_requests
            ADD CONSTRAINT chat_requests_user_repository_request_key
                UNIQUE (user_id, repository_id, request_id);
    END IF;

    ----------------------------------------------------------------
    -- 2f. Enable Row‑Level Security and recreate the exact owner_only policy.
    ----------------------------------------------------------------
    ALTER TABLE public.chat_requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS owner_only ON public.chat_requests;
    CREATE POLICY owner_only ON public.chat_requests
        FOR ALL TO authenticated
        USING (
            auth.uid() = user_id
            AND EXISTS (
                SELECT 1 FROM public.repositories r
                WHERE r.id = chat_requests.repository_id
                  AND r.user_id = auth.uid()
            )
        )
        WITH CHECK (
            auth.uid() = user_id
            AND EXISTS (
                SELECT 1 FROM public.repositories r
                WHERE r.id = chat_requests.repository_id
                  AND r.user_id = auth.uid()
            )
        );

    ----------------------------------------------------------------
    -- 2g. Add a trigger that enforces `question` NOT NULL on new rows.
    ----------------------------------------------------------------
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'chat_requests_question_not_null'
    ) INTO _trigger_exists;
    IF NOT _trigger_exists THEN
        CREATE OR REPLACE FUNCTION chat_requests_question_not_null()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.question IS NULL THEN
                RAISE EXCEPTION 'question must be provided for chat_requests';
            END IF;
            RETURN NEW;
        END;
        $$;
        CREATE TRIGGER chat_requests_question_not_null
            BEFORE INSERT OR UPDATE ON public.chat_requests
            FOR EACH ROW EXECUTE FUNCTION chat_requests_question_not_null();
    END IF;
END $$;

--------------------------------------------------------------------
-- 3. Commit the transaction.
--------------------------------------------------------------------
COMMIT;

# Database release plan — V6/V7

No live schema or production rows were changed during this release pass. The configured Supabase REST endpoint is reachable (HTTP 200). The original SDK failure was `AttributeError: ClientOptions has no attribute storage`; the client now uses `SyncClientOptions`. The readiness endpoint deliberately remains 503 because required deployed columns/tables are absent.

Read-only inspection found missing `repositories.default_branch`, `repository_scans.stages`, `code_chunks.line_start`, `chat_messages.reply_to`, `security_reports.scope`, and the `chat_requests` table. These findings prove an incomplete schema contract; they do not establish which historical migrations were previously run.

## Exact procedure

1. Take a database backup and pause application writes/scans. Inspect migrations V2–V5 against the current catalog. V2 applies only when legacy `scan_jobs`/`code_files` names exist. It refuses ambiguous dual tables and preserves legacy `health_scores.debt_score`. V3 adds contact/display metadata; V4 removes global GitHub uniqueness and adds per-owner uniqueness without `CASCADE`; V5 adds stage JSON. Do not rerun the base schema against production.
2. Run the preflight queries below as an administrator. Any returned conflicting rows block migration. Investigate them; do not delete or rewrite production records automatically. Verify all expected tables exist, pgvector is installed, embedding is `vector(768)`, and review existing policies, triggers and external dependencies on retrieval functions.
3. Review and explicitly approve the maintenance migration before execution. Apply `backend/migration_v6.sql` as one transaction. It adds provenance/job metadata, makes unmeasured scores nullable, removes fabricated defaults, replaces legacy policies with owner-only policies, adds retrieval/job indexes, validates the repository/file FK, replaces retrieval RPCs as SECURITY INVOKER, revokes anonymous RPC execution, and removes duplicate embedding replication. It does not drop tables/data columns or automatically alter existing job history. A duplicate active job or mixed-repository FK aborts the transaction.
4. Apply `backend/migration_v7.sql` as one transaction. It adds owner-scoped chat claims and transactional begin/complete RPCs. It preserves existing messages. Existing permissive policies on the new claims table are replaced. No cleanup of historical chats is performed.
5. Reload PostgREST's schema cache (both scripts issue NOTIFY), run `python backend/schema_check.py`, then `backend/tests/schema_contract.sql` with `ON_ERROR_STOP=1`. Confirm columns, dimensions, indexes, policies, triggers, FK validation and RPC privileges. Do not resume production traffic on failure.
6. On a disposable/staging database with two test users, run `backend/tests/rls_isolation.sql` using `ON_ERROR_STOP=1`. Its fixtures roll back. Positive owner controls precede cross-user tests for repositories, files, chunks, embeddings, scans, reports, reviews, sessions, messages and chat claims, including vector/lexical retrieval and writes/deletes. Never treat SQL syntax parsing as proof of RLS behavior.
7. Verify `/ready` returns 200, then complete OAuth/private clone, scan, partial retry and authenticated RAG/chat checks before enabling production traffic. Roll back an unsuccessful migration transaction; after committed changes, restore/revert only under a reviewed backup plan. Do not drop the new tables to undo migration, as they may contain new data.

```sql
-- Must return zero rows before applying V4/V6.
SELECT github_id,user_id,count(*) FROM repositories GROUP BY github_id,user_id HAVING count(*)>1;
SELECT repository_id,file_path,chunk_index,count(*) FROM code_chunks
GROUP BY repository_id,file_path,chunk_index HAVING count(*)>1;
SELECT repository_id,count(*) FROM repository_scans
WHERE status IN ('queued','cloning','scanning','embedding','analyzing')
GROUP BY repository_id HAVING count(*)>1;
SELECT c.id FROM code_chunks c JOIN repository_files f ON f.id=c.file_id
WHERE c.repository_id<>f.repository_id;
SELECT extname,extversion FROM pg_extension WHERE extname='vector';
SELECT tablename,policyname,roles,qual,with_check FROM pg_policies WHERE schemaname='public';
```

## Disposable local verification

Docker is not installed/available in this workspace; these commands have **NOT BEEN EXECUTED**. The added compose workflow initializes a separate PostgreSQL/pgvector instance with minimal test-only Supabase auth roles. It does not connect to the configured Supabase project, and does not replace Supabase OAuth/PostgREST integration verification.

```powershell
docker compose -f compose.db-test.yml up -d --wait
docker compose -f compose.db-test.yml exec -T db-test psql -U postgres -d codeforge_test -v ON_ERROR_STOP=1 -f /tests/schema_contract.sql
docker compose -f compose.db-test.yml exec -T db-test psql -U postgres -d codeforge_test -v ON_ERROR_STOP=1 -f /tests/rls_isolation.sql
docker compose -f compose.db-test.yml down
```

CI runs these same disposable database checks. CI results must be inspected after pushing; configuration alone is not a PASS. Migrations V2–V7 and the database test SQL were syntax-parsed locally; actual catalog/PLpgSQL execution and RLS isolation remain **NOT VERIFIED**.

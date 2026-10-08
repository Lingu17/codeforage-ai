# CodeForge AI

Repository analysis with Next.js 16, FastAPI, Supabase Auth/Postgres/pgvector, Gemini embeddings and PR review, and Groq repository chat. The canonical application is `frontend/` and `backend/`. The obsolete nested checkout and broken tracked Python environment were archived outside this checkout. Local environment files were preserved; never commit them.

## Local setup

Use Python 3.14 and Node.js 24. From the root in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements.txt -r backend/requirements-dev.txt
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

Copy examples only when no local configuration exists. Populate placeholders with your project configuration. Provider keys and the optional contact service-role key stay server-side. Browser configuration contains only the public Supabase URL/anon key and backend URL. Production validation rejects missing configuration. Set `ALLOWED_ORIGINS` to actual frontend origins.

Configure GitHub OAuth in Supabase with callback `/auth/callback` and private-repository scope when needed. Start from `backend/`:

```powershell
..\.venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

In another terminal, from `frontend/`:

```powershell
npm ci
npm run dev
```

Frontend: http://localhost:3000. Backend: http://127.0.0.1:8000. API docs: `/docs`. `/health` and `/api/health` check process liveness. `/ready` probes database access and returns 503 when unavailable.

## Database setup

Back up existing databases and test migrations on staging. Fresh Supabase projects: run `backend/supabase_schema.sql`, then migrations V3, V4, V5, V6, V7 in order. V2 is only for legacy deployments with earlier table names. Existing deployments must apply outstanding migrations through V7. The base schema is initialization, not an arbitrary repeatable migration.

V6 replaces permissive policies with owner-only policies, scopes retrieval RPCs, adds line/model provenance and job metadata, and disables redundant embedding replication. Legacy NULL-owned repositories remain inaccessible: assign ownership only after independent verification. V6 refuses duplicate active jobs or chunk indexes and validates repository/file references; it does not rewrite job history. Review conflicts during maintenance before applying it. V7 adds transactional chat request claims and assistant persistence. Reload PostgREST schema cache after migration. Do not run this version against an unmigrated database.

`backend/tests/rls_isolation.sql` is a rollback-only staging smoke test requiring two existing test users, run by a database administrator. It checks owner visibility, cross-user reads/writes/deletes and vector retrieval. Live migrations and RLS isolation are **NOT VERIFIED** here.

## Implemented behavior and limits

- GitHub identities are verified before cloning. Only canonical HTTPS GitHub URLs are accepted. Tokens are excluded from clone URLs and command arguments. Repository code is parsed, not executed.
- Jobs persist stages, coverage, heartbeats, cancellation and failures. Failed embedding batches produce partial/failed results. Retry reuses valid unchanged files. In-process work is lost on restart; stale jobs become recoverable failures on status/retry requests, with conditional updates that cannot override fresh heartbeats. Automatic distributed queue replay is not implemented.
- Gemini embeddings are batched, bounded, validated at 768 dimensions, rate limited and retried for transient failures. Query/document formatting follows the configured model. Invalid embeddings fail explicitly.
- Chat combines repository-scoped vector and lexical retrieval with bounded context. Source chunks are untrusted data. Citations use actual line metadata and recorded scan commits. Streamed requests use durable idempotency claims; truncated/error streams never report success.
- Security uses selected secret patterns and Python AST rules with redacted evidence, severity, CWE and remediation. This is not comprehensive security/dependency auditing or equal coverage across languages.
- Health uses deterministic cycles, large files and detected source issues. Testing and performance are unmeasured (`null`). Source scores do not certify production quality. Debt points to large files and cycles without invented effort estimates.
- Import graphs expose local edges, cycles and available metadata. Resolution is heuristic for unsupported language constructs. Observed external imports are shown separately, with Internal/External/Both filtering; installation and service relationships are not inferred.
- PR review accepts bounded diffs and validates generated categories and locations against added lines before saving. Suggestions require human review.

Source chunks, embeddings, reports, PR diffs and chat messages are retained in Supabase. Relevant code is sent to Gemini/Groq. Configure retention, consent, isolated workers and deployment controls before sensitive code use. Contact submission requires a backend-only service-role key; its process-local rate limiter is not distributed protection. Paid plans, SSO and billing are not implemented.

## Verification commands

From `backend/`:

```powershell
python -m pytest -q
python -m compileall -q . -x "venv|__pycache__"
python -m bandit -r . -x tests,venv -ll
python -m pip_audit -r requirements.txt
```

From `frontend/`:

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
npm audit
```

CI runs relevant checks. TypeScript/build errors must not be bypassed. The inherited ESLint configuration reports several React/typing rules as warnings; a passing exit is not warning-free code. Docker runs one non-root backend worker; Docker execution is **NOT VERIFIED**.

Local liveness/docs and mocked authorization/provider failures were tested. Public landing widths 390/768/1024/1280 had no horizontal overflow. Forms have accessible names, and the planned-feature dialog was checked for keyboard focus wrapping, Escape and focus restoration. Database readiness remains 503 because V6/V7 schema changes are missing; the SDK constructor mismatch was corrected. Public GitHub metadata/clone/parsing and live Gemini embedding/generation and Groq completion/streaming passed. Authenticated import/private cloning, deployed RLS, end-to-end scan/chat, complete accessibility and production load remain **NOT VERIFIED**. Five high-severity development advisories remain in the Next ESLint toolchain. Runtime npm and pinned backend audits had no known advisories at verification time.

See `AUDIT.md` for final evidence. Production readiness: **NOT READY** pending external verification and operational limitations.

## Release and deployment gates

Read `DATABASE_RELEASE_PLAN.md` before applying migrations. Run `python backend/schema_check.py` for read-only schema diagnostics. Disposable PostgreSQL/pgvector verification is defined in `compose.db-test.yml`; see the release plan for exact commands. Docker is unavailable locally. The disposable database workflow subsequently passed in GitHub CI; live Supabase RLS and the application Docker image remain unverified.

For a configured staging API and existing scanned test repository, set `CODEFORGE_SMOKE_URL`, `CODEFORGE_SMOKE_TOKEN`, and `CODEFORGE_SMOKE_REPO_ID`, then run `python tools/e2e_smoke.py`. The default smoke reads authenticated reports only. `--chat` explicitly writes three cited test chats; use it only on authorized staging data. It does not replace browser OAuth/private import testing.

Build a backend image with `docker build -t codeforge-backend backend`. Provide server environment values through your deployment's secret store, set `APP_ENV=production`, configure the tested generation model explicitly, and allow only the actual HTTPS frontend origin. The current local environment lacks production `GEMINI_AI_MODEL` and `ALLOWED_ORIGINS`; do not deploy it as-is. The frontend uses `npm run build` and `npm run start` with public configuration. Backend `/ready` must pass before routing production traffic. Deploy a single backend worker; this version has persisted state and stale recovery, not a distributed worker queue.

Run `python tools/check_release.py` before staging and `python tools/check_release.py --staged` before committing. These scans inspect candidate/indexed Git content without reading ignored local env files or printing credential values. They are signature checks, not a guarantee of secret absence.

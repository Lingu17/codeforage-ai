# Final release evidence — 2026-10-08

The canonical application is root `backend/` and `frontend/`. The previous pass and this hardening pass are included in the release. The prior working tree was already modified. Duplicate source, broken tracked environments, caches and reports were preserved in sibling backup directories. No live database schema or production rows were changed; the user explicitly requested that database/RLS execution remain external verification.

## Verification matrix

| Check | Result |
| --- | --- |
| Backend compile | PASS |
| Backend pytest | 81 passed / 0 failed |
| Frontend Node tests | 7 passed / 0 failed |
| TypeScript | PASS |
| ESLint | PASS exit, 0 errors, 127 warnings (before: 144) |
| Next.js production build | PASS, 23 pages |
| HTTP liveness/docs | PASS, 200 |
| Database REST connectivity | PASS, 200 |
| Schema contract/readiness | FAIL, required V6/V7 columns/table missing; /ready 503 |
| Disposable database/schema/RLS in GitHub CI | PASS on the initial release workflow; live Supabase RLS remains NOT VERIFIED |
| SQL verification | PASS outer syntax; V3–V7 and catalog/RLS checks executed successfully in disposable CI PostgreSQL; live Supabase execution NOT VERIFIED |
| Public GitHub metadata/clone/parsing | PASS, pallets/itsdangerous, 30 files and 74 chunks |
| GitHub OAuth/private clone | NOT VERIFIED, no connected authenticated browser/token flow |
| Live Gemini embedding/generation | PASS, one valid 768-dimensional vector and nonempty text |
| Live Groq completion/stream | PASS, nonempty completed responses |
| Authenticated RAG vector storage/retrieval and full E2E | NOT VERIFIED, deployed schema incomplete |
| Partial indexing/retry | PASS local regression: 8/10, 80%, 2 failed; retry sends only missing chunks |
| Stale worker recovery | PASS local race/terminal-state regressions; live crash flow NOT VERIFIED |
| Backend dependency audit | PASS, no known advisories |
| Runtime npm audit | PASS, 0 advisories |
| Full npm audit | FAIL, 5 high development advisories, 0 critical |
| Bandit production source | PASS medium/high gate; 3 low subprocess findings |
| Candidate/index secret signatures | PASS, no real credentials detected; ignored env files excluded |
| Public responsive overflow | PASS at 1280, 1024, 768, 390; authenticated modules NOT VERIFIED |
| Public labels/dialog keyboard | PASS limited manual DOM check; complete accessibility NOT VERIFIED |
| Docker and production load | NOT VERIFIED, Docker unavailable and no production load environment |
| Production configuration | FAIL, explicit GEMINI_AI_MODEL and ALLOWED_ORIGINS absent in local configuration |

The readiness root cause initially included an SDK mismatch: base ClientOptions lacks the storage field required by installed supabase 2.32.0. SyncClientOptions fixes actual client construction. Schema checks now fail honestly on missing deployed migration fields, rather than presenting a table-only probe as full readiness.

## Targeted hardening

Stale recovery runs on owner-scoped status/retry access, preserves coverage and completed stages, compares the observed heartbeat before updating, and prevents an old worker reviving terminal jobs. Retries reuse successful chunks in partially indexed files. External graph nodes come only from observed source imports, excluding unresolved relative/local aliases. Health exposes its measured method; legacy/unmeasured global scores and failed statistics do not become zero. Chat warns about partial indexing. React updaters no longer perform polling side effects, callbacks have current dependencies, and slow summary responses cannot overwrite another selection. Public forms are labelled and the modal no longer falsely reports a saved waitlist submission.

Lint classification: 61 unused variables/imports (mostly harmless), 44 explicit-any typing debt (maintainability), 14 effect state synchronization warnings (initialization/reset transitions; further render review remains), 5 image optimization and 3 navigation API warnings. Hook dependency and declaration-order warnings were fixed. Existing warning severity overrides were not relaxed, and no lint checks were newly disabled. Node tests also retain the harmless package module-type warning.

## Development dependency advisories

All five entries share [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): stack exhaustion from deeply nested glob patterns.

| Package/version | Relationship | Compatible fixed version |
| --- | --- | --- |
| braces 3.0.3 | Transitive vulnerable implementation | None published; registry latest 3.0.3 |
| micromatch 4.0.8 | Transitive via braces | No compatible resolution removes braces advisory |
| fast-glob 3.3.1 | Transitive via micromatch | No compatible resolution removes braces advisory |
| @next/eslint-plugin-next 16.4.0 | Transitive development plugin | No compatible resolution currently identified |
| eslint-config-next 16.4.0 | Direct development dependency | npm proposes 14.2.35, incompatible with this Next 16 configuration |

Risk: crafted glob patterns can exhaust tooling stacks. These packages are outside production runtime dependencies; that does not erase the advisory. Mitigation: keep lint globs/configuration controlled, do not accept arbitrary user glob patterns, run CI in disposable runners without production secrets, and monitor upstream fixes. No force audit fix, undocumented override or incompatible downgrade was used.

## Remaining release gates

Apply the reviewed migration plan only after backup/maintenance approval and successful disposable/staging SQL execution. Verify two-user isolation, OAuth/private import, actual indexed RAG/citations, cancellation/crash recovery, deployed configuration, full accessibility and load. The API smoke remains unexecuted. The disposable database CI job successfully initialized pgvector, applied migrations and ran schema/RLS tests: [verified job](https://github.com/Lingu17/codeforage-ai/actions/runs/37783671865/job/113332830219). This is not live Supabase verification. The initial backend CI test failure exposed a dependency on local credentials; test setup now supplies placeholders before configuration loading. Inspect the latest workflow after the follow-up test commit. Security rules/import resolution remain explicitly limited; scan workers and contact rate limiting remain process-local. Legacy non-stream chat does not use the streamed claim mechanism. Paid plans and billing are not implemented.

Production readiness: **NOT READY**. GitHub synchronization publishes the verified local fixes and documented limitations; it does not certify deployment readiness.

## Local completion verification — 2026-10-10



Executed the real SQL in an isolated, in-memory PGlite 0.5.8 PostgreSQL 18.3

runtime with its pgvector extension. Temporary npm tooling was installed outside

the repository; application dependencies and production services were unchanged.

Passed auth bootstrap, base schema, V3–V8, V8 rerun, schema contract, missing/partial

table scenarios, legacy NULL-question status updates, question validation, removal

of permissive policies, NULL-safe claim conflicts, and the complete two-user RLS

isolation/RPC test. These are database execution results, not syntax-only checks.

The Docker PostgreSQL 17 CI job and live Supabase/PostgREST remain unverified.



Backend tests, frontend tests/typecheck/build, SQL/PLpgSQL parsing, release scan,

runtime dependency audits and diff whitespace checks passed. ESLint reported 127

existing warnings and zero errors. Bandit's configured medium/high gate passed.

The local Git remote now uses a credential-free URL. Exposed GitHub and Supabase

secret credentials require revocation/rotation by their owner; no keys were used

or saved and no production changes, commits or pushes were performed.



## Verification-gap review - 2026-10-10

Earlier entries record historical checks, not current production state or proof
of the current uncommitted workflow. Public GitHub API inspection of
`GET /repos/Lingu17/codeforage-ai/contents/.github/workflows/ci.yml` and
`GET /repos/Lingu17/codeforage-ai/actions/workflows/ci.yml/runs?per_page=3`
found published run [38030158325](https://github.com/Lingu17/codeforage-ai/actions/runs/38030158325)
successful at `2a39d951847f42c1e3cc2809f116b291f7c78e63`. Its database, backend
and frontend jobs report success. The published workflow has no V8 application
or partial-schema test and differs from the local workflow. No published run
verifies the uncommitted changes.

Local order: Docker init applies auth/base/V3-V7; workflow applies V8 twice,
schema contract, missing/partial-table fixture, schema contract again, then
RLS isolation with begin/busy/complete/replay chat RPCs. SQL uses ON_ERROR_STOP=1
and read-only mounts. Embedded verification follows the same SQL order using
PostgreSQL 18.3 rather than Docker's PostgreSQL 17; a JavaScript loader expands
psql includes. It does not verify Docker startup/mounts/psql, PostgREST or concurrency.

Commands/results this review:
- `Get-Content AUDIT.md; git status --short`: existing changes preserved.
- `Get-Command docker,gh -ErrorAction SilentlyContinue`: neither available.
- Credential-safe Python inspection of `git remote get-url --all [--push] origin`:
  fetch/push contain no embedded credentials; URLs were not printed.
- `python -m pytest backend/tests/test_regressions.py -q -k readiness`:
  6 passed, 68 deselected. Missing question/session_id/user_message_id each returns
  503 via the real /ready route with mocked queries; complete schema returns 200.
- Initial full backend run: 1 failure, 87 passed. A prior encoding rewrite corrupted
  the citation assertion; repaired it and mixed AUDIT encoding without changing RAG.
- `node "$env:TEMP\codeforge-db-verify\verify.mjs" "$PWD"`:
  fresh/partial migrations, reruns, schema/RPC/RLS checks all passed again.

Docker execution remains blocked by the missing executable. Next action: use a
Docker-enabled machine to run the database job's exact commands in
`.github/workflows/ci.yml`. Actual GitHub verification requires separately
human-authorized publication, then inspection of the run for that exact commit.
No commits, pushes, production connections, secret rotation or deployment occurred.

Final rerun: `python -m pytest backend/tests -q` passed all 88 tests after the
encoding repair. `git diff --check` passed. No frontend source or configuration
changed in this review; earlier frontend results were not rerun or represented
as new verification.

`python tools/check_release.py`: PASS, 111 files scanned, no findings.


## GitHub repository import fix - 2026-10-10

Started with a clean working tree. Architecture remains Supabase GitHub OAuth
(`repo` scope), not a GitHub App installation or shared personal access token.
Confirmed defects: dialog discarded backend error details; missing GitHub metadata
became the `Developer` query; retry reused the initial provider token; signed-in
users could not initiate reconnection; listing stopped at 100 rows; 403 rate limits
were indistinguishable from permissions; public URL analysis depended on cached
OAuth credentials. No incident-specific request/log was available, so the exact
cause of the displayed failure remains unverified.

Fixed current-session/identity resolution, sanitized actionable error messages,
explicit user-triggered OAuth reconnection, bounded pagination (up to 50 pages;
failure rather than silent truncation), rate-limit classification and Retry-After
CORS exposure. Public metadata/analysis uses anonymous access first; only a 404
can retry with the supplied user's provider credential. Private scans cannot queue
without successful authorized metadata access. Public scans do not pass a cached
provider credential to cloning. No fallback to shared or another user's credentials.

Verification:
- New backend regressions initially reproduced pagination/rate-header failures.
- `python -m pytest backend/tests -q`: 104 passed.
- `npm test --prefix frontend`: 17 passed.
- `npm run typecheck --prefix frontend`: passed.
- `npm run build` from frontend: passed, 23 pages.
- `npm run lint` from frontend: zero errors, 126 existing warnings.
- Backend compile and Bandit medium/high gate: passed (3 existing low findings).
- Read-only direct public listing code probe for Lingu17 with placeholder service
  configuration: passed, 14 public repositories; no Supabase service call occurred.
- Release signature scan and `git diff --check`: passed.

OAuth browser reconnection/private clone against a real authorized account remain
unverified. User action if access was revoked: select Reconnect GitHub and authorize
the configured OAuth app with `repo` scope; approve organization access/SSO when
required. Public listing works without a provider token if GitHub identity metadata
is present; public URL imports do not require GitHub authorization. CodeForge login
is still required for backend ownership and persistence. No credentials created,
requested automatically or revoked; no deployment, commit or push in this pass.


## Supabase secret-rotation preparation - 2026-10-10

Exposed key identified as a newer secret key from the earlier message's key type,
not a legacy service-role JWT. Publishable key is a separate public credential.
Dashboard sign-in completed by user; read-only masked inspection shows one secret
named default. No key was revealed/copied, generated, replaced or revoked.
Local configuration declares no privileged contact-client secret. Hosting/runtime
consumers remain unknown pending human confirmation. CI uses public placeholders.

Added modern secret-key signatures to release scanning, backend public-client
privilege rejection, contact-client key-type/missing-config checks, and a Next
configuration guard that blocks privileged values in all public environment fields.
These offline checks classify key types; they do not validate signatures or live
key acceptance. Normal authenticated clients retain public-key plus user JWT/RLS.

Verified 112 backend tests, 20 frontend tests, type checking, production build,
backend compile, signature scan and diff whitespace checks. Reachable-history scan
examined 4,332 text blobs; no Supabase secret/service-role JWT signatures found.
Other hits were vendored-library PEM markers without complete private key material
and a placeholder database URL example. Fresh public build scan has no findings.
Local env files remain ignored and unchanged; remotes contain no credentials.
No claims of completed rotation, production testing or successful revocation.
See SUPABASE_SECRET_ROTATION.md for destinations, cutover and precise blockers.
All pre-existing GitHub import changes preserved; no commits, pushes or deployment.

User subsequently confirmed local development only and no secret-key consumers.
No environment cutover/replacement is needed; unused-key revocation is the selected
safe action. Requested user dashboard deletion of the default secret, leaving
publishable and legacy keys unchanged. Revocation remains unverified pending
visible dashboard confirmation; the optional contact client remains unconfigured.

## Supabase unused-secret revocation verified - 2026-10-10

This supersedes the pending revocation status above. The user reported deleting
the unused default secret after confirming no external consumers. An independent
refresh of the official project API Keys dashboard showed no active secret keys;
a subsequent read-only check confirmed that status. The publishable key was
unchanged in a comparison without outputting its value. Legacy values were not
inspected. No replacement or environment cutover was needed. No live revoked-key
request, production data operation, commit, push or deployment was performed.
Local test results are separate from this dashboard evidence. See
SUPABASE_SECRET_ROTATION.md for the evidence and limits.

## Current working-tree release verification - 2026-10-10

Root is this checkout; canonical application directories are backend/ and frontend/.
Branch main at ab37bd6. All pre-existing staged/unstaged/untracked work preserved.
The user request ended at its workflow coverage list; this review covers the
previously identified migrations, schema contract, chat RPC and RLS isolation.

Commands and actual results:
- `git status --short`, `git branch --show-current`, `git log -3 --oneline`:
  inspected before changes. Only this audit record changed during this review.
- Credential-safe parsing of `git config --get-regexp remote.*.url`: one remote,
  no embedded URL credentials; values not printed.
- `python -m pytest backend/tests -q`: 112 passed, including missing chat-column
  readiness and missing privileged configuration regressions.
- `python tools/check_release.py`: 119 files scanned, no findings.
- `python -m compileall -q backend`: passed.
- `python -m bandit -r backend -x backend/tests -ll`: failed because it traversed
  ignored local backend/.venv dependency code. Corrected scope:
  `python -m bandit -r backend -x backend/tests,backend/.venv,backend/venv -ll`:
  passed, zero medium/high findings; three low findings.
- From frontend: `npm test`: 20 passed; `npm run typecheck`: passed;
  `npm run build`: passed, 23 pages; `npm run lint`: zero errors, 126 warnings.
  Supplemental direct ESLint run on src and next.config.ts also passed.
- `python -m pip_audit -r backend/requirements.txt`: no known vulnerabilities.
- From frontend: `npm audit --omit=dev`: zero vulnerabilities.
- Existing release scanner applied to frontend/.next/static: 48 files, no findings.
- `node "$env:TEMP\codeforge-db-verify\verify.mjs" "$PWD"`: passed bootstrap,
  base/V3-V8, V8 replay, schema contract, absent/partial-table fixture, repeated
  contract, chat RPC and cross-user RLS checks in embedded PostgreSQL 18.3.
- `git diff --check`: passed; only LF/CRLF conversion notices.

Workflow inspection: compose initializes bootstrap/base/V3-V7 on disposable
PostgreSQL 17 with pgvector; CI runs V8 twice, schema_contract.sql,
tests/migration_v8.sql (which rebuilds/repairs chat tables and replays migrations),
schema_contract.sql again, then rls_isolation.sql. Every psql command has
ON_ERROR_STOP=1. The isolation script exercises begin/busy/complete/replay RPCs.
Embedded execution uses the same order but a different PostgreSQL version and
expands psql includes in JavaScript; it cannot prove Docker mounts/startup or
PostgREST behavior. No workflow change was needed based on this inspection.

Remaining gates: Docker is absent (`Get-Command docker` returns no executable).
Use a Docker-enabled machine and run the database job's exact commands from
.github/workflows/ci.yml. Latest uncommitted changes have no proven GitHub CI run;
publication requires separate authorization. Real GitHub OAuth reconnection and
authorized private import require user interaction with Reconnect GitHub and repo
scope/organization approval. Live Supabase schema/RLS checks remain unperformed;
use an explicitly authorized staging project and two test-user identities.
No production connection, credential change, migration, commit, push or deployment
occurred. Prior revocation dashboard evidence remains distinct from local tests;
legacy key values were never independently compared.

## Remaining release gates reviewed - 2026-10-10

Read this audit and `git status --short` first; preserved all existing changes.
No application tests rerun. Only this documentation changed in this review.

| Gate | Status | Evidence / limitation |
| --- | --- | --- |
| Published workflow and Docker database job at ab37bd6 | VERIFIED | GitHub public REST API reports run 38032183066 completed successfully; backend, frontend and database jobs each succeeded. |
| Published database coverage | VERIFIED | Published main workflow matches local; compose, V8, migration fixture, schema contract and isolation fixture at the run SHA each match local files. Includes V8 replay, absent/partial schema, begin/busy/complete/replay RPCs and two-user RLS. |
| Local Docker execution | BLOCKED | No docker command or standard Docker Desktop executable; `wsl --list --quiet` reports WSL not installed. No other authorized Docker endpoint identified; SSH executable alone provides none. No install/start attempted. |
| CI for current uncommitted changes | BLOCKED | Requires human-authorized publication of the exact updated commit. Earlier successful run does not cover these changes. |
| Real GitHub OAuth/private import | NOT VERIFIED | Requires authorized account interaction below. |
| Live staging schema/readiness/RLS | NOT VERIFIED | No staging project or test identities supplied; no production connection or migration performed. |
| FAILED gates in this review | None observed | Do not infer current-tree or production success from the committed run. |

Verified run: https://github.com/Lingu17/codeforage-ai/actions/runs/38032183066
Exact SHA: ab37bd6ce3d7cb236ae2b4f3597118de4bb82947.
Read-only evidence obtained with urllib GETs to GitHub API contents endpoints,
actions/workflows/ci.yml/runs?per_page=3 and actions/runs/38032183066/jobs.
This supersedes earlier statements that Docker CI for the committed SQL was unknown.

### Owner: maintainer - exact updated-commit CI

Review and authorize publication of the intended changes; no commit/push was done
by this review. After authorized publication, open GitHub Actions -> Verify ->
the run for that exact SHA. Require database/backend/frontend success and record
its SHA, link and job conclusions. Workflow triggers on push/pull_request, not
workflow_dispatch; rerunning ab37bd6 cannot verify new uncommitted code.

GitHub's ubuntu-latest runner already provides a demonstrated Docker environment.
Alternative runner requires Docker Engine plus Compose v2 supporting `--wait`,
registry access to pgvector/pgvector:pg17, repository bind mounts and free local
port 55432. From checkout root, use the database job's exact commands:

```sh
docker compose -f compose.db-test.yml up -d --wait
docker compose -f compose.db-test.yml exec -T db-test psql -U postgres -d codeforge_test -v ON_ERROR_STOP=1 -f /backend/migration_v8.sql
docker compose -f compose.db-test.yml exec -T db-test psql -U postgres -d codeforge_test -v ON_ERROR_STOP=1 -f /backend/migration_v8.sql
docker compose -f compose.db-test.yml exec -T db-test psql -U postgres -d codeforge_test -v ON_ERROR_STOP=1 -f /tests/schema_contract.sql
docker compose -f compose.db-test.yml exec -T db-test psql -U postgres -d codeforge_test -v ON_ERROR_STOP=1 -f /tests/migration_v8.sql
docker compose -f compose.db-test.yml exec -T db-test psql -U postgres -d codeforge_test -v ON_ERROR_STOP=1 -f /tests/schema_contract.sql
docker compose -f compose.db-test.yml exec -T db-test psql -U postgres -d codeforge_test -v ON_ERROR_STOP=1 -f /tests/rls_isolation.sql
docker compose -f compose.db-test.yml logs --no-color
docker compose -f compose.db-test.yml down
```

Always collect logs and run down even if a SQL check fails. These fixtures are
for the disposable database only, never a live Supabase project.

### Owner: authorized GitHub account holder / QA - OAuth and private import

- Run the current application against an approved test environment; sign into
  CodeForge, open Import Repository and select Reconnect GitHub.
- Confirm correct GitHub account and configured OAuth application; approve `repo`
  scope only for this authorized test. Obtain organization/SSO approval if needed.
  Do not create or paste a PAT. Return through callback with a valid session.
- Reopen the dialog: verify owned/private repository listing, later pages if the
  account has over 100 repositories, and a small private fixture you may import.
- Import that fixture; verify scan completion and persisted results as its owner.
  A separate CodeForge user must not see or access those persisted results.
- Test a private URL without GitHub authorization in a separate test session:
  expect an actionable denied response and no queued scan. Test a public URL
  with no provider token: analysis must remain available to a signed-in user.
- Record sanitized status codes/outcomes. Do not export headers, session cookies,
  provider tokens or private source. Simulate revoked/rate-limit failures with
  existing mocked tests rather than revoking credentials or exhausting live quotas.

### Owner: staging administrator / QA - Supabase verification

- Select an explicitly authorized, disposable staging project and two existing
  test users A/B. Confirm staging project reference before connecting. Configure
  isolated local backend/frontend public URL/key settings securely; user JWTs
  remain session-specific. No replacement privileged key is needed.
- Read-only schema: using an existing approved staging database connection via
  a locally configured PostgreSQL service (credentials never on command line),
  run `psql "service=codeforge_staging" -v ON_ERROR_STOP=1 -f backend/tests/schema_contract.sql`.
  This file contains catalog assertions inside a rolled-back transaction, no
  migration. Do not run migration_v8.sql or rls_isolation.sql against staging.
- From backend with staging-only settings, run `python schema_check.py`; require
  PASS. With staging backend running, `curl --fail http://127.0.0.1:8000/ready`
  must return 200. Readiness alone does not prove RLS or RPC behavior.
- With A, import a disposable public fixture and exercise chat; require persisted
  messages and request replay without a second assistant reply.
- With B's own session/public client, try known A repository/session IDs through
  API and direct Supabase data/RPC access. Require no A rows, no cross-user writes,
  and no access via vector/lexical/chat RPCs. Verify A's fixture remains intact.
  Never use service-role/admin credentials for this RLS test.
- Compare an unauthenticated session as well: no private fixture reads/writes.
  Capture sanitized response statuses/counts only. Any missing schema or isolation
  failure blocks release; report it for separately authorized remediation.
- Fixture writes/cleanup require the staging owner's authorization; until supplied,
  this is a checklist only. No production data or migrations are authorized.

Production readiness remains NOT VERIFIED until exact updated-commit CI and
authorized live OAuth/private-import/staging gates have evidence.

## GitHub loading follow-up audit and repair - 2026-10-10

Preserved the existing dirty main checkout. Inventoried tracked application,
SQL, CI, deployment, configuration and test files; read frontend AGENTS/CLAUDE
and installed Next route-handler guidance before editing. The user's prompt was
truncated after "archived repositories, and Git"; evaluated the supplied scope.

Flow: /auth/github -> Supabase signInWithOAuth -> GitHub -> Supabase Auth
callback -> /auth/callback exchangeCodeForSession -> SSR session cookies ->
fresh dashboard getSession -> Authorization (CodeForge JWT) plus optional
X-GitHub-Token -> authenticated backend /api/repos/github -> GitHub /user/repos
or anonymous /users/{identity}/repos. Listing does not query repository tables;
Supabase is used to validate the CodeForge session. Imports subsequently use
the owner-scoped database client/RLS. OAuth uses Supabase PKCE rather than an
application-written token exchange/state validator. No shared PAT or GitHub App
installation architecture was found. GitHub client ID/secret belong in Supabase
Authentication -> Sign In / Providers -> GitHub, not frontend or backend env.
GitHub OAuth App callback is https://<project-ref>.supabase.co/auth/v1/callback;
Supabase redirect allowlist must include the actual frontend /auth/callback URL.
Those external settings have not been inspected or changed in this review.

Verified additional defects and repairs:
- Initial login unconditionally requested repo scope. It now requests only the
  provider default scope; explicit reconnect=1 requests repo for private access.
  This does not revoke scopes on an existing authorization.
- Successful malformed list elements/invalid JSON could reach rendering or be
  mislabeled as connectivity failure. A regression reproduced the missing
  rejection; the loader now validates ID/name/full_name/private and reports a
  sanitized invalid-list error. Empty accounts remain valid; archived rows remain
  present (covered by the normal successful-list regression fixture).
- Upstream GitHub 422 was mapped to 502; it now remains an actionable sanitized
  422. Frontend no longer claims an unavailable username/reconnection is the
  cause of every 422. Added backend 404/422 classification cases.

Current incident root cause: NOT VERIFIED. Anonymous localhost probes failed
to connect at ports 3000 and 8000; no corresponding listeners were found. No
authenticated request/status/log was available. The user requested no further
questions; no credentials/account changes or production probes were attempted.
Provider tokens are read from the current user's session, never persisted in a
new shared store; absence after refresh leads to public-only mode/reconnection.
The existing Supabase SDK documents provider tokens as initial-login values;
CodeForge session refresh alone is not proof of fresh GitHub authorization.

Actual verification after final changes:
- `python -m pytest backend/tests -q`: 114 passed.
- From frontend: `npm test`: 22 passed; `npm run typecheck`: passed;
  `npm run build`: passed, 23 pages.
- Direct ESLint of changed auth route/githubImport helper: zero errors/warnings
  after final changes.
- `python -m bandit -r backend -x backend/tests,backend/.venv,backend/venv -ll`:
  zero medium/high findings, three low findings.
- `python tools/check_release.py`: 119 files, no findings.
- Public build scan after final changes: 48 files, no findings.
- Anonymous live GitHub probe through the actual backend listing function for
  Lingu17: 14 repositories, all public, rendering fields valid. Placeholder
  service configuration and a get_supabase_client mock that forbids database
  access were used; no Supabase request or provider token was used.
- `git diff --check`: passed. Existing SQL was not changed; prior embedded and
  committed Docker CI evidence remains historical, not current full-tree CI.
- `npm audit --json`: FAILED full development gate, five high findings, zero
  critical. Chain eslint-config-next -> @next/eslint-plugin-next -> fast-glob ->
  micromatch -> braces@3.0.3. npm suggests an incompatible eslint-config-next
  14.2.35 downgrade. Registry latest braces is 3.0.3; advisory lists no patched
  version. No dependency downgrade, audit suppression or security bypass applied.

Sources: https://supabase.com/docs/guides/auth/social-login/auth-github;
https://docs.github.com/en/rest/repos/repos;
https://github.com/advisories/GHSA-vfj7-8cjw-p6xm.
BLOCKED: authenticated incident reproduction, live OAuth/private import and
staging RLS without an authorized running environment; exact-current-commit CI
without publication authorization. Development dependency advisory remains
unresolved pending a compatible upstream fix/reviewed mitigation. No commit,
push, deployment, secret change or production operation occurred.

## Actual local startup check - 2026-10-10

Started backend with `python -m uvicorn main:app --host 127.0.0.1 --port 8000`
from backend and frontend with `npm run dev -- --hostname 127.0.0.1` from frontend.
Both remain running in tool sessions. No application code or environment changed.

VERIFIED: backend startup completes; /health returns 200. Frontend / and /about
return 200. An unauthenticated /dashboard request redirects to sign-in; protected
/api/repos/github returns 401. CORS preflight for localhost:3000 and
127.0.0.1:3000 returns 200 with the matching allowed origin. The initial frontend
probe timed out during startup/compilation; subsequent requests succeeded.

FAILED: /ready returns 503 with the sanitized missing-schema message.
`python schema_check.py` from backend exits 1: repositories, repository_scans,
code_chunks, chat_messages and security_reports return missing-column code 42703;
chat_requests returns PGRST205. These were read-only probes of configured Supabase.
No row contents or credential values were printed. Authenticated import/chat is
NOT VERIFIED and cannot be called fully operational with this readiness failure.

BLOCKED remediation: externally hosted database migration requires explicit
project/environment confirmation and migration authorization, an administrator
connection and reviewed backup/preflight. General local access does not identify
or authorize modification of that database. Follow DATABASE_RELEASE_PLAN.md,
review historical migrations/catalog, apply only required approved V6/V7/V8
repairs, then rerun schema_check.py and /ready plus staging two-user tests.
Never run the destructive partial-table CI fixture against live Supabase.

## Authorized live repair and sign-in verification - 2026-10-10

The user explicitly authorized Supabase changes to make the project run. This
supersedes the prior lack of migration authorization. No local administrator
variables, psql or Supabase CLI were available; used the existing signed-in
official dashboard SQL editor for project wgnkoizbmmqlkjriwfwx.

Preflight aggregate counts: 5 repositories, 417 chunks, 12 scans, 25 messages.
Duplicate repository keys, duplicate chunk keys, duplicate active scan groups and
cross-repository file references each counted zero; pgvector 0.8.0 present.
One read-only query initially failed because Monaco fill appended to existing
content. Corrected by explicitly selecting/deleting the entire editor before
filling; no migration was attempted with that failed query.

Committed one transaction containing: restricted recovery schema
codeforge_recovery_20261010_01 with copies of existing affected public tables and
old column/policy/index/function metadata; V3/V4/V6/V7/V8 from local reviewed
files with inner transaction boundaries removed; schema_contract.sql assertions;
aggregate before/after row-count preservation assertions. Locks prevent concurrent
changes during repair, lock timeout 5 seconds and statement timeout 120 seconds.
V5 stages addition is included in V6. No base schema replay or destructive CI
fixture executed. Dashboard explicitly reported schema repair committed, schema
contract passed and original row counts preserved. Recovery tables have RLS;
schema/table privileges revoked from PUBLIC/anon/authenticated/service_role.
Read-only postcheck confirms anon/authenticated cannot use recovery schema.
This is an in-project recovery snapshot, NOT an independent disaster-recovery
backup or a tested full restore. It was retained, not deleted.

Live `python schema_check.py` from backend: PASS, no failures.
Backend /health and /ready: HTTP 200. These supersede prior missing-schema failures.

Real OAuth reproduction initially returned an authorization code to the homepage
rather than completing the local callback. Actual Supabase redirect allowlist
contained only the Vercel site and Vercel /auth/callback. Prepared exact localhost
and 127.0.0.1 /auth/callback entries; browser policy required action-time approval
for adding authentication destinations. User explicitly approved both entries.
Saved and verified four URLs; Vercel site URL and both existing URLs unchanged.
No wildcard, provider secret, credential rotation or additional repo scope added.

Using a consistent http://localhost:3000 origin, completed GitHub Continue as
Lingu17, returned through callback to /dashboard, displayed actual identity and
owner repositories. Import Repository dialog now displays 14 repository entries,
without the previous loading failure. Thus live sign-in and authenticated listing
are VERIFIED. Screenshots are stored outside the checkout at:
C:/Users/HP/.codex/visualizations/2026/10/10/codeforge-live-verification/.
Frontend/backend remain running. No commit, push or deployment performed.

Limits: new private import, complete new scan/AI chat, distinct-user live RLS and
all authenticated modules have not been verified by this browser pass. Existing
historical scans show partial/indexing states; no completed new indexing claimed.
Exact updated-commit CI and the development dependency advisory remain open.

## Current release and UI verification - 2026-10-10

The user now explicitly requests committing and pushing the completed repairs to
GitHub. All prior changes were preserved. Features and project architecture were
retained; no new credential, production deployment, or additional migration was
performed during this verification pass.

VERIFIED repairs:
- Legacy default 80/100 reports without measurement evidence are presented as
  unmeasured; stored reports remain unchanged. Measured zero remains valid.
- Coverage uses persisted embedding counters, including legacy current_step JSON.
  Missing evidence is NOT VERIFIED rather than incorrectly INDEXING/COMPLETE.
- Unknown overall risk uses a neutral "Not measured" display. Source-file counts
  describe discovered metadata, separately from indexed chunks and files.
- Repeated external imports caused duplicate graph IDs and React console errors
  in an actual fresh scan. Graph generation now deduplicates edges and dependents;
  the architecture API deduplicates historical edges without rewriting records.
- Import uses inline sanitized errors, prevents repeated URL submissions, focuses
  the dialog, traps Tab, closes with Escape, and restores focus. Repository
  selection/actions have keyboard controls and accessible names. Sidebar identity,
  labels, timestamps, and route scroll metadata reflect actual behavior. Initial
  repository loading waits for the fetch before showing an empty-account state.

VERIFIED live user workflow using http://localhost:3000:
- Public URL import of pallets/itsdangerous completed cloning, parsing, graph,
  security, health, and embedding stages. 30 files discovered; 29 files had indexed
  chunks; 74/74 chunks indexed, zero failed chunks, 100% chunk coverage. The new
  repository and verification records were retained in the user's account.
- Source health 100/100 reflects the limited source-rule methodology, NOT complete
  security, test coverage, runtime performance, or measured overall risk.
- Chat streamed an answer, persisted across reload, and exposed source citations.
  Opening a citation navigated to the pinned GitHub commit and actual file line.
- Built-in example PR review completed and displayed its summary/recommendation.
- Architecture, health, and security reports rendered. A fresh production-build
  architecture tab had no captured warning/error logs after duplicate-edge repair.
- At 390x844, dashboard and import dialog had no horizontal page overflow; import
  input focus, Escape dismissal and restored trigger focus were checked.

Commands/results for this working tree:
- `python -m pytest backend/tests -q`: 119 passed (1.71 seconds).
- From frontend: `npm test`: 22 passed; `npm run typecheck`: exit 0.
- From frontend: `npm run build`: production compilation/typechecking and all 23
  generated pages passed, including the final presentation/loading edits.
- Bare `npm run lint` stalled locally and its identified ESLint child was stopped.
  Switched to explicit equivalent project paths:
  `node node_modules/eslint/bin/eslint.js src tests next.config.ts eslint.config.mjs postcss.config.mjs --format json --output-file <temporary report>`:
  53 files, zero errors, 126 configured warnings. No lint controls disabled.
  Node test-runner module-type warnings remain; they do not indicate failed tests.
- `python -m bandit -r backend -x backend/tests,backend/.venv -ll`: zero medium/high,
  three low findings. Ignored local dependency environment excluded.
- `python -m pip_audit -r backend/requirements.txt`: no known vulnerabilities.
- `npm audit --omit=dev --fetch-timeout=20000 --fetch-retries=0`: zero findings.
- Full npm audit: FAILED, five high development dependency findings, zero critical
  (@next/eslint-plugin-next, eslint-config-next, fast-glob, micromatch, braces).
  No forced incompatible downgrade or security-control suppression performed.
- `python schema_check.py` from backend: PASS, empty failures. Read-only HTTP
  probes of backend /health and /ready and frontend root returned 200. About,
  features, pricing, contact, privacy, terms, blog, changelog, roadmap, billing,
  and settings routes returned 200; this does not prove their external integrations.
- Credential-safe remote inspection: origin has no embedded username/password or
  query credential. Public production JavaScript signature scan: 35 files, no
  findings. Candidate/staged secret scan and whitespace check run before commit.

BLOCKED / NOT VERIFIED release gates:
- Local Docker/WSL unavailable; actual published GitHub database CI at ab37bd6
  already passed, but that does not verify this updated commit. Its exact push CI
  must be checked after publication. Workflow includes V8 replay, missing/partial
  schemas, schema contracts, chat RPCs, and two-user RLS isolation.
- Five high development dependency audit findings and 126 lint warnings remain.
- Private repository reconnect/import and distinct-user LIVE RLS are NOT VERIFIED;
  automated isolation tests do not substitute for two authorized live accounts.
- Optional contact submission has no privileged backend consumer configured;
  payments/team/API-token functionality remains as currently implemented or roadmap.
- No deployed website verification or deployment action is claimed. Passing local
  checks cannot establish universal absence of glitches or production readiness.

## Authorized publication and exact-commit CI result - 2026-10-10

VERIFIED: committed the preserved work as
ddc6378940a83e30b06c30f1d61f42636104b6e4 and pushed origin/main with no force push.
Working tree was clean. Actual GitHub Actions run 38039631806 for that exact SHA
completed with success in database, backend, and frontend jobs:
https://github.com/Lingu17/codeforage-ai/actions/runs/38039631806
This closes the updated CODE commit's Docker CI gap; the workflow runs its
migration replay, partial-schema, schema-contract, chat RPC and two-user isolation
checks on the GitHub runner. The earlier pending-publication status is superseded.

GitHub deployment metadata also reports the existing Vercel integration's
Production deployment of the same SHA succeeded. This was automatically triggered
by the authorized push; no separate deployment command, credential or setting
change was performed. Its deployment URL opens Vercel sign-in in the available
browser, so deployed application behavior is BLOCKED by absent authorized Vercel
access and NOT independently verified. Deployment success is not proof that a
hosted backend is configured or that production OAuth/import/chat work.

The local production frontend and backend remain running on ports 3000 and 8000.
The documentation-only follow-up recording these results is published separately;
its own CI status must be checked after its push. Remaining development audit,
lint-warning, private-import and live distinct-user isolation limits above remain.

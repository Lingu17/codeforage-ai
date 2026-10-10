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

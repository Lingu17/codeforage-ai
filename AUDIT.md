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
| Live migrations and two-user RLS | NOT VERIFIED, no staging database/admin connection; live writes prohibited |
| SQL outer syntax | PASS, V2–V7/base/test scripts parsed; catalog and PLpgSQL execution NOT VERIFIED |
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

Apply the reviewed migration plan only after backup/maintenance approval and successful disposable/staging SQL execution. Verify two-user isolation, OAuth/private import, actual indexed RAG/citations, cancellation/crash recovery, deployed configuration, full accessibility and load. The API smoke and CI database workflow were added but cannot count as live PASS until run in their required environments. Security rules/import resolution remain explicitly limited; scan workers and contact rate limiting remain process-local. Legacy non-stream chat does not use the streamed claim mechanism. Paid plans and billing are not implemented.

Production readiness: **NOT READY**. GitHub synchronization publishes the verified local fixes and documented limitations; it does not certify deployment readiness.

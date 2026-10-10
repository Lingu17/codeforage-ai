# Supabase secret rotation - status and cutover

Project: `wgnkoizbmmqlkjriwfwx` (CodeForge AI).
Settings: https://supabase.com/dashboard/project/wgnkoizbmmqlkjriwfwx/settings/api-keys
Official procedure: https://supabase.com/docs/guides/getting-started/api-keys#rotate-a-leaked-or-compromised-key

The exposed credential is a newer secret key, established from its `sb_secret_`
type in the earlier user message. The accompanying publishable key is public.
Do not rotate JWT signing keys, legacy keys, the publishable key or other providers.
The initial signed-in dashboard showed one masked secret named `default`.
After user deletion and a page refresh, it shows no active secret keys.
No secret was revealed/copied, created, replaced or revoked by the agent.

## Checklist

- [x] Preserve existing GitHub import changes and inspect credential references.
- [x] Establish credential type without recording its value.
- [x] Inspect local consumers, Git ignores, remotes, reachable history and bundles.
- [x] Add modern secret scanning and reject privileged keys in public configuration.
- [x] Verify local tests, type checking and production build.
- [x] User confirmed local development only and no secret-key consumers.
- [x] User deleted the unused `default` secret; no replacement or cutover needed.
- [x] Independently verify the refreshed dashboard has no active secret keys.

## Consumers and destinations

| Component | Configuration | Action |
| --- | --- | --- |
| Local privileged contact client (`backend/database.py`) | `backend/.env`: `SUPABASE_SERVICE_ROLE_KEY` | Not configured locally. Do not enable it just to rotate an unused credential. If contact is intended, the existing variable accepts a new secret or legacy service-role JWT. |
| Hosted backend contact client | Hosting provider's runtime secret store: `SUPABASE_SERVICE_ROLE_KEY` | User confirmed no hosted consumers. No runtime update or restart is required for this revocation. |
| Ordinary backend queries/Auth | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, user JWT | No rotation: remains public-key plus user-token access with RLS. |
| Frontend | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No secret key belongs here. Keep the existing public key. |
| GitHub Actions | Test placeholders and disposable database password | No Supabase privileged key reference found in the workflow. External repository/environment secret inventory is not verified. |
| Other functions/workers/services | User confirmed none | No replacement destination is required. |

The local `.env` files are ignored and were not modified. Only variable names
were reported. Privileged access exists solely in the contact client; ordinary
repository/scan/chat clients must not receive a privileged key.

## Human dashboard cutover

Credential changes require user handoff under the browser's confirmation policy.
Never paste a key into chat, an agent prompt, a command, a log or tracked source.

1. Confirm `default` is the exposed secret and inventory any consumers outside
   this checkout. Inspect API key usage in the dashboard if available.
2. If unused: revoke the exposed `default` secret; do not create a replacement
   until a backend component actually needs one. Leave publishable/legacy keys alone.
3. If used: create a replacement secret named for its consumer (for example,
   `codeforge-contact-2026-10-10`). Store it directly in that backend's secret store
   under `SUPABASE_SERVICE_ROLE_KEY`. Keep any overlap short: the old key is compromised.
4. Reload/restart every consumer and verify authenticated Supabase access with
   the replacement. Local mocked SDK tests are not proof that a key is accepted.
   A real contact POST writes a row: perform it only as an explicitly authorized
   staging test or separately approved production test. `/ready` uses the public
   client and cannot verify the contact secret.
5. After all consumers are cut over, delete only the compromised `default` secret.
   Deletion cannot be undone. Verify the old row is absent, the replacement remains
   (if required), and consumers still authenticate. Do not test the old key by
   placing its value in a command or URL.

## Evidence and limits

Reachable Git history: 4,332 text blobs scanned. No Supabase secret/service-role
JWT signatures found. Eight other signature hits were historical vendored library
PEM markers without complete key material and a placeholder database URL example.
This is a signature scan, not proof that no credential exists in any form.
Fetch/push remotes are credential-free. Current public build signature scan is clean.
The build now blocks modern secret keys and legacy service-role JWTs in all
`NEXT_PUBLIC_` fields. Backend public clients reject privileged Supabase key types.
The contact client rejects missing configuration and public keys.

No deployment, commit, push, production credential request or production data
operation was performed by the agent. The user performed the dashboard deletion.
No live key acceptance/rejection request was made; local tests do not prove revocation.


Consumer confirmation received: local development only, no secret-key consumers.
Selected action: revoke the unused exposed `default` secret without creating a
replacement or enabling the optional contact client.

## Revocation verified - 2026-10-10

User-confirmed evidence: the user reported completing deletion ("yes done check it")
after confirming local development only and no external secret-key consumers.

Independent dashboard evidence: after refreshing the official project API Keys page,
the Secret keys section reported "No secret API keys found" and "there are no active
secret keys created." A subsequent read-only check confirmed that status. The
publishable key remained unchanged in a comparison that did not output its value.
Legacy key values were not inspected, so their unchanged values are not independently
verified. No unrelated key action was performed by the agent.

No known configured consumer was found; the optional contact client remains
unconfigured. No replacement, environment update or consumer authentication test
was needed. External-consumer absence rests on the user's confirmation, not local
inspection alone. No remaining blocker for this unused-secret revocation.

# CodeForge frontend

See the root README for configuration, database prerequisites and limitations. From this directory run `npm ci`, then `npm run dev`. Validate with `npm run test`, `npm run typecheck`, `npm run lint` and `npm run build`.

Browser configuration uses only the public Supabase URL/anon key and API URL. Never expose provider or service-role keys through `NEXT_PUBLIC_` variables.

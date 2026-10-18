# Deploying CodeForge AI

The frontend runs on Vercel at **https://codeforage-ai.vercel.app**. Repository scans, chat, and PR review need the FastAPI backend to be hosted too. Until the backend is reachable, the dashboard lists GitHub repositories but cannot start scans.

## 1. Deploy the backend to Render (free tier)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Lingu17/codeforage-ai)

The button reads [`render.yaml`](render.yaml) and builds [`backend/Dockerfile`](backend/Dockerfile). `APP_ENV`, `ALLOWED_ORIGINS`, and `SUPABASE_URL` are prefilled. Render asks privately for:

| Variable | Value |
| :--- | :--- |
| `SUPABASE_ANON_KEY` | The same public anon/publishable key the frontend uses (never the service-role key) |
| `GEMINI_API_KEY` | Google AI Studio key |
| `GROQ_API_KEY` | Groq console key |
| `GEMINI_AI_MODEL` | A Gemini generation model your key can use |
| `GROQ_MODEL` | A Groq chat model your key can use |

When the deploy finishes, open `https://<your-service>.onrender.com/health`. It should return `{"status":"ok", ...}`, and `/ready` should return `{"status":"ready"}`.

## 2. Point the frontend at the backend

In Vercel, open **Project → Settings → Environment Variables** and set:

```text
NEXT_PUBLIC_API_URL=https://<your-service>.onrender.com
```

Redeploy the frontend, because `NEXT_PUBLIC_*` values are inlined at build time.

## Notes

- Free Render services sleep after about 15 minutes idle and take up to a minute to wake. The dashboard pings `/health` as soon as it opens and waits for the server, so most of that delay is hidden.
- If the site's address changes (custom domain, another Vercel project), add it to `ALLOWED_ORIGINS` on Render as a comma-separated https origin. Otherwise the browser blocks requests, and the console reports that the backend "rejects" the origin.
- The scan worker runs in-process. A free instance restarting mid-scan marks the scan as interrupted; use **Retry** in the dashboard.

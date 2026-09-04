<img width="1919" height="972" alt="image" src="https://github.com/user-attachments/assets/6c806663-14f3-4cd3-ac20-a0e991236dc8" /># 🚀 CodeForge AI



<p align="center">
  <strong>AI-Powered Software Engineering Copilot for Repository Analysis, Architecture Visualization, Security Audits, and Intelligent Codebase Chat.</strong>
</p>

<p align="center">
  <a href="https://codeforage-ai.vercel.app/">🌐 Live Demo</a> •
  <a href="https://github.com/Lingu17">GitHub</a> •
  <a href="https://linkedin.com/in/lingraj-malipatil">LinkedIn</a>
</p>

<p align="center">

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![FastAPI](https://img.shields.io/badge/FastAPI-Latest-green)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--5-purple)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![License](https://img.shields.io/badge/License-MIT-blue)

</p>

---

# ✨ Overview

CodeForge AI is an intelligent software engineering platform that helps developers understand, analyze, secure, and improve repositories using AI.

Simply connect a GitHub repository and CodeForge AI automatically:

✅ Analyzes repository structure

✅ Generates architecture maps

✅ Creates semantic code embeddings

✅ Enables AI-powered repository chat

✅ Detects vulnerabilities

✅ Scores project health

✅ Reviews pull requests

✅ Surfaces technical debt and risks

Built for:

* Developers
* Engineering Teams
* CTOs
* Startups
* Open Source Maintainers

---

# 📸 Product Preview

## Landing Page

<img width="1918" height="971" alt="image" src="https://github.com/user-attachments/assets/51262b2a-81b2-4aa2-b874-f87dd5effb1a" />


---

## Dashboard

<img width="1918" height="969" alt="image" src="https://github.com/user-attachments/assets/cc9b6b6d-bd26-4f11-aef0-65d04536963d" />


---

## Repository Analysis

<img width="1912" height="962" alt="image" src="https://github.com/user-attachments/assets/919191f9-9fc7-4b72-b3c9-779d89e47e32" />


---

## Architecture Visualization

<img width="1919" height="976" alt="image" src="https://github.com/user-attachments/assets/3847f12e-5d8f-4d89-a93e-b245e467ff41" />


---

## Security Audit

<img width="1919" height="977" alt="image" src="https://github.com/user-attachments/assets/26bf8288-2625-40c8-98ad-1b12c8beb8e1" />


---

## AI Codebase Chat

<img width="1913" height="971" alt="image" src="https://github.com/user-attachments/assets/dc3e4b78-28f5-440a-857a-c0a7ffc88d1b" />






---

# 🏗 System Architecture

```text
GitHub Repository
        │
        ▼
 Repository Ingestion
        │
        ▼
 Code Parsing & Chunking
        │
        ▼
 Embedding Generation
        │
        ▼
 Vector Database
        │
        ▼
 AI Analysis Engine
 ┌──────┼────────────┬─────────────┐
 ▼      ▼            ▼             ▼
Chat Security Health Architecture
Engine Audit Score Visualization
```

---

# 🔥 Features

## Repository Analysis

* GitHub OAuth Integration
* Public Repository Scanning
* Private Repository Scanning
* Repository Cloning
* Dependency Detection
* Source Code Indexing

---

## Architecture Visualization

* Interactive Graphs
* Dependency Mapping
* Service Relationships
* Module Connections
* Architecture Risk Detection

---

## AI Codebase Chat

Ask:

* How does authentication work?
* Explain application architecture.
* Where is payment processing implemented?
* Find security issues.
* Explain API flow.

---

## Security Audits

* Vulnerability Detection
* Secret Scanning
* Dependency Risks
* Security Recommendations
* OWASP Checks

---

## Repository Health Score

Calculated using:

* Documentation Quality
* Security Posture
* Dependency Health
* Maintainability
* Architecture Quality

---

## AI Pull Request Reviews

* Code Quality Suggestions
* Refactoring Advice
* Security Warnings
* Best Practice Recommendations

---

# 🛠 Tech Stack

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* Framer Motion
* ShadCN UI

## Backend

* FastAPI
* Python
* AsyncIO
* GitPython

## AI Layer

* Groq (OpenAI-compatible) for codebase chat answers — server-side
* Gemini Embeddings for RAG vector search (Groq does not expose an embedding endpoint)
* Streaming responses for instant first-token feel

## Database

* Supabase
* PostgreSQL
* pgvector

## Infrastructure

* Vercel
* Render
* GitHub OAuth

---

# 📂 Project Structure

```text
codeforge-ai/

frontend/
├── app/
├── components/
├── hooks/
├── lib/
└── types/

backend/
├── api/
├── services/
├── embeddings/
├── repositories/
├── scanners/
├── security/
└── workers/

database/
├── migrations/
└── schema.sql

docs/
assets/
```

---

# ⚙ Environment Variables

## Frontend

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_GITHUB_CLIENT_ID=
NEXT_PUBLIC_WEB3FORMS_KEY=
```

## Backend

```env
GROQ_API_KEY=
GROQ_MODEL=qwen/qwen3.8-27b
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
FRONTEND_URL=
```

> `GROQ_API_KEY` is read server-side only and is never exposed to the browser.
> `GROQ_MODEL` selects the Groq chat model used for codebase answers.
> (RAG vector embeddings still use Gemini — `GEMINI_API_KEY` — because Groq does
> not offer an embedding API. This does not affect chat answer generation.)

---

# 🚀 Quick Start

## Clone

```bash
git clone https://github.com/Lingu17/codeforge-ai.git

cd codeforge-ai
```

## Frontend

```bash
cd frontend

npm install

npm run dev
```

Runs on:

```text
http://localhost:3000
```

## Backend

```bash
cd backend

pip install -r requirements.txt

uvicorn app.main:app --reload
```

Runs on:

```text
http://localhost:8000
```

---

# 🔐 GitHub OAuth Setup

Homepage URL

```text
https://yourdomain.com
```

Callback URL

```text
https://yourdomain.com/auth/github/callback
```

Add:

```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

---

# 📧 Contact Form Setup (Web3Forms)

Create an account at Web3Forms.

Add:

```env
NEXT_PUBLIC_WEB3FORMS_KEY=
```

Submit requests to:

```text
https://api.web3forms.com/submit
```

---

# 🗺 Roadmap

## Current

* Repository Analysis
* Architecture Maps
* AI Chat
* Security Audits
* Health Scores
* PR Reviews

## Upcoming

* Team Workspaces
* Slack Integration
* Jira Integration
* AI Refactoring Assistant
* Multi-Repository Search
* Enterprise SSO
* CI/CD Insights
* Continuous Monitoring

---

# 🤝 Contributing

1. Fork Repository
2. Create Feature Branch

```bash
git checkout -b feature/new-feature
```

3. Commit Changes

```bash
git commit -m "Add new feature"
```

4. Push Branch

```bash
git push origin feature/new-feature
```

5. Open Pull Request

---

# 👨‍💻 Author

## Lingraj Malipatil

GitHub:
https://github.com/Lingu17

LinkedIn:
https://linkedin.com/in/lingraj-malipatil

---

# ⭐ Support

If CodeForge AI helps you:

⭐ Star the Repository

🐛 Report Issues

🚀 Share with Developers

💡 Contribute New Features

---

<p align="center">
Built with ❤️ by Lingraj Malipatil
</p>

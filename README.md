# 🚀 CodeForge AI

> AI-Powered Software Engineering Copilot for Repository Analysis, Architecture Visualization, Security Audits, and Intelligent Codebase Chat.

![CodeForge AI Banner](https://via.placeholder.com/1200x400?text=CodeForge+AI)

## 🌟 Overview

CodeForge AI is an intelligent software engineering platform that helps developers understand, analyze, and improve codebases using AI.

Simply connect a GitHub repository and CodeForge AI will:

* 📂 Analyze repository structure
* 🏗 Generate architecture maps
* 💬 Enable AI-powered codebase chat
* 🔍 Detect security vulnerabilities
* 📊 Calculate project health scores
* 📝 Generate pull request reviews
* 🧠 Create semantic code embeddings
* ⚡ Surface technical debt and risks

Built for developers, startups, engineering teams, and technical leaders.

---

## ✨ Features

### Repository Analysis

* GitHub OAuth integration
* Public and private repository support
* Automated repository cloning
* Source code indexing
* Dependency discovery

### Architecture Visualization

* Interactive architecture graphs
* Module relationship mapping
* Service dependency visualization
* Code structure analysis

### AI Codebase Chat

Ask questions such as:

* "How does authentication work?"
* "Where is payment logic implemented?"
* "Explain the API architecture."
* "Find security issues in this repository."

### Security & Technical Debt

* Vulnerability detection
* Dependency analysis
* Code smell detection
* Technical debt scoring
* Security recommendations

### Health Score

Evaluate repository quality using:

* Maintainability
* Documentation quality
* Dependency health
* Security posture
* Architecture quality

### Pull Request Reviews

* AI-generated review suggestions
* Best practice recommendations
* Refactoring opportunities
* Security issue identification

---

## 🏗 System Architecture

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
        │
 ┌──────┼─────────┐
 ▼      ▼         ▼
Chat  Security  Health
Engine Analysis Score
```

---

## 🛠 Tech Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* Framer Motion
* ShadCN UI

### Backend

* FastAPI
* Python
* AsyncIO
* GitPython

### AI

* OpenAI GPT Models
* OpenAI Embeddings

### Database

* Supabase
* PostgreSQL
* pgvector

### Infrastructure

* Vercel (Frontend)
* Render (Backend)
* GitHub OAuth

---

## 📁 Project Structure

```text
codeforge-ai/

├── frontend/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── types/
│
├── backend/
│   ├── api/
│   ├── services/
│   ├── repositories/
│   ├── embeddings/
│   ├── scanners/
│   ├── security/
│   └── workers/
│
├── database/
│   ├── migrations/
│   └── schema.sql/
│
└── docs/
```

---

## ⚙️ Environment Variables

### Frontend (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_GITHUB_CLIENT_ID=
NEXT_PUBLIC_WEB3FORMS_KEY=
```

### Backend (.env)

```env
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
FRONTEND_URL=
```

---

## 🚀 Installation

### Clone Repository

```bash
git clone https://github.com/yourusername/codeforge-ai.git

cd codeforge-ai
```

### Frontend

```bash
cd frontend

npm install

npm run dev
```

Frontend:

```text
http://localhost:3000
```

### Backend

```bash
cd backend

pip install -r requirements.txt

uvicorn app.main:app --reload
```

Backend:

```text
http://localhost:8000
```

---

## 🔐 GitHub OAuth Setup

1. Create a GitHub OAuth App.
2. Configure:

```text
Homepage URL
https://yourdomain.com
```

```text
Authorization Callback URL
https://yourdomain.com/auth/github/callback
```

3. Add:

```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

---

## 📧 Contact Form (Web3Forms)

CodeForge AI uses Web3Forms for contact submissions.

### Setup

1. Create a form at Web3Forms.
2. Copy Access Key.
3. Add:

```env
NEXT_PUBLIC_WEB3FORMS_KEY=your_key
```

4. Submit directly to:

```text
https://api.web3forms.com/submit
```

---

## 📊 Roadmap

### Current

* Repository Analysis
* Architecture Maps
* Codebase Chat
* Security Audits
* Health Scores
* PR Reviews

### Upcoming

* Team Workspaces
* Repository Monitoring
* Slack Integration
* Jira Integration
* CI/CD Insights
* AI Refactoring Assistant
* Multi-Repository Search
* Enterprise SSO

---

## 🤝 Contributing

Contributions are welcome.

1. Fork repository
2. Create feature branch

```bash
git checkout -b feature/my-feature
```

3. Commit changes

```bash
git commit -m "Add feature"
```

4. Push branch

```bash
git push origin feature/my-feature
```

5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

**Lingraj Malipatil**

* GitHub: https://github.com/Lingu17
* LinkedIn: https://linkedin.com/in/lingraj-malipatil

---

## ⭐ Support

If you find CodeForge AI useful:

⭐ Star the repository

🐛 Report issues

🚀 Share with other developers

---

Built with ❤️ by Lingraj Malipatil

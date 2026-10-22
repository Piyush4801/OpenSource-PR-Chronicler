# OpenSource PR Chronicler & Learning Dispatcher

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com)
[![LangChain](https://img.shields.io/badge/LangChain-LCEL-green.svg)](https://python.langchain.com)
[![Google Gemini](https://img.shields.io/badge/Google-Gemini_Flash-orange.svg)](https://ai.google.dev/)
[![React 18](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**OpenSource PR Chronicler** is a production-minded, event-driven AI application that automatically converts merged GitHub pull requests into structured engineering reflections and dispatches them via SMTP to your configured email address.

It empowers open-source contributors and engineering students to:
- **Document Technical Problem Solving**: Capture root causes and original requirements directly from PR metadata and linked issues.
- **Explain Implementation Decisions**: Ground architectural decisions and function modifications in actual Git diffs.
- **Extract Concrete Takeaways**: Retain 3–4 high-leverage lessons from every contribution for portfolio reviews and system design interviews.
- **Maintain Contribution Records**: Store complete contribution telemetry and audit trails in a local SQLite database and desktop-first dashboard.

---

## 1. System Architecture

```mermaid
flowchart TD
    GH[GitHub Pull Request Merged] -->|POST /webhook/github| WH[FastAPI Webhook Listener]
    
    subgraph Webhook Validation & Deduplication
        WH -->|HMAC SHA-256| SIG{Verify Signature}
        SIG -->|Invalid| R401[HTTP 401 Unauthorized]
        SIG -->|Valid| FLT{action == 'closed'<br/>&& merged == true?}
        FLT -->|No| IGN[Log & Return HTTP 200 Ignored]
        FLT -->|Yes| DEDUP{Delivery Recorded?}
        DEDUP -->|Yes| DUP[Return HTTP 200 Duplicate]
        DEDUP -->|No| ACK[Return HTTP 200 Accepted<br/>+ Enqueue Background Task]
    end

    subgraph Background Orchestration Pipeline
        ACK --> HYD[GitHub REST API Hydration<br/>Pulls Files + Diffs + Issues]
        HYD --> LCEL[LangChain LCEL Chain<br/>ChatGoogleGenerativeAI<br/>model: gemini-1.5-flash]
        LCEL --> PARSE[JsonOutputParser<br/>Pydantic Validation: PRReflection]
        PARSE --> DB[(SQLite Database<br/>pr_chronicler.db)]
        PARSE --> SMTP[smtplib Worker Thread<br/>STARTTLS / SSL]
        SMTP --> EMAIL[Formatted Multi-part Email<br/>[OS-Log] Subject to Recipient]
    end

    subgraph Desktop Dashboard
        DB --> API[FastAPI /api Routes]
        API --> UI[React + TypeScript + Tailwind UI<br/>Apple x Linear x GitHub Aesthetic]
    end
```

---

## 2. Technology Stack

| Layer | Technologies |
|---|---|
| **Backend Framework** | Python 3.10+, FastAPI, Uvicorn, httpx (async HTTP) |
| **Data Validation** | Pydantic v2, Pydantic-Settings |
| **AI Orchestration** | LangChain Core, LangChain Google GenAI, LCEL, JsonOutputParser |
| **LLM Model** | Google Gemini Flash (`gemini-1.5-flash`, configurable) with temperature 0.1 |
| **Email Dispatch** | Standard library `smtplib`, `email.message.EmailMessage`, TLS encryption |
| **Database** | SQLite3 (zero-dependency, ACID compliant, persistent deduplication) |
| **Frontend UI** | React 18, TypeScript, Vite, Tailwind CSS, Lucide React |
| **Testing** | pytest, pytest-asyncio, FastAPI TestClient, unittest.mock |

---

## 3. Folder Structure

```
lec14/
├── .env.example              # Environment variables template
├── .gitignore                # Git exclusion rules
├── README.md                 # Complete system documentation
├── simulate_merge.py         # Automated simulation script for 3 webhook cases
├── pr_chronicler.log         # Dual terminal/file log output
├── pr_chronicler.db          # SQLite database (auto-created on startup)
│
├── backend/
│   ├── requirements.txt      # Python dependencies
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI application entrypoint & middleware
│   │   ├── config.py         # Pydantic Settings & environment loader
│   │   ├── logger.py         # Dual terminal/file logger with secret masking
│   │   ├── database.py       # SQLite persistence, metrics, and deduplication
│   │   ├── schemas.py        # Pydantic schemas (PRReflection, WebhookResponse)
│   │   ├── github_client.py  # Asynchronous GitHub REST API client
│   │   ├── ai_pipeline.py    # LangChain LCEL chain with Gemini Flash
│   │   ├── email_service.py  # smtplib multi-part HTML email worker
│   │   ├── orchestrator.py   # Asynchronous pipeline coordinator
│   │   └── routes/
│   │       ├── webhook_routes.py  # POST /webhook/github endpoint
│   │       └── api_routes.py      # /api/stats, /reflections, /settings/status
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py            # Test database & mock environment setup
│       ├── test_webhook.py        # Webhook filtering, signatures & dedup
│       ├── test_github_client.py  # GitHub pagination, diffs & issue parsing
│       ├── test_ai_pipeline.py    # Schema validation & grounded fallback
│       ├── test_email_service.py  # Template generation & SMTP mocking
│       └── test_orchestrator.py   # End-to-end integration tests
│
└── frontend/
    ├── package.json          # Node dependencies & scripts
    ├── vite.config.ts        # Vite config with dev proxy to FastAPI
    ├── tsconfig.json         # TypeScript strict configuration
    ├── tailwind.config.js    # Custom brand & navy styling
    ├── index.html            # Application HTML shell
    └── src/
        ├── App.tsx           # Dashboard root coordinator
        ├── types.ts          # TypeScript interfaces
        ├── api.ts            # Client API calls
        └── components/
            ├── Header.tsx           # Navigation & quick action triggers
            ├── StatsOverview.tsx    # Metric cards & recent contributions
            ├── PRHistory.tsx        # Searchable and filterable contributions table
            ├── ReflectionModal.tsx  # Focused 3-section reflection viewer
            ├── SettingsGuide.tsx    # Live configuration audit & setup guide
            ├── SimulationPanel.tsx  # Interactive browser-based webhook dispatcher
            └── LiveLogsModal.tsx    # Streaming pr_chronicler.log console
```

---

## 4. Environment Setup

Create your local `.env` file from the provided `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Google Gemini API
GOOGLE_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# GitHub Integration
GITHUB_TOKEN=your_github_personal_access_token_optional
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# SMTP Email Configuration
SMTP_EMAIL=your_email@gmail.com
SMTP_APP_PASSWORD=your_16_character_google_app_password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
RECIPIENT_EMAIL=your_inbox@domain.com
```

> **Security Note:** Passwords, tokens, and keys are automatically masked in all log outputs and are never exposed to the frontend.

---

## 5. Installation & Running Locally

### Step 1: Initialize Python Virtual Environment & Install Backend

```bash
# From the project root (lec14/)
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

### Step 2: Start the FastAPI Backend Server

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend server will start at `http://localhost:8000`. You can inspect the Swagger documentation at `http://localhost:8000/docs`.

### Step 3: Start the React Frontend Dashboard

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 6. Local Testing with `simulate_merge.py`

The repository includes a dedicated simulation script `simulate_merge.py` that sends realistic GitHub webhook payloads directly to `http://localhost:8000/webhook/github`.

### Test All 3 Mandatory Scenarios

```bash
./venv/bin/python simulate_merge.py --scenario all
```

Expected output:
```
===================================================================
OpenSource PR Chronicler: Webhook Simulator
===================================================================
Running all three mandatory test scenarios:

=======================================================
SIMULATING SCENARIO: MERGED
HTTP Status: 200 (15.2ms)
>>> SUCCESS: Merged PR was accepted for processing pipeline!

=======================================================
SIMULATING SCENARIO: UNMERGED
HTTP Status: 200 (6.1ms)
>>> SUCCESS: Unmerged event was correctly ignored with HTTP 200!

=======================================================
SIMULATING SCENARIO: OPENED
HTTP Status: 200 (5.8ms)
>>> SUCCESS: Opened event was correctly ignored with HTTP 200!

===================================================================
TEST SUMMARY RESULTS:
  Case 1: Merged PR              : [PASSED]
  Case 2: Closed unmerged PR     : [PASSED]
  Case 3: Opened PR              : [PASSED]
===================================================================
```

---

## 7. Live Webhook Setup via Ngrok

To receive real webhook events from GitHub:

1. **Start FastAPI**:
   ```bash
   ./venv/bin/uvicorn backend.app.main:app --port 8000
   ```
2. **Start ngrok tunnel**:
   ```bash
   ngrok http 8000
   ```
3. **Copy the HTTPS URL** (e.g., `https://a1b2-c3d4.ngrok-free.app`).
4. **Configure GitHub Repository Webhook**:
   - Go to your repository on GitHub &rarr; **Settings** &rarr; **Webhooks** &rarr; **Add webhook**.
   - **Payload URL**: `https://a1b2-c3d4.ngrok-free.app/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: Enter the exact string configured in `GITHUB_WEBHOOK_SECRET`.
   - **Events**: Choose *"Let me select individual events"* &rarr; check **Pull requests**.
   - Click **Add webhook**.
5. **Open & Merge a Test PR**:
   - Create a test branch and push a change.
   - Open a pull request referencing an issue (e.g., `Fixes #1`).
   - Merge the pull request.
   - Within seconds, inspect `pr_chronicler.log`, check the React dashboard, and verify the formatted email in your inbox!

---

## 8. Automated Pytest Test Suite

Execute the unit and integration test suite:

```bash
./venv/bin/pytest backend/tests -v
```

All external services (GitHub API, Gemini LLM, SMTP server) are mocked so tests run deterministically and offline without requiring paid APIs or network access.

---

## 9. Example AI Reflection Output

```json
{
  "issue_details": "Root Cause: High CPU spikes were observed during wheel package resolution due to quadratic lookup in local file caches (Fixes #542, #618).",
  "execution_summary": "Introduced an in-memory SHA-256 fingerprint hashmap in resolver.rs, bypassing repeated disk scans. Updated cache_manager.py eviction heuristics to remove stale entries after 24 hours.",
  "key_learnings": [
    "Profiling I/O hot spots before modifying caching heuristics prevents premature memory expansion.",
    "Decoupling cache invalidation logic into atomic helper functions simplifies concurrency regression testing.",
    "Ensuring backward compatibility with legacy lockfiles guarantees seamless contributor upgrades."
  ]
}
```

---

## 10. Repository Management & Webhook Configuration

The application features full multi-repository management with persistent SQLite tracking:

### API Endpoints
- `GET /api/repositories`: List all tracked repositories with star counts and contribution statistics.
- `POST /api/repositories`: Connect a new GitHub repository by URL (`https://github.com/owner/repo` or `owner/repo`). Verifies existence via GitHub REST API.
- `DELETE /api/repositories/{id}`: Remove a repository from active tracking. All historical PR reflections and notes are strictly preserved in `pr_reflections`.
- `GET /api/repositories/{id}/webhook-info`: Retrieve pre-filled webhook setup instructions, target payload URL, content type, and event requirements.

### Webhook Status Lifecycle
- **Setup Required**: Repository is connected in the dashboard, but awaiting its first delivered webhook or ping event.
- **Webhook Active**: Successfully verified via GitHub ping or processed pull request event.
- **External Contributor Mode**: If you do not have admin permissions to install webhooks on an external open-source repository, use the in-app Webhook Simulator or CLI script (`simulate_merge.py`) to test and generate reflections.

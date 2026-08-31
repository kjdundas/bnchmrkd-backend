# bnchmrkd.

**The context behind sports performance.**

bnchmrkd. benchmarks an athlete's results against Olympic-level career trajectories. It's built on a database of ~311,000 career race results from 2,322 Olympic athletes across sprint, hurdles, distance, jumps and throws disciplines, and gives athletes (age 15–38) percentile context, trajectory clustering, peak-year projection and talent-identification signals for their performances.

Live site: **bnchmrkd.org** · API: hosted on Railway · Database & auth: Supabase

---

## Repo layout

Despite the repo name (`bnchmrkd-backend`), this is a **monorepo**:

```
├── backend/     FastAPI API (Python 3.11) — analysis engine, AI scanner, assistant
├── frontend/    Vite + React 18 web app (Tailwind CSS v4) — the live site
├── mobile/      Expo / React Native app (early stage, v0.1)
├── supabase/    SQL migrations + RLS tests (applied to the Supabase project)
├── database/    Original schema + one-off migration scripts (Excel → Postgres)
├── docs/        PRDs and implementation plans
└── push.ps1     Helper script for committing/pushing (Windows)
```

## Architecture at a glance

```
React web app (Vite)  ──►  Supabase (Postgres + Auth + RLS)   user accounts, profiles,
        │                                                      performances, coach links
        │
        └──► FastAPI backend (Railway) ──► Supabase Postgres   analysis engine, benchmark
                     │                                          data, athlete explorer
                     └──► OpenAI API                            AI scanner + assistant
```

- The **frontend** talks to Supabase directly (auth, user data) and to the FastAPI backend for analysis. Note: Supabase calls go through a **raw fetch wrapper** (`frontend/src/lib/supabaseRest.js`), not the supabase-js query builder — the query builder's Web Locks caused hangs. Keep using the wrapper for data calls.
- The **backend** is stateless. It reads benchmark/athlete data from Supabase Postgres and verifies Supabase JWTs on protected routes.

---

## Running it locally

### Prerequisites

- Node 18+ and npm
- Python 3.11
- Access to the Supabase project (ask Keenan for an invite to the Supabase org, plus the values for the `.env` files below)

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv venv
# Windows:  venv\Scripts\activate     macOS/Linux:  source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in real values
python start.py        # serves on http://localhost:8000
```

`backend/.env` needs:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string (Dashboard → Project Settings → Database) |
| `SUPABASE_JWT_SECRET` | Dashboard → Project Settings → API → JWT Settings — required for protected routes |
| `OPENAI_API_KEY` | Powers the AI Scanner and Assistant features |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins. Defaults to localhost dev origins if unset |

Sanity checks once running: `http://localhost:8000/health` and interactive API docs at `http://localhost:8000/docs`.

### 2. Frontend (React)

```bash
cd frontend
npm install
cp .env.example .env   # then fill in real values
npm run dev            # opens http://localhost:5173
```

`frontend/.env` needs:

| Variable | What it is |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key (Dashboard → API) |
| `VITE_API_BASE` | Backend URL — `http://localhost:8000` for local dev, the Railway URL for prod |
| `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` | PostHog analytics (optional locally) |

Main entry: `frontend/src/bnchmarkd-app.jsx` (large single-file SPA, ~6,000 lines) with supporting `components/`, `contexts/`, and `lib/`.

### 3. Mobile (optional, early stage)

```bash
cd mobile
npm install
npm start              # Expo dev server; press a/i/w for Android/iOS/web
```

---

## API overview

All routes are under `/api/v1`. Full interactive docs at `{API_BASE}/docs`.

| Endpoint | Purpose |
|---|---|
| `POST /analyze/manual` | Full analysis from manually entered season bests |
| `POST /analyze/quick` | Quick single-performance analysis |
| `POST /analyze/url` | Analysis from a World Athletics profile URL (scraper currently **paused** — see below) |
| `GET /benchmarks/{discipline}/{gender}` | Percentile benchmark curves |
| `GET /disciplines` | Supported disciplines |
| `GET /athletes`, `GET /athletes/{id}` (+ `/trajectory`, `/races`) | Athlete Explorer data |
| `GET /similar-athletes` | Nearest Olympic career trajectories |
| `GET /stats/discipline/{code}` | Discipline-level stats |
| `POST /ai-scanner/*` | Upload a results PDF/image → extracted performances (OpenAI) |
| `POST /assistant`, `POST /assistant/program` | AI assistant / program generation |
| `POST /scrape` | World Athletics scraping (Selenium — paused/gated) |

**Note on the scraper:** the Selenium/Chrome scraper is currently paused. The Dockerfile deliberately doesn't install Chrome (it was the slowest, most failure-prone build step). If it's re-enabled, Chrome needs to be added back to the image.

---

## Database

Supabase PostgreSQL, two families of tables:

1. **Reference/benchmark data** (read-only at runtime): `disciplines`, `athletes`, `race_results`, `personal_bests`, `season_bests`, `olympic_results`, plus model tables — `age_percentile_benchmarks`, `roc_thresholds`, `trajectory_clusters`, `improvement_norms`, `model_calibration`, `model_coefficients`. Original schema: `database/schema.sql`; data was loaded from the Excel master databases via the `database/migrate*.py` scripts (one-off, shouldn't need re-running).
2. **User/product data** (created via `supabase/migrations/`): profiles, performances, athlete progress, check-ins, coach–athlete links & consent RPCs, activity reactions, program session logs, plan entitlements.

**Migrations:** files in `supabase/migrations/` are dated SQL files applied to the Supabase project (via the dashboard SQL editor or Supabase MCP/CLI). Apply new ones in date order. RLS is enabled and hardened — `supabase/tests/consent_rls_test.sql` covers the consent policies. If you change policies, re-check with Supabase's advisors (Dashboard → Advisors).

---

## Deployment

- **Backend** deploys to **Railway** from this repo using `backend/Dockerfile` (context = repo root). Railway injects `PORT`; the container runs uvicorn. Set the env vars from the table above in the Railway service — especially `ALLOWED_ORIGINS` (comma-separated prod domains) and `SUPABASE_JWT_SECRET`.
- **Frontend**: `npm run build` produces `frontend/dist/` (static). Deploy behind the bnchmrkd.org domain; make sure `VITE_API_BASE` points at the Railway URL and the prod domain is included in the backend's `ALLOWED_ORIGINS`.
- **Database**: changes go through `supabase/migrations/` — never edit prod tables ad hoc without adding the SQL file to the repo.

Deploy checklist: after pushing, hit `{API_BASE}/health`, then run one quick analysis end-to-end on the live site.

---

## Conventions & gotchas

- **Supabase from the frontend:** use `lib/supabaseRest.js` (raw fetch), not supabase-js query-builder calls — the builder caused Web Locks hangs in this app.
- **Numeric values from Postgres arrive as strings** over the REST API — parse before doing math (this has bitten us before).
- **Branding:** always lowercase `bnchmrkd.` with the trailing dot. Current brand: light theme, indigo `#4F3CF0` accents; wordmark SVGs in `frontend/public/`.
- **Auth:** Supabase Auth (JWT). The backend verifies tokens with `SUPABASE_JWT_SECRET`; protected routes 401 without a valid token.
- **Charts:** season-best-per-age lines with an inverted time axis (faster = up) — not PB step charts.
- `frontend/dist/` and `mobile/dist/` are build output; don't hand-edit.

## Where to look for what

| Task | Location |
|---|---|
| Analysis engine / stats logic | `backend/app/services/` |
| API endpoints | `backend/app/api/` |
| DB connection & auth | `backend/app/core/` |
| Web UI | `frontend/src/bnchmarkd-app.jsx` + `frontend/src/components/` |
| Supabase fetch wrapper | `frontend/src/lib/supabaseRest.js` |
| Product docs / PRDs | `docs/` |

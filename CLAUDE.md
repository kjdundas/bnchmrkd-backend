# bnchmrkd. — project guide for Claude

bnchmrkd is a sports analytics platform for track & field: athletes and coaches log
performances and physical test metrics, and benchmark them against a database of
~311K Olympic-level race records (2,300+ athletes, 18 events, Sydney 2000 → Paris 2024).

Live site: https://www.bnchmrkd.org (Railway, deploys automatically from `main`).

## Repo layout (monorepo — the repo name "bnchmrkd-backend" is historical, ignore it)

- `backend/` — FastAPI (Python). Serves the analysis API.
- `frontend/` — React + Vite web app. **Most product work happens here.**
  - `src/bnchmarkd-app.jsx` — the main app shell (landing page, analyzer views). Large file (~6k lines).
  - `src/components/athlete/AthleteDashboard.jsx` — athlete home (Oura-style: metric circles rail,
    performance hero with PB gauge, trend cards), tabs Home / Programs / Trajectory + log FAB.
  - `src/components/coach/CoachDashboard.jsx` — coach side.
  - `src/components/auth/AuthPage.jsx` — Supabase auth.
  - `src/lib/` — domain logic: `disciplineScience.js`, `performanceLevels.js`, `supabaseRest.js`, etc.
  - `public/` — brand assets (see Brand below).
- `mobile/` — Expo React Native app.
- `supabase/` — SQL, migrations, email templates.

## Critical conventions

1. **Supabase access is raw REST, not supabase-js queries.** Use `selectFrom` / `updateIn`
   from `src/lib/supabaseRest.js`. Do NOT introduce supabase-js query-builder calls —
   `getSession()`-style calls hang due to a Web Locks issue in this app. Auth tokens are
   read from localStorage (`sb-<project-ref>-auth-token`); see `AuthContext.jsx` for the pattern.
2. **Environment**: `frontend/.env` (gitignored) needs `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE` (Railway backend URL), optional PostHog keys.
   Ask Keenan for values — never commit them.
3. **Deploys**: every push to `main` goes live on bnchmrkd.org via Railway. Work on feature
   branches and open PRs; keep `main` shippable.
4. **Supabase free tier pauses after ~1 week of inactivity** — if the app suddenly fails with
   "Failed to fetch" everywhere, check the Supabase dashboard for a paused project before
   debugging code.

## Brand system

- One brand colour: **Electric Indigo `#4F3CF0`** (bright variant `#8B83FF`, deep surface
  `#141636`, soft tint `#EDEBFE`). Normalise any stray indigos to these. No orange — that was
  the old scheme.
- Logo: track-lane 'b' wordmark. Assets in `frontend/public/`:
  `bnchmrkd-wordmark.svg` (indigo, for light backgrounds), `bnchmrkd-wordmark-white.svg`
  (for dark backgrounds: splash screen, auth page), `favicon.svg` ('b' on indigo).
  Never render the logo as text + icon; use the SVGs.
- Theme: the app is **light** (gradient `#F6F7FB → #FFFFFF → #EDEBFE`) except the splash
  screen and auth page, which are dark. Fonts: Instrument Sans (display), DM Mono (numerals/labels).

## Chart rules (Keenan's standing preferences)

- Time-based (sprint) axes are **inverted so faster = higher** — improvement must read as climbing.
- Career progression charts: **season-best per year of age** (one point per age), never
  running-PB step charts.
- Wind-legal marks only for sprint comparisons.

## Domain notes

- Metrics: `athlete_metrics` rows carry `metric_key`, `metric_label`, `unit`, `value`,
  `recorded_at`. Direction matters: `LOWER_IS_BETTER` / `NO_PB` sets in `AthleteDashboard.jsx`
  define PB semantics (times & body-fat lower-better; jumps/throws/strength higher-better;
  body-mass/heights have no PB).
- Performances live on `athlete_profiles.races` / `disciplines_data` (web) and the
  `performances` table (mobile). Throws vs track: `isThrowsDiscipline()` flips PB direction.
- Marks format via `formatMark()` — throws in metres, track as `ss.xx`s or `m:ss.xx`.

## Working style

- Test UI changes as standalone samples/mockups before wiring into the app when the change
  is visual and non-trivial; Keenan likes to approve a preview first.
- Don't commit or push without being asked; a push means production.

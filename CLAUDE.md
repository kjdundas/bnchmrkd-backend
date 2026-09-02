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

## Mobile design tokens (`mobile/src/lib/theme.ts`) — enforced, not advisory

- **Never write a bare `fontSize`, `borderRadius` or `fontWeight` number** in `mobile/src`.
  Use the scales: `typeScale` (10 steps: micro 9 · label 11 · caption 13 · body 15 ·
  title 18 · stat 22 · figure 28 · hero 34 · display 44 · mark 56), `radius`
  (5: hair 4 · chip 8 · control 12 · card 20 · full), `weight` (3: regular · medium · bold).
  These replaced 40 / 31 / 5 ad-hoc values. Adding an eleventh step is how that comes back —
  reach for an existing one first.
- A computed circle is `borderRadius: SIZE / 2`, or `radius.full`. Never the literal half.
- **Every tap goes through `Tappable`** (`components/ui.tsx`) — it carries hit slop, the press
  response and the accessibility role. Raw `TouchableOpacity` is banned. Stacked list rows
  pass `hitSlop={0}` so neighbouring rows' targets don't overlap.
- `node mobile/scripts/checks/ttokens.js` fails the build on any of the above. Run it after
  touching styles; the other harnesses in that folder cover first-run, boards and corpus logic.

- **`TIER_COLORS` is a FILL ramp. `TIER_INK` is the text ramp.** The fill ramp climbs
  from #4A4770 so intensity carries tier on a dark surface; used as text it fails —
  "QUALIFIER" in `TIER_COLORS[4]` over the photo backdrop measured **1.00:1**, glyph and
  ground both L=0.129. Any tier name, code or number rendered as text uses `TIER_INK`.
- **Over `ScreenBackdrop`, text is white or near-white, full stop.** No step of either
  ramp clears AA on a photograph — `TIER_INK[4]` reaches 3.10:1 and even T7 stops at 4.88.
  The tier is carried by the word itself and by whatever the drawing fills.

## Performance tiers — calibrated, not asserted

- Senior tiers T4-T7 (Qualifier, Finalist, Medalist, World Class) in
  `mobile/src/lib/performanceLevels.js` are **measured** from `reference.season_bests`
  (World Athletics season bests, ages 20-32): Qualifier = p10 of that distribution,
  Finalist = p5, Medalist = p1, World Class = p0.2, direction taken from
  `disciplines.lower_better`. That mapping was fitted against four independent ground
  truths in the 100m — Olympic final medians from `public.olympic_results` and the
  published Paris-2024 entry standards — and lands inside five hundredths on all four.
- **T1-T3 (Emerging, Developing, National) are NOT from the corpus and must not be.**
  The corpus is elite-only: its slowest 1% of senior men's 100m is 11.45, faster than
  the app's Emerging cut. There are no club athletes in it. Those three rungs are
  development standards from Keenan's spreadsheet.
- Junior rows (U13-U20) are untouched for the same reason — the corpus holds 22 U13
  athletes and 377 U15s, all of them internationals.
- `node mobile/scripts/checks/ttiers.js` fails on a repeated cut, a row that does not
  rise in difficulty, or a tier named after an Olympic standard drifting more than a
  tenth from the measured one. Run it after any change to the levels table.

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

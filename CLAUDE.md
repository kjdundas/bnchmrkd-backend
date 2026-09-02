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

## Spacing: the HOST places the block, never the block itself

- The screens do not agree on how to space top-level blocks. **Home and Trajectory**
  put horizontal padding on the scroll container and space with `marginBottom`;
  **Boards** gives each card its own `marginHorizontal: spacing.lg` and spaces with
  `marginTop`. Both are fine; mixing them is not.
- So a shared component **must not hardcode its own margins**. It takes
  `style?: StyleProp<ViewStyle>` and the screen passes placement. A component that
  decides where it sits is only correct on the screen it was written for — reused
  elsewhere it lands flush against its neighbour (no gap at all) or full-bleed while
  everything around it is inset. Both of those shipped.
- Exception: a component that returns a **fragment** of sibling blocks (PhysicalProfile)
  has no root to style. Leave it alone rather than bolting a prop onto whichever
  element happens to be first.

## Performance tiers — calibrated, not asserted

- Senior tiers T4-T7 (Qualifier, Finalist, Medalist, World Class) in
  `mobile/src/lib/performanceLevels.js` are **measured** from `reference.season_bests`
  (World Athletics season bests, ages 20-32): Qualifier = p10 of that distribution,
  Finalist = p5, Medalist = p1, World Class = p0.2, direction taken from
  `disciplines.lower_better`. That mapping was fitted against four independent ground
  truths in the 100m — Olympic final medians from `public.olympic_results` and the
  published Paris-2024 entry standards — and lands inside five hundredths on all four.
- **T2 and T3 are on the same ladder** — `T3 = p40`, `T2 = p70` of the same
  distribution. They were NOT, and the gap that left was the bug Keenan reported as
  "issues with the 200m thresholds". Recalibrating only T4-T7 left every Senior row
  with a canyon at the same rung: measured against career bests, the men's 200m ran
  T1 99.3% → T2 97.7% → T3 95.9% → **T4 17.5%** — three tiers across the top 4% of
  the field and one rung across 78% of it. A 20.75 sat 1.83s clear of the tier below
  and 0.50 short of the one above.
- **T1 (Emerging) is NOT from the corpus and must not be.** `season_bests` is
  elite-only: its slowest 1% of senior men's 100m is 11.31, faster than the app's
  Emerging cut. There are no club athletes in it. T1 is a development standard from
  Keenan's spreadsheet and the join with the top of the U20 ladder. **The T1→T2 step
  is therefore still large and is a product question, not a bug** — in the marathon
  it runs 3:30:00 → 2:16:34.
- 3000m M/F are the only rows off this basis: `season_bests` holds no plain 3000m,
  only the steeplechase, so those two are derived the same way from
  `reference.results` career bests.
- Junior rows (U13-U20) are untouched for the same reason — the corpus holds 22 U13
  athletes and 377 U15s, all of them internationals. **This means a U20 T6 and a
  Senior T6 do not mean the same thing** (22.18 vs 19.77 in the 200m). The matrix
  shows both; whether that reads as age-graded or as inconsistent is unresolved.
- **Corpus figures quoted to a user come from `CORPUS_CAREERS` in `lib/corpus.ts`.**
  Four files each stated a different, stale number; the coach's Projected Career Paths
  said "10,423 Olympic-pipeline careers" when the corpus held 7,215 — 44% high.
- `node mobile/scripts/checks/ttiers.js` fails on a repeated cut, a row that does not
  rise in difficulty, a tier named after an Olympic standard drifting more than a
  tenth from the measured one, a Senior row that does not run one way, or a calibrated
  rung that spans more than a third of the field. Run it after any change to the
  levels table.


## A result awaiting approval

- `countsForAnalysis` in `lib/resultSemantics.ts` excludes pending results from every
  PB, tier, trend and projection. That is correct and stays. What was missing was
  anything that **said so**, so screens fell through to whatever their arithmetic
  produced on an empty list: Trajectory showed `PB Infinity` (`Math.min()` of nothing,
  which is below every tier cut, hence also "BELOW EMERGING"), and Home printed
  "47.00s · New personal best" — a 47cm countermovement jump, picked up by a metric
  bridge and rendered as a 200m time.
- **Take the countable set and the pending set from `partitionResults`, together.**
  Counting rows with one expression and taking the PB from another is what produced
  both numbers. `AwaitingApproval` in `components/ApprovalInbox.tsx` is the thing that
  says it out loud.
- **`METRIC_TO_DISCIPLINE` only bridges a metric that IS the event, timed the same
  way** — `sprint_60m` → 60m, `sprint_100m` → 100m, and nothing else. It used to send
  `cmj_height` to High Jump, `broad_jump` to Long Jump, `flying_20m` to 200m and every
  sprint split to the 100m, so a gym reading was read against race tier cuts.
- `node mobile/scripts/checks/tapproval.js` covers all of the above.

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

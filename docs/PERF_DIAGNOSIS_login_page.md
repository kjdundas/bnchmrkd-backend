# Login page slowness — diagnosis log

**Date:** 2026-08-28
**Reported by:** Aishwar
**Scope:** frontend landing/login load performance, live production (`bnchmrkd.org`)

## Summary

Anonymous visitors' browsers were forced to download and parse a charting library
(`recharts`, ~623KB decoded) and two other vendor bundles on every page load —
including the login page — none of which are needed until a signed-in user opens
their dashboard.

## Investigation

- Inspected live production site (`bnchmrkd.org`) via Chrome network inspection
  (Network tab, Resource Timing API, and a fetched copy of the served `index.html`).
- Found `index.html` serving unconditional preloads:
  ```html
  <link rel="modulepreload" href="/assets/gsap-D1jikD40.js">
  <link rel="modulepreload" href="/assets/recharts-C9heYU9A.js">
  <link rel="modulepreload" href="/assets/supabase-ClVc2H6D.js">
  <link rel="modulepreload" href="/assets/analytics-BVWM-dyW.js">
  ```
  All four fetch and begin parsing immediately on first paint, regardless of which
  view the visitor is on.

## Root cause

`frontend/vite.config.js` — `manualChunks` was defined as a static object:
```js
manualChunks: {
  react: ['react', 'react-dom'],
  recharts: ['recharts'],
  gsap: ['gsap', '@gsap/react'],
  supabase: ['@supabase/supabase-js'],
  analytics: ['posthog-js'],
}
```
This form forces the build tool to treat `recharts` as a top-level chunk and
preload it unconditionally in `index.html`, silently overriding the lazy-load
boundary already set up in `frontend/src/App.jsx`:
```js
const AthleteDashboard = lazy(() => import('./components/athlete/AthleteDashboard'))
```
`recharts` is only ever imported inside `AthleteDashboard.jsx` — it has no reason
to load for a visitor who hasn't signed in yet, let alone one who's just trying
to log in.

### Secondary finding

`frontend/src/main.jsx` statically imports the analytics module at the top of
the file:
```js
import { initAnalytics } from './lib/analytics'
```
even though the actual call is deferred via `requestIdleCallback`. The deferred
*call* doesn't defer the module's *network fetch* — a static `import` is always
resolved eagerly regardless of when the function it exposes is invoked.

## Baseline measurements (live production, bnchmrkd.org)

3 trials, warm cache / fast connection — treat as a floor, not a ceiling:

| Metric | Median |
|---|---|
| Page load event | ~1,320 ms |
| Click "Log In" → auth form rendered | ~652 ms |
| Avoidable eager JS (recharts + gsap + analytics) | ~254 KB gzip / ~1.0 MB decoded |

Byte weight of the four eagerly-loaded chunks (gzip / decoded):

| Chunk | Gzip | Decoded | Needed for login? |
|---|---|---|---|
| index (app shell) | 124.4 KB | 477.4 KB | yes |
| **recharts** | **168.5 KB** | **638.1 KB** | **no** — only `AthleteDashboard` |
| analytics | 59.0 KB | 176.7 KB | idle-deferred in intent, but preload forces early fetch |
| supabase | 50.7 KB | 193.8 KB | yes — auth needs it |
| gsap | 31.7 KB | 78.6 KB | no — landing hero animation only, not the login form |
| CSS | 13.7 KB | 88.3 KB | yes |

See [PERF_FIX_login_page.md](./PERF_FIX_login_page.md) for the fix applied.

---

# Follow-up — 2026-09-01: mobile feels slower than desktop

**Reported by:** Aishwar, after the recharts fix above shipped — desktop felt
noticeably faster, but mobile still felt slow.

## Investigation

- Confirmed mobile and desktop are served byte-identical JS/CSS — there is no
  separate mobile build or device-specific code path anywhere in the app.
  Whatever feels different is coming from something both devices load
  equally, that a phone simply handles worse.
- Checked the two large landing-page background photos directly:
  ```
  frontend/public/hero-stadium.jpg    1920×1081px, 195 KB
  frontend/public/value-stadium.jpg   1920×1081px, 180 KB
  ```
- Found both are applied as plain CSS `background-image` (in
  `frontend/src/bnchmarkd-app.jsx` and
  `frontend/src/components/landing/ValueFlywheel.jsx`'s `.vf-photo` class),
  not `<img>` tags — meaning neither native lazy-loading nor responsive
  `srcset`/`sizes` is available to them; whatever file the CSS names is what
  every device downloads, full stop.

## Root cause

Same full-resolution (1920×1081) images ship to every device regardless of
screen size. This isn't a regression from the recharts fix — it's a
pre-existing gap that was simply masked by the JS payload being the bigger
problem until that was fixed. Two compounding effects specific to mobile:

1. **Download cost** — 375 KB combined is now the single largest thing on the
   page (larger than the JS bundle after the recharts fix), and mobile
   connections are typically slower than the desktop connection used for
   testing.
2. **Decode cost** — decoding and downscaling a 1920px JPEG is real CPU/GPU
   work; phone hardware does this meaningfully slower than a desktop.

See [PERF_FIX_login_page.md](./PERF_FIX_login_page.md) for the fix applied.

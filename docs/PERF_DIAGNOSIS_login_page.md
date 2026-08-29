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

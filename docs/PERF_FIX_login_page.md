# Login page slowness — fix log

**Date:** 2026-08-29
**Related:** [PERF_DIAGNOSIS_login_page.md](./PERF_DIAGNOSIS_login_page.md)

## Changes made

1. **`frontend/vite.config.js`** — removed `recharts` from the `manualChunks`
   object, restoring the build tool's default behavior of keeping it behind
   `AthleteDashboard`'s existing `lazy()` import boundary. It's still bundled
   into its own chunk (for caching), but is no longer force-preloaded from
   `index.html` — it only fetches when a user actually opens the athlete
   dashboard.

2. **`frontend/src/main.jsx`** — changed the analytics import from static to
   dynamic, inside the existing idle callback:
   ```js
   idle(() => { import('./lib/analytics').then(({ initAnalytics }) => initAnalytics()) })
   ```
   **Caveat, verified via build output:** this had no measurable effect on its
   own. `frontend/src/bnchmarkd-app.jsx` (the eagerly-loaded landing page)
   also imports the analytics module directly, so it stays in the eager
   bundle regardless. Fully deferring analytics would require a change to
   that file too — left out of scope for this fix. The change is still
   correct on its own and harmless to keep.

## Verification

- Built and served a local production build (`npm run build` + `npm run preview`)
  and confirmed `recharts-*.js` no longer appears in `index.html`'s
  `modulepreload` list.
- Walked the full landing → click "Log In" → auth form flow against that local
  build and confirmed via network trace that `recharts` never loads at any
  point in that journey.
- Confirmed no regression: the auth form renders and behaves normally.

## Before / after (local A/B test, isolating the code change from network variability)

Built and served both the pre-change and post-change code on the same local
server, 3 timed trials each, to isolate the effect of the fix from network
noise (not a local-vs-live comparison).

| Element optimised | Before | After | Improvement |
|---|---|---|---|
| `recharts` charting library | 165 KB transferred / 623 KB decoded — loaded on every page, including login | 0 KB — only loads when the Athlete Dashboard is opened | **100%** removed from login path |
| Total initial JS + CSS transferred | 439 KB | 277 KB | **37% ↓** |
| Total initial JS + CSS decoded | 1,614 KB | 991 KB | **39% ↓** |
| Page load event (median of 3) | 587 ms | 189 ms | **68% ↓** |
| Click "Log In" → auth form rendered (median of 3) | 960 ms | 379 ms | **61% ↓** |

**Note on absolute numbers:** these are local-machine timings — treat the
percentages as the signal, not the raw millisecond values. On the live site
over a real (especially mobile) network connection, the absolute time saved
should be larger, not smaller, since downloading 165KB extra costs more on a
slow connection than on localhost.

## Status

Committed to the working tree. Not yet pushed — a push to `main` auto-deploys
to `bnchmrkd.org` via Railway, per `CLAUDE.md`.

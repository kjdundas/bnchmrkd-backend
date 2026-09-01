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

Pushed to `main` and confirmed live on `bnchmrkd.org` (2026-08-31): fetched the
deployed `index.html` directly and confirmed `recharts` is absent from the
`modulepreload` list, and confirmed via live network trace that it never loads
across the full landing → click "Log In" → auth form flow.

---

# Follow-up — 2026-09-01: responsive hero images for mobile

**Related diagnosis:** see the matching dated section in
[PERF_DIAGNOSIS_login_page.md](./PERF_DIAGNOSIS_login_page.md).

## Changes made

1. Generated mobile-sized, compressed copies of both hero background images
   (via `sharp`, resized to 900px wide, JPEG quality 74):
   - `frontend/public/hero-stadium-mobile.jpg` — 38 KB (was 195 KB at full size)
   - `frontend/public/value-stadium-mobile.jpg` — 31 KB (was 180 KB at full size)

2. **`frontend/src/bnchmarkd-app.jsx`** — moved the hero background from an
   inline `style` prop to a CSS class (`.hero-bg`), added a
   `@media (max-width: 768px)` override pointing at the mobile image. Inline
   styles can't contain media queries, so this required promoting it to a
   real CSS rule in the existing per-view `<style>` block already used for
   keyframes/fonts.

3. **`frontend/src/components/landing/ValueFlywheel.jsx`** — same pattern
   applied to its existing `.vf-photo` CSS class.

No JavaScript-based device detection was used — this is a plain CSS media
query, so there's no extra runtime logic that can fail; the browser picks the
right file itself based on viewport width, before any image request is made.

## Verification

- Built and served a local production build (`npm run build` + `npm run preview`).
- Resized the browser window to a phone-width viewport (390×844, ~500px CSS
  viewport width) and confirmed via Resource Timing that `hero-stadium-mobile.jpg`
  and `value-stadium-mobile.jpg` were the files actually requested.
- Resized back to a desktop viewport (1440×900) and confirmed the original
  full-size `hero-stadium.jpg` / `value-stadium.jpg` load instead.
- Visual check via screenshot at mobile width: no perceptible quality loss —
  both images sit behind a heavy gradient overlay as decorative background,
  so the resolution drop isn't visible.

## Before / after (mobile only — desktop is unaffected)

| Element optimised | Before | After (mobile, ≤768px viewport) | Improvement |
|---|---|---|---|
| `hero-stadium.jpg` | 195 KB, 1920×1081 — same file for every device | 38 KB, 900×507 | **80% ↓** |
| `value-stadium.jpg` | 180 KB, 1920×1081 — same file for every device | 31 KB, 900×507 | **83% ↓** |
| Combined hero image weight on mobile | 375 KB | 69 KB | **82% ↓** |

**Why this mattered more on mobile than desktop:** both images were served as
CSS `background-image`, which — unlike an `<img>` tag — has no browser-native
way to lazy-load or serve a smaller variant per screen size. Every visitor,
regardless of device, downloaded and decoded the same 1920px-wide files. A
phone pays for this twice: a slower connection making the download take
longer, and a weaker CPU/GPU taking longer to decode and downscale a
desktop-resolution image it was always going to shrink down anyway.

## Status

Pushed to `main` and confirmed live on `bnchmrkd.org` (2026-09-01): verified via
Resource Timing on both a mobile-width and desktop-width viewport that each
gets the correct image file.

---

# Follow-up — 2026-09-01: blank white screen while the app loads

**Reported by:** Aishwar, after the mobile image fix above — mobile felt
faster, but showed several seconds of a plain white screen before the page
appeared at all.

## Diagnosis

This isn't a "why does it take longer than necessary" issue like the previous
two — it's "why does it look broken while it loads," independent of how fast
that load actually is. `frontend/index.html` had:
```html
<div id="root"></div>
<script type="module" src="/src/main.jsx"></script>
```
`#root` is completely empty until React finishes downloading, parsing, and
mounting the app — there is no fallback content of any kind, and the `<body>`
had no background color set, so the browser shows its own default white in
the meantime. Every single-page app (React, Vue, etc.) has this same gap by
default; it's not specific to anything fixed earlier.

## Fix

Added a static, JS-free boot shell directly in `frontend/index.html`:
- `body` background set to the same light gradient the app already uses,
  so there's no color flash when React takes over
- The `bnchmrkd.` wordmark, centered, fading in via a plain CSS
  `@keyframes` animation (no JavaScript involved — it can't itself be
  delayed by the thing it's covering for)
- A small animated progress-bar-style pulse underneath, signaling "loading"
  rather than "frozen"
- Respects `prefers-reduced-motion` (shows the logo statically, no
  animation, for users who've asked for reduced motion)

The markup lives *inside* `<div id="root">`, not replacing it — React's
`ReactDOM.createRoot(...).render(...)` in `main.jsx` replaces `#root`'s
children entirely on mount, so the boot shell is guaranteed to be cleanly
removed the instant the real app is ready. No coordination code needed.

Design was mocked up and approved as a side-by-side before/after comparison
before implementation (per team convention for visual changes).

## Verification

- Confirmed the boot-shell markup renders correctly in the raw built
  `index.html` — works with zero JavaScript, by construction.
- Built and served locally; confirmed via DOM inspection that `#boot-shell`
  is completely gone after mount and `#root` contains exactly one child
  (React's own render), with no leftover nodes or lingering styles.
- Screenshot comparison: landing page after mount is visually identical to
  before this change — no regression.
- Walked the full login flow on the local build — works normally.
- Checked console for errors post-change — only generic browser-extension
  noise unrelated to the app, no new errors introduced.

## Status

Built and verified locally. Not yet committed/pushed at time of writing.

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

Pushed to `main` and confirmed live on `bnchmrkd.org` (2026-09-01): confirmed
`#boot-shell` is served in the raw HTML and cleanly removed after React
mounts, and confirmed no CDN/proxy is caching stale responses (checked
response headers directly — `Server: railway-hikari`, no Cloudflare in the
`www.bnchmrkd.org` path; a fresh cache-busted request always returns current
content).

---

# Follow-up — 2026-09-01: boot shell not visibly showing up for the user

**Reported by:** Aishwar — after the boot-shell fix shipped, mobile Chrome
(including a fresh Incognito tab, ruling out local browser cache) still
appeared to show the same blank period as before.

## Investigation

Methodically ruled out server-side causes first, since those were the most
testable:
- Response headers on `www.bnchmrkd.org` show `Server: railway-hikari` with
  no CDN in front — confirmed no caching layer between origin and browser.
- The bare domain `bnchmrkd.org` does sit behind Cloudflare, but only for a
  301 redirect to `https://www.bnchmrkd.org/` — the redirect target then
  serves fresh, uncached content identically (same ETag as the `www` path).
- A cache-busted fresh request confirmed `#boot-shell` is present in the
  live HTML at all times.

With the server ruled out, the likely cause became a self-inflicted side
effect of the earlier speed work: the boot logo was written to fade in with
a `0.2s` delay + `0.7s` transition (~0.9s before fully visible), designed
so it wouldn't feel like an abrupt flash on a slow connection. But the
recharts/image fixes made the page load fast enough on a good connection
that React can mount and replace `#boot-shell` *before* that fade completes
— so the user sees, at most, a near-white gradient background with no
logo yet, which looks indistinguishable from the old blank-white behavior.

## Fix

`frontend/index.html` — removed the fade-in delay entirely. The wordmark
and pulse bar are now `opacity: 1` from the very first paint, no animation
gating their visibility, so they're guaranteed to show regardless of how
fast the real load turns out to be. The pulse bar's looping track animation
is untouched (that's a continuous indicator, not a delayed reveal).

## Additional fix — cache headers for future deploys

Separately, added `frontend/public/serve.json` (read by the `serve` package,
which Railway's Nixpacks appears to run for the frontend service):
```json
{
  "headers": [
    { "source": "index.html", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
    { "source": "assets/**", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ]
}
```
`index.html` is the one file that must always be revalidated — it's what
points to the current hashed JS bundle. The hashed files under `assets/`
are safe to cache for a full year, since any content change produces a new
filename. Files copied from `public/` with stable names (images, favicon,
wordmark SVGs) are intentionally left alone — they don't have content
hashes, so aggressive caching there would risk exactly this kind of
stale-content problem if one is ever updated in place.

Verified locally with the actual `serve` package (not Vite's own preview
server, which doesn't read `serve.json`): `index.html` correctly returns
`Cache-Control: no-cache`, hashed assets correctly return
`public, max-age=31536000, immutable`.

## Status

Pushed to `main` and confirmed live: cache headers correct, boot logo shows
with `opacity: 1` and no delay in the served HTML, `#boot-shell` cleanly
removed after mount, no regression.

---

# Follow-up — 2026-09-01: still a blank/pale screen on real mobile Chrome

**Reported by:** Aishwar — after the instant-visibility fix, a fresh
Incognito tab on mobile Chrome still showed a blank-ish screen with a
noticeable delay.

## Root cause

`#boot-shell` was sized with `min-height: 100vh`. `100vh` on mobile Safari
and mobile Chrome is a known trap: both browsers dynamically show/hide their
address bar as the page scrolls, and `100vh` is calculated inconsistently
against that — it often reports a taller height than what's actually
visible on screen at a given moment. Since the logo was centered *within*
that (possibly oversized) box, it could end up positioned below the
actually-visible viewport, leaving only the pale gradient background
on screen — which reads as "still blank" even though the fix was
technically present and correct in the served HTML.

This is a real gap in how this was tested: verification up to this point
used a resized desktop Chrome window (via browser automation), which has no
address bar to dynamically collapse — so this class of bug was invisible to
that testing method. It only shows up on an actual mobile browser.

## Fix

`frontend/index.html` — changed `#boot-shell` from `min-height: 100vh` to
`position: fixed; inset: 0;`. This positions the element directly against
the browser's actual visible viewport rather than a computed height value,
which is the standard, robust technique for full-screen overlays on mobile
and isn't subject to the address-bar-collapse inconsistency.

## Verification

- Rebuilt and re-tested the full mount/unmount/login flow locally with the
  real `serve` package — no regression.
- Could not directly reproduce the original mobile-only symptom in this
  environment (no real mobile device/browser available here) — the fix is
  based on a well-documented, standard root cause for exactly this symptom
  rather than a reproduced-then-fixed loop. **Needs a real on-device check
  to fully close this out.**

## Status

Pushed to `main`. Awaiting confirmation on an actual mobile device.

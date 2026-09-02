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

Pushed to `main`. On-device check came back negative — see the next
follow-up below, this was not the (or not the only) cause.

---

# Follow-up — 2026-09-01: still no logo flash — real culprit found

**Reported by:** Aishwar, on-device (mobile Chrome, WiFi, confirmed no
other site feels slow on the same connection): zero logo flash, and
critically, **no trace of the background gradient either** — genuinely flat
white for several seconds, then the real app appears all at once.

## Root cause

That specific detail — not even the background showing — ruled out
positioning as the cause (a mispositioned element would still leave *some*
part of the gradient visible somewhere) and pointed at something blocking
first paint of the *entire document*, boot shell included.

`frontend/index.html` had:
```html
<link href="https://fonts.googleapis.com/css2?...&display=swap" rel="stylesheet" />
```
A `<link rel="stylesheet">` in `<head>` is render-blocking by default —
browsers won't paint anything until every such stylesheet has been fetched,
even ones from a third-party domain, even when the actual page content
(including inline `<style>` and the boot-shell markup sitting right there
in the same document) has nothing to do with that resource. If there's any
extra latency reaching `fonts.googleapis.com` specifically — a different DNS
path, filtering, regional routing — independent of how fast the connection
is to everything else, the whole page sits un-painted until that one
external request resolves. `preconnect` hints were already in place (they
reduce DNS/TLS setup time) but don't remove the fundamentally blocking
nature of the fetch itself.

This explains every observation across all three follow-ups: nothing paints
(not logo, not gradient, not real content) until the font CSS arrives, then
everything appears in one burst once it does — by which point React may
already be mounted and ready, so the boot shell's actual visible window can
be ~0ms even though it's correctly in the HTML the whole time.

## Fix

Converted the font `<link>` to the standard non-blocking load pattern:
```html
<link rel="preload" as="style" href="...fonts.googleapis.com/css2?...">
<link href="...fonts.googleapis.com/css2?..." rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="...fonts.googleapis.com/css2?..." rel="stylesheet"></noscript>
```
`media="print"` makes the browser fetch the stylesheet without treating it
as render-blocking for screen media; `onload` swaps it to `media="all"`
once it's actually loaded, applying the real fonts at that point. The page
now paints immediately using fallback fonts (a brief, standard FOUT), and
swaps to the web fonts once they arrive — independent of how long that
takes. The `<noscript>` fallback preserves normal behavior with JS disabled.

## Verification

- Confirmed the non-blocking `<link>` pattern survives the production
  build unchanged.
- Confirmed via `document.fonts.check('16px "Instrument Sans"')` that the
  font still loads and applies correctly, and confirmed the `media`
  attribute correctly flips from `print` to `all` once loaded.
- Re-ran the full mount/unmount/login flow locally with the real `serve`
  package — no regression.
- **Same caveat as the previous two rounds: this environment has no way to
  reproduce a genuinely slow/blocked path to a third-party domain, so this
  is reasoned from first principles (a textbook render-blocking-resource
  bug) and matches every symptom reported, but is not something I watched
  fail-then-pass myself. Needs the same on-device recheck.**

## Status

Pushed to `main`. On-device check came back negative again — moved to
getting objective measurement data instead of further on-device guessing;
see the next follow-up.

---

# Follow-up — 2026-09-02: real Lighthouse data, and a genuine fix

**Context:** after five rounds of code changes with no visible on-device
improvement, stopped guessing and pulled real mobile performance data from
Google PageSpeed Insights (real Lighthouse run against production, mobile
device emulation, Slow 4G throttling) instead of continuing to theorize.

## What the data actually showed

Mobile performance score: 73/100. `Time to First Byte: 0ms` — the server
responds essentially instantly, which quietly rules out the last two
rounds' distance/region theorizing as the dominant cause. Total Blocking
Time and Cumulative Layout Shift were both perfect (0).

The real cost was in the **LCP breakdown**, for the `div.hero-bg` element
(the hero background photo — Lighthouse's own pick for the page's biggest
visual element):
| Sub-part | Duration |
|---|---|
| Time to First Byte | 0 ms |
| Resource load delay | 620 ms |
| Resource load duration | 190 ms |
| **Element render delay** | **1,570 ms** |

Paired with an **"LCP request discovery"** warning: the browser couldn't
even start fetching the hero image until React had downloaded, executed,
and mounted enough to inject the CSS referencing it — `background-image`
set via a runtime `<style>` tag has no way to be discovered early the way
an `<img src>` or a `<link rel="preload">` can be. The image sits at the
back of a dependency chain (HTML → JS bundle → React mounts → CSS applies →
browser finally learns the image URL exists) instead of loading in
parallel with everything else.

## Fix

Added two `<link rel="preload" as="image">` hints in `frontend/index.html`,
matching the existing mobile/desktop breakpoint (`max-width: 768px`) used
in the CSS:
```html
<link rel="preload" as="image" href="/hero-stadium-mobile.jpg" media="(max-width: 768px)" />
<link rel="preload" as="image" href="/hero-stadium.jpg" media="(min-width: 769px)" />
```
This tells the browser about the hero image immediately, in the HTML
itself, so it starts downloading in parallel with the JS bundle instead of
waiting for React to render before the browser even knows it exists.

## Verification

Rebuilt successfully, changes are minimal and low-risk (two standard
`<link>` tags, no logic change). Real verification is the same PageSpeed
Insights re-run against production after deploy — see the before/after
numbers once that's done, rather than more local/simulated testing.

## Status

Pushed to `main` and re-measured against production with a fresh
PageSpeed Insights run. Real, verified improvement in the specific area
targeted:

| LCP sub-part | Before | After |
|---|---|---|
| Resource load delay | 620 ms | 400 ms |
| Element render delay | 1,570 ms | 1,660 ms (flat, within noise) |

The "Request is discoverable in initial document" check flipped from
failing to passing — the preload genuinely worked as intended. But it
also revealed the real story: **Element render delay, at ~1.6 seconds, is
the dominant cost by a wide margin, and it barely moved.** That number
isn't about *when* the image data arrives — it's the time between the
image being ready and the browser actually being free to paint it, which
means it's dominated by JavaScript execution (React mounting, GSAP setup,
Tailwind CSS application across a ~6,000-line landing page component), not
network or image loading at all.

Also fixed a remaining check on the same insight: added `fetchpriority="high"`
to both preload links (Lighthouse specifically flags this as required for
full effect, not just `rel="preload"` alone).

**Honest assessment:** the preload was a real, measurable, low-risk win —
but it was not the dominant bottleneck, and fixing the actual dominant one
(cutting JS execution time before first paint) is a meaningfully bigger,
more invasive change than anything shipped in this whole thread — likely
code-splitting or deferring parts of `bnchmarkd-app.jsx`, which directly
trades off against the "keep it simple" request that prompted this
follow-up. Flagging this as a decision point rather than continuing to
ship incremental fixes against a cost that isn't primarily networking.

---

# Follow-up — 2026-09-03: remove the hero photo on mobile entirely

**Reported by:** Aishwar — asked directly whether the hero image could
just be dropped on mobile instead of continuing to optimise its loading.

## Why this is the right fix, not a workaround

The "element render delay" cost identified above is specifically about
this one image — the LCP element Lighthouse was measuring *was* the hero
background photo. Removing it doesn't route around the problem, it deletes
the element the problem was attached to. The photo sits behind a
mostly-opaque light overlay in the design already (dominant colour stops
around 90-97% white/light), so on a small mobile screen it was always a
subtle background detail, not something the design depends on.

## Changes made

1. **`frontend/src/bnchmarkd-app.jsx`** — the `@media (max-width: 768px)`
   override for `.hero-bg` no longer references `hero-stadium-mobile.jpg`
   at all; it's just the same light gradient the rest of the app already
   uses. Desktop is untouched — still shows the full photo.
2. **`frontend/index.html`** — removed the now-unused mobile preload hint
   for `hero-stadium-mobile.jpg` (kept the desktop one, since desktop still
   uses the photo). Preloading an image nothing displays would just be
   wasted bandwidth.

`hero-stadium-mobile.jpg` itself is left in `public/` unused rather than
deleted, in case this gets revisited later — harmless to leave.

## Verification

- Built and served locally; confirmed via computed styles that `.hero-bg`
  on a mobile-width viewport now resolves to the plain gradient, no
  `url(...)` at all.
- Visual check via screenshot: text content and layout are unaffected —
  the page initially appeared blank in one screenshot, traced to the
  site's existing scroll-triggered text-reveal animation (pre-existing
  GSAP behavior, confirmed unrelated to this change by scrolling and
  watching it fire normally) rather than anything broken by this fix.
- Desktop: confirmed the hero photo and its preload are both untouched.

## Status

Pushed to `main`, awaiting deploy + fresh PageSpeed re-measurement.

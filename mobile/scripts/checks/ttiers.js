// ═══════════════════════════════════════════════════════════════════════
// THE LADDER MEANS WHAT IT SAYS.
//
// The tier table shipped with its top three rungs three to seven tenths
// slow. It called 10.15 an Olympic Medalist standard in the men's 100m; the
// median of actual Olympic medalists in this project's own olympic_results
// table is 9.87, and one in five World-Athletics-listed senior men is faster
// than 10.15. A 10.33 club sprinter was being told he was nearly a medallist.
//
// Nothing caught it because nothing was checking. A number in a table is a
// claim, and a claim with a stated source can be tested against that source.
//
// Ground truth below is measured, not asserted:
//   Olympic finals 2000-2024 (public.olympic_results, round = 'Final')
//     men's 100m   medalists 1-3  median 9.87   finalists 4-8  median 9.96
//     women's 100m medalists 1-3  median 10.76  finalists 4-8  median 11.02
//   Published Paris-2024 entry standards: men 10.00, women 11.07
//
// Those four independent numbers are what fixed the percentile mapping the
// rest of the table now uses — Qualifier = p10 of the senior World Athletics
// season-best distribution, Finalist = p5, Medalist = p1, World Class = p0.2.
// The fit was inside five hundredths on every one of them.
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs'), path = require('path')
const MOBILE = path.join(__dirname, '..', '..')
const ts = require(path.join(MOBILE, 'node_modules', 'typescript'))

// Same shim the other harnesses use: these are ES modules importing each
// other without file extensions, which Node will not resolve on its own.
const loaded = {}
function load(name) {
  if (loaded[name]) return loaded[name]
  const src = fs.readFileSync(path.join(MOBILE, 'src', 'lib', `${name}.js`), 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText
  const m = { exports: {} }
  loaded[name] = m.exports
  new Function('exports', 'module', 'require', js)(
    m.exports, m, (r) => load(r.replace(/^\.\//, '')))
  loaded[name] = m.exports
  return m.exports
}

const { PERFORMANCE_LEVELS, isTimeDiscipline } = load('performanceLevels')
const { deriveTiers, TIER_NAMES } = load('performanceTiers')

let failures = 0, checks = 0
function check(name, ok, detail) {
  checks++
  if (ok) console.log(`  ok   ${name}`)
  else { failures++; console.log(`  FAIL ${name}`); if (detail) console.log(detail) }
}

const FIELD = ['Long Jump', 'Triple Jump', 'High Jump', 'Pole Vault',
               'Shot Put', 'Discus Throw', 'Hammer Throw', 'Javelin Throw']
const lowerIsBetter = (key) => !FIELD.some((f) => key.startsWith(f))

// ── 1. No two tiers share a threshold ────────────────────────────────
// A repeat means one of them can never be reached: the walk from the top
// finds the higher one first and the lower is dead. Five rows shipped like
// this, including 100m men's Senior, where 11.28 appeared twice.
{
  const bad = []
  for (const [key, groups] of Object.entries(PERFORMANCE_LEVELS)) {
    for (const [ag, cuts] of Object.entries(groups)) {
      const vals = cuts.filter((v) => v != null)
      const seen = new Set()
      for (const v of vals) {
        if (seen.has(v)) bad.push(`       ${key} ${ag}: ${v} appears twice`)
        seen.add(v)
      }
    }
  }
  check('no level row repeats a cut', bad.length === 0, bad.join('\n'))
}

// ── 2. Every row gets harder, monotonically ──────────────────────────
{
  const bad = []
  for (const [key, groups] of Object.entries(PERFORMANCE_LEVELS)) {
    const lower = lowerIsBetter(key)
    for (const [ag, cuts] of Object.entries(groups)) {
      for (let i = 1; i < cuts.length; i++) {
        if (cuts[i] == null || cuts[i - 1] == null) continue
        const harder = lower ? cuts[i] < cuts[i - 1] : cuts[i] > cuts[i - 1]
        if (!harder) bad.push(`       ${key} ${ag} L${i} → L${i + 1}: ${cuts[i - 1]} → ${cuts[i]}`)
      }
    }
  }
  check('every level row rises in difficulty', bad.length === 0, bad.join('\n'))
}

// ── 3. Rows are the right length ─────────────────────────────────────
{
  const bad = []
  for (const [key, groups] of Object.entries(PERFORMANCE_LEVELS)) {
    for (const [ag, cuts] of Object.entries(groups)) {
      if (cuts.length !== 12) bad.push(`       ${key} ${ag}: ${cuts.length} entries, expected 12`)
    }
  }
  check('every level row carries 12 entries', bad.length === 0, bad.join('\n'))
}

// ── 4. The Olympic tiers match the Olympics ──────────────────────────
// Measured medians, and the tolerance a tier cut is allowed to drift before
// the name on it stops being true.
const TRUTH = [
  { key: '100m', sex: 'M', tier: 6, name: 'Medalist', truth: 9.87,  tol: 0.10 },
  { key: '100m', sex: 'M', tier: 5, name: 'Finalist', truth: 9.96,  tol: 0.10 },
  { key: '100m', sex: 'F', tier: 6, name: 'Medalist', truth: 10.76, tol: 0.12 },
  { key: '100m', sex: 'F', tier: 5, name: 'Finalist', truth: 11.02, tol: 0.12 },
  // Published Olympic entry standards, Paris 2024.
  { key: '100m', sex: 'M', tier: 4, name: 'Qualifier', truth: 10.00, tol: 0.10 },
  { key: '100m', sex: 'F', tier: 4, name: 'Qualifier', truth: 11.07, tol: 0.12 },
]
for (const t of TRUTH) {
  const cuts = deriveTiers(t.key, t.sex, 'Senior')
  const got = cuts && cuts[t.tier - 1]
  const off = got == null ? null : Math.abs(got - t.truth)
  check(
    `${t.key} ${t.sex} T${t.tier} ${TIER_NAMES[t.tier]} is within ${t.tol} of the measured ${t.name.toLowerCase()} standard`,
    off != null && off <= t.tol,
    got == null
      ? '       no cut derived'
      : `       table says ${got}, measured ${t.truth}, off by ${off.toFixed(3)}`,
  )
}

// ── 5. A tier named after the Olympics is not slower than the field ──
// The sanity check the old table would have failed outright: a Medalist cut
// must be at least as hard as a Finalist cut, which must beat Qualifier.
{
  const bad = []
  for (const key of Object.keys(PERFORMANCE_LEVELS)) {
    const [disc, sex] = [key.slice(0, key.lastIndexOf('_')), key.slice(-1)]
    const cuts = deriveTiers(disc, sex, 'Senior')
    if (!cuts) continue
    const lower = lowerIsBetter(key)
    for (let i = 4; i <= 6; i++) {
      const a = cuts[i - 1], b = cuts[i]
      if (a == null || b == null) continue
      const harder = lower ? b < a : b > a
      if (!harder) bad.push(`       ${key}: T${i} ${a} → T${i + 1} ${b}`)
    }
  }
  check('Qualifier → Finalist → Medalist → World Class always gets harder', bad.length === 0, bad.join('\n'))
}


// ── 6. Two ramps, and each one legible where it is used ──────────────
// ── The ladder covers the field ──────────────────────────────────────
// T4-T7 were recalibrated from public.season_bests (World Athletics season
// bests, ages 20-32) — Qualifier = p10, Finalist = p5, Medalist = p1, World
// Class = p0.2. T1-T3 were left as the old award-standard ladder. Nobody
// checked whether the two halves met. They did not.
//
// Measured 2 Sep 2026 against reference.results — career bests, outdoor,
// status OK, one row per athlete — the men's 200m ladder (n=1070) read:
//
//     T1 23.78 → 99.3% of careers at or better
//     T2 22.98 → 97.7          three rungs across the top 4%
//     T3 22.58 → 95.9
//     T4 20.25 → 17.5          ← ONE rung across 78% of the field
//     T5 20.07 →  9.5
//     T6 19.77 →  2.5
//     T7 19.48 →  0.5
//
// All forty Senior rows had that shape, at the same rung. An athlete inside
// the step could not move: Keenan's 20.75 sat 1.83s clear of the tier below
// and 0.50 short of the one above, and the app called it "National".
//
// The fix continues the EXISTING percentile ladder downward in the SAME
// distribution rather than inventing a second one — T3 = p40 and T2 = p70 of
// season_bests, ages 20-32, direction from lower_better. T1 is untouched: it
// is an entry standard from Keenan's spreadsheet and the join with the U20
// ladder, and season_bests has no club athletes to place it against (its
// slowest 1% of senior men's 100m is 11.31, already faster than T1's 11.68).
//
// So the T1→T2 step is the one remaining discontinuity, and it is a product
// question rather than a bug: in the marathon it runs 3:30:00 to 2:16:34.
//
// 3000m M/F are the two rows not on this basis. season_bests holds no plain
// 3000m — only the steeplechase — so those two keep cuts derived the same way
// from reference.results career bests.
//
// This check is a snapshot and says so. It cannot reach the database, so it
// pins the two events that also have independent ground truth above. If the
// data moves these, re-run the measurement and update the numbers — do not
// widen the tolerance.
{
  const { PERFORMANCE_LEVELS } = load('performanceLevels')
  const SENIOR_IDX = [0, 2, 4, 7, 9, 10, 11]
  const cutsFor = (key) => SENIOR_IDX.map((i) => PERFORMANCE_LEVELS[key].Senior[i])

  // [cut, percentile of season_bests 20-32 it was taken at]. T1 is not from
  // this distribution, so it carries null.
  const PINNED = {
    '200m_M': [[23.78, null], [21.20, 70], [20.71, 40], [20.25, 10], [20.07, 5], [19.77, 1], [19.48, 0.2]],
    '100m_M': [[11.68, null], [10.48, 70], [10.22, 40], [10.03, 10], [9.97, 5], [9.84, 1], [9.76, 0.2]],
  }
  for (const [key, expect] of Object.entries(PINNED)) {
    const got = cutsFor(key)
    const wrong = expect
      .map(([v], i) => (Math.abs(got[i] - v) > 0.005 ? `       T${i + 1}: table ${got[i]}, measured ${v}` : null))
      .filter(Boolean)
    check(`${key} sits where season_bests was measured`, wrong.length === 0, wrong.join('\n'))

    // The point of the whole exercise: no rung inside the calibrated range
    // may swallow the field. T1 is excluded — it is off this distribution.
    const p = expect.map(([, q]) => q).filter((q) => q != null)
    const worst = Math.max(...p.slice(1).map((q, i) => p[i] - q))
    check(`no calibrated ${key} rung spans more than a third of the field`, worst <= 33.4,
      `       widest rung covers ${worst.toFixed(1)}% of season bests` +
      `\n       (before this fix the men's 200m T3→T4 rung covered 78.4% of careers)`)
  }

  // Universal, and true of any ladder: it runs one way. The whole array, not
  // just the rungs the tiers read — L2, L4, L6 and L7 are unused by
  // deriveTiers, and precisely because nothing reads them they are where an
  // edit leaves values pointing backwards.
  const nonMono = []
  for (const [key, groups] of Object.entries(PERFORMANCE_LEVELS)) {
    const row = groups.Senior
    if (!row || row.some((v) => v == null)) continue
    const up = row.every((v, i) => i === 0 || v > row[i - 1])
    const down = row.every((v, i) => i === 0 || v < row[i - 1])
    if (!up && !down) nonMono.push(`       ${key}`)
  }
  check('every Senior ladder runs one way', nonMono.length === 0, nonMono.join('\n'))
}

// TIER_COLORS is a FILL ramp: intensity carries tier on a dark surface.
// It was also being used as a TEXT colour, and over the stadium backdrop
// "QUALIFIER" in TIER_COLORS[4] measured 1.00:1 — glyph and ground both at
// L=0.129, the same colour to three decimals. TIER_INK exists so a tier can
// be a word without becoming invisible.
{
  const { TIER_COLORS, TIER_INK } = load('performanceTiers')
  const lum = (hex) => {
    const v = (i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * v(1) + 0.7152 * v(3) + 0.0722 * v(5)
  }
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  const PANEL = lum('#171935')          // colors.glass.bg, what text sits on

  const inkKeys = Object.keys(TIER_INK)
  check('there is a text ramp for every tier', inkKeys.length === Object.keys(TIER_COLORS).length,
    `       ink has ${inkKeys.length}, fills have ${Object.keys(TIER_COLORS).length}`)

  const weak = inkKeys
    .map((k) => [k, ratio(lum(TIER_INK[k]), PANEL)])
    .filter(([, r]) => r < 4.5)
  check('every TIER_INK step clears 4.5:1 on a panel', weak.length === 0,
    weak.map(([k, r]) => `       T${k}: ${r.toFixed(2)}:1`).join('\n'))

  // And the reason the second ramp had to exist, asserted so nobody
  // "simplifies" it back to one.
  const fillsFailing = Object.keys(TIER_COLORS)
    .filter((k) => ratio(lum(TIER_COLORS[k]), PANEL) < 4.5)
  check('TIER_COLORS is still a fill ramp, i.e. NOT safe as text',
    fillsFailing.length > 0,
    '       every fill colour passes as text — if that is deliberate the two\n'
    + '       ramps can merge, but check a photograph first: none of them\n'
    + '       cleared AA over the backdrop.')
}

console.log(`\n${failures === 0 ? 'all passed' : failures + ' of ' + checks + ' checks failed'}`)
process.exit(failures === 0 ? 0 : 1)

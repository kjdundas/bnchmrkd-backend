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

console.log(`\n${failures === 0 ? 'all passed' : failures + ' of ' + checks + ' checks failed'}`)
process.exit(failures === 0 ? 0 : 1)

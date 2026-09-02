// ═══════════════════════════════════════════════════════════════════════
// A RESULT AWAITING A COACH IS NOT A BROKEN RESULT.
//
// Keenan logged a 200m, his coach had not approved it yet, and three screens
// disagreed about what had happened. None of them said the true thing.
//
//   Trajectory   "1 RACE · PB Infinity · BELOW EMERGING"
//   Home         "47.00s · New personal best", dated the day before
//   Coach        20.75s, National, 58th percentile — correct
//
// Neither 47.00 nor Infinity was in the database. Both were computed:
//
//   Infinity   the discipline card counted `marks.length` (ungated) for
//              "1 race" and took its PB from the countable subset, which was
//              empty. `Math.min()` of nothing is Infinity, and Infinity is
//              below every tier cut, so the card also said BELOW EMERGING.
//
//   47.00      Home resolved the discipline, the PB and the race list from
//              three independent expressions. The discipline came from the
//              performances table ('200m'); no race counted, so the PB fell
//              through to a physical-metric bridge and picked up cmj_height —
//              a 47cm countermovement jump — which the bridge mapped to High
//              Jump. A jump height in centimetres, printed as seconds,
//              against a 200m tier band.
//
// The gate was right. `countsForAnalysis` excluding a pending result is the
// correct behaviour and is not what this file argues with. What was missing
// was anything that SAID SO — so both screens fell through to whatever their
// arithmetic produced on an empty list, and the athlete's own reading was
// that the app had lost his race.
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs'), path = require('path')
const MOBILE = path.join(__dirname, '..', '..')
const ts = require(path.join(MOBILE, 'node_modules', 'typescript'))

let failures = 0, checks = 0
function check(name, ok, detail) {
  checks++
  if (ok) console.log(`  ok   ${name}`)
  else { failures++; console.log(`  FAIL ${name}`); if (detail) console.log(detail) }
}

const loaded = {}
function load(rel) {
  if (loaded[rel]) return loaded[rel]
  const full = path.join(MOBILE, 'src', rel)
  const file = fs.existsSync(full + '.ts') ? full + '.ts' : full + '.js'
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText
  const m = { exports: {} }
  loaded[rel] = m.exports
  new Function('exports', 'module', 'require', js)(
    m.exports, m, (r) => load(path.join(path.dirname(rel), r)))
  Object.assign(loaded[rel], m.exports)
  return loaded[rel]
}

const { countsForAnalysis, partitionResults, isPending } = load('lib/resultSemantics')

// Keenan's row, as it stood before his coach answered.
const PENDING_200 = {
  discipline: '200m', mark: '20.75', status: 'OK', approval: 'pending',
  competition_date: '2026-09-02', wind_mps: 0.4,
}
const ACCEPTED_100 = {
  discipline: '100m', mark: '10.33', status: 'OK', approval: 'accepted',
  competition_date: '2026-08-28',
}

// ── The gate still holds ─────────────────────────────────────────────
check('a pending result does not count', !countsForAnalysis(PENDING_200, '200m'))
check('an accepted result does count', countsForAnalysis(ACCEPTED_100, '100m'))
check('a pending result is still recognisably pending', isPending(PENDING_200))

// ── And the screens can now see both halves ──────────────────────────
{
  const { counted, awaiting } = partitionResults([PENDING_200], '200m')
  check('the only race, pending: nothing counts and one is awaiting',
    counted.length === 0 && awaiting.length === 1)

  // The exact shape that produced Infinity.
  const values = counted.map((m) => parseFloat(m.mark)).filter(Number.isFinite)
  const pb = values.length ? Math.min(...values) : null
  check('an empty countable set yields a null PB, not Infinity',
    pb === null, `       got ${pb}`)
  check('the race count matches the set the PB came from',
    counted.length === values.length)
}

// A pending DNF is still a DNF — promising it will become a PB would be a lie.
{
  const { counted, awaiting } = partitionResults(
    [{ discipline: '200m', mark: null, status: 'DNF', approval: 'pending' }], '200m')
  check('a pending DNF is neither counted nor promised',
    counted.length === 0 && awaiting.length === 0)
}

// Wind-assisted is excluded by the gate, and it is not "awaiting" either —
// approving it will not make it legal.
{
  const { counted, awaiting } = partitionResults(
    [{ discipline: '100m', mark: '10.11', status: 'OK', approval: 'accepted', wind_mps: 3.1 }], '100m')
  check('a wind-assisted mark is excluded without being called pending',
    counted.length === 0 && awaiting.length === 0)
}

// ── The bridge only claims what it can measure ───────────────────────
// The map that turned a 47cm countermovement jump into a 47.00-second 200m.
{
  const src = fs.readFileSync(path.join(MOBILE, 'src', 'screens', 'HomeScreen.tsx'), 'utf8')
  const m = src.match(/const METRIC_TO_DISCIPLINE[^=]*=\s*\{([\s\S]*?)\n\}/)
  const keys = m ? [...m[1].matchAll(/^\s*(\w+):/gm)].map((x) => x[1]) : []
  const banned = keys.filter((k) => /jump|cmj|sj_|flying|split/.test(k))
  check('no gym test is bridged to a competition discipline', banned.length === 0,
    banned.map((k) => `       ${k} — a rig reading, not a race result`).join('\n'))

  // And the discipline, PB and race list must be resolved together. Three
  // independent expressions is how '200m' met a High Jump metric.
  check('Home resolves discipline, PB and races from one decision',
    /const useMetricBridge = /.test(src)
    && /const competitionPb = useMetricBridge \? metricDerived\.pb : perfPb/.test(src)
    && /const races = useMetricBridge \? metricDerived\.races : perfRaces/.test(src),
    '       the metric bridge must be all-or-nothing — see HomeScreen')
}

// ── And somebody has to say it out loud ──────────────────────────────
for (const [file, needle, what] of [
  ['components/ApprovalInbox.tsx', /awaiting approval from your coach/, 'the athlete is told who it is waiting on'],
  ['screens/HomeScreen.tsx', /<AwaitingApproval/, 'Home renders it'],
  ['screens/TrajectoryScreen.tsx', /Awaiting coach approval/, 'the discipline card says it instead of a tier'],
]) {
  check(what, needle.test(fs.readFileSync(path.join(MOBILE, 'src', file), 'utf8')))
}

console.log(`\n${failures === 0 ? 'all passed' : failures + ' of ' + checks + ' checks failed'}`)
process.exit(failures === 0 ? 0 : 1)

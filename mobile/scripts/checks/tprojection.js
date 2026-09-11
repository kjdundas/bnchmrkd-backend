// ═══════════════════════════════════════════════════════════════════════
// THE PROJECTION HAD TO AGREE WITH ITSELF.
//
// Three faults in one card, found by looking at a 14-year-old javelin
// thrower and a 27-year-old 400m runner on a coach's phone.
//
//   1. A DEAD FLAT LINE BEFORE THE TABLE STARTS
//      projectPerformance extrapolated a missing year from `Math.max` of
//      every age BELOW it. For an athlete younger than the table's first
//      entry there are none; Math.max() of [] is -Infinity, the guarded
//      branch never ran, and `projected` was left untouched. The Female
//      javelin table starts at 16, so a 14-year-old's median path sat
//      exactly on her PB until 16 and then jumped. On the chart that is a
//      horizontal dash going nowhere, which is what "the predictor doesn't
//      make sense" looks like.
//
//   2. A SENTENCE QUOTING A NUMBER THE CHART REFUSES TO DRAW
//      The card computed its peak over the whole projection — which runs to
//      age 35 — while ProjectionChart clips at five years and explains in
//      its own footnote why. "You'd peak around 37.35m at age 23" was
//      printed under an axis whose last tick read age 19.
//
//   3. TWO HALVES DRAWN AS TWO CHARTS
//      The raced marks ended in mid-air and the dashed projection began
//      somewhere else, with nothing between them and no statement of where
//      the projection was anchored.
//
// Plus the Similar Athletes card, which read seven fields off a shape that
// has not existed since find_similar_athletes was dropped — every one
// undefined, rendering five grey "?" avatars with blank names, and throwing
// nothing. And "Race Log" over a hammer thrower's five throws.
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
const src = (rel) => fs.readFileSync(path.join(MOBILE, 'src', rel), 'utf8')

// Comments are where a fix EXPLAINS the bug it fixed, so they legitimately
// quote the dead field names and the dead copy. Checks that assert a string
// is gone must look at the code, or they fail on their own explanation.
const code = (rel) => src(rel)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const { projectPerformance, getImprovementCurves } = load('lib/improvementCurves')
const { eventNoun, countEvents, isLowerBetter } = load('lib/disciplineScience')

// ── 1. Below the table ───────────────────────────────────────────────
// Amara Nwosu, 14, Javelin Throw, PB 30.62m — the demo athlete on the
// screenshot. The Female steady table starts at 16.
{
  const curves = getImprovementCurves('Javelin Throw', 'Female')
  const firstAge = Math.min(...Object.keys(curves.steady.rates).map(Number))
  check('the javelin table really does start above 14', firstAge > 14,
    `       first rate is at age ${firstAge}`)

  const pts = projectPerformance(30.62, 14, 'Javelin Throw', 'Female', 'steady', 24)
  const at = (a) => pts.find((p) => p.age === a)

  check('the projection is anchored on the PB at the athlete\'s own age',
    at(14) && at(14).projected === 30.62)

  // The whole bug, in one assertion.
  check('the year before the table starts is not flat',
    at(15).projected > at(14).projected,
    `       age 14 ${at(14).projected}m -> age 15 ${at(15).projected}m`)
  check('nor is any year between here and the table',
    pts.filter((p) => p.age > 14 && p.age <= firstAge)
       .every((p, i, all) => i === 0 || p.projected > all[i - 1].projected))

  // Strictly monotonic while every rate in the table is positive. Javelin
  // Female steady turns negative at 27, so 24 is a safe ceiling.
  const rising = pts.every((p, i) => i === 0 || p.projected >= pts[i - 1].projected)
  check('the median path rises throughout the developing years', rising)

  // And the corridor still brackets it, in the right direction for a throw.
  check('the band brackets the median for a field event',
    pts.every((p) => p.p25 <= p.projected + 1e-9 && p.projected <= p.p75 + 1e-9),
    pts.filter((p) => !(p.p25 <= p.projected + 1e-9 && p.projected <= p.p75 + 1e-9))
       .map((p) => `       age ${p.age}: ${p.p25} / ${p.projected} / ${p.p75}`).join('\n'))
  check('a javelin throw is scored higher-is-better', !isLowerBetter('Javelin Throw'))
}

// ── 2. Inside the table, nothing moved ───────────────────────────────
// The fix must not touch an athlete whose ages the table already covers.
{
  const inside = projectPerformance(10.99, 17, '100m', 'Male', 'steady', 22)
  const curves = getImprovementCurves('100m', 'Male')
  const covered = inside.slice(1).every((p) => curves.steady.rates[p.age] !== undefined)
  check('a 17-year-old sprinter sits inside the table', covered)
  check('and still projects forward', inside[inside.length - 1].projected < 10.99)
  check('a 100m is scored lower-is-better', isLowerBetter('100m'))
}

// ── 3. Past the table, the decay survives ────────────────────────────
{
  const curves = getImprovementCurves('100m', 'Male')
  const lastAge = Math.max(...Object.keys(curves.steady.rates).map(Number))
  const far = projectPerformance(10.20, lastAge - 1, '100m', 'Male', 'steady', lastAge + 6)
  const steps = far.slice(1).map((p, i) => Math.abs(p.projected - far[i].projected))
  const beyond = far.filter((p) => p.age > lastAge)
  check('the projection still runs past the last tabulated age', beyond.length > 0)
  check('and the year-on-year step shrinks once extrapolating',
    steps[steps.length - 1] <= steps[steps.length - 2] + 1e-9,
    `       last two steps: ${steps.slice(-2).map((x) => x.toFixed(4)).join(' then ')}`)
}

// ── 4. The sentence and the chart use one horizon ────────────────────
{
  const chart = src('components/ProjectionChart.tsx')
  const card = src('components/ImprovementScenarios.tsx')
  check('the chart exports its horizon', /export const HORIZON_YEARS = \d+/.test(chart))
  check('the card imports it rather than guessing',
    /import ProjectionChart, \{ HORIZON_YEARS/.test(card))
  check('the peak is taken from the window that was drawn',
    /const drawn = \(line \|\| \[\]\)\.filter\(\(p: any\) => p\.age <= windowEnd\)/.test(card)
    && /const peak = peakOf\(drawn\)/.test(card),
    '       peakOf(line) reaches to age 35; the chart clips at five years')
  check('a peak that is simply today is said differently',
    /peakIsNow/.test(card) && /did not improve on it/.test(card),
    '       a 27-year-old was told he would "peak" at his current age')
  check('a projected mark is only graded inside the athlete\'s own age group',
    /peakGroup === nowGroup/.test(card)
    && /tierName !== 'Below Emerging'/.test(card),
    '       a U15 girl\'s 500g javelin was graded against senior 600g cuts')
}

// ── 4b. One source, one story ────────────────────────────────────────
{
  const card = src('components/ImprovementScenarios.tsx')
  check('the corridor edges are normalised before the chart sees them',
    /p25: lowerIsBetter \? b\.p75 : b\.p25/.test(card)
    && /p75: lowerIsBetter \? b\.p25 : b\.p75/.test(card),
    '       the curves return percentiles of the RATE (p75 = best); the corpus\n'
    + '       returns percentiles of the MARK (p75 = slow, for a track event).\n'
    + '       Every track athlete had the two edges labelled backwards.')
  check('the footnote is keyed to the source that was actually drawn',
    /const usingCorpus = !!\(fromCorpus && fromCorpus\.length >= 2\)/.test(card)
    && /const line = usingCorpus \? fromCorpus/.test(card)
    && /\{usingCorpus\n/.test(card),
    '       a one-row band drew the CURVES under a paragraph describing the corpus')
}

// ── 5. The two halves are joined, and the margin is legible ──────────
{
  const chart = src('components/ProjectionChart.tsx')
  check('the chart states where the projection is anchored',
    /const carry = best/.test(chart) && /geom\.carry && \(/.test(chart),
    '       raced marks ended in mid-air, the dashed line began elsewhere')
  check('the history is guaranteed a readable share of the axis',
    /const minHistorySpan = /.test(chart),
    '       one season against a five-year projection was a 4%-wide scribble')
  check('right-gutter labels are placed, not stacked',
    /const placeLabel = /.test(chart) && /Math\.abs\(g\.y - y\) < 9/.test(chart),
    '       "PB" printed through "30.62m" when the two lines coincided')
  check('the old hard-coded gutter labels are gone',
    !/y=\{Y\(geom\.endBest\) \+ 3\}/.test(chart) && !/>\s*PB\s*<\/SvgText>/.test(chart))
  check('axis captions are suppressed when they would collide',
    /const showNow = /.test(chart) && /const showPeak = /.test(chart),
    '       "age 14" and "now" were printed on top of each other')
}

// ── 6. Similar Athletes reads the shape it is actually given ─────────
{
  const fa = src('components/FullAnalysis.tsx')
  const corpus = src('lib/corpus.ts')

  // Whatever SimilarAthlete carries, the card must read those names.
  const declared = [...corpus.matchAll(/^\s{2}(\w+)[?]?:/gm)].map((m) => m[1])
  for (const f of ['athlete', 'nationality', 'matchedAge', 'atYourAge', 'bestSameEvent'])
    check(`SimilarAthlete still carries ${f}`, declared.includes(f))

  check('the card reads athlete, not athlete_name',
    /a\.athlete\b/.test(fa) && !/a\.athlete_name/.test(fa))
  const faCode = code('components/FullAnalysis.tsx')
  const stale = ['athlete_name', 'pb_time', 'closest_age', 'time_at_similar_age',
    'peak_age', 'classification', 'a.country']
    .filter((k) => faCode.includes(k))
  check('no field of the retired RPC survives in the card', stale.length === 0,
    stale.map((k) => `       ${k} — find_similar_athletes is gone`).join('\n'))
  check('the state is typed so the next rename breaks the build',
    /useState<SimilarAthlete\[\]>\(\[\]\)/.test(fa))
  check('the editorial names read the same field',
    /String\(s\.athlete \|\| ''\)/.test(fa))
}

// ── 7. Throwers do not race ──────────────────────────────────────────
{
  check('a throw is a throw', eventNoun('Hammer Throw').many === 'throws')
  check('a jump is a jump', eventNoun('Long Jump').many === 'jumps')
  check('a 200m is still a race', eventNoun('200m').many === 'races')
  check('a decathlon is neither', eventNoun('Decathlon').many === 'competitions')
  check('one of them is singular', countEvents(1, 'Javelin Throw') === '1 throw')
  check('five of them are not', countEvents(5, 'Javelin Throw') === '5 throws')

  const detail = src('screens/AthleteDetailScreen.tsx')
  check('the log heading is event-neutral', /Competition Log/.test(detail)
    && !/>Race Log</.test(detail))
  check('the header count speaks the event', /heroStatLabel}>\{noun\.many\}/.test(detail))
  check('the season rows count the right thing', /countEvents\(sb\.count/.test(detail))
  check('and so does the overflow line', !/more races/.test(detail))

  const banned = [
    ['screens/AthleteDetailScreen.tsx', /Race Log|more races|>Races</],
    ['screens/CoachRosterScreen.tsx', /Total Races/],
    ['components/OuraSections.tsx', /Every race|Log a race result/],
    ['components/ProjectionChart.tsx', />Your races</],
    ['components/DaySchedule.tsx', /\|\| 'Race'/],
  ]
  for (const [file, re] of banned)
    check(`no sprinter-only copy left in ${path.basename(file)}`, !re.test(code(file)),
      `       matched ${re}`)
}

console.log(`\n${failures === 0 ? 'all passed' : failures + ' of ' + checks + ' checks failed'}`)
process.exit(failures === 0 ? 0 : 1)

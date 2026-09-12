// ═══════════════════════════════════════════════════════════════════════
// WHAT LEAVES THE DEVICE, AND WHAT HAPPENS WHEN A CHILD SAYS SOMETHING
// FRIGHTENING.
//
// Two findings from auditing the assistant before juniors were let in.
//
//   1. NAMES WERE GOING TO OPENAI
//      The assistant and the programme generator both posted the athlete's
//      real name alongside their age, their biological maturity estimate,
//      their test scores and their results. For a coach, the whole squad —
//      several named children per request, to a third-party US provider.
//      None of it needed: the model does not need to know she is called
//      Amara Nwosu to write her a javelin block.
//
//   2. NOTHING HANDLED DISCLOSURE
//      The codebase contained no occurrence of "self-harm", "suicide",
//      "crisis", "helpline" or "moderation". The prompt was careful about
//      what the assistant should not ADVISE and silent on what it should DO
//      when a thirteen-year-old types that they want to hurt themselves.
//
// The first is verifiable by running the code, which is what most of this
// file does — a name that reaches the request body is a failure, not a
// style question.
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs'), path = require('path')
const MOBILE = path.join(__dirname, '..', '..')
const REPO = path.join(MOBILE, '..')
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
const code = (rel) => src(rel)
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
const py = (rel) => fs.readFileSync(path.join(REPO, 'backend', rel), 'utf8')

const { pseudonymise, rehydrate, rehydrateDeep } = load('lib/pseudonyms')

// ── 1. A real squad, run through the real function ───────────────────
// Shaped exactly like CoachHomeScreen's payload.
const SQUAD = {
  squad: 'Sprints',
  athletes: [
    { name: 'Amara Nwosu', events: ['Javelin Throw'], age: 14, has_account: true,
      results: [{ event: 'Javelin Throw', mark: 30.62, date: '2026-05-02' }] },
    { name: 'Salma ALMARRI', events: ['Hammer Throw'], age: 18, has_account: false,
      results: [{ event: 'Hammer Throw', mark: 55.42, date: '2026-05-28' }] },
    { name: 'Emmanuel BAMIDELE', events: ['400m'], age: 27, has_account: true, results: [] },
  ],
}
const REAL_NAMES = ['Amara Nwosu', 'Salma ALMARRI', 'Emmanuel BAMIDELE',
  'Amara', 'Nwosu', 'ALMARRI', 'BAMIDELE']

{
  const { context, names } = pseudonymise(SQUAD)
  const wire = JSON.stringify(context)

  const leaked = REAL_NAMES.filter((n) => wire.includes(n))
  check('no athlete name survives into the request body', leaked.length === 0,
    leaked.map((n) => `       "${n}" is still in the payload`).join('\n'))

  check('every athlete got a token',
    context.athletes.every((a) => /^Athlete-\d+$/.test(a.name)),
    '       ' + context.athletes.map((a) => a.name).join(', '))
  check('three athletes, three tokens', names.size === 3)

  // The data the model actually needs must survive intact.
  check('the training data is untouched',
    context.athletes[0].age === 14
    && context.athletes[0].events[0] === 'Javelin Throw'
    && context.athletes[0].results[0].mark === 30.62,
    '       stripping the name must not strip the block')
  check('the caller\'s object is not mutated', SQUAD.athletes[0].name === 'Amara Nwosu',
    '       context is usually a memoised value the screen still renders from')
}

// ── 2. The coach reads real names again ──────────────────────────────
{
  const { names } = pseudonymise(SQUAD)
  const modelSaid =
    'Athlete-1 is improving quickly for her age. Athlete-3 has plateaued since June, '
    + 'and Athlete-2 has one result only.'
  const shown = rehydrate(modelSaid, names)
  check('tokens are replaced with the real names on the way back',
    shown.includes('Amara Nwosu') && shown.includes('Salma ALMARRI')
    && shown.includes('Emmanuel BAMIDELE'),
    `       got: ${shown}`)
  check('and no token is left showing', !/Athlete-\d/.test(shown), `       got: ${shown}`)
}

// ── 3. A generated programme names the athlete in several fields ─────
{
  const { context, names } = pseudonymise({
    name: 'Amara Nwosu', discipline: 'Javelin Throw', age: 14, maturity: { stage: 'pre' },
  })
  check('a single athlete is tokenised too', context.name === 'Athlete-1')
  const program = {
    title: 'Athlete-1 — pre-season javelin',
    summary: 'A four-week block for Athlete-1.',
    sessions: [{ label: 'Monday', notes: 'Athlete-1 should keep loads technical.' }],
  }
  const out = rehydrateDeep(program, names)
  check('every string in the returned programme is rehydrated',
    out.title.includes('Amara Nwosu')
    && out.summary.includes('Amara Nwosu')
    && out.sessions[0].notes.includes('Amara Nwosu'),
    '       the name appears in the title, the summary and the session notes')
  check('and nothing else in it changed', out.sessions[0].label === 'Monday')
}

// ── 4. An exercise called "name" is not a person ─────────────────────
// The walk keys off person-markers precisely so a gym exercise keeps its own
// name. A programme where every lift became "Athlete-4" would be worthless.
{
  const { context } = pseudonymise({
    name: 'Amara Nwosu', age: 14, discipline: 'Javelin Throw',
    blocks: [{ name: 'Max strength', exercises: [{ name: 'Back squat', prescription: '4 × 4' }] }],
  })
  check('the athlete is tokenised', context.name === 'Athlete-1')
  check('but an exercise keeps its name',
    context.blocks[0].exercises[0].name === 'Back squat'
    && context.blocks[0].name === 'Max strength',
    '       a block of lifts all called "Athlete-2" is not a programme')
}

// ── 5. It is applied where it cannot be forgotten ────────────────────
{
  const api = code('lib/api.ts')
  check('askAssistant pseudonymises inside the API layer',
    /const \{ context, names \} = pseudonymise\(input\.context/.test(api),
    '       at a call site it is a rule enforced by remembering')
  check('and rehydrates what comes back', /return rehydrate\(String\(answer/.test(api))
  check('programme generation goes through the same layer',
    /export async function generateProgram/.test(api)
    && /rehydrateDeep\(body, names\)/.test(api))

  const programs = code('screens/ProgramsScreen.tsx')
  check('the screen no longer posts to the endpoint itself',
    !/assistant\/program/.test(programs) && /generateProgram\(payload\)/.test(programs),
    '       a raw fetch is how one of two call sites loses a protection')

  // Nothing anywhere may hand a raw context to the network.
  const raw = ['screens/CoachHomeScreen.tsx', 'components/AssistantCoachBox.tsx']
    .filter((f) => /fetch\(`\$\{API_BASE\}\/api\/v1\/assistant/.test(code(f)))
  check('no screen calls the assistant endpoint directly', raw.length === 0,
    raw.map((f) => `       ${f}`).join('\n'))
}

// ── 6. The safeguarding rules exist, and apply to both personas ──────
{
  const routes = py('app/api/assistant_routes.py')
  const foundation = routes.slice(routes.indexOf('_FOUNDATION = '), routes.indexOf('_SYSTEM_COACH'))

  check('safeguarding is in the SHARED foundation, not one persona',
    /SAFEGUARDING \(overrides everything above\)/.test(foundation),
    '       a coach asking on behalf of a child needs the same rules')
  for (const [needle, what] of [
    [/self-harm, suicidal\s+thoughts, abuse/, 'disclosure is named explicitly'],
    [/Do NOT assess, diagnose, or ask probing questions/, 'it does not try to triage'],
    [/NEVER give coping techniques that use pain, cold or physical shock/,
      'no pain-based coping techniques'],
    [/parent or carer, coach, teacher, or doctor/, 'it points at a real adult'],
    [/rather than naming a helpline for the\s+wrong country/,
      'it does not give a US number to a child in Dubai'],
    [/FOOD, WEIGHT AND BODIES \(no exceptions, any age\)/, 'food and weight rules exist'],
    [/never comment on how an athlete's body looks/, 'no body commentary'],
    [/Do not offer a "healthier" version of the restriction/,
      'restriction is not negotiated down'],
    [/never a verdict on a person/, 'a mark is not a verdict'],
    [/Never claim to be a human, a doctor, a physio, a psychologist/,
      'it does not claim to be a person'],
  ]) check(what, needle.test(foundation))
}

// ── 7. Moderation gates the athlete path, both directions ───────────
{
  const routes = py('app/api/assistant_routes.py')
  const safety = py('app/core/safety.py')

  check('athlete input is moderated before the model sees it',
    /if req\.role == "athlete":\s*\n\s*hits = check_athlete_message\(req\.question\)/.test(routes))
  check('a flagged message never reaches the coaching model',
    /return AssistantResponse\(answer=SAFE_REPLY\)/.test(routes))
  check('the answer is moderated on the way out too',
    /out_hits = flagged_categories\(answer\)/.test(routes),
    '       an innocuous question can still draw an unsafe answer')
  check('the coach path is not hard-gated',
    /A coach writing "I'm worried about/.test(routes),
    '       refusing to discuss a safeguarding concern with the responsible\n'
    + '       adult obstructs the thing this is for')

  check('self-harm categories are the ones that stop it',
    /"self-harm",/.test(safety) && /"self-harm\/intent"/.test(safety)
    && /"sexual\/minors"/.test(safety))
  check('the reply names no specific helpline',
    !/\b\d{3}[- ]?\d{3,4}\b/.test(safety),
    '       athletes here are in the UAE, the UK, Costa Rica and Nigeria')
  check('the reply does not end by returning to training',
    /Nothing about your training matters more/.test(safety))
  check('flagged content is never written to the log',
    /content not logged/.test(safety),
    '       an app log is not built to hold what a child wrote about self-harm')
  check('the fail-open choice is stated, not buried',
    /FAILS OPEN, on purpose/.test(safety))
}

// ── 8. The policy says what the code does ───────────────────────────
// Read from the branch off origin/main where the policy actually lives; the
// mobile branch is behind it. Skipped rather than failed when absent.
{
  const wt = path.join(REPO, '..', '_ai-policy-wt',
    'frontend/src/components/legal/PrivacyPolicy.jsx')
  if (!fs.existsSync(wt)) {
    console.log('  --   privacy policy checks skipped (worktree not present)')
  } else {
    const pol = fs.readFileSync(wt, 'utf8')
    check('the policy names all three AI features',
      /AI Scanner:/.test(pol) && /Assistant:/.test(pol)
      && /Training programme generator:/.test(pol))
    check('it states that names are removed', /names are removed before any of this is sent/.test(pol))
    check('it gives the retention period, not just the no-training claim',
      /up to 30 days for abuse monitoring/.test(pol))
    check('it says the assistant is not a counselling service',
      /not a counselling,\s+medical or nutrition service/.test(pol)
      || /not a medical, psychological or nutritional service/.test(pol))
    check('the minors section cross-references it',
      /A minor's training data may be sent to OpenAI/.test(pol))
  }
}

console.log(`\n${failures === 0 ? 'all passed' : failures + ' of ' + checks + ' checks failed'}`)
process.exit(failures === 0 ? 0 : 1)

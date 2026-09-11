// ═══════════════════════════════════════════════════════════════════════
// NOBODY HAD EVER SAVED A PROFILE.
//
// Carolina opened Profile, corrected her details, pressed Save:
//
//   updateIn user_profiles failed: 400
//   {"code":"22001","message":"value too long for type character(1)"}
//
// Keenan pressed Save on the coach side ten seconds later and got the same
// thing. Not a coach bug and not an athlete bug — the same line, which had
// been failing for every user of this app since the column was created.
//
// user_profiles.gender is character(1). ProfileScreen wrote 'Female'.
//
// It survived this long because the write is invisible from the read side:
// the handle_new_user trigger normalises 'Male'/'Female' down to one
// character on the way in, so the column has only ever held clean 'M' and
// 'F'. Every screen read it correctly. Every attempt to change it failed.
// 18 M, 7 F, 10 null, and not one of them written by the app's own save.
//
// The cause was five independent spellings of one fact:
//
//   LoginScreen      sex === 'F' ? 'Female' : 'Male'    → auth metadata
//   AuthContext      gender: authGender                 → straight through
//   ProfileScreen    sex === 'F' ? 'Female' : ...       → straight through
//   CoachRoster      scrapedGender || 'M'
//   AuthContext      gender === 'Female' ? 'F' : ...    → and back again
//
// Two of the five chose the six-letter word and no single place owned the
// answer. lib/identity is that place now. This file holds it there.
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
// A fix explains the bug it fixed, so comments legitimately quote the dead
// spellings. Checks that a string is GONE must read code, not prose.
const code = (rel) => src(rel)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const { toSexCode, toGenderColumn, sexLabel } = load('lib/identity')

// ── The constraint the database actually imposes ─────────────────────
// Measured against the live schema on 11 Sep 2026:
//   user_profiles.gender   character(1)
//   coach_roster.gender    character varying(1)
// Anything longer than this is a 22001, which is a failed save, which is a
// user who cannot edit their own name.
const COLUMN_WIDTH = 1

// ── 1. Nothing this function returns can ever overflow the column ────
{
  // Every spelling this codebase, its auth metadata, its scraped World
  // Athletics fields and its two form buttons have ever used.
  const inputs = [
    'F', 'M', 'f', 'm', 'Female', 'Male', 'female', 'male', 'FEMALE', 'MALE',
    "Women's", "Men's", 'women', 'men', 'W', 'w',
    ' F ', ' Female ', '', '   ', null, undefined, 0, 1, {}, [], NaN,
    'unknown', 'X', 'other', 'prefer not to say',
  ]
  const overflow = inputs
    .map((v) => [v, toGenderColumn(v)])
    .filter(([, out]) => out != null && String(out).length > COLUMN_WIDTH)
  check('no input produces a value too long for the column', overflow.length === 0,
    overflow.map(([i, o]) => `       ${JSON.stringify(i)} -> ${JSON.stringify(o)}`).join('\n'))

  const bad = inputs
    .map((v) => [v, toGenderColumn(v)])
    .filter(([, out]) => out != null && out !== 'M' && out !== 'F')
  check('the only non-null outputs are M and F', bad.length === 0,
    bad.map(([i, o]) => `       ${JSON.stringify(i)} -> ${JSON.stringify(o)}`).join('\n'))
}

// ── 2. It understands what was actually stored and sent ──────────────
{
  check("'Female' reads as F", toSexCode('Female') === 'F')
  check("'Male' reads as M", toSexCode('Male') === 'M')
  check("'F' survives a round trip", toSexCode('F') === 'F')
  check("'M' survives a round trip", toSexCode('M') === 'M')
  check('the form button label reads', toSexCode("Women's") === 'F' && toSexCode("Men's") === 'M')
  check('whitespace does not defeat it', toSexCode('  female ') === 'F')
  check('unstated stays unstated, not guessed',
    toSexCode(null) === null && toSexCode('') === null && toSexCode(undefined) === null,
    '       a default of M is how a woman gets ranked against men')
  check('an unrecognised value is null, not passed through',
    toSexCode('X') === null && toSexCode('other') === null,
    '       passing it through is what let a long string reach the column')
  check('read and write agree on every input',
    ['F', 'M', 'Female', 'Male', "Women's", null, 'X', '']
      .every((v) => toSexCode(v) === toGenderColumn(v)),
    '       the two halves drifting apart is the whole bug')
  check('the label is for labels only',
    sexLabel('F') === "Women's" && sexLabel('M') === "Men's" && sexLabel(null) === null)
}

// ── 3. Every call site goes through it ───────────────────────────────
{
  const sites = [
    ['screens/ProfileScreen.tsx', 'the save that failed for everyone'],
    ['screens/LoginScreen.tsx', 'sign-up metadata'],
    ['contexts/AuthContext.tsx', 'the profile row created on first fetch'],
    ['screens/CoachRosterScreen.tsx', 'a manually added athlete'],
  ]
  for (const [file, what] of sites) {
    const c = code(file)
    check(`${what} imports the normaliser`, /from '\.\.\/lib\/identity'/.test(c),
      `       ${file}`)
  }

  // The literal that caused it. In code, in a write, anywhere.
  for (const [file] of sites) {
    const c = code(file)
    const literals = (c.match(/'(Female|Male)'/g) || [])
    check(`no 'Female'/'Male' literal left in ${path.basename(file)}`,
      literals.length === 0,
      `       ${literals.join(', ')} — the column holds one character`)
  }

  const prof = code('screens/ProfileScreen.tsx')
  check('the profile save normalises on the way out',
    /gender: toGenderColumn\(sex\)/.test(prof))
  check('and still writes the real column names',
    /date_of_birth:/.test(prof) && /club_school:/.test(prof),
    '       the app calls these dob/club; the table does not')

  const auth = code('contexts/AuthContext.tsx')
  check('both read paths use one normaliser, not two hand-rolled ternaries',
    (auth.match(/toSexCode\(p\.gender\)/g) || []).length === 2
    && !/=== 'Female' \? 'F'/.test(auth),
    '       two copies of the same mapping is how they drifted')
  check('the row created on first fetch is normalised too',
    /toGenderColumn\(authMeta\.gender\)/.test(auth),
    '       this insert raised 22001 on every new account and fell through\n'
    + '       to its own retry branch, which is why it looked like it worked')
}

// ── 4. The write payload matches the table ───────────────────────────
// Pinned from information_schema on 11 Sep 2026. A column this app writes
// that is narrower than the value it sends is the bug, restated.
{
  const WIDTHS = {
    account_type: 10, full_name: 150, email: 255, gender: 1,
    club_school: 200, country: 100, city: 100,
  }
  const prof = code('screens/ProfileScreen.tsx')
  const call = prof.match(/updateIn\('user_profiles',[^]*?\{([^]*?)\n\s*\}\)/)
  const keys = call ? [...call[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]) : []
  check('the profile save was found', keys.length > 0)
  const unknown = keys.filter((k) => !(k in WIDTHS) && k !== 'date_of_birth')
  check('every field it writes is a column that exists', unknown.length === 0,
    unknown.map((k) => `       ${k} — not in user_profiles`).join('\n'))
  check('the narrowest column is the one that broke', WIDTHS.gender === COLUMN_WIDTH)
}

console.log(`\n${failures === 0 ? 'all passed' : failures + ' of ' + checks + ' checks failed'}`)
process.exit(failures === 0 ? 0 : 1)

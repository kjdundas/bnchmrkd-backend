// ═══════════════════════════════════════════════════════════════════════
// THE SCALES STAY COLLAPSED.
//
// This app once shipped 40 distinct fontSize values, 31 borderRadius values
// and 5 weights, against a theme that defined 3, 5 and none. None of that
// was decided; it accumulated, one component at a time, because there was
// nowhere obvious to look and nothing that objected.
//
// This is the thing that objects. It fails on a literal, which is the only
// way a scale stays a scale — a design system that is merely documented is
// a design system that drifts back.
//
// If a literal is genuinely right — a computed circle, a chart tick sized
// off its own geometry — the escape is a named constant or an arithmetic
// expression, not a bare number. `borderRadius: SIZE / 2` says what it
// means. `borderRadius: 17` does not.
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, '..', '..', 'src')
const THEME = path.join(SRC, 'lib', 'theme.ts')

let failures = 0
let checks = 0

function check(name, ok, detail) {
  checks++
  if (ok) { console.log(`  ok   ${name}`) }
  else { failures++; console.log(`  FAIL ${name}`); if (detail) console.log(detail) }
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) out.push(p)
  }
  return out
}

const files = walk(SRC).filter((p) => p !== THEME)
const rel = (p) => path.relative(SRC, p).replace(/\\/g, '/')

// ── 1. No bare literals outside the theme ────────────────────────────
for (const [label, re] of [
  ['fontSize',     /fontSize:\s*[0-9.]+/g],
  ['borderRadius', /borderRadius:\s*[0-9.]+/g],
  ['fontWeight',   /fontWeight:\s*['"][0-9]+['"]/g],
]) {
  const hits = []
  for (const p of files) {
    const src = fs.readFileSync(p, 'utf8')
    src.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(re)) hits.push(`       ${rel(p)}:${i + 1}  ${m[0]}`)
    })
  }
  check(
    `no bare ${label} literals outside theme.ts`,
    hits.length === 0,
    hits.slice(0, 12).join('\n') + (hits.length > 12 ? `\n       …and ${hits.length - 12} more` : ''),
  )
}

// ── 2. The scales themselves are the agreed size ─────────────────────
const theme = fs.readFileSync(THEME, 'utf8')

function scaleKeys(name) {
  const m = theme.match(new RegExp(`export const ${name} = \\{([\\s\\S]*?)\\n\\}`))
  if (!m) return null
  return [...m[1].matchAll(/^\s*(\w+):/gm)].map((x) => x[1])
}

const typeKeys = scaleKeys('typeScale')
const radiusKeys = scaleKeys('radius')
const weightKeys = scaleKeys('weight')

check('the type scale exists and has 10 steps', typeKeys && typeKeys.length === 10,
  typeKeys ? `       found ${typeKeys.length}: ${typeKeys.join(', ')}` : '       typeScale not found')
check('the radius scale exists and has 5 steps', radiusKeys && radiusKeys.length === 5,
  radiusKeys ? `       found ${radiusKeys.length}: ${radiusKeys.join(', ')}` : '       radius not found')
check('there are 3 weights', weightKeys && weightKeys.length === 3,
  weightKeys ? `       found ${weightKeys.length}: ${weightKeys.join(', ')}` : '       weight not found')

// ── 3. Every token named in the app actually exists ──────────────────
// A typo silently renders `undefined`, which React Native ignores rather
// than throws — the text just quietly takes its parent's size.
for (const [name, keys] of [['typeScale', typeKeys], ['radius', radiusKeys], ['weight', weightKeys]]) {
  if (!keys) continue
  const unknown = new Set()
  for (const p of files) {
    const src = fs.readFileSync(p, 'utf8')
    for (const m of src.matchAll(new RegExp(`(?<![\\w.])${name}\\.(\\w+)`, 'g'))) {
      if (!keys.includes(m[1])) unknown.add(`${m[1]}  (${rel(p)})`)
    }
  }
  check(`every ${name}.* the app names is defined`, unknown.size === 0,
    [...unknown].map((x) => '       ' + x).join('\n'))
}

// ── 4. The dead exports stay dead ────────────────────────────────────
// `fonts` defined three sizes for an app that used forty, and three files
// imported it without ever calling it. Its removal is the point.
check('the old `fonts` export has not come back', !/export const fonts\b/.test(theme))

// ── 5. One press primitive ───────────────────────────────────────────
// Tappable carries the hit slop, the press response and the accessibility
// role. A raw Touchable carries none of them, and a third of the app once
// answered the thumb differently because of it.
const touchables = []
for (const p of files) {
  const src = fs.readFileSync(p, 'utf8')
  src.split('\n').forEach((line, i) => {
    if (/<TouchableOpacity\b|<TouchableHighlight\b|<TouchableWithoutFeedback\b/.test(line)) {
      touchables.push(`       ${rel(p)}:${i + 1}`)
    }
  })
}
check('every tap goes through Tappable', touchables.length === 0, touchables.slice(0, 12).join('\n'))


// ── 6. A screen on a photograph opens its safe area first ────────────
// Boards shipped with its ScrollView as a direct child of the root: no
// SafeAreaView at all. Nothing bounded the top, so content slid under the
// status bar as soon as you scrolled — and padding the first child only
// positioned it correctly at rest, which is why a fix for that held for
// exactly one screenshot.
//
// The invariant is narrow on purpose. My first version of this check also
// demanded a pinned AppHeader, and it immediately "failed" three screens
// that are all correct: two because the first <ScrollView> in the file
// belongs to a modal or a sub-component defined above the render, and one
// because a pushed detail screen carries a back button instead, which is
// the right header for it. A check that cries wolf gets ignored, and then
// it is worse than no check at all.
//
// So this asserts only the thing that actually prevents scroll-under, and
// only in the region that is actually the screen shell: after
// <ScreenBackdrop>, a SafeAreaView opens before the first scroll view.
{
  const bad = []
  for (const p of files) {
    const src = fs.readFileSync(p, 'utf8')
    const bd = src.indexOf('<ScreenBackdrop')
    if (bd === -1) continue
    const shell = src.slice(bd)
    const safe = shell.search(/<SafeAreaView/)
    const scroll = shell.search(/<(Animated\.)?ScrollView|<FlatList|<SectionList/)
    if (safe === -1) {
      bad.push(`       ${rel(p)}: on ScreenBackdrop with no SafeAreaView`)
    } else if (scroll !== -1 && safe > scroll) {
      bad.push(`       ${rel(p)}: scroll view opens before the safe area`)
    }
  }
  check('every screen on the photo backdrop opens its safe area before scrolling',
    bad.length === 0, bad.join('\n'))
}

console.log(`\n${failures === 0 ? 'all passed' : failures + ' of ' + checks + ' checks failed'}`)
process.exit(failures === 0 ? 0 : 1)

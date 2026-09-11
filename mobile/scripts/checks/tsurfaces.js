// ═══════════════════════════════════════════════════════════════════════
// A SHEET IS ITS OWN SURFACE.
//
// The Invite Athlete sheet opened and the roster stayed readable through
// it. "Send a link request to an athlete's account" printed across
// "Suleiman ABDULRAHMAN 45.58s"; the panel looked like a rendering fault.
//
// The cause is a vocabulary collision. This app has two palettes:
//
//   colors.bg.*    flat, opaque surfaces      #0B0C18, #141636, #171935
//   onImage.*      translucent plates meant   rgba(255,255,255,0.10)
//                  to float over a PHOTO
//
// The coach screens have photographic headers, so onImage.card is correct
// fourteen times in this codebase — every one of them a card sitting on an
// image. The fifteenth was a modal's own background, where 10% white over a
// 65% scrim is very nearly nothing at all.
//
// The two token families are one import apart and read almost identically
// at the call site, which is exactly the kind of mistake that gets made
// again. So: a modal surface is opaque, and this says so.
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs'), path = require('path')
const MOBILE = path.join(__dirname, '..', '..')
const SRC = path.join(MOBILE, 'src')

let failures = 0, checks = 0
function check(name, ok, detail) {
  checks++
  if (ok) console.log(`  ok   ${name}`)
  else { failures++; console.log(`  FAIL ${name}`); if (detail) console.log(detail) }
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (e.name.endsWith('.tsx')) out.push(full)
  }
  return out
}
const strip = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const files = walk(SRC)

// ── 1. No modal surface is translucent ───────────────────────────────
//
// Matched by the NAME of the style key, because that is what the author
// was thinking when they wrote it. A key called `sheet`, `modal`, `dialog`
// or `panel` is a surface; a key called `card` may well be a card on a
// photograph and is none of this rule's business.
{
  const SURFACE_KEY = /^\s*(sheet|modalSheet|modalCard|modal|dialog|popup|drawer)\s*:\s*\{/
  const offenders = []
  for (const f of files) {
    const lines = strip(fs.readFileSync(f, 'utf8')).split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!SURFACE_KEY.test(lines[i])) continue
      // The style body, to its closing brace or 30 lines, whichever is first.
      const body = lines.slice(i, i + 30).join('\n').split(/^\s{2}\},/m)[0]
      const bg = body.match(/backgroundColor:\s*([^,\n]+)/)
      if (!bg) continue
      const value = bg[1].trim()
      const translucent = /onImage\./.test(value) || /rgba\([^)]*,\s*0?\.\d+\s*\)/.test(value)
      // cardStrong and chipPlate are near-opaque dark plates (0.78–0.42 over
      // black) and are used deliberately for scrims; they are not this bug.
      const deliberate = /cardStrong|chipPlate|navGlass/.test(value)
      if (translucent && !deliberate) {
        offenders.push(`       ${path.relative(SRC, f)}:${i + 1}  ${lines[i].trim()} → ${value}`)
      }
    }
  }
  check('no modal surface uses a translucent background', offenders.length === 0,
    offenders.join('\n') + (offenders.length
      ? '\n       onImage.* is for cards over PHOTOS. A sheet needs colors.bg.*'
      : ''))
}

// ── 2. The one that broke, specifically ──────────────────────────────
{
  const roster = strip(fs.readFileSync(path.join(SRC, 'screens/CoachRosterScreen.tsx'), 'utf8'))
  const sheet = roster.split(/^\s{2}sheet:\s*\{/m)[1] || ''
  const body = sheet.split(/^\s{2}\},/m)[0]
  check('the invite sheet is opaque', /backgroundColor:\s*colors\.bg\./.test(body),
    '       this is the sheet the roster showed through')
  check('and it still bounds its own height', /maxHeight:/.test(body),
    '       a content-sized sheet with an unbounded ScrollView measures zero —\n'
    + '       that was the previous bug on this same component')
}

// ── 3. The two palettes are still distinguishable ────────────────────
//
// If onImage.card ever became opaque, rule 1 would stop meaning anything
// and would pass silently forever.
{
  const theme = fs.readFileSync(path.join(SRC, 'lib/theme.ts'), 'utf8')
  const flat = theme.split(/export const onImage\s*=/)[1] || ''
  const cardLine = flat.match(/card:\s*'([^']+)'/)
  check('onImage.card is still the translucent plate this rule assumes',
    !!cardLine && /rgba/.test(cardLine[1]),
    `       got ${cardLine ? cardLine[1] : 'nothing'} — if this went opaque, rule 1 is vacuous`)
  check('colors.bg.card is still opaque',
    /card:\s*'#[0-9A-Fa-f]{6}'/.test(theme.split(/export const darkColors\s*=/)[1] || ''),
    '       a sheet painted with it would be see-through again')
}

console.log(`\n${failures === 0 ? 'all passed' : failures + ' of ' + checks + ' checks failed'}`)
process.exit(failures === 0 ? 0 : 1)

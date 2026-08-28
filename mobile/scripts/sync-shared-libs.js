// Copies the shared analysis libraries from the web frontend into mobile so the
// two apps compute identical numbers. These files are plain JS with no DOM or
// React dependency, which is why they can be shared verbatim.
//
// Run from mobile/:  node scripts/sync-shared-libs.js
//
// Mobile needs a couple of exports the web file keeps module-private; those are
// applied as explicit patches below rather than by hand-editing the copy, so a
// re-sync never silently drops them.

const fs = require('fs')
const path = require('path')

const SRC = path.resolve(__dirname, '../../frontend/src/lib')
const DEST = path.resolve(__dirname, '../src/lib')

const FILES = [
  'disciplineScience.js',
  'improvementCurves.js',
  'performanceLevels.js',
  'performanceTiers.js',
  'historicalRivals.js',
  'maturation.js',
]

// name -> [ [find, replace, requiredCount], ... ]
const PATCHES = {
  // IntelligenceCards.tsx imports REFERENCE_RANGES; it is module-private on web.
  'disciplineScience.js': [
    ['const REFERENCE_RANGES = {', 'export const REFERENCE_RANGES = {', 1],
  ],
}

let changed = 0
for (const name of FILES) {
  const from = path.join(SRC, name)
  if (!fs.existsSync(from)) { console.log('SKIP (missing on web):', name); continue }
  let body = fs.readFileSync(from, 'utf8')

  for (const [find, replace, count] of PATCHES[name] || []) {
    const n = body.split(find).length - 1
    if (n !== count) {
      throw new Error(`patch for ${name} matched ${n}x, expected ${count}: ${find}`)
    }
    body = body.split(find).join(replace)
  }

  const to = path.join(DEST, name)
  const before = fs.existsSync(to) ? fs.readFileSync(to, 'utf8') : null
  if (before === body) { console.log('unchanged:', name); continue }
  fs.writeFileSync(to, body)
  changed++
  console.log('synced:  ', name)
}
console.log(changed === 0 ? 'Already in sync.' : `${changed} file(s) updated.`)

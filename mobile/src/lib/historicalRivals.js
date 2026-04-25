// ═══════════════════════════════════════════════════════════════════════
// HISTORICAL RIVALS — curated pacer set
// ─────────────────────────────────────────────────────────────────────
// Each rival is a real elite athlete with an approximate "breakthrough"
// mark and the age they ran it. The Trajectory / Rival card uses this
// to show the user "at your age, X ran Y" — turning the abstract tier
// ladder into a chase against a named human.
//
// NOTE — these marks are approximations sourced from public records and
// World Athletics profiles. The bnchmrkd. scraping pipeline can replace
// this file with verified data later. Add or correct entries freely.
//
// Discipline keys are normalized: lowercased, whitespace stripped.
// ═══════════════════════════════════════════════════════════════════════

const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')

export const HISTORICAL_RIVALS = {
  // ─── Sprints ───────────────────────────────────────────────────────
  '100m': {
    M: [
      { name: 'Usain Bolt',          country: 'JAM', mark: 10.03, age: 16, note: 'World Youth gold' },
      { name: 'Yohan Blake',         country: 'JAM', mark: 10.11, age: 17 },
      { name: 'Noah Lyles',          country: 'USA', mark: 10.14, age: 18 },
      { name: 'Trayvon Bromell',     country: 'USA', mark: 10.13, age: 18 },
      { name: 'Andre De Grasse',     country: 'CAN', mark: 10.25, age: 17 },
      { name: 'Christian Coleman',   country: 'USA', mark: 10.43, age: 18 },
      { name: 'Erriyon Knighton',    country: 'USA', mark: 10.04, age: 17 },
    ],
    F: [
      { name: "Sha'Carri Richardson",country: 'USA', mark: 10.75, age: 19 },
      { name: 'Shelly-Ann Fraser-Pryce', country: 'JAM', mark: 11.31, age: 17 },
      { name: 'Dina Asher-Smith',    country: 'GBR', mark: 11.14, age: 18 },
      { name: 'Marie-Josée Ta Lou',  country: 'CIV', mark: 11.40, age: 18 },
      { name: 'Elaine Thompson-Herah', country: 'JAM', mark: 11.40, age: 18 },
    ],
  },
  '200m': {
    M: [
      { name: 'Usain Bolt',          country: 'JAM', mark: 19.93, age: 17, note: 'World Junior record' },
      { name: 'Erriyon Knighton',    country: 'USA', mark: 19.49, age: 18, note: 'U20 world record' },
      { name: 'Noah Lyles',          country: 'USA', mark: 20.09, age: 17 },
      { name: 'Andre De Grasse',     country: 'CAN', mark: 20.55, age: 18 },
    ],
    F: [
      { name: 'Allyson Felix',       country: 'USA', mark: 22.11, age: 17 },
      { name: 'Gabby Thomas',        country: 'USA', mark: 22.38, age: 19 },
      { name: 'Shericka Jackson',    country: 'JAM', mark: 22.84, age: 18 },
    ],
  },
  '400m': {
    M: [
      { name: 'Michael Norman',      country: 'USA', mark: 44.61, age: 19 },
      { name: 'Steven Gardiner',     country: 'BAH', mark: 45.00, age: 21 },
      { name: 'Wayde van Niekerk',   country: 'RSA', mark: 45.40, age: 19 },
    ],
    F: [
      { name: 'Sydney McLaughlin',   country: 'USA', mark: 50.07, age: 19 },
      { name: 'Sanya Richards-Ross', country: 'USA', mark: 50.69, age: 19 },
      { name: 'Marie-José Pérec',    country: 'FRA', mark: 51.62, age: 20 },
    ],
  },

  // ─── Middle distance ───────────────────────────────────────────────
  '800m': {
    M: [
      { name: 'David Rudisha',       country: 'KEN', mark: 1*60+42.61, age: 19 },
      { name: 'Wilfred Bungei',      country: 'KEN', mark: 1*60+44.96, age: 19 },
    ],
    F: [
      { name: 'Caster Semenya',      country: 'RSA', mark: 1*60+55.45, age: 18 },
      { name: 'Athing Mu',           country: 'USA', mark: 1*60+55.21, age: 19 },
    ],
  },
  '1500m': {
    M: [
      { name: 'Jakob Ingebrigtsen',  country: 'NOR', mark: 3*60+28.32, age: 19 },
      { name: 'Hicham El Guerrouj',  country: 'MAR', mark: 3*60+33.00, age: 20 },
    ],
    F: [
      { name: 'Faith Kipyegon',      country: 'KEN', mark: 3*60+56.98, age: 18 },
      { name: 'Genzebe Dibaba',      country: 'ETH', mark: 4*60+2.21, age: 19 },
    ],
  },

  // ─── Distance ──────────────────────────────────────────────────────
  '5000m': {
    M: [
      { name: 'Joshua Cheptegei',    country: 'UGA', mark: 13*60+13.27, age: 20 },
      { name: 'Mo Farah',            country: 'GBR', mark: 13*60+30.53, age: 21 },
    ],
    F: [
      { name: 'Sifan Hassan',        country: 'NED', mark: 14*60+59.23, age: 22 },
      { name: 'Letesenbet Gidey',    country: 'ETH', mark: 14*60+30.79, age: 21 },
    ],
  },

  // ─── Hurdles ───────────────────────────────────────────────────────
  '110mh': {
    M: [
      { name: 'Grant Holloway',      country: 'USA', mark: 13.15, age: 19 },
      { name: 'Aries Merritt',       country: 'USA', mark: 13.55, age: 20 },
    ],
  },
  '110mhurdles': {
    M: [
      { name: 'Grant Holloway',      country: 'USA', mark: 13.15, age: 19 },
    ],
  },
  '400mh': {
    M: [
      { name: 'Karsten Warholm',     country: 'NOR', mark: 48.36, age: 21 },
      { name: 'Rai Benjamin',        country: 'USA', mark: 48.27, age: 21 },
    ],
    F: [
      { name: 'Sydney McLaughlin',   country: 'USA', mark: 53.82, age: 17 },
      { name: 'Femke Bol',           country: 'NED', mark: 53.79, age: 21 },
    ],
  },

  // ─── Jumps ─────────────────────────────────────────────────────────
  'longjump': {
    M: [
      { name: 'Carl Lewis',          country: 'USA', mark: 8.13, age: 18 },
      { name: 'Juan Miguel Echevarría', country: 'CUB', mark: 8.68, age: 19 },
      { name: 'Tajay Gayle',         country: 'JAM', mark: 8.32, age: 22 },
    ],
    F: [
      { name: 'Malaika Mihambo',     country: 'GER', mark: 6.65, age: 19 },
      { name: 'Brittney Reese',      country: 'USA', mark: 6.84, age: 21 },
    ],
  },
  'triplejump': {
    M: [
      { name: 'Jonathan Edwards',    country: 'GBR', mark: 17.13, age: 22 },
      { name: 'Christian Taylor',    country: 'USA', mark: 17.40, age: 21 },
    ],
    F: [
      { name: 'Yulimar Rojas',       country: 'VEN', mark: 14.43, age: 19 },
    ],
  },
  'highjump': {
    M: [
      { name: 'Mutaz Essa Barshim',  country: 'QAT', mark: 2.31, age: 19 },
      { name: 'Javier Sotomayor',    country: 'CUB', mark: 2.36, age: 17 },
    ],
    F: [
      { name: 'Yaroslava Mahuchikh', country: 'UKR', mark: 2.04, age: 17 },
      { name: 'Mariya Lasitskene',   country: 'RUS', mark: 2.00, age: 19 },
    ],
  },
  'polevault': {
    M: [
      { name: 'Armand Duplantis',    country: 'SWE', mark: 6.05, age: 19, note: 'European U20 record' },
      { name: 'Sam Kendricks',       country: 'USA', mark: 5.50, age: 21 },
    ],
    F: [
      { name: 'Yelena Isinbayeva',   country: 'RUS', mark: 4.82, age: 21 },
      { name: 'Katie Moon',          country: 'USA', mark: 4.50, age: 21 },
    ],
  },

  // ─── Throws ────────────────────────────────────────────────────────
  'shotput': {
    M: [
      { name: 'Ryan Crouser',        country: 'USA', mark: 21.40, age: 21 },
      { name: 'Joe Kovacs',          country: 'USA', mark: 19.74, age: 21 },
      { name: 'Tomas Walsh',         country: 'NZL', mark: 20.61, age: 22 },
    ],
    F: [
      { name: 'Valerie Adams',       country: 'NZL', mark: 19.66, age: 22 },
      { name: 'Chase Ealey',         country: 'USA', mark: 18.64, age: 22 },
    ],
  },
  'discusthrow': {
    M: [
      { name: 'Daniel Ståhl',        country: 'SWE', mark: 65.10, age: 21 },
      { name: 'Kristjan Čeh',        country: 'SLO', mark: 66.40, age: 21 },
    ],
    F: [
      { name: 'Sandra Perković',     country: 'CRO', mark: 65.31, age: 19 },
      { name: 'Valarie Allman',      country: 'USA', mark: 63.36, age: 22 },
    ],
  },
  'hammerthrow': {
    M: [
      { name: 'Pawel Fajdek',        country: 'POL', mark: 78.18, age: 21 },
    ],
    F: [
      { name: 'Anita Włodarczyk',    country: 'POL', mark: 76.83, age: 22 },
      { name: 'DeAnna Price',        country: 'USA', mark: 71.74, age: 22 },
    ],
  },
  'javelinthrow': {
    M: [
      { name: 'Jakub Vadlejch',      country: 'CZE', mark: 83.00, age: 22 },
      { name: 'Neeraj Chopra',       country: 'IND', mark: 86.48, age: 18, note: 'U20 world record' },
    ],
    F: [
      { name: 'Barbora Špotáková',   country: 'CZE', mark: 60.00, age: 21 },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────
// Find the most relevant rival for an athlete.
// Strategy: pick the rival whose mark is closest to the athlete's PB,
// breaking ties by age proximity. Returns the rival + diff + ahead flag.
// ─────────────────────────────────────────────────────────────────────
export function findRival(discipline, sex, athleteAge, currentPb, higher) {
  if (currentPb == null || !discipline) return null
  const key = norm(discipline)
  const bucket = HISTORICAL_RIVALS[key]
  if (!bucket) return null
  // Try requested sex first, then fall back to the other if empty
  const pool = bucket[sex] || bucket.M || bucket.F
  if (!pool || pool.length === 0) return null

  const scored = pool.map(r => {
    const relMarkDiff = Math.abs(r.mark - currentPb) / currentPb
    const ageDiff = athleteAge != null ? Math.abs((r.age || 18) - athleteAge) : 0
    return { ...r, _score: relMarkDiff * 10 + ageDiff * 0.04 }
  }).sort((a, b) => a._score - b._score)

  const rival = scored[0]
  // Direction-aware: lower-is-better for times, higher-is-better for distances
  const diff = higher ? currentPb - rival.mark : rival.mark - currentPb
  return {
    name: rival.name,
    country: rival.country,
    mark: rival.mark,
    age: rival.age,
    note: rival.note,
    diff,
    ahead: diff > 0,
  }
}

// Compute athlete age in years from a DOB string
export function ageFromDob(dob) {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

// ═══════════════════════════════════════════════════════════════════════
// disciplineScience.js
// The brains behind the Home page. Links physical qualities to
// discipline-specific performance via published correlations.
//
// Sources informing the coefficients used here (paraphrased, not quoted):
//   Loturco et al. (2015) — CMJ / squat jump vs 100 m sprint time
//   Marques et al. (2011) — vertical jumps and sprint correlations
//   Haugen & Buchheit (2016) — sprint mechanics and testing protocols
//   McBride et al. (2009) — relative strength vs sprint performance
//   Young et al. (1995) — reactive strength and max velocity
//   Terzis et al. (2003, 2007) — IMTP / throws correlations
//   Bangsbo et al. (2008) — Yo-Yo IR tests vs intermittent performance
// ═══════════════════════════════════════════════════════════════════════

// ── Discipline family classification ──────────────────────────────────
const FAMILIES = {
  sprint:   ['100m', '200m', '60m'],
  longSprint: ['400m', '400mH'],
  hurdles:  ['110mH', '100mH', '60mH'],
  jumps:    ['Long Jump', 'Triple Jump', 'High Jump', 'Pole Vault'],
  throws:   ['Shot Put', 'Discus Throw', 'Javelin Throw', 'Hammer Throw',
             'Shot', 'Discus', 'Javelin', 'Hammer'],
  midDistance: ['800m', '1500m', 'Mile'],
  distance: ['3000m', '5000m', '10000m', 'Marathon', '3000mSC'],
}

export function disciplineFamily(discipline) {
  if (!discipline) return 'sprint'
  const d = discipline.trim()
  for (const [family, list] of Object.entries(FAMILIES)) {
    if (list.some(x => d.toLowerCase() === x.toLowerCase())) return family
  }
  // substring fallback
  for (const [family, list] of Object.entries(FAMILIES)) {
    if (list.some(x => d.toLowerCase().includes(x.toLowerCase()))) return family
  }
  return 'sprint'
}

export function isLowerBetter(discipline) {
  const family = disciplineFamily(discipline)
  return family !== 'jumps' && family !== 'throws'
}

// ── Discipline calibration (mean / std of Olympic-qualifier distribution)
// Values come from the same benchmark set used in the backend analyzer.
// Units: times in seconds, throws/jumps in metres.
const CALIBRATION = {
  // Male sprints
  '100m_M':   { mean: 10.45, std: 0.27, rocOptimal: 10.15, rocS90: 10.35, rocS80: 10.21, rocS70: 10.05 },
  '200m_M':   { mean: 20.85, std: 0.50, rocOptimal: 20.40, rocS90: 20.80, rocS80: 20.55, rocS70: 20.20 },
  '400m_M':   { mean: 45.80, std: 1.00, rocOptimal: 45.00, rocS90: 45.80, rocS80: 45.30, rocS70: 44.70 },
  '800m_M':   { mean: 106.5, std: 2.20, rocOptimal: 104.8, rocS90: 106.5, rocS80: 105.6, rocS70: 104.2 },
  '1500m_M':  { mean: 217.0, std: 4.50, rocOptimal: 213.0, rocS90: 217.0, rocS80: 215.0, rocS70: 212.0 },
  '5000m_M':  { mean: 800.0, std: 18.0, rocOptimal: 782.0, rocS90: 800.0, rocS80: 790.0, rocS70: 778.0 },
  'Marathon_M': { mean: 7865.12, std: 313.12, rocOptimal: 7792, rocS90: 7765, rocS80: 7715, rocS70: 7672 },
  '110mH_M':  { mean: 13.45, std: 0.28, rocOptimal: 13.15, rocS90: 13.35, rocS80: 13.25, rocS70: 13.10 },
  '400mH_M':  { mean: 49.0,  std: 1.10, rocOptimal: 48.0,  rocS90: 48.8,  rocS80: 48.4,  rocS70: 47.8  },
  'Long Jump_M':    { mean: 8.05, std: 0.22, rocOptimal: 8.30, rocS90: 8.05, rocS80: 8.15, rocS70: 8.30, higher: true },
  'Triple Jump_M':  { mean: 16.8, std: 0.45, rocOptimal: 17.3, rocS90: 16.8, rocS80: 17.0, rocS70: 17.3, higher: true },
  'High Jump_M':    { mean: 2.27, std: 0.06, rocOptimal: 2.33, rocS90: 2.27, rocS80: 2.30, rocS70: 2.33, higher: true },
  'Pole Vault_M':   { mean: 5.70, std: 0.15, rocOptimal: 5.90, rocS90: 5.70, rocS80: 5.80, rocS70: 5.90, higher: true },
  'Shot Put_M':     { mean: 20.8, std: 0.80, rocOptimal: 21.5, rocS90: 20.5, rocS80: 20.9, rocS70: 21.5, higher: true },
  'Discus Throw_M': { mean: 64.5, std: 3.50, rocOptimal: 68.0, rocS90: 64.0, rocS80: 65.5, rocS70: 68.0, higher: true },
  'Hammer Throw_M': { mean: 76.0, std: 3.00, rocOptimal: 79.5, rocS90: 76.0, rocS80: 77.5, rocS70: 79.5, higher: true },
  'Javelin Throw_M':{ mean: 82.5, std: 4.50, rocOptimal: 87.0, rocS90: 82.0, rocS80: 84.0, rocS70: 87.0, higher: true },

  // Female sprints
  '100m_F':   { mean: 11.40, std: 0.28, rocOptimal: 11.05, rocS90: 11.30, rocS80: 11.15, rocS70: 10.95 },
  '200m_F':   { mean: 23.00, std: 0.55, rocOptimal: 22.45, rocS90: 22.95, rocS80: 22.70, rocS70: 22.30 },
  '400m_F':   { mean: 51.30, std: 1.10, rocOptimal: 50.20, rocS90: 51.20, rocS80: 50.60, rocS70: 49.90 },
  '800m_F':   { mean: 121.0, std: 2.50, rocOptimal: 119.0, rocS90: 121.0, rocS80: 120.0, rocS70: 118.5 },
  '1500m_F':  { mean: 245.0, std: 5.00, rocOptimal: 241.0, rocS90: 245.0, rocS80: 243.0, rocS70: 240.0 },
  '5000m_F':  { mean: 905.0, std: 20.0, rocOptimal: 885.0, rocS90: 905.0, rocS80: 895.0, rocS70: 880.0 },
  'Marathon_F': { mean: 8935.08, std: 494.65, rocOptimal: 8669, rocS90: 8669, rocS80: 8624, rocS70: 8587 },
  '100mH_F':  { mean: 12.75, std: 0.25, rocOptimal: 12.50, rocS90: 12.70, rocS80: 12.60, rocS70: 12.45 },
  '400mH_F':  { mean: 54.8,  std: 1.20, rocOptimal: 53.6,  rocS90: 54.6,  rocS80: 54.1,  rocS70: 53.3  },
  'Long Jump_F':    { mean: 6.85, std: 0.20, rocOptimal: 7.05, rocS90: 6.80, rocS80: 6.90, rocS70: 7.05, higher: true },
  'Triple Jump_F':  { mean: 14.5, std: 0.35, rocOptimal: 14.9, rocS90: 14.5, rocS80: 14.7, rocS70: 14.9, higher: true },
  'High Jump_F':    { mean: 1.95, std: 0.05, rocOptimal: 2.00, rocS90: 1.95, rocS80: 1.97, rocS70: 2.00, higher: true },
  'Pole Vault_F':   { mean: 4.70, std: 0.12, rocOptimal: 4.85, rocS90: 4.70, rocS80: 4.78, rocS70: 4.85, higher: true },
  'Shot Put_F':     { mean: 18.5, std: 0.80, rocOptimal: 19.3, rocS90: 18.3, rocS80: 18.8, rocS70: 19.3, higher: true },
  'Discus Throw_F': { mean: 63.0, std: 3.00, rocOptimal: 66.5, rocS90: 63.0, rocS80: 64.5, rocS70: 66.5, higher: true },
  'Hammer Throw_F': { mean: 73.5, std: 2.80, rocOptimal: 77.0, rocS90: 73.5, rocS80: 75.0, rocS70: 77.0, higher: true },
  'Javelin Throw_F':{ mean: 63.0, std: 3.00, rocOptimal: 66.5, rocS90: 63.0, rocS80: 64.5, rocS70: 66.5, higher: true },
}

export function getCalibration(discipline, sex = 'M') {
  const key = `${discipline}_${sex}`
  return CALIBRATION[key] || CALIBRATION[`100m_${sex}`]
}

// ── Stats helpers ──────────────────────────────────────────────────────
function erf(x) {
  // Abramowitz & Stegun 7.1.26
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741
  const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return sign * y
}
export const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2))

// ── Where-you-stand percentile ─────────────────────────────────────────
// Returns percentile 0..100 among the Olympic-qualifier distribution.
export function performancePercentile(pb, discipline, sex = 'M') {
  if (pb == null) return null
  const cal = getCalibration(discipline, sex)
  const higher = !!cal.higher
  const z = (pb - cal.mean) / cal.std
  // For lower-is-better events, a negative z is better → percentile = 1 - CDF(z)
  const raw = higher ? normCdf(z) : 1 - normCdf(z)
  return Math.max(1, Math.min(99, Math.round(raw * 100)))
}

export function qualifierZones(discipline, sex = 'M') {
  const cal = getCalibration(discipline, sex)
  return {
    finalist: cal.rocS70,
    semifinalist: cal.rocS80,
    qualifier: cal.rocS90,
    optimal: cal.rocOptimal,
    higher: !!cal.higher,
  }
}

export function performanceZoneLabel(pb, discipline, sex = 'M') {
  if (pb == null) return 'No data'
  const z = qualifierZones(discipline, sex)
  const better = (a, b) => z.higher ? a >= b : a <= b
  if (better(pb, z.finalist))      return 'Finalist zone'
  if (better(pb, z.semifinalist))  return 'Semifinalist zone'
  if (better(pb, z.qualifier))     return 'Qualifier zone'
  return 'Development zone'
}

// ══════════════════════════════════════════════════════════════════════
// REFERENCE TIERS — the wide ladder from novice to world record.
// Each entry is sorted from weakest to strongest. Used to position an
// athlete along a continuous scale so every user sees themselves
// somewhere meaningful regardless of level.
// Sources: IAAF/World Athletics standards, national federation grading
// tables, recent world records (outdoor senior, men = M, women = F).
// ══════════════════════════════════════════════════════════════════════
const REFERENCE_TIERS = {
  // ── Men ───────────────────────────────────────────────────────────
  '100m_M': [
    { label: 'Novice',        value: 14.50 },
    { label: 'School',        value: 12.50 },
    { label: 'Club',          value: 11.50 },
    { label: 'National',      value: 10.60 },
    { label: 'Continental',   value: 10.15 },
    { label: 'Olympic Final', value: 9.95  },
    { label: 'World Record',  value: 9.58  }, // Bolt 2009
  ],
  '200m_M': [
    { label: 'Novice',        value: 29.00 },
    { label: 'School',        value: 25.00 },
    { label: 'Club',          value: 23.00 },
    { label: 'National',      value: 21.20 },
    { label: 'Continental',   value: 20.40 },
    { label: 'Olympic Final', value: 19.90 },
    { label: 'World Record',  value: 19.19 }, // Bolt 2009
  ],
  '400m_M': [
    { label: 'Novice',        value: 65.0 },
    { label: 'School',        value: 56.0 },
    { label: 'Club',          value: 51.0 },
    { label: 'National',      value: 46.50 },
    { label: 'Continental',   value: 45.00 },
    { label: 'Olympic Final', value: 44.10 },
    { label: 'World Record',  value: 43.03 }, // Van Niekerk 2016
  ],
  '800m_M': [
    { label: 'Novice',        value: 150.0 },
    { label: 'School',        value: 130.0 },
    { label: 'Club',          value: 115.0 },
    { label: 'National',      value: 108.0 },
    { label: 'Continental',   value: 105.0 },
    { label: 'Olympic Final', value: 103.5 },
    { label: 'World Record',  value: 100.91 }, // Rudisha 2012
  ],
  '1500m_M': [
    { label: 'Novice',        value: 320.0 },
    { label: 'School',        value: 270.0 },
    { label: 'Club',          value: 240.0 },
    { label: 'National',      value: 220.0 },
    { label: 'Continental',   value: 213.0 },
    { label: 'Olympic Final', value: 210.0 },
    { label: 'World Record',  value: 206.00 }, // El Guerrouj 1998
  ],
  '5000m_M': [
    { label: 'Novice',        value: 1200.0 },
    { label: 'School',        value: 1020.0 },
    { label: 'Club',          value: 900.0  },
    { label: 'National',      value: 810.0  },
    { label: 'Continental',   value: 785.0  },
    { label: 'Olympic Final', value: 770.0  },
    { label: 'World Record',  value: 755.36 }, // Cheptegei 2020
  ],
  'Marathon_M': [
    { label: 'Novice',        value: 16200 }, // 4:30:00
    { label: 'School',        value: 12600 }, // 3:30:00
    { label: 'Club',          value: 10800 }, // 3:00:00
    { label: 'National',      value: 9000  }, // 2:30:00
    { label: 'Continental',   value: 8100  }, // 2:15:00
    { label: 'Olympic Final', value: 7800  }, // 2:10:00
    { label: 'World Record',  value: 7235  }, // Kiptum 2:00:35 (2023)
  ],
  '110mH_M': [
    { label: 'Novice',        value: 19.00 },
    { label: 'School',        value: 16.00 },
    { label: 'Club',          value: 14.50 },
    { label: 'National',      value: 13.70 },
    { label: 'Continental',   value: 13.30 },
    { label: 'Olympic Final', value: 13.05 },
    { label: 'World Record',  value: 12.80 }, // Merritt 2012
  ],
  '400mH_M': [
    { label: 'Novice',        value: 70.0 },
    { label: 'School',        value: 60.0 },
    { label: 'Club',          value: 55.0 },
    { label: 'National',      value: 50.5 },
    { label: 'Continental',   value: 48.5 },
    { label: 'Olympic Final', value: 47.5 },
    { label: 'World Record',  value: 45.94 }, // Warholm 2021
  ],
  'Long Jump_M': [
    { label: 'Novice',        value: 4.00 },
    { label: 'School',        value: 5.50 },
    { label: 'Club',          value: 6.50 },
    { label: 'National',      value: 7.50 },
    { label: 'Continental',   value: 8.00 },
    { label: 'Olympic Final', value: 8.30 },
    { label: 'World Record',  value: 8.95 }, // Powell 1991
  ],
  'Triple Jump_M': [
    { label: 'Novice',        value: 9.00  },
    { label: 'School',        value: 12.00 },
    { label: 'Club',          value: 14.00 },
    { label: 'National',      value: 15.80 },
    { label: 'Continental',   value: 16.80 },
    { label: 'Olympic Final', value: 17.40 },
    { label: 'World Record',  value: 18.29 }, // Edwards 1995
  ],
  'High Jump_M': [
    { label: 'Novice',        value: 1.40 },
    { label: 'School',        value: 1.75 },
    { label: 'Club',          value: 1.95 },
    { label: 'National',      value: 2.15 },
    { label: 'Continental',   value: 2.25 },
    { label: 'Olympic Final', value: 2.32 },
    { label: 'World Record',  value: 2.45 }, // Sotomayor 1993
  ],
  'Pole Vault_M': [
    { label: 'Novice',        value: 2.50 },
    { label: 'School',        value: 3.80 },
    { label: 'Club',          value: 4.60 },
    { label: 'National',      value: 5.30 },
    { label: 'Continental',   value: 5.65 },
    { label: 'Olympic Final', value: 5.85 },
    { label: 'World Record',  value: 6.23 }, // Duplantis
  ],
  'Shot Put_M': [
    { label: 'Novice',        value: 7.00  },
    { label: 'School',        value: 12.00 },
    { label: 'Club',          value: 15.50 },
    { label: 'National',      value: 18.50 },
    { label: 'Continental',   value: 20.20 },
    { label: 'Olympic Final', value: 21.50 },
    { label: 'World Record',  value: 23.56 }, // Crouser 2023
  ],
  'Discus Throw_M': [
    { label: 'Novice',        value: 20.0 },
    { label: 'School',        value: 35.0 },
    { label: 'Club',          value: 48.0 },
    { label: 'National',      value: 58.0 },
    { label: 'Continental',   value: 63.0 },
    { label: 'Olympic Final', value: 67.0 },
    { label: 'World Record',  value: 74.35 }, // Schröder 1986
  ],
  'Hammer Throw_M': [
    { label: 'Novice',        value: 25.0 },
    { label: 'School',        value: 40.0 },
    { label: 'Club',          value: 55.0 },
    { label: 'National',      value: 68.0 },
    { label: 'Continental',   value: 75.0 },
    { label: 'Olympic Final', value: 79.0 },
    { label: 'World Record',  value: 86.74 }, // Sedykh 1986
  ],
  'Javelin Throw_M': [
    { label: 'Novice',        value: 25.0 },
    { label: 'School',        value: 45.0 },
    { label: 'Club',          value: 58.0 },
    { label: 'National',      value: 72.0 },
    { label: 'Continental',   value: 80.0 },
    { label: 'Olympic Final', value: 86.0 },
    { label: 'World Record',  value: 98.48 }, // Železný 1996
  ],

  // ── Women ─────────────────────────────────────────────────────────
  '100m_F': [
    { label: 'Novice',        value: 16.00 },
    { label: 'School',        value: 14.00 },
    { label: 'Club',          value: 12.80 },
    { label: 'National',      value: 11.70 },
    { label: 'Continental',   value: 11.15 },
    { label: 'Olympic Final', value: 10.85 },
    { label: 'World Record',  value: 10.49 }, // Flo-Jo 1988
  ],
  '200m_F': [
    { label: 'Novice',        value: 33.00 },
    { label: 'School',        value: 28.50 },
    { label: 'Club',          value: 26.00 },
    { label: 'National',      value: 23.80 },
    { label: 'Continental',   value: 22.70 },
    { label: 'Olympic Final', value: 22.00 },
    { label: 'World Record',  value: 21.34 }, // Flo-Jo 1988
  ],
  '400m_F': [
    { label: 'Novice',        value: 75.0 },
    { label: 'School',        value: 63.0 },
    { label: 'Club',          value: 57.0 },
    { label: 'National',      value: 52.5 },
    { label: 'Continental',   value: 51.0 },
    { label: 'Olympic Final', value: 49.5 },
    { label: 'World Record',  value: 47.60 }, // Koch 1985
  ],
  '800m_F': [
    { label: 'Novice',        value: 175.0 },
    { label: 'School',        value: 150.0 },
    { label: 'Club',          value: 130.0 },
    { label: 'National',      value: 123.0 },
    { label: 'Continental',   value: 119.5 },
    { label: 'Olympic Final', value: 117.0 },
    { label: 'World Record',  value: 113.28 }, // Kratochvílová 1983
  ],
  '1500m_F': [
    { label: 'Novice',        value: 360.0 },
    { label: 'School',        value: 305.0 },
    { label: 'Club',          value: 270.0 },
    { label: 'National',      value: 250.0 },
    { label: 'Continental',   value: 242.0 },
    { label: 'Olympic Final', value: 238.0 },
    { label: 'World Record',  value: 229.04 }, // Kipyegon 2023
  ],
  '5000m_F': [
    { label: 'Novice',        value: 1380.0 },
    { label: 'School',        value: 1170.0 },
    { label: 'Club',          value: 1020.0 },
    { label: 'National',      value: 920.0  },
    { label: 'Continental',   value: 885.0  },
    { label: 'Olympic Final', value: 865.0  },
    { label: 'World Record',  value: 840.21 }, // Gidey 2020
  ],
  'Marathon_F': [
    { label: 'Novice',        value: 18000 }, // 5:00:00
    { label: 'School',        value: 14400 }, // 4:00:00
    { label: 'Club',          value: 12600 }, // 3:30:00
    { label: 'National',      value: 10200 }, // 2:50:00
    { label: 'Continental',   value: 9000  }, // 2:30:00
    { label: 'Olympic Final', value: 8700  }, // 2:25:00
    { label: 'World Record',  value: 7796  }, // Chepngetich 2:09:56 (2024)
  ],
  '100mH_F': [
    { label: 'Novice',        value: 18.00 },
    { label: 'School',        value: 15.50 },
    { label: 'Club',          value: 14.20 },
    { label: 'National',      value: 13.30 },
    { label: 'Continental',   value: 12.80 },
    { label: 'Olympic Final', value: 12.45 },
    { label: 'World Record',  value: 12.12 }, // Amusan 2022
  ],
  '400mH_F': [
    { label: 'Novice',        value: 80.0 },
    { label: 'School',        value: 68.0 },
    { label: 'Club',          value: 61.0 },
    { label: 'National',      value: 56.5 },
    { label: 'Continental',   value: 54.2 },
    { label: 'Olympic Final', value: 53.0 },
    { label: 'World Record',  value: 50.68 }, // McLaughlin-Levrone 2022
  ],
  'Long Jump_F': [
    { label: 'Novice',        value: 3.20 },
    { label: 'School',        value: 4.70 },
    { label: 'Club',          value: 5.60 },
    { label: 'National',      value: 6.35 },
    { label: 'Continental',   value: 6.75 },
    { label: 'Olympic Final', value: 6.95 },
    { label: 'World Record',  value: 7.52 }, // Chistyakova 1988
  ],
  'Triple Jump_F': [
    { label: 'Novice',        value: 7.50  },
    { label: 'School',        value: 10.00 },
    { label: 'Club',          value: 12.00 },
    { label: 'National',      value: 13.70 },
    { label: 'Continental',   value: 14.40 },
    { label: 'Olympic Final', value: 14.90 },
    { label: 'World Record',  value: 15.74 }, // Rojas 2022
  ],
  'High Jump_F': [
    { label: 'Novice',        value: 1.20 },
    { label: 'School',        value: 1.50 },
    { label: 'Club',          value: 1.70 },
    { label: 'National',      value: 1.85 },
    { label: 'Continental',   value: 1.93 },
    { label: 'Olympic Final', value: 2.00 },
    { label: 'World Record',  value: 2.09 }, // Kostadinova 1987
  ],
  'Pole Vault_F': [
    { label: 'Novice',        value: 2.00 },
    { label: 'School',        value: 3.00 },
    { label: 'Club',          value: 3.80 },
    { label: 'National',      value: 4.35 },
    { label: 'Continental',   value: 4.65 },
    { label: 'Olympic Final', value: 4.85 },
    { label: 'World Record',  value: 5.06 }, // Sidorova / Morris tier
  ],
  'Shot Put_F': [
    { label: 'Novice',        value: 5.00  },
    { label: 'School',        value: 10.00 },
    { label: 'Club',          value: 13.50 },
    { label: 'National',      value: 16.50 },
    { label: 'Continental',   value: 18.20 },
    { label: 'Olympic Final', value: 19.50 },
    { label: 'World Record',  value: 22.63 }, // Lisovskaya 1987
  ],
  'Discus Throw_F': [
    { label: 'Novice',        value: 15.0 },
    { label: 'School',        value: 30.0 },
    { label: 'Club',          value: 45.0 },
    { label: 'National',      value: 56.0 },
    { label: 'Continental',   value: 62.0 },
    { label: 'Olympic Final', value: 66.0 },
    { label: 'World Record',  value: 76.80 }, // Reinsch 1988
  ],
  'Hammer Throw_F': [
    { label: 'Novice',        value: 20.0 },
    { label: 'School',        value: 35.0 },
    { label: 'Club',          value: 50.0 },
    { label: 'National',      value: 63.0 },
    { label: 'Continental',   value: 71.0 },
    { label: 'Olympic Final', value: 76.0 },
    { label: 'World Record',  value: 82.98 }, // Włodarczyk 2016
  ],
  'Javelin Throw_F': [
    { label: 'Novice',        value: 15.0 },
    { label: 'School',        value: 30.0 },
    { label: 'Club',          value: 42.0 },
    { label: 'National',      value: 54.0 },
    { label: 'Continental',   value: 61.0 },
    { label: 'Olympic Final', value: 66.0 },
    { label: 'World Record',  value: 72.28 }, // Špotáková 2008
  ],
}

export function getReferenceTiers(discipline, sex = 'M') {
  return REFERENCE_TIERS[`${discipline}_${sex}`] || REFERENCE_TIERS[`100m_${sex}`] || REFERENCE_TIERS['100m_M']
}

// Position an athlete along the reference-tier ladder.
// Returns { percent, tiers: [{label, value, percent}], nearestTier, direction }
// `percent` is 0..100 where 0 = Novice end, 100 = World Record end.
// For time-based events (lower-is-better) the ladder is flipped internally so
// faster times still render further right (higher percent).
export function performancePosition(pb, discipline, sex = 'M') {
  const tiers = getReferenceTiers(discipline, sex)
  const cal = getCalibration(discipline, sex)
  const higher = !!cal.higher

  // Assign each tier an evenly-spaced percent along the arc (0, 16.7, 33.3, ...)
  const n = tiers.length
  const tierPoints = tiers.map((t, i) => ({
    label: t.label,
    value: t.value,
    percent: (i / (n - 1)) * 100,
  }))

  if (pb == null) {
    return { percent: null, tiers: tierPoints, nearestTier: null }
  }

  // Piecewise linear interpolation between the tier values.
  // For lower-is-better events, the tier values are already descending
  // (novice 14.50s → WR 9.58s) so "further right" still means faster.
  let percent = null
  const getBetter = (a, b) => higher ? (a >= b) : (a <= b)

  // Edge cases: below first tier or beyond last
  const first = tierPoints[0], last = tierPoints[n - 1]
  if (!getBetter(pb, first.value)) {
    // Worse than novice — clamp near 0% but still show something
    percent = 2
  } else if (getBetter(pb, last.value)) {
    // Better than world record (unlikely) — clamp at top
    percent = 100
  } else {
    for (let i = 0; i < n - 1; i++) {
      const a = tierPoints[i], b = tierPoints[i + 1]
      const inBetween = higher
        ? (pb >= a.value && pb <= b.value)
        : (pb <= a.value && pb >= b.value)
      if (inBetween) {
        const span = b.value - a.value
        const frac = span === 0 ? 0 : (pb - a.value) / span
        percent = a.percent + frac * (b.percent - a.percent)
        break
      }
    }
  }

  // Find the nearest tier label (the tier just achieved)
  let nearestTier = tierPoints[0]
  for (const t of tierPoints) {
    if (getBetter(pb, t.value)) nearestTier = t
  }
  // Next tier up (what they're chasing)
  const nextIdx = Math.min(n - 1, tierPoints.indexOf(nearestTier) + 1)
  const nextTier = tierPoints[nextIdx]

  return {
    percent: Math.max(0, Math.min(100, percent ?? 0)),
    tiers: tierPoints,
    nearestTier,
    nextTier,
    higher,
  }
}

// ══════════════════════════════════════════════════════════════════════
// DNA RADAR — 6 axes mapped from athlete_metrics
// ══════════════════════════════════════════════════════════════════════
// Reference ranges: [development, club, good, elite, world]
// Scores map linearly so: development→40, club→55, good→70, elite→85, world→98
const REFERENCE_RANGES = {
  // Lower is better for splits and times → ranges listed worst→best
  sprint_10m:   { worst: 2.10, best: 1.50, lowerBetter: true },
  sprint_30m:   { worst: 4.60, best: 3.70, lowerBetter: true },
  flying_10m:   { worst: 1.10, best: 0.82, lowerBetter: true },
  max_velocity: { worst: 8.5,  best: 12.3, lowerBetter: false },
  sprint_60m:   { worst: 7.90, best: 6.40, lowerBetter: true },
  split_300m:   { worst: 45.0, best: 32.5, lowerBetter: true },

  cmj_height:   { worst: 30,   best: 70,   lowerBetter: false },
  sj_height:    { worst: 28,   best: 65,   lowerBetter: false },
  broad_jump:   { worst: 2.00, best: 3.50, lowerBetter: false },
  rsi_dj30:     { worst: 1.20, best: 3.20, lowerBetter: false },
  rsi_mod:      { worst: 0.30, best: 0.95, lowerBetter: false },
  cmj_rel_pp:   { worst: 40,   best: 85,   lowerBetter: false },

  back_squat_1rm: { worst: 80,  best: 220, lowerBetter: false }, // absolute kg
  bench_1rm:      { worst: 60,  best: 180, lowerBetter: false },
  deadlift_1rm:   { worst: 100, best: 260, lowerBetter: false },
  power_clean_1rm:{ worst: 60,  best: 160, lowerBetter: false },
  imtp_rel_force: { worst: 20,  best: 45,  lowerBetter: false },

  sit_and_reach:  { worst: -5,  best: 35,  lowerBetter: false },
  knee_to_wall_l: { worst: 4,   best: 14,  lowerBetter: false },
  knee_to_wall_r: { worst: 4,   best: 14,  lowerBetter: false },
  fms_total:      { worst: 10,  best: 19,  lowerBetter: false },
  shoulder_flex:  { worst: 140, best: 185, lowerBetter: false },

  vo2_max:    { worst: 42, best: 80, lowerBetter: false },
  yoyo_ir1:   { worst: 800, best: 2800, lowerBetter: false },
  mas:        { worst: 14,  best: 22,  lowerBetter: false },
  iftt_30_15: { worst: 15,  best: 22,  lowerBetter: false },
  rhr:        { worst: 75,  best: 38,  lowerBetter: true },
}

// Map metric keys → radar axis
const AXIS_MAP = {
  acceleration: ['sprint_10m', 'sprint_30m', 'broad_jump'],
  topSpeed:     ['flying_10m', 'max_velocity', 'sprint_60m'],
  power:        ['cmj_height', 'sj_height', 'rsi_dj30', 'rsi_mod', 'cmj_rel_pp'],
  strength:     ['back_squat_1rm', 'deadlift_1rm', 'imtp_rel_force', 'power_clean_1rm', 'bench_1rm'],
  mobility:     ['sit_and_reach', 'knee_to_wall_l', 'knee_to_wall_r', 'fms_total', 'shoulder_flex'],
  conditioning: ['vo2_max', 'yoyo_ir1', 'mas', 'iftt_30_15', 'rhr'],
}

export const RADAR_AXES = [
  { key: 'acceleration', label: 'Accel' },
  { key: 'topSpeed',     label: 'Top Speed' },
  { key: 'power',        label: 'Power' },
  { key: 'strength',     label: 'Strength' },
  { key: 'mobility',     label: 'Mobility' },
  { key: 'conditioning', label: 'Conditioning' },
]

function scoreMetric(key, value) {
  const r = REFERENCE_RANGES[key]
  if (!r || value == null) return null
  const span = r.best - r.worst
  if (span === 0) return null
  const pct = (value - r.worst) / span // may be >1 or <0
  return Math.max(5, Math.min(100, Math.round(pct * 100)))
}

// Build the DNA radar scores from the most recent metric per key.
// Returns { acceleration: {score, metrics:[...]}, ... }
export function buildDnaProfile(metrics) {
  const latestByKey = {}
  for (const r of metrics || []) {
    const prev = latestByKey[r.metric_key]
    if (!prev || new Date(r.recorded_at) > new Date(prev.recorded_at)) {
      latestByKey[r.metric_key] = r
    }
  }

  const result = {}
  for (const axis of RADAR_AXES) {
    const keys = AXIS_MAP[axis.key] || []
    const scored = []
    for (const k of keys) {
      const row = latestByKey[k]
      if (!row) continue
      const s = scoreMetric(k, Number(row.value))
      if (s != null) scored.push({ key: k, label: row.metric_label, value: Number(row.value), unit: row.unit, score: s })
    }
    const avg = scored.length
      ? Math.round(scored.reduce((s, x) => s + x.score, 0) / scored.length)
      : null
    result[axis.key] = { score: avg, metrics: scored }
  }
  return result
}

// ══════════════════════════════════════════════════════════════════════
// ATHLETE DNA TIERS + AGE-ADJUSTMENT
// Powers "The Ladder" — a replacement for the DNA radar that places the
// athlete on a named 5-tier continuum per physical axis.
// ══════════════════════════════════════════════════════════════════════

// 5-tier continuum. Cutoffs are the LOWER bound of each tier against an
// age-adjusted 0-100 score.
export const DNA_TIERS = [
  { key: 'emerging',   label: 'Emerging',   min: 0,  color: '#64748b' }, // slate
  { key: 'developing', label: 'Developing', min: 20, color: '#3b82f6' }, // blue
  { key: 'proficient', label: 'Proficient', min: 40, color: '#14b8a6' }, // teal
  { key: 'excellent',  label: 'Excellent',  min: 60, color: '#f59e0b' }, // amber
  { key: 'elite',      label: 'Elite',      min: 80, color: '#f97316' }, // orange/gold
]

export function scoreToTier(score) {
  if (score == null) return null
  let tier = DNA_TIERS[0]
  for (const t of DNA_TIERS) if (score >= t.min) tier = t
  const idx = DNA_TIERS.indexOf(tier)
  const nextTier = DNA_TIERS[idx + 1] || null
  const toNext = nextTier ? Math.max(0, nextTier.min - score) : 0
  return { ...tier, index: idx, nextTier, toNext }
}

// Per-axis "maturity age" — age at which adult norms should apply 1:1.
// Under this age, we boost the raw score so young athletes aren't judged
// against grown-adult benchmarks they're biologically not ready to hit.
// Boost rate = points added per year below maturity, capped at +30.
const AXIS_AGE_CURVE = {
  acceleration: { maturity: 20, rate: 1.2 },
  topSpeed:     { maturity: 23, rate: 1.5 },
  power:        { maturity: 21, rate: 2.0 },
  strength:     { maturity: 22, rate: 2.5 }, // strength matures latest
  mobility:     { maturity: 16, rate: 0.5 }, // mobility expected at all ages
  conditioning: { maturity: 22, rate: 1.5 },
}

// Returns { adjusted, raw, boost } for a raw 0-100 score at a given age.
// If age is null, returns raw unchanged.
export function ageAdjustScore(rawScore, axisKey, age) {
  if (rawScore == null) return null
  if (age == null || !Number.isFinite(age)) {
    return { adjusted: rawScore, raw: rawScore, boost: 0 }
  }
  const curve = AXIS_AGE_CURVE[axisKey]
  if (!curve) return { adjusted: rawScore, raw: rawScore, boost: 0 }
  const underBy = Math.max(0, curve.maturity - age)
  const boost = Math.min(30, Math.round(underBy * curve.rate))
  const adjusted = Math.max(5, Math.min(100, rawScore + boost))
  return { adjusted, raw: rawScore, boost }
}

// Plain-English info for each DNA axis, used by the (ⓘ) popover on the
// Ladder rows. `why` is generic; the Ladder component can override it per
// discipline family if needed.
export const AXIS_INFO = {
  acceleration: {
    what: 'How quickly you can reach top speed from a standing or slow start.',
    why:  'Acceleration decides how much of your race is spent catching up vs. running fast. Critical in the first 30m.',
    how:  ['Short sprints from blocks or 3-point stance (10–30m)', 'Sled pushes and resisted starts for horizontal power'],
  },
  topSpeed: {
    what: 'The fastest speed you can hit at full stride, once you are already running.',
    why:  'Top speed is the single strongest predictor of 100m and 200m performance. It is also the hardest quality to improve.',
    how:  ['Flying sprints (20–40m) with a running start', 'Max-velocity technique drills — tall posture, front-side mechanics'],
  },
  power: {
    what: 'How much force you can put into the ground in a very short time — the spring in your step.',
    why:  'Power turns strength into speed. High jumpers, sprinters and throwers all live on this quality.',
    how:  ['Countermovement and depth jumps for vertical power', 'Broad jumps and bounds for horizontal power'],
  },
  strength: {
    what: 'The peak force your muscles can produce, usually measured in the squat, deadlift or pulling movements.',
    why:  'Strength is the foundation that power and speed are built on. Under-developed strength caps every other quality.',
    how:  ['Progressive back squat and deadlift programming', 'Olympic lifts like power cleans for explosive strength'],
  },
  mobility: {
    what: 'How freely your joints and muscles move through the positions your sport requires.',
    why:  'Restricted mobility leaks power and increases injury risk. Hurdlers and throwers need far more than sprinters.',
    how:  ['Daily movement prep — hips, ankles, thoracic spine', 'Dynamic stretches before training, static holds after'],
  },
  conditioning: {
    what: 'How long you can sustain high-intensity work before your pace drops.',
    why:  'Critical for 400m, 800m and anything longer. Also helps sprinters recover between training reps.',
    how:  ['Tempo runs and extensive intervals for aerobic base', 'Repeat sprint ability work for anaerobic capacity'],
  },
}

// ══════════════════════════════════════════════════════════════════════
// LIMITING FACTOR ANALYSIS
// For a given discipline family, returns a ranked list of priority axes
// along with expected values at the athlete's current performance level.
// ══════════════════════════════════════════════════════════════════════
const AXIS_PRIORITY = {
  sprint:      ['topSpeed', 'power', 'acceleration', 'strength', 'mobility', 'conditioning'],
  longSprint:  ['conditioning', 'topSpeed', 'strength', 'power', 'acceleration', 'mobility'],
  hurdles:     ['topSpeed', 'mobility', 'power', 'acceleration', 'strength', 'conditioning'],
  jumps:       ['power', 'acceleration', 'topSpeed', 'strength', 'mobility', 'conditioning'],
  throws:      ['strength', 'power', 'mobility', 'acceleration', 'topSpeed', 'conditioning'],
  midDistance: ['conditioning', 'strength', 'power', 'topSpeed', 'mobility', 'acceleration'],
  distance:    ['conditioning', 'strength', 'mobility', 'power', 'topSpeed', 'acceleration'],
}

export function disciplinePriority(discipline) {
  return AXIS_PRIORITY[disciplineFamily(discipline)] || AXIS_PRIORITY.sprint
}

// Expected metric values at a given performance level (percentile 0-100).
// Linear interpolation between development (p20) and elite (p90) within
// the REFERENCE_RANGES. For sprint-family athletes, scaled by their
// performance percentile so a P89 athlete is expected to have ~P85 physicals.
export function expectedMetric(key, perfPercentile) {
  const r = REFERENCE_RANGES[key]
  if (!r) return null
  // Map perf percentile 20..98 → range position 0..1
  const p = Math.max(0.10, Math.min(0.95, (perfPercentile - 10) / 90))
  return r.worst + (r.best - r.worst) * p
}

// Estimate impact on sprint time from improving a single metric.
// Returns estimated seconds saved on 100 m if `currentValue` → `targetValue`.
// Coefficients are simplified from published regressions.
export function estimateSprintImpact(metricKey, currentValue, targetValue) {
  const delta = targetValue - currentValue
  const C = {
    cmj_height:   -0.03,   // -0.03 s per +1 cm CMJ
    sj_height:    -0.025,
    broad_jump:   -0.25,   // -0.25 s per +1 m broad jump (≈ -0.025 per 10 cm)
    rsi_dj30:     -0.08,
    max_velocity: -0.35,   // -0.035 s per +0.1 m/s
    sprint_10m:    0.60,   // +0.60 s per +1 s on 10 m split (direct contribution)
    sprint_30m:    0.75,
    back_squat_1rm: -0.004, // -0.004 s per +1 kg absolute
    deadlift_1rm:  -0.003,
    imtp_rel_force: -0.015,
    power_clean_1rm: -0.005,
  }
  const c = C[metricKey]
  if (c == null) return 0
  return c * delta
}

// Main limiting-factor picker. Returns:
//   { axis, metricKey, currentValue, expectedValue, gap, estImpactSec }
// or null if no data.
export function findLimitingFactor(dnaProfile, discipline, perfPercentile) {
  const priority = disciplinePriority(discipline)
  const candidates = []
  for (const axis of priority) {
    const data = dnaProfile[axis]
    if (!data || !data.metrics || data.metrics.length === 0) continue
    for (const m of data.metrics) {
      const expected = expectedMetric(m.key, perfPercentile)
      if (expected == null) continue
      const r = REFERENCE_RANGES[m.key]
      const gap = r.lowerBetter ? (m.value - expected) : (expected - m.value)
      // Only flag as limiter if athlete is below expected
      if (gap <= 0) continue
      const impact = estimateSprintImpact(m.key, m.value, expected)
      candidates.push({
        axis,
        axisLabel: RADAR_AXES.find(a => a.key === axis)?.label || axis,
        metricKey: m.key,
        metricLabel: m.label,
        unit: m.unit,
        currentValue: m.value,
        expectedValue: expected,
        gap,
        score: data.score,
        estImpactSec: Math.abs(impact),
      })
    }
  }
  candidates.sort((a, b) => b.estImpactSec - a.estImpactSec || a.score - b.score)
  return candidates[0] || null
}

// What's missing — a prompt to log what they haven't yet, prioritised.
export function findMissingPriority(dnaProfile, discipline) {
  const priority = disciplinePriority(discipline)
  for (const axis of priority) {
    const data = dnaProfile[axis]
    if (!data || !data.metrics || data.metrics.length === 0) {
      return {
        axis,
        axisLabel: RADAR_AXES.find(a => a.key === axis)?.label || axis,
      }
    }
  }
  return null
}

// ══════════════════════════════════════════════════════════════════════
// SCIENCE SPOTLIGHT CARDS
// ══════════════════════════════════════════════════════════════════════
const SCIENCE_CARDS = {
  sprint: [
    { title: 'Why CMJ matters', metric: 'Countermovement jump',
      body: 'Vertical jump height correlates strongly (r ≈ -0.7) with 100 m time in elite sprinters. CMJ captures explosive concentric power — the same quality that drives your first ground contacts out of the blocks.',
      target: 'Target CMJ for sub-10.3 100 m: >60 cm.' },
    { title: 'Top-end speed is king', metric: 'Max velocity',
      body: 'The single biggest difference between 100 m finalists and semifinalists is the max velocity phase between 40–70 m. Finalists hold their top speed longer, not just hit a higher peak.',
      target: 'Elite men: 11.5–12.3 m/s. Women: 10.0–10.8 m/s.' },
    { title: 'Reactive strength predicts top speed', metric: 'RSI',
      body: 'RSI from a 30 cm drop jump has an r ≈ 0.6 correlation with 100 m performance. Short ground contacts (<100 ms) at max velocity are the signature of elite sprinters.',
      target: 'Target RSI: >2.5 m/s for international-level sprinters.' },
    { title: 'Relative strength still matters', metric: 'Back squat 1RM / BW',
      body: 'Sprinters who squat >2× bodyweight tend to cluster in the finalist group. Above 2.5× the curve flattens — past that, power and plyometrics dominate.',
      target: 'Priority zone: 1.8×–2.2× bodyweight.' },
    { title: 'Acceleration ≠ top speed', metric: '0–10 m split',
      body: 'Your acceleration mechanics are biomechanically distinct from your max-velocity mechanics. Elite 100 m runners have very different 10 m and flying-10 times — training both matters.',
      target: 'Men sub-10.3: 10 m < 1.85 s, flying-10 < 0.90 s.' },
  ],
  longSprint: [
    { title: 'Speed reserve defines the 400 m', metric: 'Max velocity',
      body: '400 m runners with a higher personal max velocity run 400s at a lower % of their top speed, which reduces lactate accumulation. Your flying-10 m time is a direct predictor of 400 m potential.',
      target: 'Finalists: flying-10 ≤ 0.96 s (men), ≤ 1.04 s (women).' },
    { title: '300 m split is the best predictor', metric: '300 m time trial',
      body: 'A single 300 m time trial predicts 400 m performance to within ~0.5 s. Add 3.5 s to your 300 m split as a rough 400 m estimate.',
      target: 'Sub-45 400 m: 300 m split ≤ 32.5 s.' },
    { title: 'Speed endurance matters', metric: 'Yo-Yo IR1',
      body: 'Though 400 m is largely anaerobic, Yo-Yo IR1 distance correlates with the ability to hold form in the final 100 m. It indexes your repeated-effort capacity.',
      target: 'Elite 400 m runners: Yo-Yo IR1 > 2200 m.' },
    { title: 'Hip flexor mobility = stride length', metric: 'Thomas test',
      body: 'Tight hip flexors limit hip extension and steal 3–5 cm of stride length per step. Over 400 m that adds up to 2–3 m of running distance.',
      target: 'Pass Thomas test both sides.' },
    { title: 'Relative strength still pays', metric: 'Back squat 1RM / BW',
      body: '400 m runners benefit from a ~2× bodyweight squat. Past that, specific speed work drives the bigger gains.',
      target: 'Priority: 1.7×–2.0× bodyweight.' },
  ],
  jumps: [
    { title: 'Approach speed drives distance', metric: 'Max velocity',
      body: 'Long jumpers with higher penultimate-step speeds jump further — each 0.1 m/s of approach speed adds ~10 cm of jump. Pure sprint speed is your ceiling.',
      target: 'Elite LJ men: approach speed > 10.5 m/s.' },
    { title: 'RSI predicts take-off efficiency', metric: 'RSI',
      body: 'Drop jump RSI is one of the strongest predictors of jump-event performance, capturing the short-contact stiffness required at take-off.',
      target: 'Elite jumpers: RSI > 3.0 m/s.' },
    { title: 'Squat strength sets the base', metric: 'Back squat 1RM / BW',
      body: 'Jumps athletes typically squat 2× bodyweight before plyometric gains dominate. Below that, strength is usually the first limiter.',
      target: '1.8×–2.2× bodyweight.' },
    { title: 'Ankle stiffness matters', metric: 'Knee-to-wall',
      body: 'Ankle dorsiflexion range determines how much of the ground-contact force you can transfer into vertical velocity. Limited range costs centimetres.',
      target: '≥ 10 cm both sides.' },
    { title: 'Hops are sport-specific', metric: 'Broad jump',
      body: 'Horizontal jumps respond most to horizontal plyometrics. Broad jump progression tracks closely with long jump PRs in training cycles.',
      target: 'Elite LJ men: broad jump > 3.20 m.' },
  ],
  throws: [
    { title: 'IMTP peak force is the #1 predictor', metric: 'IMTP peak force',
      body: 'For throws events, isometric mid-thigh pull peak force has the strongest single correlation (r ≈ 0.8) with throw distance. It captures your ability to apply force against the ground — the start of every throw.',
      target: 'Elite male throwers: > 4000 N.' },
    { title: 'Upper body strength writes the ceiling', metric: 'Bench press 1RM',
      body: 'Shot put distance correlates ~0.75 with bench press 1RM in elite throwers. For every 10 kg on the bench, expect ~30–40 cm on the shot.',
      target: 'Shot 20 m men: bench > 200 kg.' },
    { title: 'Power clean indexes transfer', metric: 'Power clean 1RM',
      body: 'Unlike bench/squat, power clean captures your ability to express maximum force rapidly against the ground — exactly what throws require.',
      target: '> 1.3× bodyweight for top-tier.' },
    { title: 'Rotational mobility unlocks distance', metric: 'Thoracic rotation',
      body: 'Rotational throws (discus, hammer) depend heavily on separation between pelvis and shoulders. 10° more trunk rotation = measurable distance gain.',
      target: 'Mobility audit every 6 weeks.' },
    { title: 'Body mass is a weapon', metric: 'Body mass',
      body: 'Among elite throwers, body mass has a positive correlation (r ≈ 0.5) with distance. Lean mass and total mass both contribute — DEXA > BIA for tracking.',
      target: 'Track monthly, not daily.' },
  ],
  midDistance: [
    { title: 'VO₂max sets the ceiling', metric: 'VO₂max',
      body: 'VO₂max is the single best predictor of 1500 m performance. Elite male 1500 m runners sit at 75–85 ml/kg/min.',
      target: '> 72 ml/kg/min for sub-3:40 1500 m.' },
    { title: 'Running economy decides the race', metric: 'MAS / economy',
      body: 'Two athletes with the same VO₂max can run 10 seconds apart over 1500 m because of running economy. MAS is the best field measure.',
      target: 'Elite men: MAS > 21 km/h.' },
    { title: 'Top speed is a weapon', metric: 'Flying 20 m',
      body: 'The fastest finish in the last 400 m of a 1500 m often wins. Your top-end speed reserve determines how hard you can kick.',
      target: '1500 m specialists: flying 20 m < 2.1 s.' },
    { title: 'Strength doesn\'t slow you down', metric: 'Back squat 1RM / BW',
      body: 'Counter to folklore, heavy strength training improves running economy in middle-distance runners by up to 5 % without adding mass.',
      target: '1.5×–1.8× bodyweight.' },
    { title: 'HRV is your training compass', metric: 'HRV (RMSSD)',
      body: 'A 7-day HRV rolling average tracks accumulated fatigue better than subjective wellness scores. A 10 % drop warrants an easy day.',
      target: 'Morning HRV, supine, same time daily.' },
  ],
  distance: [
    { title: 'VO₂max is necessary, not sufficient', metric: 'VO₂max',
      body: 'At elite level, VO₂max is high but similar across athletes. Economy and lactate threshold become the differentiators.',
      target: '> 70 ml/kg/min for 5 000 m sub-13:30.' },
    { title: 'Lactate threshold is the second gear', metric: 'Threshold pace',
      body: 'Your LT pace is the % of VO₂max you can hold for ~1 hour. Elite distance runners sit at 88 %+ of VO₂max at threshold.',
      target: 'Raise via tempo runs, not intervals.' },
    { title: 'Running economy pays compounding interest', metric: 'Economy',
      body: 'A 1 % improvement in economy delivers ~0.7 % faster race times. Strength training, plyometrics and drills all contribute.',
      target: 'Revisit form cues monthly.' },
    { title: 'Durability is the hidden variable', metric: 'FMS total',
      body: 'Distance runners break down between 160–200 km/week. Mobility and functional movement scores are early indicators of injury risk.',
      target: 'FMS total > 14, no asymmetries.' },
    { title: 'Resting HR tracks aerobic base', metric: 'Resting heart rate',
      body: 'A 5-bpm drop in resting HR over a base phase typically means your aerobic base is building. Track weekly averages, not single readings.',
      target: '< 45 bpm for elite distance runners.' },
  ],
  hurdles: [
    { title: 'Rhythm beats speed', metric: 'Stride frequency',
      body: 'Hurdles is a rhythm event. The top hurdlers are not the fastest sprinters — they\'re the ones who lose the least time clearing each barrier.',
      target: 'Aim for < 0.08 s lost per hurdle.' },
    { title: 'Hip mobility = faster clearance', metric: 'Active straight-leg raise',
      body: 'Hurdle clearance demands 120°+ of hip flexion. Tight hips cost contact time and rhythm.',
      target: 'ASLR > 100° both sides.' },
    { title: 'Reactive strength is essential', metric: 'RSI',
      body: 'Quick ground contacts between hurdles depend on reactive strength. RSI strongly correlates with between-hurdle times.',
      target: '> 2.5 m/s.' },
    { title: 'Strength helps trail leg mechanics', metric: 'Squat 1RM / BW',
      body: 'Rear-leg strength helps maintain sprint posture through the hurdle clearance, preventing the common "sit-back" at the barrier.',
      target: '1.7×–2.0× bodyweight.' },
    { title: 'Flat-sprint speed is your ceiling', metric: '60 m flat',
      body: 'A fast flat 60 m is the prerequisite — you can\'t hurdle faster than you can sprint. Below 6.70 limits you to club level.',
      target: 'Men sub-13.30: 60 m flat < 6.70 s.' },
  ],
}

export function getScienceCards(discipline) {
  const family = disciplineFamily(discipline)
  return SCIENCE_CARDS[family] || SCIENCE_CARDS.sprint
}

// Pick a deterministic card for the current day so it rotates without
// feeling random. Same card all day, different the next day.
export function getDailyScienceCard(discipline, date = new Date()) {
  const cards = getScienceCards(discipline)
  const dayOfYear = Math.floor(
    (date - new Date(date.getFullYear(), 0, 0)) / 86400000
  )
  return cards[dayOfYear % cards.length]
}

// ═══════════════════════════════════════════════════════════════════
// PERFORMANCE LEVELS — bnchmrkd level system (1-12)
// Calibrated against Olympic-level dataset (628K+ race records)
// Throws: higher = better · Sprints/Hurdles: lower = better
// Levels 1-9: all age groups · Levels 10-12: Senior only
// ═══════════════════════════════════════════════════════════════════

export const LEVEL_NAMES = {
  1: 'Foundation', 2: 'Development', 3: 'Club', 4: 'County',
  5: 'Regional', 6: 'Area', 7: 'National Entry', 8: 'National',
  9: 'National Elite', 10: 'International Entry', 11: 'International', 12: 'World Class',
};

export const LEVEL_COLORS = {
  1: '#64748b', 2: '#64748b', 3: '#8b5cf6', 4: '#8b5cf6',
  5: '#3b82f6', 6: '#3b82f6', 7: '#0ea5e9', 8: '#0ea5e9',
  9: '#10b981', 10: '#f59e0b', 11: '#f97316', 12: '#ef4444',
};

// Disciplines where lower value = better (time-based)
const TIME_DISCIPLINES = [
  '100m', '200m', '400m', '60m', '75m', '150m', '300m',
  '100mH', '110mH', '400mH', '60mH', '75mH', '80mH',
  '70mH', '300mH',
];

export const isTimeDiscipline = (discipline) =>
  TIME_DISCIPLINES.some(t => discipline === t || discipline?.replace(/\s/g, '') === t);

// Key: discipline_gender, each age group has thresholds for L1-L12 (null = N/A)
// For time disciplines: L1 = slowest (easiest), L12 = fastest (hardest)
// For throws: L1 = shortest (easiest), L12 = longest (hardest)
export const PERFORMANCE_LEVELS = {
  // ── THROWS ──────────────────────────────────────────────────────
  'Shot Put_M': {
    U13:   [6.25, 6.65, 7.05, 7.45, 8.05, 8.65, 9.25, 9.85, 10.45, null, null, null],
    U15:   [7.45, 8.05, 8.65, 9.25, 9.85, 10.45, 11.25, 12.05, 12.85, null, null, null],
    U17:   [8.05, 8.65, 9.25, 9.85, 10.45, 11.25, 12.05, 12.85, 13.65, null, null, null],
    U20:   [9.25, 9.85, 10.45, 11.25, 12.05, 12.85, 13.65, 14.45, 15.25, null, null, null],
    Senior:[10.45, 11.25, 12.05, 12.85, 13.65, 14.65, 15.25, 16.05, 16.55, 19.50, 21.50, 22.00],
  },
  'Shot Put_F': {
    U13:   [5.05, 5.55, 6.05, 6.55, 7.05, 7.65, 8.25, 8.85, 9.45, null, null, null],
    U15:   [6.05, 6.55, 7.05, 7.65, 8.25, 8.85, 9.45, 10.05, 10.85, null, null, null],
    U17:   [7.05, 7.65, 8.25, 8.85, 9.45, 10.05, 10.85, 11.65, 12.45, null, null, null],
    U20:   [7.65, 8.25, 8.85, 9.45, 10.05, 10.85, 11.65, 12.45, 13.25, null, null, null],
    Senior:[8.85, 9.45, 10.25, 11.05, 11.85, 12.65, 13.45, 14.05, 14.85, 17.50, 19.50, 20.00],
  },
  'Discus Throw_M': {
    U13:   [10.05, 12.05, 14.05, 16.05, 18.05, 20.05, 22.05, 24.05, 26.05, null, null, null],
    U15:   [16.05, 18.05, 20.05, 22.05, 24.05, 26.05, 29.05, 32.05, 35.05, null, null, null],
    U17:   [20.05, 22.05, 24.05, 24.05, 29.05, 32.05, 35.05, 38.05, 41.05, null, null, null],
    U20:   [22.05, 24.05, 26.05, 29.05, 32.05, 35.05, 38.05, 41.05, 44.05, null, null, null],
    Senior:[29.05, 32.05, 35.05, 38.05, 41.05, 44.05, 47.05, 50.05, 52.05, 63.00, 67.50, 68.50],
  },
  'Discus Throw_F': {
    U13:   [10.05, 12.05, 14.05, 16.05, 18.05, 20.05, 22.05, 24.05, 26.05, null, null, null],
    U15:   [18.05, 20.05, 22.05, 24.05, 26.05, 29.05, 32.05, 35.05, 38.05, null, null, null],
    U17:   [22.05, 24.05, 26.05, 29.05, 32.05, 35.05, 38.05, 41.05, 44.05, null, null, null],
    U20:   [24.05, 26.05, 29.05, 32.05, 35.05, 38.05, 41.05, 44.05, 47.05, null, null, null],
    Senior:[29.05, 32.05, 35.05, 38.05, 41.05, 44.05, 47.05, 50.05, 52.05, 58.00, 65.00, 67.00],
  },
  'Hammer Throw_M': {
    U15:   [18.05, 21.05, 24.05, 27.05, 30.05, 33.05, 36.05, 39.05, 42.05, null, null, null],
    U17:   [27.05, 30.05, 33.05, 36.05, 39.05, 42.05, 45.05, 48.05, 51.05, null, null, null],
    U20:   [30.05, 33.05, 36.05, 39.05, 42.05, 45.05, 48.05, 51.05, 54.05, null, null, null],
    Senior:[39.05, 42.05, 45.05, 48.05, 51.05, 54.05, 57.05, 60.05, 62.05, 74.00, 79.00, 84.00],
  },
  'Hammer Throw_F': {
    U15:   [15.05, 18.05, 21.05, 24.05, 27.05, 30.05, 33.05, 36.05, 39.05, null, null, null],
    U17:   [21.05, 24.05, 27.05, 30.05, 33.05, 36.05, 39.05, 42.05, 45.05, null, null, null],
    U20:   [24.05, 27.05, 30.05, 33.05, 36.05, 39.05, 42.05, 45.05, 48.05, null, null, null],
    Senior:[36.05, 39.05, 42.05, 45.05, 48.05, 51.05, 54.05, 57.05, 59.05, 68.00, 75.00, 78.00],
  },
  'Javelin Throw_M': {
    U13:   [12.05, 14.05, 17.05, 20.05, 23.05, 26.05, 29.05, 32.05, 35.05, null, null, null],
    U15:   [20.05, 23.05, 26.05, 29.05, 32.05, 35.05, 38.05, 41.05, 44.05, null, null, null],
    U17:   [26.05, 29.05, 32.05, 35.05, 38.05, 41.05, 44.05, 47.05, 50.05, null, null, null],
    U20:   [32.05, 35.05, 38.05, 41.05, 44.05, 47.05, 50.05, 53.05, 56.05, null, null, null],
    Senior:[44.05, 47.05, 50.05, 53.05, 56.05, 59.05, 62.05, 65.05, 67.05, 82.00, 88.00, 90.00],
  },
  'Javelin Throw_F': {
    U13:   [9.05, 11.55, 14.05, 16.55, 19.05, 21.55, 24.05, 26.55, 29.05, null, null, null],
    U15:   [16.55, 19.05, 21.55, 24.05, 26.55, 29.05, 31.55, 34.05, 36.55, null, null, null],
    U17:   [24.05, 26.55, 29.05, 31.55, 34.05, 36.55, 39.05, 41.55, 44.05, null, null, null],
    U20:   [26.55, 29.05, 31.55, 34.05, 36.55, 39.05, 41.55, 44.05, 46.55, null, null, null],
    Senior:[31.55, 34.05, 36.55, 39.05, 41.55, 44.05, 46.55, 49.55, 51.05, 58.00, 65.00, 67.00],
  },

  // ── SPRINTS ─────────────────────────────────────────────────────
  '100m_M': {
    U13:   [15.98, 15.48, 14.98, 14.58, 14.18, 13.78, 13.38, 12.98, 12.68, null, null, null],
    U15:   [14.18, 13.78, 13.38, 12.98, 12.68, 12.48, 12.08, 11.88, 11.68, null, null, null],
    U17:   [12.98, 12.68, 12.48, 12.08, 11.88, 11.68, 11.48, 11.28, 11.18, null, null, null],
    U20:   [12.48, 12.08, 11.88, 11.68, 11.48, 11.28, 11.18, 11.08, 10.98, null, null, null],
    Senior:[11.68, 11.48, 11.28, 11.28, 11.08, 10.98, 10.88, 10.78, 10.68, 10.35, 10.15, 9.80],
  },
  '100m_F': {
    U13:   [16.98, 14.48, 15.98, 15.58, 15.18, 14.78, 14.38, 13.98, 13.68, null, null, null],
    U15:   [14.78, 14.38, 13.98, 13.68, 13.48, 13.28, 13.08, 12.88, 12.68, null, null, null],
    U17:   [13.98, 13.68, 13.48, 13.28, 13.08, 12.88, 12.68, 12.58, 12.48, null, null, null],
    U20:   [13.48, 13.28, 13.08, 12.88, 12.68, 12.58, 12.48, 12.38, 12.28, null, null, null],
    Senior:[13.48, 13.18, 12.98, 12.68, 12.63, 12.48, 12.28, 12.18, 12.08, 11.68, 11.50, 10.68],
  },
  '200m_M': {
    U13:   [32.98, 31.98, 30.98, 29.98, 28.98, 27.98, 26.98, 25.98, 25.48, null, null, null],
    U15:   [28.98, 27.98, 26.98, 25.98, 25.48, 24.98, 24.38, 24.18, 23.78, null, null, null],
    U17:   [25.98, 25.48, 24.98, 24.58, 24.18, 23.78, 23.38, 22.98, 22.78, null, null, null],
    U20:   [24.58, 24.18, 23.78, 23.38, 22.98, 22.78, 22.58, 22.38, 22.18, null, null, null],
    Senior:[23.78, 23.38, 22.98, 22.78, 22.58, 22.38, 22.18, 21.98, 21.68, 20.85, 20.62, 19.62],
  },
  '200m_F': {
    U13:   [35.98, 33.98, 32.68, 31.48, 30.78, 30.48, 29.68, 29.18, 28.48, null, null, null],
    U15:   [32.68, 31.68, 30.78, 30.48, 29.68, 29.18, 29.48, 28.48, 27.78, null, null, null],
    U17:   [30.78, 30.48, 29.68, 29.18, 28.48, 27.78, 27.18, 26.28, 26.28, null, null, null],
    U20:   [29.68, 29.18, 28.48, 27.78, 27.18, 26.68, 26.28, 25.88, 25.48, null, null, null],
    Senior:[28.48, 27.78, 27.18, 26.68, 26.28, 25.88, 25.48, 25.08, 24.68, 23.78, 23.55, 21.72],
  },
  '400m_M': {
    U17:   [63.98, 61.98, 59.98, 58.48, 56.98, 55.58, 54.18, 52.98, 51.98, null, null, null],
    U20:   [59.98, 58.48, 56.98, 55.58, 54.18, 52.98, 51.98, 50.98, 49.98, null, null, null],
    Senior:[56.98, 55.58, 54.18, 52.98, 51.98, 50.98, 49.98, 49.18, 48.48, 44.94, 44.64, 43.50],
  },
  '400m_F': {
    U17:   [71.98, 69.48, 66.98, 64.98, 62.98, 60.98, 59.48, 57.98, 56.98, null, null, null],
    U20:   [69.48, 66.98, 64.98, 62.98, 60.98, 59.48, 57.98, 56.98, 55.58, null, null, null],
    Senior:[69.48, 66.98, 64.98, 62.98, 60.98, 59.48, 57.98, 56.98, 55.58, 52.95, 52.65, 48.60],
  },

  // ── HURDLES ─────────────────────────────────────────────────────
  '100mH_F': {
    U20:   [18.77, 18.27, 17.77, 17.27, 17.27, 16.77, 16.27, 15.77, 15.47, null, null, null],
    Senior:[17.97, 17.77, 17.27, 16.77, 16.27, 15.77, 15.47, 14.97, 14.47, 13.42, 13.28, 12.33],
  },
  '110mH_M': {
    U20:   [18.47, 17.97, 17.47, 16.97, 16.47, 15.97, 15.47, 15.07, 14.77, null, null, null],
    Senior:[17.97, 17.47, 17.47, 16.47, 15.97, 15.47, 15.07, 14.77, 14.47, 13.98, 13.80, 13.20],
  },
  '400mH_M': {
    U20:   [66.97, 65.47, 63.97, 62.47, 60.97, 59.47, 57.97, 56.97, 55.97, null, null, null],
    Senior:[63.97, 62.47, 60.97, 59.47, 57.97, 56.97, 55.97, 54.97, 53.97, 48.58, 48.17, 46.50],
  },
  '400mH_F': {
    U20:   [82.47, 79.97, 77.47, 74.97, 72.97, 70.97, 68.97, 66.97, 64.97, null, null, null],
    Senior:[77.47, 74.97, 72.97, 70.97, 68.97, 66.97, 64.97, 63.47, 61.97, 57.95, 57.70, 52.00],
  },
};

// Map athlete age → athletics age group
export const getAgeGroup = (age) => {
  if (age < 13) return 'U13';
  if (age < 15) return 'U15';
  if (age < 17) return 'U17';
  if (age < 20) return 'U20';
  return 'Senior';
};

// Determine performance level for a given PB
// Throws: pb >= threshold (higher = better)
// Sprints/Hurdles: pb <= threshold (lower = better)
export const getPerformanceLevel = (discipline, gender, age, pb) => {
  const genderCode = gender === 'Male' ? 'M' : 'F';
  const key = `${discipline}_${genderCode}`;
  const levelData = PERFORMANCE_LEVELS[key];
  if (!levelData) return null;

  const ageGroup = getAgeGroup(age);
  const thresholds = levelData[ageGroup];
  if (!thresholds) return null;

  const isTime = isTimeDiscipline(discipline);

  // Walk from highest level down to find the best level the PB meets
  let level = 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (thresholds[i] !== null) {
      const meets = isTime ? (pb <= thresholds[i]) : (pb >= thresholds[i]);
      if (meets) {
        level = i + 1; // levels are 1-indexed
        break;
      }
    }
  }

  // Next level info
  let nextThreshold = null;
  let nextLevel = null;
  if (level < 12) {
    for (let i = level; i < thresholds.length; i++) {
      if (thresholds[i] !== null) {
        nextThreshold = thresholds[i];
        nextLevel = i + 1;
        break;
      }
    }
  }

  // Gap calculation: for time, gap is how much faster you need; for throws, how much further
  const gap = nextThreshold != null
    ? parseFloat((isTime ? (pb - nextThreshold) : (nextThreshold - pb)).toFixed(2))
    : null;

  return {
    level,
    name: level > 0 ? LEVEL_NAMES[level] : 'Below Foundation',
    color: level > 0 ? LEVEL_COLORS[level] : '#475569',
    ageGroup,
    nextLevel,
    nextName: nextLevel ? LEVEL_NAMES[nextLevel] : null,
    nextThreshold,
    gap,
    maxLevel: ageGroup === 'Senior' ? 12 : 9,
    isTime,
  };
};

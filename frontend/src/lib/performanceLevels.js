// ═══════════════════════════════════════════════════════════════════
// PERFORMANCE LEVELS — bnchmrkd level system (1-12)
// Calibrated against Olympic-level dataset · Higher = better for throws
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

// Key: discipline_gender, each age group has thresholds for L1-L12 (null = N/A)
export const PERFORMANCE_LEVELS = {
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
};

// Map athlete age → athletics age group
export const getAgeGroup = (age) => {
  if (age < 13) return 'U13';
  if (age < 15) return 'U15';
  if (age < 17) return 'U17';
  if (age < 20) return 'U20';
  return 'Senior';
};

// Determine performance level for a given PB (higher = better for throws)
export const getPerformanceLevel = (discipline, gender, age, pb) => {
  const genderCode = gender === 'Male' ? 'M' : 'F';
  const key = `${discipline}_${genderCode}`;
  const levelData = PERFORMANCE_LEVELS[key];
  if (!levelData) return null;

  const ageGroup = getAgeGroup(age);
  const thresholds = levelData[ageGroup];
  if (!thresholds) return null;

  // Walk from highest level down to find the best level the PB meets
  let level = 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (thresholds[i] !== null && pb >= thresholds[i]) {
      level = i + 1; // levels are 1-indexed
      break;
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

  return {
    level,
    name: level > 0 ? LEVEL_NAMES[level] : 'Below Foundation',
    color: level > 0 ? LEVEL_COLORS[level] : '#475569',
    ageGroup,
    nextLevel,
    nextName: nextLevel ? LEVEL_NAMES[nextLevel] : null,
    nextThreshold,
    gap: nextThreshold ? parseFloat((nextThreshold - pb).toFixed(2)) : null,
    maxLevel: ageGroup === 'Senior' ? 12 : 9,
  };
};

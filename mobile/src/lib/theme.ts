// ── bnchmrkd. Design Tokens ───────────────────────────────────────────
// Matching the web app's dark theme exactly.

export const colors = {
  // Backgrounds
  bg: {
    primary: '#0a0a0f',
    secondary: '#0d1117',
    card: 'rgba(255,255,255,0.02)',
    cardBorder: 'rgba(255,255,255,0.06)',
    input: '#1e293b',
    inputBorder: '#334155',
  },
  // Brand
  orange: {
    500: '#f97316',
    400: '#fb923c',
    300: '#fdba74',
    gradient: ['#f97316', '#fb923c'] as const,
  },
  // Text
  text: {
    primary: '#f8fafc',    // slate-50
    secondary: '#94a3b8',  // slate-400
    muted: '#64748b',      // slate-500
    dimmed: '#475569',     // slate-600
  },
  // Status
  green: '#34d399',
  red: '#fb7185',
  blue: '#3b82f6',
  teal: '#14b8a6',
  amber: '#f59e0b',
  purple: '#a78bfa',
  // DNA category tints
  category: {
    speed: '#f97316',
    power: '#fb923c',
    strength: '#f43f5e',
    endurance: '#3b82f6',
    mobility: '#14b8a6',
    anthropometrics: '#a78bfa',
  } as Record<string, string>,
  // DNA tiers
  tier: {
    emerging: '#64748b',
    developing: '#3b82f6',
    proficient: '#14b8a6',
    excellent: '#f59e0b',
    elite: '#f97316',
  },
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const

export const fonts = {
  mono: { fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  display: { fontSize: 16, fontWeight: '600' as const },
  hero: { fontSize: 32, fontWeight: '700' as const },
} as const

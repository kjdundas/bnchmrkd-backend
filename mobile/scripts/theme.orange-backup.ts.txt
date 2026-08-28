// ── bnchmrkd. Design Tokens ───────────────────────────────────────────
// Dual theme: dark (original) + light, with identical shape.

export type ThemeColors = typeof darkColors

// ── Dark palette (original) ──────────────────────────────────────────
export const darkColors = {
  bg: {
    primary: '#0a0a0f',
    secondary: '#0d1117',
    card: 'rgba(255,255,255,0.02)',
    cardBorder: 'rgba(255,255,255,0.06)',
    input: '#1e293b',
    inputBorder: '#334155',
  },
  orange: {
    500: '#f97316',
    400: '#fb923c',
    300: '#fdba74',
    gradient: ['#f97316', '#fb923c'] as const,
  },
  text: {
    primary: '#f8fafc',
    secondary: '#94a3b8',
    muted: '#64748b',
    dimmed: '#475569',
  },
  green: '#34d399',
  red: '#fb7185',
  blue: '#3b82f6',
  teal: '#14b8a6',
  amber: '#f59e0b',
  purple: '#a78bfa',
  category: {
    speed: '#f97316',
    power: '#fb923c',
    strength: '#f43f5e',
    endurance: '#3b82f6',
    mobility: '#14b8a6',
    anthropometrics: '#a78bfa',
  } as Record<string, string>,
  tier: {
    emerging: '#64748b',
    developing: '#3b82f6',
    proficient: '#14b8a6',
    excellent: '#f59e0b',
    elite: '#f97316',
  },
  // Semantic overlay tokens (for rgba patterns used throughout)
  glass: {
    bg: 'rgba(255,255,255,0.02)',
    bgHover: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.06)',
    borderHover: 'rgba(255,255,255,0.08)',
    divider: 'rgba(255,255,255,0.03)',
    overlay: 'rgba(255,255,255,0.04)',
    shimmer: 'rgba(255,255,255,0.06)',
  },
  // Status bar style
  statusBar: 'light' as 'light' | 'dark',
  // Tab bar
  tabBar: {
    bg: '#0a0a0f',
    border: 'rgba(255,255,255,0.06)',
    active: '#f97316',
    inactive: '#475569',
  },
} as const

// ── Light palette ────────────────────────────────────────────────────
export const lightColors = {
  bg: {
    primary: '#ffffff',
    secondary: '#f8fafc',
    card: 'rgba(0,0,0,0.02)',
    cardBorder: 'rgba(0,0,0,0.08)',
    input: '#f1f5f9',
    inputBorder: '#cbd5e1',
  },
  orange: {
    500: '#ea580c',    // slightly deeper for light bg contrast
    400: '#f97316',
    300: '#fb923c',
    gradient: ['#ea580c', '#f97316'] as const,
  },
  text: {
    primary: '#0f172a',    // slate-900
    secondary: '#475569',  // slate-600
    muted: '#64748b',      // slate-500
    dimmed: '#94a3b8',     // slate-400
  },
  green: '#059669',
  red: '#e11d48',
  blue: '#2563eb',
  teal: '#0d9488',
  amber: '#d97706',
  purple: '#7c3aed',
  category: {
    speed: '#ea580c',
    power: '#f97316',
    strength: '#e11d48',
    endurance: '#2563eb',
    mobility: '#0d9488',
    anthropometrics: '#7c3aed',
  } as Record<string, string>,
  tier: {
    emerging: '#64748b',
    developing: '#2563eb',
    proficient: '#0d9488',
    excellent: '#d97706',
    elite: '#ea580c',
  },
  glass: {
    bg: 'rgba(0,0,0,0.02)',
    bgHover: 'rgba(0,0,0,0.04)',
    border: 'rgba(0,0,0,0.08)',
    borderHover: 'rgba(0,0,0,0.12)',
    divider: 'rgba(0,0,0,0.06)',
    overlay: 'rgba(0,0,0,0.03)',
    shimmer: 'rgba(0,0,0,0.06)',
  },
  statusBar: 'dark' as 'light' | 'dark',
  tabBar: {
    bg: '#ffffff',
    border: 'rgba(0,0,0,0.08)',
    active: '#ea580c',
    inactive: '#94a3b8',
  },
} as const

// ── Default export (dark) — used by files that haven't migrated yet ──
export const colors = darkColors

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

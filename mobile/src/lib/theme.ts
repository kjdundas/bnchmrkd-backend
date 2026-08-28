// ── bnchmrkd. Design Tokens ───────────────────────────────────────────
// Electric Indigo identity — mirrors frontend/src/index.css :root tokens.
//   --paper #F6F7FB · --card #FFFFFF · --ink #16181D · --muted #5B5F6B
//   --dim #9AA0AC · --line #E7E9F2 · --indigo #4F3CF0
//   --indigo-bright #8B83FF · --indigo-deep #141636 · --indigo-soft #EDEBFE
//
// Light is the primary theme (matches the web app). Dark is kept as a real
// alternative, re-accented to indigo-bright for legibility on dark surfaces.
//
// NOTE ON `orange`: the accent key is still named `orange` because ~160 call
// sites across the screens read `colors.orange[500]`. The VALUES are indigo.
// `accent` is the preferred alias for new code — both point at the same object,
// so migrating a screen is a rename with no visual change.

export type ThemeColors = typeof darkColors

// ── Light accent (indigo on white) ───────────────────────────────────
const lightAccent = {
  500: '#4F3CF0',   // --indigo, primary accent
  400: '#6B5BF5',
  300: '#8B83FF',   // --indigo-bright
  gradient: ['#4F3CF0', '#8B83FF'] as const,
}

// ── Dark accent (indigo-bright, lifted for dark surfaces) ────────────
const darkAccent = {
  500: '#8B83FF',   // --indigo-bright reads as the accent on dark
  400: '#A79FFF',
  300: '#C4BFFF',
  gradient: ['#4F3CF0', '#8B83FF'] as const,
}

// ── Dark palette ─────────────────────────────────────────────────────
export const darkColors = {
  bg: {
    primary: '#0B0C18',
    secondary: '#141636',   // --indigo-deep
    card: '#171935',
    cardBorder: 'rgba(255,255,255,0.08)',
    input: '#1C1F42',
    inputBorder: '#2A2E58',
  },
  orange: darkAccent,
  accent: darkAccent,
  text: {
    primary: '#F5F6FA',
    secondary: '#A8ADBD',
    muted: '#7A8095',
    dimmed: '#565C73',
  },
  green: '#34D399',
  red: '#FF6B6B',
  blue: '#60A5FA',
  teal: '#43C6AC',
  amber: '#F59E0B',
  purple: '#C4A9FF',
  category: {
    speed: '#8B83FF',
    power: '#A79FFF',
    strength: '#FF6B6B',
    endurance: '#60A5FA',
    mobility: '#43C6AC',
    anthropometrics: '#C4A9FF',
  } as Record<string, string>,
  tier: {
    emerging: '#7A8095',
    developing: '#60A5FA',
    proficient: '#43C6AC',
    excellent: '#F59E0B',
    elite: '#8B83FF',
  },
  // Card / surface tokens. Kept under the `glass` name for call-site
  // compatibility, but these are solid on light — translucent cards
  // dissolved against the paper background (same fix as the web app).
  glass: {
    bg: '#171935',
    bgHover: '#1D1F42',
    border: 'rgba(255,255,255,0.08)',
    borderHover: 'rgba(255,255,255,0.14)',
    divider: 'rgba(255,255,255,0.06)',
    overlay: 'rgba(139,131,255,0.10)',
    shimmer: 'rgba(255,255,255,0.08)',
  },
  // Status bar style
  statusBar: 'light' as 'light' | 'dark',
  // Tab bar
  tabBar: {
    bg: '#0B0C18',
    border: 'rgba(255,255,255,0.08)',
    active: '#8B83FF',
    inactive: '#565C73',
  },
} as const

// ── Light palette (primary — matches bnchmrkd.org) ───────────────────
export const lightColors = {
  bg: {
    primary: '#F6F7FB',     // --paper
    secondary: '#FFFFFF',   // --card
    card: '#FFFFFF',
    cardBorder: '#E7E9F2',  // --line
    input: '#FFFFFF',
    inputBorder: '#E7E9F2',
  },
  orange: lightAccent,
  accent: lightAccent,
  text: {
    primary: '#16181D',     // --ink
    secondary: '#5B5F6B',   // --muted
    muted: '#9AA0AC',       // --dim
    dimmed: '#B9BEC8',
  },
  green: '#0E9F6E',
  red: '#E84545',
  blue: '#3B82F6',
  teal: '#0D9488',
  amber: '#D97706',
  purple: '#7C3AED',
  category: {
    speed: '#4F3CF0',
    power: '#6B5BF5',
    strength: '#E84545',
    endurance: '#3B82F6',
    mobility: '#0D9488',
    anthropometrics: '#7C3AED',
  } as Record<string, string>,
  tier: {
    emerging: '#9AA0AC',
    developing: '#3B82F6',
    proficient: '#0D9488',
    excellent: '#D97706',
    elite: '#4F3CF0',
  },
  glass: {
    bg: '#FFFFFF',
    bgHover: '#FBFBFE',
    border: '#E7E9F2',
    borderHover: '#D9DCEA',
    divider: '#EEF0F7',
    overlay: '#EDEBFE',            // --indigo-soft, tint fills
    shimmer: 'rgba(79,60,240,0.06)',
  },
  statusBar: 'dark' as 'light' | 'dark',
  tabBar: {
    bg: '#FFFFFF',
    border: '#E7E9F2',
    active: '#4F3CF0',
    inactive: '#9AA0AC',
  },
} as const

// ── Default export — light, matching the web app.
// Components that import `colors` directly (rather than useTheme()) are
// pinned to this palette, so this is what flips them light.
export const colors = lightColors

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

// Tabular figures. Proportional digits change width as values change, so a
// counting number or a switching mark visibly jitters. Every numeral the user
// reads as data should carry this.
export const numerals = { fontVariant: ['tabular-nums' as const] }

// Vertical rhythm between major sections. Deliberately larger than `spacing`,
// which is for intra-component padding — airiness comes from the gaps BETWEEN
// blocks, not from padding inside them.
export const rhythm = {
  tight: 12,
  section: 20,
  block: 28,
  major: 40,
} as const

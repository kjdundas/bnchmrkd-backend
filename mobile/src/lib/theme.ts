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
    primary: '#EDEFF7',     // --paper, deepened from #F6F7FB
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

// ── Elevation ──────────────────────────────────────────────────────
// The app read as "flat" for a measurable reason: a white card on the old
// #F6F7FB paper is a 1.07:1 contrast ratio — mathematically almost the same
// colour — under a 5%-black shadow that is invisible on a light ground.
// Nothing could pop because the whole screen sat inside a ~1.2:1 band.
//
// Two fixes: the paper is deepened (above), and shadows are TINTED toward the
// brand's deep indigo rather than neutral black. A grey shadow on a light UI
// reads as dirt; a hue-matched one reads as depth. React Native allows one
// shadow per view, so these are tuned singles rather than stacked layers.
const SHADOW_HUE = '#2A2F6B'   // deep indigo-navy, not black

export const elevation = {
  /** Sits flat on the paper. Ambient content, list rows. */
  flat: {
    shadowColor: 'transparent' as const,
    shadowOpacity: 0, shadowRadius: 0, elevation: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  /** The default card. Present, not shouting. */
  raised: {
    shadowColor: SHADOW_HUE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  /** The focal element on a screen — one per screen, no more. */
  lifted: {
    shadowColor: SHADOW_HUE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13, shadowRadius: 28, elevation: 10,
  },
  /** Floating over content: FAB, sheets. */
  floating: {
    shadowColor: SHADOW_HUE,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.20, shadowRadius: 34, elevation: 16,
  },
} as const

// ── On-dark surface ────────────────────────────────────────────────
// The screen needs one anchored dark element or everything floats in the same
// narrow tonal band. These are the tokens for content sitting on --indigo-deep.
export const onDark = {
  surface: '#141636',
  surfaceTop: '#1E1E4E',      // for the top of a vertical wash
  ink: '#FFFFFF',
  muted: 'rgba(255,255,255,0.62)',
  dim: 'rgba(255,255,255,0.38)',
  line: 'rgba(255,255,255,0.12)',
  accent: '#8B83FF',          // --indigo-bright reads as the accent on dark
  glow: 'rgba(139,131,255,0.30)',
} as const

// ── On-image PALETTE ───────────────────────────────────────────────
// A whole resolved palette, not a handful of tokens — for screens that sit on
// a photographic backdrop end to end.
//
// The alternative was rewriting every `colors.*` reference in a 600-line
// screen by hand. This lets a screen wrap itself in <OnImageTheme/> and have
// every existing card, chip, divider and label repaint correctly in one move,
// which also means the two on-image screens can never drift apart.
//
// It is the dark palette with its SURFACES made translucent: a card is a veil
// over the photograph rather than a solid block on top of it.
export const onImageColors = {
  ...darkColors,
  bg: {
    primary: 'rgba(255,255,255,0.06)',   // inset rows — lighter, not darker
    secondary: 'rgba(255,255,255,0.10)',
    card: 'rgba(255,255,255,0.10)',
    cardBorder: 'rgba(255,255,255,0.18)',
    input: 'rgba(255,255,255,0.08)',
    inputBorder: 'rgba(255,255,255,0.22)',
  },
  text: {
    // Brighter than the dark palette across the board: text over a photo has
    // to survive local contrast the flat dark surfaces never had.
    primary: '#FFFFFF',
    secondary: 'rgba(255,255,255,0.74)',
    muted: 'rgba(255,255,255,0.54)',
    dimmed: 'rgba(255,255,255,0.38)',
  },
  glass: {
    bg: 'rgba(255,255,255,0.10)',
    bgHover: 'rgba(255,255,255,0.14)',
    border: 'rgba(255,255,255,0.18)',
    borderHover: 'rgba(255,255,255,0.26)',
    divider: 'rgba(255,255,255,0.13)',
    overlay: 'rgba(139,131,255,0.18)',
    shimmer: 'rgba(255,255,255,0.10)',
  },
  statusBar: 'light' as 'light' | 'dark',
} as const

// ── On-image surfaces ──────────────────────────────────────────────
// For content laid over the stadium backdrop. Translucent rather than solid,
// so the photograph reads through and the screen stays one thing — the Oura
// move. Solid white cards on a photo look pasted on.
export const onImage = {
  card: 'rgba(255,255,255,0.10)',
  cardBorder: 'rgba(255,255,255,0.16)',
  cardStrong: 'rgba(11,12,24,0.42)',
  ink: '#FFFFFF',
  muted: 'rgba(255,255,255,0.68)',
  dim: 'rgba(255,255,255,0.44)',
  divider: 'rgba(255,255,255,0.14)',

  // ── Navigation chrome ───────────────────────────────────────────
  // The floating tab bar has to stay legible over two opposite grounds:
  // a blown-out photo on Home, and the flat #0B0C18 ground everywhere
  // else. `cardStrong` above cannot do the second — it IS the ground
  // colour, so any opacity of it over that ground composites to 1.00:1
  // and the pill dissolves. navGlass is a LIFTED tone: dark enough to
  // read over a bright photo, light enough to sit above the dark ground.
  // Measured worst case (blur assumed to contribute nothing): inactive
  // label 5.08:1 over a near-white photo region, 8.03:1 over the ground.
  navGlass: 'rgba(28,30,48,0.80)',
  navEdge: 'rgba(255,255,255,0.28)',
  navSpecular: 'rgba(255,255,255,0.30)',
  navDim: 'rgba(255,255,255,0.66)',
} as const

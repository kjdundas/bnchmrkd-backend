// ═══════════════════════════════════════════════════════════════════════════
// THEME CONTEXT — Dark / Light / System toggle with persistence
// Provides resolved colors to all screens via useTheme() hook
// ═══════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { lightColors, onImageColors, type ThemeColors } from '../lib/theme'

// v2: deliberately a NEW key, so a 'dark' or 'system' value written by the
// pre-rebrand build is discarded rather than overriding the light theme.
const THEME_STORAGE_KEY = '@bnchmrkd_theme_mode_v2'

export type ThemeMode = 'dark' | 'light' | 'system'

interface ThemeContextValue {
  /** Resolved color palette — same shape as the old `colors` import */
  colors: ThemeColors
  /** Whether the resolved theme is dark */
  isDark: boolean
  /** Current mode setting (dark / light / system) */
  mode: ThemeMode
  /** Set mode directly */
  setMode: (mode: ThemeMode) => void
  /** Cycle: dark → light → system → dark */
  cycleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  isDark: false,
  mode: 'light',
  setMode: () => {},
  cycleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() // 'dark' | 'light' | null
  const [mode, setModeState] = useState<ThemeMode>('light')
  const [loaded, setLoaded] = useState(false)

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then(stored => {
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        setModeState(stored)
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    AsyncStorage.setItem(THEME_STORAGE_KEY, m).catch(() => {})
  }, [])

  const cycleTheme = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark')
  }, [mode, setMode])

  // Always light — including under 'system', so the phone being in iOS dark
  // mode cannot flip the app to a half-applied dark theme.
  const isDark = false

  // lightColors is `as const`, so its literal types differ from the
  // ThemeColors shape (typeof darkColors); widen for the resolved palette.
  const colors = useMemo<ThemeColors>(
    () => lightColors as unknown as ThemeColors,
    [],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({ colors, isDark, mode, setMode, cycleTheme }),
    [colors, isDark, mode, setMode, cycleTheme],
  )

  // Don't render until we've loaded the persisted preference
  if (!loaded) return null

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// ── On-image theme ─────────────────────────────────────────────────
// Wrap a screen (or a subtree) that sits on a photographic backdrop. Every
// component below re-resolves through useTheme() and repaints for the photo:
// white ink, translucent card surfaces, indigo-bright as the accent.
//
// `isDark` is true so the shared card chrome takes its dark branch — on a
// translucent surface the border carries the edge, and a drop shadow under a
// veil is just a dirty mark.
//
// Everything else on the context (mode, setMode, cycleTheme) passes straight
// through, so an Appearance control inside one of these screens would still
// drive the app-wide setting rather than this local override.
export function OnImageTheme({ children }: { children: React.ReactNode }) {
  const parent = useContext(ThemeContext)
  const value = useMemo<ThemeContextValue>(
    () => ({
      ...parent,
      colors: onImageColors as unknown as ThemeColors,
      isDark: true,
    }),
    [parent],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/** Hook to access theme colors and controls */
export function useTheme() {
  return useContext(ThemeContext)
}

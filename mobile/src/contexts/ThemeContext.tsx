// ═══════════════════════════════════════════════════════════════════════════
// THEME CONTEXT — Dark / Light / System toggle with persistence
// Provides resolved colors to all screens via useTheme() hook
// ═══════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { darkColors, lightColors, type ThemeColors } from '../lib/theme'

const THEME_STORAGE_KEY = '@bnchmrkd_theme_mode'

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
  colors: darkColors,
  isDark: true,
  mode: 'dark',
  setMode: () => {},
  cycleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() // 'dark' | 'light' | null
  const [mode, setModeState] = useState<ThemeMode>('dark')
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

  const isDark = useMemo(() => {
    if (mode === 'system') return systemScheme !== 'light'
    return mode === 'dark'
  }, [mode, systemScheme])

  // darkColors/lightColors are both `as const`, so their literal types differ
  // (e.g. bg.primary '#0a0a0f' vs '#ffffff'). They're structurally identical,
  // so widen to ThemeColors for the resolved palette.
  const colors = useMemo<ThemeColors>(
    () => (isDark ? darkColors : lightColors) as unknown as ThemeColors,
    [isDark],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({ colors, isDark, mode, setMode, cycleTheme }),
    [colors, isDark, mode, setMode, cycleTheme],
  )

  // Don't render until we've loaded the persisted preference
  if (!loaded) return null

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/** Hook to access theme colors and controls */
export function useTheme() {
  return useContext(ThemeContext)
}

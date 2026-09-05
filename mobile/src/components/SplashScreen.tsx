// ════════════════════════════��════════════════════════════��═════════════
// SPLASH SCREEN — Shown while auth state loads
// Minimal: just the logo with a subtle pulse animation
// ════════════════════��════════════════════════════════════════���═════════

import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { darkColors as colors, typeScale, weight } from '../lib/theme'
import Wordmark from '../components/Wordmark'

export default function SplashScreen() {
  const pulseAnim = useRef(new Animated.Value(0.6)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: pulseAnim }}>
        <Wordmark variant="white" height={34} />
      </Animated.View>
      <Text style={styles.tagline}>LOADING YOUR DATA</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: typeScale.hero,
    fontWeight: weight.bold,
    color: colors.orange[500],
    letterSpacing: -1,
  },
  tagline: {
    fontSize: typeScale.micro,
    letterSpacing: 3,
    color: colors.text.dimmed,
    marginTop: 12,
    fontWeight: weight.medium,
  },
})

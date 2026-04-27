// ═══════════════════════════════════════════════════════════════════════
// LOGIN SCREEN — Premium branded auth screen
// Logo + tagline → Email/password → Sign in / Sign up toggle
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native'
import { colors, spacing, radius, fonts } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

export default function LoginScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'athlete' | 'coach'>('athlete')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Entry animations
  const logoAnim = useRef(new Animated.Value(0)).current
  const formAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.stagger(200, [
      Animated.spring(logoAnim, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.spring(formAnim, { toValue: 1, useNativeDriver: true, friction: 8 }),
    ]).start()
  }, [])

  const handleSubmit = async () => {
    setError('')
    if (!email.trim() || !password) {
      setError('Please fill in all fields')
      return
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error: e } = await signIn(email.trim(), password)
        if (e) setError(e.message)
      } else {
        if (!fullName.trim()) { setError('Name is required'); setLoading(false); return }
        const { error: e } = await signUp(email.trim(), password, fullName.trim(), role)
        if (e) setError(e.message)
        else setError('Check your email for a verification link.')
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      {/* Background glow effects */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inner}>
          {/* Logo section */}
          <Animated.View
            style={[
              styles.brand,
              {
                opacity: logoAnim,
                transform: [
                  { translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) },
                ],
              },
            ]}
          >
            <Text style={styles.logo}>bnchmrkd.</Text>
            <View style={styles.taglineWrap}>
              <View style={styles.taglineLine} />
              <Text style={styles.tagline}>YOUR PERFORMANCE. BENCHMARKED.</Text>
              <View style={styles.taglineLine} />
            </View>
          </Animated.View>

          {/* Form */}
          <Animated.View
            style={[
              styles.form,
              {
                opacity: formAnim,
                transform: [
                  { translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                ],
              },
            ]}
          >
            {mode === 'signup' && (
              <>
                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>FULL NAME</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your name"
                    placeholderTextColor={colors.text.dimmed}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>I AM A</Text>
                  <View style={styles.roleRow}>
                    {(['athlete', 'coach'] as const).map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                        onPress={() => setRole(r)}
                      >
                        <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                          {r === 'athlete' ? '🏃 Athlete' : '📋 Coach'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>EMAIL</Text>
              <TextInput
                style={styles.input}
                placeholder="athlete@email.com"
                placeholderTextColor={colors.text.dimmed}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={colors.text.dimmed}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {error ? (
              <View style={[styles.errorWrap, error.includes('verification') && styles.successWrap]}>
                <Text style={[styles.errorText, error.includes('verification') && styles.successText]}>
                  {error}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.button}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
              style={styles.toggle}
            >
              <Text style={styles.toggleText}>
                {mode === 'login'
                  ? "Don't have an account? "
                  : 'Already have an account? '}
                <Text style={styles.toggleHighlight}>
                  {mode === 'login' ? 'Sign Up' : 'Sign In'}
                </Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  keyboardView: { flex: 1 },

  // Background glow effects
  glowTop: {
    position: 'absolute',
    top: -SCREEN_H * 0.15,
    left: SCREEN_W * 0.15,
    width: SCREEN_W * 0.7,
    height: SCREEN_W * 0.7,
    borderRadius: SCREEN_W * 0.35,
    backgroundColor: colors.orange[500],
    opacity: 0.05,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -SCREEN_H * 0.1,
    right: -SCREEN_W * 0.2,
    width: SCREEN_W * 0.6,
    height: SCREEN_W * 0.6,
    borderRadius: SCREEN_W * 0.3,
    backgroundColor: colors.blue,
    opacity: 0.03,
  },

  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },

  // Brand
  brand: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.orange[500],
    letterSpacing: -1.5,
  },
  taglineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.md,
  },
  taglineLine: {
    height: 1,
    width: 24,
    backgroundColor: colors.text.dimmed,
  },
  tagline: {
    fontSize: 9,
    letterSpacing: 3,
    color: colors.text.muted,
    fontWeight: '600',
  },

  // Form
  form: {
    gap: 0,
  },
  inputWrap: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: colors.text.muted,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.text.primary,
  },

  // Error
  errorWrap: {
    backgroundColor: colors.red + '12',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.red,
    fontSize: 13,
    textAlign: 'center',
  },
  successWrap: {
    backgroundColor: colors.green + '12',
  },
  successText: {
    color: colors.green,
  },

  // Button
  button: {
    backgroundColor: colors.orange[500],
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: colors.orange[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Toggle
  toggle: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  toggleText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  toggleHighlight: {
    color: colors.orange[400],
    fontWeight: '600',
  },

  // Role picker
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  roleBtnActive: {
    backgroundColor: colors.orange[500] + '15',
    borderColor: colors.orange[500] + '40',
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.muted,
  },
  roleTextActive: {
    color: colors.orange[500],
  },
})

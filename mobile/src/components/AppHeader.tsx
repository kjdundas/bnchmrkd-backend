// ═══════════════════════════════════════════════════════════════════════
// APP HEADER — mirrors the web athlete dashboard's top bar:
//   [avatar]  Name / DISCIPLINE                            [sign out]
// The avatar is the way into Profile (web has no Profile tab either), which
// is what frees the fourth tab slot for Programs.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { getLevelFromXP } from '../lib/gamification'
import { loadProgress } from '../lib/progress'
import { useTheme } from '../contexts/ThemeContext'
import { spacing } from '../lib/theme'
import { Tappable } from './ui'

export default function AppHeader() {
  const { profile, user, signOut } = useAuth()
  const { colors } = useTheme()
  const navigation = useNavigation<any>()

  // XP used to be a full-width bar on Home. As a chip here it costs zero
  // vertical space and reads better next to the athlete's name.
  const [xp, setXp] = useState(0)
  useEffect(() => {
    if (!user?.id) return
    let alive = true
    loadProgress(user.id)
      .then((p: any) => { if (alive && p?.totalXP != null) setXp(p.totalXP) })
      .catch(() => {})
    return () => { alive = false }
  }, [user])
  const level = getLevelFromXP(xp)

  const name = profile?.full_name || 'Athlete'
  const initial = name.trim().charAt(0).toUpperCase() || 'A'
  const discipline = (profile as any)?.primary_discipline || (profile as any)?.discipline || ''

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
      backgroundColor: colors.bg.primary,
      borderBottomWidth: 1, borderBottomColor: colors.glass.border,
    }}>
      <Tappable
        onPress={() => navigation.navigate('Profile')}
        accessibilityLabel={`Open profile for ${name}`}
        style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: colors.accent[500],
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>{initial}</Text>
      </Tappable>

      <Tappable onPress={() => navigation.navigate('Profile')} accessibilityLabel="Open profile" style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 19, fontWeight: '700', color: colors.text.primary, letterSpacing: -0.3 }}>
          {name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
          {!!discipline && (
            <Text style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.text.muted, fontWeight: '600' }}>
              {discipline}
            </Text>
          )}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
            backgroundColor: colors.accent[500] + '14',
          }}>
            <Ionicons name={((level as any).ionicon || 'star') as any} size={10} color={colors.accent[500]} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.accent[500], letterSpacing: 0.4 }}>
              LV{level.level}
            </Text>
          </View>
        </View>
      </Tappable>

      <Tappable
        onPress={signOut}
        accessibilityLabel="Sign out"
        style={{
          width: 44, height: 44, borderRadius: 12,
          borderWidth: 1, borderColor: colors.glass.border,
          backgroundColor: colors.glass.bg,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.text.secondary} />
      </Tappable>
    </View>
  )
}

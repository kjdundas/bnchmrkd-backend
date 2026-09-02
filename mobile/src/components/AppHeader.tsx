// ═══════════════════════════════════════════════════════════════════════
// APP HEADER — Oura's arrangement:
//
//     [ KD ]              b              [ ⇥ ]
//     initials          brand          sign out
//
// Three slots, the outer two a fixed 44pt and the middle one flex, so the
// mark is centred on the SCREEN rather than on whatever is left over after
// the name. That is the whole reason the athlete's name and level chip are
// no longer here: a centred mark and a variable-width name on the same row
// cannot both be true, and "Keenan Dundas" was already being repeated by
// the screen title underneath it on two screens out of three.
//
// The level chip moved to Profile, which the initials circle opens.
//
// Nothing here is filled. Both controls are an outline on the photograph —
// a tinted plate behind each one was the header competing with the image it
// is supposed to be sitting on.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, onImage, weight, radius, typeScale } from '../lib/theme'
import { Tappable } from './ui'
import BrandMark from './BrandMark'

/** Fixed width of the two outer slots, so the mark centres on the screen. */
const SLOT = 44

/**
 * First letter of the first name and of the last — "Keenan Dundas" -> KD.
 * Falls back to one letter for a single name, and to A for nothing at all,
 * rather than rendering an empty circle. Every whitespace-separated token
 * counts as a word: guessing which parts of someone's name are "real" is
 * how you get O'Brien and van der Berg wrong.
 */
export function initialsOf(name?: string | null): string {
  const words = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'A'
  const first = words[0].charAt(0)
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : ''
  const out = (first + last).toUpperCase()
  return out.trim() || 'A'
}

export default function AppHeader({ onImage: over }: { onImage?: boolean } = {}) {
  const { profile, signOut } = useAuth()
  const { colors } = useTheme()
  const navigation = useNavigation<any>()

  const name = profile?.full_name || 'Athlete'
  const initials = initialsOf(name)

  // Over a photograph everything is white; on a plain screen it takes the
  // accent, which is the only place the header has ever had colour.
  const ink = over ? onImage.ink : colors.accent[500]
  // Both controls share one edge, at one weight. The initials ring used to
  // be 1.5pt at 85% white, which read as a much heavier object than the
  // sign-out box beside it even though they are the same size — the letters
  // inside carry the legibility, not the ring.
  const edge = over ? onImage.cardBorder : colors.glass.border

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
      backgroundColor: over ? 'transparent' : colors.bg.primary,
      borderBottomWidth: over ? 0 : 1,
      borderBottomColor: colors.glass.border,
    }}>
      <Tappable
        onPress={() => navigation.navigate('Profile')}
        accessibilityLabel={`Open profile for ${name}`}
        style={{
          width: SLOT, height: SLOT, borderRadius: SLOT / 2,
          borderWidth: 1, borderColor: edge,
          backgroundColor: 'transparent',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* 15, not 18: two letters in a 44pt circle need the smaller size to
            keep the optical margin one letter had. */}
        <Text style={{
          color: ink, fontSize: initials.length > 1 ? typeScale.body : typeScale.title,
          fontWeight: weight.bold, letterSpacing: 0.5,
        }}>
          {initials}
        </Text>
      </Tappable>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <BrandMark size={40} color={over ? onImage.ink : colors.accent[500]} />
      </View>

      <Tappable
        onPress={signOut}
        accessibilityLabel="Sign out"
        style={{
          width: SLOT, height: SLOT, borderRadius: radius.control,
          borderWidth: 1, borderColor: edge,
          backgroundColor: 'transparent',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="log-out-outline" size={18} color={over ? onImage.ink : colors.text.secondary} />
      </Tappable>
    </View>
  )
}

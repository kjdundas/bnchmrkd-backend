// ═══════════════════════════════════════════════════════════════════════
// DATE OF BIRTH — three segments, not a spinner.
//
// A wheel picker is the obvious control and the wrong one for a birth date:
// it opens on today and the user scrolls back fifteen to forty years one
// notch at a time. Typing 2 / 8 / 1995 is faster, and three short numeric
// fields make the expected format unambiguous without a placeholder anyone
// has to decode. It also adds no dependency — there is no date picker in
// this project, and Expo Go's module set is fixed until the next dev build.
//
// Validation is real rather than regex-shaped: the parts are assembled into
// a Date and read back, so 31 February and 30 February are rejected the same
// way a bad year is.
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, StyleSheet } from 'react-native'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, radius } from '../lib/theme'
import { toIsoDob, fromIsoDob, ageFromDob } from '../lib/age'

export default function DobField({
  value, onChange, label = 'Date of birth', required, autoFocusYear,
}: {
  /** ISO yyyy-mm-dd, or null. */
  value: string | null
  /** Fires with a valid ISO date, or null while the entry is incomplete. */
  onChange: (iso: string | null) => void
  label?: string
  required?: boolean
  autoFocusYear?: boolean
}) {
  const { colors } = useTheme()
  const initial = fromIsoDob(value)
  const [day, setDay] = useState(initial.day)
  const [month, setMonth] = useState(initial.month)
  const [year, setYear] = useState(initial.year)
  const [touched, setTouched] = useState(false)

  const monthRef = useRef<TextInput>(null)
  const yearRef = useRef<TextInput>(null)

  const iso = toIsoDob(day, month, year)
  const complete = day !== '' && month !== '' && year.length === 4
  const age = iso ? ageFromDob(iso) : null
  const invalid = touched && complete && (iso == null || age == null || age < 4 || age > 100)

  // Report upward on every change so the parent's submit button can gate on a
  // real date rather than on "some text was typed".
  useEffect(() => { onChange(iso) }, [iso])

  const seg = (extra?: object) => ({
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: invalid ? colors.red : colors.glass.border,
    borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 16, color: colors.text.primary,
    textAlign: 'center' as const,
    ...extra,
  })

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
        <Text style={{
          fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
          color: colors.text.muted, fontWeight: '600',
        }}>{label}</Text>
        {required && <Text style={{ fontSize: 10, color: colors.accent[500] }}>required</Text>}
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={seg({ flex: 1 })}
          value={day}
          onChangeText={(t) => {
            const v = t.replace(/\D/g, '').slice(0, 2)
            setDay(v)
            // Advance on an unambiguous day — 4 can only be the 4th, but 1
            // could still become 12, so only jump at two digits or >3.
            if (v.length === 2 || Number(v) > 3) monthRef.current?.focus()
          }}
          onBlur={() => setTouched(true)}
          keyboardType="number-pad" placeholder="DD" maxLength={2}
          placeholderTextColor={colors.text.dimmed}
          accessibilityLabel="Day of birth"
        />
        <TextInput
          ref={monthRef}
          style={seg({ flex: 1 })}
          value={month}
          onChangeText={(t) => {
            const v = t.replace(/\D/g, '').slice(0, 2)
            setMonth(v)
            if (v.length === 2 || Number(v) > 1) yearRef.current?.focus()
          }}
          onBlur={() => setTouched(true)}
          keyboardType="number-pad" placeholder="MM" maxLength={2}
          placeholderTextColor={colors.text.dimmed}
          accessibilityLabel="Month of birth"
        />
        <TextInput
          ref={yearRef}
          style={seg({ flex: 1.6 })}
          value={year}
          onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))}
          onBlur={() => setTouched(true)}
          keyboardType="number-pad" placeholder="YYYY" maxLength={4}
          placeholderTextColor={colors.text.dimmed}
          autoFocus={autoFocusYear}
          accessibilityLabel="Year of birth"
        />
      </View>

      {/* Echo the age back. It is the fastest way for someone to catch a
          transposed year, and it shows why the app is asking. */}
      {iso && age != null && !invalid && (
        <Text style={{ fontSize: 12, color: colors.text.secondary, marginTop: 7 }}>
          {age} years old — you'll be compared against{' '}
          <Text style={{ fontWeight: '700', color: colors.text.primary }}>
            {age < 13 ? 'U13' : age < 15 ? 'U15' : age < 17 ? 'U17' : age < 20 ? 'U20' : 'Senior'}
          </Text>
          {' '}standards.
        </Text>
      )}
      {invalid && (
        <Text style={{ fontSize: 12, color: colors.red, marginTop: 7 }}>
          That isn't a date we can use — check the day, month and year.
        </Text>
      )}
    </View>
  )
}

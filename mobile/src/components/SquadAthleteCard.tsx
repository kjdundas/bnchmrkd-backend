// ═══════════════════════════════════════════════════════════════════════
// SQUAD ATHLETE CARD — one person, one event at a time.
//
// A card has to answer three things at a glance: who, at what, and which
// way are they going. The event matters because a personal best and a
// leaderboard are computed for ONE event — a sprinter with a 200m and a 400m
// is two different rankings, and a card that shows only their primary hides
// half of them.
//
// So the events are chips on the card itself. Tapping one changes what the
// mark and the trend refer to, without leaving the squad.
//
// Trend is the last two LEGAL marks in the chosen event: approved, completed,
// wind-legal. It has to be, or an arrow could point up off a wind-aided run.
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { Tappable } from './ui'
import { radius, onImage } from '../lib/theme'
import { tapFeedback } from '../lib/haptics'
import { formatMark } from '../lib/disciplineScience'
import { pbOf, trendOf, inEvent } from '../lib/athleteResults'
import { eventsOf, type SquadAthlete } from '../lib/squads'
import { ageFromDob } from '../lib/age'
import { GROWTH_TONE, type GrowthReading } from '../lib/growth'

export function initialsOfName(name: string): string {
  const w = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!w.length) return '?'
  return ((w[0][0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase()
}

export default function SquadAthleteCard({
  athlete, results, growth, onOpen, onLongPress,
}: {
  athlete: SquadAthlete
  results: any[]
  /** Measured stature velocity, when there are enough heights to say. */
  growth?: GrowthReading | null
  /** Opens the full profile, at whichever event is showing. */
  onOpen: (discipline: string) => void
  onLongPress?: () => void
}) {
  const { colors } = useTheme()
  const events = useMemo(() => eventsOf(athlete), [athlete])

  // Open on an event they have actually RACED, not simply the first one
  // listed. Emmanuel declares a 200m and has eighty-two 400m results; a card
  // that greets you with "no approved result yet" for a man with eighty-two
  // results is telling you about the list, not the athlete.
  const withResults = useMemo(
    () => events.find((d) => inEvent(results, d).length > 0) || events[0] || '',
    [events, results])

  const [event, setEvent] = useState<string | null>(null)
  const chosen = event && events.includes(event) ? event : withResults

  const pb = useMemo(() => pbOf(results, chosen), [results, chosen])
  const trend = useMemo(() => trendOf(results, chosen), [results, chosen])
  const count = useMemo(() => inEvent(results, chosen).length, [results, chosen])
  const age = ageFromDob(athlete.dob)

  // Only shown where it means something. A 24-year-old is not in a spurt,
  // and a badge that appears on every card is a badge nobody reads.
  const spurt = growth && (growth.level === 'rapid' || growth.level === 'watch')
    && age != null && age < 19 ? growth : null

  const trendTone = trend === 'up' ? colors.green : trend === 'down' ? colors.red : onImage.dim
  const trendIcon = trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'

  return (
    <Tappable
      onPress={() => onOpen(chosen)}
      onLongPress={onLongPress}
      accessibilityLabel={`${athlete.name}, ${chosen || 'no event'}${pb ? `, best ${formatMark(pb, chosen)}` : ''}`}
      style={s.card}
    >
      <View style={s.top}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initialsOfName(athlete.name)}</Text>
        </View>
        {/* The arrow is the one thing a coach scans a squad for. */}
        {!!pb && (
          <View style={s.trendWrap}>
            <Ionicons name={trendIcon as any} size={13} color={trendTone} />
          </View>
        )}
      </View>

      <Text style={s.name} numberOfLines={1}>{athlete.name}</Text>

      {/* Above the event chips, below the name: a coach scanning a squad
          should meet this before they meet the marks, because it changes
          how the marks underneath it should be read. */}
      {!!spurt && (
        <View style={[s.growth, {
          borderColor: GROWTH_TONE[spurt.level] + '66',
          backgroundColor: GROWTH_TONE[spurt.level] + '1F',
        }]}>
          <Ionicons name="resize-outline" size={11} color={GROWTH_TONE[spurt.level]} />
          <Text style={[s.growthText, { color: GROWTH_TONE[spurt.level] }]} numberOfLines={1}>
            {spurt.velocity?.toFixed(1)} cm/yr
          </Text>
        </View>
      )}
      <Text style={s.meta} numberOfLines={1}>
        {[age ? `${age}` : null, athlete.athlete_user_id ? null : 'no account']
          .filter(Boolean).join(' · ') || ' '}
      </Text>

      {events.length > 1 && (
        <View style={s.events}>
          {events.slice(0, 3).map((d) => {
            const on = d === chosen
            return (
              <Tappable
                key={d}
                onPress={() => { tapFeedback(); setEvent(d) }}
                accessibilityLabel={d}
                accessibilityState={{ selected: on }}
                style={[s.event, {
                  borderColor: on ? colors.accent[500] + '8C' : onImage.cardBorder,
                  backgroundColor: on ? colors.accent[500] + '2E' : 'transparent',
                }]}
              >
                <Text style={[s.eventText, { color: on ? '#FFFFFF' : onImage.dim }]}>{d}</Text>
              </Tappable>
            )
          })}
        </View>
      )}

      <View style={s.bottom}>
        {pb ? (
          <>
            <Text style={s.mark}>{formatMark(pb, chosen)}</Text>
            <Text style={s.markMeta} numberOfLines={1}>
              {events.length > 1 ? chosen : `${count} ${count === 1 ? 'result' : 'results'}`}
            </Text>
          </>
        ) : (
          <Text style={s.noMark} numberOfLines={2}>
            {chosen ? 'No approved result yet' : 'No event set'}
          </Text>
        )}
      </View>
    </Tappable>
  )
}

const s = StyleSheet.create({
  card: {
    width: '47.6%', minHeight: 150, borderRadius: radius.lg,
    borderWidth: 1, borderColor: onImage.cardBorder,
    backgroundColor: onImage.card, padding: 13,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.4 },
  trendWrap: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  name: { color: onImage.ink, fontSize: 14.5, fontWeight: '700', letterSpacing: -0.2, marginTop: 9 },
  meta: { color: onImage.muted, fontSize: 11.5, marginTop: 1 },
  growth: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', marginTop: 5,
    paddingHorizontal: 6, paddingVertical: 2.5,
    borderRadius: 5, borderWidth: 1,
  },
  growthText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  events: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 },
  event: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  eventText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  bottom: { marginTop: 'auto', paddingTop: 10 },
  mark: {
    color: onImage.ink, fontSize: 19, fontWeight: '700',
    letterSpacing: -0.5, fontVariant: ['tabular-nums'],
  },
  markMeta: { color: onImage.dim, fontSize: 10.5, marginTop: 1 },
  noMark: { color: onImage.dim, fontSize: 11, lineHeight: 15 },
})

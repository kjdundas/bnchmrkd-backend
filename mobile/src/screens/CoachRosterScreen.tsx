// ═══════════════════════════════════════════════════════════════════════════
// COACH ROSTER SCREEN — Premium squad overview
// Greeting + squad health → search + filters → athlete cards → FAB
// Inspired by Strava/Whoop: clean typography, no emojis, data-dense cards
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
  Modal,
  Dimensions,
  Platform,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'
import { selectFrom, insertInto, updateIn, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase'
import { getCachedToken } from '../lib/supabase'
import { getTier, TIER_NAMES, TIER_COLORS, TIER_SHORT } from '../lib/performanceTiers'
import { getAgeGroup, isTimeDiscipline } from '../lib/performanceLevels'

const { width: SCREEN_W } = Dimensions.get('window')
const API_BASE = 'https://web-production-295f1.up.railway.app'

// ── Helpers ─────────────────────────────────────────────────────────────────
const THROWS = ['Discus Throw', 'Shot Put', 'Javelin Throw', 'Hammer Throw', 'Discus', 'Javelin', 'Hammer', 'Shot']
const isThrowsDiscipline = (d: string) => THROWS.some(t => d?.toLowerCase().includes(t.toLowerCase()))

function formatMark(value: number | null, discipline: string): string {
  if (!value) return '—'
  if (isThrowsDiscipline(discipline)) return `${value.toFixed(2)}m`
  const mins = Math.floor(value / 60)
  const secs = (value % 60).toFixed(2)
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}s`
}

function calcAge(dob: string | null): number | null {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── Skeleton Loader ─────────────────────────────────────────────────────────
function SkeletonCard() {
  const shimmer = React.useRef(new Animated.Value(0)).current
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start()
  }, [])
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] })

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.leftSection}>
        <Animated.View style={[cardStyles.avatar, { backgroundColor: 'rgba(255,255,255,0.06)', opacity }]} />
        <View style={cardStyles.nameBlock}>
          <Animated.View style={{ width: 120, height: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', opacity, marginBottom: 6 }} />
          <Animated.View style={{ width: 80, height: 10, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.04)', opacity }} />
        </View>
      </View>
      <View style={cardStyles.rightSection}>
        <Animated.View style={{ width: 50, height: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', opacity, marginBottom: 4 }} />
        <Animated.View style={{ width: 30, height: 16, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.04)', opacity }} />
      </View>
    </View>
  )
}

// ── Add Athlete Modal ───────────────────────────────────────────────────────
function AddAthleteModal({
  visible,
  onClose,
  onSaved,
  coachId,
}: {
  visible: boolean
  onClose: () => void
  onSaved: () => void
  coachId: string
}) {
  const [method, setMethod] = useState<'manual' | 'url' | null>(null)
  const [name, setName] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [gender, setGender] = useState<'Male' | 'Female'>('Male')
  const [dob, setDob] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [urlProgress, setUrlProgress] = useState('')

  const reset = () => {
    setMethod(null); setName(''); setDiscipline(''); setGender('Male')
    setDob(''); setUrlInput(''); setLoading(false); setError(''); setUrlProgress('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleManualSave = async () => {
    if (!name.trim() || !discipline.trim()) { setError('Name and discipline are required'); return }
    setLoading(true); setError('')
    try {
      await insertInto('coach_roster', {
        coach_id: coachId, name: name.trim(), discipline: discipline.trim(),
        gender, dob: dob.trim() || null,
      })
      onSaved(); handleClose()
    } catch (e: any) { setError(e.message || 'Failed to add athlete') }
    setLoading(false)
  }

  const handleUrlImport = async () => {
    const url = urlInput.trim()
    if (!url) { setError('Please enter a World Athletics URL'); return }
    if (!url.includes('worldathletics.org')) { setError('URL must be from worldathletics.org'); return }

    setLoading(true); setError(''); setUrlProgress('Scraping athlete profile — this can take up to 2 minutes...')
    try {
      // Helper: single scrape attempt with timeout
      const attemptScrape = async (): Promise<any> => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 150000)
        let res: Response
        try {
          res = await fetch(`${API_BASE}/api/v1/analyze/url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
            signal: controller.signal,
          })
        } finally { clearTimeout(timeout) }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.detail || `Server error ${res.status}`)
        }
        const result = await res.json()
        if (!result.success) throw new Error('Analysis returned unsuccessful')
        return result
      }

      // Attempt scrape with 1 automatic retry on failure
      // The Selenium scraper can transiently fail to load the page
      let result: any
      try {
        result = await attemptScrape()
      } catch (firstErr: any) {
        setUrlProgress('First attempt failed — retrying automatically...')
        result = await attemptScrape()
      }

      const analysisData = result.data || {}
      const athleteName = result.athlete_name || 'Unknown Athlete'
      const scraped = analysisData._scraped || {}
      const discipline = scraped.discipline || analysisData.discipline || null
      const scrapedGender = scraped.gender || analysisData.gender || null
      const dob = scraped.dob || null

      // Get races from scraped data
      const races = (scraped.races || []).map((r: any) => ({
        date: r.date || null,
        value: r.value || null,
        competition: r.competition || null,
        wind: r.wind || null,
        implement_weight_kg: r.implement_weight_kg || null,
      }))

      // Compute PB
      const isThrows = isThrowsDiscipline(discipline || '')
      let pbNumeric: number | null = null
      for (const race of races) {
        if (race.value == null) continue
        if (pbNumeric == null || (isThrows ? race.value > pbNumeric : race.value < pbNumeric)) {
          pbNumeric = race.value
        }
      }

      // Get last result and compute trend
      const sortedRaces = races.filter((r: any) => r.date && r.value)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      const lastRace = sortedRaces[0]
      const lastVal = lastRace?.value || null
      let trend = 'stable'
      if (sortedRaces.length >= 3) {
        const recent = sortedRaces.slice(0, 3).map((r: any) => r.value).filter(Boolean)
        if (recent.length >= 2) {
          const improving = isThrows ? recent[0] > recent[recent.length - 1] : recent[0] < recent[recent.length - 1]
          if (improving) trend = 'up'
          else if (isThrows ? recent[0] < recent[recent.length - 1] : recent[0] > recent[recent.length - 1]) trend = 'down'
        }
      }

      // Build disciplines data
      const disciplinesData = scraped.disciplines_data || (discipline ? { [discipline]: races } : {})
      const supportedDisciplines = scraped.supported_disciplines || Object.keys(disciplinesData)

      setUrlProgress(`Saving ${athleteName} to roster...`)

      const newAthlete = {
        coach_id: coachId,
        name: athleteName,
        dob: dob || null,
        gender: scrapedGender || 'M',
        discipline: discipline,
        disciplines: supportedDisciplines,
        disciplines_data: disciplinesData,
        nationality: scraped.nationality || null,
        pb: pbNumeric ? formatMark(pbNumeric, discipline || '') : null,
        pb_value: pbNumeric,
        last_result: lastVal ? formatMark(lastVal, discipline || '') : null,
        last_result_value: lastVal,
        last_date: lastRace?.date || null,
        trend,
        tier: 'developing',
        world_athletics_url: url,
        races: races,
      }

      await insertInto('coach_roster', newAthlete)
      setUrlProgress('Athlete imported!')
      setTimeout(() => { onSaved(); handleClose() }, 800)
    } catch (e: any) {
      const msg = e.name === 'AbortError'
        ? 'Request timed out — the scraper may be overloaded. Try again.'
        : (e.message || 'Import failed — check the URL and try again')
      setError(msg)
    }
    setLoading(false)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          {/* Handle bar */}
          <View style={modalStyles.handle} />

          {/* Header */}
          <View style={modalStyles.header}>
            <Text style={modalStyles.headerTitle}>
              {method === 'manual' ? 'Manual Entry' : method === 'url' ? 'World Athletics Import' : 'Add Athlete'}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={modalStyles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.text.muted} />
            </TouchableOpacity>
          </View>

          {!method && (
            <View style={modalStyles.methodPicker}>
              <TouchableOpacity style={modalStyles.methodCard} onPress={() => setMethod('manual')} activeOpacity={0.7}>
                <View style={[modalStyles.methodIconWrap, { backgroundColor: 'rgba(249,115,22,0.08)' }]}>
                  <Ionicons name="person-add-outline" size={22} color={colors.orange[500]} />
                </View>
                <View style={modalStyles.methodInfo}>
                  <Text style={modalStyles.methodTitle}>Manual Entry</Text>
                  <Text style={modalStyles.methodDesc}>Name, discipline, date of birth</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.text.dimmed} />
              </TouchableOpacity>

              <TouchableOpacity style={modalStyles.methodCard} onPress={() => setMethod('url')} activeOpacity={0.7}>
                <View style={[modalStyles.methodIconWrap, { backgroundColor: 'rgba(59,130,246,0.08)' }]}>
                  <Ionicons name="globe-outline" size={22} color={colors.blue} />
                </View>
                <View style={modalStyles.methodInfo}>
                  <Text style={modalStyles.methodTitle}>World Athletics</Text>
                  <Text style={modalStyles.methodDesc}>Import from athlete profile URL</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.text.dimmed} />
              </TouchableOpacity>
            </View>
          )}

          {method === 'manual' && (
            <ScrollView style={modalStyles.form} showsVerticalScrollIndicator={false}>
              <View style={modalStyles.inputWrap}>
                <Text style={modalStyles.label}>NAME</Text>
                <TextInput style={modalStyles.input} placeholder="Athlete name"
                  placeholderTextColor={colors.text.dimmed} value={name}
                  onChangeText={setName} autoCapitalize="words" />
              </View>
              <View style={modalStyles.inputWrap}>
                <Text style={modalStyles.label}>DISCIPLINE</Text>
                <TextInput style={modalStyles.input} placeholder="e.g. 100m, Discus Throw"
                  placeholderTextColor={colors.text.dimmed} value={discipline}
                  onChangeText={setDiscipline} />
              </View>
              <View style={modalStyles.inputWrap}>
                <Text style={modalStyles.label}>GENDER</Text>
                <View style={modalStyles.segmentRow}>
                  {(['Male', 'Female'] as const).map((g) => (
                    <TouchableOpacity key={g}
                      style={[modalStyles.segmentBtn, gender === g && modalStyles.segmentBtnActive]}
                      onPress={() => setGender(g)}>
                      <Text style={[modalStyles.segmentText, gender === g && modalStyles.segmentTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={modalStyles.inputWrap}>
                <Text style={modalStyles.label}>DATE OF BIRTH</Text>
                <TextInput style={modalStyles.input} placeholder="YYYY-MM-DD (optional)"
                  placeholderTextColor={colors.text.dimmed} value={dob}
                  onChangeText={setDob} keyboardType="numbers-and-punctuation" />
              </View>
              {error ? <Text style={modalStyles.error}>{error}</Text> : null}
              <TouchableOpacity style={[modalStyles.primaryBtn, loading && { opacity: 0.6 }]}
                onPress={handleManualSave} disabled={loading}>
                <Text style={modalStyles.primaryBtnText}>{loading ? 'Adding...' : 'Add to Squad'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMethod(null)} style={modalStyles.backLink}>
                <Ionicons name="chevron-back" size={14} color={colors.text.muted} />
                <Text style={modalStyles.backLinkText}>Back</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          )}

          {method === 'url' && (
            <View style={modalStyles.form}>
              <View style={modalStyles.inputWrap}>
                <Text style={modalStyles.label}>ATHLETE URL</Text>
                <TextInput style={[modalStyles.input, { fontSize: 14 }]}
                  placeholder="https://worldathletics.org/athletes/..."
                  placeholderTextColor={colors.text.dimmed} value={urlInput}
                  onChangeText={setUrlInput} autoCapitalize="none" keyboardType="url" multiline />
              </View>
              {urlProgress ? (
                <View style={modalStyles.progressRow}>
                  <View style={modalStyles.progressDot} />
                  <Text style={modalStyles.progressText}>{urlProgress}</Text>
                </View>
              ) : null}
              {error ? <Text style={modalStyles.error}>{error}</Text> : null}
              <TouchableOpacity style={[modalStyles.primaryBtn, loading && { opacity: 0.6 }]}
                onPress={handleUrlImport} disabled={loading}>
                <Text style={modalStyles.primaryBtnText}>{loading ? 'Importing...' : 'Import Athlete'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMethod(null)} style={modalStyles.backLink}>
                <Ionicons name="chevron-back" size={14} color={colors.text.muted} />
                <Text style={modalStyles.backLinkText}>Back</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

// ── Roster Athlete Card ─────────────────────────────────────────────────────
function AthleteCard({ athlete, onPress }: { athlete: any; onPress: () => void }) {
  const age = calcAge(athlete.dob)
  const ageGroup = age ? getAgeGroup(age) : 'Senior'
  const genderCode = athlete.gender === 'Female' ? 'F' : 'M'

  const pb = useMemo(() => {
    if (athlete.pb_value) return athlete.pb_value
    if (!athlete.races?.length) return null
    const values = athlete.races.map((r: any) => parseFloat(r.value)).filter(Number.isFinite)
    if (!values.length) return null
    const lower = isTimeDiscipline(athlete.discipline)
    return lower ? Math.min(...values) : Math.max(...values)
  }, [athlete])

  const tier = pb ? getTier(athlete.discipline, genderCode, ageGroup, pb) : null
  const raceCount = athlete.races?.length || 0

  // Trend: compare last two results
  const trend = useMemo(() => {
    if (!athlete.races || athlete.races.length < 2) return null
    const curr = parseFloat(athlete.races[0].value)
    const prev = parseFloat(athlete.races[1].value)
    if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null
    const lower = isTimeDiscipline(athlete.discipline)
    return lower ? (curr < prev ? 'up' : curr > prev ? 'down' : null) : (curr > prev ? 'up' : curr < prev ? 'down' : null)
  }, [athlete])

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.6} style={cardStyles.cardOuter}>
      <View style={cardStyles.card}>
        {/* Avatar with tier-colored ring */}
        <View style={[cardStyles.avatarRing, { borderColor: (tier?.color || colors.text.dimmed) + '30' }]}>
          <View style={[cardStyles.avatar, { backgroundColor: (tier?.color || colors.text.dimmed) + '12' }]}>
            <Text style={[cardStyles.avatarText, { color: tier?.color || colors.text.muted }]}>
              {athlete.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        </View>

        {/* Name + meta */}
        <View style={cardStyles.nameBlock}>
          <View style={cardStyles.nameRow}>
            <Text style={cardStyles.name} numberOfLines={1}>{athlete.name}</Text>
            {trend === 'up' && (
              <View style={[cardStyles.trendDot, { backgroundColor: colors.green }]}>
                <Ionicons name="arrow-up" size={8} color="#fff" />
              </View>
            )}
            {trend === 'down' && (
              <View style={[cardStyles.trendDot, { backgroundColor: colors.red }]}>
                <Ionicons name="arrow-down" size={8} color="#fff" />
              </View>
            )}
          </View>
          <Text style={cardStyles.meta} numberOfLines={1}>
            {athlete.discipline}{age ? ` · ${ageGroup} (${age})` : ''}
          </Text>
        </View>

        {/* PB + tier */}
        <View style={cardStyles.rightSection}>
          {pb ? (
            <Text style={cardStyles.pbValue}>
              {formatMark(pb, athlete.discipline)}
            </Text>
          ) : (
            <Text style={cardStyles.noPb}>—</Text>
          )}
          {tier ? (
            <View style={[cardStyles.tierBadge, { backgroundColor: tier.color + '14', borderColor: tier.color + '25' }]}>
              <View style={[cardStyles.tierDot, { backgroundColor: tier.color }]} />
              <Text style={[cardStyles.tierText, { color: tier.color }]}>
                {TIER_SHORT[tier.tier]}
              </Text>
            </View>
          ) : raceCount > 0 ? (
            <Text style={cardStyles.raceCount}>{raceCount} race{raceCount !== 1 ? 's' : ''}</Text>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={14} color={colors.text.dimmed} style={{ marginLeft: 2 }} />
      </View>
    </TouchableOpacity>
  )
}

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function CoachRosterScreen() {
  const { user, profile } = useAuth()
  const navigation = useNavigation<any>()
  const [roster, setRoster] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filterAgeGroup, setFilterAgeGroup] = useState('all')
  const [addModalVisible, setAddModalVisible] = useState(false)

  const fetchRoster = useCallback(async () => {
    if (!user?.id) return
    try {
      const data = await selectFrom('coach_roster', {
        filter: `coach_id=eq.${user.id}`,
        order: 'created_at.desc',
      })
      setRoster(data || [])
    } catch (e) {
      console.warn('Roster fetch:', e)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchRoster() }, [fetchRoster])

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => fetchRoster())
    return unsub
  }, [navigation, fetchRoster])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchRoster()
    setRefreshing(false)
  }

  // ── Filtering ──
  const filtered = useMemo(() => {
    let list = roster
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.name?.toLowerCase().includes(q) ||
        a.discipline?.toLowerCase().includes(q)
      )
    }
    if (filterAgeGroup !== 'all') {
      list = list.filter(a => {
        const age = calcAge(a.dob)
        return age ? getAgeGroup(age) === filterAgeGroup : false
      })
    }
    return list
  }, [roster, search, filterAgeGroup])

  // ── Squad stats ──
  const stats = useMemo(() => {
    const tierCounts: Record<number, number> = {}
    let withPb = 0
    let totalRaces = 0
    for (const a of roster) {
      totalRaces += a.races?.length || 0
      const pb = a.pb_value || (a.races?.length ? (() => {
        const vals = a.races.map((r: any) => parseFloat(r.value)).filter(Number.isFinite)
        if (!vals.length) return null
        return isTimeDiscipline(a.discipline) ? Math.min(...vals) : Math.max(...vals)
      })() : null)
      if (pb) {
        withPb++
        const age = calcAge(a.dob)
        const ageGroup = age ? getAgeGroup(age) : 'Senior'
        const genderCode = a.gender === 'Female' ? 'F' : 'M'
        const tier = getTier(a.discipline, genderCode, ageGroup, pb)
        if (tier) tierCounts[tier.tier] = (tierCounts[tier.tier] || 0) + 1
      }
    }
    return { total: roster.length, withPb, tierCounts, totalRaces }
  }, [roster])

  const ageGroups = ['all', 'U13', 'U15', 'U17', 'U20', 'Senior']
  const firstName = profile?.full_name?.split(' ')[0] || 'Coach'

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()}, {firstName}</Text>
            <Text style={styles.title}>Your Squad</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Quick stats row */}
        {roster.length > 0 && (
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatNum}>{stats.total}</Text>
              <Text style={styles.quickStatLabel}>Athletes</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatNum}>{stats.withPb}</Text>
              <Text style={styles.quickStatLabel}>With PB</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatNum}>{stats.totalRaces}</Text>
              <Text style={styles.quickStatLabel}>Total Races</Text>
            </View>
          </View>
        )}

        {/* Tier distribution bar */}
        {stats.withPb > 0 && (
          <View style={styles.tierBar}>
            {[1, 2, 3, 4, 5, 6, 7].map(t => {
              const count = stats.tierCounts[t] || 0
              const pct = count / stats.withPb
              if (pct === 0) return null
              return (
                <View key={t} style={[styles.tierBarSegment, {
                  flex: pct, backgroundColor: TIER_COLORS[t],
                }]} />
              )
            })}
          </View>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={colors.text.dimmed} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or discipline"
            placeholderTextColor={colors.text.dimmed}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={colors.text.dimmed} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Age group filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
        {ageGroups.map(ag => (
          <TouchableOpacity key={ag}
            style={[styles.chip, filterAgeGroup === ag && styles.chipActive]}
            onPress={() => setFilterAgeGroup(ag)}>
            <Text style={[styles.chipText, filterAgeGroup === ag && styles.chipTextActive]}>
              {ag === 'all' ? 'All' : ag}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Roster list */}
      {loading ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
        </ScrollView>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="people-outline" size={32} color={colors.text.dimmed} />
          </View>
          <Text style={styles.emptyTitle}>
            {roster.length === 0 ? 'No athletes yet' : 'No matches'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {roster.length === 0
              ? 'Tap + to add your first athlete to the squad.'
              : 'Try a different search or filter.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange[500]} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Section count */}
          <Text style={styles.listCount}>
            {filtered.length} athlete{filtered.length !== 1 ? 's' : ''}
            {filterAgeGroup !== 'all' ? ` · ${filterAgeGroup}` : ''}
          </Text>

          {filtered.map((athlete) => (
            <AthleteCard
              key={athlete.id}
              athlete={athlete}
              onPress={() => navigation.navigate('AthleteDetail', { athlete })}
            />
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <AddAthleteModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSaved={() => fetchRoster()}
        coachId={user?.id || ''}
      />
    </SafeAreaView>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 13,
    color: colors.text.muted,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.orange[500],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.orange[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  quickStats: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  quickStatItem: { flex: 1, alignItems: 'center' },
  quickStatNum: { fontSize: 20, fontWeight: '700', color: colors.text.primary, letterSpacing: -0.5 },
  quickStatLabel: { fontSize: 10, letterSpacing: 1, color: colors.text.muted, fontWeight: '500', marginTop: 2, textTransform: 'uppercase' },
  quickStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 2 },

  tierBar: {
    flexDirection: 'row',
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  tierBarSegment: { minWidth: 2 },

  searchRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    paddingVertical: 0,
  },

  chipScroll: {
    maxHeight: 36,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.orange[500] + '12',
    borderColor: colors.orange[500] + '30',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text.muted },
  chipTextActive: { color: colors.orange[500] },

  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  listCount: {
    fontSize: 11,
    letterSpacing: 1,
    color: colors.text.dimmed,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },

  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
})

// ── Card Styles ─────────────────────────────────────────────────────────────
const cardStyles = StyleSheet.create({
  cardOuter: { marginBottom: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  leftSection: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700' },
  nameBlock: { flex: 1, marginLeft: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  trendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  meta: { fontSize: 12, color: colors.text.muted, marginTop: 1 },

  rightSection: { alignItems: 'flex-end', marginLeft: spacing.md },
  pbValue: { fontSize: 15, fontWeight: '700', color: colors.text.primary, letterSpacing: -0.3 },
  noPb: { fontSize: 14, color: colors.text.dimmed },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 3,
  },
  tierDot: { width: 5, height: 5, borderRadius: 2.5 },
  tierText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  raceCount: { fontSize: 10, color: colors.text.dimmed, marginTop: 3 },
})

// ── Modal Styles ────────────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  methodPicker: { gap: 1, marginBottom: spacing.lg },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: spacing.md,
  },
  methodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodInfo: { flex: 1 },
  methodTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  methodDesc: { fontSize: 12, color: colors.text.muted, marginTop: 1 },

  form: { gap: 0 },
  inputWrap: { marginBottom: spacing.lg },
  label: {
    fontSize: 10,
    letterSpacing: 2,
    color: colors.text.muted,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md - 2,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.orange[500] + '15',
  },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.text.muted },
  segmentTextActive: { color: colors.orange[500] },

  error: {
    color: colors.red,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.orange[500],
  },
  progressText: { color: colors.orange[500], fontSize: 13, fontWeight: '500' },

  primaryBtn: {
    backgroundColor: colors.orange[500],
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.lg,
  },
  backLinkText: { color: colors.text.muted, fontSize: 14, fontWeight: '500' },
})

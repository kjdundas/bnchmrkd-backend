// ═══════════════════════════════════════════════════════════════════════
// LOG SCREEN — The heart of the training diary (premium brand)
// Full web parity: Quick-log · Date picker · Notes · Validation · Toast
// Performance hero · Collapsible protocol · Expanded 58-metric catalog
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../lib/theme'
import { useAuth } from '../contexts/AuthContext'
import { insertInto, selectFrom } from '../lib/supabase'
import {
  AlmanacCard,
  MonoKicker,
} from '../components/ui'
import CompetitionLog from '../components/CompetitionLog'
import { DnaShiftCard, MetricImpactLine } from '../components/IntelligenceCards'
import { XPBar, StreakChip, XPPopup, PBCelebration } from '../components/GamificationUI'
import {
  calculateLogXP,
  calculateStreak,
  getNewBadges,
  getMotivationalMessage,
  getLevelFromXP,
  countUniqueCategories,
  getMetricCategory,
  type Badge,
  type UserStats,
} from '../lib/gamification'

// ── In-memory stores (works on web + native) ──
const RECENT_STORE: Record<string, string[]> = {}
function loadRecent(userId: string): string[] {
  return RECENT_STORE[userId] || []
}
function pushRecent(userId: string, metricKey: string) {
  const cur = (RECENT_STORE[userId] || []).filter((k) => k !== metricKey)
  cur.unshift(metricKey)
  RECENT_STORE[userId] = cur.slice(0, 3)
}

// XP store — persists in memory for the session (TODO: move to Supabase)
const XP_STORE: Record<string, number> = {}
function getXP(userId: string): number { return XP_STORE[userId] || 0 }
function addXP(userId: string, amount: number) { XP_STORE[userId] = (XP_STORE[userId] || 0) + amount }

// ── LOWER_IS_BETTER (times, HR, fat) ──
const LOWER_IS_BETTER = new Set([
  'sprint_10m', 'sprint_20m', 'sprint_30m', 'sprint_40m', 'sprint_60m',
  'sprint_100m', 'flying_10m', 'flying_20m', 'split_300m',
  'resting_hr', 'rhr', 'body_fat', 'body_fat_pct',
  'tt_1200m', 'tt_2km', 'bronco',
])

// ═══════════════════════════════════════════════════════════════════════
// METRIC CATALOG — Full 58-metric parity with web's MetricLogView
// Each metric has key, label, unit, step, min, max, protocol
// ═══════════════════════════════════════════════════════════════════════
const METRIC_CATALOG = [
  {
    category: 'Speed',
    icon: 'flash-outline' as const,
    color: colors.category.speed,
    description: 'Sprint splits & top-end velocity',
    metrics: [
      { key: 'sprint_10m',  label: '0–10m Split',    unit: 's',   step: 0.01, min: 1.2, max: 3.5, protocol: 'Standing or 3-point start, electronic timing gates at 0m and 10m. Best of 3 with ≥3 min rest.' },
      { key: 'sprint_20m',  label: '0–20m Split',    unit: 's',   step: 0.01, min: 2.2, max: 5.0, protocol: 'Same start as 10m. Gate at 20m. Best of 3 trials.' },
      { key: 'sprint_30m',  label: '0–30m Split',    unit: 's',   step: 0.01, min: 3.2, max: 6.5, protocol: 'Standing start, fully rested, indoor track if possible. Best of 3.' },
      { key: 'sprint_40m',  label: '0–40m Split',    unit: 's',   step: 0.01, min: 4.2, max: 8.0, protocol: 'Electronic timing only — hand timing inflates results by ~0.2s.' },
      { key: 'sprint_60m',  label: '0–60m Split',    unit: 's',   step: 0.01, min: 6.2, max: 11.0, protocol: 'Block or 3-point start. Wind-legal if outdoors (<+2.0 m/s).' },
      { key: 'sprint_100m', label: '100m Sprint',    unit: 's',   step: 0.01, min: 9.5, max: 16.0, protocol: 'Full competition distance. Block start, electronic timing.' },
      { key: 'flying_10m',  label: 'Flying 10m',     unit: 's',   step: 0.01, min: 0.80, max: 1.60, protocol: '20m run-in to gate, then time across 10m. Use to derive max velocity.' },
      { key: 'max_velocity', label: 'Max Velocity',  unit: 'm/s', step: 0.01, min: 6.0, max: 13.5, protocol: 'Radar or LPS device, or compute from a 10m fly: v = 10 / fly time.' },
      { key: 'split_300m',  label: '300m Split',     unit: 's',   step: 0.1,  min: 30.0, max: 70.0, protocol: 'Single rep on track, full warm-up, lane 1. Used as 400m predictor.' },
    ],
  },
  {
    category: 'Power',
    icon: 'rocket-outline' as const,
    color: colors.category.power,
    description: 'Jump & ballistic outputs',
    metrics: [
      { key: 'cmj_height',     label: 'CMJ Height',          unit: 'cm',    step: 0.1,  min: 10, max: 90, protocol: 'Hands on hips, free counter-movement to self-selected depth. Force plate or validated jump mat. Best of 3.' },
      { key: 'cmj_rel_pp',     label: 'CMJ Rel. Peak Power', unit: 'W/kg',  step: 0.1,  min: 20, max: 110, protocol: 'Force plate concentric phase — peak power ÷ body mass. Best of 3.' },
      { key: 'cmj_peak_force', label: 'CMJ Peak Force',      unit: 'N',     step: 1,    min: 800, max: 5000, protocol: 'Concentric peak vertical GRF from force plate.' },
      { key: 'sj_height',      label: 'Squat Jump Height',   unit: 'cm',    step: 0.1,  min: 10, max: 80, protocol: '90° knee, 3s pause, no dip. Hands on hips. Force plate or jump mat.' },
      { key: 'eur',            label: 'Eccentric Util. Ratio', unit: 'CMJ/SJ', step: 0.01, min: 0.85, max: 1.30, protocol: 'CMJ height ÷ SJ height. Same session, 3 reps each.' },
      { key: 'broad_jump',     label: 'Standing Broad Jump', unit: 'm',     step: 0.01, min: 1.20, max: 4.00, protocol: 'Two-foot take-off from a line, two-foot landing. Best of 3.' },
      { key: 'rsi_dj30',       label: 'RSI (Drop Jump 30cm)', unit: 'm/s',  step: 0.01, min: 0.5, max: 4.5, protocol: 'Drop from 30cm, minimal contact time. RSI = jump height ÷ contact time.' },
      { key: 'rsi_mod',        label: 'RSI-Modified (CMJ)',  unit: 'm/s',   step: 0.01, min: 0.20, max: 1.20, protocol: 'CMJ jump height ÷ time-to-take-off (force plate).' },
      { key: 'imtp_rfd_100',   label: 'IMTP RFD 0–100ms',   unit: 'N/s',   step: 1,    min: 1000, max: 25000, protocol: 'Isometric mid-thigh pull on fixed bar. Force plate, max effort, 5s rep.' },
    ],
  },
  {
    category: 'Strength',
    icon: 'barbell-outline' as const,
    color: colors.category.strength,
    description: 'Maximal & relative strength',
    metrics: [
      { key: 'back_squat_1rm',  label: 'Back Squat 1RM',     unit: 'kg', step: 0.5, min: 20, max: 400, protocol: 'True 1RM or estimated via Epley from a clean rep ≤5 RIR 0. Note depth (parallel/below).' },
      { key: 'front_squat_1rm', label: 'Front Squat 1RM',    unit: 'kg', step: 0.5, min: 20, max: 300, protocol: 'Full depth, clean grip.' },
      { key: 'bench_press_1rm', label: 'Bench Press 1RM',    unit: 'kg', step: 0.5, min: 20, max: 300, protocol: 'Pause on chest, no bounce, full lockout. Spotter present.' },
      { key: 'deadlift_1rm',    label: 'Deadlift 1RM',       unit: 'kg', step: 0.5, min: 20, max: 400, protocol: 'Conventional or sumo (note which). Full lockout.' },
      { key: 'power_clean_1rm', label: 'Power Clean 1RM',    unit: 'kg', step: 0.5, min: 20, max: 220, protocol: 'Floor to front rack. No full squat catch.' },
      { key: 'snatch_1rm',      label: 'Snatch 1RM',         unit: 'kg', step: 0.5, min: 20, max: 200, protocol: 'Full snatch or power snatch.' },
      { key: 'hip_thrust_1rm',  label: 'Hip Thrust 1RM',     unit: 'kg', step: 0.5, min: 40, max: 350, protocol: 'Barbell hip thrust, full hip extension at top.' },
      { key: 'imtp_peak_force', label: 'IMTP Peak Force',    unit: 'N',  step: 1,   min: 1000, max: 6000, protocol: 'Isometric mid-thigh pull, knee 125–145°, hip 140–150°, max effort 5s on force plate.' },
      { key: 'imtp_rel_force',  label: 'IMTP Rel. Peak Force', unit: 'N/kg', step: 0.01, min: 15, max: 60, protocol: 'IMTP peak vertical force ÷ body mass.' },
      { key: 'pullup_max',      label: 'Pull-ups (Max Reps)', unit: 'reps', step: 1, min: 0, max: 60, protocol: 'Dead-hang, chin over bar, no kip.' },
      { key: 'weighted_pullup', label: 'Weighted Pull-up 1RM', unit: 'kg', step: 0.5, min: 0, max: 100, protocol: 'Added weight for 1 rep. Full dead hang to chin over bar.' },
    ],
  },
  {
    category: 'Mobility',
    icon: 'body-outline' as const,
    color: colors.category.mobility,
    description: 'Joint range & movement quality',
    metrics: [
      { key: 'sit_and_reach',    label: 'Sit & Reach',         unit: 'cm',    step: 0.5, min: -20, max: 45, protocol: 'Standard sit-and-reach box, shoes off, knees flat. Slow reach, hold 2s. Best of 3.' },
      { key: 'knee_to_wall_l',   label: 'Knee-to-Wall (L)',    unit: 'cm',    step: 0.5, min: 0, max: 20, protocol: 'Distance from longest toe to wall when knee touches wall, heel down. Ankle dorsiflexion.' },
      { key: 'knee_to_wall_r',   label: 'Knee-to-Wall (R)',    unit: 'cm',    step: 0.5, min: 0, max: 20, protocol: 'Same as left side.' },
      { key: 'thomas_l',         label: 'Thomas Test (L)',      unit: '°',     step: 1,   min: -30, max: 30, protocol: 'Supine on bench, opposite knee to chest. Measure hip extension angle (negative = tight).' },
      { key: 'thomas_r',         label: 'Thomas Test (R)',      unit: '°',     step: 1,   min: -30, max: 30, protocol: 'Same as left side.' },
      { key: 'aslr_l',           label: 'Active SLR (L)',       unit: '°',     step: 1,   min: 30, max: 110, protocol: 'Supine, knee straight, raise leg without lumbar flexion. Goniometer at hip.' },
      { key: 'aslr_r',           label: 'Active SLR (R)',       unit: '°',     step: 1,   min: 30, max: 110, protocol: 'Same as left side.' },
      { key: 'shoulder_flex',    label: 'Shoulder Flexion ROM', unit: '°',     step: 1,   min: 100, max: 200, protocol: 'Supine, arm overhead, lumbar flat. Goniometer at acromion.' },
      { key: 'overhead_squat',   label: 'Overhead Squat (FMS)', unit: 'score', step: 1,   min: 0, max: 3, protocol: 'FMS overhead squat. Scored 0–3 by trained tester.' },
      { key: 'fms_total',        label: 'FMS Total Score',      unit: '/21',   step: 1,   min: 0, max: 21, protocol: 'Functional Movement Screen, 7 tests. Trained tester only.' },
      { key: 'adductor_squeeze', label: 'Adductor Squeeze',     unit: 'mmHg',  step: 1,   min: 100, max: 400, protocol: 'Supine, knees straight, BP cuff between ankles inflated to 10 mmHg, squeeze max 5s.' },
    ],
  },
  {
    category: 'Endurance',
    icon: 'heart-outline' as const,
    color: colors.category.endurance,
    description: 'Aerobic capacity & conditioning',
    metrics: [
      { key: 'vo2max',          label: 'VO₂max',               unit: 'ml/kg/min', step: 0.1, min: 25, max: 95, protocol: 'Lab graded exercise test or validated field estimate (beep test, Cooper).' },
      { key: 'yoyo_ir1',        label: 'Yo-Yo IR1 Distance',   unit: 'm',   step: 40,  min: 200, max: 3500, protocol: '20m shuttles with 10s active recovery, increasing speed. Stop at 2nd failure.' },
      { key: 'yoyo_ir2',        label: 'Yo-Yo IR2 Distance',   unit: 'm',   step: 40,  min: 80, max: 2200, protocol: 'Higher-intensity version of IR1.' },
      { key: 'iftt_30_15',      label: '30-15 IFT Velocity',   unit: 'km/h', step: 0.5, min: 12, max: 24, protocol: '30s shuttle / 15s walk protocol. Final stage velocity = VIFT.' },
      { key: 'mas',             label: 'Max Aerobic Speed',     unit: 'km/h', step: 0.1, min: 12, max: 24, protocol: 'From 1.2–2km TT or 5 min running test. MAS = avg velocity.' },
      { key: 'tt_1200m',        label: '1.2km Time Trial',      unit: 's',   step: 0.1, min: 180, max: 420, protocol: 'Flat surface, timed from start. Record in seconds.' },
      { key: 'bronco',          label: 'Bronco Test',            unit: 's',   step: 0.1, min: 240, max: 540, protocol: '5×(60+40+20m) shuttles continuous, total 1200m. Standard conditioning test.' },
      { key: 'tt_2km',          label: '2km Time Trial',         unit: 's',   step: 0.1, min: 300, max: 720, protocol: 'Flat surface, all-out effort.' },
      { key: 'rhr',             label: 'Resting Heart Rate',     unit: 'bpm', step: 1,   min: 30, max: 90, protocol: 'Measured supine, first thing on waking, 1 min average.' },
      { key: 'hrv_rmssd',       label: 'HRV (RMSSD)',           unit: 'ms',  step: 1,   min: 10, max: 200, protocol: 'Morning, supine, 1–5 min recording with chest strap or validated app.' },
      { key: 'hr_recovery_60',  label: 'HR Recovery (60s)',      unit: 'bpm', step: 1,   min: 5, max: 80, protocol: '60s post-max effort HR recovery drop.' },
    ],
  },
  {
    category: 'Anthropometrics',
    icon: 'resize-outline' as const,
    color: colors.category.anthropometrics,
    description: 'Body composition & morphology',
    metrics: [
      { key: 'body_mass',       label: 'Body Mass',             unit: 'kg', step: 0.1, min: 30, max: 200, protocol: 'Morning, post-void, minimal clothing, calibrated scale.' },
      { key: 'standing_height', label: 'Standing Height',       unit: 'cm', step: 0.1, min: 140, max: 220, protocol: 'Stadiometer, no shoes, head in Frankfort plane.' },
      { key: 'sitting_height',  label: 'Sitting Height',        unit: 'cm', step: 0.1, min: 70, max: 110, protocol: 'Sitting on flat surface, back straight.' },
      { key: 'wingspan',        label: 'Wingspan (Arm Span)',   unit: 'cm', step: 0.1, min: 140, max: 230, protocol: 'Arms horizontal, fingertip to fingertip against a wall.' },
      { key: 'body_fat_pct',    label: 'Body Fat %',            unit: '%',  step: 0.1, min: 3, max: 45, protocol: 'DEXA preferred. ISAK skinfolds or BIA acceptable if standardised.' },
      { key: 'sum_7_skinfolds', label: 'Sum of 7 Skinfolds',   unit: 'mm', step: 0.5, min: 25, max: 250, protocol: 'ISAK level 1 sites: tri, sub, bi, supraspinale, abdominal, thigh, calf.' },
      { key: 'lean_mass',       label: 'Lean Body Mass',        unit: 'kg', step: 0.1, min: 25, max: 130, protocol: 'DEXA total lean (excluding bone mineral content).' },
      { key: 'fat_mass',        label: 'Fat Mass',              unit: 'kg', step: 0.1, min: 2, max: 80, protocol: 'DEXA or derived from body fat % and body mass.' },
    ],
  },
]

type MetricDef = {
  key: string; label: string; unit: string; step: number;
  min?: number; max?: number; protocol?: string
}
type CategoryDef = typeof METRIC_CATALOG[number]

// Flat index for quick-log lookup
const METRIC_INDEX: Record<string, MetricDef & { category: string; color: string }> = {}
METRIC_CATALOG.forEach((cat) => {
  cat.metrics.forEach((m) => {
    METRIC_INDEX[m.key] = { ...m, category: cat.category, color: cat.color }
  })
})

// ═══════════════════════════════════════════════════════════════════════
// MAIN LOG SCREEN
// ═══════════════════════════════════════════════════════════════════════
export default function LogScreen() {
  const { user, profile } = useAuth()
  const [logMode, setLogMode] = useState<'physical' | 'competition'>('physical')
  const [selectedCategory, setSelectedCategory] = useState<CategoryDef | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<MetricDef | null>(null)
  const [value, setValue] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [protocolOpen, setProtocolOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [error, setError] = useState('')
  const [recentKeys, setRecentKeys] = useState<string[]>([])
  const inputScale = useRef(new Animated.Value(1)).current

  // ── Gamification state ──
  const [allLogs, setAllLogs] = useState<any[]>([])
  const [totalXP, setTotalXP] = useState(0)
  const [streak, setStreak] = useState(0)
  const [showPBCeleb, setShowPBCeleb] = useState(false)
  const [pbCelebData, setPbCelebData] = useState({ value: '', unit: '', label: '', improvement: '' })
  const [showXPPopup, setShowXPPopup] = useState(false)
  // ── Intelligence card state ──
  const [showDnaShift, setShowDnaShift] = useState(false)
  const [beforeLogs, setBeforeLogs] = useState<any[]>([])
  const [afterLogs, setAfterLogs] = useState<any[]>([])
  const [lastSavedMetric, setLastSavedMetric] = useState<{ key: string; value: number; unit: string } | null>(null)
  const [xpPopupData, setXpPopupData] = useState<{
    breakdown: { reason: string; xp: number }[]
    message: string
    newBadges: Badge[]
    leveledUp: boolean
    newLevel?: { level: number; title: string; icon: string }
  }>({ breakdown: [], message: '', newBadges: [], leveledUp: false })

  // Load all logs for gamification stats
  useEffect(() => {
    if (!user) return
    selectFrom('athlete_metrics', {
      filter: `athlete_id=eq.${user.id}`,
      order: 'recorded_at.desc',
      limit: '1000',
    })
      .then((rows) => {
        setAllLogs(rows || [])
        // Compute XP from existing logs (rough bootstrap)
        const xp = getXP(user.id) || (rows || []).length * 25
        if (!XP_STORE[user.id]) XP_STORE[user.id] = xp
        setTotalXP(xp)
        // Compute streak
        const dates = (rows || []).map((r: any) => r.recorded_at)
        const s = calculateStreak(dates)
        setStreak(s.current)
      })
      .catch(() => {})
  }, [user])

  // Load recent metrics for quick-log
  useEffect(() => {
    if (user) setRecentKeys(loadRecent(user.id))
  }, [user, selectedMetric])

  // Load history for selected metric
  useEffect(() => {
    if (!selectedMetric || !user) return
    selectFrom('athlete_metrics', {
      filter: `athlete_id=eq.${user.id}&metric_key=eq.${selectedMetric.key}`,
      order: 'recorded_at.desc',
      limit: '20',
    })
      .then((rows) => setHistory(rows || []))
      .catch(() => setHistory([]))
  }, [selectedMetric, user])

  const currentPB = useMemo(() => {
    if (!history.length || !selectedMetric) return null
    const lower = LOWER_IS_BETTER.has(selectedMetric.key)
    return history.reduce((best, row) => {
      const v = parseFloat(row.value)
      if (best === null) return v
      return lower ? Math.min(best, v) : Math.max(best, v)
    }, null as number | null)
  }, [history, selectedMetric])

  const isToday = date === new Date().toISOString().slice(0, 10)

  // Build current stats for badge checking
  const buildStats = useCallback((): UserStats => {
    const today = new Date().toISOString().slice(0, 10)
    const logsToday = allLogs.filter((l) => (l.recorded_at || l._recorded_at)?.startsWith(today)).length
    const uniqueMetrics = new Set(allLogs.map((l: any) => l.metric_key)).size
    const uniqueKeys = [...new Set(allLogs.map((l: any) => l.metric_key))]
    const dates = allLogs.map((r: any) => r.recorded_at || r._recorded_at)
    const s = calculateStreak(dates)
    const uniqueDays = new Set(dates.map((d: string) => d?.slice(0, 10))).size

    // Compute PBs client-side (is_pb not in DB schema)
    const pbKeys = new Set<string>()
    const pbTracker: Record<string, number> = {}
    for (const l of allLogs) {
      const k = l.metric_key
      const v = parseFloat(l.value)
      const lower = LOWER_IS_BETTER.has(k)
      if (!(k in pbTracker) || (lower ? v < pbTracker[k] : v > pbTracker[k])) {
        pbTracker[k] = v
      }
    }

    return {
      totalLogs: allLogs.length,
      totalPBs: Object.keys(pbTracker).length,
      currentStreak: s.current,
      longestStreak: s.longest,
      categoriesLogged: countUniqueCategories(uniqueKeys),
      totalXP: getXP(user?.id || ''),
      daysActive: uniqueDays,
      logsToday,
      uniqueMetrics,
    }
  }, [allLogs, user])

  const validate = (): string | null => {
    if (!value) return 'Enter a value.'
    const v = parseFloat(value)
    if (Number.isNaN(v)) return 'Enter a numeric value.'
    if (selectedMetric?.min != null && v < selectedMetric.min)
      return `Below plausible range (min ${selectedMetric.min} ${selectedMetric.unit}).`
    if (selectedMetric?.max != null && v > selectedMetric.max)
      return `Above plausible range (max ${selectedMetric.max} ${selectedMetric.unit}).`
    return null
  }

  const handleSave = async () => {
    if (!selectedMetric || !user) return
    setError('')
    const issue = validate()
    if (issue) { setError(issue); return }

    setSaving(true)
    const numValue = parseFloat(value)
    const lower = LOWER_IS_BETTER.has(selectedMetric.key)
    const isPB = currentPB === null || (lower ? numValue < currentPB : numValue > currentPB)

    try {
      // Map UI category name to DB enum value (lowercase)
      const catInfo = METRIC_INDEX[selectedMetric.key]
      const categoryMap: Record<string, string> = {
        Speed: 'speed', Power: 'power', Strength: 'strength',
        Mobility: 'mobility', Endurance: 'endurance', Anthropometrics: 'anthropometrics',
      }
      const dbCategory = categoryMap[catInfo?.category || selectedCategory?.category || ''] || 'speed'

      await insertInto('athlete_metrics', {
        athlete_id: user.id,
        category: dbCategory,
        metric_key: selectedMetric.key,
        metric_label: selectedMetric.label,
        value: numValue,
        unit: selectedMetric.unit,
        recorded_at: date,
        notes: notes || null,
      })

      // Track recent for quick-log
      pushRecent(user.id, selectedMetric.key)

      // ── Intelligence: snapshot DNA before/after ──
      setBeforeLogs([...allLogs])
      const newLog = {
        metric_key: selectedMetric.key,
        value: numValue,
        unit: selectedMetric.unit,
        recorded_at: date,
        _recorded_at: date,
      }
      setAfterLogs([newLog, ...allLogs])
      setLastSavedMetric({ key: selectedMetric.key, value: numValue, unit: selectedMetric.unit })
      setShowDnaShift(true)
      setTimeout(() => setShowDnaShift(false), 8000)

      // ── Gamification calculations ──
      const oldStats = buildStats()
      const today = new Date().toISOString().slice(0, 10)
      const logsToday = allLogs.filter((l) => (l.recorded_at || l._recorded_at)?.startsWith(today)).length + 1
      const existingMetricKeys = new Set(allLogs.map((l: any) => l.metric_key))
      const isFirstEver = allLogs.length === 0
      const isNewCategory = !existingMetricKeys.has(selectedMetric.key) &&
        !allLogs.some((l: any) => getMetricCategory(l.metric_key) === getMetricCategory(selectedMetric.key))

      // Update streak
      const newDates = [date, ...allLogs.map((r: any) => r.recorded_at || r._recorded_at)]
      const newStreak = calculateStreak(newDates)
      setStreak(newStreak.current)

      // Calculate XP
      const xpResult = calculateLogXP({
        isPB,
        hasNotes: !!notes,
        isFirstEver,
        isNewCategory,
        logsToday,
        currentStreak: newStreak.current,
      })
      addXP(user.id, xpResult.total)
      const newTotalXP = getXP(user.id)
      setTotalXP(newTotalXP)

      // Check for level up
      const oldLevel = getLevelFromXP(newTotalXP - xpResult.total)
      const newLevel = getLevelFromXP(newTotalXP)
      const leveledUp = newLevel.level > oldLevel.level

      // Check for new badges
      const newStats: UserStats = {
        ...oldStats,
        totalLogs: oldStats.totalLogs + 1,
        totalPBs: isPB ? oldStats.totalPBs + 1 : oldStats.totalPBs,
        currentStreak: newStreak.current,
        longestStreak: Math.max(oldStats.longestStreak, newStreak.longest),
        categoriesLogged: isNewCategory ? oldStats.categoriesLogged + 1 : oldStats.categoriesLogged,
        totalXP: newTotalXP,
        logsToday,
        uniqueMetrics: existingMetricKeys.has(selectedMetric.key)
          ? oldStats.uniqueMetrics
          : oldStats.uniqueMetrics + 1,
      }
      const newBadges = getNewBadges(oldStats, newStats)

      // Get motivational message
      const message = getMotivationalMessage(isPB, newStreak.current)

      // ── Show celebration UI ──
      if (isPB) {
        const improvement = currentPB != null
          ? (lower
            ? `-${(currentPB - numValue).toFixed(2)}${selectedMetric.unit}`
            : `+${(numValue - currentPB).toFixed(2)}${selectedMetric.unit}`)
          : undefined
        setPbCelebData({
          value: String(numValue),
          unit: selectedMetric.unit,
          label: selectedMetric.label,
          improvement: improvement || '',
        })
        setShowPBCeleb(true)
        setTimeout(() => setShowPBCeleb(false), 5000)
      }

      // Always show XP popup (after a short delay if PB, so celebrations stack)
      setTimeout(() => {
        setXpPopupData({
          breakdown: xpResult.breakdown,
          message,
          newBadges,
          leveledUp,
          newLevel: leveledUp ? newLevel : undefined,
        })
        setShowXPPopup(true)
        setTimeout(() => setShowXPPopup(false), 4500)
      }, isPB ? 800 : 100)

      // Quick pulse on input
      Animated.sequence([
        Animated.timing(inputScale, { toValue: 1.05, duration: 100, useNativeDriver: false }),
        Animated.timing(inputScale, { toValue: 1, duration: 100, useNativeDriver: false }),
      ]).start()

      setValue('')
      setNotes('')
      setError('')

      // Update allLogs for stats
      const fakeNewLog = {
        metric_key: selectedMetric.key,
        value: numValue,
        unit: selectedMetric.unit,
        recorded_at: date,
        _recorded_at: date,
      }
      setAllLogs((prev) => [fakeNewLog, ...prev])

      // Refresh history
      const rows = await selectFrom('athlete_metrics', {
        filter: `athlete_id=eq.${user.id}&metric_key=eq.${selectedMetric.key}`,
        order: 'recorded_at.desc',
        limit: '20',
      })
      setHistory(rows || [])
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    }
    setSaving(false)
  }

  // Quick-log handler — jump straight to a metric
  const handleQuickLog = (metricKey: string) => {
    const info = METRIC_INDEX[metricKey]
    if (!info) return
    const cat = METRIC_CATALOG.find((c) => c.category === info.category)
    if (cat) {
      setSelectedCategory(cat)
      setSelectedMetric(info)
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // METRIC INPUT VIEW — Big number input with validation + PB celebration
  // ══════════════════════════════════════════════════════════════════════
  if (selectedMetric && selectedCategory) {
    const cat = selectedCategory
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.inputScreenContent} keyboardShouldPersistTaps="handled">
          {/* Back */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              setSelectedMetric(null)
              setHistory([])
              setValue('')
              setNotes('')
              setDate(new Date().toISOString().slice(0, 10))
              setShowMore(false)
              setProtocolOpen(false)
              setError('')
            }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text.secondary} />
            <Text style={styles.backText}>{cat.category}</Text>
          </TouchableOpacity>

          {/* Metric header */}
          <View style={styles.inputHeader}>
            <View style={[styles.inputIconWrap, { backgroundColor: cat.color + '15' }]}>
              <Ionicons name={cat.icon as any} size={20} color={cat.color} />
            </View>
            <MonoKicker color={cat.color}>{cat.category}</MonoKicker>
            <Text style={styles.metricTitle}>{selectedMetric.label}</Text>
          </View>

          {/* Current PB indicator */}
          {currentPB !== null && (
            <View style={styles.pbRow}>
              <View style={styles.pbDot} />
              <Text style={styles.pbLabel}>CURRENT PB</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.pbValue}>
                {currentPB} <Text style={styles.pbUnit}>{selectedMetric.unit}</Text>
              </Text>
            </View>
          )}

          {/* Big input */}
          <Animated.View style={[styles.inputWrap, { transform: [{ scale: inputScale }] }]}>
            <View style={[styles.inputBorder, { borderColor: cat.color + '40' }]}>
              <TextInput
                style={styles.valueInput}
                keyboardType="decimal-pad"
                placeholder={
                  selectedMetric.min != null
                    ? `${selectedMetric.min}–${selectedMetric.max}`
                    : '0.00'
                }
                placeholderTextColor={colors.text.dimmed}
                value={value}
                onChangeText={(t) => { setValue(t); setError('') }}
                autoFocus
              />
              <Text style={styles.unitLabel}>{selectedMetric.unit}</Text>
            </View>
          </Animated.View>

          {/* More details toggle (date + notes) */}
          <TouchableOpacity
            style={styles.moreToggle}
            onPress={() => setShowMore(!showMore)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showMore ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={colors.text.muted}
            />
            <Text style={styles.moreToggleText}>
              {showMore ? 'Hide details' : `${isToday ? 'Today' : date} · add notes`}
            </Text>
          </TouchableOpacity>

          {showMore && (
            <View style={styles.moreSection}>
              {/* Date picker */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>DATE</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.text.dimmed}
                  keyboardType={Platform.OS === 'web' ? 'default' : 'default'}
                />
              </View>
              {/* Notes */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>NOTES</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. fresh legs, indoor, 3rd attempt"
                  placeholderTextColor={colors.text.dimmed}
                />
              </View>
            </View>
          )}

          {/* Protocol — collapsible accordion */}
          {selectedMetric.protocol && (
            <TouchableOpacity
              style={styles.protocolToggle}
              onPress={() => setProtocolOpen(!protocolOpen)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={protocolOpen ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={colors.text.muted}
              />
              <Text style={styles.protocolToggleText}>Protocol</Text>
            </TouchableOpacity>
          )}
          {protocolOpen && selectedMetric.protocol && (
            <View style={styles.protocolBody}>
              <View style={styles.protocolBar} />
              <Text style={styles.protocolText}>{selectedMetric.protocol}</Text>
            </View>
          )}

          {/* Inline error */}
          {!!error && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color={colors.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* PB celebration */}
          <PBCelebration
            visible={showPBCeleb}
            value={pbCelebData.value}
            unit={pbCelebData.unit}
            metricLabel={pbCelebData.label}
            improvement={pbCelebData.improvement || undefined}
          />

          {/* ── Intelligence: DNA Shift + Metric Impact ── */}
          <DnaShiftCard
            beforeMetrics={beforeLogs}
            afterMetrics={afterLogs}
            visible={showDnaShift}
          />
          {lastSavedMetric && showDnaShift && (
            <MetricImpactLine
              metricKey={lastSavedMetric.key}
              value={lastSavedMetric.value}
              unit={lastSavedMetric.unit}
              discipline={profile?.primary_discipline || null}
              sex={profile?.sex || 'M'}
              visible={showDnaShift}
            />
          )}

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, (!value || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!value || saving}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Metric'}</Text>
          </TouchableOpacity>

          {/* History */}
          {history.length > 0 && (
            <AlmanacCard kicker="HISTORY" title={`${history.length} entries`} accent={cat.color} style={{ marginTop: spacing.xxl }}>
              {history.slice(0, 10).map((row, i) => {
                const v = parseFloat(row.value)
                // Compute PB client-side
              const lower = LOWER_IS_BETTER.has(selectedMetric.key)
              const allVals = history.map((h) => parseFloat(h.value))
              const bestVal = lower ? Math.min(...allVals) : Math.max(...allVals)
              const rowIsPB = v === bestVal
                const isLast = i === Math.min(history.length, 10) - 1
                return (
                  <View key={i} style={[styles.historyRow, isLast && { borderBottomWidth: 0 }]}>
                    <View>
                      <Text style={styles.historyValue}>
                        {v} <Text style={styles.historyUnit}>{selectedMetric.unit}</Text>
                      </Text>
                      <Text style={styles.historyDate}>
                        {new Date(row.recorded_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                        {row.notes ? ` · ${row.notes}` : ''}
                      </Text>
                    </View>
                    {rowIsPB && (
                      <View style={styles.historyPB}>
                        <Text style={styles.historyPBText}>PB</Text>
                      </View>
                    )}
                  </View>
                )
              })}
            </AlmanacCard>
          )}
        </ScrollView>

        {/* XP Popup */}
        <XPPopup
          visible={showXPPopup}
          xpBreakdown={xpPopupData.breakdown}
          totalXP={totalXP}
          message={xpPopupData.message}
          newBadges={xpPopupData.newBadges}
          leveledUp={xpPopupData.leveledUp}
          newLevel={xpPopupData.newLevel}
        />
      </SafeAreaView>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // METRIC PICKER — List of metrics within a category
  // ══════════════════════════════════════════════════════════════════════
  if (selectedCategory) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedCategory(null)}>
            <Ionicons name="arrow-back" size={20} color={colors.text.secondary} />
            <Text style={styles.backText}>Categories</Text>
          </TouchableOpacity>
          <View style={styles.catTitleRow}>
            <View style={[styles.catTitleIcon, { backgroundColor: selectedCategory.color + '15' }]}>
              <Ionicons name={selectedCategory.icon as any} size={20} color={selectedCategory.color} />
            </View>
            <View>
              <MonoKicker color={selectedCategory.color}>{selectedCategory.category}</MonoKicker>
              <Text style={styles.catDesc}>{selectedCategory.description}</Text>
            </View>
          </View>
        </View>
        <FlatList
          data={selectedCategory.metrics}
          keyExtractor={(m) => m.key}
          contentContainerStyle={styles.metricList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.metricCard}
              onPress={() => setSelectedMetric(item)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.metricLabel}>{item.label}</Text>
                {item.protocol && (
                  <Text style={styles.metricProtocol} numberOfLines={1}>
                    {item.protocol}
                  </Text>
                )}
              </View>
              <View style={styles.metricRight}>
                <Text style={[styles.metricUnit, { color: selectedCategory.color }]}>{item.unit}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.text.dimmed} />
              </View>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // COMPETITION LOG MODE
  // ══════════════════════════════════════════════════════════════════════
  if (logMode === 'competition') {
    return (
      <SafeAreaView style={styles.safe}>
        <CompetitionLog onClose={() => setLogMode('physical')} />
      </SafeAreaView>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // CATEGORY PICKER (default view) + Quick-log + Performance Hero
  // ══════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <MonoKicker>TRAINING DIARY</MonoKicker>
            <Text style={styles.screenTitle}>Log</Text>
          </View>
          <StreakChip streak={streak} />
        </View>
        <Text style={styles.screenSub}>Record a physical metric or competition result</Text>
      </View>

      {/* Mode toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, logMode === 'physical' && styles.modeBtnActive]}
          onPress={() => setLogMode('physical')}
        >
          <Ionicons name="barbell-outline" size={16} color={logMode === 'physical' ? colors.orange[500] : colors.text.muted} />
          <Text style={[styles.modeBtnText, logMode === 'physical' && styles.modeBtnTextActive]}>Physical</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, logMode === 'competition' && styles.modeBtnActive]}
          onPress={() => setLogMode('competition')}
        >
          <Ionicons name="trophy-outline" size={16} color={logMode === 'competition' ? colors.orange[500] : colors.text.muted} />
          <Text style={[styles.modeBtnText, logMode === 'competition' && styles.modeBtnTextActive]}>Competition</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.catList} showsVerticalScrollIndicator={false}>
        {/* XP Progress Bar */}
        {allLogs.length > 0 && <XPBar totalXP={totalXP} />}

        {/* Quick-log row — last 3 metrics */}
        {recentKeys.length > 0 && (
          <View style={styles.quickLogSection}>
            <View style={styles.quickLogHeader}>
              <Ionicons name="time-outline" size={12} color={colors.text.muted} />
              <Text style={styles.quickLogLabel}>QUICK LOG</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickLogRow}>
              {recentKeys.map((key) => {
                const m = METRIC_INDEX[key]
                if (!m) return null
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.quickLogPill, { borderColor: m.color + '33', backgroundColor: m.color + '0d' }]}
                    onPress={() => handleQuickLog(key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={14} color={m.color} />
                    <Text style={styles.quickLogPillText}>{m.label}</Text>
                    <Text style={styles.quickLogPillUnit}>{m.unit}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        )}

        {/* Performance Hero Card */}
        <TouchableOpacity
          style={styles.perfHero}
          onPress={() => setLogMode('competition')}
          activeOpacity={0.8}
        >
          <View style={styles.perfHeroGlow} />
          <View style={styles.perfHeroContent}>
            <View style={{ flex: 1 }}>
              <View style={styles.perfHeroTop}>
                <View style={styles.perfHeroIcon}>
                  <Ionicons name="trophy" size={16} color="#0a0a0f" />
                </View>
                <Text style={styles.perfHeroKicker}>PRIMARY</Text>
              </View>
              <Text style={styles.perfHeroTitle}>Performance</Text>
              <Text style={styles.perfHeroSub}>Race or training mark in your discipline. Feeds your trajectory.</Text>
            </View>
            <Ionicons name="add" size={22} color={colors.orange[300]} />
          </View>
        </TouchableOpacity>

        {/* Category grid label */}
        <Text style={styles.catGridLabel}>PHYSICAL QUALITIES</Text>

        {/* Category cards */}
        {METRIC_CATALOG.map((cat) => (
          <TouchableOpacity
            key={cat.category}
            style={styles.catCard}
            onPress={() => setSelectedCategory(cat)}
            activeOpacity={0.7}
          >
            {/* Subtle glow */}
            <View style={[styles.catCardGlow, { backgroundColor: cat.color }]} />
            <View style={[styles.catIconWrap, { backgroundColor: cat.color + '15' }]}>
              <Ionicons name={cat.icon as any} size={22} color={cat.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.catCardTitle}>{cat.category}</Text>
              <Text style={styles.catCardDesc}>{cat.description}</Text>
            </View>
            <View style={styles.catBadge}>
              <Text style={[styles.catBadgeText, { color: cat.color }]}>{cat.metrics.length}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.text.dimmed} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  screenTitle: { fontSize: 26, fontWeight: '700', color: colors.text.primary, marginTop: 4 },
  screenSub: { color: colors.text.secondary, fontSize: 14, marginTop: 4 },

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  modeBtnActive: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
  },
  modeBtnText: { color: colors.text.muted, fontSize: 13, fontWeight: '600' },
  modeBtnTextActive: { color: colors.orange[500] },

  // Back button
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { color: colors.text.secondary, fontSize: 14 },

  // Quick-log section
  quickLogSection: { marginBottom: spacing.md },
  quickLogHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: spacing.sm },
  quickLogLabel: {
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.text.muted,
    fontWeight: '600',
  },
  quickLogRow: { gap: 8 },
  quickLogPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  quickLogPillText: { color: colors.text.primary, fontSize: 13, fontWeight: '600' },
  quickLogPillUnit: { color: colors.text.muted, fontSize: 10, fontWeight: '500' },

  // Performance Hero Card
  perfHero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    backgroundColor: 'rgba(249,115,22,0.06)',
  },
  perfHeroGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.orange[500],
    opacity: 0.08,
  },
  perfHeroContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  perfHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  perfHeroIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.orange[500],
  },
  perfHeroKicker: {
    fontSize: 10,
    letterSpacing: 2,
    color: colors.orange[300],
    fontWeight: '600',
  },
  perfHeroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  perfHeroSub: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },

  // Category grid label
  catGridLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: colors.text.muted,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },

  // Category list
  catList: { padding: spacing.lg, paddingTop: 0, gap: spacing.sm },
  catCard: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  catCardGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.04,
  },
  catIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catCardTitle: { color: colors.text.primary, fontSize: 16, fontWeight: '600' },
  catCardDesc: { color: colors.text.muted, fontSize: 12, marginTop: 2 },
  catBadge: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.full,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  catBadgeText: { fontSize: 12, fontWeight: '700' },

  // Category header (metric picker)
  catTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  catTitleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catDesc: { color: colors.text.secondary, fontSize: 13, marginTop: 2 },

  // Metric list
  metricList: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  metricCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  metricLabel: { color: colors.text.primary, fontSize: 15, fontWeight: '500' },
  metricProtocol: { color: colors.text.dimmed, fontSize: 11, marginTop: 3 },
  metricRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricUnit: { fontSize: 13, fontWeight: '600' },

  // Input screen
  inputScreenContent: { padding: spacing.xxl, paddingTop: spacing.lg },
  inputHeader: { alignItems: 'center', marginBottom: spacing.lg },
  inputIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  metricTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: 8,
  },

  // PB row
  pbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.2)',
    gap: 8,
  },
  pbDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  pbLabel: { fontSize: 10, letterSpacing: 1.5, color: colors.green, fontWeight: '700' },
  pbValue: { fontSize: 16, fontWeight: '700', color: colors.green },
  pbUnit: { fontSize: 12, fontWeight: '400' },

  // Input
  inputWrap: { alignItems: 'center', marginVertical: spacing.xl },
  inputBorder: {
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  valueInput: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.orange[400],
    textAlign: 'center',
    minWidth: 160,
    paddingVertical: spacing.sm,
  },
  unitLabel: {
    color: colors.text.muted,
    fontSize: 13,
    marginTop: spacing.sm,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // More details toggle
  moreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing.sm,
  },
  moreToggleText: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  moreSection: { marginBottom: spacing.md, gap: spacing.md },
  fieldGroup: {},
  fieldLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.text.muted,
    fontWeight: '600',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text.primary,
  },

  // Protocol accordion
  protocolToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing.sm,
  },
  protocolToggleText: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  protocolBody: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingLeft: spacing.md,
  },
  protocolBar: {
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 1,
    marginRight: spacing.md,
  },
  protocolText: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 18,
  },

  // Error row
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(244,63,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.25)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.red, fontSize: 12, flex: 1 },

  // Save button
  saveBtn: {
    backgroundColor: colors.orange[500],
    borderRadius: radius.md,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    shadowColor: colors.orange[500],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  saveBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },

  // History
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  historyValue: { color: colors.text.primary, fontSize: 15, fontWeight: '600' },
  historyUnit: { fontSize: 12, fontWeight: '400', color: colors.text.muted },
  historyDate: { color: colors.text.dimmed, fontSize: 11, marginTop: 2 },
  historyPB: {
    backgroundColor: colors.green + '20',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.green + '40',
  },
  historyPBText: { color: colors.green, fontSize: 9, fontWeight: '800', letterSpacing: 1 },

})

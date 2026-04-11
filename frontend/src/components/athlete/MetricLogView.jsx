import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Trophy, Dumbbell, Zap, Flame, Activity, Heart, Ruler,
  ChevronLeft, AlertCircle, Plus, Check, ChevronDown, History,
} from 'lucide-react'
import { insertInto } from '../../lib/supabaseRest'
import { analytics } from '../../lib/analytics'

// ═══════════════════════════════════════════════════════════════════════
// BRAND TOKENS — match the home page (slate gradient + orange accent)
// ═══════════════════════════════════════════════════════════════════════
const ORANGE      = '#f97316'
const ORANGE_LITE = '#fb923c'

// ═══════════════════════════════════════════════════════════════════════
// METRIC CATALOG — unchanged data, restyled accents
// ═══════════════════════════════════════════════════════════════════════
const METRIC_CATALOG = {
  speed: {
    label: 'Speed',
    icon: Zap,
    tint: '#f97316',
    blurb: 'Sprint splits and top-end velocity.',
    metrics: [
      { key: 'sprint_10m',  label: '0–10 m split',          unit: 's',   type: 'number', step: 0.01, min: 1.2, max: 3.5,
        protocol: 'Standing or 3-point start, electronic timing gates at 0 m and 10 m. Take best of 3 with ≥3 min rest.' },
      { key: 'sprint_20m',  label: '0–20 m split',          unit: 's',   type: 'number', step: 0.01, min: 2.2, max: 5.0,
        protocol: 'Same start as 10 m. Gate at 20 m. Best of 3 trials.' },
      { key: 'sprint_30m',  label: '0–30 m split',          unit: 's',   type: 'number', step: 0.01, min: 3.2, max: 6.5,
        protocol: 'Standing start, fully rested, indoor track if possible. Best of 3.' },
      { key: 'sprint_40m',  label: '0–40 m split',          unit: 's',   type: 'number', step: 0.01, min: 4.2, max: 8.0,
        protocol: 'Electronic timing only — hand timing inflates results by ~0.2 s.' },
      { key: 'sprint_60m',  label: '0–60 m split',          unit: 's',   type: 'number', step: 0.01, min: 6.2, max: 11.0,
        protocol: 'Block or 3-point start. Wind-legal if outdoors (<+2.0 m/s).' },
      { key: 'flying_10m',  label: 'Flying 10 m',           unit: 's',   type: 'number', step: 0.01, min: 0.80, max: 1.60,
        protocol: '20 m run-in to gate, then time across 10 m. Use to derive max velocity.' },
      { key: 'max_velocity', label: 'Max velocity',         unit: 'm/s', type: 'number', step: 0.01, min: 6.0, max: 13.5,
        protocol: 'Radar or LPS device, or compute from a 10 m fly: v = 10 / fly time.' },
      { key: 'split_300m',  label: '300 m split',           unit: 's',   type: 'number', step: 0.01, min: 30.0, max: 70.0,
        protocol: 'Single rep on track, full warm-up, recorded in lane 1. Used as 400 m predictor.' },
    ],
  },
  power: {
    label: 'Power',
    icon: Flame,
    tint: '#fb923c',
    blurb: 'Jump and ballistic outputs.',
    metrics: [
      { key: 'cmj_height',     label: 'CMJ jump height',                 unit: 'cm',   type: 'number', step: 0.1, min: 10, max: 90,
        protocol: 'Hands on hips, free counter-movement to self-selected depth. Force plate or validated jump mat. Best of 3.' },
      { key: 'cmj_rel_pp',     label: 'CMJ relative peak power',         unit: 'W/kg', type: 'number', step: 0.1, min: 20, max: 110,
        protocol: 'Force plate concentric phase — peak power ÷ body mass. Best of 3.' },
      { key: 'cmj_peak_force', label: 'CMJ peak force',                  unit: 'N',    type: 'number', step: 1,   min: 800, max: 5000,
        protocol: 'Concentric peak vertical GRF from force plate.' },
      { key: 'sj_height',      label: 'Squat jump height',               unit: 'cm',   type: 'number', step: 0.1, min: 10, max: 80,
        protocol: '90° knee, 3 s pause, no dip. Hands on hips. Force plate or jump mat.' },
      { key: 'eur',            label: 'Eccentric utilization ratio',     unit: 'CMJ/SJ', type: 'number', step: 0.01, min: 0.85, max: 1.30,
        protocol: 'CMJ height ÷ SJ height. Same session, 3 reps each.' },
      { key: 'broad_jump',     label: 'Standing broad jump',             unit: 'm',    type: 'number', step: 0.01, min: 1.20, max: 4.00,
        protocol: 'Two-foot take-off from a line, two-foot landing under control. Best of 3.' },
      { key: 'rsi_dj30',       label: 'RSI (drop jump, 30 cm box)',      unit: 'm/s',  type: 'number', step: 0.01, min: 0.5, max: 4.5,
        protocol: 'Drop from 30 cm, instructed minimal contact time. RSI = jump height ÷ contact time.' },
      { key: 'rsi_mod',        label: 'RSI-modified (CMJ)',              unit: 'm/s',  type: 'number', step: 0.01, min: 0.20, max: 1.20,
        protocol: 'CMJ jump height ÷ time-to-take-off (force plate).' },
      { key: 'imtp_rfd_100',   label: 'IMTP RFD 0–100 ms',               unit: 'N/s',  type: 'number', step: 1,   min: 1000, max: 25000,
        protocol: 'Isometric mid-thigh pull on a fixed bar. Force plate, max effort, 5 s rep.' },
    ],
  },
  strength: {
    label: 'Strength',
    icon: Dumbbell,
    tint: '#f43f5e',
    blurb: 'Maximal and relative strength.',
    metrics: [
      { key: 'back_squat_1rm',   label: 'Back squat 1RM (or e1RM)',       unit: 'kg', type: 'number', step: 0.5, min: 20, max: 400,
        protocol: 'True 1RM or estimated via Epley from a clean rep ≤5 RIR 0. Note depth (parallel/below).' },
      { key: 'front_squat_1rm',  label: 'Front squat 1RM',                unit: 'kg', type: 'number', step: 0.5, min: 20, max: 300 },
      { key: 'bench_1rm',        label: 'Bench press 1RM',                unit: 'kg', type: 'number', step: 0.5, min: 20, max: 300,
        protocol: 'Pause on chest, no bounce, full lockout. Spotter present.' },
      { key: 'deadlift_1rm',     label: 'Deadlift 1RM',                   unit: 'kg', type: 'number', step: 0.5, min: 20, max: 400,
        protocol: 'Conventional or sumo (note which). Bar to mid-thigh standing.' },
      { key: 'power_clean_1rm',  label: 'Power clean 1RM',                unit: 'kg', type: 'number', step: 0.5, min: 20, max: 220 },
      { key: 'snatch_1rm',       label: 'Snatch 1RM',                     unit: 'kg', type: 'number', step: 0.5, min: 20, max: 200 },
      { key: 'hip_thrust_1rm',   label: 'Barbell hip thrust 1RM',         unit: 'kg', type: 'number', step: 0.5, min: 40, max: 350 },
      { key: 'imtp_peak_force',  label: 'IMTP peak vertical force',       unit: 'N',  type: 'number', step: 1,   min: 1000, max: 6000,
        protocol: 'Isometric mid-thigh pull, knee 125–145°, hip 140–150°, max effort 5 s on a force plate.' },
      { key: 'imtp_rel_force',   label: 'IMTP relative peak force',       unit: 'N/kg BW', type: 'number', step: 0.01, min: 15, max: 60,
        protocol: 'IMTP peak vertical force ÷ body mass.' },
      { key: 'pullup_max',       label: 'Pull-ups (max strict reps)',     unit: 'reps', type: 'number', step: 1, min: 0, max: 60,
        protocol: 'Dead-hang, chin over bar, no kip.' },
      { key: 'weighted_pullup',  label: 'Weighted pull-up 1RM (added load)', unit: 'kg', type: 'number', step: 0.5, min: 0, max: 100 },
    ],
  },
  mobility: {
    label: 'Mobility',
    icon: Activity,
    tint: '#14b8a6',
    blurb: 'Joint range and movement quality.',
    metrics: [
      { key: 'sit_and_reach',  label: 'Sit and reach',                    unit: 'cm',  type: 'number', step: 0.5, min: -20, max: 45,
        protocol: 'Standard sit-and-reach box, shoes off, knees flat. Slow reach, hold 2 s. Best of 3.' },
      { key: 'knee_to_wall_l', label: 'Knee-to-wall (left)',              unit: 'cm',  type: 'number', step: 0.5, min: 0, max: 20,
        protocol: 'Distance from longest toe to wall when knee touches wall, heel down. Indicates ankle dorsiflexion.' },
      { key: 'knee_to_wall_r', label: 'Knee-to-wall (right)',             unit: 'cm',  type: 'number', step: 0.5, min: 0, max: 20 },
      { key: 'thomas_l',       label: 'Thomas test (left hip flexor)',    unit: '°',   type: 'number', step: 1,   min: -30, max: 30,
        protocol: 'Supine on bench, opposite knee to chest. Measure hip extension angle (negative = tight hip flexor).' },
      { key: 'thomas_r',       label: 'Thomas test (right hip flexor)',   unit: '°',   type: 'number', step: 1,   min: -30, max: 30 },
      { key: 'aslr_l',         label: 'Active straight-leg raise (left)', unit: '°',   type: 'number', step: 1,   min: 30, max: 110,
        protocol: 'Supine, knee straight, raise leg as high as possible without lumbar flexion. Goniometer at hip.' },
      { key: 'aslr_r',         label: 'Active straight-leg raise (right)', unit: '°',  type: 'number', step: 1,   min: 30, max: 110 },
      { key: 'shoulder_flex',  label: 'Shoulder flexion ROM',             unit: '°',   type: 'number', step: 1,   min: 100, max: 200,
        protocol: 'Supine, arm overhead, lumbar flat. Goniometer at acromion.' },
      { key: 'overhead_squat', label: 'Overhead squat (FMS 0–3)',         unit: 'score', type: 'number', step: 1, min: 0, max: 3 },
      { key: 'fms_total',      label: 'FMS total score',                  unit: '/21', type: 'number', step: 1,   min: 0, max: 21,
        protocol: 'Functional Movement Screen, 7 tests. Trained tester only.' },
      { key: 'adductor_squeeze', label: 'Adductor squeeze (long lever)',  unit: 'mmHg', type: 'number', step: 1, min: 100, max: 400,
        protocol: 'Supine, knees straight, BP cuff between ankles inflated to 10 mmHg, then squeeze max 5 s.' },
    ],
  },
  endurance: {
    label: 'Endurance',
    icon: Heart,
    tint: '#3b82f6',
    blurb: 'Aerobic capacity and conditioning.',
    metrics: [
      { key: 'vo2_max',        label: 'VO₂max',                           unit: 'ml/kg/min', type: 'number', step: 0.1, min: 25, max: 95,
        protocol: 'Lab graded exercise test on treadmill or bike with metabolic cart, or validated field equation.' },
      { key: 'yoyo_ir1',       label: 'Yo-Yo IR1 distance',               unit: 'm',   type: 'number', step: 40, min: 200, max: 3500,
        protocol: '20 m shuttles with 10 s active recovery, increasing speed. Stop at 2nd failure to reach line.' },
      { key: 'yoyo_ir2',       label: 'Yo-Yo IR2 distance',               unit: 'm',   type: 'number', step: 40, min: 80, max: 2200 },
      { key: 'iftt_30_15',     label: '30-15 IFT final velocity',         unit: 'km/h', type: 'number', step: 0.5, min: 12, max: 24,
        protocol: '30 s shuttle / 15 s walk protocol. Final stage velocity = VIFT.' },
      { key: 'mas',            label: 'Maximal aerobic speed',            unit: 'km/h', type: 'number', step: 0.1, min: 12, max: 24,
        protocol: 'From 1.2–2 km TT or 5 min running test. MAS = avg velocity.' },
      { key: 'tt_1200m',       label: '1.2 km time trial',                unit: 's',   type: 'number', step: 0.1, min: 180, max: 420 },
      { key: 'bronco',         label: 'Bronco test',                      unit: 's',   type: 'number', step: 0.1, min: 240, max: 540,
        protocol: '5×(60+40+20 m) shuttles continuous, total 1200 m. Standard rugby conditioning test.' },
      { key: 'tt_2km',         label: '2 km time trial',                  unit: 's',   type: 'number', step: 0.1, min: 300, max: 720 },
      { key: 'rhr',            label: 'Resting heart rate',               unit: 'bpm', type: 'number', step: 1,   min: 30, max: 90,
        protocol: 'Measured supine, first thing on waking, 1 min average.' },
      { key: 'hrv_rmssd',      label: 'HRV (RMSSD)',                      unit: 'ms',  type: 'number', step: 1,   min: 10, max: 200,
        protocol: 'Morning, supine, 1–5 min recording with chest strap or validated app.' },
      { key: 'hr_recovery_60', label: 'HR recovery (60 s post-max)',      unit: 'bpm', type: 'number', step: 1,   min: 5, max: 80 },
    ],
  },
  anthropometrics: {
    label: 'Height & Weight',
    icon: Ruler,
    tint: '#a78bfa',
    blurb: 'Body composition and morphology.',
    metrics: [
      { key: 'body_mass',     label: 'Body mass',                         unit: 'kg',  type: 'number', step: 0.1, min: 30, max: 200,
        protocol: 'Morning, post-void, minimal clothing, calibrated scale.' },
      { key: 'standing_height', label: 'Standing height',                 unit: 'cm',  type: 'number', step: 0.1, min: 140, max: 220,
        protocol: 'Stadiometer, no shoes, head in Frankfort plane. Take after gentle traction.' },
      { key: 'sitting_height', label: 'Sitting height',                   unit: 'cm',  type: 'number', step: 0.1, min: 70, max: 110 },
      { key: 'wingspan',       label: 'Wingspan (arm span)',              unit: 'cm',  type: 'number', step: 0.1, min: 140, max: 230,
        protocol: 'Arms horizontal, fingertip to fingertip against a wall.' },
      { key: 'body_fat_pct',   label: 'Body fat %',                       unit: '%',   type: 'number', step: 0.1, min: 3, max: 45,
        protocol: 'DEXA preferred. ISAK skinfolds or BIA acceptable if standardised.' },
      { key: 'sum_7_skinfolds', label: 'Sum of 7 skinfolds (ISAK)',       unit: 'mm',  type: 'number', step: 0.5, min: 25, max: 250,
        protocol: 'ISAK level 1 sites: tri, sub, bi, supraspinale, abdominal, thigh, calf. Same tester each time.' },
      { key: 'lean_mass',      label: 'Lean body mass',                   unit: 'kg',  type: 'number', step: 0.1, min: 25, max: 130,
        protocol: 'DEXA total lean (excluding bone mineral content).' },
      { key: 'fat_mass',       label: 'Fat mass',                         unit: 'kg',  type: 'number', step: 0.1, min: 2,  max: 80 },
    ],
  },
}

const CATEGORY_ORDER = ['strength', 'speed', 'power', 'mobility', 'endurance', 'anthropometrics']

// Flat lookup for the quick-log row
const METRIC_INDEX = (() => {
  const idx = {}
  Object.entries(METRIC_CATALOG).forEach(([catKey, cat]) => {
    cat.metrics.forEach(m => { idx[m.key] = { ...m, category: catKey, tint: cat.tint } })
  })
  return idx
})()

// localStorage helpers — last 3 metrics logged, per athlete
const recentKey = (athleteId) => `bnchmrkd:recent_metrics:${athleteId || 'anon'}`
function loadRecent(athleteId) {
  try { return JSON.parse(localStorage.getItem(recentKey(athleteId)) || '[]') } catch (e) { return [] }
}
function pushRecent(athleteId, metricKey) {
  try {
    const cur = loadRecent(athleteId).filter(k => k !== metricKey)
    cur.unshift(metricKey)
    localStorage.setItem(recentKey(athleteId), JSON.stringify(cur.slice(0, 3)))
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function MetricLogView({ athleteId, PerformancePanel }) {
  // activeView can be: null (picker) | 'performance' | a category key | { quickMetricKey }
  const [activeView, setActiveView] = useState(null)
  const [toast, setToast] = useState(null) // { label, value, unit }

  const showToast = (payload) => {
    setToast(payload)
    setTimeout(() => setToast(null), 2400)
  }

  // ── Performance hand-off ─────────────────────────────────────────────
  if (activeView === 'performance') {
    return (
      <div className="space-y-3">
        <BackBar onBack={() => setActiveView(null)} label="Performance" />
        {PerformancePanel}
        <ToastSlot toast={toast} />
      </div>
    )
  }

  // ── Quick-log direct to a single metric ─────────────────────────────
  if (activeView && typeof activeView === 'object' && activeView.quickMetricKey) {
    const metric = METRIC_INDEX[activeView.quickMetricKey]
    if (metric) {
      return (
        <div className="space-y-3">
          <BackBar onBack={() => setActiveView(null)} label={METRIC_CATALOG[metric.category].label} />
          <MetricForm
            athleteId={athleteId}
            category={metric.category}
            spec={METRIC_CATALOG[metric.category]}
            initialMetricKey={metric.key}
            onSaved={(payload) => {
              pushRecent(athleteId, metric.key)
              showToast(payload)
              setActiveView(null)
            }}
          />
          <ToastSlot toast={toast} />
        </div>
      )
    }
  }

  // ── Category picked → show form ─────────────────────────────────────
  if (typeof activeView === 'string' && METRIC_CATALOG[activeView]) {
    const spec = METRIC_CATALOG[activeView]
    return (
      <div className="space-y-3">
        <BackBar onBack={() => setActiveView(null)} label={spec.label} />
        <MetricForm
          athleteId={athleteId}
          category={activeView}
          spec={spec}
          onSaved={(payload) => {
            pushRecent(athleteId, payload.metricKey)
            showToast(payload)
            setActiveView(null)
          }}
        />
        <ToastSlot toast={toast} />
      </div>
    )
  }

  // ── PICKER ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Header />

      <QuickLogRow
        athleteId={athleteId}
        onPick={(metricKey) => setActiveView({ quickMetricKey: metricKey })}
      />

      <PerformanceHeroCard onClick={() => setActiveView('performance')} />

      <div>
        <p className="mono-font text-[10px] uppercase tracking-[0.22em] text-slate-500 mb-2 px-1">
          Physical qualities
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {CATEGORY_ORDER.map(key => {
            const cat = METRIC_CATALOG[key]
            return (
              <CategoryCard
                key={key}
                cat={cat}
                onClick={() => setActiveView(key)}
              />
            )
          })}
        </div>
      </div>

      <ToastSlot toast={toast} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════════════
function Header() {
  return (
    <div className="px-1">
      <p className="mono-font text-[10px] uppercase tracking-[0.22em] text-orange-300">
        Log a session
      </p>
      <h2 className="landing-font text-white mt-1 text-2xl font-semibold leading-tight">
        What did you train?
      </h2>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// QUICK-LOG ROW — last 3 metrics, one tap to repeat
// ═══════════════════════════════════════════════════════════════════════
function QuickLogRow({ athleteId, onPick }) {
  const [recent, setRecent] = useState([])
  useEffect(() => {
    setRecent(loadRecent(athleteId))
  }, [athleteId])

  if (!recent.length) return null

  return (
    <div>
      <p className="mono-font text-[10px] uppercase tracking-[0.22em] text-slate-500 mb-2 px-1 flex items-center gap-1.5">
        <History className="w-3 h-3" />
        Quick log
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {recent.map((key) => {
          const m = METRIC_INDEX[key]
          if (!m) return null
          return (
            <button
              key={key}
              onClick={() => onPick(key)}
              className="flex-shrink-0 group relative overflow-hidden rounded-xl px-3.5 py-2.5 text-left transition-transform active:scale-[0.97]"
              style={{
                background: `linear-gradient(135deg, ${m.tint}1a 0%, ${m.tint}05 100%)`,
                border: `1px solid ${m.tint}33`,
              }}
            >
              <div className="flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" style={{ color: m.tint }} />
                <span className="landing-font text-xs font-semibold text-white whitespace-nowrap">
                  {m.label}
                </span>
                <span className="mono-font text-[10px] text-slate-500 whitespace-nowrap">
                  {m.unit}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// PERFORMANCE HERO — primary action
// ═══════════════════════════════════════════════════════════════════════
function PerformanceHeroCard({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="relative w-full overflow-hidden rounded-2xl p-5 text-left transition-transform active:scale-[0.99]"
      style={{
        background: `linear-gradient(160deg, rgba(249,115,22,0.12) 0%, rgba(249,115,22,0.04) 100%)`,
        border: `1px solid rgba(249,115,22,0.3)`,
      }}
    >
      <div
        className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 rounded-full"
        style={{ background: `radial-gradient(circle, ${ORANGE}33 0%, transparent 65%)` }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE_LITE} 100%)` }}
            >
              <Trophy className="w-4 h-4 text-slate-900" />
            </div>
            <span className="mono-font text-[10px] uppercase tracking-[0.22em] text-orange-300">
              Primary
            </span>
          </div>
          <h3 className="landing-font text-white text-xl font-semibold">Performance</h3>
          <p className="landing-font text-slate-400 text-xs mt-1 max-w-xs leading-relaxed">
            Race or training mark in your discipline. Feeds your trajectory.
          </p>
        </div>
        <Plus className="w-5 h-5 text-orange-300 flex-shrink-0 mt-1" />
      </div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// CATEGORY CARD — slate-base + tint accent
// ═══════════════════════════════════════════════════════════════════════
function CategoryCard({ cat, onClick }) {
  const Icon = cat.icon
  return (
    <button
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl p-3.5 text-left transition-transform active:scale-[0.97]"
      style={{
        background: `linear-gradient(160deg, ${cat.tint}10 0%, rgba(255,255,255,0.02) 100%)`,
        border: `1px solid ${cat.tint}26`,
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5"
        style={{ background: `${cat.tint}22`, border: `1px solid ${cat.tint}40` }}
      >
        <Icon className="w-4 h-4" style={{ color: cat.tint }} />
      </div>
      <h3 className="landing-font text-white text-sm font-semibold leading-tight">
        {cat.label}
      </h3>
      <p className="landing-font text-slate-500 text-[11px] mt-0.5 leading-snug">
        {cat.blurb}
      </p>
      <p className="mono-font text-[9px] uppercase tracking-[0.18em] text-slate-600 mt-2">
        {cat.metrics.length} metrics
      </p>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// BACK BAR
// ═══════════════════════════════════════════════════════════════════════
function BackBar({ onBack, label }) {
  return (
    <button
      onClick={onBack}
      className="inline-flex items-center gap-1 mono-font text-[10px] uppercase tracking-[0.22em] text-slate-500 hover:text-orange-300 transition-colors"
    >
      <ChevronLeft className="w-3.5 h-3.5" /> {label}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// METRIC FORM — autofocus, big value field, collapsed details
// ═══════════════════════════════════════════════════════════════════════
function MetricForm({ athleteId, category, spec, initialMetricKey, onSaved }) {
  const [metricKey, setMetricKey] = useState(initialMetricKey || spec.metrics[0].key)
  const [value, setValue] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const valueRef = useRef(null)

  const metric = useMemo(
    () => spec.metrics.find(m => m.key === metricKey) || spec.metrics[0],
    [metricKey, spec]
  )

  // Autofocus the value input on mount + when metric changes
  useEffect(() => {
    const t = setTimeout(() => valueRef.current?.focus(), 100)
    return () => clearTimeout(t)
  }, [metricKey])

  const validate = () => {
    if (!date) return 'Pick a date.'
    const v = parseFloat(value)
    if (Number.isNaN(v)) return 'Enter a numeric value.'
    if (metric.min != null && v < metric.min) return `Below plausible range (${metric.min} ${metric.unit}).`
    if (metric.max != null && v > metric.max) return `Above plausible range (${metric.max} ${metric.unit}).`
    return null
  }

  const handleSave = async () => {
    setErr('')
    const issue = validate()
    if (issue) { setErr(issue); return }
    if (!athleteId) { setErr('No athlete id — please refresh and try again.'); return }

    setSubmitting(true)
    try {
      await insertInto('athlete_metrics', {
        athlete_id: athleteId,
        category,
        metric_key: metric.key,
        metric_label: metric.label,
        unit: metric.unit,
        value: parseFloat(value),
        recorded_at: date,
        notes: notes || null,
      })
      analytics.metricLogged({ metric: metric.key })
      onSaved?.({
        label: metric.label,
        value: parseFloat(value),
        unit: metric.unit,
        metricKey: metric.key,
      })
    } catch (e) {
      setErr(e.message || 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const isToday = date === new Date().toISOString().slice(0, 10)

  return (
    <section
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: 'linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 60%, rgba(249,115,22,0.04) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="pointer-events-none absolute -top-32 -right-32 w-80 h-80 rounded-full"
        style={{ background: `radial-gradient(circle, ${spec.tint}1f 0%, transparent 65%)` }}
      />

      <header className="relative px-5 pt-5 pb-3">
        <p className="mono-font text-[10px] uppercase tracking-[0.22em] text-slate-500">
          {spec.label}
        </p>
        <h2 className="landing-font text-white mt-1 text-xl font-semibold leading-tight">
          {spec.blurb}
        </h2>
      </header>

      {/* Metric chooser */}
      <div className="relative px-5 pb-3">
        <label className="mono-font text-[9px] uppercase tracking-[0.22em] text-slate-500 block mb-1.5">
          Metric
        </label>
        <div className="relative">
          <select
            value={metricKey}
            onChange={(e) => setMetricKey(e.target.value)}
            className="landing-font w-full appearance-none px-3.5 py-3 rounded-xl text-white text-sm focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {spec.metrics.map(m => (
              <option key={m.key} value={m.key} style={{ background: '#0c1222' }}>
                {m.label} ({m.unit})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Big value input — the focal point */}
      <div className="relative px-5 pb-4">
        <label className="mono-font text-[9px] uppercase tracking-[0.22em] text-slate-500 block mb-2">
          Value
        </label>
        <div
          className="relative rounded-2xl px-4 py-5 flex items-baseline gap-3"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: `1px solid ${spec.tint}40`,
            boxShadow: `0 0 0 3px ${spec.tint}10`,
          }}
        >
          <input
            ref={valueRef}
            type="number"
            step={metric.step ?? 0.01}
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={metric.min != null ? `${metric.min}–${metric.max}` : '0'}
            className="landing-font flex-1 min-w-0 bg-transparent text-white text-4xl font-semibold tabular-nums focus:outline-none placeholder-slate-700"
            style={{ letterSpacing: '-0.02em' }}
          />
          <span className="mono-font text-base text-slate-500 font-medium">{metric.unit}</span>
        </div>
      </div>

      {/* More toggle (date + notes) */}
      <div className="relative px-5 pb-3">
        <button
          type="button"
          onClick={() => setShowMore(s => !s)}
          className="mono-font text-[10px] uppercase tracking-[0.22em] text-slate-500 hover:text-orange-300 transition-colors flex items-center gap-1"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${showMore ? 'rotate-180' : ''}`} />
          {showMore ? 'Hide details' : `${isToday ? 'Today' : date} · add notes`}
        </button>

        {showMore && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="mono-font text-[9px] uppercase tracking-[0.22em] text-slate-500 block mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="landing-font w-full px-3.5 py-2.5 rounded-xl text-white text-sm focus:outline-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  colorScheme: 'dark',
                }}
              />
            </div>
            <div>
              <label className="mono-font text-[9px] uppercase tracking-[0.22em] text-slate-500 block mb-1.5">
                Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. fresh legs, indoor, 3rd attempt"
                className="landing-font w-full px-3.5 py-2.5 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Protocol — collapsed by default, only if exists */}
      {metric.protocol && (
        <details className="relative px-5 pb-3 group">
          <summary
            className="mono-font text-[10px] uppercase tracking-[0.22em] text-slate-500 cursor-pointer hover:text-orange-300 transition-colors flex items-center gap-1 list-none"
          >
            <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
            Protocol
          </summary>
          <p className="landing-font text-slate-400 text-xs leading-relaxed mt-2 pl-4 border-l border-slate-800">
            {metric.protocol}
          </p>
        </details>
      )}

      {err && (
        <div className="relative mx-5 mb-3 rounded-xl px-3 py-2.5 flex items-start gap-2"
          style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)' }}>
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <p className="landing-font text-rose-300 text-xs">{err}</p>
        </div>
      )}

      {/* Save CTA */}
      <div className="relative px-5 pb-5">
        <button
          onClick={handleSave}
          disabled={submitting || !value}
          className="landing-font w-full py-3.5 rounded-xl font-semibold text-slate-900 transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          style={{
            background: `linear-gradient(135deg, #ffffff 0%, ${ORANGE_LITE} 100%)`,
            boxShadow: `0 8px 24px ${ORANGE}33`,
          }}
        >
          {submitting ? 'Saving…' : 'Save metric'}
        </button>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TOAST — slides up from bottom on save
// ═══════════════════════════════════════════════════════════════════════
function ToastSlot({ toast }) {
  if (!toast) return null
  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      style={{ animation: 'toastSlideUp 0.4s ease-out' }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(12,18,34,0.95) 100%)',
          border: `1px solid ${ORANGE}55`,
          boxShadow: `0 10px 40px ${ORANGE}33, 0 0 0 1px rgba(255,255,255,0.05)`,
        }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, #ffffff 0%, ${ORANGE_LITE} 100%)` }}
        >
          <Check className="w-4 h-4 text-slate-900" strokeWidth={3} />
        </div>
        <div className="min-w-0">
          <p className="landing-font text-white text-sm font-semibold leading-tight">
            {toast.label}
          </p>
          <p className="mono-font text-[10px] uppercase tracking-[0.18em] text-orange-300 mt-0.5 tabular-nums">
            {toast.value} {toast.unit} · saved
          </p>
        </div>
      </div>
    </div>
  )
}

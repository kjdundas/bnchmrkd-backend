import { useMemo, useState, useEffect, useRef } from 'react'
import {
  Zap, Flame, Dumbbell, Activity, Heart, Target, Sparkles,
  TrendingUp, TrendingDown, ArrowRight, BookOpen, AlertTriangle, Trophy, ChevronRight
} from 'lucide-react'
import {
  performancePercentile, performanceZoneLabel, qualifierZones,
  buildDnaProfile, RADAR_AXES, disciplineFamily, findLimitingFactor,
  findMissingPriority, getDailyScienceCard, getCalibration,
  performancePosition, getReferenceTiers,
} from '../../lib/disciplineScience'
import { findRival, ageFromDob } from '../../lib/historicalRivals'

// Format a mark (time or distance) for display
const fmt = (v, higher) => {
  if (v == null) return '—'
  if (higher) return `${Number(v).toFixed(2)}m`
  return `${Number(v).toFixed(2)}s`
}

const AXIS_ICON = {
  acceleration: Zap,
  topSpeed: Zap,
  power: Flame,
  strength: Dumbbell,
  mobility: Activity,
  conditioning: Heart,
}

// ═══════════════════════════════════════════════════════════════════════
// SHARED BRAND PRIMITIVES
// ─────────────────────────────────────────────────────────────────────
// All home sections inherit the bnchmrkd. brand language used on the
// landing page and the coach dashboard: deep slate background, frosted
// white-on-white cards (rgba(255,255,255,0.02–04)), Instrument Sans for
// display copy, DM Mono for numerals, single signature orange accent
// (#f97316 → #fb923c), generous rounded-xl corners, atmospheric ambient
// orange glow inside the hero section.
// ═══════════════════════════════════════════════════════════════════════
const ORANGE = '#f97316'
const ORANGE_LITE = '#fb923c'

// AlmanacCard kept as-named for backward compat with existing call sites,
// but it now renders the brand-aligned card treatment.
function AlmanacCard({ number, kicker, title, accent = ORANGE, children, className = '' }) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Soft accent bloom in the top-right corner */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 rounded-full"
        style={{
          background: `radial-gradient(circle, ${accent}14 0%, transparent 65%)`,
        }}
      />

      <header className="relative px-5 pt-5 pb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="mono-font text-[10px] uppercase tracking-[0.18em] text-slate-500">
            {number ? <span className="text-slate-600">{number}&nbsp;·&nbsp;</span> : null}
            {kicker}
          </p>
          <h3 className="landing-font text-white leading-tight mt-1 text-[16px] font-semibold">
            {title}
          </h3>
        </div>
        <div
          className="flex-shrink-0 w-1.5 h-10 rounded-full"
          style={{ background: `linear-gradient(180deg, ${ORANGE}, ${ORANGE_LITE})` }}
        />
      </header>

      <div className="relative">{children}</div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// HOOKS — animated number count-up + persistent streak counter
// ═══════════════════════════════════════════════════════════════════════
function useCountUp(target, duration = 1400) {
  const [value, setValue] = useState(target)
  const prevTarget = useRef(target)
  useEffect(() => {
    if (target == null || !Number.isFinite(target)) return
    const start = prevTarget.current ?? target
    const startTime = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(start + (target - start) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else prevTarget.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

// Mount-time 0→1 progress (ease-out cubic). Use to animate things in on first render.
function useMountAnim(duration = 1100, delay = 0) {
  const [p, setP] = useState(0)
  useEffect(() => {
    let raf, startT
    const tick = (now) => {
      if (!startT) startT = now
      const elapsed = now - startT - delay
      if (elapsed < 0) { raf = requestAnimationFrame(tick); return }
      const t = Math.min(1, elapsed / duration)
      setP(1 - Math.pow(1 - t, 3))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [duration, delay])
  return p
}

// Streak counter — increments daily, allows 1 missed day per week as a freebie.
// Persisted in localStorage so it survives reloads. Returns { count, rolledOver }.
function useStreak(athleteId) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!athleteId) return
    const key = `bnchmrkd_streak_${athleteId}`
    try {
      const todayStr = new Date().toDateString()
      const raw = localStorage.getItem(key)
      let s = raw ? JSON.parse(raw) : null
      if (!s) {
        s = { count: 1, lastOpen: todayStr, freebiesUsedThisWeek: 0, weekStart: todayStr }
      } else if (s.lastOpen !== todayStr) {
        const last = new Date(s.lastOpen)
        const today = new Date(todayStr)
        const gap = Math.round((today - last) / 86400000)
        const weekStart = new Date(s.weekStart || s.lastOpen)
        if ((today - weekStart) / 86400000 >= 7) {
          s.weekStart = todayStr
          s.freebiesUsedThisWeek = 0
        }
        if (gap === 1) s.count += 1
        else if (gap === 2 && (s.freebiesUsedThisWeek || 0) < 1) {
          s.count += 1
          s.freebiesUsedThisWeek = (s.freebiesUsedThisWeek || 0) + 1
        } else s.count = 1
        s.lastOpen = todayStr
      }
      localStorage.setItem(key, JSON.stringify(s))
      setCount(s.count)
    } catch {
      setCount(0)
    }
  }, [athleteId])
  return count
}

// Linear-regression projection from race history.
// Returns { projection, slope, improving, sampleSize, daysAhead } or null.
function computeProjection(races, higher, daysAhead = 60) {
  if (!races || races.length < 3) return null
  const sorted = [...races]
    .filter(r => r.value != null && r.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  if (sorted.length < 3) return null
  const recent = sorted.slice(-8)
  const t0 = new Date(recent[0].date).getTime()
  const xs = recent.map(r => (new Date(r.date).getTime() - t0) / 86400000)
  const ys = recent.map(r => Number(r.value))
  const n = xs.length
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
  const sumXX = xs.reduce((a, x) => a + x * x, 0)
  const denom = n * sumXX - sumX * sumX
  if (Math.abs(denom) < 1e-9) return null
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  const latestX = xs[xs.length - 1]
  const projX = latestX + daysAhead
  const projY = slope * projX + intercept
  if (!Number.isFinite(projY)) return null
  const improving = higher ? slope > 0 : slope < 0
  return { projection: projY, slope, improving, sampleSize: n, daysAhead }
}

// ═══════════════════════════════════════════════════════════════════════
// TIER-UP CELEBRATION — fires when a new PB crosses a tier threshold.
// Tracks last-celebrated tier per athlete+discipline in localStorage so
// it never re-fires for the same tier. Uses an explicit ranking so we
// only celebrate upward movement, never sideways or down.
// ═══════════════════════════════════════════════════════════════════════
const TIER_RANK = {
  'Novice': 0, 'School': 1, 'Club': 2, 'National': 3,
  'Continental': 4, 'Olympic Final': 5, 'World Record': 6,
}

function tierKey(athleteId, discipline) {
  return `bnchmrkd:tier:${athleteId || 'anon'}:${(discipline || '').toLowerCase()}`
}

export function useTierTracker({ athleteId, pb, discipline, sex = 'M' }) {
  const [celebrating, setCelebrating] = useState(null) // { from, to, percent }

  useEffect(() => {
    if (pb == null || !discipline) return
    const pos = performancePosition(pb, discipline, sex)
    const tierLabel = pos?.nearestTier?.label
    if (!tierLabel) return
    const newRank = TIER_RANK[tierLabel] ?? -1
    if (newRank < 0) return

    const key = tierKey(athleteId, discipline)
    let stored = null
    try { stored = JSON.parse(localStorage.getItem(key) || 'null') } catch (e) {}
    const prevRank = stored?.rank ?? -1
    const prevLabel = stored?.label ?? null

    if (prevRank < 0) {
      // First visit — silently baseline, no celebration
      try { localStorage.setItem(key, JSON.stringify({ rank: newRank, label: tierLabel })) } catch (e) {}
      return
    }

    if (newRank > prevRank) {
      setCelebrating({ from: prevLabel, to: tierLabel, percent: pos.percent })
      try { localStorage.setItem(key, JSON.stringify({ rank: newRank, label: tierLabel })) } catch (e) {}
    }
  }, [athleteId, pb, discipline, sex])

  return { celebrating, dismiss: () => setCelebrating(null) }
}

// Lightweight confetti — pure CSS via inline styles, no deps
function Confetti({ count = 36 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => {
    const colors = [ORANGE, ORANGE_LITE, '#fef3c7', '#fbbf24', '#fb923c', '#ffffff']
    return {
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 1.6 + Math.random() * 1.4,
      drift: (Math.random() - 0.5) * 120,
      rot: Math.random() * 720 - 360,
      size: 6 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
    }
  }), [count])
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map(p => (
        <span
          key={p.id}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size, height: p.size * 0.4,
            background: p.color,
            borderRadius: 1,
            opacity: 0.95,
            transform: 'translateY(-20px)',
            animation: `confettiFall ${p.dur}s ${p.delay}s cubic-bezier(.3,.6,.4,1) forwards`,
            ['--drift']: `${p.drift}px`,
            ['--rot']: `${p.rot}deg`,
          }}
        />
      ))}
    </div>
  )
}

export function TierUpCelebration({ celebrating, onDismiss }) {
  if (!celebrating) return null
  const { from, to, percent } = celebrating
  const accent = (typeof window !== 'undefined' && {
    'Novice':        '#475569',
    'School':        '#64748b',
    'Club':          '#94a3b8',
    'National':      '#f59e0b',
    'Continental':   '#fb923c',
    'Olympic Final': '#f97316',
    'World Record':  '#fef3c7',
  }[to]) || ORANGE

  // Approximate population the athlete just leapfrogged
  const topPct = percent != null ? Math.max(0.5, Math.round(100 - percent)) : null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-6"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.98) 60%, #020617 100%)',
        backdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.4s ease-out',
      }}
    >
      <Confetti count={48} />

      {/* Ambient drifting orbs */}
      <div
        className="pointer-events-none absolute w-96 h-96 rounded-full"
        style={{
          background: `radial-gradient(circle, ${accent}55 0%, transparent 65%)`,
          animation: 'driftA 6s ease-in-out infinite',
          top: '20%', left: '15%',
        }}
      />
      <div
        className="pointer-events-none absolute w-80 h-80 rounded-full"
        style={{
          background: `radial-gradient(circle, ${ORANGE}33 0%, transparent 65%)`,
          animation: 'driftB 7s ease-in-out infinite',
          bottom: '15%', right: '12%',
        }}
      />

      {/* Card */}
      <div
        className="relative max-w-sm w-full rounded-3xl overflow-hidden text-center px-7 py-9"
        style={{
          background: 'linear-gradient(170deg, rgba(15,23,42,0.95) 0%, rgba(12,18,34,0.92) 100%)',
          border: `1px solid ${accent}55`,
          boxShadow: `0 20px 80px ${accent}33, 0 0 0 1px rgba(255,255,255,0.04)`,
          animation: 'tierPop 0.7s cubic-bezier(.2,.9,.3,1.4)',
        }}
      >
        <p className="mono-font text-[10px] uppercase tracking-[0.3em] text-orange-300 mb-3">
          New tier unlocked
        </p>

        {/* Tier badge */}
        <div
          className="relative mx-auto mb-5 flex items-center justify-center rounded-full"
          style={{
            width: 130, height: 130,
            background: `radial-gradient(circle at 30% 25%, #ffffff 0%, ${accent} 60%, ${accent}88 100%)`,
            boxShadow: `0 0 60px ${accent}aa, 0 0 0 2px ${accent}, 0 0 0 8px ${accent}22`,
            animation: 'badgeShimmer 3s ease-in-out infinite',
          }}
        >
          <span
            className="landing-font font-bold text-slate-900"
            style={{ fontSize: 38, letterSpacing: '-0.02em' }}
          >
            {to.split(' ').map(w => w[0]).join('')}
          </span>
        </div>

        <h2 className="landing-font text-white text-3xl font-semibold leading-tight mb-1">
          {to}
        </h2>
        {from && (
          <p className="mono-font text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-4">
            up from {from}
          </p>
        )}

        {topPct != null && (
          <p className="landing-font text-slate-300 text-sm leading-relaxed mb-6">
            You&apos;ve joined the top{' '}
            <span className="text-white font-semibold">{topPct}%</span> of athletes
            in this discipline.
          </p>
        )}

        <button
          type="button"
          onClick={onDismiss}
          className="landing-font w-full py-3 rounded-xl font-semibold text-slate-900 transition-transform active:scale-[0.98]"
          style={{
            background: `linear-gradient(135deg, #ffffff 0%, ${ORANGE_LITE} 100%)`,
            boxShadow: `0 8px 24px ${ORANGE}55`,
          }}
        >
          Keep climbing
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 0. TRAJECTORY HERO — the daily-refreshing reason to come back
// ─────────────────────────────────────────────────────────────────────
// Streak counter (loss aversion) + projected PB (future self) + tier-
// trending arrow (compound identity). This is the card that updates
// even on days where nothing was logged.
// ═══════════════════════════════════════════════════════════════════════
export function TrajectoryHero({ athleteId, races, pb, discipline, sex = 'M' }) {
  const streak = useStreak(athleteId)
  const cal = getCalibration(discipline, sex)
  const higher = !!cal.higher
  const position = useMemo(
    () => performancePosition(pb, discipline, sex),
    [pb, discipline, sex]
  )
  const proj = useMemo(() => computeProjection(races, higher), [races, higher])

  // Animated count-up for the projected number
  const target = proj?.projection ?? pb ?? 0
  const animated = useCountUp(target, 1400)

  // Format helpers
  const fmtMark = (v) => {
    if (v == null || !Number.isFinite(v)) return '—'
    return higher ? `${Number(v).toFixed(2)}m` : `${Number(v).toFixed(2)}s`
  }

  // Tier headline
  const currentTier = position?.nearestTier?.label
  const nextTier = position?.nextTier?.label
  const trendingUp = proj?.improving === true
  const trendingDown = proj?.improving === false

  // Delta from current PB to projection
  const delta = proj && pb != null ? proj.projection - Number(pb) : null
  // Neutral band: projection within ±0.01 of PB is "on pace", not up or down.
  // This prevents "+0.00s" rendering in red alongside an "accelerating" headline.
  const deltaIsNeutral = delta != null && Math.abs(delta) < 0.01
  const improvedDelta = delta != null && !deltaIsNeutral && (higher ? delta > 0 : delta < 0)

  return (
    <section
      className="relative overflow-hidden rounded-2xl"
      style={{
        background:
          'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(2,6,23,0.4) 45%, rgba(59,130,246,0.06) 100%)',
        border: '1px solid rgba(249,115,22,0.25)',
        boxShadow: '0 20px 60px -20px rgba(249,115,22,0.35)',
      }}
    >
      {/* Drifting ambient orbs */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 w-80 h-80 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(249,115,22,0.25) 0%, transparent 65%)',
          animation: 'driftA 14s ease-in-out infinite',
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 w-80 h-80 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(251,146,60,0.18) 0%, transparent 65%)',
          animation: 'driftB 18s ease-in-out infinite',
        }}
      />
      {/* Subtle scanning shimmer */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 6s linear infinite',
        }}
      />

      {/* Header — kicker + streak chip */}
      <header className="relative px-5 pt-5 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mono-font text-[10px] uppercase tracking-[0.22em] text-orange-300">
            Your trajectory
          </p>
          <h2 className="landing-font text-white mt-1 text-xl font-semibold leading-tight">
            {deltaIsNeutral ? 'Holding pattern' : trendingUp ? 'You are accelerating' : trendingDown ? 'Your form is dipping' : 'Holding pattern'}
          </h2>
        </div>

        {/* Streak chip — pulsing flame */}
        {streak > 0 && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0"
            style={{
              background: 'rgba(249,115,22,0.15)',
              border: '1px solid rgba(249,115,22,0.4)',
            }}
          >
            <Flame
              className="w-3.5 h-3.5 text-orange-300"
              style={{ animation: 'flameFlicker 1.6s ease-in-out infinite' }}
            />
            <span className="mono-font text-[11px] tabular-nums text-orange-200 font-semibold">
              {streak}
            </span>
            <span className="mono-font text-[9px] uppercase tracking-[0.18em] text-orange-300/70">
              day{streak === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </header>

      {/* Big projection number */}
      <div className="relative px-5 pt-4 pb-2 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mono-font text-[9px] uppercase tracking-[0.22em] text-slate-500">
            Projected · 60 days
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <p
              className="landing-font tabular-nums leading-none"
              style={{
                fontSize: '3rem',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                background: trendingUp
                  ? 'linear-gradient(180deg, #ffffff 0%, #fb923c 100%)'
                  : trendingDown
                  ? 'linear-gradient(180deg, #ffffff 0%, #94a3b8 100%)'
                  : 'linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {proj ? animated.toFixed(2) : pb != null ? Number(pb).toFixed(2) : '—'}
            </p>
            <span className="mono-font text-sm text-slate-500">{higher ? 'm' : 's'}</span>
          </div>
          {delta != null && proj && (
            deltaIsNeutral ? (
              <div className="flex items-center gap-1 mt-2 mono-font text-[11px] tabular-nums text-slate-400">
                <span className="font-semibold">On pace with PB</span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1 mt-2 mono-font text-[11px] tabular-nums"
                style={{ color: improvedDelta ? '#34d399' : '#fb7185' }}
              >
                {improvedDelta ? (
                  <TrendingUp className="w-3.5 h-3.5" strokeWidth={2.5} />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" strokeWidth={2.5} />
                )}
                <span className="font-semibold">
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(2)}
                  {higher ? 'm' : 's'}
                </span>
                <span className="text-slate-500 ml-1">from current PB</span>
              </div>
            )
          )}
          {!proj && (
            <p className="mono-font text-[10px] uppercase tracking-[0.18em] text-slate-500 mt-2">
              log 3+ results to unlock projection
            </p>
          )}
        </div>

        {/* Right-side mini stack: current PB + tier */}
        <div className="text-right flex-shrink-0">
          <p className="mono-font text-[9px] uppercase tracking-[0.22em] text-slate-500">
            Current PB
          </p>
          <p className="landing-font text-white tabular-nums text-lg font-semibold mt-0.5">
            {fmtMark(pb)}
          </p>
          {currentTier && (
            <div className="mt-2">
              <p className="mono-font text-[9px] uppercase tracking-[0.18em] text-slate-500">
                Tier
              </p>
              <p className="landing-font text-orange-300 text-[13px] font-semibold mt-0.5">
                {currentTier}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer — next milestone reminder */}
      {nextTier && nextTier !== currentTier && (
        <footer
          className="relative mt-3 px-5 py-3 flex items-center gap-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Target className="w-3.5 h-3.5 text-orange-300 flex-shrink-0" />
          <p className="landing-font text-slate-300 text-[12px] flex-1 truncate">
            On pace for{' '}
            <span className="text-white font-semibold">{nextTier}</span>
            {trendingUp && (
              <span className="text-emerald-400 ml-1.5 mono-font text-[10px]">▲ accelerating</span>
            )}
            {trendingDown && (
              <span className="text-rose-400 ml-1.5 mono-font text-[10px]">▼ slowing</span>
            )}
          </p>
        </footer>
      )}
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 0b. HISTORICAL RIVAL CARD — your pacer through history
// ─────────────────────────────────────────────────────────────────────
// Pairs the athlete with a real Olympian and shows whether they're
// ahead of or behind that legend's curve at the same age. The most
// ego-feeding card on the page — a face on the ladder.
// ═══════════════════════════════════════════════════════════════════════
export function RivalCard({ pb, discipline, sex = 'M', dob }) {
  const cal = getCalibration(discipline, sex)
  const higher = !!cal.higher
  const athleteAge = useMemo(() => ageFromDob(dob), [dob])
  const rival = useMemo(
    () => findRival(discipline, sex, athleteAge, pb, higher),
    [discipline, sex, athleteAge, pb, higher]
  )

  // Animated values
  const animatedDiff = useCountUp(rival ? Math.abs(rival.diff) : 0, 1200)

  if (!rival || pb == null) return null

  const fmt = (v) => (higher ? `${Number(v).toFixed(2)}m` : `${Number(v).toFixed(2)}s`)
  const unit = higher ? 'm' : 's'

  // Bar mechanic — show two horizontal markers, athlete vs rival
  // Use a small range around the two values so the difference is visible
  const minV = Math.min(pb, rival.mark)
  const maxV = Math.max(pb, rival.mark)
  const span = Math.max(maxV - minV, higher ? 0.5 : 0.3) * 2.2
  const mid = (minV + maxV) / 2
  const lo = mid - span / 2
  const hi = mid + span / 2
  const pctOf = (v) => Math.max(4, Math.min(96, ((v - lo) / (hi - lo)) * 100))
  const athletePct = pctOf(pb)
  const rivalPct = pctOf(rival.mark)

  const ageLabel = athleteAge != null && rival.age != null
    ? rival.age === athleteAge
      ? `at age ${athleteAge}`
      : athleteAge < rival.age
      ? `${rival.age - athleteAge} year${rival.age - athleteAge === 1 ? '' : 's'} younger than they were`
      : `${athleteAge - rival.age} year${athleteAge - rival.age === 1 ? '' : 's'} older than they were`
    : rival.age != null
    ? `at age ${rival.age}`
    : ''

  return (
    <section
      className="relative overflow-hidden rounded-2xl"
      style={{
        background:
          'linear-gradient(135deg, rgba(124,58,237,0.10) 0%, rgba(2,6,23,0.4) 50%, rgba(249,115,22,0.08) 100%)',
        border: '1px solid rgba(167,139,250,0.25)',
      }}
    >
      {/* Drifting purple/orange orbs */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 w-64 h-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 65%)',
          animation: 'driftA 16s ease-in-out infinite',
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 w-64 h-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(249,115,22,0.14) 0%, transparent 65%)',
          animation: 'driftB 20s ease-in-out infinite',
        }}
      />

      <header className="relative px-5 pt-5 pb-2">
        <p className="mono-font text-[10px] uppercase tracking-[0.22em]" style={{ color: '#c4b5fd' }}>
          Your pacer
        </p>
        <div className="flex items-baseline justify-between gap-3 mt-1">
          <h3 className="landing-font text-white text-xl font-semibold leading-tight truncate">
            {rival.name}
          </h3>
          <span className="mono-font text-[10px] uppercase tracking-[0.22em] text-slate-500 flex-shrink-0">
            {rival.country}
          </span>
        </div>
        {rival.note && (
          <p className="mono-font text-[9px] uppercase tracking-[0.18em] text-slate-500 mt-0.5">
            {rival.note}
          </p>
        )}
      </header>

      {/* Headline diff */}
      <div className="relative px-5 pt-3 pb-2">
        <p className="landing-font text-slate-300 text-sm leading-snug">
          {rival.name.split(' ').slice(-1)[0]}&apos;s breakthrough at age{' '}
          <span className="text-white font-semibold">{rival.age}</span>:{' '}
          <span className="text-white font-semibold tabular-nums">{fmt(rival.mark)}</span>.
        </p>
        <p
          className="landing-font mt-2 text-base font-semibold"
          style={{ color: rival.ahead ? '#34d399' : '#fb7185' }}
        >
          Your PB is{' '}
          <span className="tabular-nums">
            {animatedDiff.toFixed(2)}
            {unit}
          </span>{' '}
          {rival.ahead ? (higher ? 'beyond' : 'faster than') : (higher ? 'short of' : 'off')} that benchmark
        </p>
      </div>

      {/* Comparison bar */}
      <div className="relative px-5 pt-6 pb-8">
        <div className="relative h-[3px] w-full rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
          {/* Connector segment between the two markers */}
          <div
            className="absolute inset-y-0 rounded-full"
            style={{
              left: `${Math.min(athletePct, rivalPct)}%`,
              width: `${Math.abs(athletePct - rivalPct)}%`,
              background: rival.ahead
                ? 'linear-gradient(90deg, #34d399, #fb923c)'
                : 'linear-gradient(90deg, #fb7185, #a78bfa)',
              boxShadow: '0 0 10px rgba(251,146,60,0.5)',
            }}
          />

          {/* Rival marker */}
          <div
            className="absolute top-1/2"
            style={{ left: `${rivalPct}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: '#a78bfa',
                border: '2px solid #1e293b',
                boxShadow: '0 0 10px #a78bfa88',
              }}
            />
            <div className="absolute left-1/2 -translate-x-1/2 top-4 whitespace-nowrap text-center">
              <p className="mono-font text-[8px] uppercase tracking-[0.18em] text-slate-500">rival</p>
              <p className="mono-font text-[10px] tabular-nums text-violet-300 mt-0.5">{fmt(rival.mark)}</p>
            </div>
          </div>

          {/* Athlete marker */}
          <div
            className="absolute top-1/2"
            style={{ left: `${athletePct}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div
              className="w-4 h-4 rounded-full"
              style={{
                background: `linear-gradient(135deg, #ffffff, ${ORANGE_LITE})`,
                border: `2px solid ${ORANGE}`,
                boxShadow: `0 0 0 3px rgba(2,6,23,0.9), 0 0 16px ${ORANGE}, 0 0 32px ${ORANGE}66`,
              }}
            />
            <div className="absolute left-1/2 -translate-x-1/2 -top-9 whitespace-nowrap text-center">
              <p className="mono-font text-[8px] uppercase tracking-[0.18em] text-orange-300">you</p>
              <p className="mono-font text-[10px] tabular-nums text-white mt-0.5">{fmt(pb)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 1. WHERE YOU STAND — the Continuum
// ─────────────────────────────────────────────────────────────────────
// A horizontal continuum running from the most achievable benchmark
// (Novice) on the left to the absolute ceiling (World Record) on the
// right. Tier waypoints (Club / National / Continental / Olympic Final)
// are scattered along the way with their real-world tags (local,
// national, regional, international, world). The athlete's PB rides
// the rail as a glowing orange marker.
// ═══════════════════════════════════════════════════════════════════════
const TIER_ACCENT = {
  'Novice':        { swatch: '#475569', tag: 'starter' },
  'School':        { swatch: '#64748b', tag: 'developing' },
  'Club':          { swatch: '#94a3b8', tag: 'local' },
  'National':      { swatch: '#f59e0b', tag: 'national' },
  'Continental':   { swatch: '#fb923c', tag: 'regional' },
  'Olympic Final': { swatch: '#f97316', tag: 'international' },
  'World Record':  { swatch: '#fef3c7', tag: 'world' },
}

export function WhereYouStand({ pb, discipline, sex = 'M' }) {
  const position = useMemo(
    () => performancePosition(pb, discipline, sex),
    [pb, discipline, sex]
  )
  const cal = getCalibration(discipline, sex)
  const higher = !!cal.higher
  const slide = useMountAnim(1500, 200)

  if (pb == null || !position || position.percent == null) {
    const tiers = getReferenceTiers(discipline, sex)
    return (
      <AlmanacCard kicker="The Continuum" title="Where you stand">
        <div className="px-5 pb-5">
          <p className="landing-font text-slate-300 text-sm leading-relaxed">
            Log a result to place yourself on the ladder — from{' '}
            <span className="text-slate-200">{tiers[0]?.label || 'novice'}</span> all the way to{' '}
            <span className="text-orange-300">{tiers[tiers.length - 1]?.label || 'world record'}</span>.
          </p>
        </div>
      </AlmanacCard>
    )
  }

  const { percent, tiers, nearestTier, nextTier } = position
  const formattedPb = higher ? `${Number(pb).toFixed(2)} m` : `${Number(pb).toFixed(2)} s`
  const formatTierVal = (v) => (higher ? `${Number(v).toFixed(2)}m` : `${Number(v).toFixed(2)}s`)
  const labelRow = (i) => (i % 2 === 0 ? 'above' : 'below')
  const gap =
    nextTier && nextTier !== nearestTier
      ? higher
        ? nextTier.value - pb
        : pb - nextTier.value
      : null

  return (
    <section
      className="relative overflow-hidden rounded-2xl"
      style={{
        background:
          'linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 60%, rgba(249,115,22,0.04) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Ambient orange glow — atmospheric, anchors the eye to the right side */}
      <div
        className="pointer-events-none absolute -top-32 -right-32 w-80 h-80 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 65%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 65%)' }}
      />

      {/* Header — kicker + PB */}
      <header className="relative px-5 pt-5 pb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mono-font text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Where you stand
          </p>
          <h2 className="landing-font text-white mt-1 text-2xl font-semibold leading-tight">
            The continuum
          </h2>
          <p className="mono-font text-[10px] uppercase tracking-[0.18em] text-slate-500 mt-1">
            {discipline}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="mono-font text-[9px] uppercase tracking-[0.22em] text-slate-500">
            Personal best
          </p>
          <p
            className="landing-font tabular-nums leading-none mt-1"
            style={{
              fontSize: '2.25rem',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              background: `linear-gradient(180deg, #ffffff 0%, ${ORANGE_LITE} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {formattedPb}
          </p>
        </div>
      </header>

      {/* The continuum rail — inset so the end labels (Novice / World Record) don't clip */}
      <div className="relative px-14 pt-14 pb-16">
        {/* Base rail */}
        <div
          className="relative h-[3px] w-full rounded-full"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        >
          {/* Filled progress */}
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${percent * slide}%`,
              background: `linear-gradient(90deg, ${ORANGE} 0%, ${ORANGE_LITE} 100%)`,
              boxShadow: `0 0 12px ${ORANGE}88, 0 0 24px ${ORANGE}44`,
            }}
          />

          {/* Tier waypoints */}
          {tiers.map((t, i) => {
            const accent = TIER_ACCENT[t.label] || { swatch: '#94a3b8', tag: '' }
            const above = labelRow(i) === 'above'
            const reached = percent >= t.percent
            return (
              <div
                key={t.label}
                className="absolute top-1/2"
                style={{ left: `${t.percent}%`, transform: 'translate(-50%, -50%)' }}
              >
                {/* Tier dot */}
                <div
                  className="rounded-full"
                  style={{
                    width: 10,
                    height: 10,
                    background: reached ? accent.swatch : '#1e293b',
                    border: `1.5px solid ${reached ? accent.swatch : '#334155'}`,
                    boxShadow: reached ? `0 0 10px ${accent.swatch}88` : 'none',
                  }}
                />
                {/* Label block */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-center"
                  style={{ top: above ? -56 : 18 }}
                >
                  <p
                    className="mono-font text-[8px] uppercase tracking-[0.2em]"
                    style={{ color: reached ? accent.swatch : '#475569' }}
                  >
                    {accent.tag}
                  </p>
                  <p
                    className={`landing-font text-[11px] font-medium leading-tight mt-0.5 ${
                      reached ? 'text-white' : 'text-slate-500'
                    }`}
                  >
                    {t.label}
                  </p>
                  <p
                    className="mono-font text-[9px] tabular-nums mt-0.5"
                    style={{ color: reached ? '#cbd5e1' : '#475569' }}
                  >
                    {formatTierVal(t.value)}
                  </p>
                </div>
              </div>
            )
          })}

          {/* Athlete marker */}
          <div
            className="absolute top-1/2"
            style={{ left: `${percent * slide}%`, transform: 'translate(-50%, -50%)' }}
          >
            {/* Pulsing glow */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                width: 48,
                height: 48,
                background: `radial-gradient(circle, ${ORANGE}66 0%, transparent 65%)`,
                animation: 'pulse 2.4s ease-in-out infinite',
              }}
            />
            {/* Core marker */}
            <div
              className="relative rounded-full"
              style={{
                width: 18,
                height: 18,
                background: `linear-gradient(135deg, #ffffff 0%, ${ORANGE_LITE} 100%)`,
                border: `2px solid ${ORANGE}`,
                boxShadow: `0 0 0 4px rgba(2,6,23,0.9), 0 0 24px ${ORANGE}, 0 0 48px ${ORANGE}66`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Footer dispatch */}
      <footer
        className="relative px-5 py-4 flex items-start gap-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div
          className="flex-shrink-0 w-1 h-10 rounded-full mt-0.5"
          style={{ background: `linear-gradient(180deg, ${ORANGE}, ${ORANGE_LITE})` }}
        />
        <div className="flex-1 min-w-0">
          <p className="mono-font text-[9px] uppercase tracking-[0.22em] text-slate-500 mb-1">
            Next milestone
          </p>
          <p className="landing-font text-slate-200 text-sm leading-snug">
            You&apos;ve cleared{' '}
            <span className="text-white font-semibold">
              {nearestTier?.label || 'the opening tier'}
            </span>
            {nextTier && nextTier !== nearestTier && gap != null && (
              <>
                . Next up —{' '}
                <span className="text-orange-300 font-semibold">{nextTier.label}</span>{' '}
                <span className="mono-font text-slate-400 text-[11px] tabular-nums ml-1">
                  ({higher ? '+' : '−'}
                  {Math.abs(gap).toFixed(2)}
                  {higher ? 'm' : 's'})
                </span>
              </>
            )}
            .
          </p>
        </div>
      </footer>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 2. ATHLETE DNA RADAR
// ═══════════════════════════════════════════════════════════════════════
export function DnaRadar({ metrics, discipline }) {
  const profile = useMemo(() => buildDnaProfile(metrics || []), [metrics])
  const grow = useMountAnim(1300, 150)

  // Hex geometry — viewBox padded so axis labels at scale 1.22 don't clip
  const W = 360, H = 320, cx = W / 2, cy = H / 2, R = 108
  const axes = RADAR_AXES
  const angleFor = (i) => -Math.PI / 2 + i * ((2 * Math.PI) / axes.length)
  const pt = (i, scale) => ({
    x: cx + Math.cos(angleFor(i)) * R * scale,
    y: cy + Math.sin(angleFor(i)) * R * scale,
  })

  // Finalist envelope at 85
  const finalistPoints = axes.map((_, i) => pt(i, 0.85))
  const finalistPath = finalistPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'

  // Athlete polygon (where score available) — scaled by mount progress so it grows in
  const athletePoints = axes.map((a, i) => {
    const s = profile[a.key]?.score
    if (s == null) return null
    return { i, ...pt(i, (s / 100) * grow) }
  }).filter(Boolean)

  const athletePath = athletePoints.length >= 3
    ? athletePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
    : null

  const measuredCount = axes.filter(a => profile[a.key]?.score != null).length

  return (
    <AlmanacCard kicker="The Profile" title="Athlete DNA">
      <div className="px-5 pt-2 pb-2 flex items-center justify-between">
        <p className="mono-font text-[9px] uppercase tracking-[0.18em] text-slate-500">
          {measuredCount}/{axes.length} axes measured
        </p>
        <p className="mono-font text-[9px] uppercase tracking-[0.18em] text-slate-500">
          you · vs · finalist
        </p>
      </div>

      <div className="flex justify-center px-3 pb-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xs">
          <defs>
            <radialGradient id="dnaFill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ORANGE} stopOpacity="0.35" />
              <stop offset="100%" stopColor={ORANGE} stopOpacity="0.05" />
            </radialGradient>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((s, i) => {
            const pts = axes.map((_, idx) => pt(idx, s))
            const d = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
            return (
              <path key={i} d={d} fill="none"
                stroke="rgba(255,255,255,0.08)" strokeWidth="0.75"
                strokeDasharray={i === 3 ? '0' : '2 3'} />
            )
          })}
          {axes.map((_, i) => {
            const p = pt(i, 1)
            return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.08)" strokeWidth="0.75" />
          })}

          <path d={finalistPath} fill="none" stroke="#94a3b8" strokeWidth="1.25" strokeDasharray="3 4" opacity="0.6" />

          {athletePath && (
            <path d={athletePath} fill="url(#dnaFill)" stroke={ORANGE} strokeWidth="1.75" />
          )}
          {athletePoints.map((p) => (
            <circle key={p.i} cx={p.x} cy={p.y} r="3.2"
              fill={ORANGE} stroke="#ffffff" strokeWidth="1.25" />
          ))}

          {axes.map((a, i) => {
            const p = pt(i, 1.22)
            const score = profile[a.key]?.score
            const hasData = score != null
            return (
              <g key={a.key}>
                <text
                  x={p.x} y={p.y}
                  fill={hasData ? '#e2e8f0' : '#475569'}
                  fontSize="9"
                  fontFamily="DM Mono, monospace"
                  letterSpacing="1.2"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ textTransform: 'uppercase' }}
                >
                  {a.label}
                </text>
                <text
                  x={p.x} y={p.y + 13}
                  fill={hasData ? ORANGE_LITE : '#334155'}
                  fontSize="12"
                  fontFamily="Instrument Sans, sans-serif"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {hasData ? Math.round(score * grow) : '—'}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="px-5 py-3 flex items-center justify-center gap-6 mono-font text-[9px] uppercase tracking-[0.18em]"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="flex items-center gap-2 text-slate-300">
          <span className="w-4 h-[2px]" style={{ background: ORANGE }} /> you
        </span>
        <span className="flex items-center gap-2 text-slate-500">
          <span className="w-4 h-[2px]" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#94a3b8 0 2px,transparent 2px 5px)' }} /> finalist
        </span>
      </div>
    </AlmanacCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 3. LIMITING FACTOR CARD
// ═══════════════════════════════════════════════════════════════════════
export function LimitingFactorCard({ metrics, pb, discipline, sex = 'M' }) {
  const profile = useMemo(() => buildDnaProfile(metrics || []), [metrics])
  const perf = useMemo(
    () => performancePercentile(pb, discipline, sex) ?? 50,
    [pb, discipline, sex]
  )
  const limiter = useMemo(
    () => findLimitingFactor(profile, discipline, perf),
    [profile, discipline, perf]
  )
  const missing = useMemo(
    () => findMissingPriority(profile, discipline),
    [profile, discipline]
  )
  const family = disciplineFamily(discipline)

  // No metrics logged at all → bait to log
  if (!metrics || metrics.length === 0) {
    const axisLabel = missing?.axisLabel || 'Power'
    return (
      <AlmanacCard kicker="The Limiter" title={`Log your first ${axisLabel.toLowerCase()} metric`}>
        <div className="px-5 py-4">
          <p className="landing-font text-slate-300 text-sm leading-snug">
            <span className="text-orange-300 font-semibold">{axisLabel}</span> is the strongest physical
            predictor for your event. Log a CMJ or equivalent to reveal the single biggest gap holding
            back your PB.
          </p>
        </div>
      </AlmanacCard>
    )
  }

  if (!limiter) {
    return (
      <AlmanacCard kicker="The Limiter" title="Your physicals match your PB">
        <div className="px-5 py-4 flex items-start gap-3">
          <Trophy className="w-4 h-4 text-orange-300 flex-shrink-0 mt-0.5" />
          <p className="landing-font text-slate-300 text-sm leading-snug">
            Every measured axis sits at or above the expected envelope for athletes at your level. Keep
            logging to refine the picture.
          </p>
        </div>
      </AlmanacCard>
    )
  }

  const gapPct = limiter.expectedValue
    ? Math.abs((limiter.gap / limiter.expectedValue) * 100).toFixed(0)
    : null
  const sprintLike = family === 'sprint' || family === 'longSprint' || family === 'hurdles'

  return (
    <AlmanacCard kicker="The Limiter" title={limiter.metricLabel}>
      <div className="px-5 pt-2 pb-2">
        <div className="flex items-stretch gap-3">
          <div className="flex-1">
            <p className="mono-font text-[9px] uppercase tracking-[0.18em] text-slate-500">your value</p>
            <p className="landing-font text-white leading-none mt-1 tabular-nums text-2xl font-semibold">
              {Number(limiter.currentValue).toFixed(2)}
              <span className="mono-font text-[10px] text-slate-500 ml-1.5">{limiter.unit}</span>
            </p>
          </div>
          <div className="flex flex-col items-center justify-center text-slate-600">
            <span className="mono-font text-[18px] leading-none">→</span>
          </div>
          <div className="flex-1 text-right">
            <p className="mono-font text-[9px] uppercase tracking-[0.18em] text-slate-500">expected</p>
            <p className="landing-font text-orange-300 leading-none mt-1 tabular-nums text-2xl font-semibold">
              {Number(limiter.expectedValue).toFixed(2)}
              <span className="mono-font text-[10px] text-slate-500 ml-1.5">{limiter.unit}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-3 pb-4 mt-3 flex items-start gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: `linear-gradient(180deg, ${ORANGE}, ${ORANGE_LITE})` }} />
        <p className="landing-font text-slate-300 text-[13px] leading-snug flex-1">
          {sprintLike && limiter.estImpactSec > 0 ? (
            <>
              Closing this gap is associated with roughly{' '}
              <span className="text-orange-300 mono-font tabular-nums">
                −{limiter.estImpactSec.toFixed(2)}s
              </span>{' '}
              on your {discipline} — per published sprint-research correlations.
            </>
          ) : gapPct ? (
            <>
              You sit{' '}
              <span className="text-orange-300 mono-font tabular-nums">{gapPct}%</span>{' '}
              below the typical {limiter.axisLabel.toLowerCase()} level for your PB. This axis is the
              one most likely to unlock distance.
            </>
          ) : (
            <>The gap on this axis is the largest in your profile right now.</>
          )}
        </p>
      </div>
    </AlmanacCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 4. SCIENCE SPOTLIGHT (rotating daily)
// ═══════════════════════════════════════════════════════════════════════
export function ScienceSpotlight({ discipline }) {
  const card = useMemo(() => getDailyScienceCard(discipline), [discipline])
  const [expanded, setExpanded] = useState(false)

  if (!card) return null
  return (
    <AlmanacCard kicker={`Field note · ${card.metric}`} title={card.title}>
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left">
        <div className="px-5 py-4 flex items-start gap-3">
          <BookOpen className="w-4 h-4 text-orange-300 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {expanded ? (
              <>
                <p className="landing-font text-slate-300 text-sm leading-relaxed">
                  {card.body}
                </p>
                <p className="mono-font text-[10px] uppercase tracking-[0.18em] mt-3 text-orange-300">
                  → {card.target}
                </p>
              </>
            ) : (
              <p className="mono-font text-[10px] uppercase tracking-[0.18em] text-slate-500">
                tap to read the field note
              </p>
            )}
          </div>
          <ChevronRight className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>
    </AlmanacCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 5. SINCE-LAST-VISIT BANNER
// ═══════════════════════════════════════════════════════════════════════
// Small celebratory banner summarising what's new since the athlete last
// opened the app. Uses localStorage to track the last-seen timestamp.
export function SinceLastVisit({ athleteId, metrics, races, pb, discipline }) {
  const LS_KEY = `bnchmrkd_last_visit_${athleteId || 'anon'}`
  const lastVisit = useMemo(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? new Date(raw) : null
    } catch { return null }
  }, [LS_KEY])

  // Update the timestamp once when component mounts
  useMemo(() => {
    try { localStorage.setItem(LS_KEY, new Date().toISOString()) } catch {}
  }, [LS_KEY])

  if (!lastVisit) return null

  // Count what's new since lastVisit
  const newMetrics = (metrics || []).filter(m => new Date(m.created_at || m.recorded_at) > lastVisit)
  const newRaces = (races || []).filter(r => r.date && new Date(r.date) > lastVisit)

  if (newMetrics.length === 0 && newRaces.length === 0) return null

  // Were any of them PBs? (only races — metrics PBs are computed elsewhere)
  const newPbs = newRaces.filter(r => r.value === pb).length

  const hoursAgo = Math.round((Date.now() - lastVisit.getTime()) / 3600000)
  const whenLabel = hoursAgo < 24
    ? `${hoursAgo}h ago`
    : `${Math.round(hoursAgo / 24)}d ago`

  return (
    <section
      className="relative overflow-hidden rounded-2xl flex items-stretch"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="w-1" style={{ background: `linear-gradient(180deg, ${ORANGE}, ${ORANGE_LITE})` }} />
      <div className="flex-1 px-4 py-3 flex items-center gap-3">
        <TrendingUp className="w-3.5 h-3.5 text-orange-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="mono-font text-[9px] uppercase tracking-[0.22em] text-slate-500">
            Since last visit · {whenLabel}
          </p>
          <p className="landing-font text-slate-200 text-[12px] truncate">
            {newPbs > 0 && (
              <span className="text-orange-300 font-semibold">
                {newPbs} new PB{newPbs > 1 ? 's' : ''}
                {(newRaces.length > 0 || newMetrics.length > 0) && ' · '}
              </span>
            )}
            {newRaces.length > 0 && (
              <span className="text-slate-300">{newRaces.length} result{newRaces.length > 1 ? 's' : ''}</span>
            )}
            {newRaces.length > 0 && newMetrics.length > 0 && <span className="text-slate-600"> · </span>}
            {newMetrics.length > 0 && (
              <span className="text-slate-300">{newMetrics.length} metric{newMetrics.length > 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// 6. WEEKLY RECAP — Friday share card
// ─────────────────────────────────────────────────────────────────────
// Auto-shows Fri-Sun. Summarizes the past 7 days: PB delta, sessions
// logged, top metric improvement, current tier. Includes a Share button
// that exports a 1080x1350 portrait PNG ready for IG stories.
// ═══════════════════════════════════════════════════════════════════════
function computeWeeklyRecap({ races, metrics, pb, discipline, sex, higher }) {
  const now = Date.now()
  const WEEK = 7 * 24 * 60 * 60 * 1000
  const cutoffThis = now - WEEK
  const cutoffPrev = now - 2 * WEEK

  const racesArr = Array.isArray(races) ? races : []
  const metricsArr = Array.isArray(metrics) ? metrics : []

  const thisWeekRaces = racesArr.filter(r => {
    const t = new Date(r.date || r.recorded_at || r.race_date).getTime()
    return Number.isFinite(t) && t >= cutoffThis
  })
  const thisWeekMetrics = metricsArr.filter(m => {
    const t = new Date(m.recorded_at || m.date).getTime()
    return Number.isFinite(t) && t >= cutoffThis
  })

  // PB delta — best result this week vs best ever before this week
  const beforeBest = (() => {
    const earlier = racesArr.filter(r => {
      const t = new Date(r.date || r.recorded_at || r.race_date).getTime()
      return Number.isFinite(t) && t < cutoffThis
    })
    if (!earlier.length) return null
    const vals = earlier.map(r => Number(r.result ?? r.mark ?? r.value)).filter(Number.isFinite)
    if (!vals.length) return null
    return higher ? Math.max(...vals) : Math.min(...vals)
  })()

  const thisBest = (() => {
    const vals = thisWeekRaces.map(r => Number(r.result ?? r.mark ?? r.value)).filter(Number.isFinite)
    if (!vals.length) return null
    return higher ? Math.max(...vals) : Math.min(...vals)
  })()

  let pbDelta = null
  let pbBroken = false
  if (thisBest != null && beforeBest != null) {
    pbDelta = higher ? thisBest - beforeBest : beforeBest - thisBest
    pbBroken = pbDelta > 0
  }

  // Top metric improvement this week vs prior week
  const grouped = {}
  metricsArr.forEach(m => {
    const k = m.metric || m.name
    if (!k) return
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(m)
  })
  let topMetric = null
  Object.entries(grouped).forEach(([key, list]) => {
    const sorted = [...list].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
    const latestThis = sorted.filter(m => new Date(m.recorded_at).getTime() >= cutoffThis).slice(-1)[0]
    const latestPrev = sorted.filter(m => {
      const t = new Date(m.recorded_at).getTime()
      return t < cutoffThis && t >= cutoffPrev
    }).slice(-1)[0]
    if (!latestThis || !latestPrev) return
    const vNew = Number(latestThis.value)
    const vOld = Number(latestPrev.value)
    if (!Number.isFinite(vNew) || !Number.isFinite(vOld) || vOld === 0) return
    const pct = ((vNew - vOld) / Math.abs(vOld)) * 100
    if (!topMetric || Math.abs(pct) > Math.abs(topMetric.pct)) {
      topMetric = { metric: key, pct, vNew, vOld }
    }
  })

  const tier = pb != null ? performancePosition(pb, discipline, sex)?.nearestTier?.label : null

  return {
    sessions: thisWeekRaces.length + thisWeekMetrics.length,
    races: thisWeekRaces.length,
    metricsLogged: thisWeekMetrics.length,
    pbDelta,
    pbBroken,
    thisBest,
    topMetric,
    tier,
  }
}

// Build & download a 1080x1350 PNG share image (IG story portrait)
function downloadShareImage({ recap, discipline, athleteName, higher }) {
  const W = 1080, H = 1350
  const fmt = (v) => higher ? `${Number(v).toFixed(2)}m` : `${Number(v).toFixed(2)}s`

  const tierLabel = recap.tier || '—'
  const pbLine = recap.pbBroken
    ? `New PB · ${fmt(recap.thisBest)}`
    : recap.thisBest != null
    ? `Best this week · ${fmt(recap.thisBest)}`
    : 'Stay consistent'
  const deltaLine = recap.pbBroken
    ? `${(higher ? '+' : '-')}${Math.abs(recap.pbDelta).toFixed(2)}${higher ? 'm' : 's'} vs prior PB`
    : ''

  const topMetricLine = recap.topMetric
    ? `${recap.topMetric.metric}  ${recap.topMetric.pct >= 0 ? '+' : ''}${recap.topMetric.pct.toFixed(1)}%`
    : ''

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="50%" stop-color="#0c1222"/>
      <stop offset="100%" stop-color="#0a0f1c"/>
    </linearGradient>
    <radialGradient id="orb1" cx="20%" cy="25%" r="40%">
      <stop offset="0%" stop-color="#f97316" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#f97316" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orb2" cx="80%" cy="80%" r="40%">
      <stop offset="0%" stop-color="#fb923c" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#fb923c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="num" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#fb923c"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#orb1)"/>
  <rect width="${W}" height="${H}" fill="url(#orb2)"/>

  <text x="80" y="140" fill="#fb923c" font-family="DM Mono, monospace" font-size="28" letter-spacing="6">WEEKLY RECAP</text>
  <text x="80" y="200" fill="#64748b" font-family="DM Mono, monospace" font-size="22" letter-spacing="4">${(discipline || '').toUpperCase()}</text>

  <line x1="80" y1="240" x2="${W - 80}" y2="240" stroke="#1e293b" stroke-width="2"/>

  <text x="80" y="340" fill="#94a3b8" font-family="DM Mono, monospace" font-size="22" letter-spacing="3">PERSONAL BEST</text>
  <text x="80" y="440" fill="url(#num)" font-family="Instrument Sans, sans-serif" font-size="110" font-weight="600">${pbLine}</text>
  ${deltaLine ? `<text x="80" y="490" fill="#34d399" font-family="DM Mono, monospace" font-size="28">${deltaLine}</text>` : ''}

  <text x="80" y="620" fill="#94a3b8" font-family="DM Mono, monospace" font-size="22" letter-spacing="3">SESSIONS LOGGED</text>
  <text x="80" y="740" fill="#ffffff" font-family="Instrument Sans, sans-serif" font-size="160" font-weight="700">${recap.sessions}</text>
  <text x="350" y="740" fill="#64748b" font-family="DM Mono, monospace" font-size="32">${recap.races} races · ${recap.metricsLogged} metrics</text>

  <text x="80" y="870" fill="#94a3b8" font-family="DM Mono, monospace" font-size="22" letter-spacing="3">CURRENT TIER</text>
  <text x="80" y="970" fill="#ffffff" font-family="Instrument Sans, sans-serif" font-size="84" font-weight="600">${tierLabel}</text>

  ${topMetricLine ? `
  <text x="80" y="1080" fill="#94a3b8" font-family="DM Mono, monospace" font-size="22" letter-spacing="3">TOP MOVER</text>
  <text x="80" y="1170" fill="#fb923c" font-family="Instrument Sans, sans-serif" font-size="64" font-weight="600">${topMetricLine}</text>
  ` : ''}

  <line x1="80" y1="1240" x2="${W - 80}" y2="1240" stroke="#1e293b" stroke-width="2"/>
  <text x="80" y="1290" fill="#475569" font-family="DM Mono, monospace" font-size="24" letter-spacing="4">BNCHMRKD.</text>
  ${athleteName ? `<text x="${W - 80}" y="1290" fill="#475569" font-family="DM Mono, monospace" font-size="24" text-anchor="end">${athleteName}</text>` : ''}
</svg>`

  // Convert SVG → PNG via canvas
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, W, H)
    canvas.toBlob((png) => {
      if (!png) return
      const dl = document.createElement('a')
      dl.href = URL.createObjectURL(png)
      dl.download = `bnchmrkd-recap-${new Date().toISOString().slice(0,10)}.png`
      dl.click()
      setTimeout(() => URL.revokeObjectURL(dl.href), 1000)
    }, 'image/png')
    URL.revokeObjectURL(url)
  }
  img.src = url
}

export function WeeklyRecap({ athleteId, races, metrics, pb, discipline, sex = 'M', athleteName, force = false }) {
  const cal = getCalibration(discipline, sex)
  const higher = !!cal.higher

  const recap = useMemo(
    () => computeWeeklyRecap({ races, metrics, pb, discipline, sex, higher }),
    [races, metrics, pb, discipline, sex, higher]
  )

  // Visibility window: Fri-Sun only, unless force=true
  const day = new Date().getDay() // 0=Sun ... 5=Fri 6=Sat
  const inWindow = force || day === 5 || day === 6 || day === 0
  if (!inWindow) return null

  // Need at least some activity to be worth showing
  if (!recap.sessions && !recap.pbBroken) return null

  const fmt = (v) => higher ? `${Number(v).toFixed(2)}m` : `${Number(v).toFixed(2)}s`

  return (
    <section
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: 'linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(249,115,22,0.04) 100%)',
        border: '1px solid rgba(249,115,22,0.18)',
      }}
    >
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full"
        style={{ background: `radial-gradient(circle, ${ORANGE}22 0%, transparent 65%)` }}
      />

      <header className="relative px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div>
          <p className="mono-font text-[10px] uppercase tracking-[0.22em] text-orange-300">
            Weekly recap
          </p>
          <h3 className="landing-font text-white mt-1 text-xl font-semibold leading-tight">
            Your week in numbers
          </h3>
        </div>
        <span className="mono-font text-[9px] uppercase tracking-[0.18em] text-slate-500">
          last 7 days
        </span>
      </header>

      <div className="relative px-5 pb-4 grid grid-cols-3 gap-3">
        <div
          className="rounded-xl px-3 py-3"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <p className="mono-font text-[9px] uppercase tracking-[0.18em] text-slate-500">Sessions</p>
          <p className="landing-font text-white text-2xl font-semibold tabular-nums mt-1">
            {recap.sessions}
          </p>
        </div>
        <div
          className="rounded-xl px-3 py-3"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <p className="mono-font text-[9px] uppercase tracking-[0.18em] text-slate-500">PB</p>
          <p
            className="landing-font text-2xl font-semibold tabular-nums mt-1"
            style={{ color: recap.pbBroken ? '#34d399' : '#cbd5e1' }}
          >
            {recap.pbBroken ? `−${Math.abs(recap.pbDelta).toFixed(2)}${higher ? 'm' : 's'}` : (recap.thisBest != null ? fmt(recap.thisBest) : '—')}
          </p>
        </div>
        <div
          className="rounded-xl px-3 py-3"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <p className="mono-font text-[9px] uppercase tracking-[0.18em] text-slate-500">Tier</p>
          <p className="landing-font text-white text-base font-semibold mt-1 leading-tight">
            {recap.tier || '—'}
          </p>
        </div>
      </div>

      {recap.topMetric && (
        <div className="relative px-5 pb-4">
          <p className="landing-font text-slate-300 text-sm">
            Top mover ·{' '}
            <span className="text-white font-semibold">{recap.topMetric.metric}</span>{' '}
            <span
              className="mono-font tabular-nums"
              style={{ color: recap.topMetric.pct >= 0 ? '#34d399' : '#fb7185' }}
            >
              {recap.topMetric.pct >= 0 ? '+' : ''}{recap.topMetric.pct.toFixed(1)}%
            </span>
          </p>
        </div>
      )}

      <div
        className="relative px-5 py-3 flex items-center justify-between gap-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <p className="mono-font text-[9px] uppercase tracking-[0.18em] text-slate-500">
          Friday drop
        </p>
        <button
          type="button"
          onClick={() => downloadShareImage({ recap, discipline, athleteName, higher })}
          className="landing-font text-xs font-semibold px-4 py-2 rounded-lg text-slate-900 transition-transform active:scale-[0.97]"
          style={{
            background: `linear-gradient(135deg, #ffffff 0%, ${ORANGE_LITE} 100%)`,
            boxShadow: `0 4px 16px ${ORANGE}44`,
          }}
        >
          Share recap
        </button>
      </div>
    </section>
  )
}

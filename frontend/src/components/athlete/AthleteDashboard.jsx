import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Minus, Target, Calendar,
  LogOut, RefreshCw, AlertCircle, Activity, Home, LineChart as LineChartIcon, Plus,
  ChevronLeft, Save, X
} from 'lucide-react'
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Area, ComposedChart
} from 'recharts'
import { selectFrom, updateIn } from '../../lib/supabaseRest'
import { getReferenceTiers, getCalibration, performancePosition } from '../../lib/disciplineScience'
import MetricLogView from './MetricLogView'
import {
  TrajectoryHero, RivalCard, WhereYouStand, AthleteDNALadder, LimitingFactorCard, ScienceSpotlight, SinceLastVisit,
  TierUpCelebration, useTierTracker, WeeklyRecap,
} from './HomeSections'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://web-production-295f1.up.railway.app'

// ── Discipline helpers ─────────────────────────────────────────────────
const THROWS = ['Discus Throw', 'Shot Put', 'Javelin Throw', 'Hammer Throw', 'Discus', 'Javelin', 'Hammer', 'Shot']
const isThrowsDiscipline = (d) => THROWS.some(t => d?.toLowerCase().includes(t.toLowerCase()))

// Map onboarding event codes (M100, FDT...) to analyzer-friendly discipline names
const EVENT_CODE_TO_NAME = {
  M100: '100m', F100: '100m',
  M200: '200m', F200: '200m',
  M400: '400m', F400: '400m',
  M110H: '110mH', F100H: '100mH',
  M400H: '400mH', F400H: '400mH',
  MDT: 'Discus Throw', FDT: 'Discus Throw',
  MJT: 'Javelin Throw', FJT: 'Javelin Throw',
  MHT: 'Hammer Throw', FHT: 'Hammer Throw',
  MSP: 'Shot Put', FSP: 'Shot Put',
}
// Build the unique list of disciplines this athlete can log
const buildAvailableDisciplines = (athleteRow) => {
  const fromOnboarding = (athleteRow?.primary_events || [])
    .map(c => EVENT_CODE_TO_NAME[c])
    .filter(Boolean)
  const fromWa = athleteRow?.disciplines || []
  const fromData = athleteRow?.disciplines_data ? Object.keys(athleteRow.disciplines_data) : []
  return Array.from(new Set([...fromOnboarding, ...fromWa, ...fromData]))
}
const formatMark = (value, discipline) => {
  if (value == null) return '—'
  if (isThrowsDiscipline(discipline)) return `${Number(value).toFixed(2)}m`
  const v = Number(value)
  const mins = Math.floor(v / 60)
  const secs = (v % 60).toFixed(2)
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}s`
}

// Parse a user-typed mark string into a numeric value.
//   Throws: "45.23" or "45.23m" → 45.23
//   Sprints: "10.45" → 10.45;  "1:52.30" → 112.30
const parseMarkInput = (str, isThrows) => {
  if (!str) return null
  const cleaned = str.trim().replace('m', '').replace(',', '.')
  if (isThrows) {
    const v = parseFloat(cleaned)
    return isNaN(v) ? null : v
  }
  if (cleaned.includes(':')) {
    const [m, s] = cleaned.split(':')
    const mins = parseFloat(m); const secs = parseFloat(s)
    if (isNaN(mins) || isNaN(secs)) return null
    return mins * 60 + secs
  }
  const v = parseFloat(cleaned)
  return isNaN(v) ? null : v
}

// ═══════════════════════════════════════════════════════════════════════
// ATHLETE DASHBOARD — tabbed mobile shell
// ═══════════════════════════════════════════════════════════════════════
export default function AthleteDashboard({ user, profile, onSignOut, onViewTrajectory }) {
  const [athleteRow, setAthleteRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [activeDiscipline, setActiveDiscipline] = useState(null)
  const [tab, setTab] = useState('home') // 'home' | 'log' | 'trajectory'
  const [showProfile, setShowProfile] = useState(false)

  // ── Load athlete_profiles row ───────────────────────────────────────
  const loadAthlete = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError('')
    try {
      const rows = await selectFrom('athlete_profiles', { filter: `id=eq.${user.id}` })
      const row = Array.isArray(rows) ? rows[0] : rows
      setAthleteRow(row || null)
      if (row?.discipline) setActiveDiscipline(row.discipline)
    } catch (err) {
      console.error('[athlete] load failed:', err)
      setError('Could not load your profile data.')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { loadAthlete() }, [loadAthlete])

  // ── Refresh from World Athletics ────────────────────────────────────
  const handleRefresh = async () => {
    if (!athleteRow?.world_athletics_url) return
    setRefreshing(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/v1/analyze/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: athleteRow.world_athletics_url }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Server error ${res.status}`)
      }
      const result = await res.json()
      if (!result.success) throw new Error('Refresh failed')

      const scraped = result.data?._scraped || {}
      const races = scraped.races || []
      const isThrows = isThrowsDiscipline(scraped.discipline)
      let pbVal = null
      for (const r of races) {
        if (r.value == null) continue
        if (pbVal == null || (isThrows ? r.value > pbVal : r.value < pbVal)) pbVal = r.value
      }
      const sorted = races.filter(r => r.date && r.value).sort((a, b) => new Date(b.date) - new Date(a.date))
      const last = sorted[0]

      const updated = await updateIn('athlete_profiles', `id=eq.${user.id}`, {
        nationality: scraped.nationality || athleteRow.nationality,
        discipline: scraped.discipline || athleteRow.discipline,
        disciplines: scraped.supported_disciplines || athleteRow.disciplines,
        pb_value: pbVal,
        pb_display: pbVal ? formatMark(pbVal, scraped.discipline) : null,
        last_result_value: last?.value || null,
        last_result_display: last?.value ? formatMark(last.value, scraped.discipline) : null,
        last_result_date: last?.date || null,
        races,
        disciplines_data: scraped.disciplines_data || {},
        analysis_data: result.data,
        last_synced_at: new Date().toISOString(),
      })

      setAthleteRow(updated)
      if (updated?.discipline) setActiveDiscipline(updated.discipline)
    } catch (err) {
      console.error('[athlete] refresh failed:', err)
      setError(err.message || 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  // ── Append a manual log entry ───────────────────────────────────────
  const handleLogEntry = async ({ date, competition, mark, discipline }) => {
    const isThrows = isThrowsDiscipline(discipline)
    const value = parseMarkInput(mark, isThrows)
    if (value == null) throw new Error('Could not parse that mark — try e.g. 45.23 or 10.45 or 1:52.30')

    const newRace = { date, competition, value, manual: true, discipline }
    const allRaces = [...(athleteRow?.races || []), newRace]

    // Recompute PB
    let pbVal = null
    for (const r of allRaces) {
      if (r.value == null) continue
      const matchesDiscipline = !discipline || !r.discipline || r.discipline === discipline
      if (!matchesDiscipline) continue
      if (pbVal == null || (isThrows ? r.value > pbVal : r.value < pbVal)) pbVal = r.value
    }

    const sorted = [...allRaces].sort((a, b) => new Date(b.date) - new Date(a.date))
    const last = sorted[0]

    const patch = {
      races: allRaces,
      pb_value: pbVal,
      pb_display: pbVal != null ? formatMark(pbVal, discipline) : athleteRow?.pb_display,
      last_result_value: last?.value ?? null,
      last_result_display: last?.value != null ? formatMark(last.value, discipline) : null,
      last_result_date: last?.date ?? null,
      last_synced_at: new Date().toISOString(),
    }
    if (!athleteRow?.discipline && discipline) patch.discipline = discipline

    const updated = await updateIn('athlete_profiles', `id=eq.${user.id}`, patch)
    setAthleteRow(updated)
    if (updated?.discipline) setActiveDiscipline(updated.discipline)
  }

  // ── Save profile edits ──────────────────────────────────────────────
  const handleProfileSave = async (patch) => {
    const updated = await updateIn('athlete_profiles', `id=eq.${user.id}`, patch)
    setAthleteRow(updated)
  }

  // ── Derived data for the active discipline ─────────────────────────
  const view = useMemo(() => {
    if (!athleteRow) return null
    const discipline = activeDiscipline || athleteRow.discipline
    const isThrows = isThrowsDiscipline(discipline)
    const allRaces = athleteRow.races || []
    const disciplinesData = athleteRow.disciplines_data || {}
    const races = disciplinesData[discipline] || allRaces

    let pb = null
    for (const r of races) {
      if (r.value == null) continue
      if (pb == null || (isThrows ? r.value > pb : r.value < pb)) pb = r.value
    }

    const sortedAsc = races
      .filter(r => r.date && r.value != null)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
    const sortedDesc = [...sortedAsc].reverse()

    const chartData = sortedAsc.map(r => ({
      date: r.date,
      label: new Date(r.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      value: Number(r.value),
      competition: r.competition,
    }))

    let trend = 'stable'
    if (sortedDesc.length >= 2) {
      const a = sortedDesc[0].value
      const b = sortedDesc[Math.min(2, sortedDesc.length - 1)].value
      if (isThrows ? a > b : a < b) trend = 'up'
      else if (isThrows ? a < b : a > b) trend = 'down'
    }

    let nextMilestone = null
    if (pb != null) {
      if (isThrows) {
        const nextWhole = Math.ceil(pb + 0.01)
        nextMilestone = nextWhole - pb < 0.3 ? nextWhole + 1 : nextWhole
      } else {
        const sub = Math.floor(pb * 2) / 2
        nextMilestone = sub < pb ? sub : sub - 0.5
      }
    }

    return {
      discipline, isThrows, races, pb,
      lastRace: sortedDesc[0],
      sortedDesc, chartData, trend, nextMilestone,
      raceCount: races.length,
    }
  }, [athleteRow, activeDiscipline])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(170deg, #020617 0%, #0c1222 40%, #0a0f1c 100%)' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your data...</p>
        </div>
      </div>
    )
  }

  // ── Header ──────────────────────────────────────────────────────────
  const Header = () => (
    <header
      className="sticky top-0 z-10 backdrop-blur-xl"
      style={{ background: 'rgba(2,6,23,0.7)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setShowProfile(true)}
          className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)', boxShadow: '0 4px 16px rgba(249,115,22,0.4)' }}
          >
            <span className="landing-font text-white font-semibold text-base">
              {(profile?.full_name || user?.email || 'A')[0].toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 text-left">
            <p className="landing-font text-white font-semibold truncate leading-tight text-[15px]">
              {profile?.full_name || 'Athlete'}
            </p>
            <p className="mono-font text-[10px] uppercase tracking-[0.18em] text-slate-500 truncate mt-0.5">
              {view?.discipline || 'No event yet'}
            </p>
          </div>
        </button>
        <button
          onClick={onSignOut}
          className="p-2 rounded-lg text-slate-500 hover:text-orange-300 transition-colors"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )

  // ── Trajectory: hand off to analyzer (BnchMrkdApp via App.jsx) ──────
  const handleOpenTrajectory = () => {
    if (!onViewTrajectory) return
    if (!view || view.raceCount === 0) {
      setError('Log at least one result before opening Trajectory.')
      return
    }
    // Map athleteRow → incomingAthlete shape BnchMrkdApp expects
    const payload = {
      name: profile?.full_name || 'Athlete',
      gender: profile?.gender || athleteRow?.gender || 'M',
      dob: profile?.date_of_birth || athleteRow?.date_of_birth || null,
      discipline: (view.discipline || '').trim(),
      races: (athleteRow?.races || []).map(r => ({ ...r, discipline: (r.discipline || '').trim() })),
      disciplines_data: Object.fromEntries(
        Object.entries(athleteRow?.disciplines_data || {}).map(([k, v]) => [k.trim(), v])
      ),
    }
    onViewTrajectory(payload)
  }

  // ── Bottom navigation ───────────────────────────────────────────────
  const BottomNav = () => (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 backdrop-blur-xl"
      style={{ background: 'rgba(2,6,23,0.85)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="max-w-2xl mx-auto px-6 py-2 flex items-center justify-between">
        <button
          onClick={() => setTab('home')}
          className="flex flex-col items-center gap-1 px-4 py-1.5 transition-colors"
          style={{ color: tab === 'home' ? '#fb923c' : '#475569' }}
        >
          <Home className="w-[18px] h-[18px]" strokeWidth={2} />
          <span className="mono-font text-[9px] uppercase tracking-[0.18em]">Home</span>
        </button>
        <button onClick={() => setTab('log')} className="flex flex-col items-center -mt-5">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all"
            style={{
              background: 'linear-gradient(135deg, #f97316, #fb923c)',
              boxShadow: tab === 'log'
                ? '0 0 0 4px rgba(249,115,22,0.25), 0 8px 24px rgba(249,115,22,0.5)'
                : '0 6px 20px rgba(249,115,22,0.4)',
            }}
          >
            <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <span
            className="mono-font text-[9px] uppercase tracking-[0.18em] mt-1.5"
            style={{ color: tab === 'log' ? '#fb923c' : '#475569' }}
          >
            Log
          </span>
        </button>
        <button
          onClick={handleOpenTrajectory}
          className="flex flex-col items-center gap-1 px-4 py-1.5 transition-colors text-slate-500 hover:text-orange-300"
        >
          <LineChartIcon className="w-[18px] h-[18px]" strokeWidth={2} />
          <span className="mono-font text-[9px] uppercase tracking-[0.18em]">Trajectory</span>
        </button>
      </div>
    </nav>
  )

  // ── Profile edit overlay ────────────────────────────────────────────
  if (showProfile) {
    return (
      <ProfileEditView
        athleteRow={athleteRow}
        profile={profile}
        user={user}
        onClose={() => setShowProfile(false)}
        onSave={handleProfileSave}
      />
    )
  }

  // ── Empty state ─────────────────────────────────────────────────────
  if (!view || view.raceCount === 0) {
    // Still allow the Log tab to render its form when empty
    if (tab === 'log') {
      return (
        <div className="min-h-screen text-slate-200 pb-24" style={{ background: 'linear-gradient(170deg, #020617 0%, #0c1222 40%, #0a0f1c 100%)' }}>
          <Header />
          <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
            <MetricLogView
              athleteId={user?.id}
              PerformancePanel={
                <LogEntryView
                  view={view || { discipline: athleteRow?.discipline, isThrows: false }}
                  athleteRow={athleteRow}
                  availableDisciplines={buildAvailableDisciplines(athleteRow)}
                  onSubmit={handleLogEntry}
                  onDone={() => setTab('home')}
                />
              }
            />
          </main>
          <BottomNav />
        </div>
      )
    }
    return (
      <div className="min-h-screen text-slate-200 pb-24" style={{ background: 'linear-gradient(170deg, #020617 0%, #0c1222 40%, #0a0f1c 100%)' }}>
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-12">
          <div
            className="relative overflow-hidden rounded-2xl p-8 text-center"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div
              className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 65%)' }}
            />
            <p className="mono-font text-[10px] uppercase tracking-[0.22em] text-slate-500 mb-3 relative">
              Get started
            </p>
            <h2 className="landing-font text-white mb-3 text-2xl font-semibold relative">
              No performance data yet
            </h2>
            <p className="landing-font text-slate-400 text-sm leading-snug mb-6 max-w-sm mx-auto relative">
              {athleteRow?.world_athletics_url
                ? 'We have your World Athletics URL on file. Pull your results in to get started.'
                : 'Log your first result, or add your World Athletics URL on your profile to pull your full history.'}
            </p>
            {athleteRow?.world_athletics_url ? (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full landing-font text-sm font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #f97316, #fb923c)',
                  boxShadow: '0 8px 24px rgba(249,115,22,0.4)',
                }}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Loading…' : 'Pull from World Athletics'}
              </button>
            ) : (
              <button
                onClick={() => setTab('log')}
                className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full landing-font text-sm font-semibold text-white transition-all hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg, #f97316, #fb923c)',
                  boxShadow: '0 8px 24px rgba(249,115,22,0.4)',
                }}
              >
                <Plus className="w-4 h-4" /> Log a result
              </button>
            )}
            {error && (
              <div className="mt-4 inline-flex items-center gap-2 text-orange-300 mono-font text-[10px] uppercase tracking-[0.18em] relative">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </div>
            )}
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Main shell ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen text-slate-200 pb-24" style={{ background: 'linear-gradient(170deg, #020617 0%, #0c1222 40%, #0a0f1c 100%)' }}>
      <Header />

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {tab === 'home' && (
          <HomeView
            view={view}
            athleteRow={athleteRow}
            profile={profile}
            athleteId={user?.id}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
        )}
        {tab === 'log' && (
          <MetricLogView
            athleteId={user?.id}
            PerformancePanel={
              <LogEntryView
                view={view}
                athleteRow={athleteRow}
                availableDisciplines={buildAvailableDisciplines(athleteRow)}
                onSubmit={handleLogEntry}
                onDone={() => setTab('home')}
              />
            }
          />
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// HOME VIEW — Hero PB + recent results
// ═══════════════════════════════════════════════════════════════════════
function HomeView({ view, athleteRow, profile, athleteId, onRefresh, refreshing }) {
  // Fetch athlete_metrics once and share across all home sections
  const [metrics, setMetrics] = useState([])
  useEffect(() => {
    if (!athleteId) return
    let cancelled = false
    selectFrom('athlete_metrics', {
      filter: `athlete_id=eq.${athleteId}`,
      order: 'recorded_at.desc,created_at.desc',
      limit: '200',
    })
      .then(data => { if (!cancelled) setMetrics(data || []) })
      .catch(() => { if (!cancelled) setMetrics([]) })
    return () => { cancelled = true }
  }, [athleteId])

  const sex = profile?.gender || athleteRow?.gender || 'M'

  const { celebrating, dismiss: dismissTierUp } = useTierTracker({
    athleteId,
    pb: view.pb,
    discipline: view.discipline,
    sex,
  })

  return (
    <>
      <TierUpCelebration celebrating={celebrating} onDismiss={dismissTierUp} />

      <TrajectoryHero
        athleteId={athleteId}
        races={athleteRow?.races || []}
        pb={view.pb}
        discipline={view.discipline}
        sex={sex}
      />

      <WeeklyRecap
        athleteId={athleteId}
        races={athleteRow?.races || []}
        metrics={metrics}
        pb={view.pb}
        discipline={view.discipline}
        sex={sex}
        athleteName={profile?.first_name || athleteRow?.first_name}
        force={typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('recap') === '1'}
      />

      <SinceLastVisit
        athleteId={athleteId}
        metrics={metrics}
        races={athleteRow?.races || []}
        pb={view.pb}
        discipline={view.discipline}
      />

      <WhereYouStand pb={view.pb} discipline={view.discipline} sex={sex} />

      <RivalCard
        pb={view.pb}
        discipline={view.discipline}
        sex={sex}
        dob={athleteRow?.date_of_birth || athleteRow?.dob}
      />

      <AthleteDNALadder
        metrics={metrics}
        discipline={view.discipline}
        dob={athleteRow?.date_of_birth || athleteRow?.dob}
      />

      <LimitingFactorCard
        metrics={metrics}
        pb={view.pb}
        discipline={view.discipline}
        sex={sex}
      />

      <ScienceSpotlight discipline={view.discipline} />

      {view.nextMilestone != null && (
        <section
          className="relative overflow-hidden rounded-2xl flex items-stretch"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="w-1" style={{ background: 'linear-gradient(180deg, #f97316, #fb923c)' }} />
          <div className="flex-1 px-4 py-3 flex items-center gap-3">
            <Target className="w-4 h-4 text-orange-300 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="mono-font text-[9px] uppercase tracking-[0.22em] text-slate-500">
                Next milestone
              </p>
              <p className="landing-font text-white mt-0.5 text-[15px] font-semibold">
                <span className="tabular-nums">{formatMark(view.nextMilestone, view.discipline)}</span>
                <span className="mono-font text-slate-500 text-[10px] ml-2 tabular-nums font-normal">
                  {view.isThrows
                    ? `(+${(view.nextMilestone - view.pb).toFixed(2)}m)`
                    : `(−${(view.pb - view.nextMilestone).toFixed(2)}s)`}
                </span>
              </p>
            </div>
          </div>
        </section>
      )}

      <section
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 65%)' }}
        />
        <header className="relative px-5 pt-5 pb-3 flex items-end justify-between">
          <div>
            <p className="mono-font text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Recent results
            </p>
            <h3 className="landing-font text-white mt-1 leading-tight text-lg font-semibold">
              The ledger
            </h3>
          </div>
          <Calendar className="w-4 h-4 text-slate-500" />
        </header>
        <div className="relative">
          {view.sortedDesc.slice(0, 5).map((r, i) => {
            const isPB = r.value === view.pb
            return (
              <div
                key={i}
                className="px-5 py-3 flex items-center justify-between gap-3"
                style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
              >
                <div className="min-w-0 flex-1">
                  <p className="landing-font text-white truncate leading-tight text-sm font-medium">
                    {r.competition || 'Competition'}
                  </p>
                  <p className="mono-font text-[9px] uppercase tracking-[0.18em] text-slate-500 mt-0.5">
                    {new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className="landing-font tabular-nums leading-none font-semibold text-base"
                    style={{ color: isPB ? '#fb923c' : '#e2e8f0' }}
                  >
                    {formatMark(r.value, view.discipline)}
                  </p>
                  {isPB && (
                    <p className="mono-font text-[8px] uppercase tracking-[0.22em] mt-1 text-orange-300">
                      ★ personal best
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <RecentMetricsPanel athleteId={athleteId} refreshKey={metrics.length} preloaded={metrics} />

      {athleteRow?.world_athletics_url && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-gray-300 rounded-lg text-sm transition-colors border border-gray-800"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh from World Athletics'}
        </button>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TRAJECTORY VIEW — removed 2026-04-08 (was dead code).
// The actual analyzer surface lives in bnchmarkd-app.jsx and is reached
// via the onViewTrajectory(payload) callback in handleOpenTrajectory.
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// LOG ENTRY VIEW — manual result form
// ═══════════════════════════════════════════════════════════════════════
function LogEntryView({ view, athleteRow, availableDisciplines = [], onSubmit, onDone }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [competition, setCompetition] = useState('')
  const [mark, setMark] = useState('')
  const initialDiscipline = view?.discipline || athleteRow?.discipline || availableDisciplines[0] || ''
  const [discipline, setDiscipline] = useState(initialDiscipline)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState(false)

  const isThrows = isThrowsDiscipline(discipline)

  const handle = async () => {
    setErr('')
    if (!date || !mark) { setErr('Date and mark are required.'); return }
    setSubmitting(true)
    try {
      await onSubmit({ date, competition: competition || 'Training', mark, discipline })
      setSuccess(true)
      setTimeout(() => { setSuccess(false); onDone() }, 900)
    } catch (e) {
      setErr(e.message || 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <h2 className="text-lg font-bold text-white">Log a result</h2>
      <p className="text-xs text-gray-500 -mt-2">Add a competition or training mark.</p>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Competition / Session</label>
        <input
          type="text"
          value={competition}
          onChange={(e) => setCompetition(e.target.value)}
          placeholder="e.g. Dubai Open"
          className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Discipline</label>
        {availableDisciplines.length > 0 ? (
          <select
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
          >
            {availableDisciplines.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
            placeholder="e.g. Discus Throw"
            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
        )}
        {availableDisciplines.length === 0 && (
          <p className="text-[11px] text-gray-500 mt-1">
            Tip: add primary events on your profile to get a quick-pick list here.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Mark {isThrows ? '(metres, e.g. 45.23)' : '(seconds e.g. 10.45 or m:ss.xx e.g. 1:52.30)'}
        </label>
        <input
          type="text"
          value={mark}
          onChange={(e) => setMark(e.target.value)}
          placeholder={isThrows ? '45.23' : '10.45'}
          inputMode="decimal"
          className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-base placeholder-gray-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {err && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-xs">{err}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
          <p className="text-emerald-400 text-sm font-medium">✓ Saved!</p>
        </div>
      )}

      <button
        onClick={handle}
        disabled={submitting || !date || !mark}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
      >
        {submitting ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <><Save className="w-4 h-4" /> Save result</>
        )}
      </button>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// PROFILE EDIT VIEW
// ═══════════════════════════════════════════════════════════════════════
function ProfileEditView({ athleteRow, profile, user, onClose, onSave }) {
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [club, setClub] = useState(profile?.club_school || '')
  const [country, setCountry] = useState(profile?.country || '')
  const [city, setCity] = useState(profile?.city || '')
  const [waUrl, setWaUrl] = useState(athleteRow?.world_athletics_url || '')
  const [heightCm, setHeightCm] = useState(athleteRow?.height_cm || '')
  const [weightKg, setWeightKg] = useState(athleteRow?.weight_kg || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = async () => {
    setErr(''); setSaving(true)
    try {
      // Athlete-specific fields go to athlete_profiles
      await onSave({
        world_athletics_url: waUrl || null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
      })
      // Shared fields go to user_profiles
      await updateIn('user_profiles', `id=eq.${user.id}`, {
        full_name: fullName,
        club_school: club || null,
        country: country || null,
        city: city || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setErr(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Edit profile</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Full Name</label>
            <input
              type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Country</label>
              <input
                type="text" value={country} onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">City</label>
              <input
                type="text" value={city} onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Club / School</label>
            <input
              type="text" value={club} onChange={(e) => setClub(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Height (cm)</label>
              <input
                type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Weight (kg)</label>
              <input
                type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">World Athletics Profile URL</label>
            <input
              type="url" value={waUrl} onChange={(e) => setWaUrl(e.target.value)}
              placeholder="https://worldathletics.org/athletes/..."
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Add or update this URL to pull your career history from World Athletics.
            </p>
          </div>

          {err && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-xs">{err}</p>
            </div>
          )}
          {saved && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              <p className="text-emerald-400 text-sm font-medium">✓ Saved</p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Save className="w-4 h-4" /> Save changes</>
            )}
          </button>
        </div>
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// RECENT METRICS PANEL — shows latest entries from athlete_metrics
// ═══════════════════════════════════════════════════════════════════════
// Metrics where a LOWER value is a better result (times, RHR, fat metrics).
// Everything else is treated as "higher is better" for PB detection.
const LOWER_IS_BETTER = new Set([
  // speed — sprint splits and flying times
  'sprint_10m', 'sprint_20m', 'sprint_30m', 'sprint_40m', 'sprint_60m',
  'flying_10m', 'split_300m',
  // endurance — time trials and resting HR
  'tt_1200m', 'bronco', 'tt_2km', 'rhr',
  // anthropometrics — fat metrics
  'body_fat_pct', 'sum_7_skinfolds', 'fat_mass',
])
// Metrics where "PB" doesn't really apply (body mass, heights) — don't flag PBs.
const NO_PB = new Set([
  'body_mass', 'standing_height', 'sitting_height', 'wingspan', 'lean_mass',
])

function RecentMetricsPanel({ athleteId, refreshKey, preloaded = null }) {
  const [rows, setRows] = useState(preloaded || [])
  const [loading, setLoading] = useState(preloaded == null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (preloaded) { setRows(preloaded); setLoading(false); return }
    if (!athleteId) return
    let cancelled = false
    setLoading(true)
    setErr('')
    selectFrom('athlete_metrics', {
      filter: `athlete_id=eq.${athleteId}`,
      order: 'recorded_at.desc,created_at.desc',
      limit: '20',
    })
      .then(data => { if (!cancelled) setRows(data || []) })
      .catch(e => { if (!cancelled) setErr(e.message || 'Failed to load metrics') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [athleteId, refreshKey, preloaded])

  // Group by metric_key and compute latest + PB
  const summary = useMemo(() => {
    const byKey = {}
    for (const r of rows) {
      if (!byKey[r.metric_key]) {
        byKey[r.metric_key] = {
          key: r.metric_key,
          label: r.metric_label,
          unit: r.unit,
          category: r.category,
          latest: r,
          best: r,
          history: [r],
        }
      } else {
        const g = byKey[r.metric_key]
        g.history.push(r)
        if (new Date(r.recorded_at) > new Date(g.latest.recorded_at)) g.latest = r
        // Direction-aware best: lower-is-better for times, RHR, fat metrics
        const lowerBetter = LOWER_IS_BETTER.has(r.metric_key)
        const rv = Number(r.value)
        const bv = Number(g.best.value)
        if (lowerBetter ? rv < bv : rv > bv) g.best = r
      }
    }
    return Object.values(byKey).sort(
      (a, b) => new Date(b.latest.recorded_at) - new Date(a.latest.recorded_at)
    )
  }, [rows])

  if (!athleteId) return null

  if (loading) {
    return (
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-2">Recent metrics</h3>
        <p className="text-xs text-gray-500">Loading…</p>
      </section>
    )
  }

  if (err) {
    return (
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-2">Recent metrics</h3>
        <p className="text-xs text-red-400">{err}</p>
      </section>
    )
  }

  if (rows.length === 0) {
    return (
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-1">Recent metrics</h3>
        <p className="text-xs text-gray-500">
          Nothing logged yet. Tap the <span className="text-emerald-400">+</span> button to record
          a jump, sprint split, 1RM, mobility test, or body composition reading.
        </p>
      </section>
    )
  }

  // Category meta: brand-aligned palette + display order
  const CATEGORY_META = {
    speed:           { label: 'Speed',          tint: '#f97316', order: 1 },
    power:           { label: 'Power',          tint: '#fb923c', order: 2 },
    strength:        { label: 'Strength',       tint: '#f43f5e', order: 3 },
    endurance:       { label: 'Endurance',      tint: '#3b82f6', order: 4 },
    mobility:        { label: 'Mobility',       tint: '#14b8a6', order: 5 },
    anthropometrics: { label: 'Anthropometrics',tint: '#a78bfa', order: 6 },
  }
  const catMeta = (k) => CATEGORY_META[k] || { label: k || 'Other', tint: '#94a3b8', order: 9 }

  // Group cards by category, ordered by meta.order
  const grouped = []
  const groupMap = {}
  for (const g of summary) {
    if (!groupMap[g.category]) {
      groupMap[g.category] = { category: g.category, items: [] }
      grouped.push(groupMap[g.category])
    }
    groupMap[g.category].items.push(g)
  }
  grouped.sort((a, b) => catMeta(a.category).order - catMeta(b.category).order)

  // Sparkline component — tiny line chart from history (chronological)
  const Sparkline = ({ history, lowerBetter, tint }) => {
    const pts = [...history]
      .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
      .map(r => Number(r.value))
      .filter(v => Number.isFinite(v))
    if (pts.length < 2) return <div className="h-6" />
    const min = Math.min(...pts)
    const max = Math.max(...pts)
    const range = max - min || 1
    const W = 70, H = 22
    const step = W / (pts.length - 1)
    const yFor = (v) => H - ((v - min) / range) * H
    const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${yFor(v).toFixed(1)}`).join(' ')
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-[70px] h-[22px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`spk-${tint.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tint} stopOpacity="0.35" />
            <stop offset="100%" stopColor={tint} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill={`url(#spk-${tint.slice(1)})`}
          style={{ animation: 'sparkFade 1.4s ease-out both' }} />
        <path d={d} fill="none" stroke={tint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          pathLength="1"
          style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: 'sparkDraw 1.2s ease-out forwards' }} />
      </svg>
    )
  }

  return (
    <section
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <header className="relative px-5 pt-5 pb-3 flex items-end justify-between">
        <div>
          <p className="mono-font text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Physical profile
          </p>
          <h3 className="landing-font text-white mt-1 leading-tight text-lg font-semibold">
            Recent metrics
          </h3>
        </div>
        <span className="mono-font text-[10px] text-slate-500 uppercase tracking-[0.18em]">
          {summary.length} tracked
        </span>
      </header>

      <div className="relative px-5 pb-5 space-y-5">
        {grouped.map(group => {
          const meta = catMeta(group.category)
          return (
            <div key={group.category}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-1 h-3 rounded-full"
                  style={{ background: meta.tint, boxShadow: `0 0 8px ${meta.tint}88` }}
                />
                <p className="mono-font text-[10px] uppercase tracking-[0.22em]" style={{ color: meta.tint }}>
                  {meta.label}
                </p>
                <span className="mono-font text-[10px] text-slate-600">· {group.items.length}</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {group.items.map(g => {
                  const isPB = !NO_PB.has(g.key) && g.best.id === g.latest.id && g.history.length > 1
                  const lowerBetter = LOWER_IS_BETTER.has(g.key)

                  // Trend: compare latest to previous chronological entry
                  const sortedAsc = [...g.history].sort(
                    (a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)
                  )
                  const prev = sortedAsc.length > 1 ? sortedAsc[sortedAsc.length - 2] : null
                  const latestV = Number(g.latest.value)
                  const prevV = prev ? Number(prev.value) : null
                  const delta = prevV != null ? latestV - prevV : null
                  const deltaPct = prevV != null && prevV !== 0 ? (delta / prevV) * 100 : null
                  const improved = delta == null ? null : (lowerBetter ? delta < 0 : delta > 0)
                  const trendColor = improved == null ? '#64748b' : improved ? '#34d399' : '#fb7185'
                  const TrendIcon = improved == null ? null : improved ? TrendingUp : TrendingDown

                  return (
                    <div
                      key={g.key}
                      className="relative overflow-hidden rounded-xl p-3"
                      style={{
                        background: `linear-gradient(155deg, ${meta.tint}18 0%, rgba(255,255,255,0.02) 60%)`,
                        border: `1px solid ${meta.tint}33`,
                      }}
                    >
                      {/* Soft accent bloom */}
                      <div
                        className="pointer-events-none absolute -top-10 -right-10 w-24 h-24 rounded-full"
                        style={{ background: `radial-gradient(circle, ${meta.tint}22 0%, transparent 65%)` }}
                      />

                      {/* PB chip — top-right */}
                      {isPB && (
                        <span
                          className="absolute top-2 right-2 mono-font text-[8px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded"
                          style={{
                            background: 'rgba(52,211,153,0.15)',
                            color: '#6ee7b7',
                            border: '1px solid rgba(52,211,153,0.4)',
                          }}
                        >
                          PB
                        </span>
                      )}

                      <p className="landing-font text-white text-[13px] font-semibold leading-tight pr-8 truncate">
                        {g.label}
                      </p>
                      <p className="mono-font text-[9px] uppercase tracking-[0.16em] text-slate-500 mt-0.5">
                        {new Date(g.latest.recorded_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short',
                        })}
                        {g.history.length > 1 && ` · ${g.history.length} pts`}
                      </p>

                      <div className="mt-3 flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          <p className="landing-font text-white tabular-nums leading-none text-2xl font-semibold">
                            {Number(g.latest.value).toFixed(2).replace(/\.?0+$/, '')}
                            <span className="mono-font text-[10px] text-slate-500 ml-1 font-normal">
                              {g.unit}
                            </span>
                          </p>
                          {delta != null && (
                            <div
                              className="flex items-center gap-1 mt-1.5 mono-font text-[10px] tabular-nums"
                              style={{ color: trendColor }}
                            >
                              {TrendIcon && <TrendIcon className="w-3 h-3" strokeWidth={2.5} />}
                              <span>
                                {delta > 0 ? '+' : ''}
                                {delta.toFixed(2)}
                                {deltaPct != null && (
                                  <span className="text-slate-500 ml-1">
                                    ({deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%)
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                          {delta == null && (
                            <p className="mono-font text-[10px] text-slate-600 mt-1.5">
                              first entry
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <Sparkline history={g.history} lowerBetter={lowerBetter} tint={meta.tint} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

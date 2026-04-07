import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Minus, Target, Trophy, Calendar,
  LogOut, RefreshCw, Link as LinkIcon, AlertCircle, ChevronLeft, Activity
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Area, ComposedChart
} from 'recharts'
import { selectFrom, updateIn } from '../../lib/supabaseRest'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://web-production-295f1.up.railway.app'

// ── Discipline helpers (mirror CoachDashboard) ────────────────────────
const THROWS = ['Discus Throw', 'Shot Put', 'Javelin Throw', 'Hammer Throw', 'Discus', 'Javelin', 'Hammer', 'Shot']
const isThrowsDiscipline = (d) => THROWS.some(t => d?.toLowerCase().includes(t.toLowerCase()))
const formatMark = (value, discipline) => {
  if (value == null) return '—'
  if (isThrowsDiscipline(discipline)) return `${Number(value).toFixed(2)}m`
  const v = Number(value)
  const mins = Math.floor(v / 60)
  const secs = (v % 60).toFixed(2)
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}s`
}
const calcAge = (dob) => {
  if (!dob) return null
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}

// ═══════════════════════════════════════════════════════════════════════
// ATHLETE DASHBOARD — mobile-first read-only v1
// ═══════════════════════════════════════════════════════════════════════
export default function AthleteDashboard({ user, profile, onSignOut }) {
  const [athleteRow, setAthleteRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [activeDiscipline, setActiveDiscipline] = useState(null)

  // ── Load athlete_profiles row ───────────────────────────────────────
  const loadAthlete = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError('')
    try {
      const rows = await selectFrom('athlete_profiles', {
        filter: `id=eq.${user.id}`,
      })
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

      // Compute PB
      let pbVal = null
      for (const r of races) {
        if (r.value == null) continue
        if (pbVal == null || (isThrows ? r.value > pbVal : r.value < pbVal)) pbVal = r.value
      }

      // Last result
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

  // ── Derived data for the active discipline ─────────────────────────
  const view = useMemo(() => {
    if (!athleteRow) return null
    const discipline = activeDiscipline || athleteRow.discipline
    const isThrows = isThrowsDiscipline(discipline)
    const allRaces = athleteRow.races || []
    const disciplinesData = athleteRow.disciplines_data || {}
    // Prefer per-discipline data when available
    const races = disciplinesData[discipline] || allRaces

    // PB across this discipline
    let pb = null
    for (const r of races) {
      if (r.value == null) continue
      if (pb == null || (isThrows ? r.value > pb : r.value < pb)) pb = r.value
    }

    // Sort by date ascending for the chart
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

    // Trend over last 3 results
    let trend = 'stable'
    if (sortedDesc.length >= 2) {
      const a = sortedDesc[0].value
      const b = sortedDesc[Math.min(2, sortedDesc.length - 1)].value
      if (isThrows ? a > b : a < b) trend = 'up'
      else if (isThrows ? a < b : a > b) trend = 'down'
    }

    // Next milestone — round PB up to a nice number
    let nextMilestone = null
    if (pb != null) {
      if (isThrows) {
        // Next whole metre, or next 0.5m if already very close
        const nextWhole = Math.ceil(pb + 0.01)
        nextMilestone = nextWhole - pb < 0.3 ? nextWhole + 1 : nextWhole
      } else {
        // Sub-X seconds: round down to next .00 or .50
        const sub = Math.floor(pb * 2) / 2
        nextMilestone = sub < pb ? sub : sub - 0.5
      }
    }

    return {
      discipline,
      isThrows,
      races,
      pb,
      lastRace: sortedDesc[0],
      sortedDesc,
      chartData,
      trend,
      nextMilestone,
      raceCount: races.length,
    }
  }, [athleteRow, activeDiscipline])

  // ── Loading state ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your data...</p>
        </div>
      </div>
    )
  }

  // ── Header (shared by all states) ───────────────────────────────────
  const Header = () => (
    <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-emerald-400 font-bold text-sm">
              {(profile?.full_name || user?.email || 'A')[0].toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{profile?.full_name || 'Athlete'}</p>
            <p className="text-gray-500 text-xs truncate">{view?.discipline || 'No event yet'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {athleteRow?.world_athletics_url && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-40"
              title="Refresh from World Athletics"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={onSignOut}
            className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )

  // ── Empty state ─────────────────────────────────────────────────────
  if (!view || view.raceCount === 0) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Activity className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">No performance data yet</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
              {athleteRow?.world_athletics_url
                ? 'We have your World Athletics URL on file but no results loaded yet. Tap refresh to pull them in.'
                : 'Add your World Athletics profile URL on your account to see your full career trajectory.'}
            </p>
            {athleteRow?.world_athletics_url ? (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Loading...' : 'Pull from World Athletics'}
              </button>
            ) : (
              <p className="text-xs text-gray-500">Manual entry coming soon.</p>
            )}
            {error && (
              <div className="mt-4 inline-flex items-center gap-2 text-red-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  // ── Main dashboard ──────────────────────────────────────────────────
  const TrendIcon = view.trend === 'up' ? TrendingUp : view.trend === 'down' ? TrendingDown : Minus
  // For throws, "up" is good; for sprints, "down" (faster) is good
  const trendIsGood = view.isThrows
    ? view.trend === 'up'
    : view.trend === 'down'
  const trendColor = view.trend === 'stable'
    ? 'text-gray-400'
    : trendIsGood ? 'text-emerald-400' : 'text-red-400'

  // Y-axis: for sprints we want lower = better, so reverse domain
  const yDomain = view.isThrows
    ? ['auto', 'auto']
    : ['auto', 'auto']

  // Multi-discipline switcher
  const allDisciplines = athleteRow.disciplines || (athleteRow.disciplines_data ? Object.keys(athleteRow.disciplines_data) : [])

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-12">
      <Header />

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

        {/* Discipline switcher (only if multiple) */}
        {allDisciplines.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {allDisciplines.map(d => (
              <button
                key={d}
                onClick={() => setActiveDiscipline(d)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  d === view.discipline
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        {/* Hero — PB + trend + next milestone */}
        <section className="bg-gradient-to-br from-emerald-500/10 via-gray-900 to-gray-900 border border-emerald-500/20 rounded-2xl p-5">
          <p className="text-emerald-400/80 text-xs uppercase tracking-wider mb-1">Personal Best</p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-4xl font-bold">{formatMark(view.pb, view.discipline)}</h1>
            <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
              <TrendIcon className="w-4 h-4" />
              <span className="font-medium">
                {view.trend === 'up' ? 'Trending up' : view.trend === 'down' ? 'Trending down' : 'Steady'}
              </span>
            </div>
          </div>
          {view.nextMilestone != null && (
            <div className="mt-4 pt-4 border-t border-emerald-500/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Target className="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Next milestone</p>
                <p className="text-sm font-medium text-white">
                  {formatMark(view.nextMilestone, view.discipline)}
                  <span className="text-gray-500 ml-2 text-xs">
                    {view.isThrows
                      ? `(+${(view.nextMilestone - view.pb).toFixed(2)}m)`
                      : `(${(view.pb - view.nextMilestone).toFixed(2)}s faster)`}
                  </span>
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Trajectory chart */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-semibold text-white">Trajectory</h2>
            <p className="text-xs text-gray-500">{view.chartData.length} results</p>
          </div>
          <div className="h-56 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={view.chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="trajFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#6b7280"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  domain={yDomain}
                  reversed={!view.isThrows}
                  width={36}
                  tickFormatter={(v) => view.isThrows ? `${v.toFixed(0)}` : `${v.toFixed(1)}`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0a0a0a',
                    border: '1px solid #1f2937',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(v) => [formatMark(v, view.discipline), '']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="none"
                  fill="url(#trajFill)"
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 3 }}
                  activeDot={{ r: 5 }}
                />
                {view.pb != null && (
                  <ReferenceLine
                    y={view.pb}
                    stroke="#fbbf24"
                    strokeDasharray="3 3"
                    label={{ value: 'PB', fill: '#fbbf24', fontSize: 10, position: 'right' }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Recent results */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recent results</h2>
            <Calendar className="w-4 h-4 text-gray-500" />
          </div>
          <div className="divide-y divide-gray-800">
            {view.sortedDesc.slice(0, 8).map((r, i) => {
              const isPB = r.value === view.pb
              return (
                <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">
                      {r.competition || 'Competition'}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${isPB ? 'text-amber-400' : 'text-white'}`}>
                      {formatMark(r.value, view.discipline)}
                    </p>
                    {isPB && <p className="text-amber-400/80 text-[10px] uppercase tracking-wider">PB</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Sync metadata */}
        {athleteRow.last_synced_at && (
          <p className="text-center text-xs text-gray-600 pt-2">
            Last synced {new Date(athleteRow.last_synced_at).toLocaleString('en-GB', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            })}
          </p>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}
      </main>
    </div>
  )
}

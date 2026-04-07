import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Users, UserPlus, TrendingUp, Activity, Upload, Link, Search,
  ChevronRight, ChevronLeft, ArrowUpRight, AlertTriangle, Target,
  Calendar, Plus, X, FileSpreadsheet, Globe, Bot, Send, Paperclip,
  Eye, Clock, Zap, ChevronDown, Loader2, CheckCircle, AlertCircle, Trash2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { selectFrom, insertInto, deleteFrom } from '../../lib/supabaseRest'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://web-production-295f1.up.railway.app'

// Discipline type helpers
const THROWS = ['Discus Throw', 'Shot Put', 'Javelin Throw', 'Hammer Throw', 'Discus', 'Javelin', 'Hammer', 'Shot']
const isThrowsDiscipline = (d) => THROWS.some(t => d?.toLowerCase().includes(t.toLowerCase()))
const formatMark = (value, discipline) => {
  if (!value) return '—'
  if (isThrowsDiscipline(discipline)) return `${value.toFixed(2)}m`
  // Format seconds as time
  const mins = Math.floor(value / 60)
  const secs = (value % 60).toFixed(2)
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}s`
}
const calcAge = (dob) => {
  if (!dob) return null
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}

// ═══════════════════════════════════════════════════════════════════
// COACH DASHBOARD
// ═══════════════════════════════════════════════════════════════════

export default function CoachDashboard({ user, profile, onBack, onViewAthlete }) {
  const [activeSection, setActiveSection] = useState('highlights')
  const [addMethod, setAddMethod] = useState(null)
  const [urlInput, setUrlInput] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlProgress, setUrlProgress] = useState('')
  const [urlError, setUrlError] = useState('')
  const [csvFile, setCsvFile] = useState(null)
  const [csvPreview, setCsvPreview] = useState(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTier, setFilterTier] = useState('all')
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hi Coach — upload a competition PDF and I\'ll scan it for your athletes\' results. I handle English and Arabic documents.' }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatFile, setChatFile] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [roster, setRoster] = useState([])
  const [rosterLoading, setRosterLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const fileInputRef = useRef(null)
  const chatEndRef = useRef(null)

  useEffect(() => { requestAnimationFrame(() => setMounted(true)) }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  // ── Fetch roster from Supabase (raw fetch — bypasses supabase-js Web Locks hang) ──
  const fetchRoster = useCallback(async () => {
    if (!user?.id) return
    setRosterLoading(true)
    try {
      console.log('[roster] Fetching for coach:', user.id)
      const data = await selectFrom('coach_roster', {
        filter: `coach_id=eq.${user.id}`,
        order: 'created_at.desc',
      })
      console.log('[roster] Fetched', data?.length || 0, 'athletes')
      setRoster(data || [])
    } catch (err) {
      console.error('[roster] Failed to fetch:', err)
    } finally {
      setRosterLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchRoster() }, [fetchRoster])

  // ── Derived data ──
  const rosterWithAge = roster.map(a => ({ ...a, age: calcAge(a.dob) }))
  const displayRoster = rosterWithAge
    .filter(a => filterTier === 'all' || a.tier === filterTier)
    .filter(a => !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase()) || (a.discipline || '').toLowerCase().includes(searchQuery.toLowerCase()))

  // Stats
  const trendingUp = rosterWithAge.filter(a => a.trend === 'up').length
  const trendingDown = rosterWithAge.filter(a => a.trend === 'down').length
  const tierCounts = rosterWithAge.reduce((acc, a) => {
    const t = a.tier || 'developing'
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})
  const totalSessions = rosterWithAge.reduce((s, a) => s + (a.races?.length || 0), 0)

  // ── Handlers ──
  const handleCsvUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = ev.target.result.split('\n').filter(l => l.trim())
      const headers = lines[0].split(',').map(h => h.trim())
      const rows = lines.slice(1, 6).map(line => {
        const vals = line.split(',').map(v => v.trim())
        const row = {}
        headers.forEach((h, i) => { row[h] = vals[i] || '' })
        return row
      })
      setCsvPreview({ headers, rows, totalRows: lines.length - 1 })
    }
    reader.readAsText(file)
  }

  const handleCsvConfirm = async () => {
    setCsvUploading(true)
    await new Promise(r => setTimeout(r, 2000))
    setCsvUploading(false); setCsvFile(null); setCsvPreview(null); setAddMethod(null); setActiveSection('roster')
  }

  const handleDeleteAthlete = async (athleteId) => {
    try {
      await deleteFrom('coach_roster', `id=eq.${athleteId}`)
      setRoster(prev => prev.filter(a => a.id !== athleteId))
      setDeleteConfirm(null)
    } catch (err) {
      console.error('[roster] Delete failed:', err)
    }
  }

  const handleUrlImport = async () => {
    if (!urlInput.trim()) return
    const url = urlInput.trim()

    // Validate URL
    if (!url.includes('worldathletics.org')) {
      setUrlError('Please enter a valid World Athletics profile URL')
      return
    }

    setUrlLoading(true)
    setUrlProgress('Connecting to scraper...')
    setUrlError('')

    try {
      // 90s timeout for the scrape+analysis
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 90000)

      let response
      try {
        setUrlProgress('Scraping athlete profile — this can take up to 60 seconds...')
        response = await fetch(`${API_BASE}/api/v1/analyze/url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }

      setUrlProgress('Got response, reading data...')

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `Server error ${response.status}`)
      }

      const result = await response.json()
      setUrlProgress('Parsing athlete info...')

      if (!result.success) throw new Error('Analysis returned unsuccessful')

      const analysisData = result.data || {}
      const athleteName = result.athlete_name || 'Unknown Athlete'

      // Use the _scraped data embedded in the response (raw scraped info)
      const scraped = analysisData._scraped || {}
      const discipline = scraped.discipline || analysisData.discipline || null
      const gender = scraped.gender || analysisData.gender || null
      const isThrows = isThrowsDiscipline(discipline)
      const dob = scraped.dob || null

      // Get races from the scraped data
      const races = (scraped.races || []).map(r => ({
        date: r.date || null,
        value: r.value || null,
        competition: r.competition || null,
        wind: r.wind || null,
        implement_weight_kg: r.implement_weight_kg || null,
      }))

      // Compute PB from races
      let pbNumeric = null
      for (const race of races) {
        if (race.value == null) continue
        if (pbNumeric == null || (isThrows ? race.value > pbNumeric : race.value < pbNumeric)) {
          pbNumeric = race.value
        }
      }

      // Get last result
      const sortedRaces = races.filter(r => r.date && r.value).sort((a, b) => new Date(b.date) - new Date(a.date))
      const lastRace = sortedRaces[0]
      const lastVal = lastRace?.value || null

      // Compute trend
      let trend = 'stable'
      if (sortedRaces.length >= 3) {
        const recent = sortedRaces.slice(0, 3).map(r => r.value).filter(Boolean)
        if (recent.length >= 2) {
          const improving = isThrows ? recent[0] > recent[recent.length - 1] : recent[0] < recent[recent.length - 1]
          const declining = isThrows ? recent[0] < recent[recent.length - 1] : recent[0] > recent[recent.length - 1]
          if (improving) trend = 'up'
          else if (declining) trend = 'down'
        }
      }

      setUrlProgress(`Saving ${athleteName} to roster...`)

      const disciplinesData = scraped.disciplines_data || { [discipline]: races }
      const supportedDisciplines = scraped.supported_disciplines || Object.keys(disciplinesData)

      const newAthlete = {
        coach_id: user.id,
        name: athleteName,
        dob: dob || null,
        gender: gender,
        discipline: discipline,
        disciplines: supportedDisciplines,
        disciplines_data: disciplinesData,
        nationality: scraped.nationality || null,
        pb: pbNumeric ? formatMark(pbNumeric, discipline) : null,
        pb_value: pbNumeric,
        last_result: lastVal ? formatMark(lastVal, discipline) : null,
        last_result_value: lastVal,
        last_date: lastRace?.date || null,
        trend,
        tier: 'developing',
        world_athletics_url: url,
        races: races,
      }

      console.log('[roster] Inserting athlete:', athleteName, 'races:', races.length)
      const inserted = await insertInto('coach_roster', newAthlete)
      console.log('[roster] Insert succeeded:', inserted?.id)

      if (inserted?.id) {
        setRoster(prev => [inserted, ...prev])
      } else {
        setRoster(prev => [{ ...newAthlete, id: crypto.randomUUID(), created_at: new Date().toISOString() }, ...prev])
      }

      setUrlInput('')
      setUrlProgress('')
      setUrlLoading(false)
      setAddMethod(null)
      setActiveSection('roster')
    } catch (err) {
      console.error('URL import failed:', err)
      const msg = err.name === 'AbortError'
        ? 'Request timed out — the scraper may be overloaded. Try again.'
        : (err.message || 'Import failed — check the URL and try again')
      setUrlError(msg)
      setUrlLoading(false)
      setUrlProgress('')
    }
  }

  const handleChatSend = () => {
    if (!chatInput.trim() && !chatFile) return
    setChatMessages(prev => [...prev, { role: 'user', content: chatInput || `📎 ${chatFile?.name}`, file: chatFile?.name }])
    setChatInput(''); setChatFile(null)
    setTimeout(() => {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'This feature is coming soon — I\'ll be able to scan competition PDFs and match results to your roster automatically. Stay tuned!' }])
    }, 1200)
  }

  // ── Shared components ──
  const tierConfig = {
    finalist: { color: '#fbbf24', label: 'Finalist' },
    'semi-finalist': { color: '#3b82f6', label: 'Semi-Finalist' },
    qualifier: { color: '#8b5cf6', label: 'Qualifier' },
    developing: { color: '#64748b', label: 'Developing' },
  }

  const TierDot = ({ tier, size = 6 }) => (
    <div className="rounded-full" style={{ width: size, height: size, background: tierConfig[tier]?.color || '#64748b' }} />
  )

  const stagger = (i) => mounted ? { opacity: 1, transform: 'translateY(0)', transition: `all 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s` } : { opacity: 0, transform: 'translateY(12px)' }

  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(170deg, #020617 0%, #0c1222 40%, #0a0f1c 100%)' }}>

      {/* ── Ambient glow ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute -top-[300px] -right-[200px] w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.04) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-[200px] -left-[200px] w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.03) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10">
        {/* ── Top bar ── */}
        <header className="sticky top-0 z-50" style={{ background: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(24px) saturate(1.4)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="max-w-7xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-white hover:bg-white/5 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}>
                  <span className="text-[10px] font-black text-black">b.</span>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white leading-none landing-font">Dashboard</p>
                  <p className="text-[10px] text-slate-600 leading-none mt-0.5 mono-font">{profile?.full_name || user?.email}</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => { setAddMethod(null); setActiveSection('add') }}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[11px] font-bold text-black transition-all hover:brightness-110 landing-font"
              style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}
            >
              <Plus className="w-3 h-3" strokeWidth={3} />
              Add Athletes
            </button>
          </div>
        </header>

        {/* ── Section tabs ── */}
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-5 pb-1">
          <div className="flex gap-0.5">
            {[
              { key: 'highlights', label: 'Highlights', icon: Zap },
              { key: 'roster', label: 'Roster', icon: Users },
              { key: 'add', label: 'Add Athletes', icon: UserPlus },
              { key: 'assistant', label: 'AI Scanner', icon: Bot },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setActiveSection(key); if (key === 'add') setAddMethod(null) }}
                className="relative flex items-center gap-1.5 px-4 py-2.5 text-[11px] sm:text-[12px] font-semibold transition-all landing-font"
                style={{
                  color: activeSection === key ? '#f97316' : '#475569',
                  borderBottom: activeSection === key ? '2px solid #f97316' : '2px solid transparent',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
          <div className="h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </div>

        {/* ── Content ── */}
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6">

          {/* ═══════════════ HIGHLIGHTS ═══════════════ */}
          {activeSection === 'highlights' && (
            <div className="space-y-5">
              {/* Hero stat row */}
              <div className="grid grid-cols-4 gap-3" style={stagger(0)}>
                {[
                  { value: rosterWithAge.length, label: 'Athletes', sub: 'in roster', color: '#f97316' },
                  { value: trendingUp, label: 'Improving', sub: 'this month', color: '#22c55e' },
                  { value: trendingDown, label: 'Declining', sub: 'needs review', color: '#ef4444' },
                  { value: totalSessions, label: 'Races', sub: 'total logged', color: '#3b82f6' },
                ].map((kpi, i) => (
                  <div key={i} className="relative overflow-hidden rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="absolute top-0 right-0 w-16 h-16 rounded-full" style={{ background: `radial-gradient(circle, ${kpi.color}08 0%, transparent 70%)`, transform: 'translate(30%, -30%)' }} />
                    <p className="text-3xl font-bold text-white mono-font leading-none">{kpi.value}</p>
                    <p className="text-[11px] font-semibold mt-1.5 landing-font" style={{ color: kpi.color }}>{kpi.label}</p>
                    <p className="text-[10px] text-slate-600 landing-font">{kpi.sub}</p>
                  </div>
                ))}
              </div>

              {/* Classification breakdown — horizontal bar */}
              <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', ...stagger(1) }}>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-4 landing-font">Squad Classification</p>
                <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {Object.entries(tierCounts).map(([tier, count]) => (
                    <div key={tier} className="rounded-full transition-all" style={{
                      width: `${rosterWithAge.length ? (count / rosterWithAge.length) * 100 : 0}%`,
                      background: tierConfig[tier]?.color,
                      opacity: 0.8,
                    }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  {Object.entries(tierCounts).map(([tier, count]) => (
                    <div key={tier} className="flex items-center gap-1.5">
                      <TierDot tier={tier} />
                      <span className="text-[11px] text-slate-500 landing-font">{tierConfig[tier]?.label}</span>
                      <span className="text-[11px] font-bold mono-font" style={{ color: tierConfig[tier]?.color }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Two-column: Alerts + Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Performance Alerts */}
                <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', ...stagger(2) }}>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3 landing-font">Performance Alerts</p>
                  <div className="space-y-2">
                    {rosterWithAge.filter(a => a.trend !== 'stable').length === 0 && (
                      <p className="text-[11px] text-slate-700 landing-font py-4 text-center">No alerts yet — add athletes to start tracking</p>
                    )}
                    {rosterWithAge.filter(a => a.trend !== 'stable').map((a, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg transition-all hover:bg-white/[0.02]" style={{ border: '1px solid rgba(255,255,255,0.03)' }}>
                        <div className={`w-1.5 h-8 rounded-full ${a.trend === 'up' ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ opacity: 0.7 }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] text-white font-medium landing-font truncate">{a.name}</p>
                            <TierDot tier={a.tier} size={5} />
                          </div>
                          <p className="text-[10px] text-slate-600 landing-font">{a.discipline} · {a.trend === 'up' ? 'Improving' : 'Declining'} · Last: {a.last_result || '—'}</p>
                        </div>
                        <ArrowUpRight className={`w-3.5 h-3.5 flex-shrink-0 ${a.trend === 'up' ? 'text-emerald-500' : 'text-red-500 rotate-90'}`} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', ...stagger(3) }}>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3 landing-font">Recent Results</p>
                  <div className="space-y-0">
                    {rosterWithAge.length === 0 && (
                      <p className="text-[11px] text-slate-700 landing-font py-4 text-center">No results yet</p>
                    )}
                    {[...rosterWithAge].filter(a => a.last_date).sort((a, b) => new Date(b.last_date) - new Date(a.last_date)).map((a, i) => (
                      <div key={i} className="flex items-center gap-3 py-2.5" style={{ borderBottom: i < rosterWithAge.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold mono-font" style={{ background: 'rgba(255,255,255,0.04)', color: tierConfig[a.tier]?.color }}>
                          {a.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-white landing-font">{a.name}</p>
                          <p className="text-[10px] text-slate-600 mono-font">{a.discipline}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[12px] font-bold text-white mono-font">{a.last_result || '—'}</p>
                          <p className="text-[9px] text-slate-600 mono-font">{a.last_date ? new Date(a.last_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ ROSTER ═══════════════ */}
          {activeSection === 'roster' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3" style={stagger(0)}>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                  <input
                    type="text" placeholder="Search athletes..."
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg text-[12px] text-white placeholder-slate-700 landing-font focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  />
                </div>
                <div className="flex gap-1">
                  {['all', 'finalist', 'semi-finalist', 'qualifier', 'developing'].map(tier => (
                    <button key={tier} onClick={() => setFilterTier(tier)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all mono-font ${filterTier === tier ? 'text-white' : 'text-slate-700 hover:text-slate-500'}`}
                      style={filterTier === tier ? { background: 'rgba(255,255,255,0.08)' } : {}}>
                      {tier === 'all' ? 'All' : tierConfig[tier]?.label}
                    </button>
                  ))}
                </div>
              </div>

              {rosterLoading ? (
                <div className="text-center py-20">
                  <Loader2 className="w-6 h-6 mx-auto mb-2 text-slate-600 animate-spin" />
                  <p className="text-[11px] text-slate-700 landing-font">Loading roster...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayRoster.map((a, i) => (
                    <div key={a.id} className="group relative rounded-xl p-4 cursor-pointer transition-all hover:translate-y-[-2px]"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', ...stagger(i + 1) }}
                      onClick={() => onViewAthlete?.(a)}>
                      {/* Delete button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(deleteConfirm === a.id ? null : a.id) }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-slate-700 hover:text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      {deleteConfirm === a.id && (
                        <div className="absolute top-9 right-2 z-20 rounded-lg p-2.5 shadow-xl" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
                          <p className="text-[10px] text-slate-400 mb-2 landing-font">Remove from roster?</p>
                          <div className="flex gap-1.5">
                            <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 rounded text-[10px] text-slate-500 landing-font" style={{ background: 'rgba(255,255,255,0.05)' }}>Cancel</button>
                            <button onClick={() => handleDeleteAthlete(a.id)} className="px-2 py-1 rounded text-[10px] font-bold text-white landing-font bg-red-600 hover:bg-red-500">Remove</button>
                          </div>
                        </div>
                      )}
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold mono-font" style={{ background: `${tierConfig[a.tier]?.color || '#64748b'}12`, color: tierConfig[a.tier]?.color || '#64748b' }}>
                              {a.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: '#0f172a', border: '2px solid #0f172a' }}>
                              <div className={`w-2 h-2 rounded-full ${a.trend === 'up' ? 'bg-emerald-500' : a.trend === 'down' ? 'bg-red-500' : 'bg-slate-600'}`} />
                            </div>
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-white landing-font group-hover:text-orange-400 transition-colors">{a.name}</p>
                            <p className="text-[10px] text-slate-600 landing-font">{a.gender || '?'} · {a.age != null ? `${a.age}y` : '—'}</p>
                          </div>
                        </div>
                      </div>
                      {/* Discipline chips */}
                      {Array.isArray(a.disciplines) && a.disciplines.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2" onClick={e => e.stopPropagation()}>
                          {a.disciplines.map(d => (
                            <button
                              key={d}
                              onClick={() => onViewAthlete?.({ ...a, discipline: d })}
                              className={`px-1.5 py-0.5 rounded text-[9px] mono-font transition-colors ${d === a.discipline ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'}`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      )}
                      {!Array.isArray(a.disciplines) && (
                        <p className="text-[10px] text-slate-600 landing-font mb-2">{a.discipline || '—'}</p>
                      )}
                      {/* Stats */}
                      <div className="flex gap-2 mb-3">
                        <div className="flex-1 rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <p className="text-[14px] font-bold text-white mono-font">{a.pb || '—'}</p>
                          <p className="text-[8px] text-slate-600 uppercase tracking-wider landing-font">PB</p>
                        </div>
                        <div className="flex-1 rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <p className="text-[14px] font-bold text-slate-400 mono-font">{a.last_result || '—'}</p>
                          <p className="text-[8px] text-slate-600 uppercase tracking-wider landing-font">Last</p>
                        </div>
                      </div>
                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <TierDot tier={a.tier} />
                          <span className="text-[10px] landing-font" style={{ color: tierConfig[a.tier]?.color || '#64748b' }}>{tierConfig[a.tier]?.label || 'Developing'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {a.races?.length > 0 && <span className="text-[9px] text-slate-700 mono-font">{a.races.length} races</span>}
                          <span className="text-[10px] text-slate-700 group-hover:text-orange-500 transition-colors landing-font flex items-center gap-0.5">
                            View <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!rosterLoading && displayRoster.length === 0 && (
                <div className="text-center py-20">
                  <Users className="w-8 h-8 mx-auto mb-2 text-slate-800" />
                  <p className="text-[12px] text-slate-700 landing-font">{roster.length === 0 ? 'No athletes in your roster yet — add one to get started' : 'No athletes match your search'}</p>
                  {roster.length === 0 && (
                    <button onClick={() => { setActiveSection('add'); setAddMethod('url') }} className="mt-3 text-[11px] font-bold text-orange-500 hover:text-orange-400 landing-font">+ Import from World Athletics</button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ ADD ATHLETES ═══════════════ */}
          {activeSection === 'add' && (
            <div className="space-y-5">
              {!addMethod ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key: 'url', icon: Globe, title: 'World Athletics', desc: 'Paste a profile URL — we\'ll import their full history, PBs, and progressions automatically.', color: '#22c55e', tag: 'Recommended' },
                    { key: 'csv', icon: FileSpreadsheet, title: 'Bulk Upload', desc: 'Upload a CSV or Excel with athlete names and dates of birth to onboard your whole squad at once.', color: '#3b82f6', tag: null },
                    { key: 'manual', icon: UserPlus, title: 'Manual Entry', desc: 'Add a single athlete by hand — name, DOB, discipline, and personal best.', color: '#f97316', tag: null },
                  ].map(({ key, icon: Icon, title, desc, color, tag }, i) => (
                    <button key={key} onClick={() => setAddMethod(key)}
                      className="relative rounded-xl p-5 text-left transition-all group hover:translate-y-[-2px]"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', ...stagger(i) }}>
                      {tag && <span className="absolute top-3 right-3 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>{tag}</span>}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}10` }}>
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <h3 className="text-[14px] font-bold text-white mb-1 landing-font group-hover:text-orange-400 transition-colors">{title}</h3>
                      <p className="text-[11px] text-slate-600 leading-relaxed landing-font">{desc}</p>
                    </button>
                  ))}
                </div>
              ) : addMethod === 'url' ? (
                /* URL Import */
                <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', ...stagger(0) }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-emerald-500" />
                      <h3 className="text-[12px] font-semibold text-white uppercase tracking-wider landing-font">Import from World Athletics</h3>
                    </div>
                    <button onClick={() => { setAddMethod(null); setUrlInput('') }} className="text-slate-700 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                  <p className="text-[11px] text-slate-600 mb-4 landing-font">Paste an athlete profile URL below. We'll import their full competition history automatically.</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                      <input type="url" placeholder="https://worldathletics.org/athletes/..." value={urlInput} onChange={(e) => { setUrlInput(e.target.value); setUrlError('') }}
                        className="w-full pl-9 pr-4 py-2.5 rounded-lg text-[12px] text-white placeholder-slate-700 landing-font focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                        style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${urlError ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}` }}
                        onKeyDown={(e) => e.key === 'Enter' && !urlLoading && handleUrlImport()}
                        disabled={urlLoading} />
                    </div>
                    <button onClick={handleUrlImport} disabled={urlLoading || !urlInput.trim()}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[11px] font-bold text-black landing-font disabled:opacity-30 transition-all hover:brightness-110"
                      style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                      {urlLoading ? <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <><Globe className="w-3.5 h-3.5" />Import</>}
                    </button>
                  </div>
                  {urlProgress && (
                    <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
                      <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin flex-shrink-0" />
                      <p className="text-[11px] text-emerald-400 landing-font">{urlProgress}</p>
                    </div>
                  )}
                  {urlError && (
                    <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      <p className="text-[11px] text-red-400 landing-font">{urlError}</p>
                    </div>
                  )}
                </div>
              ) : addMethod === 'csv' ? (
                /* CSV Upload */
                <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', ...stagger(0) }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                      <h3 className="text-[12px] font-semibold text-white uppercase tracking-wider landing-font">Bulk Upload</h3>
                    </div>
                    <button onClick={() => { setAddMethod(null); setCsvFile(null); setCsvPreview(null) }} className="text-slate-700 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                  {!csvPreview ? (
                    <div onClick={() => fileInputRef.current?.click()}
                      className="border border-dashed border-slate-800 hover:border-blue-500/30 rounded-xl p-10 text-center cursor-pointer transition-all group">
                      <Upload className="w-6 h-6 mx-auto mb-2 text-slate-700 group-hover:text-blue-500 transition-colors" />
                      <p className="text-[12px] text-slate-500 landing-font mb-0.5">Drop CSV or Excel here</p>
                      <p className="text-[10px] text-slate-700 landing-font">Required: Name, Date of Birth · Optional: Discipline, Gender, PB</p>
                      <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleCsvUpload} className="hidden" />
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[11px] text-blue-300 landing-font flex-1">{csvFile.name}</span>
                        <span className="text-[11px] font-bold text-blue-400 mono-font">{csvPreview.totalRows} athletes</span>
                      </div>
                      <div className="overflow-x-auto mb-4 rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
                        <table className="w-full text-[11px]">
                          <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                            {csvPreview.headers.map((h, i) => <th key={i} className="text-left py-2 px-3 text-[9px] text-slate-600 uppercase tracking-wider landing-font">{h}</th>)}
                          </tr></thead>
                          <tbody>{csvPreview.rows.map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              {csvPreview.headers.map((h, j) => <td key={j} className="py-2 px-3 text-slate-400 mono-font">{row[h]}</td>)}
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setCsvFile(null); setCsvPreview(null) }} className="px-4 py-2 rounded-lg text-[11px] text-slate-500 landing-font" style={{ background: 'rgba(255,255,255,0.03)' }}>Cancel</button>
                        <button onClick={handleCsvConfirm} disabled={csvUploading}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold text-black landing-font"
                          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                          {csvUploading ? <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <><Upload className="w-3.5 h-3.5" />Import {csvPreview.totalRows} Athletes</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Manual Entry */
                <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', ...stagger(0) }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-orange-400" />
                      <h3 className="text-[12px] font-semibold text-white uppercase tracking-wider landing-font">Manual Entry</h3>
                    </div>
                    <button onClick={() => setAddMethod(null)} className="text-slate-700 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: 'Full Name', type: 'text', placeholder: 'Athlete name' },
                      { label: 'Date of Birth', type: 'date', placeholder: '' },
                    ].map((f, i) => (
                      <div key={i}>
                        <label className="block text-[10px] text-slate-600 mb-1 landing-font">{f.label} *</label>
                        <input type={f.type} placeholder={f.placeholder} className="w-full px-3 py-2 rounded-lg text-[12px] text-white placeholder-slate-700 landing-font focus:outline-none focus:ring-1 focus:ring-orange-500/30" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
                      </div>
                    ))}
                    <div>
                      <label className="block text-[10px] text-slate-600 mb-1 landing-font">Discipline *</label>
                      <select className="w-full px-3 py-2 rounded-lg text-[12px] text-white landing-font focus:outline-none" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <option value="">Select</option>
                        {['100m','200m','400m','110m Hurdles','100m Hurdles','400m Hurdles','Discus Throw','Shot Put','Javelin Throw','Hammer Throw'].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 mb-1 landing-font">Gender *</label>
                      <select className="w-full px-3 py-2 rounded-lg text-[12px] text-white landing-font focus:outline-none" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <option value="">Select</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 mb-1 landing-font">Personal Best</label>
                      <input type="text" placeholder="e.g. 10.85 or 65.40" className="w-full px-3 py-2 rounded-lg text-[12px] text-white placeholder-slate-700 landing-font focus:outline-none focus:ring-1 focus:ring-orange-500/30" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 mb-1 landing-font">Nationality</label>
                      <input type="text" placeholder="e.g. UAE" className="w-full px-3 py-2 rounded-lg text-[12px] text-white placeholder-slate-700 landing-font focus:outline-none focus:ring-1 focus:ring-orange-500/30" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
                    </div>
                  </div>
                  <button className="mt-4 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-bold text-black landing-font hover:brightness-110 transition-all" style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}>
                    <Plus className="w-3.5 h-3.5" strokeWidth={3} />Add to Roster
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ AI ASSISTANT ═══════════════ */}
          {activeSection === 'assistant' && (
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', ...stagger(0) }}>
              {/* Header */}
              <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)' }}>
                  <Bot className="w-4 h-4 text-black" />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-semibold text-white landing-font">Results Scanner</p>
                  <p className="text-[9px] text-slate-600 landing-font">Upload competition PDFs — English & Arabic supported</p>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider" style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>Beta</span>
              </div>

              {/* Messages */}
              <div className="p-5 space-y-3 min-h-[380px] max-h-[460px] overflow-y-auto">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-xl px-3.5 py-2.5 ${msg.role === 'user' ? '' : ''}`}
                      style={{ background: msg.role === 'user' ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${msg.role === 'user' ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)'}` }}>
                      {msg.file && (
                        <div className="flex items-center gap-1.5 mb-1.5 px-2 py-1 rounded-md" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <Paperclip className="w-3 h-3 text-slate-500" />
                          <span className="text-[10px] text-slate-400 mono-font">{msg.file}</span>
                        </div>
                      )}
                      <p className="text-[12px] text-slate-300 leading-relaxed landing-font">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                {chatFile && (
                  <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.12)' }}>
                    <Paperclip className="w-3 h-3 text-orange-500" />
                    <span className="text-[10px] text-orange-400 mono-font flex-1">{chatFile.name}</span>
                    <button onClick={() => setChatFile(null)} className="text-orange-500 hover:text-white"><X className="w-3 h-3" /></button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.pdf,.png,.jpg'; input.onchange = (e) => setChatFile(e.target.files[0]); input.click() }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-white hover:bg-white/5 transition-all" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Paperclip className="w-3.5 h-3.5" />
                  </button>
                  <input type="text" placeholder="Ask about results or upload a PDF..." value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                    className="flex-1 px-3.5 py-2 rounded-lg text-[12px] text-white placeholder-slate-700 landing-font focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
                  <button onClick={handleChatSend} disabled={!chatInput.trim() && !chatFile}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-black disabled:opacity-20 transition-all"
                    style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

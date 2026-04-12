import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Users, UserPlus, TrendingUp, Activity, Upload, Link, Search,
  ChevronRight, ChevronLeft, ArrowUpRight, AlertTriangle, Target,
  Calendar, Plus, X, FileSpreadsheet, Globe, Bot, Send, Paperclip,
  Eye, Clock, Zap, ChevronDown, Loader2, CheckCircle, AlertCircle, Trash2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { selectFrom, insertInto, deleteFrom, updateIn } from '../../lib/supabaseRest'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://web-production-295f1.up.railway.app'

// AI Scanner is gated to Keenan during testing
const SCANNER_BETA_UUID = 'e4a344cd-1175-40f2-8b0d-94593eaedd53'

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

  // ── AI Scanner state ──
  const scannerEnabled = user?.id === SCANNER_BETA_UUID
  const [scanStage, setScanStage] = useState('input') // 'input' | 'review' | 'done'
  const [scanInputType, setScanInputType] = useState('text') // 'text' | 'pdf' | 'image'
  const [scanText, setScanText] = useState('')
  const [scanFile, setScanFile] = useState(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanCandidates, setScanCandidates] = useState([])
  const [scanAmbiguous, setScanAmbiguous] = useState([]) // [{extracted_name, possible_matches, result}]
  const [scanAmbigPicks, setScanAmbigPicks] = useState({}) // { [ambigIdx]: athleteId | 'skip' }
  const [scanStats, setScanStats] = useState(null)
  const [scanDroppedReasons, setScanDroppedReasons] = useState([])
  const [scanDebugOpen, setScanDebugOpen] = useState(false)
  const [scanSelections, setScanSelections] = useState({}) // { `${candidateIdx}:${resultIdx}`: true }
  const [scanSaving, setScanSaving] = useState(false)
  const [scanSavedCount, setScanSavedCount] = useState(0)

  const resetScanner = () => {
    setScanStage('input'); setScanText(''); setScanFile(null); setScanError('')
    setScanCandidates([]); setScanAmbiguous([]); setScanAmbigPicks({})
    setScanStats(null); setScanDroppedReasons([]); setScanDebugOpen(false)
    setScanSelections({}); setScanSavedCount(0)
  }

  const handleScanExtract = async () => {
    setScanError('')
    if (scanInputType === 'text' && !scanText.trim()) { setScanError('Paste some results text first.'); return }
    if ((scanInputType === 'pdf' || scanInputType === 'image') && !scanFile) { setScanError('Choose a file first.'); return }
    if (!roster.length) { setScanError('Your roster is empty — add athletes first.'); return }

    setScanLoading(true)
    try {
      const rosterPayload = roster.map(a => ({ id: a.id, name: a.name, discipline: a.discipline }))
      const form = new FormData()
      form.append('input_type', scanInputType)
      form.append('roster_json', JSON.stringify(rosterPayload))
      if (scanInputType === 'text') form.append('text', scanText)
      else form.append('file', scanFile)

      const res = await fetch(`${API_BASE}/api/v1/ai-scanner/extract`, { method: 'POST', body: form })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(`Scanner failed (${res.status}): ${t.slice(0, 200)}`)
      }
      const data = await res.json()
      setScanCandidates(data.candidates || [])
      setScanAmbiguous(data.ambiguous || [])
      setScanStats(data.stats || null)
      setScanDroppedReasons(data.dropped_reasons || [])
      // Pre-select all confident results by default
      const sel = {}
      ;(data.candidates || []).forEach((c, ci) => {
        (c.results || []).forEach((_, ri) => { sel[`${ci}:${ri}`] = true })
      })
      setScanSelections(sel)
      // No pre-pick on ambiguous — user must actively choose
      setScanAmbigPicks({})
      setScanStage('review')
    } catch (err) {
      console.error('[scanner] extract failed:', err)
      setScanError(err.message || 'Extraction failed')
    } finally {
      setScanLoading(false)
    }
  }

  const handleScanConfirm = async () => {
    setScanSaving(true)
    setScanError('')
    let saved = 0
    try {
      // Helper: build a race record in the canonical roster shape
      // (matches what the scraper + manual log produce so athlete views render it).
      const buildRace = (r, discipline) => ({
        date: r.date,
        value: r.value,
        competition: r.competition || null,
        wind: r.wind ?? null,
        discipline: discipline || r.event || null,
        source: 'ai_scanner',
      })

      // Aggregate all new races per athlete id (merging confident + resolved ambiguous)
      const perAthlete = {} // { [athleteId]: [{race, event}, ...] }

      // 1. Confident candidates — only selected results
      for (let ci = 0; ci < scanCandidates.length; ci++) {
        const cand = scanCandidates[ci]
        const picked = (cand.results || []).filter((_, ri) => scanSelections[`${ci}:${ri}`])
        if (!picked.length) continue
        const list = perAthlete[cand.roster_athlete_id] = perAthlete[cand.roster_athlete_id] || []
        const athleteDiscipline = cand.roster_athlete_discipline || null
        picked.forEach(r => list.push({ race: buildRace(r, athleteDiscipline || r.event), event: athleteDiscipline || r.event }))
      }

      // 2. Ambiguous — only those the user actively picked a real athlete for
      scanAmbiguous.forEach((amb, ai) => {
        const pick = scanAmbigPicks[ai]
        if (!pick || pick === 'skip') return
        const r = amb.result
        if (!r) return
        const list = perAthlete[pick] = perAthlete[pick] || []
        // Look up that athlete's discipline from the current roster
        const pickedAthlete = roster.find(a => a.id === pick)
        const athleteDiscipline = pickedAthlete?.discipline || r.event || null
        list.push({ race: buildRace(r, athleteDiscipline), event: athleteDiscipline })
      })

      // 3. Flush to Supabase — for each athlete, merge races, update disciplines_data,
      //    and recompute PB / last_result so the profile view updates immediately.
      const isThrowsDisc = (d) => !!d && /shot|discus|hammer|javelin|throw|put/i.test(d)

      // Pick the discipline bucket key that an athlete's existing disciplines_data
      // already uses — so new races append to the SAME bucket the athlete profile
      // view reads from, instead of creating an orphan bucket under the display name.
      const pickBucketKey = (athlete) => {
        const dd = athlete.disciplines_data || {}
        const keys = Object.keys(dd)
        if (athlete.discipline && keys.includes(athlete.discipline)) return athlete.discipline
        if (keys.length === 1) return keys[0]
        // No existing buckets — fall back to the athlete's discipline string
        return athlete.discipline || 'unknown'
      }

      for (const [athleteId, entries] of Object.entries(perAthlete)) {
        if (!entries.length) continue
        const athlete = roster.find(a => a.id === athleteId)
        if (!athlete) continue

        const bucketKey = pickBucketKey(athlete)
        const newRaces = entries.map(e => e.race)
        const existing = Array.isArray(athlete.races) ? athlete.races : []
        const mergedRaces = [...existing, ...newRaces]

        // Append new races to the SINGLE existing discipline bucket
        const disciplinesData = { ...(athlete.disciplines_data || {}) }
        const currentBucket = Array.isArray(disciplinesData[bucketKey]) ? disciplinesData[bucketKey] : []
        disciplinesData[bucketKey] = [...currentBucket, ...newRaces]

        // Recompute PB + last result from that bucket
        const bucketForPb = disciplinesData[bucketKey]
        const isThrows = isThrowsDisc(athlete.discipline || bucketKey)

        let pbVal = null
        for (const r of bucketForPb) {
          if (r?.value == null) continue
          if (pbVal == null || (isThrows ? r.value > pbVal : r.value < pbVal)) pbVal = r.value
        }
        const sortedDesc = [...bucketForPb]
          .filter(r => r?.date && r?.value != null)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
        const last = sortedDesc[0] || null

        const patch = {
          races: mergedRaces,
          disciplines_data: disciplinesData,
        }
        // Use the coach_roster display-string column names (pb, last_result, last_date)
        // alongside the numeric mirrors (pb_value, last_result_value) so BOTH the
        // roster cards AND the athlete profile view pick up the new state.
        if (pbVal != null) {
          patch.pb_value = pbVal
          patch.pb = formatMark(pbVal, athlete.discipline)
        }
        if (last) {
          patch.last_result_value = last.value
          patch.last_result = formatMark(last.value, athlete.discipline)
          patch.last_date = last.date
        }

        await updateIn('coach_roster', `id=eq.${athlete.id}`, patch)
        saved += newRaces.length
      }

      setScanSavedCount(saved)
      setScanStage('done')
      fetchRoster()
    } catch (err) {
      console.error('[scanner] save failed:', err)
      setScanError(err.message || 'Save failed')
    } finally {
      setScanSaving(false)
    }
  }

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
      let dob = scraped.dob || null
      const dobEstimated = scraped.dob_estimated === true
      const genderEstimated = scraped.gender_estimated === true

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

      // ── Confirm gender with the user ──
      // If the scraper could NOT read gender from WA (genderEstimated=true),
      // prompt the coach explicitly. Otherwise trust the scraper silently.
      let confirmedGender = gender
      if (genderEstimated || !gender) {
        const msg =
          `⚠ World Athletics didn't expose this athlete's gender.\n\n` +
          `Click OK for Male, Cancel for Female.`
        confirmedGender = window.confirm(msg) ? 'M' : 'F'
      }

      // ── Confirm DOB with the user if it was estimated ──
      // If the scraper couldn't read birthDate from WA, backend estimated
      // (earliest race year - 20). Give coach a chance to correct it.
      if (dobEstimated && dob) {
        const estMsg =
          `⚠ World Athletics didn't expose this athlete's date of birth.\n\n` +
          `We've estimated it as ${dob} (assuming they were ~20 at their first recorded race).\n\n` +
          `Enter the correct DOB in YYYY-MM-DD format, or leave as-is to keep the estimate:`
        const entered = window.prompt(estMsg, dob)
        if (entered && /^\d{4}-\d{2}-\d{2}$/.test(entered.trim())) {
          dob = entered.trim()
        }
      }

      setUrlProgress(`Saving ${athleteName} to roster...`)

      const disciplinesData = scraped.disciplines_data || { [discipline]: races }
      const supportedDisciplines = scraped.supported_disciplines || Object.keys(disciplinesData)

      const newAthlete = {
        coach_id: user.id,
        name: athleteName,
        dob: dob || null,
        gender: confirmedGender,
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
              ...(scannerEnabled ? [{ key: 'assistant', label: 'AI Scanner', icon: Bot }] : []),
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

              {/* ── EMPTY STATE — shown when roster is empty ── */}
              {rosterWithAge.length === 0 ? (
                <div className="space-y-6">
                  {/* Welcome hero */}
                  <div className="relative overflow-hidden rounded-2xl p-8 sm:p-10" style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(255,255,255,0.02) 50%, rgba(59,130,246,0.04) 100%)', border: '1px solid rgba(249,115,22,0.12)', ...stagger(0) }}>
                    <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full blur-[100px]" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)', transform: 'translate(30%, -40%)' }} />
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}>
                          <Zap className="w-4 h-4 text-black" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest mono-font" style={{ color: '#f97316' }}>Getting Started</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-white landing-font leading-tight">Welcome to your coaching dashboard{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h2>
                      <p className="text-sm text-slate-400 landing-font mt-2 max-w-lg">Add your first athlete to unlock squad analytics, trajectory tracking, and Olympic-level benchmarking across every discipline.</p>
                    </div>
                  </div>

                  {/* Setup steps — 3 clear CTAs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={stagger(1)}>
                    {/* Step 1: Import from World Athletics */}
                    <button
                      onClick={() => { setActiveSection('add'); setAddMethod('url'); }}
                      className="group relative overflow-hidden rounded-xl p-5 text-left transition-all hover:scale-[1.02]"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.06) 0%, transparent 100%)' }} />
                      <div className="relative z-10">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.15)' }}>
                          <Globe className="w-5 h-5" style={{ color: '#f97316' }} />
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-bold mono-font" style={{ color: '#f97316' }}>01</span>
                          <span className="text-[10px] text-slate-600 mono-font">RECOMMENDED</span>
                        </div>
                        <p className="text-[14px] font-semibold text-white landing-font">Import from World Athletics</p>
                        <p className="text-[11px] text-slate-500 landing-font mt-1.5 leading-relaxed">Paste an athlete's World Athletics profile URL and we'll pull their full race history automatically.</p>
                        <div className="flex items-center gap-1 mt-3" style={{ color: '#f97316' }}>
                          <span className="text-[11px] font-semibold landing-font">Import athlete</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </div>
                      </div>
                    </button>

                    {/* Step 2: CSV Upload */}
                    <button
                      onClick={() => { setActiveSection('add'); setAddMethod('csv'); }}
                      className="group relative overflow-hidden rounded-xl p-5 text-left transition-all hover:scale-[1.02]"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, transparent 100%)' }} />
                      <div className="relative z-10">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)' }}>
                          <FileSpreadsheet className="w-5 h-5" style={{ color: '#3b82f6' }} />
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-bold mono-font" style={{ color: '#3b82f6' }}>02</span>
                          <span className="text-[10px] text-slate-600 mono-font">BULK IMPORT</span>
                        </div>
                        <p className="text-[14px] font-semibold text-white landing-font">Upload a CSV</p>
                        <p className="text-[11px] text-slate-500 landing-font mt-1.5 leading-relaxed">Got a spreadsheet of athletes? Upload a CSV with names, DOBs, disciplines, and race results.</p>
                        <div className="flex items-center gap-1 mt-3" style={{ color: '#3b82f6' }}>
                          <span className="text-[11px] font-semibold landing-font">Upload CSV</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </div>
                      </div>
                    </button>

                    {/* Step 3: Manual Entry */}
                    <button
                      onClick={() => { setActiveSection('add'); setAddMethod('manual'); }}
                      className="group relative overflow-hidden rounded-xl p-5 text-left transition-all hover:scale-[1.02]"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, transparent 100%)' }} />
                      <div className="relative z-10">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.15)' }}>
                          <UserPlus className="w-5 h-5" style={{ color: '#8b5cf6' }} />
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-bold mono-font" style={{ color: '#8b5cf6' }}>03</span>
                          <span className="text-[10px] text-slate-600 mono-font">MANUAL</span>
                        </div>
                        <p className="text-[14px] font-semibold text-white landing-font">Add manually</p>
                        <p className="text-[11px] text-slate-500 landing-font mt-1.5 leading-relaxed">Enter an athlete's details and race history by hand. Best for athletes without a World Athletics profile.</p>
                        <div className="flex items-center gap-1 mt-3" style={{ color: '#8b5cf6' }}>
                          <span className="text-[11px] font-semibold landing-font">Add athlete</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* What you'll unlock — feature preview */}
                  <div className="rounded-xl p-6" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', ...stagger(2) }}>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-5 landing-font">What you'll see once you add athletes</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { icon: TrendingUp, label: 'Trajectory Tracking', desc: 'See who\'s peaking, plateauing, or declining', color: '#22c55e' },
                        { icon: Target, label: 'Olympic Benchmarks', desc: 'Compare every athlete against 25 years of Olympic data', color: '#f97316' },
                        { icon: Activity, label: 'Performance Alerts', desc: 'Get flagged when an athlete\'s trend changes', color: '#ef4444' },
                        { icon: Users, label: 'Squad Analytics', desc: 'Tier breakdown, improvement rates, and rankings', color: '#3b82f6' },
                      ].map(({ icon: Icon, label, desc, color }, i) => (
                        <div key={i} className="relative group">
                          <div className="flex flex-col items-center text-center p-4 rounded-xl transition-all" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}12`, border: `1px solid ${color}20` }}>
                              <Icon className="w-5 h-5" style={{ color }} />
                            </div>
                            <p className="text-[12px] font-semibold text-white landing-font mb-1">{label}</p>
                            <p className="text-[10px] text-slate-600 landing-font leading-relaxed">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sample insight teasers — blurred preview */}
                  <div className="rounded-xl p-6 relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', ...stagger(3) }}>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-4 landing-font">Sample Insights Preview</p>
                    <div className="space-y-2.5 relative">
                      {/* Sample alert cards — blurred */}
                      <div style={{ filter: 'blur(3px)', opacity: 0.5, pointerEvents: 'none' }}>
                        {[
                          { name: 'Athlete A', disc: '100m', msg: '3% improvement in last 6 months — approaching qualifier standard', trend: 'up', color: '#22c55e' },
                          { name: 'Athlete B', disc: 'Discus', msg: 'Peak projection: 24 months — current trajectory targets 62.5m', trend: 'up', color: '#3b82f6' },
                          { name: 'Athlete C', disc: '400m', msg: 'Performance declining since March — 2 consecutive slower marks', trend: 'down', color: '#ef4444' },
                        ].map((a, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <div className={`w-1.5 h-8 rounded-full`} style={{ background: a.color, opacity: 0.7 }} />
                            <div className="flex-1">
                              <p className="text-[12px] text-white landing-font font-medium">{a.name} · {a.disc}</p>
                              <p className="text-[10px] text-slate-500 landing-font">{a.msg}</p>
                            </div>
                            <ArrowUpRight className={`w-3.5 h-3.5 ${a.trend === 'down' ? 'rotate-90' : ''}`} style={{ color: a.color }} />
                          </div>
                        ))}
                      </div>
                      {/* Overlay CTA */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button
                          onClick={() => { setActiveSection('add'); setAddMethod('url'); }}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-black landing-font transition-all hover:brightness-110 hover:scale-[1.02]"
                          style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)', boxShadow: '0 8px 32px rgba(249,115,22,0.3)' }}
                        >
                          Add your first athlete to unlock insights
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
              /* ── POPULATED STATE — existing highlights ── */
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

          {/* ═══════════════ AI SCANNER ═══════════════ */}
          {activeSection === 'assistant' && scannerEnabled && (
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', ...stagger(0) }}>
              {/* Header */}
              <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)' }}>
                  <Bot className="w-4 h-4 text-black" />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-semibold text-white landing-font">Results Scanner</p>
                  <p className="text-[9px] text-slate-600 landing-font">
                    {scanStage === 'input' && 'Paste results text, or upload a PDF / image'}
                    {scanStage === 'review' && 'Review extracted results — uncheck any that look wrong'}
                    {scanStage === 'done' && 'Done'}
                  </p>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider" style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>Beta</span>
                {scanStage !== 'input' && (
                  <button onClick={resetScanner} className="text-[10px] text-slate-500 hover:text-white landing-font">Reset</button>
                )}
              </div>

              {/* ── Stage 1: Input ── */}
              {scanStage === 'input' && (
                <div className="p-5 space-y-4">
                  <div className="flex gap-1.5">
                    {['text', 'pdf', 'image'].map(t => (
                      <button key={t} onClick={() => { setScanInputType(t); setScanFile(null) }}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold landing-font uppercase tracking-wider transition-all"
                        style={{
                          background: scanInputType === t ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.03)',
                          color: scanInputType === t ? '#f97316' : '#64748b',
                          border: `1px solid ${scanInputType === t ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.06)'}`,
                        }}>
                        {t}
                      </button>
                    ))}
                  </div>

                  {scanInputType === 'text' && (
                    <textarea
                      value={scanText}
                      onChange={(e) => setScanText(e.target.value)}
                      placeholder="Paste competition results text here (any format — heats, finals, PDFs copied as text, etc.)"
                      rows={10}
                      className="w-full px-3.5 py-2.5 rounded-lg text-[12px] text-white placeholder-slate-700 landing-font focus:outline-none focus:ring-1 focus:ring-orange-500/30 resize-y"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    />
                  )}

                  {(scanInputType === 'pdf' || scanInputType === 'image') && (
                    <div>
                      <input
                        type="file"
                        accept={scanInputType === 'pdf' ? '.pdf' : 'image/*'}
                        onChange={(e) => setScanFile(e.target.files[0] || null)}
                        className="block w-full text-[11px] text-slate-400 landing-font file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:uppercase file:tracking-wider file:text-black file:bg-orange-500 hover:file:bg-orange-400"
                      />
                      {scanFile && (
                        <p className="mt-2 text-[10px] text-slate-500 mono-font">
                          {scanFile.name} — {(scanFile.size / 1024).toFixed(1)} KB
                        </p>
                      )}
                      {scanInputType === 'image' && (
                        <p className="mt-2 text-[10px] text-amber-500 landing-font flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3" />
                          Image extraction can't be cross-verified against source text — review results carefully.
                        </p>
                      )}
                    </div>
                  )}

                  {scanError && (
                    <div className="px-3 py-2 rounded-lg text-[11px] text-red-400 landing-font" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      {scanError}
                    </div>
                  )}

                  <button
                    onClick={handleScanExtract}
                    disabled={scanLoading}
                    className="w-full py-2.5 rounded-lg text-[12px] font-bold text-black landing-font uppercase tracking-wider disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}>
                    {scanLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning...</> : <>Extract Results</>}
                  </button>
                </div>
              )}

              {/* ── Stage 2: Review ── */}
              {scanStage === 'review' && (
                <div className="p-5 space-y-4">
                  {scanStats && (
                    <div className="flex gap-3 text-[10px] mono-font">
                      <span className="text-slate-500">Raw: <span className="text-white">{scanStats.raw_extraction_count}</span></span>
                      <span className="text-slate-500">Accepted: <span className="text-green-400">{scanStats.accepted_count}</span></span>
                      <span className="text-slate-500">Dropped: <span className="text-red-400">{scanStats.dropped_count}</span></span>
                      {scanStats.source_is_image && <span className="text-amber-500">⚠ image source</span>}
                    </div>
                  )}

                  {/* Debug panel: why were results dropped? */}
                  {scanDroppedReasons && scanDroppedReasons.length > 0 && (
                    <div className="rounded-lg" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <button
                        type="button"
                        onClick={() => setScanDebugOpen(v => !v)}
                        className="w-full px-3 py-2 flex items-center justify-between text-left"
                      >
                        <span className="mono-font text-[10px] uppercase tracking-[0.18em] text-red-400">
                          {scanDebugOpen ? '▼' : '▶'} Why were {scanDroppedReasons.length} dropped?
                        </span>
                        <span className="mono-font text-[9px] text-slate-500">click to {scanDebugOpen ? 'hide' : 'show'}</span>
                      </button>
                      {scanDebugOpen && (
                        <div className="px-3 pb-3 space-y-1 max-h-40 overflow-y-auto">
                          {scanDroppedReasons.map((reason, i) => (
                            <p key={i} className="mono-font text-[10px] text-slate-400 break-words">
                              <span className="text-red-400">•</span> {reason}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {scanCandidates.length === 0 && scanAmbiguous.length === 0 && (
                    <div className="py-8 text-center text-[12px] text-slate-500 landing-font">
                      No matching athletes found in this document.
                    </div>
                  )}

                  {/* ── Ambiguous disambiguation — user picks which athlete ── */}
                  {scanAmbiguous.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <p className="mono-font text-[10px] uppercase tracking-[0.18em] text-amber-400">
                          Needs your input · {scanAmbiguous.length} ambiguous name{scanAmbiguous.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      {scanAmbiguous.map((amb, ai) => {
                        const r = amb.result || {}
                        const currentPick = scanAmbigPicks[ai]
                        return (
                          <div
                            key={`amb-${ai}`}
                            className="rounded-lg p-3"
                            style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)' }}
                          >
                            <p className="text-[12px] text-white landing-font mb-1">
                              Who is <span className="font-bold text-amber-300">"{amb.extracted_name}"</span>?
                            </p>
                            <p className="text-[10px] text-slate-500 mono-font mb-2">
                              {r.date} · {r.event} · <span className="text-slate-300">{r.value}{r.event?.includes('throw') || r.event?.includes('jump') ? 'm' : 's'}</span>
                              {r.competition && <span> · {r.competition}</span>}
                            </p>
                            <div className="space-y-1">
                              {(amb.possible_matches || []).map(m => {
                                const selected = currentPick === m.roster_athlete_id
                                return (
                                  <button
                                    key={m.roster_athlete_id}
                                    type="button"
                                    onClick={() => setScanAmbigPicks(prev => ({ ...prev, [ai]: m.roster_athlete_id }))}
                                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left transition-colors"
                                    style={{
                                      background: selected ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.03)',
                                      border: selected ? '1px solid rgba(249,115,22,0.5)' : '1px solid rgba(255,255,255,0.06)',
                                    }}
                                  >
                                    <div className="min-w-0">
                                      <p className="text-[11px] text-white landing-font truncate">{m.roster_athlete_name}</p>
                                      <p className="text-[9px] text-slate-500 landing-font truncate">
                                        {m.roster_athlete_discipline || '—'}{m.roster_athlete_gender ? ` · ${m.roster_athlete_gender}` : ''}
                                      </p>
                                    </div>
                                    <span className="text-[9px] text-slate-500 mono-font flex-shrink-0">{m.confidence}%</span>
                                  </button>
                                )
                              })}
                              <button
                                type="button"
                                onClick={() => setScanAmbigPicks(prev => ({ ...prev, [ai]: 'skip' }))}
                                className="w-full px-2 py-1.5 rounded text-left text-[10px] text-slate-500 landing-font italic"
                                style={{
                                  background: currentPick === 'skip' ? 'rgba(148,163,184,0.12)' : 'transparent',
                                  border: currentPick === 'skip' ? '1px solid rgba(148,163,184,0.3)' : '1px dashed rgba(148,163,184,0.15)',
                                }}
                              >
                                None of these — skip this result
                              </button>
                            </div>
                          </div>
                        )
                      })}
                      {scanCandidates.length > 0 && (
                        <div className="pt-2">
                          <p className="mono-font text-[10px] uppercase tracking-[0.18em] text-slate-500 px-1">
                            Confident matches · {scanCandidates.length}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-3 max-h-[440px] overflow-y-auto">
                    {scanCandidates.map((cand, ci) => (
                      <div key={ci} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-[12px] font-semibold text-white landing-font">{cand.roster_athlete_name}</p>
                            <p className="text-[9px] text-slate-600 landing-font">
                              Matched as "{cand.extracted_name}" · confidence {cand.confidence}%
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {(cand.results || []).map((r, ri) => {
                            const key = `${ci}:${ri}`
                            return (
                              <label key={ri} className="flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-white/5">
                                <input
                                  type="checkbox"
                                  checked={!!scanSelections[key]}
                                  onChange={(e) => setScanSelections(prev => ({ ...prev, [key]: e.target.checked }))}
                                  className="accent-orange-500 mt-0.5"
                                />
                                <span className="text-[11px] text-slate-300 mono-font flex-1">
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    <span>{r.date}</span>
                                    {r.date_inferred && (
                                      <span className="text-[8px] uppercase tracking-wider text-amber-400 landing-font px-1 py-[1px] rounded" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}>
                                        inferred — verify
                                      </span>
                                    )}
                                    <span>·</span>
                                    <span>{r.event}</span>
                                    <span>·</span>
                                    <span className="text-white">{r.mark_raw || r.value}</span>
                                    {r.competition && <span className="text-slate-600">· {r.competition}</span>}
                                    {r.duplicate && <span className="text-[9px] text-amber-500 landing-font">duplicate</span>}
                                  </span>
                                  {r.event_source_quote && (
                                    <span className="block text-[9px] text-slate-500 mt-0.5 truncate" title={r.event_source_quote}>
                                      event from: "{r.event_source_quote}"
                                    </span>
                                  )}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {scanError && (
                    <div className="px-3 py-2 rounded-lg text-[11px] text-red-400 landing-font" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      {scanError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={resetScanner} className="flex-1 py-2 rounded-lg text-[11px] font-semibold text-slate-400 landing-font" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                      Back
                    </button>
                    <button
                      onClick={handleScanConfirm}
                      disabled={scanSaving || (
                        !Object.values(scanSelections).some(Boolean) &&
                        !Object.values(scanAmbigPicks).some(v => v && v !== 'skip')
                      )}
                      className="flex-1 py-2 rounded-lg text-[11px] font-bold text-black landing-font uppercase tracking-wider disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}>
                      {scanSaving ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</> : <><CheckCircle className="w-3 h-3" /> Confirm & Save</>}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Stage 3: Done ── */}
              {scanStage === 'done' && (
                <div className="p-8 text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                  <p className="text-[14px] font-semibold text-white landing-font">
                    Saved {scanSavedCount} result{scanSavedCount === 1 ? '' : 's'} to your roster.
                  </p>
                  <button onClick={resetScanner} className="px-4 py-2 rounded-lg text-[11px] font-semibold text-white landing-font" style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)' }}>
                    Scan Another
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

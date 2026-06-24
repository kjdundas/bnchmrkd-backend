// ═══════════════════════════════════════════════════════════════════════
// LINKED ATHLETES SECTION (coach, web) — Phase A · A7+
// Shows the coach's CONSENTED athletes (active links) with their real data,
// distinct from private data-only roster records. This is the payoff of the
// consent system: invite → athlete approves → they appear here with live data.
// Backed by the get_linked_athletes RPC (consent-gated server-side).
// ═══════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { Link2, ChevronRight } from 'lucide-react'
import { callRpc } from '../../lib/supabaseRest'
import { getTier, TIER_COLORS, TIER_SHORT } from '../../lib/performanceTiers'
import { getAgeGroup, isTimeDiscipline } from '../../lib/performanceLevels'

function calcAge(dob) {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d)) return null
  const diff = Date.now() - d.getTime()
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000))
}

// Format a mark for display: time events as seconds / m:ss, field as metres.
function fmtMark(v, disc) {
  if (v == null) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (!isTimeDiscipline(disc)) return `${n.toFixed(2)}m`
  if (n >= 60) { const m = Math.floor(n / 60); const s = (n % 60).toFixed(2).padStart(5, '0'); return `${m}:${s}` }
  return `${n.toFixed(2)}`
}

// Combine an athlete's web races + mobile performances for their primary
// discipline, then compute true PB + most-recent (the stored athlete_profiles
// fields go stale because mobile logs write to `performances`, not the profile).
function deriveMarks(a) {
  const disc = (a.discipline || '').trim()   // normalize — stored data sometimes has trailing spaces
  const lower = isTimeDiscipline(disc)   // track: lower is better; field: higher
  const pts = []
  for (const r of (Array.isArray(a.races) ? a.races : [])) {
    if (r == null || r.value == null || !r.date) continue
    const rd = (r.discipline || '').trim()
    if (disc && rd && rd !== disc) continue
    pts.push({ date: r.date, value: Number(r.value) })
  }
  for (const p of (Array.isArray(a.performances) ? a.performances : [])) {
    if (p == null || p.value == null || !p.date) continue
    const pd = (p.discipline || '').trim()
    if (disc && pd && pd !== disc) continue
    pts.push({ date: p.date, value: Number(p.value) })
  }
  let pb = null, recent = null, recentDate = null
  for (const r of pts) {
    if (!Number.isFinite(r.value)) continue
    if (pb == null || (lower ? r.value < pb : r.value > pb)) pb = r.value
    if (recentDate == null || new Date(r.date) > new Date(recentDate)) { recent = r.value; recentDate = r.date }
  }
  return { pb, recent, recentDate }
}

export default function LinkedAthletesSection({ onViewAthlete }) {
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await callRpc('get_linked_athletes')
      setAthletes(Array.isArray(rows) ? rows : [])
    } catch {
      setAthletes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading || athletes.length === 0) return null

  return (
    <div className="mb-5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mono-font mb-2 flex items-center gap-1.5">
        <Link2 className="w-3.5 h-3.5 text-emerald-400" /> Linked athletes ({athletes.length})
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {athletes.map((a) => {
          const age = calcAge(a.dob)
          const gender = (a.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M'
          const marks = deriveMarks(a)
          const pbDisplay = fmtMark(marks.pb, a.discipline) || a.pb_display
          let tier = null
          try {
            if (a.discipline && marks.pb != null) {
              const ag = age != null ? getAgeGroup(age) : 'Senior'
              tier = getTier(a.discipline, gender, ag, marks.pb)
            }
          } catch { /* ignore */ }

          // Build the detail-view payload from the AUTHORITATIVE combined race
          // list — web races (athlete_profiles.races) + mobile logs (performances)
          // — grouped by discipline. Only fall back to the profile's pre-grouped
          // disciplines_data if nothing has been logged in-app (e.g. WA-only).
          const dd = {}
          const pushRace = (disc, date, value, competition) => {
            if (value == null || !date) return
            const k = (disc || a.discipline || '100m').trim()
            if (!Array.isArray(dd[k])) dd[k] = []
            dd[k].push({ date, value, competition: competition || null })
          }
          for (const r of (Array.isArray(a.races) ? a.races : [])) pushRace(r.discipline, r.date, r.value, r.competition)
          for (const p of (Array.isArray(a.performances) ? a.performances : [])) pushRace(p.discipline, p.date, p.value, p.competition)
          if (Object.keys(dd).length === 0 && a.disciplines_data && typeof a.disciplines_data === 'object') {
            Object.assign(dd, a.disciplines_data)
          }
          const allRaces = Array.isArray(a.races) ? a.races : []

          return (
            <button
              key={a.link_id}
              onClick={() => onViewAthlete && onViewAthlete({
                id: a.athlete_user_id, link_id: a.link_id, _linked: true,
                name: a.name, gender, dob: a.dob,
                discipline: (a.discipline || '').trim(),
                disciplines: (a.disciplines || (a.discipline ? [a.discipline] : [])).map((d) => (d || '').trim()),
                pb: pbDisplay, pb_value: marks.pb ?? a.pb_value,
                last_result: fmtMark(marks.recent, a.discipline) || a.last_result_display,
                last_result_value: marks.recent ?? a.last_result_value,
                last_date: marks.recentDate || a.last_date,
                races: allRaces,
                disciplines_data: dd,
              })}
              className="text-left rounded-xl p-3.5 transition-all hover:translate-y-[-1px] flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(16,185,129,0.18)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13px] font-bold text-white landing-font truncate">{a.name || 'Athlete'}</span>
                  <span className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>Linked</span>
                </div>
                <p className="text-[10px] text-slate-400 landing-font truncate">
                  {a.discipline || '—'}{age != null ? ` · ${age}y` : ''}{pbDisplay ? ` · PB ${pbDisplay}` : ''}
                </p>
              </div>
              {tier && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="w-2 h-2 rounded-full" style={{ background: TIER_COLORS[tier.tier] }} />
                  <span className="text-[10px] font-bold mono-font" style={{ color: TIER_COLORS[tier.tier] }}>{TIER_SHORT[tier.tier]}</span>
                </div>
              )}
              <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

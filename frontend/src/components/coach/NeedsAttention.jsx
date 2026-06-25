// ═══════════════════════════════════════════════════════════════════════
// NEEDS ATTENTION (coach · web) — the triage surface that leads the coach
// home. Pulls linked athletes and surfaces what to act on TODAY:
//   • red / amber readiness from today's check-in (M3)
//   • athletes who've gone quiet (no result logged in 14+ days)
// Rows open the athlete's full analysis. Positive empty state when all clear.
// ═══════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, HeartPulse, Clock, ChevronRight, CheckCircle2 } from 'lucide-react'
import { callRpc } from '../../lib/supabaseRest'
import { checkinStatus, READINESS_COLORS, isToday } from '../../lib/readiness'
import { buildLinkedPayload } from './LinkedAthletesSection'

const QUIET_DAYS = 14

function lastActivityDays(a) {
  let latest = null
  const consider = (d) => { if (!d) return; const t = new Date(d); if (!isNaN(t) && (latest == null || t > latest)) latest = t }
  for (const r of (Array.isArray(a.races) ? a.races : [])) consider(r.date)
  for (const p of (Array.isArray(a.performances) ? a.performances : [])) consider(p.date)
  if (!latest) return null
  return Math.floor((Date.now() - latest.getTime()) / (24 * 3600 * 1000))
}

// Rank: red readiness (2) > amber readiness (1) > quiet (0).
function buildItems(athletes) {
  const items = []
  for (const a of athletes) {
    const fresh = isToday(a.latest_checkin)
    const status = checkinStatus(fresh ? a.latest_checkin : null)
    if (status.level === 'red' || status.level === 'amber') {
      items.push({
        a, key: `${a.athlete_user_id}-ready`, kind: 'readiness', level: status.level,
        rank: status.level === 'red' ? 2 : 1,
        headline: `${a.name} · ${status.label}`,
        detail: status.reasons.join(' · ') || 'Flagged on today’s check-in',
      })
    }
    const days = lastActivityDays(a)
    if (days != null && days >= QUIET_DAYS) {
      items.push({
        a, key: `${a.athlete_user_id}-quiet`, kind: 'quiet', level: 'info', rank: 0,
        headline: `${a.name} · gone quiet`,
        detail: `No result logged in ${days} days`,
      })
    }
  }
  return items.sort((x, y) => y.rank - x.rank)
}

export default function NeedsAttention({ onViewAthlete }) {
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { const rows = await callRpc('get_linked_athletes'); setAthletes(Array.isArray(rows) ? rows : []) }
    catch { setAthletes([]) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  if (loading || athletes.length === 0) return null   // no linked athletes → nothing to triage

  const items = buildItems(athletes)
  const checkedToday = athletes.filter((a) => isToday(a.latest_checkin)).length

  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-orange-400" />
        <h3 className="text-[13px] font-bold text-white landing-font">Needs attention</h3>
        {items.length > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(249,115,22,0.14)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.3)' }}>{items.length}</span>
        )}
        <span className="ml-auto text-[10px] text-slate-500 landing-font">{checkedToday}/{athletes.length} checked in today</span>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-2.5 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-[12px] text-slate-300 landing-font">All clear — no readiness flags and everyone's been active. Nice.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const color = it.kind === 'readiness' ? READINESS_COLORS[it.level] : '#64748b'
            const Icon = it.kind === 'readiness' ? HeartPulse : Clock
            return (
              <button key={it.key} onClick={() => onViewAthlete && onViewAthlete(buildLinkedPayload(it.a))}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all hover:bg-white/[0.03]"
                style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="w-1.5 h-9 rounded-full flex-shrink-0" style={{ background: color, opacity: 0.85 }} />
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] text-white font-medium landing-font truncate">{it.headline}</p>
                  <p className="text-[10px] text-slate-400 landing-font truncate">{it.detail}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

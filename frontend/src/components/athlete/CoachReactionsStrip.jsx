// ═══════════════════════════════════════════════════════════════════════
// COACH REACTIONS (M1, athlete · web) — the payoff of the feed loop. Shows
// recent reactions your coach (or parent) left on your activity, e.g.
// "Coach 👏🔥 — 100m · 10.52". Seeing that someone who matters noticed is the
// dopamine hit that pulls the athlete back.
// ═══════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import { selectFrom } from '../../lib/supabaseRest'

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const d = Math.floor(diff / 86400000)
  if (d > 0) return d === 1 ? 'yesterday' : `${d}d ago`
  const h = Math.floor(diff / 3600000)
  if (h > 0) return `${h}h ago`
  const m = Math.floor(diff / 60000)
  return m > 1 ? `${m}m ago` : 'just now'
}

export default function CoachReactionsStrip({ athleteId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!athleteId) return
    setLoading(true)
    try {
      const data = await selectFrom('activity_reactions', { filter: `athlete_user_id=eq.${athleteId}`, order: 'created_at.desc', limit: '30' })
      setRows(Array.isArray(data) ? data : [])
    } catch { setRows([]) } finally { setLoading(false) }
  }, [athleteId])
  useEffect(() => { load() }, [load])

  if (loading || rows.length === 0) return null

  // Group reactions by event → one row per event with all emojis.
  const byEvent = {}
  for (const r of rows) {
    const k = r.event_key
    if (!byEvent[k]) byEvent[k] = { title: r.event_title, who: r.reactor_name || 'Your coach', emojis: [], latest: r.created_at }
    if (!byEvent[k].emojis.includes(r.emoji)) byEvent[k].emojis.push(r.emoji)
    if (new Date(r.created_at) > new Date(byEvent[k].latest)) byEvent[k].latest = r.created_at
  }
  const events = Object.values(byEvent).sort((a, b) => new Date(b.latest) - new Date(a.latest)).slice(0, 4)

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.18)' }}>
      <div className="flex items-center gap-2 mb-2.5">
        <Sparkles className="w-4 h-4 text-orange-400" />
        <h3 className="text-[13px] font-bold text-white landing-font">Cheers from your coach</h3>
      </div>
      <div className="space-y-2">
        {events.map((e, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="text-[15px] leading-none flex-shrink-0">{e.emojis.join('')}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white landing-font truncate">
                <span className="font-semibold">{e.who}</span> <span className="text-slate-400">cheered</span> {e.title || 'your activity'}
              </p>
            </div>
            <span className="text-[9px] text-slate-500 mono-font flex-shrink-0">{timeAgo(e.latest)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

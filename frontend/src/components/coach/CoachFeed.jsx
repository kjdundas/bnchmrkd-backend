// ═══════════════════════════════════════════════════════════════════════
// COACH FEED (M1) — the closed activity feed + reactions. Shows recent
// results / test scores / completed sessions across the coach's linked
// athletes (derived on read, no write-site instrumentation), and lets the
// coach react (👏 🔥 💪). A reaction is the kudos that pulls the athlete back —
// they see "Coach 👏 your 100m" on their own home.
// ═══════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { Activity, Trophy, Gauge, Dumbbell } from 'lucide-react'
import { callRpc, insertInto, deleteFrom } from '../../lib/supabaseRest'

const EMOJIS = ['👏', '🔥', '💪']

const KIND = {
  result:  { icon: Trophy, color: '#fbbf24', verb: 'logged a result' },
  test:    { icon: Gauge, color: '#38bdf8', verb: 'logged a test' },
  session: { icon: Dumbbell, color: '#34d399', verb: 'completed a session' },
}

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

function initials(name) {
  return (name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function CoachFeed({ currentUserId, coachName }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [reacts, setReacts] = useState({})   // event_key -> Set(emoji) this coach has left
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await callRpc('get_coach_feed')
      const list = Array.isArray(rows) ? rows : []
      setEvents(list)
      const map = {}
      for (const e of list) map[e.event_key] = new Set(Array.isArray(e.my_reactions) ? e.my_reactions : [])
      setReacts(map)
    } catch { setEvents([]) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const toggle = async (ev, emoji) => {
    const k = ev.event_key
    if (busy) return
    setBusy(`${k}${emoji}`)
    const has = reacts[k]?.has(emoji)
    setReacts((prev) => {
      const set = new Set(prev[k] || [])
      if (has) set.delete(emoji); else set.add(emoji)
      return { ...prev, [k]: set }
    })
    try {
      if (has) {
        await deleteFrom('activity_reactions', `event_key=eq.${encodeURIComponent(k)}&reactor_id=eq.${currentUserId}&emoji=eq.${encodeURIComponent(emoji)}`)
      } else {
        await insertInto('activity_reactions', {
          event_key: k, athlete_user_id: ev.athlete_user_id, reactor_id: currentUserId,
          reactor_name: coachName || 'Coach', event_title: ev.detail, emoji,
        })
      }
    } catch {
      setReacts((prev) => { const set = new Set(prev[k] || []); if (has) set.add(emoji); else set.delete(emoji); return { ...prev, [k]: set } })
    } finally { setBusy(null) }
  }

  if (loading || events.length === 0) return null

  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-orange-400" />
        <h3 className="text-[13px] font-bold text-white landing-font">Squad activity</h3>
        <span className="ml-auto text-[10px] text-slate-500 landing-font">React to give your athletes a nudge</span>
      </div>

      <div className="space-y-2">
        {events.slice(0, 12).map((ev) => {
          const meta = KIND[ev.kind] || KIND.result
          const Icon = meta.icon
          const mine = reacts[ev.event_key] || new Set()
          return (
            <div key={ev.event_key} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold mono-font flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)', color: meta.color }}>{initials(ev.athlete_name)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-white landing-font truncate">
                  <span className="font-semibold">{ev.athlete_name}</span> <span className="text-slate-400">{meta.verb}</span>
                </p>
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3 h-3 flex-shrink-0" style={{ color: meta.color }} />
                  <p className="text-[10px] text-slate-400 mono-font truncate">{ev.detail}</p>
                  <span className="text-[9px] text-slate-600 mono-font flex-shrink-0">· {timeAgo(ev.occurred_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {EMOJIS.map((e) => {
                  const on = mine.has(e)
                  return (
                    <button key={e} onClick={() => toggle(ev, e)} disabled={busy === `${ev.event_key}${e}`}
                      className="w-7 h-7 rounded-lg text-[13px] leading-none transition-all disabled:opacity-50"
                      style={on
                        ? { background: 'rgba(249,115,22,0.18)', border: '1px solid rgba(249,115,22,0.45)' }
                        : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', filter: 'grayscale(0.4)', opacity: 0.7 }}>
                      {e}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

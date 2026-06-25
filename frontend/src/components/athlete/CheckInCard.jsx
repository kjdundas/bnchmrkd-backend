// ═══════════════════════════════════════════════════════════════════════
// DAILY CHECK-IN (M3, athlete · web) — a 30-second readiness check.
// Sleep · soreness · mood · energy · pain. One row per day (update-in-place).
// Rolls up to a red/amber/green status the athlete sees and the linked coach
// sees on their roster. Youth-safe: any pain → "needs attention".
// ═══════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { HeartPulse, Check, Loader2 } from 'lucide-react'
import { selectFrom, insertInto, updateIn } from '../../lib/supabaseRest'
import { checkinStatus, READINESS_COLORS, PAIN_AREAS, todayStr } from '../../lib/readiness'

const SLEEP_CHIPS = [
  { l: '<5h', v: 4.5 }, { l: '5–6h', v: 5.5 }, { l: '6–7h', v: 6.5 },
  { l: '7–8h', v: 7.5 }, { l: '8h+', v: 8.5 },
]
const SCALE = [1, 2, 3, 4, 5]
const inputStyle = { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }

export default function CheckInCard({ athleteId }) {
  const [row, setRow] = useState(null)       // today's saved check-in (or null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ sleep_hours: null, soreness: null, mood: null, energy: null, pain: false, pain_areas: [] })

  const load = useCallback(async () => {
    if (!athleteId) return
    setLoading(true)
    try {
      const rows = await selectFrom('athlete_checkins', { filter: `athlete_id=eq.${athleteId}&checkin_date=eq.${todayStr()}`, limit: '1' })
      const r = Array.isArray(rows) && rows[0] ? rows[0] : null
      setRow(r)
      if (r) setForm({ sleep_hours: r.sleep_hours, soreness: r.soreness, mood: r.mood, energy: r.energy, pain: !!r.pain, pain_areas: r.pain_areas || [] })
      setEditing(!r)
    } catch { setRow(null); setEditing(true) } finally { setLoading(false) }
  }, [athleteId])

  useEffect(() => { load() }, [load])

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }))
  const toggleArea = (a) => setForm((s) => ({ ...s, pain_areas: s.pain_areas.includes(a) ? s.pain_areas.filter((x) => x !== a) : [...s.pain_areas, a] }))

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        sleep_hours: form.sleep_hours, soreness: form.soreness, mood: form.mood, energy: form.energy,
        pain: !!form.pain, pain_areas: form.pain ? form.pain_areas : [],
        pain_note: null,
      }
      let saved
      if (row?.id) saved = await updateIn('athlete_checkins', `id=eq.${row.id}`, payload)
      else saved = await insertInto('athlete_checkins', { athlete_id: athleteId, checkin_date: todayStr(), ...payload })
      setRow(saved || { ...payload, checkin_date: todayStr() })
      setEditing(false)
    } catch { /* keep editing */ } finally { setSaving(false) }
  }

  if (loading) return null

  const status = checkinStatus(row)
  const color = READINESS_COLORS[status.level]

  // ── Saved (collapsed) state ──────────────────────────────────────────
  if (row && !editing) {
    return (
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}33` }}>
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white landing-font">Checked in today · {status.label}</p>
            <p className="text-[10px] text-slate-400 landing-font truncate">{status.reasons.length ? status.reasons.join(' · ') : 'All green — have a great session.'}</p>
          </div>
          <button onClick={() => setEditing(true)} className="text-[11px] text-slate-400 hover:text-white landing-font">Edit</button>
        </div>
      </div>
    )
  }

  // ── Edit / first-time state ──────────────────────────────────────────
  const canSave = form.soreness != null || form.mood != null || form.energy != null || form.sleep_hours != null || form.pain
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)' }}>
      <div className="flex items-center gap-2 mb-3">
        <HeartPulse className="w-4 h-4 text-orange-400" />
        <h3 className="text-[13px] font-bold text-white landing-font">Daily check-in</h3>
        <span className="text-[10px] text-slate-500 landing-font">· 30 seconds</span>
      </div>

      <Scale label="Sleep last night" custom>
        <div className="flex flex-wrap gap-1.5">
          {SLEEP_CHIPS.map((c) => (
            <Chip key={c.l} on={form.sleep_hours === c.v} onClick={() => set('sleep_hours', c.v)}>{c.l}</Chip>
          ))}
        </div>
      </Scale>

      <Scale label="Soreness" hint="1 fresh · 5 very sore">
        {SCALE.map((n) => <Chip key={n} on={form.soreness === n} danger={n >= 4} onClick={() => set('soreness', n)}>{n}</Chip>)}
      </Scale>
      <Scale label="Energy" hint="1 flat · 5 buzzing">
        {SCALE.map((n) => <Chip key={n} on={form.energy === n} onClick={() => set('energy', n)}>{n}</Chip>)}
      </Scale>
      <Scale label="Mood" hint="1 low · 5 great">
        {SCALE.map((n) => <Chip key={n} on={form.mood === n} onClick={() => set('mood', n)}>{n}</Chip>)}
      </Scale>

      <div className="mt-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={form.pain} onChange={(e) => set('pain', e.target.checked)} className="accent-rose-400" />
          <span className="text-[12px] text-slate-200 landing-font">Any pain or niggle today?</span>
        </label>
        {form.pain && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {PAIN_AREAS.map((a) => (
              <button key={a.v} type="button" onClick={() => toggleArea(a.v)}
                className="px-2.5 py-1 rounded-full text-[10px] font-semibold landing-font transition-colors"
                style={form.pain_areas.includes(a.v)
                  ? { background: 'rgba(251,113,133,0.18)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.4)' }
                  : { background: 'rgba(255,255,255,0.03)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>
                {a.l}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button onClick={save} disabled={saving || !canSave}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold text-black landing-font disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#f97316,#fbbf24)' }}>
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Check className="w-3.5 h-3.5" /> {row ? 'Update check-in' : 'Check in'}</>}
        </button>
        {row && <button onClick={() => { setEditing(false) }} className="px-3 py-2 text-[11px] text-slate-400 hover:text-white landing-font">Cancel</button>}
      </div>
      {form.pain && (
        <p className="text-[10px] text-slate-500 landing-font mt-2">If pain persists or worsens, stop and see a physio or doctor. Your coach will see this flagged.</p>
      )}
    </div>
  )
}

function Scale({ label, hint, custom, children }) {
  return (
    <div className="mt-2.5">
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-[10px] uppercase tracking-wider text-slate-500 mono-font">{label}</label>
        {hint && <span className="text-[9px] text-slate-600 landing-font">{hint}</span>}
      </div>
      {custom ? children : <div className="flex gap-1.5">{children}</div>}
    </div>
  )
}

function Chip({ on, danger, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className="flex-1 min-w-[42px] py-1.5 rounded-lg text-[12px] font-bold landing-font transition-colors"
      style={on
        ? (danger
            ? { background: 'rgba(251,113,133,0.18)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.45)' }
            : { background: 'rgba(249,115,22,0.18)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.45)' })
        : { background: 'rgba(0,0,0,0.25)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>
      {children}
    </button>
  )
}

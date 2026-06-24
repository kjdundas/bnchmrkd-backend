// ═══════════════════════════════════════════════════════════════════════
// PROGRAMS PANEL (athlete, web) — Expert Assistant · Phase 2
// Structured intake → a periodization-aware, maturation-capped, injury-aware
// training program. The backend builds a deterministic skeleton from the intake
// and the LLM fills in the detail. Athlete-direct; a linked coach can see it.
// ═══════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { Dumbbell, Sparkles, ChevronDown, ChevronUp, Loader2, AlertCircle, Trash2 } from 'lucide-react'
import { selectFrom, insertInto, deleteFrom } from '../../lib/supabaseRest'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://web-production-295f1.up.railway.app'

const PHASES = [
  { v: 'off_season', l: 'Off-season (base / GPP)' },
  { v: 'pre_season', l: 'Pre-season (specific prep)' },
  { v: 'competition', l: 'In-season (competition)' },
  { v: 'transition', l: 'Transition (recovery)' },
]
const QUALITIES = ['acceleration', 'max velocity', 'speed', 'speed endurance', 'power', 'max strength', 'aerobic capacity', 'anaerobic/lactate', 'plyometric/elastic', 'mobility', 'technique']
const EQUIPMENT = [
  { v: 'track', l: 'Track' },
  { v: 'full_gym', l: 'Full gym' },
  { v: 'minimal', l: 'Minimal kit' },
  { v: 'none', l: 'Bodyweight only' },
]
const INJURY_AREAS = [
  { v: 'knee', l: 'Knee' }, { v: 'heel', l: 'Heel' }, { v: 'ankle', l: 'Ankle' },
  { v: 'hip', l: 'Hip/groin' }, { v: 'shin', l: 'Shin' }, { v: 'back', l: 'Back' },
]

const EMPTY_INTAKE = {
  season_phase: 'pre_season', primary_quality: '', secondary_quality: '',
  days_per_week: 4, equipment: 'track', training_age_years: '',
  target_competition_date: '', injuries: [], goal: '',
}

const inputStyle = { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }

export default function ProgramsPanel({ user, fetchContext }) {
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [intake, setIntake] = useState(EMPTY_INTAKE)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const setField = (k, v) => setIntake((s) => ({ ...s, [k]: v }))
  const toggleInjury = (k) => setIntake((s) => ({ ...s, injuries: s.injuries.includes(k) ? s.injuries.filter((x) => x !== k) : [...s.injuries, k] }))

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const rows = await selectFrom('programs', { filter: `athlete_user_id=eq.${user.id}&status=eq.active`, order: 'created_at.desc' })
      setPrograms(Array.isArray(rows) ? rows : [])
    } catch { setPrograms([]) } finally { setLoading(false) }
  }, [user])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    setError(''); setGenerating(true)
    try {
      const ctx = (await fetchContext?.()) || {}
      const payload = {
        role: 'athlete', context: ctx, weeks: 4,
        intake: {
          ...intake,
          days_per_week: Number(intake.days_per_week) || 3,
          training_age_years: intake.training_age_years ? Number(intake.training_age_years) : null,
          target_competition_date: intake.target_competition_date || null,
        },
      }
      const res = await fetch(`${API_BASE}/api/v1/assistant/program`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.detail || `Server error ${res.status}`) }
      const { program } = await res.json()
      if (!program || !program.title) throw new Error('The program came back empty — try again.')
      const saved = await insertInto('programs', {
        athlete_user_id: user.id, created_by: user.id, source: 'ai',
        title: program.title, goal: intake.goal.trim() || null,
        structure: program, maturity_context: ctx.maturity ? JSON.stringify(ctx.maturity) : null,
      })
      setPrograms((p) => [saved, ...p])
      setOpenId(saved?.id || null)
      setIntake(EMPTY_INTAKE); setShowForm(false)
    } catch (e) {
      setError(e.message?.replace(/^Supabase \d+:\s*/, '') || 'Could not generate a program.')
    } finally { setGenerating(false) }
  }

  const remove = async (id) => {
    try { await deleteFrom('programs', `id=eq.${id}`); setPrograms((p) => p.filter((x) => x.id !== id)) } catch { /* ignore */ }
  }

  const lbl = 'block text-[10px] uppercase tracking-wider text-slate-500 mono-font mb-1'
  const fld = 'w-full px-3 py-2 rounded-lg text-[12px] text-white landing-font focus:outline-none focus:ring-1 focus:ring-orange-500/30'

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-orange-400" />
          <h3 className="text-[13px] font-bold text-white landing-font">Training Programs</h3>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-black landing-font hover:brightness-110"
            style={{ background: 'linear-gradient(135deg,#f97316,#fbbf24)' }}>
            <Sparkles className="w-3.5 h-3.5" /> Generate
          </button>
        )}
      </div>

      {showForm && (
        <div className="rounded-xl p-3 mb-3 space-y-3" style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)' }}>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={lbl}>Season phase</label>
              <select value={intake.season_phase} onChange={(e) => setField('season_phase', e.target.value)} className={fld} style={inputStyle}>
                {PHASES.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Days / week</label>
              <select value={intake.days_per_week} onChange={(e) => setField('days_per_week', e.target.value)} className={fld} style={inputStyle}>
                {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Primary focus</label>
              <select value={intake.primary_quality} onChange={(e) => setField('primary_quality', e.target.value)} className={fld} style={inputStyle}>
                <option value="">Auto (event default)</option>
                {QUALITIES.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Secondary (optional)</label>
              <select value={intake.secondary_quality} onChange={(e) => setField('secondary_quality', e.target.value)} className={fld} style={inputStyle}>
                <option value="">None</option>
                {QUALITIES.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Equipment</label>
              <select value={intake.equipment} onChange={(e) => setField('equipment', e.target.value)} className={fld} style={inputStyle}>
                {EQUIPMENT.map((q) => <option key={q.v} value={q.v}>{q.l}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Training age (yrs)</label>
              <input type="number" value={intake.training_age_years} onChange={(e) => setField('training_age_years', e.target.value)}
                placeholder="optional" className={`${fld} placeholder-slate-600`} style={inputStyle} />
            </div>
          </div>

          <div>
            <label className={lbl}>Any current pain / niggles? (so we work around it safely)</label>
            <div className="flex flex-wrap gap-1.5">
              {INJURY_AREAS.map((a) => {
                const on = intake.injuries.includes(a.v)
                return (
                  <button key={a.v} type="button" onClick={() => toggleInjury(a.v)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold landing-font transition-colors"
                    style={on
                      ? { background: 'rgba(251,113,133,0.18)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.4)' }
                      : { background: 'rgba(255,255,255,0.03)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {a.l}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className={lbl}>Anything specific to target? (optional)</label>
            <input value={intake.goal} onChange={(e) => setField('goal', e.target.value)}
              placeholder="e.g. drive phase, top-end speed, bend running"
              className={`${fld} placeholder-slate-600`} style={inputStyle} />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={generate} disabled={generating}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold text-black landing-font disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#f97316,#fbbf24)' }}>
              {generating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Building your plan…</> : <><Sparkles className="w-3.5 h-3.5" /> Generate program</>}
            </button>
            <button onClick={() => { setShowForm(false); setError('') }} disabled={generating}
              className="px-3 py-2 rounded-lg text-[11px] text-slate-400 landing-font hover:text-white">Cancel</button>
          </div>
          <p className="text-[10px] text-slate-500 landing-font">
            Educational guidance, not medical advice. Review with your coach (and a parent/guardian if under 18) before starting. Stop and see a professional if anything hurts.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-red-400 text-[11px] landing-font mb-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      {loading ? (
        <p className="text-[12px] text-slate-500 landing-font">Loading…</p>
      ) : programs.length === 0 && !showForm ? (
        <p className="text-[12px] text-slate-500 landing-font">No programs yet. Generate one tailored to your event, season phase, and development stage.</p>
      ) : (
        <div className="space-y-2">
          {programs.map((p) => (
            <ProgramCard key={p.id} program={p} open={openId === p.id}
              onToggle={() => setOpenId(openId === p.id ? null : p.id)} onDelete={() => remove(p.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// One fully-prescribed exercise row: name + prescription headline, then the
// intensity / rest / tempo meta and a short coaching cue.
function ExerciseRow({ ex }) {
  if (!ex) return null
  const skip = (v) => v && String(v).trim() && String(v).trim() !== '—' && String(v).trim() !== '-'
  const meta = []
  if (skip(ex.intensity)) meta.push(ex.intensity)
  if (skip(ex.rest)) meta.push(`rest ${ex.rest}`)
  if (skip(ex.tempo)) meta.push(`tempo ${ex.tempo}`)
  return (
    <div className="rounded-md px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-100 landing-font">{ex.name}</span>
        {skip(ex.prescription) && <span className="text-[11px] font-bold text-orange-300 mono-font whitespace-nowrap flex-shrink-0">{ex.prescription}</span>}
      </div>
      {meta.length > 0 && <p className="text-[10px] text-slate-400 mono-font mt-0.5">{meta.join(' · ')}</p>}
      {skip(ex.cue) && <p className="text-[10px] text-slate-500 landing-font italic mt-0.5">{ex.cue}</p>}
    </div>
  )
}

function ProgramCard({ program, open, onToggle, onDelete }) {
  const s = program.structure || {}
  const sessions = Array.isArray(s.sessions) ? s.sessions : []
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-bold text-white landing-font truncate">{s.title || program.title}</p>
            {(program.source === 'coach' || (program.created_by && program.athlete_user_id && program.created_by !== program.athlete_user_id)) && (
              <span className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)' }}>From coach</span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 landing-font truncate">
            {s.duration_weeks ? `${s.duration_weeks} wk` : ''}{s.sessions_per_week ? ` · ${s.sessions_per_week}×/wk` : ''}{s.summary ? ` · ${s.summary}` : ''}
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {s.maturity_note && (
            <p className="text-[11px] text-orange-300 landing-font mt-3" style={{ background: 'rgba(249,115,22,0.06)', borderRadius: 8, padding: 8 }}>🌱 {s.maturity_note}</p>
          )}
          {sessions.map((sess, i) => (
            <div key={i} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-[12px] font-bold text-white landing-font">{sess.label || `Session ${i + 1}`}</p>
              {sess.focus && <p className="text-[10px] text-orange-400 mono-font uppercase tracking-wider mt-0.5">{sess.focus}</p>}
              <div className="mt-2 space-y-2">
                {(Array.isArray(sess.blocks) ? sess.blocks : []).map((b, j) => (
                  <div key={j}>
                    <p className="text-[11px] font-semibold text-slate-200 landing-font mb-1">{b.name}</p>
                    {Array.isArray(b.exercises) && b.exercises.length > 0 ? (
                      <div className="space-y-1.5">
                        {b.exercises.map((ex, k) => (
                          <ExerciseRow key={k} ex={ex} />
                        ))}
                      </div>
                    ) : (
                      // Back-compat: older programs stored a free-text detail string.
                      <p className="text-[11px] text-slate-400 landing-font leading-snug">{b.detail}</p>
                    )}
                  </div>
                ))}
              </div>
              {sess.notes && <p className="text-[10px] text-slate-500 landing-font mt-2 italic">{sess.notes}</p>}
            </div>
          ))}
          {s.progression && <p className="text-[11px] text-slate-300 landing-font"><span className="font-semibold">Progression:</span> {s.progression}</p>}
          {s.safety_note && <p className="text-[10px] text-slate-500 landing-font">⚠ {s.safety_note}</p>}
          <button onClick={onDelete} className="flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-red-400 landing-font">
            <Trash2 className="w-3 h-3" /> Delete program
          </button>
        </div>
      )}
    </div>
  )
}

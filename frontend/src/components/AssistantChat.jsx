// ═══════════════════════════════════════════════════════════════════════
// ASSISTANT CHAT (web) — Assistant Coach
// Floating chat widget. The client fetches the user's OWN data (RLS/consent-
// scoped) via `fetchContext`, and sends it with each request to the backend,
// which reasons over it with the LLM. The assistant never sees anything the
// user can't.
//
//  ASK mode (coach + athlete): read-only Q&A over the data.
//  BUILD mode (coach only): the coach picks a linked athlete and describes a
//    program in plain language; the AI generates a fully-prescribed block from
//    that athlete's real data, shown inline with a one-tap "Save to <name>"
//    that writes it to the athlete's account (they see it labelled "from coach").
//
// Props:
//   role          — 'coach' | 'athlete'
//   fetchContext  — async () => object  (the data the assistant may use)
//   title         — header label (optional)
//   currentUserId — the signed-in user's id (coach; used as created_by on save)
// ═══════════════════════════════════════════════════════════════════════
import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, Send, X, Loader2, Dumbbell, Sparkles, Check, MessageSquare } from 'lucide-react'
import { insertInto } from '../lib/supabaseRest'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://web-production-295f1.up.railway.app'

const skip = (v) => v && String(v).trim() && String(v).trim() !== '—' && String(v).trim() !== '-'

export default function AssistantChat({ role = 'coach', fetchContext, title = 'Assistant Coach', currentUserId }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])   // {role, content} | {role:'assistant', kind:'program', ...}
  const [sending, setSending] = useState(false)
  const [context, setContext] = useState(null)
  const [mode, setMode] = useState('ask')         // 'ask' | 'program' (coach only)
  const [targetId, setTargetId] = useState('')    // selected athlete_user_id
  const scrollRef = useRef(null)

  const ensureContext = useCallback(async () => {
    if (context != null) return context
    try {
      const c = (await fetchContext?.()) || {}
      setContext(c)
      return c
    } catch {
      setContext({})
      return {}
    }
  }, [context, fetchContext])

  useEffect(() => {
    if (open && context == null) ensureContext()
  }, [open, context, ensureContext])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const athletes = Array.isArray(context?.athletes) ? context.athletes.filter((a) => a.athlete_user_id) : []
  const canBuild = role === 'coach' && athletes.length > 0
  const target = athletes.find((a) => a.athlete_user_id === targetId) || null

  // ── ASK: read-only Q&A ────────────────────────────────────────────────
  const ask = async (q) => {
    const history = messages.filter((m) => typeof m.content === 'string').map((m) => ({ role: m.role, content: m.content }))
    setMessages((m) => [...m, { role: 'user', content: q }])
    setSending(true)
    try {
      const ctx = await ensureContext()
      const res = await fetch(`${API_BASE}/api/v1/assistant`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, question: q, context: ctx, history }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.detail || `Server error ${res.status}`) }
      const data = await res.json()
      setMessages((m) => [...m, { role: 'assistant', content: data.answer || '…' }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `Sorry — ${err.message || 'I could not answer that right now.'}` }])
    } finally { setSending(false) }
  }

  // ── BUILD: generate a program for the selected athlete from a NL brief ──
  const build = async (brief) => {
    if (!target) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Pick which athlete this program is for first (the selector above the box).' }])
      return
    }
    setMessages((m) => [...m, { role: 'user', content: brief }])
    setSending(true)
    try {
      const res = await fetch(`${API_BASE}/api/v1/assistant/program`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'coach', context: target, brief, weeks: 4 }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.detail || `Server error ${res.status}`) }
      const { program, resolved } = await res.json()
      if (!program || !program.title) throw new Error('The program came back empty — try again.')
      setMessages((m) => [...m, {
        role: 'assistant', kind: 'program', program, resolved,
        athleteName: target.name, athleteUserId: target.athlete_user_id,
        maturity: target.maturity || null, brief, saved: false, saving: false, saveError: null,
      }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `Sorry — ${err.message || 'I could not build that program.'}` }])
    } finally { setSending(false) }
  }

  const send = () => {
    const q = input.trim()
    if (!q || sending) return
    setInput('')
    if (mode === 'program' && canBuild) build(q)
    else ask(q)
  }

  const saveProgram = async (idx) => {
    const msg = messages[idx]
    if (!msg || msg.saved || msg.saving) return
    setMessages((m) => m.map((x, i) => i === idx ? { ...x, saving: true, saveError: null } : x))
    try {
      await insertInto('programs', {
        athlete_user_id: msg.athleteUserId,
        created_by: currentUserId,
        source: 'coach',
        title: msg.program.title,
        goal: (msg.brief || '').trim().slice(0, 500) || null,
        structure: msg.program,
        maturity_context: msg.maturity ? JSON.stringify(msg.maturity) : null,
      })
      setMessages((m) => m.map((x, i) => i === idx ? { ...x, saving: false, saved: true } : x))
    } catch (e) {
      setMessages((m) => m.map((x, i) => i === idx ? { ...x, saving: false, saveError: e.message?.replace(/^Supabase \d+:\s*/, '') || 'Could not save.' } : x))
    }
  }

  const suggestions = mode === 'program'
    ? ['6-week pre-season speed block, 4 days, full gym', 'In-season maintenance, 3 days, sharpen top-end speed', 'Off-season strength base, 4 days, watch his knee']
    : role === 'coach'
      ? ['Who improved most recently?', 'Who hasn’t logged in a while?', 'What was my fastest athlete’s last result?']
      : ['How close am I to the next tier?', 'What was my last result?', 'How’s my streak?']

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-[120] flex items-center gap-2 px-4 py-3 rounded-full text-black font-bold text-[12px] landing-font shadow-lg hover:brightness-110 transition-all"
          style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)', boxShadow: '0 8px 28px rgba(249,115,22,0.45)' }}>
          <Bot className="w-4 h-4" /> Ask
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-[120] w-[92vw] max-w-sm rounded-2xl overflow-hidden flex flex-col"
          style={{ height: 'min(78vh, 640px)', background: 'linear-gradient(170deg,#11131a,#0a0a0f)', border: '1px solid rgba(249,115,22,0.25)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f97316,#fbbf24)' }}>
              <Bot className="w-4 h-4 text-black" />
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-bold text-white landing-font leading-none">{title}</p>
              <p className="text-[9px] text-slate-500 mono-font mt-0.5">{mode === 'program' ? 'Builds programs from your athletes’ data' : 'Reads your data · answers only'}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          {/* Mode switch (coach only) */}
          {canBuild && (
            <div className="flex gap-1 px-3 pt-2.5">
              <ModeTab active={mode === 'ask'} onClick={() => setMode('ask')} icon={MessageSquare} label="Ask" />
              <ModeTab active={mode === 'program'} onClick={() => setMode('program')} icon={Dumbbell} label="Build program" />
            </div>
          )}

          {/* Athlete target picker (program mode) */}
          {canBuild && mode === 'program' && (
            <div className="px-3 pt-2">
              <label className="block text-[9px] uppercase tracking-wider text-slate-500 mono-font mb-1">Build for</label>
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-[12px] text-white landing-font focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <option value="">Select an athlete…</option>
                {athletes.map((a) => (
                  <option key={a.athlete_user_id} value={a.athlete_user_id}>
                    {a.name}{a.discipline ? ` · ${a.discipline}` : ''}{a.age != null ? ` · ${a.age}y` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {messages.length === 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-[12px] text-slate-400 landing-font px-1">
                  {mode === 'program' ? 'Describe the program you want — I’ll build it from their data:' : `Ask me about ${role === 'coach' ? 'your athletes' : 'your training'}:`}
                </p>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => setInput(s)}
                    className="block w-full text-left text-[11px] text-slate-300 landing-font rounded-lg px-3 py-2 hover:text-white transition-colors"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              m.kind === 'program'
                ? <ProgramMessage key={i} msg={m} onSave={() => saveProgram(i)} />
                : (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12px] landing-font leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'text-black' : 'text-slate-200'}`}
                      style={m.role === 'user'
                        ? { background: 'linear-gradient(135deg,#f97316,#fb923c)' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {m.content}
                    </div>
                  </div>
                )
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                  {mode === 'program' && <span className="text-[11px] text-slate-400 landing-font">Building the program…</span>}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex gap-2">
              <input
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder={mode === 'program' ? 'e.g. 6-week pre-season speed block, 4 days…' : 'Ask a question…'}
                className="flex-1 px-3 py-2 rounded-lg text-[12px] text-white placeholder-slate-500 landing-font focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              />
              <button onClick={send} disabled={sending || !input.trim()}
                className="px-3 rounded-lg text-black disabled:opacity-50 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#f97316,#fb923c)' }}>
                {mode === 'program' ? <Sparkles className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[9px] text-slate-600 landing-font mt-2 leading-snug px-0.5">
              Educational guidance, not medical advice. For pain, injury, or health concerns, see a qualified professional. Always involve your coach{role === 'athlete' ? ' or a parent/guardian' : ''}.
            </p>
          </div>
        </div>
      )}
    </>
  )
}

function ModeTab({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold landing-font transition-colors"
      style={active
        ? { background: 'rgba(249,115,22,0.16)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.35)' }
        : { background: 'rgba(255,255,255,0.03)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' }}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  )
}

// Inline rendering of a generated program inside the chat, with one-tap save.
function ProgramMessage({ msg, onSave }) {
  const p = msg.program || {}
  const r = msg.resolved || {}
  const sessions = Array.isArray(p.sessions) ? p.sessions : []
  const chips = [r.season_phase, r.primary_quality, r.days_per_week ? `${r.days_per_week}×/wk` : null, r.weeks ? `${r.weeks} wk` : null].filter(Boolean)
  return (
    <div className="rounded-2xl px-3 py-3 space-y-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(249,115,22,0.25)' }}>
      <div>
        <p className="text-[12px] font-bold text-white landing-font">{p.title}</p>
        {p.summary && <p className="text-[10px] text-slate-400 landing-font mt-0.5 leading-snug">{p.summary}</p>}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {chips.map((c, i) => <span key={i} className="text-[9px] text-orange-300 mono-font px-1.5 py-0.5 rounded" style={{ background: 'rgba(249,115,22,0.1)' }}>{c}</span>)}
          </div>
        )}
      </div>

      {p.maturity_note && <p className="text-[10px] text-orange-300 landing-font" style={{ background: 'rgba(249,115,22,0.06)', borderRadius: 8, padding: 7 }}>🌱 {p.maturity_note}</p>}

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {sessions.map((s, i) => (
          <div key={i} className="rounded-lg p-2.5" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <p className="text-[11px] font-bold text-white landing-font">{s.label || `Day ${i + 1}`}</p>
            {s.focus && <p className="text-[9px] text-orange-400 mono-font uppercase tracking-wider mt-0.5">{s.focus}</p>}
            <div className="mt-1.5 space-y-1.5">
              {(Array.isArray(s.blocks) ? s.blocks : []).map((b, j) => (
                <div key={j}>
                  <p className="text-[10px] font-semibold text-slate-300 landing-font mb-0.5">{b.name}</p>
                  {Array.isArray(b.exercises) && b.exercises.length > 0 ? b.exercises.map((ex, k) => {
                    const meta = []
                    if (skip(ex.intensity)) meta.push(ex.intensity)
                    if (skip(ex.rest)) meta.push(`rest ${ex.rest}`)
                    if (skip(ex.tempo)) meta.push(`tempo ${ex.tempo}`)
                    return (
                      <div key={k} className="mb-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] text-slate-200 landing-font">{ex.name}</span>
                          {skip(ex.prescription) && <span className="text-[10px] font-bold text-orange-300 mono-font whitespace-nowrap flex-shrink-0">{ex.prescription}</span>}
                        </div>
                        {meta.length > 0 && <p className="text-[9px] text-slate-500 mono-font">{meta.join(' · ')}</p>}
                        {skip(ex.cue) && <p className="text-[9px] text-slate-500 landing-font italic">{ex.cue}</p>}
                      </div>
                    )
                  }) : <p className="text-[10px] text-slate-400 landing-font leading-snug">{b.detail}</p>}
                </div>
              ))}
            </div>
            {s.notes && <p className="text-[9px] text-slate-500 landing-font mt-1 italic">{s.notes}</p>}
          </div>
        ))}
      </div>

      {p.progression && <p className="text-[10px] text-slate-300 landing-font"><span className="font-semibold">Progression:</span> {p.progression}</p>}

      {msg.saveError && <p className="text-[10px] text-red-400 landing-font">{msg.saveError}</p>}
      {msg.saved ? (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 landing-font font-semibold">
          <Check className="w-4 h-4" /> Saved — {msg.athleteName} will see this in their Programs tab.
        </div>
      ) : (
        <button onClick={onSave} disabled={msg.saving}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold text-black landing-font disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#f97316,#fbbf24)' }}>
          {msg.saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <>Save to {msg.athleteName}</>}
        </button>
      )}
    </div>
  )
}

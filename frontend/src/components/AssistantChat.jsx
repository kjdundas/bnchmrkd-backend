// ═══════════════════════════════════════════════════════════════════════
// ASSISTANT CHAT (web) — Assistant Coach v1 (read-only)
// Floating chat widget. The client fetches the user's OWN data (RLS/consent-
// scoped) via `fetchContext`, and sends it with each question to the backend
// /api/v1/assistant endpoint, which reasons over it with the LLM. The
// assistant can never see anything the user can't.
//
// Props:
//   role        — 'coach' | 'athlete'
//   fetchContext — async () => object  (the data the assistant may use)
//   title       — header label (optional)
// ═══════════════════════════════════════════════════════════════════════
import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, Send, X, Loader2 } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://web-production-295f1.up.railway.app'

export default function AssistantChat({ role = 'coach', fetchContext, title = 'Assistant Coach' }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])   // { role: 'user'|'assistant', content }
  const [sending, setSending] = useState(false)
  const [context, setContext] = useState(null)
  const scrollRef = useRef(null)

  // Fetch the data context once when the chat is first opened.
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

  const send = async () => {
    const q = input.trim()
    if (!q || sending) return
    setInput('')
    const history = messages
    setMessages((m) => [...m, { role: 'user', content: q }])
    setSending(true)
    try {
      const ctx = await ensureContext()
      const res = await fetch(`${API_BASE}/api/v1/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, question: q, context: ctx, history }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `Server error ${res.status}`)
      }
      const data = await res.json()
      setMessages((m) => [...m, { role: 'assistant', content: data.answer || '…' }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `Sorry — ${err.message || 'I could not answer that right now.'}` }])
    } finally {
      setSending(false)
    }
  }

  const suggestions = role === 'coach'
    ? ['Who improved most recently?', 'What was my fastest athlete’s last result?', 'Who hasn’t logged in a while?']
    : ['How close am I to the next tier?', 'What was my last result?', 'How’s my streak?']

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-[120] flex items-center gap-2 px-4 py-3 rounded-full text-black font-bold text-[12px] landing-font shadow-lg hover:brightness-110 transition-all"
          style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)', boxShadow: '0 8px 28px rgba(249,115,22,0.45)' }}
        >
          <Bot className="w-4 h-4" /> Ask
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-[120] w-[92vw] max-w-sm rounded-2xl overflow-hidden flex flex-col"
          style={{ height: 'min(70vh, 560px)', background: 'linear-gradient(170deg,#11131a,#0a0a0f)', border: '1px solid rgba(249,115,22,0.25)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f97316,#fbbf24)' }}>
              <Bot className="w-4 h-4 text-black" />
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-bold text-white landing-font leading-none">{title}</p>
              <p className="text-[9px] text-slate-500 mono-font mt-0.5">Reads your data · answers only</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {messages.length === 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-[12px] text-slate-400 landing-font px-1">Ask me about {role === 'coach' ? 'your athletes' : 'your training'}:</p>
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
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12px] landing-font leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'text-black' : 'text-slate-200'}`}
                  style={m.role === 'user'
                    ? { background: 'linear-gradient(135deg,#f97316,#fb923c)' }
                    : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
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
                placeholder="Ask a question…"
                className="flex-1 px-3 py-2 rounded-lg text-[12px] text-white placeholder-slate-500 landing-font focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              />
              <button onClick={send} disabled={sending || !input.trim()}
                className="px-3 rounded-lg text-black disabled:opacity-50 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#f97316,#fb923c)' }}>
                <Send className="w-4 h-4" />
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

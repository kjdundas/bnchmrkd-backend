// ═══════════════════════════════════════════════════════════════════════
// INVITE ATHLETE PANEL (coach, web) — Phase A · A5
// Send a consent invite to a real athlete by email, and manage sent invites
// + linked athletes. Backed by the invite_athlete / revoke_link / get_my_links
// RPCs (consent enforced server-side).
// ═══════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { Mail, Link2, Check, X, Clock, Copy, UserCheck, AlertCircle, Loader2 } from 'lucide-react'
import { callRpc } from '../../lib/supabaseRest'

export default function InviteAthletePanel({ onClose }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)   // { delivery, link_id, invite_token }
  const [links, setLinks] = useState([])
  const [loadingLinks, setLoadingLinks] = useState(true)
  const [copied, setCopied] = useState(false)

  const loadLinks = useCallback(async () => {
    setLoadingLinks(true)
    try {
      const rows = await callRpc('get_my_links')
      setLinks(Array.isArray(rows) ? rows : [])
    } catch {
      setLinks([])
    } finally {
      setLoadingLinks(false)
    }
  }, [])

  useEffect(() => { loadLinks() }, [loadLinks])

  const sendInvite = async () => {
    const e = email.trim()
    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      setError('Enter a valid email address.')
      return
    }
    setError(''); setResult(null); setSending(true)
    try {
      const res = await callRpc('invite_athlete', { p_email: e })
      const data = Array.isArray(res) ? res[0] : res
      setResult(data)
      setEmail('')
      loadLinks()
    } catch (err) {
      setError(err.message?.replace(/^Supabase \d+:\s*/, '') || 'Could not send invite.')
    } finally {
      setSending(false)
    }
  }

  const revoke = async (linkId) => {
    try {
      await callRpc('revoke_link', { p_link_id: linkId })
      loadLinks()
    } catch (err) {
      setError(err.message || 'Could not remove link.')
    }
  }

  const shareLink = result?.invite_token
    ? `${window.location.origin}/?invite=${result.invite_token}`
    : null

  const copyShare = () => {
    if (!shareLink) return
    navigator.clipboard?.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pending = links.filter(l => l.status === 'pending')
  const active = links.filter(l => l.status === 'active')

  return (
    <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-orange-400" />
          <h3 className="text-[12px] font-semibold text-white uppercase tracking-wider landing-font">Invite Athlete</h3>
        </div>
        {onClose && <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>}
      </div>
      <p className="text-[11px] text-slate-400 landing-font mb-4 leading-relaxed">
        Send a link request to an athlete's account. They approve it before you can see their data — and can revoke anytime.
      </p>

      {/* Email form */}
      <div className="flex gap-2">
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendInvite()}
          placeholder="athlete@email.com"
          className="flex-1 px-3 py-2 rounded-lg text-[12px] text-white placeholder-slate-500 landing-font focus:outline-none focus:ring-1 focus:ring-orange-500/30"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        />
        <button onClick={sendInvite} disabled={sending}
          className="px-4 py-2 rounded-lg text-[11px] font-bold text-black landing-font hover:brightness-110 transition-all disabled:opacity-60 flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}>
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
          {sending ? 'Sending…' : 'Send invite'}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-red-400 text-[11px] landing-font">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* Result */}
      {result && result.delivery === 'in_app' && (
        <div className="mt-3 flex items-start gap-2 text-emerald-400 text-[11px] landing-font">
          <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          Invite sent — they'll see a request in their bnchmrkd app to approve.
        </div>
      )}
      {result && result.delivery === 'share_link' && shareLink && (
        <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <p className="text-[11px] text-slate-300 landing-font mb-2 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-blue-400" /> No account found — share this sign-up link with them:
          </p>
          <div className="flex gap-2">
            <input readOnly value={shareLink}
              className="flex-1 px-2.5 py-1.5 rounded text-[10px] text-slate-300 landing-font"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }} />
            <button onClick={copyShare} className="px-2.5 py-1.5 rounded text-[10px] font-bold text-white flex items-center gap-1"
              style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)' }}>
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
      {result && result.result === 'already' && (
        <div className="mt-3 text-[11px] text-slate-400 landing-font">That athlete is already invited or linked.</div>
      )}

      {/* Pending invites */}
      {!loadingLinks && pending.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mono-font mb-2">Pending invites</p>
          <div className="space-y-1.5">
            {pending.map(l => (
              <div key={l.link_id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="text-[12px] text-white landing-font truncate">{l.counterparty_name || l.invite_email}</span>
                </div>
                <button onClick={() => revoke(l.link_id)} className="text-[10px] text-slate-500 hover:text-red-400 landing-font">Cancel</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked athletes */}
      {!loadingLinks && active.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mono-font mb-2">Linked athletes</p>
          <div className="space-y-1.5">
            {active.map(l => (
              <div key={l.link_id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span className="text-[12px] text-white landing-font truncate">{l.counterparty_name || l.invite_email}</span>
                </div>
                <button onClick={() => revoke(l.link_id)} className="text-[10px] text-slate-500 hover:text-red-400 landing-font">Unlink</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

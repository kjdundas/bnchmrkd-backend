// ═══════════════════════════════════════════════════════════════════════
// ATHLETE COACH LINKS (web) — Phase A · A6
// Shows a pending coach invite (approve / decline) and the athlete's active
// coaches (with revoke). Backed by get_my_links / respond_to_invite /
// revoke_link RPCs. Athlete is always in control of who sees their data.
//
// Props:
//   pendingOnly — when true, render only pending invites (or null if none).
//                 Used as a prompt on the home screen.
// ═══════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { UserCheck, Shield, Check, X, Loader2, AlertCircle } from 'lucide-react'
import { callRpc } from '../../lib/supabaseRest'

export default function AthleteCoachLinks({ pendingOnly = false }) {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)   // link_id currently acting on
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await callRpc('get_my_links')
      setLinks(Array.isArray(rows) ? rows : [])
    } catch {
      setLinks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const respond = async (linkId, accept) => {
    setBusy(linkId); setError('')
    try {
      await callRpc('respond_to_invite', { p_link_id: linkId, p_accept: accept })
      await load()
    } catch (err) {
      setError(err.message?.replace(/^Supabase \d+:\s*/, '') || 'Something went wrong.')
    } finally {
      setBusy(null)
    }
  }

  const revoke = async (linkId) => {
    setBusy(linkId); setError('')
    try {
      await callRpc('revoke_link', { p_link_id: linkId })
      await load()
    } catch (err) {
      setError(err.message || 'Could not revoke.')
    } finally {
      setBusy(null)
    }
  }

  const pending = links.filter(l => l.status === 'pending')
  const active = links.filter(l => l.status === 'active')

  if (loading) return null
  if (pendingOnly && pending.length === 0) return null

  return (
    <div className="space-y-4">
      {/* Pending invites */}
      {pending.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.25)' }}>
          <p className="text-[11px] uppercase tracking-wider text-orange-300 mono-font mb-3 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Coach {pending.length > 1 ? 'requests' : 'request'}
          </p>
          <div className="space-y-2">
            {pending.map(l => (
              <div key={l.link_id} className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <p className="text-[13px] text-white landing-font mb-0.5">
                  <span className="font-semibold">{l.counterparty_name || 'A coach'}</span>
                  {l.counterparty_org ? <span className="text-slate-400"> · {l.counterparty_org}</span> : null}
                </p>
                <p className="text-[11px] text-slate-400 landing-font mb-2.5">
                  wants to connect and view your performance data. You can revoke this anytime.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => respond(l.link_id, true)} disabled={busy === l.link_id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold text-black landing-font hover:brightness-110 disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}>
                    {busy === l.link_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve
                  </button>
                  <button onClick={() => respond(l.link_id, false)} disabled={busy === l.link_id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold text-slate-300 landing-font hover:text-white disabled:opacity-60"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <X className="w-3.5 h-3.5" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active coaches ("Your coaches") */}
      {!pendingOnly && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mono-font mb-2 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" /> Your coaches
          </p>
          {active.length === 0 ? (
            <p className="text-[12px] text-slate-500 landing-font">No coaches connected. When you approve a coach request, they'll appear here.</p>
          ) : (
            <div className="space-y-1.5">
              {active.map(l => (
                <div key={l.link_id} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="min-w-0">
                    <p className="text-[13px] text-white landing-font truncate">{l.counterparty_name || 'Coach'}</p>
                    {l.counterparty_org ? <p className="text-[10px] text-slate-500 landing-font truncate">{l.counterparty_org}</p> : null}
                  </div>
                  <button onClick={() => revoke(l.link_id)} disabled={busy === l.link_id}
                    className="text-[10px] font-semibold text-slate-500 hover:text-red-400 landing-font disabled:opacity-60">
                    {busy === l.link_id ? '…' : 'Revoke'}
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-600 landing-font mt-2">Coaches you approve can see your results and progress. Revoke anytime to cut their access instantly.</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-red-400 text-[11px] landing-font">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// GAMIFICATION UI (web) — XP bar, streak chip, and the post-log celebration.
// Visual parity with the mobile GamificationUI; pure presentational.
// ═══════════════════════════════════════════════════════════════════════
import { useEffect } from 'react'
import { Flame, X, ChevronUp } from 'lucide-react'
import { getLevelFromXP } from '../../lib/gamification'

// One-time keyframes for the celebration entrance.
const ANIM_CSS = `
@keyframes bnchPop { 0% { transform: translateY(8px) scale(.96); opacity: 0 } 100% { transform: translateY(0) scale(1); opacity: 1 } }
@keyframes bnchFill { from { width: 0 } }
`

function StyleOnce() {
  return <style dangerouslySetInnerHTML={{ __html: ANIM_CSS }} />
}

// ── XP / Level bar ──────────────────────────────────────────────────────
export function XPBar({ totalXP = 0, compact = false }) {
  const lvl = getLevelFromXP(totalXP)
  const pct = Math.max(0, Math.min(100, Math.round(lvl.progress * 100)))
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 18 }}>{lvl.icon}</span>
          <div>
            <div className="landing-font text-white text-[13px] font-bold leading-none">Lv {lvl.level} · {lvl.title}</div>
            {!compact && (
              <div className="mono-font text-[9px] uppercase tracking-[0.18em] text-slate-500 mt-1">
                {lvl.next ? `${lvl.xpInLevel} / ${lvl.xpForNext} XP to Lv ${lvl.next.level}` : 'Max level'}
              </div>
            )}
          </div>
        </div>
        <div className="mono-font text-[11px] font-bold text-orange-400">{totalXP.toLocaleString()} XP</div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#f97316,#fb923c)', transition: 'width .5s ease' }} />
      </div>
    </div>
  )
}

// ── Streak chip ─────────────────────────────────────────────────────────
export function StreakChip({ streak = 0 }) {
  if (!streak) return null
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}>
      <Flame className="w-3.5 h-3.5" style={{ color: '#fb923c' }} />
      <span className="mono-font text-[11px] font-bold text-orange-300">{streak} day{streak === 1 ? '' : 's'}</span>
    </div>
  )
}

// ── Post-log celebration overlay ─────────────────────────────────────────
// data: { total, breakdown, message, newBadges, leveledUp, newLevel, isPB, pbText }
export function LogCelebration({ show, data, onClose }) {
  useEffect(() => {
    if (!show) return
    const t = setTimeout(onClose, data?.leveledUp || data?.newBadges?.length ? 6000 : 4200)
    return () => clearTimeout(t)
  }, [show, data, onClose])

  if (!show || !data) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
        padding: '0 16px 24px',
      }}
    >
      <StyleOnce />
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl p-5"
        style={{
          background: 'linear-gradient(160deg,#1a1207,#0d0d0f)',
          border: '1px solid rgba(249,115,22,0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          animation: 'bnchPop .35s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            {data.isPB && (
              <div className="mono-font text-[10px] uppercase tracking-[0.22em] text-orange-400 mb-1">★ Personal Best</div>
            )}
            <div className="landing-font text-white text-xl font-bold leading-tight">+{data.total} XP</div>
            {data.pbText && <div className="mono-font text-[11px] text-orange-300 mt-1">{data.pbText}</div>}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {data.message && <p className="landing-font text-slate-300 text-[13px] leading-snug mb-3">{data.message}</p>}

        {/* XP breakdown */}
        {data.breakdown?.length > 0 && (
          <div className="space-y-1 mb-3">
            {data.breakdown.map((b, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="landing-font text-[11px] text-slate-400">{b.reason}</span>
                <span className="mono-font text-[11px] font-bold text-orange-400">+{b.xp}</span>
              </div>
            ))}
          </div>
        )}

        {/* Level up */}
        {data.leveledUp && data.newLevel && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-2"
            style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}>
            <ChevronUp className="w-4 h-4 text-orange-400" />
            <span className="landing-font text-[12px] font-bold text-white">
              Level up! {data.newLevel.icon} Lv {data.newLevel.level} · {data.newLevel.title}
            </span>
          </div>
        )}

        {/* New badges */}
        {data.newBadges?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {data.newBadges.map((badge) => (
              <div key={badge.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: 14 }}>{badge.icon}</span>
                <span className="landing-font text-[11px] font-semibold text-white">{badge.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useMemo } from 'react';
import { Check } from 'lucide-react';
import { isTimeDiscipline } from '../lib/performanceLevels';

/**
 * CompetitionStandardsLadder
 * ─────────────────────────
 * A single ranked ladder of every competition standard the athlete could chase.
 * Hardest marks sit at the top, easiest at the bottom. A glowing "YOU" line
 * sits at the athlete's PB — everything above it is a target (with live gap),
 * everything below it has been cleared. The closest uncleared mark is
 * highlighted as the "NEXT" target.
 *
 * Props:
 *   standards      — Array<{ label, color, compTier, ageGroup, qual?, semi?, p8, bronze, gold, met }>
 *   personalBest   — number (seconds for track, metres for field)
 *   discipline     — e.g. "100m", "Shot Put"
 *   gender         — "Male" | "Female"
 *   wr             — optional number (world-record mark to display as header chip)
 */

const MARK_META = {
  ENTRY:  { short: 'ENTRY',  long: 'Entry standard', color: '#8b5cf6' },
  SEMI:   { short: 'SEMI',   long: 'Semi-final mark', color: '#3b82f6' },
  '8TH':  { short: '8TH',    long: '8th-place mark',  color: '#10b981' },
  BRONZE: { short: 'BRONZE', long: 'Bronze medal',    color: '#CD7F32' },
  GOLD:   { short: 'GOLD',   long: 'Gold medal',      color: '#FFD700' },
};

const TIER_META = {
  all:         { label: 'All',      color: '#f97316' },
  world:       { label: 'World',    color: '#FFD700' },
  regional:    { label: 'Regional', color: '#E84545' },
  development: { label: 'Dev',      color: '#A259FF' },
};

export default function CompetitionStandardsLadder({
  standards,
  personalBest,
  discipline,
  gender,
  wr,
}) {
  const [tier, setTier] = useState('all');
  const pb = typeof personalBest === 'number' ? personalBest : parseFloat(personalBest);
  const isTime = isTimeDiscipline(discipline);
  const unit = isTime ? 's' : 'm';

  const fmtMark = (v) => {
    if (v == null || Number.isNaN(v)) return '—';
    if (!isTime) return v.toFixed(2);
    if (v >= 60) {
      const m = Math.floor(v / 60);
      const s = (v % 60).toFixed(2);
      return `${m}:${s.padStart(5, '0')}`;
    }
    return v.toFixed(2);
  };
  const fmtGap = (mark) => Math.abs(mark - pb).toFixed(2);
  const beats = (mark) => isTime ? pb <= mark : pb >= mark;

  const tierCounts = useMemo(() => ({
    all: standards.length,
    world: standards.filter(s => s.compTier === 'world').length,
    regional: standards.filter(s => s.compTier === 'regional').length,
    development: standards.filter(s => s.compTier === 'development').length,
  }), [standards]);

  const visibleTiers = ['world', 'regional', 'development'].filter(t => tierCounts[t] > 0);
  const showTierTabs = visibleTiers.length > 1;

  const filtered = tier === 'all' ? standards : standards.filter(s => s.compTier === tier);

  // Flatten every mark into a ladder row
  const rows = useMemo(() => {
    const r = [];
    filtered.forEach(std => {
      const base = { comp: std.label, compColor: std.color, compTier: std.compTier, ageGroup: std.ageGroup };
      if (std.qual   != null) r.push({ ...base, type: 'ENTRY',  value: std.qual });
      if (std.semi   != null) r.push({ ...base, type: 'SEMI',   value: std.semi });
      if (std.p8     != null) r.push({ ...base, type: '8TH',    value: std.p8 });
      if (std.bronze != null) r.push({ ...base, type: 'BRONZE', value: std.bronze });
      if (std.gold   != null) r.push({ ...base, type: 'GOLD',   value: std.gold });
    });
    // Sort hardest → easiest (top → bottom)
    r.sort((a, b) => isTime ? a.value - b.value : b.value - a.value);
    return r;
  }, [filtered, isTime]);

  const uncleared = rows.filter(r => !beats(r.value));
  const cleared   = rows.filter(r =>  beats(r.value));
  const nextTarget = uncleared.length ? uncleared[uncleared.length - 1] : null;

  if (!rows.length) return null;

  return (
    <div
      className="bento-card rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Header */}
      <div className="mb-4">
        <p className="mono-font text-[10px] uppercase tracking-[0.22em] text-orange-300 mb-1">Competition Standards</p>
        <div className="flex items-end justify-between gap-3">
          <h3 className="landing-font text-lg sm:text-xl font-semibold text-white leading-tight">
            Where you stand
          </h3>
          <div className="flex items-center gap-2 pb-[2px]">
            {wr != null && !Number.isNaN(wr) && (
              <span
                className="mono-font text-[10px] tabular-nums px-2 py-[3px] rounded"
                style={{
                  background: 'rgba(255,45,85,0.08)',
                  border: '1px solid rgba(255,45,85,0.22)',
                  color: '#f87171',
                }}
              >
                WR&nbsp;{fmtMark(wr)}
              </span>
            )}
            <span className="mono-font text-[10px] text-slate-500 tabular-nums">
              {cleared.length}/{rows.length} cleared
            </span>
          </div>
        </div>
      </div>

      {/* Tier filter */}
      {showTierTabs && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          {['all', ...visibleTiers].map(t => {
            const on = tier === t;
            const m = TIER_META[t];
            return (
              <button
                key={t}
                onClick={() => setTier(t)}
                className="mono-font text-[10px] uppercase tracking-[0.14em] px-2.5 py-1 rounded-md transition-all flex-shrink-0"
                style={{
                  background: on ? `${m.color}15` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${on ? `${m.color}50` : 'rgba(255,255,255,0.05)'}`,
                  color: on ? m.color : '#64748b',
                }}
              >
                {m.label}
                <span className="ml-1.5 opacity-60">{tierCounts[t]}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Ladder */}
      <div className="relative">
        {/* Subtle rail */}
        <div
          className="absolute top-2 bottom-2 w-px"
          style={{
            left: '14px',
            background:
              'linear-gradient(180deg, rgba(148,163,184,0) 0%, rgba(148,163,184,0.12) 10%, rgba(148,163,184,0.12) 90%, rgba(148,163,184,0) 100%)',
          }}
        />

        {/* Uncleared (above YOU) */}
        {uncleared.map((row, i) => (
          <LadderRow
            key={`u${i}`}
            row={row}
            cleared={false}
            isNext={i === uncleared.length - 1}
            fmtMark={fmtMark}
            fmtGap={fmtGap}
            unit={unit}
          />
        ))}

        {/* YOU divider */}
        <div className="relative py-3 my-1 select-none">
          <div
            className="absolute inset-x-0 top-1/2 h-px"
            style={{
              transform: 'translateY(-0.5px)',
              background:
                'linear-gradient(90deg, transparent 0%, rgba(249,115,22,0.5) 12%, rgba(249,115,22,0.9) 50%, rgba(249,115,22,0.5) 88%, transparent 100%)',
              boxShadow: '0 0 10px rgba(249,115,22,0.35)',
            }}
          />
          <div className="relative flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: '#f97316',
                boxShadow:
                  '0 0 14px rgba(249,115,22,0.55), 0 0 0 3px rgba(249,115,22,0.12), 0 0 0 6px rgba(249,115,22,0.05)',
              }}
            >
              <span className="text-[8px] font-bold text-white mono-font tracking-wider">YOU</span>
            </div>
            <span className="mono-font text-sm font-bold tabular-nums text-orange-400">
              {fmtMark(pb)}<span className="text-[10px] text-orange-500/60 ml-0.5">{unit}</span>
            </span>
            <span className="mono-font text-[9px] uppercase tracking-[0.22em] text-orange-500/60 ml-auto">
              Personal best
            </span>
          </div>
        </div>

        {/* Cleared (below YOU) */}
        {cleared.map((row, i) => (
          <LadderRow
            key={`c${i}`}
            row={row}
            cleared={true}
            isNext={false}
            fmtMark={fmtMark}
            fmtGap={fmtGap}
            unit={unit}
          />
        ))}
      </div>

      {/* Footer */}
      <div
        className="mt-4 pt-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <span className="mono-font text-[10px] text-slate-600">
          {cleared.length} of {rows.length} standards cleared
          {tier !== 'all' && ` · ${TIER_META[tier].label} only`}
        </span>
        {nextTarget && (
          <span className="mono-font text-[10px] tabular-nums text-orange-400/90">
            Next&nbsp;·&nbsp;+{fmtGap(nextTarget.value)}{unit} to {MARK_META[nextTarget.type].short}
            <span className="text-orange-500/50"> · {nextTarget.comp}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function LadderRow({ row, cleared, isNext, fmtMark, fmtGap, unit }) {
  const meta = MARK_META[row.type];
  return (
    <div
      className="relative flex items-center gap-3 py-1.5 pl-1 pr-2 rounded-lg transition-all"
      style={{
        background: isNext ? 'rgba(249,115,22,0.05)' : 'transparent',
        border: `1px solid ${isNext ? 'rgba(249,115,22,0.28)' : 'transparent'}`,
        boxShadow: isNext ? '0 0 22px rgba(249,115,22,0.08)' : 'none',
      }}
    >
      {/* Rail indicator */}
      <div className="relative z-10 flex-shrink-0 flex items-center justify-center" style={{ width: '28px' }}>
        {cleared ? (
          <div
            className="w-[18px] h-[18px] rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(16,185,129,0.12)',
              border: '1.5px solid rgba(16,185,129,0.45)',
            }}
          >
            <Check className="w-[10px] h-[10px]" style={{ color: '#10b981' }} strokeWidth={3.5} />
          </div>
        ) : isNext ? (
          <div
            className="w-[14px] h-[14px] rounded-full"
            style={{
              background: '#f97316',
              boxShadow: '0 0 10px rgba(249,115,22,0.9), 0 0 0 3px rgba(249,115,22,0.18)',
            }}
          />
        ) : (
          <div
            className="w-[12px] h-[12px] rounded-full"
            style={{
              background: 'rgba(15,23,42,0.85)',
              border: '1.5px solid rgba(148,163,184,0.22)',
            }}
          />
        )}
      </div>

      {/* Mark-type pill */}
      <span
        className="mono-font text-[9px] font-bold tracking-wider px-1.5 py-[3px] rounded flex-shrink-0 tabular-nums"
        style={{
          background: `${meta.color}15`,
          color: meta.color,
          border: `1px solid ${meta.color}30`,
          minWidth: '48px',
          textAlign: 'center',
        }}
      >
        {meta.short}
      </span>

      {/* Competition label */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div
          className="w-[6px] h-[6px] rounded-full flex-shrink-0"
          style={{ background: row.compColor, opacity: cleared ? 0.45 : 1 }}
        />
        <span
          className={`text-[11px] sm:text-[12px] landing-font truncate ${cleared ? 'text-slate-400' : 'text-white'}`}
        >
          {row.comp}
        </span>
        {row.ageGroup === 'u20' && (
          <span className="text-[8px] font-bold px-1 py-[1px] rounded mono-font bg-purple-500/15 text-purple-400 flex-shrink-0 tracking-wider">
            U20
          </span>
        )}
      </div>

      {/* Mark value */}
      <span
        className={`mono-font text-[11px] sm:text-xs tabular-nums flex-shrink-0 ${cleared ? 'text-slate-500' : 'text-white/90'}`}
        style={{ minWidth: '52px', textAlign: 'right' }}
      >
        {fmtMark(row.value)}
      </span>

      {/* Gap / status */}
      <span
        className="mono-font text-[10px] tabular-nums flex-shrink-0"
        style={{
          minWidth: '62px',
          textAlign: 'right',
          color: cleared ? '#10b981' : (isNext ? '#f97316' : '#64748b'),
          fontWeight: isNext ? 700 : 400,
        }}
      >
        {cleared ? 'clear' : `+${fmtGap(row.value)}${unit}`}
      </span>

      {isNext && (
        <span
          className="mono-font text-[8px] font-bold uppercase tracking-[0.14em] px-1.5 py-[3px] rounded flex-shrink-0"
          style={{ background: '#f97316', color: '#fff' }}
        >
          Next
        </span>
      )}
    </div>
  );
}

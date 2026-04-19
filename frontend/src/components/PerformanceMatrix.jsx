// ═══════════════════════════════════════════════════════════════════════════
// PerformanceMatrix — bnchmrkd. trajectory map.
//
// Design system: editorial data-poster.
//   · Monochrome orange density (T1 dim ember → T7 blazing) — tier carries hue.
//   · Narrative caption replaces axis arrows (no "PERFORM →" clutter).
//   · Tier numbers T1–T7 fixed across the top, applicable to every age.
//   · Tier *names* (Emerging → World Class) sit at the bottom, visually
//     anchored to the Senior row — because only Seniors earn those labels.
//   · Athlete path overlaid as a crisp white hairline so it stands out
//     against the orange field.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import {
  buildMatrix,
  getTier,
  TIER_NAMES,
  TIER_OPACITY,
  AGE_GROUPS,
  TIER_COUNT_SENIOR,
} from '../lib/performanceTiers';
import { isTimeDiscipline } from '../lib/performanceLevels';

const TOTAL_COLS = TIER_COUNT_SENIOR;   // 7. T7 is Senior-only, but keeps column alignment.
const BRAND = '#fb923c';                 // apex orange, used sparingly.

// Format a threshold for display depending on discipline type.
function formatValue(value, discipline) {
  if (value == null) return '—';
  const isTime = isTimeDiscipline(discipline);
  if (!isTime) return `${value.toFixed(2)}m`;
  if (discipline === 'Marathon' || value >= 3600) {
    const hrs = Math.floor(value / 3600);
    const mins = Math.floor((value - hrs * 3600) / 60);
    const secs = Math.round(value - hrs * 3600 - mins * 60);
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  if (['800m', '1500m', '3000m', '5000m', '10000m'].includes(discipline)) {
    const mins = Math.floor(value / 60);
    const secs = (value - mins * 60).toFixed(1).padStart(4, '0');
    return `${mins}:${secs}`;
  }
  return `${value.toFixed(2)}s`;
}

// Single orange wash whose opacity encodes the tier.
function tierBackground(tier, reachable) {
  if (!reachable) return 'transparent';
  const op = TIER_OPACITY[tier] ?? 0;
  // Two-stop wash for subtle depth — all within the orange palette.
  return `linear-gradient(135deg,
    rgba(251, 146, 60, ${op}) 0%,
    rgba(234, 88, 12, ${Math.max(op - 0.08, 0)}) 100%)`;
}

/**
 * PerformanceMatrix
 * @param {string} discipline    '100m'
 * @param {string} gender        'Male' | 'Female'
 * @param {Array}  trajectory    [{ ageGroup: 'U15', pb: 11.85, date: '2020-06-21' }, ...]
 *                               Chronologically ordered, earliest first.
 */
export default function PerformanceMatrix({ discipline, gender, trajectory = [] }) {
  const matrix = useMemo(() => buildMatrix(discipline, gender), [discipline, gender]);

  const trajectoryPoints = useMemo(() => {
    if (!trajectory?.length) return [];
    return trajectory
      .map(pt => {
        const info = getTier(discipline, gender, pt.ageGroup, pt.pb);
        if (!info || info.tier === 0) return null;
        const rowIdx = AGE_GROUPS.indexOf(pt.ageGroup);
        const colIdx = info.tier - 1;
        if (rowIdx === -1) return null;
        return { rowIdx, colIdx, ...pt, tier: info.tier, tierName: info.tierName };
      })
      .filter(Boolean);
  }, [trajectory, discipline, gender]);

  const current = trajectoryPoints.length
    ? trajectoryPoints[trajectoryPoints.length - 1]
    : null;

  // Lookup: `${rowIdx},${colIdx}` → { order, isCurrent, total }
  // Used per-cell to decide what trajectory treatment to render.
  const trajectoryByCell = useMemo(() => {
    const map = new Map();
    trajectoryPoints.forEach((p, i) => {
      const key = `${p.rowIdx},${p.colIdx}`;
      map.set(key, {
        order: i + 1,
        isCurrent: i === trajectoryPoints.length - 1,
        total: trajectoryPoints.length,
      });
    });
    return map;
  }, [trajectoryPoints]);

  if (!matrix) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-500 text-sm mono-font">
        No benchmark data for <span className="text-white">{discipline}</span> · {gender}.
      </div>
    );
  }

  const gridTemplate = `48px repeat(${TOTAL_COLS}, minmax(0,1fr))`;
  const gridTemplateCompact = `44px repeat(${TOTAL_COLS}, minmax(52px,1fr))`;

  return (
    <div
      className="relative rounded-2xl border border-orange-900/40 bg-[#0a0604] p-3 sm:p-6 md:p-8 overflow-hidden"
      style={{
        boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(251,146,60,0.05) inset',
      }}
    >
      {/* Faint radial wash — editorial atmosphere, not decoration */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 95% 105%, rgba(251,146,60,0.12) 0%, transparent 55%)',
        }}
      />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-6 mb-4 sm:mb-6">
        <div className="flex-1 min-w-0">
          <div className="mono-font text-[10px] uppercase tracking-[0.3em] text-orange-400/80 mb-2">
            Performance Matrix
          </div>
          <h3 className="landing-font text-xl sm:text-2xl md:text-3xl font-semibold text-white tracking-tight leading-none">
            {discipline}
            <span className="text-orange-400/60 mx-2">·</span>
            <span className="text-slate-300 font-normal">{gender}</span>
          </h3>
          <p className="mt-2 sm:mt-3 text-[12px] sm:text-[13px] text-slate-400 leading-relaxed max-w-xl">
            Rows are age groups. Columns are competitive tiers, benchmarked against
            25 years of Olympic outcomes. A career is the path you trace across this grid.
          </p>
        </div>

        {current && (
          <div
            className="shrink-0 px-4 py-3 rounded-lg border backdrop-blur-sm"
            style={{
              borderColor: `rgba(251, 146, 60, ${TIER_OPACITY[current.tier] + 0.15})`,
              background: `rgba(251, 146, 60, ${TIER_OPACITY[current.tier] * 0.2})`,
            }}
          >
            <div className="mono-font text-[9px] uppercase tracking-[0.25em] text-slate-500">
              Currently
            </div>
            <div
              className="landing-font text-lg font-semibold mt-0.5"
              style={{ color: BRAND }}
            >
              {current.tierName}
            </div>
            <div className="mono-font text-[11px] text-slate-400 mt-0.5">
              {current.ageGroup} · {current.pb}
            </div>
          </div>
        )}
      </div>

      {/* ═══ GRID ═══════════════════════════════════════════════════════ */}
      <div className="relative overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
        <div className="min-w-[420px]">
        {/* Top axis — tier numbers T1…T7 (age-agnostic) */}
        <div className="grid mb-3" style={{ gridTemplateColumns: gridTemplateCompact }}>
          <div />
          {Array.from({ length: TOTAL_COLS }).map((_, ci) => {
            const isSeniorOnly = ci === 6;
            return (
              <div key={ci} className="text-center">
                <div
                  className="mono-font text-[9px] sm:text-[11px] font-semibold tracking-widest"
                  style={{
                    color: isSeniorOnly
                      ? 'rgba(251,146,60,0.95)'
                      : `rgba(251, 146, 60, ${Math.max(TIER_OPACITY[ci + 1], 0.35)})`,
                  }}
                >
                  T{ci + 1}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rows */}
        <div className="relative">
          {matrix.rows.map((row, ri) => (
            <div
              key={row.ageGroup}
              className="grid gap-[5px] mb-[5px]"
              style={{ gridTemplateColumns: gridTemplateCompact }}
            >
              {/* Row label */}
              <div className="flex items-center justify-end pr-1.5 sm:pr-3 mono-font text-[9px] sm:text-[11px] font-semibold tracking-wider text-slate-400">
                {row.ageGroup}
              </div>
              {Array.from({ length: TOTAL_COLS }).map((_, ci) => {
                const cut = row.cuts[ci];
                const tier = ci + 1;
                const seniorOnlyTier = ci === 6 && row.ageGroup !== 'Senior';
                const reachable = cut != null && !seniorOnlyTier;
                const trajInfo = trajectoryByCell.get(`${ri},${ci}`);
                const isVisited = !!trajInfo;
                const isCurrent = !!trajInfo?.isCurrent;
                // Visual weight grows with trajectory order: earliest chip is small/dim,
                // current is big/glowing brand orange.
                const order = trajInfo?.order ?? 0;
                const total = trajInfo?.total ?? 0;
                const progress = total > 1 ? (order - 1) / (total - 1) : 1;  // 0..1
                const chipSize = 13 + progress * 5;                          // 13 → 18 px
                const chipIntensity = 0.35 + progress * 0.65;                // 0.35 → 1.0
                const textIsDark = TIER_OPACITY[tier] >= 0.6;

                return (
                  <div
                    key={ci}
                    className={`relative rounded-[3px] transition-transform duration-200 ${
                      isCurrent ? 'z-10' : reachable ? 'hover:scale-[1.04] hover:z-[5]' : ''
                    }`}
                    style={{
                      background: reachable
                        ? tierBackground(tier, true)
                        : 'repeating-linear-gradient(135deg, rgba(24,10,4,0.6) 0 3px, rgba(10,6,4,0.6) 3px 6px)',
                      border: reachable
                        ? `1px solid rgba(251, 146, 60, ${Math.max(TIER_OPACITY[tier] - 0.2, 0.12)})`
                        : '1px solid rgba(251, 146, 60, 0.04)',
                      // Visited cells get a faint inset ring; current cell gets a
                      // prominent dashed brand-orange frame *outside* the border,
                      // plus a soft halo — so the threshold text stays untouched.
                      boxShadow: isCurrent
                        ? `inset 0 0 0 1.5px rgba(10,6,4,0.9),
                           0 0 0 2px rgba(10,6,4,1),
                           0 0 0 3.5px ${BRAND},
                           0 0 22px 2px rgba(251,146,60,0.55)`
                        : isVisited
                        ? `inset 0 0 0 1.5px rgba(${textIsDark ? '10,6,4' : '255,255,255'}, ${0.15 + progress * 0.25})`
                        : 'none',
                      minHeight: 44,
                      padding: '6px 4px',
                    }}
                    title={
                      reachable
                        ? `${TIER_NAMES[tier]} · ${row.ageGroup} · ${formatValue(cut, discipline)}${
                            trajInfo ? ` · step ${trajInfo.order}/${trajInfo.total}` : ''
                          }`
                        : `— unreachable at ${row.ageGroup}`
                    }
                  >
                    {reachable ? (
                      <div className="relative flex items-center justify-center h-full">
                        <div
                          className="mono-font font-semibold tracking-tight text-center"
                          style={{
                            color: textIsDark ? '#0a0604' : '#f8fafc',
                            fontSize:
                              TIER_OPACITY[tier] >= 0.8 ? '11px' : '10px',
                            letterSpacing: '-0.01em',
                            textShadow:
                              TIER_OPACITY[tier] < 0.4
                                ? '0 1px 0 rgba(0,0,0,0.4)'
                                : 'none',
                          }}
                        >
                          {formatValue(cut, discipline)}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full mono-font text-[10px] text-orange-900/60">
                        —
                      </div>
                    )}

                    {/* ── Stepping-stone chip ─────────────────────────────
                        Small ordinal badge in the top-right corner marking
                        this cell's place in the athlete's journey. Sits OFF
                        the threshold number; scales and brightens with order. */}
                    {isVisited && (
                      <div
                        className="absolute flex items-center justify-center mono-font font-bold select-none"
                        style={{
                          top: isCurrent ? -6 : 3,
                          right: isCurrent ? -6 : 3,
                          width: chipSize,
                          height: chipSize,
                          borderRadius: '50%',
                          fontSize: chipSize <= 14 ? '8px' : '9.5px',
                          // Dim stepping stones sit on the cell as a soft inset;
                          // current cell's chip lifts off the cell with a pill.
                          background: isCurrent
                            ? BRAND
                            : textIsDark
                            ? `rgba(10, 6, 4, ${chipIntensity})`
                            : `rgba(255, 255, 255, ${chipIntensity * 0.9})`,
                          color: isCurrent
                            ? '#0a0604'
                            : textIsDark
                            ? '#f8fafc'
                            : '#0a0604',
                          border: isCurrent
                            ? `1.5px solid #0a0604`
                            : `1px solid rgba(${textIsDark ? '10,6,4' : '255,255,255'}, ${chipIntensity * 0.6})`,
                          boxShadow: isCurrent
                            ? `0 0 12px 2px rgba(251,146,60,0.6), 0 2px 6px rgba(0,0,0,0.5)`
                            : 'none',
                          zIndex: 3,
                        }}
                      >
                        {order}
                      </div>
                    )}

                    {/* "YOU" chip — sits just outside the cell bottom so it
                        never overlaps the threshold, visible against the frame */}
                    {isCurrent && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 mono-font font-bold tracking-[0.25em] uppercase whitespace-nowrap px-2 py-[2px] rounded-sm"
                        style={{
                          bottom: -14,
                          fontSize: '8px',
                          color: '#0a0604',
                          background: BRAND,
                          boxShadow: '0 2px 10px rgba(251,146,60,0.5)',
                          zIndex: 4,
                        }}
                      >
                        You
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom axis — tier NAMES, anchored to Senior row.
            A thin connector above the strip signals the naming only applies
            to the row directly above it (Senior). */}
        <div className="mt-2">
          {/* hairline tethering strip to senior row */}
          <div
            className="grid"
            style={{ gridTemplateColumns: gridTemplateCompact }}
            aria-hidden
          >
            <div />
            {Array.from({ length: TOTAL_COLS }).map((_, ci) => (
              <div key={ci} className="flex justify-center">
                <div
                  className="w-px h-3"
                  style={{
                    background: `rgba(251, 146, 60, ${Math.max(TIER_OPACITY[ci + 1], 0.25)})`,
                  }}
                />
              </div>
            ))}
          </div>

          <div
            className="grid pt-2 pb-1"
            style={{ gridTemplateColumns: gridTemplateCompact }}
          >
            <div className="flex items-center justify-end pr-1.5 sm:pr-3 mono-font text-[7px] sm:text-[8.5px] uppercase tracking-[0.2em] text-slate-600">
              Senior →
            </div>
            {Array.from({ length: TOTAL_COLS }).map((_, ci) => {
              const isApex = ci === 6;
              return (
                <div
                  key={ci}
                  className="text-center px-1 flex flex-col items-center justify-start"
                  style={{ minHeight: 34 }}
                >
                  <div
                    className="landing-font font-semibold tracking-tight leading-tight"
                    style={{
                      color: isApex
                        ? BRAND
                        : `rgba(251, 146, 60, ${Math.max(TIER_OPACITY[ci + 1], 0.55)})`,
                      fontSize: isApex ? '10px' : '9px',
                    }}
                  >
                    {TIER_NAMES[ci + 1]}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mono-font text-[9.5px] text-slate-600 text-center mt-1 tracking-wider">
            Tier names describe the Senior-level competitive standard at each column.
          </p>
        </div>
        </div>{/* end min-w wrapper */}
      </div>
    </div>
  );
}


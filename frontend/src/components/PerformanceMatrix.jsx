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

  if (!matrix) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-500 text-sm mono-font">
        No benchmark data for <span className="text-white">{discipline}</span> · {gender}.
      </div>
    );
  }

  const gridTemplate = `56px repeat(${TOTAL_COLS}, minmax(0,1fr))`;

  return (
    <div
      className="relative rounded-2xl border border-orange-900/40 bg-[#0a0604] p-6 sm:p-8 overflow-hidden"
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
      <div className="relative flex items-start justify-between gap-6 mb-6">
        <div className="flex-1 min-w-0">
          <div className="mono-font text-[10px] uppercase tracking-[0.3em] text-orange-400/80 mb-2">
            Performance Matrix
          </div>
          <h3 className="landing-font text-2xl sm:text-3xl font-semibold text-white tracking-tight leading-none">
            {discipline}
            <span className="text-orange-400/60 mx-2">·</span>
            <span className="text-slate-300 font-normal">{gender}</span>
          </h3>
          <p className="mt-3 text-[13px] text-slate-400 leading-relaxed max-w-xl">
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
      <div className="relative">
        {/* Top axis — tier numbers T1…T7 (age-agnostic) */}
        <div className="grid mb-3" style={{ gridTemplateColumns: gridTemplate }}>
          <div />
          {Array.from({ length: TOTAL_COLS }).map((_, ci) => {
            const isSeniorOnly = ci === 6;
            return (
              <div key={ci} className="text-center">
                <div
                  className="mono-font text-[11px] font-semibold tracking-widest"
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
              className="grid gap-[3px] mb-[3px]"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {/* Row label */}
              <div className="flex items-center justify-end pr-3 mono-font text-[11px] font-semibold tracking-wider text-slate-400">
                {row.ageGroup}
              </div>
              {Array.from({ length: TOTAL_COLS }).map((_, ci) => {
                const cut = row.cuts[ci];
                const tier = ci + 1;
                const seniorOnlyTier = ci === 6 && row.ageGroup !== 'Senior';
                const reachable = cut != null && !seniorOnlyTier;
                const isCurrent = current && current.rowIdx === ri && current.colIdx === ci;

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
                      border: isCurrent
                        ? `1.5px solid ${BRAND}`
                        : reachable
                        ? `1px solid rgba(251, 146, 60, ${Math.max(TIER_OPACITY[tier] - 0.2, 0.12)})`
                        : '1px solid rgba(251, 146, 60, 0.04)',
                      boxShadow: isCurrent
                        ? `0 0 0 4px rgba(10,6,4,1), 0 0 0 5px ${BRAND}, 0 10px 30px rgba(251,146,60,0.45)`
                        : 'none',
                      minHeight: 56,
                      padding: '10px 6px',
                    }}
                    title={
                      reachable
                        ? `${TIER_NAMES[tier]} · ${row.ageGroup} · ${formatValue(cut, discipline)}`
                        : `— unreachable at ${row.ageGroup}`
                    }
                  >
                    {reachable ? (
                      <div className="relative flex items-center justify-center h-full">
                        <div
                          className="mono-font font-semibold tracking-tight text-center"
                          style={{
                            color:
                              TIER_OPACITY[tier] >= 0.6
                                ? '#0a0604'    // dark ink on bright cells
                                : '#f8fafc',   // bright ink on dim cells
                            fontSize:
                              TIER_OPACITY[tier] >= 0.8
                                ? '13.5px'
                                : '12.5px',
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

                    {/* "YOU" marker — tucked below threshold, brand glow */}
                    {isCurrent && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 mono-font text-[8.5px] font-bold tracking-[0.2em] uppercase"
                        style={{
                          bottom: -2,
                          color: TIER_OPACITY[tier] >= 0.6 ? '#0a0604' : BRAND,
                        }}
                      >
                        ● You
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Trajectory overlay — crisp white hairline to contrast the orange field */}
          {trajectoryPoints.length > 1 && (
            <TrajectoryOverlay points={trajectoryPoints} cols={TOTAL_COLS} rows={5} />
          )}
        </div>

        {/* Bottom axis — tier NAMES, anchored to Senior row.
            A thin connector above the strip signals the naming only applies
            to the row directly above it (Senior). */}
        <div className="mt-2">
          {/* hairline tethering strip to senior row */}
          <div
            className="grid"
            style={{ gridTemplateColumns: gridTemplate }}
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
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="flex items-center justify-end pr-3 mono-font text-[8.5px] uppercase tracking-[0.2em] text-slate-600">
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
                      fontSize: isApex ? '12.5px' : '11.5px',
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
      </div>
    </div>
  );
}

// ── Trajectory overlay ──────────────────────────────────────────────────
// White hairline to contrast the orange field. One colour, the weight
// and the endpoint markers carry the information — no gradient noise.
function TrajectoryOverlay({ points, cols, rows }) {
  const coords = points.map(p => ({
    x: ((p.colIdx + 0.5) / cols) * 100,
    y: ((p.rowIdx + 0.5) / rows) * 100,
  }));

  const pathD = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`)
    .join(' ');

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: 56 + 3,    // label col + grid gap
        top: 0,
        right: 3,
        bottom: 3,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <filter id="trajHalo">
            <feGaussianBlur stdDeviation="0.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* The line itself — pure white, hairline weight */}
        <path
          d={pathD}
          fill="none"
          stroke="rgba(255, 255, 255, 0.95)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          filter="url(#trajHalo)"
          style={{
            strokeDasharray: 400,
            strokeDashoffset: 400,
            animation: 'sparkDraw 1.5s cubic-bezier(.22,.61,.36,1) 0.3s forwards',
          }}
        />

        {/* Waypoints — small filled white dots, current gets brand ring */}
        {coords.map((c, i) => {
          const isLast = i === coords.length - 1;
          return (
            <g key={i}>
              {isLast && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={2.6}
                  fill="none"
                  stroke={BRAND}
                  strokeWidth="0.6"
                  vectorEffect="non-scaling-stroke"
                  style={{
                    opacity: 0,
                    animation: `sparkFade 0.4s ease-out ${0.5 + i * 0.14}s forwards, trajPulse 2s ease-in-out ${0.9 + i * 0.14}s infinite`,
                  }}
                />
              )}
              <circle
                cx={c.x}
                cy={c.y}
                r={isLast ? 1.4 : 0.9}
                fill={isLast ? BRAND : '#ffffff'}
                stroke="#ffffff"
                strokeWidth={isLast ? 0.3 : 0}
                vectorEffect="non-scaling-stroke"
                style={{
                  opacity: 0,
                  animation: `sparkFade 0.3s ease-out ${0.5 + i * 0.12}s forwards`,
                }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PerformanceMatrix — bnchmrkd. 5-row × 6/7-col trajectory map.
// PERFORM axis (X, left→right): tier progression within an age group
// DEVELOP axis (Y, top→bottom): age group progression (U13 → Senior)
// Diagonal heat: cool slate (top-left, youngest & entry) → hot red (bottom-right, senior world class)
// Overlays athlete's historical path across the grid.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import {
  buildMatrix,
  getTier,
  TIER_NAMES,
  TIER_COLORS,
  AGE_GROUPS,
  TIER_COUNT_SENIOR,
} from '../lib/performanceTiers';
import { isTimeDiscipline } from '../lib/performanceLevels';

const TOTAL_COLS = TIER_COUNT_SENIOR;   // 7 (Senior max). Juniors cap at T6.

// Format threshold for display depending on discipline type.
function formatValue(value, discipline) {
  if (value == null) return '—';
  const isTime = isTimeDiscipline(discipline);
  if (!isTime) return `${value.toFixed(2)}m`;
  // Long-distance formatted as mm:ss, sprints as seconds.
  if (['800m', '1500m', '3000m', '5000m', '10000m'].includes(discipline)) {
    const mins = Math.floor(value / 60);
    const secs = (value - mins * 60).toFixed(1).padStart(4, '0');
    return `${mins}:${secs}`;
  }
  return `${value.toFixed(2)}s`;
}

// Diagonal heat blend — mixes slate → tier colour based on row & column position.
function cellTint(rowIdx, colIdx, tierColor, isReachable) {
  if (!isReachable) return '#1e293b';         // slate-800, dim for unreachable cells
  if (!tierColor) return '#1e293b';
  // Earlier (top-left) cells sit closer to the slate base — later (bottom-right) closer to the pure tier.
  const progress = (rowIdx / 4 + colIdx / 6) / 2;    // 0..1
  // Blend: mix tier color into slate-700 base. Simple hex mix.
  return mixHex('#334155', tierColor, 0.3 + progress * 0.7);
}

function mixHex(aHex, bHex, t) {
  const parse = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [ar, ag, ab] = parse(aHex);
  const [br, bg, bb] = parse(bHex);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * PerformanceMatrix
 * @param {string} discipline      e.g. '100m'
 * @param {string} gender          'Male' | 'Female'
 * @param {Array}  trajectory      [{ ageGroup: 'U15', pb: 11.42, date: '2023-06-14' }, ...]
 *                                 Ordered chronologically (earliest first).
 */
export default function PerformanceMatrix({
  discipline,
  gender,
  trajectory = [],
}) {
  const matrix = useMemo(() => buildMatrix(discipline, gender), [discipline, gender]);

  // Compute per-entry tier for trajectory points (where the athlete was at each stage).
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

  const current = trajectoryPoints.length ? trajectoryPoints[trajectoryPoints.length - 1] : null;

  if (!matrix) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-slate-400 text-sm">
        No benchmark data available for <span className="text-white">{discipline}</span> ({gender}).
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-orange-400 mono-font mb-1">
            Performance Matrix
          </div>
          <h3 className="text-xl font-semibold text-white landing-font">
            {discipline} · {gender}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md leading-relaxed">
            Thresholds calibrated from 25 years of Olympic cohort data.
            Each cell = a recognised competitive standard at that age.
          </p>
        </div>
        {current && (
          <div
            className="text-right px-3 py-2 rounded-lg border"
            style={{
              borderColor: TIER_COLORS[current.tier] + '66',
              background: TIER_COLORS[current.tier] + '14',
            }}
          >
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mono-font">Currently</div>
            <div className="text-sm font-semibold" style={{ color: TIER_COLORS[current.tier] }}>
              {current.tierName}
            </div>
            <div className="text-[11px] text-slate-500 mono-font">
              {current.ageGroup} · {current.pb}
            </div>
          </div>
        )}
      </div>

      {/* Axis legend */}
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] mono-font text-slate-500 mb-2 pl-16 pr-2">
        <span>Perform →</span>
        <span className="text-slate-600">peer-rank within age group</span>
      </div>

      <div className="relative flex">
        {/* DEVELOP axis label (vertical) */}
        <div className="flex flex-col items-center justify-center pr-3 select-none">
          <div
            className="text-[10px] uppercase tracking-[0.2em] mono-font text-slate-500"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Develop ↓
          </div>
        </div>

        {/* Row labels + grid wrapper */}
        <div className="flex-1 relative">
          {/* Column headers */}
          <div className="grid" style={{ gridTemplateColumns: `56px repeat(${TOTAL_COLS}, minmax(0,1fr))` }}>
            <div />
            {Array.from({ length: TOTAL_COLS }).map((_, ci) => (
              <div
                key={ci}
                className="text-center text-[10px] uppercase tracking-[0.15em] mono-font text-slate-400 pb-2"
              >
                <div className="font-semibold" style={{ color: TIER_COLORS[ci + 1] }}>T{ci + 1}</div>
                <div className="text-[9px] text-slate-500 truncate">{TIER_NAMES[ci + 1]}</div>
              </div>
            ))}
          </div>

          {/* Grid body */}
          <div className="relative">
            {matrix.rows.map((row, ri) => (
              <div
                key={row.ageGroup}
                className="grid gap-1 mb-1"
                style={{ gridTemplateColumns: `56px repeat(${TOTAL_COLS}, minmax(0,1fr))` }}
              >
                {/* Row label */}
                <div className="flex items-center justify-end pr-2 text-[11px] font-semibold text-slate-300 mono-font">
                  {row.ageGroup}
                </div>
                {Array.from({ length: TOTAL_COLS }).map((_, ci) => {
                  const cut = row.cuts[ci];
                  const tierColor = TIER_COLORS[ci + 1];
                  const isSeniorOnlyTier = ci === 6 && row.ageGroup !== 'Senior';
                  const reachable = cut != null && !isSeniorOnlyTier;
                  const isCurrent =
                    current && current.rowIdx === ri && current.colIdx === ci;
                  const tint = cellTint(ri, ci, tierColor, reachable);

                  return (
                    <div
                      key={ci}
                      className={`relative rounded-md px-2 py-2 transition-all duration-200 border ${
                        isCurrent
                          ? 'ring-2 ring-offset-2 ring-offset-slate-950 scale-[1.03] z-10'
                          : 'hover:scale-[1.02] hover:z-[5]'
                      }`}
                      style={{
                        background: reachable
                          ? `linear-gradient(135deg, ${tint} 0%, ${mixHex(tint, '#000000', 0.25)} 100%)`
                          : 'repeating-linear-gradient(45deg, #0f172a 0 4px, #1e293b 4px 8px)',
                        borderColor: isCurrent
                          ? tierColor
                          : reachable
                          ? tierColor + '33'
                          : '#1e293b',
                        minHeight: 52,
                        boxShadow: isCurrent
                          ? `0 6px 24px ${tierColor}55`
                          : reachable
                          ? `0 1px 0 ${tierColor}22 inset`
                          : 'none',
                      }}
                      title={
                        reachable
                          ? `${TIER_NAMES[ci + 1]} · ${row.ageGroup} · ${formatValue(cut, discipline)}`
                          : `Unreachable at ${row.ageGroup}`
                      }
                    >
                      {reachable ? (
                        <div className="text-center">
                          <div
                            className="text-[12px] font-semibold mono-font"
                            style={{ color: '#f8fafc' }}
                          >
                            {formatValue(cut, discipline)}
                          </div>
                          {isCurrent && (
                            <div
                              className="text-[9px] mono-font uppercase tracking-wider mt-0.5"
                              style={{ color: tierColor }}
                            >
                              ◆ You
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center text-[10px] text-slate-600 mono-font">—</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Trajectory overlay — SVG drawn on top of grid */}
            {trajectoryPoints.length > 1 && (
              <TrajectoryOverlay points={trajectoryPoints} cols={TOTAL_COLS} />
            )}
          </div>
        </div>
      </div>

      {/* Footer legend */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-[10px] mono-font text-slate-500">
          <span>Tier intensity</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5, 6, 7].map(t => (
              <div
                key={t}
                className="w-4 h-2 rounded-sm"
                style={{ background: TIER_COLORS[t] }}
                title={TIER_NAMES[t]}
              />
            ))}
          </div>
          <span>cool → hot</span>
        </div>
        <div className="text-[10px] text-slate-600 mono-font">
          T7 (World Class) · Senior only
        </div>
      </div>
    </div>
  );
}

// ── Trajectory overlay ───────────────────────────────────────────────────
function TrajectoryOverlay({ points, cols }) {
  // We need to compute x,y in the grid's local coordinate space.
  // Grid uses CSS grid — we approximate positions via percentages.
  // Row has 5 age groups (ri 0..4), col has (cols) cells after the 56px label column.
  // We render SVG absolutely-positioned overtop; use viewBox 0..100 for x, 0..100 for y.

  // Percentages along the grid's content area (excluding the label column).
  // Each col center = (ci + 0.5) / cols * 100.
  // Each row center = (ri + 0.5) / 5 * 100.
  const coords = points.map(p => ({
    x: ((p.colIdx + 0.5) / cols) * 100,
    y: ((p.rowIdx + 0.5) / 5) * 100,
  }));

  const pathD = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`)
    .join(' ');

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        // match the cell-grid region (exclude the 56px label column)
        left: 56 + 4, // label column + small gap
        top: 0,
        right: 4,
        bottom: 4,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="trajGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#f97316" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="1" />
          </linearGradient>
          <filter id="trajGlow">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Path */}
        <path
          d={pathD}
          fill="none"
          stroke="url(#trajGrad)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#trajGlow)"
          vectorEffect="non-scaling-stroke"
          style={{ strokeDasharray: 400, strokeDashoffset: 400, animation: 'sparkDraw 1.6s ease-out 0.3s forwards' }}
        />

        {/* Points */}
        {coords.map((c, i) => {
          const isLast = i === coords.length - 1;
          return (
            <g key={i}>
              <circle
                cx={c.x}
                cy={c.y}
                r={isLast ? 1.6 : 1.1}
                fill={isLast ? '#f97316' : '#f1f5f9'}
                stroke={isLast ? '#fbbf24' : '#f97316'}
                strokeWidth="0.4"
                vectorEffect="non-scaling-stroke"
                style={{
                  opacity: 0,
                  animation: `sparkFade 0.3s ease-out ${0.5 + i * 0.12}s forwards`,
                  filter: isLast ? 'drop-shadow(0 0 4px #f97316)' : 'none',
                }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

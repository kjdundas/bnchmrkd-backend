// ═══════════════════════════════════════════════════════════════════════════
// PerformanceMatrixCard — production wrapper around <PerformanceMatrix/>.
//
// Owns:
//   · Historical-PB editor (U13/U15/U17/U20/Senior) — lets users populate
//     their trajectory so the matrix shows a real career path, not just a
//     single cell.
//   · localStorage persistence keyed by athleteId+discipline+gender (or
//     session key for anonymous Benchmark users).
//   · Always merges the CURRENT benchmark point into the trajectory
//     (pre-filled & locked in the editor for the athlete's current age group).
//
// Props:
//   discipline      'Long Jump'            — required
//   gender          'Male' | 'Female'      — required
//   currentAgeGroup 'U20'                  — from the benchmark / profile
//   currentPB       number                 — from the benchmark / profile
//   storageKey      string (optional)      — used to persist historical PBs.
//                                            Omit for ephemeral / anon flows.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react';
import PerformanceMatrix from './PerformanceMatrix';
import { AGE_GROUPS } from '../lib/performanceTiers';
import { isTimeDiscipline } from '../lib/performanceLevels';

const LS_PREFIX = 'bnchmrkd.trajectory.v1';

function loadHistorical(storageKey) {
  if (!storageKey || typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(`${LS_PREFIX}.${storageKey}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveHistorical(storageKey, data) {
  if (!storageKey || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${LS_PREFIX}.${storageKey}`, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

// For time disciplines, parse "2:09:52" or "4:28.5" or "12.45" or "268" into seconds.
function parsePBInput(input, discipline) {
  if (input === '' || input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  const isTime = isTimeDiscipline(discipline);
  if (isTime && s.includes(':')) {
    const parts = s.split(':');
    if (parts.length === 3) {
      // h:mm:ss (Marathon)
      const hh = parseFloat(parts[0]);
      const mm = parseFloat(parts[1]);
      const ss = parseFloat(parts[2]);
      if (isNaN(hh) || isNaN(mm) || isNaN(ss)) return null;
      return hh * 3600 + mm * 60 + ss;
    }
    const [m, rest] = parts;
    const mm = parseFloat(m);
    const ss = parseFloat(rest);
    if (isNaN(mm) || isNaN(ss)) return null;
    return mm * 60 + ss;
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function formatForInput(value, discipline) {
  if (value == null) return '';
  const isTime = isTimeDiscipline(discipline);
  if (isTime && value >= 3600) {
    const h = Math.floor(value / 3600);
    const m = Math.floor((value - h * 3600) / 60);
    const s = (value - h * 3600 - m * 60).toFixed(2).padStart(5, '0');
    return `${h}:${String(m).padStart(2, '0')}:${s}`;
  }
  if (isTime && value >= 60) {
    const m = Math.floor(value / 60);
    const s = (value - m * 60).toFixed(2).padStart(5, '0');
    return `${m}:${s}`;
  }
  if (isTime) return value.toFixed(2);
  return value.toFixed(2);
}

function placeholderFor(discipline) {
  if (isTimeDiscipline(discipline)) {
    if (discipline === 'Marathon') {
      return '2:09:52';
    }
    if (['800m', '1500m', '3000m', '5000m', '10000m'].includes(discipline)) {
      return '4:28.50';
    }
    return '11.45';
  }
  return '6.75';
}

export default function PerformanceMatrixCard({
  discipline,
  gender,
  currentAgeGroup,
  currentPB,
  storageKey,
}) {
  // Historical PBs: { U13: 13.10, U15: 11.85, ... }
  // The current age group is always overridden by currentPB below.
  const [historical, setHistorical] = useState(() => loadHistorical(storageKey));
  const [draft, setDraft] = useState({});       // in-progress edits
  const [editorOpen, setEditorOpen] = useState(false);

  // Keep localStorage in sync
  useEffect(() => {
    saveHistorical(storageKey, historical);
  }, [storageKey, historical]);

  // Reload historical data when the storage key changes (athlete switch, etc.)
  useEffect(() => {
    setHistorical(loadHistorical(storageKey));
    setDraft({});
  }, [storageKey]);

  // Build trajectory array for the matrix.
  // Always include the current benchmark point; merge in historical for
  // every age group EARLIER than current (later ages get filled as the
  // athlete progresses — not back-dated).
  const trajectory = useMemo(() => {
    const points = [];
    const currentIdx = AGE_GROUPS.indexOf(currentAgeGroup);
    AGE_GROUPS.forEach((ag, idx) => {
      if (ag === currentAgeGroup) {
        if (currentPB != null) {
          points.push({ ageGroup: ag, pb: currentPB, date: 'current' });
        }
      } else if (idx < currentIdx && historical[ag] != null) {
        points.push({ ageGroup: ag, pb: historical[ag], date: `recorded` });
      } else if (idx > currentIdx && historical[ag] != null) {
        // future age group already entered (unusual, but allow it)
        points.push({ ageGroup: ag, pb: historical[ag], date: `recorded` });
      }
    });
    // Chronological order = age-group order.
    return points.sort(
      (a, b) => AGE_GROUPS.indexOf(a.ageGroup) - AGE_GROUPS.indexOf(b.ageGroup)
    );
  }, [historical, currentAgeGroup, currentPB]);

  const commitDraft = useCallback(
    (ag) => {
      const raw = draft[ag];
      const parsed = parsePBInput(raw, discipline);
      if (parsed != null) {
        setHistorical(h => ({ ...h, [ag]: parsed }));
      } else if (raw === '') {
        // Empty string = delete
        setHistorical(h => {
          const next = { ...h };
          delete next[ag];
          return next;
        });
      }
      setDraft(d => {
        const next = { ...d };
        delete next[ag];
        return next;
      });
    },
    [draft, discipline]
  );

  const filledCount = trajectory.length;
  const missingAgeGroups = AGE_GROUPS.filter(
    ag => ag !== currentAgeGroup && historical[ag] == null
  );

  return (
    <div className="relative">
      <PerformanceMatrix
        discipline={discipline}
        gender={gender}
        trajectory={trajectory}
      />

      {/* ── Trajectory editor ──────────────────────────────────────────── */}
      <div className="mt-4 rounded-xl border border-orange-900/30 bg-[#0a0604]/70 overflow-hidden">
        <button
          type="button"
          onClick={() => setEditorOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-orange-950/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className="mono-font text-[10px] uppercase tracking-[0.22em]"
              style={{ color: '#fb923c' }}
            >
              Your Trajectory
            </div>
            <span className="mono-font text-[10px] text-slate-500">
              · {filledCount} of {AGE_GROUPS.length} age groups
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!editorOpen && missingAgeGroups.length > 0 && (
              <span className="mono-font text-[10px] text-orange-300/80">
                + add past PBs
              </span>
            )}
            <span className="text-orange-400 text-sm">{editorOpen ? '−' : '+'}</span>
          </div>
        </button>

        {editorOpen && (
          <div className="px-4 pb-4 pt-1 border-t border-orange-900/20">
            <p className="mono-font text-[10px] text-slate-500 mb-3 leading-relaxed">
              Enter your best {discipline} from each age group you competed in.
              The current-age PB (<span className="text-orange-400">{currentAgeGroup}</span>)
              is locked from your benchmark.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {AGE_GROUPS.map(ag => {
                const isCurrent = ag === currentAgeGroup;
                const stored = isCurrent ? currentPB : historical[ag];
                const draftValue = draft[ag];
                const displayValue =
                  draftValue !== undefined
                    ? draftValue
                    : stored != null
                    ? formatForInput(stored, discipline)
                    : '';

                return (
                  <div
                    key={ag}
                    className={`rounded-lg border transition-all ${
                      isCurrent
                        ? 'border-orange-500/50 bg-orange-500/5'
                        : stored != null
                        ? 'border-orange-900/40 bg-orange-950/10'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                    } px-2.5 py-2`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`mono-font text-[9px] uppercase tracking-widest ${
                          isCurrent ? 'text-orange-400' : 'text-slate-500'
                        }`}
                      >
                        {ag}
                      </span>
                      {isCurrent && (
                        <span className="mono-font text-[8px] text-orange-400/80">
                          now
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={isCurrent}
                      value={displayValue}
                      onChange={e =>
                        setDraft(d => ({ ...d, [ag]: e.target.value }))
                      }
                      onBlur={() => commitDraft(ag)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          commitDraft(ag);
                          e.currentTarget.blur();
                        }
                      }}
                      placeholder={placeholderFor(discipline)}
                      className={`w-full bg-transparent mono-font text-sm font-semibold tabular-nums focus:outline-none ${
                        isCurrent
                          ? 'text-orange-300 cursor-not-allowed'
                          : 'text-white placeholder:text-slate-700'
                      }`}
                      aria-label={`Personal best at ${ag}`}
                    />
                  </div>
                );
              })}
            </div>

            <p className="mono-font text-[9px] text-slate-600 mt-3">
              Times: <span className="text-slate-500">h:mm:ss</span>,{' '}
              <span className="text-slate-500">mm:ss.ss</span> or{' '}
              <span className="text-slate-500">ss.ss</span>. Field marks in
              metres. Blank to remove.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

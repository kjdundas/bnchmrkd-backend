// ═══════════════════════════════════════════════════════════════════════════
// MatrixPreview — localhost-only preview harness for the Performance Matrix.
// Access via ?view=matrix. Not wired into production flow.
// Lets us iterate on the matrix component with sample athlete trajectories
// across a few disciplines before integrating into Where-You-Stand.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import PerformanceMatrix from './PerformanceMatrix';

// Sample athletes for each discipline so we can eyeball the overlay at different
// points in the matrix. PB values chosen to land at plausible tier positions.
const SAMPLES = {
  '100m_Male': [
    { ageGroup: 'U13', pb: 13.10, date: '2018-07-02' },
    { ageGroup: 'U15', pb: 11.85, date: '2020-06-21' },
    { ageGroup: 'U17', pb: 11.10, date: '2022-07-10' },
    { ageGroup: 'U20', pb: 10.55, date: '2024-06-15' },
    { ageGroup: 'Senior', pb: 10.12, date: '2026-03-28' },
  ],
  '100m_Female': [
    { ageGroup: 'U13', pb: 14.20, date: '2018-07-02' },
    { ageGroup: 'U15', pb: 12.80, date: '2020-06-21' },
    { ageGroup: 'U17', pb: 12.10, date: '2022-07-10' },
    { ageGroup: 'U20', pb: 11.55, date: '2024-06-15' },
    { ageGroup: 'Senior', pb: 11.15, date: '2026-03-28' },
  ],
  'Shot Put_M': [
    { ageGroup: 'U13', pb: 7.20, date: '2018-07-02' },
    { ageGroup: 'U15', pb: 10.40, date: '2020-06-21' },
    { ageGroup: 'U17', pb: 12.50, date: '2022-07-10' },
    { ageGroup: 'U20', pb: 14.80, date: '2024-06-15' },
    { ageGroup: 'Senior', pb: 17.20, date: '2026-03-28' },
  ],
  'Discus Throw_M': [
    { ageGroup: 'U15', pb: 22.50, date: '2020-06-21' },
    { ageGroup: 'U17', pb: 34.80, date: '2022-07-10' },
    { ageGroup: 'U20', pb: 44.20, date: '2024-06-15' },
    { ageGroup: 'Senior', pb: 52.80, date: '2026-03-28' },
  ],
  'Long Jump_M': [
    { ageGroup: 'U13', pb: 3.80, date: '2018-07-02' },
    { ageGroup: 'U15', pb: 5.40, date: '2020-06-21' },
    { ageGroup: 'U17', pb: 6.40, date: '2022-07-10' },
    { ageGroup: 'U20', pb: 7.20, date: '2024-06-15' },
    { ageGroup: 'Senior', pb: 7.85, date: '2026-03-28' },
  ],
  '1500m_M': [
    { ageGroup: 'U13', pb: 320.0, date: '2018-07-02' },   // 5:20
    { ageGroup: 'U15', pb: 268.0, date: '2020-06-21' },   // 4:28
    { ageGroup: 'U17', pb: 244.0, date: '2022-07-10' },   // 4:04
    { ageGroup: 'U20', pb: 226.0, date: '2024-06-15' },   // 3:46
    { ageGroup: 'Senior', pb: 218.0, date: '2026-03-28' },// 3:38
  ],
};

// Disciplines to expose in the preview selector.
const PRESETS = [
  { key: '100m_Male', discipline: '100m', gender: 'Male', label: '100m · Male (time)' },
  { key: '100m_Female', discipline: '100m', gender: 'Female', label: '100m · Female (time)' },
  { key: 'Shot Put_M', discipline: 'Shot Put', gender: 'Male', label: 'Shot Put · Male (field)' },
  { key: 'Discus Throw_M', discipline: 'Discus Throw', gender: 'Male', label: 'Discus Throw · Male (field)' },
  { key: 'Long Jump_M', discipline: 'Long Jump', gender: 'Male', label: 'Long Jump · Male (field)' },
  { key: '1500m_M', discipline: '1500m', gender: 'Male', label: '1500m · Male (long dist)' },
];

export default function MatrixPreview() {
  const [activeKey, setActiveKey] = useState('100m_Male');
  const active = PRESETS.find(p => p.key === activeKey);
  const trajectory = SAMPLES[activeKey] || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-950 to-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <header className="mb-8">
          <div className="mono-font text-[10px] uppercase tracking-[0.3em] text-orange-400 mb-2">
            localhost preview · ?view=matrix
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold landing-font">
            Performance Matrix
          </h1>
          <p className="text-slate-400 max-w-2xl mt-2 text-sm leading-relaxed">
            A trajectory map — every athlete's journey drawn across the same grid.
            Horizontal axis is tier progression within an age group (PERFORM).
            Vertical axis is age group progression (DEVELOP).
            Bottom-right is the goal: Olympic medalist / World Class at senior level.
          </p>
        </header>

        {/* Preset selector */}
        <div className="mb-6">
          <div className="mono-font text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">
            Sample trajectory
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => setActiveKey(p.key)}
                className={`px-3 py-1.5 rounded-full text-xs mono-font border transition-all ${
                  activeKey === p.key
                    ? 'border-orange-400 text-orange-300 bg-orange-400/10 shadow-[0_0_12px_rgba(249,115,22,0.25)]'
                    : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* The matrix itself */}
        <PerformanceMatrix
          discipline={active.discipline}
          gender={active.gender}
          trajectory={trajectory}
        />

        {/* Trajectory data readout */}
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-950/50 p-5">
          <div className="mono-font text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-3">
            Sample PBs
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {trajectory.map(pt => (
              <div key={pt.ageGroup} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
                <div className="text-[10px] mono-font text-slate-500 uppercase tracking-widest">
                  {pt.ageGroup}
                </div>
                <div className="text-sm font-semibold text-white mono-font">{pt.pb}</div>
                <div className="text-[9px] text-slate-600 mono-font">{pt.date}</div>
              </div>
            ))}
          </div>
        </div>

        <footer className="mt-10 text-center text-[10px] mono-font text-slate-600">
          Preview harness · thresholds derived via systematic rebin of legacy L1–L12 dataset with Olympic-cohort calibration
        </footer>
      </div>
    </div>
  );
}

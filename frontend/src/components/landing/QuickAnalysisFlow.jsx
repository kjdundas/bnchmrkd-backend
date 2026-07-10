// ═══════════════════════════════════════════════════════════════════════
// QUICK ANALYSIS — guided, one-question-at-a-time flow.
// Editorial "performance terminal": mono meta, a big ghosted step numeral,
// underline-style oversized inputs (no native chrome), tap-to-select chips,
// one bold accent. Directional GSAP transitions, reduced-motion aware.
// ═══════════════════════════════════════════════════════════════════════
import { useState, useRef } from 'react'
import { gsap, useGSAP } from '../../lib/gsapSetup'
import { ArrowRight, ArrowLeft, Zap } from 'lucide-react'

const ORANGE = '#f97316'

function disciplineList({ isThrowsMode, isJumpsMode, isDistanceMode }) {
  if (isThrowsMode) return [
    { v: 'Discus Throw', l: 'Discus' }, { v: 'Javelin Throw', l: 'Javelin' },
    { v: 'Hammer Throw', l: 'Hammer' }, { v: 'Shot Put', l: 'Shot Put' },
  ]
  if (isJumpsMode) return [
    { v: 'High Jump', l: 'High Jump' }, { v: 'Long Jump', l: 'Long Jump' },
    { v: 'Triple Jump', l: 'Triple Jump' }, { v: 'Pole Vault', l: 'Pole Vault' },
  ]
  if (isDistanceMode) return [
    { v: '800m', l: '800m' }, { v: '1500m', l: '1500m' }, { v: '3000m Steeplechase', l: '3000m SC' },
    { v: '5000m', l: '5000m' }, { v: '10000m', l: '10,000m' }, { v: 'Marathon', l: 'Marathon' },
  ]
  return [
    { v: '100m', l: '100m' }, { v: '200m', l: '200m' }, { v: '400m', l: '400m' },
    { v: '110mH', l: '110mH' }, { v: '100mH', l: '100mH' }, { v: '400mH', l: '400mH' },
  ]
}

export default function QuickAnalysisFlow({
  data, setData, isThrowsMode, isJumpsMode, isDistanceMode,
  getUnitLabel, isMarathon, getDefaultWeight, getWeightOptions,
  loading, error, onSubmit,
}) {
  const disciplines = disciplineList({ isThrowsMode, isJumpsMode, isDistanceMode })
  const total = 4
  const labels = ['Event', 'Standards', 'Age', 'Best']
  const [step, setStep] = useState(0)
  const dir = useRef(1)
  const stage = useRef(null)

  const set = (patch) => setData({ ...data, ...patch })
  const go = (n) => { dir.current = n > step ? 1 : -1; setStep(Math.max(0, Math.min(total - 1, n))) }

  useGSAP(() => {
    const panel = stage.current?.querySelector('[data-panel]')
    const rail = stage.current?.querySelector('[data-rail-fill]')
    const num = stage.current?.querySelector('[data-ghost]')
    const pct = `${((step + 1) / total) * 100}%`
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (panel) gsap.from(panel, { autoAlpha: 0, x: dir.current * 44, duration: 0.4, ease: 'power3.out' })
      if (num) gsap.from(num, { autoAlpha: 0, scale: 0.9, duration: 0.5, ease: 'power2.out' })
      if (rail) gsap.to(rail, { width: pct, duration: 0.55, ease: 'power3.out' })
    })
    mm.add('(prefers-reduced-motion: reduce)', () => { if (rail) rail.style.width = pct })
    return () => mm.revert()
  }, { dependencies: [step], scope: stage })

  const pickDiscipline = (v) => {
    const patch = { discipline: v }
    if (isThrowsMode && data.age) patch.implementWeight = getDefaultWeight(v, data.gender, data.age)
    set(patch); window.setTimeout(() => go(1), 150)
  }
  const pickGender = (g) => { set({ gender: g }); window.setTimeout(() => go(2), 150) }

  const ageValid = String(data.age).trim() !== '' && Number(data.age) >= 5 && Number(data.age) <= 90
  const pbValid = String(data.personalBest).trim() !== ''
  const pbUnit = isMarathon(data.discipline) ? 'h:mm:ss' : isDistanceMode ? 'mm:ss.ff' : (getUnitLabel(data.discipline) || '').replace(/[()]/g, '') || (isThrowsMode ? 'm' : 's')
  const pbPlaceholder = isThrowsMode ? '65.50' : isMarathon(data.discipline) ? '2:09:52' : isDistanceMode ? '8:06.05' : '10.85'
  const onEnter = (e, fn) => { if (e.key === 'Enter') { e.preventDefault(); fn() } }

  const chipCls = (active) =>
    `landing-font rounded-xl px-4 py-3.5 text-[15px] font-semibold text-center transition-all duration-150 active:scale-[0.97] ` +
    (active
      ? 'text-white'
      : 'text-slate-300 hover:text-white hover:-translate-y-0.5')
  const chipStyle = (active, accent = ORANGE) => active
    ? { background: `${accent}1f`, border: `1px solid ${accent}`, boxShadow: `0 0 0 1px ${accent}33, 0 8px 24px -12px ${accent}` }
    : { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }

  return (
    <div ref={stage} className="relative overflow-hidden rounded-2xl p-6 sm:p-9"
      style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 40%, rgba(255,255,255,0.006) 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>

      {/* ghost step numeral */}
      <span data-ghost aria-hidden="true" className="landing-font pointer-events-none select-none"
        style={{ position: 'absolute', top: -34, right: 8, fontSize: 200, lineHeight: 1, fontWeight: 800, letterSpacing: '-0.05em', color: 'rgba(255,255,255,0.035)' }}>
        {String(step + 1).padStart(2, '0')}
      </span>

      {/* header + rail */}
      <div className="relative z-10 flex items-center justify-between mb-2.5">
        <span className="mono-font" style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#71717a' }}>Quick analysis</span>
        <span className="mono-font" style={{ fontSize: 11, letterSpacing: '0.12em', color: '#52525b' }}>
          <span style={{ color: ORANGE }}>{String(step + 1).padStart(2, '0')}</span> / {String(total).padStart(2, '0')} · {labels[step]}
        </span>
      </div>
      <div className="relative z-10" style={{ height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 34 }}>
        <div data-rail-fill style={{ height: '100%', width: `${((step + 1) / total) * 100}%`, background: `linear-gradient(90deg, ${ORANGE}, #fbbf24)` }} />
      </div>

      {/* panels */}
      <div className="relative z-10" style={{ minHeight: 250 }}>
        <div data-panel key={step}>
          {step === 0 && (
            <>
              <h3 className="landing-font" style={{ fontSize: 30, fontWeight: 700, color: '#fff', marginBottom: 6, letterSpacing: '-0.025em' }}>What's your event?</h3>
              <p className="landing-font" style={{ color: '#94a3b8', marginBottom: 26, fontSize: 15 }}>Pick the discipline you want to benchmark.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5" style={{ maxWidth: 520 }}>
                {disciplines.map((d) => (
                  <button key={d.v} onClick={() => pickDiscipline(d.v)} className={chipCls(data.discipline === d.v)} style={chipStyle(data.discipline === d.v)}>{d.l}</button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h3 className="landing-font" style={{ fontSize: 30, fontWeight: 700, color: '#fff', marginBottom: 6, letterSpacing: '-0.025em' }}>Which standards?</h3>
              <p className="landing-font" style={{ color: '#94a3b8', marginBottom: 26, fontSize: 15 }}>We grade you against age- and sex-specific Olympic data.</p>
              <div className="grid grid-cols-2 gap-3" style={{ maxWidth: 420 }}>
                {[{ g: 'Male', a: '#60a5fa', t: "Men's" }, { g: 'Female', a: '#f472b6', t: "Women's" }].map(({ g, a, t }) => (
                  <button key={g} onClick={() => pickGender(g)} className={chipCls(data.gender === g)} style={{ ...chipStyle(data.gender === g, a), padding: '28px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 21, fontWeight: 700 }}>{t}</span>
                    <span className="mono-font" style={{ fontSize: 10.5, color: '#71717a', letterSpacing: '0.14em' }}>{g.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="landing-font" style={{ fontSize: 30, fontWeight: 700, color: '#fff', marginBottom: 6, letterSpacing: '-0.025em' }}>How old are you?</h3>
              <p className="landing-font" style={{ color: '#94a3b8', marginBottom: 30, fontSize: 15 }}>Your age sets the development cohort we compare you to.</p>
              <div className="flex items-baseline gap-3 border-b-2 border-white/10 focus-within:border-orange-500 transition-colors duration-200" style={{ maxWidth: 260 }}>
                <input autoFocus type="text" inputMode="numeric" placeholder="22" value={data.age}
                  onChange={(e) => set({ age: e.target.value.replace(/[^\d]/g, '').slice(0, 2) })}
                  onKeyDown={(e) => onEnter(e, () => ageValid && go(3))}
                  aria-label="Current age"
                  className="landing-font placeholder-slate-700"
                  style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 56, fontWeight: 700, letterSpacing: '-0.03em', padding: '2px 0', fontVariantNumeric: 'tabular-nums' }} />
                <span className="mono-font" style={{ color: '#52525b', fontSize: 16 }}>yrs</span>
              </div>
              {!ageValid && String(data.age).trim() !== '' && (
                <p className="landing-font" style={{ color: '#fb7185', fontSize: 13, marginTop: 12 }}>Enter an age between 5 and 90.</p>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="landing-font" style={{ fontSize: 30, fontWeight: 700, color: '#fff', marginBottom: 6, letterSpacing: '-0.025em' }}>Your personal best?</h3>
              <p className="landing-font" style={{ color: '#94a3b8', marginBottom: 30, fontSize: 15 }}>{data.discipline} · {isThrowsMode ? 'best mark' : 'best time'}</p>
              <div className="flex items-baseline gap-3 border-b-2 border-white/10 focus-within:border-orange-500 transition-colors duration-200" style={{ maxWidth: 340 }}>
                <input autoFocus type="text" inputMode="decimal" placeholder={pbPlaceholder} value={data.personalBest}
                  onChange={(e) => set({ personalBest: e.target.value.replace(/[^\d.:]/g, '') })}
                  onKeyDown={(e) => onEnter(e, () => pbValid && onSubmit())}
                  aria-label="Personal best"
                  className="landing-font placeholder-slate-700"
                  style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 44, fontWeight: 700, letterSpacing: '-0.02em', padding: '2px 0', fontVariantNumeric: 'tabular-nums' }} />
                <span className="mono-font" style={{ color: '#52525b', fontSize: 15 }}>{pbUnit}</span>
              </div>

              {isThrowsMode && (
                <div style={{ marginTop: 22, maxWidth: 340 }}>
                  <label className="landing-font" style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 6, letterSpacing: '0.04em' }}>Implement weight</label>
                  <select value={data.implementWeight} onChange={(e) => set({ implementWeight: parseFloat(e.target.value) })}
                    className="landing-font" style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '10px 14px', color: '#fff', outline: 'none' }}>
                    {getWeightOptions(data.discipline, data.gender).map((opt) => (<option key={opt.kg} value={opt.kg}>{opt.label}</option>))}
                  </select>
                </div>
              )}

              <input type="text" placeholder="Add a name (optional)" value={data.name}
                onChange={(e) => set({ name: e.target.value })}
                aria-label="Name (optional)"
                className="landing-font placeholder-slate-700 focus:border-white/25"
                style={{ marginTop: 24, width: '100%', maxWidth: 340, display: 'block', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '8px 2px', color: '#e2e8f0', outline: 'none', fontSize: 14, transition: 'border-color .2s ease' }} />
            </>
          )}
        </div>
      </div>

      {error && <div className="landing-font relative z-10" style={{ marginTop: 20, background: 'rgba(127,29,29,0.28)', border: '1px solid rgba(153,27,27,0.5)', color: '#fca5a5', padding: '10px 14px', borderRadius: 10, fontSize: 14 }}>{error}</div>}

      {/* nav */}
      <div className="relative z-10 flex items-center justify-between" style={{ marginTop: 34 }}>
        <button onClick={() => go(step - 1)} disabled={step === 0} aria-label="Back"
          className="landing-font inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors"
          style={{ color: step === 0 ? '#3f3f46' : '#94a3b8', background: 'transparent', cursor: step === 0 ? 'default' : 'pointer' }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {step < 3 ? (
          <button onClick={() => go(step + 1)} disabled={step === 2 && !ageValid} aria-label="Next"
            className="landing-font inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-[15px] font-bold transition-all duration-150 active:scale-[0.98]"
            style={(step === 2 && !ageValid)
              ? { color: '#52525b', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', cursor: 'not-allowed' }
              : { color: '#0a0a0b', background: ORANGE, boxShadow: '0 8px 24px -10px rgba(249,115,22,0.8)' }}>
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={onSubmit} disabled={loading || !pbValid} aria-label="Benchmark"
            className="landing-font inline-flex items-center gap-2.5 rounded-xl px-8 py-4 text-base font-extrabold transition-transform duration-150 active:scale-[0.98]"
            style={(loading || !pbValid)
              ? { color: '#52525b', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', cursor: 'not-allowed' }
              : { color: '#fff', background: 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)', border: '1px solid rgba(249,115,22,0.5)', boxShadow: '0 10px 30px -8px rgba(249,115,22,0.6)' }}>
            <Zap className="w-5 h-5" /> {loading ? 'Analysing…' : 'Benchmark'}
          </button>
        )}
      </div>
    </div>
  )
}

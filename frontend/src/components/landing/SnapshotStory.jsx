// ═══════════════════════════════════════════════════════════════════════
// SNAPSHOT STORY — the quick-analysis result, told as one clear narrative.
// Everything here is derivable from a single PB + age (position, not
// progression): verdict, "X of 100", gap to next tier, the closest pro at
// the same age, and an interactive tier ladder. Wired to live analysis data.
// ═══════════════════════════════════════════════════════════════════════
import { useState, useRef, useMemo } from 'react'
import { gsap, useGSAP } from '../../lib/gsapSetup'
import { PERFORMANCE_LEVELS, LEVEL_NAMES, getAgeGroup, isTimeDiscipline } from '../../lib/performanceLevels'

const O = '#f97316'

function nounFor(disc) {
  if (/Throw|Put/.test(disc)) return 'thrower'
  if (/Jump|Vault/.test(disc)) return 'jumper'
  if (/mH|Hurdles/.test(disc)) return 'hurdler'
  if (/800|1500|3000|5000|10000|Marathon|Steeple/.test(disc)) return 'runner'
  return 'sprinter'
}

export default function SnapshotStory({ results, formatTime, onAddPBs }) {
  const r = results || {}
  const disc = r.discipline, gender = r.gender, age = r.age, pb = r.personalBest
  const isTime = isTimeDiscipline(disc)
  const unit = isTime ? 's' : 'm'
  const noun = nounFor(disc)
  const male = gender === 'Male' || gender === 'M'
  const she = male ? 'he' : 'she', her = male ? 'his' : 'her', She = male ? 'He' : 'She', Her = male ? 'His' : 'Her'
  const pl = r.performanceLevel || null
  const pctRaw = r.percentileAtCurrentAge
  const pct = (pctRaw != null && isFinite(pctRaw)) ? Math.max(1, Math.min(99, Math.round(pctRaw))) : null
  const pro = (r.similarAthletes && r.similarAthletes.length > 0) ? r.similarAthletes[0] : null
  const fmt = (t) => (formatTime ? formatTime(t, disc) : t)
  // fmt() can return a value that already carries its unit (e.g. "69.40m");
  // bare() strips any trailing unit so we never render "69.40mm".
  const bare = (t) => String(fmt(t)).trim().replace(/\s*(m|s|km|sec|min)$/i, '')

  // Build the ladder from the real performance-level thresholds for this age group
  const ladder = useMemo(() => {
    const key = `${disc}_${gender === 'Male' ? 'M' : 'F'}`
    const arr = PERFORMANCE_LEVELS[key]?.[getAgeGroup(age)]
    if (!arr) return []
    return arr.map((time, i) => ({ level: i + 1, name: LEVEL_NAMES[i + 1] || `T${i + 1}`, time }))
      .filter((t) => t.time != null)
  }, [disc, gender, age])
  const curLevel = pl?.level || 0

  const gap = pl?.gap != null ? Math.abs(pl.gap) : null
  const nextName = pl?.nextName || null

  const stage = useRef(null)
  const [dotN, setDotN] = useState(0)
  const [read, setRead] = useState(null)

  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from('[data-a="v"]', { autoAlpha: 0, y: 16, duration: .6, stagger: .08 })
        .from('.ss-beat', { autoAlpha: 0, y: 24, duration: .55, stagger: .14 }, '-=0.1')
        .from('.ss-arrow', { autoAlpha: 0, duration: .4, stagger: .14 }, '<')
      if (pct != null) tl.add(() => { gsap.to({ v: 0 }, { v: pct, duration: 1, ease: 'power2.out', onUpdate() { setDotN(Math.round(this.targets()[0].v)) } }) }, '-=0.2')
      if (pro) tl.from('.ss-pro', { autoAlpha: 0, y: 26, duration: .5 }, '-=0.1')
        .from('[data-side="you"]', { x: -40, autoAlpha: 0, duration: .5 }, '<')
        .from('[data-side="pro"]', { x: 40, autoAlpha: 0, duration: .5 }, '<')
        .from('[data-side="mid"]', { scale: 0, autoAlpha: 0, duration: .5, ease: 'back.out(2)' }, '-=0.2')
      tl.from('.ss-ladder-card, .ss-cta', { autoAlpha: 0, y: 22, duration: .5, stagger: .12 }, '-=0.1')
      if (pro) gsap.to('.ss-badge', { scale: 1.06, repeat: -1, yoyo: true, duration: 1.1, ease: 'sine.inOut', delay: 2.2 })
    })
    mm.add('(prefers-reduced-motion: reduce)', () => { if (pct != null) setDotN(pct) })
    return () => mm.revert()
  }, { scope: stage, dependencies: [disc, age, pb] })

  const heat = (f) => `hsl(28, 82%, ${11 + f * 44}%)`
  const onSeg = (t) => {
    if (t.level === curLevel) return setRead({ tag: ['NOW', 'rgba(249,115,22,0.15)', O], msg: `${Her} level right now — ${t.name} (${bare(t.time)}${unit}).` })
    const diff = +(isTime ? (pb - t.time) : (t.time - pb)).toFixed(2)
    if (diff > 0) setRead({ tag: ['TARGET', 'rgba(96,165,250,0.15)', '#60a5fa'], msg: `${t.name} needs ${bare(t.time)}${unit} — ${she}'s ${Math.abs(diff)}${unit} away.` })
    else setRead({ tag: ['CLEARED', 'rgba(52,211,153,0.15)', '#34d399'], msg: `${t.name} needs ${bare(t.time)}${unit} — ${she}'s already ${Math.abs(diff)}${unit} inside it.` })
  }

  return (
    <div ref={stage} className="landing-font" style={{ color: '#f5f5f7' }}>
      <style>{`
        @media (max-width: 680px) {
          .ss-rail { grid-template-columns: 1fr !important; gap: 10px !important; margin: 18px 0 !important; }
          .ss-rail .ss-arrow { width: 100% !important; height: 20px !important; transform: rotate(90deg); }
          .ss-pro-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .ss-pro-grid [data-side="you"] { text-align: center !important; }
          .ss-verdict { font-size: 25px !important; }
          .ss-num { font-size: 38px !important; }
          .ss-you-num { font-size: 42px !important; }
          .ss-pro-num { font-size: 34px !important; }
          .ss-provenance { justify-content: center !important; }
        }
      `}</style>
      {/* subject line */}
      <div className="mono-font" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#6b7280', paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 22 }}>
        <span>Snapshot</span><span>Discipline <b style={{ color: '#f5f5f7' }}>{disc}</b></span><span><b style={{ color: '#f5f5f7' }}>{gender} · {pl?.ageGroup || getAgeGroup(age)}</b></span><span>Age <b style={{ color: '#f5f5f7' }}>{age}</b></span>
      </div>

      {/* verdict */}
      <div style={{ marginBottom: 6 }}>
        <h1 data-a="v" className="ss-verdict" style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.12 }}>
          A <span style={{ color: O }}>{pl ? pl.name.toLowerCase() : 'developing'}-level</span> {noun}{nextName ? <> — one step from the <span style={{ color: O }}>{nextName.toLowerCase()}</span> tier.</> : ' — at the top tier for this age.'}
        </h1>
        <p data-a="v" style={{ color: '#9aa1ac', fontSize: 15, marginTop: 8 }}>Here's the read on {bare(pb)}{unit}, in three steps.</p>
      </div>

      {/* story rail */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'stretch', margin: '24px 0 20px' }} className="ss-rail">
        <Beat cls="s1" accent="#94a3b8" step={`Step 1 · Where ${she} is`}>
          <div style={numS} className="ss-num">{bare(pb)}<span style={numU}>{unit}</span></div>
          <div style={sayS}>{Her} personal best — <b style={bS}>a {noun === 'sprinter' ? 'strong' : 'solid'} {disc} for age {age}</b>. The starting point for everything below.</div>
        </Beat>
        <div className="ss-arrow" style={arrowS}>→</div>
        <Beat cls="s2" accent={O} step="Step 2 · How good that is">
          {pct != null ? (<>
            <Dots pct={pct} />
            <div style={{ fontSize: 32, fontWeight: 700 }} className="ss-num">{dotN}<span style={{ fontSize: 15, color: '#9aa1ac' }}> of 100</span></div>
            <div style={sayS}>Line up 100 {gender === 'Male' ? 'men' : 'women'} at {her} level who reached an Olympic final — <b style={bS}>{she}'s ahead of {pct} of them.</b></div>
          </>) : (<div style={sayS}>Percentile data is still being built for this event.</div>)}
        </Beat>
        <div className="ss-arrow" style={arrowS}>→</div>
        <Beat cls="s3" accent="#34d399" step="Step 3 · What's next">
          {gap != null ? (<>
            <div style={{ ...numS, color: '#34d399' }} className="ss-num">+{gap}<span style={numU}>{unit}</span></div>
            <div style={sayS}><b style={bS}>That's all that separates {her} from {nextName} level</b> — roughly one strong season.</div>
          </>) : (<><div style={{ ...numS, color: '#fbbf24' }} className="ss-num">Top</div><div style={sayS}>{She}'s already at the ceiling tier for {her} age group.</div></>)}
        </Beat>
      </div>

      {/* PRO COMPARISON */}
      {pro && (
        <div className="ss-pro" style={{ position: 'relative', overflow: 'hidden', borderRadius: 18, padding: '28px 30px 24px', margin: '6px 0 18px', border: '1px solid rgba(249,115,22,0.3)', background: 'radial-gradient(120% 140% at 50% 0%, rgba(249,115,22,0.14) 0%, rgba(249,115,22,0.04) 38%, rgba(10,10,12,0) 72%), #101014', boxShadow: '0 30px 80px -40px rgba(249,115,22,0.5)' }}>
          <div className="mono-font" style={{ textAlign: 'center', fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: O, marginBottom: 20 }}>{Her} closest pro at the same age</div>
          <div className="ss-pro-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1.1fr', alignItems: 'center', gap: 18 }}>
            <div data-side="you" style={{ textAlign: 'right' }}>
              <div style={lblS}>{Her.toUpperCase()} · AT AGE {age}</div>
              <div className="ss-you-num" style={{ fontSize: 54, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{bare(pb)}<span style={{ fontSize: 22, color: '#9aa1ac' }}>{unit}</span></div>
            </div>
            <div data-side="mid" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span className="ss-badge mono-font" style={{ fontSize: 11, color: '#0a0a0b', background: O, padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>{Math.abs(pro.timeDiff).toFixed(2)}{unit} apart</span>
              <span style={{ fontSize: 32, color: O, lineHeight: 1 }}>≈</span>
              <span className="mono-font" style={{ fontSize: 9.5, letterSpacing: '.1em', color: '#6b7280', textTransform: 'uppercase' }}>{isTime ? 'same speed' : 'same distance'} · same age</span>
            </div>
            <div data-side="pro" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#fbbf24)', color: '#0a0a0b', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pro.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</div>
                <div><div style={{ fontSize: 17, fontWeight: 700 }}>{pro.name}</div><div className="mono-font" style={{ fontSize: 11, color: '#6b7280' }}>{pro.nationality} · {disc}</div></div>
              </div>
              <div style={lblS}>AT AGE {pro.closestAge}</div>
              <div className="ss-pro-num" style={{ fontSize: 42, fontWeight: 800, color: O, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{bare(pro.timeAtSimilarAge)}<span style={{ fontSize: 18, color: '#9aa1ac' }}>{unit}</span></div>
            </div>
          </div>
          <div className="ss-provenance" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: 13, color: '#9aa1ac' }}>
            Went on to →
            <span style={chipS}>{pro.classification === 'F' ? 'Olympic finalist' : pro.classification === 'SF' ? 'Olympic semi-finalist' : 'Olympic qualifier'}</span>
            <span style={chipS}>Career best {bare(pro.pb)}{unit}</span>
            <span style={chipS}>Peaked at {pro.peakAge}</span>
          </div>
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 16 }}>At {age}, {she}'s running <b style={{ color: O }}>what {pro.name.split(' ')[0]} ran at {pro.closestAge}.</b></div>
        </div>
      )}

      {/* interactive ladder */}
      {ladder.length > 1 && (
        <div className="ss-ladder-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 22px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>How elite is that mark?</h3>
            <span className="mono-font" style={{ fontSize: 11, color: '#6b7280' }}>{pl?.ageGroup} {gender.toLowerCase()}</span>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 22 }}>Tap or hover a level to see what it would take.</div>
          <div style={{ display: 'flex', height: 44, borderRadius: 9, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.13)' }}>
            {ladder.map((t, i) => {
              const f = ladder.length > 1 ? i / (ladder.length - 1) : 0
              const isYou = t.level === curLevel
              return (
                <div key={t.level} onMouseEnter={() => onSeg(t)} onMouseLeave={() => setRead(null)} onClick={() => onSeg(t)}
                  title={t.name}
                  style={{ flex: 1, background: heat(f), cursor: 'pointer', position: 'relative', outline: isYou ? '2px solid #fff' : 'none', outlineOffset: '-2px', zIndex: isYou ? 2 : 1 }}>
                  {isYou && <span className="mono-font" style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 9, color: '#0a0a0b', background: '#fff', padding: '2px 7px', borderRadius: 4 }}>{Her.toUpperCase()} · {bare(pb)}{unit}</span>}
                </div>
              )
            })}
          </div>
          <div className="mono-font" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7280' }}>
            <span>{ladder[0].name}</span><span>{ladder[ladder.length - 1].name}</span>
          </div>
          <div style={{ marginTop: 22, minHeight: 44, background: 'rgba(255,255,255,0.03)', border: `1px solid ${read ? read.tag[2] : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '11px 15px', fontSize: 14, color: '#9aa1ac', display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color .2s' }}>
            {read ? (<><span className="mono-font" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: read.tag[1], color: read.tag[2] }}>{read.tag[0]}</span><span dangerouslySetInnerHTML={{ __html: read.msg }} /></>)
              : (<><span className="mono-font" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'rgba(249,115,22,0.15)', color: O }}>NOW</span><span>{She}'s at <b style={{ color: '#f5f5f7' }}>{pl?.name}</b> level. <b style={{ color: '#f5f5f7' }}>Hover a level</b> to see the gap.</span></>)}
          </div>
        </div>
      )}

      {/* what now */}
      <div className="ss-cta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 22, flexWrap: 'wrap', background: 'linear-gradient(135deg, rgba(96,165,250,0.07), rgba(255,255,255,0.01))', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 14, padding: '20px 24px' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 5 }}>So — what now?</div>
          <div style={{ fontSize: 14, color: '#9aa1ac', lineHeight: 1.5, maxWidth: '66ch' }}>This is one time: a <b style={{ color: '#f5f5f7' }}>dot</b>, not a line. Add {her} past PBs and we'll chart {her} real improvement curve, project {her} peak age, and match {her} whole career to Olympic athletes.</div>
        </div>
        <button onClick={onAddPBs} className="landing-font" style={{ whiteSpace: 'nowrap', fontSize: 14, fontWeight: 600, padding: '12px 20px', borderRadius: 11, background: O, color: '#0a0a0b', border: 'none', cursor: 'pointer' }}>+ Add past PBs</button>
      </div>
    </div>
  )
}

function Beat({ cls, accent, step, children }) {
  const bg = cls === 's1' ? 'rgba(148,163,184,0.05)' : cls === 's2' ? 'rgba(249,115,22,0.07)' : 'rgba(52,211,153,0.07)'
  return (
    <div className="ss-beat" style={{ position: 'relative', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', background: bg }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div className="mono-font" style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 14, color: accent }}>{step}</div>
      {children}
    </div>
  )
}
function Dots({ pct }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20,1fr)', gap: 3, marginBottom: 12 }}>
      {Array.from({ length: 100 }).map((_, i) => (
        <div key={i} style={{ aspectRatio: '1', borderRadius: '50%', background: i < pct ? '#f97316' : 'rgba(255,255,255,0.09)' }} />
      ))}
    </div>
  )
}
const numS = { fontSize: 50, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }
const numU = { fontSize: 21, color: '#9aa1ac' }
const sayS = { color: '#9aa1ac', fontSize: 14.5, lineHeight: 1.5, marginTop: 'auto', paddingTop: 16 }
const bS = { color: '#f5f5f7', fontWeight: 600 }
const arrowS = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, color: '#f97316', fontSize: 26 }
const lblS = { fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '.14em', color: '#6b7280', marginBottom: 6 }
const chipS = { fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.22)', padding: '4px 10px', borderRadius: 6 }

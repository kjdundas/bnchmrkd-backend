import { useState, useEffect } from 'react'
import { computeWAPoints } from '../lib/waScoring'

// World Athletics points for an athlete's PB. Lazily loads the ~1MB scoring
// table on mount (never on the landing). Renders nothing when the event/age
// band isn't scoreable — so it's safe to drop into any results view.
export default function WAPointsCard({ discipline, gender, age, pb }) {
  const [data, setData] = useState(undefined) // undefined = loading, null = n/a, object = ok

  useEffect(() => {
    let alive = true
    setData(undefined)
    computeWAPoints({ discipline, gender, age, pb })
      .then((d) => { if (alive) setData(d) })
      .catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [discipline, gender, age, pb])

  if (data === null) return null
  const loading = data === undefined
  const pct = loading ? 0 : Math.max(2, Math.min(100, (data.points / 1400) * 100))
  const edgeNote = !loading && data.edge > 0 ? ' · above table' : !loading && data.edge < 0 ? ' · below table' : ''

  return (
    <div style={{ borderRadius: 14, border: '1px solid rgba(249,115,22,0.28)', background: 'linear-gradient(135deg, rgba(249,115,22,0.09), rgba(255,255,255,0.01))', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="mono-font" style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#f97316', fontWeight: 700 }}>World Athletics points</div>
          {loading ? (
            <div style={{ height: 40, width: 130, marginTop: 8, borderRadius: 8, background: 'rgba(255,255,255,0.06)' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', color: '#f5f5f7', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{data.points.toLocaleString()}</span>
              <span style={{ fontSize: 14, color: '#9aa1ac', fontWeight: 600 }}>pts</span>
            </div>
          )}
        </div>
        {!loading && (
          <div className="mono-font" style={{ fontSize: 11, color: '#9aa1ac', textAlign: 'right' }}>
            <div style={{ color: '#f5f5f7', fontWeight: 700 }}>{data.event}</div>
            <div style={{ color: '#6b7280', marginTop: 2 }}>{data.cohort} table{edgeNote}</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: 'linear-gradient(90deg, #f97316, #fbbf24)', borderRadius: 3, transition: 'width .6s cubic-bezier(0.4,0,0.2,1)' }} />
      </div>
      <div className="mono-font" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 9.5, color: '#5b6472' }}>
        <span>0</span><span>elite ~1200+</span><span>1400</span>
      </div>

      <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 10, lineHeight: 1.45 }}>
        A single 0–1400 score comparing performances across events, sexes and age groups.
      </div>
    </div>
  )
}

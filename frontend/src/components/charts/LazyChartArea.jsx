import { useState, useEffect } from 'react'

// Lazily loads recharts the first time any chart mounts, then hands the whole
// module to a render-prop child. This keeps recharts (~400KB) out of the
// initial landing bundle — it only downloads once a chart is actually shown
// (i.e. after the user runs an analysis or opens a trajectory).
//
// Usage:
//   <LazyChartArea>{(RC) => {
//     const { ResponsiveContainer, ComposedChart, ... } = RC
//     return (<ResponsiveContainer ...>...</ResponsiveContainer>)
//   }}</LazyChartArea>
let _recharts = null

export default function LazyChartArea({ height = 320, children }) {
  const [RC, setRC] = useState(_recharts)
  useEffect(() => {
    if (_recharts) return
    let alive = true
    import('recharts').then((m) => {
      _recharts = m
      if (alive) setRC(m)
    })
    return () => { alive = false }
  }, [])

  if (!RC) {
    return (
      <div style={{ height, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
        Loading chart…
      </div>
    )
  }
  return children(RC)
}

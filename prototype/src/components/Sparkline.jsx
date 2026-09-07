// 内联 SVG 迷你趋势：de-emphasis 灰 + 当前点 accent（dataviz stat-tile 规范）
export default function Sparkline({ values, w = 64, h = 18 }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p) => typeof p.v === 'number')
  if (pts.length < 2) return <svg width={w} height={h} aria-hidden="true" />
  const vs = pts.map((p) => p.v)
  const min = Math.min(...vs)
  const max = Math.max(...vs)
  const x = (p) => (values.length > 1 ? (p.i / (values.length - 1)) * (w - 6) + 3 : w / 2)
  const y = (v) => (max > min ? h - 3 - ((v - min) / (max - min)) * (h - 6) : h / 2)
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p).toFixed(1)},${y(p.v).toFixed(1)}`).join('')
  const last = pts[pts.length - 1]
  return (
    <svg width={w} height={h} aria-hidden="true">
      <path d={d} fill="none" stroke="#898781" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(last.v)} r="2.6" fill="#2a78d6" stroke="#fcfcfb" strokeWidth="1.5" />
    </svg>
  )
}

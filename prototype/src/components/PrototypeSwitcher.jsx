// 底部浮动变体切换器（原型专用，生产构建不渲染）
export default function PrototypeSwitcher({ variants, current, onChange }) {
  if (import.meta.env.PROD) return null
  const idx = Math.max(0, variants.findIndex((v) => v.key === current))
  const prev = variants[(idx - 1 + variants.length) % variants.length]
  const next = variants[(idx + 1) % variants.length]
  return (
    <div className="proto-switcher">
      <button aria-label="上一个变体" onClick={() => onChange(prev.key)}>‹</button>
      <span className="proto-label">{variants[idx].key} · {variants[idx].name}</span>
      <button aria-label="下一个变体" onClick={() => onChange(next.key)}>›</button>
    </div>
  )
}

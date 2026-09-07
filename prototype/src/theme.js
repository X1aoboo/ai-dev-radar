// 调色板 = dataviz 参考实例（light 模式），未做品牌替换。校验记录见 README。
export const T = {
  surface: '#fcfcfb',
  page: '#f9f9f7',
  ink: '#0b0b0b',
  ink2: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  border: 'rgba(11,11,11,0.10)',
  accent: '#2a78d6', // categorical slot-1，单系列条形 / 折线主系列
  gray: '#898781', // de-emphasis（“本团队 vs 均值”的均值系列）
  good: '#006300',
  bad: '#d03b3b',
  neutral: '#f0efec',
}

// 顺序蓝 ramp（steps 100–700），热力图/幅度编码
export const SEQ = [
  '#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5',
  '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b',
]

function hex2rgb(h) {
  h = h.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
const clamp01 = (t) => Math.max(0, Math.min(1, t))

export function seqColor(t) {
  const n = SEQ.length - 1
  const x = clamp01(t) * n
  const i = Math.min(n - 1, Math.floor(x))
  const f = x - i
  const a = hex2rgb(SEQ[i])
  const b = hex2rgb(SEQ[i + 1])
  return '#' + a.map((v, k) => Math.round(v + (b[k] - v) * f).toString(16).padStart(2, '0')).join('')
}

// 标签落在色块内时按亮度选墨色/白色
export function inkOn(hex) {
  const [r, g, b] = hex2rgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? T.ink : '#ffffff'
}

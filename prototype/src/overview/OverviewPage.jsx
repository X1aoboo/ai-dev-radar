import VariantTrend from './VariantTrend'
import VariantAHeatmap from './VariantAHeatmap'
import VariantBTable from './VariantBTable'
import VariantCCards from './VariantCCards'

const NOTES = {
  T: '变体 T · 趋势大图矩阵（用户选定方向）：每活动一张大图，4 条团队趋势线（固定色，颜色跟随团队）+ 全公司均值（灰）；悬停十字线一图读全部团队。已否掉：热力图（A）、表格+迷你趋势（B）。',
  C: '变体 C · 活动卡片矩阵：每活动一张卡，团队为名义类目 → 单色条形（不按值着色），密度低、逐活动横向对比强；布尔活动直接列状态。点击条形下钻。（保留对照）',
}

export default function OverviewPage({ variant, filter, nav }) {
  return (
    <div>
      <div className="page-head">
        <h1>总览 · 团队 × 活动</h1>
      </div>
      <p className="variant-note">{NOTES[variant]}</p>
      {variant === 'T' && <VariantTrend filter={filter} nav={nav} />}
      {variant === 'A' && <VariantAHeatmap filter={filter} nav={nav} />}
      {variant === 'B' && <VariantBTable filter={filter} nav={nav} />}
      {variant === 'C' && <VariantCCards filter={filter} nav={nav} />}
    </div>
  )
}

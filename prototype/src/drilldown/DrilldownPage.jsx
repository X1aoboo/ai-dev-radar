import { TEAMS } from '../data/catalog'
import DrillAFlow from './DrillAFlow'
import DrillBFocus from './DrillBFocus'

const NOTES = {
  A: '下钻变体 A（A+B 结合，用户选定方向）：KPI 行 + 左侧活动目录（点击锚点跳转）+ 活动趋势卡平铺（本团队 vs 全公司均值）；需要看数时点“详细数据”就地展开迭代分片对比 + 分子/分母事实表。',
  B: '下钻变体 B · 活动目录 + 主详情（对照）：左侧目录，右侧单活动完整详情——各指标趋势、迭代分片对比、事实表。',
}

export default function DrilldownPage({ teamId, variant, filter }) {
  const team = TEAMS.find((t) => t.id === teamId)
  return (
    <div>
      <div className="crumb"><a href={`#/?variant=${variant}`}>← 返回总览</a></div>
      <div className="page-head"><h1>{team.name} · 团队下钻</h1></div>
      <p className="variant-note">{NOTES[variant]}</p>
      {variant === 'A'
        ? <DrillAFlow team={team} filter={filter} />
        : <DrillBFocus team={team} filter={filter} />}
    </div>
  )
}

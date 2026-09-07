// 变体 C：活动卡片矩阵。每活动一张卡：团队是名义类目 → 单色（slot-1）条形图，
// 不按值着色；值标签在条形末端；布尔活动直接列各团队状态。点击条形下钻。
import EChart from '../components/EChart'
import { T } from '../theme'
import { ACTIVITIES, TEAMS } from '../data/catalog'
import {
  activityMetric, currentPeriod, fmtValue, genFallbackFilter, periodsFor, valueOf, factText, sumsFor,
} from '../data/compute'

function ActivityCard({ a, filter, nav }) {
  const periods = periodsFor(filter)
  const period = currentPeriod(filter, periods)
  const m = activityMetric(a, filter.metricSlot)

  if (m.type === 'bool') {
    return (
      <div className="card act-card">
        <div className="head"><span className="nm">{a.name}</span><span className="mt">{m.name}</span><span className="kind">通用</span></div>
        <div className="bool-list">
          {TEAMS.map((t) => {
            const v = valueOf(a.id, m.id, t.id, filter, period)
            return <span key={t.id} className={v ? 'yes' : 'no'}>{t.name}：{v ? '✓ 具备' : '✗ 不具备'}</span>
          })}
        </div>
      </div>
    )
  }

  const rows = TEAMS.map((t) => ({
    team: t,
    v: valueOf(a.id, m.id, t.id, filter, period),
    s: sumsFor(t.id, a.id, m.id, filter, period),
  }))
  const option = {
    grid: { left: 8, right: 44, top: 4, bottom: 4, containLabel: true },
    tooltip: {
      formatter: (p) => {
        const r = rows[p.dataIndex]
        return `${r.team.name}<br/>${m.name}：${fmtValue(m, r.v)}<br/>${factText(m, r.s)}`
      },
    },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category', inverse: true, data: TEAMS.map((t) => t.name),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: T.ink2, fontSize: 11.5 },
    },
    series: [{
      type: 'bar', data: rows.map((r) => (typeof r.v === 'number' ? +r.v.toFixed(4) : 0)),
      barWidth: 14,
      itemStyle: { color: T.accent, borderRadius: [0, 4, 4, 0] },
      label: {
        show: true, position: 'right', color: T.ink2, fontSize: 11.5,
        formatter: (p) => fmtValue(m, rows[p.dataIndex].v),
      },
    }],
  }

  return (
    <div className="card act-card">
      <div className="head">
        <span className="nm">{a.name}</span>
        <span className="mt">{m.name}</span>
        <span className="kind">{a.kind === 'key' ? '关键' : '通用'}</span>
      </div>
      <EChart option={option} height={118} onClick={(p) => nav(rows[p.dataIndex].team.id)} />
    </div>
  )
}

export default function VariantCCards({ filter, nav }) {
  const keyActs = ACTIVITIES.filter((a) => a.kind === 'key')
  const genActs = ACTIVITIES.filter((a) => a.kind === 'general')
  const genFilter = genFallbackFilter()
  return (
    <div>
      <h2 className="sec">关键研发活动</h2>
      <div className="card-grid">
        {keyActs.map((a) => <ActivityCard key={a.id} a={a} filter={filter} nav={nav} />)}
      </div>
      <h2 className="sec">
        通用研发能力
        {filter.dim === 'iter' && <span className="badge">无迭代维度 · 固定按月 · 周期 2026-08</span>}
      </h2>
      <div className="card-grid">
        {genActs.map((a) => <ActivityCard key={a.id} a={a} filter={genFilter} nav={nav} />)}
      </div>
    </div>
  )
}

// 总览变体 T：趋势大图矩阵。每活动一张大图：4 条团队趋势线（固定 categorical 色，
// 颜色跟随团队）+ 全公司均值（de-emphasis 灰）。用户拍板的方向（否掉热力图与表格+迷你趋势）。
import { useState } from 'react'
import EChart from '../components/EChart'
import { T } from '../theme'
import { TEAM_COLORS } from '../drilldown/multiTrendOption'
import { ACTIVITIES, TEAMS } from '../data/catalog'
import { avgValue, genFallbackFilter, periodsFor, valueOf } from '../data/compute'
import { multiTrendOption } from '../drilldown/multiTrendOption'

function TrendCard({ a, filter, nav }) {
  const [mi, setMi] = useState(0)
  const m = a.metrics[mi]
  const useFallback = a.kind === 'general' && filter.dim === 'iter'
  const f = useFallback ? genFallbackFilter() : filter
  const ps = periodsFor(f)

  if (m.type === 'bool') {
    return (
      <div className="card act-card">
        <div className="head"><span className="nm">{a.name}</span><span className="mt">{m.name}</span><span className="kind">通用</span></div>
        <div className="bool-list">
          {TEAMS.map((t) => {
            const v = valueOf(a.id, m.id, t.id, f, null)
            return <span key={t.id} className={v ? 'yes' : 'no'}>{t.name}：{v ? '✓ 具备' : '✗ 不具备'}</span>
          })}
        </div>
      </div>
    )
  }

  const rows = TEAMS.map((t, i) => ({
    name: t.name,
    color: TEAM_COLORS[i],
    values: ps.map((p) => valueOf(a.id, m.id, t.id, f, p)),
  }))
  rows.push({ name: '全公司均值', color: T.gray, values: ps.map((p) => avgValue(a.id, m.id, f, p)) })

  return (
    <div className="card act-card">
      <div className="head">
        <span className="nm">{a.name}</span>
        {a.metrics.length > 1 && a.metrics.map((mm, i) => (
          <button key={mm.id} className={`metric-pill ${i === mi ? 'on' : ''}`} onClick={() => setMi(i)}>{mm.name}</button>
        ))}
        <span className="kind">{a.kind === 'key' ? '关键' : '通用'}</span>
      </div>
      <EChart
        option={multiTrendOption({ labels: ps.map((p) => p.label), rows, metric: m })}
        height={220}
        onClick={(p) => { const t = TEAMS.find((x) => x.name === p.seriesName); if (t) nav(t.id) }}
      />
      {useFallback && <p className="fact-note">通用研发能力无迭代维度，固定按月趋势</p>}
    </div>
  )
}

export default function VariantTrend({ filter, nav }) {
  const keyActs = ACTIVITIES.filter((a) => a.kind === 'key')
  const genActs = ACTIVITIES.filter((a) => a.kind === 'general')
  return (
    <div>
      <h2 className="sec">关键研发活动</h2>
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(560px, 1fr))' }}>
        {keyActs.map((a) => <TrendCard key={a.id} a={a} filter={filter} nav={nav} />)}
      </div>
      <h2 className="sec">
        通用研发能力
        {filter.dim === 'iter' && <span className="badge">无迭代维度 · 固定按月趋势</span>}
      </h2>
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(560px, 1fr))' }}>
        {genActs.map((a) => <TrendCard key={a.id} a={a} filter={filter} nav={nav} />)}
      </div>
    </div>
  )
}

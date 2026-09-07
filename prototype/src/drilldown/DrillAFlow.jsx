// 下钻变体 A（A+B 结合，用户选定方向）：
// KPI 行 + 左侧活动目录（锚点跳转）+ 活动趋势卡平铺（本团队 vs 全公司均值），
// 每卡可展开“详细数据”（迭代分片对比条形 + 分子/分母事实表）——A 管概览，B 管详细数据。
import { useState } from 'react'
import EChart from '../components/EChart'
import Sparkline from '../components/Sparkline'
import { T } from '../theme'
import { ACTIVITIES } from '../data/catalog'
import {
  avgValue, currentPeriod, factText, fmtValue,
  genFallbackFilter, periodsFor, sumsFor, valueOf,
} from '../data/compute'
import { trendOption } from './chartOpts'
import { IterCompare, FactTable } from './DrillBFocus'

const isRate = (m) => m.type === 'penetration' || m.type === 'ratio'

function aggKeyMetrics(teamId, filter, period, pred) {
  const vals = []
  ACTIVITIES.filter((a) => a.kind === 'key').forEach((a) =>
    a.metrics.forEach((m) => {
      if (pred(m)) {
        const v = valueOf(a.id, m.id, teamId, filter, period)
        if (typeof v === 'number') vals.push(v)
      }
    })
  )
  return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null
}

function Tile({ label, metric, value, delta, spark }) {
  const fmt = (v) => (typeof v === 'number' ? fmtValue(metric, v) : '—')
  return (
    <div className="card stat-tile">
      <div className="lbl">{label}</div>
      <div className="val">{metric.type === 'bool' ? (value ? '具备' : '不具备') : fmt(value)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {typeof delta === 'number' && (
          <span className={`delta ${delta >= 0 ? 'up' : 'down'}`}>
            环比 {delta >= 0 ? '+' : ''}{Math.round(delta * 100)}%
          </span>
        )}
        {spark && spark.length > 1 && <Sparkline values={spark} w={70} h={20} />}
      </div>
    </div>
  )
}

function ActivityTrendCard({ a, filter, team }) {
  const [mi, setMi] = useState(0)
  const [showDetail, setShowDetail] = useState(false)
  const m = a.metrics[mi]
  const useFallback = a.kind === 'general' && filter.dim === 'iter'
  const f = useFallback ? genFallbackFilter() : filter
  const ps = periodsFor(f)
  const period = currentPeriod(f, ps)
  const self = ps.map((p) => valueOf(a.id, m.id, team.id, f, p))
  const avg = ps.map((p) => avgValue(a.id, m.id, f, p))
  const s = m.type === 'bool' ? null : sumsFor(team.id, a.id, m.id, f, period)

  if (m.type === 'bool') {
    const v = valueOf(a.id, m.id, team.id, f, period)
    return (
      <div className="card act-card" id={`act-${a.id}`}>
        <div className="head"><span className="nm">{a.name}</span><span className="kind">通用</span></div>
        <div style={{ fontSize: 18, fontWeight: 600, color: v ? T.good : T.bad, padding: '8px 0' }}>
          {v ? '✓ 已具备自动化构建部署能力' : '✗ 尚不具备'}
        </div>
      </div>
    )
  }

  return (
    <div className="card act-card" id={`act-${a.id}`}>
      <div className="head">
        <span className="nm">{a.name}</span>
        {a.metrics.length > 1 && a.metrics.map((mm, i) => (
          <button key={mm.id} className={`metric-pill ${i === mi ? 'on' : ''}`} onClick={() => setMi(i)}>{mm.name}</button>
        ))}
        <button
          className={`metric-pill ${showDetail ? 'on' : ''}`}
          style={{ marginLeft: 'auto' }}
          onClick={() => setShowDetail((x) => !x)}
        >
          {showDetail ? '收起详细数据' : '详细数据'}
        </button>
      </div>
      <EChart option={trendOption({ labels: ps.map((p) => p.label), self, avg, metric: m })} height={190} />
      <p className="fact-note">
        {period ? `周期 ${period.label}：` : '全部周期：'}{factText(m, s)}（{a.kind === 'key' ? '按迭代标签聚合' : '按时间字段聚合'}）
        {useFallback && ' · 通用研发能力无迭代维度，固定按月'}
      </p>
      {showDetail && (
        <div style={{ borderTop: '1px solid #e1e0d9', marginTop: 8, paddingTop: 4 }}>
          {a.kind === 'key' && <IterCompare a={a} m={m} filter={filter} team={team} />}
          <FactTable a={a} filter={filter} team={team} />
        </div>
      )}
    </div>
  )
}

export default function DrillAFlow({ team, filter }) {
  const ps = periodsFor(filter)
  const period = currentPeriod(filter, ps)
  const pi = ps.findIndex((p) => p.id === filter.periodId)
  const prev = pi > 0 ? ps[pi - 1] : null
  const trendPs = ps.slice(-12)

  const penNow = aggKeyMetrics(team.id, filter, period, isRate)
  const penPrev = prev ? aggKeyMetrics(team.id, filter, prev, isRate) : null
  const effNow = aggKeyMetrics(team.id, filter, period, (m) => m.type === 'efficiency')
  const effPrev = prev ? aggKeyMetrics(team.id, filter, prev, (m) => m.type === 'efficiency') : null
  const reviewNow = valueOf('mrr', 'mrr-rate', team.id, filter, period)
  const reviewPrev = prev ? valueOf('mrr', 'mrr-rate', team.id, filter, prev) : null
  const adBool = valueOf('ad', 'ad-bool', team.id, filter, period)

  const delta = (now, prevV) => (typeof now === 'number' && typeof prevV === 'number' ? now - prevV : null)

  const groups = [
    { title: '关键研发活动', acts: ACTIVITIES.filter((x) => x.kind === 'key') },
    { title: '通用研发能力', acts: ACTIVITIES.filter((x) => x.kind === 'general') },
  ]
  const scrollTo = (id) => document.getElementById(`act-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="drill-layout">
      <div className="card act-nav">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="grp">{g.title}</div>
            {g.acts.map((x) => (
              <button key={x.id} onClick={() => scrollTo(x.id)}>
                {x.name}
                {x.metrics.length > 1 && <span style={{ color: '#898781' }}> ·{x.metrics.length}指标</span>}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="drill-main">
        <div className="kpi-row">
          <Tile label="平均渗透率（关键活动）" metric={{ type: 'penetration' }} value={penNow} delta={delta(penNow, penPrev)}
            spark={trendPs.map((p) => aggKeyMetrics(team.id, filter, p, isRate))} />
          <Tile label="平均效率提升（关键活动）" metric={{ type: 'efficiency' }} value={effNow} delta={delta(effNow, effPrev)}
            spark={trendPs.map((p) => aggKeyMetrics(team.id, filter, p, (m) => m.type === 'efficiency'))} />
          <Tile label="AI检视率" metric={{ type: 'ratio' }} value={reviewNow} delta={delta(reviewNow, reviewPrev)}
            spark={trendPs.map((p) => valueOf('mrr', 'mrr-rate', team.id, filter, p))} />
          <Tile label="自动化构建部署" metric={{ type: 'bool' }} value={adBool} />
        </div>

        <h2 className="sec">关键研发活动</h2>
        <div className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
          {groups[0].acts.map((a) => <ActivityTrendCard key={a.id} a={a} filter={filter} team={team} />)}
        </div>

        <h2 className="sec">
          通用研发能力
          {filter.dim === 'iter' && <span className="badge">无迭代维度 · 固定按月趋势</span>}
        </h2>
        <div className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
          {groups[1].acts.map((a) => <ActivityTrendCard key={a.id} a={a} filter={filter} team={team} />)}
        </div>
      </div>
    </div>
  )
}

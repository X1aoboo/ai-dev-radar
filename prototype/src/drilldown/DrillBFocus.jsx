// 下钻变体 B：左侧活动目录 + 右侧选中活动主详情（各指标趋势、迭代分片对比、事实表）
import { useState } from 'react'
import EChart from '../components/EChart'
import { ACTIVITIES } from '../data/catalog'
import { VERSIONS } from '../data/mock'
import {
  avgValue, fmtValue, genFallbackFilter,
  periodsFor, sumsFor, valueOf,
} from '../data/compute'
import { trendOption, iterCompareOption } from './chartOpts'

function scopedIterations(filter) {
  const vs = VERSIONS.filter((v) => filter.versionId === 'all' || v.id === filter.versionId)
  return vs.flatMap((v) => v.iterations)
}

function MetricBlock({ a, m, filter, team }) {
  const f = filter
  const ps = periodsFor(f)
  const self = ps.map((p) => valueOf(a.id, m.id, team.id, f, p))
  const avg = ps.map((p) => avgValue(a.id, m.id, f, p))
  return (
    <div>
      <h3 style={{ margin: '14px 0 2px', fontSize: 13.5 }}>{m.name}</h3>
      <EChart option={trendOption({ labels: ps.map((p) => p.label), self, avg, metric: m })} height={210} />
    </div>
  )
}

export function IterCompare({ a, m, filter, team }) {
  const its = scopedIterations(filter)
  const iterFilter = { ...filter, dim: 'iter', periodId: 'all' }
  const self = its.map((i) => valueOf(a.id, m.id, team.id, iterFilter, { id: i.id, kind: 'iter' }))
  const avg = its.map((i) => avgValue(a.id, m.id, iterFilter, { id: i.id, kind: 'iter' }))
  return (
    <div>
      <h3 style={{ margin: '14px 0 2px', fontSize: 13.5 }}>迭代分片对比 · {m.name}</h3>
      <EChart option={iterCompareOption({ iterLabels: its.map((i) => i.short), self, avg, metric: m })} height={210} />
    </div>
  )
}

export function FactTable({ a, filter, team }) {
  const f = filter.dim === 'iter' && a.kind === 'general' ? genFallbackFilter() : filter
  const ps = periodsFor(f)
  const metrics = a.metrics.filter((m) => m.type !== 'bool')
  if (!metrics.length) return null
  return (
    <div>
      <h3 style={{ margin: '14px 0 4px', fontSize: 13.5 }}>事实记录（分子 / 分母原始数）</h3>
      <table className="grid-table">
        <thead>
          <tr>
            <th>周期</th>
            {metrics.map((m) => (
              <th key={m.id} colSpan={m.type === 'count' ? 2 : 3} style={{ borderLeft: '1px solid #e1e0d9' }}>{m.name}</th>
            ))}
          </tr>
          <tr>
            <th></th>
            {metrics.flatMap((m) => [
              <th key={m.id + 'n'} style={{ borderLeft: '1px solid #e1e0d9' }}>{m.type === 'efficiency' ? '预估人天' : m.numLabel}</th>,
              m.type === 'count' ? null : <th key={m.id + 'd'}>{m.type === 'efficiency' ? '实际人天' : m.denLabel}</th>,
              m.type === 'count' ? null : <th key={m.id + 'v'}>值</th>,
            ].filter(Boolean))}
          </tr>
        </thead>
        <tbody>
          {ps.map((p) => (
            <tr key={p.id}>
              <td>{p.label}</td>
              {metrics.flatMap((m) => {
                const s = sumsFor(team.id, a.id, m.id, f, p)
                const v = valueOf(a.id, m.id, team.id, f, p)
                const cells = [<td key={m.id + 'n'}>{m.type === 'efficiency' ? s.est.toFixed(1) : s.num}</td>]
                if (m.type !== 'count') {
                  cells.push(<td key={m.id + 'd'}>{m.type === 'efficiency' ? s.act.toFixed(1) : s.den}</td>)
                  cells.push(<td key={m.id + 'v'}>{fmtValue(m, v)}</td>)
                }
                return cells
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DrillBFocus({ team, filter }) {
  const [sel, setSel] = useState('sa')
  const a = ACTIVITIES.find((x) => x.id === sel)
  const useFallback = a.kind === 'general' && filter.dim === 'iter'
  const trendFilter = useFallback ? genFallbackFilter() : filter
  const groups = [
    { title: '关键研发活动', acts: ACTIVITIES.filter((x) => x.kind === 'key') },
    { title: '通用研发能力', acts: ACTIVITIES.filter((x) => x.kind === 'general') },
  ]

  return (
    <div className="drill-layout">
      <div className="card act-nav">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="grp">{g.title}</div>
            {g.acts.map((x) => (
              <button key={x.id} className={x.id === sel ? 'on' : ''} onClick={() => setSel(x.id)}>
                {x.name}
                {x.metrics.length > 1 && <span style={{ color: '#898781' }}> ·{x.metrics.length}指标</span>}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="card drill-main">
        <div className="head" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{a.name}</span>
          <span style={{ color: '#898781', fontSize: 12 }}>{a.kind === 'key' ? '关键研发活动 · 按迭代标签统计' : '通用研发能力 · 按时间字段统计'}</span>
        </div>

        {a.metrics[0].type === 'bool' ? (
          (() => {
            const v = valueOf(a.id, a.metrics[0].id, team.id, filter, null)
            return <div style={{ fontSize: 18, fontWeight: 600, color: v ? '#006300' : '#d03b3b', padding: '12px 0' }}>
              {v ? '✓ 已具备自动化构建部署能力' : '✗ 尚不具备'}
            </div>
          })()
        ) : (
          <>
            {a.metrics.map((m) => (
              <MetricBlock key={m.id} a={a} m={m} filter={trendFilter} team={team} />
            ))}
            {a.kind === 'key' && (
              <>
                {a.metrics.map((m) => (
                  <IterCompare key={m.id} a={a} m={m} filter={filter} team={team} />
                ))}
              </>
            )}
            {useFallback && (
              <p className="fact-note">通用研发能力无迭代维度，趋势固定按月展示（近 6 个月）。</p>
            )}
            <FactTable a={a} filter={filter} team={team} />
          </>
        )}
      </div>
    </div>
  )
}

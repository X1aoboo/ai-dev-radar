// 变体 B：表格 + 迷你趋势。行 = 活动（分组块），列 = 团队；
// 每格 = 当前周期值（tabular-nums）+ 近几期迷你趋势 + 分子/分母小字。效率提升正负用 delta 色。
import Sparkline from '../components/Sparkline'
import { ACTIVITIES, TEAMS } from '../data/catalog'
import {
  GEN_TREND_PERIODS, activityMetric, currentPeriod, factText, fmtValue,
  genFallbackFilter, periodsFor, sumsFor, valueOf,
} from '../data/compute'

function Section({ activities, filter, periods, nav }) {
  const period = currentPeriod(filter, periods)
  const trendPeriods = periods.slice(-12)
  return (
    <table className="grid-table">
      <thead>
        <tr>
          <th style={{ width: '190px' }}>活动 / 指标</th>
          {TEAMS.map((t) => <th key={t.id}>{t.name}</th>)}
        </tr>
      </thead>
      <tbody>
        {activities.map((a) => {
          const m = activityMetric(a, filter.metricSlot)
          return (
            <tr key={a.id}>
              <td className="act-name">{a.name}<span className="m">{m.name}</span></td>
              {TEAMS.map((t) => {
                const v = valueOf(a.id, m.id, t.id, filter, period)
                const s = m.type === 'bool' ? null : sumsFor(t.id, a.id, m.id, filter, period)
                const trend = trendPeriods.map((p) => valueOf(a.id, m.id, t.id, filter, p))
                const cls = m.type === 'efficiency' && typeof v === 'number' ? (v >= 0 ? 'pos' : 'neg') : ''
                return (
                  <td key={t.id} className="cell" onClick={() => nav(t.id)} title={m.type === 'bool' ? '' : factText(m, s)}>
                    <div className={`v ${cls}`}>{fmtValue(m, v)}</div>
                    {m.type !== 'bool' && <Sparkline values={trend} />}
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default function VariantBTable({ filter, nav }) {
  const keyActs = ACTIVITIES.filter((a) => a.kind === 'key')
  const genActs = ACTIVITIES.filter((a) => a.kind === 'general')
  const periods = periodsFor(filter)
  const genFilter = genFallbackFilter()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%' }}><tbody>
          <tr className="sec-row"><td colSpan={5} style={{ background: '#f0efec', color: '#52514e', fontSize: 12, fontWeight: 600, padding: '4px 10px' }}>关键研发活动</td></tr>
        </tbody></table>
        <Section activities={keyActs} filter={filter} periods={periods} nav={nav} />
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%' }}><tbody>
          <tr className="sec-row">
            <td colSpan={5} style={{ background: '#f0efec', color: '#52514e', fontSize: 12, fontWeight: 600, padding: '4px 10px' }}>
              通用研发能力{filter.dim === 'iter' && '（无迭代维度 · 迷你趋势固定为近 6 个月）'}
            </td>
          </tr>
        </tbody></table>
        <Section activities={genActs} filter={genFilter} periods={GEN_TREND_PERIODS} nav={nav} />
      </div>
    </div>
  )
}

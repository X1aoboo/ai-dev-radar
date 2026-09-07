// 口径计算：所有率/效率由分子分母现算（不存现成比率）。
// filter = { dim:'time'|'iter', gran:'month'|'week', versionId, periodId, metricSlot }
import { ACTIVITIES, ACT_BY_ID, TEAMS, METRIC_BY_ID } from './catalog'
import { KEY_FACTS, GEN_FACTS, BOOL_FACTS, VERSIONS, WEEKS, MONTHS } from './mock'

// 当前筛选下的周期序列（趋势 X 轴）
export function periodsFor(filter) {
  if (filter.dim === 'iter') {
    const vs = VERSIONS.filter((v) => filter.versionId === 'all' || v.id === filter.versionId)
    return vs.flatMap((v) => v.iterations.map((i) => ({ id: i.id, label: i.short, kind: 'iter', weeks: i.weeks })))
  }
  if (filter.gran === 'month') return MONTHS.map((m) => ({ id: m.id, label: m.label, kind: 'month', weeks: m.weeks }))
  return WEEKS.map((w) => ({ id: w.id, label: w.label, kind: 'week', weeks: [w.n] }))
}

// 通用研发能力的兜底周期：迭代维度下无迭代可切，固定按最近 6 个月
export function genFallbackFilter() {
  return { dim: 'time', gran: 'month', versionId: 'all', periodId: 'm8', metricSlot: 0 }
}
export const GEN_TREND_PERIODS = MONTHS.slice(-6).map((m) => ({ id: m.id, label: m.label, kind: 'month', weeks: m.weeks }))

function scopeWeeks(filter) {
  if (filter.dim === 'iter' && filter.versionId !== 'all') {
    const v = VERSIONS.find((v) => v.id === filter.versionId)
    return v.iterations.flatMap((i) => i.weeks)
  }
  return WEEKS.map((w) => w.n)
}

function inScope(rec, filter, period) {
  if (!period) return scopeWeeks(filter).includes(rec.week)
  if (period.kind === 'iter') return rec.iterationId === period.id // 关键活动按迭代标签归属
  return period.weeks.includes(rec.week) // 周期视图由时间字段（完成周）聚合
}

export function currentPeriod(filter, periods) {
  const ps = periods || periodsFor(filter)
  return ps.find((p) => p.id === filter.periodId) || null // null = 全部周期（scope 内聚合）
}

export function sumsFor(teamId, activityId, metricId, filter, period) {
  const a = ACT_BY_ID[activityId]
  const src = a.kind === 'key' ? KEY_FACTS : GEN_FACTS
  let num = 0, den = 0, est = 0, act = 0
  for (const r of src) {
    if (r.teamId !== teamId || r.activityId !== activityId || r.metricId !== metricId) continue
    if (!inScope(r, filter, period)) continue
    num += r.num || 0
    den += r.den || 0
    est += r.est || 0
    act += r.act || 0
  }
  return { num, den, est, act }
}

// 指标值：渗透率/比率 = Σ分子/Σ分母；效率提升 = (Σ预估−Σ实际)/实际，实际=0 按 0.5 人天计；数量 = Σ
export function valueOf(activityId, metricId, teamId, filter, period) {
  const m = METRIC_BY_ID[`${activityId}/${metricId}`]
  if (!m) return null
  if (m.type === 'bool') {
    const f = BOOL_FACTS.find((b) => b.teamId === teamId)
    return f ? f.value : null
  }
  const s = sumsFor(teamId, activityId, metricId, filter, period)
  if (m.type === 'penetration' || m.type === 'ratio') return s.den > 0 ? s.num / s.den : null
  if (m.type === 'efficiency') {
    if (s.est === 0 && s.act === 0) return null
    const d = s.act > 0 ? s.act : 0.5
    return (s.est - s.act) / d
  }
  return s.num
}

// 全公司均值（各团队现算值再平均，跳过空值）
export function avgValue(activityId, metricId, filter, period) {
  const m = METRIC_BY_ID[`${activityId}/${metricId}`]
  if (!m) return null
  if (m.type === 'bool') return null
  const vs = TEAMS.map((t) => valueOf(activityId, metricId, t.id, filter, period)).filter((v) => typeof v === 'number')
  return vs.length ? vs.reduce((x, y) => x + y, 0) / vs.length : null
}

export function fmtValue(metric, v) {
  if (v === null || v === undefined) return '—'
  if (metric.type === 'penetration' || metric.type === 'ratio') return `${Math.round(v * 100)}%`
  if (metric.type === 'efficiency') return `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`
  if (metric.type === 'bool') return v ? '具备' : '不具备'
  return `${v}`
}

// 分子/分母原文（tooltip / 表格用）
export function factText(metric, s) {
  if (metric.type === 'efficiency') return `预估 Σ${s.est.toFixed(1)} 人天 · 实际 Σ${s.act.toFixed(1)} 人天`
  if (metric.type === 'count') return `${metric.numLabel} Σ${s.num}`
  return `${metric.numLabel} Σ${s.num} / ${metric.denLabel} Σ${s.den}`
}

export function sourceText(teamId, activityId, metricId) {
  const a = ACT_BY_ID[activityId]
  const src = a.kind === 'key' ? KEY_FACTS : GEN_FACTS
  const hit = src.find((r) => r.teamId === teamId && r.activityId === activityId && r.metricId === metricId)
  return hit && hit.source === 'manual' ? '手动补录' : '自动采集'
}

// 选中切片的人话描述
export function describeSlice(filter) {
  const ps = periodsFor(filter)
  const p = currentPeriod(filter, ps)
  const dim = filter.dim === 'iter' ? `按版本/迭代${filter.versionId !== 'all' ? ` · ${VERSIONS.find((v) => v.id === filter.versionId).name}` : ''}` : `按时间 · ${filter.gran === 'month' ? '月' : '周'}`
  return `${dim} · 周期：${p ? p.label : '全部'}`
}

export function activityMetric(a, slot) {
  return a.metrics[Math.min(slot ?? 0, a.metrics.length - 1)]
}

export { ACTIVITIES, TEAMS }

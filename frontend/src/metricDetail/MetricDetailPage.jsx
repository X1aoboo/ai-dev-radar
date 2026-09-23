import { useEffect, useMemo, useRef, useState } from 'react'

import FilterBar from '../overview/FilterBar'
import { TrendCard } from '../analytics/AnalyticsPages'
import { useComputedMetrics } from '../overview/metricData'
import {
  assignTeamColorSlots,
  INITIAL_FILTER,
  isGeneralIterationFallback,
  iterationPeriods,
  latestPeriodId,
  TEAM_COLOR_STORAGE_KEY,
} from '../overview/overviewLogic'
import { booleanStatusRows } from './metricDetailLogic'
import PageHeader from '../components/PageHeader'
import { currentSnapshot, formatFactSummary, formatMetricValue } from '../overview/overviewLogic'

function currentFilterDescription(filter, versions, periods, fallback) {
  const dimension = filter.dimension === 'iteration'
    ? `按版本/迭代${filter.versionId !== 'all' ? ` · ${versions.find((version) => String(version.id) === String(filter.versionId))?.name ?? ''}` : ''}`
    : `按时间 · ${filter.granularity === 'month' ? '月' : '周'}`
  const period = periods.find((item) => String(item.id) === String(filter.periodId))
  const periodLabel = filter.periodId === 'all' ? '全部周期' : period?.label ?? '最新'
  return `${dimension} · 周期：${periodLabel}${fallback ? ' · 通用研发能力固定按月趋势' : ''}`
}

function MetricNotFound({ onNavigate }) {
  return (
    <div className="overview-shell">
      <button type="button" className="drilldown-back-button" onClick={() => onNavigate('/')}>← 返回总览</button>
      <h1>指标不存在</h1>
      <p className="drilldown-muted">找不到请求的指标，可能已从指标目录中移除。</p>
    </div>
  )
}

function MetricDetailContent({
  activity,
  metric,
  teams,
  versions,
  onNavigate,
  onSessionExpired,
  filter: controlledFilter,
  onFilterChange,
}) {
  const [localFilter, setLocalFilter] = useState(INITIAL_FILTER)
  const filter = controlledFilter ?? localFilter
  const setFilter = onFilterChange ?? setLocalFilter
  const metricCatalog = useMemo(() => [{ ...activity, metrics: [metric] }], [activity, metric])
  const computed = useComputedMetrics(metricCatalog, filter, onSessionExpired)
  const data = computed.data[metric.id]
  const fallback = isGeneralIterationFallback(activity, filter)
  const timePeriods = data?.periods ?? []
  const iterationPeriodOptions = useMemo(
    () => iterationPeriods(versions, filter.versionId),
    [versions, filter.versionId],
  )
  const periods = filter.dimension === 'iteration' ? iterationPeriodOptions : timePeriods

  useEffect(() => {
    if (!periods.length) return
    const ids = new Set(periods.map((period) => String(period.id)))
    setFilter((current) => {
      if (current.periodId === null || (
        current.periodId !== 'all' && !ids.has(String(current.periodId))
      )) {
        return { ...current, periodId: latestPeriodId(periods) }
      }
      return current
    })
  }, [periods, filter.periodId])

  const teamIdsKey = teams.map((team) => team.id).join(',')
  const colorSlotsRef = useRef(null)
  if (colorSlotsRef.current === null) {
    try {
      const stored = JSON.parse(window.localStorage.getItem(TEAM_COLOR_STORAGE_KEY) ?? '{}')
      colorSlotsRef.current = stored && typeof stored === 'object' ? stored : {}
    } catch {
      colorSlotsRef.current = {}
    }
  }
  const teamColors = useMemo(() => {
    const assigned = assignTeamColorSlots(teams.map((team) => team.id), colorSlotsRef.current)
    colorSlotsRef.current = assigned.slots
    return assigned.colors
  }, [teamIdsKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(TEAM_COLOR_STORAGE_KEY, JSON.stringify(colorSlotsRef.current))
    } catch {
      // 浏览器禁用本地存储时，当前页面内的 ref 仍能保持颜色稳定。
    }
  }, [teamIdsKey])

  const booleanRows = useMemo(
    () => metric.type === 'boolean' ? booleanStatusRows(data, teams, filter.periodId) : undefined,
    [data, filter.periodId, metric.type, teams],
  )
  const snapshot = currentSnapshot(data, filter.periodId)
  const evidenceRows = snapshot?.teams ?? []
  const currentValue = snapshot?.company?.value
  return (
    <div className="metric-detail-page analytics-page">
      <button type="button" className="drilldown-back-button" onClick={() => onNavigate('/')}>← 返回总览</button>
      <PageHeader eyebrow="Metric detail" title={`指标详情 · ${metric.name}`} description={`所属活动：${activity.name} · ${activity.kind === 'key' ? '关键研发活动' : '通用研发能力'}`} />

      <FilterBar
        filter={filter}
        onChange={setFilter}
        versions={versions}
        periods={timePeriods}
        loading={computed.loading}
      />

      <section className="metric-detail-section">
        <header><p className="analytics-eyebrow">Result</p><h2>当前结果</h2><p>{currentFilterDescription(filter, versions, periods, fallback)}</p></header>
        <div className="metric-detail-result"><span>全公司均值</span><strong>{computed.loading ? '—' : formatMetricValue(metric, currentValue)}</strong><small>{snapshot ? `${snapshot.teams.filter((team) => team.point?.value !== null && team.point?.value !== undefined).length} / ${teams.length} 团队有当前事实` : '当前切片暂无可汇总的事实。'}</small></div>
      </section>

      <section className="metric-detail-section">
        <header><p className="analytics-eyebrow">Comparison</p><h2>团队比较与趋势</h2><p>团队系列与全公司均值仅在同一指标内比较。</p></header>
        <TrendCard activity={activity} metric={metric} data={data} error={computed.errors[metric.id]} loading={computed.loading} teams={teams} teamColors={teamColors} periodId={filter.periodId} fallback={fallback} onNavigate={onNavigate} showMetricPills={false} showMetricDetailLink={false} booleanTable={metric.type === 'boolean'} booleanRows={booleanRows} countAsBars />
      </section>

      <section className="metric-detail-section">
        <header><p className="analytics-eyebrow">Evidence</p><h2>当前周期原始事实</h2><p>按需展开；没有事实时不把分子或分母补为零。</p></header>
        <details className="metric-detail-evidence"><summary>查看团队原始事实</summary>{evidenceRows.length ? <div className="analytics-detail-table-wrap"><table className="analytics-detail-table"><thead><tr><th scope="col">团队</th><th scope="col">当前值</th><th scope="col">原始事实</th></tr></thead><tbody>{evidenceRows.map((team) => <tr key={team.team_id}><th scope="row">{team.team_name}</th><td>{formatMetricValue(metric, team.point?.value)}</td><td>{team.point ? formatFactSummary(metric, team.point) : '暂无事实数据'}</td></tr>)}</tbody></table></div> : <p className="analytics-muted">当前筛选切片暂无可展示的原始事实。</p>}</details>
      </section>
    </div>
  )
}

export default function MetricDetailPage(props) {
  if (!props.activity || !props.metric) return <MetricNotFound onNavigate={props.onNavigate} />
  return <MetricDetailContent {...props} />
}

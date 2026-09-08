import { useEffect, useMemo, useRef, useState } from 'react'

import FilterBar from '../overview/FilterBar'
import { TrendCard } from '../overview/OverviewPage'
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
    <main className="overview-shell">
      <button type="button" className="drilldown-back-button" onClick={() => onNavigate('/')}>← 返回总览</button>
      <h1>指标不存在</h1>
      <p className="drilldown-muted">找不到请求的指标，可能已从指标目录中移除。</p>
    </main>
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
    () => metric.type === 'boolean' ? booleanStatusRows(data, teams) : undefined,
    [data, metric.type, teams],
  )
  return (
    <main className="overview-shell">
      <div className="overview-page-head">
        <div>
          <button type="button" className="drilldown-back-button" onClick={() => onNavigate('/')}>← 返回总览</button>
          <p className="overview-eyebrow">研发效能 · 跨团队指标对比</p>
          <h1>指标详情 · {metric.name}</h1>
          <p className="overview-metric-name">所属活动：{activity.name} · {activity.kind === 'key' ? '关键研发活动' : '通用研发能力'}</p>
        </div>
        <p className="overview-slice-description">
          当前切片：{currentFilterDescription(filter, versions, periods, fallback)}
        </p>
      </div>

      <FilterBar
        filter={filter}
        onChange={setFilter}
        versions={versions}
        periods={timePeriods}
        loading={computed.loading}
        showMetricSlot={false}
      />

      <TrendCard
        activity={activity}
        metric={metric}
        data={data}
        error={computed.errors[metric.id]}
        loading={computed.loading}
        teams={teams}
        teamColors={teamColors}
        periodId={filter.periodId}
        fallback={fallback}
        onNavigate={onNavigate}
        showMetricPills={false}
        showMetricDetailLink={false}
        booleanTable={metric.type === 'boolean'}
        booleanRows={booleanRows}
        countAsBars
      />
    </main>
  )
}

export default function MetricDetailPage(props) {
  if (!props.activity || !props.metric) return <MetricNotFound onNavigate={props.onNavigate} />
  return <MetricDetailContent {...props} />
}

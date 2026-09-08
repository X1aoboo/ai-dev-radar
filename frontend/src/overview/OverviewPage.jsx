import { useEffect, useMemo, useRef, useState } from 'react'

import EChart from '../components/EChart'
import FilterBar from './FilterBar'
import { buildTrendOption } from './chartOption'
import { hasNumericValues, useComputedMetrics } from './metricData'
import {
  assignTeamColorSlots,
  currentSnapshot,
  formatMetricValue,
  INITIAL_FILTER,
  isGeneralIterationFallback,
  iterationPeriods,
  latestPeriodId,
} from './overviewLogic'
import './overview.css'

const TEAM_COLOR_STORAGE_KEY = 'ai-dev-radar.team-color-slots'
function ErrorState({ error }) {
  return (
    <div className="overview-empty overview-error" role="alert">
      指标数据加载失败：{error?.message ?? '未知错误'}
    </div>
  )
}

function EmptyState({ children = '当前筛选切片暂无数据。' }) {
  return <div className="overview-empty">{children}</div>
}

function CurrentSlice({ data, metric, periodId }) {
  const snapshot = currentSnapshot(data, periodId)
  if (!snapshot) return null

  const period = data.periods?.find((item) => String(item.id) === String(periodId))
  return (
    <div className="overview-slice" aria-label={`当前周期 ${period?.label ?? periodId}`}>
      <div className="overview-slice-heading">当前周期：{period?.label ?? periodId}</div>
      <div className="overview-slice-values">
        {snapshot.teams.map((team) => (
          <span key={team.team_id} className="overview-slice-value">
            <span>{team.team_name}</span>
            <strong>{formatMetricValue(metric, team.point?.value)}</strong>
          </span>
        ))}
        <span className="overview-slice-value overview-company-value">
          <span>全公司均值</span>
          <strong>{formatMetricValue(metric, snapshot.company?.value)}</strong>
        </span>
      </div>
    </div>
  )
}

function BooleanCard({ activity, metric, data, teams, fallback }) {
  const valuesByTeam = new Map((data?.series ?? []).map((series) => [series.team_id, series.snapshot]))
  const hasValue = teams.some((team) => valuesByTeam.get(team.id) !== null && valuesByTeam.get(team.id) !== undefined)

  if (!hasValue) return <EmptyState>当前筛选切片暂无布尔状态数据。</EmptyState>

  return (
    <div className="overview-boolean-list">
      {teams.map((team) => {
        const value = valuesByTeam.get(team.id)
        const state = value === null || value === undefined ? 'unknown' : value ? 'yes' : 'no'
        return (
          <span key={team.id} className={`overview-boolean-value is-${state}`}>
            <span>{team.name}</span>
            <strong>{state === 'unknown' ? '暂无数据' : value ? '✓ 具备' : '✗ 不具备'}</strong>
          </span>
        )
      })}
      <p className="overview-card-note">布尔指标按最新事实展示，不绘制趋势。</p>
      {fallback && <p className="overview-card-note">通用研发能力无迭代维度，固定按月展示。</p>}
    </div>
  )
}

function TrendCard({
  activity,
  metric,
  data,
  error,
  loading,
  teams,
  teamColors,
  periodId,
  fallback,
  onMetricSlotChange,
  onNavigate,
}) {
  const selectedPeriodId = fallback ? 'all' : (periodId ?? 'all')
  const option = useMemo(() => (
    data && metric.type !== 'boolean'
      ? buildTrendOption({ data, metric, teamColors, selectedPeriodId })
      : null
  ), [data, metric, teamColors, selectedPeriodId])

  function handleChartClick(params) {
    if (!params?.seriesName || params.seriesName === '全公司均值') return
    const team = teams.find((item) => item.name === params.seriesName)
    if (team) onNavigate(`/team/${team.id}`)
  }

  const isSelectedMetric = activity.metrics.indexOf(metric)
  return (
    <article className="overview-card">
      <header className="overview-card-header">
        <div className="overview-card-title-row">
          <h3>{activity.name}</h3>
          <span className="overview-kind">{activity.kind === 'key' ? '关键' : '通用'}</span>
        </div>
        <div className="overview-metric-pills" role="group" aria-label={`${activity.name} 展示指标`}>
          {activity.metrics.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={index === isSelectedMetric ? 'is-active' : ''}
              aria-pressed={index === isSelectedMetric}
              onClick={() => onMetricSlotChange(index)}
            >
              {item.name}
            </button>
          ))}
        </div>
      </header>

      <p className="overview-metric-name">{metric.name}</p>
      {loading && <div className="overview-empty">正在更新指标数据…</div>}
      {!loading && error && <ErrorState error={error} />}
      {!loading && !error && metric.type === 'boolean' && (
        <BooleanCard activity={activity} metric={metric} data={data} teams={teams} fallback={fallback} />
      )}
      {!loading && !error && metric.type !== 'boolean' && !hasNumericValues(data) && <EmptyState />}
      {!loading && !error && metric.type !== 'boolean' && hasNumericValues(data) && (
        <>
          <EChart
            option={option}
            height={252}
            ariaLabel={`${activity.name} ${metric.name} 团队趋势图`}
            onClick={handleChartClick}
          />
          <CurrentSlice data={data} metric={metric} periodId={selectedPeriodId} />
        </>
      )}
      {fallback && metric.type !== 'boolean' && <p className="overview-card-note">通用研发能力无迭代维度 · 固定近 6 个月月趋势</p>}
    </article>
  )
}

function ActivitySection({
  title,
  activities,
  metricSlots,
  ...props
}) {
  return (
    <section className="overview-section">
      <h2 className="overview-section-title">
        {title}
        {props.showFallbackBadge && <span className="overview-badge">无迭代维度 · 固定近 6 个月月趋势</span>}
      </h2>
      <div className="overview-card-grid">
        {activities.map((activity) => {
          if (activity.metrics.length === 0) {
            return (
              <article key={activity.id} className="overview-card">
                <header className="overview-card-header">
                  <div className="overview-card-title-row">
                    <h3>{activity.name}</h3>
                    <span className="overview-kind">{activity.kind === 'key' ? '关键' : '通用'}</span>
                  </div>
                </header>
                <EmptyState>该活动尚未配置指标。</EmptyState>
              </article>
            )
          }
          const requestedMetricSlot = metricSlots[activity.id] ?? props.metricSlot
          const metricIndex = Math.min(Math.max(0, requestedMetricSlot), activity.metrics.length - 1)
          const metric = activity.metrics[metricIndex]
          const fallback = isGeneralIterationFallback(activity, props.filter)
          return (
            <TrendCard
              key={activity.id}
              activity={activity}
              metric={metric}
              data={props.computedData[metric.id]}
              error={props.computeErrors[metric.id]}
              loading={props.loading}
              teams={props.teams}
              teamColors={props.teamColors}
              periodId={props.filter.periodId}
              fallback={fallback}
              onMetricSlotChange={(metricSlot) => props.onMetricSlotChange(activity.id, metricSlot)}
              onNavigate={props.onNavigate}
            />
          )
        })}
      </div>
    </section>
  )
}

export default function OverviewPage({
  catalog,
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
  const [metricSlots, setMetricSlots] = useState({})
  const computed = useComputedMetrics(catalog, filter, onSessionExpired)
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

  const timePeriods = useMemo(() => {
    for (const activity of catalog) {
      for (const metric of activity.metrics) {
        const periods = computed.data[metric.id]?.periods
        if (periods?.length) return periods
      }
    }
    return []
  }, [catalog, computed.data])
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

  const keyActivities = catalog.filter((activity) => activity.kind === 'key')
  const generalActivities = catalog.filter((activity) => activity.kind === 'general')
  const describeDimension = filter.dimension === 'iteration'
    ? `按版本/迭代${filter.versionId !== 'all' ? ` · ${versions.find((version) => String(version.id) === String(filter.versionId))?.name ?? ''}` : ''}`
    : `按时间 · ${filter.granularity === 'month' ? '月' : '周'}`
  const selectedPeriod = periods.find((period) => String(period.id) === String(filter.periodId))

  function handleFilterChange(nextFilter) {
    if (nextFilter.metricSlot !== filter.metricSlot) {
      setMetricSlots(Object.fromEntries(
        catalog.map((activity) => [
          activity.id,
          Math.min(nextFilter.metricSlot, Math.max(0, activity.metrics.length - 1)),
        ]),
      ))
    }
    setFilter(nextFilter)
  }

  function changeActivityMetric(activityId, metricSlot) {
    setMetricSlots((current) => ({ ...current, [activityId]: metricSlot }))
  }

  return (
    <main className="overview-shell">
      <div className="overview-page-head">
        <div>
          <p className="overview-eyebrow">研发效能 · 团队横向对比</p>
          <h1>总览 · 团队 × 活动</h1>
        </div>
        <p className="overview-slice-description">
          当前切片：{describeDimension} · 周期：{filter.periodId === 'all' ? '全部周期' : selectedPeriod?.label ?? '最新'}
        </p>
      </div>

      <FilterBar
        filter={filter}
        onChange={handleFilterChange}
        versions={versions}
        periods={timePeriods}
        loading={computed.loading}
      />

      <ActivitySection
        title="关键研发活动"
        activities={keyActivities}
        metricSlots={metricSlots}
        filter={filter}
        metricSlot={filter.metricSlot}
        computedData={computed.data}
        computeErrors={computed.errors}
        loading={computed.loading}
        teams={teams}
        teamColors={teamColors}
        onMetricSlotChange={changeActivityMetric}
        onNavigate={onNavigate}
      />
      <ActivitySection
        title="通用研发能力"
        activities={generalActivities}
        metricSlots={metricSlots}
        filter={filter}
        metricSlot={filter.metricSlot}
        computedData={computed.data}
        computeErrors={computed.errors}
        loading={computed.loading}
        teams={teams}
        teamColors={teamColors}
        showFallbackBadge={filter.dimension === 'iteration'}
        onMetricSlotChange={changeActivityMetric}
        onNavigate={onNavigate}
      />
    </main>
  )
}

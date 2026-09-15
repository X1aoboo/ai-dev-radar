import { useEffect, useMemo, useRef, useState } from 'react'

import { fetchJson } from '../api'
import EChart from '../components/EChart'
import FilterBar from '../overview/FilterBar'
import { hasNumericValues, useComputedMetrics } from '../overview/metricData'
import {
  formatMetricValue,
  DATAVIZ_COLORS,
  INITIAL_FILTER,
  isGeneralIterationFallback,
  iterationPeriods,
  latestPeriodId,
} from '../overview/overviewLogic'
import { buildIterationCompareOption, buildTeamTrendOption } from './chartOption'
import {
  averageMetricValues,
  deltaForSelection,
  mergePeriods,
  pointForSelection,
  previousPeriodId,
  sourceForPeriod,
  teamAccentColor,
  valueForSelection,
} from './drilldownLogic'
import './drilldown.css'

const TEAM_COLOR_STORAGE_KEY = 'ai-dev-radar.team-color-slots'
const TEAM_ACCENT_FALLBACK = DATAVIZ_COLORS.team[0]

function useTeamFacts(teamId, onSessionExpired) {
  const [state, setState] = useState({ loading: Boolean(teamId), facts: [], error: null })
  const sessionExpiredRef = useRef(onSessionExpired)
  sessionExpiredRef.current = onSessionExpired

  useEffect(() => {
    if (!teamId) {
      setState({ loading: false, facts: [], error: null })
      return undefined
    }

    const controller = new AbortController()
    let active = true
    setState({ loading: true, facts: [], error: null })
    fetchJson(`/api/facts?team_id=${encodeURIComponent(teamId)}&limit=50000`, { signal: controller.signal })
      .then((facts) => {
        if (active) setState({ loading: false, facts, error: null })
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return
        setState({ loading: false, facts: [], error })
        if (error.status === 401) sessionExpiredRef.current()
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [teamId])

  return state
}

function metricEntries(catalog, dataByMetric) {
  return catalog.flatMap((activity) => activity.metrics.map((metric) => ({
    activity,
    metric,
    data: dataByMetric[metric.id],
  })))
}

function metricEntry(entries, predicate) {
  return entries.find(({ metric, activity }) => predicate(metric, activity))
}

function averageKpi(entries, predicate, teamId, periodId) {
  const selectedEntries = entries.filter(({ metric }) => predicate(metric))
  const representative = selectedEntries.find(({ data }) => data?.periods?.length)
  const data = representative?.data
  const value = averageMetricValues(selectedEntries, predicate, teamId, periodId)
  const previousId = previousPeriodId(data, periodId)
  const previous = previousId === null
    ? null
    : averageMetricValues(selectedEntries, predicate, teamId, previousId)
  const spark = (data?.periods ?? []).slice(-12)
    .map((period) => averageMetricValues(selectedEntries, predicate, teamId, period.id))

  return { value, delta: value !== null && previous !== null ? value - previous : null, spark }
}

function singleMetricKpi(entry, teamId, periodId) {
  if (!entry) return { value: null, delta: null, spark: [] }
  const value = valueForSelection(entry.data, entry.metric, teamId, periodId)
  const delta = deltaForSelection(entry.data, entry.metric, teamId, periodId)
  const spark = (entry.data?.periods ?? []).slice(-12)
    .map((period) => valueForSelection(entry.data, entry.metric, teamId, period.id))
  return { value, delta, spark }
}

function Sparkline({ values = [] }) {
  const points = values
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => typeof value === 'number' && Number.isFinite(value))
  const width = 76
  const height = 22
  if (points.length < 2) return <span className="drilldown-sparkline-placeholder" aria-hidden="true" />

  const valuesOnly = points.map(({ value }) => value)
  const min = Math.min(...valuesOnly)
  const max = Math.max(...valuesOnly)
  const x = ({ index }) => (index / Math.max(1, values.length - 1)) * (width - 6) + 3
  const y = (value) => max > min
    ? height - 3 - ((value - min) / (max - min)) * (height - 6)
    : height / 2
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${x(point).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]

  return (
    <svg className="drilldown-sparkline" width={width} height={height} aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(last)} cy={y(last.value)} r="2.7" fill="var(--drilldown-accent)" stroke="var(--overview-surface)" strokeWidth="1.5" />
    </svg>
  )
}

function KpiTile({ label, metric, value, delta, spark, loading, status }) {
  const isStatusTile = status !== undefined && status !== null
  const isNegativeEfficiency = metric.type === 'efficiency' && typeof value === 'number' && value < 0
  const formattedValue = status === true ? '具备' : status === false ? '不具备' : formatMetricValue(metric, value)
  const deltaClass = delta === null || delta === undefined ? '' : delta >= 0 ? 'is-positive' : 'is-negative'

  return (
    <article className="drilldown-kpi-tile">
      <div className="drilldown-kpi-label">{label}</div>
      <div className={`drilldown-kpi-value ${isNegativeEfficiency ? 'is-negative' : ''}`}>
        {loading ? '…' : formattedValue}
      </div>
      <div className="drilldown-kpi-footer">
        {isStatusTile ? (
          <span className={`drilldown-kpi-status ${status === true ? 'is-positive' : status === false ? 'is-negative' : ''}`}>最新状态</span>
        ) : delta !== null && delta !== undefined ? (
          <span className={`drilldown-kpi-delta ${deltaClass}`}>
            环比 {delta >= 0 ? '+' : ''}{Math.round(delta * 100)}%
          </span>
        ) : (
          <span className="drilldown-kpi-delta">暂无环比</span>
        )}
        {!isStatusTile && <Sparkline values={spark} />}
      </div>
    </article>
  )
}

function ActivityDirectory({ groups }) {
  function scrollToActivity(activityId) {
    document.getElementById(`activity-${activityId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <aside className="drilldown-directory" aria-label="活动目录">
      {groups.map((group) => (
        <section key={group.title}>
          <h2>{group.title}</h2>
          {group.activities.map((activity) => (
            <button key={activity.id} type="button" onClick={() => scrollToActivity(activity.id)}>
              <span>{activity.name}</span>
              {activity.metrics.length > 1 && <small>{activity.metrics.length}指标</small>}
            </button>
          ))}
        </section>
      ))}
    </aside>
  )
}

function ErrorMessage({ error }) {
  return <div className="drilldown-empty drilldown-error" role="alert">数据加载失败：{error?.message ?? '未知错误'}</div>
}

function IterationCompare({ data, metric, teamId, accent, loading, error }) {
  if (loading) return <div className="drilldown-detail-loading">正在加载迭代对比…</div>
  if (error) return <ErrorMessage error={error} />
  if (!hasNumericValues(data)) return <div className="drilldown-detail-empty">当前指标暂无迭代事实数据。</div>

  return (
    <section className="drilldown-detail-section">
      <h4>迭代分片对比 · {metric.name}</h4>
      <EChart
        option={buildIterationCompareOption({ data, metric, teamId, accent })}
        height={220}
        ariaLabel={`${metric.name} 迭代分片对比`}
      />
    </section>
  )
}

function formatRaw(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)
}

function factTableColumns(metric) {
  if (metric.type === 'efficiency') {
    return [
      { key: 'estimated', label: '预估人天' },
      { key: 'actual', label: '实际人天' },
      { key: 'value', label: '值' },
      { key: 'source', label: '来源' },
    ]
  }
  if (metric.type === 'count') {
    return [
      { key: 'numerator', label: metric.numerator_semantic || '分子' },
      { key: 'value', label: '值' },
      { key: 'source', label: '来源' },
    ]
  }
  return [
    { key: 'numerator', label: metric.numerator_semantic || '分子' },
    { key: 'denominator', label: metric.denominator_semantic || '分母' },
    { key: 'value', label: '值' },
    { key: 'source', label: '来源' },
  ]
}

function factTableCell(metric, column, point, source) {
  if (column.key === 'estimated') return formatRaw(point?.estimated ?? point?.numerator)
  if (column.key === 'actual') return formatRaw(point?.actual ?? point?.denominator)
  if (column.key === 'numerator') return formatRaw(point?.numerator)
  if (column.key === 'denominator') return formatRaw(point?.denominator)
  if (column.key === 'value') return formatMetricValue(metric, point?.value)
  return <span className={`drilldown-source ${source ? `is-${source}` : ''}`}>{source ?? '—'}</span>
}

function FactTable({ activity, trendData, facts, factsLoading, factsError, teamId }) {
  const metrics = activity.metrics.filter((metric) => metric.type !== 'boolean')
  const periods = mergePeriods(metrics.map((metric) => trendData[metric.id]))

  if (factsLoading) return <div className="drilldown-detail-loading">正在加载事实记录…</div>
  if (factsError) return <ErrorMessage error={factsError} />
  if (!metrics.length || !periods.length) return <div className="drilldown-detail-empty">当前活动暂无可展示的事实记录。</div>

  return (
    <section className="drilldown-detail-section">
      <h4>事实记录（分子 / 分母原始数）</h4>
      <div className="drilldown-table-wrap">
        <table className="drilldown-fact-table">
          <thead>
            <tr>
              <th rowSpan="2">周期</th>
              {metrics.map((metric) => (
                <th key={metric.id} colSpan={factTableColumns(metric).length}>{metric.name}</th>
              ))}
            </tr>
            <tr>
              {metrics.flatMap((metric) => factTableColumns(metric).map((column) => (
                <th key={`${metric.id}-${column.key}`}>{column.label}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period.id}>
                <th scope="row">{period.label}</th>
                {metrics.flatMap((metric) => {
                  const point = pointForSelection(trendData[metric.id], teamId, period.id)
                  const source = sourceForPeriod(facts, metric.id, period)
                  return factTableColumns(metric).map((column) => (
                    <td key={`${period.id}-${metric.id}-${column.key}`}>
                      {factTableCell(metric, column, point, source)}
                    </td>
                  ))
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ActivityTrendCard({
  activity,
  filter,
  teamId,
  accent,
  trendData,
  trendErrors,
  trendLoading,
  iterationData,
  iterationErrors,
  iterationLoading,
  facts,
  factsLoading,
  factsError,
}) {
  const [metricSlot, setMetricSlot] = useState(0)
  const [showDetail, setShowDetail] = useState(false)
  const metric = activity.metrics[Math.min(metricSlot, Math.max(0, activity.metrics.length - 1))]
  const data = metric ? trendData[metric.id] : undefined
  const error = metric ? trendErrors[metric.id] : undefined
  const fallback = isGeneralIterationFallback(activity, filter)
  const selectedPeriodId = fallback ? latestPeriodId(data?.periods) : (filter.periodId ?? 'all')
  const option = useMemo(() => (
    data && metric.type !== 'boolean'
      ? buildTeamTrendOption({ data, metric, teamId, selectedPeriodId, accent })
      : null
  ), [accent, data, metric, selectedPeriodId, teamId])
  const currentValue = data ? valueForSelection(data, metric, teamId, selectedPeriodId) : null
  const currentPeriod = data?.periods?.find((period) => String(period.id) === String(selectedPeriodId))

  useEffect(() => {
    setMetricSlot((current) => Math.min(current, Math.max(0, activity.metrics.length - 1)))
  }, [activity.metrics.length])

  if (!metric) {
    return <article id={`activity-${activity.id}`} className="drilldown-activity-card"><div className="drilldown-empty">该活动尚未配置指标。</div></article>
  }

  return (
    <article id={`activity-${activity.id}`} className="drilldown-activity-card">
      <header className="drilldown-activity-header">
        <div className="drilldown-activity-title">
          <h3>{activity.name}</h3>
          <span>{activity.kind === 'key' ? '关键' : '通用'}</span>
        </div>
        <div className="drilldown-card-actions">
          {activity.metrics.length > 1 && (
            <div className="drilldown-metric-pills" role="group" aria-label={`${activity.name} 展示指标`}>
              {activity.metrics.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={index === metricSlot ? 'is-active' : ''}
                  aria-pressed={index === metricSlot}
                  onClick={() => setMetricSlot(index)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
          {metric.type !== 'boolean' && (
            <button
              type="button"
              className={`drilldown-detail-button ${showDetail ? 'is-active' : ''}`}
              aria-expanded={showDetail}
              onClick={() => setShowDetail((current) => !current)}
            >
              {showDetail ? '收起详细数据' : '详细数据'}
            </button>
          )}
        </div>
      </header>

      <p className="drilldown-metric-name">{metric.name}</p>
      {trendLoading && <div className="drilldown-empty">正在更新指标数据…</div>}
      {!trendLoading && error && <ErrorMessage error={error} />}
      {!trendLoading && !error && metric.type === 'boolean' && (
        (() => {
          const value = data?.series?.find((series) => String(series.team_id) === String(teamId))?.snapshot
          return (
            <div className={`drilldown-boolean-status ${value === false ? 'is-negative' : ''}`}>
              {value === true
                ? '✓ 已具备自动化构建部署能力'
                : value === false ? '✗ 尚不具备自动化构建部署能力' : '暂无自动化构建部署状态'}
            </div>
          )
        })()
      )}
      {!trendLoading && !error && metric.type !== 'boolean' && !hasNumericValues(data) && (
        <div className="drilldown-empty">当前筛选切片暂无数据。</div>
      )}
      {!trendLoading && !error && metric.type !== 'boolean' && hasNumericValues(data) && (
        <>
          <EChart
            option={option}
            height={220}
            ariaLabel={`${activity.name} ${metric.name} 团队趋势图`}
          />
          <p className="drilldown-fact-note">
            {selectedPeriodId === 'all' ? '全部周期' : `周期 ${currentPeriod?.label ?? selectedPeriodId}`}：{formatMetricValue(metric, currentValue)}
            {filter.dimension === 'iteration' && activity.kind === 'key'
              ? ' · 按迭代标签聚合'
              : ' · 按时间字段聚合'}
            {fallback && ' · 通用研发能力无迭代维度，固定按月'}
          </p>
        </>
      )}

      {showDetail && metric.type !== 'boolean' && (
        <div className="drilldown-details">
          {activity.kind === 'key' && (
            <IterationCompare
              data={iterationData[metric.id]}
              metric={metric}
              teamId={teamId}
              accent={accent}
              loading={iterationLoading}
              error={iterationErrors[metric.id]}
            />
          )}
          <FactTable
            activity={activity}
            trendData={trendData}
            facts={facts}
            factsLoading={factsLoading}
            factsError={factsError}
            teamId={teamId}
          />
        </div>
      )}
    </article>
  )
}

function currentFilterDescription(filter, versions, periods) {
  const dimension = filter.dimension === 'iteration'
    ? `按版本/迭代${filter.versionId !== 'all' ? ` · ${versions.find((version) => String(version.id) === String(filter.versionId))?.name ?? ''}` : ''}`
    : `按时间 · ${filter.granularity === 'month' ? '月' : '周'}`
  const period = periods.find((item) => String(item.id) === String(filter.periodId))
  return `${dimension} · 周期：${filter.periodId === 'all' ? '全部周期' : period?.label ?? '最新'}`
}

function teamAccent(teamId, teamIds = [teamId]) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(TEAM_COLOR_STORAGE_KEY) ?? '{}')
    return teamAccentColor(teamId, teamIds, stored) ?? TEAM_ACCENT_FALLBACK
  } catch {
    return TEAM_ACCENT_FALLBACK
  }
}

function TeamDrilldownContent({
  catalog,
  versions,
  team,
  teams = [],
  onNavigate,
  onSessionExpired,
  filter: controlledFilter,
  onFilterChange,
}) {
  const [localFilter, setLocalFilter] = useState(INITIAL_FILTER)
  const filter = controlledFilter ?? localFilter
  const setFilter = onFilterChange ?? setLocalFilter
  const keyActivities = useMemo(() => catalog.filter((activity) => activity.kind === 'key'), [catalog])
  const generalActivities = useMemo(() => catalog.filter((activity) => activity.kind === 'general'), [catalog])
  const computed = useComputedMetrics(catalog, filter, onSessionExpired)
  const iterationFilter = useMemo(() => ({ ...filter, dimension: 'iteration', granularity: 'month' }), [filter.versionId])
  const iterationComputed = useComputedMetrics(keyActivities, iterationFilter, onSessionExpired)
  const factsState = useTeamFacts(team.id, onSessionExpired)
  const teamIdsKey = teams.map((item) => item.id).join(',')
  const accent = useMemo(
    () => teamAccent(team.id, teams.map((item) => item.id)),
    [team.id, teamIdsKey],
  )
  const entries = useMemo(() => metricEntries(catalog, computed.data), [catalog, computed.data])
  const keyEntries = entries.filter(({ activity }) => activity.kind === 'key')
  const reviewEntry = metricEntry(entries, (metric, activity) => (
    metric.code === 'mrr-rate' || (activity.name === 'MR代码检视' && ['penetration', 'ratio'].includes(metric.type))
  ))
  const booleanEntry = metricEntry(entries, (metric) => metric.type === 'boolean')

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
      if (current.periodId === null || (current.periodId !== 'all' && !ids.has(String(current.periodId)))) {
        return { ...current, periodId: latestPeriodId(periods) }
      }
      return current
    })
  }, [periods, filter.periodId])

  const keyPeriodId = filter.periodId ?? latestPeriodId(keyEntries.find(({ data }) => data?.periods?.length)?.data?.periods)
  const generalPeriodId = filter.dimension === 'iteration'
    ? latestPeriodId(reviewEntry?.data?.periods)
    : (filter.periodId ?? latestPeriodId(reviewEntry?.data?.periods))
  const penetrationKpi = averageKpi(
    keyEntries,
    (metric) => metric.type === 'penetration' || metric.type === 'ratio',
    team.id,
    keyPeriodId,
  )
  const efficiencyKpi = averageKpi(keyEntries, (metric) => metric.type === 'efficiency', team.id, keyPeriodId)
  const reviewKpi = singleMetricKpi(reviewEntry, team.id, generalPeriodId)
  const booleanValue = booleanEntry
    ? valueForSelection(booleanEntry.data, booleanEntry.metric, team.id, generalPeriodId)
    : null
  const groups = [
    { title: '关键研发活动', activities: keyActivities },
    { title: '通用研发能力', activities: generalActivities },
  ]

  return (
    <div
      className="overview-shell drilldown-shell"
      style={{ '--drilldown-accent': accent }}
    >
      <div className="overview-page-head drilldown-page-head">
        <div>
          <button type="button" className="drilldown-back-button" onClick={() => onNavigate('/')}>
            ← 返回总览
          </button>
          <p className="overview-eyebrow">研发效能 · 团队下钻</p>
          <h1>{team.name} · 团队下钻</h1>
        </div>
        <p className="overview-slice-description">当前切片：{currentFilterDescription(filter, versions, periods)}</p>
      </div>

      <FilterBar
        filter={filter}
        onChange={setFilter}
        versions={versions}
        periods={timePeriods}
        loading={computed.loading}
      />

      <div className="drilldown-kpi-row">
        <KpiTile
          label="平均渗透率（关键活动）"
          metric={{ type: 'penetration' }}
          {...penetrationKpi}
          loading={computed.loading}
        />
        <KpiTile
          label="平均效率提升（关键活动）"
          metric={{ type: 'efficiency' }}
          {...efficiencyKpi}
          loading={computed.loading}
        />
        <KpiTile
          label="AI检视率"
          metric={{ type: 'ratio' }}
          {...reviewKpi}
          loading={computed.loading}
        />
        <KpiTile
          label="自动化构建部署"
          metric={{ type: 'boolean' }}
          value={booleanValue}
          status={booleanValue ?? 'unknown'}
          loading={computed.loading}
        />
      </div>

      <div className="drilldown-layout">
        <ActivityDirectory groups={groups} />
        <div className="drilldown-main">
          {groups.map((group) => (
            <section key={group.title} className="drilldown-activity-group">
              <h2 className="drilldown-section-title">
                {group.title}
                {group.activities === generalActivities && filter.dimension === 'iteration' && (
                  <span className="overview-badge">无迭代维度 · 固定近 6 个月月趋势</span>
                )}
              </h2>
              <div className="drilldown-activity-list">
                {group.activities.map((activity) => (
                  <ActivityTrendCard
                    key={activity.id}
                    activity={activity}
                    filter={filter}
                    teamId={team.id}
                    accent={accent}
                    trendData={computed.data}
                    trendErrors={computed.errors}
                    trendLoading={computed.loading}
                    iterationData={iterationComputed.data}
                    iterationErrors={iterationComputed.errors}
                    iterationLoading={iterationComputed.loading}
                    facts={factsState.facts}
                    factsLoading={factsState.loading}
                    factsError={factsState.error}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function TeamDrilldownPage({ team, ...props }) {
  if (!team) {
    return (
      <div className="overview-shell drilldown-shell">
        <button type="button" className="drilldown-back-button" onClick={() => props.onNavigate('/')}>
          ← 返回总览
        </button>
        <h1>团队不存在</h1>
        <p className="drilldown-muted">找不到请求的团队。</p>
      </div>
    )
  }

  return <TeamDrilldownContent team={team} {...props} />
}

import { useEffect, useMemo, useRef, useState } from 'react'

import { fetchJson } from '../api'
import useActiveSection from '../components/useActiveSection'
import EChart from '../components/EChart'
import { AnalyticsSection, MaturityMatrix } from '../components/AnalyticsComponents'
import MetricKpiCard from '../components/MetricCard'
import PageHeader from '../components/PageHeader'
import FilterBar from '../overview/FilterBar'
import { hasNumericValues, useComputedMetrics } from '../overview/metricData'
import { maturityOverviewUrl, maturityRecordsUrl } from '../overview/maturityData'
import MaturityRadar from '../overview/MaturityRadar'
import {
  analysisWindowLabel,
  currentMonthId,
  formatMetricValue,
  DATAVIZ_COLORS,
  INITIAL_FILTER,
  isGeneralIterationFallback,
  isValidMonth,
  iterationPeriods,
  latestPeriodId,
} from '../overview/overviewLogic'
import { buildIterationCompareOption, buildTeamTrendOption } from './chartOption'
import {
  maturityProfileSeries,
  mergePeriods,
  pointForSelection,
  sourceForPeriod,
  TEAM_KPI_CODES,
  teamMetricSummary,
  teamKpiEntries,
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

function useTeamMaturity(teamId, month, onSessionExpired) {
  const [state, setState] = useState({ loading: true, records: [], key: null, general: null, error: null })
  const sessionExpiredRef = useRef(onSessionExpired)
  sessionExpiredRef.current = onSessionExpired

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState({ loading: true, records: [], key: null, general: null, error: null })
    Promise.all([
      fetchJson(maturityRecordsUrl(teamId, month), { signal: controller.signal }),
      fetchJson(maturityOverviewUrl(month, 'key'), { signal: controller.signal }),
      fetchJson(maturityOverviewUrl(month, 'general'), { signal: controller.signal }),
    ])
      .then(([records, key, general]) => { if (active) setState({ loading: false, records, key, general, error: null }) })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return
        setState({ loading: false, records: [], key: null, general: null, error })
        if (error.status === 401) sessionExpiredRef.current?.()
      })
    return () => { active = false; controller.abort() }
  }, [teamId, month])

  return state
}

function TeamMaturityProfile({ catalog, month, onSessionExpired, team, teamColor }) {
  const maturity = useTeamMaturity(team.id, month, onSessionExpired)

  function profile(kind, overview, label) {
    const activities = (overview?.activities ?? catalog
      .filter((activity) => activity.kind === kind)
      .map((activity) => ({ activity_id: activity.id, activity_name: activity.name, score: null })))
      .map((activity) => ({ ...activity, activity_id: activity.activity_id ?? activity.id, activity_name: activity.activity_name ?? activity.name }))
    const records = maturity.records.filter((record) => record.kind === kind)
    const recordsByActivity = new Map(records.map((record) => [String(record.activity_id), record]))
    const matrixRows = [
      {
        id: team.id,
        label: `${team.name} · ${month}`,
        values: activities.map((activity) => {
          const record = recordsByActivity.get(String(activity.activity_id))
          return { text: record?.score_display, level: record?.grade }
        }),
      },
      {
        id: 'domain-average',
        label: '领域平均',
        kind: 'average',
        values: activities.map((activity) => ({ text: activity.score_display, level: activity.grade })),
      },
    ]
    return (
      <section className="drilldown-maturity__category" key={kind}>
        <h3>{label}</h3>
        <div className="drilldown-maturity__category-grid">
          <AnalyticsSection title="团队成熟度矩阵" description={`${month} · 当前团队与领域平均，未评估不补零。`}>
            <MaturityMatrix label={`${month} ${label}团队成熟度矩阵`} columns={activities.map((activity) => ({ id: activity.activity_id, label: activity.activity_name }))} rows={matrixRows} />
          </AnalyticsSection>
          <AnalyticsSection title="成熟度雷达" description="同一活动维度上比较当前团队与领域平均。">
            <MaturityRadar activities={activities} series={maturityProfileSeries({ activities, records, teamName: team.name, teamColor, domainColor: DATAVIZ_COLORS.companyAverage })} ariaLabel={`${team.name}${label}与领域平均成熟度对比`} />
          </AnalyticsSection>
        </div>
      </section>
    )
  }

  return (
    <AnalyticsSection id="team-maturity" className="drilldown-maturity drilldown-story-section" title="成熟度画像" description={`${team.name} 与领域平均按相同活动、相同评估月比较；未评估不补零。`}>
      {maturity.loading && <div className="analytics-empty" role="status">正在加载成熟度画像…</div>}
      {maturity.error && <div className="analytics-empty analytics-empty--error" role="alert">成熟度画像加载失败：{maturity.error.message}</div>}
      {!maturity.loading && !maturity.error && <div className="drilldown-maturity__categories">{profile('key', maturity.key, '关键研发活动')}{profile('general', maturity.general, '通用研发能力')}</div>}
    </AnalyticsSection>
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
  metric,
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
  const [showDetail, setShowDetail] = useState(false)
  const data = metric ? trendData[metric.id] : undefined
  const error = metric ? trendErrors[metric.id] : undefined
  const fallback = isGeneralIterationFallback(activity, filter)
  const selectedPeriodId = fallback ? latestPeriodId(data?.periods) : (filter.periodId ?? 'all')
  const detailId = `activity-detail-${activity.id}-${metric?.id ?? 'empty'}`
  const teamSeries = data?.series?.find((series) => String(series.team_id) === String(teamId))
  const booleanValue = teamSeries?.snapshot
  const option = useMemo(() => (
    data && metric.type !== 'boolean'
      ? buildTeamTrendOption({ data, metric, teamId, selectedPeriodId, accent })
      : null
  ), [accent, data, metric, selectedPeriodId, teamId])
  const currentValue = data && selectedPeriodId !== 'all' ? valueForSelection(data, metric, teamId, selectedPeriodId) : null
  const currentPeriod = data?.periods?.find((period) => String(period.id) === String(selectedPeriodId))

  if (!metric) {
    return <article className="drilldown-activity-card"><div className="drilldown-empty">该活动尚未配置指标。</div></article>
  }

  return (
    <article className="drilldown-activity-card">
      <header className="drilldown-activity-header">
        <div className="drilldown-activity-title">
          <h3>{activity.name}</h3>
          <span>{activity.kind === 'key' ? '关键' : '通用'}</span>
        </div>
        <div className="drilldown-card-actions">
          {metric.type !== 'boolean' && (
            <button
              type="button"
              className={`drilldown-detail-button ${showDetail ? 'is-active' : ''}`}
              aria-expanded={showDetail}
              aria-controls={detailId}
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
        <div className={`drilldown-boolean-status ${booleanValue === false ? 'is-negative' : ''}`}>
          {booleanValue === true
            ? `✓ 已具备${metric.name}`
            : booleanValue === false ? `✗ 不具备${metric.name}` : `${metric.name}状态未知`}
        </div>
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
            {selectedPeriodId === 'all' ? '全部周期趋势；选择单一周期查看当前值' : `周期 ${currentPeriod?.label ?? selectedPeriodId}：${formatMetricValue(metric, currentValue)}`}
            {filter.dimension === 'iteration' && activity.kind === 'key'
              ? ' · 按迭代标签聚合'
              : ' · 按时间字段聚合'}
            {fallback && ' · 通用研发能力无迭代维度，固定按月'}
          </p>
        </>
      )}

      {showDetail && metric.type !== 'boolean' && (
        <div id={detailId} className="drilldown-details">
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
  const timeUnit = { month: '月', week: '周', day: '日' }[filter.granularity] ?? '月'
  const dimension = filter.dimension === 'iteration'
    ? `按版本/迭代${filter.versionId !== 'all' ? ` · ${versions.find((version) => String(version.id) === String(filter.versionId))?.name ?? ''}` : ''}`
    : `按时间 · ${timeUnit}`
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

function metricDeltaLabel(metric, value, prefix) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return `${prefix} —`
  const formatted = formatMetricValue(metric, value)
  return `${prefix} ${value > 0 && !String(formatted).startsWith('+') ? `+${formatted}` : formatted}`
}

function TeamDrilldownContent({
  catalog,
  versions,
  team,
  teams = [],
  maturityState,
  onMaturityChange,
  onNavigate,
  onSessionExpired,
  filter: controlledFilter,
  onFilterChange,
}) {
  const [localFilter, setLocalFilter] = useState(INITIAL_FILTER)
  const [selectedLifecycleActivityId, setSelectedLifecycleActivityId] = useState(null)
  const filter = controlledFilter ?? localFilter
  const setFilter = onFilterChange ?? setLocalFilter
  const keyActivities = useMemo(() => catalog.filter((activity) => activity.kind === 'key'), [catalog])
  const kpiCatalog = useMemo(() => catalog
    .map((activity) => ({ ...activity, metrics: activity.metrics.filter((metric) => TEAM_KPI_CODES.includes(metric.code)) }))
    .filter((activity) => activity.metrics.length), [catalog])
  const maturityMonth = isValidMonth(maturityState?.month) ? maturityState.month : currentMonthId()
  const cycle = ['half', 'year'].includes(filter.cycle) ? filter.cycle : '6m'
  const kpiFilter = useMemo(() => ({
    dimension: 'time',
    granularity: 'month',
    versionId: filter.versionId ?? 'all',
    periodId: null,
    analysisMonth: maturityMonth,
    windowLimit: 12,
  }), [filter.versionId, maturityMonth])
  const kpiComputed = useComputedMetrics(kpiCatalog, kpiFilter, onSessionExpired)
  const computed = useComputedMetrics(catalog, filter, onSessionExpired)
  const iterationFilter = useMemo(() => ({ ...filter, dimension: 'iteration', granularity: 'month' }), [filter.versionId])
  const iterationComputed = useComputedMetrics(keyActivities, iterationFilter, onSessionExpired)
  const factsState = useTeamFacts(team.id, onSessionExpired)
  const teamIdsKey = teams.map((item) => item.id).join(',')
  const accent = useMemo(
    () => teamAccent(team.id, teams.map((item) => item.id)),
    [team.id, teamIdsKey],
  )
  const teamKpis = useMemo(() => teamKpiEntries(metricEntries(kpiCatalog, kpiComputed.data)), [kpiCatalog, kpiComputed.data])
  const teamKpiSummaries = useMemo(() => teamKpis.map((entry) => ({
    ...entry,
    summary: teamMetricSummary({ data: entry.data, metric: entry.metric, teamId: team.id, month: maturityMonth, cycle }),
  })), [cycle, maturityMonth, team.id, teamKpis])
  const overallTrendEntries = teamKpiSummaries.filter(({ metric }) => ['cd-ar-pen', 'cd-eff'].includes(metric.code))

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
  const detailPeriodId = filter.periodId ?? latestPeriodId(periods)
  const selectedLifecycleActivity = keyActivities.find((activity) => String(activity.id) === String(selectedLifecycleActivityId)) ?? keyActivities[0] ?? null
  const sectionIds = ['team-overall', 'team-lifecycle', 'team-maturity']
  const activeSectionId = useActiveSection(sectionIds)

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

  useEffect(() => {
    if (!keyActivities.some((activity) => String(activity.id) === String(selectedLifecycleActivityId))) {
      setSelectedLifecycleActivityId(keyActivities[0]?.id ?? null)
    }
  }, [keyActivities, selectedLifecycleActivityId])

  function changeMonth(nextMonth) {
    if (isValidMonth(nextMonth)) onMaturityChange?.({ ...(maturityState ?? {}), month: nextMonth }, { history: 'push' })
  }

  function changeCycle(nextCycle) {
    if (nextCycle !== cycle) setFilter({ ...filter, cycle: nextCycle }, { history: 'push' })
  }

  return (
    <div
      className="overview-shell drilldown-shell"
      style={{ '--drilldown-accent': accent }}
    >
      <PageHeader
        className="drilldown-page-head"
        title={`${team.name} · 团队下钻`}
        description={`以 ${team.name} 为主序列，按同指标全公司均值作事实对照；成熟度按 ${maturityMonth} 自然月评估。当前筛选：${currentFilterDescription(filter, versions, periods)}`}
        actions={<button type="button" className="drilldown-back-button" onClick={() => onNavigate('/')}>返回总览</button>}
      />

      <FilterBar
        filter={filter}
        onChange={setFilter}
        versions={versions}
        periods={timePeriods}
        loading={computed.loading}
        month={maturityMonth}
        onMonthChange={changeMonth}
      />

      <nav className="drilldown-section-nav" aria-label="团队详情章节">
        {[
          ['team-overall', '整体表现'],
          ['team-lifecycle', '研发关键环节'],
          ['team-maturity', '成熟度画像'],
        ].map(([id, label]) => <a key={id} href={`#${id}`} aria-current={activeSectionId === id ? 'location' : undefined}>{label}</a>)}
      </nav>

      <AnalyticsSection id="team-overall" className="drilldown-story-section" title="整体表现" description={`${team.name} 的现有目录指标；周期值截至 ${maturityMonth}，不同指标保持各自口径。`}>
        <AnalyticsSection title={`月度核心成效 · ${maturityMonth}`} description="主值为当前团队，次级值为同指标全公司均值。">
          {teamKpiSummaries.length
            ? <div className="drilldown-kpi-row">{teamKpiSummaries.map(({ activity, metric, summary }) => <MetricKpiCard
              key={`month-${metric.id}`}
              label={`${activity.name} · ${metric.name}`}
              value={formatMetricValue(metric, summary.monthValue)}
              delta={metricDeltaLabel(metric, summary.monthDelta, '环比')}
              comparison={`本团队 ${team.name} · 全公司均值 ${formatMetricValue(metric, summary.monthBenchmark)}`}
              trendValues={summary.monthTrend}
              trendLabel={`${team.name} ${metric.name}近六个月趋势`}
              accent={DATAVIZ_COLORS.metricType[metric.type] ?? accent}
              loading={kpiComputed.loading}
              error={kpiComputed.errors[metric.id]?.message ? `指标加载失败：${kpiComputed.errors[metric.id].message}` : undefined}
            />)}</div>
            : <div className="analytics-empty">当前目录没有配置团队总览指标。</div>}
        </AnalyticsSection>
        <AnalyticsSection title={`周期整体成效 · ${analysisWindowLabel(maturityMonth, cycle)}（截至${maturityMonth}）`} description="比例与效率按团队原始事实重算；数量显示当前月份新增。" action={<div className="drilldown-cycle-control" role="group" aria-label="统计周期">{[['6m', '近6个月'], ['half', '本半年度'], ['year', '年度累计']].map(([value, label]) => <button key={value} type="button" aria-pressed={cycle === value} className={cycle === value ? 'is-active' : ''} onClick={() => changeCycle(value)}>{label}</button>)}</div>}>
          {teamKpiSummaries.length
            ? <div className="drilldown-kpi-row">{teamKpiSummaries.map(({ activity, metric, summary }) => <MetricKpiCard
              key={`cycle-${metric.id}`}
              label={`${activity.name} · ${metric.name}`}
              value={formatMetricValue(metric, summary.periodValue)}
              delta={metricDeltaLabel(metric, summary.periodDelta, metric.type === 'count' ? '本月新增' : '纳入本月变化')}
              comparison={`本团队 ${team.name} · 全公司均值 ${formatMetricValue(metric, summary.periodBenchmark)}`}
              trendValues={summary.periodTrend}
              trendLabel={`${team.name} ${metric.name}${analysisWindowLabel(maturityMonth, cycle)}累计趋势`}
              accent={DATAVIZ_COLORS.metricType[metric.type] ?? accent}
              loading={kpiComputed.loading}
              error={kpiComputed.errors[metric.id]?.message ? `指标加载失败：${kpiComputed.errors[metric.id].message}` : undefined}
            />)}</div>
            : <div className="analytics-empty">当前目录没有配置团队总览指标。</div>}
        </AnalyticsSection>
        <AnalyticsSection title="核心趋势" description="当前团队为主序列，全公司均值只对照同一目录指标。">
          <div className="drilldown-overall-trends">{overallTrendEntries.map(({ activity, metric }) => <ActivityTrendCard
            key={metric.id}
            activity={{ ...activity, metrics: [metric] }}
            metric={metric}
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
          />)}</div>
        </AnalyticsSection>
      </AnalyticsSection>

      <AnalyticsSection id="team-lifecycle" className="drilldown-story-section" title="研发关键环节" description={`${team.name} 在各活动的真实目录指标；不比较不同单位。`}>
        {detailPeriodId === 'all' && <div className="analytics-empty">选择单一周期查看关键环节当前值；全部周期仍可查看下方趋势。</div>}
        <div className="drilldown-lifecycle-cards" role="group" aria-label="选择研发关键活动">
          {keyActivities.map((activity) => <button key={activity.id} type="button" className="drilldown-lifecycle-card" aria-pressed={String(activity.id) === String(selectedLifecycleActivity?.id)} onClick={() => setSelectedLifecycleActivityId(activity.id)}>
            <strong>{activity.name}</strong>
            {activity.metrics.map((metric) => {
              const data = computed.data[metric.id]
              const teamValue = detailPeriodId === 'all' ? null : valueForSelection(data, metric, team.id, detailPeriodId)
              const benchmark = detailPeriodId === 'all' ? null : data?.company_average?.find((point) => String(point.period_id) === String(detailPeriodId))?.value
              return <span className="drilldown-lifecycle-metric" key={metric.id}><small>{metric.name}</small><b>{formatMetricValue(metric, teamValue)}</b><em>均值 {formatMetricValue(metric, benchmark)}</em></span>
            })}
          </button>)}
        </div>
        {selectedLifecycleActivity && <AnalyticsSection title={`${selectedLifecycleActivity.name} · 双指标趋势`} description={`${team.name} 对照同指标全公司均值。`}>
          <div className="drilldown-lifecycle-trends">{selectedLifecycleActivity.metrics.map((metric) => <ActivityTrendCard
            key={metric.id}
            activity={{ ...selectedLifecycleActivity, metrics: [metric] }}
            metric={metric}
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
          />)}</div>
        </AnalyticsSection>}
      </AnalyticsSection>

      <TeamMaturityProfile catalog={catalog} month={maturityMonth} onSessionExpired={onSessionExpired} team={team} teamColor={accent} />
    </div>
  )
}

export default function TeamDrilldownPage({ team, ...props }) {
  if (!team) {
    return (
      <div className="analytics-page drilldown-shell">
        <PageHeader title="团队不存在" description="找不到请求的团队。" actions={<button type="button" className="drilldown-back-button" onClick={() => props.onNavigate('/')}>返回总览</button>} />
      </div>
    )
  }

  return <TeamDrilldownContent team={team} {...props} />
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { ClockCircleOutlined, CodeOutlined, FileTextOutlined, PieChartOutlined, TeamOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useLocation } from 'react-router'

import { fetchJson } from '../api'
import useActiveSection from '../components/useActiveSection'
import EChart from '../components/EChart'
import { ChartCard, MaturityMatrix } from '../components/AnalyticsComponents'
import AnalyticsPanel from '../components/AnalyticsPanel'
import MetricKpiCard from '../components/MetricCard'
import PageHeader from '../components/PageHeader'
import FilterBar from '../overview/FilterBar'
import { buildIROverviewMetricData, IR_OVERVIEW_KPIS, irOverviewMetricSummary, useIROverviewMetrics } from '../overview/irKpiData'
import { buildTrendOption, efficiencyOutlierAxisLabel, hasEfficiencyOutlier } from '../overview/chartOption'
import { hasNumericValues, useComputedMetrics } from '../overview/metricData'
import { maturityOverviewUrl, maturityRecordsUrl } from '../overview/maturityData'
import MaturityRadar from '../overview/MaturityRadar'
import {
  analysisWindowMonths,
  analysisWindowLabel,
  currentMonthId,
  formatMetricDelta,
  formatMetricValue,
  DATAVIZ_COLORS,
  INITIAL_FILTER,
  isGeneralIterationFallback,
  isValidMonth,
  iterationPeriods,
  latestPeriodId,
  monthWindow,
  previousMonthId,
} from '../overview/overviewLogic'
import { lifecycleMetricSlots, metricDataForPeriods } from '../overview/executiveLogic'
import { buildIterationCompareOption, buildTeamTrendOption } from './chartOption'
import {
  maturityProfileSeries,
  iterationReferenceAverage,
  mergePeriods,
  pointForSelection,
  sourceForPeriod,
  teamAccentColor,
  valueForSelection,
} from './drilldownLogic'
import './drilldown.css'

const TEAM_COLOR_STORAGE_KEY = 'ai-dev-radar.team-color-slots'
const TEAM_ACCENT_FALLBACK = DATAVIZ_COLORS.team[0]
const IR_KPI_ICONS = {
  'ai-demand-penetration': <PieChartOutlined />,
  'ai-rd-efficiency': <ThunderboltOutlined />,
  'ai-covered-ir-count': <FileTextOutlined />,
  'ai-efficiency-workload': <ClockCircleOutlined />,
}
const LIFECYCLE_ICONS = {
  sa: <FileTextOutlined />,
  se: <TeamOutlined />,
  dd: <PieChartOutlined />,
  cd: <CodeOutlined />,
  tcg: <ClockCircleOutlined />,
  tce: <ThunderboltOutlined />,
}

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

function useTeamMaturity(teamId, month, onSessionExpired) {
  const [state, setState] = useState({ loading: true, records: [], previousRecords: [], key: null, general: null, error: null })
  const sessionExpiredRef = useRef(onSessionExpired)
  sessionExpiredRef.current = onSessionExpired

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const previousMonth = previousMonthId(month)
    setState({ loading: true, records: [], previousRecords: [], key: null, general: null, error: null })
    Promise.all([
      fetchJson(maturityRecordsUrl(teamId, month), { signal: controller.signal }),
      fetchJson(maturityRecordsUrl(teamId, previousMonth), { signal: controller.signal }),
      fetchJson(maturityOverviewUrl(month, 'key'), { signal: controller.signal }),
      fetchJson(maturityOverviewUrl(month, 'general'), { signal: controller.signal }),
    ])
      .then(([records, previousRecords, key, general]) => { if (active) setState({ loading: false, records, previousRecords, key, general, error: null }) })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return
        setState({ loading: false, records: [], previousRecords: [], key: null, general: null, error })
        if (error.status === 401) sessionExpiredRef.current?.()
      })
    return () => { active = false; controller.abort() }
  }, [teamId, month])

  return state
}

function TeamMaturityProfile({ catalog, month, onSessionExpired, team, teamColor }) {
  const maturity = useTeamMaturity(team.id, month, onSessionExpired)
  const previousMonth = previousMonthId(month)
  const [kind, setKind] = useState('key')

  function profile(kind, overview, label) {
    const transient = maturity.loading || Boolean(maturity.error)
    const placeholder = maturity.loading ? '…' : '—'
    const sourceActivities = (overview?.activities ?? catalog
      .filter((activity) => activity.kind === kind)
      .map((activity) => ({ activity_id: activity.id, activity_name: activity.name, score: null })))
      .map((activity) => ({ ...activity, activity_id: activity.activity_id ?? activity.id, activity_name: activity.activity_name ?? activity.name }))
    const activities = transient ? sourceActivities.map((activity) => ({ ...activity, score: null, score_display: placeholder, grade: null })) : sourceActivities
    const records = transient ? [] : maturity.records.filter((record) => record.kind === kind)
    const previousRecords = transient ? [] : maturity.previousRecords.filter((record) => record.kind === kind)
    const recordsByActivity = new Map(records.map((record) => [String(record.activity_id), record]))
    const previousRecordsByActivity = new Map(previousRecords.map((record) => [String(record.activity_id), record]))
    const matrixRows = [
      {
        id: 'team-current',
        label: `${team.name} · 本期 ${month}`,
        values: activities.map((activity) => {
          const record = recordsByActivity.get(String(activity.activity_id))
          return { text: transient ? placeholder : record?.score_display, level: transient ? null : record?.grade }
        }),
      },
      {
        id: 'team-previous',
        label: `${team.name} · 上期 ${previousMonth}`,
        values: activities.map((activity) => {
          const record = previousRecordsByActivity.get(String(activity.activity_id))
          return { text: transient ? placeholder : record?.score_display, level: transient ? null : record?.grade }
        }),
      },
      {
        id: 'domain-average',
        label: '领域平均 · 本期',
        kind: 'average',
        values: activities.map((activity) => ({ text: transient ? placeholder : activity.score_display, level: transient ? null : activity.grade })),
      },
    ]
    return (
      <section className="drilldown-maturity__category" key={kind}>
        <h3>{label}</h3>
        <div className="drilldown-maturity__category-grid">
          <div className="drilldown-maturity__module">
            <header><h4>团队成熟度矩阵</h4><p className={transient ? 'drilldown-maturity__feedback' : undefined} role={maturity.loading ? 'status' : maturity.error ? 'alert' : undefined}>{maturity.loading ? '正在加载成熟度画像…' : maturity.error ? '成熟度画像加载失败，暂不可用。' : `${team.name} 本期、上期与领域本期并列；未评估不补零。`}</p></header>
            <MaturityMatrix label={`${month} ${label}团队成熟度矩阵`} columns={activities.map((activity) => ({ id: activity.activity_id, label: activity.activity_name }))} rows={matrixRows} />
          </div>
          <div className="drilldown-maturity__module">
            <header><h4>成熟度雷达</h4><p>同一活动维度比较团队本期、上期与领域本期。</p></header>
            <MaturityRadar activities={activities} series={maturityProfileSeries({ activities, records, previousRecords, teamName: team.name, teamColor, domainColor: DATAVIZ_COLORS.companyAverage })} ariaLabel={`${team.name}${label}本期、上期与领域平均成熟度对比`} />
          </div>
        </div>
      </section>
    )
  }

  return (
    <AnalyticsPanel id="team-maturity" className="drilldown-maturity drilldown-story-section" title="成熟度画像" description={`${team.name} 本期、上期与领域平均按相同活动比较；未评估不补零。`} action={<div className="drilldown-maturity-mode" role="group" aria-label="成熟度范围">
      <Button size="small" type={kind === 'key' ? 'primary' : 'default'} aria-pressed={kind === 'key'} onClick={() => setKind('key')}>关键研发活动</Button>
      <Button size="small" type={kind === 'general' ? 'primary' : 'default'} aria-pressed={kind === 'general'} onClick={() => setKind('general')}>通用研发能力</Button>
    </div>}>
      <div className="drilldown-maturity__categories">{kind === 'key' ? profile('key', maturity.key, '关键研发活动') : profile('general', maturity.general, '通用研发能力')}</div>
    </AnalyticsPanel>
  )
}

function ErrorMessage({ message = '数据暂时无法加载。' }) {
  return (
    <div className="drilldown-empty drilldown-error" role="alert">
      <span>{message}</span>
      <Button type="link" size="small" onClick={() => window.location.reload()}>重试</Button>
    </div>
  )
}

function IterationCompare({ data, metric, teamId, accent, loading, error, benchmarkAverage, benchmarkError, benchmarkLabel }) {
  if (loading) return <div className="drilldown-detail-loading">正在加载迭代对比…</div>
  if (error) return <ErrorMessage message={benchmarkError ? '本团队与领域参照数据暂时无法加载，请重试。' : '本团队数据暂时无法加载，请重试。'} />
  const selectedTeamData = dataForTeam(data, teamId)
  const selectedData = selectedTeamData ? { ...selectedTeamData, company_average: benchmarkAverage ?? [] } : null
  if (!hasNumericValues(selectedData)) return <div className="drilldown-detail-empty">当前指标暂无迭代事实数据。</div>
  const outlierAxisLabel = hasEfficiencyOutlier(selectedData, metric) ? efficiencyOutlierAxisLabel(selectedData, metric) : null

  return (
    <section className="drilldown-detail-section">
      <h4>迭代分片对比 · {metric.name}</h4>
      <p className="drilldown-fact-note">本团队值按所选版本迭代读取；{benchmarkLabel}按相同起止日期、所有团队不限版本重算。</p>
      <EChart
        option={buildIterationCompareOption({ data: selectedData, metric, teamId, accent, averageLabel: benchmarkLabel })}
        height={180}
        ariaLabel={`${metric.name} 迭代分片对比`}
      />
      {benchmarkError && <p className="drilldown-fact-note">领域参照加载失败；本团队迭代值仍保留。</p>}
      {outlierAxisLabel && <p className="drilldown-fact-note">图轴 {outlierAxisLabel}；越界值贴边显示，悬浮可查看原值。</p>}
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
  if (factsError) return <ErrorMessage message="本团队事实记录暂时无法加载，请重试。" />
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
  slotLabel,
  filter,
  teamId,
  accent,
  trendData,
  benchmarkData,
  benchmarkError,
  benchmarkLabel,
  trendErrors,
  trendLoading,
  iterationData,
  iterationErrors,
  iterationLoading,
  onSessionExpired,
  facts,
  factsLoading,
  factsError,
}) {
  const [showDetail, setShowDetail] = useState(false)
  const data = metric ? trendData[metric.id] : undefined
  const referenceData = metric ? benchmarkData?.[metric.id] : undefined
  const targetPeriodIds = useMemo(
    () => (referenceData?.periods ?? data?.periods ?? []).map((period) => period.id),
    [data?.periods, referenceData?.periods],
  )
  const alignedData = useMemo(() => (
    data && targetPeriodIds.length ? metricDataForPeriods(data, targetPeriodIds) : data
  ), [data, targetPeriodIds])
  const teamData = useMemo(() => dataForTeam(alignedData, teamId), [alignedData, teamId])
  const selectedData = teamData ? { ...teamData, company_average: referenceData?.company_average ?? [] } : null
  const error = metric ? trendErrors[metric.id] : undefined
  const fallback = isGeneralIterationFallback(activity, filter)
  const selectedPeriodId = fallback ? latestPeriodId(data?.periods) : (filter.periodId ?? 'all')
  const detailId = `activity-detail-${activity.id}-${metric?.id ?? 'empty'}`
  const iterationReferenceCatalog = useMemo(() => (
    metric && activity.kind === 'key' ? [{ ...activity, metrics: [metric] }] : null
  ), [activity, metric])
  const iterationReferenceFilter = useMemo(() => ({ dimension: 'time', granularity: 'day', versionId: 'all', periodId: null }), [])
  const iterationReferenceEnabled = showDetail && activity.kind === 'key' && metric?.type !== 'boolean' && filter.dimension !== 'iteration'
  const iterationReference = useComputedMetrics(
    iterationReferenceEnabled ? iterationReferenceCatalog : null,
    iterationReferenceFilter,
    onSessionExpired,
  )
  const selectedIterationPeriods = metric ? iterationData?.[metric.id]?.periods ?? [] : []
  const iterationBenchmarkAverage = useMemo(() => (
    filter.dimension === 'iteration'
      ? referenceData?.company_average ?? []
      : metric ? iterationReferenceAverage(iterationReference.data?.[metric.id], selectedIterationPeriods, metric) : []
  ), [filter.dimension, iterationReference.data, metric, referenceData?.company_average, selectedIterationPeriods])
  const iterationBenchmarkError = filter.dimension === 'iteration' ? benchmarkError : iterationReference.errors[metric?.id]
  const iterationBenchmarkLoading = filter.dimension === 'iteration' ? trendLoading : iterationReference.loading
  const iterationBenchmarkLabel = filter.versionId === 'all'
    ? '有事实团队等权均值（同日期范围）'
    : '领域参照（同日期范围、不限版本）'
  const teamSeries = selectedData?.series?.[0]
  const booleanValue = teamSeries?.snapshot
  const option = useMemo(() => (
    selectedData && metric.type !== 'boolean'
      ? buildTeamTrendOption({ data: selectedData, metric, teamId, selectedPeriodId, accent, averageLabel: benchmarkLabel })
      : null
  ), [accent, benchmarkLabel, metric, selectedData, selectedPeriodId, teamId])
  const outlierAxisLabel = hasEfficiencyOutlier(selectedData, metric) ? efficiencyOutlierAxisLabel(selectedData, metric) : null
  const trendNote = !metric ? '' : benchmarkError
    ? '领域参照加载失败，当前团队值仍显示。'
    : outlierAxisLabel ? `图轴 ${outlierAxisLabel}；越界值贴边，悬浮可看原值。`
      : fallback ? '通用研发能力没有迭代维度，按月显示。' : ''

  if (!metric) {
    return <article className="drilldown-activity-card">
      <header className="drilldown-activity-header"><div className="drilldown-activity-title"><h3>{activity.name} · {slotLabel}</h3></div></header>
      <div className="drilldown-empty">目录未配置{slotLabel}对应类型的指标。</div>
    </article>
  }

  return (
    <article className="drilldown-activity-card">
      <header className="drilldown-activity-header">
        <div className="drilldown-activity-title">
          <h3>{activity.name} · {slotLabel ?? metric.name}<small>来源：{metric.name}</small></h3>
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

      <div className="drilldown-activity-plot" aria-busy={trendLoading || undefined}>
        {trendLoading && <div className="drilldown-empty" role="status">正在更新指标数据…</div>}
        {!trendLoading && error && <ErrorMessage message={benchmarkError || filter.versionId === 'all' ? '本团队与领域参照数据暂时无法加载，请重试。' : '本团队数据暂时无法加载，请重试。'} />}
        {!trendLoading && !error && metric.type === 'boolean' && (
          <div className={`drilldown-boolean-status ${booleanValue === false ? 'is-negative' : ''}`}>
            {booleanValue === true
              ? `✓ 已具备${metric.name}`
              : booleanValue === false ? `✗ 不具备${metric.name}` : `${metric.name}状态未知`}
          </div>
        )}
        {!trendLoading && !error && metric.type !== 'boolean' && !hasNumericValues(selectedData) && (
          <div className="drilldown-empty" role="status">当前筛选切片暂无数据。</div>
        )}
        {!trendLoading && !error && metric.type !== 'boolean' && hasNumericValues(selectedData) && (
          <EChart
            option={option}
            height={120}
            ariaLabel={`${activity.name} ${metric.name} 与 ${benchmarkLabel} 趋势图`}
          />
        )}
      </div>
      <p className="drilldown-fact-note" title={trendNote}>{trendLoading || error ? ' ' : trendNote || ' '}</p>

      {showDetail && metric.type !== 'boolean' && (
        <div id={detailId} className="drilldown-details">
          {activity.kind === 'key' && (
            <IterationCompare
              data={iterationData[metric.id]}
              metric={metric}
              teamId={teamId}
              accent={accent}
              loading={iterationLoading || (filter.dimension === 'iteration' ? trendLoading : iterationReferenceEnabled && iterationBenchmarkLoading)}
              error={iterationErrors[metric.id]}
              benchmarkAverage={iterationBenchmarkAverage}
              benchmarkError={iterationBenchmarkError}
              benchmarkLabel={iterationBenchmarkLabel}
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

function currentFilterDescription(filter, versions, periods, month) {
  const timeUnit = { month: '月', week: '周', day: '日' }[filter.granularity] ?? '月'
  const dimension = filter.dimension === 'iteration'
    ? `按版本/迭代${filter.versionId !== 'all' ? ` · ${versions.find((version) => String(version.id) === String(filter.versionId))?.name ?? ''}` : ''}`
    : `按时间 · ${timeUnit}`
  const period = periods.find((item) => String(item.id) === String(filter.periodId))
  const cycle = ['half', 'year'].includes(filter.cycle) ? filter.cycle : '6m'
  return `全局 KPI 统计周期：${analysisWindowLabel(month, cycle)} · 原始指标${dimension} · 事实周期：${filter.periodId === 'all' ? '全部周期' : period?.label ?? '最新'}`
}

function teamAccent(teamId, teamIds = [teamId]) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(TEAM_COLOR_STORAGE_KEY) ?? '{}')
    return teamAccentColor(teamId, teamIds, stored) ?? TEAM_ACCENT_FALLBACK
  } catch {
    return TEAM_ACCENT_FALLBACK
  }
}

function validTimePeriodId(periodId, granularity) {
  if (granularity === 'month') return isValidMonth(periodId)
  if (granularity === 'week') return /^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/.test(String(periodId))
  if (granularity === 'day') {
    const timestamp = Date.parse(`${periodId}T00:00:00Z`)
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === String(periodId)
  }
  return false
}

function dataForTeam(data, teamId) {
  return data ? { ...data, series: (data.series ?? []).filter((series) => String(series.team_id) === String(teamId)) } : null
}

function metricDeltaLabel(metric, value, prefix) {
  return Number.isFinite(value) ? `${prefix} ${formatMetricDelta(metric, value, true)}` : undefined
}

function changeTone(value) {
  return !Number.isFinite(value) || value === 0 ? 'neutral' : value > 0 ? 'positive' : 'negative'
}

function TeamDrilldownContent({
  catalog,
  versions,
  team,
  teams = [],
  maturityState,
  onMaturityChange,
  onNavigate,
  backPath = '/',
  backLabel = '返回总览',
  onSessionExpired,
  filter: controlledFilter,
  onFilterChange,
}) {
  const [localFilter, setLocalFilter] = useState(INITIAL_FILTER)
  const [selectedLifecycleActivityId, setSelectedLifecycleActivityId] = useState(null)
  const filter = controlledFilter ?? localFilter
  const setFilter = onFilterChange ?? setLocalFilter
  const keyActivities = useMemo(() => catalog.filter((activity) => activity.kind === 'key'), [catalog])
  const maturityMonth = isValidMonth(maturityState?.month) ? maturityState.month : currentMonthId()
  const cycle = ['half', 'year'].includes(filter.cycle) ? filter.cycle : '6m'
  const monthlyTrendMonths = useMemo(() => monthWindow(maturityMonth, 6), [maturityMonth])
  const periodMonths = useMemo(() => analysisWindowMonths(maturityMonth, cycle), [maturityMonth, cycle])
  const irSourceMonths = useMemo(() => monthWindow(maturityMonth, 12), [maturityMonth])
  const irOverview = useIROverviewMetrics(irSourceMonths[0] ?? maturityMonth, maturityMonth, filter.versionId ?? 'all', onSessionExpired)
  const irOverviewErrorMessage = irOverview.error
    ? irOverview.benchmarkError
      ? '本团队与领域参照数据暂时无法加载，请重试。'
      : '本团队数据暂时无法加载，请重试。'
    : undefined
  const irDataByMetric = useMemo(() => irOverview.data ? buildIROverviewMetricData(irOverview.data) : {}, [irOverview.data])
  const irBenchmarkDataByMetric = useMemo(() => irOverview.benchmarkData ? buildIROverviewMetricData(irOverview.benchmarkData) : {}, [irOverview.benchmarkData])
  const computed = useComputedMetrics(catalog, filter, onSessionExpired)
  const iterationFilter = useMemo(() => ({ ...filter, dimension: 'iteration', granularity: 'month' }), [filter.versionId])
  const iterationComputed = useComputedMetrics(keyActivities, iterationFilter, onSessionExpired)
  const needsFactBenchmark = filter.versionId !== 'all' || filter.dimension === 'iteration'
  const factBenchmarkFilter = useMemo(() => ({
    ...filter,
    dimension: 'time',
    granularity: filter.dimension === 'iteration' ? 'day' : filter.granularity,
    versionId: 'all',
    periodId: null,
  }), [filter.dimension, filter.granularity])
  const benchmarkComputed = useComputedMetrics(needsFactBenchmark ? keyActivities : null, factBenchmarkFilter, onSessionExpired)
  const factBenchmarkData = useMemo(() => {
    if (!needsFactBenchmark) return computed.data
    if (filter.dimension === 'time') return benchmarkComputed.data
    return Object.fromEntries(keyActivities.flatMap((activity) => activity.metrics.map((metric) => {
      const versionData = computed.data[metric.id]
      const periods = versionData?.periods ?? []
      return [metric.id, {
        periods,
        company_average: iterationReferenceAverage(benchmarkComputed.data[metric.id], periods, metric),
      }]
    })))
  }, [benchmarkComputed.data, computed.data, filter.dimension, keyActivities, needsFactBenchmark])
  const factsState = useTeamFacts(team.id, onSessionExpired)
  const teamIdsKey = teams.map((item) => item.id).join(',')
  const accent = useMemo(
    () => teamAccent(team.id, teams.map((item) => item.id)),
    [team.id, teamIdsKey],
  )
  const hasVersionScope = filter.versionId !== 'all'
  const selectedVersionName = versions.find((version) => String(version.id) === String(filter.versionId))?.name ?? String(filter.versionId)
  const irBenchmarkLabel = hasVersionScope ? '领域参照 · 不限版本' : '有数据团队等权均值'
  const irScopeDescription = hasVersionScope
    ? `${team.name}当前值按版本「${selectedVersionName}」过滤；领域参照取相同时间范围、相同指标、所有团队且不限版本的有值团队等权均值。`
    : `${team.name}当前值包含全部版本；领域参照取相同时间范围、相同指标下有值团队等权均值。`
  const factBenchmarkLabel = hasVersionScope || filter.dimension === 'iteration'
    ? '领域参照（所有团队，不限版本）'
    : '有事实团队等权均值'
  const factScopeDescription = hasVersionScope || filter.dimension === 'iteration'
    ? `${team.name}当前事实按所选版本/迭代范围读取；领域参照取相同日期范围、相同指标、所有团队且不限版本的等权均值。`
    : `${team.name}对照相同时间范围、相同指标的有事实团队等权均值。`
  const teamKpiSummaries = useMemo(() => IR_OVERVIEW_KPIS.map((metric) => {
    const data = irDataByMetric[metric.code]
    const benchmarkData = filter.versionId === 'all' ? data : irBenchmarkDataByMetric[metric.code] ?? null
    const summary = irOverviewMetricSummary({ data, benchmarkData, metric, month: maturityMonth, monthTrendIds: monthlyTrendMonths, periodIds: periodMonths })
    return {
      metric,
      summary,
      monthTeam: summary?.monthTeams.find((item) => String(item.teamId) === String(team.id)),
      periodTeam: summary?.periodTeams.find((item) => String(item.teamId) === String(team.id)),
    }
  }), [filter.versionId, irBenchmarkDataByMetric, irDataByMetric, maturityMonth, monthlyTrendMonths, periodMonths, team.id])
  const singleTeamBenchmarkNotes = useMemo(() => {
    const notes = new Map()
    for (const { metric, summary } of teamKpiSummaries) {
      for (const [period, rows] of [['月度', summary?.benchmarkMonthTeams], ['周期', summary?.benchmarkPeriodTeams]]) {
        const validTeams = rows?.filter((row) => Number.isFinite(row.value)) ?? []
        if (validTeams.length !== 1) continue
        const onlyTeam = validTeams[0]
        const key = `${period}:${onlyTeam.teamId}`
        const note = notes.get(key) ?? { period, teamName: onlyTeam.teamName, metrics: [] }
        note.metrics.push(metric.name)
        notes.set(key, note)
      }
    }
    const coverageGroups = new Map()
    for (const { period, teamName, metrics } of notes.values()) {
      const key = `${teamName}:${metrics.join(',')}`
      const group = coverageGroups.get(key) ?? { periods: [], teamName, metrics }
      group.periods.push(period)
      coverageGroups.set(key, group)
    }
    return [...coverageGroups.values()].map(({ periods, teamName, metrics }) =>
      `${periods.join('、')}${metrics.length === IR_OVERVIEW_KPIS.length ? '4项 KPI' : metrics.join('、')}等权均值仅含${teamName}（1/${teams.length}），不可多团队对照。`,
    )
  }, [teamKpiSummaries, teams.length])
  const overallTrendEntries = useMemo(() => IR_OVERVIEW_KPIS.slice(0, 2).map((metric) => {
    const fullData = irDataByMetric[metric.code]
    const windowed = fullData ? metricDataForPeriods(fullData, periodMonths) : null
    const reference = irBenchmarkDataByMetric[metric.code]
    const benchmarkWindow = reference ? metricDataForPeriods(reference, periodMonths) : null
    const selectedTeam = dataForTeam(windowed, team.id)
    const data = selectedTeam ? { ...selectedTeam, company_average: benchmarkWindow?.company_average ?? [] } : null
    const outlierAxisLabel = hasEfficiencyOutlier(data, metric) ? efficiencyOutlierAxisLabel(data, metric) : null
    const option = data && hasNumericValues(data)
      ? buildTrendOption({ data, metric, teamColors: { [String(team.id)]: accent }, selectedPeriodId: 'all', averageLabel: irBenchmarkLabel, compact: true, showPointMarkers: true })
      : null
    const readableOption = option && {
      ...option,
      grid: { ...option.grid, top: 20, bottom: 8 },
      legend: { ...option.legend, textStyle: { ...option.legend.textStyle, fontSize: 12 } },
      xAxis: { ...option.xAxis, axisLabel: { ...option.xAxis.axisLabel, fontSize: 12 } },
      yAxis: { ...option.yAxis, axisLabel: { ...option.yAxis.axisLabel, fontSize: 12 } },
    }
    return {
      metric,
      data,
      outlierAxisLabel,
      option: readableOption,
    }
  }), [accent, filter.versionId, irBenchmarkDataByMetric, irBenchmarkLabel, irDataByMetric, periodMonths, team.id])

  const timePeriods = useMemo(() => {
    const source = hasVersionScope ? benchmarkComputed.data : computed.data
    let periods = []
    for (const activity of keyActivities) {
      for (const metric of activity.metrics) {
        const metricPeriods = source[metric.id]?.periods
        if (metricPeriods?.length) {
          periods = metricPeriods
          break
        }
      }
      if (periods.length) break
    }
    if (filter.dimension !== 'time' || filter.periodId === null || filter.periodId === 'all'
      || periods.some((period) => String(period.id) === String(filter.periodId))
      || !validTimePeriodId(filter.periodId, filter.granularity)) return periods
    return mergePeriods([{ periods }, { periods: [{ id: String(filter.periodId), label: String(filter.periodId) }] }])
  }, [benchmarkComputed.data, computed.data, filter.dimension, filter.granularity, filter.periodId, hasVersionScope, keyActivities])
  const iterationPeriodOptions = useMemo(
    () => iterationPeriods(versions, filter.versionId),
    [versions, filter.versionId],
  )
  const periods = filter.dimension === 'iteration' ? iterationPeriodOptions : timePeriods
  const detailPeriodId = filter.periodId ?? latestPeriodId(periods)
  const selectedLifecycleActivity = keyActivities.find((activity) => String(activity.id) === String(selectedLifecycleActivityId)) ?? keyActivities[0] ?? null
  const selectedLifecycleSlots = selectedLifecycleActivity ? lifecycleMetricSlots(selectedLifecycleActivity) : []
  const sectionIds = ['team-overall', 'team-lifecycle', 'team-maturity']
  const activeSectionId = useActiveSection(sectionIds)

  useEffect(() => {
    if (!periods.length) return
    const ids = new Set(periods.map((period) => String(period.id)))
    setFilter((current) => {
      if (current.periodId === null || (current.periodId !== 'all' && !ids.has(String(current.periodId))
        && !(current.dimension === 'time' && validTimePeriodId(current.periodId, current.granularity)))) {
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

  return (
    <div
      className="overview-shell drilldown-shell"
      style={{ '--drilldown-accent': accent }}
    >
      <PageHeader
        className="drilldown-page-head"
        title={`${team.name} · 团队下钻`}
        description={`统计范围：${currentFilterDescription(filter, versions, periods, maturityMonth)}`}
        actions={<div className="drilldown-page-actions">
          <FilterBar
            filter={filter}
            onChange={setFilter}
            versions={versions}
            periods={timePeriods}
            loading={computed.loading || irOverview.loading}
            month={maturityMonth}
            onMonthChange={changeMonth}
            showCycle
            showAdvancedControls={false}
          />
          <button type="button" className="drilldown-back-button" onClick={() => onNavigate(backPath)}>{backLabel}</button>
        </div>}
      />

      <nav className="drilldown-section-nav" aria-label="团队详情章节">
        {[
          ['team-overall', '整体表现'],
          ['team-lifecycle', '研发关键环节'],
          ['team-maturity', '成熟度画像'],
        ].map(([id, label]) => <a key={id} href={`#${id}`} aria-current={activeSectionId === id ? 'location' : undefined}>{label}</a>)}
      </nav>

      <AnalyticsPanel id="team-overall" className="drilldown-story-section drilldown-overall-section" title="整体表现" description={<>{`${team.name} 的四项 KPI 与核心趋势采用临时 IR 口径；${irScopeDescription} 原始目录事实见研发关键环节和明细。`}{singleTeamBenchmarkNotes.length > 0 && <span className="drilldown-team-note" role="status"> {singleTeamBenchmarkNotes.join('；')}</span>}{irOverview.error && <span className="drilldown-team-note" role="status"> 当前团队值{irOverview.benchmarkError ? '与领域参照均' : ''}暂不可用。</span>}{!irOverview.error && irOverview.benchmarkError && <span className="drilldown-team-note" role="status"> 领域参照暂不可用，当前团队值仍保留。</span>}</>}>
        <div className="drilldown-kpi-sections">
          <section className="drilldown-kpi-section">
            <header><h3>月度核心成效 · {maturityMonth}</h3></header>
            <div className="drilldown-kpi-row">{teamKpiSummaries.map(({ metric, summary, monthTeam }) => {
              return <MetricKpiCard
                key={`month-${metric.code}`}
                icon={IR_KPI_ICONS[metric.code]}
                label={metric.name}
                value={formatMetricValue(metric, monthTeam?.value)}
                unit={metric.unit}
                delta={metricDeltaLabel(metric, monthTeam?.delta, '环比')}
                deltaTone={changeTone(monthTeam?.delta)}
                comparison={irOverview.error ? undefined : `${irOverview.benchmarkError ? `${irBenchmarkLabel}暂不可用` : `${irBenchmarkLabel} ${formatMetricValue(metric, summary?.monthCompanyAverage)}`}`}
            detail={irOverview.loading || irOverview.error || Number.isFinite(monthTeam?.value) ? undefined : '本月暂无当前团队值'}
                trendValues={Number.isFinite(monthTeam?.value) ? monthTeam.trend ?? [] : []}
                trendLabel={`${team.name} ${metric.name}月度趋势`}
                accent={metric.accent}
                loading={irOverview.loading}
                error={irOverviewErrorMessage}
              />
            })}</div>
          </section>
          <section className="drilldown-kpi-section">
            <header><h3>周期整体成效 · {analysisWindowLabel(maturityMonth, cycle)}（截至 {maturityMonth}）</h3><p>比例与提效显示周期变化；覆盖数与工作量显示本月贡献。</p></header>
            <div className="drilldown-kpi-row">{teamKpiSummaries.map(({ metric, summary, periodTeam }) => {
              return <MetricKpiCard
                key={`cycle-${metric.code}`}
                icon={IR_KPI_ICONS[metric.code]}
                label={metric.name}
                value={formatMetricValue(metric, periodTeam?.value)}
                unit={metric.unit}
                delta={metricDeltaLabel(metric, periodTeam?.delta, metric.periodDeltaLabel ?? '周期变化')}
                deltaTone={changeTone(periodTeam?.delta)}
                comparison={irOverview.error ? undefined : `${irOverview.benchmarkError ? `${irBenchmarkLabel}暂不可用` : `${irBenchmarkLabel} ${formatMetricValue(metric, summary?.periodCompanyAverage)}`}`}
            detail={irOverview.loading || irOverview.error || Number.isFinite(periodTeam?.value) ? undefined : '所选周期暂无当前团队值'}
                trendValues={Number.isFinite(periodTeam?.value) ? periodTeam.trend ?? [] : []}
                trendLabel={`${team.name} ${metric.name}${analysisWindowLabel(maturityMonth, cycle)}累计趋势`}
                accent={metric.accent}
                loading={irOverview.loading}
                error={irOverviewErrorMessage}
              />
            })}</div>
          </section>
        </div>
        <section className="drilldown-core-trend">
          <header><h3>核心趋势</h3><p>显示 {analysisWindowLabel(maturityMonth, cycle)} 内 IR 月度事实。{irOverview.benchmarkError ? '领域参照请求失败。' : ''}</p></header>
          <div className="drilldown-overall-trends">{overallTrendEntries.map(({ metric, outlierAxisLabel, option }) => <ChartCard
            key={metric.code}
            title={`${team.name} · ${metric.name}`}
            description={outlierAxisLabel ? `图轴 ${outlierAxisLabel}，越界点贴边并保留悬浮原值` : undefined}
            option={option}
            height={133}
            ariaLabel={`${team.name} ${metric.name}与${irBenchmarkLabel}趋势`}
            loading={irOverview.loading}
            error={irOverviewErrorMessage}
            empty={`当前${analysisWindowLabel(maturityMonth, cycle)}暂无${metric.name} IR事实。`}
            reservePlotSpace
          />)}</div>
        </section>
      </AnalyticsPanel>

      <AnalyticsPanel id="team-lifecycle" className="drilldown-story-section drilldown-lifecycle-section" title="研发关键环节" description={`${factScopeDescription} 缺失类型不以其他指标替代。`} action={<FilterBar filter={filter} onChange={setFilter} versions={versions} periods={timePeriods} loading={computed.loading || irOverview.loading || (needsFactBenchmark && benchmarkComputed.loading)} showPrimaryControls={false} />}>
        {filter.periodId === 'all' && <div className="analytics-empty">选择单一周期查看关键环节当前值；全部周期仍可查看下方趋势。</div>}
        <div className="drilldown-lifecycle-cards" role="group" aria-label="选择研发关键活动">
          {keyActivities.map((activity) => <button key={activity.id} type="button" className="drilldown-lifecycle-card" aria-pressed={String(activity.id) === String(selectedLifecycleActivity?.id)} onClick={() => setSelectedLifecycleActivityId(activity.id)}>
            <strong><span className="drilldown-lifecycle-card__icon" aria-hidden="true">{LIFECYCLE_ICONS[activity.code] ?? <CodeOutlined />}</span>{activity.name}</strong>
            {lifecycleMetricSlots(activity).map((slot) => {
              const metric = slot.metric
              const data = metric ? computed.data[metric.id] : undefined
              const teamValue = metric && detailPeriodId !== 'all' ? valueForSelection(data, metric, team.id, detailPeriodId) : null
              const benchmark = metric && detailPeriodId !== 'all' ? factBenchmarkData[metric.id]?.company_average?.find((point) => String(point.period_id) === String(detailPeriodId))?.value : null
              const benchmarkError = metric && needsFactBenchmark ? benchmarkComputed.errors[metric.id] : null
              const displayedBenchmark = benchmarkError ? '领域参照暂不可用' : `${hasVersionScope || filter.dimension === 'iteration' ? '领域参照' : '均值'} ${formatMetricValue(metric, benchmark)}`
              return <span className={`drilldown-lifecycle-metric${metric ? '' : ' is-missing'}`} key={slot.id}><small>{slot.id === 'penetration' ? '渗透率' : '提效'}</small><b>{metric ? formatMetricValue(metric, teamValue) : '—'}</b><em title={metric ? `${metric.name} · ${factBenchmarkLabel} ${formatMetricValue(metric, benchmark)}` : undefined}>{metric ? displayedBenchmark : '目录未配置该类型指标'}</em></span>
            })}
          </button>)}
        </div>
        {selectedLifecycleActivity && <section className="drilldown-lifecycle-detail" aria-label={`${selectedLifecycleActivity.name}双指标趋势`}>
          <div className="drilldown-lifecycle-trends">{selectedLifecycleSlots.map((slot) => <ActivityTrendCard
            key={slot.id}
            activity={selectedLifecycleActivity}
            metric={slot.metric}
            slotLabel={slot.label}
            filter={filter}
            teamId={team.id}
            accent={accent}
            trendData={computed.data}
            benchmarkData={factBenchmarkData}
            benchmarkError={needsFactBenchmark ? benchmarkComputed.errors[slot.metric?.id] : undefined}
            benchmarkLabel={factBenchmarkLabel}
            trendErrors={computed.errors}
            trendLoading={computed.loading || (needsFactBenchmark && benchmarkComputed.loading)}
            iterationData={iterationComputed.data}
            iterationErrors={iterationComputed.errors}
            iterationLoading={iterationComputed.loading}
            onSessionExpired={onSessionExpired}
            facts={factsState.facts}
            factsLoading={factsState.loading}
            factsError={factsState.error}
          />)}</div>
        </section>}
      </AnalyticsPanel>

      <TeamMaturityProfile catalog={catalog} month={maturityMonth} onSessionExpired={onSessionExpired} team={team} teamColor={accent} />
    </div>
  )
}

export default function TeamDrilldownPage({ team, ...props }) {
  const location = useLocation()
  const entryContext = useRef(location.state?.returnTo ? location.state : null)
  if (location.state?.returnTo) entryContext.current = location.state
  const state = entryContext.current
  const requestedReturnPath = state?.returnTo
  const backPath = typeof requestedReturnPath === 'string' && requestedReturnPath.startsWith('/') && !requestedReturnPath.startsWith('//')
    ? requestedReturnPath
    : '/'
  const backLabel = typeof state?.returnLabel === 'string' && state.returnLabel.trim()
    ? `返回${state.returnLabel}`
    : '返回总览'

  if (!team) {
    return (
      <div className="analytics-page drilldown-shell">
        <PageHeader title="团队不存在" description="找不到请求的团队。" actions={<button type="button" className="drilldown-back-button" onClick={() => props.onNavigate(backPath)}>{backLabel}</button>} />
      </div>
    )
  }

  return <TeamDrilldownContent team={team} {...props} backPath={backPath} backLabel={backLabel} />
}

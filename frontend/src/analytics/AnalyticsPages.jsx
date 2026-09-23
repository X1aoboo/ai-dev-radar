import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Drawer, Select } from 'antd'

import AnalyticsPanel from '../components/AnalyticsPanel'
import FilterToolbar from '../components/FilterToolbar'
import MetricCard from '../components/MetricCard'
import PageHeader from '../components/PageHeader'
import useActiveSection from '../components/useActiveSection'
import EChart from '../components/EChart'
import FilterBar from '../overview/FilterBar'
import { hasNumericValues, useComputedMetrics } from '../overview/metricData'
import { buildTrendOption } from '../overview/chartOption'
import { executiveFactRows, factCoverage, factTrendSnapshot, lifecycleRows, rankedTeams } from '../overview/executiveLogic'
import MaturityRadar from '../overview/MaturityRadar'
import { useMaturityOverview } from '../overview/maturityData'
import { booleanStatusRows } from '../metricDetail/metricDetailLogic'
import {
  DATAVIZ_COLORS,
  assignTeamColorSlots,
  buildMetricRows,
  currentMonthId,
  formatMetricValue,
  hasFactValue,
  isValidMonth,
  iterationPeriods,
  latestPeriodId,
  monthWindow,
  TEAM_COLOR_STORAGE_KEY,
} from '../overview/overviewLogic'
import './analytics.css'

function average(values) {
  const valid = values.filter((value) => typeof value === 'number' && Number.isFinite(value))
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

function displayScore(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—'
}

function deltaText(current, previous, formatter = displayScore) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return '—'
  const delta = current - previous
  const formatted = formatter(delta)
  return delta > 0 && String(formatted).startsWith('+') ? formatted : `${delta > 0 ? '+' : ''}${formatted}`
}

function colorSlotsForTeams(teams) {
  const slotsRef = useRef(null)
  if (slotsRef.current === null) {
    try {
      const stored = typeof window === 'undefined' ? {} : JSON.parse(window.localStorage.getItem(TEAM_COLOR_STORAGE_KEY) ?? '{}')
      slotsRef.current = stored && typeof stored === 'object' ? stored : {}
    } catch {
      slotsRef.current = {}
    }
  }
  const teamIds = teams.map((team) => team.id)
  return useMemo(() => {
    const assigned = assignTeamColorSlots(teamIds, slotsRef.current)
    slotsRef.current = assigned.slots
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(TEAM_COLOR_STORAGE_KEY, JSON.stringify(assigned.slots))
    } catch {
      // 本地存储不可用时，当前会话仍保持稳定颜色。
    }
    return assigned.colors
  }, [teamIds.join(',')])
}

function lineOption({ periods, series, yMin = 0, yMax = 5, valueFormatter = displayScore }) {
  return {
    animationDuration: 180,
    grid: { left: 10, right: 18, top: 34, bottom: 20, containLabel: true },
    legend: { top: 0, right: 0, itemWidth: 16, itemHeight: 8, textStyle: { color: DATAVIZ_COLORS.inkSecondary, fontSize: 11 } },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const items = Array.isArray(params) ? params : [params]
        return [`<strong>${items[0]?.axisValue ?? ''}</strong>`, ...items
          .filter((item) => item.value !== null && item.value !== undefined)
          .map((item) => `${item.marker}${item.seriesName}：${valueFormatter(item.value)}`)].join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      data: periods.map((period) => period.label ?? period.id ?? period),
      axisLine: { lineStyle: { color: DATAVIZ_COLORS.axis } },
      axisTick: { show: false },
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 11, hideOverlap: true, alignMinLabel: 'left', alignMaxLabel: 'right' },
    },
    yAxis: {
      type: 'value',
      min: yMin,
      max: yMax,
      splitLine: { lineStyle: { color: DATAVIZ_COLORS.grid } },
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 11, formatter: valueFormatter },
    },
    series: series.map((entry) => ({
      name: entry.name,
      type: 'line',
      data: entry.values,
      color: entry.color,
      connectNulls: false,
      showSymbol: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: entry.dashed ? 2 : 2, type: entry.dashed ? 'dashed' : 'solid', cap: 'round', join: 'round' },
      itemStyle: { color: entry.color },
      emphasis: { focus: 'series', showSymbol: true },
    })),
  }
}

function activitySummary(data, activityId) {
  return data?.activities?.find((activity) => String(activity.activity_id) === String(activityId)) ?? null
}

function cellsForTeamMonth(data, teamId) {
  const team = data?.teams?.find((item) => String(item.team_id) === String(teamId))
  return team?.cells ?? []
}

export function buildActivityMaturitySeries({ history = [], activityId, teams = [], months, teamColors = {} }) {
  const byMonth = new Map(history.map((entry) => [String(entry.month), entry.data]))
  const teamSeries = teams.map((team) => ({
    name: team.name,
    teamId: team.id,
    color: teamColors[String(team.id)] ?? DATAVIZ_COLORS.team[0],
    values: months.map((month) => {
      const cell = cellsForTeamMonth(byMonth.get(String(month)), team.id)
        .find((item) => String(item.activity_id) === String(activityId))
      return hasFactValue(cell?.score) ? cell.score : null
    }),
  }))
  const averageValues = months.map((month, index) => average(teamSeries.map((series) => series.values[index])))
  return {
    series: [...teamSeries, { name: '领域平均', color: DATAVIZ_COLORS.companyAverage, values: averageValues, dashed: true }],
    values: averageValues,
  }
}

export function buildCategoryMaturitySeries({ history = [], months }) {
  const byMonth = new Map(history.map((entry) => [String(entry.month), entry.data]))
  const values = months.map((month) => average((byMonth.get(String(month))?.activities ?? []).map((activity) => activity.score)))
  return { values }
}

function coverageText(valid, total) {
  return `${valid} / ${total}`
}

function SummaryStats({ value, previous, coverage, suffix = '' }) {
  return (
    <div className="analytics-stats" aria-label="当前值与覆盖情况">
      <div><span>当前值</span><strong>{value}{suffix}</strong></div>
      <div><span>前期对比</span><strong>{previous}</strong></div>
      <div><span>覆盖</span><strong>{coverage}</strong></div>
    </div>
  )
}

function ChartCard({ title, eyebrow, option, ariaLabel, onClick, children, action }) {
  return (
    <article className={`analytics-chart-card${option ? '' : ' analytics-chart-card--empty'}`}>
      <header className="analytics-chart-card__header">
        <div><p className="analytics-eyebrow">{eyebrow}</p><h2>{title}</h2></div>
        {action}
      </header>
      {children}
      {option && <EChart option={option} height={245} ariaLabel={ariaLabel} onClick={onClick} />}
    </article>
  )
}

function useDetailDrawer() {
  const [detail, setDetail] = useState(null)
  const triggerRef = useRef(null)
  function open(next) {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) triggerRef.current = document.activeElement
    setDetail(next)
  }
  function close() {
    setDetail(null)
  }
  return { detail, triggerRef, open, close }
}

function DetailRows({ rows, valueLabel = (value) => displayScore(value) }) {
  if (!rows?.length) return <p className="analytics-muted">暂无可展示的团队样本。</p>
  return (
    <div className="analytics-detail-table-wrap">
      <table className="analytics-detail-table">
        <thead><tr><th scope="col">团队</th><th scope="col">当前值</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={String(row.teamId)}><th scope="row">{row.teamName}</th><td>{valueLabel(row.value)}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

function AnalyticsDetailDrawer({ detail, triggerRef, onClose, onNavigate }) {
  const close = () => {
    onClose()
    globalThis.setTimeout?.(() => triggerRef.current?.focus?.(), 0)
  }
  const metric = detail?.metric
  const valueLabel = metric ? (value) => formatMetricValue(metric, value) : displayScore
  return (
    <Drawer
      open={Boolean(detail)}
      placement="right"
      title={detail?.title ?? '量化详情'}
      size={typeof window === 'undefined' ? 720 : Math.min(720, window.innerWidth)}
      onClose={close}
      afterOpenChange={(open) => { if (!open) triggerRef.current?.focus?.() }}
      destroyOnClose
      className="analytics-detail-drawer"
    >
      {detail && (
        <div className="analytics-detail">
          <SummaryStats value={detail.currentValue} previous={detail.previousValue} coverage={detail.coverage} />
          {detail.periodLabel && <p className="analytics-muted">周期：{detail.periodLabel} · 空档保留为缺失值。</p>}
          {metric && metric.type !== 'boolean' && (
            <section className="analytics-detail__section">
              <h3>统计口径</h3>
              {detail.leaderSummary && <p className="analytics-muted">{detail.leaderSummary}</p>}
              <dl className="analytics-detail-facts">
                <div><dt>全公司均值</dt><dd>{valueLabel(detail.companyAverage)}</dd></div>
                <div><dt>合并口径结果</dt><dd>{valueLabel(detail.mergedValue)}</dd></div>
                <div><dt>合并分子</dt><dd>{detail.numerator ?? '—'}</dd></div>
                <div><dt>合并分母</dt><dd>{detail.denominator ?? '—'}</dd></div>
                <div><dt>样本量</dt><dd>{detail.sampleCount ?? '—'}</dd></div>
              </dl>
              <p className="analytics-muted">全公司均值按团队值算术平均；合并口径结果由团队原始量合并后重算，两者不可互换。</p>
            </section>
          )}
          {detail.rows && <section className="analytics-detail__section"><h3>团队分布</h3><DetailRows rows={detail.rows} valueLabel={valueLabel} /></section>}
          {detail.activityRows && <section className="analytics-detail__section"><h3>当前活动分布</h3><DetailRows rows={detail.activityRows} valueLabel={valueLabel} /></section>}
          {detail.metric?.id && onNavigate && <Button type="link" onClick={() => { close(); onNavigate(`/analytics/metrics/${detail.metric.id}`) }}>打开现有指标详情</Button>}
        </div>
      )}
    </Drawer>
  )
}

function metricSnapshot(data, metric, selectedPeriodId) {
  const periods = data?.periods ?? []
  const selectedPeriod = selectedPeriodId && selectedPeriodId !== 'all'
    ? periods.find((period) => String(period.id) === String(selectedPeriodId))
    : null
  const currentPeriod = selectedPeriodId === 'all' ? null : (selectedPeriod ?? periods.at(-1))
  const currentPeriodIndex = periods.findIndex((period) => String(period.id) === String(currentPeriod?.id))
  const previousPeriod = currentPeriodIndex > 0 ? periods[currentPeriodIndex - 1] : null
  const pointFor = (series, periodId) => series?.values?.find((point) => String(point.period_id) === String(periodId)) ?? null
  const teams = (data?.series ?? []).map((series) => ({
    teamId: series.team_id,
    teamName: series.team_name,
    point: pointFor(series, currentPeriod?.id),
  }))
  const previousValues = (data?.series ?? []).map((series) => pointFor(series, previousPeriod?.id)?.value).filter(hasFactValue)
  const currentValues = teams.map((team) => team.point?.value).filter(hasFactValue)
  const domainPoint = data?.domain_summary?.find((point) => String(point.period_id) === String(currentPeriod?.id))
  const companyAverage = data?.company_average?.find((point) => String(point.period_id) === String(currentPeriod?.id))?.value ?? null
  const previousCompanyAverage = data?.company_average?.find((point) => String(point.period_id) === String(previousPeriod?.id))?.value ?? null
  const numericTeams = teams.filter((team) => typeof team.point?.value === 'number' && Number.isFinite(team.point.value))
  const best = numericTeams.reduce((winner, team) => !winner || team.point.value > winner.point.value ? team : winner, null)
  const weakest = numericTeams.reduce((winner, team) => !winner || team.point.value < winner.point.value ? team : winner, null)
  return {
    currentPeriod,
    previousPeriod,
    teams,
    currentValues,
    currentValue: metric.type === 'boolean'
      ? (currentValues.filter(Boolean).length ? `${currentValues.filter(Boolean).length} 个团队具备` : '—')
      : formatMetricValue(metric, companyAverage),
    previousValue: metric.type === 'boolean'
      ? (previousValues.filter(Boolean).length ? `${previousValues.filter(Boolean).length} 个团队具备` : '—')
      : deltaText(companyAverage, previousCompanyAverage, (value) => formatMetricValue(metric, value)),
    companyAverage,
    previousCompanyAverage,
    domainPoint,
    coverage: coverageText(currentValues.length, data?.series?.length ?? 0),
    best,
    weakest,
  }
}

export function TrendCard({ activity, metric, data, error, loading, teams, teamColors, periodId, fallback, booleanTable = false, booleanRows, countAsBars = false }) {
  const selectedPeriodId = fallback ? 'all' : (periodId ?? 'all')
  const option = useMemo(() => data && !error && metric.type !== 'boolean'
    ? buildTrendOption({ data, metric, teamColors, selectedPeriodId, countAsBars })
    : null, [countAsBars, data, error, metric, selectedPeriodId, teamColors])
  const rows = booleanRows ?? booleanStatusRows(data, teams)
  return (
    <article className="overview-card">
      <header className="overview-card-header"><div className="overview-card-title-row"><h3>{activity.name}</h3><span className="overview-kind">{activity.kind === 'key' ? '关键' : '通用'}</span></div><p className="overview-metric-name">{metric.name}</p></header>
      {loading && <div className="overview-empty">正在更新指标数据…</div>}
      {!loading && error && <div className="overview-empty overview-error" role="alert">指标数据加载失败：{error.message}</div>}
      {!loading && !error && metric.type === 'boolean' && booleanTable && <div className="metric-detail-boolean-table-wrap"><table className="metric-detail-boolean-table"><thead><tr><th scope="col">团队</th><th scope="col">状态</th></tr></thead><tbody>{rows.map(({ team, value, state }) => <tr key={team.id}><th scope="row">{team.name}</th><td>{state === 'unknown' ? '暂无数据' : value ? '✓ 具备' : '✗ 不具备'}</td></tr>)}</tbody></table></div>}
      {!loading && !error && metric.type !== 'boolean' && !hasNumericValues(data) && <div className="overview-empty">所选窗口没有可展示的历史事实。</div>}
      {!loading && !error && metric.type !== 'boolean' && hasNumericValues(data) && <EChart option={option} height={300} ariaLabel={`${activity.name} ${metric.name} 团队趋势图`} />}
    </article>
  )
}

function BooleanStatusList({ rows, teamColors, onNavigate }) {
  return (
    <ul className="analytics-status-list" aria-label="团队布尔能力状态">
      {rows.map(({ team, value, state }) => (
        <li key={team.id}>
          <button type="button" onClick={() => onNavigate?.(`/analytics/teams/${team.id}`)} aria-label={`查看团队 ${team.name} 下钻`}>
            <span className="analytics-status-list__team"><i style={{ backgroundColor: teamColors[String(team.id)] }} />{team.name}</span>
            <span className={`analytics-status-list__state is-${state}`}>{state === 'unknown' ? '暂无数据' : value ? '具备' : '不具备'}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function MetricAnalysisCard({ activity, metric, data, error, loading, teams, teamColors, onOpen, onNavigate, granularity, dimension, periodId }) {
  const snapshot = metricSnapshot(data, metric, periodId)
  const selectedPeriodId = periodId === 'all' ? 'all' : (periodId ?? snapshot.currentPeriod?.id ?? 'all')
  const periodWasSelected = periodId !== null && periodId !== undefined && periodId !== 'all'
  const option = useMemo(() => data && !error && metric.type !== 'boolean'
    ? buildTrendOption({ data, metric, teamColors, selectedPeriodId })
    : null, [data, error, metric, selectedPeriodId, teamColors])
  const statusRows = useMemo(() => metric.type === 'boolean' ? booleanStatusRows(data, teams, periodWasSelected ? selectedPeriodId : null) : [], [data, metric.type, periodWasSelected, selectedPeriodId, teams])
  const knownStatuses = statusRows.filter((row) => row.state !== 'unknown').length
  const enabledTeams = statusRows.filter((row) => row.value === true).length
  const detail = {
    type: 'metric',
    title: `${activity.name} · ${metric.name}`,
    metric,
    currentValue: snapshot.currentValue,
    previousValue: snapshot.previousValue,
    companyAverage: snapshot.companyAverage,
    mergedValue: snapshot.domainPoint?.value,
    numerator: snapshot.domainPoint?.numerator,
    denominator: snapshot.domainPoint?.denominator,
    sampleCount: snapshot.domainPoint?.sample_count ?? snapshot.domainPoint?.fact_count,
    coverage: snapshot.coverage,
    periodLabel: snapshot.currentPeriod?.label,
    rows: snapshot.teams.map((team) => ({ teamId: team.teamId, teamName: team.teamName, value: team.point?.value ?? null })),
    leaderSummary: snapshot.best || snapshot.weakest ? `最佳 ${snapshot.best ? `${snapshot.best.teamName} · ${formatMetricValue(metric, snapshot.best.point.value)}` : '—'} · 相对靠后 ${snapshot.weakest ? `${snapshot.weakest.teamName} · ${formatMetricValue(metric, snapshot.weakest.point.value)}` : '—'}` : null,
  }
  const hasChartValue = hasNumericValues(data)
  const noCurrentValue = periodId !== 'all' && (metric.type === 'boolean' ? knownStatuses === 0 : snapshot.currentValues.length === 0)
  return (
    <article className="analytics-analysis-card">
      <header className="analytics-analysis-card__header"><div><h3>{metric.name}</h3><p>{metric.type === 'boolean' ? (periodWasSelected ? '逐团队展示所选周期状态；不生成趋势或全公司均值。' : '逐团队展示最近有效状态；不生成趋势或全公司均值。') : `全公司均值虚线 · ${dimension === 'iteration' ? '按版本/迭代' : `近 ${granularity === 'day' ? '30 天' : granularity === 'week' ? '12 周' : '6 个月'}`}`}</p></div><button type="button" onClick={() => onOpen(detail)}>查看量化详情</button></header>
      {loading && <div className="analytics-empty">正在加载指标数据…</div>}
      {!loading && error && <div className="analytics-empty analytics-empty--error" role="alert">指标加载失败：{error.message}</div>}
      {!loading && !error && metric.type !== 'boolean' && !hasChartValue && <div className="analytics-empty">近六个月没有可展示的历史事实。</div>}
      {!loading && !error && metric.type !== 'boolean' && hasChartValue && noCurrentValue && <div className="analytics-empty analytics-empty--current">当前周期暂无事实数据。</div>}
      {!loading && !error && metric.type === 'boolean' && <BooleanStatusList rows={statusRows} teamColors={teamColors} onNavigate={onNavigate} />}
      {!loading && !error && metric.type !== 'boolean' && option && hasChartValue && <EChart option={option} height={220} ariaLabel={`${activity.name} ${metric.name} 趋势图`} onClick={() => onOpen(detail)} />}
      {!loading && !error && data && metric.type === 'boolean' && knownStatuses > 0 && <div className="analytics-analysis-meta"><SummaryStats value={`${enabledTeams} 个团队具备`} previous="—" coverage={`${knownStatuses} / ${teams.length}`} /></div>}
      {!loading && !error && hasChartValue && metric.type !== 'boolean' && periodId === 'all' && <p className="analytics-muted">显示全部周期趋势；选择单一周期可查看当期团队比较。</p>}
      {!loading && !error && hasChartValue && data && metric.type !== 'boolean' && periodId !== 'all' && !noCurrentValue && <div className="analytics-analysis-meta"><SummaryStats value={snapshot.currentValue} previous={snapshot.previousValue} coverage={snapshot.coverage} /></div>}
      {onNavigate && <button type="button" className="analytics-detail-link" onClick={() => onNavigate(`/analytics/metrics/${metric.id}`)}>打开现有指标详情 →</button>}
    </article>
  )
}

function MaturityAnalysisCard({ activity, data, history, month, months, teams, teamColors, onOpen }) {
  const maturitySeries = buildActivityMaturitySeries({ history, activityId: activity.id, teams, months, teamColors })
  const hasHistory = maturitySeries.series.some((entry) => entry.values.some((value) => typeof value === 'number' && Number.isFinite(value)))
  const option = hasHistory ? lineOption({ periods: months.map((id) => ({ id, label: id.slice(5) })), series: maturitySeries.series }) : null
  const current = activitySummary(data, activity.id)
  const previous = activitySummary(history.at(-2)?.data, activity.id)
  const currentRows = teams.map((team) => {
    const cell = cellsForTeamMonth(data, team.id).find((item) => String(item.activity_id) === String(activity.id))
    return { teamId: team.id, teamName: team.name, value: cell?.score ?? null }
  })
  const detail = {
    type: 'maturity',
    title: `${activity.name} · 成熟度`,
    currentValue: displayScore(current?.score),
    previousValue: deltaText(current?.score, previous?.score),
    coverage: coverageText(current?.assessed_team_count ?? 0, data?.team_count ?? teams.length),
    periodLabel: month,
    rows: currentRows,
  }
  const scoredRows = currentRows.filter((row) => Number.isFinite(row.value)).sort((left, right) => right.value - left.value)
  return (
    <section className="analytics-maturity-summary" aria-label={`${activity.name}成熟度`}>
      <header className="analytics-maturity-summary__header">
        <div><p className="analytics-eyebrow">成熟度</p><strong>{displayScore(current?.score)}</strong></div>
        <span>环比 {deltaText(current?.score, previous?.score)}</span>
        <span>覆盖 {coverageText(current?.assessed_team_count ?? 0, data?.team_count ?? teams.length)}</span>
        {!hasFactValue(current?.score) && <span>当前月未评估</span>}
        {scoredRows.length > 0 && <span>最佳 {scoredRows[0].teamName} · 相对靠后 {scoredRows.at(-1).teamName}</span>}
        {!option && <span className="analytics-maturity-summary__empty">近六个月暂无历史评估</span>}
        <button type="button" className="analytics-maturity-summary__action" onClick={() => onOpen(detail)}>查看成熟度详情</button>
      </header>
      {option && <div className="analytics-maturity-summary__chart"><EChart option={option} height={160} ariaLabel={`${activity.name} 成熟度趋势图`} onClick={() => onOpen(detail)} /></div>}
    </section>
  )
}

function AnalysisPageHead({ title, description }) {
  return (
    <PageHeader
      className="analytics-page-head"
      title={title}
      description={description}
    />
  )
}

function AnalyticsFilterToolbar({ month, onMonthChange, granularity, onGranularityChange, showGranularity }) {
  return (
    <FilterToolbar label="分析筛选" className="analytics-filter-toolbar">
      <div className="analytics-page-controls">
        <label><span>分析月份</span><input aria-label="分析月份" type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} /></label>
        {showGranularity && <div className="analytics-granularity" role="group" aria-label="原始指标时间粒度"><span>时间粒度</span><div className="analytics-granularity__options">{[['month', '月'], ['week', '周'], ['day', '日']].map(([value, label]) => <button key={value} type="button" aria-pressed={granularity === value} className={granularity === value ? 'is-active' : ''} onClick={() => onGranularityChange(value)}>{label}</button>)}</div></div>}
      </div>
    </FilterToolbar>
  )
}

export function AnalyticsDetailPage({ kind, title, description, catalog = [], teams = [], versions = [], user, filter, onFilterChange, onNavigate, onSessionExpired, maturityState, onMaturityChange }) {
  const [localMonth, setLocalMonth] = useState(currentMonthId())
  const [localGranularity, setLocalGranularity] = useState(kind === 'general' && ['day', 'week', 'month'].includes(filter?.granularity) ? filter.granularity : 'month')
  const [selectedCapabilityId, setSelectedCapabilityId] = useState(null)
  const month = isValidMonth(maturityState?.month) ? maturityState.month : localMonth
  const metricDimension = kind === 'key' && filter?.dimension === 'iteration' ? 'iteration' : 'time'
  const granularity = kind === 'key' ? (filter?.granularity ?? 'month') : localGranularity
  const activities = useMemo(() => catalog.filter((activity) => activity.kind === kind), [catalog, kind])
  const metricOptions = useMemo(() => activities.flatMap((activity) => activity.metrics.map((metric) => ({ value: String(metric.id), label: `${activity.name} · ${metric.name}` }))), [activities])
  const selectedMetricId = kind === 'key' && filter?.metricId && filter.metricId !== 'all' ? String(filter.metricId) : null
  const selectedActivity = selectedMetricId ? activities.find((activity) => activity.metrics.some((metric) => String(metric.id) === selectedMetricId)) : null
  const selectedMetric = selectedActivity?.metrics.find((metric) => String(metric.id) === selectedMetricId) ?? null
  const visibleActivities = selectedMetric ? [selectedActivity] : activities
  const activitySectionIds = kind === 'key' ? visibleActivities.map((activity) => `analytics-activity-${activity.id}`) : []
  const maturity = useMaturityOverview(month, kind, onSessionExpired)
  const activeActivityId = useActiveSection(activitySectionIds, !maturity.loading && !maturity.error)
  const versionId = metricDimension === 'iteration' ? (filter?.versionId ?? 'all') : 'all'
  const metricFilter = useMemo(() => ({
    dimension: metricDimension,
    granularity: metricDimension === 'iteration' ? 'month' : granularity,
    versionId,
    periodId: kind === 'key' ? (filter?.periodId ?? null) : null,
    analysisMonth: month,
    windowLimit: metricDimension === 'iteration' ? undefined : granularity === 'day' ? 30 : granularity === 'week' ? 12 : 6,
  }), [filter?.periodId, granularity, kind, metricDimension, month, versionId])
  const metrics = useComputedMetrics(activities, metricFilter, onSessionExpired)
  const timePeriods = useMemo(() => {
    const data = selectedMetric ? metrics.data[selectedMetric.id] : Object.values(metrics.data).find((item) => item?.periods?.length)
    return data?.periods ?? []
  }, [metrics.data, selectedMetric])
  const periodOptions = useMemo(() => metricDimension === 'iteration' ? iterationPeriods(versions ?? [], versionId) : timePeriods, [metricDimension, timePeriods, versionId, versions])
  const months = monthWindow(month, 6)
  const teamColors = colorSlotsForTeams(teams)
  const drawer = useDetailDrawer()
  const selectedCapability = activities.find((activity) => String(activity.id) === String(selectedCapabilityId)) ?? activities[0] ?? null

  useEffect(() => {
    if (!activities.some((activity) => String(activity.id) === String(selectedCapabilityId))) {
      setSelectedCapabilityId(activities[0]?.id ?? null)
    }
  }, [activities, selectedCapabilityId])

  useEffect(() => {
    if (kind !== 'key' || !periodOptions.length || !onFilterChange) return
    const ids = new Set(periodOptions.map((period) => String(period.id)))
    if (filter?.periodId === null || filter?.periodId === undefined || (filter.periodId !== 'all' && !ids.has(String(filter.periodId)))) {
      onFilterChange({ ...(filter ?? {}), periodId: latestPeriodId(periodOptions) }, { history: 'replace' })
    }
  }, [filter, kind, onFilterChange, periodOptions])

  useEffect(() => {
    if (kind !== 'key' || !selectedMetricId || selectedMetric || !onFilterChange) return
    onFilterChange({ ...(filter ?? {}), metricId: 'all', periodId: null }, { history: 'replace' })
  }, [filter, kind, onFilterChange, selectedMetric, selectedMetricId])

  function changeMonth(nextMonth) {
    setLocalMonth(nextMonth)
    if (isValidMonth(nextMonth)) onMaturityChange?.({ ...(maturityState ?? {}), month: nextMonth }, { history: 'push' })
  }

  function changeGranularity(nextGranularity) {
    setLocalGranularity(nextGranularity)
    onFilterChange?.({ ...(filter ?? {}), dimension: 'time', granularity: nextGranularity, versionId: 'all', periodId: null }, { history: 'push' })
  }

  return (
    <div className="analytics-page">
      <AnalysisPageHead title={title} description={description} />
      {kind === 'key'
        ? <FilterBar filter={filter ?? { dimension: 'time', granularity: 'month', versionId: 'all', periodId: null, metricId: 'all' }} onChange={onFilterChange ?? (() => undefined)} versions={versions ?? []} periods={timePeriods} loading={metrics.loading} month={month} onMonthChange={changeMonth} metricOptions={metricOptions} />
        : <AnalyticsFilterToolbar month={month} onMonthChange={changeMonth} granularity={granularity} onGranularityChange={changeGranularity} showGranularity />}
      <div className="analytics-page-note">成熟度按自然月计算；原始指标按所选维度、周期查看，缺失保留断点，不插值、不补零。当前角色：{user?.role ?? 'viewer'}。</div>
      {kind === 'key' && !maturity.loading && !maturity.error && visibleActivities.length > 0 && <nav className="analytics-activity-navigator" aria-label="活动导航">
        {visibleActivities.map((activity) => {
          const id = `analytics-activity-${activity.id}`
          return <a key={activity.id} href={`#${id}`} aria-current={activeActivityId === id ? 'location' : undefined}>{activity.name}</a>
        })}
      </nav>}
      {maturity.loading && <div className="analytics-empty">正在加载成熟度历史…</div>}
      {maturity.error && <div className="analytics-empty analytics-empty--error" role="alert">成熟度加载失败：{maturity.error.message}</div>}
      {kind === 'general' && !maturity.loading && !maturity.error && selectedCapability && <div className="capability-workspace">
        <nav className="capability-directory" aria-label="能力结构">
          <header><h2>能力结构</h2><span>{activities.length} 项</span></header>
          {activities.map((activity) => <button key={activity.id} type="button" aria-label={`查看能力：${activity.name}`} aria-pressed={String(activity.id) === String(selectedCapability.id)} onClick={() => setSelectedCapabilityId(activity.id)}><span>{activity.name}</span><small>{activity.metrics.length} 项指标</small></button>)}
        </nav>
        <section className="capability-detail" aria-labelledby="capability-current-title">
          <header className="capability-detail__header"><div><h2 id="capability-current-title">{selectedCapability.name}</h2><p>{selectedCapability.metrics.length ? '当前状态 · 人工成熟度与目录原始指标。' : '当前目录没有原始指标；未评估状态保持为空。'}</p></div><span>{selectedCapability.metrics.length} 项指标</span></header>
          <section className="capability-detail__evolution" aria-label="成熟度演进"><header><h3>成熟度演进</h3></header><MaturityAnalysisCard activity={selectedCapability} data={maturity.data} history={maturity.history} month={month} months={months} teams={teams} teamColors={teamColors} onOpen={drawer.open} /></section>
          <section className="capability-detail__metrics" aria-label="能力当前状态与原始指标"><header><h3>原始指标 · 当前状态与趋势</h3></header><div className="analytics-metric-grid">{selectedCapability.metrics.map((metric) => <MetricAnalysisCard key={metric.id} activity={selectedCapability} metric={metric} data={metrics.data[metric.id]} error={metrics.errors[metric.id]} loading={metrics.loading} teams={teams} teamColors={teamColors} onOpen={drawer.open} onNavigate={onNavigate} granularity={granularity} dimension="time" />)}</div></section>
        </section>
      </div>}
      {kind === 'general' && !activities.length && !maturity.loading && !maturity.error && <div className="analytics-empty">当前目录没有可展示的通用研发能力。</div>}
      {!maturity.loading && !maturity.error && (
        kind === 'key' && <div className="analytics-activity-list">
          {visibleActivities.map((activity) => (
            <section key={activity.id} id={`analytics-activity-${activity.id}`} className="analytics-activity-section">
              <header className="analytics-activity-section__header"><div><h2>{activity.name}</h2></div><span>{selectedMetric ? '当前筛选指标' : `${activity.metrics.length} 个原始指标`}</span></header>
              <MaturityAnalysisCard activity={activity} data={maturity.data} history={maturity.history} month={month} months={months} teams={teams} teamColors={teamColors} onOpen={drawer.open} />
              <div className="analytics-metric-grid">{(selectedMetric ? activity.metrics.filter((metric) => String(metric.id) === selectedMetricId) : activity.metrics).map((metric) => <MetricAnalysisCard key={metric.id} activity={activity} metric={metric} data={metrics.data[metric.id]} error={metrics.errors[metric.id]} loading={metrics.loading} teams={teams} teamColors={teamColors} onOpen={drawer.open} onNavigate={onNavigate} granularity={granularity} dimension={metricDimension} periodId={filter?.periodId} />)}</div>
            </section>
          ))}
          {!activities.length && <div className="analytics-empty">当前目录没有可展示的关键研发活动。</div>}
        </div>
      )}
      <AnalyticsDetailDrawer detail={drawer.detail} triggerRef={drawer.triggerRef} onClose={drawer.close} onNavigate={onNavigate} />
    </div>
  )
}

function ExecutiveOverviewCard({ title, history = [], month, onOpen }) {
  const months = monthWindow(month, 6)
  const { values } = buildCategoryMaturitySeries({ history, months })
  const current = values.at(-1)
  const previous = values.at(-2)
  const data = history.at(-1)?.data
  const hasTrend = values.some((value) => typeof value === 'number' && Number.isFinite(value))
  const option = hasTrend ? lineOption({ periods: months.map((id) => ({ id, label: id.slice(5) })), series: [{ name: '领域平均', color: DATAVIZ_COLORS.companyAverage, dashed: true, values }] }) : null
  return <ChartCard title={title} eyebrow="整体成熟度" option={option} ariaLabel={`${title}近六个月趋势图`} onClick={() => onOpen({ type: 'overall', title, currentValue: displayScore(current), previousValue: deltaText(current, previous), coverage: coverageText(data?.assessed_cell_count ?? 0, data?.total_cell_count ?? 0), periodLabel: month, activityRows: (data?.activities ?? []).map((activity) => ({ teamId: activity.activity_id, teamName: activity.activity_name, value: activity.score })) })}>{hasTrend ? <SummaryStats value={displayScore(current)} previous={deltaText(current, previous)} coverage={coverageText(data?.assessed_cell_count ?? 0, data?.total_cell_count ?? 0)} /> : <div className="analytics-empty analytics-empty--current">近六个月暂无成熟度评估。</div>}</ChartCard>
}

function InlineSparkline({ label, values = [] }) {
  const numericValues = values.filter((value) => typeof value === 'number' && Number.isFinite(value))
  if (!numericValues.length) return null
  const min = Math.min(...numericValues)
  const max = Math.max(...numericValues)
  const point = (value, index) => [2 + (index / Math.max(1, values.length - 1)) * 72, max === min ? 12 : 22 - ((value - min) / (max - min)) * 20]
  const segments = []
  let currentSegment = []
  values.forEach((value, index) => {
    if (typeof value === 'number' && Number.isFinite(value)) currentSegment.push(point(value, index))
    else if (currentSegment.length) { segments.push(currentSegment); currentSegment = [] }
  })
  if (currentSegment.length) segments.push(currentSegment)
  return <svg className="metric-card__sparkline" viewBox="0 0 76 24" role="img" aria-label={label}>{segments.map((segment, index) => segment.length === 1 ? <circle key={index} cx={segment[0][0]} cy={segment[0][1]} r="2" /> : <polyline key={index} points={segment.map(([x, y]) => `${x},${y}`).join(' ')} />)}</svg>
}

function factSnapshot(row, data, month, teamCount) {
  const snapshot = factTrendSnapshot({ data, periodIds: monthWindow(month, 6), teamPoints: row?.teams ?? [] })
  const comparison = snapshot.validTeamCount
    ? `团队范围 ${formatMetricValue(row.metric, snapshot.teamMin)}–${formatMetricValue(row.metric, snapshot.teamMax)} · ${snapshot.validTeamCount}/${teamCount} 有效`
    : `当前月无团队事实 · 0/${teamCount} 有效`
  return { ...snapshot, value: formatMetricValue(row.metric, snapshot.current), comparison }
}

function ExecutiveOverallTrend({ rows, dataByMetric, month, onNavigate }) {
  const [metricId, setMetricId] = useState(null)
  const row = rows.find((item) => String(item.metric.id) === String(metricId)) ?? rows[0] ?? null
  useEffect(() => {
    if (!rows.some((item) => String(item.metric.id) === String(metricId))) setMetricId(rows[0]?.metric.id ?? null)
  }, [rows, metricId])
  const data = row ? dataByMetric[row.metric.id] : null
  const snapshot = row && data ? factSnapshot(row, data, month, row.totalTeamCount) : null
  const hasTrend = snapshot?.values.some((value) => typeof value === 'number' && Number.isFinite(value)) ?? false
  const option = row && data && hasTrend ? buildTrendOption({ data: { ...data, series: [] }, metric: row.metric, teamColors: {}, selectedPeriodId: 'all', averageLabel: '全公司均值' }) : null
  const action = row && <div className="executive-trend-actions"><label><span>指标</span><Select size="small" value={String(row.metric.id)} onChange={setMetricId} options={rows.map((item) => ({ value: String(item.metric.id), label: `${item.activity.name} · ${item.metric.name}` }))} /></label><Button type="link" onClick={() => onNavigate?.(`/analytics/metrics/${row.metric.id}`)}>查看指标详情</Button></div>
  return <AnalyticsPanel className="executive-analysis-grid__trend" title="核心指标趋势" description={row ? `${row.metric.name} · 全公司均值 · 近六个月` : '当前目录没有可用的核心数值指标'} action={action}>{!row ? <div className="analytics-empty">当前目录没有可展示的核心数值指标。</div> : !data ? <div className="analytics-empty">正在加载指标趋势…</div> : !hasTrend ? <div className="analytics-empty analytics-empty--current">近六个月暂无此指标事实。</div> : <EChart option={option} height={255} ariaLabel={`${row.metric.name}全公司均值近六个月趋势图`} onClick={() => onNavigate?.(`/analytics/metrics/${row.metric.id}`)} />}</AnalyticsPanel>
}

function rankingOption(row) {
  const teams = rankedTeams(row)
  const average = row?.company?.value
  return {
    animationDuration: 180,
    grid: { left: 12, right: 24, top: 12, bottom: 10, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (items) => {
      const item = Array.isArray(items) ? items[0] : items
      return `${item?.name ?? ''}：${formatMetricValue(row.metric, item?.value)}`
    } },
    xAxis: { type: 'value', axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 11, formatter: (value) => formatMetricValue(row.metric, value) }, splitLine: { lineStyle: { color: DATAVIZ_COLORS.grid } } },
    yAxis: { type: 'category', inverse: true, data: teams.map((team) => `${team.rank}. ${team.teamName}`), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: DATAVIZ_COLORS.inkSecondary, fontSize: 12 } },
    series: [{ type: 'bar', data: teams.map((team) => team.value), itemStyle: { color: DATAVIZ_COLORS.team[0], borderRadius: [0, 4, 4, 0] }, barMaxWidth: 22, markLine: Number.isFinite(average) ? { silent: true, symbol: 'none', lineStyle: { color: DATAVIZ_COLORS.companyAverage, type: 'dashed' }, label: { formatter: '全公司均值', color: DATAVIZ_COLORS.muted, fontSize: 11 }, data: [{ xAxis: average }] } : undefined }],
  }
}

function ExecutiveLifecycle({ rows, dataByMetric, month, teams = [], onNavigate }) {
  return (
    <section className="executive-lifecycle" aria-labelledby="lifecycle-title">
      <div className="executive-section-heading"><div><h2 id="lifecycle-title">研发生命周期</h2><span>各阶段独立显示目录指标，不比较不同单位的数值。</span></div><Button type="link" onClick={() => onNavigate?.('/analytics/activities')}>查看研发活动</Button></div>
      <div className="executive-lifecycle__list">
        {rows.map(({ stage, row }) => {
          const data = row ? dataByMetric[row.metric.id] : null
          const snapshot = row && data ? factSnapshot(row, data, month, teams.length) : null
          const statuses = row?.metric.type === 'boolean' ? row.teams.map((team) => team.point?.value).filter((value) => typeof value === 'boolean') : []
          const value = row?.metric.type === 'boolean'
            ? statuses.length ? `${statuses.filter(Boolean).length} / ${teams.length} 团队具备` : '暂无数据'
            : snapshot?.value ?? '暂无数据'
          return <button key={stage.id} type="button" className="executive-lifecycle__item" disabled={!row} onClick={() => row && onNavigate?.(`/analytics/metrics/${row.metric.id}`)}><span>{stage.label}</span><strong>{value}</strong><small>{row?.metric.name ?? '当前目录未配置对应指标'}{row?.metric.type === 'boolean' ? ' · 最近有效状态' : snapshot?.values.some((point) => point !== null) ? ` · 有效 ${snapshot.validTeamCount}/${teams.length}` : ''}</small>{row?.metric.type !== 'boolean' && snapshot && <InlineSparkline label={`${row.metric.name}近六个月趋势`} values={snapshot.values} />}</button>
        })}
      </div>
    </section>
  )
}

export function ExecutiveOverviewPage({ teams = [], catalog = [], maturityState, onMaturityChange, onNavigate, onSessionExpired }) {
  const [localMonth, setLocalMonth] = useState(currentMonthId())
  const month = isValidMonth(maturityState?.month) ? maturityState.month : localMonth
  const keyMaturity = useMaturityOverview(month, 'key', onSessionExpired)
  const generalMaturity = useMaturityOverview(month, 'general', onSessionExpired)
  const drawer = useDetailDrawer()
  const metrics = useComputedMetrics(catalog, { dimension: 'time', granularity: 'month', versionId: 'all', periodId: null, analysisMonth: month, windowLimit: 6 }, onSessionExpired)
  const metricRows = useMemo(() => buildMetricRows({ activities: catalog, dataByMetric: metrics.data, errors: metrics.errors, month, teams }), [catalog, metrics.data, metrics.errors, month, teams])
  const coverage = factCoverage(metricRows)
  const rankingRows = metricRows.filter((row) => row.metric.type !== 'boolean' && row.hasData)
  const [rankingMetricId, setRankingMetricId] = useState(null)
  const rankingRow = rankingRows.find((row) => String(row.metric.id) === String(rankingMetricId)) ?? rankingRows[0] ?? null
  const months = monthWindow(month, 6)
  const lifecycle = lifecycleRows(metricRows)
  const keyMaturityValues = buildCategoryMaturitySeries({ history: keyMaturity.history, months }).values
  const generalMaturityValues = buildCategoryMaturitySeries({ history: generalMaturity.history, months }).values
  const keyScore = keyMaturityValues.at(-1)
  const generalScore = generalMaturityValues.at(-1)
  const factKpiRows = executiveFactRows(metricRows, 2)
  const coreTrendRows = executiveFactRows(metricRows, 3)
  const maturityActivities = keyMaturity.data?.activities ?? []
  const maturitySeries = [{ name: '领域平均', color: DATAVIZ_COLORS.companyAverage, dashed: true, values: maturityActivities.map((activity) => activity.score) }]
  const missingSignals = [keyMaturity.data, generalMaturity.data].flatMap((data) => (data?.activities ?? []).filter((activity) => activity.score === null).map((activity) => ({ activity, kind: data.kind })))
  function changeMonth(nextMonth) {
    setLocalMonth(nextMonth)
    if (isValidMonth(nextMonth)) onMaturityChange?.({ ...(maturityState ?? {}), month: nextMonth }, { history: 'push' })
  }
  return (
    <div className="executive-overview analytics-page">
      <AnalysisPageHead title="研发总览" description="先看当前成熟度、事实覆盖与团队差异；仅展示已验证的团队事实和人工评估。" />
      <AnalyticsFilterToolbar month={month} onMonthChange={changeMonth} showGranularity={false} />
      <div className="executive-section-heading executive-section-heading--snapshot"><div><h2>管理摘要</h2></div><span>当前月事实覆盖 {metrics.loading ? '加载中' : `${coverage.available}/${coverage.total}`} 项指标</span></div>
      <section className="executive-kpi-grid" aria-label="管理摘要">
        <MetricCard label="关键活动成熟度" value={displayScore(keyScore)} detail={`环比 ${deltaText(keyScore, keyMaturityValues.at(-2))} · 覆盖 ${keyMaturity.data?.assessed_cell_count ?? 0}/${keyMaturity.data?.total_cell_count ?? 0}`} trend={<InlineSparkline label="关键活动成熟度近六个月趋势" values={keyMaturityValues} />} />
        <MetricCard label="通用能力成熟度" value={displayScore(generalScore)} detail={`环比 ${deltaText(generalScore, generalMaturityValues.at(-2))} · 覆盖 ${generalMaturity.data?.assessed_cell_count ?? 0}/${generalMaturity.data?.total_cell_count ?? 0}`} trend={<InlineSparkline label="通用能力成熟度近六个月趋势" values={generalMaturityValues} />} />
        {factKpiRows.map((row) => {
          const snapshot = metrics.data[row.metric.id] ? factSnapshot(row, metrics.data[row.metric.id], month, teams.length) : null
          return <MetricCard key={row.metric.id} label={`${row.activity.name} · ${row.metric.name}`} value={metrics.loading ? '—' : snapshot?.value ?? '—'} detail={metrics.loading ? '正在加载当前事实' : snapshot?.comparison ?? `当前月无事实 · 0/${teams.length} 有效`} trend={snapshot && <InlineSparkline label={`${row.metric.name}近六个月趋势`} values={snapshot.values} />} />
        })}
      </section>
      <p className="executive-fact-note">当前未配置业务 Target；各指标保留原单位，并只与同一指标的团队比较，不合并计分。</p>
      <div className="executive-analysis-grid">
        <ExecutiveOverallTrend rows={coreTrendRows} dataByMetric={metrics.data} month={month} onNavigate={onNavigate} />
        <AnalyticsPanel className="executive-analysis-grid__ranking" title="团队单指标排名" description={rankingRow ? `${rankingRow.metric.name} · 全公司均值虚线` : '当前月没有可排名的数值指标'} action={rankingRow && <label className="executive-ranking-select"><span>指标</span><Select size="small" value={String(rankingRow.metric.id)} onChange={setRankingMetricId} options={rankingRows.map((row) => ({ value: String(row.metric.id), label: `${row.activity.name} · ${row.metric.name}` }))} /></label>}>
          {rankingRow ? <EChart option={rankingOption(rankingRow)} height={260} ariaLabel={`${rankingRow.metric.name}团队单指标排名`} onClick={(params) => { const team = rankedTeams(rankingRow)[params.dataIndex]; if (team) onNavigate?.(`/analytics/teams/${team.teamId}`) }} onKeyActivate={() => { const team = rankedTeams(rankingRow)[0]; if (team) onNavigate?.(`/analytics/teams/${team.teamId}`) }} /> : <div className="analytics-empty">当前月没有可用于团队排名的数值事实。</div>}
        </AnalyticsPanel>
      </div>
      <ExecutiveLifecycle rows={lifecycle} dataByMetric={metrics.data} month={month} teams={teams} onNavigate={onNavigate} />
      <div className="executive-section-heading"><div><h2>成熟度</h2><span>关键活动与通用能力分别评估；未评估不补零。</span></div></div>
      {(keyMaturity.loading || generalMaturity.loading) && <div className="analytics-empty">正在加载近六个月成熟度…</div>}
      {(keyMaturity.error || generalMaturity.error) && <div className="analytics-empty analytics-empty--error" role="alert">成熟度历史加载失败：{(keyMaturity.error ?? generalMaturity.error).message}</div>}
      {!keyMaturity.loading && !generalMaturity.loading && !keyMaturity.error && !generalMaturity.error && <div className="executive-maturity-grid">
        <ExecutiveOverviewCard title="关键研发活动整体成熟度" history={keyMaturity.history} month={month} onOpen={drawer.open} />
        <ExecutiveOverviewCard title="通用研发能力整体成熟度" history={generalMaturity.history} month={month} onOpen={drawer.open} />
        <AnalyticsPanel title="关键活动能力画像" description="领域平均；未评估轴不补零。">
          <MaturityRadar activities={maturityActivities} series={maturitySeries} ariaLabel="关键研发活动领域成熟度画像" />
        </AnalyticsPanel>
      </div>}
      <div className="executive-summary-links"><Button onClick={() => onNavigate?.('/analytics/activities')}>研发活动摘要</Button><Button onClick={() => onNavigate?.('/analytics/capabilities')}>研发能力摘要</Button></div>
      <section className="analytics-signal-strip" aria-labelledby="analytics-signal-title"><div><h2 id="analytics-signal-title">当前成熟度覆盖</h2><p>{missingSignals.length ? `有 ${missingSignals.length} 个活动尚未完成当前月评估。` : '当前月活动均有成熟度记录。'}</p></div><button type="button" onClick={() => drawer.open({ type: 'overall', title: '当前成熟度覆盖', currentValue: missingSignals.length ? '存在缺失' : '已覆盖', previousValue: '—', coverage: `${keyMaturity.data?.assessed_cell_count ?? 0} + ${generalMaturity.data?.assessed_cell_count ?? 0} 个已评估单元`, activityRows: missingSignals.map(({ activity }) => ({ teamId: activity.activity_id, teamName: activity.activity_name, value: activity.score })) })}>查看量化详情</button></section>
      <AnalyticsDetailDrawer detail={drawer.detail} triggerRef={drawer.triggerRef} onClose={drawer.close} onNavigate={onNavigate} />
      {catalog.length === 0 && <p className="analytics-muted">当前目录为空，成熟度图表没有活动轴。</p>}
    </div>
  )
}

export function ActivitiesPage(props) {
  return <AnalyticsDetailPage {...props} kind="key" title="研发活动" description="按时间或版本迭代筛选研发指标；成熟度仍按单独选择的自然月评估。" />
}

export function CapabilitiesPage(props) {
  return <AnalyticsDetailPage {...props} kind="general" title="研发能力" description="按能力结构查看当前状态与演进；布尔能力按团队状态呈现，成熟度按自然月。" />
}

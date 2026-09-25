import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Select } from 'antd'

import AnalyticsPanel from '../components/AnalyticsPanel'
import { AnalyticsDirectory, AnalyticsSection, BenchmarkLegend, ChartCard, MaturityMatrix, TeamMatrix } from '../components/AnalyticsComponents'
import FilterToolbar from '../components/FilterToolbar'
import FocusRestoringDrawer from '../components/FocusRestoringDrawer'
import MetricKpiCard from '../components/MetricCard'
import PageHeader from '../components/PageHeader'
import EChart from '../components/EChart'
import FilterBar from '../overview/FilterBar'
import { hasNumericValues, useComputedMetrics } from '../overview/metricData'
import { buildTrendOption } from '../overview/chartOption'
import { executiveKpiRows, executiveMetricSummary, factCoverage, factTrendSnapshot, maturityMatrixData, metricDataForPeriods } from '../overview/executiveLogic'
import MaturityRadar from '../overview/MaturityRadar'
import { useMaturityOverview } from '../overview/maturityData'
import { booleanStatusRows } from '../metricDetail/metricDetailLogic'
import {
  DATAVIZ_COLORS,
  analysisWindowLabel,
  analysisWindowMonths,
  assignTeamColorSlots,
  buildMetricRows,
  currentMonthId,
  formatFactSummary,
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

function useColorSlotsForTeams(teams) {
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
      lineStyle: { width: 2.5, type: entry.dashed ? 'dashed' : 'solid', cap: 'round', join: 'round' },
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
    <FocusRestoringDrawer
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
    </FocusRestoringDrawer>
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

function teamDifferenceData(metrics, dataByMetric, periodId, teams, teamColors) {
  const numericMetrics = metrics.filter((metric) => metric.type !== 'boolean')
  const snapshots = numericMetrics.map((metric) => ({ metric, ...metricSnapshot(dataByMetric[metric.id], metric, periodId) }))
  return {
    columns: snapshots.map(({ metric }) => ({ id: metric.id, label: metric.name })),
    rows: [
      {
        id: 'company-average',
        label: '全公司均值',
        kind: 'average',
        values: snapshots.map(({ metric, companyAverage }) => ({ text: formatMetricValue(metric, companyAverage) })),
      },
      ...teams.map((team) => ({
        id: team.id,
        label: team.name,
        kind: 'team',
        color: teamColors[String(team.id)],
        values: snapshots.map(({ metric, teams: rows }) => ({
          text: formatMetricValue(metric, rows.find((row) => String(row.teamId) === String(team.id))?.point?.value),
        })),
      })),
    ],
  }
}

function MetricEvidenceTable({ metrics, dataByMetric, periodId }) {
  if (periodId === 'all') return <div className="analytics-empty">选择单一周期查看团队比较与合并原始量；全部周期只显示趋势。</div>
  if (!metrics.length) return <div className="analytics-empty">当前目录没有数值型原始指标。</div>
  return (
    <div className="analytics-detail-table-wrap">
      <table className="analytics-detail-table">
        <thead><tr><th scope="col">指标</th><th scope="col">全公司均值</th><th scope="col">合并口径结果</th><th scope="col">合并原始量</th><th scope="col">事实条数</th></tr></thead>
        <tbody>{metrics.map((metric) => {
          const snapshot = metricSnapshot(dataByMetric[metric.id], metric, periodId)
          const point = snapshot.domainPoint
          return <tr key={metric.id}>
            <th scope="row">{metric.name}</th>
            <td>{formatMetricValue(metric, snapshot.companyAverage)}</td>
            <td>{formatMetricValue(metric, point?.value)}</td>
            <td>{formatFactSummary(metric, point)}</td>
            <td>{point?.fact_count ?? '—'}</td>
          </tr>
        })}</tbody>
      </table>
    </div>
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

function AnalyticsFilterToolbar({ month, onMonthChange, granularity, onGranularityChange, showGranularity, cycle, onCycleChange, showCycle = false, versions = [], versionId = 'all', onVersionChange, showVersion = false }) {
  return (
    <FilterToolbar label="分析筛选" className="analytics-filter-toolbar">
      <div className="analytics-page-controls">
        <label><span>分析月份</span><input aria-label="分析月份" type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} /></label>
        {showCycle && <div className="analytics-cycle-control"><span>统计周期</span><div role="group" aria-label="统计周期">{[['6m', '近6个月'], ['half', '本半年度'], ['year', '年度累计']].map(([value, label]) => <Button key={value} size="small" type={cycle === value ? 'primary' : 'default'} aria-pressed={cycle === value} onClick={() => onCycleChange?.(value)}>{label}</Button>)}</div><small>截至 {month} · {analysisWindowLabel(month, cycle)}</small></div>}
        {showVersion && <label><span>版本</span><Select size="small" aria-label="版本" value={versionId} onChange={(value) => onVersionChange?.(value)} options={[{ value: 'all', label: '全部版本' }, ...versions.map((version) => ({ value: String(version.id), label: version.name }))]} /></label>}
        {showGranularity && <div className="analytics-granularity" role="group" aria-label="原始指标时间粒度"><span>时间粒度</span><div className="analytics-granularity__options">{[['month', '月'], ['week', '周'], ['day', '日']].map(([value, label]) => <button key={value} type="button" aria-pressed={granularity === value} className={granularity === value ? 'is-active' : ''} onClick={() => onGranularityChange(value)}>{label}</button>)}</div></div>}
      </div>
    </FilterToolbar>
  )
}

export function AnalyticsDetailPage({ kind, title, description, catalog = [], teams = [], versions = [], filter, onFilterChange, onNavigate, onSessionExpired, maturityState, onMaturityChange }) {
  const [localMonth, setLocalMonth] = useState(currentMonthId())
  const [localGranularity, setLocalGranularity] = useState(kind === 'general' && ['day', 'week', 'month'].includes(filter?.granularity) ? filter.granularity : 'month')
  const [selectedActivityId, setSelectedActivityId] = useState(null)
  const [selectedCapabilityId, setSelectedCapabilityId] = useState(null)
  const month = isValidMonth(maturityState?.month) ? maturityState.month : localMonth
  const metricDimension = kind === 'key' && filter?.dimension === 'iteration' ? 'iteration' : 'time'
  const granularity = kind === 'key' ? (filter?.granularity ?? 'month') : localGranularity
  const activities = useMemo(() => catalog.filter((activity) => activity.kind === kind), [catalog, kind])
  const metricOptions = useMemo(() => activities.flatMap((activity) => activity.metrics.map((metric) => ({ value: String(metric.id), label: `${activity.name} · ${metric.name}` }))), [activities])
  const selectedMetricId = kind === 'key' && filter?.metricId && filter.metricId !== 'all' ? String(filter.metricId) : null
  const selectedMetricActivity = selectedMetricId ? activities.find((activity) => activity.metrics.some((metric) => String(metric.id) === selectedMetricId)) : null
  const selectedMetric = selectedMetricActivity?.metrics.find((metric) => String(metric.id) === selectedMetricId) ?? null
  const selectedActivity = selectedMetricActivity ?? activities.find((activity) => String(activity.id) === String(selectedActivityId)) ?? activities[0] ?? null
  const selectedCapability = activities.find((activity) => String(activity.id) === String(selectedCapabilityId)) ?? activities[0] ?? null
  const activeMetrics = selectedActivity
    ? selectedMetricId && selectedMetricActivity && String(selectedActivity.id) === String(selectedMetricActivity.id)
      ? selectedActivity.metrics.filter((metric) => String(metric.id) === selectedMetricId)
      : selectedActivity.metrics
    : []
  const maturity = useMaturityOverview(month, kind, onSessionExpired, kind === 'general')
  const versionId = kind === 'key' ? (filter?.versionId ?? 'all') : 'all'
  const metricFilter = useMemo(() => ({
    dimension: metricDimension,
    granularity: metricDimension === 'iteration' ? 'month' : granularity,
    versionId,
    periodId: kind === 'key' ? (filter?.periodId ?? null) : null,
    analysisMonth: month,
    windowLimit: metricDimension === 'iteration' ? undefined : granularity === 'day' ? 30 : granularity === 'week' ? 12 : 6,
  }), [filter?.periodId, granularity, kind, metricDimension, month, versionId])
  const metricActivities = useMemo(() => {
    const activity = kind === 'key' ? selectedActivity : selectedCapability
    return activity ? [activity] : []
  }, [kind, selectedActivity, selectedCapability])
  const metrics = useComputedMetrics(metricActivities, metricFilter, onSessionExpired)
  const timePeriods = useMemo(() => {
    const data = selectedMetric ? metrics.data[selectedMetric.id] : Object.values(metrics.data).find((item) => item?.periods?.length)
    return data?.periods ?? []
  }, [metrics.data, selectedMetric])
  const periodOptions = useMemo(() => metricDimension === 'iteration' ? iterationPeriods(versions ?? [], versionId) : timePeriods, [metricDimension, timePeriods, versionId, versions])
  const months = monthWindow(month, 6)
  const teamColors = useColorSlotsForTeams(teams)
  const drawer = useDetailDrawer()
  const metricPeriodId = kind === 'key'
    ? filter?.periodId ?? latestPeriodId(periodOptions)
    : latestPeriodId(timePeriods)
  const metricPeriodLabel = metricPeriodId === 'all'
    ? '全部周期'
    : periodOptions.find((period) => String(period.id) === String(metricPeriodId))?.label ?? String(metricPeriodId)
  const capabilityNumericMetrics = selectedCapability?.metrics.filter((metric) => metric.type !== 'boolean') ?? []
  const capabilityTeamDifference = teamDifferenceData(capabilityNumericMetrics, metrics.data, metricPeriodId, teams, teamColors)

  useEffect(() => {
    if (kind !== 'key') return
    if (!activities.some((activity) => String(activity.id) === String(selectedActivityId))) {
      setSelectedActivityId(activities[0]?.id ?? null)
    }
  }, [activities, kind, selectedActivityId])

  useEffect(() => {
    if (kind !== 'general') return
    if (!activities.some((activity) => String(activity.id) === String(selectedCapabilityId))) {
      setSelectedCapabilityId(activities[0]?.id ?? null)
    }
  }, [activities, kind, selectedCapabilityId])

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

  function selectActivity(activityId) {
    const nextActivity = activities.find((activity) => String(activity.id) === String(activityId))
    setSelectedActivityId(activityId)
    if (selectedMetricId && !nextActivity?.metrics.some((metric) => String(metric.id) === selectedMetricId)) {
      onFilterChange?.({ ...(filter ?? {}), metricId: 'all', periodId: null }, { history: 'push' })
    }
  }

  return (
    <div className="analytics-page">
      <AnalysisPageHead title={title} description={description} />
      {kind === 'key'
        ? <FilterBar filter={filter ?? { dimension: 'time', granularity: 'month', versionId: 'all', periodId: null, metricId: 'all' }} onChange={onFilterChange ?? (() => undefined)} versions={versions ?? []} periods={timePeriods} loading={metrics.loading} month={month} onMonthChange={changeMonth} metricOptions={metricOptions} />
        : <AnalyticsFilterToolbar month={month} onMonthChange={changeMonth} granularity={granularity} onGranularityChange={changeGranularity} showGranularity />}
      <div className="analytics-page-note">成熟度按自然月计算；原始指标按所选维度与周期查看。无事实保持缺失，不插值、不补零。</div>
      {kind === 'key' && selectedActivity && <div className="analytics-directory-workspace">
        <AnalyticsDirectory
          label="关键研发活动目录"
          title="活动目录"
          count={`${activities.length} 项`}
          className="activity-directory"
          items={activities.map((activity) => ({ id: activity.id, label: activity.name, ariaLabel: `选择活动：${activity.name}`, meta: `${activity.metrics.length} 个指标` }))}
          selectedId={selectedActivity.id}
          onSelect={selectActivity}
        />
        <div className="analytics-workspace">
          <AnalyticsSection title={selectedActivity.name} description="保留活动目录指标各自的业务名称、单位和团队口径。" />
          <AnalyticsSection title="核心成效" description={`当前周期 ${metricPeriodId === 'all' ? '选择全部周期' : metricPeriodLabel}；只显示该活动的目录指标。`}>
            {metricPeriodId === 'all'
              ? <div className="analytics-empty">已选择全部周期：保留趋势，不显示当前值快照。</div>
              : <div className="activity-outcome-grid">{activeMetrics.map((metric) => {
                const data = metrics.data[metric.id]
                const snapshot = metricSnapshot(data, metric, metricPeriodId)
                return <MetricKpiCard
                  key={metric.id}
                  label={metric.name}
                  value={snapshot.currentValue}
                  delta={`较前期 ${snapshot.previousValue}`}
                  comparison={`全公司均值 · 有效团队 ${snapshot.coverage}`}
                  trendValues={(data?.company_average ?? []).map((point) => point.value)}
                  trendLabel={`${selectedActivity.name} ${metric.name}趋势`}
                  accent={DATAVIZ_COLORS.metricType[metric.type] ?? DATAVIZ_COLORS.team[0]}
                  loading={metrics.loading}
                  error={metrics.errors[metric.id]?.message ? `指标加载失败：${metrics.errors[metric.id].message}` : undefined}
                />
              })}</div>}
          </AnalyticsSection>
          <AnalyticsSection title="核心趋势" description="每个图表只显示一个目录指标及同指标全公司均值。">
            <div className="activity-trend-grid">{activeMetrics.map((metric) => <MetricAnalysisCard
              key={metric.id}
              activity={selectedActivity}
              metric={metric}
              data={metrics.data[metric.id]}
              error={metrics.errors[metric.id]}
              loading={metrics.loading}
              teams={teams}
              teamColors={teamColors}
              onOpen={drawer.open}
              onNavigate={onNavigate}
              granularity={granularity}
              dimension={metricDimension}
              periodId={metricPeriodId}
            />)}</div>
          </AnalyticsSection>
          <AnalyticsSection title="团队差异" description={`周期 ${metricPeriodLabel} · 每列仍是独立目录指标。`}>
            {metrics.loading
              ? <div className="analytics-empty" role="status">正在加载当前周期团队差异…</div>
              : metricPeriodId === 'all'
              ? <div className="analytics-empty">选择单一周期查看团队差异。</div>
              : <TeamMatrix label={`${selectedActivity.name} ${metricPeriodLabel} 团队差异`} {...teamDifferenceData(activeMetrics, metrics.data, metricPeriodId, teams, teamColors)} />}
          </AnalyticsSection>
          <AnalyticsSection title="业务量与原始指标" description={`周期 ${metricPeriodLabel} · 全公司均值与合并原始量是不同口径。`}>
            {metrics.loading
              ? <div className="analytics-empty" role="status">正在加载周期原始量…</div>
              : <MetricEvidenceTable metrics={activeMetrics} dataByMetric={metrics.data} periodId={metricPeriodId} />}
          </AnalyticsSection>
        </div>
      </div>}
      {kind === 'general' && selectedCapability && <div className="analytics-directory-workspace">
        <AnalyticsDirectory
          label="能力结构目录"
          title="能力结构"
          count={`${activities.length} 项`}
          items={activities.map((activity) => ({ id: activity.id, label: activity.name, ariaLabel: `查看能力：${activity.name}`, meta: `${activity.metrics.length} 项指标` }))}
          selectedId={selectedCapability.id}
          onSelect={setSelectedCapabilityId}
        />
        <div className="analytics-workspace">
          <AnalyticsSection title={selectedCapability.name} description="能力状态由目录实际指标类型决定；布尔状态不合并为比例。" />
          <AnalyticsSection title="能力状态" description={`周期 ${metricPeriodLabel} · 数值保持各自目录单位。`}>
            {metrics.loading && <div className="analytics-empty" role="status">正在加载能力状态…</div>}
            {!metrics.loading && capabilityNumericMetrics.length > 0 && <div className="analytics-detail-table-wrap">
              <table className="analytics-detail-table capability-status-table">
                <thead><tr><th scope="col">指标</th><th scope="col">类型</th><th scope="col">当前值</th><th scope="col">有效团队</th></tr></thead>
                <tbody>{capabilityNumericMetrics.map((metric) => {
                const snapshot = metricSnapshot(metrics.data[metric.id], metric, metricPeriodId)
                const typeLabel = { penetration: '渗透率', efficiency: '效率', ratio: '比例', count: '数量' }[metric.type] ?? metric.type
                return <tr key={metric.id}><th scope="row">{metric.name}</th><td>{typeLabel}</td><td>{snapshot.currentValue}</td><td>{snapshot.coverage}</td></tr>
                })}</tbody>
              </table>
            </div>}
            {!metrics.loading && selectedCapability.metrics.filter((metric) => metric.type === 'boolean').map((metric) => <section className="capability-boolean-status" key={metric.id} aria-label={`${metric.name}团队状态`}>
              <header><h3>{metric.name}</h3><Button type="link" onClick={() => onNavigate?.(`/analytics/metrics/${metric.id}`)}>打开指标详情 →</Button></header>
              <BooleanStatusList rows={booleanStatusRows(metrics.data[metric.id], teams)} teamColors={teamColors} onNavigate={onNavigate} />
            </section>)}
            {!selectedCapability.metrics.length && <div className="analytics-empty">当前能力没有原始指标；成熟度仍按自然月评估。</div>}
          </AnalyticsSection>
          <AnalyticsSection title="能力演进" description="成熟度与每个原始指标分别演进，不把不同指标拼成单一趋势。">
            <div className="capability-evolution-grid">{selectedCapability.metrics.filter((metric) => metric.type !== 'boolean').map((metric) => <MetricAnalysisCard
              key={metric.id}
              activity={selectedCapability}
              metric={metric}
              data={metrics.data[metric.id]}
              error={metrics.errors[metric.id]}
              loading={metrics.loading}
              teams={teams}
              teamColors={teamColors}
              onOpen={drawer.open}
              onNavigate={onNavigate}
              granularity={granularity}
              dimension="time"
              periodId={metric.type === 'boolean' ? null : metricPeriodId}
            />)}
              {!capabilityNumericMetrics.length && <div className="analytics-empty">该能力以团队布尔状态呈现；不绘制 0/1 时间趋势。</div>}
            </div>
          </AnalyticsSection>
          <AnalyticsSection title="团队差异" description={`周期 ${metricPeriodLabel} · 数值指标逐列比较；布尔能力继续按团队状态列出。`}>
            {metrics.loading
              ? <div className="analytics-empty" role="status">正在加载团队差异…</div>
              : capabilityTeamDifference.columns.length > 0
              ? <TeamMatrix label={`${selectedCapability.name} ${metricPeriodLabel} 团队差异`} {...capabilityTeamDifference} />
              : <div className="analytics-empty">该能力没有可取平均的数值指标；布尔状态保持逐团队展示。</div>}
          </AnalyticsSection>
          <AnalyticsSection title="证据与原始量" description="合并口径结果、团队均值与原始分子/分母保持分开。">
            {metrics.loading
              ? <div className="analytics-empty" role="status">正在加载原始量证据…</div>
              : capabilityNumericMetrics.length
              ? <MetricEvidenceTable metrics={capabilityNumericMetrics} dataByMetric={metrics.data} periodId={metricPeriodId} />
              : <div className="analytics-empty">布尔能力以逐团队状态和指标详情作为证据，不生成合并计数或均值。</div>}
          </AnalyticsSection>
          <AnalyticsSection title="成熟度画像" description="人工月度评估与指标事实分开；未评估保持为空。">
            {maturity.loading && <div className="analytics-empty" role="status">正在加载成熟度历史…</div>}
            {maturity.error && <div className="analytics-empty analytics-empty--error" role="alert">成熟度加载失败：{maturity.error.message}</div>}
            {!maturity.loading && !maturity.error && <MaturityAnalysisCard activity={selectedCapability} data={maturity.data} history={maturity.history} month={month} months={months} teams={teams} teamColors={teamColors} onOpen={drawer.open} />}
          </AnalyticsSection>
        </div>
      </div>}
      {kind === 'general' && !activities.length && <div className="analytics-empty">当前目录没有可展示的通用研发能力。</div>}
      <AnalyticsDetailDrawer detail={drawer.detail} triggerRef={drawer.triggerRef} onClose={drawer.close} onNavigate={onNavigate} />
    </div>
  )
}

function factSnapshot(row, data, month, teamCount) {
  const snapshot = factTrendSnapshot({ data, periodIds: monthWindow(month, 6), teamPoints: row?.teams ?? [] })
  const comparison = snapshot.validTeamCount
    ? `团队范围 ${formatMetricValue(row.metric, snapshot.teamMin)}–${formatMetricValue(row.metric, snapshot.teamMax)} · ${snapshot.validTeamCount}/${teamCount} 有效`
    : `当前月无团队事实 · 0/${teamCount} 有效`
  return { ...snapshot, value: formatMetricValue(row.metric, snapshot.current), comparison }
}

function ExecutiveOverallTrend({ rows, dataByMetric, periodIds, teamColors, onNavigate }) {
  const [metricId, setMetricId] = useState(null)
  const row = rows.find((item) => String(item.metric.id) === String(metricId)) ?? rows[0] ?? null
  useEffect(() => {
    if (!rows.some((item) => String(item.metric.id) === String(metricId))) setMetricId(rows[0]?.metric.id ?? null)
  }, [rows, metricId])
  const rawData = row ? dataByMetric[row.metric.id] : null
  const data = rawData ? metricDataForPeriods(rawData, periodIds) : null
  const hasTrend = hasNumericValues(data)
  const trendOption = row && data && hasTrend ? buildTrendOption({ data, metric: row.metric, teamColors, selectedPeriodId: 'all', averageLabel: '全公司均值' }) : null
  const option = trendOption ? { ...trendOption, legend: { ...trendOption.legend, data: data.series.map((series) => series.team_name) } } : null
  const action = <div className="executive-trend-actions" role="group" aria-label="核心指标">
    {rows.map((item) => <button key={item.metric.id} type="button" aria-label={`${item.activity.name} · ${item.metric.name}`} aria-pressed={String(item.metric.id) === String(row?.metric.id)} onClick={() => setMetricId(item.metric.id)}>{item.metric.name}</button>)}
    {row && <Button type="link" onClick={() => onNavigate?.(`/analytics/metrics/${row.metric.id}`)}>查看指标详情</Button>}
  </div>
  return <AnalyticsPanel className="executive-overall-trend" title="核心指标趋势" description={row ? `${row.activity.name} · ${row.metric.name} · 团队与全公司均值` : '当前目录没有可用的核心数值指标'} action={action}>{!row ? <div className="analytics-empty">当前目录没有可展示的核心数值指标。</div> : !rawData ? <div className="analytics-empty">正在加载指标趋势…</div> : !hasTrend ? <div className="analytics-empty analytics-empty--current">当前周期暂无此指标事实。</div> : <><div className="executive-overall-benchmark"><BenchmarkLegend /><span>团队系列可在图例中显隐</span></div><EChart option={option} height={300} ariaLabel={`${row.activity.name}${row.metric.name}团队与全公司均值趋势图`} onClick={() => onNavigate?.(`/analytics/metrics/${row.metric.id}`)} /></>}</AnalyticsPanel>
}

function ExecutiveLifecycle({ activities = [], metricRows = [], dataByMetric, errors = {}, month, periodIds = [], teams = [], teamColors = {}, onNavigate }) {
  const [selectedActivityId, setSelectedActivityId] = useState(null)
  const keyActivities = activities.filter((activity) => activity.kind === 'key')
  const selectedActivity = keyActivities.find((activity) => String(activity.id) === String(selectedActivityId)) ?? keyActivities[0] ?? null
  useEffect(() => {
    if (!activities.some((activity) => activity.kind === 'key' && String(activity.id) === String(selectedActivityId))) {
      setSelectedActivityId(activities.find((activity) => activity.kind === 'key')?.id ?? null)
    }
  }, [activities, selectedActivityId])

  return (
    <AnalyticsSection className="executive-lifecycle" title="关键研发活动" description="每项活动按真实目录指标分别展示，不合并不同单位。" action={<Button type="link" onClick={() => onNavigate?.('/analytics/activities')}>查看研发活动</Button>}>
      <div className="executive-lifecycle__list" role="group" aria-label="选择关键研发活动">
        {keyActivities.map((activity) => <button key={activity.id} type="button" className="executive-lifecycle__item" aria-pressed={String(activity.id) === String(selectedActivity?.id)} onClick={() => setSelectedActivityId(activity.id)}>
          <strong>{activity.name}</strong>
          {activity.metrics.map((metric) => {
            const row = metricRows.find((item) => String(item.metric.id) === String(metric.id))
            const snapshot = row && dataByMetric[metric.id] ? factSnapshot(row, dataByMetric[metric.id], month, teams.length) : null
            return <span className="executive-lifecycle__metric" key={metric.id}><small>{metric.name}</small><b>{snapshot?.value ?? '—'}</b></span>
          })}
        </button>)}
      </div>
      {selectedActivity && <div className="executive-lifecycle__detail">
        <header><h3>{selectedActivity.name} · 趋势</h3><span>团队与全公司均值</span></header>
        <div className="executive-lifecycle__trend-grid">
          {selectedActivity.metrics.map((metric) => {
            const rawData = dataByMetric[metric.id]
            const data = rawData ? metricDataForPeriods(rawData, periodIds) : null
            const hasTrend = hasNumericValues(data)
            const option = data && hasTrend ? buildTrendOption({ data, metric, teamColors, selectedPeriodId: 'all', averageLabel: '全公司均值' }) : null
            return <ChartCard key={metric.id} title={`${selectedActivity.name} · ${metric.name}`} description="同一指标，团队系列与全公司均值。" option={option} height={220} ariaLabel={`${selectedActivity.name}${metric.name}团队与全公司均值趋势图`} error={errors[metric.id] ? `指标加载失败：${errors[metric.id].message}` : undefined} empty={`当前统计周期暂无${metric.name}事实。`} onClick={() => onNavigate?.(`/analytics/metrics/${metric.id}`)} />
          })}
        </div>
      </div>}
    </AnalyticsSection>
  )
}

export function ExecutiveOverviewPage({ teams = [], catalog = [], versions = [], filter = {}, maturityState, onFilterChange, onMaturityChange, onNavigate, onSessionExpired }) {
  const [localMonth, setLocalMonth] = useState(currentMonthId())
  const month = isValidMonth(maturityState?.month) ? maturityState.month : localMonth
  const maturityCategory = maturityState?.category === 'general' ? 'general' : 'key'
  const cycle = ['half', 'year'].includes(filter?.cycle) ? filter.cycle : '6m'
  const versionId = filter?.versionId ?? 'all'
  const selectedMaturity = useMaturityOverview(month, maturityCategory, onSessionExpired)
  const metrics = useComputedMetrics(catalog, { dimension: 'time', granularity: 'month', versionId, periodId: null, analysisMonth: month, windowLimit: 12 }, onSessionExpired)
  const metricRows = useMemo(() => buildMetricRows({ activities: catalog, dataByMetric: metrics.data, errors: metrics.errors, month, teams }), [catalog, metrics.data, metrics.errors, month, teams])
  const scopedMetricRows = versionId === 'all' ? metricRows : metricRows.filter((row) => row.activity.kind === 'key')
  const coverage = factCoverage(scopedMetricRows)
  const coreMetricRows = executiveKpiRows(metricRows)
  const monthlyTrendMonths = monthWindow(month, 6)
  const periodMonths = analysisWindowMonths(month, cycle)
  const periodLabel = analysisWindowLabel(month, cycle)
  const teamColors = useColorSlotsForTeams(teams)
  const metricSummaries = new Map(coreMetricRows.map((row) => [String(row.metric.id), executiveMetricSummary({ data: metrics.data[row.metric.id], metric: row.metric, month, monthTrendIds: monthlyTrendMonths, periodIds: periodMonths })]))
  const [teamView, setTeamView] = useState('month')
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  useEffect(() => {
    if (!teams.some((team) => String(team.id) === String(selectedTeamId))) setSelectedTeamId(teams[0]?.id ?? null)
  }, [teams, selectedTeamId])
  const selectedTeam = teams.find((team) => String(team.id) === String(selectedTeamId)) ?? null
  const teamMatrixColumns = coreMetricRows.map((row) => ({ id: row.metric.id, label: row.metric.name, context: row.activity.name }))
  const teamMatrixRows = [
    {
      id: 'company-average',
      label: '全公司均值',
      kind: 'average',
      values: coreMetricRows.map((row) => ({ text: formatMetricValue(row.metric, teamView === 'month' ? row.company?.value : metricSummaries.get(String(row.metric.id))?.periodValue) })),
    },
    ...teams.map((team) => ({
      id: team.id,
      label: team.name,
      kind: 'team',
      color: teamColors[String(team.id)],
      values: coreMetricRows.map((row) => {
        const value = teamView === 'month'
          ? row.teams.find((item) => String(item.teamId) === String(team.id))?.point?.value
          : metricSummaries.get(String(row.metric.id))?.periodTeams.find((item) => String(item.teamId) === String(team.id))?.value
        return { text: formatMetricValue(row.metric, value) }
      }),
    })),
  ]
  const previewRows = coreMetricRows.filter((row) => ['penetration', 'efficiency'].includes(row.metric.type)).slice(0, 2)
  const maturityActivities = selectedMaturity.data?.activities ?? []
  const previousMaturityActivities = new Map((selectedMaturity.history.at(-2)?.data?.activities ?? []).map((activity) => [String(activity.activity_id), activity]))
  const maturityMatrix = maturityMatrixData(selectedMaturity.data)
  const maturitySeries = [
    { name: `本期领域平均 · ${month}`, color: DATAVIZ_COLORS.team[0], values: maturityActivities.map((activity) => activity.score) },
    { name: `上期领域平均 · ${monthlyTrendMonths.at(-2) ?? '—'}`, color: DATAVIZ_COLORS.companyAverage, dashed: true, values: maturityActivities.map((activity) => previousMaturityActivities.get(String(activity.activity_id))?.score ?? null) },
  ]

  function changeMonth(nextMonth) {
    setLocalMonth(nextMonth)
    if (isValidMonth(nextMonth)) onMaturityChange?.({ ...(maturityState ?? {}), month: nextMonth }, { history: 'push' })
  }

  function changeCycle(nextCycle) {
    onFilterChange?.({ ...(filter ?? {}), dimension: 'time', granularity: 'month', periodId: null, metricId: 'all', cycle: nextCycle }, { history: 'push' })
  }

  function changeVersion(nextVersion) {
    onFilterChange?.({ ...(filter ?? {}), dimension: 'time', granularity: 'month', versionId: nextVersion, periodId: null, metricId: 'all' }, { history: 'push' })
  }

  function changeMaturityCategory(category) {
    if (category !== maturityCategory) onMaturityChange?.({ ...(maturityState ?? {}), category }, { history: 'push' })
  }

  function metricDelta(metric, delta, prefix) {
    if (!Number.isFinite(delta)) return `${prefix} —`
    const formatted = formatMetricValue(metric, delta)
    const signed = delta > 0 && !String(formatted).startsWith('+') ? `+${formatted}` : formatted
    return `${prefix} ${signed}`
  }

  return (
    <div className="executive-overview analytics-page">
      <AnalysisPageHead title="研发总览" description="按用户选择月份与统计周期查看目录指标；各指标保持原活动、单位和团队比较口径。" />
      <AnalyticsFilterToolbar month={month} onMonthChange={changeMonth} showGranularity={false} showCycle cycle={cycle} onCycleChange={changeCycle} showVersion versions={versions} versionId={versionId} onVersionChange={changeVersion} />
      <AnalyticsSection title={`月度核心成效 · ${month}`} description="每张卡展示一个目录指标；名称保留所属活动，不合并不同指标。" action={<span className="executive-kpi-coverage">当前月事实覆盖 {metrics.loading ? '加载中' : `${coverage.available}/${coverage.total}`} 项指标</span>}>
        <div className="executive-kpi-grid" aria-label="月度核心目录指标">
          {coreMetricRows.map((row) => {
            const summary = metricSummaries.get(String(row.metric.id))
            return <MetricKpiCard key={row.metric.id} label={`${row.activity.name} · ${row.metric.name}`} value={formatMetricValue(row.metric, summary?.monthValue)} delta={metricDelta(row.metric, summary?.monthDelta, '环比')} comparison={`全公司均值 · 有效团队 ${row.validTeamCount}/${teams.length}`} trendValues={summary?.monthTrend ?? []} trendLabel={`${row.activity.name} ${row.metric.name}近六个月趋势`} accent={DATAVIZ_COLORS.metricType[row.metric.type] ?? DATAVIZ_COLORS.team[0]} loading={metrics.loading} error={metrics.errors[row.metric.id]?.message ? `指标加载失败：${metrics.errors[row.metric.id].message}` : undefined} />
          })}
        </div>
      </AnalyticsSection>
      <p className="executive-fact-note">当前未配置业务 Target 或外部基准；“全公司均值”按同一目录指标的有效团队等权计算。周期比例与效率先汇总该指标原始量再计算，数量周期变化显示本月新增。</p>
      <AnalyticsSection title={`周期整体成效 · ${periodLabel}（截至${month}）`} description="周期值由当前周期起点累计到所选月份；各卡仍对应单一目录指标。">
        <div className="executive-kpi-grid" aria-label="统计周期目录指标">
          {coreMetricRows.map((row) => {
            const summary = metricSummaries.get(String(row.metric.id))
            const deltaPrefix = row.metric.type === 'count' ? '本月新增' : '纳入本月变化'
            return <MetricKpiCard key={row.metric.id} label={`${row.activity.name} · ${row.metric.name}`} value={formatMetricValue(row.metric, summary?.periodValue)} delta={metricDelta(row.metric, summary?.periodDelta, deltaPrefix)} comparison={`全公司均值 · ${periodLabel}截至 ${month}`} trendValues={summary?.periodTrend ?? []} trendLabel={`${row.activity.name} ${row.metric.name}${periodLabel}累计趋势`} accent={DATAVIZ_COLORS.metricType[row.metric.type] ?? DATAVIZ_COLORS.team[0]} loading={metrics.loading} error={metrics.errors[row.metric.id]?.message ? `指标加载失败：${metrics.errors[row.metric.id].message}` : undefined} />
          })}
        </div>
      </AnalyticsSection>
      <ExecutiveOverallTrend rows={coreMetricRows} dataByMetric={metrics.data} periodIds={periodMonths} teamColors={teamColors} onNavigate={onNavigate} />
      <ExecutiveLifecycle activities={catalog} metricRows={metricRows} dataByMetric={metrics.data} errors={metrics.errors} month={month} periodIds={periodMonths} teams={teams} teamColors={teamColors} onNavigate={onNavigate} />
      <AnalyticsSection className="executive-team-section" title="团队表现" description="矩阵各列保持独立目录指标；选择团队后查看其渗透率与效率趋势。" action={<div className="executive-team-mode" role="group" aria-label="团队表现统计范围"><Button size="small" type={teamView === 'month' ? 'primary' : 'default'} aria-pressed={teamView === 'month'} onClick={() => setTeamView('month')}>本月</Button><Button size="small" type={teamView === 'cycle' ? 'primary' : 'default'} aria-pressed={teamView === 'cycle'} onClick={() => setTeamView('cycle')}>统计周期</Button></div>}>
        {teamMatrixColumns.length
          ? <TeamMatrix label={`团队表现 · ${teamView === 'month' ? month : `${periodLabel}截至${month}`}`} columns={teamMatrixColumns} rows={teamMatrixRows} selectedId={selectedTeam?.id} onSelect={setSelectedTeamId} />
          : <div className="analytics-empty">当前目录没有可展示的数值指标。</div>}
        {selectedTeam && <div className="executive-team-preview">
          <header><h3>{selectedTeam.name} · 趋势预览</h3><Button type="link" onClick={() => onNavigate?.(`/analytics/teams/${selectedTeam.id}`)}>查看团队详情 →</Button></header>
          <div className="executive-team-preview__charts">
            {previewRows.map((row) => {
              const rawData = metrics.data[row.metric.id]
              const data = rawData ? metricDataForPeriods(rawData, periodMonths) : null
              const series = data?.series?.filter((item) => String(item.team_id) === String(selectedTeam.id)) ?? []
              const selectedData = data ? { ...data, series } : null
              const option = selectedData && hasNumericValues(selectedData) ? { ...buildTrendOption({ data: selectedData, metric: row.metric, teamColors, selectedPeriodId: 'all', averageLabel: '全公司均值' }), legend: { show: false } } : null
              const teamColor = teamColors[String(selectedTeam.id)] ?? DATAVIZ_COLORS.team[0]
              return <ChartCard key={row.metric.id} title={`${selectedTeam.name} · ${row.activity.name} ${row.metric.name}`} description="当前团队对照全公司同指标均值。" action={<div className="executive-team-preview__legend"><span><i style={{ '--team-matrix-color': teamColor }} />{selectedTeam.name}</span><BenchmarkLegend /></div>} option={option} height={230} ariaLabel={`${selectedTeam.name} ${row.metric.name}与全公司均值趋势`} empty={`当前统计周期暂无${row.metric.name}事实。`} onClick={() => onNavigate?.(`/analytics/metrics/${row.metric.id}`)} />
            })}
          </div>
        </div>}
      </AnalyticsSection>
      <AnalyticsSection
        className="executive-maturity-section"
        title="成熟度"
        description="关键研发活动与通用研发能力分别评估；未评估不补零。"
        action={<div className="executive-maturity-category" role="group" aria-label="成熟度范围">
          <Button size="small" type={maturityCategory === 'key' ? 'primary' : 'default'} aria-pressed={maturityCategory === 'key'} onClick={() => changeMaturityCategory('key')}>关键研发活动</Button>
          <Button size="small" type={maturityCategory === 'general' ? 'primary' : 'default'} aria-pressed={maturityCategory === 'general'} onClick={() => changeMaturityCategory('general')}>通用研发能力</Button>
        </div>}
      >
        {selectedMaturity.loading && <div className="analytics-empty">正在加载成熟度历史…</div>}
        {selectedMaturity.error && <div className="analytics-empty analytics-empty--error" role="alert">成熟度历史加载失败：{selectedMaturity.error.message}</div>}
        {!selectedMaturity.loading && !selectedMaturity.error && <div className="executive-maturity-grid">
          <AnalyticsPanel title="团队成熟度矩阵" description={`${month} · 同一活动按团队并列，缺失保持未评估。`}>
            {maturityMatrix.columns.length
              ? <MaturityMatrix label={`${month} ${maturityCategory === 'key' ? '关键研发活动' : '通用研发能力'}成熟度矩阵`} columns={maturityMatrix.columns} rows={maturityMatrix.rows} />
              : <div className="analytics-empty">当前没有可展示的成熟度活动。</div>}
          </AnalyticsPanel>
          <AnalyticsPanel title="领域整体成熟度画像" description="本期领域平均与上期领域平均；缺失轴不补零。">
            <MaturityRadar activities={maturityActivities} series={maturitySeries} ariaLabel={`${month} ${maturityCategory === 'key' ? '关键研发活动' : '通用研发能力'}本期与上期领域平均成熟度画像`} />
          </AnalyticsPanel>
        </div>}
      </AnalyticsSection>
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

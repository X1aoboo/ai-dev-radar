import { useEffect, useMemo, useRef, useState } from 'react'
import { ClockCircleOutlined, CodeOutlined, FileTextOutlined, PieChartOutlined, TeamOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button, Select } from 'antd'

import AnalyticsPanel from '../components/AnalyticsPanel'
import { AnalyticsDirectory, AnalyticsSection, BenchmarkLegend, ChartCard, MaturityMatrix, TeamMatrix, sparklineSegments } from '../components/AnalyticsComponents'
import FilterToolbar from '../components/FilterToolbar'
import FocusRestoringDrawer from '../components/FocusRestoringDrawer'
import MetricKpiCard from '../components/MetricCard'
import PageHeader from '../components/PageHeader'
import EChart from '../components/EChart'
import FilterBar from '../overview/FilterBar'
import { hasNumericValues, useComputedMetrics } from '../overview/metricData'
import { buildIROverviewMetricData, IR_OVERVIEW_KPIS, irOverviewMetricSummary, useIROverviewMetrics } from '../overview/irKpiData'
import { buildTrendOption, efficiencyOutlierAxisLabel, hasEfficiencyOutlier } from '../overview/chartOption'
import { factTrendSnapshot, lifecycleMetricSlots, maturityMatrixData, metricDataForPeriods } from '../overview/executiveLogic'
import MaturityRadar from '../overview/MaturityRadar'
import { useMaturityOverview } from '../overview/maturityData'
import { booleanStatusRows } from '../metricDetail/metricDetailLogic'
import { activityCoverageBreakdown, buildActivityKpiModel } from './activityKpiLogic'
import {
  DATAVIZ_COLORS,
  analysisWindowLabel,
  analysisWindowMonths,
  assignTeamColorSlots,
  buildMetricRows,
  currentMonthId,
  formatFactSummary,
  formatMetricDelta,
  formatMetricValue,
  hasFactValue,
  isValidMonth,
  iterationPeriods,
  latestPeriodId,
  filterToSearchParams,
  maturityStateToSearchParams,
  monthWindow,
  previousMonthId,
  TEAM_COLOR_STORAGE_KEY,
} from '../overview/overviewLogic'
import './analytics.css'

const EMPTY_ACTIVITY_LIST = []

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

function activitySummary(data, activityId) {
  return data?.activities?.find((activity) => String(activity.activity_id) === String(activityId)) ?? null
}

function cellsForTeamMonth(data, teamId) {
  const team = data?.teams?.find((item) => String(item.team_id) === String(teamId))
  return team?.cells ?? []
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
      : deltaText(companyAverage, previousCompanyAverage, (value) => formatMetricDelta(metric, value)),
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

function MetricEvidenceTable({ metrics, dataByMetric, periodId, showPeriodChange = false }) {
  if (periodId === 'all') return <div className="analytics-empty">选择单一周期查看团队比较与合并原始量；全部周期只显示趋势。</div>
  if (!metrics.length) return <div className="analytics-empty">当前目录没有数值型原始指标。</div>
  return (
    <div className="analytics-detail-table-wrap">
      <table className={`analytics-detail-table${showPeriodChange ? ' activity-raw-evidence__table' : ''}`}>
        <thead><tr>
          <th scope="col">原始指标</th>
          {showPeriodChange
            ? <><th scope="col">全公司均值<br />前期变化</th><th scope="col">合并口径结果<br />原始量</th><th scope="col">事实条数<br />有效团队</th><th scope="col">趋势</th></>
            : <><th scope="col">全公司均值</th><th scope="col">合并口径结果</th><th scope="col">合并原始量</th><th scope="col">事实条数</th></>}
        </tr></thead>
        <tbody>{metrics.map((metric) => {
          const metricData = dataByMetric[metric.id]
          const snapshot = metricSnapshot(metricData, metric, periodId)
          const point = snapshot.domainPoint
          const trendSegments = showPeriodChange
            ? sparklineSegments((metricData?.company_average ?? []).map((trendPoint) => trendPoint?.value ?? null), 64, 24)
            : []
          const trendLabel = `${metric.name}最近${metricData?.periods?.length ?? 0}期全公司均值趋势`
          return <tr key={metric.id}>
            <th scope="row">{metric.name}</th>
            {showPeriodChange
              ? <>
                <td><strong>{formatMetricValue(metric, snapshot.companyAverage)}</strong><small className="activity-raw-evidence__detail">{snapshot.previousValue}</small></td>
                <td><strong>{formatMetricValue(metric, point?.value)}</strong><small className="activity-raw-evidence__detail" title={formatFactSummary(metric, point)}>{formatFactSummary(metric, point)}</small></td>
                <td><strong>{point?.fact_count ?? '—'}</strong><small className="activity-raw-evidence__detail">有效团队 {snapshot.coverage}</small></td>
                <td>{trendSegments.length
                  ? <svg className="activity-raw-evidence__sparkline" viewBox="0 0 64 24" role="img" aria-label={trendLabel}>
                    {trendSegments.map((segment, index) => <g key={index} aria-hidden="true"><path className="activity-raw-evidence__sparkline-area" d={segment.area} /><path className="activity-raw-evidence__sparkline-line" d={segment.line} /><circle cx={segment.end.x} cy={segment.end.y} r="2" /></g>)}
                  </svg>
                  : <span role="img" aria-label={`${metric.name}暂无趋势数据`}>—</span>}
                </td>
              </>
              : <>
                <td>{formatMetricValue(metric, snapshot.companyAverage)}</td>
                <td>{formatMetricValue(metric, point?.value)}</td>
                <td>{formatFactSummary(metric, point)}</td>
                <td>{point?.fact_count ?? '—'}</td>
              </>}
          </tr>
        })}</tbody>
      </table>
    </div>
  )
}

function activityCoverageOption(breakdown, totalLabel) {
  const countMetric = { type: 'count' }
  const count = (value) => formatMetricValue(countMetric, value)
  return {
    animationDuration: 180,
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (item) => `${item.marker}${item.name}：${count(item.value)}（${Number(item.percent).toFixed(1)}%）`,
    },
    legend: { show: false },
    graphic: {
      type: 'text',
      left: 'center',
      top: 'middle',
      style: {
        text: `${count(breakdown.total)}\n${totalLabel}`,
        fill: DATAVIZ_COLORS.inkSecondary,
        fontSize: 17,
        fontWeight: 650,
        lineHeight: 22,
        textAlign: 'center',
      },
    },
    series: [{
      name: '周期覆盖需求量',
      type: 'pie',
      radius: ['48%', '74%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      label: { show: false },
      labelLine: { show: false },
      itemStyle: { borderColor: DATAVIZ_COLORS.grid, borderWidth: 2 },
      data: [
        { name: 'AI已覆盖', value: breakdown.covered, itemStyle: { color: DATAVIZ_COLORS.team[0] } },
        { name: 'AI未覆盖', value: breakdown.uncovered, itemStyle: { color: DATAVIZ_COLORS.companyAverage } },
      ],
    }],
  }
}

function ActivityVolumeBreakdown({ metric, data, periodIds, month, cycleLabel }) {
  if (!metric) return <div className="analytics-empty">当前活动未定义渗透率指标，无法拆分需求覆盖量。</div>
  const breakdown = activityCoverageBreakdown(data, periodIds)
  if (breakdown.status === 'missing') return <div className="analytics-empty">{cycleLabel}截至{month}没有匹配的渗透率事实；缺失不补零。</div>
  if (breakdown.status === 'invalid') return <div className="analytics-empty">当前渗透率分子/分母无法构成有效的覆盖拆分；原始量仍见指标摘要。</div>
  if (breakdown.status === 'zero') return <div className="analytics-empty">当前周期有事实记录，但{metric.denominator_semantic ?? '总量'}为0；保留零值，不绘制占比。</div>

  const percentage = (value) => `${(value / breakdown.total * 100).toFixed(1)}%`
  return <div className="activity-volume-breakdown">
    <EChart
      option={activityCoverageOption(breakdown, metric.denominator_semantic ?? '总量')}
      height={176}
      ariaLabel={`${metric.numerator_semantic ?? 'AI已覆盖需求数'} / ${metric.denominator_semantic ?? 'AR总数'}：总量${breakdown.total}，已覆盖${breakdown.covered}，未覆盖${breakdown.uncovered}`}
    />
    <table className="activity-volume-breakdown__table">
      <thead><tr><th scope="col">需求范围</th><th scope="col">数量</th><th scope="col">占比</th></tr></thead>
      <tbody>
        <tr><th scope="row"><i className="activity-volume-breakdown__swatch activity-volume-breakdown__swatch--covered" />AI已覆盖</th><td>{formatMetricValue({ type: 'count' }, breakdown.covered)}</td><td>{percentage(breakdown.covered)}</td></tr>
        <tr><th scope="row"><i className="activity-volume-breakdown__swatch activity-volume-breakdown__swatch--uncovered" />AI未覆盖</th><td>{formatMetricValue({ type: 'count' }, breakdown.uncovered)}</td><td>{percentage(breakdown.uncovered)}</td></tr>
        <tr className="activity-volume-breakdown__total"><th scope="row">合计</th><td>{formatMetricValue({ type: 'count' }, breakdown.total)}</td><td>100%</td></tr>
      </tbody>
    </table>
  </div>
}

function activityWorkloadOption(kpi, periodIds) {
  if (!kpi?.metric || !(kpi.monthTrend ?? []).some((value) => Number.isFinite(value))) return null
  const metric = { type: 'count', unit: '人天' }
  return {
    animationDuration: 180,
    grid: { left: 14, right: 12, top: 10, bottom: 10, containLabel: true },
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: { type: 'shadow' },
      valueFormatter: (value) => formatMetricValue(metric, Number(value)),
    },
    xAxis: {
      type: 'category',
      data: periodIds,
      boundaryGap: true,
      axisLine: { lineStyle: { color: DATAVIZ_COLORS.axis } },
      axisTick: { show: false },
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 10, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      name: '人天',
      splitLine: { lineStyle: { color: DATAVIZ_COLORS.grid } },
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 10, formatter: (value) => Number(value).toLocaleString('zh-CN') },
    },
    series: [{
      name: 'AI提效工作量',
      type: 'bar',
      data: kpi.monthTrend.map((value) => Number.isFinite(value) ? value : null),
      barMaxWidth: 28,
      itemStyle: { color: kpi.definition.accent, borderRadius: [4, 4, 0, 0] },
      emphasis: { focus: 'series' },
    }],
  }
}

function BooleanStatusList({ rows, teamColors, onNavigate }) {
  return (
    <ul className="analytics-status-list" aria-label="团队布尔能力状态">
      {rows.map(({ team, value, state }) => (
        <li key={team.id}>
          <button type="button" onClick={() => onNavigate?.(`/analytics/teams/${team.id}`, { state: { returnTo: `/analytics/metrics/${metric.id}`, returnLabel: '指标详情' } })} aria-label={`查看团队 ${team.name} 下钻`}>
            <span className="analytics-status-list__team"><i style={{ backgroundColor: teamColors[String(team.id)] }} />{team.name}</span>
            <span className={`analytics-status-list__state is-${state}`}>{state === 'unknown' ? '暂无数据' : value ? '具备' : '不具备'}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function MetricAnalysisCard({ activity, metric, data, error, loading, teams, teamColors, onOpen, onNavigate, granularity, dimension, periodId, title, description, chartHeight = 220, showSummary = true, showDetailLink = true, showPointMarkers = false, tooltipTrigger = 'axis' }) {
  const snapshot = metricSnapshot(data, metric, periodId)
  const selectedPeriodId = periodId === 'all' ? 'all' : (periodId ?? snapshot.currentPeriod?.id ?? 'all')
  const periodWasSelected = periodId !== null && periodId !== undefined && periodId !== 'all'
  const option = useMemo(() => data && !error && metric.type !== 'boolean'
    ? buildTrendOption({ data, metric, teamColors, selectedPeriodId, showPointMarkers, tooltipTrigger })
    : null, [data, error, metric, selectedPeriodId, showPointMarkers, teamColors, tooltipTrigger])
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
      <header className="analytics-analysis-card__header"><div><h3>{title ?? metric.name}</h3><p>{description ?? (metric.type === 'boolean' ? (periodWasSelected ? '逐团队展示所选周期状态；不生成趋势或全公司均值。' : '逐团队展示最近有效状态；不生成趋势或全公司均值。') : `全公司均值虚线 · ${dimension === 'iteration' ? '按版本/迭代' : `近 ${granularity === 'day' ? '30 天' : granularity === 'week' ? '12 周' : '6 个月'}`}`)}</p></div><button type="button" onClick={() => onOpen(detail)}>查看量化详情</button></header>
      {loading && <div className="analytics-empty">正在加载指标数据…</div>}
      {!loading && error && <div className="analytics-empty analytics-empty--error" role="alert">指标加载失败：{error.message}</div>}
      {!loading && !error && metric.type !== 'boolean' && !hasChartValue && <div className="analytics-empty">近六个月没有可展示的历史事实。</div>}
      {!loading && !error && metric.type !== 'boolean' && hasChartValue && noCurrentValue && <div className="analytics-empty analytics-empty--current">所选周期（{snapshot.currentPeriod?.label ?? '当前周期'}）暂无事实；图中仍保留历史有效数据。</div>}
      {!loading && !error && metric.type === 'boolean' && <BooleanStatusList rows={statusRows} teamColors={teamColors} onNavigate={onNavigate} />}
      {!loading && !error && metric.type !== 'boolean' && option && hasChartValue && <EChart option={option} height={chartHeight} ariaLabel={`${activity.name} ${metric.name} 趋势图`} onClick={() => onOpen(detail)} />}
      {!loading && !error && data && metric.type === 'boolean' && knownStatuses > 0 && <div className="analytics-analysis-meta"><SummaryStats value={`${enabledTeams} 个团队具备`} previous="—" coverage={`${knownStatuses} / ${teams.length}`} /></div>}
      {showSummary && !loading && !error && hasChartValue && metric.type !== 'boolean' && periodId === 'all' && <p className="analytics-muted">显示全部周期趋势；选择单一周期可查看当期团队比较。</p>}
      {showSummary && !loading && !error && hasChartValue && data && metric.type !== 'boolean' && periodId !== 'all' && !noCurrentValue && <div className="analytics-analysis-meta"><SummaryStats value={snapshot.currentValue} previous={snapshot.previousValue} coverage={snapshot.coverage} /></div>}
      {showDetailLink && onNavigate && <button type="button" className="analytics-detail-link" onClick={() => onNavigate(`/analytics/metrics/${metric.id}`)}>打开现有指标详情 →</button>}
    </article>
  )
}

function MaturityAnalysisCard({ activity, data, history = [], month, teams, onOpen }) {
  const current = activitySummary(data, activity.id)
  const previousData = history.at(-2)?.data
  const previous = activitySummary(previousData, activity.id)
  const currentRows = teams.map((team) => {
    const cell = cellsForTeamMonth(data, team.id).find((item) => String(item.activity_id) === String(activity.id))
    return { teamId: team.id, teamName: team.name, value: cell?.score ?? null, scoreDisplay: cell?.score_display ?? null, grade: cell?.grade ?? null }
  })
  const dimensions = data?.activities ?? []
  const previousByActivity = new Map((previousData?.activities ?? []).map((entry) => [String(entry.activity_id), entry]))
  const radarSeries = [
    {
      id: 'current-domain-average',
      name: `本期领域平均 · ${month}`,
      color: DATAVIZ_COLORS.team[0],
      values: dimensions.map((entry) => Number.isFinite(entry.score) ? entry.score : null),
    },
    {
      id: 'previous-domain-average',
      name: `上期领域平均 · ${history.at(-2)?.month ?? '—'}`,
      color: DATAVIZ_COLORS.companyAverage,
      dashed: true,
      values: dimensions.map((entry) => previousByActivity.get(String(entry.activity_id))?.score ?? null),
    },
  ]
  const matrix = maturityMatrixData(data)
  const detail = {
    type: 'maturity',
    title: `${activity.name} · 成熟度`,
    currentValue: displayScore(current?.score),
    previousValue: deltaText(current?.score, previous?.score),
    coverage: coverageText(current?.assessed_team_count ?? 0, data?.team_count ?? teams.length),
    periodLabel: month,
    rows: currentRows,
  }
  return (
    <section className="analytics-maturity-summary" aria-label="通用研发能力成熟度画像">
      <header className="analytics-maturity-summary__header">
        <div><p className="analytics-eyebrow">人工月度评估</p><strong>通用研发能力</strong></div>
        <span>当前/上期领域平均 · {month}</span>
        <button type="button" className="analytics-maturity-summary__action" onClick={() => onOpen(detail)}>查看{activity.name}详情</button>
      </header>
      <div className="analytics-maturity-summary__visuals">
        <section className="analytics-maturity-summary__matrix" aria-label="通用研发能力团队成熟度矩阵">
          <h3>团队 × 能力维度 · {month}</h3>
          <p>维度来自现有通用能力目录；未评估保持为空。</p>
          {dimensions.length
            ? <MaturityMatrix label={`通用研发能力团队成熟度矩阵 · ${month}`} columns={matrix.columns} rows={matrix.rows} />
            : <div className="analytics-empty" role="status">当前没有配置通用研发能力成熟度维度。</div>}
        </section>
        <section className="analytics-maturity-summary__radar" aria-label="通用研发能力领域平均成熟度雷达">
          <h3>领域平均成熟度雷达</h3>
          <p>当前与上期按相同通用能力维度对比。</p>
          <MaturityRadar activities={dimensions} series={radarSeries} ariaLabel="通用研发能力当前与上期领域平均成熟度雷达" />
        </section>
      </div>
    </section>
  )
}

function AnalysisPageHead({ title, description, actions }) {
  return (
    <PageHeader
      className="analytics-page-head"
      title={title}
      description={description}
      actions={actions}
    />
  )
}

function AnalyticsFilterToolbar({ month, onMonthChange, granularity, onGranularityChange, showGranularity, cycle, onCycleChange, showCycle = false, versions = [], versionId = 'all', onVersionChange, showVersion = false, scopeNote, label = '分析筛选', className = '' }) {
  return (
    <FilterToolbar label={label} className={`analytics-filter-toolbar ${className}`.trim()}>
      <div className="analytics-page-controls">
        <label><span>分析月份</span><input aria-label="分析月份" type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} /></label>
        {showCycle && <div className="analytics-cycle-control"><span>统计周期</span><div role="group" aria-label="统计周期">{[['6m', '近6个月'], ['half', '本半年度'], ['year', '年度累计']].map(([value, label]) => <Button key={value} size="small" type={cycle === value ? 'primary' : 'default'} aria-pressed={cycle === value} onClick={() => onCycleChange?.(value)}>{label}</Button>)}</div><small>截至 {month} · {analysisWindowLabel(month, cycle)}</small></div>}
        {showVersion && <label><span>版本</span><Select size="small" aria-label="版本" value={versionId} onChange={(value) => onVersionChange?.(value)} options={[{ value: 'all', label: '全部版本' }, ...versions.map((version) => ({ value: String(version.id), label: version.name }))]} /></label>}
        {showGranularity && <div className="analytics-granularity" role="group" aria-label="原始指标时间粒度"><span>时间粒度</span><div className="analytics-granularity__options">{[['month', '月'], ['week', '周'], ['day', '日']].map(([value, label]) => <button key={value} type="button" aria-pressed={granularity === value} className={granularity === value ? 'is-active' : ''} onClick={() => onGranularityChange(value)}>{label}</button>)}</div></div>}
      </div>
      {scopeNote && <p className="analytics-filter-scope-note">{scopeNote}</p>}
    </FilterToolbar>
  )
}

export function AnalyticsDetailPage({ kind, title, description, catalog = [], teams = [], versions = [], filter, onFilterChange, onNavigate, onSessionExpired, maturityState, onMaturityChange }) {
  const [localMonth, setLocalMonth] = useState(currentMonthId())
  const [localGranularity, setLocalGranularity] = useState(kind === 'general' && ['day', 'week', 'month'].includes(filter?.granularity) ? filter.granularity : 'month')
  const [selectedActivityId, setSelectedActivityId] = useState(null)
  const [selectedCapabilityId, setSelectedCapabilityId] = useState(null)
  const month = isValidMonth(maturityState?.month) ? maturityState.month : localMonth
  const activityTrendMonthIds = useMemo(() => monthWindow(month, 6), [month])
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
  const cycle = ['half', 'year'].includes(filter?.cycle) ? filter.cycle : '6m'
  const cyclePeriodIds = useMemo(() => analysisWindowMonths(month, cycle), [cycle, month])
  const coreWindowLimit = Math.max(6, cyclePeriodIds.length)
  const metricFilter = useMemo(() => ({
    dimension: metricDimension,
    granularity: metricDimension === 'iteration' ? 'month' : granularity,
    versionId,
    periodId: kind === 'key' ? (filter?.periodId ?? null) : null,
    analysisMonth: month,
    windowLimit: metricDimension === 'iteration' ? undefined : granularity === 'day' ? 30 : granularity === 'week' ? 12 : coreWindowLimit,
  }), [filter?.periodId, granularity, kind, metricDimension, month, versionId, coreWindowLimit])
  const coreMetricFilter = useMemo(() => ({ dimension: 'time', granularity: 'month', versionId, periodId: null, analysisMonth: month, windowLimit: coreWindowLimit }), [coreWindowLimit, month, versionId])
  const metricActivities = useMemo(() => {
    const activity = kind === 'key' ? selectedActivity : selectedCapability
    return activity ? [activity] : []
  }, [kind, selectedActivity, selectedCapability])
  const metrics = useComputedMetrics(metricActivities, metricFilter, onSessionExpired)
  const usesCoreMetricQuery = kind === 'key'
    && metricFilter.dimension === coreMetricFilter.dimension
    && metricFilter.granularity === coreMetricFilter.granularity
    && metricFilter.versionId === coreMetricFilter.versionId
    && metricFilter.analysisMonth === coreMetricFilter.analysisMonth
    && metricFilter.windowLimit === coreMetricFilter.windowLimit
  const separateCoreMetrics = useComputedMetrics(usesCoreMetricQuery ? EMPTY_ACTIVITY_LIST : kind === 'key' ? metricActivities : EMPTY_ACTIVITY_LIST, coreMetricFilter, onSessionExpired)
  const coreMetrics = usesCoreMetricQuery ? metrics : separateCoreMetrics
  const timePeriods = useMemo(() => {
    const data = selectedMetric ? metrics.data[selectedMetric.id] : Object.values(metrics.data).find((item) => item?.periods?.length)
    return data?.periods ?? []
  }, [metrics.data, selectedMetric])
  const periodOptions = useMemo(() => metricDimension === 'iteration' ? iterationPeriods(versions ?? [], versionId) : timePeriods, [metricDimension, timePeriods, versionId, versions])
  const teamColors = useColorSlotsForTeams(teams)
  const drawer = useDetailDrawer()
  const metricPeriodId = kind === 'key'
    ? filter?.periodId ?? latestPeriodId(periodOptions)
    : latestPeriodId(timePeriods)
  const metricPeriodLabel = metricPeriodId === 'all'
    ? '全部周期'
    : periodOptions.find((period) => String(period.id) === String(metricPeriodId))?.label ?? String(metricPeriodId)
  const activityKpiModel = useMemo(() => kind === 'key' && selectedActivity
    ? buildActivityKpiModel({
      activity: selectedActivity,
      dataByMetric: coreMetrics.data,
      kpiDefinitions: IR_OVERVIEW_KPIS,
      month,
      previousMonth: monthWindow(month, 2)[0],
      monthTrendIds: activityTrendMonthIds,
      cyclePeriodIds,
      teams,
    })
    : { kpis: [], teamRows: [] }, [activityTrendMonthIds, coreMetrics.data, cyclePeriodIds, kind, month, selectedActivity, teams])
  const activityCoverageKpi = activityKpiModel.kpis.find((kpi) => kpi.code === 'ai-demand-penetration')
  const activityWorkloadKpi = activityKpiModel.kpis.find((kpi) => kpi.code === 'ai-efficiency-workload')
  const activityWorkloadTrendOption = useMemo(
    () => activityWorkloadOption(activityWorkloadKpi, activityTrendMonthIds),
    [activityTrendMonthIds, activityWorkloadKpi],
  )
  const activityTeamData = useMemo(() => activityTeamMatrix(activityKpiModel, teamColors), [activityKpiModel, teamColors])
  const capabilityNumericMetrics = selectedCapability?.metrics.filter((metric) => metric.type !== 'boolean') ?? []
  const capabilityStatusMetrics = [...capabilityNumericMetrics].sort((left, right) => Number(left.type === 'count') - Number(right.type === 'count'))
  const capabilityMaturitySummary = activitySummary(maturity.data, selectedCapability?.id)
  const capabilityMaturityHistory = (maturity.history ?? []).map((entry) => activitySummary(entry.data, selectedCapability?.id))
  const previousCapabilityMaturity = activitySummary(maturity.history?.at(-2)?.data, selectedCapability?.id)
  const maturityScoreDelta = Number.isFinite(capabilityMaturitySummary?.score) && Number.isFinite(previousCapabilityMaturity?.score)
    ? capabilityMaturitySummary.score - previousCapabilityMaturity.score
    : null
  const maturityCoverageDelta = Number.isFinite(capabilityMaturitySummary?.assessed_team_count) && Number.isFinite(previousCapabilityMaturity?.assessed_team_count)
    ? capabilityMaturitySummary.assessed_team_count - previousCapabilityMaturity.assessed_team_count
    : null
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

  function changeCycle(nextCycle) {
    onFilterChange?.({ ...(filter ?? {}), cycle: nextCycle }, { history: 'push' })
  }

  function changeVersion(nextVersion) {
    onFilterChange?.({
      ...(filter ?? {}),
      versionId: nextVersion,
      periodId: metricDimension === 'iteration' ? latestPeriodId(iterationPeriods(versions ?? [], nextVersion)) : null,
    }, { history: 'push' })
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

  function activityKpiCards(scope) {
    return activityKpiModel.kpis.map((kpi) => {
      const isMonth = scope === 'month'
      const value = isMonth ? kpi.monthValue : kpi.cycleValue
      const baseline = isMonth ? kpi.previousMonthValue : kpi.previousCycleValue
      const delta = isMonth ? kpi.monthDelta : kpi.cycleDelta
      const prefix = isMonth ? '环比' : kpi.definition.periodDeltaLabel ?? '周期差'
      return <MetricKpiCard
        key={kpi.code}
        icon={IR_KPI_ICONS[kpi.definition.code]}
        label={kpi.definition.name}
        value={formatMetricValue(kpi.definition, value)}
        unit={kpi.definition.unit}
        delta={Number.isFinite(delta) ? `${isMonth ? `${prefix} ` : ''}${activityKpiDelta(kpi, delta)}` : undefined}
        deltaTone={changeTone(delta)}
        comparison={`${isMonth ? 'vs 上月' : 'vs 纳入本月前'} ${activityKpiValue(kpi, baseline, true)}`}
        trendValues={isMonth ? kpi.monthTrend : kpi.cycleTrend}
        trendLabel={`${selectedActivity.name} · ${kpi.definition.name}${isMonth ? '月度' : '统计周期'}趋势`}
        accent={kpi.definition.accent}
        loading={coreMetrics.loading}
        error={kpi.metric ? coreMetrics.errors[kpi.metric.id]?.message : undefined}
      />
    })
  }

  function teamDetailsPath(teamId) {
    const params = filterToSearchParams({ dimension: 'time', granularity: 'month', versionId: 'all', periodId: null, metricId: 'all', cycle: '6m', ...(filter ?? {}) })
    maturityStateToSearchParams({ ...(maturityState ?? {}), month }).forEach((value, key) => params.set(key, value))
    params.set('activityId', String(selectedActivity.id))
    return `/analytics/teams/${teamId}?${params.toString()}#team-lifecycle`
  }

  return (
    <div className="analytics-page">
      <AnalysisPageHead
        title={kind === 'key' && selectedActivity ? `${title} / ${selectedActivity.name}` : kind === 'general' && selectedCapability ? `${title} / ${selectedCapability.name}` : title}
        description={description}
        actions={kind === 'key'
          ? <AnalyticsFilterToolbar label="" className="analytics-global-filter-toolbar" month={month} onMonthChange={changeMonth} cycle={cycle} onCycleChange={changeCycle} showCycle versions={versions ?? []} versionId={versionId} onVersionChange={changeVersion} showVersion />
          : kind === 'general'
          ? <AnalyticsFilterToolbar
              label=""
              className="analytics-global-filter-toolbar"
              month={month}
              onMonthChange={changeMonth}
              granularity={granularity}
              onGranularityChange={changeGranularity}
              showGranularity
              scopeNote={`统计周期：近${granularity === 'day' ? '30天' : granularity === 'week' ? '12周' : '6个月'}趋势 · 最新${granularity === 'day' ? '日' : granularity === 'week' ? '周' : '月'}快照；版本：不适用（通用能力无迭代归属）`}
            />
          : undefined}
      />
      {kind === 'key'
        ? <FilterBar filter={filter ?? { dimension: 'time', granularity: 'month', versionId: 'all', periodId: null, metricId: 'all', cycle: '6m' }} onChange={onFilterChange ?? (() => undefined)} versions={versions ?? []} periods={timePeriods} loading={metrics.loading} metricOptions={metricOptions} showPrimaryControls={false} />
        : null}
      {kind === 'general' && <div className="analytics-page-note">成熟度按自然月计算；原始指标按所选维度与周期查看。无事实保持缺失，不插值、不补零。</div>}
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
        <div className="analytics-workspace activity-workspace">
          <AnalyticsSection title={`月度核心成效 · ${month}`} description="按所选活动匹配的 FactRecord 原始量口径计算；不使用 IR 总览数据。">
            <div className="activity-outcome-grid">{activityKpiCards('month')}</div>
          </AnalyticsSection>
          <AnalyticsSection title={`周期整体成效 · ${analysisWindowLabel(month, cycle)}（截至${month}）`} description="周期值按匹配 FactRecord 原始量重算；变化中，比例/提效为周期差，覆盖数/工作量为本月贡献。">
            <div className="activity-outcome-grid">{activityKpiCards('cycle')}</div>
          </AnalyticsSection>
          <AnalyticsSection title="核心趋势" description={`AI需求渗透率和AI研发提效分别展示团队及同指标全公司均值；原始趋势筛选为${metricDimension === 'iteration' ? '版本/迭代' : `${granularity === 'day' ? '日' : granularity === 'week' ? '周' : '月'}`}。`}>
            <div className="activity-trend-grid">{activityKpiModel.kpis.slice(0, 2).map((kpi) => kpi.metric
              ? <MetricAnalysisCard
                key={kpi.code}
                activity={selectedActivity}
                metric={kpi.metric}
                data={metrics.data[kpi.metric.id]}
                error={metrics.errors[kpi.metric.id]}
                loading={metrics.loading}
                teams={teams}
                teamColors={teamColors}
                onOpen={drawer.open}
                granularity={granularity}
                dimension={metricDimension}
                periodId={metricPeriodId}
                title={`${selectedActivity.name} · ${kpi.definition.name}趋势`}
                description={`来源：${kpi.metric.name} · 同指标全公司均值`}
                chartHeight={130}
                showSummary={false}
                showDetailLink={false}
                showPointMarkers
                tooltipTrigger="item"
              />
              : <ChartCard
                key={kpi.code}
                title={`${selectedActivity.name} · ${kpi.definition.name}趋势`}
                description="当前目录未定义对应类型的 FactRecord 指标。"
                ariaLabel={`${selectedActivity.name} ${kpi.definition.name}趋势图`}
                height={130}
                empty="当前目录未定义对应类型的 FactRecord 指标。"
              />)}</div>
          </AnalyticsSection>
          <AnalyticsSection title="团队差异" description={`${analysisWindowLabel(month, cycle)}截至${month} · 比例/提效为周期值相对纳入本月前的差值；覆盖数/工作量变化为本月贡献。点击团队进入同活动下钻。`}>
            {coreMetrics.loading
              ? <div className="analytics-empty" role="status">正在加载统计周期团队差异…</div>
              : <TeamMatrix
                label={`${selectedActivity.name} 团队差异 · ${analysisWindowLabel(month, cycle)}截至${month}`}
                columns={activityTeamData.columns}
                rows={activityTeamData.rows}
                showChanges
                onSelect={(teamId) => onNavigate?.(teamDetailsPath(teamId), { state: { returnTo: '/analytics/activities', returnLabel: '研发活动' } })}
              />}
          </AnalyticsSection>
          <div className="activity-lower-grid">
            <AnalyticsPanel
              title="指标拆解与业务量"
              description={activityCoverageKpi?.metric
                ? `${analysisWindowLabel(month, cycle)}截至${month} · ${activityCoverageKpi.metric.numerator_semantic ?? '渗透率分子'} / ${activityCoverageKpi.metric.denominator_semantic ?? '总量'}`
                : '当前活动未定义渗透率指标；不借用其他活动或 IR 数据。'}
            >
              {coreMetrics.loading
                ? <div className="analytics-empty" role="status">正在汇总活动需求覆盖量…</div>
              : <ActivityVolumeBreakdown
                  metric={activityCoverageKpi?.metric}
                  data={activityCoverageKpi?.metric ? coreMetrics.data[activityCoverageKpi.metric.id] : null}
                  periodIds={cyclePeriodIds}
                  month={month}
                  cycleLabel={analysisWindowLabel(month, cycle)}
                />}
            </AnalyticsPanel>
            <AnalyticsPanel
              title="AI提效工作量趋势"
              description={`${activityTrendMonthIds[0]}—${month} · 每月汇总预估人天减实际人天；无上年同期事实时不展示同比线，缺失月份留空。`}
            >
              {coreMetrics.loading
                ? <div className="analytics-empty" role="status">正在加载工作量趋势…</div>
                : activityWorkloadTrendOption
                  ? <EChart option={activityWorkloadTrendOption} height={176} ariaLabel={`${selectedActivity.name}近六个月AI提效工作量，每月为匹配效率事实的预估人天减实际人天合计`} />
                  : <div className="analytics-empty">当前活动没有有效效率事实；工作量趋势保持缺失。</div>}
            </AnalyticsPanel>
            <AnalyticsPanel
              title={`原始指标摘要 · ${metricPeriodLabel}`}
              description="保留原指标名；均值变化、合并原始量、事实覆盖与同指标趋势分列。"
            >
              {metrics.loading
                ? <div className="analytics-empty" role="status">正在汇总原始指标…</div>
                : <MetricEvidenceTable metrics={activeMetrics} dataByMetric={metrics.data} periodId={metricPeriodId} showPeriodChange />}
            </AnalyticsPanel>
          </div>
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
          <AnalyticsSection title="能力状态" description={`周期 ${metricPeriodLabel} · 数量显示合并总量，比例显示同指标全公司均值；有效团队范围见卡片。`}>
            {metrics.loading && <div className="analytics-empty" role="status">正在加载能力状态…</div>}
            {selectedCapability && <div className="capability-kpi-grid" style={{ '--capability-kpi-columns': 2 + capabilityStatusMetrics.length }}>
              <MetricKpiCard
                icon={<ClockCircleOutlined />}
                label="成熟度评分"
                value={capabilityMaturitySummary?.score_display ?? displayScore(capabilityMaturitySummary?.score)}
                unit="分"
                delta={Number.isFinite(maturityScoreDelta) ? deltaText(capabilityMaturitySummary.score, previousCapabilityMaturity.score) : undefined}
                deltaTone={changeTone(maturityScoreDelta)}
                comparison={`vs 上期 ${previousCapabilityMaturity?.score_display ?? displayScore(previousCapabilityMaturity?.score)}`}
                detail={`人工月度评估 · ${month}`}
                trendValues={capabilityMaturityHistory.map((summary) => summary?.score ?? null)}
                trendLabel={`${selectedCapability.name}成熟度近六个月趋势`}
                accent={DATAVIZ_COLORS.team[0]}
                loading={maturity.loading}
                error={maturity.error?.message}
              />
              <MetricKpiCard
                icon={<TeamOutlined />}
                label="评估覆盖团队"
                value={capabilityMaturitySummary ? `${capabilityMaturitySummary.assessed_team_count} / ${maturity.data?.team_count ?? teams.length}` : '—'}
                delta={Number.isFinite(maturityCoverageDelta) ? maturityCoverageDelta === 0 ? '持平' : `${maturityCoverageDelta > 0 ? '+' : ''}${maturityCoverageDelta} 个团队` : undefined}
                deltaTone={changeTone(maturityCoverageDelta)}
                comparison={`vs 上期 ${previousCapabilityMaturity ? `${previousCapabilityMaturity.assessed_team_count} / ${maturity.history?.at(-2)?.data?.team_count ?? teams.length}` : '—'}`}
                detail={`自然月评估 · ${month}`}
                trendValues={capabilityMaturityHistory.map((summary) => summary?.assessed_team_count ?? null)}
                trendLabel={`${selectedCapability.name}成熟度评估覆盖团队趋势`}
                accent={DATAVIZ_COLORS.team[3]}
                loading={maturity.loading}
                error={maturity.error?.message}
              />
              {capabilityStatusMetrics.map((metric) => {
              const data = metrics.data[metric.id]
              const snapshot = metricSnapshot(data, metric, metricPeriodId)
              const countMetric = metric.type === 'count'
              const currentValue = countMetric ? snapshot.domainPoint?.value : snapshot.companyAverage
              const previousValue = countMetric
                ? data?.domain_summary?.find((point) => String(point.period_id) === String(snapshot.previousPeriod?.id))?.value
                : snapshot.previousCompanyAverage
              const delta = Number.isFinite(currentValue) && Number.isFinite(previousValue) ? currentValue - previousValue : null
              const trend = countMetric ? (data?.domain_summary ?? []) : (data?.company_average ?? [])
              const lastTrendPoint = [...trend].reverse().find((point) => String(point?.period_id) !== String(metricPeriodId) && Number.isFinite(point?.value))
              const lastTrendPeriodLabel = data?.periods?.find((period) => String(period.id) === String(lastTrendPoint?.period_id))?.label
              return <MetricKpiCard
                key={metric.id}
                icon={countMetric ? <FileTextOutlined /> : <PieChartOutlined />}
                label={metric.name}
                value={formatMetricValue(metric, currentValue)}
                unit={metric.unit}
                delta={Number.isFinite(delta) ? formatMetricDelta(metric, delta, true) : undefined}
                deltaTone={changeTone(delta)}
                comparison={`vs 前期 ${formatMetricValue(metric, previousValue)}`}
                detail={`${countMetric ? '合并总量' : '全公司均值'} · 有效团队 ${snapshot.coverage}${!Number.isFinite(currentValue) && lastTrendPeriodLabel ? ` · 趋势至 ${lastTrendPeriodLabel}` : ''}`}
                trendValues={trend.map((point) => point?.value ?? null)}
                trendLabel={`${metric.name}${countMetric ? '合并总量' : '全公司均值'}趋势`}
                accent={metric.code === 'mrr-count' ? DATAVIZ_COLORS.team[2] : metric.code === 'mrr-rate' ? DATAVIZ_COLORS.metricType.count : DATAVIZ_COLORS.metricType[metric.type] ?? DATAVIZ_COLORS.team[0]}
                loading={metrics.loading}
                error={metrics.errors[metric.id]?.message}
              />
            })}</div>}
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
              showSummary={false}
              showDetailLink={false}
            />)}
              {!capabilityNumericMetrics.length && <div className="analytics-empty">该能力以团队布尔状态呈现；不绘制 0/1 时间趋势。</div>}
            </div>
          </AnalyticsSection>
          <div className="capability-comparison-grid">
            <AnalyticsPanel title="团队差异" description={`周期 ${metricPeriodLabel} · 数值指标逐列比较；点击团队名称进入团队详情。`}>
            {metrics.loading
              ? <div className="analytics-empty" role="status">正在加载团队差异…</div>
              : capabilityTeamDifference.columns.length > 0
              ? <TeamMatrix label={`${selectedCapability.name} ${metricPeriodLabel} 团队差异`} {...capabilityTeamDifference} onSelect={(teamId) => onNavigate?.(`/analytics/teams/${teamId}`, { state: { returnTo: '/analytics/capabilities', returnLabel: '研发能力' } })} />
              : <div className="analytics-empty">该能力没有可取平均的数值指标；布尔状态保持逐团队展示。</div>}
          </AnalyticsPanel>
          <AnalyticsPanel title="支撑指标与证据" description="分列团队均值变化、合并结果、原始量、事实覆盖与同指标趋势。">
            {metrics.loading
              ? <div className="analytics-empty" role="status">正在加载原始量证据…</div>
              : capabilityNumericMetrics.length
              ? <MetricEvidenceTable metrics={capabilityNumericMetrics} dataByMetric={metrics.data} periodId={metricPeriodId} showPeriodChange />
              : <div className="analytics-empty">布尔能力以逐团队状态和指标详情作为证据，不生成合并计数或均值。</div>}
          </AnalyticsPanel>
          </div>
          <AnalyticsSection title="成熟度画像" description="人工月度评估与指标事实分开；矩阵和雷达轴使用现有通用研发能力目录，不从事实指标推导。">
            {maturity.loading && <div className="analytics-empty" role="status">正在加载成熟度历史…</div>}
            {maturity.error && <div className="analytics-empty analytics-empty--error" role="alert">成熟度加载失败：{maturity.error.message}</div>}
            {!maturity.loading && !maturity.error && <MaturityAnalysisCard activity={selectedCapability} data={maturity.data} history={maturity.history} month={month} teams={teams} onOpen={drawer.open} />}
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
  const delta = Number.isFinite(snapshot.current) && Number.isFinite(snapshot.previous) ? snapshot.current - snapshot.previous : null
  const comparison = snapshot.validTeamCount
    ? `团队范围 ${formatMetricValue(row.metric, snapshot.teamMin)}–${formatMetricValue(row.metric, snapshot.teamMax)} · ${snapshot.validTeamCount}/${teamCount} 有效`
    : `当前月无团队事实 · 0/${teamCount} 有效`
  return { ...snapshot, value: formatMetricValue(row.metric, snapshot.current), delta, comparison }
}

function changeTone(delta) {
  return !Number.isFinite(delta) || delta === 0 ? 'neutral' : delta > 0 ? 'positive' : 'negative'
}

function activityKpiValue(kpi, value, includeUnit = false) {
  const formatted = formatMetricValue(kpi.definition, value)
  return includeUnit && Number.isFinite(value) && kpi.definition.unit ? `${formatted} ${kpi.definition.unit}` : formatted
}

function activityKpiDelta(kpi, value) {
  const formatted = formatMetricDelta(kpi.definition, value, true)
  return kpi.definition.unit && Number.isFinite(value) ? `${formatted} ${kpi.definition.unit}` : formatted
}

function activityTeamMatrix(model, teamColors) {
  const columns = model.kpis.map((kpi) => ({
    id: kpi.code,
    label: kpi.definition.name,
    context: kpi.metric ? `来源：${kpi.metric.name}` : '当前活动未定义对应类型指标',
  }))
  const rows = model.teamRows.map((row) => ({
    ...row,
    color: row.kind === 'team' ? teamColors[String(row.id)] : undefined,
    values: row.values.map((value, index) => {
      const kpi = model.kpis[index]
      return {
        text: activityKpiValue(kpi, value.textValue, true),
        changeText: activityKpiDelta(kpi, value.changeValue),
        changeTone: changeTone(value.changeValue),
      }
    }),
  }))
  return { columns, rows }
}

const IR_KPI_ICONS = {
  'ai-demand-penetration': <PieChartOutlined />,
  'ai-rd-efficiency': <ThunderboltOutlined />,
  'ai-covered-ir-count': <FileTextOutlined />,
  'ai-efficiency-workload': <ClockCircleOutlined />,
}

function ExecutiveOverallTrend({ rows, dataByMetric, periodIds, month, teamColors, onNavigate, loading, error }) {
  const [metricId, setMetricId] = useState(null)
  const row = rows.find((item) => String(item.metric.code) === String(metricId)) ?? rows[0] ?? null
  useEffect(() => {
    if (!rows.some((item) => String(item.metric.code) === String(metricId))) setMetricId(rows[0]?.metric.code ?? null)
  }, [rows, metricId])
  const rawData = row ? dataByMetric[row.metric.code] : null
  const data = rawData ? metricDataForPeriods(rawData, periodIds) : null
  const hasTrend = hasNumericValues(data)
  const currentMonthPoint = rawData?.domain_summary?.find((point) => String(point.period_id) === String(month))
  const currentMonthNote = currentMonthPoint?.ir_fact_count === 0
    ? `${month} 暂无 IR 需求记录`
    : currentMonthPoint && !Number.isFinite(currentMonthPoint.value) ? `${month} 暂无可计算的${row?.metric.name ?? '指标'}数据` : null
  const visibleTeams = data?.series?.filter((series) => (series.values ?? []).some((point) => Number.isFinite(point?.value))) ?? []
  const overlapNote = visibleTeams.length === 1 ? ` · 目前仅${visibleTeams[0].team_name}有有效数据，多团队对照暂不可用` : ''
  const averageLabel = '全公司均值'
  const trendOption = row && data && hasTrend ? buildTrendOption({ data, metric: row.metric, teamColors, selectedPeriodId: month, averageLabel }) : null
  const option = trendOption ? {
    ...trendOption,
    series: trendOption.series.map((series) => ({
      ...series,
      data: series.data.map((point) => Number.isFinite(point?.value) && point.symbol === 'none'
        ? { ...point, symbol: series.name === averageLabel ? 'diamond' : 'circle', symbolSize: 5 }
        : point),
    })),
  } : null
  const action = <div className="executive-trend-actions" role="group" aria-label="核心指标">
    {rows.map((item) => <button key={item.metric.code} type="button" aria-label={item.metric.name} aria-pressed={String(item.metric.code) === String(row?.metric.code)} onClick={() => setMetricId(item.metric.code)}>{item.metric.name}</button>)}
  </div>
  return <AnalyticsPanel className="executive-overall-trend" title="核心指标趋势" description={row ? `${row.metric.name} · IR需求临时数据${currentMonthNote ? ` · ${currentMonthNote}` : ''}${overlapNote}` : '当前没有可展示的全局KPI'} action={action}>
    {!row ? <div className="analytics-empty">当前没有可展示的全局KPI。</div>
      : error ? <div className="analytics-empty analytics-empty--error" role="alert">IR指标趋势加载失败：{error.message}</div>
        : loading && !rawData ? <div className="analytics-empty">正在加载IR指标趋势…</div>
          : !hasTrend ? <div className="analytics-empty analytics-empty--current">当前 IR 时间窗口没有可展示的团队事实。</div>
            : <EChart option={option} height={360} ariaLabel={`${row.metric.name}IR需求团队与全公司均值趋势图`} onClick={() => onNavigate?.('/data/requirements/ir')} />}
  </AnalyticsPanel>
}

function ExecutiveLifecycle({ activities = [], metricRows = [], dataByMetric, errors = {}, month, periodIds = [], teams = [], teamColors = {}, onNavigate }) {
  const keyActivities = useMemo(() => activities.filter((activity) => activity.kind === 'key'), [activities])
  const lifecycleStages = useMemo(() => {
    const byCode = new Map(keyActivities.map((activity) => [activity.code, activity]))
    const core = [
      { id: 'demand', label: '需求', activity: byCode.get('sa'), sourceLabel: 'SA设计', icon: <FileTextOutlined /> },
      { id: 'se', label: 'SE设计', activity: byCode.get('se'), icon: <TeamOutlined /> },
      { id: 'design', label: '开发设计', activity: byCode.get('dd'), icon: <PieChartOutlined /> },
      { id: 'coding', label: '编码开发', activity: byCode.get('cd'), icon: <CodeOutlined /> },
      { id: 'testing', label: '测试', activity: byCode.get('tcg'), sourceLabel: '测试用例生成', icon: <ClockCircleOutlined /> },
      { id: 'test-execution', label: '测试用例执行', activity: byCode.get('tce'), emptyMessage: '目录仅定义用例执行数和执行率，没有渗透率或提效类型指标。', icon: <ThunderboltOutlined /> },
    ]
    const representedCodes = new Set(['sa', 'se', 'dd', 'cd', 'tcg', 'tce'])
    const extensions = keyActivities
      .filter((activity) => !representedCodes.has(activity.code))
      .map((activity) => ({ id: String(activity.id), label: activity.name, activity }))
    return [...core, ...extensions]
  }, [keyActivities])
  const [selectedStageId, setSelectedStageId] = useState('demand')
  const selectedStage = lifecycleStages.find((stage) => stage.id === selectedStageId) ?? lifecycleStages[0] ?? null
  useEffect(() => {
    if (!lifecycleStages.some((stage) => stage.id === selectedStageId)) {
      setSelectedStageId(lifecycleStages[0]?.id ?? null)
    }
  }, [lifecycleStages, selectedStageId])

  return (
    <AnalyticsPanel className="executive-lifecycle" title="研发关键环节" description="按活动类型展示 AI 需求渗透率与研发提效；缺少对应事实时保留缺失。" action={<><span className="executive-lifecycle__legend"><span>AI需求渗透率</span><span>AI研发提效</span></span><Button type="link" onClick={() => onNavigate?.('/analytics/activities')}>查看研发活动</Button></>}>
      <div className="executive-lifecycle__list" role="group" aria-label="选择关键研发环节">
        {lifecycleStages.map((stage) => {
          const slots = lifecycleMetricSlots(stage.activity)
          return <button key={stage.id} type="button" className="executive-lifecycle__item" aria-label={`选择关键环节：${stage.label}${stage.sourceLabel ? `，来源 ${stage.sourceLabel}` : ''}`} aria-pressed={stage.id === selectedStage?.id} onClick={() => setSelectedStageId(stage.id)}>
          <span className="executive-lifecycle__icon" aria-hidden="true">{stage.icon}</span><strong>{stage.label}</strong>
          {stage.sourceLabel && <small className="executive-lifecycle__source">来源：{stage.sourceLabel}</small>}
          {slots.map((slot) => {
            const metric = slot.metric
            const row = metric && metricRows.find((item) => String(item.metric.id) === String(metric.id))
            const snapshot = row && dataByMetric[metric.id] ? factSnapshot(row, dataByMetric[metric.id], month, teams.length) : null
            const deltaTone = changeTone(snapshot?.delta)
            const change = formatMetricDelta(metric, snapshot?.delta, true)
            return <span className="executive-lifecycle__metric" key={slot.id} title={metric?.name ?? stage.emptyMessage ?? `当前目录没有${slot.label}类型的指标`}>
              <small aria-label={slot.label}>{slot.id === 'penetration' ? '渗透率' : '提效'}</small>
              <span className="executive-lifecycle__metric-result">
                <b>{snapshot?.value ?? '—'}</b>
                <i className={`executive-lifecycle__delta executive-lifecycle__delta--${deltaTone}`} aria-label={`较上月变化 ${formatMetricDelta(metric, snapshot?.delta)}`} title={`较上月变化 ${formatMetricDelta(metric, snapshot?.delta)}`}>{change}</i>
              </span>
            </span>
          })}
          </button>
        })}
      </div>
      {selectedStage && <div className="executive-lifecycle__detail">
        {selectedStage.emptyMessage && <p className="executive-lifecycle__empty-note">{selectedStage.emptyMessage}</p>}
        <div className="executive-lifecycle__trend-grid">
          {lifecycleMetricSlots(selectedStage.activity).map((slot) => {
            const metric = slot.metric
            const rawData = metric ? dataByMetric[metric.id] : null
            const data = rawData ? metricDataForPeriods(rawData, periodIds) : null
            const hasTrend = Boolean(metric) && hasNumericValues(data)
            const hasOutlier = hasEfficiencyOutlier(data, metric)
            const outlierAxisLabel = hasOutlier ? efficiencyOutlierAxisLabel(data, metric) : null
            const option = data && hasTrend ? buildTrendOption({ data, metric, teamColors, selectedPeriodId: 'all', averageLabel: '全公司均值', compact: true }) : null
            const sourceLabel = selectedStage.sourceLabel ?? selectedStage.activity?.name
            const description = metric
              ? `来源：${sourceLabel} · ${metric.name}${outlierAxisLabel ? ` · 图轴 ${outlierAxisLabel}，越界点贴边显示并保留悬浮原值` : ''}`
              : undefined
            const empty = metric ? `当前统计周期暂无${metric.name}事实。` : `目录未配置${slot.label}类型指标。`
            return <ChartCard key={slot.id} title={`${selectedStage.label} · ${slot.label}趋势`} description={description} option={option} height={140} ariaLabel={`${selectedStage.label}${slot.label}趋势图`} error={metric && errors[metric.id] ? `指标加载失败：${errors[metric.id].message}` : undefined} empty={empty} onClick={metric ? () => onNavigate?.(`/analytics/metrics/${metric.id}`) : undefined} />
          })}
        </div>
      </div>}
    </AnalyticsPanel>
  )
}

export function ExecutiveOverviewPage({ teams = [], catalog = [], versions = [], filter = {}, maturityState, onFilterChange, onMaturityChange, onNavigate, onSessionExpired }) {
  useEffect(() => {
    if (globalThis.location?.hash === '#team-performance') globalThis.document?.getElementById('team-performance')?.scrollIntoView({ block: 'start' })
  }, [])
  const [localMonth, setLocalMonth] = useState(currentMonthId())
  const month = isValidMonth(maturityState?.month) ? maturityState.month : localMonth
  const maturityCategory = maturityState?.category === 'general' ? 'general' : 'key'
  const cycle = ['half', 'year'].includes(filter?.cycle) ? filter.cycle : '6m'
  const versionId = filter?.versionId ?? 'all'
  const selectedMaturity = useMaturityOverview(month, maturityCategory, onSessionExpired)
  const overviewActivities = useMemo(() => catalog.filter((activity) => !['dta', 'dtf'].includes(activity.code)), [catalog])
  const metrics = useComputedMetrics(overviewActivities, { dimension: 'time', granularity: 'month', versionId, periodId: null, analysisMonth: month, windowLimit: 12 }, onSessionExpired)
  const metricRows = useMemo(() => buildMetricRows({ activities: overviewActivities, dataByMetric: metrics.data, errors: metrics.errors, month, teams }), [overviewActivities, metrics.data, metrics.errors, month, teams])
  const monthlyTrendMonths = monthWindow(month, 6)
  const periodMonths = analysisWindowMonths(month, cycle)
  const irSourceMonths = monthWindow(month, 12)
  const irOverview = useIROverviewMetrics(irSourceMonths[0], month, versionId, onSessionExpired)
  const irDataByMetric = useMemo(() => irOverview.data ? buildIROverviewMetricData(irOverview.data) : {}, [irOverview.data])
  const irKpiRows = useMemo(() => IR_OVERVIEW_KPIS.map((metric) => ({ metric, activity: { name: 'IR需求' } })), [])
  const metricSummaries = new Map(irKpiRows.map((row) => [row.metric.code, irOverviewMetricSummary({ data: irDataByMetric[row.metric.code], metric: row.metric, month, monthTrendIds: monthlyTrendMonths, periodIds: periodMonths })]))
  const monthCoverage = metricSummaries.get('ai-demand-penetration')?.monthCoverage
  const monthWorkloadCoverage = metricSummaries.get('ai-rd-efficiency')?.monthCoverage
  const periodCoverage = metricSummaries.get('ai-demand-penetration')?.periodCoverage
  const periodWorkloadCoverage = metricSummaries.get('ai-rd-efficiency')?.periodCoverage
  const periodLabel = analysisWindowLabel(month, cycle)
  const teamColors = useColorSlotsForTeams(teams)
  const irTeams = useMemo(() => (irOverview.data?.series ?? []).map((series) => ({ id: series.team_id, name: series.team_name })), [irOverview.data])
  const [teamView, setTeamView] = useState('month')
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  useEffect(() => {
    if (!irTeams.some((team) => String(team.id) === String(selectedTeamId))) setSelectedTeamId(irTeams[0]?.id ?? null)
  }, [irTeams, selectedTeamId])
  const selectedTeam = irTeams.find((team) => String(team.id) === String(selectedTeamId)) ?? null
  const teamMatrixColumns = irKpiRows.map((row) => ({ id: row.metric.code, label: row.metric.name, context: row.metric.unit ?? 'IR需求' }))
  const teamMatrixRows = [
    {
      id: 'company-average',
      label: '全公司均值',
      kind: 'average',
      values: irKpiRows.map((row) => {
        const summary = metricSummaries.get(row.metric.code)
        const value = teamView === 'month' ? summary?.monthCompanyAverage : summary?.periodCompanyAverage
        const delta = teamView === 'month' ? summary?.monthCompanyAverageDelta : summary?.periodCompanyAverageDelta
        return { text: formatMetricValue(row.metric, value), changeText: formatMetricDelta(row.metric, delta, true), changeTone: changeTone(delta) }
      }),
    },
    ...irTeams.map((team) => ({
      id: team.id,
      label: team.name,
      kind: 'team',
      color: teamColors[String(team.id)],
      values: irKpiRows.map((row) => {
        const summary = metricSummaries.get(row.metric.code)
        const teamSummary = teamView === 'month'
          ? summary?.monthTeams.find((item) => String(item.teamId) === String(team.id))
          : summary?.periodTeams.find((item) => String(item.teamId) === String(team.id))
        return {
          text: formatMetricValue(row.metric, teamSummary?.value),
          changeText: formatMetricDelta(row.metric, teamSummary?.delta, true),
          changeTone: changeTone(teamSummary?.delta),
        }
      }),
    })),
  ]
  const previewRows = irKpiRows.filter((row) => ['ai-demand-penetration', 'ai-rd-efficiency'].includes(row.metric.code))
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
    return `${prefix} ${formatMetricDelta(metric, delta)}`
  }

  function irCoverageSummary(scope, coverage, workloadCoverage) {
    return `${scope} IR 需求 ${coverage?.factCount ?? 0} 条 · AI 属性已维护 ${coverage?.knownAiCount ?? 0}/${coverage?.factCount ?? 0} · AI 辅助 IR ${workloadCoverage?.aiAssistedCount ?? '—'} 条 · 完整工作量 ${workloadCoverage?.aiWorkloadCount ?? 0} 条`
  }

  function irMissingDetail(metric, coverage, scope) {
    if (!coverage) return undefined
    if (coverage.factCount === 0) return `${scope}暂无 IR 需求记录`
    if (coverage.knownAiCount === 0) return 'AI 属性尚未维护'
    if (metric.code === 'ai-rd-efficiency' && coverage.aiWorkloadCount > 0) {
      const value = metricSummaries.get(metric.code)?.[scope === '所选月份' ? 'monthValue' : 'periodValue']
      if (value === null) return 'AI 辅助 IR 预估与实际工作量均为 0，无法计算提效'
    }
    if (['ai-rd-efficiency', 'ai-efficiency-workload'].includes(metric.code) && coverage.aiWorkloadCount === 0) {
      return coverage.aiAssistedCount === 0 ? `${scope}暂无 AI 辅助 IR 需求` : 'AI 辅助 IR 工作量字段不完整'
    }
    return undefined
  }

  return (
    <div className="executive-overview analytics-page">
      <AnalysisPageHead
        title="研发总览"
        description="按用户选择月份与统计周期查看整体效能。全局 KPI 暂取 IR 需求，活动明细保留 FactRecord 口径。"
        actions={<AnalyticsFilterToolbar month={month} onMonthChange={changeMonth} showGranularity={false} showCycle cycle={cycle} onCycleChange={changeCycle} showVersion versions={versions} versionId={versionId} onVersionChange={changeVersion} />}
      />
      <AnalyticsSection
        title={`月度核心成效 · ${month}`}
        action={<span className="executive-kpi-coverage">{irOverview.loading ? 'IR 指标加载中' : irOverview.error ? 'IR 指标加载失败' : irCoverageSummary('当月', monthCoverage, monthWorkloadCoverage)}</span>}
      >
        {irOverview.error && <div className="analytics-empty analytics-empty--error" role="alert">IR 需求指标加载失败：{irOverview.error.message}</div>}
        <div className="executive-kpi-grid" aria-label="月度全局 KPI">
          {irKpiRows.map((row) => {
            const summary = metricSummaries.get(row.metric.code)
            const coverage = summary?.monthCoverage
            const missingDetail = !irOverview.loading && !irOverview.error && !Number.isFinite(summary?.monthValue) ? irMissingDetail(row.metric, coverage, '所选月份') : undefined
            const comparison = [Number.isFinite(summary?.previousMonthValue) ? `vs 上月 ${formatMetricValue(row.metric, summary.previousMonthValue)}` : 'vs 上月 —', missingDetail].filter(Boolean).join(' · ')
            return <MetricKpiCard key={row.metric.code} icon={IR_KPI_ICONS[row.metric.code]} label={row.metric.name} value={formatMetricValue(row.metric, summary?.monthValue)} unit={row.metric.unit} delta={metricDelta(row.metric, summary?.monthDelta, '环比')} deltaTone={changeTone(summary?.monthDelta)} comparison={comparison} trendValues={Number.isFinite(summary?.monthValue) ? summary?.monthTrend ?? [] : []} trendLabel={`${row.metric.name}近六个月趋势`} accent={row.metric.accent} loading={irOverview.loading} />
          })}
        </div>
      </AnalyticsSection>
      <AnalyticsSection title={`周期整体成效 · ${periodLabel}（截至${month}）`} action={<span className="executive-kpi-coverage">{irOverview.loading ? 'IR 指标加载中' : irOverview.error ? 'IR 指标加载失败' : irCoverageSummary(periodLabel, periodCoverage, periodWorkloadCoverage)}</span>}>
        <div className="executive-kpi-grid" aria-label="统计周期全局 KPI">
          {irKpiRows.map((row) => {
            const summary = metricSummaries.get(row.metric.code)
            const coverage = summary?.periodCoverage
            const deltaPrefix = row.metric.periodDeltaLabel ?? '较纳入本月前累计'
            const delta = metricDelta(row.metric, summary?.periodDelta, deltaPrefix)
            const missingDetail = !irOverview.loading && !irOverview.error && !Number.isFinite(summary?.periodValue) ? irMissingDetail(row.metric, coverage, '所选统计周期') : undefined
            const comparison = [Number.isFinite(summary?.previousPeriodValue) ? `vs 纳入本月前累计 ${formatMetricValue(row.metric, summary.previousPeriodValue)}` : 'vs 纳入本月前累计 —', missingDetail].filter(Boolean).join(' · ')
            return <MetricKpiCard key={row.metric.code} icon={IR_KPI_ICONS[row.metric.code]} label={row.metric.name} value={formatMetricValue(row.metric, summary?.periodValue)} unit={row.metric.unit} delta={row.metric.unit && Number.isFinite(summary?.periodDelta) ? `${delta} ${row.metric.unit}` : delta} deltaTone={changeTone(summary?.periodDelta)} comparison={comparison} trendValues={Number.isFinite(summary?.periodValue) ? summary?.periodTrend ?? [] : []} trendLabel={`${row.metric.name}${periodLabel}累计趋势`} accent={row.metric.accent} loading={irOverview.loading} />
          })}
        </div>
      </AnalyticsSection>
      <div className="executive-analysis-grid">
        <ExecutiveOverallTrend rows={irKpiRows} dataByMetric={irDataByMetric} periodIds={monthlyTrendMonths} month={month} teamColors={teamColors} onNavigate={onNavigate} loading={irOverview.loading} error={irOverview.error} />
        <ExecutiveLifecycle activities={overviewActivities} metricRows={metricRows} dataByMetric={metrics.data} errors={metrics.errors} month={month} periodIds={monthlyTrendMonths} teams={teams} teamColors={teamColors} onNavigate={onNavigate} />
      </div>
      <div className="executive-final-grid">
        <AnalyticsPanel
          className="executive-maturity-section"
          title="成熟度"
          description={`${month} · 关键研发活动与通用研发能力分别评估；同一活动按团队并列，未评估不补零。`}
          action={<div className="executive-maturity-category" role="group" aria-label="成熟度范围">
            <Button size="small" type={maturityCategory === 'key' ? 'primary' : 'default'} aria-pressed={maturityCategory === 'key'} onClick={() => changeMaturityCategory('key')}>关键研发活动</Button>
            <Button size="small" type={maturityCategory === 'general' ? 'primary' : 'default'} aria-pressed={maturityCategory === 'general'} onClick={() => changeMaturityCategory('general')}>通用研发能力</Button>
          </div>}
        >
          {selectedMaturity.loading && <div className="analytics-empty">正在加载成熟度历史…</div>}
          {selectedMaturity.error && <div className="analytics-empty analytics-empty--error" role="alert">成熟度历史加载失败：{selectedMaturity.error.message}</div>}
          {!selectedMaturity.loading && !selectedMaturity.error && <div className="executive-maturity-grid">
            <section className="executive-maturity-block">
              <header><h3>团队成熟度矩阵</h3><p>0.0 为有效零分；未评估保持空白。</p></header>
              {maturityMatrix.columns.length
                ? <>
                  <MaturityMatrix label={`${month} ${maturityCategory === 'key' ? '关键研发活动' : '通用研发能力'}成熟度矩阵`} columns={maturityMatrix.columns} rows={maturityMatrix.rows} />
                  <div className="executive-maturity-scale" role="img" aria-label="成熟度热力色阶：0.0 为有效零分，1.0 至 5.0 为成熟度刻度">
                    <span>0.0</span><i className="executive-maturity-scale__zero" aria-hidden="true" /><span>1.0</span>
                    <i className="executive-maturity-scale__bar" aria-hidden="true" /><span>5.0</span>
                  </div>
                </>
                : <div className="analytics-empty">当前没有可展示的成熟度活动。</div>}
            </section>
            <section className="executive-maturity-block">
              <header><h3>领域整体成熟度画像</h3><p>本期与上期领域平均；缺失轴不补零。</p></header>
              <MaturityRadar activities={maturityActivities} series={maturitySeries} ariaLabel={`${month} ${maturityCategory === 'key' ? '关键研发活动' : '通用研发能力'}本期与上期领域平均成熟度画像`} />
            </section>
          </div>}
        </AnalyticsPanel>
        <AnalyticsPanel id="team-performance" className="executive-team-section" title="团队表现" description="临时 IR 需求口径；比例/提效变化以 pp 表示，数量/工作量沿用所选周期口径，缺失比较数据保持缺失。" action={<div className="executive-team-mode" role="group" aria-label="团队表现统计范围"><Button size="small" type={teamView === 'month' ? 'primary' : 'default'} aria-pressed={teamView === 'month'} onClick={() => setTeamView('month')}>本月</Button><Button size="small" type={teamView === 'cycle' ? 'primary' : 'default'} aria-pressed={teamView === 'cycle'} onClick={() => setTeamView('cycle')}>统计周期</Button></div>}>
          {teamMatrixColumns.length
            ? <TeamMatrix label={`团队表现 · ${teamView === 'month' ? month : `${periodLabel}截至${month}`}`} columns={teamMatrixColumns} rows={teamMatrixRows} selectedId={selectedTeam?.id} onSelect={setSelectedTeamId} showChanges />
            : <div className="analytics-empty">当前目录没有可展示的数值指标。</div>}
          {selectedTeam && <div className="executive-team-preview">
            <header><h3>{selectedTeam.name} · 趋势预览</h3><Button type="link" onClick={() => onNavigate?.(`/analytics/teams/${selectedTeam.id}`, { state: { returnTo: '/', returnLabel: '研发总览' } })}>查看团队详情 →</Button></header>
            <div className="executive-team-preview__charts">
              {previewRows.map((row) => {
                const rawData = irDataByMetric[row.metric.code]
                const data = rawData ? metricDataForPeriods(rawData, periodMonths) : null
                const series = data?.series?.filter((item) => String(item.team_id) === String(selectedTeam.id)) ?? []
                const selectedData = data ? { ...data, series } : null
                const option = selectedData && hasNumericValues(selectedData) ? { ...buildTrendOption({ data: selectedData, metric: row.metric, teamColors, selectedPeriodId: 'all', averageLabel: '全公司均值', compact: true }), legend: { show: false } } : null
                const teamColor = teamColors[String(selectedTeam.id)] ?? DATAVIZ_COLORS.team[0]
                return <ChartCard key={row.metric.code} title={`${selectedTeam.name} · ${row.metric.name}`} action={<div className="executive-team-preview__legend"><span><i style={{ '--team-matrix-color': teamColor }} />{selectedTeam.name}</span><BenchmarkLegend /></div>} option={option} height={120} ariaLabel={`${selectedTeam.name} ${row.metric.name}与全公司均值趋势`} empty={`当前 IR 统计周期暂无${row.metric.name}事实。`} onClick={() => onNavigate?.(`/analytics/teams/${selectedTeam.id}`, { state: { returnTo: '/', returnLabel: '研发总览' } })} />
              })}
            </div>
          </div>}
        </AnalyticsPanel>
      </div>
      {catalog.length === 0 && <p className="analytics-muted">当前目录为空，成熟度图表没有活动轴。</p>}
    </div>
  )
}

export function ActivitiesPage(props) {
  return <AnalyticsDetailPage {...props} kind="key" title="研发活动" description="按活动查看月度与统计周期成效、团队趋势和团队差异；原始事实可按时间或版本迭代筛选，成熟度按独立自然月评估。" />
}

export function CapabilitiesPage(props) {
  return <AnalyticsDetailPage {...props} kind="general" title="研发能力" description="按能力结构查看当前状态与演进；布尔能力按团队状态呈现，不合并为比例，成熟度按自然月。" />
}

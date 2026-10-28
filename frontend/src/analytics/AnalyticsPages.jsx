import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { BugOutlined, CalendarOutlined, ClockCircleOutlined, CodeOutlined, DownOutlined, FileTextOutlined, PieChartOutlined, TagOutlined, TeamOutlined, ThunderboltOutlined, ToolOutlined } from '@ant-design/icons'
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
import { buildIROverviewMetricData, IR_OVERVIEW_KPIS, irCoverageBreakdown, irOverviewMetricSummary, useIROverviewMetrics } from '../overview/irKpiData'
import { buildTrendOption, efficiencyOutlierAxisLabel, hasEfficiencyOutlier } from '../overview/chartOption'
import { factTrendSnapshot, lifecycleMetricSlots, maturityMatrixData, metricDataForPeriods } from '../overview/executiveLogic'
import MaturityRadar from '../overview/MaturityRadar'
import { useMaturityOverview } from '../overview/maturityData'
import { booleanStatusRows } from '../metricDetail/metricDetailLogic'
import { buildActivityKpiModel, yearOverYearGrowth } from './activityKpiLogic'
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
  latestPeriodId,
  filterToSearchParams,
  maturityStateToSearchParams,
  monthWindow,
  previousMonthId,
  TEAM_COLOR_STORAGE_KEY,
} from '../overview/overviewLogic'
import './analytics.css'

const EMPTY_ACTIVITY_LIST = []
const METRIC_UNAVAILABLE_MESSAGE = '指标暂不可用，请稍后重试。'

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
  const heatmapLevel = (value, comparisonValues) => {
    if (!Number.isFinite(value)) return null
    const finiteValues = comparisonValues.filter(Number.isFinite)
    if (!finiteValues.length) return null
    const minimum = Math.min(...finiteValues)
    const maximum = Math.max(...finiteValues)
    if (maximum === minimum) return 3
    return Math.max(1, Math.min(5, Math.floor(((value - minimum) / (maximum - minimum)) * 5) + 1))
  }
  return {
    columns: snapshots.map(({ metric }) => ({ id: metric.id, label: metric.name, heatmap: true })),
    rows: [
      {
        id: 'company-average',
        label: '全公司均值',
        kind: 'average',
        values: snapshots.map(({ metric, companyAverage, teams: metricTeams }) => ({
          text: formatMetricValue(metric, companyAverage),
          heatmapLevel: heatmapLevel(companyAverage, metricTeams.map((team) => team.point?.value)),
        })),
      },
      ...teams.map((team) => ({
        id: team.id,
        label: team.name,
        kind: 'team',
        color: teamColors[String(team.id)],
        values: snapshots.map(({ metric, companyAverage, teams: rows }) => {
          const value = rows.find((row) => String(row.teamId) === String(team.id))?.point?.value
          const benchmarkRelation = Number.isFinite(value) && Number.isFinite(companyAverage)
            ? value > companyAverage ? 'above' : value < companyAverage ? 'below' : 'equal'
            : undefined
          const benchmarkDelta = Number.isFinite(value) && Number.isFinite(companyAverage)
            ? formatMetricDelta(metric, value - companyAverage, true)
            : undefined
          return {
            text: formatMetricValue(metric, value),
            benchmarkRelation,
            benchmarkDelta,
            heatmapLevel: heatmapLevel(value, rows.map((row) => row.point?.value)),
          }
        }),
      })),
    ],
  }
}

function capabilityMetricTrendTitle(metric) {
  if (metric.code === 'mrr-effective-rate') return 'AI有效检视率趋势'
  if (metric.code === 'mrr-effective-count') return 'AI有效检视意见数趋势'
  return `${metric.name}趋势`
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
                <td><strong>{formatMetricValue(metric, snapshot.companyAverage)}</strong><small className="activity-raw-evidence__detail" title={snapshot.previousValue}>{snapshot.previousValue}</small></td>
                <td><strong>{formatMetricValue(metric, point?.value)}</strong><small className="activity-raw-evidence__detail" title={formatFactSummary(metric, point)}>{formatFactSummary(metric, point)}</small></td>
                <td><strong>{point?.fact_count ?? '—'}</strong><small className="activity-raw-evidence__detail" title={`有效团队 ${snapshot.coverage}`}>有效团队 {snapshot.coverage}</small></td>
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

function CapabilityEvidencePanels({ metrics, dataByMetric, periodId, teamColors, loading = false, error = null }) {
  const evidence = metrics.map((metric) => {
    const metricData = dataByMetric[metric.id]
    const snapshot = metricSnapshot(metricData, metric, periodId)
    return { metric, metricData, snapshot, point: snapshot.domainPoint }
  })
  const countEvidence = evidence.find(({ metric, snapshot, point }) => {
    const teamValues = snapshot.teams.map((team) => team.point?.value)
    return metric.type === 'count' && Number.isFinite(point?.value) && teamValues.length > 0 && teamValues.every(Number.isFinite) && teamValues.reduce((sum, value) => sum + value, 0) === point.value
  })
  const distributionOption = countEvidence && {
    animationDuration: 180,
    tooltip: { trigger: 'item', confine: true, formatter: (item) => `${item.marker}${item.name}：${formatMetricValue(countEvidence.metric, item.value)}（${Number(item.percent).toFixed(1)}%）` },
    legend: { orient: 'vertical', right: 0, top: 'middle', itemWidth: 9, itemHeight: 7, textStyle: { color: DATAVIZ_COLORS.inkSecondary, fontSize: 11 } },
    graphic: { type: 'text', left: '30%', top: 'middle', style: { text: `${formatMetricValue(countEvidence.metric, countEvidence.point.value)}\n团队合计`, fill: DATAVIZ_COLORS.inkSecondary, fontSize: 12, fontWeight: 650, lineHeight: 18, textAlign: 'center' } },
    series: [{
      name: countEvidence.metric.name,
      type: 'pie',
      radius: ['48%', '72%'],
      center: ['30%', '50%'],
      label: { show: false },
      labelLine: { show: false },
      itemStyle: { borderColor: DATAVIZ_COLORS.grid, borderWidth: 2 },
      data: countEvidence.snapshot.teams.map((team, index) => ({
        name: team.teamName,
        value: team.point.value,
        itemStyle: { color: teamColors[String(team.teamId)] ?? DATAVIZ_COLORS.team[index % DATAVIZ_COLORS.team.length] },
      })),
    }],
  }
  const trendEvidence = evidence.find(({ metric }) => metric.type !== 'count') ?? evidence[0]
  const trendTeamName = trendEvidence?.metricData?.series?.[0]?.team_name
  const fullTrendOption = trendEvidence && hasNumericValues(trendEvidence.metricData) && buildTrendOption({ data: trendEvidence.metricData, metric: trendEvidence.metric, teamColors, selectedPeriodId: 'all', compact: true })
  const trendOption = fullTrendOption && {
    ...fullTrendOption,
    legend: { ...fullTrendOption.legend, data: [trendTeamName, '全公司均值'].filter(Boolean) },
    series: fullTrendOption.series.filter((series) => series.name === trendTeamName || series.name === '全公司均值'),
  }
  const emptyReason = periodId === 'all'
    ? '选择单一周期查看合并原始量；全部周期只显示趋势。'
    : !metrics.length
      ? '当前能力没有数值型支持指标。'
      : null
  return (
    <section className="capability-evidence-section" aria-label="支撑指标与证据">
      <header><h2>支撑指标与证据</h2><p>团队原始量分布、同指标团队趋势与事实覆盖。</p></header>
      <div className="capability-evidence-grid">
        <article className="capability-evidence-card">
          <h3>{countEvidence ? `${countEvidence.metric.name}分布` : '团队原始量分布'}</h3>
          {loading
            ? <div className="capability-evidence-empty" role="status">正在加载原始量证据…</div>
            : error
              ? <div className="capability-evidence-empty" role="alert">原始量证据加载失败：{error.message}</div>
            : emptyReason
              ? <div className="capability-evidence-empty">{emptyReason}</div>
              : distributionOption
            ? <EChart option={distributionOption} height={136} ariaLabel={`${countEvidence.metric.name}团队原始量分布；团队合计与合并原始量一致`} />
            : <div className="capability-evidence-empty">当前团队原始量不完整或与合并口径不一致，暂不绘制分布。</div>}
        </article>
        <article className="capability-evidence-card">
          <h3>{trendEvidence ? `${trendEvidence.metric.name}趋势` : '同指标趋势'}</h3>
          {loading
            ? <div className="capability-evidence-empty" role="status">正在加载趋势数据…</div>
            : error
              ? <div className="capability-evidence-empty" role="alert">趋势数据加载失败：{error.message}</div>
            : emptyReason && !trendOption
              ? <div className="capability-evidence-empty">{emptyReason}</div>
              : trendOption
            ? <EChart option={trendOption} height={136} ariaLabel={`${trendEvidence.metric.name}近六个月${trendTeamName ?? '团队'}与全公司均值趋势`} />
            : <div className="capability-evidence-empty">暂无趋势数据。</div>}
        </article>
        <article className="capability-evidence-card">
          <h3>合并结果与事实覆盖</h3>
          <table aria-label="合并结果与事实覆盖">
            <thead><tr><th scope="col">原始指标</th><th scope="col">合并结果</th><th scope="col">有效团队</th></tr></thead>
            <tbody>{evidence.length ? evidence.map(({ metric, point, snapshot }) => <tr key={metric.id}>
              <th scope="row">{metric.name}</th>
              <td><strong>{formatMetricValue(metric, point?.value)}</strong><small title={formatFactSummary(metric, point)}>{formatFactSummary(metric, point)}</small><small>{point?.fact_count ?? '—'} 条事实</small></td>
              <td><strong>{snapshot.coverage}</strong></td>
            </tr>) : <tr><td colSpan={3}>{loading ? '正在加载…' : emptyReason ?? '暂无事实。'}</td></tr>}</tbody>
          </table>
        </article>
      </div>
    </section>
  )
}

function activityCoverageOption(breakdown) {
  const countMetric = { type: 'count' }
  const count = (value) => formatMetricValue(countMetric, value)
  const categories = breakdown.status === 'unknown-only'
    ? [{ name: 'AI属性未知', value: breakdown.unknown, itemStyle: { color: DATAVIZ_COLORS.companyAverage } }]
    : breakdown.status === 'ready' ? [
      { name: 'AI已辅助', value: breakdown.covered, itemStyle: { color: DATAVIZ_COLORS.team[0] } },
      { name: '已维护未辅助', value: breakdown.uncovered, itemStyle: { color: DATAVIZ_COLORS.team[1] } },
      { name: 'AI属性未知', value: breakdown.unknown, itemStyle: { color: DATAVIZ_COLORS.companyAverage } },
    ] : []
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
        text: `${count(breakdown.total)}\nIR需求`,
        fill: DATAVIZ_COLORS.inkSecondary,
        fontSize: 17,
        fontWeight: 650,
        lineHeight: 22,
        textAlign: 'center',
      },
    },
    series: [{
      name: 'IR需求AI属性拆解',
      type: 'pie',
      radius: ['48%', '74%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      label: { show: false },
      labelLine: { show: false },
      itemStyle: { borderColor: DATAVIZ_COLORS.grid, borderWidth: 2 },
      data: categories,
    }],
  }
}

function ActivityVolumeBreakdown({ metricData, periodIds, loading = false, error = false }) {
  const observedBreakdown = irCoverageBreakdown(metricData, periodIds)
  const breakdown = ['ready', 'unknown-only'].includes(observedBreakdown.status)
    ? observedBreakdown
    : { status: observedBreakdown.status, total: null, covered: null, uncovered: null, unknown: null }
  const count = (value) => formatMetricValue({ type: 'count' }, value)
  const percentage = (value) => Number.isFinite(value) && breakdown.total > 0 ? `${(value / breakdown.total * 100).toFixed(1)}%` : '—'
  const rows = [
    { id: 'assisted', label: 'AI已辅助', value: breakdown.covered },
    { id: 'unassisted', label: '已维护未辅助', value: breakdown.uncovered },
    { id: 'unknown', label: 'AI属性未知', value: breakdown.unknown },
  ]
  return <div className="activity-volume-breakdown">
    <div className="activity-volume-breakdown__chart">
      <EChart
        option={activityCoverageOption(breakdown)}
        height="var(--activity-volume-chart-height, 156px)"
        ariaLabel={`IR需求整体覆盖拆解：合计${count(breakdown.total)}；${rows.map((row) => `${row.label}${count(row.value)}`).join('，')}`}
      />
      {(loading || error || ['missing', 'invalid'].includes(breakdown.status)) && <span className="activity-summary-chart-state" role={loading ? 'status' : error ? 'alert' : 'img'}>
        {loading ? '正在加载整体 IR 覆盖拆解…' : error ? '整体 IR 覆盖拆解暂不可用；计数保持缺失。' : breakdown.status === 'missing' ? '暂无 IR 需求事实' : 'IR 覆盖计数不完整'}
      </span>}
    </div>
    <table className="activity-volume-breakdown__table">
      <thead><tr><th scope="col">IR需求范围</th><th scope="col">数量</th><th scope="col">占比</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}>
        <th scope="row"><i className={`activity-volume-breakdown__swatch activity-volume-breakdown__swatch--${row.id}`} />{row.label}</th>
        <td>{count(row.value)}</td><td>{percentage(row.value)}</td>
      </tr>)}
      <tr className="activity-volume-breakdown__total"><th scope="row">合计</th><td>{count(breakdown.total)}</td><td>100%</td></tr></tbody>
    </table>
  </div>
}

function activityWorkloadOption(periodIds, workloadValues, growthValues) {
  return {
    animationDuration: 180,
    color: [DATAVIZ_COLORS.team[0], DATAVIZ_COLORS.team[1]],
    grid: { left: 24, right: 42, top: 34, bottom: 22, containLabel: true },
    legend: { top: 2, left: 'center', itemWidth: 12, itemHeight: 8, itemGap: 12, textStyle: { color: DATAVIZ_COLORS.muted, fontSize: 10 } },
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: { type: 'cross' },
      formatter: (items) => items.map((item) => {
        const value = Number(item.value)
        const formatted = Number.isFinite(value)
          ? item.seriesName === '同比增幅' ? `${(value * 100).toFixed(1)}%` : `${value.toLocaleString('zh-CN')} 人天`
          : '—'
        return `${item.marker}${item.seriesName}：${formatted}`
      }).join('<br/>'),
    },
    xAxis: {
      type: 'category',
      data: periodIds,
      boundaryGap: true,
      axisLine: { lineStyle: { color: DATAVIZ_COLORS.axis } },
      axisTick: { show: false },
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 10, hideOverlap: true },
    },
    yAxis: [
      {
        type: 'value',
        name: '人天',
        nameTextStyle: { color: DATAVIZ_COLORS.muted, fontSize: 10 },
        splitLine: { lineStyle: { color: DATAVIZ_COLORS.grid } },
        axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 10, formatter: (value) => Number(value).toLocaleString('zh-CN') },
      },
      {
        type: 'value',
        splitLine: { show: false },
        axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 10, formatter: (value) => `${Math.round(Number(value) * 100)}%` },
      },
    ],
    series: [
      {
        name: 'AI提效工作量',
        type: 'bar',
        data: workloadValues.map((value) => Number.isFinite(value) ? value : null),
        barMaxWidth: 28,
        itemStyle: { color: DATAVIZ_COLORS.team[0], borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: 'series' },
      },
      {
        name: '同比增幅',
        type: 'line',
        yAxisIndex: 1,
        data: growthValues.map((value) => Number.isFinite(value) ? value : null),
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: DATAVIZ_COLORS.team[1], width: 2 },
        itemStyle: { color: DATAVIZ_COLORS.team[1] },
      },
    ],
  }
}

function activityMetricTotal(data, periodIds, valueKey) {
  const selected = new Set(periodIds.map(String))
  const points = (data?.domain_summary ?? []).filter((point) => selected.has(String(point.period_id)) && point.fact_count > 0)
  if (!points.length || points.some((point) => !Number.isFinite(point[valueKey]))) return null
  return points.reduce((sum, point) => sum + point[valueKey], 0)
}

function activityCountDelta(value, previousValue) {
  if (!Number.isFinite(value) || !Number.isFinite(previousValue)) return null
  const delta = value - previousValue
  const formatted = formatMetricValue({ type: 'count' }, Math.abs(delta))
  return delta > 0 ? '+' + formatted : delta < 0 ? '-' + formatted : '0'
}

function ActivityRawSparkline({ values, label }) {
  const width = 112
  const height = 22
  const segments = sparklineSegments(values, width, height)
  const trendDescription = values.map((value) => Number.isFinite(value) ? formatMetricValue({ type: 'count' }, value) : '缺失').join('、')
  if (!segments.length) return <span className="activity-raw-summary-missing" role="img" aria-label={label + '近六个月趋势无可绘制线段；数值：' + trendDescription}>—</span>
  return <svg className="activity-raw-summary-sparkline" viewBox="0 0 112 22" role="img" aria-label={label + '近六个月趋势；数值：' + trendDescription}>
    {segments.map((segment, index) => <g key={index}>
      <path d={segment.area} className="activity-raw-summary-sparkline__area" />
      <path d={segment.line} className="activity-raw-summary-sparkline__line" />
    </g>)}
  </svg>
}

function ActivityRawSummaryTable({ rows, month }) {
  const display = (value, row) => !row.configured
    ? '未配置'
    : row.loading ? '加载中' : row.error ? '暂不可用' : Number.isFinite(value) ? formatMetricValue({ type: 'count' }, value) : '—'
  return <table className="activity-raw-summary-table" aria-label={'原始指标月度摘要 · ' + month}>
    <thead><tr><th scope="col">原始指标</th><th scope="col">本月数值</th><th scope="col">上月数值</th><th scope="col">环比变化</th><th scope="col">趋势</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.label}>
      <th scope="row" title={row.source} aria-label={row.label + '，来源：' + row.source} data-source={row.source}>{row.label}</th>
      <td>{display(row.value, row)}</td>
      <td>{display(row.previousValue, row)}</td>
      <td className={row.deltaValue > 0 ? 'is-positive' : row.deltaValue < 0 ? 'is-negative' : undefined}>{!row.configured ? '未配置' : row.loading ? '加载中' : row.error ? '暂不可用' : row.deltaText ?? '—'}</td>
      <td>{!row.configured ? '未配置' : row.loading ? '加载中' : row.error ? '暂不可用' : <ActivityRawSparkline values={row.trendValues} label={row.label} />}</td>
    </tr>)}</tbody>
  </table>
}

function pageWideActivityTeamModel(dataByMetric, month, monthTrendIds, cyclePeriodIds, teams) {
  const kpis = IR_OVERVIEW_KPIS.map((definition) => ({
    code: definition.code,
    definition,
    summary: irOverviewMetricSummary({
      data: dataByMetric[definition.code],
      metric: definition,
      month,
      monthTrendIds,
      periodIds: cyclePeriodIds,
    }),
  }))
  const valuesForTeam = (teamId) => kpis.map(({ summary }) => {
    const team = summary?.periodTeams.find((item) => String(item.teamId) === String(teamId))
    return { textValue: team?.value ?? null, changeValue: team?.delta ?? null }
  })
  return {
    kpis,
    teamRows: [
      {
        id: 'company-average',
        label: '全公司均值',
        kind: 'average',
        values: kpis.map(({ summary }) => ({
          textValue: summary?.periodCompanyAverage ?? null,
          changeValue: summary?.periodCompanyAverageDelta ?? null,
        })),
      },
      ...teams.map((team) => ({ id: team.id, label: team.name, kind: 'team', values: valuesForTeam(team.id) })),
    ],
  }
}

const ACTIVITY_DIRECTORY_ICONS = {
  SA设计: <FileTextOutlined />,
  SE设计: <TeamOutlined />,
  开发设计: <PieChartOutlined />,
  编码开发: <CodeOutlined />,
  测试用例生成: <FileTextOutlined />,
  测试用例执行: <ThunderboltOutlined />,
  DTS缺陷分析: <BugOutlined />,
  DTS缺陷修复: <ToolOutlined />,
}

const CAPABILITY_DIRECTORY_ICONS = {
  MR代码检视: <CodeOutlined />,
  'MR-E2E能力': <CalendarOutlined />,
  CodeCheck问题修复: <ToolOutlined />,
  三方件治理: <TagOutlined />,
  漏洞修复: <BugOutlined />,
  自动化构建部署: <ThunderboltOutlined />,
  白盒安全问题修复: <FileTextOutlined />,
}

function ActivityPageWideSummary({ activities, teams, teamColors, month, cycle, cyclePeriodIds, trendMonthIds, onSelectTeam, onSessionExpired }) {
  const cycleLabel = analysisWindowLabel(month, cycle)
  const currentIrFromMonth = [cyclePeriodIds[0], trendMonthIds[0]].filter(Boolean).sort()[0] ?? month
  const priorYearMonths = useMemo(() => monthWindow(month, 18).slice(0, 6), [month])
  const currentIr = useIROverviewMetrics(currentIrFromMonth, month, 'all', onSessionExpired)
  const priorYearIr = useIROverviewMetrics(priorYearMonths[0] ?? month, priorYearMonths.at(-1) ?? month, 'all', onSessionExpired)
  const currentIrData = useMemo(() => currentIr.data ? buildIROverviewMetricData(currentIr.data) : {}, [currentIr.data])
  const priorYearIrData = useMemo(() => priorYearIr.data ? buildIROverviewMetricData(priorYearIr.data) : {}, [priorYearIr.data])
  const irTeamModel = useMemo(
    () => pageWideActivityTeamModel(currentIrData, month, trendMonthIds, cyclePeriodIds, teams),
    [currentIrData, cyclePeriodIds, month, teams, trendMonthIds],
  )
  const teamData = useMemo(() => activityTeamMatrix(irTeamModel, teamColors), [irTeamModel, teamColors])
  const rawSourceActivities = useMemo(() => activities
    .map((activity) => ({ ...activity, metrics: activity.metrics.filter((metric) => ['tcg-rate', 'tce-count'].includes(metric.code)) }))
    .filter((activity) => activity.metrics.length > 0), [activities])
  const rawMetricFilter = useMemo(() => ({
    dimension: 'time',
    granularity: 'month',
    versionId: 'all',
    periodId: null,
    analysisMonth: month,
    windowLimit: 6,
  }), [month])
  const rawMetrics = useComputedMetrics(rawSourceActivities, rawMetricFilter, onSessionExpired)
  const rawMetricsByCode = useMemo(() => Object.fromEntries(rawSourceActivities.flatMap((activity) => activity.metrics.map((metric) => [metric.code, { metric, data: rawMetrics.data[metric.id] }]))), [rawMetrics.data, rawSourceActivities])
  const workloadMetric = currentIrData['ai-efficiency-workload']
  const priorWorkloadMetric = priorYearIrData['ai-efficiency-workload']
  const workloadTrend = useMemo(() => {
    const valuesByMonth = new Map((workloadMetric?.domain_summary ?? []).map((point) => [String(point.period_id), point.value ?? null]))
    const priorValuesByMonth = new Map((priorWorkloadMetric?.domain_summary ?? []).map((point) => [String(point.period_id), point.value ?? null]))
    const values = trendMonthIds.map((id) => valuesByMonth.get(String(id)) ?? null)
    const prior = priorYearMonths.map((id) => priorValuesByMonth.get(String(id)) ?? null)
    return { values, growth: values.map((value, index) => yearOverYearGrowth(value, prior[index])) }
  }, [priorWorkloadMetric, priorYearMonths, trendMonthIds, workloadMetric])
  const workloadOption = useMemo(
    () => activityWorkloadOption(trendMonthIds, workloadTrend.values, workloadTrend.growth),
    [trendMonthIds, workloadTrend],
  )
  const hasWorkloadData = [...workloadTrend.values, ...workloadTrend.growth].some((value) => Number.isFinite(value))
  const countSummary = useMemo(() => {
    const irMetric = currentIrData['ai-covered-ir-count']
    const irCountSummary = irOverviewMetricSummary({ data: irMetric, metric: IR_OVERVIEW_KPIS[2], month, monthTrendIds: trendMonthIds, periodIds: [month] })
    const factCountRow = (label, code, valueKey, source) => {
      const record = rawMetricsByCode[code]
      const configured = Boolean(record)
      const trendValues = configured ? trendMonthIds.map((id) => activityMetricTotal(record.data, [id], valueKey)) : []
      const value = configured ? activityMetricTotal(record.data, [month], valueKey) : null
      const previousValue = configured ? activityMetricTotal(record.data, [previousMonthId(month)], valueKey) : null
      return {
        label,
        configured,
        source: configured ? source : '目录未配置 ' + code,
        value,
        previousValue,
        deltaValue: Number.isFinite(value) && Number.isFinite(previousValue) ? value - previousValue : null,
        deltaText: activityCountDelta(value, previousValue),
        trendValues,
        loading: configured && rawMetrics.loading,
        error: configured && Boolean(rawMetrics.errors[record.metric.id]),
      }
    }
    const irTrendValues = irCountSummary?.monthTrend ?? []
    const irValue = irCountSummary?.monthValue ?? null
    const irPreviousValue = irCountSummary?.previousMonthValue ?? null
    return [
      { label: 'AI覆盖IR需求数', configured: true, source: 'IR 总览 · AI覆盖需求数', value: irValue, previousValue: irPreviousValue, deltaValue: Number.isFinite(irValue) && Number.isFinite(irPreviousValue) ? irValue - irPreviousValue : null, deltaText: activityCountDelta(irValue, irPreviousValue), trendValues: irTrendValues, loading: currentIr.loading, error: Boolean(currentIr.error) },
      { label: 'AI覆盖AR需求数', configured: false, source: '目录未定义唯一 AR 覆盖数量' },
      { label: 'SE设计文档生成数', configured: false, source: '目录未定义设计文档生成数量' },
      { label: '开发详细设计生成数', configured: false, source: '目录未定义详细设计生成数量' },
      factCountRow('测试用例生成数', 'tcg-rate', 'numerator', 'tcg-rate · AI生成用例数'),
      factCountRow('测试用例执行数', 'tce-count', 'value', 'tce-count · 执行用例数'),
    ]
  }, [currentIr.loading, currentIr.error, currentIrData, month, rawMetrics.errors, rawMetrics.loading, rawMetricsByCode, trendMonthIds])
  const coverageMetricData = currentIrData['ai-demand-penetration']
  const hasError = Boolean(currentIr.error || Object.keys(rawMetrics.errors).length)

  return <div className="activity-page-summary">
    <AnalyticsPanel className="activity-team-matrix" title="团队差异" description={currentIr.loading
      ? <span role="status">正在加载整体 IR 团队差异…</span>
      : currentIr.error
        ? <span role="alert">整体 IR 团队差异暂不可用；数值保持缺失。</span>
        : `${cycleLabel}截至${month} · 页面整体 IR 指标，有数据团队等权比较；不随活动选择变化。点击团队下钻。`}>
      <div className="activity-team-matrix__surface">
        <TeamMatrix
          label={`页面整体 IR 团队差异 · ${cycleLabel}截至${month}`}
          columns={teamData.columns}
          rows={teamData.rows}
          showChanges
          visibleChangeHeaders
          groupedChangeLayout
          onSelect={onSelectTeam}
        />
      </div>
    </AnalyticsPanel>
    <div className="activity-lower-grid">
      <AnalyticsPanel title="指标拆解与业务量" description={`${cycleLabel}截至${month} · IR需求整体AI属性拆解；未知属性单独保留。`}>
        <div className="activity-lower-grid__reserved-surface">
          <ActivityVolumeBreakdown metricData={coverageMetricData} periodIds={cyclePeriodIds} loading={currentIr.loading} error={Boolean(currentIr.error)} />
        </div>
      </AnalyticsPanel>
      <AnalyticsPanel title="AI提效工作量趋势" description="蓝柱：IR每月节省人天；绿线：同比增幅。缺去年同期或其值不为正时留空。">
        <div className="activity-lower-grid__reserved-surface activity-lower-grid__reserved-surface--trend">
          <div className="activity-workload-chart">
            <EChart option={workloadOption} height="var(--activity-workload-chart-height, 156px)" ariaLabel={`整体 IR 近六个月 AI提效工作量蓝色柱状图和同比增幅绿色曲线：${trendMonthIds.map((id, index) => `${id} 工作量 ${formatMetricValue({ type: 'count', unit: '人天' }, workloadTrend.values[index])}，同比 ${Number.isFinite(workloadTrend.growth[index]) ? `${(workloadTrend.growth[index] * 100).toFixed(1)}%` : '缺失'}`).join('；')}`} />
            {(currentIr.loading || currentIr.error || !hasWorkloadData) && <span className="activity-summary-chart-state" role={currentIr.loading ? 'status' : currentIr.error ? 'alert' : 'img'}>
              {currentIr.loading ? '正在加载整体 IR 工作量趋势…' : currentIr.error ? '整体 IR 工作量趋势暂不可用；数据保持缺失。' : '当前六个月没有 IR 工作量事实；同比点保持缺失。'}
            </span>}
          </div>
        </div>
      </AnalyticsPanel>
      <AnalyticsPanel title={`原始指标摘要 · ${month}`} description={hasError ? <span role="alert">部分原始指标暂不可用；行结构保留，数值保持缺失。</span> : '按月展示 · 环比变化为本月减上月；趋势为同一来源近六个月，缺失周期留空。'}>
        <div className="activity-lower-grid__reserved-surface activity-raw-summary-surface">
          <ActivityRawSummaryTable rows={countSummary} month={month} />
        </div>
      </AnalyticsPanel>
    </div>
  </div>
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

function MetricAnalysisCard({ activity, metric, data, error, loading, teams, teamColors, onOpen, onNavigate, granularity, dimension, periodId, title, description, chartHeight = 220, showSummary = true, showDetailLink = true, showPointMarkers = false, tooltipTrigger = 'axis', reserveChartSpace = false }) {
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
      {!reserveChartSpace && loading && <div className="analytics-empty">正在加载指标数据…</div>}
      {!reserveChartSpace && !loading && error && <div className="analytics-empty analytics-empty--error" role="alert">{METRIC_UNAVAILABLE_MESSAGE}</div>}
      {!reserveChartSpace && !loading && !error && metric.type !== 'boolean' && !hasChartValue && <div className="analytics-empty">近六个月没有可展示的历史事实。</div>}
      {!loading && !error && metric.type !== 'boolean' && hasChartValue && noCurrentValue && <div className="analytics-empty analytics-empty--current">所选周期（{snapshot.currentPeriod?.label ?? '当前周期'}）暂无事实；图中仍保留历史有效数据。</div>}
      {!loading && !error && metric.type === 'boolean' && <BooleanStatusList rows={statusRows} teamColors={teamColors} onNavigate={onNavigate} />}
      {reserveChartSpace
        ? <div className="analytics-chart-card__plot-state" style={{ height: chartHeight }}>
            {loading && <div className="feedback-state" role="status">正在加载指标数据…</div>}
            {error && <div className="feedback-state feedback-state--error" role="alert">{METRIC_UNAVAILABLE_MESSAGE}</div>}
            {!loading && !error && metric.type !== 'boolean' && !hasChartValue && <div className="feedback-state" role="status">近六个月没有可展示的历史事实。</div>}
            {!loading && !error && metric.type !== 'boolean' && hasChartValue && option && <EChart option={option} height={chartHeight} ariaLabel={`${activity.name} ${title ?? metric.name}，来源指标 ${metric.name} 趋势图`} onClick={() => onOpen(detail)} />}
          </div>
        : !loading && !error && metric.type !== 'boolean' && option && hasChartValue && <EChart option={option} height={chartHeight} ariaLabel={`${activity.name} ${metric.name} 趋势图`} onClick={() => onOpen(detail)} />}
      {!loading && !error && data && metric.type === 'boolean' && knownStatuses > 0 && <div className="analytics-analysis-meta"><SummaryStats value={`${enabledTeams} 个团队具备`} previous="—" coverage={`${knownStatuses} / ${teams.length}`} /></div>}
      {showSummary && !loading && !error && hasChartValue && metric.type !== 'boolean' && periodId === 'all' && <p className="analytics-muted">显示全部周期趋势；选择单一周期可查看当期团队比较。</p>}
      {showSummary && !loading && !error && hasChartValue && data && metric.type !== 'boolean' && periodId !== 'all' && !noCurrentValue && <div className="analytics-analysis-meta"><SummaryStats value={snapshot.currentValue} previous={snapshot.previousValue} coverage={snapshot.coverage} /></div>}
      {showDetailLink && onNavigate && <button type="button" className="analytics-detail-link" onClick={() => onNavigate(`/analytics/metrics/${metric.id}`)}>打开现有指标详情 →</button>}
    </article>
  )
}

function capabilityMaturityMatrixData(data, dimensions, teams) {
  const source = maturityMatrixData(data)
  const sourceRowsById = new Map(source.rows.map((row) => [String(row.id), row]))
  const sourceColumnsById = new Map(source.columns.map((column, index) => [String(column.id), index]))
  const sourceRows = [
    source.rows.find((row) => row.kind === 'average') ?? { id: 'domain-average', label: '领域平均', kind: 'average', values: [] },
    ...teams.map((team) => sourceRowsById.get(String(team.id)) ?? { id: team.id, label: team.name, values: [] }),
  ]
  return {
    columns: sourceRows.map((row) => ({ id: row.id, label: row.label })),
    rows: dimensions.map((dimension) => {
      const sourceIndex = sourceColumnsById.get(String(dimension.activity_id ?? dimension.id))
      return {
      id: dimension.activity_id ?? dimension.id,
      label: dimension.activity_name ?? dimension.name,
      values: sourceRows.map((row) => sourceIndex === undefined ? { text: null, level: null } : row.values?.[sourceIndex] ?? { text: null, level: null }),
      }
    }),
  }
}

function MaturityAnalysisCard({ data, history = [], month, teams, catalogActivities = [], loading = false, error = null }) {
  const previousData = history.at(-2)?.data
  const dataDimensions = new Map((data?.activities ?? []).map((dimension) => [String(dimension.activity_id), dimension]))
  const dimensions = catalogActivities.length
    ? catalogActivities.map((dimension) => dataDimensions.get(String(dimension.id)) ?? { activity_id: dimension.id, activity_name: dimension.name })
    : data?.activities ?? []
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
  const matrix = capabilityMaturityMatrixData(data, dimensions, teams)
  const stateMessage = loading ? '正在加载成熟度历史…' : error ? `成熟度加载失败：${error.message}` : null
  return (
    <section className="analytics-maturity-summary" aria-label="通用研发能力成熟度画像">
      <header className="analytics-maturity-summary__header">
        <div><p className="analytics-eyebrow">人工月度评估</p><strong>通用研发能力</strong></div>
        <span>当前/上期领域平均 · {month}</span>
      </header>
      <div className="analytics-maturity-summary__visuals">
        <section className="analytics-maturity-summary__matrix" aria-label="通用研发能力团队成熟度矩阵">
          <h3>能力维度 × 团队 · {month}</h3>
          <p>{stateMessage ? <span role={error ? 'alert' : 'status'}>{stateMessage}</span> : '维度来自现有通用能力目录；未评估保持为空。'}</p>
          {dimensions.length
            ? <MaturityMatrix label={`通用研发能力成熟度矩阵 · ${month}`} rowHeading="能力维度" columns={matrix.columns} rows={matrix.rows} />
            : <div className="analytics-empty" role="status">当前没有配置通用研发能力成熟度维度。</div>}
        </section>
        <section className="analytics-maturity-summary__radar" aria-label="通用研发能力领域平均成熟度雷达">
          <h3>领域平均成熟度雷达</h3>
          <MaturityRadar layout="capability" activities={dimensions} series={radarSeries} ariaLabel="通用研发能力当前与上期领域平均成熟度雷达" />
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

function useMonthPicker(month, onMonthChange) {
  const triggerRef = useRef(null)
  const optionRefs = useRef([])
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(Number(month?.slice(0, 4)) || new Date().getFullYear())
  useEffect(() => {
    if (!open) return
    const monthNumber = Number(month?.slice(5))
    if (monthNumber >= 1 && monthNumber <= 12) optionRefs.current[monthNumber - 1]?.focus()
  }, [open, month])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function toggle() {
    if (open) {
      close()
      return
    }
    setYear(Number(month?.slice(0, 4)) || new Date().getFullYear())
    setOpen(true)
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    const offsets = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }
    const offset = offsets[event.key]
    if (!offset) return
    const currentIndex = optionRefs.current.indexOf(document.activeElement)
    if (currentIndex < 0) return
    event.preventDefault()
    optionRefs.current[(currentIndex + offset + 12) % 12]?.focus()
  }

  function choose(monthNumber) {
    onMonthChange?.(`${year}-${String(monthNumber).padStart(2, '0')}`)
    close()
  }

  return { triggerRef, optionRefs, open, year, setYear, close, toggle, handleKeyDown, choose }
}

function MonthPickerPopover({ picker, month }) {
  if (!picker.open) return null
  return <div className="overview-month-picker" role="dialog" aria-label="选择月份" onKeyDown={picker.handleKeyDown}>
    <header className="overview-month-picker__header">
      <button type="button" aria-label="上一年" onClick={() => picker.setYear((year) => year - 1)}>‹</button>
      <strong>{picker.year}年</strong>
      <button type="button" aria-label="下一年" onClick={() => picker.setYear((year) => year + 1)}>›</button>
    </header>
    <div className="overview-month-picker__grid" role="group" aria-label={`${picker.year}年月份`}>
      {Array.from({ length: 12 }, (_, index) => {
        const monthNumber = index + 1
        const option = `${picker.year}-${String(monthNumber).padStart(2, '0')}`
        return <button
          key={option}
          ref={(element) => { picker.optionRefs.current[index] = element }}
          type="button"
          aria-pressed={option === month}
          onClick={() => picker.choose(monthNumber)}
        >{monthNumber}月</button>
      })}
    </div>
  </div>
}

function AnalyticsFilterToolbar({ month, onMonthChange, granularity, onGranularityChange, showGranularity, cycle, onCycleChange, showCycle = false, label = '分析筛选', className = '' }) {
  const idPrefix = useId()
  const monthId = `${idPrefix}-month`
  const cycleId = `${idPrefix}-cycle`
  const granularityId = `${idPrefix}-granularity`
  const monthPicker = useMonthPicker(month, onMonthChange)
  const monthLabel = isValidMonth(month) ? `${month.slice(0, 4)}年${Number(month.slice(5))}月` : month
  const [cycleOpen, setCycleOpen] = useState(false)
  const [granularityOpen, setGranularityOpen] = useState(false)
  return (
    <FilterToolbar label={label} className={`analytics-filter-toolbar ${className}`.trim()}>
      <div className="analytics-page-controls">
        {month && onMonthChange && <div className="analytics-filter-card analytics-filter-card--month" role="group" aria-labelledby={`${monthId}-label`}>
          <span id={`${monthId}-label`} className="analytics-filter-card__label"><CalendarOutlined aria-hidden="true" />月份</span>
          <span className="analytics-filter-card__value"><button ref={monthPicker.triggerRef} id={monthId} type="button" className="analytics-filter-card__month-trigger" aria-label="月份" aria-haspopup="dialog" aria-expanded={monthPicker.open} onClick={monthPicker.toggle}><strong>{monthLabel}</strong><DownOutlined aria-hidden="true" /></button></span>
          <MonthPickerPopover picker={monthPicker} month={month} />
        </div>}
        {showCycle && <div className="analytics-filter-card" role="group" aria-labelledby={`${cycleId}-label`}>
          <span id={`${cycleId}-label`} className="analytics-filter-card__label"><ClockCircleOutlined aria-hidden="true" />统计周期</span>
          <span className="analytics-filter-card__value"><Select
            aria-label="统计周期"
            className="analytics-filter-card__select"
            size="small"
            variant="borderless"
            open={cycleOpen}
            onOpenChange={setCycleOpen}
            onChange={(value) => { onCycleChange?.(value); setCycleOpen(false) }}
            options={[{ value: '6m', label: '近6个月' }, { value: 'half', label: '本半年度' }, { value: 'year', label: '年度累计' }]}
            popupMatchSelectWidth={144}
            getPopupContainer={(triggerNode) => triggerNode?.closest?.('.analytics-filter-card') ?? document.body}
            style={{ width: '100%', flex: '1 1 auto' }}
            suffixIcon={<DownOutlined aria-hidden="true" />}
            value={cycle ?? '6m'}
          /></span>
        </div>}
        {showGranularity && <div className="analytics-filter-card" role="group" aria-labelledby={`${granularityId}-label`}>
          <span id={`${granularityId}-label`} className="analytics-filter-card__label"><ClockCircleOutlined aria-hidden="true" />时间粒度</span>
          <span className="analytics-filter-card__value"><Select
            aria-label="时间粒度"
            className="analytics-filter-card__select"
            size="small"
            variant="borderless"
            open={granularityOpen}
            onOpenChange={setGranularityOpen}
            onChange={(value) => { onGranularityChange?.(value); setGranularityOpen(false) }}
            options={[{ value: 'month', label: '月' }, { value: 'week', label: '周' }, { value: 'day', label: '日' }]}
            popupMatchSelectWidth={128}
            getPopupContainer={(triggerNode) => triggerNode?.closest?.('.analytics-filter-card') ?? document.body}
            style={{ width: '100%', flex: '1 1 auto' }}
            suffixIcon={<DownOutlined aria-hidden="true" />}
            value={granularity ?? 'month'}
          /></span>
        </div>}
      </div>
    </FilterToolbar>
  )
}

function OverviewFilterControls({ month, onMonthChange, cycle, onCycleChange }) {
  const monthPicker = useMonthPicker(month, onMonthChange)
  const monthTrigger = monthPicker.triggerRef
  const monthOpen = monthPicker.open
  const cycleSelect = useRef(null)
  const [cycleOpen, setCycleOpen] = useState(false)
  const monthLabel = isValidMonth(month) ? `${month.slice(0, 4)}年${Number(month.slice(5))}月` : month

  return <FilterToolbar label="" className="analytics-filter-toolbar overview-filter-toolbar">
    <div className="analytics-page-controls">
      <div className="overview-filter-card overview-filter-card--month">
        <button ref={monthTrigger} className="overview-filter-card__trigger" type="button" aria-label="月份" aria-haspopup="dialog" aria-expanded={monthOpen} onClick={monthPicker.toggle}>
          <CalendarOutlined aria-hidden="true" />
          <span className="overview-filter-card__copy"><small>月份</small><strong>{monthLabel}</strong></span>
          <DownOutlined aria-hidden="true" />
        </button>
        <MonthPickerPopover picker={monthPicker} month={month} />
      </div>
      <div className="overview-filter-card overview-filter-card--cycle" role="group" aria-label="统计周期" onClick={(event) => { if (!event.target.closest('.ant-select')) { cycleSelect.current?.focus?.(); setCycleOpen(true) } }}>
        <ClockCircleOutlined aria-hidden="true" />
        <span className="overview-filter-card__copy overview-filter-card__copy--cycle"><small>统计周期</small>
          <Select
            aria-label="统计周期"
            className="overview-cycle-select"
            size="small"
            variant="borderless"
            style={{ width: 82, flex: '0 0 82px' }}
            popupMatchSelectWidth={128}
            ref={cycleSelect}
            open={cycleOpen}
            onOpenChange={setCycleOpen}
            onChange={(value) => { onCycleChange?.(value); setCycleOpen(false) }}
            options={[{ value: '6m', label: '近6个月' }, { value: 'half', label: '本半年度' }, { value: 'year', label: '年度累计' }]}
            suffixIcon={null}
            value={cycle ?? '6m'}
          />
        </span>
        <DownOutlined aria-hidden="true" />
      </div>
    </div>
  </FilterToolbar>
}

function KpiAccessory() {
  return <span className="metric-card__accessory-bars"><i /><i /><i /></span>
}

export function AnalyticsDetailPage({ kind, title, description, catalog = [], teams = [], filter, onFilterChange, onNavigate, onSessionExpired, maturityState, onMaturityChange }) {
  const [localMonth, setLocalMonth] = useState(currentMonthId())
  const [localGranularity, setLocalGranularity] = useState(kind === 'general' && ['day', 'week', 'month'].includes(filter?.granularity) ? filter.granularity : 'month')
  const [selectedActivityId, setSelectedActivityId] = useState(null)
  const [pendingActivityId, setPendingActivityId] = useState(null)
  const [selectedCapabilityId, setSelectedCapabilityId] = useState(null)
  const month = isValidMonth(maturityState?.month) ? maturityState.month : localMonth
  const activityTrendMonthIds = useMemo(() => monthWindow(month, 6), [month])
  const metricDimension = 'time'
  const granularity = kind === 'key' ? (filter?.granularity ?? 'month') : localGranularity
  const activities = useMemo(() => catalog.filter((activity) => activity.kind === kind), [catalog, kind])
  const metricOptions = useMemo(() => activities.flatMap((activity) => activity.metrics.map((metric) => ({ value: String(metric.id), label: `${activity.name} · ${metric.name}` }))), [activities])
  const selectedMetricId = kind === 'key' && filter?.metricId && filter.metricId !== 'all' ? String(filter.metricId) : null
  const selectedMetricActivity = selectedMetricId ? activities.find((activity) => activity.metrics.some((metric) => String(metric.id) === selectedMetricId)) : null
  const selectedMetric = selectedMetricActivity?.metrics.find((metric) => String(metric.id) === selectedMetricId) ?? null
  const committedActivity = selectedMetricActivity ?? activities.find((activity) => String(activity.id) === String(selectedActivityId)) ?? activities[0] ?? null
  const pendingActivity = activities.find((activity) => String(activity.id) === String(pendingActivityId)) ?? null
  const requestedActivity = pendingActivity ?? committedActivity
  const selectedCapability = activities.find((activity) => String(activity.id) === String(selectedCapabilityId)) ?? activities[0] ?? null
  const maturity = useMaturityOverview(month, kind, onSessionExpired, kind === 'general')
  const versionId = 'all'
  const cycle = ['half', 'year'].includes(filter?.cycle) ? filter.cycle : '6m'
  const cyclePeriodIds = useMemo(() => analysisWindowMonths(month, cycle), [cycle, month])
  const coreWindowLimit = Math.max(6, cyclePeriodIds.length)
  const metricFilter = useMemo(() => ({
    dimension: metricDimension,
    granularity,
    versionId,
    periodId: kind === 'key' ? (filter?.periodId ?? null) : null,
    analysisMonth: month,
    windowLimit: granularity === 'day' ? 30 : granularity === 'week' ? 12 : coreWindowLimit,
  }), [filter?.periodId, granularity, kind, metricDimension, month, versionId, coreWindowLimit])
  const coreMetricFilter = useMemo(() => ({ dimension: 'time', granularity: 'month', versionId, periodId: null, analysisMonth: month, windowLimit: coreWindowLimit }), [coreWindowLimit, month, versionId])
  const metricActivities = useMemo(() => {
    const activity = kind === 'key' ? requestedActivity : selectedCapability
    return activity ? [activity] : []
  }, [kind, requestedActivity, selectedCapability])
  const retainActivityMetrics = kind === 'key' && Boolean(pendingActivity)
  const metrics = useComputedMetrics(metricActivities, metricFilter, onSessionExpired, { retainPreviousData: retainActivityMetrics })
  const usesCoreMetricQuery = kind === 'key'
    && metricFilter.dimension === coreMetricFilter.dimension
    && metricFilter.granularity === coreMetricFilter.granularity
    && metricFilter.versionId === coreMetricFilter.versionId
    && metricFilter.analysisMonth === coreMetricFilter.analysisMonth
    && metricFilter.windowLimit === coreMetricFilter.windowLimit
  const separateCoreMetrics = useComputedMetrics(usesCoreMetricQuery ? EMPTY_ACTIVITY_LIST : kind === 'key' ? metricActivities : EMPTY_ACTIVITY_LIST, coreMetricFilter, onSessionExpired, { retainPreviousData: retainActivityMetrics })
  const coreMetrics = usesCoreMetricQuery ? metrics : separateCoreMetrics
  const activitySelectionSettled = Boolean(pendingActivity && !metrics.loading && (usesCoreMetricQuery || !separateCoreMetrics.loading))
  const selectedActivity = pendingActivity && activitySelectionSettled ? pendingActivity : committedActivity
  const activitySelectionPending = Boolean(pendingActivity && !activitySelectionSettled)
  const hasCommittedActivityMetrics = Boolean(committedActivity?.metrics.some((metric) => Object.hasOwn(coreMetrics.data, metric.id)))
  const keepCommittedActivityVisible = activitySelectionPending && hasCommittedActivityMetrics
  const metricError = Object.values(metrics.errors)[0]
  const timePeriods = useMemo(() => {
    const data = selectedMetric ? metrics.data[selectedMetric.id] : Object.values(metrics.data).find((item) => item?.periods?.length)
    return data?.periods ?? []
  }, [metrics.data, selectedMetric])
  const periodOptions = timePeriods
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
  const capabilityNumericMetrics = selectedCapability?.metrics.filter((metric) => metric.type !== 'boolean') ?? []
  const capabilityStatusMetrics = [...capabilityNumericMetrics].sort((left, right) => Number(left.type === 'count') - Number(right.type === 'count'))
  const capabilityTeamDifferenceBase = teamDifferenceData(capabilityNumericMetrics, metrics.data, metricPeriodId, teams, teamColors)
  const capabilityTeamDifference = capabilityTeamDifferenceBase

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
    if (kind !== 'key' || !pendingActivity || !activitySelectionSettled) return
    setSelectedActivityId(pendingActivity.id)
    setPendingActivityId(null)
  }, [activitySelectionSettled, kind, pendingActivity])

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

  function changeGranularity(nextGranularity) {
    setLocalGranularity(nextGranularity)
    onFilterChange?.({ ...(filter ?? {}), dimension: 'time', granularity: nextGranularity, versionId: 'all', periodId: null }, { history: 'push' })
  }

  function selectActivity(activityId) {
    const nextActivity = activities.find((activity) => String(activity.id) === String(activityId))
    if (!nextActivity) return
    if (String(nextActivity.id) === String(committedActivity?.id)) {
      setPendingActivityId(null)
      return
    }
    setPendingActivityId(activityId)
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
      const error = kpi.metric && coreMetrics.errors[kpi.metric.id] ? METRIC_UNAVAILABLE_MESSAGE : undefined
      return <MetricKpiCard
        key={kpi.code}
        icon={IR_KPI_ICONS[kpi.definition.code]}
        label={kpi.definition.name}
        value={formatMetricValue(kpi.definition, value)}
        unit={kpi.definition.unit}
        delta={Number.isFinite(delta) ? activityKpiDelta(kpi, delta) : undefined}
        deltaTone={changeTone(delta)}
        comparison={error ? undefined : `${isMonth ? 'vs 上月' : 'vs 纳入本月前'} ${activityKpiValue(kpi, baseline, true)}`}
        trend={error ? <div className="metric-card__empty-trend" role="img" aria-label={`${kpi.definition.name}趋势加载失败`} /> : undefined}
        trendValues={isMonth ? kpi.monthTrend : kpi.cycleTrend}
        trendLabel={`${selectedActivity.name} · ${kpi.definition.name}${isMonth ? '月度' : '统计周期'}趋势`}
        accent={kpi.definition.accent}
        loading={coreMetrics.loading && !keepCommittedActivityVisible}
        error={error}
      />
    })
  }

  function teamDetailsPath(teamId) {
    const params = filterToSearchParams({ dimension: 'time', granularity: 'month', versionId: 'all', periodId: null, metricId: 'all', cycle: '6m', ...(filter ?? {}) })
    maturityStateToSearchParams({ ...(maturityState ?? {}), month }).forEach((value, key) => params.set(key, value))
    params.set('activityId', String(selectedActivity.id))
    return `/analytics/teams/${teamId}?${params.toString()}#team-lifecycle`
  }

  const pageHead = <AnalysisPageHead
    title={kind === 'key' && selectedActivity ? `${title} / ${selectedActivity.name}` : kind === 'general' && selectedCapability ? `${title} / ${selectedCapability.name}` : title}
    description={description}
    actions={kind === 'key'
      ? <div className="activity-page-actions">
          <AnalyticsFilterToolbar label="" className="analytics-global-filter-toolbar" month={month} onMonthChange={changeMonth} cycle={cycle} onCycleChange={changeCycle} showCycle />
          <FilterBar filter={filter ?? { dimension: 'time', granularity: 'month', versionId: 'all', periodId: null, metricId: 'all', cycle: '6m' }} onChange={onFilterChange ?? (() => undefined)} periods={timePeriods} loading={metrics.loading && !keepCommittedActivityVisible} metricOptions={metricOptions} showPrimaryControls={false} allowIteration={false} />
        </div>
      : kind === 'general'
      ? <div className="capability-page-actions">
          <AnalyticsFilterToolbar
            label=""
            className="analytics-global-filter-toolbar"
            month={month}
            onMonthChange={changeMonth}
            granularity={granularity}
            onGranularityChange={changeGranularity}
            showGranularity
          />
        </div>
      : undefined}
  />

  return (
    <div className={`analytics-page${kind === 'general' ? ' capability-page' : ''}`}>
      {kind === 'key' && pageHead}
      {kind === 'general' && !selectedCapability && pageHead}
      {kind === 'key' && selectedActivity && <>
        <div className="activity-upper-grid">
          <AnalyticsDirectory
            label="活动分析"
            title="活动分析"
            count={`${activities.length} 项`}
            className="analytics-directory--panel activity-directory"
            items={activities.map((activity) => ({ id: activity.id, label: activity.name, ariaLabel: `选择活动：${activity.name}`, meta: `${activity.metrics.length} 个指标`, icon: ACTIVITY_DIRECTORY_ICONS[activity.name] }))}
            selectedId={selectedActivity.id}
            pendingId={activitySelectionPending ? pendingActivity?.id : null}
            onSelect={selectActivity}
          />
          <div className="analytics-workspace activity-workspace" aria-busy={activitySelectionPending || undefined}>
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
                loading={metrics.loading && !keepCommittedActivityVisible}
                teams={teams}
                teamColors={teamColors}
                onOpen={drawer.open}
                granularity={granularity}
                dimension={metricDimension}
                periodId={metricPeriodId}
                title={`${selectedActivity.name} · ${kpi.definition.name}趋势`}
                description={`来源：${kpi.metric.name} · 同指标全公司均值`}
                chartHeight="var(--activity-core-chart-height, 210px)"
                showSummary={false}
                showDetailLink={false}
                showPointMarkers
                tooltipTrigger="item"
                reserveChartSpace
              />
              : <ChartCard
                key={kpi.code}
                title={`${selectedActivity.name} · ${kpi.definition.name}趋势`}
                description="当前目录未定义对应类型的 FactRecord 指标。"
                ariaLabel={`${selectedActivity.name} ${kpi.definition.name}趋势图`}
                height="var(--activity-core-chart-height, 210px)"
                empty="当前目录未定义对应类型的 FactRecord 指标。"
              />)}</div>
          </AnalyticsSection>
          </div>
        </div>
        <ActivityPageWideSummary
          activities={activities}
          teams={teams}
          teamColors={teamColors}
          month={month}
          cycle={cycle}
          cyclePeriodIds={cyclePeriodIds}
          trendMonthIds={activityTrendMonthIds}
          onSelectTeam={(teamId) => onNavigate?.(teamDetailsPath(teamId), { state: { returnTo: '/analytics/activities', returnLabel: '研发活动' } })}
          onSessionExpired={onSessionExpired}
        />
      </>}
      {kind === 'general' && selectedCapability && <>
        <div className="analytics-directory-workspace capability-directory-workspace">
        <AnalyticsDirectory
          label="能力结构目录"
          title="能力结构"
          count={`${activities.length} 项`}
          className="analytics-directory--panel capability-directory"
          items={activities.map((activity) => ({ id: activity.id, label: activity.name, ariaLabel: `查看能力：${activity.name}`, icon: CAPABILITY_DIRECTORY_ICONS[activity.name] }))}
          selectedId={selectedCapability.id}
          onSelect={setSelectedCapabilityId}
        />
        <div className="analytics-workspace">
          {pageHead}
          <AnalyticsSection title="能力状态" description={`周期 ${metricPeriodLabel} · 数量显示合并总量，比例显示同指标全公司均值；有效团队范围见卡片。`}>
            {selectedCapability && <div className="capability-kpi-grid" style={{ '--capability-kpi-columns': Math.max(1, capabilityStatusMetrics.length) }}>
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
                comparison={metrics.errors[metric.id]?.message ? undefined : `前期 ${formatMetricValue(metric, previousValue)} · 有效${snapshot.coverage}${!Number.isFinite(currentValue) && lastTrendPeriodLabel ? ` · 趋势至 ${lastTrendPeriodLabel}` : ''}`}
                trendValues={trend.map((point) => point?.value ?? null)}
                trendLabel={capabilityMetricTrendTitle(metric)}
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
              title={capabilityMetricTrendTitle(metric)}
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
              reserveChartSpace
            />)}
              {!capabilityNumericMetrics.length && <div className="analytics-empty">该能力以团队布尔状态呈现；不绘制 0/1 时间趋势。</div>}
            </div>
          </AnalyticsSection>
          <div className="capability-comparison-grid">
            <AnalyticsPanel title="团队差异" description={`周期 ${metricPeriodLabel} · 每列底色按团队数值从低到高显示；仅表示相对大小，不代表质量。`}>
            <div className="capability-heatmap-legend" role="img" aria-label="同列相对值：低到高；颜色不代表绩效好坏">
              <span>相对值</span><span>低</span><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><span>高</span>
            </div>
            {capabilityTeamDifference.columns.length > 0
              ? <TeamMatrix label={`${selectedCapability.name} ${metricPeriodLabel} 团队差异`} heatmap {...capabilityTeamDifference} onSelect={(teamId) => onNavigate?.(`/analytics/teams/${teamId}`, { state: { returnTo: '/analytics/capabilities', returnLabel: '研发能力' } })} />
              : <div className="analytics-empty" role={metrics.loading ? 'status' : undefined}>该能力没有可取平均的数值指标；布尔状态保持逐团队展示。</div>}
          </AnalyticsPanel>
          <CapabilityEvidencePanels metrics={capabilityNumericMetrics} dataByMetric={metrics.data} periodId={metricPeriodId} teamColors={teamColors} loading={metrics.loading} error={metricError} />
          </div>
        </div>
        </div>
        <AnalyticsSection title="成熟度画像" description="人工月度评估与指标事实分开；矩阵和雷达轴使用现有通用研发能力目录，不从事实指标推导。">
          <MaturityAnalysisCard data={maturity.data} history={maturity.history} month={month} teams={teams} catalogActivities={activities} loading={maturity.loading} error={maturity.error} />
        </AnalyticsSection>
      </>}
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
    ? '所选月暂无 IR'
    : currentMonthPoint && !Number.isFinite(currentMonthPoint.value) ? '所选月无可计算值' : null
  const visibleTeams = data?.series?.filter((series) => (series.values ?? []).some((point) => Number.isFinite(point?.value))) ?? []
  const overlapNote = visibleTeams.length === 1 ? ` · ${visibleTeams[0].team_name} 1/${data?.series?.length ?? 0}，暂不可多团队对照` : ''
  const averageLabel = '全公司均值'
  const trendOption = row && data && hasTrend ? buildTrendOption({ data, metric: row.metric, teamColors, selectedPeriodId: month, averageLabel }) : null
  const option = trendOption ? {
    ...trendOption,
    ...(row.metric.unit ? { yAxis: { ...trendOption.yAxis, name: row.metric.unit } } : {}),
    ...(row.metric.unit ? { yAxis: { ...trendOption.yAxis, name: row.metric.unit } } : {}),
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
  return <AnalyticsPanel className="executive-overall-trend" title="核心指标趋势" titleExtra={action} description={row ? `IR需求临时数据${row.metric.unit ? ` · 单位：${row.metric.unit}` : ''}${currentMonthNote ? ` · ${currentMonthNote}` : ''}${overlapNote}` : '当前没有可展示的全局KPI'}>
    <div className="executive-overall-trend__plot" style={{ height: 360 }}>
      {!row ? <div className="analytics-empty">当前没有可展示的全局KPI。</div>
        : error ? <div className="analytics-empty analytics-empty--error" role="alert">IR指标趋势加载失败：{error.message}</div>
          : loading && !rawData ? <div className="analytics-empty" role="status">正在加载IR指标趋势…</div>
            : !hasTrend ? <div className="analytics-empty analytics-empty--current" role="status">当前 IR 时间窗口没有可展示的团队事实。</div>
              : <EChart option={option} height={360} ariaLabel={`${row.metric.name}IR需求团队与全公司均值趋势图${row.metric.unit ? `，单位 ${row.metric.unit}` : ''}`} onClick={() => onNavigate?.('/data/requirements/design')} />}
    </div>
  </AnalyticsPanel>
}

function ExecutiveLifecycle({ activities = [], metricRows = [], dataByMetric, errors = {}, month, periodIds = [], teams = [], teamColors = {}, onNavigate }) {
  const lifecycleStages = useMemo(() => {
    const byCode = new Map(activities.filter((activity) => activity.kind === 'key').map((activity) => [activity.code, activity]))
    return [
      { id: 'sa', label: 'SA设计', activity: byCode.get('sa'), icon: <FileTextOutlined /> },
      { id: 'se', label: 'SE设计', activity: byCode.get('se'), icon: <TeamOutlined /> },
      { id: 'dd', label: '开发设计', activity: byCode.get('dd'), icon: <PieChartOutlined /> },
      { id: 'cd', label: '编码开发', activity: byCode.get('cd'), icon: <CodeOutlined /> },
      { id: 'tcg', label: '测试用例生成', activity: byCode.get('tcg'), icon: <ClockCircleOutlined /> },
      { id: 'tce', label: '测试用例执行', activity: byCode.get('tce'), emptyMessage: '目录仅定义用例执行数和执行率，没有渗透率或提效类型指标。', icon: <ThunderboltOutlined /> },
    ]
  }, [activities])
  const [selectedStageId, setSelectedStageId] = useState('sa')
  const selectedStage = lifecycleStages.find((stage) => stage.id === selectedStageId) ?? lifecycleStages[0] ?? null
  useEffect(() => {
    if (!lifecycleStages.some((stage) => stage.id === selectedStageId)) {
      setSelectedStageId(lifecycleStages[0]?.id ?? null)
    }
  }, [lifecycleStages, selectedStageId])

  return (
    <AnalyticsPanel className="executive-lifecycle" title="研发关键环节" titleExtra={<Button type="link" onClick={() => onNavigate?.('/analytics/activities')}>查看研发活动</Button>} description="每个环节展示需求渗透率与研发提效；缺失保持为空。" action={<span className="executive-lifecycle__legend"><span>AI需求渗透率</span><span>AI研发提效</span></span>}>
      <div className="executive-lifecycle__list" role="group" aria-label="选择关键研发环节">
        {lifecycleStages.map((stage) => {
          const slots = lifecycleMetricSlots(stage.activity)
          return <button key={stage.id} type="button" className="executive-lifecycle__item" aria-label={`选择关键环节：${stage.label}`} aria-pressed={stage.id === selectedStage?.id} onClick={() => setSelectedStageId(stage.id)}>
          <span className="executive-lifecycle__icon" aria-hidden="true">{stage.icon}</span><strong>{stage.label}</strong>
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
            const baseOption = data && hasTrend ? buildTrendOption({ data, metric, teamColors, selectedPeriodId: 'all', averageLabel: '领域平均', compact: true }) : null
            const option = baseOption ? {
              ...baseOption,
              grid: { ...baseOption.grid, left: 0, right: 0, top: 34, bottom: 3 },
              xAxis: { ...baseOption.xAxis, axisLabel: { ...baseOption.xAxis.axisLabel, margin: 4 } },
              yAxis: { ...baseOption.yAxis, axisLabel: { ...baseOption.yAxis.axisLabel, margin: 4 } },
            } : null
            const sourceLabel = selectedStage.activity?.name ?? selectedStage.label
            const description = metric
              ? `来源：${sourceLabel} · ${metric.name}${outlierAxisLabel ? ` · 图轴 ${outlierAxisLabel}，越界点贴边显示并保留悬浮原值` : ''}`
              : undefined
            const empty = metric ? `当前统计周期暂无${metric.name}事实。` : `目录未配置${slot.label}类型指标。`
            return <ChartCard key={slot.id} title={`${selectedStage.label} · ${slot.label}趋势`} description={description} option={option} height={158} reservePlotSpace ariaLabel={`${selectedStage.label}${slot.label}趋势图，团队与领域平均`} error={metric && errors[metric.id] ? `指标加载失败：${errors[metric.id].message}` : undefined} empty={empty} onClick={metric ? () => onNavigate?.(`/analytics/metrics/${metric.id}`) : undefined} />
          })}
        </div>
      </div>}
    </AnalyticsPanel>
  )
}

export function ExecutiveOverviewPage({ teams = [], catalog = [], filter = {}, maturityState, onFilterChange, onMaturityChange, onNavigate, onSessionExpired }) {
  useEffect(() => {
    if (globalThis.location?.hash === '#team-performance') globalThis.document?.getElementById('team-performance')?.scrollIntoView({ block: 'start' })
  }, [])
  const [localMonth, setLocalMonth] = useState(currentMonthId())
  const month = isValidMonth(maturityState?.month) ? maturityState.month : localMonth
  const maturityCategory = maturityState?.category === 'general' ? 'general' : 'key'
  const cycle = ['half', 'year'].includes(filter?.cycle) ? filter.cycle : '6m'
  const versionId = 'all'
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
  const irTeams = useMemo(() => {
    const available = (irOverview.data?.series ?? []).map((series) => ({ id: series.team_id, name: series.team_name }))
    return available.length ? available : teams.map(({ id, name }) => ({ id, name }))
  }, [irOverview.data?.series, teams])
  const [teamView, setTeamView] = useState('month')
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  useEffect(() => {
    if (!irTeams.some((team) => String(team.id) === String(selectedTeamId))) setSelectedTeamId(irTeams[0]?.id ?? null)
  }, [irTeams, selectedTeamId])
  const selectedTeam = irTeams.find((team) => String(team.id) === String(selectedTeamId)) ?? null
  const teamMatrixColumns = irKpiRows.map((row) => ({ id: row.metric.code, label: row.metric.name, ...(row.metric.unit ? { context: row.metric.unit } : {}) }))
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

  function changeMaturityCategory(category) {
    if (category !== maturityCategory) onMaturityChange?.({ ...(maturityState ?? {}), category }, { history: 'push' })
  }

  function metricDelta(metric, delta, prefix) {
    return `${prefix} ${formatMetricDelta(metric, delta, true)}`
  }

  function irCoverageSummary(scope, coverage, workloadCoverage) {
    return `${scope} IR 需求 ${coverage?.factCount ?? 0} 条 · AI 属性已维护 ${coverage?.knownAiCount ?? 0}/${coverage?.factCount ?? 0} · AI 辅助 IR ${workloadCoverage?.aiAssistedCount ?? '—'} 条 · 完整工作量 ${workloadCoverage?.aiWorkloadCount ?? 0} 条`
  }

  function irMissingDetail(metric, coverage, scope) {
    if (!coverage) return undefined
    if (coverage.factCount === 0) return scope === '所选月份' ? '本月暂无 IR' : '周期内暂无 IR'
    if (coverage.knownAiCount === 0) return '未维护 AI 属性'
    if (metric.code === 'ai-rd-efficiency' && coverage.aiWorkloadCount > 0) {
      const value = metricSummaries.get(metric.code)?.[scope === '所选月份' ? 'monthValue' : 'periodValue']
      if (value === null) return 'AI 辅助 IR 工作量为 0，无法计算提效'
    }
    if (['ai-rd-efficiency', 'ai-efficiency-workload'].includes(metric.code) && coverage.aiWorkloadCount === 0) {
      return coverage.aiAssistedCount === 0 ? '暂无 AI 辅助 IR' : 'AI 辅助 IR 工作量缺失'
    }
    return undefined
  }

  return (
    <div className="executive-overview analytics-page">
      <AnalysisPageHead
        title="研发总览"
        description="按用户选择月份与统计周期查看整体效能。全局 KPI 暂取 IR 需求，活动明细保留 FactRecord 口径。"
        actions={<OverviewFilterControls month={month} onMonthChange={changeMonth} cycle={cycle} onCycleChange={changeCycle} />}
      />
      <AnalyticsSection
        title={`月度核心成效 · ${month}`}
        action={<span className="executive-kpi-coverage" role={irOverview.error ? 'alert' : 'status'} title={irOverview.error?.message}>{irOverview.loading ? 'IR 指标加载中' : irOverview.error ? 'IR 指标加载失败' : irCoverageSummary('当月', monthCoverage, monthWorkloadCoverage)}</span>}
      >
        <div className="executive-kpi-grid" aria-label="月度全局 KPI">
          {irKpiRows.map((row) => {
            const summary = metricSummaries.get(row.metric.code)
            const coverage = summary?.monthCoverage
            const missingDetail = !irOverview.loading && !irOverview.error && !Number.isFinite(summary?.monthValue) ? irMissingDetail(row.metric, coverage, '所选月份') : undefined
            const comparison = [Number.isFinite(summary?.previousMonthValue) ? `vs 上月 ${formatMetricValue(row.metric, summary.previousMonthValue)}` : 'vs 上月 —', missingDetail].filter(Boolean).join(' · ')
            return <MetricKpiCard key={row.metric.code} icon={IR_KPI_ICONS[row.metric.code]} accessory={<KpiAccessory />} label={row.metric.name} value={formatMetricValue(row.metric, summary?.monthValue)} unit={row.metric.unit} delta={metricDelta(row.metric, summary?.monthDelta, '环比')} deltaTone={changeTone(summary?.monthDelta)} comparison={comparison} trendValues={Number.isFinite(summary?.monthValue) ? summary?.monthTrend ?? [] : []} trendLabel={`${row.metric.name}近六个月趋势`} accent={row.metric.accent} loading={irOverview.loading} />
          })}
        </div>
      </AnalyticsSection>
      <AnalyticsSection title={`周期整体成效 · ${periodLabel}（截至${month}）`} action={<span className="executive-kpi-coverage" role={irOverview.error ? 'alert' : 'status'} title={irOverview.error?.message}>{irOverview.loading ? 'IR 指标加载中' : irOverview.error ? 'IR 指标加载失败' : irCoverageSummary(periodLabel, periodCoverage, periodWorkloadCoverage)}</span>}>
        <div className="executive-kpi-grid" aria-label="统计周期全局 KPI">
          {irKpiRows.map((row) => {
            const summary = metricSummaries.get(row.metric.code)
            const coverage = summary?.periodCoverage
            const deltaPrefix = row.metric.periodDeltaLabel ?? '较前期'
            const delta = metricDelta(row.metric, summary?.periodDelta, deltaPrefix)
            const missingDetail = !irOverview.loading && !irOverview.error && !Number.isFinite(summary?.periodValue) ? irMissingDetail(row.metric, coverage, '所选统计周期') : undefined
            const comparison = [Number.isFinite(summary?.previousPeriodValue) ? `vs 前累计 ${formatMetricValue(row.metric, summary.previousPeriodValue)}` : 'vs 前累计 —', missingDetail].filter(Boolean).join(' · ')
            return <MetricKpiCard key={row.metric.code} icon={IR_KPI_ICONS[row.metric.code]} accessory={<KpiAccessory />} label={row.metric.name} value={formatMetricValue(row.metric, summary?.periodValue)} unit={row.metric.unit} delta={delta} deltaTone={changeTone(summary?.periodDelta)} comparison={comparison} trendValues={Number.isFinite(summary?.periodValue) ? summary?.periodTrend ?? [] : []} trendLabel={`${row.metric.name}${periodLabel}累计趋势`} accent={row.metric.accent} loading={irOverview.loading} />
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
          description={`${month} · 0.0 为有效值；未评估留空。`}
          action={<div className="executive-maturity-category" role="group" aria-label="成熟度范围">
            <Button size="small" type={maturityCategory === 'key' ? 'primary' : 'default'} aria-pressed={maturityCategory === 'key'} onClick={() => changeMaturityCategory('key')}>关键研发活动</Button>
            <Button size="small" type={maturityCategory === 'general' ? 'primary' : 'default'} aria-pressed={maturityCategory === 'general'} onClick={() => changeMaturityCategory('general')}>通用研发能力</Button>
          </div>}
        >
          <div className="executive-maturity-grid">
            <section className="executive-maturity-block">
              {selectedMaturity.loading
                ? <div className="executive-maturity-placeholder" role="status">正在加载成熟度历史…</div>
                : selectedMaturity.error
                  ? <div className="executive-maturity-placeholder analytics-empty--error" role="alert">成熟度历史加载失败：{selectedMaturity.error.message}</div>
                  : maturityMatrix.columns.length
                ? <>
                  <MaturityMatrix label={`${month} ${maturityCategory === 'key' ? '关键研发活动' : '通用研发能力'}成熟度矩阵`} columns={maturityMatrix.columns} rows={maturityMatrix.rows} />
                  <div className="executive-maturity-scale" role="img" aria-label="成熟度热力色阶：0.0 为有效零分，1.0 至 5.0 为成熟度刻度">
                    <span>0.0</span><i className="executive-maturity-scale__zero" aria-hidden="true" /><span>1.0</span>
                    <i className="executive-maturity-scale__bar" aria-hidden="true" /><span>5.0</span>
                  </div>
                </>
                : <div className="executive-maturity-placeholder">当前没有可展示的成熟度活动。</div>}
            </section>
            <section className="executive-maturity-block">
              <header><h3>领域整体成熟度画像</h3></header>
              <MaturityRadar layout="overview" activities={selectedMaturity.loading || selectedMaturity.error ? [] : maturityActivities} series={selectedMaturity.loading || selectedMaturity.error ? [] : maturitySeries} ariaLabel={`${month} ${maturityCategory === 'key' ? '关键研发活动' : '通用研发能力'}本期与上期领域平均成熟度画像`} />
            </section>
          </div>
        </AnalyticsPanel>
        <AnalyticsPanel id="team-performance" className="executive-team-section" title="团队表现" titleExtra={<div className="executive-team-mode" role="group" aria-label="团队表现统计范围"><Button size="small" type={teamView === 'month' ? 'primary' : 'default'} aria-pressed={teamView === 'month'} onClick={() => setTeamView('month')}>本月</Button><Button size="small" type={teamView === 'cycle' ? 'primary' : 'default'} aria-pressed={teamView === 'cycle'} onClick={() => setTeamView('cycle')}>统计周期</Button></div>} description="临时 IR 口径；比例变化为 pp，按所选周期统计。">
          {teamMatrixColumns.length
            ? <TeamMatrix label={`团队表现 · ${teamView === 'month' ? month : `${periodLabel}截至${month}`}`} columns={teamMatrixColumns} rows={teamMatrixRows} selectedId={selectedTeam?.id} onSelect={setSelectedTeamId} showChanges />
            : <div className="analytics-empty">当前目录没有可展示的数值指标。</div>}
          <div className="executive-team-preview">
            <header>
              <h3>{selectedTeam ? `${selectedTeam.name} · 趋势预览` : '团队趋势预览'}</h3>
              {selectedTeam && <Button type="link" onClick={() => onNavigate?.(`/analytics/teams/${selectedTeam.id}`, { state: { returnTo: '/', returnLabel: '研发总览' } })}>查看团队详情 →</Button>}
            </header>
            <div className="executive-team-preview__charts">
              {selectedTeam ? previewRows.map((row) => {
                const rawData = irDataByMetric[row.metric.code]
                const data = rawData ? metricDataForPeriods(rawData, periodMonths) : null
                const series = data?.series?.filter((item) => String(item.team_id) === String(selectedTeam.id)) ?? []
                const selectedData = data ? { ...data, series } : null
                const baseOption = selectedData && hasNumericValues(selectedData) ? buildTrendOption({ data: selectedData, metric: row.metric, teamColors, selectedPeriodId: 'all', averageLabel: '全公司均值', compact: true }) : null
                const option = baseOption ? {
                  ...baseOption,
                  grid: { ...baseOption.grid, left: 0, right: 0, top: 12, bottom: 4 },
                  xAxis: { ...baseOption.xAxis, axisLabel: { ...baseOption.xAxis.axisLabel, margin: 2 } },
                  yAxis: { ...baseOption.yAxis, axisLabel: { ...baseOption.yAxis.axisLabel, margin: 2 } },
                  legend: { show: false },
                } : null
                const teamColor = teamColors[String(selectedTeam.id)] ?? DATAVIZ_COLORS.team[0]
                return <ChartCard key={row.metric.code} title={row.metric.name} action={<div className="executive-team-preview__legend"><span><i style={{ '--team-matrix-color': teamColor }} />{selectedTeam.name}</span><BenchmarkLegend /></div>} option={option} height={150} reservePlotSpace ariaLabel={`${selectedTeam.name} ${row.metric.name}与全公司均值趋势`} empty={`当前 IR 统计周期暂无${row.metric.name}事实。`} onClick={() => onNavigate?.(`/analytics/teams/${selectedTeam.id}`, { state: { returnTo: '/', returnLabel: '研发总览' } })} />
              }) : previewRows.map((row) => <ChartCard key={row.metric.code} title={row.metric.name} height={150} reservePlotSpace empty="暂无可展示的团队数据。" />)}
            </div>
          </div>
        </AnalyticsPanel>
      </div>
      {catalog.length === 0 && <p className="analytics-muted">当前目录为空，成熟度图表没有活动轴。</p>}
    </div>
  )
}

export function ActivitiesPage(props) {
  return <AnalyticsDetailPage {...props} kind="key" title="研发活动" description="按活动查看月度与统计周期成效、团队趋势和团队差异；时间事实覆盖各版本，成熟度按独立自然月评估。" />
}

export function CapabilitiesPage(props) {
  return <AnalyticsDetailPage {...props} kind="general" title="研发能力" description="按能力结构查看状态与演进；布尔能力逐团队呈现，不合并比例；缺失不补零，成熟度按自然月。" />
}

import { useMemo, useRef, useState } from 'react'
import { Button, Drawer } from 'antd'

import EChart from '../components/EChart'
import { hasNumericValues, useComputedMetrics } from '../overview/metricData'
import { buildTrendOption } from '../overview/chartOption'
import { useMaturityOverview } from '../overview/maturityData'
import { booleanStatusRows } from '../metricDetail/metricDetailLogic'
import {
  DATAVIZ_COLORS,
  assignTeamColorSlots,
  currentMonthId,
  formatFactSummary,
  formatMetricValue,
  hasFactValue,
  isValidMonth,
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
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 11, hideOverlap: true },
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

export function buildTeamOverallMaturitySeries({ keyHistory = [], generalHistory = [], months, teams = [], teamColors = {} }) {
  const keyByMonth = new Map(keyHistory.map((entry) => [String(entry.month), entry.data]))
  const generalByMonth = new Map(generalHistory.map((entry) => [String(entry.month), entry.data]))
  const teamSeries = teams.map((team) => ({
    name: team.name,
    teamId: team.id,
    color: teamColors[String(team.id)] ?? DATAVIZ_COLORS.team[0],
    values: months.map((month) => {
      const keyScores = cellsForTeamMonth(keyByMonth.get(String(month)), team.id)
        .map((cell) => cell.score)
        .filter((value) => hasFactValue(value))
      const generalScores = cellsForTeamMonth(generalByMonth.get(String(month)), team.id)
        .map((cell) => cell.score)
        .filter((value) => hasFactValue(value))
      return average([...keyScores, ...generalScores])
    }),
  }))
  const averageValues = months.map((month, index) => average(teamSeries.map((series) => series.values[index])))
  return {
    series: [...teamSeries, { name: '两个领域平均', color: DATAVIZ_COLORS.companyAverage, values: averageValues, dashed: true }],
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

function ChartCard({ title, eyebrow, option, ariaLabel, onClick, children, action }) {
  return (
    <article className="analytics-chart-card">
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
          {metric && (
            <section className="analytics-detail__section">
              <h3>原始量化</h3>
              <dl className="analytics-detail-facts">
                <div><dt>领域平均</dt><dd>{valueLabel(detail.domainValue)}</dd></div>
                <div><dt>分子</dt><dd>{detail.numerator ?? '—'}</dd></div>
                <div><dt>分母</dt><dd>{detail.denominator ?? '—'}</dd></div>
                <div><dt>样本量</dt><dd>{detail.sampleCount ?? '—'}</dd></div>
              </dl>
              {detail.factSummary && <p className="analytics-muted">{detail.factSummary}</p>}
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

function metricSnapshot(data, metric) {
  const periods = data?.periods ?? []
  const currentPeriod = periods.at(-1)
  const previousPeriod = periods.at(-2)
  const pointFor = (series, periodId) => series?.values?.find((point) => String(point.period_id) === String(periodId)) ?? null
  const teams = (data?.series ?? []).map((series) => ({
    teamId: series.team_id,
    teamName: series.team_name,
    point: pointFor(series, currentPeriod?.id),
  }))
  const previousValues = (data?.series ?? []).map((series) => pointFor(series, previousPeriod?.id)?.value).filter(hasFactValue)
  const currentValues = teams.map((team) => team.point?.value).filter(hasFactValue)
  const domainPoint = data?.domain_summary?.find((point) => String(point.period_id) === String(currentPeriod?.id))
  const domainAverage = data?.company_average?.find((point) => String(point.period_id) === String(currentPeriod?.id))?.value ?? null
  const previousAverage = data?.company_average?.find((point) => String(point.period_id) === String(previousPeriod?.id))?.value ?? null
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
      : formatMetricValue(metric, domainAverage),
    previousValue: metric.type === 'boolean'
      ? (previousValues.filter(Boolean).length ? `${previousValues.filter(Boolean).length} 个团队具备` : '—')
      : deltaText(domainAverage, previousAverage, (value) => formatMetricValue(metric, value)),
    domainAverage,
    previousAverage,
    domainPoint,
    coverage: coverageText(currentValues.length, data?.series?.length ?? 0),
    best,
    weakest,
  }
}

function booleanChartData(data) {
  return {
    ...data,
    series: (data?.series ?? []).map((series) => ({
      ...series,
      values: (series.values ?? []).map((point) => ({ ...point, value: point.value === null || point.value === undefined ? null : point.value ? 1 : 0 })),
    })),
    company_average: (data?.periods ?? []).map((period) => ({ period_id: period.id, value: null })),
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
      {!loading && !error && metric.type !== 'boolean' && !hasNumericValues(data) && <div className="overview-empty">当前筛选切片暂无数据。</div>}
      {!loading && !error && metric.type !== 'boolean' && hasNumericValues(data) && <EChart option={option} height={300} ariaLabel={`${activity.name} ${metric.name} 团队趋势图`} />}
    </article>
  )
}

function MetricAnalysisCard({ activity, metric, data, error, loading, teams, teamColors, onOpen, onNavigate, granularity }) {
  const snapshot = metricSnapshot(data, metric)
  const selectedPeriodId = snapshot.currentPeriod?.id ?? 'all'
  const chartData = metric.type === 'boolean' ? booleanChartData(data) : data
  const option = useMemo(() => data && !error && metric.type !== 'boolean' || data && !error && metric.type === 'boolean'
    ? buildTrendOption({
      data: chartData,
      metric,
      teamColors,
      selectedPeriodId,
      countAsBars: metric.type === 'count',
      averageLabel: metric.type === 'boolean' ? '领域平均（不适用）' : '领域平均',
    })
    : null, [chartData, data, error, metric, selectedPeriodId, teamColors])
  const detail = {
    type: 'metric',
    title: `${activity.name} · ${metric.name}`,
    metric,
    currentValue: snapshot.currentValue,
    previousValue: snapshot.previousValue,
    domainValue: snapshot.domainAverage,
    numerator: snapshot.domainPoint?.numerator,
    denominator: snapshot.domainPoint?.denominator,
    sampleCount: snapshot.domainPoint?.sample_count ?? snapshot.domainPoint?.fact_count,
    factSummary: (() => {
      const factPoint = snapshot.teams.find((team) => hasFactValue(team.point?.value))?.point
      return factPoint ? formatFactSummary(metric, factPoint) : null
    })(),
    coverage: snapshot.coverage,
    periodLabel: snapshot.currentPeriod?.label,
    rows: snapshot.teams.map((team) => ({ teamId: team.teamId, teamName: team.teamName, value: team.point?.value ?? null })),
  }
  const bestLabel = snapshot.best ? `${snapshot.best.teamName} · ${formatMetricValue(metric, snapshot.best.point.value)}` : '—'
  const weakestLabel = snapshot.weakest ? `${snapshot.weakest.teamName} · ${formatMetricValue(metric, snapshot.weakest.point.value)}` : '—'
  const hasChartValue = metric.type === 'boolean'
    ? (data?.series ?? []).some((series) => (series.values ?? []).some((point) => typeof point.value === 'boolean'))
    : hasNumericValues(data)
  return (
    <article className="analytics-analysis-card">
      <header className="analytics-analysis-card__header"><div><p className="analytics-eyebrow">原始指标</p><h3>{metric.name}</h3><p>{metric.type === 'boolean' ? '团队状态趋势；布尔指标不生成领域平均。' : `领域平均虚线 · ${granularity === 'day' ? '近 30 天' : granularity === 'week' ? '近 12 周' : '近 6 个月'}`}</p></div><button type="button" onClick={() => onOpen(detail)}>查看量化详情</button></header>
      {loading && <div className="analytics-empty">正在加载指标数据…</div>}
      {!loading && error && <div className="analytics-empty analytics-empty--error" role="alert">指标加载失败：{error.message}</div>}
      {!loading && !error && (!data?.periods?.length || !data?.series?.length) && <div className="analytics-empty">当前窗口暂无事实数据。</div>}
      {!loading && !error && snapshot.currentValues.length === 0 && <div className="analytics-empty analytics-empty--current">当前周期暂无事实数据。</div>}
      {!loading && !error && option && hasChartValue && <EChart option={option} height={245} ariaLabel={`${activity.name} ${metric.name} 趋势图`} onClick={() => onOpen(detail)} />}
      {!loading && !error && data && <div className="analytics-analysis-meta"><SummaryStats value={snapshot.currentValue} previous={snapshot.previousValue} coverage={snapshot.coverage} /><div><span>最佳</span><strong>{bestLabel}</strong></div><div><span>相对靠后</span><strong>{weakestLabel}</strong></div></div>}
      {onNavigate && <button type="button" className="analytics-detail-link" onClick={() => onNavigate(`/analytics/metrics/${metric.id}`)}>打开现有指标详情 →</button>}
    </article>
  )
}

function MaturityAnalysisCard({ activity, data, history, month, months, teams, teamColors, onOpen }) {
  const maturitySeries = buildActivityMaturitySeries({ history, activityId: activity.id, teams, months, teamColors })
  const option = lineOption({ periods: months.map((id) => ({ id, label: id.slice(5) })), series: maturitySeries.series })
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
  return (
    <article className="analytics-analysis-card">
      <header className="analytics-analysis-card__header"><div><p className="analytics-eyebrow">成熟度</p><h3>{activity.name}</h3><p>领域平均虚线 · 按已评估团队等权平均 · 未评估不补零</p></div><button type="button" onClick={() => onOpen(detail)}>查看量化详情</button></header>
      {current?.score === null || current?.score === undefined ? <div className="analytics-empty analytics-empty--current">当前月暂无成熟度评估。</div> : null}
      <EChart option={option} height={245} ariaLabel={`${activity.name} 成熟度趋势图`} onClick={() => onOpen(detail)} />
      <div className="analytics-analysis-meta"><SummaryStats value={displayScore(current?.score)} previous={deltaText(current?.score, previous?.score)} coverage={coverageText(current?.assessed_team_count ?? 0, data?.team_count ?? teams.length)} /><div><span>最佳</span><strong>{currentRows.filter((row) => Number.isFinite(row.value)).sort((left, right) => right.value - left.value)[0]?.teamName ?? '—'}</strong></div><div><span>相对靠后</span><strong>{currentRows.filter((row) => Number.isFinite(row.value)).sort((left, right) => left.value - right.value)[0]?.teamName ?? '—'}</strong></div></div>
    </article>
  )
}

function AnalysisPageHead({ title, description, month, onMonthChange, granularity, onGranularityChange, showGranularity }) {
  return (
    <div className="analytics-page-head">
      <div><p className="analytics-eyebrow">Engineering intelligence</p><h1>{title}</h1><p>{description}</p></div>
      <div className="analytics-page-controls">
        <label><span>分析月份</span><input aria-label="分析月份" type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} /></label>
        {showGranularity && <div className="analytics-granularity" role="group" aria-label="原始指标时间粒度"><span>原始指标</span>{[['month', '月'], ['week', '周'], ['day', '日']].map(([value, label]) => <button key={value} type="button" aria-pressed={granularity === value} className={granularity === value ? 'is-active' : ''} onClick={() => onGranularityChange(value)}>{label}</button>)}</div>}
      </div>
    </div>
  )
}

export function AnalyticsDetailPage({ kind, title, description, catalog = [], teams = [], user, filter, onFilterChange, onNavigate, onSessionExpired, maturityState, onMaturityChange }) {
  const [localMonth, setLocalMonth] = useState(currentMonthId())
  const [localGranularity, setLocalGranularity] = useState(kind === 'general' && ['day', 'week', 'month'].includes(filter?.granularity) ? filter.granularity : 'month')
  const month = isValidMonth(maturityState?.month) ? maturityState.month : localMonth
  const granularity = kind === 'general' ? localGranularity : 'month'
  const activities = useMemo(() => catalog.filter((activity) => activity.kind === kind), [catalog, kind])
  const maturity = useMaturityOverview(month, kind, onSessionExpired)
  const metricFilter = useMemo(() => ({ dimension: 'time', granularity, versionId: 'all', periodId: null, analysisMonth: month, windowLimit: granularity === 'day' ? 30 : granularity === 'week' ? 12 : 6 }), [granularity, month])
  const metrics = useComputedMetrics(activities, metricFilter, onSessionExpired)
  const months = monthWindow(month, 6)
  const teamColors = colorSlotsForTeams(teams)
  const drawer = useDetailDrawer()

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
      <AnalysisPageHead title={title} description={description} month={month} onMonthChange={changeMonth} granularity={granularity} onGranularityChange={changeGranularity} showGranularity={kind === 'general'} />
      <div className="analytics-page-note">成熟度按自然月计算；原始指标缺失保留断点，不插值、不补零。当前角色：{user?.role ?? 'viewer'}。</div>
      {maturity.loading && <div className="analytics-empty">正在加载成熟度历史…</div>}
      {maturity.error && <div className="analytics-empty analytics-empty--error" role="alert">成熟度加载失败：{maturity.error.message}</div>}
      {!maturity.loading && !maturity.error && (
        <div className="analytics-activity-list">
          {activities.map((activity) => (
            <section key={activity.id} className="analytics-activity-section">
              <header className="analytics-activity-section__header"><div><p className="analytics-eyebrow">{kind === 'key' ? '关键研发活动' : '通用研发能力'}</p><h2>{activity.name}</h2></div><span>{activity.metrics.length} 个原始指标</span></header>
              <MaturityAnalysisCard activity={activity} data={maturity.data} history={maturity.history} month={month} months={months} teams={teams} teamColors={teamColors} onOpen={drawer.open} />
              <div className="analytics-metric-grid">{activity.metrics.map((metric) => <MetricAnalysisCard key={metric.id} activity={activity} metric={metric} data={metrics.data[metric.id]} error={metrics.errors[metric.id]} loading={metrics.loading} teams={teams} teamColors={teamColors} onOpen={drawer.open} onNavigate={onNavigate} granularity={granularity} />)}</div>
            </section>
          ))}
          {!activities.length && <div className="analytics-empty">当前目录没有可展示的{kind === 'key' ? '关键研发活动' : '通用研发能力'}。</div>}
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
  const option = lineOption({ periods: months.map((id) => ({ id, label: id.slice(5) })), series: [{ name: '领域平均', color: DATAVIZ_COLORS.team[0], values }] })
  return <ChartCard title={title} eyebrow="整体成熟度" option={option} ariaLabel={`${title}近六个月趋势图`} onClick={() => onOpen({ type: 'overall', title, currentValue: displayScore(current), previousValue: deltaText(current, previous), coverage: coverageText(data?.assessed_cell_count ?? 0, data?.total_cell_count ?? 0), periodLabel: month, activityRows: (data?.activities ?? []).map((activity) => ({ teamId: activity.activity_id, teamName: activity.activity_name, value: activity.score })) })}><SummaryStats value={displayScore(current)} previous={deltaText(current, previous)} coverage={coverageText(data?.assessed_cell_count ?? 0, data?.total_cell_count ?? 0)} /></ChartCard>
}

function ExecutiveTeamCard({ keyHistory = [], generalHistory = [], month, teams, teamColors, onOpen }) {
  const months = monthWindow(month, 6)
  const { series, values } = buildTeamOverallMaturitySeries({ keyHistory, generalHistory, months, teams, teamColors })
  const current = values.at(-1)
  const previous = values.at(-2)
  const currentRows = series.filter((entry) => !entry.dashed).map((entry) => ({ teamId: entry.teamId, teamName: entry.name, value: entry.values.at(-1) }))
  const option = lineOption({ periods: months.map((id) => ({ id, label: id.slice(5) })), series })
  return <ChartCard title="跨两个领域的团队成熟度" eyebrow="团队趋势" option={option} ariaLabel="各团队跨两个领域成熟度趋势图" onClick={() => onOpen({ type: 'team-overall', title: '跨两个领域的团队成熟度', currentValue: displayScore(current), previousValue: deltaText(current, previous), coverage: coverageText(currentRows.filter((row) => Number.isFinite(row.value)).length, teams.length), periodLabel: month, rows: currentRows })}><SummaryStats value={displayScore(current)} previous={deltaText(current, previous)} coverage={coverageText(currentRows.filter((row) => Number.isFinite(row.value)).length, teams.length)} /></ChartCard>
}

export function ExecutiveOverviewPage({ teams = [], catalog = [], maturityState, onMaturityChange, onNavigate, onSessionExpired }) {
  const [localMonth, setLocalMonth] = useState(currentMonthId())
  const month = isValidMonth(maturityState?.month) ? maturityState.month : localMonth
  const keyMaturity = useMaturityOverview(month, 'key', onSessionExpired)
  const generalMaturity = useMaturityOverview(month, 'general', onSessionExpired)
  const teamColors = colorSlotsForTeams(teams)
  const drawer = useDetailDrawer()
  const missingSignals = [keyMaturity.data, generalMaturity.data].flatMap((data) => (data?.activities ?? []).filter((activity) => activity.score === null).map((activity) => ({ activity, kind: data.kind })))
  function changeMonth(nextMonth) {
    setLocalMonth(nextMonth)
    if (isValidMonth(nextMonth)) onMaturityChange?.({ ...(maturityState ?? {}), month: nextMonth }, { history: 'push' })
  }
  return (
    <div className="executive-overview analytics-page">
      <AnalysisPageHead title="研发总览" description="管理摘要：查看两个成熟度领域和团队整体趋势，再打开量化详情。" month={month} onMonthChange={changeMonth} showGranularity={false} />
      <div className="analytics-page-note">只读管理摘要 · 成熟度按已评估活动和有效团队等权平均 · 未评估不补零。</div>
      <section className="analytics-signal-strip" aria-labelledby="analytics-signal-title"><div><p className="analytics-eyebrow">Signal</p><h2 id="analytics-signal-title">当前成熟度覆盖</h2><p>{missingSignals.length ? `有 ${missingSignals.length} 个活动尚未完成当前月评估。` : '当前月活动均有成熟度记录。'}</p></div><button type="button" onClick={() => drawer.open({ type: 'overall', title: '当前成熟度覆盖', currentValue: missingSignals.length ? '存在缺失' : '已覆盖', previousValue: '—', coverage: `${keyMaturity.data?.assessed_cell_count ?? 0} + ${generalMaturity.data?.assessed_cell_count ?? 0} 个已评估单元`, activityRows: missingSignals.map(({ activity }) => ({ teamId: activity.activity_id, teamName: activity.activity_name, value: activity.score })) })}>查看量化详情</button></section>
      {(keyMaturity.loading || generalMaturity.loading) && <div className="analytics-empty">正在加载近六个月成熟度…</div>}
      {(keyMaturity.error || generalMaturity.error) && <div className="analytics-empty analytics-empty--error" role="alert">成熟度历史加载失败：{(keyMaturity.error ?? generalMaturity.error).message}</div>}
      {!keyMaturity.loading && !generalMaturity.loading && !keyMaturity.error && !generalMaturity.error && <div className="executive-chart-grid"><ExecutiveOverviewCard title="关键研发活动整体成熟度" history={keyMaturity.history} month={month} onOpen={drawer.open} /><ExecutiveOverviewCard title="通用研发能力整体成熟度" history={generalMaturity.history} month={month} onOpen={drawer.open} /><ExecutiveTeamCard keyHistory={keyMaturity.history} generalHistory={generalMaturity.history} month={month} teams={teams} teamColors={teamColors} onOpen={drawer.open} /></div>}
      <AnalyticsDetailDrawer detail={drawer.detail} triggerRef={drawer.triggerRef} onClose={drawer.close} onNavigate={onNavigate} />
      {catalog.length === 0 && <p className="analytics-muted">当前目录为空，成熟度图表没有活动轴。</p>}
    </div>
  )
}

export function ActivitiesPage(props) {
  return <AnalyticsDetailPage {...props} kind="key" title="研发活动" description="按自然月查看每项关键研发活动的成熟度与全部原始指标趋势。" />
}

export function CapabilitiesPage(props) {
  return <AnalyticsDetailPage {...props} kind="general" title="研发能力" description="按活动查看通用研发能力；原始指标支持月、周、日粒度，成熟度仍按自然月。" />
}

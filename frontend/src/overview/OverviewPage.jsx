import { useEffect, useMemo, useRef, useState } from 'react'
import { Drawer } from 'antd'
import {
  ArrowRightOutlined,
} from '@ant-design/icons'

import { fetchJson } from '../api'
import EChart from '../components/EChart'
import { booleanStatusRows } from '../metricDetail/metricDetailLogic'
import FilterBar from './FilterBar'
import MaturityRadar from './MaturityRadar'
import { buildInsightOption, buildTrendOption } from './chartOption'
import { maturityLevelColor, sortMaturityActivities } from './maturityChartOption'
import {
  maturitySavePayload,
  useMaturityOverview,
  useMaturityRecords,
} from './maturityData'
import { hasNumericValues, useComputedMetrics } from './metricData'
import {
  DATAVIZ_COLORS,
  assignTeamColorSlots,
  bestAndWeakestRows,
  buildMaturityTrendRows,
  buildMetricTrendRows,
  currentMetricValues,
  formatFactSummary,
  formatMetricValue,
  buildAttentionItems,
  buildMetricRows,
  INITIAL_FILTER,
  isGeneralIterationFallback,
  iterationPeriods,
  latestPeriodId,
  monthWindow,
  maturityAverageScore,
  metricPointForMonth,
  normalizeMaturityState,
  TEAM_COLOR_STORAGE_KEY,
} from './overviewLogic'
import './overview.css'

const EMPTY_METRIC_CATALOG = []
const MONTHLY_FILTER = { ...INITIAL_FILTER, dimension: 'time', granularity: 'month', periodId: null }

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
  const snapshot = currentMetricValues(data, metric, periodId)
  if (!snapshot) return null

  const period = data.periods?.find((item) => String(item.id) === String(periodId))
  return (
    <div className="overview-slice" aria-label={`当前周期 ${period?.label ?? (periodId === 'all' ? '全部周期' : '最新')}`}>
      <div className="overview-slice-heading">当前值 · {metric.name} · 周期：{period?.label ?? (periodId === 'all' ? '全部周期' : '最新')}</div>
      <div className="overview-slice-values">
        {snapshot.teams.map((team) => (
          <span key={team.team_id} className="overview-slice-value">
            <span>{team.team_name}</span>
            <strong>{formatMetricValue(metric, team.value)}</strong>
          </span>
        ))}
        <span className="overview-slice-value overview-company-value">
          <span>全公司均值</span>
          <strong>{formatMetricValue(metric, snapshot.company.value)}</strong>
        </span>
      </div>
    </div>
  )
}

function BooleanCard({ data, teams, fallback, table = false, statusRows }) {
  const rows = statusRows ?? booleanStatusRows(data, teams)
  const hasValue = rows.some((row) => row.value !== null && row.value !== undefined)

  if (!hasValue) return <EmptyState>当前筛选切片暂无布尔状态数据。</EmptyState>

  if (table) {
    return (
      <div className="metric-detail-boolean-table-wrap">
        <table className="metric-detail-boolean-table">
          <thead>
            <tr><th scope="col">团队</th><th scope="col">状态</th></tr>
          </thead>
          <tbody>
            {rows.map(({ team, value, state }) => {
              return (
                <tr key={team.id}>
                  <th scope="row">{team.name}</th>
                  <td className={`metric-detail-boolean-status is-${state}`}>
                    {state === 'unknown' ? '暂无数据' : value ? '✓ 具备' : '✗ 不具备'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="overview-card-note">布尔指标按最新事实展示，周期筛选不改变状态。</p>
      </div>
    )
  }

  return (
    <div className="overview-boolean-list">
      {rows.map(({ team, value, state }) => {
        return (
          <span key={team.id} className={`overview-boolean-value is-${state}`}>
            <span>{team.name}</span>
            <strong>{state === 'unknown' ? '暂无数据' : value ? '✓ 具备' : '✗ 不具备'}</strong>
          </span>
        )
      })}
      <p className="overview-card-note">布尔指标按最新事实展示，周期筛选不改变状态。</p>
      {fallback && <p className="overview-card-note">通用研发能力无迭代维度，固定按月展示。</p>}
    </div>
  )
}

export function TrendCard({
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
  showMetricPills = true,
  showMetricDetailLink = true,
  booleanTable = false,
  booleanRows,
  countAsBars = false,
}) {
  const selectedPeriodId = fallback ? 'all' : (periodId ?? 'all')
  const option = useMemo(() => (
    data && metric.type !== 'boolean'
      ? buildTrendOption({ data, metric, teamColors, selectedPeriodId, countAsBars })
      : null
  ), [countAsBars, data, metric, teamColors, selectedPeriodId])

  function handleChartClick(params) {
    if (!params?.seriesName || params.seriesName === '全公司均值') return
    const team = teams.find((item) => item.name === params.seriesName)
      if (team) onNavigate?.(`/analytics/teams/${team.id}`)
  }

  const isSelectedMetric = activity.metrics.indexOf(metric)
  return (
    <article className="overview-card">
      <header className="overview-card-header">
        <div className="overview-card-title-row">
          <h3>{activity.name}</h3>
          <span className="overview-kind">{activity.kind === 'key' ? '关键' : '通用'}</span>
        </div>
        {showMetricPills && (
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
        )}
      </header>

      <div className="overview-metric-meta">
        <p className="overview-metric-name">{metric.name}</p>
        {showMetricDetailLink && onNavigate && (
          <button type="button" className="overview-detail-link" onClick={() => onNavigate(`/analytics/metrics/${metric.id}`)}>
            指标详情 →
          </button>
        )}
      </div>
      {loading && <div className="overview-empty">正在更新指标数据…</div>}
      {!loading && error && <ErrorState error={error} />}
      {!loading && !error && metric.type === 'boolean' && (
        <BooleanCard data={data} teams={teams} fallback={fallback} table={booleanTable} statusRows={booleanRows} />
      )}
      {!loading && !error && metric.type !== 'boolean' && !hasNumericValues(data) && <EmptyState />}
      {!loading && !error && metric.type !== 'boolean' && hasNumericValues(data) && (
        <EChart
          option={option}
          height={252}
          ariaLabel={`${activity.name} ${metric.name} 团队趋势图`}
          onClick={handleChartClick}
        />
      )}
      {!loading && !error && metric.type !== 'boolean' && data && (
        <CurrentSlice data={data} metric={metric} periodId={selectedPeriodId} />
      )}
      {fallback && metric.type !== 'boolean' && <p className="overview-card-note">通用研发能力无迭代维度 · 固定近 6 个月月趋势</p>}
    </article>
  )
}

function formatMaturityScore(cell) {
  return cell?.score_display ?? (typeof cell?.score === 'number' ? cell.score.toFixed(2) : '—')
}

function formatMaturityDelta(cell, summary) {
  if (cell?.score === null || cell?.score === undefined || summary?.score === null || summary?.score === undefined) return '—'
  const delta = cell.score - summary.score
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`
}

function MaturityLevel({ cell, summary }) {
  if (cell?.score === null || cell?.score === undefined) {
    return <span className="maturity-level maturity-level--missing">—</span>
  }
  return (
    <span className="maturity-level" style={{ '--maturity-level-color': maturityLevelColor(cell.grade ?? summary?.grade) }}>
      <strong>{cell.level?.slice(0, 2) ?? `L${cell.grade}`}</strong>
      <span>{formatMaturityScore(cell)}</span>
    </span>
  )
}

function OverviewControls({
  state,
  teams,
  user,
  maintenanceTeamId,
  onMaintenanceTeamChange,
  onChange,
  onOpenMaintenance,
}) {
  const editableTeams = user?.role === 'admin'
    ? teams
    : teams.filter((team) => String(team.id) === String(user?.maintainer_team_id))
  const change = (patch, options) => onChange({ ...state, ...patch }, options)

  return (
    <div className="overview-controls" aria-label="总览分析控制">
      <label className="overview-control overview-control--month">
        <span>分析月份</span>
        <input aria-label="分析月份" type="month" value={state.month} onChange={(event) => change({ month: event.target.value }, { history: 'push' })} />
      </label>
      <div className="overview-control overview-control--category">
        <span>分析范围</span>
        <div className="overview-segmented" role="group" aria-label="分析范围">
          {[['key', '关键研发活动'], ['general', '通用研发能力']].map(([value, label]) => (
            <button key={value} type="button" className={state.category === value ? 'is-active' : ''} aria-pressed={state.category === value} onClick={() => change({ category: value }, { history: 'push' })}>{label}</button>
          ))}
        </div>
      </div>
      {editableTeams.length > 0 && (
        <div className="overview-control overview-control--maintenance">
          <span>成熟度维护</span>
          <div>
            <select aria-label="维护团队" value={maintenanceTeamId} onChange={(event) => onMaintenanceTeamChange(event.target.value)}>
            <option value="">选择维护团队</option>
            {editableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <button type="button" className="overview-primary-button" disabled={!maintenanceTeamId} onClick={onOpenMaintenance}>维护成熟度</button>
          </div>
        </div>
      )}
    </div>
  )
}

const INSIGHT_COLORS = DATAVIZ_COLORS.team

function formatInsightValue(metric, value) {
  if (metric?.type === 'maturity') return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—'
  return formatMetricValue(metric, value)
}

function formatTrendDelta(metric, delta) {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return '—'
  if (delta === 0) return '→ 0'
  const magnitude = metric?.type === 'maturity'
    ? Math.abs(delta).toFixed(2)
    : formatMetricValue(metric, Math.abs(delta)).replace(/^\+/, '')
  return `${delta > 0 ? '↑ +' : '↓ -'}${magnitude}`
}

function sparklinePath(values, width = 72, height = 20) {
  const numeric = values.filter((value) => typeof value === 'number' && Number.isFinite(value))
  if (numeric.length < 2) return ''
  const min = Math.min(...numeric)
  const max = Math.max(...numeric)
  const range = max - min || 1
  const points = values.map((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    return `${(index / Math.max(1, values.length - 1)) * width},${height - ((value - min) / range) * (height - 2) - 1}`
  })
  const segments = []
  let current = []
  points.forEach((point) => {
    if (point) current.push(point)
    else if (current.length) {
      segments.push(current.join(' '))
      current = []
    }
  })
  if (current.length) segments.push(current.join(' '))
  return segments.map((segment) => `M ${segment.replaceAll(' ', ' L ')}`).join(' ')
}

function MicroTrend({ values, label }) {
  const path = sparklinePath(values)
  return (
    <span className="overview-microtrend" role="img" aria-label={label}>
      {path ? <svg viewBox="0 0 72 20" aria-hidden="true"><path d={path} /></svg> : <span aria-hidden="true">—</span>}
    </span>
  )
}

function InsightCard({ title, rows, statusRows = [], periods, loading = false, focus = 'best', note, overallRow = null }) {
  const { best, weakest } = bestAndWeakestRows(rows)
  const chartCandidates = overallRow ? [overallRow] : [best, weakest].filter((row, index, list) => row && list.indexOf(row) === index)
  const fallbackChartRows = rows.filter((row) => row.values.some((value) => typeof value === 'number' && Number.isFinite(value))).slice(0, 2)
  const chartRows = (chartCandidates.length ? chartCandidates : fallbackChartRows).filter((row) => row.values.some((value) => typeof value === 'number' && Number.isFinite(value)))
  const option = useMemo(() => buildInsightOption({
    periods,
    series: chartRows.map((row, index) => ({
      name: `${row.activity.name} · ${row.metric.name}`,
      values: row.values,
      color: INSIGHT_COLORS[index % INSIGHT_COLORS.length],
    })),
    formatValue: (value, seriesIndex) => formatInsightValue(chartRows[seriesIndex]?.metric, value),
    yMin: chartRows.length && chartRows.every((row) => row.metric.type === 'penetration' || row.metric.type === 'ratio') ? 0 : undefined,
    yMax: chartRows.length && chartRows.every((row) => row.metric.type === 'penetration' || row.metric.type === 'ratio') ? 1 : undefined,
  }), [chartRows, periods])
  const focusRow = overallRow ?? (focus === 'weakest' ? weakest : best)
  const focusLabel = focusRow?.metric?.name ? `${focusRow.activity.name} · ${focusRow.metric.name}` : focusRow?.activity?.name
  const status = focusRow
    ? { value: formatInsightValue(focusRow.metric, focusRow.value), label: focusLabel, delta: focusRow.delta }
    : statusRows.length
      ? { value: '按团队状态', label: '当前窗口没有可合并的布尔均值', delta: null }
      : { value: '—', label: '当前窗口暂无可用事实', delta: null }

  return (
    <article className="overview-insight-card" aria-labelledby={`insight-${title}`}>
      <header className="overview-insight-card__header">
        <div><p className="overview-section-kicker">Insight</p><h2 id={`insight-${title}`}>{title}</h2></div>
        <span>近 6 个月</span>
      </header>
      <div className="overview-insight-card__status">
        <div><span>当前状态</span><strong>{loading ? '加载中…' : status.value}</strong><small>{status.label}</small></div>
        <div><span>环比</span><strong className={status.delta < 0 ? 'is-negative' : status.delta > 0 ? 'is-positive' : ''}>{loading ? '—' : formatTrendDelta(focusRow?.metric, status.delta)}</strong><small>{focusRow ? `${focusRow.activity.name} · ${periods.at(-1)?.label ?? periods.at(-1)}` : '同一指标对比'}</small></div>
      </div>
      {!loading && chartRows.length > 0 && <EChart option={option} height={118} ariaLabel={`${title}近六个月真实指标趋势，缺失月份保留断点`} />}
      {!loading && chartRows.length === 0 && <div className="overview-insight-empty">当前窗口暂无可绘制的数值趋势。</div>}
      {statusRows.length > 0 && (
        <div className="overview-insight-status-list" aria-label={`${title}当前状态明细`}>
          {statusRows.map((row) => {
            const valid = row.statusRows.filter((team) => typeof team.point?.value === 'boolean')
            const enabled = valid.filter((team) => team.point.value).length
            return <span key={row.metric.id}><strong>{row.activity.name}</strong>{row.metric.name}：{valid.length ? `${enabled} / ${valid.length} 具备` : '暂无数据'}</span>
          })}
        </div>
      )}
      <div className="overview-insight-range">
        <div><span>最好项</span><strong>{best ? `${best.activity.name} · ${formatInsightValue(best.metric, best.value)}` : '—'}</strong></div>
        <div><span>最弱项</span><strong>{weakest ? `${weakest.activity.name} · ${formatInsightValue(weakest.metric, weakest.value)}` : '—'}</strong></div>
      </div>
      <p className="overview-card-note">{note}</p>
    </article>
  )
}

function InsightGrid({ category, month, maturityHistory, maturityActivities, dataByMetric, errors, teams, loading }) {
  const months = monthWindow(month)
  const periods = months.map((item) => ({ id: item, label: item.slice(5) }))
  const maturityRows = buildMaturityTrendRows({ history: maturityHistory, activities: maturityActivities, months })
  const maturityValues = months.map((item) => maturityAverageScore(maturityHistory.find((entry) => entry.month === item)?.data))
  const maturityOverall = {
    activity: { name: '领域平均' },
    metric: { type: 'maturity' },
    values: maturityValues,
    value: maturityValues.at(-1) ?? null,
    delta: typeof maturityValues.at(-1) === 'number' && typeof maturityValues.at(-2) === 'number' ? maturityValues.at(-1) - maturityValues.at(-2) : null,
  }
  const metricRows = buildMetricTrendRows({
    activities: maturityActivities,
    dataByMetric,
    errors,
    months,
    teams,
  })
  const rateRows = metricRows.filter((row) => row.metric.type === 'penetration' || row.metric.type === 'ratio')
  const efficiencyRows = metricRows.filter((row) => row.metric.type === 'efficiency')
  const countRows = metricRows.filter((row) => row.metric.type === 'count')
  const statusRows = metricRows.filter((row) => row.metric.type === 'boolean' || row.metric.type === 'bool')
  const cards = [
    <InsightCard key="maturity" title="成熟度" rows={maturityRows.map((row) => ({ ...row, metric: { type: 'maturity' } }))} overallRow={maturityOverall} periods={periods} loading={loading.maturity} focus="best" note="当前状态和趋势沿用已评估活动的领域平均语义；未评估月份保留断点。" />,
    category === 'key'
      ? <InsightCard key="efficiency" title="提效率" rows={efficiencyRows} periods={periods} loading={loading.metrics} focus="weakest" note="只展示目录中已有的效率指标，不生成目标线或因果建议。" />
      : (rateRows.length || statusRows.length) > 0
        ? <InsightCard key="usage" title="使用率 / 状态" rows={rateRows} statusRows={statusRows} periods={periods} loading={loading.metrics} note="按目录类型展示真实使用率或团队状态，不跨活动合并。" />
        : null,
    category === 'key'
      ? <InsightCard key="rate" title="AI 渗透 / 比率" rows={rateRows} periods={periods} loading={loading.metrics} note="趋势由当前分类下的真实率指标组成，不计算跨活动平均。" />
      : countRows.length > 0
        ? <InsightCard key="count" title="数量规模" rows={countRows} periods={periods} loading={loading.metrics} note="仅展示目录已有数量指标，0 与缺失严格区分。" />
        : null,
  ].filter(Boolean)

  return <section className="overview-insight-grid" aria-label="Insight 趋势卡">{cards}</section>
}

function signalLevel(items) {
  if (!items.length) return '无'
  const priority = Math.min(...items.map((item) => item.priority ?? 9))
  return priority === 0 ? '高' : priority <= 2 ? '中' : '低'
}

function SignalSummary({ items, loading, onOpen, buttonRef }) {
  return (
    <section className="overview-signal-summary" aria-labelledby="signal-summary-title">
      <div><p className="overview-section-kicker">Signal</p><h2 id="signal-summary-title">当前信号</h2><p aria-live="polite">{loading ? '正在读取当前月份数据…' : items.length ? `最高级别：${signalLevel(items)} · 按优先级查看证据` : '当前月份没有按规则生成的信号。'}</p></div>
      <button ref={buttonRef} type="button" className="overview-signal-summary__button" aria-label="打开 Signal 详情" onClick={onOpen}><strong>{loading ? '—' : items.length}</strong><span>Signal · 最高级别 {loading ? '—' : signalLevel(items)}</span><ArrowRightOutlined aria-hidden="true" /></button>
    </section>
  )
}

function SignalDrawer({ open, items, month, canEdit, onClose, onNavigate, onOpenMaintenance, onClosed }) {
  function itemLabel(item) {
    if (item.type === 'maturity-missing') return item.activityName
    return item.teamName ? `${item.teamName} · ${item.activityName}` : item.activityName
  }

  return (
    <Drawer className="overview-signal-drawer" rootClassName="overview-signal-drawer-root" placement="right" title={`Signal · ${month}`} open={open} onClose={onClose} afterOpenChange={(visible) => { if (!visible) onClosed?.() }} size={480}>
      <div className="overview-signal-drawer__body">
        {!items.length && <EmptyState>当前没有按规则生成的 Signal。</EmptyState>}
        {items.length > 0 && <ol className="overview-signal-list">
          {items.map((item, index) => (
            <li key={`${item.type}-${item.metricId ?? item.activityId}-${item.teamId ?? index}`} className={`overview-signal-item is-${item.type}`}>
              <div className="overview-signal-item__heading"><span className="overview-signal-item__level">{item.priority === 0 ? '高' : item.priority <= 2 ? '中' : '低'}</span><strong>{itemLabel(item)}</strong></div>
              <p>{item.metricName ? `${item.metricName} · ` : ''}{item.reason}</p>
              <dl><div><dt>当前值</dt><dd>{item.value === undefined ? '—' : formatMetricValue({ type: item.metricType ?? 'ratio' }, item.value)}</dd></div><div><dt>领域均值</dt><dd>{item.domainValue === undefined ? '—' : formatMetricValue({ type: item.metricType ?? 'ratio' }, item.domainValue)}</dd></div><div><dt>月份</dt><dd>{month}</dd></div></dl>
              <div className="overview-signal-item__actions">
                {item.metricId && onNavigate && <button type="button" onClick={() => onNavigate(`/analytics/metrics/${item.metricId}`)}>查看证据 <ArrowRightOutlined aria-hidden="true" /></button>}
                {item.type === 'maturity-missing' && canEdit && <button type="button" onClick={onOpenMaintenance}>维护成熟度</button>}
              </div>
            </li>
          ))}
        </ol>}
      </div>
    </Drawer>
  )
}

function Distribution({ summary }) {
  const entries = Object.entries(summary.grade_distribution ?? {}).filter(([, count]) => count > 0)
  if (!entries.length) return <span className="maturity-distribution maturity-distribution--missing">未评估</span>
  return <span className="maturity-distribution">{entries.map(([level, count]) => <span key={level} className={`maturity-distribution__item is-${level.toLowerCase()}`}>{level} {count}</span>)}</span>
}

function factRowValue(row) {
  if (!row.hasData) return '—'
  if (row.metric.type === 'boolean') return `具备 ${row.booleanTrueCount} / ${row.validTeamCount}`
  return formatMetricValue(row.metric, row.company?.value)
}

function factBarWidth(row, maxValue) {
  const value = row.company?.value
  if (typeof value !== 'number' || !Number.isFinite(value) || !maxValue) return 0
  return Math.min(100, Math.abs(value) / maxValue * 100)
}

function FactPerformanceSection({ title, description, rows, loading = false, onNavigate }) {
  if (!rows.length) return null
  const maxValue = Math.max(1, ...rows.map((row) => Math.abs(row.company?.value ?? 0)).filter(Number.isFinite))
  const hasData = rows.some((row) => row.hasData)
  return (
    <article className="overview-performance-section" aria-labelledby={`performance-${title}`}>
      <header className="overview-section-header">
        <div><h2 id={`performance-${title}`}>{title}</h2><p>{description}</p></div>
        <span className="overview-section-header__note">基线：company_average</span>
      </header>
      {loading && <EmptyState>正在加载 {title} 的分析月份事实…</EmptyState>}
      {!loading && !hasData && <EmptyState>分析月份暂无{title}事实，不回退到其他月份。</EmptyState>}
      {!loading && hasData && <ol className="fact-performance-list">
        {rows.map((row) => {
          const value = row.company?.value
          const negative = typeof value === 'number' && value < 0
          return (
            <li key={row.metric.id} className={`fact-performance-row${!row.hasData ? ' is-missing' : ''}${negative ? ' is-negative' : ''}`}>
              <div className="fact-performance-row__label"><strong>{row.activity.name}</strong><span>{row.metric.name}</span></div>
              <div className="fact-performance-row__bar" aria-hidden="true"><span style={{ width: `${factBarWidth(row, maxValue)}%` }} /></div>
              <div className="fact-performance-row__value"><strong>{factRowValue(row)}</strong><span>{row.validTeamCount} / {row.totalTeamCount} 个有效团队</span></div>
              {onNavigate && <button type="button" className="fact-performance-row__link" onClick={() => onNavigate(`/analytics/metrics/${row.metric.id}`)}>下钻 <ArrowRightOutlined aria-hidden="true" /></button>}
            </li>
          )
        })}
      </ol>}
    </article>
  )
}

function ActivityMetricCell({ row, month }) {
  const value = row.value === null ? '—' : formatMetricValue(row.metric, row.value)
  return (
    <div className={`key-matrix-metric${row.value === null ? ' is-missing' : row.value < 0 ? ' is-negative' : ''}`} aria-label={`${row.activity.name} ${row.metric.name} ${value}，${month} 环比 ${formatTrendDelta(row.metric, row.delta)}`}>
      <div className="key-matrix-metric__title"><span>{row.metric.name}</span><strong>{value}</strong></div>
      <div className="key-matrix-metric__trend"><span>环比 {formatTrendDelta(row.metric, row.delta)}</span><MicroTrend values={row.values} label={`${row.activity.name} ${row.metric.name} 近六个月微型趋势`} /></div>
    </div>
  )
}

function MaturityMetricCell({ row, summary, month }) {
  const value = summary?.score === null || summary?.score === undefined ? '—' : formatMaturityScore(summary)
  return (
    <div className={`key-matrix-metric${row.value === null ? ' is-missing' : ''}`} aria-label={`${summary?.activity_name ?? '成熟度'} ${value}，${month} 环比 ${formatTrendDelta({ type: 'maturity' }, row.delta)}`}>
      <div className="key-matrix-metric__title"><span>{summary?.level ?? '未评估'}</span><strong>{value}</strong></div>
      <div className="key-matrix-metric__trend"><span>环比 {formatTrendDelta({ type: 'maturity' }, row.delta)}</span><MicroTrend values={row.values} label={`${summary?.activity_name ?? '成熟度'} 近六个月微型趋势`} /></div>
    </div>
  )
}

function KeyActivityMatrix({ activities, data, history, dataByMetric, errors, teams, month, onNavigate, onOpenActivity }) {
  const months = monthWindow(month)
  const maturityRows = buildMaturityTrendRows({ history, activities, months })
  const metricRows = buildMetricTrendRows({ activities, dataByMetric, errors, months, teams })
  const maturityById = new Map(maturityRows.map((row) => [String(row.activity.id), row]))
  const summaries = new Map((data?.activities ?? []).map((summary) => [String(summary.activity_id), summary]))
  const metricsByActivity = new Map()
  metricRows.forEach((row) => {
    const key = String(row.activity.id)
    metricsByActivity.set(key, [...(metricsByActivity.get(key) ?? []), row])
  })

  return (
    <section className="overview-key-matrix" aria-labelledby="key-activity-matrix-title">
      <header className="overview-board-header">
        <div><p className="overview-section-kicker">Activity matrix</p><h2 id="key-activity-matrix-title">关键研发活动对照</h2><p>8 项活动 · 当前值、环比方向和近六个月微型趋势；多率指标按真实指标分行。</p></div>
        <span>{month} · company_average</span>
      </header>
      <div className="key-activity-matrix__head" aria-hidden="true"><span>活动</span><span>成熟度</span><span>AI 渗透 / 比率</span><span>提效率</span><span>数据状态</span><span>下钻</span></div>
      <div className="key-activity-matrix__body">
        {activities.map((activity) => {
          const key = String(activity.id)
          const summary = summaries.get(key)
          const maturityRow = maturityById.get(key) ?? { value: null, delta: null, values: [] }
          const rows = metricsByActivity.get(key) ?? []
          const rateRows = rows.filter((row) => row.metric.type === 'penetration' || row.metric.type === 'ratio')
          const efficiencyRows = rows.filter((row) => row.metric.type === 'efficiency')
          const availableMetrics = rows.filter((row) => row.hasData).length
          const maturityAvailable = typeof summary?.score === 'number' && Number.isFinite(summary.score)
          const status = !maturityAvailable && !availableMetrics ? '缺失' : maturityAvailable && availableMetrics === rows.length ? '完整' : '部分'
          return (
            <article className="key-activity-matrix__row" key={activity.id}>
              <div className="key-matrix-activity"><strong>{activity.name}</strong><span>{activity.metrics.length} 个目录指标</span></div>
              <div className="key-matrix-cell" data-label="成熟度"><MaturityMetricCell row={maturityRow} summary={summary} month={month} /></div>
              <div className="key-matrix-cell" data-label="AI 渗透 / 比率">{rateRows.length ? rateRows.map((row) => <ActivityMetricCell key={row.metric.id} row={row} month={month} />) : <span className="key-matrix-undefined">指标未定义</span>}</div>
              <div className="key-matrix-cell" data-label="提效率">{efficiencyRows.length ? efficiencyRows.map((row) => <ActivityMetricCell key={row.metric.id} row={row} month={month} />) : <span className="key-matrix-undefined">指标未定义</span>}</div>
              <div className={`key-matrix-status is-${status === '完整' ? 'complete' : status === '部分' ? 'partial' : 'missing'}`}><strong>{status}</strong><span>成熟度 {maturityAvailable ? '已评估' : '未评估'} · 指标 {availableMetrics} / {rows.length}</span></div>
              <div className="key-matrix-drilldown"><button type="button" onClick={() => onOpenActivity(activity.id)}>查看活动 <ArrowRightOutlined aria-hidden="true" /></button>{rows.map((row) => <button key={row.metric.id} type="button" onClick={() => onNavigate?.(`/analytics/metrics/${row.metric.id}`)}>{row.metric.name}</button>)}</div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function DomainView({ data, category, sort, activities, history, dataByMetric, errors, teams, month, factRows, metricsLoading, onOpenActivity, onNavigate }) {
  if (category === 'key') return <KeyActivityMatrix activities={activities} data={data} history={history} dataByMetric={dataByMetric} errors={errors} teams={teams} month={month} onNavigate={onNavigate} onOpenActivity={onOpenActivity} />
  const ordered = sortMaturityActivities(data?.activities ?? [], sort)
  const radarActivities = data?.activities ?? []
  const radarSeries = [{
    id: 'domain-average',
    name: '领域平均',
    color: '#667085',
    values: radarActivities.map((activity) => activity.score),
  }]
  const penetrationRows = factRows.filter((row) => row.metric.type === 'penetration' || row.metric.type === 'ratio')
  const efficiencyRows = factRows.filter((row) => row.metric.type === 'efficiency')
  const countRows = factRows.filter((row) => row.metric.type === 'count')
  const booleanRows = factRows.filter((row) => row.metric.type === 'boolean' || row.metric.type === 'bool')
  return (
    <>
      <section className="overview-performance-board" aria-labelledby="performance-board-title">
        <header className="overview-board-header">
          <div><p className="overview-section-kicker">组织信号</p><h2 id="performance-board-title">{category === 'key' ? '效率表现' : '能力指标'}</h2><p>{category === 'key' ? '按当前月领域均值横向查看，值与数据覆盖同时呈现。' : '按目录类型展示当前月使用率、状态和数量，值与数据覆盖同时呈现。'}</p></div>
          <span>基线：company_average</span>
        </header>
        <div className="overview-performance-grid">
          <FactPerformanceSection title={category === 'key' ? 'AI 渗透率' : '比率'} description="渗透率与活动比率" rows={penetrationRows} loading={metricsLoading} onNavigate={onNavigate} />
          <FactPerformanceSection title="提效率" description="保留负值的原始语义" rows={efficiencyRows} loading={metricsLoading} onNavigate={onNavigate} />
          <FactPerformanceSection title="数量" description="仅展示目录中已有数量指标" rows={countRows} loading={metricsLoading} onNavigate={onNavigate} />
          <FactPerformanceSection title="布尔状态" description="按团队状态汇总，无公司均值" rows={booleanRows} loading={metricsLoading} onNavigate={onNavigate} />
        </div>
      </section>

      <section className="overview-capability-board" aria-labelledby="capability-board-title">
        <header className="overview-board-header">
          <div><p className="overview-section-kicker">能力画像</p><h2 id="capability-board-title">成熟度与能力点</h2><p>{data?.month ?? '选定月份'} · 0–5 分；缺失轴不补零，分布仅统计已评估团队。</p></div>
          <span>{sort === 'score' ? '明细按分数排序' : '目录顺序'}</span>
        </header>
        <div className="overview-capability-grid">
          <section className="overview-panel overview-radar-panel">
            <header className="overview-section-header"><div><h3>领域成熟度雷达</h3><p>用于查看能力结构，不代表行业基准。</p></div></header>
            <MaturityRadar activities={radarActivities} series={radarSeries} ariaLabel="领域平均成熟度雷达图" />
          </section>
          <section className="overview-panel maturity-detail-panel">
            <header className="overview-section-header"><div><h3>能力点明细</h3><p>点击能力点进入现有指标与趋势详情。</p></div></header>
            <div className="maturity-table-wrap">
              <table className="maturity-table maturity-domain-table">
                <thead><tr><th scope="col">能力点</th><th scope="col">领域平均</th><th scope="col">等级</th><th scope="col">已评估团队</th><th scope="col">等级分布</th></tr></thead>
                <tbody>{ordered.map((summary) => (
                  <tr key={summary.activity_id}>
                    <th scope="row"><button type="button" className="maturity-link-button" onClick={() => onOpenActivity(summary.activity_id)}>{summary.activity_name}</button></th>
                    <td className={summary.score === null ? 'is-missing' : ''}>{summary.score_display ?? '—'}</td>
                    <td><span className={summary.level ? 'maturity-level-label' : 'is-missing'} style={summary.level ? { color: maturityLevelColor(summary.grade) } : undefined}>{summary.level ?? '未评估'}</span></td>
                    <td>{summary.assessed_team_count} / {data.team_count}</td>
                    <td><Distribution summary={summary} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </>
  )
}

function TeamMatrix({ data, selectedTeamIds, showBaseline, teamColors, onToggleTeam, onToggleBaseline, onOpenActivity }) {
  const summaries = new Map((data?.activities ?? []).map((activity) => [activity.activity_id, activity]))
  const selected = new Set(selectedTeamIds)
  const selectedRows = (data?.teams ?? []).filter((team) => selected.has(String(team.team_id)))
  const baseline = (data?.activities ?? []).map((activity) => activity.score)
  const radarSeries = [
    ...(showBaseline ? [{ id: 'domain-baseline', name: '领域平均', color: '#98a2b3', dashed: true, values: baseline }] : []),
    ...selectedRows.map((team) => ({
      id: `team-${team.team_id}`,
      name: team.team_name,
      color: teamColors[String(team.team_id)],
      values: (data?.activities ?? []).map((activity) => team.cells.find((cell) => cell.activity_id === activity.activity_id)?.score ?? null),
    })),
  ]

  return (
    <>
      <section className="maturity-panel maturity-matrix-panel">
        <header className="maturity-panel__header"><div><h2>团队 × 能力点矩阵</h2><p>点击团队名称加入雷达对比（最多 3 个）；点击列名或格子进入指标与趋势详情。</p></div><div className="maturity-panel__header-actions"><label className="maturity-toolbar__check"><input type="checkbox" checked={showBaseline} onChange={(event) => onToggleBaseline?.(event.target.checked)} />显示领域基线</label><span className="maturity-selection-count">已选 {selectedRows.length} / 3</span></div></header>
        <p className="maturity-matrix-hint">移动端可横向滚动，团队列固定在左侧；缺失值显示为“—”，不补零。</p>
        <div className="maturity-table-wrap maturity-table-wrap--matrix">
          <table className="maturity-table maturity-matrix-table">
            <thead><tr><th scope="col" className="maturity-sticky-column">团队</th>{(data?.activities ?? []).map((activity) => <th scope="col" key={activity.activity_id}><button type="button" className="maturity-column-button" onClick={() => onOpenActivity(activity.activity_id)}>{activity.activity_name}</button></th>)}</tr></thead>
            <tbody>
              <tr className="maturity-average-row">
                <th scope="row" className="maturity-sticky-column">领域平均</th>
                {(data?.activities ?? []).map((activity) => <td key={activity.activity_id}><MaturityLevel cell={summaries.get(activity.activity_id)} summary={summaries.get(activity.activity_id)} /></td>)}
              </tr>
              {(data?.teams ?? []).map((team) => (
              <tr key={team.team_id}>
                <th scope="row" className="maturity-sticky-column"><button type="button" className={`maturity-team-button ${selected.has(String(team.team_id)) ? 'is-selected' : ''}`} aria-pressed={selected.has(String(team.team_id))} onClick={() => onToggleTeam(String(team.team_id))}><i style={{ backgroundColor: teamColors[String(team.team_id)] }} />{team.team_name}</button></th>
                {(data?.activities ?? []).map((activity) => {
                  const cell = team.cells.find((item) => item.activity_id === activity.activity_id)
                  const summary = summaries.get(activity.activity_id)
                  return <td key={activity.activity_id} className={cell?.score === null || cell?.score === undefined ? 'is-missing' : ''}><button type="button" style={{ '--maturity-level-color': maturityLevelColor(cell?.grade) }} className={`maturity-cell-button ${cell?.score === null || cell?.score === undefined ? 'is-missing' : `is-level-${cell.grade}`} `} aria-label={`${team.team_name} ${activity.activity_name} ${cell?.score === null || cell?.score === undefined ? '未评估' : `${cell.level} ${formatMaturityScore(cell)}`}`} onClick={() => onOpenActivity(activity.activity_id)}><MaturityLevel cell={cell} summary={summary} /></button></td>
                })}
              </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="maturity-team-lower-grid">
        <section className="maturity-panel">
          <header className="maturity-panel__header"><div><h2>成熟度雷达对比</h2><p>{showBaseline ? '灰色虚线为领域平均，可在筛选条关闭。' : '领域基线已关闭。'}</p></div></header>
          <MaturityRadar activities={data?.activities ?? []} series={radarSeries} ariaLabel="团队成熟度雷达对比图" />
        </section>
        <section className="maturity-panel">
          <header className="maturity-panel__header"><div><h2>数值对照</h2><p>分值为团队原始分值；Δ = 团队分值 − 领域平均</p></div></header>
          <div className="maturity-table-wrap">
            <table className="maturity-table maturity-values-table">
              <thead><tr><th scope="col">团队</th><th scope="col">能力点</th><th scope="col">分值</th><th scope="col">Δ领域平均</th></tr></thead>
              <tbody>{(data?.teams ?? []).flatMap((team) => (data?.activities ?? []).map((activity) => {
                const cell = team.cells.find((item) => item.activity_id === activity.activity_id)
                return <tr key={`${team.team_id}-${activity.activity_id}`}><th scope="row">{team.team_name}</th><td>{activity.activity_name}</td><td className={cell?.score === null || cell?.score === undefined ? 'is-missing' : ''}>{formatMaturityScore(cell)}</td><td className={cell?.score === null || cell?.score === undefined || activity.score === null ? 'is-missing' : cell.score - activity.score >= 0 ? 'is-positive' : 'is-negative'}>{formatMaturityDelta(cell, activity)}</td></tr>
              }))}</tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  )
}

function MatrixDisclosure({ open, data, selectedTeamIds, showBaseline, teamColors, onToggle, onToggleTeam, onToggleBaseline, onOpenActivity }) {
  return (
    <details className="maturity-matrix-disclosure" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary><span>完整团队 × 能力点矩阵</span><small>默认收起；展开查看领域平均行与所有团队</small></summary>
      {data && <TeamMatrix data={data} selectedTeamIds={selectedTeamIds} showBaseline={showBaseline} teamColors={teamColors} onToggleTeam={onToggleTeam} onToggleBaseline={onToggleBaseline} onOpenActivity={onOpenActivity} />}
    </details>
  )
}

function MaturityMaintenanceDrawer({ open, team, month, catalog, onClose, onSaved, onSessionExpired }) {
  const [draft, setDraft] = useState([])
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearArmed, setClearArmed] = useState(false)
  const [error, setError] = useState(null)
  const recordsState = useMaturityRecords(team?.id, month, onSessionExpired, open)
  const activities = useMemo(() => [...(catalog ?? [])].sort((left, right) => (left.sort_order ?? left.id) - (right.sort_order ?? right.id)), [catalog])

  useEffect(() => {
    if (!open || recordsState.loading) return
    const records = new Map(recordsState.records.map((record) => [record.activity_id, record]))
    setDraft(activities.map((activity) => {
      const record = records.get(activity.id)
      return { activity_id: activity.id, activity_name: activity.name, kind: activity.kind, score: record?.score_raw ?? '', note: record?.note ?? '' }
    }))
    setPreview(false)
    setClearArmed(false)
    setError(null)
  }, [activities, open, recordsState.loading, recordsState.records])

  function updateEntry(activityId, patch) {
    setDraft((current) => current.map((entry) => entry.activity_id === activityId ? { ...entry, ...patch } : entry))
  }

  function copyPrevious() {
    const previous = new Map(recordsState.previousRecords.map((record) => [record.activity_id, record]))
    const copiedCount = recordsState.previousRecords.length
    setDraft((current) => current.map((entry) => {
      const record = previous.get(entry.activity_id)
      return record ? { ...entry, score: record.score_raw, note: record.note ?? '' } : entry
    }))
    setError(copiedCount ? `已载入上月 ${copiedCount} 条已有评估，请预览确认后保存。` : '上月没有已评估值，当前月仍保持未评估。')
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await fetchJson(`/api/maturity/teams/${team.id}/months/${month}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(maturitySavePayload(draft)) })
      onSaved?.()
    } catch (nextError) {
      setError(nextError.message)
      if (nextError.status === 401) onSessionExpired?.()
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    if (!clearArmed) {
      setClearArmed(true)
      return
    }
    setClearing(true)
    setError(null)
    try {
      await fetchJson(`/api/maturity/teams/${team.id}/months/${month}`, { method: 'DELETE' })
      setDraft((current) => current.map((entry) => ({ ...entry, score: '', note: '' })))
      setClearArmed(false)
      setPreview(false)
      onSaved?.()
    } catch (nextError) {
      setError(nextError.message)
      if (nextError.status === 401) onSessionExpired?.()
    } finally {
      setClearing(false)
    }
  }

  const groupedActivities = ['key', 'general'].map((kind) => ({ kind, items: draft.filter((entry) => entry.kind === kind) }))
  return (
    <Drawer open={open} onClose={onClose} size={Math.min(620, typeof window === 'undefined' ? 620 : window.innerWidth - 24)} title={`维护成熟度 · ${team?.name ?? ''} · ${month}`}>
      <div className="maturity-drawer">
        <p className="maturity-drawer__notice">人工维护数据 · 按月独立保存 · 不自动沿用上月。保存前可复制上月已有值并预览。</p>
        {recordsState.loading && <div className="maturity-drawer__state">正在加载当前月和上月评估…</div>}
        {recordsState.error && <div className="maturity-drawer__error" role="alert">加载失败：{recordsState.error.message}</div>}
        {!recordsState.loading && groupedActivities.map(({ kind, items }) => (
          <section key={kind} className="maturity-drawer__group">
            <h2>{kind === 'key' ? '关键研发活动' : '通用研发能力'}</h2>
            {items.map((entry) => (
              <div key={entry.activity_id} className="maturity-drawer__row">
                <label><span>{entry.activity_name}</span><input aria-label={`${entry.activity_name}成熟度分值`} type="number" min="0" max="5" step="0.01" value={entry.score} onChange={(event) => updateEntry(entry.activity_id, { score: event.target.value })} placeholder="未评估" /></label>
                <label><span>说明</span><textarea aria-label={`${entry.activity_name}说明`} rows="2" value={entry.note} onChange={(event) => updateEntry(entry.activity_id, { note: event.target.value })} placeholder="可选" /></label>
              </div>
            ))}
          </section>
        ))}
        {error && <div className="maturity-drawer__message" role="status">{error}</div>}
        {preview && (
          <section className="maturity-drawer__preview">
            <h2>保存预览</h2>
            <p>确认后才会创建或更新 {month} 的成熟度记录；空值会清除当前月对应评估。</p>
            <div className="maturity-table-wrap"><table className="maturity-table"><thead><tr><th>能力点</th><th>分值</th><th>说明</th></tr></thead><tbody>{draft.map((entry) => <tr key={entry.activity_id}><th>{entry.activity_name}</th><td>{entry.score || '—'}</td><td>{entry.note || '—'}</td></tr>)}</tbody></table></div>
          </section>
        )}
        <div className="maturity-drawer__actions">
          <button type="button" onClick={copyPrevious} disabled={recordsState.loading || !recordsState.previousRecords.length}>复制上月已有值</button>
          {!preview ? <button type="button" className="overview-primary-button" onClick={() => setPreview(true)} disabled={recordsState.loading}>预览保存</button> : <><button type="button" className="overview-primary-button" onClick={save} disabled={saving || clearing}>{saving ? '保存中…' : '确认保存'}</button><button type="button" onClick={() => setPreview(false)} disabled={saving}>返回编辑</button></>}
          <button type="button" className="maturity-danger-button" onClick={clear} disabled={saving || clearing}>{clearing ? '清空中…' : clearArmed ? '再次确认清空' : '清空本月评估'}</button>
        </div>
      </div>
    </Drawer>
  )
}

function DomainMetricSummary({ data, metric, periodId }) {
  const periodIdForSummary = periodId === 'all' || periodId === null || periodId === undefined
    ? data?.periods?.at(-1)?.id
    : periodId
  const snapshot = metricPointForMonth(data, periodIdForSummary)
  const companyPoint = snapshot.company
  if (!snapshot.hasData) return <EmptyState>当前深入分析周期暂无事实数据。</EmptyState>
  return (
    <div className="metric-domain-summary" aria-label="领域指标合并口径">
      <div><span>company_average</span><strong>{formatMetricValue(metric, companyPoint?.value)}</strong></div>
      <p>有效团队：{snapshot.validTeamCount} / {snapshot.totalTeamCount} · 周期：{periodIdForSummary ?? '—'}</p>
      <p>{snapshot.teams.find((team) => team.point)?.point ? formatFactSummary(metric, snapshot.teams.find((team) => team.point).point) : '暂无团队事实明细'}</p>
      {metric.type === 'boolean' && <div className="metric-domain-summary__company"><span>布尔指标</span><strong>{snapshot.validTeamCount ? `${snapshot.teams.filter((team) => team.point?.value).length} 个团队具备` : '—'}</strong></div>}
    </div>
  )
}

function MetricComparison({ catalog, teams, versions, overviewComputed, filter: controlledFilter, onFilterChange, onNavigate, onSessionExpired, teamColors }) {
  const [expanded, setExpanded] = useState(false)
  const [localFilter, setLocalFilter] = useState(INITIAL_FILTER)
  const filter = controlledFilter ?? localFilter
  const setFilter = onFilterChange ?? setLocalFilter
  const entries = useMemo(() => catalog?.flatMap((activity) => activity.metrics.map((metric) => ({ activity, metric }))) ?? [], [catalog])
  const firstEntry = entries[0]
  const [metricId, setMetricId] = useState(firstEntry?.metric.id ?? '')
  const entry = entries.find((item) => String(item.metric.id) === String(metricId)) ?? firstEntry
  const metricCatalog = useMemo(() => entry ? [{ ...entry.activity, metrics: [entry.metric] }] : [], [entry])
  const fallback = Boolean(entry && isGeneralIterationFallback(entry.activity, filter))
  const reuseOverview = Boolean(expanded && overviewComputed && (filter.dimension === 'time' && filter.granularity === 'month' || fallback))
  const computed = useComputedMetrics(expanded && !reuseOverview ? metricCatalog : EMPTY_METRIC_CATALOG, filter, onSessionExpired)
  const data = entry && reuseOverview ? overviewComputed.data[entry.metric.id] : entry ? computed.data[entry.metric.id] : null
  const errors = reuseOverview ? overviewComputed.errors : computed.errors
  const loading = reuseOverview ? overviewComputed.loading : computed.loading
  const timePeriods = data?.periods ?? []
  const iterationPeriodsForFilter = useMemo(() => iterationPeriods(versions, filter.versionId), [filter.versionId, versions])
  const periods = filter.dimension === 'iteration' ? iterationPeriodsForFilter : timePeriods

  useEffect(() => {
    if (!entry || String(entry.metric.id) === String(metricId)) return
    setMetricId(entry.metric.id)
  }, [entry, metricId])

  useEffect(() => {
    if (!expanded || !periods.length) return
    const ids = new Set(periods.map((period) => String(period.id)))
    if (filter.periodId === null || (filter.periodId !== 'all' && !ids.has(String(filter.periodId)))) {
      setFilter((current) => ({ ...current, periodId: latestPeriodId(periods) }))
    }
  }, [expanded, filter.periodId, periods, setFilter])

  return (
    <section className="maturity-panel metric-comparison-panel">
      <header className="maturity-panel__header metric-comparison-panel__header"><div><h2>指标集中比较</h2><p>成熟度评估月与指标周/月、版本/迭代筛选相互独立；指标详情保留真实分子、分母和样本量。</p></div><button type="button" className="overview-primary-button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>{expanded ? '收起指标比较' : '展开指标比较'}</button></header>
      {expanded && entry && (
        <div className="metric-comparison-panel__body">
          <div className="metric-comparison-panel__controls">
            <label><span>指标</span><select aria-label="集中比较指标" value={entry.metric.id} onChange={(event) => setMetricId(event.target.value)}>{catalog.flatMap((activity) => activity.metrics.map((metric) => <option key={metric.id} value={metric.id}>{activity.name} · {metric.name}</option>))}</select></label>
            <FilterBar filter={filter} onChange={setFilter} versions={versions} periods={timePeriods} loading={loading} />
          </div>
          <DomainMetricSummary data={data} metric={entry.metric} periodId={filter.periodId} />
          <TrendCard activity={entry.activity} metric={entry.metric} data={data} error={errors[entry.metric.id]} loading={loading} teams={teams} teamColors={teamColors} periodId={filter.periodId} fallback={fallback} onNavigate={onNavigate} showMetricPills={false} showMetricDetailLink countAsBars={entry.metric.type === 'count'} />
        </div>
      )}
    </section>
  )
}

export default function OverviewPage({
  catalog,
  teams,
  versions,
  user,
  onNavigate,
  onSessionExpired,
  filter: controlledFilter,
  onFilterChange,
  maturityState: controlledMaturityState,
  onMaturityChange,
}) {
  const [localMaturityState, setLocalMaturityState] = useState(() => normalizeMaturityState({}, { teams }))
  const maturityState = normalizeMaturityState(controlledMaturityState ?? localMaturityState, { teams })
  const setMaturityState = onMaturityChange ?? setLocalMaturityState
  const [maturityRevision, setMaturityRevision] = useState(0)
  const maturity = useMaturityOverview(maturityState.month, maturityState.category, onSessionExpired, maturityRevision)
  const overviewComputed = useComputedMetrics(catalog ?? EMPTY_METRIC_CATALOG, MONTHLY_FILTER, onSessionExpired)
  const [maintenanceTeamId, setMaintenanceTeamId] = useState(() => user?.role === 'maintainer' ? String(user.maintainer_team_id) : '')
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)
  const [signalOpen, setSignalOpen] = useState(false)
  const signalButtonRef = useRef(null)

  const teamIdsKey = teams.map((team) => team.id).join(',')
  const colorSlotsRef = useRef(null)
  if (colorSlotsRef.current === null) {
    try {
      const stored = typeof window === 'undefined' ? {} : JSON.parse(window.localStorage.getItem(TEAM_COLOR_STORAGE_KEY) ?? '{}')
      colorSlotsRef.current = stored && typeof stored === 'object' ? stored : {}
    } catch {
      colorSlotsRef.current = {}
    }
  }
  const teamColors = useMemo(() => {
    const assigned = assignTeamColorSlots(teams.map((team) => team.id), colorSlotsRef.current)
    colorSlotsRef.current = assigned.slots
    return assigned.colors
  }, [teamIdsKey, teams])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(TEAM_COLOR_STORAGE_KEY, JSON.stringify(colorSlotsRef.current))
    } catch {
      // 浏览器禁用本地存储时，当前页面内的 ref 仍能保持颜色稳定。
    }
  }, [teamIdsKey])

  useEffect(() => {
    const allowed = user?.role === 'admin' ? teams : teams.filter((team) => String(team.id) === String(user?.maintainer_team_id))
    if (!allowed.some((team) => String(team.id) === String(maintenanceTeamId))) setMaintenanceTeamId(allowed.length === 1 ? String(allowed[0].id) : '')
  }, [maintenanceTeamId, teams, user])

  function updateMaturity(next, options) {
    const candidate = typeof next === 'function' ? next(maturityState) : next
    setMaturityState(normalizeMaturityState(candidate, { teams }), options)
  }

  function openActivity(activityId) {
    const activity = catalog.find((item) => String(item.id) === String(activityId))
    const metric = activity?.metrics?.[0]
    if (metric) onNavigate?.(`/analytics/metrics/${metric.id}`)
  }

  const maintenanceTeam = teams.find((team) => String(team.id) === String(maintenanceTeamId))
  const canEdit = user?.role === 'admin' || user?.role === 'maintainer'
  const maturityError = maturity.error
  const activeActivities = useMemo(() => (catalog ?? []).filter((activity) => activity.kind === maturityState.category), [catalog, maturityState.category])
  const factRows = useMemo(() => buildMetricRows({
    activities: activeActivities,
    dataByMetric: overviewComputed.data,
    errors: overviewComputed.errors,
    month: maturityState.month,
    teams,
  }), [activeActivities, maturityState.month, overviewComputed.data, overviewComputed.errors, teams])
  const attentionItems = useMemo(() => buildAttentionItems({
    activities: activeActivities,
    dataByMetric: overviewComputed.data,
    errors: overviewComputed.errors,
    maturityData: maturity.data,
    month: maturityState.month,
    teams,
  }), [activeActivities, maturity.data, maturityState.month, overviewComputed.data, overviewComputed.errors, teams])

  function toggleMatrix(open) {
    updateMaturity({ ...maturityState, view: open ? 'team' : 'domain' }, { history: 'push' })
  }

  function toggleTeam(teamId) {
    const compareTeamIds = maturityState.compareTeamIds.includes(teamId)
      ? maturityState.compareTeamIds.filter((id) => id !== teamId)
      : maturityState.compareTeamIds.length < 3 ? [...maturityState.compareTeamIds, teamId] : maturityState.compareTeamIds
    updateMaturity({ ...maturityState, compareTeamIds }, { history: 'push' })
  }

  function openMaintenanceFromSignal() {
    if (!maintenanceTeamId && teams[0]) setMaintenanceTeamId(String(teams[0].id))
    setSignalOpen(false)
    setMaintenanceOpen(true)
  }

  return (
    <div className="overview-shell maturity-overview-shell">
      <div className="overview-page-head">
        <div><p className="overview-eyebrow">Engineering intelligence</p><h1>研发总览</h1><p className="overview-page-intro">从组织信号定位需处理的问题，再下钻到团队、能力点与事实证据。</p></div>
        <p className="overview-slice-description"><span>当前视图</span>{maturityState.month} · {maturityState.category === 'key' ? '关键研发活动' : '通用研发能力'}</p>
      </div>
      <OverviewControls state={maturityState} teams={teams} user={user} maintenanceTeamId={maintenanceTeamId} onMaintenanceTeamChange={setMaintenanceTeamId} onChange={updateMaturity} onOpenMaintenance={() => setMaintenanceOpen(true)} />
      <SignalSummary items={attentionItems} loading={overviewComputed.loading || maturity.loading} onOpen={() => setSignalOpen(true)} buttonRef={signalButtonRef} />
      {maturity.loading && <div className="maturity-state">正在加载 {maturityState.month} 成熟度评估…</div>}
      {!maturity.loading && maturityError && <div className="maturity-state maturity-state--error" role="alert">成熟度数据加载失败：{maturityError.message}</div>}
      {!maturity.loading && !maturityError && <InsightGrid category={maturityState.category} month={maturityState.month} maturityHistory={maturity.history ?? []} maturityActivities={activeActivities} dataByMetric={overviewComputed.data} errors={overviewComputed.errors} teams={teams} loading={{ maturity: maturity.loading, metrics: overviewComputed.loading }} />}
      {!maturity.loading && !maturityError && <DomainView data={maturity.data} category={maturityState.category} sort={maturityState.sort} activities={activeActivities} history={maturity.history ?? []} dataByMetric={overviewComputed.data} errors={overviewComputed.errors} teams={teams} month={maturityState.month} factRows={factRows} metricsLoading={overviewComputed.loading} onOpenActivity={openActivity} onNavigate={onNavigate} />}
      {!maturity.loading && !maturityError && <MatrixDisclosure open={maturityState.view === 'team'} data={maturity.data} selectedTeamIds={maturityState.compareTeamIds} showBaseline={maturityState.showBaseline} teamColors={teamColors} onToggle={toggleMatrix} onToggleTeam={toggleTeam} onToggleBaseline={(showBaseline) => updateMaturity({ ...maturityState, showBaseline }, { history: 'push' })} onOpenActivity={openActivity} />}
      <MetricComparison catalog={catalog} teams={teams} versions={versions} overviewComputed={overviewComputed} filter={controlledFilter} onFilterChange={onFilterChange} onNavigate={onNavigate} onSessionExpired={onSessionExpired} teamColors={teamColors} />
      <SignalDrawer open={signalOpen} items={attentionItems} month={maturityState.month} canEdit={canEdit} onClose={() => setSignalOpen(false)} onNavigate={onNavigate} onOpenMaintenance={openMaintenanceFromSignal} onClosed={() => signalButtonRef.current?.focus()} />
      {canEdit && <MaturityMaintenanceDrawer open={maintenanceOpen} team={maintenanceTeam} month={maturityState.month} catalog={catalog} onClose={() => setMaintenanceOpen(false)} onSaved={() => { setMaturityRevision((revision) => revision + 1); setMaintenanceOpen(false) }} onSessionExpired={onSessionExpired} />}
    </div>
  )
}

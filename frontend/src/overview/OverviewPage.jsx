import { useEffect, useMemo, useRef, useState } from 'react'
import { Drawer } from 'antd'

import { fetchJson } from '../api'
import EChart from '../components/EChart'
import { booleanStatusRows } from '../metricDetail/metricDetailLogic'
import FilterBar from './FilterBar'
import MaturityRadar from './MaturityRadar'
import { buildTrendOption } from './chartOption'
import { maturityLevelColor, sortMaturityActivities } from './maturityChartOption'
import {
  maturitySavePayload,
  useMaturityOverview,
  useMaturityRecords,
} from './maturityData'
import { hasNumericValues, useComputedMetrics } from './metricData'
import {
  assignTeamColorSlots,
  currentMetricValues,
  formatFactSummary,
  formatMetricValue,
  buildAttentionItems,
  buildMetricRows,
  factCompleteness,
  INITIAL_FILTER,
  isGeneralIterationFallback,
  iterationPeriods,
  latestPeriodId,
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

function formatCoverage(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—'
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

function MaturitySummary({ data, factState }) {
  const score = maturityAverageScore(data)
  const factStatus = factState.loading
    ? '加载中'
    : factState.total === 0
    ? '暂无目录指标'
    : factState.available === 0 ? '暂无事实'
    : factState.available === factState.total ? '事实完整' : '部分缺失'
  return (
    <div className="maturity-summary-grid">
      <article className="maturity-summary-card"><span>团队数</span><strong>{data?.team_count ?? '—'}</strong><small>当前领域全部团队</small></article>
      <article className="maturity-summary-card"><span>领域平均成熟度</span><strong>{score === null ? '—' : score.toFixed(2)}</strong><small>当前分类已评估能力点平均</small></article>
      <article className="maturity-summary-card"><span>成熟度评估覆盖率</span><strong>{formatCoverage(data?.coverage_rate)}</strong><small>{data?.assessed_cell_count ?? 0} / {data?.total_cell_count ?? 0} 个团队×能力点</small></article>
      <article className="maturity-summary-card"><span>事实完整状态</span><strong>{factStatus}</strong><small>{factState.available} / {factState.total} 个指标在 {data?.month ?? '选定月份'} 有有效数据</small></article>
    </div>
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
    <section className="overview-performance-section" aria-labelledby={`performance-${title}`}>
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
              {onNavigate && <button type="button" className="fact-performance-row__link" onClick={() => onNavigate(`/analytics/metrics/${row.metric.id}`)}>下钻</button>}
            </li>
          )
        })}
      </ol>}
    </section>
  )
}

function AttentionPanel({ items, loading = false, onNavigate }) {
  const visibleItems = items.slice(0, 8)
  function itemLabel(item) {
    if (item.type === 'maturity-missing') return item.activityName
    if (item.teamName) return `${item.teamName} · ${item.activityName}`
    return item.activityName
  }

  return (
    <section className="overview-panel attention-panel" aria-labelledby="attention-title">
      <header className="overview-section-header"><div><h2 id="attention-title">需关注项</h2><p>只基于当前月份的缺失、负提效和相对比较。</p></div><span className="overview-section-header__note">{items.length} 项</span></header>
      {loading && <p className="overview-empty">正在加载当前月份事实…</p>}
      {!loading && !visibleItems.length && <p className="overview-empty">当前没有按规则生成的需关注项。</p>}
      {!loading && !!visibleItems.length && <ul className="attention-list">
        {visibleItems.map((item, index) => (
          <li key={`${item.type}-${item.metricId ?? item.activityId}-${item.teamId ?? index}`} className={`attention-item is-${item.type}`}>
            <span className="attention-item__marker" aria-hidden="true" />
            <div><strong>{itemLabel(item)}</strong><span>{item.metricName ? `${item.metricName} · ` : ''}{item.reason}{item.value !== undefined ? ` · ${formatMetricValue({ type: item.metricType ?? 'ratio' }, item.value)}` : ''}</span></div>
            {item.metricId && onNavigate && <button type="button" className="attention-item__link" onClick={() => onNavigate(`/analytics/metrics/${item.metricId}`)}>查看</button>}
          </li>
        ))}
      </ul>}
      {items.length > visibleItems.length && <p className="overview-card-note">已显示优先级最高的 {visibleItems.length} 项。</p>}
    </section>
  )
}

function DomainView({ data, category, sort, factRows, attentionItems, metricsLoading, onOpenActivity, onNavigate }) {
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
  const summaryFactState = { ...factCompleteness(factRows), loading: metricsLoading }
  return (
    <>
      <MaturitySummary data={data} factState={summaryFactState} />
      <div className="overview-hero-grid">
        <section className="overview-panel overview-radar-panel">
          <header className="overview-section-header"><div><h2>领域成熟度雷达</h2><p>{data?.month ?? '选定月份'} · 0–5 分；缺失轴不补零。</p></div><span className="overview-section-header__note">{sort === 'score' ? '详情按分数排序' : '目录顺序'}</span></header>
          <MaturityRadar activities={radarActivities} series={radarSeries} ariaLabel="领域平均成熟度雷达图" />
        </section>
        <AttentionPanel items={attentionItems} loading={metricsLoading} onNavigate={onNavigate} />
      </div>
      <FactPerformanceSection title={category === 'key' ? 'AI 渗透率' : '比率'} description="按目录实际存在的渗透率/比率指标横向比较当前月数据。" rows={penetrationRows} loading={metricsLoading} onNavigate={onNavigate} />
      <FactPerformanceSection title="提效率" description="只展示目录中实际存在的 efficiency 指标；负值保留原始语义。" rows={efficiencyRows} loading={metricsLoading} onNavigate={onNavigate} />
      <FactPerformanceSection title="数量" description="目录中存在数量指标时按当前月 company_average 展示。" rows={countRows} loading={metricsLoading} onNavigate={onNavigate} />
      <FactPerformanceSection title="布尔状态" description="按团队展示当前月状态；布尔指标没有 company_average。" rows={booleanRows} loading={metricsLoading} onNavigate={onNavigate} />
      <section className="maturity-panel maturity-detail-panel">
        <header className="maturity-panel__header"><div><h2>能力点明细</h2><p>点击能力点进入现有指标与趋势详情；分布仅统计已评估团队</p></div></header>
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

  return (
    <div className="overview-shell maturity-overview-shell">
      <div className="overview-page-head">
        <div><p className="overview-eyebrow">研发效能 · 先看整体与短板，再看指标</p><h1>研发总览</h1></div>
        <p className="overview-slice-description">{maturityState.month} · {maturityState.category === 'key' ? '关键研发活动' : '通用研发能力'} · 成熟度与事实共用分析月份</p>
      </div>
      <OverviewControls state={maturityState} teams={teams} user={user} maintenanceTeamId={maintenanceTeamId} onMaintenanceTeamChange={setMaintenanceTeamId} onChange={updateMaturity} onOpenMaintenance={() => setMaintenanceOpen(true)} />
      {maturity.loading && <div className="maturity-state">正在加载 {maturityState.month} 成熟度评估…</div>}
      {!maturity.loading && maturityError && <div className="maturity-state maturity-state--error" role="alert">成熟度数据加载失败：{maturityError.message}</div>}
      {!maturity.loading && !maturityError && <DomainView data={maturity.data} category={maturityState.category} sort={maturityState.sort} factRows={factRows} attentionItems={attentionItems} metricsLoading={overviewComputed.loading} onOpenActivity={openActivity} onNavigate={onNavigate} />}
      {!maturity.loading && !maturityError && <MatrixDisclosure open={maturityState.view === 'team'} data={maturity.data} selectedTeamIds={maturityState.compareTeamIds} showBaseline={maturityState.showBaseline} teamColors={teamColors} onToggle={toggleMatrix} onToggleTeam={toggleTeam} onToggleBaseline={(showBaseline) => updateMaturity({ ...maturityState, showBaseline }, { history: 'push' })} onOpenActivity={openActivity} />}
      <MetricComparison catalog={catalog} teams={teams} versions={versions} overviewComputed={overviewComputed} filter={controlledFilter} onFilterChange={onFilterChange} onNavigate={onNavigate} onSessionExpired={onSessionExpired} teamColors={teamColors} />
      {canEdit && <MaturityMaintenanceDrawer open={maintenanceOpen} team={maintenanceTeam} month={maturityState.month} catalog={catalog} onClose={() => setMaintenanceOpen(false)} onSaved={() => { setMaturityRevision((revision) => revision + 1); setMaintenanceOpen(false) }} onSessionExpired={onSessionExpired} />}
    </div>
  )
}

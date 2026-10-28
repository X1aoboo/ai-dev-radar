import React from 'react'
import { act, create } from 'react-test-renderer'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const { metricLoadError, maturityLoadError, maturityCalls, emptyMetrics, irOverviewResponse, requirementRoleError } = vi.hoisted(() => ({ metricLoadError: { current: null }, maturityLoadError: { current: null }, maturityCalls: { current: [] }, emptyMetrics: { current: false }, irOverviewResponse: { current: null }, requirementRoleError: { current: null } }))

vi.mock('../components/EChart', () => ({
  default: ({ ariaLabel, onClick }) => onClick
    ? <button type="button" aria-label={ariaLabel} onClick={onClick} />
    : <div role="img" aria-label={ariaLabel} />,
}))

vi.mock('antd', () => ({
  Button: ({ children, onClick, ...props }) => <button type="button" onClick={onClick} {...props}>{children}</button>,
  Drawer: ({ open, children, onClose }) => open ? <aside data-drawer><button type="button" data-close onClick={onClose}>关闭</button>{children}</aside> : null,
  Select: ({ ref, value, onChange, options = [], open: _open, onOpenChange: _onOpenChange, suffixIcon: _suffixIcon, ...props }) => <select {...props} ref={ref} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>,
}))

const teams = [{ id: 1, name: '团队A' }, { id: 2, name: '团队B' }]
const catalog = [
  { id: 1, name: '编码开发', kind: 'key', metrics: [{ id: 11, name: 'AI 渗透率', type: 'penetration', numerator_semantic: 'AI数', denominator_semantic: '总数' }, { id: 12, name: '需求数量', type: 'count', numerator_semantic: '需求数' }] },
  { id: 2, name: '通用能力一', kind: 'general', metrics: [{ id: 21, name: '能力覆盖率', type: 'penetration', numerator_semantic: 'AI数', denominator_semantic: '总数' }] },
]
const rootCatalog = [
  { ...catalog[0], code: 'cd', metrics: [...catalog[0].metrics.map((metric) => metric.id === 11 ? { ...metric, code: 'cd-ar-pen' } : metric), { id: 13, code: 'cd-eff', name: '编码效率', type: 'efficiency', numerator_semantic: '预估人天', denominator_semantic: '实际人天' }] },
  catalog[1],
  { id: 3, code: 'tce', name: '测试用例执行', kind: 'key', metrics: [{ id: 31, code: 'tce-count', name: '用例执行数', type: 'count', numerator_semantic: '执行用例数' }, { id: 32, code: 'tce-rate', name: '用例执行率', type: 'ratio', numerator_semantic: 'AI执行用例数', denominator_semantic: '执行用例总数' }] },
  { id: 4, code: 'tcg', name: '测试用例生成', kind: 'key', metrics: [{ id: 40, code: 'tcg-sr-pen', name: 'SR需求渗透率', type: 'penetration', numerator_semantic: '使用AI生成用例的SR数', denominator_semantic: 'SR总数' }, { id: 41, code: 'tcg-rate', name: '测试用例生成率', type: 'ratio', numerator_semantic: 'AI生成用例数', denominator_semantic: '用例总数' }] },
  { id: 5, code: 'dta', name: 'DTS缺陷分析', kind: 'key', metrics: [{ id: 51, code: 'dta-pen', name: 'DTS渗透率', type: 'penetration', numerator_semantic: 'AI数', denominator_semantic: '总数' }] },
  { id: 6, code: 'dtf', name: 'DTS缺陷修复', kind: 'key', metrics: [{ id: 61, code: 'dtf-pen', name: 'DTS渗透率', type: 'penetration', numerator_semantic: 'AI数', denominator_semantic: '总数' }] },
  { id: 7, code: 'sa', name: 'SA设计', kind: 'key', metrics: [{ id: 71, code: 'sa-ir-pen', name: 'IR需求渗透率', type: 'penetration', numerator_semantic: '使用AI设计的IR数', denominator_semantic: 'IR总数' }, { id: 72, code: 'sa-eff', name: 'SA设计效率', type: 'efficiency', numerator_semantic: '预估人天', denominator_semantic: '实际人天' }] },
  { id: 8, code: 'se', name: 'SE设计', kind: 'key', metrics: [{ id: 81, code: 'se-ir-pen', name: 'IR需求渗透率', type: 'penetration', numerator_semantic: '使用AI设计的IR数', denominator_semantic: 'IR总数' }, { id: 82, code: 'se-eff', name: 'SE设计效率', type: 'efficiency', numerator_semantic: '预估人天', denominator_semantic: '实际人天' }] },
  { id: 9, code: 'dd', name: '开发设计', kind: 'key', metrics: [{ id: 91, code: 'dd-ar-pen', name: 'AR需求渗透率', type: 'penetration', numerator_semantic: '使用AI设计的AR数', denominator_semantic: 'AR总数' }, { id: 92, code: 'dd-eff', name: '开发设计效率', type: 'efficiency', numerator_semantic: '预估人天', denominator_semantic: '实际人天' }] },
]

function overviewData(kind, month) {
  const activities = catalog.filter((activity) => activity.kind === kind)
  return {
    month,
    kind,
    team_count: 2,
    assessed_cell_count: 1,
    total_cell_count: activities.length * 2,
    coverage_rate: 0.5,
    activities: activities.map((activity, index) => ({
      activity_id: activity.id,
      activity_name: activity.name,
      score: index === 0 ? 2 : null,
      score_display: index === 0 ? '2.00' : null,
      grade: index === 0 ? 2 : null,
      assessed_team_count: index === 0 ? 1 : 0,
    })),
    teams: teams.map((team, teamIndex) => ({
      team_id: team.id,
      team_name: team.name,
      cells: activities.map((activity, index) => ({
        activity_id: activity.id,
        score: teamIndex === 0 && index === 0 ? 2 : null,
        score_display: teamIndex === 0 && index === 0 ? '2.00' : null,
        grade: teamIndex === 0 && index === 0 ? 2 : null,
      })),
    })),
  }
}

function metricData(metric, granularity = 'month') {
  const periods = granularity === 'day'
    ? [{ id: '2026-03-01', label: '03-01' }, { id: '2026-03-02', label: '03-02' }]
    : [{ id: '2026-02', label: '02' }, { id: '2026-03', label: '03' }]
  return {
    periods,
    series: teams.map((team, index) => ({
      team_id: team.id,
      team_name: team.name,
      snapshot: metric.type === 'boolean' ? (index === 0 ? true : null) : undefined,
      values: periods.map((period) => ({ period_id: period.id, value: metric.type === 'boolean' || emptyMetrics.current ? null : index === 0 ? 0.4 : null, numerator: index === 0 ? 4 : 0, denominator: index === 0 ? 10 : 0 })),
    })),
    company_average: metric.type === 'boolean' ? [] : periods.map((period) => ({ period_id: period.id, value: emptyMetrics.current ? null : 0.4 })),
    domain_summary: metric.type === 'boolean' ? [] : periods.map((period) => ({ period_id: period.id, value: emptyMetrics.current ? null : 0.25, numerator: 4, denominator: 16, fact_count: 1, sample_count: 16 })),
  }
}

vi.mock('../overview/maturityData', () => ({
  maturityRecordsUrl: (teamId, month) => `/api/maturity/records?team_id=${teamId}&month=${month}`,
  maturityOverviewUrl: (month, kind) => `/api/maturity/overview?month=${month}&kind=${kind}`,
  useMaturityOverview: (month, kind, onSessionExpired, enabled = true) => {
    maturityCalls.current.push({ kind, enabled })
    if (!enabled) return { loading: false, error: null, data: null, history: [] }
    return maturityLoadError.current
      ? { loading: false, error: maturityLoadError.current, data: null, history: [] }
      : {
      loading: false,
      error: null,
      data: overviewData(kind, month),
      history: ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', month].map((item) => ({ month: item, data: overviewData(kind, item) })),
      }
  },
}))

vi.mock('../overview/metricData', async () => ({
  hasNumericValues: (data) => Boolean(data?.series?.some((series) => series.values.some((point) => typeof point.value === 'number'))),
  useComputedMetrics: (activities, filter) => ({
    loading: false,
    errors: metricLoadError.current
      ? Object.fromEntries(activities.flatMap((activity) => activity.metrics.map((metric) => [metric.id, metricLoadError.current])))
      : {},
    data: Object.fromEntries((activities ?? []).flatMap((activity) => activity.metrics.map((metric) => [metric.id, metricData(metric, filter.granularity)]))),
  }),
}))

vi.mock('../overview/requirementKpiData', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useRequirementOverviewMetrics: (fromMonth, toMonth, versionId, activity = 'design', role = 'all', onSessionExpired, options = {}) => {
      const data = irOverviewResponse.current
      return {
        loading: false,
        error: requirementRoleError.current && role !== 'all' ? requirementRoleError.current : null,
        data,
        benchmarkError: null,
        benchmarkData: options.benchmark === false ? null : data,
      }
    },
  }
})

vi.mock('../api', () => ({
  fetchJson: async (url) => {
    if (String(url).includes('/api/facts')) return []
    if (String(url).includes('/api/maturity/records')) return []
    if (String(url).includes('/api/maturity/overview')) return { month: '2026-03', kind: 'key', team_count: 2, activities: [], teams: [] }
    return {}
  },
}))

import OverviewPage from './OverviewPage.jsx'
import { ActivitiesPage, CapabilitiesPage } from '../analytics/AnalyticsPages.jsx'
import TeamDrilldownPage from '../drilldown/TeamDrilldownPage.jsx'
import MetricDetailPage from '../metricDetail/MetricDetailPage.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function renderText(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(renderText).join('')
  return renderText(node.children)
}

const analyticsProps = {
  catalog,
  teams,
  versions: [],
  maturityState: { month: '2026-03', category: 'key' },
  filter: { dimension: 'time', granularity: 'month', versionId: 'all', periodId: null, metricId: 'all' },
  onFilterChange: () => undefined,
  onMaturityChange: () => undefined,
  onNavigate: () => undefined,
  onSessionExpired: () => undefined,
}

function irOverviewData(empty = false, activity = 'design') {
  const periodIds = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']
  const baseCount = activity === 'development' ? 4 : 3
  const point = (period_id, values = {}) => ({
    period_id,
    fact_count: empty ? 0 : 2,
    known_ai_count: empty ? 0 : 2,
    ai_assisted_count: empty ? null : 1,
    ai_workload_count: empty ? 0 : 1,
    ai_estimated_workload: empty ? null : 10,
    ai_actual_workload: empty ? null : 5,
    ...values,
  })
  return {
    period_ids: periodIds,
    series: teams.map((team, index) => ({
      team_id: team.id,
      team_name: team.name,
      values: periodIds.map((periodId) => point(periodId, empty ? {} : index === 1 ? { ai_assisted_count: 0, ai_workload_count: 0, ai_estimated_workload: null, ai_actual_workload: null } : {})),
    })),
    domain_summary: periodIds.map((periodId) => point(periodId, empty ? {} : { fact_count: baseCount, known_ai_count: baseCount, ai_assisted_count: 1, ai_workload_count: 1, ai_estimated_workload: 10, ai_actual_workload: 5 })),
  }
}

beforeEach(() => {
  globalThis.window = { localStorage: { getItem: () => '{}', setItem: () => undefined } }
  metricLoadError.current = null
  maturityLoadError.current = null
  maturityCalls.current = []
  emptyMetrics.current = false
  requirementRoleError.current = null
  irOverviewResponse.current = irOverviewData()
})

afterEach(() => {
  delete globalThis.window
  metricLoadError.current = null
  maturityLoadError.current = null
  maturityCalls.current = []
  emptyMetrics.current = false
  requirementRoleError.current = null
  irOverviewResponse.current = null
})

test('root is an evidence-bounded management summary with no maturity maintenance action', async () => {
  let renderer
  await act(async () => { renderer = create(<OverviewPage {...analyticsProps} catalog={rootCatalog} />) })
  const text = renderText(renderer.toJSON())
  expect(text).toContain('研发总览')
  expect(text).toContain('关键研发活动成熟度矩阵')
  expect(text).toContain('领域整体成熟度画像')
  expect(text).toContain('本期领域平均')
  expect(text).toContain('上期领域平均')
  expect(text).toContain('核心趋势')
  expect(text).toContain('研发关键环节')
  expect(text).toContain('编码开发')
  expect(text).not.toContain('交付')
  expect(text).not.toContain('跨两个领域的团队成熟度')
  expect(text).toContain('团队表现')
  expect(text).toContain('AI需求渗透率')
  expect(text).not.toContain('DTS缺陷分析')
  expect(text).not.toContain('DTS缺陷修复')
  expect(renderer.root.findByProps({ className: 'executive-maturity-scale' }).props['aria-label']).toContain('0.0 为有效零分')
  expect(text).toContain('AI研发提效')
  expect(text).toContain('0pp')
  expect(text).toContain('AI覆盖需求数')
  expect(text).toContain('AI提效工作量')
  expect(text).toContain('AI需求渗透率')
  expect(text).toContain('AI研发提效')
  expect(text).not.toContain('团队单指标排名')
  expect(text).toContain('关键研发活动')
  expect(text).toContain('核心趋势')
  expect(renderer.root.findAllByProps({ className: 'metric-card__accessory-bars' })).toHaveLength(16)
  expect(renderer.root.findAll((node) => node.props?.['aria-label'] === '版本')).toHaveLength(0)
  expect(renderer.root.findByProps({ 'aria-label': '月份' }).type).toBe('button')
  expect(renderer.root.findByProps({ 'aria-label': '月份' }).props['aria-expanded']).toBe(false)
  expect(renderer.root.findAll((node) => node.type === 'select' && node.props['aria-label'] === '统计周期')).toHaveLength(1)
  expect(text).not.toContain('Target')
  expect(text).not.toContain('维护成熟度')
  expect(text.indexOf('核心趋势')).toBeLessThan(text.indexOf('关键研发活动'))
  expect(text.indexOf('关键研发活动')).toBeLessThan(text.indexOf('团队表现'))
  expect(text.indexOf('关键研发活动成熟度矩阵')).toBeLessThan(text.indexOf('团队表现'))
  const lifecycleItems = renderer.root.findAllByProps({ className: 'executive-lifecycle__item' })
  expect(lifecycleItems.map((item) => item.props['aria-label'])).toEqual([
    '选择关键环节：SA设计',
    '选择关键环节：SE设计',
    '选择关键环节：开发设计',
    '选择关键环节：编码开发',
    '选择关键环节：测试用例生成',
    '选择关键环节：测试用例执行',
  ])
  expect(lifecycleItems.every((item) => item.findAllByProps({ className: 'executive-lifecycle__icon' }).length === 1)).toBe(true)
  await act(async () => lifecycleItems[5].props.onClick())
  const selectedLifecycleText = renderText(renderer.toJSON())
  expect(selectedLifecycleText).toContain('测试用例执行 · AI需求渗透率趋势')
  expect(selectedLifecycleText).toContain('目录仅定义用例执行数和执行率，没有渗透率或提效类型指标。')
  renderer.unmount()
})

test('activity and capability pages use distinct directories and metric semantics', async () => {
  let renderer
  await act(async () => { renderer = create(<ActivitiesPage {...analyticsProps} catalog={rootCatalog} />) })
  expect(maturityCalls.current.at(-1)).toEqual({ kind: 'key', enabled: false })
  let text = renderText(renderer.toJSON())
  expect(text).toContain('研发活动')
  expect(text).toContain('月度核心成效')
  expect(text).toContain('周期整体成效')
  expect(text).toContain('AI覆盖需求数')
  expect(text).toContain('AI提效工作量')
  expect(text).toContain('核心趋势')
  expect(text).toContain('团队差异')
  expect(text).toContain('指标拆解与业务量')
  expect(text).toContain('AI需求渗透率')
  expect(text).toContain('AI研发提效')
  expect(renderer.root.findAll((node) => node.props?.['aria-label']?.includes('趋势图')).length).toBeGreaterThanOrEqual(2)
  const nextActivity = renderer.root.findByProps({ 'aria-label': '选择活动：测试用例执行' })
  expect(nextActivity.props['aria-pressed']).toBe(false)
  await act(async () => nextActivity.props.onClick())
  expect(renderer.root.findByProps({ 'aria-label': '选择活动：测试用例执行' }).props['aria-pressed']).toBe(true)
  expect(renderText(renderer.toJSON())).toContain('测试用例执行')
  renderer.unmount()

  await act(async () => { renderer = create(<CapabilitiesPage {...analyticsProps} />) })
  expect(maturityCalls.current.at(-1)).toEqual({ kind: 'general', enabled: true })
  text = renderText(renderer.toJSON())
  expect(text).toContain('研发能力')
  expect(text).toContain('能力覆盖率')
  expect(text).toContain('能力状态')
  expect(text).toContain('能力演进')
  expect(text).toContain('团队差异')
  expect(text).toContain('支撑指标与证据')
  expect(text).toContain('成熟度画像')
  const granularity = renderer.root.findByProps({ 'aria-label': '时间粒度' })
  expect(granularity.props.value).toBe('month')
  await act(async () => granularity.props.onChange('day'))
  expect(renderer.root.findByProps({ 'aria-label': '时间粒度' }).props.value).toBe('day')
  renderer.unmount()
})

test('chart detail keeps company mean separate from merged raw-count results', async () => {
  let renderer
  await act(async () => { renderer = create(<ActivitiesPage {...analyticsProps} />) })
  const charts = renderer.root.findAllByType('button')
  const metricChart = charts.find((chart) => chart.props['aria-label']?.includes('AI 渗透率'))
  await act(async () => metricChart.props.onClick({}))
  const text = renderText(renderer.toJSON())
  expect(text).toContain('全公司均值')
  expect(text).toContain('40%')
  expect(text).toContain('合并口径结果')
  expect(text).toContain('25%')
  expect(text).toContain('合并分子')
  expect(text).toContain('合并分母')
  expect(text).toContain('样本量')
  expect(text).toContain('两者不可互换')
  expect(text).toContain('打开现有指标详情')
  renderer.unmount()
})

test('overview KPIs explain the selected month when all metric values are missing', async () => {
  emptyMetrics.current = true
  irOverviewResponse.current = irOverviewData(true)
  let renderer
  await act(async () => { renderer = create(<OverviewPage {...analyticsProps} catalog={rootCatalog} />) })
  const text = renderText(renderer.toJSON())
  expect(text).toContain('当月 设计活动记录 0 条')
  expect(text).toContain('本月暂无设计活动记录')
  expect(text).toContain('AI需求渗透率')
  renderer.unmount()
})

test('activity metrics show a compact no-history state instead of an empty chart slot', async () => {
  emptyMetrics.current = true
  let renderer
  await act(async () => { renderer = create(<ActivitiesPage {...analyticsProps} />) })
  const text = renderText(renderer.toJSON())
  expect(text).toContain('近六个月没有可展示的历史事实。')
  expect(renderer.root.findAll((node) => node.props?.['aria-label']?.includes('AI 渗透率 趋势图'))).toHaveLength(0)
  renderer.unmount()
})

test('activity workspace keeps time-based URL filters and hides version/iteration controls', async () => {
  const onFilterChange = vi.fn()
  const props = {
    ...analyticsProps,
    catalog: rootCatalog,
    onFilterChange,
    filter: { ...analyticsProps.filter, periodId: '2026-03' },
  }
  let renderer
  await act(async () => { renderer = create(<ActivitiesPage {...props} />) })

  const metricSelect = renderer.root.findByProps({ 'aria-label': '指标' })
  await act(async () => metricSelect.props.onChange({ target: { value: '11' } }))
  expect(onFilterChange).toHaveBeenLastCalledWith(expect.objectContaining({ metricId: '11', periodId: null }), { history: 'push' })

  onFilterChange.mockClear()
  const halfYear = renderer.root.findByProps({ 'aria-label': '统计周期' })
  await act(async () => halfYear.props.onChange('half'))
  expect(onFilterChange).toHaveBeenLastCalledWith(expect.objectContaining({ cycle: 'half' }), { history: 'push' })

  onFilterChange.mockClear()
  expect(renderer.root.findAll((node) => node.props?.['aria-label'] === '版本')).toHaveLength(0)
  expect(renderer.root.findAll((node) => node.props?.['aria-label'] === '统计维度')).toHaveLength(0)
  const weekButton = renderer.root.findAllByType('button').find((button) => renderText(button.props.children) === '周')
  await act(async () => weekButton.props.onClick())
  expect(onFilterChange).toHaveBeenLastCalledWith(expect.objectContaining({ dimension: 'time', granularity: 'week', versionId: 'all', periodId: null }), { history: 'push' })

  await act(async () => renderer.update(<ActivitiesPage {...props} filter={{ ...props.filter, metricId: '11' }} />))
  const updatedText = renderText(renderer.toJSON())
  expect(updatedText).toContain('编码开发 · AI需求渗透率趋势')
  expect(updatedText).toContain('编码开发 · AI研发提效趋势')
  expect(renderer.root.findByProps({ 'aria-label': '周期' }).props.value).toBe('2026-03')

  await act(async () => renderer.update(<ActivitiesPage {...props} filter={{ ...props.filter, metricId: '11', periodId: 'all' }} />))
  const allPeriodsText = renderText(renderer.toJSON())
  expect(allPeriodsText).toContain('设计活动与开发活动分别统计')
  expect(allPeriodsText).toContain('不随活动选择变化')
  expect(allPeriodsText).toContain('设计活动AI覆盖数')
  expect(allPeriodsText).toContain('开发活动AI覆盖数')
  expect(allPeriodsText).toContain('测试用例生成数')
  expect(allPeriodsText).toContain('测试用例执行数')
  expect(allPeriodsText).not.toContain('AI覆盖IR需求数')
  expect(allPeriodsText).not.toContain('AI覆盖AR需求数')
  expect(allPeriodsText).not.toContain('最佳团队A · 40%')
  const reset = renderer.root.findByProps({ className: 'analytics-filter-reset' })
  await act(async () => reset.props.onClick())
  expect(onFilterChange).toHaveBeenLastCalledWith({ dimension: 'time', granularity: 'month', versionId: 'all', periodId: '2026-03', metricId: 'all', cycle: '6m' }, { history: 'push' })
  renderer.unmount()
})

test('metric detail labels the company_average result as the full-company mean', async () => {
  let renderer
  await act(async () => { renderer = create(<MetricDetailPage {...analyticsProps} filter={{ ...analyticsProps.filter, periodId: '2026-03' }} activity={catalog[0]} metric={catalog[0].metrics[0]} />) })
  const text = renderText(renderer.toJSON())
  expect(text).toContain('全公司均值')
  expect(text).not.toContain('领域当前值')
  expect(text).toContain('团队系列与全公司均值仅在同一指标内比较')
  expect(text).toContain('当前周期团队排名')
  expect(text).toContain('团队A')
  renderer.unmount()

  await act(async () => { renderer = create(<MetricDetailPage {...analyticsProps} filter={{ ...analyticsProps.filter, periodId: 'all' }} activity={catalog[0]} metric={catalog[0].metrics[0]} />) })
  const allPeriods = renderText(renderer.toJSON())
  expect(allPeriods).toContain('选择单一周期查看当前结果；全部周期仅展示趋势。')
  expect(allPeriods).toContain('选择单一周期查看原始事实。')
  renderer.unmount()
})

test('boolean metric detail uses team states instead of a company mean or rank', async () => {
  const activity = { id: 5, name: '自动化能力', kind: 'general', metrics: [{ id: 51, name: '能力是否具备', type: 'boolean' }] }
  let renderer
  await act(async () => { renderer = create(<MetricDetailPage {...analyticsProps} filter={{ ...analyticsProps.filter, periodId: 'all' }} activity={activity} metric={activity.metrics[0]} />) })
  const text = renderText(renderer.toJSON())
  expect(text).toContain('逐团队展示')
  expect(text).toContain('团队A')
  expect(text).toContain('团队B')
  expect(text).not.toContain('团队单指标排名')
  expect(text).not.toContain('当前周期团队排名')
  renderer.unmount()
})

test('analytics detail keeps metric and maturity failures in their owning sections', async () => {
  metricLoadError.current = new Error('原始指标接口暂不可用')
  let renderer
  await act(async () => { renderer = create(<ActivitiesPage {...analyticsProps} />) })
  const activityText = renderText(renderer.toJSON())
  expect(activityText).toContain('指标暂不可用，请稍后重试。')
  expect(activityText).not.toContain('原始指标接口暂不可用')
  renderer.unmount()

  metricLoadError.current = null
  maturityLoadError.current = new Error('成熟度接口暂不可用')
  await act(async () => { renderer = create(<CapabilitiesPage {...analyticsProps} />) })
  const text = renderText(renderer.toJSON())
  expect(text).toContain('研发能力')
  expect(text).toContain('能力状态')
  expect(text).toContain('能力覆盖率')
  expect(text).toContain('成熟度加载失败：成熟度接口暂不可用')
  renderer.unmount()
})

test('capability booleans render a team status list instead of a metric trend chart', async () => {
  const booleanCatalog = [...catalog, { id: 3, name: '自动化能力', kind: 'general', metrics: [{ id: 31, name: '能力是否具备', type: 'boolean' }] }]
  let renderer
  await act(async () => { renderer = create(<CapabilitiesPage {...analyticsProps} catalog={booleanCatalog} />) })
  const capabilityButton = renderer.root.findByProps({ 'aria-label': '查看能力：自动化能力' })
  await act(async () => capabilityButton.props.onClick())
  const text = renderText(renderer.toJSON())
  expect(text).toContain('布尔能力逐团队呈现，不合并比例')
  expect(text).toContain('不绘制 0/1 时间趋势')
  expect(text).toContain('团队A')
  expect(text).toContain('具备')
  expect(text).toContain('暂无数据')
  expect(renderer.root.findAll((node) => node.props?.['aria-label'] === '自动化能力 能力是否具备 趋势图')).toHaveLength(0)
  renderer.unmount()
})

test('capability team difference rows open the matching Team Drill-down', async () => {
  const onNavigate = vi.fn()
  let renderer
  await act(async () => { renderer = create(<CapabilitiesPage {...analyticsProps} onNavigate={onNavigate} />) })
  const teamButton = renderer.root.findByProps({ 'aria-label': '选择团队：团队A' })
  await act(async () => teamButton.props.onClick())
  expect(onNavigate).toHaveBeenCalledWith('/analytics/teams/1', { state: { returnTo: '/analytics/capabilities', returnLabel: '研发能力' } })
  renderer.unmount()
})

test('overview renders separate activity KPI rows, dual trends, lifecycle sources and an eight-column team matrix', async () => {
  let renderer
  await act(async () => { renderer = create(<OverviewPage {...analyticsProps} catalog={rootCatalog} />) })
  const text = renderText(renderer.toJSON())
  expect(renderer.root.findAllByProps({ className: 'executive-kpi-activity__title' }).map((node) => renderText(node.props.children))).toEqual([
    '设计活动', '开发活动', '设计活动', '开发活动',
  ])
  expect(text).toContain('当月 设计活动记录')
  expect(text).toContain('当月 开发活动记录')
  expect(text).toContain('设计活动 · AI需求渗透率')
  expect(text).toContain('开发活动 · AI研发提效')
  expect(renderer.root.findAll((node) => node.props?.['aria-label'] === '设计活动AI需求渗透率团队与全公司均值趋势图')).toHaveLength(1)
  expect(renderer.root.findAll((node) => node.props?.['aria-label'] === '开发活动AI研发提效团队与全公司均值趋势图')).toHaveLength(1)

  expect(text).toContain('需求角色聚合')
  expect(text).toContain('FactRecord')
  expect(text).not.toContain('临时 IR')
  expect(text).not.toContain('IR需求临时数据')
  expect(text).not.toContain('AI覆盖IR')

  const teamTable = renderer.root.findAllByType('table').find((table) => String(table.props['aria-label'] ?? '').includes('团队表现'))
  expect(teamTable).toBeDefined()
  const groupHeaders = teamTable.findAllByType('thead')[0].findAllByType('tr')[0].findAllByType('th')
  expect(groupHeaders.map((header) => renderText(header))).toEqual(['团队', '设计活动', '开发活动'])
  expect(groupHeaders[1].props.colSpan).toBe(8)
  expect(teamTable.findAllByType('thead')[0].findAllByType('tr')[1].findAllByType('th')).toHaveLength(8)
  renderer.unmount()
})

test('activity page keeps dual-activity summaries independent of the selected activity', async () => {
  let renderer
  await act(async () => { renderer = create(<ActivitiesPage {...analyticsProps} catalog={rootCatalog} />) })
  let text = renderText(renderer.toJSON())
  expect(text).toContain('设计活动AI覆盖数')
  expect(text).toContain('开发活动AI覆盖数')
  expect(text).toContain('测试用例生成数')
  expect(text).toContain('测试用例执行数')
  expect(text).not.toContain('AI覆盖IR需求数')
  expect(text).not.toContain('AI覆盖AR需求数')
  const rawTable = renderer.root.findAllByType('table').find((table) => String(table.props['aria-label'] ?? '').startsWith('原始指标月度摘要'))
  expect(rawTable.findAllByType('tbody')[0].findAllByType('tr')).toHaveLength(4)
  expect(text).toContain('设计活动与开发活动分别统计')
  expect(text).toContain('设计活动记录')
  expect(text).toContain('开发活动记录')

  await act(async () => { renderer.root.findByProps({ 'aria-label': '选择活动：SA设计' }).props.onClick() })
  await act(async () => { renderer.root.findByProps({ 'aria-label': '选择活动：测试用例生成' }).props.onClick() })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  text = renderText(renderer.toJSON())
  expect(text).toContain('按所选活动匹配的 FactRecord 原始量口径计算')
  expect(text).toContain('设计活动AI覆盖数')
  expect(text).toContain('开发活动AI覆盖数')
  renderer.unmount()
})

test('activity role activities show the role aggregate source while tests keep FactRecord', async () => {
  let renderer
  await act(async () => { renderer = create(<ActivitiesPage {...analyticsProps} catalog={rootCatalog} />) })
  await act(async () => { renderer.root.findByProps({ 'aria-label': '选择活动：SA设计' }).props.onClick() })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  let text = renderText(renderer.toJSON())
  expect(text).toContain('按需求角色聚合口径计算')
  expect(text).toContain('需求角色聚合趋势')
  expect(text).toContain('设计活动 · SA 角色聚合（完成/已关闭）')

  await act(async () => { renderer.root.findByProps({ 'aria-label': '选择活动：测试用例生成' }).props.onClick() })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  text = renderText(renderer.toJSON())
  expect(text).toContain('按所选活动匹配的 FactRecord 原始量口径计算')
  expect(text).toContain('来源：SR需求渗透率')
  renderer.unmount()
})

test('team drilldown shows two activity KPI groups, dual trends and four role lifecycle cards', async () => {
  const versions = [{ id: 2, name: '版本A', product_id: 10, team_id: 1, iterations: [] }]
  const team = { id: 1, name: '团队A' }
  let renderer
  await act(async () => {
    renderer = create(<MemoryRouter initialEntries={['/analytics/teams/1']}><TeamDrilldownPage
      team={team}
      teams={teams}
      catalog={rootCatalog}
      versions={versions}
      maturityState={{ month: '2026-03', category: 'key' }}
      filter={{ dimension: 'time', granularity: 'month', versionId: '2', periodId: '2026-03', metricId: 'all', cycle: '6m' }}
      onFilterChange={() => undefined}
      onMaturityChange={() => undefined}
      onNavigate={() => undefined}
      onSessionExpired={() => undefined}
    /></MemoryRouter>)
  })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  const text = renderText(renderer.toJSON())
  expect(text).toContain('设计活动')
  expect(text).toContain('开发活动')
  expect(renderer.root.findAllByProps({ className: 'drilldown-kpi-activity' })).toHaveLength(4)
  expect(renderer.root.findAllByProps({ className: 'drilldown-lifecycle-card' })).toHaveLength(6)
  expect(renderer.root.findAllByProps({ className: 'drilldown-lifecycle-card__source' })).toHaveLength(6)
  expect(text).toContain('需求角色聚合')
  expect(text).toContain('FactRecord')
  expect(text).toContain('团队A · 设计活动 · AI需求渗透率')
  expect(text).toContain('团队A · 开发活动 · AI研发提效')
  expect(text).not.toContain('临时 IR')
  renderer.unmount()
})

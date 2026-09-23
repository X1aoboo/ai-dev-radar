import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const { metricLoadError, maturityLoadError } = vi.hoisted(() => ({ metricLoadError: { current: null }, maturityLoadError: { current: null } }))

vi.mock('../components/EChart', () => ({
  default: ({ ariaLabel, onClick }) => <div role="img" aria-label={ariaLabel} onClick={onClick} />,
}))

vi.mock('antd', () => ({
  Button: ({ children, onClick, ...props }) => <button type="button" onClick={onClick} {...props}>{children}</button>,
  Drawer: ({ open, children, onClose }) => open ? <aside data-drawer><button type="button" data-close onClick={onClose}>关闭</button>{children}</aside> : null,
  Select: ({ value, onChange, options = [] }) => <select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>,
}))

const teams = [{ id: 1, name: '团队A' }, { id: 2, name: '团队B' }]
const catalog = [
  { id: 1, name: '编码开发', kind: 'key', metrics: [{ id: 11, name: 'AI 渗透率', type: 'penetration', numerator_semantic: 'AI数', denominator_semantic: '总数' }, { id: 12, name: '需求数量', type: 'count', numerator_semantic: '需求数' }] },
  { id: 2, name: '通用能力一', kind: 'general', metrics: [{ id: 21, name: '能力覆盖率', type: 'penetration', numerator_semantic: 'AI数', denominator_semantic: '总数' }] },
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
      assessed_team_count: index === 0 ? 1 : 0,
    })),
    teams: teams.map((team, teamIndex) => ({
      team_id: team.id,
      team_name: team.name,
      cells: activities.map((activity, index) => ({ activity_id: activity.id, score: teamIndex === 0 && index === 0 ? 2 : null })),
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
      values: periods.map((period) => ({ period_id: period.id, value: metric.type === 'boolean' ? null : index === 0 ? 0.4 : null, numerator: index === 0 ? 4 : 0, denominator: index === 0 ? 10 : 0 })),
    })),
    company_average: metric.type === 'boolean' ? [] : periods.map((period) => ({ period_id: period.id, value: 0.4 })),
    domain_summary: metric.type === 'boolean' ? [] : periods.map((period) => ({ period_id: period.id, value: 0.25, numerator: 4, denominator: 16, fact_count: 1, sample_count: 16 })),
  }
}

vi.mock('../overview/maturityData', () => ({
  useMaturityOverview: (month, kind) => maturityLoadError.current
    ? { loading: false, error: maturityLoadError.current, data: null, history: [] }
    : {
      loading: false,
      error: null,
      data: overviewData(kind, month),
      history: ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', month].map((item) => ({ month: item, data: overviewData(kind, item) })),
    },
}))

vi.mock('../overview/metricData', async () => ({
  hasNumericValues: (data) => Boolean(data?.series?.some((series) => series.values.some((point) => typeof point.value === 'number'))),
  useComputedMetrics: (activities, filter) => ({
    loading: false,
    errors: metricLoadError.current
      ? Object.fromEntries(activities.flatMap((activity) => activity.metrics.map((metric) => [metric.id, metricLoadError.current])))
      : {},
    data: Object.fromEntries(activities.flatMap((activity) => activity.metrics.map((metric) => [metric.id, metricData(metric, filter.granularity)]))),
  }),
}))

import OverviewPage from './OverviewPage.jsx'
import { ActivitiesPage, CapabilitiesPage } from '../analytics/AnalyticsPages.jsx'
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

beforeEach(() => {
  globalThis.window = { localStorage: { getItem: () => '{}', setItem: () => undefined } }
  metricLoadError.current = null
  maturityLoadError.current = null
})

afterEach(() => {
  delete globalThis.window
  metricLoadError.current = null
  maturityLoadError.current = null
})

test('root is an evidence-bounded management summary with no maturity maintenance action', async () => {
  let renderer
  await act(async () => { renderer = create(<OverviewPage {...analyticsProps} />) })
  const text = renderText(renderer.toJSON())
  expect(text).toContain('研发总览')
  expect(text).toContain('关键研发活动整体成熟度')
  expect(text).toContain('通用研发能力整体成熟度')
  expect(text).toContain('核心指标趋势')
  expect(text).toContain('研发生命周期')
  expect(text).toContain('需求')
  expect(text).toContain('交付')
  expect(text).not.toContain('跨两个领域的团队成熟度')
  expect(text).toContain('当前成熟度覆盖')
  expect(text).toContain('团队单指标排名')
  expect(text).toContain('研发生命周期')
  expect(text).toContain('核心指标趋势')
  expect(text).toContain('当前未配置业务 Target')
  expect(text).not.toContain('维护成熟度')
  renderer.unmount()
})

test('activity and capability pages render every metric as an independent chart', async () => {
  let renderer
  await act(async () => { renderer = create(<ActivitiesPage {...analyticsProps} />) })
  let text = renderText(renderer.toJSON())
  expect(text).toContain('研发活动')
  expect(text).toContain('AI 渗透率')
  expect(text).toContain('需求数量')
  expect(renderer.root.findAllByProps({ role: 'img' }).length).toBeGreaterThanOrEqual(3)
  renderer.unmount()

  await act(async () => { renderer = create(<CapabilitiesPage {...analyticsProps} />) })
  text = renderText(renderer.toJSON())
  expect(text).toContain('研发能力')
  expect(text).toContain('能力覆盖率')
  expect(renderer.root.findAllByProps({ 'aria-pressed': true }).some((node) => renderText(node.props.children) === '月')).toBe(true)
  const dayButton = renderer.root.findAllByType('button').find((node) => renderText(node.props.children) === '日')
  await act(async () => dayButton.props.onClick())
  expect(dayButton.props['aria-pressed']).toBe(true)
  renderer.unmount()
})

test('chart detail keeps company mean separate from merged raw-count results', async () => {
  let renderer
  await act(async () => { renderer = create(<ActivitiesPage {...analyticsProps} />) })
  const charts = renderer.root.findAllByProps({ role: 'img' })
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

test('activity workspace keeps URL-backed metric, dimension, and period filters', async () => {
  const onFilterChange = vi.fn()
  const props = {
    ...analyticsProps,
    onFilterChange,
    filter: { ...analyticsProps.filter, periodId: '2026-03' },
  }
  let renderer
  await act(async () => { renderer = create(<ActivitiesPage {...props} />) })

  const metricSelect = renderer.root.findByProps({ 'aria-label': '指标' })
  await act(async () => metricSelect.props.onChange({ target: { value: '11' } }))
  expect(onFilterChange).toHaveBeenLastCalledWith(expect.objectContaining({ metricId: '11', periodId: null }), { history: 'push' })

  onFilterChange.mockClear()
  const iterationButton = renderer.root.findAllByType('button').find((button) => renderText(button.props.children) === '按版本/迭代')
  await act(async () => iterationButton.props.onClick())
  expect(onFilterChange).toHaveBeenLastCalledWith(expect.objectContaining({ dimension: 'iteration', granularity: 'month' }), { history: 'push' })

  await act(async () => renderer.update(<ActivitiesPage {...props} filter={{ ...props.filter, metricId: '11' }} />))
  const metricHeadings = renderer.root.findAllByType('h3').map((node) => renderText(node.props.children))
  expect(metricHeadings).toContain('AI 渗透率')
  expect(metricHeadings).not.toContain('需求数量')
  expect(renderer.root.findByProps({ 'aria-label': '周期' }).props.value).toBe('2026-03')

  await act(async () => renderer.update(<ActivitiesPage {...props} filter={{ ...props.filter, metricId: '11', periodId: 'all' }} />))
  const allPeriodsText = renderText(renderer.toJSON())
  expect(allPeriodsText).toContain('显示全部周期趋势；选择单一周期可查看当期团队比较。')
  expect(allPeriodsText).not.toContain('最佳团队A · 40%')
  renderer.unmount()
})

test('metric detail labels the company_average result as the full-company mean', async () => {
  let renderer
  await act(async () => { renderer = create(<MetricDetailPage {...analyticsProps} activity={catalog[0]} metric={catalog[0].metrics[0]} />) })
  const text = renderText(renderer.toJSON())
  expect(text).toContain('全公司均值')
  expect(text).not.toContain('领域当前值')
  expect(text).toContain('团队系列与全公司均值仅在同一指标内比较')
  renderer.unmount()
})

test('activity workspace keeps metric and maturity failures visible with recovery copy', async () => {
  metricLoadError.current = new Error('原始指标接口暂不可用')
  let renderer
  await act(async () => { renderer = create(<ActivitiesPage {...analyticsProps} />) })
  expect(renderText(renderer.toJSON())).toContain('指标加载失败：原始指标接口暂不可用')
  renderer.unmount()

  metricLoadError.current = null
  maturityLoadError.current = new Error('成熟度接口暂不可用')
  await act(async () => { renderer = create(<ActivitiesPage {...analyticsProps} />) })
  expect(renderText(renderer.toJSON())).toContain('成熟度加载失败：成熟度接口暂不可用')
  renderer.unmount()
})

test('capability booleans render a team status list instead of a metric trend chart', async () => {
  const booleanCatalog = [...catalog, { id: 3, name: '自动化能力', kind: 'general', metrics: [{ id: 31, name: '能力是否具备', type: 'boolean' }] }]
  let renderer
  await act(async () => { renderer = create(<CapabilitiesPage {...analyticsProps} catalog={booleanCatalog} />) })
  const capabilityButton = renderer.root.findByProps({ 'aria-label': '查看能力：自动化能力' })
  await act(async () => capabilityButton.props.onClick())
  const text = renderText(renderer.toJSON())
  expect(text).toContain('逐团队展示最近有效状态')
  expect(text).toContain('团队A')
  expect(text).toContain('具备')
  expect(text).toContain('暂无数据')
  expect(renderer.root.findAll((node) => node.props?.['aria-label'] === '自动化能力 能力是否具备 趋势图')).toHaveLength(0)
  renderer.unmount()
})

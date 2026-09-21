import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

vi.mock('../components/EChart', () => ({
  default: ({ ariaLabel, onClick }) => <div role="img" aria-label={ariaLabel} onClick={onClick} />,
}))

vi.mock('antd', () => ({
  Button: ({ children, onClick, ...props }) => <button type="button" onClick={onClick} {...props}>{children}</button>,
  Drawer: ({ open, children, onClose }) => open ? <aside data-drawer><button type="button" data-close onClick={onClose}>关闭</button>{children}</aside> : null,
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
      values: periods.map((period) => ({ period_id: period.id, value: index === 0 ? 0.4 : null, numerator: index === 0 ? 4 : 0, denominator: index === 0 ? 10 : 0 })),
    })),
    company_average: periods.map((period) => ({ period_id: period.id, value: 0.4 })),
    domain_summary: periods.map((period) => ({ period_id: period.id, value: 0.4, numerator: 4, denominator: 10, fact_count: 1, sample_count: 10 })),
  }
}

vi.mock('../overview/maturityData', () => ({
  useMaturityOverview: (month, kind) => ({
    loading: false,
    error: null,
    data: overviewData(kind, month),
    history: ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', month].map((item) => ({ month: item, data: overviewData(kind, item) })),
  }),
}))

vi.mock('../overview/metricData', async () => ({
  hasNumericValues: (data) => Boolean(data?.series?.some((series) => series.values.some((point) => typeof point.value === 'number'))),
  useComputedMetrics: (activities, filter) => ({
    loading: false,
    errors: {},
    data: Object.fromEntries(activities.flatMap((activity) => activity.metrics.map((metric) => [metric.id, metricData(metric, filter.granularity)]))),
  }),
}))

import OverviewPage from './OverviewPage.jsx'
import { ActivitiesPage, CapabilitiesPage } from '../analytics/AnalyticsPages.jsx'

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
  filter: { dimension: 'time', granularity: 'month', versionId: 'all', periodId: null },
  onFilterChange: () => undefined,
  onMaturityChange: () => undefined,
  onNavigate: () => undefined,
  onSessionExpired: () => undefined,
}

beforeEach(() => {
  globalThis.window = { localStorage: { getItem: () => '{}', setItem: () => undefined } }
})

afterEach(() => {
  delete globalThis.window
})

test('root is a read-only summary with three large maturity charts and no maintenance action', async () => {
  let renderer
  await act(async () => { renderer = create(<OverviewPage {...analyticsProps} />) })
  const text = renderText(renderer.toJSON())
  expect(text).toContain('研发总览')
  expect(text).toContain('关键研发活动整体成熟度')
  expect(text).toContain('通用研发能力整体成熟度')
  expect(text).toContain('跨两个领域的团队成熟度')
  expect(text).toContain('当前成熟度覆盖')
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

test('chart click opens quantitative detail with raw numerator, denominator, sample and metric link', async () => {
  let renderer
  await act(async () => { renderer = create(<ActivitiesPage {...analyticsProps} />) })
  const charts = renderer.root.findAllByProps({ role: 'img' })
  await act(async () => charts.at(-1).props.onClick({}))
  const text = renderText(renderer.toJSON())
  expect(text).toContain('分子')
  expect(text).toContain('分母')
  expect(text).toContain('样本量')
  expect(text).toContain('打开现有指标详情')
  renderer.unmount()
})

import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

vi.mock('../components/EChart', () => ({
  default: ({ ariaLabel }) => <div role="img" aria-label={ariaLabel} />,
}))

vi.mock('antd', () => ({
  Drawer: ({ open, children }) => open ? <div>{children}</div> : null,
}))

vi.mock('./metricData', () => ({
  hasNumericValues: (data) => (data?.series ?? []).some((series) => (
    (series.values ?? []).some((point) => typeof point.value === 'number')
  )),
  useComputedMetrics: (catalog) => ({
    loading: false,
    errors: {},
    data: Object.fromEntries(catalog.flatMap((activity) => activity.metrics.map((metric) => [metric.id, {
       periods: [{ id: '2026-01', label: '2026-01' }],
       series: [
         { team_id: 1, team_name: '团队A', values: [{ period_id: '2026-01', value: metric.id === 'm1' ? 0 : 0.4, numerator: 0, denominator: 10 }] },
         { team_id: 2, team_name: '团队B', values: [] },
       ],
       company_average: [{ period_id: '2026-01', value: 0 }],
    }]))),
  }),
}))

vi.mock('./maturityData', () => ({
  maturitySavePayload: (entries) => ({ entries }),
  useMaturityOverview: (month, category) => ({
    loading: false,
    error: null,
    data: {
      month,
      kind: category,
      team_count: 2,
      assessed_cell_count: 1,
      total_cell_count: 16,
      coverage_rate: 1 / 16,
      strength_activity_ids: ['key-1'],
      weakness_activity_ids: ['key-1'],
      level_labels: ['L0 未建设', 'L1 建设中', 'L2 试点中', 'L3 推广中', 'L4 规模使用', 'L5 成熟运营'],
      activities: Array.from({ length: 8 }, (_, index) => ({
        activity_id: `key-${index + 1}`,
        activity_code: `key-${index + 1}`,
        activity_name: `关键活动${index + 1}`,
        kind: 'key',
        score: index === 0 ? 0 : null,
        score_raw: index === 0 ? '0.00' : null,
        score_display: index === 0 ? '0.00' : null,
        average_raw: index === 0 ? '0' : null,
        grade: index === 0 ? 0 : null,
        level: index === 0 ? 'L0 未建设' : null,
        assessed_team_count: index === 0 ? 1 : 0,
        grade_distribution: { L0: index === 0 ? 1 : 0, L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 },
        order: index,
      })),
      teams: [1, 2].map((id, index) => ({
        team_id: id,
        team_name: `团队${id === 1 ? 'A' : 'B'}`,
        cells: Array.from({ length: 8 }, (_, activityIndex) => ({
          activity_id: `key-${activityIndex + 1}`,
          activity_code: `key-${activityIndex + 1}`,
          activity_name: `关键活动${activityIndex + 1}`,
          kind: 'key',
          record_id: index === 0 && activityIndex === 0 ? 1 : null,
          score: index === 0 && activityIndex === 0 ? 0 : null,
          score_raw: index === 0 && activityIndex === 0 ? '0.00' : null,
          score_display: index === 0 && activityIndex === 0 ? '0.00' : null,
          grade: index === 0 && activityIndex === 0 ? 0 : null,
          level: index === 0 && activityIndex === 0 ? 'L0 未建设' : null,
          note: null,
          maintained_by: null,
          updated_at: null,
        })),
      })),
    },
  }),
  useMaturityRecords: () => ({ loading: false, records: [], previousRecords: [], error: null }),
}))

import OverviewPage from './OverviewPage.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function renderText(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(renderText).join('')
  return renderText(node.children)
}

const keyActivities = Array.from({ length: 8 }, (_, index) => ({
  id: `key-${index + 1}`,
  name: `关键活动${index + 1}`,
  kind: 'key',
  metrics: [{
    id: `m${index + 1}`,
    name: `主指标${index + 1}`,
    type: 'penetration',
    numerator_semantic: 'AI数',
    denominator_semantic: '总数',
  }],
}))

const catalog = [
  ...keyActivities,
  {
    id: 'general-1',
    name: '通用能力一',
    kind: 'general',
    metrics: [{ id: 'g1', name: '通用指标', type: 'penetration', numerator_semantic: 'AI数', denominator_semantic: '总数' }],
  },
]

const teams = [{ id: 1, name: '团队A' }, { id: 2, name: '团队B' }]
const versions = []
const filter = { dimension: 'time', granularity: 'month', versionId: 'all', periodId: 'p1' }

beforeEach(() => {
  globalThis.window = {
    localStorage: {
      getItem: () => '{}',
      setItem: () => undefined,
    },
  }
})

afterEach(() => {
  delete globalThis.window
})

test('renders the domain comparison first and keeps metric comparison collapsed', async () => {
  let renderer
  await act(async () => {
    renderer = create(
      <OverviewPage
        catalog={catalog}
        teams={teams}
        versions={versions}
        filter={filter}
        onFilterChange={() => undefined}
        onNavigate={() => undefined}
        onSessionExpired={() => undefined}
      />,
    )
  })

  expect(renderText(renderer.toJSON())).toContain('本月决策摘要')
  expect(renderText(renderer.toJSON())).toContain('成熟度均值')
  expect(renderText(renderer.toJSON())).toContain('覆盖团队')
  expect(renderText(renderer.toJSON())).toContain('尚未配置目标或外部行业基准')
  expect(renderText(renderer.toJSON())).toContain('关键活动8')
  expect(renderText(renderer.toJSON())).toContain('能力点明细')
  expect(renderText(renderer.toJSON()).includes('第一指标')).toBe(false)
  expect(renderText(renderer.toJSON()).includes('第二指标')).toBe(false)
  expect(renderText(renderer.toJSON()).includes('指标集中比较')).toBe(true)
  renderer.unmount()
})

test('renders a real zero and an unassessed cell differently in the matrix', async () => {
  let renderer
  await act(async () => {
    renderer = create(
      <OverviewPage
        catalog={catalog.slice(0, 1)}
        teams={teams}
        versions={versions}
        filter={filter}
        onFilterChange={() => undefined}
        onNavigate={() => undefined}
        onSessionExpired={() => undefined}
      />,
    )
  })

  expect(renderText(renderer.toJSON())).toContain('0.00')
  expect(renderText(renderer.toJSON())).toContain('—')
  renderer.unmount()
})

test('keeps the maturity maintenance action out of a viewer overview', async () => {
  let renderer
  await act(async () => {
    renderer = create(
      <OverviewPage
        catalog={catalog.slice(0, 1)}
        teams={teams}
        versions={versions}
        user={{ role: 'viewer' }}
        filter={filter}
        onFilterChange={() => undefined}
        onNavigate={() => undefined}
        onSessionExpired={() => undefined}
      />,
    )
  })

  expect(renderer.root.findAllByProps({ children: '维护成熟度' })).toHaveLength(0)
  renderer.unmount()
})

test('keeps the decision path and matrix collapsed by default', async () => {
  let renderer
  await act(async () => {
    renderer = create(
      <OverviewPage
        catalog={catalog}
        teams={teams}
        versions={versions}
        user={{ role: 'admin' }}
        maturityState={{ month: '2026-01', category: 'key', view: 'domain', compareTeamIds: [], showBaseline: true, sort: 'order' }}
        filter={filter}
        onFilterChange={() => undefined}
        onNavigate={() => undefined}
        onSessionExpired={() => undefined}
      />,
    )
  })

  const text = renderText(renderer.toJSON())
  expect(text.indexOf('本月决策摘要')).toBeGreaterThanOrEqual(0)
  expect(text.indexOf('优先信号')).toBeGreaterThan(text.indexOf('本月决策摘要'))
  expect(text.indexOf('效率表现')).toBeGreaterThan(text.indexOf('优先信号'))
  expect(text.indexOf('成熟度与能力点')).toBeGreaterThan(text.indexOf('效率表现'))
  expect(text.indexOf('指标集中比较')).toBeGreaterThan(text.indexOf('成熟度与能力点'))
  const disclosure = renderer.root.findByProps({ className: 'maturity-matrix-disclosure' })
  expect(disclosure.props.open).toBe(false)
  renderer.unmount()
})

test('switches the current category and keeps month controls keyboard-semantic', async () => {
  let renderer
  await act(async () => {
    renderer = create(
      <OverviewPage
        catalog={catalog}
        teams={teams}
        versions={versions}
        user={{ role: 'maintainer', maintainer_team_id: 1 }}
        filter={filter}
        onFilterChange={() => undefined}
        onNavigate={() => undefined}
        onSessionExpired={() => undefined}
      />,
    )
  })

  const categoryButton = renderer.root.findAllByType('button').find((node) => renderText(node.props.children) === '通用研发能力')
  expect(categoryButton.props['aria-pressed']).toBe(false)
  expect(renderer.root.findAllByProps({ children: '维护成熟度' })).toHaveLength(1)
  expect(renderer.root.findAllByType('input').some((node) => node.props.type === 'month')).toBe(true)
  await act(async () => categoryButton.props.onClick())
  expect(renderer.root.findAllByType('button').find((node) => renderText(node.props.children) === '通用研发能力').props['aria-pressed']).toBe(true)
  expect(renderer.root.findAllByProps({ role: 'img' }).some((node) => node.props['aria-label'] === '领域平均成熟度雷达图')).toBe(true)
  renderer.unmount()
})

test('shows selected-month fact absence without falling back to another month', async () => {
  let renderer
  await act(async () => {
    renderer = create(
      <OverviewPage
        catalog={catalog}
        teams={teams}
        versions={versions}
        maturityState={{ month: '2026-02', category: 'key', view: 'domain', compareTeamIds: [], showBaseline: true, sort: 'order' }}
        filter={filter}
        onFilterChange={() => undefined}
        onNavigate={() => undefined}
        onSessionExpired={() => undefined}
      />,
    )
  })

  expect(renderText(renderer.toJSON())).toContain('分析月份暂无AI 渗透率事实，不回退到其他月份。')
  renderer.unmount()
})

test('opens the matrix with a domain-average row and keeps its disclosure operable', async () => {
  let renderer
  await act(async () => {
    renderer = create(
      <OverviewPage
        catalog={catalog}
        teams={teams}
        versions={versions}
        maturityState={{ month: '2026-01', category: 'key', view: 'domain', compareTeamIds: [], showBaseline: true, sort: 'order' }}
        filter={filter}
        onFilterChange={() => undefined}
        onNavigate={() => undefined}
        onSessionExpired={() => undefined}
      />,
    )
  })

  const disclosure = renderer.root.findByProps({ className: 'maturity-matrix-disclosure' })
  await act(async () => disclosure.props.onToggle({ currentTarget: { open: true } }))
  expect(renderer.root.findByProps({ className: 'maturity-average-row' })).toBeTruthy()
  expect(renderer.root.findAllByType('summary').length).toBeGreaterThan(0)
  renderer.unmount()
})

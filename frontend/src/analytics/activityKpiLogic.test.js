import assert from 'node:assert/strict'
import { test } from 'node:test'

import { activityCoverageBreakdown, buildActivityKpiModel } from './activityKpiLogic.js'

const definitions = [
  { code: 'ai-demand-penetration', name: 'AI需求渗透率', type: 'penetration' },
  { code: 'ai-rd-efficiency', name: 'AI研发提效', type: 'efficiency' },
  { code: 'ai-covered-ir-count', name: 'AI覆盖需求数', type: 'count' },
  { code: 'ai-efficiency-workload', name: 'AI提效工作量', type: 'count', unit: '人天' },
]
const periods = ['2026-01', '2026-02', '2026-03']
const point = (period_id, value, numerator, denominator, fact_count = 1) => ({ period_id, value, numerator, denominator, fact_count })
const dataByMetric = {
  1: {
    periods: periods.map((id) => ({ id })),
    series: [
      { team_id: 1, values: [point('2026-01', 0.2, 2, 10), point('2026-02', 0.4, 4, 10), point('2026-03', 0.5, 5, 10)] },
      { team_id: 2, values: [point('2026-01', 0.3, 3, 10), point('2026-02', 0.4, 4, 10), point('2026-03', 0.3, 3, 10)] },
    ],
    company_average: [point('2026-01', 0.25), point('2026-02', 0.4), point('2026-03', 0.4)],
    domain_summary: [point('2026-01', 0.25, 5, 20), point('2026-02', 0.4, 8, 20), point('2026-03', 0.4, 8, 20)],
  },
  2: {
    periods: periods.map((id) => ({ id })),
    series: [
      { team_id: 1, values: [point('2026-01', 1, 10, 5), point('2026-02', 0.5, 12, 8), point('2026-03', 2 / 3, 10, 6)] },
      { team_id: 2, values: [point('2026-01', 1, 8, 4), point('2026-02', 1, 10, 5), point('2026-03', 1, 14, 7)] },
    ],
    company_average: [point('2026-01', 1), point('2026-02', 0.75), point('2026-03', 5 / 6)],
    domain_summary: [point('2026-01', 1, 18, 9), point('2026-02', 9 / 13, 22, 13), point('2026-03', 11 / 13, 24, 13)],
  },
}

const activity = {
  name: '开发设计',
  metrics: [
    { id: 1, name: 'AR需求渗透率', type: 'penetration' },
    { id: 2, name: '开发设计效率', type: 'efficiency' },
  ],
}

test('activity coverage split uses only valid matching raw penetration totals', () => {
  assert.deepEqual(activityCoverageBreakdown(dataByMetric[1], periods), {
    status: 'ready', covered: 21, uncovered: 39, total: 60,
  })
  assert.deepEqual(activityCoverageBreakdown({ domain_summary: [] }, periods), { status: 'missing' })
  assert.deepEqual(activityCoverageBreakdown({ domain_summary: [point('2026-03', 0, 0, 0)] }, ['2026-03']), {
    status: 'zero', covered: 0, uncovered: 0, total: 0,
  })
  assert.deepEqual(activityCoverageBreakdown({ domain_summary: [point('2026-03', 1.1, 11, 10)] }, ['2026-03']), { status: 'invalid' })
})

test('activity KPI slots derive from matching FactRecord types and preserve period semantics', () => {
  const model = buildActivityKpiModel({
    activity,
    dataByMetric,
    kpiDefinitions: definitions,
    month: '2026-03',
    previousMonth: '2026-02',
    monthTrendIds: periods,
    cyclePeriodIds: periods,
    teams: [{ id: 1, name: '团队A' }, { id: 2, name: '团队B' }],
  })

  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should be close to ${expected}`)
  close(model.kpis[0].monthValue, 0.4)
  close(model.kpis[0].cycleValue, 0.35)
  close(model.kpis[0].cycleDelta, 0.025)
  close(model.kpis[1].monthValue, 11 / 13)
  close(model.kpis[1].cycleValue, 29 / 35)
  close(model.kpis[1].cycleDelta, 29 / 35 - 9 / 11)
  assert.deepEqual([model.kpis[2].monthValue, model.kpis[2].cycleValue, model.kpis[2].cycleDelta], [8, 21, 8])
  assert.deepEqual([model.kpis[3].monthValue, model.kpis[3].cycleValue, model.kpis[3].cycleDelta], [11, 29, 11])
  close(model.teamRows[0].values[0].textValue, 0.35)
  close(model.teamRows[0].values[1].textValue, (13 / 19 + 1) / 2)
  assert.deepEqual(model.teamRows[0].values.slice(2).map((item) => item.textValue), [10.5, 14.5])
  close(model.teamRows[0].values[0].changeValue, 0.025)
  close(model.teamRows[0].values[1].changeValue, (13 / 19 + 1) / 2 - (9 / 13 + 1) / 2)
  assert.deepEqual(model.teamRows[0].values.slice(2).map((item) => item.changeValue), [4, 5.5])
})

test('missing activity types stay missing while recorded zeros stay zero', () => {
  const missing = buildActivityKpiModel({ activity: { name: '测试用例执行', metrics: [] }, kpiDefinitions: definitions, month: '2026-03', cyclePeriodIds: ['2026-03'], teams: [{ id: 1, name: '团队A' }] })
  assert.ok(missing.kpis.every((kpi) => kpi.monthValue === null && kpi.cycleValue === null))
  assert.ok(missing.teamRows[1].values.every((value) => value.textValue === null && value.changeValue === null))

  const zeroData = {
    3: { periods: [{ id: '2026-03' }], series: [{ team_id: 1, values: [point('2026-03', 0, 0, 10)] }], company_average: [point('2026-03', 0)], domain_summary: [point('2026-03', 0, 0, 10)] },
    4: { periods: [{ id: '2026-03' }], series: [{ team_id: 1, values: [point('2026-03', 0, 5, 5)] }], company_average: [point('2026-03', 0)], domain_summary: [point('2026-03', 0, 5, 5)] },
  }
  const zero = buildActivityKpiModel({
    activity: { metrics: [{ id: 3, type: 'penetration' }, { id: 4, type: 'efficiency' }] },
    dataByMetric: zeroData,
    kpiDefinitions: definitions,
    month: '2026-03',
    cyclePeriodIds: ['2026-03'],
    teams: [{ id: 1, name: '团队A' }],
  })
  assert.deepEqual(zero.kpis.map((kpi) => [kpi.monthValue, kpi.cycleValue]), [[0, 0], [0, 0], [0, 0], [0, 0]])
})

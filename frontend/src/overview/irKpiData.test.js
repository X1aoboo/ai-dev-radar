import assert from 'node:assert/strict'
import test from 'node:test'

import { IR_OVERVIEW_KPIS, buildIROverviewMetricData, irCoverageBreakdown, irOverviewMetricSummary } from './irKpiData.js'

const stats = (period_id, overrides = {}) => ({
  period_id,
  fact_count: 2,
  known_ai_count: 2,
  ai_assisted_count: 1,
  ai_workload_count: 1,
  ai_estimated_workload: 10,
  ai_actual_workload: 5,
  ...overrides,
})

test('IR KPI values use requirement AI status and overall workload fields', () => {
  const data = buildIROverviewMetricData({
    period_ids: ['2026-08'],
    series: [
      { team_id: 1, team_name: '团队A', values: [stats('2026-08')] },
      { team_id: 2, team_name: '团队B', values: [stats('2026-08', { ai_assisted_count: 0, ai_estimated_workload: null, ai_actual_workload: null, ai_workload_count: 0 })] },
    ],
    domain_summary: [stats('2026-08', { fact_count: 4, known_ai_count: 4, ai_assisted_count: 1 })],
  })

  assert.deepEqual(IR_OVERVIEW_KPIS.map(({ name }) => name), ['AI需求渗透率', 'AI研发提效', 'AI覆盖需求数', 'AI提效工作量'])
  assert.equal(data['ai-demand-penetration'].domain_summary[0].value, 0.25)
  assert.equal(data['ai-rd-efficiency'].domain_summary[0].value, 1)
  assert.equal(data['ai-covered-ir-count'].domain_summary[0].value, 1)
  assert.equal(data['ai-efficiency-workload'].domain_summary[0].value, 5)
  assert.equal(data['ai-efficiency-workload'].company_average[0].value, 2.5)
  assert.equal(data['ai-efficiency-workload'].series[1].values[0].value, 0)
})

test('IR coverage breakdown keeps unknown AI attributes separate from known uncovered requirements', () => {
  const payload = buildIROverviewMetricData({
    period_ids: ['2026-08', '2026-09'],
    series: [],
    domain_summary: [
      stats('2026-08', { fact_count: 10, known_ai_count: 8, ai_assisted_count: 3 }),
      stats('2026-09', { fact_count: 12, known_ai_count: 10, ai_assisted_count: 0 }),
    ],
  })

  assert.deepEqual(irCoverageBreakdown(payload['ai-demand-penetration'], ['2026-08', '2026-09']), {
    status: 'ready', total: 22, known: 18, unknown: 4, covered: 3, uncovered: 15,
  })
  assert.deepEqual(irCoverageBreakdown({ domain_summary: [stats('2026-08', { fact_count: 5, known_ai_count: 0, ai_assisted_count: null })] }, ['2026-08']), {
    status: 'unknown-only', total: 5, known: 0, unknown: 5, covered: null, uncovered: null,
  })
  assert.deepEqual(irCoverageBreakdown({ domain_summary: [] }, ['2026-08']), { status: 'missing' })
})

test('IR KPI month and cycle values recompute rates from raw totals', () => {
  const payload = buildIROverviewMetricData({
    period_ids: ['2026-08', '2026-09'],
    series: [
      { team_id: 1, team_name: '团队A', values: [stats('2026-08'), stats('2026-09', { ai_assisted_count: 2, ai_estimated_workload: 20, ai_actual_workload: 10, ai_workload_count: 2 })] },
      { team_id: 2, team_name: '团队B', values: [stats('2026-08', { ai_assisted_count: 0, ai_estimated_workload: null, ai_actual_workload: null, ai_workload_count: 0 }), stats('2026-09')] },
    ],
    domain_summary: [
      stats('2026-08', { fact_count: 2, ai_assisted_count: 1 }),
      stats('2026-09', { fact_count: 4, known_ai_count: 4, ai_assisted_count: 2, ai_workload_count: 2, ai_estimated_workload: 20, ai_actual_workload: 10 }),
    ],
  })

  const rate = irOverviewMetricSummary({ data: payload['ai-demand-penetration'], metric: IR_OVERVIEW_KPIS[0], month: '2026-09', monthTrendIds: ['2026-08', '2026-09'], periodIds: ['2026-08', '2026-09'] })
  assert.equal(rate.monthValue, 0.5)
  assert.equal(rate.previousMonthValue, 0.5)
  assert.equal(rate.periodValue, 0.5)
  assert.equal(rate.previousPeriodValue, 0.5)
  assert.equal(rate.periodDelta, 0)
  assert.deepEqual(rate.monthTrend, [0.5, 0.5])
  assert.deepEqual(rate.monthTeams.map(({ delta }) => delta), [0.5, 0.5])
  assert.deepEqual(rate.monthTeams.map(({ trend }) => trend), [[0.5, 1], [0, 0.5]])
  assert.equal(rate.monthCompanyAverageDelta, 0.5)
  assert.deepEqual(rate.periodTeams.map(({ delta }) => delta), [0.25, 0.25])
  assert.deepEqual(rate.periodTeams.map(({ trend }) => trend), [[0.5, 0.75], [0, 0.25]])
  assert.equal(rate.periodCompanyAverageDelta, 0.25)

  const count = irOverviewMetricSummary({ data: payload['ai-covered-ir-count'], metric: IR_OVERVIEW_KPIS[2], month: '2026-09', periodIds: ['2026-08', '2026-09'] })
  assert.equal(count.periodValue, 3)
  assert.equal(count.previousPeriodValue, 1)
  assert.equal(count.periodDelta, 2)
  assert.deepEqual(count.periodTeams.map(({ value }) => value), [3, 1])
  assert.deepEqual(count.monthTeams.map(({ delta }) => delta), [1, 1])
  assert.deepEqual(count.periodTeams.map(({ delta }) => delta), [2, 1])
  assert.equal(count.periodCompanyAverageDelta, 1.5)

  const workload = irOverviewMetricSummary({ data: payload['ai-efficiency-workload'], metric: IR_OVERVIEW_KPIS[3], month: '2026-09', periodIds: ['2026-08', '2026-09'] })
  assert.equal(workload.periodValue, 15)
  assert.equal(workload.previousPeriodValue, 5)
  assert.equal(workload.periodDelta, 10)
  assert.equal(workload.periodCoverage.factCount, 6)
  assert.deepEqual(workload.monthTeams.map(({ delta }) => delta), [5, 5])
  assert.deepEqual(workload.periodTeams.map(({ delta }) => delta), [10, 5])
})

test('version-scoped Team values use the separate unversioned all-team benchmark', () => {
  const scoped = buildIROverviewMetricData({
    period_ids: ['2026-08', '2026-09'],
    series: [{
      team_id: 1,
      team_name: '团队A',
      values: [stats('2026-08'), stats('2026-09', { ai_assisted_count: 2, ai_estimated_workload: 20, ai_actual_workload: 10, ai_workload_count: 2 })],
    }],
    domain_summary: [stats('2026-08'), stats('2026-09', { ai_assisted_count: 2, ai_estimated_workload: 20, ai_actual_workload: 10, ai_workload_count: 2 })],
  })
  const allTeams = buildIROverviewMetricData({
    period_ids: ['2026-08', '2026-09'],
    series: [
      { team_id: 1, team_name: '团队A', values: [stats('2026-08'), stats('2026-09', { ai_assisted_count: 2, ai_estimated_workload: 20, ai_actual_workload: 10, ai_workload_count: 2 })] },
      { team_id: 2, team_name: '团队B', values: [stats('2026-08', { ai_assisted_count: 0, ai_estimated_workload: null, ai_actual_workload: null, ai_workload_count: 0 }), stats('2026-09')] },
    ],
    domain_summary: [stats('2026-08', { fact_count: 4 }), stats('2026-09', { fact_count: 4, ai_assisted_count: 3, ai_estimated_workload: 30, ai_actual_workload: 15, ai_workload_count: 3 })],
  })

  const summary = irOverviewMetricSummary({
    data: scoped['ai-demand-penetration'],
    benchmarkData: allTeams['ai-demand-penetration'],
    metric: IR_OVERVIEW_KPIS[0],
    month: '2026-09',
    periodIds: ['2026-08', '2026-09'],
  })

  assert.equal(summary.monthTeams.length, 1)
  assert.equal(summary.monthTeams[0].value, 1)
  assert.equal(summary.monthCompanyAverage, 0.75)
  assert.equal(summary.periodTeams[0].value, 0.75)
  assert.equal(summary.periodCompanyAverage, 0.5)
  assert.equal(summary.benchmarkMonthTeams.length, 2)
})

test('IR KPI unknown AI status and missing workload stay missing', () => {
  const data = buildIROverviewMetricData({
    period_ids: ['2026-08'],
    series: [{ team_id: 1, team_name: '团队A', values: [stats('2026-08', { known_ai_count: 0, ai_assisted_count: null, ai_workload_count: 0, ai_estimated_workload: null, ai_actual_workload: null })] }],
    domain_summary: [stats('2026-08', { fact_count: 1, known_ai_count: 0, ai_assisted_count: null, ai_workload_count: 0, ai_estimated_workload: null, ai_actual_workload: null })],
  })

  assert.equal(data['ai-demand-penetration'].domain_summary[0].value, null)
  assert.equal(data['ai-covered-ir-count'].domain_summary[0].value, null)
  assert.equal(data['ai-rd-efficiency'].domain_summary[0].value, null)
  assert.equal(data['ai-efficiency-workload'].domain_summary[0].value, null)
})

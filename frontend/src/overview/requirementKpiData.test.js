import assert from 'node:assert/strict'
import test from 'node:test'

import {
  REQUIREMENT_ACTIVITIES,
  REQUIREMENT_KPIS,
  REQUIREMENT_ROLE_ACTIVITIES,
  buildRequirementKpiData,
  buildRequirementKpiModel,
  buildRequirementTeamMatrixModel,
  requirementCoverageBreakdown,
  requirementKpiSummary,
  requirementOverviewQuery,
  requirementRoleActivity,
} from './requirementKpiData.js'

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

test('KPI definitions are activity-neutral and cover design and development', () => {
  assert.deepEqual(REQUIREMENT_KPIS.map(({ name }) => name), ['AI需求渗透率', 'AI研发提效', 'AI覆盖需求数', 'AI提效工作量'])
  assert.deepEqual(REQUIREMENT_ACTIVITIES.map(({ key, label }) => [key, label]), [['design', '设计活动'], ['development', '开发活动']])
  assert.ok(REQUIREMENT_KPIS.every((metric) => !/IR|AR|SR/.test(`${metric.name}${metric.numerator_semantic}${metric.denominator_semantic ?? ''}`)))
  assert.deepEqual(REQUIREMENT_ACTIVITIES.find(({ key }) => key === 'design').roles, ['all', 'sa', 'se'])
  assert.deepEqual(REQUIREMENT_ACTIVITIES.find(({ key }) => key === 'development').roles, ['all', 'implementation', 'development'])
})

test('overview query carries activity and role without changing response shape', () => {
  assert.equal(
    requirementOverviewQuery({ fromMonth: '2026-02', toMonth: '2026-07', versionId: 'all', activity: 'development', role: 'implementation' }),
    'from_month=2026-02&to_month=2026-07&version_id=all&activity=development&role=implementation',
  )
  assert.equal(
    requirementOverviewQuery({ fromMonth: '2026-02', toMonth: '2026-07', versionId: 12 }),
    'from_month=2026-02&to_month=2026-07&version_id=12&activity=design&role=all',
  )
})

test('activity KPI values use requirement AI status and workload fields', () => {
  const data = buildRequirementKpiData({
    period_ids: ['2026-08'],
    series: [
      { team_id: 1, team_name: '团队A', values: [stats('2026-08')] },
      { team_id: 2, team_name: '团队B', values: [stats('2026-08', { ai_assisted_count: 0, ai_estimated_workload: null, ai_actual_workload: null, ai_workload_count: 0 })] },
    ],
    domain_summary: [stats('2026-08', { fact_count: 4, known_ai_count: 4, ai_assisted_count: 1 })],
  })

  assert.equal(data['ai-demand-penetration'].domain_summary[0].value, 0.25)
  assert.equal(data['ai-rd-efficiency'].domain_summary[0].value, 1)
  assert.equal(data['ai-covered-requirement-count'].domain_summary[0].value, 1)
  assert.equal(data['ai-efficiency-workload'].domain_summary[0].value, 5)
  assert.equal(data['ai-efficiency-workload'].company_average[0].value, 2.5)
  assert.equal(data['ai-efficiency-workload'].series[1].values[0].value, 0)
  assert.equal(data['ai-demand-penetration'].domain_summary[0].fact_count, 4)
})

test('coverage breakdown keeps unknown AI attributes separate from known uncovered records', () => {
  const payload = buildRequirementKpiData({
    period_ids: ['2026-08', '2026-09'],
    series: [],
    domain_summary: [
      stats('2026-08', { fact_count: 10, known_ai_count: 8, ai_assisted_count: 3 }),
      stats('2026-09', { fact_count: 12, known_ai_count: 10, ai_assisted_count: 0 }),
    ],
  })

  assert.deepEqual(requirementCoverageBreakdown(payload['ai-demand-penetration'], ['2026-08', '2026-09']), {
    status: 'ready', total: 22, known: 18, unknown: 4, covered: 3, uncovered: 15,
  })
  assert.deepEqual(requirementCoverageBreakdown({ domain_summary: [stats('2026-08', { fact_count: 5, known_ai_count: 0, ai_assisted_count: null })] }, ['2026-08']), {
    status: 'unknown-only', total: 5, known: 0, unknown: 5, covered: null, uncovered: null,
  })
  assert.deepEqual(requirementCoverageBreakdown({ domain_summary: [] }, ['2026-08']), { status: 'missing' })
})

test('month and cycle values recompute rates from raw totals', () => {
  const payload = buildRequirementKpiData({
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

  const rate = requirementKpiSummary({ data: payload['ai-demand-penetration'], metric: REQUIREMENT_KPIS[0], month: '2026-09', monthTrendIds: ['2026-08', '2026-09'], periodIds: ['2026-08', '2026-09'] })
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

  const count = requirementKpiSummary({ data: payload['ai-covered-requirement-count'], metric: REQUIREMENT_KPIS[2], month: '2026-09', periodIds: ['2026-08', '2026-09'] })
  assert.equal(count.periodValue, 3)
  assert.equal(count.previousPeriodValue, 1)
  assert.equal(count.periodDelta, 2)
  assert.deepEqual(count.periodTeams.map(({ value }) => value), [3, 1])
  assert.deepEqual(count.monthTeams.map(({ delta }) => delta), [1, 1])
  assert.equal(count.periodCompanyAverageDelta, 1.5)

  const workload = requirementKpiSummary({ data: payload['ai-efficiency-workload'], metric: REQUIREMENT_KPIS[3], month: '2026-09', periodIds: ['2026-08', '2026-09'] })
  assert.equal(workload.periodValue, 15)
  assert.equal(workload.previousPeriodValue, 5)
  assert.equal(workload.periodDelta, 10)
  assert.equal(workload.periodCoverage.factCount, 6)
  assert.deepEqual(workload.monthTeams.map(({ delta }) => delta), [5, 5])
  assert.deepEqual(workload.periodTeams.map(({ delta }) => delta), [10, 5])
})

test('version-scoped team values use the separate unversioned all-team benchmark', () => {
  const scoped = buildRequirementKpiData({
    period_ids: ['2026-08', '2026-09'],
    series: [{
      team_id: 1,
      team_name: '团队A',
      values: [stats('2026-08'), stats('2026-09', { ai_assisted_count: 2, ai_estimated_workload: 20, ai_actual_workload: 10, ai_workload_count: 2 })],
    }],
    domain_summary: [stats('2026-08'), stats('2026-09', { ai_assisted_count: 2, ai_estimated_workload: 20, ai_actual_workload: 10, ai_workload_count: 2 })],
  })
  const allTeams = buildRequirementKpiData({
    period_ids: ['2026-08', '2026-09'],
    series: [
      { team_id: 1, team_name: '团队A', values: [stats('2026-08'), stats('2026-09', { ai_assisted_count: 2, ai_estimated_workload: 20, ai_actual_workload: 10, ai_workload_count: 2 })] },
      { team_id: 2, team_name: '团队B', values: [stats('2026-08', { ai_assisted_count: 0, ai_estimated_workload: null, ai_actual_workload: null, ai_workload_count: 0 }), stats('2026-09')] },
    ],
    domain_summary: [stats('2026-08', { fact_count: 4 }), stats('2026-09', { fact_count: 4, ai_assisted_count: 3, ai_estimated_workload: 30, ai_actual_workload: 15, ai_workload_count: 3 })],
  })

  const summary = requirementKpiSummary({
    data: scoped['ai-demand-penetration'],
    benchmarkData: allTeams['ai-demand-penetration'],
    metric: REQUIREMENT_KPIS[0],
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

test('missing AI status and missing workload stay missing', () => {
  const data = buildRequirementKpiData({
    period_ids: ['2026-08'],
    series: [{ team_id: 1, team_name: '团队A', values: [stats('2026-08', { known_ai_count: 0, ai_assisted_count: null, ai_workload_count: 0, ai_estimated_workload: null, ai_actual_workload: null })] }],
    domain_summary: [stats('2026-08', { fact_count: 1, known_ai_count: 0, ai_assisted_count: null, ai_workload_count: 0, ai_estimated_workload: null, ai_actual_workload: null })],
  })

  assert.equal(data['ai-demand-penetration'].domain_summary[0].value, null)
  assert.equal(data['ai-covered-requirement-count'].domain_summary[0].value, null)
  assert.equal(data['ai-rd-efficiency'].domain_summary[0].value, null)
  assert.equal(data['ai-efficiency-workload'].domain_summary[0].value, null)
})

test('requirement role activities map design roles to design and development roles to development', () => {
  assert.equal(requirementRoleActivity({ code: 'sa' }).role, 'sa')
  assert.equal(requirementRoleActivity({ code: 'se' }).activity, 'design')
  assert.deepEqual([requirementRoleActivity({ code: 'dd' }).activity, requirementRoleActivity({ code: 'dd' }).role], ['development', 'implementation'])
  assert.deepEqual([requirementRoleActivity({ code: 'cd' }).activity, requirementRoleActivity({ code: 'cd' }).role], ['development', 'development'])
  assert.equal(requirementRoleActivity({ code: 'tcg' }), null)
  assert.equal(REQUIREMENT_ROLE_ACTIVITIES.sa.label, 'SA设计')
})

test('KPI model derives month, cycle, trends and team rows for one activity', () => {
  const data = buildRequirementKpiData({
    period_ids: ['2026-08', '2026-09'],
    series: [
      { team_id: 1, team_name: '团队A', values: [stats('2026-08'), stats('2026-09', { ai_assisted_count: 2 })] },
      { team_id: 2, team_name: '团队B', values: [stats('2026-08'), stats('2026-09')] },
    ],
    domain_summary: [stats('2026-08'), stats('2026-09', { ai_assisted_count: 2 })],
  })
  const model = buildRequirementKpiModel({
    dataByMetric: data,
    month: '2026-09',
    monthTrendIds: ['2026-08', '2026-09'],
    cyclePeriodIds: ['2026-08', '2026-09'],
    teams: [{ id: 1, name: '团队A' }, { id: 2, name: '团队B' }],
  })
  assert.equal(model.kpis.length, 4)
  assert.equal(model.kpis[0].monthValue, 1)
  assert.deepEqual(model.kpis[0].monthTrend, [0.5, 1])
  assert.equal(model.kpis[1].cycleValue, 1)
  assert.equal(model.kpis[1].cycleDelta, 0)
  assert.equal(model.teamRows[0].label, '全公司均值')
  assert.equal(model.teamRows[1].values.length, 4)
})

test('dual-activity team matrix keeps eight grouped metric columns and never merges activities', () => {
  const design = buildRequirementKpiData({
    period_ids: ['2026-09'],
    series: [{ team_id: 1, team_name: '团队A', values: [stats('2026-09', { fact_count: 4, known_ai_count: 4, ai_assisted_count: 1 })] }],
    domain_summary: [stats('2026-09', { fact_count: 4, known_ai_count: 4, ai_assisted_count: 1 })],
  })
  const development = buildRequirementKpiData({
    period_ids: ['2026-09'],
    series: [{ team_id: 1, team_name: '团队A', values: [stats('2026-09', { fact_count: 5, known_ai_count: 5, ai_assisted_count: 3 })] }],
    domain_summary: [stats('2026-09', { fact_count: 5, known_ai_count: 5, ai_assisted_count: 3 })],
  })
  const model = buildRequirementTeamMatrixModel({
    entries: [
      { key: 'design', label: '设计活动', dataByMetric: design },
      { key: 'development', label: '开发活动', dataByMetric: development },
    ],
    month: '2026-09',
    monthTrendIds: ['2026-09'],
    cyclePeriodIds: ['2026-09'],
    teams: [{ id: 1, name: '团队A' }, { id: 2, name: '团队B' }],
    view: 'month',
  })
  assert.equal(model.columns.length, 8)
  assert.deepEqual(model.columnGroups.map((group) => [group.id, group.label, group.count]), [['design', '设计活动', 4], ['development', '开发活动', 4]])
  assert.deepEqual(model.columns.map((column) => column.group), ['design', 'design', 'design', 'design', 'development', 'development', 'development', 'development'])
  assert.equal(model.columns[0].id, 'design-ai-demand-penetration')
  assert.equal(model.rows[0].label, '全公司均值')
  assert.equal(model.rows[1].values[0].value, 0.25)
  assert.equal(model.rows[1].values[4].value, 0.6)
})

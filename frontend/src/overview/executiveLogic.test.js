import assert from 'node:assert/strict'
import test from 'node:test'

import { executiveKpiRows, executiveMetricSummary, factCoverage, factTrendSnapshot, maturityMatrixData, metricCompanyAverageForWindow, metricTeamValuesForWindow, rankedTeams } from './executiveLogic.js'

test('executive helpers retain missing values and rank only one actual metric', () => {
  const row = {
    hasData: true,
    activity: { id: 1 },
    metric: { type: 'ratio' },
    teams: [
      { teamId: 1, point: { value: 0.4 } },
      { teamId: 2, point: { value: null } },
      { teamId: 3, point: { value: 0.7 } },
      { teamId: 4, point: { value: 0.7 } },
    ],
  }
  assert.deepEqual(factCoverage([row, { hasData: false }]), { available: 1, total: 2 })
  assert.deepEqual(rankedTeams(row).map(({ teamId, rank }) => [teamId, rank]), [[3, 1], [4, 1], [1, 3]])
})

test('fact trends preserve gaps', () => {
  const snapshot = factTrendSnapshot({
    data: { company_average: [{ period_id: '2026-08', value: 0.4 }, { period_id: '2026-09', value: null }] },
    periodIds: ['2026-07', '2026-08', '2026-09'],
    teamPoints: [{ point: { value: 0.2 } }, { point: { value: null } }, { point: { value: 0.6 } }],
  })
  assert.deepEqual(snapshot.values, [null, 0.4, null])
  assert.equal(snapshot.current, null)
  assert.equal(snapshot.validTeamCount, 2)
  assert.equal(snapshot.teamMin, 0.2)
  assert.equal(snapshot.teamMax, 0.6)
})

test('executive KPI selection points to four exact catalog metrics', () => {
  const rows = ['cd-ar-pen', 'cd-eff', 'tce-count', 'tcg-rate', 'ad-bool'].map((code) => ({ metric: { code, type: code === 'ad-bool' ? 'boolean' : 'count' } }))
  assert.deepEqual(executiveKpiRows(rows).map((row) => row.metric.code), ['cd-ar-pen', 'cd-eff', 'tce-count', 'tcg-rate'])
})

test('cycle values recompute a single metric from team raw facts and preserve company-average semantics', () => {
  const metric = { type: 'penetration' }
  const data = {
    periods: [{ id: '2026-08' }, { id: '2026-09' }],
    series: [
      { team_id: 1, team_name: '团队A', values: [{ period_id: '2026-08', value: 0.5, numerator: 5, denominator: 10 }, { period_id: '2026-09', value: 0.75, numerator: 15, denominator: 20 }] },
      { team_id: 2, team_name: '团队B', values: [{ period_id: '2026-08', value: 0.25, numerator: 5, denominator: 20 }, { period_id: '2026-09', value: 0.5, numerator: 10, denominator: 20 }] },
      { team_id: 3, team_name: '团队C', values: [{ period_id: '2026-08', value: null, numerator: null, denominator: null }, { period_id: '2026-09', value: null, numerator: null, denominator: null }] },
    ],
    company_average: [{ period_id: '2026-08', value: 0.375 }, { period_id: '2026-09', value: 0.625 }],
  }
  const value = metricCompanyAverageForWindow(data, metric, ['2026-08', '2026-09'])
  const summary = executiveMetricSummary({ data, metric, month: '2026-09', monthTrendIds: ['2026-08', '2026-09'], periodIds: ['2026-08', '2026-09'] })
  assert.ok(Math.abs(value - ((20 / 30 + 15 / 40) / 2)) < 1e-9)
  assert.ok(Math.abs(summary.periodValue - value) < 1e-9)
  assert.ok(Math.abs(summary.periodDelta - (value - 0.375)) < 1e-9)
  assert.deepEqual(summary.monthTrend, [0.375, 0.625])
  assert.deepEqual(metricTeamValuesForWindow(data, metric, ['2026-08', '2026-09']).map((team) => team.value), [20 / 30, 15 / 40, null])
})

test('cycle count delta is the selected month contribution, not the cumulative change', () => {
  const metric = { type: 'count' }
  const data = {
    periods: [{ id: '2026-08' }, { id: '2026-09' }],
    series: [
      { team_id: 1, values: [{ period_id: '2026-08', value: 2, numerator: 2 }, { period_id: '2026-09', value: 3, numerator: 3 }] },
      { team_id: 2, values: [{ period_id: '2026-08', value: 4, numerator: 4 }, { period_id: '2026-09', value: 6, numerator: 6 }] },
    ],
    company_average: [{ period_id: '2026-08', value: 3 }, { period_id: '2026-09', value: 4.5 }],
  }
  const summary = executiveMetricSummary({ data, metric, month: '2026-09', periodIds: ['2026-08', '2026-09'] })
  assert.equal(summary.periodValue, 7.5)
  assert.equal(summary.periodDelta, 4.5)
})

test('cycle count excludes no-fact points but keeps a recorded zero team', () => {
  const metric = { type: 'count' }
  const data = {
    series: [
      { team_id: 1, values: [{ period_id: '2026-08', value: 0, numerator: 0, fact_count: 1 }] },
      { team_id: 2, values: [{ period_id: '2026-08', value: 0, numerator: 0, fact_count: 0 }] },
      { team_id: 3, values: [{ period_id: '2026-08', value: 5, numerator: 5, fact_count: 1 }] },
    ],
    company_average: [{ period_id: '2026-08', value: 2.5 }],
  }

  assert.equal(metricCompanyAverageForWindow(data, metric, ['2026-08']), 2.5)
  assert.deepEqual(metricTeamValuesForWindow(data, metric, ['2026-08']).map(({ value }) => value), [0, null, 5])
})

test('maturity matrix keeps domain averages, evaluated zero, and unevaluated cells distinct', () => {
  const matrix = maturityMatrixData({
    activities: [
      { activity_id: 1, activity_name: 'SA设计', score_display: '2.00', grade: 2 },
      { activity_id: 2, activity_name: 'SE设计', score_display: null, grade: null },
    ],
    teams: [{ team_id: 7, team_name: '团队A', cells: [
      { activity_id: 1, score_display: '0.00', grade: 0 },
      { activity_id: 2, score_display: null, grade: null },
    ] }],
  })

  assert.deepEqual(matrix.columns.map(({ id, label }) => [id, label]), [[1, 'SA设计'], [2, 'SE设计']])
  assert.equal(matrix.rows[0].kind, 'average')
  assert.equal(matrix.rows[0].values[0].text, '2.00')
  assert.equal(matrix.rows[1].values[0].text, '0.00')
  assert.equal(matrix.rows[1].values[0].level, 0)
  assert.equal(matrix.rows[1].values[1].text, null)
})

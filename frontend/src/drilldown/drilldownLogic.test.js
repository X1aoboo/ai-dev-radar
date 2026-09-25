import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deltaForSelection,
  mergePeriods,
  maturityProfileSeries,
  sourceForPeriod,
  teamKpiEntries,
  teamMetricSummary,
  teamAccentColor,
  valueForSelection,
} from './drilldownLogic.js'
import { DATAVIZ_COLORS } from '../overview/overviewLogic.js'

const penetrationData = {
  periods: [
    { id: 'p1', start_date: '2026-01-01', end_date: '2026-01-31' },
    { id: 'p2', start_date: '2026-02-01', end_date: '2026-02-28' },
  ],
  series: [{
    team_id: 7,
    values: [
      { period_id: 'p1', value: 0.4, numerator: 4, denominator: 10 },
      { period_id: 'p2', value: 0.6, numerator: 6, denominator: 10 },
    ],
  }],
}
const penetrationMetric = { type: 'penetration' }

test('recomputes the all-period value from raw numerator and denominator', () => {
  assert.equal(valueForSelection(penetrationData, penetrationMetric, 7, 'p1'), 0.4)
  assert.equal(valueForSelection(penetrationData, penetrationMetric, 7, 'all'), 0.5)
})

test('recomputes efficiency from summed estimated and actual effort', () => {
  const data = {
    periods: [{ id: 'p1' }, { id: 'p2' }],
    series: [{
      team_id: 7,
      values: [
        { period_id: 'p1', value: 1, estimated: 8, actual: 4 },
        { period_id: 'p2', value: -0.5, estimated: 5, actual: 10 },
      ],
    }],
  }

  assert.equal(valueForSelection(data, { type: 'efficiency' }, 7, 'p1'), 1)
  assert.ok(Math.abs(valueForSelection(data, { type: 'efficiency' }, 7, 'all') + (1 / 14)) < 1e-9)
})

test('computes period delta from the preceding period in the same series', () => {
  assert.ok(Math.abs(deltaForSelection(penetrationData, penetrationMetric, 7, 'p2') - 0.2) < 1e-9)
  assert.equal(deltaForSelection(penetrationData, penetrationMetric, 7, 'p1'), null)
  assert.equal(deltaForSelection(penetrationData, penetrationMetric, 7, 'all'), null)
})

test('maps fact sources to a period and prefers manual when both sources exist', () => {
  const facts = [
    { metric_id: 1, start_date: '2026-01-04', end_date: '2026-01-10', source: 'auto' },
    { metric_id: 1, start_date: '2026-01-04', end_date: '2026-01-10', source: 'manual' },
    { metric_id: 1, start_date: '2026-02-01', end_date: '2026-02-28', source: 'auto' },
  ]

  assert.equal(sourceForPeriod(facts, 1, {
    id: '2026-01',
    kind: 'month',
    iteration_id: null,
    start_date: '2026-01-01',
    end_date: '2026-01-31',
  }), 'manual')
  assert.equal(sourceForPeriod(facts, 1, {
    id: '2026-02',
    kind: 'month',
    iteration_id: null,
    start_date: '2026-02-01',
    end_date: '2026-02-28',
  }), 'auto')
  assert.equal(sourceForPeriod(facts, 1, {
    id: '2026-03',
    kind: 'month',
    iteration_id: null,
    start_date: '2026-03-01',
    end_date: '2026-03-31',
  }), null)
})

test('team KPI selection references four existing single metrics and never combines them', () => {
  const entries = ['mrr-rate', 'custom', 'ad-bool', 'cd-eff', 'cd-ar-pen', 'tce-count', 'tcg-rate'].map((code) => ({
    activity: { name: code },
    metric: { code },
  }))
  assert.deepEqual(teamKpiEntries(entries).map(({ metric }) => metric.code), ['cd-ar-pen', 'cd-eff', 'tce-count', 'tcg-rate'])
  assert.deepEqual(teamKpiEntries([]), [])
})

test('team KPI windows calculate one team from raw facts and keep count contribution semantics', () => {
  const rateData = {
    periods: [{ id: '2026-07' }, { id: '2026-08' }],
    series: [{ team_id: 1, values: [
      { period_id: '2026-07', value: 0.5, numerator: 5, denominator: 10, fact_count: 1 },
      { period_id: '2026-08', value: 0.75, numerator: 15, denominator: 20, fact_count: 1 },
    ] }],
    company_average: [{ period_id: '2026-07', value: 0.5 }, { period_id: '2026-08', value: 0.75 }],
  }
  const rate = teamMetricSummary({ data: rateData, metric: { type: 'penetration' }, teamId: 1, month: '2026-08', cycle: '6m' })
  assert.equal(rate.monthValue, 0.75)
  assert.equal(rate.monthDelta, 0.25)
  assert.ok(Math.abs(rate.periodValue - 2 / 3) < 1e-9)
  assert.ok(Math.abs(rate.periodDelta - 1 / 6) < 1e-9)

  const countData = {
    periods: [{ id: '2026-07' }, { id: '2026-08' }],
    series: [{ team_id: 1, values: [
      { period_id: '2026-07', value: 4, numerator: 4, fact_count: 1 },
      { period_id: '2026-08', value: 0, numerator: 0, fact_count: 1 },
    ] }],
    company_average: [{ period_id: '2026-07', value: 4 }, { period_id: '2026-08', value: 0 }],
  }
  const count = teamMetricSummary({ data: countData, metric: { type: 'count' }, teamId: 1, month: '2026-08', cycle: '6m' })
  assert.equal(count.periodValue, 4)
  assert.equal(count.periodDelta, 0)
})

test('keeps a directly opened team on the same fixed color slot as the overview', () => {
  assert.equal(teamAccentColor(2, [1, 2, 3, 4]), DATAVIZ_COLORS.team[1])
  assert.equal(teamAccentColor(2, [1, 2, 3, 4], { 2: 1 }), DATAVIZ_COLORS.team[1])
})

test('team maturity profile preserves evaluated zero and leaves unevaluated points missing', () => {
  const series = maturityProfileSeries({
    activities: [
      { activity_id: 1, score: 2.5 },
      { activity_id: 2, score: null },
    ],
    records: [{ activity_id: 1, score_raw: '0.00' }, { activity_id: 2, score_raw: null }],
    teamName: '团队A',
    teamColor: '#2a78d6',
    domainColor: '#98a2b3',
  })
  assert.deepEqual(series.map(({ values }) => values), [[0, null], [2.5, null]])
  assert.equal(series[1].dashed, true)
})

test('merges and orders all periods represented by an activity metrics set', () => {
  const periods = mergePeriods([
    { periods: [{ id: '2026-02', start_date: '2026-02-01' }] },
    { periods: [{ id: '2026-01', start_date: '2026-01-01' }, { id: '2026-02', start_date: '2026-02-01' }] },
  ])

  assert.deepEqual(periods.map((period) => period.id), ['2026-01', '2026-02'])
})

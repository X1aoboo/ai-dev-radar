import test from 'node:test'
import assert from 'node:assert/strict'

import {
  averageMetricValues,
  deltaForSelection,
  sourceForPeriod,
  valueForSelection,
} from './drilldownLogic.js'

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

test('averages only non-empty metrics selected by the KPI predicate', () => {
  const entries = [
    { metric: { id: 1, type: 'penetration' }, data: penetrationData },
    {
      metric: { id: 2, type: 'penetration' },
      data: {
        periods: penetrationData.periods,
        series: [{ team_id: 7, values: [{ period_id: 'p2', value: 0.8, numerator: 8, denominator: 10 }] }],
      },
    },
    { metric: { id: 3, type: 'count' }, data: penetrationData },
  ]

  assert.equal(averageMetricValues(entries, (metric) => metric.type === 'penetration', 7, 'p2'), 0.7)
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

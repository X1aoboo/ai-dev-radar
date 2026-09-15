import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assignTeamColorSlots,
  currentSnapshot,
  currentMetricValues,
  filterFromSearchParams,
  filterToSearchParams,
  filtersEqual,
  formatMetricValue,
  latestPeriodId,
  maturityStateFromSearchParams,
  maturityStateToSearchParams,
  normalizeMaturityState,
  previousMonthId,
  normalizeFilter,
  queryForActivity,
  trimToRecentPeriods,
  valueForPeriod,
} from './overviewLogic.js'

test('latestPeriodId returns the newest period and all for an empty axis', () => {
  assert.equal(latestPeriodId([{ id: '2026-07' }, { id: '2026-08' }]), '2026-08')
  assert.equal(latestPeriodId([]), 'all')
})

test('trimToRecentPeriods keeps the latest six periods and aligned series values', () => {
  const periods = Array.from({ length: 8 }, (_, index) => ({ id: `p${index + 1}` }))
  const data = {
    periods,
    series: [{
      team_id: 1,
      team_name: '团队A',
      values: periods.map((period, index) => ({ period_id: period.id, value: index })),
    }],
    company_average: periods.map((period, index) => ({ period_id: period.id, value: index + 0.5 })),
  }

  const trimmed = trimToRecentPeriods(data, 6)

  assert.deepEqual(trimmed.periods.map((period) => period.id), ['p3', 'p4', 'p5', 'p6', 'p7', 'p8'])
  assert.deepEqual(trimmed.series[0].values.map((point) => point.period_id), ['p3', 'p4', 'p5', 'p6', 'p7', 'p8'])
  assert.deepEqual(trimmed.company_average.map((point) => point.period_id), ['p3', 'p4', 'p5', 'p6', 'p7', 'p8'])
})

test('team color slots stay fixed when a team disappears', () => {
  const first = assignTeamColorSlots([1, 2, 3, 4])
  const second = assignTeamColorSlots([1, 3, 4, 5], first.slots)

  assert.equal(second.colors[1], first.colors[1])
  assert.equal(second.colors[3], first.colors[3])
  assert.equal(second.colors[4], first.colors[4])
  assert.notEqual(second.colors[5], second.colors[1])
})

test('metric values use the domain display formats', () => {
  assert.equal(formatMetricValue({ type: 'penetration' }, 0.625), '63%')
  assert.equal(formatMetricValue({ type: 'efficiency' }, -0.125), '-12%')
  assert.equal(formatMetricValue({ type: 'ratio' }, 0.5), '50%')
  assert.equal(formatMetricValue({ type: 'count' }, 1200), '1,200')
  assert.equal(formatMetricValue({ type: 'boolean' }, true), '具备')
  assert.equal(formatMetricValue({ type: 'boolean' }, false), '不具备')
  assert.equal(formatMetricValue({ type: 'count' }, 0), '0')
  assert.equal(formatMetricValue({ type: 'penetration' }, null), '—')
})

test('currentSnapshot returns the selected team and company values from one slice', () => {
  const data = {
    series: [{
      team_id: 1,
      team_name: '团队A',
      values: [{ period_id: 'p1', value: 0.5, numerator: 5, denominator: 10 }],
    }],
    company_average: [{ period_id: 'p1', value: 0.4 }],
  }

  assert.deepEqual(currentSnapshot(data, 'p1'), {
    teams: [{ team_id: 1, team_name: '团队A', point: data.series[0].values[0] }],
    company: data.company_average[0],
  })
  assert.equal(currentSnapshot(data, 'all'), null)
})

test('general activities use the fixed monthly fallback in iteration mode', () => {
  assert.deepEqual(queryForActivity(
    { kind: 'general' },
    { dimension: 'iteration', granularity: 'week', versionId: '2' },
  ), {
    dimension: 'time',
    granularity: 'month',
    versionId: null,
    fallback: true,
  })
})

test('key activities preserve the selected iteration query', () => {
  assert.deepEqual(queryForActivity(
    { kind: 'key' },
    { dimension: 'iteration', granularity: 'month', versionId: '2' },
  ), {
    dimension: 'iteration',
    granularity: 'month',
    versionId: '2',
    fallback: false,
  })
})

test('normalizes filter query values and serializes only supported state', () => {
  const versions = [{ id: 2 }]
  const periods = [{ id: 'p2' }]
  const parsed = filterFromSearchParams(
    new URLSearchParams('dimension=iteration&granularity=invalid&version=2&period=p2'),
    { versions, periods },
  )

  assert.deepEqual(parsed, {
    dimension: 'iteration',
    granularity: 'month',
    versionId: '2',
    periodId: 'p2',
  })
  assert.equal(filterToSearchParams(parsed).toString(), 'dimension=iteration&version=2&period=p2')
  assert.deepEqual(
    normalizeFilter({ dimension: 'broken', granularity: 'day', versionId: '99', periodId: 'missing' }, { versions, periods }),
    { dimension: 'time', granularity: 'month', versionId: 'all', periodId: null },
  )
  assert.equal(filtersEqual(parsed, { ...parsed }), true)
})

test('forces month granularity whenever the dimension is iteration', () => {
  assert.deepEqual(
    normalizeFilter({ dimension: 'iteration', granularity: 'week', versionId: '2', periodId: 'p2' }, {
      versions: [{ id: 2 }],
      periods: [{ id: 'p2' }],
    }),
    { dimension: 'iteration', granularity: 'month', versionId: '2', periodId: 'p2' },
  )
})

test('keeps numeric zero distinct from missing values in current slices', () => {
  const data = {
    periods: [{ id: 'p1', label: '2026-01' }],
    series: [
      { team_id: 1, team_name: '团队A', values: [{ period_id: 'p1', value: 0, numerator: 0, denominator: 10 }] },
      { team_id: 2, team_name: '团队B', values: [] },
    ],
    company_average: [{ period_id: 'p1', value: 0 }],
  }
  const metric = { type: 'penetration' }
  const current = currentMetricValues(data, metric, 'p1')

  assert.equal(valueForPeriod(data, metric, 1, 'p1'), 0)
  assert.equal(valueForPeriod(data, metric, 2, 'p1'), null)
  assert.deepEqual(current.teams.map((team) => team.value), [0, null])
  assert.equal(current.company.value, 0)
})

test('aggregates company average, efficiency, count, boolean, and all-period values', () => {
  const efficiencyData = {
    periods: [{ id: 'p1' }, { id: 'p2' }],
    series: [
      {
        team_id: 1,
        team_name: '团队A',
        values: [
          { period_id: 'p1', value: 8, estimated: 4, actual: 0 },
          { period_id: 'p2', value: 1, estimated: 4, actual: 2 },
        ],
      },
      { team_id: 2, team_name: '团队B', values: [{ period_id: 'p1', value: 0, estimated: 1, actual: 1 }] },
    ],
    company_average: [{ period_id: 'p1', value: 0.5 }, { period_id: 'p2', value: 0.75 }],
  }

  assert.equal(valueForPeriod(efficiencyData, { type: 'efficiency' }, 1, 'p1'), 8)
  assert.equal(valueForPeriod(efficiencyData, { type: 'efficiency' }, 1, 'all'), 3)
  assert.equal(currentMetricValues(efficiencyData, { type: 'efficiency' }, 'p1').company.value, 0.5)
  assert.equal(currentMetricValues(efficiencyData, { type: 'efficiency' }, 'all').company.value, 1.5)

  const countData = {
    series: [{ team_id: 1, values: [{ period_id: 'p1', value: 2, numerator: 2 }, { period_id: 'p2', value: 3, numerator: 3 }] }],
  }
  assert.equal(valueForPeriod(countData, { type: 'count' }, 1, 'all'), 5)

  const booleanData = {
    series: [{ team_id: 1, snapshot: false, values: [{ period_id: 'p1', value: true }] }],
  }
  assert.equal(valueForPeriod(booleanData, { type: 'boolean' }, 1, 'p1'), false)
  assert.equal(valueForPeriod(booleanData, { type: 'boolean' }, 1, 'all'), false)
})

test('maturity URL state keeps the current month, selection limit, and baseline semantics', () => {
  assert.equal(previousMonthId('2026-01'), '2025-12')
  const state = normalizeMaturityState({
    view: 'team',
    category: 'general',
    month: '2026-08',
    compareTeamIds: ['1', '2', '3', '4', 'missing'],
    showBaseline: false,
    sort: 'score',
  }, { teams: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] })
  assert.deepEqual(state.compareTeamIds, ['1', '2', '3'])
  assert.equal(state.showBaseline, false)
  const params = maturityStateToSearchParams(state)
  assert.equal(params.get('view'), 'team')
  assert.equal(params.get('category'), 'general')
  assert.equal(params.get('month'), '2026-08')
  assert.equal(params.get('teams'), '1,2,3')
  assert.equal(params.get('baseline'), '0')
  assert.equal(params.get('sort'), 'score')

  assert.deepEqual(
    maturityStateFromSearchParams(new URLSearchParams('view=team&category=broken&month=bad&teams=1,2,3,4&baseline=0'), { teams: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] }),
    { view: 'team', category: 'key', month: expectCurrentMonth(), compareTeamIds: ['1', '2', '3'], showBaseline: false, sort: 'order' },
  )
})

function expectCurrentMonth() {
  return new Date().toISOString().slice(0, 7)
}

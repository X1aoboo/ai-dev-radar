import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assignTeamColorSlots,
  currentSnapshot,
  formatMetricValue,
  latestPeriodId,
  queryForActivity,
  trimToRecentPeriods,
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
  assert.equal(formatMetricValue({ type: 'count' }, 1200), '1,200')
  assert.equal(formatMetricValue({ type: 'boolean' }, true), '具备')
  assert.equal(formatMetricValue({ type: 'ratio' }, null), '—')
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

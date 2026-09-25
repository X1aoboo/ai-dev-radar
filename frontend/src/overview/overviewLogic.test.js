import assert from 'node:assert/strict'
import test from 'node:test'

import {
  analysisWindowLabel,
  analysisWindowMonths,
  assignTeamColorSlots,
  bestAndWeakestRows,
  buildMaturityTrendRows,
  buildMetricTrendRows,
  currentSnapshot,
  currentMetricValues,
  buildAttentionItems,
  buildMetricRows,
  factCompleteness,
  filterFromSearchParams,
  filterToSearchParams,
  filtersEqual,
  formatMetricValue,
  latestPeriodId,
  maturityAverageScore,
  monthWindow,
  metricPointForMonth,
  maturityStateFromSearchParams,
  maturityStateToSearchParams,
  normalizeMaturityState,
  previousMonthId,
  normalizeFilter,
  queryForActivity,
  trimToAnalysisWindow,
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

test('analysis windows end at the selected month for month, week, and day data', () => {
  const cases = [
    { granularity: 'month', limit: 6, existingId: '2026-08', lastId: '2026-09' },
    { granularity: 'week', limit: 12, existingId: '2026-W39', lastId: '2026-W40' },
    { granularity: 'day', limit: 30, existingId: '2026-09-29', lastId: '2026-09-30' },
  ]

  for (const { granularity, limit, existingId, lastId } of cases) {
    const trimmed = trimToAnalysisWindow({
      granularity,
      periods: [{ id: existingId, label: existingId, kind: granularity, start_date: existingId, end_date: existingId }],
      series: [{ team_id: 1, values: [{ period_id: existingId, value: 0.4 }] }],
      company_average: [{ period_id: existingId, value: 0.4 }],
    }, { month: '2026-09', limit })

    assert.equal(trimmed.periods.length, limit)
    assert.equal(trimmed.periods.at(-1).id, lastId)
    assert.equal(trimmed.series[0].values.some((point) => point.period_id === lastId), false)
    assert.equal(trimmed.company_average.some((point) => point.period_id === lastId), false)
  }
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

test('time-based key activity queries retain a selected version while general capabilities ignore it', () => {
  const filter = { dimension: 'time', granularity: 'month', versionId: '2' }
  assert.equal(queryForActivity({ kind: 'key' }, filter).versionId, '2')
  assert.equal(queryForActivity({ kind: 'general' }, filter).versionId, null)
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
    new URLSearchParams('dimension=iteration&granularity=invalid&version=2&period=p2&metric=901'),
    { versions, periods },
  )

  assert.deepEqual(parsed, {
    dimension: 'iteration',
    granularity: 'month',
    versionId: '2',
    periodId: 'p2',
    metricId: '901',
    cycle: '6m',
  })
  assert.equal(filterToSearchParams(parsed).toString(), 'dimension=iteration&version=2&period=p2&metric=901')
  const halfYear = filterFromSearchParams(new URLSearchParams('cycle=half'))
  assert.equal(halfYear.cycle, 'half')
  assert.equal(filterToSearchParams(halfYear).toString(), 'cycle=half')
  const timeVersion = normalizeFilter({ dimension: 'time', versionId: '2' }, { versions })
  assert.equal(filterToSearchParams(timeVersion).toString(), 'version=2')
  assert.deepEqual(
    normalizeFilter({ dimension: 'broken', granularity: 'day', versionId: '99', periodId: 'missing' }, { versions, periods }),
    { dimension: 'time', granularity: 'day', versionId: 'all', periodId: null, metricId: 'all', cycle: '6m' },
  )
  assert.equal(filtersEqual(parsed, { ...parsed }), true)
})

test('forces month granularity whenever the dimension is iteration', () => {
  assert.deepEqual(
    normalizeFilter({ dimension: 'iteration', granularity: 'week', versionId: '2', periodId: 'p2' }, {
      versions: [{ id: 2 }],
      periods: [{ id: 'p2' }],
    }),
    { dimension: 'iteration', granularity: 'month', versionId: '2', periodId: 'p2', metricId: 'all', cycle: '6m' },
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

test('matches the selected month, keeps zero, and counts only valid teams', () => {
  const data = {
    periods: [{ id: '2026-01' }, { id: '2026-02' }],
    series: [
      { team_id: 1, team_name: '团队A', values: [{ period_id: '2026-01', value: 0 }, { period_id: '2026-02', value: 0.8 }] },
      { team_id: 2, team_name: '团队B', values: [{ period_id: '2026-01', value: null }] },
    ],
    company_average: [{ period_id: '2026-01', value: 0 }, { period_id: '2026-02', value: 0.8 }],
    domain_summary: [{ period_id: '2026-01', value: 0.99 }],
  }

  const january = metricPointForMonth(data, '2026-01', 2)
  assert.equal(january.company.value, 0)
  assert.equal(january.validTeamCount, 1)
  assert.equal(january.totalTeamCount, 2)
  assert.equal(january.hasData, true)
  assert.equal(metricPointForMonth(data, '2026-03', 2).hasData, false)
  assert.equal(january.company.value, data.company_average[0].value)
})

test('excludes missing maturity values and classifies negative and relatively-behind facts', () => {
  const activities = [{
    id: 1,
    name: '编码开发',
    kind: 'key',
    metrics: [{ id: 11, name: '编码效率', type: 'efficiency' }],
  }]
  const data = {
    periods: [{ id: '2026-01' }],
    series: [
      { team_id: 1, team_name: '团队A', values: [{ period_id: '2026-01', value: -0.2, estimated: 8, actual: 10 }] },
      { team_id: 2, team_name: '团队B', values: [{ period_id: '2026-01', value: 0.5, estimated: 15, actual: 10 }] },
    ],
    company_average: [{ period_id: '2026-01', value: 0.1 }],
  }
  const rows = buildMetricRows({ activities, dataByMetric: { 11: data }, month: '2026-01', teams: [{ id: 1 }, { id: 2 }] })
  const items = buildAttentionItems({
    activities,
    dataByMetric: { 11: data },
    maturityData: { activities: [{ activity_id: 1, activity_name: '编码开发', score: null }] },
    month: '2026-01',
    teams: [{ id: 1 }, { id: 2 }],
  })

  assert.deepEqual(factCompleteness(rows), { available: 1, total: 1, rate: 1 })
  assert.equal(items.some((item) => item.type === 'negative-efficiency' && item.teamName === '团队A'), true)
  assert.equal(items.some((item) => item.type === 'relative-behind' && item.teamName === '团队A'), true)
  assert.equal(items.some((item) => item.type === 'maturity-missing'), true)
  assert.equal(maturityAverageScore({ activities: [{ score: 0 }, { score: null }, { score: 2 }] }), 1)
})

test('builds a six-month window ending at the selected month without filling gaps', () => {
  assert.deepEqual(monthWindow('2026-03'), ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'])
  const rows = buildMetricTrendRows({
    activities: [{ id: 1, name: '编码开发', metrics: [{ id: 11, name: '渗透率', type: 'penetration' }] }],
    dataByMetric: {
      11: {
        periods: [{ id: '2026-02' }, { id: '2026-03' }],
        series: [{ team_id: 1, values: [{ period_id: '2026-02', value: 0 }, { period_id: '2026-03', value: 0.4 }] }],
        company_average: [{ period_id: '2026-02', value: 0 }, { period_id: '2026-03', value: 0.4 }],
      },
    },
    months: ['2026-01', '2026-02', '2026-03'],
    teams: [{ id: 1 }],
  })
  assert.deepEqual(rows[0].values, [null, 0, 0.4])
  assert.equal(rows[0].delta, 0.4)
})

test('analysis cycle windows end at the selected month and do not invent a full future period', () => {
  assert.deepEqual(analysisWindowMonths('2026-09', '6m'), ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
  assert.deepEqual(analysisWindowMonths('2026-09', 'half'), ['2026-07', '2026-08', '2026-09'])
  assert.deepEqual(analysisWindowMonths('2026-09', 'year').slice(0, 2), ['2026-01', '2026-02'])
  assert.deepEqual(analysisWindowMonths('2026-09', 'year').slice(-1), ['2026-09'])
  assert.deepEqual(analysisWindowMonths('2026-01', '6m'), ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'])
  assert.equal(analysisWindowLabel('2026-09', 'half'), '2026下半年')
  assert.deepEqual(analysisWindowMonths('bad', 'year'), [])
})

test('keeps maturity zero, missing history, and best/weak values distinct', () => {
  const rows = buildMaturityTrendRows({
    activities: [{ id: 1, name: '编码开发' }, { id: 2, name: '测试' }],
    history: [
      { month: '2026-02', data: { activities: [{ activity_id: 1, score: 0 }, { activity_id: 2, score: null }] } },
      { month: '2026-03', data: { activities: [{ activity_id: 1, score: 1.5 }, { activity_id: 2, score: 2 }] } },
    ],
    months: ['2026-02', '2026-03'],
  })
  assert.deepEqual(rows.map((row) => row.values), [[0, 1.5], [null, 2]])
  assert.equal(rows[0].delta, 1.5)
  assert.equal(bestAndWeakestRows(rows).best.activity.name, '测试')
  assert.equal(bestAndWeakestRows(rows).weakest.activity.name, '编码开发')
})

function expectCurrentMonth() {
  return new Date().toISOString().slice(0, 7)
}

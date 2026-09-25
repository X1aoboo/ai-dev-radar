import assert from 'node:assert/strict'
import { test } from 'vitest'

import { metricRequests, normalizeFactPresence } from './metricData.js'
import { metricPointForMonth } from './overviewLogic.js'

test('overview version filters reach keyed time metrics and skip general capabilities', () => {
  const requests = metricRequests([
    { id: 1, kind: 'key', metrics: [{ id: 11 }] },
    { id: 2, kind: 'general', metrics: [{ id: 21 }] },
  ], { dimension: 'time', granularity: 'month', versionId: '2', periodId: null, metricId: 'all' })

  assert.equal(new URLSearchParams(requests[0].url.split('?')[1]).get('version_id'), '2')
  assert.equal(new URLSearchParams(requests[1].url.split('?')[1]).has('version_id'), false)
})

test('compute points keep recorded zero separate from no facts', () => {
  const data = normalizeFactPresence({
    periods: [{ id: 'missing' }, { id: 'zero' }],
    series: [{ team_id: 1, values: [
      { period_id: 'missing', value: 0, numerator: 0, denominator: 0, fact_count: 0 },
      { period_id: 'zero', value: 0, numerator: 0, denominator: 5, fact_count: 1 },
    ] }],
    company_average: [{ period_id: 'missing', value: null }, { period_id: 'zero', value: 0 }],
  })

  assert.equal(data.series[0].values[0].value, null)
  assert.equal(data.series[0].values[0].numerator, null)
  assert.equal(data.series[0].values[1].value, 0)
  assert.equal(data.series[0].values[1].fact_count, 1)
  assert.equal(metricPointForMonth(data, 'missing').teams[0].point, null)
  assert.equal(metricPointForMonth(data, 'zero').teams[0].point.value, 0)
})

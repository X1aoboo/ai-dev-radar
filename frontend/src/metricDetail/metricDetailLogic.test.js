import assert from 'node:assert/strict'
import test from 'node:test'

import { booleanStatusRows, findMetric } from './metricDetailLogic.js'

const customActivity = {
  id: 42,
  name: '自定义活动',
  kind: 'general',
  metrics: [{ id: 901, code: 'custom-capability', name: '自定义能力', type: 'boolean' }],
}

test('findMetric resolves a custom catalog metric with its owning activity', () => {
  assert.deepEqual(findMetric([customActivity], '901'), {
    activity: customActivity,
    metric: customActivity.metrics[0],
  })
  assert.equal(findMetric([customActivity], 'missing'), null)
})

test('booleanStatusRows keeps team order and exposes unknown data explicitly', () => {
  const teams = [
    { id: 2, name: '团队B' },
    { id: 1, name: '团队A' },
    { id: 3, name: '团队C' },
  ]
  const data = {
    series: [
      { team_id: 1, snapshot: true },
      { team_id: 2, snapshot: false },
    ],
  }

  assert.deepEqual(booleanStatusRows(data, teams), [
    { team: teams[0], value: false, state: 'no' },
    { team: teams[1], value: true, state: 'yes' },
    { team: teams[2], value: null, state: 'unknown' },
  ])
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { executiveFactRows, factCoverage, factTrendSnapshot, lifecycleRows, rankedTeams } from './executiveLogic.js'

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
  assert.equal(lifecycleRows([row])[0].row, null)
})

test('lifecycle stages point to real named metrics and fact trends preserve gaps', () => {
  const requirement = { metric: { code: 'sa-ir-pen' } }
  const lifecycle = lifecycleRows([requirement])
  assert.deepEqual(lifecycle.map((entry) => entry.stage.label), ['需求', '设计', '开发', '检视', '测试', '交付'])
  assert.equal(lifecycle[0].row, requirement)
  assert.equal(lifecycle[1].row, null)

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

test('executive fact cards use real numeric catalog metrics only', () => {
  const first = { metric: { code: 'custom-a', type: 'count' } }
  const boolean = { metric: { code: 'custom-b', type: 'boolean' } }
  const second = { metric: { code: 'custom-c', type: 'ratio' } }
  assert.deepEqual(executiveFactRows([first, boolean, second]), [first, second])
})

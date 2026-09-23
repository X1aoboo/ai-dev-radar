import assert from 'node:assert/strict'
import test from 'node:test'

import { buildIterationCompareOption, buildTeamTrendOption } from './chartOption.js'

const data = {
  periods: [{ id: 'p1', label: '2026-07' }, { id: 'p2', label: '2026-08' }],
  series: [{ team_id: 1, values: [{ period_id: 'p1', value: 0.3 }, { period_id: 'p2', value: 0.4 }] }],
  company_average: [{ period_id: 'p1', value: 0.25 }, { period_id: 'p2', value: 0.35 }],
}

test('team and iteration charts align edge-period labels inside the plot', () => {
  const options = [
    buildTeamTrendOption({ data, metric: { type: 'penetration' }, teamId: 1, selectedPeriodId: 'p2', accent: '#2a78d6' }),
    buildIterationCompareOption({ data, metric: { type: 'penetration' }, teamId: 1, accent: '#2a78d6' }),
  ]

  for (const option of options) {
    assert.equal(option.xAxis.axisLabel.alignMinLabel, 'left')
    assert.equal(option.xAxis.axisLabel.alignMaxLabel, 'right')
  }
})

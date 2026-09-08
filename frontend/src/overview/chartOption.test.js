import assert from 'node:assert/strict'
import test from 'node:test'

import { buildTrendOption } from './chartOption.js'

const data = {
  periods: [{ id: 'p1', label: '2026-01' }, { id: 'p2', label: '2026-02' }],
  series: [{
    team_id: 1,
    team_name: '团队A',
    values: [
      { period_id: 'p1', value: 0.2, numerator: 2, denominator: 10 },
      { period_id: 'p2', value: 0.4, numerator: 4, denominator: 10 },
    ],
  }],
  company_average: [{ period_id: 'p1', value: 0.2 }, { period_id: 'p2', value: 0.4 }],
}

test('trend option uses a crosshair and de-emphasized company average', () => {
  const option = buildTrendOption({
    data,
    metric: { type: 'penetration', numerator_semantic: 'AI数', denominator_semantic: '总数' },
    teamColors: { 1: '#2a78d6' },
    selectedPeriodId: 'p2',
  })

  assert.equal(option.tooltip.axisPointer.type, 'cross')
  assert.equal(option.series.length, 2)
  assert.equal(option.series[0].lineStyle.width, 2)
  assert.equal(option.series[1].name, '全公司均值')
  assert.equal(option.series[1].lineStyle.type, 'dashed')
  assert.equal(option.series[0].data[1].symbol, 'circle')
  assert.equal(option.series[0].data[0].symbol, 'none')
})

test('count metrics use grouped bars instead of trend lines', () => {
  const option = buildTrendOption({
    data,
    metric: { type: 'count', numerator_semantic: '执行数' },
    teamColors: { 1: '#2a78d6' },
    selectedPeriodId: 'p2',
    countAsBars: true,
  })

  assert.equal(option.tooltip.axisPointer.type, 'shadow')
  assert.equal(option.xAxis.boundaryGap, true)
  assert.deepEqual(option.series.map((series) => series.type), ['bar', 'line'])
  assert.equal(option.series[0].barMaxWidth, 24)
  assert.equal(option.series[1].name, '全公司均值')
  assert.equal(option.series[1].lineStyle.type, 'dashed')
})

test('count metrics remain trend lines in the overview default', () => {
  const option = buildTrendOption({
    data,
    metric: { type: 'count', numerator_semantic: '执行数' },
    teamColors: { 1: '#2a78d6' },
    selectedPeriodId: 'p2',
  })

  assert.deepEqual(option.series.map((series) => series.type), ['line', 'line'])
})

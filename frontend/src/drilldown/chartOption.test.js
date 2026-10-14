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
  assert.equal(options[0].series.at(-1).name, '有事实团队等权均值')
  assert.equal(options[1].series[1].name, '有事实团队等权均值')
  const tooltip = options[0].tooltip.formatter([
    { seriesName: '团队A', marker: '●', value: 0.4, data: options[0].series[0].data[1], dataIndex: 1, seriesIndex: 0, axisValue: '2026-08' },
    { seriesName: '有事实团队等权均值', marker: '◆', value: 0.35, data: options[0].series.at(-1).data[1], dataIndex: 1, seriesIndex: 1, axisValue: '2026-08' },
  ])
  assert.match(tooltip, /变化差值单位：百分点（pp）/)
  assert.match(tooltip, /均差 \+5pp/)
})

test('version-scoped trends name the unversioned comparison as a domain reference and show only two series', () => {
  const averageLabel = '领域参照（所有团队，不限版本）'
  const line = buildTeamTrendOption({ data, metric: { type: 'penetration' }, teamId: 1, selectedPeriodId: 'all', accent: '#2a78d6', averageLabel })
  const bars = buildIterationCompareOption({ data, metric: { type: 'penetration' }, teamId: 1, accent: '#2a78d6', averageLabel })

  assert.equal(line.series.length, 2)
  assert.equal(line.series.at(-1).name, averageLabel)
  assert.deepEqual(line.series.at(-1).data.map(({ value }) => value), [0.25, 0.35])
  assert.equal(bars.series.length, 2)
  assert.equal(bars.series[1].name, averageLabel)
  assert.deepEqual(bars.series[1].data.map(({ value }) => value), [0.25, 0.35])
})

test('team efficiency trends and iteration bars cap plotted outliers but retain raw hover values', () => {
  const efficiencyData = {
    periods: [{ id: 'p1', label: '2026-07' }, { id: 'p2', label: '2026-08' }],
    series: [{ team_id: 1, team_name: '团队A', values: [{ period_id: 'p1', value: 0.5 }, { period_id: 'p2', value: 3.5 }] }],
    company_average: [{ period_id: 'p1', value: 0.4 }, { period_id: 'p2', value: 2.5 }],
  }
  const metric = { type: 'efficiency' }
  const trend = buildTeamTrendOption({ data: efficiencyData, metric, teamId: 1, selectedPeriodId: 'all', accent: '#2a78d6' })
  const bars = buildIterationCompareOption({ data: efficiencyData, metric, teamId: 1, accent: '#2a78d6' })

  assert.equal(trend.yAxis.max, 1)
  assert.equal(trend.series[0].data[1].value, 1)
  assert.equal(trend.series[0].data[1].rawPoint.value, 3.5)
  assert.equal(bars.yAxis.max, 1)
  assert.equal(bars.series[0].data[1].value, 1)
  assert.equal(bars.series[0].data[1].rawPoint.value, 3.5)
  assert.equal(trend.series.at(-1).name, '有事实团队等权均值')
  assert.equal(bars.series[1].name, '有事实团队等权均值')
  const tooltip = bars.tooltip.formatter([{ axisValue: '2026-08', seriesName: '本团队', marker: '•', value: 1, data: bars.series[0].data[1] }])
  assert.match(tooltip, /图上限 \+100%/)
  assert.match(tooltip, /原值 \+350%/)
})

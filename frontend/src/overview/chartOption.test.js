import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { buildInsightOption, buildTrendOption, efficiencyOutlierAxisLabel, hasEfficiencyOutlier } from './chartOption.js'
import { chartTheme } from '../charts/chartTheme.js'
import { designTokens } from '../design/theme.js'

const tokenSource = readFileSync(new URL('../design/tokens.css', import.meta.url), 'utf8')
const tokenValue = (name) => tokenSource.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm'))?.[1].trim()

test('Ant and ECharts adapters resolve the canonical CSS semantic tokens', () => {
  const pairs = [
    ['--color-brand-primary', designTokens.brandPrimary],
    ['--color-bg-page', designTokens.page],
    ['--color-bg-surface', designTokens.surface],
    ['--color-text-primary', designTokens.textPrimary],
    ['--color-text-secondary', designTokens.textSecondary],
    ['--color-border-default', designTokens.border],
    ['--color-data-axis', chartTheme.axis],
    ['--color-data-grid', chartTheme.grid],
    ['--color-success', chartTheme.positive],
    ['--color-danger', chartTheme.negative],
    ['--color-data-average', chartTheme.domainAverage],
    ['--color-data-target', chartTheme.target],
    ...chartTheme.team.map((color, index) => [`--color-data-team-${index + 1}`, color]),
    ...chartTheme.extendedTeam.map((color, index) => [`--color-data-team-${index + 5}`, color]),
    ...chartTheme.maturity.map((color, index) => [`--color-data-maturity-${index}`, color]),
  ]
  for (const [name, color] of pairs) assert.equal(color.toLowerCase(), tokenValue(name).toLowerCase(), name)
})

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

  assert.equal(option.tooltip.trigger, 'axis')
  assert.equal(option.tooltip.axisPointer.type, 'cross')
  assert.equal(option.tooltip.axisPointer.label.show, false)
  assert.equal(option.series.length, 2)
  assert.equal(option.series[0].lineStyle.width, 2.75)
  assert.equal(option.series[1].name, '全公司均值')
  assert.equal(option.series[1].lineStyle.type, 'dashed')
  assert.equal(option.series[0].data[1].symbol, 'circle')
  assert.equal(option.series[0].data[0].symbol, 'none')
  assert.equal(option.yAxis.axisPointer.label.show, false)
  assert.equal(option.xAxis.axisLabel.alignMinLabel, 'left')
  assert.equal(option.xAxis.axisLabel.alignMaxLabel, 'right')
})

test('activity trend options can expose a subtle marker at every valid period', () => {
  const option = buildTrendOption({
    data,
    metric: { type: 'penetration' },
    teamColors: { 1: '#2a78d6' },
    selectedPeriodId: 'all',
    showPointMarkers: true,
    tooltipTrigger: 'item',
  })

  assert.equal(option.tooltip.trigger, 'item')
  assert.ok(option.series[0].data.every((point) => point.symbol === 'circle' && point.symbolSize === 5))
  assert.equal(option.series[0].showSymbol, true)
  assert.ok(option.series[1].data.every((point) => point.symbol === 'diamond' && point.symbolSize === 5))
  const tooltip = option.tooltip.formatter({
    seriesName: '团队A', marker: '●', value: 0.2, data: option.series[0].data[0], dataIndex: 0, seriesIndex: 0,
  })
  assert.match(tooltip, /2026-01/)
  assert.match(tooltip, /团队A/)
})

test('trend tooltip compares each value with its same-metric mean and previous period', () => {
  const option = buildTrendOption({
    data: {
      ...data,
      series: [
        ...data.series,
        { team_id: 2, team_name: '团队B', values: [{ period_id: 'p2', value: 0.5, numerator: 5, denominator: 10 }] },
        { team_id: 3, team_name: '团队C', values: [{ period_id: 'p2', value: null }] },
      ],
      company_average: [data.company_average[0], { ...data.company_average[1], value: 0.35 }],
    },
    metric: { type: 'penetration', numerator_semantic: 'AI数', denominator_semantic: '总数' },
    teamColors: { 1: '#2a78d6', 2: '#138d75', 3: '#c66b21' },
    selectedPeriodId: 'p2',
  })
  const tooltip = option.tooltip.formatter([
    { seriesName: '团队A', marker: '●', value: 0.4, data: option.series[0].data[1], dataIndex: 1, seriesIndex: 0, axisValue: '2026-02' },
    { seriesName: '团队B', marker: '●', value: 0.5, data: option.series[1].data[1], dataIndex: 1, seriesIndex: 1, axisValue: '2026-02' },
    { seriesName: '团队C', marker: '●', value: null, data: option.series[2].data[1], dataIndex: 1, seriesIndex: 2, axisValue: '2026-02' },
    { seriesName: '全公司均值', marker: '◆', value: 0.35, data: option.series[3].data[1], dataIndex: 1, seriesIndex: 3, axisValue: '2026-02' },
  ])

  assert.equal(option.tooltip.confine, true)
  assert.deepEqual(option.tooltip.position([100, 80], [], null, null, { viewSize: [600, 220], contentSize: [260, 160] }), [112, 52])
  assert.match(tooltip, /差全公司均值 \+5 个百分点/)
  assert.match(tooltip, /较前一周期 \+20 个百分点/)
  assert.match(tooltip, /团队B：50%/)
  assert.match(tooltip, /较前一周期 —/)
  assert.match(tooltip, /较前一周期 \+15 个百分点/)
  assert.doesNotMatch(tooltip, /团队C/)
})

test('trend legend labels empty teams without inventing values and selected mean uses a distinct marker', () => {
  const option = buildTrendOption({
    data: {
      ...data,
      series: [
        { team_id: 1, team_name: '团队A', values: [{ period_id: 'p1', value: 0.5 }, { period_id: 'p2', value: 0.5 }] },
        { team_id: 2, team_name: '团队B', values: [{ period_id: 'p1', value: null }, { period_id: 'p2', value: null }] },
      ],
      company_average: [{ period_id: 'p1', value: 0.5 }, { period_id: 'p2', value: 0.5 }],
    },
    metric: { type: 'penetration' },
    teamColors: { 1: '#2a78d6', 2: '#138d75' },
    selectedPeriodId: 'p2',
  })

  assert.deepEqual(option.legend.data, ['团队A', '团队B', '全公司均值'])
  assert.equal(option.legend.formatter('团队A'), '团队A')
  assert.equal(option.legend.formatter('团队B'), '团队B（无数据）')
  assert.equal(option.series[0].connectNulls, false)
  assert.equal(option.series[1].connectNulls, false)
  assert.equal(option.series[0].data[1].symbol, 'circle')
  assert.equal(option.series[2].data[1].symbol, 'diamond')
})

test('selected months without any team value receive an explicit chart marker', () => {
  const option = buildTrendOption({
    data: {
      periods: [{ id: 'p1', label: '2026-01' }, { id: 'p2', label: '2026-02' }],
      series: [{ team_id: 1, team_name: '团队A', values: [{ period_id: 'p1', value: 0.5 }, { period_id: 'p2', value: null }] }],
      company_average: [{ period_id: 'p1', value: 0.5 }, { period_id: 'p2', value: null }],
    },
    metric: { type: 'penetration' },
    teamColors: { 1: '#2a78d6' },
    selectedPeriodId: 'p2',
  })

  assert.equal(option.series.at(-1).connectNulls, false)
  assert.deepEqual(option.series.at(-1).markLine.data, [{ xAxis: '2026-02' }])
  assert.equal(option.series.at(-1).markLine.label.formatter, '无数据')
  assert.equal(option.series.at(-1).markLine.label.rotate, 0)
})

test('compact trend options reserve plot height while keeping every period label in the axis', () => {
  const option = buildTrendOption({ data, metric: { type: 'penetration' }, teamColors: { 1: '#2a78d6' }, selectedPeriodId: 'all', compact: true })

  assert.equal(option.grid.top, 28)
  assert.equal(option.legend.textStyle.fontSize, 10)
  assert.deepEqual(option.xAxis.data, ['2026-01', '2026-02'])
  assert.equal(option.xAxis.axisLabel.formatter('2026-02'), '26/02')
  assert.equal(option.xAxis.axisLabel.hideOverlap, true)
  assert.equal(option.yAxis.axisLabel.fontSize, 10)
})

test('efficiency outliers use an explicit visual bound while tooltips retain raw values', () => {
  const efficiencyData = {
    periods: [{ id: 'p1', label: '2026-01' }, { id: 'p2', label: '2026-02' }],
    series: [
      { team_id: 1, team_name: '团队A', values: [{ period_id: 'p1', value: 0.5 }, { period_id: 'p2', value: 153.6 }] },
      { team_id: 2, team_name: '团队B', values: [{ period_id: 'p1', value: 0.4 }, { period_id: 'p2', value: 0.6 }] },
    ],
    company_average: [{ period_id: 'p1', value: 0.45 }, { period_id: 'p2', value: 77.1 }],
  }
  const metric = { type: 'efficiency' }
  const option = buildTrendOption({ data: efficiencyData, metric, teamColors: { 1: '#2a78d6', 2: '#138d75' }, selectedPeriodId: 'all' })

  assert.equal(hasEfficiencyOutlier(efficiencyData, metric), true)
  assert.equal(option.yAxis.min, 0)
  assert.equal(option.yAxis.max, 1)
  assert.equal(option.series[0].data[1].value, 1)
  assert.equal(option.series[0].data[1].rawPoint.value, 153.6)
  assert.equal(option.series[0].data[1].symbol, 'triangle')
  assert.equal(option.yAxis.axisPointer.label.show, false)
  assert.equal(efficiencyOutlierAxisLabel(efficiencyData, metric), '0% 至 +100%')
  const tooltip = option.tooltip.formatter({
    seriesName: '团队A', marker: '●', value: 1, data: option.series[0].data[1], dataIndex: 1, seriesIndex: 0, axisValue: '2026-02',
  })
  assert.match(tooltip, /图上值 \+100%；原始值 \+15360%/)
  assert.equal(hasEfficiencyOutlier(efficiencyData, { type: 'penetration' }), false)
})

test('compact efficiency tooltips show the chart boundary, raw value, benchmark difference, and period change', () => {
  const efficiencyData = {
    periods: [{ id: 'p0', label: '2026-06' }, { id: 'p1', label: '2026-07' }],
    series: [{ team_id: 1, team_name: '团队C', values: [{ period_id: 'p0', value: 0.22 }, { period_id: 'p1', value: 155.8, estimated: 77.9, actual: 0 }] }],
    company_average: [{ period_id: 'p0', value: 0.43 }, { period_id: 'p1', value: 39.38 }],
  }
  const option = buildTrendOption({ data: efficiencyData, metric: { type: 'efficiency' }, teamColors: { 1: '#2a78d6' }, selectedPeriodId: 'all', compact: true })
  const tooltip = option.tooltip.formatter({
    seriesName: '团队C', marker: '●', value: 1, data: option.series[0].data[1], dataIndex: 1, seriesIndex: 0, axisValue: '2026-07',
  })
  const tooltipWithBenchmark = option.tooltip.formatter([
    { seriesName: '团队C', marker: '●', value: 1, data: option.series[0].data[1], dataIndex: 1, seriesIndex: 0, axisValue: '2026-07' },
    { seriesName: '全公司均值', marker: '◆', value: 1, data: option.series[1].data[1], dataIndex: 1, seriesIndex: 1, axisValue: '2026-07' },
  ])

  assert.match(tooltip, /2026-07/)
  assert.match(tooltipWithBenchmark, /变化差值单位：百分点（pp）/)
  assert.match(tooltipWithBenchmark, /团队C/)
  assert.match(tooltipWithBenchmark, /\+100%/)
  assert.match(tooltipWithBenchmark, /图上值 \+100%；原始值 \+15580%/)
  assert.match(tooltipWithBenchmark, /均差 \+11642pp/)
  assert.match(tooltipWithBenchmark, /前期 \+15558pp/)
  assert.match(tooltipWithBenchmark, /全公司均值/)
  assert.match(tooltipWithBenchmark, /图上值 \+100%；原始值 \+3938%/)
  assert.match(tooltipWithBenchmark, /前期 \+3895pp/)
  assert.match(tooltipWithBenchmark, /display:grid;gap:2px;margin-top:4px/)
  assert.match(tooltipWithBenchmark, /display:block;margin-left:16px/)
  assert.doesNotMatch(tooltipWithBenchmark, /预估|实际/)
  assert.equal(efficiencyOutlierAxisLabel({ series: [{ values: [{ value: -1.5 }] }] }, { type: 'efficiency' }), '下限 −100%')
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
  assert.equal(option.yAxis.axisPointer.label.show, false)
})

test('insight options keep missing months as disconnected real series', () => {
  const option = buildInsightOption({
    periods: [{ id: '2026-01', label: '01' }, { id: '2026-02', label: '02' }, { id: '2026-03', label: '03' }],
    series: [{ name: '编码开发 · AI率', values: [null, 0, 0.4] }],
    formatValue: (value) => `${Math.round(value * 100)}%`,
  })

  assert.deepEqual(option.xAxis.data, ['01', '02', '03'])
  assert.deepEqual(option.series[0].data, [null, 0, 0.4])
  assert.equal(option.series[0].connectNulls, false)
  assert.equal(option.series[0].endLabel.show, true)
})

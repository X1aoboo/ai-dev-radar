import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { buildInsightOption, buildTrendOption } from './chartOption.js'
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

  assert.equal(option.tooltip.axisPointer.type, 'cross')
  assert.equal(option.series.length, 2)
  assert.equal(option.series[0].lineStyle.width, 2)
  assert.equal(option.series[1].name, '全公司均值')
  assert.equal(option.series[1].lineStyle.type, 'dashed')
  assert.equal(option.series[0].data[1].symbol, 'circle')
  assert.equal(option.series[0].data[0].symbol, 'none')
  assert.equal(option.xAxis.axisLabel.alignMinLabel, 'left')
  assert.equal(option.xAxis.axisLabel.alignMaxLabel, 'right')
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

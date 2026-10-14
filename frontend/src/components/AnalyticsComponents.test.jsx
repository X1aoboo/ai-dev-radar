import assert from 'node:assert/strict'
import { afterEach, expect, test } from 'vitest'
import { act, create } from 'react-test-renderer'

import { AnalyticsDirectory, AnalyticsSection, ChartCard, MaturityMatrix, TeamMatrix, sparklineSegments } from './AnalyticsComponents.jsx'
import MetricKpiCard from './MetricCard.jsx'
import MaturityRadar from '../overview/MaturityRadar.jsx'

let renderer

afterEach(() => {
  renderer?.unmount()
  renderer = undefined
})

test('sparkline splits gaps and scales constant values without invalid coordinates', () => {
  const gapSegments = sparklineSegments([0, 2, null, 3, 5])
  const flatSegments = sparklineSegments([4, 4, 4])

  assert.equal(gapSegments.length, 2)
  assert.equal(flatSegments.length, 1)
  assert.equal(flatSegments[0].line, 'M2.0,9.5 L64.0,9.5 L126.0,9.5')
  assert.equal(Math.round(flatSegments[0].end.y), 10)
  assert.doesNotMatch(flatSegments[0].line, /NaN|Infinity/)
})

test('MetricKpiCard preserves zero, labels its trend, and does not fill missing data', async () => {
  await act(async () => {
    renderer = create(<MetricKpiCard label="AI需求渗透率" value="0%" comparison="3 / 4 团队有事实" delta="环比 +5%" deltaTone="positive" trendValues={[0, 0.2, null, 0.3, 0.4]} trendLabel="需求渗透率趋势" />)
  })

  const valueRow = renderer.root.findByProps({ className: 'metric-card__value-row' })
  assert.equal(valueRow.findByProps({ className: 'metric-card__value' }).children[0], '0%')
  assert.equal(valueRow.findByProps({ className: 'metric-card__delta metric-card__delta--positive' }).children.at(-1), '环比 +5%')
  assert.equal(valueRow.findByProps({ className: 'metric-card__delta-mark' }).props['aria-hidden'], 'true')
  assert.equal(renderer.root.findByProps({ role: 'img' }).props['aria-label'], '需求渗透率趋势')
  assert.equal(renderer.root.findAllByType('path').length, 4)
  assert.equal(renderer.root.findAllByProps({ className: 'metric-card__sparkline-end' }).length, 2)
})

test('MetricKpiCard keeps a neutral trend area when a value and history are missing', async () => {
  await act(async () => {
    renderer = create(<MetricKpiCard label="AI需求渗透率" value="—" comparison="有效团队 0 / 4" />)
  })

  assert.equal(renderer.root.findByProps({ className: 'metric-card__empty-trend' }).props['aria-label'], 'AI需求渗透率暂无趋势数据')
})

test('MetricKpiCard keeps its decorative KPI icon out of the accessibility name', async () => {
  await act(async () => {
    renderer = create(<MetricKpiCard icon={<span>icon</span>} accessory={<span>trend</span>} label="AI需求渗透率" value="50%" />)
  })

  assert.equal(renderer.root.findByProps({ className: 'metric-card__icon' }).props['aria-hidden'], 'true')
  assert.equal(renderer.root.findByProps({ className: 'metric-card__accessory' }).props['aria-hidden'], 'true')
  assert.equal(renderer.root.findByProps({ className: 'metric-card__label' }).children[0], 'AI需求渗透率')
})

test('AnalyticsDirectory exposes selected anchors and named selection controls', async () => {
  let selected
  await act(async () => {
    renderer = create(<AnalyticsDirectory label="能力结构" title="能力结构" selectedId="mr" items={[{ id: 'mr', label: 'MR代码检视' }, { id: 'build', label: '自动化构建部署' }]} onSelect={(id) => { selected = id }} />)
  })

  const buttons = renderer.root.findAllByType('button')
  assert.equal(buttons[0].props['aria-pressed'], true)
  await act(async () => { buttons[1].props.onClick() })
  assert.equal(selected, 'build')
})

test('AnalyticsDirectory exposes a pending selection without replacing the committed item', async () => {
  await act(async () => {
    renderer = create(<AnalyticsDirectory label="活动分析" selectedId="sa" pendingId="se" items={[
      { id: 'sa', label: 'SA设计', meta: '2 个指标' },
      { id: 'se', label: 'SE设计', meta: '2 个指标' },
    ]} />)
  })

  const buttons = renderer.root.findAllByType('button')
  assert.equal(buttons[0].props['aria-pressed'], true)
  assert.equal(buttons[1].props['aria-pressed'], false)
  assert.equal(buttons[1].props['aria-busy'], true)
  assert.equal(renderer.root.findByProps({ role: 'status' }).children[0], '切换中')
})

test('MaturityMatrix keeps evaluated zero separate from unevaluated values', async () => {
  await act(async () => {
    renderer = create(<MaturityMatrix label="团队成熟度" columns={[{ id: 'sa', label: 'SA设计' }]} rows={[
      { id: 'team-a', label: '团队A', values: [{ text: '0.00', level: 0 }] },
      { id: 'team-b', label: '团队B', values: [{ text: null, level: 0 }] },
    ]} />)
  })

  const cells = renderer.root.findAllByType('td')
  assert.equal(cells[0].children[0], '0.00')
  assert.equal(cells[0].props.className, 'maturity-matrix__cell--level-0')
  assert.equal(cells[1].children[0], '未评估')
  assert.equal(cells[1].props.className, 'maturity-matrix__cell--missing')
})

test('MaturityMatrix supports a domain-specific row heading', async () => {
  await act(async () => {
    renderer = create(<MaturityMatrix label="能力成熟度" rowHeading="能力维度" columns={[{ id: 'average', label: '领域平均' }]} rows={[{ id: 'review', label: 'MR代码检视', values: [{ text: '3.00', level: 3 }] }]} />)
  })

  assert.equal(renderer.root.findAllByType('th')[0].children[0], '能力维度')
})

test('Capability radar closes complete seven-axis series but preserves gaps for missing axes', async () => {
  const activities = Array.from({ length: 7 }, (_, index) => ({ activity_id: index + 1, activity_name: `能力${index + 1}` }))
  await act(async () => {
    renderer = create(<MaturityRadar
      layout="capability"
      activities={activities}
      series={[
        { id: 'complete', name: '本期', color: '#1f6feb', values: [1, 2, 3, 4, 5, 4, 3] },
        { id: 'missing', name: '上期', color: '#667085', values: [1, 2, null, 4, 5, 4, 3], dashed: true },
      ]}
    />)
  })

  const series = renderer.root.findAll((node) => String(node.props.className ?? '').includes('maturity-radar__series'))
  assert.equal(series.length, 2)
  assert.equal(series[0].props['data-series-complete'], true)
  const completePoints = series[0].findAllByType('polyline')[0].props.points.trim().split(/\s+/)
  assert.equal(completePoints[0], completePoints.at(-1))
  assert.equal(series[1].props['data-series-complete'], false)
  const incompleteSegments = series[1].findAllByType('polyline').map((line) => line.props.points.trim().split(/\s+/))
  assert.equal(incompleteSegments.length, 2)
  assert.ok(incompleteSegments.every((segment) => segment[0] !== segment.at(-1)))
})

test('TeamMatrix keeps selected teams and direct metric cells accessible', async () => {
  let selected
  await act(async () => {
    renderer = create(<TeamMatrix label="团队表现" selectedId={1} onSelect={(id) => { selected = id }} columns={[{ id: 'penetration', label: 'IR需求渗透率' }]} rows={[
      { id: 'average', label: '全公司均值', kind: 'average', values: [{ text: '42%' }] },
      { id: 1, label: '团队A', kind: 'team', color: '#1f6feb', values: [{ text: '0%' }] },
      { id: 2, label: '团队B', kind: 'team', values: [{ text: null }] },
    ]} />)
  })

  const buttons = renderer.root.findAllByType('button')
  assert.equal(buttons[0].props['aria-label'], '选择团队：团队A')
  assert.equal(buttons[0].props['aria-pressed'], true)
  await act(async () => { buttons[1].props.onClick() })
  assert.equal(selected, 2)
  assert.deepEqual(renderer.root.findAllByType('td').map((node) => {
    const value = node.findAllByType('span')[0]
    return value ? value.children.join('') : node.children.join('')
  }), ['42%', '0%', '—'])
})

test('TeamMatrix exposes relative heatmap levels and keeps unconfigured cells neutral', async () => {
  await act(async () => {
    renderer = create(<TeamMatrix label="MR代码检视团队差异" heatmap columns={[
      { id: 'review-rate', label: 'AI检视率' },
      { id: 'effective-count', label: 'AI有效检视数', unconfigured: true },
    ]} rows={[
      { id: 'average', label: '全公司均值', kind: 'average', values: [{ text: '50%', heatmapLevel: 3 }, { text: '未配置', unconfigured: true, reason: '目录未定义口径。' }] },
    ]} />)
  })

  assert.match(renderer.root.findByType('div').props.className, /team-matrix--heatmap/)
  const cells = renderer.root.findAllByType('td')
  assert.deepEqual(cells.map((cell) => cell.props['data-heatmap-level'] ?? null), [3, null])
  assert.match(cells[1].props.className, /team-matrix__cell--unconfigured/)
  assert.equal(cells[1].props.title, '目录未定义口径。')
})

test('TeamMatrix can show a separate, signed change value for each metric', async () => {
  await act(async () => {
    renderer = create(<TeamMatrix label="团队表现" showChanges columns={[{ id: 'penetration', label: 'AI需求渗透率', context: 'IR需求' }]} rows={[
      { id: 'average', label: '全公司均值', kind: 'average', values: [{ text: '50%', changeText: '+5%', changeTone: 'positive' }] },
      { id: 1, label: '团队A', kind: 'team', values: [{ text: '45%', changeText: '—', changeTone: 'neutral' }] },
    ]} />)
  })

  const headers = renderer.root.findAllByType('th')
  expect(headers[0].children.join('')).toBe('团队')
  expect(headers[1].findByType('span').children.join('')).toBe('AI需求渗透率')
  expect(headers[2].findByProps({ className: 'app-sr-only' }).children.join('')).toBe('指标值')
  expect(headers[3].findByProps({ className: 'app-sr-only' }).children.join('')).toBe('变化')
  expect(renderer.root.findAllByType('td').map((node) => node.children.join(''))).toEqual(['50%', '+5%', '45%', '—'])
  expect(renderer.root.findByProps({ className: 'team-matrix__change team-matrix__change--positive' })).toBeDefined()
})

test('TeamMatrix can center visible value/change headings in fixed grouped columns', async () => {
  await act(async () => {
    renderer = create(<TeamMatrix label="页面整体 IR 团队差异" showChanges visibleChangeHeaders groupedChangeLayout columns={[
      { id: 'penetration', label: 'AI需求渗透率' },
      { id: 'efficiency', label: 'AI研发提效' },
    ]} rows={[
      { id: 'average', label: '全公司均值', kind: 'average', values: [{ text: '50%', changeText: '0pp' }, { text: '+100%', changeText: '0pp' }] },
    ]} />)
  })

  const table = renderer.root.findByType('table')
  assert.match(table.props.className, /team-matrix__table--grouped/)
  assert.equal(renderer.root.findAllByType('col').length, 5)
  const subheaders = renderer.root.findAllByType('thead')[0].findAllByType('tr')[1].findAllByType('th')
  assert.deepEqual(subheaders.map((header) => header.findByType('span').children.join('')), ['指标值', '变化', '指标值', '变化'])
})

test('ChartCard and AnalyticsSection expose named, stable regions', async () => {
  await act(async () => {
    renderer = create(<><AnalyticsSection title="核心趋势" description="按单一指标比较。"><ChartCard title="AI需求渗透率" empty="当前月暂无事实。" /></AnalyticsSection></>)
  })

  assert.equal(renderer.root.findAllByType('h2').map((node) => node.children.join(' ')).join(' / '), '核心趋势 / AI需求渗透率')
  assert.equal(renderer.root.findByProps({ role: 'status' }).children.join(''), '当前月暂无事实。')
})

test('ChartCard reserves the configured plot height when data is missing', async () => {
  await act(async () => {
    renderer = create(<ChartCard title="AI趋势" height={120} reservePlotSpace empty="暂无事实。" />)
  })

  const plot = renderer.root.findByProps({ className: 'analytics-chart-card__plot-state' })
  assert.deepEqual(plot.props.style, { height: 120 })
  assert.equal(plot.findByProps({ role: 'status' }).children.join(''), '暂无事实。')
})

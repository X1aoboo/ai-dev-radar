import assert from 'node:assert/strict'
import { afterEach, test } from 'vitest'
import { act, create } from 'react-test-renderer'

import { AnalyticsDirectory, AnalyticsSection, ChartCard, MaturityMatrix, TeamMatrix, sparklineSegments } from './AnalyticsComponents.jsx'
import MetricKpiCard from './MetricCard.jsx'

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
  assert.doesNotMatch(flatSegments[0].line, /NaN|Infinity/)
})

test('MetricKpiCard preserves zero, labels its trend, and does not fill missing data', async () => {
  await act(async () => {
    renderer = create(<MetricKpiCard label="AI需求渗透率" value="0%" comparison="3 / 4 团队有事实" trendValues={[0, 0.2, null, 0.3, 0.4]} trendLabel="需求渗透率趋势" />)
  })

  assert.equal(renderer.root.findByProps({ className: 'metric-card__value' }).children[0], '0%')
  assert.equal(renderer.root.findByProps({ role: 'img' }).props['aria-label'], '需求渗透率趋势')
  assert.equal(renderer.root.findAllByType('path').length, 4)
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
  assert.deepEqual(renderer.root.findAllByType('td').map((node) => node.children.join('')), ['42%', '0%', '—'])
})

test('ChartCard and AnalyticsSection expose named, stable regions', async () => {
  await act(async () => {
    renderer = create(<><AnalyticsSection title="核心趋势" description="按单一指标比较。"><ChartCard title="AI需求渗透率" empty="当前月暂无事实。" /></AnalyticsSection></>)
  })

  assert.equal(renderer.root.findAllByType('h2').map((node) => node.children.join(' ')).join(' / '), '核心趋势 / AI需求渗透率')
  assert.equal(renderer.root.findByProps({ role: 'status' }).children.join(''), '当前月暂无事实。')
})

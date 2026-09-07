// 变体 A：团队 × 活动 热力图矩阵。行内 min-max 归一化 → 顺序蓝 ramp；
// 效率提升可能为负，仍按行内相对深浅着色（负值文本红色如实展示）；布尔行不着色只用文本。
import EChart from '../components/EChart'
import { T, SEQ, seqColor, inkOn } from '../theme'
import { ACTIVITIES, TEAMS } from '../data/catalog'
import {
  activityMetric, currentPeriod, factText, fmtValue, periodsFor, sumsFor,
  valueOf, sourceText, genFallbackFilter,
} from '../data/compute'

function HeatSection({ activities, filter, slot, nav }) {
  const periods = periodsFor(filter)
  const period = currentPeriod(filter, periods)
  const rows = activities.map((a) => {
    const m = activityMetric(a, slot)
    const cells = TEAMS.map((t) => ({
      team: t,
      v: valueOf(a.id, m.id, t.id, filter, period),
      s: m.type === 'bool' ? null : sumsFor(t.id, a.id, m.id, filter, period),
    }))
    return { a, m, cells }
  })

  const data = []
  rows.forEach((row, yi) => {
    const nums = row.cells.map((c) => c.v).filter((v) => typeof v === 'number')
    const min = nums.length ? Math.min(...nums) : 0
    const max = nums.length ? Math.max(...nums) : 1
    row.cells.forEach((c, xi) => {
      let color = T.neutral
      if (row.m.type === 'bool') color = c.v === true ? '#b7d3f6' : '#f0efec'
      else if (typeof c.v === 'number') color = seqColor(max > min ? (c.v - min) / (max - min) : 0.5)
      const disp = fmtValue(row.m, c.v)
      const tip = [
        `${c.team.name} · ${row.a.name}`,
        `${row.m.name}：${disp}`,
        row.m.type === 'bool' ? '' : factText(row.m, c.s),
        row.m.type === 'bool' ? '' : `来源：${sourceText(c.team.id, row.a.id, row.m.id)}`,
      ].filter(Boolean).join('<br/>')
      data.push({
        value: [xi, yi, typeof c.v === 'number' ? +c.v.toFixed(4) : 0],
        disp, tip, teamId: c.team.id, activityId: row.a.id,
        itemStyle: { color },
        label: { color: inkOn(color) },
      })
    })
  })

  const option = {
    grid: { left: 8, right: 8, top: 6, bottom: 4, containLabel: true },
    tooltip: { formatter: (p) => p.data.tip },
    // ECharts 热力图必须配 visualMap；颜色实际由每个数据格的 itemStyle（行内归一化）决定
    visualMap: { show: false, min: 0, max: 1, inRange: { color: SEQ } },
    xAxis: {
      type: 'category', data: TEAMS.map((t) => t.name),
      axisLine: { lineStyle: { color: T.axis } }, axisTick: { show: false },
      axisLabel: { color: T.ink2, fontSize: 12 },
      splitArea: { show: false },
    },
    yAxis: {
      type: 'category', data: rows.map((r) => r.a.name),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: T.ink2, fontSize: 12 },
    },
    series: [{
      type: 'heatmap',
      data,
      label: { show: true, fontSize: 11, formatter: (p) => p.data.disp },
      itemStyle: { borderColor: T.surface, borderWidth: 2, borderRadius: 3 },
      emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.25)' } },
    }],
  }

  return (
    <div className="card">
      <EChart option={option} height={rows.length * 38 + 44} onClick={(p) => p.data && nav(p.data.teamId)} />
    </div>
  )
}

export default function VariantAHeatmap({ filter, nav }) {
  const keyActs = ACTIVITIES.filter((a) => a.kind === 'key')
  const genActs = ACTIVITIES.filter((a) => a.kind === 'general')
  const genFilter = genFallbackFilter()
  const iterMode = filter.dim === 'iter'
  return (
    <div>
      <h2 className="sec">关键研发活动</h2>
      <HeatSection activities={keyActs} filter={filter} slot={filter.metricSlot} nav={nav} />
      <h2 className="sec">
        通用研发能力
        {iterMode && <span className="badge">无迭代维度 · 固定按月 · 周期 2026-08</span>}
      </h2>
      <HeatSection activities={genActs} filter={genFilter} slot={filter.metricSlot} nav={nav} />
    </div>
  )
}

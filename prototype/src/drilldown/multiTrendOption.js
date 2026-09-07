// 总览页多团队趋势大图：4 团队固定 categorical 色（颜色跟随团队，不随筛选重排）+ 全公司均值灰
import { T } from '../theme'
import { fmtValue } from '../data/compute'

export const TEAM_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'] // t1–t4 固定（dataviz categorical 1–4 槽）

const axisFmt = (metric, v) =>
  metric.type === 'penetration' || metric.type === 'ratio' || metric.type === 'efficiency'
    ? `${Math.round(v * 100)}`
    : `${v}`

export function multiTrendOption({ labels, rows, metric }) {
  const fmt = (v) => (typeof v === 'number' ? fmtValue(metric, v) : '—')
  return {
    grid: { left: 8, right: 12, top: 26, bottom: 2, containLabel: true },
    legend: { top: 0, right: 0, itemWidth: 14, itemHeight: 8, textStyle: { color: T.ink2, fontSize: 11.5 } },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: T.axis } },
      valueFormatter: (v) => fmt(v),
    },
    xAxis: {
      type: 'category', data: labels, boundaryGap: false,
      axisLine: { lineStyle: { color: T.axis } }, axisTick: { show: false },
      axisLabel: { color: T.muted, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: T.grid, width: 1 } },
      axisLabel: { color: T.muted, fontSize: 11, formatter: (v) => axisFmt(metric, v) },
    },
    series: rows.map((r) => ({
      name: r.name, type: 'line', data: r.values,
      color: r.color, lineStyle: { width: 2, cap: 'round', join: 'round' },
      itemStyle: { color: r.color }, symbol: 'circle', symbolSize: 8, showSymbol: false,
      emphasis: { focus: 'series', showSymbol: true },
    })),
  }
}

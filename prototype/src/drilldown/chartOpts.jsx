// 下钻页共享的 ECharts 配置：折线（本团队 accent vs 全公司均值 de-emphasis 灰）+ 迭代对比条形
import { T } from '../theme'
import { fmtValue } from '../data/compute'

const axisFmt = (metric, v) =>
  metric.type === 'penetration' || metric.type === 'ratio' || metric.type === 'efficiency'
    ? `${Math.round(v * 100)}`
    : `${v}`

export function trendOption({ labels, self, avg, metric }) {
  const fmt = (v) => (typeof v === 'number' ? fmtValue(metric, v) : '—')
  return {
    grid: { left: 8, right: 46, top: 26, bottom: 2, containLabel: true },
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
    series: [
      {
        name: '本团队', type: 'line', data: self,
        color: T.accent, lineStyle: { width: 2, cap: 'round', join: 'round' },
        itemStyle: { color: T.accent }, symbol: 'circle', symbolSize: 8, showSymbol: false,
        emphasis: { focus: 'series', showSymbol: true },
        endLabel: { show: true, formatter: (p) => fmt(p.value), color: T.ink2, fontSize: 11 },
      },
      {
        name: '全公司均值', type: 'line', data: avg,
        color: T.gray, lineStyle: { width: 2, cap: 'round', join: 'round' },
        itemStyle: { color: T.gray }, symbol: 'none',
        emphasis: { focus: 'series', showSymbol: true },
      },
    ],
  }
}

export function iterCompareOption({ iterLabels, self, avg, metric }) {
  const fmt = (v) => (typeof v === 'number' ? fmtValue(metric, v) : '—')
  return {
    grid: { left: 8, right: 8, top: 26, bottom: 2, containLabel: true },
    legend: { top: 0, right: 0, itemWidth: 14, itemHeight: 8, textStyle: { color: T.ink2, fontSize: 11.5 } },
    tooltip: { trigger: 'axis', valueFormatter: (v) => fmt(v) },
    xAxis: {
      type: 'category', data: iterLabels,
      axisLine: { lineStyle: { color: T.axis } }, axisTick: { show: false },
      axisLabel: { color: T.muted, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: T.grid, width: 1 } },
      axisLabel: { color: T.muted, fontSize: 11, formatter: (v) => axisFmt(metric, v) },
    },
    series: [
      {
        name: '本团队', type: 'bar', data: self, barWidth: 16,
        color: T.accent, itemStyle: { color: T.accent, borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '全公司均值', type: 'bar', data: avg, barWidth: 16,
        color: T.gray, itemStyle: { color: T.gray, borderRadius: [4, 4, 0, 0] }, barGap: '25%',
      },
    ],
  }
}

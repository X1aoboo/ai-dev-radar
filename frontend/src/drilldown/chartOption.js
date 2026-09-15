import { DATAVIZ_COLORS, formatFactSummary, formatMetricValue } from '../overview/overviewLogic.js'

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function chartPoint(point, periodId) {
  const selected = point && String(point.period_id) === String(periodId)
  return {
    value: point?.value ?? null,
    periodId: point?.period_id,
    rawPoint: point,
    symbol: selected ? 'circle' : 'none',
    symbolSize: selected ? 8 : 0,
  }
}

function axisValue(metric, value) {
  return formatMetricValue(metric, value)
}

function tooltipFormatter(metric, params) {
  const items = Array.isArray(params) ? params : [params]
  const periodLabel = items[0]?.axisValue ?? ''
  const lines = items.map((item) => {
    const point = item.data?.rawPoint
    const value = point?.value ?? item.value
    const fact = point && item.seriesName === '本团队'
      ? ` · ${formatFactSummary(metric, point)}`
      : ''
    return `${item.marker}${escapeHtml(item.seriesName)}：${escapeHtml(formatMetricValue(metric, value))}${escapeHtml(fact)}`
  })
  return [`<strong>${escapeHtml(periodLabel)}</strong>`, ...lines].join('<br/>')
}

function yAxis(metric) {
  return {
    type: 'value',
    min: metric.type === 'penetration' || metric.type === 'ratio' ? 0 : undefined,
    max: metric.type === 'penetration' || metric.type === 'ratio' ? 1 : undefined,
    splitLine: { lineStyle: { color: DATAVIZ_COLORS.grid, width: 1 } },
    axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 11, formatter: (value) => axisValue(metric, value) },
  }
}

export function buildTeamTrendOption({ data, metric, teamId, selectedPeriodId, accent }) {
  const teamSeries = (data?.series ?? []).find((series) => String(series.team_id) === String(teamId))
  const teamPoints = teamSeries?.values ?? []
  const companyPoints = data?.company_average ?? []

  return {
    animationDuration: 180,
    grid: { left: 12, right: 16, top: 34, bottom: 10, containLabel: true },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: DATAVIZ_COLORS.inkSecondary, fontSize: 11 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', lineStyle: { color: DATAVIZ_COLORS.axis }, crossStyle: { color: DATAVIZ_COLORS.axis } },
      formatter: (params) => tooltipFormatter(metric, params),
    },
    xAxis: {
      type: 'category',
      data: (data?.periods ?? []).map((period) => period.label),
      boundaryGap: false,
      axisLine: { lineStyle: { color: DATAVIZ_COLORS.axis } },
      axisTick: { show: false },
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 11, hideOverlap: true },
    },
    yAxis: yAxis(metric),
    series: [
      {
        name: '本团队',
        type: 'line',
        data: teamPoints.map((point) => chartPoint(point, selectedPeriodId)),
        color: accent,
        lineStyle: { width: 2, cap: 'round', join: 'round' },
        itemStyle: { color: accent },
        symbol: 'circle',
        showSymbol: selectedPeriodId !== 'all',
        emphasis: { focus: 'series', showSymbol: true },
      },
      {
        name: '全公司均值',
        type: 'line',
        data: companyPoints.map((point) => chartPoint(point, selectedPeriodId)),
        color: DATAVIZ_COLORS.companyAverage,
        lineStyle: { width: 2, type: 'dashed', cap: 'round' },
        itemStyle: { color: DATAVIZ_COLORS.companyAverage },
        symbol: 'circle',
        showSymbol: selectedPeriodId !== 'all',
        emphasis: { focus: 'series', showSymbol: true },
      },
    ],
  }
}

export function buildIterationCompareOption({ data, metric, teamId, accent }) {
  const teamSeries = (data?.series ?? []).find((series) => String(series.team_id) === String(teamId))
  const teamPoints = teamSeries?.values ?? []
  const companyPoints = data?.company_average ?? []
  const pointValue = (point) => point?.value ?? null

  return {
    animationDuration: 180,
    grid: { left: 12, right: 12, top: 34, bottom: 10, containLabel: true },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: DATAVIZ_COLORS.inkSecondary, fontSize: 11 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value) => formatMetricValue(metric, value),
    },
    xAxis: {
      type: 'category',
      data: (data?.periods ?? []).map((period) => period.label),
      axisLine: { lineStyle: { color: DATAVIZ_COLORS.axis } },
      axisTick: { show: false },
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 11, hideOverlap: true },
    },
    yAxis: yAxis(metric),
    series: [
      {
        name: '本团队',
        type: 'bar',
        data: teamPoints.map(pointValue),
        barWidth: 18,
        itemStyle: { color: accent, borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '全公司均值',
        type: 'bar',
        data: companyPoints.map(pointValue),
        barWidth: 18,
        itemStyle: { color: DATAVIZ_COLORS.companyAverage, borderRadius: [4, 4, 0, 0] },
        barGap: '25%',
      },
    ],
  }
}

import { DATAVIZ_COLORS, formatFactSummary, formatMetricValue } from './overviewLogic.js'

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function axisValue(metric, value) {
  return formatMetricValue(metric, value)
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

function isCountMetric(metric, countAsBars) {
  return countAsBars && metric.type === 'count'
}

function buildTeamSeries({ series, metric, teamColors, selectedPeriodId, countAsBars }) {
  const color = teamColors[String(series.team_id)]
  const data = (series.values ?? []).map((point) => chartPoint(point, selectedPeriodId))
  if (isCountMetric(metric, countAsBars)) {
    return {
      name: series.team_name,
      type: 'bar',
      data,
      color,
      itemStyle: { color, borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 24,
      barGap: '25%',
    }
  }

  return {
    name: series.team_name,
    type: 'line',
    data,
    color,
    lineStyle: { width: 2.5, cap: 'round', join: 'round' },
    itemStyle: { color },
    symbol: 'circle',
    showSymbol: selectedPeriodId !== 'all',
    emphasis: { focus: 'series', showSymbol: true },
  }
}

export function buildTrendOption({ data, metric, teamColors, selectedPeriodId, countAsBars = false, averageLabel = '全公司均值' }) {
  const countMetric = isCountMetric(metric, countAsBars)
  const teamSeries = (data?.series ?? []).map((series) => (
    buildTeamSeries({ series, metric, teamColors, selectedPeriodId, countAsBars })
  ))
  const companyColor = DATAVIZ_COLORS.companyAverage
  const companyData = (data?.company_average ?? []).map((point) => chartPoint(point, selectedPeriodId))
  const companySeries = {
    name: averageLabel,
    type: 'line',
    data: companyData,
    color: companyColor,
    lineStyle: { width: 2.5, type: 'dashed', cap: 'round' },
    itemStyle: { color: companyColor },
    symbol: 'circle',
    showSymbol: selectedPeriodId !== 'all',
    emphasis: { focus: 'series', showSymbol: true },
  }

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
      axisPointer: countMetric
        ? { type: 'shadow' }
        : {
            type: 'cross',
            lineStyle: { color: DATAVIZ_COLORS.axis },
            crossStyle: { color: DATAVIZ_COLORS.axis },
          },
      formatter: (params) => {
        const items = Array.isArray(params) ? params : [params]
        const periodLabel = items[0]?.axisValue ?? ''
        const lines = items.map((item) => {
          const point = item.data?.rawPoint
          const value = point?.value ?? item.value
          const fact = point && item.seriesName !== averageLabel
            ? ` · ${formatFactSummary(metric, point)}`
            : ''
          return `${item.marker}${escapeHtml(item.seriesName)}：${escapeHtml(formatMetricValue(metric, value))}${escapeHtml(fact)}`
        })
        return [`<strong>${escapeHtml(periodLabel)}</strong>`, ...lines].join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      data: (data?.periods ?? []).map((period) => period.label),
      boundaryGap: countMetric,
      axisLine: { lineStyle: { color: DATAVIZ_COLORS.axis } },
      axisTick: { show: false },
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 11, hideOverlap: true, alignMinLabel: 'left', alignMaxLabel: 'right' },
    },
    yAxis: {
      type: 'value',
      min: metric.type === 'penetration' || metric.type === 'ratio' ? 0 : undefined,
      max: metric.type === 'penetration' || metric.type === 'ratio' ? 1 : undefined,
      splitLine: { lineStyle: { color: DATAVIZ_COLORS.grid, width: 1 } },
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 11, formatter: (value) => axisValue(metric, value) },
    },
    series: [...teamSeries, companySeries],
  }
}

export function buildInsightOption({ periods = [], series = [], formatValue = (value) => String(value), yMin, yMax }) {
  const periodLabels = periods.map((period) => period.label ?? period.id ?? period)
  return {
    animationDuration: 180,
    grid: { left: 8, right: 12, top: 8, bottom: 24, containLabel: true },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const items = (Array.isArray(params) ? params : [params]).filter((item) => item.value !== null && item.value !== undefined)
        if (!items.length) return ''
        return [`<strong>${escapeHtml(items[0].axisValue ?? '')}</strong>`, ...items.map((item) => `${item.marker}${escapeHtml(item.seriesName)}：${escapeHtml(formatValue(item.value, item.seriesIndex))}`)].join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      data: periodLabels,
      axisLine: { lineStyle: { color: DATAVIZ_COLORS.axis } },
      axisTick: { show: false },
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 10, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      min: yMin,
      max: yMax,
      splitLine: { lineStyle: { color: DATAVIZ_COLORS.grid } },
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 10, formatter: (value) => formatValue(value, 0) },
    },
    series: series.map((entry) => ({
      name: entry.name,
      type: 'line',
      data: entry.values,
      color: entry.color ?? DATAVIZ_COLORS.team[0],
      connectNulls: false,
      showSymbol: true,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2.5, cap: 'round', join: 'round' },
      itemStyle: { color: entry.color ?? DATAVIZ_COLORS.team[0] },
      endLabel: { show: series.length < 4, formatter: '{a}', color: DATAVIZ_COLORS.inkSecondary, fontSize: 10 },
      labelLayout: { moveOverlap: 'shiftY' },
    })),
  }
}

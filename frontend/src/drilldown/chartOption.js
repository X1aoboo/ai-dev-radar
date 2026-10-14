import { DATAVIZ_COLORS, formatFactSummary, formatMetricValue } from '../overview/overviewLogic.js'
import { buildTrendOption, hasEfficiencyOutlier } from '../overview/chartOption.js'

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

function yAxis(metric, bounds = {}) {
  return {
    type: 'value',
    min: ['penetration', 'ratio'].includes(metric.type) ? 0 : bounds.min,
    max: ['penetration', 'ratio'].includes(metric.type) ? 1 : bounds.max,
    splitLine: { lineStyle: { color: DATAVIZ_COLORS.grid, width: 1 } },
    axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 11, formatter: (value) => axisValue(metric, value) },
  }
}

export function buildTeamTrendOption({ data, metric, teamId, selectedPeriodId, accent, averageLabel = '有事实团队等权均值' }) {
  const teamSeries = (data?.series ?? []).find((series) => String(series.team_id) === String(teamId))
  const selectedData = { ...data, series: teamSeries ? [teamSeries] : [] }
  const option = buildTrendOption({ data: selectedData, metric, teamColors: { [String(teamId)]: accent }, selectedPeriodId, averageLabel, compact: true, showPointMarkers: true })
  return { ...option, grid: { ...option.grid, top: 22, bottom: 4 } }
}

export function buildIterationCompareOption({ data, metric, teamId, accent, averageLabel = '有事实团队等权均值' }) {
  const teamSeries = (data?.series ?? []).find((series) => String(series.team_id) === String(teamId))
  const teamPoints = teamSeries?.values ?? []
  const companyPoints = data?.company_average ?? []
  const hasOutlier = hasEfficiencyOutlier(data, metric)
  const overflowLimit = hasOutlier ? 1 : null
  const allValues = [...teamPoints, ...companyPoints].map((point) => point?.value).filter(Number.isFinite)
  const bounds = overflowLimit === null ? {} : {
    min: allValues.some((value) => value < -overflowLimit) ? -overflowLimit : 0,
    max: allValues.some((value) => value > overflowLimit) ? overflowLimit : 0,
  }
  const pointValue = (point) => {
    const rawValue = point?.value
    const value = Number.isFinite(rawValue) && overflowLimit !== null
      ? Math.max(-overflowLimit, Math.min(overflowLimit, rawValue))
      : rawValue ?? null
    return { value, rawPoint: point }
  }

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
      formatter: (params) => {
        const items = Array.isArray(params) ? params : [params]
        const periodLabel = items[0]?.axisValue ?? ''
        const lines = items.map((item) => {
          const point = item.data?.rawPoint
          const rawValue = point?.value ?? item.value
          const plottedValue = item.value ?? rawValue
          const clippedNote = Number.isFinite(rawValue) && Number.isFinite(plottedValue) && rawValue !== plottedValue
            ? `（图上限 ${escapeHtml(formatMetricValue(metric, plottedValue))}，原值 ${escapeHtml(formatMetricValue(metric, rawValue))}）`
            : ''
          const fact = point && item.seriesName === '本团队' ? ` · ${escapeHtml(formatFactSummary(metric, point))}` : ''
          return `${item.marker}<strong>${escapeHtml(item.seriesName)}：${escapeHtml(formatMetricValue(metric, rawValue))}${clippedNote}</strong>${fact}`
        })
        return [`<strong>${escapeHtml(periodLabel)}</strong>`, ...lines].join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      data: (data?.periods ?? []).map((period) => period.label),
      axisLine: { lineStyle: { color: DATAVIZ_COLORS.axis } },
      axisTick: { show: false },
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 11, hideOverlap: true, alignMinLabel: 'left', alignMaxLabel: 'right' },
    },
    yAxis: yAxis(metric, bounds),
    series: [
      {
        name: '本团队',
        type: 'bar',
        data: teamPoints.map(pointValue),
        barWidth: 18,
        itemStyle: { color: accent, borderRadius: [4, 4, 0, 0] },
      },
      {
        name: averageLabel,
        type: 'bar',
        data: companyPoints.map(pointValue),
        barWidth: 18,
        itemStyle: { color: DATAVIZ_COLORS.companyAverage, borderRadius: [4, 4, 0, 0] },
        barGap: '25%',
      },
    ],
  }
}

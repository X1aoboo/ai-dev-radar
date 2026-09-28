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

function formatDifference(metric, difference) {
  if (['penetration', 'ratio', 'efficiency'].includes(metric.type)) {
    const points = Math.round(difference * 100)
    return `${points > 0 ? '+' : ''}${points} 个百分点`
  }
  const value = formatMetricValue(metric, difference)
  return difference > 0 ? `+${value}` : value
}

function chartPoint(point, periodId, metric, selectedMarker, overflowLimit = null, showPointMarker = false) {
  const selected = point && String(point.period_id) === String(periodId)
  const value = point?.value
  const overflow = Number.isFinite(value) && overflowLimit !== null && Math.abs(value) > overflowLimit
  const showMarker = overflow || selected || (showPointMarker && Number.isFinite(value))
  return {
    value: overflow ? Math.sign(value) * overflowLimit : value ?? null,
    periodId: point?.period_id,
    rawPoint: point,
    symbol: overflow ? 'triangle' : showMarker ? selectedMarker : 'none',
    symbolSize: overflow || selected ? 8 : showPointMarker && Number.isFinite(value) ? 5 : 0,
  }
}

function isCountMetric(metric, countAsBars) {
  return countAsBars && metric.type === 'count'
}

export function hasEfficiencyOutlier(data, metric) {
  return metric?.type === 'efficiency' && [
    ...(data?.series ?? []).flatMap((series) => series.values ?? []),
    ...(data?.company_average ?? []),
  ].some((point) => Number.isFinite(point?.value) && Math.abs(point.value) > 1)
}

export function efficiencyOutlierAxisLabel(data, metric) {
  if (!hasEfficiencyOutlier(data, metric)) return null
  const values = [
    ...(data?.series ?? []).flatMap((series) => series.values ?? []),
    ...(data?.company_average ?? []),
  ].map((point) => point?.value).filter(Number.isFinite)
  const hasNegativeOverflow = values.some((value) => value < -1)
  const hasPositiveOverflow = values.some((value) => value > 1)
  if (hasNegativeOverflow && hasPositiveOverflow) return '−100% 至 +100%'
  if (hasPositiveOverflow) return '0% 至 +100%'
  return '下限 −100%'
}

function buildTeamSeries({ series, metric, teamColors, selectedPeriodId, countAsBars, overflowLimit, showPointMarkers, lineWidth }) {
  const color = teamColors[String(series.team_id)]
  const data = (series.values ?? []).map((point) => chartPoint(point, selectedPeriodId, metric, 'circle', overflowLimit, showPointMarkers))
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
    lineStyle: { width: lineWidth, cap: 'round', join: 'round' },
    itemStyle: { color },
    symbol: 'circle',
    symbolSize: 6,
    connectNulls: false,
    showSymbol: showPointMarkers || selectedPeriodId !== 'all' || overflowLimit !== null,
    emphasis: { focus: 'series', showSymbol: true },
  }
}

export function buildTrendOption({ data, metric, teamColors, selectedPeriodId, countAsBars = false, averageLabel = '全公司均值', compact = false, showPointMarkers = false, tooltipTrigger = 'axis' }) {
  const countMetric = isCountMetric(metric, countAsBars)
  const allValues = [
    ...(data?.series ?? []).flatMap((series) => series.values ?? []),
    ...(data?.company_average ?? []),
  ].map((point) => point?.value).filter(Number.isFinite)
  const overflowLimit = hasEfficiencyOutlier(data, metric) ? 1 : null
  const teamLineWidth = (data?.series?.length ?? 0) <= 1 ? 2.5 : 2
  const teamSeries = (data?.series ?? []).map((series) => (
    buildTeamSeries({ series, metric, teamColors, selectedPeriodId, countAsBars, overflowLimit, showPointMarkers, lineWidth: teamLineWidth })
  ))
  const companyColor = DATAVIZ_COLORS.companyAverage
  const companyData = (data?.company_average ?? []).map((point) => chartPoint(point, selectedPeriodId, metric, 'diamond', overflowLimit, showPointMarkers))
  const selectedIndex = (data?.periods ?? []).findIndex((period) => String(period.id) === String(selectedPeriodId))
  const selectedHasValue = selectedIndex >= 0 && [
    ...(data?.series ?? []).map((series) => series.values?.[selectedIndex]?.value),
    data?.company_average?.[selectedIndex]?.value,
  ].some(Number.isFinite)
  const selectedMissingLabel = selectedIndex >= 0 && selectedPeriodId !== 'all' && !selectedHasValue
    ? data.periods[selectedIndex].label ?? String(selectedPeriodId)
    : null
  const companySeries = {
    name: averageLabel,
    type: 'line',
    data: companyData,
    color: companyColor,
    lineStyle: { width: 2.25, type: 'dashed', cap: 'round' },
    itemStyle: { color: companyColor },
    symbol: 'diamond',
    symbolSize: 7,
    connectNulls: false,
    showSymbol: showPointMarkers || selectedPeriodId !== 'all' || overflowLimit !== null,
    emphasis: { focus: 'series', showSymbol: true },
    ...(selectedMissingLabel ? {
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: DATAVIZ_COLORS.axis, type: 'dashed', width: 1 },
        label: { show: true, formatter: '无数据', position: 'insideEndTop', color: DATAVIZ_COLORS.muted, fontSize: 10, rotate: 0 },
        data: [{ xAxis: selectedMissingLabel }],
      },
    } : {}),
  }
  const missingTeamNames = new Set((data?.series ?? [])
    .filter((series) => !(series.values ?? []).some((point) => Number.isFinite(point?.value)))
    .map((series) => series.team_name))
  const legendData = [
    ...(data?.series ?? []).map((series) => series.team_name),
    ...((data?.company_average ?? []).some((point) => Number.isFinite(point?.value)) ? [averageLabel] : []),
  ]
  const hasNegativeOverflow = overflowLimit !== null && allValues.some((value) => value < -overflowLimit)
  const hasPositiveOverflow = overflowLimit !== null && allValues.some((value) => value > overflowLimit)
  const axisFontSize = compact ? 11 : 12

  return {
    animationDuration: 180,
    grid: { left: 12, right: 16, top: compact ? 28 : 34, bottom: compact ? 8 : 10, containLabel: true },
    legend: {
      top: 0,
      right: 0,
      data: legendData,
      formatter: (name) => missingTeamNames.has(name) ? `${name}（无数据）` : name,
      itemWidth: compact ? 12 : 14,
      itemHeight: compact ? 6 : 8,
      textStyle: { color: DATAVIZ_COLORS.inkSecondary, fontSize: axisFontSize },
    },
    tooltip: {
      trigger: tooltipTrigger,
      confine: true,
      ...(compact ? { extraCssText: 'max-width: 360px; white-space: normal; line-height: 1.3; font-size: 12px;' } : {}),
      position: (point, _params, _dom, _rect, size) => [
        Math.max(8, Math.min(point[0] + 12, size.viewSize[0] - size.contentSize[0] - 8)),
        Math.max(34, Math.min(point[1] + 12, size.viewSize[1] - size.contentSize[1] - 8)),
      ],
      axisPointer: countMetric
        ? { type: 'shadow' }
        : {
            type: 'cross',
            label: { show: false },
            lineStyle: { color: DATAVIZ_COLORS.axis },
            crossStyle: { color: DATAVIZ_COLORS.axis },
          },
      formatter: (params) => {
        const items = (Array.isArray(params) ? params : [params])
          .filter((item) => Number.isFinite(item.data?.rawPoint?.value ?? item.value))
        const displayValue = (item) => {
          const rawValue = item.data?.rawPoint?.value ?? item.value
          const plottedValue = item.value ?? rawValue
          const clipped = Number.isFinite(rawValue) && Number.isFinite(plottedValue) && rawValue !== plottedValue
          return {
            rawValue,
            label: clipped
              ? `图上值 ${formatMetricValue(metric, plottedValue)}；原始值 ${formatMetricValue(metric, rawValue)}`
              : formatMetricValue(metric, plottedValue),
          }
        }
        const tooltipPoint = items[0]?.data?.rawPoint
        const tooltipPeriodId = tooltipPoint?.period_id ?? items[0]?.data?.periodId
        const periodLabel = items[0]?.axisValue ?? data?.periods?.find((period) => String(period.id) === String(tooltipPeriodId))?.label ?? ''
        if (!items.length) return escapeHtml(periodLabel)
        if (compact) {
          const percentageMetric = ['penetration', 'ratio', 'efficiency'].includes(metric.type)
          const unitNote = percentageMetric ? '<br/><small>变化差值单位：百分点（pp）</small>' : ''
          const rows = items.map((item) => {
            const { rawValue, label } = displayValue(item)
            const isAverage = item.seriesName === averageLabel
            const periodId = item.data?.rawPoint?.period_id ?? data?.periods?.[item.dataIndex]?.id
            const periodIndex = data?.periods?.findIndex((period) => String(period.id) === String(periodId)) ?? -1
            const previousPeriodId = periodIndex > 0 ? data.periods[periodIndex - 1]?.id : null
            const companyValue = data?.company_average?.find((entry) => String(entry.period_id) === String(periodId))?.value
            const teamSeries = data?.series?.[item.seriesIndex] ?? data?.series?.find((series) => series.team_name === item.seriesName)
            const points = isAverage ? data?.company_average : teamSeries?.values
            const previousValue = previousPeriodId === null ? null : points?.find((entry) => String(entry.period_id) === String(previousPeriodId))?.value
            const details = []
            const difference = (value) => percentageMetric
              ? formatDifference(metric, value).replace(' 个百分点', 'pp')
              : formatDifference(metric, value)
            if (!isAverage) details.push(`均差 ${Number.isFinite(companyValue) ? difference(rawValue - companyValue) : '—'}`)
            details.push(`前期 ${Number.isFinite(previousValue) ? difference(rawValue - previousValue) : '—'}`)
            return `<div style="padding:2px 0">${item.marker}<strong>${escapeHtml(item.seriesName)}：${escapeHtml(label)}</strong><small style="color:${DATAVIZ_COLORS.muted};display:block;margin-left:16px">${escapeHtml(details.join(' · '))}</small></div>`
          })
          return `<div><strong>${escapeHtml(periodLabel)}</strong>${unitNote}<div style="display:grid;gap:2px;margin-top:4px">${rows.join('')}</div></div>`
        }
        const lines = items.map((item) => {
          const point = item.data?.rawPoint
          const { rawValue, label } = displayValue(item)
          const isAverage = item.seriesName === averageLabel
          const fact = point && !isAverage
            ? ` · ${formatFactSummary(metric, point)}`
            : ''
          const periodId = point?.period_id ?? data?.periods?.[item.dataIndex]?.id
          const periodIndex = data?.periods?.findIndex((period) => String(period.id) === String(periodId)) ?? -1
          const previousPeriodId = periodIndex > 0 ? data.periods[periodIndex - 1]?.id : null
          const companyValue = data?.company_average?.find((entry) => String(entry.period_id) === String(periodId))?.value
          const teamSeries = data?.series?.[item.seriesIndex] ?? data?.series?.find((series) => series.team_name === item.seriesName)
          const points = isAverage ? data?.company_average : teamSeries?.values
          const previousValue = previousPeriodId === null ? null : points?.find((entry) => String(entry.period_id) === String(previousPeriodId))?.value
          const details = []
          if (Number.isFinite(rawValue) && !isAverage) {
            details.push(`差${averageLabel} ${Number.isFinite(companyValue) ? formatDifference(metric, rawValue - companyValue) : '—'}`)
          }
          if (Number.isFinite(rawValue)) {
            details.push(`较前一周期 ${Number.isFinite(previousValue) ? formatDifference(metric, rawValue - previousValue) : '—'}`)
          }
          const detailLine = details.length ? `<br/><small>${escapeHtml(details.join(' · '))}</small>` : ''
          return `${item.marker}${escapeHtml(item.seriesName)}：${escapeHtml(label)}${escapeHtml(fact)}${detailLine}`
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
      axisLabel: {
        color: DATAVIZ_COLORS.muted,
        fontSize: axisFontSize,
        hideOverlap: true,
        alignMinLabel: 'left',
        alignMaxLabel: 'right',
        formatter: (label) => compact && /^\d{4}-\d{2}$/.test(String(label)) ? `${String(label).slice(2, 4)}/${String(label).slice(5)}` : label,
      },
    },
    yAxis: {
      type: 'value',
      min: overflowLimit !== null ? (hasNegativeOverflow ? -1 : 0) : metric.type === 'penetration' || metric.type === 'ratio' ? 0 : undefined,
      max: overflowLimit !== null && hasPositiveOverflow ? 1 : metric.type === 'penetration' || metric.type === 'ratio' ? 1 : undefined,
      splitLine: { lineStyle: { color: DATAVIZ_COLORS.grid, width: 1 } },
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: axisFontSize, formatter: (value) => axisValue(metric, value) },
      axisPointer: { label: { show: false } },
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
    axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 11, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      min: yMin,
      max: yMax,
      splitLine: { lineStyle: { color: DATAVIZ_COLORS.grid } },
      axisLabel: { color: DATAVIZ_COLORS.muted, fontSize: 11, formatter: (value) => formatValue(value, 0) },
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
      lineStyle: { width: entry.primary ? 2.5 : 2, cap: 'round', join: 'round' },
      itemStyle: { color: entry.color ?? DATAVIZ_COLORS.team[0] },
      endLabel: { show: series.length < 4, formatter: '{a}', color: DATAVIZ_COLORS.inkSecondary, fontSize: 11 },
      labelLayout: { moveOverlap: 'shiftY' },
    })),
  }
}

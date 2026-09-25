import { previousMonthId, valueForPeriod } from './overviewLogic.js'

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export const EXECUTIVE_TREND_CODES = ['cd-ar-pen', 'cd-eff', 'mrr-rate']
export const EXECUTIVE_KPI_CODES = ['cd-ar-pen', 'cd-eff', 'tce-count', 'tcg-rate']

export function factCoverage(rows = []) {
  const available = rows.filter((row) => row.hasData).length
  return { available, total: rows.length }
}

export function executiveKpiRows(metricRows = []) {
  const byCode = new Map(metricRows.map((row) => [row.metric.code, row]))
  return EXECUTIVE_KPI_CODES.map((code) => byCode.get(code)).filter((row) => row && row.metric.type !== 'boolean')
}

function pointHasRawValue(point) {
  if (typeof point?.fact_count === 'number') return point.fact_count > 0
  return [point?.value, point?.numerator, point?.denominator, point?.estimated, point?.actual].some(numeric)
}

export function metricDataForPeriods(data, periodIds = []) {
  const selected = new Set(periodIds.map(String))
  return {
    ...data,
    periods: (data?.periods ?? []).filter((period) => selected.has(String(period.id))),
    series: (data?.series ?? []).map((series) => ({
      ...series,
      values: (series.values ?? []).filter((point) => selected.has(String(point.period_id))),
    })),
    company_average: (data?.company_average ?? []).filter((point) => selected.has(String(point.period_id))),
    domain_summary: (data?.domain_summary ?? []).filter((point) => selected.has(String(point.period_id))),
  }
}

function dataForMetricWindow(data, periodIds = []) {
  const windowed = metricDataForPeriods(data, periodIds)
  return { ...windowed, series: windowed.series.map((series) => ({ ...series, values: series.values.filter(pointHasRawValue) })) }
}

export function metricCompanyAverageForWindow(data, metric, periodIds = []) {
  if (!data || metric?.type === 'boolean' || !periodIds.length) return null
  const windowed = dataForMetricWindow(data, periodIds)
  const values = windowed.series
    .map((series) => valueForPeriod(windowed, metric, series.team_id, 'all'))
    .filter(numeric)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

export function metricTeamValuesForWindow(data, metric, periodIds = []) {
  if (!data || metric?.type === 'boolean') return []
  const windowed = dataForMetricWindow(data, periodIds)
  return windowed.series.map((series) => ({
    teamId: series.team_id,
    teamName: series.team_name,
    value: valueForPeriod(windowed, metric, series.team_id, 'all'),
  }))
}

export function executiveMetricSummary({ data, metric, month, monthTrendIds = [], periodIds = [] } = {}) {
  if (!data || !metric || metric.type === 'boolean') {
    return { monthValue: null, monthDelta: null, monthTrend: [], periodValue: null, periodDelta: null, periodTrend: [], periodTeams: [] }
  }
  const averageByMonth = new Map((data.company_average ?? []).map((point) => [String(point.period_id), point.value]))
  const previousMonth = previousMonthId(month)
  const monthValue = numeric(averageByMonth.get(String(month))) ? averageByMonth.get(String(month)) : null
  const previousMonthValue = previousMonth && numeric(averageByMonth.get(String(previousMonth))) ? averageByMonth.get(String(previousMonth)) : null
  const monthDelta = numeric(monthValue) && numeric(previousMonthValue) ? monthValue - previousMonthValue : null
  const periodValue = metricCompanyAverageForWindow(data, metric, periodIds)
  const beforeCurrent = periodIds.slice(0, -1)
  const previousPeriodValue = metricCompanyAverageForWindow(data, metric, beforeCurrent)
  const periodDelta = metric.type === 'count'
    ? monthValue
    : numeric(periodValue) && numeric(previousPeriodValue) ? periodValue - previousPeriodValue : null
  const periodTrend = periodIds.map((_, index) => metricCompanyAverageForWindow(data, metric, periodIds.slice(0, index + 1)))
  const monthTrend = monthTrendIds.map((periodId) => {
    const value = averageByMonth.get(String(periodId))
    return numeric(value) ? value : null
  })
  return {
    monthValue,
    monthDelta,
    monthTrend,
    periodValue,
    periodDelta,
    periodTrend,
    periodTeams: metricTeamValuesForWindow(data, metric, periodIds),
  }
}

export function rankedTeams(row) {
  const values = (row?.teams ?? [])
    .filter((team) => numeric(team.point?.value))
    .sort((left, right) => right.point.value - left.point.value)

  let previous = null
  let rank = 0
  return values.map((team, index) => {
    if (team.point.value !== previous) rank = index + 1
    previous = team.point.value
    return { ...team, rank, value: team.point.value }
  })
}

export function factTrendSnapshot({ data, periodIds = [], teamPoints = [] } = {}) {
  const averageByPeriod = new Map((data?.company_average ?? []).map((point) => [String(point.period_id), point.value]))
  const values = periodIds.map((periodId) => {
    const value = averageByPeriod.get(String(periodId))
    return numeric(value) ? value : null
  })
  const teams = teamPoints.map((team) => team.point?.value).filter(numeric)
  return {
    values,
    current: values.at(-1) ?? null,
    previous: values.at(-2) ?? null,
    validTeamCount: teams.length,
    totalTeamCount: teamPoints.length,
    teamMin: teams.length ? Math.min(...teams) : null,
    teamMax: teams.length ? Math.max(...teams) : null,
  }
}

export function maturityMatrixData(data) {
  const activities = data?.activities ?? []
  const columns = activities.map((activity) => ({ id: activity.activity_id, label: activity.activity_name }))
  const rows = [
    {
      id: 'domain-average',
      label: '领域平均',
      kind: 'average',
      values: activities.map((activity) => ({ text: activity.score_display, level: activity.grade })),
    },
    ...(data?.teams ?? []).map((team) => {
      const cells = new Map((team.cells ?? []).map((cell) => [String(cell.activity_id), cell]))
      return {
        id: team.team_id,
        label: team.team_name,
        values: activities.map((activity) => {
          const cell = cells.get(String(activity.activity_id))
          return { text: cell?.score_display, level: cell?.grade }
        }),
      }
    }),
  ]
  return { columns, rows }
}

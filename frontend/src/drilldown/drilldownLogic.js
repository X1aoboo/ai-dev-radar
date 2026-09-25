import { analysisWindowMonths, assignTeamColorSlots } from '../overview/overviewLogic.js'
import { EXECUTIVE_KPI_CODES, metricCompanyAverageForWindow, metricDataForPeriods } from '../overview/executiveLogic.js'

export const TEAM_KPI_CODES = [...EXECUTIVE_KPI_CODES]

export function teamKpiEntries(entries = []) {
  return TEAM_KPI_CODES
    .map((code) => entries.find(({ metric }) => metric.code === code))
    .filter(Boolean)
}

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function teamAccentColor(teamId, teamIds = [teamId], previousSlots = {}) {
  const ids = teamIds.length ? teamIds : [teamId]
  const assigned = assignTeamColorSlots(ids, previousSlots)
  return assigned.colors[String(teamId)] ?? null
}

export function maturityProfileSeries({ activities = [], records = [], teamName, teamColor, domainColor }) {
  const recordsByActivity = new Map(records.map((record) => [
    String(record.activity_id),
    record.score_raw !== null && record.score_raw !== undefined && record.score_raw !== '' && Number.isFinite(Number(record.score_raw))
      ? Number(record.score_raw)
      : null,
  ]))
  return [
    { id: 'team', name: teamName, color: teamColor, values: activities.map((activity) => recordsByActivity.get(String(activity.activity_id)) ?? null) },
    { id: 'domain', name: '领域平均', color: domainColor, dashed: true, values: activities.map((activity) => Number.isFinite(activity.score) ? activity.score : null) },
  ]
}

export function mergePeriods(dataList = []) {
  const periodsById = new Map()
  for (const data of dataList) {
    for (const period of data?.periods ?? []) {
      const key = String(period.id)
      if (!periodsById.has(key)) periodsById.set(key, period)
    }
  }

  return [...periodsById.values()].sort((left, right) => (
    String(left.start_date ?? left.id).localeCompare(
      String(right.start_date ?? right.id),
      undefined,
      { numeric: true },
    )
  ))
}

function pointsForTeam(data, teamId) {
  const series = (data?.series ?? []).find((item) => String(item.team_id) === String(teamId))
  return (series?.values ?? []).filter((point) => point.fact_count !== 0)
}

export function pointForSelection(data, teamId, periodId) {
  return pointsForTeam(data, teamId)
    .find((point) => String(point.period_id) === String(periodId))
}

function valueFromSums(metric, points) {
  const type = metric?.type
  if (!points.length) return null

  if (type === 'penetration' || type === 'ratio') {
    const numerator = points.reduce((sum, point) => sum + (point.numerator ?? 0), 0)
    const denominator = points.reduce((sum, point) => sum + (point.denominator ?? 0), 0)
    return denominator > 0 ? numerator / denominator : null
  }

  if (type === 'efficiency') {
    const estimated = points.reduce((sum, point) => sum + (point.estimated ?? point.numerator ?? 0), 0)
    const actual = points.reduce((sum, point) => sum + (point.actual ?? point.denominator ?? 0), 0)
    if (estimated === 0 && actual === 0) return null
    const divisor = actual > 0 ? actual : 0.5
    return (estimated - actual) / divisor
  }

  if (type === 'count') {
    return points.reduce((sum, point) => sum + (point.numerator ?? 0), 0)
  }

  if (type === 'boolean') {
    return points.at(-1)?.value ?? null
  }

  return null
}

export function valueForSelection(data, metric, teamId, periodId) {
  if (metric?.type === 'boolean') {
    return data?.series?.find((series) => String(series.team_id) === String(teamId))?.snapshot ?? null
  }

  if (periodId !== 'all' && periodId !== null && periodId !== undefined) {
    return pointForSelection(data, teamId, periodId)?.value ?? null
  }

  return valueFromSums(metric, pointsForTeam(data, teamId))
}

export function deltaForSelection(data, metric, teamId, periodId) {
  if (periodId === 'all' || periodId === null || periodId === undefined) return null

  const periods = data?.periods ?? []
  const index = periods.findIndex((period) => String(period.id) === String(periodId))
  if (index <= 0) return null

  const current = valueForSelection(data, metric, teamId, periods[index].id)
  const previous = valueForSelection(data, metric, teamId, periods[index - 1].id)
  return numeric(current) && numeric(previous) ? current - previous : null
}

export function teamMetricSummary({ data, metric, teamId, month, cycle = '6m' } = {}) {
  const monthIds = analysisWindowMonths(month, '6m')
  const periodIds = analysisWindowMonths(month, cycle)
  const valueForWindow = (ids) => valueForSelection(metricDataForPeriods(data, ids), metric, teamId, 'all')
  const monthValue = valueForSelection(data, metric, teamId, month)
  const periodValue = valueForWindow(periodIds)
  const previousPeriodValue = valueForWindow(periodIds.slice(0, -1))
  const companyAverage = new Map((data?.company_average ?? []).map((point) => [String(point.period_id), point.value]))
  return {
    monthValue,
    monthDelta: deltaForSelection(data, metric, teamId, month),
    monthBenchmark: companyAverage.get(String(month)) ?? null,
    monthTrend: monthIds.map((periodId) => valueForSelection(data, metric, teamId, periodId)),
    periodValue,
    periodDelta: metric?.type === 'count'
      ? monthValue
      : numeric(periodValue) && numeric(previousPeriodValue) ? periodValue - previousPeriodValue : null,
    periodBenchmark: metricCompanyAverageForWindow(data, metric, periodIds),
    periodTrend: periodIds.map((_, index) => valueForWindow(periodIds.slice(0, index + 1))),
    periodIds,
  }
}

function dateInPeriod(value, period) {
  if (!value || !period?.start_date || !period?.end_date) return false
  return value >= period.start_date && value <= period.end_date
}

function factInPeriod(fact, period) {
  if (period?.kind === 'iteration' || (period?.iteration_id !== null && period?.iteration_id !== undefined)) {
    const iterationId = period.iteration_id ?? period.id
    return String(fact.iteration_id) === String(iterationId)
  }

  return dateInPeriod(fact.end_date ?? fact.start_date, period)
}

export function sourceForPeriod(facts, metricId, period) {
  const sources = facts
    .filter((fact) => String(fact.metric_id) === String(metricId) && factInPeriod(fact, period))
    .map((fact) => fact.source)

  if (sources.includes('manual')) return 'manual'
  if (sources.includes('auto')) return 'auto'
  return null
}

export function previousPeriodId(data, periodId) {
  if (periodId === 'all' || periodId === null || periodId === undefined) return null
  const periods = data?.periods ?? []
  const index = periods.findIndex((period) => String(period.id) === String(periodId))
  return index > 0 ? periods[index - 1].id : null
}

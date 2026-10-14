import { metricCompanyAverageForWindow, metricTeamValuesForWindow } from '../overview/executiveLogic.js'

const KPI_SOURCES = [
  { code: 'ai-demand-penetration', sourceType: 'penetration', valueKind: 'domainMetric' },
  { code: 'ai-rd-efficiency', sourceType: 'efficiency', valueKind: 'domainMetric' },
  { code: 'ai-covered-ir-count', sourceType: 'penetration', valueKind: 'numerator' },
  { code: 'ai-efficiency-workload', sourceType: 'efficiency', valueKind: 'saved-workload' },
]

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function yearOverYearGrowth(current, previousYear) {
  return numeric(current) && numeric(previousYear) && previousYear > 0
    ? (current - previousYear) / previousYear
    : null
}

function factPoints(points, periodIds) {
  const selected = new Set(periodIds.map(String))
  return (points ?? []).filter((point) => selected.has(String(point.period_id)) && point.fact_count > 0)
}

export function activityCoverageBreakdown(data, periodIds = []) {
  const points = factPoints(data?.domain_summary, periodIds)
  if (!points.length) return { status: 'missing' }
  if (points.some((point) => !numeric(point.numerator) || !numeric(point.denominator))) return { status: 'invalid' }
  const covered = points.reduce((sum, point) => sum + point.numerator, 0)
  const total = points.reduce((sum, point) => sum + point.denominator, 0)
  if (covered < 0 || total < 0 || covered > total) return { status: 'invalid' }
  if (total === 0) return { status: 'zero', covered, uncovered: 0, total }
  return { status: 'ready', covered, uncovered: total - covered, total }
}

function domainValue(data, metric, periodIds, valueKind) {
  const points = factPoints(data?.domain_summary, periodIds)
  if (!points.length) return null
  if (valueKind === 'domainMetric') {
    if (points.some((point) => !numeric(point.numerator) || !numeric(point.denominator))) return null
    const numerator = points.reduce((sum, point) => sum + point.numerator, 0)
    const denominator = points.reduce((sum, point) => sum + point.denominator, 0)
    if (metric.type === 'penetration' || metric.type === 'ratio') return denominator > 0 ? numerator / denominator : null
    if (metric.type === 'efficiency') {
      if (numerator === 0 && denominator === 0) return null
      return (numerator - denominator) / (denominator > 0 ? denominator : 0.5)
    }
    return null
  }
  if (valueKind === 'numerator') {
    if (points.some((point) => !numeric(point.numerator))) return null
    return points.reduce((sum, point) => sum + point.numerator, 0)
  }
  if (valueKind === 'saved-workload') {
    if (points.some((point) => !numeric(point.numerator) || !numeric(point.denominator))) return null
    return points.reduce((sum, point) => sum + point.numerator - point.denominator, 0)
  }
  return null
}

function teamRawValue(data, teamId, periodIds, valueKind) {
  const series = data?.series?.find((item) => String(item.team_id) === String(teamId))
  const points = factPoints(series?.values, periodIds)
  if (!points.length) return null
  if (valueKind === 'numerator') {
    if (points.some((point) => !numeric(point.numerator))) return null
    return points.reduce((sum, point) => sum + point.numerator, 0)
  }
  if (valueKind === 'saved-workload') {
    if (points.some((point) => !numeric(point.numerator) || !numeric(point.denominator))) return null
    return points.reduce((sum, point) => sum + point.numerator - point.denominator, 0)
  }
  return null
}

function valueFor(data, metric, periodIds, valueKind) {
  if (!data || !metric || !periodIds.length) return null
  return valueKind === 'average'
    ? metricCompanyAverageForWindow(data, metric, periodIds)
    : domainValue(data, metric, periodIds, valueKind)
}

function teamValueFor(data, metric, teamId, periodIds, valueKind) {
  if (!data || !metric || !periodIds.length) return null
  if (valueKind !== 'average' && valueKind !== 'domainMetric') return teamRawValue(data, teamId, periodIds, valueKind)
  return metricTeamValuesForWindow(data, metric, periodIds)
    .find((team) => String(team.teamId) === String(teamId))?.value ?? null
}

export function buildActivityKpiModel({ activity, dataByMetric = {}, kpiDefinitions = [], month, previousMonth, monthTrendIds = [], cyclePeriodIds = [], teams = [] } = {}) {
  const definitions = new Map(kpiDefinitions.map((definition) => [definition.code, definition]))
  const previousCycleIds = cyclePeriodIds.slice(0, -1)
  const kpis = KPI_SOURCES.map((source) => {
    const definition = definitions.get(source.code)
    const metric = activity?.metrics?.find((item) => item.type === source.sourceType) ?? null
    const data = metric ? dataByMetric[metric.id] : null
    const monthIds = [month]
    const previousMonthIds = previousMonth ? [previousMonth] : []
    const monthValue = valueFor(data, metric, monthIds, source.valueKind)
    const previousMonthValue = valueFor(data, metric, previousMonthIds, source.valueKind)
    const cycleValue = valueFor(data, metric, cyclePeriodIds, source.valueKind)
    const previousCycleValue = valueFor(data, metric, previousCycleIds, source.valueKind)
    const monthDelta = numeric(monthValue) && numeric(previousMonthValue) ? monthValue - previousMonthValue : null
    const cycleDelta = ['average', 'domainMetric'].includes(source.valueKind)
      ? numeric(cycleValue) && numeric(previousCycleValue) ? cycleValue - previousCycleValue : null
      : monthValue
    const teamValues = teams.map((team) => {
      const monthTeamValue = teamValueFor(data, metric, team.id, monthIds, source.valueKind)
      const previousMonthTeamValue = teamValueFor(data, metric, team.id, previousMonthIds, source.valueKind)
      const cycleTeamValue = teamValueFor(data, metric, team.id, cyclePeriodIds, source.valueKind)
      const previousCycleTeamValue = teamValueFor(data, metric, team.id, previousCycleIds, source.valueKind)
      return {
        teamId: team.id,
        monthValue: monthTeamValue,
        monthDelta: numeric(monthTeamValue) && numeric(previousMonthTeamValue) ? monthTeamValue - previousMonthTeamValue : null,
        cycleValue: cycleTeamValue,
        cycleDelta: ['average', 'domainMetric'].includes(source.valueKind)
          ? numeric(cycleTeamValue) && numeric(previousCycleTeamValue) ? cycleTeamValue - previousCycleTeamValue : null
          : monthTeamValue,
      }
    })

    return {
      ...source,
      definition,
      metric,
      monthValue,
      previousMonthValue,
      monthDelta,
      monthTrend: monthTrendIds.map((periodId) => valueFor(data, metric, [periodId], source.valueKind)),
      cycleValue,
      previousCycleValue,
      cycleDelta,
      cycleTrend: cyclePeriodIds.map((_, index) => valueFor(data, metric, cyclePeriodIds.slice(0, index + 1), source.valueKind)),
      teamValues,
    }
  })

  const averageRow = {
    id: 'company-average',
    label: '全公司均值',
    kind: 'average',
    values: kpis.map((kpi) => ({
      textValue: mean(kpi.teamValues.map((team) => team.cycleValue)),
      changeValue: mean(kpi.teamValues.map((team) => team.cycleDelta)),
    })),
  }
  const teamRows = teams.map((team) => ({
    id: team.id,
    label: team.name,
    kind: 'team',
    values: kpis.map((kpi) => {
      const row = kpi.teamValues.find((item) => String(item.teamId) === String(team.id))
      return { textValue: row?.cycleValue ?? null, changeValue: row?.cycleDelta ?? null }
    }),
  }))

  return { kpis, teamRows: [averageRow, ...teamRows] }
}

function mean(values) {
  const valid = values.filter(numeric)
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

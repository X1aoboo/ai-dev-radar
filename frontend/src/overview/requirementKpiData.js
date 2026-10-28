import { useEffect, useRef, useState } from 'react'

import { fetchJson } from '../api.js'
import { DATAVIZ_COLORS, previousMonthId } from './overviewLogic.js'

/**
 * Requirement activity KPI data layer.
 *
 * Design and development activity records are aggregated independently through
 * `GET /api/data-metrics/overview?activity=design|development&role=...`.
 * The response shape is unchanged; only the request scope and the neutral labels
 * differ. Nothing in this module merges the two activities.
 */

export const REQUIREMENT_ACTIVITIES = Object.freeze([
  Object.freeze({
    key: 'design',
    label: '设计活动',
    recordLabel: '设计记录',
    timeLabel: '设计时间',
    roles: Object.freeze(['all', 'sa', 'se']),
  }),
  Object.freeze({
    key: 'development',
    label: '开发活动',
    recordLabel: '开发记录',
    timeLabel: '开发时间',
    roles: Object.freeze(['all', 'implementation', 'development']),
  }),
])

export const REQUIREMENT_ACTIVITY_BY_KEY = Object.freeze(Object.fromEntries(
  REQUIREMENT_ACTIVITIES.map((activity) => [activity.key, activity]),
))

export const REQUIREMENT_KPIS = Object.freeze([
  Object.freeze({
    id: 'ai-demand-penetration',
    code: 'ai-demand-penetration',
    name: 'AI需求渗透率',
    type: 'penetration',
    numerator_semantic: 'AI辅助需求数',
    denominator_semantic: 'AI属性已维护需求数',
    accent: DATAVIZ_COLORS.team[0],
  }),
  Object.freeze({
    id: 'ai-rd-efficiency',
    code: 'ai-rd-efficiency',
    name: 'AI研发提效',
    type: 'efficiency',
    numerator_semantic: 'AI辅助需求预估人天',
    denominator_semantic: 'AI辅助需求实际人天',
    accent: DATAVIZ_COLORS.team[3],
  }),
  Object.freeze({
    id: 'ai-covered-requirement-count',
    code: 'ai-covered-requirement-count',
    name: 'AI覆盖需求数',
    type: 'count',
    numerator_semantic: 'AI辅助需求数',
    accent: DATAVIZ_COLORS.team[1],
    deltaMode: 'month-addition',
    periodDeltaLabel: '本月新增',
  }),
  Object.freeze({
    id: 'ai-efficiency-workload',
    code: 'ai-efficiency-workload',
    name: 'AI提效工作量',
    type: 'count',
    numerator_semantic: 'AI节省工作量人天',
    unit: '人天',
    accent: DATAVIZ_COLORS.team[2],
    deltaMode: 'month-addition',
    periodDeltaLabel: '本月节省',
  }),
])

export const REQUIREMENT_KPI_BY_CODE = Object.freeze(Object.fromEntries(
  REQUIREMENT_KPIS.map((metric) => [metric.code, metric]),
))

/**
 * Activity page role activities. Codes match the catalog activity codes.
 * `dd` (开发设计) uses the development activity's implementation-design role,
 * `cd` (编码开发) uses the development role.
 */
export const REQUIREMENT_ROLE_ACTIVITIES = Object.freeze({
  sa: Object.freeze({ key: 'sa', activity: 'design', role: 'sa', label: 'SA设计', roleLabel: 'SA' }),
  se: Object.freeze({ key: 'se', activity: 'design', role: 'se', label: 'SE设计', roleLabel: 'SE' }),
  dd: Object.freeze({ key: 'dd', activity: 'development', role: 'implementation', label: '开发设计', roleLabel: '实现设计' }),
  cd: Object.freeze({ key: 'cd', activity: 'development', role: 'development', label: '编码开发', roleLabel: '开发' }),
})

export function requirementRoleActivity(activity) {
  return REQUIREMENT_ROLE_ACTIVITIES[activity?.code] ?? null
}

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function mean(values) {
  const valid = values.filter(numeric)
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

function factCount(point) {
  return Number.isFinite(point?.fact_count) ? point.fact_count : 0
}

export function requirementCoverageBreakdown(metricData, periodIds = []) {
  const selected = new Set(periodIds.map(String))
  const points = (metricData?.domain_summary ?? []).filter((point) => (
    selected.has(String(point.period_id))
    && factCount(point) > 0
  ))
  if (!points.length) return { status: 'missing' }

  const total = points.reduce((sum, point) => sum + factCount(point), 0)
  const known = points.reduce((sum, point) => sum + (point.known_ai_count ?? 0), 0)
  if (known < 0 || known > total) return { status: 'invalid' }
  const unknown = total - known
  if (known === 0) return { status: 'unknown-only', total, known, unknown, covered: null, uncovered: null }
  if (points.some((point) => point.known_ai_count > 0 && !numeric(point.ai_assisted_count))) return { status: 'invalid' }

  const covered = points.reduce((sum, point) => sum + (point.known_ai_count > 0 ? point.ai_assisted_count : 0), 0)
  if (covered < 0 || covered > known) return { status: 'invalid' }
  return { status: 'ready', total, known, unknown, covered, uncovered: known - covered }
}

function metricPoint(point, metric) {
  if (!point) return null
  const knownAiCount = point.known_ai_count ?? 0
  const aiCount = point.ai_assisted_count
  const workloadCount = point.ai_workload_count ?? 0
  const estimated = point.ai_estimated_workload
  const actual = point.ai_actual_workload
  let value = null
  let numerator = null
  let denominator = null

  if (metric.type === 'penetration' && knownAiCount > 0) {
    numerator = aiCount
    denominator = knownAiCount
    value = aiCount / knownAiCount
  } else if (metric.code === 'ai-rd-efficiency' && workloadCount > 0 && numeric(estimated) && numeric(actual)) {
    numerator = estimated
    denominator = actual
    if (estimated !== 0 || actual !== 0) value = (estimated - actual) / (actual > 0 ? actual : 0.5)
  } else if (metric.code === 'ai-covered-requirement-count' && knownAiCount > 0) {
    numerator = aiCount
    value = aiCount
  } else if (metric.code === 'ai-efficiency-workload') {
    if (workloadCount > 0 && numeric(estimated) && numeric(actual)) {
      numerator = estimated - actual
      value = numerator
    } else if (knownAiCount > 0 && aiCount === 0) {
      numerator = 0
      value = 0
    }
  }

  return {
    period_id: point.period_id,
    value,
    fact_count: factCount(point),
    numerator,
    denominator,
    estimated,
    actual,
    known_ai_count: knownAiCount,
    ai_assisted_count: aiCount,
    ai_workload_count: workloadCount,
    ai_estimated_workload: estimated,
    ai_actual_workload: actual,
  }
}

function aggregateSourcePoints(points, metric) {
  const observed = points.filter((point) => point && point.fact_count > 0)
  const knownPoints = observed.filter((point) => point.known_ai_count > 0)
  const workloadPoints = observed.filter((point) => point.ai_workload_count > 0 && numeric(point.ai_estimated_workload) && numeric(point.ai_actual_workload))
  const raw = {
    period_id: points.at(-1)?.period_id,
    fact_count: observed.reduce((sum, point) => sum + point.fact_count, 0),
    known_ai_count: knownPoints.reduce((sum, point) => sum + point.known_ai_count, 0),
    ai_assisted_count: knownPoints.length
      ? knownPoints.reduce((sum, point) => sum + (point.ai_assisted_count ?? 0), 0)
      : null,
    ai_workload_count: workloadPoints.reduce((sum, point) => sum + point.ai_workload_count, 0),
    ai_estimated_workload: workloadPoints.length
      ? workloadPoints.reduce((sum, point) => sum + point.ai_estimated_workload, 0)
      : null,
    ai_actual_workload: workloadPoints.length
      ? workloadPoints.reduce((sum, point) => sum + point.ai_actual_workload, 0)
      : null,
  }
  return metricPoint(raw, metric)
}

export function buildRequirementKpiData(payload) {
  const periods = (payload?.period_ids ?? []).map((id) => ({ id, label: id, kind: 'month' }))
  const sourceSeries = payload?.series ?? []
  return Object.fromEntries(REQUIREMENT_KPIS.map((metric) => {
    const series = sourceSeries.map((team) => ({
      team_id: team.team_id,
      team_name: team.team_name,
      values: (team.values ?? []).map((point) => metricPoint(point, metric)),
    }))
    const companyAverage = periods.map((period, index) => {
      const values = series.map((team) => team.values[index]?.value).filter(numeric)
      return { period_id: period.id, value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null }
    })
    return [metric.code, {
      metric,
      periods,
      series,
      company_average: companyAverage,
      domain_summary: (payload?.domain_summary ?? []).map((point) => metricPoint(point, metric)),
    }]
  }))
}

export function requirementKpiSummary({ data, benchmarkData, metric, month, monthTrendIds = [], periodIds = [] } = {}) {
  if (!data || !metric) return null
  const referenceData = benchmarkData === undefined ? data : benchmarkData
  const domainByMonth = new Map((data.domain_summary ?? []).map((point) => [String(point.period_id), point]))
  const monthValue = domainByMonth.get(String(month))?.value ?? null
  const previousMonth = previousMonthId(month)
  const previousMonthValue = previousMonth ? domainByMonth.get(String(previousMonth))?.value : null
  const monthDelta = numeric(monthValue) && numeric(previousMonthValue) ? monthValue - previousMonthValue : null
  const aggregate = (ids) => aggregateSourcePoints(ids.map((id) => domainByMonth.get(String(id))).filter(Boolean), metric)?.value ?? null
  const periodValue = aggregate(periodIds)
  const previousPeriodValue = aggregate(periodIds.slice(0, -1))
  const periodDelta = metric.deltaMode === 'month-addition'
    ? monthValue
    : numeric(periodValue) && numeric(previousPeriodValue) ? periodValue - previousPeriodValue : null
  const monthPoint = domainByMonth.get(String(month))
  const periodPoint = aggregateSourcePoints(periodIds.map((id) => domainByMonth.get(String(id))).filter(Boolean), metric)
  const teamPeriodValue = (team, ids) => aggregateSourcePoints(
    ids.map((id) => team.values.find((point) => String(point.period_id) === String(id))).filter(Boolean),
    metric,
  )?.value ?? null
  const monthTeams = (data.series ?? []).map((team) => {
    const value = team.values.find((point) => String(point.period_id) === String(month))?.value ?? null
    const previousValue = previousMonth ? team.values.find((point) => String(point.period_id) === String(previousMonth))?.value : null
    return {
      teamId: team.team_id,
      teamName: team.team_name,
      value,
      delta: numeric(value) && numeric(previousValue) ? value - previousValue : null,
      trend: monthTrendIds.map((id) => team.values.find((point) => String(point.period_id) === String(id))?.value ?? null),
    }
  })
  const periodTeams = (data.series ?? []).map((team) => {
    const value = teamPeriodValue(team, periodIds)
    const previousValue = teamPeriodValue(team, periodIds.slice(0, -1))
    const monthTeamValue = team.values.find((point) => String(point.period_id) === String(month))?.value ?? null
    return {
      teamId: team.team_id,
      teamName: team.team_name,
      value,
      delta: metric.deltaMode === 'month-addition'
        ? monthTeamValue
        : numeric(value) && numeric(previousValue) ? value - previousValue : null,
      trend: periodIds.map((_, index) => teamPeriodValue(team, periodIds.slice(0, index + 1))),
    }
  })
  const benchmarkMonthTeams = (referenceData?.series ?? []).map((team) => {
    const value = team.values.find((point) => String(point.period_id) === String(month))?.value ?? null
    const previousValue = previousMonth ? team.values.find((point) => String(point.period_id) === String(previousMonth))?.value : null
    return {
      teamId: team.team_id,
      teamName: team.team_name,
      value,
      delta: numeric(value) && numeric(previousValue) ? value - previousValue : null,
    }
  })
  const benchmarkPeriodTeams = (referenceData?.series ?? []).map((team) => {
    const value = teamPeriodValue(team, periodIds)
    const previousValue = teamPeriodValue(team, periodIds.slice(0, -1))
    const monthTeamValue = team.values.find((point) => String(point.period_id) === String(month))?.value ?? null
    return {
      teamId: team.team_id,
      teamName: team.team_name,
      value,
      delta: metric.deltaMode === 'month-addition'
        ? monthTeamValue
        : numeric(value) && numeric(previousValue) ? value - previousValue : null,
    }
  })
  const referenceCompanyAverage = referenceData?.company_average ?? []
  const monthCompanyAverage = referenceCompanyAverage.find((point) => String(point.period_id) === String(month))?.value ?? null
  const previousMonthCompanyAverage = previousMonth
    ? referenceCompanyAverage.find((point) => String(point.period_id) === String(previousMonth))?.value ?? null
    : null
  const referenceSeriesByTeam = new Map((referenceData?.series ?? []).map((series) => [String(series.team_id), series]))
  const previousPeriodTeams = benchmarkPeriodTeams.map((team) => {
    const series = referenceSeriesByTeam.get(String(team.teamId))
    return series ? teamPeriodValue(series, periodIds.slice(0, -1)) : null
  })
  const previousPeriodCompanyAverage = mean(previousPeriodTeams)
  const periodCompanyAverage = mean(benchmarkPeriodTeams.map((team) => team.value))
  const periodCompanyAverageDelta = metric.deltaMode === 'month-addition'
    ? mean(benchmarkMonthTeams.map((team) => team.value))
    : numeric(periodCompanyAverage) && numeric(previousPeriodCompanyAverage) ? periodCompanyAverage - previousPeriodCompanyAverage : null
  return {
    monthValue,
    monthDelta,
    previousMonthValue: previousMonthValue ?? null,
    monthTrend: monthTrendIds.map((id) => domainByMonth.get(String(id))?.value ?? null),
    periodValue,
    periodDelta,
    previousPeriodValue,
    periodTrend: periodIds.map((_, index) => aggregate(periodIds.slice(0, index + 1))),
    monthTeams,
    benchmarkMonthTeams,
    monthCompanyAverage,
    monthCompanyAverageDelta: numeric(monthCompanyAverage) && numeric(previousMonthCompanyAverage) ? monthCompanyAverage - previousMonthCompanyAverage : null,
    periodTeams,
    benchmarkPeriodTeams,
    periodCompanyAverage,
    periodCompanyAverageDelta,
    monthCoverage: {
      factCount: factCount(monthPoint),
      knownAiCount: monthPoint?.known_ai_count ?? 0,
      aiAssistedCount: monthPoint?.ai_assisted_count ?? null,
      aiWorkloadCount: monthPoint?.ai_workload_count ?? 0,
    },
    periodCoverage: {
      factCount: factCount(periodPoint),
      knownAiCount: periodPoint?.known_ai_count ?? 0,
      aiAssistedCount: periodPoint?.ai_assisted_count ?? null,
      aiWorkloadCount: periodPoint?.ai_workload_count ?? 0,
    },
  }
}

export function buildRequirementKpiModel({ dataByMetric = {}, month, monthTrendIds = [], cyclePeriodIds = [], teams = [], definitions = REQUIREMENT_KPIS } = {}) {
  const previousCycleIds = cyclePeriodIds.slice(0, -1)
  const kpis = definitions.map((definition) => {
    const data = dataByMetric[definition.code]
    const summary = requirementKpiSummary({
      data,
      metric: definition,
      month,
      monthTrendIds,
      periodIds: cyclePeriodIds,
    })
    const teamValues = teams.map((team) => {
      const monthTeam = summary?.monthTeams.find((item) => String(item.teamId) === String(team.id))
      const periodTeam = summary?.periodTeams.find((item) => String(item.teamId) === String(team.id))
      return {
        teamId: team.id,
        monthValue: monthTeam?.value ?? null,
        monthDelta: monthTeam?.delta ?? null,
        cycleValue: periodTeam?.value ?? null,
        cycleDelta: periodTeam?.delta ?? null,
      }
    })
    return {
      code: definition.code,
      definition,
      metric: definition,
      monthValue: summary?.monthValue ?? null,
      previousMonthValue: summary?.previousMonthValue ?? null,
      monthDelta: summary?.monthDelta ?? null,
      monthTrend: summary?.monthTrend ?? [],
      cycleValue: summary?.periodValue ?? null,
      previousCycleValue: summary?.previousPeriodValue ?? null,
      cycleDelta: summary?.periodDelta ?? null,
      cycleTrend: summary?.periodTrend ?? [],
      teamValues,
      summary,
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
  return { kpis, teamRows: [averageRow, ...teamRows], previousCycleIds }
}

/**
 * Dual-activity team matrix model used by the overview and activity page.
 * Activities are never merged: every column keeps its activity group.
 */
export function buildRequirementTeamMatrixModel({ entries = [], month, monthTrendIds = [], cyclePeriodIds = [], teams = [], view = 'cycle' } = {}) {
  const cells = entries.flatMap((entry) => REQUIREMENT_KPIS.map((definition) => {
    const data = entry.dataByMetric?.[definition.code]
    const summary = requirementKpiSummary({
      data,
      metric: definition,
      month,
      monthTrendIds,
      periodIds: cyclePeriodIds,
    })
    return { entry, definition, summary }
  }))
  const columns = cells.map(({ entry, definition }) => ({
    id: `${entry.key}-${definition.code}`,
    label: definition.name,
    context: definition.unit,
    group: entry.key,
    definition,
  }))
  const columnGroups = entries.map((entry) => ({
    id: entry.key,
    label: entry.label,
    count: REQUIREMENT_KPIS.length,
  }))
  const valueFor = (summary, teamId) => {
    const isMonth = view === 'month'
    if (teamId === 'company-average') {
      return {
        value: isMonth ? summary?.monthCompanyAverage : summary?.periodCompanyAverage,
        delta: isMonth ? summary?.monthCompanyAverageDelta : summary?.periodCompanyAverageDelta,
      }
    }
    const rows = isMonth ? summary?.monthTeams : summary?.periodTeams
    const team = rows?.find((item) => String(item.teamId) === String(teamId))
    return { value: team?.value ?? null, delta: team?.delta ?? null }
  }
  const rows = [
    {
      id: 'company-average',
      label: '全公司均值',
      kind: 'average',
      values: cells.map(({ summary }) => valueFor(summary, 'company-average')),
    },
    ...teams.map((team) => ({
      id: team.id,
      label: team.name,
      kind: 'team',
      values: cells.map(({ summary }) => valueFor(summary, team.id)),
    })),
  ]
  return { columns, columnGroups, rows }
}

export function requirementOverviewQuery({ fromMonth, toMonth, versionId = 'all', activity = 'design', role = 'all' } = {}) {
  return new URLSearchParams({
    from_month: fromMonth,
    to_month: toMonth,
    version_id: String(versionId ?? 'all'),
    activity,
    role,
  }).toString()
}

const DISABLED_STATE = { loading: false, error: null, data: null, benchmarkError: null, benchmarkData: null }

export function useRequirementOverviewMetrics(
  fromMonth,
  toMonth,
  versionId,
  activity = 'design',
  role = 'all',
  onSessionExpired,
  { enabled = true, benchmark = true } = {},
) {
  const [state, setState] = useState({ loading: Boolean(enabled), error: null, data: null, benchmarkError: null, benchmarkData: null })
  const sessionExpiredRef = useRef(onSessionExpired)
  sessionExpiredRef.current = onSessionExpired

  useEffect(() => {
    if (!enabled) {
      setState(DISABLED_STATE)
      return undefined
    }
    const controller = new AbortController()
    let active = true
    const currentVersionId = String(versionId ?? 'all')
    const request = (scopeVersionId) => {
      const query = requirementOverviewQuery({ fromMonth, toMonth, versionId: scopeVersionId, activity, role })
      return fetchJson(`/api/data-metrics/overview?${query}`, { signal: controller.signal })
    }
    const currentRequest = request(currentVersionId)
    const benchmarkRequest = benchmark && currentVersionId !== 'all' ? request('all') : currentRequest
    setState({ loading: true, error: null, data: null, benchmarkError: null, benchmarkData: null })
    Promise.allSettled([currentRequest, benchmarkRequest]).then(([current, benchmarkResult]) => {
      if (!active) return
      if (current.status === 'rejected' && current.reason?.name === 'AbortError') return
      if ((current.status === 'rejected' && current.reason?.status === 401)
        || (benchmarkResult.status === 'rejected' && benchmarkResult.reason?.status === 401)) {
        sessionExpiredRef.current?.()
      }
      setState({
        loading: false,
        error: current.status === 'rejected' ? current.reason : null,
        data: current.status === 'fulfilled' ? current.value : null,
        benchmarkError: benchmarkResult.status === 'rejected' ? benchmarkResult.reason : null,
        benchmarkData: benchmarkResult.status === 'fulfilled' ? benchmarkResult.value : null,
      })
    })
    return () => { active = false; controller.abort() }
  }, [activity, benchmark, enabled, fromMonth, role, toMonth, versionId])

  return enabled ? state : DISABLED_STATE
}

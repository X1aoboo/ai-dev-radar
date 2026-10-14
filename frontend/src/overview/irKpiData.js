import { useEffect, useRef, useState } from 'react'

import { fetchJson } from '../api.js'
import { DATAVIZ_COLORS, previousMonthId } from './overviewLogic.js'

export const IR_OVERVIEW_KPIS = [
  { id: 'ai-demand-penetration', code: 'ai-demand-penetration', name: 'AI需求渗透率', type: 'penetration', numerator_semantic: 'AI辅助 IR 数', denominator_semantic: 'AI属性已维护 IR 数', accent: DATAVIZ_COLORS.team[0] },
  { id: 'ai-rd-efficiency', code: 'ai-rd-efficiency', name: 'AI研发提效', type: 'efficiency', numerator_semantic: 'AI辅助IR预估人天', denominator_semantic: 'AI辅助IR实际人天', accent: DATAVIZ_COLORS.team[3] },
  { id: 'ai-covered-ir-count', code: 'ai-covered-ir-count', name: 'AI覆盖需求数', type: 'count', numerator_semantic: 'AI辅助 IR 数', accent: DATAVIZ_COLORS.team[1], deltaMode: 'month-addition', periodDeltaLabel: '本月新增' },
  { id: 'ai-efficiency-workload', code: 'ai-efficiency-workload', name: 'AI提效工作量', type: 'count', numerator_semantic: 'AI节省工作量人天', unit: '人天', accent: DATAVIZ_COLORS.team[2], deltaMode: 'month-addition', periodDeltaLabel: '本月节省' },
]

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function mean(values) {
  const valid = values.filter(numeric)
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

export function irCoverageBreakdown(metricData, periodIds = []) {
  const selected = new Set(periodIds.map(String))
  const points = (metricData?.domain_summary ?? []).filter((point) => (
    selected.has(String(point.period_id))
    && Number.isFinite(point.ir_fact_count ?? point.fact_count)
    && (point.ir_fact_count ?? point.fact_count) > 0
  ))
  if (!points.length) return { status: 'missing' }

  const total = points.reduce((sum, point) => sum + (point.ir_fact_count ?? point.fact_count), 0)
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
  let factCount = 0
  let numerator = null
  let denominator = null

  if (metric.type === 'penetration' && knownAiCount > 0) {
    numerator = aiCount
    denominator = knownAiCount
    value = aiCount / knownAiCount
    factCount = knownAiCount
  } else if (metric.code === 'ai-rd-efficiency' && workloadCount > 0 && numeric(estimated) && numeric(actual)) {
    numerator = estimated
    denominator = actual
    if (estimated !== 0 || actual !== 0) value = (estimated - actual) / (actual > 0 ? actual : 0.5)
    factCount = workloadCount
  } else if (metric.code === 'ai-covered-ir-count' && knownAiCount > 0) {
    numerator = aiCount
    value = aiCount
    factCount = knownAiCount
  } else if (metric.code === 'ai-efficiency-workload') {
    if (workloadCount > 0 && numeric(estimated) && numeric(actual)) {
      numerator = estimated - actual
      value = numerator
      factCount = workloadCount
    } else if (knownAiCount > 0 && aiCount === 0) {
      numerator = 0
      value = 0
      factCount = knownAiCount
    }
  }

  return {
    period_id: point.period_id,
    value,
    fact_count: factCount,
    numerator,
    denominator,
    estimated,
    actual,
    ir_fact_count: point.fact_count ?? 0,
    known_ai_count: knownAiCount,
    ai_assisted_count: aiCount,
    ai_workload_count: workloadCount,
    ai_estimated_workload: estimated,
    ai_actual_workload: actual,
  }
}

function aggregateSourcePoints(points, metric) {
  const observed = points.filter((point) => point && (point.ir_fact_count ?? point.fact_count) > 0)
  const knownPoints = observed.filter((point) => point.known_ai_count > 0)
  const workloadPoints = observed.filter((point) => point.ai_workload_count > 0 && numeric(point.ai_estimated_workload) && numeric(point.ai_actual_workload))
  const raw = {
    period_id: points.at(-1)?.period_id,
    fact_count: observed.reduce((sum, point) => sum + (point.ir_fact_count ?? point.fact_count), 0),
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

export function buildIROverviewMetricData(payload) {
  const periods = (payload?.period_ids ?? []).map((id) => ({ id, label: id, kind: 'month' }))
  const sourceSeries = payload?.series ?? []
  return Object.fromEntries(IR_OVERVIEW_KPIS.map((metric) => {
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

export function irOverviewMetricSummary({ data, benchmarkData, metric, month, monthTrendIds = [], periodIds = [] } = {}) {
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
    const monthValue = team.values.find((point) => String(point.period_id) === String(month))?.value ?? null
    return {
      teamId: team.team_id,
      teamName: team.team_name,
      value,
      delta: metric.deltaMode === 'month-addition'
        ? monthValue
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
    const monthValue = team.values.find((point) => String(point.period_id) === String(month))?.value ?? null
    return {
      teamId: team.team_id,
      teamName: team.team_name,
      value,
      delta: metric.deltaMode === 'month-addition'
        ? monthValue
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
      factCount: monthPoint?.ir_fact_count ?? 0,
      knownAiCount: monthPoint?.known_ai_count ?? 0,
      aiAssistedCount: monthPoint?.ai_assisted_count ?? null,
      aiWorkloadCount: monthPoint?.ai_workload_count ?? 0,
    },
    periodCoverage: {
      factCount: periodPoint?.ir_fact_count ?? 0,
      knownAiCount: periodPoint?.known_ai_count ?? 0,
      aiAssistedCount: periodPoint?.ai_assisted_count ?? null,
      aiWorkloadCount: periodPoint?.ai_workload_count ?? 0,
    },
  }
}

export function useIROverviewMetrics(fromMonth, toMonth, versionId, onSessionExpired) {
  const [state, setState] = useState({ loading: true, error: null, data: null, benchmarkError: null, benchmarkData: null })
  const sessionExpiredRef = useRef(onSessionExpired)
  sessionExpiredRef.current = onSessionExpired

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const currentVersionId = String(versionId ?? 'all')
    const request = (scopeVersionId) => {
      const params = new URLSearchParams({ from_month: fromMonth, to_month: toMonth, version_id: scopeVersionId })
      return fetchJson(`/api/data-metrics/overview?${params.toString()}`, { signal: controller.signal })
    }
    const currentRequest = request(currentVersionId)
    const benchmarkRequest = currentVersionId === 'all' ? currentRequest : request('all')
    setState({ loading: true, error: null, data: null, benchmarkError: null, benchmarkData: null })
    Promise.allSettled([currentRequest, benchmarkRequest]).then(([current, benchmark]) => {
      if (!active) return
      if (current.status === 'rejected' && current.reason?.name === 'AbortError') return
      if ((current.status === 'rejected' && current.reason?.status === 401)
        || (benchmark.status === 'rejected' && benchmark.reason?.status === 401)) {
        sessionExpiredRef.current?.()
      }
      setState({
        loading: false,
        error: current.status === 'rejected' ? current.reason : null,
        data: current.status === 'fulfilled' ? current.value : null,
        benchmarkError: benchmark.status === 'rejected' ? benchmark.reason : null,
        benchmarkData: benchmark.status === 'fulfilled' ? benchmark.value : null,
      })
    })
    return () => { active = false; controller.abort() }
  }, [fromMonth, toMonth, versionId])

  return state
}

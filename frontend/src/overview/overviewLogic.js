import { chartTheme } from '../charts/chartTheme.js'

// Dataviz category colors are intentionally separate from the application primary.
export const DATAVIZ_COLORS = {
  team: chartTheme.team,
  metricType: chartTheme.metricType,
  companyAverage: chartTheme.domainAverage,
  grid: chartTheme.grid,
  axis: chartTheme.axis,
  inkSecondary: chartTheme.inkSecondary,
  muted: chartTheme.muted,
  positive: chartTheme.positive,
  negative: chartTheme.negative,
}

export const TEAM_COLORS = DATAVIZ_COLORS.team
export const TEAM_COLOR_STORAGE_KEY = 'ai-dev-radar.team-color-slots'

export const INITIAL_FILTER = {
  dimension: 'time',
  granularity: 'month',
  versionId: 'all',
  periodId: null,
  metricId: 'all',
  cycle: '6m',
}

export const FILTER_QUERY_KEYS = {
  dimension: 'dimension',
  granularity: 'granularity',
  versionId: 'version',
  periodId: 'period',
  metricId: 'metric',
  cycle: 'cycle',
}

export const MATURITY_QUERY_KEYS = {
  view: 'view',
  category: 'category',
  month: 'month',
  teams: 'teams',
  baseline: 'baseline',
  sort: 'sort',
}

export const MATURITY_DEFAULTS = {
  view: 'domain',
  category: 'key',
  compareTeamIds: [],
  showBaseline: true,
  sort: 'order',
}

export const ANALYSIS_GRANULARITIES = ['month', 'week', 'day']

const EXTENDED_TEAM_COLORS = [
  ...TEAM_COLORS,
  ...chartTheme.extendedTeam,
]

function idKey(value) {
  return String(value)
}

export function currentMonthId(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function previousMonthId(month) {
  const [year, monthNumber] = String(month).split('-').map(Number)
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber)) return null
  const date = new Date(year, monthNumber - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthWindow(month, limit = 6) {
  const end = isValidMonth(month) ? String(month) : currentMonthId()
  const months = []
  let cursor = end
  for (let index = 0; index < Math.max(0, limit); index += 1) {
    months.unshift(cursor)
    cursor = previousMonthId(cursor)
  }
  return months
}

export function analysisWindowMonths(month, cycle = '6m') {
  if (!isValidMonth(month)) return []
  const [year, monthNumber] = String(month).split('-').map(Number)
  const currentIndex = year * 12 + monthNumber - 1
  const startIndex = cycle === 'year'
    ? year * 12
    : cycle === 'half'
      ? year * 12 + (monthNumber > 6 ? 6 : 0)
      : currentIndex - 5
  return Array.from({ length: currentIndex - startIndex + 1 }, (_, offset) => {
    const index = startIndex + offset
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
  })
}

export function analysisWindowLabel(month, cycle = '6m') {
  if (!isValidMonth(month)) return '近6个月'
  const [year, monthNumber] = String(month).split('-').map(Number)
  if (cycle === 'year') return `${year}年度`
  if (cycle === 'half') return `${year}${monthNumber > 6 ? '下半年' : '上半年'}`
  return '近6个月'
}

export function isValidMonth(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value ?? ''))) return false
  const [year, month] = String(value).split('-').map(Number)
  return year >= 1 && year <= 9999 && month >= 1 && month <= 12
}

export function normalizeMaturityState(input = {}, { teams = [] } = {}) {
  const knownTeamIds = teams.length ? new Set(teams.map((team) => idKey(team.id))) : null
  const rawTeamIds = Array.isArray(input.compareTeamIds)
    ? input.compareTeamIds
    : String(input.compareTeamIds ?? '').split(',').filter(Boolean)
  const compareTeamIds = [...new Set(rawTeamIds.map(idKey))]
    .filter((teamId) => /^\d+$/.test(teamId) && (!knownTeamIds || knownTeamIds.has(teamId)))
    .slice(0, 3)

  return {
    view: input.view === 'team' ? 'team' : MATURITY_DEFAULTS.view,
    category: input.category === 'general' ? 'general' : MATURITY_DEFAULTS.category,
    month: isValidMonth(input.month) ? String(input.month) : currentMonthId(),
    compareTeamIds,
    showBaseline: input.showBaseline !== false && input.showBaseline !== '0',
    sort: input.sort === 'score' ? 'score' : MATURITY_DEFAULTS.sort,
  }
}

export function maturityStateFromSearchParams(searchParams, options) {
  return normalizeMaturityState({
    view: searchParams.get(MATURITY_QUERY_KEYS.view),
    category: searchParams.get(MATURITY_QUERY_KEYS.category),
    month: searchParams.get(MATURITY_QUERY_KEYS.month),
    compareTeamIds: searchParams.get(MATURITY_QUERY_KEYS.teams),
    showBaseline: searchParams.get(MATURITY_QUERY_KEYS.baseline) !== '0',
    sort: searchParams.get(MATURITY_QUERY_KEYS.sort),
  }, options)
}

export function maturityStateToSearchParams(state) {
  const normalized = normalizeMaturityState(state)
  const params = new URLSearchParams()
  if (normalized.view !== MATURITY_DEFAULTS.view) params.set(MATURITY_QUERY_KEYS.view, normalized.view)
  if (normalized.category !== MATURITY_DEFAULTS.category) params.set(MATURITY_QUERY_KEYS.category, normalized.category)
  if (normalized.month !== currentMonthId()) params.set(MATURITY_QUERY_KEYS.month, normalized.month)
  if (normalized.compareTeamIds.length) params.set(MATURITY_QUERY_KEYS.teams, normalized.compareTeamIds.join(','))
  if (!normalized.showBaseline) params.set(MATURITY_QUERY_KEYS.baseline, '0')
  if (normalized.sort !== MATURITY_DEFAULTS.sort) params.set(MATURITY_QUERY_KEYS.sort, normalized.sort)
  return params
}

export function maturityStatesEqual(left, right) {
  return left?.view === right?.view
    && left?.category === right?.category
    && left?.month === right?.month
    && left?.showBaseline === right?.showBaseline
    && left?.sort === right?.sort
    && (left?.compareTeamIds ?? []).join(',') === (right?.compareTeamIds ?? []).join(',')
}

function numberFormat(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)
}

export function latestPeriodId(periods) {
  return periods?.length ? idKey(periods[periods.length - 1].id) : 'all'
}

function validIdOrDefault(candidate, items, fallback) {
  if (candidate === 'all') return 'all'
  if (candidate === null || candidate === undefined || candidate === '') return fallback
  if (!items.length || items.some((item) => idKey(item.id) === idKey(candidate))) return idKey(candidate)
  return fallback
}

export function normalizeFilter(input = {}, { versions = [], periods = [] } = {}) {
  const dimension = input.dimension === 'iteration' ? 'iteration' : 'time'
  const granularity = dimension === 'iteration'
    ? 'month'
    : ANALYSIS_GRANULARITIES.includes(input.granularity) ? input.granularity : 'month'
  const versionId = validIdOrDefault(input.versionId, versions, 'all')
  const periodId = input.periodId === 'all'
    ? 'all'
    : validIdOrDefault(input.periodId, periods, null)
  const metricId = input.metricId && input.metricId !== 'all' ? idKey(input.metricId) : 'all'
  const cycle = ['half', 'year'].includes(input.cycle) ? input.cycle : '6m'

  return { dimension, granularity, versionId, periodId, metricId, cycle }
}

export function filtersEqual(left, right) {
  return left?.dimension === right?.dimension
    && left?.granularity === right?.granularity
    && left?.versionId === right?.versionId
    && left?.periodId === right?.periodId
    && (left?.metricId ?? 'all') === (right?.metricId ?? 'all')
    && (left?.cycle ?? '6m') === (right?.cycle ?? '6m')
}

export function filterFromSearchParams(searchParams, options) {
  return normalizeFilter({
    dimension: searchParams.get(FILTER_QUERY_KEYS.dimension),
    granularity: searchParams.get(FILTER_QUERY_KEYS.granularity),
    versionId: searchParams.get(FILTER_QUERY_KEYS.versionId),
    periodId: searchParams.get(FILTER_QUERY_KEYS.periodId),
    metricId: searchParams.get(FILTER_QUERY_KEYS.metricId),
    cycle: searchParams.get(FILTER_QUERY_KEYS.cycle),
  }, options)
}

export function filterToSearchParams(filter) {
  const params = new URLSearchParams()
  if (filter.dimension === 'iteration') params.set(FILTER_QUERY_KEYS.dimension, 'iteration')
  if (filter.dimension !== 'iteration' && filter.granularity !== 'month') {
    params.set(FILTER_QUERY_KEYS.granularity, filter.granularity)
  }
  if (filter.versionId !== 'all') {
    params.set(FILTER_QUERY_KEYS.versionId, String(filter.versionId))
  }
  if (filter.periodId !== null && filter.periodId !== undefined) {
    params.set(FILTER_QUERY_KEYS.periodId, String(filter.periodId))
  }
  if (filter.metricId && filter.metricId !== 'all') {
    params.set(FILTER_QUERY_KEYS.metricId, String(filter.metricId))
  }
  if ((filter.cycle ?? '6m') !== '6m') params.set(FILTER_QUERY_KEYS.cycle, filter.cycle)
  return params
}

export function trimToRecentPeriods(data, limit = 6) {
  const periods = data?.periods ?? []
  const keptPeriods = periods.slice(-Math.max(0, limit))
  const periodIds = new Set(keptPeriods.map((period) => idKey(period.id)))

  function align(values = []) {
    const valuesByPeriod = new Map(values.map((point) => [idKey(point.period_id), point]))
    return keptPeriods
      .map((period) => valuesByPeriod.get(idKey(period.id)))
      .filter(Boolean)
      .filter((point) => periodIds.has(idKey(point.period_id)))
  }

  return {
    ...data,
    periods: keptPeriods,
    series: (data?.series ?? []).map((series) => ({
      ...series,
      values: align(series.values),
    })),
    company_average: align(data?.company_average),
    domain_summary: align(data?.domain_summary),
  }
}

export function trimToAnalysisWindow(data, { month, limit = 6 } = {}) {
  if (!data || !isValidMonth(month)) return data
  const [year, monthNumber] = month.split('-').map(Number)
  const end = new Date(Date.UTC(year, monthNumber, 0))
  const granularity = data.granularity ?? data.periods?.[0]?.kind ?? 'month'
  const isoDate = (date) => date.toISOString().slice(0, 10)
  const periodFor = (date) => {
    if (granularity === 'day') {
      const id = isoDate(date)
      return { id, label: id, kind: 'day', start_date: id, end_date: id }
    }
    if (granularity === 'week') {
      const monday = new Date(date)
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
      const thursday = new Date(monday)
      thursday.setUTCDate(thursday.getUTCDate() + 3)
      const isoYear = thursday.getUTCFullYear()
      const firstThursday = new Date(Date.UTC(isoYear, 0, 4))
      firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7))
      const week = Math.round((thursday - firstThursday) / 604800000) + 1
      const id = `${isoYear}-W${String(week).padStart(2, '0')}`
      const sunday = new Date(monday)
      sunday.setUTCDate(sunday.getUTCDate() + 6)
      return { id, label: id, kind: 'week', start_date: isoDate(monday), end_date: isoDate(sunday) }
    }
    const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    const id = isoDate(first).slice(0, 7)
    return { id, label: id, kind: 'month', start_date: isoDate(first), end_date: isoDate(last) }
  }
  const existingPeriods = new Map((data.periods ?? []).map((period) => [idKey(period.id), period]))
  const keptPeriods = Array.from({ length: Math.max(0, limit) }, (_, index) => {
    const offset = limit - index - 1
    const date = new Date(end)
    if (granularity === 'day') date.setUTCDate(date.getUTCDate() - offset)
    else if (granularity === 'week') date.setUTCDate(date.getUTCDate() - offset * 7)
    else date.setUTCMonth(date.getUTCMonth() - offset, 1)
    const expected = periodFor(date)
    return existingPeriods.get(idKey(expected.id)) ?? expected
  })
  const periodIds = new Set(keptPeriods.map((period) => idKey(period.id)))

  function align(values = []) {
    const valuesByPeriod = new Map(values.map((point) => [idKey(point.period_id), point]))
    return keptPeriods
      .map((period) => valuesByPeriod.get(idKey(period.id)))
      .filter(Boolean)
      .filter((point) => periodIds.has(idKey(point.period_id)))
  }

  return {
    ...data,
    periods: keptPeriods,
    series: (data.series ?? []).map((series) => ({ ...series, values: align(series.values) })),
    company_average: align(data.company_average),
    domain_summary: align(data.domain_summary),
  }
}

export function assignTeamColorSlots(teamIds, previousSlots = {}) {
  const slots = Object.fromEntries(
    Object.entries(previousSlots ?? {}).map(([teamId, slot]) => [idKey(teamId), Number(slot)]),
  )
  const usedSlots = new Set(Object.values(slots).filter((slot) => Number.isInteger(slot) && slot >= 0))

  for (const teamId of teamIds) {
    const key = idKey(teamId)
    if (slots[key] !== undefined) continue

    const firstFreeSlot = TEAM_COLORS.findIndex((_, slot) => !usedSlots.has(slot))
    if (firstFreeSlot >= 0) {
      slots[key] = firstFreeSlot
      usedSlots.add(firstFreeSlot)
      continue
    }

    const nextSlot = Math.max(3, ...usedSlots) + 1
    slots[key] = nextSlot
    usedSlots.add(nextSlot)
  }

  const colors = Object.fromEntries(
    teamIds.map((teamId) => {
      const slot = slots[idKey(teamId)]
      return [idKey(teamId), EXTENDED_TEAM_COLORS[slot % EXTENDED_TEAM_COLORS.length]]
    }),
  )

  return { slots, colors }
}

export function formatMetricValue(metric, value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'

  if (metric.type === 'penetration' || metric.type === 'ratio') {
    return `${Math.round(value * 100)}%`
  }
  if (metric.type === 'efficiency') {
    return `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`
  }
  if (metric.type === 'boolean' || metric.type === 'bool') {
    return value ? '具备' : '不具备'
  }
  return numberFormat(value)
}

export function formatFactSummary(metric, point) {
  if (!point || point.value === null || point.value === undefined) return '暂无事实数据'

  if (metric.type === 'efficiency') {
    const estimated = point.estimated ?? point.numerator ?? 0
    const actual = point.actual ?? point.denominator ?? 0
    return `预估 Σ${numberFormat(estimated)} 人天 · 实际 Σ${numberFormat(actual)} 人天`
  }

  const numerator = numberFormat(point.numerator ?? 0)
  if (!metric.denominator_semantic) {
    return `${metric.numerator_semantic} Σ${numerator}`
  }
  return `${metric.numerator_semantic} Σ${numerator} / ${metric.denominator_semantic} Σ${numberFormat(point.denominator ?? 0)}`
}

function numericValue(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function aggregateMetricValue(metric, points) {
  if (!points.length) return null

  if (metric.type === 'penetration' || metric.type === 'ratio') {
    const numerator = points.reduce((sum, point) => sum + (point.numerator ?? 0), 0)
    const denominator = points.reduce((sum, point) => sum + (point.denominator ?? 0), 0)
    return denominator > 0 ? numerator / denominator : null
  }

  if (metric.type === 'efficiency') {
    const estimated = points.reduce((sum, point) => sum + (point.estimated ?? point.numerator ?? 0), 0)
    const actual = points.reduce((sum, point) => sum + (point.actual ?? point.denominator ?? 0), 0)
    if (estimated === 0 && actual === 0) return null
    return (estimated - actual) / (actual > 0 ? actual : 0.5)
  }

  if (metric.type === 'count') return points.reduce((sum, point) => sum + (point.numerator ?? 0), 0)
  if (metric.type === 'boolean') return points.at(-1)?.value ?? null
  return null
}

export function valueForPeriod(data, metric, teamId, periodId) {
  const series = (data?.series ?? []).find((item) => idKey(item.team_id) === idKey(teamId))
  if (!series) return null
  if (metric.type === 'boolean') return series.snapshot ?? null
  const points = (series.values ?? []).filter((point) => point.fact_count !== 0)
  if (periodId !== 'all' && periodId !== null && periodId !== undefined) {
    return points.find((point) => idKey(point.period_id) === idKey(periodId))?.value ?? null
  }
  return aggregateMetricValue(metric, points)
}

export function currentMetricValues(data, metric, periodId) {
  const companyValues = periodId === 'all' || periodId === null || periodId === undefined
    ? (data?.series ?? [])
      .map((series) => valueForPeriod(data, metric, series.team_id, 'all'))
      .filter(numericValue)
    : []
  const companyValue = companyValues.length
    ? companyValues.reduce((sum, value) => sum + value, 0) / companyValues.length
    : data?.company_average?.find((point) => idKey(point.period_id) === idKey(periodId))?.value ?? null

  return {
    teams: (data?.series ?? []).map((series) => ({
      team_id: series.team_id,
      team_name: series.team_name,
      value: valueForPeriod(data, metric, series.team_id, periodId),
    })),
    company: { value: companyValue },
  }
}

export function currentSnapshot(data, periodId) {
  if (!data || periodId === 'all' || periodId === null || periodId === undefined) return null

  const selectedId = idKey(periodId)
  return {
    teams: (data.series ?? []).map((series) => ({
      team_id: series.team_id,
      team_name: series.team_name,
      point: (series.values ?? []).find((point) => idKey(point.period_id) === selectedId && point.fact_count !== 0),
    })),
    company: (data.company_average ?? []).find((point) => idKey(point.period_id) === selectedId),
  }
}

export function hasFactValue(value) {
  return (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean'
}

export function metricPointForMonth(data, month, totalTeamCount = data?.series?.length ?? 0) {
  const period = (data?.periods ?? []).find((item) => idKey(item.id) === idKey(month)) ?? null
  const company = period
    ? (data?.company_average ?? []).find((item) => idKey(item.period_id) === idKey(month)) ?? null
    : null
  const teams = (data?.series ?? []).map((series) => ({
    teamId: series.team_id,
    teamName: series.team_name,
    point: period ? (series.values ?? []).find((item) => idKey(item.period_id) === idKey(month) && item.fact_count !== 0) ?? null : null,
  }))
  const validTeamCount = teams.filter((team) => hasFactValue(team.point?.value)).length

  return {
    period,
    company,
    teams,
    validTeamCount,
    totalTeamCount,
    hasData: validTeamCount > 0 || hasFactValue(company?.value),
  }
}

export function buildMetricRows({ activities = [], dataByMetric = {}, errors = {}, month, teams = [] } = {}) {
  return activities.flatMap((activity, activityIndex) => activity.metrics.map((metric, metricIndex) => {
    const snapshot = metricPointForMonth(dataByMetric[metric.id], month, teams.length)
    const booleanTeams = snapshot.teams.filter((team) => typeof team.point?.value === 'boolean')
    return {
      activity,
      metric,
      activityIndex,
      metricIndex,
      ...snapshot,
      error: errors[metric.id] ?? null,
      booleanTrueCount: booleanTeams.filter((team) => team.point.value).length,
      hasData: Boolean(errors[metric.id]) ? false : snapshot.hasData,
    }
  }))
}

export function factCompleteness(rows = []) {
  const available = rows.filter((row) => row.hasData).length
  return {
    available,
    total: rows.length,
    rate: rows.length ? available / rows.length : null,
  }
}

export function maturityAverageScore(data) {
  const scores = (data?.activities ?? [])
    .map((activity) => activity.score)
    .filter((score) => typeof score === 'number' && Number.isFinite(score))
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null
}

export function buildMaturityTrendRows({ history = [], activities = [], months = [] } = {}) {
  const dataByMonth = new Map(history.map((entry) => [idKey(entry.month), entry.data]))
  return activities.map((activity) => {
    const values = months.map((month) => {
      const summary = dataByMonth.get(idKey(month))?.activities?.find((item) => idKey(item.activity_id) === idKey(activity.activity_id ?? activity.id))
      return typeof summary?.score === 'number' && Number.isFinite(summary.score) ? summary.score : null
    })
    const value = values.at(-1) ?? null
    const previous = values.at(-2) ?? null
    return {
      activity,
      values,
      value,
      delta: numericValue(value) && numericValue(previous) ? value - previous : null,
      hasData: numericValue(value),
    }
  })
}

export function buildMetricTrendRows({ activities = [], dataByMetric = {}, errors = {}, months = [], teams = [] } = {}) {
  return activities.flatMap((activity) => activity.metrics.map((metric) => {
    const data = dataByMetric[metric.id]
    const points = months.map((month) => metricPointForMonth(data, month, teams.length))
    const current = points.at(-1)
    const previous = points.at(-2)
    const value = current?.company?.value
    const previousValue = previous?.company?.value
    return {
      activity,
      metric,
      data,
      points,
      values: points.map((point) => numericValue(point.company?.value) ? point.company.value : null),
      value: numericValue(value) ? value : null,
      delta: numericValue(value) && numericValue(previousValue) ? value - previousValue : null,
      validTeamCount: current?.validTeamCount ?? 0,
      totalTeamCount: current?.totalTeamCount ?? teams.length,
      hasData: Boolean(errors[metric.id]) ? false : Boolean(current?.hasData),
      error: errors[metric.id] ?? null,
      statusRows: current?.teams ?? [],
    }
  }))
}

export function bestAndWeakestRows(rows = []) {
  const available = rows.filter((row) => numericValue(row.value))
  if (!available.length) return { best: null, weakest: null }
  const ordered = [...available].sort((left, right) => right.value - left.value)
  return { best: ordered[0], weakest: ordered.at(-1) }
}

export function buildAttentionItems({ activities = [], dataByMetric = {}, errors = {}, maturityData, month, teams = [] } = {}) {
  const rows = buildMetricRows({ activities, dataByMetric, errors, month, teams })
  const items = new Map()

  function add(item) {
    const key = `${item.type}:${item.metricId ?? item.activityId}:${item.teamId ?? 'domain'}`
    const current = items.get(key)
    if (!current || item.priority < current.priority) items.set(key, item)
  }

  ;(maturityData?.activities ?? []).forEach((activity) => {
    if (!hasFactValue(activity.score)) {
      add({
        type: 'maturity-missing',
        priority: 1,
        activityId: activity.activity_id,
        activityName: activity.activity_name,
        reason: '缺失成熟度评估',
      })
    }
  })

  rows.forEach((row) => {
    if (!row.hasData) {
      add({
        type: 'fact-missing',
        priority: 2,
        activityId: row.activity.id,
        activityName: row.activity.name,
        metricId: row.metric.id,
        metricName: row.metric.name,
        metricType: row.metric.type,
        reason: row.error ? '事实加载失败' : '缺失事实',
      })
      return
    }

    const negativeTeams = row.teams.filter((team) => typeof team.point?.value === 'number' && row.metric.type === 'efficiency' && team.point.value < 0)
    negativeTeams.forEach((team) => add({
      type: 'negative-efficiency',
      priority: 0,
      activityId: row.activity.id,
      activityName: row.activity.name,
      metricId: row.metric.id,
      metricName: row.metric.name,
      metricType: row.metric.type,
      teamId: team.teamId,
      teamName: team.teamName,
      value: team.point.value,
      reason: '负提效',
    }))

    const domainValue = row.company?.value
    if (typeof domainValue === 'number' && Number.isFinite(domainValue)) {
      row.teams.forEach((team) => {
        if (typeof team.point?.value === 'number' && team.point.value < domainValue) {
          add({
            type: 'relative-behind',
            priority: 3,
            activityId: row.activity.id,
            activityName: row.activity.name,
            metricId: row.metric.id,
            metricName: row.metric.name,
            metricType: row.metric.type,
            teamId: team.teamId,
            teamName: team.teamName,
            value: team.point.value,
            domainValue,
            reason: '相对靠后',
          })
        }
      })
    }
  })

  return [...items.values()].sort((left, right) => (
    left.priority - right.priority
    || (left.activityId ?? 0) - (right.activityId ?? 0)
    || String(left.teamName ?? '').localeCompare(String(right.teamName ?? ''))
  ))
}

export function iterationPeriods(versions = [], versionId = 'all') {
  return versions
    .filter((version) => versionId === 'all' || String(version.id) === String(versionId))
    .flatMap((version) => version.iterations.map((iteration) => ({
      id: iteration.id,
      label: iteration.name,
    })))
}

export function isGeneralIterationFallback(activity, filter) {
  return activity.kind === 'general' && filter.dimension === 'iteration'
}

export function queryForActivity(activity, filter) {
  const fallback = isGeneralIterationFallback(activity, filter)
  return {
    dimension: fallback ? 'time' : filter.dimension,
    granularity: fallback ? 'month' : filter.granularity,
    versionId: fallback || activity?.kind === 'general' ? null : filter.versionId,
    fallback,
  }
}

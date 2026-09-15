// Dataviz category colors are intentionally separate from the application primary.
export const DATAVIZ_COLORS = {
  team: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
  companyAverage: '#98a2b3',
  grid: '#eaecf0',
  axis: '#d0d5dd',
  inkSecondary: '#475467',
  muted: '#667085',
  positive: '#067647',
  negative: '#b42318',
}

export const TEAM_COLORS = DATAVIZ_COLORS.team
export const TEAM_COLOR_STORAGE_KEY = 'ai-dev-radar.team-color-slots'

export const INITIAL_FILTER = {
  dimension: 'time',
  granularity: 'month',
  versionId: 'all',
  periodId: null,
}

export const FILTER_QUERY_KEYS = {
  dimension: 'dimension',
  granularity: 'granularity',
  versionId: 'version',
  periodId: 'period',
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

const EXTENDED_TEAM_COLORS = [
  ...TEAM_COLORS,
  '#8256a1',
  '#607d8b',
  '#d14d72',
  '#8c6d3f',
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

function validMonth(value) {
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
    month: validMonth(input.month) ? String(input.month) : currentMonthId(),
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
    : input.granularity === 'week' ? 'week' : 'month'
  const versionId = dimension === 'iteration'
    ? validIdOrDefault(input.versionId, versions, 'all')
    : 'all'
  const periodId = input.periodId === 'all'
    ? 'all'
    : validIdOrDefault(input.periodId, periods, null)

  return { dimension, granularity, versionId, periodId }
}

export function filtersEqual(left, right) {
  return left?.dimension === right?.dimension
    && left?.granularity === right?.granularity
    && left?.versionId === right?.versionId
    && left?.periodId === right?.periodId
}

export function filterFromSearchParams(searchParams, options) {
  return normalizeFilter({
    dimension: searchParams.get(FILTER_QUERY_KEYS.dimension),
    granularity: searchParams.get(FILTER_QUERY_KEYS.granularity),
    versionId: searchParams.get(FILTER_QUERY_KEYS.versionId),
    periodId: searchParams.get(FILTER_QUERY_KEYS.periodId),
  }, options)
}

export function filterToSearchParams(filter) {
  const params = new URLSearchParams()
  if (filter.dimension === 'iteration') params.set(FILTER_QUERY_KEYS.dimension, 'iteration')
  if (filter.dimension !== 'iteration' && filter.granularity === 'week') {
    params.set(FILTER_QUERY_KEYS.granularity, 'week')
  }
  if (filter.dimension === 'iteration' && filter.versionId !== 'all') {
    params.set(FILTER_QUERY_KEYS.versionId, String(filter.versionId))
  }
  if (filter.periodId !== null && filter.periodId !== undefined) {
    params.set(FILTER_QUERY_KEYS.periodId, String(filter.periodId))
  }
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
  const points = series.values ?? []
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
      point: (series.values ?? []).find((point) => idKey(point.period_id) === selectedId),
    })),
    company: (data.company_average ?? []).find((point) => idKey(point.period_id) === selectedId),
  }
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
    versionId: fallback ? null : filter.versionId,
    fallback,
  }
}

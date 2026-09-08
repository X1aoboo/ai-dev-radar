export const TEAM_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100']

export const INITIAL_FILTER = {
  dimension: 'time',
  granularity: 'month',
  versionId: 'all',
  periodId: null,
  metricSlot: 0,
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

function numberFormat(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)
}

export function latestPeriodId(periods) {
  return periods?.length ? idKey(periods[periods.length - 1].id) : 'all'
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

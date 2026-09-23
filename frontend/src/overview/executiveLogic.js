function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export const EXECUTIVE_TREND_CODES = ['cd-ar-pen', 'cd-eff', 'mrr-rate']

const LIFECYCLE_STAGES = [
  { id: 'requirements', label: '需求', metricCode: 'sa-ir-pen' },
  { id: 'design', label: '设计', metricCode: 'se-eff' },
  { id: 'development', label: '开发', metricCode: 'cd-eff' },
  { id: 'review', label: '检视', metricCode: 'mrr-rate' },
  { id: 'testing', label: '测试', metricCode: 'tcg-rate' },
  { id: 'delivery', label: '交付', metricCode: 'ad-bool' },
]

export function factCoverage(rows = []) {
  const available = rows.filter((row) => row.hasData).length
  return { available, total: rows.length }
}

export function executiveFactRows(metricRows = [], limit = 2) {
  const byCode = new Map(metricRows.map((row) => [row.metric.code, row]))
  const selected = EXECUTIVE_TREND_CODES.map((code) => byCode.get(code)).filter((row) => row && row.metric.type !== 'boolean')
  for (const row of metricRows) {
    if (selected.length >= limit) break
    if (row.metric.type !== 'boolean' && !selected.includes(row)) selected.push(row)
  }
  return selected.slice(0, limit)
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

export function lifecycleRows(metricRows = []) {
  return LIFECYCLE_STAGES.map((stage) => ({
    stage,
    row: metricRows.find((item) => item.metric.code === stage.metricCode) ?? null,
  }))
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

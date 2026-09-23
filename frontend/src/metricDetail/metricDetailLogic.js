export function findMetric(catalog, metricId) {
  const requestedId = String(metricId)
  for (const activity of catalog ?? []) {
    const metric = (activity.metrics ?? []).find((item) => String(item.id) === requestedId)
    if (metric) return { activity, metric }
  }
  return null
}

export function booleanStatusRows(data, teams = [], periodId = null) {
  const seriesByTeam = new Map((data?.series ?? []).map((series) => [String(series.team_id), series]))

  return teams.map((team) => {
    const series = seriesByTeam.get(String(team.id))
    const selected = periodId !== null && periodId !== undefined && periodId !== 'all'
      ? series?.values?.find((point) => String(point.period_id) === String(periodId))?.value
      : series?.snapshot
    const value = selected === null || selected === undefined ? null : Boolean(selected)
    return {
      team,
      value,
      state: value === null ? 'unknown' : value ? 'yes' : 'no',
    }
  })
}

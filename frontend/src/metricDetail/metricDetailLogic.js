export function findMetric(catalog, metricId) {
  const requestedId = String(metricId)
  for (const activity of catalog ?? []) {
    const metric = (activity.metrics ?? []).find((item) => String(item.id) === requestedId)
    if (metric) return { activity, metric }
  }
  return null
}

export function booleanStatusRows(data, teams = []) {
  const snapshots = new Map(
    (data?.series ?? []).map((series) => [String(series.team_id), series.snapshot]),
  )

  return teams.map((team) => {
    const snapshot = snapshots.get(String(team.id))
    const value = snapshot === null || snapshot === undefined ? null : Boolean(snapshot)
    return {
      team,
      value,
      state: value === null ? 'unknown' : value ? 'yes' : 'no',
    }
  })
}

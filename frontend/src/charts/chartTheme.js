function colorToken(name, fallback) {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function palette(prefix, names, fallbacks) {
  return names.map((name, index) => colorToken(`${prefix}${name}`, fallbacks[index]))
}

export const chartTheme = {
  get axis() { return colorToken('--color-data-axis', '#d0d5dd') },
  get grid() { return colorToken('--color-data-grid', '#eaecf0') },
  get inkSecondary() { return colorToken('--color-text-secondary', '#475467') },
  get muted() { return colorToken('--color-text-tertiary', '#667085') },
  get positive() { return colorToken('--color-success', '#039855') },
  get negative() { return colorToken('--color-danger', '#d92d20') },
  get text() { return colorToken('--color-text-secondary', '#475467') },
  get fontFamily() { return colorToken('--font-sans', 'sans-serif') },
  get team() { return palette('--color-data-team-', ['1', '2', '3', '4'], ['#1f6feb', '#168e67', '#e88222', '#7756d8']) },
  get extendedTeam() { return palette('--color-data-team-', ['5', '6', '7', '8'], ['#0f9d9a', '#5f6b7a', '#c3436e', '#80533d']) },
  get metricType() {
    const team = this.team
    const extended = this.extendedTeam
    return { penetration: team[0], efficiency: team[3], count: extended[0], ratio: team[2] }
  },
  get domainAverage() { return colorToken('--color-data-average', '#667085') },
  get target() { return colorToken('--color-data-target', '#a5adba') },
  get maturity() { return palette('--color-data-maturity-', ['0', '1', '2', '3', '4', '5'], ['#98a2b3', '#d0d5dd', '#fec84b', '#fdb022', '#12b76a', '#039855']) },
}

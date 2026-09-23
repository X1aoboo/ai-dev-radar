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
  get team() { return palette('--color-data-team-', ['1', '2', '3', '4'], ['#2a78d6', '#eb6834', '#1baf7a', '#eda100']) },
  get extendedTeam() { return palette('--color-data-team-', ['5', '6', '7', '8'], ['#8256a1', '#607d8b', '#d14d72', '#8c6d3f']) },
  get domainAverage() { return colorToken('--color-data-average', '#98a2b3') },
  get target() { return colorToken('--color-data-target', '#98a2b3') },
  get maturity() { return palette('--color-data-maturity-', ['0', '1', '2', '3', '4', '5'], ['#98a2b3', '#d0d5dd', '#fec84b', '#fdb022', '#12b76a', '#039855']) },
}

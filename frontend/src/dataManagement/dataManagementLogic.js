export function sectionFromPath(pathname = '') {
  if (/^\/data\/requirements(?:\/[^/]+)?\/?$/i.test(pathname)) return 'requirements'
  const match = pathname.match(/^\/(?:data|data-management)(?:\/([^/]+))?$/)
  if (match) {
    const domain = (match[1] || 'requirements').toLowerCase()
    if (['ir', 'ar', 'sr'].includes(domain)) return 'requirements'
    return domain
  }
  const settingsMatch = pathname.match(/^\/settings\/([^/]+)$/)
  return settingsMatch?.[1] || 'requirements'
}

export function metricValueLabel(metricType) {
  return {
    penetration: '渗透率',
    efficiency: '效率提升',
    count: '数量',
    boolean: '布尔状态',
    ratio: '比率',
    manual_only: '仅补录',
  }[metricType] ?? metricType
}

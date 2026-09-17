export const ANALYTICS_ROLES = ['admin', 'maintainer', 'viewer']
export const DATA_READ_ROLES = ANALYTICS_ROLES
export const SETTINGS_READ_ROLES = ANALYTICS_ROLES
export const ADMIN_ROLES = ['admin']
export const PENDING_DOMAINS = ['issues', 'mr', 'code-review']

export function canAccess(roles, role) {
  return roles.includes(role)
}

export function isPendingDomain(domain) {
  return PENDING_DOMAINS.includes(domain?.toLowerCase())
}

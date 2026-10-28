export const ANALYTICS_ROLES = ['admin', 'maintainer', 'viewer']
export const DATA_READ_ROLES = ANALYTICS_ROLES
export const SETTINGS_READ_ROLES = ANALYTICS_ROLES
export const ADMIN_ROLES = ['admin']
export const PENDING_DOMAINS = ['issues', 'mr', 'code-review']

export const REQUIREMENT_ACTIVITIES = ['design', 'development']
export const DEFAULT_REQUIREMENT_ACTIVITY = 'design'
export const LEGACY_REQUIREMENT_ACTIVITY_TARGETS = Object.freeze({
  ir: 'design',
  sr: 'design',
  ar: 'development',
})

export function canAccess(roles, role) {
  return roles.includes(role)
}

export function isPendingDomain(domain) {
  return PENDING_DOMAINS.includes(domain?.toLowerCase())
}

export function isRequirementActivity(activity) {
  return REQUIREMENT_ACTIVITIES.includes(String(activity ?? '').toLowerCase())
}

export function legacyRequirementActivityTarget(requirementType) {
  return LEGACY_REQUIREMENT_ACTIVITY_TARGETS[String(requirementType ?? '').toLowerCase()] ?? null
}

export function normalizeRequirementActivity(activity) {
  const normalized = String(activity ?? '').toLowerCase()
  if (isRequirementActivity(normalized)) return normalized
  return legacyRequirementActivityTarget(normalized) ?? DEFAULT_REQUIREMENT_ACTIVITY
}

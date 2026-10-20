export const TEAM_ROLES = [
  { value: 'SA', label: 'SA', tone: 'sa', description: '解决方案/系统分析' },
  { value: 'SE', label: 'SE', tone: 'se', description: '系统设计' },
  { value: 'MDE', label: 'MDE', tone: 'mde', description: '模块设计/开发' },
  { value: '开发', label: '开发', tone: 'dev', description: '开发' },
  { value: '测试', label: '测试', tone: 'test', description: '测试' },
]

export const TEAM_ROLE_VALUES = TEAM_ROLES.map((role) => role.value)

export function roleMeta(role) {
  return TEAM_ROLES.find((item) => item.value === role) ?? {
    value: role || '未设置',
    label: role || '未设置',
    tone: 'other',
    description: '历史角色，待统一',
    legacy: true,
  }
}

export function roleOptions(currentRole) {
  const options = TEAM_ROLES.map((role) => ({ value: role.value, label: role.label }))
  if (currentRole && !TEAM_ROLE_VALUES.includes(currentRole)) {
    options.unshift({ value: currentRole, label: `${currentRole}（历史）` })
  }
  return options
}

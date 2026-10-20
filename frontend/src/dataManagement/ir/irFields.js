export const IR_GROUPS = [
  { key: 'requirement', label: '需求信息' },
  { key: 'ownership', label: '归属' },
  { key: 'people', label: '责任人' },
  { key: 'workload', label: '工作量（人天）' },
  { key: 'ai', label: 'AI 属性' },
  { key: 'time', label: '时间' },
  { key: 'other', label: '备注' },
]

export const IR_PROGRESS_OPTIONS = [
  { value: '未开始', label: '未开始', tone: 'todo' },
  { value: '进行中', label: '进行中', tone: 'doing' },
  { value: '完成', label: '完成', tone: 'done' },
  { value: '已关闭', label: '已关闭', tone: 'closed' },
]

export const IR_QUALITY_OPTIONS = [
  { value: '优秀', label: '优秀', tone: 'success' },
  { value: '良好', label: '良好', tone: 'info' },
  { value: '合格', label: '合格', tone: 'neutral' },
]

export const IR_BOOL_OPTIONS = [
  { value: true, label: '是' },
  { value: false, label: '否' },
]

export const IR_AI_MODE_SUGGESTIONS = ['设计开发一体化', '超级单兵', '全栈开发', '设计一体化']

export const IR_TEMPLATE_HEADERS = [
  '需求类型', '需求编号', '需求标题', '所属功能', '进展', '归属组', 'PI', '迭代',
  'SA', 'SE', '预估工作量(SA)', '实际工作量(SA)', '预估工作量(SE)', '实际工作量(SE)',
  'AI质检等级', 'AI适用性', 'SA是否使用AI', 'SE是否使用AI', 'AI研发模式', '设计时间', '备注',
]

export const IR_FIELDS = [
  { key: 'requirement_type', label: '需求类型', group: 'requirement', type: 'enum', options: ['IR'], width: 60, template: true, required: false, editable: false, render: 'type' },
  { key: 'requirement_no', label: '需求编号', group: 'requirement', type: 'text', width: 146, template: true, required: true, editable: false, render: 'id' },
  { key: 'requirement_name', label: '需求标题', group: 'requirement', type: 'text', width: 180, template: true, required: true, editable: true, render: 'title' },
  { key: 'business_module', label: '所属功能', group: 'requirement', type: 'text', width: 112, template: true, required: true, editable: true, render: 'text' },
  { key: 'progress', label: '进展', group: 'requirement', type: 'enum', options: IR_PROGRESS_OPTIONS, width: 80, template: true, required: true, editable: true, render: 'status' },
  { key: 'team_name', label: '归属组', group: 'ownership', type: 'text', width: 104, template: true, required: true, editable: false, render: 'text' },
  { key: 'version_name', label: 'PI', group: 'ownership', type: 'text', width: 140, template: true, required: true, editable: false, render: 'text' },
  { key: 'iteration_name', label: '迭代', group: 'ownership', type: 'text', width: 108, template: true, required: true, editable: false, render: 'text' },
  { key: 'sa_owner', label: 'SA', group: 'people', type: 'owner', width: 108, template: true, required: false, editable: false, render: 'owner' },
  { key: 'se_owner', label: 'SE', group: 'people', type: 'owner', width: 108, template: true, required: true, editable: false, render: 'owner' },
  { key: 'sa_estimated_workload', label: '预估工作量(SA)', group: 'workload', type: 'number', width: 84, template: true, required: false, editable: true, render: 'number' },
  { key: 'sa_actual_workload', label: '实际工作量(SA)', group: 'workload', type: 'number', width: 84, template: true, required: false, editable: true, render: 'number' },
  { key: 'se_estimated_workload', label: '预估工作量(SE)', group: 'workload', type: 'number', width: 84, template: true, required: false, editable: true, render: 'number' },
  { key: 'se_actual_workload', label: '实际工作量(SE)', group: 'workload', type: 'number', width: 84, template: true, required: false, editable: true, render: 'number' },
  { key: 'ai_quality_level', label: 'AI质检等级', group: 'ai', type: 'enum', options: IR_QUALITY_OPTIONS, width: 84, template: true, required: false, editable: true, render: 'tag' },
  { key: 'ai_applicability', label: 'AI适用性', group: 'ai', type: 'bool', width: 68, template: true, required: false, editable: true, render: 'bool' },
  { key: 'sa_ai_assisted', label: 'SA是否使用AI', group: 'ai', type: 'bool', width: 62, template: true, required: false, editable: true, render: 'bool' },
  { key: 'se_ai_assisted', label: 'SE是否使用AI', group: 'ai', type: 'bool', width: 62, template: true, required: false, editable: true, render: 'bool' },
  { key: 'ai_dev_mode', label: 'AI研发模式', group: 'ai', type: 'text', suggestions: IR_AI_MODE_SUGGESTIONS, width: 100, template: true, required: false, editable: true, render: 'tag' },
  { key: 'completed_at', label: '设计时间', group: 'time', type: 'date', width: 88, template: true, required: true, editable: true, render: 'date' },
  { key: 'remark', label: '备注', group: 'other', type: 'text', width: 116, template: true, required: false, editable: true, render: 'muted' },
]

export const IR_FIELD_BY_KEY = Object.fromEntries(IR_FIELDS.map((field) => [field.key, field]))
export const IR_FIELD_LABELS = Object.fromEntries(IR_FIELDS.map((field) => [field.key, field.label]))
export const IR_TEMPLATE_FIELDS = IR_FIELDS.filter((field) => field.template)
export const IR_TEMPLATE_KEYS = IR_TEMPLATE_FIELDS.map((field) => field.key)

export const IR_VIEW_PRESETS = [
  {
    value: 'all',
    label: '全部模板字段',
    keys: IR_TEMPLATE_KEYS,
  },
  {
    value: 'standard',
    label: '标准',
    keys: [
      'requirement_type', 'requirement_no', 'requirement_name', 'business_module', 'progress',
      'team_name', 'version_name', 'iteration_name', 'sa_owner', 'se_owner',
      'total_workload', 'ai_quality_level', 'ai_applicability', 'sa_ai_assisted', 'se_ai_assisted',
      'completed_at', 'remark',
    ],
  },
  {
    value: 'workload',
    label: '工作量',
    keys: [
      'requirement_no', 'requirement_name', 'team_name', 'version_name',
      'sa_estimated_workload', 'sa_actual_workload', 'se_estimated_workload', 'se_actual_workload',
      'total_workload', 'completed_at',
    ],
  },
  {
    value: 'ai',
    label: 'AI 属性',
    keys: [
      'requirement_no', 'requirement_name', 'team_name', 'progress',
      'ai_quality_level', 'ai_applicability', 'sa_ai_assisted', 'se_ai_assisted', 'ai_dev_mode',
      'completed_at',
    ],
  },
]

export function irFieldOptions(field) {
  if (Array.isArray(field.options)) return field.options
  return []
}

export function irProgressTone(value) {
  return IR_PROGRESS_OPTIONS.find((option) => option.value === value)?.tone ?? 'todo'
}

export function irQualityTone(value) {
  return IR_QUALITY_OPTIONS.find((option) => option.value === value)?.tone ?? 'neutral'
}

export function irPersonText(name, employeeId) {
  if (name && employeeId) return `${name} ${employeeId}`
  return name || employeeId || ''
}

export function parseOwnerText(text) {
  const value = String(text ?? '').trim()
  if (!value) return { name: null, employeeId: null }
  const match = value.match(/^(.*?)[\s,，]+([A-Za-z0-9_-]+)$/)
  if (match && match[1].trim()) return { name: match[1].trim(), employeeId: match[2].trim() }
  if (/^[A-Za-z]*\d+$/.test(value)) return { name: null, employeeId: value }
  return { name: value, employeeId: null }
}

export function irOwnerValue(record, owner) {
  if (owner === 'sa') {
    return {
      text: irPersonText(record.sa_owner_name || record.sa_employee_name, record.sa_employee_id),
      pending: Boolean(record.sa_employee_pending),
    }
  }
  return {
    text: irPersonText(record.se_owner_name || record.se_employee_name, record.se_employee_id),
    pending: Boolean(record.se_employee_pending),
  }
}

export function irDisplayValue(record, key) {
  if (key === 'sa_owner') return irOwnerValue(record, 'sa').text
  if (key === 'se_owner') return irOwnerValue(record, 'se').text
  if (key === 'total_workload') {
    const estimated = record.total_estimated_workload
    const actual = record.total_actual_workload
    if (estimated === null && actual === null) return '—'
    return `${estimated ?? '—'} / ${actual ?? '—'}`
  }
  const value = record[key]
  if (value === null || value === undefined || value === '') return ''
  return value
}

export function irChangesFromDraft(record, changes) {
  const payload = {}
  Object.entries(changes).forEach(([key, value]) => {
    const field = IR_FIELD_BY_KEY[key]
    if (!field) return
    if (field.type === 'number') {
      payload[key] = value === '' || value === null || value === undefined ? null : Number(value)
    } else if (field.type === 'bool') {
      payload[key] = value === '' || value === null || value === undefined ? null : Boolean(value)
    } else {
      payload[key] = value === '' || value === null || value === undefined ? null : String(value).trim() || null
    }
  })
  return payload
}

export function irDefaultFilters(user) {
  return {
    team_id: user.role === 'maintainer' ? String(user.maintainer_team_id) : '',
    version_id: '',
    iteration_id: '',
    keyword: '',
    progress: '',
    ai_quality_level: '',
    ai_applicability: '',
    sa_ai_assisted: '',
    se_ai_assisted: '',
    ai_dev_mode: '',
    business_module: '',
    completed_from: '',
    completed_to: '',
    sort_by: 'completed_at',
    sort_order: 'desc',
    page: 1,
    page_size: 20,
  }
}

export function irActiveFilterCount(filters) {
  return [
    filters.team_id, filters.version_id, filters.iteration_id, filters.keyword,
    filters.progress, filters.ai_quality_level, filters.ai_applicability,
    filters.sa_ai_assisted, filters.se_ai_assisted, filters.ai_dev_mode,
    filters.business_module, filters.completed_from, filters.completed_to,
  ].filter((value) => value !== '' && value !== null && value !== undefined).length
}

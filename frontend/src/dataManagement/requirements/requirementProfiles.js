/**
 * Requirement activity profiles.
 *
 * A profile is the single client-side description of one requirement activity:
 * template columns and order, field labels/options, groups, required fields,
 * owner mappings, filters, summary cells and the form/create payload mapping.
 * The design activity reuses the legacy `/api/data/ir` contract; the development
 * activity mirrors it under `/api/data/development`.
 */

export const REQUIREMENT_GROUPS = Object.freeze([
  { key: 'requirement', label: '需求信息' },
  { key: 'ownership', label: '归属' },
  { key: 'people', label: '责任人' },
  { key: 'ai', label: 'AI 属性' },
  { key: 'workload', label: '工作量' },
  { key: 'time', label: '时间' },
  { key: 'other', label: '备注' },
])

export const REQUIREMENT_PROGRESS_OPTIONS = Object.freeze([
  { value: '未开始', label: '未开始', tone: 'todo' },
  { value: '进行中', label: '进行中', tone: 'doing' },
  { value: '完成', label: '完成', tone: 'done' },
  { value: '已关闭', label: '已关闭', tone: 'closed' },
])

export const DESIGN_QUALITY_OPTIONS = Object.freeze([
  { value: '优秀', label: '优秀', tone: 'success' },
  { value: '良好', label: '良好', tone: 'info' },
  { value: '合格', label: '合格', tone: 'neutral' },
  { value: '不合格', label: '不合格', tone: 'danger' },
])

export const DESIGN_TYPE_OPTIONS = Object.freeze(['IR', 'SR'])
export const DEVELOPMENT_TYPE_OPTIONS = Object.freeze(['IR', 'SR', 'AR'])

export const DESIGN_AI_MODE_SUGGESTIONS = Object.freeze([
  '设计开发一体化',
  '超级单兵',
  '全栈开发',
  '设计一体化',
  'AI辅助设计',
])

export const DEVELOPMENT_AI_MODE_SUGGESTIONS = Object.freeze([
  '设计开发一体化',
  '超级单兵',
  '全栈开发',
  '设计一体化',
  'AI辅助开发',
])

export const DESIGN_TEMPLATE_HEADERS = Object.freeze([
  '需求类型', '需求编号', '需求标题', '所属功能', '进展', '归属组', 'PI', '迭代',
  'SA', 'SE', 'AI质检等级', 'AI适用性', 'SA是否使用AI', 'SE是否使用AI', 'AI研发模式',
  '预估工作量(SA)', '实际工作量(SA)', '预估工作量(SE)', '实际工作量(SE)', '设计时间', '备注',
])

export const DEVELOPMENT_TEMPLATE_HEADERS = Object.freeze([
  '类型', '需求编号', '标题', '进展', '归属组', 'PI', '迭代',
  '实现设计责任人', '开发责任人', 'AI适用性', '实现设计是否使用AI', '开发是否使用AI', 'AI研发模式',
  '预估工作量(实现设计)', '实际工作量(实现设计)', '预估工作量(开发)', '实际工作量(开发)', '开发时间', '备注',
])

const BOOL_FORM_OPTIONS = Object.freeze([
  { value: '', label: '待维护' },
  { value: 'true', label: '是' },
  { value: 'false', label: '否' },
])

export const BOOL_FILTER_OPTIONS = Object.freeze([
  { value: 'true', label: '是' },
  { value: 'false', label: '否' },
])

const DESIGN_OWNER_SPECS = Object.freeze([
  {
    key: 'sa_owner',
    label: 'SA',
    nameKey: 'sa_owner_name',
    employeeIdKey: 'sa_employee_id',
    employeeNameKey: 'sa_employee_name',
    pendingKey: 'sa_employee_pending',
    formKey: 'sa_owner_text',
    required: true,
    placeholder: 'XXX 00123456',
  },
  {
    key: 'se_owner',
    label: 'SE',
    nameKey: 'se_owner_name',
    employeeIdKey: 'se_employee_id',
    employeeNameKey: 'se_employee_name',
    pendingKey: 'se_employee_pending',
    formKey: 'se_owner_text',
    required: true,
    placeholder: 'YYY 00654321',
  },
])

const DEVELOPMENT_OWNER_SPECS = Object.freeze([
  {
    key: 'implementation_owner',
    label: '实现设计责任人',
    nameKey: 'implementation_owner_name',
    employeeIdKey: 'implementation_employee_id',
    employeeNameKey: 'implementation_employee_name',
    pendingKey: 'implementation_employee_pending',
    formKey: 'implementation_owner_text',
    required: true,
    placeholder: 'MDE 00123456',
  },
  {
    key: 'development_owner',
    label: '开发责任人',
    nameKey: 'development_owner_name',
    employeeIdKey: 'development_employee_id',
    employeeNameKey: 'development_employee_name',
    pendingKey: 'development_employee_pending',
    formKey: 'development_owner_text',
    required: true,
    placeholder: 'DEV 00654321',
  },
])

const DESIGN_FIELDS = [
  { key: 'requirement_type', label: '需求类型', group: 'requirement', type: 'enum', options: DESIGN_TYPE_OPTIONS, width: 66, required: true, editable: false, render: 'type', template: true },
  { key: 'requirement_no', label: '需求编号', group: 'requirement', type: 'text', width: 146, required: true, editable: false, render: 'id', template: true },
  { key: 'requirement_name', label: '需求标题', group: 'requirement', type: 'text', width: 180, required: true, editable: true, render: 'title', template: true },
  { key: 'business_module', label: '所属功能', group: 'requirement', type: 'text', width: 112, required: false, editable: true, render: 'text', template: true },
  { key: 'progress', label: '进展', group: 'requirement', type: 'enum', options: REQUIREMENT_PROGRESS_OPTIONS, width: 80, required: true, editable: true, render: 'status', template: true },
  { key: 'team_name', label: '归属组', group: 'ownership', type: 'text', width: 104, required: true, editable: false, render: 'text', template: true },
  { key: 'version_name', label: 'PI', group: 'ownership', type: 'text', width: 140, required: true, editable: false, render: 'text', template: true },
  { key: 'iteration_name', label: '迭代', group: 'ownership', type: 'text', width: 108, required: true, editable: false, render: 'text', template: true },
  { key: 'sa_owner', label: 'SA', group: 'people', type: 'owner', width: 108, required: true, editable: false, render: 'owner', template: true },
  { key: 'se_owner', label: 'SE', group: 'people', type: 'owner', width: 108, required: true, editable: false, render: 'owner', template: true },
  { key: 'ai_quality_level', label: 'AI质检等级', group: 'ai', type: 'enum', options: DESIGN_QUALITY_OPTIONS, width: 88, required: false, editable: true, render: 'tag', template: true },
  { key: 'ai_applicability', label: 'AI适用性', group: 'ai', type: 'bool', width: 68, required: false, editable: true, render: 'bool', template: true },
  { key: 'sa_ai_assisted', label: 'SA是否使用AI', group: 'ai', type: 'bool', width: 92, required: false, editable: true, render: 'bool', template: true },
  { key: 'se_ai_assisted', label: 'SE是否使用AI', group: 'ai', type: 'bool', width: 92, required: false, editable: true, render: 'bool', template: true },
  { key: 'ai_dev_mode', label: 'AI研发模式', group: 'ai', type: 'text', suggestions: DESIGN_AI_MODE_SUGGESTIONS, width: 104, required: false, editable: true, render: 'tag', template: true },
  { key: 'sa_estimated_workload', label: '预估工作量(SA)', group: 'workload', type: 'number', width: 96, required: false, editable: true, render: 'number', template: true },
  { key: 'sa_actual_workload', label: '实际工作量(SA)', group: 'workload', type: 'number', width: 96, required: false, editable: true, render: 'number', template: true },
  { key: 'se_estimated_workload', label: '预估工作量(SE)', group: 'workload', type: 'number', width: 96, required: false, editable: true, render: 'number', template: true },
  { key: 'se_actual_workload', label: '实际工作量(SE)', group: 'workload', type: 'number', width: 96, required: false, editable: true, render: 'number', template: true },
  { key: 'completed_at', label: '设计时间', group: 'time', type: 'date', width: 96, required: true, editable: true, render: 'date', template: true },
  { key: 'remark', label: '备注', group: 'other', type: 'text', width: 116, required: false, editable: true, render: 'muted', template: true },
]

const DEVELOPMENT_FIELDS = [
  { key: 'requirement_type', label: '类型', group: 'requirement', type: 'enum', options: DEVELOPMENT_TYPE_OPTIONS, width: 66, required: true, editable: false, render: 'type', template: true },
  { key: 'requirement_no', label: '需求编号', group: 'requirement', type: 'text', width: 146, required: true, editable: false, render: 'id', template: true },
  { key: 'requirement_name', label: '标题', group: 'requirement', type: 'text', width: 180, required: true, editable: true, render: 'title', template: true },
  { key: 'progress', label: '进展', group: 'requirement', type: 'enum', options: REQUIREMENT_PROGRESS_OPTIONS, width: 80, required: true, editable: true, render: 'status', template: true },
  { key: 'team_name', label: '归属组', group: 'ownership', type: 'text', width: 104, required: true, editable: false, render: 'text', template: true },
  { key: 'version_name', label: 'PI', group: 'ownership', type: 'text', width: 140, required: true, editable: false, render: 'text', template: true },
  { key: 'iteration_name', label: '迭代', group: 'ownership', type: 'text', width: 108, required: true, editable: false, render: 'text', template: true },
  { key: 'implementation_owner', label: '实现设计责任人', group: 'people', type: 'owner', width: 126, required: true, editable: false, render: 'owner', template: true },
  { key: 'development_owner', label: '开发责任人', group: 'people', type: 'owner', width: 112, required: true, editable: false, render: 'owner', template: true },
  { key: 'ai_applicability', label: 'AI适用性', group: 'ai', type: 'bool', width: 68, required: false, editable: true, render: 'bool', template: true },
  { key: 'implementation_ai_assisted', label: '实现设计是否使用AI', group: 'ai', type: 'bool', width: 108, required: false, editable: true, render: 'bool', template: true },
  { key: 'development_ai_assisted', label: '开发是否使用AI', group: 'ai', type: 'bool', width: 96, required: false, editable: true, render: 'bool', template: true },
  { key: 'ai_dev_mode', label: 'AI研发模式', group: 'ai', type: 'text', suggestions: DEVELOPMENT_AI_MODE_SUGGESTIONS, width: 104, required: false, editable: true, render: 'tag', template: true },
  { key: 'implementation_estimated_workload', label: '预估工作量(实现设计)', group: 'workload', type: 'number', width: 118, required: false, editable: true, render: 'number', template: true },
  { key: 'implementation_actual_workload', label: '实际工作量(实现设计)', group: 'workload', type: 'number', width: 118, required: false, editable: true, render: 'number', template: true },
  { key: 'development_estimated_workload', label: '预估工作量(开发)', group: 'workload', type: 'number', width: 110, required: false, editable: true, render: 'number', template: true },
  { key: 'development_actual_workload', label: '实际工作量(开发)', group: 'workload', type: 'number', width: 110, required: false, editable: true, render: 'number', template: true },
  { key: 'completed_at', label: '开发时间', group: 'time', type: 'date', width: 96, required: true, editable: true, render: 'date', template: true },
  { key: 'remark', label: '备注', group: 'other', type: 'text', width: 116, required: false, editable: true, render: 'muted', template: true },
]

const DESIGN_FILTER_LABELS = {
  requirement_type: '类型',
  team_id: '归属组',
  version_id: 'PI',
  iteration_id: '迭代',
  keyword: '搜索',
  progress: '进展',
  ai_quality_level: 'AI质检',
  ai_applicability: 'AI适用性',
  sa_ai_assisted: 'SA使用AI',
  se_ai_assisted: 'SE使用AI',
  ai_dev_mode: 'AI研发模式',
  business_module: '所属功能',
  completed_from: '设计时间起',
  completed_to: '设计时间止',
}

const DEVELOPMENT_FILTER_LABELS = {
  requirement_type: '类型',
  team_id: '归属组',
  version_id: 'PI',
  iteration_id: '迭代',
  keyword: '搜索',
  progress: '进展',
  ai_applicability: 'AI适用性',
  implementation_ai_assisted: '实现设计使用AI',
  development_ai_assisted: '开发使用AI',
  ai_dev_mode: 'AI研发模式',
  completed_from: '开发时间起',
  completed_to: '开发时间止',
}

const DESIGN_SORTABLE_KEYS = Object.freeze([
  'requirement_no', 'requirement_name', 'progress', 'business_module', 'completed_at',
  'sa_estimated_workload', 'sa_actual_workload', 'se_estimated_workload', 'se_actual_workload',
  'ai_quality_level', 'updated_at', 'id',
])

const DEVELOPMENT_SORTABLE_KEYS = Object.freeze([
  'requirement_no', 'requirement_name', 'progress', 'completed_at',
  'implementation_estimated_workload', 'implementation_actual_workload',
  'development_estimated_workload', 'development_actual_workload',
  'updated_at', 'id',
])

function viewPreset(value, label, keys) {
  return { value, label, keys }
}

function createProfile(config) {
  const fields = config.fields.map((field) => Object.freeze({ ...field }))
  const fieldByKey = Object.fromEntries(fields.map((field) => [field.key, field]))
  const templateFields = fields.filter((field) => field.template)
  const templateKeys = templateFields.map((field) => field.key)
  const fieldLabels = Object.fromEntries(fields.map((field) => [field.key, field.label]))
  const ownerSpecByKey = Object.fromEntries(config.ownerSpecs.map((spec) => [spec.key, spec]))
  const ownerLabels = Object.fromEntries(config.ownerSpecs.flatMap((spec) => [
    [spec.nameKey, spec.label],
    [spec.employeeNameKey, `${spec.label}姓名`],
    [spec.employeeIdKey, `${spec.label}工号`],
  ]))
  const filterKeys = Object.keys(config.defaultFilters)
  const emptyForm = buildEmptyForm(config)
  const presets = [
    viewPreset('all', '全部模板字段', templateKeys),
    ...config.viewPresets,
  ]
  const profile = {
    key: config.key,
    activity: config.activity,
    apiBase: config.apiBase,
    typeOptions: config.typeOptions,
    defaultType: config.defaultType,
    templateName: config.templateName,
    templateUrl: `${config.apiBase}/import-template`,
    hasCollector: Boolean(config.hasCollector),
    title: config.title,
    eyebrow: config.eyebrow,
    description: config.description,
    tabLabel: config.tabLabel,
    tabCaption: config.tabCaption,
    tableLabel: config.tableLabel,
    workspaceTitle: config.workspaceTitle,
    emptyText: config.emptyText,
    recordLabel: config.recordLabel,
    importTitle: config.importTitle,
    importAccept: '.xlsx,.csv',
    importHints: config.importHints,
    searchPlaceholder: config.searchPlaceholder,
    activityTimeLabel: config.activityTimeLabel,
    activityTimeKey: 'completed_at',
    groups: REQUIREMENT_GROUPS,
    fields,
    fieldByKey,
    fieldLabels,
    templateFields,
    templateKeys,
    templateHeaders: config.templateHeaders,
    ownerSpecs: config.ownerSpecs,
    ownerSpecByKey,
    ownerFieldKeys: new Set(config.ownerSpecs.map((spec) => spec.key)),
    ownerLabels,
    progressOptions: REQUIREMENT_PROGRESS_OPTIONS,
    aiModeSuggestions: config.aiModeSuggestions,
    qualityOptions: config.qualityOptions ?? null,
    advancedFilters: config.advancedFilters,
    filterLabels: config.filterLabels,
    filterKeys,
    sortableKeys: new Set(config.sortableKeys),
    viewPresets: presets,
    summaryLabel: config.summaryLabel,
    aiUsageNote: config.aiUsageNote,
    breakdown: config.breakdown,
    defaultFilters(user) {
      return {
        ...config.defaultFilters,
        team_id: user?.role === 'maintainer' ? String(user.maintainer_team_id) : '',
        page: 1,
        page_size: 20,
        sort_by: 'completed_at',
        sort_order: 'desc',
      }
    },
    activeFilterCount(filters = {}) {
      return filterKeys.filter((key) => filters[key] !== '' && filters[key] !== null && filters[key] !== undefined).length
    },
    changesFromDraft(record, changes = {}) {
      const payload = {}
      Object.entries(changes).forEach(([key, value]) => {
        const field = fieldByKey[key]
        if (!field || !field.editable) return
        payload[key] = normalizeEditableValue(field, value)
      })
      return payload
    },
    formFromRecord(record, refs = {}, user = { role: 'viewer' }) {
      const values = { ...emptyForm }
      if (record) {
        fields.forEach((field) => {
          if (field.type === 'owner') {
            const spec = ownerSpecByKey[field.key]
            if (spec) values[spec.formKey] = personText(record[spec.nameKey] || record[spec.employeeNameKey], record[spec.employeeIdKey])
            return
          }
          if (field.type === 'number') values[field.key] = record[field.key] ?? null
          else if (field.type === 'bool') values[field.key] = boolToForm(record[field.key])
          else values[field.key] = record[field.key] ?? ''
        })
        values.requirement_type = record.requirement_type ?? config.defaultType
        values.requirement_no = record.requirement_no ?? ''
        values.requirement_name = record.requirement_name ?? ''
        values.progress = record.progress ?? '未开始'
        values.completed_at = record.completed_at ?? ''
        values.remark = record.remark ?? ''
        values.team_id = String(record.team_id ?? '')
        values.version_id = String(record.version_id ?? '')
        values.iteration_id = String(record.iteration_id ?? '')
        return values
      }
      values.team_id = user?.role === 'maintainer'
        ? String(user.maintainer_team_id ?? '')
        : String(refs.teams?.[0]?.id ?? '')
      return values
    },
    payloadFromForm(values = {}, { version } = {}) {
      return buildPayload(config, values, version)
    },
    summaryCells(summary = {}) {
      return buildSummaryCells(config, summary)
    },
    ownerValue(record = {}, ownerKey) {
      const spec = ownerSpecByKey[ownerKey]
      if (!spec) return { text: '', pending: false }
      return {
        text: personText(record[spec.nameKey] || record[spec.employeeNameKey], record[spec.employeeIdKey]),
        pending: Boolean(record[spec.pendingKey]),
      }
    },
  }
  return Object.freeze(profile)
}

function buildEmptyForm(config) {
  const values = {}
  config.fields.forEach((field) => {
    if (field.type === 'owner') {
      const spec = config.ownerSpecs.find((item) => item.key === field.key)
      if (spec) values[spec.formKey] = ''
      return
    }
    if (field.type === 'number') values[field.key] = null
    else if (field.type === 'bool') values[field.key] = ''
    else values[field.key] = ''
  })
  values.requirement_type = config.defaultType
  values.progress = '未开始'
  values.team_id = ''
  values.version_id = ''
  values.iteration_id = ''
  values.completed_at = ''
  values.remark = ''
  return values
}

function buildPayload(config, values, version) {
  if (!version) throw new Error('请选择 PI')
  const payload = {
    requirement_type: values.requirement_type || config.defaultType,
    requirement_no: textOrNull(values.requirement_no),
    requirement_name: textOrNull(values.requirement_name),
    progress: values.progress || null,
    product_id: version.product_id,
    version_id: Number(values.version_id),
    iteration_id: Number(values.iteration_id),
    completed_at: values.completed_at || null,
    ai_applicability: formToBool(values.ai_applicability),
    ai_dev_mode: textOrNull(values.ai_dev_mode),
    remark: textOrNull(values.remark),
  }
  if (config.key === 'design') payload.business_module = String(values.business_module ?? '').trim()
  if (config.qualityField) payload.ai_quality_level = values.ai_quality_level || null
  config.aiAssistedFields.forEach((key) => { payload[key] = formToBool(values[key]) })
  config.ownerSpecs.forEach((spec) => {
    const owner = parseOwnerText(values[spec.formKey])
    payload[spec.nameKey] = owner.name
    payload[spec.employeeIdKey] = owner.employeeId
  })
  config.workloadFields.forEach((key) => { payload[key] = numberOrNull(values[key]) })
  return payload
}

function buildSummaryCells(config, summary) {
  const total = summary?.total ?? 0
  const byProgress = summary?.by_progress ?? {}
  const usage = summary?.ai_usage_rate
  const ratio = (count) => (total ? `${((count / total) * 100).toFixed(1)}%` : '—')
  const segments = REQUIREMENT_PROGRESS_OPTIONS
    .map((option) => ({ label: option.label, value: byProgress[option.label] ?? 0, tone: option.tone }))
    .filter((segment) => segment.value > 0)
  const pending = byProgress['待维护'] ?? 0
  if (pending > 0) segments.push({ label: '待维护', value: pending, tone: 'pending' })
  return [
    {
      key: 'total',
      label: '需求总数',
      value: total,
      unit: '条',
      note: '当前筛选范围',
      tone: 'accent',
    },
    {
      key: 'doing',
      label: '进行中',
      value: byProgress['进行中'] ?? 0,
      unit: '条',
      note: ratio(byProgress['进行中'] ?? 0),
    },
    {
      key: 'done',
      label: '已完成',
      value: byProgress['完成'] ?? 0,
      unit: '条',
      note: ratio(byProgress['完成'] ?? 0),
      tone: 'success',
    },
    {
      key: 'ai',
      label: 'AI 使用率',
      value: usage === null || usage === undefined ? '—' : Math.round(usage * 100),
      unit: '%',
      note: config.aiUsageNote,
    },
    {
      key: 'workload',
      label: config.summaryLabel,
      value: summary?.total_estimated_workload ?? null,
      unit: '',
      secondaryValue: summary?.total_actual_workload ?? null,
      note: '预估合计 / 实际合计',
      breakdown: config.breakdown(summary),
      segments,
      total,
    },
  ]
}

export function personText(name, employeeId) {
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

export function progressTone(value) {
  return REQUIREMENT_PROGRESS_OPTIONS.find((option) => option.value === value)?.tone ?? 'todo'
}

export function boolToForm(value) {
  if (value === true) return 'true'
  if (value === false) return 'false'
  return ''
}

export function formToBool(value) {
  if (value === 'true' || value === true) return true
  if (value === 'false' || value === false) return false
  return null
}

export function formatRequirementNumber(value) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)
}

export function formatRequirementTimestamp(value) {
  if (!value) return '—'
  const text = String(value)
  return text.includes('T') ? `${text.slice(0, 10)} ${text.slice(11, 19)}` : text
}

export function requirementQuery(filters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) return
    params.set(key, String(value))
  })
  return params.toString()
}

export function enumFilterOptions(options) {
  return options.map((option) => (typeof option === 'string'
    ? { value: option, label: option }
    : { value: option.value, label: option.label }))
}

function textOrNull(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function numberOrNull(value) {
  return value === '' || value === null || value === undefined ? null : Number(value)
}

function normalizeEditableValue(field, value) {
  if (field.type === 'number') return numberOrNull(value)
  if (field.type === 'bool') return formToBool(value)
  return textOrNull(value)
}

export const DESIGN_PROFILE = createProfile({
  key: 'design',
  activity: 'design',
  apiBase: '/api/data/ir',
  typeOptions: DESIGN_TYPE_OPTIONS,
  defaultType: 'IR',
  templateName: '需求设计度量模板.xlsx',
  templateHeaders: DESIGN_TEMPLATE_HEADERS,
  hasCollector: true,
  title: '设计活动需求数据',
  eyebrow: '设计活动 · SA设计 / SE设计',
  description: '按 21 列设计模板维护需求、SA/SE 责任人与设计工作量；支持 Excel 导入、筛选、内联编辑与整批确认。',
  tabLabel: '设计活动',
  tabCaption: 'SA设计 / SE设计',
  tableLabel: '设计活动正式数据',
  workspaceTitle: '设计活动正式数据',
  emptyText: '当前筛选条件下没有设计活动数据。',
  recordLabel: '设计记录',
  importTitle: '导入设计活动 Excel',
  searchPlaceholder: '搜索需求编号、标题或所属功能',
  importHints: [
    '21 列设计模板：需求类型、需求编号、需求标题、所属功能、进展、归属组、PI、迭代、SA、SE、AI 属性、SA/SE 工作量、设计时间、备注。',
    '新建与文件导入必填：类型、需求编号、需求标题、进展、归属组、PI、迭代、SA、SE、设计时间；所属功能可空。',
    '归属组、PI、迭代必须已存在；工号未匹配只警告，SA 或 SE 为空为错误。',
  ],
  activityTimeLabel: '设计时间',
  aiModeSuggestions: DESIGN_AI_MODE_SUGGESTIONS,
  qualityOptions: DESIGN_QUALITY_OPTIONS,
  advancedFilters: [
    { key: 'ai_quality_level', label: 'AI质检等级', type: 'enum', options: DESIGN_QUALITY_OPTIONS },
    { key: 'ai_applicability', label: 'AI适用性', type: 'bool' },
    { key: 'sa_ai_assisted', label: 'SA是否使用AI', type: 'bool' },
    { key: 'se_ai_assisted', label: 'SE是否使用AI', type: 'bool' },
    { key: 'ai_dev_mode', label: 'AI研发模式', type: 'text' },
    { key: 'business_module', label: '所属功能', type: 'text' },
    { key: 'completed_from', label: '设计时间起', type: 'date' },
    { key: 'completed_to', label: '设计时间止', type: 'date' },
  ],
  filterLabels: DESIGN_FILTER_LABELS,
  defaultFilters: {
    requirement_type: '',
    team_id: '',
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
  },
  sortableKeys: DESIGN_SORTABLE_KEYS,
  fields: DESIGN_FIELDS,
  ownerSpecs: DESIGN_OWNER_SPECS,
  viewPresets: [
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
  ],
  workloadFields: ['sa_estimated_workload', 'sa_actual_workload', 'se_estimated_workload', 'se_actual_workload'],
  aiAssistedFields: ['sa_ai_assisted', 'se_ai_assisted'],
  qualityField: 'ai_quality_level',
  summaryLabel: 'SA / SE 工作量',
  aiUsageNote: 'SA 或 SE 使用 AI',
  breakdown: (summary = {}) => [
    `SA ${formatRequirementNumber(summary?.sa_estimated_workload)} / ${formatRequirementNumber(summary?.sa_actual_workload)}`,
    `SE ${formatRequirementNumber(summary?.se_estimated_workload)} / ${formatRequirementNumber(summary?.se_actual_workload)}`,
  ].join(' · '),
})

export const DEVELOPMENT_PROFILE = createProfile({
  key: 'development',
  activity: 'development',
  apiBase: '/api/data/development',
  typeOptions: DEVELOPMENT_TYPE_OPTIONS,
  defaultType: 'IR',
  templateName: '需求开发度量模板.xlsx',
  templateHeaders: DEVELOPMENT_TEMPLATE_HEADERS,
  hasCollector: false,
  title: '开发活动需求数据',
  eyebrow: '开发活动 · 实现设计 / 编码开发',
  description: '按 19 列开发模板维护需求、实现设计/开发责任人与开发工作量；支持 Excel 导入、筛选、内联编辑与整批确认。',
  tabLabel: '开发活动',
  tabCaption: '实现设计 / 编码开发',
  tableLabel: '开发活动正式数据',
  workspaceTitle: '开发活动正式数据',
  emptyText: '当前筛选条件下没有开发活动数据。',
  recordLabel: '开发记录',
  importTitle: '导入开发活动 Excel',
  searchPlaceholder: '搜索需求编号或标题',
  importHints: [
    '19 列开发模板：类型、需求编号、标题、进展、归属组、PI、迭代、实现设计责任人、开发责任人、AI 属性、实现设计/开发工作量、开发时间、备注。',
    '新建与文件导入必填：类型、需求编号、标题、进展、归属组、PI、迭代、实现设计责任人、开发责任人、开发时间。',
    '归属组、PI、迭代必须已存在；开发活动只有文件导入，不提供平台采集批次。',
  ],
  activityTimeLabel: '开发时间',
  aiModeSuggestions: DEVELOPMENT_AI_MODE_SUGGESTIONS,
  qualityOptions: null,
  advancedFilters: [
    { key: 'ai_applicability', label: 'AI适用性', type: 'bool' },
    { key: 'implementation_ai_assisted', label: '实现设计是否使用AI', type: 'bool' },
    { key: 'development_ai_assisted', label: '开发是否使用AI', type: 'bool' },
    { key: 'ai_dev_mode', label: 'AI研发模式', type: 'text' },
    { key: 'completed_from', label: '开发时间起', type: 'date' },
    { key: 'completed_to', label: '开发时间止', type: 'date' },
  ],
  filterLabels: DEVELOPMENT_FILTER_LABELS,
  defaultFilters: {
    requirement_type: '',
    team_id: '',
    version_id: '',
    iteration_id: '',
    keyword: '',
    progress: '',
    ai_applicability: '',
    implementation_ai_assisted: '',
    development_ai_assisted: '',
    ai_dev_mode: '',
    completed_from: '',
    completed_to: '',
  },
  sortableKeys: DEVELOPMENT_SORTABLE_KEYS,
  fields: DEVELOPMENT_FIELDS,
  ownerSpecs: DEVELOPMENT_OWNER_SPECS,
  viewPresets: [
    {
      value: 'standard',
      label: '标准',
      keys: [
        'requirement_type', 'requirement_no', 'requirement_name', 'progress',
        'team_name', 'version_name', 'iteration_name', 'implementation_owner', 'development_owner',
        'total_workload', 'ai_applicability', 'implementation_ai_assisted', 'development_ai_assisted',
        'completed_at', 'remark',
      ],
    },
    {
      value: 'workload',
      label: '工作量',
      keys: [
        'requirement_no', 'requirement_name', 'team_name', 'version_name',
        'implementation_estimated_workload', 'implementation_actual_workload',
        'development_estimated_workload', 'development_actual_workload',
        'total_workload', 'completed_at',
      ],
    },
    {
      value: 'ai',
      label: 'AI 属性',
      keys: [
        'requirement_no', 'requirement_name', 'team_name', 'progress',
        'ai_applicability', 'implementation_ai_assisted', 'development_ai_assisted', 'ai_dev_mode',
        'completed_at',
      ],
    },
  ],
  workloadFields: [
    'implementation_estimated_workload', 'implementation_actual_workload',
    'development_estimated_workload', 'development_actual_workload',
  ],
  aiAssistedFields: ['implementation_ai_assisted', 'development_ai_assisted'],
  qualityField: null,
  summaryLabel: '实现设计 / 开发工作量',
  aiUsageNote: '实现设计或开发使用 AI',
  breakdown: (summary = {}) => [
    `实现设计 ${formatRequirementNumber(summary?.implementation_estimated_workload)} / ${formatRequirementNumber(summary?.implementation_actual_workload)}`,
    `开发 ${formatRequirementNumber(summary?.development_estimated_workload)} / ${formatRequirementNumber(summary?.development_actual_workload)}`,
  ].join(' · '),
})

export const REQUIREMENT_PROFILES = Object.freeze({
  design: DESIGN_PROFILE,
  development: DEVELOPMENT_PROFILE,
})

export const DEFAULT_REQUIREMENT_ACTIVITY = 'design'

export function requirementProfile(activity) {
  return REQUIREMENT_PROFILES[activity] ?? DESIGN_PROFILE
}

export { BOOL_FORM_OPTIONS }

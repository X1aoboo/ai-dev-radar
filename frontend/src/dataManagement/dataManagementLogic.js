export function sectionFromPath(pathname = '') {
  if (/^\/data\/requirements(?:\/(?:ir|ar|sr))?\/?$/i.test(pathname)) return 'requirements'
  const match = pathname.match(/^\/(?:data|data-management)(?:\/([^/]+))?$/)
  if (match) return match[1] || 'ir'
  const settingsMatch = pathname.match(/^\/settings\/([^/]+)$/)
  return settingsMatch?.[1] || 'ir'
}

export function buildIrQuery(filters = {}) {
  const params = new URLSearchParams()
  const fields = [
    'team_id',
    'product_id',
    'version_id',
    'iteration_id',
    'requirement_no',
    'responsible_employee_id',
    'business_module',
    'requirement_scenario',
    'completed_from',
    'completed_to',
    'page',
    'page_size',
  ]
  fields.forEach((field) => {
    if (filters[field] !== undefined && filters[field] !== null && filters[field] !== '') {
      params.set(field, String(filters[field]))
    }
  })
  if (filters.ai_assisted !== '' && filters.ai_assisted !== undefined && filters.ai_assisted !== null) {
    params.set('ai_assisted', String(filters.ai_assisted))
  }
  return params
}

export function formValue(value) {
  return value === null || value === undefined ? '' : String(value)
}

export function irFormFromRecord(record = {}) {
  return {
    requirement_no: formValue(record.requirement_no),
    requirement_name: formValue(record.requirement_name),
    responsible_employee_id: formValue(record.responsible_employee_id),
    parent_requirement_no: formValue(record.parent_requirement_no),
    product_id: formValue(record.product_id),
    version_id: formValue(record.version_id),
    iteration_id: formValue(record.iteration_id),
    completed_at: formValue(record.completed_at),
    business_module: formValue(record.business_module),
    requirement_scenario: formValue(record.requirement_scenario),
    estimated_workload: formValue(record.estimated_workload),
    actual_workload: formValue(record.actual_workload),
    sa_estimated_workload: formValue(record.sa_estimated_workload),
    sa_actual_workload: formValue(record.sa_actual_workload),
    se_estimated_workload: formValue(record.se_estimated_workload),
    se_actual_workload: formValue(record.se_actual_workload),
    ai_assisted: record.ai_assisted === null || record.ai_assisted === undefined
      ? ''
      : String(record.ai_assisted),
  }
}

export function irFormPayload(form) {
  const numberFields = [
    'product_id',
    'version_id',
    'iteration_id',
    'estimated_workload',
    'actual_workload',
    'sa_estimated_workload',
    'sa_actual_workload',
    'se_estimated_workload',
    'se_actual_workload',
  ]
  const payload = { ...form }
  numberFields.forEach((field) => {
    if (!(field in payload)) return
    payload[field] = payload[field] === '' || payload[field] === null || payload[field] === undefined
      ? null
      : Number(payload[field])
  })
  payload.ai_assisted = form.ai_assisted === '' ? null : form.ai_assisted === 'true'
  Object.keys(payload).forEach((field) => {
    if (typeof payload[field] === 'string') payload[field] = payload[field].trim() || null
  })
  return payload
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

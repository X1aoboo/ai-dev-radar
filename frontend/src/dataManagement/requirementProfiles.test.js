import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DESIGN_PROFILE,
  DESIGN_QUALITY_OPTIONS,
  DESIGN_TEMPLATE_HEADERS,
  DEVELOPMENT_PROFILE,
  DEVELOPMENT_TEMPLATE_HEADERS,
  REQUIREMENT_GROUPS,
  parseOwnerText,
  personText,
  requirementQuery,
} from './requirements/requirementProfiles.js'

const GROUP_LABELS = ['需求信息', '归属', '责任人', 'AI 属性', '工作量', '时间', '备注']

test('design profile exposes the exact 21-column template contract', () => {
  assert.deepEqual(REQUIREMENT_GROUPS.map((group) => group.label), GROUP_LABELS)
  assert.equal(DESIGN_TEMPLATE_HEADERS.length, 21)
  assert.deepEqual(DESIGN_PROFILE.templateFields.map((field) => field.label), [...DESIGN_TEMPLATE_HEADERS])
  assert.deepEqual(DESIGN_PROFILE.templateHeaders, [...DESIGN_TEMPLATE_HEADERS])
  assert.deepEqual(
    [...new Set(DESIGN_PROFILE.fields.map((field) => field.group))],
    GROUP_LABELS.map((_, index) => REQUIREMENT_GROUPS[index].key),
  )
  assert.equal(DESIGN_PROFILE.templateName, '需求设计度量模板.xlsx')
  assert.deepEqual(DESIGN_PROFILE.typeOptions, ['IR', 'SR'])
  assert.deepEqual(DESIGN_QUALITY_OPTIONS.map((option) => option.value), ['优秀', '良好', '合格', '不合格'])
})

test('development profile exposes the exact 19-column template contract', () => {
  assert.equal(DEVELOPMENT_TEMPLATE_HEADERS.length, 19)
  assert.deepEqual(DEVELOPMENT_PROFILE.templateFields.map((field) => field.label), [...DEVELOPMENT_TEMPLATE_HEADERS])
  assert.deepEqual(DEVELOPMENT_PROFILE.templateHeaders, [...DEVELOPMENT_TEMPLATE_HEADERS])
  assert.equal(DEVELOPMENT_PROFILE.templateName, '需求开发度量模板.xlsx')
  assert.deepEqual(DEVELOPMENT_PROFILE.typeOptions, ['IR', 'SR', 'AR'])
  assert.equal(DEVELOPMENT_PROFILE.qualityOptions, null)
  assert.equal(DEVELOPMENT_PROFILE.hasCollector, false)
  assert.equal(DESIGN_PROFILE.hasCollector, true)
})

test('required fields match the activity contracts', () => {
  assert.deepEqual(DESIGN_PROFILE.fields.filter((field) => field.required).map((field) => field.key), [
    'requirement_type', 'requirement_no', 'requirement_name', 'progress',
    'team_name', 'version_name', 'iteration_name', 'sa_owner', 'se_owner', 'completed_at',
  ])
  assert.equal(DESIGN_PROFILE.fieldByKey.business_module.required, false)
  assert.deepEqual(DEVELOPMENT_PROFILE.fields.filter((field) => field.required).map((field) => field.key), [
    'requirement_type', 'requirement_no', 'requirement_name', 'progress',
    'team_name', 'version_name', 'iteration_name',
    'implementation_owner', 'development_owner', 'completed_at',
  ])
  assert.equal(DEVELOPMENT_PROFILE.fieldByKey.business_module, undefined)
})

test('owner specs map display, form and payload fields for each activity', () => {
  assert.deepEqual(DESIGN_PROFILE.ownerSpecs.map((spec) => [spec.key, spec.label, spec.nameKey, spec.employeeIdKey]), [
    ['sa_owner', 'SA', 'sa_owner_name', 'sa_employee_id'],
    ['se_owner', 'SE', 'se_owner_name', 'se_employee_id'],
  ])
  assert.deepEqual(DEVELOPMENT_PROFILE.ownerSpecs.map((spec) => spec.label), ['实现设计责任人', '开发责任人'])
  assert.equal(personText('张三', 'A001'), '张三 A001')
  assert.deepEqual(parseOwnerText('张三 A001'), { name: '张三', employeeId: 'A001' })
  assert.deepEqual(parseOwnerText('A001'), { name: null, employeeId: 'A001' })
  assert.deepEqual(parseOwnerText('张三'), { name: '张三', employeeId: null })
})

test('default filters cover each activity query contract and sort/page defaults', () => {
  assert.deepEqual(Object.keys(DESIGN_PROFILE.defaultFilters({ role: 'admin' })), [
    'requirement_type', 'team_id', 'version_id', 'iteration_id', 'keyword', 'progress',
    'ai_quality_level', 'ai_applicability', 'sa_ai_assisted', 'se_ai_assisted', 'ai_dev_mode',
    'business_module', 'completed_from', 'completed_to', 'page', 'page_size', 'sort_by', 'sort_order',
  ])
  assert.deepEqual(Object.keys(DEVELOPMENT_PROFILE.defaultFilters({ role: 'admin' })), [
    'requirement_type', 'team_id', 'version_id', 'iteration_id', 'keyword', 'progress',
    'ai_applicability', 'implementation_ai_assisted', 'development_ai_assisted', 'ai_dev_mode',
    'completed_from', 'completed_to', 'page', 'page_size', 'sort_by', 'sort_order',
  ])
  const maintainerFilters = DESIGN_PROFILE.defaultFilters({ role: 'maintainer', maintainer_team_id: 4 })
  assert.equal(maintainerFilters.team_id, '4')
  assert.equal(DESIGN_PROFILE.defaultFilters({ role: 'admin' }).team_id, '')
  assert.equal(DESIGN_PROFILE.defaultFilters({ role: 'admin' }).page_size, 20)
})

test('filter counts and query serialisation keep explicit false and omit empty values', () => {
  const filters = {
    ...DESIGN_PROFILE.defaultFilters({ role: 'admin' }),
    team_id: '1',
    requirement_type: 'SR',
    sa_ai_assisted: 'false',
  }
  assert.equal(DESIGN_PROFILE.activeFilterCount(filters), 3)
  assert.equal(requirementQuery(filters), 'requirement_type=SR&team_id=1&sa_ai_assisted=false&page=1&page_size=20&sort_by=completed_at&sort_order=desc')
})

test('view presets expose the full template column order', () => {
  for (const profile of [DESIGN_PROFILE, DEVELOPMENT_PROFILE]) {
    const all = profile.viewPresets.find((preset) => preset.value === 'all')
    assert.deepEqual(all.keys, profile.templateKeys)
    assert.deepEqual(profile.viewPresets.map((preset) => preset.value), ['all', 'standard', 'workload', 'ai'])
    assert.equal(profile.sortableKeys.has('completed_at'), true)
    assert.equal(profile.sortableKeys.has('requirement_no'), true)
  }
  assert.equal(DESIGN_PROFILE.sortableKeys.has('ai_quality_level'), true)
  assert.equal(DEVELOPMENT_PROFILE.sortableKeys.has('development_estimated_workload'), true)
})

test('summary cells match the activity summary contract', () => {
  const design = DESIGN_PROFILE.summaryCells({
    total: 4,
    by_progress: { 进行中: 1, 完成: 2 },
    ai_usage_rate: 0.5,
    sa_estimated_workload: 3,
    sa_actual_workload: 2,
    se_estimated_workload: 5,
    se_actual_workload: 4,
    total_estimated_workload: 8,
    total_actual_workload: 6,
  })
  assert.deepEqual(design.map((cell) => cell.label), ['需求总数', '进行中', '已完成', 'AI 使用率', 'SA / SE 工作量'])
  assert.equal(design[0].value, 4)
  assert.equal(design[3].value, 50)
  assert.equal(design[4].value, 8)
  assert.equal(design[4].secondaryValue, 6)
  assert.equal(design[4].breakdown, 'SA 3 / 2 · SE 5 / 4')
  assert.deepEqual(design[4].segments.map((segment) => [segment.label, segment.value]), [['进行中', 1], ['完成', 2]])

  const development = DEVELOPMENT_PROFILE.summaryCells({
    total: 2,
    by_progress: { 未开始: 1, 完成: 1 },
    ai_usage_rate: null,
    implementation_estimated_workload: 1,
    implementation_actual_workload: 1,
    development_estimated_workload: 2,
    development_actual_workload: 3,
    total_estimated_workload: 3,
    total_actual_workload: 4,
  })
  assert.equal(development[4].label, '实现设计 / 开发工作量')
  assert.equal(development[3].value, '—')
  assert.equal(development[4].breakdown, '实现设计 1 / 1 · 开发 2 / 3')
})

test('design form and payload builders map the template values to the API contract', () => {
  const version = { id: 20, product_id: 10 }
  const payload = DESIGN_PROFILE.payloadFromForm({
    requirement_type: 'SR',
    requirement_no: ' SR-1 ',
    requirement_name: ' 需求标题 ',
    business_module: '',
    progress: '进行中',
    team_id: '1',
    version_id: '20',
    iteration_id: '30',
    sa_owner_text: '张三 A001',
    se_owner_text: '李四 A002',
    ai_quality_level: '不合格',
    ai_applicability: 'true',
    sa_ai_assisted: 'false',
    se_ai_assisted: '',
    ai_dev_mode: ' 超级单兵 ',
    sa_estimated_workload: '1.5',
    sa_actual_workload: '',
    se_estimated_workload: 2,
    se_actual_workload: null,
    completed_at: '2026-08-20',
    remark: '',
  }, { version })
  assert.deepEqual(payload, {
    requirement_type: 'SR',
    requirement_no: 'SR-1',
    requirement_name: '需求标题',
    progress: '进行中',
    product_id: 10,
    version_id: 20,
    iteration_id: 30,
    completed_at: '2026-08-20',
    ai_applicability: true,
    ai_dev_mode: '超级单兵',
    remark: null,
    business_module: '',
    ai_quality_level: '不合格',
    sa_ai_assisted: false,
    se_ai_assisted: null,
    sa_owner_name: '张三',
    sa_employee_id: 'A001',
    se_owner_name: '李四',
    se_employee_id: 'A002',
    sa_estimated_workload: 1.5,
    sa_actual_workload: null,
    se_estimated_workload: 2,
    se_actual_workload: null,
  })
  assert.throws(() => DESIGN_PROFILE.payloadFromForm({}, {}), /请选择 PI/)
})

test('development form and payload builders keep owner and workload fields independent', () => {
  const version = { id: 21, product_id: 11 }
  const payload = DEVELOPMENT_PROFILE.payloadFromForm({
    requirement_type: 'AR',
    requirement_no: 'AR-1',
    requirement_name: '开发需求',
    progress: '未开始',
    team_id: '2',
    version_id: '21',
    iteration_id: '31',
    implementation_owner_text: '王五 B001',
    development_owner_text: '赵六 B002',
    ai_applicability: 'false',
    implementation_ai_assisted: 'true',
    development_ai_assisted: 'false',
    ai_dev_mode: '',
    implementation_estimated_workload: '2',
    implementation_actual_workload: '1',
    development_estimated_workload: '3',
    development_actual_workload: '2.5',
    completed_at: '2026-09-01',
    remark: '备注',
  }, { version })
  assert.deepEqual(payload, {
    requirement_type: 'AR',
    requirement_no: 'AR-1',
    requirement_name: '开发需求',
    progress: '未开始',
    product_id: 11,
    version_id: 21,
    iteration_id: 31,
    completed_at: '2026-09-01',
    ai_applicability: false,
    ai_dev_mode: null,
    remark: '备注',
    implementation_ai_assisted: true,
    development_ai_assisted: false,
    implementation_owner_name: '王五',
    implementation_employee_id: 'B001',
    development_owner_name: '赵六',
    development_employee_id: 'B002',
    implementation_estimated_workload: 2,
    implementation_actual_workload: 1,
    development_estimated_workload: 3,
    development_actual_workload: 2.5,
  })
  assert.equal(payload.business_module, undefined)
})

test('form state comes from a record, defaults for creation, and drafts normalise editable cells', () => {
  const refs = { teams: [{ id: 3, name: '团队C' }] }
  const values = DESIGN_PROFILE.formFromRecord({
    requirement_type: 'SR',
    requirement_no: 'SR-1',
    requirement_name: '需求',
    business_module: 'CNAE',
    progress: '完成',
    team_id: 1,
    version_id: 2,
    iteration_id: 3,
    sa_owner_name: '张三',
    sa_employee_id: 'A001',
    se_owner_name: null,
    se_employee_id: 'A002',
    ai_quality_level: '良好',
    ai_applicability: false,
    sa_ai_assisted: true,
    se_ai_assisted: null,
    ai_dev_mode: '超级单兵',
    sa_estimated_workload: 1,
    completed_at: '2026-08-20',
    remark: '备注',
  }, refs, { role: 'admin' })
  assert.equal(values.sa_owner_text, '张三 A001')
  assert.equal(values.se_owner_text, 'A002')
  assert.equal(values.ai_applicability, 'false')
  assert.equal(values.team_id, '1')

  assert.equal(DESIGN_PROFILE.formFromRecord(null, refs, { role: 'admin' }).team_id, '3')
  assert.equal(DESIGN_PROFILE.formFromRecord(null, refs, { role: 'maintainer', maintainer_team_id: 9 }).team_id, '9')
  assert.deepEqual(DESIGN_PROFILE.changesFromDraft({}, {
    progress: '完成',
    ai_applicability: false,
    sa_estimated_workload: '2.5',
    business_module: '',
  }), {
    progress: '完成',
    ai_applicability: false,
    sa_estimated_workload: 2.5,
    business_module: null,
  })
})

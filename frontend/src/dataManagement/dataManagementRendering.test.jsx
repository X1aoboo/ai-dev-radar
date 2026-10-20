import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { fetchJson, downloadFile } = vi.hoisted(() => ({ fetchJson: vi.fn(), downloadFile: vi.fn() }))

vi.mock('../api', () => ({ fetchJson, downloadFile }))

function textNode(value) {
  return value === null || value === undefined ? '' : String(value)
}

function renderText(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(renderText).join('')
  return renderText(node.children)
}

function MockTable({ columns = [], dataSource = [], rowKey = 'key', pagination, locale, onRow, ...props }) {
  const getValue = (record, dataIndex) => dataIndex ? record[dataIndex] : undefined
  return (
    <div data-table {...props}>
      <table><thead><tr>{columns.map((column) => <th key={column.key ?? column.dataIndex ?? column.title}>{column.title}</th>)}</tr></thead><tbody>
        {dataSource.length ? dataSource.map((record, index) => <tr key={record[rowKey] ?? index} {...(onRow?.(record) ?? {})}>{columns.map((column) => <td key={column.key ?? column.dataIndex ?? column.title}>{column.render ? column.render(getValue(record, column.dataIndex), record) : textNode(getValue(record, column.dataIndex))}</td>)}</tr>) : <tr><td>{locale?.emptyText ?? '暂无数据'}</td></tr>}
      </tbody></table>
      {pagination?.total > pagination?.pageSize && <button type="button" data-page-next onClick={() => pagination.onChange(pagination.current + 1)}>下一页</button>}
    </div>
  )
}

function MockForm({ children, onFinish }) {
  return <form noValidate data-form-submit={onFinish} onSubmit={(event) => { event.preventDefault(); onFinish?.({}) }}>{children}</form>
}
function mockUseForm() { return [{ setFieldsValue: vi.fn(), submit: vi.fn() }] }
function mockUseWatch() { return undefined }
function MockFormItem({ children, label }) { return typeof children === 'function' ? children({ getFieldValue: () => 'viewer' }) : <label>{label}{children}</label> }

function MockInput(props) { return <input {...props} /> }
function MockInputTextArea(props) { return <textarea {...props} className={`resize-none ${props.className ?? ''}`.trim()} style={{ resize: 'none', ...props.style }} /> }
function MockInputPassword(props) { return <input type="password" {...props} /> }

function MockSelect({ options = [], value, onChange, ...props }) {
  return <select {...props} value={value ?? ''} onChange={(event) => onChange?.(event.target.value)}>{options.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select>
}

function MockDrawer({ open, title, children, footer }) {
  if (!open) return null
  return <div role="dialog" aria-label={title} data-drawer><h2>{title}</h2>{children}<footer>{footer}</footer></div>
}

function MockModal({ open, title, children, onCancel, onOk, okText = '确定', cancelText = '取消', footer }) {
  if (!open) return null
  return <div role="dialog" aria-label={title} data-modal><h2>{title}</h2>{children}<footer>{footer ?? <><button type="button" onClick={onCancel}>{cancelText}</button><button type="button" onClick={onOk}>{okText}</button></>}</footer></div>
}

function MockCard({ title, extra, children, className }) { return <section className={className} data-card><header>{title}{extra}</header>{children}</section> }
function MockSpace({ children }) { return <div>{children}</div> }
function MockButton({ children, onClick, htmlType, ...props }) { return <button type={htmlType ?? 'button'} onClick={onClick} {...props}>{children}</button> }
function MockAlert({ message, description, children }) { return <div role="alert">{message}{description}{children}</div> }
function MockTypography({ children }) { return <span>{children}</span> }
function MockTypographyText({ children }) { return <span>{children}</span> }
function MockTypographyTitle({ children, level = 2 }) { return React.createElement(`h${level}`, null, children) }
function MockUpload({ children, beforeUpload }) { return <div data-upload data-before-upload={beforeUpload}>{children}</div> }
function MockDragger({ children, beforeUpload }) { return <div data-upload data-before-upload={beforeUpload}>{children}</div> }
MockUpload.Dragger = MockDragger
function MockPagination({ current = 1, pageSize = 20, total = 0, onChange }) {
  return <div data-pagination><button type="button" data-page-next disabled={current * pageSize >= total} onClick={() => onChange?.(current + 1)}>下一页</button></div>
}
function MockCheckboxGroup({ options = [], value = [], onChange }) {
  return <div data-checkbox-group>{options.map((option) => <label key={option.value}><input type="checkbox" value={option.value} checked={value.includes(option.value)} onChange={(event) => {
    const next = event.target.checked ? [...value, option.value] : value.filter((item) => item !== option.value)
    onChange?.(next)
  }} />{option.label}</label>)}</div>
}
function MockSegmented({ options = [], value, onChange }) {
  return <div data-segmented>{options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange?.(option.value)}>{option.label}</button>)}</div>
}
function MockTag({ children }) { return <span>{children}</span> }
function MockPopconfirm({ children, onConfirm, title, description }) { return <span data-popconfirm data-on-confirm={onConfirm} data-title={title} data-description={description}>{children}</span> }
function MockTabs({ items = [], activeKey, onChange }) { return <div data-tabs data-active-key={activeKey}>{items.map((item) => <section key={item.key}><h3>{item.label}</h3><button type="button" aria-label={`切换到 ${item.label}`} onClick={() => onChange?.(item.key)}>切换</button>{item.children}</section>)}</div> }
function MockDescriptions({ items = [] }) { return <dl>{items.map((item) => <div key={item.key}><dt>{item.label}</dt><dd>{item.children}</dd></div>)}</dl> }
function MockDivider({ children }) { return <hr data-divider aria-label={children} /> }
function MockSteps({ items = [] }) { return <ol>{items.map((item) => <li key={item.title}>{item.title}</li>)}</ol> }
function MockSpin({ children }) { return <span>加载中{children}</span> }
function MockEmpty({ description }) { return <div>{description}</div> }
function MockInputNumber(props) { return <input type="number" {...props} /> }

vi.mock('antd', () => ({
  Alert: MockAlert,
  Button: MockButton,
  Card: MockCard,
  Checkbox: { Group: MockCheckboxGroup },
  Descriptions: MockDescriptions,
  Divider: MockDivider,
  Drawer: MockDrawer,
  Empty: Object.assign(MockEmpty, { PRESENTED_IMAGE_SIMPLE: 'simple' }),
  Form: Object.assign(MockForm, { useForm: mockUseForm, useWatch: mockUseWatch, Item: MockFormItem }),
  Input: Object.assign(MockInput, { TextArea: MockInputTextArea, Password: MockInputPassword }),
  Modal: MockModal,
  InputNumber: MockInputNumber,
  Pagination: MockPagination,
  Popconfirm: MockPopconfirm,
  Segmented: MockSegmented,
  Select: MockSelect,
  Space: Object.assign(MockSpace, { Compact: MockSpace }),
  Spin: MockSpin,
  Steps: MockSteps,
  Table: MockTable,
  Tabs: MockTabs,
  Tag: MockTag,
  Typography: Object.assign(MockTypography, { Text: MockTypographyText, Title: MockTypographyTitle }),
  Upload: Object.assign(MockUpload, { Dragger: MockDragger }),
}))

vi.mock('@ant-design/icons', () => {
  const Icon = () => null
  return {
    DeleteOutlined: Icon,
    DownloadOutlined: Icon,
    DownOutlined: Icon,
    EditOutlined: Icon,
    ExportOutlined: Icon,
    FilterOutlined: Icon,
    InboxOutlined: Icon,
    InfoCircleOutlined: Icon,
    LockOutlined: Icon,
    PlusOutlined: Icon,
    ReloadOutlined: Icon,
    RightOutlined: Icon,
    SearchOutlined: Icon,
    SettingOutlined: Icon,
    UploadOutlined: Icon,
  }
})

import DataManagementPage from './DataManagementPage.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const team = { id: 1, name: '团队A', source_mapping: { product_versions: ['SCC 27.1.RC1'], repos: ['repo-a'] } }
const teamB = { id: 2, name: '团队B', source_mapping: { product_versions: [], repos: [] } }
const product = { id: 10, team_id: 1, team_name: '团队A', name: '产品A', versions: [{ id: 20, name: '版本A', product_id: 10 }] }
const productB = { id: 11, team_id: 2, team_name: '团队B', name: '产品B', versions: [{ id: 21, name: '版本B', product_id: 11 }] }
const version = { id: 20, name: '版本A', product_id: 10, product_name: '产品A', team_id: 1, team_name: '团队A', iterations: [{ id: 30, version_id: 20, name: '迭代一', start_date: '2026-08-01', end_date: '2026-08-31' }] }
const versionB = { id: 21, name: '版本B', product_id: 11, product_name: '产品B', team_id: 2, team_name: '团队B', iterations: [] }
const member = { id: 40, team_id: 1, employee_id: 'A001', name: '成员一', role: 'SA' }
const memberB = { id: 41, team_id: 2, employee_id: 'B001', name: '成员二', role: '测试' }
const irRecord = {
  id: 50,
  requirement_type: 'IR',
  requirement_no: 'IR-001',
  requirement_name: '需求一',
  team_id: 1,
  team_name: '团队A',
  product_id: 10,
  product_name: '产品A',
  version_id: 20,
  version_name: '版本A',
  iteration_id: 30,
  iteration_name: '迭代一',
  completed_at: '2026-08-20',
  business_module: 'CNAE',
  requirement_scenario: '场景一',
  progress: '进行中',
  sa_owner_name: '成员一',
  sa_employee_id: 'A001',
  sa_employee_name: '成员一',
  sa_employee_pending: false,
  se_owner_name: '成员一',
  se_employee_id: 'A001',
  se_employee_name: '成员一',
  se_employee_pending: false,
  ai_quality_level: '良好',
  ai_applicability: true,
  sa_ai_assisted: true,
  se_ai_assisted: false,
  ai_dev_mode: '设计开发一体化',
  ai_assisted: true,
  ai_attribute_metadata: {},
  remark: '备注一',
  estimated_workload: 2,
  actual_workload: 1,
  total_estimated_workload: 2,
  total_actual_workload: 1,
  sa_estimated_workload: 1,
  sa_actual_workload: 1,
  se_estimated_workload: 1,
  se_actual_workload: 0,
  responsible_employee_id: 'A001',
  responsible_employee_pending: false,
  record_source: 'manual',
  updated_by: 'admin',
  valid: true,
}
const irSummary = {
  total: 101,
  by_progress: { 进行中: 1, 完成: 0 },
  ai_used_count: 1,
  ai_known_count: 1,
  ai_usage_rate: 1,
  sa_estimated_workload: 1,
  sa_actual_workload: 1,
  se_estimated_workload: 1,
  se_actual_workload: 0,
  total_estimated_workload: 2,
  total_actual_workload: 1,
}
const catalog = [{ id: 1, code: 'sa', name: 'SA设计', kind: 'key', metrics: [{ id: 100, activity_id: 1, code: 'sa-pen', name: 'IR需求渗透率', type: 'penetration', numerator_semantic: 'AI数', denominator_semantic: '总数', collect_method: 'manual_only' }] }]
const teamImportPreview = { filename: 'team.csv', total_rows: 2, valid_rows: 2, invalid_rows: 0, rows: [{ row_number: 2, team_name: '导入团队', employee_id: 'IMP001', name: '导入成员', role: 'SA', action: 'create', team_action: 'create', changes: {}, errors: [], warnings: [], target_member_id: null }, { row_number: 3, team_name: '团队A', employee_id: 'A001', name: '成员一', role: 'SE', action: 'update', team_action: 'existing', changes: { role: 'SE' }, errors: [], warnings: [], target_member_id: 40 }], summary: { total_rows: 2, valid_rows: 2, invalid_rows: 0, create: 1, update: 1, unchanged: 0, teams_create: 1 } }
const maturityRecord = { team_id: 1, month: '2026-08', activity_id: 1, score_raw: '0', note: '零分是有效评估' }
const collectorBatchSummary = { id: 301, domain: 'ir', source_kind: 'collector', team_id: 1, status: 'pending', created_by: 'scheduled-collector', created_at: '2026-09-18T01:00:00', total_rows: 1, valid_rows: 1, invalid_rows: 0 }
const collectorBatchDetails = { ...collectorBatchSummary, filename: null, confirmed_at: null, rows: [{ id: 1, row_number: 1, source_id: 'IR-COLLECTED', source_system: 'internal-ir', operation: 'insert', diff: {}, errors: [], warnings: [], status: 'valid', target_id: null, payload: { requirement_no: 'IR-COLLECTED' } }] }

function responseFor(url) {
  if (url === '/api/teams/imports/preview') return teamImportPreview
  if (url === '/api/teams/imports/confirm') return { created_teams: 1, existing_teams: 0, created_members: 1, updated_members: 1, unchanged_members: 0 }
  if (url === '/api/teams/export') return new Blob([])
  if (url.startsWith('/api/teams')) return [team, teamB]
  if (url.startsWith('/api/products')) return [product, productB]
  if (url.startsWith('/api/versions')) return [version, versionB]
  if (url.startsWith('/api/team-members')) return [member, memberB]
  if (url.startsWith('/api/catalog')) return catalog
  if (url.startsWith('/api/maturity/records?') && url.includes('month=2026-08')) return [maturityRecord]
  if (url.startsWith('/api/maturity/records?') && url.includes('month=2026-07')) return [{ ...maturityRecord, month: '2026-07', score_raw: '3', note: '上月评估' }]
  if (url.startsWith('/api/maturity/records?')) return []
  if (url.startsWith('/api/maturity/overview?')) return { kind: url.includes('kind=general') ? 'general' : 'key', team_count: 2, activities: [{ activity_id: 1, activity_name: 'SA设计', score_display: '3.00', level: 'L3', assessed_team_count: 1 }] }
  if (url.startsWith('/api/data/ir?')) return { items: [irRecord], total: 101, page: 1, page_size: 20, summary: irSummary }
  if (url.includes('/imports/preview')) return { id: 300, domain: 'ir', source_kind: 'import', status: 'pending', team_id: null, filename: 'ir.csv', total_rows: 1, valid_rows: 1, invalid_rows: 0, rows: [{ row_number: 2, source_id: 'IR-NEW', operation: 'insert', diff: {}, errors: [], warnings: [] }] }
  if (url === '/api/data/ir/imports?source_kind=collector&status=pending') return [collectorBatchSummary]
  if (url === '/api/data/ir/imports/301') return collectorBatchDetails
  if (url === '/api/data/ir/imports/301/confirm') return { created: 1, updated: 0, unchanged: 0 }
  if (url.includes('/imports/300/confirm')) return { created: 1, updated: 0, unchanged: 0 }
  return {}
}

async function render(section, user = { id: 1, username: 'admin', role: 'admin' }, initialMonth, respond = responseFor) {
  fetchJson.mockImplementation(async (url) => respond(String(url)))
  let renderer
  await act(async () => { renderer = create(<DataManagementPage section={section} user={user} initialMonth={initialMonth} onSessionExpired={() => undefined} />) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  return renderer
}

afterEach(() => { fetchJson.mockReset(); downloadFile.mockReset() })

describe('data management workbench rendering', () => {
  test('requirements group IR, AR, and SR as page tabs', async () => {
    const onRequirementTypeChange = vi.fn()
    fetchJson.mockImplementation(async (url) => responseFor(String(url)))
    let renderer
    await act(async () => { renderer = create(<DataManagementPage section="requirements" requirementType="ar" onRequirementTypeChange={onRequirementTypeChange} user={{ id: 1, username: 'admin', role: 'admin' }} onSessionExpired={() => undefined} />) })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(renderer.root.findByProps({ 'data-active-key': 'ar' })).toBeDefined()
    expect(renderer.root.findAllByType('h3').map((heading) => heading.children[0])).toEqual(expect.arrayContaining(['IR', 'AR', 'SR']))
    await act(async () => { renderer.root.findByProps({ 'aria-label': '切换到 SR' }).props.onClick() })
    expect(onRequirementTypeChange).toHaveBeenCalledWith('sr')
    renderer.unmount()
  })

  test('maturity maintenance edits in a table, previews in a drawer, and preserves a zero score', async () => {
    const renderer = await render('maturity', { id: 2, username: 'maintainer', role: 'maintainer', maintainer_team_id: 1 }, '2026-08')
    const score = renderer.root.findByProps({ 'aria-label': 'SA设计成熟度分值' })
    expect(score.props.value).toBe(0)
    expect(renderer.root.findAllByProps({ className: 'operational-filter-toolbar maturity-management__toolbar' })).toHaveLength(1)
    expect(renderer.root.findByProps({ 'aria-label': '维护团队' }).props.disabled).toBe(true)
    expect(renderText(renderer.toJSON())).toContain('团队由账号绑定，不能修改。')

    await act(async () => renderer.root.findAllByType('button').find((button) => button.children.includes('预览保存')).props.onClick())
    expect(renderText(renderer.root.findByProps({ 'data-drawer': true }))).toContain('0')
    expect(renderText(renderer.root.findByProps({ 'data-drawer': true }))).toContain('零分是有效评估')

    const saveButton = renderer.root.findAllByType('button').find((button) => button.children.includes('确认保存'))
    await act(async () => saveButton.props.onClick())
    const saveCall = fetchJson.mock.calls.find(([url, options]) => url.includes('/api/maturity/teams/1/months/2026-08') && options?.method === 'PUT')
    expect(JSON.parse(saveCall[1].body)).toEqual({ entries: [{ activity_id: 1, score: '0', note: '零分是有效评估' }] })
    renderer.unmount()
  })

  test('maturity copy stays a draft and clear requires its existing second confirmation', async () => {
    const renderer = await render('maturity', { id: 2, username: 'maintainer', role: 'maintainer', maintainer_team_id: 1 }, '2026-08')
    const copyButton = renderer.root.findAllByType('button').find((button) => button.children.includes('复制上月已有值'))
    expect(copyButton.props.disabled).toBeFalsy()
    await act(async () => copyButton.props.onClick())
    await act(async () => renderer.root.findAllByType('button').find((button) => button.children.includes('预览保存')).props.onClick())
    expect(renderText(renderer.root.findByProps({ 'data-drawer': true }))).toContain('3')
    expect(renderText(renderer.root.findByProps({ 'data-drawer': true }))).toContain('上月评估')
    expect(fetchJson.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false)

    await act(async () => renderer.root.findAllByType('button').find((button) => button.children.includes('返回编辑')).props.onClick())
    const clearButton = renderer.root.findAllByType('button').find((button) => button.children.includes('清空本月评估'))
    await act(async () => clearButton.props.onClick())
    expect(fetchJson.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false)
    const confirmClear = renderer.root.findAllByType('button').find((button) => button.children.includes('再次确认清空'))
    await act(async () => confirmClear.props.onClick())
    expect(fetchJson.mock.calls.some(([url, options]) => url.includes('/api/maturity/teams/1/months/2026-08') && options?.method === 'DELETE')).toBe(true)
    renderer.unmount()
  })

  test('viewer maturity is read-only and uses two compact table sections', async () => {
    const renderer = await render('maturity', { id: 3, username: 'viewer', role: 'viewer' }, '2026-08')
    expect(renderText(renderer.toJSON())).toContain('只读')
    expect(renderer.root.findAllByProps({ className: 'maturity-readonly-sections' })).toHaveLength(1)
    expect(renderer.root.findAllByProps({ 'data-table': true })).toHaveLength(2)
    expect(renderer.root.findAllByProps({ 'data-card': true })).toHaveLength(0)
    expect(renderer.root.findAllByType('button').some((button) => button.children.includes('预览保存'))).toBe(false)
    renderer.unmount()
  })

  test('maturity catalog failure renders an error instead of an empty assessment table', async () => {
    const renderer = await render('maturity', { id: 1, username: 'admin', role: 'admin' }, '2026-08', (url) => {
      if (url === '/api/catalog') throw new Error('catalog unavailable')
      return responseFor(url)
    })
    expect(renderText(renderer.toJSON())).toContain('catalog unavailable')
    expect(renderer.root.findAllByProps({ 'data-table': true })).toHaveLength(0)
    renderer.unmount()
  })

  test('team personnel page renders a full directory and standardized role list', async () => {
    const renderer = await render('teams')
    const text = renderText(renderer.toJSON())
    expect(text).toContain('团队与人员')
    expect(text).toContain('人员列表')
    expect(text).toContain('全部团队')
    expect(text).toContain('成员一')
    expect(text).toContain('成员二')
    expect(text).toContain('SA')
    expect(text).toContain('测试')
    expect(text).toContain('角色分布')
    expect(text).not.toContain('产品版本映射')
    expect(text).not.toContain('代码仓地址')
    expect(text).not.toContain('数据源映射')
    renderer.unmount()
  })

  test('team member inline editing saves through PATCH', async () => {
    const renderer = await render('teams')
    const editButton = renderer.root.findAllByType('button').find((button) => button.props['aria-label'] === '编辑成员 成员一')
    await act(async () => editButton.props.onClick())
    const nameInput = renderer.root.findAllByProps({ 'aria-label': '姓名' })[0]
    await act(async () => nameInput.props.onChange({ target: { value: '成员一（已编辑）' } }))
    const saveButton = renderer.root.findAllByType('button').find((button) => button.props['aria-label'] === '保存成员 成员一')
    await act(async () => saveButton.props.onClick())
    const patchCall = fetchJson.mock.calls.find(([url, options]) => url === '/api/team-members/40' && options?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    expect(JSON.parse(patchCall[1].body)).toMatchObject({ name: '成员一（已编辑）', team_id: 1, role: 'SA' })
    expect(renderText(renderer.toJSON())).toContain('成员信息已保存。')
    renderer.unmount()
  })

  test('team and member creation use modals with only personnel fields', async () => {
    const renderer = await render('teams')
    const createTeam = renderer.root.findAllByType('button').find((button) => button.children.includes('新增团队'))
    await act(async () => createTeam.props.onClick())
    const teamModal = renderer.root.findByProps({ 'data-modal': true })
    expect(teamModal.props['aria-label']).toBe('新增团队')
    expect(renderText(renderer.toJSON())).not.toContain('代码仓')
    const teamForm = renderer.root.findAll((node) => Boolean(node.props['data-form-submit'])).at(-1)
    await act(async () => teamForm.props['data-form-submit']({ name: '团队E' }))
    expect(fetchJson.mock.calls.some(([url, options]) => url === '/api/teams' && options?.method === 'POST' && options.body === JSON.stringify({ name: '团队E' }))).toBe(true)

    const createMember = renderer.root.findAllByType('button').find((button) => button.children.includes('新增成员'))
    await act(async () => createMember.props.onClick())
    expect(renderer.root.findAllByProps({ 'data-modal': true }).length).toBeGreaterThan(0)
    const memberForm = renderer.root.findAll((node) => Boolean(node.props['data-form-submit'])).at(-1)
    await act(async () => memberForm.props['data-form-submit']({ team_id: '1', employee_id: 'A003', name: '成员三', role: '开发' }))
    expect(fetchJson.mock.calls.some(([url, options]) => url === '/api/team-members' && options?.method === 'POST')).toBe(true)
    renderer.unmount()
  })

  test('maintainer sees only the bound team and has no edit controls', async () => {
    const renderer = await render('teams', { id: 2, username: 'maintainer.团队A', role: 'maintainer', maintainer_team_id: 1 })
    const text = renderText(renderer.toJSON())
    expect(text).toContain('团队A')
    expect(text).not.toContain('团队B')
    expect(renderer.root.findAllByType('button').some((button) => button.props['aria-label'] === '编辑成员 成员一')).toBe(false)
    expect(renderer.root.findAllByType('button').some((button) => button.children.includes('新增成员'))).toBe(false)
    renderer.unmount()
  })

  test('team personnel page offers template download and scoped export', async () => {
    const renderer = await render('teams')
    const templateButton = renderer.root.findAllByType('button').find((button) => String(button.children).includes('下载模板'))
    await act(async () => templateButton.props.onClick())
    expect(downloadFile.mock.calls.some(([url]) => url === '/api/teams/import-template')).toBe(true)
    const exportButton = renderer.root.findAllByType('button').find((button) => String(button.children).includes('导出 Excel'))
    await act(async () => exportButton.props.onClick())
    expect(downloadFile.mock.calls.some(([url]) => url === '/api/teams/export')).toBe(true)
    renderer.unmount()
  })

  test('team import modal previews rows and confirms the batch', async () => {
    const renderer = await render('teams')
    const importButton = renderer.root.findAllByType('button').find((button) => String(button.children).includes('导入 Excel'))
    await act(async () => importButton.props.onClick())
    const upload = renderer.root.findAll((node) => typeof node.props['data-before-upload'] === 'function')[0]
    await act(async () => {
      await upload.props['data-before-upload']({
        name: 'team.csv',
        type: 'text/csv',
        arrayBuffer: async () => new ArrayBuffer(0),
      })
    })
    const previewText = renderText(renderer.toJSON())
    expect(previewText).toContain('共 2 行')
    expect(previewText).toContain('新增 1')
    expect(previewText).toContain('更新 1')
    expect(previewText).toContain('导入团队')
    const confirmButton = renderer.root.findAllByType('button').find((button) => String(button.children).includes('确认导入'))
    await act(async () => confirmButton.props.onClick())
    expect(fetchJson.mock.calls.some(([url, options]) => url === '/api/teams/imports/confirm' && options?.method === 'POST')).toBe(true)
    expect(renderText(renderer.toJSON())).toContain('导入完成')
    renderer.unmount()
  })

  test('product hierarchy renders team, product, PI and optional iterations', async () => {
    const renderer = await render('products')
    const text = renderText(renderer.toJSON())
    expect(text).toContain('产品、PI 与迭代')
    expect(text).toContain('PI（产品版本）')
    expect(text).toContain('团队A')
    expect(text).toContain('产品A')
    expect(text).toContain('版本A')
    expect(text).toContain('迭代一')
    expect(text).toContain('0 个迭代（可选）')
    expect(renderer.root.findAllByProps({ className: 'settings-master-detail' })).toHaveLength(0)
    renderer.unmount()
  })

  test('product hierarchy collapses and expands every parent level', async () => {
    const renderer = await render('products')
    const teamToggle = renderer.root.findAllByType('button').find((button) => button.props['aria-label'] === '收起团队 团队A')
    await act(async () => teamToggle.props.onClick())
    let text = renderText(renderer.toJSON())
    expect(text).not.toContain('产品A')
    const expandTeam = renderer.root.findAllByType('button').find((button) => button.props['aria-label'] === '展开团队 团队A')
    await act(async () => expandTeam.props.onClick())
    expect(renderText(renderer.toJSON())).toContain('产品A')

    const productToggle = renderer.root.findAllByType('button').find((button) => button.props['aria-label'] === '收起产品 产品A')
    await act(async () => productToggle.props.onClick())
    text = renderText(renderer.toJSON())
    expect(text).toContain('产品A')
    expect(text).not.toContain('版本A')

    const expandProduct = renderer.root.findAllByType('button').find((button) => button.props['aria-label'] === '展开产品 产品A')
    await act(async () => expandProduct.props.onClick())
    const piToggle = renderer.root.findAllByType('button').find((button) => button.props['aria-label'] === '收起 PI 版本A')
    await act(async () => piToggle.props.onClick())
    text = renderText(renderer.toJSON())
    expect(text).toContain('版本A')
    expect(text).not.toContain('迭代一')

    const collapseAll = renderer.root.findAllByType('button').find((button) => button.children.includes('全部收起'))
    await act(async () => collapseAll.props.onClick())
    expect(renderText(renderer.toJSON())).not.toContain('产品A')
    const expandAll = renderer.root.findAllByType('button').find((button) => button.children.includes('全部展开'))
    await act(async () => expandAll.props.onClick())
    expect(renderText(renderer.toJSON())).toContain('产品A')
    renderer.unmount()
  })

  test('product hierarchy creates products, PIs and optional iterations through modals', async () => {
    const renderer = await render('products')
    const createProduct = renderer.root.findAllByType('button').find((button) => String(button.children).includes('新增产品'))
    await act(async () => createProduct.props.onClick())
    let form = renderer.root.findAll((node) => Boolean(node.props['data-form-submit'])).at(-1)
    await act(async () => form.props['data-form-submit']({ team_id: '1', name: '产品C' }))
    expect(fetchJson.mock.calls.some(([url, options]) => url === '/api/products' && options?.method === 'POST')).toBe(true)

    const createPi = renderer.root.findAllByType('button').find((button) => String(button.children).includes('新增 PI'))
    await act(async () => createPi.props.onClick())
    form = renderer.root.findAll((node) => Boolean(node.props['data-form-submit'])).at(-1)
    await act(async () => form.props['data-form-submit']({ product_id: '10', name: 'PI-新' }))
    expect(fetchJson.mock.calls.some(([url, options]) => url === '/api/versions' && options?.method === 'POST')).toBe(true)

    const createIteration = renderer.root.findAllByType('button').find((button) => String(button.children).includes('新增迭代'))
    await act(async () => createIteration.props.onClick())
    form = renderer.root.findAll((node) => Boolean(node.props['data-form-submit'])).at(-1)
    await act(async () => form.props['data-form-submit']({ version_id: '20', name: '迭代二', start_date: '2026-09-01', end_date: '2026-09-30' }))
    expect(fetchJson.mock.calls.some(([url, options]) => url === '/api/iterations' && options?.method === 'POST')).toBe(true)
    renderer.unmount()
  })

  test('product hierarchy is read-only for maintainer and scoped to the bound team', async () => {
    const renderer = await render('products', { id: 2, username: 'maintainer.团队A', role: 'maintainer', maintainer_team_id: 1 })
    const text = renderText(renderer.toJSON())
    expect(text).toContain('团队A')
    expect(text).not.toContain('团队B')
    expect(renderer.root.findAllByType('button').some((button) => String(button.children).includes('新增产品'))).toBe(false)
    expect(renderer.root.findAllByType('button').some((button) => String(button.children).includes('新增 PI'))).toBe(false)
    renderer.unmount()
  })

  test('metric dictionary is read-only and groups metrics by activity', async () => {
    const renderer = await render('metrics')
    const text = renderText(renderer.toJSON())
    expect(text).toContain('指标字典')
    expect(text).toContain('只读字典')
    expect(text).toContain('关键研发活动')
    expect(text).toContain('SA设计')
    expect(text).toContain('IR需求渗透率')
    expect(text).toContain('AI数 ÷ 总数')
    expect(text).toContain('使用位置')
    expect(text).not.toContain('源数据指标规则')
    expect(renderer.root.findAllByType('button').some((button) => button.children.includes('新增指标'))).toBe(false)
    expect(renderer.root.findAllByType('button').some((button) => button.children.includes('新增活动'))).toBe(false)
    renderer.unmount()
  })

  test('metric dictionary opens a read-only detail drawer with business formula', async () => {
    const renderer = await render('metrics')
    const row = renderer.root.findAllByProps({ className: 'metric-row' })[0]
    await act(async () => { row.props.onClick() })
    const text = renderText(renderer.toJSON())
    expect(text).toContain('计算公式')
    expect(text).toContain('AI数 ÷ 总数')
    expect(text).toContain('研发事实')
    expect(text).toContain('计算步骤')
    expect(text).not.toContain('保存指标')
    expect(text).not.toContain('编辑看板指标')
    renderer.unmount()
  })

  test('IR workbench renders summary, grouped headers, full-template view, and server pagination', async () => {
    const renderer = await render('ir')
    expect(renderer.root.findAllByType('h1').map((heading) => heading.children[0])).toContain('IR 需求数据')
    expect(renderer.root.findAllByProps({ className: 'ir-summary' })).toHaveLength(1)
    expect(renderer.root.findAllByProps({ className: 'ir-table' })).toHaveLength(1)
    expect(renderer.root.findAllByProps({ 'data-page-next': true })).toHaveLength(1)
    const text = renderText(renderer.toJSON())
    for (const label of ['需求信息', '归属', '责任人', '工作量（人天）', 'AI 属性', '设计时间', '全部模板字段']) {
      expect(text).toContain(label)
    }
    expect(text).toContain('SA 或 SE 使用 AI')
    renderer.unmount()
  })

  test('IR inline edit stages one cell and saves a bulk change', async () => {
    const renderer = await render('ir')
    const progressCell = renderer.root.findAll((node) => String(node.props.className ?? '').includes('ir-cell') && String(node.props['aria-label'] ?? '').includes('编辑进展'))[0]
    expect(progressCell).toBeDefined()
    await act(async () => progressCell.props.onClick({ stopPropagation: () => undefined }))
    const editorSelect = renderer.root.findAllByType('select').find((select) => select.props.autoFocus)
    expect(editorSelect).toBeDefined()
    await act(async () => editorSelect.props.onChange({ target: { value: '完成' } }))
    expect(renderer.root.findAllByProps({ className: 'ir-savebar' })).toHaveLength(1)
    const saveButton = renderer.root.findAllByType('button').find((button) => renderText(button).includes('保存修改'))
    await act(async () => saveButton.props.onClick())
    const bulkCall = fetchJson.mock.calls.find(([url, options]) => url === '/api/data/ir/bulk' && options?.method === 'PATCH')
    expect(bulkCall).toBeDefined()
    expect(JSON.parse(bulkCall[1].body)).toEqual({ items: [{ id: 50, changes: { progress: '完成' } }] })
    renderer.unmount()
  })

  test('IR common and advanced filters query the server and reset', async () => {
    const renderer = await render('ir')
    const teamSelect = renderer.root.findAllByType('select').find((select) => select.props['aria-label'] === '归属组')
    await act(async () => teamSelect.props.onChange({ target: { value: '1' } }))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(fetchJson.mock.calls.some(([url]) => String(url).includes('team_id=1'))).toBe(true)

    const advancedButton = renderer.root.findAllByType('button').find((button) => renderText(button).includes('高级筛选'))
    await act(async () => advancedButton.props.onClick())
    const moduleInput = renderer.root.findByProps({ 'aria-label': '所属功能' })
    await act(async () => moduleInput.props.onChange({ target: { value: 'CNAE' } }))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(fetchJson.mock.calls.some(([url]) => String(url).includes('business_module=CNAE'))).toBe(true)
    expect(renderText(renderer.root.findByProps({ className: 'ir-filter-count' }))).toBe('2')

    const resetButton = renderer.root.findAllByType('button').find((button) => renderText(button).includes('重置'))
    await act(async () => resetButton.props.onClick())
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    const latest = fetchJson.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/api/data/ir?')).at(-1)
    expect(latest).not.toContain('team_id=')
    expect(latest).not.toContain('business_module=')
    expect(renderer.root.findAllByProps({ className: 'ir-filter-count' })).toHaveLength(0)
    renderer.unmount()
  })

  test('IR import wizard previews a batch and confirms it explicitly', async () => {
    const renderer = await render('ir')
    const importButton = renderer.root.findAllByType('button').find((button) => renderText(button).includes('导入 Excel'))
    await act(async () => importButton.props.onClick())
    const upload = renderer.root.findByProps({ 'data-upload': true })
    await act(async () => {
      upload.props['data-before-upload']({ name: 'ir.csv', type: 'text/csv', arrayBuffer: async () => new ArrayBuffer(0) })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const drawer = renderer.root.findByProps({ 'data-drawer': true })
    expect(renderText(drawer)).toContain('总行数 1')
    expect(renderText(drawer)).toContain('新增 1')
    const confirmButton = renderer.root.findAllByType('button').find((button) => renderText(button).includes('确认写入正式数据'))
    await act(async () => confirmButton.props.onClick())
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(fetchJson.mock.calls.some(([url]) => String(url).includes('/imports/300/confirm'))).toBe(true)
    renderer.unmount()
  })

  test('collector batches render compactly and confirm through the shared drawer', async () => {
    const renderer = await render('ir')
    expect(renderer.root.findAllByProps({ className: 'ir-collector-strip' })).toHaveLength(1)
    const batchButton = renderer.root.findAllByType('button').find((button) => renderText(button).includes('1/1'))
    await act(async () => batchButton.props.onClick())
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    const drawer = renderer.root.findByProps({ 'data-drawer': true })
    expect(drawer.props['aria-label']).toContain('采集批次预览')
    const confirmButton = renderer.root.findAllByType('button').find((button) => renderText(button).includes('确认采集批次'))
    await act(async () => confirmButton.props.onClick())
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(fetchJson.mock.calls.some(([url]) => String(url).includes('/imports/301/confirm'))).toBe(true)
    renderer.unmount()
  })

  test('viewer is read-only and maintainer team scope is locked', async () => {
    const viewer = await render('ir', { id: 3, username: 'viewer', role: 'viewer' })
    expect(renderText(viewer.toJSON())).toContain('只读')
    expect(viewer.root.findAllByType('button').some((button) => renderText(button).includes('新增 IR'))).toBe(false)
    expect(viewer.root.findAllByProps({ className: 'ir-cell' })).toHaveLength(0)
    viewer.unmount()

    const maintainer = await render('ir', { id: 2, username: 'maintainer.团队A', role: 'maintainer', maintainer_team_id: 1 })
    const teamSelect = maintainer.root.findAllByType('select').find((select) => select.props['aria-label'] === '归属组')
    expect(teamSelect.props.disabled).toBe(true)
    maintainer.unmount()
  })

})

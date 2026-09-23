import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { fetchJson } = vi.hoisted(() => ({ fetchJson: vi.fn() }))

vi.mock('../api', () => ({ fetchJson }))

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

function MockCard({ title, extra, children, className }) { return <section className={className} data-card><header>{title}{extra}</header>{children}</section> }
function MockSpace({ children }) { return <div>{children}</div> }
function MockButton({ children, onClick, htmlType, ...props }) { return <button type={htmlType ?? 'button'} onClick={onClick} {...props}>{children}</button> }
function MockAlert({ message, description, children }) { return <div role="alert">{message}{description}{children}</div> }
function MockTypography({ children }) { return <span>{children}</span> }
function MockTypographyText({ children }) { return <span>{children}</span> }
function MockTypographyTitle({ children, level = 2 }) { return React.createElement(`h${level}`, null, children) }
function MockUpload({ children, beforeUpload }) { return <div data-upload data-before-upload={beforeUpload}>{children}</div> }
function MockTag({ children }) { return <span>{children}</span> }
function MockPopconfirm({ children, onConfirm, title, description }) { return <span data-popconfirm data-on-confirm={onConfirm} data-title={title} data-description={description}>{children}</span> }
function MockTabs({ items = [], activeKey, onChange }) { return <div data-tabs data-active-key={activeKey}>{items.map((item) => <section key={item.key}><h3>{item.label}</h3><button type="button" aria-label={`切换到 ${item.label}`} onClick={() => onChange?.(item.key)}>切换</button>{item.children}</section>)}</div> }
function MockDescriptions({ items = [] }) { return <dl>{items.map((item) => <div key={item.key}><dt>{item.label}</dt><dd>{item.children}</dd></div>)}</dl> }
function MockDivider({ children }) { return <hr data-divider aria-label={children} /> }
function MockSteps({ items = [] }) { return <ol>{items.map((item) => <li key={item.title}>{item.title}</li>)}</ol> }
function MockSpin() { return <span>加载中</span> }
function MockEmpty({ description }) { return <div>{description}</div> }
function MockInputNumber(props) { return <input type="number" {...props} /> }

vi.mock('antd', () => ({
  Alert: MockAlert,
  Button: MockButton,
  Card: MockCard,
  Descriptions: MockDescriptions,
  Divider: MockDivider,
  Drawer: MockDrawer,
  Empty: Object.assign(MockEmpty, { PRESENTED_IMAGE_SIMPLE: 'simple' }),
  Form: Object.assign(MockForm, { useForm: mockUseForm, useWatch: mockUseWatch, Item: MockFormItem }),
  Input: Object.assign(MockInput, { TextArea: MockInputTextArea, Password: MockInputPassword }),
  InputNumber: MockInputNumber,
  Popconfirm: MockPopconfirm,
  Select: MockSelect,
  Space: Object.assign(MockSpace, { Compact: MockSpace }),
  Spin: MockSpin,
  Steps: MockSteps,
  Table: MockTable,
  Tabs: MockTabs,
  Tag: MockTag,
  Typography: Object.assign(MockTypography, { Text: MockTypographyText, Title: MockTypographyTitle }),
  Upload: MockUpload,
}))

vi.mock('@ant-design/icons', () => {
  const Icon = () => null
  return { DeleteOutlined: Icon, EditOutlined: Icon, PlusOutlined: Icon, ReloadOutlined: Icon, UploadOutlined: Icon }
})

import DataManagementPage from './DataManagementPage.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const team = { id: 1, name: '团队A', source_mapping: { product_versions: ['SCC 27.1.RC1'], repos: ['repo-a'] } }
const teamB = { id: 2, name: '团队B', source_mapping: { product_versions: [], repos: [] } }
const product = { id: 10, team_id: 1, team_name: '团队A', name: '产品A', versions: [{ id: 20, name: '版本A', product_id: 10 }] }
const productB = { id: 11, team_id: 2, team_name: '团队B', name: '产品B', versions: [{ id: 21, name: '版本B', product_id: 11 }] }
const version = { id: 20, name: '版本A', product_id: 10, product_name: '产品A', team_id: 1, team_name: '团队A', iterations: [{ id: 30, version_id: 20, name: '迭代一', start_date: '2026-08-01', end_date: '2026-08-31' }] }
const versionB = { id: 21, name: '版本B', product_id: 11, product_name: '产品B', team_id: 2, team_name: '团队B', iterations: [] }
const member = { id: 40, team_id: 1, employee_id: 'A001', name: '成员一', role: '研发工程师' }
const irRecord = { id: 50, requirement_no: 'IR-001', requirement_name: '需求一', team_id: 1, team_name: '团队A', product_id: 10, product_name: '产品A', version_id: 20, version_name: '版本A', iteration_id: 30, iteration_name: '迭代一', completed_at: '2026-08-20', business_module: 'CNAE', requirement_scenario: '场景一', ai_assisted: false, estimated_workload: 2, actual_workload: 1, sa_estimated_workload: 1, sa_actual_workload: 1, se_estimated_workload: 1, se_actual_workload: 0, responsible_employee_id: 'A001', responsible_employee_pending: false, record_source: 'manual', updated_by: 'admin', valid: true }
const catalog = [{ id: 1, code: 'sa', name: 'SA设计', kind: 'key', metrics: [{ id: 100, activity_id: 1, code: 'sa-pen', name: 'IR需求渗透率', type: 'penetration', numerator_semantic: 'AI数', denominator_semantic: '总数', collect_method: 'manual_only' }] }]
const dataMetric = { id: 200, domain: 'ir', code: 'ir-ai-penetration', name: 'IR AI渗透率', metric_type: 'penetration', activity_code: 'sa', numerator_field: 'ai_assisted', denominator_field: 'record_count', filter_definition: {}, active: true }
const maturityRecord = { team_id: 1, month: '2026-08', activity_id: 1, score_raw: '0', note: '零分是有效评估' }
const collectorBatchSummary = { id: 301, domain: 'ir', source_kind: 'collector', team_id: 1, status: 'pending', created_by: 'scheduled-collector', created_at: '2026-09-18T01:00:00', total_rows: 1, valid_rows: 1, invalid_rows: 0 }
const collectorBatchDetails = { ...collectorBatchSummary, filename: null, confirmed_at: null, rows: [{ id: 1, row_number: 1, source_id: 'IR-COLLECTED', source_system: 'internal-ir', operation: 'insert', diff: {}, errors: [], warnings: [], status: 'valid', target_id: null, payload: { requirement_no: 'IR-COLLECTED' } }] }

function responseFor(url) {
  if (url.startsWith('/api/teams')) return [team, teamB]
  if (url.startsWith('/api/products')) return [product, productB]
  if (url.startsWith('/api/versions')) return [version, versionB]
  if (url.startsWith('/api/team-members')) return [member]
  if (url.startsWith('/api/catalog')) return catalog
  if (url.startsWith('/api/maturity/records?') && url.includes('month=2026-08')) return [maturityRecord]
  if (url.startsWith('/api/maturity/records?') && url.includes('month=2026-07')) return [{ ...maturityRecord, month: '2026-07', score_raw: '3', note: '上月评估' }]
  if (url.startsWith('/api/maturity/records?')) return []
  if (url.startsWith('/api/maturity/overview?')) return { kind: url.includes('kind=general') ? 'general' : 'key', team_count: 2, activities: [{ activity_id: 1, activity_name: 'SA设计', score_display: '3.00', level: 'L3', assessed_team_count: 1 }] }
  if (url.startsWith('/api/data/ir?')) return { items: [irRecord], total: 101 }
  if (url === '/api/data-metrics?domain=ir') return [dataMetric]
  if (url.startsWith('/api/data-metrics/compute')) return { metric_code: dataMetric.code, metric_name: dataMetric.name, numerator: 1, denominator: 2, value: 0.5, record_count: 2 }
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

afterEach(() => { fetchJson.mockReset() })

describe('data management workbench rendering', () => {
  test('IR header and filters remain visible while reference data loads', async () => {
    fetchJson.mockImplementation(async (url) => {
      if (['/api/teams', '/api/products', '/api/versions', '/api/team-members'].includes(url)) return new Promise(() => {})
      return responseFor(String(url))
    })
    let renderer
    await act(async () => { renderer = create(<DataManagementPage section="ir" user={{ id: 1, username: 'admin', role: 'admin' }} onSessionExpired={() => undefined} />) })
    expect(renderer.root.findAllByType('h1').map((heading) => heading.children[0])).toContain('IR 需求数据')
    expect(renderer.root.findAllByProps({ className: 'operational-filter-toolbar' })).toHaveLength(1)
    renderer.unmount()
  })

  test('IR uses common and advanced filters, server pagination, and an AntD Drawer editor', async () => {
    const renderer = await render('ir')
    expect(renderer.root.findAllByProps({ 'data-table': true }).length).toBeGreaterThan(0)
    expect(renderer.root.findAllByType('button').some((button) => button.children.includes('高级筛选'))).toBe(true)
    expect(renderer.root.findAllByProps({ 'data-page-next': true })).toHaveLength(1)

    await act(async () => { renderer.root.findAllByType('button').find((button) => button.children.includes('新增 IR')).props.onClick() })
    expect(renderer.root.findByProps({ 'data-drawer': true }).props['aria-label']).toBe('新增 IR 需求')
    expect(renderer.root.findAllByProps({ 'data-divider': true }).map((divider) => divider.props['aria-label'])).toEqual(['基础信息', '归属', '业务信息', '工作量', 'AI 属性'])
    renderer.unmount()
  })

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

  test('IR pagination preserves the page in the server query', async () => {
    const renderer = await render('ir')
    await act(async () => { renderer.root.findByProps({ 'data-page-next': true }).props.onClick() })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(fetchJson.mock.calls.some(([url]) => String(url).includes('page=2'))).toBe(true)
    renderer.unmount()
  })

  test('IR common filter changes reload the server query', async () => {
    const renderer = await render('ir')
    const teamSelect = renderer.root.findAllByType('select')[0]
    await act(async () => { teamSelect.props.onChange({ target: { value: '1' } }) })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(fetchJson.mock.calls.some(([url]) => String(url).includes('team_id=1'))).toBe(true)
    renderer.unmount()
  })

  test('IR advanced filters show active count, query automatically, and reset', async () => {
    const renderer = await render('ir')
    const buttonNamed = (text) => renderer.root.findAllByType('button').find((button) => renderText(button).includes(text))
    expect(renderer.root.findAllByProps({ className: 'operational-filter-count' })).toHaveLength(0)
    await act(async () => buttonNamed('高级筛选').props.onClick())
    const moduleFilter = renderer.root.findByProps({ 'aria-label': '业务模块' })
    await act(async () => moduleFilter.props.onChange({ target: { value: '模块A' } }))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(renderer.root.findAllByProps({ className: 'operational-filter-count' })).toHaveLength(1)
    expect(renderText(renderer.root.findByProps({ className: 'operational-filter-count' }))).toBe('1')
    expect(fetchJson.mock.calls.some(([url]) => String(url).includes('business_module='))).toBe(true)

    await act(async () => buttonNamed('重置').props.onClick())
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    const latestIrRequest = fetchJson.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/api/data/ir?')).at(-1)
    expect(latestIrRequest).not.toContain('business_module=')
    expect(renderer.root.findAllByProps({ className: 'operational-filter-count' })).toHaveLength(0)
    renderer.unmount()
  })

  test('empty collector batch results do not reserve a page section', async () => {
    const renderer = await render('ir', undefined, undefined, (url) => url === '/api/data/ir/imports?source_kind=collector&status=pending' ? [] : responseFor(url))
    expect(renderer.root.findAllByProps({ className: 'operational-compact-section' })).toHaveLength(0)
    expect(renderText(renderer.toJSON())).not.toContain('待确认采集批次')
    renderer.unmount()
  })

  test('IR import renders the upload, preview steps, and confirmation drawer', async () => {
    const renderer = await render('ir')
    const upload = renderer.root.findByProps({ 'data-upload': true })
    await act(async () => { await upload.props['data-before-upload']({ name: 'ir.csv', type: 'text/csv', arrayBuffer: async () => new ArrayBuffer(0) }) })
    expect(renderer.root.findByProps({ 'data-drawer': true }).props['aria-label']).toContain('导入预览')
    expect(renderText(renderer.root.findByProps({ 'data-drawer': true }))).toContain('CSV / Excel 导入')
    expect(renderText(renderer.root.findByProps({ 'data-drawer': true }))).toContain('临时数据尚未进入正式 IR')
    expect(renderer.root.findAllByType('li').map((item) => item.children[0])).toEqual(['上传', '预览与校验', '整批确认'])
    const confirmButton = renderer.root.findAllByType('button').find((button) => button.children.includes('确认写入正式数据'))
    await act(async () => { confirmButton.props.onClick() })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(fetchJson.mock.calls.some(([url]) => String(url).includes('/imports/300/confirm'))).toBe(true)
    renderer.unmount()
  })

  test('invalid file import shows row errors and blocks whole-batch confirmation', async () => {
    const invalidBatch = {
      id: 302,
      domain: 'ir',
      source_kind: 'import',
      status: 'pending',
      team_id: null,
      filename: 'invalid.csv',
      total_rows: 1,
      valid_rows: 0,
      invalid_rows: 1,
      created_at: '2026-09-23T10:00:00',
      rows: [{ row_number: 2, source_id: 'IR-BAD', operation: 'insert', diff: {}, errors: ['需求编号缺失'], warnings: [] }],
    }
    const renderer = await render('ir', undefined, undefined, (url) => String(url).includes('/imports/preview') ? invalidBatch : responseFor(String(url)))
    const upload = renderer.root.findByProps({ 'data-upload': true })
    await act(async () => { await upload.props['data-before-upload']({ name: 'invalid.csv', type: 'text/csv', arrayBuffer: async () => new ArrayBuffer(0) }) })
    expect(renderText(renderer.toJSON())).toContain('需求编号缺失')
    const confirmButton = renderer.root.findAllByType('button').find((button) => button.children.includes('存在错误，不能确认'))
    expect(confirmButton.props.disabled).toBe(true)
    renderer.unmount()
  })

  test('collector batches open in the shared preview and invalid rows block confirmation', async () => {
    const renderer = await render('ir')
    expect(renderText(renderer.toJSON())).toContain('待确认采集批次')
    fetchJson.mockImplementation(async (url) => url === '/api/data/ir/imports/301'
      ? { ...collectorBatchDetails, valid_rows: 0, invalid_rows: 1, rows: [{ ...collectorBatchDetails.rows[0], status: 'invalid', errors: ['迭代名称缺失或不属于该版本'], warnings: ['责任人待匹配'] }] }
      : responseFor(String(url)))
    await act(async () => renderer.root.findAllByType('button').find((button) => button.children.includes('查看批次')).props.onClick())
    expect(renderer.root.findByProps({ 'data-drawer': true }).props['aria-label']).toContain('采集批次预览')
    expect(renderText(renderer.toJSON())).toContain('平台采集')
    expect(renderText(renderer.toJSON())).toContain('生成时间')
    expect(renderText(renderer.toJSON())).toContain('2026-09-18 01:00:00')
    expect(renderText(renderer.toJSON())).toContain('临时数据')
    expect(renderText(renderer.toJSON())).toContain('警告项 1')
    expect(renderText(renderer.toJSON())).toContain('迭代名称缺失或不属于该版本')
    const confirmButton = renderer.root.findAllByType('button').find((button) => button.children.includes('存在错误，不能确认'))
    expect(confirmButton.props.disabled).toBe(true)
    renderer.unmount()
  })

  test('collector confirmation refreshes formal IR and pending batch lists', async () => {
    const renderer = await render('ir')
    await act(async () => renderer.root.findAllByType('button').find((button) => button.children.includes('查看批次')).props.onClick())
    const confirmButton = renderer.root.findAllByType('button').find((button) => button.children.includes('确认采集批次'))
    await act(async () => confirmButton.props.onClick())
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(fetchJson.mock.calls.some(([url, options]) => url === '/api/data/ir/imports/301/confirm' && options?.method === 'POST')).toBe(true)
    expect(fetchJson.mock.calls.filter(([url]) => url === '/api/data/ir/imports?source_kind=collector&status=pending')).toHaveLength(2)
    renderer.unmount()
  })

  test('team and product pages use master-detail layouts', async () => {
    const teamRenderer = await render('teams')
    expect(teamRenderer.root.findAllByProps({ className: 'settings-master-detail' })).toHaveLength(1)
    expect(renderText(teamRenderer.toJSON())).toContain('团队')
    teamRenderer.unmount()

    const productRenderer = await render('products')
    expect(productRenderer.root.findAllByProps({ className: 'settings-master-detail' })).toHaveLength(1)
    expect(renderText(productRenderer.toJSON())).toContain('产品')
    expect(renderText(productRenderer.toJSON())).toContain('版本与开发迭代期')
    productRenderer.unmount()
  })

  test('master-detail selection uses focusable view buttons without row click coupling', async () => {
    const teamRenderer = await render('teams')
    const teamList = teamRenderer.root.findAllByType(MockTable)[0]
    expect(teamList.props.scroll.x).toBe(296)
    expect(teamList.props.columns.map(({ width }) => width)).toEqual([160, 64, 72])
    expect(teamRenderer.root.findAllByType('button').some((button) => button.props['aria-label'] === '编辑团队 团队A')).toBe(true)
    expect(teamRenderer.root.findAllByType('button').some((button) => button.props['aria-label'] === '编辑团队成员 成员一')).toBe(true)
    const teamView = teamRenderer.root.findAllByType('button').find((button) => button.props['aria-label'] === '查看团队 团队B')
    expect(teamView.type).toBe('button')
    const teamStopPropagation = vi.fn()
    await act(async () => { teamView.props.onClick({ stopPropagation: teamStopPropagation }) })
    expect(teamStopPropagation).not.toHaveBeenCalled()
    expect(renderText(teamRenderer.toJSON())).toContain('团队B · 团队详情')
    teamRenderer.unmount()

    const productRenderer = await render('products')
    const productList = productRenderer.root.findAllByType(MockTable)[0]
    expect(productList.props.scroll.x).toBe(288)
    expect(productList.props.columns.map(({ width }) => width)).toEqual([160, 56, 72])
    const productView = productRenderer.root.findAllByType('button').find((button) => button.props['aria-label'] === '查看产品 产品B')
    expect(productView.type).toBe('button')
    const productStopPropagation = vi.fn()
    await act(async () => { productView.props.onClick({ stopPropagation: productStopPropagation }) })
    expect(productStopPropagation).not.toHaveBeenCalled()
    expect(renderText(productRenderer.toJSON())).toContain('产品B · 层级详情')
    const productEdit = productRenderer.root.findAllByType('button').find((button) => button.props['aria-label'] === '编辑产品 产品B')
    await act(async () => { productEdit.props.onClick({ stopPropagation: vi.fn() }) })
    expect(productRenderer.root.findByProps({ 'data-drawer': true }).props['aria-label']).toBe('编辑产品')
    expect(renderText(productRenderer.toJSON())).toContain('产品B · 层级详情')
    expect(productRenderer.root.findByProps({ 'aria-label': '编辑版本 版本B' })).toBeDefined()
    productRenderer.unmount()
  })

  test('team selection stays on its detail after a mutation refresh', async () => {
    const renderer = await render('teams')
    const teamView = renderer.root.findAllByType('button').find((button) => button.props['aria-label'] === '查看团队 团队B')
    await act(async () => teamView.props.onClick())
    const addMember = renderer.root.findAllByType('button').find((button) => button.children.includes('新增成员'))
    await act(async () => addMember.props.onClick())
    const form = renderer.root.findAll((node) => Boolean(node.props['data-form-submit'])).at(-1)
    await act(async () => form.props['data-form-submit']({ team_id: '2', employee_id: 'B003', name: '成员三', role: '研发工程师' }))
    expect(renderText(renderer.toJSON())).toContain('团队B · 团队详情')
    expect(fetchJson.mock.calls.some(([url, options]) => url === '/api/team-members' && options?.method === 'POST')).toBe(true)
    renderer.unmount()
  })

  test('product selection stays on its detail after a mutation refresh', async () => {
    const renderer = await render('products')
    const productView = renderer.root.findAllByType('button').find((button) => button.props['aria-label'] === '查看产品 产品B')
    await act(async () => productView.props.onClick())
    const editProduct = renderer.root.findByProps({ 'aria-label': '编辑产品 产品B' })
    await act(async () => editProduct.props.onClick())
    const form = renderer.root.findAll((node) => Boolean(node.props['data-form-submit'])).at(-1)
    await act(async () => form.props['data-form-submit']({ team_id: '2', name: '产品B已编辑' }))
    expect(renderText(renderer.toJSON())).toContain('产品B · 层级详情')
    expect(fetchJson.mock.calls.some(([url, options]) => url === '/api/products/11' && options?.method === 'PATCH')).toBe(true)
    renderer.unmount()
  })

  test('admin can confirm team deletion and refreshes the references', async () => {
    const renderer = await render('teams')
    const confirmation = renderer.root.findAllByProps({ 'data-popconfirm': true }).find((node) => node.findAllByProps({ 'aria-label': '删除团队 团队A' }).length > 0)
    expect(confirmation).toBeDefined()
    const popconfirm = renderer.root.findAllByType(MockPopconfirm).find((node) => node.findAllByProps({ 'aria-label': '删除团队 团队A' }).length > 0)
    expect(popconfirm.props.okText).toBe('删除')
    expect(popconfirm.props.cancelText).toBe('取消')
    expect(popconfirm.props.description).toContain('有关联数据')

    await act(async () => { await confirmation.props['data-on-confirm']() })

    const deleteCall = fetchJson.mock.calls.find(([url, options]) => url === '/api/teams/1' && options?.method === 'DELETE')
    expect(deleteCall).toBeDefined()
    expect(renderText(renderer.toJSON())).toContain('团队已删除。')
    expect(fetchJson.mock.calls.filter(([url]) => ['/api/teams', '/api/products', '/api/versions', '/api/team-members'].includes(url)).length).toBeGreaterThan(4)
    renderer.unmount()
  })

  test('admin explains team deletion constraints in Chinese', async () => {
    const renderer = await render('teams')
    fetchJson.mockImplementation(async (url, options) => {
      if (url === '/api/teams/1' && options?.method === 'DELETE') {
        const error = new Error('team is referenced by facts or maintainers')
        error.status = 409
        throw error
      }
      return responseFor(String(url))
    })
    const confirmation = renderer.root.findAllByProps({ 'data-popconfirm': true }).find((node) => node.findAllByProps({ 'aria-label': '删除团队 团队A' }).length > 0)

    await act(async () => { await confirmation.props['data-on-confirm']() })

    expect(renderText(renderer.toJSON())).toContain('该团队仍有事实或维护者关联，无法删除。')
    renderer.unmount()
  })

  test('admin can edit and delete an existing iteration through its drawer and confirmation', async () => {
    const renderer = await render('products')
    const editButton = renderer.root.findByProps({ 'aria-label': '编辑迭代 迭代一' })
    await act(async () => { editButton.props.onClick() })
    expect(renderer.root.findByProps({ 'data-drawer': true }).props['aria-label']).toBe('编辑开发迭代期')

    const form = renderer.root.findAll((node) => Boolean(node.props['data-form-submit'])).at(-1)
    await act(async () => {
      await form.props['data-form-submit']({ version_id: '20', name: '迭代一（已编辑）', start_date: '2026-08-01', end_date: '2026-09-01' })
    })
    const patchCall = fetchJson.mock.calls.find(([url, options]) => url === '/api/iterations/30' && options?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    expect(JSON.parse(patchCall[1].body)).toEqual({ version_id: 20, name: '迭代一（已编辑）', start_date: '2026-08-01', end_date: '2026-09-01' })

    const deleteConfirmation = renderer.root.findAllByProps({ 'data-popconfirm': true }).find((node) => node.findAllByProps({ 'aria-label': '删除迭代 迭代一' }).length > 0)
    expect(deleteConfirmation).toBeDefined()
    await act(async () => { await deleteConfirmation.props['data-on-confirm']() })
    expect(fetchJson.mock.calls.some(([url, options]) => url === '/api/iterations/30' && options?.method === 'DELETE')).toBe(true)
    renderer.unmount()
  })

  test('viewer can read IR but does not receive write controls', async () => {
    const renderer = await render('ir', { id: 2, username: 'viewer', role: 'viewer' })
    expect(renderText(renderer.toJSON())).toContain('只读')
    expect(renderer.root.findAllByProps({ 'data-upload': true })).toHaveLength(0)
    expect(renderer.root.findAllByType('button').some((button) => button.children.includes('新增 IR'))).toBe(false)
    expect(renderer.root.findAllByType('button').some((button) => button.children.includes('编辑'))).toBe(false)
    renderer.unmount()
  })

  test('maintainer keeps IR edit controls within the bound team filter', async () => {
    const renderer = await render('ir', { id: 2, username: 'maintainer.团队A', role: 'maintainer', maintainer_team_id: 1 })
    const teamFilter = renderer.root.findAllByType('select')[0]
    expect(teamFilter.props.disabled).toBe(true)
    expect(teamFilter.props.value).toBe('1')
    expect(renderText(renderer.toJSON())).toContain('按账号绑定团队筛选')
    expect(renderer.root.findAllByProps({ 'data-upload': true })).toHaveLength(1)
    expect(renderer.root.findAllByType('button').some((button) => button.children.includes('新增 IR'))).toBe(true)
    renderer.unmount()
  })

  test('team and product changes clear downstream selections and limit version candidates', async () => {
    const renderer = await render('ir')
    const selects = () => renderer.root.findAllByType('select')
    const optionLabels = (select) => select.findAllByType('option').map((option) => renderText(option))

    await act(async () => { selects()[0].props.onChange({ target: { value: '1' } }) })
    expect(optionLabels(selects()[2])).toEqual(['版本A'])
    await act(async () => { selects()[1].props.onChange({ target: { value: '10' } }) })
    await act(async () => { selects()[2].props.onChange({ target: { value: '20' } }) })
    await act(async () => { selects()[3].props.onChange({ target: { value: '30' } }) })
    expect(selects()[1].props.value).toBe('10')
    expect(selects()[2].props.value).toBe('20')
    expect(selects()[3].props.value).toBe('30')

    await act(async () => { selects()[0].props.onChange({ target: { value: '2' } }) })
    expect(selects()[1].props.value).toBe('')
    expect(selects()[2].props.value).toBe('')
    expect(selects()[3].props.value).toBe('')
    expect(optionLabels(selects()[2])).toEqual(['版本B'])
    renderer.unmount()
  })

  test('metric settings separate dashboard catalog and source metric rules with Tabs', async () => {
    const renderer = await render('metrics')
    expect(renderer.root.findAllByProps({ 'data-tabs': true })).toHaveLength(1)
    expect(renderer.root.findAllByType('h3').map((heading) => heading.children[0])).toContain('看板指标目录')
    expect(renderer.root.findAllByType('h3').map((heading) => heading.children[0])).toContain('源数据指标规则 / 结果查询')
    expect(renderer.root.findAllByProps({ className: 'settings-master-detail' })).toHaveLength(1)
    expect(renderer.root.findAllByProps({ className: 'settings-master-detail settings-master-detail--rules' })).toHaveLength(1)
    expect(renderText(renderer.toJSON())).toContain('SA设计')
    renderer.unmount()
  })

  test('metric result uses the shared percentage formatter', async () => {
    const renderer = await render('metrics')
    const computeButton = renderer.root.findAllByType('button').find((button) => button.children.includes('计算当前结果'))
    await act(async () => { await computeButton.props.onClick() })
    expect(renderText(renderer.toJSON())).toContain('50%')
    renderer.unmount()
  })
})

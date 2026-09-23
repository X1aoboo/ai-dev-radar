import React from 'react'
import { act, create } from 'react-test-renderer'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const { fetchJson } = vi.hoisted(() => ({ fetchJson: vi.fn() }))
vi.mock('../api', () => ({ fetchJson }))

function MockForm({ children, onFinish }) { return <form noValidate onSubmit={(event) => { event.preventDefault(); onFinish?.({}) }}>{children}</form> }
function mockUseForm() { return [{ setFieldsValue: vi.fn(), submit: vi.fn() }] }
function MockFormItem({ children, label }) { return typeof children === 'function' ? children({ getFieldValue: () => 'viewer' }) : <label>{label}{children}</label> }
function MockInput(props) { return <input {...props} /> }
function MockInputPassword(props) { return <input type="password" {...props} /> }
function MockSelect({ options = [], value, onChange, ...props }) { return <select {...props} value={value ?? ''} onChange={(event) => onChange?.(event.target.value)}>{options.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select> }
function MockDrawer({ open, title, children, footer }) { return open ? <div role="dialog" aria-label={title}><h2>{title}</h2>{children}{footer}</div> : null }
function MockButton({ children, onClick, htmlType, ...props }) { return <button type={htmlType ?? 'button'} onClick={onClick} {...props}>{children}</button> }
function MockSwitch({ checked, onChange, ...props }) { return <button type="button" role="switch" aria-checked={checked} onClick={() => onChange?.(!checked)} {...props} /> }
function MockCard({ title, extra, children }) { return <section><header>{title}{extra}</header>{children}</section> }
function MockSpace({ children }) { return <div>{children}</div> }
function MockAlert({ message }) { return <div role="alert">{message}</div> }
function MockTable({ columns = [], dataSource = [], rowKey = 'id', locale }) { return <table><tbody>{dataSource.length ? dataSource.map((record) => <tr key={record[rowKey]}>{columns.map((column) => <td key={column.key ?? column.dataIndex ?? column.title}>{column.render ? column.render(record[column.dataIndex], record) : record[column.dataIndex]}</td>)}</tr>) : <tr><td>{locale?.emptyText}</td></tr>}</tbody></table> }
function MockTag({ children }) { return <span>{children}</span> }
function MockPopconfirm({ children }) { return <span data-popconfirm>{children}</span> }
function MockSpin() { return <span>加载中</span> }
function MockEmpty({ description }) { return <span>{description}</span> }
function MockTypography({ children }) { return <span>{children}</span> }
function MockTypographyText({ children }) { return <span>{children}</span> }
function MockTypographyTitle({ children, level = 2 }) { return React.createElement(`h${level}`, null, children) }

vi.mock('antd', () => ({ Alert: MockAlert, Button: MockButton, Card: MockCard, Drawer: MockDrawer, Empty: Object.assign(MockEmpty, { PRESENTED_IMAGE_SIMPLE: 'simple' }), Form: Object.assign(MockForm, { useForm: mockUseForm, Item: MockFormItem }), Input: Object.assign(MockInput, { Password: MockInputPassword }), Popconfirm: MockPopconfirm, Select: MockSelect, Space: MockSpace, Spin: MockSpin, Switch: MockSwitch, Table: MockTable, Tag: MockTag, Typography: Object.assign(MockTypography, { Text: MockTypographyText, Title: MockTypographyTitle }) }))
vi.mock('@ant-design/icons', () => {
  const Icon = () => null
  return { DeleteOutlined: Icon, EditOutlined: Icon, PlusOutlined: Icon }
})

import UsersSettingsPage from './UsersSettingsPage.jsx'
import CollectionsSettingsPage from './CollectionsSettingsPage.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function renderText(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(renderText).join('')
  return renderText(node.children)
}

beforeEach(() => {
  fetchJson.mockImplementation(async (url) => {
    if (String(url).startsWith('/api/teams')) return [{ id: 1, name: '团队A' }]
    if (String(url).startsWith('/api/auth/users')) return [{ id: 1, username: 'admin', role: 'admin', maintainer_team_id: null }, { id: 2, username: 'maintainer.团队A', role: 'maintainer', maintainer_team_id: 1 }, { id: 3, username: 'viewer', role: 'viewer', maintainer_team_id: null }]
    return {}
  })
})

afterEach(() => { fetchJson.mockReset() })

test('renders localized role labels in the user table and opens a Drawer for new users', async () => {
  let renderer
  await act(async () => { renderer = create(<UsersSettingsPage user={{ id: 1, role: 'admin' }} onSessionExpired={() => undefined} />) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  const rendered = renderText(renderer.toJSON())
  expect(rendered).toContain('管理员 · admin')
  expect(rendered).toContain('维护者 · maintainer')
  expect(rendered).toContain('当前账号')
  expect(renderer.root.findAllByType('button').some((button) => button.props['aria-label'] === '编辑账号 admin 角色')).toBe(true)
  expect(renderer.root.findAllByType('button').some((button) => button.props['aria-label'] === '删除账号 admin')).toBe(false)
  expect(renderer.root.findAllByType('button').some((button) => button.props['aria-label'] === '删除账号 maintainer.团队A')).toBe(true)
  const deleteConfirm = renderer.root.findAllByType(MockPopconfirm).find((node) => node.props.title?.includes('maintainer.团队A'))
  expect(deleteConfirm.props.okText).toBe('删除')
  expect(deleteConfirm.props.cancelText).toBe('取消')
  expect(renderer.root.findAllByType(MockCard)).toHaveLength(0)

  const newUserButton = renderer.root.findAllByType('button').find((button) => button.children.includes('新增账号'))
  await act(async () => { newUserButton.props.onClick() })
  expect(renderer.root.findByProps({ role: 'dialog' }).props['aria-label']).toBe('新增用户')
  expect(renderer.root.findAllByProps({ 'data-popconfirm': true })).toHaveLength(2)
  renderer.unmount()
})

test('admin can save a weekly IR schedule and manually trigger an explicit Shanghai window', async () => {
  let schedule = { domain: 'ir', enabled: false, cadence: 'daily', minute: 0, hour: 2, day_of_week: null, day_of_month: null, timezone: 'Asia/Shanghai', updated_by: 'admin', updated_at: '2026-09-18T00:00:00' }
  let runCompleted = false
  const runResult = { id: 9, domain: 'ir', trigger_type: 'manual', status: 'failed', started_by: 'admin', window_start_at: '2026-09-17T00:00:00+08:00', window_end_at: '2026-09-18T00:00:00+08:00', error_code: 'gateway_auth_failed', message: 'Gateway 认证失败，请检查当前配置。', retryable: false, team_results: [{ team_id: 1, team_name: '团队A', status: 'failed', code: 'gateway_not_configured', message: 'Collector Gateway is not configured.', retryable: false }], started_at: '2026-09-18T00:00:00', completed_at: '2026-09-18T00:00:01' }
  fetchJson.mockImplementation(async (url, options) => {
    if (url === '/api/gateway') return { active: null, draft: null }
    if (url === '/api/gateway/audits?limit=50') return []
    if (url === '/api/collection-schedules/ir' && options?.method === 'PUT') {
      schedule = { ...schedule, ...JSON.parse(options.body), updated_by: 'admin' }
      return schedule
    }
    if (url === '/api/collection-schedules/ir/run') {
      runCompleted = true
      return runResult
    }
    return { schedules: [schedule], recent_runs: runCompleted ? [runResult] : [] }
  })
  let renderer
  await act(async () => { renderer = create(<MemoryRouter><CollectionsSettingsPage onSessionExpired={() => undefined} /></MemoryRouter>) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

  await act(async () => renderer.root.findByProps({ 'aria-label': '采集周期' }).props.onChange({ target: { value: 'weekly' } }))
  await act(async () => renderer.root.findByProps({ 'aria-label': '星期' }).props.onChange({ target: { value: '2' } }))
  const scheduleForm = renderer.root.findByProps({ 'aria-label': 'IR 定时计划' })
  await act(async () => scheduleForm.props.onSubmit({ preventDefault: vi.fn() }))
  const saveCall = fetchJson.mock.calls.find(([url, options]) => url === '/api/collection-schedules/ir' && options?.method === 'PUT')
  expect(JSON.parse(saveCall[1].body)).toMatchObject({ cadence: 'weekly', day_of_week: 2 })
  expect(JSON.parse(saveCall[1].body)).not.toHaveProperty('timezone')
  expect(renderText(renderer.toJSON())).toContain('已保存并立即生效')

  const runForm = renderer.root.findByProps({ 'aria-label': '手动触发 IR 采集' })
  expect(renderer.root.findByType('details').props.open).toBeUndefined()
  await act(async () => runForm.props.onSubmit({ preventDefault: vi.fn() }))
  const runCalls = fetchJson.mock.calls.filter(([url, options]) => url === '/api/collection-schedules/ir/run' && options?.method === 'POST')
  expect(JSON.parse(runCalls[0][1].body)).toEqual({})

  await act(async () => renderer.root.findByProps({ 'aria-label': '开始时间' }).props.onChange({ target: { value: '2026-09-17T01:30' } }))
  await act(async () => renderer.root.findByProps({ 'aria-label': '结束时间' }).props.onChange({ target: { value: '2026-09-17T02:30' } }))
  await act(async () => runForm.props.onSubmit({ preventDefault: vi.fn() }))
  const updatedRunCalls = fetchJson.mock.calls.filter(([url, options]) => url === '/api/collection-schedules/ir/run' && options?.method === 'POST')
  expect(JSON.parse(updatedRunCalls[1][1].body)).toEqual({ start_at: '2026-09-17T01:30:00+08:00', end_at: '2026-09-17T02:30:00+08:00' })
  expect(renderText(renderer.toJSON())).toContain('运行历史')
  expect(renderText(renderer.toJSON())).toContain('Gateway 认证失败，请检查当前配置。')
  const historyTable = renderer.root.findAllByType(MockTable).find((table) => Boolean(table.props.expandable))
  expect(historyTable.props.expandable.rowExpandable(runResult)).toBe(true)
  let detailsRenderer
  await act(async () => { detailsRenderer = create(historyTable.props.expandable.expandedRowRender(runResult)) })
  expect(renderText(detailsRenderer.toJSON())).toContain('gateway_not_configured')
  expect(renderText(detailsRenderer.toJSON())).toContain('失败')
  detailsRenderer.unmount()
  expect(fetchJson.mock.calls.some(([url]) => String(url).includes('GATEWAY_TOKEN') || String(url).includes('GATEWAY_URL'))).toBe(false)
  renderer.unmount()
})

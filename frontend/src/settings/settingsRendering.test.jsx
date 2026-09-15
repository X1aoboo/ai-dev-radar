import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const { fetchJson } = vi.hoisted(() => ({ fetchJson: vi.fn() }))
vi.mock('../api', () => ({ fetchJson }))

function MockForm({ children, onFinish }) { return <form onSubmit={(event) => { event.preventDefault(); onFinish?.({}) }}>{children}</form> }
function mockUseForm() { return [{ setFieldsValue: vi.fn(), submit: vi.fn() }] }
function MockFormItem({ children, label }) { return typeof children === 'function' ? children({ getFieldValue: () => 'viewer' }) : <label>{label}{children}</label> }
function MockInput(props) { return <input {...props} /> }
function MockInputPassword(props) { return <input type="password" {...props} /> }
function MockSelect({ options = [], value, onChange, ...props }) { return <select {...props} value={value ?? ''} onChange={(event) => onChange?.(event.target.value)}>{options.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select> }
function MockDrawer({ open, title, children, footer }) { return open ? <div role="dialog" aria-label={title}><h2>{title}</h2>{children}{footer}</div> : null }
function MockButton({ children, onClick, htmlType, ...props }) { return <button type={htmlType ?? 'button'} onClick={onClick} {...props}>{children}</button> }
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

vi.mock('antd', () => ({ Alert: MockAlert, Button: MockButton, Card: MockCard, Drawer: MockDrawer, Empty: Object.assign(MockEmpty, { PRESENTED_IMAGE_SIMPLE: 'simple' }), Form: Object.assign(MockForm, { useForm: mockUseForm, Item: MockFormItem }), Input: Object.assign(MockInput, { Password: MockInputPassword }), Popconfirm: MockPopconfirm, Select: MockSelect, Space: MockSpace, Spin: MockSpin, Table: MockTable, Tag: MockTag, Typography: Object.assign(MockTypography, { Text: MockTypographyText, Title: MockTypographyTitle }) }))
vi.mock('@ant-design/icons', () => {
  const Icon = () => null
  return { DeleteOutlined: Icon, EditOutlined: Icon, PlusOutlined: Icon }
})

import UsersSettingsPage from './UsersSettingsPage.jsx'

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

  const newUserButton = renderer.root.findAllByType('button').find((button) => button.children.includes('新增账号'))
  await act(async () => { newUserButton.props.onClick() })
  expect(renderer.root.findByProps({ role: 'dialog' }).props['aria-label']).toBe('新增用户')
  expect(renderer.root.findAllByProps({ 'data-popconfirm': true })).toHaveLength(2)
  renderer.unmount()
})

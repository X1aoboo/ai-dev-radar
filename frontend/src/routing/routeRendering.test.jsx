import React from 'react'
import { ConfigProvider } from 'antd'
import { act, create } from 'react-test-renderer'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import App, { ApplicationRoutes } from '../App.jsx'
import { getRouteMeta } from './routeMetadata.js'

function MockForm({ children }) { return <form noValidate>{children}</form> }
MockForm.useForm = () => [{ setFieldsValue: () => undefined, submit: () => undefined }]
MockForm.Item = ({ children, label }) => <label>{label}{children}</label>
function MockInput(props) { return <input {...props} /> }
MockInput.Password = (props) => <input type="password" {...props} />
function MockTable({ columns = [], dataSource = [], rowKey = 'id', locale }) {
  return <table><tbody>{dataSource.length ? dataSource.map((record) => <tr key={record[rowKey]}>{columns.map((column) => <td key={column.key ?? column.dataIndex ?? column.title}>{column.render ? column.render(record[column.dataIndex], record) : record[column.dataIndex]}</td>)}</tr>) : <tr><td>{locale?.emptyText}</td></tr>}</tbody></table>
}
const MockText = ({ children }) => <span>{children}</span>
function MockTypography({ children }) { return <span>{children}</span> }
MockTypography.Text = MockText

// Route behavior is rendered with the real router and real application route tree.
// Ant Design's CSS-in-JS adapter requires a browser document, which this node-only
// renderer deliberately does not provide, so only the shell primitives are mocked.
vi.mock('antd', () => ({
  Alert: ({ message }) => <div role="alert">{message}</div>,
  App: ({ children }) => <>{children}</>,
  Breadcrumb: ({ items = [] }) => <nav>{items.map((item) => <span key={item.title}>{item.title}</span>)}</nav>,
  Button: ({ children, onClick, ...props }) => <button type="button" onClick={onClick} {...props}>{children}</button>,
  Drawer: ({ children, open, onClose }) => open ? <div data-drawer><button data-close-drawer onClick={onClose}>关闭</button>{children}</div> : null,
  Modal: ({ children, open, title }) => open ? <div role="dialog" aria-label={title} data-modal>{children}</div> : null,
  Empty: ({ description }) => <span>{description}</span>,
  Form: MockForm,
  Input: Object.assign(MockInput, { Password: MockInput.Password }),
  Popconfirm: ({ children }) => <span>{children}</span>,
  Select: ({ options = [], ...props }) => <select {...props}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>,
  Space: ({ children }) => <span>{children}</span>,
  Table: MockTable,
  Typography: MockTypography,
  Tooltip: ({ children }) => <>{children}</>,
  ConfigProvider: ({ children }) => <>{children}</>,
  Result: ({ title, subTitle, extra }) => <section><h1>{title}</h1><p>{subTitle}</p>{extra}</section>,
  Spin: () => <span>加载中</span>,
  Tag: ({ children }) => <span>{children}</span>,
}))

vi.mock('@ant-design/icons', () => {
  const Icon = () => <span aria-hidden="true" />
  const MenuFoldOutlined = () => <span aria-hidden="true" />
  const MenuOutlined = () => <span aria-hidden="true" />
  MenuFoldOutlined.displayName = 'MenuFoldOutlined'
  MenuOutlined.displayName = 'MenuOutlined'
  return {
    ApiOutlined: Icon,
    AppstoreOutlined: Icon,
    BarChartOutlined: Icon,
    BellOutlined: Icon,
    BugOutlined: Icon,
    CodeOutlined: Icon,
    DeleteOutlined: Icon,
    DatabaseOutlined: Icon,
    EditOutlined: Icon,
    FileTextOutlined: Icon,
    PullRequestOutlined: Icon,
    LogoutOutlined: Icon,
    MenuFoldOutlined,
    MenuOutlined,
    PlusOutlined: Icon,
    QuestionCircleOutlined: Icon,
    SearchOutlined: Icon,
    TeamOutlined: Icon,
    UserOutlined: Icon,
  }
})
globalThis.IS_REACT_ACT_ENVIRONMENT = true

function StubPage({ page, children = page }) {
  return <div data-page={page}>{children}</div>
}

const routeComponents = {
  OverviewPage: ({ filter, onFilterChange }) => (
    <>
      <StubPage page="overview">{`研发总览 ${filter.dimension}|${filter.granularity}|${filter.versionId}|${filter.periodId ?? 'latest'}`}</StubPage>
      <button type="button" data-filter-week onClick={() => onFilterChange({ ...filter, granularity: 'week' }, { history: 'push' })}>切换周</button>
      <button type="button" data-filter-cycle onClick={() => onFilterChange({ ...filter, cycle: filter.cycle === 'half' ? '6m' : 'half' }, { history: 'push' })}>切换周期</button>
    </>
  ),
  ActivitiesPage: () => <StubPage page="activities">研发活动</StubPage>,
  CapabilitiesPage: () => <StubPage page="capabilities">研发能力</StubPage>,
  TeamDrilldownPage: () => <StubPage page="team-analytics">团队下钻</StubPage>,
  MetricDetailPage: () => <StubPage page="metric-analytics">指标详情</StubPage>,
  DataManagementPage: ({ section, activity }) => <StubPage page={`data-${section}`}>{activity ? `${section}:${activity}` : section}</StubPage>,
  UsersSettingsPage: () => <StubPage page="settings-users">用户与权限</StubPage>,
  CollectionsSettingsPage: () => <StubPage page="settings-collections">数据采集</StubPage>,
  GatewaySettingsPage: () => <StubPage page="settings-gateway">数据网关</StubPage>,
}

function LocationProbe() {
  const location = useLocation()
  return <span data-current-path={location.pathname} data-current-search={location.search} data-current-hash={location.hash} />
}

function HistoryBack() {
  const navigate = useNavigate()
  return <button type="button" data-history-back onClick={() => navigate(-1)}>返回上一筛选</button>
}

function NavigateOnce({ to }) {
  const navigate = useNavigate()
  const navigated = React.useRef(false)
  React.useEffect(() => {
    if (navigated.current) return
    navigated.current = true
    navigate(to, { replace: true })
  }, [navigate, to])
  return null
}

function renderText(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(renderText).join('')
  return renderText(node.children)
}

async function renderAt(pathname, role = 'admin', components = routeComponents) {
  let renderer
  await act(async () => {
    renderer = create(
      <ConfigProvider>
        <MemoryRouter initialEntries={[pathname]}>
          <ApplicationRoutes
            user={{ id: 1, username: role, role }}
            onLogout={() => undefined}
            onSessionExpired={() => undefined}
            routeComponents={components}
          />
          <LocationProbe />
          <HistoryBack />
        </MemoryRouter>
      </ConfigProvider>,
    )
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return renderer
}

function currentPath(renderer) {
  return renderer.root.find((node) => node.props['data-current-path'] !== undefined).props['data-current-path']
}

function currentSearch(renderer) {
  return renderer.root.find((node) => node.props['data-current-search'] !== undefined).props['data-current-search']
}

function currentHash(renderer) {
  return renderer.root.find((node) => node.props['data-current-hash'] !== undefined).props['data-current-hash']
}

function hasPage(renderer, page) {
  return renderer.root.findAll((node) => node.props['data-page'] === page).length > 0
}

function contentMode(renderer) {
  return renderer.root.find((node) => node.props.id === 'main-content').props.className
}

function hasText(renderer, text) {
  return renderText(renderer.toJSON()).includes(text)
}

test('route metadata treats one or more trailing slashes like the canonical path', () => {
  for (const pathname of ['/analytics/activities', '/analytics/capabilities', '/data/requirements/design', '/data/requirements/development', '/data/maturity', '/data/issues', '/settings/teams', '/settings/products', '/settings/metrics', '/settings/users', '/settings/collections', '/settings/gateway']) {
    expect(getRouteMeta(`${pathname}/`)).toEqual(getRouteMeta(pathname))
  }
  expect(getRouteMeta('/')).toEqual(getRouteMeta('////'))
})

beforeEach(() => {
  globalThis.fetch = async () => new Response('[]', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
})

afterEach(() => {
  delete globalThis.fetch
  delete globalThis.localStorage
  delete globalThis.matchMedia
})

test('sidebar toggles reversibly without changing navigation contracts or fetching data', async () => {
  globalThis.fetch = vi.fn(globalThis.fetch)
  const renderer = await renderAt('/data/requirements/design', 'viewer')
  const links = () => renderer.root.findAllByType('a').filter(node => node.props.className?.split(' ').includes('app-nav__link'))
  const before = links().map(node => [node.props.href, node.props['aria-label']])
  const requests = globalThis.fetch.mock.calls.length
  const toggle = () => renderer.root.findAllByType('button').find(node => node.props['aria-controls'] === 'app-navigation')
  expect(toggle().props['aria-expanded']).toBe(true)
  expect(toggle().props['aria-label']).toBe('折叠导航')
  expect(toggle().props.icon.type.displayName).toBe('MenuFoldOutlined')
  expect(renderer.root.findByProps({ className: 'app-sidebar__header' }).findAllByType('button')).toHaveLength(1)
  await act(async () => toggle().props.onClick())
  expect(toggle().props['aria-expanded']).toBe(false)
  expect(toggle().props['aria-label']).toBe('展开导航')
  expect(toggle().props.icon.type.displayName).toBe('MenuOutlined')
  expect(links().map(node => [node.props.href, node.props['aria-label']])).toEqual(before)
  expect(links().some(node => node.props['aria-current'] === 'page')).toBe(true)
  expect(links().some(node => node.props.href === '/settings/users')).toBe(false)
  expect(links().some(node => node.props.href === '/settings/collections')).toBe(false)
  expect(links().some(node => node.props.href === '/settings/gateway')).toBe(false)
  expect(links().filter(node => ['需求', '问题单', 'MR', '代码检视'].includes(node.props['aria-label']))).toHaveLength(4)
  expect(globalThis.fetch.mock.calls.length).toBe(requests)
  await act(async () => toggle().props.onClick())
  expect(toggle().props['aria-expanded']).toBe(true)
  expect(toggle().props.icon.type.displayName).toBe('MenuFoldOutlined')
  expect(globalThis.fetch.mock.calls.length).toBe(requests)
  await act(async () => renderer.unmount())
})

test('narrow navigation opens a drawer and closes on navigation or breakpoint change', async () => {
  let listener
  const media = { matches: true, addEventListener: (_, fn) => { listener = fn }, removeEventListener: vi.fn() }
  globalThis.matchMedia = () => media
  const renderer = await renderAt('/data/requirements/design')
  const trigger = () => renderer.root.findAllByType('button').find(node => node.props['aria-label'] === '打开导航')
  expect(trigger().props['aria-expanded']).toBe(false)
  await act(async () => trigger().props.onClick())
  expect(trigger().props['aria-expanded']).toBe(true)
  const link = renderer.root.findAllByType('a').find(node => node.props['aria-label'] === '需求')
  await act(async () => link.props.onClick({ button: 0, preventDefault() {} }))
  expect(trigger().props['aria-expanded']).toBe(false)
  await act(async () => trigger().props.onClick())
  await act(async () => { media.matches = false; listener() })
  expect(renderer.root.findAllByType('button').some(node => node.props['aria-label'] === '折叠导航')).toBe(true)
  await act(async () => renderer.unmount())
  expect(media.removeEventListener).toHaveBeenCalled()
})

test('desktop preference persists across mounts and storage failures are harmless', async () => {
  const values = new Map()
  globalThis.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }
  let renderer = await renderAt('/data/requirements/design')
  await act(async () => renderer.root.findAllByType('button').find(node => node.props['aria-label'] === '折叠导航').props.onClick())
  await act(async () => renderer.unmount())
  renderer = await renderAt('/data/requirements/design')
  expect(renderer.root.findAllByType('button').some(node => node.props['aria-label'] === '展开导航')).toBe(true)
  await act(async () => renderer.unmount())
  globalThis.localStorage = { getItem() { throw Error('unavailable') }, setItem() { throw Error('unavailable') } }
  renderer = await renderAt('/data/requirements/design')
  await act(async () => renderer.root.findAllByType('button').find(node => node.props['aria-label'] === '折叠导航').props.onClick())
  expect(renderer.root.findAllByType('button').some(node => node.props['aria-label'] === '展开导航')).toBe(true)
  await act(async () => renderer.unmount())
})

test('Team Drill-down selects Team Details while metric detail remains grouped under Overview', async () => {
  const teamRenderer = await renderAt('/analytics/teams/42')
  const teamLink = teamRenderer.root.findAllByType('a').find(node => node.props['aria-label'] === '团队详情')
  const overviewLink = teamRenderer.root.findAllByType('a').find(node => node.props['aria-label'] === '研发总览')
  expect(teamLink.props['data-section-active']).toBe('true')
  expect(teamLink.props['aria-current']).toBe('page')
  expect(overviewLink.props['data-section-active']).toBeUndefined()
  await act(async () => teamRenderer.unmount())

  const metricRenderer = await renderAt('/analytics/metrics/99')
  const metricOverviewLink = metricRenderer.root.findAllByType('a').find(node => node.props['aria-label'] === '研发总览')
  expect(metricOverviewLink.props['data-section-active']).toBe('true')
  expect(metricOverviewLink.props['aria-current']).toBeUndefined()
  await act(async () => metricRenderer.unmount())
})

test('data sources are direct navigation entries for all roles', async () => {
  for (const role of ['admin', 'maintainer', 'viewer']) {
    const renderer = await renderAt('/data/requirements/design', role)
    const labels = renderer.root.findAllByType('a').map(node => node.props['aria-label'])
    expect(labels).toEqual(expect.arrayContaining(['需求', '问题单', 'MR', '代码检视']))
    await act(async () => renderer.unmount())
  }
})

for (const [role, pathname, page] of [
  ['admin', '/settings/users', 'settings-users'],
  ['admin', '/settings/collections', 'settings-collections'],
  ['admin', '/settings/gateway', 'settings-gateway'],
  ['admin', '/settings/teams', 'data-teams'],
  ['maintainer', '/settings/teams', 'data-teams'],
  ['viewer', '/settings/teams', 'data-teams'],
  ['admin', '/data/requirements/design', 'data-requirements'],
  ['maintainer', '/data/requirements/design', 'data-requirements'],
  ['viewer', '/data/requirements/design', 'data-requirements'],
  ['admin', '/data/requirements/development', 'data-requirements'],
  ['maintainer', '/data/requirements/development', 'data-requirements'],
  ['viewer', '/data/requirements/development', 'data-requirements'],
]) {
  test(`${role} can render ${pathname}`, async () => {
    const renderer = await renderAt(pathname, role)
    expect(hasPage(renderer, page)).toBe(true)
    expect(hasText(renderer, '无权访问')).toBe(false)
    renderer.unmount()
  })
}

for (const [role, pathname] of [
  ['maintainer', '/settings/users'],
  ['viewer', '/settings/users'],
  ['maintainer', '/settings/collections'],
  ['viewer', '/settings/collections'],
  ['maintainer', '/settings/gateway'],
  ['viewer', '/settings/gateway'],
]) {
  test(`${role} receives 403 for ${pathname}`, async () => {
    const renderer = await renderAt(pathname, role)
    expect(hasText(renderer, '无权访问')).toBe(true)
    expect(renderer.root.findAll((node) => node.props.className?.includes('global-status--forbidden'))).toHaveLength(1)
    renderer.unmount()
  })
}

for (const [from, to] of [
  ['/team/42', '/analytics/teams/42'],
  ['/metric/99', '/analytics/metrics/99'],
  ['/data-management', '/data/requirements/design'],
  ['/data-management/ir', '/data/requirements/design'],
  ['/data-management/ar', '/data/requirements/development'],
  ['/data-management/sr', '/data/requirements/design'],
  ['/data-management/dts', '/data/issues'],
  ['/data-management/mr', '/data/mr'],
  ['/data-management/teams', '/settings/teams'],
  ['/data-management/products', '/settings/products'],
  ['/data-management/metrics', '/settings/metrics'],
  ['/manual-entry', '/data/requirements/design'],
  ['/data/requirements', '/data/requirements/design'],
  ['/data/requirements/ir', '/data/requirements/design'],
  ['/data/requirements/ar', '/data/requirements/development'],
  ['/data/requirements/sr', '/data/requirements/design'],
  ['/data/ir', '/data/requirements/design'],
  ['/data/ar', '/data/requirements/development'],
  ['/data/sr', '/data/requirements/design'],
]) {
  test(`redirects ${from} to ${to}`, async () => {
    const renderer = await renderAt(from, 'admin')
    expect(currentPath(renderer)).toBe(to)
    renderer.unmount()
  })
}

test('renders design and development activity routes with activity breadcrumbs', async () => {
  const design = await renderAt('/data/requirements/design', 'admin')
  expect(hasPage(design, 'data-requirements')).toBe(true)
  expect(hasText(design, 'requirements:design')).toBe(true)
  expect(hasText(design, '设计活动')).toBe(true)
  expect(hasText(design, '数据')).toBe(true)
  design.unmount()

  const development = await renderAt('/data/requirements/development', 'admin')
  expect(hasPage(development, 'data-requirements')).toBe(true)
  expect(hasText(development, 'requirements:development')).toBe(true)
  expect(hasText(development, '开发活动')).toBe(true)
  development.unmount()
})

test('route metadata names activity pages and keeps legacy types on activity breadcrumbs', () => {
  expect(getRouteMeta('/data/requirements/design')).toEqual({ title: '设计活动', items: [{ title: '数据' }, { title: '需求' }, { title: '设计活动' }] })
  expect(getRouteMeta('/data/requirements/development')).toEqual({ title: '开发活动', items: [{ title: '数据' }, { title: '需求' }, { title: '开发活动' }] })
  expect(getRouteMeta('/data/requirements')).toEqual({ title: '设计活动', items: [{ title: '数据' }, { title: '需求' }, { title: '设计活动' }] })
  expect(getRouteMeta('/data/requirements/ir')).toEqual(getRouteMeta('/data/requirements/design'))
  expect(getRouteMeta('/data/requirements/ar')).toEqual(getRouteMeta('/data/requirements/development'))
  expect(getRouteMeta('/data/requirements/sr')).toEqual(getRouteMeta('/data/requirements/design'))
})

test('redirects the completed /config migration to split settings', async () => {
  const renderer = await renderAt('/config', 'admin')
  expect(currentPath(renderer)).toBe('/settings/teams')
  expect(hasPage(renderer, 'data-teams')).toBe(true)
  renderer.unmount()
})

test('returns 403 for non-admin access to the migrated /config entry', async () => {
  const renderer = await renderAt('/config', 'maintainer')
  expect(hasText(renderer, '无权访问')).toBe(true)
  renderer.unmount()
})

test('only supported pending domains render the pending state', async () => {
  const pending = await renderAt('/data/issues', 'admin')
  expect(hasText(pending, '问题单数据')).toBe(true)
  expect(hasText(pending, '待定义')).toBe(true)
  expect(pending.root.findAll((node) => node.props.className?.includes('global-status--pending'))).toHaveLength(1)
  expect(hasText(pending, '问题单数据源规格待定义')).toBe(false)
  pending.unmount()

  const unknownDomain = await renderAt('/data/foo', 'admin')
  expect(hasText(unknownDomain, '页面未找到')).toBe(true)
  unknownDomain.unmount()
})

test('unknown requirement activities fall back to the design activity', async () => {
  const renderer = await renderAt('/data/requirements/custom', 'admin')
  expect(currentPath(renderer)).toBe('/data/requirements/design')
  expect(hasPage(renderer, 'data-requirements')).toBe(true)
  renderer.unmount()
})

test('unknown paths render the unified 404 state', async () => {
  const renderer = await renderAt('/not-a-real-page', 'admin')
  expect(hasText(renderer, '页面未找到')).toBe(true)
  expect(renderer.root.findAll((node) => node.props.className?.includes('global-status--not-found'))).toHaveLength(1)
  renderer.unmount()
})

test('login validation and authentication failures are app-owned and associated with both fields', async () => {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ detail: 'Unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  }))
  let renderer
  await act(async () => { renderer = create(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

  const form = renderer.root.findByProps({ className: 'auth-card' })
  const username = renderer.root.findByProps({ autoComplete: 'username' })
  const password = renderer.root.findByProps({ autoComplete: 'current-password' })
  await act(async () => form.props.onSubmit({ preventDefault: vi.fn() }))
  expect(renderer.root.findByProps({ id: 'login-error' }).props.children).toBe('请输入账号和密码。')
  expect(username.props['aria-invalid']).toBe(true)
  expect(password.props['aria-describedby']).toBe('login-error')
  expect(globalThis.fetch.mock.calls.some(([url]) => url === '/api/auth/login')).toBe(false)

  await act(async () => username.props.onChange({ target: { value: 'admin' } }))
  await act(async () => password.props.onChange({ target: { value: 'example-password' } }))
  await act(async () => form.props.onSubmit({ preventDefault: vi.fn() }))
  expect(renderer.root.findByProps({ id: 'login-error' }).props.children).toBe('账号或密码错误。')
  expect(renderer.root.findByProps({ autoComplete: 'username' }).props.value).toBe('admin')
  expect(password.props.value).toBe('')
  expect(globalThis.fetch.mock.calls.some(([url]) => url === '/api/auth/login')).toBe(true)
  await act(async () => renderer.unmount())
})

test('keeps the shell visible during lazy route loading', async () => {
  let resolvePage
  const DelayedUsersPage = React.lazy(() => new Promise((resolve) => { resolvePage = resolve }))
  let renderer
  await act(async () => {
    renderer = create(
      <ConfigProvider>
        <MemoryRouter initialEntries={['/settings/users']}>
          <ApplicationRoutes
            user={{ id: 1, username: 'admin', role: 'admin' }}
            onLogout={() => undefined}
            onSessionExpired={() => undefined}
            routeComponents={{ ...routeComponents, UsersSettingsPage: DelayedUsersPage }}
          />
        </MemoryRouter>
      </ConfigProvider>,
    )
  })
  expect(renderer.root.findByProps({ className: 'app-topbar' })).toBeDefined()
  expect(renderer.root.findByProps({ className: 'content-loading route-loading' })).toBeDefined()
  await act(async () => { resolvePage({ default: () => <StubPage page="settings-users">用户与权限</StubPage> }) })
  expect(hasPage(renderer, 'settings-users')).toBe(true)
  renderer.unmount()
})

test('session expiry explains re-authentication and restores the interrupted route', async () => {
  let userListRequests = 0
  globalThis.fetch = vi.fn(async (input, options) => {
    const url = String(input)
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
    if (url.endsWith('/api/auth/me')) return json({ id: 1, username: 'admin', role: 'admin' })
    if (url.endsWith('/api/teams')) return json([])
    if (url.endsWith('/api/auth/users')) {
      userListRequests += 1
      return userListRequests === 1 ? json({ detail: 'Unauthorized' }, 401) : json([])
    }
    if (url.endsWith('/api/auth/login') && options?.method === 'POST') return json({ id: 1, username: 'admin', role: 'admin' })
    return json([])
  })

  let renderer
  await act(async () => {
    renderer = create(<MemoryRouter initialEntries={['/settings/users?from=expired']}><App /><LocationProbe /></MemoryRouter>)
  })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)) })
  expect(currentPath(renderer)).toBe('/login')
  expect(hasText(renderer, '会话已过期，请重新登录。')).toBe(true)

  const form = renderer.root.findByProps({ className: 'auth-card' })
  await act(async () => renderer.root.findByProps({ autoComplete: 'username' }).props.onChange({ target: { value: 'admin' } }))
  await act(async () => renderer.root.findByProps({ autoComplete: 'current-password' }).props.onChange({ target: { value: 'valid-password' } }))
  await act(async () => form.props.onSubmit({ preventDefault: vi.fn() }))
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)) })
  expect(currentPath(renderer)).toBe('/settings/users')
  expect(currentSearch(renderer)).toBe('?from=expired')
  renderer.unmount()
})

test('hydrates the analysis slice from URL query parameters', async () => {
  const renderer = await renderAt('/?dimension=iteration&granularity=week&version=2&period=p2', 'admin')
  expect(hasText(renderer, 'time|month|all|latest')).toBe(true)
  expect(currentSearch(renderer)).toBe('')
  renderer.unmount()
})

test('splits the legacy category query into the new analysis routes and keeps valid month', async () => {
  const key = await renderAt('/?category=key&month=2026-02&ignored=true', 'admin')
  expect(currentPath(key)).toBe('/analytics/activities')
  expect(currentSearch(key)).toBe('?month=2026-02')
  expect(hasPage(key, 'activities')).toBe(true)
  key.unmount()

  const general = await renderAt('/?category=general&month=bad', 'admin')
  expect(currentPath(general)).toBe('/analytics/capabilities')
  expect(currentSearch(general)).toBe('')
  expect(hasPage(general, 'capabilities')).toBe(true)
  general.unmount()
})

test('exposes independent activity, capability, and maturity data-management routes', async () => {
  const activities = await renderAt('/analytics/activities', 'viewer')
  expect(hasPage(activities, 'activities')).toBe(true)
  activities.unmount()

  const capabilities = await renderAt('/analytics/capabilities', 'viewer')
  expect(hasPage(capabilities, 'capabilities')).toBe(true)
  capabilities.unmount()

  const maturity = await renderAt('/data/maturity', 'viewer')
  expect(hasPage(maturity, 'data-maturity')).toBe(true)
  maturity.unmount()
})

test('highlights only the current peer analytics destination', async () => {
  const renderer = await renderAt('/analytics/capabilities', 'viewer')
  const links = renderer.root.findAllByType('a')
  const overview = links.find((node) => node.props['aria-label'] === '研发总览')
  const capabilities = links.find((node) => node.props['aria-label'] === '研发能力')
  expect(overview.props['data-section-active']).toBeUndefined()
  expect(capabilities.props['data-section-active']).toBe('true')
  renderer.unmount()
})

test('assigns a named content mode without changing route ownership', async () => {
  for (const [path, mode, role] of [
    ['/', 'dashboard', 'admin'],
    ['/analytics/activities', 'analytics', 'viewer'],
    ['/analytics/teams/2', 'analytics', 'viewer'],
    ['/data/requirements/design', 'workbench', 'viewer'],
    ['/data/requirements/development', 'workbench', 'viewer'],
    ['/settings/collections', 'admin', 'admin'],
    ['/settings/metrics', 'catalog', 'viewer'],
    ['/settings/teams', 'management', 'admin'],
    ['/settings/products', 'management', 'admin'],
    ['/settings/gateway', 'admin', 'admin'],
    ['/settings/users', 'admin', 'admin'],
  ]) {
    const renderer = await renderAt(path, role)
    expect(contentMode(renderer)).toContain(`app-shell__content--${mode}`)
    renderer.unmount()
  }
})

test('pushes active filter changes and restores them with MemoryRouter history', async () => {
  const renderer = await renderAt('/?cycle=half', 'admin')
  await act(async () => {
    renderer.root.findByProps({ 'data-filter-cycle': true }).props.onClick()
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  expect(currentSearch(renderer)).toBe('')

  await act(async () => {
    renderer.root.findByProps({ 'data-history-back': true }).props.onClick()
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  expect(currentSearch(renderer)).toBe('?cycle=half')
  renderer.unmount()
})

test('normalizes iteration week query input to month with a replace', async () => {
  const renderer = await renderAt('/?dimension=iteration&granularity=week', 'admin')
  expect(hasText(renderer, 'time|month|all|latest')).toBe(true)
  expect(currentSearch(renderer)).toBe('')
  renderer.unmount()
})

test('preserves supported iteration state but drops a team version outside its product scope', async () => {
  const renderer = await renderAt('/team/42?dimension=iteration&version=2&period=p2', 'admin')
  expect(currentPath(renderer)).toBe('/analytics/teams/42')
  expect(currentSearch(renderer)).toBe('?dimension=iteration&period=p2')
  renderer.unmount()
})

test('team detail navigation opens the Overview team section and preserves filters', async () => {
  const renderer = await renderAt('/?month=2026-09&cycle=half', 'admin')
  const link = renderer.root.findAllByType('a').find(node => node.props['aria-label'] === '团队详情')
  expect(link.props.href).toBe('/?month=2026-09&cycle=half#team-performance')
  await act(async () => link.props.onClick({ button: 0, preventDefault() {} }))
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  expect(currentPath(renderer)).toBe('/')
  expect(currentSearch(renderer)).toBe('?month=2026-09&cycle=half')
  expect(currentHash(renderer)).toBe('#team-performance')
  expect(link.props['data-section-active']).toBe('true')
  expect(renderer.root.findAllByType('a').filter((node) => node.props.className === 'app-nav__link' && node.props['aria-current'] === 'page')).toEqual([link])
  await act(async () => renderer.unmount())
})

test('topbar quick search navigates only through visible page entries and labels unavailable notifications', async () => {
  const renderer = await renderAt('/', 'admin')
  const searchInput = renderer.root.findByProps({ 'aria-label': '搜索页面或功能' })
  await act(async () => searchInput.props.onChange({ target: { value: '研发活动' } }))
  const searchForm = renderer.root.findByProps({ role: 'search' })
  await act(async () => searchForm.props.onSubmit({ preventDefault: vi.fn() }))
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

  expect(currentPath(renderer)).toBe('/analytics/activities')
  expect(hasPage(renderer, 'activities')).toBe(true)
  expect(renderer.root.findByProps({ 'aria-label': '通知功能暂未开放' }).props.disabled).toBe(true)
  const helpMenu = renderer.root.findByProps({ className: 'app-topbar__help-menu' })
  expect(helpMenu.findAllByType('a').some((node) => node.props.href === '/data/requirements/design')).toBe(true)
  await act(async () => renderer.unmount())
})

test('provides one main landmark and a keyboard skip link in the app shell', async () => {
  const renderer = await renderAt('/settings/teams', 'admin')
  expect(renderer.root.findAllByProps({ role: 'main' })).toHaveLength(1)
  expect(hasText(renderer, '跳过导航，进入主要内容')).toBe(true)
  expect(renderer.root.findByProps({ id: 'main-content' }).props.tabIndex).toBe(-1)
  renderer.unmount()
})

test('bootstraps authentication once across SPA navigation', async () => {
  let authCalls = 0
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.endsWith('/api/auth/me')) {
      authCalls += 1
      return new Response(JSON.stringify({ id: 1, username: 'admin', role: 'admin' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response('[]', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  let renderer
  await act(async () => {
    renderer = create(
      <MemoryRouter initialEntries={['/']}>
        <App />
        <NavigateOnce to="/data/issues" />
      </MemoryRouter>,
    )
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })

  expect(authCalls).toBe(1)
  renderer.unmount()
})

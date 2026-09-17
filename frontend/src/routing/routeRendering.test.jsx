import React from 'react'
import { ConfigProvider } from 'antd'
import { act, create } from 'react-test-renderer'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import App, { ApplicationRoutes } from '../App.jsx'
import { getRouteMeta } from './routeMetadata.js'

// Route behavior is rendered with the real router and real application route tree.
// Ant Design's CSS-in-JS adapter requires a browser document, which this node-only
// renderer deliberately does not provide, so only the shell primitives are mocked.
vi.mock('antd', () => ({
  App: ({ children }) => <>{children}</>,
  Breadcrumb: ({ items = [] }) => <nav>{items.map((item) => <span key={item.title}>{item.title}</span>)}</nav>,
  Button: ({ children, onClick, ...props }) => <button type="button" onClick={onClick} {...props}>{children}</button>,
  Drawer: ({ children, open, onClose }) => open ? <div data-drawer><button data-close-drawer onClick={onClose}>关闭</button>{children}</div> : null,
  Tooltip: ({ children }) => <>{children}</>,
  ConfigProvider: ({ children }) => <>{children}</>,
  Result: ({ title, subTitle, extra }) => <section><h1>{title}</h1><p>{subTitle}</p>{extra}</section>,
  Tag: ({ children }) => <span>{children}</span>,
}))

vi.mock('@ant-design/icons', () => {
  const Icon = () => <span aria-hidden="true" />
  return {
    AppstoreOutlined: Icon,
    BarChartOutlined: Icon,
    BugOutlined: Icon,
    CodeOutlined: Icon,
    FileTextOutlined: Icon,
    PullRequestOutlined: Icon,
    LogoutOutlined: Icon,
    MenuFoldOutlined: Icon,
    MenuUnfoldOutlined: Icon,
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
    </>
  ),
  TeamDrilldownPage: () => <StubPage page="team-analytics">团队下钻</StubPage>,
  MetricDetailPage: () => <StubPage page="metric-analytics">指标详情</StubPage>,
  DataManagementPage: ({ section }) => <StubPage page={`data-${section}`}>{section}</StubPage>,
  UsersSettingsPage: () => <StubPage page="settings-users">用户与权限</StubPage>,
}

function LocationProbe() {
  const location = useLocation()
  return <span data-current-path={location.pathname} data-current-search={location.search} />
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

async function renderAt(pathname, role = 'admin') {
  let renderer
  await act(async () => {
    renderer = create(
      <ConfigProvider>
        <MemoryRouter initialEntries={[pathname]}>
          <ApplicationRoutes
            user={{ id: 1, username: role, role }}
            onLogout={() => undefined}
            onSessionExpired={() => undefined}
            routeComponents={routeComponents}
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

function hasPage(renderer, page) {
  return renderer.root.findAll((node) => node.props['data-page'] === page).length > 0
}

function hasText(renderer, text) {
  return renderText(renderer.toJSON()).includes(text)
}

test('route metadata treats one or more trailing slashes like the canonical path', () => {
  for (const pathname of ['/data/requirements/ir', '/data/issues', '/settings/teams', '/settings/products', '/settings/metrics', '/settings/users']) {
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
  const renderer = await renderAt('/data/requirements/ir', 'viewer')
  const links = () => renderer.root.findAllByType('a').filter(node => node.props.className?.split(' ').includes('app-nav__link'))
  const before = links().map(node => [node.props.href, node.props['aria-label']])
  const requests = globalThis.fetch.mock.calls.length
  const toggle = () => renderer.root.findAllByType('button').find(node => node.props['aria-controls'] === 'app-navigation')
  expect(toggle().props['aria-expanded']).toBe(true)
  expect(renderer.root.findByProps({ className: 'app-sidebar__header' }).findAllByType('button')).toHaveLength(1)
  await act(async () => toggle().props.onClick())
  expect(toggle().props['aria-expanded']).toBe(false)
  expect(links().map(node => [node.props.href, node.props['aria-label']])).toEqual(before)
  expect(links().some(node => node.props['aria-current'] === 'page')).toBe(true)
  expect(links().some(node => node.props.href === '/settings/users')).toBe(false)
  expect(links().filter(node => ['需求', '问题单', 'MR', '代码检视'].includes(node.props['aria-label']))).toHaveLength(4)
  expect(globalThis.fetch.mock.calls.length).toBe(requests)
  await act(async () => toggle().props.onClick())
  expect(toggle().props['aria-expanded']).toBe(true)
  await act(async () => renderer.unmount())
})

test('narrow navigation opens a drawer and closes on navigation or breakpoint change', async () => {
  let listener
  const media = { matches: true, addEventListener: (_, fn) => { listener = fn }, removeEventListener: vi.fn() }
  globalThis.matchMedia = () => media
  const renderer = await renderAt('/data/requirements/ir')
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
  let renderer = await renderAt('/data/requirements/ir')
  await act(async () => renderer.root.findAllByType('button').find(node => node.props['aria-label'] === '折叠导航').props.onClick())
  await act(async () => renderer.unmount())
  renderer = await renderAt('/data/requirements/ir')
  expect(renderer.root.findAllByType('button').some(node => node.props['aria-label'] === '展开导航')).toBe(true)
  await act(async () => renderer.unmount())
  globalThis.localStorage = { getItem() { throw Error('unavailable') }, setItem() { throw Error('unavailable') } }
  renderer = await renderAt('/data/requirements/ir')
  await act(async () => renderer.root.findAllByType('button').find(node => node.props['aria-label'] === '折叠导航').props.onClick())
  expect(renderer.root.findAllByType('button').some(node => node.props['aria-label'] === '展开导航')).toBe(true)
  await act(async () => renderer.unmount())
})

test('overview owns drilldown routes without claiming to be the exact page', async () => {
  for (const pathname of ['/analytics/teams/42', '/analytics/metrics/99']) {
    const renderer = await renderAt(pathname)
    const link = renderer.root.findAllByType('a').find(node => node.props['aria-label'] === '研发总览')
    expect(link.props['data-section-active']).toBe('true')
    expect(link.props['aria-current']).toBeUndefined()
    await act(async () => renderer.unmount())
  }
})

test('data sources are direct navigation entries for all roles', async () => {
  for (const role of ['admin', 'maintainer', 'viewer']) {
    const renderer = await renderAt('/data/requirements/ir', role)
    const labels = renderer.root.findAllByType('a').map(node => node.props['aria-label'])
    expect(labels).toEqual(expect.arrayContaining(['需求', '问题单', 'MR', '代码检视']))
    await act(async () => renderer.unmount())
  }
})

for (const [role, pathname, page] of [
  ['admin', '/settings/users', 'settings-users'],
  ['admin', '/settings/teams', 'data-teams'],
  ['maintainer', '/settings/teams', 'data-teams'],
  ['viewer', '/settings/teams', 'data-teams'],
  ['admin', '/data/requirements/ir', 'data-requirements'],
  ['maintainer', '/data/requirements/ir', 'data-requirements'],
  ['viewer', '/data/requirements/ir', 'data-requirements'],
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
]) {
  test(`${role} receives 403 for ${pathname}`, async () => {
    const renderer = await renderAt(pathname, role)
    expect(hasText(renderer, '无权访问')).toBe(true)
    renderer.unmount()
  })
}

for (const [from, to] of [
  ['/team/42', '/analytics/teams/42'],
  ['/metric/99', '/analytics/metrics/99'],
  ['/data-management', '/data/requirements/ir'],
  ['/data-management/ir', '/data/requirements/ir'],
  ['/data-management/ar', '/data/requirements/ar'],
  ['/data-management/sr', '/data/requirements/sr'],
  ['/data-management/dts', '/data/issues'],
  ['/data-management/mr', '/data/mr'],
  ['/data-management/teams', '/settings/teams'],
  ['/data-management/products', '/settings/products'],
  ['/data-management/metrics', '/settings/metrics'],
  ['/manual-entry', '/data/requirements/ir'],
]) {
  test(`redirects ${from} to ${to}`, async () => {
    const renderer = await renderAt(from, 'admin')
    expect(currentPath(renderer)).toBe(to)
    renderer.unmount()
  })
}

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
  expect(hasText(pending, '问题单数据源规格待定义')).toBe(true)
  pending.unmount()

  const unknownDomain = await renderAt('/data/foo', 'admin')
  expect(hasText(unknownDomain, '页面未找到')).toBe(true)
  unknownDomain.unmount()
})

test('unknown requirement types fall back to IR', async () => {
  const renderer = await renderAt('/data/requirements/custom', 'admin')
  expect(currentPath(renderer)).toBe('/data/requirements/ir')
  expect(hasPage(renderer, 'data-requirements')).toBe(true)
  renderer.unmount()
})

test('unknown paths render the unified 404 state', async () => {
  const renderer = await renderAt('/not-a-real-page', 'admin')
  expect(hasText(renderer, '页面未找到')).toBe(true)
  renderer.unmount()
})

test('hydrates the analysis slice from URL query parameters', async () => {
  const renderer = await renderAt('/?dimension=iteration&granularity=week&version=2&period=p2', 'admin')
  expect(hasText(renderer, 'iteration|month|2|p2')).toBe(true)
  expect(currentSearch(renderer)).toBe('?dimension=iteration&version=2&period=p2')
  renderer.unmount()
})

test('pushes active filter changes and restores them with MemoryRouter history', async () => {
  const renderer = await renderAt('/?period=p1', 'admin')
  await act(async () => {
    renderer.root.findByProps({ 'data-filter-week': true }).props.onClick()
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  expect(currentSearch(renderer)).toBe('?granularity=week&period=p1')

  await act(async () => {
    renderer.root.findByProps({ 'data-history-back': true }).props.onClick()
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  expect(currentSearch(renderer)).toBe('?period=p1')
  renderer.unmount()
})

test('normalizes iteration week query input to month with a replace', async () => {
  const renderer = await renderAt('/?dimension=iteration&granularity=week', 'admin')
  expect(hasText(renderer, 'iteration|month|all|latest')).toBe(true)
  expect(currentSearch(renderer)).toBe('?dimension=iteration')
  renderer.unmount()
})

test('preserves the analysis query through team compatibility redirects', async () => {
  const renderer = await renderAt('/team/42?dimension=iteration&version=2&period=p2', 'admin')
  expect(currentPath(renderer)).toBe('/analytics/teams/42')
  expect(currentSearch(renderer)).toBe('?dimension=iteration&version=2&period=p2')
  renderer.unmount()
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

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
  Button: ({ children, onClick }) => <button type="button" onClick={onClick}>{children}</button>,
  ConfigProvider: ({ children }) => <>{children}</>,
  Result: ({ title, subTitle, extra }) => <section><h1>{title}</h1><p>{subTitle}</p>{extra}</section>,
  Tag: ({ children }) => <span>{children}</span>,
}))

vi.mock('@ant-design/icons', () => {
  const Icon = () => <span aria-hidden="true" />
  return {
    AppstoreOutlined: Icon,
    BarChartOutlined: Icon,
    DatabaseOutlined: Icon,
    LogoutOutlined: Icon,
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
  for (const pathname of ['/data/ir', '/settings/teams', '/settings/products', '/settings/metrics', '/settings/users']) {
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
})

for (const [role, pathname, page] of [
  ['admin', '/settings/users', 'settings-users'],
  ['admin', '/settings/teams', 'data-teams'],
  ['maintainer', '/settings/teams', 'data-teams'],
  ['viewer', '/settings/teams', 'data-teams'],
  ['admin', '/data/ir', 'data-ir'],
  ['maintainer', '/data/ir', 'data-ir'],
  ['viewer', '/data/ir', 'data-ir'],
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
  ['/data-management', '/data/ir'],
  ['/data-management/ir', '/data/ir'],
  ['/data-management/teams', '/settings/teams'],
  ['/data-management/products', '/settings/products'],
  ['/data-management/metrics', '/settings/metrics'],
  ['/manual-entry', '/data/ir'],
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
  const pending = await renderAt('/data/ar', 'admin')
  expect(hasText(pending, 'AR 领域规格待定义')).toBe(true)
  pending.unmount()

  const unknownDomain = await renderAt('/data/foo', 'admin')
  expect(hasText(unknownDomain, '页面未找到')).toBe(true)
  unknownDomain.unmount()
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
        <NavigateOnce to="/data/ar" />
      </MemoryRouter>,
    )
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })

  expect(authCalls).toBe(1)
  renderer.unmount()
})

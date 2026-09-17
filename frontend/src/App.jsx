import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { App as AntdApp, Breadcrumb, Button, ConfigProvider, Drawer, Result, Tag, Tooltip } from 'antd'
import { LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined } from '@ant-design/icons'
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from 'react-router'

import { fetchJson } from './api'
import './app.css'
import { findMetric } from './metricDetail/metricDetailLogic'
import {
  filterFromSearchParams,
  filterToSearchParams,
  FILTER_QUERY_KEYS,
  filtersEqual,
  MATURITY_QUERY_KEYS,
  maturityStateFromSearchParams,
  maturityStateToSearchParams,
  maturityStatesEqual,
  normalizeFilter,
  normalizeMaturityState,
} from './overview/overviewLogic'
import { ADMIN_ROLES, DATA_READ_ROLES, SETTINGS_READ_ROLES, canAccess, isPendingDomain } from './routing/routeLogic'
import { getRouteMeta, LEGACY_REDIRECT_TARGETS, ROUTE_PATHS, SIDEBAR_GROUPS } from './routing/routeMetadata'

const OverviewPage = lazy(() => import('./overview/OverviewPage'))
const TeamDrilldownPage = lazy(() => import('./drilldown/TeamDrilldownPage'))
const MetricDetailPage = lazy(() => import('./metricDetail/MetricDetailPage'))
const DataManagementPage = lazy(() => import('./dataManagement/DataManagementPage'))
const UsersSettingsPage = lazy(() => import('./settings/UsersSettingsPage'))

const APP_THEME = {
  token: {
    colorPrimary: '#2563EB',
    colorBgLayout: '#F5F7FA',
    colorBgContainer: '#FFFFFF',
    colorText: '#172033',
    colorTextSecondary: '#667085',
    borderRadius: 6,
    controlHeight: 32,
    paddingXXS: 4,
    paddingXS: 8,
    paddingSM: 12,
    padding: 16,
    paddingLG: 24,
    paddingXL: 32,
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
  },
  components: {
    Button: { borderRadius: 6, controlHeight: 32 },
    Breadcrumb: { fontSize: 12 },
  },
}
const ROLE_LABELS = { admin: '管理员', maintainer: '维护者', viewer: '查看者' }

function LoginPage({ onLogin, error }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onLogin({ username, password })
    } catch {
      // 登录错误已经由 App 转换为表单提示。
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <form onSubmit={submit} className="auth-card">
        <div className="auth-card__brand">
          <img className="app-brand__logo" src="/favicon.svg" alt="" aria-hidden="true" />
          <div><h1>ai-dev-radar</h1><p>Enterprise Analytics</p></div>
        </div>
        <p className="auth-card__intro">登录后查看研发团队的 AI 研发效能分析。</p>
        <label className="auth-field">账号<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
        <label className="auth-field">密码<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p role="alert" className="auth-error">{error}</p>}
        <Button type="primary" htmlType="submit" block loading={submitting}>登录</Button>
      </form>
    </main>
  )
}

function ForbiddenPage() {
  const navigate = useNavigate()
  return <div className="status-page"><Result status="403" title="无权访问" subTitle="当前角色不能访问此页面。" extra={<Button type="primary" onClick={() => navigate('/')}>返回总览</Button>} /></div>
}

function LoadingPage({ text = '加载中…' }) {
  return <div className="status-page"><p className="app-loading">{text}</p></div>
}

function NotFoundPage() {
  const navigate = useNavigate()
  return <div className="status-page"><Result status="404" title="页面未找到" subTitle="请求的页面不存在，或链接已经失效。" extra={<Button type="primary" onClick={() => navigate('/')}>返回总览</Button>} /></div>
}

function PendingDomainPage({ domain }) {
  const navigate = useNavigate()
  return <div className="status-page"><Result status="info" title={`${domain}数据源规格待定义`} subTitle="当前阶段尚未定义该数据源的字段、校验规则和指标口径，暂不提供表单。" extra={<Button type="primary" onClick={() => navigate('/data/requirements/ir')}>查看需求数据</Button>} /></div>
}

function appendSearch(pathname, search) {
  if (!search || pathname.includes('?')) return pathname
  return `${pathname}${search}`
}

function useSearchPreservingNavigate() {
  const navigate = useNavigate()
  const { search } = useLocation()
  return useCallback((pathname, options) => navigate(appendSearch(pathname, search), options), [navigate, search])
}

function useUrlFilter(versions) {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchString = searchParams.toString()
  const [filter, setFilterState] = useState(() => filterFromSearchParams(searchParams))
  const lastSearchString = useRef(searchString)
  const readingUrl = useRef(false)
  const pendingHistoryMode = useRef(null)

  useEffect(() => {
    if (searchString === lastSearchString.current) return
    readingUrl.current = true
    lastSearchString.current = searchString
    const fromUrl = filterFromSearchParams(searchParams, { versions })
    setFilterState((current) => filtersEqual(current, fromUrl) ? current : fromUrl)
  }, [searchParams, searchString, versions])

  const normalizedFilter = normalizeFilter(filter, { versions })
  const normalizedSearchParams = new URLSearchParams(searchString)
  Object.values(FILTER_QUERY_KEYS).forEach((key) => normalizedSearchParams.delete(key))
  filterToSearchParams(normalizedFilter).forEach((value, key) => normalizedSearchParams.set(key, value))
  const normalizedSearchString = normalizedSearchParams.toString()

  useEffect(() => {
    if (readingUrl.current) {
      readingUrl.current = false
      return
    }
    if (normalizedSearchString === searchString) {
      lastSearchString.current = searchString
      return
    }
    lastSearchString.current = normalizedSearchString
    const historyMode = pendingHistoryMode.current ?? 'replace'
    pendingHistoryMode.current = null
    setSearchParams(new URLSearchParams(normalizedSearchString), { replace: historyMode === 'replace' })
  }, [normalizedSearchString, searchString, setSearchParams])

  const setFilter = useCallback((nextFilter, options = {}) => {
    pendingHistoryMode.current = options.history ?? 'replace'
    setFilterState((current) => normalizeFilter(typeof nextFilter === 'function' ? nextFilter(current) : nextFilter, { versions }))
  }, [versions])

  return [normalizedFilter, setFilter]
}

function useUrlMaturity(teams) {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchString = searchParams.toString()
  const [state, setState] = useState(() => maturityStateFromSearchParams(searchParams, { teams }))
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const fromUrl = maturityStateFromSearchParams(searchParams, { teams })
    if (!maturityStatesEqual(stateRef.current, fromUrl)) {
      stateRef.current = fromUrl
      setState(fromUrl)
    }
  }, [searchParams, searchString, teams])

  const setMaturity = useCallback((nextState, options = {}) => {
    const candidate = typeof nextState === 'function' ? nextState(stateRef.current) : nextState
    const next = normalizeMaturityState(candidate, { teams })
    stateRef.current = next
    setState(next)

    const nextParams = new URLSearchParams(searchString)
    Object.values(MATURITY_QUERY_KEYS).forEach((key) => nextParams.delete(key))
    maturityStateToSearchParams(next).forEach((value, key) => nextParams.set(key, value))
    setSearchParams(nextParams, { replace: options.history !== 'push' })
  }, [searchString, setSearchParams, teams])

  return [state, setMaturity]
}

function AppSidebar({ user, collapsed = false, onToggle, onNavigate }) {
  const { search, pathname } = useLocation()
  const groups = SIDEBAR_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.roles || item.roles.includes(user.role)) }))
    .filter((group) => group.items.length > 0)

  return (
    <aside className="app-sidebar" aria-label="主导航">
      <div className="app-sidebar__header"><div className="app-brand"><img className="app-brand__logo" src="/favicon.svg" alt="" aria-hidden="true" /><span className="app-brand__copy"><span className="app-brand__name">ai-dev-radar</span><span className="app-brand__caption">Enterprise Analytics</span></span></div>{onToggle && <Tooltip title={collapsed ? '展开导航' : '折叠导航'} placement="right"><Button className="app-sidebar__toggle" type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} aria-label={collapsed ? '展开导航' : '折叠导航'} aria-expanded={!collapsed} aria-controls="app-navigation" onClick={onToggle} /></Tooltip>}</div>
      <nav id="app-navigation" className="app-nav">
        {groups.map((group) => (
          <section key={group.label} className="app-nav__group">
            <h2 className="app-nav__label">{group.label}</h2>
            {group.items.map((item) => {
              const Icon = item.icon
              const content = <><span className="app-nav__icon"><Icon /></span><span className="app-nav__text">{item.label}</span></>
              return <Tooltip key={item.key} title={collapsed ? item.label : undefined} placement="right">
                <NavLink onClick={onNavigate} aria-label={item.label} data-section-active={(item.key === 'overview' && (pathname === '/' || pathname.startsWith('/analytics/teams/') || pathname.startsWith('/analytics/metrics/'))) || (item.activePrefix && pathname.startsWith(item.activePrefix)) ? 'true' : undefined} to={item.to === '/' ? appendSearch('/', search) : item.to} end={item.to === '/'} className="app-nav__link">{content}</NavLink>
              </Tooltip>
            })}
          </section>
        ))}
      </nav>
    </aside>
  )
}

function AppShell({ user, onLogout }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return globalThis.localStorage?.getItem('ai-dev-radar.sidebar-collapsed') === 'true' } catch { return false }
  })
  const [narrow, setNarrow] = useState(() => globalThis.matchMedia?.('(max-width: 680px)').matches ?? false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigationButton = useRef(null)
  useEffect(() => {
    const media = globalThis.matchMedia?.('(max-width: 680px)')
    const update = () => { setNarrow(media.matches); setDrawerOpen(false) }
    media?.addEventListener?.('change', update)
    return () => media?.removeEventListener?.('change', update)
  }, [])
  function toggleSidebar() {
    const next = !collapsed
    setCollapsed(next)
    try { globalThis.localStorage?.setItem('ai-dev-radar.sidebar-collapsed', String(next)) } catch { /* Storage is optional. */ }
  }
  const location = useLocation()
  const meta = getRouteMeta(location.pathname)
  return (
    <div className={`app-shell${!narrow && collapsed ? ' app-shell--collapsed' : ''}`}>
      <a className="app-skip-link" href="#main-content">跳过导航，进入主要内容</a>
      {!narrow && <AppSidebar user={user} collapsed={collapsed} onToggle={toggleSidebar} />}
      {narrow && <Drawer title="导航" placement="left" size={280} open={drawerOpen} onClose={() => setDrawerOpen(false)} afterOpenChange={(open) => { if (!open) navigationButton.current?.focus() }} styles={{ body: { padding: 0 } }}>
        <AppSidebar user={user} onNavigate={() => setDrawerOpen(false)} />
      </Drawer>}
      <div className="app-shell__body">
        <header className="app-topbar"><div className="app-topbar__heading">{narrow && <Button ref={navigationButton} type="text" icon={<MenuUnfoldOutlined />} aria-label="打开导航" aria-expanded={drawerOpen} aria-controls={drawerOpen ? "app-navigation" : undefined} onClick={() => setDrawerOpen(true)} />}<div className="app-topbar__context"><Breadcrumb items={meta.items} /><p className="app-topbar__title">{meta.title}</p></div></div><div className="app-topbar__actions"><span className="app-user"><UserOutlined />{user.username}<Tag color="blue" className="app-role-tag">{ROLE_LABELS[user.role] ?? user.role} · {user.role}</Tag></span><Button type="text" size="small" icon={<LogoutOutlined />} onClick={onLogout}>退出</Button></div></header>
        <div id="main-content" className="app-shell__content" role="main" tabIndex={-1}><Outlet /></div>
      </div>
    </div>
  )
}

function AnalyticsDataLayout({ onSessionExpired }) {
  const [state, setState] = useState({ catalog: null, teams: null, versions: null, error: null })
  const [filter, setFilter] = useUrlFilter(state.versions ?? [])
  const [maturity, setMaturity] = useUrlMaturity(state.teams ?? [])
  const sessionExpiredRef = useRef(onSessionExpired)
  sessionExpiredRef.current = onSessionExpired

  useEffect(() => {
    let active = true
    Promise.all([fetchJson('/api/catalog'), fetchJson('/api/teams'), fetchJson('/api/versions')])
      .then(([catalog, teams, versions]) => { if (active) setState({ catalog, teams, versions, error: null }) })
      .catch((error) => { if (!active) return; setState((current) => ({ ...current, error })); if (error.status === 401) sessionExpiredRef.current() })
    return () => { active = false }
  }, [])

  if (state.error) return <div className="status-page"><Result status="error" title="分析数据加载失败" subTitle={state.error.message} /></div>
  if (!state.catalog || !state.teams || !state.versions) return <LoadingPage text="加载研发分析…" />
  return <Outlet context={{ ...state, filter, onFilterChange: setFilter, maturity, onMaturityChange: setMaturity }} />
}

function OverviewRoute({ Page, onSessionExpired, user }) {
  const analytics = useOutletContext()
  const navigate = useSearchPreservingNavigate()
  return <Page {...analytics} user={user} maturityState={analytics.maturity} onMaturityChange={analytics.onMaturityChange} onFilterChange={analytics.onFilterChange} onNavigate={navigate} onSessionExpired={onSessionExpired} />
}

function TeamAnalyticsRoute({ Page, onSessionExpired }) {
  const { teamId } = useParams()
  const analytics = useOutletContext()
  const navigate = useSearchPreservingNavigate()
  const team = analytics.teams.find((item) => String(item.id) === decodeURIComponent(teamId))
  return <Page {...analytics} team={team} onFilterChange={analytics.onFilterChange} onNavigate={navigate} onSessionExpired={onSessionExpired} />
}

function MetricAnalyticsRoute({ Page, onSessionExpired }) {
  const { metricId } = useParams()
  const analytics = useOutletContext()
  const navigate = useSearchPreservingNavigate()
  const entry = findMetric(analytics.catalog, decodeURIComponent(metricId))
  return <Page {...analytics} activity={entry?.activity} metric={entry?.metric} onFilterChange={analytics.onFilterChange} onNavigate={navigate} onSessionExpired={onSessionExpired} />
}

function DataRoute({ Page, section, user, onSessionExpired }) {
  const { requirementType } = useParams()
  const navigate = useNavigate()
  if (section === 'requirements' && !['ir', 'ar', 'sr'].includes(requirementType)) return <Navigate to="/data/requirements/ir" replace />
  return <Page section={section} requirementType={requirementType} onRequirementTypeChange={(type) => navigate(`/data/requirements/${type}`)} user={user} onSessionExpired={onSessionExpired} />
}

function RequireRole({ user, roles }) {
  if (!canAccess(roles, user.role)) return <ForbiddenPage />
  return <Outlet />
}

function LegacyDataManagementRoute() {
  const { domain } = useParams()
  const { search } = useLocation()
  const normalizedDomain = domain?.toLowerCase()
  const target = LEGACY_REDIRECT_TARGETS[`/data-management/${normalizedDomain}`]
  if (target) return <Navigate to={appendSearch(target, search)} replace />
  if (isPendingDomain(normalizedDomain)) return <PendingDomainPage domain={normalizedDomain.toUpperCase()} />
  return <NotFoundPage />
}

function LegacyTeamRedirect() {
  const { id } = useParams()
  const { search } = useLocation()
  return <Navigate to={appendSearch(`/analytics/teams/${encodeURIComponent(id)}`, search)} replace />
}

function LegacyMetricRedirect() {
  const { id } = useParams()
  const { search } = useLocation()
  return <Navigate to={appendSearch(`/analytics/metrics/${encodeURIComponent(id)}`, search)} replace />
}

function LegacyDataManagementRootRedirect() {
  const { search } = useLocation()
  return <Navigate to={appendSearch(LEGACY_REDIRECT_TARGETS['/data-management'], search)} replace />
}

const DEFAULT_ROUTE_COMPONENTS = { OverviewPage, TeamDrilldownPage, MetricDetailPage, DataManagementPage, UsersSettingsPage }

export function ApplicationRoutes({ user, onLogout, onSessionExpired, routeComponents = DEFAULT_ROUTE_COMPONENTS }) {
  const { OverviewPage: OverviewComponent, TeamDrilldownPage: TeamDrilldownComponent, MetricDetailPage: MetricDetailComponent, DataManagementPage: DataManagementComponent, UsersSettingsPage: UsersSettingsComponent } = routeComponents
  return (
    <Suspense fallback={<LoadingPage text="加载页面模块…" />}>
      <Routes>
        <Route path="login" element={<Navigate to="/" replace />} />
        <Route element={<AppShell user={user} onLogout={onLogout} />}>
          <Route element={<AnalyticsDataLayout onSessionExpired={onSessionExpired} />}>
            <Route index element={<OverviewRoute Page={OverviewComponent} user={user} onSessionExpired={onSessionExpired} />} />
            <Route path={ROUTE_PATHS.teamAnalytics} element={<TeamAnalyticsRoute Page={TeamDrilldownComponent} onSessionExpired={onSessionExpired} />} />
            <Route path={ROUTE_PATHS.metricAnalytics} element={<MetricAnalyticsRoute Page={MetricDetailComponent} onSessionExpired={onSessionExpired} />} />
          </Route>
          <Route element={<RequireRole user={user} roles={DATA_READ_ROLES} />}>
            <Route path={ROUTE_PATHS.requirements} element={<Navigate to="/data/requirements/ir" replace />} />
            <Route path={ROUTE_PATHS.requirementType} element={<DataRoute Page={DataManagementComponent} section="requirements" user={user} onSessionExpired={onSessionExpired} />} />
            <Route path="data/ir" element={<Navigate to="/data/requirements/ir" replace />} />
            <Route path="data/ar" element={<Navigate to="/data/requirements/ar" replace />} />
            <Route path="data/sr" element={<Navigate to="/data/requirements/sr" replace />} />
            <Route path="data/dts" element={<Navigate to="/data/issues" replace />} />
            <Route path={ROUTE_PATHS.dataDomain} element={<PendingDomainRoute />} />
            <Route path={ROUTE_PATHS.legacyData} element={<LegacyDataManagementRootRedirect />} />
            <Route path={ROUTE_PATHS.legacyDataDomain} element={<LegacyDataManagementRoute />} />
            <Route path={ROUTE_PATHS.legacyManualEntry} element={<Navigate to="/data/requirements/ir" replace />} />
          </Route>
          <Route element={<RequireRole user={user} roles={SETTINGS_READ_ROLES} />}>
            <Route path={ROUTE_PATHS.teams} element={<DataRoute Page={DataManagementComponent} section="teams" user={user} onSessionExpired={onSessionExpired} />} />
            <Route path={ROUTE_PATHS.products} element={<DataRoute Page={DataManagementComponent} section="products" user={user} onSessionExpired={onSessionExpired} />} />
            <Route path={ROUTE_PATHS.metrics} element={<DataRoute Page={DataManagementComponent} section="metrics" user={user} onSessionExpired={onSessionExpired} />} />
          </Route>
          <Route element={<RequireRole user={user} roles={ADMIN_ROLES} />}>
            <Route path={ROUTE_PATHS.users} element={<UsersSettingsComponent user={user} onSessionExpired={onSessionExpired} />} />
            {/* Stage three migration complete: the legacy config entry now resolves to the split settings surface. */}
            <Route path={ROUTE_PATHS.legacyConfig} element={<Navigate to={LEGACY_REDIRECT_TARGETS['/config']} replace />} />
          </Route>
          <Route path={ROUTE_PATHS.legacyTeam} element={<LegacyTeamRedirect />} />
          <Route path={ROUTE_PATHS.legacyMetric} element={<LegacyMetricRedirect />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

function PendingDomainRoute() {
  const { domain } = useParams()
  if (!isPendingDomain(domain)) return <NotFoundPage />
  const label = { issues: '问题单', mr: 'MR', 'code-review': '代码检视' }[domain.toLowerCase()]
  return <PendingDomainPage domain={label} />
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState(undefined)
  const [authError, setAuthError] = useState(null)
  const [returnPath, setReturnPath] = useState(null)
  const authBootstrapPromise = useRef(null)
  const authMounted = useRef(false)
  const initialLocation = useRef(location)
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    authMounted.current = true
    if (!authBootstrapPromise.current) {
      authBootstrapPromise.current = fetchJson('/api/auth/me')
        .then((nextUser) => { if (authMounted.current) setUser(nextUser) })
        .catch((error) => {
          if (!authMounted.current) return
          if (error.status === 401) {
            setUser(null)
            if (initialLocation.current.pathname !== '/login') {
              const target = initialLocation.current
              setReturnPath(`${target.pathname}${target.search}${target.hash}`)
              navigateRef.current('/login', { replace: true })
            }
          } else setAuthError(error.message)
        })
    }
    return () => { authMounted.current = false }
  }, [])

  const login = useCallback(async (credentials) => {
    try {
      const loggedInUser = await fetchJson('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) })
      setAuthError(null)
      setUser(loggedInUser)
      const currentPath = `${location.pathname}${location.search}${location.hash}`
      const destination = location.pathname === '/login' ? (returnPath ?? '/') : currentPath
      setReturnPath(null)
      navigate(destination, { replace: true })
    } catch (error) {
      setAuthError(error.status === 401 ? '账号或密码错误。' : error.message)
      throw error
    }
  }, [location, navigate, returnPath])

  const logout = useCallback(async () => {
    await fetchJson('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    setUser(null)
    setReturnPath(null)
    navigate('/login', { replace: true })
  }, [navigate])

  const sessionExpired = useCallback(() => {
    const currentPath = `${location.pathname}${location.search}${location.hash}`
    setAuthError('会话已过期，请重新登录。')
    setUser(null)
    setReturnPath(currentPath)
    navigate('/login', { replace: true })
  }, [location, navigate])

  let content
  if (user === undefined) {
    content = authError ? <main className="status-page"><Result status="error" title="认证服务不可用" subTitle={authError} /></main> : <LoadingPage />
  } else if (!user) {
    content = location.pathname === '/login' ? <LoginPage onLogin={login} error={authError} /> : <Navigate to="/login" replace />
  } else content = <ApplicationRoutes user={user} onLogout={logout} onSessionExpired={sessionExpired} />

  return <ConfigProvider theme={APP_THEME}><AntdApp>{content}</AntdApp></ConfigProvider>
}

import React, { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { App as AntdApp, Breadcrumb, Button, ConfigProvider, Drawer, Tooltip } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BellOutlined, LogoutOutlined, MenuFoldOutlined, MenuOutlined, QuestionCircleOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationType,
  useOutletContext,
  useParams,
  useSearchParams,
} from 'react-router'

import { fetchJson } from './api'
import { DrawerFocusProvider } from './components/FocusRestoringDrawer'
import './design/tokens.css'
import './design/design-system.css'
import './app.css'
import StatusPage, { ContentLoadingState } from './components/StatusPage'
import { appTheme } from './design/theme'
import { findMetric } from './metricDetail/metricDetailLogic'
import {
  filterFromSearchParams,
  filterToSearchParams,
  FILTER_QUERY_KEYS,
  MATURITY_QUERY_KEYS,
  maturityStateFromSearchParams,
  maturityStateToSearchParams,
  maturityStatesEqual,
  normalizeFilter,
  normalizeMaturityState,
  isValidMonth,
  teamProductVersions,
} from './overview/overviewLogic'
import {
  ADMIN_ROLES,
  DATA_READ_ROLES,
  SETTINGS_READ_ROLES,
  canAccess,
  isPendingDomain,
  isRequirementActivity,
  normalizeRequirementActivity,
} from './routing/routeLogic'
import { getRouteMeta, LEGACY_REDIRECT_TARGETS, ROUTE_PATHS, SIDEBAR_GROUPS } from './routing/routeMetadata'

const OverviewPage = lazy(() => import('./overview/OverviewPage'))
const ActivitiesPage = lazy(() => import('./analytics/AnalyticsPages').then((module) => ({ default: module.ActivitiesPage })))
const CapabilitiesPage = lazy(() => import('./analytics/AnalyticsPages').then((module) => ({ default: module.CapabilitiesPage })))
const TeamDrilldownPage = lazy(() => import('./drilldown/TeamDrilldownPage'))
const MetricDetailPage = lazy(() => import('./metricDetail/MetricDetailPage'))
const DataManagementPage = lazy(() => import('./dataManagement/DataManagementPage'))
const UsersSettingsPage = lazy(() => import('./settings/UsersSettingsPage'))
const CollectionsSettingsPage = lazy(() => import('./settings/CollectionsSettingsPage'))
const GatewaySettingsPage = lazy(() => import('./settings/GatewaySettingsPage'))

const ROLE_LABELS = { admin: '管理员', maintainer: '维护者', viewer: '查看者' }

function LoginPage({ onLogin, error, onClearError }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState(null)
  const usernameInput = useRef(null)
  const passwordInput = useRef(null)

  async function submit(event) {
    event.preventDefault()
    if (!username.trim() || !password) {
      setValidationError('请输入账号和密码。')
      if (!username.trim()) usernameInput.current?.focus()
      else passwordInput.current?.focus()
      return
    }
    setValidationError(null)
    setSubmitting(true)
    try {
      await onLogin({ username, password })
    } catch {
      setPassword('')
      passwordInput.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <form noValidate onSubmit={submit} className="auth-card">
        <div className="auth-card__brand">
          <img className="app-brand__logo" src="/favicon.svg" alt="" aria-hidden="true" />
          <div><h1>ai-dev-radar</h1><p>AI 研发效能分析平台</p></div>
        </div>
        <p className="auth-card__intro">登录后查看研发团队的 AI 研发效能分析。</p>
        <label className="auth-field" htmlFor="login-username">账号<input ref={usernameInput} id="login-username" name="username" autoComplete="username" value={username} aria-invalid={Boolean(validationError || error)} aria-describedby={validationError || error ? 'login-error' : undefined} onChange={(event) => { setUsername(event.target.value); setValidationError(null); onClearError() }} required /></label>
        <label className="auth-field" htmlFor="login-password">密码<input ref={passwordInput} id="login-password" name="password" type="password" autoComplete="current-password" value={password} aria-invalid={Boolean(validationError || error)} aria-describedby={validationError || error ? 'login-error' : undefined} onChange={(event) => { setPassword(event.target.value); setValidationError(null); onClearError() }} required /></label>
        {(validationError || error) && <p id="login-error" role="alert" className="auth-error">{validationError || error}</p>}
        <Button type="primary" htmlType="submit" block loading={submitting}>登录</Button>
      </form>
    </main>
  )
}

function ForbiddenPage() {
  const navigate = useNavigate()
  return <StatusPage status="forbidden" title="无权访问" description="当前账号没有访问此页面的权限。" actions={<Button type="primary" onClick={() => navigate('/')}>返回研发总览</Button>} />
}

function NotFoundPage() {
  const navigate = useNavigate()
  return <StatusPage status="not-found" title="页面未找到" description="页面不存在，或链接已经失效。" actions={<Button type="primary" onClick={() => navigate('/')}>返回研发总览</Button>} />
}

function PendingDomainPage({ domain }) {
  const navigate = useNavigate()
  return (
    <StatusPage status="pending" layout="compact" title={`${domain}数据暂未开放`} description="该数据源的字段、校验规则和指标口径尚未定义，当前不提供数据表单。" actions={<Button onClick={() => navigate('/data/requirements/design')}>查看需求数据</Button>} />
  )
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

function useUrlFilter(versions, versionsReady) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { pathname } = useLocation()
  const searchString = searchParams.toString()
  const overview = pathname === '/'
  const activity = pathname === '/analytics/activities'
  const capability = pathname === '/analytics/capabilities'
  const teamMatch = pathname.match(/^\/analytics\/teams\/([^/]+)\/?$/)
  const teamId = teamMatch ? decodeURIComponent(teamMatch[1]) : null
  const scopedVersions = useMemo(
    () => teamId === null ? versions : teamProductVersions(versions, teamId),
    [teamId, versions],
  )
  const locationKey = `${pathname}?${searchString}`
  const [filter, setFilterState] = useState(() => filterFromSearchParams(searchParams, { overview, activity, capability }))
  const lastLocationKey = useRef(locationKey)
  const readingUrl = useRef(false)
  const pendingHistoryMode = useRef(null)

  useEffect(() => {
    if (locationKey === lastLocationKey.current) return
    readingUrl.current = true
    lastLocationKey.current = locationKey
    const fromUrl = filterFromSearchParams(searchParams, { versions: scopedVersions, overview, activity, capability, teamId, versionsReady })
    setFilterState(fromUrl)
  }, [locationKey, searchParams, scopedVersions, overview, activity, capability, teamId, versionsReady])

  const filterOptions = useMemo(
    () => ({ versions: scopedVersions, overview, activity, capability, teamId, versionsReady }),
    [scopedVersions, overview, activity, capability, teamId, versionsReady],
  )
  const normalizedFilter = normalizeFilter(filter, filterOptions)
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
      lastLocationKey.current = locationKey
      return
    }
    const historyMode = pendingHistoryMode.current ?? 'replace'
    pendingHistoryMode.current = null
    setSearchParams(new URLSearchParams(normalizedSearchString), { replace: historyMode === 'replace' })
  }, [locationKey, normalizedSearchString, searchString, setSearchParams])

  const setFilter = useCallback((nextFilter, options = {}) => {
    pendingHistoryMode.current = options.history ?? 'replace'
    setFilterState((current) => normalizeFilter(typeof nextFilter === 'function' ? nextFilter(current) : nextFilter, filterOptions))
  }, [activity, capability, filterOptions, overview])

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
  const { search, pathname, hash } = useLocation()
  const teamDrilldownRoute = pathname.startsWith('/analytics/teams/')
  const teamSectionSelected = (pathname === '/' && hash === '#team-performance') || teamDrilldownRoute
  const groups = SIDEBAR_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.roles || item.roles.includes(user.role)) }))
    .filter((group) => group.items.length > 0)

  return (
    <aside className="app-sidebar" aria-label="主导航">
      <div className="app-sidebar__header"><div className="app-brand"><img className="app-brand__logo" src="/favicon.svg" alt="" aria-hidden="true" /><span className="app-brand__copy"><span className="app-brand__name">ai-dev-radar</span><span className="app-brand__caption">AI 研发效能分析平台</span></span></div>{onToggle && <Tooltip title={collapsed ? '展开导航' : '折叠导航'} placement="right"><Button className="app-sidebar__toggle" type="text" icon={collapsed ? <MenuOutlined /> : <MenuFoldOutlined />} aria-label={collapsed ? '展开导航' : '折叠导航'} aria-expanded={!collapsed} aria-controls="app-navigation" onClick={onToggle} /></Tooltip>}</div>
      <nav id="app-navigation" className="app-nav">
        {groups.map((group) => (
          <section key={group.label} className="app-nav__group">
            <h2 className="app-nav__label">{group.label}</h2>
            {group.items.map((item) => {
              const Icon = item.icon
              const content = <><span className="app-nav__icon"><Icon /></span><span className="app-nav__text">{item.label}</span></>
              const sectionActive = item.key === 'team-details'
                ? teamSectionSelected
                : item.key === 'overview'
                  ? (pathname === '/' || pathname.startsWith('/analytics/teams/') || pathname.startsWith('/analytics/metrics/')) && !teamSectionSelected
                  : Boolean(item.activePrefix && pathname.startsWith(item.activePrefix))
              const target = item.key === 'team-details'
                ? (teamDrilldownRoute ? appendSearch(pathname, search) : { pathname: '/', search, hash: '#team-performance' })
                : item.to === '/' ? appendSearch('/', search) : item.to
              const handleClick = (event) => {
                onNavigate?.(event)
                if (item.key === 'team-details' && pathname === '/') globalThis.document?.getElementById('team-performance')?.scrollIntoView({ block: 'start' })
              }
              const linkProps = { onClick: handleClick, 'aria-label': item.label, 'data-section-active': sectionActive ? 'true' : undefined, className: 'app-nav__link' }
              const link = item.key === 'overview' || item.key === 'team-details'
                ? <Link {...linkProps} aria-current={sectionActive && (item.key !== 'overview' || pathname === '/') ? 'page' : undefined} to={target}>{content}</Link>
                : <NavLink {...linkProps} to={target} end={item.to === '/'}>{content}</NavLink>
              return <Tooltip key={item.key} title={collapsed ? item.label : undefined} placement="right">
                {link}
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
  const focusRestoreTimer = useRef(null)
  useEffect(() => {
    const media = globalThis.matchMedia?.('(max-width: 680px)')
    const update = () => { setNarrow(media.matches); setDrawerOpen(false) }
    media?.addEventListener?.('change', update)
    return () => {
      media?.removeEventListener?.('change', update)
      globalThis.clearTimeout(focusRestoreTimer.current)
    }
  }, [])
  function toggleSidebar() {
    const next = !collapsed
    setCollapsed(next)
    try { globalThis.localStorage?.setItem('ai-dev-radar.sidebar-collapsed', String(next)) } catch { /* Storage is optional. */ }
  }
  function closeNavigation() {
    setDrawerOpen(false)
    globalThis.clearTimeout(focusRestoreTimer.current)
    focusRestoreTimer.current = globalThis.setTimeout(() => navigationButton.current?.focus(), 320)
  }
  const location = useLocation()
  const navigationType = useNavigationType()
  const navigate = useNavigate()
  const previousPathname = useRef(location.pathname)
  const teamSourceLabel = useRef(null)
  if (location.pathname.startsWith('/analytics/teams/')) {
    if (typeof location.state?.returnLabel === 'string') teamSourceLabel.current = location.state.returnLabel
  } else teamSourceLabel.current = null
  useLayoutEffect(() => {
    if (previousPathname.current === location.pathname) return
    previousPathname.current = location.pathname
    if (navigationType !== 'POP') globalThis.window?.scrollTo?.(0, 0)
  }, [location.pathname, navigationType])
  const routeMeta = getRouteMeta(location.pathname)
  const meta = teamSourceLabel.current
    ? { ...routeMeta, items: [...routeMeta.items, { title: `来自${teamSourceLabel.current}` }] }
    : routeMeta
  // ponytail: quick search indexes existing routes; add domain data only when its authorized query contract exists.
  const searchOptions = SIDEBAR_GROUPS.flatMap((group) => group.items)
    .filter((item) => !item.roles || item.roles.includes(user.role))
    .map((item) => ({ label: item.label, path: item.to === '/' ? '/' : item.to.startsWith('/') ? item.to : `/${item.to}` }))
  const [searchValue, setSearchValue] = useState('')
  const [searchStatus, setSearchStatus] = useState('')
  function submitNavigationSearch(event) {
    event.preventDefault()
    const query = searchValue.trim().toLocaleLowerCase()
    const target = searchOptions.find((item) => item.label.toLocaleLowerCase() === query)
      ?? searchOptions.find((item) => item.label.toLocaleLowerCase().includes(query))
    if (!query || !target) {
      setSearchStatus(query ? '没有找到匹配的页面。' : '请输入页面或功能名称。')
      return
    }
    setSearchStatus('')
    setSearchValue('')
    navigate(target.path)
  }
  const contentMode = location.pathname === '/'
    ? 'dashboard'
    : location.pathname.startsWith('/analytics/')
      ? 'analytics'
      : ['/settings/gateway', '/settings/collections', '/settings/users'].includes(location.pathname)
        ? 'admin'
        : location.pathname === '/settings/teams' || location.pathname === '/settings/products'
          ? 'management'
          : location.pathname === '/settings/metrics'
            ? 'catalog'
            : location.pathname.startsWith('/data/')
              ? 'workbench'
              : location.pathname.startsWith('/settings/')
                ? 'operational'
                : 'readable'
  return (
    <div className={`app-shell${!narrow && collapsed ? ' app-shell--collapsed' : ''}`}>
      <a className="app-skip-link" href="#main-content">跳过导航，进入主要内容</a>
      {!narrow && <AppSidebar user={user} collapsed={collapsed} onToggle={toggleSidebar} />}
      {narrow && <Drawer title="导航" placement="left" size={280} open={drawerOpen} onClose={closeNavigation} destroyOnHidden focusable={{ focusTriggerAfterClose: false }} styles={{ body: { padding: 0 } }}>
        <AppSidebar user={user} onNavigate={closeNavigation} />
      </Drawer>}
      <div className="app-shell__body">
        <header className="app-topbar">
          <div className="app-topbar__heading">{narrow && <Button ref={navigationButton} type="text" icon={<MenuOutlined />} aria-label="打开导航" aria-expanded={drawerOpen} aria-controls={drawerOpen ? 'app-navigation' : undefined} onClick={() => setDrawerOpen(true)} />}<div className="app-topbar__context"><Breadcrumb items={meta.items} /></div></div>
          <div className="app-topbar__actions">
            <div className="app-topbar__tools">
              <form noValidate className="app-topbar__search" role="search" aria-label="快速导航搜索" onSubmit={submitNavigationSearch}>
                <SearchOutlined aria-hidden="true" />
                <input aria-label="搜索页面或功能" list="app-topbar-search-options" placeholder="搜索页面或功能…" value={searchValue} onChange={(event) => { setSearchValue(event.target.value); setSearchStatus('') }} />
                <datalist id="app-topbar-search-options">{searchOptions.map((item) => <option key={item.path} value={item.label} />)}</datalist>
              </form>
              <span className="app-topbar__notification-wrap"><Tooltip title="通知功能暂未开放" placement="bottom"><span><Button className="app-topbar__utility-button" type="text" disabled icon={<BellOutlined />} aria-label="通知功能暂未开放" /></span></Tooltip></span>
              <details className="app-topbar__help">
                <summary aria-label="帮助与常用入口"><QuestionCircleOutlined aria-hidden="true" /></summary>
                <nav className="app-topbar__help-menu" aria-label="常用入口">
                  <strong>常用入口</strong>
                  <NavLink to="/data/requirements/design">需求数据</NavLink>
                  <NavLink to="/analytics/activities">研发活动</NavLink>
                  <NavLink to="/data/maturity">成熟度评估</NavLink>
                </nav>
              </details>
              <span className="app-sr-only" role="status" aria-live="polite">{searchStatus}</span>
            </div>
            <div className="app-topbar__account"><div className="app-user"><UserOutlined aria-hidden="true" /><span className="app-user__identity"><span className="app-user__name">{user.username}</span><span className="app-user__role">{ROLE_LABELS[user.role] ?? user.role}</span></span></div><Button className="app-logout" type="text" size="small" icon={<LogoutOutlined />} onClick={onLogout}>退出</Button></div>
          </div>
        </header>
        <div id="main-content" className={`app-shell__content app-shell__content--${contentMode}`} role="main" tabIndex={-1}><Suspense fallback={<ContentLoadingState label="加载页面模块…" className="route-loading" />}><Outlet /></Suspense></div>
      </div>
    </div>
  )
}

function AnalyticsDataLayout({ onSessionExpired }) {
  const [state, setState] = useState({ catalog: null, teams: null, versions: null, error: null })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [filter, setFilter] = useUrlFilter(state.versions ?? [], state.versions !== null)
  const [maturity, setMaturity] = useUrlMaturity(state.teams ?? [])
  const sessionExpiredRef = useRef(onSessionExpired)
  sessionExpiredRef.current = onSessionExpired

  useEffect(() => {
    let active = true
    Promise.all([fetchJson('/api/catalog'), fetchJson('/api/teams'), fetchJson('/api/versions')])
      .then(([catalog, teams, versions]) => { if (active) setState({ catalog, teams, versions, error: null }) })
      .catch((error) => { if (!active) return; setState((current) => ({ ...current, error })); if (error.status === 401) sessionExpiredRef.current() })
    return () => { active = false }
  }, [loadAttempt])

  if (state.error) return <StatusPage status="error" title="研发分析暂时无法加载" description="请重试；如果问题持续，请稍后再试。" actions={<Button type="primary" onClick={() => { setState({ catalog: null, teams: null, versions: null, error: null }); setLoadAttempt((attempt) => attempt + 1) }}>重试</Button>} />
  if (!state.catalog || !state.teams || !state.versions) return <ContentLoadingState label="加载研发分析…" />
  return <Outlet context={{ ...state, filter, onFilterChange: setFilter, maturity, onMaturityChange: setMaturity }} />
}

function OverviewRoute({ Page, onSessionExpired, user }) {
  const analytics = useOutletContext()
  const navigate = useSearchPreservingNavigate()
  return <Page {...analytics} user={user} maturityState={analytics.maturity} onMaturityChange={analytics.onMaturityChange} onFilterChange={analytics.onFilterChange} onNavigate={navigate} onSessionExpired={onSessionExpired} />
}

function LegacyCategoryOrOverviewRoute({ Page, ...props }) {
  const [searchParams] = useSearchParams()
  const category = searchParams.get('category')
  if (category === 'key' || category === 'general') {
    const target = category === 'key' ? '/analytics/activities' : '/analytics/capabilities'
    const month = searchParams.get('month')
    return <Navigate to={isValidMonth(month) ? `${target}?month=${encodeURIComponent(month)}` : target} replace />
  }
  return <OverviewRoute Page={Page} {...props} />
}

function TeamAnalyticsRoute({ Page, onSessionExpired }) {
  const { teamId } = useParams()
  const analytics = useOutletContext()
  const navigate = useSearchPreservingNavigate()
  const team = analytics.teams.find((item) => String(item.id) === decodeURIComponent(teamId))
  const versions = teamProductVersions(analytics.versions, team?.id)
  return <Page {...analytics} versions={versions} team={team} maturityState={analytics.maturity} onMaturityChange={analytics.onMaturityChange} onFilterChange={analytics.onFilterChange} onNavigate={navigate} onSessionExpired={onSessionExpired} />
}

function MetricAnalyticsRoute({ Page, onSessionExpired }) {
  const { metricId } = useParams()
  const analytics = useOutletContext()
  const navigate = useSearchPreservingNavigate()
  const entry = findMetric(analytics.catalog, decodeURIComponent(metricId))
  return <Page {...analytics} activity={entry?.activity} metric={entry?.metric} onFilterChange={analytics.onFilterChange} onNavigate={navigate} onSessionExpired={onSessionExpired} />
}

function DataRoute({ Page, section, user, onSessionExpired }) {
  const { activity } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  if (section === 'requirements' && !isRequirementActivity(activity)) {
    return <Navigate to={`/data/requirements/${normalizeRequirementActivity(activity)}`} replace />
  }
  return <Page section={section} activity={activity} initialMonth={searchParams.get('month')} onActivityChange={(nextActivity) => navigate(`/data/requirements/${nextActivity}`)} user={user} onSessionExpired={onSessionExpired} />
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

const DEFAULT_ROUTE_COMPONENTS = { OverviewPage, ActivitiesPage, CapabilitiesPage, TeamDrilldownPage, MetricDetailPage, DataManagementPage, UsersSettingsPage, CollectionsSettingsPage, GatewaySettingsPage }

export function ApplicationRoutes({ user, onLogout, onSessionExpired, routeComponents = DEFAULT_ROUTE_COMPONENTS }) {
  const OverviewComponent = routeComponents.OverviewPage
  const ActivitiesComponent = routeComponents.ActivitiesPage ?? OverviewComponent
  const CapabilitiesComponent = routeComponents.CapabilitiesPage ?? OverviewComponent
  const TeamDrilldownComponent = routeComponents.TeamDrilldownPage
  const MetricDetailComponent = routeComponents.MetricDetailPage
  const DataManagementComponent = routeComponents.DataManagementPage
  const UsersSettingsComponent = routeComponents.UsersSettingsPage
  const CollectionsSettingsComponent = routeComponents.CollectionsSettingsPage
  const GatewaySettingsComponent = routeComponents.GatewaySettingsPage
  return (
    <Routes>
        <Route element={<AppShell user={user} onLogout={onLogout} />}>
          <Route element={<AnalyticsDataLayout onSessionExpired={onSessionExpired} />}>
            <Route index element={<LegacyCategoryOrOverviewRoute Page={OverviewComponent} user={user} onSessionExpired={onSessionExpired} />} />
            <Route path={ROUTE_PATHS.activitiesAnalytics} element={<OverviewRoute Page={ActivitiesComponent} user={user} onSessionExpired={onSessionExpired} />} />
            <Route path={ROUTE_PATHS.capabilitiesAnalytics} element={<OverviewRoute Page={CapabilitiesComponent} user={user} onSessionExpired={onSessionExpired} />} />
            <Route path={ROUTE_PATHS.teamAnalytics} element={<TeamAnalyticsRoute Page={TeamDrilldownComponent} onSessionExpired={onSessionExpired} />} />
            <Route path={ROUTE_PATHS.metricAnalytics} element={<MetricAnalyticsRoute Page={MetricDetailComponent} onSessionExpired={onSessionExpired} />} />
          </Route>
          <Route element={<RequireRole user={user} roles={DATA_READ_ROLES} />}>
            <Route path={ROUTE_PATHS.requirements} element={<Navigate to="/data/requirements/design" replace />} />
            <Route path={ROUTE_PATHS.requirementActivity} element={<DataRoute Page={DataManagementComponent} section="requirements" user={user} onSessionExpired={onSessionExpired} />} />
            <Route path={ROUTE_PATHS.maturity} element={<DataRoute Page={DataManagementComponent} section="maturity" user={user} onSessionExpired={onSessionExpired} />} />
            <Route path="data/ir" element={<Navigate to="/data/requirements/design" replace />} />
            <Route path="data/ar" element={<Navigate to="/data/requirements/development" replace />} />
            <Route path="data/sr" element={<Navigate to="/data/requirements/design" replace />} />
            <Route path="data/dts" element={<Navigate to="/data/issues" replace />} />
            <Route path={ROUTE_PATHS.dataDomain} element={<PendingDomainRoute />} />
            <Route path={ROUTE_PATHS.legacyData} element={<LegacyDataManagementRootRedirect />} />
            <Route path={ROUTE_PATHS.legacyDataDomain} element={<LegacyDataManagementRoute />} />
            <Route path={ROUTE_PATHS.legacyManualEntry} element={<Navigate to="/data/requirements/design" replace />} />
          </Route>
          <Route element={<RequireRole user={user} roles={SETTINGS_READ_ROLES} />}>
            <Route path={ROUTE_PATHS.teams} element={<DataRoute Page={DataManagementComponent} section="teams" user={user} onSessionExpired={onSessionExpired} />} />
            <Route path={ROUTE_PATHS.products} element={<DataRoute Page={DataManagementComponent} section="products" user={user} onSessionExpired={onSessionExpired} />} />
            <Route path={ROUTE_PATHS.metrics} element={<DataRoute Page={DataManagementComponent} section="metrics" user={user} onSessionExpired={onSessionExpired} />} />
          </Route>
          <Route element={<RequireRole user={user} roles={ADMIN_ROLES} />}>
            <Route path={ROUTE_PATHS.users} element={<UsersSettingsComponent user={user} onSessionExpired={onSessionExpired} />} />
            <Route path={ROUTE_PATHS.collections} element={<CollectionsSettingsComponent user={user} onSessionExpired={onSessionExpired} />} />
            <Route path={ROUTE_PATHS.gateway} element={<GatewaySettingsComponent user={user} onSessionExpired={onSessionExpired} />} />
            {/* Stage three migration complete: the legacy config entry now resolves to the split settings surface. */}
            <Route path={ROUTE_PATHS.legacyConfig} element={<Navigate to={LEGACY_REDIRECT_TARGETS['/config']} replace />} />
          </Route>
          <Route path={ROUTE_PATHS.legacyTeam} element={<LegacyTeamRedirect />} />
          <Route path={ROUTE_PATHS.legacyMetric} element={<LegacyMetricRedirect />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
    </Routes>
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
  const loginDestination = useRef(null)
  const initialLocation = useRef(location)
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    if (typeof document === 'undefined') return
    const title = location.pathname === '/login' ? '登录' : getRouteMeta(location.pathname).title
    document.title = `${title} | ai-dev-radar`
  }, [location.pathname])

  useEffect(() => {
    if (location.pathname !== '/login') {
      loginDestination.current = null
      return
    }
    if (user) navigate(loginDestination.current ?? returnPath ?? '/', { replace: true })
  }, [location.pathname, navigate, returnPath, user])

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
      loginDestination.current = location.pathname === '/login' ? (returnPath ?? '/') : `${location.pathname}${location.search}${location.hash}`
      setUser(loggedInUser)
      const destination = loginDestination.current
      setReturnPath(null)
      navigate(destination, { replace: true })
    } catch (error) {
      setAuthError(error.status === 401 ? '账号或密码错误。' : '登录请求暂时失败，请稍后重试。')
      throw error
    }
  }, [location, navigate, returnPath])

  const logout = useCallback(async () => {
    await fetchJson('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    loginDestination.current = null
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
    content = authError
      ? <main className="status-page"><StatusPage status="error" title="认证服务暂时不可用" description="请重试；如果问题持续，请稍后再试。" actions={<Button type="primary" onClick={() => window.location.reload()}>重试</Button>} /></main>
      : <main className="status-page"><ContentLoadingState label="正在确认登录状态…" className="auth-loading" /></main>
  } else if (!user) {
    content = location.pathname === '/login' ? <LoginPage onLogin={login} error={authError} onClearError={() => setAuthError(null)} /> : <Navigate to="/login" replace />
  } else content = <ApplicationRoutes user={user} onLogout={logout} onSessionExpired={sessionExpired} />

  return <DrawerFocusProvider><ConfigProvider locale={zhCN} theme={appTheme}><AntdApp>{content}</AntdApp></ConfigProvider></DrawerFocusProvider>
}

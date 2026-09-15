import {
  AppstoreOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'

import { ADMIN_ROLES, ANALYTICS_ROLES, DATA_READ_ROLES, PENDING_DOMAINS, SETTINGS_READ_ROLES } from './routeLogic'

export { PENDING_DOMAINS }

export const ROUTE_PATHS = Object.freeze({
  overview: '/',
  teamAnalytics: 'analytics/teams/:teamId',
  metricAnalytics: 'analytics/metrics/:metricId',
  ir: 'data/ir',
  dataDomain: 'data/:domain',
  teams: 'settings/teams',
  products: 'settings/products',
  metrics: 'settings/metrics',
  users: 'settings/users',
  legacyTeam: 'team/:id',
  legacyMetric: 'metric/:id',
  legacyData: 'data-management',
  legacyDataDomain: 'data-management/:domain',
  legacyManualEntry: 'manual-entry',
  legacyConfig: 'config',
})

export const LEGACY_REDIRECT_TARGETS = Object.freeze({
  '/data-management': '/data/ir',
  '/data-management/ir': '/data/ir',
  '/data-management/teams': '/settings/teams',
  '/data-management/products': '/settings/products',
  '/data-management/metrics': '/settings/metrics',
  '/config': '/settings/teams',
  '/manual-entry': '/data/ir',
})

export const SIDEBAR_GROUPS = [
  {
    label: '洞察',
    items: [
      { key: 'overview', label: '研发总览', to: ROUTE_PATHS.overview, icon: BarChartOutlined, roles: ANALYTICS_ROLES },
    ],
  },
  {
    label: '数据管理',
    items: [
      { key: 'ir', label: 'IR', to: `/${ROUTE_PATHS.ir}`, icon: DatabaseOutlined, roles: DATA_READ_ROLES },
      { key: 'ar', label: 'AR', icon: DatabaseOutlined, disabled: true },
      { key: 'sr', label: 'SR', icon: DatabaseOutlined, disabled: true },
      { key: 'dts', label: 'DTS', icon: DatabaseOutlined, disabled: true },
      { key: 'mr', label: 'MR', icon: DatabaseOutlined, disabled: true },
    ],
  },
  {
    label: '系统管理',
    items: [
      { key: 'teams', label: '团队与人员', to: `/${ROUTE_PATHS.teams}`, icon: TeamOutlined, roles: SETTINGS_READ_ROLES },
      { key: 'products', label: '产品与版本', to: `/${ROUTE_PATHS.products}`, icon: AppstoreOutlined, roles: SETTINGS_READ_ROLES },
      { key: 'metrics', label: '指标定义', to: `/${ROUTE_PATHS.metrics}`, icon: BarChartOutlined, roles: SETTINGS_READ_ROLES },
      { key: 'users', label: '用户与权限', to: `/${ROUTE_PATHS.users}`, icon: UserOutlined, roles: ADMIN_ROLES },
    ],
  },
]

export function getRouteMeta(pathname) {
  const normalizedPathname = pathname === '/' ? '/' : String(pathname || '/').replace(/\/+$/, '') || '/'
  if (normalizedPathname === '/') return { title: '研发总览', items: [{ title: '洞察' }, { title: '研发总览' }] }
  if (/^\/analytics\/teams\//.test(normalizedPathname)) {
    return { title: '团队下钻', items: [{ title: '洞察' }, { title: '研发总览' }, { title: '团队下钻' }] }
  }
  if (/^\/analytics\/metrics\//.test(normalizedPathname)) {
    return { title: '指标详情', items: [{ title: '洞察' }, { title: '研发总览' }, { title: '指标详情' }] }
  }
  if (normalizedPathname === '/data/ir') return { title: 'IR 数据', items: [{ title: '数据管理' }, { title: 'IR' }] }
  if (/^\/data\/(ar|sr|dts|mr)$/i.test(normalizedPathname)) {
    return { title: '领域规格待定义', items: [{ title: '数据管理' }, { title: normalizedPathname.split('/').pop().toUpperCase() }] }
  }
  const settingsMeta = {
    '/settings/teams': ['团队与人员', '团队与人员'],
    '/settings/products': ['产品与版本', '产品与版本'],
    '/settings/metrics': ['指标定义', '指标定义'],
    '/settings/users': ['用户与权限', '用户与权限'],
  }[normalizedPathname]
  if (settingsMeta) return { title: settingsMeta[0], items: [{ title: '系统管理' }, { title: settingsMeta[1] }] }
  return { title: '页面未找到', items: [{ title: '系统' }, { title: '页面未找到' }] }
}

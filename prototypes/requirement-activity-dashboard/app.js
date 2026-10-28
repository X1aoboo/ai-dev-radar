/* Review-only prototype. It reuses the app's shell, tokens and analytics component classes. */
const MONTHS = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
const CURRENT_MONTH = '2026-10'
const COLORS = { blue: '#1f6feb', purple: '#7756d8', green: '#168e67', orange: '#e88222', teal: '#0f9d9a', muted: '#667085' }

const state = {
  view: 'overview',
  month: CURRENT_MONTH,
  cycle: '6m',
  team: 'team-a',
  activity: 'sa',
  lifecycle: 'sa',
}

const NAV_GROUPS = [
  { label: '分析', items: [
    { view: 'overview', label: '研发总览', icon: 'overview' },
    { view: 'activities', label: '研发活动', icon: 'activity' },
    { label: '研发能力', icon: 'capability' },
    { view: 'team', label: '团队详情', icon: 'team' },
  ] },
  { label: '数据', items: [
    { label: '需求', icon: 'requirements' },
    { label: '成熟度评估', icon: 'maturity' },
    { label: '问题单', icon: 'issue' },
    { label: 'MR', icon: 'mr' },
    { label: '代码检视', icon: 'review' },
  ] },
  { label: '管理', items: [
    { label: '团队与人员', icon: 'people' },
    { label: '产品与版本', icon: 'products' },
    { label: '指标字典', icon: 'metrics' },
    { label: '数据网关', icon: 'gateway' },
    { label: '数据采集', icon: 'collection' },
    { label: '用户与权限', icon: 'users' },
  ] },
]

const metricDefs = {
  penetration: { name: 'AI需求渗透率', icon: 'pie', accent: COLORS.blue, kind: 'percent' },
  efficiency: { name: 'AI研发提效', icon: 'bolt', accent: COLORS.purple, kind: 'percent' },
  covered: { name: 'AI覆盖需求数', icon: 'file', accent: COLORS.green, kind: 'count' },
  saved: { name: 'AI提效工作量', icon: 'clock', accent: COLORS.orange, kind: 'workload', unit: '人天' },
}

const activityDefs = {
  design: {
    key: 'design', label: '设计活动', color: COLORS.blue, source: '设计需求记录', sourceKind: 'requirement',
    monthly: {
      coverage: { total: 48, known: 42, ai: 27 },
      metrics: {
        penetration: { value: 0.643, delta: 0.031, comparison: 'vs 上月 61.2%', trend: [0.52, 0.55, 0.57, 0.60, 0.62, 0.643] },
        efficiency: { value: 0.186, delta: 0.024, comparison: 'vs 上月 16.2%', trend: [0.12, 0.135, 0.148, 0.164, 0.176, 0.186] },
        covered: { value: 27, delta: 4, comparison: '本月新增 4 条', trend: [19, 21, 22, 24, 25, 27] },
        saved: { value: 20.2, delta: 5.2, comparison: '完整工作量 25 条', trend: [12.0, 13.8, 15.1, 16.9, 18.4, 20.2] },
      },
    },
    cycle: {
      coverage: { total: 96, known: 84, ai: 51 },
      metrics: {
        penetration: { value: 0.607, delta: 0.018, comparison: 'vs 前累计 58.9%', trend: [0.52, 0.54, 0.56, 0.58, 0.59, 0.607] },
        efficiency: { value: 0.171, delta: 0.013, comparison: 'vs 前累计 15.8%', trend: [0.11, 0.12, 0.135, 0.15, 0.162, 0.171] },
        covered: { value: 51, delta: 9, comparison: '周期新增 9 条', trend: [36, 39, 42, 45, 48, 51] },
        saved: { value: 58.6, delta: 11.4, comparison: '周期节省 11.4 人天', trend: [32, 37, 42, 48, 53, 58.6] },
      },
    },
  },
  development: {
    key: 'development', label: '开发活动', color: COLORS.green, source: '开发需求记录', sourceKind: 'requirement',
    monthly: {
      coverage: { total: 32, known: 28, ai: 14 },
      metrics: {
        penetration: { value: 0.50, delta: 0.026, comparison: 'vs 上月 47.4%', trend: [0.39, 0.42, 0.44, 0.46, 0.48, 0.50] },
        efficiency: { value: 0.145, delta: 0.011, comparison: 'vs 上月 13.4%', trend: [0.09, 0.105, 0.116, 0.128, 0.137, 0.145] },
        covered: { value: 14, delta: 2, comparison: '本月新增 2 条', trend: [9, 10, 11, 12, 13, 14] },
        saved: { value: 12.2, delta: 2.9, comparison: '完整工作量 13 条', trend: [7.1, 8.0, 8.8, 9.9, 11.0, 12.2] },
      },
    },
    cycle: {
      coverage: { total: 64, known: 56, ai: 27 },
      metrics: {
        penetration: { value: 0.482, delta: 0.014, comparison: 'vs 前累计 46.8%', trend: [0.39, 0.41, 0.43, 0.45, 0.47, 0.482] },
        efficiency: { value: 0.132, delta: 0.008, comparison: 'vs 前累计 12.4%', trend: [0.08, 0.095, 0.108, 0.118, 0.126, 0.132] },
        covered: { value: 27, delta: 5, comparison: '周期新增 5 条', trend: [17, 19, 21, 23, 25, 27] },
        saved: { value: 34.1, delta: 6.3, comparison: '周期节省 6.3 人天', trend: [18, 21, 24, 27, 31, 34.1] },
      },
    },
  },
}

const teams = [
  { id: 'team-a', name: '团队A', color: '#1f6feb', design: { penetration: 0.72, efficiency: 0.22, covered: 9, saved: 7.8, delta: { penetration: 0.04, efficiency: 0.03, covered: 2, saved: 1.6 } }, development: { penetration: 0.58, efficiency: 0.18, covered: 5, saved: 4.6, delta: { penetration: 0.03, efficiency: 0.02, covered: 1, saved: 0.9 } } },
  { id: 'team-b', name: '团队B', color: '#168e67', design: { penetration: 0.61, efficiency: 0.16, covered: 7, saved: 4.9, delta: { penetration: -0.02, efficiency: 0.01, covered: 1, saved: 0.4 } }, development: { penetration: 0.47, efficiency: 0.12, covered: 4, saved: 3.1, delta: { penetration: -0.01, efficiency: 0, covered: 0, saved: -0.2 } } },
  { id: 'team-c', name: '团队C', color: '#e88222', design: { penetration: 0.68, efficiency: 0.20, covered: 6, saved: 4.2, delta: { penetration: 0.06, efficiency: 0.04, covered: 1, saved: 1.1 } }, development: { penetration: 0.52, efficiency: 0.15, covered: 3, saved: 2.5, delta: { penetration: 0.04, efficiency: 0.02, covered: 1, saved: 0.5 } } },
  { id: 'team-d', name: '团队D', color: '#7756d8', design: { penetration: 0.56, efficiency: 0.15, covered: 5, saved: 3.3, delta: { penetration: 0.01, efficiency: -0.01, covered: 0, saved: -0.3 } }, development: { penetration: 0.42, efficiency: 0.10, covered: 2, saved: 1.9, delta: { penetration: -0.02, efficiency: -0.01, covered: 0, saved: -0.4 } } },
]

const lifecycle = [
  { id: 'sa', name: 'SA设计', activity: 'design', source: '设计需求记录', sourceKind: 'requirement', pen: 0.682, eff: 0.214, records: 32, known: 25, ai: 18, saved: 9.4, cyclePen: 0.655, cycleEff: 0.198, cycleAi: 34, cycleSaved: 26.4, trend: [0.54, 0.57, 0.60, 0.63, 0.66, 0.682], effTrend: [0.14, 0.16, 0.17, 0.19, 0.20, 0.214] },
  { id: 'se', name: 'SE设计', activity: 'design', source: '设计需求记录', sourceKind: 'requirement', pen: 0.615, eff: 0.168, records: 30, known: 24, ai: 15, saved: 7.6, cyclePen: 0.598, cycleEff: 0.154, cycleAi: 28, cycleSaved: 21.8, trend: [0.48, 0.51, 0.54, 0.57, 0.59, 0.615], effTrend: [0.11, 0.125, 0.14, 0.15, 0.16, 0.168] },
  { id: 'dd', name: '开发设计', activity: 'development', source: '开发需求记录', sourceKind: 'requirement', pen: 0.520, eff: 0.152, records: 25, known: 21, ai: 11, saved: 5.2, cyclePen: 0.512, cycleEff: 0.142, cycleAi: 18, cycleSaved: 14.2, trend: [0.40, 0.43, 0.46, 0.48, 0.50, 0.52], effTrend: [0.10, 0.11, 0.12, 0.135, 0.145, 0.152] },
  { id: 'cd', name: '编码开发', activity: 'development', source: '开发需求记录', sourceKind: 'requirement', pen: 0.464, eff: 0.128, records: 28, known: 22, ai: 10, saved: 4.4, cyclePen: 0.461, cycleEff: 0.121, cycleAi: 15, cycleSaved: 10.6, trend: [0.35, 0.38, 0.40, 0.43, 0.45, 0.464], effTrend: [0.08, 0.095, 0.105, 0.115, 0.122, 0.128] },
  { id: 'tcg', name: '测试用例生成', activity: 'fact', source: 'FactRecord', sourceKind: 'fact', pen: 0.73, eff: 0.24, trend: [0.58, 0.61, 0.65, 0.68, 0.70, 0.73], effTrend: [0.15, 0.17, 0.19, 0.21, 0.22, 0.24] },
  { id: 'tce', name: '测试用例执行', activity: 'fact', source: 'FactRecord', sourceKind: 'fact', empty: true },
]

const activityItems = [
  { id: 'sa', name: 'SA设计', icon: 'penetration', kind: 'requirement', source: '设计需求记录 · SA 角色', lifecycleId: 'sa', meta: '设计活动需求记录' },
  { id: 'se', name: 'SE设计', icon: 'team', kind: 'requirement', source: '设计需求记录 · SE 角色', lifecycleId: 'se', meta: '设计活动需求记录' },
  { id: 'dd', name: '开发设计', icon: 'file', kind: 'requirement', source: '开发需求记录 · 实现设计角色', lifecycleId: 'dd', meta: '开发活动需求记录' },
  { id: 'cd', name: '编码开发', icon: 'code', kind: 'requirement', source: '开发需求记录 · 开发角色', lifecycleId: 'cd', meta: '开发活动需求记录' },
  { id: 'tcg', name: '测试用例生成', icon: 'test', kind: 'fact', source: 'FactRecord · tcg-rate', meta: 'FactRecord 活动事实', fact: { pen: 0.73, eff: 0.24, covered: 326, saved: 18.5, trendPen: [0.58, 0.61, 0.65, 0.68, 0.70, 0.73], trendEff: [0.15, 0.17, 0.19, 0.21, 0.22, 0.24] } },
  { id: 'tce', name: '测试用例执行', icon: 'clock', kind: 'fact', source: 'FactRecord · tce-count', meta: '目录仅定义执行数，无渗透率/提效指标', empty: true },
  { id: 'dta', name: 'DTS缺陷分析', icon: 'bug', kind: 'fact', source: 'FactRecord · DTS', meta: 'FactRecord 活动事实', fact: { pen: 0.61, eff: 0.18, covered: 84, saved: 9.8, trendPen: [0.48, 0.51, 0.54, 0.56, 0.59, 0.61], trendEff: [0.11, 0.13, 0.14, 0.16, 0.17, 0.18] } },
  { id: 'dtf', name: 'DTS缺陷修复', icon: 'fix', kind: 'fact', source: 'FactRecord · DTS', meta: 'FactRecord 活动事实', fact: { pen: 0.57, eff: 0.16, covered: 61, saved: 7.2, trendPen: [0.44, 0.47, 0.50, 0.52, 0.55, 0.57], trendEff: [0.09, 0.11, 0.12, 0.14, 0.15, 0.16] } },
]

const pageSummary = {
  designCoverage: { total: 48, known: 42, ai: 27 },
  developmentCoverage: { total: 32, known: 28, ai: 14 },
  raw: [
    { label: 'AI覆盖设计活动需求数', source: '设计活动 · AI使用为“是”的记录', value: 27, previous: 24, trend: [19, 21, 22, 24, 25, 27] },
    { label: 'AI覆盖开发活动需求数', source: '开发活动 · AI使用为“是”的记录', value: 14, previous: 12, trend: [9, 10, 11, 12, 13, 14] },
    { label: '测试用例生成数', source: 'tcg-rate · AI生成用例数', value: 326, previous: 301, trend: [210, 238, 262, 284, 301, 326] },
    { label: '测试用例执行数', source: 'tce-count · 执行用例数', value: 1284, previous: 1196, trend: [920, 986, 1042, 1108, 1196, 1284] },
  ],
  workload: { design: [12.0, 13.8, 15.1, 16.9, 18.4, 20.2], development: [7.1, 8.0, 8.8, 9.9, 11.0, 12.2] },
}

const maturityRows = [
  { team: '领域平均', values: [4.1, 4.3, 4.2, 4.0, 3.9], average: true },
  { team: '团队A', values: [4.2, 4.5, 4.4, 4.1, 4.0] },
  { team: '团队B', values: [4.0, 4.1, 4.0, 3.9, 3.8] },
  { team: '团队C', values: [4.3, 4.4, 4.3, 4.2, 4.1] },
  { team: '团队D', values: [3.9, 4.0, 3.9, 3.8, 3.7] },
]

const notes = [
  { id: 1, title: '双活动分组，不使用切换器', text: '设计活动与开发活动各自 4 张 KPI 卡，按月度和周期分组展示；趋势、团队矩阵和团队预览都按活动分组，不隐藏任一活动。', ask: '请确认首屏信息密度和 8 张 KPI 卡的高度是否可接受。' },
  { id: 2, title: '时间口径：仅完成 / 已关闭', text: '月份按设计时间/开发时间归集，但只纳入进展为“完成”或“已关闭”的记录；进行中记录不计入 KPI。', ask: '请确认是否保留该限制，以及页面是否要额外显示“进行中记录数”。' },
  { id: 3, title: '活动级 KPI 独立，不跨活动相加', text: 'AI需求渗透率、AI研发提效、AI覆盖需求数、AI提效工作量都按活动分别计算；同一需求编号跨设计/开发不合并。', ask: '请确认“AI覆盖需求数”按活动记录计数，而不是唯一需求数。' },
  { id: 4, title: '四张环节卡改用需求角色字段', text: 'SA设计/SE设计取设计记录，开发设计/编码开发取开发记录；每张卡只使用对应角色的 AI 状态和工作量字段。测试两卡继续使用 FactRecord。', ask: '请确认角色级公式和“测试卡保留 FactRecord”的边界。' },
  { id: 5, title: '团队表现 8 列分组矩阵', text: '设计活动 4 列 + 开发活动 4 列；点击团队行切换右侧 4 张预览图。', ask: '请确认 1280 宽下矩阵是否需要减少列或分两行。' },
  { id: 6, title: '活动页上方同步换源', text: 'SA设计、SE设计、开发设计、编码开发四项改用需求角色指标；测试和 DTS 活动保留 FactRecord，并在页头明确来源。', ask: '请确认是否接受活动页存在两种来源。' },
  { id: 7, title: '原始摘要改为四项', text: '移除 AI覆盖IR需求数、AI覆盖AR需求数、SE设计文档生成数、开发详细设计生成数；保留设计/开发 AI 覆盖数和测试两项。', ask: '请确认是否还需要保留旧六项作为“旧 IR 口径”过渡。' },
  { id: 8, title: '版本筛选同时作用于两个活动', text: '团队下钻的版本选择过滤设计和开发记录；领域参照仍使用同时间范围、不限版本的有值团队等权均值。', ask: '请确认版本切换后是否要保留当前团队的缺失态，而不是回退到有数据版本。' },
  { id: 9, title: '开发活动空态', text: '开发记录目前只有页面维护和文件导入，没有采集与历史回填；无记录时显示“暂无记录”，不显示 0% AI 使用率。', ask: '请确认开发活动空态是否需要显示数据覆盖说明。' },
  { id: 10, title: '视觉与布局待评审', text: '原型已改为复用现有 App shell、PageHeader、MetricKpiCard、AnalyticsPanel 和 TeamMatrix 的视觉语言；仍保留双活动分组。', ask: '请重点看首屏、矩阵横向滚动、活动页目录高度和两套 KPI 分组是否协调。' },
]

const ICONS = {
  overview: '<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/>',
  activity: '<path d="M3 12h4l2.5-6 4 12 2.5-6h5"/>',
  capability: '<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/>',
  team: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15c2.8 0 5 2.2 5 5"/>',
  requirements: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
  maturity: '<path d="M4 19V9M9 19V5M14 19v-6M19 19V8"/>',
  issue: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.1"/>',
  mr: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v6a3 3 0 0 0 3 3h6M18 15V9a3 3 0 0 0-3-3h-3"/>',
  review: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/>',
  products: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  metrics: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  gateway: '<path d="M9 15 15 9M8 6l-3 3a3 3 0 0 0 0 4l2 2M16 18l3-3a3 3 0 0 0 0-4l-2-2"/>',
  collection: '<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7"/>',
  users: '<circle cx="12" cy="8" r="3"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-.9.7-1.5 1.2-1.5 2.5M12 17v.1"/>',
  user: '<circle cx="12" cy="8" r="3"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16zM13 6l4 4"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/>',
  'menu-fold': '<path d="M4 6h16M4 12h10M4 18h16M18 9l3 3-3 3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pie: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  test: '<path d="M9 3h6M10 3v5l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  bug: '<rect x="7" y="7" width="10" height="12" rx="4"/><path d="M9 3v4M15 3v4M4 10h3M17 10h3M4 15h3M17 15h3M9 19l-2 2M15 19l2 2"/>',
  fix: '<path d="M14 6a4 4 0 0 0-5 5l-6 6 3 3 6-6a4 4 0 0 0 5-5l-3 3-3-3 3-3Z"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
}

function icon(name, className = '') {
  return `<span class="proto-icon ${className}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ICONS.overview}</svg></span>`
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
}

function monthLabel(month) {
  const [year, monthNumber] = month.split('-')
  return `${year}年${Number(monthNumber)}月`
}

function cycleLabel() {
  return { '6m': '近6个月', half: '本半年度', year: '年度累计' }[state.cycle] ?? '近6个月'
}

function pct(value) { return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—' }
function count(value) { return Number.isFinite(value) ? Math.round(value).toLocaleString('zh-CN') : '—' }
function workload(value) { return Number.isFinite(value) ? value.toFixed(1) : '—' }
function displayValue(metricKey, value) {
  const kind = metricDefs[metricKey].kind
  if (kind === 'percent') return pct(value)
  if (kind === 'workload') return workload(value)
  return count(value)
}
function deltaText(metricKey, delta) {
  if (!Number.isFinite(delta)) return '—'
  const kind = metricDefs[metricKey].kind
  const sign = delta > 0 ? '+' : ''
  if (kind === 'percent') return `${sign}${(delta * 100).toFixed(1)}pp`
  if (kind === 'workload') return `${sign}${delta.toFixed(1)} 人天`
  return `${sign}${Math.round(delta)}`
}
function deltaTone(delta) {
  if (!Number.isFinite(delta) || delta === 0) return 'neutral'
  return delta > 0 ? 'positive' : 'negative'
}
function noteMarker(id) {
  return `<button class="note-marker" type="button" data-note="${id}" aria-label="查看评审标注 ${id}">${id}</button>`
}

function trendFor(base, kind, variant = 0, length = 6) {
  return Array.from({ length }, (_, index) => {
    const progress = 0.70 + (index / Math.max(length - 1, 1)) * 0.30
    const wobble = Math.sin((index + variant) * 1.15) * (kind === 'percent' ? 0.012 : 0.35)
    const value = base * progress + wobble
    return Number((kind === 'percent' ? Math.max(0, Math.min(1, value)) : Math.max(0, value)).toFixed(4))
  })
}

function sparklineSvg(values, label) {
  const series = (values ?? []).map((value) => Number.isFinite(value) ? value : null)
  const valid = series.filter((value) => value !== null)
  if (valid.length < 2) return '<div class="metric-card__empty-trend" role="img" aria-label="' + escapeHtml(label) + '暂无趋势数据"></div>'
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const span = max - min || 1
  const x = (index) => 2 + (index / Math.max(series.length - 1, 1)) * 124
  const y = (value) => 32 - ((value - min) / span) * 29
  const path = series.map((value, index) => value === null ? null : `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(value).toFixed(2)}`).filter(Boolean).join(' ')
  const area = `${path} L${x(series.length - 1).toFixed(2)},32 L2,32 Z`
  const last = [...series].reverse().find((value) => value !== null)
  const lastIndex = series.lastIndexOf(last)
  return `<svg class="metric-card__sparkline" viewBox="0 0 128 34" role="img" aria-label="${escapeHtml(label)}趋势" preserveAspectRatio="none">
    <defs><linearGradient id="spark-${Math.random().toString(36).slice(2)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity=".4"/><stop offset="100%" stop-color="currentColor" stop-opacity=".04"/></linearGradient></defs>
    <path class="metric-card__sparkline-area" d="${area}" fill="currentColor" opacity=".12"/>
    <path class="metric-card__sparkline-line" d="${path}"/>
    <circle class="metric-card__sparkline-end" cx="${x(lastIndex).toFixed(2)}" cy="${y(last).toFixed(2)}" r="3"/>
  </svg>`
}

function lineSvg(values, { width = 620, height = 180, color = COLORS.blue, benchmark = null, grid = true, labels = null, percent = false } = {}) {
  const series = (values ?? []).map((value) => Number.isFinite(value) ? value : null)
  const valid = series.filter((value) => value !== null)
  if (valid.length < 2) return '<div class="feedback-state" role="status">暂无可绘制的趋势数据</div>'
  const bench = (benchmark ?? []).map((value) => Number.isFinite(value) ? value : null)
  const all = [...valid, ...bench.filter((value) => value !== null)]
  const min = percent ? 0 : Math.min(...all) * .92
  const max = percent ? 1 : Math.max(...all) * 1.06 || 1
  const padX = 38
  const padTop = 10
  const padBottom = labels ? 24 : 6
  const x = (index) => padX + (index / Math.max(series.length - 1, 1)) * (width - padX - 8)
  const y = (value) => height - padBottom - ((value - min) / (max - min || 1)) * (height - padTop - padBottom)
  const path = series.map((value, index) => value === null ? null : `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(value).toFixed(2)}`).filter(Boolean).join(' ')
  const benchPath = bench.some((value) => value !== null)
    ? bench.map((value, index) => value === null ? null : `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(value).toFixed(2)}`).filter(Boolean).join(' ')
    : ''
  const gridLines = grid ? [0, .25, .5, .75, 1].map((ratio) => {
    const gy = padTop + ratio * (height - padTop - padBottom)
    return `<line x1="${padX}" x2="${width - 8}" y1="${gy.toFixed(2)}" y2="${gy.toFixed(2)}" stroke="#eaecf0" stroke-width="1" vector-effect="non-scaling-stroke"/>`
  }).join('') : ''
  const labelsMarkup = labels ? labels.map((label, index) => `<text x="${x(index).toFixed(2)}" y="${height - 5}" text-anchor="middle" fill="#98a2b3" font-size="10">${escapeHtml(label)}</text>`).join('') : ''
  const yLabelMarkup = (grid && percent) ? [0, .5, 1].map((ratio) => {
    const gy = padTop + ratio * (height - padTop - padBottom)
    return `<text x="2" y="${(gy + 3).toFixed(2)}" fill="#98a2b3" font-size="10">${Math.round((1 - ratio) * 100)}%</text>`
  }).join('') : ''
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="趋势示意图">${gridLines}${yLabelMarkup}${path ? `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.2" vector-effect="non-scaling-stroke"/>` : ''}${benchPath ? `<path d="${benchPath}" fill="none" stroke="#98a2b3" stroke-width="1.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>` : ''}${labelsMarkup}</svg>`
}

function multiLineSvg(seriesList, { width = 620, height = 180, labels = null } = {}) {
  const all = seriesList.flatMap((item) => item.values).filter((value) => Number.isFinite(value))
  if (all.length < 2) return '<div class="feedback-state" role="status">暂无可绘制的趋势数据</div>'
  const min = 0
  const max = Math.max(...all) * 1.12 || 1
  const padX = 30
  const padTop = 8
  const padBottom = labels ? 24 : 6
  const length = Math.max(...seriesList.map((item) => item.values.length))
  const x = (index) => padX + (index / Math.max(length - 1, 1)) * (width - padX - 8)
  const y = (value) => height - padBottom - ((value - min) / (max - min || 1)) * (height - padTop - padBottom)
  const grid = [0, .25, .5, .75, 1].map((ratio) => {
    const gy = padTop + ratio * (height - padTop - padBottom)
    return `<line x1="${padX}" x2="${width - 8}" y1="${gy.toFixed(2)}" y2="${gy.toFixed(2)}" stroke="#eaecf0" stroke-width="1" vector-effect="non-scaling-stroke"/>`
  }).join('')
  const paths = seriesList.map((item) => {
    const path = item.values.map((value, index) => Number.isFinite(value) ? `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(value).toFixed(2)}` : null).filter(Boolean).join(' ')
    return `<path d="${path}" fill="none" stroke="${item.color}" stroke-width="2.2" vector-effect="non-scaling-stroke"/>`
  }).join('')
  const labelsMarkup = labels ? labels.map((label, index) => `<text x="${x(index).toFixed(2)}" y="${height - 5}" text-anchor="middle" fill="#98a2b3" font-size="10">${escapeHtml(label)}</text>`).join('') : ''
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="趋势示意图">${grid}${paths}${labelsMarkup}</svg>`
}

function radarSvg() {
  const center = 120
  const radius = 78
  const axes = ['需求分析', 'SE设计', '开发设计', '编码', '检视']
  const values = [4.1, 4.3, 4.2, 4.0, 3.9]
  const prior = [3.9, 4.1, 4.0, 3.8, 3.7]
  const angle = (index) => -Math.PI / 2 + (index / axes.length) * Math.PI * 2
  const point = (value, index) => {
    const r = (value / 5) * radius
    return [center + Math.cos(angle(index)) * r, center + Math.sin(angle(index)) * r]
  }
  const polygon = (values) => values.map((value, index) => point(value, index).map((n) => n.toFixed(1)).join(',')).join(' ')
  const rings = [1, 2, 3, 4, 5].map((level) => `<polygon points="${axes.map((_, index) => point(level, index).map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#eaecf0" stroke-width="1"/>`).join('')
  const spokes = axes.map((_, index) => `<line x1="${center}" y1="${center}" x2="${point(5, index)[0].toFixed(1)}" y2="${point(5, index)[1].toFixed(1)}" stroke="#eaecf0" stroke-width="1"/>`).join('')
  const labels = axes.map((label, index) => {
    const [x, y] = point(5.8, index)
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" fill="#667085" font-size="10">${label}</text>`
  }).join('')
  return `<svg viewBox="0 0 240 240" role="img" aria-label="领域整体成熟度雷达图">${rings}${spokes}<polygon points="${polygon(prior)}" fill="none" stroke="#98a2b3" stroke-width="1.5" stroke-dasharray="4 4"/><polygon points="${polygon(values)}" fill="#1f6feb" fill-opacity=".1" stroke="#1f6feb" stroke-width="2"/>${labels}</svg>`
}

function renderShell() {
  document.getElementById('app-navigation').innerHTML = NAV_GROUPS.map((group) => `<section class="app-nav__group"><h2 class="app-nav__label">${group.label}</h2>${group.items.map((item) => item.view
    ? `<a class="app-nav__link" href="#${item.view}" data-view="${item.view}"><span class="app-nav__icon">${icon(item.icon)}</span><span class="app-nav__text">${item.label}</span></a>`
    : `<span class="app-nav__link" aria-disabled="true"><span class="app-nav__icon">${icon(item.icon)}</span><span class="app-nav__text">${item.label}</span></span>`).join('')}</section>`).join('')
}

function monthFilterCard() {
  return `<div class="overview-filter-card overview-filter-card--month">
    <span class="overview-filter-card__trigger">${icon('calendar')}<span class="overview-filter-card__copy"><small>月份</small><select class="proto-filter-select" data-filter="month" aria-label="月份">${MONTHS.map((month) => `<option value="${month}" ${month === state.month ? 'selected' : ''}>${monthLabel(month)}</option>`).join('')}</select></span>${icon('down')}</span>
  </div>`
}
function cycleFilterCard() {
  return `<div class="overview-filter-card overview-filter-card--cycle">${icon('clock')}<span class="overview-filter-card__copy overview-filter-card__copy--cycle"><small>统计周期</small><select class="proto-filter-select" data-filter="cycle" aria-label="统计周期"><option value="6m" ${state.cycle === '6m' ? 'selected' : ''}>近6个月</option><option value="half" ${state.cycle === 'half' ? 'selected' : ''}>本半年度</option><option value="year" ${state.cycle === 'year' ? 'selected' : ''}>年度累计</option></select></span>${icon('down')}</div>`
}
function overviewFilterToolbar() {
  return `<section class="filter-toolbar analytics-filter-toolbar overview-filter-toolbar" aria-label="筛选条件"><div class="filter-toolbar__filters"><div class="analytics-page-controls">${monthFilterCard()}${cycleFilterCard()}</div></div></section>`
}
function teamFilterCard() {
  return `<div class="overview-filter-card proto-filter-card--team">${icon('team')}<span class="overview-filter-card__copy"><small>团队</small><select class="proto-filter-select" data-filter="team" aria-label="团队">${teams.map((team) => `<option value="${team.id}" ${team.id === state.team ? 'selected' : ''}>${team.name}</option>`).join('')}</select></span>${icon('down')}</div>`
}
function versionFilterCard() {
  return `<div class="overview-filter-card proto-filter-card--version">${icon('products')}<span class="overview-filter-card__copy"><small>版本</small><select class="proto-filter-select" data-filter="version" aria-label="版本"><option>全部版本</option><option>SCC 27.1.RC1</option><option>SCC 27.2.RC1</option></select></span>${icon('down')}</div>`
}

function pageHeader({ title, description, actions, note }) {
  return `<header class="page-header analytics-page-head">
    <div class="page-header__content"><h1 class="page-header__title">${title}${note ? noteMarker(note) : ''}</h1><p class="page-header__description">${description}</p></div>
    <div class="page-header__actions">${actions}</div>
  </header>`
}

function metricCard(metricKey, data, note = null) {
  const def = metricDefs[metricKey]
  const value = data.display ?? displayValue(metricKey, data.value)
  const unit = data.unit ?? (def.unit ?? '')
  const tone = deltaTone(data.delta)
  const delta = Number.isFinite(data.delta) ? `${tone === 'positive' ? '▲' : tone === 'negative' ? '▼' : ''}${deltaText(metricKey, data.delta)}` : '环比 —'
  return `<article class="metric-card" style="--metric-card-accent:${def.accent}">
    <div class="metric-card__heading"><span class="metric-card__icon" aria-hidden="true">${icon(def.icon)}</span><div class="metric-card__label">${def.name}${note ? noteMarker(note) : ''}</div><span class="metric-card__accessory" aria-hidden="true"><span class="metric-card__accessory-bars"><i></i><i></i><i></i></span></span></div>
    <div class="metric-card__value-row"><div class="metric-card__value">${value}${unit ? `<span class="metric-card__unit">${unit}</span>` : ''}</div><span class="metric-card__delta metric-card__delta--${tone}">${delta}</span></div>
    <p class="metric-card__comparison">${escapeHtml(data.comparison ?? '')}</p>
    <div class="metric-card__footer">${sparklineSvg(data.trend, def.name)}</div>
  </article>`
}

function scopeHeading(activityKey, scope, note) {
  const activity = activityDefs[activityKey]
  const coverage = (scope === 'cycle' ? activity.cycle : activity.monthly).coverage
  return `<div class="activity-scope"><div class="activity-scope__identity"><span class="activity-scope__dot" style="--scope-color:${activity.color}"></span><span class="activity-scope__name">${activity.label}${note ? noteMarker(note) : ''}</span><span class="activity-scope__source">${activity.source}</span></div><span class="activity-scope__coverage">${scope === 'cycle' ? '周期累计' : '本月'} ${coverage.total} 条 · AI 属性已维护 ${coverage.known}/${coverage.total}</span></div>`
}

function kpiGroup(activityKey, scope, note) {
  const activity = activityDefs[activityKey]
  const metrics = (scope === 'cycle' ? activity.cycle : activity.monthly).metrics
  return `${scopeHeading(activityKey, scope, note)}<div class="executive-kpi-grid">${Object.keys(metricDefs).map((key) => metricCard(key, metrics[key])).join('')}</div>`
}

function sourceTag(kind, label) {
  return `<span class="proto-source-tag proto-source-tag--${kind}">${escapeHtml(label)}</span>`
}

function trendCard(activityKey, metricKey) {
  const activity = activityDefs[activityKey]
  const metric = activity.monthly.metrics[metricKey]
  const def = metricDefs[metricKey]
  return `<article class="analytics-chart-card">
    <header class="analytics-chart-card__header"><div><h2>${activity.label} · ${def.name}</h2><p class="analytics-chart-card__description">近6个月 · 全公司</p></div><span class="proto-source-tag">${def.kind === 'percent' ? '比例' : def.kind === 'workload' ? '人天' : '数量'}</span></header>
    <div class="proto-chart proto-chart--trend">${lineSvg(metric.trend, { color: activity.color, percent: true, labels: MONTHS.map((month) => month.slice(5)) })}</div>
    <div class="proto-chart__legend"><span>${displayValue(metricKey, metric.value)}</span><span>较上月 <b style="color:${metric.delta >= 0 ? 'var(--color-success)' : 'var(--color-danger-foreground)'}">${deltaText(metricKey, metric.delta)}</b></span></div>
  </article>`
}

function lifecyclePanel() {
  const selected = lifecycle.find((item) => item.id === state.lifecycle) ?? lifecycle[0]
  const selectedColor = selected.activity === 'design' ? COLORS.blue : selected.activity === 'development' ? COLORS.green : COLORS.orange
  return `<section class="analytics-panel executive-lifecycle">
    <header class="analytics-panel__header"><div><h3 class="analytics-panel__title">研发关键环节${noteMarker(4)}</h3><p class="analytics-panel__description">四张需求角色卡按角色字段独立计算；测试两卡保留 FactRecord。</p></div><button class="proto-link-button" type="button" data-view="activities">查看研发活动</button></header>
    <div class="executive-lifecycle__list">${lifecycle.map((item) => {
      const itemColor = item.activity === 'design' ? COLORS.blue : item.activity === 'development' ? COLORS.green : COLORS.orange
      return `<button class="executive-lifecycle__item" type="button" data-lifecycle="${item.id}" aria-pressed="${item.id === selected.id}" title="来源：${item.source}">
        <span class="proto-lifecycle-icon" style="color:${itemColor}">${icon(item.activity === 'design' ? 'file' : item.activity === 'development' ? 'code' : 'test')}</span><strong>${item.name}</strong>
        ${item.empty ? '<span class="executive-lifecycle__source">目录未定义指标</span>' : `<span class="executive-lifecycle__metric"><small>渗透率</small><span class="executive-lifecycle__metric-result"><b>${pct(item.pen)}</b></span></span><span class="executive-lifecycle__metric"><small>提效</small><span class="executive-lifecycle__metric-result"><b>${pct(item.eff)}</b></span></span>`}
      </button>`
    }).join('')}</div>
    <div class="executive-lifecycle__detail">
      <div class="analytics-panel__header"><div><h3 class="analytics-panel__title">${selected.name} · 近六个月趋势</h3><p class="analytics-panel__description">${selected.source}${selected.records ? ` · ${selected.records} 条记录 · AI 状态已知 ${selected.known} 条` : ''}</p></div>${sourceTag(selected.sourceKind === 'fact' ? 'fact' : 'requirement', selected.source)}</div>
      ${selected.empty ? '<div class="feedback-state" role="status">目录仅定义执行数，没有渗透率或提效类型指标；不借用其他指标。</div>' : `<div class="executive-lifecycle__trend-grid">
        <article class="analytics-chart-card"><header class="analytics-chart-card__header"><div><h2>${selected.name} · AI需求渗透率</h2></div></header><div class="proto-chart proto-chart--lifecycle">${lineSvg(selected.trend, { color: selectedColor, percent: true, labels: MONTHS.map((month) => month.slice(5)) })}</div></article>
        <article class="analytics-chart-card"><header class="analytics-chart-card__header"><div><h2>${selected.name} · AI研发提效</h2></div></header><div class="proto-chart proto-chart--lifecycle">${lineSvg(selected.effTrend ?? trendFor(selected.eff, 'percent', 2), { color: COLORS.purple, percent: true, labels: MONTHS.map((month) => month.slice(5)) })}</div></article>
      </div>`}
    </div>
  </section>`
}

function teamMatrix() {
  const metricOrder = ['penetration', 'efficiency', 'covered', 'saved']
  const average = {
    design: activityDefs.design.monthly.metrics,
    development: activityDefs.development.monthly.metrics,
  }
  const averageDelta = { design: { penetration: .031, efficiency: .024, covered: 4, saved: 5.2 }, development: { penetration: .026, efficiency: .011, covered: 2, saved: 2.9 } }
  const cell = (metricKey, value, delta) => `<td class="proto-team-matrix__value">${displayValue(metricKey, value)}<span class="proto-matrix-delta ${deltaTone(delta) === 'positive' ? 'is-positive' : deltaTone(delta) === 'negative' ? 'is-negative' : ''}">${deltaText(metricKey, delta)}</span></td>`
  const header = `<thead><tr class="proto-group-row"><th rowspan="2">团队</th><th colspan="4" style="color:${COLORS.blue}">设计活动</th><th colspan="4" style="color:${COLORS.green}">开发活动</th></tr><tr>${metricOrder.map((key) => `<th>${metricDefs[key].name.replace('AI', '')}</th>`).join('')}${metricOrder.map((key) => `<th>${metricDefs[key].name.replace('AI', '')}</th>`).join('')}</tr></thead>`
  const averageCells = metricOrder.map((key) => cell(key, average.design[key].value, averageDelta.design[key])).join('') + metricOrder.map((key) => cell(key, average.development[key].value, averageDelta.development[key])).join('')
  const rows = teams.map((team) => `<tr class="${state.team === team.id ? 'team-matrix__row--selected' : ''}">
    <th scope="row"><button type="button" data-team="${team.id}" aria-pressed="${state.team === team.id}"><i style="--team-matrix-color:${team.color}"></i>${team.name}</button></th>
    ${metricOrder.map((key) => cell(key, team.design[key], team.design.delta[key])).join('')}${metricOrder.map((key) => cell(key, team.development[key], team.development.delta[key])).join('')}
  </tr>`).join('')
  return `<div class="team-matrix proto-team-matrix"><div class="team-matrix__scroll" role="region" aria-label="团队双活动指标矩阵，可横向滚动" tabindex="0"><table class="team-matrix__table" aria-label="团队双活动指标矩阵">${header}<tbody><tr class="team-matrix__row--average"><th scope="row">全公司均值</th>${averageCells}</tr>${rows}</tbody></table></div></div>`
}

function teamPreview() {
  const team = teams.find((item) => item.id === state.team) ?? teams[0]
  const cards = ['design', 'development'].flatMap((activityKey) => ['penetration', 'efficiency'].map((metricKey) => {
    const activity = activityDefs[activityKey]
    const value = team[activityKey][metricKey]
    const globalValue = activity.monthly.metrics[metricKey].value
    const trend = trendFor(value, 'percent', team.id.length + activityKey.length)
    const benchmark = trendFor(globalValue, 'percent', 2)
    return `<article class="analytics-chart-card"><header class="analytics-chart-card__header"><div><h2>${activity.label} · ${metricDefs[metricKey].name}</h2><p class="analytics-chart-card__description">近6个月 · 虚线为全公司</p></div></header><div class="proto-chart proto-chart--mini">${lineSvg(trend, { color: activity.color, benchmark, percent: true, grid: false })}</div><div class="proto-chart__legend"><span>${pct(value)}</span><span>全公司 ${pct(globalValue)}</span></div></article>`
  })).join('')
  return `<div class="executive-team-preview"><header><h3>${team.name} · 趋势预览</h3><button class="proto-link-button" type="button" data-view="team">查看团队详情 →</button></header><div class="executive-team-preview__charts">${cards}</div></div>`
}

function maturityPanel() {
  const columns = ['需求分析', 'SE设计', '开发设计', '编码', '检视']
  return `<section class="analytics-panel executive-maturity-section">
    <header class="analytics-panel__header"><div><h3 class="analytics-panel__title">成熟度</h3><p class="analytics-panel__description">${monthLabel(state.month)} · 0.0 为有效值；未评估留空。本期不随需求活动口径调整。</p></div><div class="executive-maturity-category"><button class="proto-segment is-active" type="button">关键研发活动</button><button class="proto-segment" type="button">通用研发能力</button></div></header>
    <div class="executive-maturity-grid">
      <section class="executive-maturity-block"><header><h3>团队成熟度矩阵</h3><p>人工评估，不从需求记录推导。</p></header><div class="maturity-matrix proto-maturity-table"><div class="maturity-matrix__scroll"><table class="maturity-matrix__table"><caption>团队成熟度矩阵</caption><thead><tr><th>团队</th>${columns.map((column) => `<th>${column}</th>`).join('')}</tr></thead><tbody>${maturityRows.map((row) => `<tr class="${row.average ? 'maturity-matrix__row--average' : ''}"><th>${row.team}</th>${row.values.map((value) => `<td class="maturity-matrix__cell--level-${Math.round(value)}">${value.toFixed(1)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></section>
      <section class="executive-maturity-block"><header><h3>领域整体成熟度画像</h3></header><div class="proto-radar">${radarSvg()}<div class="proto-radar__legend"><span><i></i>本期领域平均</span><span><i class="is-prior"></i>上期领域平均</span></div></div></section>
    </div>
  </section>`
}

function teamPerformancePanel() {
  return `<section class="analytics-panel executive-team-section">
    <header class="analytics-panel__header"><div><h3 class="analytics-panel__title">团队表现${noteMarker(5)}</h3><p class="analytics-panel__description">设计/开发各 4 列；点击团队行切换右侧预览。比例变化为 pp。</p></div><div class="executive-team-mode"><button class="proto-segment is-active" type="button">本月</button><button class="proto-segment" type="button">统计周期</button></div></header>
    ${teamMatrix()}
    ${teamPreview()}
  </section>`
}

function renderOverview() {
  const designCoverage = activityDefs.design.monthly.coverage
  const developmentCoverage = activityDefs.development.monthly.coverage
  return `<div class="analytics-page executive-overview">
    ${pageHeader({ title: '研发总览', description: '从全局视角掌握 AI 在研发各环节的应用成效与团队能力，驱动数据化决策。双活动独立口径，仅统计完成/已关闭记录。', actions: overviewFilterToolbar(), note: 2 })}
    <section class="analytics-section">
      <header class="analytics-section__header"><div><h2 class="analytics-section__title">月度核心成效 · ${monthLabel(state.month)}${noteMarker(1)}</h2></div><div class="analytics-section__action"><span class="executive-kpi-coverage">本月 设计 ${designCoverage.total} 条 · 开发 ${developmentCoverage.total} 条 · AI 属性已维护 ${designCoverage.known + developmentCoverage.known}/${designCoverage.total + developmentCoverage.total}</span></div></header>
      ${kpiGroup('design', 'month', 3)}
      ${kpiGroup('development', 'month', 9)}
    </section>
    <section class="analytics-section">
      <header class="analytics-section__header"><div><h2 class="analytics-section__title">周期整体成效 · ${cycleLabel()}（截至${monthLabel(state.month)}）</h2></div><div class="analytics-section__action"><span class="executive-kpi-coverage">周期口径 · 仅完成/已关闭 · 设计/开发分别累计</span></div></header>
      ${kpiGroup('design', 'cycle')}
      ${kpiGroup('development', 'cycle')}
    </section>
    <div class="executive-analysis-grid">
      <section class="analytics-panel executive-overall-trend">
        <header class="analytics-panel__header"><div><h3 class="analytics-panel__title">核心趋势${noteMarker(5)}</h3><p class="analytics-panel__description">设计/开发 × 渗透率/提效，2×2 展示；不合并成单条曲线。</p></div><div class="benchmark-legend"><span class="proto-legend-dot" style="--dot:${COLORS.blue}"></span>设计活动 <span class="proto-legend-dot" style="--dot:${COLORS.green}"></span>开发活动</div></header>
        <div class="proto-trend-grid">${['design', 'development'].flatMap((activityKey) => ['penetration', 'efficiency'].map((metricKey) => trendCard(activityKey, metricKey))).join('')}</div>
      </section>
      ${lifecyclePanel()}
    </div>
    <div class="executive-final-grid">
      ${maturityPanel()}
      ${teamPerformancePanel()}
    </div>
  </div>`
}

function roleKpis(item, scope) {
  const isCycle = scope === 'cycle'
  const pen = isCycle ? item.cyclePen : item.pen
  const eff = isCycle ? item.cycleEff : item.eff
  const ai = isCycle ? item.cycleAi : item.ai
  const saved = isCycle ? item.cycleSaved : item.saved
  return {
    penetration: { value: pen, delta: isCycle ? .012 : .027, comparison: `${isCycle ? '周期累计' : '本月'} · AI 状态 ${item.known}/${item.records}`, trend: trendFor(pen, 'percent', 2) },
    efficiency: { value: eff, delta: isCycle ? .008 : .018, comparison: `AI 辅助 ${ai} 条`, trend: trendFor(eff, 'percent', 3) },
    covered: { value: ai, delta: isCycle ? 4 : 2, comparison: '该角色 AI 使用记录', trend: trendFor(ai, 'count', 4) },
    saved: { value: saved, delta: isCycle ? 3.2 : 1.4, comparison: '该角色节省人天', trend: trendFor(saved, 'workload', 5) },
  }
}

function factKpis(item) {
  if (item.empty || !item.fact) return null
  const fact = item.fact
  return {
    penetration: { value: fact.pen, delta: .021, comparison: 'FactRecord 活动事实', trend: fact.trendPen },
    efficiency: { value: fact.eff, delta: .012, comparison: 'FactRecord 活动事实', trend: fact.trendEff },
    covered: { value: fact.covered, delta: 18, comparison: 'FactRecord 原始量', trend: trendFor(fact.covered, 'count', 2) },
    saved: { value: fact.saved, delta: 1.8, comparison: 'FactRecord 节省工作量', trend: trendFor(fact.saved, 'workload', 3) },
  }
}

function activityKpiGrid(item, scope) {
  const data = item.kind === 'requirement' ? roleKpis(lifecycle.find((entry) => entry.id === item.lifecycleId), scope) : factKpis(item)
  if (!data) return '<div class="feedback-state" role="status">该活动目录未定义渗透率/提效指标；仅保留执行数原始事实。</div>'
  return `<div class="activity-outcome-grid">${Object.keys(metricDefs).map((key) => metricCard(key, data[key])).join('')}</div>`
}

function coverageRow(activityKey) {
  const activity = activityDefs[activityKey]
  const coverage = activity.monthly.coverage
  const unknown = Math.max(0, coverage.total - coverage.known)
  const knownNot = Math.max(0, coverage.known - coverage.ai)
  return `<div class="proto-coverage-row"><span class="proto-coverage-row__label">${activity.label}</span><div class="proto-coverage-bar" role="img" aria-label="${activity.label} AI 属性覆盖"><i class="seg-ai" style="width:${(coverage.ai / coverage.total) * 100}%"></i><i class="seg-known" style="width:${(knownNot / coverage.total) * 100}%"></i><i class="seg-unknown" style="width:${(unknown / coverage.total) * 100}%"></i></div><span class="proto-coverage-row__numbers">${coverage.ai} 已辅助 · ${knownNot} 已维护未辅助 · ${unknown} 未知</span></div>`
}

function rawSummaryTable() {
  return `<table class="activity-raw-summary-table" aria-label="原始指标月度摘要"><thead><tr><th>原始指标</th><th>本月数值</th><th>上月数值</th><th>环比变化</th><th>趋势</th></tr></thead><tbody>${pageSummary.raw.map((row) => {
    const delta = row.value - row.previous
    return `<tr><th title="${escapeHtml(row.source)}">${row.label}</th><td>${count(row.value)}</td><td>${count(row.previous)}</td><td class="${delta >= 0 ? 'is-positive' : 'is-negative'}">${delta > 0 ? '+' : ''}${count(delta)}</td><td><div class="proto-raw-spark">${lineSvg(row.trend, { width: 90, height: 20, color: row.label.includes('开发') ? COLORS.green : row.label.includes('设计') ? COLORS.blue : COLORS.orange })}</div></td></tr>`
  }).join('')}</tbody></table>`
}

function renderActivities() {
  const selected = activityItems.find((item) => item.id === state.activity) ?? activityItems[0]
  const selectedLifecycle = selected.lifecycleId ? lifecycle.find((item) => item.id === selected.lifecycleId) : null
  const sourceColor = selected.kind === 'requirement' ? (selectedLifecycle?.activity === 'design' ? COLORS.blue : COLORS.green) : COLORS.orange
  const trend = selected.kind === 'requirement' ? { pen: selectedLifecycle.trend, eff: selectedLifecycle.effTrend } : selected.fact ? { pen: selected.fact.trendPen, eff: selected.fact.trendEff } : null
  return `<div class="analytics-page executive-overview">
    ${pageHeader({ title: `研发活动 / ${selected.name}`, description: '按活动查看月度与统计周期成效、团队趋势和团队差异；四角色换源，测试/DTS 保留 FactRecord。', actions: overviewFilterToolbar(), note: 6 })}
    <div class="activity-upper-grid">
      <nav class="analytics-directory analytics-directory--vertical analytics-directory--panel activity-directory" aria-label="活动分析"><header class="analytics-directory__header"><h2>活动分析</h2><span>${activityItems.length} 项</span></header>${activityItems.map((item) => `<button class="analytics-directory__item" type="button" data-activity="${item.id}" aria-pressed="${item.id === selected.id}"><span class="analytics-directory__label">${icon(item.icon)}<span class="analytics-directory__label-text">${item.name}<span class="proto-directory-meta">${item.meta}</span></span></span></button>`).join('')}</nav>
      <div class="analytics-workspace activity-workspace">
        <div class="proto-activity-banner"><div><div class="proto-activity-banner__title">${selected.name}${noteMarker(6)}</div><div class="proto-activity-banner__description">${selected.kind === 'requirement' ? '仅完成/已关闭 · 角色级渗透率与提效 · 与总览环节卡同源' : selected.empty ? '目录未定义渗透率/提效指标' : 'FactRecord 活动事实 · 不进入需求双活动 KPI'}</div></div><div class="proto-activity-banner__badges">${sourceTag(selected.kind === 'requirement' ? 'requirement' : 'fact', selected.source)}${selected.kind === 'requirement' ? sourceTag('requirement', selectedLifecycle.activity === 'design' ? '设计活动' : '开发活动') : ''}</div></div>
        <section class="analytics-section"><header class="analytics-section__header"><div><h2 class="analytics-section__title">月度核心成效 · ${monthLabel(state.month)}</h2></div><div class="analytics-section__action"><span class="executive-kpi-coverage">${selected.kind === 'requirement' ? '角色级指标 · 只使用该角色字段' : 'FactRecord 指标 · 来源见页头'}</span></div></header>${activityKpiGrid(selected, 'month')}</section>
        <section class="analytics-section"><header class="analytics-section__header"><div><h2 class="analytics-section__title">周期整体成效 · ${cycleLabel()}（截至${monthLabel(state.month)}）</h2></div></header>${activityKpiGrid(selected, 'cycle')}</section>
        <section class="analytics-section"><header class="analytics-section__header"><div><h2 class="analytics-section__title">核心趋势</h2><p class="analytics-section__description">${selected.kind === 'requirement' ? '该角色 AI 需求渗透率与 AI 研发提效；不跨角色平均。' : 'FactRecord 同指标趋势。'}</p></div></header>${trend ? `<div class="activity-trend-grid"><article class="analytics-chart-card"><header class="analytics-chart-card__header"><div><h2>${selected.name} · AI需求渗透率</h2><p class="analytics-chart-card__description">来源：${selected.source}</p></div></header><div class="proto-chart proto-chart--activity">${lineSvg(trend.pen, { color: sourceColor, percent: true, labels: MONTHS.map((month) => month.slice(5)) })}</div></article><article class="analytics-chart-card"><header class="analytics-chart-card__header"><div><h2>${selected.name} · AI研发提效</h2><p class="analytics-chart-card__description">来源：${selected.source}</p></div></header><div class="proto-chart proto-chart--activity">${lineSvg(trend.eff, { color: COLORS.purple, percent: true, labels: MONTHS.map((month) => month.slice(5)) })}</div></article></div>` : '<div class="feedback-state" role="status">该活动没有可展示的渗透率/提效趋势。</div>'}</section>
      </div>
    </div>
    <div class="activity-page-summary">
      <section class="analytics-panel activity-team-matrix"><header class="analytics-panel__header"><div><h3 class="analytics-panel__title">团队差异${noteMarker(5)}</h3><p class="analytics-panel__description">页面级 8 列矩阵；不随左侧活动选择或单周期选择变化。</p></div></header>${teamMatrix()}</section>
      <div class="activity-lower-grid">
        <section class="analytics-panel"><header class="analytics-panel__header"><div><h3 class="analytics-panel__title">AI 属性覆盖</h3><p class="analytics-panel__description">页面级 · 设计/开发并排</p></div></header><div class="proto-coverage-stack">${coverageRow('design')}${coverageRow('development')}</div><div class="proto-coverage-legend" style="margin-top:10px"><span><i style="background:${COLORS.blue}"></i>AI 已辅助</span><span><i style="background:#84adff"></i>已维护未辅助</span><span><i style="background:var(--color-border-strong)"></i>AI 属性未知</span></div></section>
        <section class="analytics-panel"><header class="analytics-panel__header"><div><h3 class="analytics-panel__title">AI提效工作量趋势${noteMarker(7)}</h3><p class="analytics-panel__description">设计/开发两条独立线</p></div><div class="benchmark-legend"><span class="proto-legend-dot" style="--dot:${COLORS.blue}"></span>设计 <span class="proto-legend-dot" style="--dot:${COLORS.green}"></span>开发</div></header><div class="proto-chart proto-chart--summary">${multiLineSvg([{ values: pageSummary.workload.design, color: COLORS.blue }, { values: pageSummary.workload.development, color: COLORS.green }], { labels: MONTHS.map((month) => month.slice(5)) })}</div><div class="proto-chart__legend"><span>设计 ${workload(pageSummary.workload.design.at(-1))} 人天</span><span>开发 ${workload(pageSummary.workload.development.at(-1))} 人天</span><span>（示意数据）</span></div></section>
        <section class="analytics-panel"><header class="analytics-panel__header"><div><h3 class="analytics-panel__title">原始指标摘要 · ${monthLabel(state.month)}${noteMarker(7)}</h3><p class="analytics-panel__description">四项 · 仅完成/已关闭</p></div></header>${rawSummaryTable()}</section>
      </div>
    </div>
  </div>`
}

function teamKpiGroup(activityKey, scope = 'month') {
  const team = teams.find((item) => item.id === state.team) ?? teams[0]
  const activity = activityDefs[activityKey]
  const values = team[activityKey]
  const benchmark = (scope === 'cycle' ? activity.cycle : activity.monthly).metrics
  const data = Object.fromEntries(Object.keys(metricDefs).map((key) => {
    const kind = metricDefs[key].kind
    const value = scope === 'cycle' && kind !== 'percent' ? values[key] * 1.25 : values[key]
    return [key, {
      value,
      delta: value - benchmark[key].value,
      comparison: `全公司均值 ${displayValue(key, benchmark[key].value)}`,
      trend: trendFor(value, kind, team.id.length + activityKey.length + (scope === 'cycle' ? 2 : 0)),
    }]
  }))
  return `${scopeHeading(activityKey, scope)}<div class="executive-kpi-grid">${Object.keys(metricDefs).map((key) => metricCard(key, data[key])).join('')}</div>`
}

function renderTeam() {
  const team = teams.find((item) => item.id === state.team) ?? teams[0]
  const charts = ['design', 'development'].flatMap((activityKey) => ['penetration', 'efficiency'].map((metricKey) => {
    const activity = activityDefs[activityKey]
    const value = team[activityKey][metricKey]
    const globalValue = activity.monthly.metrics[metricKey].value
    return `<article class="analytics-chart-card"><header class="analytics-chart-card__header"><div><h2>${activity.label} · ${metricDefs[metricKey].name}</h2><p class="analytics-chart-card__description">${team.name} · 虚线为全公司均值</p></div></header><div class="proto-chart proto-chart--trend">${lineSvg(trendFor(value, 'percent', team.id.length + activityKey.length), { color: team.color, benchmark: trendFor(globalValue, 'percent', 2), percent: true, labels: MONTHS.map((month) => month.slice(5)) })}</div><div class="proto-chart__legend"><span>${team.name} ${pct(value)}</span><span>全公司 ${pct(globalValue)}</span></div></article>`
  })).join('')
  return `<div class="analytics-page executive-overview">
    ${pageHeader({ title: `${team.name} · 团队下钻`, description: '整体表现改为设计/开发两组 KPI；版本筛选同时作用于两个活动，领域参照仍为同时间范围、不限版本的有值团队等权均值。', actions: `<section class="filter-toolbar analytics-filter-toolbar overview-filter-toolbar" aria-label="筛选条件"><div class="filter-toolbar__filters"><div class="analytics-page-controls">${versionFilterCard()}${monthFilterCard()}${cycleFilterCard()}<button class="proto-link-button" type="button" data-view="overview">返回总览</button></div></div></section>`, note: 8 })}
    <section class="analytics-section"><header class="analytics-section__header"><div><h2 class="analytics-section__title">月度核心成效 · ${monthLabel(state.month)}${noteMarker(10)}</h2><p class="analytics-section__description">设计/开发各 4 项 KPI；主值为当前团队，比较值为全公司均值。</p></div><div class="analytics-section__action"><span class="executive-kpi-coverage">版本：全部版本 · 领域参照不限版本</span></div></header>${teamKpiGroup('design', 'month')}${teamKpiGroup('development', 'month')}</section>
    <section class="analytics-section"><header class="analytics-section__header"><div><h2 class="analytics-section__title">周期整体成效 · ${cycleLabel()}（截至${monthLabel(state.month)}）</h2><p class="analytics-section__description">比例/提效为周期差，数量/工作量为周期贡献；当前团队与全公司均值并列。</p></div></header>${teamKpiGroup('design', 'cycle')}${teamKpiGroup('development', 'cycle')}</section>
    <div class="executive-analysis-grid"><section class="analytics-panel executive-overall-trend"><header class="analytics-panel__header"><div><h3 class="analytics-panel__title">核心趋势</h3><p class="analytics-panel__description">设计/开发 × 渗透率/提效；虚线为全公司均值。</p></div></header><div class="proto-trend-grid">${charts}</div></section>${lifecyclePanel()}</div>
    <div class="executive-final-grid"><section class="analytics-panel executive-maturity-section"><header class="analytics-panel__header"><div><h3 class="analytics-panel__title">成熟度画像</h3><p class="analytics-panel__description">独立人工评估，本期不随需求活动口径调整。</p></div><span class="proto-source-tag proto-source-tag--fact">本期不调整</span></header><div class="feedback-state" role="status">成熟度矩阵与雷达保持现有实现；此处仅占位说明范围边界。</div></section><section class="analytics-panel executive-team-section"><header class="analytics-panel__header"><div><h3 class="analytics-panel__title">版本范围说明</h3><p class="analytics-panel__description">当前团队按所选版本；参照不限版本。</p></div></header><div class="feedback-state" role="status">当前团队值按版本过滤；领域参照取相同时间范围、相同活动、所有团队且不限版本的有值团队等权均值。无匹配事实保持缺失。</div></section></div>
  </div>`
}

function renderNotes(activeId = null) {
  document.getElementById('review-notes').innerHTML = notes.map((note) => `<article class="review-note ${activeId === note.id ? 'is-active' : ''}" data-note-id="${note.id}"><div class="review-note__head"><span class="review-note__number">${note.id}</span><span class="review-note__title">${note.title}</span></div><p>${note.text}</p><p class="review-note__ask">请确认：${note.ask}</p></article>`).join('')
}

function renderSpec() {
  return `<div class="spec-grid">
    <section class="spec-block"><h3>已锁定口径</h3><ul><li>设计/开发双活动独立计算，不跨活动相加。</li><li>同屏分组展示，不使用设计/开发切换器。</li><li>只纳入进展为完成/已关闭的记录。</li><li>计数单位为活动记录，不按需求编号跨活动去重。</li><li>渗透率分母为 AI 使用状态已维护的记录。</li></ul></section>
    <section class="spec-block"><h3>页面范围</h3><ul><li>总览：双活动 KPI、2×2 趋势、8 列团队矩阵、团队预览。</li><li>活动页：四角色换源；测试/DTS 保留 FactRecord；下方汇总双活动。</li><li>团队下钻：双活动整体表现、趋势与版本筛选。</li><li>成熟度、能力页、指标详情、需求管理页不在本次调整范围。</li></ul></section>
    <section class="spec-block spec-wide"><h3>四个需求角色映射</h3><table><thead><tr><th>环节卡</th><th>来源</th><th>AI 字段</th><th>工作量字段</th><th>时间</th></tr></thead><tbody><tr><td>SA设计</td><td>设计活动</td><td><code>sa_ai_assisted</code></td><td>SA 预估 / 实际</td><td>设计时间</td></tr><tr><td>SE设计</td><td>设计活动</td><td><code>se_ai_assisted</code></td><td>SE 预估 / 实际</td><td>设计时间</td></tr><tr><td>开发设计</td><td>开发活动</td><td><code>implementation_ai_assisted</code></td><td>实现设计预估 / 实际</td><td>开发时间</td></tr><tr><td>编码开发</td><td>开发活动</td><td><code>development_ai_assisted</code></td><td>开发预估 / 实际</td><td>开发时间</td></tr></tbody></table></section>
    <section class="spec-block"><h3>活动级 KPI 公式</h3><p>设计 AI 使用 = SA 或 SE 任一为“是”；开发 AI 使用 = 实现设计或开发任一为“是”。</p><div class="spec-code">渗透率 = AI使用为是 / AI状态已知<br>提效 = (预估合计 - 实际合计) / 实际合计<br>覆盖数 = AI使用为是的活动记录数<br>提效工作量 = 预估合计 - 实际合计</div><p class="tiny muted">实际值非正时沿用 0.5 人天分母回退；缺失不补零。</p></section>
    <section class="spec-block"><h3>角色级公式</h3><p>每张环节卡只使用该角色的 AI 状态和工作量字段，不跨角色合并；测试/DTS 卡继续使用 FactRecord。</p><div class="spec-code">SA/SE → 设计记录字段<br>实现设计/开发 → 开发记录字段<br>测试 → FactRecord · tcg-rate / tce-count</div></section>
    <section class="spec-block"><h3>原始摘要四项</h3><ul><li>AI覆盖设计活动需求数</li><li>AI覆盖开发活动需求数</li><li>测试用例生成数（tcg-rate 分子）</li><li>测试用例执行数（tce-count）</li></ul><p class="tiny muted">移除 AI覆盖IR/AR需求数、SE设计文档生成数、开发详细设计生成数。</p></section>
    <section class="spec-block"><h3>版本与权限</h3><ul><li>团队下钻版本筛选同时作用于设计/开发活动。</li><li>领域参照：同时间范围、同活动、所有团队、不限版本、有值团队等权。</li><li>maintainer 仅见绑定团队；admin 全量；viewer 只读。</li></ul></section>
    <section class="spec-block spec-wide"><h3>评审清单</h3><ul class="spec-checklist"><li>双活动 8 张 KPI 卡的首屏密度</li><li>2×2 趋势与 8 列矩阵的可读性</li><li>四张角色卡与测试两卡的来源标注</li><li>活动页两种来源是否清晰</li><li>原始摘要四项是否足够</li><li>团队下钻版本筛选双活动</li><li>开发活动空态文案</li><li>1920 / 1280 布局与横向滚动</li></ul></section>
    <section class="spec-block spec-wide"><h3>原型边界</h3><p>本原型复用现有 App shell、PageHeader、MetricKpiCard、AnalyticsPanel、TeamMatrix 和设计 token，数值为示意，不连接后端。生产实现仍需补齐后端活动/角色聚合、权限、测试和视觉基线。</p></section>
  </div>`
}

function renderCurrentView() {
  const targets = { overview: document.getElementById('view-overview'), activities: document.getElementById('view-activities'), team: document.getElementById('view-team') }
  Object.entries(targets).forEach(([key, element]) => element.classList.toggle('is-hidden', key !== state.view))
  if (state.view === 'overview') targets.overview.innerHTML = renderOverview()
  if (state.view === 'activities') targets.activities.innerHTML = renderActivities()
  if (state.view === 'team') targets.team.innerHTML = renderTeam()
  document.querySelectorAll('.app-nav__link[data-view]').forEach((item) => item.classList.toggle('is-active', item.dataset.view === state.view))
  document.querySelectorAll('.app-nav__link[data-view]').forEach((item) => {
    if (item.dataset.view === state.view) item.setAttribute('aria-current', 'page')
    else item.removeAttribute('aria-current')
  })
  const titles = { overview: '研发总览', activities: '研发活动', team: '团队详情' }
  document.getElementById('crumb-current').textContent = titles[state.view]
}
function setView(view) {
  if (!['overview', 'activities', 'team'].includes(view)) return
  state.view = view
  renderCurrentView()
  history.replaceState(null, '', `#${view}`)
  window.scrollTo?.({ top: 0, behavior: 'smooth' })
}
function openNotes(activeId = null) {
  document.body.classList.add('notes-on')
  renderNotes(activeId)
  const drawer = document.getElementById('review-drawer')
  drawer.classList.add('is-open')
  drawer.setAttribute('aria-hidden', 'false')
  if (activeId) drawer.querySelector(`[data-note-id="${activeId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}
function closeNotes() {
  const drawer = document.getElementById('review-drawer')
  drawer.classList.remove('is-open')
  drawer.setAttribute('aria-hidden', 'true')
}
function openSpec() {
  const modal = document.getElementById('spec-modal')
  document.getElementById('spec-content').innerHTML = renderSpec()
  modal.classList.add('is-open')
  modal.setAttribute('aria-hidden', 'false')
}
function closeSpec() {
  const modal = document.getElementById('spec-modal')
  modal.classList.remove('is-open')
  modal.setAttribute('aria-hidden', 'true')
}
let toastTimer = null
function toast(message) {
  const node = document.getElementById('toast')
  node.textContent = message
  node.classList.add('is-visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => node.classList.remove('is-visible'), 1800)
}
function handleClick(event) {
  const nav = event.target.closest('[data-view]')
  if (nav) { event.preventDefault(); setView(nav.dataset.view); return }
  const noteButton = event.target.closest('[data-note]')
  if (noteButton) { event.preventDefault(); openNotes(Number(noteButton.dataset.note)); return }
  const action = event.target.closest('[data-action]')
  if (action) {
    if (action.dataset.action === 'notes') openNotes()
    if (action.dataset.action === 'close-notes') closeNotes()
    if (action.dataset.action === 'spec') openSpec()
    if (action.dataset.action === 'close-spec') closeSpec()
    if (action.dataset.action === 'collapse') {
      const shell = document.getElementById('app-shell')
      const collapsed = shell.classList.toggle('app-shell--collapsed')
      action.setAttribute('aria-expanded', String(!collapsed))
      action.setAttribute('aria-label', collapsed ? '展开导航' : '折叠导航')
    }
    return
  }
  const activityButton = event.target.closest('[data-activity]')
  if (activityButton) { state.activity = activityButton.dataset.activity; renderCurrentView(); return }
  const lifecycleButton = event.target.closest('[data-lifecycle]')
  if (lifecycleButton) { state.lifecycle = lifecycleButton.dataset.lifecycle; renderCurrentView(); return }
  const teamButton = event.target.closest('[data-team]')
  if (teamButton) { state.team = teamButton.dataset.team; renderCurrentView(); return }
}
function handleChange(event) {
  const filter = event.target.closest('[data-filter]')
  if (!filter) return
  if (filter.dataset.filter === 'month') { state.month = filter.value; renderCurrentView(); toast('原型数据固定；筛选仅演示交互。') }
  if (filter.dataset.filter === 'cycle') { state.cycle = filter.value; renderCurrentView() }
  if (filter.dataset.filter === 'team') { state.team = filter.value; renderCurrentView() }
  if (filter.dataset.filter === 'version') toast(`已选择版本：${filter.value}（原型的版本筛选示意）`)
}
function handleHash() {
  const view = location.hash.replace('#', '')
  if (['overview', 'activities', 'team'].includes(view) && view !== state.view) { state.view = view; renderCurrentView() }
}
document.addEventListener('click', handleClick)
document.addEventListener('change', handleChange)
window.addEventListener('hashchange', handleHash)
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeNotes(); closeSpec() } })

const initialView = location.hash.replace('#', '')
if (['overview', 'activities', 'team'].includes(initialView)) state.view = initialView
renderShell()
renderCurrentView()
renderNotes()

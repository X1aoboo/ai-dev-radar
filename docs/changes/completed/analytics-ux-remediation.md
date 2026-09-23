# Analytics UX Gate Remediation

## Status
Completed

## Background

Phase 1/2 的复核发现共享布局与 Analytics 页面仍有可见缺陷。本记录限定整改范围，不恢复 Phase 3 Data Workbench 或后续页面重构。

## Requirement

- 只整改 Design Foundation 与 Overview、Activities、Capabilities、Team Drilldown、Metric Detail。
- 维持 React 19、Ant Design 6、ECharts 5、Vite、Sidebar + Topbar + Content，以及现有一级 IA、API、URL 筛选与权限。
- 不新建业务目标、指标、综合评分、跨指标排名或不同量纲的比较。
- 在 1440×900、1920×1080 和当前 2560×1215 环境复验宽度、滚动、图表、空状态和关键交互。

## Current Behavior

- `/analytics/activities` 与 `/analytics/capabilities` 共用 `.app-shell__content`。其 `overflow-x: hidden` 计算出 `overflow-y: auto`，但容器自身 `scrollHeight === clientHeight`；受控浏览器可以纵向滚到底，故“持续无法滚动”在本次基线中未稳定复现。此伪滚动祖先确实拦截 `position: sticky`：团队下钻滚动后目录离开视口。
- 仓库业务上下文定义 8 项关键研发活动与 7 项通用能力（共 15 个分析项），不是 15 项“关键活动”；活动页导航遵循真实 8 项目录，Team Drilldown 可导航两组共 15 项。
- Activities 在 1440/1920 使用 2 列趋势卡，但活动本身仍套外层背景、边框和内层成熟度/指标卡；没有活动导航。首个活动约 0.8k CSS px 高。
- 2025-01 无历史事实时，活动页不绘制图表，但无数值的指标卡仍约 181px 且没有明确无数据文案；未评估成熟度卡仍显示一排空指标格。
- 1920 下非首页内容受 1600px 主容器限制；Activities 页面内容为 1536px，Capabilities 工作区另限 1440px，Metric Detail 另限 1240px。2560 下活动页仍只有 1600/1536px 内容。首页则相反：2560 下 6 个数据点的核心趋势宽 2238px。
- 首页 Signal 在核心趋势之前；团队排名起始位置约 y=1062（1440）/ y=1066（1920），初始 viewport 看不到。Target 未配置说明占整宽表面。
- Team Drilldown 的两个 KPI 通过 `averageMetricValues` 对不同目录指标求平均，形成未在业务定义中确认的跨指标展示值。
- 共享主题的多数页面 CSS 已使用语义 token；但 `design/theme.js`、`charts/chartTheme.js` 与 `tokens.css` 存在重复色值，需复核实际 token owner 和漂移。

## Target Behavior

- 浏览器文档是 Analytics 的纵向滚动 owner；侧栏可独立滚动，活动目录和导航在文档滚动时 sticky 且不遮挡 Topbar。
- Dashboard 与 Analytics 使用 fluid canvas 和响应式 gutter，在 1920+ 通过网格安排内容，不以无限拉宽单张图表填充屏幕；Operational/Readable 容器策略有明确路由归属，但本次不迁移这些页面。
- Activities 用轻量活动导航和无外层卡片的分节布局；未评估、无历史数据、当前周期缺失和错误状态各自清楚、紧凑。
- Capabilities 使用流式目录 + 分析画布，成熟度、当前状态和演进清晰分层；时间趋势优先折线，布尔值保留状态列表。
- Overview 先呈现核心事实与单指标团队比较，再呈现生命周期、成熟度，Signal/问题位于下方；无业务 Target 时仅显示弱提示。
- Team Drilldown 的目录是真正的 section navigation；KPI 只引用单个现有指标或状态，不对多个指标求平均。
- Metric Detail 保持 Result → Comparison → Evidence，展示单指标团队分布/排名与事实依据；没有真实 Target 时不显示目标。

## Design

- `frontend/src/App.jsx` 按路由赋予 `dashboard`、`analytics`、`operational`、`readable` 容器模式，并保持 Sidebar、Topbar、URL 和路由行为。
- `frontend/src/app.css` 修正主内容的横向裁切与纵向滚动语义，落实 Dashboard/Analytics fluid gutter；复核 `.app-shell__content`、Sticky 祖先和高度约束。
- `frontend/src/analytics/AnalyticsPages.jsx`、`frontend/src/analytics/analytics.css`、共享 `frontend/src/design/design-system.css` 调整 Overview 排序/8:4 组合、活动导航、活动分节、能力工作区、跨路由 Filter Toolbar 和空状态；时间趋势统一使用折线。
- `frontend/src/drilldown/TeamDrilldownPage.jsx`、`frontend/src/drilldown/drilldownLogic.js`、`frontend/src/drilldown/drilldown.css` 去除跨指标 KPI 平均、修复活动目录 sticky/current state，并按需保持事实详情展开。
- `frontend/src/metricDetail/MetricDetailPage.jsx` 与 `frontend/src/analytics/analytics.css` 完成 fluid Result/Comparison/Evidence 组合及单指标团队分布。
- `frontend/src/design/tokens.css`、`frontend/src/design/theme.js`、`frontend/src/charts/chartTheme.js` 只在证据确认存在重复/漂移时调整；沿用现有语义 token，不新建第二套颜色系统。
- 不新增依赖；复用 `FilterToolbar`、`PageHeader`、`MetricCard`、`AnalyticsPanel`、现有 ECharts 与 Router。

## Business Impact

事实、`company_average` / `domain_summary`、成熟度、缺失值、布尔快照、排名和权限语义保持不变。团队 KPI 从未定义的跨指标平均改为单个目录指标/状态的原值与同指标变化，避免暗含新综合指标。

## Architecture Impact

仅前端表现层：`AppShell` 持有按路由选择的内容容器模式；浏览器文档负责 Analytics 纵向滚动，Sticky 导航不创建内部纵向滚动区。请求、目录、路由 owner 与图表数据映射不迁移。

## API / Contract Changes

NONE — 不改 API 请求、响应、URL 参数或权限契约。

## Data Changes

NONE — 不改持久化数据、指标目录、成熟度计算或原始事实。

## Compatibility

保留 248px/64px Sidebar、56px Topbar、680px 抽屉断点、既有导航和 URL filter state。Activity Navigator 只锚定已有活动；团队目录不新增或重排业务活动。

## Error & Boundary Handling

保留 loading/error/partial/no-data 状态并避免布局跳动。历史趋势缺失保持断点，当前周期无事实不回退、不补零；成熟度未评估明确标示且不渲染空图表。

## Risks & Trade-offs

- 移除 `.app-shell__content` 的纵向滚动祖先可能改变 sticky 基准；须对 Activities、Capabilities、Team Drilldown 三页逐页测到文档末尾。
- 首选单指标 KPI 需依赖现有目录项；若某类无可用指标，显示紧凑缺失态，不计算跨指标替代值。
- 2560px fluid canvas 可能拉宽单张图表；以 12 列组合和宽屏双列 metric grid 控制密度。
- 当前浏览器基线没有稳定复现文档被硬截断，不能将伪滚动祖先直接报告为已证实的截断根因；修复后仍需保留底部可达的实测证据。

## Test Strategy

- 前端 Node/Vitest 现有逻辑及渲染测试，补充 Activity Navigator、compact no-data、单指标 KPI、Overview 顺序和 Metric Detail 比较证据的针对性测试。
- `npm --prefix frontend run test:unit`、`npm --prefix frontend run build`、`npm run check:docs`、`npm run test:docs`、`git diff --check`。
- 真实浏览器 1440×900、1920×1080，并检查当前 2560×1215：五个 Analytics 页面、Activities/Capabilities/Team 实际滚到文档底部、活动导航、筛选 URL、指标切换、团队下钻、详情 Drawer、团队详情展开与返回焦点、无历史数据状态、页面/局部横向溢出、Sticky 覆盖与图表尺寸。
- 保存整改后五个页面截图用于视觉自检。

## Documentation Impact

- Business Design: UPDATE `docs/business/analytics.md` — 同步页面顺序、活动导航、成熟度/空状态和单指标 Team KPI 的事实语义。
- Architecture: UPDATE `docs/architecture/overview.md` — 同步 AppShell 容器模式、fluid Analytics canvas 与文档滚动 owner。
- Standards: NONE — 沿用现有 React、测试和无新依赖规范。
- ADR: NONE — 不改变已接受的业务、数据或架构决策。
- Design/UX Contract: UPDATE `DESIGN.md`、`UX-CONTRACT.md` — 同步 fluid canvas、稀疏 surface、活动导航、Sticky/滚动与 Analytics 状态模式。
- Change Design: CREATE 本 active 记录并更新 `docs/changes/active/README.md`；验收和当前文档同步后再移动至 `docs/changes/completed/` 并更新两个索引。

## Validation

Passed — `npm --prefix frontend run test:unit` (44 Node tests + 76 Vitest tests), `npm --prefix frontend run build`, `npm run check:docs`, `npm run test:docs`, and `git diff --check`. Production build retains the existing large Ant Design/ECharts chunk warnings. Strict `audit_project.py` completed with 0 findings. `designmd lint DESIGN.md` reported 0 errors and 7 orphaned-token warnings; manual review confirmed those roles map through canonical CSS variables and the Ant/ECharts adapters, covered by the token-drift test.

Real-browser checks covered Overview, Activities, Capabilities, Team Drilldown, and Metric Detail at 1440×900, 1920×1080, and 2560×1215; each has a saved screenshot in the local Codex artifact directory. The same five routes were measured at 1024×900 and 390×844 with no page-level horizontal overflow. Verified scroll-to-bottom/sticky section navigation, activity anchors and URL-backed filter/reset behavior, single-metric ranking navigation, capability selection, chart keyboard activation, Drawer Escape dismissal/focus restoration, and expanded team facts at the bottom of Team Drilldown.

The browser baseline did not stably reproduce a hard document-scroll lock. It did confirm the former `overflow-x: hidden` shell created an empty vertical scroll ancestor that broke sticky navigation; this is removed. Reduced-motion preference emulation and dedicated backend tests were not run; no backend/API contract changed.

# ai-dev-radar 全量 UX/UI 重构目标设计

## 0. 文档定位与优先级

本文件定义 ai-dev-radar 本轮全量 UX/UI 重构的目标体验、页面结构、视觉语言、数据表达和验收约束，用于指导 Codex 实施。

实现与验收时采用以下优先级：

1. **业务语义与指标口径**：以项目现有业务设计、API、指标定义及本文件中已明确的时间/聚合语义为最高优先级。
2. **本文件的 UX/UI 结构约束**：决定页面信息架构、布局、交互和可视化规则。
3. **已评审通过的效果图**：作为视觉完成度、页面构图、密度、层级和质感的附加验收基线。
4. 效果图中的样例数值、个别示例字段、个别菜单文字属于**示意数据**，不得覆盖真实产品语义。

已评审参考图：

- `reference/01-overview.png`：研发总览
- `reference/02-activity.png`：研发活动 / 开发设计
- `reference/03-capability.png`：研发能力 / MR代码检视
- `reference/04-team-detail.png`：团队详情 / Team A

## 1. 产品体验定位

产品定位为：**分析决策为核心，运营管理为支撑**。

主链路：

> 领域整体判断 → 研发环节/能力拆解 → 团队差异 → Team Drill-down → 指标/证据下钻

目标视觉：**Visual-forward Modern Analytics**。

不是传统蓝色企业 BI 大屏，也不是极简 SaaS。采用现代 Enterprise Analytics 的结构与视觉：灰白中性 Surface、清晰 Card 层级、较强的数据视觉表现力、稳定栅格、高信息密度但不拥挤。

核心体验原则：

- 页面要“满”，但不是堆砌；消除无信息价值的大面积留白。
- 先领域、后团队；领域内部先全局、后局部。
- 总览负责发现信号，详情负责解释信号。
- Dashboard 骨架稳定，无数据时保持布局并提供有意义的 Empty State。
- 同一指标的所有团队尽量在同一图中比较，不做“一团队一张图”的总览设计。
- 不把不同单位/不同语义指标合成为虚构的综合分数。

## 2. 目标设备与布局基线

### 2.1 设备范围

本轮为 Desktop Only。

- 主设计/验收：`1920×1080`
- 宽屏设计/验收：`2560×1440`
- 不以 `1440×900`、Tablet、Mobile 为本轮目标。

### 2.2 Analytics 宽度策略

Analytics 页面采用真正的 Fluid Layout：

- 不允许用固定 `max-width: 1400px` 一类方式锁死主内容区。
- 页面内容占满 Sidebar 之外的可用宽度。
- 宽屏增加图表有效绘图区、矩阵/表格可视范围和合理间距，而不是产生左右大面积空白。
- 采用 24 栅格或等价 CSS Grid；4 个 KPI 卡固定 `6 + 6 + 6 + 6`。
- 常规 Card gap 约 16px，Section gap 约 24px，页面 gutter 约 24–32px。

### 2.3 滚动所有权

**Browser Document 是唯一主纵向滚动容器。**

禁止在主内容区通过 `height: 100vh/calc(...) + overflow-y:auto/hidden` 建立第二套页面纵向滚动。

允许：

- Sidebar 固定。
- Topbar sticky。
- Team Detail / Activity / Capability 的轻量 Section Navigation sticky。
- 表格仅在列超宽时局部横向滚动。

禁止：

- Analytics Card 内部纵向滚动。
- 页面出现双纵向滚动条。
- Sticky 因错误 overflow ancestor 失效。
- 页面下方有内容却无法继续滚动。

## 3. App Shell 与导航

采用现代 Enterprise SaaS App Shell：

- 左侧 Sidebar 为主导航。
- Topbar 轻量，承担 Breadcrumb/搜索/用户/少量全局动作。
- Page Header 负责页面名称、说明、Global Filters。

导航分组：

- 分析：研发总览、研发活动、研发能力、团队详情。
- 数据：需求数据、成熟度评估及现有数据管理能力。
- 管理：团队与人员、产品与版本、指标定义、数据网关、数据采集、用户与权限等。

Sidebar 视觉规则：

- 轻量灰白背景。
- 选中项使用浅蓝 Surface + 明确品牌色文字/图标。
- Section Label 降低视觉权重。
- 避免传统后台的大面积深蓝色块。

## 4. Design System 策略

Ant Design 保留为基础交互 Primitive：Button、Input、Select、Table、Form、Drawer、Modal、Dropdown 等。

ai-dev-radar 自己负责产品级 Design System：

- AppShell
- PageHeader
- AnalyticsSection
- MetricKpiCard
- ChartCard
- TrendChart
- BenchmarkLegend
- Period/Month KPI Grid
- LifecycleOverview
- TeamMatrix
- MaturityMatrix
- AnalyticsDirectory
- Empty/Loading/Error State

**不得以“修改 Ant Design Theme Token、圆角、颜色”为完成 UX/UI 重构的判据。**

现有 `frontend/src/design/tokens.css`、`theme.js`、`chartTheme.js` 应升级为新的视觉语义源；避免业务页面出现新增散落 literal color。

## 5. 视觉语言

### 5.1 Surface

采用分层 Surface：

- App Background：极浅中性灰。
- Section：主要依靠标题、间距、栅格建立层级，不机械包 Card。
- Analytics Card：白色 + 极弱 Border + 柔和轻 Shadow。
- Selected/Hover：轻量抬升或描边，不使用强烈阴影。
- Operational Workbench：更扁平，Table/Filter 优先。

### 5.2 色彩

- UI Chrome：中性灰白 + 克制蓝青品牌色。
- Positive：绿色。
- Warning：琥珀色。
- Negative：红色。
- Data Visualization：允许蓝、青、绿、紫、橙等稳定系列色，有明确辨识度，不做“发灰”的保守图表。
- 领域平均：固定 Benchmark 视觉语义，不与任何团队颜色混淆。
- Team A/B/C/D 等团队色在全系统稳定。

### 5.3 Typography

至少建立四级数据层级：

- Page/Section Title
- Metric Label
- Primary Metric Value
- Delta / Comparison / Context

KPI 数字必须成为视觉主角，不能与普通正文同权重。

## 6. KPI Card 规范

统一 `MetricKpiCard` 结构：

- Metric name
- Primary value
- Unit
- Delta
- Comparison label
- Optional context
- Mini Sparkline / Mini Area Trend

Mini Trend 风格：

- 不显示 X/Y 轴、刻度、网格线。
- 使用有表现力的 2–3px 主线。
- 曲线下使用柔和 Area Fill / Gradient。
- 默认无密集 point symbol，Hover 时显示。
- 高度约占 Card 下部 25–35%。

### 6.1 顶部固定四个 KPI

默认四个：

1. AI需求渗透率
2. AI研发提效
3. AI覆盖需求数
4. AI提效工作量

不为了凑数量创造“AI研发需求占比”“AI研发工作量占比”等语义不清指标。

### 6.2 两行 KPI Grid

第一行：`月度核心成效 · <selectedMonth>`

第二行：`周期整体成效 · <selectedPeriod>（截至<selectedMonth>）`

两行使用完全一致的四列结构，但时间语义不同。

## 7. 时间与聚合语义

### 7.1 用户选择月份

“月度”始终指用户当前选择月份，不是自然当前月，也不判断“完整统计月”。

### 7.2 统计周期

周期选择采用管理周期预设，例如：

- 近6个月
- 上半年
- 下半年
- 全年

统计周期采用“**周期起点 → 用户选择月份**”的累计口径。

示例：

- 选择月份：2026-09
- 统计周期：2026下半年
- 月度数据：2026-09
- 周期累计：2026-07 ~ 2026-09

### 7.3 周期当月变化

绝对量（需求数、工作量）：

- 周期值 = 截至选择月累计值
- 当月变化 = 选择月份新增量

比例/提效类：

- 周期值 = 基于周期原始数据重新聚合计算
- 当月变化 = 截至选择月周期值 − 截至上月周期值

禁止直接对月度百分比做简单算术平均。

### 7.4 Sparkline 语义

月度 KPI：展示最近月份的月度原始指标趋势。

周期 KPI：展示周期累计结果随月份推进的累计演进。

## 8. 研发总览页面

总体叙事：**领域整体 → 领域局部 → 成熟度 → 团队**。

### 8.1 Header

Global Filters 仅放影响全页的条件：

- 月份
- 统计周期
- 版本

团队、研发环节、指标等属于 Local Analytical Controls，不堆在 Page Header。

### 8.2 月度/周期 KPI

两行四卡，参见第 6、7 节。

### 8.3 核心趋势

核心趋势为页面最重要的主图区域。

局部 Metric Tabs：

- AI需求渗透率
- AI研发提效
- AI覆盖需求数
- AI提效工作量

同一图展示：

- 领域平均
- Team A/B/C/D（实际团队）

交互：

- 默认所有团队可见。
- Hover/选择某团队时其余线降权。
- Legend 可显隐。
- Tooltip 展示当前值、领域平均、差值、变化。

### 8.4 研发关键环节

生命周期概览：

> 需求 → SE设计 → 开发设计 → 编码开发 → 代码检视 → 测试 →（按真实流程扩展）

每个环节同时展示两个核心维度：

- AI需求渗透率 + 变化
- AI研发提效 + 变化

不增加指标切换器，因为当前稳定只有两个核心统计维度。

选中一个环节后，下方两张趋势图左右并排：

- `<环节> · AI需求渗透率趋势`
- `<环节> · AI研发提效趋势`

两张图均展示领域平均 + 所有团队。

禁止把两个指标塞进双 Y 轴同图。

### 8.5 成熟度

左侧：成熟度矩阵/Heatmap，展示团队 × 成熟度维度，并包含领域平均。

右侧：领域整体 Radar，仅比较：

- 本期领域平均
- 上期/历史领域平均

Radar 不承担大量团队同时对比。

### 8.6 团队表现

团队区域提供局部 View Mode：`本月 | 统计周期`。

结构保持不变，只切数据语义。

团队矩阵列：

- AI需求渗透率
- AI研发提效
- AI覆盖需求数
- AI提效工作量

选中团队后，下方显示两张趋势预览：

- 当前团队 vs 领域平均：AI需求渗透率
- 当前团队 vs 领域平均：AI研发提效

提供 `查看团队详情 →`。

总览团队区域不再把“团队 + 研发环节热力条”揉在一起。

## 9. Team Drill-down

采用**单页分析故事线 + Sticky Section Navigation**：

- 整体表现
- 研发关键环节
- 成熟度画像

### 9.1 整体表现

两行四 KPI：月度 + 周期。

下方两张趋势图：

- Team X · AI需求渗透率 vs 领域平均
- Team X · AI研发提效 vs 领域平均

进入 Team Detail 后，不默认展示其他团队；当前团队是主角，领域平均是 Benchmark。

### 9.2 研发关键环节

横向 Lifecycle，每环节同时展示 AI需求渗透率 + AI研发提效。

选中环节后，两张趋势图：Team X vs 领域平均。

### 9.3 成熟度画像

矩阵/表格：当前 Team 本期/上期/领域平均。

Radar 最多三条：

- Team 本期
- Team 上期
- 领域平均

## 10. 研发活动页

采用“窄目录 + 右侧全宽 Analytics Workspace”。

左侧分析目录约 220–240px，只负责对象导航；右侧必须 `flex:1; min-width:0`，不得产生右侧无意义空白。

研发活动始终保持**领域视角**，不通过顶部 Team Selector 把页面变成团队详情。

页面语义：

- 月度/周期四 KPI
- AI需求渗透率趋势（领域平均 + 所有团队）
- AI研发提效趋势（领域平均 + 所有团队）
- 团队差异矩阵
- 指标拆解 / 业务量 / 原始指标证据

点击团队进入 Team Drill-down，并可定位到对应研发活动。

## 11. 研发能力页

与研发活动共享 Analytics Shell，但不机械复制业务内容。

能力页语义：

- 当前能力状态
- 能力演进
- 团队差异
- 支撑指标与证据
- 成熟度画像

对于 `MR代码检视` 等能力，实际指标必须来自既有指标定义/业务设计，不得为了视觉填充发明指标。

能力页面同样使用领域整体 + 所有团队的趋势分析；团队问题下钻至 Team Detail。

## 12. Analytics 图表统一规范

整体为 Visual-forward Modern Analytics：

- 主线 2.5–3px；普通系列略细。
- Grid line 极淡但可见。
- 主序列可使用柔和 Area Fill；不得给多团队全部铺面积导致遮挡。
- 点默认隐藏或弱化，Hover 时出现。
- 领域平均始终使用固定 Benchmark 样式。
- Tooltip 为结构化数据卡，不是 ECharts 默认 tooltip。
- Legend 紧凑，并支持系列显隐。
- Bar 可有轻圆角，避免 3D/Glow/重渐变。
- Radar 使用低透明度 fill，Series 数量严格控制。

团队颜色在全系统稳定，不能在不同页面重新分配。

## 13. Analytics 与 Operational 两套 Page Pattern

### Analytics Workspace

适用：研发总览、研发活动、研发能力、Team Drill-down、指标详情。

重点：看、比较、判断、下钻。

### Operational Workbench

适用：需求数据、成熟度维护、团队/产品/版本、指标定义、Gateway、采集、用户权限等。

结构：

> Page Header → Filter/Search → Table/Master-Detail → Pagination/Drawer

不要为了视觉统一给 CRUD 页面增加无决策价值的 KPI/图表。

两类 Pattern 共享同一 Design System、App Shell、Typography、Color、Button、Table、Drawer、Status State。

## 14. Empty / Loading / Error

Dashboard 骨架固定，不因缺数据重排页面。

- 核心模块无数据：保留容器，使用紧凑、有解释力的 Empty State。
- 不显示伪造 0。
- 不保留完全空白 Card。
- Loading 保持几何稳定，避免布局抖动。
- Error 在所属模块内给出可操作恢复提示。

正常态优先，Empty State 不得主导页面结构设计。

## 15. 已评审效果图作为附加视觉验收标准

通过评审的四张图用于检查：

- App Shell 是否达到同等级的现代感。
- 页面是否充分利用桌面宽屏。
- 是否形成稳定 Grid Rhythm。
- KPI 是否具有“大数字 + Delta + Mini Area Trend”的视觉表现。
- 图表是否具有足够的数据产品质感，而非默认 ECharts。
- Card/Section/Background 层级是否清楚。
- 页面是否“满而不乱”。
- Typography 是否具有明确数据层级。
- 相同页面 Pattern 是否保持视觉一致。

效果图不作为 Pixel Perfect 唯一标准；真实页面应在保留业务语义的前提下达到相同或更高的视觉完成度。

## 16. 工程与质量门禁

每个阶段至少执行：

- `npm --prefix frontend run test:unit`
- `npm --prefix frontend run build`
- `npm run check:docs`
- `npm run test:docs`
- `git diff --check`

浏览器验收：

- 1920×1080
- 2560×1440

核心检查：

- 页面无无意义大面积空白。
- Analytics 内容无固定窄宽容器。
- 4 KPI 同行完整填充。
- 月度/周期两排对齐。
- Chart 有效绘图区合理。
- 目录 + 工作区场景中右侧吃满剩余空间。
- 无页面级横向滚动。
- Document Scroll 可从顶部滚到底部。
- 无双纵向滚动。
- Sticky 行为正常。
- Tooltip/Legend 不溢出。
- 无 Card 高度异常、错位、截断。
- 1920 和 2560 两种尺寸均成立。

## 17. 分阶段实施

### Phase 0 — 现状审计与合同更新

- 审计现有页面布局、scroll owner、宽度约束、重复样式、图表主题。
- 更新 `UX-CONTRACT.md`，删除不再适用的 1440/1024/390 本轮验收要求，写入 Desktop-only 双基准。
- 将已评审效果图放入项目 `docs/ux/reference/`（或等价目录）并登记为视觉参考。
- 输出组件/页面改造清单，不改业务功能。

### Phase 1 — Design System + App Shell

- 重构 Token、Theme、Chart Theme。
- 重构 Sidebar / Topbar / Page Header / Surface / Typography / Spacing。
- 建立 Analytics 组件基元。
- 修复 Document Scroll 所有权。
- 不大规模改业务页内容，先完成统一壳层。

### Phase 2 — 研发总览

- 按第 8 节重构。
- 必要时补 Analytics 聚合 API/ViewModel。
- 用 `reference/01-overview.png` 做视觉验收。

### Phase 3 — 研发活动 + 研发能力

- 建立窄目录 + 全宽 Workspace。
- Activity/Capability 共享 Shell、不共享业务模板。
- 用 `reference/02-activity.png`、`reference/03-capability.png` 验收。

### Phase 4 — Team Drill-down + 指标详情

- 落地完整 Team Detail 故事线。
- 支持从 Overview/Activity/Capability 进入并携带上下文。
- 用 `reference/04-team-detail.png` 验收。

### Phase 5 — Operational Workbench

- 统一数据管理与系统管理页面。
- 保留业务行为、权限、API contract。
- 优化 Table、Filter、Drawer、Master-Detail、Status。

### Phase 6 — 全局视觉收敛与 E2E

- 全页面 1920/2560 截图巡检。
- 视觉问题修复循环。
- 完成功能 E2E + UX/UI 验收。
- 清理临时兼容 CSS 和重复样式。

## 18. 完成定义

只有同时满足以下条件，才算完成本轮全量 UX/UI 重构：

- 业务功能与指标口径正确。
- 所有目标页面遵守统一 Design System 和 Page Pattern。
- 通过功能测试/E2E。
- 通过 1920×1080 和 2560×1440 视觉验收。
- 与已评审效果图相比，在布局密度、层级、空间利用、数据视觉表现力方面达到同等级完成度。
- 不存在当前已知的“大面积无意义留白、排版错乱、页面无法下滚、窄内容区浪费宽屏”等问题。

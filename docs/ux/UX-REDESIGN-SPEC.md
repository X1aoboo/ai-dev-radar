# ai-dev-radar 全量 UX/UI 重构目标设计

## 0. 文档定位与优先级

本文件定义 ai-dev-radar 本轮全量 UX/UI 重构的目标体验、页面结构、视觉语言、数据表达和验收约束，用于指导 Codex 实施。

实现与验收时采用以下优先级：

1. **业务语义与指标口径**：以项目现有业务设计、API、指标口径及本文件中已明确的时间/聚合语义为最高优先级。
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
- Desktop Geometry Lock：展开侧栏 208–224px；Topbar 48–56px；1920px 页面左右 gutter 20–28px；Section gap 20–28px；Card gap 12–16px。内容必须流式占满侧栏后的空间，不设页面级 max-width。
- 禁止无业务意义的 32px 以上垂直空隙、空背景和卡片死空白。

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
- Page Title 26–30px/700；Description 13–14px；全局筛选在标题右侧组成紧凑选择器卡，每个控件包含 icon、小标签、当前值和 chevron。

导航分组：

- 分析：研发总览、研发活动、研发能力、团队详情。
- 数据：需求数据、成熟度评估及现有数据管理能力。
- 管理：团队与人员、产品与版本、指标字典、数据网关、数据采集、用户与权限等。

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

Page Title 26–30px/700，Section Title 18–20px/650–700，Card/Chart Title 13–15px/600–650，Primary KPI 30–36px/700，Delta 12–14px/600，Supporting Metadata 11–13px，Axis/Legend 11–12px。

Analytics Card 使用白色 surface、轻边框、柔和可见阴影和 10–14px radius；Section 靠标题、间距、栅格分层，不全部再包一层 Card。

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

KPI Card 高度 116–128px、padding 16–20px；迷你趋势高 28–42px，占内容宽度 35–45% 或横跨卡片底边。四张卡等宽、等高且主值基线一致。

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

月度 KPI 的变化按当前月与前月原始口径值之差计算；比例/提效差值以百分点表示，数量/工作量差值保持原单位。对比侧数据缺失时，变化保持缺失。

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

月份与统计周期使用已确认的横向紧凑选择器，控件主体可操作；每个控件内部的标签与选中值也水平排列并垂直对齐，不让周期标签悬在选择框上方。月份卡固定为 `172×42px`，选中月份与箭头之间至少留 `16px`；统计周期卡固定为 `194×42px`，标签与可见选中值至少间隔 `14px`，两者使用匹配的 `22px` 行高。打开周期菜单时完整显示所有选项文字，不以省略号截断。月份打开可键盘操作的 3×4 月份网格与年份切换；方向键移动，Enter 选择，Escape 关闭并恢复焦点。总览没有版本筛选；旧 `version` URL 参数不得继续过滤请求或数据。团队、研发环节、指标等属于 Local Analytical Controls，不堆在 Page Header。

### 8.2 月度/周期 KPI

两行四卡，参见第 6、7 节。

BR-03（用户 2026-09-30 明确要求）将 Overview 两行四卡高度由当前实测 120px 调整为 180px；两行同高、四列等宽。卡内图标、主值、变化说明和 sparkline 随高度重新分配，避免增加高度后留下空白；此为 Overview 页面级几何覆盖，不改变其他分析页的 116–128px KPI 基线。

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

核心趋势与研发关键环节左右并排，卡片顶部和底部对齐。BR-03 将核心趋势 host 高度从 R1 的 240/320px 调整为 360/480px；有效绘图区必须随 host 增大，不能以外框增高或空白垫高冒充图表增大。按已批准 BR-02，2560×1440 的真实绘图区仍可依视口高度扩展，不得按宽度拉高。

### 8.4 研发关键环节

生命周期概览：

> SA设计 → SE设计 → 开发设计 → 编码开发 → 测试用例生成 → 测试用例执行

六张卡直接显示这六个目录真实名称，不用“需求/测试 + 来源”别名替代。`MR代码检视`是研发能力页的独立通用能力；不向总览生命周期追加 DTS 或代码检视。缺少对应类型指标时保留缺失，趋势说明保留真实来源指标名。

每个环节同时展示两个核心维度：

- AI需求渗透率 + 变化
- AI研发提效 + 变化

不增加指标切换器，因为当前稳定只有两个核心统计维度。

选中一个环节后，下方两张趋势图左右并排：

- `<环节> · AI需求渗透率趋势`
- `<环节> · AI研发提效趋势`

两张图均展示领域平均 + 所有团队。

Overview 单活动图将同指标、各有事实团队值的算术平均显示为“领域平均”；接口仍来自 `company_average`，不得换成合并原始量的 `domain_summary`。图例及 Tooltip 与此标签一致。BR-09 将 ECharts grid top inset 设为 34px；Legend 与顶端 100% y 轴标签分行留白且不重叠，Trend host 保持原高并保留至少 60% 的有效绘图区。

禁止把两个指标塞进双 Y 轴同图。

研发关键环节标题、说明、活动小卡片和选中环节的两张趋势图属于同一张 Analytics 卡片；趋势模块须与核心趋势卡片顶部、底部对齐。BR-03 保持六张活动卡 92px 高，增大其图标与正文层级并减少指标文字与数值之间的无效空隙；两张趋势 host 由 105/200px 调整为 158/300px。

BR-04 R3（用户于 2026-09-30 重申问题仍存在）：六张 92px 环节卡与双趋势之间使用 `--space-3`（12px）间距，允许 ±4px；趋势卡纵向占满该面板卡片之后的可用内容高度，趋势卡 bottom inset 以面板 content-box bottom 量测，最大 12px。有效绘图区不得低于 host 高度的 60%；满/部分/空数据及六环节选择不应压缩或重排面板。

### 8.5 成熟度

左侧：成熟度矩阵/Heatmap，展示团队 × 成熟度维度，并包含领域平均。

矩阵下方展示与等级颜色一致的 1.0–5.0 色阶；若 0.0 是有效已评估分值，需单独标示该中性色块。未评估值不得并入任何等级。

右侧：领域整体 Radar，仅比较：

- 本期领域平均
- 上期/历史领域平均

Radar 不承担大量团队同时对比。

成熟度矩阵与领域 Radar 在同一张成熟度卡片中紧邻并排；Radar 直径占可用短边的 60–75%。成熟度说明放在卡片内，并与矩阵说明合并。矩阵下方保留 0.0 有效零分提示与 1.0–5.0 色阶。BR-03 将 Overview 内矩阵/Radar 宽度改为约 68/32：Radar 区域相对 R1 收窄 20%，释放的同一轨道宽度分给矩阵；矩阵、Radar 区域的有效高度和 maturity grid 至少比 R1 增加 50%。

BR-04 R3 将 gap-adjusted 矩阵/Radar 轨道调整为 61.2/38.8（矩阵相对当前 68% 轨道缩窄 10%，分母是去掉 16px 列间距后的可用网格宽度；雷达占剩余部分）。矩阵行、色阶和 Radar 图例/网格填入成熟度卡的内容高度；它们到成熟度面板 content-box bottom 的距离均不超过 12px。缩窄后保留全部八个现有维度，长标签可以换行但不得截断或重叠。

BR-05 R6（用户于 2026-10-01 指定）：将成熟度矩阵网格高度缩短至 R5 当前 Chromium 结果的 70%（允许 ±3 个百分点）：1920×1080 目标约 295px，2560×1440 目标约 462px。基线取 DOM CSS px，不按用户截图像素换算。保留 61.2/38.8 轨道、全部行与色阶、Radar 和图例；不得裁切表格或在下方留下额外空白。2560×1271 的当前窗口仅作补充诊断，目标约 377px，不纳入正式验收。

R7 对齐候选（已实现、尚未批准）：保留上述 70% 内容高度，同时恢复成熟度/团队外框底边对齐。因团队表格高度不变，该方案在成熟度网格、色阶和 Radar 图例下方分别形成约 67.72/78.72px 的面板内空隙，与 BR-04 的 ≤12px 内容底边距冲突。R7 固定数据 E2E 通过，证据见 `本机运行产物（临时）`；独立 Reviewer 对 UI-05F 给出 PASS 并关闭，对 UI-05E 给出 PARTIAL 且保持开放。不得把整个成熟度区或总览页标记为通过，直至成熟度底边距问题解决并由用户确认整页。

业务目录将 `MR代码检视` 定义为通用研发能力时，其成熟度只显示在“通用研发能力”模式；不得并入关键研发活动矩阵。

### 8.6 团队表现

团队区域提供局部 View Mode：`本月 | 统计周期`。

结构保持不变，只切数据语义。

团队矩阵列：

- AI需求渗透率
- AI研发提效
- AI覆盖需求数
- AI提效工作量

Reference 将标题和四个 Metric Tab 放在同一顶行，Tab 组紧接标题右侧；不得另起一行或把按钮组推到面板最右端。选中态按 Reference 保持清晰，切换指标只改变所选序列和对应单位。

Reference 的表现为团队名称列加四个 KPI 组；每组的数据行分别对齐显示指标值和变化，保留这两个独立语义，但不额外显示“指标值/变化”第二层可见表头。本月模式使用当前月对前月的变化；统计周期模式沿用第 7.3 节定义的周期变化口径。团队/均值缺少比较数据时显示缺失，`全公司均值` 的变化基于矩阵显示的等权团队均值计算。

选中团队后，趋势预览先显示一次团队名称和 `查看团队详情 →`，再并排显示两张等宽图表；图表标题只写对应指标名，图例分别说明所选团队和 `全公司均值`。业务口径保持为同一时间范围下有效团队的等权均值。

BR-03 将两张预览 host 相对 R1 加高 100%：1920×1080 从 75px 到 150px，2560×1440 从 198px 到 396px。团队表现表头字号从当前 12px 提至至少 14px；成熟度与团队表现卡片的上下边缘对齐。Reference 的紧凑结构保留。满、部分、空、Loading、Error 均保持同一卡片与绘图区几何；必要的额外页面高度由文档纵向滚动承载，不使用空白垫高。

BR-04 R3 在团队表格与预览标题之间增加 `--space-3`（12px）间距，允许 ±4px。两张预览使用剩余内容高度，host 至少保持 150/396px；若间距与底边合同要求更多高度，则自然增加下方面板高度，并与成熟度面板对齐。预览图组至团队面板 content-box bottom 不超过 12px；满/部分/空数据保持等高。

BR-05 R6（用户于 2026-10-01 指定）：两张 Team 预览的有效绘图 host 改为各自 R5 当前 Chromium 测量的 70%（允许 ±3 个百分点）：1920×1080 目标约 139px，2560×1440 目标约 277px；补充 2560×1271 目标约 221px。保持双图等高和表格至预览标题间距；数据状态不得压扁图或改变预览区块次序。R6 候选按两个 70% 高度目标布置并保持面板顶部对齐，外层底边在 1920×1080/2560×1440 分别相差 67.72/78.72px。这是 BR-04 底边对齐的总览例外，仍需用户对总览整页确认。

BR-08 R8（用户于 2026-10-01 指定）：Team 预览图在 R7 实测高度基础上再降低 30%，当前目标为 1920×1080 约 97px、2560×1440 约 194px；2560×1271 的 155px 仅作补充。成熟度矩阵随下方共享行可用高度伸展，矩阵色阶贴近面板内容底边；雷达 SVG 在右侧轨道水平居中。Team 图 ECharts 绘图区顶部留出 12px，确保 `100%` 刻度完整可见。四项 R8 leaves 与历史 UI-05C/UI-05E 已经独立 Reviewer 复验通过；BR-08 supersedes R6 的固定成熟度 70% 目标。满数据、部分数据、无数据、Loading、Error 的关键 bounding box 必须保持一致；不能以零值或跨指标数据填缺失。

R7 对齐候选（已实现、待总览验收）：恢复两张外框底边对齐，同时保持团队趋势图 70% 高度；团队面板无需扩张，成熟度内容的底部空隙对应实测为 67.72/78.72px。独立 Reviewer 已将 UI-04C（环节趋势间距/填充）、UI-05D（团队选择更新双趋势）、UI-05F（趋势高度）和 UI-06（数据状态几何）标为 PASS/closed；UI-05C/E 仍因成熟度内容底边距超出 ≤12px 而保持开放。

R7 结构审查补充：1920 Golden 团队表格高度为 147.22px，其中四个团队选择按钮各保持至少 24px 的点击目标；连同领域均值行和表头后，表格纵向压缩空间不足以回收 67.72px。不可通过将团队选择目标压到 24px 以下处理成熟度底部留白。UI-05C/E 等待下排结构方案或用户明确修订基线。

团队表现标题、说明、指标矩阵和选中团队趋势预览属于同一张 Analytics 卡片。表头按四项 KPI 分组；组内指标值与变化列分别对齐，但第二层子表头保持视觉隐藏，数值仍保留各自可访问标签。

总览团队区域不再把“团队 + 研发环节热力条”揉在一起。

## 9. Team Drill-down

采用**单页分析故事线 + Sticky Section Navigation**：

- 整体表现
- 研发关键环节
- 成熟度画像

页面标题与筛选控件位于同一页头区域：标题/团队上下文靠左，月份、统计周期和当前团队所属产品的版本筛选靠右，返回来源的操作随筛选控件保留在页头。不得把其他产品或 product-less legacy 版本列为该团队的具名候选；历史事实仍保留在“全部版本”结果中。Sticky section navigation 紧随页头，浏览器文档仍是唯一主纵向滚动容器。

### 9.1 整体表现

两行四 KPI：月度 + 周期。

缺少当前团队值时仍显示缺失说明，不绘制会被误读为当前值的平直迷你趋势。

下方两张趋势图：

- Team X · AI需求渗透率 vs 领域平均
- Team X · AI研发提效 vs 领域平均

进入 Team Detail 后，不默认展示其他团队；当前团队是主角，领域平均是 Benchmark。

三个故事线各由一张外层分析卡片承载，并把标题、说明和数据留在卡片内：整体表现卡包含两行四 KPI 与两张核心趋势图；研发关键环节卡包含活动选择和所选活动趋势；成熟度画像卡包含关键活动/通用能力矩阵与雷达。页面使用文档自然滚动；首屏不需要容纳所有分析内容，但已确认的桌面视觉基线要求成熟度画像标题在两个验收视口内出现，矩阵与雷达的完整内容仍可继续滚动。团队 KPI 卡用紧凑横向趋势布局，保留当前值、变化、等权基准和迷你趋势。

Team Drill-down 的 IR 聚合基准标为“有数据团队等权均值”；FactRecord 环节趋势基准标为“有事实团队等权均值”。当只有一个团队有值时，明确说明暂不可进行多团队对照，不补造团队值。

选中具体版本时，当前团队 IR 值按版本过滤；领域参照取相同时间范围、相同指标、所有团队且不限版本的既有等权均值。页面明确标出两个范围，只呈现当前团队与领域参照的差异，不展示其他团队，也不称为同版本排名。切换版本不能改变用户所选时间范围；该版本无当前范围事实时保持缺失。

当前团队与领域参照分别报告请求状态：两者都失败时明确两者均不可用；只有领域参照失败且当前团队请求成功时，才说明当前团队值仍保留。Loading、Empty、Error 只替换对应内容，保留既定组件几何，缺失值不补零。错误提示使用简洁、可操作的通用文案，不在指标卡或图表中显示原始服务端/传输异常详情或测试夹具文字。

Team Detail 的页面级紧凑几何只作用于该页：1920×1080 与 2560×1440 下，整体趋势 host 为 `133px`、有效绘图区至少 `80px`；研发关键环节趋势 host 为 `120px`、有效绘图区至少 `70px`。外层面板垂直 padding 与故事区间距均为 `6px`，卡片与趋势图之间保留独立间距。成熟度画像标题在 1920×1080 的 `y≤1040px`、2560×1440 的 `y≤1400px` 进入首屏，矩阵和雷达主体由自然滚动承载。满/部分/空/Loading/Error 状态保持相同卡片、图表、矩阵与雷达几何；不补零，也不把参考图中的示例关键发现当作业务文案。

### 9.2 研发关键环节

横向 Lifecycle，每环节同时展示 AI需求渗透率 + AI研发提效。

选中环节后，两张趋势图：Team X vs 领域平均。

### 9.3 成熟度画像

矩阵/表格：当前 Team 本期/上期/领域平均。

Radar 最多三条：

- Team 本期
- Team 上期
- 领域平均

关键研发活动与通用研发能力通过卡片内切换选择，一次只展示一组矩阵和对应雷达；默认关键研发活动。两类成熟度仍可完整访问，避免将两组宽表和雷达纵向重复堆叠。

## 10. 研发活动页

采用“活动分析目录卡 + 右侧上方活动工作区”，再接全宽页面级汇总区。左侧目录约 210–230px；目录卡高度与上方 KPI/核心趋势组合对齐，底部不得继续延伸到 Team Difference 区。每个活动项左侧显示同一 SVG 图标系统的小图标，名称和键盘/ARIA 选择语义保持不变。

上方选择具体 Activity，只改变该 Activity 的月度/统计周期 FactRecord KPI 和两张同指标趋势；活动页始终保持领域视角，不通过顶部 Team Selector 把页面变成团队详情。活动页不提供跨团队版本/迭代筛选；原有时间事实跨版本纳入所选时间范围。

月份与统计周期卡的可见箭头必须可操作：统计周期和粒度的箭头由 Ant Design Select 自身绘制，并与完整 Select 共享至少 `24×24px` 的可操作区域；不得使用独立窄箭头按钮。点击月份箭头打开贴近控件且处于视口内的月份选择器，点击统计周期箭头打开周期选项；键盘同样可以打开和选择，焦点可见并在关闭后保留。Select 菜单是临时浮层，打开时不推动页面重排，可以覆盖背景内容，但触发器保持可见、全部选项完整可读。打开不应提前改变值，提交选项才更新既有 URL、请求与页面数据口径。

下方全宽 Team Difference、指标拆解、AI提效工作量趋势和原始指标摘要是页面级整体视图，不受上方 Activity 选择、活动指标或活动周期筛选影响，只跟随页面月份/统计周期。Team Difference 使用现有四项全局 IR KPI 的团队序列和有效团队等权均值，不跨活动平均 FactRecord。指标拆解按整体 IR 的 AI 辅助/已维护未辅助/AI 属性未知数量显示。工作量趋势使用整体 IR `AI提效工作量`，蓝色柱图叠加绿色同比增长率，按本月与去年同月计算；没有去年同期事实或去年同期工作量非正时保留断点。

原始指标摘要固定显示六项：AI覆盖IR需求数、AI覆盖AR需求数、SE设计文档生成数、开发详细设计生成数、测试用例生成数、测试用例执行数。AI覆盖IR需求数取现有 IR 映射；测试用例生成数取 `tcg-rate` 原始分子并显示真实来源指标名；测试用例执行数取目录 `tce-count`。AR 唯一覆盖数、SE 文档数、开发详细设计数目前无目录定义；名称保留，数值保持缺失，直到其数据和去重口径被定义。`company_average` 与 `domain_summary` 不互换。

两行四 KPI 和两张核心趋势卡仍按已有 Activity Reference 结构展示；下方三个总结卡使用等高三列。卡片最小高度从当前基线增加约 30%，目标为 1920×1080 的 226px、2560×1440 的 313px，允许 ±4px；内部图表随卡片增高。页面使用自然文档滚动，不产生横向溢出，满/部分/空/Loading/Error 状态保持卡片、绘图区和行顺序稳定；Error 使用通用可操作文案，不暴露服务端异常细节或测试夹具文字。点击 Team Difference 中的团队进入 Team Drill-down，但不附带当前 Activity 作为下钻事实范围。

## 11. 研发能力页

与研发活动共享 Analytics Shell，但不机械复制业务内容。

能力页语义：

- 当前能力状态
- 能力演进
- 团队差异
- 支撑指标与证据
- 成熟度画像

页头只提供月份和时间粒度。通用能力没有产品版本或迭代范围，不显示禁用的“版本 / 不适用”筛选控件；旧 URL 中的 `version`、`dimension=iteration`、`period`、`metric` 参数会清理，不影响能力事实请求。

对于 `MR代码检视` 等能力，实际指标必须来自已批准的目录/业务定义，不得为了视觉填充发明指标。`mrr-count` / `mrr-rate` 保持“AI检视意见数” / “AI检视率”口径。新增 `AI有效检视数` 与 `AI检视有效率` 使用 Radar 本地 AIReviewOpinion 源记录：`ai_effective=true` 的意见计入有效数，有效率为有效意见数除以全部 AI 意见数；无意见时缺失，有意见但有效数为零时显示 0。意见日期按页面所选时间粒度聚合，分别提供“AI有效检视率趋势”与“AI有效检视意见数趋势”。源记录不保存意见正文；本地 API 不表示 Gateway 代码检视采集已实现。

能力目录使用活动页同款白色侧栏、分隔线、紧凑图标行；选择能力后，当前状态、已定义指标趋势、团队差异和证据随之更新。成熟度画像保留七项通用能力整体矩阵和雷达，不随所选能力切换；不创建跨能力总分。

能力结构目录卡只覆盖上方状态、演进、团队差异与证据工作区；目录底部与团队差异/证据行的底部对齐（1920×1080 和 2560×1440，误差不超过 4px），后续成熟度画像使用全宽区块。能力雷达中，当前/上期系列的七项值全为已评估时闭合最后一轴至第一轴；任一轴未评估则保留断点，不跨缺失轴连接或补零。团队热力表所有列头居中，团队列与度量列之间以及度量列之间显示 1px 竖向分隔线；团队行标签仍左对齐、数值保持居中。

能力页面同样使用领域整体 + 所有团队的趋势分析；团队问题下钻至 Team Detail。Team Difference 继续按各目录指标独立呈现，不展示“问题闭环率”或“覆盖情况”。MR代码检视的团队热力表直接使用 `mrr-effective-count` 与 `mrr-effective-rate` 的计算结果；缺记录的团队/周期保持缺失并不着色。能力演进从这两项目录指标提供“AI有效检视率趋势”和“AI有效检视意见数趋势”。

Capability Team Difference 使用与已批准 Reference 相符的热力矩阵视觉，但色阶按单列团队数值做五级相对比较；图例明确标注低到高，颜色不表示质量或绩效好坏。领域平均与团队值使用同一列标尺；未配置/缺失值不着色。该页面级视觉不复用成熟度 0–5 色阶。

Ability Status 只展示所选能力目录已定义的指标；MR有效检视状态、趋势和团队热力列均绑定 `AIReviewOpinion` 派生指标。无数据状态保持卡片、图表和矩阵几何，明确显示缺失而不补零。演进卡片按目录数值指标排列。Team Difference 与 Supporting Evidence 并排，底部 Maturity Matrix 与 Radar 作为独立分析层展示。通用能力成熟度矩阵以七项目录能力为行、领域平均和团队为列；等级 1–5 使用 Reference 色阶，未评估保持中性且不补零。成熟度矩阵与雷达内容不随能力目录选择变化。

能力结构目录只与页头、能力状态、能力演进、团队差异和支撑证据共用上方工作区；目录卡下边缘与团队差异/证据这一行的下边缘在两个验收视口内对齐，容差 `4px`。成熟度矩阵和雷达随后占用全宽独立区块，不延长左侧目录卡。能力团队差异表所有列头居中，团队列与指标列之间及指标列之间显示 `1px` 竖向分隔线；行标签保持左对齐、单元格数值保持居中。成熟度雷达的完整七项序列闭合最后一轴到第一轴；任何未评估轴仍保留断点，不补零、不跨缺失轴连线。

Capability Radar 的既有“60–75% 可用短边”描述曾未说明量测对象。本轮依据批准裁图修订为固定 Golden Visual Dataset 下的实际系列绘图区尺寸：Reference crop 为 1279×180 raster px，雷达系列约 114×117px；按成熟度区宽度归一化，1920×1080 目标约 126×129 CSS px（±9px），2560×1440 目标约 182×187 CSS px（±13px）。420×320 与后续 520×460 画框都造成长能力名称重叠；Capability 使用独立的 670×460 viewBox、全名分行及左右轴标签向外锚定，在既有 185px / 253px 布局槽内将可见矢量图形放大到 205px / 300px。轴标签实际渲染高度至少为 11px / 16px，文本框不得互相重叠。比例分母明确为可见 Radar SVG 的短边。上述修订只约束研发能力页的视觉绘图区，不改变成熟度分值、等级计算或雷达系列数据。

## 12. Analytics 图表统一规范

整体为 Visual-forward Modern Analytics：

- 主序列线宽 2.25–2.75px；普通团队线宽 1.75–2.25px。
- Grid line 极淡但可见。
- 主序列可使用柔和 Area Fill；不得给多团队全部铺面积导致遮挡。
- 点默认隐藏或弱化，Hover 时出现。
- 领域平均始终使用固定 Benchmark 样式。
- Benchmark 用独立 neutral blue/gray dashed style；网格线很淡但可辨，默认尽量少点，Hover/selected 时出现点。
- Tooltip 为结构化数据卡，不是 ECharts 默认 tooltip。
- Tooltip 清楚展示 series、value；适用时展示领域均值及 delta/difference。
- 效率值超出图轴边界时，图上显示边界点；Tooltip 同时标出当前图上值与原始值，并提供全公司均值差及前期变化，不能只显示与图轴不一致的原值。
- Legend 紧凑，并支持系列显隐。
- Legend 使用 11–12px 字号并留足间距；单主序列可使用 subtle area fill，多团队不全部填充面积。
- Bar 可有轻圆角，避免 3D/Glow/重渐变。
- Radar 使用低透明度 fill，Series 数量严格控制。
- Overview Radar 的完整已评估序列闭合最后一轴与第一轴；有缺失轴时保留断点、不补零也不绘制不完整填充。本期采用主色实线与轻微填充、圆形点；上期使用中性色虚线和空心菱形点，让数值相近时仍能分辨。

团队颜色在全系统稳定，不能在不同页面重新分配。

## 13. Analytics 与 Operational 两套 Page Pattern

### Analytics Workspace

适用：研发总览、研发活动、研发能力、Team Drill-down、指标详情。

重点：看、比较、判断、下钻。

### Operational Workbench

适用：需求数据、成熟度维护、团队/产品/版本、指标字典、Gateway、采集、用户权限等。

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

满数据、部分数据和无数据只改变内容状态，不改变已约定的卡片、图表、网格 bounding box；缺失不得补零，图表不得压成细线。Golden Visual Dataset 只固定视觉形态，不定义业务计算口径。

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

本次执行以 `docs/ux/visual-acceptance-baseline.md` 和机器可读 JSON 为区块合同来源。Reference 像素与 CSS 像素不可直接等同；每个区块单独检查 Reference/实际裁图、DOM 几何、交互与数据状态。实现者提交待复验，只有独立 Reviewer 依据相同 Reference 与证据通过后才能关闭单项 Issue；总体 PASS 不能覆盖任何关键维度的 PARTIAL/FAIL。Overview 六类 UI Issue 全部关闭且用户确认整页画面前，不得复用模式或标记通过。

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

### Activity page transition and monthly summary

Keep the currently committed Activity workspace visible while the next selection loads, announce the pending selection and retain focus. Commit title, selected directory item, KPI rows and trends together after the requested data settles; errors show the new Activity's own error state. Group Activity Team Difference columns with centered headings, fixed aligned `指标值` / `变化` subcolumns and restrained group separators. Place the workload legend in its own top band, clear of percentage ticks. The fixed six-slot raw summary follows the selected month irrespective of the global cycle and displays `本月数值`、`上月数值`、`环比变化`、`趋势`; count deltas require both months, and six-month trends keep gaps for missing facts. Undefined source metrics stay missing.

Keep the Activity raw-summary source in the row's accessible label and title. Do not add a visible source column to the four monthly data columns. The six rows and sparkline cells remain inside the card and keep identical bounds in full, partial, empty, loading and error states.

### Activity R4 — table readability and inline filter values

On Activity only, Team Difference group headings use at least 13px and visible `指标值` / `变化` subheadings at least 12px. The complete heading text must fit inside its header cell vertically and horizontally. Center the metric values and changes. Preserve existing semantic tone classes: positive is green, negative is red, neutral or missing is neutral. The raw summary must use at least 12px for all visible labels, headers and values; the metric name remains left-aligned, and each of the four data columns is centered. The Month and Statistical Period cards each place the selected value to the right of the label on the same row, with no clipping or overlap. Keep the accepted outer layout geometry and verify 1920×1080 and 2560×1440; do not propagate these page-specific styles to Overview or Capability.

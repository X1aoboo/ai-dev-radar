# 四页最终视觉确认包 — 2026-10-08（历史快照）

**历史快照，已由 [2026-10-10 最终复核包](four-page-user-review-2026-10-10.md)取代。**本文件保留 2026-10-08 候选的 Reference/实际对照、几何、交互证据与当时状态，不代表当前确认结果。当前状态以 2026-10-10 最终复核包和 `visual-acceptance-baseline.json` 为准。

## 验收边界

- 只验收 Desktop **1920×1080** 和 **2560×1440**。
- 实际截图来自真实 Chromium，使用固定 Golden Visual Dataset `overview-golden-2026-09-v1`；它保证画面可复现，不定义真实业务数值或口径。
- 已确认的 Business 与数据语义优先。Reference 只定义视觉样式与构图，不授权复制示例内容。
- 每页比较板分开记录 viewport 截图与 full-page 截图。各页的交互、DOM 几何、数据状态和 Issue Ledger 均有独立证据。

## 数据场景验证边界

10 月 8 日固定 Golden Chromium 候选在 1920×1080 和 2560×1440 验证了满数据、部分数据、空数据，以及适用页面的 Loading/Error 几何。这些是可重复的视觉状态证据，不代表真实业务数据。

2026-10-08 环境核查未发现运行中的本地前后端服务（5173/8000），也没有 `.env`、`DATABASE_URL` 或 API base URL 配置。仓库 README 只记载本地 `localhost:8000` 开发登录方式，检索到的项目文档没有已批准的外部测试/预发 URL。项目根目录默认 SQLite `ai-dev-radar.db` 的只读来源核查显示：2,904/2,904 条 FactRecord 的 `entered_by` 为“演示种子”，12/12 条 IR 的 `record_source` 为 `seed`，360/360 条成熟度记录的维护者为“演示种子”。因此它不能作为真实业务数据样本。

2026-10-07 的已登录 Chrome 补充记录只保留了活动页观察、能力页 DOM 几何和团队详情 URL/数值变化；当时没有保存截图或原始请求/数据库来源。该记录不补足真实业务数据验证。**真实业务数据场景当前未验证，不能据此关闭四页完成门禁。**

总览的固定 Golden 满/部分/空数据截图与逐状态几何：

| 视口 | 满数据 | 部分数据 | 空数据 |
|---|---|---|---|
| 1920×1080 | [截图](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/1920x1080/full/overview-full-page.png) · [几何](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/1920x1080-full-geometry-debug.json) | [截图](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/1920x1080/partial/overview-full-page.png) · [几何](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/1920x1080-partial-geometry-debug.json) | [截图](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/1920x1080/empty/overview-full-page.png) · [几何](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/1920x1080-empty-geometry-debug.json) |
| 2560×1440 | [截图](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/2560x1440/full/overview-full-page.png) · [几何](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/2560x1440-full-geometry-debug.json) | [截图](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/2560x1440/partial/overview-full-page.png) · [几何](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/2560x1440-partial-geometry-debug.json) | [截图](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/2560x1440/empty/overview-full-page.png) · [几何](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/2560x1440-empty-geometry-debug.json) |

同一视口下 29 个主要外框/绘图区 host 矩形在满、部分、空状态一致。空态 `coreEffectivePlot=null` 和 `lifecycleEffectivePlots=[]` 表示无数据时不挂载 ECharts；核心趋势仍保留固定 360/480px host，环节双趋势卡片与 surface 高度不变，空态提示在预留绘图区内呈现。这是“无数据不绘制虚假线条”的内容差异，不是图表卡片或布局收缩。活动/能力/团队详情的状态截图和逐态边界仍见最新候选 `candidate-evidence.json` 及各 viewport 目录。

研发活动、研发能力和团队详情的固定 Golden 满/部分/空状态截图如下。每个页面的逐态 DOM 矩形、滚动和 overflow 字段见同一候选的 [`candidate-evidence.json`](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/candidate-evidence.json)；状态截图仅代表 Golden 状态，不代表真实业务数据。

| 页面 | 1920×1080（满 / 部分 / 空） | 2560×1440（满 / 部分 / 空） |
|---|---|---|
| 研发活动 | [满](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/1920x1080/activities/activity-full-state.png) · [部分](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/1920x1080/activities/activity-partial-state.png) · [空](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/1920x1080/activities/activity-empty-state.png) | [满](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/2560x1440/activities/activity-full-state.png) · [部分](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/2560x1440/activities/activity-partial-state.png) · [空](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/2560x1440/activities/activity-empty-state.png) |
| 研发能力 | [满](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/1920x1080/capabilities/capability-full-state.png) · [部分](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/1920x1080/capabilities/capability-partial-state.png) · [空](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/1920x1080/capabilities/capability-empty-state.png) | [满](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/2560x1440/capabilities/capability-full-state.png) · [部分](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/2560x1440/capabilities/capability-partial-state.png) · [空](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/2560x1440/capabilities/capability-empty-state.png) |
| 团队详情 | [满](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/1920x1080/team-detail/team-full-state.png) · [部分](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/1920x1080/team-detail/team-partial-state.png) · [空](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/1920x1080/team-detail/team-empty-state.png) | [满](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/2560x1440/team-detail/team-full-state.png) · [部分](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/2560x1440/team-detail/team-partial-state.png) · [空](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/2560x1440/team-detail/team-empty-state.png) |

## 总览 `/`

**用户已确认：**2026-10-06 确认当前总览，并接受 `UI-FP-01` 侧栏底部示例卡片差异。2026-10-08 最新 Gate 截图与此前确认的总览实际整页 PNG 在两档尺寸均 SHA-256 完全一致：1920 为 `FB6CEFCDAA9ADB3C9BCB246A475C0B2599B43B1A9028124BEC2381CEBAD60662`，2560 为 `0A37D1A90312DD05DD4C260B4F9E0A83509F9C706CDD2413E8B2DC21CEACFA96`。

| 视口 | Reference/实际整页对照 | 最新实际整页 |
|---|---|---|
| 1920×1080 | [已确认对照图](../../e2e-results/overview-visual-2026-10-02T06-54-23-991Z-34424/overview-visual/comparisons/overview-confirmation/overview-full-page-1920x1080.png) | [2026-10-08 Chromium 实际图](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/1920x1080/full/overview-full-page.png) |
| 2560×1440 | [已确认对照图](../../e2e-results/overview-visual-2026-10-02T06-54-23-991Z-34424/overview-visual/comparisons/overview-confirmation/overview-full-page-2560x1440.png) | [2026-10-08 Chromium 实际图](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/2560x1440/full/overview-full-page.png) |

近期复验：月份/周期选择器、URL 与 IR 请求，月度和统计周期两行 KPI、核心趋势指标选择、六个真实环节、成熟度矩阵/雷达、团队表现及两张预览趋势。其区块 Issue 均已关闭。已接受的侧栏底部示例卡片差异保持不变。

## 研发活动 `/analytics/activities`

**Issue 门禁已关闭，整页待用户确认。**R6/R7 对 UI-ACT-15..17 在同一候选及两档视口均 PASS；UI-ACT-18 的新候选由独立 UX Reviewer 在两档视口所有关键维度 PASS 并已关闭。整页仍待用户确认。

| 视口 | 整页 Reference/实际对照 | 几何/交互证据 |
|---|---|---|
| 1920×1080 | [整页对照](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/activities-1920x1080-full-page-reference-actual.png) | [几何](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/1920x1080/activities/geometry.json) · [交互与状态](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/candidate-evidence.json) · [R4 筛选交互](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/1920x1080/filter-interaction-evidence.json) |
| 2560×1440 | [整页对照](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/activities-2560x1440-full-page-reference-actual.png) | [几何](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/2560x1440/activities/geometry.json) · [交互与状态](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/candidate-evidence.json) · [R4 筛选交互](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/2560x1440/filter-interaction-evidence.json) |

R4 的三项单独对照：[`UI-ACT-15` 1920](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/1920x1080/UI-ACT-15-TEAM-DIFFERENCE-READABILITY-ALIGNMENT-reference-actual.png) · [`UI-ACT-15` 2560](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/2560x1440/UI-ACT-15-TEAM-DIFFERENCE-READABILITY-ALIGNMENT-reference-actual.png) · [`UI-ACT-16` 1920](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/1920x1080/UI-ACT-16-RAW-SUMMARY-TYPOGRAPHY-ALIGNMENT-reference-actual.png) · [`UI-ACT-16` 2560](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/2560x1440/UI-ACT-16-RAW-SUMMARY-TYPOGRAPHY-ALIGNMENT-reference-actual.png) · [`UI-ACT-17` 1920](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/1920x1080/UI-ACT-17-ACTIVITY-HEADER-FILTERS-INLINE-reference-actual.png) · [`UI-ACT-17` 2560](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/2560x1440/UI-ACT-17-ACTIVITY-HEADER-FILTERS-INLINE-reference-actual.png)。
UI-ACT-18 复验：[1920 Reference/actual](../../e2e-results/overview-visual-2026-10-08T15-01-37-245Z-28764/overview-visual/UI-ACT-18-ACTIVITY-FILTER-CHEVRON-NATIVE-OPEN/1920x1080-reference-actual.png) · [2560 Reference/actual](../../e2e-results/overview-visual-2026-10-08T15-01-37-245Z-28764/overview-visual/UI-ACT-18-ACTIVITY-FILTER-CHEVRON-NATIVE-OPEN/2560x1440-reference-actual.png) · [两档交互/几何证据](../../e2e-results/overview-visual-2026-10-08T15-01-37-245Z-28764/overview-visual/UI-ACT-18-ACTIVITY-FILTER-CHEVRON-NATIVE-OPEN/interaction-evidence.json) · 集成 Gate 的十月状态弹层截图：[1920 月份](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/activity-r4-issues/1920x1080/UI-ACT-18-month-picker-pointer-open.png) · [1920 周期](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/activity-r4-issues/1920x1080/UI-ACT-18-statistical-period-pointer-open.png) · [2560 月份](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/activity-r4-issues/2560x1440/UI-ACT-18-month-picker-pointer-open.png) · [2560 周期](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/activity-r4-issues/2560x1440/UI-ACT-18-statistical-period-pointer-open.png) · [Escape/焦点证据 1920](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/activity-r4-issues/1920x1080/UI-ACT-18-filter-chevron-interaction-evidence.json) · [Escape/焦点证据 2560](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/activity-r4-issues/2560x1440/UI-ACT-18-filter-chevron-interaction-evidence.json)。

## 研发能力 `/analytics/capabilities`

**Issue 门禁已通过；雷达几何基线和整页待用户确认。**当前独立复核认可图表可读性与交互。待确认的几何基线使用 Capability 专属 `670×460` viewBox：绘图区目标约 `126×129px`（1920，容差 ±9px）和 `182×187px`（2560，容差 ±13px）；七个完整能力轴标签不得重叠或裁切。这个确认不改变团队详情的雷达几何。

| 视口 | 整页 Reference/实际对照 | 几何/交互证据 |
|---|---|---|
| 1920×1080 | [整页对照](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/capabilities-1920x1080-full-page-reference-actual.png) | [几何](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/1920x1080/capabilities/geometry.json) · [状态几何](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/1920x1080/capabilities/capability-state-geometry.json) · [交互与状态](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/candidate-evidence.json) |
| 2560×1440 | [整页对照](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/capabilities-2560x1440-full-page-reference-actual.png) | [几何](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/2560x1440/capabilities/geometry.json) · [状态几何](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/2560x1440/capabilities/capability-state-geometry.json) · [交互与状态](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/candidate-evidence.json) |

交互证据包括月份/粒度筛选、七行成熟度矩阵，以及雷达数据表通过点击和键盘打开/关闭、焦点保留；Full/Partial/Empty/Loading/Error 几何检查均在最新 Gate 中重跑。

## 团队详情 `/analytics/teams/:teamId`

**主要区块 Issue 门禁已关闭；`UI-TD-03` 和整页确认仍待处理。**Reference 有“关键发现”内容区，实际页没有获业务批准的数据/文案合同，因此当前没有凭示例编造内容。R7 对当前候选在两档视口的构图维度判为 FAIL、几何 PASS；R6 未取得 verdict，Issue 仍为 OPEN。

| 视口 | 整页 Reference/实际对照 | 几何/交互证据 |
|---|---|---|
| 1920×1080 | [整页对照](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/team-detail-1920x1080-full-page-reference-actual.png) | [几何](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/1920x1080/team-detail/geometry.json) · [状态/范围/交互](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/candidate-evidence.json) · [滚动](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/1920x1080/team-detail/team-page-scroll-evidence.json) |
| 2560×1440 | [整页对照](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/team-detail-2560x1440-full-page-reference-actual.png) | [几何](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/2560x1440/team-detail/geometry.json) · [状态/范围/交互](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/candidate-evidence.json) · [滚动](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/2560x1440/team-detail/team-page-scroll-evidence.json) |

`UI-TD-03` 专项对照：[`1920×1080`](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/comparisons/team-detail/issue-evidence/UI-TD-03-key-findings-1920x1080-reference-actual.png) · [`2560×1440`](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/comparisons/team-detail/issue-evidence/UI-TD-03-key-findings-2560x1440-reference-actual.png)。两档实际都没有“关键发现”模块：成熟度面板有矩阵与雷达两个模块，面板高 `631.27px`；实际 DOM 文本不含该标题。Reference 右侧包含关键发现示例区。差异已在真实 Chromium 中逐视口记录，仍需用户决定是否接受省略，或先批准内容合同。

R7 对同一 13-17 候选独立复核：1920×1080、2560×1440 的 Reference 构图维度均 **FAIL**（关键发现区缺失），DOM 几何维度均 **PASS**；Issue 维持 **OPEN / 等待用户处置**。R6 的同候选复核请求多次报错，未取得 verdict。Reference 示例文案没有获批的数据/文案合同，所以此处不补写示例结论。若你批准把省略作为显式视觉基线例外，我会先更新合同，再让 Reviewer 按新合同复核同一候选；**只有 Reviewer 复核关键维度通过后才会关闭 UI-TD-03，团队详情整页确认也需等该门禁通过。**也可提供获批数据/文案合同，再实施并复验。

已关闭 `UI-TD-01/02/04/05/06` 和 `TEAM-GEO-01`。范围证据检查当前团队值按版本过滤、领域参照不限版本且只展示当前团队与领域均值；产品外版本不进入候选，历史事实仍保留在“全部版本”。Loading/Error/Empty/Partial 状态和页面滚动均有候选记录。

## Issue Ledger 与自动验证

- [结构化几何与 Issue Ledger](visual-acceptance-baseline.json) · [可读版基线与区块状态](visual-acceptance-baseline.md) · [Completed Change Design](../changes/completed/ux-visual-convergence.md)。
- 2026-10-08 npm run gate：后端 146、前端 Node 76、渲染 108、Gateway E2E 3/3、视觉 Chromium E2E 6/6、构建及文档检查通过。
- 最新集成产物：[overview-visual](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/) · [Gateway](../../e2e-results/gateway-2026-10-08T15-04-18-665Z-10856/)。UI-ACT-18 issue-level gate 已关闭；此包仍等待其余整页确认及 UI-TD-03 用户处置。
- 复现候选为真实 Chromium + 固定 Golden API 数据；页面的数字只为重复视觉/交互检查，不替代线上事实或业务口径。最新 Gate 候选：[`sibling-visual-candidate`](../../e2e-results/overview-visual-2026-10-08T15-05-20-332Z-20212/overview-visual/sibling-visual-candidate/)。

## 尚待用户决定

1. 研发活动：是否接受两档整页对照。
2. 研发能力：是否接受上面的 `670×460` 雷达基线及两档绘图区目标，并确认整页。
3. 团队详情：批准“关键发现”省略为显式基线例外，之后由 Reviewer 依据更新后的合同复核；或提供经过业务批准的数据/文案合同以便实现。UI-TD-03 只有在 Reviewer 复核 PASS 后才能关闭，团队详情整页确认随后进行。
4. 真实业务数据场景：当前工作区只有演示种子库，且没有可访问的实时数据服务。请提供经批准、当前主机可访问的业务数据环境 URL（无需发送账号或密码；使用已有登录会话），以完成两档 Desktop 浏览器复核。

在这些决定明确前，本 Change Design 保持 Active，不能把任何页面整页状态标为最终 PASS。

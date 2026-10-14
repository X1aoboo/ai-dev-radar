# 四页最终视觉确认包 — 2026-10-07

**历史快照，已由 [2026-10-08 确认包](four-page-user-review-2026-10-08.md)取代。**本文件保留 2026-10-07 候选与差异记录，不用于当前视觉确认。当前状态及待决项以 2026-10-08 确认包为准。

## 验收边界

- 只验收 Desktop **1920×1080** 和 **2560×1440**。
- 实际截图来自真实 Chromium，使用固定 Golden Visual Dataset `overview-golden-2026-09-v1`；它保证画面可复现，不定义真实业务数值或口径。
- 已确认的 Business 与数据语义优先。Reference 只定义视觉样式与构图，不授权复制示例内容。
- 每页比较板分开记录 viewport 截图与 full-page 截图。各页的交互、DOM 几何、数据状态和 Issue Ledger 均有独立证据。

## 总览 `/`

**用户已确认：**2026-10-06 确认当前总览，并接受 `UI-FP-01` 侧栏底部示例卡片差异。2026-10-07 最新 Gate 截图与此前确认的总览实际整页 PNG 在两档尺寸均 SHA-256 完全一致：1920 为 `FB6CEFCDAA9ADB3C9BCB246A475C0B2599B43B1A9028124BEC2381CEBAD60662`，2560 为 `0A37D1A90312DD05DD4C260B4F9E0A83509F9C706CDD2413E8B2DC21CEACFA96`。

| 视口 | Reference/实际整页对照 | 最新实际整页 |
|---|---|---|
| 1920×1080 | [已确认对照图](../../e2e-results/overview-visual-2026-10-02T06-54-23-991Z-34424/overview-visual/comparisons/overview-confirmation/overview-full-page-1920x1080.png) | [2026-10-07 Chromium 实际图](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/1920x1080/full/overview-full-page.png) |
| 2560×1440 | [已确认对照图](../../e2e-results/overview-visual-2026-10-02T06-54-23-991Z-34424/overview-visual/comparisons/overview-confirmation/overview-full-page-2560x1440.png) | [2026-10-07 Chromium 实际图](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/2560x1440/full/overview-full-page.png) |

近期复验：月份/周期选择器、URL 与 IR 请求，月度和统计周期两行 KPI、核心趋势指标选择、六个真实环节、成熟度矩阵/雷达、团队表现及两张预览趋势。其区块 Issue 均已关闭。已接受的侧栏底部示例卡片差异保持不变。

## 研发活动 `/analytics/activities`

**Issue 门禁已关闭，整页待用户确认。**R6/R7 对 `UI-ACT-15..17` 在同一候选及两档视口均 PASS。最新 Gate 整页画面由相同未变更代码重新生成。

| 视口 | 整页 Reference/实际对照 | 几何/交互证据 |
|---|---|---|
| 1920×1080 | [整页对照](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/activities-1920x1080-full-page-reference-actual.png) | [几何](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/1920x1080/activities/geometry.json) · [交互与状态](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/candidate-evidence.json) · [R4 筛选交互](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/1920x1080/filter-interaction-evidence.json) |
| 2560×1440 | [整页对照](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/activities-2560x1440-full-page-reference-actual.png) | [几何](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/2560x1440/activities/geometry.json) · [交互与状态](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/candidate-evidence.json) · [R4 筛选交互](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/2560x1440/filter-interaction-evidence.json) |

R4 的三项单独对照：[`UI-ACT-15` 1920](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/1920x1080/UI-ACT-15-TEAM-DIFFERENCE-READABILITY-ALIGNMENT-reference-actual.png) · [`UI-ACT-15` 2560](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/2560x1440/UI-ACT-15-TEAM-DIFFERENCE-READABILITY-ALIGNMENT-reference-actual.png) · [`UI-ACT-16` 1920](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/1920x1080/UI-ACT-16-RAW-SUMMARY-TYPOGRAPHY-ALIGNMENT-reference-actual.png) · [`UI-ACT-16` 2560](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/2560x1440/UI-ACT-16-RAW-SUMMARY-TYPOGRAPHY-ALIGNMENT-reference-actual.png) · [`UI-ACT-17` 1920](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/1920x1080/UI-ACT-17-ACTIVITY-HEADER-FILTERS-INLINE-reference-actual.png) · [`UI-ACT-17` 2560](../../e2e-results/overview-visual-2026-10-07T12-12-31-675Z-53780/overview-visual/sibling-visual-candidate/activity-r4-issues/2560x1440/UI-ACT-17-ACTIVITY-HEADER-FILTERS-INLINE-reference-actual.png)。

## 研发能力 `/analytics/capabilities`

**Issue 门禁已通过；雷达几何基线和整页待用户确认。**当前独立复核认可图表可读性与交互。待确认的几何基线使用 Capability 专属 `670×460` viewBox：绘图区目标约 `126×129px`（1920，容差 ±9px）和 `182×187px`（2560，容差 ±13px）；七个完整能力轴标签不得重叠或裁切。这个确认不改变团队详情的雷达几何。

| 视口 | 整页 Reference/实际对照 | 几何/交互证据 |
|---|---|---|
| 1920×1080 | [整页对照](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/capabilities-1920x1080-full-page-reference-actual.png) | [几何](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/1920x1080/capabilities/geometry.json) · [状态几何](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/1920x1080/capabilities/capability-state-geometry.json) · [交互与状态](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/candidate-evidence.json) |
| 2560×1440 | [整页对照](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/capabilities-2560x1440-full-page-reference-actual.png) | [几何](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/2560x1440/capabilities/geometry.json) · [状态几何](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/2560x1440/capabilities/capability-state-geometry.json) · [交互与状态](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/candidate-evidence.json) |

交互证据包括月份/粒度筛选、七行成熟度矩阵，以及雷达数据表通过点击和键盘打开/关闭、焦点保留；Full/Partial/Empty/Loading/Error 几何检查均在最新 Gate 中重跑。

## 团队详情 `/analytics/teams/:teamId`

**主要区块 Issue 门禁已关闭；`UI-TD-03` 差异处置和整页待用户确认。**Reference 有“关键发现”内容区，实际页没有获业务批准的数据/文案合同，因此当前没有凭示例编造内容。请决定接受该差异，或先批准可展示的内容合同。

| 视口 | 整页 Reference/实际对照 | 几何/交互证据 |
|---|---|---|
| 1920×1080 | [整页对照](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/team-detail-1920x1080-full-page-reference-actual.png) | [几何](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/1920x1080/team-detail/geometry.json) · [状态/范围/交互](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/candidate-evidence.json) · [滚动](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/1920x1080/team-detail/team-page-scroll-evidence.json) |
| 2560×1440 | [整页对照](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/team-detail-2560x1440-full-page-reference-actual.png) | [几何](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/2560x1440/team-detail/geometry.json) · [状态/范围/交互](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/candidate-evidence.json) · [滚动](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/2560x1440/team-detail/team-page-scroll-evidence.json) |

`UI-TD-03` 专项对照：[`1920×1080`](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/comparisons/team-detail/issue-evidence/UI-TD-03-key-findings-1920x1080-reference-actual.png) · [`2560×1440`](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/comparisons/team-detail/issue-evidence/UI-TD-03-key-findings-2560x1440-reference-actual.png)。两档实际都没有“关键发现”模块：成熟度面板有矩阵与雷达两个模块，面板高 `631.27px`；实际 DOM 文本不含该标题。Reference 右侧包含关键发现示例区。差异已在真实 Chromium 中逐视口记录，仍需用户决定是否接受省略，或先批准内容合同。

R7 对同一 13-17 候选独立复核：1920×1080、2560×1440 的 Reference 构图维度均 **FAIL**（关键发现区缺失），DOM 几何维度均 **PASS**；Issue 维持 **OPEN / 等待用户处置**。R6 的同候选复核请求多次报错，未取得 verdict。Reference 示例文案没有获批的数据/文案合同，所以此处不补写示例结论。

已关闭 `UI-TD-01/02/04/05/06` 和 `TEAM-GEO-01`。范围证据检查当前团队值按版本过滤、领域参照不限版本且只展示当前团队与领域均值；产品外版本不进入候选，历史事实仍保留在“全部版本”。Loading/Error/Empty/Partial 状态和页面滚动均有候选记录。

## Issue Ledger 与自动验证

- [结构化几何与 Issue Ledger](visual-acceptance-baseline.json) · [可读版基线与区块状态](visual-acceptance-baseline.md) · [Completed Change Design](../changes/completed/ux-visual-convergence.md)。
- 2026-10-07 `npm run gate`：后端 146、前端 Node 76、渲染 108、Gateway E2E 3/3、视觉 Chromium E2E 5/5、构建及文档检查通过。
- 复现候选为真实 Chromium + 固定 Golden API 数据；页面的数字只为重复视觉/交互检查，不替代线上事实或业务口径。最新 Gate 候选：[`sibling-visual-candidate`](../../e2e-results/overview-visual-2026-10-07T13-17-09-138Z-46740/overview-visual/sibling-visual-candidate/)。

## 尚待用户决定

1. 研发活动：是否接受两档整页对照。
2. 研发能力：是否接受上面的 `670×460` 雷达基线及两档绘图区目标，并确认整页。
3. 团队详情：是否接受“关键发现”暂缺的明确差异并确认整页；如不接受，请给出经过业务批准的数据/文案合同，再实施和复验。

在这些决定明确前，本 Change Design 保持 Active，不能把任何页面整页状态标为最终 PASS。

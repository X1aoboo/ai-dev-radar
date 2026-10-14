# 四页最终视觉复核包 — 创建 2026-10-10；更新 2026-10-15

**状态：四页整页视觉结果均已由用户确认（研发总览此前确认；研发活动 14-42、研发能力 15-02、团队详情 14-42 于 2026-10-15 确认并接受当前差异）。**本包为四页提供 1920×1080 和 2560×1440 Desktop 整页对照、交互与几何证据，并列出仍未关闭的业务/数据验收。独立 Reviewer 的 PASS 只关闭单项 Issue；整页确认单独由用户完成。真实业务数据仍未验证。

## 验收边界

- 固定 Golden Dataset：`overview-golden-2026-09-v1`。它用于可重复视觉比对，不定义真实业务数值或公式。
- 当前保留的完整浏览器候选：[`overview-visual-2026-10-14T14-42-24-294Z-4132`](../../e2e-results/overview-visual-2026-10-14T14-42-24-294Z-4132/overview-visual/)，包含 Overview、Activity、Capability、Team Detail 的两档 Chromium 截图和几何；CAP-REF-02/03 区块对照及四图 resize 补充见 [`15-02-39-071Z-31372`](../../e2e-results/overview-visual-2026-10-14T15-02-39-071Z-31372/overview-visual/)。当前完整 `npm run gate` 通过：backend 149、frontend 77、route/render 110、Gateway E2E 3/3、fixed-Golden Chromium E2E 10/10、build、docs check、docs test 1/1。
- Overview 于 2026-10-06 已由用户确认，并接受 `UI-FP-01` 侧栏底部示例卡片差异。最新完整门禁两档实际图与已确认候选 SHA-256 一致：1920 为 `FB6CEFCDAA9ADB3C9BCB246A475C0B2599B43B1A9028124BEC2381CEBAD60662`，2560 为 `0A37D1A90312DD05DD4C260B4F9E0A83509F9C706CDD2413E8B2DC21CEACFA96`。
- 当前 Chrome 本地数据为演示种子数据。固定 Golden 与本地演示库都不代表真实业务数据，因此真实业务数据验收仍开放。

## 页面状态

| 页面 | 独立区块门禁 | 整页用户确认 | 仍待处理 |
|---|---|---|---|
| 研发总览 | 已关闭 | **已确认（2026-10-06）** | 保留已接受的 `UI-FP-01` 差异；当前截图哈希一致 |
| 研发活动 | 当前候选 `14-42-24-294Z-4132` 的 UI-ACT-01..19 固定-Golden E2E 与独立 Reviewer 均 PASS 两档；与 19-34 的几何、数据和主要 R2/R3 裁图一致，未发现新 Issue | **已确认（2026-10-15，接受当前差异）** | 真实业务数据仍未验证 |
| 研发能力 | 候选 `15-02-39-071Z-31372` 的 UI-CAP-10/11 及 4 图 resize 两档独立 PASS；4 张能力状态卡、4 张趋势卡、热力图公式和满/部分/空几何通过固定-Golden Chromium 检查 | **已确认（2026-10-15，接受当前差异）** | 本地意见 API 与 synthetic Golden 数据已实现；真实业务数据仍未验证 |
| 团队详情 | 当前候选 `14-42-24-294Z-4132` 的 UI-TD-01/02/04/05/06 与 TEAM-GEO-01 两档 PASS；UI-TD-03 已由用户接受并经独立 Reviewer 两档复验通过 | **已确认（2026-10-15，接受当前差异）** | 本地演示数据不代表真实业务数据 |

## 前一候选独立复验 — 18-08，2026-10-13

独立 Reviewer 仅依据候选 `overview-visual-2026-10-12T18-08-16-050Z-36716`、批准 Reference、几何/交互记录和当前 UX 规则复验；没有沿用早期总体 PASS。原始复验报告对应本节的逐项结果。该评审仍是 18-08 历史候选证据，不代表 19-34 的新 resize 问题已关闭。

| 页面 | 独立 Reviewer 结论 | 仍开放的关键项 |
|---|---|---|
| 研发活动 | UI-ACT-01..19 两档 PASS；最新整页图与 2026-10-13 用户确认图逐像素一致 | 当前演示数据不代表真实业务数据 |
| 研发能力 | UI-CAP-01..09、12..18 及 CAP-GEO-01 两档 PASS；横向溢出 0px，页尾 39.56px；缺轴雷达保持断点 | UI-CAP-10/11 来源与公式未获批，UNVERIFIED；能力整页确认仍待用户 |
| 团队详情 | UI-TD-01/02/04/05/06 与 TEAM-GEO-01 两档 PASS；版本/迭代请求范围及空/Loading/Error 几何有证据 | UI-TD-03 两档 FAIL：实际缺少 Reference 的“关键发现”标签/区域，等待用户处置或内容合同 |

Capability 的独立交互证据确认旧 `version`、迭代和旧 `metric` 参数从 URL 清理，请求固定为时间维度且无指定版本。成熟度表格文本、雷达标记与截图状态在指针和键盘切换后均保持一致。活动团队变化色在两档均测得 10 个正向、2 个负向、8 个中性单元格，正/负颜色符合规则。真实业务数据仍未验证。

## 最新完整候选 — 19-34-15-126Z-20188（2026-10-13）

`npm run gate` 在当前 CSS 和回归测试上通过：后端 146、前端单测 77、路由/渲染 110、Gateway E2E 3/3、固定-Golden Chromium 10/10、生产构建、`check:docs` 和 `test:docs` 1/1。独立 Reviewer 随后复验 UI-CHART-RESIZE-01 并通过，故该单项已关闭；这不构成四页整页视觉 PASS，当前 Activity 页面确认仍待用户完成。

| 页面/问题 | 1920×1080 Reference/实际 | 2560×1440 Reference/实际 | 当前状态 |
|---|---|---|---|
| Overview | [实际整页](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/1920x1080/full/overview-full-page.png) | [实际整页](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/2560x1440/full/overview-full-page.png) | 与上一候选逐字节一致；原用户确认继续适用 |
| Activity | [Reference/实际](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/activities-1920x1080-full-page-reference-actual.png) | [Reference/实际](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/activities-2560x1440-full-page-reference-actual.png) | UI-ACT-01..19 E2E 两档通过；PNG 与已确认的 18-08 候选不同；独立复验和当前整页确认待处理 |
| Capability | [Reference/实际](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/capabilities-1920x1080-full-page-reference-actual.png) | [Reference/实际](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/capabilities-2560x1440-full-page-reference-actual.png) | 整页图与 18-08 逐字节一致；UI-CHART-RESIZE-01 两档 resize 回归及独立复验均通过并关闭；用户整页确认待处理 |
| Team Detail | [Reference/实际](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/team-detail-1920x1080-full-page-reference-actual.png) | [Reference/实际](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/team-detail-2560x1440-full-page-reference-actual.png) | 整页图与 18-08 逐字节一致；UI-TD-03 已作为用户接受的构图例外通过独立复验并关闭；整页确认仍待处理 |
| UI-CHART-RESIZE-01 | [趋势 Reference/实际](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/ui-chart-resize-01/1920x1080-after-shrink-trend-row-reference-actual.png) | [趋势 Reference/实际](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/ui-chart-resize-01/2560x1440-after-expand-trend-row-reference-actual.png) | 修复后宿主保持在卡片内；独立 Reviewer 在两档尺寸核对裁图、容器边界、同页缩放和溢出后判 PASS，Issue 已关闭；几何见 [`geometry.json`](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/ui-chart-resize-01/geometry.json) |

补充的本地 Chrome 当前页面截图和 DOM 几何：研发能力 MR代码检视在[1920×1080](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/supplemental-current-browser/capability-mr-1920x1080-full-page.png)与[2560×1440](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/supplemental-current-browser/capability-mr-2560x1440-full-page.png)的整页截图；对应几何为[1920](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/supplemental-current-browser/capability-mr-1920x1080-geometry.json)和[2560](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/supplemental-current-browser/capability-mr-2560x1440-geometry.json)。两者是本地演示数据的浏览器观察；正式 Reference/actual 及满/部分/空状态仍以固定-Golden 候选文件为准，真实业务数据尚未验证。

该问题修复前的红态证据、根因和预修复计划记录在 Active Change Design。独立 Reviewer 已在同一候选按 `capability-trends-only.png`、两档 Reference/actual boards、宿主/卡片 bounds、缩放交互和滚动范围逐项复验并判 PASS，UI-CHART-RESIZE-01 已关闭。Reviewer 同时撤回了 Overview 原始错误文案的疑点：通用错误文案合同限定于 Activity 和 Team Detail，不适用于 Overview，因此未新增 Overview 错误文案 Issue。

## 上一候选 18-08 整页对照（历史）

### 研发总览

| 视口 | 已确认 Reference/实际对照 | 最新实际图 |
|---|---|---|
| 1920×1080 | [已确认整页对照](../../e2e-results/overview-visual-2026-10-02T06-54-23-991Z-34424/overview-visual/comparisons/overview-confirmation/overview-full-page-1920x1080.png) | [完整门禁实际图](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/1920x1080/full/overview-full-page.png) |
| 2560×1440 | [已确认整页对照](../../e2e-results/overview-visual-2026-10-02T06-54-23-991Z-34424/overview-visual/comparisons/overview-confirmation/overview-full-page-2560x1440.png) | [完整门禁实际图](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/2560x1440/full/overview-full-page.png) |

月份/周期筛选、两行 KPI、核心趋势指标切换、六个研发环节、成熟度矩阵/雷达和团队表现的交互/几何证据在 [request-and-interaction-evidence.json](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/request-and-interaction-evidence.json)。满/部分/空状态实际图与几何位于同一运行目录的 `1920x1080/` 和 `2560x1440/`。

### 研发活动

| 视口 | Reference/实际整页对照 | 几何/状态/交互 |
|---|---|---|
| 1920×1080 | [整页对照](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/activities-1920x1080-full-page-reference-actual.png) | [几何与状态](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/sibling-visual-candidate/1920x1080/activities/geometry.json) · [候选交互证据](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/sibling-visual-candidate/candidate-evidence.json) |
| 2560×1440 | [整页对照](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/activities-2560x1440-full-page-reference-actual.png) | [几何与状态](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/sibling-visual-candidate/2560x1440/activities/geometry.json) · [候选交互证据](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/sibling-visual-candidate/candidate-evidence.json) |

目录选择、按月统计、工作量同比、六项原始摘要和筛选 URL/请求行为已在这份候选中复验。上一候选的整页实际图选中“SA设计”，而 Reference 选中“开发设计”，因此不能用于同状态整页 PASS。当前候选在两档通过指针选择“开发设计”后捕获：标题和两张趋势图切换为该活动、请求指标 ID 为 5/6，截图与已测 DOM 状态相同；点击前后的下方摘要值保持不变。选择 Evidence 与 Reference/actual 整页板在候选 `candidate-evidence.json` 和 `comparisons/sibling-page-review/` 中。独立 Reviewer 已对该同状态候选两档 PASS。用户于 2026-10-13 回复“检查通过”，整页确认据此记录为通过，范围仅为此处链接的两档候选，不代表真实业务数据验收。

用户后续指出统计周期箭头点击无效。当前真实 Chrome 的补充复现定位为独立 10px 箭头按钮 hit target 过窄。修复后 `UI-ACT-19-PERIOD-ARROW-HIT-TARGET` 的 [1920](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/UI-ACT-19-PERIOD-ARROW-HIT-TARGET/1920x1080-reference-actual.png) 与 [2560](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/UI-ACT-19-PERIOD-ARROW-HIT-TARGET/2560x1440-reference-actual.png) Reference/actual 对照、[交互与几何记录](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/UI-ACT-19-PERIOD-ARROW-HIT-TARGET/interaction-and-geometry-evidence.json) 和独立 Reviewer 均通过。实际卡片保持 180×42px，Select 目标 83×24px；选择年度后 URL、请求范围和周期 KPI 同步变化，键盘选择、Escape 与焦点返回通过。区块级结果与整页确认分别记录；该问题的交互/几何复验通过，整页确认见本页状态和 2026-10-13 用户确认记录。

### 研发能力

| 视口 | Reference/实际整页对照 | 关键区块对照 |
|---|---|---|
| 1920×1080 | [整页对照](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/1920x1080/CAP-REF-06-full-page-reference-actual.png) | [页头筛选](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/1920x1080/CAP-REF-07-header-filters-reference-actual.png) · [状态/趋势](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/1920x1080/CAP-REF-02-status-and-trends-reference-actual.png) · [目录](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/1920x1080/CAP-REF-01-directory-reference-actual.png) · [团队热力图](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/1920x1080/CAP-REF-03-team-heatmap-reference-actual.png) · [成熟度](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/1920x1080/CAP-REF-05-maturity-reference-actual.png) |
| 2560×1440 | [整页对照](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/2560x1440/CAP-REF-06-full-page-reference-actual.png) | [页头筛选](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/2560x1440/CAP-REF-07-header-filters-reference-actual.png) · [状态/趋势](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/2560x1440/CAP-REF-02-status-and-trends-reference-actual.png) · [目录](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/2560x1440/CAP-REF-01-directory-reference-actual.png) · [团队热力图](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/2560x1440/CAP-REF-03-team-heatmap-reference-actual.png) · [成熟度](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/2560x1440/CAP-REF-05-maturity-reference-actual.png) |

上述“未配置”图标题与无来源状态属于 18-08 历史候选；当前有效检视源和公式已获批准并实现。最新 CAP-REF-02/03 Reference/实际对照、两档几何及独立复验见 2026-10-14 当前候选章节。

交互/几何 JSON 在两档视口中记录完全相同的 MR-E2E 五行数值和热力等级：全公司均值 325 / 37%；团队 A 375 / 51%；团队 B 472 / 42%；团队 C 290 / 31%；团队 D 163 / 22%。测试在截图前等待数据提交，截图后复读表格并断言 DOM 行值/色阶一致。当前候选还记录目录底边与团队差异行误差、热力表头居中/竖线样式和完整/缺轴雷达路径。独立 Reviewer 已在该候选通过 UI-CAP-15/16/17；同候选 CAP-REF-09 证明单轴缺失仍保留断点。

上一候选的独立复验将 `UI-CAP-16` 判为 PARTIAL：当时只有七轴全有值和全空两种状态，缺少单轴缺失时的浏览器证据。当前完整门禁候选新增固定 Golden 的单轴缺失状态（`CodeCheck问题修复` 未评估，其余六轴有效），只覆盖 E2E 响应、不修改持久数据；两档 [1920 CAP-REF-09](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-radar-missing-axis-2026-10-10/1920x1080/CAP-REF-09-single-axis-gap-reference-actual.png) 和 [2560 CAP-REF-09](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-radar-missing-axis-2026-10-10/2560x1440/CAP-REF-09-single-axis-gap-reference-actual.png) 均显示本期有 6 个点及两段开放折线，上期完整 7 轴闭合。DOM 与截图状态相同、无页面横向溢出。独立 Reviewer 在同一候选按 Reference 复验后通过 UI-CAP-16，也通过 UI-CAP-15/17；三项均可关闭。研发能力整页仍待用户确认，且 UI-CAP-10/11 仍为定义开放。

当前表格没有参考图中的“成熟度评分”总分列。Business 只定义团队×能力点月度 1–5 人工评估，没有不随能力选择变化的团队总分公式；Reviewer 确认不能从参考样例推导总分，因此省略该列并作为当前业务边界。成熟度仍在单独的七项矩阵/雷达呈现。

#### 用户复报后的当前浏览器核对 — 2026-10-10

本机 Chrome 当前在 `/analytics/capabilities`，月份为 2026-10。页面滚动后的实时截图显示能力结构目录与团队差异卡片底边齐平；团队热力表表头居中且各指标列有竖向分隔。该截图属于浏览器即时观察，视口约 2560×1210，不计入 Desktop 验收尺寸；精确 1920×1080 和 2560×1440 仍以同一候选的固定-Golden Chromium 记录为准。

| 用户复报 | Reference / 实际证据 | 几何与数据核对 | 状态 |
|---|---|---|---|
| 能力结构目录与团队差异底边未齐 | Reference [`capability-directory.png`](reference-crops/capability-directory.png)；[1920 CAP-REF-06](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/1920x1080/CAP-REF-06-full-page-reference-actual.png) / [2560 CAP-REF-06](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/2560x1440/CAP-REF-06-full-page-reference-actual.png) | 两档 `directoryBottomDeltaPx=0` | 当前复报未重现；UI-CAP-15 保持已关闭 |
| 雷达少一个角，没有连线 | Reference [`capability-maturity-matrix-radar.png`](reference-crops/capability-maturity-matrix-radar.png)；[完整数据 CAP-REF-05](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/1920x1080/CAP-REF-05-maturity-reference-actual.png)；[单轴缺失 CAP-REF-09](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-radar-missing-axis-2026-10-10/1920x1080/CAP-REF-09-single-axis-gap-reference-actual.png) | 实时 2026-10 数据表显示本期七轴全为缺失，2026-09 上期七轴都有数值；当前没有本期折线可连接，上期完整线闭合。Golden 单轴缺失时为 6 点/2 段开放折线，完整上期为闭合线。 | 完整序列连接已实现并复验；缺失轴保持断点是现行 UX 合同，不能用连线暗示有值 |
| 团队差异表头需居中并有竖线 | Reference [`capability-team-differences-and-evidence.png`](reference-crops/capability-team-differences-and-evidence.png)；[1920 CAP-REF-03](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/1920x1080/CAP-REF-03-team-heatmap-reference-actual.png) / [2560 CAP-REF-03](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/capability-refinement-2026-10-10/2560x1440/CAP-REF-03-team-heatmap-reference-actual.png) | 两档表头居中误差最大 0.49/0.5px；竖线 1px | 当前复报未重现；UI-CAP-17 保持已关闭 |

三项均已由同候选独立 Reviewer 在两个验收视口复核 PASS。若希望未评估轴也跨越缺失点连线，需要先明确修订已批准的缺失数据视觉合同；本次没有改变该合同。能力整页最终用户确认仍待处理。

### 团队详情

| 视口 | Reference/实际整页对照 | 几何/滚动/范围证据 |
|---|---|---|
| 1920×1080 | [整页对照](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/team-detail-1920x1080-full-page-reference-actual.png) | [页面几何](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/sibling-visual-candidate/1920x1080/team-detail/geometry.json) · [滚动](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/sibling-visual-candidate/1920x1080/team-detail/team-page-scroll-evidence.json) · [交互/状态](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/sibling-visual-candidate/candidate-evidence.json) |
| 2560×1440 | [整页对照](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/team-detail-2560x1440-full-page-reference-actual.png) | [页面几何](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/sibling-visual-candidate/2560x1440/team-detail/geometry.json) · [滚动](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/sibling-visual-candidate/2560x1440/team-detail/team-page-scroll-evidence.json) · [交互/状态](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/sibling-visual-candidate/candidate-evidence.json) |

`UI-TD-03` 已关闭为用户接受的构图例外：Reference 有“关键发现”内容区，实际省略；用户于 2026-10-14 明确接受当前差异，独立 Reviewer 随后在 1920×1080 和 2560×1440 复核成熟度标题位置、矩阵/雷达范围、滚动及其他 Team Detail 合同，无额外 FAIL/PARTIAL。此项关闭不等同于 Team Detail 整页用户确认。

Reviewer 在先前的 01-43 候选还发现 UI-TD-06 错误态会显示 `Visual error fixture`，并指出 `TEAM-GEO-01` 主几何记录缺少整体趋势绘图区数据。当前候选已改为通用“数据暂时无法加载”并提供“重试”；两个视口均确认无 fixture 文案，重试发出 55 个重新请求、保留 URL 和几何。每个视口的整体趋势绘图区高度为 `85px`，研发关键环节趋势为 `75px`；详细 bounds 与重试证据位于同一候选 `candidate-evidence.json` 的 `teamPlotGeometryEvidence` / `teamTransientStateEvidence.error.retry`。独立 Reviewer 已对 UI-TD-06 和 TEAM-GEO-01 两档 PASS；UI-TD-03 的用户接受例外亦已由 Reviewer 两档复验关闭。真实业务数据仍未验证。

#### 当前登录 Chrome 版本范围补充核对 — 2026-10-10

从总览的 SCC 团队详情入口进入，保持事实周期 `2026-10`。在版本控件上用键盘切到团队所属的 `演示版本 2026-04—2026-06` 后，URL 成为 `?version=1&period=2026-10`；周期没有重置。页面文案明确说明“当前值按版本过滤”，领域参照为“所有团队且不限版本”。当前演示数据中，SCC 周期 AI 覆盖需求数/工作量为 `2` / `10 人天`，领域参照仍为 `5` / `25 人天`；本月两侧都无事实，保持缺失。用键盘恢复“全部版本”后 URL 回到 `?period=2026-10`，展示值恢复为 `5` / `25`。这确认了当前页面的两个数据范围和选定时间保留；实际网络请求范围仍以固定 Golden 候选的 request log 为准。本次 CUA 观察没有显示版本菜单弹层，不将它当作弹层已打开的证据；候选 E2E 的 Team 版本选择记录包含指针打开截图、Escape/焦点和请求证据。该环境是演示数据，不能满足真实业务数据验收。

#### 当前 Chrome 版本范围补充核对 — 2026-10-13

在独立的新 Chrome 标签页打开 SCC 团队详情，事实月份为 `2026-09`、周期为本半年度，切换到团队所属的 `演示版本 2026-07—2026-09`。真实浏览器 URL 变为 `/analytics/teams/1?month=2026-09&version=2&period=2026-09&cycle=half`，月份与统计周期保留。页面文案显示当前团队按所选版本过滤、领域参照为所有团队且不限版本；研发关键环节分别显示 SCC 值和领域参照值（例如 SA设计渗透率 56% / 43%）。[2560×1215 当前浏览器截图](../../e2e-results/overview-visual-2026-10-12T18-08-16-050Z-36716/overview-visual/supplemental-current-browser/team-detail-version-2-2560x1215.png) 是补充观察，不属于 1920×1080 或 2560×1440 正式验收视口；数据为本地演示数据。此补充截图没有网络日志。同一固定-Golden候选在两个正式视口的 request log 记录：切到 `version=1` 后当前团队指标请求（metric 1–14）均带 `version_id=1`，领域参照指标请求（metric 15–16）省略 `version_id`；汇总查询分别带 `version_id=1` 和 `version_id=all`。选择前后的月份均为 `2026-09`，团队 KPI 从全部版本的有值结果变为所选版本无值，页面数据发生变化。该请求日志证明候选中的请求范围，不是上方实时 Chrome 截图的网络记录。

## 完成门禁和未验证边界

2026-10-14 最新 `npm run gate` 通过：

2026-10-15 用户确认 Activity 14-42、Capability 15-02、Team Detail 14-42 两档整页对照并接受当前差异；总览此前已确认。四页视觉验收完成。真实业务数据验证按用户决定留待后续，仍未验证，不属于本次视觉交付的通过项。

2026-10-13 在上述状态同步后再次运行 `npm run check:docs`、`npm run test:docs` 和 `git diff --check`：文档检查通过、文档测试 1/1 通过、diff 空白检查退出码 0。该检查结果不改变页面确认和开放 Issue 状态。

## Current effective-review candidate — 2026-10-14

### 研发能力 Issue 与 Reference/实际证据

| Issue | 1920×1080 Reference/实际 | 2560×1440 Reference/实际 | 判定 |
|---|---|---|---|
| UI-CAP-10 有效检视状态/团队热力图 | [CAP-REF-03](../../e2e-results/overview-visual-2026-10-14T15-02-39-071Z-31372/overview-visual/capability-refinement-2026-10-10/1920x1080/CAP-REF-03-team-heatmap-reference-actual.png) | [CAP-REF-03](../../e2e-results/overview-visual-2026-10-14T15-02-39-071Z-31372/overview-visual/capability-refinement-2026-10-10/2560x1440/CAP-REF-03-team-heatmap-reference-actual.png) | Reviewer PASS，两档关闭 |
| UI-CAP-11 有效检视趋势 | [CAP-REF-02](../../e2e-results/overview-visual-2026-10-14T15-02-39-071Z-31372/overview-visual/capability-refinement-2026-10-10/1920x1080/CAP-REF-02-status-and-trends-reference-actual.png) | [CAP-REF-02](../../e2e-results/overview-visual-2026-10-14T15-02-39-071Z-31372/overview-visual/capability-refinement-2026-10-10/2560x1440/CAP-REF-02-status-and-trends-reference-actual.png) | Reviewer PASS，两档关闭 |
| UI-CHART-RESIZE-01 四趋势图同页 resize | [1920 after shrink](../../e2e-results/overview-visual-2026-10-14T15-02-39-071Z-31372/overview-visual/ui-chart-resize-01/1920x1080-after-shrink-trend-row-reference-actual.png) | [2560 after expand](../../e2e-results/overview-visual-2026-10-14T15-02-39-071Z-31372/overview-visual/ui-chart-resize-01/2560x1440-after-expand-trend-row-reference-actual.png) | Reviewer PASS，4 hosts 在卡片内，两档关闭 |

完整 Capability 整页对照：1920 [CAP-REF-06](../../e2e-results/overview-visual-2026-10-14T15-02-39-071Z-31372/overview-visual/capability-refinement-2026-10-10/1920x1080/CAP-REF-06-full-page-reference-actual.png)；2560 [CAP-REF-06](../../e2e-results/overview-visual-2026-10-14T15-02-39-071Z-31372/overview-visual/capability-refinement-2026-10-10/2560x1440/CAP-REF-06-full-page-reference-actual.png)。两档几何与选择证据在 [interaction-and-geometry-evidence.json](../../e2e-results/overview-visual-2026-10-14T15-02-39-071Z-31372/overview-visual/capability-refinement-2026-10-10/interaction-and-geometry-evidence.json)，四图 resize 在 [geometry.json](../../e2e-results/overview-visual-2026-10-14T15-02-39-071Z-31372/overview-visual/ui-chart-resize-01/geometry.json)。

有效数/有效率是 synthetic Golden 上的公式验证，不是真实业务数据：2026-09 全团队有效意见数 18、总意见数 32、比率 56.25%（页面显示 56%）；无意见保持缺失，已有意见但有效数为零保持 0。既有 `mrr-count` / `mrr-rate` 序列未改变。

**整页确认：**用户于 2026-10-15 接受研发能力 15-02 的两档整页差异；同次确认也接受 Activity 14-42 与 Team Detail 14-42。真实业务数据验证按用户决定留待后续，状态仍为 DEFERRED/UNVERIFIED。

## Activity 14-42 独立复验 — 2026-10-14

独立 Reviewer 对当前 14-42 研发活动页按批准 Reference 和当前 Issue Ledger 逐项复验。[1920](../../e2e-results/overview-visual-2026-10-14T14-42-24-294Z-4132/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/activities-1920x1080-full-page-reference-actual.png) 与 [2560](../../e2e-results/overview-visual-2026-10-14T14-42-24-294Z-4132/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/activities-2560x1440-full-page-reference-actual.png) 的全页 Reference/实际板及 [1920 几何](../../e2e-results/overview-visual-2026-10-14T14-42-24-294Z-4132/overview-visual/sibling-visual-candidate/1920x1080/activities/geometry.json)、[2560 几何](../../e2e-results/overview-visual-2026-10-14T14-42-24-294Z-4132/overview-visual/sibling-visual-candidate/2560x1440/activities/geometry.json) 与交互/状态记录一并复验。UI-ACT-01..19 在两档均 PASS；未发现新问题。14-42 与 19-34 的完整页图哈希不同，但两档几何相同、API 指标序列/汇总相同；趋势、团队差异、工作量和原始摘要区块裁图逐字节相同。R2/R3 issue 裁图一致，R4 仅统计周期弹层截图哈希不同；Reviewer 复查未发现弹层位置、选项或交互状态变化。变化集中在图表渲染像素，没有几何或语义差异。用户于 2026-10-15 接受 14-42 当前整页差异；此确认不代表真实数据验收。

| Issue | 1920×1080 | 2560×1440 | 复验证据 |
|---|---|---|---|
| UI-ACT-01 | PASS | PASS | 当前两档整页 Reference/实际板与几何见 [candidate-evidence.json](../../e2e-results/overview-visual-2026-10-14T14-42-24-294Z-4132/overview-visual/sibling-visual-candidate/candidate-evidence.json) |
| UI-ACT-02 | PASS | PASS | 同上 |
| UI-ACT-03 | PASS | PASS | 同上 |
| UI-ACT-04 | PASS | PASS | 同上 |
| UI-ACT-05 | PASS | PASS | 同上 |
| UI-ACT-06 | PASS | PASS | 同上 |
| UI-ACT-07 | PASS | PASS | 同上 |
| UI-ACT-08 | PASS | PASS | 同上 |
| UI-ACT-09 | PASS | PASS | 同上 |
| UI-ACT-10 | PASS | PASS | 同上 |
| UI-ACT-11 | PASS | PASS | 同上 |
| UI-ACT-12 | PASS | PASS | 同上 |
| UI-ACT-13 | PASS | PASS | 同上 |
| UI-ACT-14 | PASS | PASS | 同上 |
| UI-ACT-15 | PASS | PASS | 同上 |
| UI-ACT-16 | PASS | PASS | 同上 |
| UI-ACT-17 | PASS | PASS | 同上 |
| UI-ACT-18 | PASS | PASS | 同上 |
| UI-ACT-19 | PASS | PASS | 同上 |

## 真实业务数据核查 — 2026-10-14

只读检查当前配置的本地 SQLite：4 个团队、12 条 IR（12/12 的 `record_source` 为 seed）、2904 条 FactRecord（2904/2904 的 `entered_by` 为演示种子）；新意见源表在启动迁移前不存在。未读取或输出业务行内容。当前截图和公式结果只证明固定 Golden/演示种子路径，真实业务数据验收仍未验证。

## 四页整页视觉确认 — 2026-10-15

用户已确认当前四页最终整页结果：总览此前已确认；本次分别接受研发活动 Candidate 14-42、研发能力 Candidate 15-02 和团队详情 Candidate 14-42 的当前差异。每页均以 1920×1080 与 2560×1440 Reference/实际整页板为审阅对象。该决定确认的是视觉构图差异，不会把 Golden 或演示数据视为真实业务数据。

| 页面 | 用户确认的候选 | 1920×1080 Reference/实际整页 | 2560×1440 Reference/实际整页 | 区块 Reviewer 状态 |
|---|---|---|---|---|
| 研发总览 | 已确认候选 | [Reference](reference/01-overview.png) · [实际截图](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/1920x1080/full/overview-full-page.png) | [Reference](reference/01-overview.png) · [实际截图](../../e2e-results/overview-visual-2026-10-12T19-34-15-126Z-20188/overview-visual/2560x1440/full/overview-full-page.png) | Overview 六组 UI issue 已关闭；用户已确认整页 |
| 研发活动 | 14-42 | [整页对照](../../e2e-results/overview-visual-2026-10-14T14-42-24-294Z-4132/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/activities-1920x1080-full-page-reference-actual.png) | [整页对照](../../e2e-results/overview-visual-2026-10-14T14-42-24-294Z-4132/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/activities-2560x1440-full-page-reference-actual.png) | UI-ACT-01..19 两档 PASS |
| 研发能力 | 15-02 | [整页对照](../../e2e-results/overview-visual-2026-10-14T15-02-39-071Z-31372/overview-visual/capability-refinement-2026-10-10/1920x1080/CAP-REF-06-full-page-reference-actual.png) | [整页对照](../../e2e-results/overview-visual-2026-10-14T15-02-39-071Z-31372/overview-visual/capability-refinement-2026-10-10/2560x1440/CAP-REF-06-full-page-reference-actual.png) | UI-CAP-10/11 与 UI-CHART-RESIZE-01 两档 PASS |
| 团队详情 | 14-42 | [整页对照](../../e2e-results/overview-visual-2026-10-14T14-42-24-294Z-4132/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/team-detail-1920x1080-full-page-reference-actual.png) | [整页对照](../../e2e-results/overview-visual-2026-10-14T14-42-24-294Z-4132/overview-visual/sibling-visual-candidate/comparisons/sibling-page-review/team-detail-2560x1440-full-page-reference-actual.png) | UI-TD-03 用户接受差异并由 Reviewer 复验；其余当前区块复验通过 |

真实业务数据仍未验证：默认 SQLite 只含种子/演示数据，没有真实 AI MR 检视意见记录。用户于 2026-10-15 决定本次视觉验收通过，真实数据后续处理。Golden/演示记录不能替代真实数据验证；后续可通过本地 AIReviewOpinion API 接入真实意见记录。本次四页视觉 Change Design 已完成，真实数据状态作为延期事项保留，未标记为 PASS。

用户随后于 2026-10-15 回复：“本次视觉验收通过，真实数据后续再处理。”本记录将其记为四页整页视觉验收通过；真实数据验证按用户决定移出本次视觉交付范围，状态仍为 DEFERRED/UNVERIFIED，不表示数据 PASS。

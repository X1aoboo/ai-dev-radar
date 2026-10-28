# 需求活动看板适配

## Status
Completed

## Background

需求数据管理页已按设计活动 / 开发活动两个页签重构，并把 IR/SR/AR 降为记录类型字段；但研发总览、研发活动页和团队下钻仍保留临时 IR 口径：只读取设计记录中 `requirement_type=IR` 的数据，且月份按 `completed_at` 聚合。需求侧的新活动维度、SR 类型和开发记录不会进入看板。

本变更要解决看板与新需求记录口径不一致的问题，同时避免把独立的设计/开发记录简单相加造成重复计数。

## Requirement

- 设计活动、开发活动各自独立计算，不跨活动相加；不使用设计/开发切换器，同屏分组展示。
- 只统计进展为“完成 / 已关闭”的记录；月份按设计时间/开发时间归集。
- 四张环节卡保留：SA设计、SE设计取设计记录；开发设计、编码开发取开发记录；测试用例生成/执行继续使用 FactRecord。
- 研发活动页上方 SA设计、SE设计、开发设计、编码开发四项同步换源；测试与 DTS 保留 FactRecord。
- 原始指标摘要改为：设计活动 AI 覆盖数、开发活动 AI 覆盖数、测试用例生成数、测试用例执行数。
- 团队下钻版本筛选同时作用于设计/开发两个活动；领域参照仍为同时间范围、不限版本的有值团队等权均值。
- 渗透率分母保持“AI 使用状态已维护的记录”；`AI适用性` 暂不影响 KPI。
- 计数单位为活动记录；不按需求编号跨活动去重，不合并为“唯一需求数”。

## Current Behavior

- 总览四项 KPI、覆盖说明、核心趋势、团队表现和团队预览使用 `/api/data-metrics/overview` 的临时 IR 聚合；该接口只读取设计记录中 `requirement_type=IR` 的类型。
- 研发活动页上方 KPI/趋势和研发关键环节使用 `/api/compute` 的 FactRecord；下方页面级 Team Difference、AI 覆盖拆解、工作量趋势和固定六项原始摘要复用 IR 聚合。
- 团队下钻整体表现、核心趋势和领域参照复用同一 IR 聚合；版本筛选只覆盖设计 IR。
- 需求开发记录没有看板聚合接口；设计 SR 和开发记录不进入任何看板 KPI。
- 业务口径见 [Analytics](../../business/analytics.md)，临时映射见其中“研发总览临时 IR KPI 映射”。原决策见 [ADR-0016](../../adr/0016-requirement-design-and-development-activity-records.md) 第 6 条。

## Target Behavior

### 总览

- 月度核心成效：设计活动一行 4 张 KPI，开发活动一行 4 张 KPI。
- 周期整体成效：同样两组，各 4 张。
- 核心趋势：2×2 四张图，分别为设计渗透率、设计提效、开发渗透率、开发提效。
- 团队表现：8 列矩阵（设计 4 + 开发 4）；选中团队预览 4 张小图。
- 研发关键环节：四张需求角色卡按角色字段独立计算，测试两卡保留 FactRecord；卡片显示来源。
- 覆盖说明区分“设计活动记录数”和“开发活动记录数”，不合并。

### 研发活动页

- SA设计、SE设计、开发设计、编码开发四项使用需求角色指标；测试用例生成、执行和 DTS 继续使用 FactRecord。
- 下方页面级 AI 属性覆盖、原始摘要和团队差异始终展示双活动，不随左侧活动选择变化。
- 原始摘要四项：设计 AI 覆盖数、开发 AI 覆盖数、测试用例生成数、测试用例执行数；移除 IR/AR 与不可派生文档数。

### 团队下钻

- 整体表现改为设计/开发两组 KPI，各 4 项；核心趋势展示两组渗透率/提效。
- 版本筛选同时过滤设计/开发记录；开发记录按自身 `version_id` 过滤。
- 领域参照仍按同时间范围、同活动、所有团队、不限版本的有值团队等权。
- 环节卡与总览一致；成熟度保持独立评估，不做口径改造。

## Design

设计与实现拆成数据聚合、后端查询、前端布局和一个可评审原型；原型评审通过后再进入编码。

### 数据与聚合

- 复用设计表 `IRRequirement` 与开发表 `DevelopmentRequirement`；不新增表。
- 活动级设计：AI 使用 = SA 或 SE 任一为“是”；工作量优先旧总量字段，否则 SA+SE 求和。
- 活动级开发：AI 使用 = 实现设计或开发任一为“是”；工作量为实现设计+开发求和。
- 角色级：SA/SE 使用各自 AI 标志和工作量字段；实现设计/开发同理；不跨角色合并。
- 过滤：`progress in (完成, 已关闭)`；时间字段为设计时间/开发时间（内部兼容 `completed_at`）。
- 空值：AI 状态未知不进入渗透率分母；工作量不完整不进入提效；无记录显示“暂无记录”，不补零。

### 后端

建议扩展现有 `/api/data-metrics/overview`：

```text
GET /api/data-metrics/overview
  ?from_month=YYYY-MM&to_month=YYYY-MM
  &version_id=all|id
  &activity=design|development
  &role=all|sa|se|implementation|development
```

- `activity` 默认 `design`，`role` 默认 `all`，保持响应结构不变。
- `role` 仅允许与活动匹配的枚举，非法组合返回 422。
- 响应继续使用 `period_ids`、`series`、`domain_summary` 及现有点位字段；角色级聚合复用相同字段语义。
- maintainer 仍限定绑定团队；version not found 返回 404。
- 该接口仍是看板专用只读聚合，不改变 `/api/compute` FactRecord 合同。

### 前端

- 将 `frontend/src/overview/irKpiData.js` 泛化为活动 KPI 数据层，总览、活动页、团队下钻共用。
- 新增双活动分组布局、8 列团队矩阵、2×2 趋势、四张角色环节卡和四项原始摘要。
- 活动页四角色换源；FactRecord 活动保留原组件和来源说明。
- 版本筛选同时传两个活动；缺失保持缺失，不回退。

## Prototype

- [可运行原型](../../../prototypes/requirement-activity-dashboard/index.html)
- [评审说明与检查清单](../../../prototypes/requirement-activity-dashboard/README.md)
- v0.2 已按评审反馈改为复用现有 App shell、`PageHeader`、`MetricKpiCard`、`AnalyticsSection`、`AnalyticsPanel`、`TeamMatrix` 和 Activity Directory 的视觉语言；移除深色原型条，评审工具改为右下角浮动入口。
- 覆盖研发总览、研发活动、团队详情三视图；原型内含评审标注和方案说明弹窗。
- 当前评审状态：**已评审通过**。用户确认按该方案实现数据正确性，看板大屏视觉优化作为后续独立变更。

## Business Impact

- 看板从“临时 IR 口径”切换为设计/开发双活动口径；SR 和开发记录首次进入看板。
- 需求类型不再作为统计分组，只保留为记录字段和筛选；旧 IR/AR 标签从看板移除。
- 同一需求编号可能同时出现在设计与开发记录；看板按活动记录计数，不声称唯一需求数。

## Architecture Impact

- 需求数据链路从“设计 IR → 总览临时 KPI”扩展为“设计/开发活动 → 活动/角色聚合 → 总览与下钻”。
- FactRecord 链路保留给测试/DTS 与研发能力页，形成两条明确来源的并行链路。
- 不改变成熟度、权限、采集、导入与持久化模型。

## API / Contract Changes

- `/api/data-metrics/overview` 增加 `activity` 与 `role` 查询参数；响应结构不变。
- 语义变化：默认从设计 IR 改为设计活动全类型，并只纳入完成/已关闭；前端同版本更新。
- 无新增外部服务契约；不改变 Gateway 协议。

## Data Changes

NONE。复用现有表与字段，无迁移、无新增持久化模型。开发记录仍只有页面维护和文件导入，不做历史回填。

## Compatibility

- 响应结构兼容；默认参数兼容旧调用路径，但数值语义按新口径变化，属于本变更的预期行为。
- 旧看板所有 IR 专用消费者需在同一次前端发布中切换，避免新老口径并存。
- 现有 FactRecord 页面、成熟度页面和需求数据管理页不受影响。

## Error & Boundary Handling

- 无记录：返回零计数和空序列，前端显示“暂无记录”，不显示 0% AI 使用率。
- 未知 AI 状态：不计入分母；无已知属性时渗透率缺失。
- 工作量不完整：不计入提效计算；实际值为 0 时沿用现有 0.5 人天回退。
- 非法 `activity`/`role` 组合返回 422；版本不存在返回 404。
- maintainer 无绑定团队时按现有权限处理，不能越权读取其他团队。

## Risks & Trade-offs

- 双活动同屏会增加页面高度和首屏密度；通过分组双行、2×2 趋势和 8 列矩阵控制，但需视觉评审。
- 8 列团队矩阵在 1280 宽下较紧；必要时允许横向滚动或拆行，不隐藏开发活动。
- 开发活动数据覆盖不足会导致部分 KPI 缺失；这是数据事实，不通过补零掩盖。
- 活动页同时存在需求角色与 FactRecord 两种来源，可能增加理解成本；通过来源 badge 和说明降低。
- 旧 IR 口径文档、测试和视觉基线需要整体更新，范围较大。

## Test Strategy

- 后端：活动级/角色级聚合、完成/已关闭过滤、时间字段、版本过滤、团队权限、未知/缺失值、非法参数。
- 前端：KPI 卡、覆盖说明、2×2 趋势、8 列矩阵、四角色卡、四项原始摘要、活动页换源、空态。
- 文档：`npm run check:docs`、`npm run test:docs`。
- 浏览器：1920×1080、1280×800 下无页面横向溢出；活动页目录、矩阵和趋势可读；原型评审记录。
- 兼容：旧 `/api/compute` FactRecord 页面不受影响；成熟度和能力页回归。

## Documentation Impact

- Business Design: UPDATE `docs/business/analytics.md` — 替换临时 IR 口径、原始摘要和双活动说明。
- Architecture: UPDATE `docs/architecture/overview.md` — 更新聚合链路、前端数据流和 FactRecord/需求记录边界。
- Standards: UPDATE `docs/standards/api.md`、`docs/standards/data.md` — 更新 overview 参数、语义和完成/已关闭过滤。
- ADR: CREATE [ADR-0017](../../adr/0017-dashboard-activity-scoped-requirement-kpis.md) — 取代 ADR-0016 第 6 条“分析页不迁移”的决策；其余活动记录决策保留。
- Change Design: UPDATE 本记录 — 原型评审结论、实现结果和验证边界。
- Prototype: CREATE `prototypes/requirement-activity-dashboard/` — 静态评审原型与 README；用户已确认原型，进入实现。

## Validation

- 原型 v0.2 已完成 1920×1080 / 1280×800 浏览器检查；用户确认按该方案开发，并明确先保证数据展示正确性，后续再做看板大屏视觉优化。
- 后端 `npm test`：167 passed，2 pre-existing Starlette/httpx deprecation warnings，0 failed。
- 前端 `npm --prefix frontend run test:unit`：Node 93 passed / 0 failed，Vitest 132 passed / 0 failed；`npm --prefix frontend run build` 通过。
- `npm run check:docs`、`npm run test:docs` 通过。
- Gateway Project E2E：3 passed。
- 使用隔离 SQLite（`/tmp/radar-smoke.db`，重新 seed）和真实 HTTP 做集成验证：`/api/data-metrics/overview` 的 design/development × all/role 请求返回正确计数与工作量；设计活动 2026-10 为 2 条、AI 状态已知 2、AI 辅助 1、完整工作量 1，渗透率 50%，提效 +100%，覆盖 1，节省 5 人天；开发活动同月为 2 条、AI 辅助 1，提效 +60%，覆盖 1，节省 3 人天；SA 角色 2026-10 节省 2 人天。页面实际渲染上述值，无控制台错误，1920/1280 无页面横向溢出。
- 完整 `npm run gate` 在 Overview visual browser evidence 失败：5 项既有视觉 E2E 仍按旧布局期望 8 张 KPI 卡/旧几何，实际为 16 张（双活动各 4 张 × 月/周期）；其余 gate 步骤（Backend、Frontend unit、build、Gateway E2E、docs）通过。该失败与本次双活动布局一致，属于已明确的后续看板大屏视觉优化边界，不在本变更中重做视觉基线。
- 已知验证边界：活动页角色趋势固定使用近六个月月度窗口，时间粒度/周期控件仍驱动 FactRecord；团队下钻角色卡在周/日或全部周期时回退到所选月份；8 列团队矩阵在 1280 下可能横向滚动。

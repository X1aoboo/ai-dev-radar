# 指标字典只读重构

## Status

Completed

## Background

`/settings/metrics` 当前是“指标定义”配置页：左侧活动目录可新增/编辑/删除，右侧维护指标名称、类型、分子/分母语义，另有“源数据指标规则 / 结果查询”Tab。看板指标实际由代码/种子定义，并与图表一一对应；编辑语义或新增指标不会产生图表或数据入口，源数据规则也未接入看板，页面形成了错误的“可配置”预期。用户要求只保留已有指标口径的业务化只读展示。

## Requirement

- `/settings/metrics` 改为只读“指标字典”，不提供指标/活动新增、编辑、删除或规则试算。
- 按活动分组展示已有指标：业务公式、分子/分母业务含义、数据来源、使用位置、缺失值处理。
- 不展示后台字段名、指标代码或表名，全部使用中文业务含义。
- 保留 `/settings/metrics` 路由，导航从“指标定义”改为“指标字典”。
- 删除不再使用的活动/指标写接口、源数据规则接口和 `DataMetricDefinition` 规则引擎/模型/种子/前端。
- 页面使用全宽 `catalog` 内容模式，解决原 1600px 容器周边空白过大的问题。

## Current Behavior

见 [Data Management](../../business/data-management.md)、[Data Management Module](../../architecture/modules/data-management.md)；原页面代码位于 `frontend/src/dataManagement/DataManagementPage.jsx` 的 `MetricManagement`。

## Target Behavior

全宽只读指标字典：PageHeader（只读状态 + 计算方式说明）→ 四格概览 → 搜索/活动类型/指标类型筛选 → 左侧 sticky 活动目录 → 右侧按活动分组的指标口径表 → 只读详情抽屉。指标行展示业务公式、分子/分母业务含义、数据来源、使用位置、口径说明；详情展示公式、计算步骤、缺失处理、定义来源。没有新增/编辑/删除按钮，没有源数据规则 Tab。

## Design

- 新页面 `frontend/src/dataManagement/metrics/MetricDictionaryPage.jsx`、`metricCatalog.js`、`metric-dictionary.css`。
- 只读数据来自 `GET /api/catalog`；公式按 `Metric.type` 和分子/分母语义生成；使用位置按活动类型和指标 code 映射；数据来源区分研发事实与 AI 检视意见。
- 五种计算方式：渗透率、效率提升、数量、比率、布尔；页头“计算方式说明”抽屉解释统一公式和缺失处理。
- 全宽 `catalog` 内容模式在 `App.jsx` 分配，`app.css` 去掉 1600px cap；表格在 1920/2560 均可完整展示，窄屏才横向滚动；表头 sticky 到 Topbar 下方。
- 行点击打开 `FocusRestoringDrawer` 只读详情；`Escape`/关闭按钮返回，不改变列表上下文。

## Business Impact

指标页面从“配置入口”变成“口径解释入口”。业务侧不能再通过页面新增指标或修改公式；新增/修改指标需要设计评审和代码/种子变更。指标与看板的对应关系、数据来源和缺失语义对业务可解释。

## Architecture Impact

后端删除活动/指标写路由、源数据规则 CRUD/compute 路由、`DataMetricDefinition` 模型、seed 和 DTO；保留 `GET /api/catalog`、`GET /api/data-metrics/overview`、`/api/compute` 和 FactRecord 链路。`api.py`/`data_api.py` 的职责收缩为只读目录与既有聚合；`seed.py` CATALOG 继续维护指标声明。前端 `DataManagementPage` 移除 `MetricManagement` 及其编辑器/规则组件，改挂新页面。

## API / Contract Changes

移除：

- `POST /api/activities`、`PATCH /api/activities/{id}`、`DELETE /api/activities/{id}`
- `POST /api/metrics`、`PATCH /api/metrics/{id}`、`DELETE /api/metrics/{id}`
- `GET/POST /api/data-metrics`、`PATCH/DELETE /api/data-metrics/{id}`
- `GET /api/data-metrics/compute`

保留：

- `GET /api/catalog`
- `GET /api/data-metrics/overview`
- `GET /api/compute`
- `GET /api/facts` 等既有事实链路

## Data Changes

`DataMetricDefinition` ORM、seed 和 DTO 移除；新库不再创建 `data_metric_definitions`。既有数据库中的旧表不主动 drop，应用不再读写。无其他迁移。

## Compatibility

看板指标目录、`/api/catalog` 响应结构、`/api/compute` 和 IR `overview` 聚合保持兼容；移除的接口原本只服务被删除的管理页面及其测试，无外部契约声明。`/settings/metrics` 路由与导航角色不变。

## Error & Boundary Handling

目录加载失败显示页面级 Alert，不伪造指标；公式/类型缺失回退到未知提示；搜索无结果显示空状态；详情抽屉无编辑控件；异常/401 继续走共享 session 失效流程。

## Risks & Trade-offs

- 失去页面自助新增指标的能力；这是有意取舍，指标必须与图表/数据链路同时落地。
- 使用位置与数据来源映射是前端静态说明，需随页面/指标变更维护；若未来出现大量指标，考虑后端只读元数据注册表。
- 旧 `data_metric_definitions` 表可能残留，需在后续清理任务中评估；本期不 drop 以避免破坏既有环境。

## Test Strategy

- 后端：`GET /api/catalog` 只读、移除接口返回 404/405、`/api/data-metrics/overview` 仍可用、seed 不再写规则表。
- 前端：指标字典标题/只读状态/分组/业务公式、无新增编辑按钮、无源数据规则 Tab、详情抽屉业务口径、计算方式说明、catalog 内容模式。
- 回归：backend 全量 pytest、frontend `test:unit`、build、docs checks。
- 浏览器：1920×1080 与 2560×1440 检查全宽、表头 sticky、分组、详情抽屉、计算方式说明；窄屏横向滚动。

## Documentation Impact

- Business: UPDATE `docs/business/data-management.md`、`docs/business/analytics.md`。
- Architecture: UPDATE `docs/architecture/modules/data-management.md`、`docs/architecture/overview.md`、`docs/design-knowledge-inventory.md`。
- Standards: 本次 API 删除属于页面范围，`docs/standards/api.md` 无对应端点清单，无需正文变更。
- ADR: CREATE `docs/adr/0013-readonly-metric-dictionary.md`；更新 ADR 索引；ADR-0003 原则不 supersede。
- Change Design: CREATE 本记录；完成验证后移入 completed 并更新两个索引。
- CONTEXT / DESIGN / UX: UPDATE `CONTEXT.md`、`DESIGN.md`、`UX-CONTRACT.md`、`docs/ux/UX-REDESIGN-SPEC.md`。

## Validation

### Automated

- Backend: `npm test` → 143 passed；新增只读接口测试覆盖 `GET /api/catalog` 仍可用，移除的 `/api/activities`、`/api/metrics`、`/api/data-metrics` 写接口和 `/api/data-metrics/compute` 不可用，`/api/data-metrics/overview` 仍通过既有测试。
- Frontend: `npm --prefix frontend run test:unit` → 103 passed；指标字典分组、只读、业务公式、详情抽屉和 `catalog` 内容模式均有渲染测试。
- Frontend build: passed（保留既有大 chunk 警告）。
- Docs: `npm run check:docs`、`npm run test:docs` passed。
- `npm run gate`: backend、frontend、build 均通过；在既有 Overview visual E2E 阶段停止，仍为 3 项与本次指标字典无关的 Overview/Team Detail 视觉验收失败（固定 Golden `monthValue[2]`、Month value-arrow gap、Team Detail version URL）。指标字典没有对应 E2E 回归项。

### Real Browser

- 2560×1440：内容区 2344px，指标表 2048px，15 个活动 / 31 个指标；页面无横向溢出，表头 sticky 到 Topbar 下方。
- 1920×1080：内容区 1704px，指标表 1417px；全部列完整可见，无水平滚动；左侧活动目录 sticky。
- 点击指标行打开只读详情：业务公式、分子/分母含义、数据来源、使用位置、计算步骤和缺失值处理均显示，无保存/编辑按钮；页头“计算方式说明”抽屉正确解释五种计算方式。
- 导航与 Breadcrumb 显示“指标字典”；页面没有“新增活动”“新增指标”“源数据指标规则 / 结果查询”。

### Unverified Boundaries

- 全量 `npm run gate` 仍被既有 Overview/Team Detail 视觉验收项阻断，和本次指标字典改动无关；不把该 suite 记为本次 PASS。
- 既有数据库中可能残留 `data_metric_definitions` 旧表；新模型/种子/接口已移除，但本期不执行 drop 迁移，避免破坏已有环境。

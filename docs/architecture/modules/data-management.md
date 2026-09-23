# Data Management Module

## 职责与接口

`data_api.py` 负责组织层级、正式 IR、临时导入/采集批次、审计查询和源数据指标的 HTTP 编排；`data_management.py` 提供规范化、CSV/XLSX 标准库解析、差异、空字段合并、有效记录筛选和计算。`ir_imports.py` 承接文件导入与采集共用的逐行校验和批次创建。`gateway_api.py` 是 admin-only Gateway 配置、检测、激活、放弃及审计 API；`gateway_config.py` 管理唯一 Active/Draft、revision、Token 复用和不可变 runtime snapshot；`gateway_health.py` 校验 Readiness 响应、保存最新状态并提供 stale/状态转换；`gateway_contracts.py` 是 Readiness 消费端模型。`source_collection.py` 管理窗口、团队隔离和运行记录；`collector_gateway.py` 只负责接收 runtime snapshot 并发同步 Bearer HTTPS 请求，`collector_contracts.py` 是 IR v1 的消费端模型。`schemas.py` 定义 Radar API DTO，`models.py` 定义存储；本模块复用 `auth.py` 与 `db.py`。

前端按需求、问题单、MR、代码检视组织数据源入口。`DataManagementPage` 在需求工作台组合 IR、AR、SR 页签；当前只有 IR 页签连接本模块 API，其他来源使用明确的待定义页面。旧 IR/AR/SR/DTS/MR 页面路径由路由层兼容映射，不改变后端接口。

`DataManagementPage` 与 `App.jsx` 拥有业务路由和交互；共用 `PageHeader`、`FilterToolbar` 及 `frontend/src/design/design-system.css` 中的 `.operational-table`、状态、紧凑反馈和系统管理 workspace 样式。团队/产品使用 shared master-detail，指标目录与源数据规则保持独立 tab；`dataManagement.css` 保留 IR、成熟度、表单和其他页面级工作台布局。IR 筛选与分页保持路由内状态及现有自动查询 API；维护者 IR/成熟度范围从账号绑定团队取值，前端禁用选择并说明原因，后端仍负责授权。正式 IR 使用独立工作区，待确认采集批次只在有内容时显示。导入和采集复用 `ImportPreviewDrawer` 展示暂存元数据、行校验及显式确认。IR 与成熟度在引用数据加载时保持页头/范围筛选结构，Loading 只占工作区；路由级 lazy loading 由 AppShell 的 Suspense 保留共享壳。`App.jsx` 的问题单、MR、代码检视和需求 AR/SR 使用共享 StatusPage 呈现紧凑待定义状态，不建立新数据契约。

`DataManagementPage` 与 `App.jsx` 拥有业务路由和交互；共用 `PageHeader`、`FilterToolbar` 及 `frontend/src/design/design-system.css` 中的 `.operational-table`、状态和紧凑反馈样式。`dataManagement.css` 保留页面表单/网格布局及未纳入 Phase 3 的设置布局。IR 筛选与分页保持路由内状态及现有自动查询 API；维护者 IR/成熟度范围从账号绑定团队取值，前端禁用选择并说明原因，后端仍负责授权。正式 IR 使用独立工作区，待确认采集批次只在有内容时显示。导入和采集复用 `ImportPreviewDrawer` 展示暂存元数据、行校验及显式确认。IR 与成熟度在引用数据加载时保持页头/范围筛选结构，Loading 只占工作区。`App.jsx` 的问题单、MR、代码检视和需求 AR/SR 只渲染紧凑待定义状态，不建立新数据契约。

主要接口为 `/api/data/ir`、`/api/data/ir/imports/preview`、`/api/data/ir/imports`、`/api/data/ir/imports/{batch_id}`、`/api/data/ir/imports/{batch_id}/confirm`、`/api/data/ir/{record_id}/audit-logs`、`/api/collection-schedules`、`/api/collection-schedules/{domain}`、`/api/collection-schedules/{domain}/run`、`/api/gateway`、`/api/gateway/draft`、`/api/gateway/draft/check`、`/api/gateway/draft/activate`、`/api/gateway/active/check`、`/api/gateway/audits`、`/api/data-metrics` 及 `/api/data-metrics/compute`。Gateway 管理接口均为 admin-only；读取 DTO 只给 `token_configured`，不返回 Token。方法和参数以路由、DTO 与运行时 OpenAPI 为准。跨服务能力语义及 Gateway 线协议见 [AI 研发数据网关能力协议](../../contracts/ai-dev-data-gateway/README.md)。

## 临时态与事务

ImportBatch 保存 domain、source_kind、可空 team_id、created_by、pending/confirmed；ImportRow 保存规范化 payload、Gateway source_system、差异、错误、警告、目标及 valid/invalid/applied 状态。旧文件批次的 team_id 保持 NULL。预览持久化临时数据，计算函数不读取它们。CollectionSchedule 按域保存启用状态、hourly/daily/weekly/monthly 节奏及 Asia/Shanghai 时间字段；CollectionRun 保存窗口、触发者、Active 配置 ID/base URL、运行级错误、整体状态和团队级结果，不保存 Token；IR 初始禁用。`gateway_configurations` 的 slot 唯一约束保证全局最多一条 active 与一条 draft，`gateway_health_status` 每个 scope 仅保留最新观察，`gateway_config_audits` 不存凭据。新增表由 `Base.metadata.create_all` 建立，`ensure_gateway_schema()` 为既有 `collection_runs` 增加可空快照和全局错误字段。

确认先检查批次权限、pending 状态和无效行，再逐行重新校验 DTO、层级引用和团队写权限。管理员可查看/确认所有采集批次；维护者只能查看/确认所属团队的采集批次。普通文件预览的 source_kind 固定为 import；仅内部采集路径创建 source_kind=collector 并必须绑定 team_id。按 requirement_no 查询正式记录：不存在则新增，存在则调用 `merge_empty_fields`。更新正式记录、AI 字段元数据、AuditLog、行 applied 及批次 confirmed 在一次事务提交；异常 rollback。采集审计 action 为 `collector_confirm`；页面 PATCH 是显式覆盖，不能复用补空合并语义。

## 数据与计算边界

IR 保存需求标识、产品/版本/迭代、完成日期、责任工号、业务模块与场景、AI 属性和 SA/SE 工作量。全局需求编号唯一，人员匹配不决定归属。DataMetricDefinition 声明字段与筛选，查询有效正式 IR 后实时计算，不持久化指标结果。

IR Gateway 路径使用严格同步 `POST /v1/collections/ir`。Radar 仍按团队编排，但请求只携带 request_id、从团队版本配置和本地层级展开的 `{product_name, version_name}` 列表及带时区半开窗口，不发送团队名称。Gateway 记录最多 10000 条；响应不能包含 Radar 本地 ID 或契约外字段。Radar 按 product_name 与 version_name 联合校验本地版本及请求范围，再在该版本下按 iteration_name 解析；`business_module` 的 null、空字符串和纯空白在暂存前规范化为 `通用模块`。重复 source_id、范围外产品版本、引用缺失/歧义、额外字段或类型错误进入无效行，整批禁止确认。product_versions 配置为空时跳过；空响应成功且不建批次；团队失败继续处理其他团队，不自动重试。

SourceCollectorRegistry 保留原接口，但 IR v1 由 `source_collection.py` 直接经 AI 研发数据网关执行；旧定时任务仍使用 CollectorRegistry 的 FactRecord 链路。采集调度与 `gateway-health-check` 共用当前单进程 APScheduler，不做分布式锁。健康检查启动时立即运行一次，之后每 30 秒运行；Draft 只在人工请求时检测。状态判定包含 AUTH_FAILED、SERVICE_MISMATCH、PROTOCOL_INCOMPATIBLE、readiness 503 的 DEGRADED、连续网络失败 1–2 次 DEGRADED/第 3 次 UNREACHABLE，以及 90 秒 stale。激活 Draft 重新实时检测并核对 revision；新结果只在仍对应当前配置时写回。新鲜的确定性 Active 错误可以写为单条 CollectionRun 全局错误；未知、过期、DEGRADED 或 UNREACHABLE 不阻断真实 IR 请求。ADR-0003 表达源数据优先方向，不意味着旧 `/api/compute` 已切换到 IR。Gateway URL、Token 和超时由设置页存入 Radar 数据库；Token 按 ADR-0010 明文存储，但永不出现在日志、HTTP 输出、审计或 run 中。真实内部 Gateway 尚未联调验证。

## 失败和验证

引用不一致、无效文件/字段或批次错误返回验证失败；越权拒绝；重复资源和重复确认返回冲突。文件解析能力以现有标准库实现为限，不宣称支持任意 Excel 工作簿特性。

核对 `backend/tests/test_data_management.py`、`test_collection_api.py`、`test_source_collection.py`、`test_gateway_config.py`、`test_gateway_health.py`、`test_gateway_api.py`、`test_mock_gateway_contract.py` 和 `test_collector_contracts.py` 的预览/确认、配置生命周期、秘密边界、健康状态、OpenAPI consumer/provider contract、HTTP 传输、窗口、调度、映射及部分失败案例。L3 浏览器 E2E 和总门禁见 [Testing Standards](../../standards/testing.md)。业务语义见 [Data Management](../../business/data-management.md)；决策见 [ADR-0004](../../adr/0004-staged-import-and-field-merge.md)、[ADR-0009](../../adr/0009-versioned-ai-engineering-data-gateway-protocol.md) 与 [ADR-0010](../../adr/0010-database-managed-gateway-runtime.md)。

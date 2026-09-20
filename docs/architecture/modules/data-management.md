# Data Management Module

## 职责与接口

`data_api.py` 负责组织层级、正式 IR、临时导入/采集批次、审计查询和源数据指标的 HTTP 编排；`data_management.py` 提供规范化、CSV/XLSX 标准库解析、差异、空字段合并、有效记录筛选和计算。`ir_imports.py` 承接文件导入与采集共用的逐行校验和批次创建。`source_collection.py` 管理窗口、团队隔离和运行记录；`collector_gateway.py` 负责同步 Bearer HTTPS 请求，`collector_contracts.py` 是符合版本化 OpenAPI 基线的 Radar 消费端模型。`schemas.py` 定义 Radar API DTO，`models.py` 定义存储；本模块复用 `auth.py` 与 `db.py`。

前端按需求、问题单、MR、代码检视组织数据源入口。`DataManagementPage` 在需求工作台组合 IR、AR、SR 页签；当前只有 IR 页签连接本模块 API，其他来源使用明确的待定义页面。旧 IR/AR/SR/DTS/MR 页面路径由路由层兼容映射，不改变后端接口。

主要接口为 `/api/data/ir`、`/api/data/ir/imports/preview`、`/api/data/ir/imports`、`/api/data/ir/imports/{batch_id}`、`/api/data/ir/imports/{batch_id}/confirm`、`/api/data/ir/{record_id}/audit-logs`、`/api/collection-schedules`、`/api/collection-schedules/{domain}`、`/api/collection-schedules/{domain}/run`、`/api/data-metrics` 及 `/api/data-metrics/compute`。方法和参数以路由、DTO 与运行时 OpenAPI 为准。跨服务能力语义及 Gateway 线协议见 [AI 研发数据网关能力协议](../../contracts/ai-dev-data-gateway/README.md)。

## 临时态与事务

ImportBatch 保存 domain、source_kind、可空 team_id、created_by、pending/confirmed；ImportRow 保存规范化 payload、Gateway source_system、差异、错误、警告、目标及 valid/invalid/applied 状态。旧文件批次的 team_id 保持 NULL。预览持久化临时数据，计算函数不读取它们。CollectionSchedule 按域保存启用状态、hourly/daily/weekly/monthly 节奏及 Asia/Shanghai 时间字段；CollectionRun 保存窗口、触发者、整体状态和团队级结果，IR 初始禁用。

确认先检查批次权限、pending 状态和无效行，再逐行重新校验 DTO、层级引用和团队写权限。管理员可查看/确认所有采集批次；维护者只能查看/确认所属团队的采集批次。普通文件预览的 source_kind 固定为 import；仅内部采集路径创建 source_kind=collector 并必须绑定 team_id。按 requirement_no 查询正式记录：不存在则新增，存在则调用 `merge_empty_fields`。更新正式记录、AI 字段元数据、AuditLog、行 applied 及批次 confirmed 在一次事务提交；异常 rollback。采集审计 action 为 `collector_confirm`；页面 PATCH 是显式覆盖，不能复用补空合并语义。

## 数据与计算边界

IR 保存需求标识、产品/版本/迭代、完成日期、责任工号、业务模块与场景、AI 属性和 SA/SE 工作量。全局需求编号唯一，人员匹配不决定归属。DataMetricDefinition 声明字段与筛选，查询有效正式 IR 后实时计算，不持久化指标结果。

IR Gateway 路径使用严格同步 `POST /v1/collections/ir`。Radar 仍按团队编排，但请求只携带 request_id、从团队版本配置和本地层级展开的 `{product_name, version_name}` 列表及带时区半开窗口，不发送团队名称。Gateway 记录最多 10000 条；响应不能包含 Radar 本地 ID 或契约外字段。Radar 按 product_name 与 version_name 联合校验本地版本及请求范围，再在该版本下按 iteration_name 解析；`business_module` 的 null、空字符串和纯空白在暂存前规范化为 `通用模块`。重复 source_id、范围外产品版本、引用缺失/歧义、额外字段或类型错误进入无效行，整批禁止确认。product_versions 配置为空时跳过；空响应成功且不建批次；团队失败继续处理其他团队，不自动重试。

SourceCollectorRegistry 保留原接口，但 IR v1 由 `source_collection.py` 直接经 AI 研发数据网关执行；旧定时任务仍使用 CollectorRegistry 的 FactRecord 链路。采集调度在当前单进程 APScheduler 内按域在线添加/替换或删除 job，不做分布式锁。ADR-0003 表达源数据优先方向，不意味着旧 `/api/compute` 已切换到 IR。Gateway 地址、Token 和超时只来自服务端环境变量；真实内部 Gateway 尚未联调验证。

## 失败和验证

引用不一致、无效文件/字段或批次错误返回验证失败；越权拒绝；重复资源和重复确认返回冲突。文件解析能力以现有标准库实现为限，不宣称支持任意 Excel 工作簿特性。

核对 `backend/tests/test_data_management.py`、`test_collection_api.py`、`test_source_collection.py` 和 `test_collector_contracts.py` 的预览、确认、字段保留、权限、审计、OpenAPI 一致性、HTTP 传输、窗口、调度、映射及部分失败案例。业务语义见 [Data Management](../../business/data-management.md)；决策见 [ADR-0004](../../adr/0004-staged-import-and-field-merge.md) 与 [ADR-0009](../../adr/0009-versioned-ai-engineering-data-gateway-protocol.md)。

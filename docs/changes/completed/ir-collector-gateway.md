# IR 采集 Gateway 防腐层 v1

## Status
Completed

## Background

当前 `SourceCollectorRegistry` 仅预留标准化源数据接口，没有真实平台采集器。文件导入已有逐行暂存和整批确认流程；其校验、确认事务、空字段合并和审计应由采集复用。旧 FactRecord 与 `/api/compute` 是独立兼容链路。

## Requirement

- 首期只接 IR。Radar 实现严格 Gateway 契约、调度、校验、暂存、人工确认与审计；私有 Gateway 实现内部平台访问及字段翻译，本仓库不含其源码。
- Gateway 使用 HTTPS 和 Bearer；地址、Token、超时由环境变量提供，不持久化、不返回前端。生产只接受 HTTPS。
- Gateway 使用同步 `POST /v1/collections/ir`；请求包含 request_id、团队、product_versions 和带时区半开窗口，最多返回 10000 行，超限由操作人缩短窗口。失败使用标准错误对象，不自动重试、不分页、不轮询。
- 按团队独立请求、失败隔离及暂存。版本和迭代按业务名称解析到本地层级；任何无效行阻断整个团队批次的确认。
- 调度配置按数据域持久化，IR 默认禁用；管理员可更新并立即重调度，也可手动使用上一个完整周期或显式窗口运行。
- 管理员可查看和确认所有采集批次；维护者仅能查看、确认所属团队批次。普通文件预览强制 `source_kind=import`。
- 保留旧事实采集与看板链路，不迁移 `/api/compute`，不扩大到 AR/SR 或其他平台数据源。

## Current Behavior

- [源数据业务设计](../../business/data-management.md) 与 [源数据模块](../../architecture/modules/data-management.md) 描述了仅预留采集接口和现有 IR 暂存/确认流程。
- [当前架构](../../architecture/overview.md) 描述进程内事实采集任务和独立 IR 源数据链路。
- `backend/app/data_api.py` 当前负责 IR 行校验、批次预览、确认事务、字段补空和 `import_confirm` 审计；`backend/app/scheduler.py` 只调度旧 FactRecord 采集。

## Target Behavior

- `backend/app/collector_contracts.py` 中的严格 Pydantic 模型是 Gateway v1 JSON Schema 的事实源；提交的 `docs/contracts/collector-ir-v1.schema.json` 由测试与模型逐字节核对。
- Radar 使用一个同步 httpx 客户端逐团队调用 Gateway。网络、超时、HTTP、响应契约错误产生脱敏的运行结果；各团队独立继续。
- 只将合法业务字段映射到 IR；Radar 以 version_name 校验版本及其产品团队归属，再按 iteration_name 校验该版本下迭代。Gateway 响应中不存在 Radar 本地 ID。
- 文件导入与采集共用 IR 校验/暂存函数。每个非空团队结果独立生成带 `team_id` 的批次；空结果成功但不建空批次。CollectorRun 保存本次窗口、状态和逐团队简要结果；不保存凭据或 Gateway 内部错误细节。
- 采集批次确认沿用现有整批 DTO/层级/团队权限重校验、事务写入、只补空字段、AI 来源元数据与审计，采集审计动作名为 `collector_confirm`。
- 新增管理员采集设置页和 IR 采集批次浏览/确认入口；客户端只访问 Radar API，不接触 Gateway 凭据或地址。

## Design

- 后端：严格契约与 Schema 快照放 `backend/app/collector_contracts.py` 和 `docs/contracts/collector-ir-v1.schema.json`；Gateway HTTP 调用使用现有 httpx 依赖及 `MockTransport` 测试。
- 后端：`CollectionSchedule` 存储 domain、enabled、cadence、时间字段、固定 `Asia/Shanghai`、更新人和时间；`CollectionRun` 保存运行窗口及逐团队结果。为现存 SQLite 表使用 `migrations.py` 增量补列/表。
- 后端：保留旧每日任务，新增源数据域任务；每个启用配置对应一个可在线替换的 APScheduler cron 任务。手动接口使用相同的域运行器。
- 后端：抽出文件导入与采集共用的行校验和批次写入函数；`ImportBatch.team_id` 可空以兼容历史文件批次。对外列表允许 source_kind/status/team_id 过滤，并按管理员/团队归属鉴权。
- 前端：新增 `/settings/collections` 管理页面和侧栏入口；用原生日期/时间输入编辑窗口；IR 工作台复用现有 ImportBatch 详情、错误展示和确认刷新。

## Business Impact

IR 增加平台源数据采集，但结果继续在暂存态等待人工确认；运行失败、空结果和部分团队失败均可见。正式 IR 指标仍只读已确认的正式记录。

## Architecture Impact

Radar 主动依赖私有 Gateway 的版本化 HTTPS 契约。采集编排、调度与临时数据归 Radar；内部认证、平台查询和字段翻译归 Gateway。采集域调度与旧事实采集共用当前单进程 APScheduler，但任务、持久化数据和指标链路分离。

## API / Contract Changes

- 新增 `GET /api/collection-schedules`、`PUT /api/collection-schedules/{domain}`、`POST /api/collection-schedules/{domain}/run`。
- `GET /api/data/ir/imports` 增加批次列表及 source_kind/status/team_id 筛选；保留现有详情和确认路径。
- 内部 `POST /v1/collections/ir` 契约、标准错误及 JSON Schema 见 `docs/contracts/collector-ir-v1.schema.json`。

## Data Changes

- `ImportBatch.team_id` 可空，历史文件批次保持 NULL。
- 新增每数据域 `CollectionSchedule` 和运行结果 `CollectionRun` 表；IR 默认配置为 disabled。
- 新增字段须由现有启动 schema 演进方式兼容已有 SQLite 数据库。

## Compatibility

现有文件批次和预览/详情/确认语义保持兼容；旧 FactRecord 采集任务及看板数据不迁移。公共文件预览不能创建 collector 批次；采集专用内部路径写入 source_kind=collector 和所属 team_id。

## Error & Boundary Handling

校验 Gateway TLS 配置、Bearer、超时、request_id 回显、严格响应字段和 10000 行上限。对缺失/歧义版本或迭代、团队不匹配、重复 source_id、非法业务字段和字段类型错误逐行记录错误；不写正式 IR。批次包含任一无效行时返回 422 阻止整批确认。外部错误只保留标准 code/message/retryable/request_id，不把 URL、异常文本或凭据写入日志/API。每团队异常不会阻断后续团队。

## Risks & Trade-offs

- 单进程 APScheduler 在多 worker 下会重复执行，因此部署仍必须单进程；此变更不加分布式锁。
- 没有真实 Gateway/内部平台环境时只能验证契约、MockTransport 与 Radar 浏览器流程；不能把这些结果写成真实平台联调通过。
- 同步首版受超时和 10000 行限制；超量通过缩短窗口处理，不引入分页、异步任务或消息队列。

## Test Strategy

- 后端：Schema 快照；HTTPS/Bearer、超时、标准错误、request_id 和记录上限；周期窗口边界；团队映射、重复与部分失败；在线重调度；批次校验/确认、补空保护、审计和权限。
- 前端：配置/手动触发、角色限制、采集批次列表、无效行阻断、确认后刷新。
- 执行 `npm test`、`npm --prefix frontend run test:unit`、`npm --prefix frontend run build`、`npm run check:docs`、`npm run test:docs`。
- 使用真实浏览器观察配置、手动触发、Radar 网络请求、批次预览和确认；真实内部平台/Gateway 无环境时单列未验证边界。

## Documentation Impact

- Business Design: UPDATE — `docs/business/data-management.md` 更新 IR 采集和批次/权限语义。
- Architecture: UPDATE — `docs/architecture/overview.md` 与 `docs/architecture/modules/data-management.md` 更新职责、调度、Gateway 契约和数据流；`README.md` 与 `.env.example` 说明服务端运行配置。
- Standards: NONE — 现有 Pydantic 信任边界、API 状态码、事务、启动 schema 和测试规范覆盖实现；本次不另建通用规则。
- ADR: CREATE — `docs/adr/0008-ir-collector-gateway.md` 记录长期服务边界、传输及确认决策，并更新 ADR 索引。
- Change Design: CREATE then UPDATE — 本 active 记录指导实施，完成后写实测结果并移入 `docs/changes/completed/`，同步 active/completed 索引。

## Validation

- `npm test -- --basetemp=.pytest-tmp`：116 passed。pytest 默认临时目录不可读，覆盖目录限定在仓库 `backend/.pytest-tmp`。
- `npm --prefix frontend run test:unit`：31 个逻辑测试与 62 个渲染/路由测试通过。
- `npm --prefix frontend run build`：通过；Vite 保留现有 Ant Design/ECharts 大 chunk 提示。
- `npm run check:docs`、`npm run test:docs`：通过。
- 真实浏览器在 `http://127.0.0.1:5173` 登录 admin，保存每周三 05:20 的 IR 计划；浏览器网络日志确认 `PUT /api/collection-schedules/ir` 为 200。指定 `[2026-09-17T01:30+08:00, 2026-09-17T02:30+08:00)` 手动运行后，`POST /api/collection-schedules/ir/run` 为 200，页面与运行记录显示四个团队因 Gateway 未配置而失败，未显示地址或凭据。
- 浏览器通过 IR 工作台打开本地验收库中由共享内部批次构建器预置的 collector 批次，预览 1 行后确认成功；网络日志确认列表、详情和确认请求均为 200。界面显示待确认列表清空及正式 IR 新增 1 条。直接核对验收库记录为 `source_kind=collector`、`status=confirmed`、审计动作为 `collector_confirm`。该预置仅验证 Radar UI/API 确认链路，不代表 Gateway 集成已通过。
- 真实内部平台及 Collector Gateway 联调：未验证。验收环境未配置 Gateway URL/Token；MockTransport 只用于自动化边界测试。

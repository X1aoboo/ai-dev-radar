# AI 研发数据网关能力协议基线

当前版本：`1.0.0`。
状态：Unreleased。

## 服务身份与目标

AI 研发数据网关（AI Engineering Data Gateway，`ai-dev-data-gateway`）是 Radar 与公司内部研发平台之间的防腐层。它把平台认证、查询协议和字段差异收敛为稳定的研发源数据能力，使 Gateway 与 Radar 能按同一协议独立开发和验证。

本基线是当前最新的完整候选能力设计，正式发布前仍可能调整。已发布历史完整基线从 `gateway-contract-vX.Y.Z` Git tag 获取；逐版本变化和当前状态见 [版本索引](../changes/README.md)。

## 能力目录

| Capability ID | 状态 | Major 路径 | 说明 |
|---|---|---|---|
| `requirements.ir.collection` | available | `/v1/collections/ir` | 按产品版本组合和时间窗口查询 IR 源记录 |
| `requirements.ar.collection` | planned | — | 尚未定义，不构成实现承诺 |
| `requirements.sr.collection` | planned | — | 尚未定义，不构成实现承诺 |
| `issues.collection` | planned | — | 尚未定义，不构成实现承诺 |
| `merge-requests.collection` | planned | — | 尚未定义，不构成实现承诺 |
| `code-reviews.collection` | planned | — | 尚未定义，不构成实现承诺 |

能力目录是静态发布清单，不提供运行时 `/v1/capabilities`。只有 `available` 能力可以被 Radar 假设存在；`planned` 只表达演进方向，不能据此实现调用或占位接口。

## 健康端点

Gateway 提供两个 service-level protocol operation 运行探针，不属于静态业务能力目录，也不需要 `x-capability-id`。OpenAPI 用 `x-protocol-operation` 区分它们与业务能力操作：

| Method / path | Authentication | Success | Purpose |
|---|---|---|---|
| `GET /health/live` | None | `200 {"status":"alive"}` | 进程存活探针；Radar 不用它判断业务连接是否可用 |
| `GET /v1/health/ready` | Bearer | `200 HealthReadyResponse` | Gateway 服务就绪及 v1 协议兼容性检查 |

Readiness 成功响应必须包含 `service: "ai-dev-data-gateway"`、`status: "ready"` 和 SemVer `contract_version`。可选的 `upstreams` 只用于提供方诊断，Radar v1 不消费这些值；GDEMate、CodeHub 或 DTS 单个平台异常不得单独令 Gateway 整体 readiness 失败。认证失败返回标准 `GatewayError` 401/403，Gateway 未就绪返回 `GatewayError` 503。请求 ID 在 readiness 错误中由 Gateway 生成。

Radar 仅接受合法的 v1 SemVer 协议版本；服务身份、ready 状态或协议版本不匹配都不能视为已连接。

## 职责边界

Gateway 负责：

- 保存并使用内部平台连接配置和凭据。
- 调用内部平台，处理平台认证、查询机制和平台侧数据组织。
- 把平台字段翻译为本协议的标准源记录。
- 对外执行请求校验，并返回标准成功或错误响应。

Radar 负责：

- 采集计划、周期窗口选择和按团队调用。
- 将业务名称解析为 Radar 本地产品、版本和迭代实体。
- 逐行校验、团队级暂存、人工确认、事务写入和审计。
- 正式源数据及指标计算。

Gateway 不接收或返回 Radar 本地数据库 ID，不直接写 Radar 数据库，不创建正式 IR，不承担人工确认、Radar 指标计算或采集调度。内部平台字段、URL、凭据和原始异常不得穿透到 Radar。

## IR 采集能力

Radar 使用同步 `POST /v1/collections/ir`。每次请求查询一组明确的产品与版本业务名称组合在带时区半开窗口 `[start_at, end_at)` 内的数据。产品版本列表必须非空且不得重复；Gateway 不接收 Radar 团队名称。

`request_id` 用于请求、响应、日志和错误的关联。成功响应必须原样回显；错误响应在请求 ID 可解析时必须回显，否则由 Gateway 生成非空关联 ID。`request_id` 不提供幂等保证，重发或人工重跑可能再次查询同一窗口。

Gateway 返回最多 10000 条记录。v1 不提供分页、异步任务、轮询或自动重试；若结果超限，Gateway 返回不可重试的 422 错误，操作人缩短窗口后发起新请求。空结果以 200 和空数组返回。

记录只包含来源标识、来源系统、产品、版本和迭代业务名称、需求业务字段、工作量及 AI 属性。每条记录的 `product_name` 与 `version_name` 组合必须出现在请求范围内；Gateway 不负责验证这些业务名称是否映射到 Radar 当前团队，Radar 在暂存前按产品与版本联合校验。

`business_module` 字段必须出现，但源平台没有有效值时可以返回 `null`、空字符串或纯空白字符串。Radar 在逐行校验前统一把这些值规范化为 `通用模块`，Gateway 不应自行虚构其他模块名称。

### IR 响应字段语义

| 字段 | 必填 | 业务含义 |
|---|---|---|
| `source_id` | 是 | 源平台中稳定的需求业务标识；Radar 将其作为需求编号使用 |
| `source_system` | 是 | 产生记录的源系统稳定标识，可由 Gateway 适配器配置 |
| `product_name` | 是 | 产品业务名称，与 `version_name` 联合对应请求中的产品版本组合 |
| `version_name` | 是 | 产品版本业务名称，与 `product_name` 联合定位产品版本 |
| `iteration_name` | 是 | 产品版本下的开发迭代期业务名称 |
| `requirement_name` | 是 | IR 的需求名称或标题 |
| `responsible_employee_id` | 否 | 需求责任人的稳定员工工号；无法取得时为 `null` 或省略 |
| `parent_requirement_no` | 否 | 父需求编号；顶层 IR 或无法取得时为 `null` 或省略 |
| `completed_at` | 是 | 需求业务完成日期，格式为 `YYYY-MM-DD` |
| `business_module` | 是 | 需求归属的业务模块；无有效值时允许 `null` 或空白，由 Radar 规范化为 `通用模块` |
| `requirement_scenario` | 是 | 需求所属的业务场景分类，不是需求描述正文 |
| `estimated_workload` | 否 | 需求整体预估工作量，单位为人天 |
| `actual_workload` | 否 | 需求整体实际工作量，单位为人天 |
| `sa_estimated_workload` | 否 | SA 设计预估工作量，单位为人天 |
| `sa_actual_workload` | 否 | SA 设计实际工作量，单位为人天 |
| `se_estimated_workload` | 否 | SE 设计预估工作量，单位为人天 |
| `se_actual_workload` | 否 | SE 设计实际工作量，单位为人天 |
| `ai_assisted` | 否 | 是否使用 AI 辅助研发；`null` 或省略表示未知，不等同于 `false` |

完整字段、约束和示例以 [OpenAPI](openapi.json) 为准。

## 传输与安全

- 生产调用必须使用 HTTPS，认证方式为 HTTP Bearer。
- Radar 以 HTTP Bearer 发送由管理员管理的 Gateway 访问凭据。此线协议不规定 Radar 本地凭据存储方式；双方都不得把调用方凭据写入响应或日志，也不得发送到浏览器。
- Gateway 不得在标准错误中返回上游 URL、凭据、调用栈或内部平台原始异常。
- Gateway 不得跟随会把 Authorization 转发到未知主机的重定向；内部上游重定向策略属于 Gateway 实现，但必须保证凭据边界。
- JSON 请求和响应禁止未声明字段；媒体类型为 `application/json`。

## 错误协议

所有非 2xx 响应使用 `GatewayError`：`code`、脱敏 `message`、`retryable` 和 `request_id`。状态码及 retryable 规则为：

| HTTP | 语义 | retryable |
|---|---|---|
| 400 | JSON 或基础请求结构无效 | false |
| 401 | Gateway 凭据缺失或无效 | false |
| 403 | 调用方无权访问能力或目标 | false |
| 422 | 请求可解析，但窗口、映射、容量或业务约束无效 | false |
| 429 | Gateway 或上游限流 | true |
| 500 | Gateway 未预期内部错误 | true |
| 502 | 上游返回无效响应 | true |
| 503 | Gateway 或上游暂不可用 | true |
| 504 | 上游查询超时 | true |

调用方不得仅凭 HTTP 状态推断是否重跑；必须读取 `retryable`。Radar v1 不自动重试，管理员根据运行结果人工决定是否重跑。

## 兼容与发布

协议使用 SemVer，工作区基线始终表示最新候选版本，并由版本索引区分 Unreleased 与 Released。向后兼容的新能力、端点和可选字段增加 minor；只修正文档、示例或不改变调用语义的问题增加 patch；删除、重命名、类型收窄、增加必填字段或改变语义增加 major。

路径 major 与协议 major 对齐。v1 内不得引入破坏性变化；需要破坏性调整时发布 `/v2`，并在对应版本变更文档中说明 v1/v2 并行期、消费者迁移和退役条件。每个发布都必须同时更新基线、OpenAPI、版本变更文档、版本索引及一致性测试。

Radar 和 Gateway 必须固定 Git tag 或 commit。未发布的基线变动不构成对任一消费者的兼容承诺。

## 非功能边界

Radar 当前默认同步请求超时为 30 秒，部署可以调整；Gateway 实现应在调用方超时预算内完成或返回标准错误。本协议不承诺吞吐量或可用性 SLO，不规定 Gateway 的内部语言、框架、缓存、数据库或上游适配器结构。

真实内部平台和 Gateway 联调不属于协议本身的验证结果，必须在部署环境单独验收。

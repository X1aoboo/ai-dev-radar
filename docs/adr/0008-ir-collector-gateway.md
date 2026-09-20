# ADR-0008: IR Collection Through a Private Gateway

## Status
Superseded

Superseded by ADR-0009: [Versioned AI Engineering Data Gateway Protocol](0009-versioned-ai-engineering-data-gateway-protocol.md).

## Context

Radar 目前只有文件导入的 IR 临时批次；`SourceCollectorRegistry` 是接口预留，旧 FactRecord 采集器服务于兼容看板。公司内部平台认证和查询代码不应进入 Radar 仓库。IR 需要平台数据，同时保留 Radar 对来源校验、人工确认、事务写入和审计的控制。

## Decision

- 私有 Collector Gateway 负责内部平台认证、查询与字段翻译；Radar 负责 IR 契约、调度、HTTPS/Bearer 调用、校验、团队级暂存、人工确认和审计。
- Radar 与 Gateway 使用严格、版本化的同步 HTTPS JSON 契约；Radar 的 Pydantic 模型是 JSON Schema 事实源。生产仅接受 HTTPS；地址、Token 和超时只从环境变量读取。
- 首版 `POST /v1/collections/ir` 按团队同步查询一个带时区的半开窗口。单响应上限 10000 条；不分页、不异步、不自动重试，失败可人工重跑。
- Gateway 返回的版本和迭代业务名称由 Radar 解析并核对当前团队产品层级；Gateway 不接收或返回 Radar 本地数据库 ID。
- 每个团队独立运行并产生独立采集暂存批次。结果始终经整批校验和人工确认后才能写正式 IR；空结果不建批次，任一无效行阻断所在批次确认。
- 采集调度在 Radar 当前单进程 APScheduler 内运行。旧 FactRecord 采集任务和 `/api/compute` 保持原状；首版只覆盖 IR。

## Alternatives Considered

- 在 Radar 内直接访问内部平台：拒绝，内部凭据与平台耦合不属于 Radar 边界。
- Gateway 直接写 Radar 数据库或正式 IR：拒绝，绕过 Radar 的校验、人工确认、补空保护和审计。
- 首版引入通用异步任务/队列、分页或自动重试：拒绝，当前同步请求和操作人缩小窗口足够，额外系统不在首期范围。
- 将采集结果写入 FactRecord 并切换看板：拒绝，IR 是源数据链路，旧事实链路兼容且语义不同。

## Consequences

- 公司内部 Gateway 仓库需复制 Schema 并用相同契约测试验证；其真实实现与平台联调不属于本仓库交付。
- 配置泄露面受限于部署环境变量；Radar 对外只返回脱敏的标准运行错误。
- 失败不会自动重试，管理员需按窗口手动重跑；超过上限需缩短窗口。
- APScheduler 仍要求单进程部署。扩展多 worker 前必须另行设计一次性调度机制。
- 没有真实 Gateway 环境时，MockTransport 和浏览器对 Radar API 的验证不能代表内部平台联调通过。

## Related Design

- [源数据业务设计](../business/data-management.md)
- [当前架构](../architecture/overview.md)
- [源数据模块](../architecture/modules/data-management.md)
- [IR 采集 Gateway 防腐层 v1](../changes/completed/ir-collector-gateway.md)

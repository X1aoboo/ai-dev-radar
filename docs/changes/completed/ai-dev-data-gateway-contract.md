# AI 研发数据网关版本化能力协议

## Status
Completed

## Background

IR 采集已在 Radar 侧实现私有 Gateway 调用，但 Gateway 尚未启动开发。现有设计把 Radar Pydantic 模型及单独 JSON Schema 快照视为契约事实源，不能作为两个仓库并行开发、独立验证和持续演进的实现中立输入。

## Requirement

- 服务正式命名为“AI 研发数据网关”（AI Engineering Data Gateway），仓库及部署标识为 `ai-dev-data-gateway`。
- Radar 仓库维护实现中立的版本化能力协议，Radar 与 Gateway 都作为消费者实现协议。
- 协议由最新完整基线和每版本增量变更文档组成；历史完整基线通过 `gateway-contract-vX.Y.Z` Git tag 获取。
- 首版 `1.0.0` 只完整承诺 `requirements.ir.collection`；其他数据源仅列为 planned，不定义端点或字段。
- OpenAPI 3.1 是 HTTP 线协议事实源；人类可读能力说明书定义职责、语义、限制和治理规则。
- 不创建 Gateway 仓库，不改变 Radar 数据库、采集编排或确认业务行为。

## Current Behavior

- `backend/app/collector_contracts.py` 的 Pydantic 模型生成 `docs/contracts/collector-ir-v1.schema.json`，实现代码是事实源。
- ADR-0008 定义私有 Gateway 边界、同步 IR 调用及暂存确认，但没有独立协议发布和版本变更机制。
- Gateway 名称仍以泛称 Collector Gateway 出现在当前业务和架构设计中。

## Target Behavior

- `docs/contracts/ai-dev-data-gateway/baseline/` 保存最新完整能力说明和 OpenAPI；`changes/` 保存不可变的逐版本变化与索引。
- 基线 OpenAPI、版本索引和最新变更文档版本一致；协议引用和示例可由仓库检查器验证。
- Radar Pydantic 模型通过契约测试证明符合 OpenAPI，但不再生成或拥有线协议；IR 请求以产品名称和版本名称联合标识查询范围，不向 Gateway 暴露 Radar 团队名称。
- 消费者固定 Git tag 或明确审核过的 commit；工作区基线表示最新候选版本，并显式区分 Unreleased 与 Released。

## Design

- 能力说明书定义静态能力目录、职责矩阵、IR 语义、安全、容量、错误、兼容和发布规则。
- OpenAPI 3.1 定义 Bearer HTTPS `POST /v1/collections/ir`，请求使用非空产品版本对列表，响应记录回显 `product_name` 和 `version_name`，并用 `x-capability-id` 关联 `requirements.ir.collection`。
- Radar 继续按团队编排，但从团队版本名称配置和本地产品层级生成 `{product_name, version_name}` 查询对。Gateway 返回的产品版本对必须属于请求范围；现有 Radar 数据库的版本名称全局唯一约束保持不变。
- `business_module` 在线协议中必须出现但允许 `null`、空字符串或纯空白；Radar 在暂存前统一规范化为 `通用模块`，正式数据继续保持非空。
- `changes/1.0.0.md` 记录候选初始发布；版本索引按新到旧列出状态、版本、日期、兼容级别和 tag。
- 文档检查器增加 SemVer、索引唯一性、版本一致性、本地 `$ref`、示例和能力标识检查。
- 后端契约测试读取 OpenAPI，对相同样例同时执行 OpenAPI Schema 与 Pydantic 校验；原 JSON Schema 快照移除。

## Business Impact

Gateway 团队可只依赖发布协议实现 IR 采集能力；Radar 依据同一协议开发和验证客户端。planned 能力不代表可调用或已承诺。

## Architecture Impact

协议基线成为 Radar 与 Gateway 之间的稳定接口，两侧实现均依赖协议而非互相依赖源码。Gateway 只感知产品版本查询范围，不感知 Radar 团队；Radar 的团队编排、团队暂存和人工确认不变。

## API / Contract Changes

- 外部路径仍为 `POST /v1/collections/ir`；请求删除 `team_name`，`product_versions` 从字符串数组改为 `{product_name, version_name}` 对象数组。
- 响应记录新增必填 `product_name`；`business_module` 必须出现但允许无有效值，由 Radar 规范化为 `通用模块`。
- 正式定义 200 及 400、401、403、422、429、500、502、503、504 响应；非成功响应共用标准错误结构。
- `request_id` 只用于请求关联和回显，不提供幂等保证。
- 版本治理采用 SemVer；破坏性变化进入新的 URL major。

## Data Changes

NONE。`business_module` 入库前完成规范化，数据库非空约束和既有数据保持不变。

## Compatibility

`1.0.0` 尚未创建发布 tag，本次在首个正式发布前修正线格式，不承担已发布兼容。旧 `collector-ir-v1.schema.json` 在所有引用和测试迁移后删除，避免双事实源。历史协议通过 Git tag 获取，不在工作区复制全量版本。

## Error & Boundary Handling

- OpenAPI 禁止未声明字段，限制 records 最多 10000 条，并要求请求和响应 request_id 一致。
- 产品版本对不能为空或重复；响应记录超出请求产品版本范围时作为无效暂存行处理，不写正式 IR。
- `business_module` 的 `null`、空字符串和纯空白在 Radar 信任边界统一转换为 `通用模块`，不把缺失值写入非空列。
- HTTP 状态、标准错误 code/message/retryable/request_id、超时和脱敏责任在能力说明中明确。
- 真实 Gateway 尚未实现和联调，协议测试只能确认 Radar 消费端一致性。

## Risks & Trade-offs

- Radar 仓库持有协议降低初期治理成本，但协议修改必须同时评估两个消费者，不能由 Radar 实现细节单方面驱动。
- 最新基线不保存历史副本，消费者必须固定 tag 或 commit；发布标签缺失会破坏历史可追溯性。
- 静态能力清单不反映实例运行时差异，部署配置必须与绑定协议版本一致。

## Test Strategy

- 扩展文档检查器及单元测试，覆盖版本、索引、变更文档、OpenAPI 引用、示例和能力标识。
- 更新后端契约测试，以同一正反样例验证 OpenAPI Schema 和 Pydantic 模型，覆盖产品版本对、响应范围和业务模块规范化。
- 更新采集编排测试，覆盖多产品版本对、请求不包含团队名称、联合匹配及范围外记录拒绝。
- 运行 `npm test`、`npm run check:docs`、`npm run test:docs` 和 `git diff --check`。
- 人工核对仅凭 `1.0.0` 协议即可确定 Gateway IR 实现，不需要阅读 Radar 源码。

## Documentation Impact

- Business Design: UPDATE — `docs/business/data-management.md` 引用正式能力协议并更新职责表述。
- Architecture: UPDATE — `docs/architecture/overview.md`、`docs/architecture/modules/data-management.md` 将协议基线作为跨服务接口。
- Standards: UPDATE — `docs/standards/api.md` 增加跨仓库协议版本及发布规则。
- ADR: CREATE / SUPERSEDE — 新建 ADR-0009，并将 ADR-0008 标记为被替代。
- Change Design: UPDATE — 本 Large 级记录重新激活以同步首发前协议修正，完成后再次归档。
- Domain Language: UPDATE — `CONTEXT.md` 增加 Gateway 和协议治理术语。

## Validation

- `npm test -- --basetemp=.pytest-tmp`：118 passed；仅保留既有 FastAPI/Starlette 弃用警告。
- `npm --prefix frontend run test:unit`：31 个 Node 单元测试及 62 个 Vitest 测试通过。
- `backend/tests/test_collector_contracts.py` 与 `test_source_collection.py` 覆盖产品版本对象、无 `team_name` 请求、联合匹配、请求范围、重复组合及空业务模块规范化。
- `npm run check:docs`、`npm run test:docs`、`git diff --check`：通过。
- 人工核对 OpenAPI、能力说明、版本状态、业务设计与架构描述一致；`business_module` 数据库非空约束未修改。
- 真实 Gateway provider contract、内部平台联调及部署：未验证，Gateway 仓库尚未创建。
- `gateway-contract-v1.0.0` tag：未创建；`1.0.0` 保持 Unreleased，审核合并后才能创建发布 tag。

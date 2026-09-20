# AI 研发数据网关能力协议

本目录是 AI 研发数据网关（AI Engineering Data Gateway，服务标识 `ai-dev-data-gateway`）的协议事实源。Radar 与 Gateway 都消费这里发布的协议，不以任一侧实现代码反向定义协议。

## 阅读路径

- [能力协议基线](baseline/capability-protocol.md)：当前最新、完整的人类可读能力设计。
- [OpenAPI 基线](baseline/openapi.json)：当前最新、完整的 HTTP 线协议。
- [版本变更](changes/README.md)：每个发布版本相对上一版本的增量说明。

当前候选版本：`1.0.0`（Unreleased，尚未创建发布 tag）。

## 基线与历史版本

工作区只保存当前最新的全量基线。`changes/{version}.md` 只描述该版本相对上一版本的变化，不用于独立重建完整协议。已发布历史完整协议通过对应 Git tag `gateway-contract-v{version}` 获取；消费者必须固定已发布 tag 或明确审核过的 commit，不能把 Unreleased 工作区视为稳定依赖。

能力说明书与 OpenAPI 作为一个发布单元：说明书定义职责、业务语义、运行限制和治理规则，OpenAPI 定义 HTTP 路径、认证、字段、类型和响应。两者冲突属于发布缺陷，禁止发布，不设置解释优先级。

## 发布流程

每个版本必须在同一个提交中完成：

1. 更新完整能力说明书。
2. 更新完整 OpenAPI，并同步 `info.version`。
3. 新增 `changes/{version}.md`，不得修改已发布的版本文档。
4. 更新 [版本索引](changes/README.md)。
5. 更新并运行协议一致性测试和文档检查。
6. 审核通过后创建 annotated tag `gateway-contract-v{version}`。

版本使用 SemVer。patch 只做不改变调用语义的修正；minor 增加向后兼容能力、端点或可选字段；major 包含删除、重命名、字段收窄、增加必填字段或改变既有语义。URL major 与协议 major 对齐，破坏性变化必须进入新路径并说明并行迁移安排。

已发布变更文档中的错误通过新的 patch 版本修正，不回写历史。Gateway 仓库应复制或拉取固定发布版本，并以 provider contract test 验证实现；Radar 以 consumer contract test 验证客户端模型与行为。

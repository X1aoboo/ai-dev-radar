# API Standards

## Observed Conventions

HTTP 接口统一位于 `/api`，按资源使用 GET/POST/PATCH/PUT/DELETE。新增请求与响应使用现有 Pydantic DTO 和 response_model，在信任边界验证字段与枚举。需要登录的接口使用后端依赖，前端导航只负责可见性。

沿用 HTTPException 的 `detail`：401 未认证，403 越权，404 不存在，409 资源/状态冲突，422 参数或业务校验失败。detail 当前可为字符串或对象，不伪造已有统一错误码规范。新增前端请求复用 `fetchJson`，204 无响应体。

IR 列表已有分页响应，其他目录列表常为数组；新增列表先复用该领域现有形态。没有已采用的通用分页包、RPC 或 API 版本策略。修改公共接口需在 Change Design 中说明调用者、兼容和回归，保留既有契约除非需求明确改变。

完整方法、参数和 DTO 由 `api.py`、`data_api.py`、`schemas.py` 及运行时 `/openapi.json` 核对，文档不另复制全量字段清单。

## Cross-repository Capability Protocols

跨仓库接口采用 contract-first：实现中立的能力说明书定义职责和语义，OpenAPI 定义 HTTP 线协议，实现模型只作为协议消费者。当前协议基线、逐版本变更与发布规则见 [AI 研发数据网关能力协议](../contracts/ai-dev-data-gateway/README.md)。

协议使用 SemVer；工作区只维护最新完整基线，每个版本另建不可变增量文档，历史完整状态由 `gateway-contract-vX.Y.Z` Git tag 保存。patch 不改变调用语义，minor 只能向后兼容，破坏性变化使用新 major 路径。每次发布必须原子更新能力基线、OpenAPI、版本文档、索引和一致性测试；消费者固定 tag 或 commit，不能依赖未发布工作区。

能力清单区分 available 与 planned。只有 available 能力可以产生端点和消费者依赖；planned 不得创建占位 Schema、路径或兼容承诺。协议冲突视为发布失败，不以任一侧实现作为临时解释来源。

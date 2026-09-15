# API Standards

## Observed Conventions

HTTP 接口统一位于 `/api`，按资源使用 GET/POST/PATCH/PUT/DELETE。新增请求与响应使用现有 Pydantic DTO 和 response_model，在信任边界验证字段与枚举。需要登录的接口使用后端依赖，前端导航只负责可见性。

沿用 HTTPException 的 `detail`：401 未认证，403 越权，404 不存在，409 资源/状态冲突，422 参数或业务校验失败。detail 当前可为字符串或对象，不伪造已有统一错误码规范。新增前端请求复用 `fetchJson`，204 无响应体。

IR 列表已有分页响应，其他目录列表常为数组；新增列表先复用该领域现有形态。没有已采用的通用分页包、RPC 或 API 版本策略。修改公共接口需在 Change Design 中说明调用者、兼容和回归，保留既有契约除非需求明确改变。

完整方法、参数和 DTO 由 `api.py`、`data_api.py`、`schemas.py` 及运行时 `/openapi.json` 核对，文档不另复制全量字段清单。



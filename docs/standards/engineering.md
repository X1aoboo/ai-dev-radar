# Engineering Standards

## Explicit Rules

遵守 [领域语言](../../CONTEXT.md)、[ADR](../adr/README.md) 和 [设计维护流程](../agents/design-maintenance.md)。规则变化应有需求依据，不能把个人推荐写成已有强制约定。

## Observed Conventions

- 后端路由编排 HTTP、认证及事务；事实/成熟度/源数据计算留在现有独立模块。沿用现有 helper 与边界，不为每个实体增加 service/repository 层。
- ORM 实体在 `models.py`，DTO 在 `schemas.py`；认证复用 `get_current_user`、`require_roles` 及相应团队检查。
- 前端按业务页面组织，复用 `api.js`、路由元数据、EChart 和现有 Ant Design 控件，逻辑与图表配置已有独立文件。
- 后端 Python 使用 snake_case，前端组件 PascalCase、函数 camelCase；保持相邻文件风格。
- 捕获已知业务错误并返回对应 HTTP 状态；写入失败回滚，保留异常原因。调度日志沿用 scheduler 中标准 logging，不新增并行日志体系。

这些为可核对的既有模式，新增相关代码沿用。仓库没有独立 lint/checkstyle 或全局日志格式配置，不引入未经确认的门禁。



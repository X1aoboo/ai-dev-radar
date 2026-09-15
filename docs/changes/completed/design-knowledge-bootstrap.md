# 项目设计知识维护机制初始化

## Status

Completed

## Background

仓库已有领域语言和 ADR，但后续会话缺少统一设计导航与文档完成门禁。用户要求分阶段建立最小可靠基线，保留现有约定。

## Requirement

完成实施计划 Task 1–9；Task 10 独立采用用户指定的侧边栏折叠导航，见 [真实变更](collapsible-sidebar.md)。

## Current Behavior

见 [盘点](../../design-knowledge-inventory.md)。现有 `CONTEXT.md` 和六份 ADR 保留；没有文档校验命令或 CI。

## Target Behavior

`docs/index.md` 导航当前业务、架构、规范、ADR 和变更设计。AGENTS 要求读取设计、核对实现、评估影响、同步正文及完成记录。本地命令对 V1 结构和格式提供可复现检查。

## Design

按业务能力建立两个核心文档；系统架构总览加一个源数据模块文档。术语继续由 CONTEXT 定义，glossary 只导航。历史 ADR 不修改正文，新 ADR 使用明确模板。Node 标准库实现校验器，复用仓库 Node 运行环境，不增加依赖。

## Business Impact

CREATE 业务基线；无产品行为变化。

## Architecture Impact

CREATE 系统和源数据架构基线；运行关系不变。

## API / Contract Changes

NONE；HTTP API 不变。新增开发者文档校验命令。

## Data Changes

NONE；不迁移数据库、不修改演示数据。

## Compatibility

保留原 AGENTS 规则与 CONTEXT。现有 0001–0005 简版 ADR 使用精确文件名兼容名单；0006 中文模板等价校验。未来文件必须满足新格式。

## Error & Boundary Handling

链接解码后按文件所属目录解析；外链不做网络探测。忽略 fenced code 中的模板示例。active 中 Completed、completed 中非 Completed、非法 ADR 状态、缺失章节或替代目标不存在均返回非零。

## Risks & Trade-offs

静态文档校验无法证明设计语义和代码一致。既有 ADR 状态缺失保留为未知。没有真实需求时不能完成 Task 10，也不能借模拟业务变更宣称流程有效。

## Test Strategy

运行校验器和 Node 原生测试：有效记录、坏链接、缺失目录、ADR 格式/替代关系、active/completed 状态错误。核对基线中的关键 API、计算规则与代码。

## Documentation Impact

- Business Design：CREATE `docs/business/index.md` 及核心能力基线。
- Architecture：CREATE `docs/architecture/overview.md` 和源数据模块。
- Standards：CREATE engineering/api/data/testing；UPDATE 领域文档导航。
- ADR：NONE；创建使用说明，不补写历史决策。
- Change Design：CREATE 本记录；Task 1–9 验证后完成，真实 dogfooding 独立记录。
- Navigation：CREATE `docs/index.md`、glossary；UPDATE README、AGENTS。

## Validation

Task 1–9 已落盘：入口、核心业务/架构、四类规范、ADR 与 Change Design 协议、AGENTS 增量规则、本地校验器及其 Node 回归。没有已有 CI，因此提供本地命令。`npm run check:docs` 与 `npm run test:docs` 通过；后端基线 95 项测试通过。

保留历史 ADR/CONTEXT，没有补写历史决策。新会话阅读路径为 AGENTS → docs/index → 相关基线；未单独启动新 Codex 会话测试遵循程度，规则是软约束，不保证所有后续会话绝不遗漏语义更新。真实开发按新流程完成见侧边栏记录；Docker、MySQL、真实采集不在本次运行验证范围。



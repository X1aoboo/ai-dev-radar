# Architecture Decisions

## Existing Records

| ADR | 内容 | 已记录状态 |
|---|---|---|
| [0001](0001-store-raw-counts-compute-rates-in-dashboard.md) | 原始数与率计算 | 未显式记录 |
| [0002](0002-collector-interface-reserved-manual-only-mode.md) | 预留采集及补录 | Superseded by 0003 |
| [0003](0003-source-data-first-metrics.md) | 源数据优先 | 未显式记录 |
| [0004](0004-staged-import-and-field-merge.md) | 临时态与字段合并 | 部分被 0012 取代（文件导入覆盖模式） |
| [0005](0005-team-owned-product-hierarchy.md) | 团队产品层级 | 未显式记录 |
| [0006](0006-monthly-maturity-assessment.md) | 月度成熟度 | Accepted，原文记录 2026-09-15 |
| [0007](0007-business-source-navigation.md) | 数据管理按业务数据源分类 | Accepted |
| [0008](0008-ir-collector-gateway.md) | IR 通过私有 Gateway 采集并先暂存确认 | Superseded by 0009 |
| [0009](0009-versioned-ai-engineering-data-gateway-protocol.md) | AI 研发数据网关采用实现中立的版本化能力协议 | Accepted |
| [0010](0010-database-managed-gateway-runtime.md) | 数据库托管 Gateway 运行配置、健康检查与项目 E2E 门禁 | Accepted |
| [0011](0011-ai-review-opinion-source-and-effectiveness-metrics.md) | AI 检视意见本地源记录与有效性指标 | Accepted |
| [0012](0012-ir-excel-import-upsert-and-field-registry.md) | IR Excel 导入采用显式更新模式与字段注册表 | Accepted，2026-10-20 |
| [0013](0013-readonly-metric-dictionary.md) | 指标字典只读，指标口径由代码与种子定义 | Accepted，2026-10-20 |
| [0014](0014-team-personnel-and-source-mapping-boundary.md) | 团队人员聚合与产品版本、数据源映射解耦 | Accepted，2026-10-20 |
| [0015](0015-collection-scope-and-admin-context-boundaries.md) | 采集范围从产品/PI 派生，管理页按上下文投影解耦 | Accepted，2026-10-20 |
| [0016](0016-requirement-design-and-development-activity-records.md) | 需求数据按设计与开发活动独立记录，类型降为字段 | Accepted，2026-10-27；第 6 条由 0017 取代 |
| [0017](0017-dashboard-activity-scoped-requirement-kpis.md) | 看板需求 KPI 按设计/开发活动独立统计 | Accepted，2026-10-28 |

历史简版正文保留，0006 的中文标题视为模板等价章节。缺失状态和历史原因保持未知，不补造接受记录。校验器只为既有简版文件保留兼容，新文件使用以下格式。

## When and How

跨模块、长期约束、明显多方案取舍、基础设施/技术选型或关键事务/通信变化需要评估 ADR；普通 CRUD、局部 bug 或 DTO 调整通常无需 ADR。编号取当前最大四位序号加一，文件为 `XXXX-description.md`，编号唯一。

Status 为 Proposed / Accepted / Deprecated / Superseded。新 ADR 写 Context、Decision、Alternatives Considered、Consequences 和 Related Design。接受后的正文保留历史；改变决策时新增 ADR，在旧记录只更新状态与 `Superseded by ADR-XXXX` 链接，并在新记录反向关联。

## Template

```markdown
# ADR-XXXX: Decision Title

## Status
Proposed

## Context
需求、约束与决策原因。

## Decision
最终选择。

## Alternatives Considered
合理候选及未采用原因。

## Consequences
收益、代价与风险。

## Related Design
- 当前设计链接
```

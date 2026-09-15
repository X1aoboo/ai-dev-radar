# Architecture Decisions

## Existing Records

| ADR | 内容 | 已记录状态 |
|---|---|---|
| [0001](0001-store-raw-counts-compute-rates-in-dashboard.md) | 原始数与率计算 | 未显式记录 |
| [0002](0002-collector-interface-reserved-manual-only-mode.md) | 预留采集及补录 | Superseded by 0003 |
| [0003](0003-source-data-first-metrics.md) | 源数据优先 | 未显式记录 |
| [0004](0004-staged-import-and-field-merge.md) | 临时态与字段合并 | 未显式记录 |
| [0005](0005-team-owned-product-hierarchy.md) | 团队产品层级 | 未显式记录 |
| [0006](0006-monthly-maturity-assessment.md) | 月度成熟度 | Accepted，原文记录 2026-09-15 |

历史简版正文保留，0006 的中文标题视为模板等价章节。缺失状态和历史原因保持未知，不补造接受记录。校验器只为这五个具体简版文件保留兼容，新文件使用以下格式。

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

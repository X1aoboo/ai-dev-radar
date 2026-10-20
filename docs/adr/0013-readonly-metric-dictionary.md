# ADR-0013: 指标字典只读，指标口径由代码与种子定义

## Status

Accepted

## Context

当前“指标定义”页面把看板指标目录做成了可增删改的配置页：管理员可以新增活动、指标，编辑名称、类型和分子/分母语义，另有一个 IR 源数据规则/结果查询 Tab。但看板指标与图表一一对应，实际计算由 `compute.py` 基于 `FactRecord` 的分子/分母完成，`numerator_semantic` / `denominator_semantic` 只是业务展示文案，不是字段映射；新增指标不会自动出现在图表，也没有对应的数据录入路径。源数据规则虽然能对 IR 字段试算，但字段是自由字符串、未接入看板，且只在自身结果查询中使用。

这使页面看起来能“配置指标”，实际只能修改种子元数据，容易造成错误预期；修改 `type` 还可能改变既有事实的解释。指标目录、公式和图表使用关系属于代码与种子维护的产品定义，不应由业务页面直接改写。

## Decision

- 看板指标目录、类型、分子/分母业务语义由代码/种子维护，`GET /api/catalog` 作为只读目录接口。
- `/settings/metrics` 改为只读“指标字典”，按活动分组展示业务公式、分子/分母业务含义、数据来源、使用位置和缺失处理，不提供新增、编辑、删除、规则试算或后台字段名。
- 删除 `/api/activities`、`/api/metrics`、`/api/data-metrics` 的写接口及 `/api/data-metrics/compute`；移除 `DataMetricDefinition` 模型、种子和前端规则查询。保留 `/api/data-metrics/overview` 作为研发总览 IR 聚合的既有只读契约。
- 不提供通用指标配置。未来若需要自助定义指标，必须另行设计字段注册表、聚合/筛选、校验、权限、审计、试算和所有看板消费者接入，并新增 ADR。

## Alternatives Considered

- **保留可编辑目录并增加字段映射**：需要字段选择器、公式模型、校验、数据录入和全部看板消费者改造，范围接近平台级指标引擎；当前没有明确的业务配置需求，成本与风险不成比例。
- **保留只读页面但继续暴露活动/指标写 API**：会留下无 UI、无数据入口且可改变公式解释的接口，增加误用风险，因此删除。
- **完全移除指标页面**：指标与图表对应关系仍需要业务解释，保留只读字典比隐藏定义更有价值。

## Consequences

- 新增或修改指标必须通过设计评审、代码/种子变更和测试，不再有 UI 自助配置；这是有意的约束。
- 指标字典成为口径解释入口，必须与 `seed.py` CATALOG、`compute.py` 公式和实际看板使用位置保持一致。
- 旧 `DataMetricDefinition` 表在既有数据库中可能仍存在，但应用模型、种子、接口和页面均不再使用；新库不再创建该表。
- ADR-0003 的“指标必须可追溯到源数据/计算规则”原则继续成立；本 ADR 只移除不完整的通用配置入口，不改变该原则。

## Related Design

- [指标字典与只读指标口径重构](../changes/completed/metric-dictionary-readonly.md)
- [源数据优先，AI 指标由源数据计算](0003-source-data-first-metrics.md)
- [IR Excel 导入采用显式更新模式与字段注册表](0012-ir-excel-import-upsert-and-field-registry.md)
- [源数据、组织与权限管理](../business/data-management.md)
- [Data Management Module](../architecture/modules/data-management.md)

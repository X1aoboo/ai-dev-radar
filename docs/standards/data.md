# Data Standards

## Explicit Rules

- [ADR-0001](../adr/0001-store-raw-counts-compute-rates-in-dashboard.md)：事实保存原始数，计算层负责率。
- [ADR-0003](../adr/0003-source-data-first-metrics.md)：新数据管理以源数据为正式数据；计算结果不直接编辑。
- [ADR-0004](../adr/0004-staged-import-and-field-merge.md)：导入先临时态，整批确认；文件导入的更新模式由 ADR-0012 扩展。
- [ADR-0005](../adr/0005-team-owned-product-hierarchy.md)：团队/产品/版本/迭代归属一致。
- [ADR-0006](../adr/0006-monthly-maturity-assessment.md)：月度成熟度独立，Decimal 保持等级边界，缺失不等于零。
- [ADR-0012](../adr/0012-ir-excel-import-upsert-and-field-registry.md)：IR 文件导入支持 `upsert`（默认）和 `fill_empty`，字段元数据由注册表驱动。
- [ADR-0016](../adr/0016-requirement-design-and-development-activity-records.md)：需求数据按设计活动与开发活动独立记录；设计活动沿用 `ir_requirements`，开发活动新增独立表；IR/SR/AR 降为类型字段。
- [ADR-0017](../adr/0017-dashboard-activity-scoped-requirement-kpis.md)：看板需求 KPI 按设计/开发活动独立统计；只纳入完成/已关闭记录，不跨活动相加或去重。

## Observed Conventions

ORM 使用整数主键及业务唯一约束；新约束参照对应实体，不能只依赖页面检查。日期采用 Date，审计时间使用 UTC 无时区 datetime；周/月计算按 Asia/Shanghai，跨边界需显式转换。

事务由路由/采集编排，相关正式记录、来源元数据与审计一起提交，失败回滚。session 通过 `get_db` 关闭。当前 schema 演进使用启动 ensure 函数；新增持久字段需设计现有库兼容，不将 create_all 当成通用迁移工具。设计活动的新模板字段均为可空兼容列，`requirement_type` 与导入更新模式使用默认值；旧记录不回填业务推断值。开发活动新增独立 `development_requirements` 表及模型，不改 `ir_requirements` 列、不迁移或回填历史设计数据；`ImportBatch.domain` 与 `AuditLog.domain` 增加 `development` 取值，`ensure_development_schema()` 负责既有库增量启动。

文件导入严格按所属活动模板的必填、列顺序和枚举校验；IR Gateway 采集保留 legacy 规则，只提供旧字段，类型缺省 IR，不要求新模板必填。旧 pending 文件批次在确认时按当前活动模板重新校验，不符合时要求重新预览；采集批次保留 legacy。开发活动只允许文件导入，不建立采集链路。新必填只约束新建和文件导入，历史记录不追溯判无效。

看板需求 KPI 只读聚合设计/开发活动记录：只纳入进展为完成或已关闭的记录，月份按 `completed_at`（设计时间/开发时间）归集；计数单位为活动记录，不跨活动去重。渗透率分母为对应活动/角色 AI 使用状态已维护的记录，AI 状态未知不进入分母；效率只对 AI 使用为“是”且预估、实际工作量完整的记录计算，实际值非正时沿用 0.5 人天回退。该聚合不新增持久化模型或迁移，不写回业务数据，也不改变 FactRecord 链路。

已有删除为实体相关的物理删除及引用检查，没有全局软删除、统一缓存或通用并发控制策略。新增行为以需求为依据。测试和验证不得碰开发数据库；seed 会清空业务数据，不能用于日常验收修复。

# Data Standards

## Explicit Rules

- [ADR-0001](../adr/0001-store-raw-counts-compute-rates-in-dashboard.md)：事实保存原始数，计算层负责率。
- [ADR-0003](../adr/0003-source-data-first-metrics.md)：新数据管理以源数据为正式数据；计算结果不直接编辑。
- [ADR-0004](../adr/0004-staged-import-and-field-merge.md)：导入先临时态，整批确认，匹配记录只补空字段；手工覆盖与审计独立处理。
- [ADR-0005](../adr/0005-team-owned-product-hierarchy.md)：团队/产品/版本/迭代归属一致。
- [ADR-0006](../adr/0006-monthly-maturity-assessment.md)：月度成熟度独立，Decimal 保持等级边界，缺失不等于零。

## Observed Conventions

ORM 使用整数主键及业务唯一约束；新约束参照对应实体，不能只依赖页面检查。日期采用 Date，审计时间使用 UTC 无时区 datetime；周/月计算按 Asia/Shanghai，跨边界需显式转换。

事务由路由/采集编排，相关正式记录、来源元数据与审计一起提交，失败回滚。session 通过 `get_db` 关闭。当前 schema 演进使用启动 ensure 函数；新增持久字段需设计现有库兼容，不将 create_all 当成通用迁移工具。

已有删除为实体相关的物理删除及引用检查，没有全局软删除、统一缓存或通用并发控制策略。新增行为以需求为依据。测试和验证不得碰开发数据库；seed 会清空业务数据，不能用于日常验收修复。



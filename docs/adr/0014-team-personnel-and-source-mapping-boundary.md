# ADR-0014: 团队人员聚合与产品版本、数据源映射解耦

## Status

Accepted

## Context

团队与人员页面此前把团队名称、成员、产品版本映射、代码仓地址和数据源映射混在一起。`Team.source_mapping` 实际是 Gateway/采集使用的集成配置，产品、版本和迭代则由 Product → ProductVersion → Iteration 聚合维护；在团队人员页面编辑版本和仓库既与产品版本页重复，也让人员管理难以理解。团队成员角色同时是自由文本，出现“研发工程师/测试工程师”等与业务角色不一致的值。

产品与版本页面已经通过产品的 `team_id` 建立团队归属，不再需要团队页重复维护产品版本信息。

## Decision

- `/settings/teams` 只管理团队名称和成员：全宽团队人员目录、全部成员列表、行内编辑、团队/成员创建弹窗。产品版本、代码仓和数据源映射不在该页面出现。
- 团队角色统一为 SA、SE、MDE、开发、测试；系统登录角色 admin/maintainer/viewer 保持独立。历史自由文本角色在页面上标记为历史值，可通过行内编辑改为标准角色。
- `Team.source_mapping` 作为 Gateway/采集的持久化集成字段保留；团队人员页面不读写它。团队创建只要求名称，`source_mapping` 可省略并落为空映射；更新团队名称不清除既有映射。前端不依赖该字段。
- 产品、版本、迭代及其团队归属继续由产品与版本页面维护；团队页不复制这些关系。
- 未来若需要管理 Gateway 映射，应放在数据网关/集成配置的独立界面，而不是重新耦合回团队人员页。

## Alternatives Considered

- **保留团队页的产品版本/仓库映射**：会继续与产品版本页重复，且把人员主数据与集成配置混在一个页面；不采用。
- **从产品/版本层级自动派生 Gateway 映射并删除 `source_mapping`**：语义最干净，但会改变 Gateway 采集范围、映射校验和历史兼容，属于独立的采集架构改造；本期保留持久化字段，避免扩大范围。
- **完全删除 `source_mapping` 字段**：破坏既有 Gateway/采集数据和兼容路径；不采用。

## Consequences

- 团队人员页边界清晰，产品/版本数据只在产品与版本页维护；团队创建和编辑表单只包含名称。
- Gateway 映射暂时没有管理 UI，仍由持久化/种子和后续集成配置入口维护；这是已知边界，不把空白 UI 伪装成可配置。
- 团队角色标准化由前端选项和新种子保证；历史数据可增量修正，不通过破坏性迁移强制改写。
- 团队人员页的 API 仍返回 `source_mapping` 以保持契约兼容，但页面不使用它。

## Related Design

- [团队人员页面重构](../changes/completed/team-personnel-refactor.md)
- [源数据、组织与权限管理](../business/data-management.md)
- [Data Management Module](../architecture/modules/data-management.md)
- [团队拥有的产品层级](0005-team-owned-product-hierarchy.md)
- [数据库托管的 Gateway 运行配置](0010-database-managed-gateway-runtime.md)

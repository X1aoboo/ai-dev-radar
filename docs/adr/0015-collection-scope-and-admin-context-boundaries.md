# ADR-0015: 采集范围从产品/PI 派生，管理页按上下文投影解耦

## Status

Accepted

## Context

数据采集实际依赖 `Team.source_mapping.product_versions` 决定团队要采集哪些版本。团队人员页不再展示该字段后，新建/导入团队会带着空映射进入采集，被静默跳过；同时数据采集页读取完整 `/api/gateway` 配置并展示地址/Token，身份页读取完整团队对象。这些做法把 Gateway 集成配置、采集团队范围、身份绑定和团队人员数据耦合在一起。

产品/PI 层级已经是团队拥有的唯一事实源；Gateway 连接状态只需要被采集页读取，不需要复制配置。

## Decision

- IR Gateway 的采集范围从团队下的 Product/ProductVersion（PI）层级自动派生；`Team.source_mapping.product_versions` 不再参与 IR 采集，只保留为历史/旧采集链路的持久化兼容字段。团队没有 PI 时跳过并记录 skip 结果。
- 新增 `GET /api/gateway/status` 只读投影：configured/status/stale/last_known_status/checked_at/latency_ms/contract_version/error_code/error_message；不返回 base URL、Token、Draft 或审计。数据采集页只读该投影。
- 新增 `GET /api/teams/options` 只读 id/name，供用户与权限页维护者团队绑定；身份上下文不读取 `source_mapping`、产品/PI 或 Gateway 数据。
- 采集计划接口返回只读 `CollectionScopeOut(team_count/pi_count/derived_from=product_pi)`，页面展示范围但不写回。
- 数据网关、数据采集、用户与权限统一使用全宽 `admin` 页面；Gateway 不显示采集/用户，Collection 不显示 Gateway 配置细节，Users 不显示产品/PI/Gateway。
- 未配置或 Gateway 硬错误时，采集页禁用启用/立即采集；DEGRADED/UNKNOWN/过期允许并警告。

## Alternatives Considered

- **把团队 PI 映射移到 Gateway 页配置**：保留子集语义，但 Gateway 需要读取组织/产品上下文，页面和边界更重；本次选择取消重复映射。
- **继续隐藏 `source_mapping`**：新团队会被静默跳过，功能不可解释；不采用。
- **Collection 继续读取完整 `/api/gateway`**：会重复展示地址/Token，破坏上下文边界；不采用。
- **Users 继续读取 `/api/teams`**：会把集成字段带进身份上下文；改用轻量 options。

## Consequences

- 团队下所有 PI 自动纳入采集范围；不再支持按团队选择 PI 子集。如果未来需要子集，应新增独立的采集范围配置并重新评审，而不是复用人员页字段。
- 新团队/导入团队不会再因空 `source_mapping` 被跳过；没有 PI 的团队仍然跳过并明确标识。
- Gateway 配置、采集运行、身份数据各有独立读写路径；页面之间只通过只读投影/选项引用。
- 无数据库结构变更；`source_mapping` 字段保留，不执行 drop。
- 采集页的 Gateway 状态与配置页可能短暂不一致，但状态有 `checked_at/stale` 语义，页面应展示过期/未知。

## Related Design

- [管理页 UI 与上下文边界重构](../changes/completed/admin-management-pages.md)
- [源数据、组织与权限管理](../business/data-management.md)
- [Data Management Module](../architecture/modules/data-management.md)
- [数据库托管的 Gateway 配置与健康检查](0010-database-managed-gateway-runtime.md)
- [团队拥有的产品层级](0005-team-owned-product-hierarchy.md)

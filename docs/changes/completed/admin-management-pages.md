# 管理页 UI 与上下文边界重构

## Status

Completed

## Background

数据网关、数据采集、用户与权限三个页面仍使用 1120/1600px 居中布局，信息稀疏；数据采集读取完整 Gateway 配置并展示连接细节，身份页读取完整团队对象。更关键的是，IR 采集范围依赖 `Team.source_mapping.product_versions`，团队人员页不再维护它后，新团队/导入团队会被静默跳过。需要按已确认高保真方案重构三个页面并收口上下文边界。

## Requirement

- 数据网关：全宽状态摘要 + Active/Draft 双栏 + 启用检查清单/配置审计；配置编辑使用紧凑弹窗；不显示采集/用户数据。
- 数据采集：全宽 Gateway 就绪条（只读状态）、采集范围、定时/手动并排、全宽运行历史；不显示地址/Token/Draft；采集范围由产品/PI 自动派生。
- 用户与权限：全宽账号摘要 + 表格 + 角色说明；团队绑定使用轻量 id/name；新增/编辑弹窗；不显示产品/PI/Gateway。
- 新增 `GET /api/gateway/status` 与 `GET /api/teams/options`；采集计划返回 scope 摘要。
- 未配置/硬错误禁用采集启用和立即采集；DEGRADED/UNKNOWN/过期允许并警告。
- 保持现有强约束：Token 不回显、当前账号/最后管理员保护、维护者必须绑定团队。

## Current Behavior

见 [Business](../../business/data-management.md)、[Architecture](../../architecture/modules/data-management.md)；旧页面为 `GatewaySettingsPage`/`CollectionsSettingsPage`/`UsersSettingsPage`。

## Target Behavior

三页使用全宽 `admin` 内容模式；Gateway 以状态/双栏/检查清单/审计组织；Collection 只读 Gateway 投影、展示派生范围、side-by-side 表单、全宽历史；Users 全宽表格 + 角色说明 + 弹窗。上下文之间只通过只读投影/选项引用。

## Design

- `App.jsx` 为三个路由分配 `admin` 内容模式；`app.css` 增加全宽 admin 外壳；`settings/admin-pages.css` 提供摘要、双栏、面板、检查清单、审计、表格和 modal 样式。
- Gateway 页保留现有配置/检测/激活/放弃逻辑，配置 drawer 改为 Modal；状态摘要/Active/Draft/检查清单/审计按高保真重排。
- Collection 页改用 `/api/gateway/status`，不读取 `/api/gateway`；scope 从 `/api/collection-schedules` 响应读取；加入 guard。
- Users 页改用 `/api/teams/options`，新增摘要、搜索/角色筛选、角色说明、Modal。
- 采集范围派生在 `source_collection.py`：按团队产品/PI 生成请求，无 PI 团队 skipped。

## Business Impact

管理员能在一屏内看清 Gateway 状态和候选配置、采集计划和运行结果、账号角色；采集范围跟随产品/PI 层级，不再因隐藏映射静默漏团队。页面之间数据和责任边界明确。

## Architecture Impact

Gateway 配置/健康/审计、Collection 计划/运行/批次、Identity 用户/角色/团队绑定各自拥有数据；Collection 仅读取 Gateway status 投影和 Product/PI 派生 scope；Identity 仅读取 team options。`source_mapping` 保留兼容但不参与 IR 采集。

## API / Contract Changes

新增：

- `GET /api/gateway/status`（admin）：只读 readiness 投影，无地址/Token/Draft/审计。
- `GET /api/teams/options`：id/name。
- `GET /api/collection-schedules` 增加 `scope: {team_count, pi_count, derived_from}`。

修改：

- `source_collection` 不再读取 `Team.source_mapping.product_versions`；无 PI 团队 skip message 改为“团队未配置产品/PI，已跳过。”

## Data Changes

无表结构迁移；`source_mapping` 字段保留但不再用于 IR 采集。不新增采集范围表。

## Compatibility

Gateway 配置/健康/审计原有接口不变；Collection schedule/run 接口向后兼容新增 scope 字段；用户接口不变。既有 `source_mapping` 数据与旧采集链路保留。

## Error & Boundary Handling

- Gateway status 读取失败：Collection 禁用采集并显示可重试错误。
- 未配置/硬错误：禁用启用和立即采集，链接 Gateway；DEGRADED/UNKNOWN/过期允许并警告。
- 无 PI 团队：运行结果为 skipped，不请求 Gateway。
- 用户页保留当前账号/最后管理员/维护者绑定保护；Token 永不出现在页面或日志。

## Risks & Trade-offs

- 采集范围变为团队全部 PI，不再支持按团队选择子集；若后续需要，应新增独立范围配置并重新评审。
- 采集页状态与 Gateway 页可能短暂不同；依赖 checked_at/stale 展示。
- 全宽 admin 页信息密度提高；低高度下使用页面滚动。

## Test Strategy

- 后端：gateway status 投影不泄露配置；team options 轻量；collection scope；派生采集范围/无 PI skip；现有 gateway/collection/auth 回归。
- 前端：Gateway 状态/草稿/审计；Collection 就绪条/scope/guard；Users 表格/角色/options/modal；admin 内容模式。
- 浏览器：1920/2560 三页、Gateway 配置弹窗、配置/draft 状态、采集空历史/未配置 guard、用户新增弹窗。
- 回归：backend pytest、frontend unit/build、docs checks、gate。

## Documentation Impact

- Business: UPDATE `docs/business/data-management.md`、`CONTEXT.md`。
- Architecture: UPDATE `docs/architecture/modules/data-management.md`、`docs/architecture/overview.md`（如涉及）。
- Standards: NONE；接口投影由 API/架构文档记录。
- ADR: CREATE `docs/adr/0015-collection-scope-and-admin-context-boundaries.md`，更新 ADR 索引。
- Change Design: CREATE 本记录；完成后移入 completed 并更新索引。
- DESIGN/UX: UPDATE `DESIGN.md`、`UX-CONTRACT.md`，纳入 admin 页面、Gateway/Collection/Users 边界与 guard。

## Validation

### Automated

- Backend: `npm test` → 152 passed；新增 Gateway status 投影测试（不含地址/Token/Draft/审计）、Team options 轻量测试（仅 id/name）、Collection scope 摘要；`test_source_collection.py` 改为从 Product/PI 派生并覆盖无 PI skip。
- Frontend: `npm --prefix frontend run test:unit` → 108 passed；覆盖 Gateway 状态/草稿/审计、Collection 未配置 guard/scope、Users 表格/角色/options/Modal、admin 内容模式。
- Frontend build: passed（保留既有大 chunk 警告）。
- Docs: `npm run check:docs`、`npm run test:docs` passed。
- Gateway Project E2E: 3 passed；已从旧 drawer 断言更新为 Gateway 配置 Modal、Collection 就绪条和手动采集表单。
- `npm run gate`: backend、frontend、build、Gateway Project E2E 通过；仍在既有 Overview visual E2E 的 3 项 Overview/Team Detail 视觉验收失败处停止，与本次三页重构无关。

### Real Browser

- 2560/1920：三页均为全宽 `admin`，内容区 2344/1704px，无页面横向溢出。
- Gateway 配置态（临时样例）：状态摘要、Active/Draft、启用检查清单、配置审计、配置 Modal 均正常；样例已在验证后清理。
- Collection 未配置态：就绪条显示未配置，立即采集/启用计划禁用并提示先配置 Gateway；采集范围显示 4 团队 / 2 PI；页面不出现 Gateway 地址、Token、Draft。
- Users：账号摘要、全宽表格、角色说明、新增账号 Modal 正常；团队绑定通过 options 获取。
- Gateway E2E 覆盖真实 Mock Gateway 配置 → 测试 → 启用 → 采集 → 运行历史，以及 Draft 失败保留 Active。

### Unverified Boundaries

- 全量 `npm run gate` 仍被既有 Overview/Team Detail 视觉验收项阻断；不把该 suite 记为本次 PASS。
- 真实内部 Gateway 联调仍需部署环境；本地使用 Mock Gateway/E2E 契约验证。
- 采集范围现在为团队全部 PI，不再支持按团队选择 PI 子集；若需要子集，应另行设计独立采集范围配置。
- `source_mapping` 字段保留但不再参与 IR 采集，旧采集链路兼容性由既有测试覆盖。

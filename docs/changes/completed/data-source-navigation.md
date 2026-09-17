# Data Source Navigation

## Status

Completed

## Background

当前数据管理导航把 IR、AR、SR、DTS、MR 作为同级数据域，并把未实现项收在“未开放”分组中。这混淆了需求层级与数据源分类，也不利于后续按来源扩展工作台。

## Requirement

数据管理按需求、问题单、MR、代码检视四类数据源提供一级菜单。IR、AR、SR 是需求内部分类，通过需求页面页签切换。侧栏沿用现有 248px/64px 折叠能力，折叠控制改为类似 Google 导航：展开时位于品牌区右侧，折叠后位于 Logo 下方。

## Current Behavior

见 [Business](../../business/index.md)、[Data Management](../../business/data-management.md) 与 [Architecture](../../architecture/overview.md)。当前只有 IR 数据工作台有完整后端和页面能力。

## Target Behavior

- 数据管理直接显示需求、问题单、MR、代码检视四个入口。
- 需求入口进入 `/data/requirements`；页面内显示 IR、AR、SR 页签，IR 保留现有工作台，AR/SR 显示规格待定义。
- 问题单、MR、代码检视入口进入各自待定义页面，不虚构数据能力。
- 旧 `/data/ir`、`/data/ar`、`/data/sr`、`/data/dts` 和历史 data-management 路径重定向到新分类，保留可分享链接兼容性。
- 桌面折叠状态、宽度、动画、角色权限、窄屏抽屉和本地记忆保持不变；只调整控制位置和导航内容。

## Design

复用 AppSidebar、AppShell、Ant Design Tabs、现有 PendingDomainPage 和本地折叠状态。路由元数据定义四类入口；需求页签用 `/data/requirements/{ir|ar|sr}` 子路由保存选择。页面不增加依赖，不新增后端接口。

## Business Impact

数据管理的信息架构从旧数据域枚举改为业务数据源分类。IR/AR/SR 归入需求；DTS 的旧入口兼容映射到问题单。只有 IR 可维护数据，其他分类仍为待定义状态。

## Architecture Impact

前端路由和导航元数据承担新分类与旧路径兼容；DataManagementPage 组合需求页签。AppSidebar 的折叠状态职责不变，CSS 调整品牌区和控制布局。

## API / Contract Changes

无后端 API 变化。新增前端规范路径 `/data/requirements`、`/data/issues`、`/data/mr`、`/data/code-review`；旧路径仅重定向。

## Data Changes

None。数据库模型和现有 IR 数据不变。

## Compatibility

保留旧路径重定向、查询参数、权限过滤、折叠偏好键、桌面/窄屏行为及 IR 工作台能力。

## Error & Boundary Handling

需求页签只接受 ir/ar/sr，未知值回退到 ir。未实现数据源显示明确的待定义页面。存储不可用和窄屏焦点恢复沿用现有处理。

## Risks & Trade-offs

一级入口在能力未实现前会进入占位页；这是有意保留的信息架构，不代表后端已支持。MR 与代码检视的具体字段和关系留待真实需求定义。

## Test Strategy

更新路由和渲染测试，覆盖四类入口、需求页签、旧路径映射、折叠控制位置、角色可见性和无额外请求。运行前端测试、构建、文档检查及真实浏览器桌面/折叠/窄屏验收。

## Documentation Impact

- Business Design: UPDATE `docs/business/index.md`、`docs/business/data-management.md` 和 `CONTEXT.md`，同步数据源分类、需求层级与导航行为。
- Architecture: UPDATE `docs/architecture/overview.md` 和 `docs/architecture/modules/data-management.md`，同步规范路由、页签组合及兼容映射。
- Standards: NONE；现有前端、测试和可访问性规范足够。
- ADR: CREATE `docs/adr/0007-business-source-navigation.md`；明确新业务数据源分类，并说明 ADR-0003 的源数据优先决策继续有效。
- Change Design: CREATE `docs/changes/completed/data-source-navigation.md` 并维护索引。

## Validation

- 前端纯逻辑测试 31 项、Vitest 渲染与路由测试 56 项通过。
- Vite 生产构建通过；保留既有 Ant Design 与 ECharts chunk 超过 500 kB 的提示。
- `npm run check:docs`、`npm run test:docs` 和 `git diff --check` 通过。
- 真实浏览器在桌面和 390×844 视口验证：展开侧栏的折叠按钮位于品牌区右侧；折叠后为 64px 图标栏，Logo 与展开按钮纵向排列；需求、问题单、MR、代码检视入口完整可见且选中态正确；IR/AR/SR 页签更新子路由，AR 显示待定义；问题单入口显示待定义页面；窄屏抽屉完整显示四类入口。
- 折叠不增加请求由渲染测试验证；本次浏览器工具未提供独立网络时间线。未改后端 API、数据库或业务计算，因此未运行后端回归。

# 侧边栏折叠导航

## Status

Completed

## Background

用户指定真实 dogfooding 需求：优化左侧侧边栏，补充折叠式导航能力。

## Requirement

提供可逆的侧边栏展开/折叠；折叠后保留图标导航、选中态、角色可见性和禁用态，释放内容宽度。按钮可通过键盘操作，图标提供名称和悬停提示。

## Current Behavior

见 [Architecture](../../architecture/overview.md)。AppShell 使用固定宽度侧边栏，窄屏转换为横向分组，无折叠控制。

## Target Behavior

桌面默认展开，首次进入窄屏默认折叠。侧边栏控制按钮在两种状态都可见；折叠宽度 64px，只显示品牌标记和导航图标，工具提示保留项目名称及待定义状态。当前登录的页面跳转保持选择，刷新恢复视口默认。不新增服务端或持久化偏好。

## Design

AppShell 单个 React 布尔 state，传给 AppSidebar。复用 Ant Design Button、Tooltip 和现有图标库的 MenuFoldOutlined/MenuUnfoldOutlined。CSS 根据 shell class 同步侧栏宽度和正文偏移。窄屏展开使用纵向分组完整导航，折叠改为固定图标栏；浏览器截图发现原横向分组会截断系统管理项，因此在实现中调整为纵向。

## Business Impact

导航交互变化，业务数据及统计规则不变。

## Architecture Impact

仅共享前端 shell 的交互和响应式布局，模块职责不变。

## API / Contract Changes

NONE；沿用路由、查询参数及权限契约。

## Data Changes

NONE；只使用当前 shell 会话 state。

## Compatibility

保留 SIDEBAR_GROUPS 过滤、NavLink 高亮、旧路径重定向及禁用入口。切换不能发起业务请求或修改当前筛选。

## Error & Boundary Handling

折叠项 aria-label 保留名称，待定义项保持 aria-disabled；按钮 aria-expanded 和 aria-controls 对应导航。窄屏正文不得被图标栏遮挡；导航较长时可滚动。

## Risks & Trade-offs

不记忆刷新偏好；视口默认仅在 shell 初始化决定，后续缩放保留用户选择。这是当前需求的最小范围，不增加偏好存储和自动断点状态机。

## Test Strategy

现有路由渲染测试增加折叠/展开及导航契约检查；运行前端测试和 build。使用真实浏览器验证桌面/窄屏折叠、跳转、高亮、提示与截图，并确认切换没有额外业务请求。

## Documentation Impact

- Business Design：UPDATE 业务索引中的公共导航行为。
- Architecture：UPDATE overview 的共享 shell 布局。
- Standards：NONE，复用现有 UI/测试约定。
- ADR：NONE，局部可逆交互无长期架构决策。
- Change Design：CREATE 本 medium 功能记录，验证后归档。

## Validation

前端 31 项 Node 逻辑测试及 47 项 Vitest 渲染测试通过，包含可逆切换、窄屏默认折叠、权限/禁用/高亮及无额外 fetch。Vite build 通过，保留既有大包警告。前端缺失依赖通过锁文件 npm ci 恢复，未改依赖定义。

真实 Playwright 浏览器使用 admin 登录：1440×900 下侧栏 64px、正文从 x=64 开始；折叠后点击 IR 路由为 `/data/ir`、aria-current=page，折叠保持。390×844 刷新后默认折叠，键盘 Enter 展开、点击再次折叠，图标悬停 tooltip 为 IR。两次切换期间业务请求为零；登录、目录与 IR 查询返回 200。初始未登录 auth/me 为预期 401，开发 StrictMode 中一次成熟度请求被取消，重试返回 200。

截图已人工核对：`output/playwright/sidebar-desktop-expanded.png`、`sidebar-desktop-collapsed.png`、`sidebar-mobile-collapsed.png`、`sidebar-mobile-expanded.png`。窄屏展开截图暴露原横向导航截断问题，设计先修订为纵向后实现并复核，系统管理链接完整显示。

Current Design 已同步到 business/index 和 architecture/overview；ADR None，API/存储/授权不变。文档结构检查及校验器回归通过。本记录完成真实 Read → Design → Implement → Validate → Current Design Update → Archive 流程。



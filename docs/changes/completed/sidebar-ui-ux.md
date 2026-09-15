# Sidebar UI and UX

## Status
Completed

## Background
侧栏字号偏小、折叠按钮独占一行、未开放入口干扰日常导航。

## Requirement
浅色侧栏；统一字号与对齐；桌面折叠记忆；窄屏抽屉；不增加依赖或改变权限。

## Current Behavior
见 [Business](../../business/index.md) 与 [Architecture](../../architecture/overview.md)。

## Target Behavior
248px/64px 桌面导航，14px 正文、12px 辅助、18px 图标、40px 行高。未开放分组默认关闭且图标模式隐藏。总览下钻显示所属入口。680px 以下使用默认关闭的抽屉，选择入口、遮罩或 Esc 关闭并恢复焦点。

## Design
复用 AppShell、路由元数据、Ant Design Drawer 与 Tooltip。matchMedia 监听断点；localStorage 只保存桌面折叠布尔值，失败回退正常操作。导航独立滚动、顶部控制固定。

## Business Impact
导航体验改变，业务规则与角色可见性不变。

## Architecture Impact
AppShell 管理桌面偏好和独立抽屉状态。

## API / Contract Changes
None，保留现有路由及查询参数行为。

## Data Changes
无数据库变化；浏览器仅保存侧栏偏好。

## Compatibility
保留已有工作区修改。桌面无偏好默认展开，跨断点关闭抽屉并恢复桌面选择。

## Error & Boundary Handling
存储不可用仍可折叠；禁用项不能跳转；键盘焦点可见；导航溢出独立滚动。

## Risks & Trade-offs
图标模式隐藏未开放入口，需要展开完整侧栏查看。

## Test Strategy
路由测试、前端全套测试与构建；真实浏览器三种角色、断点、刷新、键盘、截图与请求检查。

## Documentation Impact
- Business: UPDATE docs/business/index.md，导航当前行为。
- Architecture: UPDATE docs/architecture/overview.md，状态及存储职责。
- Standards: NONE，沿用现有规范。
- ADR: NONE，局部交互不形成长期架构决策。
- Change Design: CREATE 本记录；完成后归档并维护索引。

## Validation
实现与当前设计同步完成。前端 31 项纯逻辑测试及 50 项渲染测试通过，Vite build 通过（保留已有大 chunk 提示）。

真实 Chromium 主验收 26 项检查通过，覆盖 admin、viewer、maintainer.团队A 的桌面和抽屉角色可见性、导航；1440×900、768×900、390×844 下标签未截断，桌面 248px/64px 宽度与正文偏移一致，窄屏正文无侧栏偏移。刷新保留桌面折叠选择；键盘 Enter 打开抽屉，Esc、遮罩、有效链接关闭后焦点回到打开按钮，跨断点恢复桌面选择。折叠与未开放分组操作、抽屉开关均未新增 API 请求。记录 71 个 API 响应，均为 200。

补充真实浏览器验证团队下钻和指标详情（包括未找到指标时）均显示研发总览所属高亮且不声称 aria-current=page；未开放分组可通过键盘 Enter 展开。存储读取和写入失败回退由渲染测试覆盖。

证据：`output/playwright/sidebar-acceptance.js`、`sidebar-evidence.json`、`sidebar-additional-result.txt`；截图 `sidebar-new-desktop.png`、`sidebar-new-collapsed.png`、`sidebar-new-768.png`、`sidebar-new-mobile.png`、`sidebar-new-drawer.png`、`sidebar-new-zoom200.png`、`sidebar-new-viewer.png`、`sidebar-new-maintainer.png`，已人工复核桌面、抽屉及缩放等效布局。

验证边界：200% 使用 720×450 CSS 视口加 deviceScaleFactor=2 模拟 1440×900 桌面缩放的布局与栅格尺寸，未操作浏览器原生缩放菜单；不宣称浏览器原生缩放操作已验证。初始未登录 auth/me 的 401 与已有 Ant Design Alert 弃用提示不属于侧栏新增问题。后端业务代码未改，未运行后端回归。

运行 check:docs、test:docs 和 git diff --check；人工核对业务、架构正文与代码的导航行为一致。ADR: None；Standards: None。

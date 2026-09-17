# 浅色侧栏与雷达品牌标记重绘

## Status
Active

## Background

当前侧栏与移动抽屉使用深色主题，折叠按钮 hover/active 时辨识度不足，共享雷达标记仍使用斜线渐变。复用现有 AppShell、AppSidebar、CSS 变量、Ant Design 图标和 SVG 即可完成视觉更新。

## Requirement

- 将桌面侧栏和移动抽屉调整为 Google 风格的灰白层级，但不复制 Google 商标。
- 保留 248px/64px 宽度、`ai-dev-radar.sidebar-collapsed` 本地记忆、680px 抽屉断点、240ms 宽度动画、路由与角色权限。
- 折叠态使用 `MenuOutlined`，展开态使用 `MenuFoldOutlined`；保留 Tooltip、ARIA 标签和原生键盘操作。
- 40×40px 折叠按钮在 hover、active、focus-visible 下清晰可辨；按钮新动效遵循减少动态效果设置。
- 重绘共享 32×32 SVG 雷达标记：蓝色圆形雷达环、扫描线和三个数据点，使用实色蓝/青，在 16px 仍清晰。
- 保持当前 working tree 中的数据源导航重构、路由与其他未提交修改，不增加依赖或改变业务请求。

## Current Behavior

见 [Business Design](../../business/index.md) 与 [Current Architecture](../../architecture/overview.md)。当前桌面宽度、折叠记忆、断点、动画、权限过滤和共享 favicon.svg 已由现有实现提供。

## Target Behavior

侧栏表面为 `#F8FAFD`，正文为 `#3C4043`，辅助文字为 `#5F6368`，边框为 `#E0E3E7`。选中项使用 `#D3E3FD` 背景和深蓝文字，无左侧高亮条。桌面抽屉共用此浅色主题。

展开态折叠按钮显示侧栏收起图标，折叠态显示三横线菜单图标。按钮保持 40×40px 圆形点击区，hover 使用浅灰圆形底和 1.06 缩放，active 使用 0.94 缩放，颜色、背景及缩放过渡为 160ms；focus-visible 有清晰轮廓，任何状态都保留可见图标。减少动态效果时关闭新增按钮动效。

## Design

- 只修改现有 `frontend/src/App.jsx` 的菜单图标引用、`frontend/src/app.css` 的侧栏主题和折叠按钮状态、共享 `frontend/public/favicon.svg`。
- 扩展 `frontend/src/routing/routeRendering.test.jsx`，识别并断言展开/折叠图标，同时保护路由、权限、ARIA、折叠记忆和零额外请求。
- 保留 AppSidebar 在顶部品牌区中的按钮布局及折叠时纵向排列，不重构组件或导航数据。
- 使用同一 SVG 供侧栏、抽屉、登录页和 favicon 使用，不增加图片生成或运行时依赖。

## Business Impact

只改变导航和品牌标记的视觉表现；数据源导航、业务能力、角色可见性与路由语义保持不变。

## Architecture Impact

AppShell 与 AppSidebar 职责不变，继续由现有 CSS 变量控制桌面宽度与正文偏移；移动抽屉仍使用 Ant Design Drawer。

## API / Contract Changes

None。无 API、路由、ARIA 控件语义、角色权限或请求变化。

## Data Changes

None。继续使用既有 `ai-dev-radar.sidebar-collapsed` 键和值。

## Compatibility

保留工作区已存在的未提交数据源导航重构。保留 Tooltip、ARIA 标签、键盘激活、localStorage 失败回退、快速反向过渡、680px 行为和共享 SVG 消费路径。

## Error & Boundary Handling

不新增运行时分支；存储和 matchMedia 的现有失败处理不变。减少动态效果设置下禁用新增按钮变换及过渡。

## Risks & Trade-offs

浅色主题需在默认、选中、hover、active 与键盘焦点状态均维持足够对比；16px favicon 细节会受栅格化影响，需在真实浏览器检查。

## Test Strategy

- 前端纯逻辑及渲染测试、Vite production build。
- `npm run check:docs`、`npm run test:docs`、`git diff --check`。
- 真实浏览器检查桌面展开/折叠、hover/active/键盘焦点、快速反向切换、刷新记忆、prefers-reduced-motion、390×844 抽屉、32px Logo 和 16px favicon；核对宽度、文字对比、溢出、导航、权限和请求。

## Documentation Impact

- Business Design: UPDATE `docs/business/index.md`，同步最终配色、选中态、按钮和共享 Logo 描述，并保留数据源导航现状。
- Architecture: UPDATE `docs/architecture/overview.md`，同步 AppSidebar/Drawer 外观与按钮图标行为，保留折叠、路由和请求契约。
- Standards: NONE，既有工程与测试规范不变。
- ADR: NONE，不改变长期架构或 ADR-0007 的导航决策。
- Change Design: CREATE 本 active 记录；完成验证和当前设计同步后移入 completed，并更新两个目录索引。

## Validation

### Automated

- `npm --prefix frontend run test:unit` passed: 31 Node tests and 56 Vitest tests across four files.
- Vite production build passed. It retains the existing warning for ECharts and Ant Design chunks above 500 kB.
- `npm run check:docs`, `npm run test:docs`, and `git diff --check` passed.

### Real Browser

- Chrome opened `http://localhost:5175/data/issues` at 1440×900 and 390×844, using the existing local session without entering credentials.
- Expanded/collapsed widths and body offsets measured 248px/248px and 64px/64px. The collapsed navigation remained 39px wide with no horizontal scroll; desktop and mobile document widths matched their viewport widths.
- Computed contrast was 10.01:1 for navigation text, 5.79:1 for secondary text, and 7.04:1 for selected text. The selected item had no left marker.
- Browser hover showed `#E8EAED`, `#3C4043`, and scale 1.06. Keyboard focus showed a visible 2px `#174EA6` outline and visible icon. Enter expanded and Space collapsed. Reload restored the collapsed preference.
- The 390×844 drawer measured 280px wide with the shared `#F8FAFD` surface. Escape closed it and focus returned to the opener after the drawer transition.
- The shared Logo rendered at 32px in the application. The browser CSSOM contained the active rule (`#DADCE0`, scale 0.94) and reduced-motion overrides.

### Unverified Boundaries

- The browser session did not expose a request timeline. The rendering test verified that toggling does not change the `fetch` call count; an independent browser network count was not captured.
- Reduced-motion CSS parsed with `transition: none` and `transform: none`, but the browser did not expose a media preference emulator, so the `reduce` preference was not activated.
- The `:active` declaration was inspected in the browser CSSOM, but the browser control could not hold a pointer-down state for a screenshot.
- Browser URL policy rejected the temporary data URL used to preview the local SVG at 16px and prohibited workarounds. The SVG's 16px favicon appearance therefore remains visually unverified.

Keep this Change Design Active until the required browser-only checks are completed.

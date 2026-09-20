# 研发总览决策工作台重构

## Status

Completed

## Background

现有研发总览已经具备管理者摘要、成熟度雷达、关注项和事实横向比较，但首屏仍以并列卡片和指标模块组织信息。管理者需要自行把数据覆盖、负提效、相对靠后和成熟度缺失拼成结论，页面缺少从结论到证据再到下钻的清晰决策路径。

业界研发效能产品的公开模式可作为交互参考：组织级视图先给少量核心健康信号，主动暴露风险或例外，并允许按组织层级和指标继续下钻；这些模式不构成本项目的业务口径或行业基准。

## Requirement

- 将总览重组为“决策摘要 → 优先信号 → 效率表现 → 能力画像 → 深入分析”的管理者阅读路径。
- 决策摘要只使用当前月份、当前分类和现有事实，明确数据覆盖与比较边界。
- 优先信号按现有规则显示负提效、成熟度/事实缺失和相对靠后项，并保留指标下钻。
- 保留成熟度、事实指标、团队矩阵、URL、权限和维护能力，不新增指标、目标、行业基准或后端接口。
- 在桌面和移动端保持可读、可操作、无页面级横向溢出，并保留键盘和减少动态效果支持。

## Current Behavior

见 [Analytics](../../business/analytics.md)、[Architecture Overview](../../architecture/overview.md) 和 `frontend/src/overview/`。总览首屏依次展示四张摘要卡、成熟度雷达与关注项、按类型分组的事实表现，再展示能力点明细；矩阵与完整指标比较默认折叠。

## Target Behavior

页头表达当前分析上下文并将筛选控制收拢为工作区工具栏。首屏决策摘要以一句可核对的当前状态结论为核心，配合团队、成熟度、评估覆盖和事实覆盖四个证据值；摘要同时声明没有目标或外部基准时只做领域相对比较。

优先信号紧随摘要并作为行动入口。效率表现保留按指标类型分组和 `company_average` 基线，但强化值、覆盖与下钻的层级。成熟度雷达和能力点明细组合为较低层级的能力画像，完整团队矩阵和指标集中比较继续按需展开。

## Design

- 复用 `OverviewPage.jsx`、`overviewLogic.js`、现有 ECharts/Ant Design、API hooks 和样式变量。
- 在页面组件内从现有 `attentionItems` 和覆盖数据派生决策摘要文案，不增加业务判断阈值。
- 使用现有 `@ant-design/icons` 提供一致的结构图标；不引入新依赖或新状态层。
- 通过 CSS 网格、语义色和响应式断点重组页面；交互仍使用原生按钮、`details/summary` 和已有控件。

## Business Impact

不改变成熟度和事实口径。管理者可更快识别当前月份最需要处理的信号，并看到这些结论所依赖的数据覆盖；“相对靠后”仍仅代表低于当前领域均值，不升级为异常或绩效结论。

## Architecture Impact

仅调整 React 总览的信息架构、呈现和客户端摘要派生。数据请求、API、路由、权限、后端计算和存储职责不变。

## API / Contract Changes

None。继续使用 `/api/maturity/overview` 和 `/api/compute` 的现有响应。

## Data Changes

None。无 schema、迁移、种子或计算公式变化。

## Compatibility

保留 `month`、`category`、`view`、团队比较和领域基线查询状态；保留团队/指标下钻、成熟度维护权限及深入分析筛选。

## Error & Boundary Handling

加载、失败、空数据、0 与缺失值语义保持不变。摘要在加载或无信号时提供明确状态；没有目标和外部基准时不输出“达标”“优秀”或行业排名。移动端模块单列，长矩阵只在局部容器横向滚动。

## Risks & Trade-offs

当前数据没有目标、外部基准、跨月变化和业务投入，因此首屏只能描述当前月信号，不能给出达标判断、趋势结论或资源配置建议。选择保留这一边界，避免用视觉设计制造未经证实的管理结论。

## Test Strategy

- 更新 Vitest 渲染测试，覆盖决策摘要、阅读顺序、比较边界、权限、分类切换和折叠区。
- 运行前端单元/渲染测试、构建、文档检查和 `git diff --check`。
- 使用真实浏览器在 1440、1024 和 390px 验证筛选、信号下钻、矩阵展开、页面溢出、键盘焦点和请求状态。

## Documentation Impact

- Business: UPDATE `docs/business/analytics.md`，同步总览决策路径和解释边界。
- Architecture: UPDATE `docs/architecture/overview.md`，同步总览客户端呈现层结构；数据流不变。
- Standards: NONE，复用现有前端与测试规范。
- ADR: NONE，不形成新的长期架构或业务口径决策。
- Change Design: CREATE 本记录；完成验证后移至 `docs/changes/completed/` 并更新索引。

## Validation

### Automated

- `npm --prefix frontend run test:unit` passed: 33 Node tests and 66 Vitest rendering tests.
- `npm --prefix frontend run build` passed; the existing ECharts and Ant Design chunk-size warnings remain.
- `npm run check:docs` and `npm run test:docs` passed.
- `git diff --check` passed.

### Real Browser

- In-app Chromium opened the live Vite application at `http://127.0.0.1:5173` with the seeded admin session and changed the analysis month to `2026-08` through the real month control.
- At 1440×900, 1024×900 and 390×844, page `scrollWidth` equalled `clientWidth` (1425/1425, 1009/1009 and 375/375). Desktop rendered two-column decision/performance layouts; mobile rendered a single-column performance layout and a 2-column evidence grid.
- The live decision title was “1 个负提效信号需要优先确认”; four teams, 0% maturity coverage and 16/16 fact coverage were visible. The page stated that no goal or external industry benchmark is configured.
- Switching to 通用研发能力 updated the URL to `?category=general&month=2026-08` and `aria-pressed=true`; switching back preserved the month. “查看证据” navigated to `/analytics/metrics/6?month=2026-08&period=2026-08`, and browser Back restored the overview state.
- Expanding the team matrix updated the URL to `?view=team&month=2026-08`; at 390px the page stayed width-safe while the matrix used local overflow 1056/277, displayed the mobile hint and kept the first column sticky.
- Keyboard focus on the segmented control computed to a visible 2px `rgb(59, 104, 168)` solid outline with 2px offset. The initial mobile test exposed a 320px vertical flex basis; the responsive override was added and rechecked at 53px control height.

### Unverified Boundaries

- Browser evidence used seeded local data and accounts; it does not validate production identity, external Gateway data, external benchmarks or deployment persistence.
- No full screen-reader session was run; semantic roles, labels and focus visibility were inspected through the browser accessibility tree and computed styles.

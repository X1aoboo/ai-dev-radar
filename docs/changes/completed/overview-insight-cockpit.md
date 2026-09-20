# 研发总览 Insight 驾驶舱优化

## Status

Completed

## Background

当前总览已经具备成熟度、事实指标、关注项和团队下钻，但首屏仍需要用户在多个模块之间拼接趋势、当前值和风险。参考 Insight 类分析台的层级，将总览调整为可自适应的浅色分析工作区，优先展示可核对的趋势与活动对照。

## Requirement

- 总览解除 1600px 外层限制，使用 16–32px 自适应边距；其他页面保持原布局。
- 紧凑页头和筛选条后展示成熟度、AI 渗透/比率、提效率 Insight 趋势卡；一般研发能力按目录实际类型替换为使用率/状态和数量规模，不渲染空提效卡。
- 趋势只覆盖选定月份及之前五个月。缺失保留断点，不回退、不补零；成熟度继续使用领域平均语义，不生成跨活动虚假总平均。
- 关键研发活动展示 8 项对照矩阵，包含成熟度、AI 渗透/比率、提效率、数据状态和下钻；同一活动的多个率指标分行，未定义提效明确标注。
- 常驻 DecisionBrief/AttentionPanel 改为顶部 Signal 数量和最高级别，点击打开默认关闭的右侧 Signal 抽屉；抽屉按负提效、数据/成熟度缺失、低于领域均值排序，并保留证据下钻和有权限的成熟度维护入口。
- 保留 month/category/view、团队比较、领域基线、权限、维护、下钻和既有 URL 状态；Signal 抽屉不写 URL。
- 复用 ECharts、Ant Design、既有格式化和查询逻辑，不增加依赖；图表有直接标签或 ARIA 摘要，颜色不是唯一编码。

## Current Behavior

见 [Analytics](../../business/analytics.md)、[Architecture Overview](../../architecture/overview.md)、[Overview Decision Workspace](../completed/overview-decision-workspace.md) 和 `frontend/src/overview/`。当前成熟度只请求选定月份，指标总览请求完整月序列；页面主体仍包含常驻决策摘要、优先信号、按类型效率表现和成熟度能力画像。

## Target Behavior

总览首屏依次为上下文页头、筛选条、Signal 摘要和三张 Insight 卡。每张卡显示指标标题、当前状态、同一真实指标的环比、最近六个月趋势，以及当前月最好/最弱项。关键活动主体改为精确的活动对照矩阵；通用研发能力仍按成熟度、使用率/状态和数量目录类型展示。Signal 详情只在抽屉中出现，打开和关闭不改变 URL。

## Design

- `OverviewPage.jsx` 保留现有成熟度维护、矩阵团队比较和深入指标比较，把首屏组织拆为 `InsightGrid`、`KeyActivityMatrix` 和通用能力视图。
- `maturityData.js` 的成熟度 overview hook 对选定月和前五个月发起一次并行请求集合，当前月响应作为现有矩阵数据，历史响应只用于趋势；不新增公共 API，也不重复请求当前月。
- `overviewLogic.js` 提供连续月份窗口、单指标趋势点、当前 best/weak 和信号等级所需的纯函数。指标卡不跨活动平均；成熟度沿用活动等权领域平均。
- `chartOption.js` 增加单卡多真实指标的趋势配置；缺失点使用 `null`，矩阵微趋势使用文本值和轻量 SVG/ARIA 作为精确数据的辅助。
- `App.jsx` 为根总览内容增加页面类名，`app.css` 仅对该类解除外层最大宽度并使用 `clamp(16px, 2vw, 32px)` 边距。

## Business Impact

管理者可以从当前状态、变化方向和具体活动的精确值进入证据。成熟度仍是人工领域评估；事实仍使用 `company_average` 和现有指标定义；低于领域均值只表示相对位置，不升级为目标、行业基准或因果建议。

## Architecture Impact

仅调整 React 总览的信息架构、客户端派生和现有查询 hook 的并行读取。FastAPI 路由、计算口径、持久化、权限检查和路由契约不变。

## API / Contract Changes

None。继续使用 `/api/compute` 和 `/api/maturity/overview` 的现有响应。

## Data Changes

None。无 schema、迁移、种子和新指标计算。

## Compatibility

保留 `month`、`category`、`view`、团队比较、领域基线及深入分析筛选的 URL 状态；保留团队/指标下钻、成熟度维护和角色权限。Signal 抽屉状态只存在页面内。

## Error & Boundary Handling

真实 0 与缺失继续区分；六个月窗口中的缺失点保持断点。选定月份的加载、错误和空状态不回退到其他月份。桌面和窄桌面页面级不出现横向溢出，局部精确表格可使用自身布局；移动端不属于本次专项设计和验收范围。

## Risks & Trade-offs

成熟度历史需要六次既有接口读取，增加首屏请求数量；并行读取保持接口不变且避免引入后端聚合，失败仍显示可核对的错误状态。事实卡以多条真实指标趋势表达，不提供跨活动平均，因此在指标较多时信息密度更高但口径更可靠。

## Test Strategy

- 更新 overview 纯逻辑测试，覆盖六个月窗口、缺失断点、0 值、best/weak、环比和未定义提效。
- 更新渲染测试，覆盖 Insight 卡、关键活动矩阵、Signal 摘要/抽屉入口、权限维护、分类适配和既有 URL 控件。
- 运行前端单元测试、构建、后端测试、文档检查和 `git diff --check`。
- 使用真实浏览器在 2560×1440、1440×900、1024×900 检查首屏卡片、筛选、Signal 抽屉焦点、键盘焦点、reduced motion、请求序列和无页面横向溢出；移动端不验收。

## Documentation Impact

- Business: UPDATE `docs/business/analytics.md`，同步 Insight 首屏、关键活动矩阵和 Signal 抽屉的当前行为。
- Architecture: UPDATE `docs/architecture/overview.md`，同步客户端总览呈现和成熟度六个月并行读取；数据 API 边界不变。
- Standards: NONE，复用现有 React、ECharts、Ant Design、测试和可访问性约定。
- ADR: NONE，不改变指标、成熟度、存储、权限或 API 长期决策。
- Change Design: CREATE 本记录；完成验证和正文同步后移动至 `docs/changes/completed/` 并维护索引。

## Validation

### Automated

- `npm --prefix frontend run test:unit` passed: 36 Node tests and 67 Vitest rendering/route tests.
- `npm --prefix frontend run build` passed; the existing ECharts and Ant Design chunk-size warnings remain.
- `npm test` passed: 118 backend tests; only dependency deprecation warnings were emitted.
- `npm run check:docs` and `npm run test:docs` passed.
- `git diff --check` passed.

### Real Browser

- Live Chrome validation used the seeded admin session and the current Vite/FastAPI processes.
- At 2560×1440, three Insight cards rendered in one row; content width was 2,545px with `scrollWidth === clientWidth`, and the activity matrix was 2,233px wide.
- At 1440×900, three cards remained in one row; at 1024×900, cards used two columns and the matrix used compressed desktop tracks; both had no page-level horizontal overflow (`scrollWidth === clientWidth`).
- Keyboard month navigation changed the live state to `?month=2026-08`; category switching produced `?category=general&month=2026-08` and returned to the key view without losing the month. Expanding the team matrix produced `?view=team&month=2026-08`.
- Signal opened in a default-closed right drawer, showed value/domain/month/evidence fields, left the URL unchanged, and returned focus to the Signal trigger after close. Browser logs showed six parallel maturity overview requests for the selected month and five predecessors plus full monthly `/api/compute` requests, all returning 200.
- The live desktop page exposed chart ARIA summaries, exact matrix values, keyboard focus states and visible text status alongside color.

### Unverified Boundaries

- Mobile-specific layout is outside this request and was not part of the final acceptance after scope was narrowed by the user.
- A forced `prefers-reduced-motion: reduce` browser profile was not available through the connected browser capability; the existing EChart and CSS reduced-motion branches remain in code but were not toggled in this live pass.
- No full screen-reader session, production identity, external Gateway data, Docker image, or deployment persistence was validated.

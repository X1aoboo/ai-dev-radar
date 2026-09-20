# 管理者优先的研发总览重设计

## Status

Completed

## Background

现有总览已具备月度成熟度和指标比较能力，但首屏仍以成熟度领域/团队视角和单指标趋势为中心，管理者需要在多个区域之间拼接整体结论、关键活动事实和短板。当前 `/api/compute` 返回完整时间序列，`company_average` 是所有非空团队值的等权平均；`domain_summary` 是原始分子/分母合并口径，不能替代事实基线。

## Requirement

- 首屏面向研发管理者，先展示整体摘要、成熟度雷达、关键活动事实表现和需关注项。
- 一个 URL `month` 同时驱动成熟度和月度事实；选中月无事实时明确显示缺失，不回退到其他月份。
- 关键研发活动分别展示 AI 渗透率/活动比率和提效率；通用研发能力按目录实际类型展示比率、数量、布尔状态及提效率，不渲染无意义的空模块。
- 每个事实指标展示 `company_average`、该月有效团队数/总团队数及下钻入口；关注项优先负提效、成熟度/事实缺失和低于领域团队均值的团队-活动组合，后者只称“相对靠后”。
- 成熟度继续使用后端领域平均和雷达图；完整团队×能力点矩阵默认折叠，包含领域平均行，桌面固定团队列，移动端有横向滚动提示。
- 周、版本、迭代筛选、完整指标比较和趋势图保留在“深入分析”折叠区。
- 保留现有 API、路由、权限、侧栏 248/64px、折叠记忆、680px 抽屉、动效与无障碍契约，不增加依赖。

## Current Behavior

见 [Analytics](../../business/analytics.md)、[Current Architecture](../../architecture/overview.md) 和 `frontend/src/overview/`。成熟度状态已通过 `month` URL 参数维护；事实比较在展开后单独使用周/月或版本/迭代筛选。

## Target Behavior

总览页头提供分析月份、关键研发活动/通用研发能力切换和有权限用户的成熟度维护入口。摘要表达团队数、当前分类领域成熟度平均值、成熟度评估覆盖率和当前月事实完整状态。主体以成熟度雷达和按 `company_average` 的横向事实比较为主，事实值严格从选中月份派生。

矩阵使用原生 `details/summary` 默认收起；打开后以领域平均行和完整团队行表达已评估值与缺失值。雷达图和横向比较提供可读文本/表格替代，颜色不作为唯一编码。`prefers-reduced-motion` 下不新增动画，页面不产生横向滚动。

## Design

- 复用 `OverviewPage.jsx`、`overviewLogic.js`、`metricData.js`、`MaturityRadar.jsx`、现有 ECharts/Ant Design/API 与 CSS 变量。
- 在客户端对每个目录指标固定请求 `dim=time&gran=month` 一次；父页面持有结果，主体和深入分析共享相同月数据，只有深入分析切换到周/迭代时才请求不同切片。现有布尔指标响应只有跨月 `snapshot`，无法满足统一月份语义，因此在不改变路由、参数或 DTO 字段的前提下补充已有 `series.values` 的按月布尔点；`snapshot` 继续保留兼容。
- 新增最小纯函数用于月度点匹配、有效团队计数、事实表现分组和关注项排序；保留零值与缺失值的区别。
- 用现有 `view` 查询状态兼容矩阵显式打开，默认 `domain` 对应矩阵收起；`category` 与 `month` 继续复用现有 URL 参数。
- 深入分析保留 `FilterBar` 和 `TrendCard`，但事实摘要改用 `company_average` 和团队有效数，不使用 `domain_summary` 作为总览基线。
- 只补局部页面样式、全局语义变量和可见焦点规则，不创建新的设计系统目录或状态库。

## Business Impact

管理者可在同一分析月份快速查看成熟度、关键活动事实和相对短板；人工成熟度仍独立于 FactRecord，事实缺失和成熟度未评估均保持可见。目录类型决定通用能力的展示方式，不为缺失指标补造分数。

## Architecture Impact

仅调整 React 总览的信息架构和客户端派生层；AppShell、API 路由、后端计算、数据库和权限职责不变。父级复用按月事实请求，减少页面组件间重复请求。

## API / Contract Changes

None。继续使用 `/api/maturity/overview` 和 `/api/compute?dim=time&gran=month`；不新增月份过滤、批量接口或响应字段。仅修正现有布尔 `values` 字段，使其按已有时间维度返回月度状态，保留 `snapshot` 兼容。

## Data Changes

None。未改变 FactRecord、MaturityRecord、指标公式、成熟度公式或 URL 参数名称。

## Compatibility

保留现有 `month`、`category`、`view`、团队和指标下钻路由；`view=team` 仍可通过 URL 打开矩阵。周、版本、迭代筛选只在深入分析区生效。维护入口继续按 admin/maintainer 显示并由后端复核，viewer 只读。

## Error & Boundary Handling

加载失败显示错误状态；选中月份没有对应周期或有效团队时显示明确空状态。0 是有效事实/成熟度值，`null`/缺失不转成 0。负效率用数值和文字标识；相对差距不设业务阈值、不称异常。长矩阵保留局部横向滚动，页面级 overflow-x 保持关闭。

## Risks & Trade-offs

按指标请求现有接口会产生多个唯一 metric 请求，换取不改后端契约和主体/深入分析共享结果；客户端只在不同维度切换时请求新切片。事实完整状态是当前分类、选中月份中可得到 `company_average` 的指标比例，不代表源系统全量采集完成。

## Test Strategy

- Node 逻辑测试覆盖月份匹配、零/缺失、成熟度缺失排除、`company_average` 口径、有效团队计数、负提效和相对靠后分类。
- Vitest 渲染测试覆盖首屏顺序、分类切换、选中月无数据、矩阵默认折叠/领域平均行、维护权限及 ARIA/键盘语义。
- 运行 `npm --prefix frontend run test:unit`、`npm --prefix frontend run build`、`npm run check:docs`、`npm run test:docs`、`git diff --check`。
- 真实浏览器验证 1440、1024、390px：月份同步、团队/指标下钻、矩阵滚动、无页面横向溢出、admin/maintainer/viewer、焦点、减少动态效果、请求无重复，并保存可复核观测证据。

## Documentation Impact

- Business Design: UPDATE `docs/business/analytics.md` 和必要的 `docs/business/index.md`，同步总览信息架构、月份口径、事实基线和矩阵行为。
- Architecture: UPDATE `docs/architecture/overview.md`，同步前端总览数据流、请求复用和响应式/无障碍边界。
- Standards: NONE，复用既有前端和测试约定。
- ADR: NONE，本次不改变成熟度、事实计算、API、存储或权限长期决策。
- Change Design: CREATE 本 active 记录；验证和当前设计同步后移至 `docs/changes/completed/`，并更新 active/completed 索引。

## Validation

### Automated

- `npm --prefix frontend run test:unit` passed: 33 Node logic tests and 66 Vitest rendering tests across four files.
- `npm --prefix frontend run build` passed. It retains the existing ECharts and Ant Design chunks above 500 kB warning.
- `python -m pytest backend/tests -q` passed: 118 tests.
- `npm run check:docs`, `npm run test:docs`, and `git diff --check` passed.

### Real Browser

- Playwright CLI opened the local dev app at `http://127.0.0.1:5175` and the same worktree's production-style FastAPI static host at `http://127.0.0.1:5176`; screenshots were saved as `.playwright-cli/executive-desktop-1440.png` and `.playwright-cli/executive-mobile-390.png`.
- At 1440×900, 1024×900 and 390×844, `document.scrollWidth` equalled the viewport width. The matrix retained local overflow (`scrollWidth/clientWidth` 1056/683 at 1024 and 1056/292 at 390) with the team column fixed.
- URL `?month=2026-08` updated maturity and fact summaries together; `2026-09` showed the explicit no-fact state without falling back. AI penetration/ratio, efficiency, count and general-capability type sections were observed; negative efficiency appeared first in attention items. The metric drilldown preserved `month=2026-08` and opened `/analytics/metrics/1?month=2026-08&period=2026-08`.
- Matrix disclosure changed the URL to `view=team&month=2026-08`, rendered the `领域平均` row, and exposed the mobile horizontal-scroll hint. Radar data-table disclosure was present. Tab focus produced a visible 2px `rgb(59, 104, 168)` outline.
- Admin exposed all maintenance/navigation controls; `maintainer.团队A` exposed only the bound-team maturity maintenance entry and no admin-only links; `viewer` exposed neither maturity maintenance nor admin-only links.
- `prefers-reduced-motion: reduce` computed `transition: none` and `transform: none` for the sidebar/body/toggle. The production-style host made exactly one successful request for each metric id 1–29 plus one catalog, team, version and maturity overview request; the development host's initial React StrictMode pass was separately observed as aborted requests and is not used for the no-duplicate result.

### Unverified Boundaries

- Browser evidence used the local seeded database and local session accounts; it does not validate production identity providers, external Gateway data, or deployment persistence.
- The visual screenshot path is local ignored test evidence, not a committed binary artifact. Browser focus was checked by computed outline and tab navigation; full screen-reader output was not run.

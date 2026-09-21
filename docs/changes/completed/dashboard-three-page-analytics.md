# Dashboard 三页分析重构

## Status
Completed

## Background

原洞察页同时承担管理摘要、研发活动、研发能力和成熟度写入，`category` 查询参数切换不同内容，信息层级和权限边界混杂。

## Requirement

- 提供 `/` 研发总览、`/analytics/activities` 研发活动、`/analytics/capabilities` 研发能力三个同级入口。
- 旧 `/?category=key|general` 重定向到对应页面并保留有效月份。
- 总览展示关键活动、通用能力和跨领域团队成熟度近六个月趋势；缺失不补零并显示覆盖。
- 活动页固定自然月/近六个月，能力页原始指标支持月、周、日窗口；成熟度始终按自然月。
- 图表与 Signal 使用只读右侧详情 Drawer；成熟度维护迁移到 `/data/maturity` 并按角色限制。
- `/api/compute` 支持 `day|week|month`，自然日按 `Asia/Shanghai`，空档保持为空。

## Current Behavior

当前实现由 `frontend/src/overview/OverviewPage.jsx` 同时承载总览、分类内容、深入分析和成熟度维护；后端 `/api/compute` 仅支持周/月周期。

## Target Behavior

总览、活动、能力和成熟度维护按路由拆分。Dashboard 只读；成熟度写入集中在数据管理。选定月份是分析窗口终点，当前周期无事实时展示明确空状态，不回退到最近事实。

## Design

- 复用现有 React Router、Ant Design Drawer、ECharts、`api.js`、成熟度 API 和团队颜色槽。
- `frontend/src/analytics/AnalyticsPages.jsx` 提供三页和共享量化详情；`overviewLogic.js` 生成按选定月结束的月/周/日窗口。
- `backend/app/compute.py` 保持事实聚合边界，仅增加日周期和周期 DTO 类型；不改变数据库模型。
- 路由元数据为同级入口定义唯一 active 状态，旧链接保留兼容重定向。

## Business Impact

管理摘要、原始指标趋势和成熟度维护分离；缺失仍表示缺失，不表示零。页面不新增目标、外部基准、排名或资源投入结论。

## Architecture Impact

客户端增加 analytics 页面模块和数据管理成熟度页面；FastAPI 计算层增加日周期。现有事实、成熟度和源数据链路仍保持独立。

## API / Contract Changes

`GET /api/compute` 的 `gran` 与响应 `granularity` 增加 `day`；周期 `kind` 增加 `day`。其余公共 API 不变。

## Data Changes

NONE — 不改数据库表、迁移或成熟度存储。

## Compatibility

保留现有团队/指标详情路由；旧 `category` 参数重定向并保留合法 `month`；月份和迭代筛选语义保持兼容。

## Error & Boundary Handling

无事实时返回空序列；前端保留周期轴和断点，明确提示选定周期暂无事实。缺失成熟度不补零；后端继续校验角色和维护团队范围。

## Risks & Trade-offs

活动和能力页会比总览更长，需要纵向滚动；日窗口请求和图表数量增加请求量，但只在能力页切换原始指标粒度时启用。

## Test Strategy

运行后端计算/API 测试、前端 Node/Vitest 测试、生产构建、文档检查和 `git diff --check`；以真实浏览器验证 1440×900、390×844、月/周/日请求、路由唯一高亮、空状态、Drawer 焦点、角色权限及无页面横向溢出。

## Documentation Impact

- Business Design: UPDATE `docs/business/analytics.md`、`docs/business/data-management.md`。
- Architecture: UPDATE `docs/architecture/overview.md`。
- Standards: NONE — 沿用现有 React/FastAPI/测试约定。
- ADR: NONE — 扩展现有计算周期契约，不改变已接受的持久化或权限决策。
- Change Design: UPDATE 本记录并在验证后归档到 completed。

## Validation

- 后端：119 tests passed。
- 前端：37 Node tests、65 Vitest 路由/渲染 tests passed；生产构建通过，既有 Ant Design/ECharts 大 chunk warning 非阻断。
- 文档：`npm run check:docs`、`npm run test:docs`、`git diff --check` 通过。
- CUA 同源验收：默认 1280×720 无页面横向溢出；研发总览/研发能力同级入口唯一高亮；月/周/日 `/api/compute` 请求返回 200；选定周期空状态、Drawer Escape 焦点恢复、viewer/maintainer 权限通过。
- 未验证边界：CUA 未提供 viewport 控制，1440×900、1024×900、390×844 与 reduced-motion 未完成现场验证；Docker、MySQL、真实 Gateway 联调不在范围内。

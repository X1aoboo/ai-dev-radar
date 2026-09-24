# Phase 5: UX/UI Final Release Gate

## Status

Completed

## Background

Phase 1–4 已完成主要 Design System、Analytics、Data Workbench、System Management、Authentication 和 Global State 工作。本阶段执行最终全站验收，不重新设计已完成页面；只修复有浏览器、静态扫描或自动化证据支持的缺陷，并收口剩余 token/CSS/test debt。

## Requirement

- 建立实际 Route Inventory 和 UX QA Matrix。
- 验证 1440×900、1920×1080、1024×768、390×844 的布局、滚动、横向溢出和关键交互。
- 保持 Executive Dashboard、Analytical Workspace、Operational/Administrative Workspace 三类密度差异。
- 完成 Browser UI Smoke、可访问性、URL state、权限、破坏性操作和全量自动化 gate。
- 不修改业务 API、数据模型、指标、目标、评分、权限模型或既有业务术语。

## Current Evidence

- `npm run gate` 通过：后端 139 tests、前端 46 Node + 89 Vitest、production build、8 个 Browser Smoke、`check:docs` 和 `test:docs` 全部通过；构建保留既有 Ant Design/ECharts 大 chunk 警告。
- 关键页面在 1440×900、1920×1080、1024×768、390×844 均未观察到 document/body 横向溢出；核心页面可实际滚到文档底部。
- Gateway E2E 的 Drawer 断言已限定 Gateway wrapper 并等待 settled right boundary；Gateway Drawer 已从弃用的 `width` prop 迁移到 `size`。
- 移动导航关闭和导航点击后的 opener focus 已由 AppShell 显式恢复，并由真实 Chromium 键盘 smoke 验证。
- `frontend/src` 中历史 `--app-*`/`--viz-*` compatibility alias 引用已清零；页面 CSS 直接消费 canonical semantic tokens，仅保留 `--shell-sidebar-width` 壳层状态。

## Route Inventory

| Route / state | Page type | Owner / verification scope |
|---|---|---|
| `/` | Executive Dashboard | Overview, KPI hierarchy, charts, bottom scroll |
| `/analytics/activities` | Analytical Workspace | activity navigator, filters, trends, bottom scroll |
| `/analytics/capabilities` | Analytical Workspace | capability directory, maturity, boolean state |
| `/analytics/teams/:teamId` | Analytical Workspace | drilldown, sticky directory, facts, maturity |
| `/analytics/metrics/:metricId` | Analytical Workspace | result/comparison/evidence, URL period |
| `/data/requirements/ir` | Operational Workbench | filters, table, pagination, drawers |
| `/data/requirements/ar` `/data/requirements/sr` | Pending Domain | compact pending state |
| `/data/maturity` | Operational Editing | month/team scope, draft/preview boundary |
| `/data/issues` `/data/mr` `/data/code-review` | Pending Domain | pending state and navigation |
| `/settings/teams` | Administrative Workspace | master/detail, member table, drawer |
| `/settings/products` | Administrative Workspace | product/version/iteration hierarchy |
| `/settings/metrics` | Administrative Workspace | catalog/rules tabs and result state |
| `/settings/collections` | Operational Console | schedule, manual run, history |
| `/settings/gateway` | Operational Console | config drawer, status, destructive draft actions |
| `/settings/users` | Access-control Workspace | table, role drawer, protected deletion |
| `/login` | Authentication | validation, loading, session error |
| Forbidden state | Global State | role-gated direct URL / 403 |
| Unknown route | Global State | 404 and shell retention |
| Pending domain | Global State | unsupported source boundary |
| Route/page loading/error | Global State | shell retention and retry |
| `/data-management*`, `/team/:id`, `/metric/:id`, `/config`, `/manual-entry`, `/data/{ir,ar,sr,dts}` | Legacy Redirect | final target and query preservation |

## UX QA Matrix

The matrix records measured state rather than code inference. The final smoke suite and retained screenshots are the evidence for the completed cells.

| Route group | 1440 | 1920 | 1024 | 390 | Scroll / overflow baseline | Interaction / accessibility |
|---|---|---|---|---|---|---|
| Dashboard | PASS | PASS | PASS | PASS | bottom reachable; no page x-overflow | PASS |
| Analytics | PASS | PASS | PASS | PASS | activities/drilldown bottom reachable; no page x-overflow | PASS |
| IR / maturity | PASS | PASS | PASS | PASS | route/table boundaries covered by smoke | PASS |
| System management | PASS | PASS | PASS | PASS | collections/metrics bottom reachable; no page x-overflow | PASS |
| Login / global states | PASS | PASS | PASS | PASS | login/403/404/pending/loading boundaries covered | PASS |
| Legacy redirects | PASS | PASS | PASS | PASS | final target and query contract preserved | PASS |

## Design

1. Make the Gateway E2E Drawer assertion scope to the Gateway Drawer and wait for its settled right boundary; replace the deprecated Gateway Drawer API without changing its product width or mobile behavior.
2. Migrate remaining page and shell CSS references from compatibility aliases to canonical semantic tokens. Keep only true shell-local state variables such as responsive sidebar width; remove obsolete alias definitions after reference search is empty.
3. Extend the existing Playwright project runner with non-mutating Browser UI Smoke coverage for route navigation, redirects, global states, responsive overflow, bottom scroll, navigation Drawer focus return, URL state, role gating, and representative actions.
4. Add or update only targeted rendering/unit assertions needed to protect the repaired behavior.

## Boundaries

No backend/API/data/permission/metric/target/score/IA changes. No Dark Mode, new UI framework, screenshot baseline system, or broad page redesign. The active `sidebar-light-logo-refresh.md` remains a separate change.

## Documentation Impact

- Business Design: NONE unless browser evidence finds a business-language or state-semantics mismatch; presentation-only work does not alter analytics/data rules.
- Architecture: UPDATE `docs/architecture/overview.md` only if final token ownership or browser-gate ownership changes the current architecture description.
- Standards: NONE; reuse current React, Ant Design, Playwright and testing conventions.
- ADR: NONE unless a durable accepted architecture decision must change; no such change is currently proposed.
- Design/UX Contract: UPDATE `DESIGN.md` and `UX-CONTRACT.md` for removal of compatibility aliases and any verified final responsive/accessibility contract changes.
- Change Design: finalize this record and move it to `docs/changes/completed/` only after implementation, verification, current-state sync, and gate conclusion.

## Test Strategy

- `npm --prefix frontend run test:unit`
- `npm --prefix frontend run build`
- `npm test`
- `npm run test:e2e:gateway` with the isolated Radar/Mock Gateway and all Browser Smoke specs
- `npm run check:docs`, `npm run test:docs`, `git diff --check`
- browser evidence at all four target viewports, including screenshots in ignored E2E artifacts and measured scroll/overflow/focus assertions

## Validation

- `npm test`: 139 passed; only existing Python dependency deprecation warnings remain.
- `npm --prefix frontend run test:unit`: 46 Node tests and 89 Vitest tests passed.
- `npm --prefix frontend run build`: passed; existing >500 kB Ant Design/ECharts warnings remain non-blocking.
- `npm run test:e2e:gateway`: 9/9 passed, including Gateway workflows, route/redirect/responsive/global-state/focus smoke, URL state, and destructive-confirmation cancel behavior. Final retained artifacts: `e2e-results/gateway-2026-09-24T02-36-00-967Z-93443`.
- `npm run check:docs`, `npm run test:docs`, and `git diff --check`: passed.
- Final QA screenshots cover 1440 and 1920 core pages, 1024 representative pages, and 390 login/analytics/operational fallback. They are retained only in ignored E2E artifacts; no pixel baseline was introduced.

## Remaining Issues

- Real internal Gateway / L4 deployment integration remains outside this repository's isolated Mock Gateway gate and is `NOT VERIFIED`.
- Native OS-owned Select/Date popup appearance and true 200% browser zoom are not pixel-captured; keyboard use and narrow-width reflow are verified.

## Gate Conclusion

PASS

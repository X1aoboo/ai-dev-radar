# Phase 4: System Management, Authentication, Global Status, and App Shell

## Status

Completed

## Background

Phase 1 established the shared design system, Phase 2 completed Analytics, and Phase 3 completed the Data Workbench. System administration, authentication feedback, global states, and shell behavior still have separate page patterns. This change completes those areas without redesigning Analytics or the operational workbench.

The completed `ui-ux-design-system-rebuild.md` records an earlier, narrower Phase 4 acceptance. The supplied current objective expands that gate; keep the completed record as history and use this change for the remaining current scope.

An existing active change, [Light Sidebar and Radar Brand Refresh](../active/sidebar-light-logo-refresh.md), already covers the sidebar colors, collapse control, and shared mark. Preserve its scope and close it only after its own outstanding browser checks are verified.

## Requirement

Complete the Phase 4 scope in the supplied `goal-objective.md`: teams and people, products and versions, metric definitions, collection operations, users and permissions, login, authorization and route states, loading/error/pending feedback, App Shell, and responsive fallback.

Keep these contracts unchanged: admin/maintainer/viewer permissions, route access, team ownership, product → version → iteration hierarchy, user role and maintainer-team binding, self-delete protection, collection schedule API/cadence/timezone, manual half-open time windows, metric calculations, deletion constraints, and all existing API contracts. Do not redesign Analytics, IR Workbench, or the maturity editor.

## Current Behavior and Route Inventory

| Route / state | Current component | Product page type | Current UX pattern | Phase 4 target |
|---|---|---|---|---|
| `/settings/teams` | `DataManagementPage` → `TeamManagement` | Administrative workspace | Team table and team details each sit in a Card; member table and create/edit Drawers | Compact team master list with selected detail, member table, reliable counts, empty/selected states, existing Drawers and delete confirmation |
| `/settings/products` | `DataManagementPage` → `ProductManagement` | Configuration workspace | Product table selects a detail Card; versions are rows and iterations are Tags/actions | Make Product → Version → Iteration ownership explicit in a table-first master/detail workspace; retain existing Drawers and constraints |
| `/settings/metrics` | `DataManagementPage` → `MetricManagement` | Catalog / rule configuration | Tabs already separate dashboard catalog from source rules; catalog uses two stacked Cards; rules and result query use two Cards | Preserve the two concepts and tab boundary; use catalog tables and a compact rule/result configuration workspace |
| `/settings/collections` | `CollectionsSettingsPage` | Operations console | Schedule, manual run, and recent runs are three stacked Cards; run teams use a list | Compact current-state summary, settings sections, default complete-period run with optional custom range, scan-friendly run table with team details |
| `/settings/users` | `UsersSettingsPage` | Access-control workspace | Page header, notice, Table wrapped in a large Card, role Tags, edit Drawer, self-delete hidden | Make the Table the primary surface, use quiet role labels, identify the current account, preserve self-delete protection and edit flow |
| `/login` | `App.jsx` → `LoginPage` | Authentication | Centered form with native inputs, inline validation/API message and submit loading | Keep the single-column sign-in; use shared tokens, clear session-expired feedback, associated field errors and stable loading |
| Forbidden route | `RequireRole` → `ForbiddenPage` | Global status | Ant Design `Result` | Shared compact status layout with access explanation and overview action |
| Unknown route | `NotFoundPage` | Global status | Ant Design `Result` | Same status layout with not-found copy and overview action |
| Pending data domain | `PendingDomainPage` | Pending capability | PageHeader plus a separate status strip | Same neutral status language and layout; no invented data or actions |
| Route/page loading | `LoadingPage`, `DataManagementPage`, settings pages | Loading state | Full-screen lazy-route fallback; different inline `Spin` layouts | Keep App Shell during lazy-route loading; use a shared stable content-loading treatment |
| Authentication/data load failure | `App`, `AnalyticsDataLayout`, settings pages | Fatal/page error | Separate `Result` and `Alert` layouts; some render raw request messages | Shared status treatment for fatal failures, with safe copy and an available retry where meaningful |
| App Shell | `AppShell`, `AppSidebar`, `app.css` | Navigation shell | Expanded/collapsed sidebar, <=680px drawer, Breadcrumb and username/role/logout cluster | Preserve IA, dimensions, route and role behavior; verify expanded/collapsed/drawer; reduce account-area noise |
| Tablet/mobile | `app.css`, `dataManagement.css` | Responsive fallback | Master/detail stacks at <=1100px; navigation becomes Drawer at <=680px | Verify compact management layouts at 1024px and usable forms/tables/actions at 390px without page-level horizontal overflow |

## Target Behavior

- System management pages use PageHeader → necessary scope/status → primary workspace → Drawer/detail panel. Breadcrumb owns route context; do not repeat it as an eyebrow.
- Teams and products use compact master/detail workspaces. Member and product/version/iteration relationships remain visible and semantically correct.
- Dashboard metric catalog and source metric rules remain separate concepts. The rule result remains a configuration check, not a dashboard KPI.
- Collection scheduling and manual run are distinct settings sections. Custom time windows are disclosed on demand. Run history is a table with expandable team outcomes, explicit status/error details, and retryable text only; no retry action is added without an API.
- User/permission Table is the page surface. Current-account marking and protected deletion remain clear; role colors do not imply warning for maintainer.
- Login, 403, 404, pending, fatal error, and loading states use shared layouts and accessible names/status. Session expiry returns to the interrupted path after successful login and does not loop.
- Lazy route loading keeps the authenticated shell and breadcrumb stable. Action loading stays on the action.
- Reuse `tokens.css`, `design-system.css`, Ant Design, existing native Select/date ownership, `PageHeader`, `operational-table`, and existing Drawer/confirmation patterns. Do not add a parallel color, radius, or spacing system.
- Desktop stays optimized for 1440px/1920px; management master/detail stacks or switches cleanly at 1024px; mobile remains functional at 390px.
- Preserve the independent Analytics and Data Workbench layouts; only repair a verified regression caused by shared styles.

## Design

Implement the smallest shared surface patterns needed by the affected pages in `frontend/src/design/design-system.css`. Keep business/API state in existing route components. Use existing Ant Design and native controls rather than adding packages or custom widgets.

Move the lazy-route Suspense boundary inside the authenticated App Shell content region so the route loader does not replace navigation. Consolidate 403/404/pending/fatal states in a shared status component; use one shared loading primitive for route and page content. Keep authentication bootstrap outside the authenticated shell.

Replace presentation wrappers only; retain existing fetch URLs, HTTP methods, payloads, permissions, selected route behavior, and mutation ordering. Add rendering coverage for the new page patterns and retain API/route regression coverage.

## Business Impact

No business rules change. User-visible configuration and access workflows retain their current permissions, data hierarchy, calculation semantics, and collection behavior. The change only makes those existing relationships, states, and operations easier to scan and use.

## Architecture Impact

The same React, React Router, Ant Design, API, and backend boundaries remain. A shared status component and loading treatment may be added under `frontend/src/components/`; route-level lazy loading becomes a child of the existing App Shell. No backend module, persistence model, or network boundary changes.

## API / Contract Changes

None. Keep all current request paths, methods, payloads, response interpretation, and authorization checks.

## Data Changes

None.

## Compatibility

Preserve all current routes and redirects, role visibility, direct-route 403 behavior, auth callback path, team ownership, product/version/iteration assignment, team/user deletion constraints, schedule cadence fields, Asia/Shanghai timezone, manual half-open interval, and metric query semantics. Keep Phase 1–3 page structures unchanged unless a shared-style regression is demonstrated.

## Error & Boundary Handling

Keep field and form errors near their inputs. Keep recoverable request failures in the owning page, preserve safe form values, and avoid exposing raw authentication internals. A 401 continues through the current logout/login path and retains the interrupted route; a 403 remains a permission state, not a 404. Missing counts stay unknown unless the API supplies a reliable count.

## Risks & Trade-offs

- Moving the Suspense boundary can affect initial and nested route rendering; verify route tests and real-browser loading.
- Shared status or layout CSS can affect previously completed routes; smoke-test Overview, Activities, Capabilities, and IR.
- Expandable run details and dense settings tables need keyboard and narrow-viewport checks.
- The current sidebar Change Design has its own outstanding checks. Do not mark it complete based only on this broader change.

## Test Strategy

- Frontend rendering/unit tests for teams, product hierarchy, separated metric concepts, collection schedule/manual/run-history states, roles/self-delete, login/session feedback, global status, and lazy route loading.
- `npm run test:unit`, `npm run build`, `npm run check:docs`, `npm run test:docs`, and `git diff --check`; run repository-relevant backend tests if any business/API behavior changes (none are planned).
- Start the real app and inspect 1440×900, 1920×1080, 1024×768, and 390×844. Exercise management states, login success/failure, 403, 404, pending, route loading, shell modes, keyboard/focus, open controls, tables, confirmations, and no horizontal overflow.
- Smoke-test Overview, Activities, Capabilities, and IR after shared shell/token changes.
- Record any scenario blocked by unavailable data/environment as unverified; do not infer a pass.

## Documentation Impact

- Business Design: NONE — `docs/business/data-management.md` already records the unchanged roles, hierarchy, deletion constraints, collection schedule, timezone, and metric semantics; this change alters presentation only.
- Architecture: UPDATE `docs/architecture/overview.md` and `docs/architecture/modules/data-management.md` — describe the shared status/loading components, shell-owned lazy-route fallback, and shared management workspace styles; no service/API architecture changes.
- Standards: NONE — existing testing and accessibility requirements remain; no project-wide engineering standard changes.
- ADR: NONE — no accepted domain, permission, persistence, or service decision changes.
- Change Design: CREATE this active record before implementation; finalize and move it to completed only after validation and current design docs are synchronized.
- Design assets: UPDATE `DESIGN.md`, `UX-CONTRACT.md`, and `frontend/src/design/tokens.css` — record current system-management, master/detail, settings section, run history, auth/session, global status/loading, shell, responsive, and accessibility patterns. Add a separate danger-text foreground because the measured normal-size auth error copy was below 4.5:1 on its subtle error background; preserve the existing chart/status indicator hue.
- Navigation: UPDATE `docs/changes/active/README.md` and `docs/changes/completed/README.md` when the Change Design lifecycle changes.

## Validation

Completed 2026-09-24.

- Automated: `npm --prefix frontend run test:unit` passed (44 Node tests and 86 Vitest tests); `npm --prefix frontend run build` passed; `npm test` passed (119 backend tests); `npm run check:docs`, `npm run test:docs`, and `git diff --check` passed.
- Static UI/design checks: premium UI strict audit reported zero findings. `designmd lint DESIGN.md` reported zero errors and eight orphaned-token warnings; seven warnings predate this change, and the added danger foreground is consumed by runtime CSS but not represented by the linter's component-token map.
- Real browser: verified 1440×900, 1920×1080, 1024×768, and 390×844. CRUD was exercised for teams/members, products/versions/iterations, dashboard metrics, source metric rules, and users. Product/version and team deletion constraints remained enforced. Metric result calculation returned 50% (1/2).
- Collection console: verified no-run empty state, hourly/daily/weekly/monthly schedule edits, enabled/disabled state, the default complete-period window, and a custom half-open window. Failed and partial runs came from the isolated app flow; success used a Gateway mock bound only to `127.0.0.1`. The running row was an isolated display fixture, not a live in-progress worker.
- Global/auth: verified empty and wrong login, successful admin/viewer login, a delayed local login response showing button loading, viewer 403, unknown-route 404, pending AR, lazy-route loading with the shell retained, API-unavailable status and retry recovery, Popconfirm Escape dismissal/focus return, and Drawer Escape/focus return. Session-expired path restoration is covered by route rendering tests; an expired-cookie browser run was not induced.
- Responsive/accessibility: no page-level horizontal overflow was found in sampled desktop/mobile routes; dense tables scrolled locally. Login error text measured 5.98:1 on the subtle danger surface. Labels, invalid-field association, keyboard submit, status text, destructive-confirmation wording, and focus return were verified. Cross-phase browser smoke checks for Overview, Activities, Capabilities, and IR passed at 1440px.
- No business/API contract or data-model changes. Business impact NONE; Architecture and design assets updated; Standards unchanged; ADR NONE. The separate `sidebar-light-logo-refresh.md` record remains active and was not closed by this Phase 4 change.

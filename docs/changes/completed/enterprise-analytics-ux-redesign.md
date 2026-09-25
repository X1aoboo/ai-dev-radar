# Enterprise Analytics UX/UI Redesign

## Status

Completed

## Background

The existing product-owned design system and evidence-bounded Analytics model are in place, but Analytics layouts and chart treatments do not yet match the reviewed Visual-forward Modern Analytics references. The current Overview KPI grid is capped at 1680px while the main Analytics canvas is fluid. Activities use a horizontal section bar rather than a narrow directory; Team Drill-down is organized around per-activity sections rather than the requested three-part story; capability analysis has a directory but lacks a clear team-difference/evidence region.

The requested four organization-wide headline names do not currently map to business metrics. The catalog contains activity-scoped rates, efficiency, counts, ratios, and boolean state. `/api/compute` queries one `metric_id` at a time and distinguishes `company_average` from `domain_summary`; neither the business design nor the API defines a cross-activity "AI demand penetration", "AI R&D efficiency", "AI-covered demand count", or "AI efficiency workload". Do not implement those as aggregate values until a canonical data source, deduplication rule, and formula are defined. The safe default is to use existing single-metric facts and keep the required layout from manufacturing business meaning.

## Requirement

- Deliver in order: Phase 0 audit and contract; Phase 1 design system and shell; Phase 2 Overview; Phase 3 Activities and Capabilities; Phase 4 Team Drill-down and Metric Detail; Phase 5 Operational Workbench; Phase 6 visual convergence and full gate.
- Desktop-only visual acceptance at 1920×1080 and 2560×1440. Analytics pages use the full post-sidebar width. The browser document is the page-level vertical scroll owner.
- Ant Design remains the interaction primitive layer; runtime product tokens and product-owned analytics components define the visual system.
- Keep Analytics and Operational Workbench as distinct page patterns.
- Preserve catalog definitions, `company_average` / `domain_summary` / maturity distinctions, URL state, route semantics, API contracts, permissions, confirmation flows, pagination, filters, and error recovery.
- Add an API/ViewModel only when it derives a business-valid view from existing facts. No cross-metric aggregate or deduplication assumption is allowed by presentation code.
- After each phase, run its required quality commands, inspect the changed routes in a real browser at both target sizes, capture screenshots, fix visible defects, then continue.

## Current Behavior

- App Shell is `AppShell` in `frontend/src/App.jsx`; Sidebar is fixed, its navigation is the only current independent vertical scroller, Topbar is sticky, and `.app-shell__content` clips horizontal overflow without creating a vertical scroller.
- Dashboard and Analytics outer content are fluid, but `.executive-kpi-grid` in `frontend/src/analytics/analytics.css` has a 1680px cap. At 2560px the available content measured 2302px while the KPI row measured 1680px.
- Activities show a horizontal sticky anchor row and one section per activity, with metric-specific panels. Capabilities already use a 220–240px sticky directory plus a flexible detail region, but the detail currently concentrates on maturity and metric trends.
- Team Drill-down has a sticky activity directory and team-specific trends, but it does not use the target overall / lifecycle / maturity section story.
- Operational routes already use PageHeader, FilterToolbar, Ant Design tables, drawers, and role-aware flows. Preserve those behaviors and keep their operational density.
- Runtime token ownership is `frontend/src/design/tokens.css`; `theme.js` adapts semantic tokens to Ant Design and `charts/chartTheme.js` reads the same source for ECharts.

## Target Behavior

- Use a full-width analytics canvas at 1920px and 2560px with stable page rhythm, legible data hierarchies, rich metric cards, custom chart presentation, explicit benchmark styling, useful matrices, and local table overflow only where needed.
- Keep all derived values traceable to one catalog metric or a separately approved, documented aggregate. Empty and missing data remain explicit; no zero-fill or fabricated facts.
- Overview, Activities, Capabilities, Team Drill-down, and Metric Detail each follow their own analytical task while sharing token, chart, benchmark, directory, and matrix ownership.
- Operational Workbench pages gain consistent PageHeader, filter, table, master-detail, drawer, and status styling without gaining dashboard-only KPIs or charts.

## Design

The work follows the required phase order and reuses the current API, route state, and shared UI ownership unless a verified product need requires a documented change.

### Phase 0 — audit and design contract

- Audit AppShell, page widths, document scroll ownership, overflow, CSS grid/card/typography patterns, ECharts options/theme, duplicate styles, API/ViewModel facts, and current route behavior.
- Update `UX-CONTRACT.md` for desktop-only 1920×1080 / 2560×1440 acceptance. Record references already present under `docs/ux/reference/`.
- Update this record and its active index before implementation. Phase 0 screenshot evidence covers Overview, Activities, Capabilities, Team Drill-down, and IR Workbench.

### Phase 1 — design system and shell

- Update `frontend/src/design/tokens.css`, `frontend/src/design/theme.js`, `frontend/src/charts/chartTheme.js`, and `frontend/src/design/design-system.css`; keep CSS variables canonical and the framework/chart files as adapters.
- Refine the existing `AppShell` in `frontend/src/App.jsx` and `frontend/src/app.css`; preserve 248px/64px widths, role-filtered routes, Topbar ownership, focus, and the current Sidebar behavior.
- Reuse or establish the smallest shared presentation components needed for PageHeader, AnalyticsSection, MetricKpiCard, ChartCard, BenchmarkLegend, AnalyticsDirectory, and MaturityMatrix. Keep data, URL, and permission ownership in their current domain modules.
- Keep document scrolling and test for accidental vertical overflow ancestors.

### Phase 2 — Overview

- Rebuild the Overview in `frontend/src/analytics/AnalyticsPages.jsx` and `frontend/src/analytics/analytics.css`; put reusable logic in `frontend/src/overview/` only when it has a real second caller or business rule.
- Keep all team trends for one selected metric together; lifecycle values remain separately named and unit-safe; maturity stays independent; team comparison leads to existing Team Drill-down.
- Reuse `/api/compute` and `/api/maturity/overview` unless an additional view can be derived with no new business assumption. If an API/model change becomes necessary, update schemas, backend tests, `docs/business/analytics.md`, `docs/architecture/overview.md`, and this record before implementation.
- Resolve the mismatch between the four requested headline labels and current activity-scoped catalog metrics without combining unlike metrics or creating a composite KPI.
- Extend the existing `/api/compute?version_id=...` filter to time-dimension key activity facts by their owning iteration's version. Add a per-team/per-period `fact_count` to series points so count zero remains distinct from no fact; general capability metrics have no version scope and remain unfiltered.

#### Phase 2 documentation impact before implementation

- Business Design: UPDATE `docs/business/analytics.md` for same-metric period aggregation and time-based version scope; the four unsupported universal labels remain unimplemented and are not added as new business metrics.
- Architecture: UPDATE `docs/architecture/overview.md` for the frontend period view-model, the additive series `fact_count`, and the existing `compute.py` owner of version filtering; no new endpoint or persistence model is planned.
- Standards: NONE; add one backend compute regression test and keep the current test commands.
- ADR: NONE; no lasting data or permission decision is introduced.
- UX/Design: UPDATE `UX-CONTRACT.md` and `DESIGN.md` only for component or URL-state behavior that actually ships.
- Change Design: UPDATE this active record with the chosen safe handling, code paths, screenshots, and gate results before moving to Phase 3.

### Phase 3 — Activities and Capabilities

- Keep `AnalyticsDetailPage` and its route data behavior; convert Activities to a 220–240px vertical directory plus fluid workspace. Directory selection stays local; existing metric/period/time/version state remains URL-backed.
- Activities show selected-activity outcomes, separate per-metric trends, a team-difference matrix for a selected period, and raw fact evidence. Keep `company_average` and `domain_summary` separate and do not aggregate across activities.
- Capabilities share the shell but use a different hierarchy: status by real metric type, numeric team differences, boolean team-state lists, capability evolution, evidence drawer, and separate maturity. No team selector or synthetic capability score.
- Preserve activity URL parameters, time/version/iteration filters, boolean unknown-state behavior, maturity's natural month, and `company_average` label.

#### Phase 3 documentation impact before implementation

- Business Design: UPDATE `docs/business/analytics.md` for selected-activity directory/workspace behavior and capability type-aware status/evidence; preserve each metric's existing meaning.
- Architecture: NONE expected; reuse `/api/compute`, `/api/maturity/overview`, and current response DTOs.
- Standards: NONE; preserve the current API and route contracts.
- ADR: NONE expected; no new business formula or persistence decision.
- UX/Design: UPDATE `UX-CONTRACT.md` and `DESIGN.md` for local directory selection, fluid workspace, and the distinct activity/capability page patterns.
- Change Design: UPDATE this active record with route screenshots, gates, and the exact semantics retained before moving to Phase 4.

### Phase 4 — Team Drill-down and Metric Detail

- Update `frontend/src/drilldown/TeamDrilldownPage.jsx`, `frontend/src/drilldown/drilldown.css`, and `frontend/src/drilldown/drilldownLogic.js` as one story: overall performance, key lifecycle with one selected activity and its actual metrics, and maturity matrix/radar. Add sticky section navigation for those three sections.
- Keep two four-card KPI rows by reusing the four actual Overview catalog metrics (`cd-ar-pen`, `cd-eff`, `tce-count`, `tcg-rate`) with their real activity/metric labels. Each card's main value is the current team; the same-metric `company_average` is its benchmark. Recompute cycle values per team from raw facts, without cross-metric aggregation.
- Update `frontend/src/metricDetail/MetricDetailPage.jsx`, its logic, and shared analytics CSS only as required. Keep one metric per detail route, current team as the primary series, and `company_average` as the fact benchmark.

#### Phase 4 documentation impact before implementation

- Business Design: UPDATE `docs/business/analytics.md` for the team story, existing metric codes, same-team cycle math, and maturity separation; no new metric semantics.
- Architecture: UPDATE `docs/architecture/overview.md` for the TeamDrilldown view-model/section navigation and preserve the existing fact/maturity endpoints.
- Standards: NONE; keep the route/API and current team authorization behavior.
- ADR: NONE; no new persistence, aggregation boundary, or permission decision.
- UX/Design: UPDATE `UX-CONTRACT.md` and `DESIGN.md` for the three-section story, sticky navigation, and team/benchmark roles.
- Change Design: UPDATE this active record with the two-route screenshots, gates, and any verified visual exceptions before moving to Phase 5.

#### Phase 4 changes and gates

- Reworked Team Drill-down into Overall Performance → R&D Lifecycle → Maturity Profile with sticky section navigation. Two four-card KPI rows use only `cd-ar-pen`, `cd-eff`, `tce-count`, and `tcg-rate`; each keeps the selected team primary and same-metric `company_average` benchmark. Monthly and cycle values are derived per metric from existing facts; count change is the selected month's contribution and rate/efficiency change compares the cumulative result with and without that month.
- The two overall trends retain the selected team and `company_average`; lifecycle selection shows the selected activity's actual penetration and efficiency metrics side by side. The maturity section uses the existing team-record and maturity-overview APIs to show team/domain matrix and radar pairs for key and general activities. Metric Detail remains a single-metric Result → Comparison → Evidence page.
- Updated `docs/business/analytics.md`, `docs/architecture/overview.md`, `UX-CONTRACT.md`, and `DESIGN.md`. No endpoint, permission, metric definition, or persistence change was introduced.
- `npm --prefix frontend run test:unit` passed (53 Node tests and 97 Vitest tests); `npm --prefix frontend run build` passed; `npm run check:docs`, `npm run test:docs`, and `git diff --check` passed. `npm run test:e2e:gateway` passed all 9 tests. The build retains its existing Ant Design and ECharts chunk-size warnings.
- Real-browser review covered Team Drill-down and Metric Detail at 1920×1080 and 2560×1440. The team route showed two aligned four-card rows, two overall trends, two lifecycle trends, and two maturity matrices/radars. Sticky section navigation stayed below the fixed Topbar while the browser document reached its bottom; no nested vertical scrolling, horizontal overflow, or page errors appeared. The local seeded data has no maturity records, so the two maturity matrices/radars correctly show unevaluated values. A valid high efficiency fact expands the linear chart scale; the value/formula remains unchanged.
- Screenshots (top and document-bottom for Team Drill-down; top for Metric Detail) are in the local Codex visualization output folder under `ai-dev-radar-ux-phase2`.

### Phase 5 — Operational Workbench

- Audit and refine the requirements/IR workspace and maturity maintenance in `frontend/src/dataManagement/DataManagementPage.jsx` and `frontend/src/dataManagement/dataManagement.css`; keep requirements table-first and maturity as a batch-edit table with explicit preview Drawer.
- Refine team, product/version, dashboard-metric and IR-metric-rule workspaces within `DataManagementPage.jsx`, reusing current master/detail and `SettingsWorkspace` patterns in `frontend/src/design/design-system.css` where they clarify object ownership.
- Refine `/settings/users`, `/settings/collections`, and `/settings/gateway` in `frontend/src/settings/UsersSettingsPage.jsx`, `frontend/src/settings/CollectionsSettingsPage.jsx`, and `frontend/src/settings/GatewaySettingsPage.jsx`; use the existing shared PageHeader, filter, table, status, section, and Drawer patterns without changing CRUD, readiness, confirmation, collection, authorization, or secret-handling flows. The seven-column run-history workspace moves from its current 1120px readable cap to the existing 1600px operational width; its schedule controls remain readable, and Gateway configuration stays at its 1120px form width. Remove the duplicate configure action from the Gateway empty card so PageHeader owns the primary action.
- Reuse and extend `frontend/src/design/design-system.css` and existing components rather than adding page-local design primitives. Keep pending domains visibly pending and avoid turning CRUD pages into dashboards.

#### Phase 5 documentation impact before implementation

- Business Design: NONE expected; the workbench remains presentation-only and preserves `docs/business/data-management.md` behavior.
- Architecture: UPDATE `docs/architecture/overview.md` for the `/settings/collections` operational content mode and 1600px workbench width; no API or permission change is planned.
- Standards: NONE; keep existing route, form, table pagination/filter, confirmation, and API contracts.
- ADR: NONE expected; no data lifecycle, secret-storage, authorization, or integration decision is planned.
- UX/Design: UPDATE `UX-CONTRACT.md` and `DESIGN.md` for the verified collections workbench width and PageHeader-owned primary action; preserve existing FilterToolbar, Table/status, master-detail, and Drawer ownership.
- Change Design: UPDATE this active record with exact route coverage, tests, browser checks, and screenshots before moving to Phase 6.

#### Phase 5 changes and gates

- Kept the existing table-first and master/detail operational patterns across IR, maturity, teams, products/versions, metric definitions, collections, Gateway, and users/permissions. AR/SR and other pending data domains remain visibly pending.
- `/settings/collections` now uses the existing Operational content mode and 1600px workbench width so its seven-column run-history table uses the available table surface. The scheduled form stays capped at 1040px with a three-column desktop field layout; the manual time-window disclosure and existing native controls remain unchanged. Run history uses the shared operational workspace frame.
- `/settings/gateway` keeps its 1120px Readable form layout. The PageHeader is now the single configure entry point in the unconfigured state; the duplicate card action was removed.
- Updated `UX-CONTRACT.md`, `DESIGN.md`, and `docs/architecture/overview.md`. No API, permissions, mutation, secret-handling, state-transition, or business definition changed. No ADR was needed.
- `npm --prefix frontend run test:unit` passed: 53 Node tests and 97 Vitest tests. The route-mode expectation was updated for Collections. `npm --prefix frontend run build`, `npm run check:docs`, `npm run test:docs`, and `git diff --check` passed. `npm run test:e2e:gateway` passed all 9 tests. Build retains the existing Ant Design and ECharts chunk-size warnings.
- Browser review covered Collections and Gateway at 1920×1080 and 2560×1440. Collections measured 1536px for the operational page, 1040px for the scheduled form, and 1534px for the run-history table; the table fit without internal horizontal spill. The document width stayed below viewport width; at 1920 the document reached its 72px bottom scroll and Topbar stayed at top 0; at 2560 the page fit the viewport. Gateway measured 1056px and exposed exactly one “配置 Gateway” action. No page errors appeared.
- Phase 5 screenshots are in the local Codex visualization output folder under `ai-dev-radar-ux-phase5`; initial 1920px route inventory screenshots are retained alongside the final 1920/2560 Collections and Gateway screenshots.

### Phase 6 — Visual convergence and full gate

- Re-capture and inspect every primary route in `e2e/specs/phase5-smoke.e2e.spec.js` at exactly 1920×1080 and 2560×1440, including document-bottom screenshots for long pages; use the existing local Playwright browser helper and keep images outside the repository.
- For every route check document width, document-bottom reachability, nested vertical scroll ownership, sticky headers/navigation, table/card geometry, clipped content, and page errors. Exercise relevant keyboard/focus, Select popup, Drawer/confirmation, empty/error/permission, and reduced-motion states; fix only observed defects in their existing component/page styles and rerun that route before accepting it.
- The browser audit found that modal operational Drawers close on Escape but return focus to `body` instead of the triggering action. Add `frontend/src/components/FocusRestoringDrawer.jsx`, wire its provider in `frontend/src/App.jsx`, migrate the shared analytics/data-management/settings modal Drawers to it, preserve the mobile navigation Drawer’s existing explicit opener restoration, and add a browser regression assertion in `e2e/specs/phase5-smoke.e2e.spec.js`.
- Other required implementation surfaces if the browser audit finds defects: `frontend/src/app.css`, `frontend/src/design/design-system.css`, `frontend/src/analytics/analytics.css`, `frontend/src/dataManagement/dataManagement.css`, `frontend/src/drilldown/drilldown.css`, and the owning route component. Keep documented design facts current in `DESIGN.md`, `UX-CONTRACT.md`, `docs/business/analytics.md`, `docs/business/data-management.md`, and `docs/architecture/overview.md` only when findings actually change them.
- Run `npm run gate` as the final project gate and run the Frontend Design Premium strict static audit from `premium-ui.json`'s contract at an external report path. Then update `docs/changes/active/enterprise-analytics-ux-redesign.md`, validate navigation with `npm run check:docs`, and move the record to `docs/changes/completed/` only after all visual defects and gates are closed.
- Drawer restoration documentation impact: Business Design NONE; Architecture UPDATE `docs/architecture/overview.md` for the shared focus owner; Standards NONE; ADR NONE; UX/Design UPDATE `UX-CONTRACT.md` and `DESIGN.md` for the shared modal Drawer wrapper and focus-return contract. No API, metric, route, permission, or persistence change is planned.

#### Phase 6 changes and final validation

- Added `frontend/src/components/FocusRestoringDrawer.jsx`, registered its interaction-target provider in `frontend/src/App.jsx`, and moved Analytics, IR, maturity, team/product/metric, Gateway, and user-management modal Drawers onto it. The wrapper restores focus after pointer or keyboard activation, Escape, explicit close, and programmatic close; the mobile navigation Drawer keeps its existing explicit opener restoration.
- Added a Playwright regression in `e2e/specs/phase5-smoke.e2e.spec.js` for maturity preview and Gateway configuration Drawer focus restoration. The browser check confirmed both invoking controls regain focus at 1920×1080 and 2560×1440, and the preview/configure flows issued no mutation request when opened and dismissed.
- Captured and inspected all 18 primary routes at 1920×1080 and 2560×1440. Every route had a localized title and visible page heading; all 36 viewport/route checks had `document.scrollWidth <= innerWidth`, no non-sidebar nested vertical scroller, no page error, and a reachable document bottom. Topbar stayed at `top=0`; Team section navigation stayed at `top=64` at the document bottom; Activity/Capability directories stayed at `top=72`.
- Maturity editing was checked with a selected team: all 15 assessment rows rendered, the browser document reached its bottom, preview remained dismissible by Escape, and blank values stayed unevaluated. The IR team Select popup matched its trigger at 220px and stayed within both target viewports. Collection custom-window disclosure exposed the existing two local datetime fields; the Gateway token remained `type=password`. `prefers-reduced-motion: reduce` matched and reduced the Sidebar control transition to `0.00001s`.
- Hovered the Overview trend at both viewport sizes. The tooltip contained same-metric team facts and `company_average`; its measured bounds remained inside the viewport at 1920 and 2560. No clipping or page overflow appeared.
- Final `npm run gate` passed: 145 backend tests; 53 Node and 97 Vitest frontend tests; production build; all 10 Gateway/UX E2E tests; documentation checks and tests. `git diff --check` passed. The build still reports the existing Ant Design/ECharts chunks above 500 kB; pytest reports the existing dependency deprecations and cache permission warning.
- Frontend Design Premium strict audit returned 0 findings. Its JSON report and the browser screenshots are in the local Codex visualization output under `ai-dev-radar-ux-phase6`; these files are not committed to the repository.

## Final Documentation Impact

- Business Design: `docs/business/analytics.md` updated for the selected-month Team KPI cycle math, current single-metric codes, and team/maturity presentation. `docs/business/data-management.md` remains accurate and was not changed because CRUD, Gateway, collection, confirmation, data lifecycle, and permission semantics did not change.
- Architecture: `docs/architecture/overview.md` updated for additive `fact_count`/version filtering, Analytics page ownership, the Collections operational width, and the shared focus-restoring Drawer owner.
- Standards: NONE — the existing project test and gate commands remain authoritative.
- ADR: NONE — no new metric, persistence, permission, API, or service-boundary decision was introduced.
- UX/Design: `UX-CONTRACT.md` and `DESIGN.md` now record desktop acceptance widths, token/component ownership, operational width patterns, Analytics page behavior, and modal Drawer focus restoration.
- Change Design: this Phase 0→6 record is ready to move to `docs/changes/completed/`; final docs checks must pass after both change indexes are updated.

### Phase 5 — Operational Workbench

- Reconcile `frontend/src/dataManagement/DataManagementPage.jsx`, `frontend/src/dataManagement/dataManagement.css`, and existing `frontend/src/settings/*Page.jsx` styles with the shared design system.
- Preserve all API methods/payloads, backend role checks, locked maintainer scope, write confirmation, pagination, query timing, staged batch confirmation, Drawer context, and pending-domain states.

### Phase 6 — visual convergence and full gate

- Inspect each changed Analytics and Operational route at 1920×1080 and 2560×1440; verify full-width use, KPI alignment where present, chart plot size, directory/workspace ratio, document scroll, horizontal overflow, sticky behavior, legends/tooltips, truncation, and card heights.
- Run the required phase commands and relevant E2E after every phase. Run the project full gate at the end. Update current design/business/architecture documentation, archive this Change Design only after all gates and browser checks pass.

## Business Impact

No change to existing metric definitions or permissions is intended. Maturity stays a separate human assessment. `company_average`, `domain_summary`, team-level facts, boolean state, and missing-value meanings remain unchanged. Phase 2 adds team fact presence to each period point so a no-fact count is not shown as zero and so `company_average` averages only non-missing team values, consistent with its documented definition. Cycle views still use one catalog metric at a time, recompute rate/efficiency from that metric's raw facts, and use that month's team-equal `company_average` as the absolute-count change. A selected version filters time-scoped key activity facts by iteration ownership; general capability facts remain out of version scope. Any other aggregation requires a supported source and documented formula before implementation.

## Architecture Impact

The intended work is primarily frontend presentation. Shared visual ownership stays in the existing design, chart, and component modules. Phase 2 adds a client view model over existing single-metric responses and extends `backend/app/compute.py` so `version_id` filters time-dimension key facts. The existing response gains a per-team/per-period `fact_count`; no new endpoint, persistence schema, or permission change is planned.

## API / Contract Changes

The request remains unchanged and `/api/compute` remains a one-catalog-metric query. The response adds `fact_count` to each team/period `series.values` point so a recorded zero remains distinct from no facts. `company_average` excludes teams without facts for that period, matching its existing non-missing-team definition. `version_id` also filters time-dimension key activity facts by `FactRecord.iteration_id → Iteration.version_id`; general capability metrics do not use this filter. Add backend regression tests for version scope and zero/missing semantics.

## Data Changes

None. No database model, migration, seed, catalog, calculation, or authorization change is planned.

## Compatibility

Preserve routes and analytical URL state; 248px/64px sidebar widths and existing collapse preference; all business filters; role visibility and backend authorization; API payloads; 403/404/pending states; staged import/collector confirmation; and all existing table/drawer behavior.

## Error & Boundary Handling

Loading, error, empty, missing, not-evaluated, and boolean-unknown states retain stable geometry and their existing meanings. Tooltip/legend clipping and sticky-header interactions are part of visual acceptance. No missing fact becomes zero.

## Risks & Trade-offs

- The requested four global Overview KPI names lack matching business definitions in the current catalog and API. The current page keeps the existing single-metric catalog labels until valid business formulas are approved.
- The previous API did not expose team fact counts per period, so empty count points could appear as zero. Phase 2 adds only the response evidence needed to preserve the documented missing-value distinction.
- A fluid 2560px canvas can still look sparse if cards or charts retain inner width caps; inspect actual plot dimensions, not just grid width.
- CSS overflow clipping can prevent sticky descendants from behaving as intended; real-browser scroll testing is required after shell changes.
- The active sidebar/logo Change Design is a separate record; reuse its accepted light Sidebar behavior without silently rewriting that record.

## Test Strategy

- Every phase: `npm --prefix frontend run test:unit`, `npm --prefix frontend run build`, `npm run check:docs`, `npm run test:docs`, `git diff --check`, and relevant Playwright/E2E.
- Browser: changed routes at 1920×1080 and 2560×1440, using seeded/demo data only as visual fixtures and never as claims about production facts.
- Final: run `npm run gate`; inspect every Analytics and Operational route for document scroll, no horizontal page overflow, sticky navigation, focus, reduced motion, empty/error/loading, and unchanged permissions/requests.

## Documentation Impact

- Business Design: UPDATE `docs/business/analytics.md` in Phase 2 to record same-metric cycle math, zero-vs-missing count semantics, and the key-activity version filter, without changing existing metric definitions.
- Architecture: UPDATE `docs/architecture/overview.md` in Phase 1 for token/component ownership and Phase 2 for the additive `fact_count`, `compute.py` version filtering, and client view-model ownership.
- Standards: NONE — existing test commands and project gate are sufficient.
- ADR: NONE — period values reuse existing per-metric formulae and `company_average`; version scope follows existing iteration ownership and changes no stored facts. Reassess only if a new cross-metric formula or service boundary is introduced.
- UX/Design: UPDATE `UX-CONTRACT.md` and the desktop visual target in `DESIGN.md` during Phase 0; reconcile `DESIGN.md` component and token mapping in Phase 1 alongside runtime tokens and shared components.
- Change Design: CREATE this large active record and update `docs/changes/active/README.md`; move to completed and update both indexes after all phases and validation.

## Validation

### Phase 0 browser baseline

- Opened the current app in Chrome using the local seeded admin session.
- At 1920×1080 the Overview document measured 1512px high, confirming the page can scroll beyond the viewport.
- At 2560×1440 the document measured `2550px` client width and `2550px` scroll width, `1512px` document height, and no nested vertical overflow region. The Analytics content was 2302px wide while its KPI grid was capped at 1680px.
- Captured baseline browser screenshots at Overview 1920×1080 and Overview, Activities, Capabilities, Team Drill-down, and IR Workbench at 2560×1440. The local selected month is 2026-09; facts exist through 2026-08. Demo data is visual evidence only.

### Automated

- `npm --prefix frontend run test:unit` passed: 46 Node tests and 89 Vitest tests.
- `npm --prefix frontend run build` passed; the existing Ant Design and ECharts vendor chunks remain above the 500 kB warning threshold.
- `npm run check:docs` passed; `npm run test:docs` passed; `git diff --check` exited 0 (Git emitted only its LF-to-CRLF normalization warning).
- No feature E2E was needed in Phase 0 because it changed documentation only. Real-browser baseline screenshots were captured for the listed routes.

### Phase 1 — design system and shell

#### Changes

- Refined fixed team data colors to blue/green/orange/purple for the first four slots, strengthened the dashed neutral benchmark, added maturity-cell fills, and mapped Ant Design spacing/control height from canonical tokens.
- Changed the Analytics canvas gutter to 24–32px at the target desktop widths. Kept the existing 248px/64px Sidebar, 56px sticky Topbar, role filtering, routes, and document-scroll ownership.
- Added shared presentation components for AnalyticsSection, ChartCard, BenchmarkLegend, AnalyticsDirectory, MaturityMatrix, and MetricKpiCard; migrated current Overview chart/maturity sections and Activities/Capabilities directories without changing their data or route semantics.
- Added unit/rendering coverage for sparkline gaps, zero vs missing, directory selection, maturity cells, and empty chart states.
- Updated `DESIGN.md`, `UX-CONTRACT.md`, and `docs/architecture/overview.md` with token and component ownership.

#### Automated

- `npm --prefix frontend run test:unit` passed: 46 Node tests and 94 Vitest tests.
- `npm --prefix frontend run build` passed; the pre-existing ECharts and Ant Design vendor chunks remain above the 500 kB warning threshold.
- `npm run check:docs`, `npm run test:docs`, and `git diff --check` passed.
- `npm run test:e2e:gateway` passed: 9 browser tests, including the existing Gateway workflow, authorization, route, and release smoke checks.

#### Real browser

- Captured and inspected Overview at 1920×1080 and 2560×1440, Activities and Capabilities at 2560×1440, and the IR Workbench at 2560×1440. Screenshots were reviewed in the browser session and are not committed as repository binaries.
- At 1920×1080 the document width measured 1910/1910px, height 1588px, and the post-sidebar content measured 1662px. At 2560×1440 the document measured 2550/2550px wide and 1595px tall; content measured 2302px.
- Scrolling the 2560×1440 Overview to the bottom reached `scrollY=155` with the Topbar at `top=0`; no descendant created a competing vertical scroll region. KPI cards measured 411×174px and their sparklines 143×34px.
- The current Overview still has its pre-existing 1680px KPI-grid cap. Phase 2 owns its removal and the new Overview composition.
- Activities anchors remained links with section-current state. Capability directory selection remained keyboard-addressable buttons with explicit accessible names and updated the displayed capability. The IR empty table retained local horizontal scrolling; no mutation was submitted.

#### Remaining boundary

Reduced-motion preference was not browser-emulated in this phase; the existing global CSS and ECharts `matchMedia` behavior remain in source and are carried to final acceptance. Visual values in the local database are seed/demo data, not production evidence.

### Phase 2 — Overview

#### Changes

- Added selected month, cycle (`6m` / `half` / `year`), and version controls. Month, cycle, and version remain URL-backed; each cycle window ends at the selected month.
- Replaced the former management summary with separate four-column monthly and cycle KPI rows for the existing `cd-ar-pen`, `cd-eff`, `tce-count`, and `tcg-rate` metrics. Labels retain activity and metric names; the four unsupported cross-activity KPI definitions were not inferred.
- Cycle rate/efficiency values aggregate the same metric's team raw facts and then average valid team results. Cycle count is each team's period sum averaged across valid teams; its change is the current-month `company_average` contribution. The core trend shows every team series and the same metric's `company_average`.
- Rebuilt key-activity selection, team metric matrix and two metric previews with Team Drill-down links, and maturity category matrix/current-previous radar. Removed the out-of-spec generic ranking panel and redundant maturity-coverage strip. The maturity query now loads only the selected category.
- Extended existing `version_id` behavior so time-dimension key activity facts are filtered through `FactRecord.iteration_id → Iteration.version_id`. General metrics remain unfiltered. The request is unchanged; `series.values` adds `fact_count`, no-fact numeric points remain null, and `company_average` excludes no-fact teams. Persisted data, metric formulas, and authorization are unchanged.
- Added the `TeamMatrix` presentation component ownership to `UX-CONTRACT.md`, `DESIGN.md`, and `docs/architecture/overview.md`; updated `docs/business/analytics.md` with the current Overview order, same-metric aggregation, and recorded-zero versus no-fact semantics.

#### Automated

- `npm --prefix frontend run test:unit` passed: 52 Node tests and 97 Vitest tests.
- `npm --prefix frontend run build` passed; existing Ant Design and ECharts vendor chunks remain above the 500 kB warning threshold.
- `npm test` passed: 145 backend tests. `npm run test:e2e:gateway` passed: 9 browser tests, including Gateway workflows, authorization, route/release smoke, URL state, confirmation, and keyboard checks.
- `npm run check:docs`, `npm run test:docs`, and `git diff --check` passed. Git only reported existing LF-to-CRLF normalization warnings.

#### Real browser

- Reviewed the seeded/demo Overview at 1920×1080 and 2560×1440 with the selected month set to 2026-08. The screenshots are available in the local Codex visualization output and are not committed as repository binaries.
- At 1920×1080, document width was 1920/1910px (`scrollWidth <= clientWidth`) with no page-level horizontal overflow; the Analytics canvas was about 1608px and each four-column KPI track about 390px. At the document bottom, `scrollY=2006` matched the maximum, the Topbar remained at `top=0`, and no descendant owned vertical scrolling. The trend card used the full canvas. The spacing below the first KPI row was corrected after visual review.
- At 2560×1440, document width was 2560/2550px with no horizontal overflow; the Analytics canvas and full-width trend card were 2238px, with four 547.5px KPI tracks. At the document bottom, `scrollY=1660` matched the maximum, the Topbar remained at `top=0`, and no descendant owned vertical scrolling.
- Rechecked count semantics in the browser: the 2026-08 `tce-count` card shows 73 from the only team with a fact (`1/4` valid), and teams without a fact show `—` in the matrix. A recorded zero remains visible in the API/ViewModel path.
- Verified cycle switching updates the URL and period label, and changing the month through the native month control updates the URL and the displayed month. A browser-render-only check caught and fixed a missing `TeamMatrix` import that the first test set did not execute; the root rendering fixture now exercises the four metric codes.
- The demo efficiency data contains a valid extreme `company_average` point, which expands the linear chart axis. The chart keeps the exact value and existing formula; no clipping or changed aggregation was introduced.

### Phase 3 — Activities and Capabilities

#### Changes

- Replaced the Activities horizontal anchor strip and repeated full-page activity sections with the shared `.analytics-directory-workspace`: a 240px vertical activity directory and a fluid selected-activity workspace.
- The Activities workspace shows one activity's catalog outcomes, same-metric trend cards, a selected-period team matrix, and a separate raw-quantity evidence table. An explicit all-period filter keeps trends and suppresses current snapshots and team comparisons. Selecting an activity remains local; existing metric, period, time, and version filters stay URL-backed.
- The Capabilities workspace uses the same frame but a different hierarchy: type-aware status, per-metric evolution, numeric team matrix, raw evidence, and separate human maturity. Boolean capability state remains per team and has no 0/1 trend or company average.
- Metrics are fetched only for the selected activity or capability. The Activity page no longer requests maturity history; capability maturity errors remain in their section without hiding numeric status/trends.
- Updated `docs/business/analytics.md`, `docs/architecture/overview.md`, `DESIGN.md`, and `UX-CONTRACT.md` for the selected-directory flow and the two distinct page patterns. No API, permission, metric, or persistence change was introduced in Phase 3.

#### Automated

- `npm --prefix frontend run test:unit` passed: 52 Node tests and 97 Vitest tests.
- `npm --prefix frontend run build` passed; Ant Design and ECharts vendor chunks remain above the existing 500 kB warning threshold.
- `npm run check:docs`, `npm run test:docs`, and `git diff --check` passed; Git reported only LF-to-CRLF normalization warnings.
- `npm run test:e2e:gateway` passed all 9 tests, including route/release smoke, authorization, URL state, confirmation, and keyboard checks.

#### Browser review

- Captured both pages at 1920×1080 and 2560×1440 with demo data, and captured each page bottom after scrolling the browser document to its maximum.
- In all four viewport/route combinations, the directory measured 240px and the flexible workspace used the remaining 1344px at 1920 or 1974px at 2560. Document `scrollWidth` did not exceed `clientWidth`, and no nested vertical scroller or page error appeared.
- The Activity document reached its bottom at `scrollY=539` (1920) and `186` (2560); the Capability document reached `627` and `267`. The Topbar stayed at `top=0` at each bottom. Directory selection was exercised on both routes; changing the current object requested only its metrics.
- Screenshots are stored in the local Codex visualization output and are not committed as repository binaries. Reduced-motion emulation and final focus/tooltip overflow checks remain for Phase 6.

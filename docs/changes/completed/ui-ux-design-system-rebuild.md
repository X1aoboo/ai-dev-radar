# UX/UI Design System and Phased Rebuild

## Status
Completed

## Background

The React application has functional analytic, operational, and configuration routes, but its visual rules are split between large route CSS files and Ant Design defaults.  The current shell has already established a tested light navigation treatment; this change introduces a product-owned semantic design system and migrates routes in bounded phases without changing facts, permissions, routes, or API contracts.

## Requirement

- Keep React 19, Ant Design 6, ECharts 5, Vite, the Sidebar + Topbar + Content model, and the current top-level information architecture.
- Establish light-mode semantic tokens, Ant Design theme adaptation, typography, spacing, surfaces, data-visualisation rules, reusable page patterns, and consistent feedback states.
- Deliver in order: foundation and shell; analytics; data workbench; system surfaces; final accessibility and legacy-style retirement. Do not start a later phase until the earlier phase passes its acceptance checks.
- Preserve verified analytics semantics: missing values are not zero; `company_average` remains the overview fact baseline; maturity remains a separate manual assessment; no invented targets, composite scores, or cross-metric rankings.

## Current Behavior

Current navigation, routing, role filtering, 248px/64px desktop collapse, 680px drawer breakpoint, focus behavior, and local preference are documented in [Business Design](../../business/index.md) and [Current Architecture](../../architecture/overview.md). Analytics and data-management behavior is documented in [Analytics](../../business/analytics.md) and [Data Management](../../business/data-management.md).

## Target Behavior

The product has one semantic token vocabulary used by App Shell, Ant Design adaptation, shared components, and future page migrations. The desktop navigation retains the tested 248px/64px widths: the requested 224px is a recommendation rather than a behavior requirement, and changing the width would add reflow risk with no product benefit. The Topbar becomes a compact 56px context and account surface; visible page title, description, and primary action live in a shared content-level PageHeader.

The visual direction is restrained enterprise analytics: quiet neutral surfaces, strong type hierarchy, stable tabular numerals, sparse boundaries, and data colours with fixed team identities. Dashboard, analytical workspace, and operational console share tokens but have different density.

## Design

The foundation introduces one semantic CSS vocabulary, explicit adapters for Ant Design and ECharts, and small presentation-only primitives. Route data, URL state, and permission checks remain at their existing owners.

### Phase 1 — foundation and App Shell

- Add `frontend/src/design/tokens.css` and `frontend/src/design/theme.js` as the CSS semantic-token source and Ant Design adapter. Business pages use semantic variables rather than new literal colours.
- Add `frontend/src/design/design-system.css` for typography, grid, scrollbars, page patterns, feedback states, and chart surface rules; do not extend page CSS for cross-route rules.
- Add `frontend/src/components/PageHeader.jsx`, `FilterToolbar.jsx`, `MetricCard.jsx`, and `AnalyticsPanel.jsx` as small composable patterns. They do not own business data or navigation state.
- Update `frontend/src/App.jsx` and `frontend/src/app.css`: retain navigation behavior, make Topbar context-only at 56px, use the token/theme layer, and provide the shell/grid baseline.
- Add `frontend/src/charts/chartTheme.js` as the shared ECharts visual baseline. Existing chart options retain their data mappings until Phase 2.

### Later phases

- Phase 2 migrates overview, activities, capabilities, team drilldown, and metric detail to the analytical patterns and chart theme. The overview has a fact/maturity summary, targetless-state disclosure, single-metric ranking, a single-metric domain-average trend, maturity charts, lifecycle facts, and drill-down links. The activities workspace must retain the existing URL-backed time/version-iteration dimension, time granularity, period, and metric selection, with multi-team trends and a domain-average reference; its maturity month remains a distinct natural-month assessment. The capabilities route has a structure directory and one selected Current State + Evolution workspace; boolean metrics use per-team status. Team drilldown keeps KPI → directory → trend order and adds separate current-team/domain maturity radars after the trend workspace. Metric detail follows Result → Comparison → Evidence.
- Phase 3 migrates requirements, maturity, issues, MR, and code review to compact operational table workflows and drawers.
- Phase 4 migrates system management, login, 403/404, and responsive fallbacks.
- Phase 5 removes replaced legacy styles and verifies accessibility, responsive behavior, and visual consistency.

## Business Impact

Presentation and interaction consistency change only. The current information architecture, status of pending data-source capabilities, permission checks, fact calculation, maturity rules, and all labels that express data semantics are retained.

## Architecture Impact

Frontend-only shared style and component ownership is added. `tokens.css` is the CSS runtime token source; `theme.js` is the explicit Ant Design adaptation of those values; chart defaults remain presentation-only. Existing API, routing, and data modules retain ownership.

## API / Contract Changes

None. No request shape, response shape, route, authorization, or external protocol changes are planned.

## Data Changes

None. No aggregation, stored data, target, ranking, score, or maturity calculation changes are planned.

## Compatibility

Preserve desktop collapse preference, narrow drawer behavior, keyboard navigation, focus return, role-based navigation, existing URL filters, and no-request sidebar toggling. The separate active light-sidebar record remains the source for its already-tested logo-specific history; this change retains its visible interaction contract.

## Error & Boundary Handling

Shared loading, empty, error, no-permission, not-evaluated, and partial-data patterns reserve compact layout space and state the condition without inventing a value. Charts continue to render gaps for missing data and honour reduced motion.

## Risks & Trade-offs

Token adoption must not break Ant Design generated colour states, ECharts readability, or existing responsive behavior. The first phase deliberately adds the reusable foundation before changing analytic or operational information hierarchy; this limits regression scope but postpones route-level visual replacement to later phases.

## Test Strategy

- Run frontend unit/rendering tests, production build, docs checks, and `git diff --check` after each phase.
- Use the running application in a real browser at 1440px and 1920px; check navigation, focus, overflow, chart geometry, table density, drawers, filters, and loading/empty/error boundaries relevant to the phase.
- Preserve the pre-existing browser checks for mobile and reduced motion in later phase-specific acceptance.

## Documentation Impact

- Business Design: UPDATE `docs/business/index.md` and `docs/business/analytics.md` after the applicable phase, to describe the final shell and presentation patterns without changing data semantics.
- Architecture: UPDATE `docs/architecture/overview.md` after the applicable phase, to describe token, theme-adapter, chart, and shared-component ownership.
- Design and UX contracts: UPDATE `DESIGN.md` for durable shared visual-pattern usage and `UX-CONTRACT.md` for route/filter state behavior; runtime token values are unchanged in this correction.
- Standards: NONE — current engineering and testing rules remain sufficient.
- ADR: NONE — this does not alter an accepted business, data, navigation, or architecture decision.
- Change Design: CREATE this large, phased active record; finalise only after all phases and their current-state documentation are complete.

## Validation

### Phase 1

- `npm --prefix frontend run test:unit` passed: 37 Node tests and 65 Vitest route/render tests.
- `npm --prefix frontend run build` passed. The existing ECharts and Ant Design chunks above 500 kB remain a non-blocking build warning.
- `npm run check:docs`, `npm run test:docs`, and `git diff --check` passed.
- Real browser inspection on the existing local Vite application verified the overview and activities at 1440×900 and 1920×1080. At both widths there was no page-level horizontal overflow; Sidebar measured 248px, Topbar measured 56px, the content-level PageHeader rendered `研发活动`, and three overview charts measured 495×245px at 1920px.
- The desktop collapse control changed the Sidebar to 64px after its 240ms transition. Navigation measured `scrollWidth === clientWidth === 39`, `scrollLeft === 0`, and the document retained no horizontal overflow. The explicit browser viewport override was reset after inspection.

### Recorded boundary

`frontend-design-premium` strict audit was run with `--no-write` and reported 88 existing project-wide findings, concentrated in data-management/settings native control ownership, form `noValidate`, and static action detection. None are introduced by the Phase 1 diff; they are retained as Phase 3/4 and Phase 5 migration work rather than suppressed through audit configuration. This Change Design stays Active until every phase and those applicable findings are resolved.

### Phase 2

- `npm --prefix frontend run test:unit` passed: 40 Node tests and 66 Vitest route/render tests. `executiveLogic.test.js` protects missing-value coverage, tie-aware single-metric ranks, per-stage metric selection, and trend gaps.
- `npm --prefix frontend run build` and `git diff --check` passed; the existing vendor-chunk warning remains non-blocking.
- Browser verification: the redesigned overview at 1440×900 and 1920×1080 had no page overflow. KPI widths were 272px and 391px respectively; the 1920px maturity trends formed two equal 793px panels, and the lifecycle used three columns. The no-data month showed unavailable values without replacing gaps by zero.
- Browser verification on `?month=2026-08`: snapshot fact cards displayed coding penetration (62%, team range 38–86%) and coding efficiency (+77%, team range +11–+160%), both with six-month sparklines. The selectable core trend showed one metric's company-average series, and the ranking remained single-metric. Lifecycle stages showed six named catalog facts and same-metric trends; the missing delivery boolean stayed “暂无数据”. A 1440×900 content crop was captured inline for visual review; full-page capture remains unavailable for the long dashboard.
- Browser verification: `/analytics/metrics/11?period=2026-08` rendered the shared filter toolbar and Result/Comparison/Evidence headings with no overflow. Expanding Evidence exposed Team A–D names, current values, and raw fact summaries. `/analytics/teams/1?period=2026-08` retained four KPI tiles, the activity directory, on-demand detail controls, no page overflow, and the shared filter toolbar.
- Team maturity profile uses three current-month maturity API requests instead of fetching 12 months of history; a pure mapping test verifies zero stays valid and missing scores stay null.
- Capability page browser state for the Boolean deployment capability showed one row per team, no boolean metric trend, and no page overflow at 1440px/1920px. At 390px the status list wrapped within the page and the narrow shell used its navigation opener. The page now uses a seven-item capability directory with one selected current/evolution workspace.
- Team drilldown browser measurements after reordering showed KPI at y=348, activity directory at y=482, and first trend card at y=515 at 1440×900; the maturity comparison follows the activity trends. At 1920×1080 the two radars are capped at 588px each inside a 1200px centered region. The 390×844 stabilized layout rendered each radar at 332px with no horizontal overflow.
- After deleting `overview.css`, browser review caught an unstyled legacy-class TrendCard on metric detail; its shared surface, border, and 16px padding are now owned by `analytics.css` and verified in-browser. A screenshot capture for the long TeamDrilldown surface timed out; layout and computed-style evidence was gathered through the browser DOM instead, so a saved full-page visual comparison remains outstanding.

#### Phase 2 correction before acceptance

- A comparison against the referenced brief found that `/analytics/activities` currently exposes only a month input and hard-codes `dimension: time` plus month granularity. The shared `FilterBar`, URL filter model, and metric request helper already support dimension, granularity, version/iteration, and period, but this route does not use them. This is a Phase 2 requirement gap, not an approved simplification.
- The gap is implemented with the existing URL filter owner and `FilterBar`; `metricId` is now serialized as `metric`, selected activity cards narrow to the chosen catalog metric, and the selected period drives the current fact and chart point. “All periods” shows the full trend without a single-period snapshot. The maturity month remains separate. Boolean status uses the latest valid snapshot when no single period is selected; with an explicit period it uses that period's value and retains gaps as unknown rather than falling back. No API, aggregation, or permission change was made.
- A later screenshot/source inspection found a separate label mismatch: the metric drawer labeled `company_average` as “领域平均” while showing numerator/denominator from `domain_summary`. The 2026-05 efficiency example displayed +7,713% (the team-value arithmetic mean of +67% and +15,360%) alongside merged raw totals, which are a distinct calculation under `compute.py` and the business contract. The required correction is to label fact references “全公司均值”, show merged raw results separately in the drawer, and retain “领域平均” only for maturity. No backend formula or endpoint change is planned.
- The semantic correction is implemented: fact chart/callout labels now say `全公司均值`, maturity averages retain `领域平均`, and the quantitative drawer separates the company mean from the merged result and merged numerator/denominator. Removed the unlabeled first-team fact snippet from that aggregate summary. The regression fixture deliberately makes the company mean 40% and merged result 25%, and asserts both values and labels.
- Browser evidence on the live 2026-05 efficiency slice confirms the distinction: team values are +67% and +15,360%, `company_average` is +7,713%, and the merged raw-quantity result is +264% from 141.8 / 39. The drawer now labels and shows both values separately with the aggregation explanation and team distribution; chart axes were not capped or normalized to conceal the real outlier.
- The corrected drawer was reloaded and inspected in the browser after build/HMR: `全公司均值 +7,713%`, `合并口径结果 +264%`, merged numerator/denominator 141.8/39, sample count 2, and individual team values appear as distinct rows. The page chart legend/header now say `全公司均值`; maturity chart labels remain `领域平均`. An inline 1440px screenshot confirms the separation.
- 1440px screenshots show the final month label clipped in metric-detail and TeamDrilldown charts. The installed ECharts dependency supports `alignMinLabel`/`alignMaxLabel`; fix the common `buildTrendOption`, TeamDrilldown's own time/iteration options, and the analytical maturity line option, with a small option-level regression test. Do not change values, period selection, or scale. Only this active Change Design needs an additional validation note; Business, Architecture, Standards, and ADR are unaffected.
- Browser regression check after period-specific Boolean handling showed the capability workspace (which has no period selector) rendering four “暂无数据” states for the selected month even though `series.snapshot` carries the latest valid status. Existing business semantics require latest valid status when no explicit cycle is selected. Keep period-specific values only for an explicit period selection; otherwise reuse the existing `snapshot` field. Update the business/architecture/UX description and add a component regression test; no API/data calculation change.
- Documentation Impact plan for this semantic correction: UPDATE `docs/business/analytics.md` and `DESIGN.md` to name the fact baseline and its neutral dashed treatment precisely; UPDATE `UX-CONTRACT.md` and `docs/architecture/overview.md` to describe the separate metric detail outputs and current label ownership; UPDATE this active record with test/browser evidence; Standards and ADR remain NONE because the existing semantics are authoritative and unchanged.
- Documentation Impact: UPDATED `docs/business/analytics.md`, `docs/architecture/overview.md`, `UX-CONTRACT.md`, `DESIGN.md`, and this active record. Standards and ADR are NONE because existing API and business semantics were reused.
- `npm --prefix frontend run test:unit` passed: 42 Node tests and 68 Vitest route/render tests. `npm --prefix frontend run build` passed; the Ant Design (1,184 kB) and ECharts (1,036 kB) vendor chunks retain the existing non-blocking 500 kB warning. `npm run check:docs`, `npm run test:docs`, and `git diff --check` passed. Strict `frontend-design-premium` audit passed with 0 findings; JSON evidence is retained in [`premium-audit.json`](../../../premium-audit.json).
- Browser interaction evidence: selecting `SA设计 · IR需求渗透率` wrote `metric=1` and reduced the visible workspace to that activity/metric; switching to iteration wrote `dimension=iteration`, selecting version 2 and an iteration wrote `version=2&period=3`; switching back to time/week wrote `granularity=week&period=2026-W36` while preserving maturity `month=2026-08`. Team and company-average series remained in the metric chart. At 1440×900 and 1920×1080 the activity page had no horizontal overflow; at 390×844 the settled filter controls wrapped, the narrow navigation opener appeared, and there was no page overflow. Metric detail and team drilldown also had no overflow after layout stabilization at 1440/1920/390 widths.
- Mobile navigation was exercised at 390px: Escape closed the drawer, `destroyOnHidden` removed its modal node, and focus returned to the opener after the close transition. This fixes a real closed-dialog accessibility state found during browser QA.
- Boolean capability regression was rechecked after the snapshot distinction: selecting 自动化构建部署 at 1440px shows three teams as `具备`, one as `不具备`, coverage 4/4, and no trend/mean; an inline viewport screenshot captured the status list. This uses the latest valid snapshot because that workspace has no raw-data period selector.
- Viewport/full-page screenshots of overview, activity, capability, metric detail, and team drilldown were captured inline in the task for visual comparison; the long team page has top and downstream viewport captures plus layout measurements. No screenshot files were added to the repository. The native select popup's OS-owned appearance was not captured in this browser session, but its native ownership is explicit and selection/keyboard ArrowDown plus URL state were exercised; no authored popup geometry is promised.
- Phase 2 acceptance: PASS for the product-owned requirements. Native popup platform appearance and runtime emulation of reduced motion/true 200% browser zoom remain final verification boundaries; Phase 5 implements the reduced-motion rule and checks narrow-width reflow without claiming those emulations.

### Phase 3 and 4 progress

- IR requirements now use PageHeader, a compact filter toolbar, and a sticky primary table. Browser inspection at 1440×900 and 1920×1080 showed the toolbar, pending-batch state, Table, and empty state without page overflow.
- Phase 3 implementation plan: `frontend/src/dataManagement/DataManagementPage.jsx` will present the existing maturity month/team controls through the shared FilterToolbar, keep score/note entry in a compact activity table, and move the existing explicit save preview into a Drawer. Preserve copy-previous, confirmed save, double-confirm clear, role ownership, and existing APIs. `dataManagement.css` and `dataManagementRendering.test.jsx` will cover the responsive table and these existing workflow boundaries. AR/SR and issues/MR/code-review remain explicit pending-specification states; no fields, sample records, or CRUD behavior will be invented.
- Documentation Impact before implementation: UPDATE `DESIGN.md` and `UX-CONTRACT.md` to record the maturity batch-review Drawer pattern; Business Design was initially assessed NONE because the assessment rules are unchanged, then updated at final review because `docs/business/data-management.md` also records this maintenance flow. Architecture is NONE because API and ownership do not change. Standards and ADR are NONE because existing patterns and accepted decisions remain authoritative. UPDATE this Change Design with plan and evidence.
- System workspaces that already route through DataManagementPage inherit PageHeader. Users and collections now use it directly; collection native forms declare `noValidate`, and the login form has app-owned empty-credential feedback with ARIA association.
- Maturity maintenance now uses the shared compact scope toolbar and an activity table for score/note drafting; the monthly preview is a responsive Drawer, while copy-previous remains draft-only and clearing keeps its explicit second confirmation. Loading failures are shown as errors rather than an empty editable table. Tests cover the full draft→preview→save path, valid zero, previous-month copy, clear confirmation, and catalog failure.
- Phase 3 browser evidence: maturity workspace was inspected at 1440×900 and 1920×1080; table/client widths were measured with no page overflow. At 1024×768 there was no page overflow and columns remained within the table. At 390×844, the page stayed within the viewport while the 780px activity table scrolled internally; the preview Drawer measured 390px wide and fit the viewport. Escape closed the Drawer and focus returned to “预览保存” after the close transition. Desktop screenshots and the 390px table view were captured inline; the mobile Drawer was DOM/AX measured because screenshot capture timed out. No save or clear action was submitted in the live browser.
- AR/SR tabs and `/data/issues`, `/data/mr`, `/data/code-review` were browser-checked: each continues to state that its data-source specification is pending and exposes no invented field/table workflow.
- Phase 3 acceptance: PASS. The pending-source boundaries remain explicit; no backend/API/permission or maturity-calculation behavior changed. Frontend unit/render tests pass (43 Node + 72 Vitest), production build passes with the existing Ant Design/ECharts chunk-size warning, docs checks/tests and `git diff --check` pass, and the strict frontend-design-premium audit reports zero findings.

### Phase 4 — plan before implementation

- Live browser inspection of `/settings/teams` at 1440px found the master list's team-name header/cell measured only 40px, forcing names such as “团队A” onto multiple lines. Repeated team/member/product/version/user actions also need entity-specific accessible names.
- Responsive recheck at 390px after correcting the desktop ratio found the fixed 360px grid minimum forcing the single-column master/detail layout to 420px. The narrow breakpoint will use a shrinkable `minmax(0, 1fr)` track; browser acceptance must prove that the document stays within the viewport while table overflow remains local.
- `frontend/src/dataManagement/DataManagementPage.jsx`: set bounded widths for team/product master columns, keep their necessary horizontal overflow inside the list table, and add contextual accessible names to repeated team/member/product/version actions. `frontend/src/dataManagement/dataManagement.css`: rebalance the shared master/detail split to preserve a readable list pane at the 1440 baseline. `frontend/src/settings/UsersSettingsPage.jsx`: add the account identity to repeated edit/delete accessible names. Their rendering tests will protect widths, local scroll ownership, and names.
- Documentation Impact before implementation: Business Design, Architecture, Standards, ADR, `DESIGN.md`, and `UX-CONTRACT.md` are NONE; only visual layout and accessible names change, and the existing documented table-scroll/master-detail patterns already cover them. UPDATE this active Change Design with plan and evidence.
- The 1440px Team workspace now measures 433px / 661px master/detail; its team-name column is 104px and no longer wraps names into single-character lines. At 1920px the panes measure 599px / 913px; at 1024px they stack into one 950px column. At 390px the single-column grid and cards measure 332px, document scroll width equals the 380px layout width, and the team list's 374px table scrolls inside its 282px content region. The 390px edit Drawer measures 390px, Escape closes it, and focus returns to the matching edit button. No live mutation was submitted.
- User, team-member, product, and version repeated actions now include their entity name in the accessible label; the live user route confirmed those labels. User and collection routes were inspected at 1440px and 390px with no settled page-level overflow; at 390px the users table remains locally scrollable, and collection forms stack within the page. Collection configuration and run actions were not submitted.
- The live unknown route returned the app-owned 404 with localized document title and the authenticated shell intact. Existing route tests cover 403 destinations; a new App-level test covers login empty-field and 401 feedback association without contacting the live service.
- Phase 4 acceptance: PASS. Final frontend checks pass (43 Node + 73 Vitest; production build; docs check/test; strict UI audit with zero findings; `git diff --check`). Existing Ant Design/ECharts bundle-size warnings remain non-blocking.

### Phase 5 — final cleanup plan

- Verified `frontend/src/app.css` still contains only-referenced-by-CSS legacy settings grid/card/form/table rules, and `DataManagementPage.jsx` still defines an unused `CardHeading` helper plus unused styles. Remove those dead paths; let the current users page use the shared PageHeader typography instead of an older 24px page-title override. Replace the one warning-state literal in `design-system.css` with existing semantic warning tokens.
- Final accessibility review found `DESIGN.md` promises reduced-motion support, while the shared stylesheet only disabled smooth scrolling and a few shell transitions. Extend the existing global reduced-motion rule to collapse CSS animation/transition durations; retain the shell's explicit no-transform override. This uses the existing design contract and introduces no new product or token decision.
- A 1920px collection-settings browser measurement found 1536px-wide Cards containing 760px-wide forms. Bound and center this configuration page at 1120px so the panel stops claiming unused width; leave its existing per-form widths and collection controls unchanged.
- Documentation Impact before implementation: UPDATE `DESIGN.md` to state the bounded system-configuration content width; Business Design, Architecture, Standards, ADR, and `UX-CONTRACT.md` are NONE because no business/API/interaction contract changes. The dead-style removal, shared PageHeader, semantic warning token, and reduced-motion coverage follow already documented patterns. UPDATE this Change Design with results.

### Phase 5 — verification and acceptance

- Removed the unused settings grid/card/form/table CSS, unused `CardHeading` and styles, and stale users-page title overrides; the user page now uses the shared 28px PageHeader. Partial-data warning styling now consumes semantic warning tokens. System configuration content is centered and capped at 1120px, with the two input forms remaining at 760px.
- The global reduced-motion rule now collapses CSS animation/transition durations and disables smooth scrolling; the existing shell rule still prevents the sidebar-toggle transform. ECharts already disables chart animation through `matchMedia('(prefers-reduced-motion: reduce)')`.
- Browser acceptance: Team master/detail was measured at 1440, 1920, 1024, and 390px; at 390, the document stayed at 380px while the 374px list table scrolled locally. Team edit Drawer fit the 390px viewport; Escape closed it and focus returned to its opener. Users and collection settings had no settled page overflow at 1440/390; collection cards now cap at 1120px at 1920 and forms remain 760px. A 720×450 viewport reflow check (similar CSS width to 200% zoom at 1440) also stayed within the document width. The live 404 retained the app shell and localized title; login and 403 behavior are covered by route/render tests. The collection cadence native select changed by ArrowDown in the live browser and the page was reloaded without saving.
- Final checks: `npm --prefix frontend run test:unit` passed 43 Node and 73 Vitest tests; `npm --prefix frontend run build` passed with the existing >500kB Ant Design/ECharts warnings; `npm run check:docs`, `npm run test:docs`, and `git diff --check` passed; strict `audit_project.py --mode strict` reports 0 findings.
- Remaining verification boundary: the browser integration exposes viewport sizing but not `prefers-reduced-motion` emulation or true 200% browser zoom; the reduced-motion CSS and ECharts matchMedia branches were source-checked, and 720×450 reflow was browser-checked. The native select popup's OS-owned appearance was not captured; keyboard selection was verified and no authored popup geometry is claimed. No data mutation was submitted during browser QA.
- Phase 5 acceptance: PASS for the implemented product-owned behavior. Business/current-state docs, DESIGN/UX contracts, navigation, and this Change Design are synchronized; no API/data/permission change occurred. ADR and Standards remain NONE. Move this Change Design to `docs/changes/completed/` and update both directory indexes.


### Phase 5 progress

- `analytics.css` no longer contains literal color values; it consumes semantic surface, text, border, feedback, and data-color tokens from `tokens.css`.
- App-owned login, collections, user, and data-management forms now declare `noValidate` while retaining their existing component validation. App assigns a route-specific `document.title`.
- Browser verification confirmed `研发活动 | ai-dev-radar`, semantic white analytical panel surface, and no page-level overflow. The latest strict static audit now reports zero findings after recording native control ownership and making test mocks accurately reflect their canonical field constraints; no findings were waived through audit configuration.
- At 390×844, the analytical page replaced the persistent sidebar with the labelled navigation opener, kept the filter toolbar to 332px, and had no page-level horizontal overflow. The temporary viewport override was reset after inspection.
- Deleted the unreferenced legacy `frontend/src/overview/overview.css`. Team drilldown was migrated from its historical `--overview-*` variables to semantic tokens, and the still-used metric-detail TrendCard styles were rehomed in `analytics.css`. Browser verification confirmed both drilldown and metric detail use a white semantic surface, default border, expected padding, and no page overflow.

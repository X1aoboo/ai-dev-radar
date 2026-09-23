# Data Workbench Operational Console UX

## Status
Completed

## Background

Phase 1 Design Foundation and Phase 2 Analytics are complete. Phase 3 is limited to the data workbench and its reusable operational patterns. The existing Design System already defines an Operational Console, semantic tokens, a 1600px operational content container, shared `PageHeader` and `FilterToolbar`, and compact stable feedback states. This change applies those decisions to the current workbench; it does not introduce a parallel visual system.

The pre-change browser check used the running local app and its existing database. At 1440×900 the document had no horizontal overflow (`clientWidth` and `scrollWidth` were both 1430px); the database had no IR records or pending collector batches. The empty collector table still occupied an approximately 290px card. The requirement tabs, Topbar breadcrumb, and `数据管理 / IR` header eyebrow repeated the same context. The filter toolbar contained a nested Collapse and remained tall while advanced filters were closed. The formal table scrolled locally, as intended.

At 1920×1080 the IR page also had no document overflow. The operational content measured 1600px wide and the main table 1536px wide, using nearly all space available after the sidebar. The operational container therefore remains unchanged.

The code explains the remaining baseline issues:

- `IRManagement` always renders a Card and Table for pending collector batches, even when the list is empty.
- `IRManagement` nests Ant Design `Collapse` in the shared filter toolbar and does not expose an active advanced-filter count.
- `PageIntro` receives repeated navigation eyebrows on IR and maturity pages; pending AR/SR and other domains use large `Result` treatments instead of the page-header pattern.
- `DataManagementPage` returns only a centered loader while reference data is loading, temporarily removing the operational page structure.
- `ReadOnlyHint` is a full-width Alert on IR. The maintainer's IR/maturity team selectors are locked without explaining why; the viewer maturity summary uses two separate Cards.
- `dataManagement.css` holds broad workbench table rules alongside page layout rules, while `design-system.css` owns the shared visual patterns.

Browser role checks confirmed the existing access model: admin can edit globally; `maintainer.团队A` retains IR write controls while its team filter and maturity team selector are locked to 团队A; viewer has no IR write controls and sees maturity summaries only. No API permission boundary is changed.

## Requirement

- Apply the Operational Console hierarchy to IR, maturity editing/viewing, AR/SR pending states, and issue/MR/code-review pending routes.
- Keep Analytics and full system-management redesign out of scope.
- Reuse `tokens.css`, `design-system.css`, `theme.js`, `PageHeader`, `FilterToolbar`, Ant Design Form/Table/Drawer, and existing route/API behavior.
- Preserve IR filters and automatic query behavior, pagination, edit workflow, staged import and collector review, permissions/team scope, and all maturity draft/confirmation semantics.
- Do not add fields, schemas, metrics, API behavior, or placeholder business capabilities.
- Verify real browser behavior at 1440×900 and 1920×1080, including the role states and staged workflows; run the repository-required checks.

## Current Behavior

Current business and API behavior is documented in [Data Management](../../business/data-management.md) and [Data Management Module](../../architecture/modules/data-management.md). IR is the only implemented source workspace. AR/SR remain requirement subtypes; issues, MR, and code review remain pending domains. File and collector batches remain staged until valid rows are explicitly confirmed. Maturity remains a separate monthly human assessment where blank is not evaluated and 0 is valid.

## Target Behavior

- Every operational route uses the shared content `PageHeader`, with the Topbar breadcrumb supplying navigation context and at most one primary action.
- IR filters keep common controls visible, place advanced filters in a light expanded region, identify active advanced filters, wrap at narrower widths, and retain automatic querying and lightweight reset behavior.
- An empty collector-batch list takes no large workspace; existing batches appear in a compact list/table and open the shared staged-review Drawer with source, team, time, row counts, validation, and the unchanged explicit-confirm rule.
- Formal IR data is the primary workspace surface. Its table preserves every existing business column, fixed identifier/action columns, sticky header, compact density, local horizontal scrolling, empty state, and pagination.
- IR create/edit keeps its Drawer context, groups fields by existing business meaning, keeps a sticky action footer, and preserves validation and busy behavior.
- Maturity remains a monthly editing table with draft-only copy-previous, an explicit whole-month preview Drawer, separate clear confirmation, blank-versus-zero semantics, and role-scoped teams. The maintainer's locked team scope is explained inline. The viewer gets compact read-only sections and tables.
- Pending domains use a compact state under a domain `PageHeader`; existing meaningful navigation back to IR remains available where already present. No unsupported fields or actions are introduced.
- Loading keeps the header and stable filter context visible on IR and maturity while their workspace loads. Error states remain associated with the affected domain/action.
- Shared table, status, spacing, and empty-state rules live in the existing Design System and use existing semantic tokens. Page CSS retains business-specific layout only.
- The page remains free of document-level horizontal overflow at 1440px and 1920px; any necessary table overflow stays inside its own table.

## Design

- Update `frontend/src/dataManagement/DataManagementPage.jsx` for IR filters, compact pending batches, IR workspace and Drawer grouping, maturity role context, read-only tables, pending AR/SR, and stable page loading.
- Update `frontend/src/App.jsx` so issue/MR/code-review pending routes use the same compact pending-state pattern without changing route names or actions.
- Add the reusable operational table/status/pending-state styling to `frontend/src/design/design-system.css`, using existing tokens. Extend `frontend/src/components/FilterToolbar.jsx` only as needed to support the operational filter layout without changing Analytics defaults.
- Keep `frontend/src/dataManagement/dataManagement.css` for page-specific workbench, maturity layout, and out-of-scope settings layout; remove only legacy rules replaced by shared patterns.
- Update the existing data-management and route rendering tests for changed layout expectations while retaining all business behavior assertions.
- Do not modify Analytics pages, backend/API code, collection settings, user settings, route metadata, or database models.

## Business Impact

Presentation and interaction hierarchy only. Roles, backend authorization, maintainer team scope, requirement subtypes, source records, data validation, pagination/filter semantics, staged batch lifecycle, audit behavior, and maturity values remain unchanged.

## Architecture Impact

No service/module boundary changes. The existing frontend route owns operational presentation; the shared Design System owns reusable styling. Filter and drawer state remain route-local and API calls retain their existing contracts.

## API / Contract Changes

NONE — preserve all current request paths, query parameters, payloads, responses, and confirmation requirements.

## Data Changes

NONE — no schema, migration, or persisted-data changes.

## Compatibility

Preserve canonical routes and requirement-tab navigation, legacy redirects, filter state and server pagination, explicit PATCH edits, upload preview/validation/confirm stages, collector ownership, all role gates, and maturity monthly copy/preview/save/clear behavior. Analytics is unchanged. Keep the current 1600px operational container because the measured 1920px layout already uses nearly the full post-sidebar width.

## Error & Boundary Handling

Keep loading structure stable for IR and maturity. Empty batches must not resemble an error or consume a large surface. Import/collector invalid rows continue to block whole-batch confirmation and show row-level errors/warnings. Server failures remain visible in the owning route and do not clear the user's draft or selected context. Pending domains state that specifications are undefined without suggesting nonexistent capability.

## Risks & Trade-offs

- Shared table rules must not change Analytics or expand this phase into a full settings redesign.
- Compact density must keep two-line identifying metadata scannable and preserve all current columns.
- The current development database has no IR or pending collector fixture; browser workflow checks that require data must use an isolated disposable local database and must not seed or mutate the user's existing database.
- The private Gateway is not configured for real collection; collector staging must be verified using the existing local/test boundary, not claimed as a live Gateway integration.

## Test Strategy

- `npm --prefix frontend run test:unit`
- `npm --prefix frontend run build`
- `npm run check:docs`, `npm run test:docs`, and `git diff --check`
- Real browser at 1440×900 and 1920×1080 for IR, maturity, AR/SR, issues, MR, and code review. Check document/table overflow, filter expansion/reset, table sticky/fixed behavior, drawer sizing/footer/focus, stable loading, empty/error states, and focus visibility.
- Verify admin, maintainer, and viewer read/write/team scope; use a disposable local dataset to exercise IR create/edit, valid/invalid import preview, pending collector review, maturity copy-previous and preview. Do not make writes to the existing development database.
- Recheck existing rendering/logic assertions for filters, pagination, permissions, staged confirmation, blank-versus-zero, copy-previous, preview, and clear confirmation.

## Documentation Impact

- Business Design: UPDATE `docs/business/data-management.md` to describe the final operational layout, compact pending domains, batch review presentation, and role-visible states without changing business rules.
- Architecture: UPDATE `docs/architecture/modules/data-management.md` to describe shared frontend pattern ownership, stable loading, and the IR/maturity workspaces; API and module boundaries remain unchanged.
- Standards: NONE — existing React, Ant Design, accessibility, and test conventions remain sufficient.
- ADR: NONE — this presentation change does not change accepted data, permission, gateway, or route decisions (ADR-0004, ADR-0006, ADR-0007, ADR-0009).
- Design/UX Contract: UPDATE `DESIGN.md` and `UX-CONTRACT.md` to state the operational table/filter/drawer/batch/status/empty/density rules now implemented.
- Change Design: CREATE this record before code; implementation and verification are complete, so this record is finalized and moved to `docs/changes/completed/` with both change indexes updated.

## Validation

### Automated

- Passed `npm --prefix frontend run test:unit`: 44 Node tests and 81 Vitest route/render tests.
- Passed `npm --prefix frontend run build`; Vite retains its existing >500 kB Ant Design/ECharts chunk warnings.
- Passed `npm test`: 119 backend tests. The first collection attempt found `jsonschema` missing from `.venv`; installed the already-declared `jsonschema>=4.23` locally, then reran successfully. Pytest also reported a non-fatal `.pytest_cache` permission warning and existing Starlette/httpx deprecation warnings.
- Passed `npm run check:docs`, `npm run test:docs`, and `git diff --check`.

### Real Browser

- Used the built FastAPI-served application at `localhost:8001` with a unique SQLite database under the OS temp directory. The original development database was not written.
- At 1440×900, the document had no horizontal overflow; the main content was 1182px wide and the IR table used a local 1116px viewport for its 1500px table. At 1920×1080, the main content was 1600px wide and the table used 1534px. Populated IR row heights measured 48px at both widths.
- At 1024×900, common filters wrapped into three readable rows; the 1500px table scrolled locally inside its 700px viewport and the document remained overflow-free. At 390×844, controls wrapped, the table remained locally scrollable, and the 390px create Drawer kept its footer visible; document width remained 390px or less.
- IR create and edit succeeded in the temp database. A valid CSV preview showed one valid row and was explicitly confirmed; an invalid CSV showed row 2's missing-scenario error and kept whole-batch confirmation disabled. The collector review showed source, team, generated time, total/valid/invalid rows, row validation, staged status and an enabled confirm action. The staged collector fixture was produced through the existing `create_ir_import_batch` validator and left pending.
- Maturity teamA's August value 3.25 and note were previewed and saved in the temp database. Copying into September changed only the draft; the preview showed the copied value and note without saving September. Viewer then saw the August value in two read-only tables, with no Cards or edit actions.
- Admin, `maintainer.团队A`, and viewer access were checked. Maintainer team selectors were disabled with an explanation while IR write actions remained available; viewer had a compact read-only status and no write actions.
- AR, SR, issues, MR, and code-review pending pages showed compact states with no Ant Design `Result` panel or horizontal overflow at 1440px and 1920px. After removing the staged test batch and IR rows from the temp database, the browser showed no collector section and one empty row inside the formal IR table.
- Page scrolling measured a maturity table header at 56px while the page was scrolled, aligned with the fixed 56px Topbar. Closing the create Drawer restored focus to the opener; a visible focus ring appeared on keyboard navigation.

### Unverified Boundaries

- The private AI Engineering Data Gateway was not configured; no live platform collection was claimed. Collector review used an isolated pending batch validated through the existing batch-creation function.
- The pre-existing `localhost:8000` development API stopped responding during the run. All state-changing browser checks used the isolated app/database; the original development database remained untouched.
- `prefers-reduced-motion` was not actively emulated. This change adds no motion behavior and retains the existing shared reduced-motion rule.

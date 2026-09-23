# UX Contract

## Product context

- Audience: R&D managers, domain owners, team leaders, and supporting data/system administrators.
- Primary jobs: assess verified team-level AI engineering facts and maturity; maintain source data and configuration efficiently.
- Target market(s): not currently asserted by maintained product evidence.
- Active locales: Simplified Chinese UI; terminology source is `CONTEXT.md`.
- Language/content register and native-review policy: concise domain-defined Chinese; new concepts require a `CONTEXT.md` decision.
- Timezone/calendar policy: Asia/Shanghai natural date/week/month behavior, documented in `docs/business/analytics.md`.
- Accessibility target: WCAG 2.2 AA.

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Permission model | `docs/business/data-management.md` | Business design | 2026-09-24 |
| Gateway configuration and readiness | `docs/business/data-management.md`, ADR-0010, Gateway management API | Business design / ADR / API | 2026-09-24 |
| Analytics and maturity semantics | `docs/business/analytics.md`, ADR-0006 | Business design / ADR | 2026-09-23 |
| Source-data lifecycle | `docs/business/data-management.md`, ADR-0003/0004 | Business design / ADR | 2026-09-24 |
| Data-management IA | ADR-0007 | ADR | 2026-09-24 |
| Market/content conventions | `CONTEXT.md` | Terminology source | 2026-09-23 |

## Visual contract

- Project `DESIGN.md`: [DESIGN.md](DESIGN.md)
- Token ownership model: existing runtime canonical.
- Runtime design-system/token source: `frontend/src/design/tokens.css`.
- Mapping/export/adapters: `frontend/src/design/theme.js` resolves semantic CSS tokens for Ant Design; `frontend/src/charts/chartTheme.js` resolves the same data-viz tokens for ECharts; `frontend/src/app.css` contains temporary compatibility aliases.
- Token drift gate: review each semantic token change in `DESIGN.md`, `tokens.css`, and `theme.js`; search changed UI code for new literal colors.
- Audit manifest: `premium-ui.json` declares this product-admin source root, `zh-CN`, and the established native Select/Listbox and Date ownership used by existing route controls.
- Supported themes: Light mode is shipped; semantic tokens reserve a dark-mode remapping seam.
- Design-context owner/review policy: follow `docs/agents/design-maintenance.md` and the active UI rebuild Change Design.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Ant Design Select or existing native select | Route component + business behavior | authored / native | keyboard and open-popup browser check |
| Date | Existing native date input | Route component + Asia/Shanghai semantics | native | keyboard and browser check |
| Form | Ant Design Form | Existing data-management/settings flows | create / edit | rendering and browser validation |
| Operational filter | Shared `FilterToolbar` + Design System classes | Route-local data-workbench state | common controls plus light advanced filters | wrap, active count, reset, query behavior |
| Operational table/status | `.operational-table` and semantic status classes | `frontend/src/design/design-system.css` | data-workbench table/empty/loading states | density, sticky/fixed cells, local scroll, no page overflow |
| Batch review | `ImportPreviewDrawer` | Existing import/collector batch APIs | file import / staged collector | source context, valid/invalid/warning rows, explicit confirm |
| Scrollbar | `frontend/src/design/design-system.css` | `DESIGN.md` | documented local geometry exceptions | computed style and overflow check |
| Toast | Ant Design `App` feedback provider | Existing app ownership | success / warning / info / error | route-level workflow check |
| Global status | `frontend/src/components/StatusPage.jsx` | This UX contract | forbidden / not-found / pending / error | accessible title, description, action, shared layout |
| Content loading | `ContentLoadingState` in `StatusPage.jsx` | This UX contract | route / page content | stable geometry, status announcement, authenticated shell retained |
| Settings workspace | `.settings-master-detail`, `.settings-workspace`, `.settings-section` | `frontend/src/design/design-system.css` | master/detail / table-first sections | relationship scan, selected state, responsive stacking |
| Collection run history | expandable `Table` in `CollectionsSettingsPage.jsx` | `/api/collection-schedules` response | compact team outcome detail | status/message/code/retryable text, no invented retry action |
| CRUD | Existing route/API behavior | `docs/business/data-management.md` | return / stay according to sibling flow | full relevant route regression |
| Gateway configuration | `/settings/gateway` and `/api/gateway` | `docs/business/data-management.md`, ADR-0010 | one Active plus one Draft; live readiness required at activation | browser Draft/check/activate and failure recovery |
| Maturity batch review | `/data/maturity` | monthly draft table + explicit preview Drawer | copy previous month, confirm whole-month save, separately confirm clear | draft/preview/save and role-aware route checks |

## Component behavior

| Component | Default | Hover | Focus | Active | Disabled | Busy | Error |
|---|---|---|---|---|---|---|---|
| Button | Ant Design semantic emphasis | visible | 2px outline | visible | non-interactive | fixed geometry | inline/Alert feedback |
| Icon button | 40px shell target | subtle surface | 2px outline | visible | non-interactive | n/a | n/a |
| Input | existing Ant Design/native field | library state | visible outline | n/a | existing semantics | submit guarded | associated Form error |
| Table/list | compact operational surface | row action affordance | native/AntD focus | selection when supported | n/a | stable loading region | inline Alert/state |

## Dataset navigation

- Admin tables: existing domain APIs define pagination; preserve filters and page behavior per route.
- Exploratory lists: no generic list owner; do not introduce infinite scroll.
- URL state: analytical filters are URL-backed; data-management state remains route-local until its existing API contract requires URL persistence.
- Activity analytics URL state includes `month`, `dimension`, `granularity`, `version`, `period`, and selected `metric`. `month` anchors the time window and independently selects the maturity assessment month; the selected raw-data period controls the same-metric facts shown and trend focus. Selecting all periods shows the full trend without a single-period snapshot. The API request retains its existing `dim`, `gran`, and optional `version_id` contract.
- `重置统计条件` restores time/month dimension, all metrics, and the latest available period without changing the independent maturity month. Dimension, granularity, version, period, and metric remain URL-backed.
- Boolean capability current state uses the latest valid snapshot when no single-period filter is exposed. A route with an explicit selected period uses that period's value and preserves a missing point as unknown; it must not fall back to another period's snapshot or create a 0/1 trend.
- Metric facts use the `company_average` arithmetic mean as the “全公司均值” comparison series. Quantitative detail displays that mean separately from `domain_summary` (merged raw values and recomputed result); the two are not interchangeable. Maturity assessment aggregates retain the distinct “领域平均” label.
- Empty/no-results/error/loading treatment: compact stable feedback state; no fabricated zero, result, or data count.

## Navigation and responsive behavior

- Route document title policy: `App.jsx` sets a localized route title from route metadata with the `ai-dev-radar` product suffix; loading and not-found behavior must not leave an unrelated page title.
- Route error / 403 page behavior: shared `StatusPage` explains access denial or not-found and returns to the overview where appropriate. Pending capabilities use the same compact status grammar with neutral copy.
- Breadcrumb/tab/route-state policy: Breadcrumb in Topbar; page title/action in content; data source root IA remains unchanged.
- Analytics scroll ownership: the browser document is the vertical scroll owner. Main content may clip horizontal spill only; it must not establish an unused vertical scroll ancestor that breaks sticky section navigation. Activities and Team Drilldown directories are sticky section navigation with a visible current item; their anchors do not create nested scrollers.
- Activities: `/analytics/activities` has one anchor for each of the eight current key activities. Each section is flat, maturity is compact, and metric cards use a compact empty state when no history exists. Time trends use lines for rate, efficiency, and count metrics; selected-period comparisons remain within one metric.
- Capability analysis: `/analytics/capabilities` presents a fluid structure directory with one selected capability; its Current State and Evolution region keeps each metric's unit independent and renders booleans as team status, never as a 0/1 line.
- Executive lifecycle: stage labels organize individually named catalog metrics; values and trends remain per metric and no stage score or cross-unit comparison is produced.
- Executive snapshot: maturity stays a separate assessment source; fact cards show current value, six-month same-metric trend when available, and the team's range for that same metric. The selectable overview trend plots only the selected metric's domain-average series and sits beside a separate single-metric ranking before maturity content. Signal follows the supporting analysis.
- Team Drilldown KPI: each tile refers to one existing catalog metric or one boolean status, with that same metric's value, delta, and sparkline. Never average different catalog metrics into a synthetic penetration/efficiency KPI.
- Metric Detail: Result → Comparison → Evidence keeps one-metric team distribution/ranking distinct from the trend; raw current-period facts remain on-demand. Selecting all periods shows the full trend and asks for a single period before claiming a current result or current-period evidence.
- Sidebar/drawer transformation: 248px expanded / 64px collapsed desktop sidebar, 280px drawer at <=680px, with preserved focus restoration and local desktop preference.
- `/settings/gateway` is admin-only in navigation and routing. `/settings/collections` shows a read-only Gateway status summary and links to that page.
- Responsive table strategy: local horizontal scrolling only when needed; no page-level horizontal overflow.

## Operational workbench

- Page hierarchy: content `PageHeader` → only necessary status/context → `FilterToolbar` → primary workspace → Drawer/review flow. The Topbar Breadcrumb owns route context; avoid repeating it as a page eyebrow. Use at most one visually primary action. Show read-only state compactly in the header.
- Filters: keep common filters visible; expand advanced filters as a light region with an active-filter count. Reset remains low emphasis. Preserve current route-local filter state, automatic-query timing, dependent-filter clearing and server pagination.
- Tables: `frontend/src/design/design-system.css` owns `.operational-table`, status tags, density and stable empty states. Header height is about 42px, row height 48px, horizontal cell padding 12px; secondary metadata is 12–13px and one line with full text available on hover. Keep numeric values tabular/right-aligned, dates consistent, identifiers/actions fixed where useful, sticky headers offset below the 56px Topbar, row selection/hover, compact pagination and body-contained horizontal scrolling. The page itself must not overflow horizontally.
- IR and staged data: formal IR is the primary workspace surface, not a Card nested inside another page surface. Hide an empty pending collector section; render existing batches compactly. Import/collector review identifies source, file/team, generated time, total/valid/invalid/warning counts, row-level differences/errors and the unchanged explicit whole-batch confirmation boundary. Invalid rows disable confirmation.
- Drawers: create/edit keeps list context, groups existing fields by business meaning, uses a stable footer, preserves validation and submission loading, and does not change API payloads.
- Role scope: the maintainer's IR and maturity team filters stay locked to the bound team and state why. Admin can choose the supported team scope; viewer receives no write controls.
- Maturity: edit monthly drafts in the activity table. Blank is not evaluated and zero is valid. Copy-previous changes only the draft, preview reviews the month before save, and clear remains separately confirmed. Viewer uses compact read-only sections/tables, not a dashboard.
- Pending domains and resilience: AR/SR, issues, MR and code review show a compact pending state; no schema, fields or actions are invented. Loading retains PageHeader/filter context when available. Errors stay in the owning domain. Empty/No Data never masquerades as zero or a fabricated count.

## System Management

- Shared page order: PageHeader → necessary scope/status → primary workspace → Drawer or detail panel. Breadcrumb owns route context; do not repeat the path as an eyebrow. Keep one visually primary page action at most.
- Teams use a compact master list with selected-team detail and a member table. Member counts are shown only where the current API response provides a complete scope; a maintainer does not see a false zero for other teams.
- Products preserve Team → Product → Version → Iteration ownership. Show versions and their iterations in the selected product detail; do not add a separate tree editor.
- Metric definitions retain two distinct tabs: dashboard activity/metric catalog and source-data rule/result query. Selecting an activity scopes its metric table. The compute result is a configuration check showing value, numerator, denominator, and valid-record count; it is not a dashboard KPI.
- Collection settings separate current status, scheduled configuration, manual run, and run history. The default manual request omits a custom time window and uses the existing previous-complete-period behavior. Custom time inputs are disclosed on demand and preserve the `[start_at, end_at)` Asia/Shanghai contract. Run history is a table with expandable team results, localized known failure messages/code, and `可重试` text only when the API says so. Do not add a retry action without a retry API.
- User and permission management uses the table as its main surface. Role labels keep Chinese meaning and English code at subdued emphasis. Mark the signed-in account and retain the backend-protected self-delete behavior. Maintainer team binding remains required when selecting that role; username/password remain uneditable on the existing edit API.
- Create/edit remains in the existing Drawer flow. Destructive confirmations identify the object and existing constraint; successful hard deletion is described as unrecoverable. Preserve API methods, payloads, navigation, and error recovery.

## Authentication and session

- Login remains a single-column credentials form. Username and password have visible labels, `username` / `current-password` autocomplete, keyboard submit, app-owned validation, associated inline error text, and visible focus. A failed credential clears the password while retaining the account name.
- A 401 during an authenticated request sets “会话已过期，请重新登录。” and preserves path, query, and hash. After successful login, return to that path. Do not add token refresh or retry loops.
- Login, logout, bootstrap, and route access keep the existing backend session and role model. UI visibility is not the authorization boundary.

## Global status and loading

- `StatusPage` is the shared treatment for 403, 404, pending capability, and fatal load errors. Every state has a text label, title, concise explanation, and relevant action. Error uses `role="alert"`; pending uses a neutral `role="status"`. No state relies on color alone. Error text on subtle danger surfaces uses `--color-danger-foreground` rather than the chart/status indicator color.
- A 403 says the current account cannot access the page and offers the overview. A 404 says the page is missing or the link is invalid. Pending states say the data specification is not defined and do not imply a working form or dataset.
- Initial auth bootstrap stays outside the authenticated shell. Lazy route loading happens inside App Shell content, retaining sidebar, Breadcrumb, and user context. Page content loading uses a stable `ContentLoadingState`; mutations keep loading on their button.
- Fatal request copy is safe and actionable; do not expose raw authentication or infrastructure details. Provide retry where reloading the owning data is safe.

## App Shell and responsive fallback

- Keep 248px expanded / 64px collapsed desktop navigation, the existing 680px drawer breakpoint, and a 56px Topbar. Desktop collapse preference and route/role behavior remain unchanged. Sidebar toggle exposes `aria-expanded`; the mobile opener controls the navigation while open and focus returns after close.
- Topbar contains Breadcrumb, username, one localized role label, and a quiet logout action. It does not repeat the page title.
- System management uses Operational width policy; form-oriented collection settings cap at 1120px. At 768–1100px, master/detail stacks vertically. Below 720px, controls wrap, settings summaries reduce columns, and tables use local horizontal scrolling when their columns need it.
- Responsive fallback must preserve every action, role, status, object relationship, and full value access. Check 1440×900, 1920×1080, 1024×768, and 390×844 with no page-level horizontal overflow.

## Accessibility rules

- Native buttons/links own actions/navigation; selection controls have visible focus and accessible names. Icon-only actions identify their object and action. Tables keep headings and local overflow.
- Inputs have visible labels, submit-time validation, `aria-invalid` and associated error text when invalid. Password managers and paste remain available. Busy controls prevent duplicate submit without moving layout.
- Status includes text, not color alone. Drawers and confirmation overlays preserve keyboard dismissal and focus return. Sidebar controls expose their expanded/controlled relationship. Loading is announced as status; errors use alert semantics.
- Verify keyboard navigation, focus visibility, form labels, icon/action names, contrast, disabled state, Drawer focus return, and keyboard-usable confirmations in the real browser. Normal-size error text must meet 4.5:1 contrast on its background.

## Overlays and feedback

- Dialog primitive: Ant Design Drawer/Modal only; no browser dialogs.
- Destructive confirmation levels: retain existing domain flows; new destructive operation requires domain-specific confirmation design.
- Toast placement/duration/deduplication: Ant Design App provider is canonical; a toast never replaces an inline correction/error.
- Gateway configuration uses a server-confirmed Draft save, masked Token input, and a right-side edit Drawer. The Token is never prefilled; an empty field reuses the current Active Token when one exists, and first configuration requires entry. Failed checks keep Active usable; activation performs a new readiness check. Stale status shows its last known result, and the audit list exposes actor, action, outcome, and Beijing time without Token values.
- Unsaved-changes behavior: not globally implemented; do not claim coverage without route-level behavior.
- Maturity maintenance keeps the existing monthly batch boundary: edit activity scores/notes in the table, review every draft value in a Drawer, then confirm one month save. Blank means not evaluated and 0 remains valid; copy-previous changes only the draft, while clear remains a separately confirmed action.

## Async and resilience

- Mutation default: existing route behavior is pessimistic and prevents duplicate submit via local submitting state.
- Session expiry/re-authentication: `App.jsx` returns to login and preserves the current path.
- Stale-request cancellation/invalidation: current analytics effects use mounted guards; later migrations must retain equivalent stale-response protection.
- Failure recovery: load errors stay in the owning route and retain the current navigation context.

## Validation

- Required static commands: `npm --prefix frontend run test:unit`, `npm --prefix frontend run build`, `npm run check:docs`, `npm run test:docs`, `git diff --check`.
- Browser/device matrix: each changed phase checks 1440px and 1920px; interaction-heavy routes also check 1024px/390px, focus, reduced motion, loading, empty/error, and no page-level overflow.
- Canonical sibling flow: preserve the established AppShell, analytical URL filters, and data-management drawers unless an active Change Design records an intentional variant.

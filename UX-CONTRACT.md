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
| Permission model | `docs/business/data-management.md` | Business design | 2026-09-23 |
| Analytics and maturity semantics | `docs/business/analytics.md`, ADR-0006 | Business design / ADR | 2026-09-23 |
| Source-data lifecycle | `docs/business/data-management.md`, ADR-0003/0004 | Business design / ADR | 2026-09-23 |
| Data-management IA | ADR-0007 | ADR | 2026-09-23 |
| Market/content conventions | `CONTEXT.md` | Terminology source | 2026-09-23 |

## Visual contract

- Project `DESIGN.md`: [DESIGN.md](DESIGN.md)
- Token ownership model: existing runtime canonical.
- Runtime design-system/token source: `frontend/src/design/tokens.css`.
- Mapping/export/adapters: `frontend/src/design/theme.js` adapts semantic tokens for Ant Design; `frontend/src/app.css` contains temporary compatibility aliases.
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
| Scrollbar | `frontend/src/design/design-system.css` | `DESIGN.md` | documented local geometry exceptions | computed style and overflow check |
| Toast | Ant Design `App` feedback provider | Existing app ownership | success / warning / info / error | route-level workflow check |
| CRUD | Existing route/API behavior | `docs/business/data-management.md` | return / stay according to sibling flow | full relevant route regression |
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
- Boolean capability current state uses the latest valid snapshot when no single-period filter is exposed. A route with an explicit selected period uses that period's value and preserves a missing point as unknown; it must not fall back to another period's snapshot or create a 0/1 trend.
- Metric facts use the `company_average` arithmetic mean as the “全公司均值” comparison series. Quantitative detail displays that mean separately from `domain_summary` (merged raw values and recomputed result); the two are not interchangeable. Maturity assessment aggregates retain the distinct “领域平均” label.
- Empty/no-results/error/loading treatment: compact stable feedback state; no fabricated zero, result, or data count.

## Navigation and responsive behavior

- Route document title policy: currently not implemented; no visual refactor may imply that it is.
- Route error / 403 page behavior: existing `Result` pages return users to overview where appropriate.
- Breadcrumb/tab/route-state policy: Breadcrumb in Topbar; page title/action in content; data source root IA remains unchanged.
- Capability analysis: `/analytics/capabilities` presents a structure directory with one selected capability; its Current State and Evolution region keeps each metric's unit independent and renders booleans as team status, never as a 0/1 line.
- Executive lifecycle: stage labels organize individually named catalog metrics; values and trends remain per metric and no stage score or cross-unit comparison is produced.
- Executive snapshot: maturity stays a separate assessment source; fact cards show current value, six-month same-metric trend when available, and the team's range for that same metric. The selectable overview trend plots only the selected metric's domain-average series; team distribution uses a separate single-metric ranking.
- Sidebar/drawer transformation: 248px expanded / 64px collapsed desktop sidebar, 280px drawer at <=680px, with preserved focus restoration and local desktop preference.
- Responsive table strategy: local horizontal scrolling only when needed; no page-level horizontal overflow.

## Overlays and feedback

- Dialog primitive: Ant Design Drawer/Modal only; no browser dialogs.
- Destructive confirmation levels: retain existing domain flows; new destructive operation requires domain-specific confirmation design.
- Toast placement/duration/deduplication: Ant Design App provider is canonical; a toast never replaces an inline correction/error.
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

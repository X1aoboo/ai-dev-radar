---
version: 1
name: "ai-dev-radar"
description: "A restrained light-mode enterprise analytics system for evidence-led AI engineering management."
colors:
  page: "#f7f8fa"
  surface: "#ffffff"
  text-primary: "#182230"
  text-secondary: "#475467"
  border: "#e4e7ec"
  primary: "#155eef"
  success: "#039855"
  warning: "#dc6803"
  danger: "#d92d20"
  danger-foreground: "#b42318"
typography:
  sans:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei, sans-serif"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  app-shell: { }
  page-header: { }
  filter-toolbar: { }
  metric-card: { }
  analytics-panel: { }
  chart: { }
  settings-workspace: { }
  status-page: { }
  content-loading: { }
---

# ai-dev-radar Design System

## Overview

### Creative North Star

The product should feel like a concise management review assembled from an engineering evidence book: calm working surfaces, deliberate typography, and data that speaks before ornament. Its signature is the evidence-led reading order—context, decision signal, supporting fact, then drill-down—not decorative dashboard chrome.

### Product context and register

- **Audience and primary job:** R&D managers, domain owners, and team leaders assess verified AI engineering facts, maturity, variance, and operational data work.
- **Target market(s) and evidence:** No market-specific claim is maintained. The Chinese product language is grounded in [CONTEXT.md](CONTEXT.md) and the business design under [docs/business](docs/business/index.md).
- **Locale(s) and language policy:** Current product copy is Simplified Chinese with an English product name. New labels use concise, domain-defined Chinese; no Japanese-market behavior is inferred.
- **Usage scene:** Desktop-first analytical work at 1440–1920px, with responsive fallback for narrow screens. Analytical and operational pages can be dense; executive pages must make the current evidence hierarchy obvious at a glance.
- **Register:** Product/admin application. The three modes are Executive Dashboard, Analytical Workspace, and Operational Console.
- **Memorable signature:** A sparse evidence rail through hierarchy and spacing, not extra cards, gradients, or synthetic KPI scoring.
- **Restraint:** Familiar Ant Design behavior, readable tables, filters, drawers, and navigation take priority over expression.
- **Anti-references:** Neon/AI spectacle, blue-purple glow dashboards, generic Ant Design Pro card grids, and pie/donut defaults all obscure evidence density or imitate a template.
- **Token ownership/runtime mapping:** `frontend/src/design/tokens.css` is the canonical runtime source. `frontend/src/design/theme.js` and `frontend/src/charts/chartTheme.js` resolve the CSS semantic tokens for Ant Design and ECharts; application and page CSS consume those canonical tokens directly. `app.css` keeps only true shell-local state such as the responsive `--shell-sidebar-width`; it no longer publishes compatibility color, spacing, motion, or visualization aliases. Shared components and chart options consume the resolved values.

## Colors

`--color-bg-page`, `--color-bg-surface`, `--color-text-primary`, `--color-text-secondary`, `--color-border-default`, and `--color-brand-primary` establish light-mode hierarchy. Semantic status colors only express real success, warning, and error meanings. Text on subtle error surfaces uses `--color-danger-foreground` to preserve readable contrast; `--color-danger` remains the indicator and chart color. `--color-data-team-1` through `--color-data-team-8` are fixed entity slots; `--color-data-average` is neutral gray and dashed. `--color-data-maturity-0` through `--color-data-maturity-5` are the ordinal maturity palette, not positive/negative signals. Fact charts label `company_average` as “全公司均值”; maturity charts label the assessment aggregate as “领域平均”. `--color-data-target` is intentionally quiet and can be rendered only when a true target exists.

Future dark mode changes semantic mappings under a theme selector; pages must not depend on current primitive values. Focus uses the brand role with a visible outline, and selection uses the sidebar-specific semantic roles.

## Typography

The system stack supports Chinese UI text without a new font dependency. Page title is 28px, section title 20px, card title 16px, body 14px, secondary copy 13px, label 12px, and KPI 32px. Numbers and charts use `font-variant-numeric: tabular-nums`; labels describe what is measured rather than manufacturing a score.

## Layout

The desktop content gutter is responsive from 24px to 40px. `.app-shell__content--dashboard` and `--analytics` use the full post-sidebar canvas; the 12-column `.app-page-grid` composes content without stretching every panel equally. `--operational` retains the table/workflow width policy, while `--readable` caps form-oriented content at 1120px. The document owns Analytics vertical scrolling; page content clips only horizontal spill and does not create a second, non-scrolling vertical ancestor. The application keeps the tested 248px/64px desktop navigation and converts it to a 280px drawer at the existing 680px breakpoint. The Topbar is a 56px context-and-account strip; each route owns a content-level page header.

No page gets a fixed document height to make a table fill space. Tables own needed horizontal/vertical overflow; scrollbars remain visible, thin, and tokenised globally.

## Elevation & Depth

Primary hierarchy comes from the page/surface/subtle surface sequence, typography, and spacing. Panels use a one-pixel border and restrained `--shadow-panel` only when a floating boundary needs it. Nested cards and ornamental shadows are not layout primitives.

## Shapes

Controls use `--radius-sm`; independent panels use `--radius-md`; larger composed surfaces use `--radius-lg` only when their geometry calls for it. Dividers use `--color-border-default`; icon-only actions retain an accessible 40px target where the shell already establishes one.

## Components

### Foundational visual states

Focus-visible always has a 2px brand outline. Hover/pressed states are perceptible without replacing labels or moving layout. Loading, empty, error, not-evaluated, no-permission, and partial-data states use compact stable `feedback-state` regions and explain the condition; a missing fact is never displayed as zero.

### Buttons and actions

Ant Design Button remains canonical. Solid brand actions are reserved for page primary actions and confirmed commits; neutral/ghost actions support secondary work; danger stays separated until a destructive confirmation. Busy buttons keep their geometry.

### Navigation and data display

App navigation is a light, role-filtered sidebar with current-route indication, keyboard focus, and a narrow drawer fallback. Breadcrumbs provide context in Topbar. The shared `FilterToolbar` groups analysis controls by meaning, wraps without per-control boxes, and provides a reset for dimension/granularity/metric/period while preserving the independent maturity month. Activities use a compact sticky directory and flat sections; metric trend panels are the only repeated surfaces, while maturity/no-data content sizes to its actual copy. Team Drilldown uses sticky section navigation and only named catalog metrics in its KPI row. Metric Detail follows Result → Comparison → Evidence, including one-metric team ordering and on-demand raw facts. Tables are operational surfaces with numeric alignment, compact controls, sticky headers where supported, and local horizontal scrolling only when necessary. Charts use line trends, ranked horizontal bars, radar profiles, and status lists/matrices according to data type. Executive Snapshot includes two maturity summaries and two real catalog facts; a separate trend panel shows one selectable metric at a time with the `全公司均值` series beside a single-metric team ranking. The lifecycle uses six user-requested stages with named catalog metrics, current values, and same-metric trends without cross-unit aggregation. The capabilities workspace selects one capability for its current state and evolution. Pie/donut is not a default. The mobile navigation Drawer explicitly restores focus to its opener after close, including Escape and navigation-triggered close.

### Operational Console

Operational pages use the sequence PageHeader → necessary context/status → FilterToolbar → primary workspace → Drawer/review flow. Topbar Breadcrumb owns route context, so the page header does not repeat the full navigation path. Keep one primary action at most; a read-only role is a compact header status.

Operational filters keep common controls visible. Advanced filters expand as a light region, show an active-filter count, and reset at low visual weight. Preserve each route's existing query timing and filter state. Controls wrap naturally and stop growing at a readable width on wide screens.

`.operational-table` is the shared Ant Design table pattern: 42px header, 48px rows, 12px horizontal cell padding, 12px secondary metadata, tabular numbers, consistent date alignment, sticky headers offset below the 56px Topbar, fixed identifier/action columns, compact actions and pagination, selected/hover states, and a moderate in-body empty row. Long secondary metadata stays one line with its full text available as a title. Only the table may scroll horizontally when its complete columns need more width; the page document does not overflow horizontally. The 1600px operational container uses nearly the full post-sidebar canvas at 1920px.

Operational status tags use semantic tokens only for real states; ordinary metadata stays neutral. Pending domains use a compact state under PageHeader and do not fabricate fields or actions. Maintainer team filters remain locked to the account scope and explain why. Loading keeps the header and filter context stable while the workspace loads. Errors stay with the data domain or operation that failed.

The IR workspace table is the page surface, not a nested Card. An empty pending collector list reserves no panel; existing batches use a compact table and open a shared review Drawer. Import and collector previews identify source, file/team and generated time, row counts, warnings/errors, and the explicit whole-batch confirmation. Create/edit Drawers preserve list context, group existing fields by business meaning, keep save actions visible, and retain field validation.

Maturity remains an Operational Editing workflow. Its table distinguishes blank/not evaluated from valid zero; copy-previous changes only the draft; an explicit Drawer previews the month before save; clearing remains separately confirmed. Viewer summaries use two compact table sections.

### System Management

System Management is an Administrative Workspace: medium-high information density, table-first, and organized by object relationships. Its shared order is PageHeader → required scope/status → primary workspace → Drawer or detail panel. Breadcrumb owns route context, so settings pages do not repeat “系统管理 / …” as an eyebrow. Use one primary page action at most.

Teams use a compact master list and selected team detail. Products show Product → Version → Iteration ownership without a custom tree editor. Dashboard metric catalog and IR source metric rules remain separate tabs; activity selection narrows its metric table, and compute output is a configuration check. Users and permissions use the operational table as the page surface with subdued bilingual role labels and a quiet current-account marker.

Settings workspaces use the shared `.settings-master-detail`, `.settings-workspace`, and `.settings-section` patterns in `frontend/src/design/design-system.css`. Dividers and table surfaces express relationships; Cards are reserved for independent objects or floating content. The collection page uses a compact status summary, a schedule section, an optional custom-window disclosure, and an expandable run-history table. Failed outcomes show their message/code and retryable state when the API reports it; no retry action is shown without an API.

### Authentication and global status

Login uses one restrained, token-based sign-in panel with the shared radar mark, visible labels, associated errors, password-manager autocomplete, and a stable submit action. Session-expired feedback stays near the form. The shared `StatusPage` pattern covers 403, 404, pending capability, and fatal load errors; it uses a short status label, a clear title, concise explanation, and a relevant action. Pending is neutral/informational, while actual failures use the danger role. Route loading retains App Shell geometry and uses a compact `ContentLoadingState`; action loading stays on its button.

### App Shell and responsive fallback

Desktop navigation keeps the 248px/64px expanded/collapsed widths and the 56px Breadcrumb/account Topbar. The account area presents the username, one localized role label, and a quiet logout action. The <=680px navigation Drawer preserves the sidebar IA and focus return. At 768–1100px, management master/detail workspaces stack; below 720px, settings summaries and forms wrap, and dense tables keep local horizontal scrolling. No route creates page-level horizontal overflow. The app remains usable at 390px without claiming a mobile dashboard redesign.

### Forms and overlays

Ant Design Form, Drawer, Alert, and application App feedback remain canonical. Global route states use the shared `StatusPage` component rather than the library's default oversized Result layout. Select and date controls retain their existing Ant Design/native ownership per route until a later phase intentionally changes it. Drawers retain list context for create/edit/detail operations; validation stays associated with fields and server errors preserve entered values.

The `/data/maturity` monthly editor is a batch workflow: score and note stay in the activity table, “复制上月已有值” only populates the draft, and an explicit preview Drawer reviews the full month before confirmation. Blank remains not evaluated; numeric zero remains a valid value. Clearing stays a separately confirmed action.

### Iconography

Use the installed Ant Design icon family. Icons are 16–18px in navigation and always keep an accessible name when used alone; a tooltip supplements icons whose meaning is not universal.

### Motion

Motion is functional: 160ms interaction feedback and 240ms shell/layout changes using `cubic-bezier(.2, 0, 0, 1)`. It reverses cleanly when interrupted and is disabled for `prefers-reduced-motion`.

### Content and data visualization

Copy is direct, Chinese, and evidence-bounded. Team colors remain stable across pages. The fact `全公司均值` and maturity `领域平均` are both neutral/dashed but remain separately labeled and calculated; targets are weakened, positive/negative colors only represent actual semantic direction, and all charts retain an accessible name or data alternative.

## Do's and Don'ts

- **Do:** Establish hierarchy with evidence order, typography, and whitespace before adding a surface.
- **Do:** Reuse semantic tokens and shared page patterns across the three UX modes.
- **Don't:** Create a composite AI score, synthetic target, or cross-metric ranking to make a layout look more decisive.
- **Don't:** Add a card or literal colour just because a page needs visual separation.

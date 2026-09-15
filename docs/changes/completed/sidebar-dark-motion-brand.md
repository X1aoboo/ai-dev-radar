# Dark Sidebar, Motion, and Radar Brand

## Status

Completed

## Background

The existing sidebar baseline provides desktop collapse memory, role-filtered navigation, a 680px drawer, and drilldown ownership highlighting. Its visual treatment is light and the collapse control shares the brand header.

## Requirement

Keep the existing 248px/64px desktop widths, local preference, 680px drawer breakpoint, role filtering, route/query contracts, and overview ownership highlighting. Change the sidebar and drawer to a dark blue-gray surface, move the desktop collapse control to the bottom, animate width and content offset together, preserve vertical positions while collapsing, and replace the R mark with one shared radar/data-node SVG used by the sidebar, drawer, login page, and favicon.

## Current Behavior

See [Business](../../business/index.md), [Architecture](../../architecture/overview.md), and the completed [Sidebar UI and UX](../completed/sidebar-ui-ux.md).

## Target Behavior

- Sidebar and narrow drawer use #101828, #E4E7EC navigation text, and #98A2B3 supporting text.
- Hover uses a lighter dark surface; selected navigation uses translucent blue and a bright-blue leading marker.
- The top of the desktop sidebar contains only the brand. Navigation scrolls independently and the collapse button stays at the bottom.
- The sidebar width and shell body offset transition for 240ms with cubic-bezier(.2,0,0,1). Icon columns and group heading heights remain stable; labels hide with opacity and clipping without wrapping.
- The unpublished disclosure remains in layout while collapsed but is invisible and unfocusable, including after it was opened.
- prefers-reduced-motion: reduce disables the new transitions.
- frontend/public/favicon.svg is the single static radar mark, legible at 16px and shown at 32px in the product.

## Design

Reuse AppShell, AppSidebar, the current native details disclosure, CSS custom properties, and the existing icon package. Keep the persisted boolean in localStorage; do not add a responsive state machine or a new dependency. Render the SVG as an image so the sidebar, drawer, login page, and favicon share the same asset.

## Business Impact

Navigation appearance and collapse interaction change. Role visibility, disabled unpublished entries, route ownership, query parameters, and analytics behavior do not change.

## Architecture Impact

The shared React shell remains the owner of desktop preference, breakpoint state, and drawer focus return. CSS owns the synchronized width/offset animation and clipping. The public SVG is a static frontend asset.

## API / Contract Changes

None.

## Data Changes

None. Browser storage retains the existing ai-dev-radar.sidebar-collapsed key.

## Compatibility

Preserve existing route paths, search parameters, role filtering, drawer close/focus behavior, and no-request collapse/navigation behavior. Preserve the current initial saved state without animating first paint.

## Error & Boundary Handling

Storage failures continue to fall back to an operable expanded sidebar. The drawer remains keyboard closable and returns focus to its trigger. Hidden unpublished content must not receive focus when collapsed. Short viewports retain a visible bottom control through independent navigation scrolling.

## Risks & Trade-offs

The collapsed unpublished disclosure reserves its current layout height, so a previously opened disclosure may leave intentional empty space until expanded. This avoids shifting system navigation during the transition and is bounded to the existing navigation.

## Test Strategy

Extend route rendering tests for the bottom collapse control, hidden/unfocusable unpublished disclosure, preserved navigation contracts, and existing drawer behavior. Run frontend unit/render tests, build, documentation checks, and git diff --check. Use a real browser to inspect expanded/collapsed/reversed transitions, intermediate geometry, reduced motion, focus behavior, short viewports, drawer closure, screenshots, and absence of additional business requests.

## Documentation Impact

- Business Design: UPDATE docs/business/index.md with dark navigation, bottom control, synchronized motion, and shared brand behavior.
- Architecture: UPDATE docs/architecture/overview.md with stable shell geometry, CSS transition ownership, and shared SVG asset usage.
- Standards: NONE; existing UI and testing conventions remain sufficient.
- ADR: NONE; this is a local reversible shell presentation change.
- Change Design: CREATE this active record, then move it to docs/changes/completed/ and update both change indexes after validation.

## Validation

- Frontend logic and route rendering tests passed: 31 Node tests and 50 Vitest tests.
- Frontend production build passed; Vite retained the existing warning about the ECharts and Ant Design chunks exceeding 500 kB.
- Design checks passed: npm run check:docs, npm run test:docs, and git diff --check.
- Real browser validation used the current worktree preview at http://127.0.0.1:5175 with the local admin demo account. At 1440×900 the saved collapsed state rendered directly with a 64px sidebar and 64px body offset; expanded state rendered at 248px. Computed transitions were 0.24s cubic-bezier(0.2, 0, 0, 1) for both sidebar width and body margin.
- Rapid expand/collapse ended in the requested final state. With the unpublished disclosure open, the pending block remained 200px high and the system group top remained unchanged after collapse; the block became visibility:hidden with pointer-events:none and summary tabIndex=-1. A 800×450 viewport kept the footer control visible and the nav scrollable. At 390×844 the dark drawer rendered the same SVG logo, closed navigation returned focus to the trigger after the Drawer motion, and the drawer surface was #101828.
- The login page and sidebar visibly rendered the shared frontend/public/favicon.svg at 32px. The SVG has two radar arcs, a scan line, and three data nodes; an independent 16px canvas screenshot was not produced because the browser runner blocks the required data URL preview. Screenshots for expanded/collapsed desktop, drawer, login, and saved collapsed desktop were captured and displayed during validation, but are not committed as binary evidence files.
- Rendering tests verified collapse did not increase fetch calls; the browser runner did not expose a network timeline for an independent browser-side request count. No API, database, route, or dependency contract changed.

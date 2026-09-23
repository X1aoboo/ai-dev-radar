# Gateway Runtime Configuration, Readiness and Project E2E Gate

## Status
Completed

## Background

IR collection currently reads the Gateway URL, Bearer Token, and timeout from three environment variables. Administrators cannot test a candidate without changing the running deployment, Radar does not retain a current readiness diagnosis, and the repository has no browser-level Radar-to-Gateway gate.

The current Gateway protocol baseline is `1.0.0 Unreleased` and has no release tag. The requested liveness and readiness operations can therefore enter the first published baseline without changing an already released provider contract.

## Requirement

- Manage exactly zero or one Active and zero or one Draft Gateway configuration.
- Let admins save and test Draft independently. Activation performs a new readiness request and succeeds only for `CONNECTED`.
- Keep the latest Active and Draft readiness observations, diagnose network, authentication, service identity, readiness and protocol compatibility, and expire observations after 90 seconds.
- Use the existing APScheduler for a 30-second Active health check and an immediate startup check.
- Read one immutable Active runtime snapshot at collection-run start and use it for every Team. Never store a token in a collection run, audit entry, API response, or log.
- Remove the legacy Gateway environment variables without migration or fallback.
- Add a separate HTTP Mock Gateway, provider contract verification, browser Project E2E, and cross-platform `npm run gate`.

## Current Behavior

- `config.py` provides `COLLECTOR_GATEWAY_URL`, `COLLECTOR_GATEWAY_TOKEN`, and `COLLECTOR_GATEWAY_TIMEOUT_SECONDS`.
- `collector_gateway.py` creates a client from process-wide configuration; `source_collection.py` reuses it while iterating Teams.
- `CollectionRun` stores its window and per-Team results but no Gateway configuration snapshot or run-level error.
- One APScheduler owns the daily FactRecord collector and configurable source collection jobs.
- Settings exposes `/settings/collections`; no Gateway configuration page or readiness protocol exists.

## Target Behavior

### Configuration and health

- `GatewayConfiguration` stores one row per `active` or `draft` slot, with a database uniqueness constraint. The configured token is stored in plaintext per the explicit product decision, but never returned or copied into diagnostic, audit, run, or log data.
- Draft save is independent of Active. If a Draft request leaves the token blank while an Active exists, the saved Draft uses the current Active token; first configuration requires a token.
- Readiness is `CONNECTED` only when the authenticated endpoint returns the expected service ID, `ready`, and a compatible SemVer major. Authentication errors map immediately to `AUTH_FAILED`, identity errors to `SERVICE_MISMATCH`, and malformed/incompatible responses to `PROTOCOL_INCOMPATIBLE`.
- Readiness 503 is `DEGRADED`. Network failures 1–2 are `DEGRADED`; the third consecutive network failure is `UNREACHABLE`. A success resets the counter.
- Store only the latest status for each scope. Effective status becomes `UNKNOWN` when its observation is older than 90 seconds. After process startup, the current status is `UNKNOWN` until its immediate check finishes, with the prior status retained as last known.
- Add `gateway-health-check` to the existing APScheduler with a 30-second interval, one instance, and coalescing; run its first Active check at startup. A health result is persisted only if the checked config is still current.
- Draft activation performs a new readiness call, checks the saved Draft revision again, and replaces Active and Draft in one database transaction only on `CONNECTED`. Scheduled checks do not create audit rows; human configuration and check actions do.

### Collection

- At run start, read Active once into frozen `GatewayRuntimeConfig`; store its config ID and base URL on `CollectionRun`, never its token. Pass the same snapshot explicitly to every Gateway request.
- No Active or a fresh deterministic Active error returns one run-level error without repeating the global failure for every Team. Fresh `AUTH_FAILED`, `SERVICE_MISMATCH`, and `PROTOCOL_INCOMPATIBLE` may fail fast. `UNKNOWN`, stale, `DEGRADED`, and `UNREACHABLE` still attempt the business request.
- Preserve the existing per-Team product/version validation, staging, and partial-failure behavior.

### UI and API

- Add admin-only `/settings/gateway` and the matching management APIs for read, Draft save/check/activate/discard, Active check, and sanitized audit listing.
- Mask the Token input by default; never prefill it. Editing with a blank token means reuse Active's token. A first configuration requires entry.
- Show Active status, freshness, latency, protocol version and token-configured flag; show Draft status and audit events. `/settings/collections` only reads and links to the Gateway status summary.
- Keep every `/_mock/*` control route inside the separate Mock Gateway process. Production Radar does not register those routes, and production Docker does not copy `e2e/`.

### Protocol and validation

- Add `GET /health/live` and authenticated `GET /v1/health/ready` to the unreleased `1.0.0` baseline and OpenAPI. Readiness returns service identity, `ready`, contract version, and optional upstream summaries; Radar does not consume upstream summaries.
- Add the independent FastAPI Mock Gateway and test scenarios for readiness and collection success/failure.
- Validate Mock Gateway responses against the OpenAPI baseline in a provider contract test. Keep `httpx.MockTransport` for L1/L2 tests only.
- Add a Playwright Chromium Project E2E that launches temporary SQLite, Mock Gateway, Radar, and browser processes on dynamic localhost ports. Verify the complete Draft → readiness → activation → scheduled summary → manual IR collection → pending batch flow, plus readiness failures and Active preservation.
- Keep failed-run trace, screenshot, browser console, Radar logs, and Mock Gateway logs under ignored `e2e-results/`.
- `npm run gate` runs backend tests, frontend tests, frontend build, Project E2E, docs check, and docs tests in order; it owns cleanup through Node child processes and works on Windows, macOS, and Linux.

## Design

- Keep configuration lifecycle in `gateway_config.py`, probe/transition/stale logic in `gateway_health.py`, and admin HTTP orchestration in `gateway_api.py`; the collection client only accepts a frozen runtime snapshot.
- Persist one active/draft slot each, one latest health row per scope, and sanitized configuration audits. Activation probes before a transaction, then verifies the Draft revision before swapping slots.
- Store the active snapshot ID/base URL and run-level configuration error on CollectionRun. Keep credentials out of all serialized state, and let non-deterministic/stale health states attempt actual collection.
- The Gateway liveness/readiness paths are service-level protocol operations, separate from the static business capability catalog. They use `x-protocol-operation` in OpenAPI; data collection operations continue to reference an available `x-capability-id`. A GET operation without a request body requires no request example, while every declared JSON request body still requires one.
- Reuse Ant Design forms, Drawer, status tags and the current light semantic tokens. Keep Gateway editing in an admin-only page; the collection page only displays a read-only status summary.
- Run L3 through a separate FastAPI Mock Gateway process and browser, not a Radar client transport seam. Node owns process startup, dynamic ports, temporary DB, and cleanup on every exit path.

## Business Impact

Admins gain runtime Gateway configuration and diagnostics. Gateway failure detail becomes actionable without exposing credentials. Source collection remains IR v1, Team-scoped, staged, and manually confirmed; no planned AR/SR or other source capability is introduced.

## Architecture Impact

Add `gateway_api.py`, `gateway_config.py`, `gateway_health.py`, and `gateway_contracts.py`. Keep `collector_gateway.py` as the HTTP client and inject an immutable runtime snapshot. Extend the existing in-process APScheduler. Add configuration, health snapshot, and config audit tables through the existing `Base.metadata.create_all` plus `ensure_gateway_schema()` approach; do not add Alembic or a second scheduler.

The Mock Gateway and E2E runner live under `e2e/` and `scripts/`, outside the production Radar package/image.

## API / Contract Changes

- Add admin-only `/api/gateway` management routes.
- Extend Gateway protocol `1.0.0 Unreleased` with liveness and readiness paths. Update the full baseline, OpenAPI, initial version delta, and consumer/provider contract checks together.
- Remove the three legacy environment variables and their docs/tests; do not migrate or fallback.

## Data Changes

- Add configuration, health status and configuration audit models.
- Add `gateway_config_id`, `gateway_base_url`, `error_code`, `message`, and `retryable` to `CollectionRun` and its API output; existing databases receive nullable columns through `ensure_gateway_schema()`.
- Do not store credentials in runs, audit changes, health rows, or frontend initialization data.

## Compatibility

There is no released Gateway contract tag or real provider in this repository. Health operations are added to the existing initial `1.0.0` candidate. Gateway configuration environment variables are removed with no compatibility read or migration, as explicitly required.

## Error & Boundary Handling

- Validate URL scheme, authority and components; production requires HTTPS. Use Bearer auth without following redirects.
- Check admin authorization on every management API; hide the route from non-admin navigation and retain server-side protection.
- Sanitize provider errors and log only error type and request/config identifiers. Never log request headers or tokens.
- Drop health results from replaced configs and reject activation when readiness fails or the Draft revision changes during the check.
- Do not create batches for empty collection responses or run-level Gateway configuration failures.

## Risks & Trade-offs

- Plaintext token storage is an explicit product choice; database access and backups therefore carry credential access. API, logs, audit and browser boundaries must remain secret-free.
- The health snapshot is a latest-state view, not an availability history or SLO. L4 real Gateway/internal-platform validation remains outside this project gate.
- Dynamic port allocation has a small bind race; the runner must fail with captured logs and always clean up children and temporary data.

## Test Strategy

- L1/L2: config lifecycle, revision races, token secrecy, health transitions/stale behavior, runtime snapshot reuse, run-level failures, scheduler setup, and OpenAPI consumer conformance.
- Provider contract: run the independent Mock Gateway and validate readiness, GatewayError, and collection responses against `baseline/openapi.json`.
- L3 Project E2E: real browser → Radar frontend/backend → real HTTP → separate Mock Gateway process. Cover the happy path and requested failure cases.
- Run `npm run gate` before completion. L4 real Gateway and internal platforms are reported as `NOT VERIFIED` unless a real deployment is available.

## Documentation Impact

- Business Design: UPDATE `CONTEXT.md` and `docs/business/data-management.md` — define the new Gateway runtime/readiness/audit terms and describe their business lifecycle.
- Architecture: UPDATE `docs/architecture/overview.md` and `docs/architecture/modules/data-management.md` — record module boundaries, database snapshots, shared scheduler and test-only processes.
- Standards: UPDATE `docs/standards/testing.md` — make L3 Project E2E and `npm run gate` project standards. UPDATE `scripts/check-design-docs.mjs` and its test — support service-level protocol operations and GET operations without request bodies. UPDATE `UX-CONTRACT.md` — define the new admin workflow and sensitive field behavior. UPDATE `premium-ui.json` — register E2E and gate commands/evidence.
- Visual system: NONE for `DESIGN.md` — reuse existing semantic tokens, Ant Design surfaces and form behavior; no durable visual-token decision changes.
- ADR: CREATE `docs/adr/0010-database-managed-gateway-runtime.md` — document persistent config, readiness-gated activation and verification trade-offs; keep ADR-0009 protocol governance intact.
- Change Design: CREATE this Large record under `docs/changes/active/` before implementation; finalize and move it to `docs/changes/completed/gateway-runtime-configuration.md` after the gate and doc checks pass.
- Contract: UPDATE `docs/contracts/ai-dev-data-gateway/baseline/capability-protocol.md`, `baseline/openapi.json`, `changes/1.0.0.md`, and `changes/README.md` — extend the unreleased initial baseline with health operations.
- Product documentation: UPDATE `README.md` and `.env.example` — remove legacy Gateway environment variables and document settings plus the E2E/gate commands.
- Navigation: UPDATE `docs/index.md`, ADR index, and Change Design indexes as needed so new documents remain reachable.

## Validation

- `npm run gate`: PASS — backend (139 tests), frontend unit/render (46 Node tests + 79 Vitest tests), frontend build, provider contract, 3 browser Project E2E tests, `check:docs`, and `test:docs`.
- `npm run test:e2e:gateway`: PASS on Windows with dynamic ports and temporary SQLite. Browser assertions cover the complete Admin → Draft → readiness → activation → read-only summary → IR staging path; bad token, service mismatch, protocol 2.x, 503, malformed/delayed readiness, three network failures, and Active collection after Draft failure.
- Browser layout and interaction: PASS at 1920/1440/1024/390px; no page-level horizontal overflow; keyboard Token reveal, visible focus, reduced motion and viewer 403 verified. Mobile Drawer viewport bounds and field padding were visually inspected.
- Mock Gateway provider contract against `baseline/openapi.json`: PASS for `HealthLiveResponse`, `HealthReadyResponse`, `GatewayError`, and `CollectorIRResponse`.
- Frontend Premium strict audit: PASS, 0 findings. Failure artifacts and the static audit report remain in ignored `e2e-results/` for this checkout.
- `git diff --check`: PASS.
- Radar + Real Gateway: NOT VERIFIED. Gateway + Real Internal Platforms: NOT VERIFIED. Docker image build/deployment: NOT RUN.

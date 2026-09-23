# ADR-0010: Database-managed Gateway Runtime Configuration and Project E2E

## Status
Accepted

## Context

IR collection currently reads one Gateway URL, bearer token, and timeout from process environment. Updating the endpoint or credential requires a deployment change, there is no current readiness diagnosis, and unit tests cannot prove the browser-to-provider HTTP path. The Gateway protocol `1.0.0` is still unreleased and has no provider tag, so health operations can be added to the initial baseline.

Administrators need a safe candidate workflow while keeping the active collection route available. A collection run also needs a stable configuration even if an administrator activates a replacement while the run is processing multiple teams.

## Decision

- Radar stores exactly zero or one Active and zero or one Draft Gateway configuration in its database. The bearer token is stored in plaintext by explicit product decision; it is never returned by APIs or copied into logs, audits, health snapshots, collection runs, or frontend initialization data.
- Saving a Draft does not change Active. The Draft can be tested independently. Activation always makes a live readiness request and changes Active only if the current Draft revision is `CONNECTED` and unchanged during that request.
- Radar keeps only the latest readiness observation per scope, expires its effective status after 90 seconds, and checks Active immediately on startup and every 30 seconds through the existing APScheduler.
- Each IR CollectionRun reads Active once into an immutable runtime snapshot and uses it for every Team. The run may record the config ID and base URL, never its token. Recent fresh deterministic readiness failures may fail fast; unknown, stale, degraded, or unreachable observations still allow a real IR request.
- Add liveness and readiness to the unreleased `1.0.0` Gateway protocol. Keep provider implementation and real internal-platform validation outside this repository.
- Make the separate HTTP Mock Gateway plus Chromium browser Project E2E an L3 project quality gate. It must cross a browser, Radar frontend/backend, real TCP/HTTP, and the Mock Gateway process. `httpx.MockTransport` remains an L1/L2 tool. `npm run gate` is the completion gate for Gateway, Collection, and Settings runtime changes.
- Add no second scheduler, migration framework, Vault/KMS integration, Gateway failover, readiness history, SLO, or real provider implementation.

## Alternatives Considered

- Keep environment variables and restart the service for each Gateway change: rejected because runtime change and candidate testing are explicit administrator requirements.
- Replace Active directly when a form is saved: rejected because a typo or stale readiness observation could interrupt existing collection.
- Use an old successful health observation to authorize activation: rejected because it cannot establish current readiness.
- Start a dedicated scheduler for Gateway health: rejected because the service already owns one APScheduler and another loop would add lifecycle and shutdown complexity.
- Use only MockTransport or an in-process Mock Gateway for project acceptance: rejected because neither proves the real HTTP boundary or the browser workflow.
- Add a production Gateway provider or call internal systems from the Mock Gateway: rejected because those systems are out of scope and would make the project gate environment-dependent.
- Encrypt the token or add Vault/KMS now: deferred because the task explicitly selects plaintext database storage and excludes key-management infrastructure. Database access and backups remain credential-bearing boundaries.

## Consequences

- Operators can change endpoints and credentials without deployment environment edits, and a failed candidate leaves Active available.
- API schemas and tests must keep credentials masked and must not serialize request secrets in validation errors.
- Health is an operational latest-state snapshot, not an uptime history; stale and post-restart states are explicit.
- Old configuration rows can be replaced while collection runs and audit entries retain plain config identifiers as historical facts; config IDs are not foreign keys to the single-slot table.
- The automated gate proves L3 Radar-to-Mock-Gateway integration only. It does not prove a real Gateway or internal platform works (L4).
- The source protocol baseline remains owned by Radar and both consumer and independent Mock provider contract tests must conform to the OpenAPI artifact.

## Related Design

- [Gateway runtime Change Design](../changes/completed/gateway-runtime-configuration.md)
- [Gateway capability protocol](../contracts/ai-dev-data-gateway/README.md)
- [Data management business design](../business/data-management.md)
- [Current architecture](../architecture/overview.md)
- [Data management module](../architecture/modules/data-management.md)

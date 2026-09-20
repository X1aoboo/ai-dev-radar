# ADR-0009: Versioned AI Engineering Data Gateway Protocol

## Status
Accepted

## Context

ADR-0008 established a private Gateway seam for IR collection, but made Radar Pydantic models the contract source. The Gateway has not started implementation, and both repositories need an implementation-neutral, versioned input that supports independent development, compatibility review, and future source-data capabilities without treating planned capabilities as available.

## Decision

- The service is named AI 研发数据网关 (AI Engineering Data Gateway), with repository and deployment identifier `ai-dev-data-gateway`.
- The existing anti-corruption responsibilities remain: Gateway owns internal-platform authentication, queries, and field translation; Radar owns scheduling, local hierarchy validation, staging, confirmation, persistence, audit, and metrics.
- Radar stores the canonical protocol, but Radar and Gateway code are both consumers. The latest complete capability document and OpenAPI 3.1 baseline are the protocol source of truth; Pydantic models are no longer the source.
- The workspace stores only the latest complete baseline plus one immutable delta document per SemVer release. Historical complete baselines are retrieved from annotated `gateway-contract-vX.Y.Z` Git tags.
- Only capabilities marked `available` are contractual. Version 1.0.0 fully defines `requirements.ir.collection`; AR, SR, issues, merge requests, and code reviews remain `planned` without placeholder interfaces.
- The capability catalog is static in v1. There is no runtime capability-discovery endpoint.
- HTTP major paths and protocol major versions align. Breaking changes require a new major path and an explicit coexistence and migration plan.

## Alternatives Considered

- Keep Pydantic as the source and export JSON Schema: rejected because it makes the provider depend on Radar implementation choices and cannot describe endpoints, status codes, authentication, or protocol governance completely.
- Put the source in the future Gateway repository: rejected because the provider implementation could drive the shared contract and Radar could not prepare before that repository exists.
- Create a separate contract repository now: rejected because it adds release infrastructure before a second repository exists; the versioned artifact and Git tags preserve a later extraction path.
- Store a full copy for every version in the working tree: rejected because it duplicates large baselines and creates multiple editable truths; Git tags already preserve complete historical states.
- Add runtime capability discovery: rejected for v1 because deployment is statically configured and discovery would introduce new availability and reconciliation behavior without a current need.

## Consequences

- Every release updates the capability baseline, OpenAPI, one version delta, version index, and conformance tests atomically.
- Consumers must pin a Git tag or commit; following an unreleased branch is unsupported.
- The old standalone `collector-ir-v1.schema.json` snapshot is removed after migration to prevent two sources of truth.
- Protocol ownership in the Radar repository creates a governance obligation: changes must assess both consumer and provider impact and cannot be inferred from Radar code alone.
- Gateway implementation and real internal-platform integration remain outside this repository and require separate provider-contract and deployment validation.

## Related Design

- [Capability protocol](../contracts/ai-dev-data-gateway/README.md)
- [Data management business design](../business/data-management.md)
- [Current architecture](../architecture/overview.md)
- [Data management module](../architecture/modules/data-management.md)
- [Versioned protocol change](../changes/completed/ai-dev-data-gateway-contract.md)

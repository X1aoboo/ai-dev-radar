# ADR-0011: AI review-opinion source and effectiveness metrics

## Status
Accepted

## Context

The Capability page needs AI review-opinion effectiveness metrics. Existing `mrr-count` and `mrr-rate` describe AI opinion count and AI-reviewed MR share; they cannot determine whether an individual AI opinion was effective. The user approved an explicit Boolean effectiveness field, a one-row-per-AI-opinion local source record, and the count/rate formulas. Gateway protocol v1.0.0 still marks code-review collection as planned, so Radar must not claim a real provider integration.

## Decision

- Radar stores one minimal local source record per AI-generated MR review opinion: stable `source_id`, owning `team_id`, `opinion_date`, and required Boolean `ai_effective`. The local source contains AI opinions only; `false` means ineffective, while every row is in the rate denominator. Opinion text is not stored.
- The local source API upserts by stable source ID and enforces the existing admin/maintainer team-write boundary.
- `mrr-effective-count` counts opinions with `ai_effective=true`; `mrr-effective-rate` divides that count by all AI opinion records in the team/time slice. With no opinion records, the result is missing; with records and no effective opinions, count and rate are zero.
- Both metrics are derived on read through the existing `/api/compute` time-series contract. Monthly grouping uses `opinion_date`; derived aggregates are not persisted as source data.
- Existing `mrr-count` and `mrr-rate` keep their current definitions. This local model/API does not add code-review capability to Gateway v1.0.0; provider collection remains planned and needs a separate provider contract/integration.

## Alternatives Considered

- Reuse `mrr-count` or `mrr-rate` as the effective metrics: rejected because neither records per-opinion effectiveness.
- Store only pre-aggregated counts/rates: rejected because this loses the opinion-level Boolean source field and prevents recomputation.
- Add code-review collection to Gateway v1.0.0: rejected because that protocol is unreleased and its code-review capability is explicitly planned; this decision defines Radar's local source contract only.

## Consequences

- Fixed-Golden and demo data can exercise the metrics through the same source-record contract, while real business-data validation remains pending until a real source populates the local API.
- Source records omit review text and preserve only the identity, team, date, and effectiveness needed for these metrics.

## Related Design

- [Business analytics](../business/analytics.md)
- [Data management](../business/data-management.md)
- [Current architecture](../architecture/overview.md)
- [Gateway protocol](../contracts/ai-dev-data-gateway/README.md)
- [UX visual convergence Change Design](../changes/completed/ux-visual-convergence.md)

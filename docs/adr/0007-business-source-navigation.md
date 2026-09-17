# ADR-0007: Data management navigation follows business sources

## Status

Accepted

## Context

The source-data-first decision in ADR-0003 used IR, AR, SR, DTS, and MR as peer data-domain examples. Current product terminology instead treats IR, AR, and SR as levels within requirements. Keeping them as peer navigation entries mixes requirement hierarchy with business source types and makes the workbench harder to extend consistently.

## Decision

Data management uses requirements, issues, MR, and code review as its top-level business source categories. Requirements contain IR, AR, and SR subtypes presented inside the requirement workspace. Each source still owns its eventual record schema, validation, collection, and metric rules; ADR-0003's source-data-first and computed-metric direction remains unchanged.

## Alternatives Considered

- Keep IR, AR, SR, DTS, and MR as peer entries: rejected because it exposes one source's internal hierarchy beside unrelated source types.
- Use one generic source-record screen: rejected because the sources have different fields and business rules.
- Treat MR and code review as one entry: rejected because the requested information architecture distinguishes their source records; their detailed relationship remains to be designed.

## Consequences

- Navigation and current terminology use the four business sources.
- IR remains the only implemented source workspace; AR and SR are requirement tabs with pending specifications.
- Issues, MR, and code review may show pending pages until their contracts exist.
- ADR-0003 remains authoritative for source-first metrics, while its peer-domain examples are historical rather than the current navigation taxonomy.

## Related Design

- [Business design](../business/index.md)
- [Data management](../business/data-management.md)
- [Current architecture](../architecture/overview.md)
- [Change design](../changes/completed/data-source-navigation.md)

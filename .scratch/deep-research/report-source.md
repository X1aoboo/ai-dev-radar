# Source report: Claude Code multi-repository development plugins

Date: 2026-09-03

## Scope and assumptions

- Question: Which current Claude Code plugins support AI development across independent microservice Git repositories?
- Strict support definition: repository access plus some combination of shared task coordination, dependency ordering, branch/PR handling, contract awareness, integration verification, or deployment ordering.
- Excluded from the strict plugin list: standalone desktop applications, CLIs, MCP-only coordination layers, and same-repository worktree managers.

## Direct answer

No plugin has sufficient independent evidence to be called a mature, end-to-end multi-repository transaction coordinator. `feature-workflow` is the closest documented plugin but its own design document says the live multi-repo round trip remains to be proven. Ruflo claims broad multi-repo orchestration, but its lite Claude Code plugins do not include the full runtime harness and its multi-repo documentation has version/provenance uncertainty.

## Claim-to-source ledger

1. Native cloud sessions can select multiple repositories, each with a branch selector.
   - Source: Get started with Claude Code on the web; Anthropic; accessed 2026-09-03.
   - URL: https://code.claude.com/docs/en/web-quickstart

2. Routines bind prompts to one or more repositories and support cross-repository porting examples; research preview.
   - Source: Automate work with routines; Anthropic; accessed 2026-09-03.
   - URL: https://code.claude.com/docs/en/routines

3. Plugins package skills, agents, hooks and MCP servers and are not orchestration semantics by themselves.
   - Source: Create plugins; Anthropic; accessed 2026-09-03.
   - URL: https://code.claude.com/docs/en/plugins

4. `feature-workflow` documents workspace epics, repo children, contract warnings, aggregated dashboards and producer-first deploy.
   - Source: claude-code-plugins README and multi-repo design; schuettc; 2026-06-08 design date; accessed 2026-09-03.
   - URLs: https://github.com/schuettc/claude-code-plugins ; https://github.com/schuettc/claude-code-plugins/blob/main/docs/designs/2026-06-08-multi-repo-workspace.md
   - Gap: design says implementation shipped and unit tested, but real end-to-end multi-repo round trip remains to be exercised.

5. Ruflo's plugin install is a lite surface; the full harness requires CLI initialization.
   - Source: Ruflo README; ruvnet; accessed 2026-09-03.
   - URL: https://github.com/ruvnet/ruflo
   - Gap: multi-repo examples are partly in related/legacy agent templates.

6. `virtual-workspace` provides a unified session and synchronized feature worktrees across independent repos, but declares itself a symlink workaround.
   - Source: virtual-workspace README; filipealva; accessed 2026-09-03.
   - URL: https://github.com/filipealva/virtual-workspace

7. Workspaces provides topology, cloning, setup, status, service management, affected lookup, and cross-repo search.
   - Source: Workspaces README; patricio0312rev; accessed 2026-09-03.
   - URL: https://github.com/patricio0312rev/workspaces

8. Coco derives per-satellite PRDs and each satellite runs an independent pipeline.
   - Source: Coco README; skullninja; accessed 2026-09-03.
   - URL: https://github.com/skullninja/coco-workflow

9. `multi-repo-context` is a manifest discipline, not build-system integration.
   - Source: multi-repo-context README; Zavelinski; accessed 2026-09-03.
   - URL: https://github.com/Zavelinski/multi-repo-context

10. Gas Town uses rigs for repositories, a Mayor for cross-rig coordination, persistent Beads work and per-rig merge queues.
    - Source: Gas Town README; gastownhall; accessed 2026-09-03.
    - URL: https://github.com/gastownhall/gastown

11. Millwright dispatches Claude from a GitHub Project containing issues from multiple repositories.
    - Source: Millwright README; njcameron; accessed 2026-09-03.
    - URL: https://github.com/njcameron/Millwright

12. The official marketplace lists GitHub, GitKraken, Greptile and Sourcegraph with cross-repository access/search descriptions.
    - Source: official marketplace manifest; Anthropic; accessed 2026-09-03.
    - URL: https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json

## Contradictions reconciled

- An older open GitHub feature request says remote/web sessions are single-repo, but current Anthropic Web and Desktop documentation explicitly supports multiple repositories. Current product documentation supersedes the older issue body.
- Ruflo's marketplace plugins exist, but its own README says the full production loop requires the CLI track. Plugin availability therefore does not prove the full cross-repo feature set.

## Stop rationale

The main answer slots have primary evidence, the high-impact native capability was independently checked against current Anthropic docs, and the strongest third-party claim carries an explicit limitation from its own repository. More README discovery is unlikely to change the production recommendation without hands-on testing.

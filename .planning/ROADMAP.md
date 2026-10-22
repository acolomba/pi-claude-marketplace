# Roadmap: pi-claude-marketplace

## Milestones

- **marketplace-features** Marketplace Behavioral Tests — completed 2026-10-21 on branch `features/cucumber-behavioral-tests` (PR #271, not yet merged); 14 phases, 82 plans, 97/97 requirements. [Archive](milestones/marketplace-features-ROADMAP.md), [requirements](milestones/marketplace-features-REQUIREMENTS.md), [audit](milestones/marketplace-features-MILESTONE-AUDIT.md).
- **json-output** Mode-Keyed Presentation Strategies — completed 2026-10-11, merged to main 2026-10-11 (PR #251, squash `0e45ffd9`), not yet released; 9 phases, 50 plans, 36/36 requirements. [Archive](milestones/json-output-ROADMAP.md), [requirements](milestones/json-output-REQUIREMENTS.md), [audit](milestones/json-output-MILESTONE-AUDIT.md).
- **mcp-4 (MCP 4)** — completed 2026-10-10, merged to main 2026-10-10 (PR #250, squash `94160614`), released as 0.20.0; 8 phases, 73 plans, 41/41 requirements. [Archive](milestones/mcp-4-ROADMAP.md), [requirements](milestones/mcp-4-REQUIREMENTS.md), [audit](milestones/mcp-4-MILESTONE-AUDIT.md).
- **any-git-host** — completed 2026-09-30, merged to main 2026-09-30 (PR #221); [archive](milestones/ws-git-hosts-2026-10-01/milestones/any-git-host-ROADMAP.md)
- **v1.20 transitive-dependencies** — completed 2026-09-24, merged to main 2026-10-01 (PR #198); 12 phases, 55 plans, 45/45 requirements. [Archive](milestones/v1.20-ROADMAP.md), [requirements](milestones/v1.20-REQUIREMENTS.md), [audit](milestones/v1.20-MILESTONE-AUDIT.md). The private-repository credential challenge deferred at closeout passed on 2026-09-30
- **workflows-replay** — completed 2026-09-21, merged to main 2026-09-24 (PR #205); [archive](milestones/ws-workflows-2026-09-27/milestones/workflows-replay-ROADMAP.md)
- **test-backlog** — completed 2026-09-18; [archive](milestones/test-backlog-ROADMAP.md)
- **refine-unit-tests** — completed 2026-09-13; [archive](milestones/refine-unit-tests-ROADMAP.md)
- **v1.19 Unit Test Refactor** — completed 2026-09-04; [archive](milestones/v1.19-ROADMAP.md)

Earlier milestones remain in [MILESTONES.md](MILESTONES.md).

## Phases

The next milestone has not been defined. marketplace-features' completed phase
details are in [the roadmap archive](milestones/marketplace-features-ROADMAP.md),
and its phase and quick-task records are under
[marketplace-features-phases](milestones/marketplace-features-phases/) and
`milestones/marketplace-features-quick/`.

| Phase | Delivered | Completed |
| --- | --- | --- |
| 1 | Suite Foundation | 2026-10-15 |
| 2 | GitHub Clone-Base Override | 2026-10-16 |
| 3 | Marketplace Add | 2026-10-16 |
| 3.1 | Local Declaration Leak Fix | 2026-10-16 |
| 3.2 | Marketplace Layer Partition | 2026-10-17 |
| 3.3 | Plugin Layer Partition | 2026-10-17 |
| 3.4 | Scope and Layer Terminology | 2026-10-18 |
| 4 | Marketplace Remove and List | 2026-10-18 |
| 5 | Marketplace Info | 2026-10-18 |
| 6 | Marketplace Update and C-10 Fix | 2026-10-19 |
| 7 | Marketplace Autoupdate | 2026-10-20 |
| 8 | Marketplace Help and Usage Errors | 2026-10-20 |
| 9 | URL Source Kind and HTTPS Git Stand-In | 2026-10-21 |
| 10 | GitHub Source Kind and Suite Close | 2026-10-21 |

## Carried Forward

- `PRUNE-GUARD-MR-01` remains in [BACKLOG.md](BACKLOG.md). Marketplace removal
  can leave a dependent unsatisfied; the load-time check reports that state.
- `DEPADV-01` and `WOUT-01` remain in [BACKLOG.md](BACKLOG.md): Pi's shrinkwrap
  pins a nested `brace-expansion@5.0.9`, and workflow output is unobserved.
- Open user choice from json-output `09/` (D-03): the LLM tools return
  `isError: true`, which Pi 0.87.1 ignores; throwing a redacted Error instead
  would set Pi's error flag.
- `ROOTKEY-01`, carried from mcp-4, remains in [BACKLOG.md](BACKLOG.md): a root
  plugin name outside the dependency token alphabet gets a misleading
  dependency cause.
- `MKTPAR-01` is in [BACKLOG.md](BACKLOG.md): Claude Code's reserved official
  marketplace names, hosted `marketplace.json` URLs, and the `/plugin market`
  alias stayed out of marketplace-features.
- `SHORTREF-01` and `ROWID-01`, from marketplace-features, are in
  [BACKLOG.md](BACKLOG.md): the `owner/repo@ref` shorthand splits at the last
  `@` where Claude Code splits at the first, and marketplace-level failure rows
  carry a plugin-shaped `<mp>@<mp>` JSON id.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md)
and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).

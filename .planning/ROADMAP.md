# Roadmap: pi-claude-marketplace

## Milestones

- **lifecycle-coverage** Plugin Lifecycle Behavioral Tests — completed 2026-10-25 on branch `claude/plugin-lifecycle-coverage-b1d431` (not yet pushed); 30 phases, 76 plans, 104/104 requirements. [Archive](milestones/lifecycle-coverage-ROADMAP.md), [requirements](milestones/lifecycle-coverage-REQUIREMENTS.md), [audit](milestones/lifecycle-coverage-MILESTONE-AUDIT.md).
- **marketplace-features** Marketplace Behavioral Tests — completed 2026-10-21 on branch `features/cucumber-behavioral-tests` (PR #271, merged 2026-10-22, not yet released); 14 phases, 82 plans, 97/97 requirements. [Archive](milestones/marketplace-features-ROADMAP.md), [requirements](milestones/marketplace-features-REQUIREMENTS.md), [audit](milestones/marketplace-features-MILESTONE-AUDIT.md).
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

The next milestone has not been defined. lifecycle-coverage's completed phase
details are in [the roadmap archive](milestones/lifecycle-coverage-ROADMAP.md),
and its phase records are under
[lifecycle-coverage-phases](milestones/lifecycle-coverage-phases/).

| Phase | Delivered | Completed |
| --- | --- | --- |
| 1 | Suite Foundation | 2026-10-23 |
| 2 | Plugin Enable and Disable | 2026-10-23 |
| 3 | Install Dependencies, Partial, and User Scope | 2026-10-23 |
| 4 | Git-Source Plugins | 2026-10-23 |
| 5 | Install and Update Rollback | 2026-10-23 |
| 6 | Uninstall Data and Prune Flags | 2026-10-23 |
| 7 | Plugin Update by Marketplace, Constraint, and Partial | 2026-10-23 |
| 8 | Plugin Reinstall | 2026-10-23 |
| 9 | Plugin List | 2026-10-23 |
| 10 | Plugin Info | 2026-10-23 |
| 11 | Pending and Reconcile | 2026-10-23 |
| 12 | Fetch and Prune | 2026-10-23 |
| 13 | Plugin Import | 2026-10-23 |
| 14 | Bootstrap, Browse, Help, and Usage Errors | 2026-10-23 |
| 15 | State Lock and Marketplace Failure Cleanup | 2026-10-23 |
| 16 | Git Plugin Copies and Version Rule | 2026-10-23 |
| 17 | Reconcile Stale-Declarer Warning | 2026-10-23 |
| 18 | Update and Reinstall Unification | 2026-10-23 |
| 19 | Import on the Reconcile Path | 2026-10-23 |
| 20 | Path-Source Version and Missing Source | 2026-10-23 |
| 21 | Marketplace Add No-Op and Token Parity | 2026-10-23 |
| 22 | Install Failure Reasons | 2026-10-23 |
| 23 | Uninstall and Prune Parity | 2026-10-23 |
| 24 | Import Reasons | 2026-10-23 |
| 25 | Update and Reinstall Rows | 2026-10-24 |
| 26 | Git Mirror Access | 2026-10-23 |
| 27 | Install and Reconcile Reason Residue | 2026-10-23 |
| 28 | Delisted Plugin Dependency Walk | 2026-10-24 |
| 29 | Apply Command and Read-Only Reload | 2026-10-25 |
| 30 | Autoapply Setting | 2026-10-25 |

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
- `APPLY1-01` and `APPLYTHROW-01`, from lifecycle-coverage, are in
  [BACKLOG.md](BACKLOG.md): a dependent co-released with the newer dependency
  it needs takes two `apply` runs, and an apply pass that throws drops the rows
  it already collected.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md)
and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).

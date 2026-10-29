# Roadmap: pi-claude-marketplace

## Milestones

- ✅ **plugin-lifecycle** Marketplace and Plugin Lifecycle Backlog — completed 2026-10-29 on branch `features/plugin-lifecycle-p11` (not yet pushed, no npm release); 11 phases, 80 plans, 64/64 requirements. [Archive](milestones/plugin-lifecycle-ROADMAP.md), [requirements](milestones/plugin-lifecycle-REQUIREMENTS.md), [audit](milestones/plugin-lifecycle-MILESTONE-AUDIT.md).
- ✅ **lifecycle-coverage** Plugin Lifecycle Behavioral Tests — completed 2026-10-25 on branch `claude/plugin-lifecycle-coverage-b1d431` (not yet pushed); 30 phases, 76 plans, 104/104 requirements. [Archive](milestones/lifecycle-coverage-ROADMAP.md), [requirements](milestones/lifecycle-coverage-REQUIREMENTS.md), [audit](milestones/lifecycle-coverage-MILESTONE-AUDIT.md).
- ✅ **marketplace-features** Marketplace Behavioral Tests — completed 2026-10-21 on branch `features/cucumber-behavioral-tests` (PR #271, merged 2026-10-22, not yet released); 14 phases, 82 plans, 97/97 requirements. [Archive](milestones/marketplace-features-ROADMAP.md), [requirements](milestones/marketplace-features-REQUIREMENTS.md), [audit](milestones/marketplace-features-MILESTONE-AUDIT.md).
- ✅ **json-output** Mode-Keyed Presentation Strategies — completed 2026-10-11, merged to main 2026-10-11 (PR #251, squash `0e45ffd9`), not yet released; 9 phases, 50 plans, 36/36 requirements. [Archive](milestones/json-output-ROADMAP.md), [requirements](milestones/json-output-REQUIREMENTS.md), [audit](milestones/json-output-MILESTONE-AUDIT.md).
- ✅ **mcp-4** MCP 4 — completed 2026-10-10, merged to main 2026-10-10 (PR #250, squash `94160614`), released as 0.20.0; 8 phases, 73 plans, 41/41 requirements. [Archive](milestones/mcp-4-ROADMAP.md), [requirements](milestones/mcp-4-REQUIREMENTS.md), [audit](milestones/mcp-4-MILESTONE-AUDIT.md).
- ✅ **any-git-host** — completed 2026-09-30, merged to main 2026-09-30 (PR #221). [Archive](milestones/ws-git-hosts-2026-10-01/milestones/any-git-host-ROADMAP.md).
- ✅ **v1.20 transitive-dependencies** — completed 2026-09-24, merged to main 2026-10-01 (PR #198); 12 phases, 55 plans, 45/45 requirements. [Archive](milestones/v1.20-ROADMAP.md), [requirements](milestones/v1.20-REQUIREMENTS.md), [audit](milestones/v1.20-MILESTONE-AUDIT.md).
- ✅ **workflows-replay** — completed 2026-09-21, merged to main 2026-09-24 (PR #205). [Archive](milestones/ws-workflows-2026-09-27/milestones/workflows-replay-ROADMAP.md).
- ✅ **test-backlog** — completed 2026-09-18. [Archive](milestones/test-backlog-ROADMAP.md).
- ✅ **refine-unit-tests** — completed 2026-09-13. [Archive](milestones/refine-unit-tests-ROADMAP.md).
- ✅ **v1.19 Unit Test Refactor** — completed 2026-09-04. [Archive](milestones/v1.19-ROADMAP.md).

Earlier milestones remain in [MILESTONES.md](MILESTONES.md).

## Phases

<details>
<summary>✅ plugin-lifecycle — Marketplace and Plugin Lifecycle Backlog — SHIPPED 2026-10-29</summary>

- [x] Phase 1: Staging Warning Channels (8/8 plans)
- [x] Phase 2: Apply Ordering and Installed Declarations (6/6 plans)
- [x] Phase 3: Dependency Cascade Rows and Status (6/6 plans)
- [x] Phase 4: Dependency Resolver Residue (6/6 plans)
- [x] Phase 5: Marketplace Command Parity (9/9 plans)
- [x] Phase 6: Import Marketplace Planning (6/6 plans)
- [x] Phase 7: Git Errors and Lock Discipline (10/10 plans)
- [x] Phase 8: Background Autoupdate (4/4 plans)
- [x] Phase 9: Plugin Package Dependencies (5/5 plans)
- [x] Phase 10: Lifecycle Test and Harness Gaps (7/7 plans)
- [x] Phase 11: Cleanup, Split, and Docs (13/13 plans)

**Outcome:** 64/64 requirements, 11/11 phases, 12/12 integration groups, and 10/10 end-to-end flows pass. The audit has no blockers and carries only the accepted HOSTED-DNS-01 residual under D-PL5-31.

</details>

## Carried Forward

- `DEPADV-01` and `WOUT-01` remain in [BACKLOG.md](BACKLOG.md): Pi's shrinkwrap pins a nested `brace-expansion@5.0.9`, and workflow output is unobserved.
- Open user choice from json-output `09/` (D-03): the LLM tools return `isError: true`, which Pi 0.87.1 ignores; throwing a redacted Error instead would set Pi's error flag.
- `DBLEMIT-01`, `PSRC-01`, `USRCFG-01`, `MIGR-01`, and `NAMEFOLD-01` stay in [BACKLOG.md](BACKLOG.md), out of this milestone's scope.
- `HOSTED-DNS-01` remains accepted under D-PL5-31 until a hostname-resolution policy is designed and implemented.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md), and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).

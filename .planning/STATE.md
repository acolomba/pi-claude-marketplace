---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: completed
stopped_at: Phase 09 complete; v1.1 milestone ready for completion
last_updated: "2026-05-16T00:18:10.848Z"
last_activity: "2026-05-15 - Completed quick task 260515-tqx: fix these gaps"
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 8
  completed_plans: 8
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-13)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install. **Current focus:** v1.1 Reinstall Command

## Current Position

Phase: 09 of 2 (reinstall edge bulk ux)
Plan: 4 of 4
Status: Milestone complete
Last activity: 2026-05-15 - Completed quick task 260515-tqx: fix these gaps

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 40
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
| ----- | ----- | ----- | -------- |
| 01    | 7     | -     | -        |
| 02    | 6     | -     | -        |
| 04    | 10    | -     | -        |
| 05    | 10    | -     | -        |
| 07    | 6     | -     | -        |
| 08    | 4     | -     | -        |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

<!-- Updated after each plan completion -->

| Phase 07 P01 | 9 min | 3 tasks | 29 files |
| Phase 07 P02 | 4 min | 3 tasks | 9 files |
| Phase 07 P03 | 6 min | 2 tasks | 5 files |
| Phase 07 P04 | 11 min | 3 tasks | 10 files |
| Phase 07 P05 | 7 min | 3 tasks | 20 files |
| Phase 07 P06 | 2 min | 2 tasks | 4 files |
| Phase 08 P01 | 10 min | 2 tasks | 4 files |
| Phase 08 P02 | 12 min | 2 tasks | 8 files |
| Phase 08 P03 | 12 min | 2 tasks | 8 files |
| Phase 08 P04 | 23 min | 3 tasks | 5 files |
| Phase 09 P01 | 45 min | 3 tasks | 4 files |
| Phase 09 P02 | 35 min | 3 tasks | 6 files |
| Phase 09 P03 | 20 min | 3 tasks | 3 files |
| Phase 09 P04 | - | 4 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Recent decisions affecting current work:

- Initialization: Adopt PRD verbatim as V1 spec (1068 lines, ~100 requirements)
- Initialization: Skip `/gsd-map-codebase` (PRD §9 already documents V1 architecture)
- Initialization: Two scopes only (`user`, `project`); no Claude `local`
- Initialization: 12-char SHA-256 truncation locked as user contract (PI-7)
- Roadmap: Adopt synthesizer's 7-phase split (dependency-graph inside-out: foundations → primitives → bridges → marketplace orchestrators → plugin orchestrators → edge → integration)
- Roadmap: Phase ledger primitive lands in Phase 2 (transaction primitive, not Phase 5 use-case)
- Roadmap: `MARKERS.ts` and symlink-aware `assertPathInside` land in Phase 1 so they propagate to every later phase
- Roadmap: Gap 3 (component-path supplement vs. replace) resolved in Phase 5 as supplement-fix; documented as "behavior corrected vs. V1"
- [Phase 07]: Pi API imports now flow through platform/pi-api.ts; @mariozechner/pi-coding-agent peer floor is pinned to >=0.73.1. -- Plan 07-01 established the NFR-11 wrapper and peer-dependency floor.
- [Phase 07]: NFR-8 manifest mtime caching remains deferred; Plan 07-02 shipped only the domain read seam and architecture gate.
- [Phase 07]: Completion resolver manifest reads route through the same domain seam as marketplace and plugin orchestrators.
- [Phase 07]: [Phase 07]: resources_discover now reads staged skills/prompts directly from disk across user and project scopes; index.ts wires the real Pi command/tool/event surface. -- Plan 07-03 replaced the Phase 1 stub with real Pi wiring and made /reload discovery reflect disk state.
- [Phase 07]: withStateGuard now owns cross-process same-scope mutation safety via a fail-fast proper-lockfile `.state-lock` around load-mutate-save. -- Plan 07-04 satisfies NFR-3 retry safety for concurrent installs.
- [Phase 07]: Concurrent install race verification uses forked IPC children invoking the real `installPlugin` path and asserts state/disk alignment after one lock-held loser. -- Plan 07-04 established the multi-process test pattern.
- [Phase 07]: [Phase 07]: PR e2e now uses pinned upstream SHA 6196a61bdeece7b9889ecda1e45bd7085788ae75 while nightly e2e uses floating main for upstream drift classification. -- Plan 07-05 established deterministic PR e2e and separate nightly drift classification.
- [Phase 07]: [Phase 07]: Real Pi runtime smoke is automated through the installed pi package bin with isolated HOME/cwd, avoiding the blocked agent-core API path. -- Research found agent-core lacks extension-loading API, so the package-bin smoke is the automatable runtime gate.
- [Phase 07]: D-25 supersedes PI-15 old concurrent-install marker; lock losers fail at per-scope acquisition with `STATE_LOCK_HELD_PREFIX` and retry guidance. -- Plan 07-06 recorded the REQUIREMENTS/PROJECT/CHANGELOG traceability trail.
- [Phase 07]: Validation sign-off is approved; NFR-2, NFR-3, NFR-8, and NFR-11 map to green automated gates including real Pi-runtime smoke. -- Plan 07-06 closed the phase gate evidence.
- [Phase 08]: withLockedStateTransaction now exposes a lock-held manual-save state transaction using the same per-scope `.state-lock` semantics as withStateGuard. -- Plan 08-01 established the PRL-10 rollback foundation.
- [Phase 08]: reinstall.ts is architecture-gated before implementation against Git/network imports and refreshGitHubClone references. -- Plan 08-01 established the PRL-07 no-network guard.
- [Phase 08]: skills and commands bridges now expose rollback-safe replace/rollback/finalize helpers with opaque WeakMap-backed handles. -- Plan 08-02 established the PRL-09/PRL-10 backup replacement pattern for file and directory resources.
- [Phase 08]: agents and MCP bridges now expose rollback-safe replace/rollback/finalize helpers, including default foreign-agent blocking and force-mode restoration. -- Plan 08-03 completed the PRL-09/PRL-10 bridge replacement foundation.
- [Phase 08]: reinstallPlugin is a dedicated cached-manifest, version-preserving single-plugin core that returns structured outcomes for Phase 9 batch partitioning. -- Plan 08-04 completed PRL-02/06/07/08 and avoided uninstall+install/update wrappers.
- [Phase 08]: reinstallPlugin holds withLockedStateTransaction across prepare, bridge replacement, explicit state save, and rollback; data/cache cleanup failures are warning-only after commit. -- Plan 08-04 completed PRL-09/10/11/12.
- [Phase 09]: reinstallPlugins provides update-analogous bulk target forms, deterministic partitions, reload-hint aggregation, soft-dependency aggregation, and quiet single-plugin rendering for batch UX. -- Plan 09-01 completed PRL-03/04/05/13/14/15.
- [Phase 09]: /claude:plugin reinstall is routed, registered, documented, and completed with installed-only tab completion plus reinstall-specific --force. -- Plans 09-02/09-03/09-04 completed PRL-01/16 and final validation.

### Pending Todos

None yet.

### Blockers/Concerns

- Historical `write-file-atomic@^8` engine concern is resolved on main by v0.1.2: package engines now allow `>=20.19.0` and the dependency is `write-file-atomic@^7`.

### Quick Tasks Completed

| #          | Description                                                                                                      | Date       | Commit  | Status   | Directory                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------- | ---------- | ------- | -------- | ------------------------------------------------------------------------- |
| 260515-bkt | lets update the specs and the implementation to listen to PI_CODING_AGENT_DIR if set instead of hardcoding ~/.pi | 2026-05-14 | 0257577 | Verified | [260515-bkt-pi-coding-agent-dir](./quick/260515-bkt-pi-coding-agent-dir/) |
| 260515-tqx | fix these gaps | 2026-05-15 | 5d8fd1d | Verified | [260515-tqx-fix-these-gaps](./quick/260515-tqx-fix-these-gaps/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category                    | Item | Status | Deferred At |
| --------------------------- | ---- | ------ | ----------- |
| _(none -- first milestone)_ |      |        |             |

## Session Continuity

Last session: 2026-05-14T01:31:04.000Z
Stopped At: Phase 09 complete; v1.1 milestone ready for completion
Resume File: None

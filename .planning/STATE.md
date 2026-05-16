---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Milestone complete
last_updated: "2026-05-16T00:57:00.000Z"
last_activity: "2026-05-15 - Completed quick task 260515-wpe: clarify marketplace/plugin scope rules in specifications"
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 51
  completed_plans: 51
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-09)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install. **Current focus:** Phase 07 -- integration-pi-wiring

## Current Position

Phase: 07 of 7 (integration pi wiring)
Plan: 6 of 6

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 39
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
| ----- | ----- | ----- | -------- |
| 01 | 7 | - | - |
| 02 | 6 | - | - |
| 04 | 10 | - | - |
| 05 | 10 | - | - |
| 07 | 6 | - | - |

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
- [Quick 260515-wpe]: D-26 clarifies marketplace/plugin scope rules: project-target installs can source project marketplaces first and user marketplaces second; user-target installs can source only user marketplaces; dual-scope plugin installs are allowed; project scope takes precedence for unqualified single-target operations; install completion is available-only for the current target scope.

### Pending Todos

None yet.

### Blockers/Concerns

- Behavioral Gaps 1, 2, 5-10 (FEATURES Gap series) need explicit resolutions logged in PROJECT.md Key Decisions before Phase 4/5 planning. Gap 4 is resolved by PROJECT.md D-26 / PRD CMP-1..8.
- `write-file-atomic@^8` Node engine constraint bumps effective floor from 22.0 to 22.22.2; confirm CI Node range before adopting in Phase 1.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
| --- | --- | --- | --- | --- | --- |
| 260515-bkt | lets update the specs and the implementation to listen to PI_CODING_AGENT_DIR if set instead of hardcoding ~/.pi | 2026-05-14 | 0257577 | Verified | [260515-bkt-pi-coding-agent-dir](./quick/260515-bkt-pi-coding-agent-dir/) |
| 260515-wpe | clarify marketplace/plugin scope rules in specifications | 2026-05-15 | 0c271f8 | Complete | [260515-wpe-scope-rules](./quick/260515-wpe-scope-rules/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category                    | Item | Status | Deferred At |
| --------------------------- | ---- | ------ | ----------- |
| *(none -- first milestone)* |      |        |             |

## Session Continuity

Last activity: 2026-05-15 - Completed quick task 260515-wpe: clarify marketplace/plugin scope rules in specifications

Last session: 2026-05-11T20:42:58.893Z

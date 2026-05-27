---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Structured Notification Messages
status: planning
last_updated: "2026-05-27T14:59:36.936Z"
last_activity: 2026-05-27
progress:
  total_phases: 9
  completed_phases: 7
  total_plans: 33
  completed_plans: 33
  percent: 78
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install. **Current focus:** Phase 20 — migration wave 3    edge handlers & usageerror

## Current Position

Phase: 20
Plan: Not started
Status: Ready to plan
Last activity: 2026-05-27

## Performance Metrics

**Velocity:**

- Total plans completed: 93
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
| 12 | 4 | - | - |
| 13 | 10 | - | - |
| 14.1 | 2 | - | - |
| 14 | 6 | - | - |
| 14.2 | 5 | - | - |
| 15 | 3 | - | - |
| 16 | 6 | - | - |
| 17.2 | 4 | - | - |
| 18 | 7 | - | - |
| 19 | 6 | - | - |

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

### Roadmap Evolution

- Phase 14.1 inserted after Phase 14: Close gap: CMC-13 -- propagate declaresAgents/Mcp through import cascade rows (URGENT)
- Phase 14.2 inserted after Phase 14: Address tech debt: CR-01 + retroactive Phase 12 / 14.1 gates (URGENT)
- v1.4 roadmap (2026-05-25): 7 phases (15-21) created by `gsd-roadmapper`. All 32 SNM-* requirements mapped: SNM-01..11 + SNM-21 → Phase 15; SNM-12..18 + SNM-30 → Phase 16; SNM-19, SNM-20, SNM-31 → Phase 17; Phases 18 and 19 are execution-only migration waves (marketplace/* and plugin/* families) with no requirement closure; SNM-23 → Phase 20 (edge family wave + UsageError migration); SNM-22, SNM-24..29, SNM-32 → Phase 21 (final teardown + GREEN gate). SNM-22 maps to Phase 21 because its "wrappers deleted" half is the closure gate.
- Phase 17.1 inserted after Phase 17: V2 Grammar Amendment: Autoupdate Surface (URGENT)
- Phase 17.2 inserted after Phase 17: renderScopeBracket orphan-fold contract fix (URGENT)

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
- [Roadmap v1.3]: D-30 locks `docs/messaging-style-guide.md` v1.0 + `docs/output-catalog.md` as the v1.3 user-contract, superseding PRD §6.12 ES-5 marker strings.
- [Roadmap v1.3]: v1.3 phases = 12 (Foundations) + 13 (Conformance Refactor & ES-5) + 14 (Drift Guard). 38/38 CMC requirements mapped (CMC-08/11/14/19/36/37 → Phase 12; CMC-01..07/09/10/12/13/15..18/20/21/22..34/35 → Phase 13; CMC-38 → Phase 14).
- [Roadmap v1.3]: ES-5 atomic three-file edit (`shared/markers.ts` + `tests/architecture/markers-snapshot.test.ts` + PRD §6.12) lives in Phase 13 (CMC-35) per style guide §15 supersession contract -- snapshot test's prefix-extraction shape is structurally incompatible with new tokenised forms, so the deferral is mandatory.
- [Roadmap v1.3]: Drift guard reads style-guide YAML frontmatter as binding contract (no duplicated lists in test code); placed last because it asserts conformance for every callsite.
- [Roadmap v1.4]: 7-phase split (15-21): types → renderer → spec → 3 migration waves (marketplace, plugin, edge+UsageError) → final teardown. SNM-22 closure deferred to Phase 21 because the "V1 wrappers deleted" half cannot land until all migration waves complete. Phases 18 and 19 are execution phases without REQ closure -- their success criteria (zero V1 callers in family, narrowed lint glob, catalog UAT GREEN for family) prove incremental progress toward SNM-22 closure in Phase 21.

### Pending Todos

None yet.

### Blockers/Concerns

- Historical `write-file-atomic@^8` engine concern is resolved on main by v0.1.2: package engines now allow `>=20.19.0` and the dependency is `write-file-atomic@^7`.

### Quick Tasks Completed

| #          | Description                                                                                                      | Date       | Commit  | Status   | Directory                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------- | ---------- | ------- | -------- | ------------------------------------------------------------------------- |
| 260515-bkt | lets update the specs and the implementation to listen to PI_CODING_AGENT_DIR if set instead of hardcoding ~/.pi | 2026-05-14 | 0257577 | Verified | [260515-bkt-pi-coding-agent-dir](./quick/260515-bkt-pi-coding-agent-dir/) |
| 260515-tqx | fix these gaps | 2026-05-15 | 5d8fd1d | Verified | [260515-tqx-fix-these-gaps](./quick/260515-tqx-fix-these-gaps/) |
| 260522-c80 | patch PROJECT.md to close requirements-section gaps surfaced during Phase 12 discuss-phase | 2026-05-22 | 39f6611 |  | [260522-c80-patch-project-md-to-close-requirements-s](./quick/260522-c80-patch-project-md-to-close-requirements-s/) |
| 260525-aub | Replace free-text Error.message parsing in install/update/remove orchestrators with typed PluginShapeError dispatch (eliminates SonarCloud S5852 ReDoS hotspot; closes v1.3 pattern hole) | 2026-05-25 | da04709 |  | [260525-aub-replace-free-text-error-message-parsing-](./quick/260525-aub-replace-free-text-error-message-parsing-/) |
| 260525-cjr | Apply PR #22 review fixes: 5 comment fixes, 2 silent-failure catches, declaresAgents/Mcp required, 4 narrowReason migrations, drift architecture test, plus 10 polish items | 2026-05-25 | c79b6bc |  | [260525-cjr-apply-pr-22-review-fixes-5-comment-fixes](./quick/260525-cjr-apply-pr-22-review-fixes-5-comment-fixes/) |

## Deferred Items

Items acknowledged and deferred at v1.3 milestone close on 2026-05-25:

| Category    | Item                                                  | Status                       | Deferred At |
| ----------- | ----------------------------------------------------- | ---------------------------- | ----------- |
| quick_task  | 260515-bkt-pi-coding-agent-dir                        | complete (frontmatter stale) | 2026-05-25  |
| quick_task  | 260515-cmp-scope-rules-implementation                 | complete (frontmatter stale) | 2026-05-25  |
| quick_task  | 260515-tqx-fix-these-gaps                             | complete (frontmatter stale) | 2026-05-25  |
| quick_task  | 260515-wpe-scope-rules                                | complete (frontmatter stale) | 2026-05-25  |
| quick_task  | 260516-02r-implement-claude-plugin-bootstrap-comman   | complete (frontmatter stale) | 2026-05-25  |
| quick_task  | 260516-08j-modify-agent-mapping-logic-to-omit-model   | complete (frontmatter stale) | 2026-05-25  |
| quick_task  | 260522-c80-patch-project-md-to-close-requirements-s   | complete (frontmatter stale) | 2026-05-25  |

All seven quick tasks have a SUMMARY.md and are completed; the `audit-open` query flags them as `missing` because their SUMMARY.md frontmatter lacks a `status:` field (pre-canonical-frontmatter format). No follow-up work; acknowledged as deferred at v1.3 close.

## Session Continuity

Last session: 2026-05-27T14:59:36.918Z
Stopped At: Phase 20 context gathered
Resume File: .planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-CONTEXT.md

## Operator Next Steps

- Run `/gsd-plan-phase 15` to plan Phase 15 (Type Model & ADR Refresh).

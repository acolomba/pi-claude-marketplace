---
gsd_state_version: "1.0"
milestone: refine-unit-tests
milestone_name: Refine Unit Tests
current_phase: 05
current_phase_name: Injection and Ownership Design
status: executing
stopped_at: Completed Phase 05 Wave 8 through 05-14-PLAN.md
last_updated: "2026-09-08T03:11:28.871Z"
last_activity: 2026-09-08
last_activity_desc: Phase 05 Plan 14 complete; enable and disable use lifecycle routing
state_head: f1899be569c764f5bd19b8f7e77d951a0e0d2ced
progress:
  total_phases: 9
  completed_phases: 3
  total_plans: 127
  completed_plans: 108
  percent: 33
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-07 after refine-unit-tests Phase 4)

**Core value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

**Current focus:** Phase 05 — Injection and Ownership Design

## Current Position

Phase: 05 (Injection and Ownership Design) — EXECUTING
Next: Execute Phase 5
Plan: 15 of 33
Status: Ready to execute
Last activity: 2026-09-08 — Phase 05 Plan 14 complete; enable and disable use lifecycle routing

## Performance Metrics

**Velocity:**

- Total plans completed: 244
- Average recorded duration: 12.4 min
- Total recorded execution time: 35 hr 10 min

**By Phase:**

| Phase                           | Plans | Total            | Avg/Plan          |
| ------------------------------- | ----: | ---------------- | ----------------- |
| 108. Domain and Platform        |    23 | 10h 58m          | 28.6 min          |
| 109. Shared Contracts           |    19 | 3h 19m           | 10.5 min          |
| 110                             |    12 | -                | -                 |
| 111. Non-Hook Component Bridges |    31 | -                | -                 |
| 112. Hook Runtime               |    31 | 7h 58m           | 15.4 min          |
| 113. Orchestrator Support       |    35 | 7h 46m recorded  | 16.6 min recorded |
| 01. Live Evidence Revalidation  |    69 | 15h 18m recorded | 13.3 min recorded |
| 02                              |     3 | -                | -                 |
| 03                              |    14 | -                | -                 |
| 04                              |     7 | -                | -                 |

**Recent Trend:** Phase 04 closed four hermeticity, auth-fidelity, and typed-collaborator requirements in seven plans; independent verification passed 4/4 and the complete gate passed 5,397 unit plus 32 integration tests.
**Per-Plan Metrics:**

| Plan                                    | Duration | Tasks   | Files    |
| --------------------------------------- | -------- | ------- | -------- |
| Phase 116 P19                           | 45 min   | 1 tasks | 1 files  |
| Phase 116 P15                           | 40 min   | 1 tasks | 1 files  |
| Phase 116 P14                           | 45 min   | 1 tasks | 1 files  |
| Phase 108 P01                           | 10 min   | 2 tasks | 1 files  |
| Phase 108 P06                           | 18 min   | 3 tasks | 7 files  |
| Phase 108 P08                           | 13 min   | 2 tasks | 1 files  |
| Phase 108 P09                           | 15 min   | 2 tasks | 1 files  |
| Phase 108 P10                           | 12 min   | 2 tasks | 1 files  |
| Phase 108 P11                           | 14 min   | 2 tasks | 1 files  |
| Phase 108 P13                           | 14 min   | 2 tasks | 1 files  |
| Phase 108 P14                           | 10 min   | 2 tasks | 1 files  |
| Phase 108 P15                           | 10 min   | 2 tasks | 1 files  |
| Phase 108 P16                           | 16 min   | 2 tasks | 1 files  |
| Phase 108 P17                           | 26 min   | 2 tasks | 1 files  |
| Phase 108 P19                           | 28 min   | 3 tasks | 5 files  |
| Phase 108 P20                           | 12 min   | 2 tasks | 1 files  |
| Phase 108 P18                           | 43 min   | 3 tasks | 8 files  |
| Phase 108 P21                           | 3h 40m   | 3 tasks | 9 files  |
| Phase 108 P12                           | 27 min   | 3 tasks | 5 files  |
| Phase 108 P22                           | 42 min   | 3 tasks | 8 files  |
| Phase 108 P02                           | 20 min   | 3 tasks | 7 files  |
| Phase 108 P03                           | 19 min   | 3 tasks | 8 files  |
| Phase 108 P04                           | 22 min   | 3 tasks | 5 files  |
| Phase 108 P05                           | 20 min   | 3 tasks | 8 files  |
| Phase 108 P07                           | 27 min   | 3 tasks | 9 files  |
| Phase 108 P23                           | 20 min   | 3 tasks | 5 files  |
| Phase 109 P01                           | 7 min    | 2 tasks | 1 files  |
| Phase 109 P02                           | 10 min   | 2 tasks | 1 files  |
| Phase 109 P03                           | 12 min   | 2 tasks | 1 files  |
| Phase 109 P04                           | 7 min    | 2 tasks | 1 files  |
| Phase 109 P05                           | 5 min    | 2 tasks | 1 files  |
| Phase 109 P06                           | 7 min    | 2 tasks | 1 files  |
| Phase 109 P07                           | 16min    | 2 tasks | 1 files  |
| Phase 109 P08                           | 6min     | 2 tasks | 1 files  |
| Phase 109 P09                           | 19 min   | 2 tasks | 2 files  |
| Phase 109 P10                           | 9 min    | 2 tasks | 1 files  |
| Phase 109 P11                           | 6 min    | 2 tasks | 1 files  |
| Phase 109 P12                           | 12 min   | 2 tasks | 1 files  |
| Phase 109 P13                           | 6 min    | 2 tasks | 1 files  |
| Phase 109 P14                           | 40 min   | 3 tasks | 9 files  |
| Phase 109 P15                           | 6 min    | 2 tasks | 1 files  |
| Phase 109 P16                           | 9 min    | 2 tasks | 1 files  |
| Phase 109 P17                           | 11 min   | 2 tasks | 1 files  |
| Phase 109 P18                           | 4 min    | 2 tasks | 1 files  |
| Phase 109 P19                           | 7 min    | 2 tasks | 1 files  |
| Phase 110 P02                           | 11 min   | 2 tasks | 1 files  |
| Phase 110 P06                           | 7 min    | 2 tasks | 1 files  |
| Phase 110 P11                           | 7 min    | 2 tasks | 1 files  |
| Phase 110 P01                           | 8min     | 2 tasks | 1 files  |
| Phase 110 P03                           | 11 min   | 2 tasks | 1 files  |
| Phase 110 P05                           | 10 min   | 2 tasks | 1 files  |
| Phase 110 P08                           | 10min    | 2 tasks | 2 files  |
| Phase 110 P10                           | 9 min    | 2 tasks | 1 files  |
| Phase 110 P04                           | 11 min   | 2 tasks | 1 files  |
| Phase 110 P07                           | 16 min   | 2 tasks | 2 files  |
| Phase 110 P09                           | 19 min   | 2 tasks | 3 files  |
| Phase 110 P12                           | 17 min   | 2 tasks | 1 files  |
| Phase 111 P01                           | 14 min   | 2 tasks | 2 files  |
| Phase 111 P02                           | 10 min   | 2 tasks | 1 files  |
| Phase 112 P01                           | 14 min   | 2 tasks | 1 files  |
| Phase 112 P03                           | 9 min    | 2 tasks | 1 files  |
| Phase 112 P08                           | 8 min    | 2 tasks | 1 files  |
| Phase 112 P09                           | 9 min    | 2 tasks | 1 files  |
| Phase 112 P10                           | 14 min   | 2 tasks | 1 files  |
| Phase 112 P12                           | 12 min   | 2 tasks | 1 files  |
| Phase 112 P15                           | 6 min    | 2 tasks | 1 files  |
| Phase 112 P16                           | 7 min    | 2 tasks | 1 files  |
| Phase 112 P17                           | 7 min    | 2 tasks | 1 files  |
| Phase 112 P18                           | 3 min    | 2 tasks | 1 files  |
| Phase 112 P19                           | 5 min    | 2 tasks | 1 files  |
| Phase 112 P20                           | 5 min    | 2 tasks | 1 files  |
| Phase 112 P21                           | 8 min    | 2 tasks | 1 files  |
| Phase 112 P22                           | 20 min   | 2 tasks | 1 files  |
| Phase 112 P23                           | 10 min   | 2 tasks | 1 files  |
| Phase 112 P24                           | 10 min   | 2 tasks | 1 files  |
| Phase 112 P27                           | 19 min   | 2 tasks | 1 files  |
| Phase 112 P28                           | 28 min   | 2 tasks | 3 files  |
| Phase 112 P29                           | 13 min   | 2 tasks | 1 files  |
| Phase 112 P30                           | 17 min   | 2 tasks | 1 files  |
| Phase 112 P31                           | 17 min   | 2 tasks | 1 files  |
| Phase 112 P11                           | 14 min   | 2 tasks | 2 files  |
| Phase 112 P13                           | 20 min   | 2 tasks | 2 files  |
| Phase 112 P25                           | 12 min   | 2 tasks | 1 files  |
| Phase 112 P02                           | 45 min   | 2 tasks | 3 files  |
| Phase 112 P06                           | 26 min   | 2 tasks | 3 files  |
| Phase 112 P04                           | 33 min   | 2 tasks | 3 files  |
| Phase 112 P05                           | 18 min   | 2 tasks | 2 files  |
| Phase 112 P26                           | 19 min   | 2 tasks | 2 files  |
| Phase 112 P07                           | 34 min   | 2 tasks | 3 files  |
| Phase 112 P14                           | 16 min   | 2 tasks | 1 file   |
| Phase 115 P02                           | 96 min   | 3 tasks | 2 files  |
| Phase 115 P05                           | 90min    | 3 tasks | 5 files  |
| Phase 116 P00                           | 35 min   | 2 tasks | 5 files  |
| Phase 116 P01                           | 25 min   | 1 tasks | 1 files  |
| Phase 116 P02                           | 20 min   | 1 tasks | 1 files  |
| Phase 116 P04                           | 25 min   | 1 tasks | 1 files  |
| Phase 116 P06                           | 65 min   | 1 tasks | 3 files  |
| Phase 116 P30                           | 40 min   | 1 tasks | 1 files  |
| Phase 116 P12                           | 45 min   | 1 tasks | 1 files  |
| Phase 116 P23                           | 50 min   | 1 tasks | 1 files  |
| Phase 116 P26                           | 45 min   | 1 tasks | 1 files  |
| Phase 116 P27                           | 70 min   | 2 tasks | 2 files  |
| Phase 116 P29                           | 20 min   | 1 tasks | 1 files  |
| Phase 116 P03                           | 45 min   | 1 tasks | 1 files  |
| Phase 116 P10                           | 45 min   | 1 tasks | 1 files  |
| Phase 116 P13                           | 50 min   | 1 tasks | 1 files  |
| Phase 116 P07                           | 35 min   | 1 tasks | 1 files  |
| Phase 116 P11                           | 35 min   | 1 tasks | 1 files  |
| Phase 116 P05                           | 30 min   | 1 tasks | 1 files  |
| Phase 116 P17                           | 40 min   | 2 tasks | 1 files  |
| Phase 116 P28                           | 30 min   | 1 tasks | 1 files  |
| Phase 117 P01                           | 11 min   | 1 tasks | 1 files  |
| Phase 117 P02                           | 15 min   | 2 tasks | 10 files |
| Phase 117 P03                           | 16 min   | 1 tasks | 27 files |
| Phase 117 P04                           | 22 min   | 2 tasks | 2 files  |
| Phase 117 P05                           | 9 min    | 1 tasks | 2 files  |
| Phase 117 P06                           | 13 min   | 1 tasks | 2 files  |
| Phase 117 P07                           | 28 min   | 2 tasks | 17 files |
| Phase 117 P08                           | 22 min   | 2 tasks | 4 files  |
| Phase 117 P09                           | 13 min   | 1 tasks | 2 files  |
| Phase 117 P10                           | 12 min   | 1 tasks | 1 files  |
| Phase 117 P11                           | 50 min   | 1 tasks | 4 files  |
| Phase 117 P11                           | 2h 20m   | 2 tasks | 16 files |
| Phase 01 P01                            | 28 min   | 3 tasks | 7 files  |
| Phase 01 P02                            | 10 min   | 2 tasks | 2 files  |
| Phase 01 P03                            | 18min    | 3 tasks | 2 files  |
| Phase 01 P04                            | 4min     | 2 tasks | 2 files  |
| Phase 01 P05                            | 5min     | 1 tasks | 2 files  |
| Phase 01 P06                            | 10min    | 2 tasks | 2 files  |
| Phase 01 P07                            | 6min     | 1 tasks | 2 files  |
| Phase 01 P08                            | 12min    | 2 tasks | 1 files  |
| Phase 01 P09                            | 15min    | 2 tasks | 2 files  |
| Phase 01 P10                            | 6min     | 2 tasks | 1 files  |
| Phase 01 P11                            | 8min     | 1 tasks | 1 files  |
| Phase 01 P12                            | 12min    | 2 tasks | 1 files  |
| Phase 01 P13                            | 12min    | 1 tasks | 1 files  |
| Phase 01 P14                            | 17min    | 2 tasks | 1 files  |
| Phase 01 P15                            | 8min     | 1 tasks | 1 files  |
| Phase 01 P16                            | 15min    | 2 tasks | 2 files  |
| Phase 01 P17                            | 10min    | 2 tasks | 1 files  |
| Phase 01 P18                            | 5min     | 2 tasks | 1 files  |
| Phase 01 P19                            | 12min    | 1 tasks | 1 files  |
| Phase 01 P20                            | 6min     | 2 tasks | 1 files  |
| Phase 01 P21                            | 8min     | 2 tasks | 1 files  |
| Phase 01 P22                            | 7min     | 1 tasks | 1 files  |
| Phase 01 P23                            | 5min     | 2 tasks | 1 files  |
| Phase 01 P24                            | 6min     | 2 tasks | 2 files  |
| Phase 01 P25                            | 5min     | 1 tasks | 2 files  |
| Phase 01 P26                            | 27min    | 2 tasks | 2 files  |
| Phase 01 P27                            | 18min    | 2 tasks | 1 files  |
| Phase 01 P28                            | 25min    | 2 tasks | 1 files  |
| Phase 01 P29                            | 8min     | 2 tasks | 2 files  |
| Phase 01 P30                            | 8min     | 2 tasks | 1 files  |
| Phase 01 P31                            | 12min    | 2 tasks | 1 files  |
| Phase 01 P32                            | 14min    | 1 tasks | 1 files  |
| Phase 01 P33                            | 10min    | 2 tasks | 1 files  |
| Phase 01 P34                            | 10min    | 2 tasks | 2 files  |
| Phase 01 P35                            | 14min    | 2 tasks | 2 files  |
| Phase 01 P36                            | 5min     | 1 tasks | 2 files  |
| Phase 01-live-evidence-revalidation P37 | 10min    | 2 tasks | 1 files  |
| Phase 01-live-evidence-revalidation P38 | 12min    | 2 tasks | 1 files  |
| Phase 01-live-evidence-revalidation P39 | 15min    | 1 tasks | 1 files  |
| Phase 01-live-evidence-revalidation P40 | 18min    | 3 tasks | 2 files  |
| Phase 01 P41                            | 12min    | 3 tasks | 5 files  |
| Phase 01 P42                            | 8min     | 3 tasks | 5 files  |
| Phase 01 P43                            | 8min     | 3 tasks | 5 files  |
| Phase 01 P44                            | 7min     | 3 tasks | 5 files  |
| Phase 01 P45                            | 10min    | 3 tasks | 5 files  |
| Phase 01 P46                            | 11min    | 3 tasks | 5 files  |
| Phase 01 P47                            | 16min    | 3 tasks | 5 files  |
| Phase 01 P48                            | 11min    | 3 tasks | 5 files  |
| Phase 01 P49                            | 16min    | 3 tasks | 5 files  |
| Phase 01 P51                            | 11min    | 3 tasks | 5 files  |
| Phase 01 P52                            | 7min     | 3 tasks | 5 files  |
| Phase 01 P53                            | 8min     | 3 tasks | 5 files  |
| Phase 01 P54                            | 10min    | 2 tasks | 5 files  |
| Phase 01 P55                            | 18min    | 3 tasks | 21 files |
| Phase 01 P56                            | 12min    | 1 tasks | 3 files  |
| Phase 01 P57                            | 1h 43m   | 1 tasks | 3 files  |
| Phase 01 P58                            | 58min    | 1 tasks | 5 files  |
| Phase 01 P59                            | 3min     | 1 tasks | 3 files  |
| Phase 01 P60                            | 18min    | 1 tasks | 3 files  |
| Phase 01 P61                            | 17min    | 1 tasks | 3 files  |
| Phase 01 P62                            | 24min    | 1 tasks | 3 files  |
| Phase 01 P63                            | 16min    | 1 tasks | 3 files  |
| Phase 01 P64                            | 1h 17m   | 1 tasks | 3 files  |
| Phase 01 P65                            | 19min    | 1 tasks | 3 files  |
| Phase 01 P66                            | 23min    | 1 tasks | 3 files  |
| Phase 01 P67                            | 14min    | 1 tasks | 3 files  |
| Phase 01 P68                            | 9min     | 1 tasks | 4 files  |
| Phase 01 P69                            | 31min    | 1 tasks | 27 files |
| Phase 02 P01                            | 18min    | 2 tasks | 6 files  |
| Phase 02 P02                            | 17min    | 2 tasks | 5 files  |
| Phase 02 P03                            | 13min    | 2 tasks | 2 files  |
| Phase 01 P70                            | 19min    | 2 tasks | 3 files  |
| Phase 03 P01                            | 183min   | 2 tasks | 4 files  |
| Phase 03 P02                            | 13min    | 2 tasks | 8 files  |
| Phase 03 P04                            | 3min     | 2 tasks | 6 files  |
| Phase 03 P05                            | 2min     | 2 tasks | 6 files  |
| Phase 03 P08                            | 7min     | 2 tasks | 8 files  |
| Phase 03 P13                            | 10min    | 3 tasks | 6 files  |
| Phase 03 P03                            | 13min    | 3 tasks | 11 files |
| Phase 03 P06                            | 6min     | 2 tasks | 2 files  |
| Phase 03 P12                            | 8min     | 2 tasks | 4 files  |
| Phase 03 P14                            | 9min     | 2 tasks | 3 files  |
| Phase 03 P07                            | 34min    | 3 tasks | 9 files  |
| Phase 03 P10                            | 9min     | 2 tasks | 10 files |
| Phase 03 P09                            | 12min    | 2 tasks | 11 files |
| Phase 03 P11                            | 34min    | 2 tasks | 11 files |
| Phase 05 P01                            | 28min    | 2 tasks | 4 files  |
| Phase 05 P02                            | 33min    | 2 tasks | 8 files  |
| Phase 05 P03                            | 24min    | 2 tasks | 4 files  |
| Phase 05 P04                            | 21min    | 2 tasks | 2 files  |
| Phase 05 P05                            | 32min    | 2 tasks | 8 files  |
| Phase 05 P06                            | 31min    | 2 tasks | 4 files  |
| Phase 05 P07                            | 33min    | 2 tasks | 9 files  |
| Phase 05 P08                            | 25min    | 2 tasks | 7 files  |
| Phase 05 P09                            | 33min    | 2 tasks | 7 files  |
| Phase 05 P09                            | 37min    | 2 tasks | 7 files  |
| Phase 05 P10                            | 43 min   | 2 tasks | 8 files  |
| Phase 05 P11                            | 23 min   | 2 tasks | 10 files |
| Phase 05 P12                            | 30 min   | 2 tasks | 12 files |
| Phase 05 P13                            | 31 min   | 2 tasks | 20 files |
| Phase 05 P14                            | 30 min   | 2 tasks | 5 files  |

## Accumulated Context

### Decisions

Decisions are logged in the PROJECT.md Key Decisions table.

- Each executable plan and implementation commit owns one source-test pair.
- Runtime tests use separate lowercase `// arrange`, `// act`, and `// assert` phases.
- Lowercase `// act & assert` is reserved for one `assert.throws()` or `assert.rejects()` expression.
- Type-only evidence stays module-scoped and uses `satisfies` or `@ts-expect-error` without fake runtime phases.
- Retained commits and HEAD triage labels do not close a pair.
- [Phase 110]: Kept agents-index-schema.ts byte-identical because its compiled validators expose the complete public contract.
- [Phase 110]: Agents-index schema evidence uses independent literals plus module-scope satisfies and targeted @ts-expect-error checks.
- [Phase 110]: Kept locations.ts byte-identical because its public seams expose the complete contract.
- [Phase 110]: Locations evidence uses complete bundles and adjacent safe-path probes with platform-aware separators.
- [Phase 110]: Kept rollback.ts byte-identical because its public formatter exposes every bypass and wrapping branch.
- [Phase 110]: Rollback evidence compares whole structured results before pinning original cause and raw partial identities.
- [Phase 110]: Kept agents-index-io.ts byte-identical because its public load and save functions expose every real branch.
- [Phase 110]: Agents-index I/O evidence uses case-owned literal documents, complete loaded values, structured failures, and exact stored bytes.
- [Phase 110]: Kept config-io.ts byte-identical because its public loader, validator, predicate, and saver expose every real branch.
- [Phase 110]: Config I/O evidence uses independent literal documents, complete load results, and unchanged bytes across validation and containment failures.
- [Phase 110]: Kept config-write-back.ts byte-identical because its five public operations expose every real write-back branch.
- [Phase 110]: Config write-back evidence uses independent complete JSON bytes for patches, deletes, cascades, omitted batch arms, and absent-entry creation.
- [Phase 110]: Refined MigrationResult.marketplaces to object-valued rows while preserving migration runtime logic and exports.
- [Phase 110]: Kept invalid plugin rows unfilled so the downstream state schema remains the rejection boundary instead of silently coercing corrupt values.
- [Phase 110]: Migration evidence uses complete independent results, exact fixed-point replay, and complete warning and filesystem effects.
- [Phase 110]: Kept phase-ledger.ts byte-identical because runPhases exposes every compensation and error branch through its public contract.
- [Phase 110]: Phase-ledger evidence uses the literal skills, commands, agents, hooks, mcp, state order with complete logs, results, causes, leaks, and final context.
- [Phase 110]: Kept config-merge.ts byte-identical because its two public functions expose every real merge and load branch.
- [Phase 110]: Used independent complete reducer values and all nine base/local status pairs to keep provenance and fallback behavior explicit.
- [Phase 110]: Narrowed buildConfigFromState with an inline intersection return type so existing exports stay unchanged while marketplace and plugin records become statically present.
- [Phase 110]: Removed only the redundant entry-count fallbacks and left migration runtime ordering, stored bytes, and result arms unchanged.
- [Phase 110]: Used independent complete state and config values plus exact bytes and metadata to prove first-run replay without sleeps or shared fixtures.
- [Phase 110]: Removed the redundant post-migration marketplace guard and assertion because Plan 110-08 guarantees object-valued MigrationResult rows.
- [Phase 110]: State migration persistence uses a pre-registered case-local filesystem watcher and exact file metadata to prove no-write replay without sleeps or polling.
- [Phase 110]: Kept with-state-guard.ts byte-identical because its public state operations and lockfile collaborator expose every real lifecycle branch.
- [Phase 110]: Used entered and release promises to prove real lock contention without sleeps, polling, elapsed-time checks, or platform skips.
- [Phase 110]: Used the existing loadState and saveState dependency seam for deterministic persistence failures and case-local proper-lockfile method restoration for acquisition and release failures.
- [Phase 111]: Every mirrored owner uses complete case-local inputs and independent expected outcomes; shared fixtures were removed after their last legitimate consumer.
- [Phase 111]: Supplemental suites remain only for genuine cross-module behavior, and all 31 direct owner gates pass at complete line, branch, and function coverage.
- [Phase 111]: MCP provenance markers require own outer and identity properties, rejecting inherited marker, plugin, and marketplace values.
- [Phase 111]: Two provably unreachable private skills-stage fallbacks were removed without adding a test-only seam, export, pragma, or behavior change.
- [Phase 112]: Kept pid-table.ts byte-for-byte unchanged and covered every branch through its public filesystem contract.
- [Phase 112]: Used a case-owned _shared regular-file boundary for deterministic filesystem failures without a test seam.
- [Phase 112]: Kept ring-buffer.ts byte-for-byte unchanged and proved every byte boundary through its public API.
- [Phase 112]: RingBuffer evidence uses fresh case-local byte inputs and independent complete text/truncation outcomes.
- [Phase 112]: Kept exec-result.ts byte-for-byte unchanged because its exported type and assertNever function expose the complete contract.
- [Phase 112]: Kept all HookExecResult positive and negative type evidence at module scope, with runtime execution only for assertNever.
- [Phase 112]: Proved allow, deny, and ask inline without introducing a new permission type export.
- [Phase 112]: Kept exec-timer.ts byte-for-byte unchanged because its public timer ladder exposes every scheduling branch.
- [Phase 112]: Observed exact handles, unref calls, clears, and pending state through the current TestContext fake timers only.
- [Phase 112]: Kept hook-env.ts byte-for-byte unchanged because prepareHookEnv exposes every environment branch through its public contract.
- [Phase 112]: Hook environment evidence preserves inherited-key non-interference while proving case-local remote-key absence and exact process restoration.
- [Phase 112]: Kept glob.ts byte-for-byte unchanged because its public compiled Bash and path objects expose every matching and defensive branch.
- [Phase 112]: Glob owner evidence uses complete independent metadata and named outcome maps for command boundaries, six anchors, normalization, containment, and globstar behavior.
- [Phase 112]: Covered defensive sparse and unknown compiled metadata through exported objects with Reflect, without casts, test seams, or production surface changes.
- [Phase 112]: Kept post-compact.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: Replaced the incomplete double assertion with complete SessionCompactEvent values checked by satisfies.
- [Phase 112]: Treated empty strings as valid context values and did not fabricate an out-of-contract null case.
- [Phase 112]: Kept post-tool-use-failure.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: PostToolUseFailure owner evidence uses complete ToolResultEvent values, independent whole envelopes, and nested identity and non-mutation assertions.
- [Phase 112]: Kept malformed process output in Plan 112-04 and left the translator supplemental suite unchanged.
- [Phase 112]: Kept post-tool-use.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: Replaced PostToolUse double assertions and shared context with complete case-local values checked by satisfies.
- [Phase 112]: Kept malformed PostToolUse process output in Plan 112-04 and left the translator supplemental suite unchanged.
- [Phase 112]: Kept pre-compact.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: Replaced the PreCompact double assertion and shared context with complete case-local values checked by satisfies.
- [Phase 112]: Treated empty strings as valid PreCompact context values and did not add an unsupported null context case.
- [Phase 112]: Kept pre-tool-use.ts byte-for-byte unchanged because translate exposes the complete payload contract.
- [Phase 112]: PreToolUse evidence uses independent built-in and custom six-key envelopes with nested identity and non-mutation checks.
- [Phase 112]: Kept malformed PreToolUse input in Plan 112-04 and left the translator supplemental suite unchanged.
- [Phase 112]: Kept session-end.ts byte-for-byte unchanged because translate exposes the complete SessionEnd payload contract through its public signature.
- [Phase 112]: Used one explicit case per shutdown reason plus a dedicated empty-context case, with input-only target session files omitted from exact five-key envelopes.
- [Phase 112]: Kept malformed SessionEnd input in Plan 112-04 and left the supplemental translator suite unchanged.
- [Phase 112]: Kept session-start.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: SessionStart evidence uses independent whole envelopes for every source branch and accepted empty context values.
- [Phase 112]: Kept stop-failure.ts byte-for-byte unchanged because its public translator and classifier expose the complete contract.
- [Phase 112]: Used explicit sibling cases for classifier precedence and status partitions instead of a shared table or test seam.
- [Phase 112]: Kept object and cause wrapping in Plan 112-27 instead of expanding the StopFailure owner scope.
- [Phase 112]: Kept stop.ts byte-for-byte unchanged because its public translator exposes the complete contract.
- [Phase 112]: Used separate case-local values and whole six-key expectations for active, inactive, and empty-text Stop partitions.
- [Phase 112]: Kept Stop re-entry and observer behavior in Plan 112-26 instead of widening the direct payload owner.
- [Phase 112]: Kept user-prompt-submit.ts byte-for-byte unchanged because its public translator exposes the complete contract.
- [Phase 112]: UserPromptSubmit evidence uses separate case-local values and whole five-key expectations for ordinary, multi-line, empty, and multi-byte prompts.
- [Phase 112]: Kept malformed process-output behavior in Plan 112-04 instead of widening the direct payload owner.
- [Phase 112]: Preserved spawn planning while the security gate strengthened oversized serialization to a strict final 256 KiB UTF-8 bound.
- [Phase 112]: Treated defined args, including an empty array, as exec form with shell disabled; absent args retain shell-form behavior.
- [Phase 112]: Made the truncation marker authoritative without mutating object, primitive, or array inputs and bounded the final UTF-8 output, including metadata, to 256 KiB.
- [Phase 112]: Removed only the private stage stack-pop undefined guard after live CodeGraph proof established that its guarded state is unreachable.
- [Phase 112]: Retained readSymlinkTargetSafe as a reachable TOCTOU defense and proved it through restored Node filesystem bindings without a production seam.
- [Phase 112]: Absorbed the symlink supplemental's unique containment evidence into the stage owner before deleting the duplicate carrier.
- [Phase 112]: Kept timeout.ts byte-for-byte unchanged because resolveTimeoutSeconds exposes every validation, default, and diagnostic branch through its public contract.
- [Phase 112]: Preserved every finite positive value exactly, including fractional and large values, while rejecting zero, negative, nonnumeric, and nonfinite declarations.
- [Phase 112]: Kept scheduling, timer clamping, cancellation, and races in Plan 112-09 instead of widening this pure validation owner.
- [Phase 112]: Kept translation-context.ts byte-for-byte unchanged because buildTranslationContext exposes the complete snapshot and fallback contract through its public result.
- [Phase 112]: Used real case-owned file-backed and in-memory SessionManager instances with independently authored whole-context expectations.
- [Phase 112]: Kept translation-context readonly evidence at module scope and preserved its internal-only barrel scope.
- [Phase 112]: Kept wire-protocol.ts byte-for-byte unchanged because parseHookStdout exposes every live exit, JSON-shape, precedence, mutation, and no-op branch through its public result.
- [Phase 112]: Proved semantic diagnostics by category, hook destination, relevant detail, and outcome while separately asserting that reporting never throws.
- [Phase 112]: Kept every wire case independent and explicit instead of generalizing the mutation contract through a table or shared oracle.
- [Phase 112]: Restored documented stable first-seen Bash candidate deduplication with only a Set spread after direct evidence exposed the missing behavior. — The Rule 1 fix satisfies the public contract without adding an export, symbol, seam, helper, or parser restructuring.
- [Phase 112]: Bash if-field evidence uses complete literal commands and independently authored ordered results without invoking a shell. — Direct parser and matcher calls prove syntax, wrapper, recursion, fail-open, and specificity behavior without executing untrusted command text.
- [Phase 112]: Left the hooks-if-field supplemental file unchanged so Plan 112-13 remains its only final carrier. — The Bash owner absorbs the unique leaf evidence while avoiding a competing shared-file edit.
- [Phase 112]: Kept if-field/index.ts byte-for-byte unchanged because its public composition exports expose every required compile and evaluation partition.
- [Phase 112]: Retained only the unique parseHooksConfig side-map-to-RoutingEntry chain, including exact predicate object identity and declaration order.
- [Phase 112]: Kept the exact five predicate arms and all re-export evidence module-scoped without widening production metadata or adding a test seam.
- [Phase 112]: Kept routing-state.ts byte-for-byte unchanged because its public operations expose every required state transition and reset effect.
- [Phase 112]: Used only public lifecycle operations for routing-state setup, observation, and cleanup, without a private-state reader or test-only reset export.
- [Phase 112]: Left the additional-context supplemental unchanged because Plan 112-07 is its sole deletion carrier and Plan 112-13 owns the unique parser chain.
- [Phase 112]: Removed the two CodeGraph-confirmed registry test readers and obsolete promise-tracking cell without adding another observer or test seam.
- [Phase 112]: Retained fire-and-forget PID persistence on async child exit and error, observing rewrites through public filesystem and shutdown effects.
- [Phase 112]: Restricted the async-rewake supplemental to two cross-lane environment-parity cases and one routing-epoch reload case.
- [Phase 112]: Proved default orphan probes behind a mocked process.kill signal-0 boundary and used injected probes for all orphan safety partitions.
- [Phase 112]: Removed the legacy adaptObservationResult export after CodeGraph and historical call-site proof found no production caller.
- [Phase 112]: Consolidated every direct adapter contract and the duplicate architecture suite into the mirrored event-adapters owner.
- [Phase 112]: Left the mixed SessionStart additional-context supplemental unchanged for Plan 112-07 to remove after dependent evidence is absorbed.
- [Phase 112]: Kept dispatch-exec.ts byte-for-byte unchanged because dispatchHookExec exposes the complete process, stream, stdin, timer, parse, and delegation contract.
- [Phase 112]: Used synchronous child stdin and direct stdout/stderr descriptor writes to remove the portable fixture fast-exit race without sleeps or production changes.
- [Phase 112]: Consolidated all single-module execution evidence in the dispatch-exec owner and deleted hooks-exec.test.ts.
- [Phase 112]: Retained only translator-module completeness and shared built-in/custom tool-name mapping in hooks-translators.test.ts.
- [Phase 112]: Used a live failing diagnostic sink to prove the outer async delegation catch while preserving never-throw noop behavior.
- [Phase 112]: Kept dispatch.ts byte-for-byte unchanged because its public collection and composite-handler exports expose every reducer and adaptation partition through an injected executor.
- [Phase 112]: Consolidated all single-module reducer evidence in the mirrored dispatch owner, then deleted hooks-reducer.test.ts.
- [Phase 112]: Kept hooks-dispatch.test.ts byte-for-byte unchanged as the locked repository-wide static carrier for Plan 112-07.
- [Phase 112]: Used only public routing lifecycle operations for case-local state setup and cleanup, without a private state reader, reset seam, or shared oracle.
- [Phase 112]: Removed settleCacheSnapshot and loopProtectionState after live CodeGraph proof showed no production callers, without adding a replacement introspection seam.
- [Phase 112]: Proved settle state only through public lifecycle handlers, executor events, sent messages, notifications, and fresh follow-up calls.
- [Phase 112]: Kept StopFailure observation-only: matching noop, block, mutate, and stop results run in declaration order and are all discarded.
- [Phase 112]: Alphabetized inventories and presentation expectations while preserving exact production declaration and registration order where order is contractual.
- [Phase 112]: Kept event-router.ts byte-for-byte unchanged because its public cache, hydration, rebuild, handler, and registration operations expose the complete lifecycle contract.
- [Phase 112]: Split in-memory and persisted child fixtures across user and project cleanup surfaces so exit persistence cannot race the orphan tracer.
- [Phase 112]: Alphabetized the hook-barrel runtime identity and compiler-negative inventories while leaving production export declarations unchanged.
- [Phase 113]: Completed all 35 mirrored owners; 33 executable sources reached 971/971 branches, 216/216 functions, and 7,941/7,941 lines, while both type-only owners passed compiler contracts.
- [Phase 113]: Kept runtime tests on separate lowercase `// arrange`, `// act`, and `// assert` phases and kept presentation-only inventories alphabetical.
- [Phase 113]: Preserved caller, scope, reason, and lifecycle order wherever sequence carries behavior.
- [Phase 113]: Proved presenter structure and exact rendered bytes, including severity, dependency, omission, tally, trailer, and reload partitions.
- [Phase 113]: Proved classifiers, discovery, clone helpers, probes, scope fan-out, import planning, and reconcile planning through complete case-local values.
- [Phase 113]: Kept read-only support paths offline through fail-fast fakes and architecture prohibitions; all mutable state and collaborators are case-owned.
- [Phase 113]: Absorbed single-module evidence into mirrored owners and removed seven redundant supplemental suites without losing their unique contracts.
- [Phase 113]: Removed one unreachable closed-union presenter default instead of fabricating an impossible test value.
- [Phase 113]: Restored shipped barrel and interface exports after review showed aggregate dead-code cleanup had narrowed public contracts.
- [Phase 113]: Replaced passive-value mocks and every broad `anyTimes()` expectation with fresh typed data and exact, explicitly verified interaction doubles.
- [Phase 115]: Removed five structurally unreachable arms from the import cascade after a caller trace, narrowing two private types so a wrong token is a compile error rather than a runtime signal.
- [Phase 115]: Deleted the last c8 ignore in the extensions tree by running the entrypoint twice with no dependency bundle, so the production default state loader's own answer is what changes the second outcome.
- [Phase 115]: A defensive guard can be reached and still not be discriminating; the repair builder's undeclared-source guard is redundant with the already-declared merge check and is reported rather than removed.
- [Phase 115]: D-115-10 delivered: the three reconcile producers carry the mode-discriminated overload, so a dropped cascade row is a gate failure rather than a silent continue.
- [Phase 115]: Removed the marketplace-add, plugin-install and plugin-toggle catch clauses as unreachable; kept and proved the removal and uninstall clauses with a competing-writer race.
- [Phase 115]: Deleted all eight source-text pins outright; none encoded a rule that is not already gated by its own owner, so nothing was re-homed under tests/architecture/.
- [Phase 116]: strong-mock times(0) is inert, so the notification boundary omits the expectation entirely when a count is 0
- [Phase 116]: The args-schema owner records onError with a plain closure asserted as a whole array, never as an interaction mock — The module promise is its return value; a declared callback parameter is not a port, so its call count proves nothing the result does not
- [Phase 116]: The tokenizer-failure cases declare a required positional the input satisfies, so an undefined result can only mean the early return fired — It proves the short-circuit through the public result instead of observing an internal call, and a plant that removed the short-circuit turned all three cases RED
- [Phase 116]: The direct-coverage branch denominator is a property of the suite, not of the source: edge/args.ts measures branches 28/29 under its rewritten owner where it measured 25/26 under the old one, with the same single uncovered branch — V8 emits a block range only when that block's execution count diverges from the enclosing range, so a guard whose false arm is never taken is collapsed and never enters the lcov denominator at all. Covering the false arm raises BRH and BRF together. Diffing BRDA records between the two suites over the same source shows three new ranges (args.ts:46, :75, :84) and no lost ones. Consequence: a full-line coverage verdict pin cannot be authored before the rewrite that strengthens the suite. D-116-01a's recorded number for edge/args.ts is superseded by measurement and the three other claimants (116-26, 116-21, 116-17) carry the same exposure. Operator ratification required; nothing was edited.
- [Phase 116]: 116-06: deleted the unreachable optional-description branch in completionFlagEntries by making FlagEntry.description required, rather than adding a coverage exception; the exported return type is unchanged
- [Phase 116]: 116-06: where an architecture gate already pins a data table exactly, the mirrored owner proves the derivation shape (filter, order, key presence, exclusion) and asserts nothing about the table contents
- [Phase 116]: 116-30: the type-only owner pins EdgeDeps required-versus-optional split only; enumerating the member set or asserting the export surface would restate what the compiler and fallow dead-code already enforce
- [Phase 116]: 116-30: a clean tsc is itself proof that every ts-expect-error in a file binds, because an unattached directive raises TS2578; the moved-marker plant showed the multi-line satisfies diagnostic landing on the closing line
- [Phase 116]: The closed-over-API case builds two distinct Pi values instead of one shared value: a same-instance case only repeats the delegation case and cannot discriminate.
- [Phase 116]: 116-23: a double for a generic export derives from an instantiation-expression type query (Parameters<typeof fn<Chosen>>[N]); the uninstantiated form collapses the type parameter to unknown and loses the exact-argument match
- [Phase 116]: 116-23: input tokens that the module under test derives from another module are hand-authored literals, not read back from that module; feeding the derivation back in is tautological and cannot fail
- [Phase 116]: 116-26: a whitespace row set must separate the two claims it looks like one of — dropping empty tokens and splitting on a whitespace CLASS are independent, and a spaces-only row pins neither because /\s+/ is greedy
- [Phase 116]: 116-26: a D-116-01a pair pins the shortfall identity (one uncovered branch, the exact uncovered line set) and records the measured branch numbers as an observation; the denominator tracks suite strength, so a number pin cannot be authored before the rewrite it gates
- [Phase 116]: 116-27: all four tools.ts switches are gated — three by TS2366 because their return type excludes undefined, and the version reader by TS7030 because noImplicitReturns makes the end of a default-less switch reachable once an arm goes missing; research's "compiles clean" premise is disproved
- [Phase 116]: 116-27: an unreachable switch arm is removed by giving the function its producer's row union, derived from the producer's return type rather than named or hand-excluded; re-adding a removed arm raises TS2678, which is the control that proves the removal was forced
- [Phase 116]: 116-27: a defensive narrowing copied from a shared helper is a branch the local pair can never reach; calling the helper removes it without a cast, a behavior change, or a coverage exception
- [Phase 116]: 116-27: a mock for a generic method restates that member as a property, because reading a method as a value is an unbound-method lint error; the shared notification boundary cannot serve a registerTool capture for that reason
- [Phase 116]: 116-29: the two subcommand vocabularies deliberately overlap on list, ls, info and update, so "no marketplace name is also handled by the top level" is false; the anti-shadowing promise is carried instead by proving the shared token reaches a different handler member per dispatch
- [Phase 116]: 116-29: alias identity is one case with one expectation at a definite count of 2, driven once by the alias and once by the canonical name; two separate cases prove two dispatches, not one identity
- [Phase 116]: 116-29: a "no duplicate entries" claim cannot be written by deduplicating the exported constant and comparing it back — that is an expectation transformed from an actual; comparing the export against the hand-authored row table that serves it catches the same defect
- [Phase 116]: 116-24: a destructive seamless verb is owned through its FOOTPRINT — every case, rejections included, compares the surviving install records of both scope roots as one whole value beside the notification; a notification-only proof of an uninstall passes while proving nothing about whether state changed
- [Phase 116]: 116-24: `parseCommandArgs` with ONE REQUIRED positional rejects zero but DROPS a surplus, because it iterates the schema rather than the input; the arity truth's lower half holds and its surplus half does not
- [Phase 116]: 116-24: `uninstallPlugin` reads `opts.local` only to pick the CFG-03 precondition target and then sweeps BOTH config layers unconditionally, so the scope-target flag is invisible in the message AND in the footprint on a healthy workspace; the discriminating fixture is an override layer that FAILS SCHEMA VALIDATION, where supplying the flag aborts the command and omitting it completes it
- [Phase 116]: 116-24: one Group-C plant can yield three distinct frames on a single module when the scope selection is what reaches `locationsFor` — a user-scope call never calls `path.join`, so it runs to completion and is caught by the emission count instead of by an ERR_INVALID_ARG_TYPE
- [Phase 116]: 116-24: an offline zero needs BOTH reachability questions answered; where the module can reach no transport at all, the zero is an NFR-5 regression guard with neither a positive control nor a reachable input, and must be labelled as one rather than presented as a measurement
- [Phase 116]: 116-03: the `--partial` option is not an install/update-only narrowing — it SHIFTS the install candidate set (drops `remote`, admits `partially-available`) and narrows uninstall, reinstall, enable and disable identically to update, because it is threaded into the same shared installed-inventory helper
- [Phase 116]: 116-03: `tests/architecture/scope-order-drift.test.ts` walks `extensions/` only, so a hand-authored scope literal in a test file is not gated; four existing test files already carry one
- [Phase 116]: 116-03: a counter exposed on a returned interface must be declared `readonly f: () => number`, not `f(): number` — a method signature makes every destructuring site an unbound-method lint error even though the value is a closure
- [Phase 116]: 116-03: `data.ts:188`'s `allTokens.at(-1) ?? ""` fallback is a fifth D-116-01a-class unreachable branch, outside the four-claimant list; proved unreachable by construction, by a 65,536-code-point probe, and by a plant that stayed green, and left at 109/110 rather than pinned or excepted
- [Phase 116]: 116-10: an EMPTY positional schema does not reject a surplus token — `parseCommandArgs` iterates the SCHEMA, not the input, so every extra token is dropped and the handler still delegates; the phase-wide `must_haves` truth that both out-of-range arities are "rejected with a usage error" is false for a zero-positional handler
- [Phase 116]: 116-10: `marketplace/list.ts` never calls `extractLocalFlag`, so the scope-target flag reaches the tokenizer as a positional and is swallowed; supplying it beside `--scope` is accepted, not rejected, and the phase-wide mutually-exclusive-selectors truth has no target on this handler
- [Phase 116]: 116-10: the Group-C negative fires on the FIRST unstated boundary read, not on the emission count — a handler that forwards `ctx.cwd` dies in `path.join` on strong-mock's pending-call proxy before it can emit, so the G5 excerpt's stated "second `ctx.ui` access past its `times(1)` count" mechanism is only the fallback for handlers that read no `cwd`
- [Phase 116]: 116-10: a Group-C rejecting case seeds BOTH scopes so the workflow it must not reach would have rows to emit; an unseeded tree makes the negative weaker because the unreached workflow would emit only the empty-state sentinel
- [Phase 116]: The marketplace update handler's usage-string collapse arm is unreachable through its exports, so the pair stands at branches 11/12 and the shortfall is reported, not pinned or excepted — parseCommandArgs passes the usage string to the callback only for a REQUIRED positional; this schema declares its sole positional optional. Proven by construction, by a 170-shape brute force, by a plant that stayed GREEN, and by an inverted-condition plant that went RED. 116-13 is not a D-116-01a claimant and both production licences are spent, so the reversible default applies. Identity: BRDA:41,11,0,0 in the pair's own lcov.
- [Phase 116]: An injected port forwarded from two call sites needs one plant per site; a single-site plant leaves the sibling arm's claim unproven — Removing the all-marketplaces arm's pluginUpdate forward left both named-marketplace rows GREEN; removing the single-marketplace arm's forward left the bare and scope-narrowed cases GREEN. Applies to 116-07, 116-14 and 116-17, the remaining injected-port owners.
- [Phase 116]: 116-07: the marketplace add owner proves the injected git port by driving a url source on a provider-less host and comparing the whole clone recorder, with the randomUUID staging leaf replaced by a token only under the expected scope root
- [Phase 116]: 116-07: scope and the scope-target flag are proven as an on-disk footprint (which scope root holds state.json, and whether the write-back landed in claude-plugins.json or claude-plugins.local.json) because the edge tier has no injection point against the options bag
- [Phase 116]: 116-14: a RECORDER-based port-forward proof is weaker than a structural exact-argument `when()` — a re-boxed port AND a port with one member wrapped around a delegating call both stay GREEN under a recorder, while 116-17's `when()` goes RED on the wrapped member; only replacing the implementation goes RED under both, so the claim states that the operation is carried out by the injected implementation
- [Phase 116]: 116-14: a guard order is only pinnable with an input that satisfies TWO guards at once — the plan's unrecognised-scope-with-no-positional input passes under any order, while `--scope user --local` proves the positional guard precedes the scope guard and `extra --scope nope` proves the parse failure precedes both
- [Phase 116]: 116-14: `plugin/bootstrap.ts` calls `parseArgs`, the second handler measured to do so, and answers all three inherited questions like `plugin/import.ts` rather than like the marketplace tier — a surplus positional IS rejected, there is no arity below the accepted zero, and `--local` lands on positional
- [Phase 116]: 116-14: a github-source workflow cannot be driven through a bare `createGitOpsFake` — the GitHub provider attaches a credential bundle whose functions are not structured-clonable and the fake's recorder clones every call, so the port must drop that downstream-owned bundle while still delegating every operation to the fake
- [Phase 117]: The unit-suite glob control lands before the amendment it guards, so the later glob change must turn it RED and back GREEN rather than tune it to agree
- [Phase 117]: 117-02: a support-module relocation ships as ONE commit carrying the `git mv` and its consumer import rewrites — a pure-move commit leaves the consumers importing a path that no longer exists, so it cannot typecheck, and git still reports the rename at 96 to 98 percent
- [Phase 117]: 117-02: ESLint and Prettier disagree on the shape of a shortened import — `eslint --fix` split the two integration children's import onto four lines and `prettier --check` then failed, because the shorter sibling specifier let the statement fit one 94-character line; run both, never either alone
- [Phase 117]: 117-03: shortening an import specifier re-sorts it INSIDE the parent group, not only across groups — the boundary move reddened `import-x/order` in six suites where the plan predicted two, so the ordering must be read off ESLint rather than reasoned about
- [Phase 117]: 117-03: a 100 percent rename reading is only evidence once the consumer edits are confirmed staged — the identical number was false in 117-02, produced by an aborted `git add`, so cross-check it against `md5sum` and `git log --follow`
- [Phase 117]: D-117-04a: both orphan supplements relocate to tests/architecture/ rather than fold into a mirrored owner, because each spans several production modules and none of them owns it — The correspondence gate exempts the architecture root structurally (nonCorrespondingRoots), so the relocation needed no gate change and no exemption entry -- which is what keeps the SUITE-04 ban on name-keyed opt-outs intact
- [Phase 117]: D-117-04b: each move is one commit carrying the move plus its specifier fix, not a move commit and a rewrite commit — A pure-move commit would leave the reason-parity suite importing a path one level too deep, so it would not typecheck; git still recorded the rename at 95 percent, and the materialization-gate move at 100 percent
- [Phase 117]: The device-flow prompt supplement folds into tests/domain/github-auth.test.ts as one case, not two: its ordering case restated the owner existing reports-denied-authorization row, so the surviving case pins the catalog byte form on the denied poll and carries both claims at once.
- [Phase 117]: The folded case builds its transport with createDeviceFlowFake while the credential and notify ports stay strong-mocks, because the house role table makes notifying a mock and a third copy of the owner mock-DeviceFlowHttp arrange block would have risked the fallow dupes threshold of 3.
- [Phase 117]: 117-06: plant at the granularity the case claims — deleting the whole production step fails the case on its returned outcome, so it cannot prove an on-disk read is load-bearing — The plan's literal plant removed the cascade's hooks slot and the merged case failed on dropped.hooks, not on the readdir; deleting only the rm inside removeHookConfig left the outcome correct and failed exactly one case in the suite, on the disk read
- [Phase 117]: The seed's own three production specifiers gained a climb because its new home is one directory deeper; no consumer rewrite reveals that, only reading the module does.
- [Phase 117]: The helpers glob alternative was removed for honesty, not function: both globs match the same 248 paths with and without it, and the 117-01 completeness control is the independent proof.
- [Phase 117]: Shortening an import specifier re-sorts it inside the parent group with no predictable direction: 13 handler suites moved a line, the mirror image of 117-03's effect.
- [Phase 117]: The extension entry pair asserts two notifications for an unreadable install state, not one: the reconcile renders its own failure cascade for the same file before the plugin-PATH warning, and the legacy filtered assertion concealed it. — Measured on this tree; the whole two-element notification list is now compared.
- [Phase 117]: Both entry-pair fixtures use a schema violation rather than a syntax error, because the reconcile renders the runtime JSON parser text into a user-visible message and that text is not part of any contract. — Keeps the whole-value cascade comparisons stable across Node versions; this tree runs v26.7.0 while CI pins 24.
- [Phase 117]: Barrel-proxy ownership is named as its own gate verdict, proxy-owned, split from wrong-import and decided from the import graph the gate already builds. — D-117-21 gives the verdict its spelling; the split needs no name list, registry or exemption entry, and both sides are planted in the control.
- [Phase 117]: D-117-20 amended to 190 + 7 + 7: 190 complete numeric records, 7 accepted D-116-01a shortfalls, 7 type-only — Operator decision after plan 117-11 measured it; the gate is deliberately unchanged, no ledger-keyed verdict and no production licence, because a ledger-keyed pass would be the coverage-exception pragma D-116-01a bans
- [Phase 117]: Concurrency is NOT added to the all-pair run, decided against a measured 533.2 s for all 204 rows — Under nine minutes at a phase boundary does not justify D-117-11's obligation of a second planting control proving a failing pair is still detected under interleaving
- [Phase 117]: An errno path and errno message text are runtime-owned, not contractual; assertions pin name, code and syscall, and read the runtime's wording back where production composes around it — A package upgrade changed the EISDIR wording mid-phase and reddened 11 assertions with no behaviour change; the ten hardened suites are now identical on v22.22.2 and v26.8.1
- [Phase 01]: Keep canonical revalidation state in normalized JSON and render Markdown deterministically from it.
- [Phase 01]: Seed every corpus file and operator decision unresolved so shards cannot inherit false completion.
- [Phase 01]: [Phase 01-02]: Preserve meta-report rows as namespaced source claims linked to canonical cross-cutting findings.
- [Phase 01]: [Phase 01-02]: Treat the missing historical coverage report as an explicit evidence gap rather than current proof.
- [Phase 01]: Administrative review instructions are explicit zero-claim controls, not current production findings.
- [Phase 01]: The MCP home escape and retained coverage report are stale, while seven focused coverage shortfalls remain live.
- [Phase 01]: Treat the first-pass reviewer instruction brief as an explicit zero-claim control document rather than converting operational directions into product findings.
- [Phase 01]: Preserve the clean-list repair's historical method and counts while confirming its current result from the retained reports.
- [Phase 01]: [Phase 01-05]: Keep architecture scan weaknesses live until visited-file and planted-violation controls exist.
- [Phase 01]: [Phase 01-05]: Preserve positive gate evidence separately from current weaknesses.
- [Phase 01]: Route catalog UAT live weaknesses to Phase 2 while retaining measured key-parity and whole-byte strengths as evidence-only closure.
- [Phase 01]: Keep the catalog test split as an operator-sequenced decision after selecting a production section-emitter interface.
- [Phase 01]: Preserve 48 independently traceable architecture-hooks claims rather than collapsing refinements or corrections.
- [Phase 01]: Keep the HOOKS_CONFIG_SCHEMA test-only-export question routed to operator decision while routing the inert-gate repair to Phase 2.
- [Phase 01]: Preserve each architecture-gate report bullet as an independent namespaced claim, including clean and correction evidence.
- [Phase 01]: Keep evidence status independent from remediation routing for the 01-08 shard.
- [Phase 01]: Keep multi-directory agents discovery versus single-directory production wiring as an operator decision.
- [Phase 01]: Classify artificial coverage as dead defensive code, compiler-forced narrowing, or reachable behavior with an unsuitable seam.
- [Phase 01]: Route the pid-table pre-await snapshot defect to Phase 2 because current control flow contradicts its defensive-copy contract.
- [Phase 01]: Keep unreachable async-rewake fallback and CR-01 element-validation policy claims as operator decisions.
- [Phase 01]: Preserve hooks-dispatch corpus overlaps as explicit duplicate findings rather than deleting historical claim identities.
- [Phase 01]: Close the hooks event-router duplicate-import claim as stale only after current replacement inspection and focused rerun.
- [Phase 01]: Keep unquoted compound command-substitution semantics as an operator decision because upstream parity is not established by repository evidence.
- [Phase 01]: Treat dead defensive compiler catches as an operator choice between deletion and explicitly accepted uncovered lines.
- [Phase 01]: Route the surviving compaction reason-to-trigger contract through an operator decision before implementation.
- [Phase 01]: Preserve refuted hooks-payload prescriptions as stale evidence-only closures.
- [Phase 01]: [Phase 01-14]: Keep MCP shared-predicate and test-only-export ownership as operator decisions while routing live null/scalar defects to Phase 2.
- [Phase 01]: [Phase 01-14]: Treat compiler-forced skills prototype surgery and parser-message ownership as operator decisions.
- [Phase 01]: Treat direct 100% coverage and mutation strength as independent evidence for hooks components.
- [Phase 01]: Close the unconditional-if deletion claim as stale because the current reject row kills that mutation.
- [Phase 01]: Retain defensive dispatch-guard, debug seam, clock seam, result-shape, and validator-export questions as operator decisions.
- [Phase 01]: Route reproduced domain correctness and security gaps before structural test cleanup.
- [Phase 01]: [Phase 01-17]: Route inconsistent resolver I/O taxonomy and module splitting through operator decisions.
- [Phase 01]: [Phase 01-17]: Close the partial-gate over-narrowing claim as stale because current typecheck rejects the mutation.
- [Phase 01]: [Phase 01-18]: Keep dormant completion-cache removal and required-description narrowing routed through operator decisions because both cross ownership boundaries.
- [Phase 01]: [Phase 01-18]: Treat marketplace unknown-long-flag behavior as an operator policy decision while routing missing-await and duplicated handler ownership findings to Phase 2.
- [Phase 01]: Keep handler-to-orchestrator ownership fixes routed to Phase 2 while preserving full-value assertions until narrow injection seams exist.
- [Phase 01]: Retain the update omitted-scope observation and workspace-helper consolidation in the deferred backlog because they cross this shard's handler ownership boundary.
- [Phase 01]: Route the two closable D-116-01a index-loop shortfalls to operator decision because current iterable rewrites contradict their compiler-forced premises.
- [Phase 01]: Keep callback-recorder policy and speculative flag visibility as operator decisions rather than mechanical edits.
- [Phase 01]: Preserve all 55 import and marketplace-add claims individually while routing 52 live findings to Phase 2.
- [Phase 01]: Close three overstated historical claims as stale evidence rather than scheduling their original remedies.
- [Phase 01]: Route the write-only MarketplaceUpdateError.retryHint contract to an operator decision because its producer mutation survives and no current consumer observes the field.
- [Phase 01]: Retain the fs.watch TOCTOU case as a deferred determinism concern rather than treating its race as a lying test.
- [Phase 01]: Preserve the stale fetch git-import suspicion separately from the confirmed dynamic-import architecture-gate blind spot.
- [Phase 01]: Route unreachable source-kind and required-version branches to operator decisions instead of adding dishonest tests.
- [Phase 01]: Keep disabled-row unparseable-hooks handling as an operator decision because current code and rationale disagree.
- [Phase 01]: Separate green baseline evidence from surviving mutations that confirm plugin-info test-strength gaps.
- [Phase 01]: Keep healthy direct coverage separate from surviving mutations that prove assertion-strength gaps.
- [Phase 01]: Route the unused authMemo option through an operator decision because deletion changes a public option interface.
- [Phase 01]: Plan 01-26: plugin-data-directory assertion gap is stale because the current equivalent mutation is killed by the owner suite.
- [Phase 01]: Plan 01-26: exact assignment validity requires the two corpus records to share one artifact commit.
- [Phase 01]: Plan 01-27 keeps evidence status independent from remediation routing for every preserved historical claim.
- [Phase 01]: Plan 01-27 closes claims only with positive current replacement or removal proof and routes surviving findings by concern.
- [Phase 01]: Plan 01-28 keeps direct owner-pair gaps live when related edge-handler coverage does not kill the focused mutation.
- [Phase 01]: Plan 01-28 routes the cross-suite filesystem injection seam to an operator decision and localized defects to their owning remediation phases.
- [Phase 01]: Preserve each actionable plugin-reinstall review statement as its own namespaced claim even when claims concern the same underlying defect.
- [Phase 01]: Route still-live plugin-reinstall findings to Phase 2 independently of evidence status.
- [Phase 01]: Keep D-11 test-strength claims inconclusive when no isolated surviving mutation was run.
- [Phase 01]: Plan 01-31 keeps D-11 test-strength claims inconclusive until an isolated surviving mutation supplies terminal proof.
- [Phase 01]: Plan 01-32 routes source-claimed marketplace plugin behavior, exhaustiveness fallbacks, the test-only export, and the state-read seam through operator decisions.
- [Phase 01]: Plan 01-32 preserves positive behavioral-test patterns separately from live remediation findings.
- [Phase 01]: [Phase 01-33]: Keep fourteen test-strength claims inconclusive because no isolated surviving mutation was run.
- [Phase 01]: [Phase 01-33]: Preserve structural, stale, clean-evidence, and cross-cutting corpus claims as separate identities.
- [Phase 01]: [Phase 01-34]: Keep persistence and platform test-strength claims inconclusive without isolated surviving mutations.
- [Phase 01]: [Phase 01-34]: Preserve structural, positive, and cross-cutting evidence separately from remediation routing.
- [Phase 01]: [Phase 01-35]: Use isolated surviving mutations to terminally confirm assertion-strength gaps despite green direct coverage.
- [Phase 01]: [Phase 01-35]: Keep evidence status independent from remediation routing for root-index and shared-concern claims.
- [Phase 01]: Treat green owner tests as executability evidence only, never as confirmation of named mutation strength.
- [Phase 01]: Keep mutation-dependent claims inconclusive when no isolated mutation was run, while confirming structural claims from current live evidence.
- [Phase 01]: Preserve shared-notify report-local claims in one exclusive validated shard with isolated mutation evidence.
- [Phase 01]: Preserve first-pass architecture-gate strengths as duplicate evidence without erasing later adversarial refinements.
- [Phase 01]: Retain the fallow planted-cycle limitation as deferred gate-integrity work because the current case proves only package-script shape.
- [Phase 01]: Route unsafe notification doubles, misplaced paired coverage, the ineffective hooks schema scan, and hidden clock/home dependencies to Phase 2.
- [Phase 01]: Keep structural readability, redundancy, naming, and module-size issues in the deferred backlog while retaining sound gate behavior as evidence-only closure.
- [Phase 01]: Route live configSource and manifest-read gate-strength gaps to Phase 2 and retain the command rollback-pair gap under its Phase 3 canonical finding.
- [Phase 01]: Close historical agents no-op and force/foreign blockers as stale only after positive current-suite proof.
- [Phase 01]: Keep structural cleanup and language-operator branch decisions separate from evidence status while retaining sound gates as evidence-only closures.
- [Phase 01]: Preserve all 55 first-pass hook-bridge claims while linking 39 overlaps directly to earlier canonical adversarial findings.
- [Phase 01]: Route the reproduced PID-table pre-await snapshot defect to Phase 2 while retaining shared-state, double, and structure work in Phase 3 or the deferred backlog.
- [Phase 01]: Keep the routing-state reset-export question under the existing operator decision and close only historical run-status or review-boundary claims with positive current evidence.
- [Phase 01]: Preserve all 60 hook execution, if-field, and payload claims while linking 39 overlaps directly to canonical adversarial findings.
- [Phase 01]: Use isolated surviving mutations to confirm the hook-environment restoration tautology, truncation maximality gap, and missing if-field runtime re-export proof.
- [Phase 01]: Keep evidence status independent from remediation route: 27 claims close as evidence and 33 remain in the deferred backlog.
- [Phase 01]: Preserve all 68 first-pass MCP, skills, and hook-component claims while linking 50 overlaps to canonical adversarial findings.
- [Phase 01]: Keep broad clean and no-blocker classifications traceable as superseded evidence instead of letting them override claim-level current findings.
- [Phase 01]: Use failing public MCP null-shape probes and surviving test-strength mutations only in a removable repository-local isolated copy.
- [Phase 01]: Preserve all 52 domain-component, core-domain, and resolver first-pass claims while linking 45 overlaps to canonical adversarial findings.
- [Phase 01]: Keep broad clean and purity statements traceable while allowing later claim-level evidence to qualify or supersede them.
- [Phase 01]: Reuse canonical operator-decision routes for the debug seam, Device Flow clock and readonly contracts, and resolver split.
- [Phase 01]: Preserve all 58 first-pass completion and handler claims while linking overlaps to already-revalidated canonical findings.
- [Phase 01]: Treat focused green suites as an executability baseline only; structural and assertion-strength routes remain governed by their current evidence.
- [Phase 01]: Keep cache ownership as an operator decision and route direct handler workflow seams to Phase 2 without weakening current whole-value assertions.
- [Phase 01]: Preserve all 49 edge-handler, edge-root, and import first-pass claims while linking exact overlaps to canonical adversarial findings.
- [Phase 01]: Treat both corrupt-state tool rejections as one behavioral production defect while retaining the host-catch question only as a severity caveat.
- [Phase 01]: Keep D-102-03 mutation-backed behavior independent from its recorder-style and missing-traceability routes.
- [Phase 01]: Preserve all 82 marketplace and plugin first-pass claims while linking exact overlaps to already-revalidated adversarial findings.
- [Phase 01]: Treat node:assert/strict aliases as positive stale proof against historical loose-comparison claims while keeping spellings as optional cleanup.
- [Phase 01]: Keep evidence status independent from route across Phase 2, Phase 4, Phase 7, backlog, closure, and operator-decision outcomes.
- [Phase 01]: Preserve all 83 plugin-orchestrator first-pass claims while allowing narrow mutation evidence to override broad clean-suite praise.
- [Phase 01]: Keep list and install module splits as operator decisions while routing assertion defects independently to Phase 2.
- [Phase 01]: Treat the shared strict output literal and centralized network gate as valid test design, not defects.
- [Phase 01]: Preserve all 61 orchestrator-root, persistence, and platform first-pass claims while linking overlaps to their existing canonical adversarial findings.
- [Phase 01]: Treat the isolated GitOps fake auth DataCloneError as current behavioral proof for PLT-F020 while keeping green owner suites as executability evidence only.
- [Phase 01]: Preserve all 58 entrypoint and shared first-pass claims while linking exact overlaps to existing canonical adversarial findings.
- [Phase 01]: Treat focused green suites as executability evidence only and retain mutation-dependent clock and unlink claims under their existing inconclusive canonical records.
- [Phase 01]: Preserve all 60 first-pass notify and transaction claims while linking exact overlaps to existing canonical adversarial findings.
- [Phase 01]: Treat complete direct coverage as positive stale proof for the historical isLockHeldError branch gap without weakening separate assertion-strength findings.
- [Phase 01]: Keep the synchronous String.prototype patch as deferred shared-process cleanup because current execution proves no leak but a non-global seam is preferable.
- [Phase 01]: Keep incomplete-file, inconclusive-finding, and pending-decision allowances independent; pending decisions are allowed only when their IDs are exactly MF-DEC-01 through MF-DEC-09.
- [Phase 01]: Preserve retired or test-only evidence as explicit N/A trace records when no live one-to-one owner exists, rather than inventing a replacement or deleting history.
- [Phase 01]: Defer every semantic duplicate/conflict adjudication and operator evidence choice to plans 01-56 and 01-57.
- [Phase 01]: Point every source claim and duplicate directly to its terminal canonical finding while retaining duplicate-local claim IDs and evidence records.
- [Phase 01]: Use existing surviving-mutation or behavioral-probe evidence when it is stronger than a canonical root's static proof; preserve method-specific local evidence on duplicate records.
- [Phase 01]: Leave 109 genuinely unresolved findings inconclusive for plan 01-57 and leave MF-DEC-01 through MF-DEC-09 pending without making operator decisions.
- [Phase 01]: Resolve every one of the 109 remaining evidence gaps with bounded case-owned-copy probes or stronger current proof, without altering live production or test source.
- [Phase 01]: Classify the 109 gaps strictly from proof as 103 confirmed, four duplicate, and two stale; never treat a green baseline alone as terminal test-strength evidence.
- [Phase 01]: Preserve exactly MF-DEC-01 through MF-DEC-09 as pending and validate the terminal ledger with only the pending-decision allowance.
- [Phase 01]: Select trace-preserving removal for MF-DEC-01: remove dead or no-producer branches and dishonest cases, preserve only compiler-required or genuinely safety-critical checks with current evidence, and replace reachable surgery with case-owned behavior.
- [Phase 01]: Route MF-DEC-01 through PDEF-01/PDEF-07, TREF-03, TREF-06, TREF-08, and RCOV-02; pid-table source context authorizes no change without a dedicated terminal finding.
- [Phase 01]: Close MF-DEC-04 without an operator choice because its sole specific premise SNC-F001 is stale and current install/update/reinstall cascade paths disprove the historical 18-of-19 census.
- [Phase 01]: MF-DEC-04 authorizes no global renderer change; preserve SNA-F010, SNC-F002, OPM-F04, and SNC-F019 in Phase 2 and OPM-F05 in Phase 6 under their existing destinations.
- [Phase 01]: Resolve declared plugin marketplace aliases through a one-to-one source-claim map while preserving manifest-derived canonical state identity; fail closed on a missing or ambiguous mapping.
- [Phase 01]: Route MF-DEC-05 implementation through Phase 3 PDEF-08 and its distinct alias/tools fixed-point regression through PDEF-01; preserve ORA-F04, ORA-F07, and ORA-F13 independently.
- [Phase 01]: Enforce structural single/plural cardinality at every notifyWithContext producer and honor plural tallies without inferring cardinality from rendered row count.
- [Phase 01]: Route MF-DEC-06 through Phase 3 PDEF-01 and Phase 6 TREF-07; named autoupdate is single, a bare sweep is plural, and plural list bare headers still produce no tally.
- [Phase 01]: Execute the complete resolver, notify, install, update, reinstall, list, and catalog split program only after its correctness and test-strength prerequisites; file size alone never authorizes extraction.
- [Phase 01]: Route approved splits through Phase 6 TREF-09 with mirrored owner tests, one end-to-end proof per flow, no test-only exports, direct-pair coverage, and mandatory gate, documentation, ownership, and completeness repointing; keep info deferred and uninstall unsplit.
- [Phase 01]: Preserve applyReconcile and bootstrapClaudePlugin as the only two demonstrated behavioral-composition exceptions instead of adding production dependency seams solely for interaction tests.
- [Phase 01]: Phase 5 TREF-04 must exempt only those observed flows while preserving their public-result, full state/configuration/tree, and exact-notification assertions; add no test-only exports or injection seams for them.
- [Phase 01]: Classify each builtin-patching use and eliminate process-global mutation, using case-owned temporary filesystem behavior by default and narrow production-owned ports only for irreproducible faults, timing, schedules, or rollback control.
- [Phase 01]: Coordinate MF-DEC-07 through Phase 5 TREF-04, Phase 6 TREF-08, and the TREF-09 split sequence without test-only exports, __deps additions, unused defaults, dead seams, or weakened observable assertions.
- [Phase 01]: Adopt production-role names for the 16 traced makeMockGitOps, makeMockCredentialOps, and makeMockDeviceFlowHttp factories across 10 files while preserving their typed, hermetic, fail-closed behavior.
- [Phase 01]: Route MF-DEC-08 through Phase 4 TREF-02 and TREF-03, align project conventions and production comments, and require separate terminal trace before renaming makeMockPi or unrelated *Fake families.
- [Phase 01]: Enforce the strict changed-pair direct-coverage gate through both a scoped local pre-commit hook and a dedicated CI job with shared fail-closed selection.
- [Phase 01]: Route MF-DEC-09 through GGAT-01, RCOV-01, RCOV-02, RCOV-03, and CLOSE-01. Keep all-pair reports honest and keep assertion-strength evidence independent from numeric coverage.
- [Phase 01]: Cover all 32 current requirement IDs and all eight stable Phase 2-9 routes exactly once in the terminal evidence-backed scope-impact crosswalk.
- [Phase 01]: Narrow or split mixed scope in place, move unsupported AGCOL-01 and superseded standalone COV-01 work to evidence, and preserve every stable requirement ID and later phase number.
- [Phase 01]: Do not activate the folded unused-type-member todo or named GAUTH-01 wiring without a dedicated terminal canonical finding inside the unit-test-quality boundary.
- [Phase 01]: Keep 30 active or complete requirements mapped exactly once and retain GGAT-02 and RCOV-04 as explicit evidence/history identities rather than executable work.
- [Phase 01]: Preserve Phase 2-9 numbering with active requirement counts 3/5/4/3/3/3/3/2 and round-trip every planning edit through one of 40 canonical before/after anchor pairs.
- [Phase 01]: Keep the unused-type-member todo and named GAUTH-01 prescription historical until a dedicated terminal finding authorizes in-boundary work.
- [Phase 01]: Seal the final ledger at 110 complete files, 2,897 linked claims, 2,437 terminal findings, nine resolved decisions, and 40 validated scope rows before Phase 02 planning.
- [Phase 01]: Treat the Plan 01-69 Prettier repair as formatting-only because normalized parsed-JSON digests remained equal for all 26 files.
- [Phase 02]: Stage owns the shared MCP classifier and typed error so unstage can reuse the policy without an import cycle.
- [Phase 02]: Existing MCP callers propagate malformed-field failures without new lifecycle result arms or translations.
- [Phase 02]: Own-property absence remains a no-op while every present non-record JSON value fails closed.
- [Phase 02]: Reject a raw child component exactly equal to .. before resolution or filesystem inspection; normalize only refused diagnostics.
- [Phase 02]: Use one normalized parent-child pair for every accepted-path containment decision, error, relative segment, and lstat walk.
- [Phase 02]: Keep production consumers byte-identical because all live callers inherit the repaired shared pre-I/O assertion.
- [Phase 02]: Catch only aggregateDiscoveredResources and its result projection at the registered host callback; keep reconciliation, PATH recompute, and the aggregator unchanged.
- [Phase 02]: Prove transient aggregate failure with one exact-path, explicitly non-concurrent built-in mock; restore and re-synchronize it before invoking the same registered callback again and in teardown.
- [Phase 02]: Retain the per-warning try/catch and prove both user and project warning attempts under a notifier that throws on every call.
- [Phase 01]: Parse requirement definitions separately from traceability dispositions so moved evidence-only IDs remain stable without authorizing active work. — Preserves D-19 and D-21.
- [Phase 01]: Validate Phase 2-9 membership against traceability and require qualified after anchors. — Enforces D-20 and D-23.
- [Phase 03]: Resolve every marketplace source claim before building mutation buckets so declaration order cannot select a canonical identity. — A complete claim graph makes zero, unique, ambiguous, and multiply claimed cases explicit and deterministic.
- [Phase 03]: Represent alias ambiguity with the existing source-mismatch plan result. — The existing result is structured and report-only, so no new public error surface is needed.
- [Phase 03]: Retain conflicted canonical candidates and suppress dependent plugin actions. — Fail-closed reconciliation must report ambiguity without choosing, adding, removing, installing, or uninstalling involved state.
- [Phase 03]: Resolver order is authoritative for multi-directory agent discovery; later duplicate names warn and never replace the first artifact.
- [Phase 03]: Install preview and live staging share the same ordered agentsDirs list so conflict detection and materialization cannot drift.
- [Phase 03]: The singular agent source compatibility union is temporary and will be deleted after update/reinstall migrate in Plan 03-03.
- [Phase 03]: Compact payloads map manual to manual and both threshold and overflow to auto through typed reason discriminants.
- [Phase 03]: PreCompact and PostCompact matcher supportability publishes exactly the manual and auto values emitted by translation.
- [Phase 03]: Open hook selector strings resolve through readonly maps built from exhaustive typed records, so inherited object keys are never accepted.
- [Phase 03]: Synchronous dispatch indexes the total admitted-event translator table directly; only its cast-created no-producer fallback was removed.
- [Phase 03]: Derive marketplace autoupdate and list cardinality from invocation structure before result collection. — Named autoupdate is single; no-name autoupdate and list are plural even with zero or one rows.
- [Phase 03]: Render zero successes for an otherwise empty default plural tally. — A structural plural operation must remain visibly plural when it produces no rows; explicit tally overrides keep their prior behavior.
- [Phase 03]: Stamp statusless marketplace-list inventory rows as informational operations. — The rows must count in the list tally without changing their rendered bytes or UI severity.
- [Phase 03]: Marketplace add, remove, and named update are single; all-target update is plural before result discovery. — Invocation structure owns tally semantics, so empty, one-result, and many-result executions remain consistent.
- [Phase 03]: All-target marketplace update preserves one notification per target while threading plural cardinality to each. — The notification metadata correction must not change transaction or sequencing behavior.
- [Phase 03]: Marketplace mutation catalog fixtures cover D-28 exact output alongside owner tests. — New aggregate tally bytes are part of the public notification contract.
- [Phase 03]: Update and reinstall reuse discovery's ordered agentsDirs list for preview, staging, and rollback. — One resolver-owned representation prevents preview and mutation from observing different directory subsets.
- [Phase 03]: The singular agentsSourceDir compatibility member, helper, and bridge input union are removed. — All production consumers now accept the promoted ordered-list contract.
- [Phase 03]: Multi-directory test fixture branches were extracted instead of suppressed. — Fallow identified two new cognitive-complexity breaches, and small helpers restored the health gate.
- [Phase 03]: Install delegates rollback error identity, containment suppression, and partial wrapping to transaction/rollback.ts. — The failed ledger boundary now has one production rule before notification projection.
- [Phase 03]: The existing transaction rollback matrix was retained without duplicate cases. — It already proves ordinary and containment identity plus one, multiple, and repeated partial-row behavior.
- [Phase 03]: Remove the value-dead dispatchable tuple with its runtime guard; retain DispatchableEvent as an exact BucketAEvent compatibility alias. — Both producer unions are equal, exhaustive translator records enforce totality, and keeping duplicate metadata required an unused-value lint exemption.
- [Phase 03]: Reconcile pending tallies count actionable plugin leaves or standalone failed marketplace blocks; neutral marketplace headers remain structural context. — This preserves the central cascade tally contract while making the producer-owned plural cardinality explicit.
- [Phase 03]: Known uninstall, update, and marketplace reasons derive from typed identities and stable errno codes, never message keywords.
- [Phase 03]: Update cleanup failures remain immutable secondary context; the original operational Error stays primary and successful cleanup stays silent.
- [Phase 03]: Plugin notification cardinality derives from parsed invocation shape before result enumeration; named targets are single and list or container-wide targets are plural.
- [Phase 03]: Shared plugin emitters require caller-owned cardinality instead of inferring it from the number of result rows.
- [Phase 03]: Lifecycle cardinality follows parsed target structure before rows exist. — Result count cannot distinguish a named target from a bulk invocation that produced one or zero rows.
- [Phase 03]: Empty bulk update retains its fixed no-op headline. — The update no-op contract is independent from realized-transition tally arithmetic.
- [Phase 03]: Structural cardinality is mandatory at notifyWithContext — Producer invocation shape, not rendered row count, determines whether a tally is required.
- [Phase 03]: Scope-narrowed fan-out commands remain plural — Filtering a plural command to one result must still render its operation tally, while named singular commands remain tally-free.
- [Phase 03]: Plugin-list projections validate their exact aggregate trailer — Reduced row comparisons must not hide a missing or inaccurate user-visible tally.
- [Phase 04]: Hermetic user-scope fixtures control `HOME` and `PI_CODING_AGENT_DIR` beneath one case-owned root and restore both variables by original property presence.
- [Phase 04]: Shared Git fake snapshots preserve function-bearing authentication bundles and callback identity while copying only mutable data fields.
- [Phase 04]: Production consumers declare narrow Pi ports; local configurable doubles use role-only names while reusable concern-owned abstractions retain `create*Fake` names.
- [Phase 05]: Create exactly one HooksRuntime in the extension root and require it together with the state reader for hook hydration.
- [Phase 05]: Guard all retained Pi callbacks by runtime generation before any callback argument or mutable state is touched.
- [Phase 05]: Keep Node-backed compatibility exports while live runtime callbacks bridge owned routes into the legacy dispatch boundary.

### Pending Todos

None for roadmap creation.

### Blockers/Concerns

- `gsd-tools query phase.complete` cannot write root planning files while the
  three archived workstream directories remain. The active `refine-unit-tests`
  milestone is root-scoped, so the Phase 2 through Phase 4 canonical transitions
  were simulated in isolated flat copies, inspected, and applied by hand. Later
  phase transitions will require the same guarded procedure unless workstream
  routing is repaired.
- RESOLVED by 117-12: D-117-20 in `117-CONTEXT.md` now reads 190 complete numeric records + 7 accepted D-116-01a shortfalls + 7 type-only, matching the operator decision taken in plan 117-11 and the retained all-pair artifact. The superseded 197 + 7 wording is gone.

## Deferred Items

| Category       | Item                                                                                                                                                                                          | Status          | Deferred At          | Milestone |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------- | --------- |
| Tooling        | Detect unused code and unused type members — no gate reports a type member nothing reads (measured: typecheck, lint, and fallow all pass with one planted)                                    | Pending         | Phase 116 discussion | v1.19     |
| quick_tasks    | 260720-d8i-move-agent-provenance-from-body-comment-                                                                                                                                           | unknown         | 2026-09-04           | v1.19     |
| todos          | 2026-09-02-detect-unused-code-and-type-members.md                                                                                                                                             | (presence-only) | 2026-09-04           | v1.19     |
| uat_gaps       | 89/89-UAT.md (archived v1.16)                                                                                                                                                                 | passed          | 2026-09-04           | v1.19     |
| uat_gaps       | 63/63-UAT.md (archived v1.13)                                                                                                                                                                 | passed          | 2026-09-04           | v1.19     |
| uat_gaps       | 56/56-UAT-FIX-2.md (archived v1.12)                                                                                                                                                           | all_fixed       | 2026-09-04           | v1.19     |
| uat_gaps       | 56/56-UAT-FIX.md (archived v1.12)                                                                                                                                                             | all_fixed       | 2026-09-04           | v1.19     |
| deferred_items | 112/deferred-items.md: Phase 112 deferred items - `npm run check` reaches `format:check` but reports pre-existing format differences in user-owned, untracked `.mcp.json` and                 | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 1. Stale test path in an `install.messaging.ts` doc comment - **Found during:** 117-04 Task 1 - **File:** `extensions/pi-claude-marketplace/orchestrat                 | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 2. Stale byte-form-lock path in the output catalog - **Found during:** 117-05 Task 1 - **File:** `docs/output-catalog.md` (the `### Device Flow user-c                 | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 3. Stale `tests/helpers/` references throughout the codebase map - **Found during:** 117-07 Task 1 - **File:** `.planning/codebase/TESTING.md` (lines                  | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 4. RESOLVED - `--all` cannot complete: the seven D-116-01a shortfalls are accepted - **Found during:** 117-11 Task 2 - **File:** `scripts/test-coverag                 | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 5. RESOLVED - The PATH interpreter was upgraded mid-phase and reddened 11 tests - **Found during:** 117-11 Task 2 - **File:** ten test suites, led by                  | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 117/deferred-items.md: 6. RESOLVED - The direct-coverage sweeps still have no automated control **Resolved 2026-09-04 by operator decision.** Two parts, closed differently:                  | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 90/deferred-items.md (archived v1.17): 90-03 execution - **Pre-existing environment failure (pi-subagents global peer):** two integration tests in `tests/integration/skill-path-resolution.t | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 86/deferred-items.md (archived v1.15): Pre-existing integration test failures (NOT introduced by Plan 03) Two `tests/integration/*` cases fail on the current branch. They fail IDENTICALLY w | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 85/deferred-items.md (archived v1.14): Pre-existing integration-test failures (unrelated to this phase) `npm run test:integration` reports 2 failures that also fail on the base commit `2aa2 | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 50/deferred-items.md (archived v1.11): Pre-existing test failure: reinstall README documentation gap - **Test:** `tests/architecture/reinstall-docs.test.ts` -- "PRL-01/03/04/05/13/14/15/16: | acknowledged    | 2026-09-04           | v1.19     |
| deferred_items | 25/deferred-items.md (archived v1.4.1): `tests/e2e/import-command.test.ts` 3 failures (`import imports enabled Claude settings across both scopes`, `import --scope project narrows writes to | acknowledged    | 2026-09-04           | v1.19     |

**One item could NOT be suppressed by the tool** - `deferred_items` phase 25 (archived
v1.4.1). Its deferred items live in a markdown TABLE, not a bullet list: the scanner
synthesizes that row's `text` by joining cells with a spaced hyphen while the file stores
them with a spaced vertical bar, so the acknowledge writer's literal-text search can never match and it refuses with
`no deferred item matched --text`. The other 17 were suppressed normally. This one is
disclosed here instead and WILL resurface at the next milestone close - it was not silently
discarded, and the archived file was deliberately left byte-identical rather than
restructured to satisfy a scanner. Its content is a pre-existing
`tests/e2e/import-command.test.ts` failure already disclosed when v1.4.1 closed, and
`tests/e2e/**` is excluded from `npm run check`.

## Session Continuity

**Stopped at:** Completed Phase 05 Wave 8 through 05-14-PLAN.md

Phase 04 completed all seven plans and closed AUTH-01 and TREF-01 through
TREF-03. Independent verification passed 4/4 with no behavioral or UAT gap;
the complete quality gate passed 5,397 unit tests and 32 integration tests.
Phase 5 planning passed independent review. Plans 05-01 through 05-14 completed
the hidden-dependency ports, runtime and cache cores, hook registration,
dispatch, settle, async-child, and PID-operation ownership.

**Resume file:** None

**Read beside it:** `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, the
Phase 01 terminal evidence ledger, and Phase 5's roadmap criteria.

Last session: 2026-09-08T03:11:28.401Z

**Next:** Execute Phase 5 Plan 05-15 by routing direct and reconciled uninstall
through lifecycle ownership.

## Deferred Verification

| Phase | State                      | Resume                      |
| ----- | -------------------------- | --------------------------- |
| 01    | verification_deferred_gaps | `$gsd-plan-phase 01 --gaps` |

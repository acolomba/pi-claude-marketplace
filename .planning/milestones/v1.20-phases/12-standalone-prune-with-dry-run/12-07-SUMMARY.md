---
phase: 12-standalone-prune-with-dry-run
plan: "07"
subsystem: plugin-lifecycle
tags: [prune, dry-run, flags, help, completion]
requires:
  - phase: 12-standalone-prune-with-dry-run
    provides: Plan 03 production prune route and direct operation tests
  - phase: 12-standalone-prune-with-dry-run
    provides: Plan 04 read-only preview and catalog-owned dry-run flag
provides:
  - Consuming prune argument scan that rejects unsupported options before scope access
  - Exact prune scope and preview completion and help surface
  - Direct and independent regression tests for the FLAG-02 flag contract
affects: [12-08, phase-verification]
actuals:
  tokens: 3637
  tasks: 2
  commits: 2
plan_head_before: c0bf7fa09eeff81afb248125435f90d506236e22
tech-stack:
  added: []
  patterns:
    - Consume catalog-owned boolean flags before parsing a no-target command
    - Keep the shared scope flag outside per-verb exact-set comparisons
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/plugin/prune.ts
    - extensions/pi-claude-marketplace/edge/router.ts
    - tests/edge/flag-catalog.test.ts
    - tests/edge/handlers/plugin/prune.test.ts
    - tests/edge/completions/provider.test.ts
    - tests/edge/router.test.ts
    - tests/architecture/flag-catalog-drift.test.ts
key-decisions:
  - Reuse the shared consuming scanner so unknown short and long flags fail before the prune operation.
  - Reject the scanner's local write-target arm explicitly; prune accepts scope and dry-run only.
requirements-completed: [PRUNE-06, FLAG-02]
coverage:
  - id: D1
    description: Bare and project prune run in their selected scopes, while either dry-run flag order previews without writing.
    requirement: PRUNE-06
    verification:
      - kind: unit
        ref: tests/edge/handlers/plugin/prune.test.ts#defaults to the user scope with no target
        status: pass
      - kind: unit
        ref: tests/edge/handlers/plugin/prune.test.ts#previews the project scope with --dry-run --scope project
        status: pass
      - kind: unit
        ref: tests/edge/handlers/plugin/prune.test.ts#previews the project scope with --scope project --dry-run
        status: pass
    human_judgment: false
  - id: D2
    description: Unsupported prune flags and operands fail before either scope tree or operation is touched.
    requirement: FLAG-02
    verification:
      - kind: unit
        ref: tests/edge/handlers/plugin/prune.test.ts#rejects -y before touching either scope
        status: pass
      - kind: unit
        ref: tests/edge/handlers/plugin/prune.test.ts#rejects --keep-data before touching either scope
        status: pass
      - kind: unit
        ref: tests/edge/handlers/plugin/prune.test.ts#rejects --local before touching either scope
        status: pass
      - kind: unit
        ref: tests/edge/handlers/plugin/prune.test.ts#duplicate --dry-run previews once without writing
        status: pass
    human_judgment: false
  - id: D3
    description: Prune help and completion publish shared scope plus exactly one extra dry-run flag, with uninstall's extra set unchanged.
    requirement: FLAG-02
    verification:
      - kind: unit
        ref: tests/edge/completions/provider.test.ts#TC-3 offers only scope and preview flags for standalone prune
        status: pass
      - kind: unit
        ref: tests/edge/router.test.ts#names an unrecognized top-level token back to the operator with the top-level usage block (AP-3)
        status: pass
      - kind: unit
        ref: tests/architecture/flag-catalog-drift.test.ts#catalog vs help text: every completable "prune" flag is documented or deliberately omitted
        status: pass
      - kind: unit
        ref: tests/architecture/flag-catalog-drift.test.ts#catalog parse flags for uninstall match the independent handler contract
        status: pass
    human_judgment: false
duration: 17min
completed: 2026-09-24
status: complete
---

# Phase 12 Plan 07: Standalone prune flag contract summary

The standalone prune command now consumes the catalog-owned `--dry-run` flag before scope parsing, rejects every other option and target, and publishes the matching help and completion syntax.

## Performance

- Duration: about 17 minutes, from the preceding plan commit at 2026-09-24T01:58:45Z to the Task 2 commit at 2026-09-24T02:15:30Z.
- Tasks: 2.
- Files changed: 7.
- Commits: 2, measured from `plan_head_before` through Task 2.
- Actual tokens: 3,637, measured as 14,549 committed diff characters divided by four.

## Accomplishments

- The prune handler consumes `--dry-run` from the existing catalog. Its scanner rejects unknown short and long flags, and the residual parser rejects operands before reading `ctx.cwd` or invoking prune. The scanner's `--local` arm is explicitly refused.
- Handler tests cover bare user scope, project scope, both preview flag orders, duplicate preview, invalid scope, operands, and unsupported flags. Rejections compare full notification bytes and verify that neither scope's extension root was created.
- The router's prune usage line now includes `[--dry-run]`. Completion tests pin the top-level verb and the exact `--scope`, `--dry-run` candidate list. The independent drift guard now requires the preview flag in prune's help line; its uninstall row remains unchanged.

## Task Commits

1. Task 1: `4a8b69eb` (`feat(prune): reject unsupported standalone flags`).
2. Task 2: `17019e1f` (`feat(prune): publish dry-run help and completion`).

## Verification

- Task 1's focused catalog, handler, and architecture tests passed. Catalog direct coverage was 281/281 lines, 11/11 branches, and 10/10 functions; handler direct coverage was 54/54 lines, 13/13 branches, and 3/3 functions.
- Task 2's focused router, completion, architecture, and help tests passed. Router direct coverage was 257/257 lines, 43/43 branches, and 3/3 functions; completion-provider direct coverage was 353/353 lines, 82/82 branches, and 19/19 functions.
- Both tasks passed typecheck, targeted ESLint, changed-file Prettier, Fallow base audit, and changed-file pre-commit. Pre-commit skipped TruffleHog and the repository-wide format check for the linked checkout and operator-owned configuration; the changed files passed Prettier directly. The agent-marker Fallow audit returned a JSON temporary rule-pack runtime error, which project policy treats as nonblocking.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking test expectations] Updated the prune handler's empty-result assertions.** Plan 05's scoped empty-prune message made the previously zero-emission handler tests fail. The edited direct pair now asserts one exact message and one operation reach for each accepted path. Task 1 committed this in `4a8b69eb`; direct coverage and the changed-file pre-commit passed.

The catalog already contained exactly one parse-and-complete prune entry and exported `DRY_RUN_FLAG`, so Task 1 changed its consumer and owner test rather than changing the catalog data. The architecture guard already pinned prune's exact parse set; Task 2 updated its independent help partition.

## TDD Gate Compliance

TDD mode was disabled for this phase. Before Task 1 implementation, `-y` failed the intended assertion: the old handler reported `Unknown option` instead of the scanner's `Unknown flag` response. Before Task 2 implementation, the independent prune help assertion failed because the usage line omitted `[--dry-run]`. The shared-checkout handoff used one parent-owned commit per task, so these RED results have no separate test commits.

## Issues Encountered

The plan's single direct-coverage command listed two source paths, but the script accepts one source per invocation. Both source pairs passed when run separately. Fallow's base audit required access to create a temporary Git worktree and passed with that access.

## Next Plan Readiness

The prune flag surface is pinned across parsing, help, and completion. No open implementation blocker remains for phase verification.

## Self-Check: PASSED

The summary file and all seven changed files exist. Both task commits are present, and `git rev-list` measures two commits from `plan_head_before` through Task 2.

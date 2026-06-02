---
phase: 41
plan: 01
subsystem: documentation-and-test-closeout
tags:
  - docs
  - tests
  - regression-lock
  - tr-07
  - tr-08
  - d-19-01
requirements:
  - TR-07
  - TR-08
dependency-graph:
  requires:
    - Phase 38 (TR-01 / TR-06 commit landed; step-1 ENOENT-tolerance contract
      already correct in code)
    - Plan 19-03 (D-19-01 retired the V1 PROBE_FAILURES module-level
      capture-buffer + summary notifyWarning)
  provides:
    - Inline WHY comment locks for the two LOW-priority "correctness-OK today"
      patterns (agents step-1 self-heal; list.ts probe-failure swallow)
    - Two behavior/architecture regression tests that survive future
      idiomatic-shape refactors
  affects:
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - tests/bridges/agents/stage.test.ts
    - tests/orchestrators/plugin/list.test.ts
tech-stack:
  added: []
  patterns:
    - Behavior-asserting regression test (final-state-only; no spies, no call
      counts) -- explicit Pitfall-13 avoidance
    - Source-grep architecture test with defense-in-depth pair (direct
      identifier match + structural heuristic) -- explicit Pitfall-4
      compensation
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - tests/bridges/agents/stage.test.ts
    - tests/orchestrators/plugin/list.test.ts
decisions:
  - "RESEARCH Q1 ADOPTED: TR-08 test placed in tests/orchestrators/plugin/list.test.ts (locality > centralization for a single list-specific invariant)."
  - "RESEARCH Q2 ADOPTED: TR-07 test name = 'TR-07 commitPreparedAgents step-1 ENOENT-tolerance enables retry-safe self-heal' (requirement ID + function + behavior; matches TR-01 / TR-06 precedent in the same file)."
  - "RESEARCH Q3 ADOPTED: list.ts:382-411 augment-in-place -- lead with the diagnostic-noise rationale, keep the narrowResolverNotes historical comparison, close with a forward reference to the TR-08 architecture test."
  - "ROADMAP/CONTEXT misnomer clarified: 'post-state-commit cache-drop swallow' does NOT exist in list.ts -- the orchestrator is read-only by NFR-5 / PL-3 design. TR-08 lands at the availableRowMessage probe-failure catch (the actual D-19-01 swallow site)."
metrics:
  duration: ~10 min wall-clock execution
  completed: 2026-06-02
---

# Phase 41 Plan 01: Documentation and Test Closeout Summary

Documented two LOW-priority "correctness-OK today" patterns (TR-07 agents
step-1 ENOENT-tolerance; TR-08 list.ts D-19-01 probe-failure narrowing)
with inline WHY comments and added two regression tests that lock the
contracts from the outside. `npm run check` GREEN at 1368 tests (1366
Phase 40 baseline + TR-07 + TR-08); zero control-flow changes; zero new
dependencies.

## Task-by-Task Closeout

### Task 1 (TR-07): step-1 ENOENT-tolerance documentation + behavior test

**Comment landing site:** `extensions/pi-claude-marketplace/bridges/agents/stage.ts`, immediately above the `commitPreparedAgents` step-1 `try { await Promise.all(...) }` block. Replaced the prior 3-line annotation with a multi-line WHY block opening with "TR-07 / Phase 41:" (grep-discoverable), stating the ENOENT-tolerant idempotency contract in plain terms, cross-referencing the function JSDoc self-heal property, explaining why the loop stays parallel (step 1 has no source to roll back to), and retaining the `_foreignPreservedEntries` clarification. The step-1 control-flow body (lines now ~339-356 after the comment expansion) is byte-unchanged.

**Test landing site:** `tests/bridges/agents/stage.test.ts`, appended after the existing TR-06 test under a one-line section separator `// TR-07 step-1 ENOENT-tolerance regression test ----------------`.

**Test shape:** Behavior-only assertions. `withTmpScope` → `prepareStagePluginAgents` (cycle 1) → `commitPreparedAgents` → assert bot target exists → `rm` target (partial-commit drift injection) → `prepareStagePluginAgents` (cycle 2) → `commitPreparedAgents` → assert (a) bot target exists at the final path, (b) `agents-index.json` has exactly one row whose `generatedName === "pi-claude-marketplace-acme-bot"`, (c) the second staging dir is cleaned up. NO spy on `rm`, NO call counts, NO `Promise.all`-iteration assertions. A future refactor that swaps `Promise.all` for `Promise.allSettled` (still ENOENT-tolerant) leaves the test GREEN -- Pitfall 13 explicitly avoided.

**Verification:** `npm run test -- tests/bridges/agents/stage.test.ts` GREEN; the new TR-07 test runs and passes; all pre-existing tests in the file still pass. Both grep gates return 1 (test-name grep in test file; "TR-07 / Phase 41" grep in source).

**Commit:** `a545740` -- `docs(bridges): TR-07 document step-1 ENOENT + add behavior test`

### Task 2 (TR-08): availableRowMessage probe-failure documentation + architecture test

**Critical clarification:** The CONTEXT.md / ROADMAP.md phrase "post-state-commit cache-drop swallow in list.ts" is a **misnomer**. `list.ts` performs **no cache-drop call** -- the orchestrator is read-only by NFR-5 / PL-3 design (no `dropMarketplaceCache`, no `invalidate*`, no `withStateGuard`). The actual D-19-01 swallow site is the `availableRowMessage` **probe-failure catch** at `list.ts:382-411`, where a thrown `resolveStrict(...)` is narrowed to a per-row reason and turned into a `PluginUnavailableMessage` instead of being aggregated into a module-level `PROBE_FAILURES` buffer + summary `notifyWarning` (the V1 behavior that D-19-01 retired). TR-08 lands at this catch -- confirmed by source inspection during execution.

**Comment landing site:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`, inside the `catch (probeErr)` block at lines 383-405. Augmented-in-place per RESEARCH Q3 ADOPTED: the new block opens with "TR-08 / D-19-01: per-row probe-failure narrowing. Probe failures during list are diagnostic noise, NOT actionable user errors …" (rationale-first reader ordering), retains the existing `narrowResolverNotes` historical comparison below the rationale, and closes with a forward reference to the new TR-08 architecture test at `tests/orchestrators/plugin/list.test.ts`. The catch-body executable code (`narrowProbeError` + `return PluginUnavailableMessage{...}`) is byte-unchanged.

**Test landing site:** `tests/orchestrators/plugin/list.test.ts`, appended inside the existing source-grep block AFTER the "D-04 corollary" test and BEFORE the "Uncovered-path gap tests" section separator. Locality wins per RESEARCH Q1 ADOPTED -- the invariant is list-specific (the V1 buffer lived only in `list.ts`).

**Test shape:** Defense-in-depth source-grep with two assertions. Assertion A: direct identifier match -- `assert.equal(code.includes("PROBE_FAILURES"), false, ...)`. Assertion B: top-level mutable-state heuristic -- `code.match(/^(let|var)\s+\w+/gm) ?? []` must be empty. The regex is intentionally restricted to `let|var` (`const` is omitted) per Pitfall 2 -- the legitimate `const SYNTHETIC_LIST_FAILURE_MARKETPLACE_NAME = "(list)"` constant at `list.ts:923` is deliberate, immutable, non-accumulating. Defense-in-depth pair catches both reintroduction-by-name (Assertion A) and reintroduction-by-shape-under-different-name (Assertion B).

**Verification:** `npm run test -- tests/orchestrators/plugin/list.test.ts` GREEN; the new TR-08 test runs and passes; the pre-existing source-grep tests + Uncovered-path gap tests all still pass. Both grep gates return 1 (test-name grep in test file; "TR-08 / D-19-01" grep in source).

**Commit:** `ea58aa0` -- `docs(orchestrators): TR-08 doc probe-swallow + add architecture test`

### Task 3 (Phase Gate): npm run check

`npm run check` exited 0. Full chain GREEN:

- `tsc --noEmit` -- typecheck pass
- `eslint .` -- lint pass
- `prettier --check "**/*.{js,json,ts}"` -- format pass
- `node --test "tests/{...}/**/*.test.ts"` -- **1368 tests, 1368 pass, 0 fail**, duration ~16.9 s

Test count delta: 1366 (Phase 40 baseline) + 1 (TR-07 behavior test) + 1 (TR-08 source-grep test) = **1368**. No pre-existing test renamed, removed, or skipped. No regression from Phase 40.

**Commit:** No source/test edits in Task 3 (phase gate verification only).

## Final Test Count

**1368 tests, 1368 pass, 0 fail, 0 skipped, 0 todo** -- matches the expected +2 delta from the Phase 40 baseline of 1366 tests.

## Deviations from Plan

### Title-length adjustments (Conventional Commits 72-char limit)

The plan-prescribed commit titles slightly exceeded the CLAUDE.md
`gitlint` 72-char title limit, so they were trimmed before committing.
Both commits land with identical scope, requirement ID, and intent;
only the title verb wording was abbreviated.

| Task | Prescribed title (length) | Committed title (length) |
|------|---------------------------|--------------------------|
| Task 1 | `docs(bridges): TR-07 document agents step-1 ENOENT idempotency + add behavior test` (82) | `docs(bridges): TR-07 document step-1 ENOENT + add behavior test` (62) |
| Task 2 | `docs(orchestrators): TR-08 document list.ts probe-swallow + add architecture test` (80) | `docs(orchestrators): TR-08 doc probe-swallow + add architecture test` (71) |

No behavioral / scope / requirement-ID drift; both titles still convey
the file scope (`bridges` / `orchestrators`), requirement ID
(`TR-07` / `TR-08`), action (document/add), and what was added
(`behavior test` / `architecture test`).

### Pre-commit `trufflehog` hook -- worktree sandbox skip

Per CLAUDE.md's documented worktree-sandbox guidance, `SKIP=trufflehog`
prefix was used on each `git commit` invocation. The `trufflehog`
sub-process spawn failure under the worktree sandbox is a known sandbox
limitation, not a secret detection. Running
`pre-commit run trufflehog --all-files` directly reproduces the same
spawn failure (also documented as expected). No other hooks were
skipped; `--no-verify` was never used.

## Auth Gates

None encountered.

## Threat Flags

None. Phase 41 is purely additive documentation + regression tests
with zero new trust-boundary surface, zero new input parsing, zero new
file I/O paths, zero new subprocess invocation, zero new network
surface, and zero new auth or crypto code. The threat register entries
T-41-01 (TR-07 inline comment integrity) and T-41-02 (TR-08 inline
comment integrity) both land under their `mitigate` dispositions --
each comment's honesty is guarded by the corresponding regression test
appended in the same task.

## Self-Check: PASSED

**Files modified (4) -- all exist:**

- `extensions/pi-claude-marketplace/bridges/agents/stage.ts` ✓
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` ✓
- `tests/bridges/agents/stage.test.ts` ✓
- `tests/orchestrators/plugin/list.test.ts` ✓

**Commits -- both exist in `git log`:**

- `a545740` (Task 1 TR-07) ✓
- `ea58aa0` (Task 2 TR-08) ✓

**Grep gates -- all 4 return ≥ 1:**

- `grep -c "TR-07 / Phase 41" extensions/pi-claude-marketplace/bridges/agents/stage.ts` → 1 ✓
- `grep -c "TR-07 commitPreparedAgents step-1 ENOENT-tolerance" tests/bridges/agents/stage.test.ts` → 1 ✓
- `grep -c "TR-08 / D-19-01" extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` → 1 ✓
- `grep -c "TR-08 / D-19-01: list.ts has no module-level PROBE_FAILURES" tests/orchestrators/plugin/list.test.ts` → 1 ✓

**Phase gate:** `npm run check` exit 0; 1368 tests pass; 0 failures.

## Requirements Closure

- **TR-07** -- Pending → Complete. Inline WHY comment + behavior-asserting
  regression test landed. Comment names the requirement ID
  ("TR-07 / Phase 41"), states the ENOENT-tolerant idempotency contract,
  cross-references the function JSDoc, explains the parallel-loop rationale,
  retains the `_foreignPreservedEntries` clarification. Test asserts the
  self-heal behavior at the final-state level only -- Pitfall 13 avoided.
- **TR-08** -- Pending → Complete. Inline WHY comment augmented in place at
  the availableRowMessage probe-failure catch (the actual D-19-01 swallow
  site, NOT a phantom cache-drop site); leads with the diagnostic-noise
  rationale and the V1 PROBE_FAILURES retirement; retains the
  `narrowResolverNotes` historical comparison; closes with a forward
  reference to the architecture test. Source-grep architecture test with
  defense-in-depth pair (direct identifier match + top-level `let|var`
  heuristic) landed inside the existing source-grep block.

Both requirements ready for the executor to flip Pending → Complete in
`.planning/REQUIREMENTS.md`.

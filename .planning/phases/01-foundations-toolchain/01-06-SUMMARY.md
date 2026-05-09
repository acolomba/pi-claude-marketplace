---
phase: 01-foundations-toolchain
plan: 06
subsystem: testing
tags: [node-test, unit-tests, path-safety, atomic-json, notify, errors, index-smoke, regression-guard]

# Dependency graph
requires:
  - phase: 01-foundations-toolchain
    provides: shared/path-safety.ts, shared/atomic-json.ts, shared/notify.ts, shared/errors.ts (Plan 02); index.ts entrypoint (Plan 04)
provides:
  - tests/shared/path-safety.test.ts (PS-1..5, NFR-10, D-14..17 unit coverage)
  - tests/shared/atomic-json.test.ts (NFR-1, AS-1, D-03 unit coverage)
  - tests/shared/notify.test.ts (ES-1, ES-2, ES-4, NFR-9, D-07 unit coverage)
  - tests/shared/errors.test.ts (AS-5 unit coverage)
  - tests/shared/index-smoke.test.ts (Plan 04 regression guard: 1 cmd + 1 event + 0 tools)
affects: [phase-2-primitives, phase-3-bridges, phase-4-marketplace-orchestrators, phase-5-plugin-orchestrators, phase-6-edge, phase-7-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real tmp dirs + symlinks via node:fs/promises for path-safety attack-fixture tests (no mocking)"
    - "node:test mock.fn() for ExtensionContext mocking (no third-party framework)"
    - "Concurrent-write smoke test pattern: 5 parallel writes, assert final content is one of inputs + complete JSON shape"
    - "Regression guard pattern: import default extension + mock pi.{registerCommand, registerTool, on} + log + count"

key-files:
  created:
    - tests/shared/path-safety.test.ts
    - tests/shared/atomic-json.test.ts
    - tests/shared/notify.test.ts
    - tests/shared/errors.test.ts
    - tests/shared/index-smoke.test.ts
  modified: []

key-decisions:
  - "Added an 8th path-safety test (regular-file baseline) alongside the 7 RESEARCH.md cases to anchor PS-2's positive case"
  - "notify.test.ts ships 6 tests (not 4) -- split out the no-cause vs Error-cause vs non-Error-cause vs NFR-9 cases for explicit per-branch coverage"
  - "Tests assert .linkPath / .linkTarget on already-narrowed SymlinkRefusedError (instanceof) to satisfy strict typescript-eslint @typescript-eslint/no-unnecessary-type-assertion"

patterns-established:
  - "Pattern: assertPathInside attack-fixture tests use mkdtemp + symlink + try/finally cleanup (over assert.rejects, which can't inspect class hierarchy)"
  - "Pattern: notify wrapper tests use small object literal { ui: { notify: mock.fn() } } cast through `as never` to avoid pulling the full ExtensionContext type"
  - "Pattern: index-smoke regression guard logs registration calls into a typed array and asserts counts/names by type (cleaner than spying individual methods)"

requirements-completed: [NFR-1, NFR-9, NFR-10, ES-1, ES-2, ES-4, PS-1, PS-2, PS-3, PS-5, AS-1, AS-5]

# Metrics
duration: ~12min
completed: 2026-05-09
---

# Phase 1 Plan 06: Unit Tests for shared/* + index-smoke Regression Guard Summary

**5 unit-test files (23 tests) covering 12 of 23 Phase 1 REQ-IDs at the behavioral level: assertPathInside symlink defense, atomicWriteJson serialization, notify wrapper severity discipline, error cause-chaining, and the Plan 04 zero-LLM-tools regression guard.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-09T23:13:11Z (approx; from worktree creation timestamps)
- **Completed:** 2026-05-09T23:25:15Z
- **Tasks:** 3 (all autonomous)
- **Files created:** 5

## Accomplishments

- **path-safety unit coverage** (8 tests): all 7 RESEARCH.md Pattern-2 cases (happy path, direct escape, leaf symlink, parent-component symlink, non-existent leaf, ENOENT mid-walk, error class hierarchy) plus a regular-file baseline. Real tmp dirs + symlinks via `node:fs/promises`; no mocking. Locks D-14 (refuse all symlinks), D-16 (walk every parent component), D-17 (`SymlinkRefusedError extends PathContainmentError`).
- **atomic-json unit coverage** (3 tests): happy-path 2-space-indent + trailing-newline, parent-dir auto-creation, and the NFR-1 concurrent-write serialization smoke test (5 parallel writes; final content is one of the inputs and matches the complete JSON shape regex). Confirms the `write-file-atomic@^8` integration produces the wrapper's documented contract.
- **notify unit coverage** (6 tests): `notifySuccess` (no severity, ES-1), `notifyWarning` (`"warning"`, ES-2), `notifyError` without cause (`"error"`, ES-2), `notifyError` with `Error` cause (`\nCause: <msg>`, ES-4), `notifyError` with non-Error cause (String() coercion), and an NFR-9 guard asserting `cause.stack` absolute paths are NOT surfaced.
- **errors unit coverage** (4 tests): `errorMessage(Error|non-Error)` coercion, `appendLeakToError` cause-chaining when leak present, short-circuit when leak undefined, `appendLeaks` accumulating multiple leaks via repeated cause-chaining (walks the chain to verify intermediate links).
- **index-smoke regression guard** (2 tests): default export is a function; the extension registers EXACTLY 1 command (`claude:plugin`) + 1 event handler (`resources_discover`) + 0 LLM tools. If a future PR re-introduces the legacy stub's `pi.registerTool(...)`, this test fails immediately.
- **Full `npm run check` pipeline exits 0** with all 23 tests passing (typecheck + lint + format + test).

## Task Commits

Each task was committed atomically:

1. **Task 1: path-safety.test.ts (7 RESEARCH cases + baseline)** - `61add5b` (test)
2. **Task 2: atomic-json.test.ts + errors.test.ts** - `ba1d72e` (test)
3. **Task 3: notify.test.ts + index-smoke.test.ts** - `ff69d7d` (test)

**Plan metadata:** TBD (orchestrator owns the final docs commit; this plan does not write STATE.md / ROADMAP.md per parallel-execution contract).

## Files Created/Modified

- `tests/shared/path-safety.test.ts` - 8 tests (PS-1..5, NFR-10, D-14..17 attack-fixture coverage)
- `tests/shared/atomic-json.test.ts` - 3 tests (NFR-1 concurrent-write, AS-1 atomicity smoke, D-03 ergonomics)
- `tests/shared/notify.test.ts` - 6 tests (ES-1/2/4, NFR-9 stack-not-surfaced, D-07 wrapper)
- `tests/shared/errors.test.ts` - 4 tests (AS-5 cause-chain semantics, errorMessage coercion)
- `tests/shared/index-smoke.test.ts` - 2 tests (Plan 04 regression guard: zero LLM tools)

## Decisions Made

- **Added an 8th path-safety test (regular-file baseline) alongside the 7 RESEARCH.md cases.** Pure additive -- anchors PS-2's positive case alongside the negative escape case so the suite tells the full PS-2 story, not just the attacker view. RESEARCH.md's 7 enumerated cases all pass unchanged; the regular-file test simply confirms the SUT does not over-fire on benign inputs. (PRD §6.10 PS-2 explicitly requires the "regular file inside parent does not throw" branch.)
- **notify.test.ts ships 6 tests rather than the 4 originally enumerated in PATTERNS.md line 655.** Splits the no-cause case from the Error-cause case for explicit per-branch coverage, plus a separate non-Error-cause coercion test, plus the NFR-9 stack-not-surfaced guard. This matches the plan's explicit `must_haves.truths` line which calls out "all 4 wrappers" plus the Error.cause branch -- the additional NFR-9 test is a security guard that the threat model (T-06-01) flags as `mitigate`.
- **All `caught instanceof X` checks rely on TypeScript's narrowing instead of `as X` assertions** to satisfy `@typescript-eslint/no-unnecessary-type-assertion` under the strict-type-checked preset. The tests still verify the dynamic class hierarchy (instanceof passes) and read class-specific properties (`.linkPath`, `.linkTarget`) once narrowed.

## Deviations from Plan

None - plan executed exactly as written, with two additive enhancements (8th path-safety test, 6 notify tests instead of 4) that were called out as flexibility in the plan's notes (`Notes:` block in Task 1, `must_haves.truths` in frontmatter for notify wrappers).

The two minor adjustments below were forced by tooling, not deviations from intent:

1. **Removed redundant `as SymlinkRefusedError` assertions in path-safety.test.ts** after `caught instanceof SymlinkRefusedError` had already narrowed the type. Initial draft had three such assertions that triggered `@typescript-eslint/no-unnecessary-type-assertion` errors under the strict-type-checked preset. Removing them is purely a typing refinement -- runtime behavior unchanged. (Lint pass.)
2. **Ran `prettier --write` on `index-smoke.test.ts`** to satisfy the `format:check` gate -- no logic change, only inline-vs-multi-line formatting on three `assert.equal(...)` calls.

## Issues Encountered

- **TruffleHog pre-commit hook fails inside the worktree** (cannot read git index because `.git` is a file, not a directory). Mitigation per parallel-execution doc: `SKIP=trufflehog git commit ...` for all three task commits. Documented as expected behavior in `parallel_execution` section of executor instructions.
- **Gitlint title-length cap (72 chars)** caused two commit-message rejections during Task 1 and Task 2; trimmed both titles. No content lost -- full task scope is captured in the body bullets.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 12 of 23 Phase 1 REQ-IDs are now verified at the behavioral level: NFR-1, NFR-9, NFR-10, ES-1, ES-2, ES-4, PS-1, PS-2, PS-3, PS-5, AS-1, AS-5.
- The remaining 11 REQ-IDs are verified at architecture-test level (Plan 05: ES-5 markers snapshot + IL-4 telemetry-deps + D-11 import boundaries) or at the lint-config level (Plan 01: D-06 / IL-2 / IL-3 / D-11).
- Plan 04's "no LLM tools in Phase 1" decision is now defended by a passing regression test -- any future PR that re-adds `pi.registerTool(...)` to `index.ts` fails CI immediately.
- **Concurrency note for the orchestrator merge:** This plan was executed in parallel with Plan 01-05 (architecture tests). When merging the worktree, expect:
  - Plan 01-05 adds: `tests/architecture/`, `tests/helpers/`, `tests/fixtures/bad-imports/`
  - Plan 01-06 adds: `tests/shared/` (this plan)
  - No file overlap; the merges are independent.
  - After both merges land, the full Phase 1 test suite is **8 test files** (3 architecture + 5 shared) totaling ~28-30 individual tests when running `npm test`.
- No blockers for Phase 2.

## Self-Check: PASSED

Verified post-write:

- `tests/shared/path-safety.test.ts` exists (176 lines, 8 tests, all 8 grep anchors present)
- `tests/shared/atomic-json.test.ts` exists (68 lines, 3 tests, all 3 grep anchors present)
- `tests/shared/errors.test.ts` exists (50 lines, 4 tests, all 3 grep anchors present)
- `tests/shared/notify.test.ts` exists (75 lines, 6 tests, all 4 grep anchors plus NFR-9 mention present)
- `tests/shared/index-smoke.test.ts` exists (57 lines, 2 tests, both grep anchors plus "0 tools" mention present)
- Commits in `git log --oneline`: `61add5b` (Task 1), `ba1d72e` (Task 2), `ff69d7d` (Task 3) -- all FOUND
- `npm run check` exits 0 with 23 tests passing (FOUND)
- No accidental modifications to `tests/architecture/`, `tests/helpers/`, or `tests/fixtures/bad-imports/` -- those directories do not exist in this worktree (parallel agent's territory)
- No accidental modifications to `STATE.md` / `ROADMAP.md`

---
*Phase: 01-foundations-toolchain*
*Completed: 2026-05-09*

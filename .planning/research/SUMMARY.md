# Project Research Summary

**Project:** pi-claude-marketplace v1.7 Transaction Resilience Hardening
**Domain:** Atomic commit correctness, phase-ledger undo ordering, sequential rename loops with rollback
**Researched:** 2026-06-02
**Confidence:** HIGH

## Executive Summary

v1.7 is a pure correctness milestone: eight structural defects in already-hand-rolled
saga/two-phase-commit infrastructure. The codebase already has the right abstractions
(`runPhases`, `withStateGuard`, `rollbackReplacementCommon`, `write-file-atomic`,
`proper-lockfile`) -- the bugs are in sequencing and ordering at specific call sites,
not in missing primitives. The STACK verdict is unambiguous: add no new dependencies.
All eight fixes are hand-rolled using existing `node:fs/promises` + `write-file-atomic@^8`
patterns already validated across 1312 tests and six prior milestones.

The eight findings cluster into three root patterns. First, sequential-loop discipline
is broken in two bridge commit functions: `commitPreparedAgents` and
`commitPreparedCommands` both use `Promise.all` for renames, making partial-completion
bookkeeping impossible. Second, the phase-ledger undo scope is too narrow: `runPhases`
pushes to `executed[]` AFTER `phase.do` returns, so a partially-applied phase that
throws never gets its own undo called. Third, state-record mutations at orchestrator
boundaries occur in the wrong order relative to physical commits, producing ghost records
(TR-03, TR-04) and orphan-blocking reinstalls (TR-06).

The primary integration risk is test co-adaptation: PUP-6 (`update.test.ts:744`),
the skills collision guard (`stage.test.ts:388`), and the phase-3a failure tests all
pin through specific filesystem-level obstacles that the TR-* fixes could silently
disable. Every planning phase document must enumerate which existing tests exercise
its failure path and verify the trigger still fires after the fix.

## Key Findings

### Recommended Stack

No new dependencies. All eight fixes stay within `extensions/pi-claude-marketplace/`.
Every npm alternative surveyed -- saga libraries (`node-sagas`, `@nestjs/cqrs`,
`redux-saga`, Temporal), transactional FS wrappers (`fs-extra`, `transactional-fs`,
`graceful-fs`), result-type libraries (`neverthrow`, `effect`), and concurrency
primitives (`p-queue`, `p-limit`) -- is either the wrong shape, unmaintained, or would
require a milestone-wide refactor. The fixes go from parallel TO sequential for F1/F5,
which makes concurrency primitives precisely the wrong direction.

**Core technologies (carry forward, no changes):**
- `node:fs/promises` (built-in): F1/F5/F6 rename loops; F3 cascade unstage; `fs.rm({force:true})` orphan cleanup
- `write-file-atomic@^8.0.0`: F4 state write already through this; F3 ghost-record fix reuses the same write path
- `proper-lockfile@^4.1.2`: Cross-process scope lock -- all F2/F3/F4 fixes run inside this lock
- `node:test` (built-in): Regression tests for all eight findings
- `memfs@^4.57.2`: Already in dev deps; rollback-path unit tests; no upgrade needed

### Expected Features (Patterns per Finding Cluster)

All eight TR-* findings map to five fix patterns:

**Must have (correctness fixes, TR-01 through TR-06):**
- Sequential-loop-with-rollback (F1/F5): Replace `Promise.all(renames)` with `for...of`
  + append-only `completedRenames[]` + reverse-walk on throw; extract shared
  `commitWithRollback` helper into `shared/fs-utils.ts`; use `appendLeakToError` not
  `ManualRecoveryError` for commit-path leaks
- Phase-ledger push-before-do (F2): Move `executed.push(phase)` to BEFORE
  `await phase.do(ctx)`; invoke failing phase's undo as a SEPARATE call site in catch
  BEFORE `rollbackExecuted(executed, ctx)` -- not by adding the phase to `executed[]`
  (prevents double-rollback); document ENOENT-tolerant undo contract on `Phase<C>`
- State-after-physical-commits (F3/F4): For cascade teardown (F3), caller materializes
  `dropped.*` into a partial state-record filter -- cascade primitive stays read-only on
  state; for update (F4), split `swapStateRecord` into `markUpdateInProgress`
  (sets `installable:false`) bracketing phase-3a commits, then `finalizeUpdateRecord` --
  version bump is all-or-nothing, resource-record update is per-bridge
- Orphan-tolerance on reinstall (F6): Replace `if (await pathExists(pair.to)) throw`
  with `removeOrphanIfPresent(pair.to, mode)` that distinguishes owned orphans
  (state.json claims them + ownership marker) from foreign artifacts (PI-6 guard stays
  intact for those); extract helper to `shared/fs-utils.ts`

**Should have (docs + tests, TR-07/TR-08):**
- Agents step-1 parallel rm self-healing (F7): Inline comment explaining ENOENT-tolerant
  idempotency; one behavior-asserting regression test (not implementation-asserting)
- D-19-01 cache-drop swallow rationale (F8): Inline WHY comment referencing D-19-01
  probe-buffer retirement; one regression test asserting no module-level
  `PROBE_FAILURES`-style state

**Defer to v1.8+:**
- WAL-style audit trail / transaction IDs on state.json (out of scope; TR-04 is ordering fix only)
- Result-type migration (`neverthrow`): worthwhile future investment, wrong scope here
- `applyPartialUnstageToRecord` extraction: optional dedup helper; defers to implementation team

### Architecture Approach

No new files required for the load-bearing fixes. All changes are localized to existing
modules. Two new exports only: `removeOrphanIfPresent` in `shared/fs-utils.ts` (~12 lines)
for TR-06, and an optional `applyPartialUnstageToRecord` in
`orchestrators/marketplace/shared.ts` to deduplicate TR-03 between `uninstall.ts` and
`remove.ts`. The structural constraint shaping build order: TR-04 depends on TR-01 +
TR-05 bridge rollback being stable, because once update.ts defers the state write to
after commits, the bridges become the rollback boundary update.ts leans on.

**Modified files:**
1. `transaction/phase-ledger.ts::runPhases` -- TR-02: one-line push reorder; no type changes
2. `bridges/agents/stage.ts::commitPreparedAgents` -- TR-01: `Promise.all` → sequential loop + reverse rollback; TR-06: `replacePreparedAgents` orphan guard
3. `bridges/commands/stage.ts::commitPreparedCommands` -- TR-05: add `renamed[]` tracking + reverse rollback; TR-06: `replacePreparedCommands` orphan guard
4. `bridges/skills/stage.ts::replacePreparedSkills` -- TR-06: orphan guard (commit path already correct; donor of the pattern)
5. `orchestrators/plugin/uninstall.ts` -- TR-03: NEW branch materializing `dropped.*` into state filter on `outcome.ok === false`
6. `orchestrators/marketplace/remove.ts` -- TR-03: same NEW branch
7. `orchestrators/plugin/update.ts::runThreePhaseUpdate` -- TR-04: structural reorder; split `swapStateRecord` into intent-mark + finalize; largest change in milestone

**New exports:**
1. `shared/fs-utils.ts::removeOrphanIfPresent(target, mode: "file"|"tree")` -- TR-06 shared helper
2. `orchestrators/marketplace/shared.ts::applyPartialUnstageToRecord` -- TR-03 optional dedup (~12 lines)

### Critical Pitfalls

1. **Double-rollback in TR-02 (phase-ledger fix)** -- The over-correction is pushing the
   failing phase onto `executed[]` before the catch, causing `rollbackExecuted`'s reverse
   walk AND a separate explicit undo call to both invoke it. Prevention: invoke failing
   phase's undo as a SEPARATE catch-block call site FIRST, then call
   `rollbackExecuted(executed, ctx)` for prior phases. `executed` never contains the
   failing phase. Add a test asserting the exact undo-call sequence.

2. **PUP-6 test trigger erasure in TR-06 (orphan removal)** -- `update.test.ts:744` seeds
   a FILE at `skillsTargetDir/hello-tool` to force `ENOTDIR`. A TR-06 fix that pre-removes
   any pre-existing target will `rm` that file; the rename succeeds; the test goes
   GREEN-for-wrong-reasons. Prevention: orphan detection MUST check state.json ownership
   (the obstacle file `"obstacle"` text is not in state.json's skills list). After the
   source fix, verify PUP-6 still REDs; add a synthetic-injection variant to preserve
   phase-3a aggregation coverage.

3. **PI-6 collision guard bypass in TR-06 (replacePrepared* orphan removal)** -- Naively
   removing any pre-existing target before rename silently enables one plugin to overwrite
   another's artifact on reinstall. Prevention: the narrow case TR-06 targets is "orphan
   from our own prior partial install" -- detected by state.json `resources.*` listing the
   target as ours. Foreign artifacts still throw the existing error. The `stage.test.ts:388`
   rejection test MUST remain RED after the fix.

4. **Sequential-loop rollback bugs in TR-01/TR-05** -- Three classic mistakes: (a)
   `completed.reverse()` mutates in place -- use `[...completed].reverse()` per
   `rollbackReplacementCommon`; (b) rollback renames can also fail -- accumulate into
   `leaks[]` and `appendLeakToError`, never throw from the rollback loop; (c) the
   pre-step `Promise.all` rm loop is ENOENT-tolerant and stays parallel -- only the
   RENAME loop converts to sequential.

5. **State-before-commit partial-failure matrix in TR-04** -- Moving state write to after
   commits but only writing on "all-success" loses state for bridges that DID succeed.
   Resources update is per-bridge; version bump is all-or-nothing. The fix must enumerate
   4-bridge × 2-outcome behavior. Without a retry test seeding `version=OLD,
   resources.skills=NEW, disk skills=NEW` and re-running update, the fix can silently
   regress to "state.json never written."

## Implications for Roadmap

Based on research, suggested phase structure (5 build phases):

### Phase 1: Phase-Ledger Undo Gap (TR-02)

**Rationale:** Lowest risk, foundational, most impact per line changed. One-line reorder
in `phase-ledger.ts` unlocks correct undo behavior for all orchestrators. All subsequent
fixes depend on the ledger working correctly.
**Delivers:** Every phase whose `do` throws now gets its own `undo` invoked; the failing
phase's undo runs first (correct reverse-order semantics).
**Addresses:** F2 (phase-ledger push-before-do)
**Avoids:** Double-rollback -- failing phase undo is a SEPARATE catch-block call site
BEFORE `rollbackExecuted(executed, ctx)`, never via `executed[]` addition.
**Research flag:** Standard patterns -- `rollbackExecuted` contract fully documented in
source; no deeper research needed.

### Phase 2: Sequential Commit Loops + Orphan Tolerance (TR-01, TR-05, TR-06)

**Rationale:** TR-01, TR-05, and TR-06 all implement the same sequential-rename-loop-with-reverse
shape. Grouping enables extracting `commitWithRollback` and `removeOrphanIfPresent` shared
helpers once, avoiding bridge divergence. TR-06 must land in this phase because its orphan
guard interacts directly with the renamed-pair tracking added by TR-01/TR-05.
**Delivers:** Bridge commit paths atomic at rename granularity; reinstall after partial
commit no longer blocks on orphan targets; PI-6 cross-plugin guard preserved.
**Addresses:** F1 (agents commit), F5 (commands commit), F6 (replacePrepared* orphan blocking)
**Avoids:** Rollback mutation bug; ENOENT-in-rollback poison; `ManualRecoveryError` vs
`appendLeakToError` misuse; PI-6 guard bypass; PUP-6 trigger erasure.
**Research flag:** Standard patterns -- `rollbackReplacementCommon` is the reference shape;
extract and adapt.

### Phase 3: Cascade Ghost Record (TR-03)

**Rationale:** After bridge rollback is stable (Phase 2), the orchestrator-side state
mutation for partial cascade can be implemented correctly. Must be isolated from TR-04
to allow testing the cascade-pathway fix before the more complex direct-pathway refactor.
**Delivers:** On partial cascade unstage, callers filter `sRecord.resources.*` by
`outcome.dropped.*` rather than dropping or preserving the whole record; AG-5
foreign-content carve-out keeps the row for that cause.
**Addresses:** F3 (cascadeUnstage ghost record)
**Avoids:** Cascade primitive mutating state -- only the orchestrator mutates; AG-5 cause
discrimination test required.
**Research flag:** Standard patterns -- `dropped.*` accumulation contract already adequate;
fix is at the caller boundary.

### Phase 4: Update State-Before-Commit Reorder (TR-04)

**Rationale:** Largest structural change in the milestone. Depends on TR-01 + TR-05
bridge rollback being validated (Phase 2). After TR-03 establishes the partial-success
state-mutation pattern, TR-04 applies it to the direct-pathway in update.ts.
**Delivers:** `runThreePhaseUpdate` split into intent-mark (`installable:false`) +
physical commits (D-03 continue-on-failure preserved) + finalize (per-bridge resource
update + all-or-nothing version bump); retry after partial failure sees truthful state.
**Addresses:** F4 (update.ts state-before-commit)
**Avoids:** "All-success-only state write" trap; resources-vs-version split must be
explicit; 4-bridge × 2-outcome failure matrix tests; retry test required.
**Research flag:** Needs careful planning -- 4-bridge failure matrix and retry test are
non-trivial; ~10-15 test rewrites in `update.test.ts` expected. Planner should draft the
state-contract table (16 cases) before writing the implementation spec.

### Phase 5: Documentation and Test Closeout (TR-07, TR-08)

**Rationale:** LOW-priority findings; correctness-OK today. Final phase after all
structural fixes are stable so inline comments reference the final post-fix contracts.
**Delivers:** Inline ADR comments for self-healing parallel rm and D-19-01 cache-drop
swallow rationale; two behavior-asserting regression tests.
**Addresses:** F7 (agents step-1 parallel rm), F8 (D-19-01 cache-drop swallow)
**Avoids:** Implementation-asserting tests; missing WHY in source.
**Research flag:** Standard patterns -- no research needed; reference D-19-01 in source.

### Phase Ordering Rationale

- TR-02 first: ledger foundation; all orchestrators run inside `runPhases` and benefit
  immediately; lowest blast radius for a mistake.
- TR-01/TR-05/TR-06 together: same sequential-rename-loop-with-reverse shape; extract
  helpers once; bridges share the pattern and must not diverge.
- TR-03 before TR-04: cascade-pathway fix establishes the partial-success state-mutation
  pattern that TR-04's direct-pathway refactor must mirror; lets cascade be tested in
  isolation first.
- TR-04 last among structural fixes: most invasive change (split `withStateGuard`,
  ~10-15 test rewrites); depends on bridge rollback (Phase 2) being validated.
- TR-07/TR-08 last: docs + tests only; reference final contracts.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (TR-04):** 4-bridge × 2-outcome failure matrix has 16 cases; per-bridge vs.
  all-or-nothing state split needs explicit enumeration before coding. Verify persistence
  schema allows `installable: false` with `notes` field without breaking `list` rendering.

Phases with standard patterns (skip research-phase):
- **Phase 1 (TR-02):** One-line reorder; `rollbackExecuted` contract fully documented in source.
- **Phase 2 (TR-01/TR-05/TR-06):** `rollbackReplacementCommon` is the verified reference shape.
- **Phase 3 (TR-03):** `dropped.*` accumulation contract already adequate; fix is at caller boundary.
- **Phase 5 (TR-07/TR-08):** Docs + tests only; D-19-01 reference established.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm registry queried 2026-06-02; project source confirmed no new dep needed; all alternatives surveyed and rejected |
| Features/Patterns | HIGH | All eight patterns sourced from actual source reads of `phase-ledger.ts`, `bridges/*/stage.ts`, `update.ts`, `shared.ts`; `rollbackReplacementCommon` is the verified reference shape |
| Architecture | HIGH | All touchpoints confirmed from line-level source reads; pre/post-v1.7 data-flow diagrams cross-checked |
| Pitfalls | HIGH | All five critical pitfalls sourced from actual test files (`update.test.ts:744`, `stage.test.ts:388`) and current buggy code paths |

**Overall confidence:** HIGH

### Gaps to Address

- **TR-04 failure matrix:** 4-bridge × 2-outcome cases must be enumerated in the Phase 4
  planning doc before implementation. Verify persistence schema allows `installable: false`
  with `notes` field without breaking `list` rendering.
- **TR-03 helper extraction:** `applyPartialUnstageToRecord` is optional; Phase 3 planner
  decides locality vs. deduplication.
- **TR-01/TR-05 leak shape:** Confirm `appendLeakToError` concat shape handles K rollback
  failures (not just 1). Flag for Phase 2 planner.
- **TR-06 ownership marker for skills/commands:** Skills and commands have no per-file
  ownership marker (only agents have `isOwnedAgentFile`); orphan-detection falls back to
  state.json membership check only. Document as a design decision in Phase 2 planning.

## Sources

### Primary (HIGH confidence)

- Project source: `extensions/pi-claude-marketplace/transaction/phase-ledger.ts` -- TR-02 fix site; push-after-await bug at line 121; `Phase<C>`, `runPhases`, `rollbackExecuted` exports
- Project source: `extensions/pi-claude-marketplace/bridges/agents/stage.ts` -- TR-01 fix site (step-2 parallel rename line 343); TR-06 fix site (line 432-434); `rollbackReplacementCommon` reference shape (lines 135-177)
- Project source: `extensions/pi-claude-marketplace/bridges/commands/stage.ts` -- TR-05 fix site; TR-06 commands variant
- Project source: `extensions/pi-claude-marketplace/bridges/skills/stage.ts` -- TR-06 skills variant; donor of correct `commitPreparedSkills` pattern
- Project source: `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:867-923` -- TR-04 fix site; `swapStateRecord` before phase-3a; continue-on-failure contract
- Project source: `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:317-395` -- TR-03 fix; `dropped.*` accumulation; AG-5 foreign-content throw at lines 350-365
- Project source: `tests/orchestrators/plugin/update.test.ts:744` -- PUP-6 phase-3 failure test; FILE obstacle; ENOTDIR trigger contract
- Project source: `tests/bridges/skills/stage.test.ts:388-421` -- PI-6 collision rejection test; the test TR-06 is most likely to break
- npm registry (2026-06-02): `write-file-atomic@8.0.0`, `proper-lockfile@4.1.2`, `neverthrow@8.2.0` -- all confirmed current; no action needed
- Node.js official docs -- `fs.rename`, `fs.rm({force:true})` semantics; `Promise.allSettled` cascade pattern

### Secondary (MEDIUM confidence)

- Microsoft Azure Compensating Transaction Pattern -- push-before-await invariant for "started → eligible for compensation"
- Temporal Saga Compensating Transactions -- saga discipline for post-commit best-effort cleanup
- CWE-367: TOCTOU -- framing for TR-06 orphan-vs-foreign distinction
- `rollbackReplacementCommon` (`shared/fs-utils.ts:135-177`) -- confirmed as the project's authoritative reference shape for reverse-walk rollback with leaks

---
*Research completed: 2026-06-02*
*Ready for roadmap: yes*

---
phase: 40
plan: 01
subsystem: orchestrators
tags:
  [
    TR-04,
    state-before-commit,
    intent-mark,
    finalize,
    partial-failure,
    hardening,
  ]
requires: [phase-39-cascade-ghost-record]
provides: [TR-04 state-write-before-commit-reorder]
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - tests/orchestrators/plugin/update.test.ts
tech_stack_added: []
tech_stack_patterns:
  [two-window-state-guard, per-bridge-orthogonal-finalize, intent-mark-marker]
key_files_created: []
key_files_modified:
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - tests/orchestrators/plugin/update.test.ts
decisions:
  - Combined plan Tasks 1 + 2 into a single commit (`952437c`) because Task 1 alone (add helpers, leave swapStateRecord) fails `noUnusedLocals` -- the new helpers are dead code until Task 2 wires them. NFR-6 (lint gate priority) drives the deviation.
  - Dropped Matrix #4 (mcp-fails-others-succeed) -- the only file-system obstacle that forces a commit-time mcp atomicWriteJson failure (directory at mcpJsonPath) ALSO trips prepareStageMcpServers's readScopedDoc with EISDIR, surfacing as a phase-2-or-earlier throw before finalize runs. Per-bridge orthogonality for mcp is structurally identical to the other three bridges and is covered by the all-success WR-04 + the three other matrix tests. Dedicated test deferred to v1.8 if a mid-flight test seam emerges. Source comment + this SUMMARY document the gap.
  - Finalize-failure routes through phase3aFailures as a synthetic `phase: "mcp"` entry per Pitfall 4 / Open Q3 RESOLVED -- no shared/errors.ts schema change.
  - ST-9 stale-version check lives in `markUpdateInProgress`; `finalizeUpdateRecord` does NOT re-check ST-9 (Open Q1 RESOLVED).
  - Module-level `UPDATE_IN_PROGRESS_NOTE = "update-in-progress"` constant locks the marker text. A1 spot-check confirmed shared/notify.ts does not consume `compatibility.notes` (zero hits); the only extension consumer is reinstall.ts (record copy), so the intent-mark marker is internal-only.
metrics:
  duration_minutes: ~45
  completed: 2026-06-02
  tasks_total: 5
  tasks_committed: 3
  tests_before: 1362
  tests_after: 1366
  tests_added: 4
---

# Phase 40 Plan 01: Update State-Before-Commit Reorder Summary

TR-04 closure: `runThreePhaseUpdate` in `orchestrators/plugin/update.ts`
no longer writes optimistic `version=NEW + resources=NEW` BEFORE phase-3a.
The single `swapStateRecord` call is replaced by two helpers bracketing
phase-3a: `markUpdateInProgress` (pre-commit intent-mark setting
`compatibility = { installable: false, notes: ["update-in-progress"] }`)
and `finalizeUpdateRecord` (post-commit per-bridge resource update +
all-or-nothing version bump). State.json now reflects truthful on-disk
content for every phase-3a outcome.

## Outcome

F4 / Pitfall 4 / Pitfall 12 state-write-before-commit divergence closed.
Post-Phase-40, on every phase-3a partial failure:

- `version` stays at `fromVersion` (no false version bump on failure).
- `compatibility.installable === false` + `notes` includes
  `"update-in-progress"` (truthful in-progress signal preserved on disk).
- Each bridge that SUCCEEDED commits its new generated names into the
  matching `resources.*` axis independently of other bridges' outcomes.
- Each bridge that FAILED leaves its `resources.*` axis at the
  pre-update value.
- The existing `RECOVERY_PLUGIN_REINSTALL_PREFIX` notification text is
  byte-identical, but the recovery hint is now STRUCTURALLY MIRRORED on
  disk -- the operator's `plugin-uninstall + plugin-install` recovery
  step is the truthful path forward because state agrees with disk.
- NFR-3 retry-safety enforced end-to-end via the SC#5 retry test:
  partial-success state from a failed first attempt converges to
  `version === toVersion + installable === true + no intent-mark leak`
  on the second attempt with NO unexpected error notifications.

D-03 continue-on-failure preserved byte-identically: the four
phase-3a try/catch blocks at update.ts:885-923 are unchanged; all four
bridges still attempt regardless of individual failures; `phase3aFailures[]`
accumulates them; the recovery-hint pipeline fires on any non-empty
`phase3aFailures`. Finalize-failure routes through `phase3aFailures`
as a synthetic `phase: "mcp"` entry per Pitfall 4 so the existing
`notifyDirectFailure` pipeline fires unchanged -- no new notification
surface.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1+2 | Add markUpdateInProgress + finalizeUpdateRecord helpers + rewire runThreePhaseUpdate + delete swapStateRecord (merged per NFR-6) | `952437c` | update.ts |
| 3 | Augment PUP-6 happy + PUP-6 phase-3 + phase3a-commands-fail + phase3a-agents-fail + WR-04 with post-state assertions (PUP-3 untouched) | `b7d22b6` | update.test.ts |
| 4 | Append 3 matrix tests (skills/commands/agents fail individually) + 1 retry test (mcp matrix deviation documented) | `4892db4` | update.test.ts |
| 5 | Regression gate (`npm run check` GREEN; 1366 tests) | (no commit; verification only) | -- |

## Acceptance Criteria

Per `.planning/phases/40-update-state-before-commit-reorder/40-VALIDATION.md`:

| Task ID | Requirement | Verification | Status | Evidence |
|---------|-------------|--------------|--------|----------|
| 40-01-01 | markUpdateInProgress sets compatibility.installable=false before commits | `node --test tests/orchestrators/plugin/update.test.ts` | PASS | PUP-6 phase-3 + phase3a-commands-fail + phase3a-agents-fail + 3 matrix tests all assert `compatibility.installable === false` AND `notes.includes("update-in-progress")` on failure path post-state |
| 40-01-02 | finalizeUpdateRecord per-bridge resources + all-or-nothing version bump | same | PASS | 3 matrix tests verify per-bridge orthogonality (failed bridge resources unchanged, succeeded bridges' resources updated, version stays at fromVersion); WR-04 verifies all-success branch (version=toVersion, installable=true, no intent-mark leak) |
| 40-01-03 | D-03 continue-on-failure preserved | same | PASS | phase3a-commands-fail + phase3a-agents-fail still GREEN; recovery hint emission byte-identical (`notifications.length === 1` invariant + `assert.match(.../plugin-uninstall \+ plugin-install...)` preserved across all failure tests) |
| 40-01-04 | 4-bridge × 2-outcome matrix: each bridge fails alone; resources reflect committed bridges only | same | PASS (with documented mcp gap) | 3 matrix tests cover skills/commands/agents fail-alone; mcp axis covered structurally via per-bridge orthogonality + WR-04 all-success; dedicated mcp matrix test deferred to v1.8 (see Decisions above + source comment) |
| 40-01-05 | retry test: partial-success seed → second run reaches version=NEW | same | PASS | `TR-04 retry: partial-success-state-converges-to-new-version` test: call 1 fails with PUP-6 obstacle; intermediate state has version=1.0.0 + installable=false + notes includes update-in-progress + resources.skills empty; obstacle cleared between calls; call 2 reaches version=1.0.1 + installable=true + no intent-mark leak + zero error notifications |
| 40-01-06 | full check passes; no regression from 1362 baseline | `npm run check` | PASS | 1366 tests green (1362 baseline + 4 new). Lint + format + typecheck clean. |

## Success Criteria Closure

| SC | Description | Closure |
|----|-------------|---------|
| SC#1 | markUpdateInProgress sets compatibility.installable=false + notes=[update-in-progress] BEFORE phase-3a; only state write before commits begin | Verified by update.ts:835-871 (function body) + update.ts:1003-1014 (call site BEFORE phase-3a). ST-9 stale-version check lives here. Tests assert intent-mark on failure path. |
| SC#2 (per-bridge) | finalizeUpdateRecord per-bridge resources update via !failedPhases.has(bridge) | Verified by update.ts:884-955 (function body, four independent `if (!failedPhases.has(...))` blocks). 3 matrix tests verify orthogonality. |
| SC#2 (all-or-nothing) | version bump + installable=true + resolvedSource only when phase3aFailures.length === 0 | Verified by update.ts:932-945 (the single all-or-nothing branch). WR-04 + PUP-6 happy verify all-success path; matrix + phase3a-* tests verify failure path leaves intent-mark intact. |
| SC#3 | D-03 continue-on-failure preserved byte-identically | Verified by grep: update.ts:1052-1090 (four phase-3a try/catch blocks unchanged from pre-Phase-40); recovery-hint emission lines 1097-1132 unchanged. |
| SC#4 | 4-bridge × 2-outcome matrix | 3 of 4 explicit matrix tests added (skills/commands/agents); mcp axis covered structurally via per-bridge orthogonality + WR-04 all-success. Documented deviation. |
| SC#5 | retry test for partial-success convergence | `TR-04 retry: partial-success-state-converges-to-new-version` test asserts end-to-end NFR-3 contract. |
| SC#6 | npm run check GREEN; test count delta recorded | 1366 tests pass; +4 from 1362 baseline. |

## Pitfall Closure

| Pitfall | Mitigation Implemented |
|---------|-------------------------|
| Pitfall 1 (per-bridge gating with !failedPhases.has, NOT length === 0) | finalizeUpdateRecord has four independent `if (!failedPhases.has(bridge))` blocks (not a single `if (phase3aFailures.length === 0)` wrapper). The all-or-nothing branch is reserved for version + installable + resolvedSource. |
| Pitfall 2 (test suite co-adaptation) | Existing tests augmented in place with appended post-state blocks; no test seeds or notification assertions modified. PUP-3 left untouched as planned. PUP-6 phase-3 `notifications.length === 1` invariant preserved. |
| Pitfall 3 (two-withStateGuard + intent-mark as cross-process signal) | Two separate `withStateGuard` calls (intent-mark + finalize) bracket phase-3a; phase-3a commits run WITHOUT the per-scope lock held; intent-mark `installable: false + notes: [update-in-progress]` is the documented cross-process coordination signal. ST-9 only in intent-mark, not finalize. |
| Pitfall 4 (finalize-failure routing) | finalize catch synthesizes `{ phase: "mcp", msg: "state finalize failed: ...", cause: finalizeErr }` and pushes into phase3aFailures so the existing recovery-hint pipeline fires. No `shared/errors.ts` schema change. Source comment cites Pitfall 4 + Assumption A3. |
| Pitfall 5 (PUP-6 obstacle preserved) | No bridge commit path or replacePrepared* helper modified. Phase 38's removeOrphanIfPresent is kind-strict + state.json-membership-discriminated; the "obstacle" file is NOT removed; rename ENOTDIR fires as before. PUP-6 GREEN. |
| Pitfall 6 (WR-04 post-state expansion) | WR-04 augmented with `version === "1.0.1"`, `installable === true`, `!notes.includes("update-in-progress")`, all four `resources.*` assertions. PUP-6 happy augmented with the no-intent-mark-leak assertion. |
| Pitfall 7 (supported/unsupported carry-forward on intent-mark) | markUpdateInProgress reads `sRecord.compatibility.supported`/`.unsupported` (existing sRecord values), NOT preflight.installable.supported/.unsupported. Verified at update.ts:864-867. |
| Pitfall 8 (reassignment, never in-place) | All resource mutations use `sRecord.resources.X = handles.X.result.recorded.map(...)` -- reassignment only, no push/splice/sort. Matches Phase 39 / pre-Phase-40 swapStateRecord idiom. |
| Pitfall 12 (re-entrant retry) | The retry test (SC#5) seeds partial-success state (version=fromVersion, intent-mark present), clears the obstacle, and asserts second-run convergence to version=toVersion with installable=true and no error notifications. Verified end-to-end. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 + Task 2 merged into one commit**

- **Found during:** Task 1 typecheck
- **Issue:** Plan's Task 1 added the two helpers but left them as dead code until Task 2 wired them. Project tsconfig enables `noUnusedLocals: true`, so the helpers triggered TS6133 errors at Task 1 commit boundary. NFR-6 (`npm run check` must stay GREEN) takes priority.
- **Fix:** Combined Task 1 + Task 2 into a single atomic edit (add helpers + rewire `runThreePhaseUpdate` + delete `swapStateRecord`) and a single commit (`952437c`). All intermediate states still typecheck; the per-commit verification gate (`npm run check`) passes at each commit boundary.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
- **Commit:** `952437c`

### Architectural Deviations

**2. [Rule 4 - Architectural] Matrix #4 (mcp-fails-others-succeed) test dropped**

- **Found during:** Task 4 (first run of new matrix tests)
- **Issue:** The mcp bridge's `prepareStageMcpServers` reads `locations.mcpJsonPath` via `readScopedDoc` at the start of prepare (stage.ts:178). The only file-system obstacle that reliably forces a commit-time `atomicWriteJson` failure -- a DIRECTORY at the target path -- ALSO trips the prepare-step `readFile` with EISDIR. Phase-2-or-earlier throws are routed through `notifyDirectFailure` in updatePlugins's outer catch (update.ts:332) BEFORE phase-3a runs, so `finalizeUpdateRecord` never executes and the per-bridge orthogonality gate for mcp is never exercised in test.
- **Rationale for omission:** The per-bridge orthogonality contract in `finalizeUpdateRecord` is structurally identical for the mcp axis to the other three bridges (literally the same `if (!failedPhases.has("mcp"))` gate). The three explicit matrix tests (skills/commands/agents) demonstrate the gate semantics from three different angles; the all-success WR-04 test verifies the !failedPhases.has("mcp") => write path. A mid-flight failure injection (post-prepare, pre-commit) for mcp would require a test seam that does not exist today.
- **Mitigation:** Source comment at the gap site cross-references this SUMMARY and the deferred v1.8 follow-up. The matrix coverage attestation block in the test file explicitly notes the mcp axis is structurally covered.
- **Verification:** The plan's expected `grep -c "TR-04 matrix:" tests/orchestrators/plugin/update.test.ts === 4` becomes `=== 3`; the verification block in the SUMMARY documents the actual count.
- **Files modified:** tests/orchestrators/plugin/update.test.ts (test omitted; comment added in its place)
- **Commit:** `4892db4`

## Hand-offs

- **Phase 41 (TR-07 + TR-08 docs/test closeout):** unblocked.
- **No other v1.7 phase blocked** by Phase 40 outcomes.
- **v1.8 follow-ups:**
  - Dedicated `phase: "finalize"` Phase3Failure member (Open Q3 deferred; `shared/errors.ts` schema change with consumer ripple).
  - Dedicated mcp-only commit-time failure matrix test (requires post-prepare, pre-commit test seam -- likely a `commitPreparedMcp` mock injection point).
  - GC sweeper for stale intent-marks using `sRecord.updatedAt` (Open Q5 noted; not needed for v1.7 correctness).

## Files Touched

| File | Status | Lines Changed | Purpose |
|------|--------|---------------|---------|
| extensions/pi-claude-marketplace/orchestrators/plugin/update.ts | modified | +202, -26 | swapStateRecord removed; markUpdateInProgress + finalizeUpdateRecord added; runThreePhaseUpdate rewired; module constants added |
| tests/orchestrators/plugin/update.test.ts | modified | +397, -0 (across 2 commits) | 4 existing tests augmented (PUP-6 happy, PUP-6 phase-3, phase3a-commands-fail, phase3a-agents-fail, WR-04) + 3 matrix tests + 1 retry test added |

## Commit Chain

| Commit | Subject |
|--------|---------|
| `952437c` | refactor(orchestrators): split swap into intent-mark + finalize (TR-04) |
| `b7d22b6` | test(orchestrators): augment update tests with post-state (TR-04) |
| `4892db4` | test(orchestrators): TR-04 matrix + retry tests (SC#4 + SC#5) |

## Self-Check: PASSED

- update.ts modifications verified: `grep -c swapStateRecord` returns 4 (all comments; function deleted); `grep -c markUpdateInProgress\|finalizeUpdateRecord` returns 9; `grep -n UPDATE_IN_PROGRESS_NOTE` shows module-level declaration + 2 internal uses; `grep -c await withStateGuard` returns 2 call sites (intent-mark + finalize); PHASE3_FAILURE_PHASES tuple declared + used via `.includes()` filter in finalize.
- All commit hashes (`952437c`, `b7d22b6`, `4892db4`) confirmed in `git log`.
- 1366 tests GREEN via `npm run check`.

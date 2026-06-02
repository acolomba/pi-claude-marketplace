---
title: Architecture Research -- v1.7 Transaction Resilience Hardening
project: pi-claude-marketplace
milestone: v1.7
researched: 2026-06-02
---

# Architecture Research: Transaction Resilience Hardening Integration

**Project:** pi-claude-marketplace v1.7 Transaction Resilience Hardening
**Mode:** Project Research (architecture for integrating rollback correctness)
**Confidence:** HIGH (all findings grounded in actual source reads)

## Executive Summary

The 8 fixes (TR-01..TR-08) cluster into three architectural surfaces that already exist and need targeted, in-place corrections rather than new components. No new files are required for the load-bearing fixes. All changes are localized to existing modules. The build order is dictated by one fact: **TR-04 (update.ts state-before-commit) depends on TR-01 and TR-05 being available**, because once update.ts reorders commits-before-state-write, the bridges become the rollback boundary that update.ts leans on.

The fixes follow three patterns already in the codebase:

1. **Atomic ledger semantics (TR-02):** One-line change to `runPhases` -- push to `executed` BEFORE `phase.do` runs.
2. **Sequential rename loops with reverse-rename rollback (TR-01, TR-05):** Exact pattern used in `replacePreparedAgents`/`replacePreparedCommands` and `rollbackReplacementCommon` already exists.
3. **State invariant ownership at orchestrator boundaries (TR-03, TR-04, TR-06):** Orchestrator-tier policy bugs about WHEN state is written relative to physical commits.

## Integration Points: New vs Modified

| Component | New / Modified | Surface | Notes |
|---|---|---|---|
| `transaction/phase-ledger.ts :: runPhases` | **MODIFIED** | 1-line reorder of `executed.push(phase)` | TR-02. No type changes. |
| `bridges/agents/stage.ts :: commitPreparedAgents` | **MODIFIED** | Replace step-2 `Promise.all` with tracked sequential loop + reverse rollback | TR-01. Uses existing `_stagedFilePaths` shape. |
| `bridges/commands/stage.ts :: commitPreparedCommands` | **MODIFIED** | Add `renamed[]` tracking + reverse rollback to sequential loop | TR-05. Uses existing `_renamePairs` shape. |
| `shared/fs-utils.ts :: removeOrphanIfPresent` | **NEW** | Extract stat-based orphan-rm from `commitPreparedSkills` | TR-06. Shared by all replace + commit paths. |
| `bridges/skills/stage.ts :: replacePreparedSkills` | **MODIFIED** | Replace `pathExists` guard with `removeOrphanIfPresent(pair.to, "tree")` | TR-06. |
| `bridges/commands/stage.ts :: replacePreparedCommands` | **MODIFIED** | Replace `pathExists` guard with `removeOrphanIfPresent(pair.to, "file")` | TR-06. |
| `bridges/agents/stage.ts :: replacePreparedAgents` | **MODIFIED** | Replace `pathExists` guard with `removeOrphanIfPresent(pair.to, "file")` | TR-06. |
| `bridges/skills/stage.ts :: commitPreparedSkills` | **NO CHANGE** | Already correct; donor of the pattern | Reference impl. |
| `orchestrators/marketplace/shared.ts :: cascadeUnstagePlugin` | **NO CHANGE** | The `dropped` contract is already adequate | TR-03 fix lives in orchestrators. |
| `orchestrators/plugin/uninstall.ts` (inside `withStateGuard`) | **MODIFIED** | NEW branch: on `outcome.ok === false`, filter `sRecord.resources.*` by `outcome.dropped.*` | TR-03 primary fix. |
| `orchestrators/marketplace/remove.ts` (inside per-plugin `withStateGuard`) | **MODIFIED** | Same NEW branch | TR-03 second fix site. |
| `orchestrators/marketplace/shared.ts :: applyPartialUnstageToRecord` | **NEW (optional)** | Helper extracted to dedupe between uninstall.ts + remove.ts | Lift if duplication offends; ~12 lines. |
| `orchestrators/plugin/update.ts :: runThreePhaseUpdate` | **MODIFIED -- STRUCTURAL** | Split single `withStateGuard` into intent-mark + finalize bracketing physical commits | TR-04. Largest change. |
| `orchestrators/plugin/update.ts :: swapStateRecord` | **REFACTORED** into `markUpdateInProgress` + `finalizeUpdateRecord` | Existing `preflight.record` snapshot reused | TR-04. |
| Test files for TR-07, TR-08 | **NEW** | Two test files under `tests/bridges/` and `tests/orchestrators/plugin/` | LOW priority. |

## Data Flow: Before vs After v1.7

### Pre-v1.7 (current, buggy):

```
install/update/uninstall orchestrator
  runPhases([prepare, swap-state, commit])
    prepare OK, push to executed
    swap-state OK, push to executed
    commit THROWS
      undo walks [prepare, swap-state] -- commit own undo SKIPPED [TR-02 bug]

cascadeUnstagePlugin(plugin)
  skills.unstage OK, commands.unstage OK, agents.unstage THROWS
  caller sees ok:false, does NOT touch state record [TR-03 bug -> ghost]

update.runThreePhaseUpdate
  prepare -> swapStateRecord (writes NEW state) -> phase-3a commits
  skills commit FAILS, commands/agents/mcp OK
  state.json: NEW. Disk: skills=OLD, commands+agents+mcp=NEW [TR-04 divergence]

agents.commitPreparedAgents
  Promise.all(K renames): one fails, K-1 orphans [TR-01 bug]

replacePreparedSkills
  if (pathExists(pair.to)) throw -- blocks legacy orphan recovery [TR-06 bug]
```

### Post-v1.7 (fixed):

```
install/update/uninstall orchestrator
  runPhases([prepare, swap-state, commit])
    push to executed, run prepare OK
    push to executed, run swap-state OK
    push to executed, run commit THROWS
      undo walks [commit, swap-state, prepare] -- commit own undo RUNS [TR-02 fixed]

cascadeUnstagePlugin(plugin) -- unchanged
  skills.unstage OK -> dropped.skills = [s1, s2]
  commands.unstage OK -> dropped.commands = [p1]
  agents.unstage THROWS, returns {ok:false, dropped:{...}, cause}
  uninstall orchestrator: filter sRecord.resources.* by dropped.* [TR-03 fixed]

update.runThreePhaseUpdate
  prepare
  intent-mark: sRecord.compatibility.installable=false [TR-04 fixed]
  phase-3a commits (continue-on-failure preserved per D-03):
    skills FAIL -> bridge reverse-rename restores staging [TR-01]
    commands OK, agents OK, mcp OK
  finalize: all-success -> write NEW record; any-failure -> leave incomplete marker

agents.commitPreparedAgents [TR-01 fixed]
  mkdir
  for-loop rename + push to renamed[]
  if throw: reverse-rename renamed[] back to staging
  leaks if reverse-rename fails -> appendLeakToError

replacePreparedSkills [TR-06 fixed]
  for each pair: removeOrphanIfPresent(pair.to, "tree")
  rename(from, to), push to renamed[]
```

## Q1: Minimal Change to `phase-ledger.ts` (TR-02)

**Current bug (`transaction/phase-ledger.ts:120-141`):**
```typescript
for (const phase of phases) {
  try {
    await phase.do(ctx);
    executed.push(phase);   // only pushed on success
  } catch (err) {
    const partials = await rollbackExecuted(executed, ctx);
    // executed does NOT include failing phase, so its undo never runs
  }
}
```

**Minimal fix:** Move `executed.push(phase)` to before `await phase.do(ctx)`. The failing phase's `undo` is then included in the reverse-walk.

**Why this is safe:**
- `Phase<C>.undo` is optional (phase-ledger.ts:30-34) and idempotent in practice (ENOENT-tolerant).
- `rollbackExecuted` checks `if (!done.undo) continue;` (line 77-79), so a phase without undo is a no-op.
- `rollbackExecuted` traverses in REVERSE order (line 76), so the failing phase's undo runs FIRST -- correct semantics.
- `PathContainmentError` re-throw at line 84-86 still wins.

**Consumer impact:** All existing call sites (install.ts, uninstall.ts, reinstall.ts) get the fix transparently.

## Q2: Rollback Surface for Promise.all Conversion (TR-01)

**Architecture for the fix** -- structurally identical to the `replacePreparedAgents` rollback already in the same file (lines 410-471), which tracks `renamed: { from, to }[]` and calls `rollbackReplacementCommon` to reverse on throw:

```typescript
const renamed: { from: string; to: string }[] = [];
try {
  await mkdir(prepared.locations.agentsDir, { recursive: true });
  for (const pair of prepared._stagedFilePaths) {
    await rename(pair.from, pair.to);
    renamed.push(pair);
  }
} catch (err) {
  for (const pair of renamed.slice().reverse()) {
    try { await rename(pair.to, pair.from); } catch { /* best-effort */ }
  }
  throw appendLeakToError(
    err,
    await cleanupStaging(prepared.stagingDir, "agents staging directory"),
  );
}
```

**Boundary clarifications:**
- Step 1 (`rm` of previous targets, lines 321-332) **stays parallel** -- ENOENT-tolerant, no orphan risk.
- Agents-index save (step 3, lines 355-362) **stays AFTER renames** -- self-heal on retry.
- `commitPreparedCommands` (TR-05) gets the same pattern; loop is already sequential, just add `renamed[]` tracking.

## Q3: cascadeUnstage Ghost Record (TR-03)

**Fix at the orchestrator boundary, not inside the cascade:**

`cascadeUnstagePlugin` already populates `dropped.*` as-it-goes (lines 331, 337, 342, 349, 367 of shared.ts). On `ok: false`, the orchestrator can use these arrays to filter the state record:

```typescript
if (outcome.ok) {
  // existing: delete the plugin record from state
} else {
  // NEW: filter sRecord.resources.* by outcome.dropped.*
  if (outcome.dropped.skills.length > 0 || outcome.dropped.commands.length > 0
      || outcome.dropped.agents.length > 0 || outcome.dropped.mcpServers.length > 0) {
    sRecord.resources.skills = sRecord.resources.skills.filter(
      n => !outcome.dropped.skills.includes(n));
    // same for prompts, agents, mcpServers
  }
  // surface partial-failure to user as before
}
```

**Touchpoints:**
- `orchestrators/plugin/uninstall.ts` -- NEW branch inside `withStateGuard`
- `orchestrators/marketplace/remove.ts` -- same NEW branch in per-plugin loop
- Optional: extract `applyPartialUnstageToRecord` helper to `orchestrators/marketplace/shared.ts`

## Q4: update.ts State-Before-Commit Reorder (TR-04)

**Two-guard "intent-mark" approach:**

```
Phase A: prepareUpdateHandles  (unchanged)
Phase B: intent-mark in withStateGuard:
           sRecord.compatibility = { installable: false, notes: ["update-in-progress"] }
           guard saves state
Phase C: physical commits (continue-on-failure, D-03 unchanged)
Phase D: finalize in withStateGuard:
           all-success -> write new version + new resources + installable=true
           any-failure -> leave installable=false + notes; user notified of rollback partial
```

**Why this preserves D-03:** All 4 bridge commits still run with failures aggregated. The `(failed) {rollback partial}` cascade at line 940-963 is unchanged. The `RECOVERY_PLUGIN_REINSTALL_PREFIX` hint becomes truthful: state genuinely is in "needs reinstall" condition, marked as such on disk.

**Depends on TR-01 + TR-05:** Once bridges own their own rename rollback, the intent-mark→commit→finalize sequence has a coherent failure model.

## Q5: replacePrepared* Orphan Blocking (TR-06)

**Lift the stat-based orphan-rm pattern from `commitPreparedSkills` (lines 232-247) into a shared helper:**

```typescript
// shared/fs-utils.ts (new export)
export async function removeOrphanIfPresent(
  target: string,
  mode: "file" | "tree",
): Promise<void> {
  try {
    const s = await stat(target);
    if (mode === "tree" && s.isDirectory()) {
      await rm(target, { recursive: true, force: true });
    } else if (mode === "file" && s.isFile()) {
      await rm(target);
    }
    // mismatched kind -> leave alone; rename will surface ENOTDIR/ENOTEMPTY as real error
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") { throw e; }
  }
}
```

Replace `if (await pathExists(pair.to)) throw ...` in all three `replacePrepared*` functions with `removeOrphanIfPresent(pair.to, "tree" | "file")`.

**Why this is safe:** The `_previousNames` loop above already moved LEGITIMATE previous targets to backup. Anything still at `pair.to` after that loop is definitionally NOT a tracked previous-target. PI-6 conflict detection ran before staging, so a legitimate other-plugin owner would have aborted earlier.

## Suggested Build Order (with Dependencies)

### Wave 1 -- Independent foundations (parallel ok):
- **Phase A:** TR-02 (phase-ledger.ts push reorder). Lowest risk, foundational.
- **Phase B:** TR-01 (agents commit sequential + reverse). Independent.
- **Phase C:** TR-05 (commands commit sequential + reverse). Independent.
- **Phase D:** TR-06 (replacePrepared* orphan tolerance + extract `removeOrphanIfPresent`). Independent.

### Wave 2 -- State-record-coherence fixes:
- **Phase E:** TR-03 (cascadeUnstage ghost record). Modify uninstall.ts + remove.ts.

### Wave 3 -- Structural reorder (depends on Wave 1):
- **Phase F:** TR-04 (update.ts intent-mark + finalize). Largest change; depends on TR-01 + TR-05 bridge rollback being available.

### Wave 4 -- Documentation + test-coverage closeout:
- **Phase G:** TR-07 + TR-08 (docs + tests for LOW findings). Independent.

## Open Questions for the Planner

1. **TR-04 schema piggyback on `installable: false`:** Verify persistence schema allows `installable: false` with `notes` field without breaking `list` command rendering.
2. **TR-03 helper extraction:** Decide whether to extract `applyPartialUnstageToRecord` to dedupe (vs. keep duplicated for locality).
3. **TR-01/TR-05 leak shape:** When reverse-rename itself fails, `appendLeakToError` accepts a single leak string. With K failures, confirm concat or array shape suffices.
4. **TR-04 test surface:** Expect ~10-15 test rewrites in `tests/orchestrators/plugin/update.test.ts`.

## Source Files Referenced

- `extensions/pi-claude-marketplace/transaction/phase-ledger.ts` -- TR-02 fix site (line 121-137)
- `extensions/pi-claude-marketplace/bridges/agents/stage.ts` -- TR-01 fix site (line 340-349), TR-06 fix site (line 432-438)
- `extensions/pi-claude-marketplace/bridges/commands/stage.ts` -- TR-05 fix site, TR-06 commands variant
- `extensions/pi-claude-marketplace/bridges/skills/stage.ts` -- TR-06 skills variant (already correct at commitPreparedSkills)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` -- TR-03 fix (dropped contract already adequate)
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` -- TR-03 primary call site
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` -- TR-03 second call site
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` -- TR-04 fix site
- `extensions/pi-claude-marketplace/shared/fs-utils.ts` -- `removeOrphanIfPresent` new export (TR-06)
- `extensions/pi-claude-marketplace/bridges/agents/marker.ts` -- `isOwnedAgentFile` (TR-06 reference)

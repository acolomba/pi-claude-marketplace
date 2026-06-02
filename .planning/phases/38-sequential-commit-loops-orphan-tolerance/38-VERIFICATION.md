---
phase: 38
slug: sequential-commit-loops-orphan-tolerance
status: passed
verified: 2026-06-02
must_haves_passed: 6/6
---

# Phase 38: Sequential Commit Loops + Orphan Tolerance Verification Report

**Phase Goal:** The agents and commands bridge commit paths are atomic at rename
granularity: a partial failure rolls back completed renames instead of leaving
orphans. The `replacePrepared*` helpers unblock reinstall after a prior partial
install by pre-removing owned orphan targets, while preserving the PI-6
foreign-content guard.

**Verified:** 2026-06-02
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (ROADMAP Phase 38 Success Criteria SC#1..#6)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `commitPreparedAgents` iterates `_stagedFilePaths` sequentially; on a rename throw, reverse-walks `[...completedRenames].reverse()` to restore renames to staging; rollback failures accumulate into `leaks[]` surfaced via `appendLeakToError` semantics (using `appendLeaks` for multi-leak); rollback loop never throws. | VERIFIED | `bridges/agents/stage.ts` lines 356-386: `const completedRenames: { from: string; to: string }[] = []` (line 356); `for (const pair of prepared._stagedFilePaths) { await rename(...); completedRenames.push(pair); }` (lines 359-362); catch block `const rollbackLeaks: string[] = []` (line 367); `for (const pair of [...completedRenames].reverse()) { try { await rename(pair.to, pair.from); } catch (rollbackErr) { rollbackLeaks.push(...) } }` (lines 368-376) -- per-pair try/catch, NEVER throws from rollback loop; rethrow via `throw appendLeaks(err, [...rollbackLeaks, await cleanupStaging(...)])` (lines 382-385). Comment at line 380-381 explicitly notes use of `appendLeaks`, NOT `ManualRecoveryError` (Pitfall 8). |
| 2  | `commitPreparedCommands` adds the same `completedRenames[]` tracking to its sequential loop; reverse-walk shape is identical to agents. | VERIFIED | `bridges/commands/stage.ts` lines 232-255: `const completedRenames: { from: string; to: string }[] = []` (line 232); sequential `for (const pair of prepared._renamePairs) { await rename(pair.from, pair.to); completedRenames.push(pair); }` (lines 235-238); catch block reverse-walks `[...completedRenames].reverse()` (line 241); rollback loop per-pair try/catch into `rollbackLeaks: string[]` (lines 240-249), NEVER throws; `throw appendLeaks(err, [...rollbackLeaks, await cleanupStaging(prepared.stagingRoot, "commands staging directory")])` (lines 251-254). Shape is structurally identical to agents -- only differences are the `stagingRoot` vs `stagingDir` field (commands convention) and the leak message string `"failed to roll back command rename..."`. |
| 3  | `shared/fs-utils.ts` exports `removeOrphanIfPresent(target, mode: "file" \| "tree")` that pre-removes a target with kind-strict semantics; ENOENT swallowed; mismatched kind leaves target alone so rename fails loudly. | VERIFIED | `shared/fs-utils.ts` lines 104-119: `export async function removeOrphanIfPresent(target: string, mode: "file" \| "tree"): Promise<void>`. Body: try `stat(target)`, then `if (mode === "tree" && s.isDirectory()) rm(...{recursive:true,force:true})` (lines 107-108); `else if (mode === "file" && s.isFile()) rm(target)` (lines 109-110); kind mismatch falls through (lines 111-113). Catch swallows ENOENT (`if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e`, lines 114-118). JSDoc (lines 72-103) documents (a) NFR-10 caller-owns-containment, (b) caller-owns-ownership (PI-6 guard at call site), (c) kind-strict guarantee, (d) ENOENT discipline. 5 unit tests at `tests/shared/fs-utils.test.ts` cover the matrix (tree+dir, tree+file mismatch, file+file, file+dir mismatch, ENOENT swallow). |
| 4  | `replacePreparedSkills`, `replacePreparedAgents`, and `replacePreparedCommands` call `removeOrphanIfPresent` instead of bare `pathExists`-throw; existing PI-6 rejection tests remain GREEN for foreign artifacts not in state.json. | VERIFIED | All three call sites have the 3-arm policy: **Skills** (`bridges/skills/stage.ts` lines 318-330): `const ownedNames = new Set(prepared._previousNames)`, `targetName = path.basename(pair.to)`, mode `"tree"`. **Agents** (`bridges/agents/stage.ts` lines 475-487): `ownedNames = new Set(prepared._previousEntries.map(e => e.generatedName))`, `targetName = path.basename(pair.to, ".md")`, mode `"file"`. **Commands** (`bridges/commands/stage.ts` lines 315-327): `ownedNames = new Set(prepared._previousNames)`, `targetName = path.basename(pair.to, ".md")`, mode `"file"`. PI-6 throws preserved byte-for-byte: `bridges/skills/stage.ts:325`, `bridges/agents/stage.ts:482`, `bridges/commands/stage.ts:322`. PI-6 rejection tests at `tests/bridges/skills/stage.test.ts:411`, `tests/bridges/commands/stage.test.ts:378`, `tests/bridges/agents/stage.test.ts:1064` remain GREEN with `/non-previous content/` regex (verified via `npm run check` 1358/0). |
| 5  | PUP-6 phase-3 failure test (`tests/orchestrators/plugin/update.test.ts:744`) still triggers its failure path. | VERIFIED | `git diff f8ecf35..HEAD -- tests/orchestrators/plugin/update.test.ts` produces zero output -- file is byte-unchanged since Phase 37. The PUP-6 test routes through `commitPreparedSkills` (NOT `replacePreparedSkills`), and TR-06 changes are confined to `replacePrepared*`. `commitPreparedSkills` is untouched (Assumption A5 / Open Question 1 deferred to v1.8). The file obstacle at `<skillsTargetDir>/hello-tool` still triggers ENOTDIR via rename in `commitPreparedSkills`. PUP-6 test PASSES as part of the 1358-test green suite. |
| 6  | `npm run check` GREEN; no regression from Phase 37 baseline (1346 tests). | VERIFIED | `npm run check` exit 0; final report: `tests 1358`, `pass 1358`, `fail 0`. New tests added = 12 (`git diff f8ecf35..HEAD -- tests/shared/fs-utils.test.ts tests/bridges/...` shows exactly 12 new `test(...)` definitions). Baseline 1346 + 12 = 1358 matches exactly. Typecheck + ESLint + Prettier all green. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/shared/fs-utils.ts` | exports `removeOrphanIfPresent(target, mode)` async helper with NFR-10 + ownership-at-call-site JSDoc | VERIFIED | Export at line 104; JSDoc at lines 72-103 covers all four contracts (NFR-10 containment, PI-6 ownership at call site, kind-strict guarantee, ENOENT discipline). |
| `extensions/pi-claude-marketplace/bridges/agents/stage.ts` | `commitPreparedAgents` step-2 sequential + `completedRenames[]` + reverse-walk + `appendLeaks`; `replacePreparedAgents` 3-arm policy with mode `"file"`, basename(`,".md"`) | VERIFIED | `completedRenames` appears 3 times (declaration, push, reverse-walk). `appendLeaks` imported at line 38 and used at line 382. `replacePreparedAgents` at lines 475-487. PI-6 throw at line 482 verbatim. |
| `extensions/pi-claude-marketplace/bridges/commands/stage.ts` | `commitPreparedCommands` step-2 same shape; `replacePreparedCommands` same 3-arm policy with mode `"file"`, basename(`,".md"`) | VERIFIED | `completedRenames` appears 4 times. `appendLeaks` imported at line 33 and used at line 251. `replacePreparedCommands` at lines 315-327. PI-6 throw at line 322 verbatim. |
| `extensions/pi-claude-marketplace/bridges/skills/stage.ts` | `replacePreparedSkills` adopts 3-arm policy with mode `"tree"`, basename(no suffix); `commitPreparedSkills` UNTOUCHED | VERIFIED | `replacePreparedSkills` at lines 318-330 uses mode `"tree"`. PI-6 throw at line 325 verbatim. `commitPreparedSkills` (lines 220-255) untouched -- still uses inline `stat`+`rm` from commit 01028ea (Assumption A5 deferred). |
| `tests/shared/fs-utils.test.ts` | 5 unit tests covering kind-strict matrix | VERIFIED | 5 new tests (tree+dir → rm, tree+file → noop, file+file → rm, file+dir → noop, ENOENT swallow for both modes) at lines 295-368. |
| `tests/bridges/agents/stage.test.ts` | TR-01 commitPreparedAgents sequential rollback + TR-06 replacePreparedAgents orphan tolerance | VERIFIED | TR-01 tests at lines 1162-1325 (2 tests: rollback shape + appendLeaks chain). TR-06 test at lines 1330-1396. |
| `tests/bridges/commands/stage.test.ts` | TR-05 commitPreparedCommands sequential rollback + TR-06 replacePreparedCommands orphan tolerance | VERIFIED | TR-05 tests at lines 623-742 (2 tests). TR-06 test at lines 767+. |
| `tests/bridges/skills/stage.test.ts` | TR-06 replacePreparedSkills orphan tolerance | VERIFIED | TR-06 test at lines 579-622. The test pre-creates `leftover.txt` inside the orphan dir and asserts it is gone post-replace, directly exercising the helper's tree-rm branch. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `bridges/agents/stage.ts::commitPreparedAgents` step-2 catch | `shared/errors.ts::appendLeaks` | `throw appendLeaks(err, [...rollbackLeaks, await cleanupStaging(prepared.stagingDir, "agents staging directory")])` | WIRED | Imported at line 38; used at line 382. |
| `bridges/commands/stage.ts::commitPreparedCommands` step-2 catch | `shared/errors.ts::appendLeaks` | `throw appendLeaks(err, [...rollbackLeaks, await cleanupStaging(prepared.stagingRoot, "commands staging directory")])` | WIRED | Imported at line 33; used at line 251. |
| `bridges/skills/stage.ts::replacePreparedSkills` rename loop | `shared/fs-utils.ts::removeOrphanIfPresent` | `if (ownedNames.has(targetName)) await removeOrphanIfPresent(pair.to, "tree")` | WIRED | Imported at line 10 destructure; called at line 323. |
| `bridges/agents/stage.ts::replacePreparedAgents` rename loop | `shared/fs-utils.ts::removeOrphanIfPresent` | `if (ownedNames.has(targetName)) await removeOrphanIfPresent(pair.to, "file")` | WIRED | Imported at line 45; called at line 480. |
| `bridges/commands/stage.ts::replacePreparedCommands` rename loop | `shared/fs-utils.ts::removeOrphanIfPresent` | `if (ownedNames.has(targetName)) await removeOrphanIfPresent(pair.to, "file")` | WIRED | Imported at line 40; called at line 320. |
| existing PI-6 rejection tests | 3-arm policy else-if branch | `ownedNames.has(targetName) === false` for foreign basename routes to else-if `throw new Error("Cannot replace ... non-previous content at ...")` verbatim | WIRED | PI-6 throws preserved byte-for-byte at skills:325, commands:322, agents:482. Verified via `grep -c "non-previous content"` (2 per file = 1 comment + 1 throw). |

### Data-Flow Trace (Level 4)

The artifacts modified in this phase are filesystem-operation helpers and bridge commit/replace paths -- not rendering components. The dynamic-data check applies via test execution: the 12 new tests assert that the helper actually performs the rm (skills test confirms `leftover.txt` gone), and that the rollback loop actually moves files back (TR-01 test asserts helper file is NOT at target post-rejection). All assertions pass.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `removeOrphanIfPresent` helper exported and importable | `grep -c "removeOrphanIfPresent" extensions/pi-claude-marketplace/shared/fs-utils.ts` | 1 | PASS |
| All three bridges import `removeOrphanIfPresent` | `grep -c "removeOrphanIfPresent" bridges/{skills,agents,commands}/stage.ts` | 2 per file (import + call) | PASS |
| `completedRenames` tracking declared + pushed in agents | `grep -c "completedRenames" bridges/agents/stage.ts` | 3 (decl + push + reverse-walk) | PASS |
| `completedRenames` tracking declared + pushed in commands | `grep -c "completedRenames" bridges/commands/stage.ts` | 4 (decl + push + reverse-walk + comment) | PASS |
| PI-6 throw byte-form preserved in each bridge | `grep -c "non-previous content"` per bridge | 2 per file (1 comment + 1 throw) | PASS |
| `appendLeaks` used in commit-path catch (NOT `ManualRecoveryError`) | `grep -n "appendLeaks\|ManualRecoveryError" agents/stage.ts commands/stage.ts` | `appendLeaks` at agents:382, commands:251; `ManualRecoveryError` only at agents:502, commands:331 (existing replacePrepared* paths) | PASS |
| Full suite GREEN with 12 new tests | `npm run check` | exit 0; `tests 1358, pass 1358, fail 0` | PASS |
| PUP-6 test byte-unchanged | `git diff f8ecf35..HEAD -- tests/orchestrators/plugin/update.test.ts` | empty (no diff) | PASS |

### Probe Execution

No probes declared for this phase (TR-01/TR-05/TR-06 are not migration/CLI tooling; verification is via `npm run check`). SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TR-01 | 38-01-PLAN.md | `commitPreparedAgents` replaces `Promise.all` rename loop with sequential `for...of` that tracks completed renames and reverse-walks on throw; rollback adopts the shape of `rollbackReplacementCommon`. | SATISFIED | SC#1 evidence above. Sequential loop + `completedRenames[]` + reverse-walk + `appendLeaks` all present in `bridges/agents/stage.ts:356-386`. |
| TR-05 | 38-01-PLAN.md | `commitPreparedCommands` adds `completedRenames[]` tracking to its existing sequential rename loop and reverse-walks on throw; same rollback shape as TR-01. | SATISFIED | SC#2 evidence above. `completedRenames[]` + reverse-walk + `appendLeaks` all present in `bridges/commands/stage.ts:232-255`. |
| TR-06 | 38-01-PLAN.md | `replacePreparedSkills`, `replacePreparedCommands`, and `replacePreparedAgents` replace `if (pathExists(pair.to)) throw` guard with `removeOrphanIfPresent(pair.to, mode)` from `shared/fs-utils.ts`; pre-removes owned orphan from prior partial install; foreign artifacts still trigger the existing PI-6 rejection. | SATISFIED | SC#3 + SC#4 evidence above. Helper exported with kind-strict semantics and full JSDoc; 3-arm policy at all three call sites with byte-preserved PI-6 throw. |

### Anti-Patterns Found

Scanned all 8 modified files (4 source, 4 test) for debt markers and stub patterns:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | -- | No `TBD`, `FIXME`, `XXX` debt markers in the modified files. The only `TODO`/`HACK`/`PLACEHOLDER` matches are inside existing comments unaffected by this phase. No empty stub implementations. No `return null`/`return []` without data source. | -- | -- |

### Audit of Documented Executor Deviations

**Deviation 1 (acknowledged):** `rm` import hoisted to top-level in `tests/bridges/agents/stage.test.ts:2`. Confirmed at line 2: `import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";` -- non-behavioral refactor; the existing inline `await import("node:fs/promises")` patterns elsewhere in the file are unaffected. ACCEPTED as a minor convenience change.

**Deviation 2 (acknowledged):** TR-06 agents orphan-tolerance test body includes the V1 generated-agent marker `"generated by pi-claude-marketplace"` so the orphan body survives the AG-5 separate Phase 3 guard before reaching the TR-06 3-arm policy.

Verified: `tests/bridges/agents/stage.test.ts:1362-1365` seeds the orphan file with:
```
---
name: pi-claude-marketplace-acme-bot
---
orphan-agent generated by pi-claude-marketplace
```

**AG-5/TR-06 distinction is correct:**
- **AG-5 (Phase 3 vintage, lines 196-216 of `bridges/agents/stage.ts`):** prepare-time scan of `_previousEntries`; for each entry, `isOwnedAgentFile(targetPath)` checks both the basename prefix (`pi-claude-marketplace-`) AND a body substring (`generated by pi-claude-marketplace`). A foreign body (missing the marker) routes the entry to `_foreignPreservedEntries` and adds an `UnstageAgentFailure`. With the marker present, the entry stays in `_previousEntries`.
- **TR-06 (this phase, lines 475-487):** rename-loop 3-arm policy. For each pair, if `basename(pair.to, ".md")` is in `ownedNames` (set from `_previousEntries`), invoke `removeOrphanIfPresent(pair.to, "file")`.

The test seeds the orphan body with the V1 marker so AG-5 classifies the file as owned (entry stays in `_previousEntries`), the replace path's backup loop sees the file at `entry.targetPath` (line 458-466), and the entry's owned basename is added to `ownedNames` for the TR-06 3-arm policy. The test assertion (`!replacedBody.includes("orphan-agent")`) proves end-to-end orphan tolerance -- the test does NOT prove the rm-branch of `removeOrphanIfPresent` directly, because by the time the TR-06 loop runs the orphan has already been moved to backup. The rm-branch IS directly exercised by:
- The 5 unit tests in `tests/shared/fs-utils.test.ts` (kind-strict matrix).
- The TR-06 skills orphan test (`tests/bridges/skills/stage.test.ts:579-622`), which asserts `leftover.txt` (a sibling file inside the orphan dir, not part of the canonical SKILL.md backup) is gone -- this can only happen if `rm({recursive:true,force:true})` ran on the orphan dir.

The agents+commands TR-06 tests are therefore a slightly weaker end-to-end contract: they prove orphan tolerance via the BACKUP path, not via the rm-branch. The SUMMARY explicitly acknowledges this at lines 167-171 ("In practice the replace path's backup loop moves the orphan into the backup dir before the rename loop runs, so the helper's rm branch never fires in the standard flow; the test still proves end-to-end orphan tolerance."). The SC#4 contract is preserved -- the call-site policy is present and the PI-6 byte-form throw is preserved.

**No sham assertion.** The TR-06 contract for agents/commands is that the rename SUCCEEDS when the basename is owned, regardless of whether the orphan got there via partial install (rm branch needed) or got rerouted into backup before the rename loop (backup branch). Both paths land at the same observable outcome: the replacement bytes are at the target post-replace. The skills test fills the gap by proving the rm-branch directly.

DEVIATION ACCEPTED as a faithful test of the TR-06 contract scoped to the agents bridge.

### Human Verification Required

(none -- all SC fully verified by codebase artifacts and automated tests)

### Gaps Summary

None. All six ROADMAP Success Criteria observably true in the codebase; all three requirements (TR-01, TR-05, TR-06) satisfied; `npm run check` GREEN at 1358/1358; PUP-6 byte-unchanged; PI-6 rejection byte-forms preserved; both documented executor deviations audited and accepted as faithful to the SC contract.

---

_Verified: 2026-06-02_
_Verifier: Claude (gsd-verifier)_

## VERIFICATION PASSED

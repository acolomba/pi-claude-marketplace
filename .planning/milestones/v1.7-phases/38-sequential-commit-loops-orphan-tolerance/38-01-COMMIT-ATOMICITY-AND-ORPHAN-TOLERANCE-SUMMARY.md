---
phase: 38-sequential-commit-loops-orphan-tolerance
plan: 01
subsystem: bridges + shared/fs-utils
tags:
  - bridges
  - commit-atomicity
  - orphan-tolerance
  - rollback
  - fs-utils
requirements_addressed:
  - TR-01
  - TR-05
  - TR-06
dependency-graph:
  requires: []
  provides:
    - shared/fs-utils::removeOrphanIfPresent helper (kind-strict orphan removal)
    - commitPreparedAgents step-2 reverse-walk rollback
    - commitPreparedCommands step-2 reverse-walk rollback
    - replacePrepared* 3-arm owned/foreign/empty policy at the rename loop
  affects:
    - All install paths that call commitPreparedAgents / commitPreparedCommands
    - All reinstall paths that call replacePreparedSkills / replacePreparedAgents / replacePreparedCommands
tech-stack:
  added: []
  patterns:
    - Sequential commit with completedRenames[] + reverse-walk rollback
      (mirrors `rollbackReplacementCommon` shape: spread-before-reverse, leaks
      accumulation, never-throw-from-rollback).
    - Kind-strict orphan pre-removal helper at the bridge replace path,
      preserving the PI-6 cross-plugin guard via call-site basename
      membership check.
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/fs-utils.ts
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - extensions/pi-claude-marketplace/bridges/commands/stage.ts
    - extensions/pi-claude-marketplace/bridges/skills/stage.ts
    - tests/shared/fs-utils.test.ts
    - tests/bridges/agents/stage.test.ts
    - tests/bridges/commands/stage.test.ts
    - tests/bridges/skills/stage.test.ts
decisions:
  - "Open Question 1 -- skills commit-step-2 sequential rollback: DEFERRED to v1.8 backlog. SC#1/SC#2 explicitly name only agents + commands; skills commit-path orphan-tolerance is already covered by the inline stat+rm from commit 01028ea, and adding reverse-walk rollback to commitPreparedSkills is orthogonal."
  - "Open Question 2 -- skills commit-path inline stat+rm refactor to call removeOrphanIfPresent: DEFERRED. The refactor is a 6-line code-dedup win on the PUP-6 path; keeping the existing inline pattern guarantees the PUP-6 test stays GREEN verbatim without risk of perturbing the file-obstacle ENOTDIR trigger."
  - "Open Question 3 -- removeOrphanIfPresent internalizes ownership: REJECTED. The helper signature stays minimal at `(target, mode)`. The PI-6 ownership discriminator (`ownedNames.has(basename(pair.to[, '.md']))`) lives at the three replacePrepared* call sites for explicit-control-flow ergonomics and to keep future bridge additions free to choose their own ownership source."
  - "Commit-path leak surfacing uses `appendLeaks(err, [...rollbackLeaks, cleanupLeak])`, NOT `ManualRecoveryError`. Per Pitfall 8: commit-path failures are transient IO (ENOSPC, EIO, ENOTEMPTY); `ManualRecoveryError` is reserved for replacePrepared* leaks that require user-visible cleanup."
metrics:
  duration: "~2 hours"
  completed: 2026-06-02
---

# Phase 38 Plan 01: Sequential Commit Loops + Orphan Tolerance Summary

Sequential commit-rollback + kind-strict orphan-tolerance for the bridges:
TR-01 closes the partial-`Promise.all` orphan-files-on-disk gap in
`commitPreparedAgents`; TR-05 mirrors it into `commitPreparedCommands`; TR-06
unblocks reinstall after a prior partial install by replacing the bare
`pathExists`-throw guard in all three `replacePrepared*` helpers with a 3-arm
policy backed by a new `removeOrphanIfPresent(target, mode)` helper. PI-6
foreign-content rejection and PUP-6 phase-3 failure trigger preserved verbatim.

## What Was Built

### Task 1 -- shared/fs-utils::removeOrphanIfPresent (commit 16f8a49)

Added a new `removeOrphanIfPresent(target: string, mode: "file" | "tree"):
Promise<void>` export to `extensions/pi-claude-marketplace/shared/fs-utils.ts`.

- Mode `"tree"` removes only when the target is a directory
  (`rm({recursive: true, force: true})`).
- Mode `"file"` removes only when the target is a regular file (`rm(target)`).
- Kind mismatch (e.g. mode `"tree"` on a file, or mode `"file"` on a directory)
  leaves the target alone -- the caller's subsequent `rename` surfaces
  `ENOTDIR`/`ENOTEMPTY` with full context.
- ENOENT on the initial `stat` is silently swallowed; any other error code
  re-throws.

JSDoc explicitly documents:
1. **Caller-owns-containment (NFR-10):** the helper does raw FS ops -- the
   caller MUST have already `assertPathInside`-d `target`.
2. **Caller-owns-ownership (PI-6 guard):** the helper does NOT verify
   ownership -- the basename-membership check lives at the call site.
3. **Kind-strict guarantee:** mismatched kind leaves the target alone.
4. **ENOENT discipline:** missing target is a no-op.

5 unit tests cover the matrix:
- mode `"tree"` + directory target -> rm.
- mode `"tree"` + file target -> noop (kind mismatch).
- mode `"file"` + file target -> rm.
- mode `"file"` + directory target -> noop (kind mismatch).
- ENOENT on either mode -> no-op (no throw).

### Task 2 -- commitPreparedAgents + commitPreparedCommands sequential rollback (commit f65b6b6)

`commitPreparedAgents` step-2: replaced `Promise.all(_stagedFilePaths.map(...))`
with a sequential `for-of` rename loop that pushes each successful pair to
`completedRenames: { from: string; to: string }[]`. On a partial-throw, the
catch block reverse-walks `[...completedRenames].reverse()` (spread-before-
reverse to avoid in-place mutation, Pitfall 1 #1) and renames each `pair.to`
back to `pair.from` inside a per-pair try/catch that NEVER throws (Pitfall 1
#2). Rollback failures accumulate into `rollbackLeaks: string[]` with the
message `failed to roll back agent rename ${pair.to} -> ${pair.from}: ${errorMessage(rollbackErr)}`.
The original error is rethrown via
`appendLeaks(err, [...rollbackLeaks, await cleanupStaging(prepared.stagingDir, "agents staging directory")])` --
NOT `ManualRecoveryError` (Pitfall 8: commit-path leaks are transient IO).

`commitPreparedCommands` step-2 gets the identical shape: the existing
sequential loop is wrapped in a try-block with `completedRenames[]` tracking,
the catch reverse-walks with `failed to roll back command rename` messages,
and the original error is rethrown via `appendLeaks` against `prepared.stagingRoot`
(note: commands handle uses `stagingRoot`, not `stagingDir`).

Step-1 of each bridge (parallel `rm` of `_previousEntries[i].targetPath` in
agents; sequential `unlink` of `previousCommandNames` in commands) is
UNCHANGED -- step-1 has no staging-side source to restore (Pitfall 1 final
paragraph; Assumption A1).

4 regression tests cover:
- **2-rename partial throw (TR-01 agents + TR-05 commands):** pre-seed
  pair #2.to as a non-empty directory; assert that forward rename #2 fails
  with ENOTEMPTY/EISDIR, the catch reverse-walks one entry, the staging dir
  is cleaned up, and the target dir contains ONLY the pre-seeded obstacle.
- **Rollback rename failure surfaces via appendLeaks (TR-01 agents +
  TR-05 commands):** same setup as above, plus a getter on `pair #1.from`
  that returns the real staging path on first access (forward) and a
  non-empty blocker dir on second access (rollback). Assert the rejection's
  `err.message` matches `/\(additionally: failed to roll back (agent|command) rename/`
  and `err.name !== "ManualRecoveryError"`.

### Task 3 -- replacePrepared* 3-arm policy adopts removeOrphanIfPresent (commit 64930e0)

In all three `replacePrepared*` helpers, replace the bare
`if (pathExists(pair.to)) throw new Error("Cannot replace ... with non-previous content")`
guard with the 3-arm policy:

```typescript
const ownedNames = new Set<string>(/* per-bridge source */);
for (const pair of ...) {
  const targetName = path.basename(pair.to /*, ".md" for agents+commands */);
  if (ownedNames.has(targetName)) {
    await removeOrphanIfPresent(pair.to, /* "tree" | "file" */);
  } else if (await pathExists(pair.to)) {
    throw new Error(`Cannot replace ... with non-previous content at ${pair.to}`);
  }
  await rename(pair.from, pair.to);
  renamed.push(pair);
}
```

Per-bridge variations:

| Bridge   | ownedNames source                                       | basename derivation             | mode    |
| -------- | ------------------------------------------------------- | ------------------------------- | ------- |
| skills   | `prepared._previousNames`                               | `path.basename(pair.to)`        | `"tree"` |
| agents   | `prepared._previousEntries.map((e) => e.generatedName)` | `path.basename(pair.to, ".md")` | `"file"` |
| commands | `prepared._previousNames`                               | `path.basename(pair.to, ".md")` | `"file"` |

The existing PI-6 throw byte-form is PRESERVED -- the three existing PI-6
rejection tests (`skills:411`, `commands:378`, `agents:1064`) stay GREEN with
their pre-existing `/non-previous content/` assertion.

3 new orphan-tolerance tests (one per bridge): pre-create an orphan dir
(skills) or file (agents, commands) at the canonical target path whose
basename IS in `ownedNames`; assert that `replacePrepared*` succeeds and the
new content lands instead of the orphan bytes. In practice the replace path's
backup loop moves the orphan into the backup dir before the rename loop runs,
so the helper's rm branch never fires in the standard flow; the test still
proves end-to-end orphan tolerance.

### Task 4 -- regression gate (no commit)

Run targeted regression invariants:

1. PI-6 rejection (`skills:411`, `commands:378`, `agents:1064`): GREEN
   verbatim. The 3-arm policy's else-if branch fires for foreign content
   (basename NOT in `ownedNames`) and throws the original message byte-form.
2. PUP-6 phase-3 failure (`tests/orchestrators/plugin/update.test.ts:744`):
   GREEN verbatim. The bridge update orchestrator routes through
   `commitPrepared*` (NOT `replacePrepared*`), so the file obstacle at
   `<skillsTargetDir>/hello-tool` is unaffected by TR-06. Open Question 1+2
   deferrals confirm `commitPreparedSkills` stays untouched.
3. `npm run check` GREEN: 1358 tests pass, 0 fail. Typecheck + ESLint +
   Prettier + node:test suite all green.

## Commit Summary

| Commit  | Title                                                                | Files                                                                                                              |
| ------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 16f8a49 | feat(shared): add removeOrphanIfPresent kind-strict helper (TR-06)   | shared/fs-utils.ts, tests/shared/fs-utils.test.ts                                                                  |
| f65b6b6 | fix(bridges): sequential commit rollback for agents/cmds (TR-01,TR-05) | bridges/{agents,commands}/stage.ts, tests/bridges/{agents,commands}/stage.test.ts                                  |
| 64930e0 | fix(bridges): replacePrepared* adopts owned-orphan pre-removal (TR-06) | bridges/{skills,agents,commands}/stage.ts, tests/bridges/{skills,agents,commands}/stage.test.ts                    |

## Verification Results

| SC   | Check                                                                          | Evidence                                                                                                                                  | Status |
| ---- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| SC#1 | `commitPreparedAgents` step-2 sequential + reverse-walk rollback + appendLeaks | `grep -c "completedRenames" agents/stage.ts` = 3 (declaration + push + reverse-walk).                                                     | PASS   |
| SC#2 | `commitPreparedCommands` step-2 same shape                                     | `grep -c "completedRenames" commands/stage.ts` = 4 (declaration + push + reverse-walk).                                                   | PASS   |
| SC#3 | `removeOrphanIfPresent(target, mode)` exported with kind-strict + ENOENT       | `grep -c "removeOrphanIfPresent" shared/fs-utils.ts` = 1 (export). 5 unit tests cover the kind-strict matrix.                             | PASS   |
| SC#4 | 3-arm policy in all three `replacePrepared*`; PI-6 byte-form preserved         | `ownedNames` declared in skills:318, agents:475, commands:315. PI-6 throws at skills:325, agents:482, commands:322 (verbatim).            | PASS   |
| SC#5 | PUP-6 phase-3 failure test stays GREEN verbatim                                | `node --test tests/orchestrators/plugin/update.test.ts` -> PUP-6 GREEN (27 tests, 0 fail).                                                | PASS   |
| SC#6 | `npm run check` GREEN, no regression                                           | 1358 tests pass, 0 fail. Typecheck + ESLint + Prettier all green.                                                                         | PASS   |

Additional checkpoints from PLAN success_criteria:

- `grep -c "non-previous content" extensions/pi-claude-marketplace/bridges/*/stage.ts`
  shows 2 per file (1 comment about the 3-arm policy + 1 throw). The throw
  byte-form is preserved verbatim:
  - `bridges/skills/stage.ts:325`: `throw new Error(`Cannot replace skill target with non-previous content at ${pair.to}`);`
  - `bridges/agents/stage.ts:482`: `throw new Error(`Cannot replace agent target with non-previous content at ${pair.to}`);`
  - `bridges/commands/stage.ts:322`: `throw new Error(`Cannot replace command target with non-previous content at ${pair.to}`);`
- No new occurrences of `new ManualRecoveryError(` in `commitPreparedAgents`
  or `commitPreparedCommands` -- the only `ManualRecoveryError` calls in
  agents+commands `stage.ts` remain at the existing `replacePrepared*`
  rollback sites (agents:502, commands:331).

## Test Count

| Source         | Pre-Phase-38 baseline | Phase 38 adds | Post-Phase-38 |
| -------------- | --------------------- | ------------- | ------------- |
| Task 1 helper  | --                    | +5            | --            |
| Task 2 commit  | --                    | +4            | --            |
| Task 3 replace | --                    | +3            | --            |
| **Total new**  | --                    | **+12**       | --            |
| **`npm run check` aggregate** | 1346-1351 (baseline as recalled) | +12 net | **1358 (passing)** |

The aggregate count after Phase 38 is **1358 GREEN tests, 0 failures**. The
baseline count was approximate per recall; the load-bearing fact is the
0-failure GREEN gate. The 12 new tests are individually verified to appear in
the test report.

## Deviations from Plan

### Deviation 1 (minor): rm imported at top-level in tests/bridges/agents/stage.test.ts

The plan didn't explicitly call for this; the existing pattern in this file
was `const { rm } = await import("node:fs/promises")` inside individual tests
that needed it. My TR-06 agents test reuses the same approach but I hoisted
`rm` into the top-level destructured import (line 2). The existing
`await import` inline patterns remain untouched -- this just adds one more
named import to the existing top-level destructure for the new test. No
behavioral change.

### Deviation 2 (minor): TR-06 agents orphan test uses the V1 generated-agent marker in the orphan body

The plan's TR-06 agents orphan test action describes pre-creating an orphan
file with deterministic content ("orphan-agent\n"). The AG-5 foreign-content
check at `replacePreparedAgents` line ~436 classifies an orphan body without
the V1 generated-agent marker (`"generated by pi-claude-marketplace"`) as
foreign, and the replace path throws "Agent replacement blocked by foreign
previous content" BEFORE the TR-06 3-arm policy at the rename loop runs.

To bypass AG-5 (which is out of TR-06 scope) and exercise the TR-06 path,
the test seeds the orphan body with the V1 marker:
`"---\nname: pi-claude-marketplace-acme-bot\n---\norphan-agent generated by pi-claude-marketplace\n"`.
The assertion confirms the orphan bytes are gone and the replacement body
carries the marker.

This is a minor implementation detail consistent with the test's intent
(prove that an OWNED orphan is tolerated). It doesn't change the TR-06
contract; AG-5 foreign-content blocking is a separate guard (Phase 3 vintage)
that lives at the prepare boundary and is orthogonal to TR-06.

## Assumption Confirmations

| Assumption | Status     | Evidence                                                                                                                                                                                                                                                                     |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1: TR-06 helper applied to `replacePrepared*` ONLY                          | CONFIRMED  | Task 3 changes confined to the three `replacePrepared*` helpers. `commitPreparedSkills` inline stat+rm at lines 238-247 NOT refactored. `commitPreparedAgents` + `commitPreparedCommands` step-2 changes are TR-01/TR-05 (sequential rollback), NOT TR-06 helper invocation. |
| A2: owned-names source = `_previousNames` / `_previousEntries.map(e => e.generatedName)` | CONFIRMED  | Verified at the 3 call sites: skills/stage.ts:318, agents/stage.ts:475, commands/stage.ts:315.                                                                                                                                                                              |
| A3: PUP-6 routes through `commitPreparedSkills` (NOT `replacePreparedSkills`)            | CONFIRMED  | Task 4 PUP-6 GREEN verbatim. `runThreePhaseUpdate` at update.ts:867-923 calls `commitPrepared*`, NOT `replacePrepared*`.                                                                                                                                                    |
| A4: `commitPreparedSkills` inline-stat-rm refactor to helper = OPTIONAL                  | DEFERRED   | Open Question 2: not refactored; risk-averse choice to keep PUP-6 byte-stable.                                                                                                                                                                                              |
| A5: `commitPreparedSkills` step-2 sequential rollback = OUT OF SCOPE                     | DEFERRED   | Open Question 1: SC#1/SC#2 explicitly name agents+commands only. Skills follow-up to v1.8 backlog.                                                                                                                                                                          |

## Open Questions Resolution

- **Q1 (skills commit step-2 rollback):** DEFERRED to v1.8 backlog. The skills
  commit-path is the most defensive of the three already (orphan pre-rm at
  lines 238-247 from commit 01028ea). Adding sequential rollback is
  orthogonal and not required for SC.
- **Q2 (skills commit-path inline stat+rm refactor to helper):** DEFERRED.
  The refactor is a 6-line code-dedup win on the PUP-6 path; keeping the
  inline pattern guarantees PUP-6 stays GREEN verbatim.
- **Q3 (helper internalizes ownership):** REJECTED. Helper signature stays
  minimal at `(target, mode)`. The PI-6 ownership discriminator lives at the
  call site (`ownedNames.has(basename(pair.to[, ".md"]))`) for
  explicit-control-flow ergonomics.

## Self-Check

- [x] `extensions/pi-claude-marketplace/shared/fs-utils.ts` -- exports `removeOrphanIfPresent`.
- [x] `extensions/pi-claude-marketplace/bridges/agents/stage.ts` -- `completedRenames` + `appendLeaks` in commitPreparedAgents; `ownedNames` + `removeOrphanIfPresent` in replacePreparedAgents.
- [x] `extensions/pi-claude-marketplace/bridges/commands/stage.ts` -- same shape for commands.
- [x] `extensions/pi-claude-marketplace/bridges/skills/stage.ts` -- 3-arm policy in replacePreparedSkills; commitPreparedSkills UNTOUCHED.
- [x] Task 1 commit 16f8a49 exists in `git log --oneline`.
- [x] Task 2 commit f65b6b6 exists in `git log --oneline`.
- [x] Task 3 commit 64930e0 exists in `git log --oneline`.
- [x] PUP-6 phase-3 failure test GREEN verbatim.
- [x] PI-6 rejection tests (3 bridges) GREEN verbatim.
- [x] `npm run check` GREEN with 1358 tests.

## Self-Check: PASSED

# Phase 4: Prune - Pattern Map

**Mapped:** 2026-11-22
**Files analyzed:** 6 (2 new-or-grown test-tier files, 1 trimmed integration file, 1 product fix, 1 unit test, 1 SUMMARY convention)
**Analogs found:** 6 / 6

Research scratch (drafts and the typed module to copy) lives at
`/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/research-04/`
(`probe/final.feature`, `probe/e.feature`, `probe/d.feature`, `prune.steps.ts`, `fix-leak.diff`, `brk/K*.json`).
That directory is scratch, not tracked source. All analogs named below are git-tracked (`git ls-files` checked).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/step_definitions/plugin/prune.steps.ts` (NEW) | test (cucumber verb step module) | request-response (run command, read RPC payload) + file-I/O (state.json, chmod walk) | `features/step_definitions/plugin/fetch.steps.ts` (shape); `plugin/publishing.steps.ts:311-327` (read-only dir + release); scratch `research-04/prune.steps.ts` (verified body) | exact |
| `features/plugin/prune.feature` (MODIFIED, +E01 M01 FL01 S01 C01 A01 P01 N02 U01 F01 F02 L01; F03 in 04-02) | test (feature) | request-response | itself (`prune.feature:7-30` existing scenarios) + `research-04/probe/final.feature` | exact |
| `test/integration/standalone-prune.test.ts` (TRIM to `:284`, `:317`, new header) | test (integration) | request-response | header style: `test/integration/marketplace-layer-remove.test.ts:1-10`, `plugin-layer-verbs.test.ts:1-10` | role-match |
| `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts` (04-02 fix) | service (orchestrator leaf) | file-I/O | itself (`:103-123`, `:365-505`) + `research-04/fix-leak.diff` | exact |
| `test/orchestrators/plugin/prune-rollback.test.ts` (04-02, +2 cases) | test (unit pair) | file-I/O | `prune-rollback.test.ts:167-184` ("discard removes the snapshot...") and `:33-41` (`restoreOps`) | exact |
| `.planning/phases/04-prune/04-0N-SUMMARY.md` | doc | - | `.planning/phases/03-marketplace-layers-and-cross-scope-install/03-03-SUMMARY.md` (`## Red proofs` :128, `## Case map` :150, `## Product fix` :161, `## Parent lines` :249, `## Threat Flags` :264) | exact |

## Pattern Assignments

### `features/step_definitions/plugin/prune.steps.ts` (verb step module, NEW)

**Analog:** `features/step_definitions/plugin/fetch.steps.ts` (lines 1-22)

Fileoverview + import order (builtin, external, internal `../../lib/*`, then `import type` world last):
```ts
/**
 * @fileoverview Steps about plugin fetch: the revision a fetch leaves in a scope's copy of a plugin.
 *
 * A fetch refreshes the URL-keyed mirror ... (MIRR-01); ... (GIT-01).
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { Then } from "@cucumber/cucumber";

import { runGit } from "../../lib/hermetic-git.ts";

import type { ScenarioWorld } from "../../support/world.ts";
```
Scope path idiom (fetch.steps.ts:25): `path.join(this.scopeRoot(scope), "pi-claude-marketplace", ...)`.
Step signature idiom: `async function (this: ScenarioWorld, plugin: string, scope: string, ...)`.

**Read-only directory + release cleanup analog:** `features/step_definitions/plugin/publishing.steps.ts:311-327` (uses `restoreDirectoryWrites([home, agentDir, projectDir])` from `features/lib/published-marketplace.ts:647`, registered via `this.onRelease`). The new repair step calls the same `restoreDirectoryWrites` on `<extensionRoot>/resources/skills`.

**Body to copy:** RESEARCH.md "Code Examples" (= `research-04/prune.steps.ts`), which passed tsc/ESLint/Prettier. Steps 1-3 in 04-01; step 4 (`Then the prune has left no backup in the {word} scope`) added only in 04-02 together with F03.

**check:features constraints** (`scripts/check-features.mjs`):
- `:196` unused step definition fails -> every step in the module must be used by a scenario in the same plan (hence step 4 only lands with F03).
- `:208` step text must be a Cucumber expression (no regex).
- `:298-301` step modules live under `step_definitions/` at depth <= 3 and end in `.steps.ts` -> `step_definitions/plugin/prune.steps.ts` is allowed.
- Rule file it cites: `.agents/skills/cucumber/rules/steps.md`; D-08: every step text names prune.

### `features/plugin/prune.feature` (feature, MODIFIED)

**Analog:** its own existing scenarios (`prune.feature:15-30`):
```gherkin
  Scenario: Pruning a scope uninstalls a dependency that no installed plugin needs
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | cascade |
      ...
    Then the result lists these plugins:
```
Copy scenario text verbatim from `research-04/probe/final.feature` (one-`When` forms of C01/A01 from `probe/e.feature`). Every "changes nothing" claim uses `the files of the {word} scope are remembered` / `are unchanged` (`scope-state.steps.ts:64`/`:71`) for every scope the command can touch; the project `.pi` must exist first (N02 creates it with `a config in scope project and layer base, with this text:` `config.steps.ts:206`). Decision IDs in parentheses at the end of titles (D-12-01, D-02-05, D-05-07, D-05-13/PRUNE-03, D-04-03). Reused-step table: RESEARCH.md "Existing steps to use". Put the cross-marketplace allow step after the `offers` step (Pitfall 3). No MCP surface: builtin profile must select 0.

### `test/integration/standalone-prune.test.ts` (TRIM)

**Header analog:** `test/integration/marketplace-layer-remove.test.ts:1-10` (also `plugin-layer-verbs.test.ts:1-9`):
```ts
// test/integration/marketplace-layer-remove.test.ts
//
// Removing a marketplace while a plugin fails to unstage (MR-7, PRUNE-03),
// across the remove orchestrator, ... The remove's `cascade` seam
// injects an EACCES unstage failure, which the cucumber harness cannot do: ...
```
Pattern: path line, blank `//`, then prose saying what the file keeps and why the harness cannot show it. The current file has no header (line 1 is `import assert`). New header: keeps "prune removes an orphan dependency through the registered command" (`:284`) and "prune --dry-run previews the orphan without writing current state" (`:317`) as internal call-absence carriers (ITSCOPE-01, "calls that must not happen"): `registeredCommand` (`:184-219`) throws on `applyReconcile` / `installMissingDependencies`, and each case checks `gitCalls.clone`/`fetch`; `:317` also pins mtimes. Everything a user can see is in `features/plugin/prune.feature`, `plugin/state-lock.feature`, `plugin/usage-errors.feature`. Cite IDs, no "Phase 4".

Kept infrastructure: `pluginRecord` (`:30`), `seedScope` (`:116`), `scopeTree` (`:167`), `registeredCommand` (`:184`). Delete: `GraphPlugin`/`seedGraphScope` (`:50-107`), `installedKeys` (`:108-115`), `import lockfile from "proper-lockfile"` (`:6`), plus any import (`loadState`, `saveState`, `ExtensionState`, `readdir`, `stat`, ...) that the two kept cases no longer use (let tsc `noUnusedLocals` + ESLint confirm). Deleted cases: `:223`(loop), `:250`, `:351`, `:417`, `:489`, `:533`, `:621`, `:670`, `:711`(loop), `:766`, `:802`, `:852`(loop).

### `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts` (04-02 fix)

**Analog:** itself. Cause site `snapshotPath` `:103-123` (`cp(target, backup, { recursive, dereference: false, verbatimSymlinks: true })` keeps 0555). Three removal sites, all `ops.removeBackup(backupRoot, { recursive: true, force: true })`:
- prepare catch (~`:440`): `await ops.removeBackup(...); throw error;`
- rollback final cleanup (~`:489`): pushes `{ phase: "backup cleanup", cause: asError(error) }`
- `discard` (~`:499-504`): catch only `hookDebugLog(\`prune: backup cleanup failed: ${errorMessage(error)}\`)`

**Fix to copy:** `research-04/fix-leak.diff` — module-private `grantBackupWrites(root)` (lstat, directory only, `chmod(mode | 0o200)`, recurse with `Promise.all`, never follows symlinks; avoids `no-await-in-loop`) and `removeBackupRoot(ops, backupRoot)`, inserted just above `preparePruneRollback` (after `artifactTargets`). Required amendments:
1. ENOENT guard in `grantBackupWrites`/`removeBackupRoot` so a missing root in the prepare catch does not mask the original error (follow the typed-error/`instanceof`-free `code === "ENOENT"` check style used elsewhere in the file's fs helpers).
2. Replace the three call sites BEFORE inserting the helper (research hang: helper replaced its own call).
3. Add `chmod`, `readdir` to the `node:fs/promises` import if absent. JSDoc cites NFR-3 and the "snapshotPath copies modes, sameEntry compares them" reason. Keep cognitive complexity <= 15.

### `test/orchestrators/plugin/prune-rollback.test.ts` (04-02, +2 cases)

**Analog:** `:167-184`:
```ts
test("discard removes the snapshot after a successful state save", async () => {
  await withHermeticEnvironment("prune-rollback-commit-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const rollback = await preparePruneRollback(locations, [fixture.member], restoreOps);

    // act
    await rollback.discard();

    // assert
    assert.deepStrictEqual(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-")),
      [],
    );
  });
});
```
`restoreOps` (`:33-41`) gives a fixed `prune-backup-ABC123` root with `removeBackup: rm`. `chmod` is already imported (`:3`); mode-change precedent at `:650` (`chmod(path.dirname(fixture.skill), 0o700)`). New case 1: before `preparePruneRollback`, add a 0555 subdirectory inside the skill dir, then `discard`, expect no `prune-backup-*` (red only under the non-DAC wrapper / non-root). New case 2: ENOENT branch (e.g. a `createBackupRoot` that returns a path then a snapshot that throws after the root is removed, or a `removeBackup` op that removes first) proving the original error propagates. Direct coverage of `prune-rollback.ts` must stay 100%. Titles cite NFR-3, not phase numbers.

### SUMMARY.md red proofs

**Analog:** `03-03-SUMMARY.md` `## Red proofs` (:128-148): scratch folder `$D`, checkout root (first log line), plan base sha, `$D/break.sh` (roots at `git rev-parse --show-toplevel`, EXIT trap, one-occurrence replacement, `--parallel 1|2`, nondac prefix, logs `exit=` and `restored=clean`), green runs with scenario counts, builtin `0 scenarios` run, then one bullet per break: site `file:line`, `-old` / `+new`, command, `N scenarios (x passed, y failed)`, failed titles with `file:line` and the failing step. Then `## Case map` table (`Case | Replaced by | Break`), `## Product fix` (04-02; natural red before the fix with log mtimes vs commit time, unit red/green), `## Parent lines` (CHANGELOG / BACKLOG / Key Decisions), `## Threat Flags` (AGENTS.md text). Record K2 as the accepted survivor and the fallow `weakened-tests` warn.

## Shared Patterns

- **Unchanged-scope proof:** `scope-state.steps.ts:64`/`:71` for every scope a command can touch (CONTEXT decision; Phase 2/3 reviews).
- **Path redaction check:** `the command result contains no absolute sandbox path` (`command.steps.ts:205`) for M01.
- **Read-only fixtures need the non-DAC shell** (`npm_config_script_shell=.../nondac-sh`); CI runs non-root.
- **Comments/titles cite spec IDs**, never phase/plan numbers (CONVENTIONS.md).

## No Analog Found

None. Every file has a tracked analog; the scratch drafts supply verified bodies.

## Metadata

**Analog search scope:** `features/step_definitions/plugin/`, `features/plugin/`, `test/integration/`, `test/orchestrators/plugin/`, `scripts/check-features.mjs`, `.planning/phases/03-*/`
**Files scanned:** ~12
**Pattern extraction date:** 2026-11-22

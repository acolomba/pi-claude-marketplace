---
phase: 02-plugin-layers-names-and-list-fold
reviewed: 2026-11-21T19:55:00Z
depth: standard
iteration: 3
files_reviewed: 2
files_reviewed_list:
  - features/plugin/reserved-names.feature
  - features/plugin/configuration.feature
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
  necessity: 0
status: issues_found
---

# Phase 02: Code Review Report (re-review, iteration 3)

**Reviewed:** 2026-11-21T19:55:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found (Info only)

## Summary

Scope: the second fix pass, commits `50fed6c` (WR-01) and `a49b3a7` (WR-02), as `git diff 3eb87af HEAD -- features/plugin/reserved-names.feature features/plugin/configuration.feature` shows. The pass changed no other build input: `extensions/`, `features/support/`, and the step definitions are unchanged since `3eb87af`. I read both feature files around the changed scenarios, `features/step_definitions/scope-state.steps.ts`, `world.ts` (`scopeRoot`, `ScopeFiles`, the `session` launch option), and the fix report with its red proofs. I did not run the suite, as directed.

Status of the iteration-2 warnings:

- **WR-01: resolved.** The Outline at `reserved-names.feature:414-442` now remembers the user scope before the command and checks `the files of the user scope are unchanged` after it, next to the project-scope pair. All four unscoped examples (`info`, `reinstall`, `marketplace update`, `marketplace remove`) carry the check. The fix report's red proof puts a write on the real bare-form miss path (`resolveScopeOrNotifyNotAdded`) and shows that the new step fails on it. The report also says a break on the orchestrated-only path left the scenario green, so the proof uses the path the typed command really runs. The snapshot is stable for the user scope: `scopeRoot("user")` is the sandbox agent directory, and the profile Pi starts with `--no-session` unless a scenario asks for `session: "saved"` (`world.ts:180-186`), so no session file appears there during the command. `configuration.feature:183` already compares that directory in the same way. The scoped Outline at `:444` and the `enable` scenario at `:472-492` name `--scope project` and keep only the project check. That is acceptable, as iteration 2 noted.
- **WR-02: resolved.** `configuration.feature:159` and `:172` now use `the files of the project scope are remembered` / `are unchanged`, so all three scenarios of the LAYER-06 apply trio (`:117`, `:149`, `:183`) compare every file of their scope. The red proof creates `data/demo-fixtures/` before apply refuses. The new text fails on it, and the control shows that the old narrow step passed on the same break. The later `declares these plugins` / `declares these marketplaces` checks of the local layer (`:173-178`) are now implied by the byte comparison. They still state what the local layer holds, which the snapshot does not show to a reader, so they are not dead weight.

New defects: none. The added lines keep the `Given`-before-`Then` order and the repeated `Given`/`Then` keywords the suite uses. The new step phrases already exist, so `check:features` has nothing new to flag. The narrow `config and installation record bytes` step keeps its other uses.

The four Info items of iteration 2 still apply and carry over below. I only corrected the `config-migration.feature` line numbers.

## Info

### IN-01: "fails as an invalid config" in the configuration titles, "fails as an invalid manifest" in the verb titles, for the same `invalid manifest` reason (carried over)

**File:** `features/plugin/configuration.feature:117`, `:149`, `:183`, versus `features/plugin/install.feature:274` and its siblings
**Issue:** Not changed in iterations 1 or 2. The two sets of scenarios report the same reason under two names, so a reader who searches titles for one wording misses the other set.
**Fix:** Pick one wording. The reason column says `invalid manifest`.

### IN-02: The pre-migration apply scenario does not pin the config files, and the pending scenario could pin the whole scope (carried over)

**File:** `features/plugin/config-migration.feature:219-247`, `:191-217`
**Issue:** The apply scenario still checks only the record and the staged skills. It says nothing about whether apply's read pass (MIG-01) writes `claude-plugins.json`, or leaves the local layer alone. The pending scenario at `:191` is a read-only command whose title says "writes no project config". It pins the base config's absence and the local layer's two members. The whole-scope step would state "pending writes nothing" in one line.
**Fix:** In the apply scenario, add `Then the "claude-plugins.json" file of the project scope does not exist` (or the declarations it should hold) and `... declares no marketplaces`. In the pending scenario, consider `Given the files of the project scope are remembered` / `Then the files of the project scope are unchanged`.

### IN-03: The `computeOrphanFold` JSDoc cites scenarios as regression guards for carry-over arms they do not exercise (carried over)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts:544-546` (outside this iteration's file list; checked unchanged)
**Issue:** "Regressions:" follows the paragraph about the `disabled`, `upgradable`, `partially-installed`, and `partially-upgradable` arms. The CMC-21 / D-13-17 list scenarios fold only an `installed` row. Only the unit tests guard those arms.
**Fix:** Name what the scenarios cover, for example "the CMC-21 / D-13-17 fold scenarios of features/plugin/list.feature (installed rows)".

### IN-04: The scope snapshot leaves out file modes and treats every non-directory, non-link entry as a regular file (carried over)

**File:** `features/step_definitions/scope-state.steps.ts:20-39`, `features/support/world.ts:137-141`
**Issue:**

- The snapshot records each entry's path and bytes, but not its mode. A refused command that changes a staged file's permission bits, such as the executable bit of a hook script, without changing its bytes still passes "unchanged".
- Every entry that is not a directory or a symbolic link goes to `readFile`. Nothing creates a socket or a FIFO under a scope root today. If something did, the step would fail with an unclear `ENXIO` on a socket, or hang until the step timeout on a FIFO. WR-01's fix now applies the snapshot to the user agent directory in four more examples, so this case is a little more likely to matter if a companion ever puts a socket there.
- The `ScopeFiles` doc comment says "a file", which hides that choice.

**Fix:** Optionally add `(await lstat(file)).mode.toString(8)` to the file and directory tuples. Assert `entry.isFile()` before `readFile`, and throw on any other entry type with its path, so a new entry type fails clearly.

---

_Reviewed: 2026-11-21T19:55:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 02-plugin-layers-names-and-list-fold
reviewed: 2026-11-21T19:39:03Z
depth: standard
iteration: 2
files_reviewed: 8
files_reviewed_list:
  - features/support/world.ts
  - features/step_definitions/scope-state.steps.ts
  - features/plugin/configuration.feature
  - features/plugin/config-migration.feature
  - features/plugin/reserved-names.feature
  - features/plugin/update.feature
  - features/plugin/list.feature
  - test/integration/plugin-layer-verbs.test.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
  necessity: 0
status: issues_found
---

# Phase 02: Code Review Report (re-review, iteration 2)

**Reviewed:** 2026-11-21T19:39:03Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Scope: the iteration-1 fix commits `4724154`, `f972b3e`, `ca3fa46`, `3f4e117`, `904daad`, `4a24414`, and `9970e43` (`git diff 211ceba..HEAD`). I read the full files in scope, the cucumber rules (`steps.md`, `world-and-stand-ins.md`, `layout.md`), and the deleted integration tests at `16c9dc1^` (`reserved-record-keys.test.ts`) and `25954ec^` (`plugin-layer-consistency.test.ts`). I did not re-run the full suite. I ran three scenarios that use the new steps under the adapter profile: `configuration.feature:117`, `configuration.feature:183` (the user scope, which snapshots the whole agent directory), and `reserved-names.feature:437`. All 3 passed (46 steps).

Status of the iteration-1 findings:

- **CR-01: resolved.** Both LAYER-06 apply scenarios (`configuration.feature:117`, `:183`) now compare every file of the scope and add `declares no marketplaces`. The pending scenario (`config-migration.feature:191`) adds `declares no marketplaces`. A local-layer "repair" now fails all three.
- **WR-01: partly resolved.** The new `the files of the {word} scope are remembered` / `are unchanged` steps cover the project scope in all nine reserved-name examples. The deleted test compared the whole hermetic home, though, and four of the examples run commands with no `--scope` that also read the user scope. Their user scope is still not pinned. See WR-01 below.
- **WR-02: resolved.** Both LAYER-04 update refusals compare every project file, so the staged `SKILL.md` bytes, which hold the version, are pinned.
- **WR-03: resolved.** `list.feature:229` puts back the old order: a folded install, then an independent `team` project marketplace. The row table is compared whole, so a duplicate row or an extra `official [project]` header fails it.
- **WR-04, WR-05: resolved.** The titles now say what the steps show.
- **WR-06: resolved.** The one-plugin loop and the `version` parameter are gone. `publish(source)` writes the same bytes, and the assertions did not change.

The shared-harness change follows the cucumber rules:

- `rememberedScopeFiles` is an initialized `readonly` field on the per-scenario world (`world.ts:277`), with no module state.
- The `Given` writes the world, and the `Then` only reads it.
- Registrations run `Given` before `Then`. The steps use `function` expressions with a typed `this`.
- The module boundary is right: `scope-state` is a shared step module, and `ScopeFiles` sits beside `ScopeBytes` in `world.ts`.
- The new step needs no release, because it creates nothing.

There are two new findings: the user-scope gap above (WR-01), and one scenario in the LAYER-06 trio that still uses the narrow byte step (WR-02). Three Info items carry over. One new Info item covers what the snapshot leaves out.

## Warnings

### WR-01: The unscoped `constructor` commands read the user scope, but only the project scope is pinned

**File:** `features/plugin/reserved-names.feature:414-440` (Examples `info x@constructor`, `reinstall x@constructor`, `marketplace update constructor`, `marketplace remove constructor`)
**Issue:** The deleted `reserved-record-keys.test.ts` (at `16c9dc1^`) called `treeBytes(root)` on the whole hermetic environment, user agent directory included, before and after each absent-name command. The replacement Outline remembers and compares only `the files of the project scope`. These four commands have no `--scope`, and the product reads both scopes for them:

- `orchestrators/marketplace/remove.ts:291-304` checks the project scope, then the user scope, before it returns `notAddedOutcome(name, ["project", "user"])`.
- `orchestrators/marketplace/update.ts:333-337` loops over `["project", "user"]` when `opts.scope` is undefined.

Here is a plausible wrong implementation: the unscoped miss path takes the user scope's state lock and saves its record, or creates `pi-claude-marketplace/` or a completion-cache file there, before it reports `marketplace not added`. The title promises "changes nothing", and this regression passes the scenario. The deleted test would have failed on it. This is the user-scope half of the original WR-01, which iteration 1 fixed only for the project scope.
**Fix:** Pin both scopes in this Outline:

```gherkin
    Given the user has run "/claude:plugin install hello@mp --scope project"
    Given the files of the project scope are remembered
    Given the files of the user scope are remembered
    When the user runs "/claude:plugin <command>"
    ...
    Then the files of the project scope are unchanged
    Then the files of the user scope are unchanged
```

`configuration.feature:183` already shows that the user-scope snapshot, which covers the whole agent directory, is stable. The scoped scenarios (`:390`, `:442`, `:470`) can take the same two lines to match the deleted test's whole-home check, but their need is lower, because each names `--scope project`.

### WR-02: The base-layer mirror of the LAYER-06 apply trio still uses the narrow byte step, so it checks less than the test it replaced

**File:** `features/plugin/configuration.feature:149-181` (lines `:158` and `:171`)
**Issue:** The deleted `plugin-layer-consistency.test.ts` (at `25954ec^`) had three "changes no file" cases, and each compared `treeBytes(scope.locations.scopeRoot)`: local-only-in-base (`:146-180`), base-only-in-local (`:184-205`), and the user scope (`:209-225`). Iteration 1 moved the first and third replacements to `the files of the <scope> scope are unchanged`. The base-layer mirror, "Applying a base layer that declares a plugin whose marketplace only the local layer declares fails as an invalid config and changes nothing", still uses `the config and installation record bytes of the project scope are remembered` / `are unchanged`. That step reads only `claude-plugins.json` and `state.json` (`config.steps.ts:55-61`).

The local layer is pinned only on its `plugins` and `marketplaces` members, and the staged resources only by name. So these regressions pass the scenario:

- apply creates `demo`'s plugin data directory before it refuses
- apply writes `mcp-adapter.json` or `agents/` before it refuses
- apply rewrites a staged `other-skill/SKILL.md`
- apply adds another member, such as `schemaVersion`, to the local layer

This is the gap WR-01 of iteration 1 named. The title says "changes nothing", the same as its two siblings.
**Fix:** Use the whole-scope steps, as the two sibling scenarios do:

```gherkin
    Given the files of the project scope are remembered
    When the user runs "/claude:plugin apply --scope project"
    ...
    Then the files of the project scope are unchanged
```

## Info

### IN-01: "fails as an invalid config" in the configuration titles, "fails as an invalid manifest" in the verb titles, for the same `invalid manifest` reason (carried over)

**File:** `features/plugin/configuration.feature:117`, `:149`, `:183`, versus `features/plugin/install.feature:274` and its siblings
**Issue:** Not changed in iteration 1. The two sets of scenarios report the same reason under two names, so a reader who searches titles for one wording misses the other set.
**Fix:** Pick one wording. The reason column says `invalid manifest`.

### IN-02: The pre-migration apply scenario does not pin the config files, and the pending scenario could pin the whole scope (carried over, extended)

**File:** `features/plugin/config-migration.feature:218-248`, `:191-217`
**Issue:** The apply scenario still checks only the record and the staged skills. It says nothing about whether apply's read pass (MIG-01) writes `claude-plugins.json`, or leaves the local layer alone. The pending scenario at `:191` is a read-only command whose title says "writes no project config". It now pins the base config's absence and the local layer's two members. The new whole-scope step would state "pending writes nothing" in one line.
**Fix:** In the apply scenario, add `Then the "claude-plugins.json" file of the project scope does not exist` (or the declarations it should hold) and `... declares no marketplaces`. In the pending scenario, consider `Given the files of the project scope are remembered` / `Then the files of the project scope are unchanged`.

### IN-03: The `computeOrphanFold` JSDoc cites scenarios as regression guards for carry-over arms they do not exercise (carried over)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts:544-546` (outside this iteration's file list; checked unchanged)
**Issue:** "Regressions:" follows the paragraph about the `disabled`, `upgradable`, `partially-installed`, and `partially-upgradable` arms. The CMC-21 / D-13-17 list scenarios, including the new one at `list.feature:229`, fold only an `installed` row. Only the unit tests guard those arms.
**Fix:** Name what the scenarios cover, for example "the CMC-21 / D-13-17 fold scenarios of features/plugin/list.feature (installed rows)".

### IN-04: The scope snapshot leaves out file modes and treats every non-directory, non-link entry as a regular file

**File:** `features/step_definitions/scope-state.steps.ts:24-35`, `features/support/world.ts:137-141`
**Issue:**

- The snapshot records each entry's path and bytes, but not its mode. A refused command that changes a staged file's permission bits, such as the executable bit of a hook script, without changing its bytes still passes "unchanged".
- Every entry that is not a directory or a symbolic link goes to `readFile`. Nothing creates a socket or a FIFO under a scope root today (I grepped `extensions/` and `features/`). If something did, the step would fail with an unclear `ENXIO` on a socket, or hang until the step timeout on a FIFO.
- The `ScopeFiles` doc comment says "a file", which hides that choice.

**Fix:** Optionally add `(await lstat(file)).mode.toString(8)` to the file and directory tuples. Assert `entry.isFile()` before `readFile`, and throw on any other entry type with its path, so a new entry type fails clearly.

---

_Reviewed: 2026-11-21T19:39:03Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

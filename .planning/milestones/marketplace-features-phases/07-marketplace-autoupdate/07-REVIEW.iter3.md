---
phase: 07-marketplace-autoupdate
reviewed: 2026-10-20T06:10:00Z
depth: standard
iteration: 2
files_reviewed: 15
files_reviewed_list:
  - .agents/skills/cucumber/rules/steps.md
  - CHANGELOG.md
  - README.es.md
  - README.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - features/lib/layer-config.ts
  - features/marketplace/autoupdate.feature
  - features/step_definitions/config.steps.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/fixtures/marketplace-autoupdate.ts
  - tests/architecture/cross-op-convergence.test.ts
  - tests/edge/handlers/marketplace/autoupdate.test.ts
  - tests/integration/marketplace-layer-autoupdate.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 7: Code Review Report (iteration 2)

**Reviewed:** 2026-10-20T06:10:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This is the second review. I re-read the whole diff from `41584da4` to HEAD for all 15 files and checked it against D-01 to D-09 in `07-CONTEXT.md`. I also checked the two fix commits for iteration 1: `4a40a0c2` (WR-01) and `e32d79a1` (WR-02).

**The fixes for iteration 1 are correct.**

- **WR-01 (fixed):** The new scenario at `features/marketplace/autoupdate.feature:306-324` adds a marketplace only with `--local`, runs a nameless `autoupdate --scope project`, and checks four things: the full row, the tally, the local entry with `autoupdate: true`, and no base config. If `inheritAfterFlip` drops its check of whether the base config declares the marketplace, the local entry inherits `true`, the row becomes `skipped`, and the scenario fails.
- **WR-02 (fixed):** The new scenario at `features/marketplace/autoupdate.feature:184-202` starts both scopes off and expects two `autoupdate enabled` rows, project first, with both base configs `true`. If `flipScopes` stops after the first scope that changes, the user row is missing and the scenario fails.
- The fix commits touch only the feature file. No production code changed after iteration 1.

**I ran these checks myself.** Each one used a temporary `HOME`, `TMPDIR`, and `PI_CODING_AGENT_DIR` in the session scratchpad. None touched the real `~/.pi/agent`.

- `npx cucumber-js features/marketplace/autoupdate.feature`: 34 scenarios and 334 steps, all passed.
- `npm run check:features`: exit 0.
- `node --test` on four test files passed: the orchestrator, edge, cross-op convergence, and catalog contract tests. The integration test `tests/integration/marketplace-layer-autoupdate.test.ts` also passed.
- `fallow audit --base 41584da4`: verdict `pass`. It found no dead code, no complexity findings, and no clone groups.
- **Mutation probe for WR-03.** I copied the tree to the scratchpad, symlinked `node_modules`, and changed `inheritAfterFlip` to drop the `enable &&` term. All 34 scenarios still passed. Only one unit test failed: `D-MF-03: an unnamed disable writes the base entry and leaves a local entry without a value to inherit it`. Nothing in the repository was changed.

**Production code.** Iteration 1 confirmed the D-02 to D-05 truth table, and it still holds. I checked again for new defects:

- **`layerAlreadySet`:** `layer.local && inherited(name)` short-circuits, so a base layer never asks for an inherited value. A nameless flip without `--local` therefore never reads an invalid base config here; `loadFlipLayer` has already failed on it.
- **Named flip:** `planNamedFlip` now always loads the other layer, also in orchestrated mode. `loadConfig` never throws, and no production caller uses orchestrated mode: only the edge handler and `bootstrap.ts` call it, both standalone. So this adds no failure path.
- **Partial writes:** under D-04, a local entry without a value is not in any write batch. The `FlipWriteFailure` "done" set still reports a name only when every batch that holds the name has landed. This is correct in both write orders.
- **D-08:** checked again. The whole-result field comparison (`namesLike` adds the fields that the table leaves out) makes the D-08 Outline fail if a `scope` field comes back.

**Remaining issue.** One warning: D-04 for the disable direction is pinned only by a unit test.

## Structural Findings (fallow)

`fallow audit --base 41584da4` returned verdict `pass`: 0 dead-code issues, 0 complexity findings, 0 duplication clone groups.

## Narrative Findings (AI reviewer)

## Warnings

### WR-03: No scenario covers a nameless `noautoupdate` without `--local`, so D-04 in the disable direction rests only on a unit test

**File:** `features/marketplace/autoupdate.feature:279-305` (and `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:313-316`)

**Issue:** D-04 says a nameless flip without `--local` leaves a local entry without a value unwritten when the flip writes the base config. The feature file has no scenario for `/claude:plugin marketplace noautoupdate` without a name and without `--local`. The only nameless `noautoupdate` scenario is at line 517, and it uses `--local`. The four nameless enable scenarios (lines 123, 279, 306, and 422) cannot tell these two versions apart:

- the correct `inheritAfterFlip`: `enable && base declares name`
- a version that drops `enable &&`: `base declares name`

For every enable they return the same value.

I ran this mutation in a scratch copy of the tree. All 34 scenarios passed. Only the unit test `D-MF-03: an unnamed disable writes the base entry and leaves a local entry without a value to inherit it` failed.

**What a user would see with the mutation:**

- Take a marketplace whose base entry is on and whose local entry has no value. A nameless `noautoupdate --scope project` writes `autoupdate: false` into the base entry. It also writes an explicit `autoupdate: false` into the local entry, which D-04 forbids.
- The row still reads `autoupdate disabled`, so nothing looks wrong.
- The extra local `false` is a per-machine override that nobody asked for. Later, someone turns autoupdate on in the shared base config, for example through version control. The local `false` still wins, so the setting that applies stays off.

D-06 requires a scenario for each behavior change in D-02 to D-04. D-02 says the rule covers nameless flips "with and without `--local`". This warning is the disable-side twin of WR-01 from iteration 1.

**Fix:** Add a scenario that mirrors the one at line 279 for the disable direction:

```gherkin
  Scenario: Disabling autoupdate for every marketplace sets the base config and leaves a local entry without a value to inherit it
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace noautoupdate --scope project"
    Then the result has these fields:
      | kind                | cascade                  |
      | severity            | info                     |
      | needs reload        | false                    |
      | tally label         | Marketplace noautoupdate |
      | tally failures      | 0                        |
      | tally warnings      | 0                        |
      | tally success count | 1                        |
    Then the result lists these marketplaces:
      | name  | scope   | status              |
      | tools | project | autoupdate disabled |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | false      |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
```

The last table has no `autoupdate` column. With the mutation, the local entry gains `autoupdate: false`, `recordTable` adds that column, and the scenario fails.

## Info

### IN-01: The inherited-value path reports an unreadable base config as `{invalid manifest}` / "failed schema validation" (carried forward)

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:301-311`

**Issue:**

- `loadConfig` (`persistence/config-io.ts:126-157`) returns `status: "invalid"` for every read error except `ENOENT`, `EACCES` included. It does the same for a JSON parse failure.
- `inheritFrom` then throws `invalidConfigError`, and that message always says `failed schema validation`.
- So the `EACCES` branch of `autoupdateFailedReason` (`{permission denied}`) is never reached on this path.

The D-05 scenario (`features/marketplace/autoupdate.feature:447-470`) shows the cause `Config file "claude-plugins.json" failed schema validation.` for text that is not JSON at all. This matches the existing layer-gate behavior and D-05's choice of `invalid manifest`, so this diff did not cause it alone.

**Fix:** Optional, in a later change that covers all CFG-03 sites: carry the detail from `ConfigLoadResult.error` into the cause, or report read and parse errors separately from schema errors.

### IN-02: The module header still says a nameless flip writes every declaring layer (carried forward)

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:51-53`

**Issue:** The header says "unnamed (D-MF-03): each recorded marketplace in every layer that declares it, ...; a local entry without a value inherits the base value". This is wrong in two cases:

- Under D-04, a local entry without a value is not written when the base config declares the marketplace.
- A local-only entry inherits off, not "the base value".

**Fix:** Change the line to: "unnamed (D-MF-03): each recorded marketplace in each layer whose value, own or inherited, differs from the request (a local entry without a value inherits the base entry's value, or off when the base config does not declare it), or in claude-plugins.local.json only with --local".

### IN-03: Small inaccuracies and placement issues in the docs (carried forward)

**Files:** `README.md:182-184`, `README.es.md:180-182`, `docs/output-catalog.md:4467`, `CHANGELOG.md:29`

**Issue:**

- The README and the catalog say that a nameless flip sets the base value, "so a local entry without `autoupdate` takes the new base value". That is true only when the base config declares the marketplace. The new WR-01 scenario (`features/marketplace/autoupdate.feature:306`) shows the other case: when the base config does not declare the marketplace, the flip writes the local entry.
- The README puts the two new `--local` sentences in the paragraph about commands *with a name*. They also apply to a nameless `--local` flip.
- The catalog says the failure of the inherited-value path "writes nothing". In an unscoped run, an earlier scope may already be written. The next catalog paragraph covers that case, so this is only imprecise.
- The D-08 sub-bullet in the CHANGELOG (the no-scope miss) is under the entry about declaring a marketplace in both configs. That change has nothing to do with layers.

**Fix:**

- Add "when the base config declares the marketplace" to the inheritance clause.
- Move the `--local` sentences next to the exception for nameless flips, or write "with or without a name".
- Consider a separate top-level CHANGELOG bullet for the D-08 change.

---

_Reviewed: 2026-10-20T06:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

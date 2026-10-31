---
phase: 07-marketplace-autoupdate
reviewed: 2026-10-20T04:58:35Z
depth: standard
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
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-10-20T04:58:35Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

I reviewed the diff from `41584da4` to HEAD for all 15 files, checking it against D-01 to D-09 in `07-CONTEXT.md`. I also ran the evidence myself, with temp `HOME`, `TMPDIR`, and `PI_CODING_AGENT_DIR` directories in the scratchpad:

- `npx cucumber-js features/marketplace/autoupdate.feature`: 32 scenarios, 315 steps, all passed.
- `npm run check:features`: passed.
- `node --test` on the orchestrator, edge, cross-op convergence, catalog contract, config-state consistency, and integration autoupdate tests: 130 tests, all passed.
- Direct coverage of `orchestrators/marketplace/autoupdate.ts` from its paired test: 100% lines, branches, and functions.

The production change matches the decisions:

- **Inheritance (D-02 to D-05):** `layerAlreadySet`, `inheritFrom`, and `inheritAfterFlip` are correct. I traced every combination of own value, base value, and base-declares, for enable and disable, named and nameless, with and without `--local`. They give the D-02 to D-05 truth table.
- **Partial writes:** the `FlipWriteFailure` "done" computation still reports only names whose effective value really changed, in either write order.
- **D-08 miss:** `notifyNamedMiss` drops the scope only when `--scope` is absent. That matches `docs/json-output.md`, where `scope` is optional ("Selected scope when specified").
- **Hermetic:** no scenario or test reached the real home directory.

I found no blockers. The two warnings are gaps in the behavioral suite. In each, a plausible wrong implementation passes every scenario, and only the unit tests catch it, or nothing does.

## Structural Findings (fallow)

`fallow audit --changed-since 41584da4` (verdict pass) reported no findings: 0 unused exports, 0 unused files, 0 duplicates, 0 circular dependencies.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: No scenario pins that a local-only entry without a value inherits off in a nameless flip without `--local`

**File:** `features/marketplace/autoupdate.feature:259-284` (and `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:314-316`)
**Issue:** D-02 says the inheritance rule applies "to named and nameless flips, with and without `--local`", and D-06 says each behavior change first gets a scenario. The nameless flip without `--local` judges a local entry by `inheritAfterFlip(base, enable)`, which is `enable && base declares name`. Suppose a wrong `inheritAfterFlip` returns `enable` without checking whether the base config declares the marketplace. It still passes all 32 scenarios:

- The two nameless scenarios without `--local` that have a local entry (lines 259 and 382) both use a marketplace that the base config also declares.
- The D-01 scenario has no local entries.

With that mutation, `/claude:plugin marketplace autoupdate` over a marketplace added only with `--local` reports `(skipped) {already autoupdate}` and writes nothing, while the value that applies stays off. That is a user-visible lie. Only the unit test `D-MF-03: an unnamed enable writes a local entry the base config does not declare` catches it.
**Fix:** Add a scenario such as:

```gherkin
  Scenario: Enabling autoupdate for every marketplace writes a local entry the base config does not declare
    Given the marketplace "tools" is published as a dir source
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace autoupdate --scope project"
    Then the result has these fields:
      | kind                | cascade                |
      | severity            | info                   |
      | needs reload        | false                  |
      | tally label         | Marketplace autoupdate |
      | tally failures      | 0                      |
      | tally warnings      | 0                      |
      | tally success count | 1                      |
    Then the result lists these marketplaces:
      | name  | scope   | status             |
      | tools | project | autoupdate enabled |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | true       |
    Then the "claude-plugins.json" file of the project scope does not exist
```

### WR-02: AU-09 "changes both" is never shown: no scenario has an unscoped named flip that changes both scopes

**File:** `features/marketplace/autoupdate.feature:163-182`
**Issue:** AU-09 (REQUIREMENTS.md:140) is "Without `--scope`, `autoupdate <name>` for a name both scopes hold changes both", and the milestone invariant repeats it. `07-VALIDATION.md` maps AU-09 to "Enabling autoupdate without a scope judges each scope that holds the marketplace on its own". In that scenario the project scope is already on (`skipped`), and only the user scope changes. Line 239 changes only the user scope. So no scenario has two `autoupdate enabled` rows from one named flip.

Suppose a wrong `flipScopes` stops after the first scope that changes, for example by returning after the first non-empty `plan.changed`. It passes every scenario, because the only scope that changes comes last. CONTEXT left the choice of starting values to the planner. The chosen data proves the per-scope judgment but not "changes both".
**Fix:** Add a scenario where both scopes start off and both report `autoupdate enabled`, with both base configs asserted `true`. Or add a second example in which the user scope is already on and the project scope changes. Either way, a stop-after-first-change mutation fails.

## Info

### IN-01: The new inherited-value path reports an unreadable base config as `{invalid manifest}` / "failed schema validation"

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:301-311`
**Issue:**

- `loadConfig` (`persistence/config-io.ts:126-140`) turns every read error except `ENOENT` into `status: "invalid"`, including `EACCES`. It turns a JSON parse failure into `status: "invalid"` too.
- `inheritFrom` then throws `invalidConfigError`, whose message always says `failed schema validation`.
- The `EACCES` branch of `autoupdateFailedReason` (`{permission denied}`) is never reached on this path.

Before this phase, the `--local` nameless path never read the base config. So a base config that is permission-denied or not valid JSON now fails a `--local` flip with a misleading reason and cause. The D-05 scenario shows the cause `Config file "claude-plugins.json" failed schema validation.` for text that is not even JSON. This matches the existing layer-gate behavior (`other-unreadable`) and D-05's choice of `invalid manifest`, so it is not a defect of this diff alone.
**Fix:** Optional. Carry the `ConfigLoadResult.error` detail into the cause, or tell read errors apart from schema errors, in a later change across all the CFG-03 sites.

### IN-02: The module header still describes the nameless flip as writing every declaring layer

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:51-53`
**Issue:** "unnamed (D-MF-03): each recorded marketplace in every layer that declares it" now has an inheritance clause added. But it still reads as if every declaring layer is written. Under D-04, a local entry without a value is no longer written when the base config declares the marketplace.
**Fix:** Reword it, for example: "unnamed (D-MF-03): each recorded marketplace in each layer whose value, own or inherited, differs from the request, or in claude-plugins.local.json only with --local".

### IN-03: Small inaccuracies and placement issues in the docs

**Files:** `README.md:182-184`, `README.es.md:180-182`, `docs/output-catalog.md:4467`, `CHANGELOG.md:29`
**Issue:**

- The README and catalog say a nameless flip writes the base config, "so a local entry without `autoupdate` takes the new base value". That is true only when the base config declares the marketplace. A local-only entry inherits off, so `autoupdate` writes it (WR-01).
- The README puts the two new `--local` sentences in the paragraph about commands *with a name*, but they also apply to the nameless `--local` flip.
- The catalog says the inherited-value failure "writes nothing". In an unscoped run, an earlier scope may already have been written. The next paragraph of the catalog covers that case, so this is only imprecise.
- The D-08 CHANGELOG sub-bullet (no-scope miss) sits under the entry about declaring a marketplace in both configs. The change has nothing to do with layers.

**Fix:** Add "when the base config declares the marketplace" to the inheritance clause. Move the `--local` sentences next to the nameless-flip exception, or say "with or without a name". Consider making the D-08 line its own top-level CHANGELOG bullet.

---

_Reviewed: 2026-10-20T04:58:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

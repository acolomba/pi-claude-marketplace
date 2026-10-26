---
phase: 07-marketplace-autoupdate
reviewed: 2026-10-20T05:28:27Z
depth: standard
iteration: 3
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

# Phase 7: Code Review Report (iteration 3, final)

**Reviewed:** 2026-10-20T05:28:27Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This is the third and final review. I re-read the diff from `41584da4` to HEAD for all 15 files, checked it against D-01 to D-09 in `07-CONTEXT.md`, and checked the three fix commits.

**The fixes from the earlier iterations are correct.** Each new scenario kills the mutant it was written for. I ran every mutant in a throwaway copy of the tree.

| Finding | Commit | Scenario | Mutant | Result |
| --- | --- | --- | --- | --- |
| WR-01 | 4a40a0c2 | line 306 | `inheritAfterFlip` without `&& base declares` | 1 failure: line 306 |
| WR-02 | e32d79a1 | line 184 | stop after the first scope that changes | per the iteration-2 review |
| WR-03 | 7732b694 | line 326 | `inheritAfterFlip` without `enable &&` | 1 failure: line 326 |

All three commits change only `features/marketplace/autoupdate.feature`. No production code changed after iteration 1.

**Behavior matrix.** I listed every cell of the local-inheritance rule once, as the fix loop asked, so this review reports all remaining gaps in one pass. I ran 22 single-token mutations of `layerAlreadySet`, `inheritFrom`, `inheritAfterFlip`, and the code that wires them together (`everyFlipLayers`, `planNamedFlip`, `planEveryFlip`). The scenarios killed 20 of them. **Two survived.** Both also passed all 64 tests in the paired unit test module and the integration test module. Each survivor sits in a cell that no scenario reaches, so each one is a Warning (WR-04, WR-05). I wrote a scenario for each one in the scratch copy. Both new scenarios pass on HEAD, and each one fails only on its own mutant, at the row step.

The cucumber SKILL's rubric would call such a gap a BLOCKER. The fix-loop instructions and iterations 1 and 2 classify this kind of gap as a Warning, so this review does too.

**Checks I ran.** All runs used a temporary `HOME`, `TMPDIR`, and `PI_CODING_AGENT_DIR` in the session scratchpad. Mutations were made only in a copy of the tree outside the repository. Afterwards, `git diff --quiet -- extensions features tests` exited 0.

- `npx cucumber-js features/marketplace/autoupdate.feature` on HEAD: 35 scenarios, 345 steps, all passed.
- `node scripts/check-features.mjs` (`npm run check:features`): exit 0.
- `node --test` on `tests/orchestrators/marketplace/autoupdate.test.ts` and `tests/integration/marketplace-layer-autoupdate.test.ts`: 64 tests, all passed. This includes runs on each surviving mutant.

**Production code.** I found no new Critical or Warning issue in `autoupdate.ts`.

- The truth table of D-02 to D-05 holds in all four modes.
- `layerAlreadySet` short-circuits, so it asks for an inherited value only for a local entry without a value. An invalid base config therefore fails a `--local` flip only when the flip needs the base value. D-05 allows this either way.
- `marketplaceLayerVerdict` returns `declared` when the target layer declares the marketplace and the other config is invalid. So the D-05 failure on a named `--local` flip really comes from `inheritFrom`. Deleting the throw in `inheritFrom` kills the scenario at line 471.
- The partial-write report in `FlipWriteFailure` stays correct under D-04, in either write order.

### Behavior matrix

Notation:

- `E` = `autoupdate`, `D` = `noautoupdate`.
- Base state `B`: `on`, `off`, `none` (declared without a value), `—` (not declared).
- Local state `L`: `—` (absent), `none`, `on`, `off`.
- A line number is the scenario in `features/marketplace/autoupdate.feature` whose result rows and config assertions pin that cell.
- "own branch" means `if (own !== undefined) return own === enable`. It does not depend on the layer or the direction. Lines 22, 38, 425, 446, and 515 pin it: the mutants `if (own)`, `if (own === true)`, `own === true`, `own !== enable`, and deleting the branch all fail.

Impossible cells (`B = —` with `L = —`) are left out. So are the named cells that the layer gate refuses: there the gate rejects the flip before the inheritance rule runs. Lines 225, 242, and 259 pin the gate.

**A. Named, without `--local`.** The target is the base layer. No code path in this mode reads the local value. `inheritFrom({status: "absent"})` is never asked, because the base layer short-circuits. The result therefore depends only on the verb and `B`.

| Verb | B | Expected result | Pinned by |
| --- | --- | --- | --- |
| E | on | skipped, nothing written | 22 (L=—), 515 (L=off) |
| E | off | enabled, base `true` | no scenario. No plausible survivor: on the base layer, `if (own)` is equivalent; the own branch is pinned |
| E | none | enabled, base `true` | 7, 184, 163 (user row) |
| D | on | disabled, base `false` | 38 |
| D | off | skipped | no scenario. No plausible survivor: `own === true` is killed by 38 |
| D | none | skipped | 54 (Outline) |

**B. Named, with `--local`.** The target is the local layer. The inherited value is `inheritFrom(base)`.

| Verb | L | B | Expected result | Pinned by |
| --- | --- | --- | --- | --- |
| E | none | on | skipped, nothing written | 405 |
| E | none | **off** | enabled, local `true` | **none. Mutant M1 survives (WR-04)** |
| E | none | none / — | enabled, local `true` | no scenario. No plausible survivor: `?? true` is killed by 386, `status !== "valid" \|\|` is killed by 370 |
| D | none | on | disabled, local `false` | 350 |
| D | none | **off** | skipped, nothing written | **none. Mutant M1 survives (WR-04)** |
| D | none | none | skipped | 386 |
| D | none | — | skipped | 370 |
| D | none | invalid | `{invalid manifest}`, nothing written | 471 |
| E | off | on | enabled, local `true` | 425 |
| E/D | on, off (other cells) | any | own branch | own branch |

**C. Nameless, without `--local`.** Both layers are used, each where it declares the marketplace. A local entry without a value inherits `enable && base declares`.

| Verb | B | L = — | L = none | L = on | L = off |
| --- | --- | --- | --- | --- | --- |
| E | on | skipped (123) | skipped. No survivor: `=== undefined` is killed by 279 | own branch | enabled, local `true` (446) |
| E | off | own branch | enabled, base only. No survivor: pre-flip value (M7) is killed by 279 | own branch | own branch |
| E | none | enabled (123, 279 `extras`) | enabled, base only (279 `tools`) | own branch | own branch |
| E | — | impossible | enabled, local `true` (306) | skipped. No survivor: removing the declares filter is killed by 533 | own branch |
| D | on | disabled (326 writes the base) | disabled, base only (326) | own branch | own branch |
| D | off / none | skipped. No survivor | skipped. No survivor: dropping `enable &&` is killed by 326 | own branch | own branch |
| D | — | impossible | **skipped, nothing written. None: mutant M2 survives (WR-05)** | own branch | own branch |

**D. Nameless, with `--local`.** Only the local layer is used. The inherited value is `inheritFrom(base)`, the same function as in mode B.

- `L = —`: no row. Pinned by 533 (`extras`).
- `L = none`: the same results as mode B. `D`/`on` is pinned by 533 (`tools`). `D`/`off` is the WR-04 cell again, and M1 survives here too.
- An invalid base config is pinned only by the shared throw (471) and the unit test "CFG-03: an unnamed --local flip that needs the value of an invalid base config fails and writes nothing".
- The wiring of this mode is pinned by 533. Reading the local config instead of the base config (M6) fails there.

**Killed mutants (20).**

- `layerAlreadySet` (7):
  - `own === undefined`, `own !== enable`, `if (own)`, `if (own === true)`, `own === true`
  - deleting the own branch
  - `!layer.local &&`, `layer.local ||`, `inherited(name)` alone
  - `!== enable` and `=== false` at the inherited return
- `inheritFrom` (5):
  - `?? true`, `!== false`
  - `!== undefined` on the entry (base declares)
  - `status !== "invalid"`
  - deleting the throw
  - `status !== "valid" ||`
- `inheritAfterFlip` (6):
  - dropping `enable &&`, dropping `&& declares`
  - `=== undefined`, `enable ||`, `!enable &&`
  - the pre-flip base value
- Wiring:
  - `inheritAfterFlip(local, …)`
  - `loadConfig(local)` for nameless `--local`
  - `inheritFrom({status: "absent"})` for named `--local`
  - removing the declares filter in `planEveryFlip`

## Narrative Findings (AI reviewer)

## Warnings

### WR-04: No scenario starts from a base entry with an explicit `autoupdate: false`, so `inheritFrom` can read "the base sets a value" as "on"

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:301-311`. Scenario gap near `features/marketplace/autoupdate.feature:386-403`.

**Issue:** No scenario starts with an explicit `false` in a base entry. The scenarios create `autoupdate: false` only as the result of a `noautoupdate`. The D-03 scenario at line 386 ("while the base layer has it off") uses a base entry without a value. MAU-4 reads that entry as off, but it goes through a different branch of `inheritFrom`.

Mutant M1 changes `inheritFrom` from

```ts
ownValue(base.config.marketplaces, name)?.autoupdate ?? false
```

to

```ts
ownValue(base.config.marketplaces, name)?.autoupdate !== undefined
```

This is a plausible mix-up between "the base entry sets a value" and "the base entry's value". The mutant changes only the `B = off`, `L = none` cells of modes B and D (named and nameless `--local`, both verbs). All 35 scenarios and all 64 unit and integration tests pass on it. The unit case table `inheritedNamedLocalCases` (`tests/orchestrators/marketplace/autoupdate.test.ts:626-656`) has no row in which the base entry for `mp` has `autoupdate: false`. Its first row puts `autoupdate: false` on a different marketplace.

What a user would see with the mutant:

- `noautoupdate <name> --local` over a base entry that is explicitly off writes an explicit local `false` and reports `autoupdate disabled`. D-03 (second bullet) says it must report `{already no autoupdate}` and write nothing.
- `autoupdate <name> --local` reports `(skipped) {already autoupdate}` and writes nothing, but the value that applies stays off. The row lies to the user.

**Fix:** Add this scenario. I checked it in a scratch copy: it passes on HEAD and fails on M1 at the row step, where the mutant gives `autoupdate disabled`.

```gherkin
  Scenario: Disabling autoupdate with --local skips a local entry without a value while the base layer has it set off
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin marketplace autoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace noautoupdate tools --scope project"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    When the user runs "/claude:plugin marketplace noautoupdate tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  | reasons               |
      | tools | project | skipped | already no autoupdate |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | false      |
```

Also add a row to `inheritedNamedLocalCases`, so the paired unit test pins the same cell:

```ts
  {
    label: "inherits off from a base entry that has it off",
    enable: false,
    base: { mp: { source: "./src", autoupdate: false } },
    expectedMessage: "● mp [user] <no autoupdate> {already no autoupdate}",
    expectedLocal: undefined,
  },
```

### WR-05: No scenario covers a nameless `noautoupdate` of a local-only entry without a value, so a design that "always writes a local-only entry" passes

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:314-316`. Scenario gap near `features/marketplace/autoupdate.feature:306-349`.

**Issue:** D-02 says a local entry without a value inherits off when the base config does not declare the marketplace. The named form of this case (`D`, `--local`) is pinned at line 370. The nameless form without `--local` takes a different function, `inheritAfterFlip`. For it, only the enable direction is pinned, at line 306.

Mutant M2 changes `inheritAfterFlip` from

```ts
enable && ownValue(base.config.marketplaces, name) !== undefined
```

to

```ts
enable === (ownValue(base.config.marketplaces, name) !== undefined)
```

The mutant is the same as a plausible design: "a local-only entry has nothing to inherit, so a nameless flip always writes it". This is the Phase 3.2 rule, kept only for local-only entries.

- For `E` the mutant gives the same result as the correct code. The entry is written either way, so line 306 passes.
- For `D` the mutant writes an explicit local `false` and reports `autoupdate disabled`. The correct code reports `(skipped) {already no autoupdate}` and writes nothing.

All 35 scenarios and all 64 unit and integration tests pass on M2. The unwanted local `false` is a per-machine override that nobody asked for. If the marketplace is later declared in the shared base config with autoupdate on, the local `false` still wins. This is the same harm that WR-03 described.

**Fix:** Add this scenario. I checked it in a scratch copy: it passes on HEAD and fails on M2 at the row step, where the mutant gives `autoupdate disabled`.

```gherkin
  Scenario: Disabling autoupdate for every marketplace skips a local entry without a value that the base config does not declare
    Given the marketplace "tools" is published as a dir source
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
      | name  | scope   | status  | reasons               |
      | tools | project | skipped | already no autoupdate |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the project scope does not exist
```

Optional: add a unit case next to "D-MF-03: an unnamed enable writes a local entry the base config does not declare" for the disable direction. It should expect `{already no autoupdate}` and unchanged bytes.

## Info

### IN-01: The inherited-value path reports an unreadable base config as `{invalid manifest}` / "failed schema validation" (carried forward)

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:301-311`

**Issue:**

- `loadConfig` (`persistence/config-io.ts`) returns `status: "invalid"` for every read error except `ENOENT`, `EACCES` included. It does the same for a JSON parse failure.
- `inheritFrom` then throws `invalidConfigError`, whose message always says `failed schema validation`.
- So the `EACCES` branch of `autoupdateFailedReason` (`{permission denied}`) is never reached on this path.

The D-05 scenario at line 471 shows this cause for text that is not JSON at all. The layer gate already behaves this way, and D-05 chose `invalid manifest`, so this diff did not introduce the problem.

**Fix:** Optional, in a later change that covers every CFG-03 site: carry `ConfigLoadResult.error` into the cause, or report read and parse errors apart from schema errors.

### IN-02: Two comments still say a nameless flip writes every declaring layer, or only the base entry (carried forward, extended)

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:51-53` and `:488-497`

**Issue:**

- The module header says: "unnamed (D-MF-03): each recorded marketplace in every layer that declares it … a local entry without a value inherits the base value". This is wrong in two cases:
  - Under D-04, a local entry without a value is not written when the base config declares the marketplace.
  - A local-only entry inherits off, not "the base value".
- The `planEveryFlip` doc comment says a local entry without a value inherits the post-flip base value, "so only the base entry is written". That is wrong when the base config does not declare the marketplace. Then the local entry is written (line 306).

**Fix:**

- Header: "unnamed (D-MF-03): each recorded marketplace, in each declaring layer whose value, own or inherited, differs from the request (a local entry without a value inherits the base entry's value, or off when the base config does not declare it); with --local, claude-plugins.local.json only".
- `planEveryFlip`: add "when the base config declares the marketplace" to the "so only the base entry is written" clause.

### IN-03: Small inaccuracies and placement issues in the docs (carried forward)

**Files:** `README.md:182`, `README.es.md:180`, `docs/output-catalog.md:4467`, `CHANGELOG.md:26-29`

**Issue:**

- The README, its Spanish copy, and the catalog say a nameless flip sets the base value, "so a local entry without `autoupdate` takes the new base value". That is true only when the base config declares the marketplace. Line 306 shows the other case, where the flip writes the local entry.
- The README puts the two new `--local` sentences in the paragraph about commands *with a name*. They also apply to a nameless `--local` flip.
- The catalog says the inherited-value failure "writes nothing". In an unscoped run, an earlier scope may already be written. The next catalog paragraph covers that case, so this is only imprecise.
- The D-08 sub-bullet in the CHANGELOG (the unscoped miss) sits under the entry about declaring a marketplace in both configs. That change has nothing to do with layers.

**Fix:**

- Add "when the base config declares the marketplace" to the inheritance clause, in the README, `README.es.md` (per the `readme` skill), and the catalog.
- Move the `--local` sentences next to the exception for nameless flips, or write "with or without a name".
- Consider a separate top-level CHANGELOG bullet for D-08.

---

_Reviewed: 2026-10-20T05:28:27Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

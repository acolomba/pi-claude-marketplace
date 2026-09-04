---
phase: 116-edge-surface
plan: "05"
subsystem: testing
tags: [node-test, edge, completions, provider, composition, d-116-01a, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-03's completion data layer owner, which owns the tokenizer, the per-mode status filtering, and the plugin-reference split this owner therefore does not restate"
  - phase: 116-edge-surface
    provides: "116-06's flag-catalog owner and the pre-existing flag-catalog drift guard, which together pin the per-verb completable flag SET"
  - phase: 116-edge-surface
    provides: "116-29's router owner, which owns the two exported subcommand vocabularies this provider composes"
provides:
  - "tests/edge/completions/provider.test.ts — the sole mirrored direct owner for edge/completions/provider.ts, at functions 11/11, lines 335/335, branches 79/80"
  - "the measured finding that a head's `allowMarketplaceOnly` bit is INVISIBLE at a plain plugin cursor and invisible to coverage, because it is data rather than a branch: only an `@` cursor observes it, and without those rows the provider could carry a wrong value for every head with the suite, the compiler, lint and fallow all green"
  - "a seventh D-116-01a claimant at edge/completions/provider.ts:125, the empty-object arm of `optionalDescription`: structural rather than compiler-forced, proved by a GREEN plant plus a 406-prefix independent route, pinned by identity in the plan and filed as WINDOWS.md entry 17"
  - "the measured correction that tests/architecture/scope-order-drift.test.ts walks `extensions/` only, so it places no constraint on a test file — and that re-reading `SCOPES` to build the scope expectation would have made the order claim circular"

affects: []

actuals:
  tokens: 47000
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "The composition owner asserts WHICH vocabulary appears at WHICH cursor position and WHICH mode each head maps to, and leaves each composed surface's contents to that surface's own owner. The header names all three owners by path so a later reader can see where a dropped case went"
    - "A head-to-mode mapping is observed through the candidate list the mode produces. It discriminates only if the seeded manifests carry rows eligible for one mode and not another: `held`/`outdated` for the installed inventory, `fresh`/`not-fetched` for install, `degraded` for the partial install, `broken` for fetch alone"
    - "Two marketplaces, one per scope, with disjoint plugin names. That is what makes an explicit scope flag observable — `lab-*` appears only when the project scope is in range — and it turns each scope row into a measurement rather than a restatement"
    - "The promotion of an exact subcommand token is proved by its one-character-short partner, not by a second spelling of itself. `marketplac` offers the top-level vocabulary narrowed to one entry; `marketplace` offers the nine marketplace subcommands. Same for `marketplace remov` against `marketplace remove`"
    - "Every scope-flag value expectation is a hand-authored `user`/`project` pair. The drift guard that forbids the literal in production does not reach `tests/`, and importing `SCOPES` would assert the order against itself"

key-files:
  created: []
  modified:
    - tests/edge/completions/provider.test.ts

key-decisions:
  - "FINDING (blocking the plan's own acceptance criterion) — the pair CANNOT reach 100 percent direct branches without a production edit, and both production licences are spent. The verdict is `Incomplete direct coverage for extensions/pi-claude-marketplace/edge/completions/provider.ts: branches 79/80` with functions 11/11 and lines 335/335 and an empty uncovered-line cell. The shortfall is exactly 1 and its identity is `BRDA:125,17,0,0` in the pair's own lcov — the `description === undefined` arm of `optionalDescription`. Under the AMENDED D-116-01a this makes 116-05 a claimant, so the shortfall is PINNED by identity rather than reported as prose: the plan's `<verify>` link now matches an `Incomplete direct coverage for <source>: branches N/M` verdict with the numbers read loosely, requires denominator minus numerator to equal exactly 1, and anchors on `$` so a `lines` or `functions` clause appearing fails the link. No coverage pragma was added at any point"
  - "The arm is unreachable for a STRUCTURAL reason, not a compiler setting — the distinction the amendment requires. `flagCompletions` builds its entry list from exactly two producers: a written-out literal that carries a description, and `completionFlagEntries`, whose every element is `{ name: f.name, description: f.description }` over a `FlagEntry` whose `description` field is REQUIRED. The declared element type `{ name: string; description?: string }` keeps the field optional, so the guard must exist, but nothing reachable through the module's single export can supply an entry without one. Proved two ways: Plant C replaced the empty-object arm with `{ description: \"@@unreached@@\" }` and all 58 cases stayed GREEN, and an independent route drove 406 long-flag cursor prefixes — every top-level head, every `marketplace <verb>` head, unknown heads, and scope-, partial- and reference-bearing prefixes, crossed with fourteen cursor spellings — emitting 169 items of which zero lacked a description and zero carried the marker"
  - "DEVIATION (plan gap) — the plan's cursor-position list omits the `allowMarketplaceOnly` half of each head's branch configuration. It is set per head by `pluginRefBranchConfig` (true for update, fetch and reinstall; false for the other five) and is unobservable at a plain plugin cursor, where the plugin-half path runs regardless. Coverage cannot see it either: it is a data field, not a branch, so a wrong value for every head would have left the suite, the compiler, lint, fallow and the direct-coverage gate all green. Added an eight-row `@`-cursor table, and planted BOTH directions to prove it discriminates: flipping enable to true turns exactly the `enable @` row RED, and flipping update to false turns exactly the `update @` row RED"
  - "DEVIATION — the plan asks for the scope value list to be 'taken from the shared scope declaration rather than a hand-written pair literal, because tests/architecture/scope-order-drift.test.ts forbids a hand-rolled scope-order literal'. Its reason is FALSE as measured: that guard walks the `extensions/` tree only (`walkTsFiles(path.join(repoRoot, \"extensions\"))`, both cases), so it places no constraint on a test file — matching what 116-03 recorded. Following the plan would also have broken the plan's own acceptance criterion that no expectation is produced by re-reading a constant the module reads: `scopeValueCompletions` maps over `SCOPES`, so an expectation built from `SCOPES` asserts the order against itself and stays green whatever the order becomes. Both scope-value expectations are hand-authored `user`-then-`project` literals"
  - "DEVIATION — the plan asks for a case asserting the scope values are 'absent at the top-level and plugin-reference positions'. Every case at both positions already compares its whole array with `deepStrictEqual`, which is strictly stronger than an absence check and is what the unit-testing rules require in place of a standalone negative assertion. No separate absence case was written; the claim is carried by the whole-value comparisons and stated in the suite header"
  - "OBSERVATION — the explicit-scope row for `info` is the one row whose scope half cannot discriminate. `pluginRefBranchConfig` forwards `targetScope` for the info head, and `getInfoPluginToMarketplacesMap` takes only the resolver and ignores it, so `info ` and `info --scope project ` are byte-identical by construction. That identity IS the info promise (scope does not narrow the info surface) and the row is not vacuous — its whole-list comparison still fails if the head's mode changes — but the scope half of its claim is carried by its seven sibling rows, where an explicit scope demonstrably changes the list"
  - "OBSERVATION — five heads (uninstall, update, reinstall, enable, disable) map to modes that share one candidate map in the data layer, whose builder takes `_mode` and never reads it, so their lists are identical by construction and no plant can tell those five apart from each other. Each row still discriminates against install, fetch and info, which is what Plant A demonstrates: rerouting enable to the install mode turns both enable rows RED. Recorded so a later reader does not mistake the five identical expectations for a copy-paste error"
  - "The suite drops 17 cases relative to the file it replaces (67 to 58) while raising line coverage from 95.22 to 100 percent and branch coverage from 91.03 to 98.75. Every dropped case restated behavior that `tests/edge/completions/data.test.ts` now owns — the manifest soft-fail, the state-load propagation, the stale-cache read, the multi-marketplace `name@` form, and the install-source shadowing. None of them reaches a provider branch: the pair's lines are complete without them"
  - "No production file was touched. Five plants were applied to `edge/completions/provider.ts` and each reverted from a byte-copy taken before the first. The file's sha256 is byte-identical before and after (`f5fd3c6a…`), `git diff --quiet -- extensions/` exits 0, and the plan's pinned-path check over provider.ts, all three handler `shared.ts` files, `flag-catalog.ts` and `tests/helpers/notification-boundary.ts` exited 0 before staging"

patterns-established:
  - "A branch-configuration field that selects nothing on the default path is invisible to direct coverage. Before declaring a config-producing function proven, enumerate its output FIELDS and ask which input observes each one; a field only some cursor position can reach needs a case at that position, or it is unproven with every gate green"
  - "A D-116-01a claim needs a plant that stays GREEN and one independent route, and the route must be independent of the suite. Driving 406 generated prefixes through the export and inspecting every emitted item is such a route; re-reading the suite's own cases is not"
  - "Pin the plan's identity assertion in BOTH directions before trusting it. Two assertion-side mutations (require a `lines` clause; assert a 2-branch shortfall) and three output-side mutations (a `lines` clause appears; a second branch goes uncovered; the verdict disappears) were each run against real captured gate output; all five failed with the right diagnostic and the unbroken pin passed"
  - "An exit code taken from the last element of a pipeline is not the exit code of the command you meant. Two checks in this run reported a plausible failure that was really a missing file or a `tail` succeeding; every gate result here was re-read from the intended process"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/completions/provider.test.ts owns edge/completions/provider.ts, including the enable and disable arms of the verb-to-mode selector that no case reached before"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/completions/provider.test.ts — 58 runtime cases from 22 marked case bodies, pass 58 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- .../edge/completions/provider.ts → functions 11/11, lines 335/335, branches 79/80 (baseline functions 11/11, lines 319/335, branches 71/78)"
        status: pass
  - deliverable: "Each cursor position offers the vocabulary the provider composes for it, compared unsorted and whole against a hand-authored literal"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/completions/provider.test.ts#TC-1 offers the whole top-level vocabulary at an empty prefix, in declaration order"
        status: pass
      - kind: test
        ref: "tests/edge/completions/provider.test.ts#TC-2 offers the marketplace vocabulary after the marketplace token and a space"
        status: pass
      - kind: test
        ref: "tests/edge/completions/provider.test.ts#TC-3 prepends the global scope flag before a verb's own completable flags"
        status: pass
      - kind: test
        ref: "tests/edge/completions/provider.test.ts#TC-5 offers marketplace names from both scopes for \"list \""
        status: pass
      - kind: command
        ref: "Plant B — drop the prepended global scope entry from flagCompletions; all three long-flag cases go RED"
        status: pass
  - deliverable: "An exact subcommand token promotes to the next argument position instead of being re-offered"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/completions/provider.test.ts#a top-level token one character short still offers the subcommand vocabulary — \"marketplac\" yields one entry"
        status: pass
      - kind: test
        ref: "tests/edge/completions/provider.test.ts#TC-2 promotes an exact top-level token with no trailing space to the next argument — \"marketplace\" yields the nine marketplace subcommands"
        status: pass
      - kind: test
        ref: "tests/edge/completions/provider.test.ts#TC-2 promotes an exact marketplace subcommand token to the name argument — \"marketplace remove\" yields the two marketplace names"
        status: pass
  - deliverable: "Every head that takes a plugin reference reaches the completion mode it maps to, and every head that does not offers nothing"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/completions/provider.test.ts — eight-row plain-cursor table over install, uninstall, update, fetch, reinstall, info, enable and disable"
        status: pass
      - kind: test
        ref: "tests/edge/completions/provider.test.ts — eight-row explicit-scope table, including the D-54-01 / ENBL-01 / ENBL-02 enable and disable rows"
        status: pass
      - kind: test
        ref: "tests/edge/completions/provider.test.ts — five-row null-sentinel table over pending, import, bootstrap, an unknown head and a surplus positional"
        status: pass
      - kind: command
        ref: "Plant A — reroute the enable arm to the install mode; both enable rows go RED with the install candidate list"
        status: pass
  - deliverable: "Each head's `allowMarketplaceOnly` bit is proven at the one cursor that observes it"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/completions/provider.test.ts — eight-row `@`-cursor table; update, fetch and reinstall offer two bare marketplace targets each, the other five offer none"
        status: pass
      - kind: command
        ref: "Plant D — flip enable to allowMarketplaceOnly true; exactly the \"enable @\" row goes RED"
        status: pass
      - kind: command
        ref: "Plant E — flip update to allowMarketplaceOnly false; exactly the \"update @\" row goes RED"
        status: pass
  - deliverable: "The D-116-01a claim at provider.ts:125 is measured, not inspected, and is pinned by identity"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant C — replace the empty-object arm with a distinguishable description; all 58 cases stay GREEN, which is the unreachability evidence"
        status: pass
      - kind: command
        ref: "Independent route — 406 long-flag cursor prefixes through the export emitted 169 items, 0 without a description and 0 carrying the plant marker"
        status: pass
      - kind: command
        ref: "The pin planted in both directions — 2 assertion-side and 3 output-side mutations, each failing with the correct diagnostic; the unbroken pin passes against real gate output"
        status: pass
      - kind: other
        ref: ".planning/WINDOWS.md entry 17, kind unmet-truth, status open"
        status: pass
  - deliverable: "The read-only completion surface never reaches the network"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/completions/provider.test.ts — every one of the 58 cases asserts the context-owned fail-fast transport recorded zero calls, by count and never by message"
        status: pass
  - deliverable: "No production file changed and the shared boundary helper is untouched"
    human_judgment: false
    verification:
      - kind: command
        ref: "sha256 of edge/completions/provider.ts identical before and after all five plants; git diff --quiet -- extensions/ exits 0; the plan's six-path pinned check exits 0"
        status: pass

duration: 30 min
completed: 2026-09-02
---

# Phase 116 Plan 05: Completion Provider Owner Summary

`tests/edge/completions/provider.test.ts` is rewritten as a composition proof across every cursor
position of `/claude:plugin`: 58 runtime cases from 22 marked bodies, replacing 67 cases and 1,670
lines, and taking the pair from lines 319/335 and branches 71/78 to lines 335/335, functions 11/11
and branches 79/80.

## What the owner claims

The provider composes three settled surfaces — the two subcommand vocabularies from `edge/router.ts`,
the per-verb flag entries from `edge/flag-catalog.ts`, and the candidate maps from
`edge/completions/data.ts`. This suite asserts the COMPOSITION and nothing else:

| Cursor position | Claim |
| --------------- | ----- |
| empty prefix | the fourteen top-level subcommands, in declaration order |
| a partial top-level token | the vocabulary narrowed by a case-SENSITIVE prefix (`INS` yields nothing) |
| an exact subcommand token | the position promotes; the one-character-short partner is what makes that visible |
| after `marketplace ` | the nine marketplace subcommands, values rebuilt from the head |
| after a name-taking marketplace verb | the marketplace names from both scopes; `add` offers none |
| after a long-flag prefix | the prepended global scope entry FIRST, then the verb's own entries; `ls` resolves to `list`; a non-catalog head gets the scope entry alone |
| after the scope flag | the two scope values, and nowhere else |
| at a plugin reference | the candidates of the mode that head maps to, at a plain cursor, at an `@` cursor, and with an explicit scope |
| anywhere else | `null`, the Pi-tui sentinel, never `[]` |

Each composed surface's own contents stay with its owner, and the suite header names all three by
path.

## Coverage delta, fully accounted

| | before | after |
| - | ------ | ----- |
| functions | 11/11 | 11/11 |
| lines | 319/335 | **335/335** |
| branches | 71/78 | **79/80** |
| cases | 67 | 58 |
| suite lines | 1,670 | 862 |

The +16 lines are `provider.ts:238-254`, the enable and disable arms of the verb-to-mode selector,
which no case reached before. The branch DENOMINATOR moved 78 → 80 because V8 emits a branch range
only for code that executed: the two `explicitScope !== undefined` guards inside those arms did not
exist as ranges until the arms ran. Six previously-uncovered branches closed (`160`, `225`, `237`,
`247`, `280`, `283`) plus the two new ones, so the numerator rose by 8.

The suite got smaller because 17 dropped cases restated behavior
`tests/edge/completions/data.test.ts` now owns — the manifest soft-fail, the state-load propagation,
the stale-cache read, the multi-marketplace `name@` form, and the install-source shadowing. None of
them reaches a provider branch; the pair's lines are complete without them.

## Findings

### 1. The `allowMarketplaceOnly` bit was unproven with every gate green

`pluginRefBranchConfig` sets `allowMarketplaceOnly` per head — true for update, fetch and reinstall,
false for install, uninstall, info, enable and disable. It selects nothing at a plain plugin cursor,
where the plugin-half path runs regardless, and it is a data field rather than a branch, so direct
coverage cannot see it. A wrong value for every head would have passed the suite, the compiler, lint,
`fallow` and the coverage gate.

The plan's cursor-position list did not mention it. Added an eight-row `@`-cursor table and planted
both directions (§ Plants D and E).

### 2. A seventh D-116-01a claimant at `provider.ts:125`

`optionalDescription(description)` returns `{}` when its argument is `undefined`. Nothing reachable
through `getArgumentCompletions` can enter that arm: `flagCompletions` builds its entry list from a
written-out literal that carries a description and from `completionFlagEntries`, whose every element
derives from a `FlagEntry` whose `description` field is required. The declared element type keeps the
field optional, so the guard must exist.

The reason is STRUCTURAL, not compiler-forced — the distinction the amended decision requires. It is
unlike `data.ts:188`, where the standard library's typing of `Array.prototype.at()` forces the
fallback.

The shortfall is pinned by IDENTITY in `116-05-PLAN.md` (a verdict with the branch numbers read
loosely, denominator minus numerator exactly 1, `$`-anchored so a `lines` or `functions` clause
fails the link), stated in the suite header, and filed as `.planning/WINDOWS.md` entry 17. The
measured `79/80` is an observation, never a gate. No coverage pragma exists anywhere.

### 3. The plan's scope-order rationale is false

The plan asks for the scope value expectation to be built from the shared `SCOPES` declaration
"because `tests/architecture/scope-order-drift.test.ts` forbids a hand-rolled scope-order literal".
Both of that guard's cases walk `path.join(repoRoot, "extensions")` only, so a test file is out of
its reach — the same reading 116-03 recorded. Following the plan would also have violated the plan's
own acceptance criterion: `scopeValueCompletions` maps over `SCOPES`, so an expectation built from
`SCOPES` asserts the order against itself. Both scope expectations are hand-authored.

## Plants

All five were applied to `edge/completions/provider.ts` and reverted from a byte-copy taken before
the first. The file's sha256 (`f5fd3c6a…`) is identical before and after.

| Plant | Mutation | Outcome |
| ----- | -------- | ------- |
| A (plan-specified) | the enable arm returns `mode: "install"` | **RED**, exactly the two enable rows |
| B (plan-specified) | `flagCompletions` starts from an empty entry list | **RED**, exactly the three long-flag cases |
| C (D-116-01a) | the empty-object arm returns `{ description: "@@unreached@@" }` | **GREEN**, 58/58 — the unreachability evidence |
| D (added) | enable carries `allowMarketplaceOnly: true` | **RED**, exactly the `enable @` row |
| E (added) | update carries `allowMarketplaceOnly: false` | **RED**, exactly the `update @` row |

Plant A, verbatim:

```text
✖ TC-6 completes plugin references for "enable " through the enable mode
  actual: [ { label: 'fresh@hub', value: 'enable fresh@hub ' }, { label: 'not-fetched@hub', value: 'enable not-fetched@hub ' } ],
  expected: [ { label: 'lab-held@lab', value: 'enable lab-held@lab ' }, { label: 'held@hub', value: 'enable held@hub ' }, { label: 'outdated@hub', value: 'enable outdated@hub ' } ],
```

Plant B, verbatim:

```text
✖ TC-3 prepends the global scope flag before a verb's own completable flags
  + actual - expected
    [
      {
  -     description: 'Scope: user or project',
  -     label: '--scope',
  -     value: 'install --scope '
  -   },
  -   {
        description: 'Enable model field mapping in generated agents (default: omit)',
```

Plant D, verbatim:

```text
✖ TC-6 offers 0 bare marketplace target(s) for "enable @"
  actual: [ { label: '@lab', value: 'enable @lab ' }, { label: '@hub', value: 'enable @hub ' } ],
  expected: [],
```

Plant E, verbatim:

```text
✖ TC-6 offers 2 bare marketplace target(s) for "update @"
  actual: [],
  expected: [ { label: '@lab', value: 'update @lab ' }, { label: '@hub', value: 'update @hub ' } ],
```

### The identity pin, planted in both directions

| Direction | Mutation | Outcome |
| --------- | -------- | ------- |
| — | real gate output, pin as authored | PASS, `79/80` |
| assertion | require a trailing `lines` clause | FAIL, "no documented incomplete verdict, or lines/functions are no longer complete" |
| assertion | assert a 2-branch shortfall | FAIL, "expected exactly 2 uncovered branch, saw 1" |
| output | a `lines` clause appears | FAIL, same verdict message |
| output | a second branch goes uncovered | FAIL, "expected exactly 1 uncovered branch, saw 2" |
| output | the verdict disappears (gate passes) | FAIL, same verdict message |

The last row is what D-116-01a calls out by name: a passing verdict fails the link and must be
reported rather than edited away.

## No exhaustiveness claim

`pluginRefBranchConfig` switches on an open `string` peeled from raw user input and ends with a
`default` arm that returns `null`. A deleted case is a behavior change (its head falls through to the
marketplace-name test and then to the `null` sentinel), not a compiler diagnostic. A missing-arm
plant has NO target here and none was attempted. That absence is stated in the suite header.

## Deviations from Plan

### 1. [Rule 2 - Missing critical coverage] The `@`-cursor table

- **Found during:** Task 1, while accounting for the cases dropped from the file being replaced.
- **Issue:** the plan's cursor-position list omits the `allowMarketplaceOnly` half of each head's
  branch configuration. It is unobservable at a plain plugin cursor and invisible to coverage.
- **Fix:** added an eight-row `@`-cursor table and two plants (D and E) proving it discriminates in
  both directions.
- **Verification:** each plant turns exactly its own row RED.
- **Commit:** `13269096`

### 2. [Rule 1 - False premise] The scope-order rationale

- **Found during:** Task 1, reading `tests/architecture/scope-order-drift.test.ts`.
- **Issue:** the plan's stated reason for importing `SCOPES` is false (the guard walks `extensions/`
  only), and following it would have made the order claim circular, breaking the plan's own
  acceptance criterion.
- **Fix:** hand-authored `user`-then-`project` literals; recorded the guard's real scope in the suite
  header.
- **Commit:** `13269096`

### 3. [Rule 1 - Redundant negative] The scope-values-absent case

- **Found during:** Task 1.
- **Issue:** the plan asks for a case asserting the scope values are absent at the top-level and
  plugin-reference positions. The unit-testing rules forbid a standalone negative assertion in place
  of asserting what the value is.
- **Fix:** the whole-array comparisons already at both positions are strictly stronger; the claim is
  carried there and stated in the header. No separate case written.
- **Commit:** `13269096`

### 4. [Rule 3 - Blocker] The plan demanded 100 percent branches

- **Found during:** Task 1, after the rewrite reached lines 335/335.
- **Issue:** the remaining branch cannot be reached without a production edit, and both production
  licences are spent.
- **Fix:** became a D-116-01a claimant under the amendment — pinned the shortfall identity in the
  plan's `must_haves` and `<verify>` link, corrected the acceptance criteria, `<done>` and
  `<success_criteria>` that demanded 100 percent branches, and filed WINDOWS.md entry 17.
- **Verification:** the amended `<verify>` chain runs end to end at exit 0; the pin was planted in
  five directions and fails correctly in all five.
- **Commit:** `13269096` (test), plus the docs commit for the plan, ledger and summary.

**Total deviations:** 4 auto-fixed (1 missing coverage, 2 false plan premises, 1 blocker resolved by
the amended decision). **Impact:** the suite proves strictly more than the plan specified, and the
one thing the plan promised that no input can deliver is now a pinned, falsifiable gate instead of an
unmet acceptance criterion.

## Repairs to shared planning files

- `roadmap.update-plan-progress` mangled `ROADMAP.md` for the nineteenth time: it injected a
  duplicate bare 31-line plan list beside the descriptive one and collapsed the progress-table row
  alignment. Both were repaired by hand before staging. The prose count was ALSO stale at `17/31`
  when the tool ran (it had written `18/31` only into the table); both now read `19/31`, the 116-05
  checkbox is ticked, and `grep -c '^- \[x\] \*\*116-'` returns 19. The `**Total**` 173/204 row was
  left alone — it is a deferred phase-boundary sweep item.
- `state.record-metric` incremented `progress.completed_plans` a second time after the hand edit
  (193 → 194 → 195). Corrected to 194.
- `MOD-09` stays `Pending`: `requirements.ready-ids` reports `0/1 requirement(s) ready`, because
  twelve sibling plans in this phase declare it and have no summary yet.

## Issues Encountered

None. All gates green: `npm run typecheck`, `npm run lint`, `npm run fallow`, `npm test`
(5041/5041 — the baseline 5058 minus this rewrite's 17 net dropped cases, arithmetic confirmed),
`npm run test:integration` (31/31), the per-file `prettier --check`, and
`SKIP=trufflehog,npm-format-check pre-commit run --files` all exited 0. `npm run check` was NOT used:
its `format:check` link fails on pre-existing untracked operator files and short-circuits before the
tests run.

## Next

Wave 4 is closed. Wave 5 is next — the eleven plugin handler owners (116-14 … 116-22, 116-24,
116-25), with 116-17 carrying the atomic `git mv`. Ready for 116-14.

## Self-Check: PASSED

- `tests/edge/completions/provider.test.ts` exists on disk (862 lines).
- `git log --oneline --all | grep 13269096` returns the task commit.
- Task `<acceptance_criteria>` re-run: 58/58 cases pass alone; the coverage gate reports functions
  11/11, lines 335/335 and the single pinned branch; 22 arrange markers for 22 case bodies; the
  anti-pattern scan matches nothing; `git diff --check` clean; the six-path pinned-production check
  exits 0.
- Plan-level `<verify>` chain re-run end to end after the amendment: exit 0.

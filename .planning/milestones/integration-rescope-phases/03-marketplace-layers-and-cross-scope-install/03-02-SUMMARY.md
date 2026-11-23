---
phase: 03-marketplace-layers-and-cross-scope-install
plan: "02"
subsystem: testing
tags: [cucumber, marketplace-remove, url-source, layers, integration-migration]
status: complete
requires: []
provides:
  - "Eight url marketplace remove scenarios in features/marketplace/remove.feature (D-09, LAYER-02, LAYER-03, CFG-03)"
  - "Step: the plugin {string} has written the file {string} with the text {string} to its data directory in the {word} scope"
  - "Step: the {word} scope holds no plugin data"
  - "test/integration/marketplace-layer-remove.test.ts trimmed to its three EACCES fault-injection cases"
affects:
  - features/marketplace/remove.feature
  - features/step_definitions/plugin/installation.steps.ts
  - test/integration/marketplace-layer-remove.test.ts
tech-stack:
  added: []
  patterns:
    - "Red proof per behavior: one-substring break in remove.ts, run, EXIT-trap restore, log with root=, exit=, restored="
key-files:
  created: []
  modified:
    - features/marketplace/remove.feature
    - features/step_definitions/plugin/installation.steps.ts
    - test/integration/marketplace-layer-remove.test.ts
files_deleted: []
decisions:
  - "The has-written Given creates the plugin data directory itself, because a dependency install creates none (AS-6 runs for the root plugin only); the existing data-directory Given still requires the directory"
  - "installFrom in the trimmed integration file lost its dead marketplace parameter, as writeFixtureMarketplace lost its allowance parameter"
requirements: ["ITMIG-05"]
metrics:
  duration: "29 min"
  completed: "2026-11-21"
estimate:
  tokens: 95000
  tasks: 3
actuals:
  tokens: 8900
  tasks: 3
  commits: 3
plan_head_before: 792d2effb5602573522ac56ba22a60d430b0129a
plan_head_after: 75f085ebc65960fd240addd824a198501e891a81
---

# Phase 3 Plan 02: Url Marketplace Remove Scenarios Summary

Eight cucumber scenarios in `features/marketplace/remove.feature` now prove how a remove of a url
marketplace treats the config layers (undeclared, base only, both layers, the two refusals, and
LAYER-03's kept dependency with its convergence). Ten deliberate breaks in
`orchestrators/marketplace/remove.ts` each failed their scenarios. The integration file
`marketplace-layer-remove.test.ts` keeps only its three EACCES fault-injection cases.

## Red proofs

- Scratch folder `$D`: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase03-plan02`.
- Checkout root, the first line of every break log:
  `root=/home/user/pi-claude-marketplace/.claude/worktrees/agent-a01167b84ad4f8d28`.
- Plan base: `792d2effb5602573522ac56ba22a60d430b0129a`. The four files the plan reads did not
  change between 43b7a14 and the base (`git diff --stat` printed nothing), so the plan's line
  numbers held.
- Helper: `$D/break.sh`, copied from `phase02-plan02/break.sh`. It roots at
  `git rev-parse --show-toplevel` and names no fixed checkout path. It refuses a dirty `extensions/`
  (exit 4), sets the EXIT trap before the one-substring replacement (exit 3 unless the text occurs
  exactly once), logs the diff, runs the adapter profile with `--parallel 1`, and logs `exit=` and
  `restored=`. `$D/run-break.sh` wraps it and prints `git status --porcelain -- extensions/`
  after each run.
- Green runs (adapter, `--parallel 1`): `$D/green-remove-1.log` `53 scenarios (53 passed)`,
  `exit=0` (Task 1). `$D/green-remove-2.log` `60 scenarios (60 passed)`, `exit=0` (Task 2).
- Builtin run: `$D/builtin.log` `0 scenarios`, `exit=0`. The builtin profile selects none of the
  file's scenarios (DUAL-02).
- Every break log ends with `restored=clean`. `git status --porcelain -- extensions/` printed
  nothing after each break. No log holds `function timed out`, so no break needed a rerun. Every
  failure below is an `AssertionError`, never a step timeout.

New scenario lines: M02 `:860`, M02b `:886`, M07 `:905`, M01 `:929`, M03 `:970`, M04 `:989`,
M05 `:1013`, M06 `:1051`.

- **R1, Task 1** (`remove.ts:620`, `planStandaloneRemove`). Change: `+  if (verdict.kind === "undeclared") {`
  / `+    return { layerOnly: true, entries: fullRemovePlan(args.record).entries };` / `+  }`
  before the full-remove branch. Command:
  `bash "$D/break.sh" R1-tracer adapter extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts "$D/R1.old" "$D/R1.new" features/marketplace/remove.feature`.
  Log `$D/R1-tracer-adapter.log`: `53 scenarios (52 passed, 1 failed)`, `exit=1`.
  Failed: M02 `remove.feature:860` at `Then the project scope holds no marketplace record`
  (`AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:` with the `tools`
  record still present). Passed: the other 52.
- **R1, Task 2** (same change). Log `$D/R1-adapter.log`: `60 scenarios (58 passed, 2 failed)`,
  `exit=1`. Failed: M02 `:860` and M02b `:886`, both at
  `Then the project scope holds no marketplace record` (deep-equal assertion). Passed: the other 58.
- **R10** (`remove.ts:1231`, `runPostRemoveCleanup`; research did not run this one). Change:
  `-  if (args.recordDeleted) {` / `+  if (args.recordDeleted && process.env.NEVER_SET === "x") {`.
  Log `$D/R10-adapter.log`: `60 scenarios (57 passed, 3 failed)`, `exit=1`. Failed: M02 `:860`,
  M07 `:905`, and M02b `:886`, all at `Then the project scope holds no marketplace checkout`
  (deep-equal assertion: `sources/tools` stays). As expected, M01 and M05 passed, because a
  layer remove and a remove that keeps a dependency record delete no record. Passed: the other 57.
  No existing scenario failed. Before this plan, no scenario of the file checked that a full
  remove deletes the url checkout.
- **R4** (`remove.ts:1231`). Change: `+  if (args.recordDeleted || process.env.NEVER_SET === undefined) {`.
  Log `$D/R4-adapter.log`: `60 scenarios (58 passed, 2 failed)`, `exit=1`. Failed: M01 `:929`
  and M05 `:1013`, both at `Then the project scope holds these git clones:` (deep-equal
  assertion: the marketplace clone is gone). Passed: the other 58.
- **R9** (`remove.ts:1227`). Change: `+  await removePath(locations.marketplaceDataDir(name));`
  before `if (!args.allPluginsUnstaged) {`. Log `$D/R9-adapter.log`:
  `60 scenarios (58 passed, 2 failed)`, `exit=1`. Failed: M01 `:929` at
  `Then the data directory of "beta@tools" in the project scope holds these files:`
  (`AssertionError [ERR_ASSERTION]: .../data/tools/beta does not exist`). M05 `:1013` failed at
  the same step for `lib@tools` (`.../data/tools/lib does not exist`). Passed: the other 58.
- **R3** (`remove.ts:609`). Change:
  `+  if (verdict.kind === "refused" && process.env.NEVER_SET === "x") {`. Log `$D/R3-adapter.log`:
  `60 scenarios (56 passed, 4 failed)`, `exit=1`. Failed, each at
  `Then the result has these fields:` (deep-equal assertion): M03 `:970`, and the existing
  `:200` "An unscoped remove refuses the project local layer before considering user scope",
  `:343` "Removing without --local a marketplace added with --local fails as marketplace in
  local layer only", and `:360` "Removing with --local a marketplace only the base layer declares
  fails as marketplace in base layer only". Passed: the other 56.
- **R2** (`remove.ts:613`). Change:
  `+  if (other.status === "invalid" && process.env.NEVER_SET === "x") {`. Log
  `$D/R2-adapter.log`: `60 scenarios (59 passed, 1 failed)`, `exit=1`. Failed: M04 `:989` at
  `Then the result has these fields:` (deep-equal assertion). Passed: the other 59.
- **R5** (`remove.ts:677`). Change:
  `+  const deleteRecord = Object.keys(args.record.plugins).length >= 0;`. Log
  `$D/R5-adapter.log`: `60 scenarios (56 passed, 4 failed)`, `exit=1`. Failed: M06 `:1051` at
  `Then the result has these fields:`. M05 `:1013` failed at
  `Then the project scope holds these git clones:`. The existing `:665` "A marketplace whose
  removal kept a dependency is still listed" failed at `Then the result has these fields:`. The
  existing `:630` "Removing a marketplace keeps a dependency that a plugin of another marketplace
  still needs" failed in the world's After hook
  (`AssertionError [ERR_ASSERTION]: no step compared these rows of the last results`). All four
  are deep-equal assertions. Passed: the other 56.
- **R6** (`remove.ts:760`). Change:
  `+  if (!plan.layerOnly || index === undefined || process.env.NEVER_SET === undefined) {`. Log
  `$D/R6-adapter.log`: `60 scenarios (58 passed, 2 failed)`, `exit=1`. Failed: the existing
  `remove.feature:514` "Removing a marketplace from the base layer fails while a plugin of the
  local layer still needs one of its plugins" and `:542` "A refused remove reports every blocking
  plugin without removing any", both at `Then the result has these fields:` (deep-equal
  assertion). Passed: the other 58.
- **R7** (`remove.ts:718`). Change: `-    throw new DeclarationIndexStop(result.cause);` /
  `+    return undefined;`. Log `$D/R7-adapter.log`: `60 scenarios (59 passed, 1 failed)`,
  `exit=1`. Failed: the existing `remove.feature:592` "Removing a marketplace whose dependency
  declarations cannot be read fails and changes nothing", at `Then the result has these fields:`
  (deep-equal assertion). Passed: the other 59.
- **R8** (`remove.ts:1137`). Change:
  `+  if (err instanceof StateLockHeldError && process.env.NEVER_SET === "x") {`. Run over
  `features/marketplace/state-lock.feature`. Log `$D/R8-adapter.log`:
  `32 scenarios (30 passed, 2 failed)`, `exit=1`. Failed: the existing `state-lock.feature:7`
  "Removing a marketplace from the project scope while another process holds its state lock
  fails as lock held" and `:37` "Removing a marketplace from the user scope while another process
  holds its state lock fails as lock held", both at `Then the result has these fields:`
  (deep-equal assertion). Passed: the other 30.

The research texts `research-03/brk/R1..R9.{old,new}` were copied to `$D` as data and checked with
`cat -A` against the plan. `$D/R10.old` is a copy of `R4.old`, and `$D/R10.new` was written with
the plan's `printf`. No file of `research-03/` was run.

## Case map

| Integration case (at the plan base) | Replaced by | Break that failed it |
| --- | --- | --- |
| `:197` "a base-layer remove keeps the clone, the data directory, the local config, and the local plugin" | M01 `remove.feature:929` | R4, R9 |
| `:235` "a named remove fully removes a recorded url marketplace no layer declares" | M02 `:860`, M02b `:886` | R1, R10 |
| `:265` "a refused remove changes no state, config, clone, or staged artifact" | M03 `:970` | R3 |
| `:321` "a refused remove reports every blocker and preserves all installed state and skill bytes" | existing `remove.feature:514`, `:542` | R6 |
| `:418` "a partial remove persists successes and reports every failure in order" | kept (EACCES fault injection) | - |
| `:576` "a failure-only remove keeps every plugin and needs no reload" | kept (EACCES fault injection) | - |
| `:680` "LAYER-02: a remove refused because the config of the other layer is unreadable changes nothing" | M04 `:989` | R2 |
| `:708` "PRUNE-03: a dependency stays installed while the plugin that declares it fails to unstage" | kept (EACCES fault injection) | - |
| `:748` "D-05-07: a remove whose dependency declarations cannot be read changes nothing" | existing `remove.feature:592` | R7 |
| `:777` "LAYER-03: a full remove that keeps a dependency keeps the url marketplace's record, data, and clone, and converges" | M05 `:1013` (keep), M06 `:1051` (converges) | R4, R5, R9 |
| `:841` "a remove while another holder has the scope's state lock fails as lock held and changes nothing" | existing `state-lock.feature:7`, `:37` | R8 |

M07 (`remove.feature:905`, "Removing a url marketplace that only the base layer declares deletes
its record, its checkout, and the data of its plugins (LAYER-03)") replaces no integration case.
It proves the ITMIG-05 clause "a base-layer remove of a url marketplace that removes its clone and
data directory", for the reading where no other layer declares the marketplace (CONTEXT
[Base-layer remove]). R10 failed it.

## Checks

`node --version`: `v24.22.3`. Every npm script ran with the `nondac-sh` prefix. Every cucumber run
used `--parallel 1`. Every lint, `check:static`, audit, and commit ran under
`flock -w 3600 phase03-heavy.lock`. The shell guard refused the plan's one-line verify commands
that call `git` inside `$(...)`, so each runs unchanged as a script under `$D`.

| Check | Script | Ran on | Result |
| --- | --- | --- | --- |
| Task 1 green, `remove.feature` adapter | `verify-t1-1.sh` | working tree over 792d2ef (the content of c80b853) | exit 0, `53 scenarios (53 passed)` |
| Task 1 R1 detection | `verify-t1-2.sh` | same | exit 0 |
| ESLint warm-up, `npm run lint` | `lint-warm.sh` | same | exit 0 |
| Task 1 `check:static` | `verify-t1-3.sh` | same | exit 0, every step passed |
| Task 1 changed files | `verify-t1-4.sh` (in `accept-t1.sh`) | c80b853 | exit 0 |
| Task 2 green, `remove.feature` adapter | `verify-t2-1.sh` | working tree over c80b853 (the content of 9f43b1a) | exit 0, `60 scenarios (60 passed)` |
| Task 2 break detections (R1, R10, R4, R9, R3, R2, R5) | `verify-t2-2.sh` | same | exit 0 |
| Task 2 `check:static` | `verify-t2-3.sh` | same | exit 0 |
| Task 2 changed files | `verify-t1-4.sh` (in `accept-t2.sh`) | 9f43b1a | exit 0 |
| Task 3 break detections (R6, R7, R8) | `verify-t3-1.sh` | 9f43b1a | exit 0 |
| Trimmed integration file | `verify-t3-2.sh` | working tree over 9f43b1a (the content of 75f085e) | exit 0, `tests 3`, `pass 3`, `fail 0`, all three kept titles |
| Task 3 `check:static` | `verify-t3-3.sh` | same | exit 0 |
| `fallow audit --base 792d2ef` | `verify-t3-4.sh` | 75f085e | exit 0 (see below) |
| Builtin profile, `remove.feature` | `verify-t3-5.sh` | 75f085e | exit 0, `0 scenarios` |
| Final changed files, `extensions/` clean | `verify-t3-6.sh` | 75f085e | exit 0 |

Acceptance greps: `(D-09)$` 2, `(LAYER-03)$` 4, `(LAYER-02)$` 1, `(LAYER-02, CFG-03)$` 1. Each new
step text occurs once. `remove.feature` only gains lines (0 removed lines in
`git diff 792d2ef HEAD`). In `installation.steps.ts`, the three removed lines are all in the
`@fileoverview`. The trimmed file has 3 `test(` calls, 0 hits for the removed imports, 0 for
`allowCrossMarketplaceDependenciesOn: allowed`, and 0 for a phase, plan, or wave. The three kept
tests and the constants and helper they share are byte-identical to the plan base
(`kept-bytes.sh`, `cmp`).

## Issues for the milestone

- `fallow audit --base 792d2ef`: `verdict=warn`, `dead_code_issues 0`, `complexity_findings 0`,
  `duplication_clone_groups 0`. Its only diff-risk finding is
  `weakened-tests:test/integration/marketplace-layer-remove.test.ts`, the expected warning for a
  trimmed test file. It is left to the milestone, with no `.fallowrc.json` or CI change (user
  decision 2026-11-21).
- The three EACCES cases (`a partial remove ...`, `a failure-only remove ...`, `PRUNE-03: ...`)
  stay in `marketplace-layer-remove.test.ts` for the integration rescope. They need fault
  injection through the remove's `cascade` seam, which the cucumber harness lacks (REQUIREMENTS Out
  of Scope).

## Deviations from Plan

1. **[Rule 1 - Cleanup] Dead `marketplace` parameter of `installFrom` removed.** Found during
   Task 3. After the trim, only the deleted LAYER-03 case had passed `"up"`, so every remaining
   call took the default `"mp"`. The parameter went, and the call passes `marketplace: "mp"`.
   This is the same treatment the plan gives the last parameter of `writeFixtureMarketplace`. The
   three kept tests do not change. File: `test/integration/marketplace-layer-remove.test.ts`.
   Commit: 75f085e.
2. **Log housekeeping.** The first copy of the Task 2 `check:static` script substituted only the
   first log name, so that run (exit 0) appended its `exit=0` line to `$D/check-static-1.log`. The
   script was fixed, and the check was run again into `$D/check-static-2.log` (exit 0). So
   `check-static-1.log` ends with two `exit=0` lines.

No scenario needed strengthening: every break failed its expected scenarios on the first run, and
no expected value differed from the research drafts or the integration cases. Rule 4 did not
apply.

## Parent lines

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: `features/marketplace/remove.feature`, `features/step_definitions/plugin/installation.steps.ts`,
  `test/integration/marketplace-layer-remove.test.ts`.
- FOUND: commits c80b853, 9f43b1a, and 75f085e on `HEAD`. `git rev-list --count 792d2ef..HEAD`
  printed 3 before this SUMMARY's commit.
- `git diff 792d2ef HEAD -- extensions/` and `git status --porcelain -- extensions/` print nothing.

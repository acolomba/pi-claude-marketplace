---
phase: 112-install-and-removal-lifecycle
plan: 02
subsystem: infra
tags: [workflows, cascade, uninstall, disable, marketplace-remove, unstage]

requires:
  - phase: 112-install-and-removal-lifecycle
    provides: "`resources.workflows` on the install record and `WorkflowsUnstageFailureError`, both landed by plan 112-01"
  - phase: 111-workflows-bridge
    provides: "`unstagePluginWorkflows` with its ENOENT-is-success policy, accumulated per-name failures and raised containment refusal"
provides:
  - "the sixth `cascadeUnstagePlugin` slot, so `uninstall`, `disable`, `marketplace remove --cascade` and install's materialize-then-disable path all remove workflow envelopes from one edit"
  - "`UnstageOutcome.dropped.workflows`, populated on BOTH the success and the partial-failure return"
  - "a typed per-name removal failure raised from the cascade, carrying the structured `UnstageWorkflowFailure[]`"
  - "the `workflows` filter line in both partial-cascade record folds, each pinned by a test that fails without it"
affects: [112-03 reinstall re-materialization, 112-04 staging sweep]

actuals:
  tokens: 12000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "sixth cascade slot placed AFTER the mcp unstage and BEFORE the success freeze, so no existing bridge ordering shifts"
    - "compile-silent structural folds get a behavioral test observed RED before the filter line lands, not a compiler"
    - "test suites touching the saved workflow directory relocate HOME before building the locations bundle, because `workflowsSavedDir` is rooted at `os.homedir()` and honors no override"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - tests/orchestrators/marketplace/shared.test.ts
    - tests/orchestrators/plugin/shared.test.ts
    - tests/orchestrators/marketplace/remove.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts

key-decisions:
  - "Both fold tests were written and observed RED against the unmodified folds before either filter line landed, and re-proven red afterwards by deleting the lines and re-running."
  - "The hand-rolled marketplace fold's pre-existing `hooks` omission was observed and deliberately left; the new case asserts the record still names the dropped hook, so a later reader cannot repair it silently."
  - "The cascade throws the typed workflows failure only after `dropped.workflows` is assigned, so a partial-failure return reports the envelopes the same pass did manage to remove."
  - "`createProjectScope` and `projectCase` relocate HOME rather than a new per-case helper being introduced, because every cascade test now reaches the saved workflow directory."
  - "The planned containment-refusal case for the cascade was dropped: `assertSafeName` throws a plain `Error`, not `PathContainmentError`, so that name lands in the bridge's per-name failure array. The containment class is already pinned at the install ledger by plan 112-01."

patterns-established:
  - "Sabotage proof for inherited behavior: setting the cascade's `previousWorkflowNames` to `[]` makes exactly the new per-verb cases fail, which is what shows they test removal rather than a clean return value."
  - "A directory planted at a recorded envelope path is the fixture that makes `unlink` fail non-ENOENT, driving the accumulate-and-continue policy without mocking `node:fs`."

requirements-completed: [WLIF-03]

coverage:
  - id: D1
    description: "`cascadeUnstagePlugin` removes every recorded workflow envelope and reports them on `dropped.workflows`, on both the success and the partial-failure return"
    requirement: "WLIF-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/shared.test.ts#cascadeUnstagePlugin returns every removed resource in six-kind order"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/shared.test.ts#cascadeUnstagePlugin removes every recorded workflow envelope"
        status: pass
    human_judgment: false
  - id: D2
    description: "Removal matches the RECORDED name byte-for-byte, never a re-derivation from the plugin source"
    requirement: "WLIF-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/shared.test.ts#cascadeUnstagePlugin removes the RECORDED envelope name, not a re-derived one"
        status: pass
    human_judgment: false
  - id: D3
    description: "An empty workflow inventory is a no-op, and removing twice reports no failure on the second pass"
    requirement: "WLIF-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/shared.test.ts#cascadeUnstagePlugin reports an empty workflows axis for an empty inventory"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/shared.test.ts#cascadeUnstagePlugin removing twice reports no failure on the second pass"
        status: pass
    human_judgment: false
  - id: D4
    description: "Several unremovable names all reach the typed error's structured array; the loop completes before the raise"
    requirement: "WLIF-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/shared.test.ts#cascadeUnstagePlugin raises a typed workflows failure naming every unremovable name"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both partial-cascade folds subtract the new axis, each proven by a test that fails when its filter line is absent"
    requirement: "WLIF-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/shared.test.ts#subtracts the dropped workflow envelope and leaves the other four axes alone"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#subtracts a dropped workflow envelope from the persisted row and leaves hooks alone"
        status: pass
    human_judgment: false
  - id: D6
    description: "`uninstall` takes the envelope off disk, and an empty inventory touches nothing in the shared saved directory"
    requirement: "WLIF-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#WLIF-03: a successful uninstall takes the plugin's workflow envelope off disk"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#WLIF-03: uninstalling a plugin with an empty workflow inventory touches no saved file"
        status: pass
    human_judgment: false
  - id: D7
    description: "`disable` takes the envelope off disk while the disabled record keeps naming it"
    requirement: "WLIF-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WLIF-03: disable removes the workflow envelope while the record keeps naming it"
        status: pass
    human_judgment: false
  - id: D8
    description: "`marketplace remove --cascade` clears every plugin's envelope, and one plugin's failure strands only its own while a user-owned neighbour stays byte-unchanged"
    requirement: "WLIF-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#WLIF-03: a cascade removal takes every plugin's workflow envelope off disk"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts#WLIF-03: one plugin's cascade failure strands only its own envelope"
        status: pass
    human_judgment: false
  - id: D9
    description: "An adjacent plugin's envelope survives a cascade byte-unchanged (T-112-07)"
    requirement: "WLIF-03"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/shared.test.ts#cascadeUnstagePlugin leaves an adjacent plugin's envelope byte-unchanged"
        status: pass
    human_judgment: false
  - id: D10
    description: "Install's materialize-then-disable path inherits the removal with no edit of its own"
    verification:
      - kind: other
        ref: "read of orchestrators/plugin/install.ts::disableFreshlyInstalled — its only removal call is `cascadeUnstagePlugin`; the file's one `unstagePluginWorkflows` call is the ledger undo phase landed by 112-01, not a per-verb removal"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-05
status: complete
---

# Phase 112 Plan 02: Install and removal lifecycle Summary

**One sixth slot in `cascadeUnstagePlugin` gives all four removal verbs workflow-envelope removal, with a typed per-name failure and both structurally-silent record folds closed under test.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-09-05T17:07:38Z
- **Completed:** 2026-09-05T17:47:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- `cascadeUnstagePlugin` gained a sixth slot after the mcp unstage and before the success freeze. It calls `unstagePluginWorkflows` with `installedPlugin.resources.workflows` — the recorded names — and raises `WorkflowsUnstageFailureError` with the structured `failed[]` array when the bridge reports unremovable names.
- `UnstageOutcome.dropped` carries `workflows`, populated on BOTH `Object.freeze` returns, so a cascade that threw part-way still reports the envelopes it had already removed.
- `applyPartialCascadeFold` and the hand-rolled fold in `cascadePluginsInPlace` each subtract the new axis. Neither was compile-forced; each has a behavioral test that was observed red first.
- `uninstall`, `disable` and `marketplace remove --cascade` are each pinned against real envelopes on disk under a relocated home, with adjacency, empty-inventory and byte-unchanged-neighbour cases.
- All five named files are at 100% direct coverage on branches, functions and lines. No `fallow-ignore`, no accepted shortfall.

## Task Commits

1. **Task 1: the sixth cascade slot and the dropped workflows axis** — `edb7007c` (feat)
2. **Task 2: close both structural record folds** — `246f855c` (fix)
3. **Task 3: pin removal on all four verbs** — `ce4b98f9` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` — the sixth cascade slot, the `workflows` axis on both returns, the typed throw, and the header/doc counts corrected from five bridges to six
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` — `applyPartialCascadeFold` gains the axis on both parameter shapes and one filter line
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` — one filter line in the per-plugin loop's hand-rolled fold
- `tests/orchestrators/marketplace/shared.test.ts` — `seedFullCascade` stages an envelope and its record names it; seven new/changed cascade cases; `createProjectScope` relocates HOME
- `tests/orchestrators/plugin/shared.test.ts` — the fold case that fails when the axis is omitted
- `tests/orchestrators/marketplace/remove.test.ts` — the fold case with its hooks-untouched half, two end-to-end cascade cases, `projectCase` relocates HOME, `pluginRecord` honors a `workflows` argument
- `tests/orchestrators/plugin/uninstall.test.ts` — `seedFullPlugin` and `seedGitPlugin` extended; two new cases
- `tests/orchestrators/plugin/enable-disable.test.ts` — a `withWorkflow` knob on `seedRealDisabledMarketplace` and the disable case

## Decisions Made

**Both fold tests were observed RED before their filter lines landed.** The shared fold's case failed with `actual: ['sample:drop', 'sample:keep'], expected: ['sample:keep']`; the marketplace fold's case failed with `actual: ['beta:greet', 'beta:farewell'], expected: ['beta:farewell']`. After both lines landed, deleting them again and re-running the two suites produced exactly 2 failures out of 99 tests, and restoring them returned 99/99. A fold test written after its line proves only that it compiles, so both directions were exercised.

**The pre-existing hooks omission was observed and left.** `cascadePluginsInPlace`'s filter is four-axis and omits `dropped.hooks`. That divergence predates this work and is filed as **CASCADEAX-01** in `.planning/BACKLOG.md` (§"the cascade `dropped` fold reads its axes structurally"). Only the `workflows` line was added. The new case asserts the persisted record STILL names the hook the cascade dropped (`resources.hooks === ["beta"]`), so a later reader who "fixes" it turns that assertion red rather than landing an unrelated behavior change unnoticed. `grep -c 'dropped.hooks' extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` prints `0`.

**The duplication sub-gate did not flag the added filter lines.** `npm run fallow` exits 0 after both edits. Its `dupes` report names two clone groups inside `orchestrators/plugin/shared.ts` and one pair across the agents/commands bridge `stage.ts` files — all pre-existing, none involving either fold. The two folds stay textually distinct (different receiver names, different comment bodies), and no `ignoredClones` entry was added.

**The materialize-then-disable path inherits with no edit.** `disableFreshlyInstalled` (`install.ts:1473`) calls `cascadeUnstagePlugin` and then `foldFailedDisableCascade`; it has no removal call of its own. `install.ts` does contain one `unstagePluginWorkflows` call, at line 1216 — that is the ledger's `workflowsPhase.undo`, landed by plan 112-01, not a per-verb removal. The DFEN-04 byte-identity claim therefore still holds by construction. Confirmed by reading, and no redundant case was added.

**The throw is placed after the accumulator assignment.** `dropped.workflows` is assigned from `removedNames` before the `failed.length > 0` check raises, so the partial-failure return reports the names the same pass did remove. The "raises a typed workflows failure" case asserts exactly that: `dropped.workflows === ['sample:greet']` alongside a two-name failure array.

**Copy semantics.** `WorkflowsUnstageFailureError` freezes a defensive copy, per plan 112-01's decision and its owner test at `tests/orchestrators/marketplace/shared.test.ts` ("freezes a defensive copy of its typed failures"). This plan consumes the class unchanged and adds no second copy-discipline assertion.

**`PathContainmentError` was not re-folded.** The cascade neither catches nor translates it; it flows into the surrounding `try` and lands on the partial-failure return's `cause`, the same treatment every other bridge throw gets.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] Three test suites had to relocate HOME**

- **Found during:** Tasks 1 and 3
- **Issue:** `workflowsSavedDir` is derived from `os.homedir()` and honors no environment override (`platform/workflow-home.ts`). `createProjectScope` (marketplace shared suite) and `projectCase` (marketplace remove suite) built their locations bundle without relocating HOME, so the moment the cascade started unlinking recorded envelope names, those cases would have reached the real user's `~/.pi/workflows/`.
- **Fix:** Both helpers now `mkdtemp` a home, assign `process.env.HOME` BEFORE `locationsFor(...)`, and restore-and-remove it in `t.after`. `uninstall.test.ts` and `enable-disable.test.ts` already had `withHermeticHome` wrappers and needed no change.
- **Files modified:** `tests/orchestrators/marketplace/shared.test.ts`, `tests/orchestrators/marketplace/remove.test.ts`
- **Verification:** every new case reads and asserts under the relocated root; `npm test` green at 5413
- **Committed in:** `edb7007c` and `ce4b98f9`

**2. [Rule 1 - Bug] The planned containment-refusal case tested the wrong class**

- **Found during:** Task 1
- **Issue:** A case was drafted asserting that a recorded name of `../escape` surfaces as a `PathContainmentError` on the failure cause. `locations.workflowArtifactPath` runs `assertSafeName` first, and that helper throws a plain `Error` for a path separator — so the bridge classifies it as an ordinary per-name failure and it becomes a `WorkflowsUnstageFailureError`, not the containment class.
- **Fix:** Removed the case rather than asserting a false claim. The containment class's propagation is already pinned by plan 112-01 at the install ledger (`PI-14: a containment refusal from the workflows undo propagates verbatim`), which is where `assertPathInside` can actually be reached.
- **Files modified:** `tests/orchestrators/marketplace/shared.test.ts`
- **Verification:** `marketplace/shared.ts` still reports `hit === found` on branches, functions and lines without it
- **Committed in:** `edb7007c`

**3. [Rule 1 - Bug] A retry-proof expectation contradicted the cascade's own ordering**

- **Found during:** Task 3
- **Issue:** `retry proof: uninstall: a hooks cascade refusal persists the shrunken record and the retry converges` asserted the first pass's record carries `workflows: []`. Once `seedFullPlugin` records an envelope, that is wrong: the injected refusal lands on the hooks arm, which the cascade reaches BEFORE the workflows arm, so the envelope is untouched and the record must still name it.
- **Fix:** Expectation changed to `[seeded.workflowName]`, with a comment stating why the ordering makes that the correct value.
- **Files modified:** `tests/orchestrators/plugin/uninstall.test.ts`
- **Verification:** suite green at 60 tests; the retry's second pass still converges to a removed record
- **Committed in:** `ce4b98f9`

**4. [Rule 3 - Blocking] Eleven `dropped` literals across three suites needed the axis**

- **Found during:** Task 1
- **Issue:** Widening `UnstageOutcome.dropped` produced 11 `tsc` errors — 2 in `marketplace/shared.ts` itself (the two freezes) and 9 in test literals building cascade stubs or `satisfies UnstageOutcome` pins. A further 6 `assert.deepStrictEqual(outcome.dropped, {...})` literals were NOT compile-visible and failed at runtime instead.
- **Fix:** `workflows: []` added at each. The runtime-only six are the same class the plan warns about: a structural comparison that keeps compiling while the shape moves under it.
- **Files modified:** `tests/orchestrators/marketplace/shared.test.ts`, `tests/orchestrators/marketplace/remove.test.ts`, `tests/orchestrators/plugin/uninstall.test.ts`
- **Verification:** `npm run typecheck` at 0 errors; all three suites green
- **Committed in:** `edb7007c`

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bugs)
**Impact on plan:** All four are consequences of widening a closed set that fixtures mirror by hand, plus one drafted assertion that did not survive contact with `assertSafeName`. No scope creep; nothing outside the plan's declared file set was touched.

## Issues Encountered

**The typecheck worklist was 11, not "around 12".** The plan predicted "around twelve compile errors across four files"; the measured count immediately after adding the axis was 11 across 4 files (2 production, 9 test). The gap is one: the plan's estimate counted the two `Object.freeze` returns and the four files correctly, and the research's own figure of 12 predates plan 112-01's own edits to these fixtures. The direction the criterion actually checks — a number far above zero, proving the axis landed on the shared type — held.

**`grep -c 'workflows' extensions/.../marketplace/shared.ts` prints 18, not 5.** The criterion's floor of 5 is satisfied; the higher number is the doc comments and the import line, not padding.

**The disable case passed on its first run, which is the shape a false positive takes.** It was verified load-bearing by setting the cascade's `previousWorkflowNames` to `[]` and re-running: exactly that case and the uninstall case turned red, and restoring the line returned both to green. The same sabotage was applied to the marketplace remove suite with the same result.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Every removal path clears workflow envelopes, so plan 112-03's reinstall can re-materialize against a directory it knows is clean of its own prior envelopes.
- The disabled record deliberately RETAINS `resources.workflows` after a disable. The enable path reads that inventory to displace its own envelopes aside instead of hitting the occupancy refusal; a plan that changes the disable fold must keep that asymmetry.
- `CASCADEAX-01` remains open: the hand-rolled fold still omits the hooks axis, and both folds still read their argument structurally, so a SEVENTH axis would be silently dropped again. The two new fold tests only cover `workflows`.
- No notification reason token was added for a workflows cascade failure; the unclassified cascade-failure default resolves to a truthful reason. A closed-set amendment remains a later phase's work.

## Self-Check: PASSED

- All 8 modified files verified present on disk.
- All three commit hashes verified in `git log`: `edb7007c`, `246f855c`, `ce4b98f9`.
- `npm run typecheck` 0 errors; `npm run lint` exit 0; `npm run fallow` exit 0; `npm run format:check` exit 0; `npm test` 5413/5413; `npm run test:integration` 32/32.
- `npm run test:corresponding` and `npm run test:corresponding:negative` both exit 0.
- `node scripts/test-coverage-direct.mjs` reports `hit === found` on branches, functions and lines for `marketplace/shared.ts` (102/102, 19/19, 818/818), `plugin/shared.ts` (166/166, 42/42, 1435/1435), `marketplace/remove.ts` (97/97, 22/22, 800/800), `plugin/uninstall.ts` (79/79, 11/11, 773/773) and `plugin/enable-disable.ts` (140/140, 24/24, 1349/1349).
- Acceptance greps: `unstagePluginWorkflows` in `marketplace/shared.ts` = 2 (≥1); `WorkflowsUnstageFailureError` = 3 (≥3); `dropped.workflows` = 1 in each fold file (≥1 each); `dropped.hooks` in `remove.ts` = 0; `workflowsSavedDir` = 6 / 1 / 5 in the three verb suites (all ≥1).
- `grep -rnE '^export (const|function|async function) __test_' extensions/` prints 0. No `fallow-ignore` marker was added.
- `git status` clean of tracked changes after every commit.

---
*Phase: 112-install-and-removal-lifecycle*
*Completed: 2026-09-05*

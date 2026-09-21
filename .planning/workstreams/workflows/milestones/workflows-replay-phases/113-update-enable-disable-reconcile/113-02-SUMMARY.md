---
phase: 113-update-enable-disable-reconcile
plan: 02
subsystem: api
tags: [update, workflows, orchestrator, state-record, phase-ledger, typescript]

requires:
  - phase: 111-workflows-bridge
    provides: "`prepareStageWorkflows` / `commitPreparedWorkflows` / `abortPreparedWorkflows`, the `previousWorkflowNames` parameter, the displace-and-restore commit path, the ownership pre-check, and the `onPlaced` placed-name contract"
  - phase: 112-install-and-removal-lifecycle
    provides: "`record.resources.workflows` as a required persisted array, and the install ledger's own `onPlaced` capture as the shape to copy"
  - phase: 113-01
    provides: "the required `tense` discriminant on the discovery call (the update path's staging pass states `install` inside the bridge, so nothing here changed)"
provides:
  - "`update` prepares, aborts, commits and records workflows as a sixth bridge"
  - "the CR-02 / CR-03 two-window record policy: a union at the intent mark, a narrow at finalize"
  - "`placedWorkflowNames` threaded from the phase-3a commit into the per-bridge record write"
  - "one merged abort helper with per-arm guards, replacing the partial/complete pair"
  - "a workflow-bearing update fixture, and the deterministic refusal vehicle every workflows-failure case drives"
  - "one reachability case per already-widened `workflows` failure slot"
affects: [113-03, 113-04, 113-05]

actuals:
  tokens: 132860
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "a two-window record policy for an inventory with no filesystem backstop: over-name before the mutation, narrow to what the mutation reported afterwards"
    - "one guarded unwind function serving both the partial and the complete abort caller, so no arm can exist in one path and be missing from the other"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/types.test.ts

key-decisions:
  - "The two abort helpers were MERGED into one guarded `abortHandles`. Workflows prepares last, so the workflows arm inside `abortPartialHandles` was unreachable by construction and the direct-coverage gate flagged it (branches 394/395). One implementation with five `!== undefined` guards makes every arm reachable from both callers."
  - "`applyPerBridgeResources` takes `previousWorkflowNames` explicitly rather than reading it off the record it mutates: by finalize time that record already carries the intent-mark union, so it cannot supply the pre-update inventory."
  - "The workflows phase-3a arm lives in its own `commitUpdateWorkflows` function. It answers two questions no sibling arm has to -- did the commit fail, and what did it place -- and folding both into the parent would have pushed `commitUpdatePhase3a` past the unit-size ceiling."
  - "The record's failure branch is a ternary, not an `if (!failedPhases.has(...))` gate like its five siblings. Both branches write; neither is a no-op."
  - "The workflow prepare's warnings join the discovery half at the composition site in `collectUpdateWarnings`, NOT through `splitStagingWarnings`. The shared classifier stays at four members."
  - "The update fixture installs the from-version for real rather than hand-seeding a record, so `previousWorkflowNames` names envelopes that are actually on disk and the displace-and-restore path runs against real files."
  - "The fixture's plugin must carry `omitPluginJsonVersion: true`. With the version mirrored into `plugin.json` the SNM-34 tier-1 lookup wins, a manifest rewrite moves nothing, and the update resolves `unchanged` -- every workflow assertion then passes or fails for the wrong reason."

patterns-established:
  - "An inventory naming artifacts outside every scope root is written in two windows: the union of recorded-and-about-to-be-committed BEFORE the mutation, and recorded-plus-actually-placed (or exactly-staged, on success) AFTER it. Over-naming is the safe direction because removal and re-staging are both ENOENT-tolerant."
  - "A reachability claim gets one case per slot, each observing a DIFFERENT value the production code produced -- a persisted record, a returned outcome, rendered bytes -- rather than one end-to-end case that touches one slot and leaves the rest inferred."

requirements-completed: [WLIF-02]

coverage:
  - id: D1
    description: "`update` stages workflow envelopes for the new version against the recorded inventory, and unwinds them first when anything before the commit fails"
    requirement: "WLIF-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WLIF-02: an abort after the workflows prepare leaves no workflows staging tree"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WLIF-02: a plugin with no workflows and an empty inventory stages nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "the workflow prepare's discovery warnings reach the standalone user's diagnostic channel and the cascade outcome's notes"
    requirement: "WLIF-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WLIF-02: a workflow version B cannot admit reaches the standalone diagnostic channel"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WLIF-02: the same workflow warning rides the cascade outcome's notes"
        status: pass
    human_judgment: false
  - id: D3
    description: "an author's workflow fix reaches the user's disk: an added workflow lands, a withdrawn one is removed, a renamed one appears under the new name with the new bytes"
    requirement: "WLIF-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WLIF-02: an update that adds a workflow writes its envelope and records the placed name"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WLIF-02: a workflow the new version withdrew loses its envelope and its recorded name"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WLIF-02: a workflow the new version renamed lands under the new name with the new bytes"
        status: pass
    human_judgment: false
  - id: D4
    description: "the intent-mark window widens the recorded workflow inventory to the union, observable on the persisted file, and the finalize window narrows it back"
    requirement: "WLIF-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#CR-02: the intent-mark window widens the recorded inventory to the union"
        status: pass
    human_judgment: false
  - id: D5
    description: "a workflows commit failure is recorded rather than swallowed, does not abort the update, and leaves the record naming the pre-update names plus whatever was placed"
    requirement: "WLIF-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#CR-03: a workflows staging-cleanup leak is a recorded failure and the record keeps the union"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#CR-03: a refused workflows commit leaves the foreign file and restores the previous envelope"
        status: pass
    human_judgment: false
  - id: D6
    description: "each of the three already-widened `workflows` failure slots is reached by its own case driving the real verb"
    requirement: "WLIF-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WR-03: a workflows failure reaches the update ledger's failed-phase set"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WR-03: a workflows failure reaches the update outcome's per-phase failure list"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WR-03: a workflows failure reaches the rendered rollback-partial row"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/types.test.ts#UPDATE_PHASE_FAILURE_WORKFLOWS (compile-time `satisfies UpdatePhaseFailure`, carried on PLUGIN_UPDATE_FAILED_FULL)"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-09-05
status: complete
---

# Phase 113 Plan 02: `update` as a sixth-bridge verb Summary

**An author's workflow fix now reaches the user's disk, a withdrawn workflow stops being registered, and the one inventory that can name an artifact living outside every scope root is written twice — wide before the commit, narrow after it — so no failure path can strand executable code that nothing names.**

## Performance

- **Duration:** ~70 min
- **Started:** 2026-09-06T00:25:00Z (approx.)
- **Completed:** 2026-09-06T01:33:00Z
- **Tasks:** 3 of 3
- **Files modified:** 3

## Task Commits

1. **Task 1: the prepare and abort arms, and a workflow-bearing update fixture** — `183a6d99` (feat)
2. **Task 2: the phase-3a commit arm and the two-window record policy** — `e67a5949` (feat)
3. **Task 3: one reachability case per widened failure slot** — `b2db09f0` (test)

## Accomplishments

- `update` carries a sixth bridge at all four seams. `PrepHandles` gained a `workflows` member; the prepare appends after mcp and supplies `record.resources.workflows` as `previousWorkflowNames`; the abort unwinds it first; the phase-3a commit runs it last and records its failure without aborting the update.
- The record write is deliberately unlike its five siblings, and both of its branches write.
- The three already-widened `workflows` failure slots are each reached by a case that drives the real verb and observes a different production-produced value.
- `update.ts` direct coverage is 100 % on branches, functions and lines.

## Answers the plan asked for

### 1. Which slot each reachability case reaches, and the observation proving it

| Slot | Case | Observation | Why the observation is decisive |
|---|---|---|---|
| `PHASE3_FAILURE_PHASES` and its derived `Phase3Phase`, inside `update.ts` | `WR-03: a workflows failure reaches the update ledger's failed-phase set` | The **persisted record**: `resources.workflows` equals `["hello:greet"]`, the pre-update inventory alone, while `resources.skills` is non-empty. | `finalizeUpdateRecord` builds its failed-phase set by filtering the reported phases through the runtime tuple. Without the `workflows` member the filter drops this failure, the record takes the SUCCESS arm, and the persisted value becomes the prepared pair `["hello:greet", "hello:wave"]` — which names the planted foreign file. Only the failure arm can produce the pre-update inventory alone. The non-empty skills array rules out "finalize never ran". |
| `UpdatePhaseBridge` in `orchestrators/types.ts` | `WR-03: a workflows failure reaches the update outcome's per-phase failure list` | The **returned cascade outcome**: `phaseFailures.map(f => f.phase)` deep-equals `["workflows"]`. | `PluginUpdateFailedOutcome.phaseFailures` is typed `readonly UpdatePhaseFailure[]`, whose `phase` is that union. A `workflows` entry arriving on a real return value is the union member being produced rather than declared. Also exercised at compile time in `tests/orchestrators/types.test.ts` through `UPDATE_PHASE_FAILURE_WORKFLOWS`, carried on `PLUGIN_UPDATE_FAILED_FULL`. |
| `Phase3Failure.phase` in `shared/errors.ts` | `WR-03: a workflows failure reaches the rendered rollback-partial row` | The **rendered notification bytes**: the body carries `{rollback partial}` and the child row `[workflows] (rollback failed)`. | The direct path hands `notifyDirectFailure` the typed `Phase3Failure[]` verbatim as `rollbackPartial`, and the renderer composes one indented child row per entry off `failure.phase`. The literal reaching the screen is that interface's member being produced. |

All three drive `seedRefusedWorkflowUpdate`, and none constructs a phase-failure object as its subject. `grep -rnE '^export (const|function|async function) __test_' extensions/pi-claude-marketplace/ | wc -l` prints `0` — no module was patched to reach the failure.

### 2. Did either complexity ceiling force an extraction?

**Yes, once — and it was the phase-3a commit.**

`commitUpdatePhase3a` already carried five arms. Adding a sixth inline, with the `onPlaced` capture and the two-branch leak handling, would have pushed it past `fallow health`'s `maxUnitSize: 60`. The workflows arm therefore lives in its own **`commitUpdateWorkflows`**, which returns `{ failure, placedNames }`; the parent contributes four lines and a widened return type. No threshold override was added and no suppression marker was added — `.fallowrc.json` still carries zero `health.thresholdOverrides`.

Nothing else breached. `prepareUpdateHandles`, `collectUpdateWarnings`, `markUpdateInProgress` and `applyPerBridgeResources` all took their new arms inline and `npm run fallow` exits 0.

A **second** structural change happened for a different reason — the direct-coverage gate, not a complexity ceiling. It is recorded under Deviations below.

### 3. The exact shape of the workflow-bearing update fixture

Plan 04 stamps its reason token off this fixture, so the shape is stated exactly.

Three helpers, all in `tests/orchestrators/plugin/update.test.ts`, all used from inside `withHermeticHome` (the workflow home derivation reads `process.env.HOME`; a `locationsFor` call outside the closure points `workflowsSavedDir` at the developer's real home):

```ts
// Replaces the whole script set. Called once before the install for the
// from-version tree, then again with the new set for the to-version tree.
async function writeWorkflowScripts(
  marketplaceRoot: string,
  pluginName: string,
  workflows: readonly { sourceName: string; body?: string }[],
): Promise<void>;

// Seeds a path marketplace and INSTALLS it, so the pre-update record names
// envelopes actually on disk.
async function seedInstalledWorkflowPlugin(opts: {
  readonly cwd: string;
  readonly version: string;
  readonly workflows: readonly { sourceName: string; body?: string }[];
}): Promise<{ readonly marketplaceRoot: string; readonly manifestPath: string }>;

// The deterministic failure vehicle: version A installs `greet`, version B adds
// `wave`, and a foreign envelope is planted at version B's `hello:wave` target.
async function seedRefusedWorkflowUpdate(cwd: string): Promise<{
  readonly locations: ReturnType<typeof locationsFor>;
  readonly foreignPath: string;
  readonly foreignBytes: string;
}>;
```

Four facts a consumer must inherit:

1. **The plugin is `hello` in marketplace `mp`, project scope, seeded through `seedPathMarketplace` with `hasSkill: true` and `omitPluginJsonVersion: true`.** The last flag is load-bearing — see Deviations.
2. **The version transition is `1.0.0` → `2.10.0`, applied with `rewriteManifest`.** `2.10.0` rather than `2.0.0` on purpose: the marketplace manifest is cached on `(mtimeMs, size)`, and a same-length replacement can be declined.
3. **The default script body is `export const meta = { name: "<sourceName>", description: "does <sourceName>" };\n`,** so the generated name is `hello:<sourceName>` and the envelope lands at `<workflowsSavedDir>/hello:<sourceName>.json`. A body with no `meta` export classifies as **skipped** and writes zero envelopes — that is the soft-fail seed (`{ sourceName: "broken", body: "export default function run() {}\n" }`).
4. **`entriesOf(directory)` and `readEnvelope(savedDir, generatedName)`** are the two read helpers; the first returns `[]` for a directory that was never created, which is how the WPTH-05 "no storage root for a workflow-less plugin" claim is asserted.

## The two-window record policy, as shipped

| Window | Site | Write |
|---|---|---|
| Intent mark | `markUpdateInProgress` (CR-02) | `resources.workflows = [...new Set([...recorded, ...handles.workflows.result.stagedNames])]` |
| Finalize, workflows succeeded | `applyPerBridgeResources` (CR-03) | `resources.workflows = [...handles.workflows.result.stagedNames]` |
| Finalize, workflows failed | `applyPerBridgeResources` (CR-03) | `resources.workflows = [...new Set([...previousWorkflowNames, ...placedWorkflowNames])]` |

`placedWorkflowNames` originates in the bridge's `onPlaced` callback, is returned by `commitUpdatePhase3a`, and reaches the record write as an explicit argument. It is never derived from `prep.result.stagedNames`.

`previousWorkflowNames` at the finalize site is `preflight.record.resources.workflows` — passed in explicitly because the record `applyPerBridgeResources` mutates already carries the intent-mark union by then and therefore cannot supply it.

### On "placed some, then failed"

The plan's Task-2 acceptance names a case where the commit *placed some names and then failed*. Two failure shapes are reachable through the verb, and they are the two the bridge's design permits:

- **All placed, then failed** — the staging-cleanup leak (`CR-03: a workflows staging-cleanup leak…`). The record ends as `["hello:greet", "hello:wave", "hello:zap"]`: strictly larger than the recorded set `[greet, wave]` and strictly larger than the staged set `[greet, zap]`, so neither one alone could have produced it. That is the union arm proven distinctly.
- **None placed, then failed** — the ownership refusal (`CR-03: a refused workflows commit…` and all three `WR-03` cases). The record narrows to `["hello:greet"]`, and the prepared-but-unplaced `hello:wave` is absent — which is the "no prepared-but-unplaced name" proof.

A **partial** placement (placed ⊊ prepared, placed ≠ ∅) has no deterministic vehicle, and that is by design rather than by omission: `assertTargetsUnoccupied` checks the entire target set before the first rename precisely so a refusal leaves zero completed renames, and the rollback loop reverses every completed rename. Reaching a genuine partial would require a rename to fail *and* its own reversal to fail. The two reachable shapes above bracket it from both sides.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] The two abort helpers were merged into one**

- **Found during:** Task 2, from the direct-coverage gate.
- **Issue:** The plan directs a workflows arm into **both** `abortPartialHandles` and `abortHandles`. But the workflows prepare is **last** inside `prepareUpdateHandles`, and `abortPartialHandles` is called only from that prepare's own catch — so `handles.workflows` is `undefined` on every reachable call. `node scripts/test-coverage-direct.mjs …/update.ts` reported `branches 394/395, lines 3311/3313` with lines 1432-1433 (the guard body) uncovered. Task 2's `<verify>` requires `hit === found`, and the plan's prohibitions forbid a suppression marker.
- **Fix:** One `abortHandles(handles: Partial<PrepHandles>)` with five `!== undefined` guards, in the reverse of the prepare order — workflows, mcp, agents, commands, skills. `PrepHandles` is assignable to `Partial<PrepHandles>`, so the intent-mark caller passes a complete bundle (every guard true, covered by the ST-9 abort case) and the prepare caller passes a partial one (guards false past the failure point, covered by the existing MCP-collision case). The merge also closed a real asymmetry: the partial helper had no mcp arm at all, so a workflows-prepare failure never released the mcp handle.
- **Consequence for the plan's acceptance check:** `grep -c 'abortPreparedWorkflows' extensions/…/update.ts` now prints **2**, not the `>= 3` Task 1 names. That threshold was written against a two-helper shape. The property it stands for — no unwind path can omit the workflows arm — is now structural rather than duplicated, and stronger for it.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`, plus the stale `abortPartialHandles` references in the owner test's comments.
- **Verification:** `update.ts` direct coverage is 100.00 / 100.00 / 100.00.
- **Committed in:** `e67a5949`

**2. [Rule 1 — Bug] The first fixture draft could not move the version, so three cases passed for the wrong reason**

- **Found during:** Task 1.
- **Issue:** `seedPathMarketplace` mirrors `version` into the plugin's own `.claude-plugin/plugin.json`, which is tier 1 of the SNM-34 ladder and outranks the manifest entry. A `rewriteManifest` bump therefore moved nothing: `update` resolved `unchanged`, prepared no handles, and the workflow assertions never ran. Two cases failed loudly; one (`the same workflow warning rides the cascade outcome's notes`) reported `partition: 'unchanged'`.
- **Fix:** `seedInstalledWorkflowPlugin` seeds with `omitPluginJsonVersion: true`, and the bump is `1.0.0` → `2.10.0` rather than `2.0.0` so the manifest's `(mtimeMs, size)` cache key changes on the size axis too.
- **Files modified:** `tests/orchestrators/plugin/update.test.ts`
- **Verification:** all six behavior cases assert on a `partition: "updated"` or `partition: "failed"` outcome and a moved `record.version`.
- **Committed in:** `183a6d99`

**3. [Rule 2 — Missing critical functionality] The module header's bridge ordering had gone stale**

- **Found during:** Task 2.
- **Issue:** The header narrated the prepare order as `skills -> commands -> agents -> mcp` and phase 3a the same way, and `prepareUpdateHandles`'s doc comment said "all four bridges". After this change all three claims are false, and the ordering claim is the one a future sixth-arm author reads first.
- **Fix:** Updated the three sites to name the workflows slot. No behavior change.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
- **Committed in:** `e67a5949`

---

**Total deviations:** 3 auto-fixed (1 × Rule 1, 1 × Rule 2, 1 × Rule 3)
**Impact on plan:** No scope creep. Deviation 1 is the one a reviewer should read: it changes a function the plan named, and it moves one acceptance grep below its stated threshold. It was forced by a gate the same plan mandates.

## Issues Encountered

- **The staging-cleanup leak vehicle needs a mode restore in its own `finally`.** The case seals `workflowsStagingDir` at `0o500` from inside the intent-mark watcher. `withHermeticHome` removes the whole hermetic home in its own `finally`, which runs *after* the case's, and a `0o500` directory would make that `rm` throw. The mode is restored before the case returns.
- **TruffleHog fails structurally in this checkout** — `.git` is a file (linked worktree), so the git-mode scan cannot read `.git/index`. Confirmed clean by filesystem-mode scan over the exact paths committed (`verified_secrets: 0`, `unverified_secrets: 0`) for all three commits, then committed with `SKIP=trufflehog` only, per CLAUDE.md. No other hook was skipped and `--no-verify` was never used.
- **No pre-commit hook is installed in this checkout**, so `pre-commit run --files` was run by hand before each commit. `git status` after each commit shows no hook-written file.

## Gate status

Every `npm run check` member run and green at the final commit:

| Member | Result |
|---|---|
| `typecheck` | exit 0, 0 `error TS` |
| `lint` | exit 0 |
| `fallow` (dead-code / health / dupes) | exit 0, no threshold override, no suppression marker |
| `format:check` | "All matched files use Prettier code style!" |
| `test:corresponding` (+ negative) | passed |
| `test:coverage:direct:negative` | passed |
| `test` | 5474 pass / 0 fail |
| `test:integration` | 32 pass / 0 fail |
| `test-coverage-direct` on `update.ts` | branches 100.00, functions 100.00, lines 100.00 |
| `__test_` seam count | 0 |

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — the `workflows` handle, the prepare arm, the merged `abortHandles`, `commitUpdateWorkflows`, the `placedWorkflowNames` return and parameter, the CR-02 intent-mark union, the CR-03 record ternary, the warning composition, and the header's bridge ordering
- `tests/orchestrators/plugin/update.test.ts` — the three fixture helpers, `entriesOf` / `readEnvelope`, and 13 new cases
- `tests/orchestrators/types.test.ts` — `UPDATE_PHASE_FAILURE_WORKFLOWS`, carried on `PLUGIN_UPDATE_FAILED_FULL`

## User Setup Required

None.

## Next Phase Readiness

Ready. Four things plans 03–05 inherit:

- **The fixture shape above is fixed.** Plan 04 stamps its reason token off `seedInstalledWorkflowPlugin` + `writeWorkflowScripts`; the generated-name form is `hello:<sourceName>` and the transition is `1.0.0` → `2.10.0`.
- **`seedRefusedWorkflowUpdate` is the reusable workflows-failure vehicle** for any later case needing a deterministic, places-nothing failure through `update`.
- **`abortPartialHandles` no longer exists in `update.ts`.** A plan editing the unwind path edits `abortHandles`. (`reinstall.ts` keeps its own separately-named helper; nothing here touched it.)
- **The `(updated)` outcome does NOT yet carry staged workflow names.** WLIF-06's retirement gate needs `previous names \ staged names`, and plan 03 owns putting that on the enable/disable projection; `update`'s success return is unchanged by this plan.

No blockers.

---
*Phase: 113-update-enable-disable-reconcile*
*Completed: 2026-09-05*

## Self-Check: PASSED

Every file this summary claims exists on disk, and every commit hash it names resolves in `git log`.

- Files verified: `113-02-SUMMARY.md`, `orchestrators/plugin/update.ts`, `tests/orchestrators/plugin/update.test.ts`, `tests/orchestrators/types.test.ts`
- Commits verified: `183a6d99`, `e67a5949`, `b2db09f0`
- `.planning/workstreams/workflows/STATE.md` and `ROADMAP.md`: untouched, per the orchestrator's ownership of those files.

---
phase: 112-install-and-removal-lifecycle
plan: 01
subsystem: infra
tags: [workflows, install-ledger, state-schema, rollback, typebox, fallow]

requires:
  - phase: 111-workflows-bridge
    provides: the workflows bridge triplet (prepareStageWorkflows / commitPreparedWorkflows / unstagePluginWorkflows) and its onPlaced removal-payload contract
provides:
  - "`resources.workflows`: a REQUIRED string-array member of the persisted plugin install record, with its migrate default-fill"
  - "`workflowsPhase`: the sixth and last bridge slot of the install ledger, between mcp and state"
  - "`WorkflowsUnstageFailureError`: a typed per-name removal failure carrying a frozen defensive copy"
  - "the `orchestrators` -> `bridges-workflows` fallow allow-list edge"
  - "the three mirrored ledger-phase closed sets widened with `workflows`"
affects: [112-02 cascade removal, 112-03 reinstall re-materialization, 112-04 staging sweep]

actuals:
  tokens: 31800
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "sixth ledger phase modelled on mcpPhase: sentinel handle assigned BEFORE the commit, names harvested AFTER via onPlaced"
    - "undo removes only the names the commit REPORTED, never the prepared names"
    - "a non-empty unstage failed[] raises rather than being discarded, unlike the five sibling phases"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/persistence/migrate.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - .fallowrc.json
    - tests/orchestrators/plugin/install.test.ts
    - tests/transaction/phase-ledger.test.ts
    - tests/persistence/state-io.test.ts
    - tests/persistence/migrate.test.ts
    - tests/integration/workflow-kind-inversion.test.ts

key-decisions:
  - "`resources.workflows` is REQUIRED, not optional, so every construction site is compile-forced to answer for it; the schema edit produced 67 tsc errors across 30 files, three of them production."
  - "No schemaVersion bump. The `hooks` axis set the precedent of a required resources member added with a migrate default-fill and no bump."
  - "`WorkflowsUnstageFailureError` freezes a defensive copy of its payload, following WorkflowNameCollisionError rather than the no-copy AgentsUnstageFailureError next door."
  - "PathContainmentError is NOT re-folded. It escapes runPhases as a throw and bypasses the capture assignment, so the failure row carries no version and no rollback-partial marker. Pinned by a test so a later reader does not repair it."
  - "The complexity extraction the plan budgeted was needed on two TEST helpers, not on the install ledger body."

patterns-established:
  - "Raced-record vehicle: a Proxy on marketplaces[mp].plugins that reveals a record only on the LAST read drives a statePhase failure, which is the only way to reach the last bridge slot's undo."
  - "Mid-sequence-commit vehicle: a rename fault inside the workflows commit reaches the same undo through installPlugin, so the rendered failure row can be asserted."

requirements-completed: [WLIF-01, WLIF-02]

coverage:
  - id: D1
    description: "Installing a workflow-bearing plugin writes one envelope per admitted workflow and the persisted record names exactly those envelopes"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WLIF-01: an installed workflow lands as an envelope and the record names it"
        status: pass
      - kind: integration
        ref: "tests/integration/workflow-kind-inversion.test.ts#WINV-02 / WBRG-01: a workflow-bearing plugin installs with no partial flag, and the bridge materializes its script as an envelope"
        status: pass
    human_judgment: false
  - id: D2
    description: "A statePhase failure after the workflows phase committed leaves no envelope at any target path and no staging tree, asserted as filesystem facts"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WLIF-01: a statePhase failure takes the envelope and the staging tree back"
        status: pass
    human_judgment: false
  - id: D3
    description: "The removal payload is what onPlaced reported: a foreign envelope at a name this install did not place survives byte-unchanged"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#T-112-01: an envelope this install did not place survives the undo byte-unchanged"
        status: pass
    human_judgment: false
  - id: D4
    description: "An undo that cannot remove a name raises WorkflowsUnstageFailureError, order-independently, and the ledger renders it as a [workflows] (rollback failed) child row"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WLIF-03: an unremovable envelope does not abort the rest of the removal"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WLIF-03: a failed workflows removal renders a rollback-partial child naming the phase"
        status: pass
    human_judgment: false
  - id: D5
    description: "A PathContainmentError from the workflows undo propagates verbatim with no rollback-partial marker and no version on the row"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#PI-14: a containment refusal from the workflows undo propagates verbatim"
        status: pass
    human_judgment: false
  - id: D6
    description: "A legacy state.json record missing resources.workflows is default-filled to [] before validation, idempotently, with no schemaVersion bump"
    requirement: "WLIF-01"
    verification:
      - kind: unit
        ref: "tests/persistence/migrate.test.ts#fills the workflows inventory on a legacy record that predates the field"
        status: pass
      - kind: unit
        ref: "tests/persistence/migrate.test.ts#leaves a record that already carries its workflows inventory untouched"
        status: pass
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#rejects a plugin whose resources omit workflows at the published validator"
        status: pass
    human_judgment: false
  - id: D7
    description: "The three mirrored ledger-phase closed sets and the exhaustiveness pin all carry `workflows`, with no behavior change in update.ts"
    requirement: "WLIF-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/types.test.ts (UPDATE_PHASE_BRIDGES satisfies Record<UpdatePhaseBridge, true>)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts (full suite green, no existing phase arm changed)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The orchestrators zone allows the workflows bridge, in the commit that first imports it"
    verification:
      - kind: other
        ref: "npm run fallow (exit 0); removing the allow-list string makes `fallow dead-code` exit 1 naming both new edges"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-09-05
status: complete
---

# Phase 112 Plan 01: Install and removal lifecycle Summary

**The install record gained a required `resources.workflows` inventory and the install ledger gained a sixth bridge phase that writes workflow envelopes and takes back exactly what it placed.**

## Performance

- **Duration:** 70 min
- **Started:** 2026-09-05T15:50:00Z (approx, first commit at 15:52:33Z)
- **Completed:** 2026-09-05T16:59:23Z
- **Tasks:** 3 (Task 1 landed in two commits, A and B)
- **Files modified:** 51

## Accomplishments

- `PLUGIN_INSTALL_RECORD_SCHEMA` carries a required `workflows: Type.Array(Type.String())`, `clonePluginRecord` enumerates it, and `ensureOneRecordResources` default-fills it before validation. No `schemaVersion` bump.
- `workflowsPhase` is the sixth and last bridge slot of the install ledger, modelled on `mcpPhase`: the prepared handle is the undo sentinel and is assigned before the commit, the names come from `onPlaced` after it, and the bridge's warnings ride `bridgeWarnings`.
- The undo removes only reported names, raises `WorkflowsUnstageFailureError` on a non-empty `failed[]`, and lets `PathContainmentError` escape by class.
- `.fallowrc.json` allows `orchestrators` to reach `bridges-workflows`, landed in the same commit as the first two imports of the bridge.
- `Phase3Failure.phase`, `UpdatePhaseBridge` and `PHASE3_FAILURE_PHASES` all carry `workflows`, with the exhaustiveness pin closed and no behavior change in `update.ts`.
- `install.ts`, `state-io.ts`, `migrate.ts`, `marketplace/shared.ts`, `shared/errors.ts` and `update.ts` are each at 100% direct coverage on branches, functions and lines. No `fallow-ignore`, no accepted shortfall.

## Task Commits

1. **Task 1 Commit A: the record inventory** — `a025d5b4` (feat)
2. **Task 1 Commit B: the sixth ledger phase** — `d02db74b` (feat)
3. **Task 2: pin the rollback evidence on disk** — `6d01ed99` (test)
4. **Task 3: widen the mirrored closed sets** — `6f8e1c6a` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/persistence/state-io.ts` — the required `resources.workflows` schema member and its `clonePluginRecord` enumeration
- `extensions/pi-claude-marketplace/persistence/migrate.ts` — the four-member default-fill list
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — `workflowsPrep` / `stagedWorkflowNames` on `InstallCtx`, the `workflowsPhase` slot, the `statePhase` record axis
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` — the `resourcesFromHandles` axis, empty until plan 112-03
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` — `WorkflowsUnstageFailureError`
- `extensions/pi-claude-marketplace/shared/errors.ts`, `orchestrators/types.ts`, `orchestrators/plugin/update.ts` — the three mirrored closed sets
- `.fallowrc.json` — the `orchestrators` -> `bridges-workflows` allow-list edge
- `tests/orchestrators/plugin/install.test.ts` — the seeder's `workflows` arm plus 12 new cases
- `tests/transaction/phase-ledger.test.ts` — the phase universe and its forward-failure / compensation sequences
- 37 further test files — one-line `workflows: []` additions to plugin-install-record literals, driven by the typecheck worklist

## Decisions Made

**Typecheck error count.** Immediately after the schema edit the worklist stood at **67** errors across 30 files, two of them production (`install.ts`, `reinstall.ts`). The plan predicted "around 68 ... three of them production"; the third production error the research measured was inside `state-io.ts` itself and did not materialise, because the record literal there is validated rather than constructed. After the worklist was closed the count was **0**, and it has stayed 0 at every commit boundary since.

**Copy semantics for `WorkflowsUnstageFailureError`.** Frozen defensive copy — `Object.freeze([...failedWorkflows])` — following `WorkflowNameCollisionError` rather than the no-copy `AgentsUnstageFailureError` sitting next to it. The reason is that the payload names EXECUTABLE files left on disk and the error crosses the ledger boundary into a renderer that reads it long after the bridge returned, so a frozen copy is the only way the field is provably the same list at read time as at throw time. The reason is stated in a comment on the class and asserted by its owner test, which mutates the caller's array after construction and reads the field back.

**The complexity extraction was needed — twice, and not where the plan expected.** `runInstallLedgerBody` absorbed the sixth phase without breaching either ceiling; the ledger body was never the problem. What did breach was two TEST helpers, both because they enumerate the record's resource axes and the record grew an axis:

- `seedMarketplace` in `tests/orchestrators/plugin/list.test.ts` hit cognitive 16 / cyclomatic 22. Its per-plugin inventory composition was extracted into a module-private `seededResources(name, info)`.
- `writePluginComponents` in `tests/orchestrators/plugin/install.test.ts` hit cognitive 17 after gaining a sixth write loop. The workflows loop was extracted into `writeWorkflowScripts`.

Neither extraction added a threshold override; `.fallowrc.json` still carries none.

**The split reading of WLIF-02.** The requirement text for this ID describes update-path *behavior* (an update that re-stages workflows); the roadmap criterion for it describes only the *widening* of the closed sets. They are deliberately split. This plan lands the widening alone: `update.ts` gains the tuple member and no behavior, because it cannot yet produce a workflows failure. Landing it now is what lets the update re-stage arrive in a later plan without a second type commit. WLIF-02 is therefore recorded complete against the widening criterion, not against the behavior sentence.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] `SeededResources` in the shared edge fixture needed the axis**

- **Found during:** Task 1 Commit A
- **Issue:** `tests/edge/handlers/marketplace-seed.ts` declares its own five-axis `SeededResources` interface and builds records through `Record<string, unknown>`, so the typecheck worklist did not name it. 152 tests failed at runtime with `saveState refused: ... must have required properties workflows`.
- **Fix:** Added `workflows: string[]` to the interface as a required member, then closed the six call sites the compiler then reported. Making it required rather than optional keeps the fixture compile-forced for the same reason the production schema is.
- **Files modified:** `tests/edge/handlers/marketplace-seed.ts` and six caller suites
- **Verification:** `npm test` green at 5386 tests
- **Committed in:** `a025d5b4`

**2. [Rule 1 - Bug] Two read-count pins broke on the sixth phase's record lookup**

- **Found during:** Task 1 Commit B
- **Issue:** `runInstallLedger unwinds the completed phases when a plugin appears at state commit` and its marketplace sibling count proxy reads and pin the count. The workflows phase's `previousWorkflowNames` lookup adds one read to each, so the raced record became visible to the workflows phase instead of to `statePhase` — the test would still pass on the count bump but would no longer be testing a state-commit race.
- **Fix:** Moved the reveal thresholds one read later (2 -> 3 and 4 -> 5) so the sabotage still lands on the state commit, and said so in a comment at each proxy.
- **Files modified:** `tests/orchestrators/plugin/install.test.ts`
- **Verification:** both cases green; the failure they drive is still `ConcurrentInstallError` from `statePhase`
- **Committed in:** `d02db74b`

**3. [Rule 1 - Bug] The integration test asserted the install materialized nothing**

- **Found during:** Task 1 Commit B
- **Issue:** `tests/integration/workflow-kind-inversion.test.ts` asserted `stat(<home>/.pi/workflows)` rejects with ENOENT, with a comment reading "When WLIF-01 wires the install, this becomes the assertion that the install writes exactly the envelopes it recorded." Wiring the install made that rejection stop happening.
- **Fix:** Replaced the absence assertion and the two stand-in bridge calls below it with the install-driven assertions the comment described: the storage root exists, the envelope parses to the pinned three-key object, and the record names it.
- **Files modified:** `tests/integration/workflow-kind-inversion.test.ts`
- **Verification:** `npm run test:integration` green at 32 tests
- **Committed in:** `d02db74b`

**4. [Rule 3 - Blocking] The ledger suite's phase sequences are hand-written, not derived**

- **Found during:** Task 2
- **Issue:** Adding `workflows` to `PRODUCTION_PHASE_NAMES` broke three cases whose expected `do:` / `undo:` sequences are written out literally rather than derived from the tuple.
- **Fix:** Updated the three sequences and added a `compensates a workflows failure own-first and newest-first` case beside the five that already exist, so the new phase is covered by the same forward-failure table as its siblings.
- **Files modified:** `tests/transaction/phase-ledger.test.ts`
- **Verification:** suite green at 18 tests
- **Committed in:** `6d01ed99`

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bugs)
**Impact on plan:** All four are consequences of widening a closed set that several fixtures mirror by hand — the exact hazard the plan's own "three mirrored closed sets" framing names. No scope creep; nothing outside the plan's declared file set was touched except `tests/edge/handlers/marketplace-seed.ts` and its six callers, which the typecheck worklist could not reach.

## Issues Encountered

**Two acceptance-criteria grep counts do not match, and the criteria are the things that are wrong.**

- `grep -c 'workflowsPhase' extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` prints **2**, not "at least 3". The criterion budgeted for "the declaration, the array slot, and at least one reference"; there is no third reference in the shipped code, and the phase-array comment lists the phases by bare kind name (`[skills, commands, agents, hooks, mcp, workflows, state]`) exactly as it did before. Padding the file with a third mention of the identifier to satisfy a grep would have been the only way to hit 3.
- `grep -c 'bridges-workflows' .fallowrc.json` prints **4**, not `2`. The criterion assumed one pre-existing occurrence; there are three (the zone declaration, the zone's own outbound rule, and a third rule at line 178). `git diff` on the commit shows exactly one insertion, which is what the criterion was actually checking for.

Both were verified against the underlying intent instead: the allow-list edge is load-bearing (removing the string makes `fallow dead-code` exit 1 naming both new import edges by file and line, and restoring it returns exit 0), and it rode `d02db74b`, the commit that first imports the bridge.

**The unlink mock needed `syncBuiltinESMExports()`.** `bridges/workflows/unstage.ts` binds `unlink` through a static ESM import, so `t.mock.method` on the CJS view of `node:fs/promises` is invisible until the ESM namespace is re-synced. The file already imports the helper for other cases; the new ones call it after installing the mock and again after restoring.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `resources.workflows` exists and is populated, so plans 112-02 and 112-03 have the recorded inventory every removal path reads.
- `reinstall.ts`'s `resourcesFromHandles` composes `workflows: []` with a comment naming 112-03 as the plan that replaces it. Same for nothing in `update.ts` — the closed sets are widened but no behavior was added, by design.
- The staging directory is cleaned by the commit on the success path and by the undo's staging removal on failure; the age-bounded sweep for orphaned staging trees remains 112-04's work.
- One known interaction for later plans: the sixth phase reads `stateSnapshot.marketplaces[mp].plugins[plugin]` once per install. Any test that counts reads on a proxied state must budget for it.

## Self-Check: PASSED

- All 14 modified production and test files verified present on disk.
- All four commit hashes verified in `git log`.
- `npm run check` exits 0 (typecheck, lint, fallow, format:check, 5400 unit tests, 32 integration tests, all passing).
- `node scripts/test-coverage-direct.mjs` reports `hit === found` on branches, functions and lines for `install.ts` (252/252, 55/55, 2549/2549), `state-io.ts`, `migrate.ts`, `marketplace/shared.ts` (99/99, 18/18, 784/784), `shared/errors.ts` and `update.ts`; `orchestrators/types.ts` is type-only.
- `git merge-base --is-ancestor features/workflows-spike HEAD` exits 1 — no spike commit entered the branch.
- `grep -rnE '^export (const|function|async function) __test_' extensions/` prints 0.
- `npm run test:corresponding` and `npm run test:corresponding:negative` both exit 0.

---
*Phase: 112-install-and-removal-lifecycle*
*Completed: 2026-09-05*

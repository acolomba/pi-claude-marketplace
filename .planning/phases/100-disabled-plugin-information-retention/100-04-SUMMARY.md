---
phase: 100-disabled-plugin-information-retention
plan: 04
subsystem: output-surface
tags: [typescript, notify, info-orchestrator, discriminator, fetch-skip, requirements]

requires:
  - phase: 100-disabled-plugin-information-retention
    plan: "01"
    provides: "retention of the record's resources inventory on disable -- the population the rerouted arm renders"
  - phase: 100-disabled-plugin-information-retention
    plan: "02"
    provides: "`hookEntries` and the record-wins read ladder in `composeStateOnlyComponents`, which the reroute reaches with no further change"
  - phase: 100-disabled-plugin-information-retention
    plan: "03"
    provides: "the `list` half of ENBL-16 and the finding that each command surface owns its own render map"
  - phase: 96-installation-record-backed-plugin-info
    provides: "`buildStateOnlyInstalledRow`, `InfoBlock` and the D-96-04 fetch-skip note the carrier replaces"
provides:
  - "`disabled` in the info row's per-surface status subset, plus its glyph arm reusing the existing constant"
  - "`InfoBlock.skipReason` -- one optional producer-reported reason replacing the `stateOnly` boolean"
  - "`applyDisabledStatus` / `skipReasonFor` -- the disabled-status injection and the skip-reason disposition, both reading the shared predicate"
  - "a single-list fetch-skip emitter: one scope emits at most one skip row"
  - "ENBL-16 and ENBL-17 recorded complete in the requirement register"
affects: [output-catalog-disabled-info-state]

actuals:
  tokens: 21000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "collapse a two-list concatenation into one optional field so a double-cause row is unrepresentable rather than test-forbidden"
    - "status injection at the block-builder call sites rather than inside the derivation, so the derivation keeps answering its own question"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/info-manifest-absent.test.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The disabled status is injected at the two `buildBlock` call sites that can see an installation record, through one named helper reading `isRecordedButDisabled`, rather than at each of the seven row-builder return sites. One site per arm cannot drift from the predicate; seven could."
  - "`partitionDisabledScopes` was DELETED, not kept as a collapsed helper. With every found scope going to the block builder the function reduces to the identity, so there is no logic left to inline and no complexity to protect -- `getPluginInfo` lost four branches on net."
  - "`info.messaging.ts`'s `disabled` render arm was deleted too. The reroute makes it unreachable, and leaving it would be a divergent second copy of a surface nothing renders -- the exact shape that hid a silent failure one plan earlier."
  - "The seeder ternary that emptied `resources` on `disabled` was dropped in `info-manifest-absent.test.ts`. Without it the rerouted arm renders no component line and the byte assertions could not tell a working reroute from an inert one."

patterns-established:
  - "A skip note carried as an optional reason on the producer's own block: two causes for one scope resolve by precedence at the producer instead of by de-duplicating rendered rows."

requirements-completed: [ENBL-16, ENBL-17]

coverage:
  - id: R1
    description: "A manifest-absent disabled record renders `(disabled) {not in manifest}` with its retained component inventory"
    requirement: ENBL-17
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-100-08 / ENBL-17: a manifest-absent DISABLED record renders `(disabled) {not in manifest}` with its retained inventory"
        status: pass
    human_judgment: false
  - id: R2
    description: "A manifest-DECLARED disabled record reports its manifest description and resolved components, still as `(disabled)`"
    requirement: ENBL-17
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-100-08 / ENBL-17: info on a recorded-but-disabled plugin reports its description and components, still as `(disabled)`"
        status: pass
    human_judgment: false
  - id: R3
    description: "The disabled status is injected ahead of the persisted derivation, so a disabled PARTIAL never renders `(partially-installed)`"
    requirement: ENBL-17
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-100-08 / ENBL-17: a manifest-absent DISABLED PARTIAL keeps `(disabled)`, not the derived `(partially-installed)`"
        status: pass
      - kind: other
        ref: "mutation-checked: dropping the `applyDisabledStatus` call on the state-only arm renders `(partially-installed)` and fails exactly this test"
        status: pass
    human_judgment: false
  - id: R4
    description: "The fetch-skip note survives the reroute, and a scope with BOTH causes emits exactly one row reporting the disabled cause"
    requirement: ENBL-17
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-96-04 / ENBL-17: `info --fetch` on a disabled AND manifest-absent scope emits ONE skip row, reporting the disabled cause"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#ENBL-06 / D-96-04: `info --fetch` on a DISABLED PARTIAL skips for the disabled cause, not the manifest-absence cause"
        status: pass
    human_judgment: false
  - id: R5
    description: "The mixed disabled + state-only run renders ONE info cascade and ONE skip notification, project-first"
    requirement: ENBL-17
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-96-04: a mixed disabled + state-only `--fetch` run orders both skip rows project-first"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#D-100-08 / ENBL-17: bare info (no --scope) with a disabled record in one scope renders ONE cascade with both scopes"
        status: pass
    human_judgment: false
  - id: R6
    description: "The rerouted disabled arm reaches no network under `--fetch` and writes nothing"
    requirement: ENBL-17
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts INFO-12 / NFR-5 zero clone-seam and credential-seam counters (all cases green, unedited)"
        status: pass
    human_judgment: false
  - id: R7
    description: "No status token, reason token or glyph was added; both enumeration gates pass unamended"
    requirement: ENBL-17
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts and tests/architecture/compat-01-no-expansion.test.ts -- 18 pass, neither file edited"
        status: pass
    human_judgment: false
  - id: R8
    description: "The `info` half of the manifest-absence reason on a disabled row"
    requirement: ENBL-16
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-100-08 / ENBL-17: a manifest-absent DISABLED record renders `(disabled) {not in manifest}` with its retained inventory"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-08-11
status: complete
---

# Phase 100 Plan 04: The disabled info row stops being a foreign shape Summary

**`info` on a disabled plugin now reports its description and component inventory through the same block builder every other installed record uses, while an injected disabled status keeps the row saying `(disabled)`, and one producer-reported field decides the fetch-skip note.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-11T13:25:00Z
- **Completed:** 2026-08-11T14:20:00Z
- **Tasks:** 2 of 2
- **Files modified:** 6

## Accomplishments

- The information a disabled plugin used to lose is back. A disabled record its manifest still declares renders its manifest description and resolved components; one the manifest dropped renders the inventory the disable retained. Both keep `(disabled)`.
- The status cannot be got wrong by omission. `applyDisabledStatus` sits at the two `buildBlock` arms that can see an installation record and reads `isRecordedButDisabled`, so the persisted derivation keeps answering only its own question (did the install drop components) and a disabled record never claims to be installed.
- The double-cause skip row is now unrepresentable rather than merely untested. `InfoBlock.stateOnly` became `skipReason?: ContentReason`; the emitter maps one list. A scope that is both disabled and manifest-absent emits ONE row naming the disabled cause, while the inventory row above it keeps `{not in manifest}` per D-100-07.
- The mixed-message-kind problem dissolved rather than being worked around. A disabled scope is no longer a foreign message kind, so the second notify for mixed results, the all-disabled early return, the `disabledBlocks` conjunct and the comment explaining the incompatibility all went with the divert. The mixed run drops from three notifications to two.
- No closed set grew. `disabled` was already a member of the plugin-status tuple and `ICON_DISABLED` already existed, so the widening is per-surface and both enumeration gates passed with no edit to either file.

## Task Commits

1. **Task 1: Widen the info row's status subset and add its glyph arm** - `a3ca97d3` (feat)
2. **Task 2: Route the disabled arm through the shared block builder and carry the skip note on one field** - `b29f1961` (feat)
3. **Follow-through on Task 2's deletion: the now-unreachable cascade arm** - `e678bfae` (refactor)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` - `PluginInfoRowBase.status` gains `"disabled"` with the rationale comment EXTENDED (the omitted list-inventory-only status sentence is intact); `pluginInfoStatusGlyph` gains its arm returning the pre-existing `ICON_DISABLED`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - `InfoBlock.skipReason` replaces `stateOnly` with the disposition rule documented on the interface; `wrapBlock` takes the optional reason; `applyDisabledStatus` and `skipReasonFor` added beside it; both record-bearing arms of `buildBlock` route through them; `emitFetchSkip` maps one list and lost its `disabled` parameter; `buildDisabledInventoryBlock`, `DisabledScope` and `partitionDisabledScopes` deleted along with the four disabled-specific branches in `getPluginInfo`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts` - the `disabled` render arm, its status-set member and its message-union member removed; the surface-boundary doc rewritten to say why.
- `tests/orchestrators/plugin/info.test.ts` - the two ENBL-04 disabled tests retitled to ENBL-17 and re-pinned: the declared-disabled row's new bytes, and the mixed run's single cascade.
- `tests/orchestrators/plugin/info-manifest-absent.test.ts` - the seeder's disabled-empties-resources ternary dropped and its JSDoc corrected; five disabled fixtures re-pinned; a one-skip-row count assertion added to the double-cause case.
- `.planning/REQUIREMENTS.md` - ENBL-16 and ENBL-17 marked complete, with the ENBL-16 entry recording where each half landed and the one place the "no other reason" clause is surface-specific.

## Decisions Made

- **The injection point is the call site, not the derivation and not the row builders.** `derivePersistedInstalledStatus` answers "did this install drop components" and can return nothing but `installed` / `partially-installed`; teaching it about `enabled` would give it two questions. The seven row-builder return sites would each need the same guard. One helper per record-bearing arm of `buildBlock` is the smallest set of sites that covers every path, and it reads the shared predicate so the ENBL-05 drift gate stays green.
- **`partitionDisabledScopes` is deleted, not collapsed.** The plan asked for the partition to be kept as a helper to protect `getPluginInfo`'s complexity budget. With every found scope going to the block builder the function reduces to `{ disabled: [], infoFound: found }` -- no loop, no branch, nothing to inline. `getPluginInfo` lost four branches on net, so the budget moved the right way; lint confirms.
- **The disabled arm in `info.messaging.ts` had to go with it.** After the reroute nothing constructs a `PluginDisabledMessage` on this surface, so the arm was a second, divergent renderer for a row that renders elsewhere. One plan earlier, exactly that shape (a per-surface map nobody remembered to thread) made a green typecheck and two green gates coexist with wrong output. Deleting it is the compiler-enforced version of not repeating that.
- **The disabled `info` row keeps the persisted unsupported-kind tokens; the `list` row does not.** `buildStateOnlyInstalledRow` composes `{not in manifest, lsp}` for an enabled record and now does the same for a disabled one. The two surfaces answer different questions -- `list` is an inventory line, `info` is the detail view -- and suppressing a persisted fact on the detail view would be a deliberate omission with no requirement behind it. The ENBL-16 register entry records that the "no other reason" clause binds the list row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The seeder emptied `resources` on `disabled`, making the reroute unverifiable**

- **Found during:** Task 2
- **Issue:** `seedPathMarketplace` in `info-manifest-absent.test.ts` still zeroed every `resources.*` array whenever `disabled: true`, a marker ENBL-05 retired and 100-01 reversed. With it in place the rerouted disabled row renders no component line, so every byte assertion would pass identically whether the reroute worked or the arm returned an empty inventory -- the plan's own acceptance criterion (a disabled record reports its components) could not be observed.
- **Fix:** Dropped the ternary so `disabled` controls only `enabled`, exactly as the carrier note from 100-01 and 100-03 prescribed, and rewrote the option's JSDoc, which narrated emptiness as the disabled marker.
- **Files modified:** `tests/orchestrators/plugin/info-manifest-absent.test.ts`
- **Verification:** The re-pinned rows now carry `skills: alpha-skill`; restoring the ternary drops that line from four assertions.
- **Committed in:** `b29f1961`

**2. [Rule 1 - Bug] `info.messaging.ts`'s disabled arm became unreachable dead code**

- **Found during:** Task 2 (post-commit sweep for dangling references)
- **Issue:** The plan enumerates the producer side of the retired surface (`buildDisabledInventoryBlock`, `DisabledScope`) but not its renderer. Deleting the producer left `PLUGIN_INFO_RENDER.disabled` and `PluginDisabledMessage` in the cascade union with no caller -- a second definition of a row that now renders through the standalone envelope, and the precise trap that made a wrong `list` row look correct one plan earlier. TypeScript cannot flag it: the arm is a property of an exported const.
- **Fix:** Narrowed `PLUGIN_INFO_STATUSES` to `["skipped"]`, narrowed the message union, deleted the arm and its five now-unused imports (`noUnusedLocals` enforced the import pruning), and rewrote the file's surface-boundary comment, which asserted that info emits a disabled cascade row.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts`
- **Verification:** `npm run typecheck`, `npm run lint`, and 1853 tests across `tests/orchestrators/`, `tests/architecture/` and `tests/shared/` all green. No test pinned `PLUGIN_INFO_STATUSES`, and the only consumer is the skip emitter.
- **Committed in:** `e678bfae` (separate commit: it is a follow-through on the deletion, not part of the reroute)

**3. [Rule 3 - Blocking] `partitionDisabledScopes` could not be "kept as a collapsed helper"**

- **Found during:** Task 2
- **Issue:** The plan directs the executor to keep the partition as a helper to protect the cognitive-complexity budget. Once every found scope goes to `buildBlock` the helper has no branch and no loop; keeping it would mean shipping an identity function.
- **Fix:** Deleted it and used `found` directly. The complexity risk the instruction guards against does not arise -- the change removes four branches from `getPluginInfo` rather than adding any.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`
- **Verification:** `npm run lint` clean, including `sonarjs/cognitive-complexity` on `getPluginInfo`.
- **Committed in:** `b29f1961`

**4. [Rule 1 - Bug] Two comments named symbols this plan deleted**

- **Found during:** Task 2
- **Issue:** `buildFetchSkipBlock`'s doc described its shape by reference to `buildDisabledInventoryBlock`, and an `info-manifest-absent.test.ts` comment explained the skip keying in terms of `stateOnly: false`. Both name symbols that no longer exist.
- **Fix:** Rewrote both to describe the surviving mechanism (the list-arm cascade shape, and an absent `skipReason`).
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`, `tests/orchestrators/plugin/info-manifest-absent.test.ts`
- **Verification:** `grep` for the retired identifiers over `extensions/` and `tests/` returns nothing.
- **Committed in:** `b29f1961`

---

**Total deviations:** 4 auto-fixed (2 x Rule 1, 2 x Rule 3)
**Impact on plan:** No scope creep. Deviation 1 is what makes the plan's own acceptance criterion observable; 2 and 4 complete a deletion the plan mandates; 3 is a plan instruction that the collapse itself makes moot.

## Issues Encountered

- **The rerouted row's marketplace header changes too.** The list-arm cascade renders `● mp [user]`; the standalone info envelope renders `● mp [user] <no autoupdate>`. Every re-pinned fixture moved on that line as well as on the row -- worth knowing before reading the diff as larger than it is.
- **The mixed-scope run drops a notification.** Three became two, because both scopes now ride one cascade. That is the deletion working, but it is a user-visible change in notification COUNT, not only in bytes.

## Verification

- `npm run typecheck` -- exit 0
- `npm run lint` -- exit 0
- `npm run format:check` -- exit 0
- `npm test` -- 3433 tests, 3432 pass, 0 fail, 1 skipped
- `node --test tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/info-manifest-absent.test.ts tests/architecture/catalog-uat.test.ts tests/orchestrators/reconcile/plan.test.ts` -- 145 pass, 0 fail
- `node --test 'tests/orchestrators/**/*.test.ts' 'tests/architecture/**/*.test.ts' 'tests/shared/**/*.test.ts'` -- 1853 tests, 0 fail
- `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts` -- 18 pass, neither file edited (14 of the passing clauses are COMPAT-01's)
- The two fetch-skip catalog fixtures pass with no byte change: `catalog-uat` is green and `docs/output-catalog.md` is untouched by this plan.
- `grep -c 'skipReason' extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` -- 12 (criterion: >= 4)
- `pre-commit run --files <each changed path>` -- all hooks pass except the structurally-broken worktree `trufflehog`; a filesystem scan of every committed path reported 0 verified and 0 unverified secrets

## Threat Model Disposition

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-100-12 (Spoofing: a disabled record rendering as installed) | mitigated | `applyDisabledStatus` runs at both record-bearing arms and reads `isRecordedButDisabled`, not a twin spelling; the ENBL-05 drift gate and `tests/orchestrators/reconcile/plan.test.ts` are green. Mutation-checked on the state-only arm: without the call the disabled PARTIAL renders `(partially-installed)`. |
| T-100-13 (Information disclosure: `--fetch` on a rerouted disabled scope) | mitigated | The manifest-absent arm is network-free by signature (no `fetchCtx` parameter, no probe construction) and the INFO-12 zero-call counters on the injected clone-cache and credential seams stay pinned at 0 across every case, unedited. |
| T-100-14 (Repudiation: the fetch-skip note lost in the reroute) | mitigated | The note is carried by `InfoBlock.skipReason`, reported by the producer, never re-derived from the rendered row. Both existing `--fetch` fixtures pass with their `{already disabled}` bytes intact, and the double-cause case additionally asserts exactly one `(skipped)` row. |
| T-100-02 (Spoofing: retained inventory read as live) | mitigated | The status token holds its position at the head of the row; the description and component lines render below it, in the same slots an installed row uses. Pinned byte-exactly in both suites. |
| T-100-SC (Supply chain) | accepted | No package installed, no `package.json` entry added. |

## Known Stubs

None.

## Carriers into the rest of the phase

- **`docs/output-catalog.md` is now out of date on two counts, both scheduled for the following plan.** `:1688`'s info-surface disabled paragraph still says the info row renders through the list-arm cascade and defers its bytes to the list section's `disabled-inventory` state -- that cross-reference is what this reroute retires, and the new row needs its own catalog state and byte fixture landing in one commit. Separately, the `mixed-fetch-skipped` state's prose assumes the two skip causes are scope-disjoint; a scope can now hold both, and the producer picks.
- **The `list` and `info` disabled rows now differ in their reason braces.** `list` stamps absence alone; `info` carries absence plus any persisted unsupported-kind tokens. Deliberate (see Decisions), but any future "the two surfaces agree" claim needs to say which part.
- **Three seeders still hard-code empty resources on their `disabled` branch** -- `seedRealDisabledMarketplace` (`enable-disable.test.ts`), the private seeder in `list-manifest-absent.test.ts`, and `seedPathMarketplace` in `info.test.ts`. The last one is harmless today (its disabled records are manifest-declared, so components come from disk), but all three still narrate emptiness as the disabled marker in their JSDoc.

## Self-Check: PASSED

All 6 modified files exist on disk; all three task commits (`a3ca97d3`, `b29f1961`, `e678bfae`) resolve in `git log`.

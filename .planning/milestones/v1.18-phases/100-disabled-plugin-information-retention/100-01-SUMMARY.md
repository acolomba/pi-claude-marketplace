---
phase: 100-disabled-plugin-information-retention
plan: 01
subsystem: persistence
tags: [typescript, typebox, state-json, disabled-records, hooks-bridge, install-ledger]

requires:
  - phase: 97-disabled-state-classification-repair
    provides: "`isRecordedButDisabled` as the sole disabled-state predicate, plus the whole-tree drift gate that rejects re-derived twins"
  - phase: 96-installation-record-backed-plugin-info
    provides: "the record-backed component inventory `info` reads, which is what makes retaining the inventory worth anything"
provides:
  - "disable preserves the installation record's five `resources.*` arrays exactly; only `enabled` and `updatedAt` change"
  - "`toDisabledRecord` generic in its resources shape, so a producer that changes the inventory is a compile error"
  - "an explicit `isRecordedButDisabled` guard in `hydrateScopeFromState`, replacing incidental file-absence as the hook-routing protection"
  - "a self-conflict exclusion on the install ledger's cross-plugin guard, so `plugin enable` survives retention"
  - "one `removePluginRecord` implementation in the tree, exported from `orchestrators/plugin/shared.ts`"
affects: [disabled-plugin-info-render, hook-entries-record-key, list-and-info-reason-stamping]

actuals:
  tokens: 175000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "generic passthrough of a sub-shape of the input as the producer-side compile-time invariant"
    - "mutation-checked test authoring: every new guard test verified red against a mutated tree before landing"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - tests/persistence/state-io.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/shared.test.ts
    - tests/bridges/hooks/event-router.test.ts
    - tests/orchestrators/reconcile/plan.test.ts

key-decisions:
  - "The plan's two state-io.test.ts edits split across Task 1 and Task 2 rather than landing wholly in Task 2: the retired `@ts-expect-error` becomes an unused-directive typecheck error the moment the generic lands, so Task 1 could not have been green without touching that file."
  - "The resolvedSha preservation test was anchored as the optional-key template rather than duplicated. A byte-shaped copy would have been a `sonarjs/no-identical-functions` candidate and would have proved nothing the original does not."
  - "ENBL-19 needed an end-to-end round-trip test, not a fixture edit. Every hand-seeded disabled record in the suite carries empty arrays, so no existing enable canary could reach the self-conflict; the hazard appears only on the second enable of an enable/disable/enable cycle."

patterns-established:
  - "Producer-side generic invariant: `toDisabledRecord<R>` returns `resources: R`, so the transform cannot express a changed inventory. First instance of a function generic in a sub-shape of its input in this tree."
  - "Guard-discrimination proof: each new guard test was run against a mutated tree (guard removed) and observed red before the tree was restored, so a passing test is evidence the guard is load-bearing rather than evidence the fixture is inert."

requirements-completed: [ENBL-13, ENBL-14, ENBL-18, ENBL-19]

coverage:
  - id: D1
    description: "Disabling a plugin preserves all five `resources.*` arrays deep-equal to the pre-disable record, element order included"
    requirement: ENBL-18
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#ENBL-02 / ENBL-18: disable preserves the version pin and the record's resource inventory"
        status: pass
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#ENBL-18 / D-100-10: toDisabledRecord preserves every resources array, sets enabled:false, preserves identity + restamps updatedAt"
        status: pass
    human_judgment: false
  - id: D2
    description: "Changing the inventory inside the disable transform is a compile error at the producer"
    requirement: ENBL-18
    verification:
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#ENBL-18 / D-100-10: toDisabledRecord's resources shape flows through the generic, and narrowing it is a compile error"
        status: pass
      - kind: other
        ref: "npm run typecheck (the @ts-expect-error is gated by tsc; verified to become an unused-directive error when the negative case is neutralized)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Disable still removes every artifact of all five kinds, hooks.json included; only the record's description is retained"
    requirement: ENBL-13
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#ENBL-13 / ENBL-18: disable of a hooks-only plugin removes hooks.json but retains resources.hooks"
        status: pass
    human_judgment: false
  - id: D4
    description: "A disabled plugin's hooks are not hydrated on reload, even when its hooks.json is present on disk"
    requirement: ENBL-14
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/event-router.test.ts#ENBL-14 / D-100-05: a disabled record's hooks are NOT hydrated, even though its hooks.json is on disk"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/event-router.test.ts#ENBL-14 control: the SAME fixture with enabled: true hydrates exactly one cache entry"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#ENBL-05: no disabled-state twin survives ANYWHERE in the extension tree (drift gate covers the new guard's spelling)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Enabling a disabled plugin that owns a skill succeeds; a genuine cross-plugin conflict is still rejected"
    requirement: ENBL-19
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#ENBL-19: an enable/disable/enable round trip succeeds -- the retained inventory does not self-conflict"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/shared.test.ts#ENBL-19: a genuine cross-plugin collision is still rejected after the plugin's own record is excluded"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/shared.test.ts#ENBL-19: enabling a disabled plugin against only its own retained record does not throw"
        status: pass
    human_judgment: false

duration: 47min
completed: 2026-08-11
status: complete
---

# Phase 100 Plan 01: Retention Spine Summary

**Disable now keeps the installation record's inventory and drops only the artifacts, with the two guards retention would otherwise have broken -- hook-routing suppression and the enable-path self-conflict exclusion -- landing in the same change.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-08-11T14:22:00Z
- **Completed:** 2026-08-11T15:09:00Z
- **Tasks:** 3 of 3
- **Files modified:** 12

## Accomplishments

- `toDisabledRecord` stopped zeroing the five `resources.*` arrays. The installation record is now a self-sufficient description of what was installed rather than a pointer into artifacts that have to be inspected, which is what lets a later plan report a disabled plugin's contents after its marketplace manifest drops the entry.
- The type invariant was re-pointed rather than dropped. `toDisabledRecord<R>` returns `resources: R`, so "disable changed the inventory" is a compile error at the producer -- the same enforcement strength the retired empty-tuple brand carried, aimed at the guarantee this phase actually makes.
- `hydrateScopeFromState` gained an explicit `isRecordedButDisabled` guard. The protection was previously incidental: disable deleted `hooks.json`, so the hydrate read failed and only logged. With the record still naming the slug, a file restored by any means would have re-registered a disabled plugin's hooks on the next `/reload`.
- The install ledger's cross-plugin conflict guard now excludes the plugin's own record, as `update` and `reinstall` already did. Without it, retention would have made every enable of a plugin owning at least one skill, command or agent fail with `CrossPluginConflictError` against itself.
- `removePluginRecord` exists once in the tree. Two byte-identical private copies in `update.ts` and `reinstall.ts` were replaced by one export from `orchestrators/plugin/shared.ts`, which is what made a third call site possible at all under `sonarjs/no-identical-functions`.

## Task Commits

1. **Task 1: End-to-end retention (tracer, TDD)** - `b5eb0f7a` (feat)
2. **Task 2: Re-point the compile-time brand tests** - `e3b28297` (test)
3. **Task 3: Dedicated coverage for both guards** - `b7d1ce9e` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/persistence/state-io.ts` - `toDisabledRecord` is generic in its resources shape; `DisabledPluginRecord<R>` re-pointed at the new invariant; the block comment rewritten from "disable zeroes the arrays" to "disable changes `enabled` and `updatedAt` and nothing else".
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` - the ENBL-14 guard inside the per-plugin hydrate loop, plus the `isRecordedButDisabled` import.
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` - `removePluginRecord` hoisted here as a named export beside `assertNoCrossPluginConflicts`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - the conflict-guard state argument wrapped in `removePluginRecord`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` / `reinstall.ts` - private copies deleted, shared export imported.
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` - comment debt only; the D-63-04 zeroing rationale replaced by the removal-without-forgetting rule. No code change.
- `tests/persistence/state-io.test.ts` - preservation assertions, the producer-side compile proof, the optional-key template anchor.
- `tests/orchestrators/plugin/enable-disable.test.ts` - two inverted assertion sites, a real `hooks.json` seeded so the ENBL-13 removal is a real removal, and the new ENBL-19 round trip.
- `tests/bridges/hooks/event-router.test.ts` - the ENBL-14 suppression test and its enabled control, the file's first tests to write a real `state.json`.
- `tests/orchestrators/plugin/shared.test.ts` - the ENBL-19 negative control and its positive sibling.
- `tests/orchestrators/reconcile/plan.test.ts` - one truth-table cell proving the predicate's array-independence against the populated disabled shape.

## Decisions Made

- **The retired `@ts-expect-error` forced a Task 1 / Task 2 split of one file.** The directive asserting a populated resources tuple is illegal becomes an unused-directive typecheck error the instant the generic lands, so Task 1 could not satisfy its own `npm run typecheck` acceptance criterion without touching `tests/persistence/state-io.test.ts`. Task 1 made that file compile and pass; Task 2 supplied the replacement proof.
- **The resolvedSha preservation test was anchored, not duplicated.** The plan asked for a preservation test using `D-77-02 toDisabledRecord preserves resolvedSha` as the literal template; that test already exists and already asserts exactly this. A copy of it would have been a `sonarjs/no-identical-functions` candidate. It was retitled and given a header naming it as the template a future optional record key copies.
- **ENBL-19's proof is a round trip, not a fixture edit.** Every hand-seeded disabled record in the enable-disable suite carries empty arrays, including `seedRealDisabledMarketplace`. Verified by mutation: removing the `install.ts` exclusion left all 39 existing tests green. The hazard is only reachable through a record a real disable produced, so the new test enables, disables, asserts the inventory survived, then enables again.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The retired brand directive blocked Task 1's typecheck**

- **Found during:** Task 1
- **Issue:** `tests/persistence/state-io.test.ts:696`'s `@ts-expect-error` asserted that a populated resources tuple is illegal on a disabled record. Once `DisabledPluginRecord` stopped pinning empty tuples, that directive suppressed nothing and `tsc` reported TS2578. The sibling ENBL-02 test also asserted the zeroing at runtime. Task 1's acceptance criteria require `npm run typecheck` to exit 0, and leaving a red suite between two commits is not acceptable either.
- **Fix:** Task 1 removed the dead directive and inverted the runtime assertion (the minimum for a green tree). Task 2 then supplied the producer-side replacement proof and the titles, as planned.
- **Files modified:** `tests/persistence/state-io.test.ts`
- **Verification:** `npm run typecheck` and `node --test tests/persistence/state-io.test.ts` green at both commits.
- **Committed in:** `b5eb0f7a` and `e3b28297`

**2. [Rule 2 - Missing coverage] ENBL-19 had no discriminating test**

- **Found during:** Task 3
- **Issue:** The plan treated the two existing enable canaries as the ENBL-19 proof. They are not: `seedRealDisabledMarketplace` hard-codes `resources: { skills: [], ... }`, the retired shape. A mutation check (exclusion removed from `install.ts`) left the whole 39-test enable-disable suite green, so the exclusion was shipping unproven end-to-end. The `shared.test.ts` unit tests the plan specifies cover the helper's semantics but not the ledger's wiring.
- **Fix:** Added an enable/disable/enable round-trip test. The first enable materializes the skill and records its real generated name; the disable retains it; the second enable is the first one that can self-conflict.
- **Files modified:** `tests/orchestrators/plugin/enable-disable.test.ts`
- **Verification:** Mutation-checked -- with the `install.ts` exclusion removed the new test fails and the other 39 still pass; with it restored all 40 pass.
- **Committed in:** `b7d1ce9e`

**3. [Rule 2 - Missing coverage] ENBL-13's disk-side half was asserted against nothing**

- **Found during:** Task 1
- **Issue:** The plan said the disk-side assertions in the two inverted tests "STAY unchanged". There were none -- `writeUserState` never materializes artifacts, so `removeHookConfig` ran ENOENT-tolerantly and the claim "hooks.json is still deleted from disk" was untested.
- **Fix:** The hooks-only test now writes a real `hooks.json` under `<extensionRoot>/hooks/foo/` before the disable and asserts it is gone afterward.
- **Files modified:** `tests/orchestrators/plugin/enable-disable.test.ts`
- **Verification:** `node --test tests/orchestrators/plugin/enable-disable.test.ts` green.
- **Committed in:** `b5eb0f7a`

---

**Total deviations:** 3 auto-fixed (1 x Rule 3, 2 x Rule 2)
**Impact on plan:** No scope creep. Deviation 1 is bookkeeping forced by the plan's own task ordering. Deviations 2 and 3 close gaps between what the plan's `must_haves` claim and what its tests actually prove.

## Issues Encountered

- **A prose comment became a live directive.** A line reading `// @ts-expect-error below stops erroring and typecheck fails.` was parsed by `tsc` as an actual expect-error directive (TypeScript matches the token at the start of any comment line), producing a TS2578 on the comment itself and masking the real question. Reworded to "expect-error directive below".
- **`sonarjs`/`consistent-type-definitions` rejected the local type aliases** in the new compile-time proof; converted to `interface` declarations, then re-ran the mutation check to confirm the assignability result was unchanged.
- **Two integration tests fail locally and are not a regression.** `tests/integration/skill-path-resolution.test.ts` resolves `pi-subagents` from the global npm root; both failures reproduce identically on the unmodified `main` checkout. Environment, not this branch.

## Verification

- `npm run typecheck` -- exit 0
- `npm run lint` -- exit 0
- `npm run format:check` -- exit 0
- `npm test` -- 3423 pass, 0 fail
- `npm run test:integration` -- 16 pass, 2 fail (the known global-peer artifact above)
- Acceptance greps: `isRecordedButDisabled` appears twice in `event-router.ts`; one `export function removePluginRecord` in `shared.ts`; `removePluginRecord` appears twice in `install.ts`; seven `removePluginRecord` occurrences tree-wide across the definition and three call sites.

## Threat Model Disposition

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-100-03 (EoP: disabled plugin's hooks hydrate) | mitigated | The guard is the first statement of the per-plugin hydrate loop; the ENBL-14 test writes a real `hooks.json` so file-presence cannot mask it, and the guard was mutation-checked. |
| T-100-01 (Tampering: traversal slug at the hooks read site) | unchanged | The `assertPathInside` chokepoint in `tryHydrateOnePlugin` is untouched; the new guard sits ahead of it and removes no containment check. |
| T-100-06 (Tampering: `removePluginRecord` mutating the caller's state) | mitigated | Body hoisted verbatim; the non-mutating contract is now asserted directly in `tests/orchestrators/plugin/shared.test.ts`, and the existing update/reinstall suites are the regression proof. |
| T-100-07 (Spoofing: exclusion weakens the guard to a no-op) | mitigated | `tests/orchestrators/plugin/shared.test.ts` asserts a genuine cross-plugin collision still raises `CrossPluginConflictError` after the exclusion. Name comparison is untouched -- exact string identity, no case folding, no normalization. |
| T-100-SC (Supply chain) | accepted | No package was installed and no `package.json` entry added. |

## Known Stubs

None.

## Carriers into the rest of the phase

- `seedRealDisabledMarketplace` (`tests/orchestrators/plugin/enable-disable.test.ts:~300`) and `seedPathMarketplace` (`tests/orchestrators/plugin/info-manifest-absent.test.ts`) both still hard-code `resources: { skills: [], ... }` on their `disabled` branch. That is now a fixture choice rather than the invariant, and it is what will block any later plan that needs a disabled-plus-populated record through those seeders. The minimal edit is to drop the ternary so `disabled` controls only `enabled`.
- The `enable-disable.ts:598` map-slot comment still calls the returned record "branded". It is accurate enough (the generic is the brand now) but reads as the retired vocabulary.

## Self-Check: PASSED

All three modified/created files exist on disk; all three task commits resolve in `git log`.
</content>
</invoke>

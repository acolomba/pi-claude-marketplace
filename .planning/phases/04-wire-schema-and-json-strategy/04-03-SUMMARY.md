---
phase: 04-wire-schema-and-json-strategy
plan: "03"
subsystem: notifications
tags: [wire-payload, presentation, json-schema, raw-surfaces, severity]

requires:
  - phase: 04-wire-schema-and-json-strategy
    provides: presentCascade, presentUpdateNoOp, presentReconcileApplied, the two cascade-family wire kinds, toWirePayload
provides:
  - presentNotification, the total presentation of every NotificationMessage (JOUT-02)
  - one presentation per info kind; the prune warning carries its serialized, redacted cause
  - RAW_SURFACE_SEVERITY, the one raw-kind severity table both strategies read (PMOD-01)
  - CASCADE_PAYLOAD_SCHEMA and the 18-kind NOTIFICATION_PAYLOAD_SCHEMA (WIRE-01)
  - toWirePayload over presentations and resolved raw surfaces, with a cascade overload
  - schema/claude-plugin.schema.json regenerated with all 18 kinds
affects: [04-04, 04-05, json-output]

actuals:
  tokens: 33700
  tasks: 2
  commits: 2
plan_head_before: 8e4f14d253c3ef2f4016bfe179fa6bc64e9ec049
plan_head_after: 731794b4212ceb5bedb3cc6579e9738ce69964a8

tech-stack:
  added: []
  patterns:
    - "presentNotification switches on message.kind with the cascade arm last (`case undefined: case \"cascade\": break;`), because TypeScript does not treat a switch over the optional cascade discriminant as exhaustive"
    - "Info presentations are inline union members with literal kinds, so each switch arm differs by token and sonarjs/no-duplicated-branches stays clean"
    - "toWirePayload routes on `\"envelope\" in source`: presentations go to one switch, resolved raw surfaces to another"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-present.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-summary.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
    - schema/claude-plugin.schema.json
    - scripts/check-unused-type-members.contracts.json
    - tests/shared/notification-present.test.ts
    - tests/shared/notification-json.test.ts
    - tests/shared/notification-wire.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/shared/notification-grammar.test.ts
    - tests/shared/notification-summary.test.ts
    - tests/scripts/generate-wire-schema.test.ts

key-decisions:
  - "Raw payloads carry no summary; the async-rewake-summary payload names its text `text` (planner decisions 1 and 2)"
  - "Plugin-info rows emit dependencies; lastUpdatedAt is emitted whenever the model has it, for every source kind (planner decisions 3 and 4)"
  - "renderPruneCommittedWarning takes the scope and the serialized cause chain (or undefined), so the no-cause branch is covered by the grammar owner test instead of a new emitting dispatch case"
  - "isInfoKind and StandaloneKind are module-private: after dispatchInfoMessage was deleted, no production module imports them"

patterns-established:
  - "A raw kind's severity is read from RAW_SURFACE_SEVERITY by both formatRawSurface and toWirePayload"

requirements-completed: [WIRE-03, WIRE-04, WIRE-06]

duration: 113min
completed: 2026-10-03
status: complete
---

# Phase 4 Plan 03: Total Presentation and the 18-Kind Wire Union Summary

**`notify` now formats one total presentation (`presentNotification`), so no live `Error` crosses a presentation. The wire union holds all 18 kinds. `toWirePayload` converts every presentation and every resolved raw surface, and both strategies read raw-kind severity from `RAW_SURFACE_SEVERITY`.**

## Performance

- **Duration:** about 113 min
- **Started:** 2026-10-03T15:31Z
- **Completed:** 2026-10-03T17:24Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- `presentNotification(run, message)` covers every `NotificationMessage` kind. A cascade and an applied reconcile delegate to their presenters under `CENTRAL_ROW_POLICY`. The six message-carrying info kinds carry the message by identity. The not-added kind also carries its resolved reason. The committed prune warning carries `scope` and `serializeCauseChain(redactCauseChain(cause))`, never the message.
- `notify(ctx, run, message)` is one call: `emitPresentation(ctx, presentNotification(run, message))`. One private formatter switches on `presentation.kind` with no default. The context emitters use the same formatter. `dispatchInfoMessage`, `emitCascadePresentation`, `emitReconcileAppliedPresentation`, and the dispatch module's own cause serialization are gone.
- The wire union appends the 8 info kinds, then the 8 raw kinds, after `reconcile-applied-cascade`. Every object sets `additionalProperties: false`. `CASCADE_PAYLOAD_SCHEMA` is exported for the cascade overload, so both LLM tools still read `.marketplaces` without a cast.
- `RAW_SURFACE_SEVERITY` (`as const satisfies Record<RawSurface["kind"], Severity>`) is read in all eight `formatRawSurface` arms and in the JSON raw converter. The D-15 grammar table passes unchanged.
- The committed schema has 18 members in declared order. The drift test lists them, and a new case asserts the count.

## Task Commits

1. **Task 1: Every info kind presents once, and the JSON strategy converts it**: `368bef6c` (feat). TASK_BASE `8e4f14d253c3ef2f4016bfe179fa6bc64e9ec049`.
2. **Task 2: Raw kinds convert, with one severity table for both strategies**: `731794b4` (feat). TASK_BASE `368bef6c53e6ae3da63f48cafbf99eec8d9e45ac`.

## Getter-backed Dispatch Case

`a non-failed plugin fallback preserves the empty standalone summary`: the status sequence changed from `["available", "available", "failed", "available"]` to `["failed", "available", "available", "available"]`. A temporary read log (removed before commit) confirmed the new order: `computeSeverity`, `buildSummaryLine`, then `renderPluginInfo` twice. The case's expected arguments are byte for byte unchanged. The test diff from TASK_BASE is 3 changed lines: the sequence line (-1 +1) and one comment line naming the presentation read order. Corpus baseline line 2967 is still present (3134 present, 0 extra).

## TDD Evidence

- The getter-backed case failed first under the new read order, with the old sequence: the actual call had no summary block and `(failed)` in the row. After the sequence change, it passed.
- The schema drift tests failed before regeneration (2 of 5 in Task 1). After `npm run schema:generate` and the kind-list update, they passed.
- The new owner cases in `notification-present.test.ts`, `notification-json.test.ts`, and `notification-wire.test.ts` were written after the production code. They cannot be shown red against modules that lack the exports.

## Verification

- Task 1: typecheck clean. The present (22), json (63), wire, dispatch, grammar, summary, tools, and generate-wire-schema suites pass (527 tests). Direct coverage is 100% for notification-present (23/23 branches), -json (161/161), -wire (4/4), -dispatch (46/46), -grammar (183/183), and -summary (111/111). `lint:type-members` exits 0, and `npm run fallow` exits 0.
- Task 2: typecheck clean. The json (76), wire (14), grammar, resolve, dispatch, generate-wire-schema (6), hooks-cap-notify, and hooks-async-rewake suites pass (527 tests). Direct coverage is 100% for notification-json (173/173 branches), -wire (4/4), -grammar (183/183), and -resolve (97/97). `lint:type-members` exits 0, and `npm run fallow` exits 0.
- Corpus wrapper, after each task: `Corpus: 3134 present, 0 extra` (exit 0).
- Catalog: `git diff --exit-code 4e6c568a -- docs/output-catalog.md` is empty. `catalog-contract.test.ts` and `presentation-sink.test.ts` pass 17/17.
- Schema: `npm run schema:generate && git diff --exit-code -- schema/claude-plugin.schema.json` exits 0 at `731794b4`, and `anyOf.length` is 18.
- Acceptance: `presentNotification(run, message)` appears on one dispatch line. Neither `causeChainTrailer` nor `redactCauseChain` appears in the dispatch module. `dispatchInfoMessage` appears nowhere in extensions, tests, or the contracts file. `RAW_SURFACE_SEVERITY[` appears 8 times in grammar and once in json. The grammar test and the catalog have no diff from Task 2's TASK_BASE.
- `fallow audit` verdict: `warn` for both tasks (not `fail`).
- Task 1: focused task verification passed; full phase/PR verification pending.
- Task 2: focused task verification passed; full phase/PR verification pending.

### Full-check evidence

Both task pre-commit runs used the full scope, because the contracts JSON and the schema file escalate the selector. Task 2's run (`SKIP=trufflehog pre-commit run --files` over the 9 Task 2 paths, log `precommit-t2.log`, `PRECOMMIT_EXIT=0`, Node v26.10.0) ran on the exact tree committed as `731794b4`, with no other uncommitted changes. Under the local-verification reuse rule, it counts as that tree's `npm run check`, so the plan verification step reuses it.

## Contract Entries (scripts/check-unused-type-members.contracts.json)

Deleted (the position no longer exists):
- `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:260:43` (dispatchInfoMessage.message `kind`)

Re-pinned by line only:
- `notification-grammar.ts:941:32` -> `:943:32` (Task 1) -> `:944:32` (Task 2) (isDescriptionBearingRow `status`), filter `:941:9` -> `:943:9` -> `:944:9`
- `notification-summary.ts:46:40` -> `:47:40` (isInfoKind `kind`), filter `:46:9` -> `:47:9`

No contract or exception entry was added.

## Decisions Made

- Planner decisions applied: raw payloads carry no `summary`. The rewake payload names its text `text`. Plugin-info rows emit `dependencies`. `lastUpdatedAt` is emitted for every source kind.
- A plugin-info row's `scope` follows the cascade install-scope rule: install-scoped statuses carry their own scope or the marketplace scope, and catalogue statuses carry none. `reasons` is the model list or `[]`.
- The plugin-info wire status is a closed enum over the 8 `PluginInfoRow` statuses (`PLUGIN_INFO_STATUSES`, enrolled with `satisfies Record<PluginInfoRow["status"], true>`).
- The info-cascade `blocks` carry the info body without envelope fields, with `minItems: 1`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `renderPruneCommittedWarning(scope, cause)` takes the serialized chain**
- **Found during:** Task 1 (direct coverage: notification-dispatch at 46/47 branches)
- **Issue:** the plan put the `cause === undefined ? "" : formatCauseChain(cause)` choice in the dispatch formatter. The no-cause branch is reachable only through an `as never` message. Covering it in the dispatch suite would add an emitting case, which the corpus reports as an unapproved extra.
- **Fix:** the grammar renderer takes `cause: SerializedCauseChain | undefined` and formats the trailer itself. The bytes are unchanged. The grammar owner test covers both branches (one new case for no cause).
- **Commit:** 368bef6c

**2. [Rule 3 - Blocking] `isInfoKind` and `StandaloneKind` are module-private**
- **Found during:** Task 1 (`fallow dead-code`: unused export `isInfoKind` once dispatch stopped importing it)
- **Fix:** removed both `export` keywords. `notification-summary.test.ts` dropped its three direct `isInfoKind` assertions; each case kept its public-function assertions. The "cascade messages are not standalone" case became "a cascade is not standalone, so its row stamps drive the reload" (`shouldEmitReloadHint` on a stamped cascade is true). The isInfoKind type-selection contract was re-pinned by line only.
- **Commit:** 368bef6c

**3. [Rule 1 - Bug] `wireComponents` parameter type**
- **Found during:** Task 1 (`lint:type-members`: unread `componentsResolved` in an inline `Extract<..., { componentsResolved: true }>`)
- **Fix:** typed the parameter as `PluginInfoComponentsResolved["components"]`.
- **Commit:** 368bef6c

**4. Structure: the raw converter is a private `wireRawSurface` switch**
- `toWirePayload` routes on `"envelope" in source` to `wirePresentation` (one arm per structured kind) or `wireRawSurface` (one arm per raw kind). This keeps each function within the fallow cyclomatic limit of 20. The cascade arm moved into `wireCascade`, and `wireEnvelope` no longer carries the tally (`wireTallyField` adds it on the two cascade-family arms).

**5. The WIRE-01 adjacency cases landed in Task 2**
- Task 1 had no raw converter yet, so the raw-then-cascade and cascade-then-raw cases were added with the raw arms.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Issues Encountered

- A run of `npm test` during Task 1 failed one architecture case ("a new unread member outside the recorded decisions fails the real gate"), because the type-member gate exited 2 on a stale pin. Re-pinning fixed it, and the corpus run (the full unit and integration suites) then passed.

## Requirements

`requirements.ready-ids` logic: WIRE-03, WIRE-04, and WIRE-06 are declared by no later plan of this phase, and the info and raw payloads now carry verbatim tokens, raw values, and `id` on plugin-info rows. They are marked complete. WIRE-01 stays pending, because 04-05 also declares it (the catalog-wide proof).

## Next Phase Readiness

04-04 adds credential redaction at its final sites, including the marketplace-info presentation, which now exists. 04-05 has every kind in one union for the catalog-wide WIRE-08 walk.

## Self-Check: PASSED

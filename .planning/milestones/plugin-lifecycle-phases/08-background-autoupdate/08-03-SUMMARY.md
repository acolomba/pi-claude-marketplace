---
phase: 08-background-autoupdate
plan: 03
subsystem: output
tags: [autoupdate, background, notification, wire-schema, json-output, catalog]

requires:
  - "08-01: orchestrators/marketplace/background-pass.ts (createBackgroundPass, the yielding plugin update wrapper, isStopped)"
provides:
  - "shared/notification-types.ts: BackgroundUpdatePlugin, BackgroundUpdateSurface (a LoadSurface member)"
  - "shared/notification-dispatch.ts: notifyBackgroundUpdate(ctx, run, plugins), the one emitter of the kind"
  - "Wire payload kind background-update in schema/claude-plugin.schema.json (23 members)"
  - "BackgroundPassDeps.pi widened to PiInventory & NotificationEntrySink; the pass raises the notice after its last marketplace"
  - "docs/json-output.md #### background-update and ### Background update plugin; docs/output-catalog.md background-update-{one,two,many}"
affects: [08-04 behavioral scenario (reads the notice text or the background-update entry)]

actuals:
  tokens: 14500
  tasks: 2
  commits: 2
plan_head_before: fa6b874809a3624b98bf0abdc01dbae920a7f051
plan_head_after: 3525499dca0f2cc0342c0cbe1ce04d6116ff79e7

tech-stack:
  added: []
  patterns:
    - "A raw load surface whose needsReload is fixed true in the JSON arm and narrowed to Type.Literal(true) in the schema"
    - "The emitter returns on an empty list, so the schema's minItems: 1 can never be broken by a caller"

key-files:
  created:
    - test/architecture/background-update-notice.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts
    - schema/claude-plugin.schema.json
    - docs/json-output.md
    - docs/output-catalog.md
    - test/shared/notification-types.test.ts
    - test/shared/notification-resolve.test.ts
    - test/shared/notification-grammar.test.ts
    - test/shared/notification-json.test.ts
    - test/shared/notification-wire.test.ts
    - test/shared/notification-dispatch.test.ts
    - test/orchestrators/marketplace/background-pass.test.ts
    - test/architecture/wire-schema.test.ts
    - test/architecture/catalog-uat/catalog-wire.test.ts
    - test/architecture/no-credential-leak.test.ts

key-decisions:
  - "The no-credential-leak row plants the userinfo URL in the row's name as well as its toVersion: the gate requires the *** marker in the text, and the one-plugin text shows the name, not the version"
  - "The resolve arm redacts name, marketplace, fromVersion, and toVersion through a module-private helper; scope passes through"

patterns-established:
  - "Background pass test double: createPassUnderTest takes scripted plugin outcomes and an optional appendEntry; the default pi sink is a JSON capture"

requirements-completed: [AUP-03]

coverage:
  - id: D1
    description: "One background-update notice, D-PL8-10 text in tui/print (one, two, many; dedupe by plugin@marketplace), info severity"
    requirement: AUP-03
    verification:
      - kind: unit
        ref: "test/shared/notification-grammar.test.ts (RAW_SURFACE_ROWS background-update row + 4 D-PL8-10 rows)"
        status: pass
      - kind: unit
        ref: "test/shared/notification-dispatch.test.ts#notifyBackgroundUpdate names the updated plugins at info severity"
        status: pass
      - kind: unit
        ref: "test/architecture/background-update-notice.test.ts (3 catalog byte locks)"
        status: pass
    human_judgment: false
  - id: D2
    description: "JSON/rpc payload: kind background-update, load origin, info, needsReload true, plugins rows field by field with optional fromVersion; schema accepts and rejects as specified"
    requirement: AUP-03
    verification:
      - kind: unit
        ref: "test/shared/notification-json.test.ts (RAW_CASES row + D-PL8-16 row without fromVersion)"
        status: pass
      - kind: unit
        ref: "test/shared/notification-wire.test.ts (3 AUP-03 rows)"
        status: pass
      - kind: unit
        ref: "test/architecture/wire-schema.test.ts, test/architecture/json-output-docs.test.ts, test/architecture/catalog-uat/catalog-wire.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The pass reports updated outcomes in pass order across both scopes; nothing when nothing moved or after a stop; a throwing sink rejects the pass (D-PL8-15)"
    requirement: AUP-03
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/background-pass.test.ts (4 new cases, 10 prior cases unchanged)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every string field of a row is redacted before both strategies (PMOD-04)"
    requirement: AUP-03
    verification:
      - kind: unit
        ref: "test/shared/notification-resolve.test.ts#PMOD-04 redacts a credential in every string field of a background update row"
        status: pass
      - kind: unit
        ref: "test/architecture/no-credential-leak.test.ts#... a background update row's name and version"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-27
status: complete
---

# Phase 8 Plan 03: Background Update Notice Summary

**A background update that moved plugins now raises one notice, `Plugin updated: demo · Run /reload to apply` (two names joined with "and", three or more counted), or in json/rpc one load-origin `background-update` entry with `needsReload: true` and one row per updated install; a pass that moved nothing, or whose runtime stopped, stays silent.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-27T04:07:57Z
- **Completed:** 2026-10-27T04:32:48Z
- **Tasks:** 2
- **Files modified:** 21 (1 created, 20 modified)

## Accomplishments

- New raw kind `background-update` in the `LoadSurface` group, with an arm in every exhaustive consumer: severity table (`info`), resolve (redaction), grammar (D-PL8-10 text with U+00B7), JSON (`needsReload: true`, rows field by field), wire schema (`needsReload: Type.Literal(true)`, `minItems: 1`), and the dispatch `isRawOutcome` false group.
- `notifyBackgroundUpdate(ctx, run, plugins)` returns on an empty list, otherwise emits through `emitLoadSurface`. It has no string literal but the kind and never mentions `ui`, so the presentation-sink gate still passes.
- The pass collects `updated` outcomes in the yielding wrapper, then after the scope loop returns on an empty list or `isStopped()`, and only then opens `openNotificationRun(deps.pi, { kind: "load" })`. A throw from the notice rejects the pass; the scheduler's catch from 08-01 debug-logs it.
- Schema regenerated (23 members); `docs/json-output.md` gained the kind section, the row section, the Origin sentence, and the corrected kind count; `docs/output-catalog.md` gained three blocks locked by a new architecture test.

## Task Commits

1. **Task 1: One background-update notice from the pass to Pi, in text and JSON** - `33ec5fab` (feat)
2. **Task 2: The output catalog documents the notice and a test locks its bytes** - `3525499d` (docs)

Both commits passed the pre-commit hook (`npm run check:commit`: static checks, unpaired tests, direct coverage of the staged pairs) without `--no-verify`. Commit 2's hook ran `check:static` over the whole tree after the last change.

## Files Created/Modified

- `shared/notification-types.ts` - `BackgroundUpdatePlugin`, `BackgroundUpdateSurface`, `LoadSurface` member
- `shared/notification-resolve.ts` - severity row, resolve arm, module-private `resolveBackgroundUpdate`
- `shared/notification-grammar.ts` - `formatRawSurface` arm, module-private `composeBackgroundUpdateText`
- `shared/notification-json.ts` - `wireRawSurface` arm, module-private `wireBackgroundUpdatePlugin`, doc comment reworded
- `shared/notification-wire.ts` - `BACKGROUND_UPDATE_PLUGIN`, `BACKGROUND_UPDATE_PAYLOAD`, union member after `MCP_MIGRATION_PAYLOAD`
- `shared/notification-dispatch.ts` - `notifyBackgroundUpdate`, `isRawOutcome` arm
- `orchestrators/marketplace/background-pass.ts` - widened `pi`, row collection, the notice after the loop, header paragraph
- `schema/claude-plugin.schema.json` - regenerated
- `docs/json-output.md`, `docs/output-catalog.md` - kind, row, catalog blocks
- `test/architecture/background-update-notice.test.ts` - new byte lock

## Files touched outside the Files line

- `shared/notification-{resolve,grammar,json,wire,dispatch}.ts` - each is an exhaustive consumer of `RawSurface`/`ResolvedRawSurface`, so the new kind needs an arm in each (typecheck fails otherwise).
- `schema/claude-plugin.schema.json` - regenerated from `NOTIFICATION_PAYLOAD_SCHEMA`; the wire-schema drift test compares it.
- `test/shared/notification-{types,resolve,grammar,json,wire,dispatch}.test.ts` - paired owner tests; each new arm needs its own module's direct coverage, and the mapped-type tables (`RAW_SURFACE_ROWS`, `RAW_CASES`) need a row to typecheck.
- `test/orchestrators/marketplace/background-pass.test.ts` - paired owner test; the `pi` double needs an entry sink and the four notice cases.
- `test/architecture/wire-schema.test.ts` - pins the ordered kind list and the member count (22 -> 23).
- `test/architecture/catalog-uat/catalog-wire.test.ts` - mapped `RAW_ORIGINS`/`RAW_SAMPLES`, the `emitRawSample` switch, the sorted kind list, and `PRESENTED.length` (334 -> 335, exactly the one new raw sample; the test passed at 335).
- `test/architecture/no-credential-leak.test.ts` - one planted-credential row for the new kind.

The `docs/json-output.md` common-fields sentence said "twenty-one kind sections" while 22 `####` sections existed under "### Payload kinds". It now says "twenty-three", which matches the 23 sections after this plan.

## Decisions Made

- The resolve helper builds the row explicitly and adds `fromVersion` only when present, so a row without one stays without one on both strategies (D-PL8-16, WIRE-04).
- The grammar composer dedupes with a `Map` keyed by `<name>@<marketplace>`, keeping first-seen order (the RESEARCH sketch).

## Uncertain choices (for review)

1. The no-credential-leak row plants `USERINFO_URL` in `name` and `toVersion`, not in `toVersion` only as the plan said. The gate asserts that the text carries the `***` marker. The one-plugin text shows the name but not the version, so a version-only plant failed that check. Payload and presentation still probe `toVersion`.
2. The pass's notice case 1 uses rows from two marketplaces in two scopes. It does not use one plugin updated in both scopes. The grammar dedupe case and the catalog "many" block cover the same plugin in both scopes. The pass case proves pass order across scopes and that `unchanged`, `skipped`, and `failed` outcomes add no row.
3. The stopped-runtime case stops after the last marketplace's update, so the pass reaches the post-loop `isStopped()` check. A stop before a later marketplace ends the pass through the existing early return, which never reaches the notice.
4. The `RAW_CASES` JSON row uses the table's shared command origin, like every other row. The separate no-`fromVersion` case uses `{ kind: "load" }`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Credential-leak row planted in the name as well as the version**
- **Found during:** Task 1
- **Issue:** the plan's row (credential in `toVersion` only) failed `assertNoPlantedCredential`, which requires `***` in the text; the text shows only the plugin name.
- **Fix:** planted the same URL in `name` too; the row's site reads "a background update row's name and version".
- **Files modified:** test/architecture/no-credential-leak.test.ts
- **Commit:** 33ec5fab

The first Task 1 commit attempt failed the hook on code this plan wrote: TS2741 (`constraint` missing in the test's updated outcome), ESLint padding before the new `case` after a block arm, and an unused `no-await-in-loop` directive in the test (the rule is off for tests). All three were fixed before the commit landed.

## Issues Encountered

None beyond the hook findings above.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-04's scenario can check the notice text in tui. It can also check the `background-update` entry (`origin.kind` `load`, `needsReload: true`) in rpc.
- Combined-tree `npm run check` was not run here. The wave or phase gate owns it.

---
*Phase: 08-background-autoupdate*
*Completed: 2026-10-27*

## Self-Check: PASSED

---
phase: 05-credential-surface
plan: 07
subsystem: json-output
tags: [system-git, credentials, device-flow, json-output, schema]

requires:
  - phase: 05-credential-surface
    provides: "05-06 removed Device Flow and every emitter of the prompt kind"
provides:
  - "The notification closed sets, the wire union, and the published schema without the `device-flow-prompt` kind (24 kinds, schemaVersion 1)"
  - "The JSON output guide's rule that removing a kind no command emits keeps the same version"
affects: [05-13, json-output, wire schema]

actuals:
  tokens: 7700
  tasks: 2
  commits: 2
plan_head_before: 50cec4233cd47461b160b73887ba63638f9a5d47
plan_head_after: 4e907ed

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - schema/claude-plugin.schema.json
    - docs/json-output.md
    - docs/output-catalog.md
    - test/shared/notification-types.test.ts
    - test/shared/notification-wire.test.ts
    - test/shared/notification-json.test.ts
    - test/shared/notification-grammar.test.ts
    - test/shared/notification-resolve.test.ts
    - test/architecture/wire-schema.test.ts
    - test/architecture/json-output-docs.test.ts
    - test/architecture/catalog-uat/catalog-wire.test.ts

key-decisions:
  - "The wire schemaVersion stays 1 after the `device-flow-prompt` kind is removed, because no command emits it (research OQ5, maintainer 2026-11-27, D-SG-27)"
  - "The wire origin cases that used the prompt payload as their raw sample now use a diagnostic payload"

patterns-established:
  - "Removing a wire kind that no command emits keeps the schema version; docs/json-output.md states the rule"

requirements-completed: [SG-AUTH-02]

coverage:
  - id: D1
    description: "The `device-flow-prompt` kind is gone from the raw surface union, the wire union, the severity table, the text and JSON strategies, resolve, and the dispatch outcome test"
    requirement: SG-AUTH-02
    verification:
      - kind: unit
        ref: "node --test test/shared/notification-{types,wire,json,grammar,resolve,dispatch}.test.ts test/architecture/{wire-schema,catalog-uat/catalog-wire,catalog-uat/catalog-contract}.test.ts (981 passed)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- the six shared sources (100%, exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "schema/claude-plugin.schema.json is the generated schema with 24 kinds, and a second `npm run schema:generate` leaves it unchanged"
    verification:
      - kind: unit
        ref: "test/architecture/wire-schema.test.ts#the committed schema has exactly 24 payload members"
        status: pass
      - kind: other
        ref: "npm run schema:generate; git status --porcelain schema/claude-plugin.schema.json (empty)"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/json-output.md and docs/output-catalog.md describe no Device Flow prompt, and the guide states the version rule for a removed kind"
    verification:
      - kind: unit
        ref: "node --test test/architecture/json-output-docs.test.ts test/architecture/catalog-uat/catalog-contract.test.ts (121 passed)"
        status: pass
      - kind: other
        ref: "SKIP=npm-check,trufflehog pre-commit run --files docs/json-output.md docs/output-catalog.md (mdformat, markdownlint passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No command output changes"
    requirement: SG-AUTH-02
    verification:
      - kind: e2e
        ref: "node scripts/cucumber.mjs --profile adapter features/marketplace features/plugin (1539 passed)"
        status: pass
      - kind: e2e
        ref: "node scripts/cucumber.mjs --profile builtin features/marketplace features/plugin (42 passed)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-27
status: complete
---

# Phase 5 Plan 07: The device-flow-prompt kind removed Summary

**The `device-flow-prompt` kind is gone from the notification closed sets, the wire union, the regenerated `schema/claude-plugin.schema.json` (now 24 kinds, schemaVersion still 1), and the JSON output guide and output catalog. The guide now states that removing a kind no command emits keeps the same version.**

## Performance

- **Duration:** about 20 min
- **Started:** 2026-11-27T18:57:05Z
- **Completed:** 2026-11-27T19:16:50Z
- **Tasks:** 2
- **Files modified:** 17 (0 created, 17 modified, 0 deleted)

PLAN_BASE: `50cec4233cd47461b160b73887ba63638f9a5d47` (the worktree base).

## Accomplishments

- `shared/notification-types.ts`: `DeviceFlowPrompt`, `DeviceFlowPromptSurface`, and the `RawSurface` member are deleted.
- `shared/notification-wire.ts`: `DEVICE_FLOW_PROMPT_PAYLOAD` and its member of `NOTIFICATION_PAYLOAD_SCHEMA` are deleted. The members after it move down one index (`async-rewake-summary` is `anyOf[14]`, `hook-notice` is `anyOf[21]`, `reload-started` is `anyOf[22]`).
- `shared/notification-json.ts`, `shared/notification-grammar.ts`: the `case` arms are deleted. `shared/notification-resolve.ts`: the `RAW_SURFACE_SEVERITY` entry and the pass-through `case` are deleted. `shared/notification-dispatch.ts`: the fall-through label in `isRawOutcome` is deleted. Every switch stays exhaustive through the compiler (typecheck passed).
- `schema/claude-plugin.schema.json`: regenerated by `npm run schema:generate`.
- `docs/json-output.md`: the `#### device-flow-prompt` section and its fields block are deleted. The outcome sentence names only `diagnostic` and the lifecycle-only kinds. The RPC front-end sentence ends at "Front-ends must render these entries." A new paragraph after the version rule says: "Removing a kind that no command emits any more keeps the same version. For example, the version stayed `1` when the extension removed the `device-flow-prompt` kind together with Device Flow (D-SG-27)."
- `docs/output-catalog.md`: the `### Device Flow user-code prompt (AUTH-03)` section and its `catalog-state: device-flow-prompt` marker are deleted. The out-of-band intro no longer names Device Flow prompts.

### Schema diff

`git diff 50cec42 HEAD -- schema/claude-plugin.schema.json`: 47 lines deleted and none added. It removes one `anyOf` member, the object with `kind: { const: "device-flow-prompt" }`, required `schemaVersion`, `origin`, `severity`, `needsReload`, `kind`, `verificationUri`, `userCode`, and `additionalProperties: false`. No other member changed. `schemaVersion` stays `{ "const": 1 }` in every member. A second `npm run schema:generate` after the commit left `git status --porcelain schema/claude-plugin.schema.json` empty.

### Catalog counters

`catalog-contract.test.ts` passed before and after both tasks with no counter change. Its parser skips the out-of-band section. `catalog-wire.test.ts` keeps `PRESENTED.length` at 342 and the emitted-key set at 329, because 05-06 already removed the prompt sample. Its key type is the plain `RawSurface["kind"]` again.

### Deleted unit cases and rows

- `test/shared/notification-types.test.ts`: the `DeviceFlowPrompt` and `DeviceFlowPromptSurface` imports, the accepted `DeviceFlowPromptSurface` proof, the `@ts-expect-error D-10 / AUTH-09` no-token proof, and the `@ts-expect-error RAWS-03` composed-sentence proof.
- `test/shared/notification-wire.test.ts`: `accepts a raw device-flow-prompt payload`, `rejects a device-flow-prompt payload without its user code`, `DEVICE_FLOW_PROMPT_MEMBER`, and `deviceFlowPromptPayload`. The origin cases (`accepts exact ${origin.kind} origin on raw and structured payloads`, `rejects ${title} on raw and structured payloads`, `rejects missing origin on raw and structured payloads`) now take their raw sample from a new `diagnosticPayload()`.
- `test/shared/notification-json.test.ts`: the `device-flow-prompt` row of the raw-kind table.
- `test/shared/notification-grammar.test.ts`: the `device-flow-prompt` row of the raw-kind table with its catalog byte-lock comment, `renders empty device-flow values verbatim`, `passes a device-flow URI with a query string through verbatim`, and the RAWS-03 / D-09 clause of the edge-case table's comment.
- `test/shared/notification-resolve.test.ts`: the `device-flow-prompt` surface of `returns a ${surface.kind} surface as the same object`.
- `test/architecture/wire-schema.test.ts`: the `{ kind: "device-flow-prompt", schemaVersion: 1 }` member row. The count case is now `the committed schema has exactly 24 payload members` with `assert.strictEqual(memberCount, 24)`.
- `test/architecture/json-output-docs.test.ts`: `device-flow-prompt` is dropped from the non-outcome kind list (`${label} rejects device-flow-prompt only without a command outcome`, three cases) and from `the verdict includes ${kind} severity alongside an outcome` (one case).
- `test/architecture/catalog-uat/catalog-wire.test.ts`: the `EmittedRawKind` and `EmittedRawSurface` types and their comment. `RAW_ORIGINS`, `RAW_SAMPLES`, and `emitRawSample` key on `RawSurface` again. The WIRE-02 case is now titled `... cover all 24 kinds` (see Deviation 2).

### Suite counts

- Task 1 verify (the six shared tests, `wire-schema`, `catalog-wire`, `catalog-contract`): 981 tests, 981 passed, before the commit and again on the committed tree (tracer gate).
- Task 1 direct coverage, `npm run test:coverage:direct --` the six shared sources: exit 0, no shortfall (100%). The Task 1 commit hook ran `check:commit` (Passed).
- Task 2 verify (`json-output-docs`, `catalog-contract`): 121 tests, 121 passed. The Task 2 commit hook ran `check:commit` (Passed).
- Plan verification: `npm run --silent check:static` exit 0, with no output line naming a finding. `npm run --silent test:unpaired` exit 0. `features/marketplace features/plugin`, adapter: 1539 scenarios, 1539 passed (18456 steps). Builtin: 42 scenarios, 42 passed (544 steps).

## Task Commits

1. **Task 1: The JSON contract no longer has a device-flow-prompt kind, from the wire union to the published schema (tracer)** - `442b53f` (refactor). Tracer gate: interactive run, `end-of-phase`, automated-only verify. The verify was re-run on the committed tree and passed (981 of 981), and the second schema generation left no diff.
2. **Task 2: The JSON output guide and the output catalog describe no Device Flow prompt, and the guide states the version rule for a removed kind** - `4e907ed` (docs)

Neither task is a TDD task, so there is no RED commit.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-{types,wire,json,grammar,resolve,dispatch}.ts`: the kind, its types, its payload, its severity entry, and its `case` arms deleted
- `schema/claude-plugin.schema.json`: regenerated, 24 members
- `docs/json-output.md`: kind section deleted, two sentences shortened, version-rule paragraph added
- `docs/output-catalog.md`: the prompt section and marker deleted, intro shortened
- `test/shared/notification-{types,wire,json,grammar,resolve}.test.ts`, `test/architecture/{wire-schema,json-output-docs}.test.ts`, `test/architecture/catalog-uat/catalog-wire.test.ts`: cases and rows deleted or reshaped as listed above

### Deleted files

None.

## Decisions Made

- The origin cases of `notification-wire.test.ts` need one raw payload with a command origin. The deleted prompt payload filled that role, and a `diagnostic` payload now does. `diagnostic` is a raw kind with a command origin that every command run can emit.
- The version rule is in its own paragraph after the existing rule. That way, the acceptance count of `keeps the same version` lines is 2, and the new rule reads apart from the additive-change rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The docs kind section and the docs test lists moved into Task 1**
- **Found during:** Task 1 (before its commit)
- **Issue:** With the kind gone from the schema, `test/architecture/json-output-docs.test.ts` failed `the reference covers every schema kind and recursive field with its requiredness` (119 of 120 passed), because `docs/json-output.md` still had the `#### device-flow-prompt` fields block. The commit hook runs every architecture test, so Task 1 could not be committed without that docs change. Task 1's acceptance (`grep -rl 'device-flow-prompt' extensions schema test` equals 0) also needs the two `json-output-docs.test.ts` list entries removed.
- **Fix:** Task 1 deleted the `#### device-flow-prompt` section with its fields block and dropped the kind from the two lists of `json-output-docs.test.ts`. Task 2 kept the rest of its docs work: the outcome sentence, the RPC sentence, the version-rule paragraph, and the catalog section.
- **Files modified:** `docs/json-output.md`, `test/architecture/json-output-docs.test.ts`
- **Verification:** `json-output-docs.test.ts` 116 of 116 passed before the Task 1 commit. The hook passed.
- **Committed in:** `442b53f`

**2. [Rule 1 - Bug] The WIRE-02 case title had the wrong count**
- **Found during:** Task 1
- **Issue:** `catalog-wire.test.ts` was titled `WIRE-02: the retained inventory and separate command error cover all 23 emitted kinds`, but its assertion lists 24 kinds. With the prompt kind gone, the wire has exactly those 24 kinds.
- **Fix:** The title is now `WIRE-02: the retained inventory and separate command error cover all 24 kinds`. The assertion did not change.
- **Files modified:** `test/architecture/catalog-uat/catalog-wire.test.ts`
- **Verification:** `catalog-wire.test.ts` passed in the Task 1 verify.
- **Committed in:** `442b53f`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both are needed for a green hook and a correct title. No scope creep, no new kind, field, or message, and no schemaVersion change.

## Issues Encountered

None.

### Left for later plans

These comments still mention the Device Flow user code and belong to later wording sweeps. This plan does not own them: the `onDeviceCode` comment at `orchestrators/marketplace/update.ts:499` and the "the Device Flow renders a user code" comment at `orchestrators/plugin/update-preflight.ts:357`. The `DeviceFlowUnavailableError` text in `shared/errors.ts` is still used, as 05-06 recorded. The CHANGELOG entry (the kind is gone and the version stays 1) is 05-13's.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-14 (accept): only an unemitted kind left the schema. T-05-SC (mitigate): no package was added, removed, or upgraded.

## Orchestrator actions

None. The plan asks for no `gsd-tools windows append`, and this plan leaves no stub, skipped test, or unrun verify.

## Next Phase Readiness

- 05-13 can record the OQ5 version rule in PROJECT.md and the CHANGELOG. The wire, the schema, and the docs now agree on 24 kinds at schemaVersion 1.

## Self-Check: PASSED

- `schema/claude-plugin.schema.json`, `docs/json-output.md`, `docs/output-catalog.md`: present.
- Commits `442b53f` and `4e907ed`: ancestors of HEAD.
- `grep -rl 'device-flow-prompt' extensions schema test | wc -l`: 0. `grep -c 'assert.strictEqual(memberCount, 24)' test/architecture/wire-schema.test.ts`: 1. `grep -c 'device-flow-prompt' docs/json-output.md`: 1. `grep -c 'catalog-state: device-flow-prompt' docs/output-catalog.md`: 0. `grep -c 'keeps the same version' docs/json-output.md`: 2.

---
*Phase: 05-credential-surface*
*Completed: 2026-11-27*

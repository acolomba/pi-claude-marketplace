---
phase: 04-wire-schema-and-json-strategy
plan: "01"
subsystem: notifications
tags: [typebox, json-schema, wire-payload, llm-tools, presentation]

requires:
  - phase: 01-presentation-model
    provides: resolveRows, resolveEnvelope, the resolved row and envelope model
provides:
  - presentCascade, the presentation step both strategies format (JOUT-02)
  - NOTIFICATION_PAYLOAD_SCHEMA, the versioned typebox union (cascade kind)
  - toWirePayload, the field-by-field JSON strategy
  - plugin LLM tool details as wire marketplace blocks (LLMT-01)
  - schema/claude-plugin.schema.json, generated, committed, packaged (WIRE-09)
affects: [04-02, 04-03, 04-04, 04-05, json-output]

actuals:
  tokens: 30318
  tasks: 2
  commits: 2
plan_head_before: 4d49ae26eb8b6da090e60dd0c81a168b224aadad
plan_head_after: 29a05bd50ab50f454635513e4e30436938ab7093

tech-stack:
  added: []
  patterns:
    - "Closed-set enrollment maps (`as const satisfies Record<ClosedSet, true>`) feed `Type.Enum`, so a closed-set change fails typecheck in the wire module"
    - "Production reads the wire schema through `import type` only (D-12); tests compile it"
    - "Generated artifact plus drift test: scripts/wire-schema.mjs core, npm-script entry, committed output"

key-files:
  created:
    - extensions/pi-claude-marketplace/shared/notification-present.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - scripts/wire-schema.mjs
    - scripts/generate-wire-schema.mjs
    - schema/claude-plugin.schema.json
    - tests/shared/notification-present.test.ts
    - tests/shared/notification-wire.test.ts
    - tests/shared/notification-json.test.ts
    - tests/scripts/generate-wire-schema.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - tests/edge/handlers/tools.test.ts
    - scripts/check-unused-type-members.contracts.json
    - package.json

key-decisions:
  - "Wire closed-set fields use Type.Enum over the enrollment-map keys (JSON Schema `enum`), not a Type.Union of Type.Literal: typebox 1.3.34 computes Static of a union over a non-tuple array as never"
  - "toWirePayload has no switch while the union holds one kind (sonarjs/no-small-switch and no-unnecessary-condition reject a one-arm switch); it reads presentation.kind into the payload, and the next kind adds the switch"
  - "Plugin tool details key is `marketplaces` (wire blocks), replacing the flat `plugins` list with projected statuses"

patterns-established:
  - "Optional wire fields use ternary conditional spreads (`cond ? { field } : {}`), never `&&` spreads"
  - "`\"x\" in row` alone narrows an optional member under exactOptionalPropertyTypes; no `!== undefined` follows it"

requirements-completed: [WIRE-09]

duration: 89min
completed: 2026-10-03
status: complete
---

# Phase 4 Plan 01: Wire Schema and JSON Strategy Tracer Summary

**The context cascade now formats from a presentation step that a new typebox wire union and a field-by-field JSON converter also read, and the plugin LLM tool returns those wire blocks as its details while the JSON Schema is generated, committed, packaged, and drift-tested.**

## Performance

- **Duration:** 89 min
- **Started:** 2026-10-03T11:39:26Z
- **Completed:** 2026-10-03T13:08:39Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- `presentCascade` resolves rows, then the envelope, into one `CascadePresentation`; `emitContextCascade` formats its text from it with unchanged bytes (corpus 3134 present, 0 extra; catalog unchanged).
- `NOTIFICATION_PAYLOAD_SCHEMA` (cascade kind) ties status, reason, scope, severity, and row-hint literals to their closed sets through `Record<ClosedSet, true>` enrollment maps; every object sets `additionalProperties: false`.
- `toWirePayload` builds the payload field by field: verbatim tokens, `id` as `<name>@<marketplace>`, scope on the 15 install-scoped statuses only, `pluginVersion` grouping for `version` / `from` / `to`, `summary` on warning and error, `noOp` only when true, failure detail from the serialized chain.
- The plugin tool (`pi_claude_marketplace_plugin_list`) returns `details.marketplaces`: bucket-filtered wire blocks with verbatim statuses and the reasons `/claude:plugin list` composes, from one notification run per invocation. Content lines are byte-identical.
- `npm run schema:generate` writes `schema/claude-plugin.schema.json` from the typebox source; `package.json` `files` lists it; a drift test with a planted control guards it.

## Task Commits

1. **Task 1: Tracer: the plugin LLM tool reads wire rows through the presentation step** - `f7eefe37` (feat). TASK_BASE `4d49ae26eb8b6da090e60dd0c81a168b224aadad`.
2. **Task 2: The generated JSON Schema is committed, packaged, and drift-tested** - `29a05bd5` (feat). TASK_BASE `f7eefe37`.

Each task commit carries its failing-first owner tests and the implementation together (a red commit cannot pass the full-check hook).

## TDD Evidence

- Task 1 RED: the rewritten `tests/edge/handlers/tools.test.ts` was run against the HEAD `tools.ts` (`node --test --test-reporter=tap`): exit 1, 31 of 35 failing on `AssertionError` (details still carried the flat `plugins` list). `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target `registerListPluginsTool`; the TAP parser reads only the top-level suite). GREEN: 35/35.
- The production modules were drafted before their new owner tests (`notification-present`, `-wire`, `-json` tests); those tests could not be shown red against absent modules, so their RED is the tool-test evidence above plus the planted controls they contain.
- Task 2 RED: `tests/scripts/generate-wire-schema.test.ts` before the schema and the `files` entry existed: 0/5 passing (ENOENT on the committed file; the `files` case failed its assertion). GREEN: 5/5.

## Verification

- Task 1: `npm run typecheck` clean; `node --test` on the present (7), wire (9), json (39), dispatch (209, file unchanged), and tools (35) suites all pass.
- Direct coverage 100% for all five pairs: notification-present (6/6 branches), notification-wire (4/4), notification-json (95/95 after the `ownScopeOr` split), notification-dispatch (52/52), tools (78/78).
- `npm run lint:type-members`: passed (3 recorded exceptions, unchanged).
- `npx fallow dead-code --fail-on-issues`: exit 0 after each task; `npm run fallow`: exit 0 after Task 2.
- Corpus wrapper: `Corpus: 3134 present, 0 extra` (exit 0).
- Catalog: `git diff --exit-code 4e6c568a -- docs/output-catalog.md` empty; `catalog-contract.test.ts` and `presentation-sink.test.ts` 17/17 pass.
- Acceptance greps: `toWirePayload(presentCascade(` one line in tools.ts; `presentCascade(run, message, rowPolicies)` one line in dispatch; no `typebox/compile` in the wire or json module; `import type { NOTIFICATION_PAYLOAD_SCHEMA }` one line; `tests/shared/notification-dispatch.test.ts` and the catalog have no diff from TASK_BASE; no expected content-line literal was removed from the tools test diff.
- Task 2: generator test 5/5; regeneration produces the committed bytes (determinism case); Prettier and ESLint clean on the three new files; `npm pack --dry-run` prints `packed: schema/claude-plugin.schema.json`; no `fallow-ignore` in the new scripts.
- Task 1: focused task verification passed; full phase/PR verification pending.
- Task 2: focused task verification passed; full phase/PR verification pending.

### Full-check evidence

Both task pre-commit runs selected the full scope (`npm run check:changed -- --list` reports `scope: full`, commands `npm run check` and `npm run test:coverage:direct:all`, reason "Shared, removed, configuration, or unclassified inputs"). Task 2's run (`SKIP=trufflehog pre-commit run --files` over the five Task 2 paths, log `precommit-t2.log`, `PRECOMMIT_EXIT=0`, Node v26.10.0) ran on the exact tree committed as `29a05bd5`, plus the uncommitted orchestrator edits to `.planning/STATE.md` and `.planning/state.json`. Under the local-verification reuse rule this counts as that tree's `npm run check`; the plan verification step reuses it rather than repeating the 23-33 minute run.

## Contract Entries (scripts/check-unused-type-members.contracts.json)

Deleted (members removed with `PluginRow.marketplace` and `PluginRow.scope`):
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts:138:3` (PluginRow.marketplace, external-output)
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts:139:3` (PluginRow.scope, external-output)

Re-pinned by line only:
- `notification-dispatch.ts:252:43` -> `:254:43` (dispatchInfoMessage.message `kind`, id), filter `:252:12` -> `:254:12`
- `tools.ts:98:9` -> `:103:9`, `:99:9` -> `:104:9`, `:100:9` -> `:105:9`, `:101:9` -> `:106:9` (marketplace-tool `name`, `scope`, `pluginCount`, `source`)
- their origins `tools.ts:112:{29,48,55,68}` -> `:117:{29,48,55,68}` and boundary `tools.ts:115:7` -> `:120:7`

No contract or exception entry was added.

## Assumptions Checked

- **A2 (fallow and npm scripts):** confirmed. After `schema:generate` was added, `fallow dead-code` reported 18 entry points (17 from package.json) and no issues; `scripts/generate-wire-schema.mjs`, `scripts/wire-schema.mjs`, and the core's three exports are reached through the script entry. No suppression was needed.
- **A3 (draft 2020-12 keywords):** confirmed. The generated document uses only `$schema`, `title`, `description`, `anyOf`, `type`, `const`, `enum`, `properties`, `required`, `items`, `minimum`, and `additionalProperties`, all JSON Schema 2020-12 keywords.

## User-visible Change

The `pi_claude_marketplace_plugin_list` tool's `details` moved from a flat `plugins` list with projected statuses (`upgradable` shown as `installed`, and so on) to `marketplaces`: wire blocks `{ name, scope, plugins }` holding wire rows `{ status, name, id, reasons, version?, scope?, ... }` with verbatim statuses (`upgradable`, `partially-upgradable`, `remote`, `disabled`, `partially-available`) and the soft-dependency markers the list command composes. The not-found, load-failure, and empty paths return `details: { marketplaces: [] }`. The content lines are unchanged.

## Decisions Made

- Install-scoped rows (15 statuses) carry `row.scope ?? block.scope`; the four catalogue statuses carry none (planner decision 2).
- Cascade rows carry no `dependencies` (planner decision 1); markers are already in `reasons`.
- A filtered-out block stays a block with `plugins: []`, while its content line shows the header alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Type.Enum` instead of a `Type.Union` of `Type.Literal`**
- **Found during:** Task 1
- **Issue:** `Type.Union(keys.map(Type.Literal))` over a non-tuple array has `Static` = `never` in typebox 1.3.34, so every row field typed by it rejected all values. Building a tuple needs a cast or an unreachable branch.
- **Fix:** `literalEnum` returns `Type.Enum(enrolledKeys(map))`; `Static` is the closed set. The emitted schema uses `enum` (a 2020-12 keyword) for those fields; `kind` and `schemaVersion` stay `const`.
- **Files modified:** extensions/pi-claude-marketplace/shared/notification-wire.ts
- **Commit:** f7eefe37

**2. [Rule 3 - Blocking] No one-arm `switch` in `toWirePayload`**
- **Found during:** Task 1
- **Issue:** ESLint rejects a one-arm switch on the single-kind union (`sonarjs/no-small-switch`, `@typescript-eslint/no-unnecessary-condition`).
- **Fix:** the body returns the cascade payload directly and writes `kind: presentation.kind`, which keeps `CascadePresentation.kind` read. The plan that appends the second kind introduces the switch.
- **Files modified:** extensions/pi-claude-marketplace/shared/notification-json.ts
- **Commit:** f7eefe37

**3. [Rule 1 - Bug] `wireScope` over the fallow cyclomatic limit**
- **Found during:** Task 1 (`fallow health`: cyclomatic 21 > 20)
- **Fix:** moved the `??` fallback into a private `ownScopeOr` helper.
- **Files modified:** extensions/pi-claude-marketplace/shared/notification-json.ts
- **Commit:** f7eefe37

**4. [Rule 3 - Blocking] `"x" in row` without a following `!== undefined`**
- **Found during:** Task 1
- **Issue:** under `exactOptionalPropertyTypes`, `in` narrowing removes `undefined`, so the extra comparison failed `no-unnecessary-condition`.
- **Fix:** the `in` check alone guards `details`, block `reasons`, `description`, and `partial`.
- **Commit:** f7eefe37

**5. Composition helper reuses `composeContextBlocks`**
- The plan suggested `composeMarketplaceBlock` for the presentation formatter. The shared private `composeCascadeBody` uses the existing `composeContextBlocks` (which composes identical lines), so the new helper does not clone `notify`'s cascade lines for fallow dupes. Byte output is unchanged (corpus and dispatch suite).

Otherwise the plan executed as written.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Issues Encountered

None beyond the deviations above.

## Requirements

`requirements.ready-ids` reports WIRE-09 ready and LLMT-01, WIRE-03, WIRE-04, WIRE-05, and WIRE-06 blocked, because later plans of this phase also declare them (the marketplace tool, the other payload kinds, the catalog-wide validation). Only WIRE-09 is marked complete; the other five stay pending.

## Next Phase Readiness

The cascade kind runs end to end. 04-02 adds the cascade-family presentations, the marketplace tool's wire blocks, and the `toWirePayload` switch; every task that edits `notification-wire.ts` must run `npm run schema:generate` and commit the regenerated file, and extend the kind list in `tests/scripts/generate-wire-schema.test.ts`.

## Self-Check: PASSED

---
phase: 01-foundation-and-pi-1-5-0
plan: "08"
subsystem: persistence
tags: [mcp, state-json, install-record, resolver, typebox, mrec-01]

requires:
  - phase: 01-foundation-and-pi-1-5-0 (01-03)
    provides: "domain/mcp-implementation.ts (StoredMcpCompatibility.compatibilityBasis, RecordedMcpServer) that reads the fields this plan writes"
  - phase: 01-foundation-and-pi-1-5-0 (01-04, 01-05)
    provides: "closed-set entries and SoftDepStatus.mcpImplementation, merged before this wave"
provides:
  - "McpResolution.declaredMcpServers and McpResolution.mcpBundle (domain/mcp-resolution.ts)"
  - "MaterializableFields.declaredMcpServers (required) and mcpBundle (optional literal true) on both materializable resolver arms"
  - "PluginInstallRecord optional mcpServerConfigs ({ name, config }[]), mcpBundle (true), compatibilityBasis (\"neutral\"); no schemaVersion bump"
  - "persistence/state-io.ts mcpServerConfigsOf(declared): the one producer helper (merge order, structuredClone per config)"
  - "Record writes in statePhase (install, enable, import, cascades), applyAllSuccessRecordFields (update, reinstall, apply convergence), and the disabled-plugin update (nextDisabledPin / disabledPinProjection / refreshDisabledRecord)"
  - "test/integration/mcp-server-records.test.ts: install, update, enable, disabled update, reinstall, import through the real operations"
affects: [mcp-builtin registration, recorded-servers, effective compatibility, agent grants, list/info MCP markers]

actuals:
  tokens: 22270
  tasks: 3
  commits: 2
plan_head_before: 9a32dc213f8b31dc2db7d92afe507f3559562aa5
plan_head_after: e1dbf1fe511e5ec6cc26c9c6b0861b2420de0916

tech-stack:
  added: []
  patterns:
    - "One record producer helper (mcpServerConfigsOf) shared by all three write sites, deep-copying each declared config"
    - "Disabled-pin projection takes a record-shaped Pick, so the record and the next pin project through one function"

key-files:
  created:
    - test/integration/mcp-server-records.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
    - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
    - extensions/pi-claude-marketplace/domain/resolver-types.ts
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts

key-decisions:
  - "compatibilityBasis is a top-level record field (beside compatibility), matching StoredMcpCompatibility from 01-03, and nothing writes it in this plan"
  - "mcpServerConfigsOf lives in persistence/state-io.ts beside the schema, so the three producer sites share one conversion"
  - "statePhase always writes mcpServerConfigs (an empty array for a plugin with no non-malformed server); mcpBundle only when true; the update and disabled-update writes set or delete mcpBundle"
  - "disabledPinProjection now takes a Pick of the record; its caller disabledRefreshWouldWrite changed one call line"
  - "A disabled legacy record without mcpServerConfigs projects as changed, so its next update writes the field even at an unchanged version"

patterns-established:
  - "Record fields describing the declaration are written from the resolver (declaredMcpServers), never from the mcp phase's substituted entries"

requirements-completed: [MREC-01]

coverage:
  - id: D1
    description: "The resolver exposes declaredMcpServers (every non-malformed merged server in merge order, blocked ones included, a __proto__ server kept) and mcpBundle"
    requirement: MREC-01
    verification:
      - kind: unit
        ref: "test/domain/mcp-resolution.test.ts#MREC-01 / D-CF6-01: declares supported and blocked servers in merge order, a later source keeping the first position with its config"
        status: pass
      - kind: unit
        ref: "test/domain/plugin-resolver.test.ts#MREC-01: a bundle reference makes the plugin partially available and flags the bundle"
        status: pass
    human_judgment: false
  - id: D2
    description: "The record schema accepts the three optional fields, rejects an entry without a string name or a config, and round-trips them"
    requirement: MREC-01
    verification:
      - kind: unit
        ref: "test/persistence/state-io.test.ts#validates MREC-01 a recorded MCP server without a name"
        status: pass
      - kind: unit
        ref: "test/persistence/state-io.test.ts#MREC-01: loads recorded MCP servers, the bundle flag, and the basis unchanged"
        status: pass
      - kind: other
        ref: "test/architecture/compat-01-no-expansion.test.ts (IsExact record key pin, typecheck)"
        status: pass
    human_judgment: false
  - id: D3
    description: "install, update, enable, disabled update, reinstall, and import write mcpServerConfigs in Claude form with no plugin root, data, or home path"
    requirement: MREC-01
    verification:
      - kind: integration
        ref: "test/integration/mcp-server-records.test.ts (6 cases)"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-preflight.test.ts#MREC-01: a disabled update writes a declaration-only MCP change at an unchanged version, then writes nothing"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-swap.test.ts#MREC-01: a failed swap keeps the previous MCP servers beside the intent mark"
        status: pass
    human_judgment: false
  - id: D4
    description: "list, info, and install output unchanged"
    requirement: MREC-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter (1561 scenarios passed)"
        status: pass
      - kind: other
        ref: "git diff --stat 9a32dc2..HEAD -- docs/output-catalog.md test/architecture/catalog-uat (empty)"
        status: pass
    human_judgment: false

duration: 69min
completed: 2026-11-04
status: complete
---

# Phase 1 Plan 08: Record producer Summary

**Every install record now keeps each declared, non-malformed MCP server as `{ name, config }` in D-CF6-01 merge order, before substitution, written by install, enable, import, update, reinstall, and the disabled-plugin update, with an optional bundle flag and a reserved neutral-basis field.**

## Performance

- **Duration:** about 69 min
- **Started:** about 2026-11-04T06:03Z
- **Completed:** 2026-11-04T07:12Z
- **Tasks:** 3 (two commits; Task 3 needed no further file change)
- **Files modified:** 35 (7 source, 27 test, 1 new integration test)

## Accomplishments

- `domain/mcp-resolution.ts` `recordMergedServers` builds `declaredMcpServers` with `Object.fromEntries` over every merged server and sets `mcpBundle` for a `.mcpb`/`.dxt` reference. `plugin-resolver.ts` passes both through `materializableFields`. `resolver-types.ts` adds them to `MaterializableFields`; `mcpServers` stays the adapter-supported subset (MSEL-04).
- `persistence/state-io.ts` gains `mcpServerConfigs`, `mcpBundle`, `compatibilityBasis` (optional, additive, no schemaVersion bump, each with the precedent comment shape) and `mcpServerConfigsOf`.
- `statePhase` writes `mcpServerConfigs` and `mcpBundle`; `applyAllSuccessRecordFields` writes both beside `compatibility` on the all-success arm only; the disabled-plugin update projects and writes both.
- The integration test shows that the mcp phase expanded the staged adapter entry while the record kept the literal `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and `${HOME}` strings.

## Task Commits

1. **Task 1: resolver to install record, end to end (tracer)** - `5eaf43f` (feat; test and implementation together, RED evidence below)
2. **Task 2: update, reinstall, disabled update** - `e1dbf1f` (feat; test and implementation together, RED evidence below)
3. **Task 3: whole-record pins and unchanged output** - no commit. The whole-record pins surfaced while Tasks 1 and 2 ran their suites, so they went into those commits, which keeps each commit green. The full gate then passed with no further change.

## TDD Gate Compliance

The commit hook runs the staged pairs' tests, so a RED-only commit is refused; `--no-verify` and `test.skip` are forbidden (precedent P1-DC-28). Each task commits test and implementation together. RED was captured by reverting the task's sources (patch saved to the scratch folder), running the target, and restoring:

- **Task 1 RED:** `node --test --test-reporter=tap --test-name-pattern 'MREC-01 / D-CF6-01: declares supported and blocked servers in merge order' test/domain/mcp-resolution.test.ts` exit 1; classifier `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: the target ran and failed on its `deepStrictEqual`; `declaredMcpServers` stayed `{}`. Second record: `MREC-01 / D-MB-04: records every declared server in its Claude form and leaves the resolver's configs unexpanded` (install-outcome) `RED_EVIDENCE_OK`; the record had no `mcpServerConfigs`. The sibling copy case failed with a `TypeError` on the absent resolver field, which is not a valid RED by itself.
- **Task 2 RED:** `MREC-01: a disabled update writes a declaration-only MCP change at an unchanged version, then writes nothing` (update-preflight) and `MREC-01 / D-MB-04: an all-success swap records the new version's declared MCP servers and its bundle flag` (update-swap), both `RED_EVIDENCE_OK`. `MREC-01: a failed swap keeps the previous MCP servers beside the intent mark` passed before GREEN by design: it guards the failure arm.
- **GREEN:** the same targets pass; direct coverage is 100% for all six touched sources.
- Commit scope is `mcp`, not the plan ID (project rule), so the GSD `test(01-08)` / `feat(01-08)` greps find nothing.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/mcp-resolution.ts` - `declaredMcpServers`, `mcpBundle`
- `extensions/pi-claude-marketplace/domain/plugin-resolver.ts` - empty resolution and arm passthrough
- `extensions/pi-claude-marketplace/domain/resolver-types.ts` - schema fields on the materializable arms
- `extensions/pi-claude-marketplace/persistence/state-io.ts` - record fields and `mcpServerConfigsOf`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` - `statePhase` write
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts` - `applyAllSuccessRecordFields` write
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` - `DisabledPin`, `disabledPinProjection`, `nextDisabledPin`, `refreshDisabledRecord` (and one call line in `disabledRefreshWouldWrite`)
- `test/integration/mcp-server-records.test.ts` - new
- Tests in `files_modified`: state-io, mcp-resolution, plugin-resolver, resolver-types, compat-01-no-expansion, hooks-foundation, integration-materialization-gate, commands/skills/workflows discover and stage, discover-names, install-cascade, install-flow-results, install-outcome, list-candidate-version, plugin-state-classifier, shared, update-swap, update-preflight
- **Tests outside `files_modified`** (whole-record or whole-resolution pins that test runs reported): `test/orchestrators/plugin/install-flow-ledger.test.ts`, `test/orchestrators/plugin/operations.test.ts`, `test/orchestrators/plugin/update-flow.test.ts`, `test/orchestrators/plugin/dependency-move.test.ts`, `test/orchestrators/plugin/materialize-latest.test.ts`
- **Listed but not changed** (no failing pin): `test/domain/component-paths.test.ts`, `test/bridges/workflows/types.test.ts`, `test/orchestrators/plugin/install-flow-fixture.ts`

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Whole-record pins outside `files_modified`**
- **Found during:** Tasks 1 and 2 (`test:modules`)
- **Issue:** five more test files pin a whole saved record and failed on the new `mcpServerConfigs: []`.
- **Fix:** added the expected field only; no other change.
- **Committed in:** `5eaf43f`, `e1dbf1f`

**2. [Plan shape] Task 3 produced no commit**
- The pins Task 3 owned were needed for Tasks 1 and 2 to commit green, so they went into those commits. Task 3's gate (`npm run check` in parts) passed with no further change.

**3. [Plan shape] `disabledRefreshWouldWrite` changed one call line**
- P1-DC-17 says Phase 1 touches only the three named functions. The projection's other caller had to pass the new fields. I changed the projection to take a record-shaped `Pick`, so that caller passes `preflight.record`.

---

**Total deviations:** 1 auto-fixed (blocking), 2 plan-shape notes. **Impact:** no scope creep; output unchanged.

## Issues Encountered

- The builtin cucumber profile selects 0 scenarios at this base (no scenario carries `@mcp` or `@builtin-only` yet; plans 01-09/01-10 add them). It exits 0, as 01-07 recorded.
- `Legacy marketplace migration could not be persisted ... ENOENT ... chown` sometimes reaches stderr from state-io tests. The background persist races the tmp-dir removal, and passing tests have printed it before. The new MREC-01 validation rows reuse `storedStateWithPluginKeys` (no `workflows` key), so they can print it too.

## Verification

- `npm run check` in parts on the final tree: `check:static` exit 0, `test:unpaired` exit 0, `test:integration` exit 0, cucumber `adapter` 1561/1561 passed, cucumber `builtin` exit 0 (0 scenarios), `test:coverage:direct:all` exit 0 (333 records merged).
- `test:modules` passed after the pin fixes (re-run per file for the changed files; the all-pairs coverage run executes every paired test).
- Acceptance greps: `mcpServerConfigs: Type.Optional` 1; `declaredMcpServers` in install-outcome.ts 1; `mcpServerConfigs` in update-swap.ts 2 and update-preflight.ts 9.
- `git diff --stat 9a32dc2..HEAD -- docs/output-catalog.md test/architecture/catalog-uat` prints nothing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `recordedMcpServers` (plan 01-11) can read `record.mcpServerConfigs` and `record.mcpBundle`; Phase 3's producer can write `compatibilityBasis: "neutral"` with no frozen-file change.
- REQUIREMENTS.md was not edited here (worktree mode; MREC-01 is shared with other plans, so the orchestrator's shared-ID gate owns the checkbox).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-01-17 is covered by the integration case (no plugin root, data dir, or HOME in `mcpServerConfigs`; `${...}` stays literal) and by deep copies. T-01-18 is covered by `__proto__` cases in mcp-resolution and state-io.

## Dubious Choices

- **(Medium) Test and implementation committed together per task, no RED-only commit.** Alternatives: a RED commit with `--no-verify` or `test.skip`, both forbidden. Why: the hook refuses a failing RED commit (P1-DC-28 precedent); RED evidence was captured by temporarily reverting sources and classified `RED_EVIDENCE_OK`.
- **(Low) `mcpServerConfigsOf` placed in `persistence/state-io.ts`** (frozen file, new export). Alternatives: `orchestrators/plugin/shared.ts` (not in `files_modified`), or inlining in three sites (duplication). Why: it is the record shape's own conversion and sits beside the schema; it has real production consumers, so no `ignoreExports` entry.
- **(Low) `compatibilityBasis` top level, not inside `compatibility`.** The CONTEXT amendment says "the stored compatibility gains", but RESEARCH Pattern 3 and 01-03's `StoredMcpCompatibility` put it at the top level. I followed the consumer that already exists.
- **(Low) `disabledPinProjection` signature changed to a record `Pick`**, which touches one line of `disabledRefreshWouldWrite`, outside P1-DC-17's three functions. The alternative, seven positional parameters, still changes that caller. Why: one projection for the record and the next pin.
- **(Low) A disabled legacy record (no `mcpServerConfigs`) now writes on its next update even when nothing else changed.** The alternative is to treat absence as equal to the current declaration. Why: the plan's behavior asks that it "gains it on its next update"; the write also restamps `updatedAt`.
- **(Low) Key order inside a config is part of the disabled-pin projection** (`JSON.stringify`). If a plugin reorders keys inside one server config, a disabled update writes. That write is harmless, and the record then matches the new declaration.
- **(Low) The integration import case adds `extraKnownMarketplaces` with a `directory` source `./mp-src`.** Without it the import installed nothing. The import reports the marketplace as `(skipped) {already added}` and installs the plugin.
- **(Low) The "resolver configs unchanged" proof is indirect in the integration test.** The record, written after the mcp phase, still holds the literal strings while the staged adapter entry is expanded. A direct unit check sits in install-outcome.test.ts (`resolvedDeclared` equals the raw declaration).
- **(Low) Five whole-record pin files outside `files_modified` were edited** (listed above), and three listed files needed no change.

## Self-Check: PASSED

- FOUND: test/integration/mcp-server-records.test.ts
- FOUND: 5eaf43f, e1dbf1f (ancestors of HEAD)

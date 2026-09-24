---
phase: 04-install-provenance
plan: 02
subsystem: testing
tags: [architecture-gates, compat-01, state-json, schema-migration, provenance, node-test]

# Dependency graph
requires:
  - phase: 04-install-provenance
    provides: plan 04-01's `provenance` field, the `[1, 2, 3]` schemaVersion union, `DEFAULT_STATE` at 3, and `ensurePluginProvenance`
provides:
  - "COMPAT-01 key-set pin lists `provenance`; its message records the second sanctioned growth route (required + bump + pre-validation fill, the ENBL-02 / D-04-03 precedent) beside the optional-additive one"
  - "Both schemaVersion-union pins hold exactly `[1, 2, 3]` by equality, with messages stating what the v3 migration is and why it is silent"
  - "`DEFAULT_STATE.schemaVersion` pinned at 3"
  - "`tests/persistence/state-io.test.ts` and `tests/persistence/migrate.test.ts` green at schemaVersion 3, every byte-exact expectation rebuilt by hand"
  - "`loadState` accepts 1, 2 and 3 and rejects 4, each direction its own case"
  - "Three `D-04-03` PROV-04 cases: fill-and-persist on load, present-but-invalid value rejected at its JSON pointer, multi-marketplace multi-plugin document reads explicit everywhere and replays as a fixed point"
affects: [04-03, 04-04, 04-05, 05-prune]

# Actuals (#2632) -- same chars/4 scale as the plan's estimate, measured over the realized diff
actuals:
  tokens: 8787
  tasks: 2
  commits: 2
plan_head_before: 6a23f91e6f75afe630cef8b70318c33385babc92

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate amendment by equality: a pinned enumeration grows by adding the member and rewriting the failure message to record what it now sanctions; never a subset, range or length-only check"
    - "Planted-violation proof for amended pins and new cases: each was observed red against a named wrong implementation (renamed field, reverted default, overwrite-instead-of-fill, dependency default) before commit"
    - "Byte-exact expectations rebuilt from the contract (declared field order, fills appended in fill order, schemaVersion literal), never pasted from output"

key-files:
  created: []
  modified:
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/architecture/hooks-foundation.test.ts
    - tests/persistence/state-io.test.ts
    - tests/persistence/migrate.test.ts

key-decisions:
  - "The two loadState-level PROV-04 cases (fill-and-persist; non-coercion at the pointer) live in `state-io.test.ts` because `loadState` is the public path they exercise; the multi-record no-misreport case lives in `migrate.test.ts` as a pure `migrateLegacyMarketplaceRecords` case with its fixed-point replay, matching 04-VALIDATION's test map"
  - "Validator-rejection rows in `state-io.test.ts` each gained `provenance: \"explicit\"` so they keep discriminating their named shape, and two rows were added (absent provenance; value outside the two modes) -- without the first, every row would have been rejected for the missing field rather than for the shape its title names"
  - "The `saves exact version-2 bytes` round trip moved to version 3 and the `normalizes a complete version-2 document` case was retitled `upgrades ... to version 3`; the v2-on-disk upgrade is proven by the latter and by the fixed-point case, so the save/load round trip pins the current version"
  - "`assert.deepEqual` from `node:assert/strict` (which is `deepStrictEqual`) is the file's existing spelling in `compat-01-no-expansion.test.ts`; kept as is -- `grep -c deepStrictEqual` is 0 before and after, `grep -c deepEqual` is 11 before and after"

patterns-established:
  - "D-04-08 anchoring: every new test title cites `D-04-03`; no bare requirement-family ID for this phase appears in source"

requirements-completed: [PROV-01, PROV-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The four architecture pins are amended by equality and green, each failure message recording the new precedent"
    requirement: PROV-01
    verification:
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the persisted install record holds exactly its inherited key set"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the state schema version union holds exactly its three sanctioned members"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the default state declares the current schema version"
        status: pass
      - kind: unit
        ref: "tests/architecture/hooks-foundation.test.ts#ENBL-02 / D-04-03: STATE_SCHEMA.schemaVersion is Type.Union([Literal(1), Literal(2), Literal(3)])"
        status: pass
    human_judgment: false
  - id: D2
    description: "`loadState` accepts schemaVersion 1, 2 and 3 and rejects 4 with the unsupported-version error"
    requirement: PROV-04
    verification:
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#validates schema version 3"
        status: pass
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#validates schema version 4"
        status: pass
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#rejects an unsupported stored schema version without replacing future bytes"
        status: pass
    human_judgment: false
  - id: D3
    description: "A version-2 document without provenance loads, reads explicit on every record, and is persisted as version 3 with the expected bytes"
    requirement: PROV-04
    verification:
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#D-04-03: fills an absent provenance with explicit on load and persists the upgraded document"
        status: pass
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#migrates legacy state, persists exact bytes, and replays as a fixed point"
        status: pass
    human_judgment: false
  - id: D4
    description: "A present provenance outside the two modes reaches the validator untouched and is rejected with the record's JSON pointer"
    requirement: PROV-04
    verification:
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#D-04-03: rejects a provenance outside the two modes at its pointer without coercing it"
        status: pass
    human_judgment: false
  - id: D5
    description: "A two-marketplace, two-plugin-each legacy document reads explicit on every record, none reads dependency, and a second migrate reports no mutation"
    requirement: PROV-04
    verification:
      - kind: unit
        ref: "tests/persistence/migrate.test.ts#D-04-03: reads every record of a multi-marketplace legacy document as explicit and replays as a fixed point"
        status: pass
    human_judgment: false
  - id: D6
    description: "Save/load round trip preserves every record field including a non-default provenance byte for byte; `clonePluginRecord` copies provenance"
    requirement: PROV-01
    verification:
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#round-trips resolved sha, hook entries and provenance through exact state bytes"
        status: pass
      - kind: unit
        ref: "tests/persistence/state-io.test.ts#clones every plugin field without retaining nested aliases"
        status: pass
    human_judgment: false

# Metrics
duration: 27min
completed: 2026-09-16
status: complete
---

# Phase 4 Plan 02: Schema pins and persistence contracts at schemaVersion 3 Summary

**Four architecture pins amended by equality with messages that now record the required-with-bump-and-fill precedent, and the persistence suites re-established at schemaVersion 3 with three `D-04-03` cases proving the silent upgrade, the non-coercion, and the no-misreport half of PROV-04.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-09-16T02:43:20Z
- **Completed:** 2026-09-16T03:10:41Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `compat-01-no-expansion.test.ts`: the key-set pin lists `provenance` (ten members); its message names both sanctioned growth routes and cites `D-04-03` and `ENBL-02`. The union pin holds `[1, 2, 3]` and its message states that the v3 migration IS an on-disk migration -- a required field filled with `"explicit"` before `STATE_VALIDATOR.Check` -- and why it needs no user-visible step. The default-state pin reads 3. The file header's Persistence paragraph, which narrated the retired claims, was rewritten to match. Every assertion stays an equality.
- `hooks-foundation.test.ts`: the independent union pin's title, arity (3) and membership assertions are widened; its tripwire comment now records that this is the v3 widening and names v4 as the next moment it must move.
- `state-io.test.ts` (45 cases, was 41): frozen default, ENOENT default, null-root, non-string-stamp, source-normalization, autoupdate-gate and fixed-point cases all read schemaVersion 3; the "rejects v3" row inverted to acceptance and a "rejects v4" row added; `rejects an unsupported stored schema version` now stores 4; every record literal carries `provenance`; the four validator-rejection rows each carry `provenance: "explicit"` and two rows were added (absent; outside the two modes); a type-level `@ts-expect-error` pins the closed union; the round-trip case carries `provenance: "dependency"` so a fill-to-explicit bug would fail it.
- `migrate.test.ts` (22 cases, was 21): the five moved contracts read `provenance: "explicit"` where a fill applies, `"dependency"` where a present value must survive (`preserves optional fields`), and the fixed-point replay's normalized shape is v3.
- Three new `D-04-03` cases as named in 04-VALIDATION's test map (see Coverage D3-D5).
- Both persistence pairs hold 100% run-alone coverage (`migrate.ts` 75/75 branches, 8/8 functions, 332/332 lines; `state-io.ts` 58/58, 9/9, 511/511).

## Task Commits

1. **Task 1: Amend the four architecture pins** -- `024f5ba4` (test)
2. **Task 2: Re-establish the persistence contracts at schemaVersion 3** -- `8410b066` (test)

**Plan metadata:** see the `docs(04-02)` commit that adds this file.

### TDD gate evidence (Task 2, `tdd="true"`)

The production code under test shipped in plan 04-01, so there is no GREEN `feat` commit in this plan; the RED gate was satisfied against planted wrong implementations instead, exactly as the plan's `<action>` prescribes:

- **Overwrite-instead-of-fill plant** (`if (pl.provenance === undefined)` removed, so the fill stamps every record): `node --test --test-reporter=tap tests/persistence/state-io.test.ts tests/persistence/migrate.test.ts` -> exit 1, 67 tests, 60 pass, 7 fail. Target `D-04-03: rejects a provenance outside the two modes at its pointer without coercing it` failed (the load succeeded and the `assert.ok(error instanceof Error)` fired). Also red: `leaves a present provenance untouched`, `preserves optional fields when autoupdate scrubbing is closed`, `replays a normalized marketplace as an exact fixed point`, `fills every provenance-less record across marketplaces independently`, the new multi-record case, and the provenance round trip. `gsd_run check tdd-red-evidence` -> `RED_EVIDENCE_OK`.
- **Dependency-default plant** (`pl.provenance = "dependency"`): same command -> exit 1, 67 tests, 59 pass, 8 fail. Target `D-04-03: reads every record of a multi-marketplace legacy document as explicit and replays as a fixed point` failed on its `deepStrictEqual`. Also red: the fill-and-persist load case, `normalizes a complete legacy marketplace in place`, both resource-fill cases, `fills an absent provenance with explicit before validation`, `fills every provenance-less record ...`, and the state-io fixed-point case. `check tdd-red-evidence` -> `RED_EVIDENCE_OK`.
- Both plants restored (`git diff --quiet` on `migrate.ts` clean); the pair is green at 67/67 afterwards.

### Observed-red evidence (Task 1 plants)

- **Renamed schema field** (`provenance` -> `provenanceX` in `state-io.ts`): `compat-01-no-expansion.test.ts` -> 14 tests, 13 pass, 1 fail; the key-set pin failed with `actual` containing `'provenanceX'` against `expected` `'provenance'`. Restored.
- **`DEFAULT_STATE.schemaVersion` reverted to 2**: 14 tests, 13 pass, 1 fail; the default-state pin failed with `actual: 2, expected: 3`. Restored.
- Pre-amendment baseline: both architecture files together reported 20 tests, 16 pass, 4 fail -- exactly the four pins research predicted and nothing else.

## Files Created/Modified

- `tests/architecture/compat-01-no-expansion.test.ts` -- three pins amended, header Persistence paragraph rewritten
- `tests/architecture/hooks-foundation.test.ts` -- the independent union pin widened to three members
- `tests/persistence/state-io.test.ts` -- 19 moved cases, 3 new validator rows, 2 new `D-04-03` cases, a `stateJsonPersisted` watch helper for the new persist case
- `tests/persistence/migrate.test.ts` -- 5 moved cases, 1 new `D-04-03` case

## Decisions Made

- The fill-and-persist case waits on the fire-and-forget `persistMigratedState` through a small `stateJsonPersisted(t, extensionRoot)` helper rather than a third inline copy of the watcher loop. The two existing inline copies were left untouched (surgical scope).
- The retitled cases (`the state schema version union holds exactly its three sanctioned members`, `the default state declares the current schema version`, `upgrades a complete version-2 document to version 3 ...`, `saves exact version-3 bytes ...`, `round-trips resolved sha, hook entries and provenance ...`) had titles that asserted the retired claim; nothing outside the two files references those titles (grepped `extensions tests scripts docs .planning/codebase`).

## Deviations from Plan

None in the code -- the plan executed as written. Process notes:

- The plan's acceptance criterion reads `grep -c 'deepStrictEqual'` on `compat-01-no-expansion.test.ts`; that file spells the strict assertion `assert.deepEqual` via `node:assert/strict`, so the count is 0 before and after. The equivalent `deepEqual` count is 11 before and after; no assertion changed form.
- The `npm-coverage-direct` pre-commit hook fails on the Task 2 commit for the planned reason: with `--base HEAD` it also runs `install-outcome.test.ts`, whose fixtures still lack `provenance` (plan 04-03's sweep). Both persistence pairs named by this plan pass at 100% inside that same hook run. `npm-typecheck` fails only on `tests/` diagnostics outside this plan's files (62 remaining, down from 71), and TruffleHog fails environmentally on the worktree's `.git` file. Every other hook is green; prettier re-wrapped one `assert.equal` in `hooks-foundation.test.ts`, which was re-staged before committing.
- No git pre-commit hook is installed in this checkout, so `pre-commit run --files` was run by hand before each commit.

## Issues Encountered

None.

## Known state after this plan (for 04-03)

- **`npm test`: 830 failures out of 6374 tests** (315 suites), down from the research probe's 861. Zero are in the four files this plan owns. By stack-frame census (approximate, each failure contributes two frames): `orchestrators/plugin/update-flow` ~257, `orchestrators/plugin/uninstall` ~84, `orchestrators/plugin/info` ~70, `orchestrators/plugin/list-flow` ~54, `edge/handlers/plugin/list` ~52, `edge/handlers/plugin/uninstall` ~51, `edge/handlers/plugin/reinstall` ~41, `edge/handlers/plugin/update` ~33, `edge/handlers/plugin/enable-disable` ~27, `orchestrators/marketplace/update` ~23, `orchestrators/reconcile/backfill` ~22, `orchestrators/reconcile/apply` ~20, `edge/handlers/tools` ~20, `orchestrators/plugin/update-preflight` ~18, `orchestrators/edge-deps` ~18, `orchestrators/marketplace/remove` ~16, `orchestrators/plugin/install-cascade` ~14, then a long tail (`shared`, `marketplace/update` handler, `reinstall-targets`, `install-flow`, `marketplace/add`, `reinstall-flow`, `clone-gc`, `with-state-guard` 6, `autoupdate`, `install-outcome`, `bootstrap`, `plugin-path`, `register`, `event-router`, `update-swap`, `enable-disable`, `pending`, `index`) -- 35 files in all.
- `./node_modules/.bin/tsc --noEmit`: 62 diagnostics, all under `tests/` (`event-router`, `tools`, `migrate-config`, and the integration suites among them); `extensions/` is clean.
- `migrate.ts` remains at fallow's inclusive cognitive ceiling (04-01's note stands); this plan touched no production file.

## PROV-04's flagged planner assumption

The plan carries the unresolved assumption that `loadState` is the only reader of an on-disk state document, so the pre-validation fill is the complete answer. While working I did not encounter a second reader, and no defensive second fill was added anywhere, as the plan instructs. The assumption was not independently re-probed here; the verifier should treat it as still open.

## Threat register notes

- **T-04-02 (mitigated):** the non-coercion case (Coverage D4) proves a present-but-invalid value reaches the validator and is rejected at `/marketplaces/catalog/plugins/plugin/provenance: must be equal to constant`, with the stored bytes untouched.
- **T-04-06 (mitigated):** every amended pin is still an equality assertion (`assert.deepEqual`/`assert.equal` under `node:assert/strict`, plus the arity `assert.equal(anyOf.length, 3)`), and each rewritten message records what it now sanctions.

## Next Phase Readiness

- Plan 04-03 starts from a measured 830-failure `npm test` and a 62-diagnostic `tsc`, none of either in `tests/architecture/{compat-01-no-expansion,hooks-foundation}.test.ts` or `tests/persistence/{state-io,migrate}.test.ts`.
- The two new validator-rejection rows and the closed-union `@ts-expect-error` mean a future third provenance mode lands in `state-io.test.ts` deliberately, beside the schema.

---
*Phase: 04-install-provenance*
*Completed: 2026-09-16*

## Self-Check: PASSED

- `[ -f ]` on all 4 modified files: FOUND
- Commits `024f5ba4`, `8410b066` present in `git log`: FOUND
- `commits: 2` measured from `plan_head_before` `6a23f91e..HEAD`

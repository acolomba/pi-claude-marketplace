---
phase: 04-install-provenance
plan: 03
subsystem: testing
tags: [fixture-sweep, provenance, state-json, schema-migration, node-test, direct-coverage, install-cascade]

# Dependency graph
requires:
  - phase: 04-install-provenance
    provides: plan 04-01's required `provenance` field at schemaVersion 3 and plan 04-02's amended pins and persistence contracts
provides:
  - "`npm run check` exits 0 for the first time since plan 04-01's tracer: typecheck, lint, both workflow linters, fallow, prettier, both corresponding-test gates, the direct-coverage negative gate, the unit suite (6377/6377) and the integration suite (32/32)"
  - "Every per-file install-record builder under `tests/` carries `provenance`, defaulting to `\"explicit\"`; the builders that take options (`marketplace-seed.ts`, `update-flow`, `update-preflight`, `uninstall`, `reconcile/plan`) expose a `provenance` option for the dependency value"
  - "`D-04-01: a direct install stays a direct install when a later plugin declares it` -- a whole-record `deepStrictEqual` against a `clonePluginRecord` snapshot, observed red against a three-site plant"
  - "The `install-flow.ts` direct-coverage pair reads 100/100/100 run-alone again (two covering cases); the `install-outcome.ts` pin records the D-04-01 statePhase write"
affects: [04-04, 04-05, 05-prune]

# Actuals (#2632) -- same chars/4 scale as the plan's estimate, measured over the realized diff
actuals:
  tokens: 23907
  tasks: 3
  commits: 3
plan_head_before: 33347a6f8b8d4b44661eb97207ff39f8d4d4f468

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Builder-first fixture sweep: give each file's shared record builder the field with the direct-install default, then read what is still red as a contract and rebuild its expectation from the contract rather than from output"
    - "Loaded-state expectations pin `schemaVersion: 3` because `loadState` normalizes every document to the current version; a seed behind a byte-comparison proof is written at the current version so the proof measures the verb's own writes"
    - "Planted-violation proof for a requirement satisfied by an absence of code: relax every guard between the cascade and the record until the case goes red, record which guards had to fall, restore byte for byte"

key-files:
  created: []
  modified:
    - tests/edge/handlers/marketplace-seed.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - tests/orchestrators/reconcile/plan.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/orchestrators/reconcile/backfill.test.ts
    - tests/orchestrators/marketplace/remove.test.ts
    - tests/transaction/with-state-guard.test.ts
    - scripts/test-coverage-direct.pin.json

key-decisions:
  - "Builders that already take an options bag or a trailing parameter gained a `provenance` option; bare record literals and zero-argument builders gained only the field. An unused option on every literal would have been speculative, and the one builder plan 04-04 needs (`reconcile/plan.test.ts`'s `pluginRecord`) has it"
  - "Loaded-state expectations moved to `schemaVersion: 3`; the seeds that feed a byte-equality retry proof (`install-flow` `seedPathMarketplaceWithPlugin`, `uninstall` retry seed) and the whole-state builders reused as expectations (`remove`, `backfill`, `apply`) are written at 3 so a byte comparison measures the verb's own writes rather than the load's normalization. Seeds that only feed a `loadState` read stay at 2 and still exercise the silent upgrade"
  - "The `plugin-path` and `tools` unsupported-version plants moved from 3 to 4: 3 is now a supported version, so the plant had stopped planting anything"
  - "The `install-flow.ts` direct-coverage gap was closed with two covering cases rather than pinned: both arms are reachable, and a pin is for arms that are not"

patterns-established:
  - "D-04-08 anchoring: the new test titles cite `D-04-01`, `RESV-01`, `DFEN-04` and `PI-5`/`PI-15`; no bare requirement-family ID for this phase appears in source"

requirements-completed: [PROV-01, PROV-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The whole gate is green: `npm run check` exits 0, `npm test` and `npm run test:integration` both report `fail 0`"
    requirement: PROV-01
    verification:
      - kind: other
        ref: "npm run check -> exit 0 (typecheck, lint, lint:workflows, lint:workflows:negative, fallow, format:check, test:corresponding, test:corresponding:negative, test:coverage:direct:negative, test 6377/6377, test:integration 32/32)"
        status: pass
      - kind: other
        ref: "SKIP=trufflehog pre-commit run --all-files -> exit 0, 31 hooks passed, nothing rewritten"
        status: pass
    human_judgment: false
  - id: D2
    description: "A plugin the user installed directly keeps its ENTIRE record byte-identical after a later install declares it as a dependency"
    requirement: PROV-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#D-04-01: a direct install stays a direct install when a later plugin declares it"
        status: pass
      - kind: other
        ref: "gsd_run check tdd-red-evidence scratchpad/red-evidence-d0401.json -> RED_EVIDENCE_OK against the three-site plant (updatedAt moved); git diff --quiet -- extensions/ -> 0 after restore"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every install-record fixture in the suite carries `provenance` with the direct-install default, and no builder defaults to the dependency value"
    requirement: PROV-01
    verification:
      - kind: other
        ref: "grep -n provenance over the 36 plan files plus marketplace-seed.ts: five builders default `\"explicit\"` with an option; 44 + 18 inline literals carry `provenance: \"explicit\"`; no `\"dependency\"` default"
        status: pass
    human_judgment: false
  - id: D4
    description: "No strict-equality assertion was weakened: 1584 `deepStrictEqual` lines before, 1592 after (the 8 added by the three new cases); `deepEqual` 284 before and after; `strictEqual` 500 before, 502 after (2 added)"
    requirement: PROV-01
    verification:
      - kind: other
        ref: "grep -c over the plan's 36 files before Task 1 and after Task 3"
        status: pass
    human_judgment: false

# Metrics
duration: 1h 8m
completed: 2026-09-16
status: complete
---

# Phase 4 Plan 03: Fixture sweep and the PROV-02 whole-record proof Summary

**830 unit failures and 9 integration failures driven to zero without weakening an assertion, `npm run check` green end to end for the first time since the tracer, and a `D-04-01` whole-record ratchet case observed red against a plant that had to relax three guards before a cascade could reach a direct install's record.**

## Performance

- **Duration:** 1h 8m
- **Started:** 2026-09-16T03:15:51Z
- **Completed:** 2026-09-16T04:23:51Z
- **Tasks:** 3
- **Files modified:** 44 (43 under `tests/`, plus `scripts/test-coverage-direct.pin.json`)

## Measured before / after

| Suite | Before (this plan's baseline) | After |
|---|---|---|
| `node --test "tests/orchestrators/**/*.test.ts"` | 2275 tests, 1613 pass, **662 fail** | 2275 tests, 2275 pass, 0 fail (before Task 3; 2278 after) |
| `node --test "tests/{edge,transaction,bridges}/**/*.test.ts" "tests/index.test.ts"` | 1841 tests, 1673 pass, **168 fail** | 1841 pass, 0 fail |
| `npm test` (whole unit glob) | 6374 tests, **830 fail** (04-02's measured handoff) | 6377 tests, 6377 pass, 0 fail |
| `npm run test:integration` -- **the count research never measured** | 32 tests, 23 pass, **9 fail**, every one the `saveState refused: ... must have required properties provenance` refusal across four files (`hooks-dispatch-end-to-end` 4, `hooks-spawn-end-to-end` 2, `hooks-additionalcontext-end-to-end` 2, `hooks-cross-scope-reconcile` 1) | 32 pass, 0 fail |
| `./node_modules/.bin/tsc --noEmit` | 62 diagnostics, all under `tests/` | 0 |
| `npm run check` | red | **exit 0** |

Failure classes at the baseline, by message: orchestrators 617 `saveState` refusals + 42 `deepStrictEqual` + 2 `strictEqual` + 1 byte-equality; task-2 glob 159 refusals + 9 `deepStrictEqual`. After the builder pass alone the orchestrators glob read 78 failures, all assertion diffs -- the contracts.

## Accomplishments

- **Builders first.** `tests/edge/handlers/marketplace-seed.ts`'s `buildInstalledPluginRecord` (the builder behind every edge-handler suite and `register.test.ts`) and the per-file builders in `update-flow`, `update-preflight`, `uninstall` and `reconcile/plan` gained `provenance` with an `"explicit"` default and an option for `"dependency"`. Forty-four inline record literals across the plan's files, and eighteen more in files the plan did not list (below), gained `provenance: "explicit"` in the schema's declared position beside `enabled`. `update-flow.test.ts`'s 276 failures collapsed on that one builder edit, as the research predicted.
- **Contracts second.** Every remaining red was an expectation whose contract moved, and each was rewritten from the contract; see the enumeration below.
- **The PROV-02 proof** (Task 3) and the finding it produced about how many guards protect the record.
- **Two coverage cases** that return the `install-flow.ts` pair to 100/100/100 run-alone, and the `install-outcome.ts` pin amended for the D-04-01 statePhase write.

## Task Commits

1. **Task 1: Sweep the orchestrator suites** -- `06e7c5e4` (test), 24 files
2. **Task 2: Sweep the edge, transaction, bridge and entry suites; close the integration suite and the gate** -- `23762476` (test), 20 files
3. **Task 3: PROV-02's whole-record proof** -- `8c80ced3` (test), 1 file

**Plan metadata:** see the `docs(04-03)` commit that adds this file.

### TDD gate evidence (Task 3, `tdd="true"`)

PROV-02 is satisfied by an absence of production code, so there is no GREEN `feat` commit; the RED gate was satisfied against a planted violation, as the plan prescribes.

- **Green against the current tree** (expected): `node --test --test-name-pattern "D-04-01" tests/orchestrators/plugin/install-flow.test.ts` -> 3 tests, 3 pass.
- **Plant 1 -- the closure partition alone** (`domain/dependency-closure.ts:269`, `!isRoot && installedKeys.has(edge.key)` given a never-true third conjunct): the case stayed **green**. The re-entered member is refused by the ledger's PI-5 `already-installed` entry check in `install-outcome.ts`; the cascade fails (`⊘ hello (failed) {dependency failed}` / `cause: Plugin "some-other-plugin" is already installed in marketplace "mp"`) and the direct record is never reached.
- **Plant 2 -- partition + PI-5** (the entry check at `install-outcome.ts:421` also relaxed): still **green**. statePhase's own PI-15 commit refusal fires: `cause: Plugin "some-other-plugin" was installed concurrently in marketplace "mp"`.
- **Plant 3 -- partition + PI-5 + PI-15** (`install-outcome.ts:930` relaxed as well): **red**. `node --test --test-reporter=tap --test-name-pattern "D-04-01" tests/orchestrators/plugin/install-flow.test.ts` -> exit 1, 3 tests, 2 pass, 1 fail:

  ```text
  not ok 3 - D-04-01: a direct install stays a direct install when a later plugin declares it
    failureType: 'testCodeFailure'
    error: |-
      Expected values to be strictly deep-equal:
      + actual - expected
      ... Skipped lines
        {
          compatibility: { installable: true, notes: [], supported: [ ...
      +   updatedAt: '2026-09-16T04:01:15.351Z',
      -   updatedAt: '2026-09-16T04:01:15.327Z',
          version: '0.0.1'
        }
    code: 'ERR_ASSERTION'
    operator: 'deepStrictEqual'
  ```

  `provenance` still read `"explicit"` in the actual record, because statePhase carries `existing?.provenance` through -- which is exactly why a provenance-only assertion would have passed this plant, and why the case compares the whole record. `gsd_run check tdd-red-evidence` -> `RED_EVIDENCE_OK` (target test failed on its assertion).
- **Restored:** both planted files were checked out byte for byte; `git diff --quiet -- extensions/` -> 0; `tests/domain/dependency-closure.test.ts` 25/25; the three `D-04-01` cases 3/3; `install-flow` + `install-outcome` pairs 174/174.

**Finding for the verifier (the plan's flagged assumption, sharpened):** the plan assumed relaxing the closure partition alone would turn the case red. It does not. A direct install's record sits behind THREE independent guards -- the RESV-05 closure partition, the PI-5 entry refusal, and the PI-15 state-commit refusal -- and all three had to fall before the cascade re-ran the ledger over the record. The flagged assumption about paths ("RESV-05's already-installed branch is the ONLY path on which an existing record meets a cascade") was not contradicted: with the partition relaxed the member does re-enter the closure and reach the ledger, but the ledger refuses it twice more. PROV-02 is over-guarded, not under-covered.

## Every expected OUTPUT that moved, with its reason

All of them are one contract: `loadState` normalizes every document to `schemaVersion: 3` (D-04-03), and `DEFAULT_STATE` / the ENOENT default are 3. No record field, row byte, config byte or reconcile outcome moved anywhere in the sweep.

| File | Moved | What |
|---|---|---|
| `tests/orchestrators/reconcile/apply.test.ts` | 47 | `seeded`/`seedState` literals typed `ExtensionState` that double as the loaded-state expectation, plus the two direct `deepStrictEqual` expectations at RECON-04; one `2 as const` seed |
| `tests/orchestrators/reconcile/backfill.test.ts` | 34 | same shape: `seeded`/`snapshot`/`stored` literals reused as expectations, plus seven direct `loadState` expectations |
| `tests/orchestrators/marketplace/remove.test.ts` | 21 | twenty `loadState` expectations (including the two inside the invalidation-order callbacks, whose earlier throw was what dropped `'plugins'` from the events list) and the `seededState` builder that three cases compare a loaded state against |
| `tests/transaction/with-state-guard.test.ts` | 9 | the six byte-literal / parsed-document cases: three literal strings (`saved-by-transaction`, `saved-once`, `retry-committed`) and three parsed expectations (`memory-only`, `automatic-save`, the retry read after `failed-save`); each keeps its own stamp so no two collapse |
| `tests/orchestrators/marketplace/add.test.ts` | 8 | eight `loadState` expectations; the v2 `combinedStateAndManifest` seed at 1282 stays v2 (input) |
| `tests/orchestrators/marketplace/update.test.ts` | 6 | six `loadState` / `expectedState` expectations; the v2 replacement-document input at 3413 stays v2 |
| `tests/orchestrators/plugin/bootstrap.test.ts` | 4 | four `loadState` expectations; the v2 seed stays |
| `tests/orchestrators/plugin/uninstall.test.ts` | 4 | two `loadState` expectations (422, 2492), their seed (2422), and the retry-proof seed (4386) -- the last because the proof compares `state.json` bytes before and after a failed attempt, and a v2 seed made the failed attempt's re-serialization at 3 read as a mutation |
| `tests/edge/register.test.ts` | 2 | two `loadState` expectations |
| `tests/orchestrators/plugin/install-flow.test.ts` | 1 | `seedPathMarketplaceWithPlugin`'s state literal, for the same retry-proof reason as `uninstall` |
| `tests/index.test.ts` | 1 | the `expectedState` parsed off disk |
| `tests/orchestrators/plugin-path.test.ts`, `tests/edge/handlers/tools.test.ts` | 1 each | the "unsupported schema version" plant moved 3 -> 4; three `plugin-path` cases and one `tools` case exist to prove the unsupported-version read failure is reported, and 3 no longer plants one |

Two things worth stating plainly for the three groups the plan singled out:

- `add.test.ts` (9) and `remove.test.ts` (11 behavioral + 11 fixture): every moved value is the document's `schemaVersion`; the persisted marketplace and plugin shapes those cases pin did not move.
- `backfill.test.ts` (7) / `apply.test.ts` (6): the reconcile OUTCOMES (rows, buckets, stamps, `lastReconciledExtensionVersion`) did not move; only the loaded document's version.
- `shared.test.ts` (3): its config-write bytes did not move at all; its seven failures were fixture refusals and it needed only the builder edit.

## Strict-equality census (T-04-07)

Over the plan's 36 files: `deepStrictEqual` 1584 lines before -> 1592 after; `deepEqual` 284 -> 284; `strictEqual` 500 -> 502. Every increase is a line the three new Task 3 cases added; nothing was converted to a partial or subset comparison, no case was deleted, no case was skipped.

## Files Created/Modified

- `tests/edge/handlers/marketplace-seed.ts` -- `provenance` option on `SeededRecordInput`, `"explicit"` default in `buildInstalledPluginRecord` (the builder behind six edge suites)
- `tests/orchestrators/plugin/update-flow.test.ts`, `update-preflight.test.ts`, `uninstall.test.ts`, `tests/orchestrators/reconcile/plan.test.ts` -- builder field + option (`plan.test.ts`: the builder only, as the plan requires; no case or assertion touched)
- `tests/orchestrators/plugin/install-flow.test.ts` -- seed builder and one whole-record expectation; three new cases (Task 3)
- 21 further orchestrator suites, 8 edge/transaction/bridge/entry suites, 5 integration suites, 6 files outside the plan's list -- inline `provenance: "explicit"` and the `schemaVersion` moves enumerated above
- `scripts/test-coverage-direct.pin.json` -- `install-outcome.ts` reading 111/113, 1061/1067 -> 114/116, 1075/1081 with a leading reason naming the D-04-01 statePhase write (three covered branches, fourteen lines, same one-branch six-line deficit), following the `071d7ff1` precedent

## Decisions Made

See `key-decisions` in the frontmatter. One more: for `with-state-guard.test.ts`'s injected-`loadState` stubs that return `{ schemaVersion: 2, marketplaces: {} }`, the stubs stay at 2 -- they are inputs to transaction mechanics, and the `saveLog` expectation that echoes them (`expectedAttemptedState`) correctly stays at 2 too; only the retry read through the real `loadState` moved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Files outside the plan's `files_modified` needed the field**
- **Found during:** Task 1 (edge suites had no record builder of their own) and Task 2 (`tsc` diagnostics)
- **Issue:** `tests/edge/handlers/marketplace-seed.ts` is the shared builder for six of the plan's edge files; and eleven files the plan did not list carried compile-only fixture diagnostics (`tests/integration/{hooks-additionalcontext-end-to-end,hooks-cross-scope-reconcile,hooks-dispatch-end-to-end,hooks-spawn-end-to-end,reconcile-plan-convergence}.test.ts`, `tests/orchestrators/import/execute.test.ts`, `tests/orchestrators/marketplace/shared.test.ts`, `tests/orchestrators/plugin/{install-disable-cascade,list-installed-row,reinstall-record}.test.ts`, `tests/persistence/migrate-config.test.ts`). `npm run check`'s typecheck link cannot pass without them.
- **Fix:** the same field insertion; all test-only.
- **Committed in:** `23762476`

**2. [Rule 3 - Blocking] The `install-outcome.ts` direct-coverage pin had to move**
- **Found during:** Task 2's pre-commit run (`npm-coverage-direct`)
- **Issue:** plan 04-01's statePhase write grew the module by three branches and fourteen lines; the pin records the measurement and the hook refuses a reading that drifted in either direction. The hook had been red for the fixture reason on every 04-01/04-02 commit, so this is the first commit that could see it.
- **Fix:** reading moved to 114/116, 1075/1081 with a reason paragraph, exactly the `071d7ff1` shape.
- **Committed in:** `23762476`

**3. [Rule 2 - Missing Critical] The `install-flow.ts` pair had a pre-existing direct-coverage shortfall the hook had never measured**
- **Found during:** Task 3's pre-commit run (the pair is measured only when its test file is in the change set)
- **Issue:** `3a4311ac` (a Phase 3 review fix) split the post-save cache-and-rebuild block into two `try/catch`es; the only case that mocks `rebuildRoutingTables` to throw lands disabled and never reaches the rebuild, so `hydrateInstalledHooks`'s rebuild `catch` (lines 376-377) has had no covering case since. A second uncovered branch, `writeOrchestratedDeclarations`'s `landedDisabled` arm (line 455, an orchestrated cascade whose root lands disabled), likewise had none. Both arms are reachable, so a pin would have been dishonest; measured with HEAD's test file the pair read 139/141 before any Task 3 edit.
- **Fix:** two cases -- `RESV-01: a post-save routing rebuild failure leaves the install recorded with its hooks on disk` and `RESV-01 / DFEN-04: an orchestrated cascade whose root lands disabled declares the dependency and the disabled root in one config write`. The pair reads 100/100/100 run-alone.
- **Note for plan 04-05:** the second case asserts the config declaration of a cascade dependency, the write D-04-02 retires. It joins the research § 4d list of cases 04-05 must invert or delete; its outcome and record assertions survive, its `declared.config.plugins` expectation becomes `{ "hello@mp": { enabled: false } }`.
- **Committed in:** `8c80ced3`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing-critical). **Impact:** all test-only or measurement-record changes; no production file was touched by this plan (`git diff --stat 33347a6f..HEAD -- extensions/` is empty).

## Issues Encountered

- The plan's plant for PROV-02 (relax the closure partition) does not produce a red on its own; see the TDD evidence above. Recorded as a finding, not a defect.
- The baseline run showed a one-off `pending.test.ts` failure with a `state.json.<pid>` temp file in a tree listing: its `stateBytes` fixture claims "every field the migrator would otherwise fill is present, so the load performs no migration", which stopped being true once `provenance` was required, and the fire-and-forget `persistMigratedState` write raced the listing. The fixture edit restores the claim; five consecutive runs are green.
- No git pre-commit hook is installed in this checkout; `pre-commit run --files` was run by hand before each of the three commits and `pre-commit run --all-files` (exit 0, 31 hooks passed, TruffleHog skipped for the worktree `.git`-file reason) before this one.

## Known state after this plan (for 04-04 / 04-05)

- `npm run check` exits 0 on `8c80ced3`. `npm test`: 6377 tests, 0 fail. Integration: 32, 0 fail. `tsc`: 0 diagnostics.
- `tests/orchestrators/reconcile/plan.test.ts`'s `pluginRecord` builder carries `provenance?: PluginRecord["provenance"]` in its options bag, defaulting `"explicit"`; no case in that file was added or amended.
- Seeds that still write `schemaVersion: 2` are inputs to `loadState` reads and exercise the silent upgrade on every run; none feeds a byte comparison.

## Threat register notes

- **T-04-07 (mitigated):** the census above; no `deepStrictEqual` weakened, no case deleted or skipped.
- **T-04-08 (mitigated):** the case was observed red against a named plant, with the red output quoted, and `git diff --stat -- extensions/` is empty after restore. The plant needed three sites, which is recorded above rather than smoothed over.

## Next Phase Readiness

- Plan 04-04 (the `buildUninstallBucket` exemption, D-04-05) can proceed on a green tree with the `plan.test.ts` builder option in place.
- Plan 04-05 (D-04-02, retire the config write) inherits one more config-declaration case to invert (`RESV-01 / DFEN-04`, above) beside the three the research already lists.

---
*Phase: 04-install-provenance*
*Completed: 2026-09-16*

## Self-Check: PASSED

- `[ -f ]` on all 44 modified files: FOUND
- Commits `06e7c5e4`, `23762476`, `8c80ced3` present in `git log`: FOUND
- `commits: 3` measured from `plan_head_before` `33347a6f..HEAD`

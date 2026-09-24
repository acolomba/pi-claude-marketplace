---
phase: 04-install-provenance
plan: 01
subsystem: persistence
tags: [typebox, state-json, schema-migration, install-cascade, provenance]

# Dependency graph
requires:
  - phase: 03-dependency-resolution
    provides: the install cascade (`runInstallCascade`, `ledgerOptionsFor`, `rootKey`) that decides per member whether it is the root
provides:
  - "`PLUGIN_INSTALL_RECORD_SCHEMA.provenance` -- required two-literal union `\"explicit\" | \"dependency\"` (D-04-01)"
  - "`STATE_SCHEMA.schemaVersion` widened to `[1, 2, 3]`; `DEFAULT_STATE`, the ENOENT default and both normalized-rebuild arms write 3; `loadState` rejects 4 (D-04-03)"
  - "`InstallLedgerOptions.provenance` and `buildInstallLedgerOptions`'s `core.provenance`, decided per cascade member from `member.key === rootKey`"
  - "statePhase writes `existing?.provenance ?? opts.provenance ?? \"explicit\"`, so the enable branch preserves a kept record's value"
  - "`clonePluginRecord` and `recordReinstalledOutcome` carry the field across snapshot and reinstall"
  - "`persistence/migrate.ts::ensurePluginProvenance` -- silent `\"explicit\"` back-fill run before `STATE_VALIDATOR.Check`"
affects: [04-02, 04-03, 04-04, 04-05, 05-prune, reconcile, uninstall --prune]

# Actuals (#2632) -- same chars/4 scale as the plan's estimate, measured over the realized diff
actuals:
  tokens: 6197
  tasks: 3
  commits: 4
plan_head_before: 500b195efb694cecbb13b8546612c36c1a272ab0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Required-field-with-bump: a new REQUIRED record field ships with a schemaVersion bump and a silent truthful migrate fill (the `enabled` / ENBL-02 precedent), never as `Type.Optional` (the `resolvedSha` / `hookEntries` precedent)"
    - "Per-member ledger option decided at the single `ledgerOptionsFor` seam from the `rootKey` comparison already in scope; no second pass over the closure"
    - "Extracted `ensure*` fill helper keeps `migrateLegacyMarketplaceRecords` at fallow's inclusive cognitive ceiling"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/persistence/migrate.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/persistence/migrate.test.ts

key-decisions:
  - "Task 1 checkpoint answered `proceed-as-decided`: D-04-03 stays locked -- required `provenance` at schemaVersion 3 with a silent `\"explicit\"` back-fill, exactly the `enabled` / ENBL-02 precedent"
  - "The two literal field values are `\"explicit\"` and `\"dependency\"`, spelled inline as `Type.Union([Type.Literal(\"explicit\"), Type.Literal(\"dependency\")])` beside `enabled`, matching `MARKETPLACE_RECORD_SCHEMA.scope`'s inline two-literal shape"
  - "statePhase's third fallback is the literal `\"explicit\"`: a ledger run that reaches the record write with neither an existing record nor a cascade decision is a plugin the caller named"
  - "`ensurePluginProvenance` is a structural twin of `ensurePluginEnabled` rather than a shared parameterized helper; the plan's measured complexity budget was taken against exactly this shape and fallow's duplication gate stays under its 3% threshold"

patterns-established:
  - "D-04-08 anchoring: every comment and test title written here cites `D-04-01` / `D-04-03` or an existing in-tree anchor; no bare requirement-family ID for this phase appears in source"

requirements-completed: [PROV-01, PROV-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A cascade install records its root as \"explicit\" and its dependency as \"dependency\", and the persisted document declares schemaVersion 3"
    requirement: PROV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#D-04-01: a cascade records its root as explicit and its dependency as a dependency"
        status: pass
    human_judgment: false
  - id: D2
    description: "A plugin declaring no dependencies records its single member as \"explicit\"; the install's rendered block is unchanged (the existing PI-9 / OUT-04 row cases still pass)"
    requirement: PROV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#D-04-01: a plugin declaring no dependencies records its single member as explicit"
        status: pass
    human_judgment: false
  - id: D3
    description: "`clonePluginRecord`, `recordReinstalledOutcome` and the enable branch carry an existing record's provenance through unchanged"
    requirement: PROV-01
    verification:
      - kind: other
        ref: "./node_modules/.bin/tsc --noEmit | grep '^extensions/' | wc -l -> 0 (the required key makes an omission at either write site a TS2741)"
        status: pass
    human_judgment: true
    rationale: "The compiler proves the field is written at every enumerating site; the behavioral cases for clone and reinstall live in the paired test files that plan 04-03 sweeps, so the value-preservation half is not yet asserted by a test of its own"
  - id: D4
    description: "A schemaVersion 1 or 2 document whose records lack provenance loads, fills \"explicit\" silently, and is persisted as schemaVersion 3; a present value, including one the schema rejects, is never coerced"
    requirement: PROV-04
    verification:
      - kind: unit
        ref: "tests/persistence/migrate.test.ts#D-04-03: fills an absent provenance with explicit before validation"
        status: pass
      - kind: unit
        ref: "tests/persistence/migrate.test.ts#D-04-03: leaves a present provenance untouched, including one the schema rejects"
        status: pass
      - kind: unit
        ref: "tests/persistence/migrate.test.ts#D-04-03: fills every provenance-less record across marketplaces independently"
        status: pass
    human_judgment: false
  - id: D5
    description: "A record carrying a rejected provenance value still reaches STATE_VALIDATOR.Check and loadState throws naming the record's JSON pointer; schemaVersion 4 is still rejected"
    requirement: PROV-04
    verification:
      - kind: other
        ref: "throwaway loadState probe (scratchpad probe-load.mts): `/marketplaces/mp/plugins/a/provenance: must be equal to constant`; v4 -> `unsupported schema version`; v2 -> loaded and persisted as 3 with zero console.warn calls"
        status: pass
    human_judgment: true
    rationale: "Proven by an ad-hoc probe, not a committed test; the state-io.test.ts cases that pin these load paths are amended by plan 04-02 / 04-03"

# Metrics
duration: 37min
completed: 2026-09-16
status: complete
---

# Phase 4 Plan 01: Install provenance field Summary

**Required `provenance: "explicit" | "dependency"` on every install record at schemaVersion 3, decided per cascade member from `member.key === rootKey`, carried across clone and reinstall, and back-filled `"explicit"` silently for every earlier document.**

## Performance

- **Duration:** 37 min
- **Started:** 2026-09-16T01:59:51Z
- **Completed:** 2026-09-16T02:36:28Z
- **Tasks:** 3 (Task 1 was a pre-answered decision checkpoint)
- **Files modified:** 7

## Checkpoint answer (Task 1)

**`proceed-as-decided`.** D-04-03 stays locked: `provenance` is REQUIRED at schemaVersion 3, an absent value is back-filled `"explicit"` silently, and the upgrade is one-way -- exactly the `enabled` / ENBL-02 precedent. The `optional-additive-instead` shape was declined because absence would then be indistinguishable from "no answer yet", which is what `--prune` and reconcile's dependency exemption cannot tolerate.

## The two literal values

`"explicit"` and `"dependency"`, declared inline on `PLUGIN_INSTALL_RECORD_SCHEMA`:

```ts
provenance: Type.Union([Type.Literal("explicit"), Type.Literal("dependency")]),
```

## Post-change fallow score for `migrateLegacyMarketplaceRecords`

**18 cyclomatic / 15 cognitive** (`fallow health --complexity`), against ceilings of 20 / 15 -- exactly on the inclusive cognitive ceiling, as the research probe predicted. `ensurePluginProvenance` itself measures 9 / 8. `npm run fallow` exits 0. Any further conditional inside that loop breaks the gate; ESLint reads the same function far below its threshold and will not warn.

## Accomplishments

- `state-io.ts`: the field on the record schema beside `enabled`, the `D-04-01 / D-04-03` header paragraph, `schemaVersion` widened to `[1, 2, 3]` with its doc comment amended, `DEFAULT_STATE` / ENOENT default / both normalized-rebuild arms at 3, the `loadState` guard accepting 3 and rejecting 4, and `clonePluginRecord` enumerating the field.
- `install-outcome.ts`: optional `provenance` on `InstallLedgerOptions`; statePhase writes `existing?.provenance ?? opts.provenance ?? "explicit"`, so the enable branch (which hand-builds its options with `allowExistingRecord` and never names the field) preserves a kept record's value.
- `install-flow.ts`: `buildInstallLedgerOptions` threads `core.provenance` with the same conditional-spread idiom as `sourcePin`; `ledgerOptionsFor` decides `isRoot ? "explicit" : "dependency"` from the comparison already computed for `pinVersion` -- no second pass over the closure, no name-keyed lookup.
- `reinstall-record.ts`: `provenance: input.oldRecord.provenance` beside the `installedAt` carry-forward.
- `migrate.ts`: `ensurePluginProvenance`, called once from the per-marketplace loop after `ensurePluginEnabled`; module header and per-behavior doc bullet amended, with the non-self-healing over-fill caveat stated plainly.
- Two `D-04-01` end-to-end cases (cascade root + dependency; no-dependency plugin) read the raw `state.json` back off disk; three `D-04-03` fill cases in `migrate.test.ts` leave the file's five existing byte-exact contracts for plan 04-02.

## Task Commits

Each task followed RED -> GREEN; no REFACTOR commit was needed.

1. **Task 1: Confirm the schemaVersion bump** -- decision only, no commit (`proceed-as-decided`)
2. **Task 2: One cascade install end to end** -- `c0325d9e` (test, RED) -> `3ced00ec` (feat, GREEN)
3. **Task 3: The silent back-fill** -- `fa7d61f1` (test, RED) -> `b713edcc` (feat, GREEN)

**Plan metadata:** see the `docs(04-01)` commit that adds this file.

### TDD gate evidence

- Task 2 RED: `gsd_run check tdd-red-evidence` -> `RED_EVIDENCE_OK` (target `D-04-01: a cascade records its root as explicit and its dependency as a dependency` failed on the `provenance` / `schemaVersion` assertion; exit 1, 2 tests, 0 pass, 2 fail).
- Task 3 RED: `RED_EVIDENCE_OK` (target `D-04-03: fills an absent provenance with explicit before validation` failed on the missing `provenance: "explicit"`; exit 1, 3 tests, 1 pass, 2 fail). The one case green before the fill -- "leaves a present provenance untouched" -- is the negative control: it fails only against a fill that coerces, which is the violation it exists to catch.

## Files Created/Modified

- `extensions/pi-claude-marketplace/persistence/state-io.ts` -- record schema field, `schemaVersion` union and every write literal at 3, `loadState` guard, `clonePluginRecord`
- `extensions/pi-claude-marketplace/persistence/migrate.ts` -- `ensurePluginProvenance` + call site + docs
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` -- `InstallLedgerOptions.provenance`, statePhase write
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` -- `core.provenance` threading, per-member decision
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts` -- carry-forward
- `tests/orchestrators/plugin/install-flow.test.ts` -- `readPersistedProvenance` helper + two `D-04-01` cases
- `tests/persistence/migrate.test.ts` -- three `D-04-03` cases

## Decisions Made

- The statePhase expression carries a third fallback (`?? "explicit"`) as the plan specifies, so a direct `runInstallLedger` caller that supplies neither an existing record nor a cascade decision still writes a valid record. Every production path supplies one of the two.
- `ensurePluginProvenance` was kept as a structural twin of `ensurePluginEnabled` rather than folded into a shared parameterized helper. Fallow now reports a 17-line clone family between the two, but the duplication gate is percentage-based (1.3% against a 3% threshold) and `npm run fallow` is green; the plan measured the complexity budget against this exact shape, and refactoring `ensurePluginEnabled` is outside this plan's surgical scope.

## Deviations from Plan

None in the code -- the plan executed as written. Two process notes on the deliberately red tree:

- The `npm-coverage-direct` pre-commit hook (which the plan's hook enumeration did not name) fails on every commit of this plan for the reason the plan predicts: it runs the changed pairs' suites, and those suites carry fixtures without `provenance` (`saveState refused: ... must have required property 'provenance'`), byte-exact v2 expectations, and "rejects v3" pins. For the RED commits it additionally fails on the RED test itself, which is the TDD contract. Every other hook is green except `npm-typecheck` (71 diagnostics, all under `tests/`, the sanctioned planned state) and TruffleHog, which cannot open a linked worktree's `.git` file (environmental; CLAUDE.md sanctions `SKIP=trufflehog` in worktrees).
- No git pre-commit hook is installed in this checkout, so `pre-commit run --files` was run by hand before each of the four commits; prettier re-wrapped one line in `install-flow.ts`, which was re-staged before committing.

## Issues Encountered

None.

## Known state after this plan (for 04-02 / 04-03)

- `./node_modules/.bin/tsc --noEmit | grep '^extensions/'` -> 0. `npm run typecheck` as a whole -> 71 diagnostics, all under `tests/`.
- The four paired suites run together (`install-flow`, `state-io`, `install-outcome`, `reinstall-record`) report 32 failures out of 218, all in the predicted classes; `migrate.test.ts` reports exactly its five existing behavioral contracts red (the 04-02 sweep). `npm test` as a whole is expected red until 04-03.
- Fallow's clone report now lists `migrate.ts:166-182` / `205-221` (`ensurePluginEnabled` / `ensurePluginProvenance`) as a family; under threshold, informational.

## Threat register notes

- **T-04-01 (accepted):** a hand-edited `provenance` value is the user's own state. A forged value cannot cause a deletion because prune re-derives need from live manifests (D-04-01).
- **T-04-02 (mitigated):** the closed two-literal union rejects any other string at load with a JSON pointer (`/marketplaces/mp/plugins/a/provenance: must be equal to constant`), confirmed by probe.
- **T-04-05 (mitigated):** the fill writes only through `persistMigratedState` and touches only an absent key.
- **Dev-tree mislabel (carried to Phase 5 UAT):** dependency records that Phase 3 wrote on development trees before this field existed are back-filled `"explicit"`. `--prune` will decline to prune those specific plugins on the operator's machine; the remedy is uninstall + reinstall, not a `--prune` change.

## Next Phase Readiness

- Plan 04-02 (architecture pins + the five `migrate.test.ts` byte contracts) and plan 04-03 (the fixture sweep that turns `npm test` green) can proceed; the field exists and is written at every production site.
- `migrateLegacyMarketplaceRecords` has zero cognitive headroom under fallow: any later change to that loop must extract, not inline.

---
*Phase: 04-install-provenance*
*Completed: 2026-09-16*

## Self-Check: PASSED

- `[ -f ]` on all 7 modified files: FOUND
- Commits `c0325d9e`, `3ced00ec`, `fa7d61f1`, `b713edcc` present in `git log`: FOUND
- `commits: 4` measured from `plan_head_before` `500b195e..HEAD`

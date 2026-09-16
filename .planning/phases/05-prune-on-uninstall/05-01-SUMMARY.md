---
phase: 05-prune-on-uninstall
plan: 01
subsystem: orchestrators
tags: [uninstall, dependencies, reconcile, closed-set, catalog, prune-05]

# Dependency graph
requires:
  - phase: 03-dependency-resolution
    provides: readDependencyDeclaration (offline declaration read), dependency-closure key fill rule, parseDeclaredDependencies
  - phase: 04-install-provenance
    provides: the ten-surface closed-set amendment procedure (04-06), provenance field on records
provides:
  - "`findDependents` over a `DeclarationIndex` parameter in `domain/dependency-orphans.ts` (pure)"
  - "`buildScopeDeclarationIndex` in `orchestrators/plugin/dependency-index.ts`: offline, fail-closed, one state document, every record indexed whatever `enabled`/`provenance`"
  - "`UninstallRefusedError` + module-private `assertNoDependents` guard inside uninstall's locked closure, rendered through the existing failure channel"
  - "`dependents remain` closed-set member with all ten pinning surfaces"
  - "Catalog states `refused-dependents-remain`, `refused-declarer-unreadable`, `reconcile-uninstall-refused-dependents`"
  - "`PluginUninstallFailedOutcome.cause?: Error` + reconcile projection cause child (D-05-16)"
  - "`NETWORK_FREE_TARGETS` pins for `uninstall.ts` and `dependency-index.ts`"
affects: [05-02 (prune sweep reuses the index the guard returns), 05-03 (docs name the remedy)]

# Actuals (#2632) -- estimateTokens scale (chars/4 over the realized diff), not a harness count.
actuals:
  tokens: 22349
  tasks: 3
  commits: 2
plan_head_before: cf01963edada79caef76a12387c5f3747688aeac

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard-as-throw inside the locked transaction: a refusal is a typed error thrown from the closure and rendered by the existing catch/emit channel, so the state guard's no-throw-no-save contract is what makes 'nothing removed' true and the orchestrator gains no condition"
    - "Fail-closed declaration walk: the first record whose declarations cannot be established ends the index build with the declarer's read-failure token and a cause naming the declarer"
    - "Narrow the producer's type to the guarantee it enforces (`DeclarationLookupResult`) rather than carrying an unreachable arm the 100%-direct-coverage gate would reject"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/dependency-orphans.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
    - tests/domain/dependency-orphans.test.ts
    - tests/orchestrators/plugin/dependency-index.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
    - extensions/pi-claude-marketplace/domain/dependency-closure.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - docs/output-catalog.md
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/uninstall.messaging.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/orchestrators/reconcile/notify.test.ts
    - tests/shared/notification-types.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/gate-targets.ts
    - tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts
    - tests/architecture/catalog-uat/fixtures/reconcile-applied.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts

key-decisions:
  - "The refusal is a typed `UninstallRefusedError` thrown INSIDE the lock closure and rendered through the existing catch -> `emitCascadeFailure` channel; `uninstallPluginWithTransaction` gained no condition (fallow 15/14 before and after, ESLint 12)"
  - "`readDependencyDeclaration` / `toClosureLookupResult` are typed `DeclarationLookupResult` (= `ClosureLookupResult` minus `absent`), because the read can never produce `absent` and the direct-coverage gate rejects an unreachable arm"
  - "`findDependents` sorts with `localeCompare`, the comparator every other rendered name list in the extension uses (`sonarjs/no-alphabetical-sort` forbids the bare default sort)"
  - "The reconcile cause spread lives in a `failedRowCause` helper so `applyPluginOutcomeToBlock` stays at 14/5 (the inline `&&` chain measured 16/6 against the plan's 15/6 bound)"
  - "`UninstallRefusedError` rode the unowned-export census pin for exactly one commit (Tasks 1+2) and left it in Task 3 when `apply.ts` became its production consumer, so every commit kept the census green"

patterns-established:
  - "Two-record uninstall fixtures need a real manifest listing both records: the guard reads the sibling's declarations, so a nonexistent `manifestPath` now fails closed as `{source missing}`"

requirements-completed: [PRUNE-05]

coverage:
  - id: D1
    description: "uninstall X is refused while any other installed record in the scope declares X; nothing removed; row names the dependents sorted on the cause line (D-05-14 / D-05-15)"
    requirement: PRUNE-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#D-05-14: uninstall is refused while one installed plugin declares the target"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#D-05-15: two dependents are named on the cause line in sorted key order"
        status: pass
    human_judgment: false
  - id: D2
    description: "a DISABLED declarer holds; a declarer only in the other scope is not consulted (D-05-04 / D-05-05)"
    requirement: PRUNE-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#D-05-04: a DISABLED installed plugin still holds the target"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#D-05-05: a declarer installed only in the OTHER scope is not consulted"
        status: pass
    human_judgment: false
  - id: D3
    description: "an unreadable declarer refuses rather than risks, with the declarer's token in the brace and a cause naming it (D-05-07)"
    requirement: PRUNE-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#D-05-07: a record its marketplace manifest does not list refuses the uninstall"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/dependency-index.test.ts#D-05-07: the first unreadable record wins over a later one"
        status: pass
    human_judgment: false
  - id: D4
    description: "the reconcile path refuses the same way, reports the same cause-bearing row on every pass, and converges once the dependent is gone (D-05-16)"
    requirement: PRUNE-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#D-05-16: a config-driven uninstall of a still-declared plugin is refused on every pass and converges once the dependent is gone"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#D-05-16: carries the refusal cause on a plugin-uninstall-failed row that names one"
        status: pass
    human_judgment: false
  - id: D5
    description: "`dependents remain` landed with all ten pinning surfaces; three catalog states pinned with renderer-produced bytes"
    requirement: PRUNE-05
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 20 fixture modules to 209 exact documented states"
        status: pass
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: REASONS is the closed 55-entry reason set"
        status: pass
    human_judgment: false

# Metrics
duration: 47min
completed: 2026-09-16
status: complete
---

# Phase 05 Plan 01: Dependents guard on uninstall Summary

**`uninstall X` is refused on both entry points while any installed record in the scope still declares X, naming the dependents on the cause line and removing nothing; the `dependents remain` member landed with all ten pinning surfaces and three catalog states.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-09-16T21:55:06Z
- **Completed:** 2026-09-16T22:42:45Z
- **Tasks:** 3
- **Files modified:** 26 (4 created)

## Accomplishments

- The tracer path works end to end: a pure `findDependents`, an offline fail-closed `buildScopeDeclarationIndex` leaf, a typed `UninstallRefusedError` thrown inside uninstall's locked closure and rendered by the existing failure channel, the closed-set member, and the reconcile cause line.
- A refused uninstall leaves `state.json` bytes and mtime untouched and the data directory intact (asserted); the orchestrated arm returns `{ status: "failed", reason: "dependents remain", error, cause }` and emits nothing.
- The reconcile pass reports the identical cause-bearing row on two consecutive passes, then removes both plugins in one pass once the config drops the dependent, and the pass after that is silent. The pinned RECON-03 `{permission denied}` rows are byte-unchanged.
- Every gate is green: typecheck, ESLint, fallow (dead-code / health / dupes), Prettier, corresponding-tests, direct coverage (100% on every changed production file), 6426 unit tests, 32 integration tests.

## Task Commits

1. **Task 1 + Task 2: guard, vocabulary, ten surfaces, two catalog states** - `2c3b5c09` (feat)
2. **Task 3: reconcile refusal row carries its cause** - `af0a8467` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/dependency-orphans.ts` - `DeclarationIndex` type and `findDependents`; import-free.
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts` - `buildScopeDeclarationIndex` over one state document via `loadMarketplaceManifest` -> `lookupDeclaredPlugin` -> `readDependencyDeclaration`; stops at the first unreadable record; cause lines redact paths and chain no cause.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` - `UninstallRefusedError`, `assertNoDependents` (called after `removedVersion = installed.version`, before the cascade), first arm of `narrowCascadeFailure`, header/catch/emit doc amendments.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts` - `UninstallPrivateReason` pin.
- `extensions/pi-claude-marketplace/domain/dependency-closure.ts` / `dependency-declaration-read.ts` - `DeclarationLookupResult` narrowing (see Deviations).
- `extensions/pi-claude-marketplace/shared/notification-types.ts` / `notify-reasons.ts` - tail member, partition home, `54 to 55` ledger.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/{apply-outcomes,apply,notify}.ts` - `cause?: Error` on the uninstall-failed outcome, `instanceof UninstallRefusedError` spread, `failedRowCause` projection helper.
- `docs/output-catalog.md` - intro sentence, `refused-dependents-remain`, `refused-declarer-unreadable`, `reconcile-uninstall-refused-dependents`.
- `tests/architecture/gate-targets.ts` - `NETWORK_FREE_TARGETS` gains `uninstall.ts` and `dependency-index.ts`; the "implicitly clean, not gated" exemption bullet is gone.

## Measured gate

**Fixtures that needed a manifest once the guard landed (the research's A1 said one; measured two):**

1. `uninstall.test.ts` "uninstalling one of two plugins sharing a git clone leaves the clone until the last referencer is gone" - fixed by making `seedGitPlugin` write `<cwd>/marketplace.json` listing every seeded plugin.
2. `uninstall.test.ts` "retry proof: uninstall: a hooks refusal on a shared clone retries without reclaiming the surviving clone" - a hand-seeded two-record state; a manifest listing `alpha` and `beta` was written at its recorded `manifestPath`. It surfaced as `{source missing}` with `cause: cannot read the dependencies of beta@mp: ENOENT ... open 'marketplace.json'` (path already redacted).

No integration fixture needed a manifest (32/32 pass untouched).

**Complexity (fallow cyclomatic/cognitive), before -> after:**

| Function | Before | After |
|---|---|---|
| `uninstallPluginWithTransaction` | 15/14 (ESLint 12) | 15/14 (ESLint 12) |
| its lock closure | 6/5 | 6/5 |
| `narrowCascadeFailure` | 7/5 | 8/6 |
| `assertNoDependents` (new) | - | 3/2 |
| `applyPluginOutcomeToBlock` | 14/5 | 14/5 |
| `failedRowCause` (new) | - | 3/2 |
| `applyPluginUninstalls` | 6/9 | 7/10 |
| `buildScopeDeclarationIndex` (new) | - | 5/9 |
| `readRecordDeclarations` (new) | - | 6/5 |
| `findDependents` (new) | - | 3/3 |

**Catalog constants:** `EXPECTED_STATE_COUNT` 206 -> 208 (Task 2) -> 209 (Task 3); `EXPECTED_UTF8_BYTES` 27_385 -> 27_717 -> 27_873 (recomputed from the fenced blocks after mdformat ran); parser tuple count 206 -> 209; `catalog-state:` anchors 211 -> 214; `REASONS.length` 54 -> 55. Both fenced blocks and the reconcile block were produced by driving `notify()` over the fixture through the contract test's `makeCtx` boundary and pasting the captured output.

**The omission plant:** deleting the `refused-dependents-remain` fixture made the contract test fail with `207 !== 208`; the fixture was restored byte-identical (sha256 prefix `942c68e32ae0fc91` before and after).

## TDD Gate Compliance

`workflow.tdd_mode` is `false` for this project; the RED/GREEN discipline was applied per task and the evidence recorded rather than committed as separate `test(05-01)` commits, because this repo's pre-commit `npm-typecheck` hook rejects a RED commit that does not type-check (the plan states this procedure).

- **RED 1 (closed-set pins):** after appending `dependents remain` to `REASONS` and its partition home, `node --test tests/shared/notification-types.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/architecture/notify-closed-set-locks.test.ts` exited 1 with 3/23 failing: `COMPAT-01` enumeration, `OUT-08 ... 55 !== 54`, and the notification-types vocabulary export pin. `gsd_run check tdd-red-evidence` -> `RED_EVIDENCE_OK` (`target_test_failed`).
- **RED 2 (the guard):** with `UninstallRefusedError` declared but the guard not wired, `node --test --test-name-pattern "D-05-1[45]|D-05-0[457]" tests/orchestrators/plugin/uninstall.test.ts` exited 1 with 5/6 failing (the uninstall succeeded and rendered the `(uninstalled)` row); `D-05-05` passed as expected (other-scope declarer is never consulted). `tdd-red-evidence` -> `RED_EVIDENCE_OK`.
- **RED 3 (reconcile cause):** `node --test --test-name-pattern "D-05-16" tests/orchestrators/reconcile/{apply,notify}.test.ts` exited 1 with 2/3 failing, the diff being exactly the missing `    cause: required by keeper@mp` line. `tdd-red-evidence` reported `INVALID_RED / no_target_test_failure` because the checker reads only the top-level TAP names (`applyReconcile`, `buildReconcileAppliedCascade` -- the `describe` wrappers), not the nested subtest names; the raw TAP shows the target subtest failing. Recorded as a tool limitation, not an evidence gap.
- **GREEN:** `2c3b5c09` and `af0a8467` (both `feat(05-01)`); all named suites pass after each.
- **REFACTOR:** none as a separate commit; the `failedRowCause` extraction happened before Task 3's commit to hold the complexity bound.

## Decisions Made

- The refusal is a throw inside the lock closure (A-4); no escape flag, no post-guard `if` -- measured, not assumed.
- The D-05-07 unreadable-declarer refusal renders on the named plugin's row with the declarer's token in the brace and `cannot read the dependencies of <key>: <detail>` on the cause line (A-1); catalogued as `refused-declarer-unreadable`.
- The reconcile cause is spread ONLY for `plugin-uninstall-failed` with an `UninstallRefusedError` (A-5); the projection gate lives in `failedRowCause`.
- `findDependents` uses `localeCompare` (house comparator; lint forbids the bare default sort). Keys are `[A-Za-z0-9._-]`+`@`, so the only observable difference from code-point order is case handling, which is deterministic either way.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `readDependencyDeclaration` typed with an unreachable `absent` arm**
- **Found during:** Task 1 (the leaf's `readDependencyDeclaration` call)
- **Issue:** `ClosureLookupResult` carries `absent`, which the read can never produce (it starts from an entry already in hand). Handling it in the leaf would add a branch no test can reach, and the direct-coverage gate requires 100% branches on every changed production file (the only alternative is a D-116-01a pin row for an arm that should not exist).
- **Fix:** added `DeclarationLookupResult = Exclude<ClosureLookupResult, { kind: "absent" }>` in `domain/dependency-closure.ts` and typed `toClosureLookupResult` and `readDependencyDeclaration` with it. Callers that return `ClosureLookupResult` are unaffected (subtype); `dependency-declaration-read.test.ts`'s `satisfies ClosureLookupResult` pin still holds.
- **Files modified:** `domain/dependency-closure.ts`, `orchestrators/plugin/dependency-declaration-read.ts`
- **Verification:** typecheck, both paired suites 100% direct coverage, `manifest-read-agreement` gate green
- **Committed in:** `2c3b5c09`

**2. [Rule 3 - Blocking] `UninstallRefusedError` had no production consumer until Task 3**
- **Found during:** Task 1 verify (`unowned-exports-census.test.ts` named the export)
- **Issue:** the class is exported for Task 3's `instanceof`, so at the Task 1+2 commit its only readers were tests and the census gate failed.
- **Fix:** recorded it in `UNOWNED_EXPORT_CENSUS` for that one commit with a comment naming the consumer to come, and removed the row in Task 3's commit when `apply.ts` imported it. Every commit kept the census green.
- **Files modified:** `tests/architecture/gate-targets.ts`
- **Committed in:** `2c3b5c09` (added), `af0a8467` (removed)

**3. [Rule 1 - Bug] `dependency-index.ts` direct coverage 22/23 branches**
- **Found during:** Task 1 verify (`test:coverage:direct:commit`)
- **Issue:** every case injected both seams, so the production `?? loadMarketplaceManifest` / omitted-`reader` fallbacks were never taken.
- **Fix:** one real-disk case (`D-05-06: with no seams injected ...`) that writes a manifest tree under `mkdtemp` and omits both seams.
- **Committed in:** `2c3b5c09`

**4. [Rule 1 - Bug] `applyPluginOutcomeToBlock` measured 16/6 against the plan's 15/6 bound**
- **Found during:** Task 3 verify
- **Fix:** the inline `&&` chain moved into `failedRowCause`; the function is back at 14/5.
- **Committed in:** `af0a8467`

---

**Total deviations:** 4 auto-fixed (2 Rule 3, 2 Rule 1)
**Impact on plan:** All four are gate-driven corrections inside the plan's own scope; no behavior differs from the plan's `<behavior>` lists.

## Issues Encountered

- The first expectation I wrote for the D-05-16 reconcile row used the plural header (`Some operations have failed.`); the grammar renders `A plugin operation has failed.` for a single plugin failure (precedent at `apply.test.ts:1618`). Corrected the expectation before the RED run was recorded; the RED-differentiating assertion was always the cause line.
- `sonarjs/no-alphabetical-sort` rejects the bare `.sort()` the plan's wording suggested; switched to the house `localeCompare` comparator (see Decisions).

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-05-03 (TOCTOU) is mitigated as designed: the index is built from `tx.state` inside `withLockedStateTransaction`; T-05-04 (cause-line disclosure): the load-throw arm's message is `redactAbsolutePaths(errorMessage(err))` with no `{ cause }` chaining (asserted by `T-05-04: the load-failure cause line redacts the absolute path and chains no cause`); T-05-05: `uninstall.ts` and the leaf contain no `path.join` of their own (grep `0`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05-02 (the `--prune` sweep) can consume the index `assertNoDependents` returns; `findDependents` and `buildScopeDeclarationIndex` are in place and the removal path is intact.
- Plan 05-03 must document the A-2 scenario: two records that are both absent from their marketplace manifests refuse each other's uninstall until one is repaired (`marketplace update`) or removed (`marketplace remove`); the phase UAT carries it.
- The `UninstallPrivateReason` pin is `_ReasonInSet<"dependents remain">`; 05-02 widens it with `dependency pruned`.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/domain/dependency-orphans.ts` FOUND
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts` FOUND
- `tests/domain/dependency-orphans.test.ts` FOUND
- `tests/orchestrators/plugin/dependency-index.test.ts` FOUND
- commit `2c3b5c09` FOUND
- commit `af0a8467` FOUND

---
*Phase: 05-prune-on-uninstall*
*Completed: 2026-09-16*

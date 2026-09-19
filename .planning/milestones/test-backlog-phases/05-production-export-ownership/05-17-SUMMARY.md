---
phase: 05-production-export-ownership
plan: "17"
subsystem: testing
tags: [composition, dependency-injection, orchestrators, reinstall, backfill, fallow]

requires:
  - phase: 05-production-export-ownership
    provides: "05-15 operations.ts, the shared plugin production-composition owner"
  - phase: 05-production-export-ownership
    provides: "05-16 the enable and uninstall compositions plus the imported-binding precedent"
  - phase: 05-production-export-ownership
    provides: "05-02 reinstall-flow's semantic factory and its injected ReinstallTransaction contract"
  - phase: 05-production-export-ownership
    provides: "05-19 the privatized reinstall replacement steps that make REAL_REINSTALL_TRANSACTION an indivisible binding"
provides:
  - "createReinstallOperation(hooksRouting, completionCache), the single production composition of single-plugin reinstall"
  - "createReinstallPlugin is now production-consumed, so it leaves the production finding census"
  - "createNodeReinstallPlugin is module-private with a TS2578-discriminating missing-export proof"
affects: [05-18, 05-20, 05-21, 05-28]

actuals:
  tokens: 6171
  tasks: 2
  commits: 2
  plan_head_before: fbf59c2cc762e8e0e186e3bda4c18cd5e5f44b58

tech-stack:
  added: []
  patterns:
    - "A composition owner imports a bound transaction object whenever any member is a private step of the bound module's own algorithm; it rebuilds the binding only when every member is externally owned"
    - "Privatizing an export is proved by the missing-export idiom `void ({} satisfies { readonly retired?: typeof Barrel.member })`, measured to yield TS2578 when the export returns"

key-files:
  created:
    - .planning/tdd-evidence/05-17-01.json
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
    - tests/orchestrators/plugin/operations.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/integration/transaction-lifecycle-cascade.test.ts

key-decisions:
  - "The plan's task order already yields a compiling intermediate, so both tasks kept separate atomic commits with no reordering and no merge."
  - "Reinstall's concrete binding is imported, not rebuilt in operations.ts: five of REAL_REINSTALL_TRANSACTION's six members are private steps of reinstall's own replace schedule, four of them privatized by 05-19."
  - "The RED gate for task 2 is a compiler control, not a runtime one: the missing-export proof yields TS2578 while the export is public and passes once it is private, which is the same measurement that discriminates restoration."
  - "One weak assertion was retired with the export it named; the factory-ownership case now names the two factories the module actually publishes."

patterns-established:
  - "Composition-owner test shape extended to four operations: one construction-purity case each, plus one end-to-end case per operation that runs the concrete bindings."
  - "A privatization control is run twice against the same proof -- once before the change (natural RED) and once by restoring the export (discrimination) -- so the proof is never merely present."

requirements-completed: [EXPORT-01]

coverage:
  - id: D1
    description: "operations.ts composes the single-plugin reinstall operation from the real replace transaction, and the load-time backfill scan asks for it"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/operations.test.ts#reinstallPlugin replaces the staged artifacts in place and re-routes the plugin"
        status: pass
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/operations.test.ts tests/orchestrators/reconcile/backfill.test.ts (36/36 pass)"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts (branches 7/7, functions 6/6, lines 116/116)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Constructing the reinstall operation starts no asynchronous work and touches neither injected owner"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/operations.test.ts#constructs the reinstall operation without using its owners or starting asynchronous work"
        status: pass
    human_judgment: false
  - id: D3
    description: "createNodeReinstallPlugin is module-private; the bulk factory is its only consumer and the owner suite drives the public semantic factory with the real transaction"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/reinstall-flow.test.ts (121/121 pass)"
        status: pass
      - kind: other
        ref: "npm run typecheck exit 0 with the missing-export proof in place; re-exporting the wrapper yields tests/orchestrators/plugin/reinstall-flow.test.ts(116,1): error TS2578"
        status: pass
      - kind: other
        ref: "grep -rn createNodeReinstallPlugin over extensions tests scripts eslint.config.js .fallowrc.json package.json sonar-project.properties -> only reinstall-flow.ts (declaration + its one in-file call) and the proof lines"
        status: pass
    human_judgment: false
  - id: D4
    description: "The two outside single-reinstall convenience call sites now ask the composition owner, with every lifecycle owner and assertion unchanged"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/enable-disable.test.ts tests/integration/transaction-lifecycle-cascade.test.ts (67/67 pass)"
        status: pass
      - kind: integration
        ref: "npm run test:integration (32/32, exit 0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "createReinstallPlugin leaves the production finding census with exactly one removal and zero additions"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/architecture/unowned-exports-census.test.ts#The complete production finding census equals its committed identities (red by design: 1 removal, 0 additions, parent-owned pin)"
        status: fail
    human_judgment: true
    rationale: "The census equality gates are red by design until the parent applies its single Wave 8 pin edit; every task in this plan forbids editing tests/architecture/gate-targets.ts. The parent must confirm the reviewed delta on the stable wave snapshot."

duration: 25 min
completed: 2026-09-14
status: complete
---

# Phase 5 Plan 17: Reinstall Composition Owner Summary

**`orchestrators/plugin/operations.ts` now owns the production composition of single-plugin reinstall alongside install, enable/disable and uninstall; the load-time backfill scan asks for it, the single-plugin `createNode*` wrapper is module-private behind a TS2578-discriminating proof, and `createReinstallPlugin` leaves the production finding census as a genuinely consumed semantic factory.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-15T00:05:00Z
- **Completed:** 2026-09-15T00:30:00Z
- **Tasks:** 2
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- Added `createReinstallOperation(hooksRouting, completionCache)` to the plugin composition owner, binding `createReinstallPlugin` to the real `REAL_REINSTALL_TRANSACTION` and the caller's routing and completion-cache owners.
- Pointed `orchestrators/reconcile/backfill.ts`'s `scanForceInstalledBackfills` at the composed operation, which is the real production consumer the plan asked for. That is the only production caller of single-plugin reinstall; the bulk `createNodeReinstallPlugins` contract at `edge/register.ts` is untouched.
- Made `createNodeReinstallPlugin` module-private. `createNodeReinstallPlugins` remains its only consumer, and a missing-export proof in the owner suite yields TS2578 if the export returns.
- Migrated the two outside single-reinstall convenience call sites — the enable/disable owner suite's local reinstall helper and the lifecycle cascade integration test — onto the composed operation, with identical lifecycle owners.
- Migrated the reinstall owner suite's seven call sites onto the public semantic factory with the real transaction stated explicitly at each site, so the injected contract is visible where the concrete adapter is the promise.
- Added two cases to the composition owner: a construction-purity case and an end-to-end case that runs the bound prepare/replace/finalize schedule and the real state lock.

## Task Commits

1. **Task 1: Compose backfill reinstall through the semantic factory** — `5ac7e4fe` (feat)
2. **Task 2: Keep bulk composition internal and preserve reinstall behavior** — `e7fe8c47` (refactor)

**Plan metadata:** see the final `docs:` commit.

_Both tasks kept separate atomic commits in the plan's stated order; see Decisions._

## Census Identity Delta (for the parent's Wave 8 reconciliation)

This is this plan's contribution only. Plan 05-27 contributes its own.

**Removed (1):**

| Census | Exact identity string |
| --- | --- |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts\|createReinstallPlugin` |
| `UNOWNED_EXPORT_CENSUS` | key `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts`, member `createReinstallPlugin` — the key's only member, so the whole key goes |

**Added (0):** none.

**Evidence of the disposition.** `createReinstallPlugin` is no longer unowned because `operations.ts` imports and calls it in production. `createReinstallOperation` is not a new finding because `orchestrators/reconcile/backfill.ts` imports it in production. `REAL_REINSTALL_TRANSACTION` was already exported and already production-consumed by `reinstall-flow.ts`; `operations.ts` is now a second production importer, so it neither enters nor leaves the census. `createNodeReinstallPlugin` was never in the census (it had a production caller through `backfill.ts`) so its privatization removes nothing from it, and as a non-export it cannot add anything either.

The measured gate output reads, verbatim:

```
now unowned but not pinned (0): none
pinned but no longer unowned (1): extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts#createReinstallPlugin
```

Live production census length moves 14 -> 13. No sibling writer ran concurrently (the whole wave is serialized), but the parent must still re-measure on the stable wave snapshot before editing the pin.

**The other identity in my owner set is untouched.** `unused_exports|extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts|scanForceInstalledBackfills` is still pinned and still live, exactly as before. This plan changed one import line and one construction call inside `backfill.ts` and touched neither that export's visibility nor its callers; its disposition belongs to 05-20.

## Lock Re-entrancy Proof

`proper-lockfile` is `retries: 0` and not re-entrant, so this plan proved rather than assumed that no second `withLockedStateTransaction` was introduced.

1. **No guard was added or rewrapped.** `createReinstallOperation` passes `REAL_REINSTALL_TRANSACTION` through unchanged — the same object `createNodeReinstallPlugin` passed — so the number and placement of guards inside the reinstall path is byte-for-byte the schedule that was already there. `grep -n withLockedStateTransaction` over `operations.ts` returns one import, one member in `INSTALL_TRANSACTION`, one comment and one member in `ENABLE_DISABLE_TRANSACTION`; the reinstall composition names none of its own.
2. **The backfill call site holds no outer lock.** `applyBackfillForScope`'s own header records the constraint (CR-01): the scan runs as a sibling inside `applyReconcile`'s per-scope apply region with no outer lock, and the stamp `withStateGuard` takes its own lock afterwards. Swapping which factory produces `reinstallPlugin` does not move that call site.
3. **A nested guard would be observable, and is not observed.** With `retries: 0`, a second acquisition on the same scope's lock raises `ELOCKED` and surfaces as `StateLockHeldError`. All 36 cases across the operations owner and the backfill owner pass against real locks, as do the composition owner's own end-to-end reinstall case and the 32-case integration suite.

## Assertion Ledger

### `tests/orchestrators/plugin/operations.test.ts` (added: 2 cases, 12 assertion calls)

Nothing was removed from this file. The additions are:

| Case | Assertions |
| --- | --- |
| constructs the reinstall operation without using its owners or starting asynchronous work | the returned value is a function; the `async_hooks` init census over the construction window is exactly `[]`; the two expectation-free `strong-mock` owners verify |
| reinstallPlugin replaces the staged artifacts in place and re-routes the plugin | the complete public outcome `{ partition: "reinstalled", name: "p1", marketplace: "mp", scope: "project", version: "0.0.1", resourcesChanged: false, stagedAgentNames: [], stagedMcpServerNames: [], declaresAgents: false, declaresMcp: false }`; the **whole** persisted record, pinning that D-68-02 leaves `version` and the complete `resources` inventory alone through a replacement; the complete replaced `hooks.json` bytes, written as an independent literal; the routing bucket's exact length, `pluginId` and replaced `command`; one pre-condition assertion |

Timestamps are made deterministic with `t.mock.timers.enable({ apis: ["Date"] })` rather than read back out of the record under assertion, so `installedAt` and `updatedAt` are genuinely pinned.

### `tests/orchestrators/plugin/reinstall-flow.test.ts`

**One assertion retired, with the export it named.** The case `owns direct and bulk plugin reinstall factories` asserted `typeof` on three factories: `injected` (`createReinstallPlugin` + the real transaction), `direct` (`createNodeReinstallPlugin`) and `bulk` (`createNodeReinstallPlugins`). With the wrapper private, `direct` has no public identity to assert; rewriting it as a second `createReinstallPlugin` call would have left a tautological duplicate of `injected`, which is a weaker test than none. The `direct` binding and its `assert.strictEqual(typeof direct, "function")` are therefore retired, and the case is renamed `owns the injected single-plugin and the bulk production reinstall factories` to state what the module actually publishes.

What replaces it is not nothing:

- The wrapper's live behavior is exercised through `createNodeReinstallPlugins`, its only consumer, which the same case still asserts and which 121 cases in this file drive end to end.
- Its absence from the module's public surface is now asserted by a proof that discriminates restoration (`TS2578`), which the retired `typeof` assertion never did.

**Every other change in this file is identifier-plus-argument only.** Seven `createNodeReinstallPlugin(a, b)` call sites became `createReinstallPlugin(REAL_REINSTALL_TRANSACTION, a, b)`, and one `ReturnType<typeof createNodeReinstallPlugin>` became `ReturnType<typeof createReinstallPlugin>`. Both factories carry the identical return annotation `ReinstallPluginFn`, so the alias resolves to the same type. The full diff is `+33 / -13` across nine hunks: one import removal, one namespace type import, seven lines of comment plus the proof, the retired binding and assertion, the renamed title, and the eight swapped sites. No failure, rollback, notification, ordering, retry or byte assertion changed.

### `tests/orchestrators/plugin/enable-disable.test.ts` and `tests/integration/transaction-lifecycle-cascade.test.ts`

One call site each, plus the import merge into the existing `operations.ts` specifier. Proved mechanically rather than claimed: for each file, the body below the import header was compared against its form at `fbf59c2c` with the swapped identifier normalized to one token. Both compared **identical**, at 4300 and 528 body lines respectively. The local helper in `enable-disable.test.ts` keeps its name (`createReinstallPlugin`) and its lifecycle owners; only the factory it delegates to moved. No enable, disable, reconcile, config-writeback or lifecycle assertion changed.

### `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts`

Two lines: the value import specifier and the construction call. The `ReinstallPluginFn` type import from `reinstall-flow.ts` stays, because the module's helper signatures still name it. Every one of the 28 backfill cases passes unchanged, including the SF-01/SF-02 failure and manifest-throw arms that depend on the real reinstall returning a `failed` partition rather than throwing.

## Verification Results

Every command below was run in the FOREGROUND. No claim here comes from a backgrounded or piped-and-discarded run.

| Command | Result |
| --- | --- |
| `node --test tests/orchestrators/plugin/operations.test.ts tests/orchestrators/reconcile/backfill.test.ts` (task 1) | 36 tests, 36 pass, 0 fail |
| `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/integration/transaction-lifecycle-cascade.test.ts` (task 1 migrations) | 67 tests, 67 pass, 0 fail |
| `node --test tests/orchestrators/plugin/reinstall-flow.test.ts` (task 2) | 121 tests, 121 pass, 0 fail |
| `npm test` (full unit) | **6262 tests, 6260 pass, 2 fail** — the two failures are exactly the parent-owned census equality gates. Baseline was 6260 tests fully green; the net +2 is the two cases added in `operations.test.ts`. |
| `npm run test:integration` | **32 tests, 32 pass, 0 fail, exit 0** — matches the 32 baseline |
| `npm run typecheck` | exit 0 |
| `node --test tests/architecture/no-orchestrator-network.test.ts tests/architecture/no-test-only-production-surface.test.ts tests/architecture/fallow-production-mode.test.ts tests/architecture/import-boundaries.test.ts` | 45 tests, 45 pass, 0 fail |
| `npm run fallow` | exit 0 (dead-code: no issues; health: 0 above threshold; dupes: not above the gate) |
| `npm run test:corresponding` | Corresponding-test gate passed |
| `npm run test:corresponding:negative` | Corresponding-test negative controls passed |
| `npm run test:coverage:direct:negative` | passed; `scripts/test-coverage-direct.pin.json` unchanged, 1 pinned shortfall matched exactly |
| `eslint` + `prettier` (via the pre-commit `npm lint` / `npm format check` / `prettier` hooks) | Passed on both commits |
| `SKIP=trufflehog pre-commit run --files <staged set>` | Passed for both task commits |

### Direct coverage, changed production modules

Every one measures hit == found, so none needs a pin.

| Module | Reading |
| --- | --- |
| `orchestrators/plugin/operations.ts` | branches 7/7, functions 6/6, lines 116/116 |
| `orchestrators/plugin/reinstall-flow.ts` | branches 99/99, functions 18/18, lines 929/929 |
| `orchestrators/reconcile/backfill.ts` | branches 63/63, functions 13/13, lines 469/469 |

The existing direct-coverage pin (`bridges/commands/discover.ts`, `orchestrators/plugin/install-outcome.ts`) is untouched and still matches exactly.

### Discrimination controls

A green suite proves nothing on its own, so the new cases were run against planted offenders. Each offender was reverted immediately and the benign control re-run. One control is recorded as a **negative result** rather than dropped.

| Control | Planted defect | Result |
| --- | --- | --- |
| RED (recorded) | `createReinstallOperation` returns an uncomposed `failed` outcome | the end-to-end case fails on its outcome assertion; `gsd-tools check tdd-red-evidence` returns `RED_EVIDENCE_OK` / `target_test_failed`, 8 discovered, 7 pass, 1 fail |
| A | construction starts a `setTimeout` | 8 tests, 7 pass, 1 fail — the reinstall construction case |
| B | construction calls `hooksRouting.rebuildRoutingTables()` | 8 tests, 7 pass, 1 fail — the reinstall construction case |
| C (negative result, recorded honestly) | the bound `finalizeReinstalledPlugin` replaced by a no-op | **8/8 still pass.** For a hooks-only plugin the finalize step has no observable effect this fixture can see; the replaced bytes are written by the replace schedule. The case does not cover that member. |
| C2 | the bound `replaceOperations.writeHookConfig` replaced by a no-op | 8 tests, 7 pass, 1 fail — the reinstall end-to-end case |
| D | the `createNodeReinstallPlugin` export restored | `npm run typecheck` reports `tests/orchestrators/plugin/reinstall-flow.test.ts(116,1): error TS2578: Unused '@ts-expect-error' directive.` — the proof discriminates restoration |
| benign | none | 8 tests, 8 pass, 0 fail; `npm run typecheck` exit 0 |

Control C2 is what proves the end-to-end case reaches the concrete binding this module holds, rather than merely reaching a working code path. Control C bounds that claim: the case covers the replace schedule and the state lock, not every member of the six-member binding.

## Decisions Made

- **Both tasks kept separate atomic commits, in the plan's own order.** Unlike 05-15 and 05-16, this plan's stated order has a compiling intermediate. Task 1 leaves `createNodeReinstallPlugin` exported with two live consumers (`createNodeReinstallPlugins` in-file and the owner suite), so typecheck and the test-inclusive `fallow dead-code` both stay green at that commit; task 2 then removes the export after its last outside reader is gone. The reverse order does not compile — `backfill.ts` would name a deleted export — so the plan's order is the one that works. No merge and no reordering was needed.
- **Reinstall's concrete binding is imported, not rebuilt here.** `REAL_REINSTALL_TRANSACTION` names six members. Five of them — `finalizeReinstalledPlugin`, `replaceOperations`, `replaceReinstalledPlugin`, `rollbackReinstalledPlugin`, `runPostSuccessMaintenance` — are steps of reinstall's own prepare/replace/compensate schedule, private to `reinstall-replace.ts` (05-19 privatized four of them by name). Rebuilding the binding in `operations.ts` would require re-exporting all five and widening that module's public surface for every importer, which is the opposite of D-03. Importing the single bound object adds no export at all here, since the plan's premise — that `REAL_REINSTALL_TRANSACTION` is already public — holds: `reinstall-flow.ts` has imported it all along. This is the 05-16 uninstall precedent applied to a case that needs it even more.
- **The RED gate for task 2 is a compiler control.** Task 2 adds no runtime behavior — it removes a visibility. Its behavioral promise is the absence of a public export, and the instrument for that is the missing-export proof. The proof was added while the export was still public and measured to fail (`TS2578`), which is a genuine RED: the target check failed for exactly the planned reason. GREEN removed the export and the same proof passed. Control D then re-measured the same discrimination from the finished state.
- **RED for task 1 was recorded as validated evidence rather than a separate commit.** Same reason as 05-15 and 05-16: this repository's `.pre-commit-config.yaml` runs a `npm direct coverage (changed pairs)` hook that executes the focused test for every changed source/test pair, so a commit whose test is red cannot pass the chain, and CLAUDE.md forbids `--no-verify` and forbids recovering from a failed hook after the fact. The evidence record is committed at `.planning/tdd-evidence/05-17-01.json`.
- **The enable/disable owner's local helper keeps its name.** It is called `createReinstallPlugin` and now delegates to `createReinstallOperation`. Renaming it would have produced diff noise in a 4300-line file for no gain, and the local name is not a re-export of the production symbol — it takes no arguments and closes over the case's lifecycle owners.
- **The composition owner's reinstall fixture reuses `installHooksDeclaringPlugin`.** The end-to-end case needs an installed hooks-declaring plugin, and building it through the module's own install composition keeps the fixture honest — it is the real install path, not a hand-written state file — and adds no new seed helper. `npm run fallow` reports no new clone group.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The TDD RED phase for task 1 was recorded as validated evidence rather than a separate commit**

- **Found during:** Task 1
- **Issue:** The TDD reference asks for a `test(...)` commit holding the failing test. The `npm direct coverage (changed pairs)` pre-commit hook executes the focused test for every changed source/test pair, so a commit whose test is red cannot pass the chain. CLAUDE.md forbids `--no-verify` and forbids recovering from a failed hook after the fact, and CLAUDE.md takes precedence over plan instructions.
- **Fix:** RED was performed as a real gate. `createReinstallOperation` was written as an uncomposed stub returning a `failed` outcome, the target case failed on its planned behavioral assertion, and the run was machine-validated with `gsd-tools check tdd-red-evidence`, returning `RED_EVIDENCE_OK` / `target_test_failed` with 8 tests discovered, 7 pass, 1 fail. GREEN then replaced the stub, and RED + GREEN landed together in `5ac7e4fe`.
- **Files modified:** `.planning/tdd-evidence/05-17-01.json` (new).
- **Verification:** the verdict is reproducible from the committed record.
- **Committed in:** `5ac7e4fe`

**2. [Rule 1 - Bug] The first end-to-end discrimination control did not discriminate**

- **Found during:** Task 1 self-check
- **Issue:** Control C planted a no-op over the bound `finalizeReinstalledPlugin` and the suite stayed 8/8 green, so the control proved nothing about whether the case reaches the concrete binding.
- **Fix:** Rather than accept a green run that checked nothing, the control was replaced with C2, which no-ops the bound `replaceOperations.writeHookConfig` and does fail the end-to-end case. Control C's negative result is recorded above rather than deleted, because it names a real blind spot: this case covers the replace schedule and the state lock, not every member of the six-member binding.
- **Files modified:** none — both offenders were reverted and the benign control re-run before the commit.
- **Verification:** benign 8/8; C2 7/8 with the end-to-end case failing.
- **Committed in:** no offender reached a commit.

**3. [Rule 3 - Blocking] Prettier rewrote the reinstall owner suite during the task 2 pre-commit run**

- **Found during:** Task 2, at the pre-commit gate
- **Issue:** The multi-line call-site rewrites left several calls that Prettier folds differently; the `prettier` hook reported `files were modified by this hook` and the commit did not happen.
- **Fix:** Re-ran `SKIP=trufflehog pre-commit run --files ...` on the rewritten tree until clean, then re-ran the task's `<verify>` command (121/121) before staging. Not recovered with `--amend`; the commit had not happened.
- **Files modified:** `tests/orchestrators/plugin/reinstall-flow.test.ts` (formatting only)
- **Verification:** second pre-commit run passed every hook; `node --test` 121/121.
- **Committed in:** `e7fe8c47`

---

**Total deviations:** 3 auto-fixed (2 Rule 3 - blocking, 1 Rule 1 - a control that verified nothing).
**Impact on plan:** No scope creep and no weakening. Every file, action and verify command in both tasks was executed as written; the one retired assertion is explicitly ledgered above with what replaces it.

## Issues Encountered

- The two census equality gates are red at this plan's HEAD. This is the designed state for a cleanup plan mid-wave and matches the Wave 5, 6 and 7 precedent; the parent applies one reviewed pin edit at the Wave 8 reconciliation.
- Control C's negative result (above) is the only surprise. It is recorded rather than hidden because a control that passes while the defect is planted is precisely the "green run that checked nothing" failure this phase's constraints call out.

## Known Stubs

None. The RED stub in `operations.ts` existed only inside this session and was replaced by the real composition before any commit; no commit contains it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `operations.ts` now composes install, enable/disable, uninstall and reinstall, and is ready for 05-18 (fetch, info) and 05-20 (reconcile apply) to extend.
- **Blocking for the parent:** the Wave 8 census reconciliation must remove exactly one identity from `tests/architecture/gate-targets.ts` on behalf of this plan, and must re-measure on the stable wave snapshot rather than trusting the live reading above.
- **Advisory for 05-20:** `backfill.ts`'s remaining census identity, `scanForceInstalledBackfills`, is untouched by this plan and still reads exactly as pinned. Its only in-module caller is `applyBackfillForScope`, so 05-20's privatization path is unobstructed.
- **Advisory for the parent:** `.planning/ROADMAP.md`'s phase-5 row was hand-edited to `23/28` and its wave narrative to wave 8, and `.planning/STATE.md` was hand-edited; `roadmap.update-plan-progress` and the state verbs were not run, per this checkout's known corruption. The counts should be re-checked against `ls .planning/phases/05-production-export-ownership/*-SUMMARY.md | wc -l` at the wave close.
- Aggregate production unit coverage was deliberately **not** measured here. 05-VALIDATION assigns it to the parent once per stable wave.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts` — FOUND
- `tests/orchestrators/plugin/operations.test.ts` — FOUND
- `.planning/tdd-evidence/05-17-01.json` — FOUND
- commit `5ac7e4fe` — FOUND
- commit `e7fe8c47` — FOUND
- `git rev-list --count fbf59c2c..HEAD` — 2, matching the two task commits recorded above

---
*Phase: 05-production-export-ownership*
*Completed: 2026-09-14*

---
phase: 05-production-export-ownership
plan: "15"
subsystem: testing
tags: [composition, dependency-injection, orchestrators, install, fallow, dead-code]

requires:
  - phase: 05-production-export-ownership
    provides: "05-02 install-flow semantic factory and InstallTransaction contract"
  - phase: 05-production-export-ownership
    provides: "05-07 bridge barrels composing concrete Node construction behind injected ports"
  - phase: 05-production-export-ownership
    provides: "05-12 privatized persistence schemas and the rewritten install-flow.test.ts owner"
provides:
  - "extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts, the shared plugin production-composition owner"
  - "createInstallOperation(hooksRouting, completionCache), the single production binding of install's concrete runPhases and withLockedStateTransaction"
  - "createInstallPlugin is now production-consumed, so it leaves the production finding census"
  - "createNodeInstallPlugin and REAL_INSTALL_TRANSACTION are retired from install-flow.ts with no-caller evidence"
affects: [05-16, 05-17, 05-18, 05-19, 05-20, 05-21, 05-22, 05-28]

actuals:
  tokens: 10118
  tasks: 3
  commits: 2
  plan_head_before: a9881c3079fe3a5270a277fcea2357e4c73ddafe

tech-stack:
  added: []
  patterns:
    - "One production composition module per concern group, not per factory: operations.ts owns every concrete transaction binding for the plugin verbs"
    - "Construction purity proved by an async_hooks resource census plus expectation-free strong-mock owners"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
    - tests/orchestrators/plugin/operations.test.ts
    - .planning/tdd-evidence/05-15-01.json
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - tests/architecture/config-state-consistency.test.ts
    - tests/architecture/cross-op-convergence.test.ts
    - tests/integration/transaction-lifecycle-cascade.test.ts
    - tests/integration/fold-adoption.test.ts
    - tests/integration/concurrent-install-child.ts
    - .planning/phases/05-production-export-ownership/deferred-items.md

key-decisions:
  - "Tasks 2 and 3 landed in one commit because the plan's order has no compiling intermediate: retiring createNodeInstallPlugin before repointing its last four test consumers fails typecheck, and repointing them first leaves the wrapper with zero consumers, which fails fallow dead-code."
  - "RED ran as a validated gate rather than a separate commit: the repository's pre-commit chain runs the focused test for every changed pair, so a red commit cannot pass it and CLAUDE.md forbids --no-verify."
  - "Construction purity is proved by an async_hooks resource census plus expectation-free strong-mock owners; synchronous filesystem reads are deliberately not instrumented because ESM named-import bindings do not honor a patched node:fs, so such a control would be a green run that checked nothing."
  - "The WR-03 concrete-wrapper case moved to the operations owner and its four weakest assertions became two whole-value comparisons; no assertion was dropped."

patterns-established:
  - "Composition-owner test shape: one construction-purity case (async_hooks census + verified expectation-free owners) plus one end-to-end case that exercises the concrete bindings the module holds."
  - "Caller migrations are proved mechanically: each repointed file is compared against its base with the factory identifier and module specifier normalized, so 'identifier-only change' is measured rather than asserted."

requirements-completed: [EXPORT-01]

coverage:
  - id: D1
    description: "orchestrators/plugin/operations.ts exists and composes install from the concrete runPhases and withLockedStateTransaction implementations plus the caller's routing and completion-cache owners"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/operations.test.ts#WR-03: installPlugin of a hooks-declaring plugin rebuilds the routing table without /reload"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts (branches 4/4, functions 3/3, lines 36/36)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Constructing the install operation starts no asynchronous work and touches neither injected owner"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/operations.test.ts#constructs the install operation without using its owners or starting asynchronous work"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every production and test caller of createNodeInstallPlugin now asks operations.ts for a composed install; the wrapper and its concrete binding are retired from install-flow.ts"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/import/execute.test.ts tests/orchestrators/reconcile/apply.test.ts (231/231 pass)"
        status: pass
      - kind: unit
        ref: "node --test tests/architecture/config-state-consistency.test.ts tests/architecture/cross-op-convergence.test.ts tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts (286/286 pass)"
        status: pass
      - kind: integration
        ref: "npm run test:integration (32/32, exit 0)"
        status: pass
      - kind: other
        ref: "grep -rn createNodeInstallPlugin extensions tests scripts eslint.config.js .fallowrc.json package.json sonar-project.properties -> exit 1 (no match)"
        status: pass
    human_judgment: false
  - id: D4
    description: "createInstallPlugin leaves the production finding census with exactly one removal and zero additions"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/architecture/unowned-exports-census.test.ts#The complete production finding census equals its committed identities (red by design: 1 removal, 0 additions, parent-owned pin)"
        status: fail
    human_judgment: true
    rationale: "The census equality gates are red by design until the parent applies its single Wave 6 pin edit; every task in this plan forbids editing tests/architecture/gate-targets.ts. The parent must confirm the reviewed delta on the stable wave snapshot."

duration: 43 min
completed: 2026-09-14
status: complete
---

# Phase 5 Plan 15: Install Composition Owner Summary

**`orchestrators/plugin/operations.ts` now holds install's single concrete `runPhases` / `withLockedStateTransaction` binding, `createNodeInstallPlugin` is retired, and `createInstallPlugin` leaves the production finding census as a genuinely consumed semantic factory.**

## Performance

- **Duration:** 43 min
- **Started:** 2026-09-14T19:13:00Z
- **Completed:** 2026-09-14T19:56:31Z
- **Tasks:** 3
- **Files modified:** 15 (3 created, 12 modified)

## Accomplishments

- Created `extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts`, the shared plugin production-composition owner the phase context calls for. It exports `createInstallOperation(hooksRouting, completionCache)` and holds the one module-private `INSTALL_TRANSACTION` binding of the concrete phase ledger and state lock.
- Retired `createNodeInstallPlugin` and `REAL_INSTALL_TRANSACTION` from `install-flow.ts`. That module keeps `installPlugin`, `createInstallPlugin` and the `InstallTransaction` contract; its two transaction imports are now type-only because nothing in the module calls them.
- Migrated all eleven callers: the edge install handler, the import executor, the reconcile apply loop, the concurrent-install child helper, two integration lifecycle tests, two architecture tests and two orchestrator owner tests.
- Moved the WR-03 concrete-wrapper case from the semantic owner to the new operations owner with every original assertion preserved, and added three: the complete installed outcome, the whole persisted plugin record, and the exact generated `hooks.json` bytes.
- Added a construction-purity case proving the composed operation starts no asynchronous work and calls neither injected owner.

## Task Commits

1. **Task 1: Compose install at the command boundary** — `dd8547ec` (feat)
2. **Tasks 2 and 3: Migrate cascading callers, retire the wrapper, repoint the remaining test consumers** — `a99d7dd1` (refactor)

**Plan metadata:** see the final `docs:` commit.

_Tasks 2 and 3 share one commit; see Deviations._

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts` — new. Binds install's semantic transaction contract to `runPhases` and `withLockedStateTransaction`.
- `tests/orchestrators/plugin/operations.test.ts` — new. Construction-purity case plus the relocated WR-03 end-to-end case.
- `.planning/tdd-evidence/05-15-01.json` — new. The validated RED record for task 1.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` — dropped the wrapper and the concrete binding; transaction imports became type-only.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` — the command boundary asks for a composed operation.
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` — cascade default now `createInstallOperation`; `InstallPluginOptions` still comes from `install-flow.ts`.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` — apply loop now `createInstallOperation`.
- `tests/orchestrators/plugin/install-flow.test.ts` — `ReturnType<typeof createInstallPlugin>`; WR-03 case removed.
- `tests/orchestrators/plugin/update-flow.test.ts`, `tests/orchestrators/plugin/reinstall-flow.test.ts`, `tests/architecture/config-state-consistency.test.ts`, `tests/architecture/cross-op-convergence.test.ts`, `tests/integration/transaction-lifecycle-cascade.test.ts`, `tests/integration/fold-adoption.test.ts`, `tests/integration/concurrent-install-child.ts` — identifier and module-specifier only.
- `.planning/phases/05-production-export-ownership/deferred-items.md` — one new open item.

## Census Identity Delta (for the parent's Wave 6 reconciliation)

Do not treat this as the wave total. It is this plan's contribution only; three sibling Wave 6 plans contribute their own.

**Removed (1):**

| Census | Exact identity string |
| --- | --- |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts\|createInstallPlugin` |
| `UNOWNED_EXPORT_CENSUS` | key `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`, member `createInstallPlugin` — `createInstallPlugin` was the key's only member, so the whole key goes |

**Added (0):** none.

**Evidence of the disposition.** `createInstallPlugin` is no longer unowned because `operations.ts` imports and calls it in production. `createInstallOperation` is not a new finding because three production modules import it (`edge/handlers/plugin/install.ts`, `orchestrators/import/execute.ts`, `orchestrators/reconcile/apply.ts`). `createNodeInstallPlugin` was never in the census (it had production callers) and its deletion therefore removes nothing from it; `grep -rn createNodeInstallPlugin` over `extensions`, `tests`, `scripts`, `eslint.config.js`, `.fallowrc.json`, `package.json` and `sonar-project.properties` exits 1.

The measured gate output reads, verbatim:

```
now unowned but not pinned (0): none
pinned but no longer unowned (1): extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts#createInstallPlugin
```

Live production census length moves 32 -> 31. **This reading was taken on the live tree while sibling Wave 6 plans may have been writing.** Nothing outside my owner set moved in it, but the parent must re-measure on the stable wave snapshot before editing the pin, exactly as 05-VALIDATION requires.

## Assertion Ledger

### `tests/orchestrators/plugin/install-flow.test.ts` -> `tests/orchestrators/plugin/operations.test.ts` (WR-03 relocation)

The removed block is 99 lines and held 11 assertion calls. All 11 are accounted for.

| # | Original assertion | Disposition in the operations owner | Proof |
| --- | --- | --- | --- |
| 1 | `assert.equal(ownerRuntime.getRoutingBucket("PreToolUse").length, 0)` | Strengthened to `assert.deepStrictEqual(ownerRuntime.getRoutingBucket("PreToolUse"), [])` | whole value replaces a length |
| 2 | `assert.ok(!summary.includes("(failed)") && !summary.includes("(unavailable)"), ...)` | Verbatim (reindented only) | fragment match |
| 3 | `assert.ok(...resources.hooks !== undefined, ...)` | Subsumed by the whole-record `assert.deepStrictEqual`, which pins `resources.hooks: ["p1"]` | a defined value is asserted exactly |
| 4 | `assert.ok((...resources.hooks ?? []).length > 0, ...)` | Subsumed by the same whole-record comparison | length 1 > 0 follows from the exact array |
| 5 | `assert.deepEqual(...hookEntries, [{ event: "PreToolUse", matcher: "" }])` | Subsumed by the same whole-record comparison, and upgraded from `deepEqual` to `deepStrictEqual` | the field is pinned identically inside the record |
| 6 | `assert.equal(bucket.length, 1)` | Verbatim | fragment match |
| 7 | `assert.equal(bucket[0]?.pluginId, "p1")` | Verbatim | fragment match |
| 8 | `assert.equal(bucket[0]?.scope, "project")` | Verbatim | fragment match |
| 9 | `assert.equal(bucket[0]?.handlerDecl["command"], "echo hello")` | Verbatim | fragment match |
| 10 | `assert.equal(bucket[0]?.resolvedSource, afterState...resolvedSource, "RoutingEntry.resolvedSource must mirror state.json's resolvedSource")` | Verbatim, message included | fragment match |
| 11 | `assert.deepStrictEqual(peerRuntime.getRoutingBucket("PreToolUse"), [])` | Verbatim | fragment match |

**Added in the relocation (3):**

- `assert.deepStrictEqual(outcome, { status: "installed", version: "0.0.1", resourcesChanged: false, declaresAgents: false, declaresMcp: false })` — the complete public result, which the original case never asserted at all.
- `assert.deepStrictEqual(afterState.marketplaces["mp"]?.plugins["p1"], { ... })` — the whole persisted record including `version`, `resolvedSource`, `compatibility`, `resources`, `hookEntries`, `enabled`, `installedAt`, `updatedAt`. Timestamps are made deterministic with `t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 0, 1) })` rather than read back out of the record, so both fields are genuinely pinned.
- `assert.strictEqual(await readFile(<hooksDir>/p1/hooks.json, "utf8"), '{\n  "PreToolUse": ...}\n')` — the complete generated bytes, written as an independent literal, not produced by the serializer under test.

**Added as new coverage (1 case, 5 checks):** the construction-purity case asserts the returned value is a function, that the `async_hooks` init census is empty across the construction window, and verifies two expectation-free `strong-mock` owners.

### `tests/orchestrators/plugin/install-flow.test.ts` (remaining change)

`type InstallOperation = ReturnType<typeof createNodeInstallPlugin>` became `ReturnType<typeof createInstallPlugin>`. Both factories carried the identical return annotation `(opts: InstallPluginOptions) => Promise<InstallPluginOutcome>`, so the alias resolves to the same type and no assertion changed. The file's diff is `+1 / -101`, fully accounted for: 99 lines of relocated case, 1 line of import compaction, 1 line swapped.

### The nine identifier-only caller migrations

Proved mechanically rather than claimed: each file was compared against its base at `a9881c30` with `createNodeInstallPlugin` / `createInstallOperation` normalized to one token and both module specifiers normalized to one token. All eight comparable files reported identical content; the two that changed import *shape* (`edge/handlers/plugin/install.ts` splitting nothing, `orchestrators/import/execute.ts` splitting one combined import into a type import plus a value import) were reviewed by diff. Zero assertions were touched in any of them.

## Verification Results

| Command | Result |
| --- | --- |
| `node --test tests/orchestrators/plugin/operations.test.ts tests/edge/handlers/plugin/install.test.ts` (task 1) | 25 tests, 25 pass, 0 fail |
| `node --test tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/import/execute.test.ts tests/orchestrators/reconcile/apply.test.ts` (task 2) | 231 tests, 231 pass, 0 fail |
| `node --test tests/architecture/config-state-consistency.test.ts tests/architecture/cross-op-convergence.test.ts tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts` (task 3) | 286 tests, 286 pass, 0 fail |
| `node --test tests/integration/transaction-lifecycle-cascade.test.ts tests/integration/fold-adoption.test.ts` | 3 tests, 3 pass, 0 fail |
| `node --test tests/integration/concurrent-install.test.ts` | 2 tests, 2 pass, 0 fail |
| `npm test` (full unit) | **6245 tests, 6243 pass, 2 fail** — the two failures are exactly the parent-owned census equality gates. Baseline was 6244; the net +1 is 2 cases added in `operations.test.ts` minus the 1 relocated out of `install-flow.test.ts`. |
| `npm run test:integration` | **32 tests, 32 pass, 0 fail, exit 0** — matches the 32 baseline |
| `npm run typecheck` | exit 0 |
| `npx eslint extensions tests` | exit 0, no output |
| `npx prettier --check "extensions/**/*.ts" "tests/**/*.ts"` | All matched files use Prettier code style |
| `npm run fallow` | exit 0 (dead-code: no issues; health: 0 above threshold; dupes: not above the gate) |
| `npm run test:corresponding` | Corresponding-test gate passed |
| `npm run test:corresponding:negative` | Corresponding-test negative controls passed |
| `npm run test:coverage:direct:negative` | passed; `scripts/test-coverage-direct.pin.json` unchanged, 1 pinned shortfall matched exactly |
| `npm run lint:workflows` / `:negative` | both passed |

### Direct coverage, changed production modules

Every one measures hit == found, so none needs a pin.

| Module | Reading |
| --- | --- |
| `orchestrators/plugin/operations.ts` | branches 4/4, functions 3/3, lines 36/36 |
| `orchestrators/plugin/install-flow.ts` | branches 86/86, functions 15/15, lines 1119/1119 |
| `edge/handlers/plugin/install.ts` | branches 17/17, functions 2/2, lines 106/106 |
| `orchestrators/import/execute.ts` | branches 149/149, functions 34/34, lines 1212/1212 |
| `orchestrators/reconcile/apply.ts` | branches 119/119, functions 23/23, lines 961/961 |

The existing direct-coverage pin (`bridges/commands/discover.ts`, `orchestrators/plugin/install-outcome.ts`) is untouched; both rows still match exactly.

### Discrimination controls

A green suite proves nothing on its own, so the new owner's cases were run against planted offenders. Each offender was reverted immediately and the benign control re-run.

| Control | Planted defect | Result |
| --- | --- | --- |
| RED (recorded) | `createInstallOperation` returns an uncomposed failed outcome | WR-03 fails on its outcome assertion; `gsd-tools check tdd-red-evidence` returns `RED_EVIDENCE_OK` / `target_test_failed`, 2 discovered, 1 pass, 1 fail |
| A | construction calls `setTimeout` | construction case fails |
| B2 | construction calls `hooksRouting.rebuildRoutingTables()` | construction case fails |
| C | `INSTALL_TRANSACTION.runPhases` replaced by a no-op | WR-03 fails — proves the case covers the concrete binding this module owns |
| B (negative result, recorded honestly) | construction merely *reads* `hooksRouting.rebuildRoutingTables` without calling it | **both cases still pass** — `strong-mock` records calls, not property reads |
| benign | none | 2/2 pass |

### Answers to the two questions the paused preparation left open

1. **Is the `async_hooks` construction proof strong enough?** It is the right instrument for what the task actually promises — "no external connection, disk read or timer may *start*". Controls A and B2 show it catches eager timers, eager async I/O and eager owner calls. It has two measured blind spots, recorded rather than papered over: a synchronous `fs` read, and a bare property read off an injected owner (control B). Stronger synchronous-read instrumentation was considered and rejected on evidence: patching `node:fs` does not reach a production module's ESM named-import bindings, so such a control would report success having verified nothing — the failure mode this phase treats as its worst. A Node permission-model child process would work but buys one blind spot at the cost of a subprocess boundary the handoff already flags as unreliable here.
2. **The `_id` callback parameter and unformatted literals.** Resolved. The parameter is named `_asyncId` (the underscore prefix is the repository's own ESLint-configured ignore pattern for a deliberately unused argument), and the whole file is formatted by the repository's Prettier configuration.

## Decisions Made

- **One commit for tasks 2 and 3.** See Deviations.
- **RED as a validated gate, not a commit.** See Deviations.
- **Kept `createInstallPlugin` exported and `InstallTransaction` public.** The phase context directs that factories with legitimate injected contracts are kept and given real composition consumers, not privatized. `install-flow.test.ts` still drives the semantic factory with its own controlled transaction, which is what lets it inject ledger faults; `operations.ts` is now its production consumer.
- **`t.mock.timers.enable({ apis: ["Date"] })` for the persisted-record assertion.** The alternative the file already uses elsewhere is to read `installedAt` / `updatedAt` back out of the record being asserted, which is tautological for those two fields. No injectable clock exists in the install path and adding one is a production design change outside this plan's file set, so freezing `Date` is the only way to pin the whole record honestly. The install path under test writes and reads real files under a real lock with `Date` frozen, and passes.
- **The seed helper is local to the new owner.** It writes a deliberately minimal hooks-only fixture rather than reaching into `install-flow.test.ts`'s 80-line-options seed. `npm run fallow` reports no new clone group.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tasks 2 and 3 merged into one commit**

- **Found during:** Task 2
- **Issue:** The plan orders the retirement of `createNodeInstallPlugin` (task 2) before repointing its last four test consumers (task 3). That order has no compiling intermediate. Committing task 2 alone fails `npm run typecheck` in the pre-commit chain, because four test files still name the deleted export. Reversing the order does not help either: repointing the four consumers first leaves `createNodeInstallPlugin` with zero consumers anywhere, which `fallow dead-code --fail-on-issues` reports as an unused export, and that hook is also in the chain. Only the union of the two tasks is green.
- **Fix:** Executed both tasks, then committed them together as `a99d7dd1`. Both tasks' file sets, actions and verify commands were honored in full and are reported separately above.
- **Files modified:** all nine files from tasks 2 and 3.
- **Verification:** both tasks' `<verify>` commands were run and passed separately (231/231 and 286/286) before the single commit; the full pre-commit chain passed on the union.
- **Committed in:** `a99d7dd1`

**2. [Rule 3 - Blocking] The TDD RED phase was recorded as validated evidence rather than a separate commit**

- **Found during:** Task 1
- **Issue:** The TDD reference asks for a `test(...)` commit holding the failing test. This repository's `.pre-commit-config.yaml` runs a `npm direct coverage (changed pairs)` hook that executes the focused test for every changed source/test pair, so a commit whose test is red cannot pass the chain. CLAUDE.md forbids `--no-verify` and forbids recovering from a failed hook after the fact, and the executor prompt states CLAUDE.md takes precedence over plan instructions.
- **Fix:** RED was still performed as a real gate, not skipped. A minimal uncomposed stub was written first, the target case failed on its planned behavioral assertion, and the run was machine-validated with `gsd-tools check tdd-red-evidence`, returning `RED_EVIDENCE_OK` / `target_test_failed` with 2 tests discovered, 1 pass, 1 fail. The evidence record is committed at `.planning/tdd-evidence/05-15-01.json`. GREEN then replaced the stub, and RED + GREEN landed together in `dd8547ec`.
- **Files modified:** `.planning/tdd-evidence/05-15-01.json` (new).
- **Verification:** the verdict is reproducible from the committed record.
- **Committed in:** `dd8547ec`

**3. [Rule 2 - Missing critical, logged not fixed] The new composition owner is outside the network-free architecture gate**

- **Found during:** Task 3 self-check
- **Issue:** `tests/architecture/no-orchestrator-network.test.ts` gates a named list of modules against git imports. `operations.ts` composes install, which is on that list, but is not itself on it.
- **Fix:** Not applied. The list lives in `tests/architecture/gate-targets.ts`, the parent-owned census pin every task in this plan forbids editing. The module is clean today; only the future regression is ungated. Logged to `deferred-items.md` with the exact suggested fix.
- **Files modified:** `.planning/phases/05-production-export-ownership/deferred-items.md`
- **Verification:** `operations.ts` imports only `transaction/phase-ledger.ts`, `transaction/with-state-guard.ts`, `install-flow.ts` and two type-only modules.
- **Committed in:** the plan metadata commit

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking), 1 logged as deferred (Rule 2, owner file out of scope).
**Impact on plan:** No scope creep and no weakening. Both blocking deviations are commit-granularity consequences of this repository's gate chain, not changes to what was built or asserted; every file, action and verify command in all three tasks was executed as written.

## Issues Encountered

- The paused preparation under `/tmp/phase5-15-prepared` was re-derived rather than applied, as instructed. Twelve of its thirteen baseline files still matched the live checkout byte for byte; `install-flow.test.ts` differed in exactly the four `async <C,>` Prettier artifacts that 05-12 reported repairing. Its temporary analyzer report (117 issues, 76 unresolved imports) was not used for any claim in this summary; every census number here comes from the repository's own gate running against the live checkout.
- The two census equality gates are red at this plan's HEAD. This is the designed state for a cleanup plan mid-wave and matches the Wave 5 precedent; the parent applies one reviewed pin edit at the Wave 6 reconciliation.

## Known Stubs

None. The RED stub in `operations.ts` existed only inside this session and was replaced by the real composition before any commit; no commit contains it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `operations.ts` is in place and ready for 05-16 (enable/disable, uninstall), 05-17 (reinstall) and 05-18 (fetch, info) to extend. Those plans are sequential with this one by design.
- **Blocking for the parent:** the Wave 6 census reconciliation must remove exactly one identity from `tests/architecture/gate-targets.ts` on behalf of this plan, and must re-measure on the stable wave snapshot rather than trusting the live reading above.
- **Advisory for the parent:** `.planning/ROADMAP.md`'s phase-5 row and `.planning/STATE.md` were hand-edited by this plan while three sibling Wave 6 plans may also be editing them. The counts should be re-checked against `ls .planning/phases/05-production-export-ownership/*-SUMMARY.md | wc -l` at the wave close.
- Aggregate production unit coverage was deliberately **not** measured here. 05-VALIDATION assigns it to the parent once per stable wave, and the wave is not stable while sibling writers run.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts` — FOUND
- `tests/orchestrators/plugin/operations.test.ts` — FOUND
- `.planning/tdd-evidence/05-15-01.json` — FOUND
- commit `dd8547ec` — FOUND
- commit `a99d7dd1` — FOUND
- `git rev-list --count a9881c30..HEAD` — 2, matching the two task commits recorded above

---
*Phase: 05-production-export-ownership*
*Completed: 2026-09-14*

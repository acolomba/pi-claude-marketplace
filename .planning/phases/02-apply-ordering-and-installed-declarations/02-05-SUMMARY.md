---
phase: 02-apply-ordering-and-installed-declarations
plan: 05
subsystem: marketplace
tags: [marketplace-add, MISS-01, dependencies, seam, D-PL2-09, D-PL2-11, D-PL2-15]

requires:
  - phase: 02-01
    provides: "the planner that schedules a missing-dependency install for an eligible dependent"
  - phase: 02-03
    provides: "readPlainPlanForScope (read-pass.ts) and applyDependencyInstalls(opts, installs, outcomes) (apply.ts)"
provides:
  - "ScopeDependencyInstallFn, ScopeDependencyInstallRequest, ScopeDependencyInstallResult, ScopeDependencyInstallRow (orchestrators/types.ts)"
  - "createScopeDependencyInstall(reader, lifecycle) (reconcile/apply.ts)"
  - "dependencyInstallRows(outcomes) (reconcile/notify.ts)"
  - "AddMarketplaceOptions.installMissingDependencies; ADD_CONTEXT.rowPolicies.installed"
  - "EdgeDeps.installMissingDependencies (required), composed once in index.ts"
affects: [02-06 (threads the same seam into bootstrap and the autoupdate cascade)]

actuals:
  tokens: 17304
  tasks: 2
  commits: 2
plan_head_before: 9e28031656eeb8e0ff52260e5fae0c8802e9cee0
plan_head_after: b29601f6678e86c3dbc4d506b53fba5f7068aa60

tech-stack:
  added: []
  patterns:
    - "A command reaches apply's missing-dependency step only through an injected ScopeDependencyInstallFn, typed in orchestrators/types.ts beside PluginUpdateFn"
    - "The step's rows are apply's rows renamed to their full plugin@marketplace keys, so they can render under the added marketplace's block"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts
    - extensions/pi-claude-marketplace/edge/types.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
    - extensions/pi-claude-marketplace/index.ts
    - features/marketplace/add.feature
    - test/architecture/soft-dep-marker-policy.test.ts
    - test/orchestrators/types.test.ts
    - test/orchestrators/reconcile/apply.test.ts
    - test/orchestrators/reconcile/notify.test.ts
    - test/orchestrators/marketplace/add.test.ts
    - test/orchestrators/marketplace/add.messaging.test.ts
    - test/edge/types.test.ts
    - test/edge/handlers/marketplace/add.test.ts
    - test/edge/register.test.ts
    - test/integration/reserved-record-keys.test.ts
    - test/integration/standalone-prune.test.ts
    - test/e2e/import-command.test.ts

key-decisions:
  - "D-PL2-09: after a standalone add that recorded a marketplace, the add's scope runs apply's missing-dependency step for the dependencies the added marketplace offers; only the add's scope, never another (SC-1, D-29)"
  - "D-PL2-11 at the add call site: a refused install renders apply's (failed) row and cause under the (added) block, and raises the notification to error"
  - "D-PL2-15: a marketplace add of any source kind may now clone a git-source missing dependency on a cache miss (NFR-5 amendment)"
  - "A throw out of the step (GHB-03) still lets the committed add report its (added) row before the throw reaches the caller"

patterns-established:
  - "Standalone add: settle, then the injected missing-dependency step outside the add's lock, then one (added) notification carrying the step's rows, then the step's MCP config notices"

requirements-completed: []

coverage:
  - id: D1
    description: "A marketplace add installs the missing dependency of an installed plugin that the added marketplace offers"
    requirement: RCN-06
    verification:
      - kind: e2e
        ref: "features/marketplace/add.feature#Adding a marketplace installs the missing dependency of an installed plugin that it offers"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/apply.test.ts#createScopeDependencyInstall (7 cases)"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/add.test.ts#D-PL2-09 cases (5) and AFILE-04 / D-PL2-09"
        status: pass
    human_judgment: false
  - id: D2
    description: "An add whose missing dependency is refused reports apply's (failed) row and cause under the (added) block"
    requirement: RCN-07
    verification:
      - kind: e2e
        ref: "features/marketplace/add.feature#Adding a marketplace reports a missing dependency it cannot install as failed, as apply reports it"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/add.test.ts#D-PL2-11: a refused dependency install raises the add's notification to error and keeps the (added) header"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/notify.test.ts#dependencyInstallRows (3 cases)"
        status: pass
    human_judgment: false

duration: 32min
completed: 2026-10-27
status: complete
---

# Phase 2 Plan 05: Missing dependencies after a marketplace add Summary

**`marketplace add` now runs `apply`'s missing-dependency step over its own scope once the marketplace is recorded, installs the missing dependencies the added marketplace offers, and lists each one (or the refusal, as `apply` reports it) under the `(added)` header.**

## Performance

- **Duration:** about 32 min
- **Started:** about 2026-10-27T06:08Z
- **Completed:** 2026-10-27T06:40Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments

- `orchestrators/types.ts` types the seam beside `PluginUpdateFn`:
  - `ScopeDependencyInstallRow` (`PluginInstalledMessage | PluginFailedMessage`);
  - `ScopeDependencyInstallRequest` (`ctx`, `run`, `scope`, `cwd`, `select`);
  - `ScopeDependencyInstallResult` (`rows`, `mcpConfigNotices`);
  - `ScopeDependencyInstallFn`.
- `reconcile/apply.ts` exports `createScopeDependencyInstall(reader, lifecycle)`:
  - it reads the scope with `readPlainPlanForScope`;
  - it keeps the `pluginsToDependencyInstall` entries that `select` accepts;
  - it runs them through `applyDependencyInstalls`, the same eligibility rule (D-09-01), operation and row facts `apply` uses;
  - it returns `dependencyInstallRows(outcomes)` and the outcomes' MCP config notices;
  - a read that throws answers no rows and a `hookDebugLog` line (NFR-3).
  The MCP notice fold is shared with `surfaceMcpConfigNotices` through a new private `carriedOutcomeNotices`.
- `reconcile/notify.ts` exports `dependencyInstallRows(outcomes)`. It reuses `installedRowFromOutcome` and a new private `failedRowFromOutcome`, which `applyPluginOutcomeToBlock`'s failed arm now calls too. Both rows are renamed to their full `plugin@marketplace` key.
- `marketplace/add.ts`:
  - `AddMarketplaceOptions.installMissingDependencies?` (D-PL2-09 doc);
  - the standalone success arm calls a new private `notifyAdded`. It runs the step after `settleAddedMarketplace`, outside the add's lock, with the add's `scope` and `cwd` and `select: (install) => install.marketplace === recordedName`;
  - the step's rows go into the `(added)` block (`MarketplaceRows<ScopeDependencyInstallRow>`), and its notices go out through `notifyMcpConfigNotices` right after (AFILE-04);
  - the already-added arm, the failure arms and orchestrated mode never call it.
- `add.messaging.ts`: `installed: { markers: true, contentReasons: true }`, status union `"failed" | "installed"`, header comment updated.
- `edge/types.ts`: required `EdgeDeps.installMissingDependencies`. The add handler's `Pick` widens and forwards it. `index.ts` composes `createScopeDependencyInstall({ loadState }, { hooksRouting, completionCache })` beside `createApplyReconcile` and passes it into `registerClaudePluginCommand`.
- Two scenarios in `features/marketplace/add.feature`.

## Task Commits

1. **Task 1: Adding a marketplace installs the missing dependency of an installed plugin that it offers** - `03486a00` (feat)
2. **Task 2: An add whose missing dependency cannot be installed reports it as apply does** - `b29601f6` (test)

Tracer gate (Task 1): interactive mode, automated-only `<verify>`. The scenario was run again after the commit and passed. No checkpoint was needed.

## RED evidence

**Task 1 scenario on the pre-change code** (the scenario written first, before any source change):

```text
Then the result has these fields:
  | kind         | cascade |
  | severity     | info    |
  | needs reload | true    |
    AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
      'needs reload',
  +     'false'
  -     'true'
1 scenario (1 failed)
14 steps (11 passed, 2 skipped, 1 failed)
```

The add reported only the `(added)` header (no reload, no row), so the rows and record steps were skipped.

**Task 2 scenario.** On the pre-change code the add reports only an `info` `(added)` header, so the `severity error` field and the `failed` row both fail. Its rows were compared with `apply`'s for the same refusal through a temporary probe scenario (removed before the commit; never committed). `apply` reports:

```text
other | project | lib@other | lib | failed   | dependency failed      | Dependency "core@other" is not declared by its marketplace.
tools | project | app@tools | app | disabled | dependency unsatisfied | Install "lib@other" or uninstall "app@tools"
```

The add reports the same status, reason and cause line for `lib@other`. Its name is the full key, because the row renders under the added marketplace (D-PL2-09). It reports no `app` row, because the add-time step installs only and runs no judgement (D-PL2-09 as amended). `pending` shows `app`'s disable, and the next `apply` makes it.

## Files Created/Modified

See the frontmatter `key-files`. Test changes:
- `apply.test.ts`: the export census now expects `createScopeDependencyInstall`, and its title says "factories". A new `describe("createScopeDependencyInstall")` holds 7 cases: install, unselected, pristine scope, invalid config, refusal (D-PL2-11), read failure (NFR-3), MCP notices (AFILE-04).
- `notify.test.ts`: 3 `dependencyInstallRows` cases.
- `add.test.ts`: 7 cases:
  - the standalone call, which checks the request, `select`, that the record is committed and that the lock is free;
  - MCP notices after the notification;
  - a throwing step;
  - already-added, failed and orchestrated adds never call the step;
  - the D-PL2-11 severity case.
- `add.messaging.test.ts`: the `installed` policy.
- `types.test.ts`: a satisfying binding plus a wrong-parameter and a wrong-return negative.
- `edge/types.test.ts`: every binding gains the member, plus a required-member negative and a readonly negative.
- `edge/handlers/marketplace/add.test.ts`: `createAddDeps` takes the step, and one case asserts the forward and the rendered row.
- `register.test.ts`, `reserved-record-keys.test.ts`, `standalone-prune.test.ts`, `import-command.test.ts`: the new `EdgeDeps` member (see Deviations).

## Decisions Made

See `## Decision rows`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The marker-policy architecture gate restates `ADD_CONTEXT`**
- **Found during:** Task 1 commit (the hook's `test:unpaired`).
- **Issue:** `test/architecture/soft-dep-marker-policy.test.ts` writes out every command context's row policies; its `ADD_CONTEXT` row still held only `failed`.
- **Fix:** added `installed: { markers: true, contentReasons: true }` to that row. The file is not in the plan's list.
- **Commit:** `03486a00`.

**2. [Rule 2 - Correctness] A throwing step still reports the committed add**
- **Found during:** Task 1.
- **Issue:** the dependency install rethrows an `InvalidGitHubBaseUrlError` (GHB-03). Without a guard, that throw would skip the `(added)` notification of an add that already committed.
- **Fix:** `notifyAdded` sends the `(added)` notification in a `finally`, then lets the throw reach the command's error path. This is the same order `apply` uses for APPLYTHROW-01. A unit case pins it.
- **Commit:** `03486a00`.

**3. [Rule 3 - Blocking] Two `EdgeDeps` literals cannot use a throwing stub**
- **Issue:** the plan asked for throwing stubs in `import-command.test.ts`, as its `applyReconcile` stub throws. But that suite runs `marketplace add` in its setup, and so does `register.test.ts`'s "registered add" case. A throwing step would fail both.
- **Fix:** `import-command.test.ts` composes the real `createScopeDependencyInstall`. `register.test.ts`'s stub resolves an empty result, and its doc comment says why. `standalone-prune.test.ts` keeps a throwing stub, because it runs no add.
- **Commit:** `03486a00`.

**4. [Plan detail] Task 2 uses a closure refusal, not a range refusal**
- **Issue:** the plan's example (`lib@other@^2.0.0` against `lib` 1.0.0) is not a refusal. A path-source dependency whose copy falls outside the range is installed from its current copy (TAGS-02). The probe showed `lib@other installed {dependency installed, dependency current copy}`.
- **Fix:** `other` offers `lib` 1.0.0 declaring `core`, which `other` does not offer. The install is refused with `{dependency failed}` and the cause `Dependency "core@other" is not declared by its marketplace.`, the same row `apply` gives.

**5. [Small] Signature form of the lifecycle parameter**
- `createScopeDependencyInstall`'s second parameter is typed `Pick<ApplyReconcileOptions, "hooksRouting" | "completionCache">`. This is the same shape as the plan's `{ hooksRouting: InstallHooksRouting; completionCache: CompletionCache }` and adds no import.

No existing cucumber scenario changed output: `npm run test:cucumber` passes all 907 scenarios with the step active on every add.

## Issues Encountered

None beyond the deviations.

Checks run:
- the two new scenarios pass; the first fails on the pre-change code (above);
- `node --test` over the 9 owner files named in the plan: 759 passes, 0 failures. `add.test.ts` after Task 2: 135 passes;
- `node --test` over `reserved-record-keys`, `standalone-prune` and `import-command`: 42 passes;
- `test/architecture/soft-dep-marker-policy.test.ts`: 22 passes;
- `npm run typecheck`: no errors;
- `node scripts/test-coverage-direct.mjs <path>` exits 0 for all 8 touched sources (`add.ts`, `notify.ts`, `add.messaging.ts`, `edge/handlers/marketplace/add.ts`, `index.ts`, `apply.ts`, `orchestrators/types.ts`, `edge/types.ts`);
- `npm run lint` exits 0 (BLOCK C and BLOCK F are unchanged and green);
- `npm run fallow` exits 0 (no cycle, no unused export, no clone group);
- `npm run test:cucumber`: 907 scenarios, 9085 steps, all passed;
- `SKIP=npm-check pre-commit run --files` is clean, and both commit hooks passed.

The full `npm run check` was not run; the wave gate runs it.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-02-09 is mitigated. The request carries the add's own `scope`, the step reads and installs in that scope only, and `select` admits only entries whose dependency is in the added marketplace. The add-test case asserts the scope, the cwd and both `select` answers.
- T-02-10 is mitigated. The step calls `applyDependencyInstalls`, so `createDependencyInstallOperation` runs unchanged, with the cross-marketplace guard, the range checks, NFR-10 containment and the ledger rollback.
- T-02-11 is accepted and recorded as D-PL2-15.

## CHANGELOG line

- Adding a marketplace now installs the missing dependencies of installed plugins that the new marketplace offers, and reports any it cannot install.

## Decision rows

| ID | Decision | Rationale |
|----|----------|-----------|
| D-PL2-09 | After a successful `marketplace add` (not an already-added one), the add's scope runs `apply`'s missing-dependency step: the same verdict, `pluginsToDependencyInstall` derivation and dependency-install operation. It installs only the planned installs whose dependency is in the added marketplace, and only in the add's scope; upstream scans every scope. It installs only and lifts no marker-held dependent: `pending` lists that enable and the next `apply` makes it. The step is an injected `ScopeDependencyInstallFn`, composed once in `index.ts` and carried by `EdgeDeps`. `apply`, `import` and the install-time add do not pass it. | Claude Code resolves missing dependencies after a marketplace add (E1). SC-1 / D-29 keep scopes independent. BLOCK C and the add -> operations -> install-outcome -> add cycle forbid a direct import of `reconcile/apply.ts`. |
| D-PL2-11 (add call site) | A refused add-time install renders `apply`'s `(failed)` row, with the same reason and cause, under the `(added)` block, and raises the notification to `error`. Claude Code only logs the refusal. | APL-D1 and the row grammar, as for `apply`. |
| D-PL2-15 | NFR-5 amendment: `marketplace add` of any source kind, `bootstrap` and the autoupdate cascade may clone a git-source missing dependency on a cache miss, as any install may. Warm sha-pinned caches stay offline. No ESLint or rule-pack change is needed: `add.ts` and `reconcile/apply.ts` are already in `NETWORK_SEAMS`, and the step reaches `add.ts` as a parameter, not an import. | The add-time step reuses the install path, which already has this network rule. |

## Backlog dispositions

- **MISS-MPADD-01:** in progress. `marketplace add` is done; it closes in 02-06 with `bootstrap` and the autoupdate cascade.

## Uncertain choices (for user review)

1. **The `select` filter.** The step installs only dependencies in the added marketplace (`install.marketplace === recordedName`). Other missing dependencies that the scope could already install are left to `apply`. The alternative is to install every missing dependency in the scope, which would make an add do unrelated work.
2. **Read failure.** A read of the scope that throws after the add committed answers no rows and a debug-log line. The add reports `(added)` alone, and the next `apply` installs the dependency (NFR-3; Claude Code also only logs here, E3).

   Resolved 2026-10-27 by user decision (D-PL2-20): the step reports apply's state.json (failed) row with its cause instead of the debug line, and still installs nothing.
3. **Post-commit hygiene warnings are not surfaced.** `dependencyInstallRows` maps rows only. The `postCommitWarnings` that `apply` sends through its second `notifyDiagnostic` are dropped at the add call site. Phase 1's tagged warning channel (WRN-03) is the place for them.
4. **A throw out of the step.** The `(added)` row goes out first, then the throw reaches the command (APPLYTHROW-01 order). The alternative is to swallow it into a debug line, which would hide a GHB-03 configuration error.
5. **No judgement after the step.** After a refusal, the dependent stays enabled with an unsatisfied dependency until the next load or `apply` (see RED evidence). `apply` disables it in the same run. This follows D-PL2-09 as amended ("installs only").
6. **Row names.** The step's rows carry full `plugin@marketplace` names, as update's dependency rows do, even though the block they render under is the dependency's own marketplace. A bare name would also read correctly there. The full key was kept because the plan and D-PL2-09 ask for it.

## Requirements

RCN-06 and RCN-07 are left unmarked:
- RCN-06 also needs `bootstrap` and the autoupdate cascade (02-06).
- RCN-07's difference is recorded with an ID (D-PL2-11), but that ID reaches PROJECT.md only when the parent session applies the decision rows. 02-06 also renders the same rows at its two call sites.

## Next Phase Readiness

02-06 can thread `EdgeDeps.installMissingDependencies` into the bootstrap handler (through `addMarketplace`'s option) and the marketplace update handler (into `cascadeAutoupdates`). The seam's `select` lets autoupdate limit it to dependents of autoupdate-enabled marketplaces (D-PL2-10).

## Self-Check: PASSED

- FOUND: all 21 modified files
- FOUND: `03486a00`, `b29601f6` (ancestors of HEAD)
- Commits measured: `git rev-list --count 9e280316..HEAD` = 2

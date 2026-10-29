---
phase: 02-apply-ordering-and-installed-declarations
plan: 06
subsystem: marketplace
tags: [bootstrap, marketplace-update, autoupdate, MISS-01, dependencies, D-PL2-09, D-PL2-10, D-PL2-11]

requires:
  - phase: 02-05
    provides: "ScopeDependencyInstallFn, AddMarketplaceOptions.installMissingDependencies, EdgeDeps.installMissingDependencies"
  - phase: 02-02
    provides: "installed-copy declarations for the update preflight"
provides:
  - "BootstrapOptions.installMissingDependencies (required), forwarded into the add"
  - "installMissingDependencies on UpdateMarketplaceOptions, UpdateAllMarketplacesOptions and RefreshOneArgs (optional)"
  - "RefreshOneArgs.cwd"
  - "cascadeAutoupdates returns { outcomes, installs }: the plugin updates, then the missing-dependency step"
affects: [Phase 8 background autoupdate (reuses cascadeAutoupdates and inherits the step)]

actuals:
  tokens: 13700
  tasks: 3
  commits: 3
plan_head_before: 353d08c0d8b081c2fca79b6ba7ba8dc4141abca2
plan_head_after: 8cf5fcbe6d32ce25545a1662bb3b21f41667fde4

tech-stack:
  added: []
  patterns:
    - "bootstrap reaches the missing-dependency step only through its add; it owns no rows of its own"
    - "the autoupdate cascade runs the step inside cascadeAutoupdates, after the plugin-update loop, so any reuse of the cascade inherits it"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - test/orchestrators/plugin/bootstrap.test.ts
    - test/edge/handlers/plugin/bootstrap.test.ts
    - test/orchestrators/marketplace/update.test.ts
    - test/edge/handlers/marketplace/update.test.ts
    - test/edge/register.test.ts
    - features/plugin/bootstrap.feature
    - features/plugin/update-dependencies.feature

key-decisions:
  - "D-PL2-09 (bootstrap): bootstrap passes the step to its add, which runs it in the user scope for the official marketplace's dependencies; the rows render under the (added) row"
  - "D-PL2-10: the autoupdate cascade of marketplace update runs the step after its plugin updates, in the marketplace's scope, for missing dependencies that a plugin of that marketplace declares; wired in cascadeAutoupdates so Phase 8's background run inherits it"
  - "The autoupdate step skips a dependency that a plugin update of the same cascade already reported a row for, so one command lists one row per dependency (D-PL2-01's one-row-per-attempt rationale)"

patterns-established:
  - "A step row makes an otherwise unchanged autoupdate an (updated) block; the (skipped) {up-to-date} collapse needs zero step rows too"

requirements-completed: [RCN-06, RCN-07]

coverage:
  - id: D1
    description: "bootstrap installs the missing dependency of an installed plugin that the official marketplace offers"
    requirement: RCN-06
    verification:
      - kind: e2e
        ref: "features/plugin/bootstrap.feature#Bootstrapping installs the missing dependency of an installed plugin that the official marketplace offers"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/bootstrap.test.ts#D-PL2-09: hands its missing-dependency step to the add ..."
        status: pass
      - kind: unit
        ref: "test/edge/handlers/plugin/bootstrap.test.ts#D-PL2-09: forwards the missing-dependency step ..."
        status: pass
    human_judgment: false
  - id: D2
    description: "an autoupdate installs a missing dependency after the plugin updates and lists it after the update rows"
    requirement: RCN-06
    verification:
      - kind: e2e
        ref: "features/plugin/update-dependencies.feature#Autoupdating a marketplace installs a missing dependency an unchanged plugin now declares"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/update.test.ts#D-PL2-10 (7 cases)"
        status: pass
      - kind: unit
        ref: "test/edge/register.test.ts#D-PL2-10: the registered marketplace update runs the supplied missing-dependency step after its autoupdate"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-10-27
status: complete
---

# Phase 2 Plan 06: Missing dependencies after bootstrap and an autoupdate Summary

**`bootstrap` now installs, through its add, the missing dependencies that the official marketplace offers, and a `marketplace update` with autoupdate on installs the missing dependencies of that marketplace's plugins after its plugin updates. The phase gate `npm run check` exits 0.**

## Performance

- **Duration:** about 30 min
- **Started:** about 2026-10-27T06:46Z
- **Completed:** 2026-10-27T07:16Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- `orchestrators/plugin/bootstrap.ts`: required `BootstrapOptions.installMissingDependencies` (doc cites D-PL2-09), put on the add's options next to `gitOps`. Bootstrap still owns no notification vocabulary: the rows render through `ADD_CONTEXT` under the add's `(added)` row. The add already limits the step to the user scope and to the added marketplace (`select: install.marketplace === recordedName`).
- `edge/handlers/plugin/bootstrap.ts`: the `Pick` widens with `"installMissingDependencies"` and the handler forwards it. `register.ts` passes the full deps to `makeBootstrapHandler`, so it needed no change for this.
- `orchestrators/marketplace/update.ts` (only the option interfaces, their forwarding, `RefreshOneArgs`, `cascadeAutoupdates` and the rendering of its result):
  - optional `installMissingDependencies` on `UpdateMarketplaceOptions`, `UpdateAllMarketplacesOptions` and `RefreshOneArgs`, forwarded as `pluginUpdate` is; `RefreshOneArgs` gains `cwd`;
  - `cascadeAutoupdates(snapshot, args)` returns `{ outcomes, installs }`. After its plugin-update loop, under the same guard (autoupdate on and `pluginUpdate` present), it calls the new private `installAutoupdateDependencies`, which runs the step only when the seam is present, with the marketplace's `scope` and the command's `cwd`;
  - `select` accepts an entry when one of its `declarers` keys ends in `@<marketplace>` (E1), and refuses a dependency an update of the same cascade already reported (see Deviations);
  - in `refreshOneMarketplace`, the step's rows follow the update rows in the cascade block, the autoupdate-on no-op gate needs zero step rows, and the step's MCP config notices go out after the update's own in the same `notifyMcpConfigNotices` call.
- `edge/handlers/marketplace/update.ts` forwards `deps.installMissingDependencies` into both entry points; `edge/register.ts` adds it to the object passed to `makeMarketplaceUpdateHandler`.
- Two scenarios: one in `features/plugin/bootstrap.feature`, one in `features/plugin/update-dependencies.feature`.

## Task Commits

1. **Task 1: Bootstrapping installs the missing dependency of an installed plugin that the official marketplace offers** - `aff1eea2` (feat)
2. **Task 2: An autoupdate installs a missing dependency after the plugin updates** - `739d2c2f` (feat)
3. **Task 3: Final phase gate** - `8cf5fcbe` (fix, forced by the gate; see Deviations)

Tracer gate (Task 1): interactive mode with an automated-only `<verify>`. The scenario was run again after the commit and passed, so no checkpoint was needed.

## RED evidence

**Task 1 scenario on the pre-change code** (written and run before any source change):

```text
Then the command reports these results:
  | kind    | severity | needs reload |
  | cascade | info     | true         |
  | cascade | info     | false        |
    AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
      'info',
  +     'false'
  -     'true'
1 scenario (1 failed)
14 steps (11 passed, 2 skipped, 1 failed)
```

The add reported only the `(added)` header (no reload and no child row), so the rows and record steps were skipped.

**Task 2 scenario on the pre-change code:**

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
12 steps (9 passed, 2 skipped, 1 failed)
```

Without the step, the update installs nothing (widget is up to date), so the reload, the `zcore@tools` row and the record steps fail.

**Gate-forced fix:** without `8cf5fcbe`, the existing scenario "Autoupdating a marketplace does not install a partially supported dependency a plugin's new version needs" fails (see Deviations). That scenario is the regression proof for the fix.

## Files Created/Modified

See the frontmatter `key-files`. Test changes:
- `bootstrap.test.ts` (orchestrator): every call passes a step. The cases that reach a fresh add pass `noDependencyInstalls`, and the failed, skipped and already-added cases pass `unreachedDependencyInstall()`, which rejects if called. A new D-PL2-09 case records the request (`scope: "user"`, `cwd`, `select` true for the official marketplace and false for another) and asserts the rendered `(added)` block with the installed row. One title now says it never reaches the missing-dependency or autoupdate step.
- `bootstrap.test.ts` (edge): `createBootstrapDeps` takes the step, by default one that installs nothing. A new case asserts the forward (`[{ scope: "user", cwd }]`).
- `update.test.ts` (orchestrator): 7 D-PL2-10 cases:
  - the step runs once, after both plugin updates, with the marketplace's scope and `select` answers `[true, false, true, false]`, and its row and notice follow the update's;
  - unchanged autoupdate with zero step rows still renders `(skipped) {up-to-date}`;
  - one step row turns it into `(updated)`;
  - autoupdate off runs no step;
  - no `pluginUpdate` runs no step;
  - `updateAllMarketplaces` forwards the step;
  - a dependency already reported by the cascade is not selected.
- `update.test.ts` (edge): every handler gets the step. The two selection cases assert that it ran once, for the project `alpha`, and the rejection cases use one that rejects if called.
- `register.test.ts`: `CommandProbes.cascade` overrides `beginPluginUpdateRun` and `installMissingDependencies`. A new D-PL2-10 case shows the registered `marketplace update` runs the supplied step after its autoupdate.

## Decisions Made

See `## Decision rows`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The autoupdate step listed a refused dependency a second time**
- **Found during:** Task 3 (the first `npm run check` exited 1).
- **Issue:** in "Autoupdating a marketplace does not install a partially supported dependency a plugin's new version needs" (`features/plugin/update-dependencies.feature`), the update of `widget` 1.0.0 -> 1.1.0 fails because its new dependency `zcore` is partially supported, and the update reports `zcore@tools (failed)` with its cause. Then the step ran. `widget` is a path source, so its declarations come from the marketplace tree, which now declares `zcore` (D-PL2-07). The step tried `zcore` again and added a second `zcore@tools (failed) {unsupported component}` row to the same block.
- **Fix:** `installAutoupdateDependencies` takes the cascade's outcomes and its `select` refuses any `plugin@marketplace` already named by a `dependencyRows` entry of the cascade. That gives one row per dependency per command, the D-PL2-01 rationale. A unit case pins it, and the existing scenario passes unchanged.
- **Files modified:** `orchestrators/marketplace/update.ts`, `test/orchestrators/marketplace/update.test.ts`.
- **Commit:** `8cf5fcbe`.

**2. [Plan detail] Commit title of Task 1**
- The plan's example title is 88 characters, and gitlint refused it (limit 72). The commit uses `feat(plugin): install missing dependencies when bootstrapping`.

**3. [Plan detail] `cascadeAutoupdates` signature**
- It now takes `(snapshot, args: RefreshOneArgs)` instead of `(snapshot, name, scope, pluginUpdate)`, because the step needs `ctx`, `run`, `cwd` and the seam. The loop body is unchanged.

No existing cucumber scenario changed its expected output. `npm run test:cucumber` inside the final gate passes all 909 scenarios.

## Issues Encountered

None beyond the deviations.

## Final gate record

| Field | Value |
|-------|-------|
| Command | `npm run check` (foreground, unpiped, output redirected to a log file, exit status read with `echo "check exit: $?"`) |
| Exit status | **0** |
| Commit | `8cf5fcbe6d32ce25545a1662bb3b21f41667fde4` |
| Node | `v26.12.1` |
| Scope | whole tree (the combined tree of phase 2, plans 02-01..02-06) |
| Steps | typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features passed; test:unpaired, test:integration passed; cucumber 909/909 scenarios, 9111/9111 steps; direct coverage merged into `coverage/direct.lcov` (291 records) |

The first run, on `739d2c2f`, exited 1 with one failed scenario (Deviation 1). `git status --porcelain` was empty after the last commit.

Other checks run:
- both new scenarios pass, and both fail on the pre-change code (above);
- `node --test` over the 5 owner test files: bootstrap pair 31 passes; update and register suites 408 passes, then 7 D-PL2-10 passes after the fix;
- `npm run test:coverage:direct --` exits 0 for `orchestrators/plugin/bootstrap.ts`, `edge/handlers/plugin/bootstrap.ts`, `orchestrators/marketplace/update.ts` (again after the fix), `edge/handlers/marketplace/update.ts` and `edge/register.ts`;
- `npx eslint` on the touched files exits 0, and `npx tsc --noEmit` is clean;
- all three commit hooks passed (`check:commit` included).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-02-12 is mitigated. The step installs only entries whose declarer is in the autoupdated marketplace, only in that marketplace's scope, and only when autoupdate is on and the plugin-update seam is present (E1). Unit cases pin the filter (`[true, false, true, false]`, a suffix-only marketplace name included), the scope, and the off and no-seam paths.
- T-02-13 is mitigated. The step runs once per refreshed marketplace, after its updates and outside the refresh lock, through `applyDependencyInstalls` with its per-install scope locks (CR-01).
- T-02-SC: accepted, no package was installed.

## CHANGELOG line

- `bootstrap` and a `marketplace update` with autoupdate on now install the missing dependencies of installed plugins, as Claude Code does after a marketplace add and a background autoupdate.

## Decision rows

| ID | Decision | Rationale |
|----|----------|-----------|
| D-PL2-09 (bootstrap) | `bootstrap` gets the missing-dependency step through its add, in the user scope, for the dependencies the official marketplace offers. The installs are listed under the `(added)` row, before the `(autoupdate enabled)` result. | Claude Code resolves missing dependencies after a marketplace add (E1), and bootstrap is an add. |
| D-PL2-10 | `marketplace update`'s autoupdate cascade runs the missing-dependency step after its plugin updates (E4 order), in the marketplace's scope, for missing dependencies that a plugin of that marketplace declares (E1). Its rows follow the update rows in the marketplace's block, and its MCP notices follow the update's. A step row turns an unchanged autoupdate into `(updated)`. It is wired in `cascadeAutoupdates` (`marketplace/update.ts`), so Phase 8's background autoupdate inherits it. A dependency that a plugin update of the same cascade already reported is not tried again. | Claude Code runs the missing-dependency step after a background autoupdate, after the plugin updates. One row per dependency per command follows D-PL2-01. |
| D-PL2-11 (bootstrap, autoupdate) | At both new call sites a refused install renders `apply`'s `(failed)` row, because the rows are the shared step's rows. | APL-D1 and the row grammar, as for `apply` and `marketplace add`. |

## Backlog dispositions

- **MISS-MPADD-01:** fixed. `marketplace add` (02-05), `bootstrap` and the autoupdate cascade (this plan) run the missing-dependency step.

## Uncertain choices (for user review)

1. **Foreground autoupdate.** The step is wired into the autoupdate cascade of the foreground `marketplace update` command. Claude Code runs it in its background autoupdate, which this extension does not have yet (Phase 8). The alternative is to wait for Phase 8 and leave the foreground command without the step. It is wired now because Phase 8 reuses the cascade.
2. **One row per dependency.** The step skips a dependency that a plugin update of the same cascade already reported (Deviation 1). Claude Code's `bae` would try it again, but it only logs (E3), so a user sees nothing twice there. The alternative is to keep both rows, which shows the same refused dependency twice in one block.

   Resolved 2026-10-27 by user decision (D-PL2-19): kept; one row per dependency per command.
3. **The declarer filter.** `select` keys on the declarer's marketplace (`<plugin>@<marketplace>` ends in `@<name>`), not on the dependency's marketplace. So a dependency in another marketplace that a plugin of the autoupdated marketplace needs is installed too, as upstream E1 does. The add-time step (02-05) filters on the dependency's marketplace instead, because there the new marketplace is what satisfies the dependency.
4. **A throw out of the step.** A throw (only GHB-03, an invalid GitHub base) propagates from the cascade, and the update rows of that marketplace are not reported. The cascade's plugin loop already does this for a GHB-03 throw from a plugin update. `marketplace add` instead reports `(added)` first (02-05); the update could do the same with a `finally`, at the cost of more code in `refreshOneMarketplace`.

   Resolved 2026-10-27 by user decision (D-PL2-21): the marketplace's update rows and notices go out first, from a finally, then the throw reaches the command.
5. **Tally count.** In a bare `marketplace update`, the plural tally counts the step's rows like any plugin row (`Marketplace update: 4 successes` for two up-to-date updates and one install). This is the existing tally rule, unchanged.
6. **Scope of the autoupdate step.** Only the refreshed marketplace's scope, as in 02-05 (SC-1, D-29). Upstream scans every scope.

## Requirements

RCN-06 is complete: `marketplace add` (02-05), `bootstrap` and the autoupdate cascade (02-06) all run the step, each in its own scope.

RCN-07 is complete as far as code goes. `apply` (02-03), `marketplace add` (02-05), `bootstrap` and the autoupdate cascade (02-06) render a MISS-01 refusal as the same `(failed)` row. The difference from Claude Code is recorded with an ID, D-PL2-11, in 02-CONTEXT.md and in the decision rows. The parent session still has to carry that row into PROJECT.md.

## Self-Check: PASSED

- FOUND: all 12 modified files
- FOUND: `aff1eea2`, `739d2c2f`, `8cf5fcbe` (ancestors of HEAD)
- Commits measured: `git rev-list --count 353d08c0..HEAD` = 3
- `npm run check` exit 0 on `8cf5fcbe`

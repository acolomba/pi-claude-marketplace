---
phase: 05-production-export-ownership
plan: "18"
subsystem: testing
tags: [composition, dependency-injection, orchestrators, fetch, info, fallow]

requires:
  - phase: 05-production-export-ownership
    provides: "05-15 operations.ts, the shared plugin production-composition owner"
  - phase: 05-production-export-ownership
    provides: "05-16 the enable and uninstall compositions plus the handler-switch precedent"
  - phase: 05-production-export-ownership
    provides: "05-17 the reinstall composition and the four-operation owner-test shape"
  - phase: 05-production-export-ownership
    provides: "05-13 the fetch and info flow owners' factories and their injected read contracts"
provides:
  - "fetchPlugins and getPluginInfo, the two production compositions of the read commands, bound in operations.ts"
  - "createFetchPlugins is now production-consumed, so it leaves the production finding census"
  - "createGetPluginInfo is now production-consumed, so it leaves the production finding census"
  - "A missing-export proof per read owner, each measured to yield TS2578 when a composed value returns"
affects: [05-20, 05-21, 05-28]

actuals:
  tokens: 7822
  tasks: 3
  commits: 3
  plan_head_before: 0a505e896959e586e6517ce2901ba00c106e01ab

tech-stack:
  added: []
  patterns:
    - "A read command with no caller-owned collaborator is composed as an exported value, not behind a factory: once the filesystem or status capability is bound there is nothing left for a caller to supply"
    - "An owner suite states its composition once, at module scope, so each case reads as the command rather than as its assembly"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
    - tests/orchestrators/plugin/operations.test.ts
    - tests/orchestrators/plugin/fetch.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/architecture/cross-op-convergence.test.ts

key-decisions:
  - "Task order was REORDERED to 1 -> 3 -> 2: the plan's stated order has task 2 delete exports the edge handlers still import, so the tree stops compiling between tasks 2 and 3. Reordering keeps three atomic commits; no merge was needed."
  - "The two read commands are composed as exported values rather than create*Operation factories, because neither takes a routing or completion-cache owner from its caller."
  - "The `no I/O during construction` obligation is proved at the factory, in each owner suite, because operations.ts performs its construction at module scope and a module-scope const offers no other observation point."
  - "The fetch end-to-end case uses a WARM PINNED url source: it is the one fetch shape that reaches the bound presence probe and then returns with no git materialize, so the real capability is exercised offline with no clone-seam override."
  - "seedHooksDeclaringPlugin gained an optional `commandName`, used only by the info case, because `listDirectory` is only reached when the plugin declares a component directory and the bound reader's function coverage requires it."

patterns-established:
  - "Composition-owner test shape extended to six operations: four construction-purity cases for the factories with caller-owned collaborators, plus one end-to-end case per composed command."
  - "An owner whose convenience value is retired keeps a `void ({} satisfies { readonly retired?: typeof Module.value })` proof, measured in both directions."

requirements-completed: [EXPORT-01]

coverage:
  - id: D1
    description: "operations.ts composes fetchPlugins from the fs-only git-source probes, and the composed value answers a warm pinned source offline"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/operations.test.ts#fetchPlugins answers a warm pinned source from the bound status capability"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts (branches 9/9, functions 8/8, lines 155/155)"
        status: pass
    human_judgment: false
  - id: D2
    description: "operations.ts composes getPluginInfo from the Node read-only filesystem capability, and the composed value reports an installed plugin through both members"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/operations.test.ts#getPluginInfo reports the installed plugin through the bound reader capability"
        status: pass
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/operations.test.ts (10/10 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The fetch and info handlers and the cross-op convergence gate ask the composition owner, with argument validation, notification behavior and every convergence assertion unchanged"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "node --test tests/edge/handlers/plugin/fetch.test.ts tests/edge/handlers/plugin/info.test.ts (34/34 pass)"
        status: pass
      - kind: unit
        ref: "node --test tests/architecture/cross-op-convergence.test.ts (3/3 pass)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The flow owners publish the factory only; each owner suite drives it bound to the same real capability, with a missing-export proof that discriminates restoration"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/fetch.test.ts (27/27) and tests/orchestrators/plugin/info.test.ts (134/134)"
        status: pass
      - kind: other
        ref: "npm run typecheck exit 0 with both proofs in place; restoring fetch.ts's value yields tests/orchestrators/plugin/fetch.test.ts(59,1): error TS2578, restoring info.ts's yields tests/orchestrators/plugin/info.test.ts(79,1): error TS2578"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- fetch.ts (branches 78/78, functions 15/15, lines 566/566) and info.ts (branches 312/312, functions 64/64, lines 2472/2472)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Neither operations.ts nor fetch.ts gained git surface; both stay inside the network-free gate"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "node --test tests/architecture/no-orchestrator-network.test.ts (4/4 pass, including the planted-offender and benign-near-miss controls)"
        status: pass
    human_judgment: false
  - id: D6
    description: "createFetchPlugins and createGetPluginInfo leave the production finding census with exactly two removals and zero additions"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/architecture/unowned-exports-census.test.ts#The complete production finding census equals its committed identities (red by design: 2 removals, 0 additions, parent-owned pin)"
        status: fail
    human_judgment: true
    rationale: "The census equality gates are red by design until the parent applies its single Wave 9 pin edit; every task in this plan forbids editing tests/architecture/gate-targets.ts. The parent must confirm the reviewed delta on the stable wave snapshot."

duration: 70 min
completed: 2026-09-14
status: complete
---

# Phase 5 Plan 18: Read-Command Composition Owner Summary

**`orchestrators/plugin/operations.ts` now owns the production composition of `fetch` and `info` alongside install, enable/disable, uninstall and reinstall; both command handlers and the cross-op convergence gate ask it for the command, the flow owners publish their factory and injected read contract only, and `createFetchPlugins` and `createGetPluginInfo` leave the production finding census as genuinely consumed semantic factories.**

## Performance

- **Duration:** 70 min
- **Started:** 2026-09-14T22:10:00Z
- **Completed:** 2026-09-14T23:20:00Z
- **Tasks:** 3
- **Files modified:** 9 (0 created, 9 modified)

## Accomplishments

- Added `fetchPlugins` and `getPluginInfo` to the plugin composition owner, binding `createFetchPlugins` to the fs-only `makePresenceProbe` / `probeManifestEntry` pair and `createGetPluginInfo` to the Node read-only filesystem capability (UTF-8 text reads, `withFileTypes` directory listings).
- Pointed `edge/handlers/plugin/fetch.ts` and `edge/handlers/plugin/info.ts` at the composed values. Argument validation, the USAGE error paths and the notification behavior are untouched; `FetchTarget` still comes from its defining flow owner.
- Migrated `tests/architecture/cross-op-convergence.test.ts`'s `getPluginInfo` invoker onto the composed value, with all three convergence cases and every byte-identity assertion preserved.
- Removed the duplicate compositions from the flow owners: `fetch.ts` no longer declares `NODE_FETCH_STATUS` or a composed `fetchPlugins`, and `info.ts` no longer declares `NODE_PLUGIN_INFO_READER`, a composed `getPluginInfo`, or its `node:fs/promises` import.
- Migrated both owner suites onto their factory bound to the same real capability production binds, stated once at module scope, so all 27 fetch cases and 133 info cases kept their call sites and their assertions verbatim.
- Added a missing-export proof per owner and measured it in both directions: absent it typechecks, restored it yields TS2578.
- Added one construction-purity case per factory and two end-to-end cases to the composition owner.

## Task Commits

1. **Task 1: Bind both read commands in the shared composition module** — `44925576` (feat)
2. **Task 3: Route live read commands to the production bindings** — `e2ad1efd` (refactor)
3. **Task 2: Keep fetch/info logic injectable through production-owned factories** — `f712f031` (refactor)

**Plan metadata:** see the final `docs:` commit.

## Task Order: reordered, not merged

The plan's stated order is 1 → 2 → 3. Task 2 deletes `fetch.ts`'s `fetchPlugins` and `info.ts`'s `getPluginInfo`, which the two edge handlers still import until task 3 switches them. Running the plan's order produces an intermediate that does not compile — `tsc` reports TS2305 on both handler imports — so it could not be an atomic commit.

Task 3 was therefore executed second. Each of the three commits typechecks, and each passes its own task's `<verify>` command plus the full lint / format / fallow / direct-coverage hook chain. **No tasks were merged**; the plan's three-task shape and its per-task file sets are intact.

## Census Identity Delta (for the parent's Wave 9 reconciliation)

This is this plan's contribution only.

**Removed (2):**

| Census | Exact identity string |
| --- | --- |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts\|createFetchPlugins` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/orchestrators/plugin/info.ts\|createGetPluginInfo` |
| `UNOWNED_EXPORT_CENSUS` | key `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`, member `createFetchPlugins` — the key's only member, so the whole key goes |
| `UNOWNED_EXPORT_CENSUS` | key `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`, member `createGetPluginInfo` — the key's only member, so the whole key goes |

**Added (0):** none.

**Evidence of the disposition.** `createFetchPlugins` and `createGetPluginInfo` are no longer unowned because `operations.ts` imports and calls both in production. The two values they produce — `fetchPlugins` and `getPluginInfo` on `operations.ts` — are not new findings, because `edge/handlers/plugin/fetch.ts` and `edge/handlers/plugin/info.ts` import them in production. `makePresenceProbe`, `probeManifestEntry`, `FetchStatus` and `PluginInfoReader` were already exported and already production-consumed; `operations.ts` is now an additional production importer of each, so none of them enters or leaves the census. The retired `fetchPlugins` / `getPluginInfo` values on the flow owners were never in the census (each had a production caller through its handler), so their retirement removes nothing from it, and as non-exports they cannot add anything either.

The measured gate output reads, verbatim:

```
now unowned but not pinned (0): none
pinned but no longer unowned (2): extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts#createFetchPlugins, extensions/pi-claude-marketplace/orchestrators/plugin/info.ts#createGetPluginInfo
```

Live production census length moves 12 -> 10. **Only the two expected identities changed**; the deep-equal diff in the complete-census gate shows exactly two removed rows and no added row, and the eight surviving identities are byte-identical to the pin. No sibling writer ran concurrently (the whole wave is serialized), but the parent must still re-measure on the stable wave snapshot before editing the pin.

`tests/architecture/gate-targets.ts` was NOT edited by this plan.

## Network-Free Proof

`operations.ts` and `fetch.ts` are both named in `NETWORK_FREE_TARGETS`, and `fetch` is the one plugin verb whose purpose is remote refresh, so the obligation was proved rather than assumed.

1. **Nothing added names git surface.** `operations.ts` gained three imports: `node:fs/promises`, `./fetch.ts`/`./info.ts` (the two factories), and `./git-source-probe.ts` (the two fs-only probes, whose own header records that it imports only `makePresenceProbe` + `resolveStrict` and never the platform-git seam). No `platform/git` import, no `gitOps` field, no `DEFAULT_GIT_OPS`, no `refreshGitHubClone`.
2. **The clone seam is untouched.** `fetch.ts` still defaults `opts.cloneCacheSeam` to its own `clone-cache.ts` imports, inside `createFetchPlugins`. Composing the factory elsewhere does not move that default; the composition binds only the status capability.
3. **The gate was run and fires.** `node --test tests/architecture/no-orchestrator-network.test.ts` passes 4/4, which includes the planted-offender control (a `gitOps = DEFAULT_GIT_OPS` mutation of a real target copy rejects), the unmutated-copies control, and the comment-stripping control. The `visited` deep-compare means every declared target, `operations.ts` and `fetch.ts` included, was actually opened.

## Lock Re-entrancy Proof

`proper-lockfile` is `retries: 0` and not re-entrant, so the absence of nesting was proved rather than assumed.

**No guard was added, and none could have been.** `withLockedStateTransaction` appears in `operations.ts` exactly three times, all pre-existing: one import, one member of `INSTALL_TRANSACTION`, one member of `ENABLE_DISABLE_TRANSACTION`. The two read compositions name none of their own. Neither read command acquires the state lock at all — both are derive-not-persist read surfaces whose only state access is `loadState`, so there is no lock for a second acquisition to collide with. The 10 composition-owner cases, the 161 flow-owner cases and the 32-case integration suite all run against real locks and pass.

## Assertion Ledger

Every changed assertion is accounted for below. **No assertion was removed anywhere in this plan.**

### `tests/orchestrators/plugin/operations.test.ts` (added: 2 cases; changed: 0 assertions)

Nothing was removed. The additions are:

| Case | Assertions |
| --- | --- |
| fetchPlugins answers a warm pinned source from the bound status capability | the complete emitted cascade, `[{ message: "● mp [project]\n  ⊘ p1 (skipped) {up-to-date}" }]`, as one whole-value comparison; the recorded `state.json` bytes are byte-identical before and after (derive-not-persist); the three expectation-bounded boundary owners verify (one `ctx.ui` read, one emission, two tool-list reads for the single soft-dependency probe) |
| getPluginInfo reports the installed plugin through the bound reader capability | the complete emitted inventory as one whole-value comparison, written as an independent literal: the marketplace header with its `<no autoupdate>` marker, the `(installed)` row at the recorded version, the `commands:` line, and the `hooks:` block with its matcher-less tool arm |

Two refactors inside the file, neither of which changes an assertion:

- `marketplaceOnlyState` extracts the state literal both seeders write, so the record exists once rather than once per fixture.
- `seedHooksDeclaringPlugin` gained an optional `commandName`. Only the info case passes one; the four pre-existing cases pass nothing and their pinned whole-record assertions (including `resources`) are unchanged, which the passing run confirms.

The `commandName` option is load-bearing rather than cosmetic: `listDirectory` is reached only through `readEntriesOrEmpty` over a declared component directory, so without a declared command the bound reader's second member is never invoked. Measured: with no command the direct-coverage reading for `operations.ts` is `functions 7/8`; with one it is `functions 8/8`.

### `tests/orchestrators/plugin/fetch.test.ts` (added: 1 case; changed: 1 import site)

The 26 pre-existing cases are untouched — same call sites, same arguments, same assertions. `fetchPlugins` is now a module-scope `const` built from this module's own factory bound to `{ makePresenceProbe, probeManifestEntry }`, the same pair `operations.ts` binds, so every call site reads exactly as before. Cold/warm cache decisions, the once-per-host auth memo assertions, the `credentials.calls` emptiness assertions and the clone-tree snapshots are all unchanged and all pass.

Added: one construction-purity case (`typeof` is a function, the `async_hooks` init census over the construction window is exactly `[]`, and the expectation-free `strong-mock` status owner verifies) and one missing-export proof.

### `tests/orchestrators/plugin/info.test.ts` (added: 1 case; changed: 1 import site, 1 helper body)

The 133 pre-existing cases are untouched. `getPluginInfo` is now a module-scope `const` built from this module's own factory bound to `NODE_READER`, the same pair `operations.ts` binds.

`withFsPromiseFault`'s reader now delegates its non-faulting arms to `NODE_READER` instead of restating `readFile(filePath, "utf8")` / `readdir(directoryPath, { withFileTypes: true })`. The fault branches, the `faultRaised` assertion and every caller's assertions are unchanged; the delegation means the real read exists at one site in the file.

Added: one construction-purity case and one missing-export proof.

### `tests/architecture/cross-op-convergence.test.ts` (changed: 1 import site)

The `info` invoker's call shape, the two byte-identity cases and the `{network unreachable}` cross-check are unchanged. Only the module the invoker imports `getPluginInfo` from moved.

## Verification Commands and Results

All runs were in the foreground; none was piped into a filter that could mask the exit status.

| Command | Result |
| --- | --- |
| `node --test tests/orchestrators/plugin/operations.test.ts` | 10 tests, 10 pass, 0 fail |
| `node --test tests/orchestrators/plugin/fetch.test.ts` | 27 tests, 27 pass, 0 fail |
| `node --test tests/orchestrators/plugin/info.test.ts` | 134 tests, 134 pass, 0 fail |
| `node --test tests/edge/handlers/plugin/fetch.test.ts tests/edge/handlers/plugin/info.test.ts` | 34 tests, 34 pass, 0 fail |
| `node --test tests/architecture/cross-op-convergence.test.ts` | 3 tests, 3 pass, 0 fail |
| `node --test tests/architecture/no-orchestrator-network.test.ts` | 4 tests, 4 pass, 0 fail |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run fallow` | exit 0 (dead-code: no issues; health: 0 above threshold; dupes 1,093 lines across 44 files, down from 1,118 across 46) |
| `npm run test:corresponding` / `:negative` | exit 0 / exit 0 |
| `npm run test:coverage:direct:negative` | exit 0 |
| `npm run lint:workflows` / `:negative` | exit 0 / exit 0 |
| `npm run test:coverage:direct -- .../plugin/operations.ts` | passed: branches 9/9, functions 8/8, lines 155/155 |
| `npm run test:coverage:direct -- .../plugin/fetch.ts` | passed: branches 78/78, functions 15/15, lines 566/566 |
| `npm run test:coverage:direct -- .../plugin/info.ts` | passed: branches 312/312, functions 64/64, lines 2472/2472 |
| `npm run test:coverage:direct -- .../handlers/plugin/fetch.ts` | passed: branches 27/27, functions 4/4, lines 132/132 |
| `npm run test:coverage:direct -- .../handlers/plugin/info.ts` | passed: branches 17/17, functions 2/2, lines 79/79 |
| `npm test` (full unit) | **6266 tests, 6264 pass, 2 fail** |
| `npm run test:integration` | **32 tests, 32 pass, 0 fail**, exit 0 |

**Unit count against the baseline.** The wave baseline is 6262/6262. This plan adds exactly four cases — two composition-owner end-to-end cases and one construction-purity case per read owner — giving 6266. The two failures are the two `tests/architecture/unowned-exports-census.test.ts` pin-equality gates, red by design until the parent's single pin edit; no other test failed, and no test was removed or skipped.

**No aggregate coverage was measured.** 05-VALIDATION assigns that to the parent on the stable wave snapshot.

## Decisions Made

See `key-decisions` in the frontmatter. The two that need stating in prose:

**Values, not `create*Operation` factories.** The four existing compositions are factories because each takes a hooks-routing owner, and three also take a completion cache, from the caller. Neither read command takes anything: once the status or reader capability is bound there is no remaining parameter, so a zero-argument factory would only add a call the caller must remember to make. The composed values are therefore exported directly, which is also the shape the retired flow-owner values had, so no call site's arity changed.

**Where `no I/O during construction` is proved.** `operations.ts` constructs both commands at module scope. A module-scope `const` offers no observation window an `async_hooks` census could bracket — a cache-busted dynamic import would measure the module loader's own filesystem reads, not the composition's. The obligation is therefore proved at the factory, in each owner suite, with the same `async_hooks` census and expectation-free `strong-mock` capability the four existing composition-owner purity cases use. That is the only construction step `operations.ts` performs, so proving it there proves it for the composition. Both purity cases live in files this plan already owns (task 2's `<files>`), so the plan's owner set was not widened.

## Deviations from Plan

### 1. [Task order] Tasks 2 and 3 were executed in the opposite order

- **Found during:** planning the commit sequence for Task 2
- **Issue:** the plan's stated order has Task 2 delete the two convenience values while the edge handlers Task 3 has not yet switched still import them, so the tree does not compile between the two commits and Task 2 could not be atomic.
- **Fix:** executed Task 1 → Task 3 → Task 2. Each commit typechecks and passes its own task's `<verify>`.
- **Files modified:** none beyond the plan's declared owner set.
- **Verification:** `npm run typecheck` exit 0 at each of the three commits.
- **Committed in:** `e2ad1efd` and `f712f031`.

### 2. [Placement] The `no I/O during construction` cases live in the owner suites

- **Found during:** Task 1
- **Issue:** Task 1's action asks the composition owner to carry `no I/O during construction`, but its two compositions are module-scope constants with no observable construction window.
- **Fix:** the purity cases were written against each flow owner's factory — the exact expression `operations.ts` evaluates — in `tests/orchestrators/plugin/fetch.test.ts` and `tests/orchestrators/plugin/info.test.ts`, both of which are Task 2 `<files>`.
- **Files modified:** none beyond the plan's declared owner set.
- **Verification:** both cases pass; the `async_hooks` init census is exactly `[]` and the expectation-free capability mocks verify.
- **Committed in:** `f712f031`.

### 3. [Rule 2 - Missing critical] The info fixture was given a declared command

- **Found during:** Task 1
- **Issue:** the composed reader's `listDirectory` member was never invoked by the end-to-end case, so `operations.ts` measured `functions 7/8` on its direct pair — a production binding shipped with no exercising reader, which the unpinned-shortfall gate correctly refused.
- **Fix:** `seedHooksDeclaringPlugin` gained an optional `commandName`, passed only by the info case, so the plugin declares `commands/c1.md` and the component enumeration reaches the bound listing. The expected inventory literal grew the matching `commands: c1` line.
- **Files modified:** `tests/orchestrators/plugin/operations.test.ts`
- **Verification:** `functions 8/8`; the four cases that pass no `commandName` keep their pinned whole-record assertions and pass.
- **Committed in:** `44925576`.

### 4. [Rule 1 - Comment accuracy] Three stale `getPluginInfo` references in `info.ts`

- **Found during:** Task 2
- **Issue:** three doc comments named `getPluginInfo` as the enclosing flow, but after the retirement no such name exists in the module; the flow is `getPluginInfoWithReader`.
- **Fix:** renamed the three references. The comment policy requires a comment to describe the code as it stands.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`
- **Verification:** `npm run lint` and `npm run format:check` exit 0; no behavior touched.
- **Committed in:** `f712f031`.

---

**Total deviations:** 4 (1 task-order, 1 placement, 1 Rule 2, 1 Rule 1)
**Impact on plan:** no scope creep. Every change stayed inside the nine files `files_modified` declares. The task-order and placement deviations are structural, not semantic; the two auto-fixes were both required for the plan's own gates to pass honestly.

## Issues Encountered

**A typecheck failure was found by the pre-commit hook rather than by the ad-hoc run.** The first `npm run typecheck` for Task 1 ran before the end-to-end cases were written, so it did not see that `fetchPlugins` requires the whole `ExtensionContext` / `ExtensionAPI` rather than the narrow `NotificationContext` / `ToolInventory` the owner suite's `makeCtx` builds. The hook caught it, a `strong-mock` boundary was added for the fetch case, and the commit was retried — never amended. This is the intended behavior of running `pre-commit run --files` before `git commit`.

## Known Stubs

None. No stub, placeholder, skipped test or unrun `<verify>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The remaining Wave 9 plan (05-19's sibling) is unaffected: this plan touched nine files, none of which is `tests/architecture/gate-targets.ts`.
- **Parent action required:** apply the single Wave 9 pin edit. This plan's contribution is two identity removals and zero additions, listed verbatim above, taking the live production census from 12 to 10.
- The four remaining census identities after Wave 9 closes are `index.ts|default`, the two reconcile entries, `reconcile.messaging.ts|PENDING_STATUSES`, the two `platform/` entries, `RingBuffer.read` and `scripts/check-phase-06-hub-ledger.mjs` — all assigned to later plans.

---
*Phase: 05-production-export-ownership*
*Completed: 2026-09-14*

## Self-Check: PASSED

- All nine `key-files.modified` entries and this summary exist on disk.
- All four commits resolve: `44925576`, `e2ad1efd`, `f712f031`, `b47b9820`.
- The plan's change set is exactly twelve files: the nine `files_modified` entries plus `STATE.md`, `ROADMAP.md` and this summary. `tests/architecture/gate-targets.ts` is NOT among them.

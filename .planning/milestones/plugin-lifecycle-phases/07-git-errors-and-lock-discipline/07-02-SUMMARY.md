---
phase: 07-git-errors-and-lock-discipline
plan: 02
subsystem: plugin-clone-gc
tags: [lock, clone-gc, uninstall, marketplace-remove, apply, update, reinstall, dependency-sweep]

requires: []
provides:
  - "collectPluginClonesLocked(locations, keep?): the clone GC inside withExistingScopeLock (D-PL7-05)"
  - "listUnreferencedPluginClonesLocked(locations): the dependency sweep's before-listing inside withExistingScopeLock (D-PL7-13)"
  - "garbageCollectPluginClones and listUnreferencedPluginClones are module-private; no call site can collect without the lock"
affects: [07-06, update-flow, reinstall-flow, uninstall, prune, marketplace remove, apply, install-flow dependency sweep]

actuals:
  tokens: 9983
  tasks: 3
  commits: 3
plan_head_before: 6105a72520d1d8a2c0d286e9f306d6e3052b2c44
plan_head_after: 50a9ad077ae3458822832094d0646a86e3487d95

tech-stack:
  added: []
  patterns:
    - "Locked public wrapper over a module-private fs-only body, so the typecheck rejects an unlocked call"
    - "Second holder taken inside a completion-cache double, which the post-lock cleanup calls just before the GC"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts
    - test/orchestrators/plugin/clone-gc.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - test/orchestrators/plugin/uninstall.test.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - test/orchestrators/marketplace/remove.test.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts
    - test/orchestrators/plugin/dependency-bindings.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - test/integration/marketplace-add-seed-mirrors.test.ts

key-decisions:
  - "The locked wrappers are plain (non-async) functions that return the withExistingScopeLock promise; the fs-only bodies keep their names and become module-private"
  - "Both GC and the listing load state with persistMigration: false (D-PL7-05)"
  - "Every call site's existing try/catch + hookDebugLog swallows the StateLockHeldError; no catch was added"

patterns-established:
  - "Held-lock site test: a completion-cache double takes the second holder through lockfile.lock, the case releases it in finally, then asserts the clone list and the unchanged public result"

requirements-completed: [GLK-03]

coverage:
  - id: D1
    description: "collectPluginClonesLocked refuses under a held lock, deletes nothing, and releases the lock after a free run"
    requirement: GLK-03
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/clone-gc.test.ts#collectPluginClonesLocked"
        status: pass
    human_judgment: false
  - id: D2
    description: "uninstall (and prune through finalizePrunedMembers) leaves the clone under a held lock and still reports (uninstalled)"
    requirement: GLK-03
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/uninstall.test.ts#GLK-03 / D-PL7-05: a held scope lock leaves the last referencer's clone and the uninstall still succeeds"
        status: pass
      - kind: e2e
        ref: "npx cucumber-js features/plugin/git-source.feature features/plugin/uninstall.feature features/plugin/prune.feature"
        status: pass
    human_judgment: false
  - id: D3
    description: "marketplace remove leaves the removed plugins' clone under a held lock and still succeeds"
    requirement: GLK-03
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/remove.test.ts#GLK-03 / D-PL7-05: a held scope lock leaves the removed plugins' clone and the remove still succeeds"
        status: pass
    human_judgment: false
  - id: D4
    description: "the dependency sweep's listing and sweep each run under the lock; a held lock at either removes nothing"
    requirement: GLK-03
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/dependency-bindings.test.ts#planCloneSweep"
        status: pass
      - kind: e2e
        ref: "npx cucumber-js features/marketplace/remove.feature features/plugin/install-dependencies.feature features/plugin/update-dependencies.feature features/plugin/apply.feature"
        status: pass
    human_judgment: false
  - id: D5
    description: "update, converge, and reinstall bind the locked GC; the unlocked bodies are private"
    requirement: GLK-03
    verification:
      - kind: unit
        ref: "npm run typecheck; node --test test/orchestrators/plugin/update-flow.test.ts test/orchestrators/plugin/reinstall-flow.test.ts"
        status: pass
      - kind: integration
        ref: "npm run test:integration"
        status: pass
    human_judgment: false

duration: 23min
completed: 2026-10-27
status: complete
---

# Phase 07 Plan 02: Locked Plugin-Clone GC Summary

Every plugin-clone cleanup now runs inside a fresh `withExistingScopeLock` of the operation's scope. These are uninstall and prune, marketplace remove, apply, update, converge, reinstall, and the dependency sweep, including its before-listing. The unlocked GC and listing are module-private, so no call site can skip the lock. A held lock makes the cleanup delete nothing, the error is traced, and the operation still succeeds (D-19-01).

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Locked clone GC, wired through uninstall | 028871ab | clone-gc.ts, clone-gc.test.ts, uninstall.ts, uninstall.test.ts |
| 2 | Remove, apply, and the dependency sweep under the lock | d6f298eb | remove.ts, remove.test.ts, apply.ts, dependency-bindings.ts, dependency-bindings.test.ts, clone-gc.ts, clone-gc.test.ts |
| 3 | Update and reinstall bindings; unlocked GC made private | 50a9ad07 | update-flow.ts, reinstall-flow.ts, clone-gc.ts, clone-gc.test.ts, marketplace-add-seed-mirrors.test.ts |

## What changed

- `clone-gc.ts`: new `collectPluginClonesLocked(locations, keep?)` and `listUnreferencedPluginClonesLocked(locations)`. Each wraps its fs-only body in `withExistingScopeLock`, and each JSDoc states the caller rules: hold no lock (retries: 0, not re-entrant), never call it inside a `withStateGuard` closure, and a held lock rejects with StateLockHeldError. Both bodies call `loadState(..., { persistMigration: false })`. The module header now says that the GC runs under the scope lock and still names no git surface.
- Call sites: `uninstall.ts::runPostUninstallCleanup` (prune reaches it through `finalizePrunedMembers`), `marketplace/remove.ts::runPostRemoveCleanup`, `reconcile/apply.ts::collectClones`, `dependency-bindings.ts::planCloneSweep` (listing and sweep), and the `cleanupClones` bindings in `update-flow.ts` (three) and `reinstall-flow.ts` (one). Only the named functions, their JSDoc, and their imports changed.
- Tests: the unlocked GC and listing describes moved into `describe("collectPluginClonesLocked")` and `describe("listUnreferencedPluginClonesLocked")` with their assertions unchanged. The new held-lock cases are: two in clone-gc (GC and listing reject by class with `scope` and `lockPath`, and the clone list is unchanged), one free run that checks `lockfile.check` is false afterwards, uninstall, marketplace remove, and two planCloneSweep cases (lock held at the listing, lock held at the sweep).

## Verification

| Check | Result |
|-------|--------|
| `node --test test/orchestrators/plugin/clone-gc.test.ts test/orchestrators/plugin/uninstall.test.ts test/orchestrators/marketplace/remove.test.ts test/orchestrators/plugin/dependency-bindings.test.ts` | exit 0, 223 tests, 223 pass |
| `node --test ... clone-gc, remove, dependency-bindings, reconcile/apply` (Task 2) | exit 0, 236 pass |
| `node --test ... clone-gc, update-flow, reinstall-flow` (Task 3) | exit 0, 427 pass |
| `npm run test:coverage:direct` for clone-gc, uninstall, remove, apply, dependency-bindings, update-flow, reinstall-flow | exit 0 (100% for each pair) |
| `npx cucumber-js features/plugin/git-source.feature features/plugin/uninstall.feature features/plugin/prune.feature` | exit 0, 46 scenarios pass |
| `npx cucumber-js features/marketplace/remove.feature features/plugin/install-dependencies.feature features/plugin/update-dependencies.feature features/plugin/apply.feature` | exit 0, 142 scenarios pass |
| `npx cucumber-js features/plugin/git-source-update.feature features/plugin/reinstall.feature` | exit 0, 34 scenarios pass |
| `npm run test:integration` | exit 0 |
| `npm run typecheck` (final tree) | exit 0 |
| `npm run fallow` (final tree) | exit 0 |
| commit hook `npm run check:commit` | passed on all three commits |

The held-lock cases fail without the change. I aliased the unlocked GC back in at each call site (and pointed the locked listing at the unlocked body), then ran the cases. The uninstall case failed (the clone was deleted: `[]` vs `['keySolo']`), the remove case failed, and both planCloneSweep cases failed. I then restored the files.

Acceptance greps: `export function collectPluginClonesLocked` 1, `export function listUnreferencedPluginClonesLocked` 1, `^export async function garbageCollectPluginClones` 0, `^export async function listUnreferencedPluginClones(` 0, `collectPluginClonesLocked` in update-flow.ts 4, `cleanupClones: collectPluginClonesLocked` in reinstall-flow.ts 1, `persistMigration: false` in clone-gc.ts 2.

No cucumber scenario was added. The lock behavior is covered by unit tests only, as 07-CONTEXT "Tests" says: a held-lock race is not deterministic in cucumber. With no rival holder, what a user sees is unchanged, and the existing clone-removal scenarios still pass.

## Deviations

- **Plan-checker advisory skipped (unlisted files).** No held-lock case was added for apply's `collectClones` or for the update-flow / reinstall-flow `cleanupClones` bindings. Their test files (`test/orchestrators/reconcile/apply.test.ts`, `test/orchestrators/plugin/update-flow.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`) are not in this plan's files list. These sites call the same `collectPluginClonesLocked` whose refusal the clone-gc cases prove. The typecheck proves they cannot reach the unlocked body.
- **Duplicate case dropped.** In Task 1 I added a `keep` case under `collectPluginClonesLocked`. In Task 3 the moved `UPD-DEP-D1: keeps an unreferenced clone the caller names` case turned out identical, so I removed my copy and kept the original.
- **Lint fix during the Task 2 commit.** The hook's ESLint `import-x/order` rejected the new `ScopedLocations` type import in dependency-bindings.test.ts. I fixed it with `eslint --fix` and committed again. The commit was not amended.

## Out-of-line edits

None. `test/integration/marketplace-add-seed-mirrors.test.ts` (an import switch only) is listed in the plan's `files_modified`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Handoff

garbageCollectPluginClones and listUnreferencedPluginClones are module-private; a sibling branch that calls either must switch to collectPluginClonesLocked or listUnreferencedPluginClonesLocked at merge.

Comments in `update-swap.ts:1504` and `workflows-staging-gc.ts:74` still name `garbageCollectPluginClones`. The function still exists under that name (now private), so they are accurate and were left untouched, as the plan says.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts (both locked exports)
- FOUND: 028871ab, d6f298eb, 50a9ad07 (ancestors of HEAD)

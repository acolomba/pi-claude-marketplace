---
phase: 26-git-mirror-access
reviewed: 2026-10-23T23:57:18Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/shared/fs-utils.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-10-23T23:57:18Z
**Depth:** deep
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Scope: commit `4d0dd858` (`git show 4d0dd858 -- extensions features/step_definitions test/orchestrators/plugin/mirror-checkout.ts`). The commit does not change `features/step_definitions/` or `test/orchestrators/plugin/mirror-checkout.ts`. Its six production files were reviewed against 26-CONTEXT.md D-01..D-06 and ROADMAP "Phase 26". The changed tests (`clone-cache`, `fetch`, `info`, `removal-ops-*`, `fs-utils`) and the two feature files were read only to judge coverage.

What holds:

- **Re-entrancy.** No caller reaches the new `withExistingScopeLock` sites while the same process already holds the scope lock. `preparePluginUpdate` has one caller, `materializeLatestVersion`. That function is reached only from `update-flow.ts::runPluginUpdate` (direct path, and the `marketplace update` autoupdate cascade, which runs after `snapshotAfterRefresh` releases its guard, `marketplace/update.ts:815`) and from `reinstall-flow.ts::runReinstall` (edge handler, and the reconcile backfill, which runs with no outer lock, `reconcile/backfill.ts:36-40`). `fetchPlugins` and `getPluginInfo` are reached only from their edge handlers. Install, enable, import, reconcile, and bootstrap reach `probeInstallClone`, which takes no lock of its own.
- **Missing extension root.** Every fetch and info target comes from a marketplace record in that scope's `state.json`, and update and reinstall targets come from a plugin record. So the extension root always exists, and `withExistingScopeLock`'s no-mkdir rule rejects no real target.
- **Checkout without `force`.** `checkoutGitDirCopy` drops the index into an empty work tree, so every entry of the commit's tree takes isomorphic-git's `analyze` case `010`, which creates it. This was checked against `node_modules/isomorphic-git/index.js:7740+`. A tag equal to HEAD is covered: the index that used to make a non-forced checkout a no-op is gone. The new clone-cache test exercises exactly that case (the tag is the commit just made).
- **Parity.** `materializeUnpinnedSource` matches the old install and update arms: one auth bundle reused for the copy, `refresh` passed only when defined, the subdir anchored through `resolveGitPluginRootWithSubdir` (byte-equivalent to the old `resolveGitSubdirRoot` branch), and `resolvedSha` captured only on `materialized`.
- **`fetch`.** Its `lock held` mapping carries the cause chain at error severity, as D-02 requires.
- **`RemovalOps.rename` removal.** It is clean.

The main defect is a regression in update and reinstall. `probeUnpinned` now takes the lock inside `resolveStrict`, and `resolveUpdateCandidate`'s catch-all turns a held lock into `skipped {no longer installable}`. A scratch harness confirmed this (see CR-01). Several warnings cover mutators and readers of the same mutable git dirs that still run outside the lock, so GIT-03's guarantee is narrower than the comments claim.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A held lock during an unpinned git `update` or `reinstall` is reported as `skipped {no longer installable}`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:266-273` (thrown here), `:464-510` (misclassified here)
**Issue:** `probeUnpinned` now wraps the mirror step in `withExistingScopeLock`. That probe runs as `resolveGitPluginRoot` inside `resolveStrict` (`update-preflight.ts:419-431`), and `plugin-resolver.ts:459` does not catch it. So `StateLockHeldError` lands in `resolveUpdateCandidate`'s catch:

- `classifyGitTransportFailure` returns `undefined`, because the error has no errno or HTTP code.
- The error is not a `PluginShapeError`.
- It falls to the unclassified fallback: `hookDebugLog("unclassified error")` plus `skippedCandidate(..., ["no longer installable"])`.

Reproduced with a scratch harness: an installed `url`-source plugin, the project lock held by `proper-lockfile`, and `preparePluginUpdate` with `UPDATE_POLICY`. The output was:

```
{"partition":"skipped",...,"notes":["Another pi-claude-marketplace operation is in progress for project scope (...)"],"reasons":["no longer installable"],...}
```

Before this commit the preflight held no lock, and the swap's `withStateGuard` reported `failed {lock held}`, which FLR-01/FLR-02 and `features/plugin/state-lock.feature` require. Now, for every unpinned git source:

- `update` (direct, bare, `@mp`, and the autoupdate cascade) and `reinstall` under contention tell the user that a healthy plugin is "no longer installable". The row is a skip, not an error.
- An up-to-date unpinned plugin that used to report `unchanged` now reports the same false verdict. WR-02/NFR-3 records why that path was kept lock-free.

The state-lock feature covers only `dir` sources, so `npm run check` stays green.

**Fix:** let the typed lock error escape the resolver fold, the way GHB-03 does. The update flow (`update-flow.ts:689`, `:710`, `:879`) and `reinstall-record.ts:145` already map it to `failed {lock held}` with its cause:

```ts
} catch (error: unknown) {
  rethrowInvalidGitHubBaseUrl(error);
  // FLR-01/FLR-02 / GIT-03: a held scope lock is not a resolve verdict.
  if (error instanceof StateLockHeldError) {
    throw error;
  }
  const networkReason = classifyGitTransportFailure(error);
  ...
```

Then add git-source (`github`, unpinned) variants of the update and reinstall scenarios in `features/plugin/state-lock.feature`, plus a `update-preflight.test.ts` case that asserts the throw.

## Warnings

### WR-01: `info --fetch` takes the lock for a pinned, warm clone that needs no fetch, but `fetch` does not

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2116-2121`
**Issue:** `makeFetchProbe` wraps both arms in `withExistingScopeLock`. A pinned source whose per-sha clone is present needs no network and mutates nothing: `materializePluginClone` returns at its warm short-circuit, `clone-cache.ts:236-238`. Under contention, `info --fetch` still fails that plugin `failed {lock held}`. `fetch` checks the same case with the fs-only presence probe before it takes the lock (`fetch.ts:369-374`) and reports `skipped {up-to-date}`. So the two commands give different verdicts for the same pinned-warm plugin, and info fails a read that needs no lock.
**Fix:** lock only the work that can mutate the cache. For example, wrap the unpinned arm, and for the pinned arm, consult `makePresenceProbe(locations)` first, taking the lock only when it returns `not-cached`:

```ts
return async (gitSource) => {
  if (gitSource.sha !== undefined) {
    const presence = await makePresenceProbe(locations)(gitSource);
    if (presence.kind === "materialized") return presence;
  }
  return withExistingScopeLock(locations, () =>
    gitSource.sha === undefined ? probeUnpinned(gitSource) : probePinned(gitSource));
};
```

### WR-02: `lockHeldRow` renders `components: not resolved` under a `(failed)` row, unlike every other info failure row

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2129-2137`
**Issue:** Every other `(failed)` info row sets `componentsResolved: true, components: {}` (`info.ts:1253-1258`, `:1295-1300`). The comment at `:1239-1247` explains why: "a failure row is its own structural signal; INFO-05's marker is reserved for external-source `(installed)` / `(available)` rows". `lockHeldRow` sets `componentsResolved: false`. So `renderPluginInfo` (`notification-grammar.ts:919-923`) appends `    components: not resolved` under `✗ gplug v1.0.0 (failed) {lock held}`. The new info scenario pins that inconsistency (`plugin components resolved | false`), and the unit tests match only the header line.
**Fix:** use the failure-row shape and update the scenario:

```ts
return {
  status: "failed",
  name: pluginName,
  ...(version !== undefined && { version }),
  reasons: ["lock held"],
  componentsResolved: true,
  components: {},
};
```

### WR-03: Clone GC deletes mirrors and fresh per-commit copies outside the lock, which defeats GIT-03

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:1581` (via `runPostUninstallCleanup`, `:1155`), `update-swap.ts:1418-1424`, `marketplace/remove.ts:1237-1242`, `update-preflight.ts:739-748`
**Issue:** `garbageCollectPluginClones` runs after the state guard releases, and it deletes every `plugin-clones/<key>` that no record references. The new locks serialize only lock-takers, so two races remain:

- **(a)** A mirror that only `fetch` warmed is "not live" (`clone-gc.ts:41-44`). Another process's uninstall can `rm -r` it while a locked `fetch`, `info --fetch`, or install is refreshing it or copying from it.
- **(b)** Update and reinstall release the lock after the preflight (`update-preflight.ts:266-273`) and take it again in the swap. In that window the new per-commit copy (and a path-pin tag clone) is unreferenced, so another process's GC can delete it, and the swap then stages from a missing `pluginRoot`.

This predates the commit, but the new comments ("no install copies from a mirror mid-refresh") overstate the guarantee.
**Fix:** run GC under `withExistingScopeLock(locations, () => garbageCollectPluginClones(locations))` at every call site. For (b), have GC also treat as live any key that the record's intent mark or pending candidate names (the swap already writes an intent mark, D-18-10). Another option is to skip keys newer than the oldest lock-held operation. At minimum, document that the preflight copy is unprotected until finalize.

### WR-04: `seedOnePluginMirror` is a third copy-and-checkout path that GIT-04 did not migrate; it carries untracked files and resolved symlinks into an immutable per-sha clone

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:651-668`
**Issue:** The seed runs `cp(marketplaceRoot, staging, { recursive: true })`. That copies the whole work tree (untracked and edited files included), and by default (`verbatimSymlinks: false`) it rewrites relative symlinks to absolute paths into the marketplace checkout. For a pinned source it then runs a non-forced checkout with the copied index. When the sha is HEAD, nothing is rewritten. The result lands at `pluginCloneKey(url, sha)`, which is the same key `materializePluginCommitCopy` returns "as is" (`clone-cache.ts:337-340`). So an installed plugin can run from a tree that holds the marketplace's untracked files and symlinks that point outside `plugin-clones/`. These are the NFR-10 and stray-file hazards that `checkoutGitDirCopy`'s doc says the shared helper removes. The seed also runs after the add commits, outside the lock (`marketplace/add.ts:780`), and writes into `plugin-clones/`.
**Fix:** route the pinned seed through `checkoutGitDirCopy(gitOps, path.join(marketplaceRoot, ".git"), staging, source.sha)`. For the unpinned mirror seed, copy `.git` with `verbatimSymlinks: true`, then run the helper at HEAD. Run the seed under `withExistingScopeLock`.

### WR-05: The update preflight's path-pin tag clone copies the marketplace `.git` outside any lock

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:437-454`; `update-flow.ts:158-200`
**Issue:** `materializeMarketplaceTagClone` now goes through `checkoutGitDirCopy`. The update and reinstall preflight call it with no lock, while another process's `marketplace update` refreshes that same `.git` under its lock (`marketplace/update.ts:533`). Also, `makeSyncCloneOnce` refreshes the marketplace clone with no lock at all. A copy taken during a refresh can hold torn packs or refs. The checkout then fails, and `resolveUpdateCandidate` misreports the failure as `no longer installable`, the same fold as CR-01. GIT-03's reasoning applies to the marketplace clone just as it does to the plugin mirror. Install's call (`install-outcome.ts:732`) is under the lock.
**Fix:** wrap `resolvePathPluginRoot`'s body in `withExistingScopeLock(options.locations, ...)`, as `probeUnpinned` does, and with the same `StateLockHeldError` rethrow as CR-01. Consider locking `syncCloneOnce` too.

### WR-06: `info --fetch` and `fetch` read the mutable mirror after releasing the lock

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2089-2101` with `:2203-2214` and `:2564-2575`; `fetch.ts:379-388`
**Issue:** `makeFetchProbe`'s unpinned arm returns the mirror's own work tree as `pluginRoot`. The lock releases when the probe returns, and only after that do `resolveStrict`, `resolveDeclaredPluginVersion`, and `composeResolvedComponents` read that tree. `fetch.ts` likewise runs `freshRow` (presence probe plus resolver over the mirror) after `withExistingScopeLock` returns. A refresh by another process in that window rewrites files mid-read, so the command can report a component list or version from a half-updated tree.
**Fix:** for `--fetch`, keep the lock across the probe and the row derivation. For example, move the `withExistingScopeLock` up to `buildInstalledGitRow` and `buildGitNotInstalledRow` (and around `freshRow` in `fetchOne`). The alternative is to resolve from a per-commit copy at `resolvedSha` instead of the mirror.

## Info

### IN-01: `CheckoutOptions.force` has no production caller and its doc now recommends the wrong thing

**File:** `extensions/pi-claude-marketplace/platform/git.ts:100-108`, `:512`
**Issue:** After this commit no production call passes `force` (grep `checkout({`). The doc still tells callers to "Set true when `dir`'s work tree may be empty ... for example a `.git`-only copy checked out into a fresh, empty directory". GIT-04 replaced exactly that case with dropping the index, because a forced checkout refuses a symlink-only directory.
**Fix:** point the doc at `checkoutGitDirCopy` (drop the index, do not force), or remove the option if no test needs it.

### IN-02: Stale and misattributed `RemovalOps` documentation

**File:** `extensions/pi-claude-marketplace/shared/fs-utils.ts:46`, `:59`; `.planning/codebase/TESTING.md:146`
**Issue:** "One member and no more (D-08-13)" credits the one-member shape to D-08-13, which decided `rm` and `rename` (08-05-PLAN.md:62). The member count changed under D-06 / IN-06. Line 59 is 137 characters long; Prettier does not reflow comments. `TESTING.md:146` still describes `RemovalOps` as "destructive filesystem removal/rename".
**Fix:** cite D-08-13 for the narrow-port rule and IN-06 for the dropped member. Rewrap line 59, and drop "rename" from TESTING.md.

### IN-03: The scope lock is now held across network refreshes and the Device Flow by more commands, and `onCompromised` is not set

**File:** `extensions/pi-claude-marketplace/transaction/with-state-guard.ts:175-183`; new holders at `fetch.ts:379`, `info.ts:2119`, `update-preflight.ts:266`
**Issue:** `fetch`, `info --fetch`, and the update and reinstall preflight now hold the `retries: 0` lock through clone or fetch, and through an interactive Device Flow (`buildCloneAuth`). During that time, every other command in another Pi fails at once with `lock held`, and a `/reload` there degrades. `proper-lockfile`'s default `onCompromised` throws from a timer, which is an uncaught exception in the host. A long event-loop stall during pack indexing (more than `stale: 10_000`) can trigger it. Install had both properties before. D-01 accepts the wider window, but does not record the crash mode.
**Fix:** pass an `onCompromised` handler that records the compromise and makes the body's result fail, instead of throwing in a timer. Note the hold-across-network trade-off in D-01.

### IN-04: Test coverage gap behind CR-01

**File:** `test/orchestrators/plugin/update-preflight.test.ts`, `features/plugin/state-lock.feature`
**Issue:** The new lock site in `probeUnpinned` has no test with the lock held: no unit case and no git-source scenario (the state-lock scenarios all use `dir` sources). Also, no test covers `materializeUnpinnedSource`'s subdir non-`materialized` arm leaving `captured` unset in update.
**Fix:** add the cases listed in CR-01's fix, plus a `missing-subdir` case that asserts `resolvedSha()` stays `undefined`.

---

_Reviewed: 2026-10-23T23:57:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

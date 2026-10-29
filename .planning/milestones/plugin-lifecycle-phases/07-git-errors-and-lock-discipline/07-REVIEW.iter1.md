---
phase: 07-git-errors-and-lock-discipline
reviewed: 2026-10-27T08:18:05Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - features/lib/published-marketplace.ts
  - features/step_definitions/marketplace/update.steps.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-10-27T08:18:05Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

I reviewed the changes in `cc459a82..HEAD` for the 22 listed files. I traced the
new lock sites and their callers through `install-flow.ts`, `dependency-settle.ts`,
`materialize-latest.ts`, `prune.ts`, and `with-state-guard.ts`. I also traced the
redaction path for cause lines through `notification-resolve.ts`, `errors.ts`, and
`redact-credentials.ts`.

**Lock nesting.** I found no self-deadlock. Every `collectPluginClonesLocked` and
`listUnreferencedPluginClonesLocked` site runs after its operation's own lock is
released:
- uninstall and prune go through `runPostUninstallCleanup`, called after the
  transaction returns.
- `runPostRemoveCleanup` runs after `withLockedStateTransaction`.
- In apply, `collectClones` runs after the step. The converge move defers its GC
  through `deferCollection`.
- The update, reinstall, and converge GC runs after the finalize `withStateGuard`.
- `planCloneSweep` runs in `installAfterMoves` and after `settleDependencies`'
  `firstRun`. Both are lock-free.
- Dependency moves bind `leaveClonesToTheSweep`.

The tag copy in `resolveUpdateCandidate` is reached only from the unlocked
preflight and from `judgeDependencyMove`. `judgeDependencyMove` uses the lock-free
planning ports. `fetch` and `info --fetch` take their lock in one place, and nothing
inside the locked body takes another one.

**Classification.** Every owned site uses the D-PL7-02 rule:
- marketplace refresh and autoupdate: refresh rule
- plugin update's marketplace refresh: refresh rule, plus a frame
- `fetch`, `info --fetch`, update preflight, and the tag probe: plugin-clone rule
- the D-PL7-11 wrappers keep their old meaning

**Cause frames.** A URL with userinfo can reach a frame, but every frame travels as
an `Error` message through `serializeCauseChain`, which runs `redactCredentials`. I
found no credential leak.

**Lock-held cleanups.** None of them can fail an operation. Every GC site swallows
and traces the error.

The two warnings are a marketplace-clone write that the new lock discipline does not
cover, and raw absolute paths that now reach autoupdate cause lines.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Plugin update refreshes the marketplace clone with no scope lock, so GLK-04's tag-copy lock does not exclude it

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:206-255`
**Issue:** D-PL7-06 puts `materializeMarketplaceTagClone` under the plugin scope's
lock because "the plugin-scope lock is the lock `marketplace update` takes on that
`.git`" (`update-preflight.ts:477-488`). `marketplace update` does refresh under
`withLockedStateTransaction` (`marketplace/update.ts:538`).

The plugin `update` command's own marketplace refresh does not take that lock.
`makeSyncCloneOnce` calls `refreshGitHubClone` or `refreshUrlClone`, which run git
fetch, `forceUpdateRef`, and checkout on `sources/<name>/.git`. This phase touched
those calls to add `refreshFramed`, but it added no lock. The `loadState` there is
unlocked too.

So process A's `/claude:plugin update x@mp` can rewrite refs and the working tree of
the marketplace `.git` while process B's locked tag copy reads that `.git` through
`checkoutGitDirCopy`. A's refresh can also race B's `marketplace update` refresh, so
two git writers can run in one repository.

This gap is not in 07-CONTEXT's deferred list. The deferred items name only the
unlocked deletes of `sources/<name>`, `seedSameRepoPluginMirrors`, and
`previewInstall`. It also leaves the phase goal ("no clone read, copy, or cleanup
runs outside the state lock") unmet for the marketplace clone.
**Fix:** Run the refresh under the scope lock. `syncCloneOnce` runs before any
per-target lock, so there is no nesting:
```ts
// makeSyncCloneOnce, github arm (url arm alike)
await withExistingScopeLock(locations, () =>
  refreshFramed(source, () =>
    refreshGitHubClone(cloneDir, source.ref, gitOps, undefined, auth),
  ),
);
```
A held lock then surfaces as `StateLockHeldError`, which `typedUpdateFailReason`
already maps to `lock held`. If the device flow must not run under the lock, follow
the `marketplace update` structure instead. Otherwise, record the gap explicitly as
deferred.

### WR-02: Autoupdate cascade rows now print raw absolute local paths, including a random `skills-staging/<uuid>` path

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:795`
**Issue:** D-PL7-12 attaches `cause: err` on every untyped arm:
`...(!failure.typed && err instanceof Error && { cause: err })`.

`err` goes unchanged to the cascade row (`update-cascade.ts:144`,
`marketplace/update.messaging.ts`). `serializeCauseChain` redacts only credentials,
not paths. So an autoupdate row now shows the raw `cp`/`open` error text. That text
includes `<home>/.pi/agent/pi-claude-marketplace/skills-staging/<random uuid>/...`
for a skill copy failure (07-06 SUMMARY, `deferred-items.md` "From 07-06").

The project's rule for nested causes on user-visible rows is to rebuild them through
`redactCauseChain` (T-53-02-02 / T-55-02-02, as `reconcile/apply.ts`,
`import/execute.ts`, and `prune.ts` do). The cucumber scenario at
`features/marketplace/update.feature:863` was switched from an unreadable skill file
to an unreadable command file so that it would not have to pin this output. The
defect is real, and the test now avoids it rather than covering it.

`deferred-items.md` tracks this item, but 07-CONTEXT's deferred list does not.
**Fix:** Either redact on the cascade arm, accepting that the direct row's text will
differ:
```ts
...(!failure.typed && err instanceof Error && { cause: redactCauseChain(err) }),
```
or do the targeted fix from `deferred-items.md`: wrap the skills bridge's copy
failure in `BridgeStagingError` naming the skill and plugin, as
`bridges/commands` does with `contextualStagingError`. Then restore the skill-file
scenario so it pins the cause line.

## Info

### IN-01: `nextUpdateStamp` throws a `RangeError` on a maximum-date stamp

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:615-619`
**Issue:** The state schema types `updatedAt` as `Type.String()`, with no format.
Suppose a stamp parses to the largest time a `Date` can hold, such as a hand-edited
`"+275760-09-13T00:00:00.000Z"`. Then `prior + 1` is out of range, and
`new Date(...).toISOString()` throws `Invalid time value`. I checked this in Node.
The throw happens inside the `withStateGuard` closure, so the update fails with an
unclassified error and the cause chain is the only clue.
**Fix:** Clamp the value, or treat a non-finite result like an unparseable one:
```ts
const next = Number.isNaN(prior) ? now : Math.max(now, prior + 1);
return new Date(next > 8.64e15 ? now : next).toISOString();
```

### IN-02: The D-PL7-08 monotonic-stamp guarantee is local to `update-swap.ts`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:810` (also `enable-disable.ts:1731`, `install-disable-cascade.ts:111`, `reconcile/mcp-migration.ts:553`)
**Issue:** The mark and the finalize now write `max(now, prior + 1)`. Two of these
writes in one millisecond can push `updatedAt` 1 to 2 ms ahead of the wall clock.
Every other writer of the field still writes `new Date().toISOString()`.

Suppose such a writer, a disable for example, runs in that window. It can write a
stamp exactly equal to one a rival update's preflight already read. ST-9 checks only
`version`, `resolvedSha`, and `updatedAt`, not `enabled`. So the rival's mark passes,
and the rival re-materializes a plugin the user just disabled.

This needs sub-millisecond timing, and same-millisecond collisions existed before
this phase. The rule does not make the field strictly increasing across writers,
though, and the one other update-family writer, `refreshDisabledRecord`, is in an
owned file.
**Fix:** Move `nextUpdateStamp` to a shared spot, for example next to
`persistence/state-io.ts`'s record helpers, and use it at every `updatedAt` write.
At minimum, use it in `refreshDisabledRecord`.

### IN-03: Rule constants are duplicated instead of exported with the classifier

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:161,839`; `orchestrators/marketplace/update.ts:494`; `orchestrators/plugin/fetch.ts:590`; `orchestrators/plugin/info.ts:2176`; `orchestrators/plugin/update-preflight.ts:546`; `orchestrators/plugin/dependency-tag-probe.ts:140`; `orchestrators/marketplace/shared.ts:411`
**Issue:** D-PL7-02 defines one rule per remote operation. The code spreads it as
two copies of `MARKETPLACE_REFRESH_RULE` and five inline
`{ notFound: "source missing" }` literals. Each copy is typed through
`Parameters<typeof classifyGitFailure>[1]`. A later change to one rule, such as
adding `missingRef` to the plugin-clone rule, can miss some copies and quietly split
the classification again. That is the drift this module exists to prevent.
`lacksStoredCredential` also passes an arbitrary rule, which hides intent.
**Fix:** Export the rule type and the two named rules from
`shared/git-failure-classifiers.ts`, and import them at each site:
```ts
export type GitFailureRule = { readonly notFound: "source missing" | "network error"; readonly missingRef?: "source missing" };
export const PLUGIN_CLONE_RULE: GitFailureRule = { notFound: "source missing" };
export const MARKETPLACE_REFRESH_RULE: GitFailureRule = { notFound: "network error" };
```

### IN-04: Two fallback paths name the wrong reason for an error outside their ladder

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts:402-405,602`; `orchestrators/marketplace/update.ts:601,719`
**Issue:**
- (a) In `fetch`, a `StateLockCompromisedError` or a lock-release failure after the
  locked body succeeded goes to `failedRow`, and `narrowFetchFailure` folds it to
  `source missing`. That row tells the user the source is gone even though the fetch
  succeeded. D-PL7-07 keeps the lock for the row read too, so this window is now
  longer.
- (b) The `cascadeAutoupdates` catch classifies a plugin-update throw through
  `reasonsFromCascadeError` and `transportReason`, which use the marketplace-refresh
  rule. A plugin clone 404 that reached this catch would read `network error`, but
  D-PL7-02 says such a 404 is `source missing`. `runCascadeTarget` currently catches
  every throw except an invalid GitHub base URL, so today this path runs only for
  injected test seams.

**Fix:**
- (a) Narrow `StateLockCompromisedError` (or any non-git error) to `unreadable`
  rather than `source missing`.
- (b) Classify throws from that catch with the plugin-clone rule, or document that
  the catch only accepts the cascade-safe `PluginUpdateFn`.

---

_Reviewed: 2026-10-27T08:18:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 15-state-lock-and-marketplace-failure-cleanup
reviewed: 2026-10-23T00:00:00Z
depth: deep
files_reviewed: 19
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - features/marketplace/failed-add.feature
  - features/marketplace/remove.feature
  - features/marketplace/state-lock.feature
  - features/plugin/state-lock.feature
  - features/step_definitions/marketplace/failed-add.steps.ts
  - test/integration/marketplace-layer-remove.test.ts
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/marketplace/remove.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
  - test/orchestrators/plugin/install.messaging.test.ts
  - test/orchestrators/plugin/reinstall-record.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-10-23T00:00:00Z
**Depth:** deep
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Scope: `git diff f86d44aa..HEAD -- extensions test features` (HEAD 84edfe58). The phase gate
`npm run check` passed at 532c88f5, which has the same code as HEAD. The reviewer re-ran the 8
`FLR-0*` unit cases in the six touched test modules: 8 pass, 0 fail.

All lock arms narrow with `instanceof StateLockHeldError` on the raw caught value. The reviewer
traced every lock acquisition (`withExistingScopeLock` is the only place that builds a
`StateLockHeldError`, and only when the lock cannot be acquired). Result: none of the new arms
can catch an error raised after a body has started changing anything. In particular:

- `add.ts::handleAddFailure`: `rethrowPreconditionErrors` (bootstrap) still short-circuits
  before the new arm. `parseAddableSource` runs before the lock, so an unsupported source still
  classifies as before. A release failure is wrapped in a plain `Error`, so it never reaches the
  lock arm. The orchestrated outcome changes from `unparseable` to `lock held`. Reconcile
  (`applyMarketplaceAdds`) folds the reason generically. Import (`addOnePlannedMarketplace`)
  reads only `cause`, which is unchanged.
- `remove.ts::surfaceRemoveStop`: the arms keep their order. A held lock fails before the body
  runs, so `mcpConfigNotices` is always empty on that arm and nothing is dropped. An orchestrated
  remove now returns `mp-remove-failed {lock held}` instead of throwing into
  `applyMarketplaceRemoves`'s catch, which already produced the same reason.
- `update-flow.ts::typedDirectFailReason`: a `StateLockHeldError` from the intent-mark guard
  (after the preflight lock was released) also maps to `lock held`, and the prep handles are
  aborted, so the reason is truthful there too. A lock lost at finalize still goes through
  `reasonOverride: "rollback partial"`.
- `enable-disable.ts`, `install.messaging.ts`, `reinstall-record.ts`: these are local brace and
  cause projections. The orchestrated outcomes are unchanged.

No change catches an error it should not. The findings below are about a lock-held path the
phase did not cover (WR-02), the id of the new add row (WR-01), and test strength and layout
in the cucumber suite (WR-03 to WR-05).

## Warnings

### WR-01: The lock-held `marketplace add` child row breaks the add command's own id rule (D-19) and does not meet D-04's naming

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:826-843`, `features/marketplace/state-lock.feature:138`
**Issue:** `surfaceLockHeldAdd` builds its rows with `marketplaceFailureRows(opts.rawSource, ...)`. That helper's child row has no `marketplaceSubject`. So `rowId` (`shared/notification-json.ts:430`) gives the add's child row the id `<source>@<source>`, for example `{home}/marketplaces/tools@{home}/marketplaces/tools`. The other failed-add child row of the same command (`failedAddRow`, ADD-10 / D-19) sets `marketplaceSubject: true`, so its id is the bare source. BACKLOG ROWID-01 records `<mp>@<mp>` as a known defect of remove, update, autoupdate, and info. It also states that add rows already use the bare source. The 15-03 SUMMARY says ROWID-01 tracks this case, but ROWID-01 says the opposite. Result: `marketplace add` now publishes two id shapes for its failure child rows, and 8 Outline rows pin the new one. Separately, D-04 says the add row "names the marketplace the add would have created". The executor chose the typed source and recorded this only as a note to the orchestrator, not as an amended decision. For `dir`/`file` sources, the manifest name could be read without network.
**Fix:** Mark the add child row as a marketplace subject, so its id matches ADD-10 (D-19). Change the pinned cells to `<source>`. Then record the D-04 naming choice as an amended decision, or resolve it with the user.
```ts
const [block] = marketplaceFailureRows(opts.rawSource, opts.scope, "lock held", err);
const rows: Single<MarketplaceRows<PluginFailedMessage>> = [
  { ...block, plugins: block.plugins.map((row) => ({ ...row, marketplaceSubject: true as const })) },
];
notifyWithContext(opts.ctx, opts.run, ADD_CONTEXT, rows, undefined, "single");
```

### WR-02: A held lock during the `marketplace update` autoupdate cascade still reads `{not in manifest}` with no cause

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:659-724` (reached from `orchestrators/marketplace/update.ts:567-579`)
**Issue:** `snapshotAfterRefresh` releases the scope lock before `cascadeAutoupdates` runs. Each `pluginUpdate` then takes the lock again (`retries: 0`). If another process acquires the lock in that window, `updateSinglePluginWith` catches the `StateLockHeldError`, and `reasonsFromTypedError` maps it to its fallback `["not in manifest"]`. The outcome also has no `cause`, because `cause` is set only when `cleanupFailures.length > 0`. The phase goal says every lifecycle command reports `lock held` with the StateLockHeldError cause. FLR-02 includes `marketplace update`. The 15-02 SUMMARY dismissed this path because "No command reaches it with a held lock". That is true only for the deterministic scenarios, not for two concurrent Pi processes. The same module now classifies one error two ways: `lock held` on the direct path and `not in manifest` on the cascade path.
**Fix:** Add the lock arm before the errno checks, and carry the cause so the row renders the chain:
```ts
function reasonsFromTypedError(err: unknown): readonly ContentReason[] {
  const primary = err instanceof CleanupContextError ? err.primary : err;
  if (primary instanceof StateLockHeldError) {
    return ["lock held"] as const;
  }
  // ...existing arms
}
// in updateSinglePluginWith's catch:
...((cleanupFailures.length > 0 || err instanceof StateLockHeldError) && { cause: err as Error }),
```
Add a unit case that holds the lock and calls the `PluginUpdateFn` directly.

### WR-03: The three FLR-03 "leaves no marketplace behind" scenarios do not show that the add failed for the reason in their titles

**File:** `features/marketplace/failed-add.feature:41-81`
**Issue:** The action under test (the failing add) is a `Given ... , which failed` step. That step only asserts that every payload is an error. The `When` is `marketplace list`. So no step checks that the add failed through the 404, dropped-connection, or invalid-JSON path. Suppose the add fails earlier, for example because the URL is refused before any clone, or a stand-in arm is not armed. Then nothing is staged, and all three scenarios pass without testing the cleanup paths their titles name. The planted check in 15-04 covered only the 404 path. The request-log steps cannot help either, because they read only the requests of the last `When`, which is the list. The point of each scenario is in a `Given`, which the cucumber rules ask scenarios to avoid ("one `When` states one action").
**Fix:** Make the add the `When`. Assert its failed row, with the reason and the git host request log, then the leftovers:
```gherkin
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result lists these marketplaces:
      | name                              | scope   | status | reasons       |
      | https://{git host}/acme/tools.git | project | failed | network error |
    Then the git host receives these requests: ...
    Then the project scope holds no marketplace checkout
    Then the project scope holds no git clones
    Then the "claude-plugins.json" file of the project scope does not exist
```
Use the exact row shape the add renders. Keep the `marketplace list` check in the retry scenario, or as one extra `When` and `Then` pair.

### WR-04: The add-under-lock Outline does not check for a staged checkout, the gap D-10 was created to close

**File:** `features/marketplace/state-lock.feature:127-157`
**Issue:** The Outline title says the add "leaves no marketplace". The scenario checks this with `the <scope> scope holds no git clones`. `readGitClones` (`features/lib/git-clones.ts:84-100`) reads only `plugin-clones/` and the `sources/*` folders that have a `.git` directory. It never reads `sources-staging/`. D-10 added `the {word} scope holds no marketplace checkout` because of exactly this blind spot, but the Outline does not use it. Suppose a change clones before taking the lock, so that the lock is not held for the length of the network clone, and the change leaks the staging folder when the lock fails. The `url` and `github` rows would still pass. The `github` unit case (`NO_GIT_CALLS`) would catch that change for github sources, but nothing would catch it for `url` sources.
**Fix:** Add `Then the <scope> scope holds no marketplace checkout` to the Outline. To do that, first move the step out of `failed-add.steps.ts` (see WR-05).

### WR-05: `failed-add.steps.ts` is named after a feature file, not a verb or a shared topic

**File:** `features/step_definitions/marketplace/failed-add.steps.ts:1-40`
**Issue:** The cucumber layout rules say: "A step belongs to the function of the thing it names, not to the feature that first used it". A stream adds steps only to "its own verb step modules", and the step text of a verb module names its verb. `failed-add` is the name of the feature file `failed-add.feature`, not a marketplace verb. The step text (`the {word} scope holds no marketplace checkout`) does not name a verb either. `npm run check:features` does not catch this. D-12 told the executor to create the module, so the decision itself conflicts with the skill. WR-04 also needs the step in a second feature file, and the rules then require it to move to a topic module.
**Fix:** Move the step to a shared marketplace topic module, for example `features/step_definitions/marketplace/publishing.steps.ts` or a new non-verb topic module such as `marketplace/checkout.steps.ts`, in its own commit. Then delete `failed-add.steps.ts`.

## Info

### IN-01: Lock-holding test helpers are duplicated across test modules

**File:** `test/orchestrators/marketplace/add.test.ts:2815-2830`, `test/orchestrators/marketplace/remove.test.ts:2643-2658`
**Issue:** `whileLockHeld` and `lockHeldCause` appear twice, character for character. The new cases in `update-flow.test.ts` and `enable-disable.test.ts` inline the same `lockfile.lock(...)` and `try`/`finally` block, and `test/orchestrators/reconcile/mcp-migration.test.ts:427` already has `holdStateLock`. The seven unit modules that hold the lock use at least three different option sets.
**Fix:** Put one `holdStateLock(locations, act)` helper and one `lockHeldMessage(scope, lockPath)` helper in shared test support, for example `test/transaction/state-lock-holder.ts`, and use them in every module.

### IN-02: The `surfaceRemoveStop` doc comment leaves out the CFG-03 arm

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:1100-1104`
**Issue:** The comment says "Any other throw leaves through `rethrowWithMcpConfigNotices`". But the CFG-03 sentinel also becomes a row (`surfaceCfgInvalid`).
**Fix:** "...each stop the lock body raised, the CFG-03 sentinel, and a held state lock (FLR-02) becomes its row; any other throw leaves through `rethrowWithMcpConfigNotices`."

### IN-03: The phase's deferred lock gaps exist only in the phase CONTEXT, and one deferral premise is wrong

**File:** `.planning/phases/15-state-lock-and-marketplace-failure-cleanup/15-CONTEXT.md` (Deferred Ideas); `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1433-1480`
**Issue:** The CONTEXT says the install fix "applies to [import's] rows if it routes through the same classifier". It does not. Import calls install in orchestrated mode, which returns from `classifyInstallFailure` and never reaches `runtimeFailureReasons`. `dispatchFailedOutcome` has no `StateLockHeldError` arm, so a lock-held import install reads `unexpected-failure`. Neither this gap, the prune lock-path redaction (D-06, now pinned by two scenarios), nor WR-02 has an entry in `.planning/BACKLOG.md`. The deferrals will be lost when the phase directory is archived.
**Fix:** Add BACKLOG entries for: the import lock-held row, the prune `(.state-lock)` redaction, and (if WR-02 is not fixed now) the cascade lock reason.

### IN-04: The exotic-throw add case pins the number of `instanceof` checks

**File:** `test/orchestrators/marketplace/add.test.ts:2959-2996`
**Issue:** The case had to change from `prototypeReads <= 2` to `<= 3`, and from `5` to `6` reads, only because a new `instanceof` arm was added. This assertion pins how many `instanceof` checks the add makes, not the behavior. Any reordered or added arm will break it again, with no change in behavior.
**Fix:** Assert the outcome (`duplicate name`, wrapped `Error("[object Object]")`) and that classification and wrapping read the prototype separately. For example, return the duplicate prototype only while a flag is set, instead of pinning an exact read count.

---

_Reviewed: 2026-10-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

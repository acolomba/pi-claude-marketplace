---
phase: 63-lifecycle-cascade-user-facing-surface-docs
reviewed: 2026-06-16T23:00:00Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - docs/hooks.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/hooks/index.ts
  - extensions/pi-claude-marketplace/bridges/hooks/stage.ts
  - extensions/pi-claude-marketplace/domain/components/hook-events.ts
  - extensions/pi-claude-marketplace/domain/components/hooks.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/notify-types.test.ts
  - tests/architecture/scope-fences-63.test.ts
  - tests/bridges/hooks/stage.test.ts
  - tests/bridges/hooks/symlink-escape.test.ts
  - tests/docs/hooks-doc.test.ts
  - tests/domain/components/hooks.test.ts
  - tests/domain/resolver-strict.test.ts
  - tests/fixtures/hookify-hooks.json
  - tests/orchestrators/marketplace/cascade.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/shared/notify-v2.test.ts
  - tests/transaction/lifecycle-cascade.test.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 63: Code Review Report

**Reviewed:** 2026-06-16T23:00:00Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

Adversarial review of the Phase 63 lifecycle-cascade work integrating the hooks
bridge across `install` / `update` / `reinstall` / `uninstall` /
`marketplace remove` plus the user-facing docs (`docs/hooks.md`,
`docs/output-catalog.md`). The implementation is meticulous in its handling of
the closed-set type model, the discriminated-union renderer, and the cascade
ordering invariants; the hooks bridge stage primitives have strong path-safety
defenses (symlink escape, name validation, `assertPathInside` belt-and-suspenders).

The findings below are concentrated in three areas: (a) the
`assertNoSymlinkEscapeInHooksSubtree` walker has a TOCTOU window between the
`lstat` check and the subsequent `atomicWriteJson` (no bug, but worth noting);
(b) several orchestrator paths re-parse `hooks.json` from disk after the
resolver already validated it — defensive, but a fresh failure produces an
inconsistent state if it occurs after the bridge file was written; (c) several
post-state-commit cache mutations sit inside `withLockedStateTransaction`
closures where a tx.save() throw could leave the cache out of sync with
state.json. No outright correctness blockers found.

## Warnings

### WR-01: `update.ts` hooks phase: post-failure leak when removeHookConfig throws

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1307-1337`
**Issue:** The hooks phase commit slot lives between `agents` and `mcp` in the
phase-3a loop. When `installable.hooksConfigPath === undefined` (Version B
dropped hooks), it calls `removeHookConfig(...)`. If that call throws (EACCES
on the hooks dir, EIO, etc.), the throw is caught by the wrapping `try/catch`
and pushed onto `phase3aFailures` as `phase: "hooks"`. However, unlike the
write-side path which sets `c.hooksFileWritten`, this branch has no equivalent
"we tried but did not commit" marker. The finalize step at line 1073-1075
gates the `resources.hooks` inventory update on `failedPhases.has("hooks")`,
so a removal failure correctly KEEPS the old inventory slug — but the
on-disk hooks.json file from Version A may have been partially deleted by
`rm({ recursive: true, force: true })` and now lives in an inconsistent state
relative to state.json's `resources.hooks: [plugin]` claim.

In practice the next reconcile pass would rehydrate from the merged config, but
during the window between the failed update and the next `/reload`, the dispatcher
will route hook events against a routing table entry that may point at a now-deleted
file. The same hazard exists in `reinstall.ts::commitHooks`.

**Fix:** Either (a) document the recovery contract explicitly — the user must
run `reinstall` after a `(failed) {rollback partial}` to restore the correct
hooks state, mirroring the existing `RECOVERY_PLUGIN_REINSTALL_PREFIX` hint —
or (b) tighten `removeHookConfig` to be atomic-or-noop (rename-into-place a
sentinel, then unlink), or (c) move the hooks phase BEFORE the state phase so
the state phase's per-bridge `failedPhases.has("hooks")` guard prevents
state.json from advertising hooks that may no longer exist on disk.

### WR-02: `install.ts` cache+routing mutation runs INSIDE the lock closure AFTER tx.save()

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1076-1086`
**Issue:** The commit-then-cache-add ordering at lines 1052-1086 calls
`tx.save()`, then `addInstalledPluginHooksToCache(...)`, then
`rebuildRoutingTables(state, locations)` — all inside the
`withLockedStateTransaction` closure. The comment claims the post-save ordering
is safe because state.json now matches the in-memory state. However, if either
`addInstalledPluginHooksToCache` (which calls `readFile` and `parseHooksConfig`)
or `rebuildRoutingTables` throws, the throw escapes the `withLockedStateTransaction`
closure as a closure-throw AFTER state.json was already saved. The catch in the
outer `installPlugin` then treats this as a "install failure" and routes
through `composeInstallFailureMessage`, which emits a `(failed)` row — but
state.json on disk says the install succeeded.

The result is a state divergence: state.json claims the install succeeded,
but the user sees a "failed" notification. The next `/reload` will reconcile
and rebuild the cache from disk (recovering the cache), but the user-visible
notification will have lied about the outcome.

**Fix:** Wrap lines 1076-1086 in a defensive try/catch that routes failures
through `hookDebugLog` only (consistent with `addInstalledPluginHooksToCache`'s
internal handling), since both arms ALREADY treat read+parse failures as
non-fatal. The current code only defensively handles failures INSIDE
`addInstalledPluginHooksToCache`'s function body, not the call to it OR the
subsequent `rebuildRoutingTables` call.

### WR-03: `reinstall.ts` same cache-after-save hazard

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1105-1136`
**Issue:** Same hazard as WR-02 — `removePluginConfigFromCache` and
`readAndCacheReinstalledPluginHooks` and `rebuildRoutingTables` all run AFTER
`tx.save()` inside the locked closure. The current code wraps the read+parse
in a defensive helper but `rebuildRoutingTables` itself can throw (it walks
state, calls `collectPluginsInScope`, etc.). If it throws, the catch at line
1135 invokes `errorWithManualRecovery` and the outer caller renders a
`(manual recovery)` row — but state.json has been persisted with the new
record.

**Fix:** Match the install.ts pattern: catch the `rebuildRoutingTables` /
cache-mutation errors and route to `hookDebugLog` only. The cache will be
rebuilt from state.json on the next `/reload`, so a cache-mutation failure
must NOT be allowed to falsely fail the reinstall.

### WR-04: `resolver.ts::readStandaloneHooks` uses `process.cwd()` as projectRoot fallback

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:697`
**Issue:** The comment at lines 686-697 acknowledges that the resolver has no
`ExtensionContext` in scope and falls back to `process.cwd()` for the `cwd` /
`projectRoot` slots of the `CompileIfPredicateContext`. The justification is
that `skipIfMap: true` short-circuits the predicate compilation, so `compileIf`
is never invoked and the context fields are effectively unused.

This is correct TODAY, but the contract is fragile: if a future edit to
`parseHooksConfig` ever consumes the `ctx` fields BEFORE the `skipIfMap`
short-circuit (e.g. for a schema-level validation that uses path globs), the
resolver will silently use the wrong project root. The `info.ts` mirror at
lines 260-262 has the same pattern with the same fragility.

**Fix:** Thread the `ExtensionContext.cwd` (or a `homedir`/`cwd`/`projectRoot`
struct) through `ResolveContext` so the resolver has a real anchor. The
`skipIfMap: true` short-circuit can stay as an optimization, but the input
should be truthful in case the optimization is ever removed.

### WR-05: `reinstall.ts::commitHooks` defensively cleans up stale subtree without recording the cleanup

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1322-1327`
**Issue:** When `installable.hooksConfigPath === undefined` during reinstall,
`commitHooks` calls `removeHookConfig(...)` to clean up any stale subtree from
the prior install. The replacement-tracking array `replacements[]` is NOT
updated for the hooks slot — the comment at lines 1292-1296 acknowledges this:
"NOT pushed onto `replacements[]` — the hooks file STAYS IN PLACE on a
later-step failure (recovery is via the reinstall hint)".

However, if `removeHookConfig` SUCCEEDS and then the subsequent `mcp` commit
THROWS, the rollback loop at line 1301 won't restore the hooks file — but
state.json hasn't been updated yet either, so the OLD `resources.hooks: [plugin]`
slug is still in the in-memory state. When `errorWithManualRecovery` throws
and the outer caller propagates, no save has happened, so state still claims
the plugin has hooks. The hooks file is now missing, the next reconcile will
reload from the (still-old) state, and the dispatcher will fire against a
non-existent file.

**Fix:** Either record the hooks cleanup in a sentinel handle so rollback can
restore it, or document that the hooks-removed-then-mcp-failed window is a
known manual-recovery case that the user must address with reinstall.

## Info

### IN-01: `assertNoSymlinkEscapeInHooksSubtree` does TOCTOU between walk and atomicWriteJson

**File:** `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:67-108, 195-206`
**Issue:** The order of operations in `writeHookConfig` is (1)
`assertSafeName`, (2) `assertNoSymlinkEscapeInHooksSubtree(pluginRoot)`, (3)
`assertPathInside`, (4) `atomicWriteJson`. The subtree walk in step 2 reads
the FILE SYSTEM to verify no buried symlink escapes; step 4 writes to a
COMPLETELY DIFFERENT path (`<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json`).

The walk is therefore inspecting `<pluginRoot>/hooks/` for a defensive sanity
check while the actual write target is `<hooksDir>/<plugin>/hooks.json`. The
defensive check is good, but the comment at line 8 ("The hooks bridge owns
exactly one file per installed plugin") implies the bridge's only purpose is
to write that one file. The walker could be deferred to a domain-level
discovery pass (where it logically belongs) rather than the bridge write path.

Not a bug — but the placement is unusual and the TOCTOU is technically real
(a symlink could be added between the walk and the actual read in
discoverPluginAgents/etc.). The bridge does NOT read from `<pluginRoot>/hooks/`
during write — it only reads `hooksValue` passed by caller.

**Fix:** Document the rationale more crisply in stage.ts header — the walker
is defensive against a buried hooks-subtree symlink that a discovery pass
might follow. Alternatively, remove the walker from the bridge entirely and
rely on the resolver's domain-level `resolveStrict` containment check, since
the bridge does not itself read from the hooks subtree.

### IN-02: `parseHooksConfig` ignores `compileIfPredicate` errors

**File:** `extensions/pi-claude-marketplace/domain/components/hooks.ts:430-450`
**Issue:** `compileGroupIfPredicates` calls `compileIf(rawIf, claudeEvent, ctx)`
directly without a try/catch. The doc comment on `CompileIfCallback` says "The
callback MUST be pure and total (never throws past its return type)" — but
this is a verbal contract. If the bridge implementation in
`bridges/hooks/if-field/` ever throws (e.g. on a malformed input), the
exception propagates all the way to `installPlugin`'s catch and surfaces as
a runtime error rather than the "fall open" behavior documented elsewhere.

**Fix:** Wrap the `compileIf` invocation in a try/catch that logs via
`hookDebugLog` and uses MATCH_ALL_IF as the sentinel. The current code relies
on the bridge implementation's discipline, which is fragile across future
edits to `bridges/hooks/if-field/`.

### IN-03: `detectOrphanRewake` does not narrow `asyncRewake` value type

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:721-736`
**Issue:** `detectOrphanRewake` checks `handler.asyncRewake === true`. The
schema at `hooks.ts:186` admits ANY value (`asyncRewake: {}`). The check
correctly handles `undefined`, `false`, and any non-`true` value as "not
async-rewake". But the docstring at `notify.ts:108-112` and `docs/output-catalog.md`
mention this is triggered when "rewakeMessage or rewakeSummary is set without
asyncRewake: true". A boolean-wrapper object `{ value: true }` would correctly
fail the strict `=== true` check, but a stringified `"true"` would also fail
— and the user may have INTENDED to enable async-rewake. The orphan-rewake
reason would surface confusingly.

**Fix:** Narrow `asyncRewake` to boolean at the runtime guard layer (cited in
the comment at `hooks.ts:184` as "runtime narrowing in
bridges/hooks/async-rewake/"), then propagate the narrowed boolean through to
`detectOrphanRewake`. Alternatively, document that the schema admits any value
but the strict `=== true` check is the supportability gate — a caller passing
`"true"` (stringified) intentionally is wrong and the orphan-rewake warning
is the correct user-visible signal.

### IN-04: Duplicate `isRecordedButDisabled` in update.ts mirrors reconcile/plan.ts

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:951-968`
**Issue:** The function is intentionally duplicated to avoid pulling the
reconcile module into the orchestrator's import graph — comment at lines
951-957. This is acknowledged technical debt. If the rule in
`reconcile/plan.ts::isRecordedButDisabled` ever changes, this mirror will
silently drift and an `update` against a recorded-but-disabled plugin may
behave differently from a `reconcile` apply.

**Fix:** Promote `isRecordedButDisabled` to `shared/` (where both reconcile
and update can import it without crossing boundaries) and remove the mirror.
Or add a runtime test that asserts behavioral parity between the two
implementations by exercising identical inputs through both modules.

---

_Reviewed: 2026-06-16T23:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

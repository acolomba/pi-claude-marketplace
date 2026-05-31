---
phase: 18-migration-wave-1-marketplace-orchestrator-family
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - eslint.config.js
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/autoupdate.test.ts
  - tests/edge/handlers/marketplace/list.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
  - tests/integration/fold-adoption.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/marketplace/list.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-05-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 18 Wave 1 migrates the five marketplace orchestrators (add, autoupdate, list, remove, update) plus their edge handlers from V1 severity-named wrappers to V2 structured `notify(ctx, pi, NotificationMessage)`. The migration is broadly correct: V1 wrappers are absent from non-comment lines in all five marketplace orchestrators, every `*Options` interface lists `pi: ExtensionAPI` as required (not optional), discriminated `MarketplaceNotificationMessage` / `PluginNotificationMessage` payloads use only valid status tokens from `MARKETPLACE_STATUSES` and `PLUGIN_STATUSES`, the `outcomeToCascadePluginMessage` rewrite forwards `from`/`to`/`dependencies`/`reasons`/`cause` to the matching discriminated variants, and test assertions are byte-exact (no regex flexibility) per D-18-06. The eslint MSG-Block 1+1b ignores are correctly narrowed to `orchestrators/marketplace/**`, and the migrated orchestrators no longer import `presentation/*` for user-visible surfaces (the single retained `composeErrorWithCauseChain` import in `update.ts` feeds the legacy `notes` field for non-notify consumers, which is consistent with the documented transitional bridge).

Issues found:
- **Two genuine user-visible defects**: `autoupdate.ts` emits a `(unknown)` failure name fallback that is reachable from the bare form on non-not-found errors; and `update.ts` line 599 `catch {}` discards the typed `MarketplaceUpdateError` instance so the documented `retryHint` "stays internal for programmatic inspection" claim is structurally untrue.
- **Two correctness-adjacent concerns**: short-circuit `return` on first scope failure in `autoupdate.ts` silently abandons unprocessed scopes; and `remove.ts` swallows ALL exceptions from cache invalidation including non-leak failures (e.g., container-violation throws).
- **Three info-class style/quality items** in dead-code defensive checks, slightly stale comment references, and redundant predicate flags.

## Warnings

### WR-01: `autoupdate.ts` emits `(unknown)` as marketplace name on bare-form non-not-found failures

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:152`
**Issue:** In `setMarketplaceAutoupdate`, the per-scope catch block at lines 142-164 emits an immediate `(failed)` notification when `shouldCollectNotFound(opts, err)` returns false. The fallback `const failureName = opts.name ?? "(unknown)"` is structurally reachable from the bare form (`opts.name === undefined`), because `shouldCollectNotFound` requires `opts.name !== undefined` to return true -- so any non-not-found error in the bare form falls through this branch with `opts.name === undefined`, producing a literal `⊘ (unknown) [<scope>] (failed)` rendering. While `applyAutoupdateFlipInPlace` itself only throws `MarketplaceNotFoundError`, the surrounding `withStateGuard` can throw state-load failures, lockfile-acquire failures, or atomic-write failures -- none of which are `MarketplaceNotFoundError`. The user then sees an opaque "(unknown)" name instead of the marketplace whose flip failed (or the scope's name). No test covers the bare-form / non-not-found path.
**Fix:** Either (a) make the `(unknown)` placeholder structurally unreachable by routing bare-form non-not-found errors through a different surface (e.g., re-throw to the edge layer for a usage-error-style notify, since the orchestrator cannot meaningfully render a per-marketplace `(failed)` row when no specific marketplace name is in scope), or (b) add a regression test that pins the rendered byte form for the bare-form lock-failure path so future migrations can audit the surface. Suggested code change:
```ts
if (!shouldCollectNotFound(opts, err)) {
  if (opts.name === undefined) {
    // Bare-form non-not-found failures cannot be tied to a specific
    // marketplace; rethrow so the edge layer surfaces a usage-error.
    throw err;
  }

  notify(opts.ctx, opts.pi, {
    marketplaces: [
      { name: opts.name, scope, status: "failed", plugins: [] },
    ],
  });
  return;
}
```

### WR-02: `update.ts` catch block discards the typed `MarketplaceUpdateError`, invalidating the documented "retryHint stays internal for programmatic inspection" claim

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:599`
**Issue:** The catch block `} catch {` at line 599 swallows the error with no binding. The lengthy comment above the notify call (lines 600-612) claims `err.retryHint` is preserved for "programmatic inspection" of `MarketplaceUpdateError`, but no caller can observe the error -- it is structurally unreachable from outside `refreshOneMarketplace`. The rendered byte form is correct, but the comment misleads future maintainers about what's actually preserved. The `retryHint` field on `MarketplaceUpdateError` is also constructed at lines 282-289 and immediately discarded.
**Fix:** Either remove the misleading comment about "programmatic inspection" (the truth is that retryHint is constructed and discarded), or stash the typed error on a module-private last-error slot / return it from the function for callers that want to observe it. Suggested minimal change to the comment:
```ts
} catch {
  // Plan 18-05 / D-18-02: marketplace-level failure renders as the
  // bare V2 header. The V1 retry-hint trailer is DROPPED; the
  // MarketplaceUpdateError.retryHint field is constructed at lines
  // 282-289 then discarded here -- no caller observes it. A future
  // V2 enhancement could surface it via a typed return value.
  notify(ctx, pi, {
    marketplaces: [{ name, scope, status: "failed", plugins: [] }],
  });
  return;
}
```

### WR-03: `autoupdate.ts` early-return on first-scope failure silently abandons unprocessed scopes

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:163`
**Issue:** In the SC-6 bare-scope branch (`opts.scope === undefined`), the orchestrator iterates `["project", "user"]`. If the FIRST scope (project) encounters a non-not-found error (e.g., state lock held), the catch block emits a `(failed)` notification AND `return`s on line 163, skipping the user scope entirely. The test "single-name cross-scope flip surfaces state lock failures" exercises exactly this path and asserts only the rendered byte -- but it does not assert that the user scope was actually processed. For a single-name flip where the marketplace exists in user scope, the user gets a project-scope `(failed)` and never has their user-scope marketplace touched, with no surfaced indication. V1 may have had the same behavior, but the V2 migration codifies it without a catalog fixture pinning the contract.
**Fix:** Either (a) continue iteration after non-not-found errors, accumulating failures for end-of-run rendering (matches the bare-form notify-once pattern shown at line 237); or (b) document in the orchestrator header comment that bare-form scope iteration halts on first non-not-found error and the catalog UAT does not cover this case. Option (a) is the closer match to the design contract; option (b) is the lower-cost change. Suggested option (a):
```ts
} catch (err) {
  if (!shouldCollectNotFound(opts, err)) {
    errors.push({ scope, cause: err });
    continue;  // do not early-return; iterate remaining scopes
  }

  errors.push({ scope, cause: err });
}
```
…and add a final "any non-not-found errors → emit per-scope `(failed)` rows in the same notify() call" reconciliation at the end of the function.

### WR-04: `remove.ts` post-state cache-cleanup catch swallows non-leak failures including container-violation throws

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:257-263`
**Issue:** The post-state cleanup `try { … } catch {}` swallows EVERY error from `invalidateMarketplaceNames` and `dropMarketplaceCache`. The comment cites D-18-01 ("cleanup-leak DROP") as justification, but the V1 contract specifically scoped "cleanup leak" to disk-IO errors during best-effort cleanup. If either of these helpers ever evolves to throw a contract-violation error (e.g., the `locations.pluginCacheFile(name)` resolver throws a path-containment violation per NFR-10), that throw is silently absorbed and the user sees a clean `(removed)` notification even though the cache subsystem is in an inconsistent state. The same issue applies to `add.ts:150-158`.
**Fix:** Narrow the catch to disk-IO errno codes (EACCES/EPERM/ENOENT/EBUSY/EIO) -- the actual "cleanup leak" surface -- and re-throw anything else. Suggested narrowing:
```ts
try {
  await invalidateMarketplaceNames(locations.marketplaceNamesCacheFile, resolved.scope);
  const cachePath = await locations.pluginCacheFile(opts.name);
  await dropMarketplaceCache(cachePath, resolved.scope, opts.name);
} catch (err) {
  // D-18-01 precedent: cleanup leaks (disk IO) are swallowed.
  // Any OTHER error (e.g., NFR-10 path-containment violation from
  // pluginCacheFile) indicates a contract bug, not hygiene -- rethrow.
  const code = (err as NodeJS.ErrnoException).code;
  if (code !== "EACCES" && code !== "EPERM" && code !== "ENOENT" &&
      code !== "EBUSY" && code !== "EIO") {
    throw err;
  }
}
```

## Info

### IN-01: `add.ts` dead-code branch for unsupported source kinds is unreachable under current parser contract

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:107-111`
**Issue:** The check `if (source.kind !== "github" && source.kind !== "path")` is structurally unreachable after the `source.kind === "unknown"` narrowing on line 103 IF `parsePluginSource` returns only `github | path | unknown`. Per `orchestrators/import/execute.ts:209-213`, the parser CAN also produce `url`, `git-subdir`, and `npm` kinds -- so this branch is defensive against future parser expansions but currently dead. The comment doesn't explain this defensive intent.
**Fix:** Add a one-line comment clarifying the intent:
```ts
// Defensive: parsePluginSource may return url/git-subdir/npm kinds
// per domain/source.ts. The marketplace add surface only supports
// github + path; reject anything else with a clear message.
if (source.kind !== "github" && source.kind !== "path") {
```

### IN-02: Comment block in `add.ts` lines 78-85 references "Plan 18-00 (Wave 0)" plumbing as if `pi` were not yet consumed, but the next 80 lines actively consume `pi`

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:78-85`
**Issue:** The JSDoc comment on the `pi` field reads "Today this orchestrator does not yet read `pi` (the V1 wrappers handle severity routing); the migration to V2 lands in Plan 18-01." But Plan 18-01 has landed -- the orchestrator IS reading `pi` at line 170 via `notify(opts.ctx, opts.pi, ...)`. Stale post-Wave-0 documentation.
**Fix:** Update the comment to reflect current state:
```ts
/**
 * Factory `pi` reference. Plumbed in Plan 18-00 (Wave 0); consumed
 * in Plan 18-01 by the V2 `notify(ctx, pi, message)` call at the
 * bottom of this function for severity / reload-hint / soft-dep
 * probe routing per D-16-11 / D-16-12 / D-16-14.
 */
```
The same staleness applies to `autoupdate.ts:73-78` ("Plumbed in Plan 18-00; consumed in Plan 18-02..." -- accurate but worded as future-tense) and similar JSDoc on `list.ts:36-41` and `update.ts:148-164`.

### IN-03: `cascadeAutoupdates` failed outcome explicitly emits `declaresAgents: false` / `declaresMcp: false` then `outcomeToCascadePluginMessage` re-derives them as absent

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:354-358`
**Issue:** The catch in `cascadeAutoupdates` produces a `PluginUpdateFailedOutcome` with explicit `declaresAgents: false, declaresMcp: false`. The comment at lines 354-358 justifies this on grounds of "compile-time honesty" (Task 260525-cjr B1 / CMC-13). But `outcomeToCascadePluginMessage`'s `case "failed"` branch (lines 488-500) does NOT forward these flags to the `PluginFailedMessage` shape (correctly -- D-15-02 confines `dependencies` to installed/updated/reinstalled). The explicit `false` values are dead state at the cascade output and only kept for the outcome-aggregator non-notify consumers. The comment doesn't surface that the values are deliberately observed only by aggregators.
**Fix:** Optional comment refinement:
```ts
// CMC-13 / Task 260525-cjr B1: required `boolean` on the outcome
// contract. `(failed)` cascade rows do not render the soft-dep marker
// (MSG-SD-3), and outcomeToCascadePluginMessage does NOT forward these
// to PluginFailedMessage (D-15-02). The values exist for non-notify
// aggregators (JSON-mode outcome consumers) and the producer-honesty
// invariant only.
declaresAgents: false,
declaresMcp: false,
```

---

_Reviewed: 2026-05-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 47-plugin-ops-attribution-cross-scope
reviewed: 2026-06-07T23:12:36Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - docs/output-catalog.md
  - tests/architecture/catalog-uat.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: resolved
---

# Phase 47: Code Review Report

**Reviewed:** 2026-06-07T23:12:36Z
**Depth:** deep
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 47 re-attributes the marketplace-existence/scope precondition across all four plugin
operations (install/uninstall/reinstall/update) to the canonical `(failed) {not added}` form,
adds a discriminated cross-scope resolver, and tightens cascade-failure reason classification.
The core attribution logic is correct: CMP-3 (the project→user install fallback) is demonstrably
preserved byte-for-byte; the ATTR-08 install split (M1 vs M2) is clean; ATTR-09 truthful reasons
land correctly; the cascade never-throw contract in `updateSinglePlugin/preflightUpdate` is intact;
and all new catalog states have paired fixtures. The implementation is sound at the requirement
level.

Three warnings merit attention before Phase 48: a SCOPE-01 test gap for the update
`<plugin>@<mp>` form, a code-duplication risk with the per-file `MarketplaceNotAddedSignal`
class, and the reinstall MARKETPLACE form's explicit-scope path not doing a cross-scope read (it
signals `{not added}` with the requested scope but without confirming whether the marketplace
actually exists in the other scope). Three info items round out the findings.

## Structural Findings (fallow)

None provided.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: SCOPE-01 test gap -- update `<plugin>@<mp>` explicit-scope-miss path is untested

**File:** `tests/orchestrators/plugin/update.test.ts` (no specific line -- missing test)

**Issue:** The SCOPE-01 test coverage for `updatePlugins` only covers the `@<mp>` marketplace form
(test at line 1083: "marketplace present only in other scope → `{not added} [user]`"). The
`<plugin>@<mp>` form with an explicit scope where the marketplace exists only in the OTHER scope
has no dedicated SCOPE-01 test.

The runtime path does work correctly: `resolveUpdateMarketplaceScope` with `target.kind ===
"plugin"` calls `resolveInstalledPluginTarget`, which on an explicit scope returns the requested
scope blindly (without checking state), then `enumerateMarketplaceTarget` loads state for that
scope, finds `mp === undefined`, and throws `MarketplaceNotAddedSignal(mpName, explicitScope)` --
producing the correct `{not added} [scope]` output. However, this code path reaches the right
output via the defensive `mp === undefined` guard in `enumerateMarketplaceTarget` rather than via
`resolveInstalledMarketplaceTarget`'s `other-scope` arm. If the defensive guard were ever removed
or refactored, the SCOPE-01 signal would silently stop working for the plugin form.

**Fix:** Add a test asserting that `updatePlugins` with `target.kind = "plugin"`, an explicit scope,
and the marketplace installed only in the other scope emits standalone `{not added} [requestedScope]`:

```typescript
test("SCOPE-01 <plugin>@<mp>: marketplace present only in other scope -> standalone {not added} [requestedScope]", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-scope01-plugin-other-"));
    try {
      // Seed the marketplace in PROJECT; ask for USER explicitly.
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "user",       // project has it; user doesn't
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(notifications[0]?.message, "⊘ mp [user] (failed) {not added}");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
```

---

### WR-02: `MarketplaceNotAddedSignal` duplicated across `reinstall.ts` and `update.ts`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:202` and
`extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:157`

**Issue:** `MarketplaceNotAddedSignal` is a private `class ... extends Error` declared identically
in both files. Because `instanceof` checks are class-identity checks, a signal thrown by
`reinstall.ts` would not be detected by `update.ts`'s `err instanceof MarketplaceNotAddedSignal`
guard (and vice versa). The two files do not currently import each other, so this is not a live
bug -- but it creates a footgun for any future code that imports both orchestrators and tries to
catch the signal uniformly. It also violates the DRY principle in a way that matters for typed
dispatch: an exported version of the class would be one source of truth.

Additionally, the class `name` field is set to `"MarketplaceNotAddedSignal"` in both constructors,
so string-based `err.name` checks would work cross-file, but `instanceof` would not. The existing
`handleEnumerationFailure` / `handleEnumerateFailure` functions use `instanceof` -- correctly, since
they only catch signals from within their own file's call graph.

**Fix:** Export `MarketplaceNotAddedSignal` from `plugin/shared.ts` (alongside the other shared
chokepoint types) and import it in both `reinstall.ts` and `update.ts`:

```typescript
// plugin/shared.ts -- add this alongside CrossScopePluginResolution
/** ATTR-02 / ATTR-03 / D-47-A structural signal for the marketplace-existence precondition. */
export class MarketplaceNotAddedSignal extends Error {
  readonly marketplace: string;
  readonly requestedScope?: Scope;
  constructor(marketplace: string, requestedScope?: Scope) {
    super(`Marketplace "${marketplace}" not added.`);
    this.name = "MarketplaceNotAddedSignal";
    this.marketplace = marketplace;
    if (requestedScope !== undefined) {
      this.requestedScope = requestedScope;
    }
  }
}
```

Then remove the per-file declarations and import from `shared.ts`. This also makes Phase 48
(marketplace-op attribution) easier if it adopts the same signal pattern.

---

### WR-03: Reinstall MARKETPLACE-form explicit-scope path skips the cross-scope read

**File:**
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:582-590`
(`resolveMarketplaceReinstallScope`, MARKETPLACE form, explicit scope branch)

**Issue:** When `target.kind === "marketplace"` with an explicit scope and the marketplace
container is absent in the requested scope, the code throws `MarketplaceNotAddedSignal(marketplace,
explicitScope)` immediately -- without reading the other scope to determine whether the marketplace
exists there. This means two distinct situations produce the identical output:

1. The marketplace is absent in BOTH scopes.
2. The marketplace is present in the other scope but not the requested scope.

Both emit `{not added} [requestedScope]`, and neither tells the operator whether the marketplace
is "not added anywhere" or "not added in this scope but IS in the other." By contrast:

- The `resolveInstalledMarketplaceTarget` function (used by `update.ts`) DOES read the other scope
  and returns the `other-scope` discriminated arm.
- The reinstall PLUGIN form (via `resolveCrossScopePluginTarget`) DOES check the other scope for the
  plugin row and surfaces `other-scope` when found.

The accepted Open Question #1 resolution (bracket-only, no explicit "present in other" phrase)
means this is not a visible behavior difference for the operator -- both cases produce the same
bracket. But the `other-scope` arm in the discriminated resolver is never returned for the
MARKETPLACE reinstall form, creating a permanent dead arm in `CrossScopePluginResolution` for
this code path, and future phase work that adds a richer "present in <other> scope" hint would
need to be retrofitted here.

This inconsistency between the reinstall MARKETPLACE form and the update MARKETPLACE form
(which uses `resolveInstalledMarketplaceTarget` and gets the proper `other-scope` arm) is a
quality gap that will surface if SCOPE-01 behavior is extended in Phase 49.

**Fix:** Replace the inline explicit-scope check in `resolveMarketplaceReinstallScope` with a call
to `resolveInstalledMarketplaceTarget` (which already has the correct cross-scope logic), mirroring
the update path:

```typescript
// MARKETPLACE form, explicit scope -- replace lines 582-590:
if (explicitScope !== undefined) {
  const resolution = await resolveInstalledMarketplaceTarget({
    cwd,
    marketplace,
    explicitScope,
  });
  if (resolution.kind === "resolved") {
    return { scope: resolution.scope, locations: resolution.locations };
  }
  // marketplace-absent OR other-scope → signal with the requested scope
  throw new MarketplaceNotAddedSignal(marketplace, explicitScope);
}
```

This is a one-function replacement that eliminates the duplicated scope-read logic and ensures
consistent behavior with the update MARKETPLACE form.

## Info

### IN-01: Unnecessary state write on install M1 (marketplace-absent) path

**File:**
`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:349-357`
(inside the `withStateGuard` closure)

**Issue:** When `source === undefined` (marketplace absent), the guard closure sets
`marketplaceAbsent = true` and returns normally. Because `withStateGuard` calls `saveState` on any
non-throwing closure return (see `transaction/with-state-guard.ts:73`), the unchanged state is
re-written to disk. The install never mutates `state.marketplaces`, so this is a zero-delta write
(same bytes in, same bytes out), but it still holds the scope lock, calls `saveState`, and
performs the atomic tmp-rename cycle unnecessarily.

This is consistent with the pre-existing `alreadyGone` pattern in `uninstall.ts` (lines 205,
215), which also performs an unnecessary save on the silent-converge path. The comment at
install.ts:353 acknowledges this: "Returning here lets the guard re-save the unchanged state;
the operation is read-only in effect."

**Fix:** Extract the marketplace-existence check to BEFORE the `withStateGuard` call (similar to
how `uninstallPlugin` now calls `resolveCrossScopePluginTarget` before entering the guard). This
would avoid acquiring the lock entirely for the marketplace-absent case:

```typescript
// Before withStateGuard:
const source = await resolveInstallMarketplaceSource({ targetScope: scope, cwd, marketplace,
  targetState: await loadState(locationsFor(scope, cwd).extensionRoot) });
if (source === undefined) {
  // emit {not added} and return -- no lock, no save
}
```

Caution: this requires reading state twice (once for the preflight, once inside the guard) which
introduces a TOCTOU window. The current sentinel pattern avoids the double-read. Acceptable
trade-off for a deferred cleanup; the current code is correct if wasteful.

---

### IN-02: `preflightUpdate` concurrent-removal outcome still reports `"not in manifest"` reason

**File:**
`extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:618-625`
(`preflightUpdate`, `mp === undefined` concurrent-removal branch)

**Issue:** After Phase 47's direct-path hoist, the `preflightUpdate` `mp === undefined` branch is
only reachable as a concurrent-removal edge (the marketplace existed at enumeration time but was
removed before `preflightUpdate` loaded state). The outcome it returns carries
`reasons: ["not in manifest"]` -- a reason that claims the plugin is absent from the manifest
(false) rather than "the marketplace was concurrently removed." This was an explicit plan decision
(47-03 SUMMARY: "Did NOT retype the `preflightUpdate` M9 reason"), but it means the concurrent
removal edge still reports a misleading reason.

The swapState test at update.test.ts:1468 verifies this path produces a `skipped` outcome with
no error notification, but only asserts `/skipped/` on the message body without checking the
specific reason string. If an operator reads the cascade output for a concurrent-removal event,
they see `(skipped) {not in manifest}` when the truth is "the marketplace was removed during
the operation."

**Fix:** Change the reason on the concurrent-removal guard to a truthful member. The closest
existing `ContentReason` member is `"concurrently uninstalled"` (which `narrowSkipReasons` already
maps to for the concurrent-plugin-removal case):

```typescript
return {
  partition: "skipped",
  name: plugin,
  notes: [`marketplace "${marketplace}" not found in ${scope} scope`],
  reasons: ["concurrently uninstalled"] as const,   // was "not in manifest"
  declaresAgents: false,
  declaresMcp: false,
};
```

Alternatively, defer to Phase 48/49 where all lying reasons are reviewed holistically.

---

### IN-03: `reasonsFromTypedError` in `reinstall.ts` retains dead `MarketplaceNotFoundError → ["not found"]` mapping

**File:**
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:966-968`

**Issue:** `reasonsFromTypedError` in `reinstall.ts` still contains:

```typescript
if (err instanceof MarketplaceNotFoundError) {
  return ["not found"] as const;
}
```

The 47-02 SUMMARY documents this as "left defensively: the mp-existence case no longer reaches it
(resolveScopeFromState's throw is caught and re-attributed to the no-bracket signal inside
resolveMarketplaceReinstallScope), but no live non-mp-existence caller was removed." This mapping
is now dead code for the marketplace-existence case. If `resolveScopeFromState` ever throws
`MarketplaceNotFoundError` for a reason other than the two-scope miss (a future change), this
would silently map it to `{not found}` without the diagnostic visibility of the `unreadable`
fallback.

**Fix:** Remove the dead mapping and rely on the `undefined`-fallback to the `narrowReasons`
substring path for any future `MarketplaceNotFoundError` that slips through -- or add an explicit
comment marking it dead and explaining why it is left for defensive coverage. If removed, confirm
no test regresses:

```bash
node --test tests/orchestrators/plugin/reinstall.test.ts
```

---

_Reviewed: 2026-06-07T23:12:36Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Resolution (orchestrator, 2026-06-07)

Fixed in commit `a493ef6` (npm run check GREEN 1490/1490):

- **WR-01 -- FIXED.** Added the SCOPE-01 `<plugin>@<mp>` explicit-scope-miss test to update.test.ts.
- **WR-02 -- FIXED.** `MarketplaceNotAddedSignal` exported from `plugin/shared.ts` as one source of
  truth; reinstall.ts + update.ts import it (removes the cross-file `instanceof` footgun ahead of
  Phase 48).
- **WR-03 -- FIXED.** reinstall MARKETPLACE-form explicit-scope path routes through
  `resolveInstalledMarketplaceTarget` for cross-scope consistency with update. Byte-neutral
  (output-catalog.md unchanged).
- **IN-03 -- FIXED (comment).** Marked the dead defensive `MarketplaceNotFoundError -> ["not found"]`
  mapping in reinstall `reasonsFromTypedError`.
- **IN-01 -- DEFERRED (accepted).** The suggested preflight-before-guard fix introduces a TOCTOU
  double-read; the current sentinel pattern is correct if mildly wasteful. Not worth the regression.
- **IN-02 -- DEFERRED to Phase 49.** The `preflightUpdate` concurrent-removal reason
  (`{not in manifest}`) is a rare concurrency edge outside Phase 47's closed-requirement scope;
  Phase 49 reviews all lying reasons holistically across the op matrix.

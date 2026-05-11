---
phase: 07-integration-pi-wiring
reviewed: 2026-05-11T21:05:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - extensions/claude-marketplace/platform/pi-api.ts
  - extensions/claude-marketplace/presentation/soft-dep.ts
  - extensions/claude-marketplace/domain/manifest.ts
  - extensions/claude-marketplace/orchestrators/discover.ts
  - extensions/claude-marketplace/index.ts
  - extensions/claude-marketplace/transaction/with-state-guard.ts
  - extensions/claude-marketplace/persistence/locations.ts
  - extensions/claude-marketplace/shared/errors.ts
  - extensions/claude-marketplace/shared/markers.ts
  - extensions/claude-marketplace/orchestrators/edge-deps.ts
  - extensions/claude-marketplace/edge/register.ts
  - extensions/claude-marketplace/orchestrators/plugin/install.ts
  - extensions/claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/claude-marketplace/orchestrators/plugin/update.ts
  - extensions/claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - tests/e2e/_helpers.ts
  - tests/e2e/resources-discover.test.ts
  - tests/e2e/install-soft-deps.test.ts
  - tests/e2e/pi-runtime-smoke.test.ts
  - tests/integration/concurrent-install.test.ts
  - tests/integration/concurrent-install-child.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/transaction/with-state-guard.test.ts
  - package.json
  - .github/workflows/ci.yml
  - .github/workflows/e2e-nightly.yml
findings:
  critical: 2
  warning: 3
  info: 0
  total: 5
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-05-11T21:05:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Reviewed Phase 7 Pi wiring, manifest seam, resources discovery, state-locking, e2e/integration tests, package scripts, and CI workflows. The implementation contains correctness issues in project-scope discovery and cross-scope autoupdate error handling, plus robustness/test-gate gaps around lock cleanup and runtime smoke coverage.

## Critical Issues

### CR-01: `resources_discover` ignores the event cwd and can discover the wrong project scope

**Classification:** BLOCKER
**File:** `extensions/claude-marketplace/index.ts:12-25`
**Issue:** The handler casts `pi.on("resources_discover", ...)` to a zero-argument callback and uses `process.cwd()` for project locations. The modeled event includes `cwd`, and the e2e test passes that cwd, but the implementation ignores it. In a real Pi process serving a session whose project cwd differs from the process cwd, `/reload` will miss that project's staged resources or expose resources from the wrong project root.

**Fix:** Accept the event argument and resolve the project scope from `event.cwd`, falling back only when absent if the runtime truly permits that.

```ts
const onResourcesDiscover = pi.on.bind(pi) as unknown as (
  event: "resources_discover",
  handler: (event: ResourcesDiscoverEvent) => Promise<ResourcesDiscoverResult>,
) => void;

onResourcesDiscover("resources_discover", async (event) => {
  const discovered = await aggregateDiscoveredResources(
    locationsFor("user", homedir()),
    locationsFor("project", event.cwd),
  );
  return { skillPaths: [...discovered.skillPaths], promptPaths: [...discovered.promptPaths] };
});
```

### CR-02: Autoupdate swallows lock/IO failures as if they were missing-scope lookups

**Classification:** BLOCKER
**File:** `extensions/claude-marketplace/orchestrators/marketplace/autoupdate.ts:54-88`
**Issue:** `setMarketplaceAutoupdate` catches every error from `withStateGuard` and treats it like a tolerable per-scope miss. After Phase 7, `withStateGuard` can throw `StateLockHeldError` or other real IO failures. If one scope succeeds and the other is locked, the function emits a normal success message and silently leaves the locked scope unchanged; if a bare command hits a locked scope plus an empty other scope, it can claim `No marketplaces configured.` This is incorrect user-visible behavior for a mutating operation.

**Fix:** Only suppress `MarketplaceNotFoundError` for the single-name, no-scope cross-scope lookup case. Surface `StateLockHeldError` and other non-not-found errors immediately, or aggregate them as warning/error partial failures.

```ts
} catch (err) {
  if (opts.name !== undefined && err instanceof MarketplaceNotFoundError) {
    errors.push({ scope, cause: err });
    continue;
  }
  notifyError(opts.ctx, errorMessage(err), err);
  return;
}
```

## Warnings

### WR-01: Lock release failures can mask the original mutate/save failure

**Classification:** WARNING
**File:** `extensions/claude-marketplace/transaction/with-state-guard.ts:74-81`
**Issue:** The `finally` block awaits `release()` directly. If `mutate`, `loadState`, or `saveState` throws and the release call also throws, the release error replaces the original failure. That hides the actionable cause from users and from rollback/error handling.

**Fix:** Preserve the primary error and append release failure details instead of letting `release()` mask it.

```ts
let primary: unknown;
try {
  const fresh = await loadState(locations.extensionRoot);
  const result = await mutate(fresh);
  await saveState(locations.extensionRoot, fresh);
  return result;
} catch (err) {
  primary = err;
  throw err;
} finally {
  try {
    await release();
  } catch (releaseErr) {
    if (primary === undefined) throw releaseErr;
    // attach/log releaseErr without replacing primary
  }
}
```

### WR-02: Lock acquisition wraps all failures as contention

**Classification:** WARNING
**File:** `extensions/claude-marketplace/transaction/with-state-guard.ts:62-72`
**Issue:** Any `proper-lockfile.lock` failure is converted to `StateLockHeldError`. Permission errors, invalid paths, filesystem failures, or corrupted lockfile state will be reported as "Another claude-marketplace operation is in progress," which gives users the wrong recovery action and can hide real filesystem defects.

**Fix:** Inspect the lock error and only throw `StateLockHeldError` for actual held-lock conditions. Propagate or wrap other errors with their real cause and message.

### WR-03: Runtime smoke can pass without proving the extension registered or handled anything

**Classification:** WARNING
**File:** `tests/e2e/_helpers.ts:196-202`; `tests/e2e/pi-runtime-smoke.test.ts:6-10`
**Issue:** The smoke runs `pi --offline --no-extensions --extension <index.ts> --help` and accepts any help output that lacks `failed to load` / `error loading`. Many CLIs render help before fully loading extensions or without exercising command/event registration, so this can pass while the extension entrypoint, command wiring, or `resources_discover` handler is broken.

**Fix:** Make the smoke assert a real noninteractive extension surface: invoke `/claude:plugin` help/list through the Pi command dispatch if available, or assert the runtime reports the extension-loaded command/tool/event registrations. If Pi has no such noninteractive surface, fail closed with explicit manual smoke evidence rather than accepting generic help output.

---

_Reviewed: 2026-05-11T21:05:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_

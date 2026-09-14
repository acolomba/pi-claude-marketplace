# Phase 5: Injection and Ownership Design - Pattern Map

**Mapped:** 2026-09-07
**Files analyzed:** 36 source/test targets (grouped by ownership boundary)
**Analogs found:** 36 / 36

## File Classification

| New/Modified File or Family                                                                                                                                                                                                                                     | Role                                       | Data Flow                          | Closest Tracked Analog                                               | Match Quality   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------- | --------------- |
| `extensions/pi-claude-marketplace/bridges/hooks/runtime.ts` (new) and `tests/bridges/hooks/runtime.test.ts` (new)                                                                                                                                               | lifecycle store + owner test               | event-driven                       | `domain/manifest-cache.ts` + `tests/domain/manifest-cache.test.ts`   | exact ownership |
| `bridges/hooks/{routing-state,event-router,dispatch,settle}.ts`, `bridges/hooks/async-rewake/registry.ts` and mirrored owner tests                                                                                                                              | hooks/runtime consumers                    | event-driven                       | `domain/manifest-cache.ts` factory; existing `OrphanProbes` contract | role-match      |
| `extensions/pi-claude-marketplace/shared/completion-cache.ts` and `tests/shared/completion-cache.test.ts`                                                                                                                                                       | cache service + owner test                 | file-I/O                           | `domain/manifest-cache.ts` + its owner test                          | exact           |
| `edge/completions/{data,provider}.ts`, command registration/composition, and mirrored tests                                                                                                                                                                     | provider/composition                       | request-response                   | `domain/manifest.ts` composition of `createManifestCache`            | role-match      |
| `extensions/pi-claude-marketplace/index.ts` and `tests/index.test.ts`                                                                                                                                                                                           | lifecycle composition root                 | event-driven                       | current extension factory composition at `index.ts:29-85`            | exact location  |
| `bridges/skills/unstage.ts`, `bridges/hooks/stage.ts`, `orchestrators/plugin/{fetch,enable-disable,install,info,uninstall,reinstall}.ts`, `persistence/state-io.ts`, `orchestrators/reconcile/apply.ts`, `shared/path-safety.ts` and their mirrored owner tests | consumer-owned port + service/orchestrator | file-I/O / transactional           | `orchestrators/marketplace/shared.ts` `GitOps` + `DEFAULT_GIT_OPS`   | role-match      |
| `orchestrators/marketplace/{add,remove,update}.ts`, `orchestrators/plugin/{install,update,uninstall,reinstall}.ts` and mirrored tests                                                                                                                           | cache invalidators                         | transactional file-I/O             | one required `GitOps` instance shared across a workflow              | role-match      |
| `edge/handlers/plugin/list.ts` and its owner test; `tests/architecture/flag-catalog-drift.test.ts`                                                                                                                                                              | controller + contract test                 | request-response / static contract | existing independent literal catalog pin and public handler tests    | exact cleanup   |

The planner should let TypeScript enumerate secondary signature migrations from these roots. It must not schedule `bridges/skills/stage.test.ts`, the Phase 6 split files, or removal of `createRequire`/`syncBuiltinESMExports`.

## Pattern Assignments

### Hooks runtime and completion cache (owned stores, event-driven/file-I/O)

**Primary analog:** `extensions/pi-claude-marketplace/domain/manifest-cache.ts`

**Factory-owned state pattern** (lines 63-81):

```typescript
export type ManifestLoader = (manifestPath: string) => Promise<unknown>;

export function createManifestCache(load: ManifestLoader): {
  load(manifestPath: string): Promise<unknown>;
} {
  const entries = new Map<string, ManifestCacheEntry>();

  return {
    async load(manifestPath: string): Promise<unknown> {
```

Copy the ownership, not the small API: construct mutable maps/cells inside a factory closure, expose typed production operations, and obtain isolation by constructing another instance. Do not export maps or a reset operation. For hooks, one object must own routing/generation, settle, and async live state together; callbacks capture that same object.

**Preserve observable error identity** (lines 91-106, 124-131):

```typescript
const hit = entries.get(manifestPath);
if (hit?.mtimeMs === st.mtimeMs && hit.size === st.size) {
  if (hit.ok) return hit.value;
  throw hit.thrown;
}

let outcome: ManifestLoadOutcome;
try {
  outcome = { ok: true, value: await load(manifestPath) };
} catch (err) {
  outcome = { ok: false, thrown: err };
}
```

The completion refactor should similarly preserve schema versions, TTL, poison rows, ENOENT behavior, and thrown values while changing only ownership.

**Production composition pattern:** `extensions/pi-claude-marketplace/domain/manifest.ts` (lines 82-99)

```typescript
const manifestCache = createManifestCache(loadMarketplaceManifestUncached);

export async function loadMarketplaceManifest(manifestPath: string): Promise<MarketplaceManifest> {
  return manifestCache.load(manifestPath) as Promise<MarketplaceManifest>;
}
```

Phase 5 changes the lifetime: construct `HooksRuntime` and `CompletionCache` once in `index.ts`, then pass the same required instances to registration, callbacks, completion readers, and mutation invalidators. Do not copy this analog's module singleton lifetime.

**Owner-test imports, real temporary tree, and cleanup:** `tests/domain/manifest-cache.test.ts` (lines 1-24)

```typescript
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

async function createManifestFile(t: TestContext, contents = "{}") {
  const directory = await mkdtemp(path.join(tmpdir(), "manifest-cache-"));
  t.after(async () => rm(directory, { force: true, recursive: true }));
  const manifestPath = path.join(directory, "marketplace.json");
  await writeFile(manifestPath, contents, "utf8");
  return { directory, manifestPath };
}
```

**Fresh-instance isolation proof:** same test (lines 69-92). Construct two caches/runtimes, run the same key/event through each, and assert distinct public results and separate call counts. Add same-instance tests for stale callback invalidation and command-mutation-to-completion invalidation.

### Consumer-owned fault/timing ports (file-I/O / transactional)

**Primary analog:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`

**Narrow typed contract** (lines 113-144):

```typescript
export interface GitOps {
  clone(opts: { dir: string; url: string; ref?: string }): Promise<void>;
  fetch(opts: { dir: string; remote?: string; ref?: string }): Promise<void>;
  forceUpdateRef(opts: { dir: string; ref: string; value: string }): Promise<void>;
  checkout(opts: { dir: string; ref: string }): Promise<void>;
  resolveRef(opts: { dir: string; ref: string }): Promise<string>;
  currentBranch(opts: { dir: string }): Promise<string | undefined>;
  resolveRemoteRef(opts: { url: string; ref?: string }): Promise<string>;
}
```

Each new Phase 5 port should be smaller than this multi-operation domain port and named for its consumer: unstage removal, hook tree inspection/hydration, clone status, semantic transaction steps, info read/list, reconcile state read, or path-safety inspection. Do not introduce a universal filesystem bag.

**Visible real adapter** (lines 147-165):

```typescript
export const DEFAULT_GIT_OPS: GitOps = {
  clone: defaultGit.clone,
  fetch: defaultGit.fetch,
  forceUpdateRef: defaultGit.forceUpdateRef,
  checkout: defaultGit.checkout,
  resolveRef: defaultGit.resolveRef,
  currentBranch: defaultGit.currentBranch,
  resolveRemoteRef: defaultGit.resolveRemoteRef,
};
```

Copy the explicit adapter object and required composition wiring. Unlike legacy optional `deps = {}` examples, consumers must not select a default internally; production composition supplies the real adapter.

**Typed fake with explicit boundary and observable state:** `tests/platform/git-ops-fake.ts` (lines 8-25, 56-68, 100-125)

```typescript
export interface GitOpsFakeOptions {
  readonly boundary: "memory";
  readonly cloneError?: Error;
  readonly fetchError?: Error;
}

export interface GitOpsFake {
  readonly gitOps: GitOps;
  readonly state: GitOpsFakeState;
}

export function createGitOpsFake(options: GitOpsFakeOptions): GitOpsFake {
  if (options.boundary !== "memory") {
    throw new Error("createGitOpsFake requires the explicit memory boundary");
  }
  const calls: GitOpsFakeCalls = { /* typed operation logs */ };
```

Port tests may use small case-local implementations in owner tests. A shared fake is justified only when multiple owners use the same genuine contract. Keep public result, exact tree/bytes/error/notification, cleanup, and ordering assertions; call logs only prove forwarding.

### Hooks lifecycle wiring

**Composition location:** `extensions/pi-claude-marketplace/index.ts` (lines 29-85). Construct both owned instances at the top of `claudeMarketplaceExtension`; pass the hooks runtime to `registerHooksBridge`, resources-discover hydration/reconcile, and command mutations, and pass the cache to command completions and invalidators.

Keep the current registration order: factory-time registration/hydration completes before events, resources-discover hydrates the real project scope before reconcile, and callbacks capture the runtime generation. The runtime's production lifecycle transition replaces `resetEpoch`, `resetRoutingState`, and the test-facing meaning of `resetSettleState`; it is not a renamed test reset.

The existing `OrphanProbes` at `bridges/hooks/async-rewake/registry.ts:170-180` is a useful minimum-capability shape (only `killProbe` and `environReader`). Preserve it as an independent safety port. Do not fold it or `SpawnDeps` into a runtime super-bag, and do not alter PID persistence policy/schema.

### Public-contract cleanup

For `BOOLEAN_FLAGS`, hooks reset exports, completion reset, and the dead marketplace-name memory reader, use deletion rather than replacement seams. Update tests to assert only public behavior:

- keep the independent literal `list` flag row and list-handler behavior;
- create fresh runtime/cache instances instead of invoking reset exports;
- retain production reload/disposal behavior under lifecycle language;
- retain names-file schema and real invalidation after confirming the reader has no production consumer.

No analog should be copied for a test-only export: production use alone determines visibility.

## Shared Patterns

### Imports and contracts

Use Node built-ins first, a blank line, then relative project imports. Use named exports, `readonly` members, explicit exported return types, `import type` for type-only imports, and discriminated results where failures have domain meaning.

### Testing

Mirror every new source path under `tests/`. Use `node:test`, `node:assert/strict`, `arrange`/`act`/`assert`, real case-owned temporary filesystems for ordinary behavior, and typed substitutes only for the classified irreproducible boundary. Assert returned values and persisted state before collaborator logs.

### Error and safety preservation

Do not wrap or normalize existing failures unless the current public contract already does so. Preserve path containment and symlink refusal with both real adapters and injected inspectors. Preserve exact notifications for `applyReconcile` and `bootstrapClaudePlugin`; neither receives a broad dependency bundle.

### Phase 5/6 boundary

Phase 5 may add required contracts and wire real adapters. It must leave authorized `createRequire`/`syncBuiltinESMExports` machinery for Phase 6 and must not create resolver/notify/install/update/reinstall/list/catalog split files. `bridges/skills/stage.test.ts`, PID-table redesign, info splitting, and stale documentation counts remain out of scope.

## No Analog Found

None. The repository contains tracked patterns for factory ownership, required typed ports, visible real adapters, fresh-instance tests, hermetic temporary trees, and mirrored owner suites.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,platform,bridges,edge,orchestrators,shared}`, mirrored `tests/`, current Phase 5 context/research
**Files scanned:** CodeGraph symbol/call-path results plus 8 targeted tracked analog files
**Tracked-source verification:** all named analog paths returned by `git ls-files`
**Pattern extraction date:** 2026-09-07

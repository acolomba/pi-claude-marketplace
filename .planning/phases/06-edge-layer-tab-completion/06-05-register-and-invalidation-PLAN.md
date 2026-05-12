---
phase: 06-edge-layer-tab-completion
plan: 05
type: execute
wave: 3
depends_on:
  - 06-03
  - 06-04
files_modified:
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - eslint.config.js
  - tests/edge/register.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
autonomous: true
requirements:
  - TC-5
  - TC-6
  - TC-7
must_haves:
  truths:
    - "registerClaudePluginCommand(pi, deps) calls pi.registerCommand(\"claude:plugin\", { handler, getArgumentCompletions, description }) exactly once"
    - "registerClaudePluginCommand also calls pi.on(\"session_start\", ...) exactly once; the handler installs an autocomplete provider that applies normalizeCompletionWhitespace only to lines matching isClaudePluginCommandLine"
    - "registerClaudeMarketplaceTools(pi) calls pi.registerTool exactly twice"
    - "orchestrators/marketplace/add post-state-commit invokes invalidateMarketplaceNames + invalidateMarketplaceCache"
    - "orchestrators/marketplace/remove post-state-commit invokes invalidateMarketplaceNames + dropMarketplaceCache"
    - "orchestrators/marketplace/update post-state-commit invokes invalidateMarketplaceCache"
    - "orchestrators/plugin/install post-state-commit invokes invalidateMarketplaceCache"
    - "orchestrators/plugin/uninstall post-state-commit invokes invalidateMarketplaceCache"
    - "Cache invalidation failure inside any of the 5 orchestrators is caught and routed through notifyWarning (does NOT roll back the primary operation)"
    - "ESLint adds a no-restricted-syntax rule blocking process.stdout / process.stderr writes inside src/edge/ (ROADMAP SC5)"
  artifacts:
    - path: extensions/pi-claude-marketplace/edge/register.ts
      provides: "registerClaudePluginCommand + registerClaudeMarketplaceTools (D-04)"
      exports: ["registerClaudePluginCommand", "registerClaudeMarketplaceTools"]
    - path: eslint.config.js
      provides: "no-restricted-syntax rule blocking direct process.stdout/stderr writes inside extensions/pi-claude-marketplace/edge/**"
      contains: "no-restricted-syntax"
  key_links:
    - from: extensions/pi-claude-marketplace/edge/register.ts
      to: extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
      via: "makeInstallHandler factory call"
      pattern: "makeInstallHandler"
    - from: extensions/pi-claude-marketplace/edge/register.ts
      to: extensions/pi-claude-marketplace/edge/completions/provider.ts
      via: "getArgumentCompletions wiring via LocationsResolver"
      pattern: "getArgumentCompletions"
    - from: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
      to: extensions/pi-claude-marketplace/shared/completion-cache.ts
      via: "invalidateMarketplaceNames + invalidateMarketplaceCache (post-state-commit)"
      pattern: "invalidateMarketplace"
    - from: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
      to: extensions/pi-claude-marketplace/shared/completion-cache.ts
      via: "invalidateMarketplaceCache (post-state-commit)"
      pattern: "invalidateMarketplaceCache"
---

<objective>
Land the final wiring for Phase 6:

1. `edge/register.ts` -- the two registration helpers Phase 7's `index.ts` will call (`registerClaudePluginCommand`, `registerClaudeMarketplaceTools`), including:
   - `pi.registerCommand("claude:plugin", { handler, getArgumentCompletions, description })`.
   - `pi.on("session_start", ...)` to install the TC-7 autocomplete wrapper.
   - The `LocationsResolver` (defined in Plan 03's `data.ts`) constructed from `persistence/locations.locationsFor(scope, cwd)` -- this is the seam that connects the edge dispatcher to the persistence/state-io rebuild path WITHOUT violating BLOCK C (`register.ts` lives in edge/ and importing persistence/ violates BLOCK C).

2. Cache-invalidation call-sites inserted in 5 mutating orchestrators (`marketplace/{add,remove,update}.ts`, `plugin/{install,uninstall}.ts`) at the post-state-commit window. `plugin/update.ts` is a no-op per D-03 corollary.

3. ESLint rule update: add a `no-restricted-syntax` (or per-file `no-restricted-imports`) rule blocking `process.stdout`/`process.stderr` direct writes inside `extensions/pi-claude-marketplace/edge/**` (ROADMAP Phase 6 SC5; the existing BLOCK A already covers `console.*` and direct `ctx.ui.notify`; this extends to the two `process.*` write surfaces).

4. The 5 existing orchestrator tests gain one "cache invalidated" assertion each.

5. `tests/edge/register.test.ts` fully unskipped and green.

**Critical: LocationsResolver / register.ts BLOCK C resolution.**

`edge/register.ts` is in `edge/`. BLOCK C forbids `edge/` -> `persistence/`. But register.ts must construct the `LocationsResolver` that knows the cache paths (which come from `persistence/locations.ts`) and the rebuild closures (which call `persistence/state-io.loadState` + `domain/manifest.loadMarketplaceManifest`).

**Two options:**

(a) **EXTEND BLOCK C to allow `edge/register.ts` -> `persistence/`** as the single sanctioned exception. This is the registration glue layer; analogous to Phase 7's `index.ts` which will import everything. ESLint per-file override.

(b) **PROVIDE A SHARED HELPER in `shared/locations-resolver.ts`** that constructs the LocationsResolver from a cwd+scope, hiding the persistence/domain imports inside `shared/`. But `shared/` is leaf -- it cannot import from `persistence/` either.

**Neither (a) nor (b) is clean.** The actual resolution is **option (c)**: the LocationsResolver is constructed in `orchestrators/edge-deps.ts` (or any orchestrators-level file), and `edge/register.ts` imports that constructor. `orchestrators/` CAN import from `persistence/` and `domain/`, and `edge/` CAN import from `orchestrators/`. This honors BLOCK C verbatim.

**PLANNER DECISION: option (c).** Add a new file `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` exporting `makeLocationsResolver(cwd: string): LocationsResolver` (signature defined by Plan 03's `data.ts`). This stays in orchestrators/ because it imports from `persistence/locations`, `persistence/state-io`, `domain/manifest`, `domain/resolver`.

Output:
- 1 new file (`edge/register.ts`)
- 1 new file (`orchestrators/edge-deps.ts`)
- 5 modified orchestrators (cache invalidation calls)
- 1 modified ESLint config
- 5 modified orchestrator tests (cache invalidation assertion)
- 1 unskipped + green register test file
</objective>

<execution_context>
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/Users/acolomba/src/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-edge-layer-tab-completion/06-CONTEXT.md
@.planning/phases/06-edge-layer-tab-completion/06-RESEARCH.md
@.planning/phases/06-edge-layer-tab-completion/06-PATTERNS.md
@.planning/phases/06-edge-layer-tab-completion/06-03-SUMMARY.md
@.planning/phases/06-edge-layer-tab-completion/06-04-SUMMARY.md

<!-- Files this plan modifies in place -->
@extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
@eslint.config.js

<!-- Plan 03 & 04 outputs this plan wires together -->
@extensions/pi-claude-marketplace/shared/completion-cache.ts
@extensions/pi-claude-marketplace/edge/completions/provider.ts
@extensions/pi-claude-marketplace/edge/completions/data.ts
@extensions/pi-claude-marketplace/edge/completions/normalize.ts
@extensions/pi-claude-marketplace/edge/router.ts
@extensions/pi-claude-marketplace/edge/types.ts
@extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
@extensions/pi-claude-marketplace/edge/handlers/tools.ts

<!-- Phase 5 reference for the post-state-commit window pattern -->
@.planning/phases/05-plugin-orchestrators/05-06-plugin-install-SUMMARY.md

V1 register.ts reference:
- Run: git show features/initial:extensions/pi-claude-marketplace/index.ts

Cache-invalidation insertion points (verified in 06-RESEARCH.md lines 843-866):
- orchestrators/marketplace/add.ts: between line 113 (after defensive check after withStateGuard) and line 116 (before notifySuccess).
  Calls: invalidateMarketplaceNames(opts.scope) + invalidateMarketplaceCache(opts.scope, recordedName).
- orchestrators/marketplace/remove.ts: between line 130 (after withStateGuard closes) and line 132 (before POST-STATE cleanup begins).
  Calls: invalidateMarketplaceNames(resolved.scope) + dropMarketplaceCache(await locations.pluginCacheFile(opts.name), resolved.scope, opts.name).
- orchestrators/marketplace/update.ts: between line 250 (after inner withStateGuard) and line 256 (before cascade begins).
  Calls: invalidateMarketplaceCache(scope, name).
- orchestrators/plugin/install.ts: after the AS-6 pluginDataDir mkdir (~line 587), before AS-7.
  Calls: invalidateMarketplaceCache(scope, marketplace).
- orchestrators/plugin/uninstall.ts: between line 137 (after withStateGuard) and line 159 (before pluginDataDir rm).
  Calls: invalidateMarketplaceCache(scope, marketplace).

Standard failure envelope (06-PATTERNS.md lines 1218-1224):
```text
try {
  invalidateMarketplaceCache(scope, marketplace);
} catch (err) {
  notifyWarning(ctx, `<op> succeeded; completion cache refresh deferred: ${errorMessage(err)}`);
}
```

The two pure `invalidate*` functions are memory-only and cannot throw under normal operation; the try/catch is defense-in-depth. `dropMarketplaceCache` does I/O (unlink) and is the realistic failure surface.

session_start autocomplete wrapper pattern (06-PATTERNS.md lines 676-689):
- pi.on("session_start", async (_event, ctx) => { ctx.ui.addAutocompleteProvider((current) => ({ ...wrapper... })) })
- The wrapper composes current.applyCompletion with normalizeCompletionWhitespace IFF isClaudePluginCommandLine(line).
- V1 calls addAutocompleteProvider unconditionally on every session_start event; this is harmless because normalizeCompletionWhitespace is idempotent.

LocationsResolver constructor (orchestrators/edge-deps.ts) shape:
```typescript
import { locationsFor } from "../persistence/locations.ts";
import { loadState } from "../persistence/state-io.ts";
import { loadMarketplaceManifest } from "../domain/manifest.ts";
import { resolveStrict } from "../domain/resolver.ts";
import { ManifestSoftFailError } from "../shared/completion-cache.ts";
import type { LocationsResolver } from "../edge/completions/data.ts";
import type { Scope } from "../shared/types.ts";

export function makeLocationsResolver(cwd: string): LocationsResolver {
  return {
    marketplaceNamesCachePath(scope: Scope): string {
      return locationsFor(scope, cwd).marketplaceNamesCacheFile;
    },
    async pluginCachePath(scope: Scope, marketplace: string): Promise<string> {
      return locationsFor(scope, cwd).pluginCacheFile(marketplace);
    },
    async loadStateForScope(scope: Scope) {
      const locations = locationsFor(scope, cwd);
      return loadState(locations.extensionRoot);
    },
    async loadManifestForMarketplace(scope: Scope, marketplace: string) {
      // Wrap manifest failures in ManifestSoftFailError so the cache layer applies TC-8.
      try {
        const state = await loadState(locationsFor(scope, cwd).extensionRoot);
        const mp = state.marketplaces[marketplace];
        if (mp === undefined || mp.manifestPath === undefined) {
          throw new ManifestSoftFailError(new Error(`Marketplace "${marketplace}" has no manifest in scope "${scope}".`));
        }
        const manifest = await loadMarketplaceManifest({ ... });  // adapt to actual signature
        return { plugins: manifest.plugins.map(p => ({ name: p.name, installable: !!resolveStrict(p, { marketplaceRoot: mp.marketplaceRoot }).installable })) };
      } catch (err) {
        if (err instanceof ManifestSoftFailError) throw err;
        throw new ManifestSoftFailError(err);
      }
    },
  };
}
```
This file imports from persistence and domain -- legal for `orchestrators/`. `edge/register.ts` imports `makeLocationsResolver` from `orchestrators/edge-deps.ts` -- legal for `edge/` (edge -> orchestrators is allowed by BLOCK C).

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add cache-invalidation call-sites to 5 mutating orchestrators; extend their existing tests</name>
  <files>extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts, extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts, extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts, extensions/pi-claude-marketplace/orchestrators/plugin/install.ts, extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts, tests/orchestrators/marketplace/add.test.ts, tests/orchestrators/marketplace/remove.test.ts, tests/orchestrators/marketplace/update.test.ts, tests/orchestrators/plugin/install.test.ts, tests/orchestrators/plugin/uninstall.test.ts</files>
  <behavior>
- Each mutating orchestrator, AFTER its withStateGuard closes successfully and BEFORE any user-visible notification fires, calls the appropriate cache-invalidation function from shared/completion-cache.ts.
- The invalidation call is wrapped in try/catch; failure routes through notifyWarning and never rolls back the orchestrator's primary operation.
- Cache file path for dropMarketplaceCache comes from `await locations.pluginCacheFile(name)` (introduced in Plan 02).
- Each orchestrator's existing test file gains exactly one new test asserting cache invalidation:
  - For memory-only invalidations: the test pre-populates the in-memory cache (via a small `__resetCacheForTests` + direct invocation), runs the orchestrator, then asserts the next call to getMarketplaceNames/getPluginIndex re-invokes the rebuild closure (use a spy).
  - For dropMarketplaceCache: the test pre-creates the cache file on disk, runs the orchestrator (marketplace remove), then asserts the file is absent.
  </behavior>
  <action>
1. For each of the 5 orchestrators, locate the exact insertion point per the line-anchored map in 06-RESEARCH.md lines 843-866. (Line numbers may have drifted since the research -- open each file and find the comment markers, NOT line numbers.)

2. Insert the invalidation call wrapped in try/catch + notifyWarning, using the standard envelope from 06-PATTERNS.md. Specifics:

   **orchestrators/marketplace/add.ts** (after withStateGuard closes, before notifySuccess):
   ```text
   try {
     invalidateMarketplaceNames(opts.scope);
     invalidateMarketplaceCache(opts.scope, recordedName);
   } catch (err) {
     notifyWarning(opts.ctx, `Marketplace "${recordedName}" added; completion cache refresh deferred: ${errorMessage(err)}`);
   }
   ```
   Import `invalidateMarketplaceNames`, `invalidateMarketplaceCache` from `../../shared/completion-cache.ts`. Import `notifyWarning` (likely already imported) and `errorMessage` (likely already imported via `../../shared/errors.ts`).

   **orchestrators/marketplace/remove.ts** (after withStateGuard closes, before POST-STATE cleanup):
   ```text
   try {
     invalidateMarketplaceNames(resolved.scope);
     const cachePath = await locations.pluginCacheFile(opts.name);
     await dropMarketplaceCache(cachePath, resolved.scope, opts.name);
   } catch (err) {
     notifyWarning(opts.ctx, `Marketplace "${opts.name}" removed; completion cache cleanup deferred: ${errorMessage(err)}`);
   }
   ```
   Import `dropMarketplaceCache` along with `invalidateMarketplaceNames`. Verify `locations` variable name in remove.ts (might be `resolved.locations` or similar).

   **orchestrators/marketplace/update.ts** (after inner withStateGuard closes, before cascade):
   ```text
   try {
     invalidateMarketplaceCache(scope, name);
   } catch (err) {
     notifyWarning(opts.ctx, `Marketplace "${name}" updated; completion cache refresh deferred: ${errorMessage(err)}`);
   }
   ```

   **orchestrators/plugin/install.ts** (after the AS-6 pluginDataDir mkdir):
   ```text
   try {
     invalidateMarketplaceCache(scope, marketplace);
   } catch (err) {
     notifyWarning(ctx, `Plugin "${plugin}" installed; completion cache refresh deferred: ${errorMessage(err)}`);
   }
   ```

   **orchestrators/plugin/uninstall.ts** (after withStateGuard closes, before pluginDataDir rm):
   ```text
   try {
     invalidateMarketplaceCache(scope, marketplace);
   } catch (err) {
     notifyWarning(ctx, `Plugin "${plugin}" uninstalled; completion cache refresh deferred: ${errorMessage(err)}`);
   }
   ```

3. For each of the 5 orchestrator test files, ADD one new test case (do not delete or rewrite existing cases):

   - `tests/orchestrators/marketplace/add.test.ts`: add `test("D-03-INV :: add invalidates marketplace-names + plugin cache for the new name", ...)`. Seed cache memory by calling `getMarketplaceNames(...)` once with a rebuild stub that returns `[]`. Run the add orchestrator. Call `getMarketplaceNames(...)` again with a rebuild stub that asserts it was invoked (signaling the cache was invalidated).

   - `tests/orchestrators/marketplace/remove.test.ts`: add `test("D-03-INV :: remove unlinks the plugin cache file and invalidates marketplace-names", ...)`. Pre-create `<extensionRoot>/cache/plugins/<name>.json` via atomicWriteJson. Run the remove orchestrator. Assert the file is absent (`pathExists` returns false).

   - `tests/orchestrators/marketplace/update.test.ts`: add `test("D-03-INV :: update invalidates plugin cache for that marketplace", ...)`. Same memory-spy pattern as add.

   - `tests/orchestrators/plugin/install.test.ts`: add `test("D-03-INV :: install invalidates plugin cache for the target marketplace", ...)`. Same memory-spy pattern.

   - `tests/orchestrators/plugin/uninstall.test.ts`: add `test("D-03-INV :: uninstall invalidates plugin cache for the target marketplace", ...)`. Same pattern.

   The memory-spy pattern uses the `__resetCacheForTests()` seam from Plan 03 to start clean, then warms the cache, then runs the orchestrator, then checks the next read triggers rebuild.

4. Verify the orchestrators still pass their existing tests. The new invalidation call is between successful state commit and notifySuccess -- it MUST NOT throw under normal conditions (memory-only ops), so existing happy-path tests stay green.

5. **Notify discipline:** the orchestrator files already use `notifyWarning` (Phase 4/5 carry-forward). No new direct `ctx.ui.notify` calls. Verify with grep on each modified orchestrator.
  </action>
  <verify>
    <automated>node --test "tests/orchestrators/marketplace/add.test.ts" "tests/orchestrators/marketplace/remove.test.ts" "tests/orchestrators/marketplace/update.test.ts" "tests/orchestrators/plugin/install.test.ts" "tests/orchestrators/plugin/uninstall.test.ts" &amp;&amp; node -e 'const {execSync}=require("child_process"); const files=["extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install.ts","extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts"]; for(const f of files){const c=execSync(`grep -nE "invalidateMarketplaceCache\\\\|invalidateMarketplaceNames\\\\|dropMarketplaceCache" ${f} || true`).toString(); if(!c.trim()){console.error(`missing cache-invalidation call in ${f}`);process.exit(1)}} console.log("ok")' &amp;&amp; npx tsc --noEmit &amp;&amp; npx eslint extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts extensions/pi-claude-marketplace/orchestrators/plugin/install.ts extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts</automated>
  </verify>
  <done>All 5 orchestrators have the cache-invalidation call wrapped in try/catch + notifyWarning. All 5 orchestrator test files gain exactly one new D-03-INV assertion. Existing orchestrator tests still green. Grep gate confirms each orchestrator imports and calls at least one cache-invalidation function.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create orchestrators/edge-deps.ts (LocationsResolver constructor) + edge/register.ts (D-04); unskip register.test.ts</name>
  <files>extensions/pi-claude-marketplace/orchestrators/edge-deps.ts, extensions/pi-claude-marketplace/edge/register.ts, tests/edge/register.test.ts</files>
  <behavior>
- `orchestrators/edge-deps.ts` exports `makeLocationsResolver(cwd)` returning a `LocationsResolver` (interface from edge/completions/data.ts). The resolver constructs paths via persistence/locations and rebuild closures via persistence/state-io and domain/manifest, wrapping manifest failures in ManifestSoftFailError so the cache layer applies TC-8.
- `edge/register.ts` exports `registerClaudePluginCommand(pi, deps)` and `registerClaudeMarketplaceTools(pi)`. The first calls pi.registerCommand and pi.on(session_start); the second calls pi.registerTool twice.
- The slash-command `getArgumentCompletions` closes over `makeLocationsResolver(process.cwd())` per Pitfall 3 (the one acceptable process.cwd() site in Phase 6).
- The session_start handler unconditionally installs the autocomplete wrapper (V1 carry-forward).
- The wrapper applies normalizeCompletionWhitespace only when isClaudePluginCommandLine(originalLine) is true.
  </behavior>
  <action>
1. Create `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` per the `<context>` shape. Verify the actual signatures of `locationsFor`, `loadState`, `loadMarketplaceManifest`, `resolveStrict` by reading them; adapt the closure bodies. The shape sketched in `<context>` may need adjustment based on Phase 2's actual exports.

   Specifically for `loadManifestForMarketplace(scope, marketplace)`:
   - Load state for scope; look up `state.marketplaces[marketplace]`.
   - If absent, throw ManifestSoftFailError (cache will surface as empty plugin list).
   - Load the manifest via `loadMarketplaceManifest(...)`. If it throws, wrap in ManifestSoftFailError.
   - For each manifest plugin, run `resolveStrict({ plugin, marketplaceRoot, ... })` to determine `installable`. Return `{ plugins: [{ name, installable, version? }] }`. The cache layer's rebuild closure (in `edge/completions/data.ts::rebuildPluginIndex`) translates these into PluginIndexRow with status `available` (installable && not in state.plugins) or `unavailable` (NOT installable).
   - Plugins that ARE in `state.marketplaces[marketplace].plugins` are status `installed` (NOT obtained via this loader; the cache's rebuild closure walks state.plugins separately).

   IMPORTANT: the actual division of labor between `edge-deps.ts::loadManifestForMarketplace` and `data.ts::rebuildPluginIndex` is at the planner's discretion. The cleanest split is: edge-deps returns RAW data (manifest entries with installable bool), and data.ts builds the PluginIndexRow[] by combining state.plugins (status=installed) + manifest entries (status=available|unavailable). Plan 03 already defined `getPluginToMarketplacesMap` which combines both -- the rebuild closure used by `getPluginIndex` likewise needs both inputs.

   Refactor `LocationsResolver` if needed to add `loadStateForScope` (already in Plan 03 spec) and `loadManifestForMarketplace` (already in Plan 03 spec). Plan 03 sketched the interface; this task confirms the actual implementation matches.

2. Create `extensions/pi-claude-marketplace/edge/register.ts` per 06-PATTERNS.md lines 642-696:

   - Import all handler factories from `./handlers/plugin/*.ts` and `./handlers/marketplace/*.ts`.
   - Import `handleMarketplaceList` from `./handlers/marketplace/list.ts`.
   - Import `routeClaudePlugin` from `./router.ts`.
   - Import `getArgumentCompletions` from `./completions/provider.ts`.
   - Import `isClaudePluginCommandLine`, `normalizeCompletionWhitespace` from `./completions/normalize.ts`.
   - Import `registerListMarketplacesTool`, `registerListPluginsTool` from `./handlers/tools.ts`.
   - Import `makeLocationsResolver` from `../orchestrators/edge-deps.ts`.
   - Import types: `ExtensionAPI` from `@mariozechner/pi-coding-agent`, `EdgeDeps` from `./types.ts`.

   `registerClaudePluginCommand(pi: ExtensionAPI, deps: EdgeDeps): void`:
   ```text
   const handlers: SubcommandHandlers = {
     install: makeInstallHandler(pi),
     uninstall: makeUninstallHandler(pi),
     update: makeUpdateHandler(pi),
     list: makeListHandler(),
     marketplaceAdd: makeAddHandler(deps),
     marketplaceRemove: makeRemoveHandler(),
     marketplaceList: handleMarketplaceList,
     marketplaceUpdate: makeMarketplaceUpdateHandler(deps),
     marketplaceAutoupdate: makeAutoupdateHandler(true),
     marketplaceNoautoupdate: makeAutoupdateHandler(false),
   };

   pi.registerCommand("claude:plugin", {
     description: "Manage Claude plugin marketplaces and plugins. Install, uninstall, list, update plugins from configured marketplaces.",
     handler: (args, ctx) => routeClaudePlugin(args, handlers, ctx),
     getArgumentCompletions: (prefix) => getArgumentCompletions(prefix, makeLocationsResolver(process.cwd())),
   });

   pi.on("session_start", async (_event, ctx) => {
     ctx.ui.addAutocompleteProvider((current) => ({
       getSuggestions: (lines, line, col, options) =>
         current.getSuggestions(lines, line, col, options),
       applyCompletion: (lines, line, col, item, prefix) => {
         const result = current.applyCompletion(lines, line, col, item, prefix);
         const original = lines[line] ?? "";
         if (!isClaudePluginCommandLine(original)) return result;
         return normalizeCompletionWhitespace(result);
       },
       shouldTriggerFileCompletion: (lines, line, col) =>
         current.shouldTriggerFileCompletion?.(lines, line, col) ?? true,
     }));
   });
   ```

   `registerClaudeMarketplaceTools(pi: ExtensionAPI): void`:
   ```text
   registerListMarketplacesTool(pi);
   registerListPluginsTool(pi);
   ```

3. Unskip every test in `tests/edge/register.test.ts` (10 cases from Plan 01).

   Use the `makeMockPi` pattern from 06-PATTERNS.md lines 1040-1051: records `pi.registerCommand`, `pi.registerTool`, `pi.on` invocations.

   For the session_start handler test, the test must:
   - Capture the on("session_start", handler) handler.
   - Invoke it with a synthetic `{ type: "session_start", reason: "startup" }` event and a mock `ctx` that records `ctx.ui.addAutocompleteProvider` calls.
   - Capture the factory argument and invoke it with a synthetic `current` provider to get the wrapper.
   - Test the wrapper's `applyCompletion` with a `/claude:plugin install foo` line: assert it composes `normalizeCompletionWhitespace`.
   - Test the wrapper's `applyCompletion` with a `/other-extension foo` line: assert it passes through (no normalization).

4. **The notify discipline self-invariant for register.ts:** zero direct `ctx.ui.notify` calls. Verify with grep.

5. **The import boundary for register.ts:**
   - ALLOWED: edge/* (this file IS in edge/), orchestrators/edge-deps.ts (which is in orchestrators/), shared/* via wrappers.
   - FORBIDDEN: persistence/*, domain/* directly. Confirm `register.ts` does NOT import from `persistence` or `domain` directly (it goes through `orchestrators/edge-deps.ts`).
  </action>
  <verify>
    <automated>node --test tests/edge/register.test.ts &amp;&amp; node -e 'const {execSync}=require("child_process"); const out=execSync("grep -nE \"from \\\".*(persistence|domain|bridges|transaction|platform)/\" extensions/pi-claude-marketplace/edge/register.ts || true").toString(); if(out.trim()){console.error(`register.ts has forbidden imports:\\n${out}`);process.exit(1)} const out2=execSync("grep -nE \"ctx\\\\.ui\\\\.notify\" extensions/pi-claude-marketplace/edge/register.ts || true").toString(); if(out2.trim()){console.error(`direct notify in register.ts:\\n${out2}`);process.exit(2)} console.log("ok")' &amp;&amp; npx tsc --noEmit &amp;&amp; npx eslint extensions/pi-claude-marketplace/orchestrators/edge-deps.ts extensions/pi-claude-marketplace/edge/register.ts tests/edge/register.test.ts</automated>
  </verify>
  <done>register.ts and orchestrators/edge-deps.ts exist; all 10 register tests are unskipped and green; register.ts has zero imports from persistence/domain/bridges/transaction/platform (BLOCK C honored via the orchestrators/edge-deps.ts indirection); zero direct ctx.ui.notify calls.</done>
</task>

<task type="auto">
  <name>Task 3: Extend eslint.config.js to block process.stdout/stderr writes inside edge/ (ROADMAP SC5)</name>
  <files>eslint.config.js</files>
  <action>
1. Read `eslint.config.js` to confirm the existing BLOCK A rule (no-restricted-syntax for `console.*` and direct `ctx.ui.notify`) and BLOCK C rule (import-x/no-restricted-paths).

2. Add a new rule targeting `extensions/pi-claude-marketplace/edge/**/*.ts` that blocks the following `MemberExpression` patterns:
   - `process.stdout.write(...)`
   - `process.stderr.write(...)`

   The simplest implementation is an additional `no-restricted-syntax` entry inside the edge/ overrides block:
   ```javascript
   {
     selector: "CallExpression[callee.object.object.name='process'][callee.object.property.name='stdout'][callee.property.name='write']",
     message: "Direct process.stdout.write is forbidden in edge/. Use shared/notify.ts wrappers.",
   },
   {
     selector: "CallExpression[callee.object.object.name='process'][callee.object.property.name='stderr'][callee.property.name='write']",
     message: "Direct process.stderr.write is forbidden in edge/. Use shared/notify.ts wrappers.",
   }
   ```

   If the existing BLOCK A rule already covers `process.stdout`/`process.stderr` via a wildcard (verify by reading the existing config), this task is a no-op and the developer should note that in the SUMMARY rather than re-add the rule.

3. Add a smoke test inline in a new or existing test file: a sample edge/ file containing `process.stdout.write("foo");` triggers ESLint error. (Optional -- the per-file lint check at Plan 04 and Plan 05 verify catches this implicitly.)

4. Run `npm run check` to confirm no existing edge/ file regresses on this rule.
  </action>
  <verify>
    <automated>npx eslint "extensions/pi-claude-marketplace/edge/**/*.ts" &amp;&amp; bash -c 'TMP=$(mktemp -d); echo "process.stdout.write(\"x\");" > $TMP/probe.ts; cp eslint.config.js $TMP/; cd $TMP &amp;&amp; npx eslint --no-eslintrc --config eslint.config.js probe.ts 2>&amp;1 | grep -q "process\\.stdout\\.write" &amp;&amp; echo "probe-blocked: ok" || echo "probe-blocked: missing rule -- check eslint.config.js"; rm -rf $TMP' &amp;&amp; npm run check</automated>
  </verify>
  <done>eslint.config.js adds the process.stdout/stderr block for edge/**. ESLint blocks the probe file. `npm run check` exits 0 (no existing edge/ file violates the new rule).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| process.cwd() at registration glue layer | The single sanctioned process.cwd() site (Pitfall 3); used to construct the LocationsResolver. No untrusted input; mitigated by Phase 1's path-containment guards downstream. |
| Pi event handler (session_start) -> ctx.ui.addAutocompleteProvider | Pi-tui stacks providers; normalizeCompletionWhitespace is idempotent (verified in Plan 02), so re-registration on multiple session_start events is harmless. |
| Cache invalidation called from inside orchestrator post-state-commit window | Failure isolation: invalidation throw is caught and routed through notifyWarning; state commit has already succeeded so no rollback is possible. The user's primary operation outcome is unchanged by cache invalidation outcome. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-EDGE-2b | Tampering | --scope value flowing into makeLocationsResolver -> locationsFor(scope, cwd) | mitigate | locationsFor validates scope as one of "user" | "project" (Phase 2 carry-forward); any other value would fail earlier in the parser (AP-2). Path containment via assertPathInside (Phase 1 D-14..17) blocks downstream traversal. |
| T-EDGE-5b | Spoofing | Hostile marketplace name in state.json reaching dropMarketplaceCache via locations.pluginCacheFile(opts.name) | mitigate | persistence/locations.pluginCacheFile (added in Plan 02) runs assertSafeName + assertPathInside. Names that pass Phase 4's marketplace-add validation are already safe; even a state.json corruption attack is contained. |
| T-EDGE-9 | Repudiation | Cache invalidation failure swallowed without operator visibility | mitigate | notifyWarning emits a user-visible warning (severity = warning) when invalidation fails. The orchestrator's primary success is also logged via notifySuccess. Both events surface in the Pi UI. |

All threats LOW; no blockers.
</threat_model>

<verification>
- 1 new file: `extensions/pi-claude-marketplace/edge/register.ts`.
- 1 new file: `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts`.
- 5 modified orchestrator files have a cache-invalidation call wrapped in try/catch + notifyWarning.
- 1 modified ESLint config blocks process.stdout/stderr in edge/.
- 5 modified orchestrator test files each have one new "D-03-INV" test.
- 1 new test file (`tests/edge/register.test.ts`) fully unskipped and green.
- `npm run check` exits 0.
- Cache invalidation grep gate passes: each of the 5 orchestrator files contains at least one call to invalidateMarketplaceNames/invalidateMarketplaceCache/dropMarketplaceCache.
- register.ts BLOCK C grep gate passes: zero imports from persistence/domain/bridges/transaction/platform.
- ESLint probe: a file with `process.stdout.write` in edge/ triggers the new rule (and `npm run check` confirms no existing edge/ file regresses).
</verification>

<success_criteria>
- Phase 7's `index.ts` becomes trivially short: just import + call `registerClaudePluginCommand(pi, deps)` and `registerClaudeMarketplaceTools(pi)`, plus the Phase-7-owned `pi.on("resources_discover", ...)` wiring.
- The full slash command surface is functionally complete and unit-tested (without requiring a live Pi process).
- Tab completion works end-to-end via getArgumentCompletions, using the cache produced in Plan 03, the dispatcher in Plan 03, the resolver constructor in this plan, and TC-7 normalization installed via session_start.
- The 5 mutating orchestrators trigger cache invalidation post-state-commit; failure is contained (no rollback, notifyWarning surfaces).
- ROADMAP Phase 6 SC5 satisfied: ESLint blocks process.stdout/stderr writes in edge/.
</success_criteria>

<output>
After completion, create `.planning/phases/06-edge-layer-tab-completion/06-05-SUMMARY.md` noting:
- The orchestrators/edge-deps.ts indirection that resolves the edge -> persistence BLOCK C tension.
- The 5 cache-invalidation insertion points (file + neighboring landmarks, NOT line numbers -- they drift).
- The notifyWarning failure envelope and its tests.
- The new ESLint rule and the probe-file verification.
- Final Phase 6 test count.
- Any orchestrator behavior change (there should be none beyond the additive invalidation call).
</output>

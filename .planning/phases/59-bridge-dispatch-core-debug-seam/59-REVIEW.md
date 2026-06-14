---
phase: 59-bridge-dispatch-core-debug-seam
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/debug-log.ts
  - extensions/pi-claude-marketplace/domain/components/hooks.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/index.ts
  - extensions/pi-claude-marketplace/bridges/index.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - tests/shared/debug-log.test.ts
  - tests/bridges/hooks/event-router.test.ts
  - tests/bridges/hooks/dispatch-exec.test.ts
  - tests/architecture/hooks-dispatch.test.ts
  - tests/edge/index-handler.test.ts
  - tests/shared/index-smoke.test.ts
  - tests/e2e/_helpers.ts
  - tests/e2e/resources-discover.test.ts
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 59: Code Review Report

**Reviewed:** 2026-06-14
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

The bridge-dispatch-core landing is well-structured: DISP-01 (7 `pi.on`
registrations), DISP-02 (synchronous, zero-disk-I/O rebuild),
DISP-03 (epoch capture/check), DISP-04 (sequential awaited fan-out, no
`Promise.all`), and OBS-01 (sole `console.error` in
`shared/debug-log.ts`) all hold against the source. The factory
correctly `await`s `registerHooksBridge` so Pi's loader cannot race the
first session event past the 7 registrations.

The notable defects are scoping and lifecycle gaps rather than logic
errors: the factory-time hydrate uses the wrong cwd for project scope
and never clears stale entries; standalone install/uninstall mutate the
cache but never rebuild the routing table; the hydrate read path joins
state-supplied slugs onto `loc.hooksDir` without an `assertPathInside`
defense-in-depth guard. Several findings are scoped to "harmless today
because `dispatchHookExec` is a stub" — they become real correctness
issues when the exec layer (planned for later phase) lands.

No security blockers. No IL-2/IL-3/OBS-01 violations in the dispatch
path. No `Promise.all` in fan-out paths.

## Warnings

### WR-01: Factory-time project-scope hydrate uses homedir() as cwd; never cleared by deferred hydrate

**File:** `extensions/pi-claude-marketplace/index.ts:54` and
`extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:315-342`
**Issue:** `claudeMarketplaceExtension` calls
`registerHooksBridge(pi, { ctx, cwd: homedir() })` at factory time,
which invokes `hydrateCacheFromDisk` for BOTH scopes. The project arm
resolves `locationsFor("project", homedir())`, i.e.
`<homedir>/.pi/pi-claude-marketplace/state.json`. If that path happens
to contain real state (e.g. the user is running Pi with cwd=$HOME, or
ran Pi from $HOME previously and left a `.pi/` there), the factory
hydrates project-scope cache entries against that state. The
subsequent `hydrateProjectScopeForCwd(event.cwd)` call at
`resources_discover` only ADDS to the cache — it never CLEARS the
phantom entries the factory pre-populated.

`rebuildRoutingTables` is then called per-scope inside
`applyReconcile`, and `collectPluginsInScope` filters by
state.marketplaces[mp].scope === scope. Because the cache lookup is
keyed on (scope, marketplace, pluginId) without including cwd, a
phantom entry from `<homedir>/.pi/...` state has scope === "project"
and will match if the same (marketplace, pluginId) pair appears in the
real project state. Result: cross-cwd cache leakage that the load-time
contract claims is impossible.

**Fix:** Either (a) skip the project arm at factory time entirely and
do the project hydrate exclusively in `hydrateProjectScopeForCwd`, or
(b) wipe project-scope cache entries from `parsedConfigCache` at the
start of `hydrateProjectScopeForCwd` before re-hydrating. Option (a) is
simpler and matches the comment in `registerHooksBridge` lines
416-431 that already explains the wrong-cwd problem.

```typescript
// In event-router.ts::hydrateCacheFromDisk -- skip project at factory time.
for (const scope of SCOPES) {
  if (scope === "project") {
    // Project hydrate is deferred to resources_discover via
    // hydrateProjectScopeForCwd(event.cwd) -- the factory has no
    // access to the real project cwd at extension-load time.
    continue;
  }
  // ... existing user-scope hydrate
}
```

### WR-02: Hydrate path joins state-supplied slug onto hooksDir without containment check

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:366`
**Issue:**
```typescript
const hooksJsonPath = path.join(loc.hooksDir, slug, "hooks.json");
```
where `slug` comes from `pluginRecord.resources.hooks[i]` (state.json).
There is no `assertPathInside(loc.hooksDir, hooksJsonPath)` defense-in-
depth check. If a corrupted state.json were to carry a slug like
`"../../etc"`, the `readFile` would escape the hooks dir. State.json
is normally written only by this extension, but NFR-10 containment is
explicitly defense-in-depth at WRITE sites; missing the symmetric guard
at READ sites lets a state.json corruption (by a third party, or by a
future schema-version mismatch) extend into a path-traversal read.

The matching install-time path (`install.ts:945`) uses
`installCtx.resolved.pluginRoot` + `installCtx.resolved.hooksConfigPath`
which is similarly trust-the-resolver. The resolver hardcodes
`path.join("hooks", "hooks.json")` so that arm is safe; the hydrate
arm reads STATE-supplied data and is the higher-risk site.

**Fix:** Add containment assertion before the readFile:

```typescript
import { assertPathInside } from "../../shared/path-safety.ts";

async function tryHydrateOnePlugin(
  scope: Scope,
  marketplace: string,
  pluginId: string,
  hooksJsonPath: string,
  hooksDir: string,
): Promise<void> {
  try {
    await assertPathInside(hooksDir, hooksJsonPath);
  } catch (err) {
    hookDebugLog(
      `hydrate: containment violation for ${scope}/${marketplace}/${pluginId} at ${hooksJsonPath}: ${errorMessage(err)}`,
    );
    return;
  }
  // ... existing readFile path
}
```

### WR-03: Standalone install/uninstall mutate parsedConfigCache but never rebuild routing tables

**File:**
`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:940-947`
and `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:456`
**Issue:** Both orchestrators call `addPluginConfigToCache` /
`removePluginConfigFromCache` under the per-scope lock to keep the
cache in sync with state. Neither calls `rebuildRoutingTables`. The
routing table is rebuilt only by `applyReconcile` (orchestrators/
reconcile/apply.ts:842) or at factory time (DISP-02 cold start).

For standalone `/claude:plugin install` or `/claude:plugin uninstall`
invocations — i.e. NOT routed through `applyReconcile` — the routing
table stays stale until the next `/reload`. This means:

- After standalone install: newly installed plugin's handlers do NOT
  fire on incoming Pi events (cache has the parsed config, but the
  routing table does not).
- After standalone uninstall: the JUST-removed plugin's stale routing
  entries continue to fire on incoming Pi events (cache miss, but
  routingTable still carries the RoutingEntry objects from the prior
  rebuild). The handler `handlerDecl` reference is still live in
  memory and the dispatcher cannot tell it should no longer fire.

Today this is masked because `dispatchHookExec` is a no-op stub
(`bridges/hooks/dispatch-exec.ts:20-26`). Once the exec layer lands the
defect surfaces immediately: a tool event between standalone uninstall
and the next reload will execute the uninstalled plugin's shell
commands.

NFR-2 says `/reload` MUST suffice for recovery; that's a STATEMENT, not
a license to require `/reload` for every state mutation to take
effect.

**Fix:** After the explicit `tx.save()` in install.ts and uninstall.ts,
rebuild the per-scope routing table:

```typescript
// In installPlugin's withLockedStateTransaction closure, after tx.save():
rebuildRoutingTables(state, locations);

// Same for uninstallPlugin's success arm after tx.save().
```

Both calls are synchronous and zero-disk-I/O (DISP-02), so the cost is
negligible and the contract "after a successful state mutation the
routing table reflects state" holds. Note this requires
`rebuildRoutingTables` to be exported from `bridges/hooks/index.ts` —
it already is (`bridges/hooks/index.ts:17`).

### WR-04: Architecture test pi.on count not hermetic — reads developer's real $HOME

**File:** `tests/architecture/hooks-dispatch.test.ts:199-234`
**Issue:** `DISP-01: registerHooksBridge calls pi.on exactly 7 times`
uses `path.join(process.cwd(), "tests", "fixtures", "no-such-dir-for-
hooks-dispatch")` as cwd. The project-scope arm of
`hydrateCacheFromDisk` happily uses that, but the USER scope resolves
`getAgentDir()` which reads `PI_CODING_AGENT_DIR` or defaults to
`~/.pi/agent`. The test does not control `HOME` or
`PI_CODING_AGENT_DIR`, so it reads the developer's real user-scope
state.

The assertion (`piMock.calls.length === 7`) does not depend on
hydrate output, so the test passes either way today. But:
1. A future invariant added to this test could be silently bypassed by
   a developer's $HOME state.
2. The test can crash if the developer's `~/.pi/agent/pi-claude-
   marketplace/state.json` has unusual content `loadState` rejects on
   schema mismatch (rare but possible during dev iteration).
3. The `_resetForTest()` at the start does not restore
   `liveEpoch` to 0 in a way that survives the registerHooksBridge
   call's `liveEpoch += 1`; subsequent tests start with `currentEpoch()
   === 1`. The other tests in the file do `_resetForTest()` themselves
   so it's fine, but the dependency is implicit.

Compare `tests/edge/index-handler.test.ts:withHermeticEnv` — that
helper does control HOME and PI_CODING_AGENT_DIR. Mirror that pattern.

**Fix:** Wrap the DISP-01 test in a hermetic-env helper (or reuse
`withHermeticEnv` from `tests/edge/index-handler.test.ts`), setting
`HOME` and `PI_CODING_AGENT_DIR` to tmp dirs for the duration.

### WR-05: `compositeHandlerFor`'s return-type narrowing leaks a union, not a per-event type

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:119-122`
**Issue:**
```typescript
export function compositeHandlerFor(
  claudeEvent: Exclude<BucketAEvent, "PostToolUse" | "PostToolUseFailure">,
  capturedEpoch: number,
): (event: CompositeEventFor<typeof claudeEvent>, ctx: ExtensionContext) => Promise<void>
```

`typeof claudeEvent` resolves to the PARAMETER type
(`Exclude<BucketAEvent, ...>`), not the specific value at the call
site. So `CompositeEventFor<typeof claudeEvent>` distributes over the
union and produces `SessionStartEvent | SessionShutdownEvent |
SessionBeforeCompactEvent | SessionCompactEvent | InputEvent |
ToolCallEvent` for EVERY call, regardless of which `claudeEvent` was
passed.

The result is that
`pi.on("session_start", compositeHandlerFor("SessionStart", ...))`
registers a handler typed `(event: union, ctx) => Promise<void>`
against Pi's `(event: SessionStartEvent, ctx) => Promise<void>` slot —
a wider-input handler is variance-compatible, but the type system is
not enforcing the per-event narrowing the implementation actually
relies on. Inside `entryFires` the implementation does
`(event as ToolCallEvent).toolName` to recover the narrow shape, but a
genuine generic per-event handler signature would let the compiler
catch a future bug where (say) `SessionStart` is wired to `tool_call`.

This is a type-narrowing quality defect, not a runtime correctness
issue.

**Fix:** Use a generic to thread the literal event type through:

```typescript
export function compositeHandlerFor<
  E extends Exclude<BucketAEvent, "PostToolUse" | "PostToolUseFailure">
>(
  claudeEvent: E,
  capturedEpoch: number,
): (event: CompositeEventFor<E>, ctx: ExtensionContext) => Promise<void> {
  // body unchanged
}
```

## Info

### IN-01: `declarationIndex` is computed and stored but never used as a sort key

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:252-283`
**Issue:** The comment block at lines 176-180 states "within-plugin via
`declarationIndex` ascending (preserves source-file order across the
(event, group, handler) flattening)" — but `rebuildRoutingTables` never
sorts by `declarationIndex`. Push order is preserved because plugins
are sorted before flatten and each plugin's handlers are pushed in
declaration order into the per-event buckets, so the ORDER is right;
but the comment misrepresents the mechanism (declarationIndex is
informational only).

If a future refactor introduces a re-sort of the bucket (e.g. for a
priority-based merge across plugins) it would need to actually USE
`declarationIndex` for the tie-break. Today's pseudo-monotonic counter
also increments ACROSS event boundaries within one plugin (line 256
declares `let declarationIndex = 0` OUTSIDE the event loop), so the
test
`tests/bridges/hooks/event-router.test.ts:204` assertion
`bucket.map(e => e.declarationIndex) === [0, 1, 2]` only holds when the
plugin declares handlers in a single event — a mixed-event plugin
would produce non-contiguous declarationIndex within each bucket.

**Fix:** Either (a) drop the field if not used, or (b) make
`declarationIndex` reset per-event so the within-bucket sequence is
always [0, 1, 2, ...] and update the test to assert that for mixed-
event plugins.

### IN-02: Test seam `activeExecutor` is module-level mutable state — no locking discipline

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:50`
**Issue:** `let activeExecutor: HookExecutor = dispatchHookExec;` is a
module-level cell mutated by `_setExecutorForTest` /
`_resetExecutorForTest`. Tests use `t.after(_resetExecutorForTest)` to
restore the production executor. If a test forgets the teardown,
subsequent tests in the same file silently inherit the spy. node:test
runs tests sequentially within a file by default, so this is bounded
to one test file, but a future shift to concurrent tests inside a file
would race.

**Fix:** No code change required if node:test stays sequential. If
concurrent testing is enabled, switch to passing the executor via the
composite-handler factory's closure parameter rather than a module
cell.

### IN-03: `matcher.piTools.has(toolName as never)` casts to never

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:84`
**Issue:**
```typescript
case "tool-set":
  return matcher.piTools.has(toolName as never);
```

The `as never` cast bypasses TypeScript's `ReadonlySet<PiToolName>`
guard so a `string` can be looked up. Runtime is fine (Set.has does
string equality) but the cast suppresses a legitimate type concern: a
future change to `PiToolName` (e.g. adding a non-string branded type)
would silently widen here. Prefer the more honest
`(matcher.piTools as ReadonlySet<string>).has(toolName)`.

**Fix:**
```typescript
return (matcher.piTools as ReadonlySet<string>).has(toolName);
```

### IN-04: Placeholder ctx at factory time is structurally invalid but unused

**File:** `extensions/pi-claude-marketplace/index.ts:53-54`
**Issue:**
```typescript
const placeholderCtx = {} as unknown as ExtensionContext;
await registerHooksBridge(pi, { ctx: placeholderCtx, cwd: homedir() });
```

The comment explains the field is functionally unused at factory time,
which is true today (the hydrate code path does not consume
`opts.ctx`). But the option is still REQUIRED by
`registerHooksBridge`'s signature, and a future contributor adding a
ctx.ui.notify call inside hydrate would crash with `Cannot read
property 'ui' of undefined`. This is a type-system gap masquerading as
documentation.

**Fix:** Make `ctx` optional in `registerHooksBridge`'s opts and
declare it as such, since today it is genuinely not consumed:

```typescript
export async function registerHooksBridge(
  pi: ExtensionAPI,
  opts: { ctx?: ExtensionContext; cwd: string },
): Promise<void>
```

Or, drop ctx from the bridge's contract entirely and let the
execution-layer phase that needs it add it back when there's a real
consumer.

### IN-05: `parsedConfigCache` and `routingTable` are module globals — multi-instance hostility

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:96-100`
**Issue:** `liveEpoch`, `parsedConfigCache`, and `routingTable` are
module-level singletons. The whole file is designed around the
assumption that exactly one hooks bridge exists per process. This
matches Pi's single-extension-instance model today, but the
architecture-test invariants (DISP-01, DISP-02) implicitly bake in this
assumption. If a future test or workflow ever instantiates the bridge
twice in one process (e.g. parallel test runners with isolation-by-
worker), state leaks between instances.

This is acceptable architecture for V1; document it explicitly so a
future refactor toward instance-scoped state is intentional rather
than accidental.

**Fix:** No code change. Add a single comment near the module-state
block:

```typescript
// Module-state cells. Single-instance by design; the hooks bridge
// assumes ONE instance per process and is registered by the extension
// factory at load time. Tests use `_resetForTest()` to clear between
// cases. Multi-instance isolation would require lifting these into a
// per-bridge closure or a Map keyed by bridge identity.
```

### IN-06: `hookDebugLog` invocation uses `[hooks]` prefix but is shared across the bridge AND the domain parser

**File:** `extensions/pi-claude-marketplace/shared/debug-log.ts:20-24`
and consumers (`domain/components/hooks.ts:164,171,186`;
`bridges/hooks/event-router.ts:332,384,391,440`;
`orchestrators/plugin/install.ts:339,348`)
**Issue:** Every diagnostic line is prefixed `[hooks]` regardless of
which subsystem emitted it (parse path, hydrate path, install-cache
add path). An operator debugging a hydrate failure cannot tell
whether the line came from the parser or the bridge without grepping
the source. A subsystem tag would be cheap and improve operator
ergonomics.

**Fix:** Either (a) leave as-is (acceptable for V1; the prefix
identifies the SUBSYSTEM, the message identifies the SITE), or (b)
expand the signature:

```typescript
export function hookDebugLog(site: string, detail: string): void {
  if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1") {
    console.error(`[hooks:${site}] ${detail}`);
  }
}
```

Either choice is fine; flagging this purely to surface the operator-
ergonomics trade-off so a future deliberate decision can lock it in
without re-discovering the question.

---

_Reviewed: 2026-06-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

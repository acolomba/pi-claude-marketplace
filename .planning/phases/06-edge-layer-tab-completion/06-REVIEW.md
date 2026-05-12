---
phase: 06-edge-layer-tab-completion
reviewed: 2026-05-11T15:39:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/args-schema.ts
  - extensions/pi-claude-marketplace/edge/args.ts
  - extensions/pi-claude-marketplace/edge/completions/data.ts
  - extensions/pi-claude-marketplace/edge/completions/normalize.ts
  - extensions/pi-claude-marketplace/edge/completions/provider.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/edge/types.ts
  - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/presentation/marketplace-list.ts
  - extensions/pi-claude-marketplace/shared/completion-cache.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-05-11T15:39:00Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Phase 6 implements the edge layer for the `/claude:plugin` slash command surface,
the cache-backed tab-completion provider, two read-only LLM tools, and the
post-state-commit completion-cache invalidation contract. Architectural
discipline (BLOCK A notify chokepoint, BLOCK C import boundaries, NFR-5 no
network in completion path, NFR-10 path containment for the new
`pluginCacheFile` helper) is consistently honored across all 29 files. Test
coverage is broad and hermetic (mkdtemp + `__resetCacheForTests` per case;
TC-8 / TC-9 soft-fail vs. propagation paths exercised end-to-end).

Findings cluster in three areas:

1. **Inconsistent / incomplete cache invalidation.** Three orchestrators that
   either mutate `state.marketplaces` directly (autoupdate) or change the
   on-disk SHA but not the plugin set (update bare-name path with no
   manifest delta) skip the invalidation calls performed elsewhere
   (WR-01, WR-02). Resolver-side stale-cache wallpapering hides the symptom
   but completion freshness is not guaranteed.

2. **Misleading / drift-prone documentation in `register.ts`.** The
   "captured at registration time" comment for `process.cwd()` (WR-03)
   actively contradicts the runtime semantics --- `makeLocationsResolver`
   runs per-keystroke. A future reader will trust the comment over the
   code.

3. **Dead / out-of-sync code.** `getScopeCompletions` (WR-04) is exported
   from `data.ts` but never called by the dispatcher in `provider.ts`,
   which inlines a no-description variant. The V1 UX (descriptions for
   `--scope user` / `--scope project` suggestions) is silently lost in
   the new dispatcher path.

No critical / security-class findings. The TypeScript strict discipline,
discriminated-union resolver contract (NFR-7), and path-containment chokepoints
(NFR-10) are all intact.

## Warnings

### WR-01: autoupdate orchestrator skips completion-cache invalidation

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:57-63`

**Issue:** The autoupdate flip mutates `state.marketplaces[name].autoupdate`
inside `withStateGuard`, but no `invalidateMarketplaceNames` /
`invalidateMarketplaceCache` call follows the guard. Every other
state-mutating orchestrator in Phase 6 (`add`, `remove`, marketplace
`update`, plugin `install`, plugin `uninstall`) consistently invalidates
after the guard returns.

The autoupdate flag is not surfaced through the cache schemas
(`MARKETPLACE_NAMES_CACHE_SCHEMA` / `PLUGIN_INDEX_CACHE_SCHEMA` in
`shared/completion-cache.ts` lines 65-87), so completion correctness
itself is not affected. But the omission is silent: a future reader who
adds an autoupdate-aware completion (e.g., highlighting auto-updating
marketplaces in the list-marketplaces tab completion) inherits stale data
because the precedent says "state changed -> invalidate cache" and this
orchestrator breaks that precedent.

**Fix:**
```ts
// orchestrators/marketplace/autoupdate.ts -- after line 71 in the success
// arm of the per-scope loop, before accumulating results across scopes:
import { invalidateMarketplaceNames } from "../../shared/completion-cache.ts";

// ...
const result = await withStateGuard(locations, (state) =>
  applyAutoupdateFlipInPlace(state, opts.name, opts.enable),
);
overallChanged.push(...result.changed);
overallUnchanged.push(...result.unchanged);
// Defense-in-depth + precedent: every state-mutating orchestrator
// invalidates the marketplace-names cache after the guard returns.
// The autoupdate flag is not in the current cache schema but the
// precedent must be maintained for future additions.
if (result.changed.length > 0) {
  invalidateMarketplaceNames(scope);
}
```

Alternatively, document explicitly in `autoupdate.ts` header why
invalidation is intentionally omitted (cache schema does not carry the
autoupdate flag) so the next reader does not have to re-derive this.

---

### WR-02: misleading "captured at registration time" comment in register.ts

**File:** `extensions/pi-claude-marketplace/edge/register.ts:89-94`

**Issue:** The comment block says

> Pitfall 3: this `process.cwd()` is the single sanctioned site in
> Phase 6. Captured at registration time; threads through every
> keystroke's completion lookup via the closed-over resolver.

But the code does NOT capture cwd at registration:

```ts
getArgumentCompletions: (prefix) =>
  getArgumentCompletions(prefix, makeLocationsResolver(process.cwd())),
```

`process.cwd()` is invoked inside the arrow function --- so it executes
on EVERY keystroke and reflects the process cwd at that moment, NOT at
the moment `registerCommand` ran. If a host process `cd`s mid-session,
the project-scope resolver follows. That may even be the desired
behavior, but the comment is the inverse of the truth.

This is a documentation defect that misleads readers about a contract
the registration site appears to make. If a future refactor reads the
comment and "fixes" the code to actually capture cwd once (move the
`process.cwd()` call into the outer function body, or `const cwd =
process.cwd();` at the top of `registerClaudePluginCommand`), behavior
silently changes for any session where the user's cwd shifts.

**Fix:** Decide which semantic is correct (per-keystroke cwd vs. capture
at registration), then either:

1. Update the comment to match the code:
```ts
// Pitfall 3: this `process.cwd()` is the single sanctioned site in
// Phase 6. Re-read on EACH completion keystroke so project-scope
// follows the host process's current directory if it shifts during
// the session.
```

2. Or capture cwd once if registration-time semantics are correct:
```ts
const registrationCwd = process.cwd();
// ...
getArgumentCompletions: (prefix) =>
  getArgumentCompletions(prefix, makeLocationsResolver(registrationCwd)),
```

The 06-CONTEXT / 06-PATTERNS documents must be consulted to confirm
which is the design intent.

---

### WR-03: `getScopeCompletions` is exported but never called; V1 description UX lost

**File:** `extensions/pi-claude-marketplace/edge/completions/data.ts:141-153`
**File:** `extensions/pi-claude-marketplace/edge/completions/provider.ts:93-99`

**Issue:** `data.ts` exports `getScopeCompletions(argumentTextPrefix)` that
emits `--scope user` / `--scope project` items WITH descriptions
(`"User scope (~/.pi/agent)"`, `"Project scope (.pi/)"`). The dispatcher
in `provider.ts` never calls it. Instead, the TC-4 branch (token after
`--scope`) inlines a description-less variant:

```ts
// provider.ts:93-99
if (prevToken === "--scope") {
  return ["user", "project"]
    .filter((v) => v.startsWith(current))
    .map((v) => ({ label: v, value: `${headPrefix}${v} ` }));
}
```

`getScopeCompletions` is dead code as far as the production dispatcher
is concerned. The two completion items are NOT semantically equivalent
to `getScopeCompletions`: V1 emitted `--scope user` (with the flag) as
a single completion AFTER `--`; the new dispatcher emits the bare
value `user` AFTER `--scope`. Both surfaces exist in V1; the dispatcher
implements the latter and discards the former.

If the V1 UX of `--scope user` (flag + value as one completion with a
description) was intentionally dropped, `getScopeCompletions` should be
deleted along with its associated comment.

If it should still be reachable from some path (e.g., emitting "did
you mean --scope user?" after a bare `--` with no other context), the
dispatcher needs to wire it in.

Also: the TC-3 branch (lines 103-122) DOES carry descriptions for
`--scope`/`--installed`/`--available`/`--unavailable`, so the
description UX is partially preserved --- but only for flag-name
completion, not for the post-flag value completion in TC-4.

**Fix:** Either delete the unused export

```ts
// data.ts -- delete lines 141-153 entirely
// also drop the matching mention in the file's top comment block
```

or call it from the dispatcher

```ts
// provider.ts -- replace lines 95-99:
if (prevToken === "--scope") {
  // Emit description-bearing TC-4 items so the UX matches V1.
  const argumentTextPrefix = tokens.join(" ");
  return [
    { label: "user", value: `${headPrefix}user `, description: "User scope (~/.pi/agent)" },
    { label: "project", value: `${headPrefix}project `, description: "Project scope (.pi/)" },
  ].filter((c) => c.label.startsWith(current));
}
```

---

### WR-04: `edge-deps.ts::loadManifestForMarketplace` re-loads state.json on every manifest probe

**File:** `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts:107-187`

**Issue:** `loadManifestForMarketplace(scope, marketplace)` calls
`loadState(locations.extensionRoot)` on line 113 to look up
`mp.manifestPath` / `mp.marketplaceRoot`. This same `loadState` was
already called by `loadStateForScope(scope)` (line 91) when the
marketplace-names cache rebuild ran for this same scope.

When `getPluginToMarketplacesMap` (data.ts:225) iterates over scopes
and marketplaces, each per-marketplace cache miss triggers another
`loadState` call. For N marketplaces in a scope, the names cache is
rebuilt once (correct), but every plugin-index rebuild re-runs
`loadState` to look up its own manifest path --- O(N) state.json reads
per scope on a cold cache.

This is purely a correctness-adjacent concern: the state may CHANGE
between the names-cache rebuild and a subsequent manifest rebuild,
meaning the names cache and the plugin-index cache can disagree about
which marketplaces exist. The narrow window is shared with other
concurrent-process scenarios documented in 06-CONTEXT (TC-9 stale-state
handling) but the in-process double-load is gratuitous.

**Fix:** Cache the state load inside the resolver closure --- but
correctly: the resolver lives for the lifetime of ONE completion call
(per WR-02 it's re-created per keystroke), so the state read is
already bounded. Better path: read state once at the top of each
completion invocation and pass it through the resolver as a memoized
field, e.g.:

```ts
// orchestrators/edge-deps.ts
export function makeLocationsResolver(cwd: string): LocationsResolverLike {
  const stateCache = new Map<Scope, Promise<ExtensionState>>();
  const getState = (scope: Scope): Promise<ExtensionState> => {
    let p = stateCache.get(scope);
    if (p === undefined) {
      p = loadState(locationsFor(scope, cwd).extensionRoot);
      stateCache.set(scope, p);
    }
    return p;
  };

  return {
    // ...
    async loadStateForScope(scope) {
      const state = await getState(scope);
      // project + return as before
    },
    async loadManifestForMarketplace(scope, marketplace) {
      try {
        const state = await getState(scope);
        const mp = state.marketplaces[marketplace];
        // ... rest unchanged
      } catch (err) {
        if (err instanceof ManifestSoftFailError) throw err;
        throw new ManifestSoftFailError(err);
      }
    },
  };
}
```

Bound to the resolver lifetime (one keystroke), the cache is bounded.
This also closes the in-keystroke read-skew window between the names
rebuild and the manifest rebuild.

---

## Info

### IN-01: `args.ts` dead-code branch `if (token === undefined)` is unreachable

**File:** `extensions/pi-claude-marketplace/edge/args.ts:33-39`

**Issue:** `tokens` comes from `tokenize(args)` which returns `string[]`
(no `undefined` members are ever pushed). The loop condition
`i < tokens.length` ensures `tokens[i]` is in-bounds. Hence
`tokens[i] === undefined` is unreachable.

The branch is defensive against a future API change but does not
affect correctness today. Leaving it in incurs a small amount of
unnecessary noise that obscures the actual loop body.

**Fix:** Either delete the branch outright, or leave a comment that
explicitly marks it as defensive-only:

```ts
// args.ts -- delete lines 36-39 if unreachable-branch removal is
// preferred. OR replace with a comment-only marker:
// (No `token === undefined` check needed: tokens[i] is in-bounds and
//  tokenize never produces undefined members.)
```

---

### IN-02: `parseArgs` returns mutable `string[]` despite consumer treating it as readonly

**File:** `extensions/pi-claude-marketplace/edge/args.ts:23-26`

**Issue:** `ParsedArgs.positional: string[]` is mutable. Consumers
(`args-schema.ts`, `provider.ts`'s `splitCompletionInput`, etc.) treat
it as read-only. A future caller could mutate the returned array and
break the validator's local copy semantics in `parseCommandArgs`.

**Fix:**
```ts
export interface ParsedArgs {
  positional: readonly string[];
  scope?: Scope;
}
```

This change is purely additive and TypeScript-strict-safe (readonly
arrays are assignable to `string[]` only with widening; existing
internal indexing remains valid).

---

### IN-03: `data.ts::splitCompletionInput` regex split silently coalesces unicode whitespace

**File:** `extensions/pi-claude-marketplace/edge/completions/data.ts:106-114`

**Issue:** `input.split(/\s+/)` matches all Unicode whitespace
characters (newline, tab, form feed, plus categories that JavaScript's
`\s` covers). The tokenizer in `args.ts` (line 76) only treats ASCII
space `" "` as a token separator. So the completion provider and the
command-parsing tokenizer disagree on what counts as a separator.

A user typing a tab character via Pi's keyboard handling (unlikely
but possible) would see different boundary detection on the
completion side vs. the executed-command side. The risk is small ---
slash-command argument strings come from a single editor surface ---
but the inconsistency is a latent bug.

**Fix:** Align by using a literal-space split, or document the
difference:

```ts
// data.ts:106
const trailingSpace = /[ ]$/.test(input);
const allTokens = input.split(" ").filter((t) => t !== "");
```

This matches `args.ts::tokenize`. Trade-off: it loses multi-space
collapsing, which the existing `.filter((t) => t !== "")` covers.

---

### IN-04: `register.ts` `pi.on("session_start", ...)` autocomplete-provider stacking is unbounded

**File:** `extensions/pi-claude-marketplace/edge/register.ts:101-117`

**Issue:** The comment on line 97 says

> V1 installs the wrapper unconditionally on every session_start;
> `normalizeCompletionWhitespace` is idempotent so re-installation is
> harmless.

But `addAutocompleteProvider` (called inside the event handler) adds
ANOTHER wrapper to a chain --- it does not replace the previous one.
Across multiple `session_start` fires (if a user reloads / re-starts
sessions), the wrapper chain grows linearly. Each wrapper runs
`normalizeCompletionWhitespace` (idempotent, so the result is
correct) but the chain itself wastes work proportional to session
count.

For typical interactive use this is negligible. For long-lived
Pi processes with many session restarts it is unbounded growth.

**Fix:** Either track installation in a module-private flag, or
trust the Pi host to clean up providers between sessions. The
former:

```ts
let autocompleteInstalled = false;
pi.on("session_start", (_event, ctx) => {
  if (autocompleteInstalled) return;
  autocompleteInstalled = true;
  ctx.ui.addAutocompleteProvider((current) => ({ /* ... */ }));
});
```

The latter requires confirming the Pi peer-dep contract resets
provider chains across sessions; documentation under
`@mariozechner/pi-coding-agent` should be consulted.

---

### IN-05: `tools.ts::loadVisibleMarketplaces` then `loadPluginListPayload` reads state.json twice for the existence check

**File:** `extensions/pi-claude-marketplace/edge/handlers/tools.ts:193-237`

**Issue:** The `pi_claude_marketplace_plugin_list` LLM tool first calls
`loadVisibleMarketplaces({ cwd, scope })` to test for marketplace
existence (line 194), then calls `loadPluginListPayload(...)`
(line 213). Both helpers load state.json internally; the same scope's
state is read twice per tool invocation when a marketplace name is
supplied.

In the marketplace-not-found path this is wasted work because
`loadPluginListPayload` would itself surface the not-found via empty
results --- but the tool elects the explicit "not found" surface for
agent clarity (a defensible UX choice). The cost is one extra
state-load per non-found invocation; for the found path it's a
guaranteed duplicate.

**Fix:** Have `loadPluginListPayload` return a "marketplace not found"
discriminator in its payload, then drop the pre-check entirely:

```ts
// orchestrators/plugin/list.ts -- add a status flag to the payload:
return { payload: { marketplaces, marketplaceNotFound: opts.marketplace !== undefined && marketplaces.length === 0 }, warnings };
```

```ts
// edge/handlers/tools.ts -- consume the flag:
const result = await loadPluginListPayload({ /* ... */ });
if (result.payload.marketplaceNotFound) {
  return {
    content: [{ type: "text", text: `Marketplace "${params.marketplace!}" not found.` }],
    details: { plugins: [] },
  };
}
```

This eliminates the double-load and keeps the user-visible surface
identical. Lower priority than WR-04 because the LLM tool is not the
keystroke-frequency hot path.

---

_Reviewed: 2026-05-11T15:39:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

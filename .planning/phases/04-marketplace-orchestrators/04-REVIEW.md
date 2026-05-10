---
phase: 04-marketplace-orchestrators
reviewed: 2026-05-10T23:22:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - extensions/claude-marketplace/domain/source.ts
  - extensions/claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/claude-marketplace/orchestrators/marketplace/index.ts
  - extensions/claude-marketplace/orchestrators/marketplace/list.ts
  - extensions/claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/claude-marketplace/orchestrators/types.ts
  - extensions/claude-marketplace/persistence/locations.ts
  - extensions/claude-marketplace/presentation/index.ts
  - extensions/claude-marketplace/presentation/marketplace-list.ts
  - extensions/claude-marketplace/presentation/reload-hint.ts
  - extensions/claude-marketplace/presentation/soft-dep.ts
  - extensions/claude-marketplace/shared/errors.ts
  - tests/domain/source.test.ts
  - tests/helpers/git-mock.ts
  - tests/orchestrators/marketplace/_fixtures/README.md
  - tests/orchestrators/marketplace/_fixtures/empty-marketplace/.claude-plugin/marketplace.json
  - tests/orchestrators/marketplace/_fixtures/invalid-manifest/.claude-plugin/marketplace.json
  - tests/orchestrators/marketplace/_fixtures/valid-marketplace/.claude-plugin/marketplace.json
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/marketplace/cascade.test.ts
  - tests/orchestrators/marketplace/list.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/presentation/marketplace-list.test.ts
  - tests/presentation/reload-hint.test.ts
  - tests/presentation/soft-dep.test.ts
findings:
  critical: 6
  warning: 9
  info: 5
  total: 20
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-10T23:22:00Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Phase 4 ships the five marketplace orchestrators (add / remove / list / update / autoupdate), the cross-subcommand `shared.ts` helpers, the presentation layer (reload hint, soft-dep warnings, list renderer), and the supporting tests. Architecture is largely sound -- the layering boundaries hold, `withStateGuard` discipline is honored, and NFR-5 (no network on path-source flows) is enforced by source-grep tests.

However, several defects affect correctness and contract conformance:

- **`remove.ts` skips reload hint when removedPlugins is empty (BLOCKER):** the success path always calls `reloadHint("drop", removedSorted)` and `appendReloadHint` -- when zero plugins were dropped the body is unaltered, but the MR-2 case with non-empty plugins whose cascades all returned empty `dropped` arrays passes through cleanly. Actually the issue is the *converse*: when at least one cascade returned `ok:true` and the marketplace had plugins but resources were unstaged in bridge no-ops, `removedPlugins` may stay empty even though plugin state was cleared. This is logically correct but the spec gate `MR-8` may not match.
- **`update.ts` MU-5 retry hint logic is overly permissive (BLOCKER):** `cloneAdvanced=true` is set before the source-kind branch test only inside the github branch -- but it is set *before* `refreshGitHubClone()` even runs, so any failure inside `refreshGitHubClone`'s first call (e.g. `gitOps.fetch` throwing on network error) still produces a "Retry the command." hint. That matches the comment ("clone-advanced is the conservative stance"), but it also means a pre-fetch validation failure inside `gitOps.fetch` will incorrectly tell the user to retry when the cause is unrecoverable. Edge case worth flagging.
- **`add.ts` GitHub path: when the cloned manifest's `name` matches an existing marketplace OR points at a stale `finalDir` that exists, the staging clone is leaked through cleanup but the *original* clone advanced (network IO succeeded).** This is acknowledged by the design, but the order of operations means a duplicate-name throw at line 149 leaves the freshly cloned staging tree which is then cleaned. That is fine. But if `finalDir` exists and `stagedAtFinal` stays false, the catch unconditionally tries to clean both the staging AND the final dir -- wait, no, the `else if` makes them exclusive. The catch logic appears correct after careful trace. **However:** `MarketplaceDuplicateNameError` thrown at line 149 runs BEFORE `finalDir` is computed (line 153) -- so the catch block at line 183-186 sees `finalDir === undefined` and falls into the `stagedAtFinal=false` branch correctly. OK.
- **`update.ts` `refreshGitHubClone` default-branch path resolves `HEAD` then `forceUpdateRef`s it (BLOCKER):** `gitOps.resolveRef({dir, ref: "HEAD"})` returns the SHA, not a branch name. Then `forceUpdateRef({ref: currentBranch, value: remoteSha})` uses that SHA as a ref name -- this writes to `refs/<40-hex-sha>` which is meaningless. The check-out-on-line-388 then checks out the SHA directly, which works but bypasses the symbolic-HEAD update intent.
- **`shared.ts`/`DEFAULT_GIT_OPS` performs dynamic import on every `forceUpdateRef` call.** Dynamic `await import("isomorphic-git")` and `await import("node:fs")` inside the hot path is wasteful and re-runs ESM resolution. Should be top-of-file imports. Also "platform/git.ts does not expose a force-ref-update wrapper" is documented as the reason, but bypassing the platform layer for this one operation violates D-13 "the only orchestrator-tier site that touches isomorphic-git directly" -- the right fix is to add `forceUpdateRef` to `platform/git.ts`.
- **`source.ts` MM-4 lumps empty string and `foo/bar/baz` under `non-relative` reason -- accurate, but the test at line 95 asserts the empty-string case ALSO matches "non-relative" -- silently allowing the parser to classify `""` as path traversal noise.** Empty string should arguably be a distinct reason since it indicates a user error path.

The implementation has clean test coverage but several tests are tautological -- they replicate orchestrator constants (e.g. `RELOAD_HINT_PREFIX`) rather than reading them from PRD-anchored marker tests. See findings below for detail.

## Critical Issues

### CR-01: `refreshGitHubClone` default-branch path force-updates a SHA-named ref instead of the actual branch

**File:** `extensions/claude-marketplace/orchestrators/marketplace/update.ts:379-389`
**Issue:** When `storedRef === undefined`, the code calls `gitOps.resolveRef({dir, ref: "HEAD"})` to read the "current branch", but `resolveRef` of `HEAD` returns the SHA at HEAD, not a symbolic ref name. The code then uses that SHA string as the `ref` argument to `forceUpdateRef`, producing a meaningless `refs/<40-hex>` write. The intent (per the D-14 docstring) is to write `refs/heads/<branchname>` to the remote SHA. Using `git.expandRef` or `git.currentBranch` from isomorphic-git is required to get the symbolic branch name.

Consequence: the local branch ref is never advanced when tracking the default branch -- only `checkout` to the now-mismatched ref name "works" because the mock falls through to the 40-char hex SHA detection. In production, after `forceUpdateRef`, the local working branch points at the old SHA; only the working tree (via `checkout(ref=<sha>)`) advances, leaving the local branch detached from HEAD.

**Fix:**
```ts
// Replace lines 379-389
if (storedRef === undefined) {
  // Read remote HEAD SHA and the symbolic name of the local branch.
  const remoteSha = await gitOps.resolveRef({
    dir: cloneDir,
    ref: "refs/remotes/origin/HEAD",
  });
  // resolveRef('HEAD') returns a SHA, not a branch name. Use
  // isomorphic-git.currentBranch() (expose via platform/git.ts) to get
  // the symbolic local branch (e.g. "main").
  const currentBranch = await defaultGit.currentBranch({ dir: cloneDir }); // new wrapper
  if (currentBranch === undefined) {
    // Detached HEAD: just check out the SHA directly.
    await gitOps.checkout({ dir: cloneDir, ref: remoteSha });
    return;
  }
  await gitOps.forceUpdateRef({
    dir: cloneDir,
    ref: `refs/heads/${currentBranch}`,
    value: remoteSha,
  });
  await gitOps.checkout({ dir: cloneDir, ref: currentBranch });
  return;
}
```

### CR-02: `addPathInGuard` calls `stat()` on the verbatim user-typed path without tilde expansion

**File:** `extensions/claude-marketplace/orchestrators/marketplace/add.ts:208-209`
**Issue:** SP-7/MA-4 contract is that `PathSource.logical === PathSource.raw` is the verbatim user-typed string with `~` preserved. The add path immediately calls `stat(source.logical)` to probe whether the path is a file or directory -- but `stat()` does NOT perform shell tilde expansion, so a user input of `~/projects/local-mp` results in `ENOENT` because Node looks for a literal directory named `~`. The code comment at lines 201-207 explicitly punts this to "Phase 4 location/index helpers" and says "Tests pass already-expanded absolute paths" -- but the orchestrator is the Phase 6 edge-layer entry point's only public surface for path-source add. If the edge layer does not expand the tilde before calling `addMarketplace`, the user-facing failure is opaque.

The test `tests/orchestrators/marketplace/add.test.ts:281-289` documents this gap: `MA-4: tilde paths are preserved verbatim in stored source.raw` only verifies the parser's `source.raw`, never exercising the full `addMarketplace` happy path with a `~/...` raw source.

**Fix:** Either (a) expand the tilde inside `addPathInGuard` using `os.homedir()` before calling `stat`, or (b) document a hard precondition that the edge layer MUST pre-expand tildes and add a defensive guard:
```ts
const onDiskPath = source.logical.startsWith("~")
  ? path.join(os.homedir(), source.logical.slice(1))
  : source.logical;
// or:
if (source.logical.startsWith("~")) {
  throw new Error(`addMarketplace: tilde-prefixed path "${source.logical}" must be expanded by caller before reaching the orchestrator (SP-7).`);
}
```
And add a test for the happy `~/foo/marketplace.json` path that uses a hermetic `process.env.HOME`.

### CR-03: `update.ts` MU-7 partitioning when `pluginUpdate` throws produces `notes` containing the raw error message -- but `formatErrorWithCauses` is NOT applied, breaking ES-4 cause-chain preservation

**File:** `extensions/claude-marketplace/orchestrators/marketplace/update.ts:280-289`
**Issue:** When `pluginUpdate(plugin, name, scope)` throws, the catch synthesizes:
```ts
outcome = {
  partition: "failed",
  name: plugin,
  notes: [errorMessage(err)],
};
```
`errorMessage(err)` returns only `err.message` for `Error` instances or `String(err)` otherwise. It does NOT walk `Error.cause` chains. Per ES-4 / Pitfall 10 and per `formatErrorWithCauses` defined in the same file at line 307, any error that carries a `cause` (which is the entire purpose of the chained error contract) loses its tail when reaching the user via the MU-7 "Failed:" partition.

**Fix:**
```ts
} catch (err) {
  outcome = {
    partition: "failed",
    name: plugin,
    notes: [formatErrorWithCauses(err)],  // walks Error.cause up to depth 5
  };
}
```

### CR-04: `DEFAULT_GIT_OPS.forceUpdateRef` performs dynamic ESM import on every call

**File:** `extensions/claude-marketplace/orchestrators/marketplace/shared.ts:82-86`
**Issue:** Each invocation of `forceUpdateRef` re-runs `await import("isomorphic-git")` and `await import("node:fs")`. While ESM caches resolved modules, the `await import()` syntax forces a microtask hop per call and is wasteful for a hot path inside the D-14 sequence (called once per update for github sources, plus inside `updateAllMarketplaces`).

More importantly: the comment claims "this file is the only orchestrator-tier site that touches isomorphic-git directly" -- but the orchestrator-layer importing isomorphic-git at all is a layering violation. `platform/git.ts` already wraps the other four primitives; adding a `forceUpdateRef` wrapper there is the right architectural choice.

**Fix:**
1. Add to `platform/git.ts`:
```ts
import * as git from "isomorphic-git";
import * as fs from "node:fs";

export interface ForceUpdateRefOptions {
  dir: string;
  ref: string;
  value: string;
}

export async function forceUpdateRef(opts: ForceUpdateRefOptions): Promise<void> {
  await git.writeRef({ fs, dir: opts.dir, ref: opts.ref, value: opts.value, force: true });
}
```
2. Update `shared.ts`:
```ts
export const DEFAULT_GIT_OPS: GitOps = {
  clone: defaultGit.clone,
  fetch: async (o) => { await defaultGit.fetch(o); },
  forceUpdateRef: defaultGit.forceUpdateRef,
  checkout: defaultGit.checkout,
  resolveRef: defaultGit.resolveRef,
};
```

### CR-05: `update.ts` MU-5 `cloneAdvanced` is set BEFORE `refreshGitHubClone()` runs, so pre-fetch failures get the wrong retry hint

**File:** `extensions/claude-marketplace/orchestrators/marketplace/update.ts:213-225`
**Issue:** The MU-5 contract per the PRD: "Retry the command." is appended ONLY when the clone has advanced (fetch / forceUpdateRef / checkout succeeded in part). The current code sets `cloneAdvanced = true` BEFORE calling `refreshGitHubClone`, on the conservative theory that any throw inside the function means SOME work happened. But the very first operation inside `refreshGitHubClone` is `gitOps.fetch()`, which can fail for purely-pre-clone reasons (DNS failure, network unreachable). These get the "Retry the command." hint applied, but no retry will help if the host is offline. The hint is misleading.

The header comment at lines 217-223 acknowledges this trade-off ("the conservative stance is 'anything past source-kind dispatch counts as clone-advanced'"), but flipping it to set `cloneAdvanced` AFTER `gitOps.fetch` returns would correctly distinguish "fetch failed → no retry hint" from "fetch succeeded, later step failed → retry hint."

**Fix:**
```ts
// In refreshGitHubClone, return a discriminated result so the caller knows
// what phase failed:
export interface RefreshResult {
  readonly fetchSucceeded: boolean;
}

async function refreshGitHubClone(
  cloneDir: string,
  storedRef: string | undefined,
  gitOps: GitOps,
): Promise<RefreshResult> {
  await gitOps.fetch({...});
  const fetchSucceeded = true;
  // ... rest of function ...
  return { fetchSucceeded };
}

// In refreshOneMarketplace:
let cloneAdvanced = false;
try {
  if (source.kind === "github") {
    const cloneDir = await locations.sourceCloneDir(name);
    try {
      await refreshGitHubClone(cloneDir, source.ref, gitOps);
      cloneAdvanced = true;  // ONLY true if refreshGitHubClone returned cleanly
    } catch (refreshErr) {
      // fetchSucceeded path: caller must inspect the error to decide.
      // Simplest: set cloneAdvanced=true after first successful gitOps call
      // (track inside refreshGitHubClone via an out-param or split into two
      // calls).
      throw refreshErr;
    }
    await refreshManifestPointer(record, cloneDir);
  }
  // ...
}
```

(Note: this finding contradicts the inline header comment which calls the existing behavior "the conservative stance" -- that comment is itself wrong from a UX perspective; the conservative *user-experience* stance is to suppress the retry hint when no progress was made.)

### CR-06: `cascadeUnstagePlugin` AG-5 foreign-content throw loses the failed list's per-agent reasons after first occurrence

**File:** `extensions/claude-marketplace/orchestrators/marketplace/shared.ts:159-163`
**Issue:** When `agentsResult.failed.length > 0`, the cascade builds a single message string from `agentsResult.failed.map(...).join("; ")` and throws a fresh `Error()`. This Error does NOT preserve the structured `failed[]` array, so downstream consumers (the per-plugin failure path in `remove.ts`) get only the textual concatenation. If a future requirement (e.g. partial-success removal) needs to read individual failed entries, the structure is lost.

Less critically: the message format is `${generatedName}: ${reason}` -- but `generatedName` for foreign-content failures is the AG-5 already-canonicalized name, while `reason` is bridge-internal text. Per ES-4, this should be wrapped with `cause` to preserve the original error structure.

**Fix:**
```ts
if (agentsResult.failed.length > 0) {
  const reasons = agentsResult.failed.map((f) => `${f.generatedName}: ${f.reason}`).join("; ");
  // Attach the structured failed[] for downstream inspection.
  const err = new Error(`Failed to remove ${agentsResult.failed.length} agent(s): ${reasons}`);
  (err as Error & { failedAgents?: unknown }).failedAgents = agentsResult.failed;
  throw err;
}
```
Or define a proper `AgentsUnstageFailureError` class with a `readonly failed` field.

## Warnings

### WR-01: `removeMarketplace` `cleanedPluginNames` collected during cascade is mutated AFTER cascade -- race with guard re-entry

**File:** `extensions/claude-marketplace/orchestrators/marketplace/remove.ts:134-138`
**Issue:** The guard closure (lines 96-144) accumulates `cleanedPluginNames` during the cascade loop, THEN performs `delete record.plugins[cleaned]` in a separate loop. If the cascade throws on a later plugin (which can't happen here because cascade is fail-soft, returning `ok:false`), state would be partially-mutated. The code currently dodges this because cascade is fail-soft, but the two-loop pattern obscures the intent and creates fragility if the cascade contract ever changes.

**Fix:** Either (a) document the invariant inline (the cascade NEVER throws), or (b) collapse the two loops into one -- clean state during the cascade loop body, not after.

### WR-02: `removeMarketplace` does not call `withStateGuard` for post-state cleanup, but failures there throw out of the orchestrator

**File:** `extensions/claude-marketplace/orchestrators/marketplace/remove.ts:185-192`
**Issue:** When `cleanupLeaks.length > 0`, the code throws an aggregated error AFTER `withStateGuard` has already saved state.json with the marketplace removed. The user sees a thrown error from the orchestrator (not a `notifyWarning`), but the marketplace IS gone from state. This violates the implicit MR-6 contract that user-visible output goes through `ctx.ui.notify`: a thrown error reaches whatever catches it (Phase 6 edge layer), which must translate it. Today, it's IL-2 compliant only by accident. The pattern should be `notifyWarning` here, since state is already committed.

**Fix:** Replace `throw appendLeaks(...)` with `notifyWarning(opts.ctx, ...)` and return cleanly. State is already saved; the user-visible message is the only remaining work.

### WR-03: `update.ts` `refreshManifestPointer` overwrites `record.manifestPath` and `record.marketplaceRoot` even when the values are unchanged

**File:** `extensions/claude-marketplace/orchestrators/marketplace/update.ts:435-436`
**Issue:** For path-source marketplaces, `marketplaceRoot` should already equal the record's existing `marketplaceRoot` (the caller passes it in). Setting them again is a no-op write that defeats any future "did anything change?" optimization. For github sources, `marketplaceRoot` is the same `cloneDir` that was passed in -- also a no-op.

This is not a correctness bug, but the side-effect-bearing function signature obscures the actual mutation (just re-validating). Renaming to `validateManifestAtRoot` and dropping the writes would clarify intent.

**Fix:**
```ts
async function validateManifestAtRoot(
  record: ExtensionState["marketplaces"][string],
  marketplaceRoot: string,
): Promise<void> {
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  const text = await readFile(manifestPath, "utf8");
  const parsed: unknown = JSON.parse(text);
  if (!MARKETPLACE_VALIDATOR.Check(parsed)) {
    throw new Error(`Refreshed marketplace manifest at ${manifestPath} failed schema validation`);
  }
  // Writes only when paths actually changed.
  if (record.manifestPath !== manifestPath) record.manifestPath = manifestPath;
  if (record.marketplaceRoot !== marketplaceRoot) record.marketplaceRoot = marketplaceRoot;
}
```

### WR-04: `update.ts` soft-dep warnings use `["plugin"]` placeholder arrays

**File:** `extensions/claude-marketplace/orchestrators/marketplace/update.ts:317-320`
**Issue:** The composition logic synthesizes `dummyAgentsHint = updatedNames.length > 0 ? ["plugin"] : []` and same for MCP -- these are fake placeholder strings that satisfy the soft-dep helper's "is the staged list non-empty?" check without conveying the actual staged agent/MCP names. The comment acknowledges this ("Phase 4 conservatively treats both soft-dep slots as 'may need warning'"), but the result is that the warning fires whenever any plugin updated, regardless of whether agents or MCP servers were actually staged.

For RH-5 this means false-positive soft-dep warnings on plugin updates that touched only skills/commands. The actual fix is for `PluginUpdateOutcome` to carry the staged-resource counts so the orchestrator can compute the correct hint lists.

**Fix:** Extend `PluginUpdateOutcome` (orchestrators/types.ts) to include:
```ts
readonly stagedAgents?: readonly string[];
readonly stagedMcpServers?: readonly string[];
```
Then aggregate across `partitions.updated` to get the real lists.

### WR-05: `add.ts` `MarketplaceDuplicateNameError` thrown BEFORE staging-dir cleanup runs through the same catch -- but stagingDir is left in place

**File:** `extensions/claude-marketplace/orchestrators/marketplace/add.ts:148-150`
**Issue:** The duplicate-name check at line 148 fires AFTER the clone has already filled `stagingDir`. The throw goes to the `catch` at line 177, where `stagedAtFinal === false` so `cleanupStaging(stagingDir, ...)` runs. That is correct. But the user-visible error here is `MarketplaceDuplicateNameError` -- a precondition error -- and the staging dir was wastefully populated by a network clone first. If duplicate-name check ran BEFORE the clone (which requires reading the manifest twice -- once to get the name, then keeping it), the network IO would be skipped on the duplicate-name case.

This is a design choice (the manifest is the source of truth for the marketplace name, and the manifest is inside the clone), but it does mean every duplicate-name attempt pays for the full clone before failing. Not a correctness bug, but worth noting that `MA-8 duplicate name in this scope` is documented as a step-3 check (after clone + manifest validation) by intent.

**Fix:** None required; acknowledge the trade-off in the header comment if not already there.

### WR-06: `applyAutoupdateFlip` returns frozen arrays but the closure mutates `state` in place -- Object.freeze on outer is misleading

**File:** `extensions/claude-marketplace/orchestrators/marketplace/shared.ts:240-258`
**Issue:** `Object.freeze({ changed: Object.freeze(changed), unchanged: Object.freeze(unchanged) })` makes the *return value* immutable, but the function mutates `state.marketplaces[name].autoupdate` directly. The freeze gives a false signal that the function is pure. Either drop the freeze (it's defensive only against caller mistakes), or rename the function to clearly indicate it's side-effecting (`applyAutoupdateFlipInPlace`).

**Fix:** Either drop the `Object.freeze` (the closure caller's responsibility is to not mutate the result), or rename to `applyAutoupdateFlipInPlace` for clarity.

### WR-07: `cascade.test.ts` test "bogus locations" has a fragile assertion that accepts both outcomes

**File:** `tests/orchestrators/marketplace/cascade.test.ts:86-127`
**Issue:** The test asserts:
```ts
if (!outcome.ok) {
  assert.ok(outcome.cause instanceof Error);
} else {
  assert.deepEqual(outcome.dropped.agents, []);
}
```
This is a degenerate test -- it passes regardless of which branch is taken. If the agents bridge changes its behavior such that it throws *or* silently accepts the failure, the test still passes. The test should pin one specific behavior.

**Fix:** Either (a) mock the bridge to deterministically throw and assert `ok:false`, or (b) document the specific bridge contract being tested.

### WR-08: `update.test.ts` `MU-6 + MU-8` test asserts cascade is called per state plugin, but no fixture-driven test of NOT calling for new manifest entries

**File:** `tests/orchestrators/marketplace/update.test.ts:236-280`
**Issue:** The test name claims "MU-8: even though the manifest fixture lists `hello` as well, the cascade enumerates state.plugins keys, not manifest entries, so a manifest that grew new entries would NOT trigger spurious calls." But the test only seeds ONE plugin in state.plugins ("hello") and the manifest fixture also has one plugin ("hello"). The assertion `calls.length === 1` does NOT distinguish "enumerated state.plugins" from "enumerated manifest.plugins" -- they have the same cardinality here.

**Fix:** Add a fixture variant where the manifest has TWO plugins but state has only ONE, and assert `calls.length === 1` AND `calls[0].plugin === "hello"` (not the new entry).

### WR-09: `add.test.ts` `MA-9` cleanup assertion uses a permissive regex `/staging.*leak|leak.*staging|orphan|leaked|additionally/i`

**File:** `tests/orchestrators/marketplace/add.test.ts:191-201`
**Issue:** The regex matches `additionally`, which is the `appendLeakToError` separator phrase -- but it also matches any substring containing "leak" or "staging" -- including incidental usage in unrelated error messages. The test should pin the EXACT error message format produced by `appendLeakToError` rather than a loose regex.

**Fix:** Replace with byte-exact substring matches against the canonical `appendLeakToError` output, OR call `appendLeakToError` in the test fixture to derive the expected string.

## Info

### IN-01: `source.ts` MM-4 reason for empty string is misleading

**File:** `extensions/claude-marketplace/domain/source.ts:62-64,109`
**Issue:** `nonRelativeReason("")` returns `"non-relative string source  cannot be classified"` -- double-space before "cannot" because `raw` is empty. The output is slightly awkward but harmless.

**Fix:** Either special-case empty: `if (raw === "") return { kind: "unknown", raw, reason: "empty source string" };` or strip empty when interpolating.

### IN-02: `shared.ts` formatErrorWithCauses uses `Object.prototype.toString.call` for non-Error, non-string

**File:** `extensions/claude-marketplace/orchestrators/marketplace/shared.ts:313-318`
**Issue:** For thrown plain objects (rare but possible), `Object.prototype.toString.call(current)` returns `"[object Object]"` -- same opacity as the default `String(current)` it was trying to avoid. The intent (avoid ESLint's `no-base-to-string`) is met, but the user-visible output is no better. Consider `JSON.stringify(current)` with a try/catch as a fallback, capped at a short length.

**Fix:**
```ts
const message =
  current instanceof Error
    ? current.message
    : typeof current === "string"
      ? current
      : safeStringify(current);
// where:
function safeStringify(v: unknown): string {
  try { return JSON.stringify(v).slice(0, 200); } catch { return Object.prototype.toString.call(v); }
}
```

### IN-03: `marketplace-list.ts` blank line insertion logic forces ordering "user before project"

**File:** `extensions/claude-marketplace/presentation/marketplace-list.ts:53-71`
**Issue:** The `for (const scope of ["user", "project"] as const)` loop hardcodes the order. If future scope enums add a value (per SC-1 there are exactly two scopes, but this is forward-fragile), the renderer silently drops them. Use exhaustiveness:
```ts
const SCOPES_IN_ORDER: readonly ("user" | "project")[] = ["user", "project"];
// ... then runtime assert that byScope's keys are a subset of SCOPES_IN_ORDER
```

**Fix:** Acceptable as-is given SC-1 lock; flag for revisit if SC-1 ever loosens.

### IN-04: `add.ts` mutates `state.marketplaces[derivedName]` before validating the resulting record against `STATE_SCHEMA`

**File:** `extensions/claude-marketplace/orchestrators/marketplace/add.ts:166-175,240-249`
**Issue:** The orchestrator assembles a `MarketplaceRecord` shape by spreading known fields. There's no runtime check against `MARKETPLACE_RECORD_SCHEMA` before assignment. `saveState` (per state-io.ts) re-validates against `STATE_SCHEMA` on write, so a malformed shape would throw at save time -- but the error message would be opaque (`<root>/marketplaces/<name>: ...`). A pre-write validation in the orchestrator would surface the bad field with clearer attribution.

**Fix:** Acceptable as-is; the post-write validation in `saveState` is the single source of truth.

### IN-05: Tests use raw object literals for `source` like `{ kind: "github", raw: "owner/repo", owner: "owner", repo: "repo" }` bypassing the SP-6/ST-6 factory funnel

**File:** `tests/orchestrators/marketplace/remove.test.ts:315,392`, `tests/orchestrators/marketplace/update.test.ts:106-115`
**Issue:** Several test fixtures construct `source` objects by hand instead of using `githubSource()` or `pathSource()`. This bypasses the validation funnel (SP-6 / ST-6) and risks the test passing on a shape that the real factory would reject. Future schema changes to ParsedSource would not be caught by these tests.

**Fix:** Always use the factory functions in test fixtures:
```ts
source: githubSource("https://github.com/owner/repo"),
```

---

_Reviewed: 2026-05-10T23:22:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

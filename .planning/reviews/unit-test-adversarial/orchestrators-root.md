# Orchestrators — auth host, edge deps, plugin path, scope fanout, discover

**Scope:** `extensions/pi-claude-marketplace/orchestrators/*.ts` (top level only) and their paired tests under `tests/orchestrators/`
**Test files reviewed:** 6 (`auth-host.test.ts`, `discover.test.ts`, `edge-deps.test.ts`, `plugin-path.test.ts`, `scope-fanout.test.ts`, `types.test.ts`)
**Production modules reviewed:** 6 (`auth-host.ts`, `discover.ts`, `edge-deps.ts`, `plugin-path.ts`, `scope-fanout.ts`, `types.ts`)

## Summary

This area is in strong shape. All six production modules pair 1:1 with a test module, every `strong-mock` use carries `exactParams: true` with `verify()` at the end of the case and no `anyTimes()`/`It.isAny()`/`verifyAll()`/`resetAll()`, filesystem tests use case-owned `mkdtemp` with proper teardown, assertions compare whole objects with `deepStrictEqual` (or `deepEqual` under the strict-mode import, which is byte-identical), and `types.test.ts` is a textbook type-only module (pure `satisfies`/`@ts-expect-error`, zero runtime assertions). The specific risk called out in the assignment — a leaking module-level `authMemo` in `auth-host.ts` — does not exist: the memo is threaded as a caller-owned parameter, never module state, so there is nothing to reset between cases. No BLOCKER findings surfaced anywhere in this area. The handful of WARNINGs are minor: one test file (`discover.test.ts`) uses the non-strict-named assertion aliases instead of the sibling files' explicit `deepStrictEqual`/`strictEqual`; `plugin-path.test.ts` restores `process.env` via `try/finally` instead of `t.after()` like its neighbors; and production code has a few small documentation/parameter-count nits. A fixing pass here should prioritize (1) the `discover.ts` catch-block `as` cast, (2) aligning `plugin-path.test.ts`'s environment cleanup with the `t.after()` convention used elsewhere in this same directory, and (3) the naming consistency in `discover.test.ts` — all low-risk, mechanical changes.

## Unit test findings

### `tests/orchestrators/discover.test.ts`

- **[WARNING] Non-strict assertion names used throughout, unlike every sibling file** — `lines 94, 106-107, 148, 162-164, 177, 208, 248`
  This file imports `assert` from `"node:assert/strict"`, so `assert.deepEqual`/`assert.equal` are the *same function objects* as `assert.deepStrictEqual`/`assert.strictEqual` — behavior is already strict, so this is not a correctness bug. But every other file in this batch (`auth-host.test.ts`, `edge-deps.test.ts`, `plugin-path.test.ts`, `scope-fanout.test.ts`) consistently spells out `deepStrictEqual`/`strictEqual`, and a reader who does not know the strict-mode aliasing rule will misread this file as using the weaker comparison. Rename every `assert.deepEqual(...)` to `assert.deepStrictEqual(...)` and every `assert.equal(...)` to `assert.strictEqual(...)` in this file for consistency with the rest of the area.

### `tests/orchestrators/plugin-path.test.ts`

- **[WARNING] Environment restoration uses `try/finally` instead of `t.after()`** — `lines 176-214, 218-281, 283-331, 333-381, 383-429, 431-459, 461-489, 491-526` (every `collectBinDirs`/`recomputePluginPath` case that touches `process.env`)
  Each case snapshots `process.env` up front and restores it in a `finally` block wrapping the whole case body. This does work, but it is a different pattern from the sibling files in this same review area: `scope-fanout.test.ts` and `edge-deps.test.ts` both register cleanup with `t.after(...)` immediately after mutating shared state, which is also what the unit-testing skill's "Environment" pattern prescribes. Convert each case to snapshot the environment, call `t.after(() => restorePathEnvironment(environmentBefore))` (and fold the `rm(...)` calls into the same `t.after` registration), and drop the surrounding `try { ... } finally { ... }` wrapper. Purely a consistency/readability change — no case is currently leaking state.

### Clean files

- `tests/orchestrators/auth-host.test.ts`
- `tests/orchestrators/edge-deps.test.ts`
- `tests/orchestrators/types.test.ts`
- `tests/orchestrators/scope-fanout.test.ts`

## Production code findings

### `extensions/pi-claude-marketplace/orchestrators/discover.ts`

- **[WARNING] Unguarded `as` cast on a caught value** — `line 65`
  `collectForKind`'s catch clause does `const code = (cause as NodeJS.ErrnoException).code;` with no `instanceof` check and no comment justifying the assertion, which the style guide requires ("`as`/`!` only with an obvious or commented reason"). The blast radius is small (a non-Error thrown value would just read `.code` as `undefined` and fall into the hard-failure branch), but it is still an assertion on an `unknown`-typed catch variable with no guard. Either add a one-line comment noting that `node:fs/promises` always rejects with `NodeJS.ErrnoException`-shaped errors, or narrow it: `const code = cause instanceof Error ? (cause as NodeJS.ErrnoException).code : undefined;`.
- **[WARNING] Missing top-level documentation** — `lines 10-13, 17`
  Neither the exported `DiscoveredResources` interface nor the exported `aggregateDiscoveredResources` function carries a doc comment. Add a short `/** ... */` above each describing the scope-ordering and freeze contract that the tests pin (`aggregateDiscoveredResources keeps scope order and sorts within each resource directory` et al.), and the `AggregateResourcesDiscoverError` aggregation behavior.
- **[WARNING] `collectForKind` has 6 positional parameters, two of them out-parameters** — `lines 54-61`
  `output` and `failures` are caller-owned arrays mutated in place across two call sites per scope. This works but is harder to read than returning a small result object (`{ items, failure }`) that the caller folds in. Low priority since the function is private and fully covered by `discover.test.ts`, but worth folding into an options object if this file is touched again.

### `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts`

- **[WARNING] `classifyInstalledPluginRow` takes 5 required positional parameters** — `lines 79-85`
  Consider grouping `manifestEntry`, `marketplaceRoot`, and `locations` into a small options object; the current signature makes call sites (`lines 208-215`) hard to read without checking the declaration.
- **[WARNING] Verbose inline indexed-access type instead of the existing named type** — `line 81`
  `installed: ExtensionState["marketplaces"][string]["plugins"][string]` duplicates, via indexed access, the already-exported `PluginInstallRecord` from `persistence/state-io.ts` (imported and used directly by `tests/orchestrators/plugin-path.test.ts` and `tests/orchestrators/edge-deps.test.ts`). Use `PluginInstallRecord` directly for readability.

### `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`

- **[WARNING] Two method doc comments use imperative mood instead of third-person** — `lines 51 ("Extract the bare host...")`, `line 72 ("Build a GitAuthBundle...")`
  Google style wants a third-person verb phrase (`Extracts...`, `Builds...`). Minor; the rest of the file's comments are ID-prefixed rationale blocks that are a deliberate, repo-wide house style and are not flagged here.

### `extensions/pi-claude-marketplace/orchestrators/types.ts`

- **[WARNING] `ReinstallOutcomeBase` has no doc comment** — `lines 15-19`
  Every other interface in this file carries a rationale comment; this one, the shared base every reinstall outcome extends, has none. A one-line addition (e.g., "Fields every reinstall outcome carries regardless of partition.") would match the file's own documentation density.

### Clean files

- `extensions/pi-claude-marketplace/orchestrators/plugin-path.ts`
- `extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts`

## Not covered

- The fakes `tests/domain/device-flow-fake.ts` and `tests/platform/credential-ops-fake.ts`, imported by `auth-host.test.ts`, were not opened — they live outside the assigned file set and are presumably owned by whichever reviewer covers `tests/domain/` and `tests/platform/`.
- Did not run `node --test`, `npm run check`, or coverage tooling per the diagnostic-review constraint (read-only sweep, tree must stay untouched).

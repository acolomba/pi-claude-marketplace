# Edge — tab completions

**Scope:** `extensions/pi-claude-marketplace/edge/completions/{data,normalize,provider}.ts`,
`extensions/pi-claude-marketplace/shared/completion-cache.ts` (reviewed only insofar as
the completions modules depend on it — its own paired test,
`tests/shared/completion-cache.test.ts`, is out of scope here), paired against
`tests/edge/completions/{data,normalize,provider}.test.ts`.
**Test files reviewed:** 3 (2,009 lines)
**Production modules reviewed:** 4 (`data.ts`, `normalize.ts`, `provider.ts` in full;
`completion-cache.ts` for its interaction with the three completions modules)

## Summary

This is one of the strongest-built areas in the sweep. All three production modules pair
1:1 with a test file, every completion list is asserted with `assert.deepStrictEqual()`
against a hand-authored literal in the promised order, `assert.rejects()` calls are
awaited and check error identity, there is no `describe()` nesting, no `before()`/
`beforeEach()`, no committed `only`/`skip`/`todo`, no process-wide `mock` import, and
every case builds its own fake `LocationsResolver` plus a fresh `mkdtemp` cache root
with a network trap on `https.request` — all torn down in `t.after()`. `normalize.ts`'s
two pure exports get exactly one sibling `test()` per typed row. The one genuine defect
in the area is architectural, not a test-authoring mistake: `shared/completion-cache.ts`
holds module-scope mutable state and exports `resetCompletionCache()` purely so
`data.test.ts` and `provider.test.ts` can isolate cases from it — a textbook test-only
production hook, confirmed by grep to have zero production call sites. Both test files
already compensate correctly (reset before *and* after every case, real temp
directories, no ordering dependence found), so the fix belongs on the production side
(factory-owned cache state), not in the tests. The remaining findings are minor
documentation and duplication nits in the production files. The two branch-coverage
shortfalls the test headers document (`data.ts:188`, `provider.ts:125`) are rigorously
proven type-system-forced dead branches (brute-forced and mutation-tested) and are not
findings.

## Unit test findings

### `tests/edge/completions/data.test.ts`

- **[WARNING] Two case-sensitivity claims fused into one `test()`** — `test('matches the partial token case-sensitively, with no case folding')` (lines 390–401, `getMarketplaceCompletions`) and the twin at lines 828–843 (`getPluginRefCompletions`). Each case runs two independent act/assert pairs (the folded-case miss, then the exact-case hit) under one title. If the first assertion fails, the second never runs, so a reader (and CI) cannot tell which half broke from the test name alone. Split each into two `test()`s — `'excludes a differently-cased match'` and `'matches the exact-case token'` — following the one-behavior-per-case pattern the rest of the file already uses everywhere else (e.g. the `extractScope` and `splitCompletionInput` describes).

### `tests/edge/completions/normalize.test.ts`

### `tests/edge/completions/provider.test.ts`

### Clean files

- `tests/edge/completions/normalize.test.ts`
- `tests/edge/completions/provider.test.ts`

## Production code findings

### `extensions/pi-claude-marketplace/shared/completion-cache.ts`

- **[BLOCKER] `resetCompletionCache()` is a test-only hook over module-scope global state** — `lines 138–142` (the `memMarketplaceNames`/`memPluginIndex` module-level `Map`s) and `lines 436–439` (`export function resetCompletionCache()`). The file's own header calls this a "Test seam," and `grep -rn "resetCompletionCache" extensions/ tests/` confirms the only callers are `tests/edge/completions/data.test.ts` and `tests/edge/completions/provider.test.ts` (plus, presumably, its own `completion-cache.test.ts`) — no production code ever calls it. This is exactly the "export ... added for a test" case the unit-testing rules classify as a BLOCKER. The sanctioned fix: replace the two module-level `Map`s with factory-owned state — a `createCompletionCache()` (or similar) constructor that closes over fresh `Map`s and returns the `getMarketplaceNames`/`getPluginIndex`/`invalidate*`/`dropMarketplaceCache` functions bound to that instance, injected into callers the same way `LocationsResolver` is already injected into `data.ts`. Each test then constructs its own instance per case and `resetCompletionCache()` is deleted entirely — no reset call needed anywhere. This is a repo-wide change (the cache is also consumed by orchestrators' invalidation path per the file's header), so treat this finding as a design pointer for a follow-up pass rather than a one-file fix.
- **[WARNING] Cache-file timestamp bypasses the injected clock seam** — `lines 343, 358` (`new Date().toISOString()` inside `getPluginIndex`'s poison-row and success-row writes). The same function already takes a `now: () => number` injection for the 10-minute TTL *read* check (`GetPluginIndexOptions.now`, documented at lines 276–282 as the seam that keeps the suite off `t.mock.timers`), but the *write* path stamps `lastRefreshedAt` from the real wall clock regardless of what `now` a caller injected. A test that freezes or offsets `now` to probe TTL behavior around a rebuild would get a `lastRefreshedAt` that does not correspond to its injected clock. Route the write through the same seam: `new Date(now()).toISOString()`.
- **[WARNING] `ManifestSoftFailError` does not pass `cause` through `Error`'s options bag** — `lines 154–161`. The constructor calls `super(message)` with only a string, then assigns `this.cause = cause` directly, instead of `super(message, { cause })` as `shared/errors.ts`'s `MarketplaceUpdateError` example (cited in this repo's error-handling convention) does. Functionally the field is still readable via `.cause`, but standard `Error.cause`-aware tooling (e.g. some `console.error`/`util.inspect` "Caused by" chains) will not see it. Change the `super()` call to `super(\`Manifest load failure: ${errorMessage(cause)}\`, { cause });` and drop the manual `this.cause = cause` assignment (the `override readonly cause` field declaration can stay for the type).

### `extensions/pi-claude-marketplace/edge/completions/data.ts`

- **[WARNING] Three exports documented only implicitly, with no JSDoc of their own** — `export type PluginRefCompletionMode` (lines 112–113), `export function extractScope` (line 225), and `export interface PluginMapOptions` (lines 301–309, which has per-field doc comments but no interface-level summary). Every other file in this codebase (e.g. `orchestrators/plugin-path.ts`'s `collectBinDirs`/`recomputePluginPath`) documents each top-level export individually, per the Google-style convention this project follows ("every top-level export is documented"). Add a one-line `/** ... */` above each: what `PluginRefCompletionMode` enumerates, what `extractScope` returns when the flag is absent or its value is unrecognized, and what `PluginMapOptions` as a whole configures.

### `extensions/pi-claude-marketplace/edge/completions/normalize.ts`

- **[WARNING] Both exports rely solely on the file-header comment, with no per-function JSDoc** — `normalizeCompletionWhitespace` (line 25) and `isClaudePluginCommandLine` (line 45). The file header (lines 1–22) does document both, but that is a deviation from this repo's normal per-export documentation style (see the `data.ts` finding above for a working counter-example elsewhere in the codebase). Add a short `/** ... */` directly above each function; the header comment can stay for the shared rationale (whitespace-collapse semantics, the collision-suffix regex).
- **[WARNING] The cursor-position shape is hand-duplicated between parameter and return type** — `lines 25–29` (parameter: `{ readonly lines: readonly string[]; readonly cursorLine: number; readonly cursorCol: number }`) versus `line 29` (return: the same three fields, without `readonly`). Per the Google-style rule that a reused object shape should be named once rather than re-typed at each site, extract a shared interface (e.g. `CursorPosition`, with a `readonly` variant for input if the mutability distinction matters) so a future field addition only needs to change one declaration.

### `extensions/pi-claude-marketplace/edge/completions/provider.ts`

- **[WARNING] `PluginRefMode` duplicates `data.ts`'s `PluginRefCompletionMode`** — `lines 170–171` declare a second, independently-maintained literal union (`"install" | "uninstall" | "update" | "fetch" | "reinstall" | "info" | "enable" | "disable"`) that is structurally identical to `PluginRefCompletionMode`, already exported from `./data.ts` and already imported elsewhere in this same file's import list. `PluginRefBranchConfig.mode: PluginRefMode` values flow directly into `getPluginRefCompletions(mode, ...)` in `data.ts`, which expects `PluginRefCompletionMode` — today's structural typing hides the duplication, but a future addition to one union will not be caught by the other unless someone remembers to update both. Delete the local `type PluginRefMode = ...` declaration and `import type { PluginRefCompletionMode } from "./data.ts"` instead, renaming the two local usages (`PluginRefBranchConfig.mode`, `pluginRefBranchConfig`'s return type) to that imported type.
- **[WARNING] `getArgumentCompletions` has no JSDoc of its own** — `line 260`. This is the module's single exported entry point and the most important function in the file; it is documented only in the file header (lines 1–35). Add a short `/** ... */` directly above the function signature (a one-line summary plus what `null` versus `[]` means is enough — the header can keep the branch-by-branch detail).

### Clean files

- `extensions/pi-claude-marketplace/edge/completions/data.ts` (beyond the documentation gaps above — the pure helpers, the `LocationsResolver` injection seam, and the status-filtering logic are all cleanly designed for the tests that exercise them)

## Not covered

Per the diagnostic-review constraint, no command was run (`node --test`, `npm run check`,
etc.) — findings above are from static reading only. `shared/completion-cache.ts` was
read in full, but its own dedicated test file was intentionally not opened (owned by a
different reviewer); the two findings against it beyond the test-only-hook issue
(clock-seam bypass, `cause` handling) may already be covered in more depth by that
reviewer's pass.

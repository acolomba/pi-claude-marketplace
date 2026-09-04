# Shared — errors, path safety, atomic JSON, fs utils, classifiers

**Scope:** `extensions/pi-claude-marketplace/shared/*.ts` (excluding `notify.ts` and
`concerns/`) and their paired `tests/shared/*.test.ts` modules.
**Test files reviewed:** 16
**Production modules reviewed:** 16

## Summary

This is the cleanest area likely to turn up in this sweep. Every error class in
`errors.ts` / `errors-bridges.ts` / `path-safety.ts` is tested by class identity
*and* every structured field via `assert.deepStrictEqual`, cause chains are
walked to their depth bound and cycle guard, `atomic-json.test.ts` compares
complete written bytes with one `mkdtemp` per case, and the classifier modules
(`probe-classifiers.ts`, `git-failure-classifiers.ts`, `notify-reasons.ts`) get
exhaustive one-row-one-test tables. `path-safety.test.ts` in particular is a
strong security-boundary suite: direct-parent escape, deep escape, symlink at
first/middle/last segment, unreadable-target fallback, and ordering of the
walk are all covered with real filesystems and real symlinks, not mocks. The
one real defect is in `completion-cache.ts`: it exports a test-only
`resetCompletionCache()` over module-scope mutable `Map`s with zero production
callers, which the module's own header comment admits. Two smaller,
process-global-dependency findings sit in `session-env.ts` and `debug-log.ts`,
and `completion-cache.ts`'s `getPluginIndex` has an inconsistent clock seam
that already exists for TTL comparison but is not reused for the
`lastRefreshedAt` value it persists, which is what forces the one regex-based
(non-exact) assertion in the whole sweep. A fixing pass should prioritize the
`completion-cache.ts` factory-owned-state refactor first; the other two items
are small, self-contained parameter additions.

## Unit test findings

### `tests/shared/completion-cache.test.ts`

- **[WARNING] Loose regex assertion on `lastRefreshedAt`** — `test('rebuilds a
  cold plugin index and preserves returned row order')`, around the
  `assert.match(String(persisted.lastRefreshedAt), /^\d{4}-...\d{3}Z$/)` line.
  This is a genuine weak spot: a plausible wrong implementation that persists
  the wrong (but validly formatted) instant would still pass. It is a direct
  consequence of the production gap described below (`getPluginIndex` ignores
  its own injected `now()` for this write) rather than a test-authoring
  mistake — fix the production seam first, then replace the regex with
  `assert.strictEqual(persisted.lastRefreshedAt, new Date(clock).toISOString())`
  against the test's own injected `now`/`clock` value.
- **[WARNING] Negative-only unlink-error assertions** — `test('propagates a
  non-ENOENT marketplace names unlink error')` and `test('propagates a
  non-ENOENT plugin cache unlink error')`. Both assert `instanceof Error` and
  `code !== "ENOENT"` but never assert what the code actually is. Unlinking a
  directory path deterministically yields `EISDIR` on the Linux CI target this
  suite runs on; change the assertion to
  `assert.strictEqual((error as NodeJS.ErrnoException).code, "EISDIR")` so a
  wrong implementation that mislabels a different failure code cannot pass.
- Note: the file's final test, `'resetting the completion cache clears both
  memory maps'`, exercises `resetCompletionCache()`. Once the production
  finding below is fixed (factory-owned cache state), rewrite this case to
  construct two independent cache instances instead of calling a reset hook —
  don't just delete the coverage.

### `tests/shared/markers.test.ts`

- **[WARNING] Redundant negative assertions after an exact match** — lines
  18-19 and 31-38. Each test already pins the constant with
  `assert.strictEqual(actual, expectedPrefix)`, which fully discriminates the
  value; the following `assert.notStrictEqual` calls against a truncated /
  padded variant add no additional protection (the preceding strict-equal
  already rules them out) and read as filler. Delete the `notStrictEqual`
  lines; the `strictEqual` alone is the correct, complete assertion.

### `tests/shared/notify-context.test.ts`

- **[WARNING] No `describe()` grouping for a 4-entrypoint module** — the file
  exports and tests `notifyWithContext`, `notifyUpdateWithContext`,
  `notifyUpdateNoOpWithContext`, and `notifyReconcileAppliedWithContext` as
  flat top-level `test()` calls. Per the module's size (several exported
  entrypoints), group the cases with one `describe()` per function (mirroring
  the pattern already used in `errors.test.ts` and `fs-utils.test.ts`) for
  readability. This is cosmetic only — the mocking and assertions inside each
  case are correct.

### Clean files

- `tests/shared/errors.test.ts`
- `tests/shared/errors-bridges.test.ts`
- `tests/shared/path-safety.test.ts`
- `tests/shared/atomic-json.test.ts`
- `tests/shared/probe-classifiers.test.ts`
- `tests/shared/git-failure-classifiers.test.ts`
- `tests/shared/notify-reasons.test.ts`
- `tests/shared/session-env.test.ts`
- `tests/shared/vars.test.ts`
- `tests/shared/debug-log.test.ts`
- `tests/shared/types.test.ts`
- `tests/shared/extension-version.test.ts`
- `tests/shared/fs-utils.test.ts`

## Production code findings

### `extensions/pi-claude-marketplace/shared/completion-cache.ts`

- **[BLOCKER] Test-only reset hook over module-scope mutable state** —
  `line 436`, `export function resetCompletionCache(): void { memMarketplaceNames.clear(); memPluginIndex.clear(); }`.
  The function's own doc comment (`line 434`) states "Its only caller today is
  test setup isolating cases from each other" — a sibling reviewer confirmed
  by grep that it has zero production call sites. This is exactly the
  forbidden pattern: an export added only so tests can reset a module-global.
  The two backing `Map`s (`memMarketplaceNames` at `line 138`,
  `memPluginIndex` at `line 139`) are themselves the root cause — module-level
  mutable state that every test in the file must work around today by picking
  a unique `scope`/`marketplace` key per case instead of getting a truly fresh
  instance.
  Fix: replace the two module-level `Map`s with **factory-owned state**. Add
  something like `export function createCompletionCache(): CompletionCache`
  that constructs the two `Map`s locally and returns an object exposing
  `getMarketplaceNames`, `getPluginIndex`, `invalidateMarketplaceNames`,
  `invalidateMarketplaceCache`, and `dropMarketplaceCache` as closures over
  that instance's maps. Construct one instance at the extension's composition
  root (`index.ts`) and thread it through the edge/orchestrator call sites
  that currently import the bare functions. Delete `resetCompletionCache`
  entirely — tests get isolation for free by constructing a new
  `createCompletionCache()` per case instead of calling a reset hook.

- **[WARNING] `getPluginIndex` ignores its own injected clock for the value it
  persists** — `lines 343` and `358`,
  `lastRefreshedAt: new Date().toISOString()`. The function already computes
  `const now = options?.now ?? Date.now;` at `line 303` for the TTL freshness
  comparison, but the two places that WRITE `lastRefreshedAt` to disk bypass
  that seam and call the real wall clock directly instead. This is the
  "hidden dependency: inline `new Date()`" pattern the module otherwise avoids
  everywhere else. Fix: use `new Date(now()).toISOString()` in both places
  (`line 343` poison-row branch, `line 358` normal rebuild branch) so the
  already-injected clock governs the persisted value too. This also lets the
  companion test assert the exact persisted timestamp instead of the current
  regex match (see the test finding above).

### `extensions/pi-claude-marketplace/shared/session-env.ts`

- **[WARNING] `applySessionEnv` mutates `process.env` with no injection seam**
  — `line 58`, `Object.assign(process.env, claudeSessionEnvFor(sessionId));`.
  This is a hidden dependency on the live global environment; the module's
  sibling function `applyPathLedger` is already a fully pure, parameterized
  core (this is the file's own stated design goal — see its header comment),
  but `applySessionEnv` was not given the same treatment. Fix: add an optional
  parameter defaulting to the real global, e.g.
  `export function applySessionEnv(sessionId: string, env: NodeJS.ProcessEnv = process.env): void { Object.assign(env, claudeSessionEnvFor(sessionId)); }`.
  Production call sites are unaffected (they omit the argument); tests can
  pass a plain object literal instead of saving/mutating/restoring the real
  `process.env`.

### `extensions/pi-claude-marketplace/shared/debug-log.ts`

- **[WARNING] `hookDebugLog` reads `process.env` inside its body** —
  `line 23`, `if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1")`. Same
  hidden-dependency pattern as above: the gate is a buried global read rather
  than an explicit input. Fix: accept the same kind of optional parameter,
  e.g. `export function hookDebugLog(detail: string, tag = "hooks", env: NodeJS.ProcessEnv = process.env): void`,
  and check `env.PI_CLAUDE_MARKETPLACE_DEBUG === "1"`. Production call sites
  stay unchanged; tests can pass `{ PI_CLAUDE_MARKETPLACE_DEBUG: "1" }` instead
  of mutating and restoring the real `process.env`.

### Clean files

- `extensions/pi-claude-marketplace/shared/atomic-json.ts`
- `extensions/pi-claude-marketplace/shared/errors.ts`
- `extensions/pi-claude-marketplace/shared/errors-bridges.ts`
- `extensions/pi-claude-marketplace/shared/path-safety.ts`
- `extensions/pi-claude-marketplace/shared/fs-utils.ts`
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts`
- `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts`
- `extensions/pi-claude-marketplace/shared/notify-context.ts`
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts`
- `extensions/pi-claude-marketplace/shared/markers.ts`
- `extensions/pi-claude-marketplace/shared/types.ts`
- `extensions/pi-claude-marketplace/shared/extension-version.ts`
- `extensions/pi-claude-marketplace/shared/vars.ts`

## Not covered

- `tests/shared/notify.test.ts` and `extensions/pi-claude-marketplace/shared/notify.ts`
  — explicitly out of scope (owned by another reviewer).
- `tests/shared/concerns/**` and `extensions/pi-claude-marketplace/shared/concerns/*.ts`
  — explicitly out of scope per the assignment.
- No toolchain commands were run (`npm run check`, `node --test`, coverage) per
  the diagnostic-review constraint; all findings above come from static
  reading of the full text of every listed file.

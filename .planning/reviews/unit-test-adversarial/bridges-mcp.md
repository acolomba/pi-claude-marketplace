# Bridges — MCP

**Scope:** `extensions/pi-claude-marketplace/bridges/mcp/` and `tests/bridges/mcp/`
**Test files reviewed:** 9
**Production modules reviewed:** 9

## Summary

This is one of the stronger areas of the suite: real `mkdtemp` filesystem
fixtures per case, hand-written expected values (including exact byte-for-byte
JSON output and `ino`/`mtimeNs` checks to prove quiet-on-noop), no doubles
misuse (the bridge has no injectable ports to mock), no `only`/`skip`, no
placeholder names, correct `describe()`-per-export-count discipline, and the
`substitute.test.ts` file specifically avoids the "compute the expected value
by re-running the substituter" trap the assignment called out. Pairing is
exactly 1:1 in both directions across all 9 files.

Two real problems anchor the fixing pass. First, `stage.ts`'s `getMcpServers`
and the parallel check in `unstage.ts` do not guard against a scoped
`mcp.json` whose `mcpServers` field is JSON `null` (crashes with an uncaught
`TypeError`) or a bare string (silently corrupts the document by exploding it
into a per-character object) — a real behavioral bug, not just a test gap,
and it contradicts both modules' own "malformed -> tolerant" doc comments.
Second, `stage.test.ts` exercises the `sourcePath` fallback branch
(`input.sourcePath ?? "${plugin}#mcpServers"`) in five different tests but
never once asserts `result.recorded`/`stagedNames` in any of them, so that
branch's actual output is completely unverified. A fixing pass should: (1)
patch the two null/string guards, (2) add the missing negative-shape test
cases these guards need, and (3) add the missing `recorded`/`stagedNames`
assertions to the tests that already exercise the fallback path.

## Unit test findings

### `tests/bridges/mcp/stage.test.ts`

- **[BLOCKER] `sourcePath` fallback branch executed but never asserted** —
  `test('normalizes malformed server values with complete ordered warnings')`
  (line 237), `test('treats a non-object stored document as malformed')`
  (line 296), `test('treats an array server map as empty while preserving
  top-level fields')` (line 203), `test('reports malformed stored JSON
  before replacing it')` (line 167), `test('omits project substitution and
  injection in a user scope')` (line 473). All five call
  `prepareStageMcpServers` with new server names and **no** `sourcePath`
  input field, which forces production line 276
  (`const sourcePath = input.sourcePath ?? \`${pluginName}#mcpServers\`;`)
  down its fallback arm. None of the five assert `prepared.result.recorded`
  or `prepared.result.stagedNames` — only `.warnings`/`._nextDoc` are
  checked. Only the two tests that DO pass `recorded`/`stagedNames`
  assertions (`'replaces owned servers...'` line 67, `'writes exact scoped
  bytes...'` line 525) also pass an explicit `sourcePath`, so the fallback
  template string is executed by 5 tests and verified by 0. A broken or
  deleted fallback (wrong separator, wrong field name, thrown exception)
  would pass this entire file. Fix: add
  `assert.deepStrictEqual(prepared.result.recorded, [{ generatedName: ...,
  sourcePath: "<pluginName>#mcpServers", targetPath: locations.mcpJsonPath
  }])` to at least one of these tests (recommend `'normalizes malformed
  server values...'`, which already has a non-trivial `newNames` list).
- **[BLOCKER] No case for a scoped `mcpServers` field that is `null` or a
  bare string** — the `describe('prepareStageMcpServers')` block (lines
  40–522) tests `mcpServers: []` (line 207, "treats an array server map as
  empty") but has no case for `{"mcpServers": null}` or
  `{"mcpServers": "some-string"}`. Per the production finding below, the
  first crashes `prepareStageMcpServers` with an uncaught `TypeError` and
  the second silently corrupts the document (turns the string into a
  per-character object). Add two cases mirroring the existing array case,
  written against the corrected implementation: assert the document is
  preserved and no crash occurs (matching the `readScopedDoc`
  malformed-document contract), not against the current buggy behavior.

### `tests/bridges/mcp/unstage.test.ts`

- **[BLOCKER] No case for a scoped `mcpServers` field that is `null`** —
  the data-table at lines 314–332 covers "a document without mcpServers"
  (`undefined`), "an array-valued mcpServers field", "a string-valued
  mcpServers field", and "a document with no matching owner", but omits
  `{"mcpServers": null, ...}`. Per the production finding below this value
  currently crashes `unstageMcpServers` with an uncaught `TypeError`
  (`Object.entries(null)`), so a case is missing for a plausible, JSON-valid
  document shape. Note the existing "a string-valued mcpServers field" row
  (line 325) passes today only by an accident of `Object.entries("foreign")`
  enumerating characters that can never satisfy `isOwnedBy` — it does not
  prove the field is validated, so don't treat its presence as covering the
  `null` case too. Add a dedicated row/case once the production guard is
  fixed, asserting a clean noop with the document preserved byte-for-byte
  (same pattern as the sibling rows).
- **[WARNING] Helper lacks a return-type annotation** — `line 10`
  (`async function createScope(t: TestContext, prefix: string) {`). Every
  sibling helper in this suite annotates its return type
  (`allocateCollisionPaths` in collision-slots.test.ts:
  `Promise<CollisionPaths>`; `createProjectScope` in stage.test.ts:
  `Promise<{ cwd: string; locations: ReturnType<typeof locationsFor> }>`;
  `createPluginRoot` in parse.test.ts: `Promise<string>`). Add
  `: Promise<{ cwd: string; locations: ReturnType<typeof locationsFor> }>`
  to match.
- **[WARNING] Default import of `test` instead of the named import used
  everywhere else** — `line 5`
  (`import test, { type TestContext } from "node:test";`). Every other file
  in this suite uses `import { describe, test } from "node:test";` (or just
  `{ test }` when no `describe` is needed, as in `safe-set.test.ts`). Change
  to `import { test, type TestContext } from "node:test";` for consistency;
  `node:test` exposes `test` as a named export so there is no need for the
  default form.

### `tests/bridges/mcp/collision-slots.test.ts`

- **[WARNING] Weaker error assertion than every sibling case in the same
  file** — `test('propagates an unreadable collision document')`, lines
  333–338: `await assert.rejects(ownerLoad, { code: "EISDIR" });`. Every
  other error-path case in this file (and in `parse.test.ts`/`stage.test.ts`)
  checks the full shape — `instanceof Error` plus `name`/`code`/`syscall` —
  via a validator callback or a `deepStrictEqual` on a projected object. This
  one checks only `.code` and never asserts `instanceof Error`. Bring it in
  line with the sibling pattern:
  ```ts
  await assert.rejects(ownerLoad, (error: unknown) => {
    assert.ok(error instanceof Error);
    const filesystemError = error as NodeJS.ErrnoException;
    assert.deepStrictEqual(
      { name: filesystemError.name, code: filesystemError.code, syscall: filesystemError.syscall },
      { name: "Error", code: "EISDIR", syscall: "read" },
    );
    return true;
  });
  ```

### Clean files

- `tests/bridges/mcp/index.test.ts`
- `tests/bridges/mcp/types.test.ts`
- `tests/bridges/mcp/safe-set.test.ts`
- `tests/bridges/mcp/marker.test.ts`
- `tests/bridges/mcp/parse.test.ts`
- `tests/bridges/mcp/substitute.test.ts`

## Production code findings

### `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`

- **[BLOCKER] `getMcpServers` does not guard against `null` or a
  non-object-non-array `mcpServers` value** — `lines 92–100`:
  ```ts
  function getMcpServers(doc: RawMcpDoc): Record<string, unknown> {
    const m = doc.mcpServers;
    if (m === undefined || Array.isArray(m)) {
      return {};
    }
    return m;
  }
  ```
  The function's own doc comment (line 92, "Missing/malformed -> {}") and
  `readScopedDoc`'s header ("a malformed scoped doc cannot poison the
  ours/theirs partition") promise tolerance of malformed input, but the
  check only excludes `undefined` and arrays. Two concrete failure modes,
  confirmed by tracing the call chain into `partitionExistingServers`
  (lines 102–121) and verifying `Object.entries()` semantics directly:
  - `{"mcpServers": null}` — `m` is `null`, passes the guard untouched, and
    `Object.entries(null)` inside `partitionExistingServers` throws
    `TypeError: Cannot convert undefined or null to object`. This is an
    uncaught, unhandled crash for a JSON document that is entirely valid
    JSON.
  - `{"mcpServers": "some-string"}` — `m` is the string, passes the guard,
    and `Object.entries("some-string")` (which does NOT throw) enumerates
    it character-by-character (`[["0","s"],["1","o"],...]`). None of those
    single-character values satisfy `isOwnedBy` (a primitive is never
    "owned"), so every character lands in `theirs` via `safeSet` and is
    then merged back into the committed document — silently replacing the
    original string with `{"0":"s","1":"o","2":"m",...}` on the next
    install/reinstall of any plugin in that scope. No warning is emitted;
    this is silent data corruption of the user's `mcp.json`.
  Compare with `collision-slots.ts`'s `extractServers` (line 91–108) in the
  same directory, which correctly guards the analogous case with
  `typeof inner === "object" && inner !== null && !Array.isArray(inner)`.
  Fix: change the guard to
  `if (typeof m !== "object" || m === null || Array.isArray(m)) { return {}; }`.
- **[WARNING] Three exported functions have no doc comment** — `line 327`
  (`export async function replacePreparedMcp`), `line 343`
  (`export async function rollbackMcpReplacement`), `line 370`
  (`export function finalizeMcpReplacement`). `prepareStageMcpServers`,
  `commitPreparedMcp`, and `abortPreparedMcp` each have a JSDoc block
  directly above them describing their contract; these three (introduced
  for the reinstall-replacement flow) do not, and their behavior — especially
  the opaque `McpReplacement` handle and the `mcpReplacementInternals`
  `WeakMap` backing it — is not obvious from the name alone. Add a
  `/** ... */` block above each stating what it does and (for
  `rollbackMcpReplacement`) what a non-empty return value means.

### `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts`

- **[BLOCKER] Missing `mcpServers: null` guard crashes `unstageMcpServers`**
  — `lines 71–78`:
  ```ts
  const existingValue = doc.mcpServers;
  if (existingValue === undefined || Array.isArray(existingValue)) {
    return EMPTY_RESULT;
  }
  const existing = existingValue;
  ```
  Same defect class as `stage.ts`'s `getMcpServers` above, and it is the
  version that matters most here because unstage runs during uninstall: a
  scoped `mcp.json` containing `{"mcpServers": null}` reaches
  `Object.entries(existing)` at line 82 with `existing === null`, throwing
  `TypeError: Cannot convert undefined or null to object` instead of the
  documented MC-7 "missing/non-object `mcpServers` -> noop" tolerance
  (module header, lines 11–12). Fix:
  `if (typeof existingValue !== "object" || existingValue === null || Array.isArray(existingValue)) { return EMPTY_RESULT; }`.

### `extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts`

- **[WARNING] `MCP_COLLISION_SLOTS` reads two live boundaries inline
  instead of taking them as parameters** — `lines 31–38`: `homedir()` (node:os)
  and `getAgentDir()` are called directly inside the function body,
  alongside the one parameter (`cwd`) that already is injected. This is the
  same shape of hidden dependency the testability checklist calls out for
  `Date.now()`/`randomUUID()` — a live, environment-dependent read embedded
  in logic rather than passed in. The test suite already works around it
  correctly via the sanctioned "mutate `process.env`, save/restore in
  `t.after()`" pattern (`collision-slots.test.ts`, every case), so this is
  not causing flakiness today, but it means the function's real inputs
  (home directory, agent directory) are invisible from its signature. Fix:
  make `homeDir`/`agentDir` explicit parameters of `MCP_COLLISION_SLOTS` and
  `loadEffectiveServerNames`, and wire `homedir()`/`getAgentDir()` in at the
  one call site that composes this bridge with the live Pi environment
  (per the "no parameter defaults to a live boundary" rule, do not default
  the new parameters to the live calls either).

### Clean files

- `extensions/pi-claude-marketplace/bridges/mcp/index.ts`
- `extensions/pi-claude-marketplace/bridges/mcp/types.ts`
- `extensions/pi-claude-marketplace/bridges/mcp/marker.ts`
- `extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts`
- `extensions/pi-claude-marketplace/bridges/mcp/parse.ts`
- `extensions/pi-claude-marketplace/bridges/mcp/substitute.ts`

## Not covered

No `npm run check`/`test`/lint commands were run, per the diagnostic-review
restriction. The `Object.entries(null)` / `Object.entries("foreign")`
behavior cited above was confirmed with a standalone `node -e` sanity check
(no repository files touched, no test runner invoked) rather than by
executing the project's suite.

---
phase: 04-variable-expansion-at-claude-code-parity
reviewed: 2026-10-07T21:53:07Z
depth: standard
iteration: 3
files_reviewed: 63
files_reviewed_list:
  - .github/workflows/ci.yml
  - README.es.md
  - README.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/domain/claude-credential-denylist.ts
  - extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts
  - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/session-env.ts
  - package.json
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-info.ts
  - tests/architecture/integration-materialization-gate.test.ts
  - tests/architecture/mcp-config-notices.test.ts
  - tests/architecture/peer-floor.test.ts
  - tests/bridges/mcp/adapter-entry.test.ts
  - tests/bridges/mcp/adapter-escape.test.ts
  - tests/bridges/mcp/expansion-cases.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/bridges/mcp/substitute.test.ts
  - tests/domain/claude-credential-denylist.test.ts
  - tests/domain/claude-mcp-variables.test.ts
  - tests/domain/mcp-server-features.test.ts
  - tests/domain/plugin-resolver.test.ts
  - tests/index.test.ts
  - tests/integration/adapter-expansion-conformance.test.ts
  - tests/integration/mcp-home-path-partial.test.ts
  - tests/integration/mcp-override-lifecycle.test.ts
  - tests/integration/mcp-plugin-seed.ts
  - tests/integration/mcp-variable-expansion.test.ts
  - tests/integration/optional-peer.ts
  - tests/integration/pi-mcp-adapter-peer.ts
  - tests/integration/pi-subagents-peer.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/orchestrators/plugin/install-disable-cascade.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/session-env.test.ts
findings:
  critical: 0
  warning: 0
  info: 8
  total: 8
status: issues_found
---

# Phase 4: Code Review Report (iteration 3)

**Reviewed:** 2026-10-07T21:53:07Z
**Depth:** standard
**Files Reviewed:** 63
**Status:** issues_found (Info only)

## Summary

This re-review covers fix commit `77625e0f` (WR-07). The commit changes `adapter-escape.ts`, `adapter-escape.test.ts`, `expansion-cases.ts`, `adapter-expansion-conformance.test.ts` and `docs/mcp-compatibility.md`. No other file in scope changed after iteration 2.

How I checked the WR-07 fix:

- I re-read pi-mcp-adapter 5.1.0 `utils.ts` (`interpolateEnvVars`: `\$\{(\w+)\}`, then `\$env:(\w+)`, then `\{env:(\w+)\}`, each one global `replace`; `getMissingEnvVars`; `resolveServerUrl`) and its call sites (`server-manager.ts:1155-1160` for `command`/`args`, `metadata-cache.ts:119-128` for `env`/`url`/`headers`, `mcp-auth-flow.ts` for `oauth.*`). Every field the extension writes goes through the same three passes.
- I derived the follow condition from first principles. After a kept reference, the text that can continue a marker begun at the end of its value is the rest of `$env:NAME` or `{env:NAME}`. That rest starts with `e`/`n`/`v` (inside `env:`), with a name character (inside `NAME`), with `:` followed by a name character, or with `}`. `/^(?:[\w}]|:\w)/` is exactly that set. A lone `:` followed by end of field or by another reference cannot complete a marker from plugin text alone. JS `\w` without the `u` flag is ASCII, which matches the adapter's regex. The guard never lands at index 0, so it cannot interfere with the `!` doubling or the leading-`~` check.
- I traced the token through each pass for the tails `$`, `$env`, `$env:`, `{env:` and `{env:K`. Pass 1 never re-reads the value it inserts. A `$` or `{env:` from the value directly before `{env:PI_CLAUDE_MARKETPLACE_EMPTY}` matches neither pass 2 nor pass 3. Pass 3 removes the token and does not re-read its own output.
- I ran the conformance test against the real adapter (`PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter`): 197/197 pass, 0 skipped, including the new 12,210-check property and the 120 credential runs. The MCP bridge, domain and integration suites pass too (473/473). Direct coverage of `adapter-escape.ts` from its paired test is 100% for lines, branches and functions.
- I ran a wider scratchpad probe through the real `serializeSegments`, `expandClaudeValue` and the adapter's `dist/utils.js`. It used plugin text up to 4 tokens long from a 19-token alphabet (`env:`, `nv:`, `v:`, `:`, `K`, `P`, `}`, `$`, `{`, `/`, `-`, `.`, `_`, `0`, `é`, `{env:`, `$env:`, `:-`, space), 6 prefixes, 13 value tails and 9 values for a second variable. With one reference: 96,565,014 checks, 0 mismatches against Claude's output. With two references and a plugin-named variable `P`: 6,825,546 checks, 0 cases where the adapter output the value of `P` and Claude did not. The remaining two-reference mismatches all form the marker name from the users' own runtime values, which the new divergence bullet documents.

The condition is not too narrow, because the single-reference sweep finds no leak. It is also not wrongly broad: each alternative is needed (`}` for a value ending `{env:K`, `:\w` for `$env`, `\w` for `$` … `{env:`), and the token expands to `""`, so the output does not change. The cost is the definition-hash change (D-04-04), which the operator accepted. IN-08 below records one more cost. The docs bullet matches the code, with one wording issue (IN-09). T-04-28 in `04-SECURITY.md` records the fix.

Status of the iteration-2 findings:

| ID | Status | Notes |
| --- | --- | --- |
| WR-07 | Fixed | See above. `${PSX}env:ANTHROPIC_API_KEY` with `PSX=abc$` now outputs `abc$env:ANTHROPIC_API_KEY` through the real `resolveCommandSecret`. |
| IN-01, IN-02, IN-04, IN-05, IN-06 | Open (out of fix scope) | `77625e0f` does not touch them. Their line references are still correct. |

`77625e0f` brings no Critical or Warning regressions. It makes one earlier rationale stale (IN-07) and widens one documented load-order case (IN-08).

## Structural Findings (fallow)

No structural pre-pass was provided for this iteration. The four duplicate groups listed in iteration 1 come from before this phase, and no fix commit touches them.

## Narrative Findings (AI reviewer)

## Info

### IN-01: The CI conformance install has no lockfile, so the adapter's transitive dependencies float

**File:** `.github/workflows/ci.yml:121`
**Issue:** Unchanged from iteration 1. `npm install --prefix "$RUNNER_TEMP/pi-mcp-adapter" pi-mcp-adapter@5.1.0 --ignore-scripts --omit=peer` pins only the top-level package. The adapter's runtime dependency graph, which the test loads through `dist/mcp-auth-flow.js`, resolves fresh on each run.
**Fix:** Commit a small `package.json` and `package-lock.json` pin for the adapter and run `npm ci --ignore-scripts --prefix` against it.

### IN-02: Staging reads `process.env` implicitly, so orchestrator tests have to mutate global state

**File:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:380`; `tests/orchestrators/reconcile/apply.test.ts`; `tests/orchestrators/import/execute.test.ts`
**Issue:** Unchanged. `env: input.env ?? process.env` is the only source of the environment on every staging path. The WR-03 tests depend on `PI_CM_UNSET_IN_EVERY_ENV` being absent from the real process environment for the same reason.
**Fix:** Thread a `ClaudeEnv` through the install-ledger context, as `createGetPluginInfo(reader, env)` already does.

### IN-04: The `scanClaudeServerVariables` remote set includes `streamable-http`, which Claude's `uLo` does not expand

**File:** `extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts:230`
**Issue:** Unchanged. `REMOTE_TYPES` holds `"streamable-http"`, but Claude's `uLo` expands `url`/`headers` only for `sse`, `http` and `ws`. The resolver makes such a server unavailable today, so this has no effect yet.
**Fix:** Use `["sse", "http"]`, or add a comment that names the deferred `streamable-http` decision.

### IN-05: `SCAN_BUILTINS` replaces builtins with `""`, which can join text into a variable that the real expansion would not see

**File:** `extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts:228`
**Issue:** Unchanged. `$${CLAUDE_PLUGIN_ROOT}{FOO}` is scanned as `${FOO}`, so `info` lists `FOO` as unset. With the real path, the text is `$/plugins/x{FOO}`, which has no reference.
**Fix:** Use a non-empty placeholder that cannot form a trigger, such as `"/"`.

### IN-06: A cwd read that throws still leaves a stale or inherited `CLAUDE_PROJECT_DIR` in place

**File:** `extensions/pi-claude-marketplace/shared/session-env.ts:101`, `:111-113`; pinned by `tests/index.test.ts` (NFR-2 case expects `"/work/previous"`) and `tests/shared/session-env.test.ts` ("sets the reserved empty variable before a cwd read that throws")
**Issue:** Unchanged. When `readCwd` throws, `applyMcpAdapterEnv` rethrows before it touches `CLAUDE_PROJECT_DIR`. At load, this keeps a value that Pi inherited from a parent. At `session_start`, it keeps the previous session's project. This is the wrong-project case that WR-05 fixed, on a rarer trigger.
**Fix:** Clear the variable when the read throws, then rethrow:
```ts
let cwd: string;
try {
  cwd = readCwd();
} catch (err) {
  Reflect.deleteProperty(process.env, "CLAUDE_PROJECT_DIR");
  throw err;
}
```
Update both tests so they expect `undefined`.

### IN-07: The cwd partial-tail skip now gives the wrong reason for its divergence

**File:** `extensions/pi-claude-marketplace/shared/session-env.ts:88-90`, `:103-108`; `docs/mcp-compatibility.md:196`
**Issue:** The comment on `PARTIAL_MARKER_TAIL` ("A tail that the entry text after a kept `${CLAUDE_PROJECT_DIR}` can complete into a marker"), the JSDoc ("plugin text after the reference can complete such a tail into a reference to a withheld credential"), and the docs sentence ("The plugin text after `${CLAUDE_PROJECT_DIR}` can complete such an ending …") all say the skip is needed for entry text. After `77625e0f`, that is false for every entry this version writes: `serializeSegments` splits text after any kept reference, `${CLAUDE_PROJECT_DIR}` included. My single-reference sweep covers every one of the eight tails. The skip still has one real use. Entries written by releases before this phase keep a user-scope `${CLAUDE_PROJECT_DIR}` unescaped (the old `substitute.ts` passed unknown references through). The fix report says only that the guard "stays because it is still correct and still pinned". As the text reads now, a project directory that ends in `$`, `{` or `$en` loses `CLAUDE_PROJECT_DIR` (a parity loss), and the stated reason no longer holds for new entries.
**Fix:** Keep the skip and give the real reason. In the code, say that it protects entries written before AVAR-03 began to escape text after a reference, until a reinstall or update rewrites them. In the docs, say the same, or drop the partial-tail sentence and keep only the `$env:` / `{env:` case. A user value that holds a full marker is still a real case.

### IN-08: A user-scope `${HOST}:port` URL can now fail once at load

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts:31`, `:75`; `docs/mcp-compatibility.md:186`, `:243`
**Issue:** `https://${HOST}:8080/mcp` is now written as `https://${HOST}{env:PI_CLAUDE_MARKETPLACE_EMPTY}:8080/mcp`. The adapter's `resolveServerUrl` throws on any variable that `getMissingEnvVars` reports as unset. So the AR-04-04 load-order case (pi-mcp-adapter loads first, and a user override makes a user-scope server `eager` or `keep-alive`) now reaches a common URL form. Before, it reached only URLs with unusual literal text. The server reconnects at the adapter's `session_start`, and line 243 combined with line 186 does describe the result. A user would only see it by reading both bullets together.
**Fix:** No code change is needed. Add a sentence to the line-243 bullet, such as "This includes a `url` such as `https://${HOST}:8080`, which gets a split token after the reference". Note the wider reach in AR-04-04.

### IN-09: The docs wording reads as if `:}` gets the token

**File:** `docs/mcp-compatibility.md:186`
**Issue:** "starts with a letter, a digit, `_`, `}`, or a `:` before one of these name characters" lists `}` among "these", but the code (`/^(?:[\w}]|:\w)/`) guards `:` only before a letter, digit or `_`. `${A}:}` gets no token. The text should also say "an ASCII letter", because the adapter's `\w` matches no other letter (`${A}é` gets no token, and it needs none).
**Fix:** "… starts with an ASCII letter, a digit, `_` or `}`, or with a `:` before an ASCII letter, a digit or `_`."

---

_Reviewed: 2026-10-07T21:53:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

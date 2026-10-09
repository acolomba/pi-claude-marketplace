---
phase: 06-live-mcp-status-in-info
reviewed: 2026-10-09T00:00:00Z
depth: standard
iteration: 1
files_reviewed: 35
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/types.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/platform/mcp-status.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-info.ts
  - tests/architecture/cross-op-convergence.test.ts
  - tests/architecture/manifest-read-agreement.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/e2e/_helpers.ts
  - tests/e2e/import-command.test.ts
  - tests/edge/handlers/plugin/info.test.ts
  - tests/edge/register.test.ts
  - tests/edge/types.test.ts
  - tests/index.test.ts
  - tests/integration/mcp-migration.test.ts
  - tests/integration/mcp-status-conformance.test.ts
  - tests/integration/pi-mcp-adapter-peer.ts
  - tests/integration/standalone-prune.test.ts
  - tests/live-uat/manifest-absence-canary.mjs
  - tests/live-uat/stop-canary.mjs
  - tests/orchestrators/plugin/info-mcp-status.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/operations.test.ts
  - tests/platform/mcp-status-seed.ts
  - tests/platform/mcp-status.test.ts
  - tests/shared/notification-grammar.test.ts
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-09
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Structural Findings (fallow)

Provided by the orchestrator: `fallow audit` against each plan base (ec66f204,
54e83331, b6ef889a) gave verdict `pass`, with no issues in the changed files and
3 inherited clone groups only. A full `npm run check` (fallow dead-code, health
and dupes included) was green on 03c50f3a.

## Narrative Findings (AI reviewer)

## Summary

The review covered the status tracker (`platform/mcp-status.ts`), the stamping
module (`orchestrators/plugin/info-mcp-status.ts`), the info wiring
(`info.ts`, the edge handler, `register.ts`, `index.ts`), the renderer change,
the catalog, and the tests. The join logic, the override rule, the
`--scope user` project read (`persistMigration: false` inside a try/catch), and
the renderer ordering match the D-06-xx decisions and the catalog text. The
decisions the operator accepted (wording, position, `status unknown` as the
normal state in a deferred session, the override token, info severity) are not
reported.

The security-audit lead is **confirmed**. A reproduction with the real modules
is described in WR-01. It is a Warning, not a Blocker. The actor is another
extension in the same process, and that extension can already run any code, so
no privilege boundary is crossed. But the module promises to handle hostile
payloads, and this input breaks that promise and the closed-token contract.

I also checked these paths and found no defect in the new code:

- A plugin from a different marketplace with the same adapter key cannot be
  installed (the install collision check refuses it), and AR-06-02 accepts the
  hand-edited case.
- A disabled project record does not override.
- An unreadable project `state.json` does not override.
- A left-out (`unsupported`) server gets no state.
- Pi's event bus (`dist/core/event-bus.js`) passes the payload object by
  reference with no clone, which is why WR-01 can be reached.

## Warnings

### WR-01: A snapshot field read twice lets a payload pass the check and then put a non-string into the closed status set

**File:** `extensions/pi-claude-marketplace/platform/mcp-status.ts:74-80, 98-109`; `extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts:46-56`

**Issue:** `readSnapshot` runs `MCP_STATUS_SNAPSHOT_VALIDATOR.Check(payload)`,
which reads each `server.name` and `server.status` once. Then
`payload.servers.map((server) => [server.name, server.status])` reads them
again. Pi's bus hands every subscriber the emitter's own object (no
`structuredClone`). So a payload with accessor properties (or a Proxy) can
return strings during the check and return something else on the second read.
The `Map` then holds a value that is not a string, and the code past that point
assumes it is one:

- `lookup` calls `Object.hasOwn(RUNTIME_STATUSES, status)`. This converts the
  object to a property key through its `toString`, and the object is then
  returned typed as `McpServerRuntimeStatus`.
- `statusToken` indexes `RUNTIME_STATUS_TOKENS[answer]`, which calls
  `toString` again. If the second call returns `"constructor"`, the lookup
  resolves to the inherited `Object` function.
- If `toString` throws, `lookup` throws inside `withMcpServerStatus`. Nothing
  in `getPluginInfoWithReader`, `withParsedArgs` or `routeClaudePlugin` catches
  it, so the whole `/claude:plugin info` call fails and prints no block.

**Reproduced** with the real modules (scratch script; source unchanged):

```ts
let reads = 0, n = 0;
const evil = { toString() { n++; return n % 2 === 1 ? "connected" : "constructor"; } };
handler({ version: 1, servers: [{ name: generatedMcpServerKey("p", "srv"),
  get status() { reads++; return reads === 1 ? "connected" : evil; } }] });
withMcpServerStatus(installedBlockWith("plugin:p:srv"), { resources: { mcpServers: ["srv"] } }, tracker, undefined)
// -> entry.status is typeof "function"; `${status}` === "function Object() { [native code] }"
```

The renderer interpolates `entry.status`, so the `mcp:` line would read
`plugin:p:srv (function Object() { [native code] })`. This text is not in the
`McpServerStatus` closed set. With `toString() { throw ... }` instead,
`lookup` throws `boom` out of `withMcpServerStatus`.

These broken contracts exist in the code:

- The module comment at `mcp-status.ts:93` says that a hostile payload "reads
  as no usable snapshot". This one does not.
- `McpServerStatus` is a closed literal union, and this input puts a function
  into it.
- `tests/platform/mcp-status.test.ts:235` covers only a getter that throws. It
  does not cover a getter whose value changes between reads.

**Fix:** Read each field exactly once into a primitive, check that copy, and
store only the copy. For example, in `readSnapshot`:

```ts
function readSnapshot(payload: unknown): ReadonlyMap<string, string> | undefined {
  if (!MCP_STATUS_SNAPSHOT_VALIDATOR.Check(payload) || payload.servers.length === 0) {
    return undefined;
  }

  const statuses = new Map<string, string>();
  for (const server of payload.servers) {
    const { name, status } = server; // one read each
    if (typeof name !== "string" || typeof status !== "string") {
      return undefined;
    }

    statuses.set(name, status);
  }

  return statuses;
}
```

You can also run `structuredClone(payload)` before the check. It reads each
accessor once, and it throws `DataCloneError` on functions and Proxies. The
existing `catch` already turns that error into `undefined`. Add a
`mcp-status.test.ts` case with a getter whose value changes between reads and
check that the answer is `"no-snapshot"` (or the first string), never a
non-string.

---

_Reviewed: 2026-10-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

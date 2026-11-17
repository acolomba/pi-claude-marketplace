---
phase: 09-adapter-entries-and-mcp-features
iteration: 3
reviewed: 2026-11-15T01:10:00Z
depth: deep
files_reviewed: 26
files_reviewed_list:
  - CHANGELOG.md
  - docs/json-output.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-mcp.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - features/mcp-server/lifecycle.feature
  - schema/claude-plugin.schema.json
  - test/architecture/mcp-config-notices.test.ts
  - test/bridges/mcp/adapter-doc.test.ts
  - test/bridges/mcp/adapter-entry.test.ts
  - test/bridges/mcp/marker.test.ts
  - test/bridges/mcp/stage.test.ts
  - test/bridges/mcp/unstage.test.ts
  - test/shared/notification-mcp.test.ts
  - test/shared/notification-json.test.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
  necessity: 0
status: issues_found
---

# Phase 9: Code Review Report (iteration 3)

**Reviewed:** 2026-11-15T01:10:00Z
**Depth:** deep
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Scope: the iteration-2 fix commits `8e2644da..0166bb56` in the `features/gaps-mcp` worktree, excluding `.planning/`. I read the iteration-2 review and the "Iteration 2" section of `09-REVIEW-FIX.md`. I compared each fix against pi-mcp-adapter 7.0.1 under `node_modules/.cache/optional-peers/` (`utils.ts` `resolveServerUrl`, `getMissingEnvVars` and `interpolateEnvVars`; `http-ca.ts`; `lifecycle.ts`; `init.ts`; `index.ts`). I traced the stage environment from its entry points to `stampServers`, and the marker refusal through stage, unstage, the AMIG-01 load move and the update failure row. The evidence is a scratch probe of `stampServers` (pure function, hermetic `HOME` and `PI_CODING_AGENT_DIR` under the session scratchpad), plus these targeted owner tests, which all pass: `adapter-entry`, `adapter-doc`, `marker`, `stage`, `unstage`, `notification-{mcp,json,resolve}`, `errors-bridges`, `marketplace/shared`, `mcp-config-notices`, `wire-schema` and `json-output-docs`. I did not run `npm run check`.

Verified as fixed:

- **CR2-01 / WR2-01.** `resolvedUrl` matches `resolveServerUrl`. It uses the same reference regex, runs the missing-variable scan on the original text, and makes the three passes in the same order, with `${NAME:-x}` falling back only for an unset variable. The probe keeps the `caFile` for `https://a.example/mcp` → `https://A.example:443/x`, and for a literal `$env:` that the split token escapes. The stage environment is Pi's `process.env` at every entry point: commands, the `apply` that autoapply runs at load, the AMIG-01 move, and the background autoupdate (`index.ts:303`, `mcp-migration.ts` `env = process.env`). `applyMcpAdapterEnv` runs at extension load and at `session_start`, before `resources_discover`. So the stage reads the environment that the adapter reads when it connects. `adapterValue` returns `""` for the split token's variable, as Pi's process does. Nothing leaks: the resolved url is used only for `.protocol` and `.origin`, and is never stored, logged, put in a notice or written to the marker. The notice carries a closed `reason` and no url or variable name. `URL.parse` makes no network call, so NFR-5 holds.
- **CR2-02.** `leavingChoice` (`adapter-doc.ts:534-544`) is the only writer of the D-08-02 store. Both of its callers, the unstage write-back and the stage's capture of a dropped server, now leave `caFile` out.
- **WR2-02.** `restoredOverride` has no `caFile` special case. A field missing from the live entry is left out, as for every other carried field.
- **WR2-03.** The refusal fails closed and stays scoped to the owner. `assertOwnedMarkersReadable` refuses only when an entry of the staging or unstaging `(plugin, marketplace)` pair is malformed, so another plugin's corrupt marker does not block unrelated commands. At load, an AMIG-01 move that hits the refusal becomes a per-plugin `stopped` row, and the other plugins still move. The read-only load paths (`list`, `info`, the built-in registration step) do not call it, so APL-D1 holds. Every marker shape written since `cdf92a0f` passes the new predicate, so no record from an earlier build is refused.
- **WR2-04** is moot after the WR2-02 revert.
- **IN2-01.** `reason` is present end to end: the type, the TypeBox member, both generated schema copies (`required` includes `reason`), the JSON projection, the redaction (the spread keeps the closed value, and no text is redacted), the per-reason dedup line, the three catalog blocks, the json-output field row, and the enum list.
- **IN2-03.** Both named comment blocks are rewrapped.

New and remaining defects. The finite-positive rule for IN2-02 misreads the adapter's idle loop (WR3-01). The disable or uninstall path drops a `caFile` with no notice (WR3-02). An unresolved url whose literal scheme is `http:` keeps the `caFile` (WR3-03). The new refusal's failed row blames the marketplace manifest (WR3-04). The notice and the docs have four smaller wording defects (IN3-01..04).

## Warnings

### WR3-01: The finite-positive `idleTimeout` rule (IN2-02) misreads pi-mcp-adapter's idle loop and overrides a working user choice

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts:473-482`; `docs/mcp-compatibility.md:145`; `CHANGELOG.md:21`; `features/mcp-server/lifecycle.feature:1001`
**Issue:** The fix cites `init.ts:1031`. That function (`getEffectiveIdleTimeoutMinutes`) is used only for the startup `resident` flag and the debug line of the idle callback (`init.ts:410`, `:618`). The idle stop itself runs in a different path. `index.ts:497` registers `idleOverride = definition.idleTimeout ?? (keepAlive ? 0 : undefined)` with no type check. Then `lifecycle.ts:412-415` computes `perServer * 60 * 1000`, and `checkConnections` stops the server when `timeout > 0` (`lifecycle.ts:146-148`). pi-mcp-adapter 7.0.1 does not validate `idleTimeout` anywhere (`config.ts` never reads it). So:

- `"idleTimeout": "5"` coerces to 300000 ms, and a `lazy` server **does** stop after 5 idle minutes. The probe now writes `lifecycle: "lazy-keep-alive"` beside it (`G idle string | lifecycle= lazy-keep-alive`). The keep-alive skip at `lifecycle.ts:146` runs first, so the user's working idle stop is lost. Iteration 1 honored it.
- `null` reaches the global idle time (10 minutes by default) under `lazy`, so it does stop the server. The doc's "sets no idle stop in the adapter" is wrong for `null` and for a numeric string.
- `0` (or a negative value) under `lazy` means "never stop for idle, and no background restart". It is the only entry setting that keeps a started stdio server without the D-PG9-16 restart, which is the closer match to Claude Code. The fix now adds `lazy-keep-alive` beside it, which turns the restart on (`H idle 0 | lifecycle= lazy-keep-alive`). IN2-02 asked only about non-numbers. Changing `0` goes beyond the finding, and a new scenario pins it.

**Fix:** Mirror the adapter's own reading. The user holds the lifetime when `idleTimeout` is neither `undefined` nor `null`, because any other value replaces both the global idle time and the keep-alive `0` (`index.ts:497`). If the maintainer wants to keep the default only where the adapter would fall back to the global time, test `carried.idleTimeout != null`. Do not test `> 0`. Correct the doc sentence and the CHANGELOG bullet. Replace the zero scenario with a numeric-string case, or keep it and expect no `lifecycle` default. Record the corrected premise in D-PG9-15.

```ts
function userHolds(carried: Readonly<Record<string, unknown>>, field: string): boolean {
  // pi-mcp-adapter 7.0.1 registers any non-nullish entry idleTimeout (index.ts:497)
  // and coerces it in lifecycle.ts getIdleTimeout.
  return Object.hasOwn(carried, field) || (field === "lifecycle" && carried.idleTimeout != null);
}
```

### WR3-02: A disable, an uninstall, or an update that drops the server discards the user's `caFile` with no notice

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts:534-544`; `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts:160-170`
**Issue:** `leavingChoice` now skips `caFile`. Every other carried field survives a disable then enable, and an uninstall then install (D-08-02). A `caFile` now vanishes on all three leave paths: unstage at disable and uninstall, and the stage's own capture when an update drops the server. Nothing tells the user. The stage emits `ca-file-removed` for every other removal of a user `caFile`, but these paths emit none. After an enable at the same origin, the server's TLS handshake against a private CA fails with the adapter's opaque error. The user cannot tell that the extension deleted the value. The design choice (no `caFile` in the store) was the orchestrator's, but the silent loss is a separate defect. The CHANGELOG and the docs record the loss, but the command output does not.
**Fix:** When `leavingChoice` leaves out a `caFile`, report it. Return the dropped servers from `capturedChoices`, and have unstage (and the stage capture) emit `ca-file-removed` with a new closed reason such as `not-kept` ("its caFile is not kept while the plugin is disabled or uninstalled; set it again after you enable or install it"). Add the reason to the wire schema and the catalog. Add a scenario: install, set `caFile`, disable, assert the notice. Or store the origin with the `caFile`, the other iteration-2 option, which removes the loss at the same origin.

### WR3-03: An unresolved url whose literal scheme is `http:` keeps the `caFile`, so the server fails to connect once the variable is set

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts:330-357`
**Issue:** The rule is "fail only on positive evidence". But a literal scheme before the first reference is positive evidence, and `caFileRemovalReason` ignores it whenever `resolvedUrl` returns `undefined`. Probe: a stub `{caFile}` and a new url `http://${H}/mcp` with `H` unset give `caFile= /ca`, `removed= []`. Once the user sets `H`, `validateCaFile` (`http-ca.ts:14-16`) throws "MCP caFile is only supported for HTTPS HTTP servers", and the server does not connect until the next restage. The probe also shows that the same url against a previous `https://a.example` entry gives reason `url-unresolved`, not `not-https`, so the notice names the wrong cause.
**Fix:** When `resolvedUrl` gives none, read the literal scheme that the text starts with, and return `not-https` when there is one and it is not `https:`.

```ts
// A scheme written before any reference; `${BASE}/mcp` has none.
const LITERAL_SCHEME = /^\s*([a-z][a-z\d+.-]*):/i;

function schemeOf(url: string, resolved: URL | undefined): string | undefined {
  return resolved?.protocol ?? LITERAL_SCHEME.exec(url)?.[1]?.toLowerCase().concat(":");
}

// in caFileRemovalReason, replacing the resolved-protocol test:
const scheme = schemeOf(url, resolved);
if (scheme !== undefined && scheme !== "https:") {
  return "not-https";
}
```

Add unit cases for `http://${H}/mcp` with `H` unset, against a stub and against an https previous entry.

### WR3-04: The marker refusal's failed update row reads `unreadable manifest`, which blames the marketplace manifest, and a new scenario pins it

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:990-1010`; `features/mcp-server/lifecycle.feature:530`
**Issue:** `McpConfigFileError` carries no errno, so `errnoFailReason` falls through to `unreadable manifest`. The same function already maps `EISDIR`, `EIO` and `EBADF` on `mcp-adapter.json` to `unreadable`, with the comment "naming the marketplace manifest would blame the wrong file". The fix report calls this pre-existing. But iteration 2 adds a new way to reach this row, a hand-edited marker, and the new scenario makes the misleading reason expected behavior. The user sees `{unreadable manifest}` and checks `marketplace.json`, while the fault is in `mcp-adapter.json`. The fail-closed rule asks for `{unreadable}`.
**Fix:** In `untypedUpdateFailReason` (or before it), map `primary instanceof McpConfigFileError` to `unreadable`. Update the scenario row to `unreadable`. Check the reinstall and enable failure classifiers for the same fall-through.

## Info

### IN3-01: `origin-changed` claims "is now an https server" when the new url could not be read, or when the old entry had no origin

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts:349-352`; `extensions/pi-claude-marketplace/shared/notification-mcp.ts:106-114`
**Issue:** When the previous entry is stdio or socket, the function returns `origin-changed` before it looks at whether the new url resolved. Probe: a previous stdio entry and a new url `${B}/mcp` with `B` unset give `origin-changed`. The line then says that the server "is now an https server at another origin than your caFile was set for". The scheme is unknown, and the old `caFile` was never set for any origin, because the adapter refused it beside `command`.
**Fix:** For a previous entry with no url, return `url-unresolved` when `resolved` is `undefined`. For the stdio-to-https case, reword the clause to "is now an https server, and your caFile was set on a server with no url".

### IN3-02: The `url-unresolved` clause reads as "a variable that ... is not a valid url"

**File:** `extensions/pi-claude-marketplace/shared/notification-mcp.ts:111-112`; `docs/output-catalog.md` (the `mcp-ca-file-removed-url-unresolved` block)
**Issue:** In "its old or new url names a variable that is not set or is not a valid url", the clause "or is not a valid url" attaches to "a variable".
**Fix:** "has a new url, and its old or new url names a variable that is not set or does not read as a url, so the two origins could not be compared …".

### IN3-03: The inserted `idleTimeout` sentence breaks the paragraph's logic

**File:** `docs/mcp-compatibility.md:145`
**Issue:** "Another value … so the default stays. The entry then stays `lazy`, and the adapter stops the server after your `idleTimeout`." "Then" now follows the case where the default stays, so the two sentences contradict each other. Rewrite this together with WR3-01.
**Fix:** Move the "Another value" sentence after "stops the server after your `idleTimeout`", and correct its content per WR3-01.

### IN3-04: The `marker-not-valid` refusal does not name the entry or the member

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts:244-257`; `extensions/pi-claude-marketplace/shared/errors-bridges.ts:138`
**Issue:** The refusal blocks every stage and unstage of the plugin, uninstall included, until the user fixes the file by hand. The message names only the file. The user must search every entry's `_piClaudeMarketplace` for a non-scalar `defaultFields` member, a non-array `pluginSetFields`, or a non-object `keptOverride`.
**Fix:** Carry the server key and the member name, for example `McpConfigFileError(filePath, "marker-not-valid", { server, member })`, and render `has the entry "<key>" whose "_piClaudeMarketplace.<member>" is not valid`. Pass both names through `printable` or redaction, as the other names are.

---

_Reviewed: 2026-11-15T01:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

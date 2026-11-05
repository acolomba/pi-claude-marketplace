---
phase: 01-foundation-and-pi-1-5-0
reviewed: 2026-11-04T09:32:03Z
depth: standard
files_reviewed: 47
files_reviewed_list:
  - .github/workflows/ci.yml
  - extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts
  - extensions/pi-claude-marketplace/domain/mcp-builtin-features.ts
  - extensions/pi-claude-marketplace/domain/mcp-implementation.ts
  - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
  - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
  - extensions/pi-claude-marketplace/domain/name.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/types.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/mcp/agent-grants-step.ts
  - extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts
  - extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts
  - extensions/pi-claude-marketplace/orchestrators/mcp/session-materialize.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts
  - extensions/pi-claude-marketplace/platform/mcp-status.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
  - extensions/pi-claude-marketplace/shared/notification-run.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - features/lib/builtin-mcp-stand-in/extension.ts
  - features/lib/builtin-mcp-stand-in/servers.ts
  - features/lib/mcp-implementation.ts
  - features/lib/mcp-stub-server.ts
  - features/lib/pi-registry-probe/extension.ts
  - features/lib/pi-registry-probe/snapshot.ts
  - features/lib/turn-records.ts
  - features/step_definitions/command.steps.ts
  - features/step_definitions/mcp-implementation.steps.ts
  - features/step_definitions/mcp-server/agent-grants.steps.ts
  - features/step_definitions/mcp-server/listing.steps.ts
  - features/support/mcp-implementation.ts
  - features/support/pi-process.ts
  - features/support/world.ts
  - scripts/check-features.mjs
  - test/e2e/_rpc.ts
findings:
  critical: 2
  warning: 5
  info: 6
  total: 13
  necessity: 0
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-11-04T09:32:03Z
**Depth:** standard
**Files Reviewed:** 47
**Status:** issues_found

## Summary

I reviewed the 47 primary files of `git diff 2799bd1..HEAD`. I also traced callers
and mirrors outside the diff: `orchestrators/reconcile/apply.ts`, Pi 1.5.0's
`dist/extensions/mcp/tools.js`, `dist/core/mcp-servers.d.ts`,
`dist/core/settings-manager.js`, and pi-mcp-adapter 7.0.0's `formatToolName`. For
the changed test files I looked only for tests that cannot fail. I read the
necessity rubric. No finding qualifies as a necessity finding: each guard I
checked sits on a trust boundary (`state.json`, Pi inventory data) or is a DI seam.

Most of the code matches its contracts. The adapter tool name matches
`formatToolName`. The built-in tool name matches `createMcpToolName` (I checked
three cases against Pi's own function). The snapshot keeps its read order. The
record producers write the new fields on every version-changing write path.

Two defects block shipping:

1. `apply`'s deferred-pin restore (`restorePin`) was not updated for the new
   record fields. It puts the old version back and leaves the new version's
   `mcpServerConfigs` and `mcpBundle` in `state.json`. This path is reachable in
   production today and writes an inconsistent record.
2. The frozen built-in `toolNamePrefix` is documented as "the text every tool name
   of the server starts with". That is false when `plugin` and `server` together
   are 41 characters or longer. The harness's own listing wait relies on the
   claim, and Phases 4 and 5 will too.

The warnings cover four kinds of problem:

- The legacy reader can return the servers of a different version than the one
  the record names.
- The top-level `compatibilityBasis` is decoupled from the writers of
  `compatibility`.
- Two frozen seams are too narrow or too silent.
- A harness race in the shared-Pi reset after a replaced Pi.

## Critical Issues

### CR-01: The deferred-pin restore leaves the new version's MCP servers on a record it rolls back to the old version

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1929-1963` (the mirror of `orchestrators/plugin/update-preflight.ts:836-863`)
**Issue:** `PIN_FIELDS` is documented as "The record fields a pin refresh rewrites
(`update-preflight.ts::refreshDisabledRecord`)". It lists only `version`,
`resolvedSource`, `resolvedSha`, `compatibility`, and `updatedAt`. Phase 1 made
`refreshDisabledRecord` also rewrite `mcpServerConfigs` and set or delete
`mcpBundle` (`update-preflight.ts:854-860`), but it did not touch this mirror.

Take an `apply` whose catalog move refreshes a disabled record and whose enable
then fails. `restorePin` puts back the old version and root, but the record keeps
the new version's declared servers and bundle flag. Two cases break:

- If the old record was a legacy record (no `mcpServerConfigs`), it now reads as
  `recorded` with the wrong version's servers, instead of `re-resolved`.
- If the new version declares a bundle and the old one does not, `mcpBundle: true`
  survives too.

This breaks MREC-01 ("every declared server of the version this record names").
Through `recordedMcpServers`, Phase 2 would register the wrong servers and
`effectiveMcpCompatibility` would compute the wrong verdict. No test covers it.
`grep -rn restorePin test` finds nothing.

`resolvedVersion` is also rewritten by `refreshDisabledRecord` and is missing from
`PIN_FIELDS`. That gap predates this phase, but the same fix closes it.
**Fix:**
```ts
const PIN_FIELDS: ReadonlySet<string> = new Set([
  "version",
  "resolvedSource",
  "resolvedSha",
  "resolvedVersion",
  "compatibility",
  "compatibilityBasis",
  "mcpServerConfigs",
  "mcpBundle",
  "updatedAt",
]);
// in restorePin, before Object.assign: delete every optional pin field, so an
// absent field in `before` stays absent after the restore
for (const field of ["resolvedSha", "resolvedVersion", "compatibilityBasis", "mcpServerConfigs", "mcpBundle"]) {
  Reflect.deleteProperty(record, field);
}
Object.assign(record, pins.get(key));
```
Add an `apply` test in which a deferred move adds a server and the enable fails.
The test asserts that the restored record equals the `before` record field for
field. Better still, derive `PIN_FIELDS` from the `DisabledPin` `Pick` in
`update-preflight.ts`, so the two lists cannot drift again.

### CR-02: The frozen built-in `toolNamePrefix` is not a prefix of the server's tool names once the server name is long

**File:** `extensions/pi-claude-marketplace/domain/mcp-implementation.ts:35-36,85-87` (frozen interface 1 and 8). Consumer: `features/lib/mcp-implementation.ts:454-456`
**Issue:** The contract says `toolNamePrefix` is "The text every tool name of the
server starts with". Pi 1.5.0 cuts every tool name over 64 characters to its first
55 characters plus `_<8 hex>`. The built-in prefix is `mcp__` + name + `__`, which
is 15 + len(plugin) + len(server) characters. Once that is longer than 55
(len(plugin) + len(server) ≥ 41, which realistic names reach), every tool name
of the server is cut and none starts with the prefix. I checked this against Pi's
real `createMcpToolName`: server `plugin_atlassian-confluence-tools_confluence-cloud`
and tool `search_pages` give `mcp__plugin_atlassian_confluence_tools_confluence_cloud_0e6bb645`.
The prefix is `mcp__plugin_atlassian_confluence_tools_confluence_cloud__` (57
characters), and `startsWith` returns `false`.

The frozen harness already relies on the false claim. Under `builtin`,
`listingDone` waits for `allTools.some((tool) => tool.name.startsWith(prefix))`,
so a scenario with such a plugin times out after 15 s. Phase 5's hook matchers
(D-MB-08) and Phase 4's grants will build on the same claim. The interface is
frozen after this phase, so a child cannot correct it.
**Fix:** The prefix cannot be fixed, so change the contract before the freeze.
Either:
- make the prefix total and honest, for example `toolNamePrefix(...): string |
  undefined`, which returns `undefined` when `mcp__<folded>__` is longer than
  `MAX_TOOL_NAME_LENGTH - TOOL_NAME_HASH_LENGTH - 1`, and document that callers
  must then match by tool group; or
- replace it with a predicate that takes the tool's Pi `group` (Pi tags each MCP
  tool with its server group, `mcp__<namespace>`, see `ToolInfo.group` in
  `dist/core/extensions/types.d.ts`), such as `ownsTool(plugin, server, tool:
  { name: string; group?: string }): boolean`.

Then switch `listingDone` to the same rule, and add a long-name row to
`test/domain/mcp-implementation.test.ts` that asserts
`toolName(...).startsWith(toolNamePrefix(...))` for every row, or asserts the
documented exception.

## Warnings

### WR-01: The legacy reader can return the servers of a version the record does not name

**File:** `extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts:132-159`
**Issue:** `createLegacyServersReader` re-resolves the record with two inputs:
- the *current* marketplace entry (`loadMarketplaceManifest` + `lookupDeclaredPlugin`)
- the files at `record.resolvedSource`

For an unpinned path source, `resolvedSource` is the live directory inside the
marketplace clone, and `marketplace update` moves it forward without touching the
record. The root check (`resolved.pluginRoot !== record.resolvedSource`) passes,
because the path is the same. So after a marketplace update that changes a path
plugin's `.mcp.json` or the entry's inline `mcpServers`, the reader answers
`re-resolved` with the *new* declaration. The record still names the old version,
and its staged `mcp-adapter.json` entries still hold the old servers. For git
records the root check is tautological, because the callback returns
`record.resolvedSource` itself. The current manifest entry can still differ
there, too. The module doc promises "the declared MCP servers of a record that
predates the field", but the reader cannot keep that promise.
**Fix:** Refuse when the re-resolution does not describe the recorded version. Add
a reason `"version-mismatch"`, and compare the version that install would derive
for the re-resolved plugin (`domain/version.ts`) with `rangeVersionOf(record)`, or
for an unpinned path source compare the content hash. Any mismatch answers
`unreadable`, so the stored verdict stands (MREC-02). If the comparison is out of
scope, at least document in the frozen record that a legacy path record
re-resolves against the live tree.

### WR-02: `compatibilityBasis` is decoupled from every writer of `compatibility`

**File:** `extensions/pi-claude-marketplace/persistence/state-io.ts:163-168`; `orchestrators/plugin/update-preflight.ts:745-756`; `orchestrators/plugin/update-swap.ts:723-730,881-886`
**Issue:** The neutral mark sits at the record's top level (P1-DC-34), not inside
`compatibility`. Each of these sites assigns a new `compatibility` object and
neither sets nor clears `compatibilityBasis`:
- `applyAllSuccessRecordFields`
- `markUpdateInProgress`
- `refreshDisabledRecord`

Once Phase 3 writes `"neutral"`, any write that still produces an adapter-basis
verdict leaves a stale `"neutral"` beside it. `effectiveMcpCompatibility` then
drops the adapter's MCP block. `disabledPinProjection` also leaves the basis out,
so a basis-only change to a disabled record is never detected and never written.
CR-01 shows the same failure mode, a sibling field that one writer forgot. Phase 1
cannot reach this, but the shape is frozen now.
**Fix:** Put the basis inside the object it qualifies, as
`compatibility.basis?: "neutral"` (still optional and additive), so that replacing
`compatibility` replaces the basis. If the top-level field stays, every writer
must handle it. Write a helper `setCompatibility(record, compatibility, basis)`
in `state-io.ts` that writes or deletes both fields, use it at the three sites,
and add `pin.compatibilityBasis ?? null` to `disabledPinProjection`.

### WR-03: `recordedMcpServers` swallows every error without a trace

**File:** `extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts:54-60`
**Issue:** The bare `catch {}` turns every failure of the legacy reader into
`unreadable`: the typed refusals, but also `EACCES`, a malformed `marketplace.json`,
and a `TypeError` from a bug. Nothing is logged. Under `builtin`, Phase 2 treats
`unreadable` as "no servers known", so a plugin's servers silently never register
and nothing in `PI_CLAUDE_MARKETPLACE_DEBUG` output says why. The file is frozen,
so adding the log later needs a parent line.
**Fix:**
```ts
} catch (err) {
  hookDebugLog(`recorded MCP servers unreadable: ${errorMessage(err)}`, "mcp");
  return { kind: "unreadable" };
}
```
This matches `session-materialize.ts`'s `runStep`.

### WR-04: The frozen built-in status reader cannot see connection state

**File:** `extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts:26-31` (frozen interface 7)
**Issue:** BLT-05 asks `info` to show a built-in server as connected or not
connected. The frozen factory takes only `Pick<PiMcpRegistry, "getMcpServers">`.
Pi 1.5.0's `RegisteredMcpServer` is `{ name, config, extensionPath }`
(`dist/core/mcp-servers.d.ts:125-130`), and the built-in MCP emits no status
event (`dist/extensions/mcp/*.js` never calls `pi.events.emit`). The only signal
Pi exposes is whether the server's tools appear in `getAllTools()`, and the
frozen parameter cannot read that. Phase 2 must therefore change a frozen
signature, or ship BLT-05 without connection state.
**Fix:** Before the freeze, widen the parameter to
`Pick<PiMcpRegistry, "getMcpServers"> & Pick<PiInventory, "getAllTools">`, and
record the widening in `01-FROZEN.md`. `index.ts` already passes the whole `pi`,
so the call site does not change, and building the reader still reads nothing.

### WR-05: The shared-Pi reset races the exiting stubs after a replaced Pi

**File:** `features/lib/mcp-implementation.ts:354-373`; `features/support/pi-process.ts:204-213`
**Issue:** When the previous scenario left the shared Pi busy, `Before` first runs
`await run.pi.stop()`. That call closes Pi's stdin, waits for its exit, then kills
the group, so the stub servers are exiting while `stubPidsIn` runs. A stub deletes
its pid file when its stdin closes (`mcp-stub-server.ts:195`). `stubPidsIn` lists
the files with `readdir` and then reads them with `Promise.all(readFile)` outside
the `try`. A file removed between the two calls throws `ENOENT` out of `Before`.
That cascades one failed scenario into a failed reset for the next scenario, on
the builtin profile only, and only on the recovery path, where it is hardest to
diagnose.
**Fix:** Treat a pid file that disappears as an exited stub:
```ts
const texts = await Promise.all(
  names.map((name) =>
    readFile(path.join(harness, name), "utf8").catch((error: unknown) =>
      isMissing(error) ? undefined : Promise.reject(error),
    ),
  ),
);
// skip undefined entries, then parse the rest as today
```

## Info

### IN-01: The tag-rule heuristics in `check-features.mjs` accept non-IDs and miss some MCP scenarios

**File:** `scripts/check-features.mjs:47-52,552-556,598`
**Issue:** `licenseId` (`/\b[A-Z]+(?:-[A-Z0-9]+)*-\d+\b/`) matches `UTF-8`,
`SHA-256`, and `ISO-8601`, so a title that names no requirement still passes the
reason rule. `isMcpPickle` ignores a doc string or table that holds only `mcp__…`
tool names or `mcp.json`, because `\bmcp\b` fails before `_`, and the value check
looks only for `mcpServers` and `.mcp.json`. I scanned every untagged pickle. Today
the only one that names MCP is `features/skill/invocation.feature:29`, which lists
pi-mcp-adapter as a companion, so nothing slips through yet. P1-DC-36 records part
of this.
**Fix:** Require a known ID prefix list (`D-`, `MSEL-`, `MREC-`, `BLT-`, …) and add
`mcp__` and `mcp.json` to the value check.

### IN-02: "which did not fail" weakens deterministic setup in an `@adapter-only` feature

**File:** `features/mcp-server/configuration.feature:20,97,171`
**Issue:** The feature runs only under the adapter, where these installs always
emit an info cascade plus a warning notice (01-09-SUMMARY). The new step accepts
info-only output too, so the notice could disappear without any failure. The
step exists for setup whose severity depends on the profile, which is not the case
here.
**Fix:** Add a precise setup variant (for example "which warned with an MCP config
notice"), or assert the notice in a `Then`.

### IN-03: "Merge order" does not hold for integer-like server names

**File:** `extensions/pi-claude-marketplace/domain/mcp-resolution.ts:361-362` → `persistence/state-io.ts:296-303`
**Issue:** `Object.fromEntries`, and then `Object.entries` in `mcpServerConfigsOf`,
put array-index keys (`"1"`, `"2"`) first. So `mcpServerConfigs` does not keep
D-CF6-01 merge order for such names, although the record schema comment promises
it. The same issue already existed for `mcpServers`.
**Fix:** Carry the `[name, config][]` array from `recordMergedServers` straight
into `mcpServerConfigsOf`, or document the exception.

### IN-04: `readBuiltinTurnedOff` counts project settings that Pi ignores for an untrusted project

**File:** `features/lib/mcp-implementation.ts:205-212`
**Issue:** Pi 1.5.0 loads project settings only when the project is trusted
(`dist/core/settings-manager.js:257-258`). In an untrusted profile with
`-builtin:mcp` in `.pi/settings.json`, the harness would expect `none` while Pi
runs `builtin`, so the scenario fails for the wrong reason. No scenario does this
today. Phase 2's trust scenarios could.
**Fix:** Pass the profile's trust to `readBuiltinTurnedOff`, and read the project
file only when the project is trusted.

### IN-05: A stale `ignoreExports` entry for `features/lib/mcp-implementation.ts`

**File:** `.fallowrc.json` (see `01-FROZEN.md` §3)
**Issue:** `stubPidsIn`, `waitUntilProcessesExit`, and `writeAdapterOnboardingSeed`
already have a consumer (`features/support/pi-process.ts`). The suppression now
hides only a future true positive. P1-DC-33 records this.
**Fix:** Remove the entry before the freeze.

### IN-06: The info handler's trust read cannot fail its test

**File:** `extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts:76`
**Issue:** As P1-DC-37 records, a constant `projectTrusted: true` would pass the
handler test, so nothing pins the value.
**Fix:** Add one case with `isProjectTrusted()` returning `false`, and assert the
value that `getPluginInfo` receives.

---

## Dubious Choices

- **Choice:** Put `compatibilityBasis` at the record's top level instead of inside
  `compatibility` (P1-DC-34). **Alternatives:** `compatibility.basis?: "neutral"`, or
  one setter that writes both fields. **Why dubious:** every writer of
  `compatibility` must remember a sibling field, and CR-01 shows that this repo
  already forgets sibling fields in mirrors (WR-02). **Severity:** Medium.
- **Choice:** Freeze `toolNamePrefix` as a plain string with an "every tool name
  starts with" contract. **Alternatives:** an optional prefix, or a predicate over
  the tool's Pi `group`. **Why dubious:** the contract is false for long names, and
  children cannot change it (CR-02). **Severity:** High.
- **Choice:** The legacy reader trusts the current manifest entry and the live tree
  at `resolvedSource`, and makes no version check (P1-DC-35, UF-1).
  **Alternatives:** a version or hash check that refuses on drift (WR-01).
  **Why dubious:** it answers `re-resolved` for a version the record does not name.
  **Severity:** Medium.
- **Choice:** The shared Pi loads pi-mcp-adapter for every non-MCP scenario under the
  adapter profile (P1-DC-03). **Alternatives:** keep a companion-free shared Pi and
  load the adapter only for `@mcp` and `@adapter-only` scenarios.
  **Why dubious:** non-MCP lifecycle scenarios no longer run in the companion-free
  Pi that a fresh user has, and the 66-failure onboarding seed exists only because
  of this choice. **Severity:** Low.
- **Choice:** A bare `catch {}` maps every reader failure to `unreadable`
  (MREC-02). **Alternatives:** the same mapping with a debug log (WR-03).
  **Why dubious:** a Phase 2 registration that silently skips a plugin leaves no
  trace. **Severity:** Low.

_Reviewed: 2026-11-04T09:32:03Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

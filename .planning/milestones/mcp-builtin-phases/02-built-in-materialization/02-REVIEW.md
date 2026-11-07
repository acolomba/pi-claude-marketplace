---
phase: 02-built-in-materialization
reviewed: 2026-11-04T00:00:00Z
depth: standard
files_reviewed: 46
files_reviewed_list:
  - docs/mcp-compatibility.md
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/builtin-description.ts
  - extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/builtin-escape.ts
  - extensions/pi-claude-marketplace/bridges/mcp/builtin-overrides.ts
  - extensions/pi-claude-marketplace/bridges/mcp/builtin-registration.ts
  - extensions/pi-claude-marketplace/bridges/mcp/index.ts
  - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
  - extensions/pi-claude-marketplace/domain/mcp-builtin-translation.ts
  - extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts
  - extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts
  - features/lib/mcp-builtin-config-probe/extension.ts
  - features/lib/mcp-builtin-config-probe/snapshot.ts
  - features/lib/mcp-builtin-earlier-record.ts
  - features/lib/mcp-builtin-tool-search.ts
  - features/mcp-server/builtin-direct.feature
  - features/mcp-server/builtin-status.feature
  - features/mcp-server/builtin-trust.feature
  - features/mcp-server/builtin-values.feature
  - features/mcp-server/configuration.feature
  - features/mcp-server/implementation-switch.feature
  - features/mcp-server/invocation.feature
  - features/mcp-server/lifecycle.feature
  - features/mcp-server/listing.feature
  - features/mcp-server/project-scope.feature
  - features/mcp-server/sources.feature
  - features/step_definitions/mcp-server/builtin-status.steps.ts
  - features/step_definitions/mcp-server/builtin-tool-search.steps.ts
  - features/step_definitions/mcp-server/builtin-values.steps.ts
  - features/step_definitions/mcp-server/configuration.steps.ts
  - features/step_definitions/mcp-server/implementation-switch.steps.ts
  - test/bridges/mcp/builtin-description.test.ts
  - test/bridges/mcp/builtin-entry.test.ts
  - test/bridges/mcp/builtin-escape.test.ts
  - test/bridges/mcp/builtin-overrides.test.ts
  - test/bridges/mcp/builtin-registration.test.ts
  - test/bridges/mcp/index.test.ts
  - test/bridges/mcp/substitute.test.ts
  - test/domain/mcp-builtin-translation.test.ts
  - test/integration/mcp-builtin-encoding-conformance.test.ts
  - test/orchestrators/mcp/builtin-registration-step.test.ts
  - test/orchestrators/plugin/info-mcp-status.test.ts
  - test/orchestrators/plugin/info.test.ts
  - test/platform/mcp-builtin-status.test.ts
findings:
  critical: 0
  warning: 5
  info: 2
  total: 7
  necessity: 0
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-11-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 46
**Status:** issues_found

## Summary

I reviewed the diff against `87d3f28` at standard depth. I checked each security and correctness claim against the Pi 1.5.0 source in `node_modules/@earendil-works/pi-coding-agent/dist`.

These parts hold up:

- **`$` and `!` encoding.** `builtin-escape.ts` doubles every `$` and writes a leading `!` as `$!`. Pi's `parseConfigValueReference` and `parseConfigValueTemplate` (`dist/core/resolve-config-value.js`) read that back byte for byte, so no Pi variable expands and no shell command runs. Pi resolves only `env`, `headers`, and `oauth.clientSecret` (`dist/extensions/mcp/runtime.js:56-63,157`). The extension never writes `clientSecret`. `command`, `args`, and `url` are passed as they are. The conformance test drives Pi's real resolver and validator.
- **MSEL-03.** `syncSession` returns before it reads anything unless `mcpImplementation === "builtin"`.
- **NFR-2.** `syncSession`, `guardedRecordRegistrations`, `scopeRegistrations`, `readBuiltinServerDescription`, and `readMcpJsonServerNamespaces` all catch their errors.
- **Byte-identical adapter output.** `ADAPTER_FIELD_ENCODER` makes the same `serializeSegments` and `serializeLiteral` calls as the old code, with the same arguments.
- **Idempotent sync.** Pi's validator returns `{...value}` in the same key order. The sync compares that JSON, so an unchanged server is not registered again.
- **Nothing persisted.** No resolved value is written to a file.

I found no blocker. The weak points:

- The UF-1 containment check is weaker than the contract it cites (WR-01).
- A value resolved at registration can still be home-expanded by Pi, a gap that is neither handled nor documented for built-in (WR-02).
- Two status-mapping cases make `info` disagree with what Pi runs (WR-03, WR-04).
- One cucumber `Then` step has a side effect, which the cucumber rules forbid (WR-05).

## Warnings

### WR-01: The UF-1 containment check accepts either root for any record, and the marketplace root it trusts comes from the same file

**File:** `extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts:113-121`
**Issue:** The doc comment says "a path record's root is inside its marketplace, a git record's inside the clones". `isContained` does something looser:

1. It accepts a record when `resolvedSource` lies inside **either** root, whatever kind of record it is. A path record that points into another plugin's clone under `plugin-clones/` passes. So does a git record that points anywhere inside a marketplace root.
2. For a git record, it accepts any directory under `pluginClonesDir`, not only that record's own `<pluginClonesDir>/<key>/`. NFR-10 requires the "owning clone root".
3. For a path record, it compares `resolvedSource` against `marketplace.marketplaceRoot`, which comes from the same `state.json` as `resolvedSource`. An edited or corrupt state that sets `marketplaceRoot: "/"` passes every record. Even for a git-cloned marketplace, nothing checks that `marketplaceRoot` lies under the scope's marketplace clone directory.

So the check catches only state that disagrees with itself. The path it guards feeds `${CLAUDE_PLUGIN_ROOT}`, the injected `CLAUDE_PLUGIN_ROOT` env, and the manifest description read. Amendment UF-1 and P2-DC-13 relaxed the root to support `dir`/`file` marketplaces, but they do not license points 1 and 2.

**Fix:** Choose the root by record kind, and tie a cloned marketplace's root back to the scope:
```ts
async function isContained(source: RecordSource, locations: ScopedLocations): Promise<boolean> {
  const pluginRoot = source.record.resolvedSource;
  if (source.record.resolvedSha !== undefined && isGitPluginSource(source)) {
    // Git record: its own clone only.
    return isInside(await locations.pluginCloneDir(cloneKeyOf(source)), pluginRoot);
  }
  // Path record: its marketplace root, which for a cloned marketplace must
  // itself lie under the scope's marketplace clones.
  if (isClonedMarketplace(source.marketplace.source) &&
      !(await isInside(locations.marketplacesDir, source.marketplace.marketplaceRoot))) {
    return false;
  }
  return isInside(source.marketplace.marketplaceRoot, pluginRoot);
}
```
If this is not done now, record in P2-DC-13 that the check allows any root for any record and that it trusts a marketplace root taken from the same file.

### WR-02: Pi home-expands a value that resolves to a leading `~` at registration, which Claude Code leaves literal

**File:** `extensions/pi-claude-marketplace/bridges/mcp/builtin-escape.ts:42-48`, `extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts:34-49`, `docs/mcp-compatibility.md` ("Other gaps" under the built-in section)
**Issue:** Pi's `createDefaultTransport` runs `expandHome` on `command` and on every `args` element (`dist/extensions/mcp/runtime.js:44-50,66-67`). The built-in profile blocks only a *literal* leading `~` (and a `${NAME:-~…}` default). The built-in encoder resolves references itself at registration, so a resolved value can still start with `~`:

- `args: ["${X:-}~/a"]` with `X` unset gives `~/a`.
- `args: ["${CFG}"]` with `CFG=~/conf` gives `~/conf`.

Pi turns both into `/home/<user>/…`. Claude Code passes `~/a` as written. The doc records this gap for pi-mcp-adapter (line 577) but not under "Pi's built-in MCP", and MDOC-01 requires each built-in statement to be complete. Unlike the adapter, the built-in path knows the final value at registration, so it can detect the case.

**Fix:** In `builtinServerConfig`, after substitution, refuse a stdio config whose `command` or any `args` element matches `/^~(?:$|\/)/` (and `~\` on win32). Return `undefined`, and the step logs `MCP server <name> not registered: a leading ~ that Pi would expand`. Then add a bullet under "Other gaps" in `docs/mcp-compatibility.md`. If you keep the behavior, at least add the doc bullet and a P2-DC entry.

### WR-03: The status reader says `disabled` for a server whose config changed in the session and has not reconnected

**File:** `extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts:74-80`
**Issue:** The reader maps "every tool of the namespace is hidden" to `disabled`, on the premise that only `/mcp` disable hides tools. Pi also hides tools in two other cases:

- When an extension re-registers a server with a **changed** config. The `mcp_servers_change` handler puts it in `removed`, calls `hideTools`, and starts a new connection (`dist/extensions/mcp/index.js:1084-1100`).
- When a connected server drops all of its tools (`registerTools`, lines 339-345).

The re-registration happens in this phase's own flow. `builtinRegistrationStep` registers config C1 at `session_start`. An `autoapply` load then updates the plugin, and `resyncBuiltinRegistrations` registers C2 (D-MB-10, P2-DC-35). Until C2 connects, and for good if it fails, every tool of the namespace is hidden, so `info` shows `disabled`. The right answer is `not connected`; Pi's `/mcp` shows it as failed or connecting.

**Fix:** The reader cannot learn the connection state, so make `disabled` stricter. One option: count a namespace as disabled only when its tools are hidden **and** the listed config's exposure is not hidden; otherwise read `not-connected`. Note that Pi's session-only disable leaves `config.enabled` unset for registered servers, so check Pi's `/mcp` path before you rely on that field. A stronger option: keep a module-level set of names whose config the sync changed in this session (`syncBuiltinRegistrations` knows it), and map all-hidden to `not-connected` for those names. At minimum, add this case to P2-DC-10 and to the doc's `/mcp` paragraph. Also add a unit row: a name whose namespace has only hidden tools after a config change answers the documented token.

### WR-04: `overridden by project scope` is stamped for project servers that never register, so `info` can contradict what Pi runs

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts:155-167,187`
**Issue:** `builtinProjectOverrides` treats every name in the enabled project record's `mcpServerConfigs` as overriding the user row. The registration step overrides a user server only when the project record actually yields a registration of that name (`builtin-registration-step.ts:225-232`). It yields none in each of these cases, and the user server stays registered and running:

- The project server is blocked or malformed under the built-in profile (`serverRegistrations` filters it out).
- The project record fails the UF-1 check (`recordRegistrations` returns `[]`).
- The project record's servers are unreadable (legacy reader refusal).
- `builtinServerConfig` returns `undefined`.

In all of these, `info` shows the user row as `overridden by project scope` while Pi runs it. A related case: the registration map is keyed by `plugin_<plugin>_<server>`, which does not name the marketplace. A trusted project `foo@B` therefore replaces a user `foo@A`. `info` passes only the same-marketplace project record (`info.ts:3168-3191`), so the user row of `foo@A` reads the project server's live status as its own (`connected`).

**Fix:** Derive the override set by the same rule the registration uses. At minimum, keep only project servers the built-in profile runs:
```ts
function builtinProjectOverrides(...): ReadonlySet<string> {
  if (!lookup.projectTrusted || block.marketplaceScope !== "user" ||
      projectRecord === undefined || isRecordedButDisabled(projectRecord) ||
      projectRecord.dependencyDisabled === true) {
    return new Set<string>();
  }
  const runnable = (projectRecord.mcpServerConfigs ?? [])
    .filter(({ config }) => profileFor("builtin").classify(config).kind === "supported")
    .map(({ name }) => name);
  return new Set(projectRecord.mcpServerConfigs === undefined
    ? projectRecord.resources.mcpServers
    : runnable);
}
```
This also matches the step's `dependencyDisabled` exclusion. Record the containment and unreadable cases, which a synchronous `info` cannot see, and the cross-marketplace case as known gaps in P2-DC-14.

### WR-05: A `Then` step issues a Pi command, which adds a session entry

**File:** `features/step_definitions/mcp-server/builtin-values.steps.ts:68-83`
**Issue:** `.agents/skills/cucumber/rules/steps.md` says: "A `Then` reads what the `When` left on the world … No other `Then` writes to the world". The six listed exceptions are compared-markers. The step `pi holds these mcp server configs, apart from …` sends a `prompt` request for `/pi-mcp-builtin-config-probe`, whose handler calls `pi.appendEntry`. That is an action on Pi with a side effect, inside an assertion step. The frozen Phase 1 precedent does it the other way: `When the user lists the slash commands pi offers` captures `registrySnapshot`, and `Then pi lists these registered mcp servers:` only reads it (`features/step_definitions/session.steps.ts:121-133`, `mcp-implementation.steps.ts:111-119`). The comment ("a read-only query … as a stub log is read") is wrong: a stub log is read from disk, while this step drives the Pi under test.

**Fix:** Split the step. A `When the user asks pi for the configs of its registered mcp servers` runs the probe and stores the parsed `RegisteredConfigs` on the world. The `Then` compares only the stored value. Update the `builtin-values.feature` scenarios to match. If this exception is kept deliberately, add it to the cucumber skill's exception list, which is a frozen file, so it needs a parent line.

## Info

### IN-01: The step's debug log is not "names only": error messages carry absolute paths

**File:** `extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts:28-29,198,210`; `extensions/pi-claude-marketplace/bridges/mcp/builtin-registration.ts:46`
**Issue:** The header promises "debug-logged on the `mcp` channel with names only". The logged `errorMessage(error)` can come from:

- `loadState`, whose errors name the absolute state path.
- `locations.pluginDataDir` and `assertPathInside`, whose messages carry absolute parent and child paths.
- The legacy reader.
- Pi's `registerMcpServer`, whose message embeds `extension "<absolute extension path>"`.

No config value or secret reaches the log: Pi's validator messages name only the server. The channel is opt-in stderr, so the risk is low, but the claim is wrong.
**Fix:** Pass the messages through `shared/redact-absolute-paths.ts` before logging, or change the header to say paths can appear.

### IN-02: One throw while unregistering aborts the whole sync, including the unrelated registrations

**File:** `extensions/pi-claude-marketplace/bridges/mcp/builtin-registration.ts:31-36`
**Issue:** Each `registerMcpServer` call has its own try/catch, but the `getMcpServers()` and `unregisterMcpServer()` loop has none. A throw there propagates to `syncSession`'s outer catch, and no desired server registers in that call. Today Pi's `unregister` throws only from `assertActive` on a stale API, where every call fails anyway. The asymmetry is still undocumented and not tested.
**Fix:** Wrap each `unregisterMcpServer` in the same per-name try/catch and log, or note in the doc comment that a throw while listing or unregistering skips the whole sync.

---

_Reviewed: 2026-11-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 06-mcp-servers
reviewed: 2026-11-01T18:18:17Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - docs/mcp-compatibility.md
  - extensions/pi-claude-marketplace/domain/components/mcp.ts
  - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
  - features/lib/mcp-server-environment.ts
  - features/lib/mcp-server-files.ts
  - features/lib/mcp-server-http.ts
  - features/mcp-server/companion-missing.feature
  - features/mcp-server/configuration.feature
  - features/mcp-server/invalid-configs.feature
  - features/mcp-server/invocation.feature
  - features/mcp-server/lifecycle.feature
  - features/mcp-server/listing.feature
  - features/mcp-server/project-scope.feature
  - features/mcp-server/sources.feature
  - features/step_definitions/mcp-server/configuration.steps.ts
  - features/step_definitions/mcp-server/invalid-configs.steps.ts
  - features/step_definitions/mcp-server/invocation.steps.ts
  - features/step_definitions/mcp-server/lifecycle.steps.ts
  - features/step_definitions/mcp-server/sources.steps.ts
  - features/step_definitions/mcp-server/status.steps.ts
  - features/step_definitions/mcp-server/listing.steps.ts
  - test/domain/components/mcp.test.ts
  - test/domain/components/plugin.test.ts
  - test/domain/mcp-resolution.test.ts
  - test/domain/plugin-resolver.test.ts
  - test/integration/mcp-migration.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/reconcile/mcp-migration.test.ts
findings:
  critical: 0
  warning: 8
  info: 8
  total: 16
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-11-01T18:18:17Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

I reviewed the D-CF6-01 merge and the D-CF6-02 skip/refuse split in
`domain/mcp-resolution.ts`, the widened `MCP_SERVERS_SCHEMA`, the three new
cucumber stand-ins, the eight MCP feature files and their step modules, and the
unit and integration tests that changed. I checked the merge against the
measured upstream table in `06-RESEARCH.md` (FG-27/FG-28). These all match it:
`.mcp.json` first, then the manifest (or the entry only when there is no
`plugin.json`); a later name replaces an earlier one in its first position; a
malformed server in a file is dropped before the merge; a blocked server is
dropped after the merge; an inline defect is fatal. The `__proto__` handling is
correct. I found no BLOCKER-level defect in the product code.

The main concerns:

1. The containment rules for the two kinds of file source do not match. The
   root `.mcp.json` is read through any symlink, with no containment check. A
   referenced file is refused, as a fatal `{malformed mcp}`, when its path holds
   any symlink, even one that stays inside the plugin root. The doc rewritten
   in this phase records neither rule.
2. The new catch-alls skip every error class, transient ones included. During
   `update`, `apply`, or the AMIG-01 move, such a skip removes the installed
   servers with no message. AMIG-01 then tells the user the plugin "no longer
   declares" a server it still declares.
3. There are several test weaknesses. One WLIF-01 test can no longer reach the
   branch its title names. Two absence checks depend on timing. One
   update/override scenario cannot fail for the reason its title states. The
   loopback HTTP stand-in can poison its own log chain and raise an unhandled
   rejection.

## Warnings

### WR-01: The root `.mcp.json` is read through symlinks with no containment, but a referenced file is refused on any symlink

**File:** `extensions/pi-claude-marketplace/domain/mcp-resolution.ts:320` (with `141-148`, `174-193`)
**Issue:** `resolveStrictMcp` reads `path.join(pluginRoot, ".mcp.json")` straight through `statKind`/`readFileText`. The default `statKind` is `fs.stat`, which follows links (`plugin-resolver.ts:76-78`). So a plugin that ships `.mcp.json` as a symlink makes the resolver read any JSON file the user can read, and its server map is installed into `mcp-adapter.json` under the plugin's keys. A string reference, by contrast, goes through `resolveContainedComponentPath` → `assertPathInside`, which refuses any symlink segment (`SymlinkRefusedError`). The module header and the `readReferencedMcp` doc both say "Containment runs before any read (T-06-07)", but that holds only for references. This phase rewrote the root-file path into the shared `mergeServerFile`. It applied containment to one caller and not the other. This is logged as an observation in P6-DC-20 item 6, but it is a real gap in the rule the module states for itself.
**Fix:** Send the root file through the same locator before reading it, and give it D-CF6-02's silent-skip treatment rather than a fatal one:
```ts
const located = await locateReference(".mcp.json", merge.pluginRoot);
if (located.kind === "inside") {
  await mergeServerFile(merge, located.absolutePath, ".mcp.json");
} else {
  logFileSkip(merge, ".mcp.json", "the file: it is reached through a link");
}
```
If following the root link is a deliberate choice, record it under a decision ID in the doc's Divergences section and correct the T-06-07 wording.

### WR-02: A symlinked reference inside the plugin root is fatal with a false "escapes plugin root" note, and the rewritten doc omits it

**File:** `extensions/pi-claude-marketplace/domain/mcp-resolution.ts:186-191`; `docs/mcp-compatibility.md:236-242`
**Issue:** `SymlinkRefusedError` extends `PathContainmentError`, so `resolveContainedComponentPath` reports every symlink as `cause: "escape"`. A reference `./servers.json` that is a link to `./real/servers.json`, inside the root, makes the plugin `(unavailable) {malformed mcp}` with the note `escapes plugin root: "./servers.json"`, which is false. Claude Code 2.1.316 follows the link and loads the servers (its refusal is the `must start with "./"` string check). D-CF6-04 says every row was re-measured. Yet the "Invalid server configs" section lists only "absolute or leaves the plugin root" as fatal, and the Divergences section has no symlink entry. A user who reads the doc cannot predict this refusal.
**Fix:** Either tell the symlink refusal apart from an escape in the note, for example `malformed mcp reference: crosses a link: "<raw>"`, by checking `error instanceof SymlinkRefusedError` in `locateReference`, and add a Divergences bullet citing D-14. Or follow links that resolve inside the root, which is upstream parity.

### WR-03: The file-source catch-alls swallow every error class, so a transient failure silently uninstalls servers on update, apply, or reload

**File:** `extensions/pi-claude-marketplace/domain/mcp-resolution.ts:143-152`, `176-180`
**Issue:** `mergeServerFile` wraps `statKind` + `readFileText` + `JSON.parse` in one bare `catch`, and `locateReference` turns any non-containment throw into `"unreachable"`. Both skip silently. That covers EMFILE, ENFILE, EIO, ELOOP, ENAMETOOLONG, and plain programming errors, as well as the "missing / unparseable / unreadable" cases that D-CF6-02 names. `resolveStrict` also feeds `update`, `apply` convergence, and the AMIG-01 move. In those flows, "contributes no servers" means "remove the installed servers", so a momentary fd exhaustion during `/claude:plugin update` drops every server of the plugin from `mcp-adapter.json`, and the update reports success. This is logged as a choice (P6-DC-18 item 2, P6-DC-08 item 6). The defect is how wide the catch is: upstream's quoted loader branch (`if(z(G))return null; t(...,{level:"error"})`) at least tells its classes apart and logs at error level.
**Fix:** Skip only the classes the decision names, and rethrow the rest so the existing probe classifier reports them:
```ts
const SKIPPED_IO = new Set(["ENOENT", "ENOTDIR", "EISDIR", "EACCES", "EPERM"]);
} catch (error: unknown) {
  if (error instanceof SyntaxError || SKIPPED_IO.has((error as NodeJS.ErrnoException).code ?? "")) {
    logFileSkip(merge, file, `the file: ${errorMessage(error)}`);
    return;
  }
  throw error;
}
```
Separate the `JSON.parse` call from the I/O so a `SyntaxError` from a parse is the only `SyntaxError` admitted.

### WR-04: The AMIG-01 notice says the plugin "no longer declares" a server it still declares

**File:** `test/integration/mcp-migration.test.ts:631-670` (assertion at `661`)
**Issue:** The new test pins the user-visible line `broken (hello) [project] hello no longer declares it.` for a server that is still in the plugin's `.mcp.json` and was only skipped as malformed. The phase's own position (D-CF6-02, P6-DC-18 item 1) is that a malformed file server is dropped silently, as upstream does. Instead, the move shows a message whose reason is false and that points the user at the wrong cause. `docs/mcp-compatibility.md:422` documents the wording, so the doc and the test agree on a misleading message. P6-DC-17 item 4 says this was inferred, not run, and this test now runs it.
**Fix:** In the move, report a server that the resolver skipped (the plugin still names it, but no file source yielded a valid config) under the existing `malformed mcp` reason, or leave it out of the "no longer declares" bucket. Then update the test and doc line 422 together. If the wording is kept on purpose, log it as a dubious choice with this exact text.

### WR-05: The WLIF-01 "undo before the workflows phase ran" test can no longer reach the branch it names

**File:** `test/orchestrators/plugin/install-flow-ledger.test.ts:17803-17840`
**Issue:** The rewritten arrange puts an inline malformed server in `plugin.json` and keeps the comment that the mcp phase fails "with `workflowsPrep` still undefined and the workflows undo reaching its early return". An inline malformed server makes `resolveStrict` return `unavailable` (`install-outcome.ts:779-782`), and `requireInstallable` throws before `runPhases` runs. No phase runs, so the workflows undo (`install-outcome.ts:1510-1513`) is never called. Even if the mcp phase threw, TR-02 does not undo a phase that never started. The assertions (`status === "failed"`, empty saved dir) pass whether or not the early return exists, so the test cannot fail for the reason its title states. The old `{ not json` arrange had the same gap, and this phase rewrote the comment to repeat the false claim.
**Fix:** Reach the branch directly. Make the workflows phase's own `do` throw before it assigns `workflowsPrep`, for example by mocking `prepareWorkflowsStaging` to reject. TR-02 then runs that phase's undo with `workflowsPrep === undefined`. Assert that the undo did not throw and that no rollback partial was recorded. Otherwise, retitle the test to what it does prove: that an unavailable plugin saves no workflow.

### WR-06: The loopback HTTP stand-in poisons its log chain on one bad request and raises an unhandled rejection

**File:** `features/lib/mcp-server-http.ts:175-177`, `215-243`
**Issue:** `answer` is fired with `void this.answer(...)`. If `parseMessage` throws (a non-JSON body, a JSON-RPC batch array, or a `null` body), if `bodyOf` rejects (the client aborts mid-body, or `closeAllConnections` cuts a request in flight), or if `appendFile` fails, three things go wrong:
1. `entry` rejects, `this.appended` becomes a rejected promise, and every later request's `.then` callback is skipped, so no later request is logged or answered.
2. The rejection of `answer` is unhandled, which under Node's default `--unhandled-rejections=throw` kills the cucumber worker and hides the scenario's real failure.
3. The HTTP response is never written, so the adapter's client hangs until its own timeout.
Because `close()` awaits the poisoned `this.appended`, the release also rejects. Also, for a non-POST request `body` is created and never awaited, so its rejection is unhandled too.
**Fix:** Keep the chain alive, answer every request, and surface the failure through the release instead of the process:
```ts
server.on("request", (request, response) => {
  this.answer(request, response).catch((error: unknown) => {
    this.failure ??= error;
    if (!response.headersSent) response.writeHead(500).end();
  });
});
// in answer(): this.appended = entry.then(() => undefined, () => undefined);
// in close(): if (this.failure !== undefined) throw this.failure;
```
For a non-POST request, consume or discard `body` with `void body.catch(() => undefined)`.

### WR-07: Two absence checks depend on the registry probe winning a race against the server they rule out

**File:** `features/mcp-server/sources.feature:134-157`; `features/mcp-server/invalid-configs.feature:62-89`
**Issue:** "With a plugin.json, the marketplace entry's servers are ignored" proves that `d` is absent only by `d` not appearing in the settled registry. The Outline row "readable by nobody" does the same for `hidden`. Both scenarios wait only for the server that should exist (`h`, `good`). A server's tools reach the registry only after pi-mcp-adapter connects to it, lists its tools, and caches them. The stub writes its pid file only once Node has started, so after a regression a window exists in which `h` has finished, `d` has not yet written its pid file, and the probe's two 250 ms reads agree without `d`. The scenario then passes green with the regression present. The other source scenarios already avoid this by calling `mcp({})`, whose status list comes from the adapter's config and needs no connection.
**Fix:** In both scenarios, replace (or add to) the registry check with a scripted `mcp {}` call, and compare the whole status text, `MCP: 0/1 servers, 1 tools\n\n○ plugin_demo_h_ (...)`. A server the bridge wrote would then appear whatever the timing.

### WR-08: The override-survives-update scenario cannot tell "choice kept across a rewrite" from "entry never rewritten"

**File:** `features/mcp-server/lifecycle.feature:160-186`
**Issue:** The update moves only the version (`1.0.0` → `1.1.0`). The server definition stays byte-identical. If the update flow leaves an unchanged server entry alone, the user's `disabled: true` survives without D-08-01/D-08-02's carry-over code ever running. If it rewrites the entry, the carry-over is tested. The scenario passes either way, so it does not prove what its title claims. This is logged as P6-DC-14 item 3. It also leaves T-06-14's L1 check (P6-DC-20 item 5) resting on the same weak arrange.
**Fix:** Change the server definition in the `1.1.0` publication, for example its `STUB_TAG` as the "Updating a plugin replaces its server" scenario does, so that the update must rewrite the entry. The `disabled` choice must then be carried into the new entry for the scenario to pass.

## Info

### IN-01: The array refusal branch is unreachable in production, and its note would not classify as `{malformed mcp}`

**File:** `extensions/pi-claude-marketplace/domain/mcp-resolution.ts:224-231` (note at `118-122`)
**Issue:** `PLUGIN_MANIFEST_VALIDATOR` and `PLUGIN_ENTRY_VALIDATOR` already reject an array element that is neither a string nor a map, so in production `readMcpArray`'s refusal is reached only by tests that bypass validation. If it is ever reached, its note `malformed mcpServers: must be object` falls through `probe-classifiers.ts` to `{unsupported source}`, because the `malformed mcp server ` arm needs the trailing space. That contradicts the doc's "inline defect → `{malformed mcp}`".
**Fix:** Either drop the branch and rely on the schema, or emit a note with a prefix the `malformed mcp` arm matches.

### IN-02: Bundle detection is case-sensitive and flags a bundle path that does not exist

**File:** `extensions/pi-claude-marketplace/domain/mcp-resolution.ts:64-66`, `214-217`
**Issue:** `./Server.MCPB` is read as JSON, fails to parse, and is skipped silently. The plugin installs as `installable` with no `{unsupported mcp}` marker. A reference to a missing `./x.mcpb`, on the other hand, still marks the plugin partially available.
**Fix:** Compare `path.extname(raw).toLowerCase()`, and decide whether a missing bundle should count, to match upstream.

### IN-03: A non-file `.mcp.json` or reference is skipped with no debug line

**File:** `extensions/pi-claude-marketplace/domain/mcp-resolution.ts:144-146`
**Issue:** A directory or FIFO at the path returns before `logFileSkip`, unlike every other skip path. It is then missing from the `PI_CLAUDE_MARKETPLACE_DEBUG=1` trace that D-CF6-02 relies on as its only diagnostic.
**Fix:** Call `logFileSkip(merge, file, "the file: it is not a regular file")` when `statKind` returns `"dir"`. A `null` that means "missing" can stay silent.

### IN-04: `resolveStrictMcp` repeats `McpResolutionDependencies` inline, and its JSDoc is mis-wrapped

**File:** `extensions/pi-claude-marketplace/domain/mcp-resolution.ts:290-309`
**Issue:** The `dependencies` parameter type is a copy of the module's `McpResolutionDependencies` interface (lines 36-39). The doc comment also breaks after "(D-CF6-02). The".
**Fix:** Type the parameter as `McpResolutionDependencies`, and reflow the comment.

### IN-05: The schema test pins TypeBox's internal JSON Schema object

**File:** `test/domain/components/mcp.test.ts:12-24`
**Issue:** `deepStrictEqual(MCP_SERVERS_SCHEMA, {anyOf: [...patternProperties: {"^.*$": {}}...]})` asserts how TypeBox represents `Type.Record` internally, not what the schema does. A TypeBox minor release can break it with no change in behavior. The accept/refuse cases that follow already cover the behavior.
**Fix:** Drop the structural assertion, or reduce it to `Compile(MCP_SERVERS_SCHEMA).Check` cases.

### IN-06: `McpHttpServer.start` never rejects when `listen` fails

**File:** `features/lib/mcp-server-http.ts:186-188`
**Issue:** The promise resolves on the `listen` callback only. An `'error'` event (EMFILE, or a loopback that is not available) leaves the Given hanging until the step timeout, with no cause shown.
**Fix:** `server.once("error", reject)` inside the same promise.

### IN-07: The mcp-resolution unit tests still touch the real filesystem for their fake roots

**File:** `test/domain/mcp-resolution.test.ts:69-120` and the other cases rooted at `/plugins/alpha`
**Issue:** `statKind` and `readFileText` are faked, but `locateReference` → `assertPathInside` uses the Node `lstat` inspector on `/plugins/alpha/...`. The outcome depends on that path being absent on the host, so these tests are not hermetic.
**Fix:** Root the fake plugins under a `mkdtemp` directory, or inject the path-safety guard.

### IN-08: The stub marker collides with a lone server named `stub`

**File:** `features/lib/mcp-server-files.ts:131-147`, `159-179`
**Issue:** Any object whose only key is `stub` is read as a marker. So `{"mcpServers": {"stub": {"stub": {}}}}` throws, and a fixture cannot write a wrapped file whose one server is named `stub`. This forced the server renames in P6-DC-13 item 5 and the wrapper-less root `.mcp.json` in P6-DC-14 item 1 (that scenario now also depends on a root-file form not checked on 2.1.316). The step fails loudly, so this is ergonomic, not silent.
**Fix:** Use a marker key that cannot be a server name, such as `{"$stub": {...}}`.

---

_Reviewed: 2026-11-01T18:18:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

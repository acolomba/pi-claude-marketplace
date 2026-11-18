# Phase 9: Adapter Entries and MCP Features - Pattern Map

**Mapped:** 2026-11-14
**Files analyzed:** 22 (new or modified)
**Analogs found:** 21 / 22

Every path below is relative to `/home/acolomba/src/pi-claude-marketplace-gaps-mcp`. `E/` = `extensions/pi-claude-marketplace/`. All analogs are git-tracked source.

Order the waves the way RESEARCH recommends: harness listing rule and stub resource mode first (Pitfall 1 blocks about 130 listing steps), then marker and adapter-entry with their owner tests, then expectation updates and new scenarios, then docs and records.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `features/lib/mcp-implementation.ts` (`listingDone` adapter arm) | test harness utility | polling | same function, builtin arm (`:499-504`) | exact |
| `features/step_definitions/hook/tool-use.steps.ts` (`hookStubListingDone` `:310-321`) | step helper | polling | `listingDone` builtin arm | exact |
| `features/lib/mcp-stub-server.ts` (opt-in resource mode) | test fixture server | request-response (JSON-RPC stdio) | same file `resultFor`/`initializeResult`/`STUB_TAG` | exact |
| `E/bridges/mcp/marker.ts` (widen `defaultFields`) | model/parser | transform | same file `isNumberRecord` `:52-54` | exact |
| `E/bridges/mcp/adapter-entry.ts` (`CARRIED_FIELDS`, `defaultFieldsFor`, `isRecordedDefault`) | bridge service | transform | same file, D-PG1-11 timeout default `:318-334` | exact |
| `E/domain/mcp-server-features.ts` (optional `adapterEntryDefaults`) | domain utility | transform | `defaultRequestTimeoutMs` `:66-86` | exact |
| `test/bridges/mcp/marker.test.ts` | test | - | own `defaultFieldsOf` table `:125-190` | exact |
| `test/bridges/mcp/adapter-entry.test.ts` | test | - | own `CARRIED_KEYS`, `STDIO_DEFAULT` consts `:76-96`; AFILE-06 case ~`:1009-1062` | exact |
| `test/domain/mcp-server-features.test.ts` (if domain fn) | test | - | existing `defaultRequestTimeoutMs` cases | exact |
| `test/bridges/mcp/stage.test.ts`, `test/orchestrators/plugin/{install-flow-ledger,update-flow,reinstall-flow,update-swap}.test.ts`, `test/orchestrators/reconcile/mcp-migration.test.ts`, `test/architecture/integration-materialization-gate.test.ts` (`:93-103`), `test/integration/mcp-*.test.ts` | test (byte pins) | - | their existing `requestTimeoutMs` pins | exact |
| `features/lib/mcp-server-files.ts` (widen earlier-release helper) | test fixture writer | file-I/O | `writeMcpAdapterEntryWithoutRequestTimeout` `:336-361` | exact |
| `features/step_definitions/mcp-server/lifecycle.steps.ts` (sibling user-edit steps) | step defs | file-I/O | request-timeout step `:32-39` | exact |
| `features/mcp-server/lifecycle.feature` (new D-PG9-11 scenarios) | behavioral test | - | `:393-562` timeout scenarios | exact |
| new resource guard scenarios (adapter + builtin; e.g. `features/mcp-server/resources.feature` or inside `invocation.feature`) | behavioral test | request-response | `invocation.feature` scripted-model scenarios | role-match |
| re-expected tables: `invocation`, `listing`, `lifecycle`, `configuration` (`@mcp`), `project-scope`, `agent-grants`, `companion-missing` (`:168` status row), `legacy-move` (8 texts), `features/plugin/subagent-child.feature` (4) | behavioral test | - | existing pins | exact |
| `docs/mcp-compatibility.md` (`:143-147`, `:314`, `:356`, `:629`, new "Features beyond tools") | docs | - | `:280` D-PG1 timeout paragraph | exact |
| `docs/output-catalog.md` (`:3058` lazy text) | docs | - | same paragraph | exact |
| `.planning/PROJECT.md` (D-PG9-01/07/08 rows, footer `:2690`) | record | - | D-PG1-11..13 rows `:2387-2389` | exact |
| `CHANGELOG.md` `[Unreleased]` bullet | record | - | timeout bullets `:9-10` | exact |
| `.planning/upstream/pi-mcp-adapter-per-server-sampling.md` (new) | upstream draft | - | `.planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md` (tracked); same shape as `pi-subagents-long-tool-names.md` | exact |
| `.planning/BACKLOG.md` (new sampling entry) | record | - | `## SIBLINGPREFIX-01` `:5321` | exact |
| `09-VALIDATION.md` guard rows | record | - | existing rows | n/a |

## Pattern Assignments

### `features/lib/mcp-implementation.ts` (Wave 0, harness)

**Analog:** the builtin arm of the same function (`:488-505`):
```typescript
async function listingDone(implementation, pi, harness, plugin, server): Promise<boolean> {
  if (!listedTools(await readStubRequests(harness), plugin, server)) {
    return false;
  }

  if (implementation === "adapter") {
    return (await stubPidFiles(harness)).length === 0;   // breaks under lazy-keep-alive
  }

  const { allTools } = await probedRegistry(pi);
  return allTools.some((tool) => isStubTool("builtin", tool.name, path.basename(plugin), server));
}
```
Change: drop the implementation split, so the adapter also waits for `tools/list` logged and a stub tool in Pi's registry (`isStubTool(implementation, ...)`). Check that `isStubTool` handles the adapter naming. Keep the failure message in `waitForStubListing` `:526-534`, which already dumps `requests` and `running`. Update the comments that state the old rule: the `listingDone` doc, `features/step_definitions/mcp-server/listing.steps.ts:139-142`, and the header of `mcp-stub-server.ts`. Prove the full adapter profile green on today's code before the default lands.

### `features/step_definitions/hook/tool-use.steps.ts` `:310-321`

Current copy of the rule:
```typescript
// True once the stub logged the adapter's `tools/list` for that server and no
// stub process is left, which means the adapter closed the listing.
async function hookStubListingDone(harness, plugin, server): Promise<boolean> {
  const requests = await readStubRequests(harness);
  const listed = requests.some(({ method, plugin: from, server: name }) =>
      method === "tools/list" && from === plugin && name === server);
  return listed && (await stubPidFiles(harness)).length === 0;
}
```
Replace the pid-file clause with the same registry rule. Prefer calling an exported helper from `mcp-implementation.ts` over a third copy, because fallow dupes fails on every clone group.

### `features/lib/mcp-stub-server.ts` (opt-in resource)

**Hooks to extend** (`:123-169`):
```typescript
function initializeResult(params: unknown): unknown {
  ...
  return { protocolVersion: version, capabilities: { tools: {} }, serverInfo: { name: "stub", version: "1.0.0" } };
}

// A non-empty `STUB_TAG` in the stub's environment prefixes the answer ...
function resultFor(method: unknown, params: unknown, tool: string): unknown {
  switch (method) {
    case "initialize": return initializeResult(params);
    case "tools/list": return { tools: [{ ...ECHO_TOOL, name: tool }] };
    case "tools/call": return callResult(params, tool);
    default: return {};
  }
}
```
Pattern: follow `STUB_TAG` (an env variable on the entry) or a fifth argv after `tool` (`:205` `const [, , plugin, server, tool = ECHO_TOOL.name] = process.argv;`). Only in resource mode, add `resources: {}` to capabilities and `resources/list` / `resources/read` arms. Use the measured shape: resource name `notes`, URI `stub://notes`, text `stub notes`. Keep `STUB_TOOL_NAMES` unchanged. With the resource on by default, every adapter table gains `resources/list` (Pitfall 3). Watch the complexity gates: one helper per method keeps `resultFor` flat.

### `E/bridges/mcp/marker.ts`

**Type** (`:31-32`):
```typescript
  /** D-PG1-13: default values this extension wrote, so a restage can recompute them. */
  readonly defaultFields?: Readonly<Record<string, number>>;
```
**Parser** (`:52-54`), which you replace:
```typescript
function isNumberRecord(value: unknown): value is Readonly<Record<string, number>> {
  return isPlainObject(value) && Object.values(value).every((member) => typeof member === "number");
}
```
Use RESEARCH Pattern 2 (`isScalar` + `isScalarRecord`). Widen every site: `readMarker` (`isNumberRecord(defaultFields)` ~`:91`), the `buildMarker` parts type (~`:112`), and `defaultFieldsOf` (~`:155`), which returns `Readonly<Record<string, number>>`. Keep the all-or-nothing rejection and the `Object.hasOwn` read. Name one exported alias (for example `MarkerDefault = number | string | boolean`) so `adapter-entry.ts` can share it. CONTEXT leaves the name to you.

### `E/bridges/mcp/adapter-entry.ts`

**Carried set** (`:41-64`). Append `protocolVersion`, `tasks`, `exposeResources`, `caFile`, and extend the comment to say why `caFile` is not a credential (D-PG9-05: a PEM path that can only narrow trust). Keep the existing comment style, which cites decision IDs:
```typescript
// ... No
// credential-bearing field is in the set, so a previous entry or a user stub
// never leaks one into the new entry. D-CF1-14: `appendStructuredContent` and
// `roots` have no Claude field, ...
const CARRIED_FIELDS = [ "disabled", ..., "appendStructuredContent", "roots" ] as const;
```
**Default site to generalize** (`:318-334`):
```typescript
/** D-PG1-11: fill only a timeout neither the plugin nor the user supplied. */
function defaultFieldsFor(entry, translated, carried): Readonly<Record<string, number>> {
  if (!isPlainObject(entry) || Object.hasOwn(translated, "requestTimeoutMs") || Object.hasOwn(carried, "requestTimeoutMs")) {
    return {};
  }
  const timeout = defaultRequestTimeoutMs(entry);
  return timeout === undefined ? {} : { requestTimeoutMs: timeout };
}
```
Replace it with the RESEARCH Pattern 1 loop. Key order is `requestTimeoutMs`, `lifecycle`, `openUi`, so existing byte pins only gain lines. **Do not** put the defaults in `translateMcpServer`. `pluginSetFieldsIn` (`:200-202`) would mark them plugin-set (Pitfall 2).

**Widen the parameter type** of `isRecordedDefault` (`:214-221`, `defaults: Readonly<Record<string, number>>`). The `===` comparison stays as it is.

No change is needed in `adapter-doc.ts`, `stage.ts`, `unstage.ts`, `legacy.ts`, or the orchestrators (RESEARCH reader table).

### `E/domain/mcp-server-features.ts` (discretion: recommended home of the table)

**Analog** (`:66-86`):
```typescript
/**
 * D-PG1-11: Claude Code 2.1.322 stops a call ... on a stdio server and 5 minutes on a remote server. ...
 */
export function defaultRequestTimeoutMs(server: Readonly<Record<string, unknown>>): number | undefined {
  switch (server.type) {
    case undefined:
    case "stdio":
      return STDIO_IDLE_TIMEOUT_MS;
    case "sse":
    case "http":
    case "streamable-http":
      return REMOTE_IDLE_TIMEOUT_MS;
    default:
      return undefined;
  }
}
```
Add `adapterEntryDefaults(server)` with the same switch, each arm a plain object literal (stdio: timeout + `lifecycle: "lazy-keep-alive"` + `openUi: false`; remote: timeout + `openUi: false`; other: `{}`). Use a doc comment that cites D-PG9-01/07 and pi-mcp-adapter 7.0.1. If `defaultRequestTimeoutMs` loses its last consumer, remove its `export` (fallow dead-code, D-P6-08 precedent) or keep it as the table's source. Domain may import only from shared/.

### `test/bridges/mcp/marker.test.ts`

The table-driven case list at `:125-190` (`satisfies ReadonlyArray<{ description: string; marker: unknown }>`, test title `` `D-PG1-13: returns no defaults for ${description}` ``). Move "a member containing a string" (`{ requestTimeoutMs: "1800000" }`) out of the rejected list (Pitfall 6). Add accepted cases for string and boolean members and a numbers-only legacy case. Keep null, array, nested object, inherited, and malformed as rejected. Title the new cases with `D-PG9-03`.

### `test/bridges/mcp/adapter-entry.test.ts`

Constants to extend (`:76-96`):
```typescript
const CARRIED_KEYS: readonly string[] = [ "disabled", ..., "roots" ];   // + the four new names
const STDIO_DEFAULT = { requestTimeoutMs: 1800000 };   // + lifecycle: "lazy-keep-alive", openUi: false
const REMOTE_DEFAULT = { requestTimeoutMs: 300000 };   // + openUi: false
const STDIO_MARKER = { ...MARKER, defaultFields: STDIO_DEFAULT };
```
Because the constants feed most pins, most cases update through them. Fix the AFILE-06 absorbed-credential case (~`:1009-1062`): `caFile` now becomes active (Pitfall 5). The every-key AFILE-06 test (~`:861`) picks up the new keys from `CARRIED_KEYS`. Add cases for these: a user `lifecycle`/`openUi` wins, a stdio-to-remote change drops `lifecycle`, and a user value equal to the default reads as the default.

### `features/lib/mcp-server-files.ts` (Pitfall 8)

**Analog** (`:336-361`):
```typescript
/** Writes an installed entry as an earlier release left it, before defaults had markers. */
export async function writeMcpAdapterEntryWithoutRequestTimeout(file, serverKey): Promise<string> {
  ...
  const entry: Record<string, unknown> = { ...servers[serverKey] };
  delete entry.requestTimeoutMs;
  if (isRecord(entry._piClaudeMarketplace)) {
    const marker: Record<string, unknown> = { ...entry._piClaudeMarketplace };
    delete marker.defaultFields;
    entry._piClaudeMarketplace = marker;
  }
  ...
  await writeFile(file, text);
  return text;
}
```
Widen it to also delete `lifecycle` and `openUi`, the 0.23.0 shape, and rename it with its step. Alternatively add a sibling, but a sibling risks a fallow clone, so widening is preferred. Keep the D-PG1-12 scenario's meaning. `writeMcpAdapterOverride` (`:313-334`) already merges arbitrary `fields` and needs no change.

### `features/step_definitions/mcp-server/lifecycle.steps.ts`

**Analog** (`:32-39`):
```typescript
Given(
  "the user has set the request timeout of the mcp server {string} to {int} ms in the mcp-adapter.json file of the {word} scope",
  async function (this: ScenarioWorld, key: string, timeoutMs: number, scope: string) {
    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    const written = await writeMcpAdapterOverride(file, key, { requestTimeoutMs: timeoutMs });
    assert.strictEqual(await readFile(file, "utf8"), written);
  },
);
```
Prefer one generic step over six siblings, for example `the user has set these fields of the mcp server {string} in the mcp-adapter.json file of the {word} scope:` with a docstring JSON object. This avoids fallow clones of the step body. Check the cucumber skill rules (`.agents/skills/cucumber/rules/`) for step grammar before you add it.

### `features/mcp-server/lifecycle.feature` (D-PG9-11 scenarios)

**Analog shape** (`:393-454`):
```gherkin
  @adapter-only
  Scenario: A request timeout the user wrote for a plugin server survives an update (PG-MCP-01, D-PG1-11)
    Given the published plugin "demo" of the marketplace "fixtures" has the file ".mcp.json" with these stub mcp servers:
      """
      {"mcpServers":{"kept":{"command":"pi-features-absent-mcp-server","args":["v1"]},"plain":{...}}}
      """
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given the user has set the request timeout of the mcp server "plugin_demo_kept_" to 45000 ms in the mcp-adapter.json file of the user scope
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.1.0   |
    ...
    When the user has run "/claude:plugin update demo@fixtures --scope user", which did not fail
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      { "mcpServers": { "plugin_demo_kept_": { ..., "directTools": "search", "toolPrefix": "mcp",
            "requestTimeoutMs": 45000, "_piClaudeMarketplace": { "plugin": "demo", "marketplace": "fixtures" } }, ... } }
      """
```
Also copy `:455` (stdio to remote, D-PG1-13), `:492` (disable then enable), and `:527-562` (earlier-release entry, then `reinstall`). Each new scenario gets `@adapter-only` and `(PG-MCP-06|PG-MCP-09|PG-SEC-03, D-PG9-xx)` in its title (cucumber rule `features.md:121`). Use the `pi-features-absent-mcp-server` fixture for pure file pins. In pins, new keys appear after `requestTimeoutMs` and before `_piClaudeMarketplace`, and the marker holds `defaultFields` with all three keys.

### Resource guard scenarios (PG-MCP-08, D-PG9-10)

Use the measured call shapes from RESEARCH "Measured resource call shapes". These steps already exist and can be reused: `Given the scripted model plays these steps:` (`features/step_definitions/model.steps.ts:85`), `Then the model receives these calls:` (`:97`), and for builtin `Then the model receives these calls, with each tool search reduced to the tools it loads:` (`builtin-tool-search.steps.ts:18`). Adapter tool `mcp__plugin_demo_<server>__read_notes` through `mcp`. Builtin uses `tool_search {"query":"read_mcp_resource"}` and then `read_mcp_resource {"server":..., "uri":"stub://notes"}`. Tag them `@adapter-only` and `@builtin-only`, with PG-MCP-08 in the title. They are guards, and VALIDATION must record them as guards.

### Re-expected scenario tables (Pitfall 4)

Under `lazy-keep-alive` the startup listing connection serves the first call, so each adapter stub-message table loses its second `initialize`/`notifications/initialized`/`tools/list` rows, and the `initialize` capabilities lose `"extensions":{"io.modelcontextprotocol/ui":...}`. The scenarios are listed in RESEARCH Pitfall 4. Measure each one again rather than hand-editing it. The `companion-missing.feature:168` row `cached, connects on first use` probably becomes `connected`, which RESEARCH marks ASSUMED, so re-measure it. Builtin tables do not change.

### `docs/mcp-compatibility.md`

**Analog paragraph** (`:280`), which states the D-PG1 default, its marker, precedence, and restage paths, and cites the scenario file. Write the new lifecycle and `openUi` text the same way. Edit these places: `:143` ("never writes `lifecycle`", ANAME-05), `:147`, `:314` (only if wording conflicts), `:356` (carried list, add the four fields), `:629`, and the lazy-status text at `:605`. Add a `## Features beyond tools` section, using the table in RESEARCH `:533-546` with an evidence cell each. Cite D-PG9-08 for sampling. Write in the simple-english, Plain style the existing page uses.

### `.planning/PROJECT.md`

**Analog row** (`:2387`):
```
| **D-PG1-11 (parity-gaps, Phase 1, maintainer decision on 2026-11-11, amends ANAME-07 only by the default): adapter timeout precedence**: <premise + versions>. | See `phases/01-companion-floors-and-mcp-defaults/01-CONTEXT.md`. | -- Locked |
```
Append D-PG9-01 (title says "amends ANAME-05"), D-PG9-07, and D-PG9-08. Title each "pending maintainer review" and cite pi-mcp-adapter 7.0.1. Use a status of `-- Pending` instead of `-- Locked`. Update the footer `:2690` `_Last updated..._`. Do not edit the archived `mcp-4-REQUIREMENTS.md`. Optionally add "(ANAME-05 amended by D-PG9-01)" to the Validated bullet at `:1428-1434`.

### `CHANGELOG.md`

**Analog** (`:9-10`):
```
  - A plugin MCP server without a `timeout` now allows a silent call for 30 minutes with stdio or 5 minutes with a remote server. Your `requestTimeoutMs` in `mcp-adapter.json` still wins.
  - An installed plugin gets the default at its next update or reinstall under pi-mcp-adapter, ...
```
Add one sub-bullet in the same voice. It covers the stdio keep-alive, `openUi: false`, the four kept fields, and "run `reinstall` once". Describe what changed, not how (memory: aggregate, what not how).

### `.planning/upstream/pi-mcp-adapter-per-server-sampling.md` (new)

**Analog header** (`.planning/upstream/pi-subagents-long-tool-names.md:1-8`):
```markdown
# pi-subagents: granted adapter tool names over 64 characters

Patch: no patch exists; this report is not filed.
Repository: https://github.com/nicobailon/pi-subagents
Package version: 0.88.0, measured 2026-11-11.

## Problem: ...
```
Use the same layout: a title, Patch/Repository/Package version lines (pi-mcp-adapter 7.0.1, measured 2026-11-14), the problem with `init.ts:184-186`, `server-manager.ts:1511-1528`, and `sampling-handler.ts:166-176`, then the request (a per-server `sampling` field, as `openUi` has). Verify the adapter's repository URL from the package's `package.json`, and do not guess it.

### `.planning/BACKLOG.md`

**Analog** (`:5321-5323`):
```markdown
## SIBLINGPREFIX-01: a sibling skill link rewrite matches a folder-name prefix

Noted 2026-11-14 (parity-gaps, Phase 4 verification, PG-SKILL-04 unclassified edge). <what, why, fix option>.
```
New entry, for example `## MCPSAMPLING-01: withhold sampling from plugin servers once pi-mcp-adapter has a per-server switch`. Its trigger is a published adapter release with that switch, and it cites D-PG9-08 and the upstream draft. Append it at the end of the file.

## Shared Patterns

- **Decision-ID comments:** comments and test titles cite `D-PG9-xx`, `PG-MCP-0x`, and `PG-SEC-03`, never phase or plan numbers (CONVENTIONS).
- **Marker as the source of what the extension wrote:** values go through `defaultFieldsOf`/`readMarker`. A default is recorded in `defaultFields` and recomputed when it equals the recorded value (`isRecordedDefault`).
- **Complexity:** loop over a fixed table instead of adding branches. Both sonarjs and fallow enforce a cognitive limit of 15.
- **Duplication:** fallow dupes fails on any clone. Generalize the existing helper or step, and do not copy it.
- **Hermetic tests:** owner tests run under `test/platform/isolated-pi-home.ts`, and scenarios run in the cucumber world. Never touch the real `~/.pi/agent`.
- **Byte pins:** every `mcp-adapter.json` text pin and integration byte pin gains `lifecycle`/`openUi` lines after `requestTimeoutMs`, plus the widened `defaultFields`.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| "Features beyond tools" table in `docs/mcp-compatibility.md` | docs | No per-feature by implementation matrix exists yet. Use RESEARCH `:533-546` as the content source, and the page's existing table style for the format. |

## Metadata

**Analog search scope:** `E/bridges/mcp`, `E/domain`, `features/lib`, `features/step_definitions`, `features/mcp-server`, `test/bridges/mcp`, `.planning/upstream`, `.planning/BACKLOG.md`, `.planning/PROJECT.md`, `CHANGELOG.md`, `docs/mcp-compatibility.md`
**Files scanned:** ~16
**Pattern extraction date:** 2026-11-14

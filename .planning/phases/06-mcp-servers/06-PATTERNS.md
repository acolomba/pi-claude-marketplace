# Phase 6: MCP Servers - Pattern Map

**Mapped:** 2026-11-01
**Files analyzed:** 20
**Analogs found:** 19 / 20

Scope: Phase 6 ownership (ROADMAP row 6, D-CF6-06) plus the out-of-ownership test edits that the CONTEXT amendments name (`test/domain/plugin-resolver.test.ts`). These files are frozen and must not be edited: `features/lib/mcp-stub-server.ts`, `features/lib/mcp-configuration.ts`, `features/step_definitions/mcp-configuration.steps.ts`, the scripted model, the registry probe, `features/lib/published-marketplace.ts`, `features/lib/agent-files.ts` (owned by Phase 4), and `features/support/world.ts`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `features/mcp-server/listing.feature` (06-01) | test (feature) | event-driven | `features/mcp-server/invocation.feature` | exact |
| `features/step_definitions/mcp-server/listing.steps.ts` (06-01, shared steps) | test (steps) | request-response | `features/step_definitions/mcp-server/calls.steps.ts` | exact |
| `features/lib/mcp-server-files.ts` (06-01, extend) | utility (fixture writer) | file-I/O | itself, lines 30-55 | exact |
| `features/mcp-server/configuration.feature` (06-02) | test | event-driven | `invocation.feature`, scenario 3 (`${PI_CM_STUB_TAG:-...}`) | exact |
| `features/step_definitions/mcp-server/configuration.steps.ts` (06-02) | test | request-response | `calls.steps.ts` lines 93-121 | exact |
| `features/lib/mcp-server-http.ts` (06-02, new loopback Streamable HTTP stand-in) | utility (server) | request-response | `features/lib/npm-registry.ts` `NpmRegistry` lines 100-135, 207-213 | role-match |
| `extensions/pi-claude-marketplace/domain/mcp-resolution.ts` (06-02) | service (domain) | transform | itself | exact |
| `extensions/pi-claude-marketplace/domain/components/mcp.ts` (06-02, if needed) | model (schema) | transform | itself | exact |
| `test/domain/mcp-resolution.test.ts` (06-02) | test (unit) | transform | itself | exact |
| `test/integration/mcp-migration.test.ts` (06-02) | test (integration) | file-I/O | itself plus `test/integration/mcp-plugin-seed.ts` | exact |
| `test/domain/plugin-resolver.test.ts` (06-02, OUT OF OWNERSHIP; MCPR-03 lines 1744-1830, 1986, WR-03 line 1809, entry-wins around 2048, MM-5) | test | transform | itself | exact |
| `features/mcp-server/invocation.feature` (06-03, the seed stays, the project scenario moves out) | test | event-driven | itself | exact |
| `features/step_definitions/mcp-server/invocation.steps.ts` (06-03) | test | request-response | `calls.steps.ts` | exact |
| `features/mcp-server/companion-missing.feature` (06-04) | test | event-driven | `invocation.feature` + `/claude:plugin install ..., which warned` | role-match |
| `features/mcp-server/project-scope.feature` (06-04) | test | event-driven | `invocation.feature` scenario 2 (move it here verbatim) | exact |
| `features/step_definitions/mcp-server/project-scope.steps.ts` / `companion-missing.steps.ts` (06-04) | test | request-response | `features/step_definitions/companion.steps.ts` lines 30-90 | role-match |
| `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts` (06-04, only if a break appears; pi-mcp-adapter arm only, `COMPANION_MCP` line 52) | utility | request-response | itself | exact |
| `features/mcp-server/lifecycle.feature` + `lifecycle.steps.ts` (06-05) | test | event-driven | `features/skill/lifecycle.feature` (Background + per-verb scenarios) | role-match |
| `extensions/pi-claude-marketplace/bridges/mcp/**` (06-05, only on a measured break; none measured) | service | file-I/O | itself | n/a |
| `docs/mcp-compatibility.md` (06-06) | docs | n/a | itself | none needed |

## Pattern Assignments

### `features/mcp-server/*.feature`

**Analog:** `features/mcp-server/invocation.feature` (all scenarios). Copy these:
- The feature preamble names the stand-ins ("A stdio stub server stands in for a real one, a scripted model for a real model, and a local marketplace for a published one.").
- The Given chain: `the marketplace "fixtures" is published as a dir source`, then `offers these plugins:` (table `name | version`), then `the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub"`, then `is added to the user scope`, then `the user has run "/claude:plugin install demo@fixtures --scope user", which warned`, then `pi runs with the scripted model and these companions:` (table `companion`), then `pi-mcp-adapter has listed the tools of the stub mcp server "stub" of the plugin "demo"`, then `the scripted model plays these steps:` (`reply | tool | arguments`).
- Whole-literal Thens: `the stub mcp server ... receives these messages:` (`kind | method | params`, which includes the two adapter 7.0.0 startup connections), and `the model receives these calls:` (`call | role | text`, where the last row is `tool result | mcp returned: echo:ping`).
- A changed tag shows up as `mcp returned: late:echo:ping`. This is the way to observe env, argv, and a replaced version (D-CF6-06, D-CF6-09).
- Untrusted project: `pi runs with the scripted model and these companions in an untrusted project:` (`companion.steps.ts` lines 76-85).
- Lifecycle layout: copy `features/skill/lifecycle.feature` lines 1-40. A `Background:` installs the plugin, and each scenario runs one verb (`Given the user has run "/claude:plugin disable demo@fixtures --scope project"`) and then starts a new session (D-CF6-11).

### `features/step_definitions/mcp-server/listing.steps.ts` (and the other new step modules)

**Analog:** `features/step_definitions/mcp-server/calls.steps.ts`. That file stays frozen for wave 2 per RESEARCH, so every new phrase goes in a new module. Do not register the same phrase twice.

Header plus imports (lines 1-36). Follow the import order builtin, then `@cucumber/cucumber`, then `../../lib/*`, then type imports last:
```ts
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { publishStubMcpServer, stubMcpFileText } from "../../lib/mcp-server-files.ts";
import { readStubRequests, stubPidFiles } from "../../lib/mcp-stub-server.ts";
import { projectTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf } from "../../lib/scripted-model/script.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { ScenarioWorld } from "../../support/world.ts";
```
Fixture-Given shape (lines 84-91): write the file, then assert that it reads back whole.
```ts
Given(
  "the published plugin {string} of the marketplace {string} has the stub mcp server {string}",
  async function (this: ScenarioWorld, plugin: string, name: string, server: string) {
    const stub = { plugin, server };
    const file = await publishStubMcpServer(this.requirePublished(name), stub);
    assert.strictEqual(await readFile(file, "utf8"), stubMcpFileText(stub));
  },
);
```
Profile-Pi launch with an extra env (lines 107-121): `writeLaunchEnvironment` + `this.onRelease(() => rm(file, { force: true }))` + `this.usePiWithProfile({ companions: ["pi-mcp-adapter"], extraExtensions: [PI_LAUNCH_ENVIRONMENT_EXTENSION] })`, then assert `readAppliedLaunchEnvironments`.
Poll-until-deadline wait (lines 38-41, 125-148): `TOOL_LISTING_TIMEOUT_MS = 15_000`, `POLL_MS = 50`, a `for (;;)` loop that ends in `assert.fail(JSON.stringify(...))`. Use this loop for the token-projecting listing wait and the empty-stub-log check of a blocked server.
Whole-table Then (lines 153-168): build `[[header...], ...rows]` and `assert.deepStrictEqual(..., table.raw())`. Project volatile ids with `projectTokens` and the `{tool call <n>}` replacement (lines 62-75). Copy that replacement into a new module if needed. Do not export it from the frozen file.

### `features/lib/mcp-server-files.ts` (extend)

**Analog:** itself. Add new writers that follow these shapes:
- An interface with readonly optional fields (lines 30-34): `StubMcpServer { plugin; server; env? }`. Add `args?`, `headers?`, `url?` for the HTTP variant, and so on.
- A pure `*Text` function that returns `${JSON.stringify(value, null, 2)}\n` (lines 37-44). The command is `process.execPath` and the args are `[MCP_STUB_SERVER, plugin, server]`.
- Writers go only through the frozen `writePublishedPluginFile(published, plugin, relPath, text)` (`published-marketplace.ts:698`, which writes with `flag: "wx"`), and `writePublishedPluginFiles` for several files at once (line 719). This covers the manifest `.claude-plugin/plugin.json` `mcpServers` in object, `./` path, and array form, the referenced files, and the agent file for D-CF6-07.
- Exported constants such as `LATE_TAG_ENVIRONMENT` (lines 22-24) each carry a decision-ID doc comment.

### `features/lib/mcp-server-http.ts` (new loopback Streamable HTTP MCP)

**Analog:** `features/lib/npm-registry.ts`, class `NpmRegistry`:
```ts
static async start(): Promise<NpmRegistry> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("the npm registry has no TCP address");
  }
  return new NpmRegistry(server, `127.0.0.1:${address.port}`);
}
// constructor: server.on("request", (req, res) => { void this.answer(req, res); });
// private readonly log: NpmRegistryRequest[] = [];
async close(): Promise<void> {
  const closed = once(this.server, "close");
  this.server.closeAllConnections();
  this.server.close();
  await closed;
}
```
Lifetime: `features/support/world.ts:347-375` (`useNpmRegistry`) is the world-owned analog, but world.ts is frozen. The Phase 6 step should start the server itself and call `this.onRelease(() => server.close())`, the same release hook that `calls.steps.ts:112` uses. Log each request's method, params, and headers the same way `NpmRegistryRequest` does (line 40). Other loopback analog: `features/lib/https-git-host/server.ts`.

### `extensions/pi-claude-marketplace/domain/mcp-resolution.ts` (FG-27 merge, FG-28 silent skip)

**Analog:** itself. The current code is first-match and has to become a merge:
- Line 169: `const declaredMcp = input.entry.mcpServers ?? input.manifest?.mcpServers;`. Replace this with an ordered union: `.mcp.json` first, then the manifest `mcpServers` (object, string, or array in order). The entry counts only when `manifest === null`. A later same-name server replaces the earlier one. Build maps with `Object.fromEntries` to keep the `__proto__` safety (lines 51-53).
- `readStandaloneMcp` (lines 80-102) already accepts wrapped and unwrapped maps. Its parse failure (lines 96-100) returns `{ok:false}` and turns into an `(unavailable)` note at lines 183-186. Under D-CF6-02 it changes to a silent drop. The read failure (EACCES, line 91) currently propagates and also becomes a silent drop.
- `readReferencedMcp` (lines 123-154): a missing file (134), invalid JSON (148-152), and a missing wrapper (140-145) become a silent drop or an unwrapped accept. An absolute path or `..` (`validateReferencePath`, lines 104-121) stays `malformed mcp reference` and fatal.
- `recordMcpServers` (lines 32-60) classifies each server through `classifyMcpServer`. A malformed server pushes a note and returns `true`, which is fatal. Keep this for inline (manifest/entry) sources. For file sources, drop the server silently.
- Constraints: cognitive complexity of 15 or less under both ESLint and fallow. The dependencies object `{ statKind, readFileText }` stays injected (lines 20-23). No network imports (BLOCK F).

### `test/domain/mcp-resolution.test.ts`

**Analog:** itself. Lines 9-43 hold the `OwnerShape` type-only owner import, `emptyResolution()`, and `mcpFiles(files)`, an in-memory `statKind`/`readFileText` fake that rejects with `ENOENT`. Each test has `// arrange` / act / assert sections and loads the owner with a dynamic `await import(...)` inside `assert.doesNotReject` (lines 45-53). These tests pin the old rule and must be rewritten: "prefers entry MCP and falls back to manifest MCP" (line 98), the propagate and EACCES tests (lines 334-401), and "classifies malformed JSON content in a standalone document" (line 403). 100% direct coverage of `mcp-resolution.ts` is required.

### `test/domain/plugin-resolver.test.ts` (out of ownership, minimal edit)

Rewrite only these tests: MCPR-03 (lines 1744, 1762, 1784, 1986), WR-03 (1809), the entry-wins MCP test near line 2048, and MM-5 where it asserts MCP. Do NOT touch the DFEN-02 "entry wins" tests (lines 1423, 1450); they cover `defaultEnabled`, not MCP. The plan needs a `git diff --stat` / hunk-limited acceptance criterion and a P6-DC entry.

### Project scope / companion-missing steps

**Analog:** `features/step_definitions/companion.steps.ts` lines 30-85. `startWithCompanions(world, table, trust)` already supports `"trusted" | "untrusted"`. `pi-mcp-adapter allows project mcp servers for the user` (`mcp-configuration.steps.ts` around line 30, frozen) is reused as-is. Command output assertions reuse `command.steps.ts` lines 55-77 (`the user has run {string}`, `, which warned`, `the user runs {string}`).

## Shared Patterns

- **Release:** every fixture or process a step creates registers `this.onRelease(...)` (`calls.steps.ts:112`).
- **Whole literals:** a Then compares the full table or docstring with `assert.deepStrictEqual(..., table.raw())`. Never use a subset match.
- **Write then read back:** a fixture Given asserts the text it wrote.
- **Comments cite IDs** (D-CF6-NN, FG-NN, MCP-NN), never phase or plan numbers.
- **Product errors/notes:** use the existing `notes.push("malformed ...")` vocabulary. Add no new closed-set reason (D-CF6-01/02 amended).

## No Analog Found

| File | Reason |
|---|---|
| Streamable HTTP MCP protocol handling inside `mcp-server-http.ts` | No HTTP MCP server exists. Only the HTTP lifecycle comes from `NpmRegistry`; the JSON-RPC answers (initialize/tools/list/tools/call) should mirror what `mcp-stub-server.ts` answers over stdio (read it, do not edit it). |

## Metadata

**Search scope:** `features/**`, `extensions/pi-claude-marketplace/domain/`, `test/domain/`, `test/integration/`.

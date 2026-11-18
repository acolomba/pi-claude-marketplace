# Phase 1: Companion Floors and MCP Defaults - Pattern Map

**Mapped:** 2026-11-11
**Files analyzed:** 9 new files or new units, 12 modified source files with an in-file pattern to follow
**Analogs found:** 9 / 9 (new), all tracked (`git ls-files` checked)

All paths are relative to the repository root. `EXT/` = `extensions/pi-claude-marketplace/`.
Line numbers were read on `features/gaps` at `4cb72b7f`.

The pure text edits (README, docs, CHANGELOG, BACKLOG, STACK.md, `scripts/pi.sh`, `ci.yml` comments,
`CONTRIBUTING.md`, the live canary constant) have no code pattern to copy. `01-RESEARCH.md` sections 1
and 8 list them with lines; this map does not repeat them.

## File Classification

### New files and new units

| New file or unit | Role | Data Flow | Closest Analog | Match Quality |
|------------------|------|-----------|----------------|---------------|
| Shared suite-version data file (a `.json` under `test/`; name is the planner's) | config | file-I/O (read by 3 readers) | `package.json` `peerDependencies` as read at `scripts/install-test-peers.mjs:36-52`, `test/integration/optional-peer.ts:72-94`, `features/lib/companions.ts:87-98` | role-match (no data file of this kind exists) |
| Gate case for that file in `test/architecture/peer-floor.test.ts` | test (architecture) | file-I/O | the same file, lines 94-107 and 150-166; path constants in `test/architecture/gate-targets.ts:30-33` | exact |
| `test/integration/<adapter naming conformance>.test.ts` (D-PG1-09) | test (integration, conformance) | transform | `test/integration/mcp-status-conformance.test.ts:43-61` (loader) and `test/integration/agents-builtin-grant-conformance.test.ts:49-64` (name table) | exact |
| `test/integration/<adapter grant conformance>.test.ts` (pi-subagents long-name gap) | test (integration, conformance) | transform | `test/integration/agents-builtin-grant-conformance.test.ts` (whole file, 170 lines) | exact |
| `@adapter-only` long-name listing scenario in `features/mcp-server/listing.feature` | test (cucumber) | request-response | `features/mcp-server/listing.feature:204-221` (its `@builtin-only` twin) | exact |
| `@adapter-only` long-name hook scenario in `features/hook/tool-use.feature` | test (cucumber) | event-driven | `features/hook/tool-use.feature:325-351` | exact |
| Long-name agent `excludeTools` scenario (in `features/agent/` or `features/mcp-server/agent-grants.feature`) | test (cucumber) | file-I/O | `features/lib/mcp-server-files.ts:286-303` (`publishMcpServerAgent`) plus `features/agent/frontmatter.feature:109-143` | role-match (no feature pins `excludeTools` today) |
| Default-timeout pair: `@builtin-only` in `features/mcp-server/builtin-values.feature`, `@adapter-only` in a `features/mcp-server/` file | test (cucumber) | file-I/O | `features/mcp-server/builtin-values.feature:8-24`; `features/mcp-server/legacy-move.feature:30-51` | exact |
| `Given` step for a user-written `requestTimeoutMs` (in `features/step_definitions/mcp-server/lifecycle.steps.ts`) and its scenario in `lifecycle.feature` | test (step definition) | file-I/O | `features/step_definitions/mcp-server/lifecycle.steps.ts:20-27`; `features/mcp-server/lifecycle.feature:301-330` | exact |
| Plugin stub MCP server with a settable tool name (new `features/lib/` module, or an option of the existing stub) | utility (test harness process) | streaming (stdio JSON-RPC) | `features/lib/hook-mcp-tool-server.ts` (tool name from argv) and `features/lib/mcp-stub-server.ts` (plugin/server argv, request log, pid file) | role-match (each has half) |
| `.planning/upstream/<pi-subagents long tool name>.md` | documentation (upstream report) | - | `.planning/upstream/pi-subagents-mcp-direct-tools.md` | exact |

### Modified production and harness files with an in-file pattern

| Modified file | Role | Data Flow | Pattern to follow (same file unless noted) | Match |
|---------------|------|-----------|--------------------------------------------|-------|
| `scripts/install-test-peers.mjs` | utility (script) | batch | `readFloors` 36-52 | exact |
| `test/integration/optional-peer.ts` | utility (test support) | file-I/O | `readPeerFloor` 86-94, `findCachedPeer` 101-119 | exact |
| `features/lib/companions.ts` | utility (harness) | file-I/O | `declaredFloor` 87-98, check at 124-129 | exact |
| `test/integration/pi-mcp-adapter-peer.ts` | utility (test support) | - | `PiMcpAdapterTypes` 73-77 | exact |
| `EXT/domain/mcp-implementation.ts` | model (domain profile) | transform | `builtinToolNamePrefix` 104-107, `builtinToolName` 118-132 | exact |
| `EXT/bridges/agents/convert.ts` | service (bridge) | transform | `excludeNameFor` 118-129; `MODEL_MAP` 60-67, `fullModelId` 345-347 | exact |
| `EXT/domain/components/hooks/builtin-mcp-tool-names.ts` | model (domain) | transform | `toolLiteralNames` 81-92, `serverPrefixNames` 100-104, `claudeFormToolName` 114-124 | exact |
| `EXT/domain/mcp-server-features.ts` | model (domain table) | transform | `serverFields` switch 188-200, `timeoutField` 139-143 | exact |
| `EXT/domain/mcp-builtin-translation.ts` | model (domain) | transform | `timeoutField` 63-65, key order 75-88 | exact |
| `EXT/bridges/mcp/marker.ts` | model (bridge) | transform | `pluginSetFields` member 25-30, `readMarker` 57-85, `buildMarker` 96-111 | exact |
| `EXT/bridges/mcp/adapter-entry.ts` | service (bridge) | transform | `carriedFields` 210-226, `stampServers` 312-344 | exact |
| `features/lib/upstream/subagents.ts` | utility (harness projection) | transform | `OWNED_ERROR_VALUE_PATTERN` 55-64, `projectError` 247-250 | exact |

## Pattern Assignments

### Shared suite-version data file and its three readers (config, file-I/O)

**Analogs:** the three places that compute "the version the suites run". Each must take the data
file's version when the peer has an entry and `minVersion(range)` otherwise. Change all three in
one commit (RESEARCH pitfall 1).

**Where the file can live.** `.pre-commit-config.yaml:106` (prettier) matches
`(extensions|features|rule-packs|test)/.*\.(js|json|ts)` and `:112` (npm-check) matches
`(extensions|features|rule-packs|test|\.github/workflows)/.*`. A `.json` under `scripts/` matches
neither. Tracked JSON under `test/` already exists (`test/e2e/pi-peer-floor/package.json`), so a
file under `test/` is a build input with no hook or `ci.yml` change.

**Reader 1** `scripts/install-test-peers.mjs:32-52` (plain `.mjs`, sync `readFileSync`, throws with
the package name):
```js
function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function readFloors() {
  const { peerDependencies = {} } = readJson(path.join(projectRoot, "package.json"));

  return peerNames.map((name) => {
    const range = peerDependencies[name];
    if (range === undefined) {
      throw new Error(`package.json declares no ${name} peer range`);
    }

    const floor = minVersion(range);
    if (floor === null) {
      throw new Error(`package.json declares no usable ${name} peer range: ${range}`);
    }

    return { name, version: floor.version };
  });
}
```
`readCutoff` (104-107) and `holdsFloors` (73-75) take the `{ name, version }` list unchanged, so
only `readFloors` and the header comment (lines 5-10: "the lowest version", "the newest floor's
registry publish time") change. The cross-file note convention is a one-line comment at line 26:
`// test/integration/optional-peer.ts reads this directory; change the two together.`

**Reader 2** `test/integration/optional-peer.ts:72-94, 101-119` (async `readFile` by URL relative to
`import.meta.url`):
```ts
async function readDeclaredPeerRange(packageName: string): Promise<string> {
  const manifest = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  ) as PeerManifest;
  const range = manifest.peerDependencies?.[packageName];
  if (range === undefined) {
    throw new Error(`package.json declares no ${packageName} peer range`);
  }

  return range;
}
```
```ts
  if (peer.version !== floor) {
    throw new Error(
      `${PEER_CACHE_NODE_MODULES} holds ${packageName} ${peer.version}, not the declared floor ${floor}. ${PEER_CACHE_REMEDY}`,
    );
  }
```
The header (lines 7-15) states PIFL-02 as "no separate constant can drift"; it and the
"not the declared floor" message need the D-PG1-02 wording. `test/integration/pi-subagents-peer.ts:9-11`
and `:25-26` repeat "the declared floor" for pi-subagents.

**Reader 3** `features/lib/companions.ts:83-98, 124-129`:
```ts
async function readJson(file: string | URL): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8"));
}

async function declaredFloor(packageName: string): Promise<string> {
  const manifest = (await readJson(REPOSITORY_MANIFEST)) as {
    readonly peerDependencies?: Readonly<Record<string, string>>;
  };
  const range = manifest.peerDependencies?.[packageName];
  const floor = range === undefined ? null : minVersion(range);
  if (floor === null) {
    throw new Error(`package.json declares no usable ${packageName} peer range`);
  }

  return floor.version;
}
```
The file reads the repository manifest through a module-level URL constant
(`const REPOSITORY_MANIFEST = new URL("../../package.json", import.meta.url);`, line 39). Its header
(lines 11-12) says `features/` may not import `test/integration/optional-peer.ts`, "so the floor
check is repeated here". Reading a JSON under `test/` by URL is a file read, not an import, and the
same shape as line 39. Not verified here: whether a gate also forbids `features/` from reading a
path under `test/`; the planner should check `check:features` and the fallow boundaries before it
fixes the location.

**Gate case** `test/architecture/peer-floor.test.ts:94-107` (arrange / act / assert comments, ID in
the title) and `:150-166` (loop over `COMPANION_PEERS`):
```ts
test("package.json declares the optional pi-subagents peer at >=0.84.0 and the lock root mirrors it (PIFL-02, VER-02)", async () => {
  // arrange
  const [pkg, lock] = await Promise.all([readPackageJson(), readPackageLock()]);

  // act
  const pkgRange = pkg.peerDependencies?.[SUBAGENTS_PEER];
  const lockRange = lock.packages?.[""]?.peerDependencies?.[SUBAGENTS_PEER];
  const meta = pkg.peerDependenciesMeta?.[SUBAGENTS_PEER];

  // assert
  assert.equal(pkgRange, ">=0.84.0");
  assert.equal(lockRange, pkgRange);
  assert.deepStrictEqual(meta, { optional: true });
});
```
Paths come from `test/architecture/gate-targets.ts` (`export const PACKAGE_JSON_REL = "package.json";`
at line 30, `PACKAGE_LOCK_REL` at 33) and are joined with `REPO_ROOT` from `./source-scan.ts`
(lines 6-7, 28-30). Add the new path as a `*_REL` constant there. The new case asserts
`semver.satisfies(suiteVersion, declaredRange)` and that only `pi-subagents` has an entry.

---

### `test/integration/<adapter naming conformance>.test.ts` (test, transform) -- D-PG1-09

**Analogs:** `test/integration/mcp-status-conformance.test.ts` (loads `dist/types.js`),
`test/integration/agents-builtin-grant-conformance.test.ts` (name fixtures, header style).

**File header pattern** (`agents-builtin-grant-conformance.test.ts:1-16`): first line is the path,
then the requirement ID, what is compared with what, and the optional-peer paragraph ("A missing or
wrong-version package fails the test. A run reports the proven version as a diagnostic.").

**Imports pattern** (`mcp-status-conformance.test.ts:21-23, 43-50`):
```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  findPiMcpAdapterPackage,
  loadPiMcpAdapterModule,
} from "./pi-mcp-adapter-peer.ts";

import type { PiMcpAdapterTypes } from "./pi-mcp-adapter-peer.ts";
```
Production import form (`agents-builtin-grant-conformance.test.ts:23, 27`): explicit `.ts`, relative,
type-only imports last:
`import { convertAgent } from "../../extensions/pi-claude-marketplace/bridges/agents/convert.ts";`

**Loader pattern** (`mcp-status-conformance.test.ts:58-61`):
```ts
async function loadAdapterTypes(): Promise<PiMcpAdapterTypes> {
  const peer = await findPiMcpAdapterPackage();
  return loadPiMcpAdapterModule<PiMcpAdapterTypes>(peer, "types");
}
```
`"types"` is already a member of the module union at `test/integration/pi-mcp-adapter-peer.ts:90`.

**Interface to extend** (`test/integration/pi-mcp-adapter-peer.ts:73-77`):
```ts
/** The `dist/types.js` constants the status conformance test reads. */
export interface PiMcpAdapterTypes {
  readonly MCP_STATUS_EVENT: string;
  readonly MCP_STATUS_SNAPSHOT_VERSION: number;
}
```
Add `readonly formatToolName: (toolName: string, serverName: string, prefix: "mcp" | ...) => string;`
(adapter signature in RESEARCH section 5).

**Version diagnostic** (`agents-builtin-grant-conformance.test.ts:117-119`):
```ts
  const peer = await findCachedPeer("pi-subagents");
  t.diagnostic(`pi-subagents ${peer.version} at ${peer.root}`);
```

**Test case shape** (`agents-builtin-grant-conformance.test.ts:129-150`): `test("<ID>: <sentence>", async (t) => {`
with `// arrange`, `// act`, `// assert`, one `assert.deepStrictEqual` over the whole result.
Fixture names: a module constant such as `const LONG_TOOL = "list_every_table_in_the_warehouse_with_row_counts";`
(line 49). Cases needed: joined lengths 64, 65, 84, and a tool name with `.` (the table in RESEARCH
section 5 gives inputs for each). Compare `types.formatToolName(tool, serverKey, "mcp")` with
`profileFor("adapter").toolName(plugin, server, tool)`.

The `test/integration/` root is exempt from source-test pairing, so the file needs no source pair.

---

### `test/integration/<adapter grant conformance>.test.ts` (test, transform) -- pi-subagents long-name gap

**Analog:** `test/integration/agents-builtin-grant-conformance.test.ts` (copy the structure whole).

**Module interface and loader** (lines 41-47, 116-127):
```ts
interface McpDirectToolAllowlistModule {
  readonly resolveMcpDirectToolResolution: (
    selectors: string[],
    cwd: string,
    host: ResolverHost,
  ) => unknown;
}
```
```ts
async function loadAllowlist(t: TestContext): Promise<McpDirectToolAllowlistModule> {
  const peer = await findCachedPeer("pi-subagents");
  t.diagnostic(`pi-subagents ${peer.version} at ${peer.root}`);
  return importPeerModule<McpDirectToolAllowlistModule>(
    peer,
    "src",
    "runs",
    "shared",
    "mcp-direct-tool-allowlist.js",
  );
}
```
The adapter twin adds the fourth `configOverride` argument (RESEARCH section 5, assumption A7) and
a host without the `builtin:mcp` command.

**Selectors from the real bridge** (lines 85-114): call `convertAgent({... mcpImplementation })`,
take the one `tools: ` line of `agent.fileContent`, split on `,`, strip `mcp:`.

**Host stand-in** (lines 29-39, 75-83): a `ResolverHost` literal with `events`, `getCommands`,
`getAllTools`.

**Temporary agent directory:** the twin needs a fixture `mcp-cache.json`. Use
`withHermeticEnvironment` from `test/platform/hermetic-environment.ts` (imported at
`mcp-status-conformance.test.ts:39`); never the real `~/.pi/agent`. The analog itself passes
`os.tmpdir()` as `cwd` (line 135) and writes nothing.

**Outcome:** the assertion pins what pi-subagents 0.88.0 returns. By source it returns the full
(uncut) name, so the test records a gap and is not a pass/fail of this project's rule; word the
title that way.

---

### Long-name listing scenario, `@adapter-only` (cucumber) -- PG-MCP-02

**Analog:** `features/mcp-server/listing.feature:204-221`:
```gherkin
  @builtin-only
  Scenario: A server whose tool names pass Pi's 64-character limit gets Pi's cut tool names, a Pi capability gap (BLT-04, D-MB-13)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "a-server-whose-name-runs-well-past-the-limit"
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "a-server-whose-name-runs-well-past-the-limit" of the plugin "demo"
    When the user lists the mcp tools pi offers
    Then pi lists these registered mcp servers:
      | name                                                     |
      | plugin_demo_a-server-whose-name-runs-well-past-the-limit |
    Then pi offers these plugin mcp tools:
      | tool                                                             | active |
      | mcp__plugin_demo_a_server_whose_name_runs_well_past_the_ca340f16 | no     |
```
Conventions: every setup line is `Given` (no `And`); tag on its own line above the scenario; the
title ends with the IDs in parentheses, and a divergence is named in the title ("a Pi capability
gap"). The adapter twin's expected tool for this fixture is
`mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c` (RESEARCH section 5, derived).
`Then pi lists these registered mcp servers:` does not apply under the adapter (see the
`@adapter-only` scenario at `listing.feature:146-147`, MSEL-03).

**Harness dependency:** `Then pi offers these plugin mcp tools:` filters through `isStubTool` in
`features/lib/mcp-implementation.ts:466-477`, which uses `name.startsWith(prefix)` and
`STUB_TOOL_NAMES` (`features/lib/mcp-stub-server.ts:155`). The 63-character prefix of this fixture
is not a prefix of the cut name, so the scenario fails until the adapter profile's `toolNamePrefix`
can return `undefined` (RESEARCH pitfall 5).

---

### Long-name hook scenario, `@adapter-only` (cucumber) -- D-PG1-08

**Analog:** `features/hook/tool-use.feature:325-351`:
```gherkin
  @adapter-only
  Scenario: A hook on a plugin MCP tool runs once per call through pi-mcp-adapter's proxy (D-CF5-12, MHK-02)
    ...
    Given the published plugin "hook-demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher                                 |
      | literal | PreToolUse  | mcp__plugin_hook-demo_stub-server__echo |
      | any     | PreToolUse  | *                                       |
      | after   | PostToolUse | *                                       |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks
    ...
    Given pi runs with the scripted model and these companions:
      | companion      |
      | pi-mcp-adapter |
    Given pi-mcp-adapter has listed the hooks' stub mcp server "stub-server" of the plugin "hook-demo"
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                     |
      |       | mcp  | {"tool": "mcp__plugin_hook-demo_stub-server__echo", "args": {"text": "ping"}} |
      | Done. |      |                                                                               |
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event       | session | tool name                               | tool input      | tool response                        | ...
```
The three hook rows (`literal`, `any`, `after`) are exactly the D-PG1-08 matrix: a full-name literal
on `PreToolUse`, `*` on `PreToolUse`, `*` on `PostToolUse`. With a long tool the `tool name` column
pins the full Claude Code name for `literal` and `after`, and for `any` whatever the recovery pass
yields (the full name here, because the `literal` hook of the same event spells it). A second
scenario with only `*` hooks pins the shortened name on `PreToolUse` as the recorded gap.

Step definitions: `features/step_definitions/hook/tool-use.steps.ts:84-108` (stub for hooks,
listing wait) and `:110-125` (`the scripted model calls the tool {string} of the hooks' stub mcp
server ... through the mcp implementation`, which builds the call through
`features/lib/hook-mcp-calls.ts:42` `profileFor(profile).toolName(...)`).

---

### Plugin stub MCP server with a settable tool name (utility, stdio)

**Analogs:** `features/lib/hook-mcp-tool-server.ts` (the settable name) and
`features/lib/mcp-stub-server.ts` (what a plugin stub must keep).

**What the listing and hook steps rely on from the plugin stub** (`mcp-stub-server.ts:170-210`): the
request log `<harness>/mcp-stub-requests.jsonl` with `plugin` and `server` on each record, the pid
file `mcp-stub-<pid>.pid`, exit on stdin close, and the argv contract:
```ts
if (process.argv[1] === MCP_STUB_SERVER) {
  const [, , plugin, server] = process.argv;
  if (plugin === undefined || server === undefined) {
    throw new Error("usage: mcp-stub-server.ts <plugin> <server>");
  }

  serve(plugin, server);
}
```
`hookStubListingDone` (`tool-use.steps.ts:72-83`) and `the mcp implementation has listed the tools
of the stub mcp server` both read that log, so a new stub without the log cannot use those steps.

**The settable tool** (`hook-mcp-tool-server.ts:49-73`): handlers take the tool name as a parameter:
```ts
  [
    "tools/list",
    (tool) => ({
      tools: [
        {
          name: tool,
          description: "Answers with its own name and the text it is given.",
          inputSchema: {
            type: "object",
            properties: { text: { type: "string" } },
            required: ["text"],
          },
        },
      ],
    }),
  ],
```
and the argv guard at 110-118 (`usage: hook-mcp-tool-server.ts <tool>`).

**Module conventions shared by both** (copy): a `@fileoverview` block that states the protocol and
cites the decision ID; an exported absolute path constant
(`export const MCP_STUB_SERVER = fileURLToPath(import.meta.url);`, `mcp-stub-server.ts:28`); a
fallback protocol version constant (`"2025-06-18"`); `process.stdout.write` of one JSON line per
reply (allowed in `features/lib`, which is outside the extension's `no-stdio` rule).

**Smallest route:** an optional third argument on the existing stub (`<plugin> <server> [tool]`,
default `echo`) keeps the log, the pid file, and every existing step. Two consumers must follow:
`STUB_TOOL_NAMES` (`mcp-stub-server.ts:155`, read by `features/lib/mcp-implementation.ts:44`) and
the entry builders that write the argv -- `stubServerEntry` at `features/lib/mcp-server-files.ts:73-83`:
```ts
  return {
    command: process.execPath,
    args: [MCP_STUB_SERVER, options.plugin ?? plugin, server],
    ...(options.env === undefined ? {} : { env: options.env }),
  };
```
and `hookStubMcpText` at `features/step_definitions/hook/tool-use.steps.ts:65-68`. A new module is
the alternative; it would duplicate the log and pid code, and `fallow dupes` fails on every clone
group. The existing fixture server `a-server-whose-name-runs-well-past-the-limit` already gives a
cut inside the server segment with tool `echo`; only a cut inside the tool segment needs the
settable name.

A new feature step that names the tool goes beside `tool-use.steps.ts:84-94`; `check:features`
fails on an unused step, so add it only with its scenario.

---

### Default-timeout scenarios (cucumber pair) -- PG-MCP-01, D-PG1-14

**Built-in analog:** `features/mcp-server/builtin-values.feature:8-24` (feature-level tag
`@builtin-only` at line 1):
```gherkin
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" with these fields:
      """
      {"timeout": 2500}
      """
    ...
    Given pi runs with the scripted model and a probe of the mcp servers registered with pi's built-in mcp
    Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"
    When the user asks pi for the configs of the mcp servers registered with it
    Then pi holds these mcp server configs, apart from each stdio server's command and arguments:
      | name             | config                                                                                                                                                                                     |
      | plugin_demo_stub | {"env":{"CLAUDE_PLUGIN_ROOT":"{home}/marketplaces/fixtures/plugins/demo","CLAUDE_PLUGIN_DATA":"{agent dir}/pi-claude-marketplace/data/fixtures/demo"},"timeout":2.5,"exposure":"deferred"} |
```
Steps: `features/step_definitions/mcp-server/builtin-values.steps.ts:32-41, 45-63, 69-84, 90-100`.
A no-timeout stdio row becomes `"timeout":1800`, a remote row `"timeout":300`. The other scenarios
of this file with no declared `timeout` (lines 26, 60, 83, 102) change their rows too. The remote
fixture is the `streamable-http` server at `builtin-values.feature:26-58`.

**Adapter analog:** `features/mcp-server/legacy-move.feature:30-51` with the step at
`features/step_definitions/mcp-configuration.steps.ts:139-147`:
```gherkin
    Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:
      """
      {
        "mcpServers": {
          "plugin_demo_srv_": {
            "command": "pi-features-absent-mcp-server",
            "args": [],
            "env": {
              "CLAUDE_PLUGIN_ROOT": "{home}/marketplaces/fixtures/plugins/demo",
              "CLAUDE_PLUGIN_DATA": "{agent dir}/pi-claude-marketplace/data/fixtures/demo"
            },
            "directTools": "search",
            "toolPrefix": "mcp",
            "_piClaudeMarketplace": {
              "plugin": "demo",
              "marketplace": "fixtures"
            }
          }
        }
      }

      """
```
The step compares the whole file after `projectTokens`, so the place of `requestTimeoutMs` in the
entry and of the new marker member is pinned; decide both once. These three `legacy-move.feature`
texts (lines 32, 153, 230) and `features/plugin/subagent-child.feature:98, 123` gain the default.

---

### `Given` step for a user-written `requestTimeoutMs` (step definition, file-I/O)

**Analog:** `features/step_definitions/mcp-server/lifecycle.steps.ts` (whole file, 27 lines):
```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { writeMcpAdapterOverride } from "../../lib/mcp-server-files.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The user's own edit of a plugin server's entry, under the key that
// pi-mcp-adapter shows for it, such as `plugin_demo_stub_`. The scenario
// observes the choice only through what pi-mcp-adapter does with it.
Given(
  "the user has disabled the mcp server {string} in the mcp-adapter.json file of the {word} scope",
  async function (this: ScenarioWorld, key: string, scope: string) {
    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    const written = await writeMcpAdapterOverride(file, key, { disabled: true });
    assert.strictEqual(await readFile(file, "utf8"), written);
  },
);
```
The new step is the same body with `{ requestTimeoutMs: <int> }` (use `{int}` in the step text).
`writeMcpAdapterOverride` (`features/lib/mcp-server-files.ts:313-333`) merges `fields` over the
existing entry and needs no change. Every setup step ends with a read-back assertion.

**Scenario analog:** `features/mcp-server/lifecycle.feature:301-330` ("A user's disabled choice for
a plugin server survives an update"): install, user edit, republish at `1.1.0` with a changed
`.mcp.json`, `update`, then observe. For the timeout the observation is the adapter file text
(`the mcp configuration file "mcp-adapter.json" ... holds this text:`), not a model call.

---

### `.planning/upstream/<pi-subagents long tool name>.md` (documentation)

**Analog:** `.planning/upstream/pi-subagents-mcp-direct-tools.md` (164 lines; its `.patch` sibling
is tracked beside it).

**Section order to copy:**
1. `# Upstream fixes for <package>: <topic>` then four header lines: `Patch:`, `Repository:`,
   `Base commit:` with date and package version, local branch (lines 1-9).
2. `## Problem N: <one line>` with the upstream source file and function named in backticks, what
   the adapter does, what pi-subagents does, the user-visible error text quoted (lines 11-20).
3. `### What ... means in the adapter`, `### Where pi-subagents reads ...` (evidence), `### Change
   (commit N)` as a bullet per file, `### Test` naming the test file and saying it fails without the
   change (lines 22-52).
4. Verification results as a bullet list that says what ran and what did not ("Not run: ...").
5. `## Changelog` with the upstream credit convention and the exact entry text in a `markdown` fence.
6. `## Draft PR` with `**Title:**` (conventional commit form) and `**Body:**` in a `markdown` fence.
7. `## Applying the patch` in a `sh` fence.
8. `## Not fixed here`.

For this phase the report is a draft with no patch: keep sections 1-2, the evidence subsections,
and the draft issue or PR text; state plainly that no patch exists. The evidence is in RESEARCH
section 5 ("pi-subagents 0.88.0 does not model the cut"): `src/runs/shared/mcp-direct-tool-grant.js:104-113`
and `child-tool-plan.js:245, 265-273`, against `pi-mcp-adapter@7.0.1` `types.ts:963-1003`. Sentences
are short and plain, no first-person narrative. This phase also edits the analog itself (line 8,
"`main` still has both bugs", is out of date: both shipped in 0.87.0).

RESEARCH open question 2 says to ask the user before drafting this report.

---

### `EXT/domain/mcp-implementation.ts` -- the adapter fit rule (D-PG1-07)

**Analog in the same file:** the built-in profile, lines 91-132. The constants already exist:
```ts
const MAX_TOOL_NAME_LENGTH = 64;
const TOOL_NAME_HASH_LENGTH = 8;
// A cut tool name keeps this many characters, then `_` and the hash.
const KEPT_TOOL_NAME_LENGTH = MAX_TOOL_NAME_LENGTH - TOOL_NAME_HASH_LENGTH - 1;
```
They are declared at 93-96, after `ADAPTER_PROFILE` (82-89); a module-level function that uses them
may sit anywhere, but the frozen profile object reads its functions at module evaluation, so keep
the constants above any top-level use.

**Prefix that may be absent** (104-107) -- copy for `adapterToolNamePrefix`:
```ts
function builtinToolNamePrefix(plugin: string, server: string): string | undefined {
  const prefix = `mcp__${foldedMcpServerKey(builtinMcpServerName(plugin, server))}__`;
  return prefix.length <= KEPT_TOOL_NAME_LENGTH ? prefix : undefined;
}
```
`AdapterMcpProfile` (53-56) narrows `toolNamePrefix` to `string`; drop the narrowing. Its only
readers are in `features/lib/` (`mcp-implementation.ts:466-477`); no production code calls it.

**Cut with a hash** (118-132) -- copy the tail; the adapter's hash input is the joined name itself:
```ts
  if (name.length <= MAX_TOOL_NAME_LENGTH) {
    return name;
  }

  const hash = createHash("sha256")
    .update(`${serverName}\0${tool}`)
    .digest("hex")
    .slice(0, TOOL_NAME_HASH_LENGTH);
  return `${name.slice(0, KEPT_TOOL_NAME_LENGTH)}_${hash}`;
```
**Today's adapter join** (72-80), which stays and is wrapped:
```ts
function adapterToolName(plugin: string, server: string, tool: string): string {
  const prefix = adapterToolNamePrefix(plugin, server);
  const sanitized = tool.replaceAll(".", "_");
  if (sanitized.startsWith(prefix) && sanitized.length > prefix.length) {
    return sanitized;
  }

  return `${prefix}${sanitized}`;
}
```
The join needs the full prefix even when the profile's public `toolNamePrefix` returns `undefined`,
so split the private "joined prefix" from the public "promised prefix". The doc comment at 67-71
cites "pi-mcp-adapter 7.0.0 `formatToolName`"; it is one of the comments this phase re-checks.
Export the fit function for the hooks domain module (D-PG1-07: one copy).

---

### `EXT/bridges/agents/convert.ts` -- `excludeNameFor` (D-PG1-10) and bare model IDs (D-PG1-04)

**`excludeNameFor`** (118-129): remove the adapter early return so both implementations take the
profile's name:
```ts
  if (id === "adapter") {
    return (token) => token;
  }

  const profile = profileFor(id);
  return (_token, tool) => profile.toolName(pluginName, server, tool);
```
The doc comment at 112-117 ("The adapter form keeps the Claude token verbatim") states the old rule
and changes with it. Check that `token` is still used by a caller before dropping the parameter.

**Model IDs:** `MODEL_MAP` (60-67) values and `fullModelId` (345-347) lose `anthropic/`:
```ts
function fullModelId(value: string): string | undefined {
  return value.startsWith("claude-") && !/[\s:]/.test(value) ? `anthropic/${value}` : undefined;
}
```

---

### `EXT/domain/components/hooks/builtin-mcp-tool-names.ts` -- matching a cut adapter name

**In-file pattern** (81-92, 100-104, 114-124). Each function branches first on
`tool.builtinServer === undefined`, the adapter / other-tool arm:
```ts
export function toolLiteralNames(literal: string, tool: McpToolIdentity): boolean {
  if (tool.builtinServer === undefined) {
    return literal === tool.piName;
  }
  ...
```
```ts
export function claudeFormToolName(tool: McpToolIdentity): string {
  if (tool.builtinServer === undefined) {
    return tool.piName;
  }
  ...
```
The adapter arm of `toolLiteralNames` also accepts a literal whose fitted form equals `tool.piName`
(import the fit function from `domain/mcp-implementation.ts`; `domain` to `domain` is a legal edge).
`claudeFormToolName` returns the recovered full name when the identity carries one. Callers:
`EXT/bridges/hooks/mcp-tool-view.ts:41-43, 138-151`, `EXT/bridges/hooks/dispatch.ts:154-168,
1049-1060`, `EXT/bridges/hooks/if-field/index.ts:550, 553`. Doc comments in this file cite the
decision (`D-P5-04 / D-P5-05`) in the first line; the new arm cites D-PG1-08.

---

### `EXT/domain/mcp-server-features.ts` and `EXT/domain/mcp-builtin-translation.ts` -- the default

**Switch to mirror** (`mcp-server-features.ts:188-200`):
```ts
function serverFields(server: Readonly<Record<string, unknown>>): Record<string, unknown> {
  switch (server.type) {
    case undefined:
    case "stdio":
      return { ...stdioFields(server), ...timeoutField(server.timeout) };
    case "sse":
      return { ...remoteFields(server), httpTransport: "sse", ...remoteOptions(server) };
    case "http":
    case "streamable-http":
      return { ...remoteFields(server), ...remoteOptions(server) };
    default:
      return {};
  }
}
```
Constants sit together at 56-61 (`MIN_TIMEOUT_MS`, `MAX_TIMEOUT_MS`, `MAX_REQUEST_TIMEOUT_MS`,
`SCREAMING_SNAKE_CASE` with `_` digit separators). Add the two idle constants there and an exported
`defaultRequestTimeoutMs(server)` with the same five cases; `translateMcpServer` stays unchanged
(RESEARCH: a default inside it would be read as plugin-set).

**Built-in side** (`mcp-builtin-translation.ts:63-65, 75-88`):
```ts
function timeoutField(requestTimeoutMs: unknown): { timeout?: number } {
  return typeof requestTimeoutMs === "number" ? { timeout: requestTimeoutMs / 1000 } : {};
}
```
```ts
    ...oauthField(adapter.oauth),
    ...timeoutField(adapter.requestTimeoutMs),
    exposure: server.alwaysLoad === true ? "direct" : "deferred",
```
Line 84 becomes `...timeoutField(adapter.requestTimeoutMs ?? defaultRequestTimeoutMs(server)),`.

---

### `EXT/bridges/mcp/marker.ts` and `EXT/bridges/mcp/adapter-entry.ts` -- the marker member (D-PG1-13)

**Optional marker member with a requirement-ID doc comment** (`marker.ts:25-30`):
```ts
  /**
   * The names of the carried fields the plugin's entry sets, never their
   * values (ANAME-07). Carry-forward skips them, and write-back restores the
   * kept override's own value for each of them (AFILE-06).
   */
  readonly pluginSetFields?: readonly string[];
```

**Validating read that never throws** (`marker.ts:77-84`): each optional member is taken with
`Object.hasOwn`, type-checked by a small guard (`isStringArray`, `isPlainObject`), and spread only
when valid:
```ts
  const pluginSetFields = Object.hasOwn(obj, "pluginSetFields") ? obj.pluginSetFields : undefined;
  const keptOverride = Object.hasOwn(obj, "keptOverride") ? obj.keptOverride : undefined;
  return {
    plugin: obj.plugin,
    marketplace: obj.marketplace,
    ...(isStringArray(pluginSetFields) ? { pluginSetFields } : {}),
    ...(isPlainObject(keptOverride) ? { keptOverride } : {}),
  };
```

**Fixed order, only-when-present write** (`marker.ts:96-111`):
```ts
  const { pluginSetFields = [], keptOverride } = parts;
  return {
    plugin,
    marketplace,
    ...(pluginSetFields.length > 0 ? { pluginSetFields } : {}),
    ...(keptOverride === undefined ? {} : { keptOverride }),
  };
```
The doc comment says `keptOverride` "goes last ... so a restage of the same entry writes the same
bytes" (NFR-3). Give the new member a fixed place before `keptOverride`.

**Carry-forward** (`adapter-entry.ts:210-226`) -- the "is this value ours" test goes inside this
loop, so `userCarriedFields` (starts at 228) and the choice store inherit it (RESEARCH pitfall 9):
```ts
  const previousPluginSet = pluginSetFieldsOf(previous);
  const kept = keptOverrideOf(previous) ?? {};
  for (const field of CARRIED_FIELDS) {
    const source = previousPluginSet.includes(field) ? kept : previous;
    if (!pluginSet.includes(field) && Object.hasOwn(source, field)) {
      carried[field] = source[field];
    }
  }
```

**Entry assembly** (`adapter-entry.ts:333-340`): the default is a third spread after the carried
fields, written only when neither holds `requestTimeoutMs`, and the marker call gains the member:
```ts
    safeSet(stamped, name, {
      ...translated,
      ...carriedFields(input.previous[name], pluginSetFields),
      [CLAUDE_MARKETPLACE_MARKER_KEY]: buildMarker(input.pluginName, input.marketplaceName, {
        pluginSetFields,
        keptOverride: keptOverrideFor(input.keptOverrides, name),
      }),
    });
```
`stampServers` is already dense; add small functions, not branches (two complexity gates at 15).

---

### `features/lib/upstream/subagents.ts` -- the projection of pi-subagents' wording

**Pattern** (55-64, 247-250): one regular expression owns every value this extension wrote, with a
comment above it that explains each alternative and what must not match:
```ts
const OWNED_ERROR_VALUE_PATTERN =
  /\b(?:[a-z0-9-]+\/claude-[A-Za-z0-9.[\]-]*[A-Za-z0-9\]]|plugin_[A-Za-z0-9_-]*_\/[A-Za-z0-9_-]+|(?<=^|[\s(:,])plugin_[A-Za-z0-9_-]*[A-Za-z0-9-](?:\/[A-Za-z0-9_-]+)?(?![A-Za-z0-9_/-]))/gu;
```
```ts
function projectError(text: string): string {
  const values = [...text.matchAll(OWNED_ERROR_VALUE_PATTERN)].map(([value]) => value);
  return values.length === 0 ? "error" : `error naming ${[...new Set(values)].join(", ")}`;
}
```
Three additions land here and nowhere in a feature file: a bare `claude-...` ID, the tool name
`mcp__plugin_...` of the 0.88.0 foreground text, and dropping the
"(unavailable in the active model registry)" marker from a list row. Write the pattern only after
the first run on 0.88.0 shows the real text.

## Shared Patterns

### Optional-peer loading (all conformance tests)
**Source:** `test/integration/optional-peer.ts:101-127`
**Apply to:** both new integration tests
```ts
export async function importPeerModule<T>(peer: OptionalPeer, ...segments: string[]): Promise<T> {
  return (await import(pathToFileURL(path.join(peer.root, ...segments)).href)) as T;
}
```
Load only compiled `.js` from the cache (Node does not type-strip under `node_modules`). Declare a
local `interface` for exactly the functions the test calls. Never add a companion to
`dependencies`, `devDependencies`, or the lockfile (PIFL-03, gated at `peer-floor.test.ts:150-166`).

### Test file layout
**Source:** `test/integration/agents-builtin-grant-conformance.test.ts`, `test/architecture/peer-floor.test.ts`
**Apply to:** every new or changed `node:test` file
- Imports: `node:` builtins, blank line, production modules with explicit `.ts`, blank line,
  siblings, blank line, `import type` last (`import-x/order`).
- `test("<ID>: <behavior sentence>", async (t) => { // arrange ... // act ... // assert ... })`.
- IDs in titles and comments are requirement or decision IDs (PG-MCP-02, D-PG1-09), never phase or
  plan numbers.
- Whole-value `assert.deepStrictEqual` over the result; no Node errno text pinned (Node 26 locally,
  Node 24 in CI).
- Hermetic home: `test/platform/isolated-pi-home.ts` is preloaded by the run command;
  `withHermeticEnvironment` (`test/platform/hermetic-environment.ts`) for a test that needs an
  agent directory.

### MCP scenario tagging
**Source:** `features/mcp-server/listing.feature:9, 43, 114, 130, 204`
**Apply to:** every new scenario
- `@mcp` when one expectation holds under both profiles; an `@adapter-only` / `@builtin-only` pair
  when it differs. The tag sits on its own line above `Scenario:`, or once above `Feature:` when
  the whole file is one profile (`builtin-values.feature:1`).
- The title names the decision or requirement ID in parentheses, and names a divergence
  ("a Pi capability gap", "a pi-mcp-adapter capability gap"). `check:features` enforces the tags
  and fails on an unused step.
- All preconditions are `Given`, one per line; expectations compare whole tables or whole texts
  with run tokens projected (`{home}`, `{agent dir}`, `{project dir}`).

### Step definition layout
**Source:** `features/step_definitions/mcp-server/lifecycle.steps.ts`, `builtin-values.steps.ts`
**Apply to:** the new `Given` and any stub-tool step
- `@fileoverview` block naming what the steps are about and the IDs.
- `async function (this: ScenarioWorld, ...)`, never an arrow function.
- A setup step writes through a `features/lib/` helper and then asserts by reading the file back.
- A comment above each step says what the user did in user terms, not how.
- A slow step takes `{ timeout: ... }` as the second argument (`builtin-values.steps.ts:34`).

### Domain doc comments
**Source:** `EXT/domain/mcp-implementation.ts:98-103, 109-117`
**Apply to:** the fit function, the default function, the marker member
```ts
/**
 * D-MB-13: Pi's built-in namespace for a registered server name, `mcp__`
 * plus the name with `-` folded to `_`, then the `__` before the tool. ...
 */
```
The decision ID leads; the comment states the companion's rule and the version it was read from.
Exported functions declare their return type (`explicit-module-boundary-types`).

## No Analog Found

None. Two partial cases the planner should weigh:

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| Shared suite-version data file | config | file-I/O | No repository data file is read by a script, a test support module, and a harness module together. The readers' own `package.json` reads are the pattern; the location rule comes from `.pre-commit-config.yaml:106, 112`. |
| Scenario that pins a staged `excludeTools` name | test (cucumber) | file-I/O | No feature file names `excludeTools` today (grep over `features/**/*.feature` found none). Build it from `publishMcpServerAgent` (`features/lib/mcp-server-files.ts:286-303`) and the staged-file or `subagent get` observation; RESEARCH section 9 leaves the observation open. |

## Metadata

**Analog search scope:** `scripts/`, `test/integration/`, `test/architecture/`, `test/platform/`,
`features/lib/`, `features/step_definitions/{hook,mcp-server}/`, `features/{mcp-server,hook,agent}/`,
`.planning/upstream/`, `EXT/domain/`, `EXT/bridges/{mcp,agents}/`
**Files read:** 22 (12 whole, 10 by range)
**Pattern extraction date:** 2026-11-11

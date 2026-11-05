# Phase 5: Hook Tool Names - Pattern Map

**Mapped:** 2026-11-04
**Files analyzed:** 17 (6 new, 11 modified)
**Analogs found:** 17 / 17 (all analogs git-tracked; none frozen except where marked read-only)

Paths below drop the prefix `extensions/pi-claude-marketplace/` for source files.
RESEARCH.md Pattern 1 already has full skeletons for both new source modules.
This map adds the repo analogs that the skeletons should follow.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `domain/components/hooks/builtin-mcp-tool-names.ts` (NEW) | utility (pure domain) | transform | `domain/components/hooks/matcher.ts` | role-match |
| `test/domain/components/hooks/builtin-mcp-tool-names.test.ts` (NEW) | test | transform | `test/domain/components/hooks/matcher.test.ts` | exact |
| `bridges/hooks/mcp-tool-view.ts` (NEW) | service (dispatch-time lookup + memo) | request-response | `platform/pi-api.ts` `softDepStatus` (read-only, frozen) + `shared/notification-run.ts` `openNotificationSnapshot` | partial |
| `test/bridges/hooks/mcp-tool-view.test.ts` (NEW) | test | request-response | `test/bridges/hooks/dispatch-exec.test.ts:1068-1122` (strong-mock Pi) + `test/platform/pi-inventory-seed.ts` | exact |
| `bridges/hooks/dispatch.ts` (MOD) | controller (event handler) | event-driven | itself: `matcherFiresOnToolEvent` 131-144, `isMcpProxyCall` 611-634, `compositeHandlerFor` 696, `toolResultCompositeHandler` 744 | exact |
| `test/bridges/hooks/dispatch.test.ts` (MOD) | test | event-driven | itself: "mcp proxy calls (D-CF5-12)" 3179-3278 | exact |
| `bridges/hooks/event-router.ts` (MOD) | route/registration | event-driven | itself: 1195-1206 | exact |
| `test/bridges/hooks/event-router.test.ts` (MOD) | test | event-driven | itself | exact |
| `bridges/hooks/if-field/index.ts` (MOD) | utility (predicate) | transform | itself: `extractToolName` 377, `ifFires` 482, arms 529-533 | exact |
| `test/bridges/hooks/if-field/index.test.ts` (MOD) | test | transform | itself | exact |
| `features/hook/mcp-tool-names.feature` (NEW) | test (behavior) | event-driven | `features/hook/tool-use.feature:324-351` | exact |
| `features/hook/tool-use.feature` (MOD) | test (behavior) | event-driven | itself: 324-351 | exact |
| `features/step_definitions/hook/tool-use.steps.ts` (MOD) | test step module | file-I/O | itself: `hookStubMcpText` 34-38 + `Given` 54-; `features/step_definitions/model.steps.ts:84-93` | exact |
| `features/lib/hook-mcp-calls.ts` (NEW) | utility (script builder) | transform | `features/lib/hook-files.ts` (lib shape: exports only, registers nothing) | role-match |
| `features/lib/hook-mcp-tool-server.ts` (NEW) | stdio stub server | streaming | `features/lib/mcp-stub-server.ts` (frozen, read-only; must NOT be cloned) | role-match |
| `docs/hooks-compatibility.md` (MOD) | docs | - | itself: lines 119-120, 144, 146, 163-164 (RESEARCH Q9) | exact |

## Pattern Assignments

### `domain/components/hooks/builtin-mcp-tool-names.ts` (NEW, pure transform)

**Analog:** `domain/components/hooks/matcher.ts` (sibling in the same zone)

**Imports / constants pattern** (matcher.ts lines 1-8): relative imports, SCREAMING_SNAKE module constants, regex constants named by what they mean.
```ts
import { hookDebugLog } from "../../../shared/debug-log.ts";
import { CLAUDE_TO_PI_TOOL_NAMES, type PiToolName } from "../hook-tool-names.ts";

const SAFE_MATCHER_CHARS = /^[A-Za-z0-9_|-]+$/;
const MCP_SEGMENT = /^[A-Za-z0-9_-]+$/;
```
For the new module the only import is `import { createHash } from "node:crypto";` (builtin group first). The body is RESEARCH.md Pattern 1, lines 427-475 (`McpToolIdentity`, `piNames`, `toolLiteralNames`, `serverPrefixNames`, `claudeFormToolName`).

**Doc comment pattern** (matcher.ts 10-19): a `/** ... */` above each exported type or function, citing the decision ID (`ANAME-02` there; `D-P5-02`/`D-P5-04` here), and naming Pi 1.5.0 `createMcpToolName` as the source of the algorithm.

**Dupes constraint:** do NOT model the code on the frozen `domain/mcp-implementation.ts:109-123` `builtinToolName`. RESEARCH Q6 shows a near copy makes a 10-line clone group. Keep the candidate-list shape (`piNames` returns `[sanitized, cut]` or `[cut]`, the hash computed before the branch).

---

### `test/domain/components/hooks/builtin-mcp-tool-names.test.ts` (NEW)

**Analog:** `test/domain/components/hooks/matcher.test.ts` lines 1-17
```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseMatcher } from "../../../../extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts";

describe("parseMatcher", () => {
  for (const sentinel of ["", "*"]) {
    test(`maps ${JSON.stringify(sentinel)} to match-all`, () => {
      // arrange

      // act
      const matcher = parseMatcher(sentinel);

      // assert
      assert.deepStrictEqual(matcher, { kind: "match-all" });
    });
  }
```
Conventions: one `describe` per export, table-driven `for ... of` cases, explicit `// arrange` / `// act` / `// assert` blocks (kept even when empty). Vectors come from RESEARCH Q7(c): forced hash `mcp__plugin_hook_demo_stub_server__echo_9bab19c4`; collision pair `("docs-server","a-b")` -> `..._e1640312`, `("docs-server","a_b")` -> `..._35d05d6d`; `("echo-server","echo-text")` plain `mcp__echo_server__echo_text` and hashed `..._ba79b118`; the cut-in-namespace name `mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d`. 100% direct coverage needs the `builtinServer === undefined` arm of both match helpers and both arms of `claudeFormToolName`.

---

### `bridges/hooks/mcp-tool-view.ts` (NEW, dispatch-time lookup)

**Analogs:** RESEARCH.md Pattern 1, lines 479-537 (full skeleton); the boundary already exists, since `bridges/hooks/dispatch.ts:49` imports `shared/notification-run.ts`:
```ts
import { openNotificationRun } from "../../shared/notification-run.ts";
```
Use `openNotificationSnapshot(pi).softDeps.mcpImplementation === "adapter"` (`shared/notification-run.ts:71-73`). Never call `softDepStatus` directly (D-JO-01, Pitfall 1). Type Pi only through `platform/pi-api.ts` (`ExtensionAPI["getAllTools"]`), because the rule pack bans the Pi peer elsewhere. The source path literal `"builtin:mcp"` copies `platform/pi-api.ts:323-328`, which is frozen and module-private, so a local constant is the only option.

Import order (CONVENTIONS): builtin, then parent relative, with `import type` last in its own group:
```ts
import { claudeFormToolName, type McpToolIdentity } from "../../domain/components/hooks/builtin-mcp-tool-names.ts";
import { openNotificationSnapshot } from "../../shared/notification-run.ts";

import type { ExtensionAPI } from "../../platform/pi-api.ts";
```
Export only what callers import (`HookTool`, `HookToolView`, `HookToolSource`, `createHookToolView`), and export every type named in an exported signature, so fallow reports no unused export and no `private-type-leak` (Pitfall 8).

---

### `test/bridges/hooks/mcp-tool-view.test.ts` (NEW)

**Analog:** `test/bridges/hooks/dispatch-exec.test.ts:1068-1122` (strict strong-mock Pi)
```ts
import { mock, verify } from "strong-mock";
...
const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension api" });
// ... act ...
verify(pi);
```
Inventory seeds: `test/platform/pi-inventory-seed.ts:83-102`, which is tracked:
```ts
export function builtinMcpTool(): ToolInfo {
  return {
    name: "mcp__stub__echo",
    ...
    namespace: { name: "mcp__stub", aliases: ["stub"] },
    sourceInfo: { path: "builtin:mcp", source: "builtin", scope: "temporary", origin: "top-level" },
  } satisfies ToolInfo;
}
```
Also `builtinMcpCommand()`, `adapterCommand()`, `toolInfo()`. Cases to cover:
- a non-`mcp__` name reads nothing (strict mock with no expectation);
- `pi === undefined`;
- a built-in tool;
- an adapter tool (no alias), which keeps its name;
- a missing tool;
- `getAllTools` throws;
- a cut-in-namespace name keeps Pi's name;
- `proxyRuleApplies()` with the adapter, built-in, and none inventories, read only once (`.times(1)` on `getCommands`/`getAllTools`, then call twice).

---

### `bridges/hooks/dispatch.ts` (MOD)

**Current code to change** (lines 131-144):
```ts
function matcherFiresOnToolEvent(matcher: ParsedMatcher, toolName: string): boolean {
  switch (matcher.kind) {
    case "match-all":
      return true;
    case "tool-set":
      return (
        matcher.toolNames.has(toolName) ||
        (matcher.toolPrefixes?.some((prefix) => toolName.startsWith(prefix)) ?? false)
      );
```
Change it to take `tool: McpToolIdentity`. The literal arm becomes `[...matcher.toolNames].some((n) => toolLiteralNames(n, tool))`, or `has(tool.piName)` for a tool with no built-in server. The prefix arm becomes `serverPrefixNames(prefix, tool)`. The other sites are in the RESEARCH Q4 table: `entryFires` 892-905, the tool_result matcher and label 761-764, `noticeLabel` 912-921, `isMcpProxyCall` / `isProxiedToolCall` 611-634 / 812-819 (now AND-ed with `tools.proxyRuleApplies()`), and `matchingHooks` 208-219, which forwards the identity to `ifFires`. The new signatures (a defaulted `tools: HookToolView = createHookToolView(pi)` as the last parameter) and the call graph are in RESEARCH Q4, lines 263-303. Keep `collectBucketOutcomes` unchanged. Keep each helper under cognitive complexity 15 for both ESLint and fallow.

### `test/bridges/hooks/dispatch.test.ts` (MOD)

**Analog (cases that flip):** lines 3179-3278. The table-driven `PROXY_CASES` loop calls `compositeHandlerFor(runtime, "PreToolUse", runtime.currentGeneration(), undefined, createRecordingExecutor(...))`. Under MHK-02, the cases with `runs: false` now need an adapter inventory passed as `pi` (`getCommands: () => [adapterCommand()]`, `getAllTools: () => []`). Add built-in and none variants, where every case runs. Keep the existing shape:
```ts
const calls: RecordedCall[] = [];
const handler = compositeHandlerFor(runtime, "PreToolUse", runtime.currentGeneration(),
  pi, createRecordingExecutor({ any: { kind: "noop" } }, calls));
const output = await handler(createToolCallEvent(toolName, { ...input }), createExtensionContext("/workspace/proxy"));
assert.deepStrictEqual(calls.map(({ pluginId }) => pluginId), runs ? ["any"] : []);
```
For built-in naming, add matcher, `if`, label, and stdin `tool_name` cases near "hook notices (HOOK-05 / D-CF5-14)" (line 3480), passing a `HookToolView` double or an inventory built from `builtinMcpTool()`.

### `bridges/hooks/event-router.ts` (MOD)

**Current code** (1195-1206):
```ts
pi.on("tool_call", bindWithMode((generation) =>
  compositeHandlerFor(runtime, "PreToolUse", generation, pi, opts.executor)));
pi.on("tool_result", bindWithMode((generation) =>
  toolResultCompositeHandler(runtime, generation, pi, opts.executor)));
```
Create `const tools = createHookToolView(pi);` inside the per-generation callback, or once in `registerHooksBridgeWith` (RESEARCH Q5: the callback runs once per generation), and pass it as the last argument to both calls. Creating the view reads nothing, so `test/architecture/no-factory-time-probe.test.ts` and the `.times(probes * 3)` count in `test/index.test.ts` stay green.

### `bridges/hooks/if-field/index.ts` (MOD)

**Current code** (529-533):
```ts
    case "mcp-literal":
      return extractToolName(event) === predicate.toolName;

    case "mcp-server-prefix":
      return extractToolName(event).startsWith(predicate.serverPrefix);
```
Add an optional fifth parameter `tool?: McpToolIdentity` to `ifFires` (line 482). It defaults to `{ piName: extractToolName(event), builtinServer: undefined }`, and the two arms call `toolLiteralNames` / `serverPrefixNames`. Also update the arm docs at lines 101-102 and 473-474.

---

### `features/hook/tool-use.feature` (MOD) and `features/hook/mcp-tool-names.feature` (NEW)

**Analog:** `features/hook/tool-use.feature:324-351`. Copy this structure:
```gherkin
  @adapter-only
  Scenario: A hook on a plugin MCP tool runs once per call under the real tool name
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event       | matcher                     |
      | literal | PreToolUse  | mcp__plugin_demo_stub__echo |
    Given the published plugin "demo" of the marketplace "fixtures" has the stub mcp server "stub" for its hooks
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user"
    Given pi runs with the scripted model and these companions: ...
    Given pi-mcp-adapter has listed the hooks' stub mcp server "stub" of the plugin "demo"
    Given the scripted model plays these steps: ...
    When the user prompts "call the stub"
    Then the hooks record these runs in any order:
      | event | session | tool name | tool input | tool response | cwd | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT | CLAUDE_PLUGIN_DATA | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
```
D-P5-11 rules: rename to `hook-demo`/`stub-server`; add an `@builtin-only` twin that uses the frozen stand-in step and the `the mcp implementation has listed...` wait; drop "until MHK-01, MHK-02 lift its tag" from the description. The runs table must list every column (`runs.steps.ts:40-43`). Tag rules are in `scripts/check-features.mjs` (RESEARCH Q7f): exactly one of `@mcp` / `@adapter-only` / `@builtin-only`, an ID in the title for the profile-specific tags, and no `pi-mcp-adapter` text in an `@mcp` scenario. The scenario sketches for the new feature are in RESEARCH "Code Examples" (lines 642-674).

### `features/step_definitions/hook/tool-use.steps.ts` (MOD)

**Analog (same file):** a fileoverview header, then imports, then module constants, then a private text builder, then `Given` (lines 1-60):
```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { MCP_STUB_SERVER, readStubRequests, stubPidFiles } from "../../lib/mcp-stub-server.ts";
import { writePublishedPluginFiles } from "../../lib/published-marketplace.ts";

import type { ScenarioWorld } from "../../support/world.ts";

function hookStubMcpText(plugin: string, server: string): string {
  const launch = { command: process.execPath, args: [MCP_STUB_SERVER, plugin, server] };
  return `${JSON.stringify({ mcpServers: { [server]: launch } }, null, 2)}\n`;
}

Given("the published plugin {string} of the marketplace {string} has the stub mcp server {string} for its hooks",
  async function (this: ScenarioWorld, plugin: string, name: string, server: string) { ... });
```
**Write-then-read-back pattern** (`features/step_definitions/model.steps.ts:84-93`):
```ts
    const harness = this.profileHarness();
    await writeModelScript(harness, steps);
    assert.deepStrictEqual(await readModelScript(harness), steps);
```
New steps:
- A profile-aware call step: it switches on `this.mcpProfile`, gets the steps from `features/lib/hook-mcp-calls.ts`, then writes them and reads them back.
- An `mcp.json` step: it writes `{agent dir}/mcp.json` with `flag: "wx"`, using `exposure: "direct"` and `args: [HOOK_MCP_TOOL_SERVER, tool]`, and reads the file back (RESEARCH Q7e).

Step modules export nothing.

### `features/lib/hook-mcp-calls.ts` (NEW)

**Analog:** `features/lib/hook-files.ts` (line 62 onward: imports, exported types, exported pure functions such as `recordingHooksText`; it registers no step). Import `ScriptStep` as a type from `./scripted-model/script.ts` and `profileFor` from `./mcp-implementation.ts`; both are frozen and read-only. Export one builder:
- adapter: `[{ tool: "mcp", arguments: { tool, args } }, { reply }]`;
- builtin: `[{ tool: "tool_search", arguments: { query, limit: 1 } }, { tool, arguments: args }, { reply }]` (RESEARCH Q7a).

### `features/lib/hook-mcp-tool-server.ts` (NEW)

**Role analog (read-only, frozen):** `features/lib/mcp-stub-server.ts`. Copy its contract, not its code:
```ts
export const MCP_STUB_SERVER = fileURLToPath(import.meta.url);   // path export a fixture runs with Node
...
const lines = createInterface({ input: process.stdin });          // 182-199: line loop
lines.on("line", ...) -> JSON.parse -> reply only when message.id !== undefined
lines.on("close", () => { ...; process.exit(0); });
```
Required differences (RESEARCH Q7e, to keep `fallow dupes` clean): a `data`-chunk splitter instead of `readline`, a handler table keyed by method, no request log and no pid file. The tool name comes from `argv[2]`, the schema is `{ text: string }`, and a `tools/call` answers `[{type:"text",text:"<tool>:<text>"}]`. Export `HOOK_MCP_TOOL_SERVER = fileURLToPath(import.meta.url)`. After writing the file, run `npx fallow dupes`.

### `docs/hooks-compatibility.md` (MOD)

Edit the existing rows and prose in place, following RESEARCH Q9: lines 119-120 (the MCP literal and prefix rows), 144, 146 (built-in names, the fold, the cut gap, the proxy scope), and 163-164 (the `if` rows). Keep the table columns aligned, because mdformat and Prettier run in pre-commit.

## Shared Patterns

- **Pi access:** types come only from `platform/pi-api.ts`, and the inventory is read only through the `pi` that a handler receives for its generation. `softDepStatus` is reached only through `openNotificationSnapshot` (D-JO-01).
- **Errors:** a failed `getAllTools` read falls back to the Pi name (D-P5-01). It neither throws nor notifies. No `console` and no stdio output inside the extension (fallow rule pack).
- **Tests:** `node:test` with `describe`/`test`, `// arrange` `// act` `// assert` blocks, a strict `strong-mock` with `exactParams: true` followed by `verify(pi)`, and seeds from `test/platform/pi-inventory-seed.ts`. Imports use relative paths with explicit `.ts` extensions.
- **Comments:** cite durable IDs (MHK-01, MHK-02, D-P5-xx, D-CF5-12, D-MB-08), never phase or plan numbers.
- **Cucumber:** pair each profile-specific expectation as `@adapter-only`/`@builtin-only` in one file, naming an ID. Lib modules export only; step modules export nothing.

## No Analog Found

None. The nearest gap is `bridges/hooks/mcp-tool-view.ts`: no hooks module reads `getAllTools` lazily with a memo for each generation, so use the RESEARCH Pattern 1 skeleton.

## Frozen (read-only references, never edited)

- `domain/mcp-implementation.ts`
- `platform/pi-api.ts`
- `features/lib/mcp-stub-server.ts`
- `features/lib/mcp-implementation.ts`
- `features/lib/scripted-model/**`
- `features/lib/builtin-mcp-stand-in/**`
- the shared step modules (01-FROZEN.md)

## Metadata

**Search scope:** `extensions/pi-claude-marketplace/{bridges/hooks,domain/components/hooks}`, `test/bridges/hooks`, `test/domain/components/hooks`, `test/platform`, `features/{hook,lib,step_definitions}`
**Tracked check:** `git ls-files` confirmed `features/lib/mcp-stub-server.ts` and `test/platform/pi-inventory-seed.ts`. All other analogs are tracked source files in the repo tree.

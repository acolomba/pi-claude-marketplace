# Phase 4: PostToolUseFailure Hooks - Pattern Map

**Mapped:** 2026-11-08
**Files analyzed:** 11 (2 new, 9 modified)
**Analogs found:** 11 / 11

All analog paths below are git-tracked source (checked with `git ls-files`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/hook/tool-failure.feature` (NEW) | test (cucumber) | event-driven (tool_result) | `features/hook/tool-use.feature` (lines 547-574, 603-623) + `features/hook/mcp-tool-names.feature` (lines 1-34) | exact |
| `features/step_definitions/hook/tool-failure.steps.ts` (NEW) | test step module | file-I/O + RPC request-response | `features/step_definitions/hook/tool-use.steps.ts` (Given, MCP file) + `features/step_definitions/session.steps.ts:95-128` (prompt flow) + `features/step_definitions/hook/prompt-and-stop.steps.ts:50-123` (same flow in another shape) | exact / role-match |
| `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts` | translator | transform | itself | exact (field add) |
| `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` (`toolResultCompositeHandler`) | event handler | event-driven | itself, `toolEventView` (lines 945-956) for the guarded-read style | exact |
| `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts` (`adaptToolResultResult` mutate arm, optional D-BG-405) | adapter | transform | its own `stop` arm (lines 326-330) | exact |
| `test/bridges/hooks/payloads/post-tool-use-failure.test.ts` | unit test | transform | itself (lines 11-46, 48-90) | exact |
| `test/bridges/hooks/dispatch-exec.test.ts` | unit test | transform | itself, PostToolUseFailure case (lines 682-700) | exact |
| `test/bridges/hooks/dispatch.test.ts` | unit test | event-driven | `describe("toolResultCompositeHandler")` (line 1488-) + `createProxyRuleView` (3185-3198) + proxy read cases (3405-3430) | exact |
| `test/bridges/hooks/event-adapters.test.ts` | unit test | transform | `describe("adaptToolResultResult")` mutate cases (line 385-, 700-735) | exact |
| `features/hook/tool-use.feature` (one row, own commit) | test (cucumber) | event-driven | itself, lines 603-623 | exact |
| `docs/hooks-compatibility.md` (rows 17, 246, maybe 266) | doc | - | itself | exact |

## Pattern Assignments

### `features/hook/tool-failure.feature` (NEW)

**Analog:** `features/hook/tool-use.feature`. Title must be `Feature: Hook tool failure` (RESEARCH Wave 0). Description paragraph names D-CF5-28 for absent fields and the ID licensing the MCP pair (D-BG-404), like `tool-use.feature:3-8`.

**Non-MCP scenario skeleton** (`tool-use.feature:603-623`, no tag):
```gherkin
  Scenario: A failed tool call runs PostToolUseFailure and not PostToolUse
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name    | event              | matcher |
      | after   | PostToolUse        | Bash    |
      | failure | PostToolUseFailure | Bash    |
    Given the marketplace "fixtures" is added to the project scope
    Given the user has run "/claude:plugin install demo@fixtures --scope project"
    Given the user has started a new pi session
    Given the scripted model plays these steps:
      | reply | tool | arguments             |
      |       | bash | {"command": "exit 3"} |
      | Done. |      |                       |
    When the user prompts "run the failing command"
    Then the hooks record these runs:
      | event | session | tool name | tool input | error | cwd | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT | CLAUDE_PLUGIN_DATA | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
```
For `read`, add the frozen file step before the script (RESEARCH "Probe-verified expected rows"):
`Given the published plugin "demo" of the marketplace "fixtures" has the file "notes.txt" with this text:` with docstring `one/two/three`, script row `| | read | {"path": "{home}/marketplaces/fixtures/plugins/demo/notes.txt", "offset": 9} |`. Every PostToolUseFailure row states `is interrupt` = `false` (Pitfall 4); expected `error` = `Offset 9 is beyond end of file (3 lines total)`. Matchers in Gherkin: `Read\|Edit`.

**Output-channel scenarios** copy `tool-use.feature:547-574` (hooks table with `form | output` columns, then `Then the model receives these calls:` stated whole). Expected texts per channel are in RESEARCH "Output channels" table (e.g. `PostToolUseFailure:Read hook additional context: ...`, `read failed: ...\nPostToolUseFailure:Read hook blocking error from command: "${CLAUDE_PLUGIN_ROOT}/hooks/exit.sh": [...]: check the error`). `systemMessage` uses `Then the hooks show the user these messages:` (`| severity | text |`, analog `features/hook/messages.feature`). One blocking channel per scenario (Pitfall 5).

**MCP pair** copies `mcp-tool-names.feature:7-34` but split into `@adapter-only` / `@builtin-only`, user scope, and WITHOUT the `a stand-in registers the stub mcp server ...` step (R-DC-3). Step order:
```gherkin
    Given the published plugin "hook-demo" of the marketplace "fixtures" has these hooks, each recording its runs:
      | name     | event              | matcher                                 |
      | failure  | PostToolUseFailure | mcp__plugin_hook-demo_stub-server__echo |
      | prefixed | PostToolUseFailure | mcp__plugin_hook-demo_stub-server__.*   |
      | after    | PostToolUse        | mcp__plugin_hook-demo_stub-server__echo |
    Given the published plugin "hook-demo" of the marketplace "fixtures" has the stub mcp server "stub-server" for its hooks, whose tool calls fail
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install hook-demo@fixtures --scope user", which did not fail
    Given pi runs with the scripted model and the mcp implementation
    Given the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-demo"
    Given the scripted model calls the tool "echo" of the hooks' stub mcp server "stub-server" of the plugin "hook-demo" through the mcp implementation with '{"text": "ping"}', then replies "Done."
    When the user prompts "call the stub"
```
Env cells as `mcp-tool-names.feature:29-33` (`{home}/marketplaces/fixtures/plugins/hook-demo`, `{agent dir}/pi-claude-marketplace/data/fixtures/hook-demo`). `error` = `echo:ping` (builtin) / `Error: echo:ping` (adapter). Never use `mcp__plugin_<plugin>_.*` (MATCH-02).

**Interrupt scenario**: one-row script (Pitfall 1), bounded loop command, then `Then the hooks record no runs` (RESEARCH Pattern 4 Gherkin).

---

### `features/step_definitions/hook/tool-failure.steps.ts` (NEW verb module)

**Analog A (Given, failing MCP server):** `features/step_definitions/hook/tool-use.steps.ts`

Header and imports (lines 1-39): `@fileoverview` block, then node builtins, `@cucumber/cucumber`, `../../lib/...`, then `import type { ScenarioWorld } from "../../support/world.ts";`. No exports.

Core write-and-verify pattern (lines 63-94):
```ts
function hookStubMcpText(plugin: string, server: string): string {
  const launch = { command: process.execPath, args: [MCP_STUB_SERVER, plugin, server] };
  return `${JSON.stringify({ mcpServers: { [server]: launch } }, null, 2)}\n`;
}

Given(
  "the published plugin {string} of the marketplace {string} has the stub mcp server {string} for its hooks",
  async function (this: ScenarioWorld, plugin: string, name: string, server: string) {
    const published = this.requirePublished(name);
    const text = hookStubMcpText(plugin, server);
    await writePublishedPluginFiles(published, plugin, { [MCP_FILE]: text });
    const written = path.join(published.root, "plugins", plugin, MCP_FILE);
    assert.strictEqual(await readFile(written, "utf8"), text);
  },
);
```
New step writes two files in one `writePublishedPluginFiles` call: the wrapper script (text in RESEARCH Pattern 3; escape `\n` as `\\n` inside a TS string) and `.mcp.json` whose `args` are `[<abs wrapper path>, MCP_STUB_SERVER, plugin, server]`, wrapper path = `path.join(published.root, "plugins", plugin, "<file>")`. Assert both written texts. Do not copy `hookStubMcpText` verbatim (fallow dupes) — build the launch with the wrapper prepended. Step text contains `mcp` so scenarios need an implementation tag (`scripts/check-features.mjs:46`).

Deadline/poll constants pattern (lines 41-44, 100-107) for the marker-file wait:
```ts
const HOOK_STUB_LISTING_DEADLINE_MS = 15_000;
const HOOK_STUB_LISTING_RECHECK_MS = 100;
...
    while (!(await hookStubListingDone(harness, plugin, server))) {
      assert.ok(Date.now() < deadline, `... within ${HOOK_STUB_LISTING_DEADLINE_MS} ms`);
      await pause(HOOK_STUB_LISTING_RECHECK_MS);
    }
```

**Analog B (When, interrupt):** `features/step_definitions/session.steps.ts:95-128` ("the user prompts"):
```ts
When("the user prompts {string}", async function (this: ScenarioWorld, text: string) {
  const prompt = expandTokens(text, this.tokens);
  const harness = this.profileHarness();
  const lengths = await readLogLengths(harness);
  const from = this.pi.recordCount();
  const { response } = await this.pi.request({ type: "prompt", message: prompt });
  const disposition = promptDisposition(response);
  ...
    const settled = await this.pi.waitForRecord(from, (record) => record.type === "agent_settled", MODEL_TURN_TIMEOUT_MS);
    assert.strictEqual(settled.aborted, false, JSON.stringify(settled));
  ...
  const records = this.pi.recordsSince(from);
  assert.deepStrictEqual(records.filter(isTurnFault), []);
  const logs = await readLogLinesSince(harness, lengths);
  const overflow = modelCallsOf(logs).filter((call) => call.overflow);
  ...
  this.recordTurn({ prompt, disposition, records, logs });
});
```
Imports to reuse (session.steps.ts:28-40): `promptDisposition` from `../../../test/e2e/_rpc.ts`, `DIALOG_METHODS` + `type RpcRecord` from `../../lib/pi-process.ts`, `expandTokens` from `../../lib/run-tokens.ts`, `modelCallsOf` from `../../lib/scripted-model/script.ts`, `readLogLengths, readLogLinesSince` from `../../lib/turn-records.ts`. Private helpers (`isTurnFault`, `MODEL_TURN_TIMEOUT_MS`, overflow check) must be re-implemented in a different shape — `prompt-and-stop.steps.ts:50-123` already holds a second shape (`isFault`, `settledAfter`, `startPrompt`, `callsPastScript`, `checkedRun`); do NOT copy either (fallow dupes, A4). Do not re-declare `DIALOG_METHODS` (prompt-and-stop.steps.ts:51 does; import it instead).
Differences: assert `promptDisposition(response) === "started"`; wait for the marker file; `this.pi.request({ type: "abort" })` and assert `success === true`; assert `settled.aborted === true`; register `this.onRelease(() => rm(markerFile, { force: true }))` before prompting. Keep all waits under ~20 s (30 s step timeout).

---

### `bridges/hooks/payloads/post-tool-use-failure.ts` (translator, transform)

Analog: itself (lines 21-29 interface, 47-55 return). Add `readonly is_interrupt: false;` after `error` and `is_interrupt: false,` after `error: errorText(event.content),` (upstream order, Pitfall 3). Rewrite header lines 13-14 to cite D-BG-401/D-BG-402 for `is_interrupt` and keep D-CF5-28 for `tool_use_id`/`duration_ms`.

---

### `bridges/hooks/dispatch.ts` — `toolResultCompositeHandler` (lines 781-814)

Current core:
```ts
    const claudeEvent = event.isError ? "PostToolUseFailure" : "PostToolUse";
    const bucket = runtime.getRoutingBucket(claudeEvent);
    if (bucket.length === 0) {
      return undefined;
    }

    const view = toolEventView(event, tools);
```
**Guarded-read analog** (`toolEventView`, lines 945-956) — cheap shape check first, then `tools.proxyRuleApplies()`:
```ts
  if (isMcpProxyCall(event) && tools.proxyRuleApplies()) {
    return undefined;
  }
```
D-BG-404 predicate follows exactly this order: `details.error` code check first, `tools.proxyRuleApplies()` last (dispatch.test.ts read-sequence rows pin reads). D-BG-402 guard: a private `isCancelledFailure(isError, ctx)` placed after the empty-bucket check and before `toolEventView` (RESEARCH Pattern 1). Debug lines use the already-imported `hookDebugLog` (line 57) in the house form `hookDebugLog(\`dispatch: ...\`)` (e.g. line 482). Pass the view event with `isError: true` when the adapter rule fires so `withFeedback` (event-adapters.ts:285-288) labels `PostToolUseFailure`. Keep new logic in private functions so the closure stays under cognitive 15 (ESLint + fallow).

---

### `bridges/hooks/event-adapters.ts` — `adaptToolResultResult` (lines 309-336), optional D-BG-405

Analog: the `stop` arm in the same switch:
```ts
    case "mutate":
      return toolResultPatch(result.updatedToolOutput);

    case "stop":
      hookDebugLog(
        `adaptToolResult: stop ignored (no Pi return slot); reason=${result.stopReason ?? "<none>"}`,
      );
      return undefined;
```
Mutate arm: when `event.isError`, `hookDebugLog("adaptToolResult: updatedToolOutput ignored on PostToolUseFailure (D-BG-405)")` and return `undefined`; else unchanged. Extract to a helper if needed for complexity; do not reorder arms. Update the JSDoc above (lines 300-308).

---

### `test/bridges/hooks/payloads/post-tool-use-failure.test.ts`

Analog: itself. AAA comments (`// arrange`, `// act`, `// assert`), `satisfies ToolResultEvent`, `satisfies TranslationContext`. Add `is_interrupt: false` to both `expectedPayload` literals (lines 31-39, 73-84) after `error`.

### `test/bridges/hooks/dispatch-exec.test.ts`

Lines 696-700 `eventFields`: add `is_interrupt: false,` after `error: "exit 1",` (exact stdin bytes; key order matters).

### `test/bridges/hooks/dispatch.test.ts`

Analog cases in `describe("toolResultCompositeHandler")` (line 1488):
```ts
  test("returns undefined from a stale tool-result closure without dispatching", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/tool-result-stale");
    const entry = createRoutingEntry({ pluginId: "stale-result", claudeEvent: "PostToolUse", rawMatcher: "Bash", declarationIndex: 0 });
    runtime.setRoutingBucket("PostToolUse", [entry]);
    const handler = toolResultCompositeHandler(runtime, runtime.currentGeneration());
    ...
    const output = await handler(createToolResultEvent(false), context);
```
Aborted context: `const context = createExtensionContext(cwd); context.signal = AbortSignal.abort();` — never spread the fake (throwing getters `ui`, `modelRegistry`, lines 84-124); do not change `createExtensionContext`'s signature. Live signal precedent: `signal: new AbortController().signal` (line 2352). Use `createRecordingExecutor` to assert no hook ran.
D-BG-404 cases use `createProxyRuleView(applies, reads)` (lines 3185-3198) and assert `reads` like the case at 3405-3430 (`assert.deepStrictEqual(reads, [])`). Cover: adapter active + `details: { error: "tool_error" }` + `isError: false` → PostToolUseFailure bucket, executor sees `isError: true`; adapter inactive → PostToolUse; no code → no `proxyRuleApplies` read.

### `test/bridges/hooks/event-adapters.test.ts`

Analog: `describe("adaptToolResultResult")` mutate cases, e.g. lines 700-735 ("returns a boolean error patch ..."): build `event` with `satisfies ToolResultEvent`, call `adaptToolResultResult({ kind: "mutate", updatedToolOutput: ... }, event, adapterContext(guardEntry()))`, assert result and that `event` is unchanged. New case: same with `isError: true` → `undefined`. Existing cases using `isError: false` keep the patch path covered.

### `features/hook/tool-use.feature` (lines 620-623, own commit)

Add `| is interrupt |` after `| error |` in the header and `| false |` in the row; realign column widths.

### `docs/hooks-compatibility.md`

Row 246 (`error` (PostToolUseFailure stdin)): replace only the last sentence ("`is_interrupt` and `duration_ms` are not sent (D-CF5-28)"). Row 17 (`PostToolUseFailure` event row): may append "; a cancelled call runs none (D-BG-402)". Row 266 (`updatedToolOutput`) only if D-BG-405 lands. Keep the padded table alignment (mdformat).

## Shared Patterns

### Debug logging
**Source:** `shared/debug-log.ts` via `hookDebugLog` (dispatch.ts:57, event-adapters.ts). Every skipped path logs one `dispatch: ...` / `adaptToolResult: ...` line citing the decision ID. No `console`, no notify.

### Comment/ID discipline
Comments and test titles cite D-BG-401/402/404/405, never phase/plan numbers. Header comment blocks in bridge files (e.g. post-tool-use-failure.ts:1-14) are kept current.

### Frozen-file reuse in step modules
Import frozen libs (`features/lib/**`, `test/e2e/_rpc.ts`); never copy private blocks from frozen step modules (fallow dupes fails on every clone group). Run `npx fallow dupes` after the verb module.

### Whole-literal expectations
Every expected value in the feature is a whole literal; runs tables list every stdin field as a column (`hook/runs.steps.ts:81-112`).

## No Analog Found

None. The only novel code (marker-file wait + RPC `abort`) has partial analogs: the poll loop in `tool-use.steps.ts:100-107` and the request flow in `session.steps.ts:98-128`. No existing step sends `{ type: "abort" }`; RESEARCH Pattern 4 documents the Pi side.

## Metadata

**Analog search scope:** `features/hook/`, `features/step_definitions/`, `extensions/pi-claude-marketplace/bridges/hooks/`, `test/bridges/hooks/`, `docs/hooks-compatibility.md`
**Files scanned:** ~14
**Pattern extraction date:** 2026-11-08

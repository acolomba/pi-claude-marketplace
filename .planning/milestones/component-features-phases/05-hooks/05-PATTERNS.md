# Phase 5: Hooks - Pattern Map

**Mapped:** 2026-11-01
**Files analyzed:** 38 (new + modified, grouped where they share one analog)
**Analogs found:** 36 / 38

Paths without a prefix are relative to `extensions/pi-claude-marketplace/`. Every analog named here is git-tracked source (checked with `git ls-files`). Frozen files appear only as analogs to read or call. Nothing in this map edits them.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `bridges/hooks/event-router.ts` (compaction SessionStart, reload skip, SessionEnd mode mapping) | controller (Pi event wiring) | event-driven | the file itself: `session_start` registration :900-958 | exact (self) |
| `bridges/hooks/dispatch.ts` (mapped filters, parallel fold, dedupe, proxy skip) | service | event-driven / transform | self: `matcherFiresOnClosedSetValue` :137-140, `reduceBucket` :173-231, `entryFires` :491-513 | exact (self) |
| `bridges/hooks/payloads/session-start.ts`, `session-end.ts` (mapping functions) | utility (translator) | transform | `bridges/hooks/payloads/compact-trigger.ts` + `post-compact.ts` | exact |
| `bridges/hooks/payloads/post-compact.ts` (`compact_summary`) | utility (translator) | transform | self | exact |
| `bridges/hooks/translation-context.ts` (carry `ctx.mode`) | utility | transform | self :54-60 | exact |
| `domain/components/hook-events.ts` (closed sets + header) | config (closed set) | n/a | self :258-281 | exact |
| `domain/components/hooks/schema.ts` (`once`, `onFailure` on handler) | model (schema) | validation | self `HOOK_HANDLER_SCHEMA` :17-41 | exact |
| `domain/hooks-resolution.ts` (manifest `hooks` -> unsupported, minimal) | service | file-I/O | self `resolveHooks` :165-196 | exact |
| `bridges/hooks/spawn-helpers.ts` (`planSpawn(entry, env)`) | utility | transform | self :34-48 + `shared/vars.ts:68` | exact |
| `bridges/hooks/dispatch-exec.ts`, `async-rewake/registry.ts` (call sites; failure facts) | service (child process) | streaming | self (`dispatchHookExec` :146, spawn at :194-195/:288; registry :207-208) | exact |
| `bridges/hooks/exec-timer.ts` (fired flag) | utility | event-driven | self `installTimerLadder` | exact |
| `bridges/hooks/exec-result.ts` (context/systemMessage on every arm, `ask` arm) | model (union) | n/a | self :40-51 | exact |
| `bridges/hooks/wire-protocol.ts` (decisions, context, systemMessage, onFailure) | utility (parser) | transform | self `parseHookStdout` :32, `normalizeClaudeStdout` :73 | exact |
| `bridges/hooks/event-adapters.ts` (tool decisions, input context beside prompt) | adapter | request-response | self :110-128 (`applyToolCallInputPatch`), :245-262 (`adaptInputResult`) | exact |
| `bridges/hooks/settle.ts` (every Stop reason, systemMessage) | service | event-driven | self :150-160 (`openNotificationRun(pi, {kind:"hook"})`) | exact |
| `bridges/hooks/runtime.ts`, `routing-state.ts` (pending context buffer by event) | store | event-driven | `routing-state.ts` (pending-context cells) | exact |
| possible extracted leaf for `createBeforeAgentStartHandler` (event-router.ts:193) | service (leaf) | event-driven | `bridges/hooks/routing-state.ts` (leaf extracted to break a cycle) | role-match |
| `shared/notification-types.ts` (new HookSurface member) | model (closed set) | n/a | `AsyncRewakeSummarySurface` :1699-1720 | exact |
| `shared/notification-wire.ts` | model (schema) | n/a | `ASYNC_REWAKE_SUMMARY_PAYLOAD` :687-694 | exact |
| `shared/notification-grammar.ts` | utility (render) | transform | `case "async-rewake-summary"` :1360-1363 | exact |
| `shared/notification-json.ts` | utility (render) | transform | :231-232 | exact |
| `shared/notification-resolve.ts` | utility | transform | `RAW_SURFACE_SEVERITY` :631; pass-through :716 | exact |
| `shared/notification-dispatch.ts` (new `notify...` emitter) | service (chokepoint) | event-driven | `notifyAsyncRewakeSummary` :428-442; `isRawOutcome` :96 | exact |
| `schema/claude-plugin.schema.json` | config (generated) | batch | `npm run schema:generate` | exact |
| `docs/json-output.md`, `docs/output-catalog.md`, `docs/hooks-compatibility.md` | docs | n/a | `json-output.md:473-491` (`#### async-rewake-summary` + `<!-- fields: kind:... -->`) | exact |
| notification tests (`test/shared/notification-*.test.ts`, `test/architecture/catalog-uat/catalog-wire.test.ts`, `json-output-docs.test.ts`, `wire-schema.test.ts`) | test | n/a | the existing `async-rewake-summary` rows in each file | exact |
| `test/architecture/hooks-<new>-notify.test.ts` (byte lock) | test | n/a | `test/architecture/hooks-cap-notify.test.ts` | exact |
| `features/lib/hook-files.ts` (optional columns, script hooks, exec rows, `.mcp.json`) | utility (fixture writer) | file-I/O | self (whole file, 82 lines) | exact (self) |
| `features/step_definitions/hook/runs.steps.ts` (any-order step, embedded session-id projection) | test (step) | transform | self :1-40, :215-275 | exact (self) |
| `features/step_definitions/hook/session.steps.ts` (new, compact, fork, quit, keepRecentTokens Given) | test (step) | request-response | `features/step_definitions/workflow/runs.steps.ts:96-110` | exact |
| TUI reload/quit steps (in `hook/session.steps.ts`) | test (step) | request-response | `features/step_definitions/skill/aliases.steps.ts:50-97` | exact |
| keep-recent-tokens `Given` (agent-dir `settings.json`) | test (step) | file-I/O | `features/step_definitions/companion.steps.ts:58-64` | exact |
| `hook/{tool-use,prompt-and-stop,process,configuration,lifecycle}.steps.ts` | test (step) | request-response | `hook/runs.steps.ts` + `workflow/runs.steps.ts` | role-match |
| systemMessage `Then` over `claude-plugin` entries | test (step) | transform | `features/lib/pi-commands.ts:44,100-112` (validator use) | role-match |
| `features/hook/*.feature`, migrated `features/plugin/session-start-hooks.feature` | test (feature) | n/a | `features/hook/tool-use.feature` (seed) | exact |
| unit tests under `test/bridges/hooks/**`, `test/domain/components/hook-events.test.ts` | test | n/a | existing paired test of each source | exact |
| hook-owned MCP listing wait (HOOK-08) | test (step) | event-driven | none usable (Phase 6 copy forbidden); frozen `mcp-stub-server.ts:28,81,103` gives the parts | no analog |
| Stop re-entry "wait for second `agent_settled`" When | test (step) | event-driven | partial: `workflow/runs.steps.ts` `waitForRecord(from, endsRun, ...)` | partial |

## Pattern Assignments

### `features/step_definitions/hook/session.steps.ts` (step, request-response)

**Analog:** `features/step_definitions/workflow/runs.steps.ts` lines 96-110. Copy this shape for every non-prompt action (RPC `new_session`, `compact`, `get_fork_messages` + `fork`, `this.pi.stop()`):

```ts
When(
  "the user runs the workflow command {string}",
  async function (this: ScenarioWorld, text: string) {
    const harness = this.profileHarness();
    const from = this.pi.recordCount();
    const lengths = await readLogLengths(harness);
    const command = expandTokens(text, this.tokens);
    const { response } = await this.pi.request({ type: "prompt", message: command });
    assert.strictEqual(promptDisposition(response), "handled", JSON.stringify(response));
    await this.pi.waitForRecord(from, endsRun, WORKFLOW_RUN_TIMEOUT_MS);
    const records = this.pi.recordsSince(from);
    assert.deepStrictEqual(records.filter(isRunFault), []);
    const logs = await readLogLinesSince(harness, lengths);
    assert.deepStrictEqual(modelCallsOf(logs), [], "the workflow run called the model");
    this.recordTurn({ prompt: command, disposition: "handled", records, logs });
  },
);
```

The comment above the step states why the step waits and what it waits for (D-CF1-17: never a fixed time). For `compact`, use `this.pi.request({ type: "compact" })` and assert `response.success`. Do not call `modelCallsOf(...) === []`, because the summarization calls are scripted model calls (RESEARCH F1). For quit, call `this.pi.stop()`. It is idempotent, and the release still runs `assertStandInsStopped`.

**Keep-recent-tokens `Given`.** Analog: `features/step_definitions/companion.steps.ts` lines 58-64 (write `wx`, register removal, verify):

```ts
Given("the project holds a pi settings file", async function (this: ScenarioWorld) {
  const file = path.join(this.scopeRoot("project"), "settings.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "{}\n", { flag: "wx" });
  this.onRelease(() => rm(file, { force: true }));
  assert.strictEqual(await readFile(file, "utf8"), "{}\n");
});
```

Target `<agentDir>/settings.json` (`this.tokens.agentDir`) with `{"compaction":{"keepRecentTokens":1}}`. It must run before `pi runs with the scripted model`.

**TUI reload/quit.** Analog: `features/step_definitions/skill/aliases.steps.ts` lines 55-97. These lines start `PiTuiSession` with the sandbox, git env, and `SCRIPTED_MODEL_EXTENSION`, call `this.onRelease(() => tui.stop())`, read `readLogLengths(harness)` before typing, use `markOutput`/`waitForTextAfter`, then call `this.recordTurn({ prompt, disposition: "interactive", records: [], logs })`. Caveat from RESEARCH: `mkdir <home>/harness` first when no profile Pi created it.

---

### `features/step_definitions/hook/runs.steps.ts` (step, transform; modified)

**Analog:** self. Header doc comment lines 1-9 (update it for the any-order step and the embedded id). Imports lines 11-28, with type imports last per `import-x/order`. Session ordinals are `SESSION_ORDINALS` (line 30). The whole-value projection is at :226-231, and the ordered compare is at :260-267 (`this.requireTurn().logs.get(HOOK_RUNS_LOG)`). Add:
- `the hooks record these runs in any order:`: sort both the stated and the actual rows on every column, then `deepStrictEqual`. Do not filter. The rule is "sorting is not filtering".
- embedded session-id projection for `CLAUDE_ENV_FILE` (`hook-env.ts:73-75` builds `claude-env-${sessionId}.env`), reusing `SESSION_ORDINALS`.

---

### `features/lib/hook-files.ts` (fixture writer, file-I/O; modified)

**Analog:** self. Patterns to keep:
- strict table header check that throws on a missing or unknown column (lines 28-50):
```ts
const [header, ...body] = rows;
if (header?.join("|") !== COLUMNS.join("|")) {
  throw new Error(`the hooks table needs the columns ${COLUMNS.join(", ")}`);
}
```
- name validation `/^[a-z0-9-]+$/u` (line 44)
- write through frozen `writePublishedPluginFile(published, plugin, relPath, text)` (line 81)
- command built from `process.execPath` + `HOOK_RECORDER_PATH` (line 54). Script hooks (`hooks/<name>.sh`, chmod 0o755, `command: "${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh"`) keep the command text stable for messages that quote it.

Keep the existing `| name | event | matcher |` parser unchanged for the seed, and add a second parser for the optional columns. Write the `.mcp.json` writer so it differs in structure from Phase 6's `features/lib/mcp-server-files.ts`. Otherwise `fallow dupes` fails on the clone group.

---

### `bridges/hooks/payloads/session-start.ts` / `session-end.ts` (translator, transform)

**Analog:** `payloads/post-compact.ts` (whole file), which calls a sibling mapping function `compactTrigger(event.reason)` from `compact-trigger.ts`:

```ts
import { compactTrigger } from "./compact-trigger.ts";

import type { SessionCompactEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export function translatePostCompact(event: SessionCompactEvent, ctx: TranslationContext): PostCompactStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PostCompact",
    trigger: compactTrigger(event.reason),
  };
}
```

Export `claudeSessionStartSource(reason)` and `claudeSessionEndReason(reason, mode)` in this style. Use exhaustive switches with no default arm (NFR-7). `dispatch.ts` `entryFires` must import the same function, which gives one mapping site (Anti-pattern: two mapping sites). Rewrite the header comment of `session-start.ts` (lines 1-12, the "pass through as-is" text is superseded by D-CF5-01). For PostCompact, add `compact_summary: event.compactionEntry.summary` and a `readonly compact_summary: string` field to the interface.

---

### `bridges/hooks/dispatch.ts` (service, event-driven)

**Analog:** self.
- Filter helper to reuse for SessionEnd/PreCompact/PostCompact (lines 137-140):
```ts
export function matcherFiresOnClosedSetValue(entry: RoutingEntry, value: string): boolean {
  const raw = entry.rawMatcher;
  return raw === "" || raw === "*" || raw === value;
}
```
- `entryFires` (lines 491-513): change the `SessionStart` arm to compare the mapped source. Move `SessionEnd`/`PreCompact`/`PostCompact` out of the `return true` group to `matcherFiresOnClosedSetValue(entry, mapped)`. Update the JSDoc above it ("fire unconditionally").
- `reduceBucket` (lines 173-231): keep the generation re-check after the awaits (`if (capturedGeneration !== runtime.currentGeneration()) return { result: { kind: "noop" }, attributedTo: undefined };`), the matcher + `ifFires` filter, and the exhaustive `switch (r.kind)`. Replace the `for`/`await` loop and its `no-await-in-loop` disable with filter, dedupe, `Promise.all`, and a routing-order fold. Remove the `applyMutationInPlace` call between hooks. Delete the DISP-04 comments at :38-41, `event-router.ts:27-29`, and `routing-state.ts:39-41`.
- `CompositeEventFor` (lines 458-470) changes if the router passes the mapped Claude-side event.

---

### `bridges/hooks/event-router.ts` (Pi event wiring)

**Analog:** self, the `session_start` registration at lines 900-958. Copy its pattern into `session_compact` (lines 971-976) for the compaction SessionStart:
- `bind((generation) => { const h = compositeHandlerFor(runtime, "SessionStart", generation, pi, opts.executor); return async (event, ctx) => { try { requireNotificationMode(ctx.mode); ... } catch (err) { hookDebugLog(`... skipped: ${errorMessage(err)}`); } }; })`
- `ensureSharedDataDir(locationsFor(scope, ctx.cwd))` per scope that has SessionStart entries, with `generationIsCurrent()` checks after each await (lines 937-946, with the justified `no-await-in-loop` disable).
- Keep 11 `pi.on` registrations in the same order (`test/architecture/hooks-lifecycle.test.ts:375-387`). The SSDEDUP-01 key at line 918 stays on `session_start` only.
- Reload: return early (no dispatch) after hydrate, rebuild, and `ensureSharedDataDir` when `event.reason === "reload"`. `session_shutdown` (lines 959-964) needs the same handling, so it moves from the plain `bindWithMode(...)` to a wrapper that checks the reason.

---

### `bridges/hooks/spawn-helpers.ts` (utility, transform)

**Analog:** self, lines 34-48, plus `shared/vars.ts:68` `substituteClaudeVars`. RESEARCH § Code Examples gives the target sketch. Keep the EXEC-04 JSDoc (the discriminator is "args defined") and the `JSON.stringify` fallback for non-string args. Substitute only on the exec-form arm. Prefer typing the parameter as the three values, not `NodeJS.ProcessEnv`, so that 100% branch coverage needs no unreachable `?? ""` arms.

---

### `bridges/hooks/event-adapters.ts` (adapter, request-response)

**Analog:** self.
- Whole-input replacement keeps the guards of `applyToolCallInputPatch` (lines 114-127). Delete the own keys first, then copy:
```ts
if (updatedInput === null || typeof updatedInput !== "object" || Array.isArray(updatedInput)) { return; }
const target = event.input as Record<string, unknown>;
for (const [key, value] of Object.entries(updatedInput as Record<string, unknown>)) {
  if (key === "__proto__") { continue; }
  target[key] = value;
}
```
- `adaptInputResult` (lines 247-262): the `mutate` arm currently returns `{ action: "transform", text: result.additionalContext }`. That is the bug (O1). Return `undefined` and buffer the context for `before_agent_start`.
- A new `ask` arm in `exec-result.ts` breaks every exhaustive `switch (result.kind)` here and in `dispatch.ts`/`settle.ts`. Update them all in the same plan.

---

### `bridges/hooks/settle.ts` (Stop)

**Analog:** self, lines 150-160. Hook-origin output opens a run with `openNotificationRun(pi, { kind: "hook" })` before calling a `notify*` emitter. Copy this for systemMessage emission from dispatch.

---

### `domain/components/hook-events.ts` (closed set)

**Analog:** self, lines 258-281 (`NON_TOOL_EVENT_CLOSED_SETS ... satisfies Readonly<Record<...>>`). Each entry carries a decision-ID comment. Replace the D-58-06 comments with D-CF5-01/02 comments, and remove the stale `bypass_permissions_disabled` text (:225-226).

---

### `domain/components/hooks/schema.ts` (schema)

**Analog:** self, `HOOK_HANDLER_SCHEMA` lines 17-41. Add `once: {}` and `onFailure: {}` to `properties`, and the matching `?: unknown` fields to the `HookHandlerEntry` interface (lines 10-15, which has an index signature). The group-level `once: Type.Optional(Type.Unknown())` at the `HOOK_ENTRY_SCHEMA` line stays as accepted input.

---

### `domain/hooks-resolution.ts` (minimal edit, D-CF5-20/27)

**Analog:** self, `resolveHooks` lines 165-196. `input.manifest?.hooks` and `input.entry.hooks` are already in the input type. Add `"hooks"` to `input.resolution.unsupported` once, and a `droppedHooks` entry of the existing `{ kind: "event", event: <label> }` shape. A new `DroppedHook` arm would require `domain/resolver-types.ts`, which this phase does not own. Skip a path that resolves to `DEFAULT_HOOKS_RELATIVE_PATH`.

---

### New `HookSurface` kind (append-only, its own commit)

**Analog:** `async-rewake-summary` end to end.

- `shared/notification-types.ts:1699-1720`:
```ts
/** RAWS-05 / D-08: a plugin author's async-rewake summary, kept verbatim. */
export interface AsyncRewakeSummarySurface {
  readonly kind: "async-rewake-summary";
  readonly summary: string;
}
...
export type HookSurface = AsyncRewakeSummarySurface | StopOverrideCapSurface;
```
- `shared/notification-wire.ts:687-694`:
```ts
const ASYNC_REWAKE_SUMMARY_PAYLOAD = Type.Object(
  { ...RAW_ENVELOPE_FIELDS, kind: Type.Literal("async-rewake-summary"), text: Type.String() },
  { additionalProperties: false },
);
```
  plus membership in the payload union.
- `shared/notification-grammar.ts:1360-1363`:
```ts
case "async-rewake-summary":
  return surface.summary.length === 0 ? undefined : [surface.summary, RAW_SURFACE_SEVERITY[surface.kind]];
```
- `shared/notification-json.ts:231-232`: `return { ...envelope, kind: surface.kind, text: surface.summary };`
- `shared/notification-resolve.ts:631` `"async-rewake-summary": "info",` and the pass-through group at :716-718.
- `shared/notification-dispatch.ts:96` (`isRawOutcome` -> `false` group) and the emitter at :428-442:
```ts
export function notifyAsyncRewakeSummary(ctx: NotificationContext, run: NotificationRun, summary: string): void {
  if (summary.length === 0) { return; }
  emitHookSurface(ctx, run, { kind: "async-rewake-summary", summary });
}
```
  The new emitter must land in the same commit as its first caller (fallow dead-code).
- `docs/json-output.md:473-491` `#### <kind>` and `<!-- fields: kind:<kind> -->`; `schema/claude-plugin.schema.json` via `npm run schema:generate`.
- Tests: add the kind next to each `async-rewake-summary` row in `test/shared/notification-{types,resolve,grammar,json,wire,dispatch}.test.ts`, `test/architecture/catalog-uat/catalog-wire.test.ts` (`RAW_ORIGINS`, `RAW_SAMPLES`, sorted kind list), `test/architecture/json-output-docs.test.ts`, and `test/architecture/wire-schema.test.ts`. Model the byte lock on `test/architecture/hooks-cap-notify.test.ts`.

## Shared Patterns

### Turn recording for non-prompt actions
**Source:** `features/step_definitions/workflow/runs.steps.ts:96-110`, `skill/aliases.steps.ts:71-97`
**Apply to:** every hook-owned When that acts outside `the user prompts`. Use `readLogLengths` -> `recordCount` -> act -> `recordsSince` -> `readLogLinesSince` -> `this.recordTurn(...)`. Keep no module-level mutable state.

### Release registration
**Source:** `companion.steps.ts:58-64`, `aliases.steps.ts:69`
**Apply to:** every file or process a step creates. Call `this.onRelease(() => ...)` right after the create.

### Error swallowing at Pi lifecycle events
**Source:** `event-router.ts:916-955`
**Apply to:** the new compaction SessionStart and the reload branches. Use try/catch with `hookDebugLog(\`<event> skipped: ${errorMessage(err)}\`)` and never rethrow (NFR-2). Check `generationIsCurrent()` after every await.

### Output chokepoint
**Source:** `shared/notification-dispatch.ts` `emitHookSurface` :222-228; `settle.ts:156` run opening
**Apply to:** systemMessage, the blocked-UserPromptSubmit notice, and onFailure notices. Never call `ctx.ui.notify` directly (fallow `notify-chokepoint`).

### Exhaustive unions
**Source:** `dispatch.ts:202-227` switch with no default arm
**Apply to:** `exec-result.ts` arms, session mapping functions, and every adapter.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| hook-owned MCP listing wait + `.mcp.json` writer (HOOK-08) | step / fixture | event-driven | The only analog is Phase 6's `mcp-server/calls.steps.ts:84-152` and `features/lib/mcp-server-files.ts`, which are off limits and would form a clone group. Build it from the frozen `mcp-stub-server.ts` exports (`MCP_STUB_SERVER` :28, `readStubRequests` :81, `stubPidFiles` :103). |
| Stop re-entry wait (second `agent_settled`) | step | event-driven | Nothing waits for a second settle. Use `this.pi.waitForRecord(from, predicate, timeout)` as `workflow/runs.steps.ts:105` does, with a predicate that counts `agent_settled` records. |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/bridges/hooks/**`, `domain/components/**`, `domain/hooks-resolution.ts`, `shared/notification-*.ts`, `features/lib/`, `features/step_definitions/{hook,workflow,skill}/`, `features/step_definitions/companion.steps.ts`, `docs/json-output.md`
**Files scanned:** ~25
**Pattern extraction date:** 2026-11-01

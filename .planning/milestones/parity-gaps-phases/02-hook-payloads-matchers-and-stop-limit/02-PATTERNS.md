# Phase 02: Hook Payloads, Matchers, and Stop Limit — Pattern Map

**Mapped:** 2026-11-12
**Scope:** PG-HOOK-01, PG-HOOK-03, PG-HOOK-13. Names of new modules below are proposals, not locked decisions.

## File Classification

Paths beginning `H/` mean `extensions/pi-claude-marketplace/bridges/hooks/`; `D/` means `extensions/pi-claude-marketplace/domain/components/`. Each production row also owns its exact mirrored `test/.../*.test.ts` file, classified as **test / request-response**. Count both files against plan limits. No test-only exports or alternate owner modules.

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `H/tool-input.ts` (proposed) | utility | transform | `H/payloads/pre-tool-use.ts` | role-match |
| `H/tool-input-search.ts` (optional split) | utility | transform | `H/payloads/pre-tool-use.ts` | role-match |
| `H/tool-result-files.ts` (proposed) | utility | transform | `H/payloads/post-tool-use.ts` | role-match |
| `H/tool-result-search-shell.ts` (proposed) | utility | transform | `H/payloads/post-tool-use.ts` | role-match |
| `H/tool-output.ts` (proposed reverse decoder) | utility | transform | `H/event-adapters.ts` | role-match |
| `H/tool-batch.ts` (proposed) | service | event-driven | `H/dispatch.ts` | role-match |
| `H/payloads/pre-tool-use.ts` | utility | transform | existing module | exact |
| `H/payloads/post-tool-use.ts` | utility | transform | existing module | exact |
| `H/payloads/post-tool-use-failure.ts` | utility | transform | `H/payloads/post-tool-use.ts` | exact |
| `H/event-adapters.ts` | service | event-driven | existing mutation boundary | exact |
| `H/dispatch.ts` | service | event-driven | existing run/fold boundary | exact |
| `H/dispatch-exec.ts` | service | event-driven | existing translator dispatch | exact |
| `H/async-rewake/registry.ts` | service | event-driven | existing translator dispatch | exact |
| `H/wire-protocol.ts` | utility | transform | existing wire decoder | exact |
| `H/exec-result.ts` | model | transform | existing result union | exact |
| `H/event-router.ts` | controller | event-driven | existing registration/routing | exact |
| `H/runtime.ts` | store | event-driven | existing factory state | exact |
| `H/settle.ts` | service | event-driven | existing Stop continuation | exact |
| `D/hooks/matcher.ts` | utility | transform | existing parser | exact |
| `D/hooks/partition.ts` | utility | transform | existing admission filter | exact |
| `D/hooks.ts` | service | transform | existing supported/dropped reporting | exact |
| `D/hook-tool-names.ts` | utility | transform | existing closed mapping | exact |
| `features/hook/tool-use.feature` | test | event-driven | existing scenarios | exact |
| `features/hook/tool-failure.feature` | test | event-driven | `features/hook/tool-use.feature` | exact |
| `features/hook/mcp-tool-names.feature` | test | event-driven | `features/hook/tool-use.feature` | exact |
| `features/hook/prompt-and-stop.feature` | test | event-driven | existing scenarios | exact |
| `features/hook/configuration.feature` | test | request-response | existing scenarios | exact |
| `features/step_definitions/hook/runs.steps.ts` | test | file-I/O | existing recorder assertions | exact |
| `features/step_definitions/hook/tool-use.steps.ts` | test | event-driven | existing scenario-world setup | exact |
| `features/step_definitions/hook/tool-failure.steps.ts` | test | event-driven | tool-use step module | role-match |
| `features/step_definitions/hook/prompt-and-stop.steps.ts` | test | event-driven | tool-use step module | role-match |
| `features/lib/hook-recorder.ts` | utility | file-I/O | existing executable hook fixture | exact |
| `docs/hooks-compatibility.md` | config (documentation) | transform | existing compatibility record | exact |

This is a candidate inventory, not an instruction to touch every file. There are 22 production candidates (including one optional split), 22 paired owners, and 11 behavioral/documentation candidates: **55 candidate files**. Do not create all proposed modules by default; combine small coherent concerns when the paired owner would otherwise have little behavior. Reporting consumers and architecture expectations may add files once matcher types change; recount each plan rather than assuming the candidate inventory is exhaustive.

## Pattern Assignments

### Input and result codecs; three payload envelopes

Use `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts:14-17` for import conventions:

```typescript
import { mapPiToClaudeToolName } from "../../../domain/components/hook-tool-names.ts";

import type { ToolCallEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";
```

Use the pure event/context boundary at lines 28-39:

```typescript
export function translatePreToolUse(
  event: ToolCallEvent,
  ctx: TranslationContext,
): PreToolUseStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PreToolUse",
    tool_name: mapPiToClaudeToolName(event.toolName),
    tool_input: event.input,
  };
}
```

Copy the boundary, not the raw-input behavior. The latter is the defect this phase changes. `post-tool-use.ts:32-44` uses the same boundary and currently assigns `tool_response: event.content`; replace that assignment with available-fact projection. The failed-result translator retains its error envelope, not a synthetic success response. New codecs should be pure, with cwd/home supplied explicitly, and return discriminated accepted/unsupported results for reverse conversion. Do not add filesystem rereads or tool execution.

**Callers:** CodeGraph identifies both `dispatch-exec.ts` and `async-rewake/registry.ts` as callers of the payload translators. Update their own paired tests when shared signatures change. The research records Phase 1's dispatch view using canonical Claude tool names: codecs must handle that identity boundary, not switch only on lowercase names. Keep native input available to `if-field/index.ts`; that predicate module is a regression boundary, not a required edit.

### Batch helper, dispatch, and adapters

Use `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:258-267` for ordered parallel execution with lifecycle cancellation:

```typescript
async function runHooks(
  runtime: HooksRuntime,
  hooks: readonly RoutingEntry[],
  run: (entry: RoutingEntry) => Promise<HookExecResult>,
): Promise<BucketOutcome[] | undefined> {
  const capturedGeneration = runtime.currentGeneration();
  const outcomes = await Promise.all(
    hooks.map(async (entry) => ({ entry, result: await run(entry) })),
  );
  return capturedGeneration === runtime.currentGeneration() ? outcomes : undefined;
}
```

Use the strongest-decision rule at lines 407-420:

```typescript
function foldOutcomes(outcomes: readonly BucketOutcome[]): FoldedBucket {
  const context = joinedContext(outcomes);
  const decisive =
    outcomes.find(({ result }) => result.kind === "stop") ??
    outcomes.find(({ result }) => result.kind === "block");
  if (decisive !== undefined) {
    return {
      result: withContext(decisive.result, context),
      attributedTo: decisive.entry,
      outcomes,
    };
  }

  return foldMutations(outcomes, context);
}
```

**Apply to:** `tool-batch.ts`, `dispatch.ts`, and their owner tests. Capture generation across the entire batch, validate without mutation, fold explicit denial before unsupported fallback, then commit once. A helper must preserve pair identity and the original batch result. The existing single-event fold is a role/data-flow analog; it is not already a batch transaction.

**Caller path:** `event-router.ts` installs composite dispatch; `runAndFold` calls `matchingHooks`, `runHooks`, and `foldOutcomes`; `adaptForEvent` selects `adaptToolCallResult` for PreToolUse. `matchingHooks` at lines 239-251 evaluates both matcher and native `if` predicates. Keep those concerns separate from translated payload construction.

`event-adapters.ts` remains the mutation/application boundary. The research identifies its safe own-key replacement at lines 140-156 and input mutation at 222-236; retain that protection when committing a decoded candidate. Reverse output must return one complete Pi patch that clears stale carriers, and failed results must remain immutable. Carry the MCP output alias through `wire-protocol.ts`, `exec-result.ts`, and dispatch folding before selecting it using recovered identity. Do not implement alias choice only in the parser, where tool identity is unavailable.

### Matcher syntax, admission, and reporting

Use the discriminated parser structure from `extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts:15-19`:

```typescript
export type ParsedMatcher =
  | { kind: "match-all" }
  | { kind: "tool-set"; toolNames: ReadonlySet<string>; toolPrefixes?: readonly string[] }
  | { kind: "regex" }
  | { kind: "unmapped"; token: string };
```

This union is a shape analog, not the target contract: regex currently means degradation, so add valid compiled-regex versus invalid-pattern representation deliberately. Current parser lines 93-133 split only on `|` and convert exact names to native Pi names; those assumptions must change with canonical-name runtime matching.

Admission follows `partition.ts:99-109`:

```typescript
for (const group of groups) {
  const matcher = group.matcher ?? "";
  const condition = matcherCondition(event, matcher);
  if (condition !== null) {
    dropped.push({ kind: "group", event, matcher, cond: condition });
    continue;
  }

  const supportedGroup = partitionHandlers(event, matcher, group, dropped);
```

**Callers:** `parseMatcher` is consumed by `partition.ts`, `event-router.ts`, and the public `domain/components/hooks.ts` facade. `event-router.ts:388-425` places the parsed matcher and raw matcher in each routing entry. Change admission, runtime matching, and support reporting together: valid regex is supported; invalid regex drops the group; UserPromptSubmit/Stop ignore matcher strings. Preserve MCP identity recovery and existing closed-set behavior for other non-tool events unless the accepted scope explicitly requires a change.

### Stop runtime and event routing

Reuse factory-owned state in `extensions/pi-claude-marketplace/bridges/hooks/runtime.ts:179-188`:

```typescript
let lastAssistant: AssistantMessage | undefined;
let stopHookActive = false;
let runStartedByRewake = false;
let consecutiveBlockCount = 0;
let capNotifiedThisSession = false;

function finishStopSequence(): void {
  consecutiveBlockCount = 0;
  capNotifiedThisSession = false;
}
```

At lines 275-284, `recordStopReentry()` increments then compares `>= STOP_OVERRIDE_CAP`, where the constant already equals 8. This overrides the eighth attempt. Acceptance requires eight continuations and override on attempt nine. Change the comparison and reset path, not merely the constant. Add a production lifecycle operation if needed for tool-call reset; do not expose test-only setters. `settle.ts` consumes the transition and cap notification. Keep `agent_settled` registration in `event-router.ts`; Phase 5 owns event migration.

### Paired unit tests

Copy `test/bridges/hooks/payloads/pre-tool-use.test.ts:3-8` import style and lines 11-46 full-object assertions. The important test pattern is:

```typescript
const event = {
  type: "tool_call",
  toolCallId: "tool-call-built-in",
  toolName: "bash",
  input: toolInput,
} satisfies ToolCallEvent;
```

```typescript
const payload = translatePreToolUse(event, context);
assert.deepStrictEqual(payload, expectedPayload);
```

The existing identity assertion for built-in `tool_input` is obsolete once translation occurs. Keep identity/passthrough checks for MCP/custom tools. Mirror each new source path exactly under `test/`; run its owner alone to establish 100% direct coverage. Test malformed values, absent optional fields, whole-input replacement, supported/unsupported mixtures, and generation changes through public exports. No new generic test helpers directory.

### Behavioral scenarios and fixtures

Use `features/hook/tool-use.feature:11-35` as the concrete flow: publish a local plugin with a real recording command hook, install via `/claude:plugin`, start a new session, script a model tool call, assert all recorded stdin rows, then assert model-visible tool results. Its deny scenario at lines 37-61 emits real hook JSON and verifies the blocked result. Extend that pattern for unsupported rewrite plus notice and for unchanged filesystem state on batch denial; an isolated fake executor is insufficient acceptance evidence.

Use `features/step_definitions/hook/tool-use.steps.ts:25-39` imports and lines 131-145 per-world scripting:

```typescript
const steps = hookMcpCallScript(this.mcpProfile, plugin, server, tool, argumentsText, reply);
const harness = this.profileHarness();
await writeModelScript(harness, steps);
assert.deepStrictEqual(await readModelScript(harness), steps);
```

Feature files belong in `features/hook/`; steps belong in `features/step_definitions/hook/`, not beside the feature. Reuse `runs.steps.ts` and `features/lib/hook-recorder.ts` for exact JSON assertions. Keep added state in `ScenarioWorld`, clean it through its release lifecycle, and exercise both MCP profiles. Existing Stop scenarios/steps are the ownership location for cap/reset acceptance. Modify shared fixtures before parallel scenario work, and serialize plans that touch those fixtures.

## Shared Patterns

- **Authorization:** no new authentication surface. Preserve explicit stop/deny precedence and existing project-trust/lifecycle guards.
- **Validation:** pure decoder results distinguish unsupported rewrites from valid replacements; never partially commit a candidate. Retain safe own-key copying, rejecting dangerous prototype keys.
- **Errors and notices:** use existing dispatch notice/output routing. Unsupported rewrite notices identify tool/field categories without argument values; no direct stdout/stderr writes.
- **Lifecycle:** preserve generation checks through every awaited batch operation. Runtime state belongs to `createHooksRuntime`, never module globals.
- **Data integrity:** native predicate inputs, canonical tool identity, translated input, and output replacement are distinct values. A post-result replacement changes model-visible output, not completed tool effects.
- **Verification:** focused owner checks while editing; paired direct coverage; cucumber plus feature checks for visible behavior; combined-tree `npm run check` at wave/phase/handoff gates. No product checks were run for this document-only mapping.

## No Analog Found

| Concern | Role / flow | Reason |
|---|---|---|
| Complete per-tool bidirectional codec semantics | utility / transform | Existing payloads forward raw values. Copy their pure boundary, then implement the researched field contract; there is no existing complete codec to copy. |
| Atomic multi-pair preflight | service / event-driven | Existing dispatch folds one view. Ordered folding and lifecycle cancellation are reusable, but batch consistency and whole-call fallback are new. |
| Exact current LS schema | utility / transform | Upstream schema remains unresolved in RESEARCH; do not invent fields or claim an existing complete analog. |

## Metadata

**Search scope:** current hook bridge, domain hook parser/admission, mirrored tests, hook features and step modules. CodeGraph was used before source searches. Strong pattern families: pure payload boundary, ordered fold, discriminated matcher/admission, factory runtime state, paired/behavioral tests.

**Tracked-source gate:** source analogs under `extensions/pi-claude-marketplace/bridges/hooks/` and `domain/components/hooks/`, the paired payload test, hook features, and the cited step/fixture paths were confirmed by `git ls-files`. No installed/runtime mirror is an implementation analog. Installed Pi evidence remains in RESEARCH only.

**Inventory coverage:** all 55 candidate files have an existing structural analog; six proposed production modules have only partial semantic analogs. The table groups each mirrored test with its source, so 33 rows represent 55 candidate files. Final implementation file count depends on module boundaries and reporting consumers.

**Write scope:** only this PATTERNS document. The environment has no filesystem Write tool; the available patch tool creates this artifact without a shell heredoc.

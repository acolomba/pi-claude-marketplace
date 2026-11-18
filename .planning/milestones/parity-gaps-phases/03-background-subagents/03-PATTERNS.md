# Phase 03: Background Subagents — Pattern Map

**Mapped:** 2026-11-13
**Scope:** D-PG3-01..09; current tracked source, not saved codebase maps.
**Files classified:** 38 concrete candidate files; optional extraction names below are proposals, not existing APIs. Final plans must count every file separately.
**Analogs:** Existing owners cover the changes. Identity parsing, child journal ownership and maintained real-child acceptance need new behavior; no existing implementation proves those contracts.

## File Classification

Paths abbreviated below: `S` = `extensions/pi-claude-marketplace`; `H` = `S/bridges/hooks`; `A` = `S/bridges/agents`. A paired owner test replaces `S/` with `test/` and `.ts` with `.test.ts`.

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `H/child-identity.ts` (proposed) | utility | transform | `H/translation-context.ts` | role-match; parser is new |
| `test/bridges/hooks/child-identity.test.ts` (proposed) | test | transform | `test/bridges/hooks/translation-context.test.ts` | role-match |
| `H/runtime.ts` | store | event-driven | existing owner | exact |
| `test/bridges/hooks/runtime.test.ts` | test | event-driven | existing owner | exact |
| `H/event-router.ts` | controller | event-driven | existing owner | exact |
| `test/bridges/hooks/event-router.test.ts` | test | event-driven | existing owner | exact |
| `H/child-event-policy.ts` (proposed) | utility | transform | `H/async-rewake/registry.ts` typed translator table | role-match |
| `test/bridges/hooks/child-event-policy.test.ts` (proposed) | test | transform | `test/bridges/hooks/translation-context.test.ts` | role-match |
| `H/translation-context.ts` | model | transform | existing owner | exact |
| `test/bridges/hooks/translation-context.test.ts` | test | transform | existing owner | exact |
| `H/payloads/pre-tool-use.ts` | utility | transform | existing owner | exact |
| `test/bridges/hooks/payloads/pre-tool-use.test.ts` | test | transform | existing owner | exact |
| `H/payloads/post-tool-use.ts` | utility | transform | existing owner | exact |
| `test/bridges/hooks/payloads/post-tool-use.test.ts` | test | transform | existing owner | exact |
| `H/payloads/post-tool-use-failure.ts` | utility | transform | existing owner | exact |
| `test/bridges/hooks/payloads/post-tool-use-failure.test.ts` | test | transform | existing owner | exact |
| `H/dispatch-exec.ts` | service | request-response | existing owner | exact |
| `test/bridges/hooks/dispatch-exec.test.ts` | test | request-response | existing owner | exact |
| `H/async-rewake/registry.ts` | service | event-driven | existing owner | exact |
| `test/bridges/hooks/async-rewake/registry.test.ts` | test | event-driven | existing owner | exact |
| `H/async-rewake/pid-table.ts` | service | file-I/O | existing owner | exact persistence style; new ownership schema |
| `test/bridges/hooks/async-rewake/pid-table.test.ts` | test | file-I/O | existing owner | exact |
| `A/convert.ts` | utility | transform | existing owner | exact |
| `test/bridges/agents/convert.test.ts` | test | transform | existing owner | exact |
| `A/mcp-async-warning.ts` | utility | transform | existing owner | exact |
| `test/bridges/agents/mcp-async-warning.test.ts` | test | transform | existing owner | exact |
| `A/grant-rewrite.ts` | migration | file-I/O | existing owner | exact |
| `test/bridges/agents/grant-rewrite.test.ts` | test | file-I/O | existing owner | exact |
| `A/legacy-grant-form.ts` | migration | transform | existing owner | exact |
| `test/bridges/agents/legacy-grant-form.test.ts` | test | transform | existing owner | exact |
| `features/agent/frontmatter.feature` | test | request-response | existing feature | exact |
| `features/plugin/subagent-child.feature` | test | event-driven | existing feature | exact |
| `features/mcp-server/agent-grants.feature` | test | file-I/O | existing feature | exact |
| `features/step_definitions/mcp-server/agent-grants.steps.ts` | test | event-driven | existing child marker setup | exact |
| `test/integration/pi-subagents-child-identity.test.ts` (proposed) | test | event-driven | `test/integration/pi-subagents-child-launch-conformance.test.ts` | role-match |
| `test/integration/real-subagent-child.ts` (proposed fixture) | utility | request-response | tracked research driver listed below | partial |
| `features/lib/real-subagent-child.ts` (optional alternative fixture owner) | utility | request-response | tracked research driver listed below | partial |
| `docs/hooks-compatibility.md` | config/documentation | transform | existing document | exact |

The two proposed real-child fixture paths are alternatives: choose one appropriate owner and reuse it, rather than duplicate provider/process infrastructure. Features may need additional verb steps, recorder helpers, async-process scenarios, compatibility prose and decision-record corrections; count those actual paths when finalizing plans. Research did not prescribe exact filenames for these. Existing child setup is in `features/step_definitions/mcp-server/agent-grants.steps.ts`, **not** a currently existing `plugin/subagent-child.steps.ts`.

## Pattern Assignments

### Identity helper, runtime and translation context

Use factory-local state in `extensions/pi-claude-marketplace/bridges/hooks/runtime.ts:163-184`, not an environment identity or process-global cache:

```typescript
export function createHooksRuntime(): HooksRuntime {
  const parsedConfigCache = new Map<string, CacheEntry>();
  const routingTable = new Map<BucketAEvent, readonly RoutingEntry[]>();
  const children = new Map<string, HooksRuntimeChildEntry>();
  const pidTableOperations = new Map<string, Promise<void>>();
  let generation = 0;
  let trustedProject: string | undefined;
```

Registration resets already live at runtime lines 191-206 and 254-258. Add identity lifecycle alongside these owners; do not conflate agent identity with the async-hook `children` map. Snapshot against the current session ID and reject stale identity after session change. Refresh on every before-run event, including fork/resume. Missing or malformed metadata must clear stale identity, remain classified as child, and produce the bounded diagnostic described in research.

`extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts:25,34-38,58-64` establishes imports, readonly data and session ID provenance:

```typescript
import type { ExtensionContext } from "../../platform/pi-api.ts";
export interface TranslationContext {
  readonly sessionId: string;
  readonly transcriptPath: string;
  readonly cwd: string;
}
export function buildTranslationContext(ctx: ExtensionContext): TranslationContext {
  return {
    sessionId: ctx.sessionManager.getSessionId(),
    transcriptPath: ctx.sessionManager.getSessionFile() ?? "",
    cwd: ctx.cwd,
  };
}
```

Keep the helper small: exact child marker from existing `platform/subagent-child.ts`; parse only the companion prefix at the beginning of structured `customPrompt` or `appendSystemPrompt`, require its delimiter, decode the four producer XML entities once. Do not scan task text or rendered prompts. Research establishes the companion contract; it is not an editable dependency. The selected agent name is authoritative only through that bounded producer format.

### Three tool payloads and both dispatch lanes

Preserve each existing payload owner. `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts:35-42`:

```typescript
return {
  session_id: ctx.sessionId,
  transcript_path: ctx.transcriptPath,
  cwd: ctx.cwd,
  hook_event_name: "PreToolUse",
  tool_name: mapPiToClaudeToolName(event.toolName),
  tool_input: toHookToolInput(event.toolName, event.input, ctx.cwd, homedir()),
};
```

The conditional-property pattern already exists in `post-tool-use.ts:39-44`:

```typescript
return {
  content: event.content,
  ...(event.structuredContent === undefined
    ? {}
    : { structuredContent: event.structuredContent }),
};
```

Use absent properties for main-session `agent_type` and `agent_id`, rather than empty strings or own properties set to undefined. Add identity to pre, success and failure outputs only. Retain `post-tool-use.ts:61-64` file/search/native response precedence, and `post-tool-use-failure.ts:59-61` input codec, error text and `is_interrupt: false`.

Call chain: `dispatch.ts` calls `dispatchHookExec`; `dispatchHookExec` delegates either async flag to `spawnAndRegister`. Both currently construct context independently:

```typescript
// extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:205-208
const transCtx = buildTranslationContext(ctx);
const stdinPayload = buildPayload(entry.claudeEvent, event, transCtx);
const stdinJson = serializeWithTruncation(stdinPayload);
// extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:245-247
const capturedGeneration = runtime.currentGeneration();
const transCtx = buildTranslationContext(ctx);
const stdinPayload = TRANSLATORS[entry.claudeEvent](event as never, transCtx);
```

Thread the same immutable runtime identity through both sites. Preserve async noop reductions, generation capture and existing failure policy. Cover sync, plain async and asyncRewake, not merely direct translator calls.

### Explicit child event policy and router integration

Typed exhaustive lookup precedent is `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:115-128`:

```typescript
const TRANSLATORS: Record<DispatchableEvent, (event: never, ctx: TranslationContext) => unknown> = {
  SessionStart: translateSessionStart,
  UserPromptSubmit: translateUserPromptSubmit,
  PreToolUse: translatePreToolUse,
  PostToolUse: translatePostToolUse,
  PostToolUseFailure: translatePostToolUseFailure,
  PreCompact: translatePreCompact,
  PostCompact: translatePostCompact,
  SessionEnd: translateSessionEnd,
  Stop: translateStop,
  StopFailure: translateStopFailure,
};
```

Use the admitted event union for a complete small policy table, with tagged dispatch/unsupported-subagent/non-dispatched outcomes. Child dispatch permits exactly the three tool events. Keep future SubagentStart/SubagentStop labels outside the admitted union. Explicitly classify both compaction events and the synthetic SessionStart; do not grow a skip-list.

`event-router.ts:1027-1056` supplies runtime generation binding and notification-mode validation. Preserve those guards. Research's inspected integration seams are registration/reaping at 1075-1092, session initialization/trust/hydration at 1133-1171, compaction at 935-986 and 1195-1205, before-run/context drain at 1230-1244, and settle at 1246-1265. Gate semantic dispatch after required setup; do not return early above hydration. Identity capture composes with context delivery. Child shutdown still cleans its owned processes although SessionEnd hooks are suppressed. Main Stop continuation/cap behavior must remain unchanged.

### PID persistence and owner liveness

Use `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts` for imports and atomic contained I/O, **not** as proof its current ownership is safe:

```typescript
// lines 42-48
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { atomicWriteJson } from "../../../shared/atomic-json.ts";
import { hookDebugLog } from "../../../shared/debug-log.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { assertPathInside } from "../../../shared/path-safety.ts";
// lines 147-156
try {
  await assertPathInside(loc.dataRoot, filePath, "async-rewake-pids.json write");
  const payload: PidTableFile = {
    version: ASYNC_REWAKE_PID_TABLE_VERSION,
    entries: [...entries],
  };
  await atomicWriteJson(filePath, payload);
} catch (err) {
  hookDebugLog(`async-rewake: pid-table write failed: ${errorMessage(err)}`);
}
```

Current path at 98-100 is scope-wide. `registry.ts:603-625` reads it, reaps rows absent from this runtime and then replaces/unlinks it. `runtime.ts:342-354` serializes only within one runtime. Therefore skipping child reaping alone is unsafe: spawn, finalization and cleanup still overwrite shared data.

Retain legacy parent format; introduce bounded child journals keyed by trusted/encoded session identity, with owner PID/session metadata. Child paths must never operate on the parent table. Reuse dispatch-marker verification in `registry.ts:629-654` before killing a hook; add positive owner-death evidence before touching foreign child journals. Alive, permission-denied and unknown owner states all preserve them. Eligible parent startup recovers dead-child journals. Reload/teardown cleans this runtime's own in-memory hooks irrespective of semantic event policy. This is new ownership logic, not a general persistence framework.

### Converter and exact warning migration

Modify the current converter at its established conditional frontmatter construction (research identifies `convert.ts:1025-1035`); omit async unless MCP or parsed background true requires it. Preserve background parser semantics and current dependency floor. Generated false changes on update/reinstall, not load.

The old warning must remain a literal compatibility value. `extensions/pi-claude-marketplace/bridges/agents/mcp-async-warning.ts:11-22`:

```typescript
const MCP_ASYNC_WARNING_LEAD =
  "tools include MCP tools, which pi-subagents serves only to background children -- " +
  "the agent runs in the background (`async: true`), where Claude Code runs it in the " +
  "foreground; ";
// exact adapter suffix
"a launch before pi-mcp-adapter has cached the server's tools still fails"
// exact builtin suffix
"a launch before Pi's built-in MCP has listed the server's tools still fails"
```

Keep one exact old/new recognizer beside the emitter. Two current consumers must change together:

```typescript
// grant-rewrite.ts:127-132
return (
  active === "builtin" &&
  row.mcpImplementation === undefined &&
  row.warnings.includes(mcpAsyncWarning("adapter"))
);
// legacy-grant-form.ts:85-88
if (warning === mcpAsyncWarning("adapter")) {
  return mcpAsyncWarning("builtin");
}
```

`grant-rewrite.ts:154-163` compares stored frontmatter bytes; retain that edited-file protection. `legacy-grant-form.ts:141-166` derives both block and warning forms; update both surfaces, while preserving the recorded adapter form for safe comparisons. Test exact old/new adapter/builtin variants, near misses, absent implementation, round trips and edited files. Keep containment, lock checks, staged replacement and index-last persistence.

## Shared Patterns

### Tests and fixtures

Use node:test, node:assert/strict and existing strict doubles. Every modified/new production source needs its paired test. `test/bridges/hooks/translation-context.test.ts:12-23` shows import grouping; lines 62-131 use a real isolated SessionManager, complete deep equality and cleanup in finally. The assertion pattern at 124-130 is:

```typescript
assert.deepStrictEqual(translationContext, {
  sessionId: "session-owned",
  transcriptPath,
  cwd: "/workspace/translation-context",
});
} finally {
  await rm(sessionRoot, { recursive: true, force: true });
}
```

Use complete payload comparisons plus property-absence assertions. Keep identity state tests discriminating: two runtime instances in one PID, repeated runs, changed session, malformed/missing prefix, escaped name decoded once, second spoof tag ignored, main prompt with tag ignored.

Maintained optional-peer lookup precedent: `test/integration/pi-subagents-child-launch-conformance.test.ts:49-64`:

```typescript
const peer = await findCachedPeer("pi-subagents");
t.diagnostic(`pi-subagents ${peer.version} at ${peer.root}`);
return {
  peer,
  launch: await importPeerModule<ChildLaunchModule>(
    peer,
    "src",
    "runs",
    "shared",
    "child-launch.js",
  ),
};
```

Use this resolution pattern instead of hardcoded installed package paths. Installed companion source is research input only, never a production edit target.

Temporary `/tmp/pg3-run-identity.mjs` and `/tmp/pg3-concurrent.mjs` were read as research inputs. Port their mechanics into maintained fixtures: fresh HOME/agent/project dirs, loopback fake provider with dummy key and no network fallback, actual companion launch, bounded readiness/completion, dispose sessions/factory and stop provider on every exit. The concurrent probe uses `Promise.all` for two distinct agent names, append/replace modes, an empty body and a second spoof tag; extend it to assert actual hook payloads and lifecycle absence. The detached probe proves real MCP tool execution; add delegated-default and explicit-background cases. Neither probe currently proves the proposed production changes.

Tracked origins for these mechanics are `.planning/debug/artifacts/real-child-mcp-automation/driver.template.mjs` and `openai-stub-server.mjs`. They are research fixture origins, not a maintained CI abstraction. Do not make tests depend on transient `/tmp` files, absolute repository paths or artifacts surviving in a user's home.

Cucumber child setup currently appears at `features/step_definitions/mcp-server/agent-grants.steps.ts:113-120` with the exact child marker. Reuse the existing feature vertical and hook recorder infrastructure. Recording assertions must enumerate the complete observed set, including failure hooks and a Stop hook that would request another turn. Positive parent controls prevent a globally disabled bridge from passing. PID probes must cover parent/sibling survival through startup, write, exit and teardown, plus dead-owner recovery.

### Cross-cutting constraints

- Trust/auth: preserve project trust before loading/running project hooks; child classification does not grant trust.
- Errors: retain debug-log/errorMessage seams and existing command failure policy; no direct stdout/stderr bridge output.
- Imports: node built-ins first; relative `.ts` project imports; type-only imports separate; Pi API types enter through `platform/pi-api.ts`.
- Validation: strict event/child discriminants, readonly snapshot types and atomic contained writes. New persisted owner metadata must be validated before it controls paths or signals.
- Ordering: identity/routing and child-safe persistence land before ordinary launch defaults change. Deliver both requirements together.
- Verification: focused owner tests during edits; both Cucumber profiles; normal commit hooks; full `npm run check` on the combined tree at GSD gates. This mapping did not run checks or change source.

## No Analog Found

| Behavior / proposed file | Role | Data Flow | Reason |
|---|---|---|---|
| Exact companion prefix parsing in `H/child-identity.ts` | utility | transform | No existing identity parser; use verified research producer contract and bounded tests. |
| Child journal owner-death policy in persistence/registry owners | service | file-I/O | Current table is ownerless; copying its foreign-row reap is unsafe. |
| Real-child identity/lifecycle regression | test | event-driven | Existing maintained conformance test checks launch configuration; temporary probes supply runtime mechanics but lack proposed assertions. |

## Metadata

**Analog search scope:** current hooks/agents bridges, platform child marker, paired tests, Cucumber child/grant integration, maintained companion conformance test and tracked research fixture origins.
**Tracked-source gate:** named analog/source origins verified with `git ls-files`; no ignored runtime mirror is offered as an edit origin. Proposed filenames are explicitly marked.
**Source method:** CodeGraph first, current line-numbered source; research supplies explicitly attributed integration ranges where full router source was not repeated. No production files modified.
**Pattern extraction date:** 2026-11-13.

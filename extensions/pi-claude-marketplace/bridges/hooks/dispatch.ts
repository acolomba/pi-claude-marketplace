// bridges/hooks/dispatch.ts
//
// Composite-handler bodies for the hooks bridge (D-59-01 / D-59-04 /
// D-60-03 / D-CF5-09 / D-CF5-10 / D-CF5-12 / DISP-01 / DISP-03 / OBS-01).
//
// Two exported factories:
//
//   - compositeHandlerFor(claudeEvent, capturedEpoch) returns the closure
//     registered on six of the seven Pi events (session_start,
//     session_shutdown, session_before_compact, session_compact, input,
//     tool_call). Each closure: epoch-checks, looks up the bucket for
//     `claudeEvent`, runs the matching hooks and folds their outcomes, then
//     hands the folded `HookExecResult` to the per-Pi-event adapter
//     (D-60-03) which converts it to the Pi-side handler return shape.
//
//   - toolResultCompositeHandler(capturedEpoch) returns the closure
//     registered on `tool_result`. ONE handler, TWO buckets: the body
//     reads `event.isError` once and routes to PostToolUseFailure or
//     PostToolUse (D-59-01 / DISP-01) before any hook runs.
//
// Running a bucket, as Claude Code 2.1.316 runs an event's hooks:
//   - filter: the per-event matcher, then the entry's `if` (MATCH-03).
//   - dedupe (D-CF5-10): one hook per upstream key, rooted at the plugin's
//     `resolvedSource`; a copy keeps the first copy's position and takes the
//     last copy's handler fields. The same hook in two plugins runs twice.
//   - parallel run (D-CF5-09, superseding DISP-04's sequential fan-out):
//     every hook starts on the same event, and each executor serializes its
//     stdin before its first await, so all of them read one snapshot.
//   - fold in routing order, whatever order the hooks finish in: any `stop`
//     wins (the first supplies the reason); else the first `block`; else the
//     first `ask`; else an allow or a plain mutation, with the last input
//     rewrite in routing order. Every hook's `additionalContext` is joined in
//     routing order, and every hook's outcome is kept, with its
//     `systemMessage`, for the output carriers.
//   - after the fold, the notices go to the user (D-CF5-14), and on a tool
//     event the joined context goes to the model after the tool result, also
//     when the call was denied (D-CF5-13).
//   - a call that pi-mcp-adapter's `mcp` proxy makes in call mode runs no
//     hook: its nested call fires them under the real tool name (D-CF5-12).
//
// All handlers short-circuit when capturedEpoch != currentEpoch() so a
// stale closure from a prior load cannot fire against the live routing
// tables (DISP-03 zombie-defense belt-and-suspenders), and a run whose
// generation changed while its hooks ran folds to noop.

import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { notifyHookNotice } from "../../shared/notification-dispatch.ts";
import { openNotificationRun } from "../../shared/notification-run.ts";

import { dispatchHookExec } from "./dispatch-exec.ts";
import {
  adaptInputResult,
  adaptPreCompactResult,
  adaptObservationResultForEvent,
  adaptToolCallResult,
  adaptToolResultResult,
} from "./event-adapters.ts";
import {
  compactionBlockedText,
  hookErrorText,
  hookEventLabel,
  hookMatchLabel,
  hookSaysText,
  promptBlockedText,
} from "./hook-labels.ts";
import { ifFires } from "./if-field/index.ts";
import { compactTrigger } from "./payloads/compact-trigger.ts";

import type { CompactionCancel, HookAdapterContext } from "./event-adapters.ts";
import type { HookExecResult } from "./exec-result.ts";
import type { HookBlock } from "./hook-labels.ts";
import type { ClaudeSessionEndEvent } from "./payloads/session-end.ts";
import type { ClaudeSessionStartEvent } from "./payloads/session-start.ts";
import type { RoutingEntry } from "./routing-state.ts";
import type { HooksRuntime } from "./runtime.ts";
import type { BucketAEvent, DispatchableEvent } from "../../domain/components/hook-events.ts";
import type { ParsedMatcher } from "../../domain/components/hooks.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  InputEventResult,
  SessionBeforeCompactEvent,
  SessionCompactEvent,
  ToolCallEvent,
  ToolCallEventResult,
  ToolResultEvent,
  ToolResultEventResult,
} from "../../platform/pi-api.ts";

/**
 * The per-entry executor the bucket runners below take as a parameter. Every
 * runner defaults it to the imported `dispatchHookExec`, so production never
 * passes one; a test passes a spy and observes exactly which entries ran, in
 * what order, and with what event.
 *
 * Injected rather than swapped in module scope. ESM imports are read-only
 * bindings, so mocking `dispatchHookExec` in place is impossible -- that used
 * to be answered with a mutable module cell behind `_setExecutorForTest`.
 * Threading the executor through the signature removes the need for the cell
 * AND the reason for the export: there is no module state to reset between
 * tests, and CONVENTIONS.md names injection as the sanctioned form (it makes
 * the dependency part of the public interface instead of reaching inside).
 * The type is bridge-internal and not re-exported via index.ts.
 *
 * D-59-04 signature evolution: the executor returns `Promise<HookExecResult>`
 * so the reducer below can fold outcomes across a bucket.
 */
export type HookExecutor = (
  entry: RoutingEntry,
  event: unknown,
  ctx: ExtensionContext,
  pi: ExtensionAPI | undefined,
  runtime: HooksRuntime,
) => Promise<HookExecResult>;

// ──────────────────────────────────────────────────────────────────────────
// Matcher-fires predicates
// ──────────────────────────────────────────────────────────────────────────

/**
 * Tool-event matcher-fires predicate. A tool-set matcher fires when Pi's
 * runtime `event.toolName` is in its `toolNames` set -- the Pi tool
 * literals a Claude matcher token maps to, plus the MCP tool names Pi
 * emits verbatim -- or starts with one of its MCP server `toolPrefixes`
 * (ANAME-02). The comparison is exact and case-sensitive. The parser
 * already filters regex/unmapped matchers at parse time so those arms are
 * unreachable at dispatch; defensive `false` keeps the switch exhaustive.
 */
function matcherFiresOnToolEvent(matcher: ParsedMatcher, toolName: string): boolean {
  switch (matcher.kind) {
    case "match-all":
      return true;
    case "tool-set":
      return (
        matcher.toolNames.has(toolName) ||
        (matcher.toolPrefixes?.some((prefix) => toolName.startsWith(prefix)) ?? false)
      );
    case "regex":
    case "unmapped":
      return false;
  }
}

/**
 * Closed-set matcher-fires predicate shared by the session and compaction
 * composite paths and the settle-time StopFailure path. The parser admits
 * only match-all (`""` / `"*"`) and exact members of the per-event closed
 * set at parse time, so dispatch-time filtering is literal equality against
 * the event's Claude-side value (the mapped SessionStart `source` and
 * SessionEnd `reason`, D-CF5-01 / D-CF5-02; the PreCompact and PostCompact
 * `trigger`, D-CF5-04; the classified StopFailure error type).
 */
export function matcherFiresOnClosedSetValue(entry: RoutingEntry, value: string): boolean {
  const raw = entry.rawMatcher;
  return raw === "" || raw === "*" || raw === value;
}

// ──────────────────────────────────────────────────────────────────────────
// Running a bucket: filter, dedupe, parallel run (D-CF5-09 / D-CF5-10)
// ──────────────────────────────────────────────────────────────────────────

/**
 * One hook's outcome: the entry that ran and the `HookExecResult` it
 * produced.
 */
export interface BucketOutcome {
  readonly entry: RoutingEntry;
  readonly result: HookExecResult;
}

// D-CF5-10 / E10: the key Claude Code dedupes hooks by (its root, type,
// shell, command, arguments, and `if`), rooted at the plugin root, so the
// same hook in two plugins stays two hooks. A command hook always has a
// command, so an absent one needs no default of its own.
function hookIdentity(entry: RoutingEntry): string {
  const decl = entry.handlerDecl;
  return JSON.stringify([
    entry.resolvedSource,
    decl.type,
    decl.shell ?? "bash",
    decl.command,
    decl.args ?? null,
    decl.if ?? "",
  ]);
}

/**
 * D-CF5-10: one entry per hook key. A Map keeps a key at the position it was
 * first set, so a copy stays at the first copy's position, with the handler
 * fields of the last copy.
 */
function dedupeHooks(entries: readonly RoutingEntry[]): RoutingEntry[] {
  const hooks = new Map<string, RoutingEntry>();
  for (const entry of entries) {
    const key = hookIdentity(entry);
    const first = hooks.get(key);
    hooks.set(key, first === undefined ? entry : { ...first, handlerDecl: entry.handlerDecl });
  }

  return [...hooks.values()];
}

// The entries of `bucket` that run for `event`: the matcher and the `if`
// both fire (MATCH-03 / D-61-02: an `if` that does not match skips the entry,
// it does not block), then one entry per hook.
function matchingHooks(
  bucket: readonly RoutingEntry[],
  event: unknown,
  ctx: ExtensionContext,
  matcherFires: (entry: RoutingEntry) => boolean,
): RoutingEntry[] {
  return dedupeHooks(
    bucket.filter(
      (entry) => matcherFires(entry) && ifFires(entry.ifPredicate, event, ctx, entry.claudeEvent),
    ),
  );
}

/**
 * D-CF5-09: run every hook at once and keep the outcomes in routing order,
 * or `undefined` when the generation changed while they ran.
 */
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

/**
 * Run every matching hook of the bucket in parallel and return each one's
 * outcome in routing order, with no fold. The settle Stop path needs every
 * hook's outcome to honor D-88-05 aggregate precedence: any `continue:false`
 * (stop) among the group suppresses re-entry regardless of another hook's
 * block. A generation change during the run returns no outcome.
 *
 * A hook declaring `asyncRewake:true` cannot yield a SYNCHRONOUS decision --
 * `dispatchHookExec` routes it to the fire-and-forget spawn and returns `noop`
 * before a decision exists -- so running it here would silently drop its
 * block/stop desire. Such an entry is degraded to `noop` with a `hookDebugLog`
 * (rather than a pointless detached spawn) so the dropped decision is
 * observable.
 *
 * Takes the same injected executor as the composite handlers, so one spy
 * drives both paths.
 */
export async function collectBucketOutcomes(
  runtime: HooksRuntime,
  bucket: readonly RoutingEntry[],
  event: unknown,
  ctx: ExtensionContext,
  pi: ExtensionAPI | undefined,
  matcherFires: (entry: RoutingEntry) => boolean,
  executor: HookExecutor = dispatchHookExec,
): Promise<BucketOutcome[]> {
  const hooks = matchingHooks(bucket, event, ctx, matcherFires);
  const outcomes = await runHooks(runtime, hooks, async (entry) => {
    if (entry.handlerDecl.asyncRewake !== true) {
      return executor(entry, event, ctx, pi, runtime);
    }

    hookDebugLog(
      `collectBucketOutcomes: asyncRewake entry cannot yield a synchronous decision (${entry.pluginId}/${entry.claudeEvent}); degrading to noop`,
    );
    return { kind: "noop" };
  });
  return outcomes ?? [];
}

// ──────────────────────────────────────────────────────────────────────────
// Routing-order fold (D-CF5-09 / D-CF5-25)
// ──────────────────────────────────────────────────────────────────────────

/**
 * The fold of a bucket's outcomes: the decision the adapters apply, the
 * entry it is attributed to (the deciding hook, or the last mutating one;
 * `undefined` for a fold of noops), and every hook's outcome in routing
 * order, which the output carriers read.
 */
interface FoldedBucket {
  readonly result: HookExecResult;
  readonly attributedTo: RoutingEntry | undefined;
  readonly outcomes: readonly BucketOutcome[];
}

const NOOP_FOLD: FoldedBucket = { result: { kind: "noop" }, attributedTo: undefined, outcomes: [] };

type MutateResult = Extract<HookExecResult, { kind: "mutate" }>;

interface MutateOutcome {
  readonly entry: RoutingEntry;
  readonly result: MutateResult;
}

// Every hook's non-empty `additionalContext`, joined in routing order, or
// `undefined` when no hook gave one.
function joinedContext(outcomes: readonly BucketOutcome[]): string | undefined {
  const contexts = outcomes.flatMap(({ result }) =>
    result.additionalContext === undefined || result.additionalContext === ""
      ? []
      : [result.additionalContext],
  );
  return contexts.length === 0 ? undefined : contexts.join("\n");
}

function withContext(result: HookExecResult, context: string | undefined): HookExecResult {
  return context === undefined ? result : { ...result, additionalContext: context };
}

// The last value a mutation in routing order sets for `field`, or `undefined`.
function lastSet(
  mutations: readonly MutateOutcome[],
  field: "updatedInput" | "updatedToolOutput",
): unknown {
  return mutations.reduce<unknown>(
    (last, { result }) => (result[field] === undefined ? last : result[field]),
    undefined,
  );
}

// The permission decision of a fold of mutations: the first `ask` asks, else
// any `allow` allows, else none.
function foldedPermission(
  mutations: readonly MutateOutcome[],
): Pick<MutateResult, "permissionDecision" | "permissionDecisionReason"> {
  const ask = mutations.find(({ result }) => result.permissionDecision === "ask")?.result;
  if (ask !== undefined) {
    return ask.permissionDecisionReason === undefined
      ? { permissionDecision: "ask" }
      : { permissionDecision: "ask", permissionDecisionReason: ask.permissionDecisionReason };
  }

  return mutations.some(({ result }) => result.permissionDecision === "allow")
    ? { permissionDecision: "allow" }
    : {};
}

// The fold of outcomes that neither stop nor block.
function foldMutations(
  outcomes: readonly BucketOutcome[],
  context: string | undefined,
): FoldedBucket {
  const mutations = outcomes.flatMap(({ entry, result }) =>
    result.kind === "mutate" ? [{ entry, result }] : [],
  );
  const lastMutation = mutations.at(-1);
  if (lastMutation === undefined) {
    return { result: withContext({ kind: "noop" }, context), attributedTo: undefined, outcomes };
  }

  const result: MutateResult = { kind: "mutate", ...foldedPermission(mutations) };
  const updatedInput = lastSet(mutations, "updatedInput");
  if (updatedInput !== undefined) {
    result.updatedInput = updatedInput;
  }

  const updatedToolOutput = lastSet(mutations, "updatedToolOutput");
  if (updatedToolOutput !== undefined) {
    result.updatedToolOutput = updatedToolOutput;
  }

  const asking = mutations.find((mutation) => mutation.result.permissionDecision === "ask");
  return {
    result: withContext(result, context),
    attributedTo: (asking ?? lastMutation).entry,
    outcomes,
  };
}

/**
 * D-CF5-09 / D-CF5-25: fold outcomes in routing order. Any `stop` wins and
 * the first one supplies its reason; else the first `block` blocks with its
 * reason; else the mutations fold. The joined context rides the folded
 * result whichever arm it is.
 */
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

// Run the matching hooks of `bucket` for `event` and fold their outcomes.
async function runAndFold(
  runtime: HooksRuntime,
  bucket: readonly RoutingEntry[],
  event: unknown,
  ctx: ExtensionContext,
  pi: ExtensionAPI | undefined,
  executor: HookExecutor,
  matcherFires: (entry: RoutingEntry) => boolean,
): Promise<FoldedBucket> {
  const hooks = matchingHooks(bucket, event, ctx, matcherFires);
  const outcomes = await runHooks(runtime, hooks, (entry) =>
    executor(entry, event, ctx, pi, runtime),
  );
  return outcomes === undefined ? NOOP_FOLD : foldOutcomes(outcomes);
}

// ──────────────────────────────────────────────────────────────────────────
// Hook notices (HOOK-05 / D-CF5-14 / D-CF5-24)
// ──────────────────────────────────────────────────────────────────────────

/** The events whose hooks a composite handler runs and whose notices it shows. */
type NoticeEvent = CompositeDispatchEvent | "PostToolUse" | "PostToolUseFailure";

// D-CF5-14: every hook's non-empty `systemMessage`, in routing order.
function systemMessages(outcomes: readonly BucketOutcome[]): string[] {
  return outcomes.flatMap(({ result }) =>
    result.systemMessage === undefined || result.systemMessage === "" ? [] : [result.systemMessage],
  );
}

// D-CF5-14: Claude Code shows a hook's `systemMessage` on these events and
// drops it on the others.
function showsSystemMessages(claudeEvent: NoticeEvent): boolean {
  switch (claudeEvent) {
    case "PreToolUse":
    case "PostToolUse":
    case "PostToolUseFailure":
    case "UserPromptSubmit":
    case "SessionStart":
      return true;
    case "SessionEnd":
    case "PreCompact":
    case "PostCompact":
      return false;
  }
}

// D-CF5-14: the `<label> says: <text>` notices of the bucket's system
// messages, or none, with a debug line, on an event that drops them.
function systemMessageNotices(
  claudeEvent: NoticeEvent,
  label: string,
  outcomes: readonly BucketOutcome[],
): string[] {
  const messages = systemMessages(outcomes);
  if (showsSystemMessages(claudeEvent)) {
    return messages.map((message) => hookSaysText(label, message));
  }

  if (messages.length > 0) {
    hookDebugLog(`dispatch: ${messages.length} systemMessage(s) dropped on ${claudeEvent}`);
  }

  return [];
}

/**
 * D-CF5-11 / D-CF5-18 / D-CF5-24: the notices a block shows the user. A
 * blocked prompt shows why once, with the first block in routing order. A
 * SessionStart, SessionEnd, or PostCompact block changes nothing, so each one
 * shows as the event's hook error, as Claude Code shows exit-2 stderr there.
 * A PreCompact block cancels the compaction and shows one notice that names
 * every blocking hook, as Claude Code reports a blocked compaction. A tool
 * block goes to the model instead.
 */
function blockNotices(claudeEvent: NoticeEvent, label: string, folded: FoldedBucket): string[] {
  switch (claudeEvent) {
    case "UserPromptSubmit":
      return folded.result.kind === "block"
        ? blocks(folded.outcomes)
            .slice(0, 1)
            .map(({ reason, command, fromStderr }) =>
              promptBlockedText(reason, command, fromStderr),
            )
        : [];
    case "SessionStart":
    case "SessionEnd":
    case "PostCompact":
      return blocks(folded.outcomes).map(({ reason, command, fromStderr }) =>
        hookErrorText(label, reason, command, fromStderr),
      );
    case "PreCompact": {
      // Every block counts, as on upstream: a stop in the fold does not hide one.
      const blocked = blocks(folded.outcomes);
      return blocked.length > 0 ? [compactionBlockedText(blocked)] : [];
    }

    case "PreToolUse":
    case "PostToolUse":
    case "PostToolUseFailure":
      return [];
  }
}

// Each blocking outcome, in routing order, with the hook's declared command,
// empty when the hook declares none, as the adapters name it.
function blocks(outcomes: readonly BucketOutcome[]): HookBlock[] {
  return outcomes.flatMap(({ entry, result }) =>
    result.kind === "block"
      ? [
          {
            reason: result.reason,
            command: entry.handlerDecl.command ?? "",
            fromStderr: result.fromStderr === true,
          },
        ]
      : [],
  );
}

/**
 * HOOK-05: every notice a folded bucket shows the user, labeled `label`: the
 * system messages in routing order (D-CF5-09), then the block notices.
 */
function hookNotices(claudeEvent: NoticeEvent, label: string, folded: FoldedBucket): string[] {
  return [
    ...systemMessageNotices(claudeEvent, label, folded.outcomes),
    ...blockNotices(claudeEvent, label, folded),
  ];
}

/**
 * HOOK-05 / D-CF5-14: show the user each notice, in order, through one
 * hook-origin notification run. A notice goes only to the notify chokepoint,
 * never to the model. With no Pi API there is no run to open, so the notices
 * are dropped with a debug line; a notice that fails to show is debug-logged
 * and never fails the event.
 */
function showHookNotices(
  ctx: ExtensionContext,
  pi: ExtensionAPI | undefined,
  notices: readonly string[],
): void {
  if (notices.length === 0) {
    return;
  }

  if (pi === undefined) {
    hookDebugLog(`dispatch: no Pi API to show ${notices.length} hook notice(s)`);
    return;
  }

  try {
    const run = openNotificationRun(pi, { kind: "hook" });
    for (const notice of notices) {
      notifyHookNotice(ctx, run, notice);
    }
  } catch (error: unknown) {
    hookDebugLog(`dispatch: hook notice failed: ${errorMessage(error)}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Tool hook context (HOOK-04 / D-CF5-13)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Custom-message type of a tool hook's additional context. Distinct from the
 * prompt and session context type and from the Stop and async-rewake
 * re-entry types, so each carrier stays separable in the transcript.
 */
const TOOL_CONTEXT_CUSTOM_TYPE = "claude-hook-tool-context" as const;

/**
 * D-CF5-13: send the folded `additionalContext` of a PreToolUse,
 * PostToolUse, or PostToolUseFailure bucket to the model as one hidden
 * message, `<label> hook additional context: <values>`, also when a hook
 * denied the call. While the agent streams, `triggerTurn: false` queues the
 * message until the turn ends, so the next model call reads it after the
 * tool result, as a user message. No context, an empty one, or no Pi API
 * sends nothing; a send that throws is debug-logged and never fails the
 * event.
 */
function sendToolContext(
  pi: ExtensionAPI | undefined,
  label: string,
  result: HookExecResult,
): void {
  const context = result.additionalContext;
  if (pi === undefined || context === undefined || context === "") {
    return;
  }

  try {
    pi.sendMessage(
      {
        customType: TOOL_CONTEXT_CUSTOM_TYPE,
        content: `${label} hook additional context: ${context}`,
        display: false,
      },
      { triggerTurn: false },
    );
  } catch (error: unknown) {
    hookDebugLog(`dispatch: tool hook context failed: ${errorMessage(error)}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// pi-mcp-adapter's proxy (D-CF5-12)
// ──────────────────────────────────────────────────────────────────────────

const MCP_PROXY_TOOL = "mcp";
const MCP_TOOL_PREFIX = "mcp__";

/**
 * D-CF5-12: a call pi-mcp-adapter's proxy makes in call mode: the tool is
 * `mcp` or a namespace proxy `mcp__<server>` (a name with no further
 * `__<tool>` part), the input names a `tool` as a string, and it sets no
 * `action`. The adapter runs the real tool as a nested Pi call, which fires
 * the hooks under the real name, so the outer call fires none. A search,
 * describe, or status call still fires hooks as the proxy tool.
 */
function isMcpProxyCall(event: { readonly toolName: string; readonly input: object }): boolean {
  const { toolName } = event;
  const proxy =
    toolName === MCP_PROXY_TOOL ||
    (toolName.startsWith(MCP_TOOL_PREFIX) &&
      !toolName.slice(MCP_TOOL_PREFIX.length).includes("__"));
  if (!proxy) {
    return false;
  }

  const { tool, action } = event.input as { readonly tool?: unknown; readonly action?: unknown };
  return typeof tool === "string" && action === undefined;
}

// ──────────────────────────────────────────────────────────────────────────
// Composite-handler factories
// ──────────────────────────────────────────────────────────────────────────

/**
 * The event domain served by `compositeHandlerFor`: every dispatchable
 * event except the two `tool_result`-routed events (handled by
 * `toolResultCompositeHandler`) and the two settle-routed events (handled
 * in `settle.ts`). Declared once so the exclusion set cannot drift between
 * the factory constraint and its private helpers.
 */
export type CompositeDispatchEvent = Exclude<
  DispatchableEvent,
  "PostToolUse" | "PostToolUseFailure" | "Stop" | "StopFailure"
>;

/**
 * D-CF5-13: a prompt's context belongs to that prompt's own turn. Context an
 * earlier `input` buffered for a turn that never started (a prompt another
 * extension handled, or one whose run failed to start) is dropped when the
 * next prompt arrives, before its hooks run, so it never reaches a later
 * prompt's turn. A prompt that Pi does not queue arrives while no agent
 * runs, so a follow-up context still waiting belongs to a follow-up that Pi
 * did not read, and is dropped too.
 */
function dropStalePromptContext(runtime: HooksRuntime, event: InputEvent): void {
  const stale = runtime.drainPendingPromptContext();
  if (stale.length > 0) {
    hookDebugLog(`dispatch: dropped ${stale.length} stale UserPromptSubmit context(s)`);
  }

  if (event.streamingBehavior !== undefined) {
    return;
  }

  const unread = runtime.drainFollowUpContext();
  if (unread.length > 0) {
    hookDebugLog(`dispatch: dropped ${unread.length} unread follow-up context(s)`);
  }
}

/**
 * D-59-01 / D-60-03: six-uniform composite handler factory.
 *
 * `claudeEvent` constrains which bucket the closure reads and which
 * per-Pi-event adapter narrows the reducer's final result. The runtime
 * `event` is typed via `CompositeEventFor<E>` so each closure exposes
 * the Pi-shape its registration point expects; the per-event filter
 * narrows the matcher-fires path at access time.
 *
 * Return type: `CompositeReturnFor<E>` -- the Pi-side handler return
 * shape selected by the adapter table (tool_call returns
 * `ToolCallEventResult | undefined`; input returns `InputEventResult |
 * undefined`; observation events return `undefined`).
 *
 * `executor` defaults to `dispatchHookExec` and runs each matching hook.
 * `registerHooksBridge` threads its own optional `executor`
 * into every call here, so a test can register the real bridge against a spy
 * and assert on dispatch without spawning a child (see `HookExecutor`).
 */
export function compositeHandlerFor<E extends CompositeDispatchEvent>(
  runtime: HooksRuntime,
  claudeEvent: E,
  capturedGeneration: number,
  pi?: ExtensionAPI,
  executor: HookExecutor = dispatchHookExec,
): (event: CompositeEventFor<E>, ctx: ExtensionContext) => Promise<CompositeReturnFor<E>> {
  return async (event, ctx) => {
    if (capturedGeneration !== runtime.currentGeneration()) {
      return undefined as CompositeReturnFor<E>;
    }

    if (claudeEvent === "UserPromptSubmit") {
      dropStalePromptContext(runtime, event as InputEvent);
    }

    const bucket = runtime.getRoutingBucket(claudeEvent);
    if (bucket.length === 0 || isProxiedToolCall(claudeEvent, event)) {
      return undefined as CompositeReturnFor<E>;
    }

    const folded = await runAndFold(runtime, bucket, event, ctx, pi, executor, (entry) =>
      entryFires(claudeEvent, entry, event),
    );
    const label = noticeLabel(claudeEvent, event);
    showHookNotices(ctx, pi, hookNotices(claudeEvent, label, folded));
    if (claudeEvent === "PreToolUse") {
      sendToolContext(pi, label, folded.result);
    }

    const context = { runtime, ctx, pi, attributedTo: folded.attributedTo };
    return (await adaptForEvent(claudeEvent, folded, event, context)) as CompositeReturnFor<E>;
  };
}

/**
 * D-59-01 / D-60-03: `tool_result` composite handler. Reads
 * `event.isError` once, picks the PostToolUseFailure bucket on truthy or
 * PostToolUse on falsy/undefined, then runs and folds the bucket's matching
 * hooks. DISP-01 (event.isError split) happens before any hook runs; DISP-03
 * epoch check at entry; the call-mode `mcp` proxy runs no hook (D-CF5-12).
 *
 * Returns `ToolResultEventResult | undefined` via
 * `adaptToolResultResult` (D-60-03).
 *
 * `executor` is the same injected seam `compositeHandlerFor` takes, defaulted
 * and forwarded identically.
 */
export function toolResultCompositeHandler(
  runtime: HooksRuntime,
  capturedGeneration: number,
  pi?: ExtensionAPI,
  executor: HookExecutor = dispatchHookExec,
): (event: ToolResultEvent, ctx: ExtensionContext) => Promise<ToolResultEventResult | undefined> {
  return async (event, ctx) => {
    if (capturedGeneration !== runtime.currentGeneration()) {
      return undefined;
    }

    const claudeEvent = event.isError ? "PostToolUseFailure" : "PostToolUse";
    const bucket = runtime.getRoutingBucket(claudeEvent);
    if (bucket.length === 0 || isMcpProxyCall(event)) {
      return undefined;
    }

    const folded = await runAndFold(runtime, bucket, event, ctx, pi, executor, (entry) =>
      matcherFiresOnToolEvent(entry.matcher, event.toolName),
    );
    const label = hookEventLabel(claudeEvent, event.toolName);
    showHookNotices(ctx, pi, hookNotices(claudeEvent, label, folded));
    sendToolContext(pi, label, folded.result);

    return adaptToolResultResult(folded.result, event, {
      runtime,
      ctx,
      pi,
      attributedTo: folded.attributedTo,
    });
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Per-Pi-event adapter dispatch (D-60-03)
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-60-03: dispatch the folded HookExecResult to the matching per-Pi-event
 * adapter. The PreCompact adapter reads every hook's own result instead
 * (D-CF5-18), because the fold lets a stop hide a block. Observation events
 * have no Pi-side return slot -- their adapter
 * is invoked for the SessionStart context buffer and the block/stop
 * debug-log side effect and always returns undefined.
 */
async function adaptForEvent(
  claudeEvent: CompositeDispatchEvent,
  folded: FoldedBucket,
  event: unknown,
  context: HookAdapterContext,
): Promise<ToolCallEventResult | InputEventResult | CompactionCancel | undefined> {
  const { result } = folded;
  switch (claudeEvent) {
    case "PreToolUse":
      // D-CF5-11: an ask may wait on the user's answer in the terminal.
      return await adaptToolCallResult(result, event as ToolCallEvent, context);
    case "UserPromptSubmit":
      return adaptInputResult(result, event as InputEvent, context);
    case "PreCompact":
      return adaptPreCompactResult(folded.outcomes.map((outcome) => outcome.result));
    case "SessionStart":
    case "SessionEnd":
    case "PostCompact":
      adaptObservationResultForEvent(result, claudeEvent, context);
      return undefined;
  }
}

// D-CF5-12: a PreToolUse event for a call the `mcp` proxy makes in call mode.
function isProxiedToolCall(claudeEvent: CompositeDispatchEvent, event: unknown): boolean {
  if (claudeEvent !== "PreToolUse") {
    return false;
  }

  return isMcpProxyCall(event as ToolCallEvent);
}

// ──────────────────────────────────────────────────────────────────────────
// Internal: per-event filter dispatch
// ──────────────────────────────────────────────────────────────────────────

/**
 * Type bridge: each non-tool-result Claude event maps to the event shape its
 * composite handler receives, so the factory's closure signature narrows
 * appropriately. SessionStart and SessionEnd receive the Claude-side event
 * the router maps from Pi's reason once (D-CF5-01 / D-CF5-02), so the filter
 * and the translator read one value; the other events receive their Pi
 * event.
 */
export type CompositeEventFor<E extends BucketAEvent> = E extends "SessionStart"
  ? ClaudeSessionStartEvent
  : E extends "SessionEnd"
    ? ClaudeSessionEndEvent
    : E extends "PreCompact"
      ? SessionBeforeCompactEvent
      : E extends "PostCompact"
        ? SessionCompactEvent
        : E extends "UserPromptSubmit"
          ? InputEvent
          : E extends "PreToolUse"
            ? ToolCallEvent
            : never;

/**
 * D-60-03: per-event return type bridge mapping each composite-handler
 * `claudeEvent` to the Pi-side handler return shape its registered
 * closure must produce. PreToolUse -> ToolCallEventResult;
 * UserPromptSubmit -> InputEventResult; PreCompact -> a cancel of the
 * compaction (D-CF5-18); the other observation events -> undefined (Pi
 * handler return slot is void for those).
 */
export type CompositeReturnFor<E extends BucketAEvent> = E extends "PreToolUse"
  ? ToolCallEventResult | undefined
  : E extends "UserPromptSubmit"
    ? InputEventResult | undefined
    : E extends "PreCompact"
      ? CompactionCancel | undefined
      : undefined;

/**
 * The value a matcher of `claudeEvent` selects on: the mapped SessionStart
 * `source` and SessionEnd `reason` (D-CF5-01 / D-CF5-02), the PreToolUse Pi
 * tool name, and the Claude compaction `trigger` the translators also send
 * (D-CF5-04). UserPromptSubmit has none, because the parser rejects a
 * non-empty matcher on it.
 */
function matchValue(claudeEvent: CompositeDispatchEvent, event: unknown): string | undefined {
  switch (claudeEvent) {
    case "SessionStart":
      return (event as ClaudeSessionStartEvent).source;
    case "SessionEnd":
      return (event as ClaudeSessionEndEvent).reason;
    case "PreToolUse":
      return (event as ToolCallEvent).toolName;
    case "PreCompact":
      return compactTrigger((event as SessionBeforeCompactEvent).reason);
    case "PostCompact":
      return compactTrigger((event as SessionCompactEvent).reason);
    case "UserPromptSubmit":
      return undefined;
  }
}

/**
 * Per-event filter dispatch on the event's match value: a PreToolUse matcher
 * compares the tool name, every other matcher the closed-set value.
 * UserPromptSubmit fires unconditionally.
 */
function entryFires(
  claudeEvent: CompositeDispatchEvent,
  entry: RoutingEntry,
  event: unknown,
): boolean {
  const value = matchValue(claudeEvent, event);
  if (value === undefined) {
    return true;
  }

  return claudeEvent === "PreToolUse"
    ? matcherFiresOnToolEvent(entry.matcher, value)
    : matcherFiresOnClosedSetValue(entry, value);
}

/**
 * D-CF5-14: the label of an event's notices, as Claude Code names its hooks:
 * `PreToolUse:<Claude tool>`, `<Event>:<value>` for a closed-set matcher
 * (`SessionStart:startup`), and `UserPromptSubmit` alone.
 */
function noticeLabel(claudeEvent: CompositeDispatchEvent, event: unknown): string {
  const value = matchValue(claudeEvent, event);
  if (value === undefined) {
    return claudeEvent;
  }

  return claudeEvent === "PreToolUse"
    ? hookEventLabel(claudeEvent, value)
    : hookMatchLabel(claudeEvent, value);
}

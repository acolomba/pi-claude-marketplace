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
//     PostToolUse (D-59-01 / DISP-01) before any hook runs. A failed
//     result under the turn's aborted signal is a call the user cancelled,
//     and it runs no PostToolUseFailure hook, sync or async (D-BG-402).
//     While pi-mcp-adapter is the active implementation, a result it marks
//     with its MCP call failure codes counts as failed too (D-BG-404).
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
//   - while pi-mcp-adapter is the active MCP implementation, a call that its
//     `mcp` proxy makes in call mode runs no hook: its nested call fires them
//     under the real tool name (D-CF5-12). Under Pi's built-in MCP, or with
//     none, no call is a proxy call (MHK-02, D-P5-06).
//   - a tool of Pi's built-in MCP is compared and seen under its server's
//     registered name, with `-` kept, as Claude Code names it (MHK-01,
//     D-P5-03).
//
// All handlers short-circuit when capturedEpoch != currentEpoch() so a
// stale closure from a prior load cannot fire against the live routing
// tables (DISP-03 zombie-defense belt-and-suspenders), and a run whose
// generation changed while its hooks ran folds to noop.

import { homedir } from "node:os";

import { closedSetMatcherValues } from "../../domain/components/hook-events.ts";
import { mapPiToClaudeToolName } from "../../domain/components/hook-tool-names.ts";
import {
  claudeFormToolName,
  looksLikeCutAdapterToolName,
  MCP_TOOL_PREFIX,
  recoverAdapterToolName,
  toolLiteralNames,
} from "../../domain/components/hooks/builtin-mcp-tool-names.ts";
import { joinedAdapterToolName } from "../../domain/mcp-implementation.ts";
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
  notifyIgnoredToolInputRewrite,
  replaceToolCallInput,
} from "./event-adapters.ts";
import {
  compactionBlockedText,
  hookErrorText,
  hookEventLabel,
  hookFailureText,
  hookMatchLabel,
  hookSaysText,
  postCompactLineText,
  promptBlockedText,
} from "./hook-labels.ts";
import { ifFires } from "./if-field/index.ts";
import { createHookToolView } from "./mcp-tool-view.ts";
import { compactTrigger } from "./payloads/compact-trigger.ts";
import { withToolFacts } from "./payloads/tool-event-facts.ts";
import { expansionPrompt } from "./payloads/user-prompt-expansion.ts";
import { decideEditBatch, editPairToolUseId, editPairViews } from "./tool-batch.ts";

import type { CompactionCancel, HookAdapterContext } from "./event-adapters.ts";
import type { HookExecResult, HookFailure } from "./exec-result.ts";
import type { HookBlock } from "./hook-labels.ts";
import type { HookToolView } from "./mcp-tool-view.ts";
import type { ClaudeSessionEndEvent } from "./payloads/session-end.ts";
import type { ClaudeSessionStartEvent } from "./payloads/session-start.ts";
import type { HookToolFacts } from "./payloads/tool-event-facts.ts";
import type { UserPromptExpansionEvent } from "./payloads/user-prompt-expansion.ts";
import type { RoutingEntry } from "./routing-state.ts";
import type { HooksRuntime } from "./runtime.ts";
import type { BucketAEvent, DispatchableEvent } from "../../domain/components/hook-events.ts";
import type { McpToolIdentity } from "../../domain/components/hooks/builtin-mcp-tool-names.ts";
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
 * so the fold below can combine outcomes across a bucket.
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
 * Exact members retain the native mapping and MCP recovery rules. Regexes
 * test the recovered Claude-form name, including mapped native tool names.
 */
function matcherFiresOnToolEvent(matcher: ParsedMatcher, tool: McpToolIdentity): boolean {
  switch (matcher.kind) {
    case "match-all":
      return true;
    case "tool-set":
      return [...matcher.toolNames].some((literal) => toolLiteralNames(literal, tool));
    case "regex":
      return matcher.pattern.test(mapPiToClaudeToolName(claudeFormToolName(tool)));
    case "name-set":
    case "invalid-pattern":
    case "unmapped":
      return false;
  }
}

/**
 * D-PG6-19 / D-PG2-10: a UserPromptExpansion matcher selects the command
 * name: an exact-list member equals it, a regular expression is tested
 * against it unanchored and case-sensitive, and an empty matcher or `*`
 * selects every command.
 */
function matcherFiresOnCommandName(matcher: ParsedMatcher, commandName: string): boolean {
  switch (matcher.kind) {
    case "match-all":
      return true;
    case "name-set":
      return matcher.names.has(commandName);
    case "regex":
      return matcher.pattern.test(commandName);
    case "tool-set":
    case "invalid-pattern":
    case "unmapped":
      return false;
  }
}

/**
 * Closed-set matcher-fires predicate shared by the session and compaction
 * composite paths and the settle-time StopFailure path. The parser keeps only
 * match-all (`""` / `"*"`) and lists with a member of the event's closed set
 * (D-BG-302, CLOSEDLIST-01), so a hook fires when the event's Claude-side
 * value is one of its listed values, exactly and case-sensitively (the mapped
 * SessionStart `source` and SessionEnd `reason`, D-CF5-01 / D-CF5-02; the
 * PreCompact and PostCompact `trigger`, D-CF5-04; the classified StopFailure
 * error type).
 */
export function matcherFiresOnClosedSetValue(entry: RoutingEntry, value: string): boolean {
  const raw = entry.rawMatcher;
  return (
    raw === "" || raw === "*" || closedSetMatcherValues(entry.claudeEvent, raw).includes(value)
  );
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
// it does not block), then one entry per hook. A tool event's `if` compares
// `tool`, the event's tool as the dispatch named it (D-P5-04).
function matchingHooks(
  bucket: readonly RoutingEntry[],
  event: unknown,
  ctx: ExtensionContext,
  matcherFires: (entry: RoutingEntry) => boolean,
  tool?: McpToolIdentity,
): RoutingEntry[] {
  return dedupeHooks(
    bucket.filter(
      (entry) =>
        matcherFires(entry) && ifFires(entry.ifPredicate, event, ctx, entry.claudeEvent, tool),
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
 * A hook declaring `async` or `asyncRewake` reaches the executor too, whose
 * background branch spawns it and returns `noop`, so it never decides the
 * settle; an `asyncRewake` one that exits 2 wakes the model through the
 * registry, as Claude Code runs it (D-BG-206).
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
  const outcomes = await runHooks(runtime, hooks, (entry) =>
    executor(entry, event, ctx, pi, runtime),
  );
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
  field: "updatedInput" | "updatedToolOutput" | "updatedMCPToolOutput",
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

  const updatedMCPToolOutput = lastSet(mutations, "updatedMCPToolOutput");
  if (updatedMCPToolOutput !== undefined) {
    result.updatedMCPToolOutput = updatedMCPToolOutput;
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

// Choose from the original result so an invalid or unchanged later candidate
// cannot erase a replacement accepted from an earlier hook.
function acceptedToolOutput(
  outcomes: readonly BucketOutcome[],
  event: ToolResultEvent,
  tool: McpToolIdentity,
  context: HookAdapterContext,
): ToolResultEventResult | undefined {
  const mcpTool = tool.builtinServer !== undefined || tool.piName.startsWith(MCP_TOOL_PREFIX);
  let accepted: ToolResultEventResult | undefined;
  for (const { result } of outcomes) {
    if (result.kind !== "mutate") {
      continue;
    }

    let candidate = result.updatedToolOutput;
    if (candidate === undefined && mcpTool) {
      candidate = result.updatedMCPToolOutput;
    }

    if (candidate === undefined) {
      continue;
    }

    const patch = adaptToolResultResult(
      { kind: "mutate", updatedToolOutput: candidate },
      event,
      context,
    );
    if (patch !== undefined) {
      accepted = patch;
    }
  }

  return accepted;
}

// Run the matching hooks of `bucket` for the view's event and fold their
// outcomes.
async function runAndFold(
  runtime: HooksRuntime,
  bucket: readonly RoutingEntry[],
  view: HookEventView,
  ctx: ExtensionContext,
  pi: ExtensionAPI | undefined,
  executor: HookExecutor,
  matcherFires: (entry: RoutingEntry) => boolean,
): Promise<FoldedBucket> {
  const { event } = view;
  const hooks = matchingHooks(bucket, event, ctx, matcherFires, view.tool);
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

/** The events whose failure notices `failureNotices` builds: Stop's too. */
export type FailureNoticeEvent =
  CompositeDispatchEvent | "PostToolUse" | "PostToolUseFailure" | "Stop";

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
    case "UserPromptExpansion":
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
 * blocked prompt or expansion shows why once, with the first block in routing
 * order, and `originalPrompt` after it unless that hook suppressed it
 * (D-PG6-20). A
 * SessionStart or SessionEnd block changes nothing, so each one shows as the
 * event's hook error, as Claude Code shows exit-2 stderr there. A PostCompact
 * block shows in its hook's line after a manual compaction (D-BG-501).
 * A PreCompact block cancels the compaction and shows one notice that names
 * every blocking hook, as Claude Code reports a blocked compaction. A tool
 * block goes to the model instead.
 */
function blockNotices(
  claudeEvent: NoticeEvent,
  label: string,
  folded: FoldedBucket,
  originalPrompt: string | undefined,
): string[] {
  switch (claudeEvent) {
    case "UserPromptSubmit":
    case "UserPromptExpansion":
      return folded.result.kind === "block"
        ? blocks(folded.outcomes)
            .slice(0, 1)
            .map(({ reason, command, fromStderr, suppressOriginalPrompt }) =>
              promptBlockedText(
                claudeEvent,
                reason,
                command,
                fromStderr,
                suppressOriginalPrompt === true ? undefined : originalPrompt,
              ),
            )
        : [];
    case "SessionStart":
    case "SessionEnd":
      return blocks(folded.outcomes).map(({ reason, command, fromStderr }) =>
        hookErrorText(label, reason, command, fromStderr),
      );
    case "PreCompact": {
      // Every block counts, as on upstream: a stop in the fold does not hide one.
      const blocked = blocks(folded.outcomes);
      return blocked.length > 0 ? [compactionBlockedText(blocked)] : [];
    }

    // D-BG-501: the PostCompact notice lists every hook's end instead.
    case "PostCompact":
      return [];

    case "PreToolUse":
    case "PostToolUse":
    case "PostToolUseFailure":
      return [];
  }
}

/**
 * D-BG-504: the command a PostCompact line names, as Claude Code shows a
 * command hook: the declared `command` with its placeholders, then an
 * exec-form hook's `args` joined by single spaces, each one as `planSpawn`
 * passes it.
 */
function displayCommand(entry: RoutingEntry): string {
  const { command, args } = entry.handlerDecl;
  const words = Array.isArray(args)
    ? args.map((arg: unknown) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
    : [];
  return [command ?? "", ...words].join(" ");
}

/**
 * D-BG-501 / D-BG-502: the notice that lists how each PostCompact hook ended,
 * one line per hook that carries its run, in routing order. Claude Code shows
 * the lines after `/compact` only; after an automatic compaction they are
 * dropped with a debug line.
 */
function postCompactNotices(
  trigger: "manual" | "auto",
  outcomes: readonly BucketOutcome[],
): string[] {
  const lines = outcomes.flatMap(({ entry, result }) =>
    result.postCompactRun === undefined
      ? []
      : [
          postCompactLineText(
            displayCommand(entry),
            result.postCompactRun.succeeded,
            result.postCompactRun.output,
          ),
        ],
  );
  if (lines.length === 0) {
    return [];
  }

  if (trigger === "auto") {
    hookDebugLog(
      `dispatch: ${lines.length} PostCompact line(s) not shown after an automatic compaction`,
    );
    return [];
  }

  return [lines.join("\n")];
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
            ...(result.suppressOriginalPrompt === true ? { suppressOriginalPrompt: true } : {}),
          },
        ]
      : [],
  );
}

// D-PG5-10: Claude Code shows a hook's non-blocking failure on these events.
// A SessionEnd failure stays a debug line (D-BG-603), and the line after
// `/compact` already reports a PostCompact failure (D-BG-501).
function showsFailures(claudeEvent: FailureNoticeEvent): boolean {
  switch (claudeEvent) {
    case "Stop":
    case "PreToolUse":
    case "PostToolUse":
    case "PostToolUseFailure":
    case "UserPromptSubmit":
    case "UserPromptExpansion":
    case "SessionStart":
    case "PreCompact":
      return true;
    case "SessionEnd":
    case "PostCompact":
      return false;
  }
}

// D-PG5-12: the key of a start failure's once-only notice, as Claude Code
// 2.1.323 keys it: the event, a colon, and the declared command with the
// plugin root filled in.
function startFailureKey(claudeEvent: FailureNoticeEvent, entry: RoutingEntry): string {
  const command = (entry.handlerDecl.command ?? "").replaceAll(
    /\$\{CLAUDE_PLUGIN_ROOT\}|\$CLAUDE_PLUGIN_ROOT\b/g,
    () => entry.resolvedSource,
  );
  return `${claudeEvent}:${command}`;
}

/**
 * A notice text, and for a hook that cannot start the key that shows it once
 * in a bridge load (D-PG5-12).
 */
export interface HookNotice {
  readonly text: string;
  readonly startFailureKey?: string;
}

// D-PG5-12: a failed exit and a missing script show on every event, and a
// hook that cannot start shows once for each event and resolved command in a
// bridge load.
function failureNotice(
  claudeEvent: FailureNoticeEvent,
  entry: RoutingEntry,
  failure: HookFailure,
  text: string,
): HookNotice {
  return failure.kind === "exit" || failure.kind === "missing-script"
    ? { text }
    : { text, startFailureKey: startFailureKey(claudeEvent, entry) };
}

/**
 * D-PG5-10 / D-PG5-12: one `<label> hook error: ...` notice for each hook that
 * failed without blocking, in routing order. The failures are read from each
 * hook's own result, because the fold keeps none of them. A hook that runs
 * once for each pair of an edit shows an equal notice once. The Stop
 * dispatcher in `./settle.ts` builds its failure notices here too, and shows
 * each through `showHookNotice`.
 */
export function failureNotices(
  claudeEvent: FailureNoticeEvent,
  label: string,
  outcomes: readonly BucketOutcome[],
): HookNotice[] {
  if (!showsFailures(claudeEvent)) {
    return [];
  }

  const built: { readonly entry: RoutingEntry; readonly notice: HookNotice }[] = [];
  for (const { entry, result } of outcomes) {
    if (result.kind !== "noop" || result.failure === undefined) {
      continue;
    }

    const text = hookFailureText(label, result.failure, {
      command: entry.handlerDecl.command ?? "",
      plugin: entry.pluginId,
      marketplace: entry.marketplace,
      scope: entry.scope,
    });
    const repeated = built.some((prior) => prior.entry === entry && prior.notice.text === text);
    if (!repeated) {
      built.push({ entry, notice: failureNotice(claudeEvent, entry, result.failure, text) });
    }
  }

  return built.map(({ notice }) => notice);
}

/**
 * D-PG5-12: shows `notice` through `show` unless this bridge load already
 * showed its start failure. The start failure is recorded only after `show`
 * returns, so a notice that fails to show can show at the next failure.
 */
export function showHookNotice(
  runtime: HooksRuntime,
  notice: HookNotice,
  show: (text: string) => void,
): void {
  const key = notice.startFailureKey;
  if (key !== undefined && runtime.startFailureNoticeShown(key)) {
    return;
  }

  show(notice.text);
  if (key !== undefined) {
    runtime.recordStartFailureNotice(key);
  }
}

/**
 * HOOK-05: the notices of a folded bucket's decisions, labeled `label`: the
 * system messages in routing order (D-CF5-09), then the block notices, which
 * end with `originalPrompt` when there is one (D-PG6-20).
 */
function decisionNotices(
  claudeEvent: NoticeEvent,
  label: string,
  folded: FoldedBucket,
  originalPrompt?: string,
): string[] {
  return [
    ...systemMessageNotices(claudeEvent, label, folded.outcomes),
    ...blockNotices(claudeEvent, label, folded, originalPrompt),
  ];
}

/**
 * HOOK-05: every notice a folded bucket shows the user, labeled `label`: the
 * decision notices, then the failure notices (D-PG5-12).
 */
function hookNotices(
  claudeEvent: NoticeEvent,
  label: string,
  folded: FoldedBucket,
  originalPrompt?: string,
): (string | HookNotice)[] {
  return [
    ...decisionNotices(claudeEvent, label, folded, originalPrompt),
    ...failureNotices(claudeEvent, label, folded.outcomes),
  ];
}

/**
 * HOOK-05 / D-CF5-14: show the user each notice, in order, through one
 * hook-origin notification run. A notice goes only to the notify chokepoint,
 * never to the model. With no Pi API there is no run to open, so the notices
 * are dropped with a debug line; a notice that fails to show is debug-logged
 * and never fails the event. A start failure is recorded only once shown
 * (D-PG5-12).
 */
function showHookNotices(
  runtime: HooksRuntime,
  ctx: ExtensionContext,
  pi: ExtensionAPI | undefined,
  notices: readonly (string | HookNotice)[],
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
      showHookNotice(runtime, typeof notice === "string" ? { text: notice } : notice, (text) => {
        notifyHookNotice(ctx, run, text);
      });
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

/**
 * D-CF5-12: the shape of a call pi-mcp-adapter's proxy makes in call mode:
 * the tool is `mcp` or a namespace proxy `mcp__<server>` (a name with no
 * further `__<tool>` part), the input names a `tool` as a string, and it sets
 * no `action`. The adapter runs the real tool as a nested Pi call, which fires
 * the hooks under the real name, so the outer call fires none. A search,
 * describe, or status call still fires hooks as the proxy tool.
 *
 * MHK-02, D-P5-06: the shape counts only while the adapter is the active MCP
 * implementation (`HookToolView.proxyRuleApplies`). Pi's built-in MCP has no
 * proxy, and a tool name it cut inside the namespace has the same shape.
 * D-PG1-08: an adapter cut is a direct tool even when its input names a `tool`;
 * the adapter's proxy is `mcp`, and this extension registers direct tools.
 * Namespace proxies serve proxy-only servers; a long namespace has `_mcpns_`
 * and a 16-digit hash, so it cannot have the cut shape. A third-party proxy
 * namespace could coincide with a 64-character cut shape by chance; its outer
 * call would then run hooks alongside its nested call.
 */
function isMcpProxyCall(event: { readonly toolName: string; readonly input: object }): boolean {
  const { toolName } = event;
  if (looksLikeCutAdapterToolName(toolName)) {
    return false;
  }

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
 * `toolResultCompositeHandler`), the two settle-routed events (handled
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

// D-PG6-06: the default clock of the two tool handlers, in milliseconds. It
// is monotonic, so a change of the wall clock cannot change a duration.
function monotonicNow(): number {
  return performance.now();
}

/**
 * D-59-01 / D-60-03: six-uniform composite handler factory.
 *
 * `claudeEvent` constrains which bucket the closure reads and which
 * per-Pi-event adapter narrows the fold's final result. The runtime
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
 *
 * `tools` identifies a PreToolUse event's tool (D-P5-01) and says whether pi-mcp-adapter's proxy rule applies (D-P5-06); it defaults to
 * a view over `pi`, which reads nothing until a tool event's bucket has hooks.
 * The router passes one view to both tool handlers of a generation (D-P5-07).
 *
 * `now` is the clock of the PreToolUse mark (D-PG6-06); production passes none.
 */
export function compositeHandlerFor<E extends CompositeDispatchEvent>(
  runtime: HooksRuntime,
  claudeEvent: E,
  capturedGeneration: number,
  pi?: ExtensionAPI,
  executor: HookExecutor = dispatchHookExec,
  tools: HookToolView = createHookToolView(pi),
  now: () => number = monotonicNow,
): (event: CompositeEventFor<E>, ctx: ExtensionContext) => Promise<CompositeReturnFor<E>> {
  const handler = async (
    event: CompositeEventFor<E>,
    ctx: ExtensionContext,
  ): Promise<CompositeReturnFor<E>> => {
    if (capturedGeneration !== runtime.currentGeneration()) {
      return undefined as CompositeReturnFor<E>;
    }

    if (claudeEvent === "PreToolUse") {
      runtime.recordToolCall();
    }

    if (claudeEvent === "UserPromptSubmit") {
      dropStalePromptContext(runtime, event as InputEvent);
    }

    const bucket = runtime.getRoutingBucket(claudeEvent);
    if (bucket.length === 0) {
      return undefined as CompositeReturnFor<E>;
    }

    const view = hookEventView(runtime, claudeEvent, event, tools);
    if (view === undefined) {
      return undefined as CompositeReturnFor<E>;
    }

    if (
      claudeEvent === "PreToolUse" &&
      (event as ToolCallEvent).toolName === "edit" &&
      Array.isArray(((event as ToolCallEvent).input as Record<string, unknown> | null)?.edits)
    ) {
      return (await runEditPreflight(
        runtime,
        bucket,
        view,
        ctx,
        pi,
        executor,
        capturedGeneration,
      )) as CompositeReturnFor<E>;
    }

    const folded = await runAndFold(runtime, bucket, view, ctx, pi, executor, (entry) =>
      entryFires(claudeEvent, entry, view),
    );
    const label = noticeLabel(claudeEvent, view.event);
    showHookNotices(
      runtime,
      ctx,
      pi,
      hookNotices(claudeEvent, label, folded, originalPromptOf(claudeEvent, view.event)),
    );
    if (claudeEvent === "PreToolUse") {
      sendToolContext(pi, label, folded.result);
    }

    if (claudeEvent === "PostCompact") {
      const trigger = compactTrigger((view.event as SessionCompactEvent).reason);
      showHookNotices(runtime, ctx, pi, postCompactNotices(trigger, folded.outcomes));
    }

    const context = { runtime, ctx, pi, attributedTo: folded.attributedTo };
    return (await adaptForEvent(claudeEvent, folded, view.event, context)) as CompositeReturnFor<E>;
  };

  return claudeEvent === "PreToolUse"
    ? markedOnExit(runtime, capturedGeneration, handler, now)
    : handler;
}

/**
 * D-PG6-06: the mark of a call is the time its PreToolUse handler ends, on
 * every exit path, also with no PreToolUse hook and for a blocked call. A
 * handler of a stale generation keeps no mark.
 */
function markedOnExit<V, R>(
  runtime: HooksRuntime,
  capturedGeneration: number,
  handler: (event: V, ctx: ExtensionContext) => Promise<R>,
  now: () => number,
): (event: V, ctx: ExtensionContext) => Promise<R> {
  return async (event, ctx) => {
    try {
      return await handler(event, ctx);
    } finally {
      if (capturedGeneration === runtime.currentGeneration()) {
        const call = event as ToolCallEvent;
        runtime.recordToolCallPrepared(call.toolCallId, call.parentToolCallId, now());
      }
    }
  };
}

async function authorizeEditPairs(
  pairRuns: readonly { readonly event: ToolCallEvent; readonly folded: FoldedBucket }[],
  contextFor: (folded: FoldedBucket) => HookAdapterContext,
  runtime: HooksRuntime,
  capturedGeneration: number,
  ctx: ExtensionContext,
): Promise<ToolCallEventResult | undefined> {
  const decisions = await Promise.all(
    pairRuns.map(({ event, folded }) =>
      folded.result.kind === "mutate"
        ? adaptToolCallResult(
            { ...folded.result, updatedInput: undefined },
            event,
            contextFor(folded),
          )
        : Promise.resolve(undefined),
    ),
  );
  if (capturedGeneration !== runtime.currentGeneration() || ctx.signal?.aborted) {
    return undefined;
  }

  return decisions.find((decision) => decision?.block);
}

// Each pair carries its own tool use id, while hook stdin sees one Claude Edit
// input (D-PG6-05). Pi still receives just the original native tool call.
async function runEditPreflight(
  runtime: HooksRuntime,
  bucket: readonly RoutingEntry[],
  view: HookEventView,
  ctx: ExtensionContext,
  pi: ExtensionAPI | undefined,
  executor: HookExecutor,
  capturedGeneration: number,
): Promise<ToolCallEventResult | undefined> {
  const nativeEvent = view.event as ToolCallEvent;
  const batch = editPairViews(nativeEvent.input, ctx.cwd, homedir());
  if (batch === undefined) {
    return undefined;
  }

  const hooks = matchingHooks(
    bucket,
    view.event,
    ctx,
    (entry) => entryFires("PreToolUse", entry, view),
    view.tool,
  );
  const runs = await Promise.all(
    batch.pairs.map(async (pair) => {
      const pairEvent: ToolCallEvent = {
        ...nativeEvent,
        toolCallId: editPairToolUseId(nativeEvent.toolCallId, pair.index, batch.pairs.length),
        input: pair.input,
      };
      const outcomes = await runHooks(runtime, hooks, (entry) =>
        executor(entry, pairEvent, ctx, pi, runtime),
      );
      return outcomes === undefined
        ? undefined
        : { event: pairEvent, folded: foldOutcomes(outcomes) };
    }),
  );
  const pairRuns = runs.filter((run): run is NonNullable<typeof run> => run !== undefined);
  if (pairRuns.length !== batch.pairs.length) {
    return undefined;
  }

  if (capturedGeneration !== runtime.currentGeneration() || ctx.signal?.aborted) {
    return undefined;
  }

  const label = noticeLabel("PreToolUse", nativeEvent);
  for (const { folded } of pairRuns) {
    showHookNotices(runtime, ctx, pi, decisionNotices("PreToolUse", label, folded));
    sendToolContext(pi, label, folded.result);
  }

  // D-PG5-12: an equal failure of one hook across the pairs shows once.
  const outcomes = pairRuns.flatMap(({ folded }) => folded.outcomes);
  showHookNotices(runtime, ctx, pi, failureNotices("PreToolUse", label, outcomes));

  const contextFor = (folded: FoldedBucket): HookAdapterContext => ({
    runtime,
    ctx,
    pi,
    attributedTo: folded.attributedTo,
  });
  const decisive =
    pairRuns.find(({ folded }) => folded.result.kind === "stop") ??
    pairRuns.find(({ folded }) => folded.result.kind === "block");
  if (decisive !== undefined) {
    return adaptToolCallResult(decisive.folded.result, decisive.event, contextFor(decisive.folded));
  }

  const authorization = await authorizeEditPairs(
    pairRuns,
    contextFor,
    runtime,
    capturedGeneration,
    ctx,
  );
  if (capturedGeneration !== runtime.currentGeneration() || ctx.signal?.aborted) {
    return undefined;
  }

  if (authorization?.block) {
    return authorization;
  }

  const decision = decideEditBatch(
    batch,
    pairRuns.map(({ folded: { outcomes } }) =>
      outcomes.map(({ result }) => (result.kind === "mutate" ? result.updatedInput : undefined)),
    ),
    ctx.cwd,
    homedir(),
  );
  switch (decision.kind) {
    case "block":
      return { block: true, reason: "PreToolUse:Edit hook error: conflicting edit targets" };
    case "original":
      notifyIgnoredToolInputRewrite(nativeEvent, contextFor(NOOP_FOLD), decision.category);
      return undefined;
    case "accepted":
      replaceToolCallInput(nativeEvent, decision.input);
      return undefined;
    case "unchanged":
      return undefined;
  }
}

// D-BG-402: Claude Code fires no PostToolUseFailure hook on a running tool
// that the user cancels, and Pi still reports such a call as a failed result,
// under the turn's aborted signal.
function isCancelledFailure(failed: boolean, ctx: ExtensionContext): boolean {
  return failed && ctx.signal?.aborted === true;
}

// D-BG-404: pi-mcp-adapter returns a failed MCP tool call with no result-level
// `isError` and sets the flag in its own `tool_result` handler, which Pi runs
// after this extension's. Only its two MCP call failure codes count, and only
// while it is the active implementation.
const ADAPTER_FAILURE_CODES: ReadonlySet<string> = new Set(["tool_error", "call_failed"]);

// D-BG-404: reads the result's details first, so the proxy rule is read only
// for a result that carries one of the adapter's failure codes.
function adapterReportsFailure(event: ToolResultEvent, tools: HookToolView): boolean {
  const details: unknown = event.details;
  const code =
    typeof details === "object" && details !== null && "error" in details
      ? details.error
      : undefined;
  return typeof code === "string" && ADAPTER_FAILURE_CODES.has(code) && tools.proxyRuleApplies();
}

// D-BG-404: the result as the hooks see it, marked failed when the adapter
// reported a failure; Pi's own fields are shared, not copied.
function routedToolResult(event: ToolResultEvent, tools: HookToolView): ToolResultEvent {
  if (event.isError || !adapterReportsFailure(event, tools)) {
    return event;
  }

  return { ...event, isError: true };
}

/**
 * D-59-01 / D-60-03: `tool_result` composite handler. Reads
 * `event.isError` once, picks the PostToolUseFailure bucket on truthy or
 * PostToolUse on falsy/undefined, then runs and folds the bucket's matching
 * hooks. DISP-01 (event.isError split) happens before any hook runs; DISP-03
 * epoch check at entry; while pi-mcp-adapter is the active implementation,
 * the call-mode `mcp` proxy runs no hook (D-CF5-12, MHK-02). When the
 * PostToolUseFailure bucket has hooks and the turn's signal is aborted, the
 * call was cancelled and no hook of the bucket starts (D-BG-402); the signal
 * is read only then. While pi-mcp-adapter is the active implementation, a
 * result it marks with an MCP call failure code takes the PostToolUseFailure
 * bucket, and every later step sees it failed (D-BG-404); the handler's
 * return value never sets `isError` itself.
 *
 * Returns `ToolResultEventResult | undefined` via
 * `adaptToolResultResult` (D-60-03).
 *
 * `executor` is the same injected seam `compositeHandlerFor` takes, defaulted
 * and forwarded identically, and so is `tools`, which identifies the event's
 * tool (D-P5-01). `now` is the clock that reads the call's duration as the
 * handler starts, and the hooks read it as `hookDurationMs` on the event
 * (D-PG6-06).
 */
export function toolResultCompositeHandler(
  runtime: HooksRuntime,
  capturedGeneration: number,
  pi?: ExtensionAPI,
  executor: HookExecutor = dispatchHookExec,
  tools: HookToolView = createHookToolView(pi),
  now: () => number = monotonicNow,
): (event: ToolResultEvent, ctx: ExtensionContext) => Promise<ToolResultEventResult | undefined> {
  return async (piEvent, ctx) => {
    if (capturedGeneration !== runtime.currentGeneration()) {
      return undefined;
    }

    const facts = takeToolFacts(runtime, piEvent, now);
    const event = routedToolResult(piEvent, tools);
    const claudeEvent = event.isError ? "PostToolUseFailure" : "PostToolUse";
    const bucket = runtime.getRoutingBucket(claudeEvent);
    if (bucket.length === 0) {
      return undefined;
    }

    if (isCancelledFailure(event.isError, ctx)) {
      hookDebugLog("dispatch: no PostToolUseFailure hook on a cancelled tool call");
      return undefined;
    }

    const verifiedName = event.isError ? undefined : adapterResultToolName(event.details);
    const seen = toolEventView(event, tools, () => toolEventMcpLiterals(runtime), verifiedName);
    if (seen === undefined) {
      return undefined;
    }

    const view = {
      event: withToolFacts(seen.event, { ...facts, ...mcpServerFacts(runtime, seen.tool) }),
      tool: seen.tool,
    };
    const batch =
      event.toolName === "edit" ? editPairViews(event.input, ctx.cwd, homedir()) : undefined;
    const folded =
      batch === undefined
        ? await runAndFold(runtime, bucket, view, ctx, pi, executor, (entry) =>
            matcherFiresOnToolEvent(entry.matcher, view.tool),
          )
        : await runEditResultPairs(runtime, bucket, view, batch.pairs, ctx, pi, executor);
    const label = hookEventLabel(claudeEvent, view.event.toolName);
    showHookNotices(runtime, ctx, pi, hookNotices(claudeEvent, label, folded));
    sendToolContext(pi, label, folded.result);

    const adapterContext = {
      runtime,
      ctx,
      pi,
      attributedTo: folded.attributedTo,
    };
    if (folded.result.kind !== "mutate" || view.event.isError) {
      return adaptToolResultResult(folded.result, view.event, adapterContext);
    }

    return acceptedToolOutput(folded.outcomes, view.event, view.tool, adapterContext);
  };
}

// D-PG6-06: the call's duration, taken on entry, so its mark is removed
// whatever the handler does next.
function takeToolFacts(
  runtime: HooksRuntime,
  event: ToolResultEvent,
  now: () => number,
): HookToolFacts {
  const hookDurationMs = runtime.takeToolDuration(event.toolCallId, now());
  return hookDurationMs === undefined ? {} : { hookDurationMs };
}

// D-PG6-07: the plugin MCP server of the event's tool, as a fact of the event
// the hooks read; none when the runtime knows no server of the tool.
function mcpServerFacts(runtime: HooksRuntime, tool: McpToolIdentity): HookToolFacts {
  const hookMcpServer = runtime.mcpServerFor(tool);
  return hookMcpServer === undefined ? {} : { hookMcpServer };
}

// Each hook receives a pair input and the same native result carriers. Pair
// outcomes are folded in pair order, then routing order, after every run ends.
async function runEditResultPairs(
  runtime: HooksRuntime,
  bucket: readonly RoutingEntry[],
  view: { readonly event: ToolResultEvent; readonly tool: McpToolIdentity },
  pairs: readonly { readonly input: ToolResultEvent["input"] }[],
  ctx: ExtensionContext,
  pi: ExtensionAPI | undefined,
  executor: HookExecutor,
): Promise<FoldedBucket> {
  const event = view.event;
  const hooks = matchingHooks(
    bucket,
    event,
    ctx,
    (entry) => matcherFiresOnToolEvent(entry.matcher, view.tool),
    view.tool,
  );
  const capturedGeneration = runtime.currentGeneration();
  const runs = await Promise.all(
    pairs.map(({ input }, index) => {
      if (capturedGeneration !== runtime.currentGeneration()) {
        return Promise.resolve(undefined);
      }

      const pairEvent: ToolResultEvent = {
        ...event,
        toolCallId: editPairToolUseId(event.toolCallId, index, pairs.length),
        input,
      };
      return runHooks(runtime, hooks, (entry) => executor(entry, pairEvent, ctx, pi, runtime));
    }),
  );
  if (!runs.every((outcomes): outcomes is BucketOutcome[] => outcomes !== undefined)) {
    return NOOP_FOLD;
  }

  return foldOutcomes(runs.flat());
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
      return adaptInputResult(result, event as InputEvent, context, claudeEvent);
    case "UserPromptExpansion":
      // D-PG6-20: the expansion's context joins the buffer of its line's prompt.
      return adaptInputResult(
        result,
        (event as UserPromptExpansionEvent).input,
        context,
        claudeEvent,
      );
    case "PreCompact":
      return adaptPreCompactResult(folded.outcomes.map((outcome) => outcome.result));
    case "SessionStart":
    case "SessionEnd":
    case "PostCompact":
      adaptObservationResultForEvent(result, claudeEvent, context);
      return undefined;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Internal: per-event filter dispatch
// ──────────────────────────────────────────────────────────────────────────

/**
 * Type bridge: each non-tool-result Claude event maps to the event shape its
 * composite handler receives, so the factory's closure signature narrows
 * appropriately. SessionStart and SessionEnd receive the Claude-side event
 * the router maps from Pi's reason once (D-CF5-01 / D-CF5-02), so the filter
 * and the translator read one value; UserPromptExpansion receives the
 * synthetic event of its translator (D-PG6-19); the other events receive
 * their Pi event.
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
          : E extends "UserPromptExpansion"
            ? UserPromptExpansionEvent
            : E extends "PreToolUse"
              ? ToolCallEvent
              : never;

/**
 * D-60-03: per-event return type bridge mapping each composite-handler
 * `claudeEvent` to the Pi-side handler return shape its registered
 * closure must produce. PreToolUse -> ToolCallEventResult;
 * UserPromptSubmit and UserPromptExpansion -> InputEventResult; PreCompact -> a cancel of the
 * compaction (D-CF5-18); the other observation events -> undefined (Pi
 * handler return slot is void for those).
 */
export type CompositeReturnFor<E extends BucketAEvent> = E extends "PreToolUse"
  ? ToolCallEventResult | undefined
  : E extends "UserPromptSubmit" | "UserPromptExpansion"
    ? InputEventResult | undefined
    : E extends "PreCompact"
      ? CompactionCancel | undefined
      : undefined;

/**
 * The value of `claudeEvent` that its notice label names and a closed-set
 * matcher selects on: the mapped SessionStart `source` and SessionEnd
 * `reason` (D-CF5-01 / D-CF5-02), the PreToolUse tool name as the hooks see
 * it (D-P5-03), and the Claude compaction `trigger` the translators also send
 * (D-CF5-04). UserPromptSubmit has none, because the parser rejects a
 * non-empty matcher on it. UserPromptExpansion has none: its matcher selects
 * on the command name (`matcherFiresOnCommandName`), and Claude Code 2.1.323
 * names its hooks by the event alone.
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
    case "UserPromptExpansion":
      return undefined;
  }
}

/**
 * The event the hooks of one dispatch read, and the tool their matchers
 * compare (D-P5-01, D-P5-03): Pi's event and no tool for an event that names
 * none; for a tool event, the event as the hooks see it and its tool.
 */
interface HookEventView {
  readonly event: unknown;
  readonly tool: McpToolIdentity | undefined;
}

function toolEventMcpLiterals(runtime: HooksRuntime): string[] {
  const events = ["PreToolUse", "PostToolUse", "PostToolUseFailure"] as const;
  return events.flatMap((event) =>
    runtime
      .getRoutingBucket(event)
      .flatMap((entry) => [
        ...(entry.matcher.kind === "tool-set" ? entry.matcher.toolNames : []),
        ...(entry.ifPredicate.kind === "mcp-literal" ? [entry.ifPredicate.toolName] : []),
      ]),
  );
}

/**
 * D-PG1-08: successful pi-mcp-adapter results name the server key and tool;
 * failed results name only the server. A successful PostToolUse event can
 * recover the full name; PostToolUseFailure needs a hook literal to do so.
 */
function adapterResultToolName(details: unknown): string | undefined {
  if (
    typeof details !== "object" ||
    details === null ||
    !("server" in details) ||
    !("tool" in details) ||
    typeof details.server !== "string" ||
    typeof details.tool !== "string"
  ) {
    return undefined;
  }

  return joinedAdapterToolName(details.server, details.tool);
}

/**
 * D-P5-03 / D-PG1-08: a tool event recovers an adapter name once from
 * verified result details or tool-event hook literals, then derives the name every hook sees.
 * Pi's event itself when the names agree, else a shallow copy that
 * shares Pi's `input` and `content`, so an input rewrite still reaches Pi.
 * Only an `mcp__` name changes, and Pi types such an event as its open-ended
 * custom tool event, whose `toolName` is any string, so the copy keeps the
 * event's type.
 *
 * No view, and so no hook, for a call pi-mcp-adapter's proxy makes while the
 * adapter is the active implementation (D-CF5-12, MHK-02). The shape check
 * comes first, so only a proxy-shaped call asks for the implementation
 * (D-P5-07), and a skipped call reads no tool.
 */
function toolEventView<T extends ToolCallEvent | ToolResultEvent>(
  event: T,
  tools: HookToolView,
  candidates: () => readonly string[],
  verifiedName?: string,
): { readonly event: T; readonly tool: McpToolIdentity } | undefined {
  if (isMcpProxyCall(event) && tools.proxyRuleApplies()) {
    return undefined;
  }

  const tool = recoverAdapterToolName(tools.identify(event.toolName), candidates, verifiedName);
  const toolName = event.toolName.startsWith("mcp__") ? claudeFormToolName(tool) : event.toolName;
  return { event: toolName === event.toolName ? event : { ...event, toolName }, tool };
}

function hookEventView(
  runtime: HooksRuntime,
  claudeEvent: CompositeDispatchEvent,
  event: unknown,
  tools: HookToolView,
): HookEventView | undefined {
  if (claudeEvent !== "PreToolUse") {
    return { event, tool: undefined };
  }

  const seen = toolEventView(event as ToolCallEvent, tools, () => toolEventMcpLiterals(runtime));
  return seen === undefined
    ? undefined
    : { event: withToolFacts(seen.event, mcpServerFacts(runtime, seen.tool)), tool: seen.tool };
}

/**
 * Per-event filter dispatch: a PreToolUse matcher compares the event's tool,
 * a UserPromptExpansion matcher the command name, every other matcher the
 * closed-set match value. UserPromptSubmit fires unconditionally.
 */
function entryFires(
  claudeEvent: CompositeDispatchEvent,
  entry: RoutingEntry,
  view: HookEventView,
): boolean {
  if (view.tool !== undefined) {
    return matcherFiresOnToolEvent(entry.matcher, view.tool);
  }

  if (claudeEvent === "UserPromptExpansion") {
    return matcherFiresOnCommandName(
      entry.matcher,
      (view.event as UserPromptExpansionEvent).command_name,
    );
  }

  const value = matchValue(claudeEvent, view.event);
  return value === undefined || matcherFiresOnClosedSetValue(entry, value);
}

// D-PG6-20: the typed command an expansion block notice ends with. The
// UserPromptSubmit block notice still leaves its prompt out (D-CF5-24).
function originalPromptOf(claudeEvent: CompositeDispatchEvent, event: unknown): string | undefined {
  return claudeEvent === "UserPromptExpansion"
    ? expansionPrompt(event as UserPromptExpansionEvent)
    : undefined;
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

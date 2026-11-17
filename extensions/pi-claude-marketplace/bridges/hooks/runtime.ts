import { isSubagentChild } from "../../platform/subagent-child.ts";

import { findMcpServer } from "./mcp-server-table.ts";

import type { BucketAEvent } from "../../domain/components/hook-events.ts";
import type { McpToolIdentity } from "../../domain/components/hooks/builtin-mcp-tool-names.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { AssistantMessage, BeforeAgentStartEvent } from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";
import type { ChildRootSession } from "./child-root-session.ts";
import type { ChildLike, TimerLadder } from "./exec-timer.ts";
import type { McpServerEntry } from "./mcp-server-table.ts";
import type { HookMcpServer } from "./payloads/tool-event-facts.ts";
import type {
  CacheEntry,
  PendingFollowUpContext,
  PendingPromptContext,
  PendingSessionStartContext,
  RoutingEntry,
} from "./routing-state.ts";
import type { StreamText } from "./stream-text.ts";

/**
 * STOP-07: the number of consecutive Stop continuations allowed. The next
 * blocking outcome is overridden; settle passes this value to the warning.
 */
export const STOP_OVERRIDE_CAP = 8;

/** One runtime's journal identity, fixed at its first child spawn in a session. */
export interface ChildJournalOwner {
  readonly ownerPid: number;
  readonly sessionId: string;
  readonly ownerToken: string;
  readonly loc: ScopedLocations;
}

export interface MainChildIdentity {
  readonly kind: "main";
}

export interface UnavailableChildIdentity {
  readonly kind: "unavailable";
}

export interface KnownChildIdentity {
  readonly kind: "known";
  readonly agentType: string;
  readonly childId: string;
  /** D-PG6-02: the session that launched the child, once one was resolved for it. */
  readonly root?: ChildRootSession;
}

export type ChildIdentity = MainChildIdentity | UnavailableChildIdentity | KnownChildIdentity;

const ACTIVE_AGENT_PREFIX = /^<active_agent name="((?:[^"&<>]|&(?:amp|quot|lt|gt);)+)"\/>\n\n/;
const XML_ENTITY_VALUES = {
  "&amp;": "&",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
} as const;

function parseIdentitySection(section: string | undefined): string | null | undefined {
  if (!section?.startsWith("<active_agent")) {
    return undefined;
  }

  const encoded = ACTIVE_AGENT_PREFIX.exec(section)?.[1];
  if (encoded === undefined) {
    return null;
  }

  return encoded.replace(
    /&(?:amp|quot|lt|gt);/g,
    (entity) => XML_ENTITY_VALUES[entity as keyof typeof XML_ENTITY_VALUES],
  );
}

/** One live async-rewake child owned by a hooks runtime. */
export interface HooksRuntimeChildEntry {
  readonly dispatchId: string;
  readonly pid: number;
  readonly scope: "user" | "project";
  readonly marketplace: string;
  readonly pluginId: string;
  readonly claudeEvent: BucketAEvent;
  readonly spawnedAt: string;
  readonly rewakeMessage: string | undefined;
  readonly rewakeSummary: string | undefined;
  readonly child: ChildLike;
  readonly ladder: TimerLadder;
  readonly stdout: StreamText;
  readonly stderr: StreamText;
  readonly capturedGeneration: number;
  readonly loc: ScopedLocations;
  readonly persistenceOwner?: ChildJournalOwner;
}

/** Persisted PID-table row derived from a runtime-owned child. */
export interface HooksRuntimePidEntry {
  readonly pid: number;
  readonly dispatchId: string;
  readonly scope: "user" | "project";
  readonly marketplace: string;
  readonly plugin: string;
  readonly spawnedAt: string;
}

/** Result of advancing the shared Stop re-entry counter. */
export interface StopReentryTransition {
  readonly reenter: boolean;
  readonly notifyCap: boolean;
}

/**
 * Owns all mutable state that lives for one hooks extension lifecycle.
 *
 * Operations expose domain values and snapshots rather than mutable state
 * containers. A second runtime therefore starts cold and cannot affect the
 * first runtime's routes, settle state, children, or persistence ordering.
 */
export interface HooksRuntime {
  readonly currentGeneration: () => number;
  readonly advanceGeneration: () => number;
  readonly setParsedConfig: (key: string, entry: CacheEntry) => void;
  readonly deleteParsedConfig: (key: string) => void;
  readonly parsedConfigEntries: () => ReadonlyMap<string, CacheEntry>;
  readonly getRoutingBucket: (event: BucketAEvent) => readonly RoutingEntry[];
  readonly setRoutingBucket: (event: BucketAEvent, entries: readonly RoutingEntry[]) => void;
  readonly routingTableEntries: () => ReadonlyMap<BucketAEvent, readonly RoutingEntry[]>;
  /**
   * D-LOC-01: records whether Pi trusts the project at `cwd`, as the last
   * project hydrate read it from the session's context.
   */
  readonly recordProjectTrust: (cwd: string, trusted: boolean) => void;
  /**
   * D-LOC-01: whether the last recorded answer says that Pi trusts the
   * project at `cwd`. No record, or a record for another directory, is no.
   */
  readonly isProjectTrusted: (cwd: string) => boolean;
  /**
   * D-PG6-07: replaces the plugin MCP servers of `scope` with `entries`, as
   * the scope's hydrate read them from its installation state.
   */
  readonly setMcpServers: (scope: Scope, entries: readonly McpServerEntry[]) => void;
  /**
   * D-PG6-07: the plugin MCP server of `tool` among the servers of both
   * scopes, or `undefined` when none or two different servers claim it.
   */
  readonly mcpServerFor: (tool: McpToolIdentity) => HookMcpServer | undefined;
  readonly appendPendingSessionStartContext: (entry: PendingSessionStartContext) => void;
  readonly pendingSessionStartContextEntries: () => readonly PendingSessionStartContext[];
  readonly drainPendingSessionStartContext: () => readonly PendingSessionStartContext[];
  readonly appendPendingPromptContext: (entry: PendingPromptContext) => void;
  readonly pendingPromptContextEntries: () => readonly PendingPromptContext[];
  readonly drainPendingPromptContext: () => readonly PendingPromptContext[];
  readonly queueFollowUpContext: (entry: PendingFollowUpContext) => void;
  readonly takeFollowUpContext: (prompt: string) => PendingFollowUpContext | undefined;
  readonly drainFollowUpContext: () => readonly PendingFollowUpContext[];
  readonly preparePendingContextForRegistration: () => void;
  readonly prepareSettleForRegistration: () => void;
  readonly recordLastAssistant: (message: AssistantMessage | undefined) => void;
  readonly takeLastAssistant: () => AssistantMessage | undefined;
  /**
   * D-PG5-03: takes the cached last assistant message only when its stop
   * reason is `stop`, for the Stop hooks at the boundary. Any other message
   * stays cached for `agent_settled`, which runs StopFailure on a `length`
   * or `error` ending.
   */
  readonly takeStopEnding: () => AssistantMessage | undefined;
  /**
   * D-PG5-13: keeps the `stopReason` of a Stop hook's `continue: false`
   * until the run is known to stop. Pi decides whether the run goes on only
   * after every boundary handler, so the bridge cannot know at its own turn.
   */
  readonly holdStopReason: (reason: string) => void;
  /** D-PG5-13: takes the held `stopReason`, or `undefined` when none is held. */
  readonly takeHeldStopReason: () => string | undefined;
  /** D-PG5-06: marks the Stop boundary handler as running its hooks. */
  readonly openStopBoundary: () => void;
  /** D-PG5-06: marks the Stop boundary handler as done with its hooks. */
  readonly closeStopBoundary: () => void;
  /**
   * D-BG-210 / D-PG5-06: records that an async rewake sent its wake. A wake
   * sent while the Stop boundary is open continues the run that is settling,
   * so no run start records the mark; this sets it instead, and the next
   * Stop run sees `stop_hook_active: true`. Outside the boundary it does
   * nothing, and the run start that the wake causes records the mark.
   */
  readonly recordRewakeSent: () => void;
  /**
   * The value of a Stop payload's `stop_hook_active`: true after a Stop
   * re-entry (STOP-07), or in a run that an async rewake started (D-BG-210).
   */
  readonly isStopHookActive: () => boolean;
  readonly recordStopReentry: () => StopReentryTransition;
  /**
   * D-PG5-12: whether this bridge load already showed the notice of a hook
   * that cannot start, keyed by its event and resolved command. Claude Code
   * shows a start failure once.
   */
  readonly startFailureNoticeShown: (key: string) => boolean;
  /** D-PG5-12: records that the start failure notice of `key` was shown. */
  readonly recordStartFailureNotice: (key: string) => void;
  readonly recordStopNonReentry: () => void;
  readonly recordToolCall: () => void;
  /**
   * D-PG6-06: keeps `now`, in milliseconds, as the mark of the call
   * `toolCallId` at the end of its PreToolUse dispatch. A call with no
   * `parentToolCallId` also becomes the last top-level mark: Pi prepares
   * every call of a parallel batch before it runs any of them.
   */
  readonly recordToolCallPrepared: (
    toolCallId: string,
    parentToolCallId: string | undefined,
    now: number,
  ) => void;
  /**
   * D-PG6-06: removes the mark of the call `toolCallId` and returns the whole
   * milliseconds to `now` from the later of its mark and the last top-level
   * mark, never negative, or `undefined` when the call has no mark. So the
   * PreToolUse hooks of the calls prepared after it are not in it, and a
   * call that another tool issued, prepared after every top-level call,
   * counts from its own mark.
   */
  readonly takeToolDuration: (toolCallId: string, now: number) => number | undefined;
  /**
   * D-PG6-06: drops the mark of every call and the last top-level mark, so a
   * call that never ends keeps none.
   */
  readonly clearToolCallMarks: () => void;
  readonly recordUserInput: () => void;
  /**
   * D-BG-210: records whether the run that starts is one an async rewake
   * started. Claude Code starts the query that a rewake wakes with its Stop
   * guard set and keeps it to that query's end, so the Stop hooks at the end
   * of that run see `stop_hook_active: true`, and the next run start clears
   * the mark. User input that joins the woken run leaves the mark. The mark
   * leaves the Stop re-entry flag and the STOP-07 cap as they are.
   */
  readonly recordRunStart: (startedByRewake: boolean) => void;
  readonly resetChildIdentity: () => void;
  readonly captureChildIdentity: (event: BeforeAgentStartEvent, sessionId: string) => void;
  readonly childIdentityFor: (sessionId: string) => ChildIdentity;
  /**
   * D-PG6-02: keeps `root`, or no root, as the launching session of the
   * session the identity was captured for; for another session it does
   * nothing. A reset or a capture for another session drops it.
   */
  readonly recordChildRoot: (sessionId: string, root: ChildRootSession | undefined) => void;
  /** D-PG6-02: whether a root, or no root, was recorded for `sessionId`. */
  readonly childRootResolved: (sessionId: string) => boolean;
  readonly registerChild: (entry: HooksRuntimeChildEntry) => void;
  readonly takeChild: (dispatchId: string) => HooksRuntimeChildEntry | undefined;
  readonly persistenceOwner: (
    loc: ScopedLocations,
    sessionId: string,
    ownerToken: string,
  ) => ChildJournalOwner;
  readonly persistenceOwners: () => readonly ChildJournalOwner[];
  readonly forgetPersistenceOwners: () => void;
  readonly pidTableEntries: (
    loc: ScopedLocations,
    owner?: ChildJournalOwner,
  ) => readonly HooksRuntimePidEntry[];
  readonly shutdownChildren: () => readonly HooksRuntimeChildEntry[];
  readonly runPidTableOperation: (key: string, operation: () => Promise<void>) => Promise<void>;
}

/** One pending context buffer: entries wait in arrival order until a drain. */
interface ContextBuffer<T extends { readonly context: string }> {
  readonly append: (entry: T) => void;
  readonly entries: () => readonly T[];
  readonly drain: () => readonly T[];
  /**
   * Removes and returns the first entry `matches` accepts, with every entry
   * before it, or removes nothing when it accepts none.
   */
  readonly takeThrough: (matches: (entry: T) => boolean) => T | undefined;
}

// An entry with an empty context adds nothing, so the buffer drops it.
function createContextBuffer<T extends { readonly context: string }>(): ContextBuffer<T> {
  let pending: T[] = [];
  return {
    append(entry: T): void {
      if (entry.context.length > 0) {
        pending.push(entry);
      }
    },

    entries(): readonly T[] {
      return [...pending];
    },

    drain(): readonly T[] {
      const entries = pending;
      pending = [];
      return entries;
    },

    takeThrough(matches: (entry: T) => boolean): T | undefined {
      const index = pending.findIndex(matches);
      const taken = pending[index];
      if (taken !== undefined) {
        pending = pending.slice(index + 1);
      }

      return taken;
    },
  };
}

/** Creates one isolated owner for a hooks extension lifecycle. */
export function createHooksRuntime(): HooksRuntime {
  const parsedConfigCache = new Map<string, CacheEntry>();
  const routingTable = new Map<BucketAEvent, readonly RoutingEntry[]>();
  const children = new Map<string, HooksRuntimeChildEntry>();
  const childOwners = new Map<string, ChildJournalOwner>();
  const pidTableOperations = new Map<string, Promise<void>>();
  let generation = 0;
  let trustedProject: string | undefined;
  const mcpServers = new Map<Scope, readonly McpServerEntry[]>();
  // D-CF5-13: the SessionStart context waits for the next turn of the
  // session; a prompt's context belongs to the turn of that prompt.
  const pendingSessionStartContext = createContextBuffer<PendingSessionStartContext>();
  const pendingPromptContext = createContextBuffer<PendingPromptContext>();
  // A queued follow-up's context waits, in queue order, for the turn end
  // after which the agent reads that follow-up. Pi reads its follow-ups in
  // order, so the contexts queued before the one it reads are for follow-ups
  // it already read or dropped.
  const pendingFollowUpContext = createContextBuffer<PendingFollowUpContext>();
  let lastAssistant: AssistantMessage | undefined;
  let stopHookActive = false;
  let runStartedByRewake = false;
  let stopBoundaryOpen = false;
  let heldStopReason: string | undefined;
  let consecutiveBlockCount = 0;
  let capNotifiedThisSession = false;
  const shownStartFailures = new Set<string>();
  const toolCallMarks = new Map<string, number>();
  let lastTopLevelMark = Number.NEGATIVE_INFINITY;
  let childIdentity: ChildIdentity = { kind: "unavailable" };
  let childIdentitySessionId: string | undefined;
  let childRoot:
    { readonly sessionId: string; readonly root: ChildRootSession | undefined } | undefined;

  function finishStopSequence(): void {
    consecutiveBlockCount = 0;
    capNotifiedThisSession = false;
  }

  function clearToolCallMarks(): void {
    toolCallMarks.clear();
    lastTopLevelMark = Number.NEGATIVE_INFINITY;
  }

  function prepareSettleForRegistration(): void {
    lastAssistant = undefined;
    stopHookActive = false;
    runStartedByRewake = false;
    stopBoundaryOpen = false;
    heldStopReason = undefined;
    shownStartFailures.clear();
    clearToolCallMarks();
    finishStopSequence();
  }

  return {
    currentGeneration(): number {
      return generation;
    },

    advanceGeneration(): number {
      generation += 1;
      return generation;
    },

    setParsedConfig(key: string, entry: CacheEntry): void {
      parsedConfigCache.set(key, entry);
    },

    deleteParsedConfig(key: string): void {
      parsedConfigCache.delete(key);
    },

    parsedConfigEntries(): ReadonlyMap<string, CacheEntry> {
      return new Map(parsedConfigCache);
    },

    getRoutingBucket(event: BucketAEvent): readonly RoutingEntry[] {
      return [...(routingTable.get(event) ?? [])];
    },

    setRoutingBucket(event: BucketAEvent, entries: readonly RoutingEntry[]): void {
      routingTable.set(event, [...entries]);
    },

    routingTableEntries(): ReadonlyMap<BucketAEvent, readonly RoutingEntry[]> {
      return new Map(Array.from(routingTable, ([event, entries]) => [event, [...entries]]));
    },

    recordProjectTrust(cwd: string, trusted: boolean): void {
      trustedProject = trusted ? cwd : undefined;
    },

    isProjectTrusted(cwd: string): boolean {
      return trustedProject === cwd;
    },

    setMcpServers(scope: Scope, entries: readonly McpServerEntry[]): void {
      mcpServers.set(scope, [...entries]);
    },

    mcpServerFor(tool: McpToolIdentity): HookMcpServer | undefined {
      return findMcpServer([...mcpServers.values()].flat(), tool);
    },

    appendPendingSessionStartContext: pendingSessionStartContext.append,
    pendingSessionStartContextEntries: pendingSessionStartContext.entries,
    drainPendingSessionStartContext: pendingSessionStartContext.drain,
    appendPendingPromptContext: pendingPromptContext.append,
    pendingPromptContextEntries: pendingPromptContext.entries,
    drainPendingPromptContext: pendingPromptContext.drain,
    queueFollowUpContext: pendingFollowUpContext.append,
    takeFollowUpContext(prompt: string): PendingFollowUpContext | undefined {
      return pendingFollowUpContext.takeThrough((entry) => entry.prompt === prompt);
    },
    drainFollowUpContext: pendingFollowUpContext.drain,

    // D-CF5-13: a bridge load empties every buffer, so no context reaches a
    // later session.
    preparePendingContextForRegistration(): void {
      pendingSessionStartContext.drain();
      pendingPromptContext.drain();
      pendingFollowUpContext.drain();
    },

    prepareSettleForRegistration,

    recordLastAssistant(message: AssistantMessage | undefined): void {
      lastAssistant = message;
    },

    takeLastAssistant(): AssistantMessage | undefined {
      const message = lastAssistant;
      lastAssistant = undefined;
      return message;
    },

    takeStopEnding(): AssistantMessage | undefined {
      if (lastAssistant?.stopReason !== "stop") {
        return undefined;
      }

      const message = lastAssistant;
      lastAssistant = undefined;
      return message;
    },

    holdStopReason(reason: string): void {
      heldStopReason = reason;
    },

    takeHeldStopReason(): string | undefined {
      const reason = heldStopReason;
      heldStopReason = undefined;
      return reason;
    },

    openStopBoundary(): void {
      stopBoundaryOpen = true;
    },

    closeStopBoundary(): void {
      stopBoundaryOpen = false;
    },

    recordRewakeSent(): void {
      if (stopBoundaryOpen) {
        runStartedByRewake = true;
      }
    },

    isStopHookActive(): boolean {
      return stopHookActive || runStartedByRewake;
    },

    recordStopReentry(): StopReentryTransition {
      if (consecutiveBlockCount === STOP_OVERRIDE_CAP) {
        const notifyCap = !capNotifiedThisSession;
        capNotifiedThisSession = true;
        return { reenter: false, notifyCap };
      }

      consecutiveBlockCount += 1;
      stopHookActive = true;
      return { reenter: true, notifyCap: false };
    },

    startFailureNoticeShown(key: string): boolean {
      return shownStartFailures.has(key);
    },

    recordStartFailureNotice(key: string): void {
      shownStartFailures.add(key);
    },

    recordStopNonReentry: finishStopSequence,

    recordToolCall: finishStopSequence,

    recordToolCallPrepared(
      toolCallId: string,
      parentToolCallId: string | undefined,
      now: number,
    ): void {
      toolCallMarks.set(toolCallId, now);
      if (parentToolCallId === undefined) {
        lastTopLevelMark = now;
      }
    },

    takeToolDuration(toolCallId: string, now: number): number | undefined {
      const mark = toolCallMarks.get(toolCallId);
      if (mark === undefined) {
        return undefined;
      }

      toolCallMarks.delete(toolCallId);
      return Math.max(0, Math.round(now - Math.max(mark, lastTopLevelMark)));
    },

    clearToolCallMarks,

    recordUserInput(): void {
      stopHookActive = false;
      finishStopSequence();
    },

    recordRunStart(startedByRewake: boolean): void {
      runStartedByRewake = startedByRewake;
    },

    resetChildIdentity(): void {
      childIdentity = { kind: "unavailable" };
      childIdentitySessionId = undefined;
      childRoot = undefined;
    },

    captureChildIdentity(event: BeforeAgentStartEvent, sessionId: string): void {
      if (childRoot?.sessionId !== sessionId) {
        childRoot = undefined;
      }

      childIdentitySessionId = sessionId;
      if (!isSubagentChild(process.env)) {
        childIdentity = { kind: "main" };
        return;
      }

      const custom = parseIdentitySection(event.systemPromptOptions.customPrompt);
      const appended = parseIdentitySection(event.systemPromptOptions.appendSystemPrompt);
      if (
        custom === null ||
        appended === null ||
        (custom !== undefined && appended !== undefined && custom !== appended)
      ) {
        childIdentity = { kind: "unavailable" };
        return;
      }

      const agentType = custom ?? appended;
      childIdentity =
        agentType === undefined
          ? { kind: "unavailable" }
          : { kind: "known", agentType, childId: sessionId };
    },

    childIdentityFor(sessionId: string): ChildIdentity {
      if (!isSubagentChild(process.env)) {
        return { kind: "main" };
      }

      if (childIdentitySessionId !== sessionId) {
        return { kind: "unavailable" };
      }

      const root = childRoot?.root;
      return childIdentity.kind === "known" && root !== undefined
        ? { ...childIdentity, root }
        : childIdentity;
    },

    recordChildRoot(sessionId: string, root: ChildRootSession | undefined): void {
      if (childIdentitySessionId === sessionId) {
        childRoot = { sessionId, root };
      }
    },

    childRootResolved(sessionId: string): boolean {
      return childRoot?.sessionId === sessionId;
    },

    registerChild(entry: HooksRuntimeChildEntry): void {
      children.set(entry.dispatchId, entry);
    },

    takeChild(dispatchId: string): HooksRuntimeChildEntry | undefined {
      const entry = children.get(dispatchId);
      children.delete(dispatchId);
      return entry;
    },

    persistenceOwner(
      loc: ScopedLocations,
      sessionId: string,
      ownerToken: string,
    ): ChildJournalOwner {
      const key = `${loc.dataRoot}\0${sessionId}`;
      const existing = childOwners.get(key);
      if (existing !== undefined) {
        return existing;
      }

      const owner: ChildJournalOwner = { ownerPid: process.pid, sessionId, ownerToken, loc };
      childOwners.set(key, owner);
      return owner;
    },

    persistenceOwners(): readonly ChildJournalOwner[] {
      return [...childOwners.values()];
    },

    forgetPersistenceOwners(): void {
      childOwners.clear();
    },

    pidTableEntries(
      loc: ScopedLocations,
      owner?: ChildJournalOwner,
    ): readonly HooksRuntimePidEntry[] {
      const entries: HooksRuntimePidEntry[] = [];
      for (const entry of children.values()) {
        if (
          (entry.loc === loc || entry.loc.extensionRoot === loc.extensionRoot) &&
          entry.persistenceOwner === owner
        ) {
          entries.push({
            pid: entry.pid,
            dispatchId: entry.dispatchId,
            scope: entry.scope,
            marketplace: entry.marketplace,
            plugin: entry.pluginId,
            spawnedAt: entry.spawnedAt,
          });
        }
      }

      return entries;
    },

    shutdownChildren(): readonly HooksRuntimeChildEntry[] {
      const stopped = [...children.values()];
      for (const entry of children.values()) {
        entry.ladder.cancel();
        try {
          entry.child.kill("SIGKILL");
        } catch {
          // Best effort: the child may already have exited.
        }
      }

      children.clear();
      return stopped;
    },

    runPidTableOperation(key: string, operation: () => Promise<void>): Promise<void> {
      const previous = pidTableOperations.get(key) ?? Promise.resolve();
      const operationPromise = previous.then(operation, operation);
      const queueTail = operationPromise
        .catch(() => undefined)
        .finally(() => {
          if (pidTableOperations.get(key) === queueTail) {
            pidTableOperations.delete(key);
          }
        });

      pidTableOperations.set(key, queueTail);
      return operationPromise;
    },
  };
}

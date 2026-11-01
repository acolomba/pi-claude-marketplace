import type { RingBuffer } from "./async-rewake/ring-buffer.ts";
import type { ChildLike, TimerLadder } from "./exec-timer.ts";
import type {
  CacheEntry,
  PendingFollowUpContext,
  PendingPromptContext,
  PendingSessionStartContext,
  RoutingEntry,
} from "./routing-state.ts";
import type { BucketAEvent } from "../../domain/components/hook-events.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { AssistantMessage } from "../../platform/pi-api.ts";

/**
 * STOP-07: the consecutive Stop re-entry cap. The re-entry that reaches it does
 * not re-enter; settle passes this value to the override-cap warning.
 */
export const STOP_OVERRIDE_CAP = 8;

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
  readonly stdoutBuffer: RingBuffer;
  readonly stderrBuffer: RingBuffer;
  readonly capturedGeneration: number;
  readonly loc: ScopedLocations;
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
  readonly isStopHookActive: () => boolean;
  readonly recordStopReentry: () => StopReentryTransition;
  readonly recordStopNonReentry: () => void;
  readonly recordUserInput: () => void;
  readonly registerChild: (entry: HooksRuntimeChildEntry) => void;
  readonly takeChild: (dispatchId: string) => HooksRuntimeChildEntry | undefined;
  readonly pidTableEntries: (loc: ScopedLocations) => readonly HooksRuntimePidEntry[];
  readonly shutdownChildren: () => void;
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
  const pidTableOperations = new Map<string, Promise<void>>();
  let generation = 0;
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
  let consecutiveBlockCount = 0;
  let capNotifiedThisSession = false;

  function finishStopSequence(): void {
    consecutiveBlockCount = 0;
    capNotifiedThisSession = false;
  }

  function prepareSettleForRegistration(): void {
    lastAssistant = undefined;
    stopHookActive = false;
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

    isStopHookActive(): boolean {
      return stopHookActive;
    },

    recordStopReentry(): StopReentryTransition {
      consecutiveBlockCount += 1;
      if (consecutiveBlockCount >= STOP_OVERRIDE_CAP) {
        const notifyCap = !capNotifiedThisSession;
        capNotifiedThisSession = true;
        return { reenter: false, notifyCap };
      }

      stopHookActive = true;
      return { reenter: true, notifyCap: false };
    },

    recordStopNonReentry: finishStopSequence,

    recordUserInput(): void {
      stopHookActive = false;
      finishStopSequence();
    },

    registerChild(entry: HooksRuntimeChildEntry): void {
      children.set(entry.dispatchId, entry);
    },

    takeChild(dispatchId: string): HooksRuntimeChildEntry | undefined {
      const entry = children.get(dispatchId);
      children.delete(dispatchId);
      return entry;
    },

    pidTableEntries(loc: ScopedLocations): readonly HooksRuntimePidEntry[] {
      const entries: HooksRuntimePidEntry[] = [];
      for (const entry of children.values()) {
        if (entry.loc === loc || entry.loc.extensionRoot === loc.extensionRoot) {
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

    shutdownChildren(): void {
      for (const entry of children.values()) {
        entry.ladder.cancel();
        try {
          entry.child.kill("SIGKILL");
        } catch {
          // Best effort: the child may already have exited.
        }
      }

      children.clear();
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

// Owner suite for the extension entry point: the async factory Pi's loader
// awaits, the `resources_discover` handler it installs, and the `session_start`
// handler that refreshes the Claude-Code session environment.
//
// Registration is data, not behavior. Every event name, the command name and
// both tool names are written out by hand as exact arguments; only the callback
// beside each one is captured, because a function has no structural comparison.
// A registration under any other name has no expectation and fails where it
// happens -- which is what a sorted list of names cannot do, since it sees
// neither the order of two registrations under the same name nor a swapped
// handler.
//
// The three `session_start` expectations are consumed in declaration order, so
// the capture used by the session-environment cases is the SECOND of them. That
// is load-bearing: the factory awaits the hooks bridge before registering
// anything of its own, and a factory that registered its own handler first would
// hand these cases the bridge's callback and fail them.
//
// The same holds for the background update's two listeners: its `input`
// listener is the THIRD `input` expectation and its `session_shutdown` listener
// is the SECOND `session_shutdown` one, both declared where `index.ts`
// registers them, after the session-environment listener.
//
// This suite reads `createNotificationBoundary` from `test/edge/`, so it is a
// cross-tier consumer of that helper alongside the four already recorded ones.
// Duplicating the helper per tier is what the single definition exists to
// prevent.
//
// NFR-2 is the contract under test: no failure inside either handler may
// propagate back to the host. Four failure routes have no injectable seam, so
// they are driven through the two values the case owns -- a `Proxy` over the
// discover event that refuses a chosen working-directory read, and a `Proxy`
// over the boundary's own context whose notification member throws.
//
// NFR-5: every case replaces `https.request`, the door the git transport opens,
// with a fail-fast throw. NO CASE ASSERTS A CALL COUNT AGAINST IT. The factory
// statically imports the module that re-exports the git operations, so the
// transport is in this module's import graph, but no input any case here builds
// turns it on: the injected operations reach only the subcommand handlers, which
// no case dispatches. A zero that cannot rise is not a measurement, so none is
// asserted. What the replacement is, is a hermeticity device: a dial-out reached
// from any of these cases fails where it happens.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { SessionManager } from "@earendil-works/pi-coding-agent";
import { It, mock, verify, when } from "strong-mock";

import claudeMarketplaceExtension from "../extensions/pi-claude-marketplace/index.ts";
import * as entryModule from "../extensions/pi-claude-marketplace/index.ts";
import { loadState } from "../extensions/pi-claude-marketplace/persistence/state-io.ts";

import { recordStagedProjectHooks } from "./bridges/hooks/project-ledger-seeds.ts";
import {
  buildInstalledPluginRecord,
  mergeMarketplaceIntoState,
} from "./edge/handlers/marketplace-seed.ts";
import { createJsonCapture } from "./edge/json-capture.ts";
import { createNotificationBoundary, expectSoftDepProbes } from "./edge/notification-boundary.ts";
import { retryTree } from "./orchestrators/plugin/scope-tree-inventory.ts";
import { createHermeticEnvironment } from "./platform/hermetic-environment.ts";

import type { Notification } from "./edge/notification-boundary.ts";
import type {
  AgentEndEvent,
  AgentSettledEvent,
  BeforeAgentStartEvent,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  InputEvent,
  InputEventResult,
  ResourcesDiscoverEvent,
  ResourcesDiscoverResult,
  SessionBeforeCompactEvent,
  SessionCompactEvent,
  SessionShutdownEvent,
  SessionStartEvent,
  ToolCallEvent,
  ToolCallEventResult,
  ToolResultEvent,
} from "../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { TurnEndEvent } from "@earendil-works/pi-coding-agent";

/**
 * The listener shape every `on` overload accepts. Each overload declares
 * `(event, ctx) => Promise<R | void> | R | void`, so a listener that answers
 * with nothing satisfies all of them and the event type is the only thing that
 * has to be named per registration.
 */
type EventListener<TEvent> = (event: TEvent, ctx: ExtensionContext) => void;

/** The bridge's project-hydrating session-start listener is asynchronous. */
type BridgeSessionStartListener = (
  event: SessionStartEvent,
  ctx: ExtensionContext,
) => Promise<void>;

/** The hook-bridge listener whose return value can deny a tool call. */
type ToolCallListener = (
  event: ToolCallEvent,
  ctx: ExtensionContext,
) => Promise<ToolCallEventResult | undefined>;

/** The discover listener, which answers with the discovered resource set. */
type DiscoverListener = (
  event: ResourcesDiscoverEvent,
  ctx: ExtensionContext,
) => Promise<ResourcesDiscoverResult>;

/** The background update's input listener; it reads only these context members. */
type BackgroundInputListener = (
  event: InputEvent,
  ctx: Pick<ExtensionContext, "mode" | "cwd" | "ui">,
) => void;

/** The bridged-command input listener, which answers with an input result. */
type CommandInvocationListener = (
  event: InputEvent,
  ctx: ExtensionContext,
) => InputEventResult | Promise<InputEventResult>;

/** The background update's shutdown listener, which may wait for a step in flight. */
type BackgroundShutdownListener = (event: SessionShutdownEvent) => Promise<void>;

/** The options bag `registerCommand` receives, derived from the Pi surface. */
type CommandRegistration = Parameters<ExtensionAPI["registerCommand"]>[1];

/** The definition `registerTool` receives, derived from the Pi surface. */
type ToolRegistration = Parameters<ExtensionAPI["registerTool"]>[0];

interface HermeticScope {
  readonly agentDir: string;
  readonly cwd: string;
  readonly home: string;
}

interface LoadedExtension {
  readonly pi: ExtensionAPI;
  readonly bridgeSessionStart: BridgeSessionStartListener;
  readonly discover: DiscoverListener;
  readonly sessionEnv: EventListener<SessionStartEvent>;
  readonly backgroundInput: BackgroundInputListener;
  readonly backgroundShutdown: BackgroundShutdownListener;
  readonly toolCall: ToolCallListener;
  readonly command: CommandRegistration;
  readonly commandInvocation: CommandInvocationListener;
  readonly tools: readonly (ToolRegistration | undefined)[];
  readonly ctx: ExtensionCommandContext;
  readonly notifications: readonly Notification[];
  readonly publishStatus: (data: unknown) => void;
  readonly verifyBoundary: () => void;
}

const SESSION_ENV_KEYS = ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_SESSION_ID"] as const;

const EMPTY_DISCOVERY: ResourcesDiscoverResult = { skillPaths: [], promptPaths: [] };

/**
 * Which `event.cwd` read each NFR-2 refusal case targets, and how many reads the
 * handler makes in all. The discover handler reads the event's working directory
 * once per stage, in this order: the deferred project-scope hydrate, the
 * reconcile, the plugin PATH recompute, and the project-scope half of the
 * resource aggregation. Naming the ordinals states which stage a case refuses;
 * asserting the total states that the stage list itself has not moved.
 *
 * Each of the three named ordinals has its own case, and each case asserts an
 * observable only its own stage produces -- otherwise the ordinal is decoration
 * and the case's title is a claim about a stage it is not pinned to. The aggregate
 * discovery case counts all four reads across two calls while a real filesystem
 * fault targets the fourth stage without a synthetic event refusal.
 */
const CWD_READ_DEFERRED_HYDRATE = 1;
const CWD_READ_RECONCILE = 2;
const CWD_READ_PLUGIN_PATH_RECOMPUTE = 3;
const CWD_READS_PER_DISCOVER = 4;

/**
 * Soft-dependency probes per `resources_discover` pass. The pass opens one
 * notification run inside the reconcile try, before the reconcile reads its
 * `cwd`, and the run takes one snapshot (D-05, D-07). The reconcile cascade
 * renders from that run, and the last-ditch and plugin PATH lines are raw text,
 * so no emission adds a probe. A case that runs two passes states twice this
 * count.
 */
const PROBES_PER_DISCOVER = 1;

/** `ctx.mode` reads per `resources_discover` pass: one before each load stage. */
const MODE_READS_PER_DISCOVER = 3;

/** The cascade the reconcile renders for a project scope whose state is unreadable. */
const RECONCILE_CASCADE_FOR_UNREADABLE_STATE =
  "Some operations have failed.\n\n" +
  "⊘ state.json [project] (failed) {unreadable}\n" +
  "  ⊘ state.json (failed) {unreadable}\n" +
  "    cause: state.json at state.json has an unsupported schema version\n\n" +
  "Reconcile: 2 failures";

/** The cascade for unreadable install state in both project-first reconcile scopes. */
const RECONCILE_CASCADE_FOR_TWO_UNREADABLE_STATES =
  "Some operations have failed.\n\n" +
  "⊘ state.json [project] (failed) {unreadable}\n" +
  "  ⊘ state.json (failed) {unreadable}\n" +
  "    cause: state.json at state.json has an unsupported schema version\n\n" +
  "⊘ state.json [user] (failed) {unreadable}\n" +
  "  ⊘ state.json (failed) {unreadable}\n" +
  "    cause: state.json at state.json has an unsupported schema version\n\n" +
  "Reconcile: 4 failures";

/** D-06: the pending block the load prints for a project scope whose config is invalid. */
const PENDING_BLOCK_FOR_INVALID_CONFIG =
  "Some operations have failed.\n\n" +
  "⊘ claude-plugins.json [project] (failed) {invalid manifest}\n" +
  "  ⊘ claude-plugins.json (failed) {invalid manifest}\n" +
  "    cause: schema validation failed: /schemaVersion: must be equal to constant\n\n" +
  "Reconcile pending: 2 failures";

/**
 * A notification function that records every message the module tries to emit
 * and then refuses it, so a case can compare what was attempted as a whole value
 * while every emission fails.
 */
function refuseEveryNotification(
  attempted: Notification[],
): (message: string, severity?: Notification["severity"]) => never {
  return (message, severity): never => {
    attempted.push(severity === undefined ? { message } : { message, severity });
    throw new Error("host notification refused");
  };
}

/**
 * Replace the door the git transport opens with a fail-fast throw owned by the
 * test context, which restores it after the case. See the NFR-5 note in the file
 * header for why no case asserts a count against it.
 */
function installNetworkTrap(t: TestContext): void {
  t.mock.method(https, "request", (): never => {
    throw new Error("the extension entry point must not open a network connection");
  });
}

/**
 * Put one environment variable back the way the case found it. A variable that
 * was absent is deleted rather than reassigned, because `process.env` stringifies
 * every assignment and an absent variable restored by assignment would come back
 * as the four letters `undefined`.
 */
function restoreEnv(key: string, previous: string | undefined): void {
  if (previous === undefined) {
    Reflect.deleteProperty(process.env, key);
  } else {
    process.env[key] = previous;
  }
}

/**
 * One hermetic Pi environment per case: the factory hydrates the user scope
 * off disk while it runs, so a case without its own home would read the
 * operator's real one.
 *
 * The process moves into a root of its own, distinct from the working directory
 * the discover event names, so a handler that read the process working directory
 * instead of the event's would be observable rather than incidentally right. The
 * restore is registered before anything is mutated.
 */
async function createHermeticScope(t: TestContext, label: string): Promise<HermeticScope> {
  const { agentDir, cwd, home } = await createHermeticEnvironment(t, `index-${label}-`);
  const processRoot = await mkdtemp(path.join(tmpdir(), `index-${label}-process-`));
  const previousCwd = process.cwd();
  const tracked = [
    "PATH",
    "PI_CLAUDE_MARKETPLACE_PATH",
    "PI_CLAUDE_MARKETPLACE_EMPTY",
    "CLAUDE_PROJECT_DIR",
    ...SESSION_ENV_KEYS,
  ];
  const saved = tracked.map((key) => {
    return { key, previous: process.env[key] };
  });
  t.after(async () => {
    process.chdir(previousCwd);
    for (const { key, previous } of saved) {
      restoreEnv(key, previous);
    }

    await rm(processRoot, { recursive: true, force: true });
  });
  process.chdir(processRoot);
  installNetworkTrap(t);
  return { agentDir, cwd, home };
}

/**
 * Run the factory against a strict Pi mock and the shared notification boundary,
 * and hand back everything it registered. Every expectation states its event,
 * command or tool name by hand and captures only the callback, so
 * `verifyBoundary()` fails a registration under any other name, an extra
 * registration, and a missing one alike. It verifies this Pi mock beside the
 * notification boundary.
 *
 * `probes` counts the soft-dependency snapshots the case's roots take. Each
 * `resources_discover` pass that reaches the reconcile takes one, and so does
 * each registered-command invocation (D-05, D-07); `expectSoftDepProbes` states
 * the Pi reads one snapshot makes. A pass that stops before the reconcile and a
 * case that dispatches no command take none. A count of 0 states no expectation
 * rather than `times(0)`, so the first unwanted read fails where it happens.
 * `modeReads` defaults to a case whose probes are all discover passes; a case
 * that dispatches a command states it.
 */
async function loadExtension(
  emissions: number,
  probes: number,
  cwd?: { readonly value: string; readonly reads: number },
  modeReads = emissions + MODE_READS_PER_DISCOVER * probes,
  output?: {
    readonly appendEntry: (customType: string, payload: unknown) => void;
    readonly attempts: number;
    readonly inventoryError?: Error;
  },
): Promise<LoadedExtension> {
  const boundary = createNotificationBoundary(emissions, cwd, modeReads);
  // T-02-17: every discover pass asks whether Pi trusts the project; the
  // untrusted case states its own expectation.
  when(() => boundary.ctx.isProjectTrusted())
    .thenReturn(true)
    .anyTimes();
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  if (output?.inventoryError === undefined) {
    expectSoftDepProbes(pi, probes);
  } else if (probes > 0) {
    when(() => pi.getAllTools())
      .thenThrow(output.inventoryError)
      .times(probes * 3);
    when(() => pi.getCommands())
      .thenThrow(output.inventoryError)
      .times(probes);
  }

  if (output !== undefined && output.attempts > 0) {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- strict property expectation for the run's sink lookup
    when(() => pi.appendEntry)
      .thenReturn(output.appendEntry)
      .times(output.attempts);
  }

  // ASTAT-01: the bus mock states the one subscription the factory makes, so
  // any other bus call -- a publish included -- fails where it happens.
  const events = mock<ExtensionAPI["events"]>({ exactParams: true, name: "event bus" });
  const statusListener = It.willCapture<(data: unknown) => void>("mcp status listener");
  when(() => events.on("pi-mcp-adapter/status/v1", statusListener))
    .thenReturn(() => undefined)
    .times(1);
  when(() => pi.events)
    .thenReturn(events)
    .times(1);
  const bridgeSessionStartListener =
    It.willCapture<BridgeSessionStartListener>("bridge session start");
  when(() => {
    pi.on("session_start", bridgeSessionStartListener);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on(
      "session_shutdown",
      It.willCapture<EventListener<SessionShutdownEvent>>("session shutdown"),
    );
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on(
      "session_before_compact",
      It.willCapture<EventListener<SessionBeforeCompactEvent>>("session before compact"),
    );
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("session_compact", It.willCapture<EventListener<SessionCompactEvent>>("session compact"));
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("input", It.willCapture<EventListener<InputEvent>>("input dispatch"));
  })
    .thenReturn()
    .times(1);
  const toolCallListener = It.willCapture<ToolCallListener>("tool call");
  when(() => {
    pi.on("tool_call", toolCallListener);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("tool_result", It.willCapture<EventListener<ToolResultEvent>>("tool result"));
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on(
      "before_agent_start",
      It.willCapture<EventListener<BeforeAgentStartEvent>>("before agent start"),
    );
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("turn_end", It.willCapture<EventListener<TurnEndEvent>>("turn end"));
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("agent_end", It.willCapture<EventListener<AgentEndEvent>>("agent end"));
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("agent_settled", It.willCapture<EventListener<AgentSettledEvent>>("agent settled"));
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("input", It.willCapture<EventListener<InputEvent>>("input loop reset"));
  })
    .thenReturn()
    .times(1);
  const discoverListener = It.willCapture<DiscoverListener>("resources discover");
  when(() => {
    pi.on("resources_discover", discoverListener);
  })
    .thenReturn()
    .times(1);
  const sessionEnvListener = It.willCapture<EventListener<SessionStartEvent>>("session env");
  when(() => {
    pi.on("session_start", sessionEnvListener);
  })
    .thenReturn()
    .times(1);
  const backgroundInputListener =
    It.willCapture<BackgroundInputListener>("background update input");
  when(() => {
    pi.on("input", backgroundInputListener);
  })
    .thenReturn()
    .times(1);
  const backgroundShutdownListener = It.willCapture<BackgroundShutdownListener>(
    "background update shutdown",
  );
  when(() => {
    pi.on("session_shutdown", backgroundShutdownListener);
  })
    .thenReturn()
    .times(1);
  const commandRegistration = It.willCapture<CommandRegistration>("claude:plugin registration");
  when(() => {
    pi.registerCommand("claude:plugin", commandRegistration);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on(
      "session_start",
      It.willCapture<EventListener<SessionStartEvent>>("autocomplete wrapper"),
    );
  })
    .thenReturn()
    .times(1);
  const firstTool = It.willCapture<ToolRegistration>("first registered tool");
  const secondTool = It.willCapture<ToolRegistration>("second registered tool");
  when(() => {
    pi.registerTool(firstTool);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.registerTool(secondTool);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("session_start", It.willCapture<EventListener<SessionStartEvent>>("skill aliases"));
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("input", It.willCapture<EventListener<InputEvent>>("skill alias input"));
  })
    .thenReturn()
    .times(1);
  const commandInvocationListener = It.willCapture<CommandInvocationListener>(
    "command invocation input",
  );
  when(() => {
    pi.on("input", commandInvocationListener);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("tool_result", It.willCapture<EventListener<ToolResultEvent>>("skill read fill"));
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("session_start", It.willCapture<EventListener<SessionStartEvent>>("command tool"));
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on(
      "before_agent_start",
      It.willCapture<EventListener<BeforeAgentStartEvent>>("command tool start"),
    );
  })
    .thenReturn()
    .times(1);

  await claudeMarketplaceExtension(pi);

  const discover = discoverListener.value;
  const bridgeSessionStart = bridgeSessionStartListener.value;
  const sessionEnv = sessionEnvListener.value;
  const backgroundInput = backgroundInputListener.value;
  const backgroundShutdown = backgroundShutdownListener.value;
  const toolCall = toolCallListener.value;
  const command = commandRegistration.value;
  const commandInvocation = commandInvocationListener.value;
  const publishStatus = statusListener.value;
  if (
    publishStatus === undefined ||
    bridgeSessionStart === undefined ||
    discover === undefined ||
    sessionEnv === undefined ||
    backgroundInput === undefined ||
    backgroundShutdown === undefined ||
    toolCall === undefined ||
    command === undefined ||
    commandInvocation === undefined
  ) {
    throw new Error("the extension factory installed an incomplete callback surface");
  }

  return {
    pi,
    bridgeSessionStart,
    discover,
    sessionEnv,
    backgroundInput,
    backgroundShutdown,
    toolCall,
    command,
    commandInvocation,
    tools: [firstTool.value, secondTool.value],
    ctx: boundary.ctx,
    notifications: boundary.notifications,
    publishStatus,
    verifyBoundary: (): void => {
      boundary.verifyBoundary();
      verify(pi);
      verify(events);
    },
  };
}

/**
 * A discover event whose working-directory read throws on exactly the nth read,
 * paired with the two counters that make the injection observable.
 *
 * The ordinal is a raw coupling to the order in which the handler reads
 * `event.cwd`, so a case that asserted only the handler's answer would stay
 * green if a refactor retargeted the injection at another stage -- or past the
 * last read, where nothing is refused at all. `refused()` states that the
 * injection was reached, and `readCount()` states how many reads the handler
 * made in total, so a read added or removed anywhere fails the case instead of
 * silently moving what it tests.
 */
interface CwdRefusal {
  readonly event: ResourcesDiscoverEvent;
  readonly refused: () => boolean;
  readonly readCount: () => number;
}

interface CwdReplacement {
  readonly event: ResourcesDiscoverEvent;
  readonly replaced: () => boolean;
  readonly readCount: () => number;
}

function eventRefusingCwdRead(event: ResourcesDiscoverEvent, nth: number): CwdRefusal {
  let reads = 0;
  let refused = false;
  const proxy = new Proxy(event, {
    get(target, property, receiver): unknown {
      if (property === "cwd") {
        reads += 1;
        if (reads === nth) {
          refused = true;
          throw new Error(`working directory read ${nth} refused`);
        }
      }

      return Reflect.get(target, property, receiver);
    },
  });

  return {
    event: proxy,
    refused: () => refused,
    readCount: () => reads,
  };
}

/** A discover event that substitutes one owned working-directory read. */
function eventReplacingCwdRead(
  event: ResourcesDiscoverEvent,
  nth: number,
  replacement: string,
): CwdReplacement {
  let reads = 0;
  let replaced = false;
  const proxy = new Proxy(event, {
    get(target, property, receiver): unknown {
      if (property === "cwd") {
        reads += 1;
        if (reads === nth) {
          replaced = true;
          return replacement;
        }
      }

      return Reflect.get(target, property, receiver);
    },
  });

  return {
    event: proxy,
    replaced: () => replaced,
    readCount: () => reads,
  };
}

/**
 * A context that delegates every member to the strict boundary and answers the
 * notification member with the given function. The `Proxy` keeps the boundary as
 * the one source of every other member, so no part of the Pi surface is
 * hand-rolled and `verifyBoundary()` still governs the rest.
 */
function contextNotifyingThrough(
  ctx: ExtensionCommandContext,
  notify: (message: string, severity?: Notification["severity"]) => void,
): ExtensionCommandContext {
  const ui = { notify };
  return new Proxy(ctx, {
    get(target, property, receiver): unknown {
      if (property === "ui") {
        return ui;
      }

      return Reflect.get(target, property, receiver);
    },
  });
}

/**
 * A context with no session manager at all. This is the second of the two inputs
 * the production comment names -- `ctx.sessionManager.getSessionId()` can throw,
 * or `ctx.sessionManager` can be absent so the dereference throws instead. Both
 * land in one `catch`, so line and branch coverage cannot tell the two apart and
 * only a case naming this input exercises it.
 */
function contextWithoutSessionManager(ctx: ExtensionCommandContext): ExtensionCommandContext {
  return new Proxy(ctx, {
    get(target, property, receiver): unknown {
      if (property === "sessionManager") {
        return undefined;
      }

      return Reflect.get(target, property, receiver);
    },
  });
}

/** A context whose working-directory read throws. */
function contextRefusingCwdRead(ctx: ExtensionCommandContext): ExtensionCommandContext {
  return new Proxy(ctx, {
    get(target, property, receiver): unknown {
      if (property === "cwd") {
        throw new Error("working directory refused");
      }

      return Reflect.get(target, property, receiver);
    },
  });
}

/** A context whose session manager answers with the given reader. */
function contextWithSessionId(
  ctx: ExtensionCommandContext,
  getSessionId: () => string,
): ExtensionCommandContext {
  return new Proxy(ctx, {
    get(target, property, receiver): unknown {
      if (property === "sessionManager") {
        return { getSessionId };
      }

      return Reflect.get(target, property, receiver);
    },
  });
}

function discoverEvent(
  cwd: string,
  reason: ResourcesDiscoverEvent["reason"] = "startup",
): ResourcesDiscoverEvent {
  return { type: "resources_discover", cwd, reason };
}

/** A complete context for exercising a production hook callback. */
function hookContext(cwd: string, sessionId: string): ExtensionContext {
  return {
    get ui(): ExtensionContext["ui"] {
      throw new Error("the synchronous hook path must not read ui");
    },
    mode: "print",
    hasUI: false,
    cwd,
    sessionManager: SessionManager.inMemory(cwd, { id: sessionId }),
    get modelRegistry(): ExtensionContext["modelRegistry"] {
      throw new Error("the synchronous hook path must not read modelRegistry");
    },
    model: undefined,
    scopedModels: [],
    isIdle(): never {
      throw new Error("the synchronous hook path must not inspect idle state");
    },
    isProjectTrusted(): never {
      throw new Error("the synchronous hook path must not inspect trust");
    },
    signal: undefined,
    abort(): never {
      throw new Error("the synchronous hook path must not abort Pi");
    },
    hasPendingMessages(): never {
      throw new Error("the synchronous hook path must not inspect pending messages");
    },
    shutdown(): never {
      throw new Error("the synchronous hook path must not shut down Pi");
    },
    getContextUsage(): never {
      throw new Error("the synchronous hook path must not inspect context usage");
    },
    compact(): never {
      throw new Error("the synchronous hook path must not compact the session");
    },
    getSystemPrompt(): never {
      throw new Error("the synchronous hook path must not read the system prompt");
    },
  };
}

/** Seed one enabled project plugin whose PreToolUse hook denies Bash. */
async function seedBlockingHookPlugin(cwd: string, agentDir: string): Promise<void> {
  const extensionRoot = path.join(cwd, ".pi", "pi-claude-marketplace");
  const marketplaceRoot = path.join(cwd, "hook-marketplace");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "hook-owner");
  const hookRoot = path.join(extensionRoot, "hooks", "hook-owner");
  await mkdir(hookRoot, { recursive: true });
  await writeFile(
    path.join(hookRoot, "hooks.json"),
    JSON.stringify({
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command: `printf '%s' '{"decision":"block","reason":"owned hook"}'`,
              },
            ],
          },
        ],
      },
    }),
    "utf8",
  );
  await writeFile(
    path.join(extensionRoot, "state.json"),
    JSON.stringify({
      schemaVersion: 2,
      marketplaces: {
        hooks: {
          name: "hooks",
          scope: "project",
          source: { kind: "path", raw: marketplaceRoot },
          addedFromCwd: cwd,
          manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
          marketplaceRoot,
          plugins: {
            "hook-owner": {
              version: "1.0.0",
              resolvedSource: pluginRoot,
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: {
                skills: [],
                prompts: [],
                agents: [],
                mcpServers: [],
                hooks: ["hook-owner"],
              },
              enabled: true,
              provenance: "explicit",
              installedAt: "2026-09-08T00:00:00.000Z",
              updatedAt: "2026-09-08T00:00:00.000Z",
            },
          },
        },
      },
    }),
    "utf8",
  );
  // D-CF2-13: the user's ledger lists the staged config, as an install does.
  await recordStagedProjectHooks(agentDir, cwd, path.join(extensionRoot, "hooks"), ["hook-owner"]);
}

/** Seed a path marketplace accepted by the public `marketplace add` command. */
async function seedMarketplaceSource(
  cwd: string,
  name: string,
  pluginName: string,
): Promise<string> {
  const sourceRoot = path.join(cwd, `${name}-source`);
  await mkdir(path.join(sourceRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(sourceRoot, "plugins", pluginName), { recursive: true });
  await writeFile(
    path.join(sourceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name,
      owner: { name: `${name} owner` },
      plugins: [{ name: pluginName, source: `./plugins/${pluginName}`, version: "1.0.0" }],
    }),
    "utf8",
  );
  return sourceRoot;
}

/** Write one prompt file into a scope root's discovered prompt directory. */
async function seedPrompt(root: string, fileName: string): Promise<string> {
  const promptsDir = path.join(root, ".pi", "pi-claude-marketplace", "resources", "prompts");
  await mkdir(promptsDir, { recursive: true });
  const promptPath = path.join(promptsDir, fileName);
  await writeFile(promptPath, "# prompt\n", "utf8");
  return promptPath;
}

/** Record one enabled project-scope plugin whose binaries live under `root`. */
async function seedEnabledPlugin(cwd: string, resolvedSource: string): Promise<void> {
  const extensionRoot = path.join(cwd, ".pi", "pi-claude-marketplace");
  const marketplaceRoot = path.join(cwd, "mp-src");
  await mkdir(extensionRoot, { recursive: true });
  // LOAD-01: the recorded plugin's marketplace declares it. A state whose
  // marketplace manifest is absent is a scope whose declarations cannot be
  // established, which the load-time check reports rather than passing over --
  // so a seed that omits the manifest describes a broken installation instead
  // of the ordinary one every case here is about.
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({ name: "mp", plugins: [{ name: "plug", source: "./plugins/plug" }] }),
    "utf8",
  );
  await writeFile(
    path.join(extensionRoot, "state.json"),
    JSON.stringify({
      schemaVersion: 3,
      marketplaces: {
        mp: {
          name: "mp",
          scope: "project",
          source: { kind: "path", raw: marketplaceRoot },
          addedFromCwd: cwd,
          manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
          marketplaceRoot,
          plugins: {
            plug: {
              version: "1.0.0",
              resolvedSource,
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: {
                skills: [],
                prompts: [],
                agents: [],
                mcpServers: [],
                hooks: [],
                workflows: [],
              },
              enabled: true,
              provenance: "explicit",
              installedAt: "2026-08-03T00:00:00.000Z",
              updatedAt: "2026-08-03T00:00:00.000Z",
            },
          },
        },
      },
    }),
    "utf8",
  );
}

/**
 * MISS-01: record plugin "plug" (enabled) in the scope rooted at `scopeRoot`,
 * the project scope unless a case names the user's agent directory. Its
 * manifest declares a dependency on "helper" -- also declared and on disk in
 * the same marketplace, but never recorded. Config declares "plug@mp" (kept
 * out of the uninstall bucket) and says nothing about "helper" (D-04-02).
 */
async function seedEnabledPluginWithMissingDependency(
  cwd: string,
  scopeRoot: string = path.join(cwd, ".pi"),
): Promise<void> {
  const extensionRoot = path.join(scopeRoot, "pi-claude-marketplace");
  const marketplaceRoot = path.join(cwd, "mp-src");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      plugins: [
        { name: "plug", source: "./plugins/plug", dependencies: ["helper"] },
        { name: "helper", source: "./plugins/helper" },
      ],
    }),
    "utf8",
  );
  const plugRoot = path.join(marketplaceRoot, "plugins", "plug");
  await mkdir(path.join(plugRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(plugRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "plug", version: "1.0.0", dependencies: ["helper"] }),
    "utf8",
  );
  const helperRoot = path.join(marketplaceRoot, "plugins", "helper");
  await mkdir(path.join(helperRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(helperRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "helper", version: "1.0.0" }),
    "utf8",
  );
  await mkdir(extensionRoot, { recursive: true });
  await writeFile(
    path.join(extensionRoot, "state.json"),
    JSON.stringify({
      schemaVersion: 2,
      marketplaces: {
        mp: {
          name: "mp",
          scope: scopeRoot === path.join(cwd, ".pi") ? "project" : "user",
          source: { kind: "path", raw: marketplaceRoot },
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot,
          plugins: {
            plug: {
              version: "1.0.0",
              resolvedSource: plugRoot,
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
              enabled: true,
              provenance: "explicit",
              installedAt: "2026-08-03T00:00:00.000Z",
              updatedAt: "2026-08-03T00:00:00.000Z",
            },
          },
        },
      },
    }),
    "utf8",
  );
  await mkdir(scopeRoot, { recursive: true });
  await writeFile(
    path.join(scopeRoot, "claude-plugins.json"),
    JSON.stringify({
      schemaVersion: 1,
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: { "plug@mp": {} },
    }),
    "utf8",
  );
}

/**
 * Record a project-scope install state the loader refuses to read. The refusal
 * is an unsupported schema version rather than a syntax error, so the reason it
 * carries into both messages is the loader's own sentence rather than the
 * runtime's JSON parser text, which is not part of any contract.
 */
async function seedUnreadableState(cwd: string): Promise<string> {
  const extensionRoot = path.join(cwd, ".pi", "pi-claude-marketplace");
  return seedUnreadableStateAt(extensionRoot);
}

/** Record install state the loader refuses at the given extension root. */
async function seedUnreadableStateAt(extensionRoot: string): Promise<string> {
  await mkdir(extensionRoot, { recursive: true });
  const statePath = path.join(extensionRoot, "state.json");
  await writeFile(statePath, JSON.stringify({ schemaVersion: 99, marketplaces: {} }), "utf8");
  return statePath;
}

/**
 * Declare a project-scope configuration the reconcile refuses. The refusal is a
 * schema violation rather than a syntax error, so the cause it renders is the
 * validator's own sentence rather than the runtime's JSON parser text, which is
 * not part of any contract.
 */
async function seedInvalidConfig(cwd: string): Promise<void> {
  await mkdir(path.join(cwd, ".pi"), { recursive: true });
  await writeFile(
    path.join(cwd, ".pi", "claude-plugins.json"),
    JSON.stringify({ schemaVersion: 99 }),
    "utf8",
  );
}

test("EXPORT-02: the entry module publishes exactly its default and nothing else", () => {
  // arrange
  const published = Object.keys(entryModule);

  // act
  const exported = entryModule.default;

  // assert
  assert.deepStrictEqual(published, ["default"]);
  assert.strictEqual(exported, claudeMarketplaceExtension);
});

test("unsupported loading preserves disk and environment while discovering existing resources", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "unsupported-load");
  await seedEnabledPlugin(scope.cwd, path.join(scope.cwd, "plugin"));
  const promptPath = await seedPrompt(scope.cwd, "existing.md");
  const statePath = path.join(scope.cwd, ".pi", "pi-claude-marketplace", "state.json");
  const stateBytes = await readFile(statePath, "utf8");
  const tree = await retryTree(scope.cwd);
  const userTree = await retryTree(scope.agentDir);
  const capture = createJsonCapture();
  const loaded = await loadExtension(0, 0);
  const ctx = {
    isProjectTrusted: () => true,
    mode: "unknown",
    get ui() {
      return capture.ui;
    },
  };
  process.env.PATH = "/usr/bin";
  process.env.PI_CLAUDE_MARKETPLACE_PATH = "unchanged";

  // act
  const discovered: unknown = await Reflect.apply(loaded.discover, undefined, [
    discoverEvent(scope.cwd),
    ctx,
  ]);

  // assert
  assert.deepStrictEqual(discovered, { skillPaths: [], promptPaths: [promptPath] });
  assert.deepStrictEqual(
    [process.env.PATH, process.env.PI_CLAUDE_MARKETPLACE_PATH],
    ["/usr/bin", "unchanged"],
  );
  assert.strictEqual(await readFile(statePath, "utf8"), stateBytes);
  assert.deepStrictEqual(await retryTree(scope.cwd), tree);
  assert.deepStrictEqual(await retryTree(scope.agentDir), userTree);
  assert.deepStrictEqual(capture.entries, []);
  capture.assertValid();
  loaded.verifyBoundary();
});

for (const mode of ["json", "rpc"]) {
  for (const refusesAppend of [false, true]) {
    test(`load warnings share one ${mode} run and continue after append refusal ${refusesAppend}`, async (t) => {
      // arrange
      const scope = await createHermeticScope(t, "machine-warnings");
      const projectState = await seedUnreadableState(scope.cwd);
      const userState = await seedUnreadableStateAt(
        path.join(scope.agentDir, "pi-claude-marketplace"),
      );
      const promptPath = await seedPrompt(scope.cwd, "kept.md");
      const capture = createJsonCapture();
      const loaded = await loadExtension(0, PROBES_PER_DISCOVER, undefined, 0, {
        attempts: 3,
        appendEntry(customType, payload) {
          capture.entrySink.appendEntry(customType, payload);
          if (refusesAppend) {
            throw new Error("entry refused");
          }
        },
      });
      const refusal = eventRefusingCwdRead(discoverEvent(scope.cwd), CWD_READ_RECONCILE);
      const ctx = {
        isProjectTrusted: () => true,
        mode,
        get ui() {
          return capture.ui;
        },
      };
      process.env.PATH = "/usr/bin";
      process.env.PI_CLAUDE_MARKETPLACE_PATH = "stale-bin";

      // act
      const discovered: unknown = await Reflect.apply(loaded.discover, undefined, [
        refusal.event,
        ctx,
      ]);

      // assert
      assert.deepStrictEqual(discovered, { skillPaths: [], promptPaths: [promptPath] });
      assert.deepStrictEqual(
        [process.env.PATH, process.env.PI_CLAUDE_MARKETPLACE_PATH],
        ["/usr/bin", ""],
      );
      assert.deepStrictEqual(capture.entries, [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin: { kind: "load" },
            kind: "reconcile-aborted",
            severity: "error",
            needsReload: false,
            causeMessage: "working directory read 2 refused",
          },
        },
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin: { kind: "load" },
            kind: "plugin-path-skipped",
            severity: "warning",
            needsReload: false,
            scope: "user",
            reason: `state.json at ${userState} has an unsupported schema version`,
          },
        },
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin: { kind: "load" },
            kind: "plugin-path-skipped",
            severity: "warning",
            needsReload: false,
            scope: "project",
            reason: `state.json at ${projectState} has an unsupported schema version`,
          },
        },
      ]);
      capture.assertValid();
      loaded.verifyBoundary();
    });
  }
}

for (const failure of ["mode", "inventory"] as const) {
  test(`discovery survives a stale ${failure} capability`, async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "prebind");
    const promptPath = await seedPrompt(scope.cwd, "kept.md");
    const tree = await retryTree(scope.cwd);
    const capture = createJsonCapture();
    const loaded = await loadExtension(
      0,
      failure === "inventory" ? PROBES_PER_DISCOVER : 0,
      undefined,
      0,
      {
        attempts: 0,
        appendEntry: capture.entrySink.appendEntry,
        inventoryError: new Error("stale pi"),
      },
    );
    const ctx = {
      isProjectTrusted: () => true,
      get mode(): string {
        if (failure === "mode") {
          throw new Error("stale mode");
        }

        return "json";
      },
      get ui() {
        return capture.ui;
      },
    };
    const originalPath = process.env.PATH;

    // act
    const discovered: unknown = await Reflect.apply(loaded.discover, undefined, [
      discoverEvent(scope.cwd),
      ctx,
    ]);

    // assert
    assert.deepStrictEqual(discovered, { skillPaths: [], promptPaths: [promptPath] });
    assert.strictEqual(process.env.PATH, originalPath);
    assert.deepStrictEqual(await retryTree(scope.cwd), tree);
    assert.deepStrictEqual(capture.entries, []);
    capture.assertValid();
    loaded.verifyBoundary();
  });
}

for (const unsupportedRead of [2, 3]) {
  test(`rechecks live mode before load mutation stage ${unsupportedRead}`, async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "live-load-mode");
    await seedEnabledPlugin(scope.cwd, path.join(scope.cwd, "plugin"));
    const promptPath = await seedPrompt(scope.cwd, "kept.md");
    const capture = createJsonCapture();
    const loaded = await loadExtension(0, PROBES_PER_DISCOVER, undefined, 0);
    let reads = 0;
    const ctx = {
      isProjectTrusted: () => true,
      get mode(): string {
        reads += 1;
        return reads === unsupportedRead ? "unknown" : "json";
      },
      get ui() {
        return capture.ui;
      },
    };
    process.env.PATH = "/usr/bin";
    process.env.PI_CLAUDE_MARKETPLACE_PATH = "unchanged";

    // act
    const discovered: unknown = await Reflect.apply(loaded.discover, undefined, [
      discoverEvent(scope.cwd),
      ctx,
    ]);

    // assert
    assert.deepStrictEqual(discovered, { skillPaths: [], promptPaths: [promptPath] });
    assert.deepStrictEqual(
      [process.env.PATH, process.env.PI_CLAUDE_MARKETPLACE_PATH],
      ["/usr/bin", "unchanged"],
    );
    assert.strictEqual(reads, unsupportedRead);
    assert.deepStrictEqual(capture.entries, []);
    capture.assertValid();
    loaded.verifyBoundary();
  });
}

test("a refused load append leaves install state untouched and still runs the independent PATH work", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "load-append-refusal");
  const resolvedSource = path.join(scope.cwd, "vendored-plugin");
  await seedEnabledPlugin(scope.cwd, resolvedSource);
  await seedInvalidConfig(scope.cwd);
  const statePath = path.join(scope.cwd, ".pi", "pi-claude-marketplace", "state.json");
  const stateBytes = await readFile(statePath, "utf8");
  const capture = createJsonCapture();
  const loaded = await loadExtension(0, PROBES_PER_DISCOVER, undefined, 0, {
    attempts: 2,
    appendEntry(customType, payload) {
      capture.entrySink.appendEntry(customType, payload);
      throw new Error("entry refused");
    },
  });
  const ctx = {
    isProjectTrusted: () => true,
    mode: "json",
    get ui() {
      return capture.ui;
    },
  };
  const binDir = path.join(resolvedSource, "bin");
  process.env.PATH = "/usr/bin";
  Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_PATH");

  // act
  const discovered: unknown = await Reflect.apply(loaded.discover, undefined, [
    discoverEvent(scope.cwd),
    ctx,
  ]);

  // assert
  assert.deepStrictEqual(discovered, EMPTY_DISCOVERY);
  assert.equal(await readFile(statePath, "utf8"), stateBytes);
  assert.deepStrictEqual(
    [process.env.PATH, process.env.PI_CLAUDE_MARKETPLACE_PATH],
    [`/usr/bin${path.delimiter}${binDir}`, binDir],
  );
  assert.strictEqual(capture.entries.length, 2);
  capture.assertValid();
  loaded.verifyBoundary();
});

for (const failure of ["unknown-mode", "mode", "sessionManager"] as const) {
  test(`session environment survives ${failure} context without changes`, async (t) => {
    // arrange
    await createHermeticScope(t, "session-mode");
    const loaded = await loadExtension(0, 0);
    const reads: string[] = [];
    const ctx = {
      isProjectTrusted: () => true,
      get mode(): string {
        if (failure === "mode") {
          throw new Error("stale mode");
        }

        return failure === "unknown-mode" ? "unknown" : "rpc";
      },
      get sessionManager(): never {
        reads.push("sessionManager");
        throw new Error("stale session manager");
      },
    };
    const original = SESSION_ENV_KEYS.map((key) => process.env[key]);

    // act
    Reflect.apply(loaded.sessionEnv, undefined, [
      { type: "session_start", reason: "startup" },
      ctx,
    ]);

    // assert
    assert.deepStrictEqual(
      SESSION_ENV_KEYS.map((key) => process.env[key]),
      original,
    );
    assert.deepStrictEqual(reads, failure === "sessionManager" ? ["sessionManager"] : []);
    loaded.verifyBoundary();
  });
}

test("registers the slash command and the two read-only tools alongside the bridge surface", async (t) => {
  // arrange
  await createHermeticScope(t, "registration");
  const expectedToolNames = ["pi_claude_marketplace_list", "pi_claude_marketplace_plugin_list"];

  // act
  const { command, tools, verifyBoundary } = await loadExtension(0, 0);

  // assert
  assert.deepStrictEqual(
    tools.map((tool) => tool?.name),
    expectedToolNames,
  );
  assert.deepStrictEqual(typeof command.handler, "function");
  verifyBoundary();
});

test("constructs one runtime, completion cache and reconcile operation per extension load", async () => {
  // arrange
  const source = await readFile(
    path.join(import.meta.dirname, "../extensions/pi-claude-marketplace/index.ts"),
    "utf8",
  );
  const runtimeConstructions = source.match(/createHooksRuntime\(\)/g) ?? [];
  const cacheConstructions = source.match(/createCompletionCache\(\)/g) ?? [];
  const routingConstructions =
    source.match(/createHooksRouting\(hooksRuntime, \{ readHooksJson \}\)/g) ?? [];
  const updateConstructions =
    source.match(/createUpdateOperations\(hooksRouting, completionCache\)/g) ?? [];
  const reconcileConstructions = source.match(/createApplyReconcile\(\{ loadState \}\)/g) ?? [];
  const loadConstructions =
    source.match(/createLoadReconcile\(\{ loadState \}, applyReconcile\)/g) ?? [];

  // act
  const hydrationConstruction = source.match(
    /createHooksHydration\(hooksRuntime, \{ loadState, readHooksJson \}\)/g,
  );

  // assert
  assert.deepStrictEqual(runtimeConstructions, ["createHooksRuntime()"]);
  assert.deepStrictEqual(cacheConstructions, ["createCompletionCache()"]);
  assert.deepStrictEqual(routingConstructions, [
    "createHooksRouting(hooksRuntime, { readHooksJson })",
  ]);
  assert.deepStrictEqual(updateConstructions, [
    "createUpdateOperations(hooksRouting, completionCache)",
  ]);
  assert.deepStrictEqual(hydrationConstruction, [
    "createHooksHydration(hooksRuntime, { loadState, readHooksJson })",
  ]);
  assert.deepStrictEqual(reconcileConstructions, ["createApplyReconcile({ loadState })"]);
  assert.deepStrictEqual(loadConstructions, ["createLoadReconcile({ loadState }, applyReconcile)"]);
});

test("APL-03: the discover handler hands the load reconcile the event's cwd and no reason", async () => {
  // arrange -- whitespace-tolerant so a Prettier reflow cannot silently stop
  // matching.
  const source = await readFile(
    path.join(import.meta.dirname, "../extensions/pi-claude-marketplace/index.ts"),
    "utf8",
  );

  // act
  const loadCalls =
    source.match(
      /loadReconcile\(\{\s*ctx,\s*run,\s*cwd:\s*event\.cwd,\s*hooksRouting,\s*completionCache,?\s*\}\)/g,
    ) ?? [];

  // assert
  assert.equal(loadCalls.length, 1);
});

test("APL-03 / D-05 / D-21: a reload event lists the missing dependency's install, leaves it uninstalled and its dependent's record unchanged", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "dep-reload");
  await seedEnabledPluginWithMissingDependency(scope.cwd);
  const extensionRoot = path.join(scope.cwd, ".pi", "pi-claude-marketplace");
  const before = await loadState(extensionRoot);
  const { discover, ctx, notifications, verifyBoundary } = await loadExtension(
    1,
    PROBES_PER_DISCOVER,
  );

  // act
  await discover(discoverEvent(scope.cwd, "reload"), ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [project]\n  ● helper (will install)\n\n" +
        "Reconcile pending: 1 success\n\n/claude:plugin apply to make these changes",
    },
  ]);
  const after = await loadState(extensionRoot);
  assert.equal(after.marketplaces["mp"]?.plugins["helper"], undefined);
  assert.deepStrictEqual(after, before);
  verifyBoundary();
});

/** AAP-02: turn autoapply on in the base config that a seed wrote under `scopeRoot`. */
async function turnAutoapplyOn(scopeRoot: string): Promise<void> {
  const configPath = path.join(scopeRoot, "claude-plugins.json");
  const config = JSON.parse(await readFile(configPath, "utf8")) as object;
  await writeFile(configPath, JSON.stringify({ ...config, autoapply: true }), "utf8");
}

test("AAP-02 / D-06: an autoapply reload installs a user plugin's missing dependency and the same discover returns its skill", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "autoapply-reload");
  await seedEnabledPluginWithMissingDependency(scope.cwd, scope.agentDir);
  const skillSource = path.join(scope.cwd, "mp-src", "plugins", "helper", "skills", "assist");
  await mkdir(skillSource, { recursive: true });
  await writeFile(
    path.join(skillSource, "SKILL.md"),
    "---\nname: assist\ndescription: Assists.\n---\n# assist\n",
    "utf8",
  );
  await turnAutoapplyOn(scope.agentDir);
  const extensionRoot = path.join(scope.agentDir, "pi-claude-marketplace");
  const { discover, ctx, notifications, verifyBoundary } = await loadExtension(
    1,
    PROBES_PER_DISCOVER,
  );

  // act
  const discovered = await discover(discoverEvent(scope.cwd, "reload"), ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [user]\n  ● helper v1.0.0 (installed) {dependency installed}\n\n" +
        "Reconcile: 1 success\n\n/reload to pick up changes",
    },
  ]);
  const after = await loadState(extensionRoot);
  assert.equal(after.marketplaces["mp"]?.plugins["helper"]?.enabled, true);
  assert.deepStrictEqual(discovered, {
    skillPaths: [path.join(extensionRoot, "resources", "skills", "helper-assist")],
    promptPaths: [],
  });
  verifyBoundary();
});

test("AAP-03 / NFR-2: an autoapply load whose apply throws reports the abort and still discovers resources", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "autoapply-throw");
  const previousBase = process.env.PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL;
  t.after(() => {
    restoreEnv("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", previousBase);
  });
  process.env.PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL = "not a url";
  await mkdir(scope.agentDir, { recursive: true });
  await writeFile(
    path.join(scope.agentDir, "claude-plugins.json"),
    JSON.stringify({ marketplaces: { tools: { source: "acme/tools" } }, autoapply: true }),
    "utf8",
  );
  const promptPath = await seedPrompt(scope.cwd, "kept.md");
  const { discover, ctx, notifications, verifyBoundary } = await loadExtension(
    1,
    PROBES_PER_DISCOVER,
  );

  // act
  const discovered = await discover(discoverEvent(scope.cwd, "startup"), ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: "reconcile aborted: PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL is not a valid URL.",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(discovered, { skillPaths: [], promptPaths: [promptPath] });
  verifyBoundary();
});

/**
 * ASTAT-01: record an enabled project-scope plugin "hello" whose installation
 * wrote the MCP server "srv". The marketplace declares no plugin, so info
 * renders the record's own inventory under `{not in manifest}`.
 */
async function seedRecordedMcpPlugin(cwd: string): Promise<void> {
  const extensionRoot = path.join(cwd, ".pi", "pi-claude-marketplace");
  const marketplaceRoot = path.join(cwd, "mp-src");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(extensionRoot, { recursive: true });
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify({ name: "mp", plugins: [] }), "utf8");
  const hello = buildInstalledPluginRecord(
    { version: "1.0.0" },
    { skills: [], prompts: [], agents: [], mcpServers: ["srv"], hooks: [], workflows: [] },
  );
  await mergeMarketplaceIntoState(extensionRoot, "mp", {
    name: "mp",
    scope: "project",
    source: { kind: "path", raw: "./mp-src", logical: "./mp-src" },
    addedFromCwd: cwd,
    manifestPath,
    marketplaceRoot,
    plugins: { hello },
  });
}

test("ASTAT-01: /claude:plugin info shows the status pi-mcp-adapter last published, and a fresh extension load starts with none", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "mcp-status");
  await seedRecordedMcpPlugin(scope.cwd);
  const first = await loadExtension(2, 2, { value: scope.cwd, reads: 2 }, 6);

  // act
  await first.command.handler("info hello@mp --scope project", first.ctx);
  first.publishStatus({
    version: 1,
    servers: [{ name: "plugin_hello_srv_", status: "connected" }],
  });
  await first.command.handler("info hello@mp --scope project", first.ctx);
  const reloaded = await loadExtension(1, 1, { value: scope.cwd, reads: 1 }, 3);
  await reloaded.command.handler("info hello@mp --scope project", reloaded.ctx);

  // assert
  assert.deepStrictEqual(first.notifications, [
    {
      message:
        "● mp [project] <no autoupdate>\n" +
        "  ● hello v1.0.0 (installed) {not in manifest}\n" +
        "    mcp: plugin:hello:srv (status unknown)\n" +
        "    requires: pi-mcp-adapter (missing)",
    },
    {
      message:
        "● mp [project] <no autoupdate>\n" +
        "  ● hello v1.0.0 (installed) {not in manifest}\n" +
        "    mcp: plugin:hello:srv (connected)\n" +
        "    requires: pi-mcp-adapter (missing)",
    },
  ]);
  assert.deepStrictEqual(reloaded.notifications, [
    {
      message:
        "● mp [project] <no autoupdate>\n" +
        "  ● hello v1.0.0 (installed) {not in manifest}\n" +
        "    mcp: plugin:hello:srv (status unknown)\n" +
        "    requires: pi-mcp-adapter (missing)",
    },
  ]);
  first.verifyBoundary();
  reloaded.verifyBoundary();
});

test("keeps hook routing and command completion state inside each extension-load owner graph", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "owner-graph");
  const ownerCwd = scope.cwd;
  const peerCwd = path.join(scope.cwd, "peer-project");
  await mkdir(peerCwd, { recursive: true });
  await seedBlockingHookPlugin(ownerCwd, scope.agentDir);
  const ownerMarketplace = await seedMarketplaceSource(ownerCwd, "owned-rows", "hello");
  process.chdir(ownerCwd);
  // One probe: the command's notification run is the only one, and the add
  // notification renders from its snapshot (D-05).
  const owner = await loadExtension(1, 1, { value: ownerCwd, reads: 1 }, 3);
  const ownerHookContext = hookContext(ownerCwd, "owner-graph-session");
  await owner.bridgeSessionStart({ type: "session_start", reason: "startup" }, ownerHookContext);
  const toolEvent: ToolCallEvent = {
    type: "tool_call",
    toolCallId: "owner-graph-call",
    toolName: "bash",
    input: { command: "git status" },
  };

  // act
  const ownerHookBeforeMutation = await owner.toolCall(
    structuredClone(toolEvent),
    ownerHookContext,
  );
  await owner.command.handler(`marketplace add ${ownerMarketplace} --scope project`, owner.ctx);
  const ownerCandidates = await owner.command.getArgumentCompletions?.("install --scope project ");
  process.chdir(peerCwd);
  const peer = await loadExtension(0, 0);
  const peerHookContext = hookContext(peerCwd, "peer-graph-session");
  await peer.bridgeSessionStart({ type: "session_start", reason: "startup" }, peerHookContext);
  const peerHookResult = await peer.toolCall(structuredClone(toolEvent), peerHookContext);
  const peerCandidates = await peer.command.getArgumentCompletions?.("install --scope project ");
  process.chdir(ownerCwd);
  const ownerHookAfterPeerLoad = await owner.toolCall(structuredClone(toolEvent), ownerHookContext);

  // assert
  assert.deepStrictEqual(ownerHookBeforeMutation, {
    block: true,
    reason: "PreToolUse:Bash hook error: owned hook",
  });
  assert.strictEqual(peerHookResult, undefined);
  assert.deepStrictEqual(ownerCandidates, [
    {
      label: "hello@owned-rows",
      value: "install --scope project hello@owned-rows ",
    },
  ]);
  assert.deepStrictEqual(peerCandidates, []);
  assert.deepStrictEqual(ownerHookAfterPeerLoad, {
    block: true,
    reason: "PreToolUse:Bash hook error: owned hook",
  });
  assert.deepStrictEqual(owner.notifications, [{ message: "● owned-rows [project] (added)" }]);
  owner.verifyBoundary();
  peer.verifyBoundary();
});

test("discovers prompts under the working directory the event names, not the one the process runs in", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "invocation-cwd");
  const eventPromptPath = await seedPrompt(scope.cwd, "event-cwd.md");
  await seedPrompt(process.cwd(), "process-cwd.md");
  const { discover, ctx, verifyBoundary } = await loadExtension(0, PROBES_PER_DISCOVER);
  const expectedDiscovery: ResourcesDiscoverResult = {
    skillPaths: [],
    promptPaths: [eventPromptPath],
  };

  // act
  const discovered = await discover(discoverEvent(scope.cwd), ctx);

  // assert
  assert.deepStrictEqual(discovered, expectedDiscovery);
  verifyBoundary();
});

test("T-02-17: discovers the user scope's prompts and not the project's when Pi does not trust the project", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "untrusted-project");
  await seedPrompt(scope.cwd, "project.md");
  const userPromptsDir = path.join(scope.agentDir, "pi-claude-marketplace", "resources", "prompts");
  await mkdir(userPromptsDir, { recursive: true });
  const userPromptPath = path.join(userPromptsDir, "user.md");
  await writeFile(userPromptPath, "# prompt\n", "utf8");
  const loaded = await loadExtension(0, PROBES_PER_DISCOVER);
  let trustReads = 0;
  const untrusted = new Proxy(loaded.ctx, {
    get(target, property, receiver): unknown {
      if (property === "isProjectTrusted") {
        return () => {
          trustReads += 1;
          return false;
        };
      }

      return Reflect.get(target, property, receiver);
    },
  });

  // act
  const discovered = await loaded.discover(discoverEvent(scope.cwd), untrusted);

  // assert
  assert.deepStrictEqual(discovered, { skillPaths: [], promptPaths: [userPromptPath] });
  assert.strictEqual(trustReads, 1);
  loaded.verifyBoundary();
});

test("leaves both scope roots untouched and emits nothing when a pristine workspace reconciles (WR-05)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "pristine");
  const { discover, ctx, notifications, verifyBoundary } = await loadExtension(
    0,
    PROBES_PER_DISCOVER,
  );

  // act
  const discovered = await discover(discoverEvent(scope.cwd), ctx);

  // assert
  assert.deepStrictEqual(discovered, EMPTY_DISCOVERY);
  assert.deepStrictEqual(existsSync(path.join(scope.cwd, ".pi")), false);
  assert.deepStrictEqual(await readdir(scope.agentDir), []);
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
});

test("appends the recorded plugin's binaries to the process PATH and records them in the ledger (PENV-01)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "plugin-path");
  const resolvedSource = path.join(scope.cwd, "vendored-plugin");
  const binDir = path.join(resolvedSource, "bin");
  await seedEnabledPlugin(scope.cwd, resolvedSource);
  const { discover, ctx, verifyBoundary } = await loadExtension(0, PROBES_PER_DISCOVER);
  process.env.PATH = "/usr/bin";
  Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_PATH");
  const expectedPath = `/usr/bin${path.delimiter}${binDir}`;

  // act
  await discover(discoverEvent(scope.cwd), ctx);

  // assert
  assert.deepStrictEqual(process.env.PATH, expectedPath);
  assert.deepStrictEqual(process.env.PI_CLAUDE_MARKETPLACE_PATH, binDir);
  verifyBoundary();
});

test(
  "contains one aggregate discovery failure and recovers through the same callback",
  { concurrency: false },
  async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "discovery-recovery");
    const resolvedSource = path.join(scope.cwd, "vendored-plugin");
    const binDir = path.join(resolvedSource, "bin");
    await seedEnabledPlugin(scope.cwd, resolvedSource);
    const promptPath = await seedPrompt(scope.cwd, "recovered.md");
    const skillPath = path.join(
      scope.cwd,
      ".pi",
      "pi-claude-marketplace",
      "resources",
      "skills",
      "recovered-skill",
    );
    await mkdir(skillPath, { recursive: true });
    await writeFile(path.join(skillPath, "SKILL.md"), "---\nname: recovered-skill\n---\nbody\n");
    const { discover, ctx, notifications, verifyBoundary } = await loadExtension(
      0,
      2 * PROBES_PER_DISCOVER,
    );
    process.env.PATH = "/usr/bin";
    Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_PATH");
    const invalidProjectCwd = `${scope.cwd}\0`;
    const replacement = eventReplacingCwdRead(
      discoverEvent(scope.cwd),
      CWD_READS_PER_DISCOVER,
      invalidProjectCwd,
    );
    const statePath = path.join(scope.cwd, ".pi", "pi-claude-marketplace", "state.json");
    const configPath = path.join(scope.cwd, ".pi", "claude-plugins.json");
    const expectedState = {
      schemaVersion: 3,
      marketplaces: {
        mp: {
          name: "mp",
          scope: "project",
          source: { kind: "path", raw: path.join(scope.cwd, "mp-src") },
          addedFromCwd: scope.cwd,
          manifestPath: path.join(scope.cwd, "mp-src", ".claude-plugin", "marketplace.json"),
          marketplaceRoot: path.join(scope.cwd, "mp-src"),
          plugins: {
            plug: {
              version: "1.0.0",
              resolvedSource,
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: {
                skills: [],
                prompts: [],
                agents: [],
                mcpServers: [],
                hooks: [],
                workflows: [],
              },
              enabled: true,
              provenance: "explicit",
              installedAt: "2026-08-03T00:00:00.000Z",
              updatedAt: "2026-08-03T00:00:00.000Z",
            },
          },
        },
      },
    };
    const expectedConfig = {
      schemaVersion: 1,
      marketplaces: { mp: { source: path.join(scope.cwd, "mp-src") } },
      plugins: { "plug@mp": {} },
    };
    const expectedPath = `/usr/bin${path.delimiter}${binDir}`;
    const expectedDiscovery: ResourcesDiscoverResult = {
      skillPaths: [skillPath],
      promptPaths: [promptPath],
    };

    // act
    const failedDiscovery = await discover(replacement.event, ctx);

    // assert
    assert.deepStrictEqual(failedDiscovery, EMPTY_DISCOVERY);
    assert.deepStrictEqual(JSON.parse(await readFile(statePath, "utf8")), expectedState);
    assert.deepStrictEqual(JSON.parse(await readFile(configPath, "utf8")), expectedConfig);
    assert.deepStrictEqual(process.env.PATH, expectedPath);
    assert.deepStrictEqual(process.env.PI_CLAUDE_MARKETPLACE_PATH, binDir);
    assert.deepStrictEqual(
      { replaced: replacement.replaced(), reads: replacement.readCount() },
      { replaced: true, reads: CWD_READS_PER_DISCOVER },
    );
    assert.deepStrictEqual(notifications, []);
    const stateBytesAfterFailure = await readFile(statePath, "utf8");
    const configBytesAfterFailure = await readFile(configPath, "utf8");

    // act
    const recoveredDiscovery = await discover(discoverEvent(scope.cwd), ctx);

    // assert
    assert.deepStrictEqual(recoveredDiscovery, expectedDiscovery);
    assert.deepStrictEqual(await readFile(statePath, "utf8"), stateBytesAfterFailure);
    assert.deepStrictEqual(await readFile(configPath, "utf8"), configBytesAfterFailure);
    assert.deepStrictEqual(process.env.PATH, expectedPath);
    assert.deepStrictEqual(process.env.PI_CLAUDE_MARKETPLACE_PATH, binDir);
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
  },
);

test("reports the scope whose install state it cannot read once as a reconcile failure and once as a plugin PATH warning (PENV-01)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "path-warning");
  const statePath = await seedUnreadableState(scope.cwd);
  const { discover, ctx, notifications, verifyBoundary } = await loadExtension(
    2,
    PROBES_PER_DISCOVER,
  );
  const expectedNotifications: readonly Notification[] = [
    { message: RECONCILE_CASCADE_FOR_UNREADABLE_STATE, severity: "error" },
    {
      message:
        "plugin PATH not refreshed for project scope (install state unreadable): " +
        `state.json at ${statePath} has an unsupported schema version`,
      severity: "warning",
    },
  ];

  // act
  const discovered = await discover(discoverEvent(scope.cwd), ctx);

  // assert
  assert.deepStrictEqual(discovered, EMPTY_DISCOVERY);
  assert.deepStrictEqual(notifications, expectedNotifications);
  verifyBoundary();
});

// The three refusal cases below all seed one enabled plugin, so the plugin PATH
// recompute has something to do. The answer and the read count are identical for
// all three, so a case stating only those two would be the pristine-workspace
// case written three times under three titles. What separates them is one
// observable per stage: the PATH the recompute leaves behind, and which of the
// two lines the reconcile stage emits.

test("APL-03: a load reports nothing and writes nothing over a recorded plugin whose source tree is absent (WCONV-01)", async (t) => {
  // arrange -- the seed the PATH cases use, with the plugin's source tree never
  // created. A load moves nothing (D-04), so no row reaches the user on a
  // reload they did not initiate.
  const scope = await createHermeticScope(t, "absent-source");
  const resolvedSource = path.join(scope.cwd, "vendored-plugin");
  await seedEnabledPlugin(scope.cwd, resolvedSource);
  const statePath = path.join(scope.cwd, ".pi", "pi-claude-marketplace", "state.json");
  const stateBytes = await readFile(statePath, "utf8");
  const { discover, ctx, notifications, verifyBoundary } = await loadExtension(
    0,
    PROBES_PER_DISCOVER,
  );

  // act
  const discovered = await discover(discoverEvent(scope.cwd), ctx);

  // assert
  assert.deepStrictEqual(discovered, EMPTY_DISCOVERY);
  assert.deepStrictEqual(notifications, []);
  assert.equal(await readFile(statePath, "utf8"), stateBytes);
  verifyBoundary();
});

test("still answers when the deferred project-scope hydrate fails (NFR-2)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "hydrate-refused");
  const resolvedSource = path.join(scope.cwd, "vendored-plugin");
  const binDir = path.join(resolvedSource, "bin");
  await seedEnabledPlugin(scope.cwd, resolvedSource);
  // Seeded so the reconcile has something of its own to say. Without it this
  // case passes with the refusal retargeted at the reconcile read, because a
  // reconcile that never runs is silent and a reconcile with nothing to report
  // is silent too.
  await seedInvalidConfig(scope.cwd);
  const { discover, ctx, notifications, verifyBoundary } = await loadExtension(
    1,
    PROBES_PER_DISCOVER,
  );
  process.env.PATH = "/usr/bin";
  Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_PATH");
  const refusal = eventRefusingCwdRead(discoverEvent(scope.cwd), CWD_READ_DEFERRED_HYDRATE);
  const expectedReads = { refused: true, reads: CWD_READS_PER_DISCOVER };
  const expectedNotifications: readonly Notification[] = [
    { message: PENDING_BLOCK_FOR_INVALID_CONFIG, severity: "error" },
  ];

  // act
  const discovered = await discover(refusal.event, ctx);

  // assert
  assert.deepStrictEqual(discovered, EMPTY_DISCOVERY);
  // The refusal landed upstream of the reconcile, so the reconcile ran and
  // reported its own refusal of the seeded config. Retargeted at the reconcile
  // read this line becomes the raw `reconcile aborted` line instead.
  assert.deepStrictEqual(notifications, expectedNotifications);
  assert.deepStrictEqual({ refused: refusal.refused(), reads: refusal.readCount() }, expectedReads);
  // The refusal landed upstream of the recompute, so that stage still ran.
  assert.deepStrictEqual(process.env.PATH, `/usr/bin${path.delimiter}${binDir}`);
  assert.deepStrictEqual(process.env.PI_CLAUDE_MARKETPLACE_PATH, binDir);
  verifyBoundary();
});

test("still answers when the reconcile fails (NFR-2)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "reconcile-refused");
  const resolvedSource = path.join(scope.cwd, "vendored-plugin");
  const binDir = path.join(resolvedSource, "bin");
  await seedEnabledPlugin(scope.cwd, resolvedSource);
  const { discover, ctx, notifications, verifyBoundary } = await loadExtension(
    1,
    PROBES_PER_DISCOVER,
  );
  process.env.PATH = "/usr/bin";
  Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_PATH");
  const refusal = eventRefusingCwdRead(discoverEvent(scope.cwd), CWD_READ_RECONCILE);
  const expectedReads = { refused: true, reads: CWD_READS_PER_DISCOVER };
  // The workspace is otherwise clean, so this line exists only because the
  // reconcile stage was the one refused. Retargeted at either neighbouring read
  // the refusal is swallowed silently and nothing is emitted at all.
  const expectedNotifications: readonly Notification[] = [
    {
      message: `reconcile aborted: working directory read ${String(CWD_READ_RECONCILE)} refused`,
      severity: "error",
    },
  ];

  // act
  const discovered = await discover(refusal.event, ctx);

  // assert
  assert.deepStrictEqual(discovered, EMPTY_DISCOVERY);
  assert.deepStrictEqual(notifications, expectedNotifications);
  assert.deepStrictEqual({ refused: refusal.refused(), reads: refusal.readCount() }, expectedReads);
  // The recompute is downstream of the reconcile, so it still ran.
  assert.deepStrictEqual(process.env.PATH, `/usr/bin${path.delimiter}${binDir}`);
  assert.deepStrictEqual(process.env.PI_CLAUDE_MARKETPLACE_PATH, binDir);
  verifyBoundary();
});

test("still answers when the plugin PATH recompute fails (NFR-2)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "recompute-refused");
  const resolvedSource = path.join(scope.cwd, "vendored-plugin");
  await seedEnabledPlugin(scope.cwd, resolvedSource);
  const { discover, ctx, notifications, verifyBoundary } = await loadExtension(
    0,
    PROBES_PER_DISCOVER,
  );
  process.env.PATH = "/usr/bin";
  Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_PATH");
  const refusal = eventRefusingCwdRead(discoverEvent(scope.cwd), CWD_READ_PLUGIN_PATH_RECOMPUTE);
  const expectedReads = { refused: true, reads: CWD_READS_PER_DISCOVER };

  // act
  const discovered = await discover(refusal.event, ctx);

  // assert
  assert.deepStrictEqual(discovered, EMPTY_DISCOVERY);
  assert.deepStrictEqual(notifications, []);
  assert.deepStrictEqual({ refused: refusal.refused(), reads: refusal.readCount() }, expectedReads);
  // The refusal landed ON the recompute, so that stage left the PATH alone.
  assert.deepStrictEqual(process.env.PATH, "/usr/bin");
  assert.deepStrictEqual(process.env.PI_CLAUDE_MARKETPLACE_PATH, undefined);
  verifyBoundary();
});

test("reports an aborted reconcile as one raw error line and still answers (NFR-2)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "reconcile-aborted");
  await seedInvalidConfig(scope.cwd);
  const { discover, ctx, verifyBoundary } = await loadExtension(
    0,
    PROBES_PER_DISCOVER,
    undefined,
    5,
  );
  const recorded: Notification[] = [];
  let attempts = 0;
  const refusing = contextNotifyingThrough(ctx, (message, severity) => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error("host notification refused");
    }

    recorded.push(severity === undefined ? { message } : { message, severity });
  });
  const expectedNotifications: readonly Notification[] = [
    { message: "reconcile aborted: host notification refused", severity: "error" },
  ];

  // act
  const discovered = await discover(discoverEvent(scope.cwd), refusing);

  // assert
  assert.deepStrictEqual(discovered, EMPTY_DISCOVERY);
  assert.deepStrictEqual(recorded, expectedNotifications);
  verifyBoundary();
});

test("still answers when the last-ditch reconcile notification is also refused (NFR-2)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "last-ditch-refused");
  await seedInvalidConfig(scope.cwd);
  const { discover, ctx, verifyBoundary } = await loadExtension(
    0,
    PROBES_PER_DISCOVER,
    undefined,
    5,
  );
  const attempted: Notification[] = [];
  const refusing = contextNotifyingThrough(ctx, refuseEveryNotification(attempted));
  const expectedAttempts: readonly Notification[] = [
    { message: PENDING_BLOCK_FOR_INVALID_CONFIG, severity: "error" },
    { message: "reconcile aborted: host notification refused", severity: "error" },
  ];

  // act
  const discovered = await discover(discoverEvent(scope.cwd), refusing);

  // assert
  assert.deepStrictEqual(discovered, EMPTY_DISCOVERY);
  assert.deepStrictEqual(attempted, expectedAttempts);
  verifyBoundary();
});

test("still answers when the plugin PATH warning notification is refused (NFR-2)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "warning-refused");
  const statePath = await seedUnreadableState(scope.cwd);
  const { discover, ctx, verifyBoundary } = await loadExtension(
    0,
    PROBES_PER_DISCOVER,
    undefined,
    6,
  );
  const attempted: Notification[] = [];
  const refusing = contextNotifyingThrough(ctx, refuseEveryNotification(attempted));
  const expectedAttempts: readonly Notification[] = [
    { message: RECONCILE_CASCADE_FOR_UNREADABLE_STATE, severity: "error" },
    { message: "reconcile aborted: host notification refused", severity: "error" },
    {
      message:
        "plugin PATH not refreshed for project scope (install state unreadable): " +
        `state.json at ${statePath} has an unsupported schema version`,
      severity: "warning",
    },
  ];

  // act
  const discovered = await discover(discoverEvent(scope.cwd), refusing);

  // assert
  assert.deepStrictEqual(discovered, EMPTY_DISCOVERY);
  assert.deepStrictEqual(attempted, expectedAttempts);
  verifyBoundary();
});

test("attempts every skipped-scope PATH warning when every host notification throws", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "all-path-warnings-refused");
  const projectStatePath = await seedUnreadableState(scope.cwd);
  const userStatePath = await seedUnreadableStateAt(
    path.join(scope.home, ".pi", "agent", "pi-claude-marketplace"),
  );
  const invalidStateBytes = JSON.stringify({ schemaVersion: 99, marketplaces: {} });
  const validStateBytes = JSON.stringify({
    schemaVersion: 2,
    marketplaces: {},
  });
  const staleUserBin = path.join(scope.home, "stale-user", "bin");
  const staleProjectBin = path.join(scope.cwd, "stale-project", "bin");
  process.env.PATH = ["/usr/bin", staleUserBin, staleProjectBin].join(path.delimiter);
  process.env.PI_CLAUDE_MARKETPLACE_PATH = [staleUserBin, staleProjectBin].join(path.delimiter);
  const { discover, ctx, verifyBoundary } = await loadExtension(
    0,
    2 * PROBES_PER_DISCOVER,
    undefined,
    10,
  );
  const attempted: Notification[] = [];
  const refusing = contextNotifyingThrough(ctx, refuseEveryNotification(attempted));
  const expectedAttempts: readonly Notification[] = [
    { message: RECONCILE_CASCADE_FOR_TWO_UNREADABLE_STATES, severity: "error" },
    { message: "reconcile aborted: host notification refused", severity: "error" },
    {
      message:
        "plugin PATH not refreshed for user scope (install state unreadable): " +
        `state.json at ${userStatePath} has an unsupported schema version`,
      severity: "warning",
    },
    {
      message:
        "plugin PATH not refreshed for project scope (install state unreadable): " +
        `state.json at ${projectStatePath} has an unsupported schema version`,
      severity: "warning",
    },
  ];

  // act
  const discovered = await discover(discoverEvent(scope.cwd), refusing);

  // assert
  assert.deepStrictEqual(discovered, EMPTY_DISCOVERY);
  assert.deepStrictEqual(await readFile(projectStatePath, "utf8"), invalidStateBytes);
  assert.deepStrictEqual(await readFile(userStatePath, "utf8"), invalidStateBytes);
  assert.deepStrictEqual(process.env.PATH, "/usr/bin");
  assert.deepStrictEqual(process.env.PI_CLAUDE_MARKETPLACE_PATH, "");
  assert.deepStrictEqual(attempted, expectedAttempts);
  await writeFile(projectStatePath, validStateBytes, "utf8");
  await writeFile(userStatePath, validStateBytes, "utf8");

  // act
  const followingDiscovery = await discover(discoverEvent(scope.cwd), refusing);

  // assert
  assert.deepStrictEqual(followingDiscovery, EMPTY_DISCOVERY);
  assert.deepStrictEqual(await readFile(projectStatePath, "utf8"), validStateBytes);
  assert.deepStrictEqual(await readFile(userStatePath, "utf8"), validStateBytes);
  assert.deepStrictEqual(process.env.PATH, "/usr/bin");
  assert.deepStrictEqual(process.env.PI_CLAUDE_MARKETPLACE_PATH, "");
  assert.deepStrictEqual(attempted, expectedAttempts);
  verifyBoundary();
});

test("applies the three Claude-Code session variables from the session id (SENV-01/02/03)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "session-env");
  const { sessionEnv, ctx, verifyBoundary } = await loadExtension(
    0,
    0,
    { value: scope.cwd, reads: 1 },
    1,
  );
  const sessionCtx = contextWithSessionId(ctx, () => "session-1");
  const expectedSessionEnv = ["1", "session-1", "session-1"];

  // act
  sessionEnv({ type: "session_start", reason: "startup" }, sessionCtx);

  // assert
  assert.deepStrictEqual(
    SESSION_ENV_KEYS.map((key) => process.env[key]),
    expectedSessionEnv,
  );
  verifyBoundary();
});

test("leaves the session variables alone when the session id cannot be read (WR-02)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "session-env-refused");
  const { sessionEnv, ctx, verifyBoundary } = await loadExtension(
    0,
    0,
    { value: scope.cwd, reads: 1 },
    1,
  );
  const sessionCtx = contextWithSessionId(ctx, () => {
    throw new Error("session id refused");
  });
  for (const key of SESSION_ENV_KEYS) {
    Reflect.deleteProperty(process.env, key);
  }

  const expectedSessionEnv = [undefined, undefined, undefined];

  // act
  sessionEnv({ type: "session_start", reason: "startup" }, sessionCtx);

  // assert
  assert.deepStrictEqual(
    SESSION_ENV_KEYS.map((key) => process.env[key]),
    expectedSessionEnv,
  );
  verifyBoundary();
});

test("leaves the session variables alone when there is no session manager (WR-02)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "session-env-absent");
  const { sessionEnv, ctx, verifyBoundary } = await loadExtension(
    0,
    0,
    { value: scope.cwd, reads: 1 },
    1,
  );
  const sessionCtx = contextWithoutSessionManager(ctx);
  for (const key of SESSION_ENV_KEYS) {
    Reflect.deleteProperty(process.env, key);
  }

  const expectedSessionEnv = [undefined, undefined, undefined];

  // act
  sessionEnv({ type: "session_start", reason: "startup" }, sessionCtx);

  // assert
  assert.deepStrictEqual(
    SESSION_ENV_KEYS.map((key) => process.env[key]),
    expectedSessionEnv,
  );
  verifyBoundary();
});

test("AVAR-03: the factory sets the reserved empty variable and CLAUDE_PROJECT_DIR from the process working directory", async (t) => {
  // arrange
  await createHermeticScope(t, "adapter-env-factory");
  const expectedProjectDir = process.cwd();
  process.env.PI_CLAUDE_MARKETPLACE_EMPTY = "stale";
  process.env.CLAUDE_PROJECT_DIR = "/work/stale";

  // act
  const { verifyBoundary } = await loadExtension(0, 0);

  // assert
  assert.deepStrictEqual(
    [process.env.PI_CLAUDE_MARKETPLACE_EMPTY, process.env.CLAUDE_PROJECT_DIR],
    ["", expectedProjectDir],
  );
  verifyBoundary();
});

test("AVAR-01: session_start refreshes CLAUDE_PROJECT_DIR from the session's cwd", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "adapter-env-session");
  const { sessionEnv, ctx, verifyBoundary } = await loadExtension(
    0,
    0,
    { value: scope.cwd, reads: 1 },
    1,
  );
  const sessionCtx = contextWithSessionId(ctx, () => "session-1");
  process.env.PI_CLAUDE_MARKETPLACE_EMPTY = "stale";
  process.env.CLAUDE_PROJECT_DIR = "/work/stale";

  // act
  sessionEnv({ type: "session_start", reason: "startup" }, sessionCtx);

  // assert
  assert.deepStrictEqual(
    [process.env.PI_CLAUDE_MARKETPLACE_EMPTY, process.env.CLAUDE_PROJECT_DIR],
    ["", scope.cwd],
  );
  verifyBoundary();
});

test("AVAR-01: session_start removes CLAUDE_PROJECT_DIR for a working directory holding an adapter variable marker", async (t) => {
  // arrange
  await createHermeticScope(t, "adapter-env-marker");
  const { sessionEnv, ctx, verifyBoundary } = await loadExtension(
    0,
    0,
    { value: "/work/{env:SECRET}", reads: 1 },
    1,
  );
  const sessionCtx = contextWithSessionId(ctx, () => "session-1");
  process.env.PI_CLAUDE_MARKETPLACE_EMPTY = "stale";
  process.env.CLAUDE_PROJECT_DIR = "/work/previous";

  // act
  sessionEnv({ type: "session_start", reason: "startup" }, sessionCtx);

  // assert
  assert.deepStrictEqual(
    [process.env.PI_CLAUDE_MARKETPLACE_EMPTY, process.env.CLAUDE_PROJECT_DIR],
    ["", undefined],
  );
  verifyBoundary();
});

test("NFR-2 / AVAR-01: a session context whose cwd cannot be read still empties the reserved variable, removes CLAUDE_PROJECT_DIR and does not throw", async (t) => {
  // arrange
  await createHermeticScope(t, "adapter-env-refused");
  const { sessionEnv, ctx, verifyBoundary } = await loadExtension(0, 0, undefined, 1);
  const sessionCtx = contextRefusingCwdRead(contextWithSessionId(ctx, () => "session-1"));
  process.env.PI_CLAUDE_MARKETPLACE_EMPTY = "stale";
  process.env.CLAUDE_PROJECT_DIR = "/work/previous";

  // act
  sessionEnv({ type: "session_start", reason: "startup" }, sessionCtx);

  // assert
  assert.deepStrictEqual(
    [
      process.env.PI_CLAUDE_MARKETPLACE_EMPTY,
      process.env.CLAUDE_PROJECT_DIR,
      ...SESSION_ENV_KEYS.map((key) => process.env[key]),
    ],
    ["", undefined, "1", "session-1", "session-1"],
  );
  verifyBoundary();
});

/** Claude Code's opt-out variables and the Pi-only delay knob (D-PL8-08, D-PL8-09). */
const BACKGROUND_UPDATE_ENV_KEYS = [
  "PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS",
  "DISABLE_UPDATES",
  "DISABLE_AUTOUPDATER",
  "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
  "FORCE_AUTOUPDATE_PLUGINS",
] as const;

/** Clears the opt-outs and sets a zero delay, restoring each variable after the case. */
function armBackgroundUpdateAtOnce(t: TestContext): void {
  for (const key of BACKGROUND_UPDATE_ENV_KEYS) {
    const previous = process.env[key];
    t.after(() => {
      restoreEnv(key, previous);
    });
    Reflect.deleteProperty(process.env, key);
  }

  process.env.PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS = "0";
}

/** Mocks `setTimeout` and counts the delays it schedules and the `unref` calls on them. */
function countBackgroundTimers(t: TestContext): {
  readonly delays: number[];
  readonly unrefCount: () => number;
} {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const mockedSetTimeout = globalThis.setTimeout;
  const delays: number[] = [];
  const unrefSpies: { readonly mock: { callCount: () => number } }[] = [];
  t.mock.method(globalThis, "setTimeout", (callback: () => void, delay: number) => {
    delays.push(delay);
    const timer = mockedSetTimeout(callback, delay);
    unrefSpies.push(t.mock.method(timer, "unref"));
    return timer;
  });
  return {
    delays,
    unrefCount: () => unrefSpies.reduce((count, spy) => count + spy.mock.callCount(), 0),
  };
}

function backgroundContext(
  mode: ExtensionContext["mode"],
  cwd: string,
): Pick<ExtensionContext, "mode" | "cwd" | "ui"> {
  return {
    mode,
    cwd,
    get ui(): ExtensionContext["ui"] {
      throw new Error("the background update must not touch the session UI");
    },
  };
}

test("D-CF1-01: the command invocation handler registered after the skill aliases passes a bridged command through", async (t) => {
  // arrange
  await createHermeticScope(t, "command-invocation");
  const { pi, commandInvocation, ctx, verifyBoundary } = await loadExtension(0, 0);
  when(() => pi.getCommands())
    .thenReturn([])
    .times(1);

  // act
  const outcome = commandInvocation(
    { type: "input", text: "/demo:greet Ada", source: "interactive" },
    ctx,
  );

  // assert
  assert.deepStrictEqual(outcome, { action: "continue" });
  verifyBoundary();
});

test("AUP-01: the first plain message in a tui session arms one unref'd background update that quitting cancels", async (t) => {
  // arrange
  const { cwd } = await createHermeticScope(t, "background-arm");
  armBackgroundUpdateAtOnce(t);
  const { backgroundInput, backgroundShutdown, verifyBoundary } = await loadExtension(0, 0);
  const timers = countBackgroundTimers(t);

  // act
  backgroundInput(
    { type: "input", text: "hello", source: "interactive" },
    backgroundContext("tui", cwd),
  );
  await backgroundShutdown({ type: "session_shutdown", reason: "quit" });
  t.mock.timers.tick(0);

  // assert
  assert.deepStrictEqual(timers.delays, [0]);
  assert.strictEqual(timers.unrefCount(), 1);
  verifyBoundary();
});

for (const mode of ["print", "json"] as const) {
  test(`AUP-01: a plain message in ${mode} arms no background update`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScope(t, `background-${mode}`);
    armBackgroundUpdateAtOnce(t);
    const { backgroundInput, verifyBoundary } = await loadExtension(0, 0);
    const timers = countBackgroundTimers(t);

    // act
    backgroundInput(
      { type: "input", text: "hello", source: "interactive" },
      backgroundContext(mode, cwd),
    );
    t.mock.timers.tick(0);

    // assert
    assert.deepStrictEqual(timers.delays, []);
    verifyBoundary();
  });
}

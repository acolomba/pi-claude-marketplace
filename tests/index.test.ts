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
// This suite reads `createNotificationBoundary` from `tests/edge/`, so it is a
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
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { It, when } from "strong-mock";

import claudeMarketplaceExtension from "../extensions/pi-claude-marketplace/index.ts";

import { createNotificationBoundary } from "./edge/notification-boundary.ts";

import type { Notification } from "./edge/notification-boundary.ts";
import type {
  AgentEndEvent,
  AgentSettledEvent,
  BeforeAgentStartEvent,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  InputEvent,
  ResourcesDiscoverEvent,
  ResourcesDiscoverResult,
  SessionBeforeCompactEvent,
  SessionCompactEvent,
  SessionShutdownEvent,
  SessionStartEvent,
  ToolCallEvent,
  ToolResultEvent,
} from "../extensions/pi-claude-marketplace/platform/pi-api.ts";

/**
 * The listener shape every `on` overload accepts. Each overload declares
 * `(event, ctx) => Promise<R | void> | R | void`, so a listener that answers
 * with nothing satisfies all of them and the event type is the only thing that
 * has to be named per registration.
 */
type EventListener<TEvent> = (event: TEvent, ctx: ExtensionContext) => void;

/** The discover listener, which answers with the discovered resource set. */
type DiscoverListener = (
  event: ResourcesDiscoverEvent,
  ctx: ExtensionContext,
) => Promise<ResourcesDiscoverResult>;

/** The options bag `registerCommand` receives, derived from the Pi surface. */
type CommandRegistration = Parameters<ExtensionAPI["registerCommand"]>[1];

/** The definition `registerTool` receives, derived from the Pi surface. */
type ToolRegistration = Parameters<ExtensionAPI["registerTool"]>[0];

interface HermeticScope {
  readonly cwd: string;
  readonly home: string;
}

interface LoadedExtension {
  readonly discover: DiscoverListener;
  readonly sessionEnv: EventListener<SessionStartEvent>;
  readonly command: CommandRegistration;
  readonly tools: readonly (ToolRegistration | undefined)[];
  readonly ctx: ExtensionCommandContext;
  readonly notifications: readonly Notification[];
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
 */
const CWD_READ_DEFERRED_HYDRATE = 1;
const CWD_READ_PLUGIN_PATH_RECOMPUTE = 3;
const CWD_READS_PER_DISCOVER = 4;

/** The cascade the reconcile renders for a project scope whose state is unreadable. */
const RECONCILE_CASCADE_FOR_UNREADABLE_STATE =
  "Some operations have failed.\n\n" +
  "⊘ state.json [project] (failed) {unreadable}\n" +
  "  ⊘ state.json (failed) {unreadable}\n" +
  "    cause: state.json at state.json has an unsupported schema version\n\n" +
  "Reconcile: 2 failures";

/** The cascade the reconcile renders for a project scope whose config is invalid. */
const RECONCILE_CASCADE_FOR_INVALID_CONFIG =
  "Some operations have failed.\n\n" +
  "⊘ claude-plugins.json [project] (failed) {invalid manifest}\n" +
  "  ⊘ claude-plugins.json (failed) {invalid manifest}\n" +
  "    cause: schema validation failed: /schemaVersion: must be equal to constant\n\n" +
  "Reconcile: 2 failures";

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
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared: `getAgentDir()` reads it before `homedir()`,
 * so an ambient value would defeat a hermetic `HOME`. The factory hydrates the
 * user scope off disk while it runs, so a case without its own home would read
 * the operator's real one.
 *
 * The process moves into a root of its own, distinct from the working directory
 * the discover event names, so a handler that read the process working directory
 * instead of the event's would be observable rather than incidentally right. The
 * restore is registered before anything is mutated.
 */
async function createHermeticScope(t: TestContext, label: string): Promise<HermeticScope> {
  const cwd = await mkdtemp(path.join(tmpdir(), `index-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `index-${label}-home-`));
  const processRoot = await mkdtemp(path.join(tmpdir(), `index-${label}-process-`));
  const previousCwd = process.cwd();
  const tracked = [
    "HOME",
    "PI_CODING_AGENT_DIR",
    "PATH",
    "PI_CLAUDE_MARKETPLACE_PATH",
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

    await rm(cwd, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
    await rm(processRoot, { recursive: true, force: true });
  });
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  process.chdir(processRoot);
  installNetworkTrap(t);
  return { cwd, home };
}

/**
 * Run the factory against the strict Pi boundary and hand back everything it
 * registered. Every expectation states its event, command or tool name by hand
 * and captures only the callback, so `verifyBoundary()` fails a registration
 * under any other name, an extra registration, and a missing one alike.
 */
async function loadExtension(emissions: number, toolProbes: number): Promise<LoadedExtension> {
  const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(
    emissions,
    toolProbes,
  );
  when(() => {
    pi.on(
      "session_start",
      It.willCapture<EventListener<SessionStartEvent>>("bridge session start"),
    );
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
  when(() => {
    pi.on("tool_call", It.willCapture<EventListener<ToolCallEvent>>("tool call"));
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

  await claudeMarketplaceExtension(pi);

  const discover = discoverListener.value;
  const sessionEnv = sessionEnvListener.value;
  const command = commandRegistration.value;
  if (discover === undefined || sessionEnv === undefined || command === undefined) {
    throw new Error("the extension factory installed no discover, session or command callback");
  }

  return {
    discover,
    sessionEnv,
    command,
    tools: [firstTool.value, secondTool.value],
    ctx,
    notifications,
    verifyBoundary,
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

function discoverEvent(cwd: string): ResourcesDiscoverEvent {
  return { type: "resources_discover", cwd, reason: "startup" };
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
  await writeFile(
    path.join(extensionRoot, "state.json"),
    JSON.stringify({
      schemaVersion: 2,
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
              resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
              enabled: true,
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
 * Record a project-scope install state the loader refuses to read. The refusal
 * is an unsupported schema version rather than a syntax error, so the reason it
 * carries into both messages is the loader's own sentence rather than the
 * runtime's JSON parser text, which is not part of any contract.
 */
async function seedUnreadableState(cwd: string): Promise<string> {
  const extensionRoot = path.join(cwd, ".pi", "pi-claude-marketplace");
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

test("discovers prompts under the working directory the event names, not the one the process runs in", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "invocation-cwd");
  const eventPromptPath = await seedPrompt(scope.cwd, "event-cwd.md");
  await seedPrompt(process.cwd(), "process-cwd.md");
  const { discover, ctx, verifyBoundary } = await loadExtension(0, 0);
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

test("leaves both scope roots untouched and emits nothing when a pristine workspace reconciles (WR-05)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "pristine");
  const { discover, ctx, notifications, verifyBoundary } = await loadExtension(0, 0);

  // act
  const discovered = await discover(discoverEvent(scope.cwd), ctx);

  // assert
  assert.deepStrictEqual(discovered, EMPTY_DISCOVERY);
  assert.deepStrictEqual(existsSync(path.join(scope.cwd, ".pi")), false);
  assert.deepStrictEqual(existsSync(path.join(scope.home, ".pi")), false);
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
});

test("appends the recorded plugin's binaries to the process PATH and records them in the ledger (PENV-01)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "plugin-path");
  const resolvedSource = path.join(scope.cwd, "vendored-plugin");
  const binDir = path.join(resolvedSource, "bin");
  await seedEnabledPlugin(scope.cwd, resolvedSource);
  const { discover, ctx, verifyBoundary } = await loadExtension(0, 0);
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

test("reports the scope whose install state it cannot read once as a reconcile failure and once as a plugin PATH warning (PENV-01)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "path-warning");
  const statePath = await seedUnreadableState(scope.cwd);
  const { discover, ctx, notifications, verifyBoundary } = await loadExtension(2, 2);
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

// The two refusal cases below both seed one enabled plugin, so the plugin PATH
// recompute has something to do. That is what separates them: the answer and the
// emission count are identical either way, so a case that stated only those two
// would be the pristine-workspace case written twice under a different title.
// The recompute is downstream of the hydrate and is itself the stage the second
// case refuses, so the PATH it leaves behind is the one observable that differs.

test("still answers when the deferred project-scope hydrate fails (NFR-2)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "hydrate-refused");
  const resolvedSource = path.join(scope.cwd, "vendored-plugin");
  const binDir = path.join(resolvedSource, "bin");
  await seedEnabledPlugin(scope.cwd, resolvedSource);
  const { discover, ctx, notifications, verifyBoundary } = await loadExtension(0, 0);
  process.env.PATH = "/usr/bin";
  Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_PATH");
  const refusal = eventRefusingCwdRead(discoverEvent(scope.cwd), CWD_READ_DEFERRED_HYDRATE);
  const expectedReads = { refused: true, reads: CWD_READS_PER_DISCOVER };

  // act
  const discovered = await discover(refusal.event, ctx);

  // assert
  assert.deepStrictEqual(discovered, EMPTY_DISCOVERY);
  assert.deepStrictEqual(notifications, []);
  assert.deepStrictEqual({ refused: refusal.refused(), reads: refusal.readCount() }, expectedReads);
  // The refusal landed upstream of the recompute, so that stage still ran.
  assert.deepStrictEqual(process.env.PATH, `/usr/bin${path.delimiter}${binDir}`);
  assert.deepStrictEqual(process.env.PI_CLAUDE_MARKETPLACE_PATH, binDir);
  verifyBoundary();
});

test("still answers when the plugin PATH recompute fails (NFR-2)", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "recompute-refused");
  const resolvedSource = path.join(scope.cwd, "vendored-plugin");
  await seedEnabledPlugin(scope.cwd, resolvedSource);
  const { discover, ctx, notifications, verifyBoundary } = await loadExtension(0, 0);
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
  const { discover, ctx, verifyBoundary } = await loadExtension(0, 2);
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
  const { discover, ctx, verifyBoundary } = await loadExtension(0, 2);
  const attempted: Notification[] = [];
  const refusing = contextNotifyingThrough(ctx, refuseEveryNotification(attempted));
  const expectedAttempts: readonly Notification[] = [
    { message: RECONCILE_CASCADE_FOR_INVALID_CONFIG, severity: "error" },
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
  const { discover, ctx, verifyBoundary } = await loadExtension(0, 2);
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

test("applies the three Claude-Code session variables from the session id (SENV-01/02/03)", async (t) => {
  // arrange
  await createHermeticScope(t, "session-env");
  const { sessionEnv, ctx, verifyBoundary } = await loadExtension(0, 0);
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
  await createHermeticScope(t, "session-env-refused");
  const { sessionEnv, ctx, verifyBoundary } = await loadExtension(0, 0);
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
  await createHermeticScope(t, "session-env-absent");
  const { sessionEnv, ctx, verifyBoundary } = await loadExtension(0, 0);
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

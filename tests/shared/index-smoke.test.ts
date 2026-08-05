import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import claudeMarketplaceExtension from "../../extensions/pi-claude-marketplace/index.ts";
import { cleanupStaging } from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

import type { ExtensionAPI } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

/**
 * Regression guard: index.ts loads cleanly, exports a default
 * function, and registers exactly the expected Pi surface.
 */

interface RegistrationLog {
  type: "command" | "event" | "tool";
  name: string;
}

interface MockPi {
  readonly pi: ExtensionAPI;
  readonly commands: Map<string, unknown>;
  readonly events: Map<string, ((event: unknown) => unknown)[]>;
  readonly tools: Map<string, unknown>;
}

function makePiMock(log: RegistrationLog[]): MockPi {
  const commands = new Map<string, unknown>();
  const events = new Map<string, ((event: unknown) => unknown)[]>();
  const tools = new Map<string, unknown>();

  const pi = {
    registerCommand(name: string, options: unknown) {
      log.push({ type: "command", name });
      commands.set(name, options);
    },
    registerTool(tool: { name: string }) {
      log.push({ type: "tool", name: tool.name });
      tools.set(tool.name, tool);
    },
    on(event: string, handler: (event: unknown) => unknown) {
      log.push({ type: "event", name: event });
      const handlers = events.get(event) ?? [];
      handlers.push(handler);
      events.set(event, handlers);
    },

    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;

  return { pi, commands, events, tools };
}

test("default export is a function", () => {
  assert.equal(typeof claudeMarketplaceExtension, "function");
});

test("registers command, read-only tools, session_start, and resources_discover exactly once", async () => {
  const log: RegistrationLog[] = [];
  const { pi } = makePiMock(log);
  await claudeMarketplaceExtension(pi);

  const commands = log.filter((e) => e.type === "command");
  const events = log.filter((e) => e.type === "event");
  const tools = log.filter((e) => e.type === "tool");

  assert.equal(commands.length, 1, `expected exactly 1 command, got ${JSON.stringify(commands)}`);
  assert.equal(commands[0]!.name, "claude:plugin");
  // DISP-01 / STOP-01 / STOP-07: the hooks bridge adds 11 pi.on
  // registrations alongside the long-standing resources_discover
  // registration: 7 Bucket-A dispatch surfaces (session_start,
  // session_shutdown, session_before_compact, session_compact, input,
  // tool_call, tool_result), before_agent_start (the drain point for the
  // SessionStart additionalContext capture buffer), the two settle-time
  // surfaces agent_end (last-assistant cache) and agent_settled (stopReason
  // gate; STOP-01), and a SECOND input subscription (the STOP-07 loop-
  // protection reset). session_start is also registered by
  // registerClaudePluginCommand (read-only-tools surface) and by the
  // SENV-01/02/03 session-env injection wired directly in index.ts, so its
  // multiplicity rises to 3; input's multiplicity likewise rises to 2 via
  // the STOP-07 reset.
  assert.deepEqual(events.map((e) => e.name).sort(), [
    "agent_end",
    "agent_settled",
    "before_agent_start",
    "input",
    "input",
    "resources_discover",
    "session_before_compact",
    "session_compact",
    "session_shutdown",
    "session_start",
    "session_start",
    "session_start",
    "tool_call",
    "tool_result",
  ]);
  assert.equal(
    tools.length,
    2,
    `Pi entry point must register 2 read-only LLM tools; got ${JSON.stringify(tools)}`,
  );
  assert.deepEqual(tools.map((e) => e.name).sort(), [
    "pi_claude_marketplace_list",
    "pi_claude_marketplace_plugin_list",
  ]);
});

test("resources_discover handler resolves project cwd at invocation time", async () => {
  const log: RegistrationLog[] = [];
  const { pi, events } = makePiMock(log);
  await claudeMarketplaceExtension(pi);

  const handlers = events.get("resources_discover") ?? [];
  assert.equal(handlers.length, 1, "exactly one resources_discover handler");

  const eventCwd = await mkdtemp(path.join(os.tmpdir(), "index-smoke-event-cwd-"));
  const processCwd = await mkdtemp(path.join(os.tmpdir(), "index-smoke-process-cwd-"));
  try {
    const projectPromptDir = path.join(
      eventCwd,
      ".pi",
      "pi-claude-marketplace",
      "resources",
      "prompts",
    );
    const projectPrompt = path.join(projectPromptDir, "cwd-captured.md");
    await mkdir(projectPromptDir, { recursive: true });
    await writeFile(projectPrompt, "# cwd captured\n");

    const wrongPromptDir = path.join(
      processCwd,
      ".pi",
      "pi-claude-marketplace",
      "resources",
      "prompts",
    );
    const wrongPrompt = path.join(wrongPromptDir, "process-cwd.md");
    await mkdir(wrongPromptDir, { recursive: true });
    await writeFile(wrongPrompt, "# process cwd\n");

    const result = await handlers[0]!({
      cwd: eventCwd,
      reason: "reload",
      type: "resources_discover",
    });
    assert.ok(
      typeof result === "object" &&
        result !== null &&
        "promptPaths" in result &&
        Array.isArray(result.promptPaths),
    );
    const promptPaths = result.promptPaths as string[];
    assert.ok(
      promptPaths.some((promptPath) =>
        promptPath.endsWith(
          path.join(".pi", "pi-claude-marketplace", "resources", "prompts", "cwd-captured.md"),
        ),
      ),
      `expected invocation-time cwd prompt in ${JSON.stringify(result.promptPaths)}`,
    );
    assert.equal(
      promptPaths.some((promptPath) => promptPath.endsWith("process-cwd.md")),
      false,
      `expected process cwd not to be used in ${JSON.stringify(result.promptPaths)}`,
    );
  } finally {
    await cleanupStaging(eventCwd, "test-cleanup");
    await cleanupStaging(processCwd, "test-cleanup");
  }
});

// Restore the env keys the PENV-01/SENV tests manipulate with literal-key
// deletes (mirrors tests/shared/plugin-path.test.ts; no dynamic delete).
interface PathEnvSnapshot {
  home: string | undefined;
  agentDir: string | undefined;
  path: string | undefined;
  ledger: string | undefined;
}

function snapshotPathEnv(): PathEnvSnapshot {
  return {
    home: process.env.HOME,
    agentDir: process.env.PI_CODING_AGENT_DIR,
    path: process.env.PATH,
    ledger: process.env.PI_CLAUDE_MARKETPLACE_PATH,
  };
}

function restorePathEnv(snapshot: PathEnvSnapshot): void {
  if (snapshot.home === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = snapshot.home;
  }

  if (snapshot.agentDir === undefined) {
    delete process.env.PI_CODING_AGENT_DIR;
  } else {
    process.env.PI_CODING_AGENT_DIR = snapshot.agentDir;
  }

  if (snapshot.path === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = snapshot.path;
  }

  if (snapshot.ledger === undefined) {
    delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
  } else {
    process.env.PI_CLAUDE_MARKETPLACE_PATH = snapshot.ledger;
  }
}

/** Minimal schema-valid project-scope state.json with one enabled plugin. */
function makeProjectState(resolvedSource: string, sourceRoot: string): object {
  return {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: { kind: "path", raw: sourceRoot },
        addedFromCwd: "/tmp",
        manifestPath: path.join(sourceRoot, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: sourceRoot,
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
  };
}

interface NotifyRecord {
  message: string;
  severity: string | undefined;
}

function makeNotifyCtx(): { ctx: unknown; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (message: string, severity?: string): void => {
        notifications.push({ message, severity });
      },
    },
  };
  return { ctx, notifications };
}

test("PENV-01 resources_discover applies the plugin PATH from a valid state.json", async () => {
  const snapshot = snapshotPathEnv();
  const log: RegistrationLog[] = [];
  const { pi, events } = makePiMock(log);
  await claudeMarketplaceExtension(pi);
  const handler = (events.get("resources_discover") ?? [])[0]! as (
    event: unknown,
    ctx: unknown,
  ) => Promise<unknown>;

  const eventCwd = await mkdtemp(path.join(os.tmpdir(), "index-smoke-penv-cwd-"));
  const userDir = await mkdtemp(path.join(os.tmpdir(), "index-smoke-penv-user-"));
  try {
    // Point the user scope at a pristine tmp dir so only the seeded project
    // scope contributes bin dirs.
    process.env.PI_CODING_AGENT_DIR = userDir;
    process.env.HOME = userDir;
    process.env.PATH = "/usr/bin";
    delete process.env.PI_CLAUDE_MARKETPLACE_PATH;

    const resolvedSource = path.join(eventCwd, "vendored-plugin");
    const extRoot = path.join(eventCwd, ".pi", "pi-claude-marketplace");
    await mkdir(extRoot, { recursive: true });
    await writeFile(
      path.join(extRoot, "state.json"),
      JSON.stringify(makeProjectState(resolvedSource, path.join(eventCwd, "mp-src"))),
    );

    const { ctx } = makeNotifyCtx();
    await handler({ cwd: eventCwd, reason: "reload", type: "resources_discover" }, ctx);

    const binDir = path.join(resolvedSource, "bin");
    const entries = (process.env.PATH ?? "").split(path.delimiter);
    assert.ok(entries.includes(binDir), `expected ${binDir} on PATH, got ${process.env.PATH}`);
    assert.equal(process.env.PI_CLAUDE_MARKETPLACE_PATH, binDir);
  } finally {
    restorePathEnv(snapshot);
    await cleanupStaging(eventCwd, "test-cleanup");
    await cleanupStaging(userDir, "test-cleanup");
  }
});

test("PENV-01 resources_discover still resolves on a malformed state.json and warns for that scope", async () => {
  const snapshot = snapshotPathEnv();
  const log: RegistrationLog[] = [];
  const { pi, events } = makePiMock(log);
  await claudeMarketplaceExtension(pi);
  const handler = (events.get("resources_discover") ?? [])[0]! as (
    event: unknown,
    ctx: unknown,
  ) => Promise<unknown>;

  const eventCwd = await mkdtemp(path.join(os.tmpdir(), "index-smoke-penvbad-cwd-"));
  const userDir = await mkdtemp(path.join(os.tmpdir(), "index-smoke-penvbad-user-"));
  try {
    process.env.PI_CODING_AGENT_DIR = userDir;
    process.env.HOME = userDir;
    process.env.PATH = "/usr/bin";
    delete process.env.PI_CLAUDE_MARKETPLACE_PATH;

    const extRoot = path.join(eventCwd, ".pi", "pi-claude-marketplace");
    await mkdir(extRoot, { recursive: true });
    await writeFile(path.join(extRoot, "state.json"), "{ not valid json");

    const { ctx, notifications } = makeNotifyCtx();
    const result = await handler(
      { cwd: eventCwd, reason: "reload", type: "resources_discover" },
      ctx,
    );

    // NFR-2: the handler still resolves with the discovery shape.
    assert.ok(
      typeof result === "object" &&
        result !== null &&
        "skillPaths" in result &&
        "promptPaths" in result,
      `expected a discovery result, got ${JSON.stringify(result)}`,
    );
    // The skipped project scope surfaces exactly one warning notify.
    const pathWarnings = notifications.filter(
      (n) =>
        n.severity === "warning" &&
        n.message.includes(
          "plugin PATH not refreshed for project scope (install state unreadable)",
        ),
    );
    assert.equal(
      pathWarnings.length,
      1,
      `expected one project-scope PATH warning, got ${JSON.stringify(notifications)}`,
    );
  } finally {
    restorePathEnv(snapshot);
    await cleanupStaging(eventCwd, "test-cleanup");
    await cleanupStaging(userDir, "test-cleanup");
  }
});

test("SENV-01/02/03 session_start applies the session env from ctx.sessionManager.getSessionId()", async () => {
  const prior = {
    claudecode: process.env.CLAUDECODE,
    codeSessionId: process.env.CLAUDE_CODE_SESSION_ID,
    sessionId: process.env.CLAUDE_SESSION_ID,
  };
  const log: RegistrationLog[] = [];
  const { pi, events } = makePiMock(log);
  await claudeMarketplaceExtension(pi);

  try {
    // Same fixed registration order as the WR-02 test below: the middle
    // session_start handler is the SENV injection that dereferences
    // ctx.sessionManager.getSessionId().
    const sessionStart = events.get("session_start") ?? [];
    assert.equal(sessionStart.length, 3, "expected three session_start handlers");
    const senvHandler = sessionStart[1]! as (event: unknown, ctx: unknown) => unknown;

    senvHandler({}, { sessionManager: { getSessionId: () => "sess-known-id" } });

    assert.equal(process.env.CLAUDE_CODE_SESSION_ID, "sess-known-id");
    assert.equal(process.env.CLAUDE_SESSION_ID, "sess-known-id");
    assert.equal(process.env.CLAUDECODE, "1");
  } finally {
    if (prior.claudecode === undefined) {
      delete process.env.CLAUDECODE;
    } else {
      process.env.CLAUDECODE = prior.claudecode;
    }

    if (prior.codeSessionId === undefined) {
      delete process.env.CLAUDE_CODE_SESSION_ID;
    } else {
      process.env.CLAUDE_CODE_SESSION_ID = prior.codeSessionId;
    }

    if (prior.sessionId === undefined) {
      delete process.env.CLAUDE_SESSION_ID;
    } else {
      process.env.CLAUDE_SESSION_ID = prior.sessionId;
    }
  }
});

test("WR-02 session_start swallows a throwing or undefined sessionManager", async () => {
  const log: RegistrationLog[] = [];
  const { pi, events } = makePiMock(log);
  await claudeMarketplaceExtension(pi);

  // Three session_start handlers register in a fixed order: the hooks-bridge
  // Bucket-A dispatch, the SENV-01/02/03 session-env injection, then the TC-7
  // autocomplete wrapper. The middle one is the SENV handler under test -- the
  // only session_start handler that dereferences ctx.sessionManager.getSessionId().
  const sessionStart = events.get("session_start") ?? [];
  assert.equal(sessionStart.length, 3, "expected three session_start handlers");
  const senvHandler = sessionStart[1]! as (event: unknown, ctx: unknown) => unknown;

  // NFR-2: a throwing getSessionId must never propagate past session_start.
  assert.doesNotThrow(() =>
    senvHandler(
      {},
      {
        sessionManager: {
          getSessionId: () => {
            throw new Error("boom");
          },
        },
      },
    ),
  );
  // An undefined sessionManager (getSessionId deref throws) is likewise swallowed.
  assert.doesNotThrow(() => senvHandler({}, {}));
});

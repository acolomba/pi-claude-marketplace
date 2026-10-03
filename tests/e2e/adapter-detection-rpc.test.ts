// Drives the real extension on the repository's own Pi CLI over RPC, once per
// Pi MCP state. Each case first proves its state through `get_commands` and an
// inventory-probe command, then adds a path-source marketplace, installs a
// plugin that declares one MCP server, lists it and prints its info.
// Pi's built-in MCP client does not run Claude plugin MCP servers, so only a
// loaded pi-mcp-adapter clears `{requires pi-mcp-adapter}` (ADET-01). The
// adapter counts when it registers its `mcp-adapter` command, and a foreign
// tool named `mcp` does not count (ADET-02). No real pi-mcp-adapter is
// installed: small fixture extensions stand in for each state.
import assert from "node:assert/strict";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { builtinMcpCommand, builtinMcpTool } from "../platform/pi-inventory-seed.ts";

import { listedCommands, promptDisposition, runRpcSession } from "./_rpc.ts";

import type { ListedCommand, RpcSessionResult } from "./_rpc.ts";
import type { HermeticEnvironment } from "../platform/hermetic-environment.ts";

interface PreparedPiMcpState {
  readonly extraExtensions: readonly string[];
  /** The `get_commands` entries named `mcp` or `mcp-adapter[:<digits>]`, sorted by name. */
  readonly mcpCommands: readonly ListedCommand[];
  /** The `sourceInfo.path` of every live tool named `mcp`. */
  readonly mcpToolPaths: readonly string[];
}

interface PiMcpState {
  readonly title: string;
  readonly prepare: (env: HermeticEnvironment) => Promise<PreparedPiMcpState>;
  /** The `mcp-fixture` row on both the install and the list notify. */
  readonly expectedRow: string;
  /** The install notify's `notifyType`; Pi omits it for info. */
  readonly expectedInstallNotifyType: string | undefined;
  /** The info block's `requires:` line. */
  readonly expectedRequiresLine: string;
}

const MCP_FIXTURE_ROW_PREFIX = "  ● mcp-fixture ";
const MCP_COMMAND_NAME = /^mcp(-adapter(:\d+)?)?$/;
const PLUGIN_STEP_IDS = ["add", "install", "list", "info"];

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** Writes the `fx-mkt` marketplace with one plugin declaring one stdio MCP server. */
async function writeMcpFixtureMarketplace(root: string): Promise<string> {
  const marketplace = path.join(root, "mkt");
  const plugin = path.join(marketplace, "plugins", "mcp-fixture");
  await writeJson(path.join(marketplace, ".claude-plugin", "marketplace.json"), {
    name: "fx-mkt",
    description: "Fixture marketplace for the real-Pi MCP states.",
    owner: { name: "fx", email: "noreply@example.com" },
    plugins: [
      {
        name: "mcp-fixture",
        description: "Fixture plugin with one stdio MCP server.",
        source: "./plugins/mcp-fixture",
      },
    ],
  });
  await writeJson(path.join(plugin, ".claude-plugin", "plugin.json"), {
    name: "mcp-fixture",
    version: "1.0.0",
  });
  await writeJson(path.join(plugin, ".mcp.json"), {
    mcpServers: { fixture: { command: process.execPath, args: ["--version"] } },
  });
  return marketplace;
}

// A stdio MCP server speaking newline-delimited JSON-RPC. It writes its PID to
// the file named by its first argument, so a case can check it is gone.
const STUB_MCP_SERVER_SOURCE = `import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

writeFileSync(process.argv[2], String(process.pid));
const send = (message) => process.stdout.write(JSON.stringify(message) + "\\n");
const results = {
  initialize: (params) => ({
    protocolVersion: params?.protocolVersion ?? "2025-06-18",
    capabilities: { tools: {} },
    serverInfo: { name: "stub", version: "1.0.0" },
  }),
  "tools/list": () => ({
    tools: [{ name: "echo", description: "Echo text.", inputSchema: { type: "object", properties: { text: { type: "string" } } } }],
  }),
  "tools/call": (params) => ({ content: [{ type: "text", text: String(params?.arguments?.text ?? "") }] }),
};
createInterface({ input: process.stdin }).on("line", (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }
  if (request.id === undefined) {
    return;
  }
  const result = results[request.method];
  send(
    result === undefined
      ? { jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "method not found" } }
      : { jsonrpc: "2.0", id: request.id, result: result(request.params) },
  );
});
`;

// Plain JavaScript syntax, so Pi loads each fixture under any TypeScript-stripping mode.
// `/inventory-probe <prefix>` waits up to 8 s for a tool whose name starts
// with `<prefix>`, because the built-in registers MCP tools after
// `session_start` without blocking prompts. It then notifies the tools and
// commands the extension API reports.
const INVENTORY_PROBE_SOURCE = `export default function (pi) {
  pi.registerCommand("inventory-probe", {
    description: "Fixture inventory probe.",
    handler: async (args, ctx) => {
      const prefix = args.trim();
      const deadline = Date.now() + 8000;
      while (prefix !== "" && Date.now() < deadline && !pi.getAllTools().some((tool) => tool.name.startsWith(prefix))) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const tools = pi.getAllTools().map(({ name, exposure, namespace, sourceInfo }) => ({ name, exposure, namespace, sourceInfo }));
      const commands = pi.getCommands().map(({ name, source, sourceInfo }) => ({ name, source, sourceInfo }));
      ctx.ui.notify(JSON.stringify({ tools, commands }));
    },
  });
}
`;

// The command pi-mcp-adapter registers; with `disableProxyTool` it is all the
// adapter exposes, and a fork registers the same name.
const ADAPTER_COMMAND_SOURCE = `export default function (pi) {
  pi.registerCommand("mcp-adapter", { description: "Fixture mcp-adapter command.", handler: async () => {} });
}
`;

const FOREIGN_MCP_TOOL_SOURCE = `export default function (pi) {
  pi.registerTool({
    name: "mcp",
    label: "mcp",
    description: "Fixture foreign mcp tool.",
    parameters: { type: "object", properties: {} },
    execute: async () => ({ content: [{ type: "text", text: "fixture" }], details: {} }),
  });
}
`;

// Starts a long-lived child in Pi's own process group, with no stdio tie to
// Pi, and writes its PID to `pidFile`. Pi does not stop it, so only the
// session's group kill on Pi's exit does.
function groupSentinelSource(pidFile: string): string {
  return `import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

export default function () {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1 << 30)"], { stdio: "ignore" });
  child.unref();
  writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
}
`;
}

async function writeExtension(
  env: HermeticEnvironment,
  name: string,
  source: string,
): Promise<string> {
  const file = path.join(env.root, name);
  await writeFile(file, source);
  return file;
}

/**
 * Runs `get_commands`, `/inventory-probe <probePrefix>`, then adds the
 * marketplace and installs, lists and prints info for `mcp-fixture`.
 */
async function runPluginSession(
  env: HermeticEnvironment,
  extraExtensions: readonly string[],
  probePrefix: string,
  signal: AbortSignal,
): Promise<RpcSessionResult> {
  const marketplace = await writeMcpFixtureMarketplace(env.root);
  const probe = await writeExtension(env, "inventory-probe.mjs", INVENTORY_PROBE_SOURCE);
  return runRpcSession({
    sandbox: env,
    extraExtensions: [probe, ...extraExtensions],
    signal,
    steps: [
      { id: "commands", type: "get_commands" },
      { id: "inventory", type: "prompt", message: `/inventory-probe ${probePrefix}` },
      {
        id: "add",
        type: "prompt",
        message: `/claude:plugin marketplace add ${marketplace} --scope user`,
      },
      {
        id: "install",
        type: "prompt",
        message: "/claude:plugin install mcp-fixture@fx-mkt --scope user",
      },
      { id: "list", type: "prompt", message: "/claude:plugin list --scope user" },
      {
        id: "info",
        type: "prompt",
        message: "/claude:plugin info mcp-fixture@fx-mkt --scope user",
      },
    ],
  });
}

function assertCleanSession(run: RpcSessionResult): void {
  assert.deepStrictEqual(
    { exitCode: run.exitCode, timedOut: run.timedOut },
    { exitCode: 0, timedOut: false },
    run.stderr,
  );
  assert.deepStrictEqual(run.extensionErrors, []);
  assert.deepStrictEqual(run.dialogs, []);
  // The inventory assertions read these two steps, and a failed step reads as
  // an empty list, so each one must have run.
  assert.strictEqual(run.responses.get("commands")?.success, true, "get_commands failed");
  assert.strictEqual(promptDisposition(run.responses.get("inventory")), "handled");
  assert.deepStrictEqual(
    PLUGIN_STEP_IDS.map((stepId) => promptDisposition(run.responses.get(stepId))),
    ["handled", "handled", "handled", "handled"],
  );
}

/** The `get_commands` entries named `mcp` or `mcp-adapter[:<digits>]`, sorted by name. */
function mcpCommands(run: RpcSessionResult): readonly ListedCommand[] {
  return listedCommands(run.responses.get("commands"))
    .filter((command) => MCP_COMMAND_NAME.test(command.name))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function notifyLines(run: RpcSessionResult, stepId: string): readonly string[] {
  return run.notifies
    .filter((notify) => notify.after === stepId)
    .flatMap((notify) => notify.message.split("\n"));
}

/** Returns the `mcp-fixture` row from the notifies of one step, or "" when none has it. */
function rowFor(run: RpcSessionResult, stepId: string): string {
  return notifyLines(run, stepId).find((line) => line.startsWith(MCP_FIXTURE_ROW_PREFIX)) ?? "";
}

function requiresLines(run: RpcSessionResult): readonly string[] {
  return notifyLines(run, "info").filter((line) => line.startsWith("    requires:"));
}

/**
 * Returns the `notifyType` of the install-step notify that carries the
 * `mcp-fixture` row, or `null` when no such notify exists, so a missing
 * notify never matches the info expectation (`undefined`).
 */
function installNotifyType(run: RpcSessionResult): string | undefined | null {
  const notify = run.notifies.find(
    (candidate) =>
      candidate.after === "install" &&
      candidate.message.split("\n").some((line) => line.startsWith(MCP_FIXTURE_ROW_PREFIX)),
  );
  return notify === undefined ? null : notify.notifyType;
}

/** The `tools` or `commands` list the inventory probe notified. */
function inventoryEntries(run: RpcSessionResult, key: "tools" | "commands"): readonly unknown[] {
  const notify = run.notifies.find((candidate) => candidate.after === "inventory");
  if (notify === undefined) {
    assert.fail("the inventory probe did not notify");
  }

  const inventory: unknown = JSON.parse(notify.message);
  const entries: unknown =
    typeof inventory === "object" && inventory !== null ? Reflect.get(inventory, key) : undefined;
  return Array.isArray(entries) ? entries : [];
}

function namedEntries(entries: readonly unknown[], name: string): readonly unknown[] {
  return entries.filter(
    (entry) => typeof entry === "object" && entry !== null && Reflect.get(entry, "name") === name,
  );
}

async function readPid(pidFile: string): Promise<number> {
  return Number(await readFile(pidFile, "utf8"));
}

/**
 * Whether `pid` is gone within 2 s. The process killed at Pi's exit is
 * reaped by its new parent shortly after, and until then it still answers
 * signal 0.
 */
async function processGone(pid: number): Promise<boolean> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      process.kill(pid, 0);
    } catch (error: unknown) {
      if (error instanceof Error && Reflect.get(error, "code") === "ESRCH") {
        return true;
      }

      throw error;
    }

    await delay(100);
  }

  return false;
}

function sourcePaths(entries: readonly unknown[]): readonly unknown[] {
  return entries.map((entry) => {
    const sourceInfo: unknown =
      typeof entry === "object" && entry !== null ? Reflect.get(entry, "sourceInfo") : undefined;
    const sourcePath: unknown =
      typeof sourceInfo === "object" && sourceInfo !== null
        ? Reflect.get(sourceInfo, "path")
        : undefined;
    return sourcePath;
  });
}

test(
  "ADET-01: with only Pi's built-in MCP active, install, list and info require pi-mcp-adapter and the install warns",
  { timeout: 120_000 },
  async (t) => {
    // arrange
    const env = await createHermeticEnvironment(t, "pi-cm-adapter-rpc-");
    const stubServer = await writeExtension(env, "stub-mcp.mjs", STUB_MCP_SERVER_SOURCE);
    const stubPidFile = path.join(env.root, "stub-mcp.pid");
    await writeJson(path.join(env.agentDir, "mcp.json"), {
      mcpServers: { stub: { command: process.execPath, args: [stubServer, stubPidFile] } },
    });
    const sentinelPidFile = path.join(env.root, "group-sentinel.pid");
    const sentinel = await writeExtension(
      env,
      "group-sentinel.mjs",
      groupSentinelSource(sentinelPidFile),
    );
    const seedTool = builtinMcpTool();
    const expectedTool = {
      name: seedTool.name,
      exposure: seedTool.exposure,
      namespace: seedTool.namespace,
      sourceInfo: seedTool.sourceInfo,
    };
    const seedCommand = builtinMcpCommand();
    const expectedCommand = {
      name: seedCommand.name,
      source: seedCommand.source,
      sourceInfo: seedCommand.sourceInfo,
    };

    // act
    const run = await runPluginSession(env, [sentinel], "mcp__", t.signal);
    // Register the sentinel's cleanup before any read that can throw, so a
    // failed case never leaves the long-lived sentinel running.
    const sentinelPid = await readPid(sentinelPidFile);
    t.after(() => {
      try {
        process.kill(sentinelPid, "SIGKILL");
      } catch {
        // The sentinel is already gone, which is what the case expects.
      }
    });

    // assert
    assertCleanSession(run);
    assert.deepStrictEqual(mcpCommands(run), [{ name: "mcp", sourcePath: "builtin:mcp" }]);
    assert.deepStrictEqual(namedEntries(inventoryEntries(run, "tools"), "mcp__stub__echo"), [
      expectedTool,
    ]);
    assert.deepStrictEqual(namedEntries(inventoryEntries(run, "commands"), "mcp"), [
      expectedCommand,
    ]);
    assert.strictEqual(
      rowFor(run, "install"),
      "  ● mcp-fixture v1.0.0 (installed) {requires pi-mcp-adapter}",
    );
    assert.strictEqual(installNotifyType(run), "warning");
    assert.strictEqual(
      rowFor(run, "list"),
      "  ● mcp-fixture v1.0.0 (installed) {requires pi-mcp-adapter}",
    );
    assert.deepStrictEqual(requiresLines(run), ["    requires: pi-mcp-adapter (missing)"]);
    // Pi stops the stub MCP server, which runs in a process group of its own;
    // the session's group kill on Pi's exit stops the sentinel.
    const stubPid = await readPid(stubPidFile).catch((error: unknown) => {
      assert.fail(`the built-in MCP never started the stub server: ${String(error)}`);
    });
    assert.deepStrictEqual(
      { stubGone: await processGone(stubPid), sentinelGone: await processGone(sentinelPid) },
      { stubGone: true, sentinelGone: true },
    );
  },
);

const PI_MCP_STATES: readonly PiMcpState[] = [
  {
    title:
      "ADET-01: with the built-in MCP disabled and no adapter, install, list and info require pi-mcp-adapter and the install warns",
    prepare: async (env) => {
      await writeJson(path.join(env.agentDir, "settings.json"), {
        extensions: ["-builtin:mcp"],
      });
      return { extraExtensions: [], mcpCommands: [], mcpToolPaths: [] };
    },
    expectedRow: "  ● mcp-fixture v1.0.0 (installed) {requires pi-mcp-adapter}",
    expectedInstallNotifyType: "warning",
    expectedRequiresLine: "    requires: pi-mcp-adapter (missing)",
  },
  {
    title:
      "ADET-02: an extension's mcp-adapter command clears the marker, keeps the install at info and info names pi-mcp-adapter",
    prepare: async (env) => {
      const adapter = await writeExtension(env, "adapter.mjs", ADAPTER_COMMAND_SOURCE);
      return {
        extraExtensions: [adapter],
        mcpCommands: [
          { name: "mcp", sourcePath: "builtin:mcp" },
          { name: "mcp-adapter", sourcePath: adapter },
        ],
        mcpToolPaths: [],
      };
    },
    expectedRow: "  ● mcp-fixture v1.0.0 (installed)",
    expectedInstallNotifyType: undefined,
    expectedRequiresLine: "    requires: pi-mcp-adapter",
  },
  {
    title:
      "ADET-02: two mcp-adapter registrations, listed as mcp-adapter:1 and mcp-adapter:2, clear the marker",
    prepare: async (env) => {
      const first = await writeExtension(env, "adapter-1.mjs", ADAPTER_COMMAND_SOURCE);
      const second = await writeExtension(env, "adapter-2.mjs", ADAPTER_COMMAND_SOURCE);
      return {
        extraExtensions: [first, second],
        mcpCommands: [
          { name: "mcp", sourcePath: "builtin:mcp" },
          { name: "mcp-adapter:1", sourcePath: first },
          { name: "mcp-adapter:2", sourcePath: second },
        ],
        mcpToolPaths: [],
      };
    },
    expectedRow: "  ● mcp-fixture v1.0.0 (installed)",
    expectedInstallNotifyType: undefined,
    expectedRequiresLine: "    requires: pi-mcp-adapter",
  },
  {
    title:
      "ADET-02: a foreign extension's tool named mcp keeps {requires pi-mcp-adapter} and the install warns",
    prepare: async (env) => {
      const foreign = await writeExtension(env, "foreign-mcp-tool.mjs", FOREIGN_MCP_TOOL_SOURCE);
      return {
        extraExtensions: [foreign],
        mcpCommands: [{ name: "mcp", sourcePath: "builtin:mcp" }],
        mcpToolPaths: [foreign],
      };
    },
    expectedRow: "  ● mcp-fixture v1.0.0 (installed) {requires pi-mcp-adapter}",
    expectedInstallNotifyType: "warning",
    expectedRequiresLine: "    requires: pi-mcp-adapter (missing)",
  },
];

for (const state of PI_MCP_STATES) {
  test(state.title, { timeout: 120_000 }, async (t) => {
    // arrange
    const env = await createHermeticEnvironment(t, "pi-cm-adapter-rpc-");
    const prepared = await state.prepare(env);

    // act
    const run = await runPluginSession(env, prepared.extraExtensions, "", t.signal);

    // assert
    assertCleanSession(run);
    assert.deepStrictEqual(mcpCommands(run), prepared.mcpCommands);
    assert.deepStrictEqual(
      sourcePaths(namedEntries(inventoryEntries(run, "tools"), "mcp")),
      prepared.mcpToolPaths,
    );
    assert.strictEqual(rowFor(run, "install"), state.expectedRow);
    assert.strictEqual(installNotifyType(run), state.expectedInstallNotifyType);
    assert.strictEqual(rowFor(run, "list"), state.expectedRow);
    assert.deepStrictEqual(requiresLines(run), [state.expectedRequiresLine]);
  });
}

test("runRpcSession refuses a sandbox cwd that does not exist", async (t) => {
  // arrange
  const env = await createHermeticEnvironment(t, "pi-cm-adapter-rpc-");
  const cwd = path.join(env.root, "missing");

  // act & assert
  await assert.rejects(
    runRpcSession({ sandbox: { home: env.home, agentDir: env.agentDir, cwd }, steps: [] }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === `runRpcSession: sandbox location ${cwd} does not exist`,
  );
});

test("runRpcSession refuses a sandbox cwd inside the repository", async (t) => {
  // arrange
  const env = await createHermeticEnvironment(t, "pi-cm-adapter-rpc-");
  const cwd = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = await realpath(path.join(cwd, "..", ".."));

  // act & assert
  await assert.rejects(
    runRpcSession({ sandbox: { home: env.home, agentDir: env.agentDir, cwd }, steps: [] }),
    (error: unknown) =>
      error instanceof Error &&
      error.message ===
        `runRpcSession: sandbox location ${cwd} is inside the repository ${repoRoot}, ` +
          "where Pi asks for project trust; point TMPDIR outside the repository",
  );
});

// tests/live-uat/mcp-adapter-canary.mjs
//
// Standalone operator-run UAT driver: an engineer invokes it from the command
// line and no module ever imports it, so being unreachable from the import
// graph is its intended shape, not a defect.
// fallow-ignore-file unused-file -- standalone operator-run UAT driver: an engineer invokes it from the command line and no module ever imports it, so being unreachable from the import graph is its intended shape, not a defect.
//
// This driver imports `../pi-runtime.ts` and nothing else from the repository,
// so every Pi launch resolves the lock-pinned CLI through that one module. It
// imports nothing from a `tests/live-uat/` sibling and runs on its own as
// `node tests/live-uat/mcp-adapter-canary.mjs`.
//
// ADOC-02: the unit tests prove that this extension writes `mcp-adapter.json`.
// Only a live pi-mcp-adapter proves that the adapter reads it. This canary
// drives a real Pi over RPC with this extension, pi-mcp-adapter 5.2.0 and a
// small helper extension the canary writes into its sandbox. It proves:
//   - a legacy `mcp.json` entry written by the published 0.19.2 migrates to
//     `mcp-adapter.json` with the notice row the user sees (AMIG-01, AMIG-03);
//   - the migrated entry has the owned fields `toolPrefix: "mcp"` and
//     `directTools: "search"` (ANAME-01, ANAME-04);
//   - before any reload the adapter still lists the old name and info shows
//     `not loaded`; the canary counts the reloads until the adapter lists the
//     new key and no longer the old name, and fails unless the count is 1
//     (AMIG-03, ASTAT-01, ASTAT-02);
//   - a plugin installed fresh in the same session is written as
//     `plugin_ping_ping_` and is live in the adapter after that reload
//     (AFILE-01);
//   - route A, in a fresh Pi process: info shows `status unknown` before the
//     first MCP use, `mcp({ search })` returns
//     `mcp__plugin_echo_echo__echo_canary`, which the first model request did
//     not declare and a later one did, the call returns `echo-canary:hi`, and
//     info then shows `connected` (ANAME-01, ANAME-04, ASTAT-01, ASTAT-02).
//
// The model side is `openai-stub-server.mjs`, started as a child process with
// `STUB_PORT=0` and a `STUB_SCRIPT` that replays the route's tool calls. No
// real model and no key are used.
//
// Every run seeds the agent directory from the committed fixture
// `tests/live-uat/fixtures/mcp-adapter-canary/legacy-v0.19.2.json`, so it is
// deterministic and offline. The fixture holds the files 0.19.2 wrote on the
// repository's Pi, with the sandbox root replaced by `@@SANDBOX@@`.
//
// Run (pi-mcp-adapter 5.2.0 in a scratch prefix outside the checkout):
//
//   npm install --prefix /var/tmp/mcp-adapter-520 pi-mcp-adapter@5.2.0 \
//     --ignore-scripts --omit=peer --no-audit --no-fund
//   PI_MCP_ADAPTER_ROOT=/var/tmp/mcp-adapter-520/node_modules/pi-mcp-adapter \
//   TMPDIR=/var/tmp/mcp-adapter-canary \
//     node tests/live-uat/mcp-adapter-canary.mjs [--invert]
//
// `--invert` is the negative control: it flips the expected route A result
// text and nothing else, so that run must exit 2 at A3.
//
// `--capture-legacy <prefix>` regenerates the fixture instead. It drives the
// pi-claude-marketplace 0.19.2 installed under `<prefix>` alone, adds the
// canary marketplace, installs the `echo` plugin, and writes the three files
// it produced:
//
//   npm install --prefix <prefix> pi-claude-marketplace@0.19.2 \
//     --legacy-peer-deps --ignore-scripts --no-audit --no-fund
//   TMPDIR=/var/tmp/mcp-adapter-canary \
//     node tests/live-uat/mcp-adapter-canary.mjs --capture-legacy <prefix>
//
// Honesty contract: this canary never reports a PASS it did not observe.
// Exit codes:
//   - 0: every assertion was proven.
//   - 1: `LIVE RUNTIME REQUIRED`: an unmet precondition or an inconclusive
//     drive. The verifier routes `human_needed`.
//   - 2: `ADOC-02 REGRESSION`: an observation contradicts an assertion.
//
// Containment: each Pi child gets an environment built from scratch, with HOME
// and PI_CODING_AGENT_DIR inside a fresh `mkdtemp` sandbox under the realpath
// of the OS temp directory. The canary refuses a temp directory inside the
// repository, where Pi asks for project trust. No inherited variable reaches
// Pi, so no provider key does either. The sandbox is removed on every exit.
//
// It is not part of `npm run check` or CI.

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { resolvePiRuntime } from "../pi-runtime.ts";

const TAG = "mcp-adapter-canary";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const EXTENSION_ENTRY = path.join(REPO_ROOT, "extensions", "pi-claude-marketplace", "index.ts");
const FIXTURE_RELATIVE = "tests/live-uat/fixtures/mcp-adapter-canary/legacy-v0.19.2.json";
const FIXTURE_PATH = path.join(REPO_ROOT, FIXTURE_RELATIVE);
const PLACEHOLDER = "@@SANDBOX@@";
const MARKETPLACE = "canary-mkt";
const ADAPTER_VERSION = "5.2.0";
const LEGACY_VERSION = "0.19.2";
const EXIT_HUMAN_NEEDED = 1;
const EXIT_REGRESSION = 2;

const COMMAND_STEP_MS = 60_000;
const MODEL_STEP_MS = 120_000;
const SESSION_HARD_STOP_MS = 300_000;
const CLOSE_WAIT_MS = 15_000;
const DIALOG_METHODS = new Set(["select", "confirm", "input", "editor"]);

const LEGACY_FILES = ["mcp.json", "pi-claude-marketplace/state.json", "claude-plugins.json"];
const MOVED_SUMMARY = "Plugin MCP servers moved from mcp.json to mcp-adapter.json.";
const MIGRATED_ROW = "echo -> plugin_echo_echo_ (echo) [user]";
const ECHO_KEY = "plugin_echo_echo_";
const PING_KEY = "plugin_ping_ping_";
const ECHO_TOOL = "mcp__plugin_echo_echo__echo_canary";
const ROUTE_A_PROMPT = "route-a: find the echo canary tool and call it with the text hi";
const STUB_SCRIPTS = {
  "route-a": [
    { tool: "mcp", arguments: { search: "echo canary" } },
    { tool: ECHO_TOOL, arguments: { text: "hi" } },
  ],
  "route-b": [
    { tool: "tool_search", arguments: { query: "echo canary" } },
    { tool: ECHO_TOOL, arguments: { text: "via-tool-search" } },
  ],
};
const STUB_START_MS = 5_000;
const STATUS_TOKENS = { cached: "cached, connects on first use", connected: "connected" };

const PLUGINS = [
  {
    name: "echo",
    description: "echo canary",
    tool: {
      name: "echo_canary",
      description: "Echo canary: returns the text it is given.",
      inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    },
    reply: "echo-canary:",
    echoesText: true,
  },
  {
    name: "ping",
    description: "ping probe",
    tool: {
      name: "ping_probe",
      description: "Ping probe: answers pong.",
      inputSchema: { type: "object", properties: {} },
    },
    reply: "pong",
    echoesText: false,
  },
];

/** The sandbox root every printed line hides, once the sandbox exists. */
let maskedRoot;

/** Sessions still running, so the teardown can stop them on any exit. */
const liveSessions = new Set();

/** The stub child process, so the teardown can stop it on any exit. */
let liveStub;

function mask(text) {
  return maskedRoot === undefined ? String(text) : String(text).replaceAll(maskedRoot, "<sandbox>");
}

function printOut(line) {
  console.log(mask(line));
}

function printErr(line) {
  console.error(mask(line));
}

/** Carries an exit code from a routing helper to the top level. */
class CanaryExit extends Error {
  constructor(message, exitCode) {
    super(message);
    this.name = "CanaryExit";
    this.exitCode = exitCode;
  }
}

function routeMessage(heading, reason, detail) {
  printErr(`\n[${TAG}] ${heading}`);
  printErr(`  ${reason}`);
  if (detail) {
    printErr(`\n${detail}`);
  }
}

/** Unmet precondition or inconclusive drive: exit 1, routed human_needed. */
function humanNeeded(reason, detail) {
  routeMessage("LIVE RUNTIME REQUIRED -- not proven, routing human_needed:", reason, detail);
  throw new CanaryExit(reason, EXIT_HUMAN_NEEDED);
}

/** An observation contradicts assertion `id`: exit 2. */
function regression(id, reason, detail) {
  routeMessage(`ADOC-02 REGRESSION -- ${id} failed:`, reason, detail);
  throw new CanaryExit(reason, EXIT_REGRESSION);
}

function pass(id, message) {
  printOut(`[${TAG}] PASS: ${id}: ${message}`);
}

function observed(message) {
  printOut(`[${TAG}] observed: ${message}`);
}

function parseCli(argv) {
  const invert = argv.includes("--invert");
  const at = argv.indexOf("--capture-legacy");
  if (at === -1) {
    return { invert, capturePrefix: undefined };
  }

  const prefix = argv[at + 1];
  if (prefix === undefined || prefix.startsWith("--")) {
    humanNeeded("--capture-legacy needs the npm prefix of a pi-claude-marketplace 0.19.2 install.");
  }

  return { invert, capturePrefix: path.resolve(prefix) };
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

/** Reads a JSON file, or returns undefined when it does not exist. */
async function readJsonIfPresent(file) {
  try {
    return await readJson(file);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function isPresent(file) {
  try {
    await realpath(file);
    return true;
  } catch {
    return false;
  }
}

function isInside(candidate, root) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function resolvePi() {
  let pi;
  try {
    pi = resolvePiRuntime(REPO_ROOT);
  } catch (error) {
    humanNeeded("The repository's Pi could not be resolved. Run `npm ci`.", error?.message);
  }

  const major = Number(pi.version.split(".")[0]);
  if (!(major >= 1)) {
    humanNeeded(`Pi ${pi.version} is below 1.0.0.`);
  }

  return pi;
}

/** Checks that `root` holds `name` at exactly `version` and returns its entry path. */
async function requirePackage(root, name, version, entry, hint) {
  const manifest = await readJsonIfPresent(path.join(root, "package.json")).catch(() => undefined);
  if (manifest?.name !== name || manifest?.version !== version) {
    const found = manifest === undefined ? "no package" : `${manifest.name} ${manifest.version}`;
    humanNeeded(`${root} must hold ${name} ${version}; it holds ${found}.`, hint);
  }

  const entryPath = path.join(root, entry);
  if (!(await isPresent(entryPath))) {
    humanNeeded(`${entryPath} does not exist.`, hint);
  }

  return entryPath;
}

async function adapterExtension() {
  const hint =
    "Install it outside the checkout and name it:\n" +
    `  npm install --prefix /var/tmp/mcp-adapter-520 pi-mcp-adapter@${ADAPTER_VERSION} ` +
    "--ignore-scripts --omit=peer --no-audit --no-fund\n" +
    "  PI_MCP_ADAPTER_ROOT=/var/tmp/mcp-adapter-520/node_modules/pi-mcp-adapter";
  const root = process.env.PI_MCP_ADAPTER_ROOT;
  if (root === undefined || root.trim() === "") {
    humanNeeded("PI_MCP_ADAPTER_ROOT is unset.", hint);
  }

  const resolved = path.resolve(root);
  const entry = await requirePackage(resolved, "pi-mcp-adapter", ADAPTER_VERSION, "index.ts", hint);
  return { entry, label: `pi-mcp-adapter ${ADAPTER_VERSION} at ${resolved}` };
}

async function legacyExtension(prefix) {
  const hint =
    `  npm install --prefix ${prefix} pi-claude-marketplace@${LEGACY_VERSION} ` +
    "--legacy-peer-deps --ignore-scripts --no-audit --no-fund";
  const root = path.join(prefix, "node_modules", "pi-claude-marketplace");
  const entryFile = path.join("extensions", "pi-claude-marketplace", "index.ts");
  const entry = await requirePackage(
    root,
    "pi-claude-marketplace",
    LEGACY_VERSION,
    entryFile,
    hint,
  );
  return { entry, label: `pi-claude-marketplace ${LEGACY_VERSION} at ${root}` };
}

async function sandboxParent() {
  const parent = await realpath(tmpdir());
  if (isInside(parent, await realpath(REPO_ROOT))) {
    humanNeeded(
      `The temp directory ${parent} is inside the repository, where Pi asks for project trust.`,
      "Set TMPDIR outside the repository, for example TMPDIR=/var/tmp/mcp-adapter-canary.",
    );
  }

  return parent;
}

/** M0: the lock-pinned Pi, the companion package and a temp dir outside the repository. */
async function checkPreconditions(cli) {
  const pi = resolvePi();
  const ext =
    cli.capturePrefix === undefined
      ? await adapterExtension()
      : await legacyExtension(cli.capturePrefix);
  const parent = await sandboxParent();
  pass("M0", `Pi ${pi.version} (${pi.cliPath}), ${ext.label}, sandbox parent ${parent}`);
  return { pi, ext };
}

function serverSource(plugin) {
  return `import { createInterface } from "node:readline";

const TOOL = ${JSON.stringify(plugin.tool)};
const REPLY = ${JSON.stringify(plugin.reply)};
const ECHOES_TEXT = ${plugin.echoesText};

function answer(message) {
  switch (message.method) {
    case "initialize":
      return {
        protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: TOOL.name, version: "1.0.0" },
      };
    case "tools/list":
      return { tools: [TOOL] };
    case "tools/call": {
      const text = ECHOES_TEXT ? REPLY + String(message.params?.arguments?.text ?? "") : REPLY;
      return { content: [{ type: "text", text }] };
    }
    case "ping":
      return {};
    default:
      return undefined;
  }
}

const lines = createInterface({ input: process.stdin });
lines.on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message?.id === undefined) {
    return;
  }
  const result = answer(message);
  const reply =
    result === undefined
      ? { jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "method not found" } }
      : { jsonrpc: "2.0", id: message.id, result };
  process.stdout.write(JSON.stringify(reply) + "\\n");
});
lines.on("close", () => process.exit(0));
`;
}

async function writePlugin(dir, plugin) {
  await writeJson(path.join(dir, ".claude-plugin", "plugin.json"), {
    name: plugin.name,
    version: "1.0.0",
    mcpServers: {
      [plugin.name]: { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/server.mjs"] },
    },
  });
  await writeFile(path.join(dir, "server.mjs"), serverSource(plugin));
}

async function buildMarketplace(mkt) {
  await writeJson(path.join(mkt, ".claude-plugin", "marketplace.json"), {
    name: MARKETPLACE,
    owner: { name: "canary" },
    plugins: PLUGINS.map((plugin) => ({
      name: plugin.name,
      source: `./plugins/${plugin.name}`,
      description: plugin.description,
    })),
  });
  await Promise.all(
    PLUGINS.map((plugin) => writePlugin(path.join(mkt, "plugins", plugin.name), plugin)),
  );
}

// A reload re-runs every factory, so the snapshot starts empty after it.
const HELPER_SOURCE = `export default function (pi) {
  let pairs = null;
  pi.events.on("pi-mcp-adapter/status/v1", (snapshot) => {
    const servers = Array.isArray(snapshot?.servers) ? snapshot.servers : [];
    pairs = servers.map((server) => [server?.name, server?.status]);
  });
  pi.registerCommand("canary-reload", {
    description: "Reload Pi from the canary",
    handler: async (_args, ctx) => {
      await ctx.reload();
    },
  });
  pi.registerCommand("canary-wait", {
    description: "Wait the given milliseconds",
    handler: async (args) => {
      const ms = Number(String(args ?? "").trim() || "1000");
      await new Promise((resolve) => setTimeout(resolve, ms));
    },
  });
  pi.registerCommand("canary-status", {
    description: "Print the last pi-mcp-adapter status snapshot",
    handler: async (_args, ctx) => {
      ctx.ui.notify("canary-status " + JSON.stringify(pairs), "info");
    },
  });
}
`;

/** Builds the sandbox layout below `root`, which must hold only safe path characters. */
async function prepareSandbox(root) {
  if (!/^[A-Za-z0-9._/-]+$/.test(root)) {
    humanNeeded(`The sandbox root ${root} holds characters the JSON substitution cannot carry.`);
  }

  const sandbox = {
    root,
    home: path.join(root, "home"),
    agentDir: path.join(root, "agent"),
    cwd: path.join(root, "cwd"),
    mkt: path.join(root, "mkt"),
    helper: path.join(root, "helper", "canary-helper.ts"),
  };
  await Promise.all(
    [sandbox.home, sandbox.agentDir, sandbox.cwd].map((dir) => mkdir(dir, { recursive: true })),
  );
  await mkdir(path.dirname(sandbox.helper), { recursive: true });
  await writeFile(sandbox.helper, HELPER_SOURCE);
  await writeJson(path.join(sandbox.agentDir, "settings.json"), { extensions: ["-builtin:mcp"] });
  await buildMarketplace(sandbox.mkt);
  return sandbox;
}

function childEnvironment(sandbox) {
  const env = {
    HOME: sandbox.home,
    PI_CODING_AGENT_DIR: sandbox.agentDir,
    PI_OFFLINE: "1",
    PATH: process.env.PATH ?? "",
  };
  if (process.env.TMPDIR !== undefined) {
    env.TMPDIR = process.env.TMPDIR;
  }

  return env;
}

function killGroup(child) {
  if (child.pid === undefined) {
    return;
  }

  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    // The group has already exited.
  }
}

/** Resolves the step in flight with what arrived since it was sent. */
function finishStep(state, extra) {
  const step = state.step;
  if (step === undefined) {
    return;
  }

  state.step = undefined;
  clearTimeout(step.timer);
  step.resolve({
    ...extra,
    message: step.message,
    response: step.response,
    notifies: state.notifies.slice(step.notifyStart),
    tools: state.tools.slice(step.toolStart),
    elapsedMs: Date.now() - step.startedAt,
  });
}

function onResponse(state, record) {
  const step = state.step;
  if (step === undefined || record.id !== step.id) {
    return;
  }

  if (record.success !== true) {
    finishStep(state, { failure: `Pi refused it: ${record.error ?? JSON.stringify(record)}` });
    return;
  }

  step.response = record;
  if (!step.settle || step.settled) {
    finishStep(state, {});
  }
}

function onSettled(state) {
  const step = state.step;
  if (step?.settle !== true) {
    return;
  }

  step.settled = true;
  if (step.response !== undefined) {
    finishStep(state, {});
  }
}

// Dialogs are recorded and cancelled, so no step ever waits on a human.
function onUiRequest(state, record) {
  if (record.method === "notify") {
    state.notifies.push({ message: String(record.message ?? ""), notifyType: record.notifyType });
    return;
  }

  if (DIALOG_METHODS.has(record.method)) {
    state.dialogs.push(String(record.method));
    state.child.stdin.write(
      `${JSON.stringify({ type: "extension_ui_response", id: record.id, cancelled: true })}\n`,
    );
  }
}

const RECORD_HANDLERS = {
  response: onResponse,
  agent_settled: onSettled,
  extension_ui_request: onUiRequest,
  extension_error: (state, record) => state.extensionErrors.push(record),
  tool_execution_end: (state, record) => state.tools.push(record),
};

function onLine(state, line) {
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    return;
  }

  const type = typeof record?.type === "string" ? record.type : "";
  if (Object.hasOwn(RECORD_HANDLERS, type)) {
    RECORD_HANDLERS[type](state, record);
  }
}

function onExit(state, code) {
  state.exited = true;
  state.exitCode = code;
  finishStep(state, { failure: `Pi exited with code ${code} during the step` });
  for (const wake of state.exitWaiters) {
    wake();
  }
}

/** Sends one prompt and resolves on its response, or after `agent_settled` with `settle`. */
function sendStep(state, message, settle) {
  if (state.exited) {
    return Promise.resolve({ failure: "Pi had already exited", message, notifies: [], tools: [] });
  }

  return new Promise((resolve) => {
    state.nextId += 1;
    const id = `step-${state.nextId}`;
    const limitMs = settle ? MODEL_STEP_MS : COMMAND_STEP_MS;
    const timer = setTimeout(() => {
      finishStep(state, {
        failure: `no ${settle ? "agent_settled" : "response"} in ${limitMs} ms`,
      });
    }, limitMs);
    state.step = {
      id,
      message,
      settle,
      resolve,
      timer,
      startedAt: Date.now(),
      notifyStart: state.notifies.length,
      toolStart: state.tools.length,
    };
    state.child.stdin.write(`${JSON.stringify({ id, type: "prompt", message })}\n`);
  });
}

function waitForExit(state, ms) {
  return new Promise((resolve) => {
    if (state.exited) {
      resolve();
      return;
    }

    const timer = setTimeout(resolve, ms);
    state.exitWaiters.push(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function closeSession(session) {
  const { state } = session;
  liveSessions.delete(session);
  if (!state.exited) {
    state.child.stdin.end();
    await waitForExit(state, CLOSE_WAIT_MS);
  }

  killGroup(state.child);
  return state;
}

/** Starts Pi in RPC mode in the sandbox with `extensions`, in that order. */
function openSession(pi, sandbox, extensions) {
  const args = [pi.cliPath, "--mode", "rpc", "--offline", "--no-session"];
  for (const extension of extensions) {
    args.push("--extension", extension);
  }

  const child = spawn(process.execPath, args, {
    cwd: sandbox.cwd,
    detached: true,
    env: childEnvironment(sandbox),
    stdio: ["pipe", "pipe", "pipe"],
  });
  const state = {
    child,
    nextId: 0,
    step: undefined,
    notifies: [],
    tools: [],
    dialogs: [],
    extensionErrors: [],
    stderr: "",
    exited: false,
    exitCode: null,
    exitWaiters: [],
  };
  const hardStop = setTimeout(() => {
    state.stderr += `\n[canary] hard stop after ${SESSION_HARD_STOP_MS} ms`;
    killGroup(child);
  }, SESSION_HARD_STOP_MS);
  hardStop.unref();
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    state.stderr += chunk;
  });
  child.stdin.on("error", (error) => {
    state.stderr += `\nstdin: ${error.message}`;
  });
  child.on("error", (error) => {
    state.stderr += `\nspawn: ${error.message}`;
  });
  child.on("exit", () => killGroup(child));
  child.on("close", (code) => {
    clearTimeout(hardStop);
    onExit(state, code);
  });
  createInterface({ input: child.stdout }).on("line", (line) => onLine(state, line));
  const session = { state };
  liveSessions.add(session);
  return session;
}

function stderrTail(session) {
  const lines = session.state.stderr.trim().split("\n");
  return lines.length > 1 || lines[0] !== ""
    ? `Pi stderr (tail):\n${lines.slice(-30).join("\n")}`
    : "";
}

function notifyText(notifies) {
  return notifies.map((notify) => notify.message).join("\n---\n");
}

/** Sends one step; a refused, timed-out or interrupted step routes human_needed. */
async function run(session, message, settle = false) {
  const outcome = await sendStep(session.state, message, settle);
  if (outcome.failure !== undefined) {
    humanNeeded(`Step "${message}": ${outcome.failure}.`, stderrTail(session));
  }

  return outcome;
}

/** The first step of every session: proves that a command response waits for its handler. */
async function checkPacing(session) {
  const outcome = await run(session, "/canary-wait 1500");
  if (outcome.elapsedMs < 1400) {
    humanNeeded(
      `/canary-wait 1500 answered after ${outcome.elapsedMs} ms, so RPC answered before the ` +
        "handler finished and the waits cannot pace the run.",
    );
  }
}

async function statusTap(session) {
  const outcome = await run(session, "/canary-status");
  const line = outcome.notifies
    .map((notify) => notify.message)
    .find((message) => message.startsWith("canary-status "));
  if (line === undefined) {
    humanNeeded("/canary-status printed no status line.", notifyText(outcome.notifies));
  }

  return JSON.parse(line.slice("canary-status ".length));
}

/** Taps the status up to `bound` times, one second apart, until `predicate` holds. */
async function pollStatus(session, predicate, bound) {
  let pairs = null;
  for (let attempt = 0; attempt < bound; attempt += 1) {
    pairs = await statusTap(session);
    if (predicate(pairs)) {
      return { ok: true, pairs };
    }

    await run(session, "/canary-wait 1000");
  }

  return { ok: false, pairs };
}

function statusOf(pairs, name) {
  return Array.isArray(pairs) ? pairs.find((pair) => pair[0] === name)?.[1] : undefined;
}

/** Returns the text inside `mcp: plugin:<plugin>:<plugin> (...)` of the info output. */
async function infoToken(session, plugin) {
  const outcome = await run(session, `/claude:plugin info ${plugin}@${MARKETPLACE}`);
  const pattern = new RegExp(`mcp: plugin:${plugin}:${plugin} \\(([^)]*)\\)`);
  for (const notify of outcome.notifies) {
    const match = pattern.exec(notify.message);
    if (match !== null) {
      return match[1];
    }
  }

  return humanNeeded(
    `info for ${plugin} printed no "mcp: plugin:${plugin}:${plugin} (" row.`,
    notifyText(outcome.notifies),
  );
}

/** Finds a notify the session received, polling every half second up to `bound` times. */
async function waitForNotify(session, predicate, bound) {
  for (let attempt = 0; attempt <= bound; attempt += 1) {
    const found = session.state.notifies.find((notify) => predicate(notify.message));
    if (found !== undefined || attempt === bound) {
      return found;
    }

    await run(session, "/canary-wait 500");
  }

  return undefined;
}

/** Closes a session; a dialog or an extension error after the fact still fails the run. */
async function closeChecked(session, label) {
  const state = await closeSession(session);
  if (state.dialogs.length > 0) {
    humanNeeded(`${label}: Pi opened dialogs (${state.dialogs.join(", ")}), which were cancelled.`);
  }

  const errors = state.extensionErrors.map((record) => JSON.stringify(record));
  const ours = errors.filter((text) => text.includes(EXTENSION_ENTRY));
  if (ours.length > 0) {
    regression("extension", `${label}: this extension reported errors.`, ours.join("\n"));
  }

  if (errors.length > 0) {
    humanNeeded(`${label}: an extension reported errors.`, errors.join("\n"));
  }
}

/** Sends a command and requires `row` in its notifies, routing `failure` otherwise. */
async function expectRow(session, message, row, failure) {
  const outcome = await sendStep(session.state, message, false);
  const seen = outcome.notifies.some((notify) => notify.message.includes(row));
  if (outcome.failure !== undefined || !seen) {
    const why = outcome.failure ?? `no notify contains "${row}"`;
    humanNeeded(failure, `Step "${message}": ${why}.\n${notifyText(outcome.notifies)}`);
  }
}

async function readLegacyFiles(agentDir) {
  const files = {};
  for (const relative of LEGACY_FILES) {
    const content = await readJsonIfPresent(path.join(agentDir, relative));
    if (content === undefined) {
      humanNeeded(`The 0.19.2 install wrote no ${relative}.`);
    }

    files[relative] = content;
  }

  return files;
}

function fixtureText(pi, root, files) {
  const today = new Date().toISOString().slice(0, 10);
  const fixture = {
    $comment:
      "The legacy files pi-claude-marketplace 0.19.2 wrote into the agent directory after " +
      `adding the ${MARKETPLACE} marketplace and installing echo: the marked mcp.json entry, ` +
      "the state.json record and claude-plugins.json. Every mcp-adapter-canary run seeds them " +
      `with ${PLACEHOLDER} replaced by its sandbox root. Regenerate with captureCommand.`,
    capturedWith: `pi-claude-marketplace ${LEGACY_VERSION} on @earendil-works/pi-coding-agent ${pi.version}, ${today}`,
    captureCommand:
      `npm install --prefix <prefix> pi-claude-marketplace@${LEGACY_VERSION} --legacy-peer-deps ` +
      "--ignore-scripts --no-audit --no-fund && TMPDIR=<directory outside the repository> " +
      "node tests/live-uat/mcp-adapter-canary.mjs --capture-legacy <prefix>",
    sandboxRoot: PLACEHOLDER,
    files,
  };
  const text = `${JSON.stringify(fixture, null, 2).replaceAll(root, PLACEHOLDER)}\n`;
  for (const forbidden of [root, REPO_ROOT, homedir()]) {
    if (text.includes(forbidden)) {
      humanNeeded(`The captured fixture still holds ${forbidden}; refusing to write it.`);
    }
  }

  return text;
}

/** `--capture-legacy`: drives 0.19.2 alone and writes the fixture. */
async function captureLegacy(pi, ext, sandbox) {
  const session = openSession(pi, sandbox, [ext.entry, sandbox.helper]);
  await checkPacing(session);
  const notLoaded =
    `pi-claude-marketplace ${LEGACY_VERSION} did not load on Pi ${pi.version}; ` +
    "an older Pi needs the operator's approval";
  await expectRow(
    session,
    `/claude:plugin marketplace add ${sandbox.mkt} --scope user`,
    `● ${MARKETPLACE} [user] (added)`,
    notLoaded,
  );
  await expectRow(
    session,
    `/claude:plugin install echo@${MARKETPLACE} --scope user`,
    "● echo v1.0.0 (installed)",
    notLoaded,
  );
  await closeChecked(session, "capture session");

  const files = await readLegacyFiles(sandbox.agentDir);
  const marker = files["mcp.json"]?.mcpServers?.echo?._piClaudeMarketplace;
  if (marker?.plugin !== "echo" || marker?.marketplace !== MARKETPLACE) {
    humanNeeded(
      "The 0.19.2 mcp.json holds no marked echo entry.",
      JSON.stringify(files["mcp.json"]),
    );
  }

  await mkdir(path.dirname(FIXTURE_PATH), { recursive: true });
  await writeFile(FIXTURE_PATH, fixtureText(pi, sandbox.root, files));
  printOut(`[${TAG}] captured ${FIXTURE_RELATIVE}`);
}

/** Writes the fixture's files under the agent directory with the sandbox root in place. */
async function seedLegacy(sandbox) {
  const fixture = await readJsonIfPresent(FIXTURE_PATH);
  if (fixture?.files === undefined) {
    humanNeeded(`${FIXTURE_RELATIVE} is missing; run --capture-legacy first.`);
  }

  for (const [relative, content] of Object.entries(fixture.files)) {
    const target = path.resolve(sandbox.agentDir, relative);
    if (!isInside(target, sandbox.agentDir)) {
      humanNeeded(`The fixture names ${relative}, outside the agent directory.`);
    }

    const text = JSON.stringify(content, null, 2).replaceAll(PLACEHOLDER, sandbox.root);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${text}\n`);
  }

  await mkdir(path.join(sandbox.agentDir, "pi-claude-marketplace", "data", MARKETPLACE, "echo"), {
    recursive: true,
  });
}

function reportIgnoredSettings(session) {
  for (const notify of session.state.notifies) {
    if (
      notify.message.includes("_piClaudeMarketplace") &&
      notify.message.includes("Ignored settings")
    ) {
      observed(`pi-mcp-adapter first-start warning: ${notify.message}`);
    }
  }
}

/** M1 (AMIG-03): the migration notice names the moved entry. */
async function assertMigrationNotice(session) {
  const notice = await waitForNotify(session, (message) => message.includes(MOVED_SUMMARY), 30);
  reportIgnoredSettings(session);
  if (notice === undefined) {
    regression("M1", "No migration notice arrived.", notifyText(session.state.notifies));
  }

  if (!notice.message.includes(MIGRATED_ROW)) {
    regression("M1", `The migration notice does not list "${MIGRATED_ROW}".`, notice.message);
  }

  pass("M1", `AMIG-03: the migration notice lists "${MIGRATED_ROW}"`);
}

/** M2 (AMIG-03, ASTAT-02): before any reload the adapter still serves the old name. */
async function assertBeforeReload(session) {
  const tap = await pollStatus(session, (pairs) => Array.isArray(pairs) && pairs.length > 0, 20);
  if (!tap.ok) {
    humanNeeded(
      "pi-mcp-adapter published no server list.",
      `Last snapshot: ${JSON.stringify(tap.pairs)}`,
    );
  }

  const listed = JSON.stringify(tap.pairs);
  if (statusOf(tap.pairs, "echo") === undefined || statusOf(tap.pairs, ECHO_KEY) !== undefined) {
    regression(
      "M2",
      `Before any reload the adapter lists ${listed}; expected echo and not ${ECHO_KEY}.`,
    );
  }

  const token = await infoToken(session, "echo");
  if (token !== "not loaded") {
    regression("M2", `Before any reload info shows (${token}); expected (not loaded).`);
  }

  pass(
    "M2",
    `AMIG-03, ASTAT-02: before any reload the adapter lists ${listed} and info shows (not loaded)`,
  );
}

/** Lists what is wrong with an `mcp-adapter.json` entry this extension owns. */
function entryProblems(entry, plugin) {
  const expected = { command: "node", toolPrefix: "mcp", directTools: "search" };
  const problems = Object.entries(expected)
    .filter(([key, value]) => entry?.[key] !== value)
    .map(([key, value]) => `${key} is ${JSON.stringify(entry?.[key])}, expected "${value}"`);
  const marker = entry?._piClaudeMarketplace;
  if (marker?.plugin !== plugin || marker?.marketplace !== MARKETPLACE) {
    problems.push(`the marker is ${JSON.stringify(marker)}`);
  }

  return problems;
}

/** M3 (AMIG-01, ANAME-01, ANAME-04): the files after the move. */
async function assertMigratedFiles(sandbox) {
  const legacy = await readJsonIfPresent(path.join(sandbox.agentDir, "mcp.json"));
  const servers = legacy?.mcpServers ?? {};
  const marked = Object.keys(servers).filter((key) => servers[key]?._piClaudeMarketplace);
  if (marked.length > 0) {
    regression("M3", `mcp.json still holds marked entries: ${marked.join(", ")}.`);
  }

  const adapter = await readJsonIfPresent(path.join(sandbox.agentDir, "mcp-adapter.json"));
  const entry = adapter?.mcpServers?.[ECHO_KEY];
  const problems = entryProblems(entry, "echo");
  if (problems.length > 0) {
    regression(
      "M3",
      `mcp-adapter.json ${ECHO_KEY}: ${problems.join("; ")}.`,
      JSON.stringify(adapter, null, 2),
    );
  }

  pass(
    "M3",
    `AMIG-01, ANAME-01, ANAME-04: mcp.json keeps no marked entry; mcp-adapter.json holds ` +
      `${ECHO_KEY} with toolPrefix "mcp" and directTools "search"`,
  );
}

/** Requires info to show the token the adapter's status maps to. */
async function expectInfoMatches(session, plugin, status, id) {
  const token = await infoToken(session, plugin);
  if (token !== STATUS_TOKENS[status]) {
    regression(id, `info for ${plugin} shows (${token}) while the adapter reports ${status}.`);
  }

  return token;
}

/** The first reload at which `liveKeys` are live, or undefined after three. */
async function reloadsUntilLive(session, liveKeys) {
  const isLive = (pairs) =>
    liveKeys.every((key) => ["cached", "connected"].includes(statusOf(pairs, key)));
  for (let reload = 1; reload <= 3; reload += 1) {
    await run(session, "/canary-reload");
    const tap = await pollStatus(session, isLive, 20);
    if (tap.ok) {
      return { reload, pairs: tap.pairs };
    }

    observed(`after reload ${reload} the adapter lists ${JSON.stringify(tap.pairs)}`);
  }

  return undefined;
}

/** M4 (AMIG-03, ASTAT-01): one reload makes both keys live and drops the old name. */
async function assertReloadCount(session) {
  const live = await reloadsUntilLive(session, [ECHO_KEY, PING_KEY]);
  if (live === undefined) {
    regression("M4", `${ECHO_KEY} and ${PING_KEY} are not both live after 3 reloads.`);
  }

  if (statusOf(live.pairs, "echo") !== undefined) {
    regression(
      "M4",
      `After reload ${live.reload} the adapter still lists echo: ${JSON.stringify(live.pairs)}.`,
    );
  }

  observed(`reloads until ${ECHO_KEY} is live and echo is gone: ${live.reload}`);
  if (live.reload !== 1) {
    regression("M4", `The move took ${live.reload} reloads; the notice promises 1.`);
  }

  const echo = await expectInfoMatches(session, "echo", statusOf(live.pairs, ECHO_KEY), "M4");
  const ping = await expectInfoMatches(session, "ping", statusOf(live.pairs, PING_KEY), "M4");
  pass(
    "M4",
    `AMIG-03, ASTAT-01, AFILE-01: after 1 reload the adapter lists ${JSON.stringify(live.pairs)}; ` +
      `info shows echo (${echo}) and ping (${ping})`,
  );
}

/** I1 (AFILE-01): a plugin installed fresh in the session is written for the adapter. */
async function assertFreshInstall(session, sandbox) {
  const outcome = await run(session, `/claude:plugin install ping@${MARKETPLACE} --scope user`);
  if (!outcome.notifies.some((notify) => notify.message.includes("● ping v1.0.0 (installed)"))) {
    regression(
      "I1",
      "The install shows no `● ping v1.0.0 (installed)` row.",
      notifyText(outcome.notifies),
    );
  }

  const adapter = await readJsonIfPresent(path.join(sandbox.agentDir, "mcp-adapter.json"));
  const problems = entryProblems(adapter?.mcpServers?.[PING_KEY], "ping");
  if (problems.length > 0) {
    regression("I1", `mcp-adapter.json ${PING_KEY}: ${problems.join("; ")}.`);
  }

  pass("I1", `AFILE-01: ping installed fresh is written to mcp-adapter.json as ${PING_KEY}`);
}

/** Session 1: the seeded legacy entry migrates, a fresh install joins it, one reload makes both live. */
async function proveMigration(pi, ext, sandbox) {
  await seedLegacy(sandbox);
  const session = openSession(pi, sandbox, [EXTENSION_ENTRY, ext.entry, sandbox.helper]);
  await checkPacing(session);
  await assertMigrationNotice(session);
  await assertBeforeReload(session);
  await assertMigratedFiles(sandbox);
  await assertFreshInstall(session, sandbox);
  await assertReloadCount(session);
  await closeChecked(session, "session 1");
}

/** Reads the first stdout line of the stub within the start bound and returns its port. */
function stubPort(child) {
  return new Promise((resolve) => {
    const lines = createInterface({ input: child.stdout });
    const timer = setTimeout(() => resolve(undefined), STUB_START_MS);
    lines.once("line", (line) => {
      clearTimeout(timer);
      resolve(/:(\d+)\/v1/.exec(line)?.[1]);
    });
  });
}

/** Starts the keyless stub on a free port with the route scripts and points Pi at it. */
async function startStub(sandbox) {
  const scriptFile = path.join(sandbox.root, "stub-script.json");
  const log = path.join(sandbox.root, "stub-http.log");
  await writeJson(scriptFile, STUB_SCRIPTS);
  await writeFile(log, "");
  liveStub = spawn(process.execPath, [path.join(HERE, "openai-stub-server.mjs")], {
    env: {
      PATH: process.env.PATH ?? "",
      STUB_PORT: "0",
      STUB_HTTP_LOG: log,
      STUB_SCRIPT: scriptFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const port = await stubPort(liveStub);
  if (port === undefined) {
    humanNeeded(`openai-stub-server.mjs printed no port within ${STUB_START_MS} ms.`);
  }

  await writeJson(path.join(sandbox.agentDir, "models.json"), {
    providers: {
      stubllm: {
        baseUrl: `http://127.0.0.1:${port}/v1`,
        api: "openai-completions",
        apiKey: "stub",
        models: [{ id: "stub" }],
      },
    },
  });
  await writeJson(path.join(sandbox.agentDir, "settings.json"), {
    defaultProvider: "stubllm",
    defaultModel: "stub",
    defaultTools: ["+tool_search"],
    extensions: ["-builtin:mcp"],
  });
  return { log };
}

async function stubRequests(stub) {
  const text = await readFile(stub.log, "utf8");
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
}

/** A2, first half: `mcp({ search })` returned the plugin tool on its server key. */
function assertSearchMatch(turn) {
  const search = turn.tools.find((event) => event.toolName === "mcp");
  const matches = search?.result?.details?.matches;
  const found =
    Array.isArray(matches) &&
    matches.some((match) => match?.tool === ECHO_TOOL && match?.server === ECHO_KEY);
  if (!found) {
    const seen = search ?? turn.tools.map((event) => event.toolName);
    regression(
      "A2",
      `mcp({ search }) did not return ${ECHO_TOOL} on ${ECHO_KEY}.`,
      JSON.stringify(seen),
    );
  }
}

/** A2, second half: the first model request did not declare the tool and a later one did. */
function assertDeclaredAfterSearch(requests) {
  if (requests.length === 0) {
    humanNeeded("The route A turn sent no request to the stub.");
  }

  const [first, ...later] = requests;
  const firstTools = Array.isArray(first.tools) ? first.tools : [];
  observed(`route A first model request tools: ${JSON.stringify(firstTools)}`);
  if (!firstTools.includes("mcp") || firstTools.includes(ECHO_TOOL)) {
    regression("A2", `The first model request declares ${JSON.stringify(firstTools)}.`);
  }

  if (!later.some((request) => request.tools?.includes(ECHO_TOOL))) {
    regression("A2", `No model request after the search declares ${ECHO_TOOL}.`);
  }
}

/** A3 (ADOC-02): the call returns the server's text; `--invert` expects other text. */
function assertToolResult(turn, invert) {
  const expected = invert ? "echo-canary:inverted" : "echo-canary:hi";
  const call = turn.tools.find((event) => event.toolName === ECHO_TOOL);
  const text = call?.result?.content?.[0]?.text;
  if (call?.isError !== false || text !== expected) {
    regression(
      "A3",
      `${ECHO_TOOL} returned ${JSON.stringify(text)} (isError ${call?.isError}); expected "${expected}".`,
    );
  }

  pass("A3", `ADOC-02: ${ECHO_TOOL} returned "${text}"`);
}

/** A4 (ASTAT-01): after the first MCP use the adapter and info both report connected. */
async function assertConnected(session) {
  const tap = await pollStatus(session, (pairs) => statusOf(pairs, ECHO_KEY) === "connected", 20);
  if (!tap.ok) {
    regression("A4", `After the call the adapter lists ${JSON.stringify(tap.pairs)}.`);
  }

  await expectInfoMatches(session, "echo", "connected", "A4");
  pass(
    "A4",
    `ASTAT-01: after the first MCP use the adapter reports ${ECHO_KEY} connected and info shows (connected)`,
  );
}

/** Session 2, a fresh Pi process: route A finds and calls the plugin tool. */
async function proveRouteA(pi, ext, sandbox, stub, invert) {
  const session = openSession(pi, sandbox, [EXTENSION_ENTRY, ext.entry, sandbox.helper]);
  await checkPacing(session);
  await run(session, "/canary-wait 3000");
  const before = await infoToken(session, "echo");
  if (before !== "status unknown") {
    regression(
      "A1",
      `In a fresh session info shows (${before}) before any MCP use; expected (status unknown).`,
    );
  }

  pass("A1", "ASTAT-02: in a fresh deferred session info shows (status unknown)");
  const logStart = (await stubRequests(stub)).length;
  const turn = await run(session, ROUTE_A_PROMPT, true);
  assertSearchMatch(turn);
  assertDeclaredAfterSearch((await stubRequests(stub)).slice(logStart));
  pass(
    "A2",
    `ANAME-01, ANAME-04: mcp({ search }) returned ${ECHO_TOOL}, declared only after the search`,
  );
  assertToolResult(turn, invert);
  await assertConnected(session);
  await closeChecked(session, "session 2");
}

async function teardown(root) {
  await Promise.all([...liveSessions].map((session) => closeSession(session)));
  liveStub?.kill("SIGKILL");
  await rm(root, { recursive: true, force: true });
}

async function main(cli) {
  const { pi, ext } = await checkPreconditions(cli);
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "mcp-adapter-canary-")));
  maskedRoot = root;
  try {
    const sandbox = await prepareSandbox(root);
    if (cli.capturePrefix !== undefined) {
      await captureLegacy(pi, ext, sandbox);
      return;
    }

    const stub = await startStub(sandbox);
    await proveMigration(pi, ext, sandbox);
    await proveRouteA(pi, ext, sandbox, stub, cli.invert);
    printOut(`[${TAG}] all assertions proven; exit 0`);
  } finally {
    await teardown(root);
  }
}

function exitCodeOf(error) {
  if (error instanceof CanaryExit) {
    return error.exitCode;
  }

  printErr(`\n[${TAG}] LIVE RUNTIME REQUIRED -- unexpected harness error:`);
  printErr(String(error?.stack ?? error));
  return EXIT_HUMAN_NEEDED;
}

let exitCode = 0;
try {
  await main(parseCli(process.argv.slice(2)));
} catch (error) {
  exitCode = exitCodeOf(error);
}

process.exit(exitCode);

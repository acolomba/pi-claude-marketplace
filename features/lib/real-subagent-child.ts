/**
 * @fileoverview Runs real pi-subagents children of an installed plugin, so a
 * test observes what the installed companion launches, not a stand-in
 * (D-PG3-09).
 *
 * Each run builds a fixture of its own under the OS temp directory: a HOME,
 * a Pi agent directory, a trusted project, and a local marketplace whose
 * plugin `demo` holds the run's agents, a stub MCP server, and a recording
 * hook of every event. Its Stop hook asks a main session for one more turn.
 * A main Pi in RPC mode loads the real extension, pi-subagents, and the MCP
 * implementation of the profile, each from the optional peer cache, and
 * installs the plugin with `/claude:plugin` in the user scope, as a user
 * does. The user's settings name the extension and the MCP implementation,
 * so every child session loads them, as a child loads the user's extensions.
 * The main Pi saves its session in the fixture's agent directory, so
 * pi-subagents writes that session's file into the header of each child
 * session it creates (D-PG6-02, D-PG6-16).
 *
 * Every Pi, and every child it starts, selects a scripted OpenAI-compatible
 * provider that this module serves on the loopback address, with a dummy
 * key. Its environment is the harness allowlist, which holds no provider
 * credential and no base address, and Pi runs offline. The provider answers
 * a request with the next tool call of the script whose marker the request's
 * last user text holds, and with the text `Done.` past it. A marker is a
 * bracketed token looked up whole, so an agent whose name begins with
 * another agent's name never gets that agent's script. It keeps each
 * request's last user text and tool names, never a system prompt or a
 * header.
 *
 * `runRealSubagentChild` has the main Pi's model call pi-subagents'
 * `subagent` tool for each agent in turn, naming no launch mode, so the
 * agent's frontmatter and pi-subagents' configuration decide it. For a
 * detached child it waits for the runner's status to end and for the runner
 * to exit, and reads the child's Pi session id from the header of the session
 * file pi-subagents records, apart from any hook, and keeps that file.
 * pi-subagents then wakes the main Pi with a notice, and the run waits for
 * the main Pi to settle.
 *
 * `runConcurrentRealSubagentChildren` starts one runner process of its own,
 * with pi-subagents' child marker, that builds the sessions of a generation
 * through pi-subagents' launch module and session factory, as its background
 * runner builds a child, prompts them at once, round after round, disposes
 * them, and starts the next generation. It reports its pid and each session's
 * agent, id, and file, which an in-memory session does not have.
 *
 * Every start waits at most `READY_TIMEOUT_MS`, a child at most
 * `CHILD_TIMEOUT_MS`, and a whole run at most `FIXTURE_TIMEOUT_MS`. A run
 * stops the main Pi and the provider, kills each process that still runs
 * with the fixture's HOME, and removes the fixture, in a `finally`. That
 * release is idempotent, and `register` receives it before anything starts,
 * so a caller's release hook frees the run too.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { resolveCompanion } from "./companions.ts";
import { parseRecordingHooks, publishRecordingHooks } from "./hook-files.ts";
import { HOOK_RUNS_LOG } from "./hook-recorder.ts";
import { writeAdapterOnboardingSeed } from "./mcp-implementation.ts";
import { publishStubMcpServer } from "./mcp-server-files.ts";
import { writeMarketplace } from "./path-marketplace.ts";
import { runCommandPayloads, startSession } from "./pi-commands.ts";
import { PiProcess } from "./pi-process.ts";
import { rpcChildEnvironment } from "./pi-rpc.ts";
import { within } from "./subagent-hook-session.ts";
import { harnessDirectory, isRunning } from "./turn-records.ts";

import type { Companion } from "./companions.ts";
import type { HookRun } from "./hook-recorder.ts";
import type { McpProfile } from "./mcp-implementation.ts";
import type { RpcGitEnvironment, RpcRequest, RpcSandbox } from "./pi-process.ts";
import type { IncomingMessage, ServerResponse } from "node:http";

/** The bound of each start: the provider, a Pi, or the main Pi's settling. */
const READY_TIMEOUT_MS = 30_000;

/** The bound of a child, from its launch to its end. */
const CHILD_TIMEOUT_MS = 90_000;

/** The bound of a whole run, its fixture and its release included. */
export const FIXTURE_TIMEOUT_MS = 180_000;

const POLL_MS = 100;

// How long the main Pi must run no turn, while the provider gets no request,
// to count as settled after a child's notice.
const QUIET_MS = 1_500;

// How long a process of the fixture may take to exit after its Pi stopped.
const EXIT_TIMEOUT_MS = 10_000;

// The provider the fixture's Pis select, its one model, and its dummy key.
const PROVIDER = "pg3-loopback";
const MODEL = "scripted";
const DUMMY_KEY = "pg3-dummy-key";

const MARKETPLACE = "fixtures";
const PLUGIN = "demo";
const MCP_SERVER = "stub";

/** The stub MCP server's tool, by the name a Claude agent grants it. */
const MCP_TOOL = `mcp__plugin_${PLUGIN}_${MCP_SERVER}__echo`;

/** The marker of the main Pi's prompt that runs a tool in the main session. */
const MAIN_CONTROL_PROMPT = "[pg3-main-control]";

/** The first marker of a text: a bracketed token, read whole. */
const MARKER_PATTERN = /\[pg3-[^\]]+\]/u;

const DETACHED_STATES: ReadonlySet<string> = new Set([
  "complete",
  "failed",
  "interrupted",
  "timed_out",
  "stopped",
]);

const EXTENSION_ENTRY = path.join(
  fileURLToPath(new URL("../..", import.meta.url)),
  "extensions",
  "pi-claude-marketplace",
  "index.ts",
);

// Every hook event, each recording its runs. The Stop hook asks a main
// session for one more turn, so a child that ran it would not end (D-PG3-08).
const HOOKS = [
  ["name", "event", "matcher", "form", "on reentry", "output"],
  ["start", "SessionStart", "", "", "", ""],
  ["prompt", "UserPromptSubmit", "", "", "", ""],
  ["before", "PreToolUse", "*", "", "", ""],
  ["after", "PostToolUse", "*", "", "", ""],
  ["failure", "PostToolUseFailure", "*", "", "", ""],
  ["stop", "Stop", "", "script", "allow", '{"decision":"block","reason":"keep going"}'],
  ["stop-error", "StopFailure", "", "", "", ""],
  ["pre-compact", "PreCompact", "*", "", "", ""],
  ["post-compact", "PostCompact", "*", "", "", ""],
  ["ending", "SessionEnd", "", "", "", ""],
] as const;

/** One tool call the scripted provider asks for. */
export interface ScriptedToolCall {
  readonly tool: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

/**
 * An agent of the plugin `demo`: its name, the frontmatter lines after its
 * name and description, such as `background` or `tools`, its body, and the
 * tool calls its child makes.
 */
export interface RealChildAgent {
  readonly name: string;
  readonly frontmatter: readonly (readonly [string, string])[];
  readonly body: string;
  readonly calls: readonly ScriptedToolCall[];
}

/** What every run installs and how it configures pi-subagents. */
export interface RealChildFixtureOptions {
  readonly mcpProfile: McpProfile;
  /** pi-subagents' `asyncByDefault`, written to its configuration when set. */
  readonly asyncByDefault?: boolean;
  /** A directory that holds the compile cache of every Pi of the run. */
  readonly compileCache?: string;
  /** Receives the run's idempotent release before anything starts. */
  readonly register?: (release: () => Promise<void>) => void;
}

/** What `runRealSubagentChild` installs and launches. */
export interface RealChildOptions extends RealChildFixtureOptions {
  readonly agents: readonly RealChildAgent[];
}

/** One child session of the concurrent runner and how pi-subagents tags its prompt. */
export interface ConcurrentChildLaunch {
  /** The agent name pi-subagents launches the child as. */
  readonly agent: string;
  readonly mode: "append" | "replace";
  /** The agent's body, which pi-subagents puts after its tag. */
  readonly body: string;
  /** A fork cache key, as pi-subagents gives a forked child. */
  readonly forkCacheKey?: string;
  /** The tool calls the child makes on each prompt. */
  readonly calls: readonly ScriptedToolCall[];
}

/** What `runConcurrentRealSubagentChildren` runs. */
export interface ConcurrentChildrenOptions extends RealChildFixtureOptions {
  /** The sessions of each generation, started at once; each generation follows the last one's disposal. */
  readonly generations: readonly (readonly ConcurrentChildLaunch[])[];
  /** How many times the sessions of a generation are prompted, all at once each time. */
  readonly rounds: number;
}

/** The versions of what a run executed. */
export interface RealChildVersions {
  readonly node: string;
  readonly piSubagents: string;
  readonly mcpAdapter?: string;
}

/** What pi-subagents reported about the child of one agent. */
export interface DetachedChildObservation {
  /** The agent pi-subagents recorded that it ran, not the one the run asked for. */
  readonly agent: string | undefined;
  /** How pi-subagents ran it: in its detached runner, or in the main Pi's turn. */
  readonly mode: "background" | "foreground";
  readonly state: string | undefined;
  /** The pid of the runner process that hosted the child. */
  readonly pid: number | undefined;
  /** The id of the child's Pi session, from the header of its session file. */
  readonly sessionId: string | undefined;
  /** The child's session file, as pi-subagents recorded it, absent when it recorded none. */
  readonly sessionFile?: string;
}

/** What the concurrent runner reported about one child session. */
export interface ConcurrentSessionObservation {
  readonly agent: string;
  readonly sessionId: string;
  /** The session's file, absent for a session that keeps no file. */
  readonly sessionFile?: string;
  readonly pid: number;
}

/** What every run observed of its main Pi, its hooks, and its provider. */
export interface MainObservation {
  readonly versions: RealChildVersions;
  /** The id of the main Pi's session after the install's new session. */
  readonly mainSessionId: string;
  /** That session's file, as Pi reports it. */
  readonly mainSessionFile: string;
  /** Every hook run, in the order the hook processes appended them. */
  readonly hookRuns: readonly HookRun[];
  /** The last user text of each provider request, in arrival order. */
  readonly providerPrompts: readonly string[];
  /** The model each provider request named, once each, in order of first use. */
  readonly providerModels: readonly (string | undefined)[];
}

/** What one run of `runRealSubagentChild` observed. */
export interface RealChildObservation extends MainObservation {
  readonly children: readonly DetachedChildObservation[];
}

/** What one run of `runConcurrentRealSubagentChildren` observed. */
export interface ConcurrentChildrenObservation extends MainObservation {
  /** The sessions of each generation, in launch order. */
  readonly generations: readonly (readonly ConcurrentSessionObservation[])[];
}

interface ProviderMessage {
  readonly role?: unknown;
  readonly content?: unknown;
}

interface ProviderRequestBody {
  readonly model?: string;
  readonly messages?: readonly ProviderMessage[];
  readonly tools?: readonly { readonly function?: { readonly name?: string } }[];
}

interface ProviderRequest {
  readonly model: string | undefined;
  readonly lastUserText: string;
  readonly tools: readonly string[];
}

interface ScriptedProvider {
  readonly baseUrl: string;
  readonly requests: readonly ProviderRequest[];
  close(): Promise<void>;
}

interface Fixture {
  readonly root: string;
  readonly sandbox: RpcSandbox;
  readonly git: RpcGitEnvironment;
  readonly temporaryDirectory: string;
  readonly harness: string;
  readonly marketplace: string;
}

function isTextPart(part: unknown): part is { readonly type: "text"; readonly text: string } {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    part.type === "text" &&
    "text" in part &&
    typeof part.text === "string"
  );
}

// The index of the last user message of `messages`, or -1.
function lastUserIndex(messages: readonly ProviderMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return index;
    }
  }

  return -1;
}

function messageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  return Array.isArray(content)
    ? content
        .filter(isTextPart)
        .map((part) => part.text)
        .join("\n")
    : "";
}

// The step for `messages`: of the script whose marker is the first marker of
// the last user text, the one at the number of tool results after that text.
function scriptedStep(
  script: ReadonlyMap<string, readonly ScriptedToolCall[]>,
  messages: readonly ProviderMessage[],
): ScriptedToolCall | undefined {
  const userAt = lastUserIndex(messages);
  const marker = MARKER_PATTERN.exec(messageText(messages[userAt]?.content))?.[0];
  const steps = marker === undefined ? undefined : script.get(marker);
  const index = messages.slice(userAt + 1).filter((message) => message.role === "tool").length;
  return steps?.[index];
}

function streamChunk(model: string, delta: unknown, finish: string | null): string {
  const body = {
    id: "scripted",
    object: "chat.completion.chunk",
    created: 0,
    model,
    choices: [{ index: 0, delta, finish_reason: finish }],
    ...(finish === null
      ? {}
      : { usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }),
  };
  return `data: ${JSON.stringify(body)}\n\n`;
}

function answer(
  response: ServerResponse,
  model: string,
  step: ScriptedToolCall | undefined,
  callNumber: number,
): void {
  response.writeHead(200, { "content-type": "text/event-stream" });
  if (step === undefined) {
    response.write(streamChunk(model, { role: "assistant", content: "Done." }, null));
    response.write(streamChunk(model, {}, "stop"));
  } else {
    const call = {
      index: 0,
      id: `call_${callNumber}`,
      type: "function",
      function: { name: step.tool, arguments: JSON.stringify(step.arguments) },
    };
    response.write(streamChunk(model, { role: "assistant", tool_calls: [call] }, null));
    response.write(streamChunk(model, {}, "tool_calls"));
  }

  response.end("data: [DONE]\n\n");
}

// Starts the scripted provider on a free loopback port.
async function startProvider(
  script: ReadonlyMap<string, readonly ScriptedToolCall[]>,
): Promise<ScriptedProvider> {
  const requests: ProviderRequest[] = [];
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const parts: Buffer[] = [];
    request.on("data", (part: Buffer) => parts.push(part));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(parts).toString("utf8")) as ProviderRequestBody;
      const messages = body.messages ?? [];
      const userAt = lastUserIndex(messages);
      requests.push({
        model: body.model,
        lastUserText: messageText(messages[userAt]?.content),
        tools: (body.tools ?? []).map((tool) => tool.function?.name ?? ""),
      });
      if (body.model !== MODEL) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: `no model ${String(body.model)}` } }));
        return;
      }

      answer(response, MODEL, scriptedStep(script, messages), requests.length);
    });
  });
  server.listen(0, "127.0.0.1");
  await within(once(server, "listening"), READY_TIMEOUT_MS, "the provider's listen");
  const address = server.address();
  assert.ok(address !== null && typeof address === "object", "the provider bound no port");
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    requests,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    },
  };
}

/** The marker of the main Pi's prompt that launches the agent `agent`. */
function launchMarker(agent: string): string {
  return `[pg3-launch-${agent}]`;
}

/** The marker of the task that the child of `agent` gets. */
function taskMarker(agent: string): string {
  return `[pg3-task-${agent}]`;
}

function agentText(agent: RealChildAgent): string {
  const lines = [
    `name: ${agent.name}`,
    `description: Runs the tools its task names.`,
    ...agent.frontmatter.map(([key, value]) => `${key}: ${value}`),
  ];
  return `---\n${lines.join("\n")}\n---\n${agent.body}\n`;
}

// Writes the fixture of one run: its directories, the trusted project, the
// marketplace with the plugin, and pi-subagents' configuration.
async function createFixture(
  root: string,
  options: RealChildFixtureOptions,
  agents: readonly RealChildAgent[],
): Promise<Fixture> {
  const home = path.join(root, "home");
  const agentDir = path.join(home, ".pi", "agent");
  const cwd = path.join(root, "project");
  const temporaryDirectory = path.join(home, "tmp");
  const harness = harnessDirectory(home);
  for (const directory of [agentDir, cwd, temporaryDirectory, harness]) {
    await mkdir(directory, { recursive: true });
  }

  if (options.compileCache !== undefined) {
    await symlink(options.compileCache, path.join(temporaryDirectory, "jiti"));
  }

  const certificates = path.join(root, "no-extra-certificates.pem");
  await writeFile(certificates, "");
  await writeFile(path.join(agentDir, "trust.json"), `${JSON.stringify({ [cwd]: true })}\n`);
  const marketplace = path.join(home, "marketplaces", MARKETPLACE);
  const manifestPath = path.join(marketplace, ".claude-plugin", "marketplace.json");
  await writeMarketplace(
    marketplace,
    MARKETPLACE,
    [{ name: PLUGIN, version: "1.0.0" }],
    manifestPath,
  );
  const published = { kind: "dir", root: marketplace, source: marketplace, manifestPath } as const;
  await publishRecordingHooks(published, PLUGIN, parseRecordingHooks(HOOKS));
  await publishStubMcpServer(published, { plugin: PLUGIN, server: MCP_SERVER });
  const agentsDir = path.join(marketplace, "plugins", PLUGIN, "agents");
  await mkdir(agentsDir, { recursive: true });
  for (const agent of agents) {
    await writeFile(path.join(agentsDir, `${agent.name}.md`), agentText(agent));
  }

  if (options.asyncByDefault !== undefined) {
    const config = path.join(agentDir, "extensions", "subagent", "config.json");
    await mkdir(path.dirname(config), { recursive: true });
    await writeFile(config, `${JSON.stringify({ asyncByDefault: options.asyncByDefault })}\n`);
  }

  return {
    root,
    sandbox: { home, agentDir, cwd },
    git: {
      NODE_EXTRA_CA_CERTS: certificates,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: path.join(home, ".gitconfig"),
    },
    temporaryDirectory,
    harness,
    marketplace,
  };
}

// The user's Pi configuration: the provider with its model, and the
// extensions every Pi of the user loads, a child session included.
async function writePiConfiguration(
  agentDir: string,
  baseUrl: string,
  ambient: readonly string[],
): Promise<void> {
  const models = {
    providers: {
      [PROVIDER]: {
        baseUrl,
        api: "openai-completions",
        apiKey: DUMMY_KEY,
        models: [{ id: MODEL }],
      },
    },
  };
  const settings = { defaultProvider: PROVIDER, defaultModel: MODEL, extensions: ambient };
  await writeFile(path.join(agentDir, "models.json"), `${JSON.stringify(models)}\n`);
  await writeFile(path.join(agentDir, "settings.json"), `${JSON.stringify(settings)}\n`);
}

async function expectSuccess(
  pi: PiProcess,
  request: RpcRequest,
): Promise<Readonly<Record<string, unknown>>> {
  const { response } = await pi.request(request);
  assert.strictEqual(response.success, true, JSON.stringify(response));
  return response;
}

// Waits until `check` returns a value, reading again every `POLL_MS`, and
// fails with `what` after `timeoutMs`.
async function poll<T>(
  check: () => Promise<T | undefined>,
  timeoutMs: number,
  what: string,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value !== undefined) {
      return value;
    }

    assert.ok(Date.now() < deadline, `${what} within ${timeoutMs} ms`);
    await delay(POLL_MS);
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function readOptional(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error: unknown) {
    if (isMissing(error) || (error instanceof Error && "code" in error && error.code === "ESRCH")) {
      return undefined;
    }

    throw error;
  }
}

async function readHookRuns(harness: string): Promise<readonly HookRun[]> {
  const text = (await readOptional(path.join(harness, HOOK_RUNS_LOG))) ?? "";
  return text
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as HookRun);
}

// The pids of the processes that run with `home` as their HOME: the
// fixture's runners, MCP servers, and hook scripts. Linux names a process's
// environment in `/proc`.
async function processesWithHome(home: string): Promise<readonly number[]> {
  assert.strictEqual(process.platform, "linux", "a fixture's processes are found through /proc");
  const pids = (await readdir("/proc")).filter((name) => /^\d+$/u.test(name)).map(Number);
  const owned: number[] = [];
  for (const pid of pids) {
    const environment = await readOptional(`/proc/${pid}/environ`).catch(() => undefined);
    if (environment?.split("\0").includes(`HOME=${home}`) === true && pid !== process.pid) {
      owned.push(pid);
    }
  }

  return owned;
}

function kill(pid: number): void {
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // The process already exited.
  }
}

// Waits for the fixture's processes to exit after the main Pi stopped, kills
// each one that outlives `EXIT_TIMEOUT_MS`, and waits for those to exit.
async function stopOwnedProcesses(home: string): Promise<void> {
  const deadline = Date.now() + EXIT_TIMEOUT_MS;
  let running = await processesWithHome(home);
  while (running.length > 0 && Date.now() < deadline) {
    await delay(POLL_MS);
    running = await processesWithHome(home);
  }

  for (const pid of running) {
    kill(pid);
  }

  await poll(
    async () => ((await processesWithHome(home)).length === 0 ? true : undefined),
    EXIT_TIMEOUT_MS,
    "every process of the fixture exited",
  );
}

/** A main Pi with the plugin installed, in a fixture of its own, and its release. */
interface MainRun {
  readonly fixture: Fixture;
  readonly provider: ScriptedProvider;
  readonly pi: PiProcess;
  readonly versions: RealChildVersions;
  readonly mainSession: MainSession;
  readonly subagents: Companion;
}

/** The main Pi's session after the install's new session. */
interface MainSession {
  readonly id: string;
  readonly file: string;
}

// The scripts of the provider: each agent's launch and task, and the main
// control's bash call.
function providerScript(
  launches: readonly { readonly agent: string; readonly calls: readonly ScriptedToolCall[] }[],
): ReadonlyMap<string, readonly ScriptedToolCall[]> {
  return new Map([
    [MAIN_CONTROL_PROMPT, [{ tool: "bash", arguments: { command: "echo from-main" } }]],
    ...launches.flatMap(({ agent, calls }) => [
      [
        launchMarker(agent),
        [{ tool: "subagent", arguments: { agent, task: `${taskMarker(agent)}: run the tools.` } }],
      ] as const,
      [taskMarker(agent), calls] as const,
    ]),
  ]);
}

// Builds the fixture, starts the provider and a main Pi, installs the plugin
// in the user scope, and starts a new session, so the session holds the
// plugin's hooks and agents. Runs `body` with the main run, and releases
// everything once, whatever `body` does.
async function withMainRun<T>(
  options: RealChildFixtureOptions,
  agents: readonly RealChildAgent[],
  script: ReadonlyMap<string, readonly ScriptedToolCall[]>,
  body: (run: MainRun) => Promise<T>,
): Promise<T> {
  const subagents = await resolveCompanion("pi-subagents");
  const adapter =
    options.mcpProfile === "adapter" ? await resolveCompanion("pi-mcp-adapter") : undefined;
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "pi-cm-features-real-child-")));
  let provider: ScriptedProvider | undefined = undefined;
  let pi: PiProcess | undefined = undefined;
  let released: Promise<void> | undefined = undefined;
  const release = (): Promise<void> => {
    released ??= (async () => {
      try {
        await pi?.stop();
        await provider?.close();
        await stopOwnedProcesses(path.join(root, "home"));
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    })();
    return released;
  };

  options.register?.(release);
  try {
    const fixture = await createFixture(root, options, agents);
    provider = await startProvider(script);
    await writePiConfiguration(fixture.sandbox.agentDir, provider.baseUrl, [
      EXTENSION_ENTRY,
      ...(adapter === undefined ? [] : [adapter.entry]),
    ]);
    if (adapter !== undefined) {
      await writeAdapterOnboardingSeed(fixture.sandbox.agentDir, adapter.version);
    }

    pi = await PiProcess.start(fixture.sandbox, fixture.git, {
      extensions: [subagents.entry, ...(adapter === undefined ? [] : [adapter.entry])],
      environment: { TMPDIR: fixture.temporaryDirectory },
      session: { kind: "saved" },
    });
    const mainSession = await installPlugin(pi, fixture);
    return await body({
      fixture,
      provider,
      pi,
      mainSession,
      subagents,
      versions: {
        node: process.version,
        piSubagents: subagents.version,
        ...(adapter === undefined ? {} : { mcpAdapter: adapter.version }),
      },
    });
  } finally {
    await release();
  }
}

// Installs the plugin through `/claude:plugin` and starts a new session,
// returning that session's id and file, which must lie in the fixture.
async function installPlugin(pi: PiProcess, fixture: Fixture): Promise<MainSession> {
  await expectSuccess(pi, { type: "set_model", provider: PROVIDER, modelId: MODEL });
  for (const command of [
    `/claude:plugin marketplace add ${fixture.marketplace} --scope user`,
    `/claude:plugin install ${PLUGIN}@${MARKETPLACE} --scope user`,
  ]) {
    const severities = (await runCommandPayloads(pi, command)).map(({ severity }) => severity);
    assert.ok(!severities.includes("error"), `${command} failed: ${severities.join(", ")}`);
  }

  await startSession(pi);
  await expectSuccess(pi, { type: "set_model", provider: PROVIDER, modelId: MODEL });
  const state = await expectSuccess(pi, { type: "get_state" });
  const data = state.data as
    { readonly sessionId?: unknown; readonly sessionFile?: unknown } | undefined;
  assert.ok(typeof data?.sessionId === "string", JSON.stringify(state));
  assert.ok(typeof data.sessionFile === "string", JSON.stringify(state));
  assert.ok(
    data.sessionFile.startsWith(`${fixture.root}${path.sep}`),
    `the main session file ${data.sessionFile} lies outside the fixture`,
  );
  return { id: data.sessionId, file: data.sessionFile };
}

// Prompts the main Pi with `prompt` and waits for the main Pi to settle:
// to run no turn while the provider gets no request for `QUIET_MS`. A
// background child's notice and the main Stop hook each start a turn.
async function promptMain(run: MainRun, prompt: string, timeoutMs: number): Promise<number> {
  const from = run.pi.recordCount();
  await expectSuccess(run.pi, { type: "prompt", message: prompt });
  await run.pi.waitForRecord(from, (record) => record.type === "agent_settled", timeoutMs);
  return from;
}

async function settleMainPi(run: MainRun): Promise<void> {
  let seen = run.provider.requests.length;
  let quietSince = Date.now();
  await poll(
    () => {
      if (!run.pi.idle || run.provider.requests.length !== seen) {
        seen = run.provider.requests.length;
        quietSince = Date.now();
      }

      return Promise.resolve(Date.now() - quietSince >= QUIET_MS ? true : undefined);
    },
    CHILD_TIMEOUT_MS,
    "the main Pi settled",
  );
}

// The id in the header line of the Pi session file `file`.
async function sessionIdOf(file: string): Promise<string | undefined> {
  const [header = "{}"] = (await readFile(file, "utf8")).split("\n");
  const parsed = JSON.parse(header) as { readonly type?: unknown; readonly id?: unknown };
  return parsed.type === "session" && typeof parsed.id === "string" ? parsed.id : undefined;
}

// The agent a step of pi-subagents' status, or a result of its tool, names.
function recordedAgent(step: unknown): string | undefined {
  return typeof step === "object" &&
    step !== null &&
    "agent" in step &&
    typeof step.agent === "string"
    ? step.agent
    : undefined;
}

// Reads a detached child's status until it ends, then waits for its runner
// to exit, and returns what pi-subagents recorded of it.
async function detachedChild(agent: string, asyncDir: string): Promise<DetachedChildObservation> {
  const status = await poll(
    async () => {
      const text = await readOptional(path.join(asyncDir, "status.json"));
      const read = text === undefined ? undefined : (JSON.parse(text) as Record<string, unknown>);
      return DETACHED_STATES.has(String(read?.state)) ? read : undefined;
    },
    CHILD_TIMEOUT_MS,
    `the detached child of ${agent} ended`,
  );
  const pid = typeof status.pid === "number" ? status.pid : undefined;
  if (pid !== undefined) {
    await poll(
      () => Promise.resolve(isRunning(pid) ? undefined : true),
      READY_TIMEOUT_MS,
      `the runner of ${agent} (pid ${pid}) exited`,
    );
  }

  const steps = Array.isArray(status.steps) ? (status.steps as Record<string, unknown>[]) : [];
  const sessionFile = steps[0]?.sessionFile;
  return {
    agent: recordedAgent(steps[0]),
    mode: "background",
    state: String(status.state),
    pid,
    sessionId: typeof sessionFile === "string" ? await sessionIdOf(sessionFile) : undefined,
    ...(typeof sessionFile === "string" ? { sessionFile } : {}),
  };
}

// Has the main Pi's model call `subagent` for `agent`, and returns what
// pi-subagents reported of the child once the main Pi settled. A foreground
// child's agent is the one the tool result names.
async function launchChild(run: MainRun, agent: string): Promise<DetachedChildObservation> {
  const from = await promptMain(run, launchMarker(agent), CHILD_TIMEOUT_MS);
  const launched = run.pi
    .recordsSince(from)
    .find((record) => record.type === "tool_execution_end" && record.toolName === "subagent");
  const result = launched?.result as { readonly details?: Record<string, unknown> } | undefined;
  const asyncDir = result?.details?.asyncDir;
  const results = result?.details?.results;
  const child =
    typeof asyncDir === "string"
      ? await detachedChild(agent, asyncDir)
      : {
          agent: recordedAgent(Array.isArray(results) ? (results[0] as unknown) : undefined),
          mode: "foreground" as const,
          state: undefined,
          pid: undefined,
          sessionId: undefined,
        };
  await settleMainPi(run);
  return child;
}

async function observeMain(run: MainRun): Promise<MainObservation> {
  return {
    versions: run.versions,
    mainSessionId: run.mainSession.id,
    mainSessionFile: run.mainSession.file,
    hookRuns: await readHookRuns(run.fixture.harness),
    providerPrompts: run.provider.requests.map(({ lastUserText }) => lastUserText),
    providerModels: [...new Set(run.provider.requests.map(({ model }) => model))],
  };
}

/**
 * Installs the agents of `options`, runs a bash call in the main session,
 * then has the main Pi launch the child of each agent in turn, and returns
 * what pi-subagents and the hooks recorded.
 */
export async function runRealSubagentChild(
  options: RealChildOptions,
): Promise<RealChildObservation> {
  const launches = options.agents.map((agent) => ({
    agent: `${PLUGIN}:${agent.name}`,
    calls: agent.calls,
  }));
  return withMainRun(options, options.agents, providerScript(launches), async (run) => {
    await promptMain(run, MAIN_CONTROL_PROMPT, READY_TIMEOUT_MS);
    await settleMainPi(run);
    const children: DetachedChildObservation[] = [];
    for (const { agent } of launches) {
      children.push(await launchChild(run, agent));
    }

    return { ...(await observeMain(run)), children };
  });
}

// The runner: builds each session of a generation through pi-subagents'
// launch module and session factory, as its background runner builds a
// child, prompts the sessions at once, round after round, disposes them, and
// starts the next generation. It prints one JSON line with its pid and each
// session's agent and id.
const CONCURRENT_RUNNER = `
const config = JSON.parse(process.env.PG3_CONCURRENT_CONFIG);
const { buildInProcessChildLaunch } = await import(config.launchModule);
const { createDefaultChildSessionFactory } = await import(config.sessionModule);
const factory = createDefaultChildSessionFactory();
const generations = [];
try {
  for (const generation of config.generations) {
    const sessions = await Promise.all(generation.map(async (child, childIndex) => {
      const built = buildInProcessChildLaunch({
        host: "runner", cwd: config.cwd, childAgentName: child.agent, childIndex,
        sessionEnabled: false, inheritProjectContext: false, inheritGlobalContext: false,
        inheritSkills: false, requiredExtensions: [], systemPrompt: child.body,
        systemPromptMode: child.mode,
        ...(child.forkCacheKey === undefined ? {} : { forkCacheKey: child.forkCacheKey }),
      });
      return { child, session: await factory.create(built.session) };
    }));
    for (let round = 0; round < config.rounds; round += 1) {
      await Promise.all(sessions.map(({ child, session }) => session.prompt(child.task)));
    }
    generations.push(sessions.map(({ child, session }) => ({
      agent: child.agent, sessionId: session.sessionId,
      ...(session.sessionFile === undefined ? {} : { sessionFile: session.sessionFile }),
      pid: process.pid,
    })));
    await Promise.all(sessions.map(({ session }) => session.dispose()));
  }
} finally {
  await factory.dispose();
}
process.stdout.write(JSON.stringify({ generations }) + "\\n");
`;

function isSessionObservation(value: unknown): value is ConcurrentSessionObservation {
  return (
    typeof value === "object" &&
    value !== null &&
    "agent" in value &&
    typeof value.agent === "string" &&
    "sessionId" in value &&
    typeof value.sessionId === "string" &&
    (!("sessionFile" in value) || typeof value.sessionFile === "string") &&
    "pid" in value &&
    typeof value.pid === "number"
  );
}

// Runs the concurrent runner in the fixture and returns the sessions it reported.
async function runConcurrentRunner(
  run: MainRun,
  options: ConcurrentChildrenOptions,
): Promise<readonly (readonly ConcurrentSessionObservation[])[]> {
  const shared = path.join(run.subagents.root, "src", "runs", "shared");
  const config = {
    launchModule: path.join(shared, "child-launch.js"),
    sessionModule: path.join(shared, "child-session.js"),
    cwd: run.fixture.sandbox.cwd,
    rounds: options.rounds,
    generations: options.generations.map((generation) =>
      generation.map(({ calls: _calls, ...child }) => ({
        ...child,
        task: `${taskMarker(child.agent)}: run the tools.`,
      })),
    ),
  };
  const runner = spawn(process.execPath, ["--input-type=module", "-e", CONCURRENT_RUNNER], {
    cwd: run.fixture.sandbox.cwd,
    detached: true,
    env: {
      ...rpcChildEnvironment(run.fixture.sandbox, run.fixture.git, {
        TMPDIR: run.fixture.temporaryDirectory,
        PI_SUBAGENT_CHILD: "1",
      }),
      PG3_CONCURRENT_CONFIG: JSON.stringify(config),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  runner.stdout.setEncoding("utf8").on("data", (text: string) => (stdout += text));
  runner.stderr.setEncoding("utf8").on("data", (text: string) => (stderr += text));
  const exit = once(runner, "exit") as Promise<[number | null, NodeJS.Signals | null]>;
  let ended: [number | null, NodeJS.Signals | null];
  try {
    ended = await within(exit, CHILD_TIMEOUT_MS, "the concurrent runner");
  } catch (error: unknown) {
    // Without a pid the spawn failed, and a negative zero would signal this process's own group.
    if (runner.pid !== undefined) {
      kill(-runner.pid);
      await exit.catch(() => undefined);
    }

    throw new Error(`the concurrent runner did not end: ${stderr}`, { cause: error });
  }

  assert.deepStrictEqual(ended, [0, null], `the concurrent runner failed: ${stderr}`);
  const [line = "{}"] = stdout.trim().split("\n").slice(-1);
  const reported = (JSON.parse(line) as { readonly generations?: unknown }).generations;
  assert.ok(
    Array.isArray(reported) &&
      reported.every(
        (generation) => Array.isArray(generation) && generation.every(isSessionObservation),
      ),
    `the concurrent runner reported no sessions: ${line}`,
  );
  return reported;
}

/**
 * Runs a bash call in the main session, then starts the concurrent runner
 * with the generations of `options`, and returns what the runner and the
 * hooks recorded.
 */
export async function runConcurrentRealSubagentChildren(
  options: ConcurrentChildrenOptions,
): Promise<ConcurrentChildrenObservation> {
  const launches = options.generations.flat();
  return withMainRun(options, [], providerScript(launches), async (run) => {
    await promptMain(run, MAIN_CONTROL_PROMPT, READY_TIMEOUT_MS);
    await settleMainPi(run);
    const generations = await runConcurrentRunner(run, options);
    return { ...(await observeMain(run)), generations };
  });
}

// The tool calls a table cell names, by the name a step uses for each.
const NAMED_CALLS: Readonly<Record<string, ScriptedToolCall>> = {
  bash: { tool: "bash", arguments: { command: "echo from-child" } },
  "failing read": { tool: "read", arguments: { path: "missing.txt" } },
  "stub mcp tool": { tool: MCP_TOOL, arguments: { text: "pg3" } },
};

function namedCalls(cell: string): ScriptedToolCall[] {
  return cell.split(",").map((name) => {
    const call = NAMED_CALLS[name.trim()];
    if (call === undefined) {
      throw new Error(
        `no tool call is named ${name}; expected ${Object.keys(NAMED_CALLS).join(", ")}`,
      );
    }

    return call;
  });
}

// The rows of a table as records of its columns, throwing when the header is
// not `columns` in that order.
function tableRecords(
  rows: readonly (readonly string[])[],
  columns: readonly string[],
): Readonly<Record<string, string>>[] {
  const [header = [], ...body] = rows;
  assert.deepStrictEqual(header, columns, "the table's columns");
  assert.notStrictEqual(body.length, 0, "the table names no row");
  return body.map((row) =>
    Object.fromEntries(columns.map((column, index) => [column, row[index] ?? ""])),
  );
}

/**
 * Reads an agents table with the columns `name`, `background`, `tools`, and
 * `tool calls`: an empty `background` or `tools` cell leaves that line out of
 * the agent's frontmatter, and `tool calls` names the calls its child makes,
 * from `bash`, `failing read`, and `stub mcp tool`, separated by commas.
 */
export function parseRealChildAgents(rows: readonly (readonly string[])[]): RealChildAgent[] {
  return tableRecords(rows, ["name", "background", "tools", "tool calls"]).map((row) => ({
    name: row.name ?? "",
    frontmatter: (["background", "tools"] as const).flatMap((key) => {
      const value = row[key] ?? "";
      return value === "" ? [] : [[key, value] as const];
    }),
    body: "Run the tools the task names.",
    calls: namedCalls(row["tool calls"] ?? ""),
  }));
}

/**
 * Reads a child sessions table with the columns `agent`, `mode` (`append` or
 * `replace`), `body`, and `tool calls`, named as `parseRealChildAgents`
 * names them.
 */
export function parseConcurrentLaunches(
  rows: readonly (readonly string[])[],
): ConcurrentChildLaunch[] {
  return tableRecords(rows, ["agent", "mode", "body", "tool calls"]).map((row) => {
    const mode = row.mode;
    if (mode !== "append" && mode !== "replace") {
      throw new Error(`a child session's mode is append or replace, not ${String(mode)}`);
    }

    return {
      agent: row.agent ?? "",
      mode,
      body: row.body ?? "",
      calls: namedCalls(row["tool calls"] ?? ""),
    };
  });
}

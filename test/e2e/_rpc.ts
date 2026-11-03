// The reusable real-Pi RPC driver. It spawns the repository's own Pi CLI in
// `--mode rpc` inside a disposable sandbox, always loads the real extension
// with `--extension`, writes one JSONL step at a time, and collects the
// responses, notifies, custom entries, dialogs and extension errors Pi prints
// on stdout. In RPC mode the extension appends each `/claude:plugin` result as
// a `claude-plugin` custom entry instead of calling `ctx.ui.notify`, and Pi
// streams every entry appended after startup as an `entry_appended` record
// (JOUT-01). Notifies still carry what other extensions print.
//
// The child environment is an allowlist built from scratch. A prompt that is
// not an extension command falls through to Pi's model path, and inherited
// provider credentials would let it reach a real provider over the network.
// The cucumber run adds a typed git and trust environment, plus the background
// update delay for a scenario's own Pi, and nothing else. A scenario's profile
// Pi (D-CF1-15) also loads the scripted model and the companions after the
// real extension, and gets a typed `TMPDIR` inside the sandbox home, so the
// temporary files of Pi and its companions stay in the sandbox (HAR-05). The
// shell's `TMPDIR` is never inherited.
// `--no-extensions` is never passed, because it also removes `builtin:mcp`.
import { spawn } from "node:child_process";
import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { resolvePiRuntime } from "../pi-runtime.ts";

import type { ChildProcess, ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const EXTENSION_ENTRY = path.join(REPO_ROOT, "extensions", "pi-claude-marketplace", "index.ts");
const DEFAULT_HARD_STOP_MS = 60_000;
const DIALOG_METHODS: ReadonlySet<string> = new Set(["select", "confirm", "input", "editor"]);

/** One JSONL command written to Pi's stdin; `id` pairs it with its response. */
export type RpcStep =
  | { readonly id: string; readonly type: "get_commands" }
  | { readonly id: string; readonly type: "prompt"; readonly message: string };

/** The disposable locations one Pi child runs in. */
export interface RpcSandbox {
  readonly home: string;
  readonly agentDir: string;
  readonly cwd: string;
}

/**
 * The trust and git settings the cucumber run adds to Pi's allowlist: the CA
 * file of its loopback git host, and git config that skips the system file and
 * reads a global file under the sandbox HOME (DRV-03, HOST-01). The run also
 * points the GitHub base override at its git host, so GitHub sources clone
 * from it (GHB-01, D-MF-01).
 */
export interface RpcGitEnvironment {
  readonly NODE_EXTRA_CA_CERTS: string;
  readonly GIT_CONFIG_NOSYSTEM: "1";
  readonly GIT_CONFIG_GLOBAL: string;
  readonly PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: string;
  /**
   * The maximum delay of the background update, set only for a scenario's own
   * Pi (D-PL8-09). The run's shared Pi never sets it, so its background update
   * keeps the ten-minute maximum and a new session cancels it.
   */
  readonly PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS?: string;
}

/** The one variable a profile Pi adds to the allowlist: its temporary directory (HAR-05). */
export interface RpcProfileEnvironment {
  readonly TMPDIR: string;
}

/**
 * What a scenario's profile Pi adds to the run's Pi (D-CF1-15): the
 * extensions it loads after the real one, in load order, and its temporary
 * directory.
 */
export interface RpcProfile {
  /** Absolute paths of the extensions loaded after the real one, in this order. */
  readonly extensions: readonly string[];
  readonly environment: RpcProfileEnvironment;
}

/** What one RPC session runs: the sandbox, the steps in order, and extra extensions. */
export interface RpcSessionOptions {
  readonly sandbox: RpcSandbox;
  readonly steps: readonly RpcStep[];
  /** Absolute paths of extensions loaded beside the real one. */
  readonly extraExtensions?: readonly string[];
  /** Milliseconds before the child's process group is killed with SIGKILL. */
  readonly hardStopMs?: number;
  /** Kills the child's process group on abort, for example the test's `t.signal`. */
  readonly signal?: AbortSignal;
}

/** One notify Pi forwarded; `after` is the id of the step in flight when it arrived. */
export interface RpcNotify {
  readonly after: string;
  readonly message: string;
  /** Absent for info notifies, as Pi omits the field. */
  readonly notifyType: string | undefined;
}

/** One custom entry Pi streamed; `after` is the id of the step in flight when it arrived. */
export interface RpcEntry {
  readonly after: string;
  readonly customType: string;
  readonly data: unknown;
}

/** One parsed stdout record, read only through narrowing. */
export type RpcResponseRecord = Readonly<Record<string, unknown>>;

/** Everything one RPC session observed, keyed by step id where a step owns it. */
export interface RpcSessionResult {
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly stderr: string;
  readonly responses: ReadonlyMap<string, RpcResponseRecord>;
  readonly notifies: readonly RpcNotify[];
  readonly entries: readonly RpcEntry[];
  readonly dialogs: readonly string[];
  readonly extensionErrors: readonly string[];
}

interface SessionState {
  readonly child: ChildProcessByStdio<Writable, Readable, Readable>;
  readonly steps: readonly RpcStep[];
  inFlight: number;
  lastSentId: string;
  stderr: string;
  timedOut: boolean;
  readonly responses: Map<string, RpcResponseRecord>;
  readonly notifies: RpcNotify[];
  readonly entries: RpcEntry[];
  readonly dialogs: string[];
  readonly extensionErrors: string[];
}

function isRecord(value: unknown): value is RpcResponseRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: RpcResponseRecord, key: string): string | undefined {
  const field = record[key];
  return typeof field === "string" ? field : undefined;
}

function parseLine(line: string): RpcResponseRecord | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    // A line that is not JSON is not an RPC record.
    return undefined;
  }

  return isRecord(parsed) ? parsed : undefined;
}

function isInside(resolved: string, root: string): boolean {
  return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}

async function resolveLocation(location: string): Promise<string> {
  try {
    return await realpath(location);
  } catch (error: unknown) {
    throw new Error(`runRpcSession: sandbox location ${location} does not exist`, {
      cause: error,
    });
  }
}

// The real HOME, agent dir and project must stay out of the child's reach.
// Pi reads and writes project state under `<cwd>/.pi/`, so `cwd` is checked
// too. Each location is compared by its realpath, so a symlink under the temp
// directory that points elsewhere fails the check. The resolved paths are the
// ones the child receives, so nothing can swap a location after the check.
// Pi asks for project trust in every directory under the repository, and the
// session cancels every dialog, so a location there is refused by name.
export async function resolveRpcSandbox(sandbox: RpcSandbox): Promise<RpcSandbox> {
  const repoRoot = await realpath(REPO_ROOT);
  const tmpRoot = await realpath(tmpdir());
  const resolve = async (location: string): Promise<string> => {
    const resolved = await resolveLocation(location);
    if (isInside(resolved, repoRoot)) {
      throw new Error(
        `runRpcSession: sandbox location ${location} is inside the repository ${repoRoot}, ` +
          "where Pi asks for project trust; point TMPDIR outside the repository",
      );
    }

    if (!resolved.startsWith(`${tmpRoot}${path.sep}`)) {
      throw new Error(`runRpcSession: sandbox location ${location} is outside ${tmpRoot}`);
    }

    return resolved;
  };

  return {
    home: await resolve(sandbox.home),
    agentDir: await resolve(sandbox.agentDir),
    cwd: await resolve(sandbox.cwd),
  };
}

/**
 * Returns the allowlist environment of every Pi child, plus `git` and the
 * profile's `TMPDIR` when given.
 */
export function rpcChildEnvironment(
  sandbox: RpcSandbox,
  git?: RpcGitEnvironment,
  profileEnvironment?: RpcProfileEnvironment,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    HOME: sandbox.home,
    PI_CODING_AGENT_DIR: sandbox.agentDir,
    PI_OFFLINE: "1",
    PATH: process.env.PATH ?? "",
  };
  if (git !== undefined) {
    environment.NODE_EXTRA_CA_CERTS = git.NODE_EXTRA_CA_CERTS;
    environment.GIT_CONFIG_NOSYSTEM = git.GIT_CONFIG_NOSYSTEM;
    environment.GIT_CONFIG_GLOBAL = git.GIT_CONFIG_GLOBAL;
    environment.PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL = git.PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL;
    if (git.PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS !== undefined) {
      environment.PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS =
        git.PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS;
    }
  }

  if (profileEnvironment !== undefined) {
    environment.TMPDIR = profileEnvironment.TMPDIR;
  }

  return environment;
}

export function piArguments(
  mode: "rpc" | "tui",
  extraExtensions: readonly string[] = [],
): string[] {
  const extensions = [EXTENSION_ENTRY, ...extraExtensions];
  return [
    resolvePiRuntime(REPO_ROOT).cliPath,
    ...(mode === "rpc" ? ["--mode", "rpc"] : []),
    "--offline",
    "--no-session",
    ...extensions.flatMap((extension) => ["--extension", extension]),
  ];
}

function writeRecord(state: SessionState, record: RpcStep | RpcResponseRecord): void {
  state.child.stdin.write(`${JSON.stringify(record)}\n`);
}

// Writes the step in flight, or closes stdin after the last one so Pi exits 0.
function advance(state: SessionState): void {
  const step = state.steps[state.inFlight];
  if (step === undefined) {
    state.child.stdin.end();
    return;
  }

  state.lastSentId = step.id;
  writeRecord(state, step);
}

function handleResponse(state: SessionState, record: RpcResponseRecord): void {
  const step = state.steps[state.inFlight];
  if (step === undefined || record.id !== step.id) {
    return;
  }

  state.responses.set(step.id, record);
  state.inFlight += 1;
  advance(state);
}

// Dialogs are recorded and cancelled so a prompt can never wait on a human.
function handleUiRequest(state: SessionState, record: RpcResponseRecord): void {
  const method = stringField(record, "method");
  if (method === "notify") {
    state.notifies.push({
      after: state.lastSentId,
      message: stringField(record, "message") ?? "",
      notifyType: stringField(record, "notifyType"),
    });
    return;
  }

  if (method !== undefined && DIALOG_METHODS.has(method)) {
    state.dialogs.push(method);
    writeRecord(state, { type: "extension_ui_response", id: record.id, cancelled: true });
  }
}

function handleEntry(state: SessionState, record: RpcResponseRecord): void {
  const entry = record.entry;
  if (!isRecord(entry) || entry.type !== "custom") {
    return;
  }

  state.entries.push({
    after: state.lastSentId,
    customType: stringField(entry, "customType") ?? "",
    data: entry.data,
  });
}

function handleLine(state: SessionState, line: string): void {
  const record = parseLine(line);
  if (record === undefined) {
    return;
  }

  switch (record.type) {
    case "response":
      handleResponse(state, record);
      break;
    case "extension_ui_request":
      handleUiRequest(state, record);
      break;
    case "entry_appended":
      handleEntry(state, record);
      break;
    case "extension_error":
      state.extensionErrors.push(stringField(record, "error") ?? line);
      break;
    default:
      break;
  }
}

function resultOf(state: SessionState, exitCode: number | null): RpcSessionResult {
  return {
    exitCode,
    timedOut: state.timedOut,
    stderr: state.stderr,
    responses: state.responses,
    notifies: state.notifies,
    entries: state.entries,
    dialogs: state.dialogs,
    extensionErrors: state.extensionErrors,
  };
}

// Pi runs in its own process group, so one SIGKILL to the group also reaches
// the children Pi starts in that group. Pi starts each stdio MCP server in a
// group of its own and stops it on shutdown, so the group kill does not reach
// those servers.
export function killProcessGroup(child: ChildProcess): void {
  if (child.pid === undefined) {
    child.kill("SIGKILL");
    return;
  }

  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    // The group has already exited.
  }
}

// Arms the hard stop and the caller's abort signal; returns their disposer.
function armStops(state: SessionState, options: RpcSessionOptions): () => void {
  const stop = (): void => {
    killProcessGroup(state.child);
  };

  const hardStop = setTimeout(() => {
    state.timedOut = true;
    stop();
  }, options.hardStopMs ?? DEFAULT_HARD_STOP_MS);
  hardStop.unref();
  options.signal?.addEventListener("abort", stop, { once: true });
  return () => {
    clearTimeout(hardStop);
    options.signal?.removeEventListener("abort", stop);
  };
}

function collect(state: SessionState, options: RpcSessionOptions): Promise<RpcSessionResult> {
  return new Promise((resolve) => {
    const { child } = state;
    const disarmStops = armStops(state, options);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      state.stderr += chunk;
    });
    child.on("error", (error) => {
      state.stderr += `\nspawn: ${error.message}`;
    });
    child.stdin.on("error", (error) => {
      state.stderr += `\nstdin: ${error.message}`;
    });
    createInterface({ input: child.stdout }).on("line", (line) => {
      handleLine(state, line);
    });
    // A child Pi leaves running in its group would outlive a clean exit in
    // that detached group, or hold Pi's stdio open until the hard stop. One
    // group kill on exit sweeps it before `close`.
    child.on("exit", () => {
      killProcessGroup(child);
    });
    child.on("close", (code) => {
      disarmStops();
      resolve(resultOf(state, code));
    });
    advance(state);
  });
}

function spawnPi(
  sandbox: RpcSandbox,
  extraExtensions: readonly string[],
  git?: RpcGitEnvironment,
  profileEnvironment?: RpcProfileEnvironment,
): ChildProcessByStdio<Writable, Readable, Readable> {
  return spawn(process.execPath, piArguments("rpc", extraExtensions), {
    cwd: sandbox.cwd,
    // Its own process group, so the stops can kill Pi's children too. A dead
    // parent closes stdin, and Pi exits on that.
    detached: true,
    env: rpcChildEnvironment(sandbox, git, profileEnvironment),
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function startSession(options: RpcSessionOptions, sandbox: RpcSandbox): SessionState {
  const child = spawnPi(sandbox, options.extraExtensions ?? []);
  return {
    child,
    steps: options.steps,
    inFlight: 0,
    lastSentId: "",
    stderr: "",
    timedOut: false,
    responses: new Map(),
    notifies: [],
    entries: [],
    dialogs: [],
    extensionErrors: [],
  };
}

/**
 * Runs the repository's own Pi CLI in RPC mode in `options.sandbox`, sends
 * each step after the previous step's response, and resolves when Pi exits.
 * Rejects before spawning when a sandbox location (HOME, agent dir or cwd)
 * does not exist, when its realpath is inside the repository or outside the
 * realpath of the OS temp directory, or when `options.signal` is already
 * aborted.
 */
export async function runRpcSession(options: RpcSessionOptions): Promise<RpcSessionResult> {
  const sandbox = await resolveRpcSandbox(options.sandbox);
  options.signal?.throwIfAborted();
  return collect(startSession(options, sandbox), options);
}

/**
 * Starts the repository's own Pi CLI in RPC mode in `sandbox` and returns the
 * child, which stays up until its stdin closes. The child also gets `git` on
 * top of the allowlist, and a profile Pi gets the extensions and `TMPDIR` of
 * `profile`. The caller owns the JSONL exchange and the stop. Rejects as
 * `runRpcSession` does for a sandbox location outside the temp directory or
 * inside the repository.
 */
export async function startRpcPi(
  sandbox: RpcSandbox,
  git: RpcGitEnvironment,
  profile?: RpcProfile,
): Promise<ChildProcessByStdio<Writable, Readable, Readable>> {
  return spawnPi(
    await resolveRpcSandbox(sandbox),
    profile?.extensions ?? [],
    git,
    profile?.environment,
  );
}

/** Returns `data.disposition` of a successful prompt response. */
export function promptDisposition(response: RpcResponseRecord | undefined): string | undefined {
  if (response?.success !== true || !isRecord(response.data)) {
    return undefined;
  }

  return stringField(response.data, "disposition");
}

/** One `get_commands` entry: the command name and its `sourceInfo.path`. */
export interface ListedCommand {
  readonly name: string;
  readonly sourcePath: string | undefined;
}

/** Returns every entry of a successful `get_commands` response, in Pi's order. */
export function listedCommands(response: RpcResponseRecord | undefined): readonly ListedCommand[] {
  if (response?.success !== true || !isRecord(response.data)) {
    return [];
  }

  const commands: unknown = response.data.commands;
  if (response.command !== "get_commands" || !Array.isArray(commands)) {
    return [];
  }

  const entries: readonly unknown[] = commands;
  return entries.filter(isRecord).flatMap((command) => {
    const name = stringField(command, "name");
    if (name === undefined) {
      return [];
    }

    const sourcePath = isRecord(command.sourceInfo)
      ? stringField(command.sourceInfo, "path")
      : undefined;
    return [{ name, sourcePath }];
  });
}

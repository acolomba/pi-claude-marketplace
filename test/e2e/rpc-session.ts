// The e2e RPC session runner. It starts the repository's own Pi CLI in
// `--mode rpc` through the driver pieces of `features/lib/pi-rpc.ts`, writes
// one JSONL step at a time, and collects the responses, notifies, custom
// entries, dialogs and extension errors Pi prints on stdout. Only the e2e
// suite runs a whole session this way; the cucumber harness drives its Pi
// through `startRpcPi`, so this runner stays under `test/`.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import {
  killProcessGroup,
  piArguments,
  resolveRpcSandbox,
  rpcChildEnvironment,
} from "../../features/lib/pi-rpc.ts";

import type { RpcResponseRecord, RpcSandbox } from "../../features/lib/pi-rpc.ts";
import type { ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";

const DEFAULT_HARD_STOP_MS = 60_000;
const DIALOG_METHODS: ReadonlySet<string> = new Set(["select", "confirm", "input", "editor"]);

/** One JSONL command written to Pi's stdin; `id` pairs it with its response. */
export type RpcStep =
  | { readonly id: string; readonly type: "get_commands" }
  | { readonly id: string; readonly type: "prompt"; readonly message: string };

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

// The record readers mirror the private ones of `features/lib/pi-rpc.ts`.
function isRecord(value: unknown): value is RpcResponseRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringField(record: RpcResponseRecord, key: string): string | undefined {
  const field: unknown = record[key];
  if (typeof field !== "string") {
    return undefined;
  }

  return field;
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

function startSession(options: RpcSessionOptions, sandbox: RpcSandbox): SessionState {
  const child = spawn(process.execPath, piArguments("rpc", options.extraExtensions ?? []), {
    cwd: sandbox.cwd,
    // Its own process group, so the stops can kill Pi's children too. A dead
    // parent closes stdin, and Pi exits on that.
    detached: true,
    env: rpcChildEnvironment(sandbox),
    stdio: ["pipe", "pipe", "pipe"],
  });
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

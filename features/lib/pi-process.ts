/**
 * @fileoverview A headless Pi in RPC mode: the one long-lived Pi that serves
 * every scenario of a cucumber run, or a Pi that one scenario starts for
 * itself, such as its profile Pi (D-CF1-15).
 *
 * Starting Pi takes most of a second, and a reset takes a tenth of that, so
 * the run starts Pi once and resets it before each scenario. Requests go one
 * at a time: each one collects the custom entries, extension errors, and
 * dialogs Pi prints between the request and its response. Pi runs an
 * extension command to completion before it answers the prompt, so a command's
 * entries always arrive before its response. Dialogs are cancelled, so a
 * request never waits on a human.
 *
 * Every record Pi prints is also kept in an append-only log, in the order Pi
 * printed it, whether or not a request is in flight. A model turn goes on
 * after Pi answers its prompt, so the step that runs one reads the log from
 * the record count before the prompt until `agent_settled` (HAR-03).
 */

import { once } from "node:events";
import { createInterface } from "node:readline";

import { killProcessGroup, startRpcPi } from "../../test/e2e/_rpc.ts";

import type { RpcGitEnvironment, RpcProfile, RpcSandbox } from "../../test/e2e/_rpc.ts";

export type { RpcGitEnvironment, RpcProfile, RpcSandbox };

/** A parsed stdout record, read only through narrowing. */
export type RpcRecord = Readonly<Record<string, unknown>>;

/** One JSONL request; the process assigns its `id`. */
export type RpcRequest = Readonly<{ type: string } & Record<string, unknown>>;

/** One custom entry Pi appended while a request was in flight. */
export interface CustomEntry {
  readonly customType: string;
  readonly data: unknown;
}

/** What one request produced. */
export interface RpcExchange {
  readonly response: Readonly<Record<string, unknown>>;
  readonly entries: readonly CustomEntry[];
  readonly extensionErrors: readonly string[];
  readonly dialogs: readonly string[];
}

interface PendingRequest {
  readonly id: string;
  readonly entries: CustomEntry[];
  readonly extensionErrors: string[];
  readonly dialogs: string[];
  readonly resolve: (exchange: RpcExchange) => void;
  readonly reject: (error: Error) => void;
}

// A caller of `waitForRecord` that no record has satisfied yet.
interface RecordWaiter {
  readonly fromIndex: number;
  readonly matches: (record: RpcRecord) => boolean;
  readonly resolve: (record: RpcRecord) => void;
  readonly reject: (error: Error) => void;
}

type PiChild = Awaited<ReturnType<typeof startRpcPi>>;

const DIALOG_METHODS: ReadonlySet<string> = new Set(["select", "confirm", "input", "editor"]);

// Pi exits within a second of losing stdin; past this the group is killed.
const STOP_GRACE_MS = 5_000;

function isRecord(value: unknown): value is RpcRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: RpcRecord, key: string): string | undefined {
  const field = record[key];
  return typeof field === "string" ? field : undefined;
}

// Pi writes strict JSONL on stdout, but another extension may print a stray line.
function parseLine(line: string): RpcRecord | undefined {
  if (!line.startsWith("{")) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    // A line that is not JSON is not an RPC record.
    return undefined;
  }

  return isRecord(parsed) ? parsed : undefined;
}

/**
 * A headless Pi in RPC mode. Start it with `PiProcess.start`, send requests
 * one at a time with `request`, read what a model turn printed with
 * `recordsSince` and `waitForRecord`, and release it with `stop`.
 */
export class PiProcess {
  private readonly child: PiChild;
  private readonly records: RpcRecord[] = [];
  private readonly waiters = new Set<RecordWaiter>();
  private pending: PendingRequest | undefined = undefined;
  private inTurn = false;
  private nextId = 0;
  private stderr = "";
  private exited = false;
  private stopped = false;

  private constructor(child: PiChild) {
    this.child = child;
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      this.stderr += chunk;
    });
    createInterface({ input: child.stdout }).on("line", (line) => {
      this.handleLine(line);
    });
    // A write after Pi died fails with EPIPE; the exit handler rejects the request.
    child.stdin.on("error", () => undefined);
    child.on("exit", (code, signal) => {
      this.exited = true;
      const error = new Error(`Pi exited (${code ?? signal}):\n${this.stderr}`);
      this.pending?.reject(error);
      this.pending = undefined;
      for (const waiter of this.waiters) {
        waiter.reject(error);
      }

      this.waiters.clear();
    });
  }

  /**
   * Starts Pi in RPC mode in `sandbox` with `git`, with the real extension
   * loaded, and with the extensions and temporary directory of `profile` when
   * a scenario starts its own profile Pi.
   */
  static async start(
    sandbox: RpcSandbox,
    git: RpcGitEnvironment,
    profile?: RpcProfile,
  ): Promise<PiProcess> {
    return new PiProcess(await startRpcPi(sandbox, git, profile));
  }

  /**
   * Whether Pi is up with no request in flight and no model turn running. A
   * scenario that fails or times out mid-request or mid-turn leaves it busy,
   * and its late answer must not reach the next scenario.
   */
  get idle(): boolean {
    return !this.exited && this.pending === undefined && !this.inTurn;
  }

  /** Returns how many records Pi has printed so far. */
  recordCount(): number {
    return this.records.length;
  }

  /** Returns every record Pi printed from `index` on, in the order Pi printed them. */
  recordsSince(index: number): readonly RpcRecord[] {
    return this.records.slice(index);
  }

  /**
   * Resolves with the first record at or after `fromIndex` that `matches`
   * accepts. Each record is checked when it arrives, so nothing polls. Rejects
   * with Pi's stderr when Pi exits, or when `timeoutMs` passes first.
   */
  waitForRecord(
    fromIndex: number,
    matches: (record: RpcRecord) => boolean,
    timeoutMs: number,
  ): Promise<RpcRecord> {
    const found = this.records.slice(fromIndex).find(matches);
    if (found !== undefined) {
      return Promise.resolve(found);
    }

    if (this.exited) {
      return Promise.reject(new Error(`Pi has exited:\n${this.stderr}`));
    }

    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined = undefined;
      const waiter: RecordWaiter = {
        fromIndex,
        matches,
        resolve: (record) => {
          clearTimeout(timer);
          resolve(record);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
      timer = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(new Error(`no matching record within ${timeoutMs} ms:\n${this.stderr}`));
      }, timeoutMs);
      this.waiters.add(waiter);
    });
  }

  /** Sends `request` and resolves with its response and what it produced. */
  request(request: RpcRequest): Promise<RpcExchange> {
    if (this.pending !== undefined) {
      throw new Error(`request ${this.pending.id} is still in flight`);
    }

    if (this.exited) {
      throw new Error(`Pi has exited:\n${this.stderr}`);
    }

    const id = `r${this.nextId++}`;
    return new Promise((resolve, reject) => {
      this.pending = { id, entries: [], extensionErrors: [], dialogs: [], resolve, reject };
      this.write({ ...request, id });
    });
  }

  /**
   * Closes Pi's stdin, waits for it to exit, and kills whatever its group
   * left. A second call does nothing: by then the group id may belong to an
   * unrelated process.
   */
  async stop(): Promise<void> {
    if (this.stopped) {
      return;
    }

    this.stopped = true;
    if (!this.exited) {
      const exit = once(this.child, "exit");
      this.child.stdin.end();
      let timer: NodeJS.Timeout | undefined = undefined;
      const grace = new Promise((resolve) => {
        timer = setTimeout(resolve, STOP_GRACE_MS);
      });
      await Promise.race([exit, grace]);
      clearTimeout(timer);
    }

    killProcessGroup(this.child);
  }

  private write(record: RpcRecord): void {
    this.child.stdin.write(`${JSON.stringify(record)}\n`);
  }

  private handleLine(line: string): void {
    const record = parseLine(line);
    if (record === undefined) {
      return;
    }

    this.records.push(record);
    this.trackTurn(record);
    // A dialog during a model turn arrives outside any request, and Pi waits
    // on it, so every dialog is cancelled.
    if (record.type === "extension_ui_request") {
      this.handleUiRequest(record);
    }

    const pending = this.pending;
    if (pending !== undefined) {
      this.collect(pending, record, line);
    }

    this.notifyWaiters(record);
  }

  private trackTurn(record: RpcRecord): void {
    if (record.type === "agent_start") {
      this.inTurn = true;
    } else if (record.type === "agent_settled") {
      this.inTurn = false;
    }
  }

  private notifyWaiters(record: RpcRecord): void {
    const index = this.records.length - 1;
    for (const waiter of this.waiters) {
      if (index >= waiter.fromIndex && waiter.matches(record)) {
        this.waiters.delete(waiter);
        waiter.resolve(record);
      }
    }
  }

  private collect(pending: PendingRequest, record: RpcRecord, line: string): void {
    switch (record.type) {
      case "response":
        if (record.id === pending.id) {
          this.pending = undefined;
          pending.resolve({ ...pending, response: record });
        }

        break;
      case "extension_ui_request": {
        const method = stringField(record, "method");
        if (method !== undefined && DIALOG_METHODS.has(method)) {
          pending.dialogs.push(method);
        }

        break;
      }

      case "entry_appended":
        if (isRecord(record.entry) && record.entry.type === "custom") {
          pending.entries.push({
            customType: stringField(record.entry, "customType") ?? "",
            data: record.entry.data,
          });
        }

        break;
      case "extension_error":
        pending.extensionErrors.push(stringField(record, "error") ?? line);
        break;
      default:
        break;
    }
  }

  private handleUiRequest(record: RpcRecord): void {
    const method = stringField(record, "method");
    if (method !== undefined && DIALOG_METHODS.has(method)) {
      this.write({ type: "extension_ui_response", id: record.id, cancelled: true });
    }
  }
}

/**
 * @fileoverview A bounded real-terminal driver for one production Pi TUI session.
 *
 * The Python bridge owns only the pseudoterminal. This module owns sandbox
 * validation, the allowlisted environment, terminal output, and process-group
 * cleanup. It deliberately does not parse the RPC JSON protocol.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  killProcessGroup,
  piArguments,
  resolveRpcSandbox,
  rpcChildEnvironment,
} from "../../test/e2e/_rpc.ts";

import type { RpcGitEnvironment, RpcSandbox } from "../../test/e2e/_rpc.ts";
import type { ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";

const PTY_BRIDGE = fileURLToPath(new URL("./pi-tui-pty.py", import.meta.url));
const READY_PREFIX = "PI_TUI_PTY_READY";
const DEFAULT_READY_MS = 15_000;
const DEFAULT_STOP_MS = 5_000;

export interface PiTuiOptions {
  readonly sandbox: RpcSandbox;
  readonly git: RpcGitEnvironment;
  readonly signal?: AbortSignal;
  readonly readyMs?: number;
  readonly stopMs?: number;
}

export interface PiTuiReadiness {
  readonly isatty: boolean;
  readonly ready: boolean;
}

type TuiChild = ChildProcessByStdio<Writable, Readable, Readable>;

function controlSequenceEnd(text: string, start: number): number {
  for (let index = start; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 0x40 && code <= 0x7e) {
      return index;
    }
  }

  return text.length;
}

function operatingSystemCommandEnd(text: string, start: number): number {
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === "\u0007") {
      return index;
    }

    if (text[index] === "\u001b" && text[index + 1] === "\\") {
      return index + 1;
    }
  }

  return text.length;
}

function escapeEnd(text: string, start: number): number {
  switch (text[start + 1]) {
    case "[":
      return controlSequenceEnd(text, start + 2);
    case "]":
      return operatingSystemCommandEnd(text, start + 2);
    case undefined:
      return start;
    default:
      return start + 1;
  }
}

function isVisibleTerminalCharacter(character: string): boolean {
  return character === "\n" || character === "\t" || character >= " ";
}

function removeTerminalControls(text: string): string {
  let plain = "";
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? "";
    if (character === "\u001b") {
      index = escapeEnd(text, index);
    } else if (isVisibleTerminalCharacter(character)) {
      plain += character;
    }
  }

  return plain;
}

/** One Pi TUI whose stdio is a real pseudoterminal. */
export class PiTuiSession {
  private readonly child: TuiChild;
  private readonly stopMs: number;
  private output = "";
  private bridgeOutput = "";
  private bridgeReady = false;
  private exited = false;
  private released = false;
  private readonly changes = new Set<() => void>();

  private constructor(child: TuiChild, stopMs: number, signal: AbortSignal | undefined) {
    this.child = child;
    this.stopMs = stopMs;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      this.output += chunk;
      this.changed();
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      this.bridgeOutput += chunk;
      if (this.bridgeOutput.includes(`${READY_PREFIX} `)) {
        this.bridgeReady = this.bridgeOutput.includes("isatty=true");
      }

      this.changed();
    });
    child.on("error", (error) => {
      this.bridgeOutput += `\nspawn: ${error.message}`;
      this.changed();
    });
    child.stdin.on("error", () => undefined);
    child.on("close", () => {
      this.exited = true;
      this.changed();
    });
    signal?.addEventListener(
      "abort",
      () => {
        this.stopNow();
      },
      { once: true },
    );
  }

  /** Spawns the bridge after applying the RPC harness's containment checks. */
  static async start(options: PiTuiOptions): Promise<PiTuiSession> {
    const sandbox = await resolveRpcSandbox(options.sandbox);

    options.signal?.throwIfAborted();
    const child = spawn("python3", [PTY_BRIDGE, "--", process.execPath, ...piArguments("tui")], {
      cwd: sandbox.cwd,
      detached: true,
      env: rpcChildEnvironment(sandbox, options.git),
      stdio: ["pipe", "pipe", "pipe"],
    });
    return new PiTuiSession(child, options.stopMs ?? DEFAULT_STOP_MS, options.signal);
  }

  /** Waits for an interactive slave and the first rendered TUI screen. */
  async waitUntilReady(readyMs: number = DEFAULT_READY_MS): Promise<PiTuiReadiness> {
    await this.waitFor(
      () => this.bridgeReady && removeTerminalControls(this.output).trim().length > 0,
      readyMs,
      "Pi TUI readiness",
    );
    return this.readiness;
  }

  /** The child-terminal and rendered-screen readiness observed so far. */
  get readiness(): PiTuiReadiness {
    return {
      isatty: this.bridgeReady,
      ready: removeTerminalControls(this.output).trim().length > 0,
    };
  }

  /** Terminal text with control sequences removed for user-visible assertions. */
  get text(): string {
    return removeTerminalControls(this.output);
  }

  /** Types one line into the TUI. */
  sendLine(line: string): void {
    if (this.exited) {
      throw new Error(`Pi TUI exited before input:\n${this.diagnostics()}`);
    }

    this.child.stdin.write(`${line}\r`);
  }

  /** Waits until the normalized terminal contains `text`. */
  async waitForText(text: string, timeoutMs: number): Promise<void> {
    await this.waitFor(() => this.text.includes(text), timeoutMs, `terminal text ${text}`);
  }

  /** Releases the TUI, escalating from its quit key to a process-group kill. */
  async stop(): Promise<void> {
    if (this.released) {
      return;
    }

    this.released = true;
    if (!this.exited) {
      this.child.stdin.write("\u0003\u0003");
      try {
        await this.waitFor(() => this.exited, this.stopMs, "Pi TUI shutdown");
      } catch {
        this.stopNow();
        await this.waitFor(() => this.exited, this.stopMs, "Pi TUI forced shutdown");
      }
    }

    killProcessGroup(this.child);
  }

  private stopNow(): void {
    killProcessGroup(this.child);
  }

  private changed(): void {
    for (const change of [...this.changes]) {
      change();
    }
  }

  private diagnostics(): string {
    return `${this.text}\n${this.bridgeOutput}`.trim();
  }

  private waitFor(condition: () => boolean, timeoutMs: number, description: string): Promise<void> {
    if (condition()) {
      return Promise.resolve();
    }

    if (this.exited) {
      return Promise.reject(
        new Error(`${description} ended with the process:\n${this.diagnostics()}`),
      );
    }

    return new Promise((resolve, reject) => {
      const waiter: { timer?: NodeJS.Timeout; finish: () => void } = {
        finish: () => undefined,
      };
      const cleanup = (): void => {
        clearTimeout(waiter.timer);
        this.changes.delete(waiter.finish);
      };

      waiter.finish = (): void => {
        if (!condition()) {
          if (this.exited) {
            cleanup();
            reject(new Error(`${description} ended with the process:\n${this.diagnostics()}`));
          }

          return;
        }

        cleanup();
        resolve();
      };

      waiter.timer = setTimeout(() => {
        cleanup();
        reject(new Error(`${description} timed out after ${timeoutMs} ms:\n${this.diagnostics()}`));
      }, timeoutMs);

      this.changes.add(waiter.finish);
    });
  }
}

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
const READY_TEXT = "Warning: No models available.";
const DEFAULT_READY_MS = 15_000;
const DEFAULT_STOP_MS = 5_000;

// Pi prints this status once `/reload` has run the session handlers.
const RELOADED_TEXT = "Reloaded keybindings";

// A reload rebuilds the extension runtime in well under this.
const DEFAULT_RELOAD_MS = 20_000;

// The pseudoterminal's size, which `pi-tui-pty.py` sets.
const PTY_ROWS = 40;
const PTY_COLUMNS = 120;

/**
 * What `PiTuiSession.start` needs: the sandbox, the git environment, and the
 * time limits. D-CF2-12: a scenario that profiles the TUI, such as with the
 * scripted model, also passes its extensions, its extra CLI arguments, and the
 * text its first screen shows; every other caller passes none of them.
 */
export interface PiTuiOptions {
  readonly sandbox: RpcSandbox;
  readonly git: RpcGitEnvironment;
  /** Variables added to the child's environment after the allowlisted ones. */
  readonly variables?: Readonly<Record<string, string>>;
  /** Absolute paths of the extensions Pi loads after the real one, in load order. */
  readonly extensions?: readonly string[];
  /** CLI arguments added after the extensions, such as the model to select. */
  readonly arguments?: readonly string[];
  /** The text the first rendered screen shows; `Warning: No models available.` by default. */
  readonly readyText?: string;
  readonly signal?: AbortSignal;
  readonly readyMs?: number;
  readonly stopMs?: number;
}

/** Whether the child terminal is interactive and the TUI has rendered its first screen. */
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

// An operating system command ends with BEL (U+0007) or with ESC (U+001B)
// followed by a backslash.
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

// A screen of `rows` by `columns` cells and its cursor. A character printed
// in the last column leaves the cursor there and wraps before the next one,
// as a terminal does.
class ScreenModel {
  private readonly rows: number;
  private readonly columns: number;
  private readonly cells: string[][];
  private row = 0;
  private column = 0;
  private wrapPending = false;

  constructor(rows: number, columns: number) {
    this.rows = rows;
    this.columns = columns;
    this.cells = Array.from({ length: rows }, () => this.blankRow());
  }

  print(character: string): void {
    if (this.wrapPending) {
      this.column = 0;
      this.lineFeed();
    }

    const cells = this.cells[this.row];
    if (cells !== undefined) {
      cells[this.column] = character;
    }

    this.wrapPending = this.column === this.columns - 1;
    this.column = Math.min(this.column + 1, this.columns - 1);
  }

  carriageReturn(): void {
    this.moveTo(this.row, 0);
  }

  lineFeed(): void {
    this.wrapPending = false;
    if (this.row < this.rows - 1) {
      this.row += 1;
      return;
    }

    this.cells.shift();
    this.cells.push(this.blankRow());
  }

  // Applies one control sequence: its parameter text and its final byte.
  controlSequence(parameters: string, final: string): void {
    if (/^[<=>?]/u.test(parameters)) {
      return;
    }

    const [first = 0, second = 0] = parameters.split(";").map(Number);
    const count = Math.max(first, 1);
    switch (final) {
      case "A":
        this.moveTo(this.row - count, this.column);
        break;
      case "B":
        this.moveTo(this.row + count, this.column);
        break;
      case "C":
        this.moveTo(this.row, this.column + count);
        break;
      case "D":
        this.moveTo(this.row, this.column - count);
        break;
      case "G":
        this.moveTo(this.row, count - 1);
        break;
      case "H":
      case "f":
        this.moveTo(count - 1, Math.max(second, 1) - 1);
        break;
      case "J":
        this.eraseDisplay(first);
        break;
      case "K":
        this.eraseLine(this.row, first);
        break;
      default:
        break;
    }
  }

  lines(): string[] {
    return this.cells.map((cells) => cells.join("").replace(/ +$/u, ""));
  }

  private moveTo(row: number, column: number): void {
    this.row = Math.min(Math.max(row, 0), this.rows - 1);
    this.column = Math.min(Math.max(column, 0), this.columns - 1);
    this.wrapPending = false;
  }

  // Erases below the cursor (mode 0), above it (mode 1), or the whole screen
  // (mode 2). Mode 3 erases only the scrollback, which the model does not
  // keep, so it leaves the screen as it is.
  private eraseDisplay(mode: number): void {
    if (mode === 2) {
      this.cells.splice(0, this.rows, ...Array.from({ length: this.rows }, () => this.blankRow()));
      return;
    }

    if (mode !== 0 && mode !== 1) {
      return;
    }

    const [from, to] = mode === 1 ? [0, this.row - 1] : [this.row + 1, this.rows - 1];

    for (let row = from; row <= to; row += 1) {
      this.cells[row] = this.blankRow();
    }

    this.eraseLine(this.row, mode);
  }

  // Erases from the cursor to the end of `row` (mode 0), from its start to the
  // cursor (mode 1), or all of it (mode 2).
  private eraseLine(row: number, mode: number): void {
    const cells = this.cells[row];
    if (cells === undefined) {
      return;
    }

    const from = mode === 0 ? this.column : 0;
    const to = mode === 1 ? this.column : this.columns - 1;
    cells.fill(" ", from, to + 1);
  }

  private blankRow(): string[] {
    return Array.from({ length: this.columns }, () => " ");
  }
}

// Whether a terminal prints `character` in a cell: not a C0 control, DEL, or
// a C1 control (U+0080 to U+009F).
function isPrintable(character: string): boolean {
  return character >= " " && !(character >= "\u007f" && character <= "\u009f");
}

// Replays the escape sequence at `start` on `screen` and returns the index
// after it. An operating system command, an application program command, and
// a device control string end as an operating system command does.
function replayEscape(screen: ScreenModel, text: string, start: number): number {
  switch (text[start + 1]) {
    case "[": {
      const end = controlSequenceEnd(text, start + 2);
      screen.controlSequence(text.slice(start + 2, end), text[end] ?? "");
      return end + 1;
    }

    case "]":
    case "_":
    case "P":
    case "^":
      return operatingSystemCommandEnd(text, start + 2) + 1;
    case undefined:
      return start + 1;
    default:
      return start + 2;
  }
}

/**
 * Returns the screen that `output` leaves on a terminal of `rows` by
 * `columns`, one string per row with its trailing spaces removed. It replays
 * printable text, carriage return, line feed (which scrolls on the last row),
 * cursor movement (`A`, `B`, `C`, `D`, `G`, `H`, `f`), and erase in display
 * and in line (`J`, `K`), where an erase of the scrollback (`3J`) leaves the
 * screen as it is; it drops every other control sequence, control character
 * (C0, DEL, and C1), and command. Each code point takes one column, so a row a redraw rewrote
 * reads as its last value.
 */
// fallow-ignore-next-line unused-export -- test/architecture/pi-tui-screen.test.ts pins the screen model.
export function terminalScreen(output: string, rows: number, columns: number): string[] {
  const screen = new ScreenModel(rows, columns);
  let index = 0;
  while (index < output.length) {
    const character = String.fromCodePoint(output.codePointAt(index) ?? 0);
    if (character === "\u001b") {
      index = replayEscape(screen, output, index);
      continue;
    }

    if (character === "\r") {
      screen.carriageReturn();
    } else if (character === "\n") {
      screen.lineFeed();
    } else if (isPrintable(character)) {
      screen.print(character);
    }

    index += character.length;
  }

  return screen.lines();
}

/**
 * Returns distinct notice texts from terminal output, not emission counts.
 * Redraws and separate identical emissions can write the same text. Aggregate
 * scenarios must use distinct plugin names to detect separate notices.
 */
export function backgroundUpdateNoticeTexts(terminalOutput: string): readonly string[] {
  const notices =
    removeTerminalControls(terminalOutput).match(
      /Plugins? updated: .*? · Run \/reload to apply/g,
    ) ?? [];
  return [...new Set(notices)];
}

/** One Pi TUI whose stdio is a real pseudoterminal. */
export class PiTuiSession {
  private readonly child: TuiChild;
  private readonly stopMs: number;
  private readonly readyText: string;
  private output = "";
  private bridgeOutput = "";
  private bridgeReady = false;
  private exited = false;
  private released = false;
  private readonly changes = new Set<() => void>();

  private constructor(
    child: TuiChild,
    stopMs: number,
    readyText: string,
    signal: AbortSignal | undefined,
  ) {
    this.child = child;
    this.stopMs = stopMs;
    this.readyText = readyText;
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
    const piCommand = [
      process.execPath,
      ...piArguments("tui", options.extensions),
      ...(options.arguments ?? []),
    ];
    const child = spawn("python3", [PTY_BRIDGE, "--", ...piCommand], {
      cwd: sandbox.cwd,
      detached: true,
      env: { ...rpcChildEnvironment(sandbox, options.git), ...options.variables },
      stdio: ["pipe", "pipe", "pipe"],
    });
    return new PiTuiSession(
      child,
      options.stopMs ?? DEFAULT_STOP_MS,
      options.readyText ?? READY_TEXT,
      options.signal,
    );
  }

  /** Waits for an interactive slave and the first rendered TUI screen. */
  async waitUntilReady(readyMs = DEFAULT_READY_MS): Promise<PiTuiReadiness> {
    await this.waitFor(() => this.bridgeReady && this.tuiRendered(), readyMs, "Pi TUI readiness");
    return this.readiness;
  }

  /** The child-terminal and rendered-screen readiness observed so far. */
  get readiness(): PiTuiReadiness {
    return {
      isatty: this.bridgeReady,
      ready: this.tuiRendered(),
    };
  }

  /** Terminal text with control sequences removed for user-visible assertions. */
  get text(): string {
    return removeTerminalControls(this.output);
  }

  /** The terminal's current screen, one string per row with its trailing spaces removed. */
  screenLines(): readonly string[] {
    return terminalScreen(this.output, PTY_ROWS, PTY_COLUMNS);
  }

  /** Types one line into the TUI. */
  sendLine(line: string): void {
    this.typeText(`${line}\r`);
  }

  /** Types `text` into the TUI as keystrokes, with no Enter after it, such as a Tab. */
  typeText(text: string): void {
    if (this.exited) {
      throw new Error(`Pi TUI exited before input:\n${this.diagnostics()}`);
    }

    this.child.stdin.write(text);
  }

  /** Waits until the normalized terminal contains `text`. */
  async waitForText(text: string, timeoutMs: number): Promise<void> {
    await this.waitFor(() => this.text.includes(text), timeoutMs, `terminal text ${text}`);
  }

  /** Waits until `condition` holds for the terminal's current screen. */
  async waitForScreen(
    condition: (lines: readonly string[]) => boolean,
    timeoutMs: number,
    description: string,
  ): Promise<void> {
    await this.waitFor(() => condition(this.screenLines()), timeoutMs, description);
  }

  /**
   * Types `/reload` and waits until Pi reports the reload done, which it does
   * only after the new extensions' `session_start` and `resources_discover`
   * handlers ran.
   */
  async reload(timeoutMs = DEFAULT_RELOAD_MS): Promise<void> {
    const mark = this.markOutput();
    this.sendLine("/reload");
    await this.waitForTextAfter(RELOADED_TEXT, mark, timeoutMs);
  }

  /** Marks the current raw terminal position for a later event-driven wait. */
  markOutput(): number {
    return this.output.length;
  }

  /** Returns the terminal text written after `mark`, with control sequences removed. */
  textAfter(mark: number): string {
    return removeTerminalControls(this.output.slice(mark));
  }

  /** Waits until terminal output written after `mark` contains `text`. */
  async waitForTextAfter(text: string, mark: number, timeoutMs: number): Promise<void> {
    await this.waitFor(
      () => this.textAfter(mark).includes(text),
      timeoutMs,
      `terminal text ${text}`,
    );
  }

  /** Waits for terminal output to stay unchanged for `quietMs`, within `timeoutMs`. */
  waitForQuiet(quietMs: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const waiter: {
        quiet?: NodeJS.Timeout;
        hardStop?: NodeJS.Timeout;
        changed: () => void;
        finish: () => void;
      } = { changed: () => undefined, finish: () => undefined };
      const cleanup = (): void => {
        clearTimeout(waiter.quiet);
        clearTimeout(waiter.hardStop);
        this.changes.delete(waiter.changed);
      };

      waiter.finish = (): void => {
        cleanup();
        resolve();
      };

      waiter.changed = (): void => {
        clearTimeout(waiter.quiet);
        waiter.quiet = setTimeout(waiter.finish, quietMs);
      };

      waiter.quiet = setTimeout(waiter.finish, quietMs);
      waiter.hardStop = setTimeout(() => {
        cleanup();
        reject(
          new Error(`Pi TUI output did not settle after ${timeoutMs} ms:\n${this.diagnostics()}`),
        );
      }, timeoutMs);

      this.changes.add(waiter.changed);
    });
  }

  /** Releases the TUI, escalating from its quit key to a process-group kill. */
  async stop(): Promise<void> {
    if (this.released) {
      return;
    }

    this.released = true;
    if (!this.exited) {
      // Two Ctrl-C (U+0003) keystrokes are Pi's quit key.
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

  private tuiRendered(): boolean {
    const text = removeTerminalControls(this.output);
    return text.includes(this.readyText) && !text.includes("Invalid mode");
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

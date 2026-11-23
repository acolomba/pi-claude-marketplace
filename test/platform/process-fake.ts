import type { RunningProcess } from "../../extensions/pi-claude-marketplace/platform/process-run.ts";

/** What a case holds to drive one fake process and read what it received. */
export interface ProcessControl {
  readonly process: RunningProcess;
  /** Emits `close` with `code`. */
  close(code: number | null): void;
  /** Emits `error`; like Node's EventEmitter, throws when nothing listens. */
  fail(error: Error): void;
  /** The signals `kill` received, in order. */
  kills(): readonly string[];
  writeStderr(text: string | Buffer): void;
  writeStdout(text: string | Buffer): void;
}

interface Listeners<T> {
  readonly add: (listener: (value: T) => void) => void;
  readonly count: () => number;
  readonly emit: (value: T) => void;
}

function listeners<T>(): Listeners<T> {
  const registered: Array<(value: T) => void> = [];
  return {
    add: (listener) => {
      registered.push(listener);
    },
    count: () => registered.length,
    emit: (value) => {
      for (const listener of registered) {
        listener(value);
      }
    },
  };
}

function chunkOf(text: string | Buffer): Buffer {
  return typeof text === "string" ? Buffer.from(text) : text;
}

/**
 * A fake process for the launcher tests (`platform/process-run.ts` and the
 * runners over it). `pid` is absent for a process that did not start, as in
 * Node. The case emits the output, the errors, and the close; the fake records
 * the signals the launcher sends to the process alone.
 */
export function createProcessFake(pid?: number): ProcessControl {
  const stdout = listeners<Buffer>();
  const stderr = listeners<Buffer>();
  const errors = listeners<Error>();
  const closes = listeners<number | null>();
  const signals: string[] = [];
  return {
    process: {
      pid,
      stdout: {
        on: (_event, listener) => {
          stdout.add(listener);
        },
      },
      stderr: {
        on: (_event, listener) => {
          stderr.add(listener);
        },
      },
      on: (event, listener) => {
        if (event === "error") {
          errors.add(listener as (error: Error) => void);
          return;
        }

        closes.add(listener as (code: number | null) => void);
      },
      kill: (signal) => signals.push(signal) > 0,
    },
    close: closes.emit,
    fail: (error) => {
      if (errors.count() === 0) {
        throw error;
      }

      errors.emit(error);
    },
    kills: () => [...signals],
    writeStderr: (text) => {
      stderr.emit(chunkOf(text));
    },
    writeStdout: (text) => {
      stdout.emit(chunkOf(text));
    },
  };
}

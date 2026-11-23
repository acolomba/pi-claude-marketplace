import type {
  ProcessSpawn,
  ProcessSpawnOptions,
  RunningProcess,
} from "../../extensions/pi-claude-marketplace/platform/process-run.ts";

/** One launch the fake's `spawn` received. */
export type ProcessLaunch = readonly [string, readonly string[], ProcessSpawnOptions];

/** What a case holds to drive one fake process and read what it received. */
export interface ProcessControl {
  readonly process: RunningProcess;
  /** A launcher that records each launch and returns `process`. */
  readonly spawn: ProcessSpawn;
  /** The launches `spawn` received, in order. */
  launches(): readonly ProcessLaunch[];
  /** Emits `close` with `code`. */
  close(code: number | null): void;
  /** Emits `error`; like Node's EventEmitter, throws when nothing listens. */
  fail(error: Error): void;
  /** Emits `error` on stdin; like Node's EventEmitter, throws when nothing listens. */
  failInput(error: Error): void;
  /** The text written to stdin. */
  input(): string;
  /** Whether stdin was ended. */
  inputEnded(): boolean;
  /** The signals `kill` received, in order. */
  kills(): readonly string[];
  writeStderr(text: string | Buffer): void;
  writeStdout(text: string | Buffer): void;
}

interface Listeners<T> {
  readonly add: (listener: (value: T) => void) => void;
  readonly emit: (value: T) => void;
}

// Like Node's EventEmitter, an `error` that nothing listens for throws.
function listeners<T>(unheard?: (value: T) => never): Listeners<T> {
  const registered: Array<(value: T) => void> = [];
  return {
    add: (listener) => {
      registered.push(listener);
    },
    emit: (value) => {
      if (registered.length === 0 && unheard !== undefined) {
        unheard(value);
      }

      for (const listener of registered) {
        listener(value);
      }
    },
  };
}

function throwError(error: Error): never {
  throw error;
}

function chunkOf(text: string | Buffer): Buffer {
  return typeof text === "string" ? Buffer.from(text) : text;
}

/**
 * A fake process for the launcher tests (`platform/process-run.ts` and the
 * runners over it). `pid` is absent for a process that did not start, as in
 * Node. The case emits the output, the errors, and the close; the fake records
 * each launch, what reached stdin, and the signals the launcher sends to the
 * process alone.
 */
export function createProcessFake(pid?: number): ProcessControl {
  const stdout = listeners<Buffer>();
  const stderr = listeners<Buffer>();
  const errors = listeners<Error>(throwError);
  const inputErrors = listeners<Error>(throwError);
  const closes = listeners<number | null>();
  const signals: string[] = [];
  const launched: ProcessLaunch[] = [];
  const stdin = { text: "", ended: false };
  const process: RunningProcess = {
    pid,
    stdin: {
      on: (_event, listener) => {
        inputErrors.add(listener);
      },
      write: (text) => {
        stdin.text += text;
      },
      end: () => {
        stdin.ended = true;
      },
    },
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
  };
  return {
    process,
    spawn: (command, args, options) => {
      launched.push([command, args, options]);
      return process;
    },
    launches: () => [...launched],
    close: closes.emit,
    fail: errors.emit,
    failInput: inputErrors.emit,
    input: () => stdin.text,
    inputEnded: () => stdin.ended,
    kills: () => [...signals],
    writeStderr: (text) => {
      stderr.emit(chunkOf(text));
    },
    writeStdout: (text) => {
      stdout.emit(chunkOf(text));
    },
  };
}

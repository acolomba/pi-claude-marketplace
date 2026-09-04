import type {
  CredentialProcess,
  CredentialSpawn,
  CredentialSpawnOptions,
} from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";

export type CredentialSubcommand = "fill" | "approve" | "reject";

export interface CredentialProcessControl {
  readonly command: string;
  readonly subcommand: CredentialSubcommand;
  readonly args: readonly string[];
  readonly options: CredentialSpawnOptions;
  close(code: number | null): void;
  fail(error: Error): void;
  failInput(error: Error): void;
  input(): string;
  inputEnded(): boolean;
  terminations(): readonly "SIGTERM"[];
  writeOutput(output: string): void;
}

export interface CredentialProcessFake {
  readonly spawn: CredentialSpawn;
  invocations(): readonly CredentialProcessControl[];
  process(index?: number): CredentialProcessControl;
}

export interface CreateCredentialProcessFakeOptions {
  readonly onInput: (process: CredentialProcessControl) => void;
}

function assertSpawnBoundary(
  command: string,
  args: readonly string[],
  options: CredentialSpawnOptions,
): CredentialSubcommand {
  if (command !== "git") {
    throw new Error(`Unexpected credential command: ${command}`);
  }

  const [credential, subcommand, extra] = args;
  if (
    credential !== "credential" ||
    (subcommand !== "fill" && subcommand !== "approve" && subcommand !== "reject") ||
    extra !== undefined
  ) {
    throw new Error(`Unexpected credential arguments: ${args.join(" ")}`);
  }

  if (
    options.env.GIT_TERMINAL_PROMPT !== "0" ||
    options.env.GCM_INTERACTIVE !== "never" ||
    options.stdio[0] !== "pipe" ||
    options.stdio[1] !== "pipe" ||
    options.stdio[2] !== "pipe"
  ) {
    throw new Error("Credential process was not spawned through the non-interactive pipe boundary");
  }

  return subcommand;
}

export function createCredentialProcessFake({
  onInput,
}: CreateCredentialProcessFakeOptions): CredentialProcessFake {
  const processes: CredentialProcessControl[] = [];

  const spawn: CredentialSpawn = (command, args, options) => {
    const subcommand = assertSpawnBoundary(command, args, options);
    const stdinErrorListeners: Array<(error: Error) => void> = [];
    const stdoutListeners: Array<(chunk: Buffer) => void> = [];
    const errorListeners: Array<(error: Error) => void> = [];
    const closeListeners: Array<(code: number | null) => void> = [];
    const signals: "SIGTERM"[] = [];
    let standardInput = "";
    let ended = false;

    const control: CredentialProcessControl = {
      command,
      subcommand,
      args: [...args],
      options: {
        env: { ...options.env },
        stdio: [...options.stdio],
      },
      close: (code) => {
        for (const listener of closeListeners) {
          listener(code);
        }
      },
      fail: (error) => {
        for (const listener of errorListeners) {
          listener(error);
        }
      },
      failInput: (error) => {
        for (const listener of stdinErrorListeners) {
          listener(error);
        }
      },
      input: () => standardInput,
      inputEnded: () => ended,
      terminations: () => [...signals],
      writeOutput: (output) => {
        const chunk = Buffer.from(output);
        for (const listener of stdoutListeners) {
          listener(chunk);
        }
      },
    };

    const process: CredentialProcess = {
      stdin: {
        on: (_event, listener) => {
          stdinErrorListeners.push(listener);
        },
        write: (input) => {
          standardInput += input;
        },
        end: () => {
          ended = true;
          onInput(control);
        },
      },
      stdout: {
        on: (_event, listener) => {
          stdoutListeners.push(listener);
        },
      },
      kill: (signal) => {
        signals.push(signal);
        return true;
      },
      on: (event, listener) => {
        if (event === "error") {
          errorListeners.push(listener as (error: Error) => void);
        } else {
          closeListeners.push(listener as (code: number | null) => void);
        }
      },
    };

    processes.push(control);
    return process;
  };

  return {
    spawn,
    invocations: () => [...processes],
    process: (index = 0) => {
      const process = processes[index];
      if (process === undefined) {
        throw new Error(`Credential process ${index} has not been spawned`);
      }

      return process;
    },
  };
}

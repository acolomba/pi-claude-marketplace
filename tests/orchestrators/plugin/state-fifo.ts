// A `state.json` served over a POSIX FIFO by a second process, shared by the
// reinstall and uninstall concurrent-removal proofs.
//
// Both proofs need the SAME thing: an orchestrator that reads state.json twice
// -- once unlocked while it resolves the scope, once under the state lock --
// must observe a marketplace that ANOTHER process removed between those two
// reads. The removal has to land after the first read and before the second,
// and a test that merely races the orchestrator (watch the extension root for
// `write-file-atomic`'s temp file, then swap state.json and hope) asserts a
// winner it never actually synchronised. That shape passed locally and lost
// the race on loaded CI runners.
//
// A FIFO turns the ordering into an OS-enforced happens-before. `readFile`
// on a FIFO blocks in `open(O_RDONLY)` until a writer opens, and returns only
// at EOF -- when the writer closes. Each open pairs exactly one reader with
// one writer, so `payloads[0]` is delivered to the first read and
// `payloads[1]` to the second, in that order, whatever the scheduler does.
// Nothing here polls, sleeps, or retries.
//
// Two invariants the callers assert against, both of which turn a silent
// mis-serve into a loud failure:
//   - the server exits 0 only after serving EVERY payload, so `served:N`
//     message count is the orchestrator's exact read count;
//   - the state path is still a FIFO afterwards, so any write by the
//     orchestrator (which would `rename` a regular file over it) is caught.

import { execFileSync, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

/** Watchdog for a reader that never arrives; keeps a regression loud, not hung. */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Serve each payload to one reader, in order, then exit 0. `open(fifoPath,
 * "w")` blocks until a reader opens the FIFO, which is exactly the barrier
 * the callers need -- the loop cannot run ahead of the orchestrator, and the
 * orchestrator cannot run ahead of the loop.
 *
 * The `served:N` acknowledgement is awaited before the next open so the
 * parent's message log stays a faithful record of the read sequence even when
 * two reads land back to back.
 */
const SERVER_SOURCE = `
  import { open } from "node:fs/promises";

  const fifoPath = process.env.PI_CM_FIFO_PATH;
  const payloads = JSON.parse(process.env.PI_CM_FIFO_PAYLOADS);
  let served = 0;

  const watchdog = setTimeout(() => {
    process.stderr.write(
      \`state fifo server timed out having served \${served} of \${payloads.length} payloads\\n\`,
    );
    process.exit(2);
  }, Number(process.env.PI_CM_FIFO_TIMEOUT_MS));

  const announce = (message) =>
    new Promise((resolve) => {
      process.send?.(message, () => {
        resolve();
      });
    });

  await announce("ready");

  for (const payload of payloads) {
    const handle = await open(fifoPath, "w");
    await handle.writeFile(payload);
    await handle.close();
    served += 1;
    await announce(\`served:\${served}\`);
  }

  clearTimeout(watchdog);
  process.disconnect?.();
`;

export interface FifoStateServerExit {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
}

export interface FifoStateServer {
  /** Resolves once the server is armed; rejects if it dies before that. */
  readonly ready: Promise<void>;
  /** Resolves with the server's exit status. `{ code: 0 }` means every payload was served. */
  readonly complete: Promise<FifoStateServerExit>;
  /** `["ready", "served:1", ...]` -- one `served:N` per read the orchestrator performed. */
  readonly messages: readonly unknown[];
  /** Everything the server wrote to stderr; empty on a clean run. */
  stderr(): string;
  /** Best-effort teardown for a test that failed before the server finished. */
  kill(): void;
}

/**
 * `node:test` `skip` value: FIFOs are a POSIX construct and `mkfifo` has no
 * Windows equivalent. CI runs on Linux, so this only guards a local Windows
 * checkout.
 */
export const FIFO_SKIP: string | false =
  process.platform === "win32" ? "requires a POSIX FIFO" : false;

/** Replace the state.json path with a FIFO. The parent directory must exist. */
export function createStateFifo(statePath: string): void {
  execFileSync("mkfifo", [statePath]);
}

/**
 * The exact bytes `saveState` would write for `state`.
 *
 * Routing through the production writer is what keeps a payload BOTH
 * schema-valid and migration-stable: `loadState` persists a normalized copy
 * whenever it had to fill a legacy field, and that write would `rename` a
 * regular file over the FIFO and break every read after it.
 */
export async function serializedStateBytes(state: ExtensionState): Promise<string> {
  const staging = await mkdtemp(path.join(tmpdir(), "state-fifo-payload-"));
  try {
    const extensionRoot = path.join(staging, "pi-claude-marketplace");
    await mkdir(extensionRoot, { recursive: true });
    await saveState(extensionRoot, state);
    return await readFile(path.join(extensionRoot, "state.json"), "utf8");
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

/** Spawn the FIFO server. Await `ready` before invoking the orchestrator. */
export function startFifoStateServer(opts: {
  readonly statePath: string;
  readonly payloads: readonly string[];
  readonly timeoutMs?: number;
}): FifoStateServer {
  const server = spawn(process.execPath, ["--input-type=module", "--eval", SERVER_SOURCE], {
    env: {
      ...process.env,
      PI_CM_FIFO_PATH: opts.statePath,
      PI_CM_FIFO_PAYLOADS: JSON.stringify(opts.payloads),
      PI_CM_FIFO_TIMEOUT_MS: String(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    },
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });

  const stderrStream = server.stderr;
  if (stderrStream === null) {
    throw new Error("state fifo server was spawned without a stderr pipe");
  }

  let stderrText = "";
  stderrStream.setEncoding("utf8");
  stderrStream.on("data", (chunk: string) => {
    stderrText += chunk;
  });

  const messages: unknown[] = [];
  const complete = new Promise<FifoStateServerExit>((resolve, reject) => {
    server.once("error", reject);
    server.once("exit", (code, signal) => {
      resolve({ code, signal });
    });
  });

  // A `reject` after the promise settled is a no-op, so the exit handler below
  // covers "died before readiness" without disturbing the normal path.
  const ready = new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.on("message", (message) => {
      messages.push(message);
      if (message === "ready") {
        resolve();
      }
    });
    server.once("exit", (code) => {
      reject(
        new Error(`state fifo server exited (${String(code)}) before readiness: ${stderrText}`),
      );
    });
  });

  return {
    ready,
    complete,
    messages,
    stderr: (): string => stderrText,
    kill: (): void => {
      if (server.exitCode === null && server.signalCode === null) {
        server.kill("SIGTERM");
      }
    },
  };
}

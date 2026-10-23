/**
 * @fileoverview A stand-in for another process that holds a scope's state lock.
 *
 * The product takes a scope's state lock with proper-lockfile before it
 * changes the scope (D-06). This module takes the same lock with the same
 * options in a child process, as a second Pi would. A step imports it, and
 * it spawns Node on its own file, so one module is both the parent side and
 * the child. The child keeps the lock fresh until its stdin closes. A lock
 * directory made by hand would not do: its mtime goes stale, so the lock
 * reads as free, ten seconds later.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import lockfile from "proper-lockfile";

const READY_LINE = "locked";

// Starting Node and taking one lock takes well under a second; the margin
// covers a loaded CI runner.
const READY_TIMEOUT_MS = 10_000;

// The child releases the lock and exits within milliseconds of losing its
// stdin; a child still running after this is hung.
const EXIT_GRACE_MS = 5_000;

const TIMED_OUT = Symbol("timed out");

const thisFile = fileURLToPath(import.meta.url);

// Resolves with what `promise` resolves with, or with TIMED_OUT once `ms` has passed.
async function within<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: NodeJS.Timeout | undefined = undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(resolve, ms, TIMED_OUT);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Starts a child process that holds the state lock `lockFile` of the scope
 * whose extension root is `extensionRoot`, and resolves once the child holds
 * it. The returned release ends the child's stdin and fails unless the child
 * exits with code 0 and the lock is gone. A child that does not exit in time
 * is killed, and the release fails.
 */
export async function holdStateLock(
  extensionRoot: string,
  lockFile: string,
): Promise<() => Promise<void>> {
  const child = spawn(process.execPath, [thisFile, extensionRoot, lockFile], {
    stdio: ["pipe", "pipe", "inherit"],
  });
  const exit: Promise<unknown[]> = once(child, "exit");
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const first = await within(lines.next(), READY_TIMEOUT_MS);
  if (first === TIMED_OUT || first.done === true || first.value !== READY_LINE) {
    child.kill("SIGKILL");
    await exit;
    assert.fail(`the state lock holder did not report that it holds ${lockFile}`);
  }

  return async () => {
    child.stdin.end();
    const exited = await within(exit, EXIT_GRACE_MS);
    if (exited === TIMED_OUT) {
      child.kill("SIGKILL");
      await exit;
      assert.fail(`the state lock holder did not exit within ${EXIT_GRACE_MS} ms`);
    }

    assert.deepStrictEqual(exited, [0, null], "the state lock holder did not exit cleanly");
    await assert.rejects(stat(lockFile), { code: "ENOENT" }, `${lockFile} is still held`);
  };
}

/** Whether a fresh lock holds the state lock `lockFile` of the extension root `extensionRoot`. */
export function isStateLockHeld(extensionRoot: string, lockFile: string): Promise<boolean> {
  return lockfile.check(extensionRoot, { lockfilePath: lockFile, realpath: false, stale: 10_000 });
}

// The child: takes the lock with the product's options (D-06), reports it,
// and releases it when its stdin ends.
async function holdUntilStdinEnds(extensionRoot: string, lockFile: string): Promise<void> {
  await mkdir(extensionRoot, { recursive: true });
  const release = await lockfile.lock(extensionRoot, {
    lockfilePath: lockFile,
    realpath: false,
    retries: 0,
    stale: 10_000,
    update: 2_000,
  });
  const ended = once(process.stdin, "end");
  // proper-lockfile unrefs the timer that keeps the lock fresh, so the open
  // stdin is what keeps this process alive.
  process.stdin.resume();
  process.stdout.write(`${READY_LINE}\n`);
  await ended;
  await release();
}

if (process.argv[1] === thisFile) {
  const [, , extensionRoot, lockFile] = process.argv;
  if (extensionRoot === undefined || lockFile === undefined) {
    throw new Error("usage: state-lock-holder.ts <extension root> <lock file>");
  }

  await holdUntilStdinEnds(extensionRoot, lockFile);
}

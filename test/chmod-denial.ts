// Whether a `chmod` mode denies this process. Suites provoke EACCES with a
// 0o000 file or a 0o555 directory. Such a mode denies nothing to uid 0 with
// its default capabilities, CAP_DAC_OVERRIDE and CAP_DAC_READ_SEARCH. It
// denies every other user. It also denies a uid 0 whose bounding set dropped
// both capabilities, which is how the Claude Code cloud VM runs Node
// (scripts/cloud-env.sh). So the suites probe the condition, not the uid.

import { chmod, mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** The remedy a guard names when a mode does not deny this process. */
export const CHMOD_DENIAL_HINT =
  "Run this suite as a non-root user, or run node through the wrapper that scripts/cloud-env.sh writes on a Claude Code cloud VM.";

let cached: Promise<boolean> | undefined;

/**
 * Reports whether a `chmod` mode denies this process. The probe opens a
 * 0o000 file for reading and writes into a 0o555 directory, both in a
 * temporary directory of its own. It reports true only when both are denied,
 * because the suites use either kind of denial. Capabilities do not change
 * within a process, so the first answer is kept.
 */
export function chmodDeniesThisProcess(): Promise<boolean> {
  cached ??= probe().catch((error: unknown) => {
    cached = undefined;
    throw error;
  });
  return cached;
}

async function probe(): Promise<boolean> {
  const dir = await mkdtemp(path.join(tmpdir(), "chmod-denial-"));
  try {
    const unreadable = path.join(dir, "unreadable");
    await writeFile(unreadable, "");
    await chmod(unreadable, 0o000);
    await chmod(dir, 0o555);
    const readDenied = await isDenied(async () => {
      const handle = await open(unreadable, "r");
      await handle.close();
    });
    const writeDenied = await isDenied(() => writeFile(path.join(dir, "probe"), ""));
    return readDenied && writeDenied;
  } finally {
    try {
      await chmod(dir, 0o755);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

// Resolves true when `operation` rejects with EACCES, resolves false when it
// succeeds, and rethrows any other error.
async function isDenied(operation: () => Promise<void>): Promise<boolean> {
  try {
    await operation();
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "EACCES") {
      return true;
    }

    throw error;
  }

  return false;
}

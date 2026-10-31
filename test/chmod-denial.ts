// Whether a `chmod` mode denies this process. Several suites provoke EACCES
// with a 0o000 file or a 0o555 directory. Such a mode denies nothing to the
// usual uid 0, which holds CAP_DAC_OVERRIDE and CAP_DAC_READ_SEARCH. It denies
// every other user. It also denies a uid 0 whose bounding set dropped both
// capabilities, which is how the Claude Code cloud VM runs Node
// (scripts/cloud-env.sh). So the suites probe the condition, not the uid.

import { access, chmod, constants, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Reports whether a `chmod` mode denies this process. The probe checks read
 * access to a 0o000 file and writes into a 0o555 directory, both in a
 * temporary directory of its own. It reports true only when both are denied.
 */
export async function chmodDeniesThisProcess(): Promise<boolean> {
  const dir = await mkdtemp(path.join(tmpdir(), "chmod-denial-"));
  try {
    const unreadable = path.join(dir, "unreadable");
    await writeFile(unreadable, "");
    await chmod(unreadable, 0o000);
    await chmod(dir, 0o555);
    const readDenied = await isDenied(() => access(unreadable, constants.R_OK));
    const writeDenied = await isDenied(() => writeFile(path.join(dir, "probe"), ""));
    return readDenied && writeDenied;
  } finally {
    await chmod(dir, 0o755);
    await rm(dir, { recursive: true, force: true });
  }
}

// Resolves true when `operation` rejects with EACCES, the error a denied mode
// produces, and rethrows any other error.
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

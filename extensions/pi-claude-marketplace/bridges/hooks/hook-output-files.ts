// bridges/hooks/hook-output-files.ts
//
// The files of hook context strings over the model's limit (D-PG5-15). Each
// string is saved whole as `hook-<id>-<source>.txt` in `_shared/hook-output/`
// under the data root of the hook's plugin scope, where Claude Code 2.1.323
// writes to its session directory; Pi's session directory lies outside the
// paths this extension may write (NFR-10). `<id>` is a UUID the bridge draws,
// because hooks of one event run at once, and no plugin-controlled text is
// part of the name. Every path passes `assertPathInside` against the data
// root before the write, and the write is atomic (NFR-1). Each bridge load
// removes the saved files older than 30 days.

import { lstat, opendir, unlink } from "node:fs/promises";
import path from "node:path";

import { atomicWriteText } from "../../shared/atomic-json.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import type { HookContextSource } from "./context-cap.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";

// D-PG5-15: how long a saved file stays. Upstream ties the file to its session,
// which Pi cannot do here, so this retention is this project's choice.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// The name of a saved file: an id of letters, digits, and dashes, and one of
// the three sources.
const SAVED_NAME = /^hook-[A-Za-z0-9-]+-(?:additionalContext|systemMessage|stdout)\.txt$/u;

function hookOutputDir(loc: ScopedLocations): string {
  return path.join(loc.dataRoot, "_shared", "hook-output");
}

/**
 * D-PG5-15: saves `text` whole and resolves to the saved file's path. Unlike
 * the bridge's other writers it rejects on failure, because the cap turns a
 * rejection into its failure line.
 */
export async function saveHookOutput(
  loc: ScopedLocations,
  id: string,
  source: HookContextSource,
  text: string,
): Promise<string> {
  const filePath = path.join(hookOutputDir(loc), `hook-${id}-${source}.txt`);
  await assertPathInside(loc.dataRoot, filePath, "hook output file");
  await atomicWriteText(filePath, text);
  return filePath;
}

/** The two file operations of the sweep, which a test may replace. */
interface SweepFileOps {
  readonly lstat: (filePath: string) => Promise<{ readonly mtimeMs: number }>;
  readonly unlink: (filePath: string) => Promise<void>;
}

const DEFAULT_SWEEP_FILE_OPS: SweepFileOps = { lstat, unlink };

// Removes one saved file older than the retention. A failure, such as a file
// another Pi removed first, writes one debug line and leaves the other files
// to the sweep.
async function sweepFile(filePath: string, now: number, ops: SweepFileOps): Promise<void> {
  try {
    const stats = await ops.lstat(filePath);
    if (now - stats.mtimeMs > RETENTION_MS) {
      await ops.unlink(filePath);
    }
  } catch (error: unknown) {
    hookDebugLog(`hook-output: sweep skipped ${path.basename(filePath)}: ${errorMessage(error)}`);
  }
}

/**
 * D-PG5-15: removes the saved files of `loc` whose modification time lies more
 * than 30 days before `now`. Only regular files with a saved name are read
 * and removed; a link or a folder stays, and no link is followed (NFR-10). A
 * missing folder is silent, and a folder that cannot be read writes one debug
 * line. A file that fails writes its own debug line, and the sweep goes on
 * with the next file. The sweep never rejects (NFR-2).
 */
export async function sweepHookOutput(
  loc: ScopedLocations,
  now: number,
  ops: typeof DEFAULT_SWEEP_FILE_OPS = DEFAULT_SWEEP_FILE_OPS,
): Promise<void> {
  const dirPath = hookOutputDir(loc);
  try {
    await assertPathInside(loc.dataRoot, dirPath, "hook output sweep");
    const dir = await opendir(dirPath);
    for await (const entry of dir) {
      if (entry.isFile() && SAVED_NAME.test(entry.name)) {
        await sweepFile(path.join(dirPath, entry.name), now, ops);
      }
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      hookDebugLog(`hook-output: sweep failed: ${errorMessage(error)}`);
    }
  }
}

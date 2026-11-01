/**
 * @fileoverview The harness directory of a profile Pi, and the logs its
 * stand-ins keep there.
 *
 * A stand-in of a profile Pi, such as the scripted model, appends one JSON
 * line per event to `<harness dir>/<name>.jsonl`, and a stand-in process
 * writes its pid to `<harness dir>/<name>-<pid>.pid`. The harness directory
 * lies inside the sandbox home, so the `Before()` that empties the sandbox
 * empties it too (HAR-05). A model turn keeps the lines each log gained during
 * the turn (HAR-03), and the release of a profile Pi checks, after Pi stops,
 * that every process a pid file names is gone.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const LOG_SUFFIX = ".jsonl";

/** Returns the harness directory of the sandbox home `home`: `<home>/harness`. */
export function harnessDirectory(home: string): string {
  return path.join(home, "harness");
}

async function logNames(directory: string): Promise<string[]> {
  return (await readdir(directory)).filter((name) => name.endsWith(LOG_SUFFIX)).sort();
}

// A stand-in appends whole lines, each ending in a newline.
async function logLines(file: string): Promise<string[]> {
  return (await readFile(file, "utf8")).split("\n").filter((line) => line !== "");
}

/** Returns the line count of every `*.jsonl` log in `directory`, by file name. */
export async function readLogLengths(directory: string): Promise<ReadonlyMap<string, number>> {
  const names = await logNames(directory);
  const lengths = await Promise.all(
    names.map(async (name) => (await logLines(path.join(directory, name))).length),
  );
  return new Map(names.map((name, index) => [name, lengths[index] ?? 0]));
}

/**
 * Returns the lines every `*.jsonl` log in `directory` gained since `lengths`
 * was read, each parsed as JSON, by file name. A log that `lengths` does not
 * name gained all its lines. A log that gained no line is left out.
 */
export async function readLogLinesSince(
  directory: string,
  lengths: ReadonlyMap<string, number>,
): Promise<ReadonlyMap<string, readonly unknown[]>> {
  const gained = await Promise.all(
    (await logNames(directory)).map(async (name): Promise<[string, unknown[]]> => {
      const lines = await logLines(path.join(directory, name));
      const added = lines.slice(lengths.get(name) ?? 0).map((line): unknown => JSON.parse(line));
      return [name, added];
    }),
  );
  return new Map(gained.filter(([, lines]) => lines.length > 0));
}

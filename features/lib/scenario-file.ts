/**
 * @fileoverview A file one scenario writes into the sandbox for itself.
 */

import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";

/**
 * Writes `text` to `file`, which must not exist yet, removes it when the
 * scenario ends, and checks that the file holds exactly `text`.
 */
export async function writeScenarioFile(
  world: { onRelease(release: () => Promise<void> | void): void },
  file: string,
  text: string,
): Promise<void> {
  await writeFile(file, text, { flag: "wx" });
  world.onRelease(() => rm(file, { force: true }));
  assert.strictEqual(await readFile(file, "utf8"), text);
}

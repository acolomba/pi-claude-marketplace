import { mkdir } from "node:fs/promises";
import path from "node:path";

import writeFileAtomic from "write-file-atomic";

/**
 * Atomic JSON write (D-03 / NFR-1 / AS-1).
 *
 * Replaces V1's hand-rolled `atomicWriteJson` in `fs-utils.ts`. Uses
 * `write-file-atomic@^7` which:
 *   - serializes concurrent writes to the same path through an internal queue
 *   - generates a unique tmp filename in the destination directory
 *   - fsyncs the tmp file AND the parent directory before returning (default)
 *   - cleans up tmp files on process crash via signal-exit hooks
 *
 * Used ONLY for JSON files that participate in `withStateGuard`
 * (state.json, mcp.json, agents-index.json). Staging-tree commits use
 * V1's hand-rolled `mkdir`+`writeFile`+`rename` pattern (Phase 3 -- different
 * problem shape, EXDEV risk lives there).
 *
 * `chown` left at the library default (inherits from existing file). Per
 * RESEARCH.md Pitfall #2: this is the right per-user behavior; pass
 * `chown: false` only if a future audit surfaces a privilege concern.
 */
export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFileAtomic(filePath, JSON.stringify(value, null, 2) + "\n", {
    encoding: "utf8",
    // fsync defaults to true (NFR-1 durability) -- not specified to keep the
    // intent self-evident at the call site.
  });
}

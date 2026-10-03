import { mkdir } from "node:fs/promises";
import path from "node:path";

import writeFileAtomic from "write-file-atomic";

/**
 * Atomic JSON write (D-03 / NFR-1 / AS-1).
 *
 * Uses `write-file-atomic` which:
 *   - serializes concurrent writes to the same path through an internal queue
 *   - generates a unique tmp filename in the destination directory
 *   - fsyncs the tmp file AND the parent directory before returning (default)
 *   - cleans up tmp files on process crash via signal-exit hooks
 *
 * Used ONLY for JSON files that participate in `withStateGuard`
 * (state.json, mcp.json, agents-index.json). Staging-tree commits use the
 * hand-rolled `mkdir`+`writeFile`+`rename` pattern (different problem shape,
 * EXDEV risk lives there).
 *
 * `chown` left at the library default (inherits from existing file). This is
 * the right per-user behavior; pass `chown: false` only if a future audit
 * surfaces a privilege concern.
 *
 * Returns the exact bytes written, so a caller can later tell its own write
 * from a later edit (D-02-19).
 */
export async function atomicWriteJson(filePath: string, value: unknown): Promise<Buffer> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8");
  // fsync defaults to true (NFR-1 durability) -- not specified to keep the
  // intent self-evident at the call site.
  await writeFileAtomic(filePath, bytes);
  return bytes;
}

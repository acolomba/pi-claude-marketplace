// bridges/hooks/hook-output-files.ts
//
// The files of hook context strings over the model's limit (D-PG5-15). Each
// string is saved whole as `hook-<id>-<source>.txt` in `_shared/hook-output/`
// under the data root of the hook's plugin scope, where Claude Code 2.1.323
// writes to its session directory; Pi's session directory lies outside the
// paths this extension may write (NFR-10). `<id>` is a UUID the bridge draws,
// because hooks of one event run at once, and no plugin-controlled text is
// part of the name. Every path passes `assertPathInside` against the data
// root before the write, and the write is atomic (NFR-1).

import path from "node:path";

import { atomicWriteText } from "../../shared/atomic-json.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import type { HookContextSource } from "./context-cap.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";

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
  const filePath = path.join(loc.dataRoot, "_shared", "hook-output", `hook-${id}-${source}.txt`);
  await assertPathInside(loc.dataRoot, filePath, "hook output file");
  await atomicWriteText(filePath, text);
  return filePath;
}

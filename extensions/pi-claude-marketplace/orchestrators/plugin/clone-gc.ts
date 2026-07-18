// orchestrators/plugin/clone-gc.ts
//
// PURL-05 / PURL-06 / D-78-01: the shared clone garbage-collection primitive.
//
// `garbageCollectPluginClones` derives the set of still-referenced clone keys
// from the surviving git-source state records (derive-not-persist -- NO refcount
// artifact) and deletes every `plugin-clones/<key>/` directory not in that live
// set. `uninstall`, `update`, and `marketplace/remove` call it AFTER their state
// mutation commits; a crash between state write and clone delete just leaves an
// orphan that the next idempotent pass removes (NFR-3 fail-clean).
//
// This helper is fs-only: it imports loadState + the locations chokepoint +
// node:fs/promises rm/readdir ONLY. It never touches the git surface, so any
// orchestrator -- even one gated by
// tests/architecture/no-orchestrator-network.test.ts -- can import it without
// introducing a git token. (uninstall.ts itself is not on that gate's candidate
// list; it is network-free by convention.)

import { readdir, rm } from "node:fs/promises";
import path from "node:path";

import { loadState } from "../../persistence/state-io.ts";
import { errorMessage } from "../../shared/errors.ts";

import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";

/**
 * D-78-01 Option A: derive the set of still-referenced clone keys from the
 * surviving plugin records. A record contributes a key only when it carries
 * `resolvedSha` (git-source); path/github-name plugins have no clone and
 * protect nothing. The key is the FIRST path segment of `resolvedSource`
 * relative to `pluginClonesDir` -- git-subdir plugins resolve to
 * `<key>/<subdir>`, so the segment is the clone root, not the subdir. A
 * `resolvedSource` outside `pluginClonesDir` yields a leading ".." (or empty)
 * segment and protects no cache dir.
 */
function deriveLiveCloneKeys(state: ExtensionState, pluginClonesDir: string): Set<string> {
  const liveKeys = new Set<string>();
  for (const marketplace of Object.values(state.marketplaces)) {
    for (const record of Object.values(marketplace.plugins)) {
      if (record.resolvedSha === undefined) {
        continue;
      }

      const seg = path.relative(pluginClonesDir, record.resolvedSource).split(path.sep)[0];
      if (seg !== undefined && seg !== "" && !seg.startsWith("..")) {
        liveKeys.add(seg);
      }
    }
  }

  return liveKeys;
}

/**
 * PURL-05 / PURL-06 / D-78-01: delete every unreferenced `plugin-clones/<key>/`
 * directory, returning per-dir rm-failure leak strings (callers ignore them --
 * hygienic cleanup never becomes the primary path, D-19-01).
 *
 * Flow:
 *   1. Load the scope state and derive the live clone-key set. A record
 *      contributes a key only when it carries `resolvedSha` (git-source);
 *      path/github-name plugins have no clone and protect nothing. The key is
 *      the FIRST path segment of `resolvedSource` relative to `pluginClonesDir`
 *      (git-subdir plugins resolve to `<key>/<subdir>`, so the segment is the
 *      clone root, not the subdir) -- D-78-01 Option A.
 *   2. `readdir(pluginClonesDir)`; a missing dir is an ENOENT no-op that returns
 *      `[]` (idempotent, NFR-3). Any other errno rethrows.
 *   3. For each on-disk entry not in the live set, route through
 *      `pluginCloneDir(key)` (SC-7 chokepoint -- assertSafeName + assertPathInside
 *      enforce NFR-10 BEFORE any delete) then `rm(dir, { recursive, force })`
 *      inside a try/catch that records `<key>: <message>` leaks (D-19-01 swallow).
 */
export async function garbageCollectPluginClones(locations: ScopedLocations): Promise<string[]> {
  const state = await loadState(locations.extensionRoot);
  const liveKeys = deriveLiveCloneKeys(state, locations.pluginClonesDir);

  let entries: string[];
  try {
    entries = await readdir(locations.pluginClonesDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // NFR-3: a missing cache dir is a no-op; nothing to sweep.
      return [];
    }

    throw err;
  }

  const leaks: string[] = [];
  for (const key of entries) {
    if (liveKeys.has(key)) {
      continue;
    }

    // SC-7 / NFR-10: every delete target routes through the chokepoint
    // (assertSafeName + assertPathInside) BEFORE the rm.
    const dir = await locations.pluginCloneDir(key);
    try {
      await rm(dir, { recursive: true, force: true });
    } catch (err) {
      // D-19-01: a per-dir rm leak never throws out of GC; the next pass
      // retries (NFR-3).
      leaks.push(`${key}: ${errorMessage(err)}`);
    }
  }

  return leaks;
}

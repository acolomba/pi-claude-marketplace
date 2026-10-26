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
// orchestrator -- even one that BLOCK F in `eslint.config.js` lints for git
// imports and identifiers -- can import it without introducing a git token.
// uninstall.ts is one such gated orchestrator.

import { readdir, rm } from "node:fs/promises";
import path from "node:path";

import { loadState } from "../../persistence/state-io.ts";
import { errorMessage } from "../../shared/errors.ts";

import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";

/** A per-commit clone key, `pluginCloneKey`'s shape; group 1 is its mirror key. */
const PER_COMMIT_KEY = /^([0-9a-f]{12})-[0-9a-f]{12}$/;

/**
 * D-78-01 Option A: derive the set of still-referenced clone keys from the
 * surviving plugin records. A record contributes a key only when it carries
 * `resolvedSha` (git-source); path/github-name plugins have no clone and
 * protect nothing. The key is the FIRST path segment of `resolvedSource`
 * relative to `pluginClonesDir` -- git-subdir plugins resolve to
 * `<key>/<subdir>`, so the segment is the clone root, not the subdir. A
 * `resolvedSource` outside `pluginClonesDir` yields a leading ".." (or empty)
 * segment and protects no cache dir.
 *
 * GIT-02 / D-16-07: a live per-commit key `<url12>-<sha12>` also keeps the
 * URL-keyed mirror `<url12>` of the same URL, the download cache a later
 * `update` of that plugin fetches into. A mirror no installed plugin's URL
 * shares, such as one `fetch` warmed for a plugin that is not installed, is
 * not live.
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
        const mirrorKey = PER_COMMIT_KEY.exec(seg)?.[1];
        if (mirrorKey !== undefined) {
          liveKeys.add(mirrorKey);
        }
      }
    }
  }

  return liveKeys;
}

/** The `plugin-clones/` entries on disk; a missing dir has none (NFR-3). */
async function readCloneKeys(locations: ScopedLocations): Promise<string[]> {
  try {
    return await readdir(locations.pluginClonesDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw err;
  }
}

/**
 * UPD-DEP-D1: the clone keys on disk now, so a sweep after a refused plan can
 * leave every clone that was already there alone, such as a mirror `fetch`
 * warmed.
 */
export async function listPluginClones(locations: ScopedLocations): Promise<ReadonlySet<string>> {
  return new Set(await readCloneKeys(locations));
}

/**
 * PURL-05 / PURL-06 / D-78-01: delete every unreferenced `plugin-clones/<key>/`
 * directory, returning per-dir rm-failure leak strings (callers ignore them --
 * hygienic cleanup never becomes the primary path, D-19-01). A key in `keep`
 * stays even when unreferenced (UPD-DEP-D1).
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
export async function garbageCollectPluginClones(
  locations: ScopedLocations,
  keep: ReadonlySet<string> = new Set(),
): Promise<string[]> {
  const state = await loadState(locations.extensionRoot);
  const liveKeys = deriveLiveCloneKeys(state, locations.pluginClonesDir);
  const entries = await readCloneKeys(locations);

  const leaks: string[] = [];
  for (const key of entries) {
    if (liveKeys.has(key) || keep.has(key)) {
      continue;
    }

    // SC-7 / NFR-10: every delete target routes through the chokepoint
    // (assertSafeName + assertPathInside) BEFORE the rm.
    // eslint-disable-next-line no-await-in-loop -- bounded IO: one recursive clone delete at a time
    const dir = await locations.pluginCloneDir(key);
    try {
      // eslint-disable-next-line no-await-in-loop -- bounded IO: one recursive clone delete at a time
      await rm(dir, { recursive: true, force: true });
    } catch (err) {
      // D-19-01: a per-dir rm leak never throws out of GC; the next pass
      // retries (NFR-3).
      leaks.push(`${key}: ${errorMessage(err)}`);
    }
  }

  return leaks;
}

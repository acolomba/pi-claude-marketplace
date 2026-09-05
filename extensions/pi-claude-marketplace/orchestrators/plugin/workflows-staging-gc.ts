// orchestrators/plugin/workflows-staging-gc.ts
//
// WLIF-01: the staging garbage-collection primitive for the workflows bridge.
//
// `<workflowsStagingDir>/<uuid>/` is created before the envelope write loop and
// removed only by a successful commit or an explicit abort. A crash or a kill
// signal leaves it behind holding verbatim third-party executable JavaScript.
// That tree sits under the home directory and NOT under any scope root, so
// uninstall and `/reload` never reach it and it accumulates for the life of the
// machine.
//
// WR-02: one aged tree is deliberately NOT swept -- one whose `.previous/` still
// holds displaced envelopes. The commit keeps that tree because it is the only
// copy of the user's previous workflow scripts, and the operator has been told
// to move them back by hand. See `holdsDisplacedEnvelopes`.
//
// This helper is fs-only: node:fs/promises + the containment chokepoint + the
// shared error-message helper + the locations type. It never touches the git
// surface, so any orchestrator -- even one gated by
// tests/architecture/no-orchestrator-network.test.ts -- can import it without
// introducing a git token. It needs no state load either, which is one import
// fewer than `clone-gc.ts`, its structural model.

import { lstat, readdir, rm } from "node:fs/promises";
import path from "node:path";

import { DISPLACED_DIR } from "../../bridges/workflows/stage.ts";
import { errorMessage } from "../../shared/errors.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import type { ScopedLocations } from "../../persistence/locations.ts";
import type { Stats } from "node:fs";

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;

/**
 * WLIF-01: twenty-four hours. A staging tree whose modification time is older
 * than this is treated as abandoned.
 *
 * This bound is the ENTIRE liveness mechanism, not a refinement of one.
 * `clone-gc.ts` derives liveness from the persisted `resolvedSha` /
 * `resolvedSource` fields; a staging root is a `randomUUID()` that nothing
 * persists, and `workflowsStagingDir` is scope-independent so the per-scope
 * `proper-lockfile` state guard does not serialize access to it either. Two
 * processes on different scopes can hold staging roots here at once.
 *
 * The directory's modification time tracks last transaction activity: the
 * prepare writes one envelope per admitted workflow into it, the displacement
 * step creates a subdirectory inside it, and the commit renames children out of
 * it -- each of those bumps it. An installation still touching its root a day
 * later has failed in a way a sweeper should not adjudicate, and the cost of
 * erring in the safe direction is one orphan surviving an extra pass.
 */
export const WORKFLOWS_STAGING_MAX_AGE_MS =
  HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;

/**
 * WLIF-01: delete every abandoned `<workflowsStagingDir>/<uuid>/` tree,
 * returning per-directory rm-failure leak strings (callers ignore them --
 * hygienic cleanup never becomes the primary path, D-19-01). The return is the
 * set of trees it FAILED to remove, not the ones it removed, matching what
 * `garbageCollectPluginClones` actually returns.
 *
 * Flow:
 *   1. `readdir(workflowsStagingDir)`; a missing dir is an ENOENT no-op that
 *      returns `[]` (idempotent, NFR-3). Any other errno rethrows.
 *   2. Per entry, `lstat` without following. Anything that is not a directory
 *      is skipped, so a planted file or link is neither traversed nor removed.
 *      Anything modified inside `WORKFLOWS_STAGING_MAX_AGE_MS` is skipped, so a
 *      concurrent installation's in-flight envelopes survive.
 *   3. For an aged directory, skip it if it still holds `.previous/` entries
 *      (WR-02): those are displaced previous envelopes the commit kept on
 *      purpose because they are the only copy left.
 *   4. Run the containment assertion against `workflowsHomeDir` -- one level
 *      ABOVE the staging directory, so the staging segment itself is walked
 *      (WPTH-04; anchoring at the staging root skips an lstat of the one
 *      segment an attacker could have replaced, leaving a check that cannot
 *      fail). Resolved OUTSIDE the removal's try, so D-19-01's sanction to
 *      swallow the cleanup never covers the assertion guarding it -- a refusal
 *      is recorded distinctly and is never mistaken for an rm leak.
 *   5. `rm(dir, { recursive, force })` inside a try/catch that records
 *      `<name>: <message>` leaks and never throws; the next pass retries.
 *
 * Nothing here throws past a single entry (WR-02 aside from the initial
 * `readdir`). Both call sites wrap the sweep in a bare `catch {}` per D-19-01,
 * so an entry-level throw would have silently ended the pass for every
 * remaining aged tree -- the exact accumulation this sweeper exists to stop.
 */
export async function garbageCollectWorkflowsStaging(
  locations: Pick<ScopedLocations, "workflowsStagingDir" | "workflowsHomeDir">,
): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(locations.workflowsStagingDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // NFR-3: a missing staging dir is a no-op; nothing to sweep.
      return [];
    }

    throw err;
  }

  const abandonedBefore = Date.now() - WORKFLOWS_STAGING_MAX_AGE_MS;
  const leaks: string[] = [];
  for (const name of entries) {
    const candidate = path.join(locations.workflowsStagingDir, name);

    // The entry's OWN link status, unfollowed, so a symbolic link is described
    // rather than traversed. A failure here is the race where an entry vanishes
    // -- or stops being searchable -- between enumeration and inspection.
    let stats: Stats;
    try {
      stats = await lstat(candidate);
    } catch (err) {
      leaks.push(`${name}: ${errorMessage(err)}`);
      continue;
    }

    if (!stats.isDirectory() || stats.mtimeMs >= abandonedBefore) {
      continue;
    }

    // WR-02: never sweep a root that still holds displaced previous envelopes.
    // Those bytes are the ONLY copy -- the commit's failed-restore path keeps
    // this tree on purpose and hands the operator a leak string telling them to
    // move the file back by hand. Sweeping it would put a silent 24-hour expiry
    // on a recovery instruction the product just gave. Cause-independent by
    // design: a crash mid-commit strands the same bytes in the same place, and
    // the sweeper cannot tell the two apart -- nor does it need to.
    if (await holdsDisplacedEnvelopes(candidate)) {
      continue;
    }

    // WPTH-04 / NFR-10: resolve the containment boundary OUTSIDE the rm's try,
    // so a refusal is never mistaken for an rm leak.
    //
    // WR-01: caught PER ENTRY. Both call sites wrap the whole sweep in a bare
    // `catch {}` (D-19-01), so a refusal that escaped this loop would be
    // discarded there AND would end the pass for every remaining aged tree --
    // one poisoned entry, such as a symlinked staging segment, would stop
    // orphaned executable envelopes from ever being collected again. Recorded
    // as a leak instead: still loud, still distinct from an rm failure by the
    // message the assertion raises, and it does not stop the sweep.
    try {
      await assertPathInside(
        locations.workflowsHomeDir,
        candidate,
        `workflows staging root ${name}`,
      );
    } catch (err) {
      leaks.push(`${name}: ${errorMessage(err)}`);
      continue;
    }

    try {
      await rm(candidate, { recursive: true, force: true });
    } catch (err) {
      // D-19-01: a per-tree rm leak never throws out of the sweep; the next
      // pass retries (NFR-3).
      leaks.push(`${name}: ${errorMessage(err)}`);
    }
  }

  return leaks;
}

/**
 * WR-02: does this staging root still hold displaced previous envelopes?
 *
 * `<stagingRoot>/.previous/` is where the commit moves a previously-recorded
 * target aside instead of unlinking it. A successful commit removes the whole
 * root; a commit whose restore loop failed KEEPS it, because the directory then
 * holds the only surviving copy of the user's previous workflow envelope.
 *
 * Any failure reads as "nothing displaced". ENOENT is the ordinary case -- most
 * roots never displaced anything -- and no other errno tells us the directory
 * holds bytes, so none of them justifies keeping an aged tree forever.
 */
async function holdsDisplacedEnvelopes(stagingRoot: string): Promise<boolean> {
  try {
    return (await readdir(path.join(stagingRoot, DISPLACED_DIR))).length > 0;
  } catch {
    return false;
  }
}

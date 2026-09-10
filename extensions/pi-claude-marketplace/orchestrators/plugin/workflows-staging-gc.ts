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
// The import list is closed and load-bearing, so a new entry belongs in it:
// node:fs/promises + node:path, the containment chokepoint, the shared
// error-message helper, the locations type, and `DISPLACED_DIR` from the
// workflows bridge. Sharing that constant rather than restating the literal is
// what keeps the retention predicate here and the displacement in the commit
// from drifting apart.
//
// None of them reaches the git surface, so any orchestrator -- even one gated
// by tests/architecture/no-orchestrator-network.test.ts -- can import this
// module without introducing a git token. The bridge import is the only one
// that is not a leaf, and it is safe on the terms that gate actually uses: the
// gate greps named files for git tokens, and `install.ts` is both gated and
// already importing the same bridge module directly. It needs no state load
// either, which is one import fewer than `clone-gc.ts`, its structural model.

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
 * returning one leak string per entry it could not sweep -- an rm failure, an
 * lstat failure, or a containment refusal (callers ignore them all -- hygienic
 * cleanup never becomes the primary path, D-19-01). The return is the
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
 *   3. For an aged directory, run the containment assertion against
 *      `workflowsHomeDir` -- one level ABOVE the staging directory, so the
 *      staging segment itself is walked (WPTH-04; anchoring at the staging root
 *      skips an lstat of the one segment an attacker could have replaced,
 *      leaving a check that cannot fail). Resolved OUTSIDE the removal's try,
 *      so D-19-01's sanction to swallow the cleanup never covers the assertion
 *      guarding it -- a refusal is recorded distinctly and is never mistaken
 *      for an rm leak. WR-07: it precedes every read through the candidate, so
 *      no decision below rests on bytes from outside the boundary.
 *   4. Skip the directory if it still holds `.previous/` entries (WR-02): those
 *      are displaced previous envelopes the commit kept on purpose because they
 *      are the only copy left.
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

    // WPTH-04 / NFR-10: resolve the containment boundary BEFORE anything reads
    // through the candidate, and OUTSIDE the rm's try so a refusal is never
    // mistaken for an rm leak.
    //
    // WR-07: this is the FIRST thing the loop does with the candidate path, not
    // merely the last thing before the rm. The staging segment is the one an
    // attacker could have replaced, so a read performed ahead of the refusal is
    // a read the refusal exists to prevent -- and it would decide retention on
    // bytes from outside the boundary. Every access below is inside a path that
    // has been walked.
    //
    // WR-01: caught PER ENTRY. Both call sites wrap the whole sweep in a bare
    // `catch {}` (D-19-01), so a refusal that escaped this loop would be
    // discarded there AND would end the pass for every remaining aged tree --
    // one poisoned entry, such as a symlinked staging segment, would stop
    // orphaned executable envelopes from ever being collected again. Recorded
    // as a leak instead: it lands in the returned array, distinguishable from
    // an rm failure by the message the assertion raises, and the sweep goes on.
    // Silent to the user, though: both callers discard that array under the
    // same D-19-01 sanction that keeps the whole sweep silent. What a refusal
    // buys is the `rm` that never runs on the refused entry, not a report.
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
 * WR-06: the trees the sweep keeps forever, named without removing anything.
 *
 * The sweep above spares a tree whose `.previous/` still holds envelopes and
 * says nothing about it: both of its call sites discard its return inside a
 * bare `catch {}` (D-19-01), and on the crash path there is no failure to hang
 * a leak line on at all. This is the read-only sibling that names the same set,
 * and it shares the two things that DEFINE that set -- the displaced-envelope
 * reader below and `WORKFLOWS_STAGING_MAX_AGE_MS` -- so a live transaction
 * mid-commit is never reported.
 *
 * `garbageCollectWorkflowsStaging` is deliberately NOT widened to return this
 * alongside its leaks. It is destructive and both of its callers discard its
 * value, so a second member would be discarded at both.
 *
 * Read-only in the strong sense, because the surface that renders this never
 * writes a file and has no failure arm to route a throw into: an absent -- or
 * unreadable -- staging directory yields the empty result and creates nothing,
 * a per-entry failure is skipped rather than recorded (there is no leak channel
 * here), and a containment refusal skips its entry without ending the pass.
 */
export interface RetainedWorkflowsStagingTree {
  /**
   * The staging root's directory NAME. T-53-02-02: never the absolute path --
   * the surface that renders this carries basenames, and a machine-specific
   * absolute path could not be pinned by a byte-equality fixture at all.
   */
  readonly name: string;
  /**
   * How many displaced envelopes `.previous/` holds. ABSENT, never zero, when
   * the directory could not be read: the reader answers that case in the retain
   * direction WITHOUT learning a count, and a rendered `0` would state a fact
   * nobody established.
   */
  readonly envelopeCount?: number;
}

export async function scanRetainedWorkflowsStaging(
  locations: Pick<ScopedLocations, "workflowsStagingDir" | "workflowsHomeDir">,
): Promise<RetainedWorkflowsStagingTree[]> {
  let entries: string[];
  try {
    entries = await readdir(locations.workflowsStagingDir);
  } catch {
    // Every read failure is the empty result, not a throw. The sweep can
    // rethrow because its callers already swallow; this cannot, because its
    // caller is a read-only command whose entire output would go with it.
    // NFR-3 / NFR-5: the directory is never created on the way to that answer.
    return [];
  }

  const abandonedBefore = Date.now() - WORKFLOWS_STAGING_MAX_AGE_MS;
  const retained: RetainedWorkflowsStagingTree[] = [];
  for (const name of entries) {
    const candidate = path.join(locations.workflowsStagingDir, name);

    // The entry's OWN link status, unfollowed, as the sweep reads it: a
    // symbolic link is described rather than traversed, and the race where an
    // entry vanishes between enumeration and inspection is skipped.
    let stats: Stats;
    try {
      stats = await lstat(candidate);
    } catch {
      continue;
    }

    if (!stats.isDirectory() || stats.mtimeMs >= abandonedBefore) {
      continue;
    }

    // WPTH-04 / NFR-10 / WR-07: anchored at the workflows home, one level ABOVE
    // the staging directory, and resolved BEFORE any read through the candidate
    // -- the same anchor and the same ordering the sweep uses. Anchoring at the
    // staging root would skip the one segment an attacker could have replaced,
    // leaving a check that cannot fail. A refusal skips the entry rather than
    // ending the pass: one poisoned entry must not hide every other retained
    // tree from the only surface that names them.
    try {
      await assertPathInside(
        locations.workflowsHomeDir,
        candidate,
        `workflows staging root ${name}`,
      );
    } catch {
      continue;
    }

    const displaced = await readDisplacedEnvelopes(candidate);
    if (!displaced.holds) {
      continue;
    }

    retained.push({
      name,
      ...(displaced.count !== undefined && { envelopeCount: displaced.count }),
    });
  }

  // Sorted by directory name: the surface that renders this owes byte-identical
  // output on two consecutive invocations against unchanged state, and
  // `readdir` order is neither sorted nor stable across filesystems.
  return retained.sort((a, b) => a.name.localeCompare(b.name));
}

/** What a staging root's `.previous/` holds, as far as it can be established. */
interface DisplacedEnvelopes {
  readonly holds: boolean;
  /**
   * Absent, not zero, when the directory could not be read -- the error arm
   * below answers WHETHER without ever learning HOW MANY.
   */
  readonly count?: number;
}

/**
 * WR-02: read `<stagingRoot>/.previous/`, the directory the commit moves a
 * previously-recorded target into instead of unlinking it. A successful commit
 * removes the whole root; a commit whose restore loop failed KEEPS it, because
 * the directory then holds the only surviving copy of the user's previous
 * workflow envelope.
 *
 * WR-05: only ENOENT (no `.previous/` at all -- the ordinary case, since most
 * roots never displaced anything) and ENOTDIR (a plain file at that name, which
 * the commit never writes and which therefore holds no envelope) PROVE the
 * directory holds nothing. Every other errno -- EACCES, a transient EMFILE or
 * ENFILE under fd pressure, EIO -- leaves the question open, and an open
 * question is answered in the direction `WORKFLOWS_STAGING_MAX_AGE_MS` already
 * names: one orphan surviving another pass, never a recursive rm over what may
 * be the only surviving copy of the user's workflow scripts. The next pass
 * retries (NFR-3), so a transient failure costs a day, not the bytes.
 *
 * This is the SINGLE reader of that directory. The sweep needs only the verdict
 * and the read-only scan needs the count as well, so the errno ladder above --
 * which is the entire retention rule -- is stated once and projected, rather
 * than written twice and left to drift.
 */
async function readDisplacedEnvelopes(stagingRoot: string): Promise<DisplacedEnvelopes> {
  try {
    const displaced = await readdir(path.join(stagingRoot, DISPLACED_DIR));
    return { holds: displaced.length > 0, count: displaced.length };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return { holds: code !== "ENOENT" && code !== "ENOTDIR" };
  }
}

/** WR-02: the sweep's retention verdict -- the projection of the reader above. */
async function holdsDisplacedEnvelopes(stagingRoot: string): Promise<boolean> {
  return (await readDisplacedEnvelopes(stagingRoot)).holds;
}

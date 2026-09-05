// bridges/workflows/stage.ts
//
// WorkflowsBridge: prepare / commit / abort.
//
// Storage layout:
//   - Staging:   <workflow home>/.pi-claude-marketplace-staging/<uuid>/<plugin>:<name>.json
//   - Target:    <the scope's saved directory>/<plugin>:<name>.json
//
// Only the bundle composes that target. This file never joins a name onto the
// saved directory itself -- it asks `locations.workflowArtifactPath(name)`,
// which runs assertSafeName and assertPathInside first. The saved directory is
// named here exactly once, to create it (see the commit path), and that is not
// a name join.
//
// Filenames carry the literal colon (`:`) in the basename, matching the
// commands bridge. POSIX targets allow this; Windows is explicitly not
// targeted, and the host engine's own saved-name rule forbids only "/", "\"
// and NUL.
//
// WPTH-05: staging is a SIBLING of the target under the engine's storage root,
// not a child of this extension's own writable root as every other bridge's
// staging tree is. That root sits at `<cwd>/.pi/...` for project scope and can
// land on a different filesystem from the home directory, which makes the
// commit `rename()` fail EXDEV. Staging beside the target keeps the rename
// inside one filesystem, which is where NFR-1 atomicity comes from. No path in
// this bridge derives from the extension's own root.
//
// WBRG-04: the ONLY operation that touches a directory the engine scans is the
// commit `rename`. Envelope bytes are written exclusively into the staging
// root, so an engine scan running concurrently with a commit reads either no
// file at all or a complete envelope -- never a partial one.
//
// The house JSON writer in `shared/atomic-json.ts` is deliberately NOT used
// here: its own header scopes it to files that participate in the state guard,
// and it would land the envelope directly at its final path with nothing left
// to unstage, which dissolves the reason staging sits where it does.
//
// This is the first bridge that writes third-party EXECUTABLE code. The script
// bytes are copied verbatim -- never reformatted, transpiled, minified,
// re-encoded or line-ending-normalized -- because any silent edit changes what
// runs while still looking like a faithful copy. Nothing here evaluates them.
// The claim holds for a reason enforced upstream, not by assertion: discovery
// refuses any file whose bytes do not survive a UTF-8 round trip, so a decode
// that would substitute U+FFFD produces a soft-fail rather than a mutated
// envelope (`discover.ts::readScriptSource`).

import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertNoWorkflowNameCollisions } from "../../domain/workflow-script.ts";
import { WorkflowTargetOccupiedError } from "../../shared/errors-bridges.ts";
import { appendLeakToError, appendLeaks, errorMessage } from "../../shared/errors.ts";
import { cleanupStaging, pathExists } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import { discoverPluginWorkflows } from "./discover.ts";

import type {
  CommitWorkflowsOptions,
  DiscoveredWorkflow,
  PreparedWorkflowsStaged,
  PreparedWorkflowsStaging,
  StageWorkflowsInput,
  WorkflowEnvelope,
} from "./types.ts";
import type { AdmittedWorkflow } from "../../domain/workflow-script.ts";

const STAGING_LABEL = "workflows staging directory";

/** The two verdict arms that carry a `generatedName`, and so the two that stage. */
function admittedVerdict(
  discovered: DiscoveredWorkflow,
): (AdmittedWorkflow & { readonly source: string }) | undefined {
  const { verdict } = discovered;

  if (verdict.outcome !== "named" && verdict.outcome !== "stem-fallback") {
    return undefined;
  }

  return { ...verdict, source: discovered.source };
}

/**
 * WBRG-01: the envelope, built from ONE variable for both the file name and
 * the `name` field so the two can never diverge.
 *
 * The key order of the object literal is the key order of the serialized
 * bytes, so it is fixed here rather than left to an accident of construction:
 * `name`, `description`, `script`.
 *
 * `description` is included only when the verdict carries one. Under
 * `exactOptionalPropertyTypes` an optional key must not be assigned
 * `undefined`, and the engine synthesizes its own fallback at registration, so
 * a conditional spread that OMITS the key is both the typed and the truthful
 * answer -- a description invented here would be indistinguishable from a
 * declared one.
 */
function buildEnvelope(admitted: AdmittedWorkflow & { readonly source: string }): WorkflowEnvelope {
  return {
    name: admitted.generatedName,
    ...(admitted.description === undefined ? {} : { description: admitted.description }),
    script: admitted.source,
  };
}

/**
 * Stage workflow envelopes into a fresh `<workflowsStagingDir>/<uuid>/` tree.
 * Per-file rename to the saved directory is deferred to
 * `commitPreparedWorkflows`.
 *
 * The five-step ordering is the contract, matching the commands analog:
 * discover, collision assert, materialization gate, staging root, per-file
 * write.
 *
 * The collision assert runs over the FULL verdict array of every discovered
 * record, before anything is deduped or filtered. `assertNoWorkflowNameCollisions`
 * narrows internally for exactly that reason (WNAM-05): a clash arises from
 * the declared `meta.name`, which neither file name reveals, so keeping the
 * first silently would be the misnaming the rule exists to prevent.
 *
 * Returns a `kind: "noop"` short-circuit when nothing is admitted AND there
 * are no previous names: nothing to stage and nothing to remove, so creating
 * the staging directory would be wasteful -- and would bring the host engine's
 * storage root into existence for a plugin that ships no workflows (WPTH-05).
 */
export async function prepareStageWorkflows(
  input: StageWorkflowsInput,
): Promise<PreparedWorkflowsStaging> {
  const { locations, pluginName, resolved } = input;
  const previousNames = input.previousWorkflowNames ?? [];
  const { discovered, warnings: discoverWarnings } = await discoverPluginWorkflows({
    pluginName,
    resolved,
  });

  assertNoWorkflowNameCollisions(discovered.map((d) => d.verdict));

  // The admitted list is already unique by generated name, and two upstream
  // invariants are between them what make it so: the collision assert above
  // rejects two distinct scripts claiming one name (WNAM-05), and discovery
  // dedups by absolute source path, so one script cannot be reached twice
  // (`discover.ts::pathDedupKey`). A first-wins filter here could never fire --
  // and were either invariant to loosen, dropping a claimant silently is the
  // wrong recovery: it installs one script under a name the author gave to two,
  // which is the outcome the collision assert exists to prevent.
  const admitted = discovered.map(admittedVerdict).filter((verdict) => verdict !== undefined);

  if (admitted.length === 0 && previousNames.length === 0) {
    return {
      kind: "noop",
      result: {
        stagedNames: Object.freeze<string[]>([]),
        warnings: Object.freeze([...discoverWarnings]),
      },
    };
  }

  const stagingRoot = path.join(locations.workflowsStagingDir, randomUUID());
  // WPTH-04: the boundary is the engine's storage ROOT, not the staging
  // directory. `assertPathInside` trusts its own boundary and starts the
  // symlink walk at it, so anchoring on `workflowsStagingDir` would skip an
  // lstat of the one segment an attacker could have replaced with a symlink,
  // leaving a check that cannot fail. Anchoring one level up lstats the
  // staging directory itself. The check runs BEFORE the `mkdir`, because
  // `mkdir` with `recursive: true` follows a symlinked parent -- a refusal
  // that fires after the write has already happened refuses nothing.
  await assertPathInside(locations.workflowsHomeDir, stagingRoot, "workflows staging root");
  await mkdir(stagingRoot, { recursive: true });

  const renamePairs: { name: string; from: string; to: string }[] = [];
  const stagedNames: string[] = [];

  try {
    for (const verdict of admitted) {
      const stagedFile = path.join(stagingRoot, `${verdict.generatedName}.json`);
      await assertPathInside(stagingRoot, stagedFile, "staged workflow file");

      // WPTH-04: the target comes from the bundle's sole composer, which runs
      // its own assertSafeName + assertPathInside. Recomputing the join here
      // would put a second, unguarded composer in the tree.
      const targetFile = await locations.workflowArtifactPath(verdict.generatedName);

      await writeFile(stagedFile, `${JSON.stringify(buildEnvelope(verdict), null, 2)}\n`, "utf8");

      renamePairs.push({ name: verdict.generatedName, from: stagedFile, to: targetFile });
      stagedNames.push(verdict.generatedName);
    }
  } catch (err) {
    throw appendLeakToError(err, await cleanupStaging(stagingRoot, STAGING_LABEL));
  }

  return {
    kind: "staged",
    locations,
    stagingRoot,
    result: {
      stagedNames: Object.freeze(stagedNames),
      warnings: Object.freeze([...discoverWarnings]),
    },
    _previousNames: Object.freeze([...previousNames]),
    _renamePairs: Object.freeze(renamePairs),
  };
}

/**
 * The subdirectory of the staging root that previous targets are moved into on
 * the re-stage path. A directory rather than a name prefix: staged envelopes
 * are direct children of the staging root and always carry the `.json` suffix,
 * so a suffix-less directory name cannot collide with one whatever the plugin
 * is called.
 */
const DISPLACED_DIR = ".previous";

/**
 * Move every previously-named target aside into the staging root, recording
 * the moves so a failed commit can put them back.
 *
 * The previous targets are NOT unlinked. A bare unlink is unrecoverable: the
 * rollback below can only reverse renames, so a commit that failed after the
 * removals would leave the saved directory holding neither the previous
 * envelopes nor the new ones. Every sibling bridge moves previous content
 * aside for the same reason (`shared/fs-utils.ts::rollbackReplacementCommon`).
 *
 * CR-01: `displaced` is OWNED BY THE CALLER and mutated in place, so a move
 * already made is visible to the rollback even when a LATER name throws. A
 * local list returned by value is lost on that throw, which leaves the caller
 * believing nothing was displaced -- it then skips the restore loop and lets
 * the staging cleanup delete the only surviving copy of every envelope moved
 * before the failure. The sibling commands bridge declares its `backups` in the
 * same caller-owned position for the same reason.
 *
 * ENOENT-tolerant: a previous name with no file behind it (a prior install
 * that never finished its commit) is simply not displaced.
 */
async function displacePreviousTargets(
  prepared: PreparedWorkflowsStaged,
  displaced: { from: string; to: string }[],
): Promise<void> {
  if (prepared._previousNames.length === 0) {
    return;
  }

  const displacedRoot = path.join(prepared.stagingRoot, DISPLACED_DIR);
  await mkdir(displacedRoot, { recursive: true });

  for (const name of prepared._previousNames) {
    // The bundle's sole composer runs assertSafeName + assertPathInside, so
    // by the time the aside path is joined the name is known to carry no
    // separator and no traversal segment. The second check is the same
    // defense-in-depth the staged-file join above takes.
    const target = await prepared.locations.workflowArtifactPath(name);
    const aside = path.join(displacedRoot, `${name}.json`);
    await assertPathInside(displacedRoot, aside, "displaced previous workflow file");

    try {
      await rename(target, aside);
      // Recorded immediately, so a throw on any later name still leaves this
      // move reversible.
      displaced.push({ from: target, to: aside });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }
}

/**
 * WR-06 / PI-6: refuse any target path still occupied once the displacement
 * has run. Such a path is FOREIGN by construction -- `displacePreviousTargets`
 * moved every name in `_previousNames` aside one statement earlier -- so this
 * needs none of the sibling bridges' three-arm owned/orphan/foreign policy;
 * their owned and orphan arms are unreachable here. The saved directory is
 * shared with the user's own hand-saved workflows and with every other plugin,
 * and the `<plugin>:` prefix namespaces a name without granting ownership of
 * it, so renaming over what is there would destroy work nobody consented to
 * giving this plugin.
 *
 * The whole set is checked BEFORE the first rename rather than per iteration,
 * so a refusal provably leaves zero completed renames and the caller's
 * `onPlaced` report comes back empty. A per-iteration check would place the
 * earlier names first and then reverse them, which reaches the same end state
 * only if every reversal succeeds -- checking first removes the reversal from
 * the path entirely.
 */
async function assertTargetsUnoccupied(
  pairs: readonly { name: string; from: string; to: string }[],
): Promise<void> {
  for (const pair of pairs) {
    if (await pathExists(pair.to)) {
      throw new WorkflowTargetOccupiedError(pair.to);
    }
  }
}

/**
 * Commit a prepared staging into the saved directory. Moves any
 * previously-named target files aside into the staging root (re-stage path --
 * ENOENT-tolerant), then issues the per-file `rename(stagedFile, targetFile)`
 * calls in discovery order. Finally cleans up the staging directory -- which
 * is what discards the displaced previous envelopes; if cleanup fails, returns
 * the leak message string so the caller can surface it via `appendLeakToError`
 * without losing the install's success state.
 *
 * On a mid-sequence failure the completed renames are reversed back into
 * staging and the displaced previous envelopes are restored to their targets,
 * so the saved directory ends the way it started. The rollback loops NEVER
 * throw; failures accumulate into `rollbackLeaks[]` surfaced via `appendLeaks`.
 *
 * CR-01: the staging cleanup is SKIPPED when a restore failed, because the
 * staging root is where the only surviving copy of that previous envelope
 * lives. Deleting it would complete the data loss the restore loop just failed
 * to prevent -- the outcome the displace-rather-than-unlink design exists to
 * make impossible. The leak names the path that HOLDS the bytes, not the one
 * they were headed for.
 *
 * WR-01 / WR-02: `opts.onPlaced` reports the names left at their targets, on
 * every path including the throw. That report -- not the type of the thrown
 * error -- is what a caller's removal payload must be built from.
 *
 * Only files named in `_previousNames` are touched. That list comes from this
 * extension's own prior install record, and nothing else in the directory is
 * enumerated, read, moved or unlinked -- the saved directory is shared with the
 * user's own hand-saved workflows and with every other plugin, and only the
 * `<plugin>:` prefix namespaces it. WR-06: a target path still occupied once
 * the displacement has run holds content this plugin does not own, and the
 * commit REFUSES it by name rather than renaming over it.
 *
 * Returns `undefined` on a successful commit (or for a noop). Returns the leak
 * message when staging cleanup fails.
 */
export async function commitPreparedWorkflows(
  prepared: PreparedWorkflowsStaging,
  opts?: CommitWorkflowsOptions,
): Promise<string | undefined> {
  const reportPlaced = (names: readonly string[]): void => {
    opts?.onPlaced?.(Object.freeze([...names]));
  };

  if (prepared.kind === "noop") {
    reportPlaced([]);
    return undefined;
  }

  const completedRenames: { name: string; from: string; to: string }[] = [];
  // Declared out here so a displacement that throws part-way through still
  // hands the rollback below the moves it already made (CR-01).
  const displaced: { from: string; to: string }[] = [];

  try {
    // Lazy-create: for project scope this creates the `projects/<key>/saved`
    // levels too. The engine's own directory helper does the same, so we are
    // not racing it into an inconsistent state.
    await mkdir(prepared.locations.workflowsSavedDir, { recursive: true });

    await displacePreviousTargets(prepared, displaced);

    await assertTargetsUnoccupied(prepared._renamePairs);

    for (const pair of prepared._renamePairs) {
      await rename(pair.from, pair.to);
      completedRenames.push(pair);
    }
  } catch (err) {
    const rollbackLeaks: string[] = [];
    // The PAIRS rather than their names: the placement report below has to
    // compare target paths, and re-deriving a pair from its name would need an
    // absent-lookup arm no input can reach.
    const stillPlaced: { name: string; to: string }[] = [];

    for (const pair of [...completedRenames].reverse()) {
      try {
        await rename(pair.to, pair.from);
      } catch (rollbackErr) {
        stillPlaced.push(pair);
        rollbackLeaks.push(
          `failed to roll back workflow rename ${pair.to} -> ${pair.from}: ${errorMessage(rollbackErr)}`,
        );
      }
    }

    // Restore AFTER the new envelopes are reversed out: a replaced name has
    // the same target path in both lists, and restoring first would put the
    // previous envelope back only for the reversal to remove it again.
    const unrestored: string[] = [];
    const restoredTargets = new Set<string>();
    for (const move of [...displaced].reverse()) {
      try {
        await rename(move.to, move.from);
        restoredTargets.add(move.from);
      } catch (restoreErr) {
        unrestored.push(
          `failed to restore previous workflow envelope ${move.from}; the only copy is at ` +
            `${move.to} -- move it back by hand before retrying: ${errorMessage(restoreErr)}`,
        );
      }
    }

    // CR-01: never remove the staging root while it still holds the only copy
    // of a previous envelope. `cleanupStaging` is a recursive rm and `.previous/`
    // is inside it, so cleaning up here would delete the bytes the restore loop
    // above just reported it could not put back.
    const cleanupLeak =
      unrestored.length > 0
        ? `left ${STAGING_LABEL} at ${prepared.stagingRoot} in place: it still holds ` +
          `${unrestored.length} unrestored previous workflow envelope(s)`
        : await cleanupStaging(prepared.stagingRoot, STAGING_LABEL);

    // CR-02: a target the restore loop reclaimed no longer holds this commit's
    // envelope, whatever the reversal reported. `rename(2)` replaces an
    // existing regular file, and a replaced name has ONE target path in both
    // lists, so a failed reversal followed by a successful restore leaves the
    // PREVIOUS envelope there. Reporting the name anyway would hand the caller
    // a removal payload that deletes the bytes the rollback just recovered.
    //
    // Reversed back into discovery order: `completedRenames` was walked
    // backwards to unwind it.
    reportPlaced(
      stillPlaced
        .reverse()
        .filter((pair) => !restoredTargets.has(pair.to))
        .map((pair) => pair.name),
    );
    throw appendLeaks(err, [...rollbackLeaks, ...unrestored, cleanupLeak]);
  }

  reportPlaced(prepared._renamePairs.map((pair) => pair.name));
  return cleanupStaging(prepared.stagingRoot, STAGING_LABEL);
}

/**
 * Abort a prepared staging. Cleans up the staging directory; the noop branch
 * has nothing to clean.
 */
export async function abortPreparedWorkflows(
  prepared: PreparedWorkflowsStaging,
): Promise<string | undefined> {
  if (prepared.kind === "noop") {
    return undefined;
  }

  return cleanupStaging(prepared.stagingRoot, STAGING_LABEL);
}

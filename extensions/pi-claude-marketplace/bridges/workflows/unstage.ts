// bridges/workflows/unstage.ts
//
// WorkflowsBridge: remove previously-staged workflow envelopes by name.
// ENOENT-tolerant per-name unlink (idempotent on repeated calls).
//
// Workflows have no on-disk index and need no marker check. The saved
// directory IS shared -- with the user's own hand-saved workflows and with
// every other plugin -- so removal is strictly by recorded name: nothing else
// in the directory is enumerated, read or unlinked. The `<plugin>:` prefix is
// what keeps those names from colliding.
//
// This is the only thing that cleans up after a failed install. The envelopes
// live outside every scope root, so no scope-root cleanup will ever find them.
//
// Two failure policies, split by class rather than by position: an ordinary
// per-name failure accumulates into `failed[]` and the loop carries on
// (WLIF-03), while a containment refusal is raised to the caller (PI-14). The
// loop runs to completion either way, so choosing the second policy costs the
// envelopes recorded after a refused name nothing.

import { unlink } from "node:fs/promises";

import { errorMessage } from "../../shared/errors.ts";
import { PathContainmentError } from "../../shared/path-safety.ts";

import type {
  UnstageWorkflowFailure,
  UnstageWorkflowsInput,
  UnstageWorkflowsResult,
} from "./types.ts";

export async function unstagePluginWorkflows(
  input: UnstageWorkflowsInput,
): Promise<UnstageWorkflowsResult> {
  const removed: string[] = [];
  const failed: UnstageWorkflowFailure[] = [];
  // PI-14: raised after the loop rather than at the point of refusal -- see the
  // catch below for why it is neither thrown there nor recorded in `failed[]`.
  let refusal: PathContainmentError | undefined;

  for (const name of input.previousWorkflowNames) {
    try {
      // The bundle's composer runs assertSafeName + assertPathInside itself, so
      // there is no second containment check at this call site. It sits inside
      // the block because it REFUSES as well as composes: it throws
      // `SymlinkRefusedError` when the leaf it built is a symlink, and the
      // saved directory is shared with the user's own hand-saved workflows and
      // with every other tool, so a link can appear at a recorded name at any
      // time.
      const target = await input.locations.workflowArtifactPath(name);

      await unlink(target);
      removed.push(name);
    } catch (err) {
      if (err instanceof PathContainmentError) {
        // PI-14: a containment refusal is NOT an ordinary per-name failure and
        // never becomes a soft row. `shared/path-safety.ts` states that policy
        // on the class itself, and the ledger that will drive this function
        // honors it by `instanceof` on a THROW
        // (`transaction/phase-ledger.ts::rollbackExecuted`), so folding the
        // refusal into `failed[]` would deny the ledger the class it bypasses
        // on and lose the containment cause entirely.
        //
        // The throw is deferred to the end of the loop rather than taken here
        // because the two policies are compatible: the envelopes recorded after
        // a refused name are executable code outside every scope root, and
        // abandoning them is the WLIF-03 failure this loop exists to avoid.
        // The FIRST refusal is the one raised -- every later one is reached
        // only by continuing past it.
        refusal ??= err;
        continue;
      }

      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        // WLIF-03: accumulate rather than throw. A throw at the first bad name
        // would abandon every later envelope -- executable files left behind,
        // and the caller told nothing about them. The loop continues so the
        // caller learns the full picture in one pass.
        failed.push({ name, reason: errorMessage(err) });
        continue;
      }
      // ENOENT: the previously-staged file is already gone (e.g. a prior
      // failed install never finished commit). Idempotent -- skip without
      // adding to `removed`.
    }
  }

  if (refusal !== undefined) {
    // Raised bare. Wrapping it -- `appendLeaks` and friends return a plain
    // `Error` -- would carry the text and destroy the class, which is the one
    // thing the caller narrows on.
    throw refusal;
  }

  return {
    removedNames: Object.freeze(removed),
    warnings: Object.freeze<string[]>([]),
    failed: Object.freeze(failed),
  };
}

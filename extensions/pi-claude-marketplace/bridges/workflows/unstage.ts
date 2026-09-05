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

import { unlink } from "node:fs/promises";

import { errorMessage } from "../../shared/errors.ts";

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

  for (const name of input.previousWorkflowNames) {
    // The bundle's composer runs assertSafeName + assertPathInside itself, so
    // there is no second containment check at this call site.
    const target = await input.locations.workflowArtifactPath(name);

    try {
      await unlink(target);
      removed.push(name);
    } catch (err) {
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

  return {
    removedNames: Object.freeze(removed),
    warnings: Object.freeze<string[]>([]),
    failed: Object.freeze(failed),
  };
}

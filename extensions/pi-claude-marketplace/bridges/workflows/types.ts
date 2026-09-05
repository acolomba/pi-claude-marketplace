// bridges/workflows/types.ts
//
// Type definitions for the workflows bridge.
//
// `PreparedWorkflowsStaging` is a discriminated union over `kind: "noop" |
// "staged"`. The "noop" branch carries no staging-dir state because the
// short-circuit (no admitted workflows AND no previous names) avoids creating
// one -- which is what keeps a plugin with no workflows from bringing the host
// engine's storage root into existence (WPTH-05). The "staged" branch carries
// the absolute `stagingRoot` plus the per-file `_renamePairs` and
// `_previousNames` consumed by `commitPreparedWorkflows`. Underscore-prefixed
// fields are bridge-internal commit state -- they are intentionally NOT
// re-exported from the barrel (`bridges/workflows/index.ts`) so external
// consumers cannot read or mutate them.

import type { MaterializablePlugin } from "../../domain/resolver.ts";
import type { WorkflowVerdict } from "../../domain/workflow-script.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";

/**
 * One script discovered under `componentPaths.workflows`, admitted or not.
 *
 * Every verdict arm is carried, not just the admitted two: `install` needs the
 * skipped and refused arms to report them, and `info` needs the admitted ones
 * to render, so a single read serves both surfaces.
 */
export interface DiscoveredWorkflow {
  /** The decision `domain/workflow-script.ts` reached for this file. */
  readonly verdict: WorkflowVerdict;
  /** Absolute path to the source script. */
  readonly scriptFile: string;
  /**
   * Source bytes, read once here and reused by `stage`. The commands analog
   * re-reads each file at stage time; copying that here would double the I/O
   * for no gain, because discovery must read the body anyway to find
   * `meta.name`.
   */
  readonly source: string;
}

/**
 * The minimum a discovery target must expose: where the plugin lives, and which
 * directories under it were admitted as workflow directories.
 *
 * NFR-7 still holds -- `pluginRoot` is required, so only a resolver arm that
 * carries one satisfies it, and a `MaterializablePlugin` is assignable as-is.
 * The read-only `info` surface re-derives a plugin root for the arm the resolver
 * could not resolve, and consumes the same discovery through this shape rather
 * than through a second enumeration of its own.
 */
export interface WorkflowDiscoveryTarget {
  readonly pluginRoot: string;
  readonly componentPaths: { readonly workflows: readonly string[] };
}

/** Return shape: `{ discovered, warnings }`. */
export interface DiscoverPluginWorkflowsResult {
  readonly discovered: readonly DiscoveredWorkflow[];
  readonly warnings: readonly string[];
}

/**
 * WBRG-01: the host engine's saved-workflow record minus the three fields it
 * sets itself on read (`location`, `path`, `savedAt`).
 *
 * `name` MUST equal the file stem. The engine composes `load(name)` and
 * `delete(name)` as `join(dir, name + ".json")` while `list()` reports this
 * field, so a divergence produces a workflow that lists but can never be
 * loaded or deleted.
 *
 * `description` is OMITTED when the script declares none. It is never
 * synthesized from the file name or the plugin name: a synthesized description
 * is indistinguishable from a declared one and would hide the divergence. The
 * engine falls back to `Saved workflow: <name>` at registration, so omitting
 * the key costs nothing.
 */
export interface WorkflowEnvelope {
  readonly name: string;
  readonly description?: string;
  /**
   * The Claude source, byte-for-byte. Never transformed or re-encoded --
   * discovery refuses a script whose bytes do not survive a UTF-8 round trip
   * rather than carrying a U+FFFD-substituted copy of it here.
   */
  readonly script: string;
}

/** Input bundle for `prepareStageWorkflows`. */
export interface StageWorkflowsInput {
  readonly locations: ScopedLocations;
  readonly pluginName: string;
  /** NFR-7: the materializable arm only -- a raw resolved union has no pluginRoot. */
  readonly resolved: MaterializablePlugin;
  /** Names previously staged for this plugin -- read from state.json on re-stage. */
  readonly previousWorkflowNames?: readonly string[];
}

/** Result returned to callers after commit (or noop). */
export interface StageWorkflowsCommitResult {
  readonly stagedNames: readonly string[];
  readonly warnings: readonly string[];
}

/** Discriminated union -- `kind: "noop" | "staged"`. */
export type PreparedWorkflowsStaging = PreparedWorkflowsNoop | PreparedWorkflowsStaged;

/** Short-circuit branch: nothing admitted, no previous names. Commit is a no-op. */
export interface PreparedWorkflowsNoop {
  readonly kind: "noop";
  readonly result: StageWorkflowsCommitResult;
}

/** Staged branch: per-workflow envelopes written under `stagingRoot`, awaiting commit. */
export interface PreparedWorkflowsStaged {
  readonly kind: "staged";
  readonly locations: ScopedLocations;
  /** Absolute path: `<workflowsStagingDir>/<uuid>/`. */
  readonly stagingRoot: string;
  readonly result: StageWorkflowsCommitResult;
  /** Bridge-internal -- previous names to remove on commit (re-stage path). */
  readonly _previousNames: readonly string[];
  /**
   * Bridge-internal -- per-file rename pairs applied at commit. `name` is the
   * generated name the pair carries, so the commit can report exactly which
   * names reached a target without re-deriving one from a basename.
   */
  readonly _renamePairs: readonly { name: string; from: string; to: string }[];
}

/** Options bundle for `commitPreparedWorkflows`. */
export interface CommitWorkflowsOptions {
  /**
   * Called exactly ONCE per commit -- on the success path AND before the
   * throw on every failure path -- with the names whose envelope is sitting at
   * its target path as a result of this commit.
   *
   * This is the caller's removal payload, and it is reported structurally
   * rather than derived from the thrown error's type because "did this commit
   * place anything" and "what kind of error was raised" are different
   * questions. A refusal places nothing; so does an lstat failure inside the
   * occupancy check; so does a mid-sequence rename failure whose reversal loop
   * fully succeeded. A caller that unlinks a name this commit did not place
   * deletes either a foreign file or a previous envelope the rollback just
   * restored.
   */
  readonly onPlaced?: (placedNames: readonly string[]) => void;
}

/** Input bundle for `unstagePluginWorkflows`. */
export interface UnstageWorkflowsInput {
  readonly locations: ScopedLocations;
  readonly previousWorkflowNames: readonly string[];
}

/**
 * WLIF-03: one recorded name the unstage could not remove, and why.
 *
 * The reason is carried as structured data rather than folded into a message
 * string because the leftover is EXECUTABLE code: a consumer deciding what to
 * report, retry or record must be able to read per-name reasons without
 * re-parsing prose.
 */
export interface UnstageWorkflowFailure {
  readonly name: string;
  readonly reason: string;
}

/** Result of `unstagePluginWorkflows`. */
export interface UnstageWorkflowsResult {
  readonly removedNames: readonly string[];
  readonly warnings: readonly string[];
  /**
   * Names whose unlink failed for a reason other than ENOENT. Required rather
   * than optional so every construction site is compile-forced to answer the
   * question; an already-absent envelope is idempotent success (NFR-3) and
   * never lands here.
   *
   * Neither does a containment refusal: PI-14 raises that class to the caller
   * instead of softening it into a row, so a result exists at all only when
   * every recorded name was composed inside the saved directory.
   */
  readonly failed: readonly UnstageWorkflowFailure[];
}

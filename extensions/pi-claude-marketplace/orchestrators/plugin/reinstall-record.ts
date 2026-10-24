import {
  CleanupContextError,
  composeErrorWithCauseChain,
  DependencyDeclarationsUnreadableError,
  findManualRecoveryError,
  LayerConfigUnreadableError,
  ManualRecoveryError,
  PluginInBaseLayerOnlyError,
  PluginInLocalLayerOnlyError,
  PluginShapeError,
  PluginUpdateConcurrencyError,
  StateLockHeldError,
} from "../../shared/errors.ts";
import { ownValue } from "../../shared/own-key.ts";

import type { UpdatePhase3Failure, UpdateRunOutcome } from "./update-swap.ts";
import type { ContentReason } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type {
  ReinstallFailedOutcome,
  ReinstallPluginOutcome,
  ReinstallSkippedOutcome,
  RevisionMove,
} from "../types.ts";

/** Identity shared by every composed reinstall outcome. */
export interface ReinstallOutcomeTarget {
  readonly name: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

export interface RecordSkippedOutcomeInput extends ReinstallOutcomeTarget {
  readonly partition: "skipped";
  readonly reason: "already disabled";
}

/** UPR-04: a target the scope does not record fails, as uninstall's does. */
export interface RecordNotInstalledOutcomeInput extends ReinstallOutcomeTarget {
  readonly partition: "failed";
  readonly reason: "not installed";
}

export interface RecordFailedOutcomeInput extends ReinstallOutcomeTarget {
  readonly partition: "failed";
  readonly error: unknown;
  /** UPR-03: the move the shared runner reported before the failure was thrown. */
  readonly move?: RevisionMove;
}

export type RecordReinstallOutcomeInput =
  RecordSkippedOutcomeInput | RecordNotInstalledOutcomeInput | RecordFailedOutcomeInput;

/** Compose an exact skipped or failed reinstall outcome. */
export function recordReinstallOutcome(input: RecordSkippedOutcomeInput): ReinstallSkippedOutcome;
export function recordReinstallOutcome(
  input: RecordNotInstalledOutcomeInput | RecordFailedOutcomeInput,
): ReinstallFailedOutcome;
export function recordReinstallOutcome(input: RecordReinstallOutcomeInput): ReinstallPluginOutcome {
  switch (input.partition) {
    case "skipped":
      return skippedOutcome(input);
    case "failed":
      return "error" in input ? failedOutcome(input) : notInstalledOutcome(input);
  }
}

/** The phase-3 aggregate the shared swap reported through its direct-mode callback. */
export interface ReinstallPhaseFailure {
  readonly error: Error;
  readonly failures: readonly UpdatePhase3Failure[];
}

/**
 * Projects the shared runner's outcome onto reinstall's. A swapped candidate
 * is `reinstalled` at the version the runner derived (D-18-08), and carries
 * the version and commit it moved from (UPR-02, UPR-03); every verdict the
 * runner reached without swapping keeps its notes and typed reasons.
 */
export function reinstallOutcomeFromRun(
  target: ReinstallOutcomeTarget,
  run: UpdateRunOutcome,
  phaseFailure: ReinstallPhaseFailure | undefined,
): ReinstallPluginOutcome {
  const identity = { name: target.name, marketplace: target.marketplace, scope: target.scope };
  switch (run.partition) {
    case "updated":
      return {
        partition: "reinstalled",
        ...identity,
        version: run.toVersion,
        fromVersion: run.fromVersion,
        ...knownCommits(run),
        stagedAgentNames: run.stagedAgentNames,
        stagedMcpServerNames: run.stagedMcpServerNames,
        declaresAgents: run.declaresAgents,
        declaresMcp: run.declaresMcp,
        declaresWorkflows: run.declaresWorkflows,
        ...(run.degradedKinds !== undefined && { degradedKinds: run.degradedKinds }),
        ...(run.staleWorkflowCommand === true && { staleWorkflowCommand: true }),
        ...(run.partialDegrade !== undefined && { partialDegrade: run.partialDegrade }),
        ...(run.constraint !== undefined && { constraint: run.constraint }),
      };
    case "unchanged":
      // Reinstall's policy never reaches `unchanged`: it skips the same-revision
      // short-circuit, and a record disabled after reinstall read it comes back
      // as an `already disabled` skip (D-18-05). The arm keeps the switch
      // exhaustive and answers the same skip.
      return { partition: "skipped", ...identity, notes: ["already disabled"] };
    case "skipped":
      return { partition: "skipped", ...identity, notes: run.notes, reasons: run.reasons };
    case "failed":
      return {
        partition: "failed",
        ...identity,
        // UPR-03: a commit or finalize failure names the move it attempted.
        ...knownMove(run),
        notes: run.notes,
        reasons: run.reasons,
        // SRC-01: a preflight failure carries the error behind it; a phase-3
        // failure's own error wins.
        ...(run.cause !== undefined && { cause: run.cause }),
        ...(phaseFailure !== undefined && {
          cause: phaseFailure.error,
          rollbackPartial: phaseFailure.failures.map((f) => ({ phase: f.phase, cause: f.cause })),
        }),
        // AFILE-04: a later bridge or the finalize failed after the MCP commit
        // rewrote the file, which the swap does not restore.
        ...(run.mcpConfigNotices !== undefined && { mcpConfigNotices: run.mcpConfigNotices }),
      };
  }
}

/** The sides of a move that are known; an unknown side's key stays absent (NREG-01). */
function knownMove(move: Partial<RevisionMove>): Partial<RevisionMove> {
  return {
    ...(move.fromVersion !== undefined && { fromVersion: move.fromVersion }),
    ...(move.toVersion !== undefined && { toVersion: move.toVersion }),
    ...knownCommits(move),
  };
}

function knownCommits(
  move: Partial<RevisionMove>,
): Pick<Partial<RevisionMove>, "fromCommit" | "toCommit"> {
  return {
    ...(move.fromCommit !== undefined && { fromCommit: move.fromCommit }),
    ...(move.toCommit !== undefined && { toCommit: move.toCommit }),
  };
}

/**
 * Map typed reinstall failures without inventing a closed-set reason. A
 * `CleanupContextError` is read through to the failure it wraps.
 */
export function reinstallReasonsFromError(error: unknown): readonly ContentReason[] | undefined {
  const primary = error instanceof CleanupContextError ? error.primary : error;
  const typed = typedReinstallReason(primary);
  if (typed !== undefined) {
    return [typed];
  }

  const errno = errnoReinstallReason(primary);
  return errno === undefined ? undefined : [errno];
}

/** The reason a typed reinstall failure names, by the failure's class. */
function typedReinstallReason(error: unknown): ContentReason | undefined {
  if (error instanceof PluginShapeError) {
    return "source mismatch";
  }

  if (error instanceof ManualRecoveryError) {
    return "rollback partial";
  }

  // A held per-scope state lock is another operation in progress, not an
  // unreadable plugin. Without this arm the message text falls through
  // `narrowReason`'s last-resort `"unreadable"`, while the reconcile wrapper
  // one layer up maps the same error to `"lock held"` -- one cause, two tokens
  // from the same closed set depending on which layer caught it. `lock held`
  // is the one word that tells the operator to retry.
  if (error instanceof StateLockHeldError) {
    return "lock held";
  }

  if (error instanceof PluginUpdateConcurrencyError) {
    return error.kind === "plugin-updated" ? "concurrently updated" : "concurrently uninstalled";
  }

  if (isLayerRefusal(error)) {
    return layerRefusalReason(error);
  }

  return error instanceof DependencyDeclarationsUnreadableError ? "unreadable" : undefined;
}

/** The reason each filesystem errno code a reinstall can meet names. */
const ERRNO_REASONS: Readonly<Record<string, ContentReason>> = {
  EACCES: "permission denied",
  EPERM: "permission denied",
  ENOENT: "source missing",
  ENOTDIR: "source missing",
};

/** The reason a filesystem failure names, by its errno code. */
function errnoReinstallReason(error: unknown): ContentReason | undefined {
  const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;
  return code === undefined ? undefined : ownValue(ERRNO_REASONS, code);
}

/**
 * LAYER-04 / CFG-03: the refusals of a named reinstall's layer check. A
 * marketplace manifest that failed to parse is not one of them: its message
 * carries parser text from a cloned repository, which never reaches a cause
 * line.
 */
type LayerRefusal =
  PluginInLocalLayerOnlyError | PluginInBaseLayerOnlyError | LayerConfigUnreadableError;

function isLayerRefusal(error: unknown): error is LayerRefusal {
  return (
    error instanceof PluginInLocalLayerOnlyError ||
    error instanceof PluginInBaseLayerOnlyError ||
    error instanceof LayerConfigUnreadableError
  );
}

/**
 * The failures whose message is safe as a rendered cause line: a layer
 * refusal, a held state lock, which names the lock file as the uninstall row
 * does (D-01), and an unreadable dependency walk, whose message is the walk's
 * path-free cause line (D-18-17).
 */
function isRenderedCause(
  error: unknown,
): error is LayerRefusal | StateLockHeldError | DependencyDeclarationsUnreadableError {
  return (
    isLayerRefusal(error) ||
    error instanceof StateLockHeldError ||
    error instanceof DependencyDeclarationsUnreadableError
  );
}

function layerRefusalReason(error: LayerRefusal): ContentReason {
  if (error instanceof PluginInLocalLayerOnlyError) {
    return "plugin in local layer only";
  }

  if (error instanceof PluginInBaseLayerOnlyError) {
    return "plugin in base layer only";
  }

  return "invalid manifest";
}

function skippedOutcome(input: RecordSkippedOutcomeInput): ReinstallSkippedOutcome {
  return {
    partition: "skipped",
    name: input.name,
    marketplace: input.marketplace,
    scope: input.scope,
    notes: [input.reason],
  };
}

function notInstalledOutcome(input: RecordNotInstalledOutcomeInput): ReinstallFailedOutcome {
  return {
    partition: "failed",
    name: input.name,
    marketplace: input.marketplace,
    scope: input.scope,
    notes: [input.reason],
    reasons: [input.reason],
  };
}

function failedOutcome(input: RecordFailedOutcomeInput): ReinstallFailedOutcome {
  const message = composeErrorWithCauseChain(input.error);
  const typedReasons = reinstallReasonsFromError(input.error);
  const isManualRecovery = findManualRecoveryError(input.error) !== undefined;
  const primary = input.error instanceof CleanupContextError ? input.error.primary : input.error;
  return {
    partition: "failed",
    name: input.name,
    marketplace: input.marketplace,
    scope: input.scope,
    ...knownMove(input.move ?? {}),
    notes: [message],
    ...(isManualRecovery && { failureClass: "manual-recovery" as const }),
    ...(typedReasons !== undefined && { reasons: typedReasons }),
    ...(isRenderedCause(primary) && { cause: primary }),
  };
}

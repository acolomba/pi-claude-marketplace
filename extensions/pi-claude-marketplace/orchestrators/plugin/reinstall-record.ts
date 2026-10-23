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
} from "../types.ts";

/** Identity shared by every composed reinstall outcome. */
export interface ReinstallOutcomeTarget {
  readonly name: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

export interface RecordSkippedOutcomeInput extends ReinstallOutcomeTarget {
  readonly partition: "skipped";
  readonly reason: "not installed" | "already disabled";
}

export interface RecordFailedOutcomeInput extends ReinstallOutcomeTarget {
  readonly partition: "failed";
  readonly error: unknown;
}

export type RecordReinstallOutcomeInput = RecordSkippedOutcomeInput | RecordFailedOutcomeInput;

/** Compose an exact skipped or failed reinstall outcome. */
export function recordReinstallOutcome(input: RecordSkippedOutcomeInput): ReinstallSkippedOutcome;
export function recordReinstallOutcome(input: RecordFailedOutcomeInput): ReinstallFailedOutcome;
export function recordReinstallOutcome(input: RecordReinstallOutcomeInput): ReinstallPluginOutcome {
  switch (input.partition) {
    case "skipped":
      return skippedOutcome(input);
    case "failed":
      return failedOutcome(input);
  }
}

/** The phase-3 aggregate the shared swap reported through its direct-mode callback. */
export interface ReinstallPhaseFailure {
  readonly error: Error;
  readonly failures: readonly UpdatePhase3Failure[];
}

/**
 * Projects the shared runner's outcome onto reinstall's. A swapped candidate
 * is `reinstalled` at the version the runner derived (D-18-08); every verdict
 * the runner reached without swapping keeps its notes and typed reasons.
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
      // Under reinstall's policy only the preflight's disabled-record branch
      // answers `unchanged`: the record was disabled after reinstall read it.
      return { partition: "skipped", ...identity, notes: ["already disabled"] };
    case "skipped":
      return { partition: "skipped", ...identity, notes: run.notes, reasons: run.reasons };
    case "failed":
      return {
        partition: "failed",
        ...identity,
        notes: run.notes,
        reasons: run.reasons,
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
    notes: [message],
    ...(isManualRecovery && { failureClass: "manual-recovery" as const }),
    ...(typedReasons !== undefined && { reasons: typedReasons }),
    ...(isRenderedCause(primary) && { cause: primary }),
  };
}

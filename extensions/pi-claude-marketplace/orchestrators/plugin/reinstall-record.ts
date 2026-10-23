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
import { ownValue, setOwn } from "../../shared/own-key.ts";

import { retiresWorkflowCommand } from "./shared.ts";

import type { MaterializablePlugin } from "../../domain/resolver-types.ts";
import type { ExtensionState, PluginInstallRecord } from "../../persistence/state-io.ts";
import type { HookSummaryEntry } from "../../shared/concerns/hooks.ts";
import type { ContentReason } from "../../shared/notification-types.ts";
import type { DegradeKind } from "../../shared/notify-reasons.ts";
import type { Scope } from "../../shared/types.ts";
import type {
  ReinstallFailedOutcome,
  ReinstallPluginOutcome,
  ReinstallReinstalledOutcome,
  ReinstallSkippedOutcome,
} from "../types.ts";
import type { ReinstallPreparedHandles } from "./reinstall-replace.ts";

/** Identity shared by every composed reinstall outcome. */
export interface ReinstallOutcomeTarget {
  readonly name: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

export interface RecordReinstalledOutcomeInput extends ReinstallOutcomeTarget {
  readonly partition: "reinstalled";
  readonly state: ExtensionState;
  readonly oldRecord: PluginInstallRecord;
  readonly installable: MaterializablePlugin;
  readonly handles: ReinstallPreparedHandles;
  readonly hookEntries: readonly HookSummaryEntry[] | undefined;
  /**
   * Whether the reinstalled entry is a git-backed source (url / git-subdir /
   * github). Only a git source's reinstall re-pins to its OLD recorded sha
   * (PURL-07); a `path` source re-resolves through the marketplace's current
   * checkout instead, so carrying its old `resolvedSha` forward would name a
   * commit the fresh `resolvedSource` no longer sits at.
   */
  readonly isGitSource: boolean;
  /**
   * WLIF-01 / T-112-15: the envelope names the workflows commit REPORTED
   * placing, never the prepared staged names -- a commit can stage three and
   * place two, and a record that overstates what is on disk is what the next
   * removal walks.
   */
  readonly placedWorkflowNames: readonly string[];
}

export interface RecordSkippedOutcomeInput extends ReinstallOutcomeTarget {
  readonly partition: "skipped";
  readonly reason: "not installed" | "already disabled";
}

export interface RecordFailedOutcomeInput extends ReinstallOutcomeTarget {
  readonly partition: "failed";
  readonly error: unknown;
}

export type RecordReinstallOutcomeInput =
  RecordReinstalledOutcomeInput | RecordSkippedOutcomeInput | RecordFailedOutcomeInput;

/** Persist a successful reinstall or compose an exact non-success outcome. */
export function recordReinstallOutcome(
  input: RecordReinstalledOutcomeInput,
): ReinstallReinstalledOutcome;
export function recordReinstallOutcome(input: RecordSkippedOutcomeInput): ReinstallSkippedOutcome;
export function recordReinstallOutcome(input: RecordFailedOutcomeInput): ReinstallFailedOutcome;
export function recordReinstallOutcome(input: RecordReinstallOutcomeInput): ReinstallPluginOutcome {
  switch (input.partition) {
    case "skipped":
      return skippedOutcome(input);
    case "failed":
      return failedOutcome(input);
    case "reinstalled":
      return recordReinstalledOutcome(input);
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

function recordReinstalledOutcome(
  input: RecordReinstalledOutcomeInput,
): ReinstallReinstalledOutcome {
  const marketplace = ownValue(input.state.marketplaces, input.marketplace);
  if (marketplace === undefined || ownValue(marketplace.plugins, input.name) === undefined) {
    throw new Error(
      `Plugin "${input.name}" was concurrently removed from marketplace "${input.marketplace}".`,
    );
  }

  const resources = resourcesFromHandles(
    input.handles,
    input.placedWorkflowNames,
    input.name,
    input.installable,
  );
  setOwn(marketplace.plugins, input.name, {
    version: input.oldRecord.version,
    resolvedSource: input.installable.pluginRoot,
    ...(input.isGitSource &&
      input.oldRecord.resolvedSha !== undefined && {
        resolvedSha: input.oldRecord.resolvedSha,
      }),
    compatibility: {
      installable: input.installable.state === "installable",
      notes: [...input.installable.notes],
      supported: [...input.installable.supported],
      unsupported: [...input.installable.unsupported],
    },
    resources,
    ...(input.hookEntries !== undefined && { hookEntries: [...input.hookEntries] }),
    enabled: true,
    // LOAD-02: `dependencyDisabled` is DELIBERATELY not named here, exactly as
    // it is not named at the install ledger's state phase. This literal rebuilds
    // the record from `oldRecord` field by field, so the field's absence is what
    // clears the load-time check's marker on a plugin that is live again. Do not
    // carry it forward from `oldRecord`: a stale marker on a re-materialized
    // record would read as a hold the check still owns. The rollback path is the
    // deliberate opposite -- it restores a `clonePluginRecord` snapshot, which
    // PRESERVES the marker, because a restore puts the record back as it was.
    // D-04-01: a reinstall replaces the artifacts, not the reason the plugin
    // is here -- the old record's provenance carries forward with installedAt.
    // D-04-07 names `install` alone as the verb that promotes a dependency the
    // user then asks for by name; `reinstall <dependency>` also names it and
    // deliberately does NOT promote, so the ratchet's boundary is the verb.
    provenance: input.oldRecord.provenance,
    installedAt: input.oldRecord.installedAt,
    updatedAt: new Date().toISOString(),
  });

  // WR-06: `[]` stated HERE rather than defaulted, because the reasoning that
  // makes it safe is local to this site: this projection feeds only
  // `stagedAgentNames`, `stagedMcpServerNames`, `declaresAgents`, and
  // `declaresMcp`, none of which reads `workflows`, so an empty workflow
  // inventory here is inert.
  const outcomeResources = resourcesFromHandles(input.handles, []);
  const degradedKinds = Array.from(
    new Set<DegradeKind>([
      ...(input.handles.skills.result.degraded.length > 0 ? (["skill"] as const) : []),
      ...(input.handles.commands.result.degraded.length > 0 ? (["command"] as const) : []),
    ]),
  );
  return {
    partition: "reinstalled",
    name: input.name,
    marketplace: input.marketplace,
    scope: input.scope,
    version: input.oldRecord.version,
    stagedAgentNames: outcomeResources.agents,
    stagedMcpServerNames: outcomeResources.mcpServers,
    declaresAgents: outcomeResources.agents.length > 0,
    declaresMcp: outcomeResources.mcpServers.length > 0,
    declaresWorkflows: resources.workflows.length > 0,
    ...(degradedKinds.length > 0 && { degradedKinds }),
    // WLIF-06: the record's PRE-reinstall inventory minus what the replace
    // step reported placing. A source that dropped or renamed a workflow
    // leaves the old generated name in that difference, and the command it
    // registered stays live until a reload.
    ...(retiresWorkflowCommand(input.oldRecord.resources.workflows, input.placedWorkflowNames) && {
      staleWorkflowCommand: true,
    }),
  };
}

function resourcesFromHandles(
  handles: ReinstallPreparedHandles,
  placedWorkflowNames: readonly string[],
  plugin?: string,
  installable?: MaterializablePlugin,
): PluginInstallRecord["resources"] {
  return {
    skills: handles.skills.result.recorded.map((record) => record.generatedName),
    prompts: handles.commands.result.recorded.map((record) => record.generatedName),
    agents: handles.agents.result.recorded.map((record) => record.generatedName),
    mcpServers: handles.mcp.result.recorded.map((record) => record.generatedName),
    hooks: plugin !== undefined && installable?.hooksConfigPath !== undefined ? [plugin] : [],
    workflows: [...placedWorkflowNames],
  };
}

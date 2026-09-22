import {
  composeErrorWithCauseChain,
  findManualRecoveryError,
  ManualRecoveryError,
  PluginShapeError,
  StateLockHeldError,
} from "../../shared/errors.ts";

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

/** Map typed reinstall failures without inventing a closed-set reason. */
export function reinstallReasonsFromError(error: unknown): readonly ContentReason[] | undefined {
  if (error instanceof PluginShapeError) {
    return ["source mismatch"] as const;
  }

  if (error instanceof ManualRecoveryError) {
    return ["rollback partial"] as const;
  }

  // A held per-scope state lock is another operation in progress, not an
  // unreadable plugin. Without this arm the message text falls through
  // `narrowReason`'s last-resort `"unreadable"`, while the reconcile wrapper
  // one layer up maps the same error to `"lock held"` -- one cause, two tokens
  // from the same closed set depending on which layer caught it. `lock held`
  // is the one word that tells the operator to retry.
  if (error instanceof StateLockHeldError) {
    return ["lock held"] as const;
  }

  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") {
      return ["permission denied"] as const;
    }

    if (code === "ENOENT" || code === "ENOTDIR") {
      return ["source missing"] as const;
    }
  }

  return undefined;
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
  return {
    partition: "failed",
    name: input.name,
    marketplace: input.marketplace,
    scope: input.scope,
    notes: [message],
    ...(isManualRecovery && { failureClass: "manual-recovery" as const }),
    ...(typedReasons !== undefined && { reasons: typedReasons }),
  };
}

function recordReinstalledOutcome(
  input: RecordReinstalledOutcomeInput,
): ReinstallReinstalledOutcome {
  const marketplace = input.state.marketplaces[input.marketplace];
  if (marketplace?.plugins[input.name] === undefined) {
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
  marketplace.plugins[input.name] = {
    version: input.oldRecord.version,
    resolvedSource: input.installable.pluginRoot,
    ...(input.oldRecord.resolvedSha !== undefined && {
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
    installedAt: input.oldRecord.installedAt,
    updatedAt: new Date().toISOString(),
  };

  // WR-06: `[]` stated HERE rather than defaulted, because the reasoning that
  // makes it safe is local to this site: this projection feeds only
  // `stagedAgentNames`, `stagedMcpServerNames`, `declaresAgents`,
  // `declaresMcp`, and `resourcesChanged`, none of which reads `workflows`,
  // so an empty workflow inventory here is inert.
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
    resourcesChanged: resourcesChanged(input.oldRecord.resources, outcomeResources),
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

function resourcesChanged(
  oldResources: PluginInstallRecord["resources"],
  next: PluginInstallRecord["resources"],
): boolean {
  return (
    next.skills.length > 0 ||
    next.prompts.length > 0 ||
    next.agents.length > 0 ||
    next.mcpServers.length > 0 ||
    oldResources.skills.length > 0 ||
    oldResources.prompts.length > 0 ||
    oldResources.agents.length > 0 ||
    oldResources.mcpServers.length > 0
  );
}

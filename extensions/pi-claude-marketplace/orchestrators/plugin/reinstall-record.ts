import {
  composeErrorWithCauseChain,
  findManualRecoveryError,
  ManualRecoveryError,
  PluginShapeError,
} from "../../shared/errors.ts";

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

  const resources = resourcesFromHandles(input.handles, input.name, input.installable);
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

  const outcomeResources = resourcesFromHandles(input.handles);
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
    resourcesChanged: resourcesChanged(input.oldRecord.resources, outcomeResources),
    ...(degradedKinds.length > 0 && { degradedKinds }),
  };
}

function resourcesFromHandles(
  handles: ReinstallPreparedHandles,
  plugin?: string,
  installable?: MaterializablePlugin,
): PluginInstallRecord["resources"] {
  return {
    skills: handles.skills.result.recorded.map((record) => record.generatedName),
    prompts: handles.commands.result.recorded.map((record) => record.generatedName),
    agents: handles.agents.result.recorded.map((record) => record.generatedName),
    mcpServers: handles.mcp.result.recorded.map((record) => record.generatedName),
    hooks: plugin !== undefined && installable?.hooksConfigPath !== undefined ? [plugin] : [],
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

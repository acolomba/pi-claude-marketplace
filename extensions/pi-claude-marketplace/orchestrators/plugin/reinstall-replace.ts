import { readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import {
  abortPreparedAgents,
  finalizeAgentsReplacement,
  prepareStagePluginAgents,
  replacePreparedAgents,
  rollbackAgentsReplacement,
} from "../../bridges/agents/index.ts";
import {
  abortPreparedCommands,
  finalizeCommandsReplacement,
  prepareStageCommands,
  replacePreparedCommands,
  rollbackCommandsReplacement,
} from "../../bridges/commands/index.ts";
import { compileIfPredicate } from "../../bridges/hooks/if-field/index.ts";
import { removeHookConfig, writeHookConfig } from "../../bridges/hooks/index.ts";
import {
  abortPreparedMcp,
  finalizeMcpReplacement,
  prepareStageMcpServers,
  replacePreparedMcp,
  rollbackMcpReplacement,
} from "../../bridges/mcp/index.ts";
import {
  abortPreparedSkills,
  finalizeSkillsReplacement,
  prepareStageSkills,
  replacePreparedSkills,
  rollbackSkillsReplacement,
} from "../../bridges/skills/index.ts";
import { parseHooksConfig, projectHookSummaryEntries } from "../../domain/components/hooks.ts";
import { errorMessage, errorWithManualRecovery } from "../../shared/errors.ts";
import { createRemovalOps, type RemovalOps } from "../../shared/fs-utils.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";

import { splitStagingWarnings } from "./shared.ts";

import type { AgentsReplacement, PreparedAgentsStaging } from "../../bridges/agents/index.ts";
import type { CommandsReplacement, PreparedCommandsStaging } from "../../bridges/commands/index.ts";
import type { McpReplacement, PreparedMcpStaging } from "../../bridges/mcp/index.ts";
import type { PreparedSkillsStaging, SkillsReplacement } from "../../bridges/skills/index.ts";
import type { MaterializablePlugin } from "../../domain/resolver-types.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { PluginInstallRecord } from "../../persistence/state-io.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { HookSummaryEntry } from "../../shared/concerns/hooks.ts";
import type { Scope } from "../../shared/types.ts";

type BridgePhase = "skills" | "commands" | "agents" | "mcp";

/** Filesystem removal seam used after a committed reinstall. */
export type RemoveDataDirFn = (
  path: string,
  options: { recursive: true; force: true },
) => Promise<void>;

/** Prepared bridge handles retained until state persistence commits. */
export interface ReinstallPreparedHandles {
  readonly skills: PreparedSkillsStaging;
  readonly commands: PreparedCommandsStaging;
  readonly agents: PreparedAgentsStaging;
  readonly mcp: PreparedMcpStaging;
}

interface PartialPreparedHandles {
  skills?: PreparedSkillsStaging;
  commands?: PreparedCommandsStaging;
  agents?: PreparedAgentsStaging;
  mcp?: PreparedMcpStaging;
}

type ReplacementEntry =
  | { readonly phase: "skills"; readonly handle: SkillsReplacement }
  | { readonly phase: "commands"; readonly handle: CommandsReplacement }
  | { readonly phase: "agents"; readonly handle: AgentsReplacement }
  | { readonly phase: "mcp"; readonly handle: McpReplacement };

/** A replaced plugin plus the compensation ledger kept until commit. */
export interface ReinstallReplacement {
  readonly handles: ReinstallPreparedHandles;
  // fallow-ignore-next-line private-type-leak -- replacement entries are an opaque compensation token for rollback/finalize.
  readonly replacements: readonly ReplacementEntry[];
  readonly hookEntries: readonly HookSummaryEntry[] | undefined;
  readonly discoveryWarnings: readonly string[];
  readonly bridgeWarnings: readonly string[];
  /** Operations retained so compensation uses the same transaction owner. */
  readonly operations: ReinstallReplaceOperations;
  /**
   * D-08-12: removal operations retained for the same reason as `operations` --
   * rollback and finalize must perform their cleanup through the collaborator the
   * forward pass used, not a freshly constructed one.
   */
  readonly removalOps: RemovalOps;
}

/** Inputs required to stage and atomically replace every reinstall bridge. */
export interface ReplaceReinstalledPluginInput {
  readonly locations: ScopedLocations;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly installable: MaterializablePlugin;
  readonly pluginDataDir: string;
  readonly oldRecord: PluginInstallRecord;
  readonly agentsDirs: readonly string[];
}

/** Physical bridge operations consumed by the atomic replacement schedule. */
export interface ReinstallReplaceOperations {
  readonly abortPreparedAgents: typeof abortPreparedAgents;
  readonly abortPreparedCommands: typeof abortPreparedCommands;
  readonly abortPreparedMcp: typeof abortPreparedMcp;
  readonly abortPreparedSkills: typeof abortPreparedSkills;
  readonly finalizeAgentsReplacement: typeof finalizeAgentsReplacement;
  readonly finalizeCommandsReplacement: typeof finalizeCommandsReplacement;
  readonly finalizeMcpReplacement: typeof finalizeMcpReplacement;
  readonly finalizeSkillsReplacement: typeof finalizeSkillsReplacement;
  readonly prepareStagePluginAgents: typeof prepareStagePluginAgents;
  readonly prepareStageCommands: typeof prepareStageCommands;
  readonly prepareStageMcpServers: typeof prepareStageMcpServers;
  readonly prepareStageSkills: typeof prepareStageSkills;
  readonly removeHookConfig: typeof removeHookConfig;
  readonly replacePreparedAgents: typeof replacePreparedAgents;
  readonly replacePreparedCommands: typeof replacePreparedCommands;
  readonly replacePreparedMcp: typeof replacePreparedMcp;
  readonly replacePreparedSkills: typeof replacePreparedSkills;
  readonly rollbackAgentsReplacement: typeof rollbackAgentsReplacement;
  readonly rollbackCommandsReplacement: typeof rollbackCommandsReplacement;
  readonly rollbackMcpReplacement: typeof rollbackMcpReplacement;
  readonly rollbackSkillsReplacement: typeof rollbackSkillsReplacement;
  readonly writeHookConfig: typeof writeHookConfig;
}

/** Inputs required for best-effort maintenance after a committed reinstall. */
export interface ReinstallMaintenanceInput {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly plugin: string;
  readonly removeDataDir?: RemoveDataDirFn;
}

/** Owns reinstall's prepare, replacement, compensation, and commit schedule. */
export interface ReinstallTransaction {
  readonly finalizeReinstalledPlugin: typeof finalizeReinstalledPlugin;
  /**
   * D-05-01: the transaction owns which physical bridges the replacement
   * schedule drives, so replacement and compensation reach the same owner.
   */
  readonly replaceOperations: ReinstallReplaceOperations;
  readonly replaceReinstalledPlugin: typeof replaceReinstalledPlugin;
  readonly rollbackReinstalledPlugin: typeof rollbackReinstalledPlugin;
  readonly runPostSuccessMaintenance: typeof runPostSuccessMaintenance;
  readonly withLockedStateTransaction: typeof withLockedStateTransaction;
}

const REAL_REINSTALL_REPLACE_OPERATIONS: ReinstallReplaceOperations = {
  abortPreparedAgents,
  abortPreparedCommands,
  abortPreparedMcp,
  abortPreparedSkills,
  finalizeAgentsReplacement,
  finalizeCommandsReplacement,
  finalizeMcpReplacement,
  finalizeSkillsReplacement,
  prepareStagePluginAgents,
  prepareStageCommands,
  prepareStageMcpServers,
  prepareStageSkills,
  removeHookConfig,
  replacePreparedAgents,
  replacePreparedCommands,
  replacePreparedMcp,
  replacePreparedSkills,
  rollbackAgentsReplacement,
  rollbackCommandsReplacement,
  rollbackMcpReplacement,
  rollbackSkillsReplacement,
  writeHookConfig,
};

/** The production reinstall transaction composed from all physical bridges. */
export const REAL_REINSTALL_TRANSACTION: ReinstallTransaction = {
  finalizeReinstalledPlugin,
  replaceOperations: REAL_REINSTALL_REPLACE_OPERATIONS,
  replaceReinstalledPlugin,
  rollbackReinstalledPlugin,
  runPostSuccessMaintenance,
  withLockedStateTransaction,
};

const defaultRemoveDataDir: RemoveDataDirFn = async (dataDir) => {
  await rm(dataDir, { recursive: true, force: true });
};

/** Prepare every bridge, then replace them as one compensatable operation. */
export async function replaceReinstalledPlugin(
  input: ReplaceReinstalledPluginInput,
  operations: ReinstallReplaceOperations,
): Promise<ReinstallReplacement> {
  // D-08-12: this verb owns the replacement lifecycle, so it constructs the
  // removal operations once and every prepare, replace, rollback, and finalize
  // step below performs its cleanup through that one collaborator.
  const removalOps = createRemovalOps();
  const handles = await prepareAllHandles(removalOps, input, operations);
  const { replacements, hookEntries } = await replaceAll(
    removalOps,
    handles,
    {
      locations: input.locations,
      cwd: input.cwd,
      plugin: input.plugin,
      installable: input.installable,
    },
    operations,
  );
  const warnings = splitHandleWarnings(handles);
  return {
    handles,
    replacements,
    hookEntries,
    discoveryWarnings: warnings.discovery,
    bridgeWarnings: warnings.bridge,
    operations,
    removalOps,
  };
}

/** Roll back every physically replaced bridge in reverse order. */
export async function rollbackReinstalledPlugin(
  replacement: ReinstallReplacement,
): Promise<readonly string[]> {
  return rollbackReplacements(
    replacement.removalOps,
    replacement.replacements,
    replacement.operations,
  );
}

/** Remove bridge backups after the state transaction commits. */
export async function finalizeReinstalledPlugin(
  replacement: ReinstallReplacement,
): Promise<readonly string[]> {
  return finalizeReplacements(
    replacement.removalOps,
    replacement.replacements,
    replacement.operations,
  );
}

/** Run non-fatal cache and data-directory cleanup after commit. */
export async function runPostSuccessMaintenance(
  input: ReinstallMaintenanceInput,
  locations: ScopedLocations,
  completionCache: CompletionCache,
): Promise<readonly string[]> {
  const { scope, marketplace, plugin } = input;
  const warnings: string[] = [];
  try {
    await completionCache.dropMarketplaceCache(
      await locations.pluginCacheFile(marketplace),
      scope,
      marketplace,
    );
  } catch (error) {
    warnings.push(
      `Plugin "${plugin}" reinstalled; completion cache refresh deferred: ${errorMessage(error)}`,
    );
  }

  const dataDir = await locations.pluginDataDir(marketplace, plugin);
  const removeDataDir = input.removeDataDir ?? defaultRemoveDataDir;
  try {
    await removeDataDir(dataDir, { recursive: true, force: true });
  } catch (error) {
    warnings.push(
      `Plugin "${plugin}" reinstalled; data cleanup deferred at ${dataDir}: ${errorMessage(error)}`,
    );
  }

  return Object.freeze(warnings);
}

async function prepareAllHandles(
  ops: RemovalOps,
  input: ReplaceReinstalledPluginInput,
  operations: ReinstallReplaceOperations,
): Promise<ReinstallPreparedHandles> {
  const handles: PartialPreparedHandles = {};
  try {
    handles.skills = await operations.prepareStageSkills(ops, {
      locations: input.locations,
      marketplaceName: input.marketplace,
      pluginName: input.plugin,
      pluginRoot: input.installable.pluginRoot,
      pluginDataDir: input.pluginDataDir,
      resolved: input.installable,
      previousSkillNames: input.oldRecord.resources.skills,
      cwd: input.cwd,
    });
    handles.commands = await operations.prepareStageCommands(ops, {
      locations: input.locations,
      marketplaceName: input.marketplace,
      pluginName: input.plugin,
      pluginRoot: input.installable.pluginRoot,
      pluginDataDir: input.pluginDataDir,
      resolved: input.installable,
      previousCommandNames: input.oldRecord.resources.prompts,
      cwd: input.cwd,
    });
    handles.agents = await operations.prepareStagePluginAgents(ops, {
      locations: input.locations,
      marketplaceName: input.marketplace,
      pluginName: input.plugin,
      pluginRoot: input.installable.pluginRoot,
      pluginDataDir: input.pluginDataDir,
      resolved: input.installable,
      agentsDirs: input.agentsDirs,
      knownSkills: handles.skills.result.recorded.map((record) => record.generatedName),
      cwd: input.cwd,
    });
    handles.mcp = await operations.prepareStageMcpServers({
      locations: input.locations,
      cwd: input.cwd,
      marketplaceName: input.marketplace,
      pluginName: input.plugin,
      servers: input.installable.mcpServers,
      pluginRoot: input.installable.pluginRoot,
      pluginData: input.pluginDataDir,
      sourcePath: `${input.installable.pluginRoot}#mcpServers`,
    });
  } catch (error) {
    throw errorWithManualRecovery(error, await abortPartialHandles(ops, handles, operations));
  }

  return handles as ReinstallPreparedHandles;
}

async function replaceAll(
  ops: RemovalOps,
  handles: ReinstallPreparedHandles,
  hooks: HooksReplaceArgs,
  operations: ReinstallReplaceOperations,
): Promise<{
  readonly replacements: readonly ReplacementEntry[];
  readonly hookEntries: readonly HookSummaryEntry[] | undefined;
}> {
  const replacements: ReplacementEntry[] = [];
  let hookEntries: readonly HookSummaryEntry[] | undefined;
  try {
    const skills = await operations.replacePreparedSkills(ops, handles.skills);
    replacements.push({ phase: "skills", handle: skills });
    const commands = await operations.replacePreparedCommands(ops, handles.commands);
    replacements.push({ phase: "commands", handle: commands });
    const agents = await operations.replacePreparedAgents(ops, handles.agents, { force: true });
    replacements.push({ phase: "agents", handle: agents });
    hookEntries = await commitHooks(hooks, operations);
    const mcp = await operations.replacePreparedMcp(handles.mcp);
    replacements.push({ phase: "mcp", handle: mcp });
  } catch (error) {
    const leaks = [
      ...(await rollbackReplacements(ops, replacements, operations)),
      ...(await abortPartialHandles(ops, handles, operations)),
    ];
    throw errorWithManualRecovery(error, leaks);
  }

  return { replacements: Object.freeze(replacements), hookEntries };
}

interface HooksReplaceArgs {
  readonly locations: ScopedLocations;
  readonly cwd: string;
  readonly plugin: string;
  readonly installable: MaterializablePlugin;
}

async function commitHooks(
  args: HooksReplaceArgs,
  operations: ReinstallReplaceOperations,
): Promise<readonly HookSummaryEntry[] | undefined> {
  const { locations, cwd, plugin, installable } = args;
  if (installable.hooksConfigPath === undefined) {
    await operations.removeHookConfig({ locations, pluginName: plugin });
    return undefined;
  }

  const raw = await readFile(
    path.join(installable.pluginRoot, installable.hooksConfigPath),
    "utf8",
  );
  const parsed = parseHooksConfig(
    raw,
    { homedir: homedir(), cwd, projectRoot: cwd },
    compileIfPredicate,
  );
  if (!parsed.ok) {
    throw new Error(`hooks.json re-parse failed: ${parsed.reason}`);
  }

  await operations.writeHookConfig({
    locations,
    pluginName: plugin,
    pluginRoot: installable.pluginRoot,
    hooksValue: parsed.value,
  });
  return projectHookSummaryEntries(parsed.value);
}

function splitHandleWarnings(handles: ReinstallPreparedHandles): {
  readonly discovery: readonly string[];
  readonly bridge: readonly string[];
} {
  return splitStagingWarnings({
    skills: handles.skills.result.warnings,
    commands: handles.commands.result.warnings,
    agents: handles.agents.result.warnings,
    mcp: handles.mcp.result.warnings,
  });
}

async function abortPartialHandles(
  ops: RemovalOps,
  handles: PartialPreparedHandles,
  operations: ReinstallReplaceOperations,
): Promise<readonly string[]> {
  const leaks: string[] = [];
  if (handles.mcp !== undefined) {
    operations.abortPreparedMcp(handles.mcp);
  }

  if (handles.agents !== undefined) {
    pushLeak(leaks, "agents", await operations.abortPreparedAgents(ops, handles.agents));
  }

  if (handles.commands !== undefined) {
    pushLeak(leaks, "commands", await operations.abortPreparedCommands(ops, handles.commands));
  }

  if (handles.skills !== undefined) {
    pushLeak(leaks, "skills", await operations.abortPreparedSkills(ops, handles.skills));
  }

  return Object.freeze(leaks);
}

async function rollbackReplacements(
  ops: RemovalOps,
  replacements: readonly ReplacementEntry[],
  operations: ReinstallReplaceOperations,
): Promise<readonly string[]> {
  const leaks: string[] = [];
  for (const replacement of [...replacements].reverse()) {
    for (const leak of await rollbackReplacement(ops, replacement, operations)) {
      leaks.push(`${replacement.phase}: ${leak}`);
    }
  }

  return Object.freeze(leaks);
}

async function rollbackReplacement(
  ops: RemovalOps,
  entry: ReplacementEntry,
  operations: ReinstallReplaceOperations,
): Promise<readonly string[]> {
  switch (entry.phase) {
    case "skills":
      return operations.rollbackSkillsReplacement(ops, entry.handle);
    case "commands":
      return operations.rollbackCommandsReplacement(ops, entry.handle);
    case "agents":
      return operations.rollbackAgentsReplacement(ops, entry.handle);
    case "mcp":
      return operations.rollbackMcpReplacement(entry.handle);
  }
}

async function finalizeReplacements(
  ops: RemovalOps,
  replacements: readonly ReplacementEntry[],
  operations: ReinstallReplaceOperations,
): Promise<readonly string[]> {
  const leaks: string[] = [];
  for (const replacement of replacements) {
    for (const leak of await finalizeReplacement(ops, replacement, operations)) {
      leaks.push(`${replacement.phase}: ${leak}`);
    }
  }

  return Object.freeze(leaks);
}

async function finalizeReplacement(
  ops: RemovalOps,
  entry: ReplacementEntry,
  operations: ReinstallReplaceOperations,
): Promise<readonly string[]> {
  switch (entry.phase) {
    case "skills":
      return operations.finalizeSkillsReplacement(ops, entry.handle);
    case "commands":
      return operations.finalizeCommandsReplacement(ops, entry.handle);
    case "agents":
      return operations.finalizeAgentsReplacement(ops, entry.handle);
    case "mcp":
      return operations.finalizeMcpReplacement(entry.handle);
  }
}

function pushLeak(leaks: string[], phase: BridgePhase, leak: string | undefined): void {
  if (leak !== undefined) {
    leaks.push(`${phase}: ${leak}`);
  }
}

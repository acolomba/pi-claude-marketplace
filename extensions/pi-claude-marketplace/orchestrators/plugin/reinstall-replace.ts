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
  readonly replacements: readonly ReplacementEntry[];
  readonly hookEntries: readonly HookSummaryEntry[] | undefined;
  readonly discoveryWarnings: readonly string[];
  readonly bridgeWarnings: readonly string[];
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
  readonly replaceReinstalledPlugin: typeof replaceReinstalledPlugin;
  readonly rollbackReinstalledPlugin: typeof rollbackReinstalledPlugin;
  readonly runPostSuccessMaintenance: typeof runPostSuccessMaintenance;
  readonly withLockedStateTransaction: typeof withLockedStateTransaction;
}

/** The production reinstall transaction composed from all physical bridges. */
export const REAL_REINSTALL_TRANSACTION: ReinstallTransaction = {
  finalizeReinstalledPlugin,
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
): Promise<ReinstallReplacement> {
  const handles = await prepareAllHandles(input);
  const { replacements, hookEntries } = await replaceAll(handles, {
    locations: input.locations,
    cwd: input.cwd,
    plugin: input.plugin,
    installable: input.installable,
  });
  const warnings = splitHandleWarnings(handles);
  return {
    handles,
    replacements,
    hookEntries,
    discoveryWarnings: warnings.discovery,
    bridgeWarnings: warnings.bridge,
  };
}

/** Roll back every physically replaced bridge in reverse order. */
export async function rollbackReinstalledPlugin(
  replacement: ReinstallReplacement,
): Promise<readonly string[]> {
  return rollbackReplacements(replacement.replacements);
}

/** Remove bridge backups after the state transaction commits. */
export async function finalizeReinstalledPlugin(
  replacement: ReinstallReplacement,
): Promise<readonly string[]> {
  return finalizeReplacements(replacement.replacements);
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
  input: ReplaceReinstalledPluginInput,
): Promise<ReinstallPreparedHandles> {
  const handles: PartialPreparedHandles = {};
  try {
    handles.skills = await prepareStageSkills({
      locations: input.locations,
      marketplaceName: input.marketplace,
      pluginName: input.plugin,
      pluginRoot: input.installable.pluginRoot,
      pluginDataDir: input.pluginDataDir,
      resolved: input.installable,
      previousSkillNames: input.oldRecord.resources.skills,
      cwd: input.cwd,
    });
    handles.commands = await prepareStageCommands({
      locations: input.locations,
      marketplaceName: input.marketplace,
      pluginName: input.plugin,
      pluginRoot: input.installable.pluginRoot,
      pluginDataDir: input.pluginDataDir,
      resolved: input.installable,
      previousCommandNames: input.oldRecord.resources.prompts,
      cwd: input.cwd,
    });
    handles.agents = await prepareStagePluginAgents({
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
    handles.mcp = await prepareStageMcpServers({
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
    throw errorWithManualRecovery(error, await abortPartialHandles(handles));
  }

  return handles as ReinstallPreparedHandles;
}

async function replaceAll(
  handles: ReinstallPreparedHandles,
  hooks: HooksReplaceArgs,
): Promise<{
  readonly replacements: readonly ReplacementEntry[];
  readonly hookEntries: readonly HookSummaryEntry[] | undefined;
}> {
  const replacements: ReplacementEntry[] = [];
  let hookEntries: readonly HookSummaryEntry[] | undefined;
  try {
    const skills = await replacePreparedSkills(handles.skills);
    replacements.push({ phase: "skills", handle: skills });
    const commands = await replacePreparedCommands(handles.commands);
    replacements.push({ phase: "commands", handle: commands });
    const agents = await replacePreparedAgents(handles.agents, { force: true });
    replacements.push({ phase: "agents", handle: agents });
    hookEntries = await commitHooks(hooks);
    const mcp = await replacePreparedMcp(handles.mcp);
    replacements.push({ phase: "mcp", handle: mcp });
  } catch (error) {
    const leaks = [
      ...(await rollbackReplacements(replacements)),
      ...(await abortPartialHandles(handles)),
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
): Promise<readonly HookSummaryEntry[] | undefined> {
  const { locations, cwd, plugin, installable } = args;
  if (installable.hooksConfigPath === undefined) {
    await removeHookConfig({ locations, pluginName: plugin });
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

  await writeHookConfig({
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

async function abortPartialHandles(handles: PartialPreparedHandles): Promise<readonly string[]> {
  const leaks: string[] = [];
  if (handles.mcp !== undefined) {
    abortPreparedMcp(handles.mcp);
  }

  if (handles.agents !== undefined) {
    pushLeak(leaks, "agents", await abortPreparedAgents(handles.agents));
  }

  if (handles.commands !== undefined) {
    pushLeak(leaks, "commands", await abortPreparedCommands(handles.commands));
  }

  if (handles.skills !== undefined) {
    pushLeak(leaks, "skills", await abortPreparedSkills(handles.skills));
  }

  return Object.freeze(leaks);
}

async function rollbackReplacements(
  replacements: readonly ReplacementEntry[],
): Promise<readonly string[]> {
  const leaks: string[] = [];
  for (const replacement of [...replacements].reverse()) {
    for (const leak of await rollbackReplacement(replacement)) {
      leaks.push(`${replacement.phase}: ${leak}`);
    }
  }

  return Object.freeze(leaks);
}

async function rollbackReplacement(entry: ReplacementEntry): Promise<readonly string[]> {
  switch (entry.phase) {
    case "skills":
      return rollbackSkillsReplacement(entry.handle);
    case "commands":
      return rollbackCommandsReplacement(entry.handle);
    case "agents":
      return rollbackAgentsReplacement(entry.handle);
    case "mcp":
      return rollbackMcpReplacement(entry.handle);
  }
}

async function finalizeReplacements(
  replacements: readonly ReplacementEntry[],
): Promise<readonly string[]> {
  const leaks: string[] = [];
  for (const replacement of replacements) {
    for (const leak of await finalizeReplacement(replacement)) {
      leaks.push(`${replacement.phase}: ${leak}`);
    }
  }

  return Object.freeze(leaks);
}

async function finalizeReplacement(entry: ReplacementEntry): Promise<readonly string[]> {
  switch (entry.phase) {
    case "skills":
      return finalizeSkillsReplacement(entry.handle);
    case "commands":
      return finalizeCommandsReplacement(entry.handle);
    case "agents":
      return finalizeAgentsReplacement(entry.handle);
    case "mcp":
      return finalizeMcpReplacement(entry.handle);
  }
}

function pushLeak(leaks: string[], phase: BridgePhase, leak: string | undefined): void {
  if (leak !== undefined) {
    leaks.push(`${phase}: ${leak}`);
  }
}

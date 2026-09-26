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
import {
  abortPreparedWorkflows,
  commitPreparedWorkflows,
  prepareStageWorkflows,
  unstagePluginWorkflows,
} from "../../bridges/workflows/index.ts";
import { parseHooksConfig, projectHookSummaryEntries } from "../../domain/components/hooks.ts";
import { errorMessage, errorWithManualRecovery } from "../../shared/errors.ts";
import { createRemovalOps, type RemovalOps } from "../../shared/fs-utils.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";

import { splitStagingWarnings } from "./shared.ts";

import type { AgentsReplacement, PreparedAgentsStaging } from "../../bridges/agents/index.ts";
import type { CommandsReplacement, PreparedCommandsStaging } from "../../bridges/commands/index.ts";
import type { McpReplacement, PreparedMcpStaging } from "../../bridges/mcp/index.ts";
import type { PreparedSkillsStaging, SkillsReplacement } from "../../bridges/skills/index.ts";
import type { PreparedWorkflowsStaging } from "../../bridges/workflows/index.ts";
import type { MaterializablePlugin } from "../../domain/resolver-types.ts";
import type { InstalledReferenceNames } from "../../domain/skill-tokens.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { PluginInstallRecord } from "../../persistence/state-io.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { HookSummaryEntry } from "../../shared/concerns/hooks.ts";
import type { Scope } from "../../shared/types.ts";
import type { RmOptions } from "node:fs";

type BridgePhase = "skills" | "commands" | "agents" | "mcp" | "workflows";

/**
 * Filesystem removal seam used after a committed reinstall. The options
 * narrow Node's own removal options: both slots are optional booleans there,
 * and pinning each to `true` is what stops a non-recursive or non-forced
 * removal from satisfying the seam.
 */
export type RemoveDataDirFn = (
  path: string,
  options: RmOptions & { recursive: true; force: true },
) => Promise<void>;

/** Prepared bridge handles retained until state persistence commits. */
export interface ReinstallPreparedHandles {
  readonly skills: PreparedSkillsStaging;
  readonly commands: PreparedCommandsStaging;
  readonly agents: PreparedAgentsStaging;
  readonly mcp: PreparedMcpStaging;
  /**
   * WLIF-01: the workflows bridge has no `replacePrepared*` twin, and needs
   * none -- the prepare plus commit pair IS the replace shape. See `replaceAll`
   * for why that keeps `ReplacementEntry` four-armed.
   */
  readonly workflows: PreparedWorkflowsStaging;
}

interface PartialPreparedHandles {
  skills?: PreparedSkillsStaging;
  commands?: PreparedCommandsStaging;
  agents?: PreparedAgentsStaging;
  mcp?: PreparedMcpStaging;
  workflows?: PreparedWorkflowsStaging;
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
  /**
   * WLIF-01: the workflows step is outside `replacements[]` (see
   * `ReplacementEntry`), so `rollbackReinstalledPlugin` cannot reach it by
   * walking that array. `locations` and `placedWorkflowNames` are threaded out
   * here so the rollback can unplace exactly what the commit reported placing.
   */
  readonly locations: ScopedLocations;
  readonly placedWorkflowNames: readonly string[];
}

/** Inputs required to stage and atomically replace every reinstall bridge. */
export interface ReplaceReinstalledPluginInput {
  readonly referenceNames?: InstalledReferenceNames;
  readonly locations: ScopedLocations;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly installable: MaterializablePlugin;
  readonly pluginDataDir: string;
  readonly oldRecord: PluginInstallRecord;
  readonly agentsDirs: readonly string[];
  /** SKTK-01: the workflow names the skills bridge retargets sibling references onto. */
  readonly workflowNames: readonly string[];
}

/** Physical bridge operations consumed by the atomic replacement schedule. */
export interface ReinstallReplaceOperations {
  readonly abortPreparedAgents: typeof abortPreparedAgents;
  readonly abortPreparedCommands: typeof abortPreparedCommands;
  readonly abortPreparedMcp: typeof abortPreparedMcp;
  readonly abortPreparedSkills: typeof abortPreparedSkills;
  readonly abortPreparedWorkflows: typeof abortPreparedWorkflows;
  readonly commitPreparedWorkflows: typeof commitPreparedWorkflows;
  readonly finalizeAgentsReplacement: typeof finalizeAgentsReplacement;
  readonly finalizeCommandsReplacement: typeof finalizeCommandsReplacement;
  readonly finalizeMcpReplacement: typeof finalizeMcpReplacement;
  readonly finalizeSkillsReplacement: typeof finalizeSkillsReplacement;
  readonly prepareStagePluginAgents: typeof prepareStagePluginAgents;
  readonly prepareStageCommands: typeof prepareStageCommands;
  readonly prepareStageMcpServers: typeof prepareStageMcpServers;
  readonly prepareStageSkills: typeof prepareStageSkills;
  readonly prepareStageWorkflows: typeof prepareStageWorkflows;
  readonly removeHookConfig: typeof removeHookConfig;
  readonly replacePreparedAgents: typeof replacePreparedAgents;
  readonly replacePreparedCommands: typeof replacePreparedCommands;
  readonly replacePreparedMcp: typeof replacePreparedMcp;
  readonly replacePreparedSkills: typeof replacePreparedSkills;
  readonly rollbackAgentsReplacement: typeof rollbackAgentsReplacement;
  readonly rollbackCommandsReplacement: typeof rollbackCommandsReplacement;
  readonly rollbackMcpReplacement: typeof rollbackMcpReplacement;
  readonly rollbackSkillsReplacement: typeof rollbackSkillsReplacement;
  readonly unstagePluginWorkflows: typeof unstagePluginWorkflows;
  readonly writeHookConfig: typeof writeHookConfig;
}

/** Inputs required for best-effort maintenance after a committed reinstall. */
export interface ReinstallMaintenanceInput {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly plugin: string;
  readonly removeDataDir?: RemoveDataDirFn;
}

/**
 * Owns reinstall's prepare, replacement, compensation, and commit schedule.
 *
 * Each schedule step is declared as an explicit signature rather than `typeof`
 * its implementation: the implementations are module-private, and the explicit
 * form makes `REAL_REINSTALL_TRANSACTION`'s annotation the place a signature
 * drift surfaces as a compile error.
 */
export interface ReinstallTransaction {
  readonly finalizeReinstalledPlugin: (
    replacement: ReinstallReplacement,
  ) => Promise<readonly string[]>;
  /**
   * D-05-01: the transaction owns which physical bridges the replacement
   * schedule drives, so replacement and compensation reach the same owner.
   */
  readonly replaceOperations: ReinstallReplaceOperations;
  readonly replaceReinstalledPlugin: (
    input: ReplaceReinstalledPluginInput,
    operations: ReinstallReplaceOperations,
  ) => Promise<ReinstallReplacement>;
  readonly rollbackReinstalledPlugin: (
    replacement: ReinstallReplacement,
  ) => Promise<readonly string[]>;
  readonly runPostSuccessMaintenance: (
    input: ReinstallMaintenanceInput,
    locations: ScopedLocations,
    completionCache: CompletionCache,
  ) => Promise<readonly string[]>;
  readonly withLockedStateTransaction: typeof withLockedStateTransaction;
}

const REAL_REINSTALL_REPLACE_OPERATIONS: ReinstallReplaceOperations = {
  abortPreparedAgents,
  abortPreparedCommands,
  abortPreparedMcp,
  abortPreparedSkills,
  abortPreparedWorkflows,
  commitPreparedWorkflows,
  finalizeAgentsReplacement,
  finalizeCommandsReplacement,
  finalizeMcpReplacement,
  finalizeSkillsReplacement,
  prepareStagePluginAgents,
  prepareStageCommands,
  prepareStageMcpServers,
  prepareStageSkills,
  prepareStageWorkflows,
  removeHookConfig,
  replacePreparedAgents,
  replacePreparedCommands,
  replacePreparedMcp,
  replacePreparedSkills,
  rollbackAgentsReplacement,
  rollbackCommandsReplacement,
  rollbackMcpReplacement,
  rollbackSkillsReplacement,
  unstagePluginWorkflows,
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
async function replaceReinstalledPlugin(
  input: ReplaceReinstalledPluginInput,
  operations: ReinstallReplaceOperations,
): Promise<ReinstallReplacement> {
  // D-08-12: this verb owns the replacement lifecycle, so it constructs the
  // removal operations once and every prepare, replace, rollback, and finalize
  // step below performs its cleanup through that one collaborator.
  const removalOps = createRemovalOps();
  const handles = await prepareAllHandles(removalOps, input, operations);
  const { replacements, hookEntries, placedWorkflowNames, workflowsCommitLeaks } = await replaceAll(
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
    bridgeWarnings: [...warnings.bridge, ...workflowsCommitLeaks],
    operations,
    removalOps,
    locations: input.locations,
    placedWorkflowNames,
  };
}

/** Roll back every physically replaced bridge in reverse order. */
async function rollbackReinstalledPlugin(
  replacement: ReinstallReplacement,
): Promise<readonly string[]> {
  return [
    ...(await rollbackReplacements(
      replacement.removalOps,
      replacement.replacements,
      replacement.operations,
    )),
    // WLIF-01: the commit reports what it left at its targets on the throw
    // path too, and that report -- not the class of the thrown error -- is the
    // removal payload. Empty unless the commit ran and stranded something, so
    // this is a no-op on every earlier step's failure.
    ...(await unplaceWorkflows(
      replacement.operations,
      replacement.locations,
      replacement.placedWorkflowNames,
    )),
  ];
}

/**
 * WLIF-01 / T-112-12 / T-112-13: remove the workflow envelopes the replace
 * step's commit REPORTED placing, after a step that ran later failed.
 *
 * The payload is `onPlaced`'s array and never the prepared staged names: a
 * refusal places nothing, so does a failed occupancy check, and so does a
 * mid-sequence failure whose reversal fully succeeded. Unlinking a name this
 * commit did not place deletes either a foreign file or a previous envelope
 * the commit's own restore just put back.
 *
 * NEVER throws. It runs inside a catch that is already unwinding a DIFFERENT
 * error and composing a manual-recovery hint out of leak strings, so a throw
 * here would replace that error and discard every leak already collected. A
 * containment refusal is therefore recorded as a leak line -- still loud, and
 * still user-visible -- rather than propagated.
 */
async function unplaceWorkflows(
  operations: ReinstallReplaceOperations,
  locations: ScopedLocations,
  placedWorkflowNames: readonly string[],
): Promise<readonly string[]> {
  if (placedWorkflowNames.length === 0) {
    return Object.freeze<string[]>([]);
  }

  try {
    const result = await operations.unstagePluginWorkflows({
      locations,
      previousWorkflowNames: placedWorkflowNames,
    });
    return Object.freeze(
      result.failed.map((failure) => `workflows: ${failure.name}: ${failure.reason}`),
    );
  } catch (err) {
    return Object.freeze([`workflows: ${errorMessage(err)}`]);
  }
}

/** Remove bridge backups after the state transaction commits. */
async function finalizeReinstalledPlugin(
  replacement: ReinstallReplacement,
): Promise<readonly string[]> {
  return finalizeReplacements(
    replacement.removalOps,
    replacement.replacements,
    replacement.operations,
  );
}

/** Run non-fatal cache and data-directory cleanup after commit. */
async function runPostSuccessMaintenance(
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
      pluginName: input.plugin,
      pluginRoot: input.installable.pluginRoot,
      pluginDataDir: input.pluginDataDir,
      resolved: input.installable,
      referenceNames: input.referenceNames,
      previousSkillNames: input.oldRecord.resources.skills,
      knownWorkflowNames: input.workflowNames,
      cwd: input.cwd,
    });
    handles.commands = await operations.prepareStageCommands(ops, {
      locations: input.locations,
      pluginName: input.plugin,
      pluginRoot: input.installable.pluginRoot,
      pluginDataDir: input.pluginDataDir,
      resolved: input.installable,
      referenceNames: input.referenceNames,
      previousCommandNames: input.oldRecord.resources.prompts,
      cwd: input.cwd,
    });
    handles.agents = await operations.prepareStagePluginAgents(ops, {
      locations: input.locations,
      marketplaceName: input.marketplace,
      pluginName: input.plugin,
      pluginRoot: input.installable.pluginRoot,
      pluginDataDir: input.pluginDataDir,
      agentsDirs: input.agentsDirs,
      knownSkills: handles.skills.result.recorded.map((record) => record.generatedName),
      referenceNames: input.referenceNames,
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
    // WLIF-01: fifth and LAST, mirroring the install ledger's ordering. The
    // previous names come from the OLD record's inventory -- the same slot the
    // skills and commands prepares above read theirs from -- so the commit
    // displaces this plugin's own envelopes aside instead of refusing the
    // occupied target.
    handles.workflows = await operations.prepareStageWorkflows({
      locations: input.locations,
      pluginName: input.plugin,
      resolved: input.installable,
      previousWorkflowNames: input.oldRecord.resources.workflows,
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
  readonly placedWorkflowNames: readonly string[];
  /** The workflows commit's staging-cleanup leak, empty when it cleaned up. */
  readonly workflowsCommitLeaks: readonly string[];
}> {
  const replacements: ReplacementEntry[] = [];
  let hookEntries: readonly HookSummaryEntry[] | undefined;
  let placedWorkflowNames: readonly string[] = [];
  let workflowsCommitEntered = false;
  const workflowsCommitLeaks: string[] = [];
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
    // WLIF-01: the LAST step, mirroring the install ledger's ordering. The
    // workflows bridge has no `replacePrepared*` twin and needs none -- the
    // prepare plus commit pair IS the replace shape: the commit displaces the
    // previously-recorded targets aside, renames the new envelopes in, and
    // restores on failure. Nothing is pushed onto `replacements[]`, because the
    // commit cleans up its own staging on success and there is no handle left
    // to roll back through; the hooks slot above is the established precedent
    // for a step deliberately outside the ledger.
    //
    // Being last means no LATER step in this function can fail -- but the
    // commit itself can fail PART WAY, and then it has placed envelopes that
    // this catch must take back. The bridge reports exactly that set through
    // `onPlaced` on its throw path for exactly this reason.
    //
    // Set BEFORE the call: from here on the commit owns its own staging
    // lifecycle on BOTH its paths, so the catch must not abort it (see
    // `abortPartialHandles`'s `skipWorkflows` option).
    workflowsCommitEntered = true;
    const workflowsLeak = await operations.commitPreparedWorkflows(handles.workflows, {
      // The whole body is one assignment that cannot throw. The commit invokes
      // this callback on its failure paths too, so anything that could raise
      // here would mask the real failure.
      onPlaced: (names) => {
        placedWorkflowNames = names;
      },
    });
    if (workflowsLeak !== undefined) {
      workflowsCommitLeaks.push(workflowsLeak);
    }
  } catch (error) {
    const leaks = [
      ...(await rollbackReplacements(ops, replacements, operations)),
      ...(await unplaceWorkflows(operations, hooks.locations, placedWorkflowNames)),
      // The commit owns its staging root on BOTH its paths, and DELIBERATELY
      // retains it when it holds the only copy of a displaced previous
      // envelope (stage.ts's failed-restore path). Aborting it here would
      // recursively delete `.previous/` -- the bytes the leak text just told
      // the operator to move back by hand.
      ...(await abortPartialHandles(ops, handles, operations, {
        skipWorkflows: workflowsCommitEntered,
      })),
    ];
    throw errorWithManualRecovery(error, leaks);
  }

  return {
    replacements: Object.freeze(replacements),
    hookEntries,
    placedWorkflowNames,
    workflowsCommitLeaks: Object.freeze(workflowsCommitLeaks),
  };
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
  const split = splitStagingWarnings({
    skills: handles.skills.result.warnings,
    commands: handles.commands.result.warnings,
    agents: handles.agents.result.warnings,
    mcp: handles.mcp.result.warnings,
  });
  // WGATE-01: the workflows prepare's own warnings join the DISCOVERY half
  // here, rather than through the shared classifier -- every string in it
  // describes the plugin's DECLARED scripts (which were not installed, which
  // were installed but the engine will refuse to load), which is a fact a
  // standalone user needs, not a hygiene note only the cascade forwards.
  return {
    discovery: [...split.discovery, ...handles.workflows.result.warnings],
    bridge: split.bridge,
  };
}

/** WLIF-01: see `abortPartialHandles` for why the workflows arm is skippable. */
interface AbortHandlesOptions {
  readonly skipWorkflows?: boolean;
}

async function abortPartialHandles(
  ops: RemovalOps,
  handles: PartialPreparedHandles,
  operations: ReinstallReplaceOperations,
  opts?: AbortHandlesOptions,
): Promise<readonly string[]> {
  const leaks: string[] = [];
  // WLIF-01: FIRST, because this helper unwinds in reverse preparation order
  // and workflows is prepared last. `abortPreparedWorkflows` is a
  // `cleanupStaging` call, which swallows ENOENT -- so it tolerates being
  // reached after a successful commit already removed the staging root.
  //
  // `skipWorkflows` is set once the commit has been ENTERED, because from that
  // point the commit owns the staging root on both its paths: it cleans up
  // after a success, and after a failed restore it keeps the root on purpose
  // because `.previous/` inside it holds the ONLY copy of a displaced previous
  // envelope. `cleanupStaging` is a recursive rm, so aborting a commit that
  // already ran would destroy exactly those bytes.
  if (handles.workflows !== undefined && opts?.skipWorkflows !== true) {
    pushLeak(leaks, "workflows", await operations.abortPreparedWorkflows(handles.workflows));
  }

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

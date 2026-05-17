// orchestrators/plugin/reinstall.ts
//
// PRL-02/03/04/05/06/07/08/09/10/11/12/13/14/15 reinstall core.
// Single-plugin (PRL-02/06/07/08/09/10/11/12) and bulk reinstall
// (PRL-03/04/05/13/14/15) are both implemented here.
//
// Reinstall is deliberately NOT uninstall+install and NOT update:
// it targets an already-installed plugin, reads the cached marketplace
// manifest only, preserves the installed record's version/installedAt, prepares
// every bridge before physical replacement, then rolls physical resources back
// if replacement or explicit state persistence fails.

import { rm } from "node:fs/promises";

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
import { PLUGIN_ENTRY_VALIDATOR, type PluginEntry } from "../../domain/components/plugin.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { requireInstallable, resolveStrict } from "../../domain/resolver.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { mcpAdapterWarningIfNeeded, subagentWarningIfNeeded } from "../../presentation/soft-dep.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import { assertNever, errorMessage, MarketplaceNotFoundError } from "../../shared/errors.ts";
import { MANUAL_RECOVERY_REQUIRED } from "../../shared/markers.ts";
import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";
import {
  withLockedStateTransaction,
  type LockedStateTransaction,
  type LockedStateTransactionDeps,
} from "../../transaction/with-state-guard.ts";
import { formatErrorWithCauses, resolveScopeFromState } from "../marketplace/shared.ts";

import { discoverGeneratedNames } from "./discover-names.ts";
import { assertNoCrossPluginConflicts, resolveInstalledPluginTarget } from "./shared.ts";

import type { AgentsReplacement, PreparedAgentsStaging } from "../../bridges/agents/index.ts";
import type { CommandsReplacement, PreparedCommandsStaging } from "../../bridges/commands/index.ts";
import type { McpReplacement, PreparedMcpStaging } from "../../bridges/mcp/index.ts";
import type { PreparedSkillsStaging, SkillsReplacement } from "../../bridges/skills/index.ts";
import type { ResolvedPluginInstallable } from "../../domain/resolver.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";
import type {
  ReinstallFailedOutcome,
  ReinstallPluginOutcome,
  ReinstallReinstalledOutcome,
  ReinstallSkippedOutcome,
} from "../types.ts";

export type {
  ReinstallFailedOutcome,
  ReinstallPluginOutcome,
  ReinstallPluginPartition,
  ReinstallReinstalledOutcome,
  ReinstallSkippedOutcome,
} from "../types.ts";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];
type BridgePhase = "skills" | "commands" | "agents" | "mcp";
type RemoveDataDirFn = (path: string, options: { recursive: true; force: true }) => Promise<void>;
type DropMarketplaceCacheFn = typeof dropMarketplaceCache;

export interface ReinstallPluginOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly scope: Scope;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly force?: boolean;
  readonly render?: "default" | "none";
  /** @internal Test-only seams; production callers omit this. */
  readonly __deps?: ReinstallPluginDeps;
}

export interface ReinstallPluginDeps {
  readonly stateTransaction?: LockedStateTransactionDeps;
  readonly dropMarketplaceCache?: DropMarketplaceCacheFn;
  readonly removeDataDir?: RemoveDataDirFn;
}

export type ReinstallPluginsTarget =
  | { readonly kind: "all" }
  | { readonly kind: "marketplace"; readonly marketplace: string }
  | { readonly kind: "plugin"; readonly plugin: string; readonly marketplace: string };

export interface ReinstallPluginsOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly target: ReinstallPluginsTarget;
  readonly force?: boolean;
}

interface PreparedHandles {
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

interface LockedSuccess {
  readonly outcome: ReinstallPluginOutcome;
  readonly bridgeWarnings: readonly string[];
}

interface ResolvedReinstallTarget {
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

const defaultRemoveDataDir: RemoveDataDirFn = async (dataDir) => {
  await rm(dataDir, { recursive: true, force: true });
};

export async function reinstallPlugin(
  opts: ReinstallPluginOptions,
): Promise<ReinstallPluginOutcome> {
  const { ctx, pi, scope, cwd, marketplace, plugin } = opts;
  const render = opts.render ?? "default";
  const locations = locationsFor(scope, cwd);

  let locked: LockedSuccess;
  try {
    locked = await withLockedStateTransaction(
      locations,
      (tx) => runLockedReinstall(tx, locations, opts),
      opts.__deps?.stateTransaction,
    );
  } catch (err) {
    const message = formatErrorWithCauses(err);
    if (render !== "none") {
      notifyError(ctx, message, err);
    }

    return { partition: "failed", name: plugin, marketplace, scope, notes: [message] };
  }

  if (locked.outcome.partition !== "reinstalled") {
    return locked.outcome;
  }

  const maintenanceWarnings = await runPostSuccessMaintenance(opts, locations);
  if (render === "none") {
    const notes = [...locked.bridgeWarnings, ...maintenanceWarnings].map((w) => `warning: ${w}`);
    return notes.length === 0 ? locked.outcome : { ...locked.outcome, notes };
  }

  for (const warning of locked.bridgeWarnings) {
    notifyWarning(ctx, warning);
  }

  for (const warning of maintenanceWarnings) {
    notifyWarning(ctx, warning);
  }

  notifySuccess(ctx, renderSuccessBody(locked.outcome, pi));
  return locked.outcome;
}

export async function reinstallPlugins(
  opts: ReinstallPluginsOptions,
): Promise<readonly ReinstallPluginOutcome[]> {
  const { ctx, pi, cwd } = opts;

  let targets: readonly ResolvedReinstallTarget[];
  try {
    targets = await enumerateReinstallTargets(opts);
  } catch (err) {
    notifyError(ctx, formatErrorWithCauses(err), err);
    return [];
  }

  if (targets.length === 0) {
    notifySuccess(ctx, "No plugins installed.");
    return [];
  }

  const outcomes: ReinstallPluginOutcome[] = [];
  for (const target of targets) {
    try {
      outcomes.push(
        await reinstallPlugin({
          ctx,
          pi,
          scope: target.scope,
          cwd,
          marketplace: target.marketplace,
          plugin: target.plugin,
          render: "none",
          ...(opts.force === undefined ? {} : { force: opts.force }),
        }),
      );
    } catch (err) {
      outcomes.push({
        partition: "failed",
        name: target.plugin,
        marketplace: target.marketplace,
        scope: target.scope,
        notes: [formatErrorWithCauses(err)],
      });
    }
  }

  renderReinstallPartitionAndNotify(ctx, pi, outcomes);
  return Object.freeze(outcomes);
}

async function enumerateReinstallTargets(
  opts: ReinstallPluginsOptions,
): Promise<readonly ResolvedReinstallTarget[]> {
  const { cwd, target } = opts;
  const explicitScope = opts.scope;

  if (target.kind === "all") {
    return enumerateAllReinstallTargets(cwd, explicitScope);
  }

  return enumerateMarketplaceReinstallTargets(cwd, explicitScope, target);
}

async function enumerateAllReinstallTargets(
  cwd: string,
  explicitScope: Scope | undefined,
): Promise<readonly ResolvedReinstallTarget[]> {
  const scopes: readonly Scope[] =
    explicitScope === undefined ? ["user", "project"] : [explicitScope];
  const out: ResolvedReinstallTarget[] = [];
  for (const scope of scopes) {
    out.push(...(await installedTargetsForScope(cwd, scope)));
  }

  return sortReinstallTargets(out);
}

async function installedTargetsForScope(
  cwd: string,
  scope: Scope,
): Promise<readonly ResolvedReinstallTarget[]> {
  const state = await loadState(locationsFor(scope, cwd).extensionRoot);
  return Object.entries(state.marketplaces).flatMap(([marketplace, mp]) =>
    Object.keys(mp.plugins).map((plugin) => ({ plugin, marketplace, scope })),
  );
}

async function resolveReinstallScope(
  cwd: string,
  marketplace: string,
  target: Extract<ReinstallPluginsTarget, { kind: "marketplace" | "plugin" }>,
  explicitScope: Scope | undefined,
): Promise<{ scope: Scope; locations: ReturnType<typeof locationsFor> }> {
  if (target.kind === "plugin" && explicitScope === undefined) {
    return (
      (await resolveInstalledPluginTarget({ cwd, marketplace, plugin: target.plugin })) ?? {
        scope: "user" as const,
        locations: locationsFor("user", cwd),
      }
    );
  }

  if (explicitScope !== undefined) {
    return { scope: explicitScope, locations: locationsFor(explicitScope, cwd) };
  }

  return resolveScopeFromState(
    marketplace,
    locationsFor("user", cwd),
    locationsFor("project", cwd),
  );
}

async function enumerateMarketplaceReinstallTargets(
  cwd: string,
  explicitScope: Scope | undefined,
  target: Extract<ReinstallPluginsTarget, { kind: "marketplace" | "plugin" }>,
): Promise<readonly ResolvedReinstallTarget[]> {
  const marketplace = target.marketplace;
  const resolved = await resolveReinstallScope(cwd, marketplace, target, explicitScope);
  const state = await loadState(resolved.locations.extensionRoot);
  const mp = state.marketplaces[marketplace];
  if (mp === undefined) {
    if (explicitScope !== undefined) {
      if (target.kind === "plugin") {
        return sortReinstallTargets([{ plugin: target.plugin, marketplace, scope: explicitScope }]);
      }

      throw new MarketplaceNotFoundError(marketplace, [explicitScope]);
    }

    throw new Error(`Marketplace "${marketplace}" not found in ${resolved.scope} scope.`);
  }

  const plugins = target.kind === "plugin" ? [target.plugin] : Object.keys(mp.plugins);
  return sortReinstallTargets(
    plugins.map((plugin) => ({ plugin, marketplace, scope: resolved.scope })),
  );
}

function sortReinstallTargets(
  targets: readonly ResolvedReinstallTarget[],
): readonly ResolvedReinstallTarget[] {
  return Object.freeze(
    [...targets].sort(
      (a, b) =>
        scopeOrder(a.scope) - scopeOrder(b.scope) ||
        a.marketplace.localeCompare(b.marketplace) ||
        a.plugin.localeCompare(b.plugin),
    ),
  );
}

function renderReinstallPartitionAndNotify(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  outcomes: readonly ReinstallPluginOutcome[],
): void {
  const partitions = partitionReinstallOutcomes(outcomes);
  const reinstalled = [...partitions.reinstalled].sort(compareReinstallOutcome);
  const lines = [reinstallSummary(reinstalled.length, reinstalled[0]?.name)];

  renderReinstallPartition(lines, "Reinstalled", partitions.reinstalled);
  renderReinstallPartition(lines, "Skipped", partitions.skipped);
  renderReinstallPartition(lines, "Failed", partitions.failed);

  const changedNames = reinstalled.filter((o) => o.resourcesChanged).map((o) => o.name);
  const body = appendReinstallSoftDepWarnings(lines.join("\n"), pi, reinstalled);
  const hint = reloadHint("refresh", changedNames);
  notifySuccess(ctx, appendReloadHint(body, hint));
}

function reinstallSummary(
  reinstalledCount: number,
  firstReinstalledName: string | undefined,
): string {
  if (reinstalledCount === 1) {
    return `Reinstalled plugin "${firstReinstalledName ?? ""}".`;
  }

  if (reinstalledCount > 1) {
    return `Reinstalled ${reinstalledCount.toString()} plugins.`;
  }

  return "Plugin reinstall complete.";
}

function partitionReinstallOutcomes(outcomes: readonly ReinstallPluginOutcome[]): {
  reinstalled: ReinstallReinstalledOutcome[];
  skipped: ReinstallSkippedOutcome[];
  failed: ReinstallFailedOutcome[];
} {
  const partitions: {
    reinstalled: ReinstallReinstalledOutcome[];
    skipped: ReinstallSkippedOutcome[];
    failed: ReinstallFailedOutcome[];
  } = { reinstalled: [], skipped: [], failed: [] };
  for (const outcome of outcomes) {
    switch (outcome.partition) {
      case "reinstalled":
        partitions.reinstalled.push(outcome);
        break;
      case "skipped":
        partitions.skipped.push(outcome);
        break;
      case "failed":
        partitions.failed.push(outcome);
        break;
      default:
        assertNever(outcome);
    }
  }

  return partitions;
}

function renderReinstallPartition(
  lines: string[],
  label: "Reinstalled" | "Skipped" | "Failed",
  outcomes: readonly ReinstallPluginOutcome[],
): void {
  if (outcomes.length === 0) {
    return;
  }

  lines.push(`${label}:`);
  for (const outcome of [...outcomes].sort(compareReinstallOutcome)) {
    lines.push(formatReinstallOutcomeLine(outcome));
  }
}

function formatReinstallOutcomeLine(outcome: ReinstallPluginOutcome): string {
  const notes =
    outcome.notes === undefined || outcome.notes.length === 0
      ? ""
      : `: ${outcome.notes.join("; ")}`;
  return `  - [${outcome.scope}] ${outcome.name}@${outcome.marketplace}${notes}`;
}

function compareReinstallOutcome(a: ReinstallPluginOutcome, b: ReinstallPluginOutcome): number {
  return (
    scopeOrder(a.scope) - scopeOrder(b.scope) ||
    a.marketplace.localeCompare(b.marketplace) ||
    a.name.localeCompare(b.name)
  );
}

function scopeOrder(scope: Scope): number {
  return scope === "user" ? 0 : 1;
}

function appendReinstallSoftDepWarnings(
  body: string,
  pi: ExtensionAPI,
  reinstalled: readonly ReinstallReinstalledOutcome[],
): string {
  const stagedAgents = reinstalled.flatMap((o) => o.stagedAgents);
  const stagedMcpServers = reinstalled.flatMap((o) => o.stagedMcpServers);
  return [
    body,
    subagentWarningIfNeeded(pi, stagedAgents),
    mcpAdapterWarningIfNeeded(pi, stagedMcpServers),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

async function runLockedReinstall(
  tx: LockedStateTransaction,
  locations: ScopedLocations,
  opts: ReinstallPluginOptions,
): Promise<LockedSuccess> {
  const { scope, cwd, marketplace, plugin, force } = opts;
  const mp = tx.state.marketplaces[marketplace];
  const oldRecord = mp?.plugins[plugin];
  if (mp === undefined || oldRecord === undefined) {
    return {
      outcome: { partition: "skipped", name: plugin, marketplace, scope, notes: ["not installed"] },
      bridgeWarnings: [],
    };
  }

  const oldSnapshot = clonePluginRecord(oldRecord);
  const entry = await loadCachedEntry(mp.manifestPath, marketplace, plugin);
  const installable = await resolveInstallable(entry, mp.marketplaceRoot);
  const generated = await discoverGeneratedNames(plugin, installable);
  assertNoCrossPluginConflicts(
    scope,
    { skills: generated.skills, commands: generated.commands, agents: generated.agents },
    removePluginRecord(tx.state, marketplace, plugin),
  );

  const pluginDataDir = await locations.pluginDataDir(marketplace, plugin);
  const handles = await prepareAllHandles({
    locations,
    cwd,
    marketplace,
    plugin,
    installable,
    pluginDataDir,
    oldRecord: oldSnapshot,
    agentsSourceDir: generated.agentsSourceDir,
  });
  const replacements = await replaceAll(handles, force);

  try {
    updateStateRecord(tx.state, marketplace, plugin, oldSnapshot, installable, handles);
    await tx.save();
  } catch (err) {
    throw errorWithManualRecovery(err, await rollbackReplacements(replacements));
  }

  const bridgeWarnings = [
    ...collectStagingWarnings(handles),
    ...(await finalizeReplacements(replacements)),
  ];
  return {
    outcome: successOutcome(scope, marketplace, plugin, oldSnapshot, handles),
    bridgeWarnings,
  };
}

async function loadCachedEntry(
  manifestPath: string,
  marketplace: string,
  plugin: string,
): Promise<PluginEntry> {
  const manifest = await loadMarketplaceManifest(manifestPath);
  const entryRaw = manifest.plugins.find((p) => p.name === plugin);
  if (entryRaw === undefined) {
    throw new Error(
      `Plugin "${plugin}" not found in cached manifest for marketplace "${marketplace}".`,
    );
  }

  if (!PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)) {
    throw new Error(
      `Plugin entry for "${plugin}" in marketplace "${marketplace}" failed schema validation.`,
    );
  }

  return entryRaw;
}

async function resolveInstallable(
  entry: PluginEntry,
  marketplaceRoot: string,
): Promise<ResolvedPluginInstallable> {
  const resolved = await resolveStrict(entry, { marketplaceRoot });
  requireInstallable(resolved, "install");
  return resolved;
}

async function prepareAllHandles(input: {
  readonly locations: ScopedLocations;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly installable: ResolvedPluginInstallable;
  readonly pluginDataDir: string;
  readonly oldRecord: PluginRecord;
  readonly agentsSourceDir: string | null;
}): Promise<PreparedHandles> {
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
    });
    handles.commands = await prepareStageCommands({
      locations: input.locations,
      marketplaceName: input.marketplace,
      pluginName: input.plugin,
      pluginRoot: input.installable.pluginRoot,
      pluginDataDir: input.pluginDataDir,
      resolved: input.installable,
      previousCommandNames: input.oldRecord.resources.prompts,
    });
    handles.agents = await prepareStagePluginAgents({
      locations: input.locations,
      marketplaceName: input.marketplace,
      pluginName: input.plugin,
      pluginRoot: input.installable.pluginRoot,
      pluginDataDir: input.pluginDataDir,
      resolved: input.installable,
      agentsSourceDir: input.agentsSourceDir,
      knownSkills: handles.skills.result.recorded.map((r) => r.generatedName),
    });
    handles.mcp = await prepareStageMcpServers({
      locations: input.locations,
      cwd: input.cwd,
      marketplaceName: input.marketplace,
      pluginName: input.plugin,
      servers: input.installable.mcpServers,
      sourcePath: `${input.installable.pluginRoot}#mcpServers`,
    });
  } catch (err) {
    throw errorWithManualRecovery(err, await abortPartialHandles(handles));
  }

  return handles as PreparedHandles;
}

async function replaceAll(
  handles: PreparedHandles,
  force: boolean | undefined,
): Promise<readonly ReplacementEntry[]> {
  const replacements: ReplacementEntry[] = [];
  try {
    const skills = await replacePreparedSkills(handles.skills);
    replacements.push({ phase: "skills", handle: skills });
    const commands = await replacePreparedCommands(handles.commands);
    replacements.push({ phase: "commands", handle: commands });
    const agents = await replacePreparedAgents(
      handles.agents,
      force === undefined ? {} : { force },
    );
    replacements.push({ phase: "agents", handle: agents });
    const mcp = await replacePreparedMcp(handles.mcp);
    replacements.push({ phase: "mcp", handle: mcp });
  } catch (err) {
    const leaks = [...(await rollbackReplacements(replacements)), ...(await abortHandles(handles))];
    throw errorWithManualRecovery(err, leaks);
  }

  return Object.freeze(replacements);
}

function updateStateRecord(
  state: ExtensionState,
  marketplace: string,
  plugin: string,
  oldRecord: PluginRecord,
  installable: ResolvedPluginInstallable,
  handles: PreparedHandles,
): void {
  const mp = state.marketplaces[marketplace];
  if (mp?.plugins[plugin] === undefined) {
    throw new Error(
      `Plugin "${plugin}" was concurrently removed from marketplace "${marketplace}".`,
    );
  }

  mp.plugins[plugin] = {
    version: oldRecord.version,
    resolvedSource: installable.pluginRoot,
    compatibility: {
      installable: true,
      notes: [...installable.notes],
      supported: [...installable.supported],
      unsupported: [...installable.unsupported],
    },
    resources: resourcesFromHandles(handles),
    installedAt: oldRecord.installedAt,
    updatedAt: new Date().toISOString(),
  };
}

function resourcesFromHandles(handles: PreparedHandles): PluginRecord["resources"] {
  return {
    skills: handles.skills.result.recorded.map((r) => r.generatedName),
    prompts: handles.commands.result.recorded.map((r) => r.generatedName),
    agents: handles.agents.result.recorded.map((r) => r.generatedName),
    mcpServers: handles.mcp.result.recorded.map((r) => r.generatedName),
  };
}

function successOutcome(
  scope: Scope,
  marketplace: string,
  plugin: string,
  oldRecord: PluginRecord,
  handles: PreparedHandles,
): ReinstallReinstalledOutcome {
  const resources = resourcesFromHandles(handles);
  return {
    partition: "reinstalled",
    name: plugin,
    marketplace,
    scope,
    version: oldRecord.version,
    stagedAgents: resources.agents,
    stagedMcpServers: resources.mcpServers,
    resourcesChanged: resourcesChanged(oldRecord.resources, resources),
  };
}

function resourcesChanged(
  oldResources: PluginRecord["resources"],
  next: PluginRecord["resources"],
): boolean {
  return (
    next.skills.length > 0 ||
    next.prompts.length > 0 ||
    next.agents.length > 0 ||
    next.mcpServers.length > 0 ||
    !sameStrings(oldResources.skills, next.skills) ||
    !sameStrings(oldResources.prompts, next.prompts) ||
    !sameStrings(oldResources.agents, next.agents) ||
    !sameStrings(oldResources.mcpServers, next.mcpServers)
  );
}

function sameStrings(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function collectStagingWarnings(handles: PreparedHandles): readonly string[] {
  return Object.freeze([
    ...handles.skills.result.warnings,
    ...handles.commands.result.warnings,
    ...handles.agents.result.warnings,
    ...handles.mcp.result.warnings,
  ]);
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

async function abortHandles(handles: PreparedHandles): Promise<readonly string[]> {
  return abortPartialHandles(handles);
}

async function rollbackReplacements(
  replacements: readonly ReplacementEntry[],
): Promise<readonly string[]> {
  const leaks: string[] = [];
  for (const replacement of [...replacements].reverse()) {
    try {
      for (const leak of await rollbackReplacement(replacement)) {
        leaks.push(`${replacement.phase}: ${leak}`);
      }
    } catch (err) {
      leaks.push(`${replacement.phase}: rollback threw: ${errorMessage(err)}`);
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
    try {
      for (const leak of await finalizeReplacement(replacement)) {
        leaks.push(`${replacement.phase}: ${leak}`);
      }
    } catch (err) {
      leaks.push(`${replacement.phase}: finalize threw: ${errorMessage(err)}`);
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

function errorWithManualRecovery(err: unknown, leaks: readonly string[]): Error {
  const base = err instanceof Error ? err : new Error(errorMessage(err));
  if (leaks.length === 0) {
    return base;
  }

  if (base.message.includes(MANUAL_RECOVERY_REQUIRED)) {
    return new Error(`${base.message}; ${leaks.join("; ")}`, { cause: base });
  }

  return new Error(`${base.message} ${MANUAL_RECOVERY_REQUIRED}${leaks.join("; ")}`, {
    cause: base,
  });
}

function pushLeak(leaks: string[], phase: BridgePhase, leak: string | undefined): void {
  if (leak !== undefined) {
    leaks.push(`${phase}: ${leak}`);
  }
}

async function runPostSuccessMaintenance(
  opts: ReinstallPluginOptions,
  locations: ScopedLocations,
): Promise<readonly string[]> {
  const { scope, marketplace, plugin } = opts;
  const warnings: string[] = [];
  const cacheDrop = opts.__deps?.dropMarketplaceCache ?? dropMarketplaceCache;
  try {
    await cacheDrop(await locations.pluginCacheFile(marketplace), scope, marketplace);
  } catch (err) {
    warnings.push(
      `Plugin "${plugin}" reinstalled; completion cache refresh deferred: ${errorMessage(err)}`,
    );
  }

  const dataDir = await locations.pluginDataDir(marketplace, plugin);
  const removeDataDir = opts.__deps?.removeDataDir ?? defaultRemoveDataDir;
  try {
    await removeDataDir(dataDir, { recursive: true, force: true });
  } catch (err) {
    warnings.push(
      `Plugin "${plugin}" reinstalled; data cleanup deferred at ${dataDir}: ${errorMessage(err)}`,
    );
  }

  return Object.freeze(warnings);
}

function renderSuccessBody(outcome: ReinstallReinstalledOutcome, pi: ExtensionAPI): string {
  let body = `Reinstalled plugin "${outcome.name}" from marketplace "${outcome.marketplace}".`;
  const subagentWarn = subagentWarningIfNeeded(pi, outcome.stagedAgents);
  const mcpWarn = mcpAdapterWarningIfNeeded(pi, outcome.stagedMcpServers);
  if (subagentWarn !== "") {
    body = `${body}\n${subagentWarn}`;
  }

  if (mcpWarn !== "") {
    body = `${body}\n${mcpWarn}`;
  }

  const hint = reloadHint("refresh", outcome.resourcesChanged ? [outcome.name] : []);
  return appendReloadHint(body, hint);
}

function clonePluginRecord(record: PluginRecord): PluginRecord {
  return {
    version: record.version,
    resolvedSource: record.resolvedSource,
    compatibility: {
      installable: record.compatibility.installable,
      notes: [...record.compatibility.notes],
      supported: [...record.compatibility.supported],
      unsupported: [...record.compatibility.unsupported],
    },
    resources: {
      skills: [...record.resources.skills],
      prompts: [...record.resources.prompts],
      agents: [...record.resources.agents],
      mcpServers: [...record.resources.mcpServers],
    },
    installedAt: record.installedAt,
    updatedAt: record.updatedAt,
  };
}

function removePluginRecord(
  state: ExtensionState,
  marketplace: string,
  plugin: string,
): ExtensionState {
  const cloned: ExtensionState = {
    schemaVersion: state.schemaVersion,
    marketplaces: { ...state.marketplaces },
  };
  const mp = cloned.marketplaces[marketplace];
  if (mp === undefined) {
    return cloned;
  }

  const plugins = { ...mp.plugins };
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- cloned record map is local to the guard helper.
  delete plugins[plugin];
  cloned.marketplaces[marketplace] = { ...mp, plugins };
  return cloned;
}

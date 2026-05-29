// extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
//
// Phase 5 shared helpers for the plugin orchestrator family. Mirrors
// orchestrators/marketplace/shared.ts in spirit: pure-function helpers
// that the install / update / uninstall / list orchestrators import to
// satisfy a single named requirement.
//
// Shared helpers stay here while their consumers are confined to the plugin
// orchestrator family. If a consumer emerges outside plugin orchestrators,
// promote the helper to a wider orchestrators/shared surface.
//
// Per D-11 import boundaries, this file lives in `orchestrators/plugin/`
// and may import from `domain/`, `shared/`, and `persistence/` (type-only).
// No imports from `bridges/` or `orchestrators/marketplace/*`.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { computeHashVersion } from "../../domain/version.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { CrossPluginConflictError, MarketplaceNotFoundError } from "../../shared/errors.ts";

import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { ResolvedPluginInstallable } from "../../domain/resolver.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * Generated-name candidates produced by `domain/name.ts` generators for the
 * plugin being installed or updated. MCP server names are intentionally
 * EXCLUDED from this shape per PRD §6.5 (RN-3 same-kind cross-plugin guard
 * covers skills, prompts/commands, and agents only; MCP cross-slot
 * collision is the bridge's MC-4 concern, not the orchestrator's).
 */
export interface CrossPluginGeneratedNames {
  readonly skills: readonly string[];
  readonly commands: readonly string[];
  readonly agents: readonly string[];
}

export interface ResolvedInstallMarketplaceSource {
  readonly sourceScope: Scope;
  readonly sourceRecord: ExtensionState["marketplaces"][string];
}

export interface ResolvedScopedPluginTarget {
  readonly scope: Scope;
  readonly locations: ScopedLocations;
}

/**
 * CMP-2..4: plugin install target scope and marketplace source scope are
 * distinct. User-target installs can read only user marketplaces; project-
 * target installs read the project marketplace first, then fall back to the
 * user marketplace of the same name when no project record exists.
 */
export async function resolveInstallMarketplaceSource(opts: {
  readonly targetScope: Scope;
  readonly cwd: string;
  readonly marketplace: string;
  readonly targetState: ExtensionState;
}): Promise<ResolvedInstallMarketplaceSource | undefined> {
  const targetRecord = opts.targetState.marketplaces[opts.marketplace];
  if (targetRecord !== undefined) {
    return { sourceScope: opts.targetScope, sourceRecord: targetRecord };
  }

  if (opts.targetScope === "user") {
    return undefined;
  }

  const userLocations = locationsFor("user", opts.cwd);
  const userState = await loadState(userLocations.extensionRoot);
  const userRecord = userState.marketplaces[opts.marketplace];
  return userRecord === undefined ? undefined : { sourceScope: "user", sourceRecord: userRecord };
}

/**
 * Materialize the target-scope marketplace container needed by the current
 * state shape when CMP-3 falls back to a user-scope marketplace. The copied
 * record preserves source/manifest paths but starts with no target-scope
 * plugin installs; the install itself appends the first plugin record.
 */
export function cloneMarketplaceRecordForTargetScope(
  sourceRecord: ExtensionState["marketplaces"][string],
  targetScope: Scope,
): ExtensionState["marketplaces"][string] {
  return {
    ...sourceRecord,
    scope: targetScope,
    plugins: {},
  };
}

/** CMP-5: unqualified single-plugin lifecycle operations prefer project only when both scopes match. */
export async function resolveInstalledPluginTarget(opts: {
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly explicitScope?: Scope;
}): Promise<ResolvedScopedPluginTarget | undefined> {
  if (opts.explicitScope !== undefined) {
    return {
      scope: opts.explicitScope,
      locations: locationsFor(opts.explicitScope, opts.cwd),
    };
  }

  const projectLocations = locationsFor("project", opts.cwd);
  const projectState = await loadState(projectLocations.extensionRoot);
  if (projectState.marketplaces[opts.marketplace]?.plugins[opts.plugin] !== undefined) {
    return { scope: "project", locations: projectLocations };
  }

  const userLocations = locationsFor("user", opts.cwd);
  const userState = await loadState(userLocations.extensionRoot);
  if (userState.marketplaces[opts.marketplace]?.plugins[opts.plugin] !== undefined) {
    return { scope: "user", locations: userLocations };
  }

  return undefined;
}

/** CMP-5: unqualified @marketplace update targets project installs before user installs. */
export async function resolveInstalledMarketplaceTarget(opts: {
  readonly cwd: string;
  readonly marketplace: string;
  readonly explicitScope?: Scope;
}): Promise<ResolvedScopedPluginTarget> {
  if (opts.explicitScope !== undefined) {
    return {
      scope: opts.explicitScope,
      locations: locationsFor(opts.explicitScope, opts.cwd),
    };
  }

  const projectLocations = locationsFor("project", opts.cwd);
  const userLocations = locationsFor("user", opts.cwd);
  const [projectState, userState] = await Promise.all([
    loadState(projectLocations.extensionRoot),
    loadState(userLocations.extensionRoot),
  ]);
  const projectRecord = projectState.marketplaces[opts.marketplace];
  const userRecord = userState.marketplaces[opts.marketplace];

  if (projectRecord !== undefined && Object.keys(projectRecord.plugins).length > 0) {
    return { scope: "project", locations: projectLocations };
  }

  if (userRecord !== undefined && Object.keys(userRecord.plugins).length > 0) {
    return { scope: "user", locations: userLocations };
  }

  if (projectRecord !== undefined) {
    return { scope: "project", locations: projectLocations };
  }

  if (userRecord !== undefined) {
    return { scope: "user", locations: userLocations };
  }

  throw new MarketplaceNotFoundError(opts.marketplace, ["project", "user"]);
}

/**
 * PI-7 / PUP-3 / SNM-34 version precedence (3 tiers, highest first):
 *   1. The plugin's own `<pluginRoot>/.claude-plugin/plugin.json` `version`
 *      (D-23-01: "If also set in the marketplace entry, `plugin.json` wins.").
 *   2. The marketplace `entry.version` (formerly tier 1; moved below plugin.json).
 *   3. The PI-7 `computeHashVersion` content hash, as a last resort.
 *
 * Each declared `version` is accepted iff it is a non-empty string (the same
 * gate used for `entry.version`; D-23-03 -- no SemVer enforcement). The
 * plugin.json read is re-done here independently (D-23-02): the NFR-7
 * discriminated `ResolvedPluginInstallable` union is NOT widened with a
 * `manifest` field. Any read/parse failure (ENOENT, malformed JSON, missing
 * or non-string `.version`) silently falls through to the next tier and never
 * throws.
 */
export async function resolvePluginVersion(
  entry: PluginEntry,
  installable: ResolvedPluginInstallable,
): Promise<string> {
  // Tier 1: the plugin's own plugin.json `version`. Re-read in place; any
  // failure falls through to the next tier (D-23-02 / D-23-03).
  try {
    const manifestPath = path.join(installable.pluginRoot, ".claude-plugin", "plugin.json");
    const raw = await readFile(manifestPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const pluginJsonVersion = (parsed as { version?: unknown }).version;
    if (typeof pluginJsonVersion === "string" && pluginJsonVersion.length > 0) {
      return pluginJsonVersion;
    }
  } catch {
    // Fall through -- plugin.json is absent, unparseable, or carries no usable
    // version; tier 2 / tier 3 cover it.
  }

  // Tier 2: the marketplace entry version.
  if (typeof entry.version === "string" && entry.version.length > 0) {
    return entry.version;
  }

  // Tier 3: PI-7 content hash (last resort, unchanged).
  return computeHashVersion(installable.pluginRoot);
}

/** Bridge adapter for the resolver's `componentPaths.agents` array shape. */
export function pickAgentsSourceDir(installable: ResolvedPluginInstallable): string | null {
  const first = installable.componentPaths.agents[0];
  if (first === undefined) {
    return null;
  }

  return path.isAbsolute(first) ? first : path.join(installable.pluginRoot, first);
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b);
}

function collectOwners(state: ExtensionState): {
  skillOwners: Map<string, { plugin: string; marketplace: string }>;
  commandOwners: Map<string, { plugin: string; marketplace: string }>;
  agentOwners: Map<string, { plugin: string; marketplace: string }>;
} {
  const skillOwners = new Map<string, { plugin: string; marketplace: string }>();
  const commandOwners = new Map<string, { plugin: string; marketplace: string }>();
  const agentOwners = new Map<string, { plugin: string; marketplace: string }>();

  for (const [mpName, mp] of Object.entries(state.marketplaces)) {
    for (const [pluginName, plugin] of Object.entries(mp.plugins)) {
      for (const n of plugin.resources.skills) {
        skillOwners.set(n, { plugin: pluginName, marketplace: mpName });
      }

      for (const n of plugin.resources.prompts) {
        commandOwners.set(n, { plugin: pluginName, marketplace: mpName });
      }

      for (const n of plugin.resources.agents) {
        agentOwners.set(n, { plugin: pluginName, marketplace: mpName });
      }
    }
  }

  return { skillOwners, commandOwners, agentOwners };
}

function collectConflicts(
  kind: string,
  names: readonly string[],
  owners: ReadonlyMap<string, { plugin: string; marketplace: string }>,
): string[] {
  const conflicts: string[] = [];
  for (const n of [...names].sort(compareNames)) {
    const owner = owners.get(n);
    if (owner !== undefined) {
      conflicts.push(`${kind} "${n}" already owned by plugin "${owner.plugin}"`);
    }
  }

  return conflicts;
}

/**
 * PI-6 / RN-3 cross-bridge name conflict guard.
 *
 * Pre-flight check: BEFORE any disk write, refuse to install or update if
 * the candidate generated names collide with names already owned by
 * another plugin in the SAME SCOPE. Reads only the caller-supplied state
 * snapshot; performs no I/O.
 *
 * Determinism: conflicts emitted in fixed order -- skills first, then
 * commands (state field `prompts`), then agents. Within each kind,
 * conflicts are emitted in alphabetical order of generated name. This
 * stable ordering means UI diff tooling (and tests) can assert message
 * content byte-for-byte.
 *
 * Cross-scope independence (Phase 2 D-10): the caller passes exactly one
 * scope's state. Other-scope plugins owning the same name do NOT trigger
 * conflicts here -- they are independent installations. The `scope`
 * parameter is retained for diagnostic-message enrichment and symmetry
 * with other orchestrator helpers; cross-scope safety is enforced BY
 * CONSTRUCTION (callers pass one scope's state at a time).
 *
 * MCP server names are EXCLUDED by construction: `CrossPluginGeneratedNames`
 * has no `mcpServers` field. PRD §6.5 places MCP cross-slot collision at
 * the bridge layer (MC-4), not in this orchestrator-tier guard.
 *
 * @throws CrossPluginConflictError when ANY name collides; the message
 *   lists every conflict in the order above. Pre-disk-write per RN-3.
 */
export function assertNoCrossPluginConflicts(
  _scope: Scope,
  generatedNames: CrossPluginGeneratedNames,
  state: ExtensionState,
): void {
  // Build owner maps from current state. Key: generated name; Value: owning
  // plugin name (the marketplace pair is also useful in messages; capture both).
  const { skillOwners, commandOwners, agentOwners } = collectOwners(state);
  const conflicts = [
    ...collectConflicts("skill", generatedNames.skills, skillOwners),
    ...collectConflicts("command", generatedNames.commands, commandOwners),
    ...collectConflicts("agent", generatedNames.agents, agentOwners),
  ];

  if (conflicts.length > 0) {
    throw new CrossPluginConflictError(conflicts);
  }
}

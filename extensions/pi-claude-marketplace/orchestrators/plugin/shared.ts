// extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
//
// Shared helpers for the plugin orchestrator family. Mirrors
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
import { loadConfig } from "../../persistence/config-io.ts";
import { writePluginConfigEntry } from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { CrossPluginConflictError } from "../../shared/errors.ts";

import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { ResolvedPluginInstallable } from "../../domain/resolver.ts";
import type { ScopeConfig } from "../../persistence/config-io.ts";
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
 * SCOPE-01 / D-47-C discriminated cross-scope plugin-target resolution.
 *
 * The NFR-7 discriminated-union precedent (`installable: true | false`)
 * applied to lifecycle scope resolution: the chokepoint distinguishes
 * three outcomes a single `undefined`/raw-throw return previously
 * collapsed.
 *
 *   - `resolved`: the marketplace CONTAINER exists in the chosen scope
 *     (the plugin row may or may not be present -- the caller's
 *     downstream `installed === undefined` branch handles the
 *     plugin-row-absent silent converge, distinct from container
 *     absence per RESEARCH M13).
 *   - `other-scope`: the requested explicit scope misses, but the SAME
 *     plugin record exists in the OTHER scope. The caller surfaces this
 *     as a `marketplace-not-added` carrying the REQUESTED scope (the
 *     `[scope]` bracket communicates "not added in the scope you asked
 *     for"; the operator infers the other scope).
 *   - `marketplace-absent`: the marketplace container is absent in the
 *     requested scope AND (for explicit scope) the other scope, OR (for
 *     the unqualified form) in BOTH scopes. `requestedScope` is set for
 *     the explicit-scope path and OMITTED for the unqualified path that
 *     missed everywhere.
 *
 * All reads are `loadState` only (NFR-5: no network). The explicit-scope
 * miss performs ONE extra `loadState` of the other scope.
 *
 * DOES NOT touch `resolveInstallMarketplaceSource` (the CMP-3 install
 * fallback) -- this resolver serves the explicit-scope lifecycle path
 * (uninstall/reinstall/update), which has no by-design fallback.
 */
export type CrossScopePluginResolution =
  | { readonly kind: "resolved"; readonly scope: Scope; readonly locations: ScopedLocations }
  | { readonly kind: "other-scope"; readonly presentIn: Scope; readonly requestedScope: Scope }
  | { readonly kind: "marketplace-absent"; readonly requestedScope?: Scope };

/**
 * ATTR-02 / ATTR-03 / D-47-A structural signal for the marketplace-existence
 * precondition, shared by the update and reinstall direct-path enumerators.
 *
 * A single exported class is the one source of truth so `instanceof` checks
 * agree across orchestrators (a per-file copy would defeat `instanceof` by
 * class identity). The enumeration catch in each entrypoint detects it via
 * `instanceof` and emits ONE standalone `MarketplaceNotAddedMessage`
 * (`{not added}` on the marketplace subject) before any cascade row exists.
 *
 * `requestedScope` carries the explicitly-requested scope so the `[scope]`
 * bracket reads "not added in the scope you asked for" (SCOPE-01); it is
 * OMITTED for the bare form that missed in both scopes (no bracket).
 *
 * Structural (not REASONS): `{not added}` is the hard-coded brace of
 * `renderMarketplaceNotAdded`, reachable only via the dedicated variant -- no
 * new `REASONS` member is introduced (D-47-B).
 */
export class MarketplaceNotAddedSignal extends Error {
  readonly marketplace: string;
  readonly requestedScope?: Scope;
  constructor(marketplace: string, requestedScope?: Scope) {
    super(`Marketplace "${marketplace}" not added.`);
    this.name = "MarketplaceNotAddedSignal";
    this.marketplace = marketplace;
    if (requestedScope !== undefined) {
      this.requestedScope = requestedScope;
    }
  }
}

/** The non-requested scope -- used to read the other scope on an explicit-scope miss. */
function otherScope(scope: Scope): Scope {
  return scope === "project" ? "user" : "project";
}

/**
 * SCOPE-01: resolve a (marketplace, plugin) lifecycle target across scopes.
 * Mirrors the `loadState`/`locationsFor` read pattern from
 * `resolveScopeFromState` (marketplace/shared.ts) but returns a
 * discriminated result so the caller can distinguish marketplace-container
 * absence from plugin-row absence and surface the cross-scope hint.
 */
export async function resolveCrossScopePluginTarget(opts: {
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly explicitScope?: Scope;
}): Promise<CrossScopePluginResolution> {
  if (opts.explicitScope !== undefined) {
    const requestedScope = opts.explicitScope;
    const requestedLocations = locationsFor(requestedScope, opts.cwd);
    const requestedState = await loadState(requestedLocations.extensionRoot);

    // Container present in the requested scope: resolve there. The plugin
    // row may still be absent -- the caller's `installed === undefined`
    // branch handles that silent converge.
    if (requestedState.marketplaces[opts.marketplace] !== undefined) {
      return { kind: "resolved", scope: requestedScope, locations: requestedLocations };
    }

    // Container absent in the requested scope: consult the OTHER scope so a
    // target present only there is reported (SCOPE-01) rather than collapsed
    // into a silent/not-in-manifest miss.
    const otherScopeName = otherScope(requestedScope);
    const otherLocations = locationsFor(otherScopeName, opts.cwd);
    const otherState = await loadState(otherLocations.extensionRoot);
    if (otherState.marketplaces[opts.marketplace]?.plugins[opts.plugin] !== undefined) {
      return { kind: "other-scope", presentIn: otherScopeName, requestedScope };
    }

    // Absent in the requested scope, and either absent or merely container-
    // present-without-the-plugin in the other scope: the marketplace the
    // operator asked for (in the requested scope) is not added there.
    return { kind: "marketplace-absent", requestedScope };
  }

  // Unqualified form: prefer project, then user (CMP-5 ordering preserved).
  const projectLocations = locationsFor("project", opts.cwd);
  const userLocations = locationsFor("user", opts.cwd);
  const [projectState, userState] = await Promise.all([
    loadState(projectLocations.extensionRoot),
    loadState(userLocations.extensionRoot),
  ]);

  if (projectState.marketplaces[opts.marketplace]?.plugins[opts.plugin] !== undefined) {
    return { kind: "resolved", scope: "project", locations: projectLocations };
  }

  if (userState.marketplaces[opts.marketplace]?.plugins[opts.plugin] !== undefined) {
    return { kind: "resolved", scope: "user", locations: userLocations };
  }

  // Plugin row absent in both scopes. Distinguish "container present
  // somewhere" (resolved against that container's scope so the caller's
  // silent-converge path applies) from "container absent in both"
  // (marketplace-absent, no requestedScope bracket for the bare form).
  if (projectState.marketplaces[opts.marketplace] !== undefined) {
    return { kind: "resolved", scope: "project", locations: projectLocations };
  }

  if (userState.marketplaces[opts.marketplace] !== undefined) {
    return { kind: "resolved", scope: "user", locations: userLocations };
  }

  return { kind: "marketplace-absent" };
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

/**
 * CR-02: synthesize the marketplace `source` for a plugin
 * write-back into a config that does NOT yet declare the marketplace.
 *
 * When a project-scope install resolves the marketplace via the CMP-3
 * user-scope fallback, the clone-adoption path records the marketplace in
 * PROJECT state -- but only `marketplace add` writes marketplace config
 * entries, and it ran at USER scope. Writing the plugin key alone would
 * leave a dangling declaration: the reconcile planner turns it into a
 * perpetual `<marketplace not declared>` failed row AND plans the
 * recorded-but-undeclared clone for removal (a destructive, non-converging
 * plan -- invariant 5 violation). The caller must therefore declare the
 * marketplace in the SAME batched patch, synthesizing `source` from the
 * adopted record's verbatim `source.raw` (the `samePlannedSource`
 * contract).
 *
 * UAT-05: the membership gate runs against EVERY physical config of the
 * scope (base AND local -- i.e. the CFG-02 merged view), not just the
 * targeted file. Gating on the target alone made a `--local` install
 * re-declare a base-declared marketplace into `claude-plugins.local.json`
 * as a bare `{source}` entry; the CFG-02 wholesale entry-level override
 * then shadowed the base entry and silently flipped merged `autoupdate`.
 * Callers pass BOTH files' configs, read fresh inside the lock (WB-01
 * discipline); the merged view is used for the membership test ONLY --
 * never serialized back.
 *
 * Returns `undefined` when ANY physical config of the scope already
 * declares the marketplace (nothing to synthesize -- entry-stable) OR when
 * no string `source.raw` exists on the state record (hand-edited/legacy
 * state; writing a source-less entry would trip `saveConfig`'s
 * required-`source` invariant throw).
 *
 * S4 (PR #51, CONTEXT.md S4): the `undefined` return is OVERLOADED across
 * two semantically distinct arms -- the BENIGN already-declared arm AND the
 * DANGEROUS no-string-raw arm. Callers compose
 * `...(adoptedSource !== undefined && { marketplaces: { ... } })` and write
 * the plugin key REGARDLESS, so the dangerous arm silently writes a
 * dangling plugin declaration the reconcile planner converts into a
 * destructive `<marketplace not declared>` + recorded-clone removal plan
 * (the exact invariant-5 violation the function doc warns about). The
 * dangerous arm is rare in practice (hand-edited legacy state) and the
 * write-back fall-through is deliberate for now -- a future PR should
 * widen the return to a discriminated result so callers can route the
 * `unsynthesizable` arm to a (failed) row instead of sealing the fate.
 */
export function synthesizeUndeclaredMarketplaceSource(
  scopeConfigs: readonly ScopeConfig[],
  state: ExtensionState,
  marketplace: string,
): string | undefined {
  if (scopeConfigs.some((c) => c.marketplaces?.[marketplace] !== undefined)) {
    return undefined;
  }

  const raw = (state.marketplaces[marketplace]?.source as { raw?: unknown } | undefined)?.raw;
  return typeof raw === "string" ? raw : undefined;
}

/**
 * WB-01 / UAT-05: select the targeted physical config file and
 * its sibling (the scope's OTHER file). Target-path selection happens ONCE
 * at the orchestrator boundary so the write path never falls back to the
 * base file on ENOENT; the sibling path exists ONLY for the UAT-05
 * merged-view membership test (read fresh inside the lock, never written).
 */
export function selectConfigWriteTarget(
  locations: ScopedLocations,
  local: boolean | undefined,
): { readonly targetConfigPath: string; readonly siblingConfigPath: string } {
  if (local === true) {
    return {
      targetConfigPath: locations.configLocalJsonPath,
      siblingConfigPath: locations.configJsonPath,
    };
  }

  return {
    targetConfigPath: locations.configJsonPath,
    siblingConfigPath: locations.configLocalJsonPath,
  };
}

/**
 * UAT-05 convenience seam over `synthesizeUndeclaredMarketplaceSource`:
 * reads the scope's sibling config file FRESH (callers hold the scope lock
 * -- WB-01 discipline) and runs the merged-view membership gate against
 * BOTH physical files. The sibling load is membership-test-only input; it
 * is never serialized back. `absent` / `invalid` sibling arms
 * contribute an empty config, mirroring the D-18 merge fallback.
 */
export async function synthesizeAdoptedMarketplaceSource(opts: {
  readonly current: ScopeConfig;
  readonly siblingConfigPath: string;
  readonly state: ExtensionState;
  readonly marketplace: string;
}): Promise<string | undefined> {
  const siblingCfg = await loadConfig(opts.siblingConfigPath);
  const sibling: ScopeConfig =
    siblingCfg.status === "valid" ? siblingCfg.config : { schemaVersion: 1 };
  return synthesizeUndeclaredMarketplaceSource(
    [opts.current, sibling],
    opts.state,
    opts.marketplace,
  );
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

/**
 * SCOPE-01 / ATTR-02 / D-47-C discriminated `@marketplace` lifecycle target
 * resolution. The NFR-7 discriminated-union precedent applied to the update
 * direct path: the chokepoint distinguishes the three outcomes the former
 * `undefined`/raw-`MarketplaceNotFoundError` return collapsed (M11).
 *
 *   - `resolved`: the marketplace CONTAINER exists in the chosen scope (CMP-5
 *     precedence preserved -- see `resolveInstalledMarketplaceTarget`).
 *   - `other-scope`: the requested explicit scope misses, but the marketplace
 *     CONTAINER exists in the OTHER scope. The caller surfaces this as a
 *     `marketplace-not-added` carrying the REQUESTED scope (the `[scope]`
 *     bracket communicates "not added in the scope you asked for"; the
 *     operator infers the other scope -- resolved Open Question #1).
 *   - `marketplace-absent`: the container is absent in the requested scope AND
 *     the other scope, OR (for the unqualified `@mp` form) in BOTH scopes.
 *     `requestedScope` is set for the explicit-scope path and OMITTED for the
 *     unqualified path that missed everywhere (no-bracket form).
 *
 * No raw `MarketplaceNotFoundError` escapes -- the absent case is a structural
 * arm the update entrypoint maps to the standalone `{not added}` emission.
 */
export type ScopedMarketplaceResolution =
  | { readonly kind: "resolved"; readonly scope: Scope; readonly locations: ScopedLocations }
  | { readonly kind: "other-scope"; readonly presentIn: Scope; readonly requestedScope: Scope }
  | { readonly kind: "marketplace-absent"; readonly requestedScope?: Scope };

/**
 * CMP-5: unqualified `@marketplace` update targets project installs before user
 * installs. Returns a discriminated result instead of throwing
 * `MarketplaceNotFoundError` (M11) so the update direct path can emit the
 * standalone `{not added}` variant for the marketplace-existence precondition.
 *
 * CMP-5 precedence for the resolved arm is UNCHANGED (project-with-plugins ->
 * user-with-plugins -> project-empty -> user-empty). All reads are `loadState`
 * only (NFR-5: no network). The explicit-scope miss performs ONE extra
 * `loadState` of the other scope to surface the SCOPE-01 hint.
 */
export async function resolveInstalledMarketplaceTarget(opts: {
  readonly cwd: string;
  readonly marketplace: string;
  readonly explicitScope?: Scope;
}): Promise<ScopedMarketplaceResolution> {
  if (opts.explicitScope !== undefined) {
    const requestedScope = opts.explicitScope;
    const requestedLocations = locationsFor(requestedScope, opts.cwd);
    const requestedState = await loadState(requestedLocations.extensionRoot);

    // Container present in the requested scope: resolve there (the plugin set
    // may be empty -- the caller still reads it as the update target).
    if (requestedState.marketplaces[opts.marketplace] !== undefined) {
      return { kind: "resolved", scope: requestedScope, locations: requestedLocations };
    }

    // Container absent in the requested scope: consult the OTHER scope so a
    // marketplace present only there is reported (SCOPE-01) rather than
    // collapsed into a raw not-found throw.
    const otherScopeName = otherScope(requestedScope);
    const otherLocations = locationsFor(otherScopeName, opts.cwd);
    const otherState = await loadState(otherLocations.extensionRoot);
    if (otherState.marketplaces[opts.marketplace] !== undefined) {
      return { kind: "other-scope", presentIn: otherScopeName, requestedScope };
    }

    return { kind: "marketplace-absent", requestedScope };
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
    return { kind: "resolved", scope: "project", locations: projectLocations };
  }

  if (userRecord !== undefined && Object.keys(userRecord.plugins).length > 0) {
    return { kind: "resolved", scope: "user", locations: userLocations };
  }

  if (projectRecord !== undefined) {
    return { kind: "resolved", scope: "project", locations: projectLocations };
  }

  if (userRecord !== undefined) {
    return { kind: "resolved", scope: "user", locations: userLocations };
  }

  // Absent from BOTH scopes (bare `@mp` form): no requested scope to report.
  return { kind: "marketplace-absent" };
}

/**
 * PI-7 / PUP-3 / SNM-34 version precedence (3 tiers, highest first):
 *   1. The plugin's own `<pluginRoot>/.claude-plugin/plugin.json` `version`
 *      (D-23-01: "If also set in the marketplace entry, `plugin.json` wins.").
 *   2. The marketplace `entry.version`.
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
 * Cross-scope independence (D-10): the caller passes exactly one
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

/**
 * WB-01 / A7: deep-equal short-circuited plugin write-back shared by the
 * update and reinstall post-success paths. Loads the target config (base or
 * local per `--local`), compares the prospective patched entry against the
 * existing entry, and writes back ONLY when they differ. RECON-05
 * fixed-point: a byte-stable update / reinstall leaves the config file's
 * mtime + bytes untouched.
 *
 * S5: an `invalid` config returns `{ invalidConfig: true }` so the caller
 * surfaces the abort via a warning row -- the state mutation already
 * committed (finalize ran), so the byte form is the success payload (the
 * plugin DID update / reinstall on disk) plus the invalid-manifest warning.
 * Sibling CFG-03 aborts (at preflight) render `(skipped) {invalid manifest}`;
 * here the mutation already landed so a skip would lie -- the warning row
 * says "wrote state, could not write config".
 *
 * D-04: update / reinstall preserves the consume-time `enabled` default and
 * any forward-compat keys; the patch carries no per-operation mutation. The
 * patched shape is therefore `{...existing, ...{}}` -- byte-identical to the
 * existing entry. So the gate is simply: if the key is ALREADY PRESENT,
 * writing back would produce a byte-identical file -- SKIP to preserve
 * RECON-05 mtime stability. If the key is ABSENT, writing back ADDS the key
 * so the user-authored config gains the implicit declaration.
 */
export async function maybeWritePluginConfigBack(opts: {
  readonly locations: ScopedLocations;
  readonly marketplace: string;
  readonly plugin: string;
  readonly local: boolean;
}): Promise<{ readonly invalidConfig: boolean }> {
  const targetConfigPath = opts.local
    ? opts.locations.configLocalJsonPath
    : opts.locations.configJsonPath;
  const cfg = await loadConfig(targetConfigPath);
  if (cfg.status === "invalid") {
    return { invalidConfig: true };
  }

  const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
  const key = `${opts.plugin}@${opts.marketplace}`;
  const existingEntry = current.plugins?.[key];
  if (existingEntry !== undefined) {
    return { invalidConfig: false };
  }

  await writePluginConfigEntry(
    current,
    targetConfigPath,
    opts.locations.scopeRoot,
    opts.plugin,
    opts.marketplace,
    {},
  );
  return { invalidConfig: false };
}

/**
 * I3 / TR-03: subtract a non-AG-5 partial-cascade's dropped artefacts from
 * the state record in place so the persisted row reflects only artefacts
 * still on disk (NFR-3 fail-clean, no ghost record). Shared by the
 * `uninstall` partial-cascade arm and the `disable` partial-cascade arm.
 *
 * The asymmetric `dropped.commands -> resources.prompts` mapping is per
 * TR-03 (cascade primitive naming): the other three axes are name-identical.
 */
export function applyPartialCascadeFold(
  installed: {
    resources: { skills: string[]; prompts: string[]; agents: string[]; mcpServers: string[] };
  },
  dropped: {
    readonly skills: readonly string[];
    readonly commands: readonly string[];
    readonly agents: readonly string[];
    readonly mcpServers: readonly string[];
  },
): void {
  installed.resources.skills = installed.resources.skills.filter(
    (n) => !dropped.skills.includes(n),
  );
  installed.resources.prompts = installed.resources.prompts.filter(
    (n) => !dropped.commands.includes(n),
  );
  installed.resources.agents = installed.resources.agents.filter(
    (n) => !dropped.agents.includes(n),
  );
  installed.resources.mcpServers = installed.resources.mcpServers.filter(
    (n) => !dropped.mcpServers.includes(n),
  );
}

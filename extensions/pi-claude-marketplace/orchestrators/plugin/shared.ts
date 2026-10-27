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
// Per D-v1.0-01-11 import boundaries, this file lives in `orchestrators/plugin/`
// and may import from `domain/`, `shared/`, and `persistence/` (type-only).
// No imports from `bridges/` or `orchestrators/marketplace/*`.

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  copyManifestBoundary,
  locateManifestCandidate,
  sourceManifestBoundary,
} from "../../domain/manifest-containment.ts";
import { MANIFEST_CANDIDATES } from "../../domain/manifest-path.ts";
import { parsePluginSource } from "../../domain/source.ts";
import {
  computeHashVersion,
  declaredVersionWithPin,
  isSameVersion,
  shaVersion,
  tagShaVersion,
  withTagCommit,
} from "../../domain/version.ts";
import { loadConfig } from "../../persistence/config-io.ts";
import {
  writeBatchedConfigEntries,
  writePluginConfigEntry,
} from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { isRecordedButDisabled, loadState, rangeVersionOf } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import {
  CrossPluginConflictError,
  DependencyDeclarationsUnreadableError,
  errorMessage,
  isErrnoException,
  LayerConfigUnreadableError,
  MarketplaceInLocalLayerOnlyError,
  MarketplaceNotFoundError,
  MarketplaceSourceUndeclarableError,
  PluginInBaseLayerOnlyError,
  PluginInLocalLayerOnlyError,
} from "../../shared/errors.ts";
import { notify, notifyDiagnostic } from "../../shared/notification-dispatch.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { ownValue, setOwn } from "../../shared/own-key.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";
import {
  crossScopeFlag,
  marketplaceInOtherScope,
  type UnstageOutcome,
} from "../marketplace/shared.ts";

import { readRecordDeclarations } from "./dependency-index.ts";
import { garbageCollectWorkflowsStaging } from "./workflows-staging-gc.ts";

import type { MarketplaceStateRecord } from "./dependency-index.ts";
import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { ManifestBoundary } from "../../domain/manifest-containment.ts";
import type { MaterializablePlugin, ResolveContext } from "../../domain/resolver-types.ts";
import type {
  ConfigLoadResult,
  PluginConfigEntry,
  ScopeConfig,
} from "../../persistence/config-io.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState, PluginInstallRecord } from "../../persistence/state-io.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { CommandContext } from "../../shared/notify-context.ts";
import type { DegradeKind } from "../../shared/notify-reasons.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * The degradation signals ONE `runInstallLedger` run produces, carried together
 * on every success outcome of every verb that drives that ledger -- `install`
 * and the enable branch alike. Both verbs run the SAME ledger over the SAME
 * bridges, so a signal one row names and the other omits is a row that
 * contradicts its own ledger.
 *
 * The shape lives here because `install-flow.ts` and `enable-disable.ts` BOTH
 * already import, rather than in either of them: `enable-disable.ts` imports
 * `runInstallLedger` from `install-outcome.ts`, so declaring it there and importing it
 * back would close a module cycle (IN-07 / D-98-01).
 *
 * Consumed by `freshEnableRow` (standalone enable), `enabledRowFromOutcome` and
 * `installedRowFromOutcome` (reconcile projections), and the standalone install
 * row -- the row composers must agree, so they read ONE shape rather than
 * hand-synchronized field lists. Every field is optional and omitted when
 * empty, so an unaffected outcome renders byte-identically (NREG-01).
 */
export interface LedgerDegradationSignals {
  /**
   * ENBL-07 / FSTAT-07 / D-66-04: the LIVE dropped-component kinds when the run
   * went through the partial gate (the resolver's `partially-available` arm).
   * Non-empty selects the `(partially-installed)` row over `(installed)`, so
   * the row agrees with the record the ledger just wrote -- and therefore with
   * the `list` / `info` row rendered next.
   */
  readonly unsupported?: readonly string[];
  /**
   * SURF-05 / D-63-08: a hook handler declared `rewakeMessage` /
   * `rewakeSummary` without `asyncRewake: true`. One `{orphan rewake}` token
   * per plugin regardless of N orphan handlers, on whichever verb materialized
   * it. Names itself in the brace without moving the severity channel.
   */
  readonly orphanRewake?: boolean;
  /**
   * WARN-01 / D-86-03: the component kinds whose source frontmatter could not
   * be parsed and installed in degraded form. Each kind contributes one
   * `{malformed skill}` / `{malformed command}` token AND raises the row from
   * `info` to `warning` -- the same raise `install-flow.ts::composeInstalledRow`
   * applies, because a degraded component is carried out but short of ideal
   * whichever verb materialized it.
   */
  readonly degradedKinds?: readonly DegradeKind[];
  /**
   * SEV-01 / D-98-02: the ledger staged at least one agent, so the row DECLARES
   * the `pi-subagents` companion. Drives the `{requires pi-subagents}` marker
   * and, when that companion is unloaded, the info -> warning raise. Carries a
   * COUNT verdict only -- the staged agent names never reach a rendered row.
   */
  readonly stagedAgents?: boolean;
  /**
   * SEV-01 / D-98-02: the ledger staged at least one MCP server, so the row
   * DECLARES the `pi-mcp-adapter` companion. The MCP counterpart of
   * `stagedAgents`, driving the `{requires pi-mcp-adapter}` marker and the same raise.
   */
  readonly stagedMcpServers?: boolean;
  /**
   * SEV-01: the ledger staged at least one workflow, so the row DECLARES the
   * host workflow engine. The workflows counterpart of `stagedAgents`, driving
   * the `{requires pi-dynamic-workflows}` marker and the same raise. Carries a
   * COUNT verdict only -- the staged workflow names never reach a rendered row.
   */
  readonly stagedWorkflows?: boolean;
}

/**
 * Lift the ledger's degradation signals off an orchestrated enable outcome,
 * for reconcile's enable row and import's (IMP-10). Each field is omitted when
 * empty (`exactOptionalPropertyTypes`), so a clean enable yields `{}` and its
 * projected row gains no markers (NREG-01). The `partition?: never` refusal
 * keeps the update and reinstall partitions out, as on `enableRowDependencies`.
 *
 * SEV-01 / D-98-02: the staged-count verdicts ride here too -- they drive the
 * projected row's dependency list, mirroring the install arm's
 * `dependenciesFromInstall` derivation.
 */
export function degradationFromEnable(
  result: LedgerDegradationSignals & { readonly partition?: never },
): LedgerDegradationSignals {
  return {
    ...(result.unsupported !== undefined && { unsupported: result.unsupported }),
    ...(result.orphanRewake === true && { orphanRewake: true }),
    ...(result.degradedKinds !== undefined && { degradedKinds: result.degradedKinds }),
    ...(result.stagedAgents === true && { stagedAgents: true }),
    ...(result.stagedMcpServers === true && { stagedMcpServers: true }),
    ...(result.stagedWorkflows === true && { stagedWorkflows: true }),
  };
}

/**
 * SEV-01 / D-98-02: derive the closed-set `Dependency[]` an enable row declares
 * from the ledger's staged-count signals -- the same derivation `install-flow.ts`
 * runs off `installCtx.stagedAgentNames` / `stagedMcpServerNames` /
 * `stagedWorkflowNames` for the same ledger run. Shared by the standalone
 * enable row and the reconcile enable projection so the two row composers
 * cannot drift.
 *
 * WR-01: all three picked members are OPTIONAL, so every shape that inherits
 * `LedgerDegradationSignals` matched this parameter structurally -- including
 * `PluginUpdateUpdatedOutcome`, which spells the same facts as `declaresAgents`
 * / `declaresMcp` / `declaresWorkflows` and would therefore have compiled here
 * and returned `[]` for every update. The `partition?: never` refusal excludes
 * the outcome shapes discriminated by that field (the update / reinstall
 * partitions) while leaving the two `kind`-discriminated enable outcomes this
 * function serves untouched.
 *
 * WDEP-02: `workflows` pushes LAST, so an enable that staged agents and MCP
 * servers renders the same two-marker brace whether or not it staged workflows.
 */
export function enableRowDependencies(
  signals: Pick<
    LedgerDegradationSignals,
    "stagedAgents" | "stagedMcpServers" | "stagedWorkflows"
  > & {
    readonly partition?: never;
  },
): readonly Dependency[] {
  const dependencies: Dependency[] = [];
  if (signals.stagedAgents === true) {
    dependencies.push("agents");
  }

  if (signals.stagedMcpServers === true) {
    dependencies.push("mcp");
  }

  if (signals.stagedWorkflows === true) {
    dependencies.push("workflows");
  }

  return dependencies;
}

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
 * three outcomes that a single `undefined`/raw-throw return would
 * collapse.
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
 * (`{marketplace not added}` on the marketplace subject) before any cascade row exists.
 *
 * `requestedScope` carries the explicitly-requested scope so the `[scope]`
 * bracket reads "not added in the scope you asked for" (SCOPE-01); it is
 * OMITTED for the bare form that missed in both scopes (no bracket).
 *
 * Structural (not REASONS): `{marketplace not added}` is the hard-coded brace of
 * `renderMarketplaceNotAdded`, reachable only via the dedicated variant -- no
 * new `REASONS` member is introduced (D-47-B).
 */
export class MarketplaceNotAddedSignal extends Error {
  readonly marketplace: string;
  readonly requestedScope?: Scope;
  /**
   * SCOPE-01: set when the miss is really "nothing is installed at the scope
   * you named" -- see `missIsNotInstalled`. The handler then renders the
   * PLUGIN row `(failed) {not installed}` instead of the marketplace
   * row, because the container's registration scope is not what the operator
   * asked about. Carries the plugin so the row has a subject; both fields are
   * set together or not at all.
   */
  readonly notInstalledAt?: Scope;
  readonly plugin?: string;
  constructor(
    marketplace: string,
    requestedScope?: Scope,
    notInstalled?: { readonly scope: Scope; readonly plugin: string },
  ) {
    super(`Marketplace "${marketplace}" not added.`);
    this.name = "MarketplaceNotAddedSignal";
    this.marketplace = marketplace;
    if (requestedScope !== undefined) {
      this.requestedScope = requestedScope;
    }

    if (notInstalled !== undefined) {
      this.notInstalledAt = notInstalled.scope;
      this.plugin = notInstalled.plugin;
    }
  }
}

/** The non-requested scope -- used to read the other scope on an explicit-scope miss. */
function otherScope(scope: Scope): Scope {
  return scope === "project" ? "user" : "project";
}

/** D-08-07: whether `state` records `plugin` under `marketplace`, by own keys only. */
function hasPluginRecord(state: ExtensionState, marketplace: string, plugin: string): boolean {
  return ownValue(ownValue(state.marketplaces, marketplace)?.plugins, plugin) !== undefined;
}

/** Both scopes' locations and state, loaded in parallel for the unqualified target forms. */
async function loadBothScopes(cwd: string): Promise<{
  readonly projectLocations: ScopedLocations;
  readonly userLocations: ScopedLocations;
  readonly projectState: ExtensionState;
  readonly userState: ExtensionState;
}> {
  const projectLocations = locationsFor("project", cwd);
  const userLocations = locationsFor("user", cwd);
  const [projectState, userState] = await Promise.all([
    loadState(projectLocations.extensionRoot),
    loadState(userLocations.extensionRoot),
  ]);
  return { projectLocations, userLocations, projectState, userState };
}

/**
 * SCOPE-01: the explicit-scope arm of the lifecycle target resolvers. A
 * container in the requested scope resolves there. Otherwise the OTHER scope
 * is consulted, so a target present only there is reported rather than
 * collapsed into a silent miss: `presentInOther` gives `other-scope`, and
 * anything else means the marketplace is not added in the requested scope.
 */
async function resolveExplicitScope(
  cwd: string,
  marketplace: string,
  requestedScope: Scope,
  presentInOther: (otherState: ExtensionState) => boolean,
): Promise<CrossScopePluginResolution> {
  const requestedLocations = locationsFor(requestedScope, cwd);
  const requestedState = await loadState(requestedLocations.extensionRoot);
  if (ownValue(requestedState.marketplaces, marketplace) !== undefined) {
    return { kind: "resolved", scope: requestedScope, locations: requestedLocations };
  }

  const otherScopeName = otherScope(requestedScope);
  const otherState = await loadState(locationsFor(otherScopeName, cwd).extensionRoot);
  if (presentInOther(otherState)) {
    return { kind: "other-scope", presentIn: otherScopeName, requestedScope };
  }

  return { kind: "marketplace-absent", requestedScope };
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
    // The plugin row may be absent from a resolved container -- the caller's
    // `installed === undefined` branch handles that silent converge. A
    // container that holds no such row in the other scope reads as not added
    // in the requested scope.
    return resolveExplicitScope(opts.cwd, opts.marketplace, opts.explicitScope, (otherState) =>
      hasPluginRecord(otherState, opts.marketplace, opts.plugin),
    );
  }

  // Unqualified form: prefer project, then user (CMP-5 ordering preserved).
  const { projectLocations, userLocations, projectState, userState } = await loadBothScopes(
    opts.cwd,
  );

  if (hasPluginRecord(projectState, opts.marketplace, opts.plugin)) {
    return { kind: "resolved", scope: "project", locations: projectLocations };
  }

  if (hasPluginRecord(userState, opts.marketplace, opts.plugin)) {
    return { kind: "resolved", scope: "user", locations: userLocations };
  }

  // Plugin row absent in both scopes. Distinguish "container present
  // somewhere" (resolved against that container's scope so the caller's
  // silent-converge path applies) from "container absent in both"
  // (marketplace-absent, no requestedScope bracket for the bare form).
  if (ownValue(projectState.marketplaces, opts.marketplace) !== undefined) {
    return { kind: "resolved", scope: "project", locations: projectLocations };
  }

  if (ownValue(userState.marketplaces, opts.marketplace) !== undefined) {
    return { kind: "resolved", scope: "user", locations: userLocations };
  }

  return { kind: "marketplace-absent" };
}

/**
 * SCOPE-01: does this miss mean "nothing is installed at the scope you named"
 * rather than "no such marketplace"? Returns the requested scope when so, and
 * `undefined` when the marketplace row is the truthful complaint.
 *
 * The lifecycle verbs -- uninstall / enable / disable -- act on an INSTALL
 * RECORD, so a container registered one scope over is not what the operator
 * asked about, and telling them to add the marketplace would not make the
 * command succeed. Two resolutions mean the same thing to them:
 *   - `other-scope`  -- the plugin is installed, just not here.
 *   - `marketplace-absent` where the container is registered in the other
 *     scope -- nothing is installed here either.
 *
 * A marketplace absent from BOTH scopes keeps the marketplace row on purpose:
 * a typo'd marketplace name would otherwise read as a plugin that is merely
 * not installed, hiding the real mistake.
 *
 * The bare (no `--scope`) form never qualifies -- it consulted both scopes
 * already, and its `marketplace-absent` carries no `requestedScope`.
 */
export async function missIsNotInstalled(opts: {
  readonly cwd: string;
  readonly marketplace: string;
  readonly resolution: CrossScopePluginResolution;
}): Promise<Scope | undefined> {
  const { resolution } = opts;
  if (resolution.kind === "other-scope") {
    return resolution.requestedScope;
  }

  if (resolution.kind !== "marketplace-absent" || resolution.requestedScope === undefined) {
    return undefined;
  }

  const elsewhere = await marketplaceInOtherScope({
    cwd: opts.cwd,
    marketplace: opts.marketplace,
    scope: resolution.requestedScope,
  });
  return elsewhere ? resolution.requestedScope : undefined;
}

/**
 * SCOPE-01 / D-01: the reason set every absent-target lifecycle row carries.
 *
 * "The marketplace is here and you never installed this plugin" and "the
 * marketplace is one scope over, so nothing of it is installed here" are
 * different situations with different remedies -- install the plugin, versus
 * target the other scope or add the marketplace at the one you named -- and a
 * row that states neither cannot be acted on. The cross-scope arm names the
 * container's actual scope; the in-scope arm carries the bare
 * `{not installed}`.
 *
 * `notInstalledAt` is `missIsNotInstalled`'s answer: the scope the operator
 * NAMED, returned ONLY when the container is registered in the other one. Both
 * of that helper's arms prove that placement -- `other-scope` found the plugin
 * row itself under the sibling scope's container, and the `marketplace-absent`
 * arm returns the scope only after `marketplaceInOtherScope` answered `true`.
 * The token is therefore the FLIP of the argument, and it is derived from a
 * probe already paid for; this helper adds no read of its own.
 *
 * `undefined` (the container is in the named scope, or both scopes were
 * consulted and both missed) keeps the bare set.
 */
export function absentTargetReasons(notInstalledAt?: Scope): readonly ContentReason[] {
  if (notInstalledAt === undefined) {
    return ["not installed"];
  }

  return [
    "not installed",
    notInstalledAt === "user" ? "marketplace in project scope" : "marketplace in user scope",
  ];
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
  const targetRecord = ownValue(opts.targetState.marketplaces, opts.marketplace);
  if (targetRecord !== undefined) {
    return { sourceScope: opts.targetScope, sourceRecord: targetRecord };
  }

  if (opts.targetScope === "user") {
    return undefined;
  }

  const userLocations = locationsFor("user", opts.cwd);
  const userState = await loadState(userLocations.extensionRoot);
  const userRecord = ownValue(userState.marketplaces, opts.marketplace);
  return userRecord === undefined ? undefined : { sourceScope: "user", sourceRecord: userRecord };
}

/**
 * D-03-08: every marketplace name one install can READ, which is the
 * CMP-3-aware set `resolveInstallMarketplaceSource` answers from -- the target
 * scope's own records plus, for a project-scope install, the user scope's.
 *
 * The dependency cascade gates a child edge on this set. Gating on the raw
 * target-scope key set instead puts two different notions of "reachable" in one
 * walk: the guard runs BEFORE the walk's own catalog read, so the stricter one
 * wins and a dependency is refused for naming a marketplace the lookup one step
 * later would have resolved. That refusal is the one cascade message with a
 * trust rule behind it, so it reads to the user as a security decision when it
 * is a resolution bug.
 *
 * The trust rule itself is untouched: every name in this set is one the user
 * added themselves. Nothing here adds or clones a marketplace.
 *
 * NFR-5: filesystem only. The user-scope read is `loadState`, the same read the
 * per-marketplace resolver already performs on its own fallback arm.
 */
export async function collectInstallReachableMarketplaces(opts: {
  readonly targetScope: Scope;
  readonly cwd: string;
  readonly targetState: ExtensionState;
}): Promise<ReadonlySet<string>> {
  const names = new Set(Object.keys(opts.targetState.marketplaces));
  if (opts.targetScope === "user") {
    return names;
  }

  const userState = await loadState(locationsFor("user", opts.cwd).extensionRoot);
  for (const name of Object.keys(userState.marketplaces)) {
    names.add(name);
  }

  return names;
}

/**
 * How a layer would declare a marketplace beside a plugin key: `declared` when
 * a passed layer already declares it, `source` with the string to declare it
 * with, or `unknown` when no source is known.
 */
type MarketplaceDeclaration =
  | { readonly kind: "declared" }
  | { readonly kind: "source"; readonly source: string }
  | { readonly kind: "unknown" };

/**
 * CR-02: the marketplace `source` for a plugin write-back into a config that
 * does NOT yet declare the marketplace.
 *
 * When a project-scope install resolves the marketplace via the CMP-3
 * user-scope fallback, the install adds the marketplace to PROJECT state
 * through the `marketplace add` body (LAYER-07 / D-MF-04), which writes no
 * config entry: the install owns the write-back. Writing the plugin key alone
 * would leave a dangling declaration: the reconcile planner turns it into a
 * perpetual `<marketplace not declared>` failed row AND plans the
 * recorded-but-undeclared clone for removal (a destructive, non-converging
 * plan -- invariant 5 violation). The caller must therefore declare the
 * marketplace in the SAME batched patch, synthesizing `source` from the
 * added record's verbatim `source.raw` (the `samePlannedSource`
 * contract).
 *
 * The caller passes the layers whose declaration counts, read fresh inside the
 * lock (WB-01 discipline) and never serialized back:
 * - the target layer alone for the plugin's own marketplace. A layer that
 *   declares a plugin also declares its marketplace (LAYER-06 / D-MF-03), so a
 *   later `marketplace remove` from the other layer keeps the plugin;
 * - both layers for a marketplace the install added for a dependency. No layer
 *   declares a dependency plugin (D-04-02), so a scope that declares the
 *   marketplace in either layer already wants it.
 *
 * A state record without a string `source.raw` (a forward-compatible source
 * kind, NFR-12) falls back to the source `fallback` declares, the other layer
 * for the plugin's own marketplace. The merged view reads that same string, so
 * the planner sees the same source. With neither, the answer is `unknown`.
 */
function undeclaredMarketplaceSource(
  scopeConfigs: readonly ScopeConfig[],
  state: ExtensionState,
  marketplace: string,
  fallback?: ScopeConfig,
): MarketplaceDeclaration {
  if (scopeConfigs.some((c) => ownValue(c.marketplaces, marketplace) !== undefined)) {
    return { kind: "declared" };
  }

  const record = ownValue(state.marketplaces, marketplace);
  const raw = (record?.source as { raw?: unknown } | undefined)?.raw;
  const source =
    typeof raw === "string" ? raw : ownValue(fallback?.marketplaces, marketplace)?.source;
  return source === undefined ? { kind: "unknown" } : { kind: "source", source };
}

/**
 * WB-01: a scope's two config paths, the target first. `--local` targets the
 * local config and no flag the base config. The flag alone picks the target,
 * so the write path never falls back to the base config on ENOENT:
 * `loadConfig`'s `absent` arm yields an empty shape that `saveConfig` writes
 * back to the target, creating it fresh.
 */
function targetLayerPaths(
  locations: ScopedLocations,
  local: boolean | undefined,
): { readonly targetConfigPath: string; readonly otherConfigPath: string } {
  if (local === true) {
    return {
      targetConfigPath: locations.localConfigJsonPath,
      otherConfigPath: locations.baseConfigJsonPath,
    };
  }

  return {
    targetConfigPath: locations.baseConfigJsonPath,
    otherConfigPath: locations.localConfigJsonPath,
  };
}

/**
 * What `loadTargetLayers` returns: both layers' parses with the target layer
 * marked, or the first config that cannot be read. Discriminated, because a
 * scope whose layer cannot be read has no answer, and a caller must be unable
 * to ignore that (NFR-7 precedent).
 */
export type TargetLayers =
  | { readonly kind: "unreadable"; readonly filePath: string }
  | {
      readonly kind: "loaded";
      readonly targetConfigPath: string;
      readonly targetIsLocal: boolean;
      /** The target layer's parse; an absent file yields the empty shape. */
      readonly current: ScopeConfig;
      /** The other layer's parse; an absent file yields the empty shape. */
      readonly other: ScopeConfig;
    };

/**
 * LAYER-04 / D-MF-03: load both layers of a scope and mark the one that
 * `--local` targets, the base layer without the flag, whatever layer already
 * declares the plugin. The caller reads the other layer from `other` to
 * refuse a plugin only that layer declares.
 *
 * CFG-03: an invalid target layer returns `unreadable` naming it, and then an
 * invalid other layer returns `unreadable` naming that file. The other layer
 * may declare the plugin or its marketplace, so an unreadable one stops the
 * command instead of reading as a layer that declares nothing. `loadConfig`
 * never throws: an EACCES, a truncated mid-save file, and a schema violation
 * all arrive as `invalid`. `absent` is a real answer and reads as empty. This
 * never throws and never creates a file.
 *
 * `targetIsLocal` reports which parse is the local one, so callers that read
 * across both layers (`install-declared-enabled.ts` reads the local `enabled`
 * first, then the base one) do not compare paths.
 *
 * WB-01: both reads happen inside the caller's lock, and neither parse is
 * serialized back. The lock excludes other extension processes; it does not
 * exclude a user editing these hand-authored files, so the worst case is a
 * decision made from a config one edit old. The write itself is atomic.
 */
export async function loadTargetLayers(opts: {
  readonly locations: ScopedLocations;
  readonly local: boolean | undefined;
}): Promise<TargetLayers> {
  const { targetConfigPath, otherConfigPath } = targetLayerPaths(opts.locations, opts.local);
  const [targetCfg, otherCfg] = await Promise.all([
    loadConfig(targetConfigPath),
    loadConfig(otherConfigPath),
  ]);
  if (targetCfg.status === "invalid") {
    return { kind: "unreadable", filePath: targetCfg.filePath };
  }

  if (otherCfg.status === "invalid") {
    return { kind: "unreadable", filePath: otherCfg.filePath };
  }

  return {
    kind: "loaded",
    targetConfigPath,
    targetIsLocal: opts.local === true,
    current: configOrEmpty(targetCfg),
    other: configOrEmpty(otherCfg),
  };
}

/** A readable layer's parse; an absent layer reads as one that declares nothing. */
export function configOrEmpty(result: ConfigLoadResult): ScopeConfig {
  return result.status === "valid" ? result.config : { schemaVersion: 1 };
}

/**
 * FIX-03 / D-MF-02: a declaration in the base layer may not name a marketplace
 * that only the local config declares, because a teammate who reads the base
 * config cannot resolve it. Returns the refusal when the write targets the
 * base config, the base config does not declare `marketplace`, and the local
 * config does.
 *
 * It reads only the target scope's own two configs. A marketplace neither
 * config declares (one a project install adds from the user scope, CMP-3) and
 * one both configs declare (a declaration in the base layer with a personal
 * override) are never refused.
 */
export function localOnlyMarketplaceRefusal(
  selection: Pick<Extract<TargetLayers, { kind: "loaded" }>, "targetIsLocal" | "current" | "other">,
  marketplace: string,
): MarketplaceInLocalLayerOnlyError | undefined {
  if (
    selection.targetIsLocal ||
    ownValue(selection.current.marketplaces, marketplace) !== undefined ||
    ownValue(selection.other.marketplaces, marketplace) === undefined
  ) {
    return undefined;
  }

  return new MarketplaceInLocalLayerOnlyError(marketplace);
}

/**
 * LAYER-06 / D-MF-03: a command that declares a plugin in a layer also
 * declares the plugin's marketplace there. Returns the refusal when the target
 * layer does not declare the marketplace and no source is known to declare it
 * with: the scope's record holds no string source and the other layer does not
 * declare it. A marketplace the scope does not record yet is never refused,
 * because the install that adds it records its source.
 */
export function undeclarableMarketplaceRefusal(
  selection: Pick<Extract<TargetLayers, { kind: "loaded" }>, "targetIsLocal" | "current" | "other">,
  state: ExtensionState,
  marketplace: string,
): MarketplaceSourceUndeclarableError | undefined {
  if (
    ownValue(state.marketplaces, marketplace) === undefined ||
    undeclaredMarketplaceSource([selection.current], state, marketplace, selection.other).kind !==
      "unknown"
  ) {
    return undefined;
  }

  return new MarketplaceSourceUndeclarableError(
    marketplace,
    selection.targetIsLocal ? "local" : "base",
  );
}

/**
 * Where a plugin a named command targets is declared, as seen from the
 * command's target layer:
 *
 * - `target-only`: only the target layer declares it.
 * - `both`: both layers declare it.
 * - `other-only`: only the other layer declares it; `refusal` is the cause line.
 * - `neither`: no layer declares it (a dependency, or a hand-removed entry).
 */
export type PluginLayerVerdict =
  | { readonly kind: "target-only" }
  | { readonly kind: "both" }
  | {
      readonly kind: "other-only";
      readonly reason: "plugin in local layer only" | "plugin in base layer only";
      readonly refusal: PluginInLocalLayerOnlyError | PluginInBaseLayerOnlyError;
    }
  | { readonly kind: "neither" };

/**
 * LAYER-04 / D-MF-03: a named plugin command acts on its target layer, and
 * fails when that layer does not declare the plugin while the other one does.
 *
 * Pure: the caller loads both layers inside its lock and handles an invalid
 * file first (CFG-03), so both arguments are readable parses. Membership is an
 * own-key read, so a key the layer holds only through its prototype declares
 * nothing.
 */
export function pluginLayerVerdict(args: {
  readonly target: ScopeConfig;
  readonly other: ScopeConfig;
  readonly targetIsLocal: boolean;
  readonly marketplace: string;
  readonly plugin: string;
}): PluginLayerVerdict {
  const key = `${args.plugin}@${args.marketplace}`;
  const inTarget = ownValue(args.target.plugins, key) !== undefined;
  const inOther = ownValue(args.other.plugins, key) !== undefined;
  if (inTarget) {
    return { kind: inOther ? "both" : "target-only" };
  }

  if (!inOther) {
    return { kind: "neither" };
  }

  return args.targetIsLocal
    ? {
        kind: "other-only",
        reason: "plugin in base layer only",
        refusal: new PluginInBaseLayerOnlyError(args.plugin, args.marketplace),
      }
    : {
        kind: "other-only",
        reason: "plugin in local layer only",
        refusal: new PluginInLocalLayerOnlyError(args.plugin, args.marketplace),
      };
}

/**
 * LAYER-04 / D-MF-03: the refusal a named update or reinstall meets when the
 * plugin is declared only in the other layer. `--local` targets the local layer
 * and no flag targets the base layer. A plugin that no layer declares, such
 * as a dependency, is not refused.
 *
 * CFG-03: an unreadable layer config returns `LayerConfigUnreadableError`, an
 * invalid manifest naming only its basename, because the plugin may be
 * declared there.
 *
 * NFR-5: it reads only the scope's two layer configs, so a caller can run it
 * before any credential, clone, or tag listing.
 */
export async function namedPluginLayerRefusal(opts: {
  readonly locations: ScopedLocations;
  readonly local: boolean;
  readonly marketplace: string;
  readonly plugin: string;
}): Promise<Error | undefined> {
  const selection = await loadTargetLayers(opts);
  if (selection.kind === "unreadable") {
    return unreadableLayerError(selection.filePath);
  }

  const verdict = pluginLayerVerdict({
    target: selection.current,
    other: selection.other,
    targetIsLocal: selection.targetIsLocal,
    marketplace: opts.marketplace,
    plugin: opts.plugin,
  });
  return verdict.kind === "other-only" ? verdict.refusal : undefined;
}

/** CFG-03: an unreadable layer config, named by its basename only. */
function unreadableLayerError(filePath: string): LayerConfigUnreadableError {
  return new LayerConfigUnreadableError(path.basename(filePath));
}

/**
 * LAYER-04 / D-MF-03: a nameless update or reinstall with `--local` covers
 * the plugins the local layer declares and the dependencies those plugins
 * need. Keeps, in order, the targets whose `<plugin>@<marketplace>` key is
 * covered in their scope. Each scope's layers and state are read once.
 *
 * CFG-03: an unreadable layer throws `LayerConfigUnreadableError` naming it,
 * the local layer first, instead of reading as a layer that declares nothing.
 * D-05-07: a covered plugin whose dependencies cannot be read throws
 * `DependencyDeclarationsUnreadableError` naming it.
 */
export async function keepLocalLayerTargets<
  T extends { readonly plugin: string; readonly marketplace: string; readonly scope: Scope },
>(targets: readonly T[], cwd: string): Promise<readonly T[]> {
  const scopes = [...new Set(targets.map((target) => target.scope))];
  const covered = new Set(
    (await Promise.all(scopes.map((scope) => localLayerCoverage(scope, cwd)))).flat(),
  );
  return targets.filter((target) =>
    covered.has(`${target.scope}:${target.plugin}@${target.marketplace}`),
  );
}

/**
 * The scope-qualified keys a `--local` form covers in one scope: every key the
 * local layer declares, then each dependency those plugins need, walked
 * through installed plugins that no layer declares. A plugin the base layer
 * declares ends the walk, so a dependency that only base-layer plugins need
 * is not covered. This is the walk the LAYER-08 uninstall rule makes, read in
 * the other direction.
 *
 * D-05-06 / D-05-07: declarations are read offline and fail closed, as the
 * uninstall reads them. A plugin whose declarations cannot be read stops the
 * walk, because the dependencies it would add are unknown.
 */
async function localLayerCoverage(scope: Scope, cwd: string): Promise<readonly string[]> {
  const locations = locationsFor(scope, cwd);
  const layers = await loadTargetLayers({ locations, local: true });
  if (layers.kind === "unreadable") {
    throw unreadableLayerError(layers.filePath);
  }

  const state = await loadState(locations.extensionRoot);
  const records = recordsByKey(state);
  const covered = new Set(Object.keys(layers.current.plugins ?? {}));
  const pending = [...covered];
  for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
    const record = records.get(key);
    if (record === undefined) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- each read names the plugins the walk visits next
    const read = await readRecordDeclarations(
      { state, locations },
      record.marketplace,
      record.plugin,
    );
    if (!read.ok) {
      throw new DependencyDeclarationsUnreadableError(read.declarer, read.cause.message);
    }

    for (const dependency of read.declared) {
      const dependencyKey = `${dependency.name}@${dependency.marketplace}`;
      if (
        !covered.has(dependencyKey) &&
        ownValue(layers.other.plugins, dependencyKey) === undefined
      ) {
        covered.add(dependencyKey);
        pending.push(dependencyKey);
      }
    }
  }

  return [...covered].map((key) => `${scope}:${key}`);
}

/** An installed plugin: its marketplace record and its name. */
interface InstalledPluginRef {
  readonly marketplace: MarketplaceStateRecord;
  readonly plugin: string;
}

/** Each installed plugin by its `<plugin>@<marketplace>` key. */
function recordsByKey(state: ExtensionState): ReadonlyMap<string, InstalledPluginRef> {
  const records = new Map<string, InstalledPluginRef>();
  for (const marketplace of Object.values(state.marketplaces)) {
    for (const plugin of Object.keys(marketplace.plugins)) {
      records.set(`${plugin}@${marketplace.name}`, { marketplace, plugin });
    }
  }

  return records;
}

/**
 * CMP-3 / LAYER-06: write a plugin declaration and, when the target layer does
 * not already declare the owning marketplace, declare the marketplace in the
 * SAME batched patch. A layer that declares a plugin also declares its
 * marketplace (D-MF-03), so `install --local` under a marketplace only the
 * base layer declares leaves a self-consistent local layer, and a later
 * `marketplace remove` from the base layer keeps the plugin. The source is
 * the state record's `source.raw`, the value `samePlannedSource` matches, or
 * the other layer's declared source when the record holds no string one.
 *
 * When no source is known, the write throws `MarketplaceSourceUndeclarableError`
 * before it writes anything, because the plugin key alone would leave the layer
 * declaring a plugin without its marketplace. The commands refuse that case
 * earlier through `undeclarableMarketplaceRefusal`, before they change state.
 *
 * `pluginPatch` is the caller's own field set: `enable`/`disable` writes an
 * explicit `enabled`, while `install` writes `enabled: false` only when the
 * install actually landed disabled and otherwise writes an empty patch. The
 * requesting plugin's key is the only plugin key this write declares (D-04-02:
 * the desired-state config names only the plugins the user asked for by name).
 *
 * LAYER-07 / D-MF-04: `addedMarketplaces` names the further marketplaces the
 * caller's install added to the scope, such as a dependency's. Each one is
 * declared in the same patch unless either layer already declares it, so the
 * desired state names every marketplace the scope now owns.
 *
 * `targetIsLocal` alone names the target layer: the config path written and
 * the layer a refusal names both come from it, so the two cannot disagree.
 */
export async function writeAdoptingConfigEntries(opts: {
  readonly current: ScopeConfig;
  readonly other: ScopeConfig;
  readonly state: ExtensionState;
  readonly marketplace: string;
  readonly plugin: string;
  readonly locations: ScopedLocations;
  readonly targetIsLocal: boolean;
  readonly pluginPatch: Partial<PluginConfigEntry>;
  readonly addedMarketplaces?: readonly string[];
}): Promise<void> {
  const own = undeclaredMarketplaceSource([opts.current], opts.state, opts.marketplace, opts.other);
  if (own.kind === "unknown") {
    throw new MarketplaceSourceUndeclarableError(
      opts.marketplace,
      opts.targetIsLocal ? "local" : "base",
    );
  }

  const added = (opts.addedMarketplaces ?? []).flatMap((marketplace) => {
    const declaration = undeclaredMarketplaceSource(
      [opts.current, opts.other],
      opts.state,
      marketplace,
    );
    return declaration.kind === "source"
      ? [[marketplace, { source: declaration.source }] as const]
      : [];
  });
  const adopted =
    own.kind === "source" ? [[opts.marketplace, { source: own.source }] as const, ...added] : added;

  const { targetConfigPath } = targetLayerPaths(opts.locations, opts.targetIsLocal);
  await writeBatchedConfigEntries(opts.current, targetConfigPath, opts.locations.scopeRoot, {
    marketplaces: Object.fromEntries(adopted),
    plugins: { [`${opts.plugin}@${opts.marketplace}`]: opts.pluginPatch },
  });
}

/**
 * CR-06: overwrite an existing `enabled: false` entry of a cascade member
 * re-enabled through its state record, the divergence `disable <dep>` creates
 * and D-04-07 already corrects for the root. Members are not named by the
 * user, so no layer rule applies to them: each layer of the scope that holds
 * `enabled: false` for the member gets `enabled: true`, through the atomic
 * config writer. A layer that is absent, invalid, or holds no such entry is
 * not rewritten (WR-02). A member the config does not mention at all stays
 * untouched (D-04-02: the config names only what the user asked for by name).
 *
 * Shared by the enable cascade's EDEP-01 arm and the install cascade's
 * EDEP-03 re-enable arm.
 */
export async function overwriteDisabledMemberEntries(args: {
  readonly locations: ScopedLocations;
  readonly keys: readonly string[];
}): Promise<void> {
  const layers = [args.locations.baseConfigJsonPath, args.locations.localConfigJsonPath];
  for (const configPath of layers) {
    for (const key of args.keys) {
      // eslint-disable-next-line no-await-in-loop -- per-key read-modify-write of one layer config
      await overwriteDisabledEntry(configPath, args.locations.scopeRoot, key);
    }
  }
}

/** CR-06: one layer's `enabled: false` entry for `key` becomes `enabled: true`. */
async function overwriteDisabledEntry(
  configPath: string,
  scopeRoot: string,
  key: string,
): Promise<void> {
  const loaded = await loadConfig(configPath);
  if (loaded.status !== "valid" || ownValue(loaded.config.plugins, key)?.enabled !== false) {
    return;
  }

  const at = key.indexOf("@");
  await writePluginConfigEntry(
    loaded.config,
    configPath,
    scopeRoot,
    key.slice(0, at),
    key.slice(at + 1),
    {
      enabled: true,
    },
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
  if (hasPluginRecord(projectState, opts.marketplace, opts.plugin)) {
    return { scope: "project", locations: projectLocations };
  }

  const userLocations = locationsFor("user", opts.cwd);
  const userState = await loadState(userLocations.extensionRoot);
  if (hasPluginRecord(userState, opts.marketplace, opts.plugin)) {
    return { scope: "user", locations: userLocations };
  }

  return undefined;
}

/**
 * SCOPE-01 / ATTR-02 / D-47-C discriminated `@marketplace` lifecycle target
 * resolution. The NFR-7 discriminated-union precedent applied to the update
 * direct path: the chokepoint distinguishes three outcomes that a plain
 * `undefined` or a raw `MarketplaceNotFoundError` return cannot (M11).
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
 * arm the update entrypoint maps to the standalone `{marketplace not added}` emission.
 */
export type ScopedMarketplaceResolution =
  | { readonly kind: "resolved"; readonly scope: Scope; readonly locations: ScopedLocations }
  | { readonly kind: "other-scope"; readonly presentIn: Scope; readonly requestedScope: Scope }
  | { readonly kind: "marketplace-absent"; readonly requestedScope?: Scope };

/**
 * CMP-5: unqualified `@marketplace` update targets project installs before user
 * installs. Returns a discriminated result instead of throwing
 * `MarketplaceNotFoundError` (M11) so the update direct path can emit the
 * standalone `{marketplace not added}` variant for the marketplace-existence precondition.
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
    // A resolved container's plugin set may be empty -- the caller still reads
    // it as the update target.
    return resolveExplicitScope(
      opts.cwd,
      opts.marketplace,
      opts.explicitScope,
      (otherState) => ownValue(otherState.marketplaces, opts.marketplace) !== undefined,
    );
  }

  const { projectLocations, userLocations, projectState, userState } = await loadBothScopes(
    opts.cwd,
  );
  const projectRecord = ownValue(projectState.marketplaces, opts.marketplace);
  const userRecord = ownValue(userState.marketplaces, opts.marketplace);

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
 * D-01-07 / D-01-11: is this manifest candidate THERE? Only a path that is not
 * there may advance the walk to the next candidate, so a stat this process was
 * not allowed to make (EACCES and friends) counts as present -- it is not
 * evidence of absence. Uses the absence policy beside MANIFEST_CANDIDATES:
 * ENOENT, ENOTDIR and non-files advance the walk; other stat errors stop it.
 * Unlike the resolver, this reader falls back to the entry version on failure.
 * Never throws.
 */
async function manifestCandidateExists(manifestPath: string): Promise<boolean> {
  try {
    return (await stat(manifestPath)).isFile();
  } catch (err) {
    const absent = isErrnoException(err) && (err.code === "ENOENT" || err.code === "ENOTDIR");
    return !absent;
  }
}

/**
 * The first tier of {@link resolveDeclaredPluginVersion}: the `version` the plugin's own
 * manifest declares, or `undefined` when it declares none usable.
 *
 * MANF-01: the walk is the shared `MANIFEST_CANDIDATES` ordering, so this
 * reader and the resolver read the same file. D-01-07: a candidate that
 * EXISTS ends the walk -- if it cannot be read, cannot be parsed, or carries
 * no usable `version`, the answer falls to the marketplace entry, never to a sibling
 * candidate. Never throws (D-23-02 / D-23-03).
 *
 * D-PL2-24 / D-PL2-17: each candidate is located inside `boundary`. A link
 * whose target leaves it, or that cannot be resolved, is a present but
 * unusable manifest and answers `undefined`; a dangling link is no manifest.
 * On the install, update and reinstall paths the resolver has refused such a
 * plugin before this read.
 */
export async function readDeclaredPluginVersion(
  boundary: ManifestBoundary,
): Promise<string | undefined> {
  for (const candidate of MANIFEST_CANDIDATES) {
    // eslint-disable-next-line no-await-in-loop -- D-01-07: the first existing manifest candidate wins
    const read = await readVersionCandidate(boundary, path.join(boundary.pluginRoot, candidate));
    if (read !== undefined) {
      return read.version;
    }
  }

  return undefined;
}

/** One candidate's declared version, or `undefined` when the candidate is absent. */
async function readVersionCandidate(
  boundary: ManifestBoundary,
  candidatePath: string,
): Promise<{ readonly version: string | undefined } | undefined> {
  const location = await locateManifestCandidate(boundary, candidatePath);
  switch (location.kind) {
    case "absent":
      return undefined;
    case "escapes":
    case "unresolvable":
      hookDebugLog(
        `resolvePluginVersion: plugin manifest not confirmed inside the ${boundary.label}`,
      );
      return { version: undefined };
    case "open":
      return readVersionAt(location.path);
  }
}

async function readVersionAt(
  manifestPath: string,
): Promise<{ readonly version: string | undefined } | undefined> {
  if (!(await manifestCandidateExists(manifestPath))) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (err) {
    // Present and unusable: the entry, the commit, or the hash covers it.
    hookDebugLog(`resolvePluginVersion: plugin.json read/parse failed: ${errorMessage(err)}`);
    return { version: undefined };
  }

  return { version: usableDeclaredVersion(parsed) };
}

/** The `version` a parsed manifest declares when it is a non-empty string. */
function usableDeclaredVersion(parsed: unknown): string | undefined {
  if (typeof parsed !== "object" || parsed === null || !("version" in parsed)) {
    return undefined;
  }

  return typeof parsed.version === "string" && parsed.version.length > 0
    ? parsed.version
    : undefined;
}

/**
 * VER-01 / D-23-01: the version a plugin declares, or undefined when it
 * declares none: the plugin's own manifest `version`, read at the first
 * `MANIFEST_CANDIDATES` location present under `pluginRoot` (MANF-01;
 * "If also set in the marketplace entry, `plugin.json` wins."), then the
 * marketplace `entry.version`. Each is accepted iff it is a non-empty string
 * (D-23-03 -- no SemVer enforcement). A read or parse failure falls through to
 * the entry and never throws. `boundary` bounds the manifest read (D-PL2-24).
 */
export async function resolveDeclaredPluginVersion(
  entry: PluginEntry,
  boundary: ManifestBoundary,
): Promise<string | undefined> {
  const declaredVersion = await readDeclaredPluginVersion(boundary);
  if (declaredVersion !== undefined) {
    return declaredVersion;
  }

  return typeof entry.version === "string" && entry.version.length > 0 ? entry.version : undefined;
}

/**
 * PI-7 / PUP-3 / SNM-34 / VER-01 version precedence, highest first:
 *   1. The declared version (`resolveDeclaredPluginVersion`: plugin.json,
 *      then the marketplace entry), with the commit pin a plugin of the
 *      `anthropic-plugin-directory` marketplace carries (GV-01).
 *   2. The commit of `resolvedSha`, the commit a git source installs, as
 *      `shaVersion` spells it (D-16-08, GV-01). Claude Code orders a git
 *      plugin's version the same way: manifest, catalog entry, then the
 *      commit.
 *   3. The PI-7 `computeHashVersion` content hash, as a last resort.
 *
 * The plugin.json read is re-done here independently (D-23-02): the NFR-7
 * discriminated `ResolvedPluginInstallable` union is NOT widened with a
 * `manifest` field. D-PL2-17: it is bounded as the resolver bounded it, by
 * `sourceManifestBoundary` with no pin.
 */
export async function resolvePluginVersion(
  entry: PluginEntry,
  installable: MaterializablePlugin,
  marketplace: Pick<ResolveContext, "marketplaceName" | "marketplaceRoot">,
  resolvedSha?: string,
): Promise<string> {
  const source = parsePluginSource(entry.source);
  const declared = await resolveDeclaredPluginVersion(
    entry,
    sourceManifestBoundary(
      entry.source,
      installable.pluginRoot,
      marketplace.marketplaceRoot,
      undefined,
    ),
  );
  if (declared !== undefined) {
    return declaredVersionWithPin(declared, source, marketplace.marketplaceName);
  }

  if (resolvedSha !== undefined) {
    return shaVersion(resolvedSha, source);
  }

  return computeHashVersion(installable.pluginRoot);
}

/**
 * GV-01: the version Claude Code records for a plugin installed at the release
 * tag a dependency's version range selected. A declared version (with GV-01's
 * directory pin) gets the tag commit's first 12 characters appended; with none
 * declared, the version is the tag commit's, as `tagShaVersion` spells it.
 * A tag's tree is a copy, bounded by its plugin directory (D-PL2-17).
 */
export async function resolveTagPinnedPluginVersion(
  entry: PluginEntry,
  installable: MaterializablePlugin,
  marketplaceName: string,
  tagCommit: string,
): Promise<string> {
  const source = parsePluginSource(entry.source);
  const declared = await resolveDeclaredPluginVersion(
    entry,
    copyManifestBoundary(installable.pluginRoot),
  );
  return declared === undefined
    ? tagShaVersion(tagCommit, source)
    : withTagCommit(declaredVersionWithPin(declared, source, marketplaceName), tagCommit);
}

/**
 * D-16-09: whether an update candidate is the revision the record holds. A
 * source that moved to a new commit is a new revision even when its declared
 * version did not change, because the stored sha is the revision; a switch
 * between a git and a `path` source adds or drops the sha, so it is a new
 * revision too. Only when neither side has a sha does the version alone
 * decide.
 *
 * `tags.resolvedVersion` is the semver of the release tag a range selected.
 * `tags.searched` says that the candidate comes from a verb that lets a
 * dependent's range pick a release tag (D-23), so a candidate with no
 * `resolvedVersion` is one no tag applies to.
 *
 * This is the disabled branch's rule (D-99-05a). The enabled branch also
 * compares the plugin root, through `isRecordedCandidate`.
 */
export function isSameRevision(
  record: PluginInstallRecord,
  toVersion: string,
  resolvedSha: string | undefined,
  tags: { readonly resolvedVersion?: string | undefined; readonly searched?: boolean } = {},
): boolean {
  if (resolvedSha !== record.resolvedSha) {
    return false;
  }

  // GV-01 / GV-02: at a release tag a range selected, the revision is the tag:
  // Claude Code's check reads the record's tag version and commit. A record
  // written before GV-01 holds the tag's semver as its version.
  if (tags.resolvedVersion !== undefined) {
    return rangeVersionOf(record) === tags.resolvedVersion;
  }

  // GV-01: with no tag, Claude Code's update compares the recorded string, so
  // a record at a tag's commit moves to the version without that commit. A
  // check that never read the tags (D-23) cannot tell, and reads it as the
  // same version.
  return isSameVersion(
    record.version,
    toVersion,
    tags.searched === true ? undefined : record.resolvedSha,
  );
}

/**
 * D-18-11: whether an enabled record already holds the candidate. A record made
 * before per-commit copies names the mutable mirror as its root, so the copy at
 * the same commit is a new revision and the swap re-anchors the record onto it.
 */
export function isRecordedCandidate(
  record: PluginInstallRecord,
  candidate: {
    readonly toVersion: string;
    readonly resolvedSha: string | undefined;
    readonly pluginRoot: string;
    readonly resolvedVersion?: string | undefined;
    readonly searchedReleaseTags?: boolean;
  },
): boolean {
  return (
    isSameRevision(record, candidate.toVersion, candidate.resolvedSha, {
      resolvedVersion: candidate.resolvedVersion,
      searched: candidate.searchedReleaseTags === true,
    }) && candidate.pluginRoot === record.resolvedSource
  );
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * One entry of an owner map. `disabled` carries the owning record's
 * `isRecordedButDisabled` verdict into the message so a refused install can name
 * WHY the slot looks empty on disk -- see `collectOwners`.
 */
interface NameOwner {
  readonly plugin: string;
  readonly disabled: boolean;
}

/**
 * ENBL-18 / ENBL-19: every record in the scope reserves its generated names,
 * disabled ones included. A disabled record retains its inventory, so its names
 * stay reserved even though it materialized nothing on disk. That is the
 * deliberate reading: the reservation is what lets a later `enable` re-take its
 * own names, and it is what keeps an `uninstall` of the disabled plugin from
 * unstaging an artifact a second plugin would otherwise have installed under the
 * same name in the meantime.
 *
 * The cost is a refusal the disk cannot explain -- the conflicting name occupies
 * no file. `disabled` is threaded so the message can, and `uninstall <owner>`
 * remains the remedy.
 */
function collectOwners(state: ExtensionState): {
  skillOwners: Map<string, NameOwner>;
  commandOwners: Map<string, NameOwner>;
  agentOwners: Map<string, NameOwner>;
} {
  const skillOwners = new Map<string, NameOwner>();
  const commandOwners = new Map<string, NameOwner>();
  const agentOwners = new Map<string, NameOwner>();

  for (const mp of Object.values(state.marketplaces)) {
    for (const [pluginName, plugin] of Object.entries(mp.plugins)) {
      const owner: NameOwner = {
        plugin: pluginName,
        disabled: isRecordedButDisabled(plugin),
      };
      for (const n of plugin.resources.skills) {
        skillOwners.set(n, owner);
      }

      for (const n of plugin.resources.prompts) {
        commandOwners.set(n, owner);
      }

      for (const n of plugin.resources.agents) {
        agentOwners.set(n, owner);
      }
    }
  }

  return { skillOwners, commandOwners, agentOwners };
}

function collectConflicts(
  kind: string,
  names: readonly string[],
  owners: ReadonlyMap<string, NameOwner>,
): string[] {
  const conflicts: string[] = [];
  for (const n of [...names].sort(compareNames)) {
    const owner = owners.get(n);
    if (owner !== undefined) {
      // The `disabled` qualifier is the only variable part: a disabled owner
      // holds the name while occupying no disk slot, so the bare wording sent
      // the user looking for a file that is not there.
      const ownerKind = owner.disabled ? "disabled plugin" : "plugin";
      conflicts.push(`${kind} "${n}" already owned by ${ownerKind} "${owner.plugin}"`);
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
 * ENBL-18: DISABLED records own their names too -- see `collectOwners` for why
 * the reservation is kept rather than filtered. The caller's own record is
 * excluded via `removePluginRecord` (ENBL-19), so this only ever refuses an
 * install against a DIFFERENT plugin's reservation, and the conflict line names
 * the owner as disabled when it is.
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
 * PI-6 cross-plugin guard helper. Returns a shallow-cloned state with the
 * (marketplace, plugin) record removed -- so {@link assertNoCrossPluginConflicts}
 * counts this plugin's OWN current resources as "not yet owned" and only
 * catches conflicts against OTHER plugins.
 *
 * Shallow-clone discipline: deep-clone only the bytes the guard reads
 * (marketplaces -> per-mp -> plugins map). Every other branch reference is
 * shared, and the caller's state object is never mutated. This keeps the helper
 * cheap on hot paths.
 *
 * Single implementation: the install, update and reinstall ledgers all consume
 * this export. Two near-identical private copies once lived in `update.ts` and
 * `reinstall.ts`; `sonarjs/no-identical-functions` is an error in this repo, so
 * a third copy is not an option and the shared tier is the right home anyway.
 */
export function removePluginRecord(
  state: ExtensionState,
  marketplace: string,
  plugin: string,
): ExtensionState {
  const cloned: ExtensionState = {
    schemaVersion: state.schemaVersion,
    marketplaces: { ...state.marketplaces },
  };
  const mp = ownValue(cloned.marketplaces, marketplace);
  if (mp === undefined) {
    return cloned;
  }

  const newPlugins = { ...mp.plugins };
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- newPlugins is a Record<string,...> local to this helper.
  delete newPlugins[plugin];
  setOwn(cloned.marketplaces, marketplace, { ...mp, plugins: newPlugins });
  return cloned;
}

type RecordResources = PluginInstallRecord["resources"];

/**
 * D-PL5-15: the record field each axis of a cascade's dropped names lives in.
 * The `satisfies` clause is the exhaustiveness gate: an axis added to
 * `UnstageOutcome["dropped"]` fails the typecheck here until it is mapped.
 * TR-03 renames only `commands`, to `prompts`. D-63-04 and WLIF-03: hooks and
 * workflows are subtracted like the rest, so a partial cascade leaves no row
 * naming a hook or a workflow envelope it already deleted.
 */
const DROPPED_AXIS_FIELDS = {
  skills: "skills",
  commands: "prompts",
  agents: "agents",
  hooks: "hooks",
  mcpServers: "mcpServers",
  workflows: "workflows",
} as const satisfies Record<keyof UnstageOutcome["dropped"], keyof RecordResources>;

/**
 * I3 / TR-03: subtract a non-AG-5 partial-cascade's dropped artifacts from
 * the state record in place so the persisted row reflects only artifacts
 * still on disk (NFR-3 fail-clean, no ghost record). Shared by every
 * partial-cascade arm: uninstall, disable, the install cascades, and
 * `marketplace remove`.
 */
export function applyPartialCascadeFold(
  installed: { resources: PluginInstallRecord["resources"] },
  dropped: UnstageOutcome["dropped"],
): void {
  // Object.keys widens to string[]; the table's keys are exactly the dropped
  // axes, which the `satisfies` clause above holds.
  const axes = Object.keys(DROPPED_AXIS_FIELDS) as Array<keyof typeof DROPPED_AXIS_FIELDS>;
  for (const axis of axes) {
    const field = DROPPED_AXIS_FIELDS[axis];
    installed.resources[field] = installed.resources[field].filter(
      (name) => !dropped[axis].includes(name),
    );
  }
}

/**
 * The marketplace is not added in the target scope -- either absent entirely,
 * or recorded only in the sibling scope.
 *
 * RECON-03 / D-47-A: orchestrated callers get the typed failure carrying the
 * structural `marketplace not added` sentinel; standalone callers get the canonical
 * `MarketplaceNotAddedMessage` row emitted first, and then the SAME typed
 * failure, which they discard -- the row is what the operator sees on that path.
 * Returning it unconditionally is what lets both callers' bodies declare a
 * narrow `Promise<TOutcome>` return the compiler can check (WR-01).
 *
 * `uninstall.ts` and `enable-disable.ts` both reach this state. The routing
 * policy is one decision, so it lives here once; the return shape is the
 * `failed` arm both `UninstallPluginOutcome` and `EnableDisablePluginOutcome`
 * already declare, so neither union is widened by sharing it.
 *
 * CMP-4 / SCOPE-01: the message carries NO `presentInOtherScope` flag. Both
 * callers consult `missIsNotInstalled` FIRST and reach this emitter only when it
 * answered `undefined` -- which already establishes that the marketplace is not
 * recorded in the sibling scope either. A `crossScopeFlag` probe here would
 * re-read the sibling `state.json` only to re-derive that same `false`.
 */
export function emitMarketplaceNotAdded(args: {
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly marketplace: string;
  readonly requestedScope: Scope | undefined;
  readonly orchestrated: boolean;
}): {
  readonly status: "failed";
  readonly reason: "marketplace not added";
  readonly error: Error;
  readonly cause: string;
} {
  const { ctx, run, marketplace, requestedScope, orchestrated } = args;
  const scopeList: readonly Scope[] =
    requestedScope === undefined ? ["project", "user"] : [requestedScope];
  const err = new MarketplaceNotFoundError(marketplace, scopeList);
  const outcome = {
    status: "failed",
    reason: "marketplace not added",
    error: err,
    cause: errorMessage(err),
  } as const;

  if (!orchestrated) {
    notify(ctx, run, {
      kind: "marketplace-not-added",
      name: marketplace,
      ...(requestedScope !== undefined && { scope: requestedScope }),
    });
  }

  return outcome;
}

/**
 * ATTR-02 / ATTR-03 / D-47-A / SCOPE-01: emit the ONE standalone notification a
 * `MarketplaceNotAddedSignal` is owed, for the update and reinstall target
 * enumerators that raise it.
 *
 * Two arms, and which one fires is a property of the SIGNAL, not of the verb:
 *   - `notInstalledAt` + `plugin` set: the container sits one scope over, so
 *     nothing is installed at the scope the operator named. The PLUGIN is the
 *     subject, on the same `(failed)` row an in-scope marketplace with no
 *     record yields, as uninstall's cross-scope row is (UPR-04) -- but the
 *     brace names the container's actual scope beside `not installed`
 *     (SCOPE-01, via `absentTargetReasons`), because the two misses take
 *     different remedies and a shared byte form states neither.
 *   - otherwise: the marketplace row itself, `{marketplace not added}`
 *     (structural, no new REASONS member per D-47-B). `requestedScope` (when
 *     present) renders the `[scope]` bracket; the bare both-scopes-miss form
 *     carries no bracket and, per `crossScopeFlag`, is owed no sibling probe.
 *
 * The caller supplies its command label and failed-row policy. Requiring
 * `CommandContext<"failed">` keeps missing policies a compile error while the
 * row literal remains checked against the shared producer contract.
 *
 * SEV-04: the row is a failure stamped `error`: its reasons always lead with
 * `not installed` -- an absent target, i.e. the requested operation was NOT
 * carried out.
 */
export async function emitMarketplaceNotAddedSignal(args: {
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly cwd: string;
  readonly context: CommandContext<"failed">;
  readonly cardinality: "single" | "plural";
  readonly err: MarketplaceNotAddedSignal;
}): Promise<void> {
  const { ctx, run, cwd, context, cardinality, err } = args;

  if (err.notInstalledAt !== undefined && err.plugin !== undefined) {
    notifyWithContext(
      ctx,
      run,
      context,
      [
        {
          name: err.marketplace,
          scope: err.notInstalledAt,
          plugins: [
            {
              status: "failed",
              name: err.plugin,
              reasons: absentTargetReasons(err.notInstalledAt),
              severity: "error",
              needsReload: false,
            },
          ],
        },
      ],
      undefined,
      cardinality,
    );
    return;
  }

  notify(ctx, run, {
    kind: "marketplace-not-added",
    name: err.marketplace,
    ...(err.requestedScope !== undefined && { scope: err.requestedScope }),
    ...(await crossScopeFlag({
      cwd,
      marketplace: err.marketplace,
      scope: err.requestedScope,
    })),
  });
}

/**
 * D-141-03 / D-141-05: split one staging pass's four bridge warning arrays
 * into the DISCOVERY half and the HYGIENE half.
 *
 * Every warning the skills and commands bridges emit describes the SOURCE the
 * plugin author shipped against the artifact set that actually installed --
 * a first-wins skip, an unreadable subdirectory or file, a path that produces
 * no valid name, a skipped subdirectory, or (commands only) one file reached
 * by two declared entries and therefore installed under two names. The last
 * of those reports a surplus rather than a shortfall, so the shared property
 * is not "a skip": it is that the user's own resource count gives no baseline
 * to notice ANY of them. That is why the whole half reaches standalone mode.
 *
 * The agents bridge aggregates index corruptions, per-agent conversion notes
 * and D-07 skips onto ONE array that cannot be split at the call site, so the
 * whole array joins the hygiene channel; mcp rides beside it.
 *
 * Kept here, taking plain string arrays rather than bridge result types, so
 * update and reinstall classify through one function instead of two copies
 * that drift (and so `sonarjs/no-identical-functions` and `fallow dupes` have
 * nothing to find).
 *
 * `install-outcome.ts` does NOT call this. Its ledger phases push each bridge's
 * warnings onto the right array inline, one push per phase, because each
 * phase already holds exactly one bridge's result. It shares the RENDERER
 * below, not this classifier -- so two of the three verbs share the
 * classification and all three share the rendering. A change to the split
 * therefore has to be applied at install's four phase sites by hand.
 */
export function splitStagingWarnings(warnings: {
  readonly skills: readonly string[];
  readonly commands: readonly string[];
  readonly agents: readonly string[];
  readonly mcp: readonly string[];
}): { readonly discovery: readonly string[]; readonly bridge: readonly string[] } {
  return {
    discovery: Object.freeze([...warnings.skills, ...warnings.commands]),
    bridge: Object.freeze([...warnings.agents, ...warnings.mcp]),
  };
}

/**
 * D-141-03 / D-141-05: render the discovery half to a standalone user, after
 * the verb's own row.
 *
 * The seam is `notifyDiagnostic`, the same sanctioned second-notify channel
 * the reconcile pass uses; the verb's row itself stays exactly one
 * `MarketplaceNotificationMessage` (IL-2).
 *
 * NFR-9: a discovery warning embeds the absolute component directory it
 * walked, so it goes through `redactAbsolutePaths` before it reaches the
 * user, exactly as the reconcile composer does.
 *
 * WGATE-01: the header counts the lines and states nothing about what became
 * of the components they name. It cannot: two of the families routed into this
 * array report a component that WAS materialized -- a workflow script the host
 * engine will refuse to load, and one that installs under a name it does not
 * declare -- so a header claiming a disposal would contradict the lines
 * directly beneath it. "Note" is the word the read-only `info` surface already
 * prints for the same facts, so the two surfaces name them the same way.
 */
export function surfaceDiscoveryWarnings(
  ctx: NotificationContext,
  run: NotificationRun,
  args: {
    readonly plugin: string;
    readonly verb: "installed" | "updated" | "reinstalled";
    readonly warnings: readonly string[];
  },
): void {
  if (args.warnings.length === 0) {
    return;
  }

  const lines = args.warnings.map((w) => redactAbsolutePaths(w));
  const header =
    lines.length === 1
      ? `Plugin "${args.plugin}" ${args.verb}; 1 declared component has a note.`
      : `Plugin "${args.plugin}" ${args.verb}; ${lines.length.toString()} declared components have notes.`;
  notifyDiagnostic(ctx, run, header, lines);
}

/**
 * WLIF-06: does a just-finished materialization leave at least one workflow
 * command registered with no envelope behind it?
 *
 * The host exposes no unregister call, so a workflow whose envelope this run
 * did NOT re-place keeps its command live and runnable for the rest of the
 * session. The gate is therefore set difference -- the names the record held
 * before, minus the names this run placed -- which makes a RENAME retire a
 * command exactly as a deletion does: the old generated name is in the first
 * set and not in the second.
 *
 * A name present in BOTH sets retires nothing; that is the ordinary re-place.
 * An empty difference stamps nothing, which is what keeps an unaffected row
 * byte-identical (NREG-01).
 *
 * One boolean, not the names: the row states that a command lingers and names
 * the remedy; which command it was is not something the operator can act on
 * differently, and the standing rule on the staged-name arrays is that the
 * names never reach a rendered row.
 *
 * The three verbs that RE-MATERIALIZE (enable / reinstall / update) call this.
 * The two that only REMOVE (uninstall / disable) read what their cascade
 * reported dropping instead -- for them the placed set is empty by
 * construction, and the cascade's report is the truthful operand because it
 * names what actually came off disk rather than what the record claimed.
 */
export function retiresWorkflowCommand(
  previousNames: readonly string[],
  placedNames: readonly string[],
): boolean {
  const placed = new Set(placedNames);
  return previousNames.some((name) => !placed.has(name));
}

/**
 * WLIF-01: sweep abandoned workflow staging trees on behalf of `verb` and
 * debug-log what the sweep could not remove. Never throws and never reaches
 * the user (D-19-01): hygienic cleanup never becomes the primary user-facing
 * path.
 */
export async function sweepWorkflowsStaging(
  locations: Pick<ScopedLocations, "workflowsStagingDir" | "workflowsHomeDir">,
  verb: string,
  pluginRef: string,
): Promise<void> {
  try {
    const leaks = await garbageCollectWorkflowsStaging(locations);
    if (leaks.length > 0) {
      hookDebugLog(
        `${verb}: workflows staging GC left ${leaks.length.toString()} tree(s) for ${pluginRef}: ${leaks.join("; ")}`,
      );
    }
  } catch (err) {
    hookDebugLog(`${verb}: workflows staging GC failed for ${pluginRef}: ${errorMessage(err)}`);
  }
}

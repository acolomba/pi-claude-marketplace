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
import {
  writeBatchedConfigEntries,
  writePluginConfigEntry,
} from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { isRecordedButDisabled, loadState } from "../../persistence/state-io.ts";
import {
  CrossPluginConflictError,
  errorMessage,
  MarketplaceNotFoundError,
} from "../../shared/errors.ts";
import { notify, notifyDiagnostic, redactAbsolutePaths } from "../../shared/notify.ts";

import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { MaterializablePlugin } from "../../domain/resolver.ts";
import type {
  ConfigLoadResult,
  PluginConfigEntry,
  ScopeConfig,
} from "../../persistence/config-io.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type { DegradeKind } from "../../shared/notify-reasons.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * The degradation signals ONE `runInstallLedger` run produces, carried together
 * on every success outcome of every verb that drives that ledger -- `install`
 * and the enable branch alike. Both verbs run the SAME ledger over the SAME
 * bridges, so a signal one row names and the other omits is a row that
 * contradicts its own ledger.
 *
 * The shape lives here, in the module `install.ts` and `enable-disable.ts` BOTH
 * already import, rather than in either of them: `enable-disable.ts` imports
 * `runInstallLedger` from `install.ts`, so declaring it there and importing it
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
   * `info` to `warning` -- the same raise `install.ts::composeInstalledRow`
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
   * `stagedAgents`, driving the `{requires pi-mcp}` marker and the same raise.
   */
  readonly stagedMcpServers?: boolean;
}

/**
 * SEV-01 / D-98-02: derive the closed-set `Dependency[]` an enable row declares
 * from the ledger's staged-count signals -- the same derivation `install.ts`
 * runs off `installCtx.stagedAgentNames` / `stagedMcpServerNames` for the same
 * ledger run. Shared by the standalone enable row and the reconcile enable
 * projection so the two row composers cannot drift.
 *
 * WR-01: both picked members are OPTIONAL, so every shape that inherits
 * `LedgerDegradationSignals` matched this parameter structurally -- including
 * `PluginUpdateUpdatedOutcome`, which spells the same facts as `declaresAgents`
 * / `declaresMcp` and would therefore have compiled here and returned `[]` for
 * every update. The `partition?: never` refusal excludes the outcome shapes
 * discriminated by that field (the update / reinstall partitions) while leaving
 * the two `kind`-discriminated enable outcomes this function serves untouched.
 */
export function enableRowDependencies(
  signals: Pick<LedgerDegradationSignals, "stagedAgents" | "stagedMcpServers"> & {
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
function synthesizeUndeclaredMarketplaceSource(
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
 * WB-01 / UAT-05: pair the targeted physical config file with its sibling (the
 * scope's OTHER file) for a given locality. Target-path selection happens ONCE
 * at the orchestrator boundary so the write path never falls back to the
 * base file on ENOENT; the sibling path exists ONLY for the UAT-05
 * merged-view membership test (read fresh inside the lock, never written).
 *
 * NOT exported: `selectDeclaringConfigWriteTarget` is the orchestrator-facing
 * selector, and this one answers a strictly narrower question -- which files a
 * locality names, with no say in what that locality should be. A caller who
 * reached for it would be aiming the write with the flag alone, which is the
 * defect D-103-13 removed from three call sites. The compiler keeps the module's
 * public surface down to the one selector that answers the whole question.
 */
function selectConfigWriteTarget(
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
 * D-103-13 write-target selection outcome. Discriminated rather than a bare
 * record because ONE of the two answers is "there is no answer": when the file
 * that DETERMINES the destination cannot be read, no destination may be
 * guessed, and a caller must be unable to ignore that (NFR-7 precedent).
 *
 * The `selected` arm carries both physical files' parses, so the caller reads
 * each file ONCE per operation. `sibling` is `undefined` when the sibling could
 * not be read -- and `undefined` is NOT "declares nothing": a consumer that
 * would conclude ABSENCE from it must refuse to act instead. That distinction
 * is the whole point of the field's nullability; collapsing it back into an
 * empty config is what let an unreadable file be read as an empty one.
 */
export type DeclaringConfigWriteTarget =
  | { readonly kind: "unreadable"; readonly filePath: string }
  | {
      readonly kind: "selected";
      readonly targetConfigPath: string;
      readonly targetIsLocal: boolean;
      /** The TARGET file's parse; an absent file yields the empty shape. */
      readonly current: ScopeConfig;
      /** The OTHER file's parse, or `undefined` when it could not be read. */
      readonly sibling: ScopeConfig | undefined;
    };

/** A readable file's config (`absent` counts as readable), else `undefined`. */
function readableConfig(result: ConfigLoadResult): ScopeConfig | undefined {
  if (result.status === "invalid") {
    return undefined;
  }

  return result.status === "valid" ? result.config : { schemaVersion: 1 };
}

/**
 * D-103-13: select the physical config file a verb that AUTHORS an enablement
 * declaration must write to, and hand back both files' parses.
 *
 * The rule: an explicit `--local` targets the local file; absent the flag,
 * target the file the plugin's declaration already lives in; absent both a flag
 * and a declaration, target the base file.
 *
 * `--local` says which file to WRITE. It does not say which file a declaration
 * already lives IN, and those are different questions -- a caller who typed no
 * flag has answered neither, and answering the second one with the first is
 * what makes the write a no-op. CFG-02: a `claude-plugins.local.json` entry
 * replaces the same-keyed base entry WHOLESALE, so a write into the base file
 * under a local declaration changes no merged value. The verb reports success,
 * the merged view the reconcile planner reads is unmoved, and the next pass
 * plans the opposite of the command the user just ran.
 *
 * The local file is inspected for KEY MEMBERSHIP only -- the key's PRESENCE
 * decides the file, never its `enabled` value. A local entry shadows the base
 * entry's `enabled` too, so a bare `{}` is still the effective declaration;
 * reading the value here would re-open a precedence question the caller has
 * already settled.
 *
 * CFG-03: an UNREADABLE local file returns the `unreadable` arm instead of a
 * target. `loadConfig` never throws, so an EACCES, a truncated mid-save file
 * and a schema violation all arrive as `invalid` -- and none of them answer the
 * membership question. Reading `invalid` as "not declared locally" would aim
 * the write at the base file on exactly the configuration where the local file
 * shadows it, which is the no-op write this selector exists to prevent. This
 * does NOT mirror the D-18 merge fallback: that fallback coerces an invalid
 * file's CONTRIBUTION while preserving the invalid SIGNAL for the caller
 * (`config-merge.ts::loadMergedScopeConfig`), and it computes a read rather
 * than choosing a write target. `absent` is a real answer ("not declared
 * there") and still yields the base target; this never throws and never
 * creates a file.
 *
 * This is the WRITE-side counterpart of the READ-side rule
 * `install.ts::readDeclaredEnabled` states -- the local file wins by IDENTITY,
 * not by precedence. `targetIsLocal` reports the selection's locality so
 * callers reading across both files do not re-derive it by comparing paths.
 *
 * WB-01 / UAT-05: both reads are decision-input only and neither is serialized
 * back. Callers hold the scope's state lock, which excludes other extension
 * processes; it does NOT exclude a user editing these files, which are
 * hand-authored by design, so a concurrent edit between this read and the write
 * is possible. The write itself is atomic, so the worst case is a target chosen
 * from a config one edit old, not a torn file.
 */
export async function selectDeclaringConfigWriteTarget(opts: {
  readonly locations: ScopedLocations;
  readonly local: boolean | undefined;
  readonly key: string;
}): Promise<DeclaringConfigWriteTarget> {
  const [baseCfg, localCfg] = await Promise.all([
    loadConfig(opts.locations.configJsonPath),
    loadConfig(opts.locations.configLocalJsonPath),
  ]);

  if (localFileLeavesTargetUnknowable(opts.local, localCfg)) {
    return { kind: "unreadable", filePath: localCfg.filePath };
  }

  const targetIsLocal = resolveTargetIsLocal(opts.local, localCfg, opts.key);
  // Delegate the file pairing to the flag-only selector so `--local`'s pairing
  // -- and its ENOENT fresh-create contract -- keeps exactly one definition,
  // then key the two parses off those PATHS rather than off `targetIsLocal` a
  // second time, so a parse can never be paired with the other file's path.
  const { targetConfigPath, siblingConfigPath } = selectConfigWriteTarget(
    opts.locations,
    targetIsLocal,
  );
  const parseFor = (p: string): ConfigLoadResult =>
    p === opts.locations.configLocalJsonPath ? localCfg : baseCfg;
  const targetCfg = parseFor(targetConfigPath);
  if (targetCfg.status === "invalid") {
    return { kind: "unreadable", filePath: targetCfg.filePath };
  }

  return {
    kind: "selected",
    targetConfigPath,
    targetIsLocal,
    current: configOrEmpty(targetCfg),
    sibling: readableConfig(parseFor(siblingConfigPath)),
  };
}

/**
 * A typed flag names the destination outright, so no file has to be read to
 * find it and an unreadable local file cannot make the answer unknowable.
 * Absent the flag the local file IS the determinant, and an unreadable one
 * leaves the destination unknown -- abort rather than guess the shadowed file.
 */
function localFileLeavesTargetUnknowable(
  local: boolean | undefined,
  localCfg: ConfigLoadResult,
): localCfg is InvalidConfigLoad {
  return local !== true && localCfg.status === "invalid";
}

/**
 * CFG-02 / D-01: the local file answers the key when the caller typed
 * `--local`, or when it declares the key itself -- a local entry REPLACES the
 * same-keyed base entry wholesale, so its mere presence decides the target.
 */
function resolveTargetIsLocal(
  local: boolean | undefined,
  localCfg: ConfigLoadResult,
  key: string,
): boolean {
  if (local === true) {
    return true;
  }

  return localCfg.status === "valid" && localCfg.config.plugins?.[key] !== undefined;
}

type InvalidConfigLoad = Extract<ConfigLoadResult, { status: "invalid" }>;

function configOrEmpty(result: ConfigLoadResult): ScopeConfig {
  return result.status === "valid" ? result.config : { schemaVersion: 1 };
}

/**
 * UAT-05 seam over `synthesizeUndeclaredMarketplaceSource`: runs the
 * merged-view membership gate against BOTH physical files of the scope. Both
 * parses come from `selectDeclaringConfigWriteTarget` (read fresh inside the
 * caller's lock -- WB-01 discipline); neither is serialized back.
 *
 * An UNREADABLE sibling (`sibling === undefined`) SKIPS the adoption write. It
 * is not read as "declares nothing": the file may well declare the marketplace,
 * and synthesizing a bare `{source}` entry into the other file would shadow
 * that declaration wholesale under CFG-02 -- silently dropping the user's
 * `autoupdate: false` once the file is repaired, a network-touching setting
 * flipped with no command and no prompt. Refusing to adopt is the conservative
 * half: the plugin entry itself is still targeted correctly, and a marketplace
 * that really is undeclared stays visible as the reconcile planner's
 * `<marketplace not declared>` row rather than being papered over from a file
 * nobody could read.
 */
function synthesizeAdoptedMarketplaceSource(opts: {
  readonly current: ScopeConfig;
  readonly sibling: ScopeConfig | undefined;
  readonly state: ExtensionState;
  readonly marketplace: string;
}): string | undefined {
  if (opts.sibling === undefined) {
    return undefined;
  }

  return synthesizeUndeclaredMarketplaceSource(
    [opts.current, opts.sibling],
    opts.state,
    opts.marketplace,
  );
}

/**
 * CMP-3 / UAT-05: write a plugin declaration and, when the scope's MERGED
 * config view does not already declare the owning marketplace, adopt the
 * marketplace in the SAME batched patch. A bare plugin key would otherwise be a
 * dangling declaration the planner converts into a marketplace removal plus a
 * perpetual failed row.
 *
 * The membership gate considers BOTH physical files (base union local), so a
 * `--local` write never re-declares a base-declared marketplace -- the bare
 * `{source}` entry would shadow the base entry wholesale (CFG-02) and silently
 * flip merged `autoupdate`. An UNREADABLE sibling skips the adoption write
 * rather than counting as a file that declares nothing.
 *
 * S4 (PR #51): `adoptedSource === undefined` collapses two arms -- benign
 * (already declared, no synthesis needed) and dangerous (no string `source.raw`
 * on the state record, so synthesis is impossible). The write proceeds with the
 * plugin key alone in BOTH arms, so the dangerous arm writes a dangling
 * declaration. Acknowledged trade-off pending a widen of the helper's return.
 *
 * `pluginPatch` is the caller's own field set: `enable`/`disable` writes an
 * explicit `enabled`, while `install` writes `enabled: false` only when the
 * install actually landed disabled and otherwise writes an empty patch.
 */
export async function writeAdoptingConfigEntries(opts: {
  readonly current: ScopeConfig;
  readonly sibling: ScopeConfig | undefined;
  readonly state: ExtensionState;
  readonly marketplace: string;
  readonly plugin: string;
  readonly targetConfigPath: string;
  readonly scopeRoot: string;
  readonly pluginPatch: Partial<PluginConfigEntry>;
}): Promise<void> {
  const adoptedSource = synthesizeAdoptedMarketplaceSource({
    current: opts.current,
    sibling: opts.sibling,
    state: opts.state,
    marketplace: opts.marketplace,
  });

  await writeBatchedConfigEntries(opts.current, opts.targetConfigPath, opts.scopeRoot, {
    ...(adoptedSource !== undefined && {
      marketplaces: { [opts.marketplace]: { source: adoptedSource } },
    }),
    plugins: { [`${opts.plugin}@${opts.marketplace}`]: opts.pluginPatch },
  });
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
  installable: MaterializablePlugin,
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
export function pickAgentsSourceDir(installable: MaterializablePlugin): string | null {
  const first = installable.componentPaths.agents[0];
  if (first === undefined) {
    return null;
  }

  return path.isAbsolute(first) ? first : path.join(installable.pluginRoot, first);
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
  readonly marketplace: string;
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

  for (const [mpName, mp] of Object.entries(state.marketplaces)) {
    for (const [pluginName, plugin] of Object.entries(mp.plugins)) {
      const owner: NameOwner = {
        plugin: pluginName,
        marketplace: mpName,
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
  const mp = cloned.marketplaces[marketplace];
  if (mp === undefined) {
    return cloned;
  }

  const newPlugins = { ...mp.plugins };
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- newPlugins is a Record<string,...> local to this helper.
  delete newPlugins[plugin];
  cloned.marketplaces[marketplace] = { ...mp, plugins: newPlugins };
  return cloned;
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
 * I3 / TR-03: subtract a non-AG-5 partial-cascade's dropped artifacts from
 * the state record in place so the persisted row reflects only artifacts
 * still on disk (NFR-3 fail-clean, no ghost record). Shared by the
 * `uninstall` partial-cascade arm and the `disable` partial-cascade arm.
 *
 * The asymmetric `dropped.commands -> resources.prompts` mapping is per
 * TR-03 (cascade primitive naming): the other three axes are name-identical.
 */
export function applyPartialCascadeFold(
  installed: {
    resources: {
      skills: string[];
      prompts: string[];
      agents: string[];
      mcpServers: string[];
      hooks: string[];
    };
  },
  dropped: {
    readonly skills: readonly string[];
    readonly commands: readonly string[];
    readonly agents: readonly string[];
    readonly hooks: readonly string[];
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
  // D-63-04: the cascade primitive (cascadeUnstagePlugin) surfaces
  // dropped.hooks alongside the other four axes; the partial-cascade fold
  // must subtract them so a disable / uninstall partial-cascade failure
  // does not leave a stale hooks entry in the in-memory record.
  installed.resources.hooks = installed.resources.hooks.filter((n) => !dropped.hooks.includes(n));
}

/**
 * The marketplace is not added in the target scope -- either absent entirely,
 * or recorded only in the sibling scope.
 *
 * RECON-03 / D-47-A: orchestrated callers get the typed failure carrying the
 * structural `not added` sentinel; standalone callers get the canonical
 * `MarketplaceNotAddedMessage` row and `undefined`, because the row IS the
 * outcome on that path.
 *
 * `uninstall.ts` and `enable-disable.ts` both reach this state and previously
 * carried byte-identical copies of it under two different names. The routing
 * policy is one decision, so it lives here once; the return shape is the
 * `failed` arm both `UninstallPluginOutcome` and `EnableDisablePluginOutcome`
 * already declare, so neither union is widened by sharing it.
 */
export function emitMarketplaceNotAdded(args: {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly marketplace: string;
  readonly requestedScope: Scope | undefined;
  readonly orchestrated: boolean;
}):
  | {
      readonly status: "failed";
      readonly reason: "not added";
      readonly error: Error;
      readonly cause: string;
    }
  | undefined {
  const { ctx, pi, marketplace, requestedScope, orchestrated } = args;
  if (orchestrated) {
    const scopeList: readonly Scope[] =
      requestedScope === undefined ? ["project", "user"] : [requestedScope];
    const err = new MarketplaceNotFoundError(marketplace, scopeList);
    return { status: "failed", reason: "not added", error: err, cause: errorMessage(err) };
  }

  notify(ctx, pi, {
    kind: "marketplace-not-added",
    name: marketplace,
    ...(requestedScope !== undefined && { scope: requestedScope }),
  });
  return undefined;
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
 * `install.ts` does NOT call this. Its ledger phases push each bridge's
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
 */
export function surfaceDiscoveryWarnings(
  ctx: ExtensionContext,
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
      ? `Plugin "${args.plugin}" ${args.verb}; 1 declared component was skipped.`
      : `Plugin "${args.plugin}" ${args.verb}; ${lines.length.toString()} declared components were skipped.`;
  notifyDiagnostic(ctx, header, lines);
}

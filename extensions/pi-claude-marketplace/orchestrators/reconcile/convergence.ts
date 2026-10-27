// orchestrators/reconcile/convergence.ts
//
// D-10 / D-06: the offline catalog-convergence planner. It finds every recorded
// plugin whose catalog candidate on disk differs from its record, so `pending`,
// the load and `apply` plan the same moves from one place.
//
// D-12 / D-23: a move a dependent's declared range does not admit is held, not
// moved. The range is judged against the catalog version alone, through the
// network-free `constraint-fold.ts`; no release tag is listed here. A clean
// record whose candidate would drop components is declined (WCONV-01). Every
// record keeps the catalog declarations that `apply`'s runner and the
// load-time dependency check read, so the plan never admits a move either of
// them would hold.
//
// D-11: a git source is previewed from what is on disk. A cached tree is
// compared by version and commit; a target with no cached tree is a move only
// when the catalog itself names a different commit pin or version.
//
// MUST NOT touch the network (NFR-5). The module is outside `NETWORK_SEAMS`, so
// BLOCK F in `eslint.config.js` rejects a git surface here; the candidate
// resolves through `resolveListCandidate`, whose git path uses the fs-only
// presence probe. Never writes a file.

import { PLUGIN_ENTRY_VALIDATOR } from "../../domain/components/plugin.ts";
import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { declaredVersionWithPin, isSameVersion, shaVersion } from "../../domain/version.ts";
import { atCatalogVersion, isRecordedButDisabled } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { ownValue } from "../../shared/own-key.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { admitResolvedVersion, foldDeclaredConstraint } from "../plugin/constraint-fold.ts";
import {
  installedCopyOwnerRoot,
  readInstalledCopyDeclaration,
} from "../plugin/dependency-declaration-read.ts";
import { buildScopeDeclarationDetail, readRecordDeclarations } from "../plugin/dependency-index.ts";
import { resolveListCandidate } from "../plugin/list-candidate-version.ts";
import { isRecordedCandidate, isSameRevision, resolvePluginVersion } from "../plugin/shared.ts";

import {
  judgeFinalScope,
  mapRecords,
  releasableDependents,
  stillHeld,
  verdictAfterMoves,
  verdictWithout,
} from "./dependency-verdict.ts";

import type {
  InstalledDeclarationsReader,
  ScopeSatisfactionVerdict,
  UnsatisfiedDeclaration,
} from "./dependency-verdict.ts";
import type { PlannedPluginEnable, ReconcilePlan } from "./types.ts";
import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { MaterializablePlugin, ResolveContext } from "../../domain/resolver-types.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";
import type { AddressedDependency } from "../plugin/dependency-index.ts";
import type { ListCandidate } from "../plugin/list-candidate-version.ts";
import type { RevisionMove } from "../types.ts";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
type PluginRecord = MarketplaceRecord["plugins"][string];

/** One scope's inputs: its state, its locations, and the plan `apply` would run first. */
export interface ConvergenceInput {
  readonly scope: Scope;
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  /** The scope's reconcile plan; absent when the state already reflects it. */
  readonly plan?: ReconcilePlan;
  /**
   * APPLY1-01: disabled records `apply` enables only once their move lands,
   * planned as if enabled (`plugin@marketplace` keys).
   */
  readonly enable?: ReadonlySet<string>;
}

/** D-10: one catalog move, with the revisions on both sides (UPR-02). */
export interface PlannedMove extends RevisionMove {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly plugin: string;
  /** The version, sha or plugin root differs (D-18-11). */
  readonly revisionChanged: boolean;
  /** The supported component set strictly grew (BFILL-01). */
  readonly grew: boolean;
  /** The record was installed partial (`installable: false`). */
  readonly partial: boolean;
}

/**
 * D-12: a move a dependent's declared range does not admit. The plugin stays
 * at its recorded `version`; `cause` is the constraint gate's line (UPDT-02).
 */
export interface PlannedHold {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly plugin: string;
  readonly version: string;
  readonly cause: string;
}

/**
 * D-12 / WCONV-01: a clean record whose candidate resolves
 * `partially-available`. Moving it would drop the listed component
 * kinds without consent, so it stays at its recorded `version`.
 */
export interface PlannedDecline {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly plugin: string;
  readonly version: string;
  readonly unsupported: readonly string[];
}

/** The scope's moves, holds and declines, each sorted by marketplace then plugin. */
export interface ConvergencePlan {
  readonly moves: readonly PlannedMove[];
  readonly holds: readonly PlannedHold[];
  readonly declines: readonly PlannedDecline[];
}

/** One move found on disk, before the range and consent checks judge it. */
interface CandidateMove {
  readonly key: string;
  readonly move: PlannedMove;
  /** The kinds a clean record's partial candidate would drop (D-12). */
  readonly consent?: readonly string[];
  /** DLS-D1: what the installed copy declares; absent when it cannot be read. */
  readonly installed?: readonly AddressedDependency[];
}

type FoundMove = Pick<CandidateMove, "move" | "consent">;

type Blocked =
  | { readonly kind: "hold"; readonly hold: PlannedHold }
  | { readonly kind: "decline"; readonly decline: PlannedDecline };

/** What each record declares, by `plugin@marketplace` key. */
export type Declarations = ReadonlyMap<string, readonly AddressedDependency[]>;

const NO_CONVERGENCE: ConvergencePlan = Object.freeze({ moves: [], holds: [], declines: [] });

function compareNames(a: string, b: string): number {
  return a.localeCompare(b);
}

function pluginKeys(ops: readonly { readonly marketplace: string; readonly plugin: string }[]) {
  return new Set(ops.map((op) => `${op.plugin}@${op.marketplace}`));
}

/** D-PL2-02: the keys a plan installs, a config install or a missing dependency. */
function plannedInstallKeys(plan: ReconcilePlan): Set<string> {
  return pluginKeys([...plan.pluginsToInstall, ...plan.pluginsToDependencyInstall]);
}

/**
 * The scope as `apply`'s plan leaves it: the records it uninstalls and the
 * marketplaces it removes are gone, the records it disables are disabled and
 * the records it enables are enabled.
 */
function stateAsPlanLeavesIt(state: ExtensionState, plan: ReconcilePlan): ExtensionState {
  const removed = new Set(plan.marketplacesToRemove.map((op) => op.marketplace));
  const uninstalled = pluginKeys(plan.pluginsToUninstall);
  const disabled = pluginKeys([...plan.pluginsToDisable, ...plan.pluginsToDependencyDisable]);
  const enabled = pluginKeys(plan.pluginsToEnable);
  const enabledAfter = (key: string, record: PluginRecord): boolean =>
    !disabled.has(key) && (enabled.has(key) || record.enabled);
  const marketplaces = Object.fromEntries(
    Object.entries(state.marketplaces)
      .filter(([name]) => !removed.has(name))
      .map(([name, mp]) => {
        const plugins = Object.fromEntries(
          Object.entries(mp.plugins)
            .filter(([plugin]) => !uninstalled.has(`${plugin}@${name}`))
            .map(([plugin, record]) => [
              plugin,
              { ...record, enabled: enabledAfter(`${plugin}@${name}`, record) },
            ]),
        );
        return [name, { ...mp, plugins }];
      }),
  );
  return { ...state, marketplaces };
}

/**
 * A plugin the plan installs, as the planner sees it. The fold reads only
 * whether a holder is enabled, and it is taken as enabled: whether an install
 * lands disabled is known only once it runs (DFEN-04).
 */
const PLANNED_INSTALL_RECORD: PluginRecord = Object.freeze({
  version: "",
  resolvedSource: "",
  compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
  resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
  enabled: true,
  provenance: "explicit",
  installedAt: "",
  updatedAt: "",
});

/** The scope once the plan's installs land, and what each record then declares. */
interface LandedScope {
  readonly view: ExtensionState;
  readonly declarations: Declarations;
}

/**
 * D-12 / D-06: `apply` judges its moves after its installs land, so a plugin
 * the plan installs holds a move with the ranges its catalog copy declares,
 * and `pending` must show that hold. RESV-01: an install's cascade also
 * installs each dependency it declares that the scope does not record, so
 * those members hold moves too. The declarations are read offline, the way
 * the walk reads a recorded plugin's (NFR-5). A planned install or member in a
 * marketplace the scope does not record yet, or one whose declarations cannot
 * be read, holds nothing here.
 */
async function withPlannedInstalls(
  input: ConvergenceInput,
  view: ExtensionState,
  walked: Declarations,
): Promise<LandedScope> {
  const queue: { readonly marketplace: string; readonly plugin: string }[] =
    input.plan === undefined
      ? []
      : [...input.plan.pluginsToInstall, ...input.plan.pluginsToDependencyInstall];
  const declarations = new Map(walked);
  const marketplaces = { ...view.marketplaces };
  for (let op = queue.shift(); op !== undefined; op = queue.shift()) {
    const mp = ownValue(marketplaces, op.marketplace);
    // A recorded plugin, or a member already landed, is not installed again.
    if (mp === undefined || declarations.has(`${op.plugin}@${op.marketplace}`)) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- each read names the members the next reads cover
    const read = await readRecordDeclarations(
      { state: view, locations: input.locations },
      mp,
      op.plugin,
    );
    if (!read.ok) {
      continue;
    }

    declarations.set(`${op.plugin}@${op.marketplace}`, read.declared);
    marketplaces[op.marketplace] = {
      ...mp,
      plugins: { ...mp.plugins, [op.plugin]: PLANNED_INSTALL_RECORD },
    };
    queue.push(...read.declared.map((dep) => ({ marketplace: dep.marketplace, plugin: dep.name })));
  }

  return { view: { ...view, marketplaces }, declarations };
}

/**
 * D-68-03 / D-10: true iff `resolved` is a STRICT superset of `recorded` (the
 * supported set grew for this plugin). A strictly larger set that still
 * contains every recorded kind means the supported-kind boundary moved in this
 * plugin's favour; an equal-or-smaller set is no growth move, so `apply` never
 * re-materializes (and churns state.json) for a plugin whose boundary did not
 * move.
 */
function supportedSetGrew(recorded: readonly string[], resolved: readonly string[]): boolean {
  if (resolved.length <= recorded.length) {
    return false;
  }

  const resolvedSet = new Set(resolved);
  return recorded.every((kind) => resolvedSet.has(kind));
}

/** The git source `source` names (url / git-subdir / github), or `undefined`. */
function gitSourceOf(source: unknown): GitBackedSource | undefined {
  const parsed = parsePluginSource(source);
  return parsed.kind === "url" || parsed.kind === "git-subdir" || parsed.kind === "github"
    ? parsed
    : undefined;
}

/** What a candidate offers against its record, before growth is weighed. */
interface Offer {
  readonly toVersion: string;
  readonly toCommit?: string;
  /** The version, sha or plugin root differs (D-18-11). */
  readonly revisionChanged: boolean;
  /** The candidate's tree; absent for a git target with no cached tree. */
  readonly resolved?: MaterializablePlugin;
}

/** The marketplace a candidate is offered by: its name and the root its path trees read in. */
type OfferMarketplace = Pick<ResolveContext, "marketplaceName" | "marketplaceRoot">;

/** A path source moves when its version or plugin root differs (D-18-11). */
async function pathOffer(
  entry: PluginEntry,
  candidate: ListCandidate,
  record: PluginRecord,
  marketplace: OfferMarketplace,
): Promise<Offer | undefined> {
  if (candidate.kind === "cold" || candidate.resolved.state === "unavailable") {
    return undefined;
  }

  const resolved = candidate.resolved;
  const toVersion = await resolvePluginVersion(entry, resolved, marketplace);
  const pluginRoot = resolved.pluginRoot;
  return {
    toVersion,
    revisionChanged: !isRecordedCandidate(record, {
      toVersion,
      resolvedSha: undefined,
      pluginRoot,
    }),
    resolved,
  };
}

/**
 * D-11: a git target with no cached tree. Offline, only the catalog can show a
 * different target: a commit pin other than the recorded one, else a declared
 * version other than the recorded one. Its tree is unknown, so it cannot grow.
 */
function coldGitOffer(
  source: GitBackedSource,
  entry: PluginEntry,
  record: PluginRecord,
  marketplaceName: string,
): Offer | undefined {
  const declared =
    entry.version === undefined
      ? undefined
      : declaredVersionWithPin(entry.version, source, marketplaceName);
  if (source.sha !== undefined && source.sha !== record.resolvedSha) {
    return {
      toVersion: declared ?? shaVersion(source.sha, source),
      toCommit: source.sha,
      revisionChanged: true,
    };
  }

  if (declared !== undefined && !isSameVersion(record.version, declared, record.resolvedSha)) {
    return { toVersion: declared, revisionChanged: true };
  }

  return undefined;
}

/**
 * D-10 / GIT-01: a cached git tree moves when its version or commit differs.
 * The plugin root is not compared: an unpinned source answers with the
 * mirror, while the record names its per-commit copy.
 */
async function gitOffer(
  source: GitBackedSource,
  entry: PluginEntry,
  candidate: ListCandidate,
  record: PluginRecord,
  marketplace: OfferMarketplace,
): Promise<Offer | undefined> {
  if (candidate.kind === "cold" || candidate.resolvedSha === undefined) {
    return coldGitOffer(source, entry, record, marketplace.marketplaceName);
  }

  if (candidate.resolved.state === "unavailable") {
    return undefined;
  }

  const { resolved, resolvedSha } = candidate;
  const toVersion = await resolvePluginVersion(entry, resolved, marketplace, resolvedSha);
  return {
    toVersion,
    toCommit: resolvedSha,
    revisionChanged: !isSameRevision(record, toVersion, resolvedSha),
    resolved,
  };
}

/**
 * D-10: the move one enabled record would make, or `undefined`. A delisted
 * record (DLS-D1), an invalid entry and an `unavailable` candidate are not
 * moves. A move is a changed revision or a strictly grown supported set
 * (BFILL-01), weighed on every pass; a growth-only move keeps its version. A
 * clean record's `partially-available` candidate carries the kinds it would
 * drop; a record already installed partial moves without consent (D-12).
 */
async function recordMove(
  input: ConvergenceInput,
  mp: MarketplaceRecord,
  plugin: string,
  record: PluginRecord,
): Promise<FoundMove | undefined> {
  const manifest = await loadMarketplaceManifest(mp.manifestPath);
  const declared = lookupDeclaredPlugin(manifest, plugin);
  if (declared.kind === "absent" || !PLUGIN_ENTRY_VALIDATOR.Check(declared.entry)) {
    return undefined;
  }

  const entry = declared.entry;
  const marketplace = { marketplaceRoot: mp.marketplaceRoot, marketplaceName: mp.name };
  const candidate = await resolveListCandidate(entry, marketplace, input.locations);
  const source = gitSourceOf(entry.source);
  const offer = await (source === undefined
    ? pathOffer(entry, candidate, record, marketplace)
    : gitOffer(source, entry, candidate, record, marketplace));
  if (offer === undefined) {
    return undefined;
  }

  const resolved = offer.resolved;
  const grew =
    resolved !== undefined && supportedSetGrew(record.compatibility.supported, resolved.supported);
  if (!offer.revisionChanged && !grew) {
    return undefined;
  }

  const move: PlannedMove = {
    scope: input.scope,
    marketplace: mp.name,
    plugin,
    fromVersion: record.version,
    toVersion: offer.toVersion,
    ...(record.resolvedSha !== undefined && { fromCommit: record.resolvedSha }),
    ...(offer.toCommit !== undefined && { toCommit: offer.toCommit }),
    revisionChanged: offer.revisionChanged,
    grew,
    partial: !record.compatibility.installable,
  };
  const consent =
    record.compatibility.installable && resolved?.state === "partially-available"
      ? resolved.unsupported
      : undefined;
  return { move, ...(consent !== undefined && { consent }) };
}

/**
 * DLS-D1: what the record's installed copy declares, which a move that stays
 * put adds to its catalog declarations (D-12a). A copy that cannot be read
 * answers `undefined`, and the catalog declarations stand alone.
 */
async function installedCopyDeclarations(
  input: Pick<ConvergenceInput, "locations">,
  mp: MarketplaceRecord,
  record: PluginRecord,
): Promise<readonly AddressedDependency[] | undefined> {
  const read = await readInstalledCopyDeclaration({
    pluginRoot: record.resolvedSource,
    ownerRoot: installedCopyOwnerRoot(record, {
      marketplaceRoot: mp.marketplaceRoot,
      pluginClonesDir: input.locations.pluginClonesDir,
    }),
  });
  if (read.kind !== "found") {
    return undefined;
  }

  return read.dependencies.map((dep) => ({ ...dep, marketplace: dep.marketplace ?? mp.name }));
}

/** T-29-22: a candidate that cannot be read is skipped, never thrown. */
async function recordMoveIsolated(
  input: ConvergenceInput,
  mp: MarketplaceRecord,
  plugin: string,
  record: PluginRecord,
): Promise<CandidateMove | undefined> {
  try {
    const found = await recordMove(input, mp, plugin, record);
    if (found === undefined) {
      return undefined;
    }

    const installed = await installedCopyDeclarations(input, mp, record);
    return { key: `${plugin}@${mp.name}`, ...found, ...(installed !== undefined && { installed }) };
  } catch (err) {
    hookDebugLog(
      `planConvergence: skipped ${plugin}@${mp.name}: ${errorMessage(err)}`,
      "reconcile",
    );
    return undefined;
  }
}

/**
 * D-12 / D-23: the cause line of a move a dependent's declared range does not
 * admit, or `undefined`. The catalog version is judged as it stands: the fold
 * lists no tag, so a range that does not admit it holds the move.
 */
function rangeHoldCause(
  declarations: Declarations,
  view: ExtensionState,
  move: PlannedMove,
): string | undefined {
  const verdict = foldDeclaredConstraint(declarations, view, move.plugin, move.marketplace);
  if (verdict.kind !== "admits") {
    return verdict.kind === "held" ? verdict.cause : undefined;
  }

  const admitted = admitResolvedVersion(verdict, move.toVersion);
  return admitted.kind === "held" ? admitted.cause : undefined;
}

/**
 * D-12: why a candidate stays put under the current declarations, or
 * `undefined` when it moves. The range comes first and consent second, the
 * order `update` checks them in.
 */
function blockOf(
  candidate: CandidateMove,
  declarations: Declarations,
  view: ExtensionState,
): Blocked | undefined {
  const { move, consent } = candidate;
  const where = { scope: move.scope, marketplace: move.marketplace, plugin: move.plugin };
  const cause = rangeHoldCause(declarations, view, move);
  if (cause !== undefined) {
    return { kind: "hold", hold: { ...where, version: move.fromVersion, cause } };
  }

  if (consent !== undefined) {
    return {
      kind: "decline",
      decline: { ...where, version: move.fromVersion, unsupported: consent },
    };
  }

  return undefined;
}

/**
 * Whether `known` already says what `dep` says: it names the same plugin with
 * the same range, or `dep` names no range and `known` names the plugin.
 */
function alreadyDeclared(known: readonly AddressedDependency[], dep: AddressedDependency): boolean {
  return known.some(
    (entry) =>
      entry.name === dep.name &&
      entry.marketplace === dep.marketplace &&
      (dep.version === undefined || entry.version === dep.version),
  );
}

/**
 * D-12a: what each record declares while the candidates in `blocked` stay put.
 * A plugin that stays put keeps running the copy it has, and every other
 * check of the scope (the load-time dependency check, `apply`'s runner) reads
 * its catalog copy (D-05-06), so a staying record keeps its catalog
 * declarations and adds its installed copy's: a range either copy names
 * constrains a move. A block only adds ranges, so blocks only grow.
 */
function declarationsWhileBlocked(
  candidates: readonly CandidateMove[],
  walked: Declarations,
  blocked: ReadonlyMap<string, Blocked>,
): Declarations {
  const declarations = new Map(walked);
  for (const { key, installed } of candidates) {
    const catalog = walked.get(key);
    if (installed === undefined || catalog === undefined || !blocked.has(key)) {
      continue;
    }

    const extra = installed.filter((dep) => !alreadyDeclared(catalog, dep));
    declarations.set(key, [...catalog, ...extra]);
  }

  return declarations;
}

/** One round of the fixed point: every candidate is judged against the same declarations. */
function judgeCandidates(
  candidates: readonly CandidateMove[],
  declarations: Declarations,
  view: ExtensionState,
): ReadonlyMap<string, Blocked> {
  const blocked = new Map<string, Blocked>();
  for (const candidate of candidates) {
    const block = blockOf(candidate, declarations, view);
    if (block !== undefined) {
      blocked.set(candidate.key, block);
    }
  }

  return blocked;
}

/**
 * D-12: judges every candidate against the scope as the plan leaves it, to a
 * fixed point. A dependent that moves is judged by its catalog declarations,
 * and one that stays put by its catalog and installed-copy declarations
 * together (DLS-D1). Each round judges every candidate against the same
 * declarations, and the causes reported are the last round's, so neither the
 * moves nor the cause lines depend on plugin names or input order.
 */
function settleCandidates(
  candidates: readonly CandidateMove[],
  walked: Declarations,
  view: ExtensionState,
): ConvergencePlan {
  let blocked: ReadonlyMap<string, Blocked> = new Map();
  let next = judgeCandidates(candidates, walked, view);
  // A new block adds an installed copy's ranges, so judge again until no block is added.
  while (next.size > blocked.size) {
    blocked = next;
    next = judgeCandidates(candidates, declarationsWhileBlocked(candidates, walked, blocked), view);
  }

  const blocks = candidates.flatMap(({ key }) => next.get(key) ?? []);
  return {
    moves: candidates.filter(({ key }) => !next.has(key)).map(({ move }) => move),
    holds: blocks.flatMap((block) => (block.kind === "hold" ? [block.hold] : [])),
    declines: blocks.flatMap((block) => (block.kind === "decline" ? [block.decline] : [])),
  };
}

/** The scope as the plan leaves it, with the records `enable` names enabled. */
function plannedView(input: ConvergenceInput): ExtensionState {
  const view =
    input.plan === undefined ? input.state : stateAsPlanLeavesIt(input.state, input.plan);
  const enable = input.enable;
  if (enable === undefined || enable.size === 0) {
    return view;
  }

  return mapRecords(view, (key, record) =>
    enable.has(key) ? { ...record, enabled: true } : record,
  );
}

/**
 * APPLY1-01: a scope's catalog moves as one cascade. `plan.moves` runs
 * dependencies first, in the post-order an install cascade installs its
 * closure in, and `declarations` is what each record declares once the plan
 * lands, so a caller can tell which moves a record waits on.
 */
export interface ConvergenceCascade {
  readonly plan: ConvergencePlan;
  readonly declarations: Declarations;
}

/** The `plugin@marketplace` keys the record `key` declares once the plan lands. */
export function cascadeDependencies(cascade: ConvergenceCascade, key: string): readonly string[] {
  return declaredKeys(cascade.declarations, key);
}

/** The `plugin@marketplace` keys the record `key` declares; none for a record the walk lacks. */
function declaredKeys(declarations: Declarations, key: string): readonly string[] {
  return (declarations.get(key) ?? []).map((dep) => `${dep.name}@${dep.marketplace}`);
}

/**
 * APPLY1-01: `items` reordered so each comes after the items it declares, in
 * depth-first post-order, ties kept in their given order. A declaration cycle
 * keeps the order the walk first reaches it in.
 */
export function dependenciesFirst<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  declarations: Declarations,
): T[] {
  const byKey = new Map(items.map((item) => [keyOf(item), item]));
  const ordered: T[] = [];
  const visited = new Set<string>();
  const visit = (key: string): void => {
    const item = byKey.get(key);
    if (item === undefined || visited.has(key)) {
      return;
    }

    visited.add(key);
    declaredKeys(declarations, key).forEach(visit);
    ordered.push(item);
  };

  for (const key of byKey.keys()) {
    visit(key);
  }

  return ordered;
}

function moveKey(move: PlannedMove): string {
  return `${move.plugin}@${move.marketplace}`;
}

/**
 * D-10 / D-06: every catalog move in one scope, offline, as one cascade
 * (APPLY1-01). A scope whose declaration walk cannot be read previews no
 * move, the fail-closed stance `update` takes (D-05-07, D-18-17); the
 * per-session warning names the declarer (REC-05). Disabled records never
 * move (ENBL-08), except the ones `input.enable` names.
 */
export async function planConvergenceCascade(input: ConvergenceInput): Promise<ConvergenceCascade> {
  const view = plannedView(input);
  const walk = await buildScopeDeclarationDetail({ state: view, locations: input.locations });
  if (!walk.ok) {
    return { plan: NO_CONVERGENCE, declarations: new Map() };
  }

  const candidates: CandidateMove[] = [];
  const marketplaces = Object.values(view.marketplaces).sort((a, b) =>
    compareNames(a.name, b.name),
  );
  for (const mp of marketplaces) {
    const plugins = Object.entries(mp.plugins).sort(([a], [b]) => compareNames(a, b));
    for (const [plugin, record] of plugins) {
      if (isRecordedButDisabled(record)) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- one offline resolve per record, in the order the moves are reported
      const candidate = await recordMoveIsolated(input, mp, plugin, record);
      if (candidate !== undefined) {
        candidates.push(candidate);
      }
    }
  }

  const landed = await withPlannedInstalls(input, view, walk.declarations);
  const settled = settleCandidates(candidates, landed.declarations, landed.view);
  return {
    plan: { ...settled, moves: dependenciesFirst(settled.moves, moveKey, landed.declarations) },
    declarations: landed.declarations,
  };
}

/** One step of a scope's cascade: a catalog move, a deferred enable, or both. */
export type CascadeStep =
  | { readonly key: string; readonly move: PlannedMove; readonly enable?: PlannedPluginEnable }
  | { readonly key: string; readonly move?: undefined; readonly enable: PlannedPluginEnable };

/** What decides the steps after the missing-dependency install. */
export interface AfterInstallsInput {
  /** D-PL2-16: the records whose enable waits on the missing-dependency install. */
  readonly waiting: ReadonlySet<string>;
  /** WR-06: the moves that run after that install (`movesAfterInstalls`). */
  readonly afterInstalls: ReadonlySet<string>;
  /** The enables that wait for the cascade (`MoveCascade.deferredEnables`). */
  readonly deferred: readonly PlannedPluginEnable[];
}

/**
 * WR-06 / D-26: the moves that run after the missing-dependency install: the
 * move of each record whose enable waits on it (D-PL2-16), and, to a fixed
 * point, each move that declares one of them. The set only grows and is
 * bounded by the cascade's moves. `apply` runs these moves after the install,
 * and `pending` lists them there (D-PL2-02).
 */
export function movesAfterInstalls(
  cascade: ConvergenceCascade,
  waiting: ReadonlySet<string>,
): ReadonlySet<string> {
  const moveKeys = cascade.plan.moves.map(moveKey);
  const after = new Set(moveKeys.filter((key) => waiting.has(key)));
  let size: number;
  do {
    size = after.size;
    for (const key of moveKeys) {
      if (cascadeDependencies(cascade, key).some((dep) => after.has(dep))) {
        after.add(key);
      }
    }
  } while (after.size > size);

  return after;
}

/**
 * D-PL2-16 / WR-06: the steps after the missing-dependency install,
 * dependencies first. A waiting record's own move runs with its enable, as a
 * deferred record's does in the cascade: one net row. Each other move that
 * waited runs with its record's deferred enable, if it has one. `apply` runs
 * these steps in this order, and `pending` lists them in it (D-PL2-02).
 */
export function stepsAfterInstalls(
  cascade: ConvergenceCascade,
  input: AfterInstallsInput,
  enables: readonly PlannedPluginEnable[],
): readonly CascadeStep[] {
  const { afterInstalls, waiting } = input;
  const moves = new Map(cascade.plan.moves.map((move) => [moveKey(move), move]));
  const deferred = new Map(input.deferred.map((op) => [`${op.plugin}@${op.marketplace}`, op]));
  const waited = cascade.plan.moves
    .filter((move) => afterInstalls.has(moveKey(move)) && !waiting.has(moveKey(move)))
    .map((move): CascadeStep => {
      const enable = deferred.get(moveKey(move));
      return { key: moveKey(move), move, ...(enable !== undefined && { enable }) };
    });
  const steps = [
    ...enables.map((enable): CascadeStep => {
      const key = `${enable.plugin}@${enable.marketplace}`;
      const move = moves.get(key);
      return move === undefined ? { key, enable } : { key, move, enable };
    }),
    ...waited,
  ];
  return dependenciesFirst(steps, (step) => step.key, cascade.declarations);
}

/** Every recorded `name@marketplace` key disabled by something other than the check. */
function independentlyDisabledKeys(state: ExtensionState): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const marketplace of Object.values(state.marketplaces)) {
    for (const [name, record] of Object.entries(marketplace.plugins)) {
      if (isRecordedButDisabled(record) && record.dependencyDisabled !== true) {
        keys.add(`${name}@${marketplace.name}`);
      }
    }
  }

  return keys;
}

/**
 * The dependents whose every unsatisfied declaration the planned installs
 * satisfy, run to a fixpoint: a `missing` dependency is satisfied once a
 * planned install names it, and a `disabled` one once the check releases it
 * and nothing else disabled it.
 *
 * D-PL2-14: a dependency the user or a config disabled that the plan
 * `enabled` names counts as released too. `apply` enables it in the same
 * pass, so `pending` must not list its dependent as disabled.
 */
function releasedDependents(
  unsatisfied: readonly UnsatisfiedDeclaration[],
  installed: ReadonlySet<string>,
  state: ExtensionState,
  enabled: ReadonlySet<string>,
): ReadonlySet<string> {
  const disabled = independentlyDisabledKeys(state);
  const released = new Set<string>();
  const isSatisfied = (entry: UnsatisfiedDeclaration): boolean =>
    entry.kind === "missing"
      ? installed.has(entry.dependency)
      : entry.kind === "disabled" &&
        released.has(entry.dependency) &&
        (enabled.has(entry.dependency) || !disabled.has(entry.dependency));
  const dependents = [...new Set(unsatisfied.map((entry) => entry.dependent))];
  let batch: readonly string[];
  do {
    batch = dependents.filter(
      (dependent) =>
        !released.has(dependent) &&
        unsatisfied.every((entry) => entry.dependent !== dependent || isSatisfied(entry)),
    );
    for (const dependent of batch) {
      released.add(dependent);
    }
  } while (batch.length > 0);

  return released;
}

/**
 * D-21 / D-09-07 / D-PL2-02: the toggle buckets once the plan's installs land.
 * `apply` runs its moves and its missing-dependency installs before it judges
 * the scope, so a dependent whose missing dependency a planned install brings
 * stays up, or comes back up. The planner installs nothing, so it removes from
 * the verdict each dependent the planned installs satisfy and plans again.
 * `pending` and `apply`'s read pass both plan through here, so the two agree.
 * The install buckets stay the first plan's.
 *
 * D-PL2-14: a record a replan enables releases its dependents, so the release
 * runs again with every record a replan has enabled. The released set only
 * grows, and it is bounded by the scope's dependents, so the loop ends.
 */
export function withPlannedInstallsLanded(
  plan: ReconcilePlan,
  verdict: ScopeSatisfactionVerdict,
  state: ExtensionState,
  replan: (verdict: ScopeSatisfactionVerdict) => ReconcilePlan,
): ReconcilePlan {
  const installed = plannedInstallKeys(plan);
  if (installed.size === 0 || !verdict.ok) {
    return plan;
  }

  const replanWithout = (released: ReadonlySet<string>): ReconcilePlan =>
    replan({
      ok: true,
      unsatisfied: verdict.unsatisfied.filter((entry) => !released.has(entry.dependent)),
    });
  const enabled = new Set<string>();
  let released = releasedDependents(verdict.unsatisfied, installed, state, enabled);
  let fresh = replanWithout(released);
  for (;;) {
    pluginKeys(fresh.pluginsToEnable).forEach((key) => enabled.add(key));
    const next = releasedDependents(verdict.unsatisfied, installed, state, enabled);
    if (next.size === released.size) {
      break;
    }

    released = next;
    fresh = replanWithout(released);
  }

  return {
    ...plan,
    pluginsToEnable: fresh.pluginsToEnable,
    pluginsToDisable: fresh.pluginsToDisable,
    pluginsToDependencyDisable: fresh.pluginsToDependencyDisable,
  };
}

/**
 * D-PL2-16: the records that wait on an install the plan schedules: a record
 * with a `missing` declaration a planned install satisfies, or a `disabled`
 * one whose dependency itself waits, run to a fixpoint. The set only grows
 * and is bounded by the verdict's dependents, so a declaration cycle ends.
 */
function waitingOnInstalls(
  verdict: ScopeSatisfactionVerdict,
  installed: ReadonlySet<string>,
): ReadonlySet<string> {
  const waiting = new Set<string>();
  const unsatisfied = verdict.ok ? verdict.unsatisfied : [];
  let size: number;
  do {
    size = waiting.size;
    for (const entry of unsatisfied) {
      const waits =
        entry.kind === "missing"
          ? installed.has(entry.dependency)
          : entry.kind === "disabled" && waiting.has(entry.dependency);
      if (waits) {
        waiting.add(entry.dependent);
      }
    }
  } while (waiting.size > size);

  return waiting;
}

/** One scope's plan and the verdict it was planned from, for `settleMoveCascade`. */
export interface MoveCascadeInput extends Omit<ConvergenceInput, "enable"> {
  readonly plan: ReconcilePlan;
  readonly verdict: ScopeSatisfactionVerdict;
  /** Plans the scope again from another verdict, as the caller planned `plan`. */
  readonly replan: (verdict: ScopeSatisfactionVerdict) => ReconcilePlan;
}

/**
 * The plan `apply` runs and `pending` lists, the cascade it moves, and the
 * enables of released records held down for a dependency, which `apply` runs
 * in cascade order. `cascade` is absent when no held dependent could be
 * released, so the plan is the caller's own.
 */
export interface MoveCascade {
  readonly plan: ReconcilePlan;
  readonly cascade?: ConvergenceCascade;
  readonly deferredEnables: readonly PlannedPluginEnable[];
  /**
   * WR-02: `plan` as `pending` lists it. A deferred record that moves is
   * enabled by its move and reports one `(updated)` row, so its enable is not
   * listed beside its `(will update)` row.
   */
  readonly preview: ReconcilePlan;
  /**
   * D-PL2-16: the enables of records that wait on a planned install. `enable`
   * refuses a record whose closure holds an uninstalled member, so `apply`
   * runs these after its missing-dependency install, and they are in neither
   * `plan`, `deferredEnables` nor `preview`.
   */
  readonly enablesAfterInstalls: readonly PlannedPluginEnable[];
}

function isDependencyHeld(state: ExtensionState, op: PlannedPluginEnable): boolean {
  const record = ownValue(ownValue(state.marketplaces, op.marketplace)?.plugins, op.plugin);
  return record?.dependencyDisabled === true && isRecordedButDisabled(record);
}

/**
 * APPLY1-01: an update is an install of a newer version, so a dependent the
 * catalog moves together with the newer dependency it needs converges in one
 * `apply`, as a fresh install converges on its closure. A dependent the
 * verdict holds down for a dependency's version is released when the moves
 * the plan would make satisfy it, judged by `verdictAfterMoves` over the
 * moves planned with exactly the released set enabled. A released dependent
 * still unmet is held again and the moves are planned again; the released set
 * only shrinks, so the loop ends.
 *
 * A released record that is disabled now (its LOAD-02 marker) is enabled by
 * `apply` in cascade order, after the moves it waits on and its own move land
 * (`deferredEnables`). The release only decides what `apply` attempts: `apply`
 * judges every enabled plugin again once the moves have run.
 */
export async function settleMoveCascade(input: MoveCascadeInput): Promise<MoveCascade> {
  const base = { scope: input.scope, state: input.state, locations: input.locations };
  const settled = await releaseOnLandedMoves(input);
  const lifts = settled.plan.pluginsToEnable.filter((op) => isDependencyHeld(input.state, op));
  const cascade =
    settled.cascade ??
    (lifts.length > 0 ? await planConvergenceCascade({ ...base, plan: settled.plan }) : undefined);
  const moves = cascade?.plan.moves ?? [];
  const moved = new Set(moves.map(moveKey));
  // CR-A / CR-B: an enable the release relies on, and a held-down record that
  // has a move of its own, wait for the cascade: `apply` enables them in
  // cascade order, a held-down record right after its own move lands.
  const deferredEnables = settled.plan.pluginsToEnable.filter((op) => {
    const key = `${op.plugin}@${op.marketplace}`;
    return settled.released.has(key) || (moved.has(key) && isDependencyHeld(input.state, op));
  });
  const deferred = new Set(deferredEnables.map((op) => `${op.plugin}@${op.marketplace}`));
  const judged = await judgePlannedScope(input, settled.plan, { moves, deferred });
  // D-PL2-16: the cascade above is planned before the split, so a withheld
  // record's own move stays planned.
  const waiting = waitingOnInstalls(input.verdict, plannedInstallKeys(judged));
  const ready = (op: PlannedPluginEnable): boolean =>
    !waiting.has(`${op.plugin}@${op.marketplace}`);
  const plan = { ...judged, pluginsToEnable: judged.pluginsToEnable.filter(ready) };
  const preview = {
    ...plan,
    pluginsToEnable: plan.pluginsToEnable.filter((op) => {
      const key = `${op.plugin}@${op.marketplace}`;
      return !(deferred.has(key) && moved.has(key));
    }),
  };
  return {
    plan,
    ...(cascade !== undefined && { cascade }),
    deferredEnables: deferredEnables.filter(ready),
    preview,
    enablesAfterInstalls: judged.pluginsToEnable.filter((op) => !ready(op)),
  };
}

/**
 * WR-1 / WR-2: the plan, judged by the rules `apply` judges its result by
 * (`judgeFinalScope`), over the scope as the plan and its moves leave it. A
 * planned enable that judgement would hold is dropped, so `apply` does not
 * enable and disable it again, and every other enabled record it
 * would hold is disabled by the plan, so `pending` lists it. A record that
 * moves is judged by its catalog declarations alone, since its copy is
 * replaced, and a deferred record is the cascade's to judge. A judgement whose
 * walk fails leaves the plan as it was (D-05-07). An enable it drops leaves the
 * record as it was, so neither `pending` nor `apply` reports a row for it.
 */
async function judgePlannedScope(
  input: MoveCascadeInput,
  plan: ReconcilePlan,
  cascade: { readonly moves: readonly PlannedMove[]; readonly deferred: ReadonlySet<string> },
): Promise<ReconcilePlan> {
  const toVersion = new Map(cascade.moves.map((move) => [moveKey(move), move.toVersion]));
  const movedRecords = new Set<PluginRecord>();
  const landedView = mapRecords(stateAsPlanLeavesIt(input.state, plan), (key, record) => {
    const version = toVersion.get(key);
    if (version === undefined) {
      return record;
    }

    const landed = atCatalogVersion(record, version);
    movedRecords.add(landed);
    return landed;
  });
  const marketplaces = landedView.marketplaces;
  const readCopy = installedCopyReader(input.locations);
  const verdict = await judgeFinalScope({
    state: landedView,
    locations: input.locations,
    installedDeclarations: (mp, record) =>
      movedRecords.has(record) ? Promise.resolve(undefined) : readCopy(mp, record),
    scheduled: plannedInstallKeys(plan),
  });
  const holds = (verdict.ok ? verdict.unsatisfied : []).filter(
    (entry) => !cascade.deferred.has(entry.dependent),
  );
  const held = new Set(holds.map((entry) => entry.dependent));
  const keyOf = (op: { readonly plugin: string; readonly marketplace: string }): string =>
    `${op.plugin}@${op.marketplace}`;
  // Review 4 WR-1: every enable the judgement would hold is dropped, a config
  // enable as well as a lift; the record stays as it is, so it gets no row.
  const pluginsToEnable = plan.pluginsToEnable.filter((op) => !held.has(keyOf(op)));
  const planned = new Set(
    [...plan.pluginsToDisable, ...plan.pluginsToDependencyDisable, ...plan.pluginsToEnable].map(
      keyOf,
    ),
  );
  const disables = Object.values(marketplaces).flatMap((mp) =>
    Object.entries(mp.plugins).flatMap(([plugin, record]) => {
      const key = `${plugin}@${mp.name}`;
      const entry = holds.find((candidate) => candidate.dependent === key);
      return record.enabled && entry !== undefined && !planned.has(key)
        ? [{ ...entry, scope: input.scope, plugin, marketplace: mp.name }]
        : [];
    }),
  );
  return {
    ...plan,
    pluginsToEnable,
    pluginsToDependencyDisable: [...plan.pluginsToDependencyDisable, ...disables],
  };
}

/**
 * The release loop of `settleMoveCascade`: the caller's plan when no held
 * dependent can be released, or the plan with the largest released set whose
 * moves satisfy every released dependent, its cascade and that set.
 *
 * D-PL2-02: `apply` judges its moves after its installs land, so every
 * install the plan schedules, a config install or a missing dependency,
 * counts as present here: a dependent waiting only on one is released, and
 * the moves are judged with it installed.
 */
async function releaseOnLandedMoves(
  input: MoveCascadeInput,
): Promise<Pick<MoveCascade, "plan" | "cascade"> & { readonly released: ReadonlySet<string> }> {
  const base = { scope: input.scope, state: input.state, locations: input.locations };
  const scheduled = plannedInstallKeys(input.plan);
  let released = releasableDependents(input.verdict, input.state, scheduled);
  while (released.size > 0) {
    const plan = input.replan(verdictWithout(input.verdict, released, scheduled));
    // eslint-disable-next-line no-await-in-loop -- each round plans the moves the previous round's release allows
    const cascade = await planConvergenceCascade({ ...base, plan });
    // eslint-disable-next-line no-await-in-loop -- each round judges the moves it planned
    const after = await verdictAfterMoves(
      { state: input.state, locations: input.locations, scheduled: plannedInstallKeys(plan) },
      { enable: plan.pluginsToEnable, disable: plan.pluginsToDisable },
      cascade.plan.moves,
    );
    const held = stillHeld(after, released);
    if (held.size === 0) {
      return { plan, cascade, released };
    }

    released = new Set([...released].filter((dependent) => !held.has(dependent)));
  }

  return { plan: input.plan, released };
}

/** Whether `pluginRoot` is a per-commit copy under the scope's plugin clones. */
export async function isPinnedCopy(
  locations: ScopedLocations,
  pluginRoot: string,
): Promise<boolean> {
  try {
    await assertPathInside(locations.pluginClonesDir, pluginRoot, "installed plugin copy");
    return true;
  } catch {
    return false;
  }
}

/**
 * APPLY1-01 / DLS-D1: reads what a record's installed copy declares, for the
 * judgement `apply` makes after its cascade. Only a git source keeps a copy of
 * the version it runs (a per-commit copy); a path source's files are the
 * marketplace's, which the catalog read already covers, so it answers
 * `undefined`, as does a copy that cannot be read.
 */
export function installedCopyReader(locations: ScopedLocations): InstalledDeclarationsReader {
  return async (mp, record) =>
    (await isPinnedCopy(locations, record.resolvedSource))
      ? installedCopyDeclarations({ locations }, mp, record)
      : undefined;
}

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
import { shaVersion } from "../../domain/version.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { admitResolvedVersion, foldDeclaredConstraint } from "../plugin/constraint-fold.ts";
import { readInstalledCopyDeclaration } from "../plugin/dependency-declaration-read.ts";
import { buildScopeDeclarationDetail } from "../plugin/dependency-index.ts";
import { resolveListCandidate } from "../plugin/list-candidate-version.ts";
import { isRecordedCandidate, isSameRevision, resolvePluginVersion } from "../plugin/shared.ts";

import type { ReconcilePlan } from "./types.ts";
import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { MaterializablePlugin } from "../../domain/resolver-types.ts";
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

type Declarations = ReadonlyMap<string, readonly AddressedDependency[]>;

const NO_CONVERGENCE: ConvergencePlan = Object.freeze({ moves: [], holds: [], declines: [] });

function compareNames(a: string, b: string): number {
  return a.localeCompare(b);
}

function pluginKeys(ops: readonly { readonly marketplace: string; readonly plugin: string }[]) {
  return new Set(ops.map((op) => `${op.plugin}@${op.marketplace}`));
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

/** A path source moves when its version or plugin root differs (D-18-11). */
async function pathOffer(
  entry: PluginEntry,
  candidate: ListCandidate,
  record: PluginRecord,
): Promise<Offer | undefined> {
  if (candidate.kind === "cold" || candidate.resolved.state === "unavailable") {
    return undefined;
  }

  const resolved = candidate.resolved;
  const toVersion = await resolvePluginVersion(entry, resolved);
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
): Offer | undefined {
  if (source.sha !== undefined && source.sha !== record.resolvedSha) {
    return {
      toVersion: entry.version ?? shaVersion(source.sha),
      toCommit: source.sha,
      revisionChanged: true,
    };
  }

  if (entry.version !== undefined && entry.version !== record.version) {
    return { toVersion: entry.version, revisionChanged: true };
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
): Promise<Offer | undefined> {
  if (candidate.kind === "cold" || candidate.resolvedSha === undefined) {
    return coldGitOffer(source, entry, record);
  }

  if (candidate.resolved.state === "unavailable") {
    return undefined;
  }

  const { resolved, resolvedSha } = candidate;
  const toVersion = await resolvePluginVersion(entry, resolved, resolvedSha);
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
  const candidate = await resolveListCandidate(
    entry,
    { marketplaceRoot: mp.marketplaceRoot, marketplaceName: mp.name },
    input.locations,
  );
  const source = gitSourceOf(entry.source);
  const offer = await (source === undefined
    ? pathOffer(entry, candidate, record)
    : gitOffer(source, entry, candidate, record));
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
 * put adds to its catalog declarations (D-12). A copy that cannot be read
 * answers `undefined`, and the catalog declarations stand alone.
 */
async function installedCopyDeclarations(
  input: ConvergenceInput,
  mp: MarketplaceRecord,
  record: PluginRecord,
): Promise<readonly AddressedDependency[] | undefined> {
  const read = await readInstalledCopyDeclaration({
    pluginRoot: record.resolvedSource,
    ownerRoots: [mp.marketplaceRoot, input.locations.pluginClonesDir],
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
 * D-12: what each record declares while the candidates in `blocked` stay put.
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

/**
 * D-10 / D-06: every catalog move in one scope, offline. A scope whose
 * declaration walk cannot be read previews no move, the fail-closed stance
 * `update` takes (D-05-07, D-18-17); the per-session warning names the
 * declarer (REC-05). Disabled records never move (ENBL-08).
 */
export async function planConvergence(input: ConvergenceInput): Promise<ConvergencePlan> {
  const view =
    input.plan === undefined ? input.state : stateAsPlanLeavesIt(input.state, input.plan);
  const walk = await buildScopeDeclarationDetail({ state: view, locations: input.locations });
  if (!walk.ok) {
    return NO_CONVERGENCE;
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

  return settleCandidates(candidates, walk.declarations, view);
}

// orchestrators/plugin/dependency-index.ts
//
// The scope's declaration index: what every installed record in ONE state
// document declares, read offline, as the input to the dependents question
// (D-05-14 / PRUNE-05) and to the orphan sweep that follows it.
//
// D-05-05: one state document. The records walked are the target scope's own,
// and a plugin installed in the other scope never holds a record here.
//
// D-05-04: every record is indexed, enabled or disabled, whatever its
// provenance. Installed is installed; a disabled record keeps its declarations
// exactly as it keeps its inventory.
//
// D-05-06 / NFR-5: every declaration is established through the same offline
// read the install cascade uses -- `readDependencyDeclaration`, where the
// plugin's own manifest outranks its marketplace entry and a git source is
// read from the warm clone cache only. The only reads this module composes are
// `loadMarketplaceManifest` (a memoized read of bytes already on disk),
// `lookupDeclaredPlugin` (pure) and that declaration read (fs + warm clone
// cache). Nothing here names a git surface, and the network-free gate pins
// this file so nothing can.
//
// DLS-01 / DLS-D1: a record its loaded manifest no longer lists is read from
// its installed copy (`readInstalledCopyDeclaration`), because Pi keeps such a
// plugin running and it keeps the dependencies it runs with. Upstream reads
// none: it does not load a delisted plugin at all.
//
// D-05-07: the walk FAILS CLOSED. The first record whose declarations cannot
// be established -- its marketplace manifest fails to load, neither that
// manifest nor its installed copy states them, or its declaration parses as
// unusable -- ends the walk with a
// failure arm naming that record, because deleting on incomplete information
// is the one outcome the callers must never produce. A record with no usable
// answer is never read as "declares nothing".
//
// The read tells an ABSENT own manifest from a PRESENT-BUT-UNUSABLE one. An
// absent manifest -- no candidate file, a cold git clone, a refused root -- is
// answered by the marketplace entry (D-05-06), and an entry that carries no
// `dependencies` key answers "declares nothing". A present-but-unusable
// manifest fails closed through `refuseUnusableOwnManifest` (D-05-07), because
// a damaged file may hide a dependency the plugin really declares. The install
// cascade keeps its own entry fallback for that case (D-01-07).
//
// The failure arm's `cause.message` IS the rendered cause line. It carries the
// declarer's `name@marketplace` key and a fixed phrase or field path this
// extension writes. It never carries the text of a manifest that fails to
// load, because that text comes from repository content (T-05-04). A load
// failure gets a fixed reason chosen by the error's class or errno code, never
// by its message, so a missing, an unreadable, and an invalid manifest stay
// distinguishable. It is built WITHOUT `{ cause }` chaining, so the renderer's
// cause-chain walk has no raw message to print behind it.
//
// The failure arm's `reason` is the closed-set token of the same fault, picked
// by the same branch as the phrase. Only the row whose subject is the declarer
// itself renders it: the load-time stale-declarer warning (REC-05).
//
// A declaration HOLDS its key whatever `version` or `sha` constraint it
// carries. The closure walk's refusal of a `sha` pin is an install-time rule;
// here the fail-closed direction is to treat every named key as held.
//
// LOAD-01: the file publishes TWO walks over that one read path.
// `buildScopeDeclarationIndex` answers the dependents question and flattens
// each declaration to a bare key, because who-declares-X does not depend on
// which version X must be. `buildScopeDeclarationDetail` answers the load-time
// satisfaction question and keeps the whole declaration, because
// out-of-range-ness is exactly the constraint the flattening discards. The
// detail walk also has no `exclude`: the load-time question has no key under
// decision, so every record is at once a potential declarer and a potential
// dependency. Two shapes and two parameter lists are why it is a sibling here
// rather than a flag on the neighbour, and keeping it in this file inherits
// the file's network-free gate entry.

import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";
import { InvalidMarketplaceManifestError, isErrnoException } from "../../shared/errors.ts";
import { narrowProbeError } from "../../shared/probe-classifiers.ts";

import {
  readDependencyDeclaration,
  readInstalledCopyDeclaration,
} from "./dependency-declaration-read.ts";

import type { DependencyDeclarationReader } from "./dependency-declaration-read.ts";
import type { DeclaredDependency } from "../../domain/dependencies.ts";
import type { DeclarationIndex, OrphanCandidate } from "../../domain/dependency-orphans.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Reason } from "../../shared/notification-types.ts";

/**
 * REC-05: why a declarer's declarations could not be established, as the
 * token its own row renders. A dropped catalog entry is `not in manifest`; a
 * declaration the parser rejects is `invalid manifest`; an own manifest that is
 * present but cannot be used is `unreadable manifest`. A marketplace manifest
 * that fails to load takes the token `list` and `info` give the same fault
 * (`narrowProbeError`), so one fault reads the same on every surface.
 */
export type DeclarerReadFailure =
  | Extract<Reason, "not in manifest" | "invalid manifest" | "unreadable manifest">
  | ReturnType<typeof narrowProbeError>;

/**
 * One marketplace's record in the state document. Exported because the
 * exported `IndexedRecord` references it (fallow private-type-leak rule).
 */
export type MarketplaceStateRecord = ExtensionState["marketplaces"][string];

/**
 * One walked record as the orphan sweep consumes it (D-05-10): the
 * `OrphanCandidate` view -- key and provenance -- plus the snapshot objects a
 * removal needs, so the orchestrator never walks the state a second time and
 * never looks a key back up. `marketplace` and `record` are the SAME objects
 * the locked snapshot holds; a removal mutates them in place.
 */
export interface IndexedRecord extends OrphanCandidate {
  readonly marketplace: MarketplaceStateRecord;
  readonly plugin: string;
  readonly record: MarketplaceStateRecord["plugins"][string];
}

/**
 * A declaration whose marketplace is filled in with the declaring record's own
 * where the element named none -- the same fill rule the closure walk applies,
 * so `${name}@${marketplace}` compares exactly against a recorded key.
 */
export interface AddressedDependency extends DeclaredDependency {
  readonly marketplace: string;
}

/** Inputs of one scope-wide declaration-detail build. */
export interface ScopeDeclarationDetailOptions {
  /** The locked snapshot of the target scope's state document. */
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  /** Filesystem seam of the declaration read; production omits it. */
  readonly reader?: DependencyDeclarationReader;
  /** Manifest-load seam; production omits it and reads the memoized cache. */
  readonly loadManifest?: typeof loadMarketplaceManifest;
}

/** Inputs of one scope-wide index build, optionally excluding a named removal. */
export interface ScopeDeclarationIndexOptions extends ScopeDeclarationDetailOptions {
  /** A named removal is never indexed; a standalone sweep indexes every record. */
  readonly exclude?: string;
}

/**
 * The index and the walked records, or the first record whose declarations
 * could not be established (D-05-07). `cause.message` names the declarer and
 * says why it could not be read -- its marketplace does not list it, its
 * declaration is unusable, its marketplace manifest is missing, cannot be read,
 * or is invalid, or its own manifest is present but cannot be read. `reason`
 * is the same fault as a closed-set token. A row about the TARGET never
 * renders it: the declarer's read-failure token would make a false claim about
 * the target's own manifest (the row grammar's brace states a fact about the
 * row's subject). Only a row whose subject is the declarer does (REC-05).
 * `candidates` holds every indexed record (the excluded target omitted) in walk
 * order, enabled or disabled, whatever its provenance.
 */
export type ScopeDeclarationIndexResult =
  | {
      readonly ok: true;
      readonly index: DeclarationIndex;
      readonly candidates: readonly IndexedRecord[];
    }
  | {
      readonly ok: false;
      readonly declarer: string;
      readonly reason: DeclarerReadFailure;
      readonly cause: Error;
    };

export type IndexFailure = Extract<ScopeDeclarationIndexResult, { readonly ok: false }>;

/**
 * Every record's declarations with their constraints intact, keyed by the
 * declarer's `name@marketplace` key, or the first record whose declarations
 * could not be established (D-05-07). The failure arm is the index walk's, so
 * both walks fail closed in the same shape.
 */
export type ScopeDeclarationDetailResult =
  | {
      readonly ok: true;
      readonly declarations: ReadonlyMap<string, readonly AddressedDependency[]>;
    }
  | {
      readonly ok: false;
      readonly declarer: string;
      readonly reason: DeclarerReadFailure;
      readonly cause: Error;
    };

/** One record's declarations, or the failure that ends the walk. */
export type RecordDeclarations =
  { readonly ok: true; readonly declared: readonly AddressedDependency[] } | IndexFailure;

/**
 * The failure that names `key`. `phrase` is a fixed phrase or field path this
 * extension writes, never the text of a thrown error or of a file (T-05-04).
 */
function unreadableDeclarer(
  key: string,
  reason: DeclarerReadFailure,
  phrase: string,
): IndexFailure {
  return {
    ok: false,
    declarer: key,
    reason,
    cause: new Error(`cannot read the dependencies of ${key}: ${phrase}`),
  };
}

/**
 * D-04 / T-05-04: why a marketplace manifest failed to load, as a fixed phrase
 * picked by the error's class or errno code. The error's own message never
 * reaches the cause line.
 */
function manifestLoadPhrase(err: unknown): string {
  if (err instanceof InvalidMarketplaceManifestError) {
    return "its marketplace manifest is invalid";
  }

  const code = isErrnoException(err) ? err.code : undefined;
  return code === "ENOENT" || code === "ENOTDIR"
    ? "its marketplace manifest is missing"
    : "its marketplace manifest cannot be read";
}

/**
 * What one record declares, in the D-05-06 read order, with every declaration
 * addressed. A declaration naming no marketplace resolves in the declaring
 * record's own -- the same fill rule the closure walk applies -- so the keys
 * derived here compare exactly against the keys the callers ask about.
 *
 * Exported so a caller that needs ONE record's declarations (rather than the
 * whole scope's) can reuse the identical D-05-06 read order and fail-closed
 * shape without re-deriving it -- `enable-disable.ts`'s own per-key lazy
 * cascade lookup is the first such caller (WR-03).
 */
export async function readRecordDeclarations(
  options: ScopeDeclarationDetailOptions,
  marketplace: MarketplaceStateRecord,
  name: string,
): Promise<RecordDeclarations> {
  const key = `${name}@${marketplace.name}`;
  let manifest: Awaited<ReturnType<typeof loadMarketplaceManifest>>;
  try {
    manifest = await (options.loadManifest ?? loadMarketplaceManifest)(marketplace.manifestPath);
  } catch (err) {
    return unreadableDeclarer(key, narrowProbeError(err), manifestLoadPhrase(err));
  }

  const declared = lookupDeclaredPlugin(manifest, name);
  const read =
    declared.kind === "absent"
      ? await readInstalledCopy(options, marketplace, name)
      : await readDependencyDeclaration({
          marketplaceRoot: marketplace.marketplaceRoot,
          entry: declared.entry,
          locations: options.locations,
          ...(options.reader !== undefined && { reader: options.reader }),
          refuseUnusableOwnManifest: true,
        });
  if (read.kind === "absent") {
    return unreadableDeclarer(
      key,
      "not in manifest",
      "not declared by its marketplace, and its installed copy cannot be read",
    );
  }

  if (read.kind === "unusable") {
    return unreadableDeclarer(
      key,
      "ownManifest" in read ? "unreadable manifest" : "invalid manifest",
      read.detail,
    );
  }

  return {
    ok: true,
    declared: read.dependencies.map((dep) => ({
      ...dep,
      marketplace: dep.marketplace ?? marketplace.name,
    })),
  };
}

/**
 * DLS-01: a delisted record's declarations come from its installed copy, the
 * root its install recorded (`resolvedSource`), admitted only inside the
 * marketplace clone or the scope's `plugin-clones/` (NFR-10).
 */
function readInstalledCopy(
  options: ScopeDeclarationDetailOptions,
  marketplace: MarketplaceStateRecord,
  name: string,
): ReturnType<typeof readInstalledCopyDeclaration> {
  return readInstalledCopyDeclaration({
    pluginRoot: marketplace.plugins[name]?.resolvedSource ?? "",
    ownerRoots: [marketplace.marketplaceRoot, options.locations.pluginClonesDir],
    ...(options.reader !== undefined && { reader: options.reader }),
  });
}

/** The `name@marketplace` key one addressed declaration names. */
function declarationKey(dependency: AddressedDependency): string {
  return `${dependency.name}@${dependency.marketplace}`;
}

/**
 * Indexes every record in the scope except `exclude`, stopping at the FIRST
 * record whose declarations cannot be established.
 */
export async function buildScopeDeclarationIndex(
  options: ScopeDeclarationIndexOptions,
): Promise<ScopeDeclarationIndexResult> {
  const index = new Map<string, ReadonlySet<string>>();
  const candidates: IndexedRecord[] = [];
  for (const marketplace of Object.values(options.state.marketplaces)) {
    for (const [name, record] of Object.entries(marketplace.plugins)) {
      const key = `${name}@${marketplace.name}`;
      if (key === options.exclude) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- the first unreadable record stops the index
      const read = await readRecordDeclarations(options, marketplace, name);
      if (!read.ok) {
        return read;
      }

      index.set(key, new Set(read.declared.map(declarationKey)));
      candidates.push({ key, provenance: record.provenance, marketplace, plugin: name, record });
    }
  }

  return { ok: true, index, candidates };
}

/**
 * Maps every record in the scope to what it declares, constraints intact,
 * stopping at the FIRST record whose declarations cannot be established.
 */
export async function buildScopeDeclarationDetail(
  options: ScopeDeclarationDetailOptions,
): Promise<ScopeDeclarationDetailResult> {
  const declarations = new Map<string, readonly AddressedDependency[]>();
  for (const marketplace of Object.values(options.state.marketplaces)) {
    for (const name of Object.keys(marketplace.plugins)) {
      // eslint-disable-next-line no-await-in-loop -- the first unreadable record stops the index
      const read = await readRecordDeclarations(options, marketplace, name);
      if (!read.ok) {
        return read;
      }

      declarations.set(`${name}@${marketplace.name}`, read.declared);
    }
  }

  return { ok: true, declarations };
}

/**
 * UNI-01 / D-23-07: drops every holder the user or a config disabled. Claude
 * Code counts only enabled plugins as reverse dependents, so such a plugin
 * neither holds a named uninstall nor is named on its row. A record the
 * load-time check held down (`dependencyDisabled`) is still enabled in its
 * config, so it keeps holding, as Claude Code reads the settings. Shared by a
 * named uninstall and a layer `marketplace remove` (MPR-01).
 */
export function withoutDisabledHolders(
  index: DeclarationIndex,
  state: ExtensionState,
): DeclarationIndex {
  const disabled = new Set(
    Object.entries(state.marketplaces).flatMap(([marketplace, record]) =>
      Object.entries(record.plugins)
        .filter(([, plugin]) => isRecordedButDisabled(plugin) && plugin.dependencyDisabled !== true)
        .map(([name]) => `${name}@${marketplace}`),
    ),
  );
  return new Map([...index].filter(([holder]) => !disabled.has(holder)));
}

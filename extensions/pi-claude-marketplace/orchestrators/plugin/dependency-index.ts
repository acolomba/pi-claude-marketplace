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
// D-05-07: the walk FAILS CLOSED. The first record whose declarations cannot
// be established -- its marketplace manifest fails to load, that manifest does
// not list it, or its declaration parses as unusable -- ends the walk with a
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
// declarer's `name@marketplace` key and a field path, a fixed phrase, or a
// path-redacted message -- never an absolute path -- and it is built WITHOUT
// `{ cause }` chaining, so the renderer's cause-chain walk cannot print the
// raw underlying message behind it.
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
import { errorMessage } from "../../shared/errors.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";

import { readDependencyDeclaration } from "./dependency-declaration-read.ts";

import type { DependencyDeclarationReader } from "./dependency-declaration-read.ts";
import type { DeclaredDependency } from "../../domain/dependencies.ts";
import type { DeclarationIndex, OrphanCandidate } from "../../domain/dependency-orphans.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";

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

/** Inputs of one scope-wide index build: the same read, plus the exclusion. */
export interface ScopeDeclarationIndexOptions extends ScopeDeclarationDetailOptions {
  /** The `name@marketplace` key under decision; it is never indexed. */
  readonly exclude: string;
}

/**
 * The index and the walked records, or the first record whose declarations
 * could not be established (D-05-07). `cause.message` names the declarer and
 * says why it could not be read -- its marketplace does not list it, its
 * declaration is unusable, its marketplace manifest failed to load, or its own
 * manifest is present but cannot be read. No classified token rides along: the
 * row a caller renders is about the TARGET, and the declarer's read-failure
 * token would make a false claim about the target's own manifest (the row
 * grammar's brace states a fact about the row's subject). `candidates` holds
 * every indexed record (the excluded target omitted) in walk order, enabled or
 * disabled, whatever its provenance.
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
      readonly cause: Error;
    };

type IndexFailure = Extract<ScopeDeclarationIndexResult, { readonly ok: false }>;

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
      readonly cause: Error;
    };

/** One record's declarations, or the failure that ends the walk. */
type RecordDeclarations =
  { readonly ok: true; readonly declared: readonly AddressedDependency[] } | IndexFailure;

function unreadableDeclarer(key: string, detail: string): IndexFailure {
  return {
    ok: false,
    declarer: key,
    cause: new Error(`cannot read the dependencies of ${key}: ${detail}`),
  };
}

/**
 * What one record declares, in the D-05-06 read order, with every declaration
 * addressed. A declaration naming no marketplace resolves in the declaring
 * record's own -- the same fill rule the closure walk applies -- so the keys
 * derived here compare exactly against the keys the callers ask about.
 */
async function readRecordDeclarations(
  options: ScopeDeclarationDetailOptions,
  marketplace: MarketplaceStateRecord,
  name: string,
): Promise<RecordDeclarations> {
  const key = `${name}@${marketplace.name}`;
  let manifest: Awaited<ReturnType<typeof loadMarketplaceManifest>>;
  try {
    manifest = await (options.loadManifest ?? loadMarketplaceManifest)(marketplace.manifestPath);
  } catch (err: unknown) {
    return unreadableDeclarer(key, redactAbsolutePaths(errorMessage(err)));
  }

  const declared = lookupDeclaredPlugin(manifest, name);
  if (declared.kind === "absent") {
    return unreadableDeclarer(key, "not declared by its marketplace");
  }

  const read = await readDependencyDeclaration({
    marketplaceRoot: marketplace.marketplaceRoot,
    entry: declared.entry,
    locations: options.locations,
    ...(options.reader !== undefined && { reader: options.reader }),
    refuseUnusableOwnManifest: true,
  });
  if (read.kind === "unusable") {
    return unreadableDeclarer(key, read.detail);
  }

  return {
    ok: true,
    declared: read.dependencies.map((dep) => ({
      ...dep,
      marketplace: dep.marketplace ?? marketplace.name,
    })),
  };
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
      const read = await readRecordDeclarations(options, marketplace, name);
      if (!read.ok) {
        return read;
      }

      declarations.set(`${name}@${marketplace.name}`, read.declared);
    }
  }

  return { ok: true, declarations };
}

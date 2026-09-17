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
// The fallback is part of that read, not an exception to it: when the plugin's
// OWN manifest cannot be read -- absent, a cold git clone, or present but
// unusable -- its marketplace entry answers for it (D-05-06, D-01-07), and an
// entry that carries no `dependencies` key answers "declares nothing". The
// walk fails closed only where the entry cannot answer either. Tightening the
// guard to refuse on an unusable own manifest is a one-line predicate change
// that D-05-07 leaves open; it is not taken here.
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

import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { errorMessage } from "../../shared/errors.ts";
import { narrowProbeError } from "../../shared/probe-classifiers.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";

import { readDependencyDeclaration } from "./dependency-declaration-read.ts";

import type { DependencyDeclarationReader } from "./dependency-declaration-read.ts";
import type { DeclarationIndex, OrphanCandidate } from "../../domain/dependency-orphans.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ContentReason } from "../../shared/notification-types.ts";

type MarketplaceStateRecord = ExtensionState["marketplaces"][string];

/**
 * One walked record as the orphan sweep consumes it (D-05-10): the
 * `OrphanCandidate` view -- key and provenance -- plus the snapshot objects a
 * removal needs, so the orchestrator never walks the state a second time and
 * never looks a key back up. `marketplace` and `record` are the SAME objects
 * the locked snapshot holds; a removal mutates them in place.
 */
export interface IndexedRecord extends OrphanCandidate {
  readonly marketplace: ExtensionState["marketplaces"][string];
  readonly plugin: string;
  readonly record: ExtensionState["marketplaces"][string]["plugins"][string];
}

/** Inputs of one scope-wide index build. */
export interface ScopeDeclarationIndexOptions {
  /** The locked snapshot of the target scope's state document. */
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  /** The `name@marketplace` key under decision; it is never indexed. */
  readonly exclude: string;
  /** Filesystem seam of the declaration read; production omits it. */
  readonly reader?: DependencyDeclarationReader;
  /** Manifest-load seam; production omits it and reads the memoized cache. */
  readonly loadManifest?: typeof loadMarketplaceManifest;
}

/**
 * The index and the walked records, or the first record whose declarations
 * could not be established (D-05-07). `reason` is the DECLARER's read-failure
 * token -- `not in manifest` for an entry its marketplace does not list,
 * `invalid manifest` for an unusable declaration, or the probe classifier's
 * token for a manifest that failed to load -- and `cause.message` names the
 * declarer. `candidates` holds every indexed record (the excluded target
 * omitted) in walk order, enabled or disabled, whatever its provenance.
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
      readonly reason: ContentReason;
      readonly cause: Error;
    };

type IndexFailure = Extract<ScopeDeclarationIndexResult, { readonly ok: false }>;

/** One record's declared key set, or the failure that ends the walk. */
type RecordDeclarations =
  { readonly ok: true; readonly declared: ReadonlySet<string> } | IndexFailure;

function unreadableDeclarer(key: string, reason: ContentReason, detail: string): IndexFailure {
  return {
    ok: false,
    declarer: key,
    reason,
    cause: new Error(`cannot read the dependencies of ${key}: ${detail}`),
  };
}

/**
 * What one record declares, in the D-05-06 read order, as filled-in keys. A
 * declaration naming no marketplace resolves in the declaring record's own --
 * the same fill rule the closure walk applies -- so the keys here compare
 * exactly against the keys the callers ask about.
 */
async function readRecordDeclarations(
  options: ScopeDeclarationIndexOptions,
  marketplace: MarketplaceStateRecord,
  name: string,
): Promise<RecordDeclarations> {
  const key = `${name}@${marketplace.name}`;
  let manifest: Awaited<ReturnType<typeof loadMarketplaceManifest>>;
  try {
    manifest = await (options.loadManifest ?? loadMarketplaceManifest)(marketplace.manifestPath);
  } catch (err: unknown) {
    return unreadableDeclarer(key, narrowProbeError(err), redactAbsolutePaths(errorMessage(err)));
  }

  const declared = lookupDeclaredPlugin(manifest, name);
  if (declared.kind === "absent") {
    return unreadableDeclarer(key, "not in manifest", "not declared by its marketplace");
  }

  const read = await readDependencyDeclaration({
    marketplaceRoot: marketplace.marketplaceRoot,
    entry: declared.entry,
    locations: options.locations,
    ...(options.reader !== undefined && { reader: options.reader }),
  });
  if (read.kind === "unusable") {
    return unreadableDeclarer(key, "invalid manifest", read.detail);
  }

  return {
    ok: true,
    declared: new Set(
      read.dependencies.map((dep) => `${dep.name}@${dep.marketplace ?? marketplace.name}`),
    ),
  };
}

/**
 * Index every record in the scope except `exclude`, stopping at the FIRST
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

      index.set(key, read.declared);
      candidates.push({ key, provenance: record.provenance, marketplace, plugin: name, record });
    }
  }

  return { ok: true, index, candidates };
}

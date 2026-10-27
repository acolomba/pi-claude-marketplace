// orchestrators/plugin/dependency-declaration-read.ts
//
// One question, one answer: what dependencies does this plugin declare?
//
// D-01-32 fixes the read ORDER. The plugin's OWN manifest outranks the
// marketplace entry wherever that manifest is readable without a network call;
// the entry is the fallback, not the other way round. A readable manifest is
// AUTHORITATIVE even where it declares nothing -- an absent `dependencies` key
// means the plugin declares no dependencies, and the entry's list does not
// reappear behind it.
//
// NFR-5: the read reaches the filesystem and the warm clone cache only. There
// is no materializing path here at all. A git source yields a plugin root only
// from the fs-only presence probe's `materialized` arm, and no option reaches a
// fetch. The install owners that drive this read are gated by BLOCK F in
// `eslint.config.js` (neither is in `NETWORK_SEAMS`), and routing the read
// through this module is what keeps them gated.
//
// The deliberate consequence, stated rather than left to be discovered: a
// git-source dependency whose clone is not materialized yet has no readable
// manifest at closure time, so its marketplace entry answers for it. That is
// the price of keeping the read offline, and it is the same shape the
// read-only surfaces already accept for this field.
//
// D-01-06 / D-01-07: the candidate walk is over the SHARED manifest ordering,
// and it falls through on ABSENCE ONLY. The first candidate that EXISTS is this
// plugin's manifest, and a candidate that exists but cannot be used ends the
// walk as unusable rather than handing off to its sibling. What happens to a
// present-but-unusable manifest is the caller's rule: the install cascade lets
// the entry answer for it (D-01-07), and the dependents index opts into
// refusing it through `refuseUnusableOwnManifest` (D-05-07). Under neither
// rule is it read as a plugin that declares nothing -- that distinction is
// what stops a truncated or corrupted manifest from silently suppressing a
// dependency the plugin really declares.
//
// NFR-10: a path source derives its root through `path.resolve` +
// `assertPathInside`, and that re-check IS the containment guarantee for the
// read. The derivation THROWS on a refusal and the throw is caught here as "no
// root", because a path this module may not read is precisely the condition the
// entry fallback covers. The catch is deliberately TOTAL rather than
// `PathContainmentError`-only: `assertPathInside` also lstats each path
// component, so a source string the operating system rejects outright (an
// interior NUL byte) throws a plain `TypeError` from the syscall layer instead.
// Neither failure is this module's to classify; all it decides is whether a
// manifest can be opened.

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { parseDeclaredDependencies } from "../../domain/dependencies.ts";
import { toClosureLookupResult } from "../../domain/dependency-closure.ts";
import {
  copyManifestBoundary,
  inPlaceManifestBoundary,
  isAbsenceError,
  locateManifestCandidate,
  sourceManifestBoundary,
} from "../../domain/manifest-containment.ts";
import { MANIFEST_CANDIDATES } from "../../domain/manifest-path.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { isErrnoException } from "../../shared/errors.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import { makePresenceProbe } from "./git-source-probe.ts";

import type { DeclarationLookupResult } from "../../domain/dependency-closure.ts";
import type { ManifestBoundary } from "../../domain/manifest-containment.ts";
import type { ManifestPluginEntry } from "../../domain/manifest-lookup.ts";
import type { GitPluginRootResult } from "../../domain/resolver-types.ts";
import type { GitBackedSource, PathSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";

/**
 * The filesystem authority this read needs, as one injectable seam. It mirrors
 * the reader the plugin-info surface already uses for the same two operations
 * rather than inventing a different shape, and adds the fs-only presence probe
 * because clone PRESENCE is a filesystem question here too.
 *
 * `makePresenceProbe` is the whole git story: it is the only clone-facing
 * operation in this module, and it never clones, fetches or spawns git.
 */
export interface DependencyDeclarationReader {
  /** Follows symlinks; true only for a regular file. */
  readonly isRegularFile: (filePath: string) => Promise<boolean>;
  readonly readTextFile: (filePath: string) => Promise<string>;
  readonly makePresenceProbe: typeof makePresenceProbe;
}

/** Inputs of one declaration read. */
export interface DependencyDeclarationReadOptions {
  /** The root of the marketplace clone whose manifest declares this plugin. */
  readonly marketplaceRoot: string;
  /**
   * The already-loaded marketplace entry. Its `source` decides which directory
   * is opened, and its `dependencies` value is the fallback answer.
   */
  readonly entry: ManifestPluginEntry;
  /**
   * The TARGET scope's locations -- the scope every cascade member installs
   * into (D-03-05), and therefore the scope whose clone cache is probed.
   */
  readonly locations: ScopedLocations;
  /** Filesystem seam; production omits it and reads real disk. */
  readonly reader?: DependencyDeclarationReader;
  /**
   * D-05-07: the dependents index sets this so a present-but-unusable own
   * manifest is answered as the `unusable` arm instead of by the entry. The
   * install cascade omits it and keeps the D-01-07 entry fallback.
   */
  readonly refuseUnusableOwnManifest?: true;
}

/**
 * D-05-07 / REC-05: the `unusable` arm a refused own manifest answers. The
 * `ownManifest` discriminant tells it from a declaration the parser rejected,
 * so a caller can name the fault without reading `detail`.
 */
export interface OwnManifestRefusal {
  readonly kind: "unusable";
  readonly detail: string;
  readonly ownManifest: true;
}

async function isRegularFile(filePath: string): Promise<boolean> {
  return (await stat(filePath)).isFile();
}

/**
 * Named at module scope rather than written as an inline parameter default, so
 * every call that omits `reader` reads this one frozen object instead of
 * allocating a fresh literal per invocation (typescript:S7737).
 */
const REAL_DEPENDENCY_DECLARATION_READER: DependencyDeclarationReader = Object.freeze({
  isRegularFile,
  readTextFile: (filePath: string) => readFile(filePath, "utf8"),
  makePresenceProbe,
});

/**
 * What the plugin's OWN manifest declares (`readable`), or why it does not:
 * no candidate exists under a root this module may open (`absent`), or a
 * candidate exists but cannot be used (`unusable`).
 *
 * The value stays `unknown` because the manifest schema keeps the field opaque
 * -- every question about which elements are usable belongs to
 * `parseDeclaredDependencies`, exactly as it does for the entry's copy.
 */
type OwnManifestRead =
  | { readonly kind: "readable"; readonly dependencies: unknown }
  | { readonly kind: "absent" }
  | { readonly kind: "unusable" };

const ABSENT: OwnManifestRead = { kind: "absent" };
const UNUSABLE: OwnManifestRead = { kind: "unusable" };

// T-05-04: a fixed phrase -- no path, no manifest text, no chained cause.
const OWN_MANIFEST_REFUSAL: OwnManifestRefusal = {
  kind: "unusable",
  detail: "its own manifest is present but cannot be read",
  ownManifest: true,
};

/**
 * A locally resolvable source's root, or `undefined` where containment refuses
 * it. The refusal is a read this module may not perform, which is exactly what
 * the entry fallback covers.
 */
async function derivePathPluginRoot(
  marketplaceRoot: string,
  source: PathSource,
): Promise<ManifestBoundary | undefined> {
  try {
    const pluginRoot = path.resolve(marketplaceRoot, source.raw);
    await assertPathInside(marketplaceRoot, pluginRoot, `dependency source for "${source.raw}"`);
    return inPlaceManifestBoundary(pluginRoot, marketplaceRoot);
  } catch {
    return undefined;
  }
}

/**
 * A git source's root, from the WARM clone cache only. `not-cached`, `escapes`
 * and `missing-subdir` each mean there is no local tree to read, and a probe
 * throw -- a mirror that exists but whose `.git/HEAD` is corrupt or being
 * rewritten -- folds to the same answer rather than failing the cascade.
 */
async function probeGitPluginRoot(
  reader: DependencyDeclarationReader,
  locations: ScopedLocations,
  source: GitBackedSource,
): Promise<ManifestBoundary | undefined> {
  let presence: GitPluginRootResult;
  try {
    presence = await reader.makePresenceProbe(locations)(source);
  } catch {
    return undefined;
  }

  return presence.kind === "materialized" ? copyManifestBoundary(presence.pluginRoot) : undefined;
}

/**
 * The manifest boundary of the plugin root this read may open, WITHOUT a
 * network call (D-PL2-17): a path source is read in place from its
 * marketplace tree, and a warm git clone is a copy. The exhaustive switch
 * keeps a future source kind a compile error rather than silently routing it
 * at one of the arms below.
 */
async function resolvePluginRootFsOnly(
  reader: DependencyDeclarationReader,
  options: DependencyDeclarationReadOptions,
): Promise<ManifestBoundary | undefined> {
  const source = parsePluginSource(options.entry.source);
  switch (source.kind) {
    case "path":
      return derivePathPluginRoot(options.marketplaceRoot, source);
    case "url":
    case "git-subdir":
    case "github":
      return probeGitPluginRoot(reader, options.locations, source);
    case "npm":
    case "unknown":
      return undefined;
  }
}

/**
 * Parses one candidate's bytes into the `dependencies` value it declares. A
 * parse throw, or a payload that is not a JSON object, is a
 * present-but-unusable manifest and reads as the `unusable` arm.
 */
function parseOwnManifest(raw: string): OwnManifestRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return UNUSABLE;
  }

  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? { kind: "readable", dependencies: (parsed as Record<string, unknown>).dependencies }
    : UNUSABLE;
}

/**
 * Reads ONE candidate. `undefined` means ABSENT and is the only answer the walk
 * may continue past; every other answer ENDS the walk (D-01-07).
 *
 * Stat precedes the read so a device node or a FIFO planted at a candidate path
 * cannot supply unbounded bytes or block the install. ENOENT and ENOTDIR mean
 * absence, as does a candidate that is not a regular file; every other failure
 * is a present-but-unusable manifest.
 */
async function readManifestCandidate(
  reader: DependencyDeclarationReader,
  absPath: string,
): Promise<OwnManifestRead | undefined> {
  let raw: string;
  try {
    if (!(await reader.isRegularFile(absPath))) {
      return undefined;
    }

    raw = await reader.readTextFile(absPath);
  } catch (err) {
    return isAbsenceError(err) ? undefined : UNUSABLE;
  }

  return parseOwnManifest(raw);
}

/**
 * D-PL2-24 / D-PL2-17: one candidate, located inside `boundary` before it is
 * read. A link whose target leaves the boundary, or that cannot be resolved,
 * is a present-but-unusable manifest and ends the walk (D-01-07); a dangling
 * link is no manifest.
 */
async function readBoundedCandidate(
  reader: DependencyDeclarationReader,
  boundary: ManifestBoundary,
  candidatePath: string,
): Promise<OwnManifestRead | undefined> {
  const location = await locateManifestCandidate(boundary, candidatePath);
  switch (location.kind) {
    case "open":
      return readManifestCandidate(reader, location.path);
    case "absent":
      return undefined;
    case "escapes":
    case "unresolvable":
      return UNUSABLE;
  }
}

/** Walks the shared candidate ordering under the boundary's plugin root (D-PL2-24). */
async function readOwnManifest(
  reader: DependencyDeclarationReader,
  boundary: ManifestBoundary,
): Promise<OwnManifestRead> {
  for (const candidate of MANIFEST_CANDIDATES) {
    // eslint-disable-next-line no-await-in-loop -- the first existing manifest candidate decides the read
    const read = await readBoundedCandidate(
      reader,
      boundary,
      path.join(boundary.pluginRoot, candidate),
    );
    if (read !== undefined) {
      return read;
    }
  }

  return ABSENT;
}

/**
 * What this plugin declares, in the D-01-32 read order, mapped onto the closure
 * walk's catalog-read contract: a successful parse is the found arm, a
 * rejection is the unusable arm carrying the parser's reason.
 *
 * RESV-01 / RESV-02: this is the cascade's catalog read, so a dependency
 * declared ONLY in a plugin's own bare manifest reaches the closure exactly
 * like one declared in the marketplace entry.
 *
 * D-05-07: under `refuseUnusableOwnManifest`, a present-but-unusable own
 * manifest is the unusable arm with a fixed detail, and the entry never
 * answers for it.
 *
 * D-PL2-24 / D-PL2-17: a manifest link that leaves the plugin's boundary, or
 * cannot be resolved, is such a present-but-unusable manifest. The boundary is
 * the plugin and marketplace directories for a path source, and the plugin
 * directory for a warm git clone.
 */
export async function readDependencyDeclaration(
  options: DependencyDeclarationReadOptions,
): Promise<DeclarationLookupResult | OwnManifestRefusal> {
  const reader = options.reader ?? REAL_DEPENDENCY_DECLARATION_READER;
  const boundary = await resolvePluginRootFsOnly(reader, options);
  const own = boundary === undefined ? ABSENT : await readOwnManifest(reader, boundary);
  if (own.kind === "unusable" && options.refuseUnusableOwnManifest !== undefined) {
    return OWN_MANIFEST_REFUSAL;
  }

  // A readable manifest wins outright, INCLUDING when its `dependencies` key is
  // absent: that means the plugin declares nothing, not that the entry's list
  // should reappear behind it.
  const declared = own.kind === "readable" ? own.dependencies : options.entry.dependencies;
  return toClosureLookupResult(parseDeclaredDependencies(declared));
}

/**
 * UPD-DEP-D1: what a version an update resolved declares, read from the tree
 * the update lands -- a release tag's copy when a range chose one -- in the
 * D-01-32 order: the tree's own manifest, else the marketplace entry. The
 * catalog read reads the marketplace's head, which can be another version.
 *
 * D-PL2-24 / D-PL2-17: the manifest is read inside the boundary the candidate
 * tree was resolved with: a copy for a git candidate or a tag-pinned one, else
 * in place with its marketplace root. A link that leaves it, or cannot be resolved, is a
 * present-but-unusable manifest, so the entry answers (D-01-07). The update's
 * resolver has already refused such a tree; this read is defence in depth.
 */
export async function readCandidateDeclaration(options: {
  /** The resolved candidate's plugin root. */
  readonly pluginRoot: string;
  readonly entry: ManifestPluginEntry;
  /**
   * The marketplace record the candidate is offered by, which bounds a `path`
   * tree read in place; a candidate with none is read as a copy.
   */
  readonly marketplace: { readonly marketplaceRoot: string } | undefined;
  /** The release tag a range pinned the candidate to, which makes a `path` tree a copy. */
  readonly pin: string | undefined;
  /** Filesystem seam; production omits it and reads real disk. */
  readonly reader?: DependencyDeclarationReader;
}): Promise<DeclarationLookupResult> {
  const reader = options.reader ?? REAL_DEPENDENCY_DECLARATION_READER;
  const boundary =
    options.marketplace === undefined
      ? copyManifestBoundary(options.pluginRoot)
      : sourceManifestBoundary(
          options.entry.source,
          options.pluginRoot,
          options.marketplace.marketplaceRoot,
          options.pin,
        );
  const own = await readOwnManifest(reader, boundary);
  const declared = own.kind === "readable" ? own.dependencies : options.entry.dependencies;
  return toClosureLookupResult(parseDeclaredDependencies(declared));
}

/**
 * NFR-10 / D-PL2-17: how to read a record's installed copy. A record with
 * `resolvedSha` installed a per-commit clone under `plugin-clones/` -- every
 * git source, and a tag-pinned path-source dependency -- so its copy is
 * bounded by its plugin directory, as Claude Code bounds a cached copy. One
 * without it runs the marketplace clone's files in place, bounded by its
 * plugin and marketplace directories.
 *
 * D-PL2-12: the owning root is the one clone root the copy must sit in. Records
 * carry no source kind, and a delisted git record no longer has the catalog
 * source its clone key hashes, so the whole `plugin-clones/` is the narrowest
 * root a per-commit copy can be given.
 */
export function installedCopyReadOptions(
  record: { readonly resolvedSource: string; readonly resolvedSha?: string },
  roots: { readonly marketplaceRoot: string; readonly pluginClonesDir: string },
): Pick<InstalledCopyDeclarationReadOptions, "boundary" | "ownerRoot"> {
  return record.resolvedSha === undefined
    ? {
        boundary: inPlaceManifestBoundary(record.resolvedSource, roots.marketplaceRoot),
        ownerRoot: roots.marketplaceRoot,
      }
    : { boundary: copyManifestBoundary(record.resolvedSource), ownerRoot: roots.pluginClonesDir };
}

/** Inputs of one read of an installed copy. */
export interface InstalledCopyDeclarationReadOptions {
  /** The boundary of the record's `resolvedSource`, the plugin root its install materialized. */
  readonly boundary: ManifestBoundary;
  /**
   * NFR-10 / D-PL2-12: the one clone root that owns the record. A copy
   * anywhere else is never opened.
   */
  readonly ownerRoot: string;
  /** Filesystem seam; production omits it and reads real disk. */
  readonly reader?: DependencyDeclarationReader;
}

/** No installed copy this read may open, or no manifest in it. */
export interface InstalledCopyAbsent {
  readonly kind: "absent";
}

/**
 * NFR-10 / D-PL2-12: whether the copy root sits under its owning root. An
 * ENOTDIR from the lstat walk admits it, because the read itself answers that
 * as absence (WR-03); a containment refusal and every other fault of the walk
 * do not.
 */
async function copyRootAdmitted(ownerRoot: string, pluginRoot: string): Promise<boolean> {
  try {
    await assertPathInside(ownerRoot, pluginRoot, "installed plugin copy");
    return true;
  } catch (err) {
    return isErrnoException(err) && err.code === "ENOTDIR";
  }
}

/**
 * DLS-01 / DLS-D1: what an installed plugin declares, read from the copy on
 * disk -- the version actually installed. Pi keeps a plugin its marketplace no
 * longer lists running, so it keeps the dependencies it runs with. There is no
 * entry to fall back on: a copy with no manifest, or a missing copy, answers
 * `absent`, and the caller decides what that means.
 *
 * D-PL2-17: each manifest candidate is read inside the record's boundary from
 * `installedCopyReadOptions`, which is Claude Code's boundary, not the owning
 * root. A link that resolves inside it is read at its target; a dangling link
 * is no manifest. A link that leaves it or cannot be resolved, a
 * present-but-unusable manifest, a copy whose containment check cannot inspect
 * a path segment, and a recorded root outside the owning root (D-PL2-12) all
 * answer the same refusal `refuseUnusableOwnManifest` gives.
 */
export async function readInstalledCopyDeclaration(
  options: InstalledCopyDeclarationReadOptions,
): Promise<DeclarationLookupResult | OwnManifestRefusal | InstalledCopyAbsent> {
  const reader = options.reader ?? REAL_DEPENDENCY_DECLARATION_READER;
  const own = (await copyRootAdmitted(options.ownerRoot, options.boundary.pluginRoot))
    ? await readOwnManifest(reader, options.boundary)
    : UNUSABLE;
  switch (own.kind) {
    case "absent":
      return { kind: "absent" };
    case "unusable":
      return OWN_MANIFEST_REFUSAL;
    case "readable":
      return toClosureLookupResult(parseDeclaredDependencies(own.dependencies));
  }
}

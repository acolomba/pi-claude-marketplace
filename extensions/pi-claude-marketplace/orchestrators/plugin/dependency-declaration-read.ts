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

import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { parseDeclaredDependencies } from "../../domain/dependencies.ts";
import { toClosureLookupResult } from "../../domain/dependency-closure.ts";
import {
  copyManifestBoundary,
  inPlaceManifestBoundary,
  isAbsenceError,
  locateManifestCandidate,
} from "../../domain/manifest-containment.ts";
import { MANIFEST_CANDIDATES } from "../../domain/manifest-path.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { isErrnoException } from "../../shared/errors.ts";
import { assertPathInside, PathContainmentError } from "../../shared/path-safety.ts";

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

/** Walks the shared candidate ordering under one plugin root, each read by `readCandidate`. */
async function readOwnManifest(
  reader: DependencyDeclarationReader,
  pluginRoot: string,
  readCandidate: (absPath: string) => Promise<OwnManifestRead | undefined> = (absPath) =>
    readManifestCandidate(reader, absPath),
): Promise<OwnManifestRead> {
  for (const candidate of MANIFEST_CANDIDATES) {
    // eslint-disable-next-line no-await-in-loop -- the first existing manifest candidate decides the read
    const read = await readCandidate(path.join(pluginRoot, candidate));
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
  const own =
    boundary === undefined
      ? ABSENT
      : await readOwnManifest(reader, boundary.pluginRoot, (absPath) =>
          readBoundedCandidate(reader, boundary, absPath),
        );
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
 */
export async function readCandidateDeclaration(options: {
  /** The resolved candidate's plugin root. */
  readonly pluginRoot: string;
  readonly entry: ManifestPluginEntry;
  /** Filesystem seam; production omits it and reads real disk. */
  readonly reader?: DependencyDeclarationReader;
}): Promise<DeclarationLookupResult> {
  const reader = options.reader ?? REAL_DEPENDENCY_DECLARATION_READER;
  const own = await readOwnManifest(reader, options.pluginRoot);
  const declared = own.kind === "readable" ? own.dependencies : options.entry.dependencies;
  return toClosureLookupResult(parseDeclaredDependencies(declared));
}

/**
 * NFR-10 / D-PL2-12: the one clone root that owns a record's installed copy. A
 * record with `resolvedSha` installed a per-commit clone under `plugin-clones/`
 * -- every git source, and a tag-pinned path-source dependency -- and one
 * without it runs the marketplace clone's files. Records carry no source kind,
 * and a delisted git record no longer has the catalog source its clone key
 * hashes, so the whole `plugin-clones/` is the narrowest root it can be given.
 */
export function installedCopyOwnerRoot(
  record: { readonly resolvedSha?: string },
  roots: { readonly marketplaceRoot: string; readonly pluginClonesDir: string },
): string {
  return record.resolvedSha === undefined ? roots.marketplaceRoot : roots.pluginClonesDir;
}

/** Inputs of one read of an installed copy. */
export interface InstalledCopyDeclarationReadOptions {
  /** The record's `resolvedSource`: the plugin root its install materialized. */
  readonly pluginRoot: string;
  /**
   * NFR-10 / D-PL2-12: the one clone root that owns the record, from
   * `installedCopyOwnerRoot`. A copy anywhere else is never opened.
   */
  readonly ownerRoot: string;
  /** Filesystem seam; production omits it and reads real disk. */
  readonly reader?: DependencyDeclarationReader;
}

/** No installed copy this read may open, or no manifest in it. */
export interface InstalledCopyAbsent {
  readonly kind: "absent";
}

/** What `assertPathInside` answers for `child` under `parent`. */
type Containment = "admitted" | "refused" | "unusable";

/**
 * WR-03: only a containment refusal (a symlink, a traversal, a path outside)
 * is `refused`. An ENOTDIR from its lstat walk is `admitted`, because the read
 * itself answers it as absence, and every other fault of the walk (EACCES,
 * EIO) is `unusable`, so the read fails closed (D-05-07).
 */
async function containment(parent: string, child: string, label: string): Promise<Containment> {
  try {
    await assertPathInside(parent, child, label);
    return "admitted";
  } catch (err) {
    if (err instanceof PathContainmentError) {
      return "refused";
    }

    return isErrnoException(err) && err.code === "ENOTDIR" ? "admitted" : "unusable";
  }
}

/** The read a copy-root check that did not admit the copy answers (D-PL2-12). */
const NOT_ADMITTED: Readonly<Record<Exclude<Containment, "admitted">, OwnManifestRead>> = {
  refused: ABSENT,
  unusable: UNUSABLE,
};

/**
 * D-PL2-13 / D-PL2-17: a manifest candidate reached through a symlink, read
 * only when its fully resolved target stays inside the record's owning root.
 *
 * Both paths are resolved, so an owning root under a linked ancestor still
 * contains its own files. A resolution that fails as absence (a dangling link,
 * or a target path that runs through a regular file) is no manifest, and the
 * walk goes on. Any other failure (a loop, EACCES) and a target outside the
 * owning root answer `unusable`.
 *
 * The read opens the resolved target, never the spelled link, so swapping the
 * link after the check cannot redirect it. The containment walk over the
 * target refuses a link planted on it before the walk. The window between the
 * walk and the open is the one `createPathSafetyGuard` documents.
 */
async function readLinkedCandidate(
  reader: DependencyDeclarationReader,
  ownerRoot: string,
  candidate: string,
): Promise<OwnManifestRead | undefined> {
  let realOwnerRoot: string;
  let target: string;
  try {
    realOwnerRoot = await realpath(ownerRoot);
    target = await realpath(candidate);
  } catch (err) {
    return isAbsenceError(err) ? undefined : UNUSABLE;
  }

  const answer = await containment(realOwnerRoot, target, "installed plugin manifest target");
  return answer === "admitted" ? readManifestCandidate(reader, target) : UNUSABLE;
}

/**
 * NFR-10: one manifest candidate of an installed copy. A candidate with no
 * symlink from the copy's root down to it is read in place. One reached
 * through a symlink is read from its resolved target when that target stays
 * inside the owning root (D-PL2-13), and is refused as `unusable` when it
 * leaves it (D-PL2-17), which ends the walk (D-01-07).
 *
 * The boundary is the owning root, by decision. Claude Code uses the plugin
 * directory for a cached copy, and the plugin and marketplace directories for
 * a plugin it loads in place.
 */
async function readContainedCandidate(
  reader: DependencyDeclarationReader,
  ownerRoot: string,
  pluginRoot: string,
  absPath: string,
): Promise<OwnManifestRead | undefined> {
  const answer = await containment(pluginRoot, absPath, "installed plugin manifest");
  switch (answer) {
    case "admitted":
      return readManifestCandidate(reader, absPath);
    case "refused":
      return readLinkedCandidate(reader, ownerRoot, absPath);
    case "unusable":
      return UNUSABLE;
  }
}

/**
 * DLS-01 / DLS-D1: what an installed plugin declares, read from the copy on
 * disk -- the version actually installed. Pi keeps a plugin its marketplace no
 * longer lists running, so it keeps the dependencies it runs with. There is no
 * entry to fall back on: a copy with no manifest, a missing copy, or a
 * recorded root outside the record's owning clone root (NFR-10, D-PL2-12)
 * answers `absent`, and the caller decides what that means.
 *
 * A manifest reached through a symlink is read from its resolved target when
 * that target stays inside the owning root (D-PL2-13). One that leaves it or
 * cannot be resolved (D-PL2-17), a present-but-unusable manifest, and a copy
 * whose containment check cannot inspect a path segment all answer the same
 * refusal `refuseUnusableOwnManifest` gives.
 */
export async function readInstalledCopyDeclaration(
  options: InstalledCopyDeclarationReadOptions,
): Promise<DeclarationLookupResult | OwnManifestRefusal | InstalledCopyAbsent> {
  const reader = options.reader ?? REAL_DEPENDENCY_DECLARATION_READER;
  const { pluginRoot } = options;
  const copy = await containment(options.ownerRoot, pluginRoot, "installed plugin copy");
  const own =
    copy === "admitted"
      ? await readOwnManifest(reader, pluginRoot, (absPath) =>
          readContainedCandidate(reader, options.ownerRoot, pluginRoot, absPath),
        )
      : NOT_ADMITTED[copy];
  switch (own.kind) {
    case "absent":
      return { kind: "absent" };
    case "unusable":
      return OWN_MANIFEST_REFUSAL;
    case "readable":
      return toClosureLookupResult(parseDeclaredDependencies(own.dependencies));
  }
}

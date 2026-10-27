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
import { MANIFEST_CANDIDATES } from "../../domain/manifest-path.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { isErrnoException } from "../../shared/errors.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import { makePresenceProbe } from "./git-source-probe.ts";

import type { DeclarationLookupResult } from "../../domain/dependency-closure.ts";
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
): Promise<string | undefined> {
  try {
    const pluginRoot = path.resolve(marketplaceRoot, source.raw);
    await assertPathInside(marketplaceRoot, pluginRoot, `dependency source for "${source.raw}"`);
    return pluginRoot;
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
): Promise<string | undefined> {
  let presence: GitPluginRootResult;
  try {
    presence = await reader.makePresenceProbe(locations)(source);
  } catch {
    return undefined;
  }

  return presence.kind === "materialized" ? presence.pluginRoot : undefined;
}

/**
 * The plugin root this read may open, WITHOUT a network call. The exhaustive
 * switch keeps a future source kind a compile error rather than silently
 * routing it at one of the arms below.
 */
async function resolvePluginRootFsOnly(
  reader: DependencyDeclarationReader,
  options: DependencyDeclarationReadOptions,
): Promise<string | undefined> {
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
    const code = isErrnoException(err) ? err.code : undefined;
    return code === "ENOENT" || code === "ENOTDIR" ? undefined : UNUSABLE;
  }

  return parseOwnManifest(raw);
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
 */
export async function readDependencyDeclaration(
  options: DependencyDeclarationReadOptions,
): Promise<DeclarationLookupResult | OwnManifestRefusal> {
  const reader = options.reader ?? REAL_DEPENDENCY_DECLARATION_READER;
  const pluginRoot = await resolvePluginRootFsOnly(reader, options);
  const own = pluginRoot === undefined ? ABSENT : await readOwnManifest(reader, pluginRoot);
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

/** Whether `assertPathInside` admits `child` under `parent`. */
async function isAdmitted(parent: string, child: string, label: string): Promise<boolean> {
  try {
    await assertPathInside(parent, child, label);
    return true;
  } catch {
    return false;
  }
}

/**
 * D-PL2-13 / NFR-10: one manifest candidate of an installed copy, opened only
 * when no segment from the copy's root down to it is a symlink. A refused
 * candidate ends the walk as `absent` rather than handing off to the next one,
 * because the first candidate that exists decides the read (D-01-07), and a
 * read this module may not perform is "no manifest" (the `derivePathPluginRoot`
 * convention). Claude Code follows a manifest symlink whose real path stays
 * inside the plugin directory; this read is stricter, as decided.
 */
async function readContainedCandidate(
  reader: DependencyDeclarationReader,
  pluginRoot: string,
  absPath: string,
): Promise<OwnManifestRead | undefined> {
  return (await isAdmitted(pluginRoot, absPath, "installed plugin manifest"))
    ? readManifestCandidate(reader, absPath)
    : ABSENT;
}

/**
 * DLS-01 / DLS-D1: what an installed plugin declares, read from the copy on
 * disk -- the version actually installed. Pi keeps a plugin its marketplace no
 * longer lists running, so it keeps the dependencies it runs with. There is no
 * entry to fall back on: a copy with no manifest, a missing copy, a recorded
 * root outside the record's owning clone root (NFR-10, D-PL2-12), or a
 * manifest reached through a symlink (D-PL2-13) answers `absent`, and the
 * caller decides what that means. A present-but-unusable manifest is the same
 * refusal `refuseUnusableOwnManifest` gives.
 */
export async function readInstalledCopyDeclaration(
  options: InstalledCopyDeclarationReadOptions,
): Promise<DeclarationLookupResult | OwnManifestRefusal | InstalledCopyAbsent> {
  const reader = options.reader ?? REAL_DEPENDENCY_DECLARATION_READER;
  const { pluginRoot } = options;
  const own = (await isAdmitted(options.ownerRoot, pluginRoot, "installed plugin copy"))
    ? await readOwnManifest(reader, pluginRoot, (absPath) =>
        readContainedCandidate(reader, pluginRoot, absPath),
      )
    : ABSENT;
  switch (own.kind) {
    case "absent":
      return { kind: "absent" };
    case "unusable":
      return OWN_MANIFEST_REFUSAL;
    case "readable":
      return toClosureLookupResult(parseDeclaredDependencies(own.dependencies));
  }
}

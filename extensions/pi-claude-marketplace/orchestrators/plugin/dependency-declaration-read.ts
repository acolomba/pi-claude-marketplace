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
// fetch. The install owners that drive this read are pinned by name in the
// no-orchestrator-network gate, and routing the read through this module is
// what keeps them there.
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
// walk as not-readable rather than handing off to its sibling. A
// present-but-unusable manifest therefore falls back to the entry and is NEVER
// read as a plugin that declares nothing -- that distinction is what stops a
// truncated or corrupted manifest from silently suppressing a dependency the
// plugin really declares.
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
 * What the plugin's OWN manifest declares, or the fact that none was readable.
 *
 * The value stays `unknown` because the manifest schema keeps the field opaque
 * -- every question about which elements are usable belongs to
 * `parseDeclaredDependencies`, exactly as it does for the entry's copy.
 */
type OwnManifestRead =
  { readonly kind: "readable"; readonly dependencies: unknown } | { readonly kind: "not-readable" };

const NOT_READABLE: OwnManifestRead = { kind: "not-readable" };

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
 * Parse one candidate's bytes into the `dependencies` value it declares. A
 * parse throw, or a payload that is not a JSON object, is a
 * present-but-unusable manifest and reads as not-readable.
 */
function parseOwnManifest(raw: string): OwnManifestRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NOT_READABLE;
  }

  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? { kind: "readable", dependencies: (parsed as Record<string, unknown>).dependencies }
    : NOT_READABLE;
}

/**
 * Read ONE candidate. `undefined` means ABSENT and is the only answer the walk
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
    return code === "ENOENT" || code === "ENOTDIR" ? undefined : NOT_READABLE;
  }

  return parseOwnManifest(raw);
}

/** Walk the shared candidate ordering under one plugin root. */
async function readOwnManifest(
  reader: DependencyDeclarationReader,
  pluginRoot: string,
): Promise<OwnManifestRead> {
  for (const candidate of MANIFEST_CANDIDATES) {
    const read = await readManifestCandidate(reader, path.join(pluginRoot, candidate));
    if (read !== undefined) {
      return read;
    }
  }

  return NOT_READABLE;
}

/**
 * What this plugin declares, in the D-01-32 read order, mapped onto the closure
 * walk's catalog-read contract: a successful parse is the found arm, a
 * rejection is the unusable arm carrying the parser's reason.
 *
 * RESV-01 / RESV-02: this is the cascade's catalog read, so a dependency
 * declared ONLY in a plugin's own bare manifest reaches the closure exactly
 * like one declared in the marketplace entry.
 */
export async function readDependencyDeclaration(
  options: DependencyDeclarationReadOptions,
): Promise<DeclarationLookupResult> {
  const reader = options.reader ?? REAL_DEPENDENCY_DECLARATION_READER;
  const pluginRoot = await resolvePluginRootFsOnly(reader, options);
  const own = pluginRoot === undefined ? NOT_READABLE : await readOwnManifest(reader, pluginRoot);

  // A readable manifest wins outright, INCLUDING when its `dependencies` key is
  // absent: that means the plugin declares nothing, not that the entry's list
  // should reappear behind it.
  const declared = own.kind === "readable" ? own.dependencies : options.entry.dependencies;
  return toClosureLookupResult(parseDeclaredDependencies(declared));
}

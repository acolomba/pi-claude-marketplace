// domain/manifest-containment.ts
//
// Where a plugin manifest candidate may be read from, when a link sits on the
// way to it. Every plugin manifest reader walks `MANIFEST_CANDIDATES` and asks
// this module about each candidate before it opens one, so the readers agree
// on which links they follow (D-PL2-24). Each reader keeps its own I/O and its
// own error contract; this module never reads manifest bytes.
//
// D-PL2-17: the boundary is Claude Code's. A copy (a git source, or any tree
// materialized at a commit) is bounded by its plugin directory. A path plugin
// read in place from its marketplace tree is bounded by its plugin directory
// and its marketplace directory.
//
// A candidate with no link from the plugin directory down to it is opened at
// its spelled path, and the reader decides whether it exists. A linked
// candidate is resolved: a dangling link, or one whose target runs through a
// regular file, is no manifest (D-01-06), as in Claude Code. A target inside
// a boundary root is opened at the target, never at the spelled link. A target
// outside every root escapes, and a link that cannot be resolved (a loop) is
// unresolvable; each reader refuses the plugin its own way.
//
// Both the roots and the candidate are resolved, so a root under a linked
// ancestor still contains its own files. The containment walk over the target
// refuses a link planted there after the resolution. The window between that
// walk and the reader's open is the one `createPathSafetyGuard` accepts.

import { realpath } from "node:fs/promises";

import { isErrnoException } from "../shared/errors.ts";
import { assertPathInside, PathContainmentError } from "../shared/path-safety.ts";

import { parsePluginSource } from "./source.ts";

/** The directories a plugin's manifest may resolve into, and their name. */
export interface ManifestBoundary {
  /** The plugin directory every candidate is joined under. */
  readonly pluginRoot: string;
  /** `pluginRoot` first, then any directory a link may also resolve into. */
  readonly roots: readonly string[];
  /** Claude Code's name for the boundary, used in the refusal note. */
  readonly label: string;
}

/** Where one candidate may be read from. */
export type ManifestLocation =
  | { readonly kind: "open"; readonly path: string }
  | { readonly kind: "absent" }
  | { readonly kind: "escapes" }
  | { readonly kind: "unresolvable"; readonly error: unknown };

const ABSENT: ManifestLocation = { kind: "absent" };
const ESCAPES: ManifestLocation = { kind: "escapes" };

/** D-PL2-17: a copy materialized at a commit is bounded by its plugin directory. */
export function copyManifestBoundary(pluginRoot: string): ManifestBoundary {
  return { pluginRoot, roots: [pluginRoot], label: "plugin directory" };
}

/**
 * D-PL2-17: a path plugin read in place from its marketplace tree is bounded
 * by its plugin directory and its marketplace directory.
 */
export function inPlaceManifestBoundary(
  pluginRoot: string,
  marketplaceRoot: string,
): ManifestBoundary {
  return {
    pluginRoot,
    roots: [pluginRoot, marketplaceRoot],
    label: "plugin directory and its marketplace directory",
  };
}

/**
 * D-PL2-17: the manifest boundary of the tree a plugin `source` resolved to. An
 * unpinned `path` source is read in place from its marketplace tree, bounded
 * by its plugin and marketplace directories. Every git source's tree, and a
 * `path` tree materialized at a pinned tag (`pin`), is a copy bounded by its
 * plugin directory.
 */
export function sourceManifestBoundary(
  source: unknown,
  pluginRoot: string,
  marketplaceRoot: string,
  pin: string | undefined,
): ManifestBoundary {
  return pin === undefined && parsePluginSource(source).kind === "path"
    ? inPlaceManifestBoundary(pluginRoot, marketplaceRoot)
    : copyManifestBoundary(pluginRoot);
}

/** D-01-06: ENOENT and ENOTDIR mean the candidate does not exist. */
export function isAbsenceError(err: unknown): boolean {
  const code = isErrnoException(err) ? err.code : undefined;
  return code === "ENOENT" || code === "ENOTDIR";
}

function unresolvable(error: unknown): ManifestLocation {
  return { kind: "unresolvable", error };
}

/**
 * D-PL2-24: where the candidate `candidatePath` under `boundary.pluginRoot`
 * may be read from. A refusal of the walk from the plugin directory down to
 * the candidate can only be a link, because every candidate is a fixed path
 * under its plugin directory. An ENOTDIR from that walk opens the spelled
 * candidate, whose read then answers absence (WR-03).
 */
export async function locateManifestCandidate(
  boundary: ManifestBoundary,
  candidatePath: string,
): Promise<ManifestLocation> {
  try {
    await assertPathInside(boundary.pluginRoot, candidatePath, "plugin manifest");
    return { kind: "open", path: candidatePath };
  } catch (err) {
    if (err instanceof PathContainmentError) {
      return locateLinkedCandidate(boundary, candidatePath);
    }

    return isErrnoException(err) && err.code === "ENOTDIR"
      ? { kind: "open", path: candidatePath }
      : unresolvable(err);
  }
}

async function locateLinkedCandidate(
  boundary: ManifestBoundary,
  candidatePath: string,
): Promise<ManifestLocation> {
  let realRoots: readonly string[];
  try {
    realRoots = await Promise.all(boundary.roots.map((root) => realpath(root)));
  } catch (err) {
    return unresolvable(err);
  }

  let target: string;
  try {
    target = await realpath(candidatePath);
  } catch (err) {
    return isAbsenceError(err) ? ABSENT : unresolvable(err);
  }

  const answers = await Promise.all(realRoots.map((root) => containsTarget(root, target)));
  return answers.includes(true) ? { kind: "open", path: target } : ESCAPES;
}

/**
 * Whether `root` holds the resolved `target`. The target was just resolved
 * through every directory above it, so a walk that cannot finish over it is
 * not shown to stay inside, and refuses the plugin like an escape.
 */
async function containsTarget(root: string, target: string): Promise<boolean> {
  try {
    await assertPathInside(root, target, "plugin manifest target");
    return true;
  } catch {
    return false;
  }
}

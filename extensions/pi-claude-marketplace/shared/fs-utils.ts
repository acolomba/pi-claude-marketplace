// shared/fs-utils.ts
//
// Filesystem helpers used by the bridges, plus the removal port that
// cleanupStaging performs its destructive work through. The staging helpers
// and the port:
//
//   - cleanupStaging: best-effort recursive rm of a staging tree, returning
//     a leak-message string on failure rather than throwing. Lets callers
//     surface partial-rollback state via appendLeakToError without nesting
//     try/catch in every prepare path.
//   - pathExists: lstat-based existence predicate. Does NOT follow
//     symlinks (consistent with PS-1 "refuse all symlinks").
//   - RemovalOps / createRemovalOps: the injected `rm` + `rename` port that
//     cleanupStaging routes its removal through, so a caller can make one
//     specific removal fail while its siblings succeed (RCOV-02, D-08-13).
//
// RCOV-02 / D-08-12, the port's one deliberate asymmetry: RemovalOps is the
// only *Ops collaborator in this tree that is a REQUIRED parameter. GitOps,
// CredentialOps, and DeviceFlowHttp all travel as an optional member with a
// `?? DEFAULT_*` fallback at each site. A defaulted port lets the obligation
// go quiet the moment a new call site forgets it -- the compiler stops asking
// -- and the project's own rule is to wire real adapters in one composition
// module rather than default a parameter to a live boundary. So the port has
// no DEFAULT_REMOVAL_OPS and no `?`, and the composition roots supply it.
//
// NFR-10: the port replaces the syscall, never the assertPathInside
// containment chokepoint in front of it. Callers still own containment
// exactly as they did, and an injected RemovalOps buys no path authority.
//
// T-03-03 mitigation: cleanupStaging swallows ENOENT and never throws, so
// callers cannot enter a cleanup retry loop. Bounded by single
// rm({recursive:true,force:true}) call.

import fs from "node:fs/promises";
import path from "node:path";

import { errorMessage } from "./errors.ts";
import { assertPathInside, PathContainmentError } from "./path-safety.ts";

import type { Dirent } from "node:fs";

/**
 * The removal port: two destructive filesystem verbs behind one substitutable
 * object.
 *
 * Two members and no more (D-08-13). Widening this into a general filesystem
 * facade would put every verb in this module behind a seam nothing asked for;
 * `pathExists`, `readDirEntriesTolerant`, and `isPlainMarkdownFile` keep
 * calling `fs` directly.
 */
export interface RemovalOps {
  /**
   * RCOV-02: remove `target`. Carries every cleanupStaging removal, so a
   * caller can fault one staging root while its siblings succeed.
   */
  rm(target: string, options: { recursive?: boolean; force?: boolean }): Promise<void>;
  /**
   * RCOV-02: move `from` onto `to`.
   */
  rename(from: string, to: string): Promise<void>;
}

/**
 * The real removal operations: thin bindings to `fs.rm` and `fs.rename` and
 * nothing else. Construction performs no filesystem work; only the operations
 * do.
 *
 * Called by the composition roots -- the orchestrators that own a staging
 * lifecycle -- never by a bridge, and never defaulted into a parameter
 * (D-08-12).
 */
export function createRemovalOps(): RemovalOps {
  return {
    rm: (target, options) => fs.rm(target, options),
    rename: (from, to) => fs.rename(from, to),
  };
}

/**
 * Best-effort recursive removal of a staging directory. Swallows ENOENT
 * (the dir was never created) and returns a descriptive leak message
 * for any other failure so the caller can surface it via
 * appendLeakToError without throwing from the cleanup itself.
 *
 * @param ops   Removal operations the recursive rm is performed through.
 * @param dir   Absolute path of the staging directory to remove.
 * @param label Human-readable label used in the leak message
 *              (e.g. "skill-staging", "command-staging").
 * @returns `undefined` on success or ENOENT, a leak message string otherwise.
 */
export async function cleanupStaging(
  ops: RemovalOps,
  dir: string,
  label: string,
): Promise<string | undefined> {
  try {
    await ops.rm(dir, { recursive: true, force: true });
    return undefined;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return undefined;
    }

    return `failed to clean up ${label} at ${dir}: ${errorMessage(err)}`;
  }
}

/**
 * lstat-based existence predicate. ENOENT/ENOTDIR -> false; any other
 * error propagates. Does NOT follow symlinks (consistent with PS-1).
 *
 * The skills `discover.ts` imports this rather than inlining lstat so the
 * symlink-non-following semantics live in one place.
 */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.lstat(p);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return false;
    }

    throw err;
  }
}

/**
 * PURL-03 / NFR-10 / D-77-03: resolve a git-subdir plugin root under the clone
 * root with clone-root-anchored containment. Returns the `escapes` /
 * `missing-subdir` discriminated arms on failure; a `materialized`-tagged
 * pluginRoot on success (the caller stamps the resolvedSha). fs-only -- no git
 * seam, no network -- so both the git-tainted clone-cache seam and the
 * network-free presence probe can share it.
 *
 * WR-07: `label` names the source kind in the `escapes` / `missing-subdir`
 * detail strings (default `"git-subdir"`, this verb's original and most
 * common caller). `materializeMarketplaceTagClone` passes `"path"` for the
 * pinned-`path` arm, so a `path`-source user reads a failure about the
 * source kind they actually used, not a `git-subdir` source kind and a
 * "plugin clone" they never declared.
 */
export async function resolveGitSubdirRoot(
  cloneRoot: string,
  subPath: string,
  label = "git-subdir",
): Promise<
  | { kind: "materialized"; pluginRoot: string }
  | { kind: "escapes"; detail: string }
  | { kind: "missing-subdir"; detail: string }
> {
  const pluginRoot = path.resolve(cloneRoot, subPath);
  try {
    await assertPathInside(cloneRoot, pluginRoot, `${label} path "${subPath}"`);
  } catch (err) {
    if (err instanceof PathContainmentError) {
      return { kind: "escapes", detail: err.message };
    }

    throw err;
  }

  if (!(await pathExists(pluginRoot))) {
    return {
      kind: "missing-subdir",
      detail: `${label} path "${subPath}" does not exist in the plugin clone`,
    };
  }

  return { kind: "materialized", pluginRoot };
}

/**
 * `readdir` with dirents, tolerant of a directory that is simply not there.
 *
 * A declared component directory that does not exist (ENOENT) or that turns
 * out to be a file (ENOTDIR) is a plugin shape the discovery paths treat as
 * "this plugin declares none of that kind", not as an error -- other declared
 * directories still contribute. Every other errno propagates.
 */
export async function readDirEntriesTolerant(dir: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(dir, { withFileTypes: true, encoding: "utf8" });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return [];
    }

    throw err;
  }
}

/**
 * T-03-27: whether a dirent is a component source file the bridges will read --
 * a regular, non-dotfile `.md` file that is not a symlink.
 *
 * The `lstat` decides the symlink question for a caller that has not already
 * asked it. `readdir`'s `withFileTypes` does NOT report a symlink's target
 * type: Node resolves a `UV_DIRENT_UNKNOWN` d_type through `lstat` before it
 * constructs the `Dirent`, so a symlink to a directory answers
 * `isSymbolicLink() === true` and `isDirectory() === false` on every
 * filesystem, and a walk that gates recursion on `isDirectory()` cannot
 * follow one.
 *
 * Shared by the agents and commands bridges, whose file-shaped components ask
 * exactly the same question. The agents bridge has no Dirent-level symlink
 * check and depends on the `lstat`; the commands walk has already refused
 * symlinked entries by the time it calls in.
 */
export async function isPlainMarkdownFile(dir: string, entry: Dirent): Promise<boolean> {
  if (entry.name.startsWith(".") || !entry.isFile() || !entry.name.endsWith(".md")) {
    return false;
  }

  const stat = await fs.lstat(path.join(dir, entry.name));
  return !stat.isSymbolicLink();
}

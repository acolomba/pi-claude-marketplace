import { lstat, readlink } from "node:fs/promises";
import path from "node:path";

/**
 * Path containment violation -- the resolved child is not inside the parent
 * boundary. Inherits PI-14 handling: NEVER folded into "rollback partial"
 * lines; always propagates loudly.
 */
export class PathContainmentError extends Error {
  readonly parent: string;
  readonly child: string;
  constructor(parent: string, child: string, label: string) {
    super(`${label} escapes ${parent} (resolved: ${child}).`);
    this.name = "PathContainmentError";
    this.parent = parent;
    this.child = child;
  }
}

/**
 * Strict subclass: a symlink was found in the path components walked from
 * `parent` down to `child`. D-14 refuses ALL symlinks -- the strictest
 * defense against a malicious or careless plugin author using a symlink to
 * escape the scope root.
 *
 * Inherits PathContainmentError so PI-14 instanceof handling propagates
 * automatically; distinguishable when needed via `err instanceof
 * SymlinkRefusedError`.
 */
export class SymlinkRefusedError extends PathContainmentError {
  readonly linkPath: string;
  readonly linkTarget: string;
  constructor(parent: string, child: string, label: string, linkPath: string, linkTarget: string) {
    super(parent, child, label);
    this.name = "SymlinkRefusedError";
    this.message = `${label} contains symlink ${linkPath} -> ${linkTarget} (parent: ${parent}, target: ${child}).`;
    this.linkPath = linkPath;
    this.linkTarget = linkTarget;
  }
}

/**
 * Pure string-level containment check -- does NOT touch the filesystem.
 * Returns true iff `path.relative(parent, child)` does not climb above parent.
 */
function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative))
  );
}

/**
 * Refuse if `child` is not contained by `parent`, OR if any path component
 * from `parent` down to `child` (inclusive of `child` if it exists) is a
 * symbolic link.
 *
 * Walks components by computing `path.relative(parent, child)` and applying
 * each segment to `parent` in turn. Per-component cost: 1x lstat() per segment,
 * negligible compared to the IO that follows.
 *
 * D-14: refuse all symlinks (PRD doesn't specify symlink behavior -- this is
 * new contract beyond V1).
 * D-15: single chokepoint -- every PS-1 callsite uses this function, no
 * per-bridge wrappers.
 * D-16: walk every parent component, not just the leaf (catches the case
 * where a parent dir is a symlink).
 * D-17: SymlinkRefusedError extends PathContainmentError so PI-14 handling
 * inherits.
 *
 * TOCTOU note: between this check returning and the actual write, an attacker
 * with write access to a parent dir could insert a symlink. V1's threat model
 * is "careless or malicious *plugin author*", not "concurrent in-process
 * attacker", so this residual risk is acceptable. Documented here so a future
 * hardening pass can find it.
 */
export async function assertPathInside(
  parent: string,
  child: string,
  label: string,
): Promise<void> {
  // String-level containment check first -- cheap, no FS touch.
  if (!isPathInside(parent, child)) {
    throw new PathContainmentError(parent, child, label);
  }

  // Walk every parent component from `parent` down to `child` (inclusive).
  // Start AT `parent` (the boundary itself is trusted) and descend toward
  // `child`, lstat'ing each intermediate path.
  const relative = path.relative(parent, child);
  const segments = relative === "" ? [] : relative.split(path.sep);

  let current = parent;
  for (const segment of segments) {
    current = path.join(current, segment);
    const canContinue = await assertNoSymlinkSegment(parent, child, label, current);
    if (!canContinue) {
      return;
    }
  }
}

async function assertNoSymlinkSegment(
  parent: string,
  child: string,
  label: string,
  current: string,
): Promise<boolean> {
  try {
    const stats = await lstat(current);
    if (stats.isSymbolicLink()) {
      throw new SymlinkRefusedError(
        parent,
        child,
        label,
        current,
        await readSymlinkTarget(current),
      );
    }

    return true;
  } catch (err) {
    // ENOENT on a not-yet-existing leaf is fine: this function is called
    // BEFORE writes (e.g., creating a new agent file). Only re-raise other
    // errors (and re-raise our own SymlinkRefusedError, which we just threw).
    if (err instanceof PathContainmentError) {
      throw err;
    }

    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return false;
    }

    throw err;
  }
}

async function readSymlinkTarget(current: string): Promise<string> {
  try {
    return await readlink(current);
  } catch {
    // Leave target as "<unreadable>" -- the link path itself is what matters
    // for the user-visible error.
    return "<unreadable>";
  }
}

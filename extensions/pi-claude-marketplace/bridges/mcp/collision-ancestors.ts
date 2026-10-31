// bridges/mcp/collision-ancestors.ts
//
// pi-mcp-adapter 5's ancestor config discovery (AFILE-05). A user opts in by
// setting `settings.ancestorConfigRoots` in a user-global config source. Only
// user-global sources may set it: a project file cannot extend this trust
// boundary, so the caller passes the value it read from those sources alone.
//
// Each configured root is a string. A `~/` prefix expands to the home
// directory, and the result must be absolute. The root is resolved through
// symlinks, must be an existing directory inside the home directory (the home
// directory itself counts), and must contain cwd. The deepest valid root
// wins. An entry that fails a check is skipped: the adapter warns on the
// console, and this extension never writes to stdout or stderr (IL-2).
//
// The ancestor directories run from that root down to the parent of cwd,
// farthest first, and each contributes `<dir>/.mcp.json` then
// `<dir>/.pi/mcp-adapter.json`.

import { realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

/** The path through symlinks; a path that does not resolve stays lexical, as in the adapter. */
async function pathIdentity(filePath: string): Promise<string> {
  const resolved = path.resolve(filePath);
  try {
    return await realpath(resolved);
  } catch {
    return resolved;
  }
}

function isWithin(base: string, target: string): boolean {
  const relative = path.relative(base, target);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function expandRoot(entry: unknown): string | undefined {
  const expanded =
    typeof entry === "string" && entry.startsWith("~/")
      ? path.join(homedir(), entry.slice(2))
      : entry;
  return typeof expanded === "string" && path.isAbsolute(expanded) ? expanded : undefined;
}

async function validRoot(entry: unknown, home: string, cwd: string): Promise<string | undefined> {
  const expanded = expandRoot(entry);
  if (expanded === undefined) {
    return undefined;
  }

  try {
    const root = await realpath(expanded);
    const isDirectory = (await stat(root)).isDirectory();
    return isDirectory && isWithin(home, root) && isWithin(root, cwd) ? root : undefined;
  } catch {
    // A root that does not resolve is skipped, as the adapter skips it.
    return undefined;
  }
}

function ancestorDirectories(cwd: string, root: string): string[] {
  const directories: string[] = [];
  let current = path.dirname(cwd);
  while (isWithin(root, current)) {
    directories.unshift(current);
    if (current === root) {
      break;
    }

    current = path.dirname(current);
  }

  return directories;
}

/**
 * Returns the ancestor config source paths pi-mcp-adapter reads for `cwd`,
 * given the `settings.ancestorConfigRoots` value from the user-global sources
 * (AFILE-05). An absent value, an empty array, a non-array value or no valid
 * root yields no paths.
 */
export async function ancestorSourcePaths(
  cwd: string,
  configuredRoots: unknown,
): Promise<readonly string[]> {
  if (!Array.isArray(configuredRoots)) {
    return [];
  }

  const entries: readonly unknown[] = configuredRoots;
  const home = await pathIdentity(homedir());
  const canonicalCwd = await pathIdentity(cwd);
  const resolved = await Promise.all(entries.map((entry) => validRoot(entry, home, canonicalCwd)));
  const roots = resolved.filter((root): root is string => root !== undefined);

  roots.sort((left, right) => right.length - left.length);
  const deepest = roots[0];
  if (deepest === undefined) {
    return [];
  }

  return ancestorDirectories(canonicalCwd, deepest).flatMap((directory) => [
    path.join(directory, ".mcp.json"),
    path.join(directory, ".pi", "mcp-adapter.json"),
  ]);
}

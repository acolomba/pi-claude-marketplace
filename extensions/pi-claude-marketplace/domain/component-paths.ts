import path from "node:path";

import { PathContainmentError, assertPathInside } from "../shared/path-safety.ts";

import type { PluginEntry } from "./components/plugin.ts";
import type { StatKindReader } from "./resolver-types.ts";

const COMPONENT_PATH_KINDS = ["skills", "commands", "agents", "workflows"] as const;
type ComponentPathKind = (typeof COMPONENT_PATH_KINDS)[number];

/** Resolves a relative component path after enforcing root containment. */
export async function resolveContainedComponentPath(
  pluginRoot: string,
  raw: string,
  label: string,
): Promise<
  | { readonly ok: true; readonly absolutePath: string }
  | { readonly ok: false; readonly cause: "absolute" | "escape" }
> {
  if (path.isAbsolute(raw)) {
    return { ok: false, cause: "absolute" };
  }

  const absolutePath = path.resolve(pluginRoot, raw);

  try {
    await assertPathInside(pluginRoot, absolutePath, label);
  } catch (error: unknown) {
    if (error instanceof PathContainmentError) {
      return { ok: false, cause: "escape" };
    }

    throw error;
  }

  return { ok: true, absolutePath };
}

/** Mutable resolver fields owned by component-path collection. */
export interface ComponentPathResolution {
  supported: string[];
  notes: string[];
  componentPaths: { skills: string[]; commands: string[]; agents: string[]; workflows: string[] };
  /** D-CF1-06: kinds whose existing conventional folder a declaration leaves unread. */
  shadowedFolders?: string[];
}

/**
 * D-CF1-06: the warning for a conventional folder a declaration leaves
 * unread, in Claude Code's user-facing wording.
 */
export function shadowedFolderWarning(kind: string): string {
  return `Default ${kind}/ folder is ignored because the manifest sets "${kind}"`;
}

// An empty string declares nothing, as `null` does: Claude Code 2.1.316 loads
// a declared path only when the field is truthy (D-CF1-06).
function readPathOrArray(value: unknown): readonly unknown[] {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [value];
}

async function validateComponentPath(
  kind: ComponentPathKind,
  raw: unknown,
  pluginRoot: string,
): Promise<{ ok: true; relative: string } | { ok: false; reason: string }> {
  if (Array.isArray(raw)) {
    return {
      ok: false,
      reason: `component path for "${kind}" contains nested array element; must be a string`,
    };
  }

  if (typeof raw !== "string") {
    return {
      ok: false,
      reason: `component path for "${kind}" is not a string (got ${typeof raw})`,
    };
  }

  const contained = await resolveContainedComponentPath(
    pluginRoot,
    raw,
    `component path "${kind}"`,
  );
  if (!contained.ok && contained.cause === "absolute") {
    return {
      ok: false,
      reason: `component path for "${kind}" must be relative (got absolute "${raw}")`,
    };
  }

  if (!contained.ok) {
    return { ok: false, reason: `component path for "${kind}" escapes plugin root: "${raw}"` };
  }

  // Deduplicate equivalent spellings only after enforcing containment.
  const relative = path.relative(pluginRoot, contained.absolutePath);
  return { ok: true, relative: relative === "" ? "." : relative };
}

function addComponentPath(
  resolution: ComponentPathResolution,
  kind: ComponentPathKind,
  seenPaths: Set<string>,
  relative: string,
): void {
  if (seenPaths.has(relative)) {
    return;
  }

  seenPaths.add(relative);
  resolution.componentPaths[kind].push(relative);
}

async function addValidatedComponentPath(
  resolution: ComponentPathResolution,
  kind: ComponentPathKind,
  seenPaths: Set<string>,
  raw: unknown,
  pluginRoot: string,
): Promise<boolean> {
  const validated = await validateComponentPath(kind, raw, pluginRoot);

  if (validated.ok) {
    addComponentPath(resolution, kind, seenPaths, validated.relative);
    return false;
  }

  resolution.notes.push(validated.reason);
  return true;
}

/**
 * Validates and adds each declared path in order. Returns whether any path
 * was refused with a note.
 */
async function addValidatedComponentPaths(
  resolution: ComponentPathResolution,
  kind: ComponentPathKind,
  seenPaths: Set<string>,
  raws: readonly unknown[],
  pluginRoot: string,
): Promise<boolean> {
  let dirty = false;
  for (const raw of raws) {
    dirty =
      // eslint-disable-next-line no-await-in-loop -- first-declared path wins the shared `seenPaths` set
      (await addValidatedComponentPath(resolution, kind, seenPaths, raw, pluginRoot)) || dirty;
  }

  return dirty;
}

/**
 * D-CF1-06: records the existing conventional folder of `kind` as unread,
 * unless a collected declared path reaches it.
 */
function recordShadowedFolder(resolution: ComponentPathResolution, kind: ComponentPathKind): void {
  if (!declaredPathReachesFolder(resolution.componentPaths[kind], kind)) {
    resolution.shadowedFolders = [...(resolution.shadowedFolders ?? []), kind];
  }
}

function markSupportedWhenCollected(
  resolution: ComponentPathResolution,
  kind: ComponentPathKind,
): void {
  if (resolution.componentPaths[kind].length > 0) {
    resolution.supported.push(kind);
  }
}

/**
 * D-CF3-04 (E4): the commands kind's own collection. Claude Code 2.1.316
 * reads `commands/` unless `plugin.json` declares `commands` (a truthy
 * declaration, `[]` included). A marketplace entry's `commands` adds to the
 * folder and never leaves it unread. The order is the folder, then the
 * `plugin.json` paths, then the entry paths; it decides only which file wins
 * when two name the same command. The folder is reported unread only when
 * `plugin.json` declares, the folder exists, and no collected path reaches it.
 */
async function collectStrictCommandPaths(
  entry: PluginEntry,
  manifest: Record<string, unknown> | null,
  pluginRoot: string,
  resolution: ComponentPathResolution,
  statKind: StatKindReader,
): Promise<boolean> {
  const seenPaths = new Set<string>();
  const manifestRaw = manifest?.commands;
  const manifestDeclares = Boolean(manifestRaw);
  const folderExists = (await statKind(path.join(pluginRoot, "commands"))) === "dir";
  if (folderExists && !manifestDeclares) {
    addComponentPath(resolution, "commands", seenPaths, "commands");
  }

  const dirty = await addValidatedComponentPaths(
    resolution,
    "commands",
    seenPaths,
    [...readPathOrArray(manifestRaw), ...readPathOrArray(entry.commands)],
    pluginRoot,
  );

  if (folderExists && manifestDeclares) {
    recordShadowedFolder(resolution, "commands");
  }

  markSupportedWhenCollected(resolution, "commands");
  return dirty;
}

/**
 * D-CF1-06: whether the conventional `<kind>/` folder joins the declared
 * paths. Claude Code 2.1.316 always reads `skills/`, and reads `agents/` and
 * `workflows/` only when the kind's declaration is falsy (absent, `null`, or
 * `""`), so a declared `[]` also leaves the folder unread. `commands/` follows
 * its own rule (D-CF3-04) in `collectStrictCommandPaths` and never reaches
 * this function.
 */
function conventionalFolderApplies(
  kind: ComponentPathKind,
  entryRaw: unknown,
  manifestRaw: unknown,
): boolean {
  return kind === "skills" || (!entryRaw && !manifestRaw);
}

/**
 * D-CF1-06: whether a collected declared path is the conventional folder or
 * lies inside it, which Claude Code 2.1.316 counts as reading the folder.
 */
function declaredPathReachesFolder(declared: readonly string[], kind: ComponentPathKind): boolean {
  return declared.some(
    (relative) => relative === kind || relative.startsWith(`${kind}${path.sep}`),
  );
}

async function collectStrictComponentKind(
  entry: PluginEntry,
  manifest: Record<string, unknown> | null,
  pluginRoot: string,
  resolution: ComponentPathResolution,
  statKind: StatKindReader,
  kind: ComponentPathKind,
): Promise<boolean> {
  if (kind === "commands") {
    return await collectStrictCommandPaths(entry, manifest, pluginRoot, resolution, statKind);
  }

  const seenPaths = new Set<string>();
  const entryRaw = (entry as Record<string, unknown>)[kind];
  const manifestRaw = manifest?.[kind];
  const dirty = await addValidatedComponentPaths(
    resolution,
    kind,
    seenPaths,
    [...readPathOrArray(entryRaw), ...readPathOrArray(manifestRaw)],
    pluginRoot,
  );

  if ((await statKind(path.join(pluginRoot, kind))) === "dir") {
    if (conventionalFolderApplies(kind, entryRaw, manifestRaw)) {
      addComponentPath(resolution, kind, seenPaths, kind);
    } else {
      recordShadowedFolder(resolution, kind);
    }
  }

  markSupportedWhenCollected(resolution, kind);
  return dirty;
}

/**
 * Collects strict entry, manifest, and conventional component paths with
 * first-wins deduplication. Per D-CF1-06, as in Claude Code 2.1.316, entry
 * paths come first, a declared `skills` path adds to the conventional
 * `skills/` folder, and a declared `agents` or `workflows` path replaces its
 * conventional folder, which is read only for an undeclared kind. Commands
 * are the exception (D-CF3-04, E4): `commands/` comes first and is read
 * unless `plugin.json` declares `commands`, then the `plugin.json` paths,
 * then the marketplace entry's paths, which add to the folder.
 */
export async function collectStrictComponentPaths(
  input: {
    readonly entry: PluginEntry;
    readonly manifest: Record<string, unknown> | null;
    readonly pluginRoot: string;
    readonly resolution: ComponentPathResolution;
  },
  statKind: StatKindReader,
): Promise<boolean> {
  const flags: boolean[] = [];

  for (const kind of COMPONENT_PATH_KINDS) {
    flags.push(
      // eslint-disable-next-line no-await-in-loop -- each kind appends to the shared resolution in kind order
      await collectStrictComponentKind(
        input.entry,
        input.manifest,
        input.pluginRoot,
        input.resolution,
        statKind,
        kind,
      ),
    );
  }

  return flags.includes(true);
}

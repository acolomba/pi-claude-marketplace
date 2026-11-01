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
 * D-CF1-06: whether the conventional `<kind>/` folder joins the declared
 * paths. Claude Code 2.1.316 always reads `skills/`, and reads `commands/`,
 * `agents/`, and `workflows/` only when the kind's declaration is falsy
 * (absent, `null`, or `""`), so a declared `[]` also leaves the folder unread.
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
  let dirty = false;
  const seenPaths = new Set<string>();
  const entryRaw = (entry as Record<string, unknown>)[kind];
  const manifestRaw = manifest?.[kind];

  for (const raw of [...readPathOrArray(entryRaw), ...readPathOrArray(manifestRaw)]) {
    dirty =
      // eslint-disable-next-line no-await-in-loop -- first-declared path wins the shared `seenPaths` set
      (await addValidatedComponentPath(resolution, kind, seenPaths, raw, pluginRoot)) || dirty;
  }

  if ((await statKind(path.join(pluginRoot, kind))) === "dir") {
    if (conventionalFolderApplies(kind, entryRaw, manifestRaw)) {
      addComponentPath(resolution, kind, seenPaths, kind);
    } else if (!declaredPathReachesFolder(resolution.componentPaths[kind], kind)) {
      resolution.shadowedFolders = [...(resolution.shadowedFolders ?? []), kind];
    }
  }

  if (resolution.componentPaths[kind].length > 0) {
    resolution.supported.push(kind);
  }

  return dirty;
}

/**
 * Collects strict entry, manifest, and conventional component paths, entry
 * paths first, with first-wins deduplication. Per D-CF1-06, as in Claude Code
 * 2.1.316, a declared `skills` path adds to the conventional `skills/` folder,
 * while a declared `commands`, `agents`, or `workflows` path replaces its
 * conventional folder, which is read only for an undeclared kind.
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

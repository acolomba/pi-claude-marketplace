import path from "node:path";

import { PathContainmentError, assertPathInside } from "../shared/path-safety.ts";

import type { PluginEntry } from "./components/plugin.ts";
import type { StatKindReader } from "./resolver-types.ts";

const COMPONENT_PATH_KINDS = ["skills", "commands", "agents"] as const;
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
  componentPaths: { skills: string[]; commands: string[]; agents: string[] };
}

function readPathOrArray(value: unknown): readonly unknown[] {
  if (value === undefined || value === null) {
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

  return { ok: true, relative: raw };
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
  const fromEntry = readPathOrArray((entry as Record<string, unknown>)[kind]);
  const fromManifest = readPathOrArray(manifest?.[kind]);

  for (const raw of [...fromEntry, ...fromManifest]) {
    dirty =
      (await addValidatedComponentPath(resolution, kind, seenPaths, raw, pluginRoot)) || dirty;
  }

  if ((await statKind(path.join(pluginRoot, kind))) === "dir") {
    addComponentPath(resolution, kind, seenPaths, kind);
  }

  if (resolution.componentPaths[kind].length > 0) {
    resolution.supported.push(kind);
  }

  return dirty;
}

/** Collects strict entry, manifest, and conventional component paths. */
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

async function collectLooseComponentKind(
  entry: PluginEntry,
  manifest: Record<string, unknown> | null,
  pluginRoot: string,
  resolution: ComponentPathResolution,
  kind: ComponentPathKind,
): Promise<boolean> {
  const fromEntry = (entry as Record<string, unknown>)[kind];
  const fromManifest = manifest?.[kind];

  if (fromEntry === undefined) {
    if (fromManifest === undefined) {
      return false;
    }

    resolution.notes.push(
      `component declarations conflict: manifest declares "${kind}" but entry does not`,
    );
    return true;
  }

  let dirty = false;
  const seenPaths = new Set<string>();
  for (const raw of readPathOrArray(fromEntry)) {
    dirty =
      (await addValidatedComponentPath(resolution, kind, seenPaths, raw, pluginRoot)) || dirty;
  }

  if (resolution.componentPaths[kind].length > 0) {
    resolution.supported.push(kind);
  }

  return dirty;
}

/** Collects entry-only component paths and reports manifest-only conflicts. */
export async function collectLooseComponentPaths(input: {
  readonly entry: PluginEntry;
  readonly manifest: Record<string, unknown> | null;
  readonly pluginRoot: string;
  readonly resolution: ComponentPathResolution;
}): Promise<boolean> {
  const flags: boolean[] = [];

  for (const kind of COMPONENT_PATH_KINDS) {
    flags.push(
      await collectLooseComponentKind(
        input.entry,
        input.manifest,
        input.pluginRoot,
        input.resolution,
        kind,
      ),
    );
  }

  return flags.includes(true);
}

import { homedir } from "node:os";
import path from "node:path";

import { resolveContainedComponentPath, type ComponentPathResolution } from "./component-paths.ts";
import { parseHooksConfig, type DroppedHook, type HooksConfig } from "./components/hooks.ts";

import type { StatKindReader } from "./resolver-types.ts";

/** Mutable resolver fields owned by hooks configuration resolution. */
export interface HooksResolution extends Pick<ComponentPathResolution, "supported" | "notes"> {
  unsupported: string[];
  hooksConfigPath?: string;
  orphanRewake?: boolean;
  droppedHooks?: DroppedHook[];
  /** UKIND-01: set when a hooks file declares a hooks module. */
  declaresHookModule?: boolean;
}

interface ResolvedHooksConfig {
  readonly value: HooksConfig;
  readonly dropped: readonly DroppedHook[];
  readonly declaresModule: boolean;
}

interface HooksReadDependencies {
  readonly statKind: StatKindReader;
  readonly readFileText: (path: string) => Promise<string>;
}

const DEFAULT_HOOKS_RELATIVE_PATH = path.join("hooks", "hooks.json");

async function readHooksConfig(
  hooksPath: string,
  dependencies: HooksReadDependencies,
): Promise<{ ok: true; value?: ResolvedHooksConfig } | { ok: false; reason: string }> {
  if ((await dependencies.statKind(hooksPath)) !== "file") {
    return { ok: true };
  }

  // Read failures retain their identity for the outer probe classifier.
  const raw = await dependencies.readFileText(hooksPath);
  const cwd = process.cwd();
  const ifContext = { homedir: homedir(), cwd, projectRoot: cwd };
  const noopCompileIf = JSON.parse.bind(JSON, "null") as () => null;
  const parsed = parseHooksConfig(raw, ifContext, noopCompileIf, { skipIfMap: true });
  if (!parsed.ok) {
    return { ok: false, reason: `malformed hooks.json: ${parsed.reason}` };
  }

  return {
    ok: true,
    value: {
      value: parsed.value,
      dropped: parsed.dropped,
      declaresModule: parsed.declaresModule,
    },
  };
}

/**
 * Lists the raw hooks-file paths that a `hooks` field names. A string names
 * one file and an array names its string elements. An inline matcher record
 * is not a hooks file, so it names nothing.
 */
function hooksFieldPaths(field: unknown): readonly string[] {
  if (typeof field === "string") {
    return [field];
  }

  if (Array.isArray(field)) {
    return field.filter((element): element is string => typeof element === "string");
  }

  return [];
}

/**
 * Reports whether one referenced hooks file declares a hooks module. Absolute,
 * escaping, and symlinked paths and paths in `probed` are never read. A
 * missing or unparsable file declares nothing, because a referenced file
 * carries no other resolver meaning.
 */
async function referenceDeclaresModule(
  pluginRoot: string,
  raw: string,
  probed: Set<string>,
  dependencies: HooksReadDependencies,
): Promise<boolean> {
  const contained = await resolveContainedComponentPath(pluginRoot, raw, "hooks reference");
  if (!contained.ok || probed.has(contained.absolutePath)) {
    return false;
  }

  probed.add(contained.absolutePath);
  const hooks = await readHooksConfig(contained.absolutePath, dependencies);
  return hooks.ok && hooks.value?.declaresModule === true;
}

/**
 * UKIND-01: reads the hooks files that the entry and then the manifest
 * `hooks` field name, each at most once, for a hooks module. `defaultPath` is
 * never read again.
 */
async function referencedFilesDeclareModule(
  input: {
    readonly pluginRoot: string;
    readonly entry: { readonly hooks?: unknown };
    readonly manifest: { readonly hooks?: unknown } | null;
  },
  defaultPath: string,
  dependencies: HooksReadDependencies,
): Promise<boolean> {
  const probed = new Set<string>([defaultPath]);
  const references = [
    ...hooksFieldPaths(input.entry.hooks),
    ...hooksFieldPaths(input.manifest?.hooks),
  ];
  for (const raw of references) {
    // eslint-disable-next-line no-await-in-loop -- the first module-declaring hooks file ends the probe
    if (await referenceDeclaresModule(input.pluginRoot, raw, probed, dependencies)) {
      return true;
    }
  }

  return false;
}

function hasOrphanRewake(config: HooksConfig): boolean {
  for (const groups of Object.values(config)) {
    for (const group of groups) {
      for (const handler of group.hooks) {
        const hasRewakeField =
          handler.rewakeMessage !== undefined || handler.rewakeSummary !== undefined;
        if (hasRewakeField && handler.asyncRewake !== true) {
          return true;
        }
      }
    }
  }

  return false;
}

function recordHooksConfig(resolution: HooksResolution, hooks: ResolvedHooksConfig): void {
  if (hooks.dropped.length > 0) {
    resolution.unsupported.push("hooks");
    resolution.droppedHooks = [...hooks.dropped];
  }

  if (Object.keys(hooks.value).length > 0) {
    resolution.supported.push("hooks");
    resolution.hooksConfigPath = DEFAULT_HOOKS_RELATIVE_PATH;
    if (hasOrphanRewake(hooks.value)) {
      resolution.orphanRewake = true;
    }
  }
}

/**
 * Resolves convention hooks, supportability drops, orphan rewake metadata, and
 * the UKIND-01 hooks-module declaration. Only the convention file supplies
 * command hooks. Hooks files that the `hooks` field names are read only for a
 * hooks module, and only when the convention file declares none.
 */
export async function resolveHooks(
  input: {
    readonly pluginRoot: string;
    readonly entry: { readonly hooks?: unknown };
    readonly manifest: { readonly hooks?: unknown } | null;
    readonly resolution: HooksResolution;
  },
  dependencies: {
    readonly statKind: StatKindReader;
    readonly readFileText: (path: string) => Promise<string>;
  },
): Promise<boolean> {
  const defaultPath = path.join(input.pluginRoot, DEFAULT_HOOKS_RELATIVE_PATH);
  const hooks = await readHooksConfig(defaultPath, dependencies);
  if (!hooks.ok) {
    input.resolution.notes.push(hooks.reason);
    return true;
  }

  if (
    hooks.value?.declaresModule === true ||
    (await referencedFilesDeclareModule(input, defaultPath, dependencies))
  ) {
    input.resolution.declaresHookModule = true;
  }

  if (hooks.value !== undefined) {
    recordHooksConfig(input.resolution, hooks.value);
  }

  return false;
}

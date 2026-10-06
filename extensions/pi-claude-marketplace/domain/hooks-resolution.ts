import { homedir } from "node:os";
import path from "node:path";

import { parseHooksConfig, type DroppedHook, type HooksConfig } from "./components/hooks.ts";

import type { ComponentPathResolution } from "./component-paths.ts";
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
  readonly relativePath: string;
  readonly dropped: readonly DroppedHook[];
  readonly declaresModule: boolean;
}

async function readHooksConfig(
  pluginRoot: string,
  dependencies: {
    readonly statKind: StatKindReader;
    readonly readFileText: (path: string) => Promise<string>;
  },
): Promise<{ ok: true; value?: ResolvedHooksConfig } | { ok: false; reason: string }> {
  const hooksPath = path.join(pluginRoot, "hooks", "hooks.json");
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
      relativePath: path.join("hooks", "hooks.json"),
      dropped: parsed.dropped,
      declaresModule: parsed.declaresModule,
    },
  };
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
    resolution.hooksConfigPath = hooks.relativePath;
    if (hasOrphanRewake(hooks.value)) {
      resolution.orphanRewake = true;
    }
  }
}

/**
 * Resolves convention hooks, supportability drops, orphan rewake metadata, and
 * the UKIND-01 hooks-module declaration.
 */
export async function resolveHooks(
  input: {
    readonly pluginRoot: string;
    readonly resolution: HooksResolution;
  },
  dependencies: {
    readonly statKind: StatKindReader;
    readonly readFileText: (path: string) => Promise<string>;
  },
): Promise<boolean> {
  const hooks = await readHooksConfig(input.pluginRoot, dependencies);
  if (!hooks.ok) {
    input.resolution.notes.push(hooks.reason);
    return true;
  }

  if (hooks.value === undefined) {
    return false;
  }

  if (hooks.value.declaresModule) {
    input.resolution.declaresHookModule = true;
  }

  recordHooksConfig(input.resolution, hooks.value);
  return false;
}

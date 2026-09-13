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
}

interface ResolvedHooksConfig {
  readonly value: HooksConfig;
  readonly relativePath: string;
  readonly dropped: readonly DroppedHook[];
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

/** Resolves convention hooks, supportability drops, and orphan rewake metadata. */
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

  if (hooks.value.dropped.length > 0) {
    input.resolution.unsupported.push("hooks");
    input.resolution.droppedHooks = [...hooks.value.dropped];
  }

  if (Object.keys(hooks.value.value).length > 0) {
    input.resolution.supported.push("hooks");
    input.resolution.hooksConfigPath = hooks.value.relativePath;
    if (hasOrphanRewake(hooks.value.value)) {
      input.resolution.orphanRewake = true;
    }
  }

  return false;
}

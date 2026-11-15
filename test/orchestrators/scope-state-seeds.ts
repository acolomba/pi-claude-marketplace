// Install-state seeds shared by the owner tests of the two load-time
// environment shells, `plugin-path.ts` and `plugin-options.ts`.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

export function pluginRecord(resolvedSource: string, enabled: boolean): PluginInstallRecord {
  return {
    version: "1.0.0",
    resolvedSource,
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
    enabled,
    provenance: "explicit",
    installedAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
  };
}

export function marketplaceRecord(
  name: string,
  scope: "user" | "project",
  sourceRoot: string,
  plugins: Record<string, PluginInstallRecord>,
): ExtensionState["marketplaces"][string] {
  return {
    name,
    scope,
    source: { kind: "path", raw: sourceRoot },
    addedFromCwd: sourceRoot,
    manifestPath: path.join(sourceRoot, ".claude-plugin", "marketplace.json"),
    marketplaceRoot: sourceRoot,
    plugins,
  };
}

export function stateFor(
  scope: "user" | "project",
  sourceRoot: string,
  plugins: Record<string, PluginInstallRecord>,
): ExtensionState {
  return {
    schemaVersion: 2,
    marketplaces: {
      catalog: marketplaceRecord("catalog", scope, sourceRoot, plugins),
    },
  };
}

export async function seedState(extensionRoot: string, state: ExtensionState): Promise<void> {
  await mkdir(extensionRoot, { recursive: true });
  await writeFile(path.join(extensionRoot, "state.json"), JSON.stringify(state), "utf8");
}

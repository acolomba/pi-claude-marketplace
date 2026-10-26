// Seeding helpers the MCP integration tests share: a session whose
// notifications are recorded, and a path marketplace holding one plugin with
// one MCP server.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { createInstallOperation } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { openNotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import { emptyPiInventory } from "../platform/pi-inventory-seed.ts";

import type { ExtensionContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type {
  NotificationOrigin,
  NotificationRun,
} from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";

export interface NotifyRecord {
  readonly message: string;
  readonly severity: string | undefined;
}

const TEST_COMMAND: NotificationOrigin = {
  kind: "command",
  commandId: "plugin",
  invocationId: "test-run",
};

/**
 * A text-mode session whose notifications are recorded. The run's snapshot
 * reports no companion loaded (D-05), and `origin` is the root it stands for:
 * a command by default, or the load pass a reconcile runs in.
 */
export function makeCtx(origin: NotificationOrigin = TEST_COMMAND): {
  session: { ctx: ExtensionContext; run: NotificationRun };
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    mode: "tui",
    ui: {
      notify: (message: string, severity?: string): void => {
        notifications.push({ message, severity });
      },
    },
  } as ExtensionContext;
  const run = openNotificationRun(
    {
      ...emptyPiInventory(),
      appendEntry(): never {
        throw new Error("a text-mode session appends no entry");
      },
    },
    origin,
  );
  return { session: { ctx, run }, notifications };
}

/**
 * Seeds path marketplace `mp` with plugin `hello` 1.0.0 declaring MCP server
 * `srv` as `server`, and registers `mp` at each of `scopes`.
 */
export async function seedMcpPlugin(
  cwd: string,
  scopes: readonly Scope[],
  server: Readonly<Record<string, unknown>> = { command: "node", args: ["v1.js"] },
): Promise<string> {
  const marketplaceRoot = path.join(cwd, "mp-src");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "hello", version: "1.0.0" }),
  );
  await writeFile(
    path.join(pluginRoot, ".mcp.json"),
    JSON.stringify({ mcpServers: { srv: server } }),
  );
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      plugins: [{ name: "hello", source: "./plugins/hello", version: "1.0.0" }],
    }),
  );
  for (const scope of scopes) {
    const locations = locationsFor(scope, cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        mp: {
          name: "mp",
          scope,
          source: pathSource("./mp-src"),
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot,
          plugins: {},
        },
      },
    });
  }

  return pluginRoot;
}

/**
 * Reproduces what the released builds left on disk: installs `hello@mp` at
 * `scope` through the real install, keeps the bytes it wrote to
 * `mcp-adapter.json`, then deletes that file and writes `legacyEntry` with the
 * plugin's marker into the scope's `mcp.json` under the declared name `srv`.
 * `server` is the plugin's declared `srv`, as `seedMcpPlugin` takes it.
 */
export async function seedLegacyMcpInstall(
  cwd: string,
  scope: Scope,
  legacyEntry: Readonly<Record<string, unknown>>,
  server?: Readonly<Record<string, unknown>>,
): Promise<{ pluginRoot: string; freshAdapterBytes: Buffer }> {
  const pluginRoot = await seedMcpPlugin(cwd, [scope], server);
  const locations = locationsFor(scope, cwd);
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  await createInstallOperation(
    hooksRouting,
    createCompletionCache(),
  )({ ...makeCtx().session, scope, cwd, marketplace: "mp", plugin: "hello" });
  const freshAdapterBytes = await readFile(locations.mcpAdapterJsonPath);
  await rm(locations.mcpAdapterJsonPath);
  await writeFile(
    locations.mcpJsonPath,
    JSON.stringify({
      mcpServers: {
        srv: { ...legacyEntry, _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" } },
      },
    }),
  );
  return { pluginRoot, freshAdapterBytes };
}

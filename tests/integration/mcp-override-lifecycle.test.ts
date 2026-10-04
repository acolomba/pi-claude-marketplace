import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  createInstallOperation,
  createUninstallOperation,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// The user override under a plugin server name survives install and
// uninstall through the real operations: install keeps it in the plugin
// entry's marker, and uninstall writes it back as the entry it was (AFILE-06,
// AFILE-01).

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI } {
  const ctx = {
    ui: { notify: (_message: string, _severity?: string): void => undefined },
  } as ExtensionContext;
  const pi = { getAllTools: (): unknown[] => [] } as ExtensionAPI;
  return { ctx, pi };
}

/** Seeds path marketplace `mp` with plugin `hello` 1.0.0 declaring MCP server `srv`. */
async function seedMcpPlugin(cwd: string): Promise<string> {
  const marketplaceRoot = path.join(cwd, "mp-src");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "hello", version: "1.0.0" }),
  );
  await writeFile(
    path.join(pluginRoot, ".mcp.json"),
    JSON.stringify({ mcpServers: { srv: { command: "node", args: ["v1.js"] } } }),
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
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {},
      },
    },
  });
  return pluginRoot;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

test("AFILE-06: a project install keeps the user's override in its entry and uninstall writes it back", async () => {
  await withHermeticEnvironment("mcp-override-lifecycle-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await seedMcpPlugin(cwd);
    const locations = locationsFor("project", cwd);
    const overrideBytes = `{
  "mcpServers": {
    "mine": {
      "command": "my-server"
    },
    "srv": {
      "disabled": true,
      "env": {
        "STUB_TOKEN": "stub-secret"
      }
    }
  }
}
`;
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(locations.mcpAdapterJsonPath, overrideBytes);
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const completionCache = createCompletionCache();
    const installed = makeCtx();
    const uninstalled = makeCtx();
    const request = { scope: "project", cwd, marketplace: "mp", plugin: "hello" } as const;

    // act
    await createInstallOperation(hooksRouting, completionCache)({ ...installed, ...request });
    const installedText = await readFile(locations.mcpAdapterJsonPath, "utf8");
    await createUninstallOperation(hooksRouting, completionCache)({ ...uninstalled, ...request });
    const uninstalledBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.deepStrictEqual(JSON.parse(installedText), {
      mcpServers: {
        mine: { command: "my-server" },
        srv: {
          command: "node",
          args: ["v1.js"],
          env: {
            CLAUDE_PLUGIN_ROOT: pluginRoot,
            CLAUDE_PLUGIN_DATA: path.join(locations.dataRoot, "mp", "hello"),
            CLAUDE_PROJECT_DIR: cwd,
          },
          disabled: true,
          _piClaudeMarketplace: {
            plugin: "hello",
            marketplace: "mp",
            keptOverride: { disabled: true, env: { STUB_TOKEN: "stub-secret" } },
          },
        },
      },
    });
    assert.strictEqual(installedText.split("stub-secret").length - 1, 1);
    assert.strictEqual(uninstalledBytes, overrideBytes);
    assert.strictEqual(await pathExists(path.join(cwd, ".pi", "mcp.json")), false);
  });
});

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
  createEnableOperation,
  createInstallOperation,
  createReinstallOperation,
  createUninstallOperation,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { createPluginUpdateOperations } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// The user override under a plugin server's key survives install and
// uninstall through the real operations: install keeps it in the plugin
// entry's marker, and uninstall writes it back with each of its carried fields
// taking the value the entry holds at that time (AFILE-06, AFILE-01). A user
// who disables the server in the adapter writes its key,
// `plugin_hello_srv_` (ANAME-01).

interface NotifyRecord {
  readonly message: string;
  readonly severity: string | undefined;
}

function makeCtx(): {
  session: { ctx: ExtensionContext; pi: ExtensionAPI };
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (message: string, severity?: string): void => {
        notifications.push({ message, severity });
      },
    },
  } as ExtensionContext;
  const pi = { getAllTools: (): unknown[] => [] } as ExtensionAPI;
  return { session: { ctx, pi }, notifications };
}

/**
 * Seeds path marketplace `mp` with plugin `hello` 1.0.0 declaring MCP server
 * `srv` as `server`, and registers `mp` at each of `scopes`.
 */
async function seedMcpPlugin(
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
    const pluginRoot = await seedMcpPlugin(cwd, ["project"]);
    const locations = locationsFor("project", cwd);
    const overrideBytes = `{
  "mcpServers": {
    "mine": {
      "command": "my-server"
    },
    "plugin_hello_srv_": {
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
    await createInstallOperation(
      hooksRouting,
      completionCache,
    )({ ...installed.session, ...request });
    const installedText = await readFile(locations.mcpAdapterJsonPath, "utf8");
    await createUninstallOperation(
      hooksRouting,
      completionCache,
    )({ ...uninstalled.session, ...request });
    const uninstalledBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.deepStrictEqual(JSON.parse(installedText), {
      mcpServers: {
        mine: { command: "my-server" },
        plugin_hello_srv_: {
          command: "node",
          args: ["v1.js"],
          env: {
            CLAUDE_PLUGIN_ROOT: pluginRoot,
            CLAUDE_PLUGIN_DATA: path.join(locations.dataRoot, "mp", "hello"),
            CLAUDE_PROJECT_DIR: cwd,
          },
          directTools: "search",
          toolPrefix: "mcp",
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

test("AFILE-06: a user-scope plugin disabled in the project keeps that disable through a project install, update, reinstall and uninstall", async () => {
  await withHermeticEnvironment("mcp-override-cross-scope-", async ({ agentDir, cwd }) => {
    // arrange
    const pluginRoot = await seedMcpPlugin(cwd, ["user", "project"]);
    const user = locationsFor("user", cwd);
    const project = locationsFor("project", cwd);
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const completionCache = createCompletionCache();
    const install = createInstallOperation(hooksRouting, completionCache);
    const { updatePlugins } = createPluginUpdateOperations(hooksRouting, completionCache);
    const reinstall = createReinstallOperation(hooksRouting, completionCache);
    const uninstall = createUninstallOperation(hooksRouting, completionCache);
    const atUser = { scope: "user", cwd, marketplace: "mp", plugin: "hello" } as const;
    const atProject = { scope: "project", cwd, marketplace: "mp", plugin: "hello" } as const;
    const overrideBytes = `{
  "mcpServers": {
    "plugin_hello_srv_": {
      "disabled": true,
      "env": {
        "STUB_TOKEN": "stub-secret"
      }
    }
  }
}
`;
    const userInstall = makeCtx();
    const projectInstall = makeCtx();
    const projectUpdate = makeCtx();
    const projectReinstall = makeCtx();
    const projectUninstall = makeCtx();
    const userUninstall = makeCtx();
    const userInstallAgain = makeCtx();

    // act
    await install({ ...userInstall.session, ...atUser });
    const userBytes = await readFile(user.mcpAdapterJsonPath, "utf8");
    await mkdir(path.dirname(project.mcpAdapterJsonPath), { recursive: true });
    await writeFile(project.mcpAdapterJsonPath, overrideBytes);
    await install({ ...projectInstall.session, ...atProject });
    const installedProject: unknown = JSON.parse(
      await readFile(project.mcpAdapterJsonPath, "utf8"),
    );
    const userAfterInstall = await readFile(user.mcpAdapterJsonPath, "utf8");
    await writeFile(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "hello", version: "1.1.0" }),
    );
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: { srv: { command: "node", args: ["v2.js"] } } }),
    );
    await writeFile(
      path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
      JSON.stringify({
        name: "mp",
        plugins: [{ name: "hello", source: "./plugins/hello", version: "1.1.0" }],
      }),
    );
    await updatePlugins({
      ...projectUpdate.session,
      scope: "project",
      cwd,
      target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
    });
    const updatedText = await readFile(project.mcpAdapterJsonPath, "utf8");
    const userAfterUpdate = await readFile(user.mcpAdapterJsonPath, "utf8");
    await reinstall({ ...projectReinstall.session, ...atProject });
    const reinstalledText = await readFile(project.mcpAdapterJsonPath, "utf8");
    const userAfterReinstall = await readFile(user.mcpAdapterJsonPath, "utf8");
    await uninstall({ ...projectUninstall.session, ...atProject });
    const uninstalledBytes = await readFile(project.mcpAdapterJsonPath, "utf8");
    const userAfterUninstall = await readFile(user.mcpAdapterJsonPath, "utf8");
    await uninstall({ ...userUninstall.session, ...atUser });
    await install({ ...userInstallAgain.session, ...atUser });
    const userFinal: unknown = JSON.parse(await readFile(user.mcpAdapterJsonPath, "utf8"));

    // assert
    const projectEnv = {
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      CLAUDE_PLUGIN_DATA: path.join(project.dataRoot, "mp", "hello"),
      CLAUDE_PROJECT_DIR: cwd,
    };
    const userEnv = {
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      CLAUDE_PLUGIN_DATA: path.join(user.dataRoot, "mp", "hello"),
    };
    const keptMarker = {
      plugin: "hello",
      marketplace: "mp",
      keptOverride: { disabled: true, env: { STUB_TOKEN: "stub-secret" } },
    };
    const installedRow = (scope: Scope, version: string): NotifyRecord => ({
      message: `A plugin operation needs attention.\n\n● mp [${scope}]\n  ● hello v${version} (installed) {requires pi-mcp-adapter}\n\n/reload to pick up changes`,
      severity: "warning",
    });
    const uninstalledRow = (scope: Scope, version: string): NotifyRecord => ({
      message: `● mp [${scope}]\n  ○ hello v${version} (uninstalled)\n\n/reload to pick up changes`,
      severity: undefined,
    });
    assert.deepStrictEqual(
      {
        userInstall: userInstall.notifications,
        projectInstall: projectInstall.notifications,
        projectUpdate: projectUpdate.notifications,
        projectReinstall: projectReinstall.notifications,
        projectUninstall: projectUninstall.notifications,
        userUninstall: userUninstall.notifications,
        userInstallAgain: userInstallAgain.notifications,
      },
      {
        userInstall: [installedRow("user", "1.0.0")],
        projectInstall: [
          installedRow("project", "1.0.0"),
          {
            message:
              'MCP server override kept.\n\nhello now provides "plugin_hello_srv_" in the project-scope mcp-adapter.json. Your override for "plugin_hello_srv_" is kept, but these fields of it stop applying: env. It comes back when you uninstall or disable hello.',
            severity: "warning",
          },
        ],
        projectUpdate: [
          {
            message:
              "A plugin operation needs attention.\n\n● mp [project]\n  ● hello v1.0.0 → v1.1.0 (updated) {requires pi-mcp-adapter}\n\n/reload to pick up changes",
            severity: "warning",
          },
        ],
        projectReinstall: [
          {
            message:
              "● mp [project]\n  ● hello v1.1.0 (reinstalled) {requires pi-mcp-adapter}\n\n/reload to pick up changes",
            severity: undefined,
          },
        ],
        projectUninstall: [uninstalledRow("project", "1.1.0")],
        userUninstall: [uninstalledRow("user", "1.0.0")],
        userInstallAgain: [installedRow("user", "1.1.0")],
      },
    );
    assert.deepStrictEqual(installedProject, {
      mcpServers: {
        plugin_hello_srv_: {
          command: "node",
          args: ["v1.js"],
          env: projectEnv,
          directTools: "search",
          toolPrefix: "mcp",
          disabled: true,
          _piClaudeMarketplace: keptMarker,
        },
      },
    });
    assert.deepStrictEqual(JSON.parse(updatedText), {
      mcpServers: {
        plugin_hello_srv_: {
          command: "node",
          args: ["v2.js"],
          env: projectEnv,
          directTools: "search",
          toolPrefix: "mcp",
          disabled: true,
          _piClaudeMarketplace: keptMarker,
        },
      },
    });
    assert.deepStrictEqual(
      {
        reinstalledText,
        uninstalledBytes,
        userAfterInstall,
        userAfterUpdate,
        userAfterReinstall,
        userAfterUninstall,
      },
      {
        reinstalledText: updatedText,
        uninstalledBytes: overrideBytes,
        userAfterInstall: userBytes,
        userAfterUpdate: userBytes,
        userAfterReinstall: userBytes,
        userAfterUninstall: userBytes,
      },
    );
    assert.deepStrictEqual(userFinal, {
      mcpServers: {
        plugin_hello_srv_: {
          command: "node",
          args: ["v2.js"],
          env: userEnv,
          directTools: "search",
          toolPrefix: "mcp",
          _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" },
        },
      },
    });
    assert.deepStrictEqual(
      [
        await pathExists(path.join(cwd, ".pi", "mcp.json")),
        await pathExists(path.join(agentDir, "mcp.json")),
      ],
      [false, false],
    );
  });
});

test("AFILE-06: a /mcp-adapter enable made while the plugin is installed survives plugin disable, enable and uninstall", async () => {
  await withHermeticEnvironment("mcp-override-user-enable-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await seedMcpPlugin(cwd, ["project"]);
    const locations = locationsFor("project", cwd);
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_hello_srv_":{"disabled":true,"env":{"STUB_TOKEN":"stub-secret"}}}}\n',
    );
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const completionCache = createCompletionCache();
    const setPluginEnabled = createEnableOperation(hooksRouting);
    const request = { scope: "project", cwd, marketplace: "mp", plugin: "hello" } as const;
    await createInstallOperation(
      hooksRouting,
      completionCache,
    )({ ...makeCtx().session, ...request });
    // pi-mcp-adapter 5.0.0's `/mcp-adapter enable plugin_hello_srv_` removes
    // `disabled` from the entry and keeps every other member, the marker included.
    const installed = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8")) as {
      mcpServers: { plugin_hello_srv_: Record<string, unknown> };
    };
    const { disabled: _disabled, ...userEnabledEntry } = installed.mcpServers.plugin_hello_srv_;
    await writeFile(
      locations.mcpAdapterJsonPath,
      `${JSON.stringify({ mcpServers: { plugin_hello_srv_: userEnabledEntry } }, null, 2)}\n`,
    );

    // act
    await setPluginEnabled({ ...makeCtx().session, ...request, enable: false });
    const disabledBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");
    await setPluginEnabled({ ...makeCtx().session, ...request, enable: true });
    const enabledText = await readFile(locations.mcpAdapterJsonPath, "utf8");
    await createUninstallOperation(
      hooksRouting,
      completionCache,
    )({ ...makeCtx().session, ...request });
    const uninstalledBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    const restoredBytes = `{
  "mcpServers": {
    "plugin_hello_srv_": {
      "env": {
        "STUB_TOKEN": "stub-secret"
      }
    }
  }
}
`;
    assert.deepStrictEqual(
      { disabledBytes, enabled: JSON.parse(enabledText) as unknown, uninstalledBytes },
      {
        disabledBytes: restoredBytes,
        enabled: {
          mcpServers: {
            plugin_hello_srv_: {
              command: "node",
              args: ["v1.js"],
              env: {
                CLAUDE_PLUGIN_ROOT: pluginRoot,
                CLAUDE_PLUGIN_DATA: path.join(locations.dataRoot, "mp", "hello"),
                CLAUDE_PROJECT_DIR: cwd,
              },
              directTools: "search",
              toolPrefix: "mcp",
              _piClaudeMarketplace: {
                plugin: "hello",
                marketplace: "mp",
                keptOverride: { env: { STUB_TOKEN: "stub-secret" } },
              },
            },
          },
        },
        uninstalledBytes: restoredBytes,
      },
    );
  });
});

test("AFILE-06: uninstall writes back no carried field the plugin's entry declares and the user's override lacks", async () => {
  await withHermeticEnvironment("mcp-override-plugin-carried-", async ({ cwd }) => {
    // arrange
    // ANAME-07: `timeout` is the one carried field a plugin's entry can set.
    await seedMcpPlugin(cwd, ["project"], { command: "node", timeout: 5000 });
    const locations = locationsFor("project", cwd);
    const overrideBytes = `{
  "mcpServers": {
    "plugin_hello_srv_": {
      "disabled": true
    }
  }
}
`;
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(locations.mcpAdapterJsonPath, overrideBytes);
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const completionCache = createCompletionCache();
    const request = { scope: "project", cwd, marketplace: "mp", plugin: "hello" } as const;

    // act
    await createInstallOperation(
      hooksRouting,
      completionCache,
    )({ ...makeCtx().session, ...request });
    const installed = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8")) as {
      mcpServers: { plugin_hello_srv_: Record<string, unknown> };
    };
    await createUninstallOperation(
      hooksRouting,
      completionCache,
    )({ ...makeCtx().session, ...request });
    const uninstalledBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    const { requestTimeoutMs, disabled } = installed.mcpServers.plugin_hello_srv_;
    assert.deepStrictEqual(
      { installedCarried: { requestTimeoutMs, disabled }, uninstalledBytes },
      {
        installedCarried: { requestTimeoutMs: 5000, disabled: true },
        uninstalledBytes: overrideBytes,
      },
    );
  });
});

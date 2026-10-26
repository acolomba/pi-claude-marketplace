import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import {
  createEnableOperation,
  createInstallOperation,
  createReinstallOperation,
  createUninstallOperation,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { createPluginUpdateOperations } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { makeCtx, seedMcpPlugin, type NotifyRecord } from "./mcp-plugin-seed.ts";

import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";

// The user override under a plugin server's key survives install and
// uninstall through the real operations: install keeps it in the plugin
// entry's marker, and uninstall writes it back with each of its carried fields
// taking the value the entry holds at that time (AFILE-06, AFILE-01). A user
// who disables the server in the adapter writes its key,
// `plugin_hello_srv_` (ANAME-01).

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
    // pi-mcp-adapter 5.2.0's `/mcp-adapter enable plugin_hello_srv_` removes
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

test("ANAME-07: a project install over a stub keeps the user's timeout for write-back while the plugin's timeout applies", async () => {
  await withHermeticEnvironment("mcp-override-plugin-set-", async ({ cwd }) => {
    // arrange
    await seedMcpPlugin(cwd, ["project"], {
      type: "http",
      url: "https://hello.example/mcp",
      timeout: 60000,
    });
    const locations = locationsFor("project", cwd);
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_hello_srv_":{"requestTimeoutMs":5000,"disabled":true}}}\n',
    );
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const completionCache = createCompletionCache();
    const installed = makeCtx();
    const request = { scope: "project", cwd, marketplace: "mp", plugin: "hello" } as const;

    // act
    await createInstallOperation(
      hooksRouting,
      completionCache,
    )({ ...installed.session, ...request });
    const installedText = await readFile(locations.mcpAdapterJsonPath, "utf8");
    // pi-mcp-adapter 5.2.0's `/mcp-adapter enable plugin_hello_srv_` removes
    // `disabled` from the entry and keeps every other member, the marker included.
    const installedDoc = JSON.parse(installedText) as {
      mcpServers: { plugin_hello_srv_: Record<string, unknown> };
    };
    const { disabled: _disabled, ...userEnabledEntry } = installedDoc.mcpServers.plugin_hello_srv_;
    await writeFile(
      locations.mcpAdapterJsonPath,
      `${JSON.stringify({ mcpServers: { plugin_hello_srv_: userEnabledEntry } }, null, 2)}\n`,
    );
    await createUninstallOperation(
      hooksRouting,
      completionCache,
    )({ ...makeCtx().session, ...request });
    const uninstalledBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.deepStrictEqual(JSON.parse(installedText), {
      mcpServers: {
        plugin_hello_srv_: {
          url: "https://hello.example/mcp",
          requestTimeoutMs: 60000,
          directTools: "search",
          toolPrefix: "mcp",
          disabled: true,
          _piClaudeMarketplace: {
            plugin: "hello",
            marketplace: "mp",
            pluginSetFields: ["requestTimeoutMs"],
            keptOverride: { requestTimeoutMs: 5000, disabled: true },
          },
        },
      },
    });
    assert.deepStrictEqual(installed.notifications, [
      {
        message:
          "A plugin operation needs attention.\n\n● mp [project]\n  ● hello v1.0.0 (installed) {requires pi-mcp-adapter}\n\n/reload to pick up changes",
        severity: "warning",
      },
      {
        message:
          'MCP server override kept.\n\nhello now provides "plugin_hello_srv_" in the project-scope mcp-adapter.json. Your override for "plugin_hello_srv_" is kept, but these fields of it stop applying: requestTimeoutMs. It comes back when you uninstall or disable hello.',
        severity: "warning",
      },
    ]);
    assert.strictEqual(
      uninstalledBytes,
      `{
  "mcpServers": {
    "plugin_hello_srv_": {
      "requestTimeoutMs": 5000
    }
  }
}
`,
    );
  });
});

/** Rewrites the installed `plugin_hello_srv_` entry through `edit`, as a user's edit would. */
async function editInstalledEntry(
  filePath: string,
  edit: (entry: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const doc = JSON.parse(await readFile(filePath, "utf8")) as {
    mcpServers: { plugin_hello_srv_: Record<string, unknown> };
  };
  doc.mcpServers.plugin_hello_srv_ = edit(doc.mcpServers.plugin_hello_srv_);
  await writeFile(filePath, `${JSON.stringify(doc, null, 2)}\n`);
}

test("D-08-02: a project user's disabled and openUi choices survive uninstall then reinstall", async () => {
  await withHermeticEnvironment("mcp-choices-reinstall-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await seedMcpPlugin(cwd, ["project"]);
    const locations = locationsFor("project", cwd);
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const completionCache = createCompletionCache();
    const install = createInstallOperation(hooksRouting, completionCache);
    const uninstall = createUninstallOperation(hooksRouting, completionCache);
    const request = { scope: "project", cwd, marketplace: "mp", plugin: "hello" } as const;
    await install({ ...makeCtx().session, ...request });
    // `/mcp-adapter disable plugin_hello_srv_` and a hand edit of `openUi`.
    await editInstalledEntry(locations.mcpAdapterJsonPath, (entry) => ({
      ...entry,
      disabled: true,
      openUi: true,
    }));

    // act
    await uninstall({ ...makeCtx().session, ...request });
    const uninstalled: unknown = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8"));
    await install({ ...makeCtx().session, ...request });
    const reinstalled: unknown = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8"));

    // assert
    assert.deepStrictEqual(
      { uninstalled, reinstalled },
      {
        uninstalled: {
          mcpServers: {},
          _piClaudeMarketplace: {
            serverChoices: {
              plugin_hello_srv_: {
                plugin: "hello",
                marketplace: "mp",
                fields: { disabled: true, openUi: true },
              },
            },
          },
        },
        reinstalled: {
          mcpServers: {
            plugin_hello_srv_: {
              command: "node",
              args: ["v1.js"],
              env: {
                CLAUDE_PLUGIN_ROOT: pluginRoot,
                CLAUDE_PLUGIN_DATA: path.join(locations.dataRoot, "mp", "hello"),
              },
              directTools: "search",
              toolPrefix: "mcp",
              disabled: true,
              openUi: true,
              _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" },
            },
          },
        },
      },
    );
  });
});

/** Publishes `hello` at `version` in the seeded marketplace, declaring `servers`. */
async function publishHello(
  cwd: string,
  pluginRoot: string,
  version: string,
  servers: Readonly<Record<string, unknown>>,
): Promise<void> {
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "hello", version }),
  );
  await writeFile(path.join(pluginRoot, ".mcp.json"), JSON.stringify({ mcpServers: servers }));
  await writeFile(
    path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "mp",
      plugins: [{ name: "hello", source: "./plugins/hello", version }],
    }),
  );
}

/** The `plugin_hello_srv_` entry a project install of `hello` writes, plus `carried`. */
function helloEntry(
  pluginRoot: string,
  dataRoot: string,
  args: readonly string[],
  carried: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    command: "node",
    args,
    env: {
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      CLAUDE_PLUGIN_DATA: path.join(dataRoot, "mp", "hello"),
    },
    directTools: "search",
    toolPrefix: "mcp",
    ...carried,
    _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" },
  };
}

test("D-08-02: a project user's disabled and trace choices survive plugin disable then enable", async () => {
  await withHermeticEnvironment("mcp-choices-disable-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await seedMcpPlugin(cwd, ["project"]);
    const locations = locationsFor("project", cwd);
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const setPluginEnabled = createEnableOperation(hooksRouting);
    const request = { scope: "project", cwd, marketplace: "mp", plugin: "hello" } as const;
    await createInstallOperation(
      hooksRouting,
      createCompletionCache(),
    )({ ...makeCtx().session, ...request });
    await editInstalledEntry(locations.mcpAdapterJsonPath, (entry) => ({
      ...entry,
      disabled: true,
      trace: true,
    }));

    // act
    await setPluginEnabled({ ...makeCtx().session, ...request, enable: false });
    const disabledBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");
    await setPluginEnabled({ ...makeCtx().session, ...request, enable: false });
    const disabledAgainBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");
    await setPluginEnabled({ ...makeCtx().session, ...request, enable: true });
    const enabled: unknown = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8"));

    // assert
    assert.deepStrictEqual(
      { disabled: JSON.parse(disabledBytes) as unknown, disabledAgainBytes, enabled },
      {
        disabled: {
          mcpServers: {},
          _piClaudeMarketplace: {
            serverChoices: {
              plugin_hello_srv_: {
                plugin: "hello",
                marketplace: "mp",
                fields: { disabled: true, trace: true },
              },
            },
          },
        },
        disabledAgainBytes: disabledBytes,
        enabled: {
          mcpServers: {
            plugin_hello_srv_: helloEntry(pluginRoot, locations.dataRoot, ["v1.js"], {
              disabled: true,
              trace: true,
            }),
          },
        },
      },
    );
  });
});

test("D-08-02: an update that drops the server stores its choice and one that restores the server restores it", async () => {
  await withHermeticEnvironment("mcp-choices-update-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await seedMcpPlugin(cwd, ["project"]);
    const locations = locationsFor("project", cwd);
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const completionCache = createCompletionCache();
    const { updatePlugins } = createPluginUpdateOperations(hooksRouting, completionCache);
    const request = { scope: "project", cwd, marketplace: "mp", plugin: "hello" } as const;
    const update = async (): Promise<void> => {
      await updatePlugins({
        ...makeCtx().session,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });
    };

    await createInstallOperation(
      hooksRouting,
      completionCache,
    )({ ...makeCtx().session, ...request });
    await editInstalledEntry(locations.mcpAdapterJsonPath, (entry) => ({
      ...entry,
      openUi: true,
    }));

    // act
    await publishHello(cwd, pluginRoot, "1.1.0", {});
    await update();
    const dropped: unknown = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8"));
    await publishHello(cwd, pluginRoot, "1.2.0", { srv: { command: "node", args: ["v3.js"] } });
    await update();
    const restored: unknown = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8"));

    // assert
    assert.deepStrictEqual(
      { dropped, restored },
      {
        dropped: {
          mcpServers: {},
          _piClaudeMarketplace: {
            serverChoices: {
              plugin_hello_srv_: { plugin: "hello", marketplace: "mp", fields: { openUi: true } },
            },
          },
        },
        restored: {
          mcpServers: {
            plugin_hello_srv_: helloEntry(pluginRoot, locations.dataRoot, ["v3.js"], {
              openUi: true,
            }),
          },
        },
      },
    );
  });
});

test("D-08-01: a reinstall keeps the user's openUi and trace on the entry", async () => {
  await withHermeticEnvironment("mcp-choices-reinstall-carried-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await seedMcpPlugin(cwd, ["project"]);
    const locations = locationsFor("project", cwd);
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const completionCache = createCompletionCache();
    const request = { scope: "project", cwd, marketplace: "mp", plugin: "hello" } as const;
    await createInstallOperation(
      hooksRouting,
      completionCache,
    )({ ...makeCtx().session, ...request });
    await editInstalledEntry(locations.mcpAdapterJsonPath, (entry) => ({
      ...entry,
      trace: false,
      openUi: true,
    }));

    // act
    await createReinstallOperation(
      hooksRouting,
      completionCache,
    )({ ...makeCtx().session, ...request });
    const reinstalled: unknown = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8"));

    // assert
    assert.deepStrictEqual(reinstalled, {
      mcpServers: {
        plugin_hello_srv_: helloEntry(pluginRoot, locations.dataRoot, ["v1.js"], {
          openUi: true,
          trace: false,
        }),
      },
    });
  });
});

for (const { owner, choice } of [
  {
    owner: "another plugin",
    choice: { plugin: "other", marketplace: "mp", fields: { approveTools: true } },
  },
  {
    owner: "the same-named plugin of another marketplace",
    choice: { plugin: "hello", marketplace: "elsewhere", fields: { approveTools: false } },
  },
]) {
  test(`D-08-02: a choice ${owner} stored under the key is neither applied nor removed by an install`, async () => {
    await withHermeticEnvironment("mcp-choices-foreign-", async ({ cwd }) => {
      // arrange
      const pluginRoot = await seedMcpPlugin(cwd, ["project"]);
      const locations = locationsFor("project", cwd);
      const member = { serverChoices: { plugin_hello_srv_: choice } };
      await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
      await writeFile(
        locations.mcpAdapterJsonPath,
        JSON.stringify({ _piClaudeMarketplace: member }),
      );
      const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });

      // act
      await createInstallOperation(
        hooksRouting,
        createCompletionCache(),
      )({ ...makeCtx().session, scope: "project", cwd, marketplace: "mp", plugin: "hello" });
      const installed: unknown = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8"));

      // assert
      assert.deepStrictEqual(installed, {
        _piClaudeMarketplace: member,
        mcpServers: {
          plugin_hello_srv_: helloEntry(pluginRoot, locations.dataRoot, ["v1.js"], {}),
        },
      });
    });
  });
}

test("AFILE-06: uninstall removes an absorbed disable stub that the user's later enable emptied", async () => {
  await withHermeticEnvironment("mcp-override-emptied-", async ({ cwd }) => {
    // arrange
    await seedMcpPlugin(cwd, ["project"]);
    const locations = locationsFor("project", cwd);
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_hello_srv_":{"disabled":true},"mine":{"command":"mine"}}}\n',
    );
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const completionCache = createCompletionCache();
    const request = { scope: "project", cwd, marketplace: "mp", plugin: "hello" } as const;
    await createInstallOperation(
      hooksRouting,
      completionCache,
    )({ ...makeCtx().session, ...request });
    // pi-mcp-adapter 5.2.0's `/mcp-adapter enable plugin_hello_srv_` removes
    // `disabled` from the entry and keeps every other member, the marker included.
    await editInstalledEntry(locations.mcpAdapterJsonPath, (entry) => {
      const { disabled: _disabled, ...enabledEntry } = entry;
      return enabledEntry;
    });

    // act
    await createUninstallOperation(
      hooksRouting,
      completionCache,
    )({ ...makeCtx().session, ...request });
    const uninstalled: unknown = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8"));

    // assert
    assert.deepStrictEqual(uninstalled, { mcpServers: { mine: { command: "mine" } } });
  });
});

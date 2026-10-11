import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
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
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { createPluginUpdateOperations } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { makeCtx, seedMcpPlugin, type NotifyRecord } from "./mcp-plugin-seed.ts";

// A real install writes Claude Code's variable rule into the plugin's
// pi-mcp-adapter entry (AVAR-01..03) and warns about the variables the server
// needs that are not set (AVAR-04). The install reads Pi's process
// environment, so the case sets and deletes its own `PI_CM_AVAR_*` variables
// and restores each one afterwards.

const AVAR_VARIABLES = ["PI_CM_AVAR_SITE", "PI_CM_AVAR_LEVEL", "PI_CM_AVAR_TOKEN"] as const;

function restoreVariables(saved: ReadonlyMap<string, string | undefined>): void {
  for (const [name, value] of saved) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, name);
    } else {
      process.env[name] = value;
    }
  }
}

test("AVAR-02: a project install writes Claude's variable rule for the adapter and warns about the unset variable", async () => {
  await withHermeticEnvironment("mcp-variable-expansion-", async ({ cwd }) => {
    const saved = new Map(AVAR_VARIABLES.map((name) => [name, process.env[name]]));
    try {
      // arrange
      delete process.env.PI_CM_AVAR_SITE;
      delete process.env.PI_CM_AVAR_LEVEL;
      process.env.PI_CM_AVAR_TOKEN = "avar-sentinel-04-02";
      const pluginRoot = await seedMcpPlugin(cwd, ["project"], {
        command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
        args: [
          "--project",
          "${CLAUDE_PROJECT_DIR}",
          "--site",
          "${PI_CM_AVAR_SITE}",
          "--level",
          "${PI_CM_AVAR_LEVEL:-info}",
          "--token",
          "${PI_CM_AVAR_TOKEN}",
        ],
        env: { MODE: "!fast" },
      });
      const locations = locationsFor("project", cwd);
      const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
      const installed = makeCtx();
      const request = { scope: "project", cwd, marketplace: "mp", plugin: "hello" } as const;

      // act
      await createInstallOperation(
        hooksRouting,
        createCompletionCache(),
      )({ ...installed.session, ...request });
      const installedText = await readFile(locations.mcpAdapterJsonPath, "utf8");

      // assert
      assert.deepStrictEqual(JSON.parse(installedText), {
        mcpServers: {
          plugin_hello_srv_: {
            command: `${pluginRoot}/bin/server`,
            args: [
              "--project",
              cwd,
              "--site",
              "${PI_CM_AVAR_SITE}",
              "--level",
              "info",
              "--token",
              "${PI_CM_AVAR_TOKEN}",
            ],
            env: {
              CLAUDE_PLUGIN_ROOT: pluginRoot,
              CLAUDE_PLUGIN_DATA: path.join(locations.dataRoot, "mp", "hello"),
              MODE: "!!fast",
            },
            directTools: "search",
            toolPrefix: "mcp",
            _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" },
          },
        },
      });
      assert.strictEqual(installedText.includes("avar-sentinel-04-02"), false);
      assert.deepStrictEqual(
        installed.notifications.filter(({ message }) => message.includes("avar-sentinel-04-02")),
        [],
      );
      assert.deepStrictEqual(installed.notifications.at(-1), {
        message:
          'MCP server variables not set.\n\nServer "plugin_hello_srv_" from hello in the project-scope mcp-adapter.json uses environment variables that were not set at install: PI_CM_AVAR_SITE.',
        severity: "warning",
      });
    } finally {
      restoreVariables(saved);
    }
  });
});

test("AVAR-05: a remote server's header never receives a set deny-listed credential, and the user is told", async () => {
  await withHermeticEnvironment("mcp-variable-expansion-", async ({ cwd }) => {
    const saved = new Map([["ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY]]);
    try {
      // arrange
      process.env.ANTHROPIC_API_KEY = "avar-sentinel-04-03";
      await seedMcpPlugin(cwd, ["project"], {
        type: "http",
        url: "https://mcp.example.test/mcp",
        headers: {
          Authorization: "Bearer ${ANTHROPIC_API_KEY}",
          "X-Fallback": "${ANTHROPIC_API_KEY:-unused}",
        },
      });
      const locations = locationsFor("project", cwd);
      const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
      const installed = makeCtx();
      const request = { scope: "project", cwd, marketplace: "mp", plugin: "hello" } as const;

      // act
      await createInstallOperation(
        hooksRouting,
        createCompletionCache(),
      )({ ...installed.session, ...request });
      const installedText = await readFile(locations.mcpAdapterJsonPath, "utf8");

      // assert
      assert.deepStrictEqual(
        (JSON.parse(installedText) as { mcpServers: Record<string, { headers: unknown }> })
          .mcpServers.plugin_hello_srv_?.headers,
        { Authorization: "Bearer ", "X-Fallback": "" },
      );
      assert.strictEqual(installedText.includes("avar-sentinel-04-03"), false);
      assert.deepStrictEqual(
        installed.notifications.filter(({ message }) => message.includes("avar-sentinel-04-03")),
        [],
      );
      assert.deepStrictEqual(installed.notifications.at(-1), {
        message:
          'MCP server credentials withheld.\n\nServer "plugin_hello_srv_" from hello in the project-scope mcp-adapter.json references credential variables that Claude Code never sends to a remote server: ANTHROPIC_API_KEY. They were written as empty values.',
        severity: "warning",
      });
    } finally {
      restoreVariables(saved);
    }
  });
});

// Every verb that stages a plugin's entries reports the unset variable and the
// withheld credential after its own rows (AVAR-04). Plugin `hello` declares a
// stdio server `local` that reads `PI_CM_AVAR_SITE`, which the case leaves
// unset, and a remote server `api` that sends `ANTHROPIC_API_KEY`, which the
// case sets and Claude Code never sends to a remote server.

const CREDENTIAL_SENTINEL = "avar-sentinel-04-09";

async function seedVariablePlugin(cwd: string): Promise<string> {
  const pluginRoot = await seedMcpPlugin(cwd, ["project"]);
  await writeFile(
    path.join(pluginRoot, ".mcp.json"),
    JSON.stringify({
      mcpServers: {
        local: { command: "node", args: ["--site", "${PI_CM_AVAR_SITE}"] },
        api: {
          type: "http",
          url: "https://mcp.example.test/mcp",
          headers: { Authorization: "Bearer ${ANTHROPIC_API_KEY}" },
        },
      },
    }),
  );
  return pluginRoot;
}

async function withUnsetSiteAndSetCredential(body: () => Promise<void>): Promise<void> {
  const saved = new Map([
    ["PI_CM_AVAR_SITE", process.env.PI_CM_AVAR_SITE],
    ["ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY],
  ]);
  try {
    delete process.env.PI_CM_AVAR_SITE;
    process.env.ANTHROPIC_API_KEY = CREDENTIAL_SENTINEL;
    await body();
  } finally {
    restoreVariables(saved);
  }
}

function assertVariableWarningsAfter(
  notifications: readonly NotifyRecord[],
  rows: readonly NotifyRecord[],
): void {
  assert.deepStrictEqual(notifications, [
    ...rows,
    {
      message:
        'MCP server variables not set.\n\nServer "plugin_hello_local_" from hello in the project-scope mcp-adapter.json uses environment variables that were not set at install: PI_CM_AVAR_SITE.',
      severity: "warning",
    },
    {
      message:
        'MCP server credentials withheld.\n\nServer "plugin_hello_api_" from hello in the project-scope mcp-adapter.json references credential variables that Claude Code never sends to a remote server: ANTHROPIC_API_KEY. They were written as empty values.',
      severity: "warning",
    },
  ]);
  assert.deepStrictEqual(
    notifications.filter(({ message }) => message.includes(CREDENTIAL_SENTINEL)),
    [],
  );
}

test("AVAR-04: an update reports the unset variable and the withheld credential after its rows", async () => {
  await withHermeticEnvironment("mcp-variable-update-", async ({ cwd }) => {
    await withUnsetSiteAndSetCredential(async () => {
      // arrange
      const pluginRoot = await seedVariablePlugin(cwd);
      const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
      const completionCache = createCompletionCache();
      const request = { scope: "project", cwd, marketplace: "mp", plugin: "hello" } as const;
      await createInstallOperation(
        hooksRouting,
        completionCache,
      )({
        ...makeCtx().session,
        ...request,
      });
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello", version: "1.1.0" }),
      );
      await writeFile(
        path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
        JSON.stringify({
          name: "mp",
          plugins: [{ name: "hello", source: "./plugins/hello", version: "1.1.0" }],
        }),
      );
      const updated = makeCtx();

      // act
      await createPluginUpdateOperations(hooksRouting, completionCache).updatePlugins({
        ...updated.session,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assertVariableWarningsAfter(updated.notifications, [
        {
          message:
            "A plugin operation needs attention.\n\n● mp [project]\n  ● hello v1.0.0 → v1.1.0 (updated) {requires pi-mcp-adapter}\n\n/reload to pick up changes",
          severity: "warning",
        },
      ]);
    });
  });
});

test("AVAR-04: a reinstall reports the unset variable and the withheld credential after its rows", async () => {
  await withHermeticEnvironment("mcp-variable-reinstall-", async ({ cwd }) => {
    await withUnsetSiteAndSetCredential(async () => {
      // arrange
      await seedVariablePlugin(cwd);
      const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
      const completionCache = createCompletionCache();
      const request = { scope: "project", cwd, marketplace: "mp", plugin: "hello" } as const;
      await createInstallOperation(
        hooksRouting,
        completionCache,
      )({
        ...makeCtx().session,
        ...request,
      });
      const reinstalled = makeCtx();

      // act
      await createReinstallOperation(
        hooksRouting,
        completionCache,
      )({
        ...reinstalled.session,
        ...request,
      });

      // assert
      assertVariableWarningsAfter(reinstalled.notifications, [
        {
          message:
            "● mp [project]\n  ● hello v1.0.0 (reinstalled) {requires pi-mcp-adapter}\n\n/reload to pick up changes",
          severity: undefined,
        },
      ]);
    });
  });
});

test("AVAR-04: enabling a disabled plugin reports the unset variable and the withheld credential after its rows", async () => {
  await withHermeticEnvironment("mcp-variable-enable-", async ({ cwd }) => {
    await withUnsetSiteAndSetCredential(async () => {
      // arrange
      await seedVariablePlugin(cwd);
      const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
      const setPluginEnabled = createEnableOperation(hooksRouting);
      const request = { scope: "project", cwd, marketplace: "mp", plugin: "hello" } as const;
      await createInstallOperation(
        hooksRouting,
        createCompletionCache(),
      )({
        ...makeCtx().session,
        ...request,
      });
      await setPluginEnabled({ ...makeCtx().session, ...request, enable: false });
      const enabled = makeCtx();

      // act
      await setPluginEnabled({ ...enabled.session, ...request, enable: true });

      // assert
      assertVariableWarningsAfter(enabled.notifications, [
        {
          message:
            "A plugin operation needs attention.\n\n● mp [project]\n  ● hello v1.0.0 (installed) {requires pi-mcp-adapter}\n\n/reload to pick up changes",
          severity: "warning",
        },
      ]);
    });
  });
});

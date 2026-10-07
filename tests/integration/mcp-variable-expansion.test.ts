import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { createInstallOperation } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { makeCtx, seedMcpPlugin } from "./mcp-plugin-seed.ts";

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
              CLAUDE_PROJECT_DIR: cwd,
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
          'MCP server variables not set.\n\nServer "plugin_hello_srv_" from hello in the project-scope mcp-adapter.json uses environment variables that are not set: PI_CM_AVAR_SITE. pi-mcp-adapter reads them from Pi\'s environment when it starts the server.',
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

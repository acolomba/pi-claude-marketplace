import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { createInstallOperation } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { pathExists } from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { makeCtx, seedMcpPlugin } from "./mcp-plugin-seed.ts";

// AVAR-03: Claude Code passes a leading `~/` in a stdio server's `args`
// through literally, but pi-mcp-adapter expands it to the home directory after
// interpolation, and no written form keeps it literal. A real install
// therefore treats such a server as `{unsupported mcp}`: a normal install
// refuses before any write, and `--partial` leaves the server out.

async function seedHomeArgsPlugin(cwd: string): Promise<string> {
  const pluginRoot = await seedMcpPlugin(cwd, ["project"]);
  await writeFile(
    path.join(pluginRoot, ".mcp.json"),
    JSON.stringify({
      mcpServers: {
        home: { command: "node", args: ["~/bin/server.js"] },
        local: { command: "node", args: ["server.js"] },
      },
    }),
  );
  return pluginRoot;
}

test("AVAR-03: a normal install of a plugin whose stdio args start with ~/ refuses with {unsupported mcp} and the --partial hint", async () => {
  await withHermeticEnvironment("mcp-home-path-partial-", async ({ cwd }) => {
    // arrange
    await seedHomeArgsPlugin(cwd);
    const locations = locationsFor("project", cwd);
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const installed = makeCtx();

    // act
    await createInstallOperation(
      hooksRouting,
      createCompletionCache(),
    )({ ...installed.session, scope: "project", cwd, marketplace: "mp", plugin: "hello" });

    // assert
    assert.deepStrictEqual(installed.notifications, [
      {
        severity: "error",
        message:
          "A plugin operation has failed.\n\n" +
          "● mp [project]\n" +
          "  ⊖ hello (partially-available) {unsupported mcp}\n" +
          "    Re-run with --partial to install the supported components.",
      },
    ]);
    assert.strictEqual(await pathExists(locations.mcpAdapterJsonPath), false);
  });
});

test("AVAR-03: --partial installs the plugin without the server whose args start with ~/", async () => {
  await withHermeticEnvironment("mcp-home-path-partial-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await seedHomeArgsPlugin(cwd);
    const locations = locationsFor("project", cwd);
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const installed = makeCtx();

    // act
    await createInstallOperation(
      hooksRouting,
      createCompletionCache(),
    )({
      ...installed.session,
      scope: "project",
      cwd,
      marketplace: "mp",
      plugin: "hello",
      partial: true,
    });
    const adapter: unknown = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8"));
    const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"];

    // assert
    assert.deepStrictEqual(adapter, {
      mcpServers: {
        plugin_hello_local_: {
          command: "node",
          args: ["server.js"],
          env: {
            CLAUDE_PLUGIN_ROOT: pluginRoot,
            CLAUDE_PLUGIN_DATA: path.join(locations.dataRoot, "mp", "hello"),
            CLAUDE_PROJECT_DIR: cwd,
          },
          directTools: "search",
          toolPrefix: "mcp",
          _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" },
        },
      },
    });
    assert.deepStrictEqual(
      {
        mcpServers: record?.resources.mcpServers,
        unsupported: record?.compatibility.unsupported,
      },
      { mcpServers: ["local"], unsupported: ["mcpServers"] },
    );
    assert.deepStrictEqual(installed.notifications, [
      {
        severity: "warning",
        message:
          "A plugin operation needs attention.\n\n" +
          "● mp [project]\n" +
          "  ◉ hello v1.0.0 (partially-installed) {unsupported mcp, requires pi-mcp-adapter}\n\n" +
          "/reload to pick up changes",
      },
    ]);
  });
});

// AMIG-01 / AMIG-02: a staging command that writes a plugin's servers into
// `mcp-adapter.json` also finishes the move out of the legacy `mcp.json`. It
// removes the plugin's marked `mcp.json` entries after the adapter write, and
// it drops the leftovers pi-mcp-adapter wrote under their old names: a
// marker-less override stub (the `/mcp-adapter disable` stub) or a
// marker-less full definition carrying `directTools` (the panel's direct-tools
// copy) in the scope's `mcp-adapter.json`, and for a user-scope plugin a stub
// in the project `mcp-adapter.json`. A marker-less full definition without
// `directTools` is the user's own server and stays.

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

import type { NotifyRecord } from "./mcp-plugin-seed.ts";
import type { ScopedLocations } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";

const EMPTIED_MCP_JSON = '{\n  "mcpServers": {}\n}\n';
const LEFTOVER_SUMMARY = "Old MCP server settings removed.";

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value));
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

/** The legacy `mcp.json` a released build wrote for `hello@mp`. */
async function seedLegacyEntry(locations: ScopedLocations): Promise<void> {
  await writeJson(locations.mcpJsonPath, {
    mcpServers: {
      srv: {
        command: "node",
        args: ["v1.js"],
        _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" },
      },
    },
  });
}

/** The entry a fresh install of `hello@mp` writes under `plugin_hello_srv_`. */
function helloEntry(pluginRoot: string, locations: ScopedLocations): Record<string, unknown> {
  return {
    command: "node",
    args: ["v1.js"],
    env: {
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      CLAUDE_PLUGIN_DATA: path.join(locations.dataRoot, "mp", "hello"),
    },
    directTools: "search",
    toolPrefix: "mcp",
    _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" },
  };
}

async function install(cwd: string, scope: Scope): Promise<NotifyRecord[]> {
  const { session, notifications } = makeCtx();
  await createInstallOperation(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  )({ ...session, scope, cwd, marketplace: "mp", plugin: "hello" });
  return notifications;
}

test("AMIG-02: installing a plugin whose old entry is in mcp.json writes the new entry and removes the old entry and its leftovers", async () => {
  await withHermeticEnvironment("mcp-legacy-sweep-install-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await seedMcpPlugin(cwd, ["project"]);
    const locations = locationsFor("project", cwd);
    await seedLegacyEntry(locations);
    await writeJson(locations.mcpAdapterJsonPath, {
      mcpServers: { srv: { disabled: true }, other: { command: "x" } },
    });

    // act
    const notifications = await install(cwd, "project");

    // assert
    assert.deepStrictEqual(await readJson(locations.mcpAdapterJsonPath), {
      mcpServers: { other: { command: "x" }, plugin_hello_srv_: helloEntry(pluginRoot, locations) },
    });
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), EMPTIED_MCP_JSON);
    assert.deepStrictEqual(notifications.at(-1), {
      message: [
        LEFTOVER_SUMMARY,
        "",
        'Removed "srv" from the project-scope mcp-adapter.json: pi-mcp-adapter had written it under the old name of a server from hello, for example for /mcp-adapter disable, and it no longer applies.',
      ].join("\n"),
      severity: "warning",
    });
  });
});

test("AMIG-01: a direct-tools copy under the old name is removed, and an unrelated marker-less server stays", async () => {
  await withHermeticEnvironment("mcp-legacy-sweep-panel-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await seedMcpPlugin(cwd, ["project"]);
    const locations = locationsFor("project", cwd);
    await seedLegacyEntry(locations);
    await writeJson(locations.mcpAdapterJsonPath, {
      mcpServers: {
        srv: { command: "node", args: ["server.js"], directTools: true },
        keep: { disabled: true },
      },
    });

    // act
    await install(cwd, "project");

    // assert
    assert.deepStrictEqual(await readJson(locations.mcpAdapterJsonPath), {
      mcpServers: {
        keep: { disabled: true },
        plugin_hello_srv_: helloEntry(pluginRoot, locations),
      },
    });
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), EMPTIED_MCP_JSON);
  });
});

test("AMIG-01: a user's own full server under the old name stays and is not reported", async () => {
  await withHermeticEnvironment("mcp-legacy-sweep-own-server-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await seedMcpPlugin(cwd, ["project"]);
    const locations = locationsFor("project", cwd);
    await seedLegacyEntry(locations);
    await writeJson(locations.mcpAdapterJsonPath, {
      mcpServers: { srv: { command: "node", args: ["mine.js"] } },
    });

    // act
    const notifications = await install(cwd, "project");

    // assert
    assert.deepStrictEqual(await readJson(locations.mcpAdapterJsonPath), {
      mcpServers: {
        srv: { command: "node", args: ["mine.js"] },
        plugin_hello_srv_: helloEntry(pluginRoot, locations),
      },
    });
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), EMPTIED_MCP_JSON);
    assert.deepStrictEqual(
      notifications.filter((notification) => notification.message.includes(LEFTOVER_SUMMARY)),
      [],
    );
  });
});

test("AMIG-01: a user-scope install removes the old-name disable stub from the project mcp-adapter.json", async () => {
  await withHermeticEnvironment("mcp-legacy-sweep-user-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await seedMcpPlugin(cwd, ["user"]);
    const user = locationsFor("user", cwd);
    const project = locationsFor("project", cwd);
    await seedLegacyEntry(user);
    await writeJson(project.mcpAdapterJsonPath, {
      mcpServers: { srv: { disabled: true }, srv2: { command: "node", args: ["two.js"] } },
    });

    // act
    await install(cwd, "user");

    // assert
    assert.deepStrictEqual(await readJson(project.mcpAdapterJsonPath), {
      mcpServers: { srv2: { command: "node", args: ["two.js"] } },
    });
    assert.deepStrictEqual(await readJson(user.mcpAdapterJsonPath), {
      mcpServers: { plugin_hello_srv_: helloEntry(pluginRoot, user) },
    });
    assert.strictEqual(await readFile(user.mcpJsonPath, "utf8"), EMPTIED_MCP_JSON);
  });
});

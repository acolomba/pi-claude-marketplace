// AMIG-01 / AMIG-03: a `/reload` moves an installed plugin's MCP server out of
// the legacy `mcp.json` that released builds wrote into `mcp-adapter.json`,
// and tells the user once. The oracle is the bytes a fresh install of the same
// plugin writes to `mcp-adapter.json`: the move re-stages the plugin, so hand
// edits in the legacy entry do not survive.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { createApplyReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { makeCtx, seedLegacyMcpInstall } from "./mcp-plugin-seed.ts";

import type { NotifyRecord } from "./mcp-plugin-seed.ts";

const COST_LINE =
  "The new names reset what pi-mcp-adapter keeps for each server name: sign in again to servers that use OAuth, and approve project servers again. Until you reload, pi-mcp-adapter can still show the old names.";

async function reload(cwd: string): Promise<NotifyRecord[]> {
  const { session, notifications } = makeCtx();
  await createApplyReconcile({ loadState })({
    ...session,
    cwd,
    reason: "reload",
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache: createCompletionCache(),
  });
  return notifications;
}

async function scopeBytes(cwd: string): Promise<readonly Buffer[]> {
  const locations = locationsFor("project", cwd);
  return Promise.all([
    readFile(locations.mcpJsonPath),
    readFile(locations.mcpAdapterJsonPath),
    readFile(locations.stateJsonPath),
  ]);
}

test("AMIG-01: /reload moves an installed plugin's mcp.json entry into mcp-adapter.json under its Claude Code key", async () => {
  await withHermeticEnvironment("mcp-migration-move-", async ({ cwd }) => {
    // arrange
    const { freshAdapterBytes } = await seedLegacyMcpInstall(cwd, "project", {
      command: "node",
      args: ["edited.js"],
      approveTools: true,
      enabled: false,
    });
    const locations = locationsFor("project", cwd);

    // act
    const notifications = await reload(cwd);

    // assert
    assert.deepStrictEqual(await readFile(locations.mcpAdapterJsonPath), freshAdapterBytes);
    assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), '{\n  "mcpServers": {}\n}\n');
    assert.deepStrictEqual(notifications, [
      {
        message: [
          "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
          "",
          "Moved to mcp-adapter.json:",
          "  srv -> plugin_hello_srv_ (hello) [project]",
          COST_LINE,
          "/reload to pick up changes",
        ].join("\n"),
        severity: "info",
      },
    ]);
  });
});

test("AMIG-01: after the move another /reload changes no bytes and sends no notice", async () => {
  await withHermeticEnvironment("mcp-migration-idempotent-", async ({ cwd }) => {
    // arrange
    await seedLegacyMcpInstall(cwd, "project", { command: "node", args: ["v1.js"] });
    await reload(cwd);
    const movedBytes = await scopeBytes(cwd);

    // act
    const notifications = await reload(cwd);

    // assert
    assert.deepStrictEqual(await scopeBytes(cwd), movedBytes);
    assert.deepStrictEqual(notifications, []);
  });
});

test("AMIG-03: one notice covers both scopes, project rows first", async () => {
  await withHermeticEnvironment("mcp-migration-scopes-", async ({ cwd }) => {
    // arrange
    await seedLegacyMcpInstall(cwd, "user", { command: "node", args: ["v1.js"] });
    await seedLegacyMcpInstall(cwd, "project", { command: "node", args: ["v1.js"] });

    // act
    const notifications = await reload(cwd);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: [
          "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
          "",
          "Moved to mcp-adapter.json:",
          "  srv -> plugin_hello_srv_ (hello) [project]",
          "  srv -> plugin_hello_srv_ (hello) [user]",
          COST_LINE,
          "/reload to pick up changes",
        ].join("\n"),
        severity: "info",
      },
    ]);
  });
});

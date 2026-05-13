import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  PI_MCP_ADAPTER_NOT_LOADED,
  PI_SUBAGENTS_NOT_LOADED,
} from "../../extensions/pi-claude-marketplace/shared/markers.ts";

import { installTargetWithMockPi, withE2EEnvironment } from "./_helpers.ts";

const MATRIX = [
  { subagents: false, mcp: false },
  { subagents: true, mcp: false },
  { subagents: false, mcp: true },
  { subagents: true, mcp: true },
] as const;

for (const loaded of MATRIX) {
  test(`soft-dep matrix agents=${loaded.subagents} mcp=${loaded.mcp}`, async () => {
    await withE2EEnvironment(async (env) => {
      const tools = [
        ...(loaded.subagents ? [{ name: "subagent" }] : []),
        ...(loaded.mcp ? [{ name: "mcp", sourceInfo: { source: "pi-mcp-adapter" } }] : []),
      ];

      const agentInstall = await installTargetWithMockPi(env, "code-simplifier", tools);
      const mcpInstall = await installTargetWithMockPi(env, "context7", tools);

      const messages = [...agentInstall.notifications, ...mcpInstall.notifications]
        .map((notification) => notification.message)
        .join("\n");

      assert.equal(messages.includes(PI_SUBAGENTS_NOT_LOADED), !loaded.subagents);
      assert.equal(messages.includes(PI_MCP_ADAPTER_NOT_LOADED), !loaded.mcp);

      const locations = locationsFor("project", env.cwd);
      const agentRecord =
        agentInstall.state.marketplaces["claude-plugins-official"]?.plugins["code-simplifier"];
      const mcpRecord = mcpInstall.state.marketplaces["claude-plugins-official"]?.plugins.context7;
      assert.ok(agentRecord);
      assert.ok(mcpRecord);

      for (const generatedName of agentRecord.resources.agents) {
        const body = await readFile(path.join(locations.agentsDir, `${generatedName}.md`), "utf8");
        assert.match(body, /pi-claude-marketplace/);
      }

      const mcpJson = JSON.parse(await readFile(locations.mcpJsonPath, "utf8")) as {
        readonly mcpServers?: Record<string, unknown>;
      };
      for (const serverName of mcpRecord.resources.mcpServers) {
        assert.ok(mcpJson.mcpServers?.[serverName]);
      }
    });
  });
}

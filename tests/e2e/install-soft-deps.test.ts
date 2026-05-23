import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

import { installTargetWithMockPi, withE2EEnvironment } from "./_helpers.ts";

// Per-row soft-dep marker contract strings (CMC-13 / MSG-SD-1..2). These
// are NOT closed-set Reasons exported from `shared/grammar/reasons.ts`
// (they are -- see `requires pi-subagents` / `requires pi-mcp`), but the
// rendered form inside the `{}` block is what the user observes. The
// legacy aggregated trailers (PI_SUBAGENTS_NOT_LOADED + PI_MCP_ADAPTER_NOT_LOADED)
// were retired by Phase 13 sub-wave 2b (D-13-07); the per-row markers
// inside the PluginInlineRow reasons block replace them.
const REQUIRES_PI_SUBAGENTS_MARKER = "{requires pi-subagents";
const REQUIRES_PI_MCP_MARKER = "{requires pi-mcp";

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

      // CMC-13 / MSG-SD-1..2: per-row markers fire when (declares AND
      // !companion_loaded). With subagents not loaded -> agent-installing
      // plugin emits `{requires pi-subagents}`; with mcp not loaded ->
      // mcp-installing plugin emits `{requires pi-mcp}`. The aggregated
      // PI_*_NOT_LOADED trailer is RETIRED per D-13-07.
      assert.equal(messages.includes(REQUIRES_PI_SUBAGENTS_MARKER), !loaded.subagents);
      assert.equal(messages.includes(REQUIRES_PI_MCP_MARKER), !loaded.mcp);

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

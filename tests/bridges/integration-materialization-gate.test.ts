// tests/bridges/integration-materialization-gate.test.ts
//
// AS-8 + AS-9 noop materialization gate, end-to-end.
//
// When a plugin declares no MCP servers (AS-8) the bridge must NOT
// materialize an mcp.json; when a plugin has an empty agents/ source dir
// (AS-9) the bridge must NOT materialize
// either the scoped agents/ dir or agents-index.json. Each bridge's noop
// branch is independent of the others -- exercising one bridge does not
// drag the others into materializing files (cross-bridge isolation, D-01).
//
// REQ-IDs covered:
//   AS-8 -- empty mcpServers -> no mcp.json
//   AS-9 -- empty agents source -> no scoped agents/ or agents-index.json
//   D-01 -- cross-bridge isolation: each bridge's noop branch is its own

import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  commitPreparedAgents,
  prepareStagePluginAgents,
} from "../../extensions/pi-claude-marketplace/bridges/agents/index.ts";
import {
  commitPreparedMcp,
  prepareStageMcpServers,
  resolvePluginMcpServers,
} from "../../extensions/pi-claude-marketplace/bridges/mcp/index.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { ResolvedPluginInstallable } from "../../extensions/pi-claude-marketplace/domain/resolver.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_EMPTY_MCP = path.resolve(HERE, "_fixtures", "empty-mcp");
const FIXTURE_EMPTY_AGENTS = path.resolve(HERE, "_fixtures", "empty-agents");
const FIXTURE_TEST_PLUGIN = path.resolve(HERE, "_fixtures", "test-plugin");

/** Returns true iff `p` exists (any kind), false on ENOENT. Throws on other errors. */
async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw err;
  }
}

describe("integration: materialization gate", () => {
  test("AS-8: empty mcpServers + no previous-ours = no mcp.json materialized", async () => {
    const scopeRoot = await mkdtemp(path.join(tmpdir(), "integration-as8-"));
    try {
      const locations = locationsFor("project", scopeRoot);

      // resolvePluginMcpServers against empty-mcp fixture: no entry, no
      // manifest, no .mcp.json -> source: "none", servers: {}.
      const resolved = await resolvePluginMcpServers({
        entry: {},
        manifest: {},
        pluginRoot: FIXTURE_EMPTY_MCP,
      });
      assert.equal(resolved.source, "none", "AS-8: empty fixture resolves to source: none");
      assert.deepEqual(resolved.servers, {}, "AS-8: empty fixture has zero servers");

      const prep = await prepareStageMcpServers({
        locations,
        cwd: scopeRoot,
        marketplaceName: "test-mp",
        pluginName: "empty-mcp",
        servers: resolved.servers,
      });
      assert.equal(prep.kind, "noop", "AS-8: no servers + no previous-ours -> noop");
      await commitPreparedMcp(prep);

      // mcp.json MUST NOT exist.
      assert.equal(
        await pathExists(locations.mcpJsonPath),
        false,
        "AS-8: scoped mcp.json not materialized",
      );
    } finally {
      await rm(scopeRoot, { recursive: true, force: true });
    }
  });

  test("AS-9: empty agents source + no previous-ours = no scoped agents/ dir AND no agents-index.json", async () => {
    const scopeRoot = await mkdtemp(path.join(tmpdir(), "integration-as9-"));
    try {
      const locations = locationsFor("project", scopeRoot);
      const resolved: ResolvedPluginInstallable = {
        state: "installable",
        name: "empty-agents",
        pluginRoot: FIXTURE_EMPTY_AGENTS,
        supported: ["agents"],
        unsupported: [],
        notes: [],
        // D-07: componentPaths.* are `readonly string[]`.
        componentPaths: { skills: [], commands: [], agents: ["agents"] },
        mcpServers: {},
      };

      const prep = await prepareStagePluginAgents({
        locations,
        marketplaceName: "test-mp",
        pluginName: "empty-agents",
        pluginRoot: FIXTURE_EMPTY_AGENTS,
        pluginDataDir: await locations.pluginDataDir("test-mp", "empty-agents"),
        resolved,
        agentsSourceDir: path.join(FIXTURE_EMPTY_AGENTS, "agents"),
        knownSkills: [],
      });
      assert.equal(prep.kind, "noop", "AS-9: no agents + no previous-ours -> noop");
      await commitPreparedAgents(prep);

      // scoped agents/ dir MUST NOT exist.
      assert.equal(
        await pathExists(locations.agentsDir),
        false,
        "AS-9: scoped agents/ dir not materialized",
      );

      // agents-index.json MUST NOT exist.
      assert.equal(
        await pathExists(locations.agentsIndexPath),
        false,
        "AS-9: agents-index.json not materialized",
      );
    } finally {
      await rm(scopeRoot, { recursive: true, force: true });
    }
  });

  test("cross-bridge isolation: MCP-only stage does not materialize agents-index.json or skills target", async () => {
    const scopeRoot = await mkdtemp(path.join(tmpdir(), "integration-isolation-"));
    try {
      const locations = locationsFor("project", scopeRoot);

      // Stage ONLY the MCP bridge against test-plugin (full-plugin has skills,
      // commands, agents, AND mcp). Skip the other three bridges entirely.
      const mcpResolved = await resolvePluginMcpServers({
        entry: {},
        manifest: {},
        pluginRoot: FIXTURE_TEST_PLUGIN,
      });
      const mcpPrep = await prepareStageMcpServers({
        locations,
        cwd: scopeRoot,
        marketplaceName: "test-mp",
        pluginName: "acme",
        servers: mcpResolved.servers,
      });
      assert.equal(mcpPrep.kind, "staged", "MCP staged from test-plugin .mcp.json");
      await commitPreparedMcp(mcpPrep);

      // mcp.json exists (the bridge we ran).
      assert.equal(
        (await stat(locations.mcpJsonPath)).isFile(),
        true,
        "cross-bridge isolation: mcp.json was materialized by the MCP bridge",
      );

      // None of the other bridges' targets exist -- their noop branches
      // never ran (we never called them) and their absence proves D-01
      // composition: each bridge is fully siloed.
      for (const p of [
        locations.agentsIndexPath,
        locations.agentsDir,
        locations.skillsTargetDir,
        locations.promptsTargetDir,
      ]) {
        assert.equal(
          await pathExists(p),
          false,
          `cross-bridge isolation: ${p} not materialized by MCP-only stage`,
        );
      }
    } finally {
      await rm(scopeRoot, { recursive: true, force: true });
    }
  });
});

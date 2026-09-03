import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { resolvePluginMcpServers } from "../../extensions/pi-claude-marketplace/bridges/mcp/parse.ts";
import {
  commitPreparedMcp,
  prepareStageMcpServers,
} from "../../extensions/pi-claude-marketplace/bridges/mcp/stage.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

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

test("MCP-only staging materializes no agent, command, or skill target", async (t) => {
  // arrange
  const scopeRoot = await mkdtemp(path.join(tmpdir(), "mcp-materialization-isolation-"));
  t.after(() => rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 }));
  const locations = locationsFor("project", scopeRoot);
  const pluginRoot = path.join(scopeRoot, "plugin-source");
  const pluginData = path.join(scopeRoot, "plugin-data");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, "agents"), { recursive: true });
  await mkdir(path.join(pluginRoot, "commands"), { recursive: true });
  await mkdir(path.join(pluginRoot, "skills", "dormant"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    '{"name":"acme","version":"1.0.0","description":"case-local isolation source"}\n',
  );
  await writeFile(
    path.join(pluginRoot, ".mcp.json"),
    '{"mcpServers":{"local":{"command":"${CLAUDE_PLUGIN_ROOT}/bin/server","args":["--data","${CLAUDE_PLUGIN_DATA}"]}}}\n',
  );
  await writeFile(path.join(pluginRoot, "agents", "dormant.md"), "---\nname: dormant\n---\n");
  await writeFile(path.join(pluginRoot, "commands", "dormant.md"), "Dormant command\n");
  await writeFile(
    path.join(pluginRoot, "skills", "dormant", "SKILL.md"),
    "---\nname: dormant\ndescription: Dormant skill\n---\n",
  );
  const expectedResolution = {
    source: "standalone",
    servers: {
      local: {
        command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
        args: ["--data", "${CLAUDE_PLUGIN_DATA}"],
      },
    },
  };
  const expectedBytes = `{
  "mcpServers": {
    "local": {
      "command": ${JSON.stringify(path.join(pluginRoot, "bin", "server"))},
      "args": [
        "--data",
        ${JSON.stringify(pluginData)}
      ],
      "env": {
        "CLAUDE_PLUGIN_ROOT": ${JSON.stringify(pluginRoot)},
        "CLAUDE_PLUGIN_DATA": ${JSON.stringify(pluginData)},
        "CLAUDE_PROJECT_DIR": ${JSON.stringify(scopeRoot)}
      },
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog"
      }
    }
  }
}
`;

  // act
  const resolution = await resolvePluginMcpServers({
    entry: {},
    manifest: {},
    pluginRoot,
  });
  const prepared = await prepareStageMcpServers({
    locations,
    cwd: scopeRoot,
    marketplaceName: "catalog",
    pluginName: "acme",
    pluginRoot,
    pluginData,
    sourcePath: path.join(pluginRoot, ".mcp.json"),
    servers: resolution.servers,
  });
  const commit = await commitPreparedMcp(prepared);
  const storedBytes = await readFile(locations.mcpJsonPath, "utf8");
  const siblingTargets = {
    agentsIndex: await pathExists(locations.agentsIndexPath),
    agents: await pathExists(locations.agentsDir),
    prompts: await pathExists(locations.promptsTargetDir),
    skills: await pathExists(locations.skillsTargetDir),
  };

  // assert
  assert.deepStrictEqual(resolution, expectedResolution);
  assert.strictEqual(prepared.kind, "staged");
  assert.deepStrictEqual(commit, {
    stagedNames: ["local"],
    recorded: [
      {
        generatedName: "local",
        sourcePath: path.join(pluginRoot, ".mcp.json"),
        targetPath: locations.mcpJsonPath,
      },
    ],
    warnings: [],
  });
  assert.strictEqual(storedBytes, expectedBytes);
  assert.deepStrictEqual(siblingTargets, {
    agentsIndex: false,
    agents: false,
    prompts: false,
    skills: false,
  });
});

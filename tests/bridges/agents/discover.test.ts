import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { discoverPluginAgents } from "../../../extensions/pi-claude-marketplace/bridges/agents/discover.ts";

test("discovers flat markdown agents in source order with complete records", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-flat-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const agentsDirectory = path.join(directory, "agents");
  const nestedDirectory = path.join(agentsDirectory, "nested");
  await mkdir(nestedDirectory, { recursive: true });
  const helperPath = path.join(agentsDirectory, "a-helper.md");
  const fallbackPath = path.join(agentsDirectory, "z-last.md");
  const helperBytes = Buffer.from(
    "---\r\nname: acme-helper\r\ndescription: Helpful agent\r\ntools: Read, Write\r\n---\r\n\r\nHelp carefully.\r\n",
  );
  const fallbackBytes = Buffer.from("﻿Plain body\r\n");
  await writeFile(helperPath, helperBytes);
  await writeFile(fallbackPath, fallbackBytes);
  await writeFile(path.join(agentsDirectory, ".hidden.md"), "---\nname: hidden\n---\n");
  await writeFile(path.join(agentsDirectory, "notes.txt"), "not an agent\n");
  await writeFile(path.join(nestedDirectory, "nested.md"), "---\nname: nested\n---\n");
  const expectedDiscovery = {
    discovered: [
      {
        sourceName: "acme-helper",
        generatedName: "pi-claude-marketplace-acme-helper",
        sourcePath: helperPath,
        sourceHash: "af6c30f084d68c095f606272c9e31a10f3aafc0e8796e2a167be6ebd46f8106c",
        raw: {
          name: "acme-helper",
          description: "Helpful agent",
          tools: "Read, Write",
        },
        body: "\nHelp carefully.\r\n",
      },
      {
        sourceName: "z-last",
        generatedName: "pi-claude-marketplace-acme-z-last",
        sourcePath: fallbackPath,
        sourceHash: "908a44e1f16dd6260a671a79b5a1c2280db6ba2f9edb78ad004009d4e3258894",
        raw: {},
        body: "﻿Plain body\r\n",
      },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [agentsDirectory],
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
  assert.strictEqual(Object.isFrozen(discovery.discovered), true);
  assert.strictEqual(Object.isFrozen(discovery.warnings), true);
});

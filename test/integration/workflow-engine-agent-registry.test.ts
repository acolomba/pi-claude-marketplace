// test/integration/workflow-engine-agent-registry.test.ts
//
// The workflow engine reads the agent files the agents bridge writes: its
// agentType registry parses them with Pi's YAML frontmatter reader, unlike
// pi-subagents' line reader. These cases load a bridged agent file through
// the engine's own registry.

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { convertAgent } from "../../extensions/pi-claude-marketplace/bridges/agents/convert.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { findCachedPeer, importPeerModule } from "./optional-peer.ts";

import type { RawAgentFrontmatter } from "../../extensions/pi-claude-marketplace/bridges/agents/types.ts";

interface AgentDefinition {
  readonly name: string;
  readonly description?: string;
  readonly tools?: readonly string[];
  readonly model?: string;
}

interface AgentRegistryModule {
  readonly loadAgentRegistry: (
    cwd: string,
    dirs: { readonly projectDir: string; readonly userDir: string; readonly legacyUserDir: string },
  ) => ReadonlyMap<string, AgentDefinition>;
}

/** The engine's definition of the bridged agent `demo:reader` converted from `raw`. */
async function engineDefinition(
  t: TestContext,
  raw: RawAgentFrontmatter,
): Promise<AgentDefinition | undefined> {
  const peer = await findCachedPeer("@quintinshaw/pi-dynamic-workflows");
  t.diagnostic(`@quintinshaw/pi-dynamic-workflows ${peer.version} at ${peer.root}`);
  const registry = await importPeerModule<AgentRegistryModule>(peer, "dist", "agent-registry.js");
  const { root, agentDir, cwd } = await createHermeticEnvironment(t, "engine-agent-registry-");
  const userDir = path.join(agentDir, "agents");
  await mkdir(userDir, { recursive: true });
  const agent = convertAgent({
    pluginName: "demo",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: [],
    discovered: {
      sourceName: "reader",
      generatedName: "pi-claude-marketplace-demo-reader",
      sourcePath: "/abs/reader.md",
      sourceHash: "abc",
      raw: { name: "reader", ...raw },
      body: "Scan.\n",
    },
    sourceHash: "abc",
    mapModel: false,
  });
  await writeFile(path.join(userDir, "pi-claude-marketplace-demo-reader.md"), agent.fileContent);
  const definitions = registry.loadAgentRegistry(cwd, {
    projectDir: path.join(cwd, ".pi", "agents"),
    userDir,
    legacyUserDir: path.join(root, "legacy-agents"),
  });
  return definitions.get("demo:reader");
}

test("D-PG7-17: the engine reads no model for an agent whose source model is inherit", async (t) => {
  // act
  const definition = await engineDefinition(t, {
    description: "Reads.",
    model: "inherit",
    tools: "Read",
  });

  // assert
  assert.deepStrictEqual(
    { description: definition?.description, model: definition?.model },
    { description: "Reads.", model: undefined },
  );
});

for (const description of [
  "Reviews: code.",
  "Reviews #1 and #2",
  "@reviewer checks it",
  '"Quoted words."',
]) {
  test(`D-PG7-18: the engine finds the agent and its tools under the description ${JSON.stringify(description)}`, async (t) => {
    // act
    const definition = await engineDefinition(t, { description, tools: "Read" });

    // assert
    assert.deepStrictEqual(
      { description: definition?.description, tools: definition?.tools },
      { description, tools: ["read"] },
    );
  });
}

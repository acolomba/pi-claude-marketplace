import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { convertAgent } from "../../extensions/pi-claude-marketplace/bridges/agents/convert.ts";
import {
  createHermeticEnvironment,
  withHermeticEnvironment,
} from "../platform/hermetic-environment.ts";

import { findCachedPeer, importPeerModule, type OptionalPeer } from "./optional-peer.ts";

import type { RawAgentFrontmatter } from "../../extensions/pi-claude-marketplace/bridges/agents/types.ts";

interface ChildLaunchInput {
  readonly host: "runner";
  readonly cwd: string;
  readonly childAgentName: string;
  readonly childIndex: number;
  readonly sessionEnabled: boolean;
  readonly inheritProjectContext: boolean;
  readonly inheritGlobalContext: boolean;
  readonly inheritSkills: boolean;
  readonly requiredExtensions: [];
  readonly tools?: string[];
  readonly excludeTools?: string[];
  readonly mcpDirectTools?: string[];
  readonly capabilityCeiling?: {
    readonly version: 1;
    readonly allowedTools: string[];
    readonly denyExtensions: false;
    readonly sources: string[];
  };
}

interface ChildLaunchModule {
  readonly buildInProcessChildLaunch: (input: ChildLaunchInput) => {
    readonly session: {
      readonly tools?: string[];
      readonly excludeTools?: string[];
      readonly ambientExtensions: boolean;
      readonly processEnv: { readonly MCP_DIRECT_TOOLS?: string };
    };
    readonly config: { readonly fanoutChild: boolean };
  };
}

interface McpAllowlistModule {
  readonly computeMcpServerHash: (definition: Record<string, unknown>) => string;
}

async function loadLaunch(t: TestContext): Promise<{
  readonly peer: OptionalPeer;
  readonly launch: ChildLaunchModule;
}> {
  const peer = await findCachedPeer("pi-subagents");
  t.diagnostic(`pi-subagents ${peer.version} at ${peer.root}`);
  return {
    peer,
    launch: await importPeerModule<ChildLaunchModule>(
      peer,
      "src",
      "runs",
      "shared",
      "child-launch.js",
    ),
  };
}

function runnerInput(cwd: string): ChildLaunchInput {
  return {
    host: "runner",
    cwd,
    childAgentName: "demo:runner",
    childIndex: 0,
    sessionEnabled: false,
    inheritProjectContext: false,
    inheritGlobalContext: false,
    inheritSkills: false,
    requiredExtensions: [],
  };
}

/** The value of the one `<key>: ` line the bridge writes for `raw`. */
function convertedLine(raw: RawAgentFrontmatter, key: string): string {
  const agent = convertAgent({
    pluginName: "demo",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: [],
    discovered: {
      sourceName: "lead",
      generatedName: "pi-claude-marketplace-demo-lead",
      sourcePath: "/abs/lead.md",
      sourceHash: "abc",
      raw,
      body: "Body.\n",
    },
    sourceHash: "abc",
    mapModel: false,
  });
  const lines = agent.fileContent.split("\n").filter((line) => line.startsWith(`${key}: `));
  assert.strictEqual(lines.length, 1);
  return (lines[0] ?? "").slice(`${key}: `.length);
}

test("unrestricted runner keeps ambient adapter tools available", async (t) => {
  // arrange
  const { launch } = await loadLaunch(t);
  const { cwd } = await createHermeticEnvironment(t, "child-launch-unrestricted-");

  // act
  const child = launch.buildInProcessChildLaunch(runnerInput(cwd));

  // assert
  assert.deepStrictEqual(
    {
      tools: child.session.tools,
      excludeTools: child.session.excludeTools,
      ambientExtensions: child.session.ambientExtensions,
      ownsMcpDirectTools: Object.hasOwn(child.session.processEnv, "MCP_DIRECT_TOOLS"),
      mcpDirectTools: child.session.processEnv.MCP_DIRECT_TOOLS,
    },
    {
      tools: undefined,
      excludeTools: undefined,
      ambientExtensions: true,
      ownsMcpDirectTools: true,
      mcpDirectTools: undefined,
    },
  );
});

test("exclusion-only runner keeps ambient adapter tools available", async (t) => {
  // arrange
  const { launch } = await loadLaunch(t);
  const excludedTool = "mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c";
  const { cwd } = await createHermeticEnvironment(t, "child-launch-exclusion-");

  // act
  const child = launch.buildInProcessChildLaunch({
    ...runnerInput(cwd),
    excludeTools: [excludedTool],
  });

  // assert
  assert.deepStrictEqual(
    {
      tools: child.session.tools,
      excludeTools: child.session.excludeTools,
      ambientExtensions: child.session.ambientExtensions,
      ownsMcpDirectTools: Object.hasOwn(child.session.processEnv, "MCP_DIRECT_TOOLS"),
      mcpDirectTools: child.session.processEnv.MCP_DIRECT_TOOLS,
    },
    {
      tools: undefined,
      excludeTools: [excludedTool],
      ambientExtensions: true,
      ownsMcpDirectTools: true,
      mcpDirectTools: undefined,
    },
  );
});

test("explicit short MCP grant selects its adapter tool", async (t) => {
  // arrange
  const { peer, launch } = await loadLaunch(t);
  const allowlist = await importPeerModule<McpAllowlistModule>(
    peer,
    "src",
    "runs",
    "shared",
    "mcp-direct-tool-allowlist.js",
  );
  await withHermeticEnvironment("child-launch-grant-", async ({ agentDir, cwd }) => {
    const definition = {
      command: "node",
      args: ["server.js"],
      directTools: "search",
      toolPrefix: "mcp",
    };
    await writeFile(
      path.join(agentDir, "mcp-adapter.json"),
      JSON.stringify({ mcpServers: { plugin_demo_stub_: definition } }),
    );
    await writeFile(
      path.join(agentDir, "mcp-cache.json"),
      JSON.stringify({
        version: 1,
        servers: {
          plugin_demo_stub_: {
            configHash: allowlist.computeMcpServerHash(definition),
            cachedAt: Date.now(),
            tools: [{ name: "echo" }],
          },
        },
      }),
    );

    // act
    const child = launch.buildInProcessChildLaunch({
      ...runnerInput(cwd),
      mcpDirectTools: ["plugin_demo_stub_/echo"],
    });

    // assert
    assert.deepStrictEqual(child.session.tools, ["mcp__plugin_demo_stub__echo"]);
    assert.strictEqual(child.session.processEnv.MCP_DIRECT_TOOLS, "plugin_demo_stub_/echo");
  });
});

test("explicit read tool keeps adapter tools suppressed", async (t) => {
  // arrange
  const { launch } = await loadLaunch(t);
  const { cwd } = await createHermeticEnvironment(t, "child-launch-read-");

  // act
  const child = launch.buildInProcessChildLaunch({ ...runnerInput(cwd), tools: ["read"] });

  // assert
  assert.deepStrictEqual(child.session.tools, ["read"]);
  assert.strictEqual(child.session.processEnv.MCP_DIRECT_TOOLS, "__none__");
});

test("explicit empty tool list keeps adapter tools suppressed", async (t) => {
  // arrange
  const { launch } = await loadLaunch(t);
  const { cwd } = await createHermeticEnvironment(t, "child-launch-empty-");

  // act
  const child = launch.buildInProcessChildLaunch({ ...runnerInput(cwd), tools: [] });

  // assert
  assert.deepStrictEqual(child.session.tools, []);
  assert.strictEqual(child.session.processEnv.MCP_DIRECT_TOOLS, "__none__");
});

test("read-only capability ceiling keeps adapter tools suppressed", async (t) => {
  // arrange
  const { launch } = await loadLaunch(t);
  const { cwd } = await createHermeticEnvironment(t, "child-launch-ceiling-");

  // act
  const child = launch.buildInProcessChildLaunch({
    ...runnerInput(cwd),
    capabilityCeiling: {
      version: 1,
      allowedTools: ["read"],
      denyExtensions: false,
      sources: ["test"],
    },
  });

  // assert
  assert.deepStrictEqual(child.session.tools, ["read"]);
  assert.strictEqual(child.session.processEnv.MCP_DIRECT_TOOLS, "__none__");
});

test("PG-AGENT-03: the tools written for an Agent grant authorize fan-out", async (t) => {
  // arrange
  const { launch } = await loadLaunch(t);
  const { cwd } = await createHermeticEnvironment(t, "child-launch-agent-grant-");
  const tools = convertedLine({ description: "d", tools: "Read, Agent(demo:helper)" }, "tools");

  // act
  const child = launch.buildInProcessChildLaunch({ ...runnerInput(cwd), tools: tools.split(",") });

  // assert
  assert.deepStrictEqual(
    { tools: child.session.tools, fanoutChild: child.config.fanoutChild },
    { tools: ["read", "subagent"], fanoutChild: true },
  );
});

test("PG-AGENT-07a: the model written for a source inherit is pi-subagents' inherit sentinel", async (t) => {
  // arrange
  const { peer } = await loadLaunch(t);
  const resolution = await importPeerModule<{ readonly INHERIT_MODEL: string }>(
    peer,
    "src",
    "runs",
    "shared",
    "model-resolution.js",
  );

  // act
  const model = convertedLine({ description: "d", model: "inherit", tools: "Read" }, "model");

  // assert
  assert.strictEqual(model, resolution.INHERIT_MODEL);
});

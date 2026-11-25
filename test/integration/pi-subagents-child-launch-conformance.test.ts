// test/integration/pi-subagents-child-launch-conformance.test.ts
//
// Peer conformance (ITSCOPE-01) against pi-subagents' own launch planner,
// `src/runs/shared/child-launch.js`, with its MCP allowlist and agent
// discovery, in place from the suite version in the optional peer cache
// (D-PG1-02). Each case writes an agent with `convertAgent` and asks the
// planner which tools and model the child gets: ambient adapter tools for an
// unrestricted or exclusion-only runner, none after an explicit read, an
// empty list, or a read-only ceiling; a short MCP grant selects its tool, and
// an exclude name removes one (PG-AGENT-09); the Agent grant keys allow
// fan-out or none (PG-AGENT-03); an inherit model runs on the parent's model
// (PG-AGENT-07a, D-PG7-17). The scenarios launch a few real children
// (`features/agent/frontmatter.feature`,
// `features/plugin/subagent-child.feature`); the other launch plans need
// pi-subagents' own planner.

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
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
  readonly allowNestedSubagents?: boolean;
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

interface DiscoveryModule {
  readonly clearAgentDiscoveryCache: () => void;
  readonly discoverAgents: (
    cwd: string,
    scope: "user",
  ) => { readonly agents: readonly { readonly name: string; readonly model?: string }[] };
}

interface ModelResolutionModule {
  readonly resolveEffectiveSubagentModel: (
    explicitModel: string | undefined,
    agentModel: string | undefined,
    parentModel: { readonly provider: string; readonly id: string },
    availableModels: readonly unknown[],
    preferredProvider: string | undefined,
  ) => string | undefined;
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

/** The agent file the bridge writes for `raw`, in the adapter form over the MCP servers `mcpServerNames`. */
function convertedFile(raw: RawAgentFrontmatter, mcpServerNames?: readonly string[]): string {
  return convertAgent({
    pluginName: "demo",
    pluginRoot: "/root",
    options: undefined,
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
    mcpServerNames,
  }).fileContent;
}

/**
 * The value of the one `<key>: ` line the bridge writes for `raw`, in the
 * adapter form over the written MCP servers `mcpServerNames`.
 */
function convertedLine(
  raw: RawAgentFrontmatter,
  key: string,
  mcpServerNames?: readonly string[],
): string {
  const lines = convertedFile(raw, mcpServerNames)
    .split("\n")
    .filter((line) => line.startsWith(`${key}: `));
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

test("PG-AGENT-09: the exclude name written beside a whole-server grant removes that adapter tool from the child", async (t) => {
  // arrange
  const { peer, launch } = await loadLaunch(t);
  const allowlist = await importPeerModule<McpAllowlistModule>(
    peer,
    "src",
    "runs",
    "shared",
    "mcp-direct-tool-allowlist.js",
  );
  await withHermeticEnvironment("child-launch-grant-exclude-", async ({ agentDir, cwd }) => {
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
            tools: [{ name: "echo" }, { name: "drop" }],
          },
        },
      }),
    );
    const raw = {
      description: "d",
      tools: "Read, mcp__plugin_demo_stub",
      disallowedTools: "mcp__plugin_demo_stub__drop",
    };
    const tools = convertedLine(raw, "tools", ["stub"]).split(",");
    const excludeTools = convertedLine(raw, "excludeTools", ["stub"]).split(",");

    // act
    const child = launch.buildInProcessChildLaunch({
      ...runnerInput(cwd),
      tools: tools.filter((entry) => !entry.startsWith("mcp:")),
      mcpDirectTools: tools
        .filter((entry) => entry.startsWith("mcp:"))
        .map((entry) => entry.slice("mcp:".length)),
      excludeTools,
    });

    // assert
    assert.deepStrictEqual(child.session.tools, ["read", "mcp__plugin_demo_stub__echo"]);
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

test("PG-AGENT-03: the key written for an agent with no tools list authorizes fan-out and keeps ambient MCP tools", async (t) => {
  // arrange
  const { launch } = await loadLaunch(t);
  const { cwd } = await createHermeticEnvironment(t, "child-launch-nested-");
  const value = convertedLine({ description: "d" }, "allowNestedSubagents");

  // act
  const child = launch.buildInProcessChildLaunch({
    ...runnerInput(cwd),
    allowNestedSubagents: value === "true",
  });

  // assert
  assert.deepStrictEqual(
    {
      tools: child.session.tools,
      fanoutChild: child.config.fanoutChild,
      ownsMcpDirectTools: Object.hasOwn(child.session.processEnv, "MCP_DIRECT_TOOLS"),
      mcpDirectTools: child.session.processEnv.MCP_DIRECT_TOOLS,
    },
    { tools: undefined, fanoutChild: true, ownsMcpDirectTools: true, mcpDirectTools: undefined },
  );
});

test("PG-AGENT-03: the exclude list written for a denied Agent authorizes no fan-out", async (t) => {
  // arrange
  const { launch } = await loadLaunch(t);
  const { cwd } = await createHermeticEnvironment(t, "child-launch-nested-denied-");
  const excludeTools = convertedLine(
    { description: "d", disallowedTools: "Agent" },
    "excludeTools",
  );

  // act
  const child = launch.buildInProcessChildLaunch({
    ...runnerInput(cwd),
    excludeTools: excludeTools.split(","),
  });

  // assert
  assert.strictEqual(child.config.fanoutChild, false);
});

test("PG-AGENT-07a / D-PG7-17: the model written for a source inherit runs the child on the parent's model over subagents.defaultModel", async (t) => {
  // arrange
  const { peer } = await loadLaunch(t);
  const agents = await importPeerModule<DiscoveryModule>(peer, "src", "agents", "agents.js");
  const resolution = await importPeerModule<ModelResolutionModule>(
    peer,
    "src",
    "runs",
    "shared",
    "model-resolution.js",
  );
  const { agentDir, cwd } = await createHermeticEnvironment(t, "child-launch-inherit-");
  await writeFile(
    path.join(agentDir, "settings.json"),
    JSON.stringify({ subagents: { defaultModel: "anthropic/claude-haiku-5-5" } }),
  );
  await mkdir(path.join(agentDir, "agents"), { recursive: true });
  await writeFile(
    path.join(agentDir, "agents", "pi-claude-marketplace-demo-lead.md"),
    convertedFile({ name: "lead", description: "d", model: "inherit", tools: "Read" }),
  );
  agents.clearAgentDiscoveryCache();

  // act
  const lead = agents
    .discoverAgents(cwd, "user")
    .agents.find((agent) => agent.name === "demo:lead");
  const model = resolution.resolveEffectiveSubagentModel(
    undefined,
    lead?.model,
    { provider: "anthropic", id: "claude-opus-5-5" },
    [],
    undefined,
  );

  // assert
  assert.strictEqual(model, "anthropic/claude-opus-5-5");
});

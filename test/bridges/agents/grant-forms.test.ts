import assert from "node:assert/strict";
import test from "node:test";

import { convertAgentGrantForms } from "../../../extensions/pi-claude-marketplace/bridges/agents/grant-forms.ts";

import type { GrantFormInput } from "../../../extensions/pi-claude-marketplace/bridges/agents/grant-forms.ts";
import type { RawAgentFrontmatter } from "../../../extensions/pi-claude-marketplace/bridges/agents/types.ts";

const ADAPTER_ASYNC_WARNING =
  "tools include MCP tools, which pi-subagents serves only to background children -- the agent runs in the background (`async: true`), where Claude Code runs it in the foreground; a launch before pi-mcp-adapter has cached the server's tools still fails";

const BUILTIN_ASYNC_WARNING =
  "tools include MCP tools, which pi-subagents serves only to background children -- the agent runs in the background (`async: true`), where Claude Code runs it in the foreground; a launch before Pi's built-in MCP has listed the server's tools still fails";

const BODY = "\nBody content.\n";

function agentInput(raw: RawAgentFrontmatter): GrantFormInput {
  return {
    pluginName: "acme",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: [],
    discovered: {
      sourceName: "bot",
      generatedName: "pi-claude-marketplace-acme-bot",
      sourcePath: "/abs/path/source.md",
      sourceHash: "abc123",
      raw,
      body: "Body content.\n",
    },
    sourceHash: "abc",
    mapModel: false,
  };
}

function yamlList(items: readonly string[]): string {
  return items.length === 0 ? " []" : items.map((item) => `\n    - ${item}`).join("");
}

function expectedFrontmatter(expected: {
  readonly toolsLine?: string;
  readonly inheritSkills: boolean;
  readonly async: boolean;
  readonly droppedTools: readonly string[];
  readonly warnings: readonly string[];
}): string {
  const toolsLine = expected.toolsLine === undefined ? "" : `${expected.toolsLine}\n`;
  return `---
name: acme:bot
description: d
aliases: pi-claude-marketplace-acme-bot
${toolsLine}systemPromptMode: replace
inheritProjectContext: true
inheritSkills: ${expected.inheritSkills}
advertise: true
async: ${expected.async}
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: /abs/path/source.md
  droppedFields: []
  droppedTools:${yamlList(expected.droppedTools)}
  warnings:${yamlList(expected.warnings)}
---
`;
}

const ADAPTER_QUERY_FRONTMATTER = expectedFrontmatter({
  toolsLine: "tools: read,mcp:plugin_acme_db_/query",
  inheritSkills: false,
  async: true,
  droppedTools: [],
  warnings: [ADAPTER_ASYNC_WARNING],
});

/** A stdio server that asks for elicitation, which pi-mcp-adapter cannot run, and a plain one. */
const ELICITING_AND_PLAIN_SERVERS = {
  asker: { command: "node", bareElicitationCapability: true },
  db: { command: "node" },
};

const BUILTIN_QUERY_FRONTMATTER = expectedFrontmatter({
  toolsLine: "tools: read,mcp:plugin_acme_db/query",
  inheritSkills: false,
  async: true,
  droppedTools: [],
  warnings: [BUILTIN_ASYNC_WARNING],
});

test("MGRT-01: a built-in run writes the built-in form and records both forms on the row", () => {
  // arrange
  const input = agentInput({ description: "d", tools: "Read, mcp__plugin_acme_db__query" });

  // act
  const { agent, recorded } = convertAgentGrantForms(input, {
    active: "builtin",
    declaredMcpServers: { db: { command: "node" } },
  });

  // assert
  assert.strictEqual(agent.fileContent, BUILTIN_QUERY_FRONTMATTER + BODY);
  assert.deepStrictEqual(agent.warnings, [BUILTIN_ASYNC_WARNING]);
  assert.deepStrictEqual(recorded, {
    mcpImplementation: "builtin",
    mcpForms: {
      builtin: {
        frontmatter: BUILTIN_QUERY_FRONTMATTER,
        warnings: [BUILTIN_ASYNC_WARNING],
        droppedTools: [],
      },
      adapter: {
        frontmatter: ADAPTER_QUERY_FRONTMATTER,
        warnings: [ADAPTER_ASYNC_WARNING],
        droppedTools: [],
      },
    },
  });
});

for (const active of ["adapter", "none"] as const) {
  test(`MGRT-01: an active implementation of ${active} writes the adapter form and records both forms on the row`, () => {
    // arrange
    const input = agentInput({ description: "d", tools: "Read, mcp__plugin_acme_db__query" });

    // act
    const { agent, recorded } = convertAgentGrantForms(input, {
      active,
      declaredMcpServers: { db: { command: "node" } },
    });

    // assert
    assert.strictEqual(agent.fileContent, ADAPTER_QUERY_FRONTMATTER + BODY);
    assert.deepStrictEqual(recorded, {
      mcpImplementation: "adapter",
      mcpForms: {
        adapter: {
          frontmatter: ADAPTER_QUERY_FRONTMATTER,
          warnings: [ADAPTER_ASYNC_WARNING],
          droppedTools: [],
        },
        builtin: {
          frontmatter: BUILTIN_QUERY_FRONTMATTER,
          warnings: [BUILTIN_ASYNC_WARNING],
          droppedTools: [],
        },
      },
    });
  });
}

test("MGRT-01: an agent that renders the same in both forms records neither field", () => {
  // arrange
  const expectedFileContent =
    expectedFrontmatter({
      toolsLine: "tools: read",
      inheritSkills: false,
      async: false,
      droppedTools: [],
      warnings: [],
    }) + BODY;
  const input = agentInput({ description: "d", tools: "Read" });

  // act
  const { agent, recorded } = convertAgentGrantForms(input, {
    active: "builtin",
    declaredMcpServers: { db: { command: "node" } },
  });

  // assert
  assert.strictEqual(agent.fileContent, expectedFileContent);
  assert.deepStrictEqual(recorded, {});
});

test("D-CF6-10: an omitted tools list in a plugin with a stdio server records both forms for their async warnings", () => {
  // arrange
  const adapterFrontmatter = expectedFrontmatter({
    inheritSkills: true,
    async: true,
    droppedTools: [],
    warnings: [ADAPTER_ASYNC_WARNING],
  });
  const builtinFrontmatter = expectedFrontmatter({
    inheritSkills: true,
    async: true,
    droppedTools: [],
    warnings: [BUILTIN_ASYNC_WARNING],
  });
  const input = agentInput({ description: "d" });

  // act
  const { agent, recorded } = convertAgentGrantForms(input, {
    active: "builtin",
    declaredMcpServers: { db: { command: "node" } },
  });

  // assert
  assert.strictEqual(agent.fileContent, builtinFrontmatter + BODY);
  assert.deepStrictEqual(recorded, {
    mcpImplementation: "builtin",
    mcpForms: {
      builtin: {
        frontmatter: builtinFrontmatter,
        warnings: [BUILTIN_ASYNC_WARNING],
        droppedTools: [],
      },
      adapter: {
        frontmatter: adapterFrontmatter,
        warnings: [ADAPTER_ASYNC_WARNING],
        droppedTools: [],
      },
    },
  });
});

test("MGRT-01: an sse grant stays in the adapter form and is dropped from the built-in form", () => {
  // arrange
  const builtinFrontmatter = expectedFrontmatter({
    toolsLine: "tools: read",
    inheritSkills: false,
    async: false,
    droppedTools: ["mcp__plugin_acme_web__get"],
    warnings: [],
  });
  const adapterFrontmatter = expectedFrontmatter({
    toolsLine: "tools: read,mcp:plugin_acme_web_/get",
    inheritSkills: false,
    async: true,
    droppedTools: [],
    warnings: [ADAPTER_ASYNC_WARNING],
  });
  const input = agentInput({ description: "d", tools: "Read, mcp__plugin_acme_web__get" });

  // act
  const { agent, recorded } = convertAgentGrantForms(input, {
    active: "builtin",
    declaredMcpServers: { web: { type: "sse", url: "https://web.example/sse" } },
  });

  // assert
  assert.strictEqual(agent.fileContent, builtinFrontmatter + BODY);
  assert.deepStrictEqual(agent.droppedTools, ["mcp__plugin_acme_web__get"]);
  assert.deepStrictEqual(recorded, {
    mcpImplementation: "builtin",
    mcpForms: {
      builtin: {
        frontmatter: builtinFrontmatter,
        warnings: [],
        droppedTools: ["mcp__plugin_acme_web__get"],
      },
      adapter: {
        frontmatter: adapterFrontmatter,
        warnings: [ADAPTER_ASYNC_WARNING],
        droppedTools: [],
      },
    },
  });
});

test("AG-11: a built-in run fails when the built-in form maps an explicit tools list to nothing", () => {
  // arrange
  const input = agentInput({ description: "d", tools: "mcp__plugin_acme_web__get" });

  // act & assert
  assert.throws(
    () =>
      convertAgentGrantForms(input, {
        active: "builtin",
        declaredMcpServers: { web: { type: "sse", url: "https://web.example/sse" } },
      }),
    new Error(
      'Cannot convert agent "bot" in plugin "acme": the mapped tool list is empty (pi-subagents has no safe representation of "no tools"). Source tools: mcp__plugin_acme_web__get; disallowedTools: (none).',
    ),
  );
});

for (const active of ["adapter", "none"] as const) {
  test(`AG-11: an active implementation of ${active} leaves out a built-in form that maps an explicit tools list to nothing`, () => {
    // arrange
    const adapterFrontmatter = expectedFrontmatter({
      toolsLine: "tools: mcp:plugin_acme_web_/get",
      inheritSkills: false,
      async: true,
      droppedTools: [],
      warnings: [ADAPTER_ASYNC_WARNING],
    });
    const input = agentInput({ description: "d", tools: "mcp__plugin_acme_web__get" });

    // act
    const { agent, recorded } = convertAgentGrantForms(input, {
      active,
      declaredMcpServers: { web: { type: "sse", url: "https://web.example/sse" } },
    });

    // assert
    assert.strictEqual(agent.fileContent, adapterFrontmatter + BODY);
    assert.deepStrictEqual(recorded, {
      mcpImplementation: "adapter",
      mcpForms: {
        adapter: {
          frontmatter: adapterFrontmatter,
          warnings: [ADAPTER_ASYNC_WARNING],
          droppedTools: [],
        },
      },
    });
  });
}

test("ANAME-02 / MGRT-01: each form maps only the declared servers its implementation runs", () => {
  // arrange
  const adapterFrontmatter = expectedFrontmatter({
    toolsLine: "tools: read,mcp:plugin_acme_db_/query",
    inheritSkills: false,
    async: true,
    droppedTools: ["mcp__plugin_acme_asker__ask"],
    warnings: [ADAPTER_ASYNC_WARNING],
  });
  const builtinFrontmatter = expectedFrontmatter({
    toolsLine: "tools: read,mcp:plugin_acme_asker/ask,mcp:plugin_acme_db/query",
    inheritSkills: false,
    async: true,
    droppedTools: [],
    warnings: [BUILTIN_ASYNC_WARNING],
  });
  const input = agentInput({
    description: "d",
    tools: "Read, mcp__plugin_acme_asker__ask, mcp__plugin_acme_db__query",
  });

  // act
  const { agent, recorded } = convertAgentGrantForms(input, {
    active: "adapter",
    declaredMcpServers: ELICITING_AND_PLAIN_SERVERS,
  });

  // assert
  assert.strictEqual(agent.fileContent, adapterFrontmatter + BODY);
  assert.deepStrictEqual(agent.droppedTools, ["mcp__plugin_acme_asker__ask"]);
  assert.deepStrictEqual(recorded, {
    mcpImplementation: "adapter",
    mcpForms: {
      adapter: {
        frontmatter: adapterFrontmatter,
        warnings: [ADAPTER_ASYNC_WARNING],
        droppedTools: ["mcp__plugin_acme_asker__ask"],
      },
      builtin: {
        frontmatter: builtinFrontmatter,
        warnings: [BUILTIN_ASYNC_WARNING],
        droppedTools: [],
      },
    },
  });
});

test("AG-11: a built-in run leaves out an adapter form that maps an explicit tools list to nothing", () => {
  // arrange
  const builtinFrontmatter = expectedFrontmatter({
    toolsLine: "tools: mcp:plugin_acme_asker/ask",
    inheritSkills: false,
    async: true,
    droppedTools: [],
    warnings: [BUILTIN_ASYNC_WARNING],
  });
  const input = agentInput({ description: "d", tools: "mcp__plugin_acme_asker__ask" });

  // act
  const { agent, recorded } = convertAgentGrantForms(input, {
    active: "builtin",
    declaredMcpServers: ELICITING_AND_PLAIN_SERVERS,
  });

  // assert
  assert.strictEqual(agent.fileContent, builtinFrontmatter + BODY);
  assert.deepStrictEqual(recorded, {
    mcpImplementation: "builtin",
    mcpForms: {
      builtin: {
        frontmatter: builtinFrontmatter,
        warnings: [BUILTIN_ASYNC_WARNING],
        droppedTools: [],
      },
    },
  });
});

test("ANAME-02 / MGRT-01: without grant forms the agent maps no MCP server and the row records nothing", () => {
  // arrange
  const expectedFileContent =
    expectedFrontmatter({
      toolsLine: "tools: read",
      inheritSkills: false,
      async: false,
      droppedTools: ["mcp__plugin_acme_db__query"],
      warnings: [],
    }) + BODY;
  const input = agentInput({ description: "d", tools: "Read, mcp__plugin_acme_db__query" });

  // act
  const { agent, recorded } = convertAgentGrantForms(input, undefined);

  // assert
  assert.strictEqual(agent.fileContent, expectedFileContent);
  assert.deepStrictEqual(recorded, {});
});

test("MGRT-01: the built-in form maps every supported declared server, one named __proto__ among them", () => {
  // arrange
  const builtinFrontmatter = expectedFrontmatter({
    toolsLine: "tools: mcp:plugin_acme___proto__,mcp:plugin_acme_zed",
    inheritSkills: false,
    async: true,
    droppedTools: ["mcp__plugin_acme_web"],
    warnings: [BUILTIN_ASYNC_WARNING],
  });
  const declaredMcpServers = {
    zed: { command: "zed" },
    web: { type: "sse", url: "https://web.example/sse" },
    ["__proto__"]: { command: "proto" },
  };
  const input = agentInput({
    description: "d",
    tools: "mcp__plugin_acme___proto__, mcp__plugin_acme_zed, mcp__plugin_acme_web",
  });

  // act
  const { agent } = convertAgentGrantForms(input, { active: "builtin", declaredMcpServers });

  // assert
  assert.strictEqual(agent.fileContent, builtinFrontmatter + BODY);
});

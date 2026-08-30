import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  assertNoAgentCollisions,
  convertAgent,
  MODEL_MAP,
  THINKING_VALUES,
  TOOL_MAP,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/convert.ts";

describe("MODEL_MAP", () => {
  test("exposes the complete supported Claude-to-Pi model mapping", () => {
    // arrange
    const expectedModelMap = {
      sonnet: "anthropic/claude-sonnet-4-6",
      opus: "anthropic/claude-opus-4-7",
      haiku: "anthropic/claude-haiku-4-5",
    };

    // act
    const modelMap = { ...MODEL_MAP };

    // assert
    assert.deepStrictEqual(modelMap, expectedModelMap);
    assert.ok(Object.isFrozen(MODEL_MAP));
  });
});

describe("TOOL_MAP", () => {
  test("exposes the complete supported Claude-to-Pi tool mapping", () => {
    // arrange
    const expectedToolMap = {
      Read: "read",
      Bash: "bash",
      Edit: "edit",
      Write: "write",
      Grep: "grep",
      Glob: "find",
      LS: "ls",
    };

    // act
    const toolMap = { ...TOOL_MAP };

    // assert
    assert.deepStrictEqual(toolMap, expectedToolMap);
    assert.ok(Object.isFrozen(TOOL_MAP));
  });
});

describe("THINKING_VALUES", () => {
  test("exposes the complete supported thinking allowlist", () => {
    // arrange
    const expectedThinkingValues = ["off", "minimal", "low", "medium", "high", "xhigh"];

    // act
    const thinkingValues = [...THINKING_VALUES];

    // assert
    assert.deepStrictEqual(thinkingValues, expectedThinkingValues);
  });
});

describe("convertAgent", () => {
  test("converts the complete mapped agent contract into independently pinned bytes", () => {
    // arrange
    const expectedAgent = {
      sourceName: "changes-reviewer",
      generatedName: "pi-claude-marketplace-spec-tree-changes-reviewer",
      sourcePath: "/plugins/spec-tree/agents/changes-reviewer.md",
      fileContent: `---
name: pi-claude-marketplace-spec-tree-changes-reviewer
description: Reviews changes
model: anthropic/claude-sonnet-4-6
tools: bash,read
thinking: high
skills: spec-tree-review-changes
skillPath: ../pi-claude-marketplace/resources/skills
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: true
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: spec-tree
  sourceAgent: changes-reviewer
  sourcePath: /plugins/spec-tree/agents/changes-reviewer.md
  originalModel: sonnet
  droppedFields:
    - color
    - hooks
  droppedTools: []
  warnings:
    - skill reference "other-plugin:foreign" is qualified with a different plugin -- dropped (only this plugin's skills can be preloaded)
    - unknown skill reference "phantom" -- dropped
---

## Pi coding agent skill legend

These instructions reference Claude skills by their original names. In this Pi session:

- \`spec-tree:review-changes\` → skill \`spec-tree-review-changes\` (available on demand)

Review /plugins/spec-tree and /data/spec-tree for /workspace.
Use spec-tree:review-changes.
Keep \${CLAUDE_SKILL_DIR} literal.
`,
      sourceHash: "converted-hash",
      droppedFields: ["color", "hooks"],
      droppedTools: [],
      warnings: [
        'skill reference "other-plugin:foreign" is qualified with a different plugin -- dropped (only this plugin\'s skills can be preloaded)',
        'unknown skill reference "phantom" -- dropped',
      ],
      originalModel: "sonnet",
    };

    // act
    const agent = convertAgent({
      pluginName: "spec-tree",
      pluginRoot: "/plugins/spec-tree",
      pluginDataDir: "/data/spec-tree",
      knownSkills: ["spec-tree-review-changes"],
      discovered: {
        sourceName: "changes-reviewer",
        generatedName: "pi-claude-marketplace-spec-tree-changes-reviewer",
        sourcePath: "/plugins/spec-tree/agents/changes-reviewer.md",
        sourceHash: "discovery-hash",
        raw: {
          name: "changes-reviewer",
          description: "Reviews changes",
          model: "sonnet",
          tools: `["Bash", 'Read', "Skill", "Bash"]`,
          disallowedTools: "LS",
          thinking: "high",
          effort: "low",
          skills: "spec-tree:review-changes,review-changes,other-plugin:foreign,phantom",
          color: "blue",
          hooks: "ignored",
        },
        body:
          "Review ${CLAUDE_PLUGIN_ROOT} and ${CLAUDE_PLUGIN_DATA} for ${CLAUDE_PROJECT_DIR}.\n" +
          "Use spec-tree:review-changes.\n" +
          "Keep ${CLAUDE_SKILL_DIR} literal.\n",
      },
      sourceHash: "converted-hash",
      mapModel: true,
      projectDir: "/workspace",
    });

    // assert
    assert.deepStrictEqual(agent, expectedAgent);
  });

  test("omits model provenance when model mapping is disabled", () => {
    // arrange
    const expectedAgent = {
      sourceName: "reviewer",
      generatedName: "pi-claude-marketplace-acme-reviewer",
      sourcePath: "/plugins/acme/agents/reviewer.md",
      fileContent: `---
name: pi-claude-marketplace-acme-reviewer
description: Reviews files
tools: read
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: reviewer
  sourcePath: /plugins/acme/agents/reviewer.md
  droppedFields: []
  droppedTools: []
  warnings: []
---

Review files.
`,
      sourceHash: "converted-hash",
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    };

    // act
    const agent = convertAgent({
      pluginName: "acme",
      pluginRoot: "/plugins/acme",
      pluginDataDir: "/data/acme",
      knownSkills: [],
      discovered: {
        sourceName: "reviewer",
        generatedName: "pi-claude-marketplace-acme-reviewer",
        sourcePath: "/plugins/acme/agents/reviewer.md",
        sourceHash: "discovery-hash",
        raw: { description: "Reviews files", model: "sonnet", tools: "Read" },
        body: "Review files.\n",
      },
      sourceHash: "converted-hash",
      mapModel: false,
    });

    // assert
    assert.deepStrictEqual(agent, expectedAgent);
  });
});

describe("assertNoAgentCollisions", () => {
  test("accepts distinct generated names", () => {
    // arrange
    const agents = [
      { sourceName: "reviewer", generatedName: "pi-claude-marketplace-acme-reviewer" },
      { sourceName: "writer", generatedName: "pi-claude-marketplace-acme-writer" },
    ];

    // act
    const assertDistinctNames = () => assertNoAgentCollisions(agents);

    // assert
    assert.doesNotThrow(assertDistinctNames);
  });
});

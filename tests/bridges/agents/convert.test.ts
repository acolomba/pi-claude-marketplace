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

  for (const { sourceModel, expectedModelLine, expectedOriginalModel, expectedWarnings } of [
    {
      sourceModel: undefined,
      expectedModelLine: undefined,
      expectedOriginalModel: undefined,
      expectedWarnings: [],
    },
    {
      sourceModel: "",
      expectedModelLine: undefined,
      expectedOriginalModel: undefined,
      expectedWarnings: [],
    },
    {
      sourceModel: "inherit",
      expectedModelLine: undefined,
      expectedOriginalModel: "inherit",
      expectedWarnings: [],
    },
    {
      sourceModel: "opus",
      expectedModelLine: "model: anthropic/claude-opus-4-7",
      expectedOriginalModel: "opus",
      expectedWarnings: [],
    },
    {
      sourceModel: "haiku",
      expectedModelLine: "model: anthropic/claude-haiku-4-5",
      expectedOriginalModel: "haiku",
      expectedWarnings: [],
    },
    {
      sourceModel: "future-model",
      expectedModelLine: undefined,
      expectedOriginalModel: "future-model",
      expectedWarnings: ['unknown model "future-model" -- omitted from generated frontmatter'],
    },
  ]) {
    test(`maps source model ${JSON.stringify(sourceModel)} without changing other fields`, () => {
      // arrange
      const expectedFrontmatterLine = expectedModelLine;
      const expectedOriginal = expectedOriginalModel;
      const expectedWarningOrder = expectedWarnings;

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
          raw: {
            description: "Reviews files",
            ...(sourceModel !== undefined && { model: sourceModel }),
            tools: "Read",
          },
          body: "Review files.\n",
        },
        sourceHash: "converted-hash",
        mapModel: true,
      });

      // assert
      const generatedFrontmatter = agent.fileContent.slice(
        0,
        agent.fileContent.indexOf("\n---\n", 4),
      );
      assert.strictEqual(
        generatedFrontmatter.split("\n").find((line) => line.startsWith("model:")),
        expectedFrontmatterLine,
      );
      assert.strictEqual(agent.originalModel, expectedOriginal);
      assert.deepStrictEqual(agent.warnings, expectedWarningOrder);
      assert.deepStrictEqual(agent.droppedFields, []);
      assert.deepStrictEqual(agent.droppedTools, []);
    });
  }

  for (const { sourceThinking, sourceEffort, expectedThinkingLine, expectedWarnings } of [
    {
      sourceThinking: "turbo",
      sourceEffort: "xhigh",
      expectedThinkingLine: "thinking: xhigh",
      expectedWarnings: ['unknown thinking value "turbo" -- using effort "xhigh" as fallback'],
    },
    {
      sourceThinking: "turbo",
      sourceEffort: "",
      expectedThinkingLine: undefined,
      expectedWarnings: ['unknown thinking value "turbo" -- omitted from generated frontmatter'],
    },
    {
      sourceThinking: undefined,
      sourceEffort: "minimal",
      expectedThinkingLine: "thinking: minimal",
      expectedWarnings: [],
    },
    {
      sourceThinking: "",
      sourceEffort: "turbo",
      expectedThinkingLine: undefined,
      expectedWarnings: ['unknown effort value "turbo" -- omitted from generated frontmatter'],
    },
  ]) {
    test(`maps thinking ${JSON.stringify(sourceThinking)} and effort ${JSON.stringify(sourceEffort)}`, () => {
      // arrange
      const expectedFrontmatterLine = expectedThinkingLine;
      const expectedWarningOrder = expectedWarnings;

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
          raw: {
            description: "Reviews files",
            tools: "Read",
            ...(sourceThinking !== undefined && { thinking: sourceThinking }),
            effort: sourceEffort,
          },
          body: "Review files.\n",
        },
        sourceHash: "converted-hash",
        mapModel: false,
      });

      // assert
      const generatedFrontmatter = agent.fileContent.slice(
        0,
        agent.fileContent.indexOf("\n---\n", 4),
      );
      assert.strictEqual(
        generatedFrontmatter.split("\n").find((line) => line.startsWith("thinking:")),
        expectedFrontmatterLine,
      );
      assert.deepStrictEqual(agent.warnings, expectedWarningOrder);
      assert.deepStrictEqual(agent.droppedFields, []);
      assert.deepStrictEqual(agent.droppedTools, []);
    });
  }

  test("keeps warning order across fallback, model, tool, thinking, and skill degradation", () => {
    // arrange
    const expectedWarnings = [
      "source description was missing or empty -- using fallback",
      'unknown model "future-model" -- omitted from generated frontmatter',
      "source agent omitted `tools:` -- defaulted to read,bash,edit. Add `tools: read,bash,edit` (or your intended subset) to the source agent to silence this warning.",
      'unknown effort value "turbo" -- omitted from generated frontmatter',
      'skill reference "other-plugin:foreign" is qualified with a different plugin -- dropped (only this plugin\'s skills can be preloaded)',
      'unknown skill reference "phantom" -- dropped',
    ];

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
        raw: {
          model: "future-model",
          effort: "turbo",
          skills: "other-plugin:foreign,phantom",
        },
        body: "Review files.\n",
      },
      sourceHash: "converted-hash",
      mapModel: true,
    });

    // assert
    assert.deepStrictEqual(agent.warnings, expectedWarnings);
    assert.deepStrictEqual(agent.droppedFields, []);
    assert.deepStrictEqual(agent.droppedTools, []);
  });

  test("ignores unmapped disallowed tools while retaining mapped and dropped source tools", () => {
    // arrange
    const expectedAgentFields = {
      droppedFields: [],
      droppedTools: ["WebFetch"],
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
        raw: {
          description: "Reviews files",
          tools: "Read,Read,WebFetch",
          disallowedTools: "Skill,Unknown",
        },
        body: "Review files.\n",
      },
      sourceHash: "converted-hash",
      mapModel: false,
    });

    // assert
    assert.match(agent.fileContent, /^tools: read$/m);
    assert.deepStrictEqual(
      {
        droppedFields: agent.droppedFields,
        droppedTools: agent.droppedTools,
        warnings: agent.warnings,
      },
      expectedAgentFields,
    );
  });

  test("rejects a source whose unknown tools leave no safe Pi tool", () => {
    // arrange
    const convertUnknownTools = () =>
      convertAgent({
        pluginName: "acme",
        pluginRoot: "/plugins/acme",
        pluginDataDir: "/data/acme",
        knownSkills: [],
        discovered: {
          sourceName: "reviewer",
          generatedName: "pi-claude-marketplace-acme-reviewer",
          sourcePath: "/plugins/acme/agents/reviewer.md",
          sourceHash: "discovery-hash",
          raw: { description: "Reviews files", tools: "WebFetch" },
          body: "Review files.\n",
        },
        sourceHash: "converted-hash",
        mapModel: false,
      });

    // act & assert
    assert.throws(
      convertUnknownTools,
      new Error(
        'Cannot convert agent "reviewer" in plugin "acme": the mapped tool list is empty (pi-subagents has no safe representation of "no tools"). Source tools: WebFetch; disallowedTools: (none).',
      ),
    );
  });

  test("rejects a Skill-only source with the inheritSkills explanation", () => {
    // arrange
    const convertSkillOnlyAgent = () =>
      convertAgent({
        pluginName: "acme",
        pluginRoot: "/plugins/acme",
        pluginDataDir: "/data/acme",
        knownSkills: [],
        discovered: {
          sourceName: "reviewer",
          generatedName: "pi-claude-marketplace-acme-reviewer",
          sourcePath: "/plugins/acme/agents/reviewer.md",
          sourceHash: "discovery-hash",
          raw: { description: "Reviews files", tools: "Skill" },
          body: "Review files.\n",
        },
        sourceHash: "converted-hash",
        mapModel: false,
      });

    // act & assert
    assert.throws(
      convertSkillOnlyAgent,
      new Error(
        'Cannot convert agent "reviewer" in plugin "acme": the mapped tool list is empty (pi-subagents has no safe representation of "no tools"). Source tools: Skill; disallowedTools: (none). Note: the Skill tool maps to inheritSkills, not to a Pi tool, so it does not count toward the tool list.',
      ),
    );
  });

  test("labels a malformed changing tools accessor as default when the value disappears", () => {
    // arrange
    let toolsReadCount = 0;
    const raw = {
      description: "Reviews files",
      get tools(): string {
        toolsReadCount += 1;
        return toolsReadCount === 1 ? "WebFetch" : (undefined as unknown as string);
      },
    };
    const convertMalformedAgent = () =>
      convertAgent({
        pluginName: "acme",
        pluginRoot: "/plugins/acme",
        pluginDataDir: "/data/acme",
        knownSkills: [],
        discovered: {
          sourceName: "reviewer",
          generatedName: "pi-claude-marketplace-acme-reviewer",
          sourcePath: "/plugins/acme/agents/reviewer.md",
          sourceHash: "discovery-hash",
          raw,
          body: "Review files.\n",
        },
        sourceHash: "converted-hash",
        mapModel: false,
      });

    // act & assert
    assert.throws(
      convertMalformedAgent,
      new Error(
        'Cannot convert agent "reviewer" in plugin "acme": the mapped tool list is empty (pi-subagents has no safe representation of "no tools"). Source tools: (default read,bash,edit); disallowedTools: (none).',
      ),
    );
  });

  test("warn-drops malformed skill metadata and ignores malformed body tokens", () => {
    // arrange
    const expectedWarnings = [
      'unknown skill reference "spec-tree:" -- dropped',
      'unknown skill reference "spec-tree:sub/skill" -- dropped',
      'unknown skill reference "spec-tree:a\tb" -- dropped',
    ];

    // act
    const agent = convertAgent({
      pluginName: "spec-tree",
      pluginRoot: "/plugins/spec-tree",
      pluginDataDir: "/data/spec-tree",
      knownSkills: ["spec-tree-review-changes"],
      discovered: {
        sourceName: "reviewer",
        generatedName: "pi-claude-marketplace-spec-tree-reviewer",
        sourcePath: "/plugins/spec-tree/agents/reviewer.md",
        sourceHash: "discovery-hash",
        raw: {
          description: "Reviews files",
          tools: "Read",
          skills: "spec-tree:,spec-tree:sub/skill,spec-tree:a\tb",
        },
        body:
          "Ignore spec-tree:spec-tree-, spec-tree:phantom, other-spec-tree:review-changes, " +
          "and other.spec-tree:review-changes.\n",
      },
      sourceHash: "converted-hash",
      mapModel: false,
    });

    // assert
    assert.deepStrictEqual(agent.warnings, expectedWarnings);
    assert.doesNotMatch(agent.fileContent, /## Pi coding agent skill legend/);
    assert.deepStrictEqual(agent.droppedFields, []);
    assert.deepStrictEqual(agent.droppedTools, []);
  });

  test("deduplicates body tokens in first-occurrence order, including fenced code", () => {
    // arrange
    const expectedLegend = `## Pi coding agent skill legend

These instructions reference Claude skills by their original names. In this Pi session:

- \`spec-tree:review-changes\` → skill \`spec-tree-review-changes\` (available on demand)
- \`spec-tree:other\` → skill \`spec-tree-other\` (available on demand)`;

    // act
    const agent = convertAgent({
      pluginName: "spec-tree",
      pluginRoot: "/plugins/spec-tree",
      pluginDataDir: "/data/spec-tree",
      knownSkills: ["spec-tree-review-changes", "spec-tree-other"],
      discovered: {
        sourceName: "reviewer",
        generatedName: "pi-claude-marketplace-spec-tree-reviewer",
        sourcePath: "/plugins/spec-tree/agents/reviewer.md",
        sourceHash: "discovery-hash",
        raw: { description: "Reviews files", tools: "Read" },
        body:
          "Use spec-tree:review-changes twice: spec-tree:review-changes.\n" +
          "```\npi skill spec-tree:other\n```\n",
      },
      sourceHash: "converted-hash",
      mapModel: false,
    });

    // assert
    assert.match(
      agent.fileContent,
      new RegExp(expectedLegend.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    assert.deepStrictEqual(agent.warnings, []);
  });

  test("preserves the CSV tools and bare skills byte contract", () => {
    // arrange
    const expectedFileContent = `---
name: pi-claude-marketplace-acme-bot
description: d
tools: read,bash
skills: acme-knowledge
skillPath: ../pi-claude-marketplace/resources/skills
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: /abs/path/source.md
  droppedFields: []
  droppedTools: []
  warnings:
    - unknown skill reference "phantom" -- dropped
---

Body.
`;

    // act
    const agent = convertAgent({
      pluginName: "acme",
      pluginRoot: "/root",
      pluginDataDir: "/data",
      knownSkills: ["acme-knowledge"],
      discovered: {
        sourceName: "bot",
        generatedName: "pi-claude-marketplace-acme-bot",
        sourcePath: "/abs/path/source.md",
        sourceHash: "abc123",
        raw: {
          name: "bot",
          description: "d",
          tools: "Read,Bash",
          skills: "knowledge,phantom",
        },
        body: "Body.\n",
      },
      sourceHash: "abc",
      mapModel: false,
    });

    // assert
    assert.strictEqual(agent.fileContent, expectedFileContent);
  });

  test("preserves the inline-array tools byte contract", () => {
    // arrange
    const expectedFileContent = `---
name: pi-claude-marketplace-acme-bot
description: d
tools: read,bash
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: /abs/path/source.md
  droppedFields: []
  droppedTools: []
  warnings: []
---

Body.
`;

    // act
    const agent = convertAgent({
      pluginName: "acme",
      pluginRoot: "/root",
      pluginDataDir: "/data",
      knownSkills: [],
      discovered: {
        sourceName: "bot",
        generatedName: "pi-claude-marketplace-acme-bot",
        sourcePath: "/abs/path/source.md",
        sourceHash: "abc123",
        raw: { name: "bot", description: "d", tools: '["Read", "Bash"]' },
        body: "Body.\n",
      },
      sourceHash: "abc",
      mapModel: false,
    });

    // assert
    assert.strictEqual(agent.fileContent, expectedFileContent);
  });

  test("preserves dropped frontmatter fields in generated bytes", () => {
    // arrange
    const expectedFileContent = `---
name: pi-claude-marketplace-acme-bot
description: d
tools: read
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: /abs/path/source.md
  droppedFields:
    - color
    - hooks
  droppedTools: []
  warnings: []
---

Body content.
`;

    // act
    const agent = convertAgent({
      pluginName: "acme",
      pluginRoot: "/root",
      pluginDataDir: "/data",
      knownSkills: [],
      discovered: {
        sourceName: "bot",
        generatedName: "pi-claude-marketplace-acme-bot",
        sourcePath: "/abs/path/source.md",
        sourceHash: "abc123",
        raw: { description: "d", tools: "Read", color: "blue", hooks: "x" },
        body: "Body content.\n",
      },
      sourceHash: "abc",
      mapModel: false,
    });

    // assert
    assert.strictEqual(agent.fileContent, expectedFileContent);
  });

  test("preserves omitted-tools defaults and their warning bytes", () => {
    // arrange
    const expectedFileContent = `---
name: pi-claude-marketplace-acme-bot
description: d
tools: read,bash,edit
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: /abs/path/source.md
  droppedFields: []
  droppedTools: []
  warnings:
    - source agent omitted \`tools:\` -- defaulted to read,bash,edit. Add \`tools: read,bash,edit\` (or your intended subset) to the source agent to silence this warning.
---

Body content.
`;

    // act
    const agent = convertAgent({
      pluginName: "acme",
      pluginRoot: "/root",
      pluginDataDir: "/data",
      knownSkills: [],
      discovered: {
        sourceName: "bot",
        generatedName: "pi-claude-marketplace-acme-bot",
        sourcePath: "/abs/path/source.md",
        sourceHash: "abc123",
        raw: { description: "d" },
        body: "Body content.\n",
      },
      sourceHash: "abc",
      mapModel: false,
    });

    // assert
    assert.strictEqual(agent.fileContent, expectedFileContent);
  });

  test("preserves disallowed-tool filtering bytes", () => {
    // arrange
    const expectedFileContent = `---
name: pi-claude-marketplace-acme-bot
description: d
tools: read,bash
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: /abs/path/source.md
  droppedFields: []
  droppedTools: []
  warnings: []
---

Body content.
`;

    // act
    const agent = convertAgent({
      pluginName: "acme",
      pluginRoot: "/root",
      pluginDataDir: "/data",
      knownSkills: [],
      discovered: {
        sourceName: "bot",
        generatedName: "pi-claude-marketplace-acme-bot",
        sourcePath: "/abs/path/source.md",
        sourceHash: "abc123",
        raw: { description: "d", tools: "Read,Bash,Edit", disallowedTools: "Edit" },
        body: "Body content.\n",
      },
      sourceHash: "abc",
      mapModel: false,
    });

    // assert
    assert.strictEqual(agent.fileContent, expectedFileContent);
  });

  test("preserves description-fallback bytes", () => {
    // arrange
    const expectedFileContent = `---
name: pi-claude-marketplace-acme-bot
description: Imported Claude Code plugin agent bot from plugin acme.
tools: read
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: /abs/path/source.md
  droppedFields: []
  droppedTools: []
  warnings:
    - source description was missing or empty -- using fallback
---

Body content.
`;

    // act
    const agent = convertAgent({
      pluginName: "acme",
      pluginRoot: "/root",
      pluginDataDir: "/data",
      knownSkills: [],
      discovered: {
        sourceName: "bot",
        generatedName: "pi-claude-marketplace-acme-bot",
        sourcePath: "/abs/path/source.md",
        sourceHash: "abc123",
        raw: { tools: "Read" },
        body: "Body content.\n",
      },
      sourceHash: "abc",
      mapModel: false,
    });

    // assert
    assert.strictEqual(agent.fileContent, expectedFileContent);
  });

  test("preserves a token-free CRLF body's final carriage return", () => {
    // arrange
    const expectedFileContent = `---
name: pi-claude-marketplace-acme-bot
description: d
tools: read,bash
skills: acme-knowledge
skillPath: ../pi-claude-marketplace/resources/skills
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: /abs/path/source.md
  droppedFields: []
  droppedTools: []
  warnings: []
---

Body.\r
`;

    // act
    const agent = convertAgent({
      pluginName: "acme",
      pluginRoot: "/root",
      pluginDataDir: "/data",
      knownSkills: ["acme-knowledge"],
      discovered: {
        sourceName: "bot",
        generatedName: "pi-claude-marketplace-acme-bot",
        sourcePath: "/abs/path/source.md",
        sourceHash: "abc123",
        raw: { name: "bot", description: "d", tools: "Read,Bash", skills: "knowledge" },
        body: "Body.\r\n",
      },
      sourceHash: "abc",
      mapModel: false,
    });

    // assert
    assert.strictEqual(agent.fileContent, expectedFileContent);
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

  test("reports every colliding generated name with source order intact", () => {
    // arrange
    const assertDistinctNames = () =>
      assertNoAgentCollisions([
        { sourceName: "reviewer", generatedName: "pi-claude-marketplace-acme-reviewer" },
        { sourceName: "acme-reviewer", generatedName: "pi-claude-marketplace-acme-reviewer" },
        { sourceName: "writer", generatedName: "pi-claude-marketplace-acme-writer" },
        { sourceName: "acme-writer", generatedName: "pi-claude-marketplace-acme-writer" },
      ]);

    // act & assert
    assert.throws(
      assertDistinctNames,
      new Error(
        'Generated agent name collision detected. Rename one of the source agents:\n  "pi-claude-marketplace-acme-reviewer" <- ["reviewer", "acme-reviewer"]\n  "pi-claude-marketplace-acme-writer" <- ["writer", "acme-writer"]',
      ),
    );
  });
});

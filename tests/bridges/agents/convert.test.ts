import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  convertAgent,
  GUIDED_DROPPED_FIELDS,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/convert.ts";

describe("GUIDED_DROPPED_FIELDS", () => {
  test("exposes the complete guided set and every member warns when dropped", () => {
    // arrange
    const expectedGuidedFields = ["allowed-tools", "mcpServers", "permissionMode", "hooks"];

    // act
    const guidedFields = [...GUIDED_DROPPED_FIELDS];

    // assert
    assert.deepStrictEqual(guidedFields, expectedGuidedFields);
    for (const field of expectedGuidedFields) {
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
          raw: { description: "d", tools: "Read", [field]: "x" },
          body: "Body content.\n",
        },
        sourceHash: "abc",
        mapModel: false,
      });
      assert.deepStrictEqual(agent.droppedFields, [field]);
      assert.strictEqual(
        agent.warnings.some((warning) => warning.includes(`\`${field}\``)),
        true,
        `expected a targeted warning naming ${field}`,
      );
    }
  });
});

describe("convertAgent", () => {
  for (const {
    label,
    sourceFields,
    expectedMapping,
    expectedModelProvenance,
    expectedOriginalModel,
  } of [
    {
      label: "model sonnet",
      sourceFields: {
        model: "sonnet",
      },
      expectedMapping: "model: anthropic/claude-sonnet-4-6\ntools: read\n",
      expectedModelProvenance: "  originalModel: sonnet\n",
      expectedOriginalModel: {
        originalModel: "sonnet",
      },
    },
    {
      label: "model opus",
      sourceFields: {
        model: "opus",
      },
      expectedMapping: "model: anthropic/claude-opus-4-7\ntools: read\n",
      expectedModelProvenance: "  originalModel: opus\n",
      expectedOriginalModel: {
        originalModel: "opus",
      },
    },
    {
      label: "model haiku",
      sourceFields: {
        model: "haiku",
      },
      expectedMapping: "model: anthropic/claude-haiku-4-5\ntools: read\n",
      expectedModelProvenance: "  originalModel: haiku\n",
      expectedOriginalModel: {
        originalModel: "haiku",
      },
    },
    {
      label: "tool Read",
      sourceFields: {
        tools: "Read",
      },
      expectedMapping: "tools: read\n",
      expectedModelProvenance: "",
      expectedOriginalModel: {},
    },
    {
      label: "tool Bash",
      sourceFields: {
        tools: "Bash",
      },
      expectedMapping: "tools: bash\n",
      expectedModelProvenance: "",
      expectedOriginalModel: {},
    },
    {
      label: "tool Edit",
      sourceFields: {
        tools: "Edit",
      },
      expectedMapping: "tools: edit\n",
      expectedModelProvenance: "",
      expectedOriginalModel: {},
    },
    {
      label: "tool Write",
      sourceFields: {
        tools: "Write",
      },
      expectedMapping: "tools: write\n",
      expectedModelProvenance: "",
      expectedOriginalModel: {},
    },
    {
      label: "tool Grep",
      sourceFields: {
        tools: "Grep",
      },
      expectedMapping: "tools: grep\n",
      expectedModelProvenance: "",
      expectedOriginalModel: {},
    },
    {
      label: "tool Glob",
      sourceFields: {
        tools: "Glob",
      },
      expectedMapping: "tools: find\n",
      expectedModelProvenance: "",
      expectedOriginalModel: {},
    },
    {
      label: "tool LS",
      sourceFields: {
        tools: "LS",
      },
      expectedMapping: "tools: ls\n",
      expectedModelProvenance: "",
      expectedOriginalModel: {},
    },
    {
      label: "thinking off",
      sourceFields: {
        thinking: "off",
      },
      expectedMapping: "tools: read\nthinking: off\n",
      expectedModelProvenance: "",
      expectedOriginalModel: {},
    },
    {
      label: "thinking minimal",
      sourceFields: {
        thinking: "minimal",
      },
      expectedMapping: "tools: read\nthinking: minimal\n",
      expectedModelProvenance: "",
      expectedOriginalModel: {},
    },
    {
      label: "thinking low",
      sourceFields: {
        thinking: "low",
      },
      expectedMapping: "tools: read\nthinking: low\n",
      expectedModelProvenance: "",
      expectedOriginalModel: {},
    },
    {
      label: "thinking medium",
      sourceFields: {
        thinking: "medium",
      },
      expectedMapping: "tools: read\nthinking: medium\n",
      expectedModelProvenance: "",
      expectedOriginalModel: {},
    },
    {
      label: "thinking high",
      sourceFields: {
        thinking: "high",
      },
      expectedMapping: "tools: read\nthinking: high\n",
      expectedModelProvenance: "",
      expectedOriginalModel: {},
    },
    {
      label: "thinking xhigh",
      sourceFields: {
        thinking: "xhigh",
      },
      expectedMapping: "tools: read\nthinking: xhigh\n",
      expectedModelProvenance: "",
      expectedOriginalModel: {},
    },
  ]) {
    test(`converts supported ${label} into the complete agent contract`, () => {
      // arrange
      const expectedAgent = {
        sourceName: "reviewer",
        generatedName: "pi-claude-marketplace-acme-reviewer",
        sourcePath: "/plugins/acme/agents/reviewer.md",
        fileContent: `---
name: pi-claude-marketplace-acme-reviewer
description: Reviews files
${expectedMapping}systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: reviewer
  sourcePath: /plugins/acme/agents/reviewer.md
${expectedModelProvenance}  droppedFields: []
  droppedTools: []
  warnings: []
---

Review files.
`,
        sourceHash: "converted-hash",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
        ...expectedOriginalModel,
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
          raw: { description: "Reviews files", tools: "Read", ...sourceFields },
          body: "Review files.\n",
        },
        sourceHash: "converted-hash",
        mapModel: true,
      });

      // assert
      assert.deepStrictEqual(agent, expectedAgent);
    });
  }

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
    - agent-level \`hooks\` is not converted -- dropped (Claude Code ignores it for plugin agents too; plugin-level hooks/hooks.json still installs).
---

Review /plugins/spec-tree and /data/spec-tree for /workspace.
Use /skill:spec-tree-review-changes.
Keep \${CLAUDE_SKILL_DIR} literal.
`,
      sourceHash: "converted-hash",
      droppedFields: ["color", "hooks"],
      droppedTools: [],
      warnings: [
        'skill reference "other-plugin:foreign" is qualified with a different plugin -- dropped (only this plugin\'s skills can be preloaded)',
        'unknown skill reference "phantom" -- dropped',
        "agent-level `hooks` is not converted -- dropped (Claude Code ignores it for plugin agents too; plugin-level hooks/hooks.json still installs).",
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

  test("keeps warning order across fallback, model, thinking, skill, and dropped-field degradation", () => {
    // arrange
    const expectedWarnings = [
      "source description was missing or empty -- using fallback",
      'unknown model "future-model" -- omitted from generated frontmatter',
      'unknown effort value "turbo" -- omitted from generated frontmatter',
      'skill reference "other-plugin:foreign" is qualified with a different plugin -- dropped (only this plugin\'s skills can be preloaded)',
      'unknown skill reference "phantom" -- dropped',
      "`allowed-tools` is a slash-command field, not an agent frontmatter field -- dropped (Claude Code ignores it on agents too). Declare `tools:` in the source agent instead.",
      "agent-level `mcpServers` is not converted -- dropped (Claude Code ignores it for plugin agents too). " +
        'To grant this agent MCP tools, set subagents.agentOverrides["pi-claude-marketplace-acme-reviewer"].tools ' +
        "(e.g. read,bash,mcp:<server>) in Pi settings.",
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
          "allowed-tools": "Read, Bash",
          mcpServers: "echo",
        },
        body: "Review files.\n",
      },
      sourceHash: "converted-hash",
      mapModel: true,
    });

    // assert
    assert.deepStrictEqual(agent.warnings, expectedWarnings);
    assert.deepStrictEqual(agent.droppedFields, ["allowed-tools", "mcpServers"]);
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

  test("rejects an explicit tools list fully removed by disallowedTools", () => {
    // arrange
    const convertDisallowEmptiedTools = () =>
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
          raw: { description: "Reviews files", tools: "Edit", disallowedTools: "Edit" },
          body: "Review files.\n",
        },
        sourceHash: "converted-hash",
        mapModel: false,
      });

    // act & assert
    assert.throws(
      convertDisallowEmptiedTools,
      new Error(
        'Cannot convert agent "reviewer" in plugin "acme": the mapped tool list is empty (pi-subagents has no safe representation of "no tools"). Source tools: Edit; disallowedTools: Edit.',
      ),
    );
  });

  test("drops inheritSkills when a declared Skill is also disallowed", () => {
    // arrange & act
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
        raw: { description: "Reviews files", tools: "Read,Skill", disallowedTools: "Skill" },
        body: "Review files.\n",
      },
      sourceHash: "converted-hash",
      mapModel: false,
    });

    // assert
    assert.match(agent.fileContent, /^tools: read$/m);
    assert.match(agent.fileContent, /^inheritSkills: false$/m);
    assert.deepStrictEqual(agent.warnings, []);
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

  test("labels a malformed changing tools accessor as omitted when the value disappears", () => {
    // arrange
    let toolsReadCount = 0;
    const raw = {
      description: "Reviews files",
      get tools(): string {
        toolsReadCount += 1;
        if (toolsReadCount === 1) {
          return "WebFetch";
        }

        // @ts-expect-error Intentionally exercise an invalid runtime getter result.
        return undefined;
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
        'Cannot convert agent "reviewer" in plugin "acme": the mapped tool list is empty (pi-subagents has no safe representation of "no tools"). Source tools: (omitted); disallowedTools: (none).',
      ),
    );
  });

  test("warn-drops malformed skill metadata and ignores malformed body tokens", () => {
    // arrange
    const expectedWarnings = [
      'malformed skill reference "spec-tree:" -- dropped',
      'malformed skill reference "spec-tree:sub/skill" -- dropped',
      'malformed skill reference "spec-tree:a\tb" -- dropped',
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

  test("rewrites repeated references and fenced examples without a legend", () => {
    // arrange
    const expectedBody =
      "Use /skill:spec-tree-review-changes twice: /skill:spec-tree-review-changes.\n" +
      "Run /spec-tree:review.\n" +
      "```\npi skill /skill:spec-tree-other\n```\n";

    // act
    const agent = convertAgent({
      pluginName: "spec-tree",
      pluginRoot: "/plugins/spec-tree",
      pluginDataDir: "/data/spec-tree",
      knownSkills: ["spec-tree-review-changes", "spec-tree-other"],
      referenceNames: {
        skills: ["spec-tree-review-changes", "spec-tree-other"],
        commands: ["spec-tree:review"],
      },
      discovered: {
        sourceName: "reviewer",
        generatedName: "pi-claude-marketplace-spec-tree-reviewer",
        sourcePath: "/plugins/spec-tree/agents/reviewer.md",
        sourceHash: "discovery-hash",
        raw: { description: "Reviews files", tools: "Read" },
        body:
          "Use spec-tree:review-changes twice: spec-tree:review-changes.\n" +
          "Run /spec-tree:review.\n" +
          "```\npi skill spec-tree:other\n```\n",
      },
      sourceHash: "converted-hash",
      mapModel: false,
    });

    // assert
    assert.strictEqual(agent.fileContent.endsWith(expectedBody), true);
    assert.strictEqual(agent.fileContent.includes("Pi coding agent skill legend"), false);
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
  warnings:
    - agent-level \`hooks\` is not converted -- dropped (Claude Code ignores it for plugin agents too; plugin-level hooks/hooks.json still installs).
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

  test("preserves omitted-tools bytes: no allowlist and inherited skills", () => {
    // arrange
    const expectedFileContent = `---
name: pi-claude-marketplace-acme-bot
description: d
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: true
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
        raw: { description: "d" },
        body: "Body content.\n",
      },
      sourceHash: "abc",
      mapModel: false,
    });

    // assert
    assert.strictEqual(agent.fileContent, expectedFileContent);
  });

  test("preserves omitted-tools disallow bytes: excludeTools narrows the default set", () => {
    // arrange
    const expectedFileContent = `---
name: pi-claude-marketplace-acme-bot
description: d
excludeTools: edit
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
    - disallowedTools entries with no Pi tool mapping (Unknown) cannot narrow the default tool set -- ignored
    - \`excludeTools\` requires pi-subagents >= 0.62.0 -- earlier versions ignore it and keep the default tool set
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
        raw: { description: "d", disallowedTools: "Edit,Skill,Unknown" },
        body: "Body content.\n",
      },
      sourceHash: "abc",
      mapModel: false,
    });

    // assert
    assert.strictEqual(agent.fileContent, expectedFileContent);
  });

  test("preserves omitted-tools disallowed-Skill bytes: no excludeTools and no warnings", () => {
    // arrange
    const expectedFileContent = `---
name: pi-claude-marketplace-acme-bot
description: d
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
        raw: { description: "d", disallowedTools: "Skill" },
        body: "Body content.\n",
      },
      sourceHash: "abc",
      mapModel: false,
    });

    // assert
    assert.strictEqual(agent.fileContent, expectedFileContent);
  });

  test("preserves omitted-tools unmapped-disallow bytes: warns and keeps the default set", () => {
    // arrange
    const expectedFileContent = `---
name: pi-claude-marketplace-acme-bot
description: d
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: true
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: /abs/path/source.md
  droppedFields: []
  droppedTools: []
  warnings:
    - disallowedTools entries with no Pi tool mapping (WebFetch) cannot narrow the default tool set -- ignored
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
        raw: { description: "d", disallowedTools: "WebFetch" },
        body: "Body content.\n",
      },
      sourceHash: "abc",
      mapModel: false,
    });

    // assert
    assert.strictEqual(agent.fileContent, expectedFileContent);
  });

  test("preserves omitted-tools dedupe bytes: repeated disallow names collapse in excludeTools", () => {
    // arrange
    const expectedFileContent = `---
name: pi-claude-marketplace-acme-bot
description: d
excludeTools: edit,write
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: true
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: /abs/path/source.md
  droppedFields: []
  droppedTools: []
  warnings:
    - \`excludeTools\` requires pi-subagents >= 0.62.0 -- earlier versions ignore it and keep the default tool set
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
        raw: { description: "d", disallowedTools: "Edit,Edit,Write" },
        body: "Body content.\n",
      },
      sourceHash: "abc",
      mapModel: false,
    });

    // assert
    assert.strictEqual(agent.fileContent, expectedFileContent);
  });

  test("preserves dropped allowed-tools and mcpServers guidance bytes (#179)", () => {
    // arrange
    const expectedFileContent = `---
name: pi-claude-marketplace-acme-bot
description: d
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: true
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: /abs/path/source.md
  droppedFields:
    - allowed-tools
    - mcpServers
  droppedTools: []
  warnings:
    - \`allowed-tools\` is a slash-command field, not an agent frontmatter field -- dropped (Claude Code ignores it on agents too). Declare \`tools:\` in the source agent instead.
    - agent-level \`mcpServers\` is not converted -- dropped (Claude Code ignores it for plugin agents too). To grant this agent MCP tools, set subagents.agentOverrides["pi-claude-marketplace-acme-bot"].tools (e.g. read,bash,mcp:<server>) in Pi settings.
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
        raw: { description: "d", "allowed-tools": "Read, Bash", mcpServers: "echo" },
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

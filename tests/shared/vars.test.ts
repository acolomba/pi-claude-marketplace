import assert from "node:assert/strict";
import test from "node:test";

import {
  substituteClaudeVars,
  type ClaudePluginVars,
} from "../../extensions/pi-claude-marketplace/shared/vars.ts";

void ({
  pluginRoot: "/plugin",
  pluginData: "/data",
} satisfies ClaudePluginVars);

void ({
  pluginRoot: "/plugin",
  pluginData: "/data",
  skillDir: "/skill",
  projectDir: "/project",
} satisfies ClaudePluginVars);

void ({
  pluginRoot: "/plugin",
  pluginData: "/data",
  skillDir: undefined,
  projectDir: undefined,
} satisfies ClaudePluginVars);

// @ts-expect-error pluginRoot is required
void ({ pluginData: "/data" } satisfies ClaudePluginVars);

// @ts-expect-error pluginData is required
void ({ pluginRoot: "/plugin" } satisfies ClaudePluginVars);

// @ts-expect-error skillDir accepts only a string or undefined
void ({ pluginRoot: "/plugin", pluginData: "/data", skillDir: 7 } satisfies ClaudePluginVars);

interface SubstitutionCase {
  readonly name: string;
  readonly content: string;
  readonly vars: ClaudePluginVars;
  readonly expectedContent: string;
}

const substitutionCases = [
  {
    name: "maps all supported tokens to their matching fields from left to right",
    content:
      "root=${CLAUDE_PLUGIN_ROOT};data=${CLAUDE_PLUGIN_DATA};" +
      "skill=${CLAUDE_SKILL_DIR};project=${CLAUDE_PROJECT_DIR}",
    vars: {
      pluginRoot: "/plugin",
      pluginData: "/data",
      skillDir: "/skill",
      projectDir: "/project",
    },
    expectedContent: "root=/plugin;data=/data;skill=/skill;project=/project",
  },
  {
    name: "replaces adjacent touching tokens without separators",
    content: "${CLAUDE_PLUGIN_ROOT}${CLAUDE_PLUGIN_DATA}${CLAUDE_SKILL_DIR}${CLAUDE_PROJECT_DIR}",
    vars: {
      pluginRoot: "R",
      pluginData: "D",
      skillDir: "S",
      projectDir: "P",
    },
    expectedContent: "RDSP",
  },
  {
    name: "replaces every repeated equal token",
    content:
      "${CLAUDE_PLUGIN_DATA}|${CLAUDE_PLUGIN_DATA}|${CLAUDE_PLUGIN_DATA}|${CLAUDE_PLUGIN_DATA}",
    vars: { pluginRoot: "/plugin", pluginData: "/same" },
    expectedContent: "/same|/same|/same|/same",
  },
  {
    name: "leaves omitted optional values as literal tokens",
    content: "skill=${CLAUDE_SKILL_DIR};project=${CLAUDE_PROJECT_DIR}",
    vars: { pluginRoot: "/plugin", pluginData: "/data" },
    expectedContent: "skill=${CLAUDE_SKILL_DIR};project=${CLAUDE_PROJECT_DIR}",
  },
  {
    name: "leaves an unknown Claude token unchanged",
    content: "unknown=${CLAUDE_SOMETHING_ELSE}",
    vars: {
      pluginRoot: "/plugin",
      pluginData: "/data",
      skillDir: "/skill",
      projectDir: "/project",
    },
    expectedContent: "unknown=${CLAUDE_SOMETHING_ELSE}",
  },
  {
    name: "does not re-expand an injected copy of the matched token",
    content: "${CLAUDE_SKILL_DIR}",
    vars: {
      pluginRoot: "/plugin",
      pluginData: "/data",
      skillDir: "before/${CLAUDE_SKILL_DIR}/after",
    },
    expectedContent: "before/${CLAUDE_SKILL_DIR}/after",
  },
] satisfies readonly SubstitutionCase[];

for (const substitutionCase of substitutionCases) {
  test(substitutionCase.name, () => {
    // arrange
    const { content, vars, expectedContent } = substitutionCase;

    // act
    const substitutedContent = substituteClaudeVars(content, vars);

    // assert
    assert.strictEqual(substitutedContent, expectedContent);
  });
}

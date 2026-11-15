import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  substituteClaudeContent,
  substituteClaudeVars,
  type ClaudeContentOptions,
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
    name: "returns empty content unchanged",
    content: "",
    vars: { pluginRoot: "/plugin", pluginData: "/data" },
    expectedContent: "",
  },
  {
    name: "returns token-free content byte-identically",
    content: "Plain content with braces {and} a dollar $ sign.",
    vars: { pluginRoot: "/plugin", pluginData: "/data" },
    expectedContent: "Plain content with braces {and} a dollar $ sign.",
  },
  {
    name: "replaces one plugin root token",
    content: "Root: ${CLAUDE_PLUGIN_ROOT}",
    vars: { pluginRoot: "/plugin", pluginData: "/data" },
    expectedContent: "Root: /plugin",
  },
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
    name: "leaves explicitly undefined optional values as literal tokens",
    content: "skill=${CLAUDE_SKILL_DIR};project=${CLAUDE_PROJECT_DIR}",
    vars: {
      pluginRoot: "/plugin",
      pluginData: "/data",
      skillDir: undefined,
      projectDir: undefined,
    },
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
    name: "leaves almost-matching token names unchanged",
    content:
      "${CLAUDE_PLUGIN_ROO}|${CLAUDE_PLUGIN_ROOT_EXTRA}|${claude_plugin_root}|" +
      "${CLAUDE-PROJECT-DIR}",
    vars: {
      pluginRoot: "/plugin",
      pluginData: "/data",
      skillDir: "/skill",
      projectDir: "/project",
    },
    expectedContent:
      "${CLAUDE_PLUGIN_ROO}|${CLAUDE_PLUGIN_ROOT_EXTRA}|${claude_plugin_root}|" +
      "${CLAUDE-PROJECT-DIR}",
  },
  {
    name: "scans original tokens left to right without expanding an injected token",
    content: "${CLAUDE_PLUGIN_ROOT}|${CLAUDE_PLUGIN_DATA}",
    vars: {
      pluginRoot: "before/${CLAUDE_PLUGIN_DATA}/after",
      pluginData: "/data",
    },
    expectedContent: "before/${CLAUDE_PLUGIN_DATA}/after|/data",
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
  {
    name: "leaves an option reference as written (D-PG10-13)",
    content: "mode=${user_config.mode};root=${CLAUDE_PLUGIN_ROOT}",
    vars: { pluginRoot: "/plugin", pluginData: "/data" },
    expectedContent: "mode=${user_config.mode};root=/plugin",
  },
] satisfies readonly SubstitutionCase[];

describe("substituteClaudeVars", () => {
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
});

interface ContentCase {
  readonly name: string;
  readonly content: string;
  readonly vars: ClaudePluginVars;
  readonly options: ClaudeContentOptions | undefined;
  readonly expectedContent: string;
}

const pluginVars = { pluginRoot: "/plugin", pluginData: "/data" } satisfies ClaudePluginVars;

const modeOptions = {
  values: new Map([
    ["mode", "fast"],
    ["token", "abc123"],
  ]),
  sensitive: new Set(["token", "secret"]),
} satisfies ClaudeContentOptions;

const contentCases = [
  {
    name: "writes the value of an option (D-PG10-13)",
    content: "mode=${user_config.mode}",
    vars: pluginVars,
    options: modeOptions,
    expectedContent: "mode=fast",
  },
  {
    name: "writes the sensitive-option text for a sensitive option with a value (D-PG10-09)",
    content: "token=${user_config.token}",
    vars: pluginVars,
    options: modeOptions,
    expectedContent: "token=[sensitive option 'token' not available in skill content]",
  },
  {
    name: "writes the sensitive-option text for a sensitive option with no value (D-PG10-09)",
    content: "secret=${user_config.secret}",
    vars: pluginVars,
    options: modeOptions,
    expectedContent: "secret=[sensitive option 'secret' not available in skill content]",
  },
  {
    name: "keeps a reference to an option with no value as written (D-PG10-08)",
    content: "note=${user_config.note}",
    vars: pluginVars,
    options: modeOptions,
    expectedContent: "note=${user_config.note}",
  },
  {
    name: "keeps a reference whose key is not an identifier as written (D-PG10-08)",
    content: "${user_config.not-a-key}|${user_config.}",
    vars: pluginVars,
    options: modeOptions,
    expectedContent: "${user_config.not-a-key}|${user_config.}",
  },
  {
    name: "keeps every option reference as written for a plugin with no options (D-PG10-21)",
    content: "mode=${user_config.mode};token=${user_config.token};root=${CLAUDE_PLUGIN_ROOT}",
    vars: pluginVars,
    options: undefined,
    expectedContent: "mode=${user_config.mode};token=${user_config.token};root=/plugin",
  },
  {
    name: "fills the path variables beside the options from left to right (D-PG10-13)",
    content:
      "${CLAUDE_PLUGIN_ROOT}|${user_config.mode}|${CLAUDE_PLUGIN_DATA}|" +
      "${CLAUDE_SKILL_DIR}|${CLAUDE_PROJECT_DIR}",
    vars: { ...pluginVars, skillDir: "/skill" },
    options: modeOptions,
    expectedContent: "/plugin|fast|/data|/skill|${CLAUDE_PROJECT_DIR}",
  },
  {
    name: "writes an option value that holds a variable as text (D-PG10-13)",
    content: "${user_config.mode}|${CLAUDE_PLUGIN_DATA}",
    vars: pluginVars,
    options: {
      values: new Map([["mode", "${CLAUDE_PLUGIN_ROOT}/${user_config.mode}"]]),
      sensitive: new Set(),
    },
    expectedContent: "${CLAUDE_PLUGIN_ROOT}/${user_config.mode}|/data",
  },
  {
    name: "does not fill an option reference that a path value holds (D-PG10-13)",
    content: "${CLAUDE_PLUGIN_ROOT}|${user_config.mode}",
    vars: { pluginRoot: "/plugin/${user_config.mode}", pluginData: "/data" },
    options: modeOptions,
    expectedContent: "/plugin/${user_config.mode}|fast",
  },
] satisfies readonly ContentCase[];

describe("substituteClaudeContent", () => {
  for (const contentCase of contentCases) {
    test(contentCase.name, () => {
      // arrange
      const { content, vars, options, expectedContent } = contentCase;

      // act
      const substitutedContent = substituteClaudeContent(content, vars, options);

      // assert
      assert.strictEqual(substitutedContent, expectedContent);
    });
  }
});

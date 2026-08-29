import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CLAUDE_TO_PI_TOOL_NAMES,
  mapPiToClaudeToolName,
  type PiToolName,
} from "../../../extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts";

void ("bash" satisfies PiToolName);
// @ts-expect-error Open-ended custom names are not PiToolName literals.
void ("custom" satisfies PiToolName);

describe("CLAUDE_TO_PI_TOOL_NAMES", () => {
  for (const { claudeToolName, expectedPiToolName } of [
    { claudeToolName: "Bash", expectedPiToolName: "bash" },
    { claudeToolName: "Read", expectedPiToolName: "read" },
    { claudeToolName: "Edit", expectedPiToolName: "edit" },
    { claudeToolName: "Write", expectedPiToolName: "write" },
    { claudeToolName: "Grep", expectedPiToolName: "grep" },
    { claudeToolName: "Glob", expectedPiToolName: "find" },
    { claudeToolName: "LS", expectedPiToolName: "ls" },
  ] as const) {
    test(`maps ${claudeToolName} to ${expectedPiToolName}`, () => {
      // arrange
      const toolName = claudeToolName;

      // act
      const piToolName = CLAUDE_TO_PI_TOOL_NAMES[toolName];

      // assert
      assert.strictEqual(piToolName, expectedPiToolName);
    });
  }

  test("maps every supported Claude tool name to its Pi spelling", () => {
    // arrange
    const expectedMappings = {
      Bash: "bash",
      Read: "read",
      Edit: "edit",
      Write: "write",
      Grep: "grep",
      Glob: "find",
      LS: "ls",
    };

    // act
    const mappings = CLAUDE_TO_PI_TOOL_NAMES;

    // assert
    assert.deepStrictEqual(mappings, expectedMappings);
  });
});

describe("mapPiToClaudeToolName", () => {
  for (const { piToolName, expectedClaudeToolName } of [
    { piToolName: "bash", expectedClaudeToolName: "Bash" },
    { piToolName: "read", expectedClaudeToolName: "Read" },
    { piToolName: "edit", expectedClaudeToolName: "Edit" },
    { piToolName: "write", expectedClaudeToolName: "Write" },
    { piToolName: "grep", expectedClaudeToolName: "Grep" },
    { piToolName: "find", expectedClaudeToolName: "Glob" },
    { piToolName: "ls", expectedClaudeToolName: "LS" },
  ]) {
    test(`maps ${piToolName} to ${expectedClaudeToolName}`, () => {
      // arrange
      const toolName = piToolName;

      // act
      const claudeToolName = mapPiToClaudeToolName(toolName);

      // assert
      assert.strictEqual(claudeToolName, expectedClaudeToolName);
    });
  }

  for (const { suppliedToolName, expectedClaudeToolName } of [
    {
      suppliedToolName: "mcp__server__tool",
      expectedClaudeToolName: "mcp__server__tool",
    },
    { suppliedToolName: "subagent", expectedClaudeToolName: "subagent" },
    {
      suppliedToolName: "some_custom_tool",
      expectedClaudeToolName: "some_custom_tool",
    },
    { suppliedToolName: "", expectedClaudeToolName: "" },
    { suppliedToolName: "Bash", expectedClaudeToolName: "Bash" },
    { suppliedToolName: "Read", expectedClaudeToolName: "Read" },
    { suppliedToolName: "Glob", expectedClaudeToolName: "Glob" },
  ]) {
    test(`passes ${JSON.stringify(suppliedToolName)} through`, () => {
      // arrange
      const toolName = suppliedToolName;

      // act
      const claudeToolName = mapPiToClaudeToolName(toolName);

      // assert
      assert.strictEqual(claudeToolName, expectedClaudeToolName);
    });
  }
});

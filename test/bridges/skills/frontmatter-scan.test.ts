import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { topLevelNodeIndex } from "../../../extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts";
import { SkillFrontmatterNodeError } from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";

describe("topLevelNodeIndex", () => {
  for (const { description, lines, blockEnd, expectedIndex } of [
    {
      description: "finds the plain spelling of the key",
      lines: ["---", "description: d", "name: review", "---"],
      blockEnd: 3,
      expectedIndex: 2,
    },
    ...['"name": review', "'name': review", "name : review", '"n\\x61me": review'].map(
      (keyLine) => ({
        description: `finds the key spelled as ${keyLine}`,
        lines: ["---", "description: d", keyLine, "---"],
        blockEnd: 3,
        expectedIndex: 2,
      }),
    ),
    {
      description: "finds a node whose value is an alias of another node's anchor",
      lines: ["---", "label: &n review", "name: *n", "---"],
      blockEnd: 3,
      expectedIndex: 2,
    },
    {
      description: "skips a key that only starts with the key",
      lines: ["---", "name-note: kept", "---"],
      blockEnd: 2,
      expectedIndex: -1,
    },
    {
      description: "skips an alias node of another key",
      lines: ["---", "label: &n review", "title: *n", "---"],
      blockEnd: 3,
      expectedIndex: -1,
    },
    {
      description: "skips a nested key and an indented line of a block scalar",
      lines: ["---", "meta:", "  name: nested", "description: |", "  name: text", "---"],
      blockEnd: 5,
      expectedIndex: -1,
    },
    {
      description: "skips a comment line",
      lines: ["---", "# name: commented", "---"],
      blockEnd: 2,
      expectedIndex: -1,
    },
    {
      description: "finds nothing after the block end",
      lines: ["---", "description: d", "---", "name: body"],
      blockEnd: 2,
      expectedIndex: -1,
    },
    {
      description: "IN-01: finds an explicit key with its value line",
      lines: ["---", "description: d", "? name", ": review", "---"],
      blockEnd: 4,
      expectedIndex: 2,
    },
    {
      description: "WR-05: finds a flow mapping that holds the key alone",
      lines: ["---", "{name: review}", "description: d", "---"],
      blockEnd: 3,
      expectedIndex: 1,
    },
    {
      description: "WR-05: skips a flow mapping that holds only other keys",
      lines: ["---", "{description: d, when_to_use: w}", "---"],
      blockEnd: 2,
      expectedIndex: -1,
    },
  ]) {
    test(description, () => {
      // act
      const index = topLevelNodeIndex(lines, blockEnd, "name");

      // assert
      assert.strictEqual(index, expectedIndex);
    });
  }

  for (const { description, lines, blockEnd, line, keys } of [
    {
      description: "a flow mapping",
      lines: [
        "---",
        "{name: review, description: Reviews., disable-model-invocation: true}",
        "---",
      ],
      blockEnd: 2,
      line: 2,
      keys: ["name", "description", "disable-model-invocation"],
    },
    {
      description: "a multi-line flow mapping after another key",
      lines: ["---", "when_to_use: w", "{description: d,", "  name: review}", "---"],
      blockEnd: 4,
      line: 3,
      keys: ["description", "name"],
    },
  ]) {
    test(`WR-05: throws for the key held in ${description} beside other keys`, () => {
      // act & assert
      assert.throws(
        () => topLevelNodeIndex(lines, blockEnd, "name"),
        (error: unknown) => {
          assert.ok(error instanceof SkillFrontmatterNodeError);
          assert.deepStrictEqual([error.key, error.line, error.keys], ["name", line, keys]);
          return true;
        },
      );
    });
  }
});

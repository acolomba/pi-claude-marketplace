import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { frontmatterBlockEnd } from "../../../extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts";

describe("frontmatterBlockEnd", () => {
  for (const { description, lines, expectedBlockEnd } of [
    {
      description: "uses zero when no frontmatter block is present",
      lines: [],
      expectedBlockEnd: 0,
    },
    {
      description: "finds the closing delimiter of an empty block",
      lines: ["---", "---"],
      expectedBlockEnd: 1,
    },
    {
      description: "finds an exact closing delimiter",
      lines: ["---", "name: test-skill", "---"],
      expectedBlockEnd: 2,
    },
    {
      description: "skips blank lines before the closing delimiter",
      lines: ["---", "", "", "---"],
      expectedBlockEnd: 3,
    },
    {
      description: "uses the document end when the closing delimiter is absent",
      lines: ["---", "name: test-skill", "description: Test skill"],
      expectedBlockEnd: 3,
    },
    {
      description: "stops before content after the frontmatter block",
      lines: ["---", "name: test-skill", "---", "# Test skill", "---"],
      expectedBlockEnd: 2,
    },
  ]) {
    test(description, () => {
      // arrange
      const frontmatterLines = lines;
      const expectedFrontmatterBlockEnd = expectedBlockEnd;

      // act
      const blockEnd = frontmatterBlockEnd(frontmatterLines);

      // assert
      assert.strictEqual(blockEnd, expectedFrontmatterBlockEnd);
    });
  }
});

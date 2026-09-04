import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  frontmatterBlockEnd,
  keyValueEnd,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts";

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

  test("ignores missing array slots before the closing delimiter", () => {
    // arrange
    const frontmatterLines = new Array<string>(3);
    frontmatterLines[0] = "---";
    frontmatterLines[2] = "---";
    const expectedFrontmatterBlockEnd = 2;

    // act
    const blockEnd = frontmatterBlockEnd(frontmatterLines);

    // assert
    assert.strictEqual(blockEnd, expectedFrontmatterBlockEnd);
  });
});

describe("keyValueEnd", () => {
  for (const { description, lines, keyIndex, blockEnd, expectedKeyValueEnd } of [
    {
      description: "keeps an inline scalar on its key line",
      lines: ["---", "name: test-skill", "description: Test skill", "---"],
      keyIndex: 1,
      blockEnd: 3,
      expectedKeyValueEnd: 1,
    },
    {
      description: "includes every indented continuation line",
      lines: [
        "---",
        "description: >",
        "  First line",
        "    Nested line",
        "name: next-skill",
        "---",
      ],
      keyIndex: 1,
      blockEnd: 5,
      expectedKeyValueEnd: 3,
    },
    {
      description: "skips blank lines inside a multiline value",
      lines: ["---", "description: |", "  First line", "", "  Second line", "", "---"],
      keyIndex: 1,
      blockEnd: 6,
      expectedKeyValueEnd: 4,
    },
    {
      description: "stops before the next column-zero key",
      lines: [
        "---",
        "description: >",
        "  First line",
        "when_to_use: During tests",
        "  This line belongs to the next key",
        "---",
      ],
      keyIndex: 1,
      blockEnd: 5,
      expectedKeyValueEnd: 2,
    },
    {
      description: "does not scan beyond the explicit block end",
      lines: ["---", "description: >", "  First line", "---", "  Body indentation"],
      keyIndex: 1,
      blockEnd: 3,
      expectedKeyValueEnd: 2,
    },
    {
      description: "keeps a negative key index before a top-level line",
      lines: ["name: test-skill"],
      keyIndex: -1,
      blockEnd: 1,
      expectedKeyValueEnd: -1,
    },
    {
      description: "keeps a key index beyond the block end",
      lines: ["---", "name: test-skill", "---"],
      keyIndex: 4,
      blockEnd: 2,
      expectedKeyValueEnd: 4,
    },
    {
      description: "reports the last occupied line of a complete multiline span",
      lines: [
        "---",
        "description: >2-",
        "    First line",
        "      Nested line",
        "",
        "name: next-skill",
        "---",
      ],
      keyIndex: 1,
      blockEnd: 6,
      expectedKeyValueEnd: 3,
    },
  ]) {
    test(description, () => {
      // arrange
      const frontmatterLines = lines;
      const expectedFrontmatterKeyValueEnd = expectedKeyValueEnd;

      // act
      const keyEnd = keyValueEnd(frontmatterLines, keyIndex, blockEnd);

      // assert
      assert.strictEqual(keyEnd, expectedFrontmatterKeyValueEnd);
    });
  }

  test("skips a missing array slot inside a multiline value", () => {
    // arrange
    const frontmatterLines = new Array<string>(5);
    frontmatterLines[0] = "---";
    frontmatterLines[1] = "description: >";
    frontmatterLines[3] = "  Continued line";
    frontmatterLines[4] = "---";
    const expectedFrontmatterKeyValueEnd = 3;

    // act
    const keyEnd = keyValueEnd(frontmatterLines, 1, 4);

    // assert
    assert.strictEqual(keyEnd, expectedFrontmatterKeyValueEnd);
  });
});

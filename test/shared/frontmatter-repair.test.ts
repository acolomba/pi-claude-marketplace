import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  blankEarlierDuplicateKeys,
  colonRepairTrigger,
  emitSafeDoubleQuotedScalar,
  extractBodyAfterFrontmatter,
  frontmatterBlockEnd,
  keyValueEnd,
  repairSingleLineScalars,
} from "../../extensions/pi-claude-marketplace/shared/frontmatter-repair.ts";

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
    {
      description: "passes over an indented rule line inside a block scalar, as Pi does",
      lines: ["---", "description: |", "  Part one.", "  ---", "  Part two.", "name: x", "---"],
      expectedBlockEnd: 6,
    },
    {
      description: "closes at a column-0 line that starts with the fence, as Pi does",
      lines: ["---", "name: test-skill", "---- ", "description: body"],
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
      description: "IN-01: includes the value line of an explicit key and its continuation",
      lines: ["---", "? name", "  # key comment", ": >", "  long", "description: d", "---"],
      keyIndex: 1,
      blockEnd: 6,
      expectedKeyValueEnd: 4,
    },
    {
      description: "IN-01: includes only the first value line of an explicit key",
      lines: ["---", "? name", ": review", ": other", "---"],
      keyIndex: 1,
      blockEnd: 4,
      expectedKeyValueEnd: 2,
    },
    {
      description: "IN-01: stops at a value line after a key that is not explicit",
      lines: ["---", "name: review", ": other", "---"],
      keyIndex: 1,
      blockEnd: 3,
      expectedKeyValueEnd: 1,
    },
    {
      description: "IN-01: stops at the next key after an explicit key with no value line",
      lines: ["---", "? name", "description: d", "---"],
      keyIndex: 1,
      blockEnd: 3,
      expectedKeyValueEnd: 1,
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
});

describe("repairSingleLineScalars", () => {
  for (const { description, sourceContent } of [
    {
      description: "a document with no opening fence",
      sourceContent: "name: helper\ndescription: Use this: when reviewing\n---\n",
    },
    {
      description: "an opening fence with no closing fence",
      sourceContent: "---\ndescription: Use this: when reviewing\n",
    },
    {
      description: "empty content",
      sourceContent: "",
    },
    {
      description: "an already double-quoted value",
      sourceContent: '---\ndescription: "Use this: when reviewing"\n---\n',
    },
    {
      description: "an already single-quoted value",
      sourceContent: "---\ndescription: 'Use this: when reviewing'\n---\n",
    },
    {
      description: "a flow sequence",
      sourceContent: "---\ntags: [alpha: 1, beta]\n---\n",
    },
    {
      description: "a flow mapping",
      sourceContent: "---\nmeta: {alpha: 1}\n---\n",
    },
    {
      description: "a folded block scalar",
      sourceContent: "---\ndescription: >-\n  Use this: when reviewing\n---\n",
    },
    {
      description: "a literal block scalar",
      sourceContent: "---\ndescription: |\n  Use this: when reviewing\n---\n",
    },
    {
      description: "a multi-line plain scalar",
      sourceContent: "---\ndescription: Use this: when reviewing\n  pull requests\n---\n",
    },
    {
      description: "a colon-free single-line value",
      sourceContent: "---\nname: helper\ndescription: Reviews pull requests\n---\n",
    },
    {
      description: "a comment line",
      sourceContent: "---\n# note: an author comment\nname: helper\n---\n",
    },
    {
      description: "an indented line under a nested key",
      sourceContent: "---\nmeta:\n  note: Use this: when reviewing\n---\n",
    },
    {
      description: "an empty value",
      sourceContent: "---\ndescription: \nname: helper\n---\n",
    },
  ]) {
    test(`SKFM-01 returns ${description} byte-for-byte`, () => {
      // arrange
      const expectedContent = sourceContent;

      // act
      const skillContent = repairSingleLineScalars(sourceContent, colonRepairTrigger);

      // assert
      assert.strictEqual(skillContent, expectedContent);
    });
  }

  for (const { description, sourceContent, expectedContent } of [
    {
      description: "quotes a single-line value carrying an unquoted colon",
      sourceContent:
        "---\nname: helper\ndescription: Use this: when reviewing\n---\n\nBody prose.\n",
      expectedContent:
        '---\nname: helper\ndescription: "Use this: when reviewing"\n---\n\nBody prose.\n',
    },
    {
      description: "escapes a backslash and a quote inside a repaired value",
      sourceContent: '---\ndescription: at C:\\skills the "main": entry\n---\n',
      expectedContent: '---\ndescription: "at C:\\\\skills the \\"main\\": entry"\n---\n',
    },
    {
      description: "repairs one line and leaves a sibling flow sequence untouched",
      sourceContent: "---\ntags: [alpha: 1, beta]\ndescription: Use this: when reviewing\n---\n",
      expectedContent:
        '---\ntags: [alpha: 1, beta]\ndescription: "Use this: when reviewing"\n---\n',
    },
    {
      description: "repairs a line after a block scalar holding an indented rule line",
      sourceContent:
        "---\ndescription: |\n  Part one.\n  ---\n  Part two.\nargument-hint: Use this: carefully\n---\n",
      expectedContent:
        '---\ndescription: |\n  Part one.\n  ---\n  Part two.\nargument-hint: "Use this: carefully"\n---\n',
    },
    {
      description: "drops the trailing carriage return of a repaired CRLF line",
      sourceContent: "---\r\ndescription: Use this: when reviewing\r\n---\r\n",
      expectedContent: '---\r\ndescription: "Use this: when reviewing"\n---\r\n',
    },
  ]) {
    test(`SKFM-01 ${description}`, () => {
      // arrange
      const expectedSkillContent = expectedContent;

      // act
      const skillContent = repairSingleLineScalars(sourceContent, colonRepairTrigger);

      // assert
      assert.strictEqual(skillContent, expectedSkillContent);
    });
  }

  for (const { description, sourceContent } of [
    {
      description: "an empty value",
      sourceContent: "---\ndescription: \n---\n",
    },
    {
      description: "a double-quoted value",
      sourceContent: '---\ndescription: "Reviews"\n---\n',
    },
    {
      description: "a single-quoted value",
      sourceContent: "---\ndescription: 'Reviews'\n---\n",
    },
    {
      description: "a flow sequence",
      sourceContent: "---\ntools: [Read, Grep]\n---\n",
    },
    {
      description: "a flow mapping",
      sourceContent: "---\nmeta: {alpha: 1}\n---\n",
    },
    {
      description: "a literal block header",
      sourceContent: "---\ndescription: |\n  Reviews\n---\n",
    },
    {
      description: "a folded block header",
      sourceContent: "---\ndescription: >\n  Reviews\n---\n",
    },
    {
      description: "a scalar that continues on an indented line",
      sourceContent: "---\ndescription: Reviews\n  pull requests\n---\n",
    },
    {
      description: "a document with no opening fence",
      sourceContent: "description: Reviews\n---\n",
    },
    {
      description: "an opening fence with no closing fence",
      sourceContent: "---\ndescription: Reviews\n",
    },
  ]) {
    test(`D-PG7-02 an always-true trigger returns ${description} byte-for-byte`, () => {
      // arrange
      const expectedContent = sourceContent;

      // act
      const repairedContent = repairSingleLineScalars(sourceContent, () => true);

      // assert
      assert.strictEqual(repairedContent, expectedContent);
    });
  }

  test("D-PG7-02 quotes a value the trigger accepts", () => {
    // arrange
    const sourceContent = "---\nname: helper\ntools: *\n---\n";

    // act
    const repairedContent = repairSingleLineScalars(sourceContent, (value) =>
      value.startsWith("*"),
    );

    // assert
    assert.strictEqual(repairedContent, '---\nname: helper\ntools: "*"\n---\n');
  });

  test("D-PG7-02 leaves a line the trigger refuses byte-for-byte", () => {
    // arrange
    const sourceContent = "---\nname: helper\ndescription: Use this: when reviewing\n---\n";

    // act
    const repairedContent = repairSingleLineScalars(sourceContent, (value) =>
      value.startsWith("*"),
    );

    // assert
    assert.strictEqual(repairedContent, sourceContent);
  });
});

describe("blankEarlierDuplicateKeys", () => {
  for (const { description, sourceContent, expectedContent } of [
    {
      description: "blanks the earlier copy of a repeated key",
      sourceContent: "---\nname: a\ntools: Read\ntools: Read, Grep\n---\nBody.\n",
      expectedContent: "---\nname: a\n\ntools: Read, Grep\n---\nBody.\n",
    },
    {
      description: "blanks every line an earlier copy spans and keeps the last copy's lines",
      sourceContent: "---\ntools:\n  - Read\n  - Bash\nname: a\ntools:\n  - Grep\n---\n",
      expectedContent: "---\n\n\n\nname: a\ntools:\n  - Grep\n---\n",
    },
    {
      description: "blanks each earlier copy of a key written three times",
      sourceContent: "---\nmodel: a\nmodel: b\nmodel: c\n---\n",
      expectedContent: "---\n\n\nmodel: c\n---\n",
    },
    {
      description: "leaves a block with no repeated key unchanged",
      sourceContent: "---\nname: a\ntools: Read\n# tools: Bash\n---\n",
      expectedContent: "---\nname: a\ntools: Read\n# tools: Bash\n---\n",
    },
    {
      description: "leaves an indented key inside a value unchanged",
      sourceContent: "---\nhooks:\n  tools: a\ntools: Read\n---\n",
      expectedContent: "---\nhooks:\n  tools: a\ntools: Read\n---\n",
    },
    {
      description: "blanks an earlier copy written as a list in a CRLF block",
      sourceContent: "---\r\ntools:\r\n  - Read\r\n  - Bash\r\ntools: Grep\r\n---\r\n",
      expectedContent: "---\r\n\n\n\ntools: Grep\r\n---\r\n",
    },
    {
      description: "blanks an earlier copy beside a last copy written as a list in a CRLF block",
      sourceContent: "---\r\ntools: Read\r\ntools:\r\n  - Grep\r\n---\r\n",
      expectedContent: "---\r\n\ntools:\r\n  - Grep\r\n---\r\n",
    },
    {
      description: "blanks the column-0 items of an earlier copy written as a list",
      sourceContent: "---\nname: a\ntools:\n- Read\n\n- Bash\ntools: Grep\n---\n",
      expectedContent: "---\nname: a\n\n\n\n\ntools: Grep\n---\n",
    },
    {
      description: "blanks the column-0 items of an earlier copy across a column-0 comment",
      sourceContent: "---\ntools:\n- Read\n# c\n- Bash\ntools: Grep\n---\n",
      expectedContent: "---\n\n\n\n\ntools: Grep\n---\n",
    },
    {
      description: "blanks the indented items of an earlier copy across a column-0 comment",
      sourceContent: "---\ntools:\n  - Read\n# c\n  - Bash\ntools: Grep\n---\n",
      expectedContent: "---\n\n\n\n\ntools: Grep\n---\n",
    },
    {
      description: "keeps a column-0 comment after the last item of an earlier copy",
      sourceContent: "---\ntools:\n- Read\n# c\ntools: Grep\n---\n",
      expectedContent: "---\n\n\n# c\ntools: Grep\n---\n",
    },
    {
      description: "blanks the column-0 items of an earlier copy with a comment on its key line",
      sourceContent: "---\ntools: # read only\n- Read\ntools: Grep\n---\n",
      expectedContent: "---\n\n\ntools: Grep\n---\n",
    },
    {
      description: "keeps the column-0 items of the last copy written as a list",
      sourceContent: "---\ntools: Read\ntools:\n- Grep\n- Bash\n---\n",
      expectedContent: "---\n\ntools:\n- Grep\n- Bash\n---\n",
    },
    {
      description: "takes a double-quoted, a single-quoted, and a plain key as one key",
      sourceContent: "---\n\"tools\": Read\n'tools': Bash\ntools: Grep\n---\n",
      expectedContent: "---\n\n\ntools: Grep\n---\n",
    },
    {
      description: "takes a key with blanks before its colon as the same key",
      sourceContent: "---\ntools : Read\ntools: Grep\n---\n",
      expectedContent: "---\n\ntools: Grep\n---\n",
    },
    {
      description: "leaves an explicit key beside a plain copy unchanged",
      sourceContent: "---\n? tools\n: Read\ntools: Grep\n---\n",
      expectedContent: "---\n? tools\n: Read\ntools: Grep\n---\n",
    },
    {
      description: "leaves a repeated key after the closing fence unchanged",
      sourceContent: "---\ntools: Read\n---\ntools: Bash\ntools: Grep\n",
      expectedContent: "---\ntools: Read\n---\ntools: Bash\ntools: Grep\n",
    },
    {
      description: "leaves content without a closing fence unchanged",
      sourceContent: "---\ntools: Read\ntools: Bash\n",
      expectedContent: "---\ntools: Read\ntools: Bash\n",
    },
    {
      description: "leaves content without an opening fence unchanged",
      sourceContent: "tools: Read\ntools: Bash\n---\n",
      expectedContent: "tools: Read\ntools: Bash\n---\n",
    },
  ]) {
    test(`D-PG7-19 ${description}`, () => {
      // act
      const dedupedContent = blankEarlierDuplicateKeys(sourceContent);

      // assert
      assert.strictEqual(dedupedContent, expectedContent);
    });
  }
});

describe("colonRepairTrigger", () => {
  for (const { description, value, expected } of [
    {
      description: "accepts a value with a colon inside",
      value: "Use this: carefully",
      expected: true,
    },
    { description: "accepts a value that ends with a colon", value: "Note:", expected: true },
    {
      description: "refuses a value with no colon",
      value: "Reviews pull requests",
      expected: false,
    },
  ]) {
    test(description, () => {
      // act
      const triggered = colonRepairTrigger(value);

      // assert
      assert.strictEqual(triggered, expected);
    });
  }
});

describe("emitSafeDoubleQuotedScalar", () => {
  for (const { description, value, expected } of [
    {
      description: "escapes a backslash before a double quote",
      value: String.raw`a\"b`,
      expected: String.raw`"a\\\"b"`,
    },
    { description: "turns a line feed into one space", value: "one\ntwo", expected: '"one two"' },
    { description: "turns a CRLF into one space", value: "one\r\ntwo", expected: '"one two"' },
  ]) {
    test(description, () => {
      // act
      const scalar = emitSafeDoubleQuotedScalar(value);

      // assert
      assert.strictEqual(scalar, expected);
    });
  }
});

describe("extractBodyAfterFrontmatter", () => {
  for (const { description, content, expected } of [
    {
      description: "returns the trimmed body after an LF block",
      content: "---\nname: x\n---\n\nBody.\n",
      expected: "Body.",
    },
    {
      description: "returns the trimmed body after a CRLF block",
      content: "---\r\nname: x\r\n---\r\n\r\nBody.\r\n",
      expected: "Body.",
    },
    {
      description: "returns the trimmed body after a lone-CR block",
      content: "---\rname: x\r---\r\rBody.\r",
      expected: "Body.",
    },
    {
      description: "treats a ---x line as the close, as Pi does",
      content: "---\nname: x\n---x\nBody.\n",
      expected: "x\nBody.",
    },
    {
      description: "does not stop at an indented ---",
      content: "---\ndescription: |\n  ---\n---\nBody.\n",
      expected: "Body.",
    },
  ]) {
    test(description, () => {
      // act
      const body = extractBodyAfterFrontmatter(content);

      // assert
      assert.strictEqual(body, expected);
    });
  }
});

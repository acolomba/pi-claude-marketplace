import assert from "node:assert/strict";
import { test } from "node:test";

import { rewriteFrontmatterName } from "../../../extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts";

for (const { description, skillDocument, generatedName, expectedSkillDocument } of [
  {
    description: "replaces an existing scalar name and preserves every remaining byte",
    skillDocument:
      '---\nname: old-name\ndescription: "keep: punctuation"\nlicense: MIT\n---\n\n# Body\n\nBody text.\n',
    generatedName: "new-name",
    expectedSkillDocument:
      '---\nname: new-name\ndescription: "keep: punctuation"\nlicense: MIT\n---\n\n# Body\n\nBody text.\n',
  },
  {
    description: "inserts a missing name as the first frontmatter field",
    skillDocument:
      "---\ndescription: Skill without a name\nlicense: Apache-2.0\n---\n\nBody text.\n",
    generatedName: "inserted-name",
    expectedSkillDocument:
      "---\nname: inserted-name\ndescription: Skill without a name\nlicense: Apache-2.0\n---\n\nBody text.\n",
  },
]) {
  test(description, () => {
    // arrange
    const sourceSkillDocument = skillDocument;
    const expectedRewrittenSkillDocument = expectedSkillDocument;

    // act
    const rewrittenSkillDocument = rewriteFrontmatterName(sourceSkillDocument, generatedName);

    // assert
    assert.strictEqual(rewrittenSkillDocument, expectedRewrittenSkillDocument);
  });
}

for (const { description, skillDocument, expectedSkillDocument } of [
  {
    description: "replaces a quoted scalar name",
    skillDocument: '---\nname: "old name"\ndescription: Quoted scalar\n---\n\nQuoted body.\n',
    expectedSkillDocument:
      "---\nname: generated-name\ndescription: Quoted scalar\n---\n\nQuoted body.\n",
  },
  {
    description: "removes the complete folded name node",
    skillDocument:
      "---\nname: >-\n  old\n  folded\n\ndescription: Folded scalar\n---\n\nFolded body.\n",
    expectedSkillDocument:
      "---\nname: generated-name\n\ndescription: Folded scalar\n---\n\nFolded body.\n",
  },
  {
    description: "removes the complete literal name node",
    skillDocument: "---\nname: |+\n  old\n  literal\nlicense: MIT\n---\n\nLiteral body.\n",
    expectedSkillDocument: "---\nname: generated-name\nlicense: MIT\n---\n\nLiteral body.\n",
  },
  {
    description: "removes every multiline plain-name continuation",
    skillDocument:
      "---\nname: old\n  plain\n  name\ndescription: Plain scalar\n---\n\nPlain body.\n",
    expectedSkillDocument:
      "---\nname: generated-name\ndescription: Plain scalar\n---\n\nPlain body.\n",
  },
  {
    description: "removes every multiline double-quoted name continuation",
    skillDocument:
      '---\nname: "old\n  double quoted\n  name"\ndescription: Double quoted scalar\n---\n\nDouble quoted body.\n',
    expectedSkillDocument:
      "---\nname: generated-name\ndescription: Double quoted scalar\n---\n\nDouble quoted body.\n",
  },
  {
    description: "removes every multiline single-quoted name continuation",
    skillDocument:
      "---\nname: 'old\n  single quoted\n  name'\ndescription: Single quoted scalar\n---\n\nSingle quoted body.\n",
    expectedSkillDocument:
      "---\nname: generated-name\ndescription: Single quoted scalar\n---\n\nSingle quoted body.\n",
  },
  {
    description: "preserves untouched CRLF bytes around a replaced name node",
    skillDocument:
      "---\r\nname: old-name\r\ndescription: CRLF document\r\n---\r\n\r\nCRLF body.\r\n",
    expectedSkillDocument:
      "---\r\nname: generated-name\ndescription: CRLF document\r\n---\r\n\r\nCRLF body.\r\n",
  },
  {
    description: "preserves a document without a terminal newline",
    skillDocument: "---\nname: old-name\ndescription: No terminal newline\n---\n\nBody",
    expectedSkillDocument:
      "---\nname: generated-name\ndescription: No terminal newline\n---\n\nBody",
  },
  {
    description: "prepends a canonical block when frontmatter is missing",
    skillDocument: "# Skill\n\nBody without frontmatter.\n",
    expectedSkillDocument:
      "---\nname: generated-name\n---\n\n# Skill\n\nBody without frontmatter.\n",
  },
  {
    description: "prepends a canonical block when frontmatter has no closing delimiter",
    skillDocument: "---\nname: stuck-name\ndescription: Missing close\n\nUnclosed body.\n",
    expectedSkillDocument:
      "---\nname: generated-name\n---\n\n---\nname: stuck-name\ndescription: Missing close\n\nUnclosed body.\n",
  },
  {
    description: "rewrites through a parser-accepted noncanonical closing delimiter",
    skillDocument: "---\nname: old-name\n---x\nBody after exotic close.\n",
    expectedSkillDocument: "---\nname: generated-name\n---x\nBody after exotic close.\n",
  },
]) {
  test(description, () => {
    // arrange
    const sourceSkillDocument = skillDocument;
    const expectedRewrittenSkillDocument = expectedSkillDocument;

    // act
    const rewrittenSkillDocument = rewriteFrontmatterName(sourceSkillDocument, "generated-name");

    // assert
    assert.strictEqual(rewrittenSkillDocument, expectedRewrittenSkillDocument);
  });
}

test("treats a sparse frontmatter line as a missing name field", (t) => {
  // arrange
  const sourceSkillDocument = "---\ndescription: sparse\n---\nBody.";
  const expectedRewrittenSkillDocument = "---\nname: generated-name\n\n---\nBody.";
  t.mock.method(String.prototype, "split", function (this: string, separator?: string | RegExp) {
    if (this === sourceSkillDocument && separator === "\n") {
      const lines: string[] = [];
      lines.length = 4;
      lines[0] = "---";
      lines[2] = "---";
      lines[3] = "Body.";
      return lines;
    }

    return [this];
  });

  // act
  const rewrittenSkillDocument = rewriteFrontmatterName(sourceSkillDocument, "generated-name");

  // assert
  assert.strictEqual(rewrittenSkillDocument, expectedRewrittenSkillDocument);
});

for (const { description, generatedName, expectedError } of [
  {
    description: "rejects a numeric name that the parser changes from a string",
    generatedName: "42",
    expectedError: {
      constructorName: "Error",
      name: "Error",
      message: 'Skill name rewrite produced 42, expected the generated name "42".',
    },
  },
  {
    description: "rejects replacement text that injects a sibling field",
    generatedName: "safe-name\nlicense: injected",
    expectedError: {
      constructorName: "Error",
      name: "Error",
      message:
        'Skill name rewrite produced "safe-name", expected the generated name "safe-name\\nlicense: injected".',
    },
  },
  {
    description: "reports the parser failure for malformed replacement text",
    generatedName: "[",
    expectedError: {
      constructorName: "YAMLParseError",
      name: "YAMLParseError",
      message:
        "Flow sequence in block collection must be sufficiently indented and end with a ] at line 2, column 1:\n\nname: [\ndescription: kept\n^\n",
    },
  },
]) {
  test(description, () => {
    // arrange
    const sourceSkillDocument = "---\nname: old-name\ndescription: kept\n---\n\nBody text.\n";

    // act
    const rewriteSkillDocument = () => rewriteFrontmatterName(sourceSkillDocument, generatedName);

    // assert
    assert.throws(rewriteSkillDocument, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepStrictEqual(
        {
          constructorName: error.constructor.name,
          name: error.name,
          message: error.message,
        },
        expectedError,
      );
      return true;
    });
  });
}

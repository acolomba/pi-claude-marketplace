import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  firstBodyParagraph,
  foldWhenToUse,
  repairSingleLineScalars,
  setDescriptionScalar,
  synthesizeUnparseableSkill,
  truncate1536,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts";

describe("synthesizeUnparseableSkill", () => {
  for (const { description, body, generatedName, expectedContent } of [
    {
      description: "a multiline markdown body",
      body: "# Real Body\n\nThe original markdown, preserved verbatim.\n",
      generatedName: "acme-helper",
      expectedContent:
        "---\n" +
        "name: acme-helper\n" +
        "description: Source frontmatter could not be parsed.\n" +
        "disable-model-invocation: true\n" +
        "---\n\n" +
        "# Real Body\n\nThe original markdown, preserved verbatim.\n",
    },
    {
      description: "an empty body",
      body: "",
      generatedName: "empty-helper",
      expectedContent:
        "---\n" +
        "name: empty-helper\n" +
        "description: Source frontmatter could not be parsed.\n" +
        "disable-model-invocation: true\n" +
        "---\n\n",
    },
  ]) {
    test(`emits exact fallback metadata and preserves ${description}`, () => {
      // arrange
      const expectedSkillContent = expectedContent;

      // act
      const skillContent = synthesizeUnparseableSkill(body, generatedName);

      // assert
      assert.strictEqual(skillContent, expectedSkillContent);
    });
  }
});

describe("firstBodyParagraph", () => {
  for (const { description, body, expectedParagraph } of [
    {
      description: "blank lines, headings, and a backtick fence",
      body:
        "\n# A Leading Heading\n\n```bash\necho skipped\n# still fenced\n```\n\n" +
        "The first genuine prose paragraph.\nSecond line of that paragraph.\n\nLater prose.",
      expectedParagraph: "The first genuine prose paragraph.\nSecond line of that paragraph.",
    },
    {
      description: "a tilde fence",
      body: "~~~\ncode in a tilde fence\n~~~\n\nReal prose here.\n",
      expectedParagraph: "Real prose here.",
    },
    {
      description: "an immediate paragraph",
      body: "First line.\nSecond line.\n\nLater paragraph.",
      expectedParagraph: "First line.\nSecond line.",
    },
    {
      description: "an empty body",
      body: "",
      expectedParagraph: "",
    },
    {
      description: "whitespace only",
      body: "\n\n   \n",
      expectedParagraph: "",
    },
    {
      description: "headings only",
      body: "# One\n\n###### Six\n",
      expectedParagraph: "",
    },
    {
      description: "a closed fence with no following prose",
      body: "```\nonly a fence\n```\n",
      expectedParagraph: "",
    },
    {
      description: "an unterminated fence",
      body: "```\nnever closed\nstill inside the fence\n",
      expectedParagraph: "",
    },
  ]) {
    test(`returns the first prose paragraph after ${description}`, () => {
      // arrange
      const expectedBodyParagraph = expectedParagraph;

      // act
      const bodyParagraph = firstBodyParagraph(body);

      // assert
      assert.strictEqual(bodyParagraph, expectedBodyParagraph);
    });
  }

  test("treats sparse split entries inside a fence as blank lines", (t) => {
    // arrange
    const body = "sparse fenced body";
    t.mock.method(String.prototype, "split", function (this: string) {
      if (this === body) {
        const lines: string[] = [];
        lines.length = 4;
        lines[0] = "```";
        lines[2] = "```";
        lines[3] = "Body prose.";
        return lines;
      }

      return [this];
    });

    // act
    const bodyParagraph = firstBodyParagraph(body);

    // assert
    assert.strictEqual(bodyParagraph, "Body prose.");
  });

  test("treats a sparse leading split entry as a blank line", (t) => {
    // arrange
    const body = "sparse leading body";
    t.mock.method(String.prototype, "split", function (this: string) {
      if (this === body) {
        const lines: string[] = [];
        lines.length = 2;
        lines[1] = "Body prose.";
        return lines;
      }

      return [this];
    });

    // act
    const bodyParagraph = firstBodyParagraph(body);

    // assert
    assert.strictEqual(bodyParagraph, "Body prose.");
  });

  test("treats a disappearing split entry as an empty paragraph line", (t) => {
    // arrange
    const body = "volatile split body";
    let reads = 0;
    t.mock.method(String.prototype, "split", function (this: string) {
      if (this === body) {
        const lines: string[] = [];
        lines.length = 2;
        Object.defineProperty(lines, "0", {
          configurable: true,
          enumerable: true,
          get() {
            reads += 1;
            return reads < 3 ? "Body prose." : undefined;
          },
        });
        return lines;
      }

      return [this];
    });

    // act
    const bodyParagraph = firstBodyParagraph(body);

    // assert
    assert.strictEqual(bodyParagraph, "");
  });
});

describe("foldWhenToUse", () => {
  for (const { description, whenToUse, expectedDescription } of [
    {
      description: "A description.",
      whenToUse: undefined,
      expectedDescription: "A description.",
    },
    {
      description: "A description.",
      whenToUse: "",
      expectedDescription: "A description.",
    },
    {
      description: "A description.",
      whenToUse: "Use for exact folding.",
      expectedDescription: "A description.\nUse for exact folding.",
    },
    {
      description: "",
      whenToUse: "Use without a description.",
      expectedDescription: "\nUse without a description.",
    },
    {
      description: "Emoji 😀",
      whenToUse: "Use with Unicode 🧪",
      expectedDescription: "Emoji 😀\nUse with Unicode 🧪",
    },
  ]) {
    test(`folds ${JSON.stringify(whenToUse)} into ${JSON.stringify(description)}`, () => {
      // arrange
      const expectedFoldedDescription = expectedDescription;

      // act
      const foldedDescription = foldWhenToUse(description, whenToUse);

      // assert
      assert.strictEqual(foldedDescription, expectedFoldedDescription);
    });
  }
});

describe("truncate1536", () => {
  for (const { description, text, expectedText } of [
    {
      description: "an empty string",
      text: "",
      expectedText: "",
    },
    {
      description: "1,535 code units",
      text: "a".repeat(1535),
      expectedText: "a".repeat(1535),
    },
    {
      description: "exactly 1,536 code units",
      text: "b".repeat(1536),
      expectedText: "b".repeat(1536),
    },
    {
      description: "1,537 code units",
      text: `${"c".repeat(1536)}x`,
      expectedText: "c".repeat(1536),
    },
    {
      description: "768 astral characters",
      text: "😀".repeat(768),
      expectedText: "😀".repeat(768),
    },
    {
      description: "a surrogate pair crossing the cap",
      text: `${"d".repeat(1535)}😀`,
      expectedText: `${"d".repeat(1535)}\ud83d`,
    },
  ]) {
    test(`returns the exact hard-cut value for ${description}`, () => {
      // arrange
      const expectedTruncatedText = expectedText;

      // act
      const truncatedText = truncate1536(text);

      // assert
      assert.strictEqual(truncatedText, expectedTruncatedText);
    });
  }
});

describe("setDescriptionScalar", () => {
  test("replaces a folded block scalar and preserves every other document byte", () => {
    // arrange
    const sourceContent =
      "---\n" +
      "name: block-desc\n" +
      "description: >-\n" +
      "  This is a folded block scalar description\n" +
      "  that spans several source lines.\n" +
      "version: 2.3.1\n" +
      "tags: alpha, beta\n" +
      "---\n\n" +
      "# Block Scalar Skill\n\n" +
      "Body prose.\n";
    const expectedContent =
      "---\n" +
      "name: block-desc\n" +
      'description: "A single-line replacement description."\n' +
      "version: 2.3.1\n" +
      "tags: alpha, beta\n" +
      "---\n\n" +
      "# Block Scalar Skill\n\n" +
      "Body prose.\n";

    // act
    const skillContent = setDescriptionScalar(
      sourceContent,
      "A single-line replacement description.",
    );

    // assert
    assert.strictEqual(skillContent, expectedContent);
  });

  test("inserts a missing description as the final frontmatter key", () => {
    // arrange
    const sourceContent = "---\nname: no-desc\nversion: 1.0.0\n---\n\nBody.\n";
    const expectedContent =
      '---\nname: no-desc\nversion: 1.0.0\ndescription: "Body fallback."\n---\n\nBody.\n';

    // act
    const skillContent = setDescriptionScalar(sourceContent, "Body fallback.");

    // assert
    assert.strictEqual(skillContent, expectedContent);
  });

  for (const { description, sourceContent, expectedContent } of [
    {
      description: "an inline plain scalar",
      sourceContent:
        "---\nname: inline\ndescription: old inline value\nversion: 9.9.9\n---\n\nBody.\n",
      expectedContent:
        '---\nname: inline\ndescription: "new value"\nversion: 9.9.9\n---\n\nBody.\n',
    },
    {
      description: "a literal block scalar",
      sourceContent:
        "---\nname: literal\ndescription: |\n  first source line\n  second source line\nversion: 2\n---\nBody.\n",
      expectedContent: '---\nname: literal\ndescription: "new value"\nversion: 2\n---\nBody.\n',
    },
    {
      description: "a multiline plain scalar with a blank continuation",
      sourceContent:
        "---\ndescription: old value\n\n  wrapped continuation\nname: plain\n---\nBody.\n",
      expectedContent: '---\ndescription: "new value"\nname: plain\n---\nBody.\n',
    },
    {
      description: "a multiline double-quoted scalar",
      sourceContent:
        '---\nname: quoted\ndescription: "first source line\n  second source line"\nversion: 3\n---\nBody.\n',
      expectedContent: '---\nname: quoted\ndescription: "new value"\nversion: 3\n---\nBody.\n',
    },
    {
      description: "a multiline single-quoted scalar",
      sourceContent:
        "---\nname: quoted\ndescription: 'first source line\n  second source line'\nversion: 4\n---\nBody.\n",
      expectedContent: '---\nname: quoted\ndescription: "new value"\nversion: 4\n---\nBody.\n',
    },
  ]) {
    test(`replaces ${description} across its complete node span`, () => {
      // arrange
      const expectedSkillContent = expectedContent;

      // act
      const skillContent = setDescriptionScalar(sourceContent, "new value");

      // assert
      assert.strictEqual(skillContent, expectedSkillContent);
    });
  }

  test("collapses newlines and escapes quotes and backslashes in hostile input", () => {
    // arrange
    const sourceContent = "---\nname: safe\ndescription: placeholder\nversion: 1\n---\n\nBody.\n";
    const description = 'evil: value\r\nmalicious-key: "injected" at C:\\skills';
    const expectedContent =
      '---\nname: safe\ndescription: "evil: value malicious-key: \\"injected\\" at C:\\\\skills"\nversion: 1\n---\n\nBody.\n';

    // act
    const skillContent = setDescriptionScalar(sourceContent, description);

    // assert
    assert.strictEqual(skillContent, expectedContent);
  });

  test("returns a document without an opening fence byte-for-byte", () => {
    // arrange
    const sourceContent = "description: old\n\nBody description: preserved.\n";

    // act
    const skillContent = setDescriptionScalar(sourceContent, "ignored");

    // assert
    assert.strictEqual(skillContent, sourceContent);
  });

  test("replaces a description in an unclosed frontmatter block through end of file", () => {
    // arrange
    const sourceContent = "---\ndescription: old value\nname: acme-skill";
    const expectedContent = '---\ndescription: "new value"\nname: acme-skill';

    // act
    const skillContent = setDescriptionScalar(sourceContent, "new value");

    // assert
    assert.strictEqual(skillContent, expectedContent);
  });

  test("treats a sparse frontmatter split entry as an absent description", (t) => {
    // arrange
    const sourceContent = "sparse frontmatter";
    t.mock.method(String.prototype, "split", function (this: string) {
      if (this === sourceContent) {
        const lines: string[] = [];
        lines.length = 3;
        lines[0] = "---";
        lines[2] = "---";
        return lines;
      }

      return [this];
    });
    const expectedContent = '---\n\ndescription: "new value"\n---';

    // act
    const skillContent = setDescriptionScalar(sourceContent, "new value");

    // assert
    assert.strictEqual(skillContent, expectedContent);
  });
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
      const skillContent = repairSingleLineScalars(sourceContent);

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
      description: "drops the trailing carriage return of a repaired CRLF line",
      sourceContent: "---\r\ndescription: Use this: when reviewing\r\n---\r\n",
      expectedContent: '---\r\ndescription: "Use this: when reviewing"\n---\r\n',
    },
  ]) {
    test(`SKFM-01 ${description}`, () => {
      // arrange
      const expectedSkillContent = expectedContent;

      // act
      const skillContent = repairSingleLineScalars(sourceContent);

      // assert
      assert.strictEqual(skillContent, expectedSkillContent);
    });
  }
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  resolveSkillReference,
  rewriteMarkdownReferences,
} from "../../extensions/pi-claude-marketplace/domain/skill-tokens.ts";
import { setCasePlatform } from "../platform/case-platform.ts";

describe("rewriteMarkdownReferences", () => {
  test("leaves an already-native reference byte-identical", () => {
    // arrange
    const content = "Use acme-foo when linting.\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: ["acme-foo"],
      commands: [],
    });

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("converges an elidable reference onto the generated name", () => {
    // arrange
    const content = "Run acme:acme-foo first.\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: ["acme-foo"],
      commands: [],
    });

    // assert
    assert.strictEqual(rewritten, "Run /skill:acme-foo first.\n");
  });

  test("rewrites the colon reference to the same Pi name on win32", (t) => {
    // arrange
    setCasePlatform(t, "win32");
    const content = "Use acme:foo daily.\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: ["acme-foo"],
      commands: [],
    });

    // assert
    assert.strictEqual(rewritten, "Use /skill:acme-foo daily.\n");
  });

  test("leaves an unknown reference verbatim", () => {
    // arrange
    const content = "See acme:ghost for details.\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: ["acme-foo"],
      commands: [],
    });

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("leaves an explicit reference to an unknown skill verbatim", () => {
    // arrange
    const content = "Use /skill:ghost.\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: ["acme-foo"],
      commands: [],
    });

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("leaves a cross-plugin reference verbatim", () => {
    // arrange
    const content = "See other:acme-foo for details.\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: ["acme-foo"],
      commands: [],
    });

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("leaves a token embedded in a longer word verbatim", () => {
    // arrange
    const content = "See xacme:acme-foo for details.\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: ["acme-foo"],
      commands: [],
    });

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("skips a candidate the name generator rejects", () => {
    // arrange
    const content = "See acme:acme- for details.\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: ["acme-foo"],
      commands: [],
    });

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("rewrites fenced examples", () => {
    // arrange
    const content =
      "Run acme:acme-foo first.\n\n```text\nacme:acme-foo stays\n```\n\nThen acme:acme-foo again.\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: ["acme-foo"],
      commands: [],
    });

    // assert
    assert.strictEqual(
      rewritten,
      "Run /skill:acme-foo first.\n\n```text\n/skill:acme-foo stays\n```\n\nThen /skill:acme-foo again.\n",
    );
  });

  test("rewrites tilde-fenced examples", () => {
    // arrange
    const content = "~~~\nacme:acme-foo\n~~~\nacme:acme-foo\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: ["acme-foo"],
      commands: [],
    });

    // assert
    assert.strictEqual(rewritten, "~~~\n/skill:acme-foo\n~~~\n/skill:acme-foo\n");
  });

  test("rewrites every reference on a line, including inline code", () => {
    // arrange
    const content = "Chain `acme:acme-foo` and then acme:acme-foo.\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: ["acme-foo"],
      commands: [],
    });

    // assert
    assert.strictEqual(rewritten, "Chain `/skill:acme-foo` and then /skill:acme-foo.\n");
  });

  test("preserves CRLF line endings", () => {
    // arrange
    const content = "First line.\r\nacme:acme-foo\r\nLast line.\r\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: ["acme-foo"],
      commands: [],
    });

    // assert
    assert.strictEqual(rewritten, "First line.\r\n/skill:acme-foo\r\nLast line.\r\n");
  });

  test("escapes regex metacharacters in the plugin name", () => {
    // arrange
    const content = "AcxMe:foo stays put.\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "Ac.Me", {
      skills: ["ac-me-foo"],
      commands: [],
    });

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("rewrites a dotted skill source without swallowing sentence punctuation", () => {
    // arrange
    const content = "Use acme:review.changes.\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: ["acme-review-changes"],
      commands: [],
    });

    // assert
    assert.strictEqual(rewritten, "Use /skill:acme-review-changes.\n");
  });

  test("rewrites cross-kind references and gives ambiguous names to commands", () => {
    // arrange
    const content = "Run acme:review, then /acme:build:web and /skill:review.\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: ["acme-review"],
      commands: ["acme:review", "acme:build:web"],
    });

    // assert
    assert.strictEqual(
      rewritten,
      "Run /acme:review, then /acme:build:web and /skill:acme-review.\n",
    );
  });

  test("uses the installed dot command name on Windows", (t) => {
    // arrange
    setCasePlatform(t, "win32");
    const content = "Run /acme:build:web and acme:review.\n";

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", {
      skills: ["acme-review"],
      commands: ["acme.build.web", "acme.review"],
    });

    // assert
    assert.strictEqual(rewritten, "Run /acme.build.web and /acme.review.\n");
  });

  test("is stable when applied to already converted references", () => {
    // arrange
    const content = "Use /skill:acme-review and /acme:build:web.\n";
    const names = { skills: ["acme-review"], commands: ["acme:build:web"] };

    // act
    const rewritten = rewriteMarkdownReferences(content, "acme", names);

    // assert
    assert.strictEqual(rewritten, content);
  });
});

describe("resolveSkillReference", () => {
  for (const reference of ["foo", "acme:foo", "acme: foo", "acme :foo", "acme-foo"]) {
    test(`maps ${JSON.stringify(reference)} through the installed skill name`, () => {
      // arrange
      const known = new Set(["acme-foo"]);

      // act
      const resolution = resolveSkillReference("acme", reference, known);

      // assert
      assert.deepStrictEqual(resolution, { kind: "known", generatedName: "acme-foo" });
    });
  }

  for (const { reference, expected } of [
    { reference: "other:foo", expected: { kind: "foreign" } },
    { reference: "acme:ghost", expected: { kind: "unknown" } },
    {
      reference: "acme:acme-",
      expected: { kind: "malformed", reason: "Name must be a non-empty string." },
    },
  ]) {
    test(`classifies ${JSON.stringify(reference)} without inventing a skill`, () => {
      // arrange
      const known = new Set(["acme-foo"]);

      // act
      const resolution = resolveSkillReference("acme", reference, known);

      // assert
      assert.deepStrictEqual(resolution, expected);
    });
  }
});

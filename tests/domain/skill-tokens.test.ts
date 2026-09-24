import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  resolveSkillReference,
  rewriteSkillTokens,
} from "../../extensions/pi-claude-marketplace/domain/skill-tokens.ts";
import { setCasePlatform } from "../platform/case-platform.ts";

describe("rewriteSkillTokens", () => {
  test("leaves an already-native reference byte-identical", () => {
    // arrange
    const content = "Use acme-foo when linting.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", ["acme-foo"]);

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("converges an elidable reference onto the generated name", () => {
    // arrange
    const content = "Run acme:acme-foo first.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", ["acme-foo"]);

    // assert
    assert.strictEqual(rewritten, "Run acme-foo first.\n");
  });

  test("rewrites the colon reference to the same Pi name on win32", (t) => {
    // arrange
    setCasePlatform(t, "win32");
    const content = "Use acme:foo daily.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", ["acme-foo"]);

    // assert
    assert.strictEqual(rewritten, "Use acme-foo daily.\n");
  });

  test("leaves an unknown reference verbatim", () => {
    // arrange
    const content = "See acme:ghost for details.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", ["acme-foo"]);

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("leaves a cross-plugin reference verbatim", () => {
    // arrange
    const content = "See other:acme-foo for details.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", ["acme-foo"]);

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("leaves a token embedded in a longer word verbatim", () => {
    // arrange
    const content = "See xacme:acme-foo for details.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", ["acme-foo"]);

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("skips a candidate the name generator rejects", () => {
    // arrange
    const content = "See acme:acme- for details.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", ["acme-foo"]);

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("keeps fenced code blocks verbatim", () => {
    // arrange
    const content =
      "Run acme:acme-foo first.\n\n```text\nacme:acme-foo stays\n```\n\nThen acme:acme-foo again.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", ["acme-foo"]);

    // assert
    assert.strictEqual(
      rewritten,
      "Run acme-foo first.\n\n```text\nacme:acme-foo stays\n```\n\nThen acme-foo again.\n",
    );
  });

  test("treats tilde fences like backtick fences", () => {
    // arrange
    const content = "~~~\nacme:acme-foo\n~~~\nacme:acme-foo\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", ["acme-foo"]);

    // assert
    assert.strictEqual(rewritten, "~~~\nacme:acme-foo\n~~~\nacme-foo\n");
  });

  test("rewrites every reference on a line, including inline code", () => {
    // arrange
    const content = "Chain `acme:acme-foo` and then acme:acme-foo.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", ["acme-foo"]);

    // assert
    assert.strictEqual(rewritten, "Chain `acme-foo` and then acme-foo.\n");
  });

  test("preserves CRLF line endings", () => {
    // arrange
    const content = "First line.\r\nacme:acme-foo\r\nLast line.\r\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", ["acme-foo"]);

    // assert
    assert.strictEqual(rewritten, "First line.\r\nacme-foo\r\nLast line.\r\n");
  });

  test("escapes regex metacharacters in the plugin name", () => {
    // arrange
    const content = "AcxMe:foo stays put.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "Ac.Me", ["ac-me-foo"]);

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("rewrites a dotted skill source without swallowing sentence punctuation", () => {
    // arrange
    const content = "Use acme:review.changes.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", ["acme-review-changes"]);

    // assert
    assert.strictEqual(rewritten, "Use acme-review-changes.\n");
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

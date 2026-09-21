import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { rewriteSkillTokens } from "../../extensions/pi-claude-marketplace/domain/skill-tokens.ts";
import { setCasePlatform } from "../platform/case-platform.ts";

describe("rewriteSkillTokens", () => {
  test("leaves an aligned reference byte-identical", () => {
    // arrange
    const content = "Use acme:foo when linting.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", { skills: ["acme:foo"], workflows: [] });

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("converges an elidable reference onto the generated name", () => {
    // arrange
    const content = "Run acme:acme-foo first.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", { skills: ["acme:foo"], workflows: [] });

    // assert
    assert.strictEqual(rewritten, "Run acme:foo first.\n");
  });

  test("rewrites the colon reference to the dot name on win32", (t) => {
    // arrange
    setCasePlatform(t, "win32");
    const content = "Use acme:foo daily.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", { skills: ["acme.foo"], workflows: [] });

    // assert
    assert.strictEqual(rewritten, "Use acme.foo daily.\n");
  });

  test("leaves an unknown reference verbatim", () => {
    // arrange
    const content = "See acme:ghost for details.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", { skills: ["acme:foo"], workflows: [] });

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("leaves a cross-plugin reference verbatim", () => {
    // arrange
    const content = "See other:acme-foo for details.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", { skills: ["acme:foo"], workflows: [] });

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("leaves a token embedded in a longer word verbatim", () => {
    // arrange
    const content = "See xacme:acme-foo for details.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", { skills: ["acme:foo"], workflows: [] });

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("skips a candidate the name generator rejects", () => {
    // arrange
    const content = "See acme:acme- for details.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", { skills: ["acme:foo"], workflows: [] });

    // assert
    assert.strictEqual(rewritten, content);
  });

  test("keeps fenced code blocks verbatim", () => {
    // arrange
    const content =
      "Run acme:acme-foo first.\n\n```text\nacme:acme-foo stays\n```\n\nThen acme:acme-foo again.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", { skills: ["acme:foo"], workflows: [] });

    // assert
    assert.strictEqual(
      rewritten,
      "Run acme:foo first.\n\n```text\nacme:acme-foo stays\n```\n\nThen acme:foo again.\n",
    );
  });

  test("treats tilde fences like backtick fences", () => {
    // arrange
    const content = "~~~\nacme:acme-foo\n~~~\nacme:acme-foo\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", { skills: ["acme:foo"], workflows: [] });

    // assert
    assert.strictEqual(rewritten, "~~~\nacme:acme-foo\n~~~\nacme:foo\n");
  });

  test("rewrites every reference on a line, including inline code", () => {
    // arrange
    const content = "Chain `acme:acme-foo` and then acme:acme-foo.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", { skills: ["acme:foo"], workflows: [] });

    // assert
    assert.strictEqual(rewritten, "Chain `acme:foo` and then acme:foo.\n");
  });

  test("preserves CRLF line endings", () => {
    // arrange
    const content = "First line.\r\nacme:acme-foo\r\nLast line.\r\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", { skills: ["acme:foo"], workflows: [] });

    // assert
    assert.strictEqual(rewritten, "First line.\r\nacme:foo\r\nLast line.\r\n");
  });

  test("escapes regex metacharacters in the plugin name", () => {
    // arrange
    const content = "AcxMe:foo stays put.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "Ac.Me", {
      skills: ["Ac.Me:foo"],
      workflows: [],
    });

    // assert
    assert.strictEqual(rewritten, content);
  });
  test("converges an elidable reference onto a generated workflow name", () => {
    // arrange -- the plugin ships no skill by that name, so only the workflow
    // resolver can claim the token.
    const content = "Run acme:acme-audit on every branch.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", {
      skills: [],
      workflows: ["acme:audit"],
    });

    // assert
    assert.strictEqual(rewritten, "Run acme:audit on every branch.\n");
  });

  test("resolves a token through the workflow generator on win32, where the skill spelling differs", (t) => {
    // arrange -- a skill would install as `acme.audit` there; the workflow
    // keeps its colon, so the skill resolver misses and the workflow one hits.
    setCasePlatform(t, "win32");
    const content = "Run acme:acme-audit daily.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", {
      skills: [],
      workflows: ["acme:audit"],
    });

    // assert
    assert.strictEqual(rewritten, "Run acme:audit daily.\n");
  });

  test("prefers the skill a token resolves to over a workflow of the same generated name", (t) => {
    // arrange -- on win32 the two generators disagree, so which one answered
    // first is observable in the bytes.
    setCasePlatform(t, "win32");
    const content = "Run acme:audit now.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", {
      skills: ["acme.audit"],
      workflows: ["acme:audit"],
    });

    // assert
    assert.strictEqual(rewritten, "Run acme.audit now.\n");
  });

  test("leaves a workflow reference verbatim when the plugin stages no such workflow", () => {
    // arrange
    const content = "Run acme:acme-audit on every branch.\n";

    // act
    const rewritten = rewriteSkillTokens(content, "acme", {
      skills: [],
      workflows: ["acme:review"],
    });

    // assert
    assert.strictEqual(rewritten, content);
  });
});

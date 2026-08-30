import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  emitYamlScalar,
  parseFrontmatter,
  sanitizeProvenanceValue,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts";

describe("emitYamlScalar", () => {
  for (const { description, scalar, expectedScalar } of [
    {
      description: "plain text unchanged",
      scalar: "plain description",
      expectedScalar: "plain description",
    },
    {
      description: "matching double quotes inside single quotes",
      scalar: '"quoted description"',
      expectedScalar: `'"quoted description"'`,
    },
    {
      description: "matching single quotes inside double quotes",
      scalar: "'quoted description'",
      expectedScalar: `"'quoted description'"`,
    },
    {
      description: "an unmatched opening double quote unchanged",
      scalar: '"quoted description',
      expectedScalar: '"quoted description',
    },
    {
      description: "an unmatched opening single quote unchanged",
      scalar: "'quoted description",
      expectedScalar: "'quoted description",
    },
    {
      description: "LF and CRLF sequences as spaces",
      scalar: "first line\nsecond line\r\nthird line",
      expectedScalar: "first line second line third line",
    },
    {
      description: "the empty scalar unchanged",
      scalar: "",
      expectedScalar: "",
    },
  ]) {
    test(`emits ${description}`, () => {
      // arrange
      const descriptionScalar = scalar;
      const expectedDescriptionScalar = expectedScalar;

      // act
      const emittedDescriptionScalar = emitYamlScalar(descriptionScalar);

      // assert
      assert.strictEqual(emittedDescriptionScalar, expectedDescriptionScalar);
    });
  }
});

describe("sanitizeProvenanceValue", () => {
  for (const { description, provenanceValue, expectedProvenanceValue } of [
    {
      description: "plain provenance unchanged",
      provenanceValue: "agents/reviewer.md",
      expectedProvenanceValue: "agents/reviewer.md",
    },
    {
      description: "LF and CRLF sequences as spaces",
      provenanceValue: "agents/reviewer.md\ninjected: field\r\nwarning",
      expectedProvenanceValue: "agents/reviewer.md injected: field warning",
    },
    {
      description: "the empty provenance unchanged",
      provenanceValue: "",
      expectedProvenanceValue: "",
    },
  ]) {
    test(`emits ${description}`, () => {
      // arrange
      const provenance = provenanceValue;
      const expectedProvenance = expectedProvenanceValue;

      // act
      const sanitizedProvenance = sanitizeProvenanceValue(provenance);

      // assert
      assert.strictEqual(sanitizedProvenance, expectedProvenance);
    });
  }
});

describe("parseFrontmatter", () => {
  for (const { description, agentFile, expectedAgentFile } of [
    {
      description: "a plain body without frontmatter",
      agentFile: "Plain body.\n",
      expectedAgentFile: { raw: {}, body: "Plain body.\n" },
    },
    {
      description: "a bare opening delimiter as body text",
      agentFile: "---",
      expectedAgentFile: { raw: {}, body: "---" },
    },
    {
      description: "an unclosed frontmatter block as body text",
      agentFile: "---\nname: reviewer\nno closing delimiter\n",
      expectedAgentFile: {
        raw: {},
        body: "---\nname: reviewer\nno closing delimiter\n",
      },
    },
    {
      description: "leading body blank lines as one newline",
      agentFile: "\n\n\nBody.\n",
      expectedAgentFile: { raw: {}, body: "\nBody.\n" },
    },
  ]) {
    test(`returns ${description}`, () => {
      // arrange
      const sourceAgentFile = agentFile;
      const expectedParsedAgentFile = expectedAgentFile;

      // act
      const parsedAgentFile = parseFrontmatter(sourceAgentFile);

      // assert
      assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
    });
  }

  test("returns complete scalar metadata and exact body bytes", () => {
    // arrange
    const sourceAgentFile = `---
name: reviewer
description: "Review: source changes"
model: sonnet
tools: Read,Bash
thinking: high
skills: plugin:review,plugin:check
inheritSkills: false
escaped: line\\nnot-a-newline
empty:
---


Review the change.
Keep the final newline.
`;
    const expectedParsedAgentFile = {
      raw: {
        name: "reviewer",
        description: '"Review: source changes"',
        model: "sonnet",
        tools: "Read,Bash",
        thinking: "high",
        skills: "plugin:review,plugin:check",
        inheritSkills: "false",
        escaped: "line\\nnot-a-newline",
        empty: "",
      },
      body: "\nReview the change.\nKeep the final newline.\n",
    };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("folds dash metadata in source order without colon splitting", () => {
    // arrange
    const sourceAgentFile = `---
name: reviewer
skills:
  - plugin:review
  - plugin:check
hooks:
  - before:read
  - after
---
Body.
`;
    const expectedParsedAgentFile = {
      raw: {
        name: "reviewer",
        skills: "plugin:review,plugin:check",
        hooks: "before:read,after",
      },
      body: "Body.\n",
    };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("keeps an inline value and ignores its dash continuations", () => {
    // arrange
    const sourceAgentFile = `---
name: reviewer
tools: Read
  - Edit
  - Write:unsafe
---
Body.
`;
    const expectedParsedAgentFile = {
      raw: { name: "reviewer", tools: "Read" },
      body: "Body.\n",
    };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("ignores malformed lines and empty dash items", () => {
    // arrange
    const sourceAgentFile = `---
  - orphan
-
colonless
: empty-key

name: reviewer
skills:
-
---
Body.
`;
    const expectedParsedAgentFile = {
      raw: { name: "reviewer", skills: "" },
      body: "Body.\n",
    };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("parses CRLF metadata and preserves CRLF body bytes", () => {
    // arrange
    const sourceAgentFile =
      "---\r\n" +
      "name: reviewer\r\n" +
      "description: Review: source changes\r\n" +
      "tools:\r\n" +
      "  - Read\r\n" +
      "  - Bash\r\n" +
      "---\r\n" +
      "Body.\r\n";
    const expectedParsedAgentFile = {
      raw: {
        name: "reviewer",
        description: "Review: source changes",
        tools: "Read,Bash",
      },
      body: "Body.\r\n",
    };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });
});

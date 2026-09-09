import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  emitGeneratedAgentFile,
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

  test("treats an intercepted empty key as an empty folded list", (t) => {
    // arrange
    const previousInterceptedKey = Object.getOwnPropertyDescriptor(
      Object.prototype,
      "interceptedAgentField",
    );
    t.after(() => {
      if (previousInterceptedKey === undefined) {
        Reflect.deleteProperty(Object.prototype, "interceptedAgentField");
      } else {
        Object.defineProperty(Object.prototype, "interceptedAgentField", previousInterceptedKey);
      }
    });
    Object.defineProperty(Object.prototype, "interceptedAgentField", {
      configurable: true,
      set() {
        return;
      },
    });
    const sourceAgentFile = `---
interceptedAgentField:
  - retained only by the inherited setter
---
Body.
`;
    const expectedParsedAgentFile = { raw: {}, body: "Body.\n" };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("folds a block scalar description without lifting its colon line into a key", () => {
    // arrange
    const sourceAgentFile = `---
name: reviewer
description: >
  Reviews files and reports: findings
  across the whole change set.
tools: Read
---
Body.
`;
    const expectedParsedAgentFile = {
      raw: {
        name: "reviewer",
        description: "Reviews files and reports: findings across the whole change set.",
        tools: "Read",
      },
      body: "Body.\n",
    };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  for (const { blockHeader, blockOutcome, expectedDescription } of [
    {
      blockHeader: ">",
      blockOutcome: "folded onto one line",
      expectedDescription: "first line second line",
    },
    {
      blockHeader: ">-",
      blockOutcome: "folded onto one line",
      expectedDescription: "first line second line",
    },
    {
      blockHeader: ">+",
      blockOutcome: "folded onto one line",
      expectedDescription: "first line second line",
    },
    {
      blockHeader: ">2",
      blockOutcome: "folded onto one line",
      expectedDescription: "first line second line",
    },
    {
      blockHeader: "|",
      blockOutcome: "kept on separate lines",
      expectedDescription: "first line\nsecond line",
    },
    {
      blockHeader: "|-",
      blockOutcome: "kept on separate lines",
      expectedDescription: "first line\nsecond line",
    },
    {
      blockHeader: "|+",
      blockOutcome: "kept on separate lines",
      expectedDescription: "first line\nsecond line",
    },
    {
      blockHeader: "|2",
      blockOutcome: "kept on separate lines",
      expectedDescription: "first line\nsecond line",
    },
  ]) {
    test(`returns a ${blockHeader} block scalar ${blockOutcome}`, () => {
      // arrange
      const sourceAgentFile = `---
description: ${blockHeader}
  first line
  second line
tools: Read
---
Body.
`;
      const expectedParsedAgentFile = {
        raw: { description: expectedDescription, tools: "Read" },
        body: "Body.\n",
      };

      // act
      const parsedAgentFile = parseFrontmatter(sourceAgentFile);

      // assert
      assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
    });
  }

  test("returns a literal block that runs to the closing delimiter", () => {
    // arrange
    const sourceAgentFile = `---
name: reviewer
description: |
  First line.
  Second line: with a colon.
---
Body.
`;
    const expectedParsedAgentFile = {
      raw: {
        name: "reviewer",
        description: "First line.\nSecond line: with a colon.",
      },
      body: "Body.\n",
    };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("keeps blank-line separators and more-indented lines while folding", () => {
    // arrange
    const sourceAgentFile = `---
description: >

  First paragraph line
  continues here.

  Second paragraph.
    more indented literal

    deeper after blank
  back to base: with colon
tools: Read
---
Body.
`;
    const expectedParsedAgentFile = {
      raw: {
        description:
          "First paragraph line continues here.\nSecond paragraph.\n  more indented literal\n\n  deeper after blank\nback to base: with colon",
        tools: "Read",
      },
      body: "Body.\n",
    };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("returns an empty value for a block header with no continuation lines", () => {
    // arrange
    const sourceAgentFile = `---
description: >
tools: Read
---
Body.
`;
    const expectedParsedAgentFile = {
      raw: { description: "", tools: "Read" },
      body: "Body.\n",
    };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("returns a quoted block indicator as a verbatim value", () => {
    // arrange
    const sourceAgentFile = `---
description: ">"
---
Body.
`;
    const expectedParsedAgentFile = {
      raw: { description: '">"' },
      body: "Body.\n",
    };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("collects an indented mapping as one multiline value without phantom keys", () => {
    // arrange
    const sourceAgentFile = `---
provenance:
  generatedBy: pi-claude-marketplace

  sourcePath: agents/reviewer.md
name: reviewer
---
Body.
`;
    const expectedParsedAgentFile = {
      raw: {
        provenance: "generatedBy: pi-claude-marketplace\n\nsourcePath: agents/reviewer.md",
        name: "reviewer",
      },
      body: "Body.\n",
    };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("ignores an indented key line with no key awaiting continuation", () => {
    // arrange
    const sourceAgentFile = `---
  stray: value
name: reviewer
---
Body.
`;
    const expectedParsedAgentFile = {
      raw: { name: "reviewer" },
      body: "Body.\n",
    };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("ignores an indented non-dash line between folded dash items", () => {
    // arrange
    const sourceAgentFile = `---
skills:
  - alpha
  stray: value
  - beta
---
Body.
`;
    const expectedParsedAgentFile = {
      raw: { skills: "alpha,beta" },
      body: "Body.\n",
    };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("keeps dash lines under a block header as block text", () => {
    // arrange
    const sourceAgentFile = `---
description: |
  - not a list item
  - second line
tools: Read
---
Body.
`;
    const expectedParsedAgentFile = {
      raw: {
        description: "- not a list item\n- second line",
        tools: "Read",
      },
      body: "Body.\n",
    };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("parses a source led by a byte-order mark identically to the unmarked source", () => {
    // arrange
    // FMBOM-01: the marker defeats the anchored `^---` fence match, so without
    // the strip `raw` comes back empty and the whole block lands in `body`.
    const sourceAgentFile = `---
name: reviewer
description: Reviews changes
model: sonnet
tools: Read,Bash
---
Review the change.
`;
    const markedSourceAgentFile = `\uFEFF${sourceAgentFile}`;
    const expectedParsedAgentFile = {
      raw: {
        name: "reviewer",
        description: "Reviews changes",
        model: "sonnet",
        tools: "Read,Bash",
      },
      body: "Review the change.\n",
    };

    // act
    const parsedMarkedAgentFile = parseFrontmatter(markedSourceAgentFile);
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedMarkedAgentFile, expectedParsedAgentFile);
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("keeps a doubled byte-order mark on the no-frontmatter path", () => {
    // arrange
    // T-FMBOM-02: only one marker is stripped, so a doubled marker still fails
    // closed rather than being cleaned into a parseable fence.
    const doublyMarkedSourceAgentFile = `\uFEFF\uFEFF---
name: reviewer
---
Review the change.
`;

    // act
    const parsedAgentFile = parseFrontmatter(doublyMarkedSourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, {
      raw: {},
      body: "\uFEFF---\nname: reviewer\n---\nReview the change.\n",
    });
  });

  test("folds dash items written at column zero", () => {
    // arrange
    const sourceAgentFile = `---
skills:
- alpha
- beta
---
Body.
`;
    const expectedParsedAgentFile = {
      raw: { skills: "alpha,beta" },
      body: "Body.\n",
    };

    // act
    const parsedAgentFile = parseFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });
});

describe("emitGeneratedAgentFile", () => {
  test("emits complete metadata, sanitized provenance, a skill legend, and exact body bytes", () => {
    // arrange
    const generatedAgent = {
      frontmatter: {
        name: "pi-claude-marketplace-acme-reviewer",
        description: '"Review\nsource changes"',
        model: "anthropic/claude-sonnet-4-6",
        tools: ["read", "bash"] as const,
        thinking: "high",
        skills: ["acme-review", "acme-check"],
        inheritSkills: true,
      },
      provenance: {
        pluginName: "acme",
        sourceName: "reviewer",
        sourcePath: "agents/reviewer.md\ninjectedKey: blocked",
        originalModel: "sonnet\r\noriginalModelInjection: blocked",
        droppedFields: ["color\nfieldInjection: blocked", "permissionMode"],
        droppedTools: ["WebFetch\r\ntoolInjection: blocked"],
        warnings: ["first warning\nwarningInjection: blocked", "second warning"],
      },
      body: "Review the source.",
      legend: [
        { token: "acme:review", generatedName: "acme-review" },
        { token: "acme:check", generatedName: "acme-check" },
      ],
    };
    const expectedGeneratedAgentFile = `---
name: pi-claude-marketplace-acme-reviewer
description: '"Review source changes"'
model: anthropic/claude-sonnet-4-6
tools: read,bash
thinking: high
skills: acme-review,acme-check
skillPath: ../pi-claude-marketplace/resources/skills
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: true
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: reviewer
  sourcePath: agents/reviewer.md injectedKey: blocked
  originalModel: sonnet originalModelInjection: blocked
  droppedFields:
    - color fieldInjection: blocked
    - permissionMode
  droppedTools:
    - WebFetch toolInjection: blocked
  warnings:
    - first warning warningInjection: blocked
    - second warning
---

## Pi coding agent skill legend

These instructions reference Claude skills by their original names. In this Pi session:

- \`acme:review\` → skill \`acme-review\` (available on demand)
- \`acme:check\` → skill \`acme-check\` (available on demand)

Review the source.
`;

    // act
    const generatedAgentFile = emitGeneratedAgentFile(generatedAgent);

    // assert
    assert.strictEqual(generatedAgentFile, expectedGeneratedAgentFile);
  });

  test("omits optional metadata and renders empty provenance lists inline", () => {
    // arrange
    const generatedAgent = {
      frontmatter: {
        name: "pi-claude-marketplace-acme-reader",
        description: "Read source changes",
        tools: ["read"] as const,
        skills: [],
        inheritSkills: false,
      },
      provenance: {
        pluginName: "acme",
        sourceName: "reader",
        sourcePath: "agents/reader.md",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
      body: "\nBody already has framing.\n",
    };
    const expectedGeneratedAgentFile = `---
name: pi-claude-marketplace-acme-reader
description: Read source changes
tools: read
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: reader
  sourcePath: agents/reader.md
  droppedFields: []
  droppedTools: []
  warnings: []
---

Body already has framing.
`;

    // act
    const generatedAgentFile = emitGeneratedAgentFile(generatedAgent);

    // assert
    assert.strictEqual(generatedAgentFile, expectedGeneratedAgentFile);
  });

  test("treats an empty legend as absent and adds only the missing trailing newline", () => {
    // arrange
    const generatedAgent = {
      frontmatter: {
        name: "pi-claude-marketplace-acme-writer",
        description: "Write source changes",
        tools: ["write"] as const,
        skills: [],
        inheritSkills: false,
      },
      provenance: {
        pluginName: "acme",
        sourceName: "writer",
        sourcePath: "agents/writer.md",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
      body: "\nBody lacks its final newline.",
      legend: [],
    };
    const expectedGeneratedAgentFile = `---
name: pi-claude-marketplace-acme-writer
description: Write source changes
tools: write
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: writer
  sourcePath: agents/writer.md
  droppedFields: []
  droppedTools: []
  warnings: []
---

Body lacks its final newline.
`;

    // act
    const generatedAgentFile = emitGeneratedAgentFile(generatedAgent);

    // assert
    assert.strictEqual(generatedAgentFile, expectedGeneratedAgentFile);
  });
});

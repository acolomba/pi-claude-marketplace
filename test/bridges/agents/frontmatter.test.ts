import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  emitGeneratedAgentFile,
  emitGeneratedAgentFrontmatter,
  readAgentFrontmatter,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts";

describe("readAgentFrontmatter", () => {
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
    {
      description: "D-PG7-01: a double-quoted description and name without their quote marks",
      agentFile: '---\nname: "x"\ndescription: "Reviews: code."\n---\nBody.\n',
      expectedAgentFile: { raw: { name: "x", description: "Reviews: code." }, body: "Body." },
    },
    {
      description: "D-PG7-01: a single-quoted name without its quote marks",
      agentFile: "---\nname: 'x'\n---\nBody.\n",
      expectedAgentFile: { raw: { name: "x" }, body: "Body." },
    },
    {
      description: "D-PG7-01: a value without the comment after it",
      agentFile: "---\ntools: Read # note\n---\nBody.\n",
      expectedAgentFile: { raw: { tools: "Read" }, body: "Body." },
    },
    {
      description: "a literal block with its lines and YAML's final line feed",
      agentFile: "---\ndescription: |\n  First line.\n  Second line.\ntools: Read\n---\nBody.\n",
      expectedAgentFile: {
        raw: { description: "First line.\nSecond line.\n", tools: "Read" },
        body: "Body.",
      },
    },
    {
      description: "a folded block on one line",
      agentFile: "---\ndescription: >\n  First line.\n  Second line.\n---\nBody.\n",
      expectedAgentFile: { raw: { description: "First line. Second line.\n" }, body: "Body." },
    },
    {
      description: "D-PG7-05: sequences as their items joined with a comma",
      agentFile:
        "---\ntools: [Read, Agent(a, b)]\ndisallowedTools:\n  - Bash\n  - Edit\nskills:\n- alpha\n- beta\n---\nBody.\n",
      expectedAgentFile: {
        raw: { tools: "Read,Agent(a,b)", disallowedTools: "Bash,Edit", skills: "alpha,beta" },
        body: "Body.",
      },
    },
    {
      description: "D-PG7-05: booleans and numbers as their text, and yes as a string",
      agentFile:
        "---\nbackground: true\nasync: True\nname: 123\neffort: 32000\nmemory: yes\n---\nBody.\n",
      expectedAgentFile: {
        raw: { background: "true", async: "true", name: "123", effort: "32000", memory: "yes" },
        body: "Body.",
      },
    },
    {
      description: "D-PG7-05: an empty value and a YAML null as the empty string",
      agentFile: "---\ntools:\ndisallowedTools: ~\n---\nBody.\n",
      expectedAgentFile: { raw: { tools: "", disallowedTools: "" }, body: "Body." },
    },
    {
      description: "D-PG7-05: a mapping value as the empty string under its own key",
      agentFile: "---\nhooks:\n  before: read\ndescription:\n  nested: key\n---\nBody.\n",
      expectedAgentFile: { raw: { hooks: "", description: "" }, body: "Body." },
    },
    {
      description: "T-07-05: a key with a line break, stored with a space in its place",
      agentFile: '---\n"first\\nsecond": value\n---\nBody.\n',
      expectedAgentFile: { raw: { "first second": "value" }, body: "Body." },
    },
    {
      description: "D-PG7-05: no fields for a block that is plain text",
      agentFile: "---\njust text\n---\nBody.\n",
      expectedAgentFile: { raw: {}, body: "Body." },
    },
    {
      description: "D-PG7-05: no fields for a block that is a sequence",
      agentFile: "---\n- Read\n- Bash\n---\nBody.\n",
      expectedAgentFile: { raw: {}, body: "Body." },
    },
    {
      description:
        "D-PG7-02: an unquoted colon description beside a quoted model, through the repair",
      agentFile: '---\ndescription: Reviews: code and tests\nmodel: "sonnet"\n---\nBody.\n',
      expectedAgentFile: {
        raw: { description: "Reviews: code and tests", model: "sonnet" },
        body: "Body.",
      },
    },
    {
      description: "D-PG7-02 / D-CF4-08: values that open with a star, an at sign, or a backtick",
      agentFile: "---\ntools: *\nname: @reviewer\ndescription: `review` the change\n---\nBody.\n",
      expectedAgentFile: {
        raw: { tools: "*", name: "@reviewer", description: "`review` the change" },
        body: "Body.",
      },
    },
    {
      description: "the same fields for a CRLF source as for its LF form",
      agentFile: "---\r\nname: reviewer\r\ntools:\r\n  - Read\r\n  - Bash\r\n---\r\nBody.\r\n",
      expectedAgentFile: { raw: { name: "reviewer", tools: "Read,Bash" }, body: "Body." },
    },
  ]) {
    test(`returns ${description}`, () => {
      // arrange
      const sourceAgentFile = agentFile;
      const expectedParsedAgentFile = expectedAgentFile;

      // act
      const parsedAgentFile = readAgentFrontmatter(sourceAgentFile);

      // assert
      assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
    });
  }

  test("T-07-03: keeps a __proto__ key as data that sets no other field", () => {
    // arrange
    const sourceAgentFile = "---\n__proto__:\n  tools: Bash\nname: reviewer\n---\nBody.\n";

    // act
    const parsedAgentFile = readAgentFrontmatter(sourceAgentFile);

    // assert
    assert.strictEqual(Object.getPrototypeOf(parsedAgentFile.raw), Object.prototype);
    assert.deepStrictEqual(Object.keys(parsedAgentFile.raw), ["__proto__", "name"]);
    assert.strictEqual(parsedAgentFile.raw.tools, undefined);
    assert.strictEqual(parsedAgentFile.body, "Body.");
  });

  test("D-PG7-04: gives no fields and the first parse's message for an unterminated quote", () => {
    // arrange
    const sourceAgentFile = '---\ndescription: "open\ntools: Read\n---\nBody after.\n';
    const expectedParsedAgentFile = {
      raw: {},
      body: "Body after.",
      parseError: 'Missing closing "quote at line 2, column 12:\n\ntools: Read\n           ^\n',
    };

    // act
    const parsedAgentFile = readAgentFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("D-PG7-04: reports the first parse's message when the repaired block fails too", () => {
    // arrange
    const sourceAgentFile = "---\ndescription: Reviews: code\ntools: [Read\n---\nBody after.\n";
    const expectedParsedAgentFile = {
      raw: {},
      body: "Body after.",
      parseError:
        "Nested mappings are not allowed in compact mappings at line 1, column 14:\n\ndescription: Reviews: code\n             ^\n",
    };

    // act
    const parsedAgentFile = readAgentFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("parses a source led by a byte-order mark identically to the unmarked source", () => {
    // arrange
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
      body: "Review the change.",
    };

    // act
    const parsedMarkedAgentFile = readAgentFrontmatter(markedSourceAgentFile);
    const parsedAgentFile = readAgentFrontmatter(sourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedMarkedAgentFile, expectedParsedAgentFile);
    assert.deepStrictEqual(parsedAgentFile, expectedParsedAgentFile);
  });

  test("repairs a source led by a byte-order mark as the unmarked source", () => {
    // arrange
    const sourceAgentFile = "---\ntools: *\n---\nBody.\n";
    const markedSourceAgentFile = `\uFEFF${sourceAgentFile}`;

    // act
    const parsedMarkedAgentFile = readAgentFrontmatter(markedSourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedMarkedAgentFile, { raw: { tools: "*" }, body: "Body." });
  });

  test("keeps a doubled byte-order mark on the no-frontmatter path", () => {
    // arrange
    // T-FMBOM-02: Pi strips only one marker, so a doubled marker still fails
    // closed rather than being cleaned into a parseable fence.
    const doublyMarkedSourceAgentFile = `\uFEFF\uFEFF---
name: reviewer
---
Review the change.
`;

    // act
    const parsedAgentFile = readAgentFrontmatter(doublyMarkedSourceAgentFile);

    // assert
    assert.deepStrictEqual(parsedAgentFile, {
      raw: {},
      body: "\uFEFF---\nname: reviewer\n---\nReview the change.\n",
    });
  });
});

describe("emitGeneratedAgentFile", () => {
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
    test(`emits a description with ${description}`, () => {
      // arrange
      const expectedAgentFile = `---
name: reviewer
description: ${expectedScalar}
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
advertise: true
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: reviewer
  sourcePath: agents/reviewer.md
  droppedFields: []
  droppedTools: []
  warnings: []
---

Review files.
`;

      // act
      const agentFile = emitGeneratedAgentFile({
        frontmatter: { name: "reviewer", description: scalar, skills: [], inheritSkills: false },
        provenance: {
          pluginName: "acme",
          sourceName: "reviewer",
          sourcePath: "agents/reviewer.md",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        body: "Review files.",
      });

      // assert
      assert.strictEqual(agentFile, expectedAgentFile);
    });
  }

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
    test(`emits source provenance with ${description}`, () => {
      // arrange
      const expectedAgentFile = `---
name: reviewer
description: Reviews files
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
advertise: true
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: reviewer
  sourcePath: ${expectedProvenanceValue}
  originalModel: ${expectedProvenanceValue}
  droppedFields:
    - ${expectedProvenanceValue}
  droppedTools:
    - ${expectedProvenanceValue}
  warnings:
    - ${expectedProvenanceValue}
---

Review files.
`;

      // act
      const agentFile = emitGeneratedAgentFile({
        frontmatter: {
          name: "reviewer",
          description: "Reviews files",
          skills: [],
          inheritSkills: false,
        },
        provenance: {
          pluginName: "acme",
          sourceName: "reviewer",
          sourcePath: provenanceValue,
          originalModel: provenanceValue,
          droppedFields: [provenanceValue],
          droppedTools: [provenanceValue],
          warnings: [provenanceValue],
        },
        body: "Review files.",
      });

      // assert
      assert.strictEqual(agentFile, expectedAgentFile);
    });
  }

  test("renders nonempty aliases before optional metadata and preserves body bytes", () => {
    // arrange
    const generatedAgent = {
      frontmatter: {
        name: "pi-claude-marketplace-acme-reviewer",
        description: "Review source changes",
        aliases: ["review", "audit"],
        model: "anthropic/claude-sonnet-4-6",
        skills: [],
        inheritSkills: false,
      },
      provenance: {
        pluginName: "acme",
        sourceName: "reviewer",
        sourcePath: "agents/reviewer.md",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
      body: "Review the source.\nKeep the final newline.\n",
    };
    const expectedGeneratedAgentFile = `---
name: pi-claude-marketplace-acme-reviewer
description: Review source changes
aliases: review,audit
model: anthropic/claude-sonnet-4-6
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
advertise: true
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: reviewer
  sourcePath: agents/reviewer.md
  droppedFields: []
  droppedTools: []
  warnings: []
---

Review the source.
Keep the final newline.
`;

    // act
    const generatedAgentFile = emitGeneratedAgentFile(generatedAgent);

    // assert
    assert.strictEqual(generatedAgentFile, expectedGeneratedAgentFile);
  });

  test("emits complete metadata, sanitized provenance, and exact body bytes", () => {
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
advertise: true
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
advertise: true
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

  test("omits the tool allowlist and renders excludeTools when the agent inherits Pi defaults", () => {
    // arrange
    const generatedAgent = {
      frontmatter: {
        name: "pi-claude-marketplace-acme-scout",
        description: "Scout source changes",
        excludeTools: ["edit", "write"] as const,
        thinking: "high",
        skills: [],
        inheritSkills: true,
      },
      provenance: {
        pluginName: "acme",
        sourceName: "scout",
        sourcePath: "agents/scout.md",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
      body: "\nScout body.\n",
    };
    const expectedGeneratedAgentFile = `---
name: pi-claude-marketplace-acme-scout
description: Scout source changes
excludeTools: edit,write
thinking: high
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: true
advertise: true
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: scout
  sourcePath: agents/scout.md
  droppedFields: []
  droppedTools: []
  warnings: []
---

Scout body.
`;

    // act
    const generatedAgentFile = emitGeneratedAgentFile(generatedAgent);

    // assert
    assert.strictEqual(generatedAgentFile, expectedGeneratedAgentFile);
  });

  test("adds the missing trailing newline", () => {
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
    };
    const expectedGeneratedAgentFile = `---
name: pi-claude-marketplace-acme-writer
description: Write source changes
tools: write
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
advertise: true
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

  for (const inheritSkills of [true, false]) {
    test(`D-CF4-14 advertises an agent that inherits skills: ${inheritSkills}`, () => {
      // arrange
      const expectedAgentFile = `---
name: acme:bot
description: d
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: ${inheritSkills}
advertise: true
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: agents/bot.md
  droppedFields: []
  droppedTools: []
  warnings: []
---

Body.
`;

      // act
      const agentFile = emitGeneratedAgentFile({
        frontmatter: { name: "acme:bot", description: "d", skills: [], inheritSkills },
        provenance: {
          pluginName: "acme",
          sourceName: "bot",
          sourcePath: "agents/bot.md",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        body: "Body.",
      });

      // assert
      assert.strictEqual(agentFile, expectedAgentFile);
    });
  }

  for (const launchAsync of [true, false]) {
    test(`D-CF4-05 writes async: ${launchAsync} right after the advertise line`, () => {
      // arrange
      const expectedAgentFile = `---
name: acme:bot
description: d
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
advertise: true
async: ${launchAsync}
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: agents/bot.md
  droppedFields: []
  droppedTools: []
  warnings: []
---

Body.
`;

      // act
      const agentFile = emitGeneratedAgentFile({
        frontmatter: {
          name: "acme:bot",
          description: "d",
          skills: [],
          inheritSkills: false,
          async: launchAsync,
        },
        provenance: {
          pluginName: "acme",
          sourceName: "bot",
          sourcePath: "agents/bot.md",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        body: "Body.",
      });

      // assert
      assert.strictEqual(agentFile, expectedAgentFile);
    });
  }
});

describe("emitGeneratedAgentFrontmatter", () => {
  const agentFields = {
    frontmatter: {
      name: "acme:reviewer",
      description: "Reviews files",
      tools: ["read", "mcp:plugin_acme_db/query"],
      skills: [],
      inheritSkills: false,
      async: true,
    },
    provenance: {
      pluginName: "acme",
      sourceName: "reviewer",
      sourcePath: "agents/reviewer.md",
      droppedFields: [],
      droppedTools: ["WebFetch"],
      warnings: ["first warning"],
    },
  } as const;
  const expectedFrontmatter = `---
name: acme:reviewer
description: Reviews files
tools: read,mcp:plugin_acme_db/query
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
advertise: true
async: true
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: reviewer
  sourcePath: agents/reviewer.md
  droppedFields: []
  droppedTools:
    - WebFetch
  warnings:
    - first warning
---
`;

  test("MGRT-01: returns the frontmatter block from the opening through the closing --- line", () => {
    // act
    const frontmatter = emitGeneratedAgentFrontmatter(agentFields);

    // assert
    assert.strictEqual(frontmatter, expectedFrontmatter);
  });

  for (const { label, body, expectedBody } of [
    {
      label: "a body with no separators",
      body: "Review files.",
      expectedBody: "\nReview files.\n",
    },
    {
      label: "a body that already has its separators",
      body: "\nReview files.\n",
      expectedBody: "\nReview files.\n",
    },
    {
      label: "a body holding a --- line",
      body: "Before.\n---\nAfter.\n",
      expectedBody: "\nBefore.\n---\nAfter.\n",
    },
  ]) {
    test(`MGRT-01: the file is the frontmatter block followed by ${label}`, () => {
      // act
      const agentFile = emitGeneratedAgentFile({ ...agentFields, body });

      // assert
      assert.strictEqual(agentFile, expectedFrontmatter + expectedBody);
    });
  }
});

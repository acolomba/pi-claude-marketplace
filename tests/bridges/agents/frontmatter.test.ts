import assert from "node:assert/strict";
import test from "node:test";

import {
  emitGeneratedAgentFile,
  emitYamlScalar,
  GENERATED_AGENT_MARKER,
  parseFrontmatter,
  sanitizeProvenanceValue,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts";

// AG-6 / AG-8 line-based frontmatter parser + emitter contract.

test("AG-6 parseFrontmatter tolerates colon in description value", () => {
  const text =
    "---\n" +
    "name: bot\n" +
    "description: hello: world\n" +
    "tools: Read,Bash\n" +
    "---\n" +
    "\n" +
    "Body.\n";
  const { raw } = parseFrontmatter(text);
  assert.equal(raw.description, "hello: world");
});

test("AG-6 parseFrontmatter returns empty raw for file with no leading ---", () => {
  const text = "Just a body. No frontmatter here.\n";
  const { raw, body } = parseFrontmatter(text);
  assert.deepEqual({ ...raw }, {});
  assert.match(body, /Just a body/);
});

test("AG-6 parseFrontmatter splits frontmatter and body at closing ---", () => {
  const text = "---\nname: bot\n---\nbody-content\n";
  const { raw, body } = parseFrontmatter(text);
  assert.equal(raw.name, "bot");
  assert.match(body, /body-content/);
});

test("AG-6 parseFrontmatter returns empty raw when closing --- is absent", () => {
  const text = "---\nname: bot\nno close\n";
  const { raw } = parseFrontmatter(text);
  assert.deepEqual({ ...raw }, {});
});

test("AG-6 parseFrontmatter handles CRLF line endings", () => {
  const text = "---\r\nname: bot\r\ndescription: x\r\n---\r\nbody\r\n";
  const { raw, body } = parseFrontmatter(text);
  assert.equal(raw.name, "bot");
  assert.equal(raw.description, "x");
  assert.match(body, /body/);
});

// AGSK-01 (#86): dash-list folding. A key with an empty inline value
// followed by `- item` continuation lines folds the items into that key's
// comma-joined value; dash items are taken verbatim (never colon-split).

test("AGSK-01 parseFrontmatter folds colon-bearing dash item verbatim into skills (#86)", () => {
  const text =
    "---\n" +
    "name: reviewer\n" +
    "description: Reviews changes.\n" +
    "skills:\n" +
    "  - spec-tree:review-changes\n" +
    "---\n" +
    "\n" +
    "Body.\n";
  const { raw } = parseFrontmatter(text);
  assert.equal(raw.skills, "spec-tree:review-changes");
  assert.equal("- spec-tree" in raw, false);
});

test("D-82-01 parseFrontmatter folds multiple dash items comma-joined in source order", () => {
  const text =
    "---\n" + "name: bot\n" + "tools:\n" + "  - Read\n" + "  - Bash\n" + "---\n" + "\n" + "Body.\n";
  const { raw } = parseFrontmatter(text);
  assert.equal(raw.tools, "Read,Bash");
});

test("D-82-01 parseFrontmatter folds unsupported list keys cleanly with no bogus dash keys", () => {
  const text =
    "---\n" + "name: bot\n" + "hooks:\n" + "  - a:b\n" + "  - c\n" + "---\n" + "\n" + "Body.\n";
  const { raw } = parseFrontmatter(text);
  assert.equal(raw.hooks, "a:b,c");
  for (const key of Object.keys(raw)) {
    assert.equal(key.startsWith("- "), false, `unexpected dash key: ${key}`);
  }
});

test("D-82-03 parseFrontmatter mixed form keeps the inline value and ignores dash items", () => {
  const text =
    "---\n" +
    "name: bot\n" +
    "tools: Read\n" +
    "  - Edit\n" +
    "  - Write:x\n" +
    "---\n" +
    "\n" +
    "Body.\n";
  const { raw } = parseFrontmatter(text);
  assert.equal(raw.tools, "Read");
  assert.equal("- Write" in raw, false);
});

test("AGSK-01 parseFrontmatter ignores orphan dash items and bare dash lines", () => {
  const text = "---\n" + "- x\n" + "- a:b\n" + "-\n" + "name: bot\n" + "---\n" + "\n" + "Body.\n";
  const { raw } = parseFrontmatter(text);
  assert.equal(raw.name, "bot");
  assert.deepEqual(Object.keys(raw), ["name"]);
});

test("D-82-01 parseFrontmatter folds dash items with CRLF line endings", () => {
  const text =
    "---\r\n" +
    "name: bot\r\n" +
    "tools:\r\n" +
    "  - Read\r\n" +
    "  - Bash\r\n" +
    "---\r\n" +
    "\r\n" +
    "Body.\r\n";
  const { raw } = parseFrontmatter(text);
  assert.equal(raw.tools, "Read,Bash");
});

test("AGSK-01 parseFrontmatter leaves CSV, inline-array, and empty-value forms unchanged", () => {
  const csv = parseFrontmatter("---\ntools: Read,Bash\n---\nBody.\n");
  assert.equal(csv.raw.tools, "Read,Bash");

  const inlineArray = parseFrontmatter('---\ntools: ["Read", "Bash"]\n---\nBody.\n');
  assert.equal(inlineArray.raw.tools, '["Read", "Bash"]');

  const emptyValue = parseFrontmatter("---\nskills:\nname: bot\n---\nBody.\n");
  assert.equal(emptyValue.raw.skills, "");
  assert.equal(emptyValue.raw.name, "bot");
});

test("AG-8 emitYamlScalar single-quote-flips when value starts and ends with double-quote", () => {
  const out = emitYamlScalar('"hello world"');
  assert.equal(out, "'\"hello world\"'");
});

test("AG-8 emitYamlScalar double-quote-flips when value starts and ends with single-quote", () => {
  const out = emitYamlScalar("'hello world'");
  assert.equal(out, "\"'hello world'\"");
});

test("AG-8 emitYamlScalar returns unchanged for value with no surrounding matched quotes", () => {
  const out = emitYamlScalar("hello world");
  assert.equal(out, "hello world");
});

test("AG-8 emitYamlScalar replaces newlines with spaces", () => {
  const out = emitYamlScalar("line1\nline2\r\nline3");
  assert.equal(out, "line1 line2 line3");
});

test("T-d8i-02 sanitizeProvenanceValue collapses newlines to single spaces", () => {
  const out = sanitizeProvenanceValue("line1\nline2\r\nline3");
  assert.equal(out, "line1 line2 line3");
});

test("T-d8i-02 sanitizeProvenanceValue is no-op when no newline present", () => {
  const out = sanitizeProvenanceValue("path/normal.md");
  assert.equal(out, "path/normal.md");
});

test("AG-8 emitGeneratedAgentFile emits fields in deterministic order: name, description, model, tools, thinking, skills, then systemPromptMode/inheritProjectContext/inheritSkills", () => {
  const out = emitGeneratedAgentFile({
    frontmatter: {
      name: "pi-claude-marketplace-acme-bot",
      description: "An agent.",
      model: "anthropic/claude-sonnet-4-6",
      tools: ["read", "bash"],
      thinking: "high",
      skills: ["acme-knowledge"],
    },
    provenance: {
      pluginName: "acme",
      sourceName: "bot",
      sourcePath: "/path/to/source.md",
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    },
    body: "Body content.",
  });

  const fields = [
    "name:",
    "description:",
    "model:",
    "tools:",
    "thinking:",
    "skills:",
    "systemPromptMode:",
    "inheritProjectContext:",
    "inheritSkills:",
  ];
  let last = -1;
  for (const f of fields) {
    const idx = out.indexOf(f);
    assert.ok(idx > last, `expected ${f} after byte offset ${String(last)}, got ${String(idx)}`);
    last = idx;
  }
});

test("AG-8 emitGeneratedAgentFile omits model when undefined", () => {
  const out = emitGeneratedAgentFile({
    frontmatter: {
      name: "pi-claude-marketplace-acme-bot",
      description: "An agent.",
      tools: ["read"],
      skills: [],
    },
    provenance: {
      pluginName: "acme",
      sourceName: "bot",
      sourcePath: "/path/to/source.md",
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    },
    body: "Body.",
  });
  // model line MUST NOT appear in frontmatter (between opening --- and closing ---).
  const fmEnd = out.indexOf("\n---\n", 4); // start search past opening "---\n"
  const frontmatterBlock = out.slice(0, fmEnd);
  assert.doesNotMatch(frontmatterBlock, /^model:/m);
});

test("AG-8 emitGeneratedAgentFile omits skills line when skills array is empty", () => {
  const out = emitGeneratedAgentFile({
    frontmatter: {
      name: "pi-claude-marketplace-acme-bot",
      description: "An agent.",
      tools: ["read"],
      skills: [],
    },
    provenance: {
      pluginName: "acme",
      sourceName: "bot",
      sourcePath: "/path/to/source.md",
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    },
    body: "Body.",
  });
  const fmEnd = out.indexOf("\n---\n", 4);
  const frontmatterBlock = out.slice(0, fmEnd);
  assert.doesNotMatch(frontmatterBlock, /^skills:/m);
});

test("AG-5 emitGeneratedAgentFile provenance carries the GENERATED_AGENT_MARKER substring", () => {
  const out = emitGeneratedAgentFile({
    frontmatter: {
      name: "pi-claude-marketplace-acme-bot",
      description: "A.",
      tools: ["read"],
      skills: [],
    },
    provenance: {
      pluginName: "acme",
      sourceName: "bot",
      sourcePath: "/abs/path.md",
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    },
    body: "Body.",
  });
  assert.ok(out.includes("generatedBy: pi-claude-marketplace"));
  assert.ok(out.includes(GENERATED_AGENT_MARKER));
});

test("T-d8i-02 emitGeneratedAgentFile keeps a newline-bearing sourcePath on one provenance line, blocking key injection", () => {
  const out = emitGeneratedAgentFile({
    frontmatter: {
      name: "pi-claude-marketplace-acme-bot",
      description: "A.",
      tools: ["read"],
      skills: [],
    },
    provenance: {
      pluginName: "acme",
      sourceName: "bot",
      sourcePath: "/path/evil.md\ninjectedKey: injectedValue",
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    },
    body: "Body.",
  });
  const { raw } = parseFrontmatter(out);
  // The newline is collapsed to a space so the crafted value stays on one
  // provenance line -- no bogus `injectedKey` was parsed out.
  assert.equal("injectedKey" in raw, false);
  assert.ok(!out.includes("\ninjectedKey:"));
});

test("AG-8 emitGeneratedAgentFile renders empty provenance lists as inline []", () => {
  const out = emitGeneratedAgentFile({
    frontmatter: {
      name: "pi-claude-marketplace-acme-bot",
      description: "A.",
      tools: ["read"],
      skills: [],
    },
    provenance: {
      pluginName: "acme",
      sourceName: "bot",
      sourcePath: "/abs.md",
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    },
    body: "Body.",
  });
  assert.match(out, /^ {2}droppedFields: \[\]$/m);
  assert.match(out, /^ {2}droppedTools: \[\]$/m);
  assert.match(out, /^ {2}warnings: \[\]$/m);
});

test("AG-8 emitGeneratedAgentFile renders non-empty provenance lists as YAML block lists", () => {
  const out = emitGeneratedAgentFile({
    frontmatter: {
      name: "pi-claude-marketplace-acme-bot",
      description: "A.",
      tools: ["read"],
      skills: [],
    },
    provenance: {
      pluginName: "acme",
      sourceName: "bot",
      sourcePath: "/abs.md",
      droppedFields: ["fieldA", "fieldB"],
      droppedTools: ["Bash"],
      warnings: ["some warning text"],
    },
    body: "Body.",
  });
  assert.ok(out.includes("  droppedFields:\n    - fieldA\n    - fieldB\n"));
  assert.ok(out.includes("  droppedTools:\n    - Bash\n"));
  assert.ok(out.includes("  warnings:\n    - some warning text\n"));
});

// ---------------------------------------------------------------------------
// AGSK-04 skill legend rendering (D-82-04 placement, D-82-05 shape)
// ---------------------------------------------------------------------------

/**
 * Shared emit input for the legend byte-layout pins. NO_LEGEND_EXPECTED was
 * captured from the emitter BEFORE the legend seam existed, so the
 * undefined/empty pins prove the no-legend byte layout cannot drift.
 */
function makeLegendEmitInput(): Parameters<typeof emitGeneratedAgentFile>[0] {
  return {
    frontmatter: {
      name: "pi-claude-marketplace-acme-bot",
      description: "An agent.",
      tools: ["read", "bash"],
      skills: ["acme-knowledge"],
    },
    provenance: {
      pluginName: "acme",
      sourceName: "bot",
      sourcePath: "/abs/path/source.md",
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    },
    body: "Body content.",
  };
}

const NO_LEGEND_EXPECTED = `---
name: pi-claude-marketplace-acme-bot
description: An agent.
tools: read,bash
skills: acme-knowledge
skillPath: ../pi-claude-marketplace/resources/skills
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: /abs/path/source.md
  droppedFields: []
  droppedTools: []
  warnings: []
---

Body content.
`;

test("AGSK-04 emitGeneratedAgentFile without legend keeps today's exact bytes", () => {
  const out = emitGeneratedAgentFile(makeLegendEmitInput());
  assert.equal(out, NO_LEGEND_EXPECTED);
});

test("AGSK-04 emitGeneratedAgentFile with empty legend emits bytes identical to undefined", () => {
  const out = emitGeneratedAgentFile({ ...makeLegendEmitInput(), legend: [] });
  assert.equal(out, NO_LEGEND_EXPECTED);
});

test("D-82-04 / D-82-05 emitGeneratedAgentFile renders the legend block between the frontmatter and the body", () => {
  const out = emitGeneratedAgentFile({
    ...makeLegendEmitInput(),
    legend: [
      {
        token: "spec-tree:review-changes",
        generatedName: "spec-tree-review-changes",
      },
      {
        token: "spec-tree:other-skill",
        generatedName: "spec-tree-other-skill",
      },
    ],
  });
  const expected = `---
name: pi-claude-marketplace-acme-bot
description: An agent.
tools: read,bash
skills: acme-knowledge
skillPath: ../pi-claude-marketplace/resources/skills
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: /abs/path/source.md
  droppedFields: []
  droppedTools: []
  warnings: []
---

## Pi coding agent skill legend

These instructions reference Claude skills by their original names. In this Pi session:

- \`spec-tree:review-changes\` \u2192 skill \`spec-tree-review-changes\` (available on demand)
- \`spec-tree:other-skill\` \u2192 skill \`spec-tree-other-skill\` (available on demand)

Body content.
`;
  assert.equal(out, expected);
});

// ---------------------------------------------------------------------------
// AGSK-05 inheritSkills emission (D-83-01) and on-demand legend state (D-83.1-03)
// ---------------------------------------------------------------------------

/**
 * D-83-01 true path: byte-identical to NO_LEGEND_EXPECTED except the single
 * `inheritSkills: false` line becomes `inheritSkills: true` (lowercase only --
 * pi-subagents parses the value by string equality against "true").
 */
const INHERIT_TRUE_EXPECTED = `---
name: pi-claude-marketplace-acme-bot
description: An agent.
tools: read,bash
skills: acme-knowledge
skillPath: ../pi-claude-marketplace/resources/skills
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: true
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: /abs/path/source.md
  droppedFields: []
  droppedTools: []
  warnings: []
---

Body content.
`;

test("AGSK-05 / D-83-01 emitGeneratedAgentFile with inheritSkills true flips only the inheritSkills line", () => {
  const base = makeLegendEmitInput();
  const out = emitGeneratedAgentFile({
    ...base,
    frontmatter: { ...base.frontmatter, inheritSkills: true },
  });
  assert.equal(out, INHERIT_TRUE_EXPECTED);
});

test("T-d8i-01 provenance mapping is appended immediately after inheritSkills, with the warnings field last before the closing ---", () => {
  const base = makeLegendEmitInput();
  const out = emitGeneratedAgentFile({
    ...base,
    frontmatter: { ...base.frontmatter, inheritSkills: true },
  });
  const fmEnd = out.indexOf("\n---\n", 4); // start search past opening "---\n"
  const frontmatterBlock = out.slice(0, fmEnd);
  assert.ok(
    frontmatterBlock.includes(
      "\ninheritSkills: true\nprovenance:\n  generatedBy: pi-claude-marketplace\n",
    ),
  );
  assert.ok(frontmatterBlock.endsWith("\n  warnings: []"));
});

test("AGSK-05 / D-83.1-03 legend annotates a known-but-not-emitted entry as available on demand when inheritSkills is true", () => {
  const base = makeLegendEmitInput();
  const out = emitGeneratedAgentFile({
    ...base,
    frontmatter: { ...base.frontmatter, inheritSkills: true },
    legend: [
      {
        token: "spec-tree:review-changes",
        generatedName: "spec-tree-review-changes",
      },
      {
        token: "spec-tree:other-skill",
        generatedName: "spec-tree-other-skill",
      },
    ],
  });
  const expected = `---
name: pi-claude-marketplace-acme-bot
description: An agent.
tools: read,bash
skills: acme-knowledge
skillPath: ../pi-claude-marketplace/resources/skills
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: true
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: /abs/path/source.md
  droppedFields: []
  droppedTools: []
  warnings: []
---

## Pi coding agent skill legend

These instructions reference Claude skills by their original names. In this Pi session:

- \`spec-tree:review-changes\` \u2192 skill \`spec-tree-review-changes\` (available on demand)
- \`spec-tree:other-skill\` \u2192 skill \`spec-tree-other-skill\` (available on demand)

Body content.
`;
  assert.equal(out, expected);
});

// ---------------------------------------------------------------------------
// T-d8i-01: provenance stays out of the body (the child subagent's system
// prompt), and rides the frontmatter `provenance` mapping instead.
// ---------------------------------------------------------------------------

test("T-d8i-01 parseFrontmatter(emitGeneratedAgentFile(...)).body excludes all provenance text while the marker survives in the file", () => {
  const out = emitGeneratedAgentFile({
    ...makeLegendEmitInput(),
    provenance: {
      pluginName: "acme",
      sourceName: "bot",
      sourcePath: "/abs/path/source.md",
      droppedFields: ["color"],
      droppedTools: ["WebFetch"],
      warnings: ["source description was missing or empty -- using fallback"],
    },
  });
  const { body } = parseFrontmatter(out);
  assert.doesNotMatch(body, /generatedBy: pi-claude-marketplace/);
  assert.doesNotMatch(body, /sourcePlugin/);
  assert.doesNotMatch(body, /sourceAgent/);
  assert.doesNotMatch(body, /source description was missing/);
  // The marker no longer lives in the body, but the whole file still carries
  // it (as the provenance.generatedBy line) for isOwnedAgentFile.
  assert.ok(out.includes(GENERATED_AGENT_MARKER));
});

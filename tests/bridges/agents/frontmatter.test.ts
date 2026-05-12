import assert from "node:assert/strict";
import test from "node:test";

import {
  emitGeneratedAgentFile,
  emitYamlScalar,
  GENERATED_AGENT_MARKER,
  parseFrontmatter,
  sanitizeProvenance,
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

test("AG-8 sanitizeProvenance escapes --> to --&gt;", () => {
  const out = sanitizeProvenance("path/with-->in-it.md");
  assert.equal(out, "path/with--&gt;in-it.md");
});

test("AG-8 sanitizeProvenance is no-op when no --> substring present", () => {
  const out = sanitizeProvenance("path/normal.md");
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

test("AG-5 emitGeneratedAgentFile body contains GENERATED_AGENT_MARKER substring", () => {
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
  assert.ok(out.includes("generated by pi-claude-marketplace"));
  assert.ok(out.includes(GENERATED_AGENT_MARKER));
});

test("AG-8 emitGeneratedAgentFile sanitizes --> in sourcePath", () => {
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
      sourcePath: "/path/with-->malicious.md",
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    },
    body: "Body.",
  });
  // The literal `-->` MUST NOT appear before the closing `-->` of the comment.
  const commentClose = out.lastIndexOf("-->");
  const beforeClose = out.slice(0, commentClose);
  assert.doesNotMatch(beforeClose, /-->/);
  // The escaped form must be present.
  assert.match(out, /--&gt;/);
});

test("AG-8 emitGeneratedAgentFile renders (none) for empty droppedFields/droppedTools/warnings", () => {
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
  assert.match(out, /droppedFields: \(none\)/);
  assert.match(out, /droppedTools: \(none\)/);
  assert.match(out, /warnings: \(none\)/);
});

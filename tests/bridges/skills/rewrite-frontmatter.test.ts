import assert from "node:assert/strict";
import test from "node:test";

import { rewriteFrontmatterName } from "../../../extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts";
import { parseFrontmatter } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

// SK-3: rewriteFrontmatterName.

test("SK-3 rewriteFrontmatterName replaces existing name field", () => {
  const input = "---\nname: old-name\ndescription: foo\n---\n\nbody text";
  const out = rewriteFrontmatterName(input, "new-name");
  assert.match(out, /^---\nname: new-name\ndescription: foo\n---/);
  assert.ok(out.includes("body text"));
  assert.ok(!out.includes("old-name"));
});

test("SK-3 rewriteFrontmatterName preserves description, license, and other fields", () => {
  const input =
    "---\nname: old-name\ndescription: A skill\nlicense: MIT\nversion: 1.0.0\n---\n\nbody";
  const out = rewriteFrontmatterName(input, "renamed");
  assert.ok(out.includes("description: A skill"));
  assert.ok(out.includes("license: MIT"));
  assert.ok(out.includes("version: 1.0.0"));
  assert.ok(out.includes("name: renamed"));
});

test("SK-3 rewriteFrontmatterName adds frontmatter to file with no leading ---", () => {
  const input = "# Skill Document\n\nNo frontmatter here.";
  const out = rewriteFrontmatterName(input, "added-name");
  assert.match(out, /^---\nname: added-name\n---\n\n/);
  assert.ok(out.includes("# Skill Document"));
});

test("SK-3 rewriteFrontmatterName adds name field when frontmatter exists but lacks name", () => {
  const input = "---\ndescription: no name field\nlicense: MIT\n---\n\nbody";
  const out = rewriteFrontmatterName(input, "freshly-named");
  assert.ok(out.includes("name: freshly-named"));
  assert.ok(out.includes("description: no name field"));
  assert.ok(out.includes("license: MIT"));
  assert.ok(out.includes("body"));
});

test("SK-3 rewriteFrontmatterName preserves body text after frontmatter unchanged", () => {
  const body = "\n\n# Heading\n\nParagraph 1\n\n```\ncode block\n```\n\nMore text.\n";
  const input = "---\nname: original\n---" + body;
  const out = rewriteFrontmatterName(input, "renamed");
  assert.ok(out.endsWith(body), "body text should follow frontmatter unchanged");
  assert.ok(out.includes("name: renamed"));
});

test("SK-3 rewriteFrontmatterName handles malformed frontmatter (--- with no closing ---)", () => {
  const input = "---\nname: stuck\nno closing fence here\nstill no closing";
  const out = rewriteFrontmatterName(input, "rescued");
  // Behavior: treat as malformed and prepend a fresh frontmatter block.
  assert.match(out, /^---\nname: rescued\n---\n\n/);
});

test("SKILL-03 folded multi-line source name is rewritten to the generated name (no orphaned continuation lines)", () => {
  // A `>` folded `name:` scalar spanning several source lines. A blind
  // `^name:` line replace would leave the continuation lines orphaned and
  // corrupt the parsed name (e.g. `renamed folded name`).
  const input = "---\nname: >\n  folded\n  name\ndescription: kept\nversion: 9\n---\n\nbody text";
  const out = rewriteFrontmatterName(input, "acme-folded");

  const { frontmatter } = parseFrontmatter<{
    name: string;
    description: string;
    version: number;
  }>(out);
  // The re-parsed name is EXACTLY the generated name -- no `acme-folded folded name`.
  assert.equal(frontmatter.name, "acme-folded");
  // Sibling keys survive the full-node-span replacement.
  assert.equal(frontmatter.description, "kept");
  assert.equal(frontmatter.version, 9);
  // The orphaned continuation prose is gone.
  assert.ok(!out.includes("  folded"), "folded continuation line must be removed");
  assert.ok(out.includes("body text"));
});

test("WR-01: multi-line PLAIN source name is rewritten to the generated name (no orphaned continuation lines)", () => {
  // A valid multi-line PLAIN `name:` scalar (indented continuation). The inline
  // value does not start with `>`/`|`, so a block-scalar-only span detector
  // would orphan `  continued`, folding it into the parsed name and tripping the
  // SKILL-03 verify -- hard-failing an otherwise-valid skill install.
  const input = "---\nname: my\n  continued\ndescription: kept\nversion: 7\n---\n\nbody text";
  const out = rewriteFrontmatterName(input, "acme-plain");

  const { frontmatter } = parseFrontmatter<{
    name: string;
    description: string;
    version: number;
  }>(out);
  assert.equal(frontmatter.name, "acme-plain");
  assert.equal(frontmatter.description, "kept");
  assert.equal(frontmatter.version, 7);
  assert.ok(!out.includes("  continued"), "plain continuation line must be removed");
  assert.ok(out.includes("body text"));
});

test("WR-01: multi-line DOUBLE-QUOTED source name is rewritten to the generated name", () => {
  const input = '---\nname: "my\n  quoted name"\ndescription: kept\n---\n\nbody text';
  const out = rewriteFrontmatterName(input, "acme-quoted");

  const { frontmatter } = parseFrontmatter<{ name: string; description: string }>(out);
  assert.equal(frontmatter.name, "acme-quoted");
  assert.equal(frontmatter.description, "kept");
  assert.ok(!out.includes("  quoted name"), "quoted continuation line must be removed");
});

test("SKILL-03 absent source name is inserted as the generated name", () => {
  const input = "---\ndescription: only a description\nlicense: MIT\n---\n\nbody";
  const out = rewriteFrontmatterName(input, "acme-added");

  const { frontmatter } = parseFrontmatter<{
    name: string;
    description: string;
    license: string;
  }>(out);
  assert.equal(frontmatter.name, "acme-added");
  assert.equal(frontmatter.description, "only a description");
  assert.equal(frontmatter.license, "MIT");
});

test("SK-3 rewriteFrontmatterName tolerates an exotic close delimiter (`---x`), rewriting the name across the full block", () => {
  // The opening `---` is closed by a `\n---x` prefix (which Pi's parser accepts as
  // the close) rather than a bare `---` line -- this exercises the block-end scan
  // falling through to EOF instead of matching a `trim() === "---"` line.
  const input = "---\nname: old\n---x\nbody text";
  const out = rewriteFrontmatterName(input, "acme-gen");
  const { frontmatter } = parseFrontmatter<{ name: string }>(out);
  assert.equal(frontmatter.name, "acme-gen");
  assert.ok(out.includes("body text"));
  assert.ok(!out.includes("name: old"));
});

import assert from "node:assert/strict";
import test from "node:test";

import { rewriteFrontmatterName } from "../../../extensions/claude-marketplace/bridges/skills/rewrite-frontmatter.ts";

// SK-3: rewriteFrontmatterName carry-forward (V1 algorithm verbatim).

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

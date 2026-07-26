import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  firstBodyParagraph,
  foldWhenToUse,
  setDescriptionScalar,
  synthesizeUnparseableSkill,
  truncate1536,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts";
import { parseFrontmatter } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

// Resolve fixture root relative to THIS file (worktree-safe; do NOT use cwd).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "..", "_fixtures");

function readFixture(dir: string): Promise<string> {
  return readFile(path.join(FIXTURES, dir, "SKILL.md"), "utf8");
}

// ---------------------------------------------------------------------------
// SKILL-01: synthesizeUnparseableSkill
// ---------------------------------------------------------------------------

test("SKILL-01: synthesizeUnparseableSkill emits a disable-model-invocation block with the generated name and the body verbatim", () => {
  const body = "# Real Body\n\nThe original markdown, preserved verbatim.\n";
  const out = synthesizeUnparseableSkill(body, "acme-helper");

  // The synthesized block re-parses cleanly via Pi's own parser.
  const { frontmatter, body: parsedBody } = parseFrontmatter<{
    name: string;
    description: string;
    "disable-model-invocation": boolean;
  }>(out);
  assert.equal(frontmatter.name, "acme-helper");
  assert.equal(typeof frontmatter.description, "string");
  assert.ok(frontmatter.description.length > 0, "placeholder description must be non-empty");
  assert.equal(frontmatter["disable-model-invocation"], true);

  // Body is preserved verbatim (the parser trims, so compare against trimmed).
  assert.equal(parsedBody, body.trim());
  // The raw output carries the body bytes unchanged after the closing delimiter.
  assert.ok(out.endsWith(body), "body must be appended verbatim");
});

// ---------------------------------------------------------------------------
// SKILL-02 / D-86-06: firstBodyParagraph
// ---------------------------------------------------------------------------

test("SKILL-02 / D-86-06: firstBodyParagraph skips blank lines, ATX headings, and fenced code blocks, then returns the first prose paragraph", async () => {
  const { body } = parseFrontmatter(await readFixture("skill-heading-codeblock-body"));
  const para = firstBodyParagraph(body);
  assert.equal(
    para,
    "The first genuine prose paragraph after the heading and code block.\nSecond line of that same paragraph.",
  );
});

test("SKILL-02 / D-86-06: firstBodyParagraph stops at the first blank line (does not run into a later paragraph)", async () => {
  const { body } = parseFrontmatter(await readFixture("skill-no-description"));
  const para = firstBodyParagraph(body);
  assert.equal(
    para,
    "This is the first real body paragraph that the fallback should pick up.\nIt continues on a second line of the same paragraph.",
  );
  assert.ok(!para.includes("later paragraph"), "must not capture a later paragraph");
});

test("SKILL-02: firstBodyParagraph returns empty string for a body with no prose", () => {
  assert.equal(firstBodyParagraph(""), "");
  assert.equal(firstBodyParagraph("\n\n   \n"), "");
  assert.equal(firstBodyParagraph("# Only a heading\n\n## Another heading\n"), "");
  assert.equal(firstBodyParagraph("```\nonly a fence\n```\n"), "");
});

// ---------------------------------------------------------------------------
// WTU-01: foldWhenToUse
// ---------------------------------------------------------------------------

test("WTU-01: foldWhenToUse with an empty or absent when_to_use returns the description unchanged (no trailing separator)", () => {
  assert.equal(foldWhenToUse("a description", ""), "a description");
  assert.equal(foldWhenToUse("a description", undefined), "a description");
  // No trailing newline introduced.
  assert.ok(!foldWhenToUse("a description", "").endsWith("\n"));
});

test("WTU-01 (A1): foldWhenToUse joins description and when_to_use with a single \\n separator", () => {
  assert.equal(foldWhenToUse("desc", "use when X"), "desc\nuse when X");
});

test("WTU-01: foldWhenToUse operates on JS string .length (UTF-16 code units) with no byte reinterpretation", () => {
  // A non-BMP emoji is two UTF-16 code units; the fold must not reinterpret it.
  const desc = "d\u{1F600}"; // "d" + emoji
  const wtu = "w";
  const folded = foldWhenToUse(desc, wtu);
  assert.equal(folded, `${desc}\n${wtu}`);
  assert.equal(folded.length, desc.length + 1 + wtu.length);
});

// ---------------------------------------------------------------------------
// WTU-02 (A2): truncate1536
// ---------------------------------------------------------------------------

test("WTU-02: truncate1536 leaves text of length <= 1536 unchanged", () => {
  const at1535 = "a".repeat(1535);
  const at1536 = "a".repeat(1536);
  assert.equal(truncate1536(at1535), at1535);
  assert.equal(truncate1536(at1536), at1536);
  assert.equal(truncate1536(at1536).length, 1536);
});

test("WTU-02: truncate1536 hard-cuts a 1537-char string to exactly 1536 code units (no ellipsis)", () => {
  const at1537 = "b".repeat(1537);
  const cut = truncate1536(at1537);
  assert.equal(cut.length, 1536);
  assert.equal(cut, "b".repeat(1536));
  assert.ok(!cut.endsWith("..."), "no ellipsis on a hard cut");
});

test("WTU-02: truncate1536 measures 1536 in UTF-16 code units", () => {
  // 768 non-BMP emoji = 1536 UTF-16 code units exactly -> unchanged.
  const exactly1536 = "\u{1F600}".repeat(768);
  assert.equal(exactly1536.length, 1536);
  assert.equal(truncate1536(exactly1536), exactly1536);
  // One more emoji pushes to 1538 code units -> cut at 1536.
  const over = "\u{1F600}".repeat(769);
  assert.equal(truncate1536(over).length, 1536);
});

test("WTU-02: truncate1536 on empty combined text returns empty without crashing", () => {
  assert.equal(truncate1536(""), "");
});

// ---------------------------------------------------------------------------
// SKILL-03 class: setDescriptionScalar (full node-span replacement)
// ---------------------------------------------------------------------------

test("SKILL-03: setDescriptionScalar replaces a `>-` block-scalar description with a single safe scalar and leaves sibling keys unchanged", async () => {
  const source = await readFixture("skill-block-scalar-description");
  const out = setDescriptionScalar(source, "A single-line replacement description.");

  const { frontmatter } = parseFrontmatter<{
    name: string;
    description: string;
    version: string;
    tags: string;
  }>(out);
  assert.equal(frontmatter.description, "A single-line replacement description.");
  // Sibling keys survive the node-span replacement intact.
  assert.equal(frontmatter.name, "block-desc");
  assert.equal(frontmatter.version, "2.3.1");
  assert.equal(frontmatter.tags, "alpha, beta");

  // The multi-line block-scalar continuation lines are gone (no orphaned prose).
  assert.ok(!out.includes("spans several source lines"), "old scalar body must be removed");
});

test("SKILL-03: setDescriptionScalar replaces an inline description without touching siblings", () => {
  const source = "---\nname: inline\ndescription: old inline value\nversion: 9.9.9\n---\n\nBody.\n";
  const out = setDescriptionScalar(source, "new value");
  const { frontmatter } = parseFrontmatter<{ name: string; description: string; version: string }>(
    out,
  );
  assert.equal(frontmatter.description, "new value");
  assert.equal(frontmatter.name, "inline");
  assert.equal(frontmatter.version, "9.9.9");
});

test("SKILL-03 (AG-8 class): setDescriptionScalar emits an author value as a safe double-quoted scalar that cannot re-form a new YAML key", () => {
  const source = "---\nname: safe\ndescription: placeholder\n---\n\nBody.\n";
  // A value containing a colon+newline that, emitted naively, would re-form a
  // sibling key. The safe emitter must collapse the newline and quote it.
  const hostile = "evil: value\nmalicious-key: injected";
  const out = setDescriptionScalar(source, hostile);
  const { frontmatter } = parseFrontmatter<Record<string, unknown>>(out);
  assert.equal(frontmatter.description, "evil: value malicious-key: injected");
  assert.equal(frontmatter["malicious-key"], undefined, "no injected sibling key");
  assert.equal(frontmatter.name, "safe");
});

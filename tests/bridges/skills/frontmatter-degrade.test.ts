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

test("SKILL-02: firstBodyParagraph skips a ~~~ (tilde) fenced block and returns the first prose after it", () => {
  const body = "~~~\ncode in a tilde fence\n~~~\n\nReal prose here.\n";
  assert.equal(firstBodyParagraph(body), "Real prose here.");
});

test("SKILL-02: firstBodyParagraph returns empty when an unterminated fence swallows the rest of the body", () => {
  const body = "```\nnever closed\nstill inside the fence\n";
  assert.equal(firstBodyParagraph(body), "");
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

test("WTU-01: foldWhenToUse with an empty description and a non-empty when_to_use yields a leading-\\n join", () => {
  assert.equal(foldWhenToUse("", "use when X"), "\nuse when X");
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

test("WTU-02: truncate1536 cutting through a surrogate pair yields exactly 1536 code units", () => {
  // 1535 BMP chars + one astral char (U+1F600 = 2 code units at indices 1535,1536).
  // The 1536-code-unit hard cut keeps index 1535 (the HIGH surrogate) and drops its
  // LOW half -- a lone surrogate, length exactly 1536, no throw.
  const text = "a".repeat(1535) + "\u{1F600}";
  assert.equal(text.length, 1537);
  const cut = truncate1536(text);
  assert.equal(cut.length, 1536);
  const lastUnit = cut.charCodeAt(1535);
  assert.ok(lastUnit >= 0xd800 && lastUnit <= 0xdbff, "trailing unit is a lone high surrogate");
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
  const { frontmatter } = parseFrontmatter(out);
  assert.equal(frontmatter.description, "evil: value malicious-key: injected");
  assert.equal(frontmatter["malicious-key"], undefined, "no injected sibling key");
  assert.equal(frontmatter.name, "safe");
});

test("SKILL-03 (AG-8 class): setDescriptionScalar escapes embedded quotes and backslashes so the value round-trips through parseFrontmatter", () => {
  const source = "---\nname: safe\ndescription: placeholder\nversion: 1\n---\n\nBody.\n";
  // The two characters emitSafeDoubleQuotedScalar exists to escape: a literal
  // double-quote, a literal backslash (e.g. a Windows path), and the pre-formed
  // `\"` sequence -- the last proves backslash is escaped BEFORE quote (so the
  // author `"` is not double-processed). Each must decode back byte-identically.
  for (const value of ['He said "hi" to me', "a path\\to\\thing", 'mix \\" of both']) {
    const out = setDescriptionScalar(source, value);
    const { frontmatter } = parseFrontmatter<{
      name: string;
      description: string;
      version: number;
    }>(out);
    assert.equal(frontmatter.description, value);
    // No injected sibling key and existing siblings intact.
    assert.equal(frontmatter.name, "safe");
    assert.equal(frontmatter.version, 1);
  }
});

test("CR-01: setDescriptionScalar replaces a multi-line PLAIN scalar description spanning its full node (no orphaned continuation lines)", () => {
  // A valid, gate-1-parseable source whose `description` is a multi-line PLAIN
  // scalar (indented continuation). Augmentation fires (folded when_to_use), so
  // the description value changes. A lone `description:` line replace would
  // orphan `  plain scalar that wraps`, producing invalid YAML that gate-2
  // rejects and that hard-fails an otherwise-valid install.
  const source =
    "---\nname: my-skill\ndescription: This is a fairly long\n  plain scalar that wraps\n" +
    "when_to_use: Use for X\n---\n\nBody.\n";
  const out = setDescriptionScalar(
    source,
    "This is a fairly long plain scalar that wraps\nUse for X",
  );

  // Gate-2: the staged bytes re-parse cleanly (no throw on orphaned lines).
  assert.doesNotThrow(() => parseFrontmatter(out));

  const { frontmatter } = parseFrontmatter<{
    name: string;
    description: string;
    when_to_use: string;
  }>(out);
  // The folded description is emitted as a single safe scalar (newline collapsed).
  assert.equal(frontmatter.description, "This is a fairly long plain scalar that wraps Use for X");
  // Sibling keys survive intact.
  assert.equal(frontmatter.name, "my-skill");
  assert.equal(frontmatter.when_to_use, "Use for X");
  // The plain-scalar continuation line is gone (no orphaned prose).
  assert.ok(!out.includes("  plain scalar that wraps"), "continuation line must be removed");
});

test("CR-01: setDescriptionScalar replaces a multi-line DOUBLE-QUOTED scalar description spanning its full node", () => {
  // A multi-line double-quoted `description` scalar. Same defect class as the
  // plain-scalar case: the inline value starts with `"` (not `>`/`|`), so a
  // block-scalar-only span detector would orphan the continuation line.
  const source =
    '---\nname: quoted-skill\ndescription: "This is a fairly long\n  quoted scalar that wraps"\n' +
    "version: 1.2.3\n---\n\nBody.\n";
  const out = setDescriptionScalar(source, "A single-line replacement.");

  assert.doesNotThrow(() => parseFrontmatter(out));

  const { frontmatter } = parseFrontmatter<{
    name: string;
    description: string;
    version: string;
  }>(out);
  assert.equal(frontmatter.description, "A single-line replacement.");
  assert.equal(frontmatter.name, "quoted-skill");
  assert.equal(frontmatter.version, "1.2.3");
  assert.ok(!out.includes("  quoted scalar that wraps"), "continuation line must be removed");
});

test("setDescriptionScalar returns content unchanged when there is no opening `---` fence", () => {
  const content = "no frontmatter here\n\nbody paragraph.\n";
  assert.equal(setDescriptionScalar(content, "ignored"), content);
});

test("setDescriptionScalar replaces the description when the block has no closing `---` (block-end falls back to EOF)", () => {
  const content = "---\ndescription: old value\nname: acme-skill";
  const out = setDescriptionScalar(content, "new value");
  assert.match(out, /^---\ndescription: "new value"\n/);
  assert.ok(!out.includes("old value"), "old description must be replaced");
  assert.ok(out.includes("name: acme-skill"), "sibling key survives");
});

test("setDescriptionScalar spans a description value interrupted by a blank line (blank continuation skipped)", () => {
  const content = "---\ndescription: old\n\n  wrapped continuation\nname: acme-skill\n---\nbody.\n";
  const out = setDescriptionScalar(content, "single line");
  assert.match(out, /description: "single line"/);
  assert.ok(!out.includes("wrapped continuation"), "the absorbed continuation line is removed");
  assert.ok(out.includes("name: acme-skill"), "the first column-0 sibling key survives");
});

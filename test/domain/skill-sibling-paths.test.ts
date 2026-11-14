import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { rewriteSiblingSkillPaths } from "../../extensions/pi-claude-marketplace/domain/skill-sibling-paths.ts";

import type { SiblingSkillPathInput } from "../../extensions/pi-claude-marketplace/domain/skill-sibling-paths.ts";

const skillsDir = path.resolve("/plugin/skills");
const skillA = path.join(skillsDir, "a");
const skillB = path.join(skillsDir, "b");

/** The input of a file of skill `a` in `subfolders` of the skill, beside staged `a` and `b`. */
function fileOfSkillA(...subfolders: string[]): SiblingSkillPathInput {
  return {
    fileSourceDir: path.join(skillA, ...subfolders),
    skillSourceDir: skillA,
    siblingSkills: new Map([
      [skillA, "acme-a"],
      [skillB, "acme-b"],
    ]),
  };
}

test("rewrites a link from SKILL.md to a file of a sibling skill", () => {
  // arrange
  const content = "See ../b/ref.md\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA());

  // assert
  assert.strictEqual(rewritten, "See ../acme-b/ref.md\n");
});

test("changes the path inside a code span and nothing after it", () => {
  // arrange
  const content = "See `../b/ref.md`.\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA());

  // assert
  assert.strictEqual(rewritten, "See `../acme-b/ref.md`.\n");
});

test("keeps the trailing slash of a bare sibling folder", () => {
  // arrange
  const content = "- `../b/` - progressive disclosure\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA());

  // assert
  assert.strictEqual(rewritten, "- `../acme-b/` - progressive disclosure\n");
});

test("keeps the period after a bare sibling folder that ends a sentence outside the path", () => {
  // arrange
  const content = "Read ../b.\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA());

  // assert
  assert.strictEqual(rewritten, "Read ../acme-b.\n");
});

test("climbs one more folder from a file one folder deep in its skill", () => {
  // arrange
  const content = "Deep link ../../b/ref.md here.\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA("references"));

  // assert
  assert.strictEqual(rewritten, "Deep link ../../acme-b/ref.md here.\n");
});

test("climbs three folders from a file two folders deep, joined by slashes", () => {
  // arrange
  const content = "Deeper link ../../../b/ref.md here.\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA("references", "deep"));

  // assert
  assert.strictEqual(rewritten, "Deeper link ../../../acme-b/ref.md here.\n");
});

test("resolves a skill directory variable path from the skill folder and keeps the variable", () => {
  // arrange
  const content = "Load ${CLAUDE_SKILL_DIR}/../b/x.md first.\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA("references", "deep"));

  // assert
  assert.strictEqual(rewritten, "Load ${CLAUDE_SKILL_DIR}/../acme-b/x.md first.\n");
});

test("rewrites a path that reaches the sibling through its parent folders", () => {
  // arrange
  const content = "See ../../skills/b/x.md\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA());

  // assert
  assert.strictEqual(rewritten, "See ../acme-b/x.md\n");
});

test("leaves a path into the own skill of SKILL.md as written", () => {
  // arrange
  const content = "See ../a/x.md\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA());

  // assert
  assert.strictEqual(rewritten, content);
});

test("leaves a path from a subfolder to its own SKILL.md as written", () => {
  // arrange
  const content = "Back to ../SKILL.md\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA("references"));

  // assert
  assert.strictEqual(rewritten, content);
});

test("leaves a path outside every skill as written", () => {
  // arrange
  const content = "See ../../docs/x.md\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA());

  // assert
  assert.strictEqual(rewritten, content);
});

test("leaves a path to a sibling folder that did not stage as written", () => {
  // arrange
  const content = "See ../c/x.md\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA());

  // assert
  assert.strictEqual(rewritten, content);
});

test("leaves a parent run that follows a slash, a dot, or a word character as written", () => {
  // arrange
  const content =
    "${CLAUDE_PLUGIN_ROOT}/skills/a/../b/x.md and lib/../b/x.md and .../b/x.md and x../b/x.md\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA());

  // assert
  assert.strictEqual(rewritten, content);
});

test("leaves a path that continues with a parent segment after the sibling folder as written", () => {
  // arrange
  const content = "See ../b/../../docs/x.md and ../b/./x.md\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA());

  // assert
  assert.strictEqual(rewritten, content);
});

test("rewrites every path on a line and on each line, in links, code spans, text, and fenced code", () => {
  // arrange
  const content =
    "[ref](../b/ref.md) and `../b/` and ../b/x.md\n" +
    "| `../b/SKILL.md` | ../c/x.md |\n" +
    "```text\ncat ../b/run.sh\n```\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA());

  // assert
  assert.strictEqual(
    rewritten,
    "[ref](../acme-b/ref.md) and `../acme-b/` and ../acme-b/x.md\n" +
      "| `../acme-b/SKILL.md` | ../c/x.md |\n" +
      "```text\ncat ../acme-b/run.sh\n```\n",
  );
});

test("keeps a name segment whose dots sit between name characters", () => {
  // arrange
  const content = "Open ../b/v1.2/notes.md, then stop.\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA());

  // assert
  assert.strictEqual(rewritten, "Open ../acme-b/v1.2/notes.md, then stop.\n");
});

test("returns empty content unchanged", () => {
  // act
  const rewritten = rewriteSiblingSkillPaths("", fileOfSkillA());

  // assert
  assert.strictEqual(rewritten, "");
});

test("returns content unchanged when no sibling staged", () => {
  // arrange
  const content = "See ../b/ref.md\n";

  // act
  const rewritten = rewriteSiblingSkillPaths(content, {
    fileSourceDir: skillA,
    skillSourceDir: skillA,
    siblingSkills: new Map(),
  });

  // assert
  assert.strictEqual(rewritten, content);
});

test("returns a line of 100,000 parent segments unchanged", { timeout: 2000 }, () => {
  // arrange
  const content = "../".repeat(100_000);

  // act
  const rewritten = rewriteSiblingSkillPaths(content, fileOfSkillA());

  // assert
  assert.strictEqual(rewritten, content);
});

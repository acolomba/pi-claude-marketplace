import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { REASONS } from "../../extensions/pi-claude-marketplace/shared/grammar/reasons.ts";
import { STATUS_TOKENS } from "../../extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const STYLE_GUIDE_PATH = path.join(REPO_ROOT, "docs/messaging-style-guide.md");

/**
 * D-CMC-04 / CMC-08 / CMC-11 -- closed-set grammar drift guard.
 *
 * The constants in `shared/grammar/status-tokens.ts` and
 * `shared/grammar/reasons.ts` are downstream of the binding frontmatter at
 * `docs/messaging-style-guide.md`. This test reads the frontmatter at the
 * file head, pulls the `status_tokens:` and `reasons:` bullet lists, and
 * asserts set-equality against the in-code constants. If either side drifts,
 * CI fails -- the frontmatter is the binding contract and the constants must
 * follow.
 *
 * D-CMC-04 keeps the YAML extractor LOCAL to this test in Phase 12. Phase 14
 * owns the richer reader (which will also need `markers:` and
 * `pattern_classes:` lists); over-extracting now would force a redesign when
 * the broader drift guard lands. The extractor here is intentionally minimal:
 * a two-stage regex against the known-shape frontmatter, following the
 * precedent set by `tests/helpers/prd-extract.ts` (which also hand-rolls a
 * regex extractor for the PRD §6.12 ES-5 row).
 *
 * No `yaml` / `js-yaml` dependency is introduced. Adopting a YAML parser for
 * one test file would be over-extraction; the frontmatter shape is fixed at
 * the project level and the regex is linear-time on bounded input.
 */
function extractFrontmatterList(md: string, key: string): string[] {
  const frontmatterMatch = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (frontmatterMatch === null) {
    throw new Error("messaging-style-guide.md: no YAML frontmatter found at file head");
  }

  const frontmatter = frontmatterMatch[1]!;

  const keyBlockRe = new RegExp(`^${key}:\\n((?:  - .+\\n)+)`, "m");
  const keyBlockMatch = keyBlockRe.exec(frontmatter);
  if (keyBlockMatch === null) {
    throw new Error(`messaging-style-guide.md frontmatter: key "${key}" not found`);
  }

  const items = keyBlockMatch[1]!
    .split("\n")
    .filter((line) => line.startsWith("  - "))
    .map((line) => line.slice("  - ".length));

  if (items.length === 0) {
    throw new Error(`messaging-style-guide.md frontmatter: key "${key}" has no items`);
  }

  return items;
}

test("D-CMC-04: STATUS_TOKENS is set-equal to style-guide frontmatter status_tokens", async () => {
  const md = await readFile(STYLE_GUIDE_PATH, "utf8");
  const frontmatterTokens = extractFrontmatterList(md, "status_tokens");

  assert.deepEqual(
    [...STATUS_TOKENS].sort(),
    [...frontmatterTokens].sort(),
    `STATUS_TOKENS drift vs frontmatter -- code has ${STATUS_TOKENS.length}, frontmatter has ${frontmatterTokens.length}`,
  );
});

test("D-CMC-04: REASONS is set-equal to style-guide frontmatter reasons", async () => {
  const md = await readFile(STYLE_GUIDE_PATH, "utf8");
  const frontmatterReasons = extractFrontmatterList(md, "reasons");

  assert.deepEqual(
    [...REASONS].sort(),
    [...frontmatterReasons].sort(),
    `REASONS drift vs frontmatter -- code has ${REASONS.length}, frontmatter has ${frontmatterReasons.length}`,
  );
});

test("extractFrontmatterList throws if frontmatter is missing", () => {
  assert.throws(
    () => extractFrontmatterList("# No frontmatter here\n", "status_tokens"),
    /no YAML frontmatter found/,
  );
});

test("extractFrontmatterList throws if key is missing", () => {
  assert.throws(
    () => extractFrontmatterList("---\nversion: 1.0\nother:\n  - a\n---\n", "status_tokens"),
    /key "status_tokens" not found/,
  );
});

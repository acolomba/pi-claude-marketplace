import assert from "node:assert/strict";
import test from "node:test";

import { MARKERS } from "../../extensions/pi-claude-marketplace/shared/grammar/markers.ts";
import { PATTERN_CLASSES } from "../../extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts";
import { REASONS } from "../../extensions/pi-claude-marketplace/shared/grammar/reasons.ts";
import { STATUS_TOKENS } from "../../extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts";
import {
  MARKERS_FRONTMATTER,
  parseStyleGuideFrontmatter,
  PATTERN_CLASSES_FRONTMATTER,
  REASONS_FRONTMATTER,
  STATUS_TOKENS_FRONTMATTER,
} from "../lint-rules/lib/frontmatter.js";

/**
 * D-CMC-04 / D-14-10 / D-14-10b -- closed-set grammar drift guard.
 *
 * The constants in `shared/grammar/{status-tokens,reasons,markers,pattern-classes}.ts`
 * are downstream of the binding frontmatter at
 * `docs/messaging-style-guide.md`. This test imports the four frozen
 * `string[]` named exports from the shared memoized loader at
 * `tests/lint-rules/lib/frontmatter.js` (D-14-10: the loader uses
 * `yaml.parse()` against the frontmatter block, supersedes the Phase 12
 * hand-rolled `extractFrontmatterList` regex extractor) and asserts
 * set-equality against the in-code constants for ALL FOUR closed sets. If
 * either side drifts on any of the four sets, CI fails -- the frontmatter
 * is the binding contract and the in-code constants must follow.
 *
 * Phase 12 D-CMC-04 deferred the richer YAML reader ("Phase 14 owns it")
 * to here; the loader satisfies that deferral and the 4-key extension
 * (status_tokens + reasons + markers + pattern_classes) honors D-14-10b's
 * derived literal-union expansion. The Phase 12 negative tests
 * (`extractFrontmatterList throws if frontmatter is missing` / `... key
 * is missing`) carry forward as `parseStyleGuideFrontmatter`-level tests
 * since the loader's module-load-time read can no longer be re-invoked
 * with bad input.
 *
 * Adding a new entry to any of the four frontmatter keys requires zero
 * test-code changes (SC #3 in the Phase 14 ROADMAP). The MSG-* rules in
 * Plans 14-04 / 14-05 consume the same loader exports.
 */

test("D-CMC-04 / D-14-10 / CMC-38: STATUS_TOKENS is set-equal to style-guide frontmatter status_tokens", () => {
  assert.deepEqual(
    [...STATUS_TOKENS].sort(),
    [...STATUS_TOKENS_FRONTMATTER].sort(),
    `STATUS_TOKENS drift vs frontmatter -- code has ${STATUS_TOKENS.length}, frontmatter has ${STATUS_TOKENS_FRONTMATTER.length}`,
  );
});

test("D-CMC-04 / D-14-10 / CMC-38: REASONS is set-equal to style-guide frontmatter reasons", () => {
  assert.deepEqual(
    [...REASONS].sort(),
    [...REASONS_FRONTMATTER].sort(),
    `REASONS drift vs frontmatter -- code has ${REASONS.length}, frontmatter has ${REASONS_FRONTMATTER.length}`,
  );
});

test("D-14-10b / CMC-38: MARKERS is set-equal to style-guide frontmatter markers", () => {
  assert.deepEqual(
    [...MARKERS].sort(),
    [...MARKERS_FRONTMATTER].sort(),
    `MARKERS drift vs frontmatter -- code has ${MARKERS.length}, frontmatter has ${MARKERS_FRONTMATTER.length}`,
  );
});

test("D-14-10b / CMC-38: PATTERN_CLASSES is set-equal to style-guide frontmatter pattern_classes", () => {
  assert.deepEqual(
    [...PATTERN_CLASSES].sort(),
    [...PATTERN_CLASSES_FRONTMATTER].sort(),
    `PATTERN_CLASSES drift vs frontmatter -- code has ${PATTERN_CLASSES.length}, frontmatter has ${PATTERN_CLASSES_FRONTMATTER.length}`,
  );
});

test("parseStyleGuideFrontmatter throws if frontmatter is missing", () => {
  assert.throws(
    () => parseStyleGuideFrontmatter("# No frontmatter here\n"),
    /no YAML frontmatter found/,
  );
});

test("parseStyleGuideFrontmatter throws if a required key is missing or not a string[]", () => {
  assert.throws(
    () =>
      parseStyleGuideFrontmatter(
        "---\nversion: 1.0\nstatus_tokens:\n  - installed\nreasons:\n  - up-to-date\nmarkers:\n  - autoupdate\n---\n",
      ),
    /key "pattern_classes" missing or not a string\[\]/,
  );
});

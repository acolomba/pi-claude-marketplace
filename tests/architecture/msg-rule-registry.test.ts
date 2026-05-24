import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { RULE_NAMES } from "../lint-rules/index.js";

/**
 * D-14-12 (LOCKED body-scan registry parity) / CMC-38.
 *
 * Ties the four moving parts of the Phase 14 drift-guard suite
 * together:
 *
 *   1. `docs/messaging-style-guide.md` body -- the source of the
 *      canonical MSG-* ID set. The regex `/MSG-[A-Z]+-[0-9]+/g`
 *      finds every cited rule ID in sections 1 through 15
 *      (currently 34 unique IDs); adding a new MSG-* in v1.4 means
 *      editing the body and adding one rule file -- no test-code
 *      change (honors SC #3).
 *
 *   2. `tests/lint-rules/msg-*.js` rule files -- one per MSG-* ID,
 *      enumerated by the plugin's `RULE_NAMES` export.
 *
 *   3. `eslint.config.js` per-rule `"msg/<name>":` registrations --
 *      ties the plugin into the actual lint run. Plan 06 owns the
 *      wiring; until it lands assertion (c) is gated via `test.todo`
 *      per D-14-03 "every wave green" invariant + NFR-6 (no
 *      sanctioned RED commit -- Option A is forbidden).
 *
 *   4. `tests/lint-rules/index.js` plugin module -- the source of
 *      `RULE_NAMES`.
 *
 * Four assertions:
 *
 *   (a) Every style-guide MSG-* ID has a corresponding rule file
 *       (slug-prefix match in `RULE_NAMES`). ACTIVE at Plan 05.
 *
 *   (b) Every rule name in `RULE_NAMES` has a corresponding
 *       style-guide MSG-* anchor (back-reference). ACTIVE at Plan 05.
 *
 *   (c) Every rule name is registered in `eslint.config.js` via the
 *       literal `"msg/<name>":`. GATED behind a Plan-06 detection
 *       check -- skipped via `test.todo` until Plan 06 wires the
 *       plugin. Plan 06 Task 2 removes the gate by adding 34
 *       `"msg/<name>":` registrations + the corresponding acceptance
 *       criterion.
 *
 *   (d) Count parity: `RULE_NAMES.length === 34` AND the
 *       deduplicated styleGuideIds count `=== 34`. ACTIVE at Plan 05.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const STYLE_GUIDE_PATH = path.join(REPO_ROOT, "docs/messaging-style-guide.md");
const ESLINT_CONFIG_PATH = path.join(REPO_ROOT, "eslint.config.js");

const MSG_ID_RE = /MSG-[A-Z]+-[0-9]+/g;
const EXPECTED_RULE_COUNT = 34;

function extractMsgIdsFromStyleGuide(md: string): readonly string[] {
  const matches = md.match(MSG_ID_RE);
  if (matches === null) {
    throw new Error("messaging-style-guide.md: no MSG-* IDs found");
  }

  return Object.freeze([...new Set(matches)].sort());
}

function msgIdToFileSlug(msgId: string): string {
  // MSG-SR-7 -> "msg-sr-7-" (prefix; rule file names have a trailing
  // descriptive slug like "msg-sr-7-usage-error-routing").
  return msgId.toLowerCase() + "-";
}

function ruleNameToMsgId(name: string): string | null {
  // Inverse: "msg-sr-7-usage-error-routing" -> "MSG-SR-7".
  const m = /^msg-([a-z]+)-([0-9]+)-/.exec(name);
  if (m === null) {
    return null;
  }

  const family = m[1];
  const number = m[2];
  if (family === undefined || number === undefined) {
    return null;
  }

  return `MSG-${family.toUpperCase()}-${number}`;
}

test("D-14-12 / CMC-38: every MSG-* ID in the style guide has a corresponding rule file", async () => {
  const md = await readFile(STYLE_GUIDE_PATH, "utf8");
  const styleGuideIds = extractMsgIdsFromStyleGuide(md);

  const missing: string[] = [];
  for (const id of styleGuideIds) {
    const slug = msgIdToFileSlug(id);
    const found = RULE_NAMES.some((name) => name.startsWith(slug));
    if (!found) {
      missing.push(id);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `style-guide MSG-* IDs without a tests/lint-rules/msg-*.js rule file:\n  ${missing.join("\n  ")}`,
  );
});

test("D-14-12 / CMC-38: every rule name corresponds to a style-guide MSG-* anchor", async () => {
  const md = await readFile(STYLE_GUIDE_PATH, "utf8");
  const styleGuideIds = new Set(extractMsgIdsFromStyleGuide(md));

  const orphans: string[] = [];
  for (const name of RULE_NAMES) {
    const msgId = ruleNameToMsgId(name);
    if (msgId === null) {
      orphans.push(`${name} (could not parse MSG-* prefix)`);
      continue;
    }

    if (!styleGuideIds.has(msgId)) {
      orphans.push(`${name} -> ${msgId}`);
    }
  }

  assert.deepEqual(
    orphans,
    [],
    `rule files without a style-guide MSG-* anchor:\n  ${orphans.join("\n  ")}`,
  );
});

test("D-14-12 / CMC-38: every rule name is registered in eslint.config.js", async (t) => {
  // Gate detection per D-14-03: Plan 06 wiring lands by adding
  // `"msg/msg-...":` literals to eslint.config.js. Until then this
  // assertion is t.todo()'d -- the test reports as pending rather than
  // failing, keeping `npm run check` GREEN at the Plan 05 commit
  // (NFR-6; Option A "sanctioned RED commit" is forbidden).
  const eslintConfigText = await readFile(ESLINT_CONFIG_PATH, "utf8");
  if (!eslintConfigText.includes('"msg/msg-')) {
    t.todo(
      "pending: enabled by Plan 06 wiring (eslint.config.js must register 34 'msg/...' rule entries via the local plugin import)",
    );
    return;
  }

  const unregistered: string[] = [];
  for (const name of RULE_NAMES) {
    const registrationRe = new RegExp(`["']msg/${name}["']\\s*:`);
    if (!registrationRe.test(eslintConfigText)) {
      unregistered.push(name);
    }
  }

  assert.deepEqual(
    unregistered,
    [],
    `rules in tests/lint-rules/index.js without eslint.config.js registration:\n  ${unregistered.join("\n  ")}`,
  );
});

test(`D-14-12 / CMC-38: rule count is ${EXPECTED_RULE_COUNT} (matches style-guide MSG-* ID count)`, async () => {
  const md = await readFile(STYLE_GUIDE_PATH, "utf8");
  const styleGuideIds = extractMsgIdsFromStyleGuide(md);
  assert.equal(
    styleGuideIds.length,
    EXPECTED_RULE_COUNT,
    `expected ${EXPECTED_RULE_COUNT} MSG-* IDs in style guide; got ${styleGuideIds.length}`,
  );
  assert.equal(
    RULE_NAMES.length,
    EXPECTED_RULE_COUNT,
    `expected ${EXPECTED_RULE_COUNT} rules in tests/lint-rules/index.js; got ${RULE_NAMES.length}`,
  );
});

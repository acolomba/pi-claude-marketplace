import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as markers from "../../extensions/claude-marketplace/shared/markers.ts";
import { extractEs5MarkerLiterals } from "../helpers/prd-extract.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PRD_PATH = path.join(REPO_ROOT, "docs/prd/pi-claude-marketplace-prd.md");

/**
 * D-09 / ES-5 / AS-4 -- PRD §6.12 user-contract markers.
 *
 * The exported constants in `shared/markers.ts` must contain the STABLE
 * PREFIX of each PRD literal -- the part that's user contract -- without
 * the runtime-substituted suffix (`<verb>`, `<phase>`, `[...]`, `…`). The
 * test extracts the prefix from each PRD literal by stripping anything
 * from the first `<`, `[`, or `…` onward, then asserts byte-for-byte
 * equality with the exported constant.
 *
 * Note on `[`: the rollback partial literal embeds `[<phase>]` as a
 * runtime-substituted span. The brackets are part of the placeholder, not
 * part of the user-contract prefix, so they're stripped along with the
 * `<`-introduced placeholder.
 *
 * Per RESEARCH.md Open Question 2: a PRD edit that changes a placeholder
 * NAME (e.g., `<verb>` to `<action>`) does NOT change the user-visible
 * runtime string, so the prefix-stripping behavior is the desired
 * stability point.
 */
test("ES-5 markers in shared/markers.ts match PRD §6.12 byte-for-byte (D-09)", async () => {
  const prd = await readFile(PRD_PATH, "utf8");
  const literals = extractEs5MarkerLiterals(prd);

  assert.equal(
    literals.length,
    5,
    `Expected 5 backtick-quoted ES-5 markers in PRD §6.12, found ${literals.length}: ${JSON.stringify(literals)}`,
  );

  // The 5 expected (PRD literal, exported constant) pairs.
  const expected: ReadonlyArray<readonly [string, string]> = [
    ["pi-subagents is not loaded; …", markers.PI_SUBAGENTS_NOT_LOADED],
    ["pi-mcp-adapter is not loaded; …", markers.PI_MCP_ADAPTER_NOT_LOADED],
    ["Run /reload to <verb> …", markers.RELOAD_HINT_PREFIX],
    ["MANUAL RECOVERY REQUIRED: …", markers.MANUAL_RECOVERY_REQUIRED],
    ["(rollback partial: [<phase>] <msg>; …)", markers.ROLLBACK_PARTIAL],
  ];

  for (const [prdLiteral, exportedConstant] of expected) {
    assert.ok(
      literals.includes(prdLiteral),
      `Expected PRD literal ${JSON.stringify(prdLiteral)} not found in PRD §6.12 row. PRD literals were: ${JSON.stringify(literals)}`,
    );
    // Stable prefix = everything up to (but not including) the first `<`,
    // `[`, or `…`. (The `[` covers `[<phase>]`-style placeholders.)
    const expectedPrefix = prdLiteral.replace(/[<[…].*$/, "");
    assert.equal(
      exportedConstant,
      expectedPrefix,
      `shared/markers.ts export ${JSON.stringify(exportedConstant)} does not match PRD prefix ${JSON.stringify(expectedPrefix)}`,
    );
  }
});

test("extractEs5MarkerLiterals throws if PRD §6.12 ES-5 row is missing", () => {
  assert.throws(
    () => extractEs5MarkerLiterals("# Something\n\nNo ES-5 here.\n"),
    /ES-5 row not found/,
  );
});

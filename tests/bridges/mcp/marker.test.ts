import assert from "node:assert/strict";
import test from "node:test";

import {
  CLAUDE_MARKETPLACE_MARKER_KEY,
  buildMarker,
  isOwnedBy,
  readMarker,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/marker.ts";

// MC-5 -- per-server `_piClaudeMarketplace` marker shape and ownership.

test("MC-5 CLAUDE_MARKETPLACE_MARKER_KEY === '_piClaudeMarketplace' (user contract snapshot)", () => {
  // This is byte-for-byte user contract -- a V1 mcp.json must remain
  // readable by the successor. Snapshot the literal.
  assert.equal(CLAUDE_MARKETPLACE_MARKER_KEY, "_piClaudeMarketplace");
});

test("MC-5 readMarker returns null for non-object input", () => {
  assert.equal(readMarker(null), null);
  assert.equal(readMarker(undefined), null);
  assert.equal(readMarker("string"), null);
  assert.equal(readMarker(42), null);
  assert.equal(readMarker(true), null);
  assert.equal(readMarker([]), null);
});

test("MC-5 readMarker returns null when marker key absent", () => {
  assert.equal(readMarker({}), null);
  assert.equal(readMarker({ command: "x", args: [] }), null);
});

test("MC-5 readMarker returns parsed marker when valid", () => {
  const m = readMarker({
    command: "node",
    [CLAUDE_MARKETPLACE_MARKER_KEY]: { plugin: "acme", marketplace: "official" },
  });
  assert.deepEqual(m, { plugin: "acme", marketplace: "official" });
});

test("MC-5 readMarker returns null when marker has missing plugin or marketplace", () => {
  assert.equal(
    readMarker({ [CLAUDE_MARKETPLACE_MARKER_KEY]: { plugin: "acme" } }),
    null,
    "missing marketplace -> null",
  );
  assert.equal(
    readMarker({ [CLAUDE_MARKETPLACE_MARKER_KEY]: { marketplace: "official" } }),
    null,
    "missing plugin -> null",
  );
  assert.equal(
    readMarker({ [CLAUDE_MARKETPLACE_MARKER_KEY]: { plugin: 1, marketplace: "official" } }),
    null,
    "non-string plugin -> null",
  );
  assert.equal(
    readMarker({ [CLAUDE_MARKETPLACE_MARKER_KEY]: null }),
    null,
    "null marker subobject -> null",
  );
  assert.equal(
    readMarker({ [CLAUDE_MARKETPLACE_MARKER_KEY]: [] }),
    null,
    "array marker subobject -> null",
  );
});

test("MC-5 buildMarker returns { plugin, marketplace } untouched", () => {
  const m = buildMarker("acme", "official");
  assert.deepEqual(m, { plugin: "acme", marketplace: "official" });
});

test("MC-5 isOwnedBy returns true for matching tuple, false otherwise", () => {
  const value = {
    command: "node",
    [CLAUDE_MARKETPLACE_MARKER_KEY]: { plugin: "acme", marketplace: "official" },
  };
  assert.equal(isOwnedBy(value, "acme", "official"), true);
  assert.equal(isOwnedBy(value, "acme", "other"), false, "wrong marketplace -> false");
  assert.equal(isOwnedBy(value, "other", "official"), false, "wrong plugin -> false");
  assert.equal(isOwnedBy({}, "acme", "official"), false, "no marker -> false");
  assert.equal(isOwnedBy(null, "acme", "official"), false, "null value -> false");
});

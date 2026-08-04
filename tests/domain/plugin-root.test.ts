// tests/domain/plugin-root.test.ts
//
// Coverage suite for the `AbsolutePluginRoot` brand validator. The three
// throw arms (empty, null byte, not absolute) each pin one runtime
// invariant the brand exists to enforce; the happy path confirms the
// brand returns the input string unmodified.

import assert from "node:assert/strict";
import { delimiter } from "node:path";
import { test } from "node:test";

import { asAbsolutePluginRoot } from "../../extensions/pi-claude-marketplace/domain/plugin-root.ts";

test("asAbsolutePluginRoot: returns the branded string unchanged on a valid absolute path", () => {
  const branded = asAbsolutePluginRoot("/tmp/test-plugin");
  assert.equal(branded, "/tmp/test-plugin");
});

test("asAbsolutePluginRoot: accepts an absolute path with `..` segments because path.isAbsolute -> path.normalize collapses them", () => {
  // `/tmp/a/../b` is absolute and survives the validator -- the `..` is
  // a non-issue for absolute paths because no `..` segment can survive
  // `path.normalize` on an absolute input.
  const branded = asAbsolutePluginRoot("/tmp/a/../b");
  assert.equal(branded, "/tmp/a/../b");
});

test("asAbsolutePluginRoot: throws on the empty string", () => {
  assert.throws(() => asAbsolutePluginRoot(""), /empty string/);
});

test("asAbsolutePluginRoot: throws when the input contains a null byte", () => {
  assert.throws(() => asAbsolutePluginRoot("/tmp/test\0plugin"), /null byte/);
});

test("asAbsolutePluginRoot: throws on a relative path", () => {
  assert.throws(() => asAbsolutePluginRoot("relative/path"), /not absolute/);
});

test("asAbsolutePluginRoot: throws when the input contains the PATH delimiter", () => {
  // A delimiter-bearing root cannot round-trip the delimiter-joined
  // PI_CLAUDE_MARKETPLACE_PATH ledger, so it must be rejected before it can
  // enter the ledger and leak a stale fragment on cleanup.
  assert.throws(() => asAbsolutePluginRoot(`/tmp/a${delimiter}b`), /delimiter/);
});

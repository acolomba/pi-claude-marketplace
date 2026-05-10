import assert from "node:assert/strict";
import test from "node:test";

import {
  appendReloadHint,
  reloadHint,
} from "../../extensions/claude-marketplace/presentation/reload-hint.ts";
import { RELOAD_HINT_PREFIX } from "../../extensions/claude-marketplace/shared/markers.ts";

test("RH-1: empty names returns empty string (no reload hint emitted)", () => {
  assert.equal(reloadHint("load", []), "");
  assert.equal(reloadHint("refresh", []), "");
  assert.equal(reloadHint("drop", []), "");
});

test("RH-2: single name renders 'Run /reload to <verb> it.'", () => {
  assert.equal(reloadHint("load", ["foo"]), `${RELOAD_HINT_PREFIX}load it.`);
  assert.equal(reloadHint("refresh", ["bar"]), `${RELOAD_HINT_PREFIX}refresh it.`);
  assert.equal(reloadHint("drop", ["baz"]), `${RELOAD_HINT_PREFIX}drop it.`);
});

test('RH-2: multi name renders \'Run /reload to <verb> "n1", "n2".\' with quoted names', () => {
  assert.equal(reloadHint("load", ["alpha", "beta"]), `${RELOAD_HINT_PREFIX}load "alpha", "beta".`);
  assert.equal(
    reloadHint("drop", ["one", "two", "three"]),
    `${RELOAD_HINT_PREFIX}drop "one", "two", "three".`,
  );
});

test("RELOAD_HINT_PREFIX is byte-for-byte 'Run /reload to '", () => {
  // Anchor against PRD §6.12 ES-5: the markers-snapshot test verifies
  // this prefix matches the PRD literal. reloadHint just composes
  // around the same constant.
  assert.equal(RELOAD_HINT_PREFIX, "Run /reload to ");
});

test("appendReloadHint: empty hint returns bare body (RH-1 suppression)", () => {
  assert.equal(appendReloadHint("Body content", ""), "Body content");
});

test("appendReloadHint: non-empty hint joins with single newline", () => {
  assert.equal(
    appendReloadHint("Body content", "Run /reload to load it."),
    "Body content\nRun /reload to load it.",
  );
});

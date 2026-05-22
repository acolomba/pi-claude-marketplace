import assert from "node:assert/strict";
import test from "node:test";

import {
  appendReloadHint,
  reloadHint,
} from "../../extensions/pi-claude-marketplace/presentation/reload-hint.ts";

test("MSG-RH-1: empty names returns empty string (suppression)", () => {
  assert.equal(reloadHint([]), "");
});

test("MSG-RH-1: single name returns the canonical trailer", () => {
  assert.equal(reloadHint(["foo"]), "/reload to pick up changes");
});

test("MSG-RH-1: multi name returns the same canonical trailer (names ignored beyond non-empty check)", () => {
  assert.equal(reloadHint(["alpha", "beta", "gamma"]), "/reload to pick up changes");
});

test("appendReloadHint: empty hint returns bare body (suppression)", () => {
  assert.equal(appendReloadHint("Body content", ""), "Body content");
});

test("appendReloadHint: non-empty hint joins with single newline", () => {
  assert.equal(
    appendReloadHint("Body content", "/reload to pick up changes"),
    "Body content\n/reload to pick up changes",
  );
});

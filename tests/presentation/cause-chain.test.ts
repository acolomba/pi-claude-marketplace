// tests/presentation/cause-chain.test.ts
//
// CMC-18 / MSG-CC-1: depth-5 cause-chain walker with cycle detection,
// non-Error fallback, lowercase `cause:` prefix, ` -> ` joiner, and
// `(truncated)` suffix when the walk hits the depth bound mid-chain.
//
// Imports go through `presentation/cause-chain.ts` (the re-export) -- NOT
// `shared/errors.ts` -- so the D-11-preserving re-export is exercised.

import assert from "node:assert/strict";
import test from "node:test";

import { causeChainTrailer } from "../../extensions/pi-claude-marketplace/presentation/cause-chain.ts";

test("MSG-CC-1: undefined input returns empty string (suppression)", () => {
  assert.equal(causeChainTrailer(undefined), "");
});

test("MSG-CC-1: null input returns empty string (suppression)", () => {
  assert.equal(causeChainTrailer(null), "");
});

test("MSG-CC-1: depth-1 (root only, no .cause) returns `cause: <msg>`", () => {
  assert.equal(causeChainTrailer(new Error("root")), "cause: root");
});

test("MSG-CC-1: depth-2 chain returns `cause: a -> b`", () => {
  const err = new Error("a", { cause: new Error("b") });
  assert.equal(causeChainTrailer(err), "cause: a -> b");
});

test("MSG-CC-1: depth-3 chain returns `cause: a -> b -> c`", () => {
  const err = new Error("a", { cause: new Error("b", { cause: new Error("c") }) });
  assert.equal(causeChainTrailer(err), "cause: a -> b -> c");
});

test("MSG-CC-1: depth-5 chain returns all 5 links with NO truncated suffix", () => {
  const l5 = new Error("l5");
  const l4 = new Error("l4", { cause: l5 });
  const l3 = new Error("l3", { cause: l4 });
  const l2 = new Error("l2", { cause: l3 });
  const l1 = new Error("l1", { cause: l2 });
  assert.equal(causeChainTrailer(l1), "cause: l1 -> l2 -> l3 -> l4 -> l5");
});

test("MSG-CC-1: depth-6 chain emits 5 links + ` (truncated)` suffix on the last link", () => {
  const l6 = new Error("l6");
  const l5 = new Error("l5", { cause: l6 });
  const l4 = new Error("l4", { cause: l5 });
  const l3 = new Error("l3", { cause: l4 });
  const l2 = new Error("l2", { cause: l3 });
  const l1 = new Error("l1", { cause: l2 });
  assert.equal(causeChainTrailer(l1), "cause: l1 -> l2 -> l3 -> l4 -> l5 (truncated)");
});

test("MSG-CC-1: cycle detection (Error whose .cause is itself) terminates without infinite loop", () => {
  const loop = new Error("loop");
  loop.cause = loop;
  assert.equal(causeChainTrailer(loop), "cause: loop");
});

test("MSG-CC-1: non-Error string cause renders verbatim", () => {
  const err = new Error("a", { cause: "stringy" });
  assert.equal(causeChainTrailer(err), "cause: a -> stringy");
});

test("MSG-CC-1: non-Error non-string cause uses Object.prototype.toString fallback", () => {
  const err = new Error("a", { cause: { x: 1 } });
  assert.equal(causeChainTrailer(err), "cause: a -> [object Object]");
});

test("MSG-CC-1: bare string input (non-Error) renders verbatim", () => {
  assert.equal(causeChainTrailer("just a string"), "cause: just a string");
});

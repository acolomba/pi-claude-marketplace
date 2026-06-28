// tests/shared/probe-classifiers.test.ts
//
// HOOK-04 / D-58-02: lock the tightened-substring contract for
// `narrowResolverNotes`. The classifier matches the three reason-prefix
// tokens emitted by `domain/components/hooks.ts::parseHooksConfig`
// (plus the resolver's `malformed hooks.json: ` wrapper) via `startsWith`
// checks. A free-form note that incidentally contains the word "hooks"
// mid-string must NOT classify as `unsupported hooks` -- the old
// `note.includes("hooks")` form would silently miss-classify; the new
// form is prefix-anchored.

import assert from "node:assert/strict";
import test from "node:test";

import {
  narrowResolverNotes,
  narrowUnsupportedKinds,
} from "../../extensions/pi-claude-marketplace/shared/probe-classifiers.ts";

test("HOOK-04: narrowResolverNotes emits `unsupported hooks` for `hooks.json is not valid JSON:` prefix", () => {
  // parseHooksConfig emits this prefix when JSON.parse fails.
  const reasons = narrowResolverNotes(["hooks.json is not valid JSON: Unexpected token n"]);
  assert.deepEqual([...reasons], ["unsupported hooks"]);
});

test("HOOK-04: narrowResolverNotes emits `unsupported hooks` for `hooks.json failed schema validation:` prefix", () => {
  // parseHooksConfig emits this prefix when the typebox validator rejects
  // the parsed shape.
  const reasons = narrowResolverNotes([
    "hooks.json failed schema validation: PreToolUse[0].command must be a string",
  ]);
  assert.deepEqual([...reasons], ["unsupported hooks"]);
});

test("HOOK-04: narrowResolverNotes emits `unsupported hooks` for `unsupported hooks:` prefix (TOOL-02 supportability)", () => {
  // parseHooksConfig emits this prefix from the D-58-03 single-seam
  // supportability gate (TOOL-02). The catalog layer collapses every
  // `unsupported hooks: <debug-detail>` form to the closed `{unsupported hooks}`
  // Reason; the debug detail belongs to debug-log only.
  const reasons = narrowResolverNotes(["unsupported hooks: regex matcher detected (MATCH-02)"]);
  assert.deepEqual([...reasons], ["unsupported hooks"]);
});

test("HOOK-04: narrowResolverNotes emits `unsupported hooks` for the resolver's `malformed hooks.json:` wrapper", () => {
  // domain/resolver.ts::readStandaloneHooks wraps parseHooksConfig
  // failures with `malformed hooks.json: ` before pushing into
  // partial.notes. The catalog-layer narrower must detect this wrapped
  // form too, otherwise the resolver-emitted note would never classify.
  const reasons = narrowResolverNotes([
    "malformed hooks.json: hooks.json is not valid JSON: Unexpected token",
  ]);
  assert.deepEqual([...reasons], ["unsupported hooks"]);
});

test("HOOK-04: a free-form note containing `hooks` outside any known prefix does NOT classify as `unsupported hooks`", () => {
  // The old `note.includes("hooks")` form would have matched this note
  // and falsely emitted `unsupported hooks`. The tightened `startsWith`
  // form lets this fall through to the permissive `unsupported source`
  // fallback. Locks this classification.
  const reasons = narrowResolverNotes(["contains lspServers / hooks mentioned elsewhere"]);
  // The `lspServers` substring takes precedence at order (2); the
  // `unsupported hooks` arm is NOT triggered because the note does not
  // start with any of the four known prefixes.
  assert.deepEqual([...reasons], ["lsp"]);
});

test("HOOK-04: narrowResolverNotes emits `lsp` for a `contains lspServers` note (regression)", () => {
  // The lsp arm is untouched by HOOK-04; this regression guard ensures
  // the `lspServers` substring detection still fires after the hooks
  // tightening.
  const reasons = narrowResolverNotes(["contains lspServers"]);
  assert.deepEqual([...reasons], ["lsp"]);
});

test("HOOK-04: narrowResolverNotes emits `unsupported source` for any other note (permissive fallback)", () => {
  // Any note that matches neither the four hooks-prefixes nor the
  // `lspServers` substring falls through to `unsupported source`.
  const reasons = narrowResolverNotes(["source dir does not exist"]);
  assert.deepEqual([...reasons], ["unsupported source"]);
});

test("HOOK-04: narrowResolverNotes returns an empty array for an empty notes input", () => {
  const reasons = narrowResolverNotes([]);
  assert.deepEqual([...reasons], []);
});

test("HOOK-04 / WR-01: narrowResolverNotes deduplicates repeated classifications without falling through to the catch-all", () => {
  // Two parseHooksConfig-style failures classify to the same Reason and
  // dedup at the bucket level. Each note belongs to exactly one bucket
  // (hooks-prefixed -> `unsupported hooks`); a second hooks-prefixed note
  // is a no-op and MUST NOT fall through to the trailing
  // `unsupported source` catch-all (WR-01 fix).
  const reasons = narrowResolverNotes([
    "hooks.json is not valid JSON: foo",
    "hooks.json is not valid JSON: bar",
  ]);
  // The first note pushes `unsupported hooks`. The second note matches
  // the hooks prefix; the explicit `continue` after the dedup guard
  // prevents fall-through to the `unsupported source` arm.
  assert.deepEqual([...reasons], ["unsupported hooks"]);
});

test("WR-01: a second `malformed hooks.json:` note does NOT leak an unrelated `unsupported source` reason", () => {
  // Future resolver flows that emit both an initial parse-error note
  // AND a supportability-trip note must not pollute the row brace with
  // an `unsupported source` reason that has no on-disk basis.
  const reasons = narrowResolverNotes([
    "malformed hooks.json: hooks.json is not valid JSON: Unexpected token",
    "malformed hooks.json: unsupported hooks: (a) regex matcher in PreToolUse: Edit.*",
  ]);
  assert.deepEqual([...reasons], ["unsupported hooks"]);
});

test("PHOOK-05 / D-71-04: narrowUnsupportedKinds maps the `hooks` kind to the existing `unsupported hooks` member", () => {
  assert.deepEqual([...narrowUnsupportedKinds(["hooks"])], ["unsupported hooks"]);
});

test("PHOOK-05 / RSTATE-05: a mixed `hooks` + `lspServers` list dedups to two distinct tokens", () => {
  assert.deepEqual(
    [...narrowUnsupportedKinds(["hooks", "lspServers"])],
    ["unsupported hooks", "lsp"],
  );
});

test("PHOOK-05 / D-71-04: repeated `hooks` kinds collapse to a single aggregate `unsupported hooks` marker", () => {
  assert.deepEqual([...narrowUnsupportedKinds(["hooks", "hooks"])], ["unsupported hooks"]);
});

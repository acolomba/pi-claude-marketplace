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

import { narrowResolverNotes } from "../../extensions/pi-claude-marketplace/shared/probe-classifiers.ts";

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

test("HOOK-04 Pitfall 2: a free-form note containing `hooks` outside any known prefix does NOT classify as `unsupported hooks`", () => {
  // The old `note.includes("hooks")` form would have matched this note
  // and falsely emitted `unsupported hooks`. The tightened `startsWith`
  // form lets this fall through to the permissive `unsupported source`
  // fallback. Locks Pitfall 2.
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

test("HOOK-04: narrowResolverNotes deduplicates repeated classifications (multi-note input)", () => {
  // Two parseHooksConfig-style failures classify to the same Reason and
  // dedup at the bucket level. The second note re-matches the hooks
  // prefix; the `seen` guard skips re-pushing `unsupported hooks` AND
  // -- because the note IS hooks-prefixed -- it falls through to the
  // permissive `unsupported source` fallback (already-classified bucket
  // does not re-emit, but the per-note loop still walks every arm).
  const reasons = narrowResolverNotes([
    "hooks.json is not valid JSON: foo",
    "hooks.json is not valid JSON: bar",
  ]);
  // The first note pushes `unsupported hooks`. The second note matches
  // the hooks prefix but `seen` already has `unsupported hooks`; the
  // arm's `&& !seen.has(...)` predicate is false so it falls through
  // to the permissive fallback (which is also gated by `seen.has`).
  // Net dedup: `unsupported hooks` once + `unsupported source` once.
  assert.deepEqual([...reasons], ["unsupported hooks", "unsupported source"]);
});

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
//
// Also home to the `narrowProbeError` ladder. The list surface wraps that
// classifier twice for documentation (`narrowProbeError` /
// `narrowListFailReason`), and the ladder tests used to live behind
// test-only re-exports of BOTH wrappers, in two different orchestrator
// suites, while this file -- the ladder's own module -- had none. The
// wrapper bodies are byte-identical one-line delegates, so those suites
// were asserting the same five arms twice through a seam. The cases are
// consolidated here against the public function, which is what the
// wrappers already delegate to.

import assert from "node:assert/strict";
import test from "node:test";

import { InvalidMarketplaceManifestError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  narrowProbeError,
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

test("MCPR-03 / D-02: narrowResolverNotes emits `malformed mcp` for a `malformed mcp reference:` note", () => {
  // A broken mcpServers STRING reference (missing file / malformed JSON /
  // wrapper-less / out-of-root) is emitted by the resolver's reference
  // helpers with the collision-proof `malformed mcp reference:` prefix. It
  // narrows to the failure-class `{malformed mcp}` token.
  const reasons = narrowResolverNotes(['malformed mcp reference: file not found: "x.mcp.json"']);
  assert.deepEqual([...reasons], ["malformed mcp"]);
});

test("MCPR-03 / D-02: an inline `malformed mcpServers:` note STILL narrows to `unsupported source` (collision guard)", () => {
  // Note-prefix collision guard: the reference branch matches the FULL
  // `malformed mcp reference` prefix, so the inline `malformed mcpServers`
  // note (a distinct, out-of-scope case) does NOT reclassify to
  // `{malformed mcp}` and keeps its permissive `{unsupported source}`
  // fallback classification.
  const reasons = narrowResolverNotes(["malformed mcpServers: shape mismatch"]);
  assert.deepEqual([...reasons], ["unsupported source"]);
});

test("MCPR-03 / D-02 / WR-01: two `malformed mcp reference:` notes dedupe to a single `malformed mcp`", () => {
  const reasons = narrowResolverNotes([
    'malformed mcp reference: file not found: "x.mcp.json"',
    "malformed mcp reference: missing top-level mcpServers wrapper",
  ]);
  assert.deepEqual([...reasons], ["malformed mcp"]);
});

test("WR-01: a `malformed mcp reference:` note whose raw path contains `lspServers` narrows to `malformed mcp` (not `lsp`)", () => {
  // The specific `malformed mcp reference` prefix arm MUST run before the
  // broad `lspServers` substring arm. The author-controlled raw path is
  // embedded verbatim in the note, so a reference like
  // `config/lspServers/servers.mcp.json` would otherwise misclassify as
  // `{lsp}` instead of `{malformed mcp}`.
  const reasons = narrowResolverNotes([
    'malformed mcp reference: file not found: "config/lspServers/servers.mcp.json"',
  ]);
  assert.deepEqual([...reasons], ["malformed mcp"]);
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

test("D-90-05: a non-carve-out component kind narrows to `unsupported component` (not the source axis)", () => {
  assert.deepEqual([...narrowUnsupportedKinds(["monitors"])], ["unsupported component"]);
});

test("D-90-05: a mixed carve-out + non-carve-out list yields `lsp` + `unsupported component`", () => {
  assert.deepEqual(
    [...narrowUnsupportedKinds(["lspServers", "monitors"])],
    ["lsp", "unsupported component"],
  );
});

test("WDET-04: an empty unsupported-kind list emits no reason", () => {
  assert.deepEqual([...narrowUnsupportedKinds([])], []);
});

test("WDET-04: the workflows kind emits the dedicated workflows reason", () => {
  assert.deepEqual([...narrowUnsupportedKinds(["workflows"])], ["workflows"]);
});

test("WDET-04: repeated workflows kinds collapse to one reason", () => {
  assert.deepEqual([...narrowUnsupportedKinds(["workflows", "workflows"])], ["workflows"]);
});

test("WDET-04: workflows follows lsp in canonical reason order", () => {
  assert.deepEqual([...narrowUnsupportedKinds(["lspServers", "workflows"])], ["lsp", "workflows"]);
});

test("WDET-04: workflows follows a generic unsupported component reason", () => {
  assert.deepEqual(
    [...narrowUnsupportedKinds(["monitors", "workflows"])],
    ["unsupported component", "workflows"],
  );
});

// ──────────────────────────────────────────────────────────────────────────
// narrowProbeError: the errno/typed-error ladder behind every read surface.
// ──────────────────────────────────────────────────────────────────────────

test("260525-cjr A3 / WR-01 / WR-03: narrowProbeError -> EACCES classifies as `permission denied`", () => {
  const err = new Error("EACCES: permission denied, open '/foo/bar/manifest.json'");
  (err as NodeJS.ErrnoException).code = "EACCES";
  assert.equal(narrowProbeError(err), "permission denied");
});

test("260525-cjr A3 / WR-03: narrowProbeError -> EPERM also classifies as `permission denied`", () => {
  const err = new Error("EPERM");
  (err as NodeJS.ErrnoException).code = "EPERM";
  assert.equal(narrowProbeError(err), "permission denied");
});

test("260525-cjr A3 / WR-01 / WR-03: narrowProbeError -> ENOENT classifies as `source missing`", () => {
  const err = new Error("ENOENT");
  (err as NodeJS.ErrnoException).code = "ENOENT";
  assert.equal(narrowProbeError(err), "source missing");
});

test("narrowProbeError -> ENOTDIR also classifies as `source missing`", () => {
  // Documented alongside ENOENT in the classifier's own comment but never
  // asserted while the tests lived behind the list-surface seams.
  const err = new Error("ENOTDIR");
  (err as NodeJS.ErrnoException).code = "ENOTDIR";
  assert.equal(narrowProbeError(err), "source missing");
});

test("260525-cjr A3 / WR-01 / WR-03: narrowProbeError -> SyntaxError classifies as `unparseable`", () => {
  const err = new SyntaxError("Unexpected token } in JSON at position 7");
  assert.equal(narrowProbeError(err), "unparseable");
});

test("D-48-B IN-02: narrowProbeError -> schema-invalid InvalidMarketplaceManifestError classifies as `invalid manifest`", () => {
  // Schema-invalid manifest = typed error with NO SyntaxError cause. The read
  // surface reports the SAME `{invalid manifest}` reason the write path does.
  const err = new InvalidMarketplaceManifestError("marketplace.json schema invalid: plugins");
  assert.equal(narrowProbeError(err), "invalid manifest");
});

test("D-48-B IN-02: narrowProbeError -> malformed-JSON InvalidMarketplaceManifestError stays `unparseable`", () => {
  // Malformed JSON = typed error WHOSE cause IS a SyntaxError. The collapse
  // into one InvalidMarketplaceManifestError branch must preserve this arm.
  const err = new InvalidMarketplaceManifestError("bad json", {
    cause: new SyntaxError("Unexpected token"),
  });
  assert.equal(narrowProbeError(err), "unparseable");
});

test("260525-cjr A3 / WR-01: narrowProbeError -> generic Error falls through to `unreadable` (NOT `unsupported source`)", () => {
  const err = new Error("something went wrong probing this plugin");
  const reason = narrowProbeError(err);
  assert.equal(reason, "unreadable");
  assert.notEqual(reason, "unsupported source");
});

test("WR-03: narrowProbeError -> non-Error throws fall through to `unreadable`", () => {
  assert.equal(narrowProbeError("string throw"), "unreadable");
  assert.equal(narrowProbeError(42), "unreadable");
  assert.equal(narrowProbeError(undefined), "unreadable");
});

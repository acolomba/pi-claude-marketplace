import assert from "node:assert/strict";
import test from "node:test";

import { __test_narrowResolverReasons } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import {
  narrowResolverNotes,
  narrowUnsupportedKinds,
} from "../../../extensions/pi-claude-marketplace/shared/probe-classifiers.ts";

// Cross-surface parity (HOOK-03 / LIFE-01 / SURF-01): the install cascade
// classifier `narrowResolverReasons` and the read-only probe classifier
// `narrowResolverNotes` MUST emit the SAME closed-set REASONS token for the
// SAME resolver-emitted note. Without this contract, the same on-disk
// condition surfaces with different `{<reason>}` brace content depending on
// which command the user runs (info/list vs install) -- violating the
// same-plugin-same-reason invariant. (USTAT-01 / D-64-01: the OUTER status
// token now differs by surface -- list/info render `(unsupported)` for the
// force-degradable arm while the install error surface renders `(unavailable)`
// -- but the `{<reason>}` brace CONTENT this test pins is byte-identical.)
//
// The four `hooks.json`-prefix families and the `contains lspServers`
// carve-out plus the generic catch-all are the cross-surface pin set.
// Future prefix-set drift on either classifier red-fails this suite.
const PARITY_CASES = [
  {
    note: "hooks.json is not valid JSON: Unexpected token ] in JSON at position 5",
    expected: "unsupported hooks",
  },
  {
    note: "hooks.json failed schema validation: /description: expected array",
    expected: "unsupported hooks",
  },
  {
    note: "unsupported hooks: (a) regex matcher in PreToolUse: /foo.*/",
    expected: "unsupported hooks",
  },
  {
    note: "malformed hooks.json: hooks.json failed schema validation: /description: expected array",
    expected: "unsupported hooks",
  },
  { note: "contains lspServers", expected: "lsp" },
  { note: "some other unsupported source detail", expected: "unsupported source" },
] as const;

for (const { note, expected } of PARITY_CASES) {
  test(`HOOK-03 / SURF-01 cross-surface parity: "${note.slice(0, 40)}..." -> "${expected}" on both surfaces`, () => {
    const probeOut = narrowResolverNotes([note]);
    const installOut = __test_narrowResolverReasons([note]);
    assert.deepEqual(probeOut, [expected], `probe surface emitted ${JSON.stringify(probeOut)}`);
    assert.deepEqual(
      installOut,
      [expected],
      `install surface emitted ${JSON.stringify(installOut)}`,
    );
  });
}

// D-64-02 / RSTATE-05 / SURF-01: per-kind unsupported markers must render
// byte-identically across `list`, `info`, and the `install` error surface for
// the same unsupported plugin. `list` and `info` derive the marker from the
// resolver's typed `unsupported[]` component-kind list via the single shared
// helper `narrowUnsupportedKinds`; the `install` error surface derives it from
// the thrown PluginShapeError's `r.notes` (`contains <kind>`) via
// `narrowResolverReasons`. Both MUST agree for the same kind, so a force-
// degradable component never surfaces a different `{<reason>}` brace content
// depending on which command the user runs (the outer status token differs --
// list/info `(unsupported)` vs install `(unavailable)` per USTAT-01 -- but the
// brace content this test pins is byte-identical). Each case pairs the typed
// kind token (list/info input) with its matching resolver note (install input).
const PER_KIND_PARITY_CASES = [
  // HOOK-04 / D-58-02: `lspServers` is the sole non-generic (soft-degradable)
  // per-kind marker and renders as `lsp`.
  { kind: "lspServers", note: "contains lspServers", expected: "lsp" },
  // Every other unsupported component kind renders the generic marker.
  { kind: "monitors", note: "contains monitors", expected: "unsupported source" },
  { kind: "themes", note: "contains themes", expected: "unsupported source" },
] as const;

for (const { kind, note, expected } of PER_KIND_PARITY_CASES) {
  test(`RSTATE-05 / SURF-01 per-kind unsupported marker parity: "${kind}" -> "${expected}" on list, info, and install`, () => {
    // list + info derive markers from the typed `unsupported[]` list via the
    // shared helper (both orchestrators import `narrowUnsupportedKinds`).
    const listInfoOut = narrowUnsupportedKinds([kind]);
    // install error surface derives the marker from the resolver `contains
    // <kind>` note threaded onto the thrown PluginShapeError's `reasons`.
    const installOut = __test_narrowResolverReasons([note]);
    assert.deepEqual(
      listInfoOut,
      [expected],
      `list/info surface emitted ${JSON.stringify(listInfoOut)}`,
    );
    assert.deepEqual(
      installOut,
      [expected],
      `install surface emitted ${JSON.stringify(installOut)}`,
    );
    assert.deepEqual(
      listInfoOut,
      installOut,
      "list/info and install per-kind markers must be byte-identical",
    );
  });
}

// RSTATE-05 / SURF-01 / D-64-02 multi-kind parity: a single-element case agrees
// across surfaces only by coincidence (the install path's empty-array fallback
// happens to emit the same generic marker). The byte-parity invariant must hold
// for a MULTI-kind `unsupported` plugin, where the install path previously
// dropped every non-`lspServers` kind once an earlier kind had populated the
// row -- so `install` rendered `["lsp"]` while `list`/`info` rendered
// `["lsp","unsupported source"]` for the SAME plugin. This case pairs the typed
// kind list (list/info input) against the matching resolver notes (install
// input) and asserts both surfaces emit a byte-identical multi-marker set.
test("RSTATE-05 / SURF-01 / D-64-02 multi-kind unsupported markers are byte-identical across list, info, and install", () => {
  // list + info derive markers from the typed `unsupported[]` list via the
  // shared helper.
  const listInfoOut = narrowUnsupportedKinds(["lspServers", "themes"]);
  // install error surface derives markers from the resolver `contains <kind>`
  // notes threaded onto the thrown PluginShapeError's `reasons`.
  const installOut = __test_narrowResolverReasons(["contains lspServers", "contains themes"]);
  assert.deepEqual(
    listInfoOut,
    ["lsp", "unsupported source"],
    `list/info surface emitted ${JSON.stringify(listInfoOut)}`,
  );
  assert.deepEqual(
    installOut,
    ["lsp", "unsupported source"],
    `install surface emitted ${JSON.stringify(installOut)}`,
  );
  assert.deepEqual(
    listInfoOut,
    installOut,
    "list/info and install multi-kind markers must be byte-identical",
  );
});

// PHOOK-05 / D-71-04 / RSTATE-05: a parseable hooks.json with at least one
// unsupportable event / matcher group / handler resolves `unsupported` (force-
// degradable) and carries the typed `hooks` kind on the `unsupported[]` list.
// `list` and `info` both derive the row brace from that typed list via the SAME
// shared `narrowUnsupportedKinds` helper, so the single aggregate `{unsupported
// hooks}` marker renders byte-identically across both read-only surfaces
// regardless of how many handlers dropped (first-wins dedup).
test("PHOOK-05 / D-71-04 partial-hook `{unsupported hooks}` aggregate is byte-identical across list and info", () => {
  const listOut = narrowUnsupportedKinds(["hooks"]);
  const infoOut = narrowUnsupportedKinds(["hooks"]);
  assert.deepEqual(
    listOut,
    ["unsupported hooks"],
    `list surface emitted ${JSON.stringify(listOut)}`,
  );
  assert.deepEqual(
    infoOut,
    ["unsupported hooks"],
    `info surface emitted ${JSON.stringify(infoOut)}`,
  );
  assert.deepEqual(listOut, infoOut, "list and info partial-hook markers must be byte-identical");
});

test("PHOOK-05 / D-71-04 a partial-hook + lsp plugin renders both markers identically across list and info", () => {
  const listOut = narrowUnsupportedKinds(["hooks", "lspServers"]);
  const infoOut = narrowUnsupportedKinds(["hooks", "lspServers"]);
  assert.deepEqual(listOut, ["unsupported hooks", "lsp"]);
  assert.deepEqual(listOut, infoOut, "list and info multi-kind markers must be byte-identical");
});

// IN-02 / RSTATE-05: the no-force install/update FAILURE row sources its
// per-kind markers from the resolver's typed `unsupported[]` list (threaded onto
// the thrown PluginShapeError), narrowed through the SAME `narrowUnsupportedKinds`
// helper `list`/`info` use. A `hooks`-only unsupported plugin carries NO
// `contains hooks` note, so the typed list is its ONLY reason source -- without
// it the row degraded to the generic `{unsupported source}` fallback (the IN-02
// defect). These cases pin that `narrowResolverReasons` reads the typed list and
// renders byte-identically to list/info.
test("IN-02 / RSTATE-05: narrowResolverReasons reads the typed `hooks` kind (no notes) -> `unsupported hooks`, matching list/info", () => {
  const listInfoOut = narrowUnsupportedKinds(["hooks"]);
  // install failure row: empty `notes`, typed `unsupported[]` = ["hooks"].
  const installOut = __test_narrowResolverReasons([], ["hooks"]);
  assert.deepEqual(listInfoOut, ["unsupported hooks"]);
  assert.deepEqual(installOut, ["unsupported hooks"]);
  assert.deepEqual(listInfoOut, installOut, "list/info and install must agree for the hooks kind");
});

test("IN-02 / RSTATE-05: narrowResolverReasons dedups the typed `lspServers` kind against its `contains` note -> single `lsp`", () => {
  const installOut = __test_narrowResolverReasons(["contains lspServers"], ["lspServers"]);
  assert.deepEqual(installOut, ["lsp"]);
});

test("IN-02 / RSTATE-05: empty notes + empty typed kinds keeps the permissive `unsupported source` fallback", () => {
  // The genuinely-unavailable (structural) path throws with an empty typed list,
  // so the fallback still fires only when BOTH reason sources are empty.
  assert.deepEqual([...__test_narrowResolverReasons([])], ["unsupported source"]);
  assert.deepEqual([...__test_narrowResolverReasons([], [])], ["unsupported source"]);
});

// RSTATE-05 / D-64-07 regression guard: a STRUCTURAL hooks defect (malformed /
// unparseable hooks.json) routes to the `unavailable` arm and its reason stays
// on the `notes` path via `narrowResolverNotes`; the per-kind list helper is
// NEVER fed a structural defect. The per-kind helper DOES emit `unsupported
// hooks` for the force-degradable `hooks` kind (PHOOK-05 above), so the two
// `unsupported hooks` sources are distinct: structural via notes, degradable via
// the typed kind list. This guard pins that a structural input never sneaks onto
// the per-kind path -- a `hooks`-free kind list yields only `lsp` / `unsupported
// source`, never the marker by structural means.
test("RSTATE-05 / D-64-07 structural hooks reason stays on the notes path, distinct from the degradable per-kind marker", () => {
  const structuralNote =
    "malformed hooks.json: hooks.json failed schema validation: /description: expected array";
  // notes path (unavailable arm) classifies the structural reason ...
  assert.deepEqual(narrowResolverNotes([structuralNote]), ["unsupported hooks"]);
  assert.deepEqual(__test_narrowResolverReasons([structuralNote]), ["unsupported hooks"]);
  // ... while a kind list WITHOUT `hooks` only yields the closed `lsp` /
  // `unsupported source` family (the degradable `hooks` kind is the sole path to
  // the per-kind `unsupported hooks` marker, exercised above).
  const listOut = narrowUnsupportedKinds(["lspServers", "monitors"]);
  assert.deepEqual(listOut, ["lsp", "unsupported source"]);
  assert.ok(
    !listOut.includes("unsupported hooks"),
    "a structural-only kind list must never emit the `unsupported hooks` marker",
  );
});

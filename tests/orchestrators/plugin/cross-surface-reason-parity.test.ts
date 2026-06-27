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
// condition surfaces with different `(unavailable) {<reason>}` tokens
// depending on which command the user runs (info/list vs install) --
// violating the same-plugin-same-reason invariant.
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
// degradable component never surfaces a different `(unavailable) {<reason>}`
// token depending on which command the user runs. Each case pairs the typed
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

// RSTATE-05 / D-64-07 regression guard: structural reasons stay on the `notes`
// path and are NOT re-routed through the per-kind list helper. The `unsupported`
// arm's `unsupported[]` list never carries a `hooks` kind (a malformed/unsupported
// hooks.json is structural and routes to the `unavailable` arm), so the list
// helper can never emit the structural `unsupported hooks` marker -- that marker
// is reachable only via `narrowResolverNotes` over the structural notes.
test("RSTATE-05 / D-64-07 structural hooks reason stays on the notes path, never the per-kind list helper", () => {
  const structuralNote =
    "malformed hooks.json: hooks.json failed schema validation: /description: expected array";
  // notes path (unavailable arm) classifies the structural reason ...
  assert.deepEqual(narrowResolverNotes([structuralNote]), ["unsupported hooks"]);
  assert.deepEqual(__test_narrowResolverReasons([structuralNote]), ["unsupported hooks"]);
  // ... but the per-kind list helper (unsupported arm) cannot produce it: even a
  // mixed kind list only yields the closed `lsp` / `unsupported source` family.
  const listOut = narrowUnsupportedKinds(["lspServers", "monitors"]);
  assert.deepEqual(listOut, ["lsp", "unsupported source"]);
  assert.ok(
    !listOut.includes("unsupported hooks" as never),
    "per-kind list helper must never emit the structural `unsupported hooks` marker",
  );
});

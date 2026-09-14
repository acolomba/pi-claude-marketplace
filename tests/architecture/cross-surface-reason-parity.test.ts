import assert from "node:assert/strict";
import test from "node:test";

import { narrowResolverReasons } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts";
import { notify } from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import {
  narrowResolverNotes,
  narrowUnsupportedKinds,
} from "../../extensions/pi-claude-marketplace/shared/probe-classifiers.ts";

import { makeCtx, piWithBothLoaded, verifyPi } from "./catalog-uat/mock-pi.ts";

import type { NotificationMessage } from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

for (const { note, reason } of [
  {
    note: "hooks.json is not valid JSON: Unexpected token ] in JSON at position 5",
    reason: "unsupported hooks",
  },
  {
    note: "hooks.json failed schema validation: /description: expected array",
    reason: "unsupported hooks",
  },
  {
    note: "unsupported hooks: (a) regex matcher in PreToolUse: /foo.*/",
    reason: "unsupported hooks",
  },
  {
    note: "malformed hooks.json: hooks.json failed schema validation: /description: expected array",
    reason: "unsupported hooks",
  },
  { note: "contains lspServers", reason: "lsp" },
  { note: "contains monitors", reason: "unsupported source" },
  { note: 'malformed mcp reference: file not found: "x.mcp.json"', reason: "malformed mcp" },
  {
    note: 'malformed mcp reference: invalid JSON in "x.mcp.json": Unexpected token n',
    reason: "malformed mcp",
  },
  { note: "some other unsupported source detail", reason: "unsupported source" },
] as const) {
  test(`keeps the install and read-only note surfaces equal for ${reason}: ${note}`, () => {
    // arrange
    const notes = [note];

    // act
    const installReasons = narrowResolverReasons(notes);
    const readOnlyReasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(installReasons, [reason]);
    assert.deepStrictEqual(readOnlyReasons, [reason]);
    assert.deepStrictEqual(installReasons, readOnlyReasons);
  });
}

test("keeps structural multi-defect reasons equal on install and read-only surfaces", () => {
  // arrange
  const notes = ['malformed mcp reference: file not found: "x.mcp.json"', "contains monitors"];

  // act
  const installReasons = narrowResolverReasons(notes, [], false);
  const readOnlyReasons = narrowResolverNotes(notes);

  // assert
  assert.deepStrictEqual(installReasons, ["malformed mcp", "unsupported source"]);
  assert.deepStrictEqual(readOnlyReasons, ["malformed mcp", "unsupported source"]);
  assert.deepStrictEqual(installReasons, readOnlyReasons);
});

for (const { kind, note, reason } of [
  { kind: "lspServers", note: "contains lspServers", reason: "lsp" },
  { kind: "monitors", note: "contains monitors", reason: "unsupported component" },
  { kind: "themes", note: "contains themes", reason: "unsupported component" },
] as const) {
  test(`keeps the install, list, and info component surfaces equal for ${kind}`, () => {
    // arrange
    const kinds = [kind];
    const notes = [note];

    // act
    const installReasons = narrowResolverReasons(notes, kinds, true);
    const listAndInfoReasons = narrowUnsupportedKinds(kinds);

    // assert
    assert.deepStrictEqual(installReasons, [reason]);
    assert.deepStrictEqual(listAndInfoReasons, [reason]);
    assert.deepStrictEqual(installReasons, listAndInfoReasons);
  });
}

test("keeps multi-component install, list, and info markers in the same order", () => {
  // arrange
  const kinds = ["lspServers", "themes"];
  const notes = ["contains lspServers", "contains themes"];

  // act
  const installReasons = narrowResolverReasons(notes, kinds, true);
  const listAndInfoReasons = narrowUnsupportedKinds(kinds);

  // assert
  assert.deepStrictEqual(installReasons, ["lsp", "unsupported component"]);
  assert.deepStrictEqual(listAndInfoReasons, ["lsp", "unsupported component"]);
  assert.deepStrictEqual(installReasons, listAndInfoReasons);
});

test("keeps a typed hooks marker equal on install, list, and info surfaces", () => {
  // arrange
  const kinds = ["hooks"];

  // act
  const installReasons = narrowResolverReasons([], kinds, true);
  const listAndInfoReasons = narrowUnsupportedKinds(kinds);

  // assert
  assert.deepStrictEqual(installReasons, ["unsupported hooks"]);
  assert.deepStrictEqual(listAndInfoReasons, ["unsupported hooks"]);
  assert.deepStrictEqual(installReasons, listAndInfoReasons);
});

test("keeps structural hooks notes on the shared note axis", () => {
  // arrange
  const notes = [
    "malformed hooks.json: hooks.json failed schema validation: /description: expected array",
  ];

  // act
  const installReasons = narrowResolverReasons(notes);
  const readOnlyReasons = narrowResolverNotes(notes);

  // assert
  assert.deepStrictEqual(installReasons, ["unsupported hooks"]);
  assert.deepStrictEqual(readOnlyReasons, ["unsupported hooks"]);
  assert.deepStrictEqual(installReasons, readOnlyReasons);
});

// XSURF-03 cross-surface byte-parity for the RENDERED reason brace. The two
// arms above compare reason ARRAYS; this one compares the `{…}` segment
// `notify()` composes from an identical array, so a divergence in ordering,
// separator, or a dropped kind is caught on top of array equality. Both
// surfaces are driven from ONE `narrowUnsupportedKinds` result -- the seam the
// `list` row uses -- rather than the install-path `narrowResolverReasons`,
// which also folds in note-derived reasons and could diverge.

const PARTIALLY_UPGRADABLE_BRACE = /\(partially-upgradable\) (\{[^}]*\})/;

/**
 * Renders one message through the strict catalog notification boundary and
 * returns its `(partially-upgradable) {…}` brace.
 */
function renderPartiallyUpgradableBrace(message: NotificationMessage): string {
  const boundary = makeCtx();
  const pi = piWithBothLoaded();

  notify(boundary.ctx, pi, message);

  boundary.verifyContext();
  verifyPi(pi);
  const body = boundary.notifications[0]?.message;
  assert.ok(body !== undefined, "the strict boundary must capture one notification");
  const matched = PARTIALLY_UPGRADABLE_BRACE.exec(body);
  assert.ok(matched, `expected a (partially-upgradable) {…} brace in:\n${body}`);

  return matched[1]!;
}

test("keeps the update-decline and list partially-upgradable reason braces byte-identical", () => {
  // arrange -- one seam result feeds both surfaces, so any difference can only
  // come from how each arm composes the brace.
  const reasons = narrowUnsupportedKinds(["lspServers", "themes"]);
  const row = { status: "partially-upgradable", name: "hello", version: "1.0.0", reasons } as const;

  // act -- the list-inventory row carries no `partialHint` (no trailer); the
  // update-decline row carries one (trailer plus warning severity).
  const listBrace = renderPartiallyUpgradableBrace({
    marketplaces: [{ name: "mp", scope: "project", plugins: [row] }],
  });
  const declineBrace = renderPartiallyUpgradableBrace({
    label: "Plugin update",
    cardinality: "single",
    marketplaces: [
      {
        name: "mp",
        scope: "project",
        plugins: [{ ...row, partialHint: true, severity: "warning", needsReload: false }],
      },
    ],
  });

  // assert
  assert.equal(
    declineBrace,
    listBrace,
    "the update-decline reason brace must be byte-identical to the list partially-upgradable brace",
  );
});

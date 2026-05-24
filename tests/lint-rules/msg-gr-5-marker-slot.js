// tests/lint-rules/msg-gr-5-marker-slot.js
//
// MSG-GR-5 (docs/messaging-style-guide.md § 1): marketplace rows /
// headers carry an optional `<marker>` slot in angle brackets. Closed
// set: `<autoupdate>` (autoupdate ON) and `<no autoupdate>` (autoupdate
// OFF). Plugin rows MUST NOT carry the marker; autoupdate is a
// marketplace-level property. Position: between the scope bracket and
// the status token.
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - `MarketplaceRow.marker` field at
//     `extensions/pi-claude-marketplace/presentation/compact-line.ts` is
//     a closed literal-union `"autoupdate" | "no autoupdate"`; the
//     TypeScript type system rejects any other string at every callsite
//     that constructs a `MarketplaceRow`.
//   - The plugin row variants (`PluginInlineRow`, `PluginCascadeRow`,
//     `PluginListRow`, `PluginInlineUninstalledRow`) DO NOT declare a
//     `marker` field, so the renderer cannot emit a marker on plugin
//     rows.
//   - The renderer for `MarketplaceRow` is the sole emission point;
//     `tests/architecture/catalog-uat.test.ts` byte-equality on the
//     catalog's marketplace rows locks the position between scope and
//     status.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09). No-op visitor per
// RESEARCH.md Pitfall 8.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-gr-5-marker-slot",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-GR-5: marketplace rows / headers carry an optional `<marker>` slot, closed set `autoupdate` | `no autoupdate`; plugin rows MUST NOT carry the marker. Structurally enforced by `MarketplaceRow.marker` literal-union in `presentation/compact-line.ts` and by plugin-row interfaces lacking the field; this rule cites the enforcement and exists for registry parity (D-14-09).",
    },
    messages: {
      structurallyEnforced:
        "MSG-GR-5 marker slot is structurally enforced; see MarketplaceRow.marker literal-union in presentation/compact-line.ts (plugin-row interfaces lack the field).",
    },
    schema: [],
  },
  defaultOptions: [],
  create() {
    return {
      // No-op visitor (RESEARCH.md Pitfall 8).
      Program: () => {},
    };
  },
});

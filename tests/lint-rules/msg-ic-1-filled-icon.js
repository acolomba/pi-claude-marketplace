// tests/lint-rules/msg-ic-1-filled-icon.js
//
// MSG-IC-1 (docs/messaging-style-guide.md § 2 -- Status Icons): the
// filled icon `●` (U+25CF) MUST be used on plugin rows when the plugin
// is installed and in the requested state (`(installed)`, `(updated)`,
// `(upgradable)`, `(skipped)` no-ops), and on marketplace rows /
// headers for the OK outcome class (`(added)`, `(removed)`, `(updated)`,
// `(skipped)` no-ops).
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - The literal `"●"` is a file-private constant `ICON_INSTALLED`
//     declared at `extensions/pi-claude-marketplace/presentation/compact-line.ts:62`.
//     It is NOT exported -- no caller outside `compact-line.ts` can
//     reference the glyph.
//   - The renderer's icon dispatch function (the only emission point)
//     resolves the icon from the row's `status` / `outcomeClass` via a
//     switch keyed on the closed `StatusToken` literal-union. Adding a
//     new "filled-icon" status without updating the dispatch is a
//     TypeScript exhaustiveness error.
//   - `tests/architecture/catalog-uat.test.ts` byte-equality on the
//     catalog's rendered icon column locks the dispatch.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09). No-op visitor per
// RESEARCH.md Pitfall 8.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-ic-1-filled-icon",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-IC-1: the filled icon `●` (U+25CF) appears on installed-and-requested plugin states and on OK marketplace outcomes. Structurally enforced by the file-private `ICON_INSTALLED` constant at `presentation/compact-line.ts:62` and the renderer's icon dispatch fn (sole emission point); this rule cites the enforcement and exists for registry parity (D-14-09).",
    },
    messages: {
      structurallyEnforced:
        "MSG-IC-1 filled-icon usage is structurally enforced; see ICON_INSTALLED at presentation/compact-line.ts:62 (file-private) and the renderer's icon dispatch.",
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

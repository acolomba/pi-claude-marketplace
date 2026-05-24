// tests/lint-rules/msg-ic-2-open-icon.js
//
// MSG-IC-2 (docs/messaging-style-guide.md § 2 -- Status Icons): the
// open icon `○` (U+25CB) MUST be used on PLUGIN rows when the plugin is
// NOT installed and there is no error -- `(available)` (declared in
// manifest but not installed in this scope) and `(uninstalled)`
// (explicitly removed by the operator). The open icon MUST NOT appear
// on marketplace rows.
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - The literal `"○"` is a file-private constant `ICON_AVAILABLE`
//     declared at `extensions/pi-claude-marketplace/presentation/compact-line.ts:63`.
//     It is NOT exported -- no caller outside `compact-line.ts` can
//     reference the glyph.
//   - The renderer's icon dispatch function chooses `ICON_AVAILABLE`
//     only for the `(available)` / `(uninstalled)` plugin status tokens
//     via a switch on the closed `StatusToken` literal-union.
//   - The marketplace renderer's icon path resolves from
//     `MarketplaceRow.outcomeClass` (`"ok"` | `"failure"`) -- the open
//     icon code path is unreachable for marketplace rows.
//   - `tests/architecture/catalog-uat.test.ts` byte-equality on the
//     catalog locks the dispatch.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09). No-op visitor per
// RESEARCH.md Pitfall 8.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-ic-2-open-icon",
  meta: {
    type: "problem",
    docs: {
      description:
        "MSG-IC-2: the open icon `○` (U+25CB) appears only on plugin rows in non-installed non-error states (`available`, `uninstalled`); never on marketplace rows. Structurally enforced by the file-private `ICON_AVAILABLE` constant at `presentation/compact-line.ts:63` and the renderer's per-shape icon dispatch fn; this rule cites the enforcement and exists for registry parity (D-14-09).",
    },
    messages: {
      structurallyEnforced:
        "MSG-IC-2 open-icon usage is structurally enforced; see ICON_AVAILABLE at presentation/compact-line.ts:63 (file-private) and the renderer's icon dispatch.",
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

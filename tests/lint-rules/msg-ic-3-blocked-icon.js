// tests/lint-rules/msg-ic-3-blocked-icon.js
//
// MSG-IC-3 (docs/messaging-style-guide.md § 2 -- Status Icons): the
// blocked icon `⊘` (U+2298) MUST be used on plugin rows for error or
// blocked states regardless of install state -- `(unavailable)`,
// `(failed)`, `(rollback failed)`, `(manual recovery)`, and
// `(skipped)` failure-cascade children. On marketplace rows / headers
// it signals a failure / error outcome class (`MarketplaceRow.outcomeClass
// === "failure"`).
//
// Structural enforcement (D-14-09 LOCKED -- meta-assertion class):
//   - The literal `"⊘"` is a file-private constant `ICON_UNINSTALLABLE`
//     declared at `extensions/pi-claude-marketplace/presentation/compact-line.ts:64`.
//     It is NOT exported -- no caller outside `compact-line.ts` can
//     reference the glyph.
//   - The renderer's icon dispatch fn resolves the icon from the row's
//     `status` for plugin variants and from `outcomeClass` for the
//     `MarketplaceRow` variant; both paths go through a switch on a
//     closed literal-union.
//   - `tests/architecture/catalog-uat.test.ts` byte-equality on the
//     catalog's `(failed)` / `(unavailable)` / `(rollback failed)` /
//     `(manual recovery)` rows locks the dispatch.
//
// This rule is a STRUCTURAL META-ASSERTION (D-14-09). No-op visitor per
// RESEARCH.md Pitfall 8.

import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/acolomba/pi-claude-marketplace/blob/main/docs/messaging-style-guide.md#${name.replace(/^msg-/, "msg-")}`,
);

export default createRule({
  name: "msg-ic-3-blocked-icon",
  meta: {
    type: "problem",
    docs: {
      description:
        'MSG-IC-3: the blocked icon `⊘` (U+2298) appears on plugin error/blocked states and on marketplace failure outcomes (`MarketplaceRow.outcomeClass === "failure"`). Structurally enforced by the file-private `ICON_UNINSTALLABLE` constant at `presentation/compact-line.ts:64` and the renderer\'s icon dispatch fn; this rule cites the enforcement and exists for registry parity (D-14-09).',
    },
    messages: {
      structurallyEnforced:
        "MSG-IC-3 blocked-icon usage is structurally enforced; see ICON_UNINSTALLABLE at presentation/compact-line.ts:64 (file-private) and the renderer's icon dispatch.",
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
